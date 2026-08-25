'use strict';

const fs=require('fs/promises');
const os=require('os');
const path=require('path');
const {materializeApprovedTrailImages}=require('./workflows/materialize-approved-trail-images');
const {recordTrailImageDeployment}=require('./workflows/trail-image-deployment-receipts');

describe('human-approved trail-photo publishing',()=>{
  test('materializes only an approved protected upload into an image override',async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'orma-trail-photo-'));await fs.mkdir(path.join(root,'data'),{recursive:true});
    await fs.writeFile(path.join(root,'data/trail-image-overrides.json'),JSON.stringify({schemaVersion:1,updatedAt:null,trails:[]}));
    const artifact={contractVersion:'1.0.0',requests:[{id:'approval-1',trailId:'seceda',title:'Seceda Ridge Trail',storagePath:'backoffice/trail-images/seceda/photo.jpg',fileName:'photo.jpg',mimeType:'image/jpeg',fileSize:4,width:1200,height:800,creator:'Benedetta Lorenzi',rightsBasis:'orma-owned',altText:'A dog on Seceda ridge',status:'approved-for-pr-creation',approvedAt:'2026-08-25T10:00:00Z'}]};
    const writes=[];const store={getArtifact:async()=>artifact,setArtifact:async(id,value)=>writes.push({id,value})};
    const bucket={file:storagePath=>({getMetadata:async()=>[{contentType:'image/jpeg',size:'4',name:storagePath}],download:async()=>[Buffer.from('photo')]})};
    try{
      const result=await materializeApprovedTrailImages({root,store,bucket,at:'2026-08-25T10:05:00Z'});
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

  test('materializes an approved licensed URL without copying a private upload',async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'orma-licensed-photo-'));await fs.mkdir(path.join(root,'data'),{recursive:true});
    await fs.writeFile(path.join(root,'data/trail-image-overrides.json'),JSON.stringify({schemaVersion:1,updatedAt:null,trails:[]}));
    const url='https://upload.wikimedia.org/example/seceda.jpg';const artifact={requests:[{id:'licensed-1',trailId:'seceda',title:'Seceda Ridge Trail',assetRef:url,sourcePageUrl:'https://commons.wikimedia.org/wiki/File:Seceda.jpg',creator:'Example photographer',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',sourceType:'licensed-source',altText:'Seceda ridge',status:'approved-for-pr-creation'}]};
    const store={getArtifact:async()=>artifact,setArtifact:async()=>{}};
    try{const result=await materializeApprovedTrailImages({root,store,bucket:null,at:'2026-08-25T10:05:00Z'});expect(result.materialized).toBe(1);expect(result.overrides.trails[0].fields).toEqual(expect.objectContaining({imageIcon:url,imageLicence:'CC BY-SA 4.0',imageSourceType:'licensed-source'}));}
    finally{await fs.rm(root,{recursive:true,force:true});}
  });
});
