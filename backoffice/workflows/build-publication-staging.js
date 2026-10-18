'use strict';

const {CLAIM_ENTITY_TYPE}=require('./compile-operational-facts');
const {routeGuidanceByClaim}=require('./compile-verified-dossier');

const TARGETS = Object.freeze({
  'osm-relation-1484751': { trailId: 'tre-cime', operation: 'update-existing', routeRef: 'backoffice-data/route-proposals/tre-cime-classic.geojson' },
  'osm-relation-6678431': { trailId: 'cinque-torri-assisted', operation: 'create-new', routeRef: 'backoffice-data/route-proposals/cinque-torri-three-refuges-assisted.geojson' },
  'osm-way-25736154': { trailId: 'lago-braies', operation: 'update-existing', routeRef: 'backoffice-data/route-proposals/lago-braies-circuit.geojson' },
});

const VERIFIED_FIELDS = Object.freeze({
  'osm-relation-1484751': { area:'Alta Pusteria – Tre Cime', distance:9.528, elevation:468, hours:'3.5', paid:true,
    terrainType:'High-alpine dirt and rocky mountain paths, including one narrower section', terrainRank:2,
    shadeCoverage:null, heatRisk:'high', safetyLevel:'caution', exposure:false, waterSources:[],
    startPoint:{lat:46.612849,lng:12.292858,label:'Parcheggio Rifugio Auronzo (P1) — approved parking pin'} },
  'osm-relation-6678431': { area:'Cortina / Cinque Torri', distance:3.95, elevation:10, hours:'2', paid:true,
    terrainType:'Museum and trench paths, cart track and forest hiking path', terrainRank:1,
    shadeCoverage:null, heatRisk:'moderate', safetyLevel:'moderate', exposure:false, waterSources:[],
    startPoint:{lat:46.518917,lng:12.037604,label:'Bai de Dones — approved parking pin'} },
  'osm-way-25736154': { area:'Prags Valley', distance:3.6, elevation:39, hours:'1', paid:true,
    terrainType:'Forest and lakeshore paths with roots, steps and a narrow rock-wall section', terrainRank:1,
    shadeCoverage:null, heatRisk:'moderate', safetyLevel:'moderate', exposure:false, waterSources:[],
    startPoint:{lat:46.699015,lng:12.085296,label:'Lago di Braies access — use the approved official P1–P4 parking set'} },
});

function latestDecisions(reviewQueue){
  const latest = new Map();
  for(const submission of reviewQueue?.submissions || []){
    for(const decision of submission.decisions || []) latest.set(decision.jobId, { ...decision, submissionId: submission.submissionId });
  }
  return latest;
}

function section(result, name){ return result?.changes?.find(change => change.section === name)?.after || null; }

function routeNumberGuidance(item){
  // By claim, not by the agent that happened to answer it.
  //
  // These were looked up as `logistics-recommended-start` and the like, which
  // finds an answer only where a specialist gave one. A walk whose number the
  // map read and whose start ORMA published records those answers under the
  // rung that established them -- `map-route-number-sequence`,
  // `orma-recommended-start` -- because calling a measurement a logistics claim
  // would make the dossier lie about who established the walk. Looked up this
  // way, every rung is found and none has to be mislabelled to be publishable.
  // One lookup, shared with the editorial handoff, because these two read the
  // same four answers and the last time they each had their own copy one of
  // them was still looking for a prefix the dossier had stopped writing.
  const facts=routeGuidanceByClaim(item?.lockedFacts);
  const start=facts.get('recommended-start');
  const status=facts.get('route-number-status');
  const sequence=facts.get('route-number-sequence');
  const switches=facts.get('route-number-switches');
  if(!start||!status||!sequence||!switches)return null;
  const sourceIds=[...new Set([start,status,sequence,switches].flatMap(fact=>fact.sourceIds||[]))];
  const sources=(item.evidenceSources||[]).filter(source=>sourceIds.includes(source.id)).map(source=>({
    label:source.label,url:source.url,authority:source.authority||null,accessedAt:source.accessedAt||null,
  }));
  const landmarkLed=/(?:unnumbered|named-only|landmark|no (?:usable )?(?:trail )?number)/i.test(status.value||'');
  // Which rung established each answer, carried so the published record can be
  // checked rather than taken on trust. `agent-evidence` is a specialist's own
  // answer cited to a publisher; the other two are the map and ORMA's own
  // record, and a walk answered entirely by the record cites nothing outside
  // ORMA -- which has to be stated, not inferred from an empty source list.
  const establishedBy=Object.fromEntries(Object.entries(
    {start,status,sequence,switches}).map(([field,fact])=>[field,fact.derivedFrom||'agent-evidence']));
  return {mode:landmarkLed?'landmarks':'numbered',start:start.value,status:status.value,
    sequence:sequence.value,switches:switches.value,establishedBy,sources};
}

