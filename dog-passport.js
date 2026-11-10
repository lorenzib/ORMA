(function(global){
  'use strict';

  // SOCIAL-05 — the dog passport. A stamp for every trail your dog has walked
  // with a recording the GPS proved (hike mode writes `proof: 'gps'` on those
  // walks, and nothing else does). Everything here is worked out from the
  // journal already on the page and the trail catalogue already loaded, so the
  // passport costs no database reads of its own.
  //
  // buildPassport is pure (no DOM, no clock) and renderPassport only writes
  // markup, so both are testable on their own.

  var LAKE = /(lago|laghi|laghetto|\blacs?\b|\blej\b|see\b|seen\b)/i;
  var MILESTONE_WALKS = 10;
  var MILESTONE_KM = 100;
  var OUTLINE_POINTS = 60;

  function number(value){
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function isLake(trail){
    return !!(trail && LAKE.test(String(trail.name || '')));
  }

  function hasHut(trail){
    return !!(trail && Array.isArray(trail.rifugi) && trail.rifugi.length);
  }

  // Proven walks only, oldest first, each paired with its catalogue trail.
  // A walk on a trail the catalogue no longer has still stamps, by its name.
  function provenWalks(entries, trailById){
    return (Array.isArray(entries) ? entries : [])
      .filter(function(e){ return e && e.proof === 'gps' && e.trailId; })
      .map(function(e){ return { entry: e, trail: trailById(e.trailId) }; })
      .sort(function(a, b){ return String(a.entry.date).localeCompare(String(b.entry.date)); });
  }

  function buildPassport(entries, trails){
    var list = Array.isArray(trails) ? trails : [];
    var byId = new Map();
    list.forEach(function(t){ if(t && t.id) byId.set(t.id, t); });
    var trailById = function(id){ return byId.get(id) || null; };
    var walks = provenWalks(entries, trailById);

    var stamps = [];
    var stampById = new Map();
    var km = 0;
    var climb = 0;
    walks.forEach(function(w){
      var e = w.entry, t = w.trail;
      km += number(e.dist);
      climb += t ? number(t.elevation) : 0;
      var stamp = stampById.get(e.trailId);
      if(!stamp){
        stamp = {
          trailId: e.trailId,
          name: (t && t.name) || e.trail || '',
          valley: (t && t.valley) || e.region || '',
          path: t && Array.isArray(t.path) ? t.path : [],
          lake: isLake(t || { name: e.trail }),
          hut: hasHut(t),
          dates: [],
        };
        stampById.set(e.trailId, stamp);
        stamps.push(stamp);
      }
      stamp.dates.push(e.date);
    });

    // How many catalogue trails each valley has, so "2 of 16" is honest.
    var valleyTotals = new Map();
    list.forEach(function(t){
      if(t && t.valley) valleyTotals.set(t.valley, (valleyTotals.get(t.valley) || 0) + 1);
    });
    var valleyDone = new Map();
    stamps.forEach(function(s){
      if(s.valley && valleyTotals.has(s.valley)) valleyDone.set(s.valley, (valleyDone.get(s.valley) || 0) + 1);
    });
    var valleys = Array.from(valleyDone.keys()).map(function(name){
      return { name: name, done: valleyDone.get(name), total: valleyTotals.get(name) };
    }).sort(function(a, b){ return (b.done / b.total) - (a.done / a.total) || a.name.localeCompare(b.name); });

    var lakes = stamps.filter(function(s){ return s.lake; }).length;
    var huts = stamps.filter(function(s){ return s.hut; }).length;
    var milestones = [
      { id: 'first', have: walks.length, target: 1 },
      { id: 'lakes', have: lakes, target: 1 },
      { id: 'huts', have: huts, target: 1 },
      { id: 'walks', have: walks.length, target: MILESTONE_WALKS },
      { id: 'km', have: Math.round(km * 10) / 10, target: MILESTONE_KM },
    ].map(function(m){ m.done = m.have >= m.target; return m; });

    return {
      stamps: stamps,
      valleys: valleys,
      milestones: milestones,
      totals: {
        walks: walks.length,
        stamps: stamps.length,
        valleys: valleys.length,
        km: Math.round(km * 10) / 10,
        climb: Math.round(climb),
      },
    };
  }

  // The trail's route as an SVG path inside a size×size box, keeping its
  // shape (north up, longitude scaled by latitude). Empty when there is none.
  function outlinePath(path, size){
    var pts = (Array.isArray(path) ? path : []).filter(function(p){
      return Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);
    });
    if(pts.length < 2) return '';
    var step = Math.max(1, Math.ceil(pts.length / OUTLINE_POINTS));
    var picked = pts.filter(function(p, i){ return i % step === 0; });
    if(picked[picked.length - 1] !== pts[pts.length - 1]) picked.push(pts[pts.length - 1]);
    var lat0 = picked.reduce(function(a, p){ return a + p[0]; }, 0) / picked.length;
    var kx = Math.cos(lat0 * Math.PI / 180);
    var xy = picked.map(function(p){ return [p[1] * kx, -p[0]]; });
    var xs = xy.map(function(p){ return p[0]; }), ys = xy.map(function(p){ return p[1]; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var span = Math.max(maxX - minX, maxY - minY) || 1;
    var pad = size * 0.12, inner = size - pad * 2;
    var offX = pad + (inner - (maxX - minX) / span * inner) / 2;
    var offY = pad + (inner - (maxY - minY) / span * inner) / 2;
    return xy.map(function(p, i){
      var x = offX + (p[0] - minX) / span * inner;
      var y = offY + (p[1] - minY) / span * inner;
      return (i ? 'L' : 'M') + (Math.round(x * 10) / 10) + ' ' + (Math.round(y * 10) / 10);
    }).join('');
  }

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(c){
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // options: { t(key, vars), dogName, lang }
  function renderPassport(passport, options){
    options = options || {};
    var t = options.t || function(key){ return key; };
    var lang = options.lang || undefined;
    var totals = passport.totals;
    var fmt = function(n){ return Number(n).toLocaleString(lang); };
    var title = options.dogName
      ? t('journal.passport.titleFor', { name: options.dogName })
      : t('journal.passport.title');
    var summary = [
      t(totals.stamps === 1 ? 'journal.passport.stampOne' : 'journal.passport.stamps', { n: fmt(totals.stamps) }),
      t(totals.valleys === 1 ? 'journal.passport.valleyOne' : 'journal.passport.valleysCount', { n: fmt(totals.valleys) }),
      fmt(totals.km) + ' km',
      t('journal.passport.climbed', { n: fmt(totals.climb) }),
    ].join(' · ');

    // Most recently walked first: walking a trail again brings it to the front.
    var lastDate = function(s){ return String(s.dates[s.dates.length - 1] || ''); };
    var stamps = passport.stamps.slice().sort(function(a, b){
      return lastDate(b).localeCompare(lastDate(a));
    }).map(function(s){
      var last = new Date(s.dates[s.dates.length - 1]);
      var when = isNaN(last) ? '' : last.toLocaleDateString(lang, { day: 'numeric', month: 'short' });
      var d = outlinePath(s.path, 44);
      var times = s.dates.length > 1 ? ' · ' + t('journal.passport.times', { n: s.dates.length }) : '';
      var regional = global.DoloPawsRegionalData;
      var slug = regional && regional.slugFor ? regional.slugFor(s.trailId) : s.trailId;
      return '<a class="jp-stamp" href="trail.html?id=' + encodeURIComponent(slug) + '&amp;from=journal.html">' +
        '<span class="jp-ring" aria-hidden="true">' +
          (d ? '<svg width="44" height="44" viewBox="0 0 44 44"><path d="' + d + '"/></svg>'
             : '<svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="6"/></svg>') +
        '</span>' +
        '<span class="jp-name">' + esc(s.name) + '</span>' +
        '<span class="jp-when">' + esc(when + times) + '</span>' +
      '</a>';
    }).join('');
    stamps += '<a class="jp-stamp jp-next" href="browse-trails.html">' +
      '<span class="jp-ring" aria-hidden="true">+</span>' +
      '<span class="jp-when">' + esc(t('journal.passport.next')) + '</span></a>';

    var valleys = passport.valleys.length
      ? '<h3 class="jp-h">' + esc(t('journal.passport.valleys')) + '</h3><ul class="jp-valleys">' +
        passport.valleys.map(function(v){
          var pct = Math.max(3, Math.round(v.done / v.total * 100));
          return '<li><span class="jp-vrow"><span>' + esc(v.name) + '</span><span class="jp-of">' +
            esc(t('journal.passport.of', { done: v.done, total: v.total })) + '</span></span>' +
            '<span class="jp-bar"><i style="width:' + pct + '%"></i></span></li>';
        }).join('') + '</ul>'
      : '';

    var milestones = '<h3 class="jp-h">' + esc(t('journal.passport.milestones')) + '</h3><div class="jp-miles">' +
      passport.milestones.map(function(m){
        var label;
        if(m.id === 'lakes') label = m.have > 1 ? t('journal.passport.lakes', { n: m.have }) : t('journal.passport.lakeOne');
        else if(m.id === 'huts') label = m.have > 1 ? t('journal.passport.huts', { n: m.have }) : t('journal.passport.hutOne');
        else label = t('journal.passport.mile.' + m.id);
        var left = Math.ceil(m.target - m.have);
        if(!m.done && m.target > 1 && m.have > 0) label += ' · ' + t('journal.passport.toGo', { n: fmt(left) });
        return '<span class="jp-mile' + (m.done ? ' is-done' : '') + '">' + (m.done ? '✓ ' : '') + esc(label) + '</span>';
      }).join('') + '</div>';

    return '<div class="jp-head"><h2 class="jp-title">' + esc(title) + '</h2>' +
        '<span class="jn-private-chip">' + esc(t('journal.passport.private')) + '</span></div>' +
      (totals.stamps
        ? '<p class="jp-sum">' + esc(summary) + '</p>'
        : '<p class="jp-empty">' + esc(t('journal.passport.empty')) + '</p>') +
      '<div class="jp-stamps">' + stamps + '</div>' +
      valleys + milestones +
      '<p class="jp-rule">' + esc(t('journal.passport.rule')) + '</p>';
  }

  var api = { buildPassport: buildPassport, renderPassport: renderPassport, outlinePath: outlinePath, isLake: isLake };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  global.DoloPawsPassport = api;
})(typeof window !== 'undefined' ? window : globalThis);
