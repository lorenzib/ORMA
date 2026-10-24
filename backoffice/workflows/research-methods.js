'use strict';

/**
 * The research methods that verify a walk by hand, as rules the seal enforces.
 *
 * Paid research went off on 22 October 2026 and verification moved into
 * Claude sessions, reading official sources by hand. That work graduated
 * trails the agents had not, and it found what the agents had published wrong:
 * a climb ORMA had measured from its own line and called the walk's, a
 * municipality read off the start point of a loop that crosses two, a
 * photograph taken several kilometres from the walk. These are the methods
 * that found them, written down so that the agents -- when research is
 * switched back on -- are held to the same answer a person reached.
 *
 * Each rule holds the **seal**, not the route. A walk whose directions are
 * settled is still published as reviewed; it is not called ORMA Verified while
 * any rule here stands against it. That is the `heldFor` list graduationFor
 * already keeps for access and livestock, and these go in the same list.
 *
 * Everything here is pure: it reads the facts the dossier locked and the
 * catalogue record, and spends nothing.
 */

// The three figures an authority publishes for a walk, each as a number in a
// stated unit. A figure ORMA measured from its own line, or a time it
// estimated from that, is not one of them -- however close it may be.
const OFFICIAL_FIGURES=Object.freeze({
  'official-distance':{unit:'km',label:'distance'},
  'official-ascent':{unit:'m',label:'climb'},
  'official-walking-time':{unit:'minutes',label:'walking time'},
});
const OFFICIAL_FIGURE_CLAIM_IDS=Object.freeze(Object.keys(OFFICIAL_FIGURES));

// One claim per municipality the line crosses, and one dog rule per
// municipality. The municipality goes in `entityName`; the id carries it too
// so each is its own claim on the resolution ladder.
const COMMUNE_CLAIM_PREFIX='commune-on-line';
const COMMUNE_DOG_RULE_PREFIX='commune-dog-rule';
const PROTECTED_AREAS_CLAIM='protected-areas';

// What a figure or a rule rests on. `published` is the only basis that
// verifies a figure; `national-default` is the only other basis a dog rule may
// have, and only in Italy.
const BASES=Object.freeze(['published','measured','estimated','national-default']);

// Italy's dog rule where a commune publishes none: the Ministry of Health
// ordinance of 6 August 2013, renewed since. Settled on 23 October 2026 as the
// answer for an Italian commune with no rule of its own, provided the line was
// also checked against protected areas -- and the record says so in these words.
const NATIONAL_DOG_DEFAULT=Object.freeze({
  country:'IT',
  statement:'No municipal dog rule is published; the national ordinance of 6 August 2013 applies: '
    +'a dog on a lead no longer than 1.5 m, with a muzzle carried.',
});

// How far a line may differ from the distance its authority publishes before
// the line is taken to be incomplete (or to include something that is not the
// walk). The same ten per cent the cartographer applies to its own reference.
const LINE_TOLERANCE_SHARE=0.10;

// How far from the walk a photograph may be taken and still be a picture of it.
// The hand audit found covers 0.4 to 10 km off; a view across a valley floor
// to the walk is within a kilometre, a different village is not.
const PHOTO_MAX_OFF_LINE_M=1000;

// Samples along a line for reverse-geocoding: the start, the end, the point
// farthest from the start (so a loop's far side is always asked about), and
// one every kilometre between.
const SAMPLE_EVERY_KM=1;

// Not authorities on a walk's figures: the map the line came from, a hiking
// aggregator, or ORMA itself.
const NOT_AN_AUTHORITY=/waymarkedtrails|openstreetmap\.org|osm\.org|overpass|wikiloc|alltrails|komoot|outdooractive\.com\/(?:en|de|it|fr)\/route|app-orma\.com|dolopaws/i;

// The European Environment Agency's Natura 2000 viewer and data are where the
// protected-area check is run, so a protected-area answer must cite them.
const EEA_SOURCE=/(?:^|\/\/|\.)eea\.europa\.eu\/|natura2000/i;

const COUNTRY_BY_REGION=Object.freeze({dolomites:'IT',savoy:'FR'});

function normalisedPlace(value){
  return String(value||'').normalize('NFD').replace(/[̀-ͯ]/g,'')
    .toLowerCase().replace(/\b(?:comune di|commune de|gemeinde|municipality of)\b/g,' ')
    .replace(/[^a-z0-9/]+/g,' ').trim();
}

/** Every name a bilingual place answers to: "Villabassa / Niederdorf" is both. */
function placeNames(value){
  return normalisedPlace(value).split('/').map(part=>part.trim()).filter(Boolean);
}

function samePlace(a,b){
  const left=placeNames(a),right=placeNames(b);
  return left.some(name=>right.includes(name));
}

function countryOf(trail){
  if(!trail)return null;
  if(trail.country)return String(trail.country).toUpperCase();
  return COUNTRY_BY_REGION[String(trail.region||'').toLowerCase()]||null;
}

