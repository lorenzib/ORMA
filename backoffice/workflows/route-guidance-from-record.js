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
const ORMA_SUGGESTION = 'ORMA’s own suggestion from the walk it recorded, not an operator’s recommendation.';
// Only the start carries it. Access is about whether somebody may begin here
// today -- a barrier, a closed car park, a seasonal road -- and saying it after
// a sentence about trail numbers attaches a warning to the wrong fact.
const CHECK_ACCESS = 'Check current access before travelling.';

function trimmed(value){ return String(value == null ? '' : value).trim(); }

/** The start ORMA recorded, named and placed. */
function recordedStart(trail){
  const point = trail?.startPoint;
  const label = trimmed(point?.label)
    // trail-trust strips the same prefix for the same reason: "Start here," is
    // how the record phrases it, not part of the place's name.
    .replace(/^Start here\s*[,.:;—–-]*\s*/i, '');
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
    claims['recommended-start'] = claim('recommended-start',
      `Start at ${start.label} (${start.lat.toFixed(5)}, ${start.lng.toFixed(5)}). ${ORMA_SUGGESTION} ${CHECK_ACCESS}`);
  }
  const status = recordedStatus(trail, options.measuredRefs);
  if(status){
    claims['route-number-status'] = claim('route-number-status', `${status} ${ORMA_SUGGESTION}`);
  }
  return claims;
}

module.exports = { ORMA_AUTHORITY, ORMA_SUGGESTION, CHECK_ACCESS, recordedStart, recordedStatus, routeGuidanceFromRecord };
