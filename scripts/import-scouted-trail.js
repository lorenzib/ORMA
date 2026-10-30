#!/usr/bin/env node
'use strict';

/**
 * import-scouted-trail — a scouted walk becomes a record the catalogue holds.
 *
 *   node scripts/import-scouted-trail.js --relation 11839597
 *   node scripts/import-scouted-trail.js --relation 11839597 --region savoy --apply
 *   node scripts/import-scouted-trail.js --relation 948852 --name "Jochrunde" --apply
 *
 * Dry run by default.
 *
 * The scouting lane had no exit. A selected candidate lived only in Firestore
 * -- an id, a name, an OSM relation and an empty path -- and publication
 * restates nine fields from a catalogue record it had not got, so the walk was
 * verified, had its research and its copy paid for, reached the mapping gate
 * and stopped there for ever. #865 holds such a candidate at intake instead of
 * admitting it; this is the step that lets it in.
 *
 * It adds one feature to the region's route file and changes nothing else.
 * `npm run promote:trails` then derives the nine fields the way it does for
 * every other trail -- distance and gain from the line, terrain from the
 * surface tags, water and rifugi from the mapped points, the start from the
 * nearest access point -- so an imported walk is the same kind of record as
 * the 163 already there, and `check:generated` holds it to that.
 *
 * Many walks a tourist board publishes are numbered routes that OpenStreetMap
 * carries with a ref and no name, and "the relation has no name" refused every
 * one of them. `--name` supplies the name the operator publishes, for a
 * relation that has none; it never replaces a name OSM already gives, because
 * renaming a trail is what data/trail-slug-overrides.json is for. The source of
 * the name belongs in the trail's verification record like every other fact.
 *
 * It applies the discovery pass's own screening first. A walk reached this way
 * has not been through phase 1, and importing one the region sweep would have
 * refused is how a via ferrata ends up on a dog-walking site.
 */

const fs = require('fs/promises');
const path = require('path');
const {
  fetchWithRetries, geometryOf, hardWayForDogs, evaluateRelation,
  buildPhase2Query, buildMemberWayQuery, MAX_KM,
} = require('./fetch-dog-friendly-routes');
const { REMOVED_TRAILS } = require('./removed-trails');

const ROOT = path.resolve(__dirname, '..');
const REGIONS = Object.freeze({
  dolomites: 'dog-friendly-routes.geojson',
  savoy: 'dog-friendly-routes-savoy.geojson',
});
const OVERRIDES_PATH = path.join(ROOT, 'data', 'dog-route-overrides.json');

function parseArgs(argv) {
  const out = { relation: null, region: 'dolomites', apply: false, name: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i]);
    if (arg === '--relation') { out.relation = Number(argv[i += 1]); continue; }
    if (arg.startsWith('--relation=')) { out.relation = Number(arg.slice('--relation='.length)); continue; }
    if (arg === '--region') { out.region = String(argv[i += 1] || ''); continue; }
    if (arg.startsWith('--region=')) { out.region = arg.slice('--region='.length); continue; }
    if (arg === '--apply') { out.apply = true; continue; }
    if (arg === '--name') { out.name = String(argv[i += 1] ?? '').trim() || null; continue; }
    if (arg.startsWith('--name=')) { out.name = arg.slice('--name='.length).trim() || null; continue; }
  }
  return out;
}

/**
 * The feature the discovery pass would have written for this relation.
 *
 * Built from the same `geometryOf` the sweep and the targeted refresh use, so
 * a walk imported one at a time and one discovered by the region sweep cannot
 * disagree about its own line.
 */
function featureFor(relation, memberWays, overrides) {
  const tags = relation.tags || {};
  const waySurface = new Map();
  for (const way of memberWays) if (way.tags?.surface) waySurface.set(way.id, way.tags.surface);
  const built = geometryOf(relation.members || [], tags, waySurface);
  if (!built) return null;
  const override = overrides[String(relation.id)] || {};
  return {
    type: 'Feature',
    properties: {
      osm_relation: relation.id,
      name: tags.name,
      'name:it': tags['name:it'] || null,
      'name:de': tags['name:de'] || null,
      ref: tags.ref || null,
      network: tags.network || null,
      distance_km: built.properties.distance_km,
      surfaces: built.properties.surfaces,
      sac_scale: tags.sac_scale || null,
      loop: built.properties.loop,
      symbol: tags['osmc:symbol'] || null,
      website: tags.website || tags.url || tags['contact:website'] || null,
      leash: override.leash || null,
      dogFriendlyNotes: override.dogFriendlyNotes || null,
      waymarkedtrails: `https://hiking.waymarkedtrails.org/#route?id=${relation.id}`,
    },
    geometry: built.geometry,
  };
}

/**
 * Whether this walk may be imported at all, and why not when it may not.
 *
 * The relation's own tags go through the discovery pass's `evaluateRelation`;
 * its member ways go through the same rule the sweep asks Overpass for. A
 * route the sweep would have refused is refused here, named reason by named
 * reason, rather than arriving by a side door.
 */
