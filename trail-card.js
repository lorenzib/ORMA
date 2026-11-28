/*
 * trail-card.js, the one trail card's markup (styles.css .tcard).
 *
 * Option C of the 20 Nov 2026 mock-ups: the photo with the verdict for the dog
 * on it, then the name (a tick when ORMA verified the walk), one figures line,
 * and the rating and season chips. The homepage collections, the homepage
 * search results and the signed-in "today's picks" all draw it from here, so
 * they cannot drift apart again. The verdict is always words, never a %.
 *
 * Reads, when the page has them: window.t (dictionary), DoloPawsI18n.num,
 * ORMARouteReturn, DoloPawsIcons, DoloPawsTrailTrust, DoloPawsTrailSeasonWords.
 * Each is optional, so the card still renders in a bare test page.
 */
(function (root) {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function tr(key, fallback, vars) {
    var s = typeof root.t === 'function' ? root.t(key, vars) : key;
    if (!s || s === key) {
      s = fallback;
      if (vars) for (var k in vars) s = s.split('{' + k + '}').join(vars[k]);
    }
    return s;
  }

  function num(value) {
    var i18n = root.DoloPawsI18n;
    return i18n && typeof i18n.num === 'function' ? i18n.num(value) : value;
  }

  // One decimal is what a walker reads: "9.5 km", never "9.528 km".
  function km(value) { return num(Math.round(Number(value) * 10) / 10); }

  function metaLine(trail) {
    var routeReturn = root.ORMARouteReturn;
    var oneWayWalk = !!(routeReturn && routeReturn.isOneWay(trail));
    var shown = oneWayWalk ? routeReturn.forView(trail) : trail;
    var back = shown !== trail;
    return [
      shown.distance ? (back ? tr('card.thereAndBack', '{km} km there and back', { km: km(shown.distance) })
        : oneWayWalk ? tr('card.oneWay', '{km} km one way', { km: km(shown.distance) })
        : km(shown.distance) + ' km') : null,
      shown.elevation != null ? tr('card.climb', '{m} m climb', { m: shown.elevation }) : null,
      shown.hours ? (back ? '≈ ' : '') + num(shown.hours) + ' h' : null,
      trail.area || trail.valley || '',
    ].filter(Boolean).join(' · ');
  }

  var RISK = {
    'low-risk': ['legend.low', 'Low risk'],
    'moderate': ['legend.moderate', 'Moderate risk'],
    'caution': ['legend.caution', 'Higher risk'],
  };

  function chips(trail) {
    var icons = root.DoloPawsIcons, trust = root.DoloPawsTrailTrust;
    var level = RISK[trail && trail.safetyLevel] ? trail.safetyLevel : 'moderate';
    var riskWords = tr(RISK[level][0], RISK[level][1]);
    var risk = icons ? icons.badgeHtml(level, riskWords)
      : '<span class="dp-badge dp-badge--' + level + '"><span>' + esc(riskWords) + '</span></span>';
    // An earned verification is the tick after the name; a reviewed or
    // imported walk still says so in a chip.
    var provenance = '';
    if (trust && trust.tierBadgeStyle(trail) !== 'verified') {
      provenance = icons ? icons.badgeHtml(trust.tierBadgeStyle(trail), trust.tierLabel(trail))
        : '<span class="badge-pill">' + esc(trust.tierLabel(trail)) + '</span>';
    }
    var season = '';
    var words = root.DoloPawsTrailSeasonWords;
    var best = words ? words.bestTime(trail.season, true) : '';
    if (best) {
      var month = new Date().getMonth() + 1;
      var outLabel = words.outOfSeasonTag(trail.season, month, true);
      var sunTag = words.winterSunTag ? words.winterSunTag(trail.season, month) : null;
      season = (outLabel ? '<span class="browse-season browse-season--out">' + esc(outLabel) + '</span>' : '') +
        '<span class="browse-season browse-season--best">' + esc(best) + '</span>' +
        (words.dogSeasonsNow ? words.dogSeasonsNow(trail.season, month) : []).map(function (r) {
          return '<span class="browse-season browse-season--dog">' + esc(r.label) + '</span>';
        }).join('') +
        // "Sunny in winter" or "Little winter sun", November to February.
        (sunTag ? '<span class="browse-season browse-season--sun-' + sunTag.kind + '">' + esc(sunTag.label) + '</span>' : '');
    }
    return risk + provenance + season;
  }

  function tick(trail) {
    var trust = root.DoloPawsTrailTrust;
    if (!trust || trust.tierBadgeStyle(trail) !== 'verified') return '';
    var label = esc(trust.tierLabel(trail));
    return '<svg class="tcard__tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
      'stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="' + label + '"><title>' + label + '</title>' +
      '<circle cx="12" cy="12" r="9.5"/><path d="m8 12 3 3 5-6"/></svg>';
  }

  // "For Teo" / "For a medium dog", the words the Trails page uses.
  function forDog(name) {
    var guest = tr('recommendation.subject.guest', 'a medium dog');
    return tr('browse.card.forDog', 'For {name}', { name: name || guest });
  }

  // "Strong option for a medium dog" on the photo: the verdict first, whose
  // verdict it is after it, in small type. `who` is forDog()'s words.
  function pill(verdict, who, extraClass) {
    if (!verdict || !verdict.label) return '';
    var small = who ? String(who) : '';
    small = small.charAt(0).toLowerCase() + small.slice(1);
    return '<span class="tcard__verdict tcard__verdict--' + esc(verdict.tone || 'great') +
      (extraClass ? ' ' + extraClass : '') + '">' +
      esc(verdict.label) + (small ? ' <small>' + esc(small) + '</small>' : '') + '</span>';
  }

  /**
   * The card. options:
   *   tag        'button' (default, opened through data-href) or 'a'
   *   href       where it opens
   *   className  extra classes on the card ('hp-ccard', 'li-pick')
   *   photo      the photo markup (an <img> or a trail-visual)
   *   verdict    { label, tone } from match-verdict.js, or null for none
   *   who        forDog() words for the verdict
   *   name       the walk's display name
   *   attrs      extra attribute string, already escaped
   *   parts      optional class names per part: { name, meta, verdict }
   */
  function html(trail, options) {
    var o = options || {};
    var parts = o.parts || {};
    var cls = 'tcard' + (o.className ? ' ' + o.className : '');
    var open = o.tag === 'a'
      ? '<a class="' + cls + '" href="' + esc(o.href) + '"' + (o.attrs || '') + '>'
      : '<button type="button" class="' + cls + '" data-href="' + esc(o.href) + '"' + (o.attrs || '') + '>';
    var close = o.tag === 'a' ? '</a>' : '</button>';
    return open +
      '<span class="tcard__photo">' + (o.photo || '') + pill(o.verdict, o.who, parts.verdict) + '</span>' +
      '<span class="tcard__body">' +
        '<span class="tcard__name' + (parts.name ? ' ' + parts.name : '') + '">' + esc(o.name || trail.name) + tick(trail) + '</span>' +
        '<span class="tcard__meta' + (parts.meta ? ' ' + parts.meta : '') + '">' + esc(metaLine(trail)) + '</span>' +
        '<span class="tcard__chips">' + chips(trail) + '</span>' +
      '</span>' +
    close;
  }

  var api = { html: html, metaLine: metaLine, chips: chips, tick: tick, pill: pill, forDog: forDog, km: km };
  root.ORMATrailCard = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
