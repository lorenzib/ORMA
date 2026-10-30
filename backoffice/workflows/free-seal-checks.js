'use strict';

const fs=require('fs');
const path=require('path');
const {runQuery,USER_AGENT,DEFAULT_ENDPOINTS}=require('../services/osm-relation-client');
const {lineSamples,lineLengthKm,metresFromLine,LINE_TOLERANCE_SHARE,PHOTO_MAX_OFF_LINE_M}=require('./research-methods');

/**
 * The checks behind the seal that need nobody to read a page.
 *
 * Four of the six methods that verify a walk by hand are measurements, not
 * research: which municipalities the line crosses, which protected areas it
 * touches, whether it is as long as the walk its authority describes, and
 * where its photograph was taken. Each comes from a free public service --
 * OpenStreetMap's administrative boundaries, the EEA's Natura 2000 data, the
 * photo host's own location -- and costs no model call.
 *
 * They are run for every catalogue trail by `npm run backoffice:free-checks`
 * and written to `data/free-seal-checks.json`. A person verifying by hand
 * starts from that file instead of re-measuring, the agents are handed it as
 * a lead, and the seal accepts what it established (research-methods.js).
 * The badge itself is still given by hand: the climb, the time, the dog rules
 * and the six safety checks need somebody to read an authority's page.
 */

const FREE_CHECKS_VERSION='free-seal-checks-v1';
const FREE_CHECKS_FILE=path.join('data','free-seal-checks.json');

const NATURA2000_QUERY='https://bio.discomap.eea.europa.eu/arcgis/rest/services/ProtectedSites/Natura2000Sites/MapServer/2/query';
const NATURA2000_VIEWER='https://natura2000.eea.europa.eu/';

// A site that is certainly protected, asked about on every run. If it does not
// come back, an empty answer elsewhere is the service failing, not a line with
// no protected area on it -- and is recorded as unchecked.
const NATURA2000_CONTROL=Object.freeze({code:'IT3110049',name:'Parco Naturale Fanes - Senes - Braies',
  path:[[46.6990,12.0820],[46.6960,12.0853],[46.6930,12.0880]]});

// Enough points to follow a walk; the service takes the line in one request.
const MAX_LINE_POINTS=400;
// How long to wait for one answer before trying elsewhere or giving up.
const OVERPASS_WAIT_MS=75000;
const FETCH_WAIT_MS=45000;

function thinned(points,maximum=MAX_LINE_POINTS){
  if(points.length<=maximum)return points;
  const step=(points.length-1)/(maximum-1);
  return Array.from({length:maximum},(_,i)=>points[Math.round(i*step)]);
}

function usable(trailPath){
  return (Array.isArray(trailPath)?trailPath:[]).filter(point=>Array.isArray(point)
    &&Number.isFinite(point[0])&&Number.isFinite(point[1]));
}

/** The Overpass query for the municipalities (admin level 8) under each sample. */
function communesQuery(samples){
  const lookups=samples.map(sample=>`is_in(${sample.lat.toFixed(6)},${sample.lng.toFixed(6)});`).join('');
  return `[out:json][timeout:60];(${lookups})->.a;area.a[boundary=administrative][admin_level=8];out tags;`;
}

/**
 * Every municipality the line crosses, asked at points along the whole of it.
 * Admin level 8 is the comune in Italy and the commune in France.
 */
async function communesAlongLine(trailPath,options={}){
  const samples=lineSamples(trailPath);
  if(!samples.length)return {status:'no-line',communes:[]};
  // Asked of one mirror at a time. Every point in Italy and France lies in a
  // municipality, so an empty answer is a mirror without the boundary data --
  // overpass.kumi.systems answered that way on 23 October 2026 -- and never a
  // walk that crosses none. It moves on rather than recording "none".
  const query=options.runQuery||runQuery;
  // The query asks the server for 60 seconds; waiting the client default of
  // three minutes on each of eight tries stalled a trail for eight minutes on
  // 26 October 2026 and ran the weekly job out of time.
  const timeoutMs=options.timeoutMs||OVERPASS_WAIT_MS;
  const errors=[];let answer=null;
  const endpoints=options.endpoints||DEFAULT_ENDPOINTS;
  // Twice round, because a busy mirror answering 502 one minute usually
  // answers the next.
  for(const [round,endpoint] of [...endpoints,...endpoints].entries()){
    if(round===endpoints.length&&options.retryPauseMs!==0)await new Promise(resolve=>setTimeout(resolve,options.retryPauseMs||15000));
    try{
      const result=await query(communesQuery(samples),{...options,timeoutMs,endpoints:[endpoint]},'Unable to look up municipalities');
      if((result.payload?.elements||[]).some(element=>element.tags?.name)){answer=result;break;}
      errors.push(`${new URL(endpoint).host} returned no municipality`);
    }catch(error){errors.push(String(error.message||error));}
  }
  if(!answer)throw new Error(`No mirror named a municipality: ${errors.join('; ')}`);
  const {payload,endpoint}=answer;
  const seen=new Map();
  for(const element of payload?.elements||[]){
    const tags=element.tags||{};
    if(!tags.name||seen.has(element.id))continue;
    seen.set(element.id,{name:tags.name,
      ...(tags['name:it']||tags['name:de']||tags['name:fr']?{names:Object.fromEntries(['it','de','fr']
        .filter(lang=>tags[`name:${lang}`]).map(lang=>[lang,tags[`name:${lang}`]]))}:{}),
      osmArea:element.id});
  }
  return {status:'checked',communes:[...seen.values()].sort((a,b)=>a.name.localeCompare(b.name)),
    samples:samples.length,
    source:{label:'OpenStreetMap administrative boundaries (admin level 8)',url:endpoint,
      authority:'OpenStreetMap contributors',licence:'ODbL-1.0'}};
}

