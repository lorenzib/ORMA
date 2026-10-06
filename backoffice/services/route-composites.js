'use strict';

// The approved composites, read the way loadProductionTrails reads the
// catalogue: from the repository, because that is where a human approval is
// recorded and reviewed. Cached per path, since the specialist runner asks once
// per cartographer job and the file does not change inside a worker pass.

const fs = require('fs');
const path = require('path');

const cache = new Map();

function compositesPath(root){
  return path.join(root || path.resolve(__dirname, '../..'), 'backoffice-data', 'route-composites.json');
}

/**
 * Composites by trail id. A missing or unreadable file is an empty ledger, not
 * a crash: a trail that has a relation of its own never needed one, and one
 * that does not will fail with route-source-identity-unresolved as before.
 */
function loadRouteComposites(root){
  const file = compositesPath(root);
  if(cache.has(file)) return cache.get(file);
  let composites = {};
  try{
    composites = JSON.parse(fs.readFileSync(file, 'utf8')).composites || {};
  }catch{
    composites = {};
  }
  cache.set(file, composites);
  return composites;
}

function clearRouteCompositeCache(){ cache.clear(); }

module.exports = { compositesPath, loadRouteComposites, clearRouteCompositeCache };
