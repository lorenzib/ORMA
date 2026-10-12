'use strict';

const {createStructuredResponse}=require('../services/openai-responses-client');
const {locateOnRoute}=require('../../hazard-location');

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
  location:{type:['object','null'],additionalProperties:false,properties:{
    lat:{type:'number'},lng:{type:'number'},
    landmark:{type:'string',description:'What is at this point, named the way a walker would recognise it.'},
  },required:['lat','lng','landmark'],
  description:'Where on this trail the hazard is, when the report or a source you found establishes it well enough to place. Null when it does not; never infer a position from the route as a whole.'},
  sources:{type:'array',maxItems:4,items:{type:'object',additionalProperties:false,properties:{
    url:{type:'string'},publisher:{type:'string'},publishedOn:{type:['string','null']},quote:{type:'string'},
  },required:['url','publisher','publishedOn','quote']}},
},required:['verdict','plausible','severity','title','message','reasoning','expectedDurationDays','sources','location']};

const UNVERIFIED_NOTICE='Reported by a hiker and not yet confirmed by an official source. Treat it as a heads-up, not a verified closure.';
// The same lane now also carries notices the closure scout found in an
// authority's own bulletin. Telling a reader a published notice was "reported by
// a hiker" is false about where it came from, and understates it: the scout only
// files what an authority published. It is still unconfirmed until the Analyst
// corroborates it independently, which is what this sentence says instead.
const SCOUTED_UNVERIFIED_NOTICE='Found in an official notice by ORMA and not yet independently confirmed. Treat it as a heads-up, not a verified closure.';
const SCOUT_REPORTER='orma-closure-scout';
const scouted=report=>report?.reportedBy===SCOUT_REPORTER;
const UNVERIFIED_LIFETIME_DAYS=7;
const CORROBORATED_LIFETIME_DAYS=30;
const REVET_INTERVAL_HOURS=24;

function days(at,count){return new Date(new Date(at).getTime()+count*24*60*60*1000).toISOString();}
function hours(at,count){return new Date(new Date(at).getTime()+count*60*60*1000).toISOString();}

async function runHazardVetting(report,options={}){
  const runAgent=options.runAgent||createStructuredResponse;
  const response=await runAgent({schemaName:'orma_community_hazard_vetting',schema:HAZARD_VETTING_SCHEMA,webSearch:true,messages:[
    {role:'developer',content:[
      'You are the ORMA Hazard Analyst. A possible hazard on one specific trail has been reported to you, and the report says which it is: either a hiker saw it, or ORMA\u2019s closure scout found it in an authority\u2019s published notice.',
      'Where the scout found a published notice, that notice is evidence and is given to you below. Corroboration still means a source independent of it: a second authority, the park, the operator or local news. Do not treat the scout\u2019s own page as its own corroboration, and do not simply restate it -- check that it is current, because a notice from last season may have been withdrawn.',
      'Search for independent corroboration: comune and park authority notices, protezione civile and mountain rescue bulletins, CAI or alpine club updates, rifugio and lift operator pages, and local news. Prefer official and recent sources.',
      'Return verdict "corroborated" only when at least one independent source you actually found supports the report. Every source you cite must be one you retrieved, with a real URL and a short verbatim quote.',
      'Return "contradicted" when a current authoritative source says the opposite, and "not-a-hazard" for spam, abuse, jokes, or anything that is not a trail hazard.',
      'Otherwise return "uncorroborated" and judge plausibility: could a hiker have genuinely seen this on this trail, at this time of year? Most real local hazards are never published online, so absence of coverage is not evidence against the report.',
      'If the report or a source you retrieved places the hazard somewhere identifiable on the route -- a named gate, ford, pasture crossing, col or junction -- return its coordinate in location with a landmark naming what is there. A walker warned before reaching a hazard can act on it; one told only that it is somewhere on the walk cannot. Return location null when nothing establishes a position: a guessed coordinate is worse than none, because it moves the warning to a place nobody reported.',
      'This is dog-walking safety guidance. Never overstate certainty and never invent a source.',
    ].join('\n')},
    {role:'user',content:[
      `Trail: ${report.trailName||report.trailId}`,
      `Area: ${report.area||'unknown'}`,
      `Category: ${report.category}`,
      `Reported by: ${scouted(report)?'ORMA closure scout, from a published notice':'a hiker'}`,
      `Observed on: ${report.observedOn||'unstated'}`,
      `Report: ${report.description||''}`,
      ...(scouted(report)&&report.scoutedSource?[
        `Notice the scout found: ${report.scoutedSource.publisher} (${report.scoutedSource.publishedOn||'date not stated'}) ${report.scoutedSource.url}`,
        `It says: "${report.scoutedSource.quote}"`,
      ]:[]),
      ...(report.statedEndsOn?[`The notice states it ends on: ${report.statedEndsOn}`]:[]),
    ].join('\n')},
  ]},options.clientOptions||{});
  // The analyst supplies a coordinate; the km is measured here, off the trail's
  // own path, exactly as a reader's tap is. A coordinate that is not on this
  // route is discarded rather than published somewhere nobody reported.
  const located=response.data.location?locateOnRoute(response.data.location,options.trailPath):null;
  return {contractVersion:'1.0.0',reportId:report.id,trailId:report.trailId,
    generatedAt:options.at||new Date().toISOString(),publicMutationAllowed:false,...response.data,
    locatedAt:located&&located.onRoute?{lat:located.lat,lng:located.lng,km:located.km}:null};
}

