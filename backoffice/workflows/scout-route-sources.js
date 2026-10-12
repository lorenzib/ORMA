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

const zlib=require('zlib');
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

// An official route sheet is very often a PDF -- an alpine club's magazine, a
// comune's trail leaflet. 18 of the 60 finds in the first Dolomites sweep were
// refused as `quote-is-not-on-the-page` and several of those were PDFs whose
// text this could not read at all, so a perfectly good authority was being
// thrown away for the wrong reason.
//
// Deliberately minimal, and deliberately conservative. It inflates the
// FlateDecode content streams a standard PDF writer produces and takes the
// strings the text operators draw. It does not implement font encodings,
// CID maps, encryption or OCR, and it is not meant to: when it cannot read a
// document it returns nothing, the quote does not match, and the find is
// refused exactly as before. The failure mode is a source ORMA declines to
// use, never a source it wrongly accepts.
const PDF_STREAM=/stream\r?\n?([\s\S]*?)endstream/g;

function inflate(chunk){
  const bytes=Buffer.from(chunk,'latin1');
  for(const attempt of [zlib.inflateSync,zlib.inflateRawSync]){
    try{return attempt(bytes).toString('latin1');}catch(error){/* not this encoding */}
  }
  return '';
}

/** A PDF string literal's escapes, resolved the way the spec defines them. */
function pdfLiteral(raw){
  return String(raw)
    .replace(/\\([nrtbf])/g,(match,code)=>({n:'\n',r:'\r',t:'\t',b:'',f:''})[code])
    .replace(/\\([0-7]{1,3})/g,(match,octal)=>String.fromCharCode(Number.parseInt(octal,8)))
    .replace(/\\(.)/g,'$1');
}

function pdfHexString(raw){
  const hex=String(raw).replace(/[^0-9a-f]/gi,'');
  let out='';
  for(let i=0;i+1<hex.length;i+=2)out+=String.fromCharCode(Number.parseInt(hex.slice(i,i+2),16));
  return out;
}

/**
 * The text a PDF draws, as two readings.
 *
 * A writer splits a line into separate drawn strings, sometimes per word and
 * sometimes mid-word for kerning. Joining with spaces reads the first correctly
 * and breaks words in the second; joining with nothing does the reverse. Both
 * are returned and a quote matching either is accepted, because either is a
 * true reading of what the page draws -- and the quote has to be at least
 * MIN_QUOTE characters of the agent's own text, so an accidental match across a
 * fragment boundary is not a realistic way to pass this.
 */
function pdfText(buffer){
  const raw=Buffer.isBuffer(buffer)?buffer.toString('latin1'):String(buffer||'');
  if(!/^%PDF-/.test(raw.slice(0,8)))return {spaced:'',tight:''};
  const pieces=[];
  for(const match of raw.matchAll(PDF_STREAM)){
    const content=/[\x00-\x08\x0e-\x1f]/.test(match[1].slice(0,64))?inflate(match[1]):match[1];
    if(!content||!/(?:Tj|TJ|'|")/.test(content))continue;
    for(const token of content.matchAll(/\((?:\\.|[^\\()])*\)|<[0-9a-fA-F\s]+>/g)){
      const text=token[0].startsWith('(')
        ?pdfLiteral(token[0].slice(1,-1))
        :pdfHexString(token[0].slice(1,-1));
      if(text.trim())pieces.push(text);
    }
  }
  return {
    spaced:pieces.join(' ').replace(/\s+/g,' ').trim(),
    tight:pieces.join('').replace(/\s+/g,' ').trim(),
  };
}

function looksLikePdf(body,contentType){
  if(/application\/pdf/i.test(String(contentType||'')))return true;
  const head=Buffer.isBuffer(body)?body.slice(0,8).toString('latin1'):String(body||'').slice(0,8);
  return /^%PDF-/.test(head);
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

function quoteIsInPage(quote,body,contentType){
  const needle=normalise(quote);
  if(needle.length<MIN_QUOTE)return false;
  if(looksLikePdf(body,contentType)){
    const {spaced,tight}=pdfText(body);
    if(normalise(spaced).includes(needle))return true;
    // The same comparison with every space removed from both sides, for a
    // writer that split the line mid-word.
    const squeeze=text=>normalise(text).replace(/ /g,'');
    return squeeze(tight).includes(squeeze(quote))||squeeze(spaced).includes(squeeze(quote));
  }
  return normalise(readableText(body)).includes(needle);
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
  if(!quoteIsInPage(quote,page.body,page.contentType))return reject('quote-is-not-on-the-page');
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
  host,readableText,normalise,quoteIsInPage,pdfText,looksLikePdf,pdfLiteral,pdfHexString,confirmProposal,prompt,
  scoutRouteSource,mergeSourcedPages};
