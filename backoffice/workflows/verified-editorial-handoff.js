'use strict';

const {createAgentJob}=require('../contracts/agent-job-v1');
const {LOCKED_FACT_FIELDS}=require('./plan-verified-trail-editorial');
const {VERIFICATION_ROUTE_CLAIMS,routeGuidanceByClaim}=require('./compile-verified-dossier');

function assertVerifiedDossier(dossier){
  if(!dossier||dossier.reviewState!=='accepted'||dossier.ormaVerification?.status!=='verified'){
    throw new Error('Only an accepted ORMA Verified dossier can enter editorial handoff');
  }
  const unsupported=(dossier.claims||[]).filter(claim=>claim.state!=='supported');
  if(unsupported.length)throw new Error(`Verified editorial handoff found unsupported claims: ${unsupported.map(claim=>claim.id).join(', ')}`);
  // Keyed on the claim, not on the agent that answered it. A walk whose
  // directions came from the map or from ORMA's own record records them under
  // that rung -- `map-route-number-sequence`, `orma-recommended-start` -- and
  // this check, which only ever looked for `logistics-<claim>`, read such a
  // walk as having no directions at all and refused to hand it over.
  const recorded=routeGuidanceByClaim(dossier.claims);
  const missing=VERIFICATION_ROUTE_CLAIMS.filter(id=>!recorded.has(id));
  if(missing.length)throw new Error(`Verified editorial handoff requires route guidance: ${missing.join(', ')}`);
}

function editorialItem(dossier,record,at,options={}){
  assertVerifiedDossier(dossier);
  // Only for a trail already on the site. A new trail has no description to
  // keep, and the asset policy already draws that same line.
  const retainedCopy=options.preserveExistingAssets?existingCopyFields(options.existingTrail):null;
  const requiredStartFact=routeGuidanceByClaim(dossier.claims).get('recommended-start');
  return {
    candidateId:dossier.candidateId,trailName:dossier.trailName,targetTrailId:dossier.trailId,
    dossierRef:`trail-verify-desk.html#verified-${dossier.candidateId}`,
    dossierArtifactRef:`firestore:verified-dossier-${dossier.candidateId}`,
    verifiedAt:record?.verifiedAt||dossier.ormaVerification.verifiedAt,
    verificationConditions:record?.conditions||dossier.ormaVerification.conditions||[],
    acceptedUnknowns:dossier.ormaVerification.acceptedBlockers||[],
    // Carried so publication can say which categories the badge may call
    // reviewed. Dropping it here would put the question back where it was: a
    // page claiming six checks on a verification that made two.
    researchedCategories:dossier.ormaVerification.researchedCategories||[],
    // A locked fact keeps everything the claim was made of, not only its prose.
    // An entity policy is a rifugio or lift name, a rule and the date its source
    // was read; dropping those here left the operational facts table unreachable.
    lockedFacts:(dossier.claims||[]).map(claim=>({id:claim.id,label:claim.label,value:claim.proposedValue,
      sourceIds:claim.sourceIds||[],state:claim.state,claimId:claim.claimId||null,agentId:claim.agentId||null,
      humanAcceptedFinding:claim.humanAcceptedFinding||null,
      // Which rung established this: the map, ORMA's own record, or absent for
      // an agent's answer cited to somebody who published it. Publication has
      // to say which, because a walk whose directions came from ORMA's record
      // has no outside source to cite and an empty source list would otherwise
      // be indistinguishable from having forgotten to cite one.
      derivedFrom:claim.derivedFrom||null,
      entityName:claim.entityName||null,rule:claim.rule||null,observedAt:claim.observedAt||null,
      location:claim.location||null,
      variesWith:claim.variesWith||null})),
    evidenceSources:dossier.sources||[],routeGeometry:dossier.routeGeometry||null,
    editorialBrief:{objective:'Produce concise premium ORMA trail copy using only the locked dossier facts.',
      requiredSections:['About the trail','Why it suits dogs','Important practical notes'],
      routeNarrativeRule:'For a numbered route, begin at the locked authoritative recommended starting point and describe the trail in the approved geometry order.',
      requiredStartFactId:requiredStartFact?.id||null,
      prohibited:['invent facts','soften safety caveats','change metrics','claim current operating conditions']},
    visualBrief:{objective:'Find a genuinely reusable trail image or return an explicit owned-photo checklist.',
      requiredChecks:['direct preview','source page','creator','licence','licence URL','credit','location-safe alt text'],
      prohibited:['infer trail conditions from a photograph','mark an incompletely licensed asset ready']},
    assetPolicy:options.preserveExistingAssets?'preserve-existing':'source-new-asset',
    // What the description will be: the one the trail already has, or one
    // somebody is paid to write. Stated on the item rather than worked out
    // again downstream, so the job that is queued and the fields that are
    // published cannot disagree about which it is.
    copyPolicy:retainedCopy?'preserve-existing':'draft-new',
    ...(retainedCopy?{retainedCopy}:{}),
    gates:[
      ...(retainedCopy?[]:[{id:'editorial-evidence-policy',status:'pending',checks:['copy matches locked facts','mandatory caveats remain prominent','tone matches ORMA']}]),
      ...(options.preserveExistingAssets?[]:[{id:'asset-and-licensing-approval',status:'pending',checks:['preview and source verified','creator, credit and licence verified','alt text approved','image is not condition evidence']}]),
      {id:'publication-quality-gate',status:'locked',checks:['content policy passed','website field mapping complete','repository quality gate passes']},
    ],
    queuedAt:at,publicMutationAllowed:false,publicationAuthorized:false,
  };
}

