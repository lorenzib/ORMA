'use strict';

/**
 * Go and look for closure notices, instead of waiting for a walker to report one.
 *
 * The hazard lane already has somewhere for a closure to live: the community
 * vetting lifecycle. It is add-only by construction -- a community hazard is
 * never reconciled against the weather feeds -- it carries its own expiry, and
 * it re-vets itself. What it has never had is anyone going to look. A path shut
 * by a landslide is published by the comune and by the park, and ORMA waited
 * for a hiker to notice.
 *
 * So this scouts official notices for one area and files what it finds as
 * pending hazard reports. It does NOT publish: a scouted notice goes through
 * exactly the vetting the Hazard Analyst gives a hiker's report, which searches
 * independently for corroboration and decides what, if anything, readers see.
 * The scout's own source is evidence, not a verdict.
 *
 * Why no source connector instead (#720 asked the question): an authoritative
 * machine-readable closure feed does not exist for these regions. Measured on
 * the South Tyrol Open Data Hub, the only structured candidate: the operating
 * schedule that would carry a closure's validity window is populated on 0 of
 * 800 records, and `IsOpen` on 4% and with no validity window at all. A
 * connector reading those fields would report nothing while showing green.
 *
 * Two rules enforced here rather than asked for in the prompt, both the lesson
 * of #717:
 *   - a notice names the trails it affects by the id printed beside them, and
 *     an id this area never printed is dropped. Free text would have to be
 *     matched back to a trail by prose, which is the failure this codebase has
 *     now paid for three times.
 *   - a notice with no retrievable official source is dropped. The scout exists
 *     to bring back what an authority published; a recollection that a path is
 *     shut is what the community lane is already for.
 */

const {createStructuredResponse}=require('../services/openai-responses-client');

const MAX_NOTICES=8;
const MAX_TRAILS_ASKED=40;
const MAX_QUOTE=240;
const MAX_DESCRIPTION=600;

// What a closure notice can be about. These are the categories the vetting lane
// and the public card already understand; a scout does not get to invent a new
// kind of hazard.
const CATEGORIES=Object.freeze(['path-closed','path-damaged','bridge-closed','rockfall',
  'landslide','flooding','livestock-guardian-dogs','hunting','works','lift-closed','hut-closed']);

const SCOUT_SCHEMA={type:'object',additionalProperties:false,properties:{
  notices:{type:'array',maxItems:MAX_NOTICES,items:{type:'object',additionalProperties:false,properties:{
    trailIds:{type:'array',maxItems:12,items:{type:'string'},
      description:'The ids printed beside the affected trails, exactly as printed (for example "T3"). Never a trail name and never an id that was not printed.'},
    category:{type:'string',enum:[...CATEGORIES]},
    description:{type:'string',description:'What the notice says, in one or two plain sentences a walker would act on.'},
    startsOn:{type:['string','null'],description:'ISO date the restriction began, when the notice states one.'},
    endsOn:{type:['string','null'],description:'ISO date the restriction is stated to end. Null when the notice does not say; never guessed.'},
    source:{type:'object',additionalProperties:false,properties:{
      url:{type:'string'},publisher:{type:'string'},
      publishedOn:{type:['string','null']},
      quote:{type:'string',description:'A short verbatim quote from the page, in its own language.'},
    },required:['url','publisher','publishedOn','quote']},
  },required:['trailIds','category','description','startsOn','endsOn','source']}},
  searched:{type:'string',description:'Which authorities you actually checked, so a run that found nothing can be told from one that looked nowhere.'},
},required:['notices','searched']};

function host(url){
  try{return new URL(String(url)).host.replace(/^www\./,'').toLowerCase();}catch(error){return '';}
}

/**
 * The trails as a numbered ballot. Same reason as the gate adjudicator (#717):
 * the agent is reading a rendered line, so identity has to be something short
 * it can echo exactly, not the trail's prose.
 */
function ballot(trails){
  return (trails||[]).slice(0,MAX_TRAILS_ASKED)
    .map((trail,index)=>({id:`T${index+1}`,trail}));
}

