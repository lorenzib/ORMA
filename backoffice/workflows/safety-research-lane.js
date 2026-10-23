'use strict';

/**
 * A reviewed trail is sent back for its safety research.
 *
 * The fast lane takes a trail to the dossier gate on its geometry survey alone
 * (`directions-settled-by-survey`) and nothing ever sent it to the specialists
 * afterwards. Measured 21 October 2026: eleven trails stood at
 * ready-for-editorial that way, seven published as "Reviewed by ORMA", every one
 * at five of eleven checks with no path to the seal. The standard promised the
 * lane -- "research is deferred, not cancelled" -- and this is it.
 *
 * It asks only the two specialists the fast lane skipped, and only the safety
 * questions. It never reopens the directions: the survey that settled them goes
 * back to the gate with the new research, and logistics is not asked again.
 *
 * See OPERATING_STANDARD.md, "A reviewed trail is sent back for its safety
 * research" (approved 22 October 2026).
 */

const {specialistJob}=require('./apply-dossier-review');
const {SAFETY_CATEGORIES:SAFETY_CHECKS}=require('./compile-verified-dossier');
const {OFFICIAL_FIGURE_CLAIM_IDS,PROTECTED_AREAS_CLAIM}=require('./research-methods');

// Bumped when what the lane asks changes, so a trail is sent once per
// contract and never loops.
//
// v2 (23 October 2026): the seal now also needs the research methods that
// verify a walk by hand -- an authority's climb, time and distance, every
// municipality on the line with its dog rule, and the protected areas -- so
// the lane asks for them. A trail sent under v1 was not asked them.
const SAFETY_RESEARCH_CONTRACT='safety-research-v2';
const SAFETY_RESEARCH_STAGE='safety-research';

// Only the safety questions. The rifugio and lift policies are left to the
// route pipeline: a trail whose record names a hut or a lift has had them
// asked there, and asking again here would spend a call on what is not a
// safety check.
const SAFETY_SPECIALISTS=Object.freeze([
  {agentId:'regulatoryRanger',action:'safety-research-dog-and-seasonal-rules',
    claimIds:['dog-access','leash-rules','seasonal-restrictions','protected-area-dog-policy',PROTECTED_AREAS_CLAIM]},
  {agentId:'terrainPoi',action:'safety-research-terrain-water-heat-and-livestock',
    claimIds:['water','shade','surface','exposure','livestock','animals',...OFFICIAL_FIGURE_CLAIM_IDS]},
]);
const SAFETY_AGENTS=Object.freeze(SAFETY_SPECIALISTS.map(spec=>spec.agentId));

// What a specialist cannot read is marked, not guessed (decision 3). The
// rationale opens with this, the sources carry the document's address, and the
// claim stays unresolved -- so it can never settle access or livestock -- while
// the trail board lists the trail for a hand audit.
const UNREAD_DOCUMENT_MARK='unread-document:';

/**
 * The developer-prompt addition for a safety-lane job. Built here so the lane
 * and the runner cannot disagree about what the lane asks.
 */
function safetyResearchPrompt(job){
  if(job?.lane!==SAFETY_RESEARCH_STAGE)return '';
  const ranger=job.agentId==='regulatoryRanger'
    ? ` On the dog-access claim, set rule to "not-accepted" if dogs are prohibited on any part of this route, naming in proposedValue where and on whose authority; otherwise set rule to "not-applicable". Where a protected area on the line sets its own dog rule, return a protected-area-dog-policy claim for it as for any entity, and where none does, return one with rule "not-applicable" saying so. Check every municipality and protected area the line crosses, not only the one at the start.`
    : '';
  return `\n\nThis is a safety-research pass on a trail whose directions are already settled and published. Answer only the claims assigned in the job; do not revisit the start, the route numbers or the sequence.${ranger} If the rule or fact that decides a claim is in a document you cannot read -- a scanned PDF, a plan behind a map viewer, a page that will not load -- do not infer it: return that claim with finding "unresolved", put the document's https address in its sources, and begin the rationale with "${UNREAD_DOCUMENT_MARK}" followed by what the document is.`;
}

/**
 * Which published trails the lane may take, oldest-sealed first.
 *
 * Read from the published overrides rather than from every dossier, so finding
 * the work costs no Firestore read: an entry published through the reviewed
 * scope carries the graduation it was published with, and a graduation short
 * of one of the six safety checks is the trail this lane exists for.
 */
function planSafetyResearch(orchestration,overrides,options={}){
  const limit=Number(options.limit)>0?Number(options.limit):2;
  const byTrail=new Map((orchestration?.trails||[]).map(trail=>[String(trail.trailId),trail]));
  const candidates=[];
  for(const entry of overrides?.trails||[]){
    if(entry?.verificationScope!=='routeReviewed'||entry?.fields?.ormaVerified!==false)continue;
    const completed=entry.fields?.graduation?.completed||[];
    const missing=SAFETY_CHECKS.filter(check=>!completed.includes(check));
    if(!missing.length)continue;
    const trail=byTrail.get(String(entry.id));
    // Directions settled, dossier approved, nothing in flight. A trail
    // anywhere else in the pipeline gets its specialists there.
    if(!trail||trail.state!=='ready-for-editorial'||trail.verificationStatus!=='orma-verified')continue;
    if(trail.safetyResearch?.contract===SAFETY_RESEARCH_CONTRACT)continue;
    candidates.push({trailId:trail.trailId,candidateId:trail.candidateId,trailName:trail.trailName||null,
      missing,publishedAt:entry.generatedAt||null});
  }
  candidates.sort((a,b)=>String(a.publishedAt||'').localeCompare(String(b.publishedAt||'')));
  return candidates.slice(0,limit);
}

