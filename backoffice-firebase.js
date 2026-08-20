const firebaseConfig = {
  apiKey: "AIzaSyDnEJKnoDltKwpl4QdhA-qLH3a4ugLd68M",
  authDomain: "auth.app-orma.com",
  projectId: "dolopaws",
  storageBucket: "dolopaws.firebasestorage.app",
  messagingSenderId: "331415525455",
  appId: "1:331415525455:web:4a714eea0e95dc9a4ff23a",
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, getIdTokenResult, onAuthStateChanged,
  signInWithEmailAndPassword, signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  addDoc, collection, doc, getDoc, getDocs, getFirestore, limit,
  orderBy, query, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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
  try{const snapshot=await getDocs(query(collection(db,'backofficeImageReviews'),orderBy('submittedAt','desc'),limit(150)));return {ok:true,reviews:snapshot.docs.map(item=>({id:item.id,...item.data()}))};}
  catch(error){console.error('getImageReviews failed:',error);return {ok:false,error:'image-review-read-failed',reviews:[]};}
}

async function submitImageReview(input){
  const moderator=await moderatorIdentity();if(!moderator)return {ok:false,error:'moderator-required'};
  try{const review=await addDoc(collection(db,'backofficeImageReviews'),{contractVersion:'1.0.0',type:'image-coverage-review',status:'queued',slug:String(input.slug||''),action:String(input.action||''),note:String(input.note||'').trim().slice(0,1500),assetRef:String(input.assetRef||'').slice(0,1000),submittedAt:serverTimestamp(),submittedBy:moderator.uid,publicMutationAllowed:false});return {ok:true,reviewId:review.id,status:'queued'};}
  catch(error){console.error('submitImageReview failed:',error);return {ok:false,error:'image-review-submit-failed'};}
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

window.DoloPawsAuth={
  get currentUser(){return currentUser;},
  get authResolved(){return authResolved;},
  async signIn(email,password){
    try{const result=await signInWithEmailAndPassword(auth,email,password);currentUser=result.user;return {ok:true};}
    catch(error){return {ok:false,code:error.code||'auth/unknown',message:friendlyError(error.code)};}
  },
  async logOut(){await signOut(auth);currentUser=null;},
};
window.DoloPawsModeration={getModeratorStatus:async()=>({ok:!!await moderatorIdentity()})};
window.ORMABackoffice={getArtifact,getRevisionJobs,getPublicationReviews,getContentReviews,getDecisionHistory,getNewTrailReviews,getHazardReviews,getEditorialReviews,getImageReviews,getNewsletterReviews,getAnalystReviews,submitTrailReview,submitPublicationReview,submitDossierReview,submitNewTrailReview,submitHazardReview,submitEditorialReview,submitImageReview,submitNewsletterReview,submitAnalystReview};

onAuthStateChanged(auth,user=>{
  currentUser=user;
  if(!authResolved){
    authResolved=true;
    window.DoloPawsAuthReady=true;
    window.dispatchEvent(new CustomEvent('dolopaws-auth-ready'));
  }
});
