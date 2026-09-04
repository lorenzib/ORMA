import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, getIdTokenResult, onAuthStateChanged,
  signInWithEmailAndPassword, signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, limit,
  orderBy, query, serverTimestamp, setDoc, Timestamp, where, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDnEJKnoDltKwpl4QdhA-qLH3a4ugLd68M",
  // Use Firebase's project-native auth domain for the hosted backoffice. The
  // custom public auth hostname is not the backoffice hosting origin and can
  // make browser sign-in initialization fail even when the page itself loads.
  authDomain: "dolopaws.firebaseapp.com",
  projectId: "dolopaws",
  messagingSenderId: "331415525455",
  appId: "1:331415525455:web:4a714eea0e95dc9a4ff23a",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;
let authResolved = false;

function friendlyError(code){
  const messages = {
    'auth/invalid-credential':'The email or password is incorrect.',
    'auth/invalid-email':'Enter a valid email address.',
    'auth/popup-closed-by-user':'The sign-in window was closed before completion.',
    'auth/popup-blocked':'Allow pop-ups for this site, then try again.',
    'auth/too-many-requests':'Sign-in is temporarily limited. Wait a moment and try again.',
  };
  return messages[code] || 'Sign-in could not be completed. Please try again.';
}

async function moderatorIdentity(){
  if(!currentUser)return null;
  try{
    const token=await getIdTokenResult(currentUser,true);
    return token.claims?.moderator===true?{uid:currentUser.uid}:null;
  }catch(error){return null;}
}

async function getArtifact(artifactId){
  if(!await moderatorIdentity())return {ok:false,error:'moderator-required',data:null};
  try{
    const snapshot=await getDoc(doc(db,'backofficeArtifacts',artifactId));
    if(!snapshot.exists())return {ok:false,error:'artifact-not-found',data:null};
    const artifact=snapshot.data();
    const data=artifact.dataEncoding==='json-v1'?JSON.parse(artifact.data):artifact.data;
    return {ok:true,data,updatedAt:artifact.updatedAt||null};
  }catch(error){console.error('getArtifact failed:',error);return {ok:false,error:'artifact-read-failed',data:null};}
}

async function getRevisionJobs(){
  if(!await moderatorIdentity())return {ok:false,error:'moderator-required',jobs:[]};
  try{
    const snapshot=await getDocs(query(collection(db,'backofficeJobs'),orderBy('createdAt','desc'),limit(100)));
    return {ok:true,jobs:snapshot.docs.map(item=>({id:item.id,...item.data()}))};
  }catch(error){console.error('getRevisionJobs failed:',error);return {ok:false,error:'job-read-failed',jobs:[]};}
}

async function getPublicationReviews(){
  if(!await moderatorIdentity())return {ok:false,error:'moderator-required',reviews:[]};
  try{
    const snapshot=await getDocs(query(collection(db,'backofficePublicationReviews'),orderBy('submittedAt','desc'),limit(100)));
    return {ok:true,reviews:snapshot.docs.map(item=>({id:item.id,...item.data()}))};
  }catch(error){console.error('getPublicationReviews failed:',error);return {ok:false,error:'publication-review-read-failed',reviews:[]};}
}

async function getContentReviews(){
  if(!await moderatorIdentity())return {ok:false,error:'moderator-required',reviews:[]};
  try{
    const snapshot=await getDocs(query(collection(db,'backofficeReviews'),orderBy('submittedAt','desc'),limit(100)));
    return {ok:true,reviews:snapshot.docs.map(item=>({id:item.id,...item.data()}))};
  }catch(error){console.error('getContentReviews failed:',error);return {ok:false,error:'content-review-read-failed',reviews:[]};}
}