/** A fetch that gives up, so one silent server cannot hold the whole run. */
function patientFetch(options={}){
  const fetchImpl=options.fetchImpl||((...args)=>globalThis.fetch(...args));
  return (url,init={})=>fetchImpl(url,{...init,signal:AbortSignal.timeout(options.fetchTimeoutMs||FETCH_WAIT_MS)});
}

async function natura2000Sites(trailPath,options={}){
  const fetchImpl=patientFetch(options);
  const geometry={paths:[thinned(usable(trailPath)).map(([lat,lng])=>[lng,lat])],spatialReference:{wkid:4326}};
  const body=new URLSearchParams({geometry:JSON.stringify(geometry),geometryType:'esriGeometryPolyline',inSR:'4326',
    spatialRel:'esriSpatialRelIntersects',outFields:'SITECODE,SITENAME',returnGeometry:'false',f:'json'});
  const response=await fetchImpl(NATURA2000_QUERY,{method:'POST',body,
    headers:{'content-type':'application/x-www-form-urlencoded','user-agent':USER_AGENT}});
  if(!response.ok)throw new Error(`EEA Natura 2000 returned HTTP ${response.status}`);
  const data=await response.json();
  if(data?.error)throw new Error(`EEA Natura 2000 refused the query: ${data.error.message||'unknown error'}`);
  const sites=new Map();
  for(const feature of data?.features||[]){
    const {SITECODE:code,SITENAME:name}=feature.attributes||{};
    if(code)sites.set(code,{code,name:name||null});
  }
  return [...sites.values()].sort((a,b)=>a.code.localeCompare(b.code));
}

/**
 * The Natura 2000 sites the line touches, with the control site asked first.
 * `options.control` carries a control already run this pass, so a run of 163
 * trails asks it once.
 */
async function protectedAreasOnLine(trailPath,options={}){
  if(usable(trailPath).length<2)return {status:'no-line',sites:[]};
  const control=options.control||await natura2000Control(options);
  if(!control.found)return {status:'service-unreliable',sites:[],control};
  return {status:'checked',sites:await natura2000Sites(trailPath,options),control,
    source:{label:'EEA Natura 2000 sites (Habitats and Birds Directives)',url:NATURA2000_VIEWER,
      query:NATURA2000_QUERY,authority:'European Environment Agency'}};
}

async function natura2000Control(options={}){
  const found=(await natura2000Sites(NATURA2000_CONTROL.path,options))
    .some(site=>site.code===NATURA2000_CONTROL.code);
  return {code:NATURA2000_CONTROL.code,name:NATURA2000_CONTROL.name,found};
}

/**
 * Where the photograph was taken, from the host that published it. Hosts that
 * need a key (Mapillary) are not asked, and say so.
 */
