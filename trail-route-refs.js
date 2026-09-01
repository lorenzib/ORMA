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

  const api = { forTrail, refsFromText, normaliseRef };
  global.DoloPawsTrailRouteRefs = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