async function getDecisionHistory(){
  if(!await moderatorIdentity())return {ok:false,error:'moderator-required',decisions:[]};
  try{
    const sources=[['backofficeDossierReviews','dossier'],['backofficeReviews','content'],['backofficePublicationReviews','publication'],['backofficeNewTrailReviews','new-trail'],['backofficeHazardReviews','hazard'],['backofficeEditorialReviews','editorial'],['backofficeImageReviews','image'],['backofficeNewsletterReviews','newsletter'],['backofficeAnalystReviews','analyst']];
    const snapshots=await Promise.all(sources.map(([name])=>getDocs(query(collection(db,name),orderBy('submittedAt','desc'),limit(20)))));
    const decisions=snapshots.flatMap((snapshot,index)=>snapshot.docs.map(item=>({id:item.id,stream:sources[index][1],...item.data()})))
      .sort((a,b)=>(b.submittedAt?.seconds||0)-(a.submittedAt?.seconds||0)).slice(0,30);
    return {ok:true,decisions};
  }catch(error){console.error('getDecisionHistory failed:',error);return {ok:false,error:'decision-history-read-failed',decisions:[]};}
}

async function getNewTrailReviews(){
  if(!await moderatorIdentity())return {ok:false,error:'moderator-required',reviews:[]};
  try{const snapshot=await getDocs(query(collection(db,'backofficeNewTrailReviews'),orderBy('submittedAt','desc'),limit(100)));return {ok:true,reviews:snapshot.docs.map(item=>({id:item.id,...item.data()}))};}
  catch(error){console.error('getNewTrailReviews failed:',error);return {ok:false,error:'new-trail-review-read-failed',reviews:[]};}
}

async function submitNewTrailReview(input){
  const moderator=await moderatorIdentity();if(!moderator)return {ok:false,error:'moderator-required'};
  try{const review=await addDoc(collection(db,'backofficeNewTrailReviews'),{contractVersion:'1.0.0',type:'new-trail-selection',status:'queued',candidateId:String(input.candidateId||''),action:String(input.action||''),note:String(input.note||'').trim().slice(0,1200),submittedAt:serverTimestamp(),submittedBy:moderator.uid,publicMutationAllowed:false});return {ok:true,reviewId:review.id,status:'queued'};}
  catch(error){console.error('submitNewTrailReview failed:',error);return {ok:false,error:'new-trail-review-submit-failed'};}
}

async function getHazardReviews(){
  if(!await moderatorIdentity())return {ok:false,error:'moderator-required',reviews:[]};
  try{const snapshot=await getDocs(query(collection(db,'backofficeHazardReviews'),orderBy('submittedAt','desc'),limit(100)));return {ok:true,reviews:snapshot.docs.map(item=>({id:item.id,...item.data()}))};}
  catch(error){console.error('getHazardReviews failed:',error);return {ok:false,error:'hazard-review-read-failed',reviews:[]};}
}

async function submitHazardReview(input){
  const moderator=await moderatorIdentity();if(!moderator)return {ok:false,error:'moderator-required'};
  try{const review=await addDoc(collection(db,'backofficeHazardReviews'),{contractVersion:'1.0.0',type:'hazard-resolution-review',status:'queued',hazardId:String(input.hazardId||''),action:String(input.action||''),note:String(input.note||'').trim().slice(0,1000),submittedAt:serverTimestamp(),submittedBy:moderator.uid,publicMutationAllowed:false});return {ok:true,reviewId:review.id,status:'queued'};}
  catch(error){console.error('submitHazardReview failed:',error);return {ok:false,error:'hazard-review-submit-failed'};}
}

async function submitTrailReview(payload){
  const moderator=await moderatorIdentity();
  if(!moderator)return {ok:false,error:'moderator-required'};
  if(payload?.gate!=='content-review'||!Array.isArray(payload.decisions)||!payload.decisions.length){
    return {ok:false,error:'decisions-required'};
  }
  try{
    const review=await addDoc(collection(db,'backofficeReviews'),{
      contractVersion:'1.0.0',type:'verified-trail-content-review',gate:'content-review',status:'queued',
      decisions:payload.decisions,submittedAt:serverTimestamp(),submittedBy:moderator.uid,publicMutationAllowed:false,
    });
    return {ok:true,reviewId:review.id,status:'queued'};
  }catch(error){console.error('submitTrailReview failed:',error);return {ok:false,error:'review-submit-failed'};}
}