/**
 * The copy a trail in the catalogue already has.
 *
 * The parallel to `existingImageFields`, which has long said that a trail
 * already on the site keeps its photograph rather than having a new one
 * sourced and licensed. Its description had no such rule: every verification
 * queued a copywriter to write one, so establishing a walk's directions cost a
 * model call to rewrite a description that already existed, was already
 * approved, and is on the live page as you read this. All 163 catalogue trails
 * have a name, a description and practical notes.
 *
 * Nothing here claims the copy was newly written or newly reviewed. It is
 * carried unchanged, and the item says so, because the thing this publication
 * established is the walk's directions -- which have their own section on the
 * page and are not in the description at all.
 *
 * All three or nothing. A record missing any of them cannot supply the copy,
 * and that trail gets a copywriter as before: not having the copy and not
 * asking for it must not look the same.
 */
const RETAINED_COPY_FIELDS=Object.freeze(['name','desc','tips']);

function existingCopyFields(trail){
  if(!trail)return null;
  const copy={};
  for(const field of RETAINED_COPY_FIELDS){
    const value=String(trail[field]||'').trim();
    if(!value)return null;
    copy[field]=trail[field];
  }
  return copy;
}

function editorialJobs(item,at){
  const agents=[
    ...(item.copyPolicy==='preserve-existing'?[]:['copywriter']),
    ...(item.assetPolicy==='preserve-existing'?[]:['visualDirector']),
  ];
  return agents.map(agentId=>{
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
  const at=options.at||new Date().toISOString();const item=editorialItem(dossier,record,at,options);const jobs=editorialJobs(item,at);
  const items=[...(existingQueue?.items||[]).filter(candidate=>candidate.candidateId!==item.candidateId),item];
  const knownJobs=new Map((existingQueue?.jobs||[]).map(job=>[job.id,job]));for(const job of jobs)knownJobs.set(job.id,job);
  const queue={contractVersion:'1.0.0',generatedAt:at,mode:'draft-only',stage:'verified-trail-editorial-readiness',
    sourceRegistry:'firestore:orma-verified-registry-live',publicMutationAllowed:false,publicationAuthorized:false,
    lockedFactFields:LOCKED_FACT_FIELDS,items,jobs:[...knownJobs.values()],summary:{verifiedTrails:items.length,
      copywriterJobs:items.filter(candidate=>candidate.copyPolicy!=='preserve-existing').length,
      retainedCopy:items.filter(candidate=>candidate.copyPolicy==='preserve-existing').length,
      visualDirectorJobs:items.filter(candidate=>candidate.assetPolicy!=='preserve-existing').length,
      automatedPolicyGatesPending:items.filter(candidate=>candidate.assetPolicy==='preserve-existing').length,
      humanGatesPending:items.filter(candidate=>candidate.assetPolicy!=='preserve-existing').length*2,publicationGatesLocked:items.length}};
  return {item,jobs,queue};
}

module.exports={RETAINED_COPY_FIELDS,existingCopyFields,assertVerifiedDossier,editorialItem,editorialJobs,buildVerifiedEditorialHandoff};
