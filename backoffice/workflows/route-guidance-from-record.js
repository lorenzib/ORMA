'use strict';

/**
 * The start, and whether the route is numbered, from what ORMA already holds.
 *
 * 161 of 162 trails carry a named start point with coordinates, and every one
 * carries either trail numbers or a recorded navigation status. An agent asked
 * for `recommended-start` is therefore being paid to rediscover something the
 * catalogue has had all along, and a trail whose search comes back empty is
 * refused verification for want of a fact ORMA could state itself.
 *
 * The public page has said this honestly for a long time -- trail-trust renders
 * "Suggested start, <place>. Check current access before travelling." for a
 * walk whose access nobody has verified. Only the gate refused it.
 *
 * So ORMA may answer these two itself, as ORMA. The citation is not an
 * authority's page, because none was found and pretending otherwise would be
 * the inference this contract exists to forbid: it is ORMA's own record, said
 * to be ORMA's own. An authority the agent cites always wins, and the map wins
 * over this for the claims it can answer, because both say more than "we chose
 * this".
 *
 * What it may never do is make a walk up. The start is one ORMA already
 * published and a reader can see on the map; the status is read off the trail's
 * own numbers. Neither invents a route, and neither claims a recommendation
 * nobody made.
 */

const ORMA_AUTHORITY = 'ORMA';
// In the value, like the map's own line, because a value is quoted far from
// its citation.
const ORMA_SUGGESTION = 'This is ORMA’s suggestion, not one published by the trail’s operator.';
// Only the start carries it. Access is about whether somebody may begin here
// today -- a barrier, a closed car park, a seasonal road -- and saying it after
// a sentence about trail numbers attaches a warning to the wrong fact.
const CHECK_ACCESS = 'Check current access before travelling.';

function trimmed(value){ return String(value == null ? '' : value).trim(); }

// What promote-osm-trails writes when it found no car park, bus stop or lift
// near the line. It describes ORMA's search, not a place to go.
const UNNAMED_START = /^Route start per OpenStreetMap\b/i;

/** The start ORMA recorded, named and placed. */
function recordedStart(trail){
  const point = trail?.startPoint;
  const raw = trimmed(point?.label);
  const label = UNNAMED_START.test(raw) ? 'route start' : raw
    // trail-trust strips the same prefix for the same reason: "Start here," is
    // how the record phrases it, not part of the place's name.
    .replace(/^Start here\s*[,.:;—–-]*\s*/i, '')
    // How the place was found, not part of its name (generate-trail-pages
    // strips it from the page for the same reason).
    .replace(/\s*\(OSM-verified access point\)/gi, '')
    .trim();
  if(!label) return null;
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { label, lat, lng } : null;
}

/**
 * What a walker should be looking for: numbers, or places.
 *
 * `trail.routeNumberStatus` is not this. Its values are
 * `official-route-page`, `mapped-relation-ref`, `not-listed-in-mapped-source`
 * and the like -- provenance, recording where a number came from rather than
 * whether the walk has one. Printing it would hand a reader a code.
 *
 * The numbers decide instead: the refs the geometry audit measured on the
 * relations this walk follows, or the catalogue's own where no measurement was
 * made. And it is careful about what it claims. A relation carrying ref 101
 * establishes that the mapped route carries that number; it does not establish
 * what is painted on the posts, so the value says the first and declines the
 * second rather than blurring them.
 */
function recordedStatus(trail, measuredRefs){
  const measured = (Array.isArray(measuredRefs) ? measuredRefs : []).filter(Boolean).map(String);
  const catalogued = (Array.isArray(trail?.routeRefs) ? trail.routeRefs : []).filter(Boolean).map(String);
  const refs = [...new Set(measured.length ? measured : catalogued)];
  return refs.length
    ? `The mapped route carries trail ${refs.length === 1 ? 'number' : 'numbers'} ${refs.join(', ')}; look for ${refs.length === 1 ? 'it' : 'them'} at junctions. ORMA has not confirmed how they appear on local signs.`
    : 'No trail numbers are recorded for this walk. Follow the mapped ORMA line and local destination signs rather than looking for a number.';
}

/**
 * The places ORMA already recorded along this walk, in the order a walker
 * meets them.
 *
 * `decisionPoints` are hand-written: a kilometre mark and a sentence saying
 * what is there and what to do about it -- "Taillefer high point (766 m):
 * benches and the double panorama over the Grand and Petit lac d'Annecy". That
 * is the best landmark ORMA holds. Named huts and bars come next, and they
 * carry a kilometre mark too.
 *
 * Water sources are left out on purpose. Their labels are mostly "Drinking
 * water (OSM-verified location)" -- useful on a trail page, useless as a thing
 * to navigate by, and a sequence of five identical sentences is not guidance.
 */
