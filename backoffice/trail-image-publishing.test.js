'use strict';

const fs=require('fs/promises');
const os=require('os');
const path=require('path');
const {materializeApprovedTrailImages,MAXIMUM_REMOTE_IMAGE_BYTES}=require('./workflows/materialize-approved-trail-images');
const {recordTrailImageDeployment}=require('./workflows/trail-image-deployment-receipts');
const {main:confirmTrailImages}=require('./cli/confirm-trail-images');

describe('human-approved trail-photo publishing',()=>{
  test('materializes only an approved protected upload into an image override',async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'orma-trail-photo-'));await fs.mkdir(path.join(root,'data'),{recursive:true});
    await fs.writeFile(path.join(root,'data/trail-image-overrides.json'),JSON.stringify({schemaVersion:1,updatedAt:null,trails:[]}));
    const artifact={contractVersion:'1.0.0',requests:[{id:'approval-1',trailId:'seceda',title:'Seceda Ridge Trail',uploadRef:'backofficeImageUploads/upload-asset-1',fileName:'photo.jpg',mimeType:'image/jpeg',fileSize:5,width:1200,height:800,creator:'Benedetta Lorenzi',rightsBasis:'orma-owned',altText:'A dog on Seceda ridge',status:'approved-for-pr-creation',approvedAt:'2026-08-25T10:00:00Z'}]};
    const uploadData=`data:image/jpeg;base64,${Buffer.from('photo').toString('base64')}`;
    const writes=[];const store={getArtifact:async()=>artifact,getImageUpload:async()=>({mimeType:'image/jpeg',fileSize:5,uploadData}),setArtifact:async(id,value)=>writes.push({id,value})};
    try{
      const result=await materializeApprovedTrailImages({root,store,at:'2026-08-25T10:05:00Z'});
      expect(result.materialized).toBe(1);expect(result.assetRefs[0]).toMatch(/^images\/trails\/seceda-/);
      const overrides=JSON.parse(await fs.readFile(path.join(root,'data/trail-image-overrides.json'),'utf8'));
      expect(overrides.trails[0]).toEqual(expect.objectContaining({id:'seceda',approvedReviewId:'approval-1',fields:expect.objectContaining({imageIcon:result.assetRefs[0],imageCreator:'Benedetta Lorenzi',imageLicence:'ORMA-owned'})}));
      expect(writes[0].value.requests[0].status).toBe('pr-materialized');
      expect(await fs.readFile(path.join(root,result.assetRefs[0]),'utf8')).toBe('photo');
    }finally{await fs.rm(root,{recursive:true,force:true});}
  });

  test('records live status only when the approved image is in the deployed override',()=>{
    const requests={requests:[{id:'approval-1',trailId:'seceda',status:'awaiting-pr-merge'},{id:'approval-2',trailId:'cadini',status:'awaiting-pr-merge'}]};
    const overrides={trails:[{id:'seceda',approvedReviewId:'approval-1',fields:{imageIcon:'images/trails/seceda.jpg'}}]};
    const result=recordTrailImageDeployment(requests,overrides,{commitSha:'abc123',deploymentRunUrl:'https://github.com/orma/actions/runs/1',publicBaseUrl:'https://www.app-orma.com'},{at:'2026-08-25T11:00:00Z'});
    expect(result.published).toBe(1);expect(result.artifact.requests[0]).toEqual(expect.objectContaining({status:'published',publicUrl:'https://www.app-orma.com/trail.html?id=seceda',publicAssetUrl:'https://www.app-orma.com/images/trails/seceda.jpg',publicMutationCompleted:true}));
    expect(result.artifact.requests[1].status).toBe('awaiting-pr-merge');
  });

  test('deletes temporary upload data only after deployment is proven',async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'orma-trail-photo-confirm-'));await fs.mkdir(path.join(root,'data'),{recursive:true});
    await fs.writeFile(path.join(root,'data/trail-image-overrides.json'),JSON.stringify({trails:[{id:'seceda',approvedReviewId:'approval-1',fields:{imageIcon:'images/trails/seceda.jpg'}}]}));
    const requests={requests:[{id:'approval-1',trailId:'seceda',uploadRef:'backofficeImageUploads/upload-asset-1',status:'awaiting-pr-merge'}]};
    const deleted=[];const writes=[];const store={getArtifact:async()=>requests,deleteImageUpload:async ref=>deleted.push(ref),setArtifact:async(id,value)=>writes.push({id,value})};
    try{
      const result=await confirmTrailImages({root,store,env:{ORMA_PUBLICATION_COMMIT_SHA:'abc123',ORMA_PUBLICATION_DEPLOYMENT_URL:'https://github.com/orma/actions/runs/1',ORMA_PUBLICATION_PUBLIC_BASE_URL:'https://www.app-orma.com'},at:'2026-08-25T11:00:00Z'});
      expect(result.published).toBe(1);expect(deleted).toEqual(['backofficeImageUploads/upload-asset-1']);expect(writes[0].value.requests[0].status).toBe('published');
    }finally{await fs.rm(root,{recursive:true,force:true});}
  });

  test('copies an approved licensed photo into the repository instead of hot-linking it',async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'orma-licensed-photo-'));await fs.mkdir(path.join(root,'data'),{recursive:true});
    await fs.writeFile(path.join(root,'data/trail-image-overrides.json'),JSON.stringify({schemaVersion:1,updatedAt:null,trails:[]}));
    const url='https://upload.wikimedia.org/example/seceda.jpg';const artifact={requests:[{id:'licensed-1',trailId:'seceda',title:'Seceda Ridge Trail',assetRef:url,sourcePageUrl:'https://commons.wikimedia.org/wiki/File:Seceda.jpg',creator:'Example photographer',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',sourceType:'licensed-source',altText:'Seceda ridge',status:'approved-for-pr-creation'}]};
    const store={getArtifact:async()=>artifact,setArtifact:async()=>{}};
    const fetchImpl=async()=>({ok:true,headers:{get:()=>'image/jpeg'},arrayBuffer:async()=>Buffer.from('licensed-bytes')});
    try{
      const result=await materializeApprovedTrailImages({root,store,at:'2026-08-25T10:05:00Z',fetchImpl});
      expect(result.materialized).toBe(1);
      expect(result.assetRefs[0]).toMatch(/^images\/trails\/seceda-.*\.jpg$/);
      expect(await fs.readFile(path.join(root,result.assetRefs[0]),'utf8')).toBe('licensed-bytes');
      expect(result.overrides.trails[0].fields).toEqual(expect.objectContaining({imageIcon:result.assetRefs[0],
        imageLicence:'CC BY-SA 4.0',imageSourceType:'licensed-source',imageSourcePage:'https://commons.wikimedia.org/wiki/File:Seceda.jpg'}));
      expect(result.overrides.trails[0].fields.imageIcon).not.toBe(url);
    }finally{await fs.rm(root,{recursive:true,force:true});}
  });

  test('refuses a licensed rendition that is too large to commit',async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'orma-licensed-big-'));await fs.mkdir(path.join(root,'data'),{recursive:true});
    await fs.writeFile(path.join(root,'data/trail-image-overrides.json'),JSON.stringify({schemaVersion:1,updatedAt:null,trails:[]}));
    const artifact={requests:[{id:'licensed-2',trailId:'seceda',assetRef:'https://upload.wikimedia.org/huge.jpg',creator:'x',license:'CC BY 4.0',status:'approved-for-pr-creation'}]};
    const store={getArtifact:async()=>artifact,setArtifact:async()=>{}};
    const fetchImpl=async()=>({ok:true,headers:{get:()=>'image/jpeg'},arrayBuffer:async()=>Buffer.alloc(MAXIMUM_REMOTE_IMAGE_BYTES+1)});
    try{
      await expect(materializeApprovedTrailImages({root,store,fetchImpl})).rejects.toThrow(/choose a rendition under/);
    }finally{await fs.rm(root,{recursive:true,force:true});}
  });

  test('never replaces a photo a trail already has',async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'orma-photo-immutable-'));await fs.mkdir(path.join(root,'data'),{recursive:true});
    await fs.writeFile(path.join(root,'data/trail-image-overrides.json'),JSON.stringify({schemaVersion:1,updatedAt:'2026-09-01T00:00:00Z',
      trails:[{id:'seceda',approvedReviewId:'approval-1',fields:{imageIcon:'images/trails/seceda-first.jpg'}}]}));
    const artifact={requests:[{id:'approval-2',trailId:'seceda',assetRef:'images/tre-cime-hero.jpg',creator:'ORMA',status:'approved-for-pr-creation'}]};
    const writes=[];const store={getArtifact:async()=>artifact,setArtifact:async(id,value)=>writes.push({id,value})};
    try{
      const result=await materializeApprovedTrailImages({root,store,at:'2026-09-05T10:00:00Z'});
      const overrides=JSON.parse(await fs.readFile(path.join(root,'data/trail-image-overrides.json'),'utf8'));
      expect(overrides.trails).toHaveLength(1);
      expect(overrides.trails[0].fields.imageIcon).toBe('images/trails/seceda-first.jpg');
      expect(overrides.trails[0].approvedReviewId).toBe('approval-1');
      expect(writes[0].value.requests[0].status).toBe('superseded-by-published-photo');
      expect(result.assetRefs).toEqual([]);
    }finally{await fs.rm(root,{recursive:true,force:true});}
  });
});