// The locked facts that name one rifugio, lift or protected area. These ride the
// publication approval so a policy reaches the operational facts table through
// the same human gate that approved the dossier carrying it, and no other way.

// A livestock claim the agent answered "varies" is the answer, and the trail
// record has a value for exactly that: livestockPresence 'seasonal'. Without
// this the field stays 'unknown', so the scoring engine tells a reader
// "whether livestock graze this route is unknown" for something ORMA did
// establish -- while the publication simultaneously declares livestock a
// reviewed category. Those two cannot both be right.
//
// Only 'varies' is mapped. Turning a supported sentence into 'likely' or 'none'
// means reading free text for a safety value, which is how a description that
// mentions cattle becomes a claim about grazing on the day someone walks.
function seasonalSuitabilityFrom(item){
  const livestock=(item?.lockedFacts||[]).find(fact=>fact.claimId==='livestock');
  if(!livestock||livestock.humanAcceptedFinding!=='varies')return null;
  return {livestockPresence:'seasonal'};
}

/**
 * The eleven checks a badge can claim.
 *
 * `route`, `routeNumbers` and `mapPoints` rest on the geometry survey and the
 * route guidance -- the unwaivable part, which is what verification
 * establishes. `photo` and `elevation` come from the record the trail already
 * carries. The other six are safety facts a specialist has to ask about, and
 * they are the ones a walker acts on with a dog.
 */
const SAFETY_CHECKS=Object.freeze(['water','heat','exposure','livestock','surfaceHazards','access']);
const GRADUATION_CHECKS=Object.freeze(['photo','route','routeNumbers','mapPoints','elevation',...SAFETY_CHECKS]);

/**
 * The graduation a badge may show, derived from what was researched rather than
 * asserted of every trail.
 *
 * It used to hardcode all eleven complete and all six categories reviewed. That
 * was true while nothing could be verified without five specialists having
 * spoken, and it stopped being true the moment a free survey could settle a
 * trail's directions on its own.
 *
 * `status: 'verified'` is the earned seal and `hasFullGraduation` grants it only
 * on all eleven. Short of that the trail shows as reviewed -- honest for a walk
 * whose route is confirmed and whose safety facts nobody has asked about, and
 * more than the rest of the catalogue can show.
 *
 * It upgrades by itself: the next publication after research lands derives a
 * fuller list, so nothing has to remember to promote a trail.
 */
function graduationFor(researched, hasPhoto, hasFields){
  const completed=[
    ...(hasPhoto?['photo']:[]),
    'route','routeNumbers',
    ...(hasFields?['mapPoints','elevation']:[]),
    ...SAFETY_CHECKS.filter(check=>researched.includes(check)),
  ];
  const status=GRADUATION_CHECKS.every(check=>completed.includes(check))?'verified':'in-progress';
  return {status,required:[...GRADUATION_CHECKS],completed};
}

function operationalClaims(item){
  return (item?.lockedFacts||[])
    .filter(fact=>typeof fact.claimId==='string'&&Object.hasOwn(CLAIM_ENTITY_TYPE,fact.claimId))
    .map(fact=>({
      id:fact.id,claimId:fact.claimId,state:fact.state,humanAcceptedFinding:fact.humanAcceptedFinding,
      entityName:fact.entityName,rule:fact.rule,observedAt:fact.observedAt,sourceIds:fact.sourceIds||[],
      // The claim's own sentence is what a walker reads next to the policy.
      notes:fact.value||null,
    }));
}

