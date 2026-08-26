'use strict';

const fs=require('fs/promises');
const path=require('path');

const MIME_EXTENSIONS=Object.freeze({'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/avif':'.avif'});

function safeSegment(value){return String(value||'').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100);}

async function materializeApprovedTrailImages({root,store,at=new Date().toISOString()}){
  const artifact=await store.getArtifact('trail-image-publication-requests')||{contractVersion:'1.0.0',requests:[]};
  const approved=(artifact.requests||[]).filter(request=>['approved-for-pr-creation','pr-materialized'].includes(request.status));
  if(!approved.length)return {materialized:0,assetRefs:[],requests:artifact};
  const target=path.join(root,'data','trail-image-overrides.json');
  let overrides;
  try{overrides=JSON.parse(await fs.readFile(target,'utf8'));}
  catch(error){if(error.code!=='ENOENT')throw error;overrides={schemaVersion:1,updatedAt:null,trails:[]};}
  const nextRequests=[...(artifact.requests||[])];const assetRefs=[];
  await fs.mkdir(path.join(root,'images','trails'),{recursive:true});
  for(const request of approved){
    const trailId=safeSegment(request.trailId);if(!trailId)throw new Error(`Invalid trail id for image request: ${request.id}`);
    let relativeRef;
    if(request.uploadRef){
      if(!/^backofficeImageUploads\/[A-Za-z0-9_-]+$/.test(String(request.uploadRef)))throw new Error(`Invalid temporary trail image reference: ${request.id}`);
      if(typeof store.getImageUpload!=='function')throw new Error('The backoffice store cannot read temporary trail images');
      const upload=await store.getImageUpload(request.uploadRef);if(!upload)throw new Error(`Temporary trail image was not found: ${request.id}`);
      const match=String(upload.uploadData||'').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
      if(!match)throw new Error(`Temporary trail image data is invalid: ${request.id}`);
      const contentType=String(upload.mimeType||request.mimeType||match[1]);const extension=MIME_EXTENSIONS[contentType];
      if(!extension)throw new Error(`Unsupported uploaded image type for ${trailId}: ${contentType||'unknown'}`);
      if(match[1]!==contentType)throw new Error(`Temporary trail image type does not match for ${trailId}`);
      const buffer=Buffer.from(match[2],'base64');const size=Number(upload.fileSize||request.fileSize||buffer.length);
      if(!size||size>560*1024||buffer.length!==size)throw new Error(`Temporary trail image size is invalid for ${trailId}`);
      const suffix=safeSegment(request.id).slice(0,24)||'approved';relativeRef=`images/trails/${trailId}-${suffix}${extension}`;
      await fs.writeFile(path.join(root,relativeRef),buffer);assetRefs.push(relativeRef);
    }else{
      relativeRef=String(request.assetRef||'');
      if(!/^(?:images\/|https:\/\/)/i.test(relativeRef))throw new Error(`Invalid approved trail image source: ${request.id}`);
    }
    const licence=request.license||(request.rightsBasis==='permission-granted'?'Used with permission':'ORMA-owned');
    const fields={
      imageIcon:relativeRef,heroImage:relativeRef,imageAlt:request.altText||`${request.title||trailId} trail`,
      imageCredit:`Photo by ${request.creator||'ORMA'}`,imageCreditText:`Photo by ${request.creator||'ORMA'}`,
      imageCreator:request.creator||'ORMA',imageLicence:licence,
      imageLicenceUrl:request.licenseUrl||null,imageSourcePage:request.sourcePageUrl||null,imageSourceType:request.sourceType||(request.uploadRef?'moderator-upload':'licensed-source'),
    };
    const entry={id:request.trailId,approvedReviewId:request.id,approvedAt:request.approvedAt||at,fields};
    overrides.trails=[...(overrides.trails||[]).filter(item=>item.id!==request.trailId),entry];
    const index=nextRequests.findIndex(item=>item.id===request.id);
    nextRequests[index]={...request,status:'pr-materialized',materializedAt:at,publicAssetRef:relativeRef,publicMutationAllowed:false};
  }
  overrides.updatedAt=at;await fs.writeFile(target,`${JSON.stringify(overrides,null,2)}\n`,'utf8');
  const requests={...artifact,updatedAt:at,requests:nextRequests};
  await store.setArtifact('trail-image-publication-requests',requests,{lastMaterializedAt:at,publicMutationAllowed:false});
  return {materialized:approved.length,assetRefs,requests,overrides};
}

module.exports={MIME_EXTENSIONS,safeSegment,materializeApprovedTrailImages};