/**
 * Send the planned trails back into research, safety questions only.
 * Returns a new orchestration and the jobs to write; changes nothing it is given.
 */
function dispatchSafetyResearch(orchestration,plan,at){
  const next=JSON.parse(JSON.stringify(orchestration));
  const wanted=new Set(plan.map(item=>String(item.trailId)));
  const jobs=[];
  for(const trail of next.trails||[]){
    if(!wanted.has(String(trail.trailId)))continue;
    trail.attempts=trail.attempts||{};trail.jobIds=trail.jobIds||[];
    for(const spec of SAFETY_SPECIALISTS){
      const attempt=(trail.attempts[spec.agentId]||0)+1;trail.attempts[spec.agentId]=attempt;
      const job={...specialistJob(trail,spec,attempt,at),lane:SAFETY_RESEARCH_STAGE};
      jobs.push(job);trail.jobIds.push(job.id);
    }
    trail.safetyResearch={contract:SAFETY_RESEARCH_CONTRACT,requestedAt:at,
      returnTo:trail.state,previousStage:trail.stage||null,handAudit:[]};
    trail.state='evidence-research';trail.stage=SAFETY_RESEARCH_STAGE;
    trail.gate=null;trail.blockers=[];trail.updatedAt=at;
  }
  return {orchestration:next,jobs};
}

function inSafetyResearch(trail){
  return trail?.safetyResearch?.contract===SAFETY_RESEARCH_CONTRACT&&trail.state!=='ready-for-editorial';
}

/**
 * The claims a specialist marked as resting on a document it could not read.
 */
function unreadDocuments(outputs){
  const found=[];
  for(const output of outputs||[]){
    if(!SAFETY_AGENTS.includes(output.agentId))continue;
    for(const claim of output.result?.claims||[]){
      if(!String(claim?.rationale||'').trim().toLowerCase().startsWith(UNREAD_DOCUMENT_MARK))continue;
      found.push({agentId:output.agentId,claimId:claim.id,category:claim.category||null,
        sources:(claim.sources||[]).map(source=>source?.url).filter(Boolean)});
    }
  }
  return found;
}

/**
 * Whether the dossier establishes that dogs are not allowed on the walk
 * (decision 2). Read from the facts publication carries: a settled dog-access
 * or protected-area claim whose rule is "not-accepted".
 */
function dogsNotAccepted(item){
  return (item?.lockedFacts||[]).filter(fact=>
    ['dog-access','protected-area-dog-policy'].includes(String(fact.claimId||''))
    &&['supported-proposal','varies'].includes(fact.humanAcceptedFinding)
    &&fact.rule==='not-accepted');
}

/**
 * A trail verified by hand while the lane had it out stands down.
 *
 * The lane's research would come back to a trail that already carries the
 * seal, and a publication from a thinner dossier is refused outright -- it may
 * not take a seal away -- which fails the publishing batch it is in. So its
 * queued jobs are retired before they spend anything, and the trail returns to
 * where it was. Applied whether or not the lane is switched on: switching it
 * off stops new trails, not the ones already sent.
 */
function planStandDown(orchestration,sealedTrailIds){
  const sealed=new Set([...sealedTrailIds].map(String));
  return (orchestration?.trails||[]).filter(trail=>inSafetyResearch(trail)&&sealed.has(String(trail.trailId)))
    .map(trail=>({trailId:trail.trailId,candidateId:trail.candidateId,jobIds:[...(trail.jobIds||[])]}));
}

function standDown(orchestration,plan,at){
  const next=JSON.parse(JSON.stringify(orchestration));
  const wanted=new Set(plan.map(item=>String(item.trailId)));
  for(const trail of next.trails||[]){
    if(!wanted.has(String(trail.trailId)))continue;
    trail.state=trail.safetyResearch.returnTo||'ready-for-editorial';
    trail.stage='safety-research-superseded-by-hand-audit';
    trail.safetyResearch={...trail.safetyResearch,supersededAt:at};
    trail.gate=null;trail.blockers=[];trail.updatedAt=at;
  }
  return next;
}

module.exports={planStandDown,standDown,SAFETY_RESEARCH_CONTRACT,SAFETY_RESEARCH_STAGE,SAFETY_SPECIALISTS,SAFETY_AGENTS,
  UNREAD_DOCUMENT_MARK,safetyResearchPrompt,planSafetyResearch,dispatchSafetyResearch,inSafetyResearch,
  unreadDocuments,dogsNotAccepted};
