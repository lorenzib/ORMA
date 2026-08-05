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
    if (!source) return Promise.reject(new Error('Unknown DoloPaws region: ' + region));
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

  var current = document.currentScript;
  var params = new URLSearchParams(window.location.search);
  var requested = params.get('region');
  var mode = current && current.dataset.defaultRegion || 'all';
  if (mode === 'trail') mode = manifest.trailRegion[params.get('id')] || 'dolomites';
  else if (requested && manifest.regions[requested]) mode = requested;
  var initial = mode === 'all' ? Object.keys(manifest.regions) : [mode];

  // This loader runs synchronously at the end of the HTML parser. The initial
  // regional payload therefore exists before deferred application scripts run.
  initial.forEach(function (region) {
    var source = assetUrl(region, 'trails');
    if (!source) return;
    document.write('<script src="' + source + '"><' + '/script>');
    loaded.add(region);
  });

  window.DoloPawsRegionalData = {
    manifest: manifest,
    loadRegion: loadRegion,
    isLoaded: function (region) { return loaded.has(region); },
    trailCount: function (region) { return manifest.regions[region] && manifest.regions[region].trailCount || 0; },
    poiUrl: poiUrl,
    regionForTrail: function (trailId) { return manifest.trailRegion[trailId] || null; },
  };
})();
