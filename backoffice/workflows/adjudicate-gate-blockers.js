'use strict';

// Arrive with an answer, not a question.
//
// #617 sends a gate to the agent when its blockers are research nobody has
// done. What is left is the other half: blockers that genuinely are a decision,
// where the decision still cannot be made from the desk. "terrainPoi/livestock:
// five automated resolution strategies exhausted" asks whether a trail can be
// verified despite nobody establishing whether there are guard dogs on it — and
// answering that means reading a comune page, a park bulletin or a pasture
// notice, which is not something a person can do from a review card.
//
// So an adjudicator reads those sources and writes what it found into the one
// field the desk already has for it: the reason beside each blocker's tick-box.
// It recommends; it never accepts. The tick stays hers, because accepting a
// blocker is the sentence kept with the verification and it has to be a
// person's. Auto-apply is step 3 and a separate decision.
//
// Two things this must never do, both enforced below rather than asked for in
// the prompt:
//   - recommend accepting a blocker that cannot be accepted. Route guidance is
//     supplied, not waived (compile-verified-dossier is explicit: "Route
//     guidance cannot be accepted, only supplied"), so a recommendation to
//     accept one is dropped.
//   - invent a blocker. A verdict is matched to the queue item's own blocker
//     strings verbatim; anything else is discarded, because a reason attached to
//     a blocker nobody filed would pre-fill a field for a decision that is not
//     being asked.

const {createStructuredResponse}=require('../services/openai-responses-client');
const {MIN_ACCEPTANCE_REASON,waivableBlocker}=require('./compile-verified-dossier');

// The desk requires the same minimum before it will accept a typed reason, and
// compile-verified-dossier drops a shorter one on the way in. Read from the
// producer so a recommendation cannot be written that the contract then ignores.
const MIN_REASON=MIN_ACCEPTANCE_REASON;

// "corroborated" is a claim about independence, so it needs sources that are
// actually independent: two different publishers, not one page cited twice.
const CORROBORATION_HOSTS=2;

const MAX_VERDICTS=12;
const MAX_SOURCES=4;
const MAX_QUOTE=240;
const MAX_REASON=300;

const CONFIDENCE=Object.freeze(['corroborated','single-source','unsourced']);
const RECOMMENDATIONS=Object.freeze(['accept','cannot-accept','needs-supply']);

const ADJUDICATION_SCHEMA={type:'object',additionalProperties:false,properties:{
  verdicts:{type:'array',maxItems:MAX_VERDICTS,items:{type:'object',additionalProperties:false,properties:{
    blocker:{type:'string',description:'The blocker string being judged, copied verbatim from the list given to you.'},
    recommendation:{type:'string',enum:[...RECOMMENDATIONS]},
    reason:{type:'string',description:'Why this blocker does not stop the trail being verified, in one sentence a reader of the verification record would understand. Never a claim that the underlying fact is true.'},
    confidence:{type:'string',enum:[...CONFIDENCE]},
    sources:{type:'array',maxItems:MAX_SOURCES,items:{type:'object',additionalProperties:false,properties:{
      url:{type:'string'},publisher:{type:'string'},quote:{type:'string'},
    },required:['url','publisher','quote']}},
  },required:['blocker','recommendation','reason','confidence','sources']}},
  summary:{type:'string'},
},required:['verdicts','summary']};

function host(url){
  try{return new URL(String(url)).host.replace(/^www\./,'').toLowerCase();}catch(error){return '';}
}

/** Distinct publishers behind a verdict, counted by host rather than by entry. */
function independentHosts(sources){
  return new Set((sources||[]).map(source=>host(source.url)).filter(Boolean)).size;
}

function cleanSources(sources){
  return (sources||[]).slice(0,MAX_SOURCES)
    .map(source=>({url:String(source?.url||'').trim(),publisher:String(source?.publisher||'').trim(),
      quote:String(source?.quote||'').trim().slice(0,MAX_QUOTE)}))
    .filter(source=>host(source.url)&&source.publisher&&source.quote);
}

/**
 * What survives of the model's answer. Each dropped verdict is returned with
 * the rule that dropped it: a recommendation silently missing from the desk is
 * indistinguishable from one that was never asked for.
 */
function reviewVerdicts(verdicts,blockers){
  const standing=new Map((blockers||[]).map(reason=>[String(reason).trim(),String(reason)]));
  const kept=[],dropped=[];
  const seen=new Set();
  const drop=(verdict,rule)=>dropped.push({blocker:String(verdict?.blocker||'').slice(0,300),rule});

  for(const verdict of (verdicts||[]).slice(0,MAX_VERDICTS)){
    const blocker=standing.get(String(verdict?.blocker||'').trim());
    if(!blocker){drop(verdict,'blocker-is-not-on-this-gate');continue;}
    if(seen.has(blocker)){drop(verdict,'duplicate-verdict');continue;}
    const recommendation=RECOMMENDATIONS.includes(verdict.recommendation)?verdict.recommendation:null;
    if(!recommendation){drop(verdict,'unknown-recommendation');continue;}
    // Route guidance is supplied, never waived. A recommendation to accept one
    // is the model answering a question the contract does not accept, so it is
    // rewritten into the answer that is true: this has to be supplied.
    if(recommendation==='accept'&&!waivableBlocker(blocker)){drop(verdict,'blocker-cannot-be-accepted');continue;}
    const reason=String(verdict.reason||'').trim().slice(0,MAX_REASON);
    if(recommendation==='accept'&&reason.length<MIN_REASON){drop(verdict,'reason-too-short-to-be-accepted');continue;}
    const sources=cleanSources(verdict.sources);
    const confidence=CONFIDENCE.includes(verdict.confidence)?verdict.confidence:'unsourced';
    // A verdict calling itself corroborated on one publisher is demoted rather
    // than dropped: the finding may well be right, and step 3 is going to read
    // this field to decide what may apply without a person.
    const graded=confidence==='corroborated'&&independentHosts(sources)<CORROBORATION_HOSTS
      ?(sources.length?'single-source':'unsourced'):confidence;
    // An accept recommendation with no source it retrieved is an opinion. The
    // reason beside a tick-box is kept with the verification for good, so it
    // does not get pre-filled by something nobody can check.
    if(recommendation==='accept'&&!sources.length){drop(verdict,'accept-without-a-retrievable-source');continue;}
    seen.add(blocker);
    kept.push({blocker,recommendation,reason,confidence:graded,sources});
  }
  return {verdicts:kept,dropped};
}

