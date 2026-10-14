'use strict';

/**
 * The sequence and the switches, written out from what the map says.
 *
 * ORMA's lines are built from OpenStreetMap route relations, and the geometry
 * audit measures which of them carries each stretch of the walk. That answers
 * two of the four route-guidance claims directly: the order of the numbers, and
 * where one gives way to the next.
 *
 * It is deliberately not the agent's answer laundered through a citation. The
 * agent researches what an authority published; this reads what the map
 * records. They are different kinds of evidence and the reader is told which
 * they have: every value written here says so in its own words, and the source
 * is the relation itself, attributed to OpenStreetMap.
 *
 * What it may never do is claim an operator published this. A relation records
 * that these ways carry route 101; it does not record that anybody recommends
 * walking them in this order. The wording stays descriptive -- "the mapped
 * route follows" rather than "follow" -- so a reader can tell a measurement
 * from a recommendation.
 */

const MAP_AUTHORITY = 'OpenStreetMap';
// Said in the value itself, not only in the citation, because a value is quoted
// and summarised far from its source and has to carry its own provenance.
const READ_FROM_MAP = 'Read from the OpenStreetMap route relations this walk is built from, not from a published route description.';

function relationUrl(externalRelationId){
  const id = String(externalRelationId || '').replace(/^relation\//, '');
  return /^\d+$/.test(id) ? `https://www.openstreetmap.org/relation/${id}` : null;
}

/** The relations behind the numbers, as citable sources. */
function mapSources(relations, at){
  return (relations || [])
    .filter(relation => relationUrl(relation?.externalRelationId))
    .map(relation => ({
      label: relation.ref ? `OpenStreetMap route ${relation.ref}` : 'OpenStreetMap route relation',
      url: relationUrl(relation.externalRelationId),
      authority: MAP_AUTHORITY,
      ...(at ? { accessedAt: at } : {}),
    }));
}

function km(value){
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1).replace(/\.0$/, '')} km` : null;
}

/** "the mapped route follows 101, then 105" -- an order, not an instruction. */
function sequenceValue(sequence){
  const refs = (sequence || []).filter(Boolean);
  if(!refs.length) return null;
  const list = refs.length === 1 ? `route ${refs[0]}`
    : `routes ${refs.slice(0, -1).join(', ')} and then ${refs[refs.length - 1]}`;
  return `The mapped route follows ${list}, in that order from the start. ${READ_FROM_MAP}`;
}

/**
 * Where the number changes, by distance from the start.
 *
 * A walk that never leaves one number is a complete answer rather than a
 * missing one -- the same rule the logistics prompt states for a route with no
 * decision point -- so it is written out rather than left null.
 */
function switchesValue(switches, sequence){
  const refs = (sequence || []).filter(Boolean);
  if(!refs.length) return null;
  const changes = (switches || []).filter(change => change && change.from && change.to);
  if(!changes.length){
    return `The mapped route stays on ${refs.length === 1 ? `route ${refs[0]}` : `routes ${refs.join(' and ')}`} throughout, with no change of number recorded along it. ${READ_FROM_MAP}`;
  }
  const sentences = changes.map(change => {
    const where = km(change.km);
    const near = change.landmark ? `, near ${change.landmark}` : '';
    return `route ${change.from} gives way to route ${change.to}${where ? ` about ${where} from the start` : ''}${near}`;
  });
  return `On the mapped route, ${sentences.join('; ')}. ${READ_FROM_MAP}`;
}

/**
 * The two claims the map can answer, or null where it cannot.
 *
 * `relations` are the routes the walk is built from, used as the citation. With
 * no citable relation there is no claim: a value with nothing behind it is the
 * assertion this whole contract exists to refuse.
 */
function routeGuidanceFromMap(guidance, relations, options = {}){
  const sources = mapSources(relations, options.at);
  if(!sources.length) return {};
  const sequence = sequenceValue(guidance?.sequence);
  if(!sequence) return {};
  const claim = (id, value) => ({
    id, category: 'route', finding: 'supported-proposal', proposedValue: value,
    confidence: 0.75,
    rationale: 'Measured from the OpenStreetMap route relations the walk is built from: which route carries each stretch of the line, and where one gives way to the next. Not a published route description.',
    sources,
    blockers: [],
    // So nothing downstream has to read the wording to know what this is.
    derivedFrom: 'route-relations',
  });
  return {
    'route-number-sequence': claim('route-number-sequence', sequence),
    'route-number-switches': claim('route-number-switches', switchesValue(guidance?.switches, guidance?.sequence)),
  };
}

module.exports = { MAP_AUTHORITY, READ_FROM_MAP, relationUrl, mapSources, sequenceValue, switchesValue, routeGuidanceFromMap };
