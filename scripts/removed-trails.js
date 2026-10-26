'use strict';

/**
 * Walks removed from ORMA outright (data/removed-trails.json).
 *
 * A withdrawal keeps a walk as a draft: off the site, still on the trail board,
 * waiting for a human to lift it. A removal is the owner deciding there is
 * nothing to wait for. The walk leaves the catalogue, and every door that could
 * bring it back -- promotion from the OSM routes file, the new-trail scout, the
 * scouted-walk importer and a retried publication -- reads this one list.
 */

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'data', 'removed-trails.json');

function loadRemovedTrails(file = FILE){
  const artifact = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(artifact.trails) ? artifact.trails : [];
}

const REMOVED_TRAILS = loadRemovedTrails();
const REMOVED_TRAIL_IDS = new Set(REMOVED_TRAILS.map(trail => trail.id));
const REMOVED_RELATIONS = new Set(REMOVED_TRAILS.map(trail => String(trail.osmRelation)));

function removedTrail(id){
  return REMOVED_TRAILS.find(trail => trail.id === id) || null;
}

function isRemovedRelation(relation){
  return REMOVED_RELATIONS.has(String(relation));
}

module.exports = { REMOVED_TRAILS, REMOVED_TRAIL_IDS, REMOVED_RELATIONS, loadRemovedTrails, removedTrail, isRemovedRelation };