function cleanSource(source){
  const url=String(source?.url||'').trim();
  const publisher=String(source?.publisher||'').trim();
  const quote=String(source?.quote||'').trim().slice(0,MAX_QUOTE);
  if(!host(url)||!publisher||!quote)return null;
  return {url,publisher,publishedOn:String(source?.publishedOn||'').trim()||null,quote};
}

function isoDateOrNull(value){
  const text=String(value||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}/.test(text))return null;
  const date=new Date(text.slice(0,10));
  return Number.isFinite(date.getTime())?date.toISOString().slice(0,10):null;
}

/**
 * What survives of the scout's answer, and why the rest did not. A notice
 * dropped silently is indistinguishable from an area with nothing wrong in it.
 */
function reviewNotices(notices,trails){
  const paper=ballot(trails);
  const byId=new Map(paper.map(entry=>[entry.id.toLowerCase(),entry.trail]));
  const kept=[],dropped=[];
  const seen=new Set();
  const drop=(notice,rule)=>dropped.push({
    category:String(notice?.category||'').slice(0,60),
    url:String(notice?.source?.url||'').slice(0,200),rule});

  for(const notice of (notices||[]).slice(0,MAX_NOTICES)){
    if(!CATEGORIES.includes(notice?.category)){drop(notice,'category-is-not-one-ORMA-publishes');continue;}
    const matched=[...new Set((notice.trailIds||[]).map(id=>String(id).trim().toLowerCase()))]
      .map(id=>byId.get(id)).filter(Boolean);
    if(!matched.length){drop(notice,'no-trail-on-this-area-ballot');continue;}
    const source=cleanSource(notice.source);
    if(!source){drop(notice,'no-retrievable-official-source');continue;}
    const description=String(notice.description||'').trim().slice(0,MAX_DESCRIPTION);
    if(!description){drop(notice,'nothing-a-walker-could-act-on');continue;}
    // One notice per source per trail set: a scout that returns the same
    // comune page twice would file the same report twice.
    const fingerprint=`${host(source.url)}|${notice.category}|${matched.map(trail=>trail.id).sort().join(',')}`;
    if(seen.has(fingerprint)){drop(notice,'duplicate-notice');continue;}
    seen.add(fingerprint);
    kept.push({trails:matched,category:notice.category,description,source,
      startsOn:isoDateOrNull(notice.startsOn),endsOn:isoDateOrNull(notice.endsOn)});
  }
  return {notices:kept,dropped};
}

function prompt(area,trails){
  return [
    {role:'developer',content:[
      'You are the ORMA Closure Scout. ORMA publishes dog-walking routes, and a walk that is shut, damaged or restricted has to say so before somebody drives to the trailhead.',
      'Search the authorities that actually publish restrictions for this area: the comune or municipality, the park or protected-area authority, provincial or departmental forestry and roads services, protezione civile or mountain rescue bulletins, CAI and alpine club route updates, and rifugio and lift operator pages. Prefer official and recent pages over news and forums.',
      'Report only a restriction that is in force now or starts shortly, and only one an authority has published. Every notice must cite a page you actually retrieved, with a real URL, the publisher, and a short verbatim quote in the page’s own language. Never cite a page you did not open and never paraphrase a quote.',
      'Each trail below is printed with an id such as T1. Name the affected trails by those ids, exactly as printed. Never invent an id, and never answer with a trail name in their place. If a notice affects a path that is not on the list, leave it out: it is not a walk ORMA publishes.',
      'Give endsOn only when the notice states when the restriction ends. Most do not, and a guessed end date would take a warning down while the path is still shut.',
      'Finding nothing is a normal and frequent result. Return an empty list and say which authorities you checked. Do not pad the answer with general seasonal advice, weather, or a restriction you are only inferring: those are published by other parts of ORMA and a false closure costs a reader their day out.',
    ].join('\n')},
    {role:'user',content:[
      `Area: ${area}`,
      '',
      'Trails ORMA publishes here, with the id to use for each:',
      ...ballot(trails).map(({id,trail})=>{
        const reference=trail.routeReference?` · route ${trail.routeReference}`:'';
        const where=[trail.valley,trail.area].filter(Boolean).join(', ');
        return `- ${id} ${trail.name||trail.id}${reference}${where?` · ${where}`:''}`;
      }),
    ].join('\n')},
  ];
}

