// Daylight on a walk: sunset at the walk on a given day, and the latest time
// to set off and still finish before it. In midwinter the sun sets before five
// in the Alps, and a walk started after lunch can end in the dark; this is the
// line that says so, worked out in the reader's browser for the day they read
// it.
//
// Sunset is the astronomical one, over a flat horizon (NOAA's general solar
// position equations, good to a minute or two in the Alps). In a deep valley
// the sun leaves the path earlier, so the page says so too.
//
// Browser and Node: window.DoloPawsDaylight, or require('./daylight').
(function (global) {
  'use strict';

  const DEG = Math.PI / 180;
  // The months the line is shown: when the days are short.
  const DAYLIGHT_MONTHS = [10, 11, 12, 1, 2, 3];
  // Every ORMA region today keeps Central European time.
  const TIME_ZONE = 'Europe/Rome';
  // The start-by time is rounded down to this many minutes.
  const ROUND_MINUTES = 15;

  // Minutes after midnight UTC of sunrise and sunset on `date`'s calendar day
  // (its UTC year, month and day) at a latitude and longitude in degrees.
  // null in polar day or night, which no walk here meets.
  function sunTimesUtcMinutes(date, lat, lng) {
    const start = Date.UTC(date.getUTCFullYear(), 0, 1);
    const day = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000) + 1;
    const gamma = 2 * Math.PI / 365 * (day - 1);
    const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
      - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
    const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
      - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
      - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
    const cosHa = Math.cos(90.833 * DEG) / (Math.cos(lat * DEG) * Math.cos(decl)) - Math.tan(lat * DEG) * Math.tan(decl);
    if (cosHa < -1 || cosHa > 1) return null;
    const ha = Math.acos(cosHa) / DEG;
    return {
      sunrise: 720 - 4 * (lng + ha) - eqTime,
      sunset: 720 - 4 * (lng - ha) - eqTime,
    };
  }

  // The walk's time in hours from its record: "2.5", "2.5–3" (the longer end)
  // or a number. null when it cannot be read.
  function walkHours(hours) {
    if (Number.isFinite(hours)) return hours;
    const parts = String(hours == null ? '' : hours).split(/[–-]/).map(part => Number(part.trim().replace(',', '.'))).filter(n => Number.isFinite(n) && n > 0);
    return parts.length ? Math.max(...parts) : null;
  }

  function formatTime(date, locale) {
    return new Intl.DateTimeFormat(locale || 'en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  }

  // { sunset, startBy } as Dates for the walk on `now`'s day, or null outside
  // the short-day months or without a time or position.
  function daylightFor(trail, now) {
    const today = now || new Date();
    if (!trail || !DAYLIGHT_MONTHS.includes(today.getMonth() + 1)) return null;
    const lat = Number(trail.lat);
    const lng = Number(trail.lng);
    const hours = walkHours(trail.hours);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !hours) return null;
    const times = sunTimesUtcMinutes(today, lat, lng);
    if (!times) return null;
    const midnight = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const sunset = new Date(midnight + times.sunset * 60000);
    const latest = sunset.getTime() - hours * 3600000;
    const step = ROUND_MINUTES * 60000;
    const startBy = new Date(Math.floor(latest / step) * step);
    return { sunset, startBy, hours };
  }

  // The line on a trail page: <p class="sp-daylight" hidden data-lat data-lng
  // data-hours data-template>, the template already in the page's language with
  // {sunset} and {start} to fill. Shown only in the short-day months.
  function fillPage(doc, now) {
    if (!doc || !doc.querySelectorAll) return;
    const locale = (doc.documentElement && doc.documentElement.lang) || 'en-GB';
    doc.querySelectorAll('.sp-daylight[data-template]').forEach(el => {
      const day = daylightFor({ lat: el.getAttribute('data-lat'), lng: el.getAttribute('data-lng'), hours: el.getAttribute('data-hours') }, now);
      if (!day) return;
      el.textContent = el.getAttribute('data-template')
        .replace('{sunset}', formatTime(day.sunset, locale))
        .replace('{start}', formatTime(day.startBy, locale));
      el.hidden = false;
    });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => fillPage(document));
    else fillPage(document);
  }

  global.DoloPawsDaylight = { fillPage, DAYLIGHT_MONTHS, TIME_ZONE, sunTimesUtcMinutes, walkHours, daylightFor, formatTime };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.DoloPawsDaylight;
})(typeof window !== 'undefined' ? window : globalThis);
