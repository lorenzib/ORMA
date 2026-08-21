/**
 * homepage-search.js — controller for the redesigned logged-out homepage
 * (search-first hero + live suggestions + consolidated filters + dog
 * mini-wizard), ported from the Claude Design prototype
 * "ORMA Homepage - final.dc.html" and wired to REAL data + scoring:
 *   - `trails` (trails-data.js + osm-*.js)
 *   - `scoreTrail` / `effectiveOverrides` (scoring.js)
 *   - `pathThumbnailSvg`, `trailSafetyLabel`, `safetyClass` (script.js)
 * The redesign only owns the #newCustomerHomepage block; the returning-user
 * homepage, auth wiring and the full dog wizard are untouched.
 */
(function () {
  'use strict';

  var root = document.getElementById('newCustomerHomepage');
  if (!root) return;

  // Bail out gracefully if the scoring/data globals never loaded.
  function ready() {
    return typeof trails !== 'undefined' && Array.isArray(trails) &&
      typeof scoreTrail === 'function' && typeof effectiveOverrides === 'function';
  }

  // ---- Preset "preview as" dogs, expressed as REAL profile objects so
  //      scoreTrail/effectiveOverrides read them with zero translation. ----
  var PRESETS = {
    medium: { key: 'medium', name: 'Medium dog', sub: 'Guest default', emoji: '🐾', badge: '🐾',
              chipBg: 'var(--sage-dim)', chipColor: 'var(--ink)',
              profile: { name: 'Medium dog', breed: '', fitness: 'moderate', conditions: [], weightBand: '15-20' } },
    rufus:  { key: 'rufus', name: 'Rufus', sub: 'Large · heat-sensitive', emoji: '🐕', badge: 'R',
              chipBg: 'var(--accent)', chipColor: '#fff',
              profile: { name: 'Rufus', breed: '', fitness: 'moderate', conditions: ['heat'], weightBand: '30-40' } },
    bella:  { key: 'bella', name: 'Bella', sub: 'Small · takes it easy', emoji: '🐕', badge: 'B',
              chipBg: '#8A5A16', chipColor: '#fff',
              profile: { name: 'Bella', breed: '', fitness: 'low', conditions: [], weightBand: '5-10' } },
    milo:   { key: 'milo', name: 'Milo', sub: 'High energy', emoji: '🐕', badge: 'M',
              chipBg: 'var(--success)', chipColor: '#fff',
              profile: { name: 'Milo', breed: '', fitness: 'high', conditions: [], weightBand: '15-20' } },
  };

  var state = {
    query: '', dog: 'medium',
    dist: 'any', diff: 'any', terrain: 'any', shade: 'any', minMatch: 0, hasWater: false,
    searched: false, focused: false, menu: null, custom: null, activeSuggest: -1,
    wizOpen: false, wizStep: 0,
    wiz: { name: '', size: 'medium', energy: 'medium', terrainTol: 'gravel', heat: false },
  };

  // Shared discovery vocabulary: these labels and thresholds match Browse All
  // Trails and the logged-in map so a filter always means the same thing.
  var DIST_SEG = [{ label: 'Any', v: 'any' }, { label: 'Under 5 km', v: 'u5' }, { label: '5–10 km', v: '5to10' }, { label: '10 km+', v: '10p' }];
  var DIFF_SEG = [{ label: 'Any', v: 'any' }, { label: 'Low risk', v: 'low-risk' }, { label: 'Moderate', v: 'moderate' }, { label: 'Caution', v: 'caution' }];
  var TERRAIN_SEG = [{ label: 'Any', v: 'any' }, { label: 'Gentle only', v: 'soft' }, { label: 'Up to mixed', v: 'mixed' }, { label: 'Rocky is okay', v: 'rocky' }];
  var SHADE_SEG = [{ label: 'Any', v: 'any' }, { label: 'Over 40%', v: '40' }, { label: 'Over 60%', v: '60' }];
  var MATCH_SEG = [{ label: 'Any', v: 0 }, { label: '60%+', v: 60 }, { label: '75%+', v: 75 }, { label: '85%+', v: 85 }];

  var POPULAR = [
    { label: 'Lago di Braies', apply: function () { state.query = 'Braies'; state.searched = true; } },
    { label: 'Alpe di Siusi', apply: function () { state.query = 'Alpe di Siusi'; state.searched = true; } },
    { label: 'Shady & short', apply: function () { state.query = ''; state.shade = '40'; state.dist = 'u5'; state.searched = true; } },
    { label: 'Near water', apply: function () { state.query = 'Carezza'; state.searched = true; } },
  ];

  // ---- element refs ----
  var el = {
    search: document.getElementById('hpSearch'),
    dogPill: document.getElementById('hpDogPill'),
    dogLabel: document.getElementById('hpDogLabel'),
    dogEmoji: root.querySelector('.hp-dog-emoji'),
    dogMenu: document.getElementById('hpDogMenu'),
    dogOptions: document.getElementById('hpDogOptions'),
    filtersBtn: document.getElementById('hpFiltersBtn'),
    filtersBadge: document.getElementById('hpFiltersBadge'),
    filtersPanel: document.getElementById('hpFiltersPanel'),
    filtersReset: document.getElementById('hpFiltersReset'),
    filtersApply: document.getElementById('hpFiltersApply'),
    distSeg: document.getElementById('hpDistSeg'),
    diffSeg: document.getElementById('hpDiffSeg'),
    terrainSeg: document.getElementById('hpTerrainSeg'),
    shadeSeg: document.getElementById('hpShadeSeg'),
    matchSeg: document.getElementById('hpMatchSeg'),
    matchLabel: document.getElementById('hpMatchLabel'),
    waterToggle: document.getElementById('hpWaterToggle'),
    suggest: document.getElementById('hpSuggest'),
    searchStatus: document.getElementById('hpSearchStatus'),
    searchBtn: document.getElementById('hpSearchBtn'),
    popular: document.getElementById('hpPopular'),
    guestTitle: document.getElementById('hpGuestTitle'),
    guestSub: document.getElementById('hpGuestSub'),
    guestCta: document.getElementById('hpGuestCta'),
    content: document.getElementById('hpContent'),
    wizard: document.getElementById('hpWizard'),
    wizBody: document.getElementById('hpWizBody'),
    wizStepLabel: document.getElementById('hpWizStepLabel'),
    wizTitle: document.getElementById('hpWizTitle'),
    wizBars: [document.getElementById('hpWizBar1'), document.getElementById('hpWizBar2'), document.getElementById('hpWizBar3')],
    wizFoot: document.querySelector('#hpWizard .hp-wiz-foot'),
    wizBack: document.getElementById('hpWizBack'),
    wizNext: document.getElementById('hpWizNext'),
    wizClose: document.getElementById('hpWizClose'),
  };

  // ---- helpers ----
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  function activeProfile() {
    if (state.dog === 'custom' && state.custom) return state.custom.profile;
    return (PRESETS[state.dog] || PRESETS.medium).profile;
  }
  function dogMeta() {
    if (state.dog === 'custom' && state.custom) return state.custom.meta;
    return PRESETS[state.dog] || PRESETS.medium;
  }

  function scoreOf(t) {
    try { return scoreTrail(t, effectiveOverrides(activeProfile(), null)); }
    catch (e) { return 0; }
  }

  function tier(s) {
    if (s >= 75) return { bg: '#DCEBDD', color: '#2C5C34', label: 'Great match', kind: 'great' };
    if (s >= 55) return { bg: '#F5E4C6', color: '#8A5A16', label: 'Good', kind: 'good' };
    return { bg: '#F3D9D2', color: '#9C3A25', label: 'Check first', kind: 'check' };
  }

  // The one taxonomy the whole product uses: the trail rating.
  function difficulty(t) {
    var level = t && ['low-risk', 'moderate', 'caution'].indexOf(t.safetyLevel) !== -1
      ? t.safetyLevel : 'moderate';
    var map = {
      'low-risk': { label: 'Low-risk', dot: '#2C5C34' },
      'moderate': { label: 'Moderate', dot: '#8A5A16' },
      'caution': { label: 'Caution', dot: '#9C3A25' },
    };
    return { value: level, label: map[level].label, dot: map[level].dot };
  }

  var TONE = { low: 'background:#DCEBDD;color:#2C5C34', mod: 'background:#F5E4C6;color:#8A5A16', caution: 'background:#F3D9D2;color:#9C3A25' };
  function badgesFor(t) {
    var out = [];
    var rank = typeof t.terrainRank === 'number' ? t.terrainRank : 1;
    if (rank <= 0) out.push({ label: 'Graded ground', tone: 'low' });
    else if (rank >= 2) out.push({ label: 'Rocky', tone: 'caution' });
    else out.push({ label: 'Mixed terrain', tone: 'mod' });
    var sc = typeof t.shadeCoverage === 'number' ? t.shadeCoverage : 0;
    if (sc >= 60) out.push({ label: 'Fully shaded', tone: 'low' });
    else if (sc >= 30) out.push({ label: 'Part shade', tone: 'mod' });
    else out.push({ label: 'Little shade', tone: 'mod' });
    if (hasWater(t)) out.push({ label: 'Water access', tone: 'low' });
    return out;
  }

  function hasWater(t) { return Array.isArray(t.waterSources) && t.waterSources.length > 0; }

  var responsiveThumbs = {
    'images/lago-di-braies.webp':'images/lago-di-braies-480.webp',
    'images/lago-di-carezza.webp':'images/lago-di-carezza-480.webp',
    'images/boucle-du-marais-des-chassettes.webp':'images/boucle-du-marais-des-chassettes-480.webp',
    'images/circuit-beatrice-de-savoie.webp':'images/circuit-beatrice-de-savoie-480.webp',
    'images/itineraire-decouverte-de-la-nature.webp':'images/itineraire-decouverte-de-la-nature-480.webp',
  };

  function thumb(t) {
    if (t.imageIcon) return '<img src="' + esc(responsiveThumbs[t.imageIcon] || t.imageIcon) + '" alt="" loading="lazy" decoding="async">';
    if (typeof pathThumbnailSvg === 'function') { var s = pathThumbnailSvg(t.path); if (s) return s; }
    return '';
  }
  function canonicalBrowseState() {
    return {
      search: state.query,
      distance: state.dist === 'any' ? '' : String(state.dist),
      water: state.hasWater,
      dog: state.dog,
      risk: state.diff === 'any' ? '' : state.diff,
      terrain: state.terrain === 'any' ? '' : state.terrain,
      heat: state.shade === '40' ? 'shade-40' : state.shade === '60' ? 'shade-60' : '',
      minMatch: state.minMatch ? String(state.minMatch) : '',
    };
  }

  function browseHref() {
    return window.DoloPawsDiscoveryState
      ? window.DoloPawsDiscoveryState.browseHref(canonicalBrowseState())
      : 'browse-trails.html';
  }

  function trailHref(t) {
    return window.DoloPawsDiscoveryState
      ? window.DoloPawsDiscoveryState.trailHref(t.id, canonicalBrowseState())
      : 'trail.html?id=' + encodeURIComponent(t.id);
  }
  function valleyOf(t) { return t.valley || t.area || ''; }

  function filterCount() {
    return [state.dist !== 'any', state.diff !== 'any', state.terrain !== 'any',
      state.shade !== 'any', state.minMatch > 0, state.hasWater].filter(Boolean).length;
  }

  function rankedList() {
    var q = state.query.trim().toLowerCase();
    return trails.filter(function (t) {
      if (q) {
        var hay = (t.name + ' ' + (t.area || '') + ' ' + (t.valley || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (state.dist === 'u5' && t.distance >= 5) return false;
      if (state.dist === '5to10' && (t.distance < 5 || t.distance > 10)) return false;
      if (state.dist === '10p' && t.distance < 10) return false;
      if (state.shade === '40' && (t.shadeCoverage || 0) < 40) return false;
      if (state.shade === '60' && (t.shadeCoverage || 0) < 60) return false;
      if (state.terrain !== 'any') {
        var rank = typeof t.terrainRank === 'number' ? t.terrainRank : 1;
        if (state.terrain === 'soft' && rank > 0) return false;
        if (state.terrain === 'mixed' && rank > 1) return false;
        if (state.terrain === 'rocky' && rank > 2) return false;
      }
      if (state.diff !== 'any' && difficulty(t).value !== state.diff) return false;
      if (state.hasWater && !hasWater(t)) return false;
      return true;
    }).map(function (t) {
      return { t: t, score: scoreOf(t) };
    }).filter(function (e) {
      return state.minMatch === 0 || e.score >= state.minMatch;
    }).sort(function (a, b) { return b.score - a.score; });
  }

  // ---- weekly featured collection (rotating editorial catalogue) ----
  function weeklyCollection() {
    var catalogue = window.DoloPawsCollections;
    var collections = catalogue && typeof catalogue.all === 'function' ? catalogue.all() : [];
    if (!collections.length) return null;
    var now = new Date();
    var wk = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / (7 * 86400000));
    return collections[wk % collections.length];
  }
  function featured(collection) {
    var catalogue = window.DoloPawsCollections;
    var selected = collection && catalogue && typeof catalogue.trailsFor === 'function'
      ? catalogue.trailsFor(collection, trails)
      : [];
    return selected
      .map(function (t) { return { t: t, score: scoreOf(t) }; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, 3);
  }

  // ---- renderers ----
  function renderDogPill() {
    var m = dogMeta();
    el.dogLabel.textContent = m.name;
    el.dogEmoji.textContent = m.emoji;
  }

  function renderDogMenu() {
    var keys = state.custom ? ['custom', 'medium', 'rufus', 'bella', 'milo'] : ['medium', 'rufus', 'bella', 'milo'];
    el.dogOptions.innerHTML = keys.map(function (k) {
      var m = k === 'custom' ? state.custom.meta : PRESETS[k];
      var check = k === state.dog ? '<span class="hp-menu-check">✓</span>' : '';
      return '<button type="button" class="hp-menu-item" data-dog="' + k + '">' +
        '<span class="hp-menu-avatar" style="background:' + m.chipBg + ';color:' + m.chipColor + '">' + esc(m.badge) + '</span>' +
        '<span style="flex:1"><span class="hp-mi-name">' + esc(m.name) + '</span><span class="hp-mi-sub">' + esc(m.sub) + '</span></span>' +
        check + '</button>';
    }).join('');
  }

  function segHtml(opts, cur, kind) {
    return opts.map(function (o) {
      var sel = String(cur) === String(o.v) ? ' sel' : '';
      return '<button type="button" class="hp-segbtn' + sel + '" data-seg="' + kind + '" data-val="' + o.v + '">' + esc(o.label) + '</button>';
    }).join('');
  }

  function renderFiltersPanel() {
    el.distSeg.innerHTML = segHtml(DIST_SEG, state.dist, 'dist');
    el.diffSeg.innerHTML = segHtml(DIFF_SEG, state.diff, 'diff');
    el.terrainSeg.innerHTML = segHtml(TERRAIN_SEG, state.terrain, 'terrain');
    el.shadeSeg.innerHTML = segHtml(SHADE_SEG, state.shade, 'shade');
    el.matchSeg.innerHTML = segHtml(MATCH_SEG, state.minMatch, 'minMatch');
    el.matchLabel.textContent = 'Minimum match for ' + dogMeta().name;
    el.waterToggle.classList.toggle('on', state.hasWater);
    el.waterToggle.setAttribute('aria-checked', state.hasWater ? 'true' : 'false');
    var n = rankedList().length;
    el.filtersApply.textContent = 'Show ' + n + ' ' + (n === 1 ? 'trail' : 'trails');
  }

  function renderFiltersButton() {
    var n = filterCount();
    el.filtersBadge.textContent = n > 0 ? ' · ' + n : '';
    el.filtersBtn.classList.toggle('hp-filt-on', n > 0);
  }

  function renderGuestBar() {
    if (state.dog === 'custom' && state.custom) {
      el.guestTitle.textContent = 'Scores are personalised for ' + state.custom.meta.name + '.';
      el.guestSub.textContent = 'Browse all trails to see ' + state.custom.meta.name + '’s complete ranking.';
      el.guestCta.textContent = 'Browse ' + state.custom.meta.name + '’s matches';
    } else if (state.dog === 'medium') {
      el.guestTitle.textContent = 'Scores use a medium-dog profile.';
      el.guestSub.textContent = 'Add your dog for personalised matches. Create a free account only when you choose to save.';
      el.guestCta.textContent = 'Add your dog';
    } else {
      el.guestTitle.textContent = 'Previewing scores for ' + dogMeta().name + '.';
      el.guestSub.textContent = 'Add your own dog to tune every score to them.';
      el.guestCta.textContent = 'Add your dog';
    }
  }

  // ---- live search suggestions ----
  function showingSuggest() {
    return state.focused && state.query.trim() !== '' && !state.searched;
  }

  function renderSuggest() {
    var open = showingSuggest();
    el.suggest.hidden = !open;
    el.search.setAttribute('aria-expanded', open ? 'true' : 'false');
    var scrim = document.getElementById('hpSuggestScrim');
    if (open && !scrim) {
      scrim = document.createElement('div');
      scrim.id = 'hpSuggestScrim';
      scrim.className = 'hp-suggest-scrim';
      scrim.addEventListener('click', function () { state.focused = false; renderSuggest(); });
      document.body.appendChild(scrim);
    } else if (!open && scrim) {
      scrim.remove();
    }
    if (!open) {
      state.activeSuggest = -1;
      el.search.removeAttribute('aria-activedescendant');
      return;
    }

    var m = dogMeta();
    var list = rankedList();
    var n = list.length;
    var countTxt = n + ' ' + (n === 1 ? 'trail' : 'trails');
    if (!n) {
      el.suggest.innerHTML =
        '<div class="hp-sug-empty"><div class="hp-sug-empty-h">No trails match “' + esc(state.query.trim()) + '”</div>' +
        '<p>Try a different valley, or loosen a filter.</p>' +
        '<button type="button" data-action="reset">Reset filters</button></div>';
      el.search.removeAttribute('aria-activedescendant');
      if(el.searchStatus) el.searchStatus.textContent = 'No trail suggestions found.';
      return;
    }
    el.suggest.innerHTML =
      '<div class="hp-sug-head"><span class="hp-sug-kick">' +
        '<span class="hp-sug-chip" style="background:' + m.chipBg + ';color:' + m.chipColor + '">' + esc(m.badge) + '</span>' +
        'Top matches for ' + esc(m.name) + '</span><span class="hp-sug-count">' + countTxt + '</span></div>' +
      list.slice(0, 5).map(function (entry, index) {
        var t = entry.t, s = entry.score, ti = tier(s), df = difficulty(t);
        return '<button type="button" class="hp-sug-item" id="hpSuggestion' + index + '" role="option" aria-selected="' + (state.activeSuggest === index ? 'true' : 'false') + '" data-href="' + esc(trailHref(t)) + '">' +
          '<span class="hp-sug-thumb">' + thumb(t) + '</span>' +
          '<span class="hp-sug-main"><span class="hp-sug-name">' + esc(t.name) + '</span>' +
          '<span class="hp-sug-meta"><span class="hp-badge-dot" style="background:' + df.dot + '"></span>' + df.label +
          '<span class="hp-sug-sep">·</span>' + esc(t.distance) + ' km · ' + esc(valleyOf(t)) + '</span></span>' +
          '<span class="hp-sug-match"><span class="pct" style="color:' + ti.color + '">' + s + '<span>%</span></span><span class="lab">match</span></span>' +
        '</button>';
      }).join('') +
      '<button type="button" class="hp-sug-more" data-action="search">' +
        '<span>See all ' + countTxt + ' for “' + esc(state.query.trim()) + '” →</span>' +
        '<span class="hp-sug-key">↵ Enter</span></button>';
    var options = el.suggest.querySelectorAll('[role="option"]');
    if(state.activeSuggest >= options.length) state.activeSuggest = options.length - 1;
    if(state.activeSuggest >= 0) el.search.setAttribute('aria-activedescendant', 'hpSuggestion' + state.activeSuggest);
    else el.search.removeAttribute('aria-activedescendant');
    if(el.searchStatus) el.searchStatus.textContent = countTxt + ' found. Use the up and down arrow keys to review the top matches.';
  }

  // ---- main content: results OR browse sections ----
  function rowHtml(entry) {
    var t = entry.t, s = entry.score, ti = tier(s), df = difficulty(t);
    var badges = '<span class="hp-badge hp-badge-diff"><span class="hp-badge-dot" style="background:' + df.dot + '"></span>' + df.label + '</span>' +
      badgesFor(t).map(function (b) { return '<span class="hp-badge" style="' + TONE[b.tone] + '">' + esc(b.label) + '</span>'; }).join('');
    return '<button type="button" class="hp-trailrow" data-href="' + esc(trailHref(t)) + '">' +
      '<span class="hp-trailrow-thumb">' + thumb(t) + '</span>' +
      '<span class="hp-trailrow-main">' +
        '<span class="hp-trailrow-name">' + esc(t.name) + '</span>' +
        '<span class="hp-trailrow-meta">' + esc(t.distance) + ' km · +' + esc(t.elevation || 0) + ' m · ' + esc(valleyOf(t)) + '</span>' +
        '<span class="hp-badges">' + badges + '</span>' +
      '</span>' +
      '<span class="hp-trailrow-match">' +
        '<span class="hp-match-pct" style="color:' + ti.color + '">' + s + '<span>%</span></span>' +
        '<span class="hp-tier" style="background:' + ti.bg + ';color:' + ti.color + '">' + ti.label + '</span>' +
      '</span>' +
    '</button>';
  }

  function ccardHtml(entry, tags) {
    var t = entry.t, s = entry.score, ti = tier(s), df = difficulty(t);
    var riskBadge = window.DoloPawsIcons
      ? window.DoloPawsIcons.badgeHtml(df.value, df.label)
      : '<span class="dp-badge dp-badge--' + df.value + '"><span>' + esc(df.label) + '</span></span>';
    return '<button type="button" class="hp-ccard" data-href="' + esc(trailHref(t)) + '">' +
      '<span class="hp-ccard-img">' + thumb(t) + '</span>' +
      '<span class="hp-ccard-body">' +
        '<span class="hp-ccard-name">' + esc(t.name) + '</span>' +
        '<span class="hp-ccard-meta">' + tags + '</span>' +
        '<span class="hp-ccard-footer"><span class="hp-ccard-rating">' + riskBadge + '</span>' +
          '<span class="hp-ccard-match hp-ccard-match--' + ti.kind + '">' +
            '<span class="hp-ccard-score"><strong>' + s + '<span>%</span></strong><small>MATCH FOR YOUR DOG</small></span>' +
          '</span></span>' +
      '</span>' +
    '</button>';
  }

  var HOW_CARDS = [
    { title: '1 · We assess the trail',
      image: 'images/orma-how-assess.jpg?v=20260821-4',
      image2x: 'images/orma-how-assess-1920.jpg?v=20260821-4',
      alt: 'A marked mountain trail crossing rocky alpine terrain',
      text: 'We assess the mountain first: ground, effort, exposure, shade, water and access. The trail baseline is the same for every dog.' },
    { title: '2 · You add your dog',
      image: 'images/orma-how-dog.jpg?v=20260821-4',
      image2x: 'images/orma-how-dog-1920.jpg?v=20260821-4',
      alt: 'Freddy standing in an alpine meadow',
      text: 'Your dog’s fitness, life stage, health and build set comfortable limits. Anything you leave blank stays neutral.' },
    { title: '3 · We explain the match',
      image: 'images/orma-how-match.jpg?v=20260821-4',
      image2x: 'images/orma-how-match-1920.jpg?v=20260821-4',
      alt: 'A dog and human walking together on a Dolomites trail',
      text: 'We compare the route with those limits, then show the match score, the cautions that matter and why they matter.' },
  ];

  function renderContent() {
    if (state.searched) {
      var list = rankedList();
      var q = state.query.trim();
      var title = q ? 'Trails matching “' + esc(q) + '”' : 'Filtered trails';
      var sub = list.length + ' ' + (list.length === 1 ? 'trail' : 'trails') + ' · ranked for ' + esc(dogMeta().name);
      var body;
      if (list.length) {
        body = '<div class="hp-list">' + list.map(rowHtml).join('') + '</div>';
      } else {
        body = '<div class="hp-empty"><h3>No trails match those filters</h3>' +
          '<p>Try widening your distance or clearing a filter.</p>' +
          '<button type="button" class="hp-search-btn" data-action="reset">Reset filters</button></div>';
      }
      el.content.innerHTML =
        '<div class="hp-results-head"><div><div class="hp-results-title">' + title + '</div>' +
        '<div class="hp-results-sub">' + sub + '</div></div>' +
        '<button type="button" class="hp-clear" data-action="clear">Clear search</button></div>' + body;
    } else {
      var collection = weeklyCollection();
      var feat = featured(collection);
      var isGuest = state.dog === 'medium';
      var featTitle = collection ? collection.title : 'Trails selected for your dog';
      var featSub = collection ? collection.subtitle : 'Published routes ranked for the dog you are browsing with';
      var featRankLine = isGuest
        ? 'Browsing as a guest, ranked for a medium dog.'
        : (state.dog === 'custom'
          ? 'Browsing with ' + dogMeta().name + ', with trails ranked for them.'
          : 'Previewing as ' + dogMeta().name + ', with trails ranked for them.');
      var featProfileCta = state.dog === 'custom' ? 'Save profile →' : "Create your dog's profile →";
      var how = HOW_CARDS.map(function (c) {
        var text = c.text || 'We map and review each published trail for route shape, terrain, climb, shade, water, access and hazards.';
        return '<div class="hp-howcard">' +
          '<div class="hp-howcard-media"><img src="' + c.image + '" srcset="' + c.image + ' 1x, ' + c.image2x + ' 2x" alt="' + esc(c.alt) + '" loading="lazy" decoding="async" width="960" height="600"></div>' +
          '<div class="hp-howcard-copy"><div class="hp-howcard-title">' + esc(c.title) + '</div>' +
          '<p>' + esc(text) + '</p></div></div>';
      }).join('');
      el.content.innerHTML =
        '<section class="hp-mission" aria-labelledby="hpMissionTitle">' +
          '<div class="hp-mission-copy"><div class="hp-mission-kick">Our mission</div>' +
          '<h2 id="hpMissionTitle">The route must adapt to the dog, never the other way around.</h2>' +
          '<p>Every dog moves differently. ORMA helps you choose trails with their needs, pace and limits in mind.</p></div>' +
          '<blockquote class="hp-mission-quote"><p>“A walk is never just a walk when shared with a dog. It is an act of partnership, curiosity, and joy.”</p><cite>– ORMA Team</cite></blockquote>' +
        '</section>' +
        '<section class="hp-how" aria-labelledby="hpHowTitle">' +
          '<div class="hp-section-head"><div><div class="hp-kick">How ORMA works</div>' +
          '<h2 class="hp-how-h2" id="hpHowTitle">How trail evidence becomes practical guidance for your dog</h2></div></div>' +
          '<div class="hp-how-grid">' + how + '</div>' +
          '<a class="hp-how-link" href="how-scoring-works.html">See how ORMA assesses a trail →</a>' +
        '</section>' +
        '<section class="hp-featured" aria-labelledby="hpFeaturedTitle">' +
          '<div class="hp-coll-head"><div>' +
            '<div class="hp-kick hp-kick-left">Featured this week</div>' +
            '<h2 class="hp-feat-h2" id="hpFeaturedTitle">' + esc(featTitle) + '</h2>' +
            '<p class="hp-coll-sub">' + esc(featSub) + '</p>' +
            '<p class="hp-coll-rank-row"><strong>' + esc(featRankLine) + '</strong> <button type="button" class="hp-coll-profile-cta" data-action="create-dog-profile">' + esc(featProfileCta) + '</button></p></div></div>' +
          '<div class="hp-coll-grid">' + feat.map(function (entry) {
            return ccardHtml(entry, esc(entry.t.distance) + ' km · ' + esc(valleyOf(entry.t)));
          }).join('') + '</div>' +
          '<a class="hp-how-link" href="browse-trails.html">Browse more →</a>' +
        '</section>';
    }
  }

  function closeMenus() { state.menu = null; syncMenus(); }

  function syncMenus() {
    var map = { dog: el.dogMenu, filters: el.filtersPanel };
    var btns = { dog: el.dogPill, filters: el.filtersBtn };
    Object.keys(map).forEach(function (k) {
      var open = state.menu === k;
      map[k].hidden = !open;
      btns[k].setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    var scrim = document.getElementById('hpMenuScrim');
    if (state.menu && !scrim) {
      scrim = document.createElement('div');
      scrim.id = 'hpMenuScrim';
      scrim.className = 'hp-menu-scrim';
      scrim.addEventListener('click', closeMenus);
      document.body.appendChild(scrim);
    } else if (!state.menu && scrim) {
      scrim.remove();
    }
  }

  function renderAll() {
    renderDogPill();
    renderDogMenu();
    renderFiltersPanel();
    renderFiltersButton();
    renderGuestBar();
    renderSuggest();
    renderContent();
  }

  function resetFilters() {
    state.dist = 'any'; state.diff = 'any'; state.terrain = 'any';
    state.shade = 'any'; state.minMatch = 0; state.hasWater = false;
  }

  function runSearch() {
    window.location.href = browseHref();
  }

  // ---- static one-time setup ----
  function setupStatic() {
    el.popular.innerHTML = POPULAR.map(function (p, i) {
      return '<button type="button" class="hp-chip" data-pop="' + i + '">' + esc(p.label) + '</button>';
    }).join('');
  }

  // ---- mini-wizard ----
  var SIZE_OPTS = [{ label: 'Small', v: 'small' }, { label: 'Medium', v: 'medium' }, { label: 'Large', v: 'large' }];
  var ENERGY_OPTS = [{ label: 'Low', v: 'low' }, { label: 'Medium', v: 'medium' }, { label: 'High', v: 'high' }];
  var TERRAINTOL_OPTS = [{ label: 'Soft ground only', v: 'soft' }, { label: 'Some gravel is fine', v: 'gravel' }, { label: 'Anything, including rock', v: 'any' }];
  var HEAT_OPTS = [{ label: 'Yes, gets hot easily', v: true }, { label: 'No, handles heat fine', v: false }];
  var releaseWizardFocus = null;

  function optBtns(opts, cur, field, col) {
    return '<div class="hp-wiz-opts' + (col ? ' col' : '') + '">' + opts.map(function (o) {
      var sel = String(cur) === String(o.v) ? ' sel' : '';
      return '<button type="button" class="hp-wiz-opt' + sel + '" aria-pressed="' + (sel ? 'true' : 'false') + '" data-wfield="' + field + '" data-wval="' + o.v + '">' + esc(o.label) + '</button>';
    }).join('') + '</div>';
  }

  function renderWizard() {
    var w = state.wiz;
    if (state.wizStep === 3) {
      var matches = trails.map(function (t) { return { t: t, score: scoreOf(t) }; })
        .sort(function (a, b) { return b.score - a.score; });
      var dogName = state.custom ? state.custom.meta.name : ((w.name || '').trim() || 'Your dog');
      el.wizStepLabel.textContent = 'Your matches';
      el.wizTitle.textContent = dogName + '’s profile is ready';
      el.wizBars.forEach(function (b) { if (b) b.className = 'on'; });
      if (el.wizFoot) el.wizFoot.hidden = true;
      el.wizBody.innerHTML = '<div class="hp-wiz-payoff">' +
        '<p class="hp-wiz-payoff-lead">We ranked ' + matches.length + ' trails using ' + esc(dogName) + '’s size, energy and sensitivities. Here are the strongest matches.</p>' +
        '<div class="hp-wiz-matches">' + matches.slice(0, 3).map(function (entry) {
          var t = entry.t, ti = tier(entry.score);
          return '<a class="hp-wiz-match" href="' + esc(trailHref(t)) + '">' +
            '<span><b>' + esc(t.name) + '</b><small>' + esc(t.distance) + ' km · ' + esc(valleyOf(t)) + '</small></span>' +
            '<strong style="color:' + ti.color + '">' + entry.score + '%</strong></a>';
        }).join('') + '</div>' +
        '<div class="hp-wiz-payoff-actions">' +
          '<button type="button" id="hpSaveAndBrowseBtn" class="hp-search-btn">Save profile and see all matches</button>' +
          '<button type="button" id="hpBrowseWithoutSavingBtn" class="hp-wiz-secondary">See all matches without saving</button>' +
        '</div>' +
        '<p class="hp-wiz-device-note">Without an account, this profile stays only on this device.</p>' +
      '</div>';
      return;
    }
    el.wizTitle.textContent = 'Tell us about your dog';
    if (el.wizFoot) el.wizFoot.hidden = false;
    el.wizStepLabel.textContent = 'Step ' + (state.wizStep + 1) + ' of 3';
    el.wizBars.forEach(function (b, i) { if (b) b.className = i <= state.wizStep ? 'on' : ''; });
    el.wizBack.textContent = state.wizStep === 0 ? 'Cancel' : '← Back';
    el.wizNext.textContent = state.wizStep === 2 ? 'See my trails →' : 'Next →';
    var body = '';
    if (state.wizStep === 0) {
      body = '<label class="hp-wiz-q" for="hpWizName">Your dog’s name</label>' +
        '<input class="hp-wiz-input" id="hpWizName" type="text" placeholder="e.g. Rufus" value="' + esc(w.name) + '">' +
        '<div class="hp-wiz-q">How big are they?</div>' + optBtns(SIZE_OPTS, w.size, 'size', false);
    } else if (state.wizStep === 1) {
      body = '<div class="hp-wiz-q">Energy level</div>' + optBtns(ENERGY_OPTS, w.energy, 'energy', false) +
        '<div class="hp-wiz-q">What can their paws handle?</div>' + optBtns(TERRAINTOL_OPTS, w.terrainTol, 'terrainTol', true);
    } else {
      body = '<div class="hp-wiz-q">Do they struggle in the heat?</div>' + optBtns(HEAT_OPTS, w.heat, 'heat', true) +
        '<div class="hp-wiz-summary"><div class="hp-wiz-summary-h">Profile summary</div>' +
        summaryRow('Name', (w.name || '').trim() || 'Your dog') +
        summaryRow('Size', cap(w.size)) +
        summaryRow('Energy', cap(w.energy) + ' energy') +
        summaryRow('Terrain', { soft: 'Soft ground only', gravel: 'Some gravel OK', any: 'Any terrain' }[w.terrainTol]) +
        summaryRow('Heat', w.heat ? 'Heat-sensitive' : 'Handles heat fine') +
        '</div>';
    }
    el.wizBody.innerHTML = body;
    var nameInput = document.getElementById('hpWizName');
    if (nameInput) nameInput.addEventListener('input', function (e) { state.wiz.name = e.target.value; });
  }
  function summaryRow(k, v) { return '<div class="hp-wiz-summary-row"><span>' + k + '</span><b>' + esc(v) + '</b></div>'; }

  function focusWizardStep() {
    requestAnimationFrame(function(){
      var target = el.wizBody.querySelector('#hpWizName,.hp-wiz-opt.sel,.hp-wiz-opt');
      if(target) target.focus();
    });
  }
  function openWizard() {
    state.wizOpen = true;
    state.wizStep = 0;
    el.wizard.hidden = false;
    document.body.classList.add('auth-modal-open');
    renderWizard();
    if(window.DoloPawsA11y){
      releaseWizardFocus = window.DoloPawsA11y.openDialog(el.wizard, {
        initialFocus:function(){ return el.wizBody.querySelector('#hpWizName,.hp-wiz-opt'); },
        onEscape:closeWizard,
      });
    } else focusWizardStep();
  }
  function closeWizard() {
    state.wizOpen = false;
    el.wizard.hidden = true;
    document.body.classList.remove('auth-modal-open');
    if(releaseWizardFocus){ releaseWizardFocus(); releaseWizardFocus = null; }
  }

  // Build the SAME profile shape dog-wizard.js:buildProfile() produces, so a
  // later login persists it with zero translation.
  var SIZE_WEIGHT = { small: '5-10', medium: '15-20', large: '30-40' };
  var ENERGY_FITNESS = { low: 'low', medium: 'moderate', high: 'high' };
  function buildCustomProfile() {
    var w = state.wiz;
    var conditions = w.heat ? ['heat'] : [];
    return {
      name: (w.name || '').trim() || 'Your dog',
      breed: '',
      fitness: ENERGY_FITNESS[w.energy] || 'moderate',
      dob: null, ageBand: null,
      weightBand: SIZE_WEIGHT[w.size] || '15-20',
      conditions: conditions,
      healthNotes: '',
      jointIssues: false,
      heatIssues: w.heat,
    };
  }

  function finishWizard() {
    var profile = buildCustomProfile();
    try { localStorage.setItem('dolopaws-pending-dog-profile', JSON.stringify(profile)); } catch (e) {}
    state.custom = {
      profile: profile,
      meta: {
        key: 'custom', name: profile.name, emoji: '⭐',
        sub: cap(state.wiz.size) + ' · ' + state.wiz.energy + ' energy' + (state.wiz.heat ? ' · heat-sensitive' : ''),
        badge: profile.name.charAt(0).toUpperCase(), chipBg: 'var(--ink)', chipColor: '#fff',
      },
    };
    state.dog = 'custom';
    // Reset the browse view to the personalised collection.
    state.searched = false; state.focused = false; state.query = '';
    resetFilters();
    if (el.search) el.search.value = '';
    renderAll();
    state.wizStep = 3;
    renderWizard();
    focusWizardStep();
  }

  // ---- events ----
  function bind() {
    el.search.addEventListener('input', function (e) {
      state.query = e.target.value; state.searched = false; state.focused = true; state.activeSuggest = -1;
      renderSuggest(); renderContent();
    });
    el.search.addEventListener('focus', function () { state.focused = true; renderSuggest(); });
    el.search.addEventListener('keydown', function (e) {
      var options = Array.from(el.suggest.querySelectorAll('[role="option"]'));
      if((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !el.suggest.hidden && options.length){
        e.preventDefault();
        if(state.activeSuggest < 0){
          state.activeSuggest = e.key === 'ArrowDown' ? 0 : options.length - 1;
        }else{
          var delta = e.key === 'ArrowDown' ? 1 : -1;
          state.activeSuggest = (state.activeSuggest + delta + options.length) % options.length;
        }
        renderSuggest();
      } else if(e.key === 'Enter'){
        e.preventDefault();
        var active = state.activeSuggest >= 0 && options[state.activeSuggest];
        if(active) window.location.href = active.getAttribute('data-href');
        else runSearch();
      }
    });
    el.searchBtn.addEventListener('click', runSearch);

    el.dogPill.addEventListener('click', function () { state.menu = state.menu === 'dog' ? null : 'dog'; state.focused = false; syncMenus(); renderSuggest(); });
    el.filtersBtn.addEventListener('click', function () { state.menu = state.menu === 'filters' ? null : 'filters'; state.focused = false; syncMenus(); renderSuggest(); if (state.menu === 'filters') renderFiltersPanel(); });

    el.dogOptions.addEventListener('click', function (e) {
      var b = e.target.closest('[data-dog]'); if (!b) return;
      state.dog = b.getAttribute('data-dog'); closeMenus(); renderAll();
    });

    el.filtersPanel.addEventListener('click', function (e) {
      var seg = e.target.closest('[data-seg]');
      if (seg) {
        var kind = seg.getAttribute('data-seg'), val = seg.getAttribute('data-val');
        if (kind === 'dist') state.dist = val;
        else if (kind === 'minMatch') state.minMatch = parseInt(val, 10);
        else state[kind] = val;
        renderFiltersPanel(); renderFiltersButton();
      }
    });
    el.waterToggle.addEventListener('click', function () {
      state.hasWater = !state.hasWater;
      renderFiltersPanel(); renderFiltersButton();
    });
    el.filtersReset.addEventListener('click', function () {
      resetFilters();
      renderFiltersPanel(); renderFiltersButton();
      if (state.searched) renderContent();
    });
    el.filtersApply.addEventListener('click', runSearch);

    el.suggest.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-href]');
      if (nav) { window.location.href = nav.getAttribute('data-href'); return; }
      var act = e.target.closest('[data-action]');
      if (!act) return;
      var a = act.getAttribute('data-action');
      if (a === 'search') { runSearch(); }
      else if (a === 'reset') { resetFilters(); renderFiltersPanel(); renderFiltersButton(); renderSuggest(); }
    });

    el.popular.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pop]'); if (!b) return;
      POPULAR[parseInt(b.getAttribute('data-pop'), 10)].apply();
      if (el.search) el.search.value = state.query;
      runSearch();
    });

    el.content.addEventListener('click', function (e) {
      var nav = e.target.closest('[data-href]');
      if (nav) { window.location.href = nav.getAttribute('data-href'); return; }
      var act = e.target.closest('[data-action]');
      if (!act) return;
      var a = act.getAttribute('data-action');
      if (a === 'clear') {
        state.query = ''; state.searched = false; state.focused = false;
        resetFilters();
        if (el.search) el.search.value = '';
        renderFiltersPanel(); renderFiltersButton(); renderContent();
      } else if (a === 'reset') {
        resetFilters();
        renderFiltersPanel(); renderFiltersButton(); renderContent();
      } else if (a === 'edit-dog') {
        e.preventDefault();
        state.menu = 'dog';
        state.focused = false;
        syncMenus();
        renderSuggest();
        window.requestAnimationFrame(function () {
          el.dogPill.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.dogPill.focus({ preventScroll: true });
        });
      } else if (a === 'create-dog-profile') {
        e.preventDefault();
        if (state.dog === 'custom' && window.DoloPawsAuthUI) window.DoloPawsAuthUI.openSignup();
        else openWizard();
      }
    });

    el.guestCta.addEventListener('click', function () {
      if (state.dog === 'custom') window.location.href = 'browse-trails.html';
      else openWizard();
    });

    // Mini-wizard
    el.wizClose.addEventListener('click', closeWizard);
    el.wizard.addEventListener('click', function (e) { if (e.target === el.wizard) closeWizard(); });
    el.wizBack.addEventListener('click', function () { if (state.wizStep === 0) closeWizard(); else { state.wizStep--; renderWizard(); focusWizardStep(); } });
    el.wizNext.addEventListener('click', function () { if (state.wizStep < 2) { state.wizStep++; renderWizard(); focusWizardStep(); } else finishWizard(); });
    el.wizBody.addEventListener('click', function (e) {
      if (e.target.closest('#hpSaveAndBrowseBtn')) {
        closeWizard();
        if (window.DoloPawsAuthUI) window.DoloPawsAuthUI.openSignup({ next: 'browse-trails.html' });
        return;
      }
      if (e.target.closest('#hpBrowseWithoutSavingBtn')) {
        window.location.href = 'browse-trails.html';
        return;
      }
      var b = e.target.closest('[data-wfield]'); if (!b) return;
      var field = b.getAttribute('data-wfield'), val = b.getAttribute('data-wval');
      if (field === 'heat') state.wiz.heat = (val === 'true');
      else state.wiz[field] = val;
      renderWizard();
      var selected = el.wizBody.querySelector('[data-wfield="' + field + '"][data-wval="' + val + '"]');
      if(selected) selected.focus();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (state.wizOpen) closeWizard();
        else if (state.menu) closeMenus();
        else if (state.focused) { state.focused = false; renderSuggest(); }
      }
    });
  }

  function init() {
    if (!ready()) return;
    setupStatic();
    bind();
    renderAll();
    // Deep link from the onboarding flow's final CTA: open the dog
    // mini-wizard straight away.
    if (new URLSearchParams(window.location.search).get('wizard') === '1') openWizard();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
