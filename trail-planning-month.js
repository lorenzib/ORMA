(function (global) {
  'use strict';

  // The month a reader is planning for. Unset, it is this month; chosen on the
  // trail list or a trail page, it is kept on the device and every page that
  // talks about a walk's season (trail-season-words.js) uses it instead of
  // today, so a list filtered for March opens trail pages that talk about March.
  const KEY = 'orma-planning-month';
  const EVENT = 'orma-planning-month';

  function today() {
    return new Date().getMonth() + 1;
  }

  function stored() {
    try {
      const value = Number(global.localStorage && global.localStorage.getItem(KEY));
      return Number.isInteger(value) && value >= 1 && value <= 12 ? value : null;
    } catch (error) {
      return null;
    }
  }

  // { month: 1-12, chosen: whether the reader picked it }
  function current() {
    const month = stored();
    return month ? { month, chosen: true } : { month: today(), chosen: false };
  }

  // A month 1-12 keeps it; null, or this month, goes back to following the
  // calendar, so a reader who picks the current month is not stuck on it.
  function set(month) {
    const value = Number(month);
    try {
      if (Number.isInteger(value) && value >= 1 && value <= 12 && value !== today()) {
        global.localStorage.setItem(KEY, String(value));
      } else {
        global.localStorage.removeItem(KEY);
      }
    } catch (error) {
      // Private windows refuse storage; the page still uses the month for now.
    }
    const next = Number.isInteger(value) && value >= 1 && value <= 12 ? value : today();
    if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
      global.dispatchEvent(new global.CustomEvent(EVENT, { detail: { month: next } }));
    }
    return next;
  }

  const api = { KEY, EVENT, today, current, set };
  global.ORMAPlanningMonth = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
