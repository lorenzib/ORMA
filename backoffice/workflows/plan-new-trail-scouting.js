'use strict';

const {DEFAULT_POLICY}=require('./regional-coverage');

const HARD_DIFFICULTIES = new Set(['alpine_hiking', 'demanding_alpine_hiking', 'difficult_alpine_hiking']);

/**
 * How many published ORMA trails already sit in each valley.
 *
 * The ranking scored `existing-area` -- within 30 km of a published trail --
 * highest, and a valley with nothing nearby lowest. At ORMA's density almost
 * everything in the Dolomites is within 30 km of something, so the tier barely
 * discriminated: measured on 2026-10-08, all four awaiting candidates were
 * tagged `existing-area` while sitting in four different valleys, two of them
 * thin and one with no ORMA trail at all.
 *
 * Proximity is not coverage. A 28th trail in Alta Pusteria adds less than a
 * second trail in Cortina, and only the valley count can say so.
 */
function publishedByValley(trails){
  const counts=new Map();
  for(const trail of trails||[]){
    if(!trail||!trail.valley)continue;
    counts.set(trail.valley,(counts.get(trail.valley)||0)+1);
  }
  return counts;
}

/**
 * How badly this candidate's valley needs another trail, from the same
 * threshold the coverage report calls thin. Imported rather than restated: two
 * copies of a target are two targets.
 *
 * Capped at the threshold, so the difference between twenty and twenty-seven
 * published trails never outranks the region policy.
 */
function coverageNeed(valley,publishedCounts){
  if(!valley)return 0;
  const published=publishedCounts instanceof Map?(publishedCounts.get(valley)||0):0;
  return Math.max(0,DEFAULT_POLICY.thinBelowPublished-published);
}

