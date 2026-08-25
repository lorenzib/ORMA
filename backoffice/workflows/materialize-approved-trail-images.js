'use strict';

const fs=require('fs/promises');
const path=require('path');

const MIME_EXTENSIONS=Object.freeze({'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/avif':'.avif'});

function safeSegment(value){return String(value||'').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100);}

async function materializeApprovedTrailImages({root,store,bucket,at=new Date().toISOString()}){
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
    if(request.storagePath){
      if(!String(request.storagePath).startsWith('backoffice/trail-images/'))throw new Error(`Invalid trail image storage path: ${request.id}`);
      const object=bucket.file(request.storagePath);const [metadata]=await object.getMetadata();
      const contentType=String(metadata.contentType||request.mimeType||'');const extension=MIME_EXTENSIONS[contentType];
      if(!extension)throw new Error(`Unsupported uploaded image type for ${trailId}: ${contentType||'unknown'}`);
      const size=Number(metadata.size||request.fileSize||0);if(!size||size>15*1024*1024)throw new Error(`Uploaded image size is invalid for ${trailId}`);
      const suffix=safeSegment(request.id).slice(0,24)||'approved';relativeRef=`images/trails/${trailId}-${suffix}${extension}`;
      const [buffer]=await object.download();await fs.writeFile(path.join(root,relativeRef),buffer);assetRefs.push(relativeRef);
    }else{
      relativeRef=String(request.assetRef||'');
      if(!/^(?:images\/|https:\/\/)/i.test(relativeRef))throw new Error(`Invalid approved trail image source: ${request.id}`);
    }
    const licence=request.license||(request.rightsBasis==='permission-granted'?'Used with permission':'ORMA-owned');
    const fields={
      imageIcon:relativeRef,heroImage:relativeRef,imageAlt:request.altText||`${request.title||trailId} trail`,
      imageCredit:`Photo by ${request.creator||'ORMA'}`,imageCreditText:`Photo by ${request.creator||'ORMA'}`,
      imageCreator:request.creator||'ORMA',imageLicence:licence,
      imageLicenceUrl:request.licenseUrl||null,imageSourcePage:request.sourcePageUrl||null,imageSourceType:request.sourceType||(request.storagePath?'moderator-upload':'licensed-source'),
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
