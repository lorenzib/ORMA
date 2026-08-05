/**
 * homepage-search.js — controller for the redesigned logged-out homepage
 * (search-first hero + live suggestions + consolidated filters + dog
 * mini-wizard), ported from the Claude Design prototype
 * "DoloPaws Homepage - final.dc.html" and wired to REAL data + scoring:
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
    dist: 99, diff: 'any', terrain: 'any', shade: 'any', minMatch: 0, hasWater: false,
    searched: false, focused: false, menu: null, custom: null,
    wizOpen: false, wizStep: 0,
    wiz: { name: '', size: 'medium', energy: 'medium', terrainTol: 'gravel', heat: false },
  };

  // Segment options for the consolidated filter panel.
  var DIST_SEG = [{ label: 'Any', v: 99 }, { label: '≤3 km', v: 3 }, { label: '≤6 km', v: 6 }, { label: '≤10 km', v: 10 }];
  var DIFF_SEG = [{ label: 'Any', v: 'any' }, { label: 'Easy', v: 'Easy' }, { label: 'Moderate', v: 'Moderate' }, { label: 'Hard', v: 'Hard' }];
  var TERRAIN_SEG = [{ label: 'Any', v: 'any' }, { label: 'Soft', v: 'soft' }, { label: 'Mixed', v: 'mixed' }, { label: 'Rocky', v: 'rocky' }];
  var SHADE_SEG = [{ label: 'Any', v: 'any' }, { label: 'Prefer shaded', v: 'shade' }];
  var MATCH_SEG = [{ label: 'Any', v: 0 }, { label: '60%+', v: 60 }, { label: '75%+', v: 75 }, { label: '85%+', v: 85 }];

  var POPULAR = [
    { label: 'Lago di Braies', apply: function () { state.query = 'Braies'; state.searched = true; } },
    { label: 'Alpe di Siusi', apply: function () { state.query = 'Alpe di Siusi'; state.searched = true; } },
    { label: 'Shady & short', apply: function () { state.query = ''; state.shade = 'shade'; state.dist = 6; state.searched = true; } },
    { label: 'Near water', apply: function () { state.query = 'Carezza'; state.searched = true; } },
  ];

  // ---- element refs ----
  var el = {
    announceCount: document.getElementById('hpAnnounceCount'),
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
    if (s >= 85) return { bg: '#DCEBDD', color: '#2C5C34', label: 'Great match', pin: '#4A7856' };
    if (s >= 65) return { bg: '#F5E4C6', color: '#8A5A16', label: 'Good match', pin: '#C98A2E' };
    return { bg: '#F3D9D2', color: '#9C3A25', label: 'Check first', pin: '#9C3A25' };
  }

  function difficulty(t) {
    var gain = typeof t.elevation === 'number' ? t.elevation : 0;
    var rank = typeof t.terrainRank === 'number' ? t.terrainRank : 1;
    var d;
    if (gain >= 400 || (rank >= 2 && gain >= 250)) d = 'Hard';
    else if (gain >= 180 || t.distance >= 6 || rank >= 2) d = 'Moderate';
    else d = 'Easy';
    return { label: d, dot: { Easy: '#4A7856', Moderate: '#C98A2E', Hard: '#9C3A25' }[d] };
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

  function thumb(t) {
    if (t.imageIcon) return '<img src="' + esc(t.imageIcon) + '" alt="" loading="lazy">';
    if (typeof pathThumbnailSvg === 'function') { var s = pathThumbnailSvg(t.path); if (s) return s; }
    return '';
  }
  function canonicalBrowseState() {
    return {
      search: state.query,
      distance: state.dist === 99 ? '' : String(state.dist),
      water: state.hasWater,
      dog: state.dog,
      difficulty: state.diff === 'any' ? '' : state.diff,
      terrain: state.terrain === 'any' ? '' : state.terrain,
      heat: state.shade === 'shade' ? 'shade-reviewed' : '',
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
    return [state.dist !== 99, state.diff !== 'any', state.terrain !== 'any',
      state.shade !== 'any', state.minMatch > 0, state.hasWater].filter(Boolean).length;
  }

  function rankedList() {
    var q = state.query.trim().toLowerCase();
    return trails.filter(function (t) {
      if (q) {
        var hay = (t.name + ' ' + (t.area || '') + ' ' + (t.valley || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (state.dist !== 99 && t.distance > state.dist) return false;
      if (state.shade === 'shade' && (t.shadeCoverage || 0) < 30) return false;
      if (state.terrain !== 'any') {
        var rank = typeof t.terrainRank === 'number' ? t.terrainRank : 1;
        if (state.terrain === 'soft' && rank !== 0) return false;
        if (state.terrain === 'mixed' && rank !== 1) return false;
        if (state.terrain === 'rocky' && rank < 2) return false;
      }
      if (state.diff !== 'any' && difficulty(t).label !== state.diff) return false;
      if (state.hasWater && !hasWater(t)) return false;
      return true;
    }).map(function (t) {
      return { t: t, score: scoreOf(t) };
    }).filter(function (e) {
      return state.minMatch === 0 || e.score >= state.minMatch;
    }).sort(function (a, b) { return b.score - a.score; });
  }

  // ---- weekly featured collection (rotating theme, real data) ----
  var THEMES = [
    { key: 'shady', title: 'Shady lake loops for hot days', blurb: 'Cool, covered trails with water nearby',
      filter: function (t) { return (t.shadeCoverage || 0) >= 30 && hasWater(t); },
      apply: function () { state.shade = 'shade'; state.hasWater = true; } },
    { key: 'water', title: 'Lakeside & stream walks', blurb: 'Trails with water to drink and cool off',
      filter: hasWater,
      apply: function () { state.hasWater = true; } },
    { key: 'meadow', title: 'Open alpine meadow strolls', blurb: 'Wide, gentle meadow paths with big views',
      filter: function (t) { return (t.shadeCoverage || 0) < 30 && (t.terrainRank || 0) <= 1; },
      apply: function () { state.terrain = 'soft'; } },
    { key: 'gentle', title: 'Gentle short loops', blurb: 'Easy, low-climb walks under 4 km',
      filter: function (t) { return t.distance <= 4; },
      apply: function () { state.dist = 3; } },
  ];
  var THEME_ICONS = {
    shady: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2c3.4 3.2 5.2 6 5.2 8.6a5.2 5.2 0 0 1-2.2 4.3 4.2 4.2 0 0 1-6 0 5.2 5.2 0 0 1-2.2-4.3C6.8 8 8.6 5.2 12 2z" fill="#4A7856"/><path d="M12 2c1.8 1.7 2.9 3.4 3.5 4.9-.6 1.6-1.7 3.2-3.5 4.9-1.8-1.7-2.9-3.3-3.5-4.9C9.1 5.4 10.2 3.7 12 2z" fill="#6BA57C"/><rect x="10.9" y="14.5" width="2.2" height="7.5" rx="1.1" fill="#8A5A16"/></svg>',
    water: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.5c3 3.6 4.8 6.6 4.8 9.1a4.8 4.8 0 0 1-9.6 0c0-2.5 1.8-5.5 4.8-9.1z" fill="#2C8FA6"/><path d="M12 5.5c1.6 2.1 2.5 3.9 2.5 5.4a2.5 2.5 0 0 1-5 0c0-1.5.9-3.3 2.5-5.4z" fill="#6FA8BE"/></svg>',
    meadow: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="17" cy="7" r="3" fill="#E8A93A"/><path d="M2 19l5.5-7 3.5 4 3-3.5L21 19z" fill="#4A7856"/></svg>',
    gentle: '<svg width="22" height="22" viewBox="0 0 24 24" fill="#4A7856" aria-hidden="true"><ellipse cx="6.2" cy="10" rx="1.9" ry="2.5"/><ellipse cx="10" cy="7.4" rx="2" ry="2.7"/><ellipse cx="14" cy="7.4" rx="2" ry="2.7"/><ellipse cx="17.8" cy="10" rx="1.9" ry="2.5"/><path d="M12 12.2c-2.7 0-5 1.9-5 4.3 0 1.7 1.4 2.6 3 2.6 1 0 1.4-.4 2-.4s1 .4 2 .4c1.6 0 3-.9 3-2.6 0-2.4-2.3-4.3-5-4.3z"/></svg>',
  };
  function weeklyTheme() {
    var now = new Date();
    var wk = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / (7 * 86400000));
    return THEMES[wk % THEMES.length];
  }
  function featured() {
    var th = weeklyTheme();
    return trails.filter(th.filter)
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
      el.guestTitle.textContent = 'Walking with ' + state.custom.meta.name + '.';
      el.guestSub.textContent = 'Trails are ranked just for them. Log in to save this profile across devices.';
      el.guestCta.textContent = 'Save profile →';
    } else if (state.dog === 'medium') {
      el.guestTitle.textContent = 'Browsing as a guest, ranked for a medium dog.';
      el.guestSub.textContent = 'No account needed. Add your dog any time to sharpen every score.';
      el.guestCta.textContent = "Create your dog's profile →";
    } else {
      el.guestTitle.textContent = 'Previewing as ' + dogMeta().name + '.';
      el.guestSub.textContent = 'Create your own dog to tune every score to them.';
      el.guestCta.textContent = "Create your dog's profile →";
    }
  }

  // ---- live search suggestions ----
  function showingSuggest() {
    return state.focused && state.query.trim() !== '' && !state.searched;
  }

  function renderSuggest() {
    var open = showingSuggest();
    el.suggest.hidden = !open;
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
    if (!open) return;

    var m = dogMeta();
    var list = rankedList();
    var n = list.length;
    var countTxt = n + ' ' + (n === 1 ? 'trail' : 'trails');
    if (!n) {
      el.suggest.innerHTML =
        '<div class="hp-sug-empty"><div class="hp-sug-empty-h">No trails match “' + esc(state.query.trim()) + '”</div>' +
        '<p>Try a different valley, or loosen a filter.</p>' +
        '<button type="button" data-action="reset">Reset filters</button></div>';
      return;
    }
    el.suggest.innerHTML =
      '<div class="hp-sug-head"><span class="hp-sug-kick">' +
        '<span class="hp-sug-chip" style="background:' + m.chipBg + ';color:' + m.chipColor + '">' + esc(m.badge) + '</span>' +
        'Top matches for ' + esc(m.name) + '</span><span class="hp-sug-count">' + countTxt + '</span></div>' +
      list.slice(0, 5).map(function (entry) {
        var t = entry.t, s = entry.score, ti = tier(s), df = difficulty(t);
        return '<button type="button" class="hp-sug-item" data-href="' + esc(trailHref(t)) + '">' +
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
    return '<button type="button" class="hp-ccard" data-href="' + esc(trailHref(t)) + '">' +
      '<span class="hp-ccard-img">' + thumb(t) + '<span class="hp-ccard-pct" style="background:' + ti.pin + '">' + s + '%</span></span>' +
      '<span class="hp-ccard-body">' +
        '<span class="hp-ccard-name">' + esc(t.name) + '</span>' +
        '<span class="hp-ccard-tags"><span class="hp-badge hp-badge-diff"><span class="hp-badge-dot" style="background:' + df.dot + '"></span>' + df.label + '</span>' +
        '<span class="txt">' + tags + '</span></span>' +
      '</span>' +
    '</button>';
  }

  var HOW_CARDS = [
    { title: 'Add your dog',
      icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="#2E4034" aria-hidden="true"><ellipse cx="6.2" cy="10" rx="1.9" ry="2.5"/><ellipse cx="10" cy="7.4" rx="2" ry="2.7"/><ellipse cx="14" cy="7.4" rx="2" ry="2.7"/><ellipse cx="17.8" cy="10" rx="1.9" ry="2.5"/><path d="M12 12.2c-2.7 0-5 1.9-5 4.3 0 1.7 1.4 2.6 3 2.6 1 0 1.4-.4 2-.4s1 .4 2 .4c1.6 0 3-.9 3-2.6 0-2.4-2.3-4.3-5-4.3z"/></svg>',
      text: 'Size, energy, what their paws can handle and whether they feel the heat. Takes under a minute.' },
    { title: 'Every trail gets scored',
      icon: '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#2C8FA6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.4 3.1 7.4 7.5 9 4.4-1.6 7.5-4.6 7.5-9V6L12 3z"/><path d="m8.8 12 2.2 2.2 4.2-4.4" stroke="#4A7856"/></svg>',
      text: null /* filled at render time with the live trail count */ },
    { title: 'Walk with confidence',
      icon: '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#C98A2E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h6a3 3 0 0 1 0 6H8.5a3 3 0 0 0 0 6H16"/><circle cx="6" cy="4" r="2" fill="#C98A2E" stroke="none"/><path d="M18 14c1.3 1.6 2 2.8 2 3.8A2 2 0 0 1 16 18c0-1 .7-2.2 2-3.8z" fill="#4A7856" stroke="none"/></svg>',
      text: 'See a full paw-safety breakdown before you go, and save the trails that suit your dog best.' },
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
      var th = weeklyTheme();
      var feat = featured();
      var isGuest = state.dog === 'medium';
      var featSub = th.blurb + ' · ranked for ' + (isGuest ? 'a medium dog' : esc(dogMeta().name));
      var how = HOW_CARDS.map(function (c) {
        var text = c.text || ('We rate ' + trails.length + ' trails for terrain, shade, water and climb, then match each to your dog as a single %.');
        return '<div class="hp-howcard"><div class="hp-howcard-head">' +
          '<span class="hp-howcard-ico">' + c.icon + '</span>' +
          '<div class="hp-howcard-title">' + esc(c.title) + '</div></div>' +
          '<p>' + esc(text) + '</p></div>';
      }).join('');
      el.content.innerHTML =
        '<div class="hp-how">' +
          '<div class="hp-how-head"><div class="hp-kick">How DoloPaws works</div>' +
          '<h2 class="hp-how-h2">A safer walk in three steps</h2></div>' +
          '<div class="hp-how-grid">' + how + '</div>' +
        '</div>' +
        '<div class="hp-coll-head"><div>' +
          '<div class="hp-kick hp-kick-left">Featured this week</div>' +
          '<h2 class="hp-feat-h2">' + esc(th.title) + '</h2>' +
          '<p class="hp-coll-sub">' + featSub + '</p></div>' +
          '<a href="collections.html" class="hp-coll-all" data-action="seeall">All collections →</a></div>' +
        '<div class="hp-coll-grid">' + feat.map(function (entry) {
          return ccardHtml(entry, esc(entry.t.distance) + ' km · ' + esc(valleyOf(entry.t)));
        }).join('') + '</div>';
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
    state.dist = 99; state.diff = 'any'; state.terrain = 'any';
    state.shade = 'any'; state.minMatch = 0; state.hasWater = false;
  }

  function runSearch() {
    window.location.href = browseHref();
  }

  // ---- static one-time setup ----
  function setupStatic() {
    if (el.announceCount) el.announceCount.textContent = trails.length + ' trails';
    el.popular.innerHTML = POPULAR.map(function (p, i) {
      return '<button type="button" class="hp-chip" data-pop="' + i + '">' + esc(p.label) + '</button>';
    }).join('');
  }

  // ---- mini-wizard ----
  var SIZE_OPTS = [{ label: 'Small', v: 'small' }, { label: 'Medium', v: 'medium' }, { label: 'Large', v: 'large' }];
  var ENERGY_OPTS = [{ label: 'Low', v: 'low' }, { label: 'Medium', v: 'medium' }, { label: 'High', v: 'high' }];
  var TERRAINTOL_OPTS = [{ label: 'Soft ground only', v: 'soft' }, { label: 'Some gravel is fine', v: 'gravel' }, { label: 'Anything, including rock', v: 'any' }];
  var HEAT_OPTS = [{ label: 'Yes, gets hot easily', v: true }, { label: 'No, handles heat fine', v: false }];

  function optBtns(opts, cur, field, col) {
    return '<div class="hp-wiz-opts' + (col ? ' col' : '') + '">' + opts.map(function (o) {
      var sel = String(cur) === String(o.v) ? ' sel' : '';
      return '<button type="button" class="hp-wiz-opt' + sel + '" data-wfield="' + field + '" data-wval="' + o.v + '">' + esc(o.label) + '</button>';
    }).join('') + '</div>';
  }

  function renderWizard() {
    var w = state.wiz;
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

  function openWizard() { state.wizOpen = true; state.wizStep = 0; el.wizard.hidden = false; document.body.classList.add('auth-modal-open'); renderWizard(); }
  function closeWizard() { state.wizOpen = false; el.wizard.hidden = true; document.body.classList.remove('auth-modal-open'); }

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
    closeWizard();
    renderAll();
  }

  // ---- events ----
  function bind() {
    el.search.addEventListener('input', function (e) {
      state.query = e.target.value; state.searched = false; state.focused = true;
      renderSuggest(); renderContent();
    });
    el.search.addEventListener('focus', function () { state.focused = true; renderSuggest(); });
    el.search.addEventListener('keydown', function (e) { if (e.key === 'Enter') runSearch(); });
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
        if (kind === 'dist') state.dist = parseInt(val, 10);
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
      } else if (a === 'seeall') {
        e.preventDefault();
        state.query = '';
        if (el.search) el.search.value = '';
        resetFilters();
        weeklyTheme().apply();
        runSearch();
      }
    });

    el.guestCta.addEventListener('click', function () {
      if (state.dog === 'custom' && window.DoloPawsAuthUI) window.DoloPawsAuthUI.openSignup();
      else openWizard();
    });

    // Mini-wizard
    el.wizClose.addEventListener('click', closeWizard);
    el.wizard.addEventListener('click', function (e) { if (e.target === el.wizard) closeWizard(); });
    el.wizBack.addEventListener('click', function () { if (state.wizStep === 0) closeWizard(); else { state.wizStep--; renderWizard(); } });
    el.wizNext.addEventListener('click', function () { if (state.wizStep < 2) { state.wizStep++; renderWizard(); } else finishWizard(); });
    el.wizBody.addEventListener('click', function (e) {
      var b = e.target.closest('[data-wfield]'); if (!b) return;
      var field = b.getAttribute('data-wfield'), val = b.getAttribute('data-wval');
      if (field === 'heat') state.wiz.heat = (val === 'true');
      else state.wiz[field] = val;
      renderWizard();
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