function screen(relation, memberWays, overrides) {
  const tags = { ...(relation.tags || {}), __id: relation.id };
  const hard = memberWays.filter(way => hardWayForDogs(way.tags));
  const verdict = evaluateRelation(tags, hard.length > 0, overrides);
  const reasons = [...verdict.reasons];
  if (!tags.name) reasons.push('the relation has no name');
  if (!/^(hiking|foot)$/.test(String(tags.route || ''))) {
    reasons.push(`route=${tags.route || '(none)'} is not a walking route`);
  }
  return {
    keep: verdict.keep && !reasons.length,
    reasons,
    hardWays: hard.map(way => way.id),
  };
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

async function main(options = {}) {
  const args = parseArgs(options.argv || process.argv.slice(2));
  const runQuery = options.fetchQuery || fetchWithRetries;
  if (!Number.isInteger(args.relation) || args.relation <= 0) {
    console.log('[import] Name the walk with --relation <osm relation id>. Nothing was changed.');
    return null;
  }
  const removed = REMOVED_TRAILS.find(trail => Number(trail.osmRelation) === args.relation);
  if (removed) {
    console.log(`[import] ${removed.name} was removed from ORMA on ${removed.removedAt} (${removed.reason}).`);
    console.log('[import] Putting it back is a human edit to data/removed-trails.json. Nothing was changed.');
    return { status: 'removed', name: removed.name };
  }
  const routesFile = REGIONS[args.region];
  if (!routesFile) {
    console.log(`[import] Unknown --region "${args.region}". Available: ${Object.keys(REGIONS).join(', ')}`);
    return null;
  }
  const target = options.routesPath || path.join(ROOT, routesFile);
  const collection = await readJson(target, null);
  if (!collection?.features) { console.log(`[import] ${routesFile} is not readable.`); return null; }

  const already = collection.features.find(feature => Number(feature.properties?.osm_relation) === args.relation);
  if (already) {
    // Re-importing would rewrite a line the catalogue already rests on, which
    // is what `refresh-route-geometry` is for and this deliberately is not.
    console.log(`[import] relation ${args.relation} is already in ${routesFile} as "${already.properties.name}".`);
    console.log('[import] To re-read its line, use the targeted geometry refresh. Nothing was changed.');
    return { status: 'already-present', name: already.properties.name };
  }

  const [geom, ways] = await Promise.all([
    runQuery(buildPhase2Query([args.relation])),
    runQuery(buildMemberWayQuery([args.relation])),
  ]);
  const relation = (geom.elements || []).find(element => element.type === 'relation' && element.id === args.relation);
  if (!relation) { console.log(`[import] OpenStreetMap returned no relation ${args.relation}.`); return { status: 'not-found' }; }
  const memberWays = (ways.elements || []).filter(element => element.type === 'way');
  if (args.name) {
    if (relation.tags?.name) {
      console.log(`[import] OpenStreetMap already names relation ${args.relation} "${relation.tags.name}"; --name only names a relation that has none.`);
      console.log('[import] To publish it under another name, use data/trail-slug-overrides.json. Nothing was changed.');
      return { status: 'already-named', name: relation.tags.name };
    }
    console.log(`[import] OpenStreetMap gives relation ${args.relation} no name; importing it as "${args.name}" (--name).`);
    relation.tags = { ...(relation.tags || {}), name: args.name };
  }

  const overrides = await readJson(OVERRIDES_PATH, {});
  const verdict = screen(relation, memberWays, overrides);
  const name = relation.tags?.name || `relation ${args.relation}`;
  if (!verdict.keep) {
    console.log(`[import] ${name} is not importable:`);
    for (const reason of verdict.reasons) console.log(`[import]   ${reason}`);
    if (verdict.hardWays.length) console.log(`[import]   ways that fail the dog screening: ${verdict.hardWays.join(', ')}`);
    console.log('[import] Nothing was changed.');
    return { status: 'refused', reasons: verdict.reasons };
  }

  const feature = featureFor(relation, memberWays, overrides);
  if (!feature) { console.log(`[import] ${name} left no line after stitching. Nothing was changed.`); return { status: 'no-geometry' }; }
  const km = feature.properties.distance_km;
  console.log(`[import] ${name} — ${km} km, ${feature.properties.loop ? 'a loop' : 'point to point'}`
    + `${feature.properties.ref ? `, trail ${feature.properties.ref}` : ', no trail number'}`);
  console.log(`[import] It would join ${routesFile} as osm-${args.relation}, one feature, nothing else touched.`);
  if (!args.apply) {
    console.log('[import] Dry run. Nothing was changed. Re-run with --apply, then `npm run promote:trails`.');
    return { status: 'dry-run', feature };
  }

  // Appended rather than sorted in: the promoter reads the file in order and
  // writes the catalogue in that order, so inserting would move every trail
  // after it in a file the generated-artifact check compares byte for byte.
  collection.features.push(feature);
  // Written in the file's own shape. The route files are one line of JSON,
  // and writing them back indented tripled the file and buried the one added
  // feature under a diff of every line (dog-friendly-routes.geojson: 292 KB
  // to 858 KB, +46,646 lines, for four walks).
  const raw = await fs.readFile(target, 'utf8');
  const indented = /^\{\s*\n/.test(raw);
  await fs.writeFile(target, indented ? `${JSON.stringify(collection, null, 2)}\n` : JSON.stringify(collection), 'utf8');
  console.log(`[import] Added to ${routesFile}. Run \`npm run promote:trails\` to give it a record,`);
  console.log('[import] then `npm run generate:artifacts` for the page. Both are free.');
  return { status: 'added', feature };
}

if (require.main === module) {
  main().catch(error => { console.error(`[import] ${error.stack || error.message}`); process.exitCode = 1; });
}

module.exports = { REGIONS, parseArgs, featureFor, screen, main };