function haversineKm(a, b){
  const rad=value=>value*Math.PI/180;const dLat=rad(b[1]-a[1]);const dLng=rad(b[0]-a[0]);
  const value=Math.sin(dLat/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(dLng/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(value),Math.sqrt(1-value));
}

function coordinateLines(geometry){
  if(geometry?.type==='LineString')return [geometry.coordinates||[]];
  if(geometry?.type==='MultiLineString')return geometry.coordinates||[];
  return [];
}

function centerOf(geometry){
  const points=coordinateLines(geometry).flat().filter(point=>Array.isArray(point)&&point.length>=2);
  if(!points.length)return null;
  return points.reduce((sum,point)=>[sum[0]+Number(point[0])/points.length,sum[1]+Number(point[1])/points.length],[0,0]);
}

function closureMeters(geometry){
  const lines=coordinateLines(geometry).filter(line=>line.length>1);if(!lines.length)return Infinity;
  const longest=lines.sort((a,b)=>b.length-a.length)[0];return haversineKm(longest[0],longest.at(-1))*1000;
}

function nearestExisting(center, trails){
  return trails.map(trail=>({trailId:trail.id,trailName:trail.name,distanceKm:haversineKm(center,[Number(trail.lng),Number(trail.lat)])}))
    .filter(item=>Number.isFinite(item.distanceKm)).sort((a,b)=>a.distanceKm-b.distanceKm)[0]||null;
}

function relationId(feature){return String(feature?.properties?.osm_relation||feature?.properties?.osmRelation||'').trim();}

function compareScoutingCandidates(a,b,primaryRegion='dolomites'){
  const regionPriority=Number(b.region===primaryRegion)-Number(a.region===primaryRegion);
  // Region first, so coherent expansion still beats an unrelated new region.
  // Then what the candidate would add: a thin valley needs a trail more than a
  // full one. Proximity stays as a tiebreak rather than the primary signal --
  // it was answering "how close is this to what we have" when the question is
  // "where are we missing".
  const coveragePriority=(b.coverageNeed??0)-(a.coverageNeed??0);
  return regionPriority||coveragePriority||b.expansionScore-a.expansionScore
    ||(a.nearestExisting?.distanceKm??Infinity)-(b.nearestExisting?.distanceKm??Infinity)
    ||a.distanceKm-b.distanceKm;
}

function buildCandidate(feature, region, trails, existingRelations, context={}){
  const properties=feature.properties||{};const relation=relationId(feature);const center=centerOf(feature.geometry);if(!relation||!center)return null;
  if(existingRelations.has(relation))return null;
  const distanceKm=Number(properties.distance_km);const closure=closureMeters(feature.geometry);
  const blockers=[];
  if(!Number.isFinite(distanceKm)||distanceKm<=0||distanceKm>12)blockers.push('outside-distance-policy');
  if(!(properties.loop===true||closure<=500))blockers.push('not-a-credible-loop');
  if(HARD_DIFFICULTIES.has(properties.sac_scale))blockers.push(`hard-difficulty:${properties.sac_scale}`);
  if(String(properties.dog||properties.dogs||'').toLowerCase()==='no')blockers.push('dogs-explicitly-prohibited');
  if(blockers.length)return null;
  const nearest=nearestExisting(center,trails.filter(trail=>trail.region===region));
  const expansionTier=!nearest?'uncovered':nearest.distanceKm<=30?'existing-area':nearest.distanceKm<=80?'adjacent-area':'new-area';
  // regions-config stores [lng, lat]; nearestLocality takes (lat, lng). Absent
  // the lookup, every candidate has no valley and the ordering falls back to
  // exactly what it was.
  const valley=typeof context.nearestLocality==='function'
    ? (context.nearestLocality(Number(center[1]),Number(center[0]))||{}).valley||null
    : null;
  const published=valley&&context.publishedByValley instanceof Map
    ? (context.publishedByValley.get(valley)||0):0;
  const need=coverageNeed(valley,context.publishedByValley);
  return {
    valley,valleyPublishedTrails:valley?published:null,coverageNeed:need,
    id:`osm-relation-${relation}`,osmRelation:Number(relation),name:properties.name||`OSM route ${relation}`,region,
    distanceKm,loopEvidence:properties.loop===true?'source-tagged loop':`geometry closes within ${Math.round(closure)} m`,
    animalFit:properties.dogFriendlyNotes||properties.leash||'No OSM dog prohibition found; animal suitability still requires evidence review.',
    difficulty:properties.sac_scale||'not tagged',surfaceSummary:properties.surfaces||{},center,nearestExisting:nearest,expansionTier,
    expansionScore:expansionTier==='existing-area'?3:expansionTier==='adjacent-area'?2:expansionTier==='new-area'?1:0,
    whyCandidate:`A plausible loop under 12 km, ${nearest?`${nearest.distanceKm.toFixed(1)} km from ${nearest.trailName}`:'with no nearby published ORMA trail'}`
      +`${valley?`, in ${valley} where ORMA publishes ${published} trail${published===1?'':'s'}`:''}`
      +', awaiting full route and dog-suitability verification.',
    sourceUrl:properties.waymarkedtrails||`https://www.openstreetmap.org/relation/${relation}`,status:'awaiting-ceo-selection',
    nextStage:'route-identity-and-geometry',publicMutationAllowed:false,
  };
}

function planNewTrailScouting(sources, trails, options={}){
  const at=options.at||new Date().toISOString();const limit=options.limit||25;const primaryRegion=options.primaryRegion||'dolomites';
  const excludedCandidateIds=new Set(options.excludedCandidateIds||[]);
  const existingRelations=new Set(trails.map(trail=>trail.osmRelation).filter(Boolean).map(String));
  const context={nearestLocality:options.nearestLocality,publishedByValley:publishedByValley(trails)};
  const candidates=sources.flatMap(source=>(source.data?.features||[]).map(feature=>buildCandidate(feature,source.region,trails,existingRelations,context)).filter(Boolean))
    .filter(candidate=>!excludedCandidateIds.has(candidate.id))
    .sort((a,b)=>compareScoutingCandidates(a,b,primaryRegion))
    .slice(0,limit).map((candidate,index)=>({...candidate,priority:index+1}));
  return {contractVersion:'1.0.0',generatedAt:at,mode:'candidate-only',publicMutationAllowed:false,policy:{loopsRequired:true,maxDistanceKm:12,primaryRegion,expandFromExistingAreasFirst:true,animalSuitabilityRequiresVerification:true,
      thinValleyBelowPublished:DEFAULT_POLICY.thinBelowPublished},candidates,
    summary:{candidates:candidates.length,primaryRegion,primaryRegionCandidates:candidates.filter(item=>item.region===primaryRegion).length,existingArea:candidates.filter(item=>item.expansionTier==='existing-area').length,adjacentArea:candidates.filter(item=>item.expansionTier==='adjacent-area').length,newArea:candidates.filter(item=>item.expansionTier==='new-area').length,
      // What the proximity tiers could not say: how many land where ORMA is thin.
      inThinValleys:candidates.filter(item=>item.coverageNeed>0).length,
      valleysRepresented:new Set(candidates.map(item=>item.valley).filter(Boolean)).size}};
}

function applyNewTrailReview(packet,review,input,options={}){
  const actions=new Set(['send-to-verification','park','reject']);if(!actions.has(input.action))throw new Error('A valid scouting decision is required');
  const candidate=(packet?.candidates||[]).find(item=>item.id===input.candidateId);if(!candidate)throw new Error('Scouting candidate was not found');
  const at=options.at||new Date().toISOString();const decision={candidateId:candidate.id,action:input.action,note:String(input.note||'').trim().slice(0,1200),reviewedAt:at,reviewedBy:options.reviewedBy||'local-editor',publicMutationAllowed:false};
  const decisions=[...(review?.decisions||[]).filter(item=>item.candidateId!==candidate.id),decision];
  const intake=(review?.intake||[]).filter(item=>item.candidateId!==candidate.id);
  if(input.action==='send-to-verification')intake.push({candidateId:candidate.id,trailName:candidate.name,sourceUrl:candidate.sourceUrl,osmRelation:candidate.osmRelation,region:candidate.region,status:'queued',queuedAt:at,nextAgent:'cartographer',nextStage:'route-identity-and-geometry',publicMutationAllowed:false});
  return {contractVersion:'1.0.0',updatedAt:at,decisions,intake};
}

module.exports={haversineKm,centerOf,closureMeters,publishedByValley,coverageNeed,compareScoutingCandidates,buildCandidate,planNewTrailScouting,applyNewTrailReview};
