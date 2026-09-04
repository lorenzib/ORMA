#!/usr/bin/env node
'use strict';

/**
 * check-trail-sources.js
 *
 * Cross-references trails-data.js + osm-trails*-data.js against the raw OSM
 * properties already fetched into dog-friendly-routes*.geojson, and prints a
 * verification worklist: surface-data mismatches to look into, and the
 * official-portal / Waymarked Trails links a curator needs open before
 * flipping curated:false -> true. See VERIFICATION.md for the process this
 * supports. Makes no network calls; only reads files already in the repo.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const REGIONS = [
  { name: 'Dolomites', routesFile: 'dog-friendly-routes.geojson' },
  { name: 'Savoy', routesFile: 'dog-friendly-routes-savoy.geojson' },
];

const TRAIL_FILES = ['trails-data.js', 'osm-trails-data.js', 'osm-trails-savoy-data.js', 'trail-audits.js'];

const ROCKY_SURFACES = new Set(['rock', 'stone', 'scree', 'mud']);
const ROCKY_SHARE_THRESHOLD = 0.3;

// The six hazard categories VERIFICATION.md asks every curated trail to have
// a non-OSM citable source for. Order here is the order they're reported in.
const HAZARD_CATEGORIES = ['water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'];
const GRADUATION_CATEGORIES = ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', ...HAZARD_CATEGORIES];

function loadTrails() {
  const src = TRAIL_FILES.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  return new Function(`${src}\nreturn trails;`)();
}

function loadOsmProperties() {
  const byRelation = new Map();
  for (const region of REGIONS) {
    const geojson = JSON.parse(fs.readFileSync(path.join(ROOT, region.routesFile), 'utf8'));
    for (const feature of geojson.features) {
      const p = feature.properties;
      byRelation.set(p.osm_relation, { ...p, region: region.name });
    }
  }
  return byRelation;
}

function rockyShare(surfaces) {
  if (!surfaces || typeof surfaces !== 'object') return null;
  const entries = Object.entries(surfaces);
  const total = entries.reduce((sum, [, km]) => sum + km, 0);
  if (total <= 0) return null;
  const rocky = entries.reduce((sum, [key, km]) => sum + (ROCKY_SURFACES.has(key) ? km : 0), 0);
  return rocky / total;
}

function checkTrail(trail, osmProps) {
  const flags = [];
  const links = [];

  if (!osmProps) {
    flags.push('No matching OSM relation found in the fetched geojson — cross-check skipped.');
    return { flags, links };
  }

  if (osmProps.website) links.push(`Official portal: ${osmProps.website}`);
  if (osmProps.waymarkedtrails) links.push(`Waymarked Trails: ${osmProps.waymarkedtrails}`);
  if (!osmProps.website) flags.push('No official portal link on record — plan on a trip report or field visit instead.');

  const share = rockyShare(osmProps.surfaces);
  if (share !== null) {
    const hasHazardNote = Array.isArray(trail.surfaceHazards) && trail.surfaceHazards.length > 0;
    if (share >= ROCKY_SHARE_THRESHOLD && (trail.terrainRank || 0) < 2 && !hasHazardNote) {
      flags.push(`OSM surfaces are ${Math.round(share * 100)}% rock/mud/scree, but terrainRank is ${trail.terrainRank ?? 0} and no surfaceHazards are listed.`);
    }
  } else {
    flags.push('No OSM surface data — terrainRank/surfaceHazards not cross-checkable here.');
  }

  if (osmProps.sac_scale && !trail.sacScale) {
    flags.push(`OSM sac_scale is "${osmProps.sac_scale}" — not reflected in the trail entry.`);
  }
  if (osmProps.leash && !trail.leash) {
    flags.push(`OSM leash tag is "${osmProps.leash}" — not reflected in the trail entry (trail.leash).`);
  }
  if (osmProps.dogFriendlyNotes && !trail.dogNotes) {
    flags.push(`OSM dogFriendlyNotes present — not reflected in the trail entry (trail.dogNotes).`);
  }

  return { flags, links };
}

function verificationProgress(trail) {
  const checked = ((trail.verified && trail.verified.categories) || []).filter((c) => HAZARD_CATEGORIES.includes(c));
  const missing = HAZARD_CATEGORIES.filter((c) => !checked.includes(c));
  return { checked, missing };
}

function graduationProgress(trail) {
  if (!trail.graduation || !Array.isArray(trail.graduation.completed)) return null;
  const required = [...new Set([
    ...(Array.isArray(trail.graduation.required) ? trail.graduation.required : []),
    ...GRADUATION_CATEGORIES,
  ])];
  const completed = required.filter(check => trail.graduation.completed.includes(check));
  return { completed, missing: required.filter(check => !completed.includes(check)) };
}

function main() {
  const args = process.argv.slice(2);
  const idIdx = args.indexOf('--id');
  const onlyId = idIdx !== -1 ? args[idIdx + 1] : null;
  const includeCurated = args.includes('--include-curated');

  const trails = loadTrails();
  const osmByRelation = loadOsmProperties();

  let candidates = trails.filter((t) => includeCurated || t.curated === false);
  if (onlyId) candidates = candidates.filter((t) => t.id === onlyId);

  if (candidates.length === 0) {
    console.log('No matching trails.');
    return;
  }

  // Priority: trails already partway verified (finish what's started), then
  // trails with an official portal link on file (easiest to verify next),
  // then the rest last.
  candidates.sort((a, b) => {
    const aProgress = verificationProgress(a).checked.length > 0 ? 0 : 1;
    const bProgress = verificationProgress(b).checked.length > 0 ? 0 : 1;
    if (aProgress !== bProgress) return aProgress - bProgress;
    const aHasSite = osmByRelation.get(a.osmRelation)?.website ? 0 : 1;
    const bHasSite = osmByRelation.get(b.osmRelation)?.website ? 0 : 1;
    return aHasSite - bHasSite;
  });

  let flaggedCount = 0;
  for (const trail of candidates) {
    const osmProps = osmByRelation.get(trail.osmRelation);
    const { flags, links } = checkTrail(trail, osmProps);
    const { checked, missing } = verificationProgress(trail);
    const graduation = graduationProgress(trail);
    if (flags.length === 0 && links.length === 0 && checked.length === 0) continue;
    flaggedCount += 1;

    console.log(`\n${trail.name}  (${trail.id}, curated: ${trail.curated !== false})`);
    console.log(`  Verified: ${checked.length}/${HAZARD_CATEGORIES.length} (${checked.length ? checked.join(', ') : 'none yet'})`);
    if (missing.length > 0) console.log(`  Still needed: ${missing.join(', ')}`);
    if (graduation) {
      console.log(`  Graduation: ${graduation.completed.length}/${GRADUATION_CATEGORIES.length} (${trail.graduation.status})`);
      if (graduation.missing.length) console.log(`  Graduation blockers: ${graduation.missing.join(', ')}`);
    }
    for (const source of trail.sourceLinks || []) {
      console.log(`  Review source: ${source.label} — ${source.url}`);
    }
    for (const link of links) console.log(`  ${link}`);
    for (const flag of flags) console.log(`  ⚑ ${flag}`);
  }

  console.log(`\n${flaggedCount}/${candidates.length} trails have something to check.`);

  const invalidReviews = trails.filter((trail) => {
    if (!trail.verified) return false;
    const categories = Array.isArray(trail.verified.categories) ? trail.verified.categories : [];
    return categories.some((category) => !HAZARD_CATEGORIES.includes(category))
      || !trail.reviewedAt
      || !Array.isArray(trail.sourceLinks)
      || trail.sourceLinks.length === 0;
  });
  if (invalidReviews.length) {
    console.error(`\n${invalidReviews.length} reviewed trail records have invalid categories, no review date, or no route-specific source links.`);
    process.exitCode = 1;
  }
}

main();
