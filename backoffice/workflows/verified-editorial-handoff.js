'use strict';

const {createAgentJob}=require('../contracts/agent-job-v1');
const {LOCKED_FACT_FIELDS}=require('./plan-verified-trail-editorial');

function assertVerifiedDossier(dossier){
  if(!dossier||dossier.reviewState!=='accepted'||dossier.ormaVerification?.status!=='verified'){
    throw new Error('Only a human-approved ORMA Verified dossier can enter editorial handoff');
  }
  const unsupported=(dossier.claims||[]).filter(claim=>claim.state!=='supported');
  if(unsupported.length)throw new Error(`Verified editorial handoff found unsupported claims: ${unsupported.map(claim=>claim.id).join(', ')}`);
  const ids=new Set((dossier.claims||[]).map(claim=>claim.id));
  const required=['logistics-recommended-start','logistics-route-number-status','logistics-route-number-sequence','logistics-route-number-switches'];
  const missing=required.filter(id=>!ids.has(id));
  if(missing.length)throw new Error(`Verified editorial handoff requires route guidance: ${missing.join(', ')}`);
}

function editorialItem(dossier,record,at){
  assertVerifiedDossier(dossier);
  const requiredStartFact=(dossier.claims||[]).find(claim=>claim.id==='logistics-recommended-start');
  return {
    candidateId:dossier.candidateId,trailName:dossier.trailName,targetTrailId:dossier.trailId,
    dossierRef:`trail-dossier-desk.html#verified-${dossier.candidateId}`,
    dossierArtifactRef:`firestore:verified-dossier-${dossier.candidateId}`,
    verifiedAt:record?.verifiedAt||dossier.ormaVerification.verifiedAt,
    verificationConditions:record?.conditions||dossier.ormaVerification.conditions||[],
    lockedFacts:(dossier.claims||[]).map(claim=>({id:claim.id,label:claim.label,value:claim.proposedValue,sourceIds:claim.sourceIds||[]})),
    evidenceSources:dossier.sources||[],routeGeometry:dossier.routeGeometry||null,
    editorialBrief:{objective:'Produce concise premium ORMA trail copy using only the locked dossier facts.',
      requiredSections:['About the trail','Why it suits dogs','Important practical notes'],
      routeNarrativeRule:'For a numbered route, begin at the locked authoritative recommended starting point and describe the trail in the approved geometry order.',
      requiredStartFactId:requiredStartFact?.id||null,
      prohibited:['invent facts','soften safety caveats','change metrics','claim current operating conditions']},
    visualBrief:{objective:'Find a genuinely reusable trail image or return an explicit owned-photo checklist.',
      requiredChecks:['direct preview','source page','creator','licence','licence URL','credit','location-safe alt text'],
      prohibited:['infer trail conditions from a photograph','mark an incompletely licensed asset ready']},
    humanGates:[
      {id:'editorial-approval',status:'pending',checks:['copy matches locked facts','mandatory caveats remain prominent','tone matches ORMA']},
      {id:'asset-and-licensing-approval',status:'pending',checks:['preview and source verified','creator, credit and licence verified','alt text approved','image is not condition evidence']},
      {id:'publication-approval',status:'locked',checks:['copy and asset gates approved','website field mapping reviewed','explicit separate publish decision recorded']},
    ],
    queuedAt:at,publicMutationAllowed:false,publicationAuthorized:false,
  };
}

function editorialJobs(item,at){
  return ['copywriter','visualDirector'].map(agentId=>{
    const suffix=agentId==='copywriter'?'copy':'visual';
    const jobId=`verified-${item.candidateId}-${suffix}`;const verificationKey=String(item.verifiedAt||at).replace(/[:.]/g,'-');
    const job=createAgentJob({id:`trail-first-pass-${jobId}-${verificationKey}`,agentId,
      action:agentId==='copywriter'?'draft-verified-trail-copy':'prepare-verified-trail-assets',
      candidateId:item.candidateId,inputRefs:[item.dossierArtifactRef],
      humanGate:agentId==='copywriter'?'editorial-approval':'asset-and-licensing-approval',
      requestedBy:'orma-verified-handoff-v1'},{at});
    return {...job,jobId,verificationKey,jobType:'verified-trail-editorial-first-pass',publicMutationAllowed:false};
  });
}

function buildVerifiedEditorialHandoff(dossier,record,existingQueue,options={}){
  const at=options.at||new Date().toISOString();const item=editorialItem(dossier,record,at);const jobs=editorialJobs(item,at);
  const items=[...(existingQueue?.items||[]).filter(candidate=>candidate.candidateId!==item.candidateId),item];
  const knownJobs=new Map((existingQueue?.jobs||[]).map(job=>[job.id,job]));for(const job of jobs)knownJobs.set(job.id,job);
  const queue={contractVersion:'1.0.0',generatedAt:at,mode:'draft-only',stage:'verified-trail-editorial-readiness',
    sourceRegistry:'firestore:orma-verified-registry-live',publicMutationAllowed:false,publicationAuthorized:false,
    lockedFactFields:LOCKED_FACT_FIELDS,items,jobs:[...knownJobs.values()],summary:{verifiedTrails:items.length,
      copywriterJobs:items.length,visualDirectorJobs:items.length,humanGatesPending:items.length*2,publicationGatesLocked:items.length}};
  return {item,jobs,queue};
}

module.exports={assertVerifiedDossier,editorialItem,editorialJobs,buildVerifiedEditorialHandoff};
