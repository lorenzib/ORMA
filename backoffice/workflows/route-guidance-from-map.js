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

/**
 * "the mapped route follows 101, then 105" -- an order, not an instruction.
 *
 * A walk that carries no number of its own but runs along numbered paths says
 * so first. The numbers are the ones on the signposts a walker passes, which is
 * what they need; what they must not read is that this walk *is* route 23,
 * because it would send them along 23 at the point the walk leaves it.
 */
// "Waymarked" is a walker's word, not a reader's: a walk along other paths
// names them the way the trail page's badges do, as numbered trails.
// Back-to-back repeats are one stretch, not two: "routes 3 and then 3" read
// as a typo.
function distinctInOrder(sequence){
  return (sequence || []).filter(Boolean).filter((ref, index, refs) => !index || ref !== refs[index - 1]);
}

function sequenceValue(sequence, alongOtherRoutes){
  const refs = distinctInOrder(sequence);
  if(!refs.length) return null;
  // One number has no order to be in, and saying "in that order" of a single
  // route reads as though something were missing from the sentence.
  const said = refs.length === 1
    ? (alongOtherRoutes ? `numbered trail ${refs[0]}` : `route ${refs[0]} from end to end`)
    : `${alongOtherRoutes ? 'numbered trails' : 'routes'} ${refs.slice(0, -1).join(', ')}`
      + ` and then ${refs[refs.length - 1]}, in that order from the start`;
  return alongOtherRoutes
    ? `This walk carries no route number of its own. The mapped route runs along ${said}. ${READ_FROM_MAP}`
    : `The mapped route follows ${said}. ${READ_FROM_MAP}`;
}

/**
 * Where the number changes, by distance from the start.
 *
 * A walk that never leaves one number is a complete answer rather than a
 * missing one -- the same rule the logistics prompt states for a route with no
 * decision point -- so it is written out rather than left null.
 */
function switchesValue(switches, sequence, alongOtherRoutes){
  const refs = distinctInOrder(sequence);
  if(!refs.length) return null;
  const changes = (switches || []).filter(change => change && change.from && change.to);
  const named = refs.length === 1
    ? `${alongOtherRoutes ? 'numbered trail' : 'route'} ${refs[0]}`
    : `${alongOtherRoutes ? 'numbered trails' : 'routes'} ${refs.join(' and ')}`;
  if(!changes.length){
    return alongOtherRoutes
      ? `The mapped route runs along ${named} throughout, with no change of number recorded along it. ${READ_FROM_MAP}`
      : `The mapped route stays on ${named} throughout, with no change of number recorded along it. ${READ_FROM_MAP}`;
  }
  const said = alongOtherRoutes ? 'trail' : 'route';
  const sentences = changes.map(change => {
    const where = km(change.km);
    const near = change.landmark ? `, near ${change.landmark}` : '';
    return `${said} ${change.from} gives way to ${said} ${change.to}${where ? ` about ${where} from the start` : ''}${near}`;
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
  const along = Boolean(guidance?.alongOtherRoutes);
  const sequence = sequenceValue(guidance?.sequence, along);
  if(!sequence) return {};
  const claim = (id, value) => ({
    id, category: 'route', finding: 'supported-proposal', proposedValue: value,
    confidence: 0.75,
    rationale: along
      ? 'Measured from the OpenStreetMap route relations that run along the walk, which carries no number of its own: which waymarked walking route covers each stretch of the line, and where one gives way to the next. Cycle routes and road numbers are excluded. Not a published route description.'
      : 'Measured from the OpenStreetMap route relations the walk is built from: which route carries each stretch of the line, and where one gives way to the next. Not a published route description.',
    sources,
    blockers: [],
    // So nothing downstream has to read the wording to know what this is.
    derivedFrom: 'route-relations',
  });
  return {
    'route-number-sequence': claim('route-number-sequence', sequence),
    'route-number-switches': claim('route-number-switches', switchesValue(guidance?.switches, guidance?.sequence, along)),
  };
}

/**
 * The guidance a single numbered relation gives on its own.
 *
 * One relation is one number from end to end, so the map answers the order and
 * the turns outright: the walk follows this route throughout and changes number
 * nowhere. Nothing needs measuring -- the composite path reaches the same
 * answer by working out which of several routes carries each stretch, and here
 * there is only one.
 *
 * It lives here rather than in the cartographer because both the pass that
 * writes an audit and the gate that reads one need it, and the gate needs it
 * for audits taken before this existed. 150 of 162 trails are built from a
 * single relation, and for nineteen of the catalogue's blocked trails the
 * number was sitting in an audit already stored, unread, while agents were sent
 * to the web to research it.
 */
function singleRelationGuidance(relation){
  const ref = relation?.tags?.ref;
  if(!ref) return null;
  // A composite names the numbers it runs along, joined, and those are several
  // routes in an order this cannot know. Measuring them is the composite
  // path's job, and it writes its own guidance.
  if(String(ref).includes(';')) return null;
  return { sequence: [String(ref)], switches: [], segments: [] };
}

module.exports = { MAP_AUTHORITY, READ_FROM_MAP, relationUrl, mapSources, sequenceValue, switchesValue, singleRelationGuidance, routeGuidanceFromMap };
