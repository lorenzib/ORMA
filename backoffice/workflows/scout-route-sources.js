'use strict';

/**
 * Find the official page that describes a walk, so its route claims can cite
 * something.
 *
 * The four route claims are unwaivable and each needs a sourced supported
 * proposal. An OSM relation records that a path exists, not how to walk it, so
 * a trail whose only source is its relation can never be verified -- 105 of 162
 * on 12 October. The audit that day confirmed ORMA holds nothing further: the
 * `website` tag covers 51 of 148 route features, #729 recovered the 21 that
 * were being discarded, and the two remaining http pages are dead. The rest
 * have to be found on the web.
 *
 * Nobody reviews what this returns, and that is the point of the design: the
 * agent must quote the page, and the quote is then checked against the page
 * actually fetched. A find whose quote is not in the page it cites is dropped.
 * That is mechanical proof the page exists and says what the agent claims,
 * which is the one thing a reviewer would have been checking by hand.
 *
 * It proposes; `confirmProposal` decides. Nothing here writes.
 */

const {createStructuredResponse}=require('../services/openai-responses-client');

const MAX_QUOTE=300;
const MIN_QUOTE=24;
// Not a route authority. A relation is where ORMA's line came from, and an
// aggregator republishes somebody else's description without signing it.
const NOT_AN_AUTHORITY=/waymarkedtrails|openstreetmap|wikiloc|alltrails|komoot|outdooractive|gpsies|tripadvisor|strava|mapy\.cz|openrouteservice/i;

const SCOUT_SCHEMA={type:'object',additionalProperties:false,properties:{
  found:{type:'boolean',description:'Whether an official page describing this specific walk was actually retrieved.'},
  url:{type:['string','null'],description:'The page that describes this walk. Null when none was found.'},
  publisher:{type:['string','null'],description:'Who publishes it: the comune, park, tourism board, alpine club or operator.'},
  name:{type:['string','null'],description:'The page’s own title for the route.'},
  quote:{type:['string','null'],description:'A verbatim sentence from the page, in the page’s own language, that shows it describes this walk. Copied exactly, never paraphrased.'},
  describesRoute:{type:'boolean',description:'True only when the page describes the route itself -- its course, start, waypoints or directions -- rather than merely mentioning the area.'},
  searched:{type:'string',description:'Which authorities you checked, so a trail with no page is distinguishable from one nobody looked for.'},
},required:['found','url','publisher','name','quote','describesRoute','searched']};

function host(url){
  try{return new URL(String(url)).hostname.replace(/^www\./,'').toLowerCase();}catch(error){return '';}
}