// The structured fields a published trail carries: its measurements, terrain and
// start. Verification does not produce them as typed values, so they were typed
// in by hand, one hardcoded entry per candidate. Three existed, which meant any
// fourth trail that cleared verification stalled at the mapping gate until
// somebody edited this file.
//
// A trail already in the catalogue already carries all thirteen. An update
// publishes copy, photograph and verification status; the measurements carry
// forward from the record unless the table overrides them, and the operator sees
// the whole field set in the preview before approving it.
/**
 * What publication restates from the record, and what it only carries forward.
 *
 * `REQUIRED_STRUCTURED_FIELDS` is the walk's shape and its mapped points: how
 * far, how long, what ground, where it starts, what water is on it. Every one of
 * the 163 catalogue records carries all nine, bar one trail with no usable start
 * point, and without them a publication cannot restate the trail at all. That
 * is a real "not ready".
 *
 * `OPTIONAL_STRUCTURED_FIELDS` are safety and access attributes -- shade, heat
 * risk, exposure, whether access is paid -- and a record only has them once the
 * matching category was researched. Between 33 and 39 trails of 163 do.
 *
 * All thirteen were required together, and a single `undefined` returned null
 * for the whole record, so 134 trails were held at `structured-website-fields`
 * for not having had their heat researched. That is the safety gate again,
 * wearing a different name: the same six categories, blocking the same walks,
 * one layer further down where the blocker does not say so. A field the record
 * does not have is carried as absent, which is what it is.
 */
const REQUIRED_STRUCTURED_FIELDS = Object.freeze([
  'area', 'distance', 'elevation', 'hours', 'terrainType', 'terrainRank',
  'safetyLevel', 'waterSources', 'startPoint',
]);
const OPTIONAL_STRUCTURED_FIELDS = Object.freeze(['paid', 'shadeCoverage', 'heatRisk', 'exposure']);
const STRUCTURED_FIELDS = Object.freeze([...REQUIRED_STRUCTURED_FIELDS, ...OPTIONAL_STRUCTURED_FIELDS]);

function structuredFieldsFromTrail(trail){
  if(!trail) return null;
  if(REQUIRED_STRUCTURED_FIELDS.some(key => trail[key] === undefined)) return null;
  const fields = {};
  for(const key of STRUCTURED_FIELDS){
    if(trail[key] !== undefined) fields[key] = trail[key];
  }
  return fields;
}

function verifiedFieldsFor(item, target, trailsById){
  const tabled = VERIFIED_FIELDS[item.candidateId];
  if(tabled) return tabled;
  // A new trail has no record to carry forward, so it still needs its fields
  // supplied before it can be mapped.
  if(!target || target.operation !== 'update-existing') return null;
  return structuredFieldsFromTrail(trailsById.get(target.trailId));
}

const EXISTING_IMAGE_FIELDS=Object.freeze(['imageIcon','imageCredit','heroImage','imageSourcePage','imageCreator',
  'imageLicence','imageLicenceUrl','imageCreditText','imageAlt','imageSourceType']);

function existingImageFields(trail){
  if(!trail||!String(trail.imageIcon||'').trim()||!String(trail.heroImage||'').trim()
    ||!String(trail.imageAlt||'').trim()||!String(trail.imageCreditText||trail.imageCredit||'').trim())return null;
  return Object.fromEntries(EXISTING_IMAGE_FIELDS.filter(key=>trail[key]!==undefined).map(key=>[key,trail[key]]));
}