async function getEditorialReviews(){
  if(!await moderatorIdentity())return {ok:false,error:'moderator-required',reviews:[]};
  try{const snapshot=await getDocs(query(collection(db,'backofficeEditorialReviews'),orderBy('submittedAt','desc'),limit(100)));return {ok:true,reviews:snapshot.docs.map(item=>({id:item.id,...item.data()}))};}
  catch(error){console.error('getEditorialReviews failed:',error);return {ok:false,error:'editorial-review-read-failed',reviews:[]};}
}

async function submitEditorialReview(input){
  const moderator=await moderatorIdentity();if(!moderator)return {ok:false,error:'moderator-required'};
  try{const review=await addDoc(collection(db,'backofficeEditorialReviews'),{contractVersion:'1.0.0',type:'website-editorial-review',status:'queued',packetGeneratedAt:String(input.packetGeneratedAt||''),sourceRef:String(input.sourceRef||''),action:String(input.action||''),note:String(input.note||'').trim().slice(0,1500),edits:Array.isArray(input.edits)?input.edits.slice(0,20):[],submittedAt:serverTimestamp(),submittedBy:moderator.uid,publicMutationAllowed:false});return {ok:true,reviewId:review.id,status:'queued'};}
  catch(error){console.error('submitEditorialReview failed:',error);return {ok:false,error:'editorial-review-submit-failed'};}
}

async function getImageReviews(){
  if(!await moderatorIdentity())return {ok:false,error:'moderator-required',reviews:[]};
  try{const snapshot=await getDocs(query(collection(db,'backofficeImageReviews'),orderBy('submittedAt','desc'),limit(500)));return {ok:true,reviews:snapshot.docs.map(item=>({id:item.id,...item.data()}))};}
  catch(error){console.error('getImageReviews failed:',error);return {ok:false,error:'image-review-read-failed',reviews:[]};}
}

async function submitImageReview(input){
  const moderator=await moderatorIdentity();if(!moderator)return {ok:false,error:'moderator-required'};
  try{const review=await addDoc(collection(db,'backofficeImageReviews'),{
    contractVersion:'2.1.0',type:'image-coverage-review',status:'queued',slug:String(input.slug||''),
    trailId:String(input.trailId||input.slug||''),action:String(input.action||''),
    note:String(input.note||'').trim().slice(0,1500),assetRef:String(input.assetRef||'').slice(0,1000),
    uploadRef:String(input.uploadRef||'').slice(0,1000),fileName:String(input.fileName||'').slice(0,240),
    mimeType:String(input.mimeType||'').slice(0,120),fileSize:Number(input.fileSize||0),
    width:Number(input.width||0),height:Number(input.height||0),creator:String(input.creator||'').trim().slice(0,160),
    rightsBasis:String(input.rightsBasis||'').slice(0,80),altText:String(input.altText||'').trim().slice(0,500),
    sourcePageUrl:String(input.sourcePageUrl||'').slice(0,1000),license:String(input.license||'').slice(0,160),
    licenseUrl:String(input.licenseUrl||'').slice(0,1000),sourceType:String(input.sourceType||'').slice(0,80),
    submittedAt:serverTimestamp(),submittedBy:moderator.uid,publicMutationAllowed:false,
  });return {ok:true,reviewId:review.id,status:'queued'};}
  catch(error){console.error('submitImageReview failed:',error);return {ok:false,error:'image-review-submit-failed'};}
}

function safeTrailId(value){return String(value||'').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100);}
function safeFileName(value){const cleaned=String(value||'trail-photo.jpg').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'');return cleaned.slice(-180)||'trail-photo.jpg';}
function fileDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('Could not prepare this photo.'));reader.readAsDataURL(file);});}