function metresBetween(a,b){
  const radians=Math.PI/180;
  const dLat=(b[0]-a[0])*radians,dLng=(b[1]-a[1])*radians;
  const chord=Math.sin(dLat/2)**2+Math.cos(a[0]*radians)*Math.cos(b[0]*radians)*Math.sin(dLng/2)**2;
  return 2*6371000*Math.asin(Math.sqrt(chord));
}

/** A site path is [lat, lng] pairs. */
function usablePath(path){
  return Array.isArray(path)?path.filter(point=>Array.isArray(point)
    &&Number.isFinite(point[0])&&Number.isFinite(point[1])):[];
}

function lineLengthKm(path){
  const points=usablePath(path);
  let metres=0;
  for(let i=1;i<points.length;i+=1)metres+=metresBetween(points[i-1],points[i]);
  return points.length>1?metres/1000:null;
}

/** Shortest distance in metres from a point to a polyline, on a local flat projection. */
function metresFromLine(point,path){
  const points=usablePath(path);
  if(!points.length||!Number.isFinite(point?.lat)||!Number.isFinite(point?.lng))return null;
  const lat0=point.lat*Math.PI/180;
  const project=([lat,lng])=>[(lng-point.lng)*Math.cos(lat0)*111320,(lat-point.lat)*110540];
  let best=Infinity;
  for(let i=0;i<points.length;i+=1){
    const a=project(points[i]);
    const b=project(points[Math.min(i+1,points.length-1)]);
    const dx=b[0]-a[0],dy=b[1]-a[1];
    const length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/length)):0;
    best=Math.min(best,Math.hypot(a[0]+t*dx,a[1]+t*dy));
  }
  return best;
}

/**
 * Where to ask "which municipality is this?" along the whole line.
 *
 * Asking at the start only is how ORMA came to name one commune for a loop
 * that spends half its length in the next one. Samples run the full length,
 * and the point farthest from the start is always among them.
 */
function lineSamples(path,options={}){
  const points=usablePath(path);
  if(!points.length)return [];
  const every=(options.everyKm||SAMPLE_EVERY_KM)*1000;
  const samples=[{kind:'start',km:0,lat:points[0][0],lng:points[0][1]}];
  let walked=0,next=every,farthest={index:0,metres:0};
  for(let i=1;i<points.length;i+=1){
    walked+=metresBetween(points[i-1],points[i]);
    const fromStart=metresBetween(points[0],points[i]);
    if(fromStart>farthest.metres)farthest={index:i,metres:fromStart,km:walked};
    if(walked>=next&&i<points.length-1){
      samples.push({kind:'along',km:Math.round(walked/100)/10,lat:points[i][0],lng:points[i][1]});
      next+=every;
    }
  }
  if(farthest.index>0&&farthest.index<points.length-1){
    const [lat,lng]=points[farthest.index];
    samples.push({kind:'farthest-from-start',km:Math.round(farthest.km/100)/10,lat,lng});
  }
  if(points.length>1){
    const last=points[points.length-1];
    samples.push({kind:'end',km:Math.round(walked/100)/10,lat:last[0],lng:last[1]});
  }
  return samples.sort((a,b)=>a.km-b.km);
}

function supported(fact){
  return ['supported-proposal','supported'].includes(fact?.humanAcceptedFinding||fact?.finding);
}

/** A source that is a page somebody with standing published, rather than the map or ORMA. */
function authoritySource(source){
  const url=String(source?.url||'');
  return /^https:\/\//.test(url)&&!NOT_AN_AUTHORITY.test(url)&&Boolean(String(source?.authority||'').trim());
}

/**
 * Whether a claim, as an agent returned it, states an authority's own figure.
 * Used at the gate and when the agent's answer is first checked, so both apply
 * the same test.
 */
function publishedFigure(claim,sources){
  if(!claim||!supported(claim))return false;
  if(claim.basis!=='published')return false;
  if(!(Number.isFinite(claim.figure)&&claim.figure>0))return false;
  return (sources||claim.sources||[]).some(authoritySource);
}

function factsBy(lockedFacts,predicate){return (lockedFacts||[]).filter(fact=>predicate(String(fact.claimId||'')));}

function sourcesOf(fact,evidenceSources){
  const ids=new Set(fact?.sourceIds||[]);
  return (evidenceSources||[]).filter(source=>ids.has(source.id));
}

/**
 * Why this walk may not carry the seal, by the methods that verify it by hand.
 *
 * Returns `{holds, detail}`: `holds` are the stable ids the graduation lists
 * in `heldFor`; `detail` says the same in a sentence a person can act on.
 * An empty `holds` means every method was satisfied.
 */
