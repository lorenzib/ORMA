'use strict';

const {createStructuredResponse}=require('../services/openai-responses-client');

// A customer hazard report is data, not a decision. The Hazard Analyst searches for
// independent corroboration and returns a verdict; only the verdict decides what,
// if anything, readers see.
const HAZARD_VETTING_SCHEMA={type:'object',additionalProperties:false,properties:{
  verdict:{type:'string',enum:['corroborated','uncorroborated','contradicted','not-a-hazard']},
  plausible:{type:'boolean'},
  severity:{type:'string',enum:['moderate','severe','extreme']},
  title:{type:'string'},
  message:{type:'string'},
  reasoning:{type:'string'},
  expectedDurationDays:{type:['integer','null']},
  sources:{type:'array',maxItems:4,items:{type:'object',additionalProperties:false,properties:{
    url:{type:'string'},publisher:{type:'string'},publishedOn:{type:['string','null']},quote:{type:'string'},
  },required:['url','publisher','publishedOn','quote']}},
},required:['verdict','plausible','severity','title','message','reasoning','expectedDurationDays','sources']};

const UNVERIFIED_NOTICE='Reported by a hiker and not yet confirmed by an official source. Treat it as a heads-up, not a verified closure.';
const UNVERIFIED_LIFETIME_DAYS=7;
const CORROBORATED_LIFETIME_DAYS=30;
const REVET_INTERVAL_HOURS=24;

function days(at,count){return new Date(new Date(at).getTime()+count*24*60*60*1000).toISOString();}
function hours(at,count){return new Date(new Date(at).getTime()+count*60*60*1000).toISOString();}

async function runHazardVetting(report,options={}){
  const runAgent=options.runAgent||createStructuredResponse;
  const response=await runAgent({schemaName:'orma_community_hazard_vetting',schema:HAZARD_VETTING_SCHEMA,webSearch:true,messages:[
    {role:'developer',content:[
      'You are the ORMA Hazard Analyst. A hiker has reported a hazard on one specific trail.',
      'Search for independent corroboration: comune and park authority notices, protezione civile and mountain rescue bulletins, CAI or alpine club updates, rifugio and lift operator pages, and local news. Prefer official and recent sources.',
      'Return verdict "corroborated" only when at least one independent source you actually found supports the report. Every source you cite must be one you retrieved, with a real URL and a short verbatim quote.',
      'Return "contradicted" when a current authoritative source says the opposite, and "not-a-hazard" for spam, abuse, jokes, or anything that is not a trail hazard.',
      'Otherwise return "uncorroborated" and judge plausibility: could a hiker have genuinely seen this on this trail, at this time of year? Most real local hazards are never published online, so absence of coverage is not evidence against the report.',
      'This is dog-walking safety guidance. Never overstate certainty and never invent a source.',
    ].join('\n')},
    {role:'user',content:`Trail: ${report.trailName||report.trailId}\nArea: ${report.area||'unknown'}\nCategory: ${report.category}\nObserved on: ${report.observedOn||'unstated'}\nReport: ${report.description||''}`},
  ]},options.clientOptions||{});
  return {contractVersion:'1.0.0',reportId:report.id,trailId:report.trailId,
    generatedAt:options.at||new Date().toISOString(),publicMutationAllowed:false,...response.data};
}

// Publishing decision. Corroborated reports become ordinary ORMA hazards. Plausible
// but uncorroborated ones publish under an explicit unverified label with a short
// life, because a genuinely local hazard is usually the one nobody has published.
function hazardFromVetting(report,vetting,at){
  const corroborated=vetting.verdict==='corroborated'&&(vetting.sources||[]).length>0;
  if(!corroborated&&(vetting.verdict!=='uncorroborated'||!vetting.plausible))return null;
  const lifetime=corroborated
    ?Math.min(vetting.expectedDurationDays||CORROBORATED_LIFETIME_DAYS,CORROBORATED_LIFETIME_DAYS)
    :UNVERIFIED_LIFETIME_DAYS;
  return {
    id:`community-${report.id}`,origin:'community',state:'active',
    severity:corroborated?vetting.severity:'moderate',
    event:report.category,area:report.area||report.trailName||'',
    title:corroborated?vetting.title:`Unconfirmed: ${vetting.title}`,
    message:corroborated?vetting.message:`${vetting.message} ${UNVERIFIED_NOTICE}`,
    verificationState:corroborated?'corroborated':'reported-unverified',
    sourceKey:'community-report',sourceLabel:corroborated?'Hiker report, corroborated':'Hiker report, unconfirmed',
    sourceUrl:(vetting.sources||[])[0]?.url||null,
    corroboration:(vetting.sources||[]).map(source=>({url:source.url,publisher:source.publisher,publishedOn:source.publishedOn||null})),
    reportId:report.id,reportedAt:report.createdAt||at,
    firstPublishedAt:at,lastSeenAt:at,lastVettedAt:at,
    nextVettingAt:hours(at,REVET_INTERVAL_HOURS),expiresAt:days(at,lifetime),
    removalRequiresHumanReview:false,
    trailIds:[report.trailId],trailNames:[report.trailName||report.trailId],
  };
}

function applyHazardVetting(publicData,report,vetting,options={}){
  const at=options.at||new Date().toISOString();
  const hazards=(publicData?.hazards||[]).filter(item=>item.reportId!==report.id);
  const hazard=hazardFromVetting(report,vetting,at);
  const status=hazard?(hazard.verificationState==='corroborated'?'published':'published-unverified')
    :(vetting.verdict==='not-a-hazard'?'rejected':'not-published');
  return {
    publicData:{...publicData,generatedAt:at,hazards:hazard?[...hazards,hazard]:hazards},
    hazard,status,
    receipt:{reportId:report.id,trailId:report.trailId,verdict:vetting.verdict,plausible:vetting.plausible,
      status,sources:(vetting.sources||[]).map(source=>source.url),reasoning:vetting.reasoning,
      vettedAt:at,publicMutationAllowed:false},
  };
}

// Community hazards remove themselves: an expired one goes without asking, and one
// that is due for re-checking returns to the analyst rather than lingering.
function expireCommunityHazards(publicData,options={}){
  const at=options.at||new Date().toISOString();
  const now=new Date(at).getTime();
  const kept=[];const expired=[];const dueForRevetting=[];
  for(const hazard of publicData?.hazards||[]){
    if(hazard.origin!=='community'){kept.push(hazard);continue;}
    if(hazard.expiresAt&&new Date(hazard.expiresAt).getTime()<=now){expired.push(hazard);continue;}
    if(hazard.nextVettingAt&&new Date(hazard.nextVettingAt).getTime()<=now)dueForRevetting.push(hazard);
    kept.push(hazard);
  }
  return {publicData:expired.length?{...publicData,generatedAt:at,hazards:kept}:publicData,expired,dueForRevetting};
}

module.exports={HAZARD_VETTING_SCHEMA,UNVERIFIED_NOTICE,UNVERIFIED_LIFETIME_DAYS,CORROBORATED_LIFETIME_DAYS,
  REVET_INTERVAL_HOURS,runHazardVetting,hazardFromVetting,applyHazardVetting,expireCommunityHazards};