function verifiedPoiFields(item){
  const facts=item?.lockedFacts||[];
  const unknown=new Set((item?.acceptedUnknowns||[]).map(entry=>String(entry.blocker||'').split(':')[0]));
  const atPoint=fact=>fact.humanAcceptedFinding==='supported-proposal'&&String(fact.entityName||'').trim()
    &&Number.isFinite(fact.location?.lat)&&Number.isFinite(fact.location?.lng);
  const water=facts.filter(fact=>fact.claimId==='water'&&atPoint(fact)).map(fact=>({
    km:Number.isFinite(fact.location.km)?fact.location.km:undefined,label:fact.entityName,
    lat:fact.location.lat,lng:fact.location.lng,
  }));
  const facilities=facts.filter(fact=>['mountain-huts','food-drink'].includes(fact.claimId)&&atPoint(fact));
  const rifugi=[...new Map(facilities.map(fact=>[`${fact.entityName}|${fact.location.lat}|${fact.location.lng}`,{
    km:Number.isFinite(fact.location.km)?fact.location.km:undefined,name:fact.entityName,
    lat:fact.location.lat,lng:fact.location.lng,
  }])).values()];
  const fields={};
  if(water.length||unknown.has('terrainPoi/water'))fields.waterSources=water;
  if(rifugi.length||unknown.has('terrainPoi/mountain-huts')||unknown.has('terrainPoi/food-drink'))fields.rifugi=rifugi;
  if(unknown.has('terrainPoi/livestock')||unknown.has('terrainPoi/animals'))fields.livestockPresence='unknown';
  return fields;
}