function researchMethodHolds(item,trail,options={}){
  const facts=item?.lockedFacts||[];
  const evidence=item?.evidenceSources||[];
  const holds=[],detail=[];
  const hold=(id,sentence)=>{if(!holds.includes(id))holds.push(id);detail.push(`${id}: ${sentence}`);};

  // 1. An authority publishes the climb AND the walking time.
  const figure=claimId=>{
    const fact=factsBy(facts,id=>id===claimId)[0];
    return fact&&publishedFigure(fact,sourcesOf(fact,evidence))?fact:null;
  };
  const ascent=figure('official-ascent');
  const time=figure('official-walking-time');
  if(!ascent)hold('official-climb-unpublished','no authority publishes this walk’s climb; a climb ORMA measured does not verify it');
  if(!time)hold('official-time-unpublished','no authority publishes this walk’s walking time; an estimated time does not verify it');

  // 4. The line is as long as the walk its authority describes.
  const distance=figure('official-distance');
  const lineKm=Number.isFinite(options.lineKm)?options.lineKm:lineLengthKm(trail?.path);
  if(!distance){
    hold('official-distance-unpublished','no authority-published distance to check the line against');
  }else if(!Number.isFinite(lineKm)){
    hold('line-not-measured','the line could not be measured against the published distance');
  }else{
    const official=distance.figure;
    // An out-and-back's published distance may count the return leg, which the
    // line, drawn once, does not.
    const candidates=trail?.routeShape==='out-and-back'?[lineKm,lineKm*2]:[lineKm];
    const within=candidates.some(km=>Math.abs(km-official)/official<=LINE_TOLERANCE_SHARE);
    if(!within){
      const off=Math.round(((lineKm-official)/official)*100);
      hold('line-differs-from-official',`the line is ${lineKm.toFixed(2)} km and the authority publishes ${official} km (${off>0?'+':''}${off}%)`);
    }
  }

  // 2. Every municipality the line crosses, and a dog rule for each.
  const communes=factsBy(facts,id=>id.startsWith(COMMUNE_CLAIM_PREFIX))
    .filter(fact=>supported(fact)&&String(fact.entityName||'').trim())
    .map(fact=>fact.entityName);
  if(!communes.length){
    hold('communes-unchecked','the municipalities along the whole line were not established');
  }
  const dogRules=factsBy(facts,id=>id.startsWith(COMMUNE_DOG_RULE_PREFIX)).filter(supported);
  const country=countryOf(trail);
  for(const commune of communes){
    const rule=dogRules.find(fact=>samePlace(fact.entityName,commune));
    const settled=rule&&(rule.basis==='published'&&sourcesOf(rule,evidence).some(authoritySource)
      ||(rule.basis==='national-default'&&country===NATIONAL_DOG_DEFAULT.country));
    if(!settled)hold('dog-rule-unsettled',`no settled dog rule for ${commune}`);
  }

  // Every protected area the line touches, from the EEA Natura 2000 data.
  const protectedAreas=factsBy(facts,id=>id===PROTECTED_AREAS_CLAIM)[0];
  if(!protectedAreas||!supported(protectedAreas)
    ||!sourcesOf(protectedAreas,evidence).some(source=>EEA_SOURCE.test(String(source.url||'')))){
    hold('protected-areas-unchecked','the line was not checked against the EEA Natura 2000 sites');
  }

  // 5. The photograph is of this walk, at this place.
  const photo=trail&&(trail.heroImage||trail.imageIcon);
  if(photo){
    const geotag=trail.imageGeotag;
    const place=trail.imagePlace;
    const off=geotag?metresFromLine(geotag,trail.path):null;
    if(Number.isFinite(off)&&off>PHOTO_MAX_OFF_LINE_M){
      hold('photo-off-the-line',`the photograph was taken ${(off/1000).toFixed(1)} km from the walk`);
    }
    if(place&&communes.length&&!communes.some(commune=>samePlace(commune,place))){
      hold('photo-wrong-place',`the photograph is labelled ${place}, which is not on this walk`);
    }
    if(!Number.isFinite(off)&&!place){
      hold('photo-place-unconfirmed','the photograph carries neither a geotag nor a place label to check against the walk');
    }
  }

  return {holds,detail};
}

/**
 * The record a dog rule leaves on the verification: which municipalities rest
 * on the national default, said in so many words.
 */
function dogRuleBasis(item){
  return factsBy(item?.lockedFacts,id=>id.startsWith(COMMUNE_DOG_RULE_PREFIX))
    .filter(supported)
    .map(fact=>({commune:fact.entityName||null,basis:fact.basis||null,
      ...(fact.basis==='national-default'?{statement:NATIONAL_DOG_DEFAULT.statement}:{})}));
}

module.exports={OFFICIAL_FIGURES,OFFICIAL_FIGURE_CLAIM_IDS,COMMUNE_CLAIM_PREFIX,COMMUNE_DOG_RULE_PREFIX,
  PROTECTED_AREAS_CLAIM,BASES,NATIONAL_DOG_DEFAULT,LINE_TOLERANCE_SHARE,PHOTO_MAX_OFF_LINE_M,SAMPLE_EVERY_KM,
  NOT_AN_AUTHORITY,EEA_SOURCE,countryOf,samePlace,lineLengthKm,metresFromLine,lineSamples,authoritySource,
  publishedFigure,researchMethodHolds,dogRuleBasis};