async function uploadTrailImage(input){
  const moderator=await moderatorIdentity();if(!moderator)return {ok:false,error:'moderator-required'};
  const file=input?.file;const trailId=safeTrailId(input?.trailId);
  if(!trailId||!file)return {ok:false,error:'trail-and-file-required'};
  if(!/^image\/(?:jpeg|png|webp)$/i.test(file.type||''))return {ok:false,error:'unsupported-image-type'};
  if(file.size<=0||file.size>560*1024)return {ok:false,error:'image-size-invalid'};
  if(input.rightsBasis!=='orma-owned'&&input.rightsBasis!=='permission-granted')return {ok:false,error:'image-rights-required'};
  const uploadDocument=doc(collection(db,'backofficeImageUploads'));const uploadRef=`backofficeImageUploads/${uploadDocument.id}`;
  try{
    const uploadData=await fileDataUrl(file);
    await setDoc(uploadDocument,{contractVersion:'1.0.0',type:'trail-image-upload',trailId,fileName:safeFileName(file.name),mimeType:file.type,
      fileSize:file.size,width:Number(input.width||0),height:Number(input.height||0),uploadData,uploadedAt:serverTimestamp(),
      uploadedBy:moderator.uid,publicMutationAllowed:false});
    const review=await submitImageReview({...input,slug:trailId,trailId,action:'upload-owner-photo',assetRef:uploadRef,uploadRef,
      fileName:file.name,mimeType:file.type,fileSize:file.size});
    if(!review.ok){await deleteDoc(uploadDocument).catch(()=>{});return review;}
    return {...review,uploadRef};
  }catch(error){console.error('uploadTrailImage failed:',error);return {ok:false,error:error.code||'trail-image-upload-failed'};}
}

async function getTrailImagePreview(uploadRef){
  if(!await moderatorIdentity())return {ok:false,error:'moderator-required'};
  const path=String(uploadRef||'');const match=path.match(/^backofficeImageUploads\/([A-Za-z0-9_-]+)$/);
  if(!match)return {ok:false,error:'invalid-upload-reference'};
  try{
    const snapshot=await getDoc(doc(db,'backofficeImageUploads',match[1]));if(!snapshot.exists())return {ok:false,error:'upload-not-found'};
    const data=snapshot.data();if(!String(data.uploadData||'').startsWith('data:image/'))return {ok:false,error:'invalid-upload-data'};
    return {ok:true,url:data.uploadData};
  }
  catch(error){return {ok:false,error:error.code||'trail-image-preview-failed'};}
}

async function getNewsletterReviews(){
  if(!await moderatorIdentity())return {ok:false,error:'moderator-required',reviews:[]};
  try{const snapshot=await getDocs(query(collection(db,'backofficeNewsletterReviews'),orderBy('submittedAt','desc'),limit(100)));return {ok:true,reviews:snapshot.docs.map(item=>({id:item.id,...item.data()}))};}
  catch(error){console.error('getNewsletterReviews failed:',error);return {ok:false,error:'newsletter-review-read-failed',reviews:[]};}
}

async function submitNewsletterReview(input){
  const moderator=await moderatorIdentity();if(!moderator)return {ok:false,error:'moderator-required'};
  try{const review=await addDoc(collection(db,'backofficeNewsletterReviews'),{contractVersion:'1.0.0',type:'newsletter-issue-review',status:'queued',packetGeneratedAt:String(input.packetGeneratedAt||''),action:String(input.action||''),note:String(input.note||'').trim().slice(0,1500),submittedAt:serverTimestamp(),submittedBy:moderator.uid,publicMutationAllowed:false});return {ok:true,reviewId:review.id,status:'queued'};}
  catch(error){console.error('submitNewsletterReview failed:',error);return {ok:false,error:'newsletter-review-submit-failed'};}
}

