// Only the native app loads this; the website loads regions-runtime-manifest.js
// directly. The app build puts this script where that one was.
//
// The app carries a copy of every trail, but a trail published after a release
// would otherwise reach app users only with the next App Store update. So when
// the phone is online the app reads the trail list from the website, and the
// region and detail files that list names come from the website too, which
// keeps the list and its files from the same deploy. Offline, or when the
// website cannot be reached, the copy inside the app is used as before.
(function () {
  'use strict';

  var SITE = 'https://www.app-orma.com/';
  // The trail data this app's code understands. A website manifest of another
  // shape was written for newer code, so the app keeps its own copy instead.
  var SCHEMA = 1;
  var LOCAL = 'regions-runtime-manifest.js';
  var RELATIVE = /^(?:\.\/|\/)?(?=[a-z])/i;
  var IMAGE = /^(?:\.\/|\/)?images\//;

  function write(src) {
    document.write('<script src="' + src + '"><' + '/script>');
  }

  function absolute(value) {
    return typeof value === 'string' && !/^[a-z]+:/i.test(value) ? value.replace(RELATIVE, SITE) : value;
  }

  // Region, detail, water, hut and dog-route files, every path a region names.
  function rebaseManifest(manifest) {
    Object.keys(manifest.regions).forEach(function (region) {
      var entry = manifest.regions[region];
      Object.keys(entry).forEach(function (key) {
        var value = entry[key];
        if (typeof value === 'string') entry[key] = absolute(value);
        else if (key === 'details' && value) {
          Object.keys(value).forEach(function (id) { value[id] = absolute(value[id]); });
        }
      });
    });
    manifest.base = SITE;
  }

  // The website's trail records name their pictures relative to the website,
  // and a relative path inside the app looks for a file the app does not have.
  var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
  function rebaseImages(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      // Route lines are long arrays of numbers; they hold no pictures.
      if (typeof value[0] === 'number' || Array.isArray(value[0]) && typeof value[0][0] === 'number') return value;
      for (var i = 0; i < value.length; i += 1) {
        if (typeof value[i] === 'string' && IMAGE.test(value[i])) value[i] = absolute(value[i]);
        else rebaseImages(value[i]);
      }
      return value;
    }
    Object.keys(value).forEach(function (key) {
      var item = value[key];
      if (typeof item === 'string') { if (IMAGE.test(item)) value[key] = absolute(item); }
      else rebaseImages(item);
    });
    return value;
  }

  // Every region and detail file ends by assigning window.trails, so a setter
  // sees each trail once as it arrives, before any page script reads it.
  function watchTrails() {
    var current = window.trails;
    var accept = function (list) {
      if (Array.isArray(list)) {
        list.forEach(function (trail) {
          if (!trail || typeof trail !== 'object' || (seen && seen.has(trail))) return;
          rebaseImages(trail);
          if (seen) seen.add(trail);
        });
      }
      current = list;
    };
    try {
      Object.defineProperty(window, 'trails', {
        configurable: true,
        enumerable: true,
        get: function () { return current; },
        set: accept,
      });
      accept(current);
    } catch (error) {}
  }

  function settle() {
    var manifest = window.DoloPawsRegionManifest;
    if (manifest && manifest.schemaVersion === SCHEMA && manifest.regions) {
      rebaseManifest(manifest);
      watchTrails();
      return;
    }
    window.DoloPawsRegionManifest = undefined;
    write(LOCAL);
  }

  window.DoloPawsAppTrailData = { settle: settle, rebaseManifest: rebaseManifest, rebaseImages: rebaseImages, SITE: SITE, SCHEMA: SCHEMA };

  if (navigator.onLine === false) {
    write(LOCAL);
    return;
  }
  write(SITE + LOCAL);
  document.write('<script>window.DoloPawsAppTrailData.settle();<' + '/script>');
})();
