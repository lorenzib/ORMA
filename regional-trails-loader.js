(function () {
  'use strict';

  var manifest = window.DoloPawsRegionManifest;
  if (!manifest || !manifest.regions) return;
  var loaded = new Set();

  function assetUrl(region, key) {
    var entry = manifest.regions[region];
    return entry && entry[key] ? entry[key] : null;
  }

  function loadRegion(region) {
    var source = assetUrl(region, 'trails');
    if (!source) return Promise.reject(new Error('Unknown ORMA region: ' + region));
    if (loaded.has(region)) return Promise.resolve(window.trails || []);
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = source;
      script.onload = function () {
        loaded.add(region);
        if (window.DoloPawsRegions) window.DoloPawsRegions.assign(window.trails);
        window.dispatchEvent(new CustomEvent('dolopaws-region-loaded', { detail: { region: region } }));
        resolve(window.trails || []);
      };
      script.onerror = function () { reject(new Error('Could not load ' + region + ' trail data.')); };
      document.head.appendChild(script);
    });
  }

  function poiUrl(region, kind) {
    var key = kind === 'huts-bars' ? 'hutsBars' : (kind === 'dog-routes' ? 'dogRoutes' : kind);
    return assetUrl(region, key);
  }

  function primeTrailDetail(trail) {
    if (!trail || !trail.id) return false;
    try {
      sessionStorage.setItem('orma-trail-detail:' + trail.id, JSON.stringify({
        at: Date.now(),
        trail: trail,
      }));
      return true;
    } catch (error) {
      return false;
    }
  }

  // A URL may name a trail by its id or by its readable slug. The id stays the
  // key -- it addresses the detail files and every link already shared -- so an
  // id always wins, and a slug is resolved to one. Anything unknown is returned
  // unchanged so the "trail not found" path still reports what was asked for.
  function resolveTrailId(value) {
    if (!value) return value;
    var key = String(value);
    if (manifest.trailRegion && manifest.trailRegion[key]) return key;
    return (manifest.slugToId && manifest.slugToId[key]) || key;
  }

  function slugFor(trailOrId) {
    var id = trailOrId && trailOrId.id ? trailOrId.id : trailOrId;
    if (!id) return id;
    if (trailOrId && trailOrId.slug) return trailOrId.slug;
    return (manifest.trailSlug && manifest.trailSlug[String(id)]) || String(id);
  }

  // Every in-app link to a trail should read as its title. Falls back to the id
  // when a trail is not in the manifest, which keeps a link working rather than
  // emitting an empty one.
  function trailHref(trailOrId, extra) {
    var href = 'trail.html?id=' + encodeURIComponent(slugFor(trailOrId));
    if (!extra) return href;
    Object.keys(extra).forEach(function (key) {
      if (extra[key] === undefined || extra[key] === null || extra[key] === '') return;
      href += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(extra[key]);
    });
    return href;
  }

  var current = document.currentScript;
  var params = new URLSearchParams(window.location.search);
  var trailId = resolveTrailId(params.get('id'));
  var requested = params.get('region');
  var mode = current && current.dataset.defaultRegion || 'all';
  if (mode === 'trail') mode = manifest.trailRegion[trailId] || 'dolomites';
  else if (requested && manifest.regions[requested]) mode = requested;
  var initial = mode === 'all' ? Object.keys(manifest.regions) : [mode];

  // This loader runs synchronously at the end of the HTML parser. The initial
  // regional payload therefore exists before deferred application scripts run.
  initial.forEach(function (region) {
    var entry = manifest.regions[region] || {};
    // A detail page needs one trail to paint its title, facts and route. Loading
    // a whole region here made every mobile detail view wait on the catalogue.
    // The full regional package can still be requested later for nearby trails.
    var alreadyPrimed = mode === 'trail' && trailId && Array.isArray(window.trails) &&
      window.trails.some(function (trail) { return trail && trail.id === trailId; });
    var source = alreadyPrimed ? null : mode === 'trail' && trailId && entry.details && entry.details[trailId]
      ? entry.details[trailId]
      : assetUrl(region, 'trails');
    if (!source) return;
    document.write('<script src="' + source + '"><' + '/script>');
    if (source === entry.trails) loaded.add(region);
  });

  window.DoloPawsRegionalData = {
    manifest: manifest,
    loadRegion: loadRegion,
    isLoaded: function (region) { return loaded.has(region); },
    trailCount: function (region) { return manifest.regions[region] && manifest.regions[region].trailCount || 0; },
    poiUrl: poiUrl,
    regionForTrail: function (id) { return manifest.trailRegion[resolveTrailId(id)] || null; },
    resolveTrailId: resolveTrailId,
    slugFor: slugFor,
    trailHref: trailHref,
    primeTrailDetail: primeTrailDetail,
  };
})();