async function getAnalystReviews(){
  if(!await moderatorIdentity())return {ok:false,error:'moderator-required',reviews:[]};
  try{const snapshot=await getDocs(query(collection(db,'backofficeAnalystReviews'),orderBy('submittedAt','desc'),limit(150)));return {ok:true,reviews:snapshot.docs.map(item=>({id:item.id,...item.data()}))};}
  catch(error){console.error('getAnalystReviews failed:',error);return {ok:false,error:'analyst-review-read-failed',reviews:[]};}
}

async function submitAnalystReview(input){
  const moderator=await moderatorIdentity();if(!moderator)return {ok:false,error:'moderator-required'};
  try{const review=await addDoc(collection(db,'backofficeAnalystReviews'),{contractVersion:'1.0.0',type:'analyst-opportunity-review',status:'queued',subjectType:String(input.subjectType||'idea'),ideaId:String(input.ideaId||''),action:String(input.action||''),note:String(input.note||'').trim().slice(0,1500),submittedAt:serverTimestamp(),submittedBy:moderator.uid,publicMutationAllowed:false,implementationAuthorized:false});return {ok:true,reviewId:review.id,status:'queued'};}
  catch(error){console.error('submitAnalystReview failed:',error);return {ok:false,error:'analyst-review-submit-failed'};}
}

async function submitPublicationReview(input){
  const moderator=await moderatorIdentity();
  if(!moderator)return {ok:false,error:'moderator-required'};
  try{
    const review=await addDoc(collection(db,'backofficePublicationReviews'),{
      contractVersion:'1.0.0',type:'verified-trail-publication-review',status:'queued',
      candidateId:String(input.candidateId||''),action:String(input.action||''),
      note:String(input.note||'').trim().slice(0,1500),submittedAt:serverTimestamp(),
      submittedBy:moderator.uid,publicMutationAllowed:false,
    });
    return {ok:true,reviewId:review.id,status:'queued'};
  }catch(error){console.error('submitPublicationReview failed:',error);return {ok:false,error:'publication-review-submit-failed'};}
}

async function submitDossierReview(input){
  const moderator=await moderatorIdentity();
  if(!moderator)return {ok:false,error:'moderator-required'};
  try{
    const review=await addDoc(collection(db,'backofficeDossierReviews'),{
      contractVersion:'1.0.0',type:'trail-dossier-review',status:'queued',
      reviewId:String(input.reviewId||''),candidateId:String(input.candidateId||''),
      action:String(input.action||''),targetAgent:String(input.targetAgent||''),
      note:String(input.note||'').trim().slice(0,1500),submittedAt:serverTimestamp(),
      submittedBy:moderator.uid,publicMutationAllowed:false,
    });
    return {ok:true,reviewId:review.id,status:'queued'};
  }catch(error){console.error('submitDossierReview failed:',error);return {ok:false,error:'dossier-review-submit-failed'};}
}

const MODERATION_COLLECTIONS={flag:'flags',review:'reviews',photo:'trailPhotos',placeDog:'placeDogReports'};

function moderationItem(type,snapshot,reportReasons=[],reportIds=[]){
  const data=snapshot.data();
  return {type,id:snapshot.id,trailId:data.trailId||null,targetId:data.placeId||data.trailId||snapshot.id,authorUid:data.uid,status:data.status,createdAt:data.createdAt,
    content:{type:data.type||null,km:typeof data.km==='number'?data.km:null,rating:typeof data.rating==='number'?data.rating:null,
      text:data.text||null,hikedOn:data.hikedOn||null,image:data.image||null,caption:data.caption||null,
      placeName:data.placeName||null,placeType:data.placeType||null,policy:data.policy||null,evidence:data.evidence||null,note:data.note||null,
      confirmationSource:data.confirmationSource||null,confirmations:Number(data.confirmations)||0,disputes:Number(data.disputes)||0,
      expiresAt:data.expiresAt||null,lifecyclePresent:data.confirmationSource!=null&&data.confirmations!=null&&data.disputes!=null&&data.expiresAt!=null},
    reportReasons,reportIds};
}