async function photoLocation(trail,options={}){
  const page=String(trail?.imageSourcePage||'');
  if(!trail?.heroImage&&!trail?.imageIcon)return {status:'no-photo'};
  if(trail?.imageGeotag)return {status:'located',geotag:trail.imageGeotag,from:'photo-ledger'};
  const fetchImpl=patientFetch(options);
  const getJson=async url=>{
    const response=await fetchImpl(url,{headers:{'user-agent':USER_AGENT}});
    if(!response.ok)throw new Error(`HTTP ${response.status} from ${new URL(url).host}`);
    return response.json();
  };
  const at=(lat,lng,from)=>Number.isFinite(lat)&&Number.isFinite(lng)
    ?{status:'located',geotag:{lat,lng},from}:{status:'no-location',from};
  let match;
  if((match=/commons\.wikimedia\.org\/wiki\/(File:[^?#]+)/.exec(page))){
    const title=decodeURIComponent(match[1]);
    const data=await getJson(`https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=coordinates&coprimary=all&titles=${encodeURIComponent(title)}`);
    const coordinates=data?.query?.pages?.[0]?.coordinates||[];
    // The camera position is the primary coordinate; an object location is not
    // where the photograph was taken from.
    const camera=coordinates.find(point=>point.primary!==undefined)||coordinates[0];
    return at(camera?.lat,camera?.lon,'wikimedia-commons');
  }
  if((match=/panoramax[^/]*\/api\/collections\/[^/]+\/items\/[^/?#]+/.exec(page))){
    const data=await getJson(page);
    const [lng,lat]=data?.geometry?.coordinates||[];
    return at(lat,lng,'panoramax');
  }
  if((match=/inaturalist\.org\/observations\/(\d+)/.exec(page))){
    const data=await getJson(`https://api.inaturalist.org/v1/observations/${match[1]}`);
    const [lng,lat]=data?.results?.[0]?.geojson?.coordinates||[];
    return at(lat,lng,'inaturalist');
  }
  if(/flickr\.com\/photos\//.test(page)){
    const response=await fetchImpl(page,{headers:{'user-agent':USER_AGENT}});
    if(!response.ok)throw new Error(`HTTP ${response.status} from flickr`);
    const html=await response.text();
    const lat=Number(/"latitude":\s*(-?\d+(?:\.\d+)?)/.exec(html)?.[1]);
    const lng=Number(/"longitude":\s*(-?\d+(?:\.\d+)?)/.exec(html)?.[1]);
    return at(lat||NaN,lng||NaN,'flickr');
  }
  return {status:'host-not-supported',from:page?new URL(page).host:null};
}

/**
 * The distance an authority publishes, where ORMA has recorded its page and
 * the quoted line names exactly one distance. Two figures in one quote (a
 * walk and a variant, say) are not guessed between.
 */
function officialDistanceFromSource(source){
  const quote=String(source?.quote||'');
  const values=[...new Set([...quote.matchAll(/(\d+(?:[.,]\d+)?)\s*km\b/gi)]
    .map(match=>Number(match[1].replace(',','.'))).filter(value=>value>0))];
  if(values.length!==1)return null;
  return {km:values[0],source:{url:source.url,authority:source.publisher||null,quote}};
}

function lineAgainstOfficial(trail,routeSource){
  const lineKm=lineLengthKm(trail?.path);
  const official=officialDistanceFromSource(routeSource);
  if(!Number.isFinite(lineKm))return {status:'no-line'};
  const rounded=Math.round(lineKm*100)/100;
  if(!official)return {status:'no-published-distance',lineKm:rounded};
  const candidates=trail?.routeShape==='out-and-back'?[lineKm,lineKm*2]:[lineKm];
  const within=candidates.some(km=>Math.abs(km-official.km)/official.km<=LINE_TOLERANCE_SHARE);
  return {status:within?'matches':'differs',lineKm:rounded,officialKm:official.km,
    deltaPercent:Math.round(((lineKm-official.km)/official.km)*1000)/10,source:official.source};
}

/** One step that failed is recorded as failed; it never stops the others. */
async function attempt(step){
  try{return await step();}catch(error){return {status:'lookup-failed',error:String(error.message||error)};}
}

async function freeSealChecksFor(trail,options={}){
  const communes=await attempt(()=>communesAlongLine(trail.path,options));
  const protectedAreas=await attempt(()=>protectedAreasOnLine(trail.path,options));
  const photo=await attempt(()=>photoLocation(trail,options));
  if(photo.status==='located'){
    const off=metresFromLine(photo.geotag,trail.path);
    if(Number.isFinite(off)){
      photo.metresFromLine=Math.round(off);
      photo.onTheWalk=off<=PHOTO_MAX_OFF_LINE_M;
    }
  }
  return {checkedAt:options.at||new Date().toISOString(),communes,protectedAreas,
    line:lineAgainstOfficial(trail,options.routeSource),photo};
}

/** What a person should look at, in a sentence each. Empty when nothing needs a look. */
function problemsIn(entry){
  const problems=[];
  if(entry?.line?.status==='differs')problems.push(`the line is ${entry.line.lineKm} km and the official page says ${entry.line.officialKm} km (${entry.line.deltaPercent}%)`);
  if(entry?.photo?.onTheWalk===false)problems.push(`the photograph was taken ${(entry.photo.metresFromLine/1000).toFixed(1)} km from the walk`);
  if((entry?.communes?.communes||[]).length>1)problems.push(`the line crosses ${entry.communes.communes.length} municipalities: ${entry.communes.communes.map(c=>c.name).join(', ')}`);
  for(const [name,step] of Object.entries(entry||{})){
    if(step?.status==='lookup-failed')problems.push(`the ${name} lookup failed: ${step.error}`);
  }
  return problems;
}

function loadFreeSealChecks(root=path.resolve(__dirname,'../..')){
  try{return JSON.parse(fs.readFileSync(path.join(root,FREE_CHECKS_FILE),'utf8'));}
  catch(error){return null;}
}

function freeChecksFor(artifact,trailId){
  return artifact?.trails?.[String(trailId)]||null;
}

module.exports={FREE_CHECKS_VERSION,FREE_CHECKS_FILE,OVERPASS_WAIT_MS,FETCH_WAIT_MS,NATURA2000_QUERY,NATURA2000_CONTROL,MAX_LINE_POINTS,
  thinned,communesQuery,communesAlongLine,natura2000Sites,natura2000Control,protectedAreasOnLine,photoLocation,
  officialDistanceFromSource,lineAgainstOfficial,freeSealChecksFor,problemsIn,loadFreeSealChecks,freeChecksFor};