function buildPublicationStaging(editorialQueue, execution, reviewQueue, options = {}){
  const at = options.at || new Date().toISOString();
  const decisions = latestDecisions(reviewQueue);
  const trailsById = new Map((options.productionTrails || []).map(trail => [trail.id, trail]));
  const outputs = new Map((execution?.outputs || []).map(output => [output.jobId, output]));
  const items = editorialQueue.items.map(item => {
    const target = TARGETS[item.candidateId]||(item.targetTrailId?{trailId:item.targetTrailId,operation:'update-existing',routeRef:null}:null);
    const verifiedFields=verifiedFieldsFor(item, target, trailsById);
    const copyJobId = `verified-${item.candidateId}-copy`;
    const visualJobId = `verified-${item.candidateId}-visual`;
    const copyDecision = decisions.get(copyJobId) || null;
    const visualDecision = decisions.get(visualJobId) || null;
    const copyApproved = copyDecision?.action === 'approve';
    const existingTrail=target?trailsById.get(target.trailId):null;
    const retainedImage=item.assetPolicy==='preserve-existing'?existingImageFields(existingTrail):null;
    const visualApproved = item.assetPolicy==='preserve-existing'?Boolean(retainedImage):visualDecision?.action === 'approve';
    const missingApprovals = [!copyApproved && 'editorial-approval', !visualApproved && 'asset-and-licensing-approval'].filter(Boolean);
    const copyOutput = outputs.get(copyJobId);
    const visualOutput = outputs.get(visualJobId);
    const hero = visualOutput?.result?.candidates?.find(candidate => candidate.status === 'ready') || null;
    const about = section(copyOutput?.result, 'About the trail');
    const dog = section(copyOutput?.result, 'Why it suits dogs');
    const practical = section(copyOutput?.result, 'Important practical notes');
    const routeGuidance=routeNumberGuidance(item);
    // What a specialist actually asked about, carried from the dossier. Absent
    // on a handoff written before the mark existed, and absence is read as
    // nobody having asked -- the safe direction: such a trail is held rather
    // than published claiming six checks it cannot show.
    const researched=Array.isArray(item?.researchedCategories)?item.researchedCategories:[];
    const graduation=graduationFor(researched,Boolean(retainedImage||hero),Boolean(verifiedFields));
    // A trail short of the full seal publishes as a reviewed one.
    //
    // It was held here instead, because the override contract had no door for
    // it: a full verification carries the seal, and the scope that would carry
    // a route-only publication demanded cited sources with a `reviewedAt`,
    // which a walk answered by the map and ORMA's own record does not have.
    // Both are now true of the `routeReviewed` scope, so the walk's directions,
    // copy and start point reach the reader and the badge says reviewed -- and
    // because no safety category is recorded, every caveat on the page stands.
    //
    // What still holds a publication is a missing *answer*: no mapping target,
    // no structured fields, no route guidance. Not having paid for the optional
    // six is not a missing answer.
    const publicationMappingBlockers=[!target&&'website-target-mapping',!verifiedFields&&'structured-website-fields',!routeGuidance&&'route-number-guidance'].filter(Boolean);
    const state=missingApprovals.length?'waiting-content-approvals':publicationMappingBlockers.length?'waiting-publication-mapping':'ready-for-publication-preview';
    return {
      candidateId: item.candidateId, targetTrailId: target?.trailId||item.candidateId, operation: target?.operation||'mapping-required',
      state,missingApprovals,publicationMappingBlockers,
      proposedOperationalClaims: operationalClaims(item),
      sourceApprovals: { copy: copyDecision, visual: visualDecision },
      proposedWebsiteFields: state!=='ready-for-publication-preview' ? null : {
        name: copyOutput.result.title,
        desc: `${about}\n\n${dog}`,
        tips: practical,
        routeRef: target.routeRef,
        ...(retainedImage||{
          imageIcon: hero.assetUrl,
          imageCredit: { text:hero.credit, url:hero.sourcePageUrl },
          heroImage: hero.assetUrl,
          imageSourcePage: hero.sourcePageUrl,
          imageCreator: hero.creator,
          imageLicence: hero.license,
          imageLicenceUrl: hero.licenseUrl,
          imageCreditText: hero.credit,
          imageAlt: hero.altText,
        }),
        // The public seal, only on all eleven. A trail whose route is confirmed
        // and whose safety facts nobody asked about shows as reviewed.
        ormaVerified: graduation.status==='verified',
        routeNumberGuidance:routeGuidance,
        ...verifiedFields,
        ...verifiedPoiFields(item),
        // After verifiedFields, which carry the previous record forward: what the
        // dossier established outranks what the trail used to say.
        ...(seasonalSuitabilityFrom(item)||{}),
        reviewedAt: item.verifiedAt.slice(0,10), reviewedBy:'ORMA verified-trail workflow',
        verified:{ categories:SAFETY_CHECKS.filter(check=>researched.includes(check)), sources:['Locked ORMA evidence dossier'], date:item.verifiedAt.slice(0,10) },
        graduation,
        verifiedAt: item.verifiedAt,
      },
      lockedEvidence: { dossierRef: item.dossierRef, facts: item.lockedFacts, verificationConditions: item.verificationConditions,
        acceptedUnknowns:item.acceptedUnknowns||[] },
      assetPolicy:item.assetPolicy||'source-new-asset',
      humanGate:item.assetPolicy==='preserve-existing'?'automated-existing-trail-publication-policy':'website-preview-and-publication-approval',
      policyGate: item.assetPolicy==='preserve-existing'?'existing-trail-evidence-and-quality-policy':'website-preview-and-publication-approval',
      publicationAuthorized: false,
      publicMutationAllowed: false,
    };
  });
  return {
    contractVersion: '1.0.0', generatedAt: at, mode: 'staging-only', stage: 'website-publication-preview',
    sourceEditorialQueue: 'backoffice-data/verified-trail-editorial-queue.json',
    sourceExecution: 'backoffice-data/verified-trail-editorial-execution.json',
    sourceReviewQueue: 'backoffice-data/content-review-queue.json',
    publicMutationAllowed: false, publicationAuthorized: false, items,
    summary: {
      trails: items.length,
      readyForPreview: items.filter(item => item.state === 'ready-for-publication-preview').length,
      waitingForApprovals: items.filter(item => item.state === 'waiting-content-approvals').length,
      waitingForMapping:items.filter(item=>item.state==='waiting-publication-mapping').length,
      publicMutations: 0,
    },
  };
}

module.exports = {SAFETY_CHECKS,REQUIRED_STRUCTURED_FIELDS,OPTIONAL_STRUCTURED_FIELDS,GRADUATION_CHECKS,graduationFor,seasonalSuitabilityFrom,verifiedPoiFields, TARGETS, VERIFIED_FIELDS, STRUCTURED_FIELDS,EXISTING_IMAGE_FIELDS,existingImageFields, structuredFieldsFromTrail, verifiedFieldsFor, latestDecisions, routeNumberGuidance, buildPublicationStaging };
