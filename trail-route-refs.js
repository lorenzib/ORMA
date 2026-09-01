(function (global) {
  'use strict';

  const REF_PATTERN = /\b(?:[A-Z]{1,4}-?)?\d{1,4}[A-Z]?\b/gi;
  const ROUTE_WORD_PATTERN = /\b(?:trails?|paths?|routes?|sentieri)\s+((?:[A-Z]{1,4}-?)?\d{1,4}[A-Z]?(?:\s*(?:,\s*(?:and\s+)?|\/\s*|&\s*|→\s*|(?:and|then|to|onto)\s+)(?:[A-Z]{1,4}-?)?\d{1,4}[A-Z]?)*)/gi;
  const NAMED_SENTIERO_PATTERN = /\bsentiero\s+(?:[A-ZÀ-ÖØ-öø-ÿ'’-]+\s+){0,3}((?:[A-Z]{1,4}-?)?\d{1,4}[A-Z]?)\b/gi;

  function normaliseRef(value) {
    const ref = String(value == null ? '' : value)
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
    return /^(?:[A-Z]{1,4}-?)?\d{1,4}[A-Z]?$/.test(ref) ? ref : null;
  }

  function refsFromText(text) {
    const refs = [];
    const source = String(text == null ? '' : text);
    for (const match of source.matchAll(ROUTE_WORD_PATTERN)) {
      const candidates = match[1].match(REF_PATTERN) || [];
      candidates.forEach(candidate => {
        const ref = normaliseRef(candidate);
        if (ref && !refs.includes(ref)) refs.push(ref);
      });
    }
    for (const match of source.matchAll(NAMED_SENTIERO_PATTERN)) {
      const ref = normaliseRef(match[1]);
      if (ref && !refs.includes(ref)) refs.push(ref);
    }
    return refs;
  }

  function explicitRefs(trail) {
    const values = [];
    ['routeRefs', 'routeNumbers', 'trailRefs', 'trailNumbers'].forEach(key => {
      const field = trail && trail[key];
      if (Array.isArray(field)) values.push(...field);
      else if (field != null) values.push(field);
    });
    if (trail && trail.ref != null) values.push(trail.ref);
    (Array.isArray(trail && trail.routeRefSegments) ? trail.routeRefSegments : [])
      .forEach(segment => values.push(segment && segment.ref));
    return values.map(value => normaliseRef(
      value && typeof value === 'object'
        ? value.ref || value.number || value.label
        : value
    )).filter(Boolean);
  }

  function switchRefs(instruction) {
    const match = String(instruction == null ? '' : instruction).match(
      /\bswitch\s+from\s+(?:trail|path|route|sentiero)\s+((?:[A-Z]{1,4}-?)?\d{1,4}[A-Z]?)\s+onto\s+(?:trail|path|route|sentiero)\s+((?:[A-Z]{1,4}-?)?\d{1,4}[A-Z]?)\b/i
    );
    if (!match) return null;
    const from = normaliseRef(match[1]);
    const to = normaliseRef(match[2]);
    return from && to ? { from, to } : null;
  }

  function nearestPathIndex(path, point, startIndex) {
    if (!point || !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lng))) return -1;
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let index = Math.max(0, startIndex || 0); index < path.length; index += 1) {
      const candidate = path[index];
      if (!Array.isArray(candidate) || candidate.length < 2) continue;
      const dLat = Number(candidate[0]) - Number(point.lat);
      const dLng = Number(candidate[1]) - Number(point.lng);
      const distance = dLat * dLat + dLng * dLng;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    return bestIndex;
  }

  function switchesForTrail(trail) {
    return (Array.isArray(trail && trail.decisionPoints) ? trail.decisionPoints : [])
      .map(point => ({ point, refs: switchRefs(point && point.instruction) }))
      .filter(item => item.refs && Number.isFinite(Number(item.point && item.point.lat))
        && Number.isFinite(Number(item.point && item.point.lng)))
      .map(item => ({
        from:item.refs.from,
        to:item.refs.to,
        km:Number.isFinite(Number(item.point.km)) ? Number(item.point.km) : null,
        lat:Number(item.point.lat),
        lng:Number(item.point.lng),
        instruction:String(item.point.instruction || ''),
      }));
  }

  function segmentsForTrail(trail) {
    if (!trail || !Array.isArray(trail.path) || trail.path.length < 2) return [];
    const verified = (Array.isArray(trail.routeRefSegments) ? trail.routeRefSegments : [])
      .map(segment => ({
        ref: normaliseRef(segment && segment.ref),
        path: segment && segment.path,
        source: segment && segment.source,
      }))
      .filter(segment => segment.ref && Array.isArray(segment.path) && segment.path.length > 1);
    if (verified.length) return verified;

    const switches = switchesForTrail(trail);
    if (!switches.length) return [];

    const segments = [];
    let currentRef = switches[0].from;
    let startIndex = 0;
    switches.forEach(item => {
      const endIndex = nearestPathIndex(trail.path, item, startIndex);
      if (endIndex > startIndex) {
        segments.push({ ref: currentRef, path: trail.path.slice(startIndex, endIndex + 1) });
        startIndex = endIndex;
      }
      currentRef = item.to;
    });
    if (startIndex < trail.path.length - 1) {
      segments.push({ ref: currentRef, path: trail.path.slice(startIndex) });
    }
    return segments.filter(segment => segment.path.length > 1);
  }

  function forTrail(trail) {
    if (!trail || typeof trail !== 'object') return [];
    const refs = [];
    const add = value => {
      const ref = normaliseRef(value);
      if (ref && !refs.includes(ref)) refs.push(ref);
    };

    explicitRefs(trail).forEach(add);
    refsFromText(trail.routeSource && trail.routeSource.name).forEach(add);
    (Array.isArray(trail.decisionPoints) ? trail.decisionPoints : [])
      .forEach(point => refsFromText(point && point.instruction).forEach(add));
    return refs.slice(0, 8);
  }

  const SHIELD_IMAGE_ID = 'orma-route-number-shield';

  function featuresForTrail(trail) {
    const sections = segmentsForTrail(trail);
    const refs = forTrail(trail);
    const labelledPaths = sections.length
      ? sections
      : (refs.length === 1 && Array.isArray(trail && trail.path)
        ? [{ ref:refs[0], path:trail.path }]
        : []);
    return labelledPaths
      .filter(section => section.ref && Array.isArray(section.path) && section.path.length > 1)
      .map(section => ({
        type:'Feature',
        properties:{ id:trail.id, routeRef:section.ref },
        geometry:{ type:'LineString', coordinates:section.path.map(([lat, lng]) => [lng, lat]) },
      }));
  }

  function registerShieldImage(map) {
    if(map.hasImage(SHIELD_IMAGE_ID)) return;
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 56;
    const context = canvas.getContext('2d');
    context.fillStyle = '#FFFFFF';
    context.fillRect(2, 2, 76, 52);
    context.strokeStyle = '#17221B';
    context.lineWidth = 4;
    context.strokeRect(4, 4, 72, 48);
    map.addImage(
      SHIELD_IMAGE_ID,
      context.getImageData(0, 0, 80, 56),
      { pixelRatio:2, stretchX:[[16, 64]], stretchY:[[14, 42]], content:[11, 8, 69, 48] }
    );
  }

  function addShieldLayer(map, options) {
    const config = options || {};
    if(!config.id || !config.source || map.getLayer(config.id)) return;
    registerShieldImage(map);
    map.addLayer({
      id:config.id,
      type:'symbol',
      source:config.source,
      minzoom:8,
      layout:{
        'symbol-placement':'line',
        'symbol-spacing':['interpolate', ['linear'], ['zoom'], 8, 165, 12, 205, 16, 245, 19, 285],
        'icon-image':SHIELD_IMAGE_ID,
        'icon-text-fit':'both',
        'icon-text-fit-padding':[4, 7, 4, 7],
        'icon-size':['interpolate', ['linear'], ['zoom'], 8, 1, 12, 1.08, 16, 1.18, 19, 1.24],
        'icon-rotation-alignment':'viewport',
        'icon-allow-overlap':true,
        'icon-ignore-placement':true,
        'text-field':['get', 'routeRef'],
        'text-font':['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size':['interpolate', ['linear'], ['zoom'], 8, 14, 12, 16, 16, 18, 19, 20],
        'text-rotation-alignment':'viewport',
        'text-keep-upright':true,
        'text-allow-overlap':true,
        'text-ignore-placement':true,
      },
      paint:{
        'text-color':'#17221B',
        'text-halo-color':'#FFFFFF',
        'text-halo-width':0.6,
      },
    }, config.beforeId);
  }

  const api = {
    forTrail,
    refsFromText,
    normaliseRef,
    segmentsForTrail,
    switchesForTrail,
    featuresForTrail,
    registerShieldImage,
    addShieldLayer,
    SHIELD_IMAGE_ID,
  };
  global.DoloPawsTrailRouteRefs = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
