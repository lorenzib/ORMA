'use strict';

const fs=require('fs/promises');
const path=require('path');

const MIME_EXTENSIONS=Object.freeze({'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/avif':'.avif'});
// A licensed photo is copied into the repository rather than hot-linked: the remote
// host is not ORMA's to depend on, and a link that rots leaves a trail with no cover.
const MAXIMUM_REMOTE_IMAGE_BYTES=2*1024*1024;

async function downloadLicensedImage(url,{fetchImpl}={}){
  const request=fetchImpl||globalThis.fetch;
  if(typeof request!=='function')throw new Error('No fetch implementation is available to download a licensed trail image');
  if(!/^https:\/\//i.test(String(url||'')))throw new Error('A licensed trail image must be served over https');
  const response=await request(url,{redirect:'follow'});
  if(!response.ok)throw new Error(`Licensed trail image could not be downloaded (${response.status})`);
  const contentType=String(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  const extension=MIME_EXTENSIONS[contentType];
  if(!extension)throw new Error(`Unsupported licensed image type: ${contentType||'unknown'}`);
  const buffer=Buffer.from(await response.arrayBuffer());
  if(!buffer.length)throw new Error('The licensed trail image was empty');
  if(buffer.length>MAXIMUM_REMOTE_IMAGE_BYTES){
    throw new Error(`The licensed trail image is ${Math.round(buffer.length/1024)} KiB; choose a rendition under ${MAXIMUM_REMOTE_IMAGE_BYTES/1024} KiB`);
  }
  return {buffer,extension,contentType};
}

function safeSegment(value){return String(value||'').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100);}

// Photo overrides are kept in trail-id order rather than added at the end.
//
// Appending put every new entry on the same lines, so two batches prepared side
// by side collided on principle rather than on content: the photographs were
// for different trails and could not both be written without a hand merge.
// Ordering by id sends them to different parts of the file, and git merges them.
function orderedByTrailId(entries){
  return [...entries].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

async function materializeApprovedTrailImages({root,store,at=new Date().toISOString(),fetchImpl}){
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
    // A published trail photo is final. Re-approving a trail that already has one
    // would silently replace the picture readers have already seen, so the request
    // is retired instead of overwriting the existing entry.
    const existing=(overrides.trails||[]).find(item=>item.id===request.trailId&&item.fields?.imageIcon);
    if(existing&&existing.approvedReviewId!==request.id){
      const index=nextRequests.findIndex(item=>item.id===request.id);
      nextRequests[index]={...request,status:'superseded-by-published-photo',supersededAt:at,
        publicAssetRef:existing.fields.imageIcon,publicMutationAllowed:false};
      continue;
    }
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
    }else if(/^https:\/\//i.test(String(request.assetRef||''))){
      const {buffer,extension}=await downloadLicensedImage(request.assetRef,{fetchImpl});
      const suffix=safeSegment(request.id).slice(0,24)||'licensed';relativeRef=`images/trails/${trailId}-${suffix}${extension}`;
      await fs.writeFile(path.join(root,relativeRef),buffer);assetRefs.push(relativeRef);
    }else{
      relativeRef=String(request.assetRef||'');
      if(!relativeRef.startsWith('images/'))throw new Error(`Invalid approved trail image source: ${request.id}`);
    }
    const licence=request.license||(request.rightsBasis==='permission-granted'?'Used with permission':'ORMA-owned');
    const fields={
      imageIcon:relativeRef,heroImage:relativeRef,imageAlt:request.altText||`${request.title||trailId} trail`,
      imageCredit:`Photo by ${request.creator||'ORMA'}`,imageCreditText:`Photo by ${request.creator||'ORMA'}`,
      imageCreator:request.creator||'ORMA',imageLicence:licence,
      imageLicenceUrl:request.licenseUrl||null,imageSourcePage:request.sourcePageUrl||null,imageSourceType:request.sourceType||(request.uploadRef?'moderator-upload':'licensed-source'),
    };
    const entry={id:request.trailId,approvedReviewId:request.id,approvedAt:request.approvedAt||at,fields};
    overrides.trails=orderedByTrailId([...(overrides.trails||[]).filter(item=>item.id!==request.trailId),entry]);
    const index=nextRequests.findIndex(item=>item.id===request.id);
    nextRequests[index]={...request,status:'pr-materialized',materializedAt:at,publicAssetRef:relativeRef,publicMutationAllowed:false};
  }
  overrides.updatedAt=at;await fs.writeFile(target,`${JSON.stringify(overrides,null,2)}\n`,'utf8');
  const requests={...artifact,updatedAt:at,requests:nextRequests};
  await store.setArtifact('trail-image-publication-requests',requests,{lastMaterializedAt:at,publicMutationAllowed:false});
  return {materialized:approved.length,assetRefs,requests,overrides};
}

module.exports={orderedByTrailId,MIME_EXTENSIONS,MAXIMUM_REMOTE_IMAGE_BYTES,downloadLicensedImage,safeSegment,materializeApprovedTrailImages};