function recordedLandmarks(trail){
  const seen = new Set();
  const landmarks = [];
  const add = (km, text) => {
    const name = trimmed(text);
    const at = Number(km);
    if(!name || !Number.isFinite(at) || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    landmarks.push({ km: at, name });
  };
  // A decision point is written as "place: what is there" -- "Taillefer high
  // point (766 m): benches and the double panorama over the two lakes". The
  // place is the landmark; the rest belongs on the trail page, and reading the
  // whole sentence into a list leaves "...over the two lakes at 3.6 km".
  for(const point of trail?.decisionPoints || []){
    add(point?.km, trimmed(point?.instruction).split(/\s*:\s/)[0]);
  }
  for(const hut of trail?.rifugi || []) add(hut?.km, hut?.name);
  return landmarks.sort((left, right) => left.km - right.km);
}

const km = value => `${Number(value).toFixed(1).replace(/\.0$/, '')} km`;

/** "passes X at 3.6 km, then Y at 6.2 km" -- an order, not an instruction. */
function landmarkRun(landmarks){
  if(!landmarks.length) return null;
  const said = landmarks.map(landmark => `${landmark.name} at ${km(landmark.km)}`);
  return said.length === 1 ? said[0] : `${said.slice(0, -1).join('; then ')}; then ${said[said.length - 1]}`;
}

/**
 * How to follow a walk that has no number, which is the only honest answer for
 * one.
 *
 * Two of the catalogue's unnumbered walks have a landmark ORMA wrote down and
 * two have nothing but a start, so both cases are answered. Where there are
 * landmarks a walker gets them in order with the distance to each; where there
 * are none they are told to follow the walk's name on the signs and the line on
 * the page, which is what somebody walking it actually does.
 *
 * Saying nothing was the worse option. A walker expecting to follow "route 23"
 * who arrives to find only name-boards has been let down by a blank, and a gate
 * that refuses the walk for want of a number it does not have refuses it for
 * ever.
 */
function followedByLandmark(trail, claimId){
  const landmarks = recordedLandmarks(trail);
  const run = landmarkRun(landmarks);
  const start = recordedStart(trail);
  // Lower-cased into the sentence above, so the place keeps its own capitals.
  const from = start ? `from ${start.label}, the` : 'the';
  const changes = claimId === 'route-number-switches';
  const noNumber = changes
    ? 'This walk carries no route number, so no number changes along it.'
    : 'This walk carries no route number and no numbered route runs along it.';
  // Only claimed where there are landmarks to follow. Saying a walk is
  // "followed by landmark" and then that none is recorded is two sentences
  // arguing with each other.
  return run
    ? `${noNumber} It is followed by name and by landmark: ${from} route passes ${run}.`
    : `${noNumber} ORMA has no landmark sequence recorded for it: follow the walk’s name on local signs and the mapped ORMA line on this page.`;
}

// The access point's kind, as a walker would say it.
const KIND = [[/^Parking\b/i, 'the car park'], [/^Bus stop\b/i, 'the bus stop'], [/^Lift station\b/i, 'the lift station']];

/**
 * The start as a walker reads it. It used to be the record's label with its
 * coordinates -- "Start at Route start per OpenStreetMap — best parking/access
 * not yet verified (45.19398, 6.39891)" went live on Circuit des Sallanches on
 * 24 October. The point is pinned on the map beside these words, so the
 * coordinates add nothing a walker can use.
 */
function startSentence(start){
  if(start.label === 'route start'){
    return `Start where the route begins, marked on the map. No car park or bus stop has been confirmed nearby. ${ORMA_SUGGESTION} ${CHECK_ACCESS}`;
  }
  let place = start.label;
  for(const [pattern, words] of KIND) if(pattern.test(place)){ place = place.replace(pattern, words); break; }
  return `Start at ${place}, marked on the map. ${ORMA_SUGGESTION} ${CHECK_ACCESS}`;
}

/**
 * The claims ORMA can answer about itself.
 *
 * `url` is where the suggestion is published, so the citation points at
 * something a reader can open rather than at nothing. With no trail page to
 * point at there is still a claim: the authority is ORMA either way, and the
 * record is the evidence.
 */
function routeGuidanceFromRecord(trail, options = {}){
  if(!trail) return {};
  const claims = {};
  const source = {
    label: `ORMA's recorded walk: ${trimmed(trail.name) || trail.id}`,
    url: options.trailUrl || null,
    authority: ORMA_AUTHORITY,
    ...(options.at ? { accessedAt: options.at } : {}),
  };
  const claim = (id, value) => ({
    id, category: 'access', finding: 'supported-proposal', proposedValue: value,
    confidence: 0.6,
    rationale: 'Taken from the walk ORMA already recorded, not from a published route description. An operator’s own wording replaces this wherever one is found.',
    sources: [source],
    blockers: [],
    derivedFrom: 'orma-record',
  });
  const start = recordedStart(trail);
  if(start){
    claims['recommended-start'] = claim('recommended-start', startSentence(start));
  }
  const status = recordedStatus(trail, options.measuredRefs);
  if(status){
    claims['route-number-status'] = claim('route-number-status', `${status} ${ORMA_SUGGESTION}`);
  }
  // Only where somebody looked and found no number. Measured-and-none is a
  // fact about the walk; never-measured is a fact about ORMA, and telling a
  // walker a walk has no number because nobody checked would be a false
  // statement rather than a weak one.
  if(options.routeNumbersAbsent){
    for(const id of ['route-number-sequence', 'route-number-switches']){
      claims[id] = claim(id, `${followedByLandmark(trail, id)} ${ORMA_SUGGESTION}`);
    }
  }
  return claims;
}

module.exports = { ORMA_AUTHORITY, ORMA_SUGGESTION, CHECK_ACCESS, recordedStart, startSentence, recordedStatus,
  recordedLandmarks, landmarkRun, followedByLandmark, routeGuidanceFromRecord };