/** Page text reduced to something a quote can be matched against. */
function readableText(html){
  return String(html||'')
    .replace(/<script\b[\s\S]*?<\/script>/gi,' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/\s+/g,' ')
    .trim();
}

/**
 * Quote matching that tolerates typography and nothing else.
 *
 * Case, whitespace and the quote/dash characters a CMS rewrites are normalised,
 * because those differ between what a model reads and what the raw HTML holds.
 * Accents are kept: "Lac Vert" and "Lac Vèrt" are not the same page.
 */
function normalise(text){
  return String(text||'').toLowerCase()
    .replace(/[‘’‚‛′]/g,"'")
    .replace(/[“”„‟″]/g,'"')
    .replace(/[‐-―−]/g,'-')
    .replace(/\s+/g,' ')
    .trim();
}

function quoteIsInPage(quote,html){
  const needle=normalise(quote);
  if(needle.length<MIN_QUOTE)return false;
  return normalise(readableText(html)).includes(needle);
}

/**
 * What survives of a find, and why the rest did not.
 *
 * Every rule here is mechanical. None of them is a judgement a person would
 * have to make, which is what lets a confirmed find be applied without review.
 */
function confirmProposal(proposal,trail,page){
  const reject=rule=>({confirmed:false,rule});
  if(!proposal||proposal.found!==true)return reject('no-page-found');
  const url=String(proposal.url||'').trim();
  if(!/^https:\/\//.test(url))return reject('not-an-https-page');
  if(NOT_AN_AUTHORITY.test(url))return reject('not-a-route-authority');
  if(proposal.describesRoute!==true)return reject('page-does-not-describe-the-route');
  const quote=String(proposal.quote||'').trim().slice(0,MAX_QUOTE);
  if(quote.length<MIN_QUOTE)return reject('quote-too-short-to-prove-anything');
  // The page as fetched, not as remembered. This is the check that replaces a
  // reviewer: a page that cannot be retrieved, or that does not contain the
  // sentence the agent copied from it, is not evidence.
  if(!page||page.ok!==true)return reject('page-could-not-be-retrieved');
  if(!quoteIsInPage(quote,page.body))return reject('quote-is-not-on-the-page');
  return {confirmed:true,source:{
    url,publisher:String(proposal.publisher||'').trim()||host(url),
    name:String(proposal.name||'').trim()||trail?.name||null,
    quote,trailId:String(trail?.id||''),
  }};
}

function prompt(trail){
  const refs=(trail.routeRefs||[]).filter(Boolean);
  return [
    {role:'developer',content:[
      'You are the ORMA Route Source Scout. ORMA publishes dog-walking routes and needs, for one specific walk, the official page that describes it. Without one the walk cannot be verified, because the directions a reader follows have to be cited to whoever published them.',
      'Search the authorities that publish route descriptions for this area: the comune or municipality, the park or protected-area authority, provincial and regional tourism boards, forestry services, CAI and alpine club route sheets, and the rifugio or lift operator where the route depends on one.',
      'The page must describe this route -- its course, its start, its waypoints or its directions. A page that merely mentions the valley, lists accommodation, or advertises the area is not it. Neither is a map, a GPX download on its own, or a user-contributed track: OpenStreetMap, Waymarked Trails, Wikiloc, AllTrails, Komoot and Outdooractive are not route authorities, whatever they contain.',
      'Return a verbatim sentence from the page, in the page’s own language, copied exactly. It is checked against the page afterwards, so a remembered or tidied-up sentence fails and the find is thrown away. Choose a sentence that shows the page is about this walk.',
      'Finding nothing is a normal and frequent answer. Many walks have never been published by anybody. Return found false and say which authorities you checked. Do not offer an aggregator, a search-results page or the area’s homepage instead of admitting there is none: a wrong page costs a reader their day out.',
    ].join('\n')},
    {role:'user',content:[
      `Walk: ${trail.name||trail.id}`,
      `Where: ${[trail.valley,trail.area,trail.province,trail.region].filter(Boolean).join(' · ')||'unstated'}`,
      refs.length?`Route number(s) signed on the ground: ${refs.join(', ')}`:'No route number is recorded.',
      trail.startPoint?.label?`Recorded start: ${trail.startPoint.label}`:null,
      trail.distance?`About ${trail.distance} km`:null,
      trail.desc?`ORMA’s own description: ${String(trail.desc).slice(0,400)}`:null,
      trail.waymarkedtrails?`The OpenStreetMap relation, for identifying the path only, never as the source: ${trail.waymarkedtrails}`:null,
    ].filter(value=>value!==null).join('\n')},
  ];
}

/** One trail, scouted. Returns the proposal; the caller fetches and confirms. */
async function scoutRouteSource(trail,options={}){
  if(!trail||!trail.id)throw new Error('A trail is required to scout a source for it');
  const runAgent=options.runAgent||createStructuredResponse;
  const response=await runAgent({schemaName:'orma_route_source_scout',schema:SCOUT_SCHEMA,webSearch:true,
    messages:prompt(trail)},options.clientOptions||{});
  return {trailId:String(trail.id),proposal:response.data||null,
    model:response.model||null,responseId:response.responseId||null};
}

/** The stored file the build reads. Sorted, so a commit diff is readable. */
function mergeSourcedPages(existing,confirmed,options={}){
  const sources={...(existing?.sources||{})};
  for(const source of confirmed||[]){
    if(!source?.trailId||!source?.url)continue;
    sources[source.trailId]={url:source.url,publisher:source.publisher||null,
      name:source.name||null,quote:source.quote||null,
      foundBy:'orma-route-source-scout',verifiedAt:options.at||new Date().toISOString()};
  }
  return {contractVersion:'1.0.0',
    generatedAt:options.at||new Date().toISOString(),
    sources:Object.fromEntries(Object.entries(sources).sort(([a],[b])=>a.localeCompare(b)))};
}

module.exports={SCOUT_SCHEMA,NOT_AN_AUTHORITY,MIN_QUOTE,MAX_QUOTE,
  host,readableText,normalise,quoteIsInPage,confirmProposal,prompt,
  scoutRouteSource,mergeSourcedPages};