// A position is published only when it is complete and in range. A partial or
// malformed one is dropped rather than rounded into a plausible-looking point.
function hazardPosition(location){
  if(!location)return null;
  const lat=Number(location.lat),lng=Number(location.lng),km=Number(location.km);
  if(![lat,lng,km].every(Number.isFinite))return null;
  if(lat<-90||lat>90||lng<-180||lng>180||km<0)return null;
  return {lat,lng,km:Math.round(km*100)/100};
}

// Publishing decision. Corroborated reports become ordinary ORMA hazards. Plausible
// but uncorroborated ones publish under an explicit unverified label with a short
// life, because a genuinely local hazard is usually the one nobody has published.
/**
 * The expiry an authority stated, when the scout brought one back: end of that
 * day, capped at the corroborated lifetime so a long notice is renewed by
 * re-vetting rather than published once and trusted for a season. A date already
 * past yields the floor, so the hazard expires at the next pass instead of
 * being published with an expiry behind it.
 */
function statedExpiry(report,at){
  if(!scouted(report))return null;
  const stated=String(report.statedEndsOn||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(stated))return null;
  const ends=new Date(`${stated}T23:59:59.000Z`).getTime();
  if(!Number.isFinite(ends))return null;
  const cap=new Date(days(at,CORROBORATED_LIFETIME_DAYS)).getTime();
  return new Date(Math.min(Math.max(ends,new Date(at).getTime()),cap)).toISOString();
}

function hazardFromVetting(report,vetting,at){
  const corroborated=vetting.verdict==='corroborated'&&(vetting.sources||[]).length>0;
  if(!corroborated&&(vetting.verdict!=='uncorroborated'||!vetting.plausible))return null;
  const lifetime=corroborated
    ?Math.min(vetting.expectedDurationDays||CORROBORATED_LIFETIME_DAYS,CORROBORATED_LIFETIME_DAYS)
    :UNVERIFIED_LIFETIME_DAYS;
  // An authority that published an end date has stated the validity window, and
  // it beats both defaults -- in either direction. A closure stated until April
  // should not come down after seven days, and one that ended yesterday should
  // not be published for thirty. Still capped: a notice claiming to run for
  // years is not a current hazard, and re-vetting renews it while it is real.
  const statedEnd=statedExpiry(report,at);
  return {
    id:`community-${report.id}`,origin:'community',state:'active',
    severity:corroborated?vetting.severity:'moderate',
    event:report.category,area:report.area||report.trailName||'',
    title:corroborated?vetting.title:`Unconfirmed: ${vetting.title}`,
    message:corroborated?vetting.message
      :`${vetting.message} ${scouted(report)?SCOUTED_UNVERIFIED_NOTICE:UNVERIFIED_NOTICE}`,
    verificationState:corroborated?'corroborated':'reported-unverified',
    sourceKey:'community-report',
    sourceLabel:scouted(report)
      ?(corroborated?'Official notice found by ORMA, corroborated':'Official notice found by ORMA, unconfirmed')
      :(corroborated?'Hiker report, corroborated':'Hiker report, unconfirmed'),
    sourceUrl:(vetting.sources||[])[0]?.url||null,
    corroboration:(vetting.sources||[]).map(source=>({url:source.url,publisher:source.publisher,publishedOn:source.publishedOn||null})),
    reportId:report.id,reportedAt:report.createdAt||at,
    firstPublishedAt:at,lastSeenAt:at,lastVettedAt:at,
    nextVettingAt:hours(at,REVET_INTERVAL_HOURS),
    expiresAt:statedEnd||days(at,lifetime),
    removalRequiresHumanReview:false,
    // Where on the trail it is, when the reporter placed it. A hazard that is
    // somewhere in particular is one a walker can be warned about on approach;
    // one that is merely "on this trail" is not. Carried verbatim from the
    // report: vetting judges whether the hazard is real, not where it was seen.
    at:hazardPosition(report.location)||hazardPosition(vetting.locatedAt),
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

module.exports={HAZARD_VETTING_SCHEMA,SCOUTED_UNVERIFIED_NOTICE,SCOUT_REPORTER,statedExpiry,hazardPosition,UNVERIFIED_NOTICE,UNVERIFIED_LIFETIME_DAYS,CORROBORATED_LIFETIME_DAYS,
  REVET_INTERVAL_HOURS,runHazardVetting,hazardFromVetting,applyHazardVetting,expireCommunityHazards};