/** One area, scouted. Returns what to file; never writes and never publishes. */
async function scoutAreaClosures(area,trails,options={}){
  if(!area)throw new Error('An area is required to scout it');
  if(!(trails||[]).length)throw new Error('Scouting an area needs the trails ORMA publishes in it');
  const runAgent=options.runAgent||createStructuredResponse;
  const response=await runAgent({schemaName:'orma_area_closure_scout',schema:SCOUT_SCHEMA,webSearch:true,
    messages:prompt(area,trails)},options.clientOptions||{});
  const reviewed=reviewNotices(response.data?.notices,trails);
  return {contractVersion:'1.0.0',area,scoutedAt:options.at||new Date().toISOString(),
    trailsAsked:ballot(trails).length,
    searched:String(response.data?.searched||'').trim().slice(0,600),
    notices:reviewed.notices,dropped:reviewed.dropped,
    model:response.model||null,responseId:response.responseId||null,
    publicMutationAllowed:false};
}

/**
 * A scouted notice as pending hazard reports -- one per affected trail, because
 * the Hazard Analyst vets one trail at a time and a notice covering four paths
 * is four different questions about four different routes.
 *
 * The id is derived from the notice rather than random, so the same notice found
 * again tomorrow is the same document and is not filed twice.
 */
function hazardReportsFromNotices(result,options={}){
  const at=options.at||result.scoutedAt||new Date().toISOString();
  return (result.notices||[]).flatMap(notice=>notice.trails.map(trail=>({
    id: `scout-${slug(result.area)}-${slug(trail.id)}-${slug(notice.category)}-${slug(host(notice.source.url))}`,
    status:'pending',
    // Provenance travels with the report. The lane was built for a hiker's
    // report and says so to the reader; an official notice ORMA found is a
    // different claim and must not be published as somebody's sighting.
    reportedBy:'orma-closure-scout',
    trailId:trail.id,trailName:trail.name||trail.id,
    area:result.area,category:notice.category,description:notice.description,
    observedOn:notice.startsOn||null,statedEndsOn:notice.endsOn||null,
    scoutedSource:notice.source,
    createdAt:at,
  })));
}

function slug(value){
  return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48);
}

/**
 * Which area to scout next: the one whose last pass is oldest, so a fixed
 * per-run budget rotates over all of them rather than re-reading one.
 */
function nextAreasToScout(trails,history,options={}){
  const limit=Number.isInteger(options.limit)&&options.limit>0?options.limit:1;
  const scoutedAt=new Map(((history||{}).areas||[]).map(entry=>[String(entry.area),entry.scoutedAt||'']));
  const areas=new Map();
  for(const trail of trails||[]){
    const area=scoutingArea(trail);
    if(!area)continue;
    if(!areas.has(area))areas.set(area,[]);
    areas.get(area).push(trail);
  }
  return [...areas.entries()]
    .map(([area,members])=>({area,trails:members,scoutedAt:scoutedAt.get(area)||''}))
    .sort((a,b)=>String(a.scoutedAt).localeCompare(String(b.scoutedAt))||a.area.localeCompare(b.area))
    .slice(0,limit);
}

/** The unit a closure notice is published for: a valley, else the province. */
function scoutingArea(trail){
  return trail?.valley||trail?.area||trail?.province||null;
}

function mergeScoutingHistory(existing,result,options={}){
  const limit=Number.isInteger(options.limit)&&options.limit>0?options.limit:60;
  const areas=[{area:result.area,scoutedAt:result.scoutedAt,found:(result.notices||[]).length,
    dropped:(result.dropped||[]).length,searched:result.searched||''},
    ...((existing?.areas||[]).filter(entry=>String(entry.area)!==String(result.area)))].slice(0,limit);
  return {contractVersion:'1.0.0',artifactId:'closure-scouting',generatedAt:result.scoutedAt,
    areas,publicMutationAllowed:false};
}

module.exports={SCOUT_SCHEMA,CATEGORIES,MAX_NOTICES,MAX_TRAILS_ASKED,
  ballot,reviewNotices,prompt,scoutAreaClosures,hazardReportsFromNotices,
  nextAreasToScout,scoutingArea,mergeScoutingHistory,slug,host};