async function getModerationQueue(){
  if(!await moderatorIdentity())return {ok:false,error:'moderator-required',items:[]};
  try{
    const types=Object.keys(MODERATION_COLLECTIONS);
    const [contentResults,reportResult]=await Promise.all([
      Promise.all(types.map(async type=>{
        const queueStates=type==='flag'?['pending','visible','reported','hidden','removed']:['pending','reported','hidden','removed'];
        const snapshot=await getDocs(query(collection(db,MODERATION_COLLECTIONS[type]),where('status','in',queueStates)));
        return snapshot.docs.map(item=>moderationItem(type,item)).filter(item=>type!=='flag'||item.status!=='visible'||
          !item.content.lifecyclePresent||!item.content.expiresAt||item.content.expiresAt.toMillis()<=Date.now());
      })),
      getDocs(query(collection(db,'reports'),where('status','==','open'))),
    ]);
    const openReports=reportResult.docs.map(item=>({id:item.id,...item.data()}));
    const byTarget=new Map();
    openReports.forEach(report=>{
      const key=`${report.targetType}:${report.targetId}`;
      const group=byTarget.get(key)||{reasons:[],ids:[]};
      group.reasons.push({text:String(report.reason||'').slice(0,200),createdAt:report.createdAt||null});
      group.ids.push(report.id);byTarget.set(key,group);
    });
    const items=contentResults.flat();const existing=new Set(items.map(item=>`${item.type}:${item.id}`));
    for(const [key,reports] of byTarget){
      const separator=key.indexOf(':');const type=key.slice(0,separator);const id=key.slice(separator+1);
      if(existing.has(key)||!MODERATION_COLLECTIONS[type])continue;
      const target=await getDoc(doc(db,MODERATION_COLLECTIONS[type],id));
      if(target.exists())items.push(moderationItem(type,target,reports.reasons,reports.ids));
    }
    items.forEach(item=>{const reports=byTarget.get(`${item.type}:${item.id}`);if(reports){item.reportReasons=reports.reasons;item.reportIds=reports.ids;}});
    items.sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0));
    return {ok:true,items};
  }catch(error){console.error('getModerationQueue failed:',error);return {ok:false,error:'queue-unavailable',items:[]};}
}

async function moderateContent(item,toStatus,reason,options={}){
  const moderator=await moderatorIdentity();
  if(!moderator||!item||!MODERATION_COLLECTIONS[item.type])return {ok:false,error:'moderator-required'};
  const allowed={pending:['visible','hidden','removed'],visible:['visible','hidden','removed'],reported:['visible','hidden','removed'],hidden:['visible','removed'],removed:['visible']};
  if(!allowed[item.status]||!allowed[item.status].includes(toStatus))return {ok:false,error:'invalid-transition'};
  try{
    const batch=writeBatch(db);
    const confirmationSource=item.type==='flag'&&['community','dolopaws-reviewed','official'].includes(options.confirmationSource)?options.confirmationSource:null;
    const needsLifecycle=item.type==='flag'&&!item.content.lifecyclePresent;
    if(item.status!==toStatus||confirmationSource||needsLifecycle){
      const update={status:toStatus,moderatedAt:serverTimestamp(),moderatedBy:moderator.uid};
      if(item.type==='flag'&&(confirmationSource||needsLifecycle)){
        const expiry=window.DoloPawsCommunityStates?.hazardExpiryDate
          ?window.DoloPawsCommunityStates.hazardExpiryDate(item.content.type)
          :new Date(Date.now()+30*24*3600*1000);
        update.confirmationSource=confirmationSource||'community';
        if(needsLifecycle){update.confirmations=0;update.disputes=0;}
        if(update.confirmationSource!=='community'){update.confirmedAt=serverTimestamp();update.confirmedBy=moderator.uid;}
        update.expiresAt=Timestamp.fromDate(expiry);
      }
      batch.update(doc(db,MODERATION_COLLECTIONS[item.type],item.id),update);
    }
    const auditRef=doc(collection(db,'moderationAudit'));
    const audit={contentType:item.type,contentId:item.id,targetId:item.targetId,authorUid:item.authorUid,fromStatus:item.status,toStatus,
      moderatorUid:moderator.uid,reason:String(reason||'').slice(0,300),createdAt:serverTimestamp()};
    if(item.trailId)audit.trailId=item.trailId;
    batch.set(auditRef,audit);
    for(const reportId of item.reportIds||[])batch.update(doc(db,'reports',reportId),{status:toStatus==='visible'?'dismissed':'actioned',resolvedAt:serverTimestamp(),resolvedBy:moderator.uid});
    await batch.commit();return {ok:true,auditId:auditRef.id};
  }catch(error){console.error('moderateContent failed:',error);return {ok:false,error:'decision-failed'};}
}