/** The blockers worth asking about: the ones a reason could actually clear. */
function adjudicableBlockers(item){
  return (item?.blockingReasons||[]).filter(reason=>waivableBlocker(reason));
}

function prompt(item,trail){
  return [
    {role:'developer',content:[
      'You are the ORMA verification adjudicator. A dog-walking trail is waiting at a human review gate, held by the blockers listed below. Each one is a loose end the research agents could not close.',
      'A moderator can accept a blocker — recording that it does not stop this trail being verified — but only with a written reason, and that reason is kept with the verification permanently. Your job is to find out whether such a reason honestly exists, and to write it.',
      'Search the sources that would settle each one: comune and municipal pages, park and protected-area bulletins, provincial or departmental tourism offices, CAI and alpine club route sheets, rifugio and lift operator pages, pasture and livestock notices, and local news. Prefer official and recent sources.',
      'Return recommendation "accept" only when something you actually retrieved supports a reason a moderator could stand behind. Cite it: a real URL you opened, the publisher, and a short verbatim quote. Never cite a page you did not retrieve and never paraphrase a quote.',
      'Return "needs-supply" when the blocker is not a judgement call at all but missing work — a start point or route sequence that has to be established rather than waived.',
      'Return "cannot-accept" when you looked and found either nothing, or something that argues against verifying this trail. This is the right answer more often than "accept"; a trail left waiting costs nothing, and a wrongly verified one is a dog walked somewhere nobody checked.',
      'Set confidence "corroborated" only when two independent publishers agree, "single-source" for one, "unsourced" when your reason rests on reasoning rather than a document.',
      'The reason must say why the blocker does not stop verification. It must never assert that the underlying fact is true — the claim stays exactly as the agent left it.',
    ].join('\n')},
    {role:'user',content:[
      `Trail: ${trail?.trailName||item?.trailName||item?.candidateId}`,
      `Area: ${trail?.area||trail?.valley||'unstated'}`,
      trail?.routeReference?`Route reference: ${trail.routeReference}`:null,
      '',
      'Blockers to judge, verbatim:',
      ...adjudicableBlockers(item).map(reason=>`- ${reason}`),
    ].filter(value=>value!==null).join('\n')},
  ];
}

/**
 * One gate, adjudicated. Returns the record to store; never writes, and never
 * decides anything — the caller stores it and the desk offers it.
 */
async function adjudicateGateBlockers(item,options={}){
  const blockers=adjudicableBlockers(item);
  if(!blockers.length)throw new Error('This gate has no blocker a reason could clear');
  const runAgent=options.runAgent||createStructuredResponse;
  const response=await runAgent({schemaName:'orma_gate_adjudication',schema:ADJUDICATION_SCHEMA,webSearch:true,
    messages:prompt(item,options.trail)},options.clientOptions||{});
  const reviewed=reviewVerdicts(response.data?.verdicts,blockers);
  return {contractVersion:'1.0.0',reviewId:item.reviewId,candidateId:item.candidateId,
    gateType:item.gateType||null,adjudicatedAt:options.at||new Date().toISOString(),
    // What the recommendation was made against. A gate whose blockers have
    // changed since has an adjudication about a different question, and the
    // desk must not offer it as though it still applied.
    blockerCount:blockers.length,blockers,
    summary:String(response.data?.summary||'').trim().slice(0,600),
    verdicts:reviewed.verdicts,dropped:reviewed.dropped,
    model:response.model||null,responseId:response.responseId||null,
    publicMutationAllowed:false};
}

/** The stored artifact: newest adjudication per review, oldest evicted first. */
function mergeAdjudications(existing,adjudication,options={}){
  const limit=Number.isInteger(options.limit)&&options.limit>0?options.limit:40;
  const items=[(adjudication),...(existing?.items||[]).filter(item=>item.reviewId!==adjudication.reviewId)]
    .slice(0,limit);
  return {contractVersion:'1.0.0',artifactId:'gate-adjudications',
    generatedAt:adjudication.adjudicatedAt,items,publicMutationAllowed:false};
}

/**
 * Whether a stored adjudication still answers the gate in front of the reader.
 * Blockers are recomputed on every pass, so an adjudication written against a
 * different set is stale and is not shown.
 */
function adjudicationMatches(adjudication,item){
  if(!adjudication||!item)return false;
  const now=adjudicableBlockers(item).map(String);
  const then=(adjudication.blockers||[]).map(String);
  return now.length===then.length&&now.every(reason=>then.includes(reason));
}

module.exports={ADJUDICATION_SCHEMA,MIN_REASON,CORROBORATION_HOSTS,CONFIDENCE,RECOMMENDATIONS,
  host,independentHosts,reviewVerdicts,adjudicableBlockers,prompt,
  adjudicateGateBlockers,mergeAdjudications,adjudicationMatches};