async function getSiteNotices(){
  if(!await moderatorIdentity())return {ok:false,error:'moderator-required',notices:[]};
  try{const snapshot=await getDocs(query(collection(db,'siteNotices'),orderBy('createdAt','desc'),limit(10)));return {ok:true,notices:snapshot.docs.map(item=>({id:item.id,...item.data()}))};}
  catch(error){console.error('getSiteNotices failed:',error);return {ok:false,error:'notice-read-failed',notices:[]};}
}

async function addSiteNotice(notice){
  if(!await moderatorIdentity())return {ok:false,error:'moderator-required'};
  try{const ref=await addDoc(collection(db,'siteNotices'),{title:String(notice.title||'').slice(0,80),body:String(notice.body||'').slice(0,280),
    href:notice.href?String(notice.href).slice(0,200):null,type:['news','trail','safety'].includes(notice.type)?notice.type:'news',createdAt:serverTimestamp(),
    expiresAt:Number.isFinite(notice.expiresDays)?Timestamp.fromMillis(Date.now()+notice.expiresDays*864e5):null});return {ok:true,id:ref.id};}
  catch(error){console.error('addSiteNotice failed:',error);return {ok:false,error:'notice-create-failed'};}
}

async function deleteSiteNotice(noticeId){
  if(!await moderatorIdentity())return {ok:false,error:'moderator-required'};
  try{await deleteDoc(doc(db,'siteNotices',String(noticeId)));return {ok:true};}
  catch(error){console.error('deleteSiteNotice failed:',error);return {ok:false,error:'notice-delete-failed'};}
}

window.DoloPawsAuth={
  get currentUser(){return currentUser;},
  get authResolved(){return authResolved;},
  async signIn(email,password){
    try{const result=await signInWithEmailAndPassword(auth,email,password);currentUser=result.user;return {ok:true};}
    catch(error){return {ok:false,code:error.code||'auth/unknown',message:friendlyError(error.code)};}
  },
  async logOut(){await signOut(auth);currentUser=null;},
};
window.DoloPawsModeration={getModeratorStatus:async()=>({ok:!!await moderatorIdentity()}),getQueue:getModerationQueue,decide:moderateContent,getSiteNotices,addSiteNotice,deleteSiteNotice};
window.ORMABackoffice={getArtifact,getRevisionJobs,getPublicationReviews,getContentReviews,getDecisionHistory,getNewTrailReviews,getHazardReviews,getEditorialReviews,getImageReviews,getNewsletterReviews,getAnalystReviews,getModerationQueue,moderateContent,submitTrailReview,submitPublicationReview,submitDossierReview,submitNewTrailReview,submitHazardReview,submitEditorialReview,submitImageReview,uploadTrailImage,getTrailImagePreview,submitNewsletterReview,submitAnalystReview};

onAuthStateChanged(auth,user=>{
  currentUser=user;
  if(!authResolved){
    authResolved=true;
    window.DoloPawsAuthReady=true;
    window.dispatchEvent(new CustomEvent('dolopaws-auth-ready'));
  }
});
