(function(global){
  'use strict';
  // A walk's name as the reader sees it (i18n.js); search also keeps the English one.
  function trailDisplayName(trail){ var i18n = typeof window !== 'undefined' && window.DoloPawsI18n; return i18n && typeof i18n.trailName === 'function' ? i18n.trailName(trail) : String((trail && trail.name) || ''); }

  // SOCIAL-05 — the dog passport. A stamp for every trail your dog has walked
  // with a recording the GPS proved: hike mode writes `proof: 'gps'`, and a
  // GPX file that passed the same check is saved with `proof: 'gpx'`
  // (gpx-walk.js). Nothing else writes either. Everything here is worked out from the
  // journal already on the page and the trail catalogue already loaded, so the
  // passport costs no database reads of its own.
  //
  // buildPassport is pure (no DOM, no clock) and renderPassport only writes
  // markup, so both are testable on their own.

  var LAKE = /(lago|laghi|laghetto|\blacs?\b|\blej\b|see\b|seen\b)/i;
  // Badges come in ladders, like levels in a game: the next one is always
  // in reach, and passing it shows the one after.
  var LADDER_WALKS = [5, 10, 25, 50, 100, 250];
  var LADDER_KM = [10, 25, 50, 100, 250, 500, 1000];
  var LADDER_VALLEYS = [2, 3, 5, 10, 20];
  // A valley visa levels up with the trails walked in it, not by finishing
  // it: most valleys have far more trails than anyone walks. A level asks for
  // at most the valley's own number of trails, so a small valley still has
  // all five levels in reach.
  var VALLEY_LEVELS = [
    { id: 'visitor', at: 1 },
    { id: 'explorer', at: 3 },
    { id: 'regular', at: 5 },
    { id: 'local', at: 10 },
    { id: 'legend', at: 20 },
  ];
  var NEW_VISA_DAYS = 14;
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
      .filter(function(e){ return e && (e.proof === 'gps' || e.proof === 'gpx') && e.trailId; })
      .map(function(e){ return { entry: e, trail: trailById(e.trailId) }; })
      .sort(function(a, b){ return String(a.entry.date).localeCompare(String(b.entry.date)); });
  }

  // Where a dog stands in a valley: level 0-5, the level's id, and how many
  // more trails reach the next one (null at the top).
  function valleyLevel(done, total){
    var steps = VALLEY_LEVELS.map(function(l){ return { id: l.id, need: Math.min(l.at, Math.max(1, total)) }; });
    var reached = steps.filter(function(s){ return done >= s.need; });
    var current = reached[reached.length - 1] || null;
    var next = steps[reached.length] || null;
    return {
      level: reached.length,
      of: steps.length,
      id: current ? current.id : null,
      from: current ? current.need : 0,
      next: next ? { id: next.id, need: next.need, left: next.need - done } : null,
    };
  }

  // The highest badge of a ladder already earned, and the next one.
  function ladder(id, have, steps){
    var earned = steps.filter(function(n){ return have >= n; });
    var out = [];
    if(earned.length) out.push({ id: id, have: have, target: earned[earned.length - 1] });
    var next = steps[earned.length];
    if(next) out.push({ id: id, have: have, target: next });
    return out;
  }

  // A visa first stamped in the last two weeks: worth showing off.
  function isNewVisa(valley, now){
    var first = Date.parse(valley && valley.firstDate);
    var at = Number(now);
    if(!Number.isFinite(first) || !Number.isFinite(at)) return false;
    return at - first >= -86400000 && at - first <= NEW_VISA_DAYS * 86400000;
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
          name: (t && trailDisplayName(t)) || e.trail || '',
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

    // Every catalogue trail per valley, so a small valley's levels fit it
    // and the valley page can show the ones still to walk.
    var valleyTrails = new Map();
    list.forEach(function(t){
      if(!t || !t.valley || !t.id) return;
      if(!valleyTrails.has(t.valley)) valleyTrails.set(t.valley, []);
      valleyTrails.get(t.valley).push(t);
    });
    var valleyFirst = new Map();
    stamps.forEach(function(s){
      if(!s.valley || !valleyTrails.has(s.valley)) return;
      var first = s.dates[0];
      if(!valleyFirst.has(s.valley) || String(first) < String(valleyFirst.get(s.valley))) valleyFirst.set(s.valley, first);
    });
    // Visas in the order the dog first entered each valley.
    var valleys = Array.from(valleyFirst.keys()).map(function(name){
      var trailsHere = valleyTrails.get(name).map(function(t){
        var stamp = stampById.get(t.id);
        return {
          id: t.id,
          name: trailDisplayName(t) || t.id,
          distance: number(t.distance),
          walked: !!stamp,
          lastDate: stamp ? stamp.dates[stamp.dates.length - 1] : null,
        };
      }).sort(function(a, b){
        // Walked first (most recent first), then the rest shortest first:
        // the easiest next walk sits right after what is done.
        if(a.walked !== b.walked) return a.walked ? -1 : 1;
        if(a.walked) return String(b.lastDate).localeCompare(String(a.lastDate));
        return (a.distance || Infinity) - (b.distance || Infinity) || a.name.localeCompare(b.name);
      });
      var done = trailsHere.filter(function(t){ return t.walked; }).length;
      return {
        name: name,
        done: done,
        total: trailsHere.length,
        level: valleyLevel(done, trailsHere.length),
        firstDate: valleyFirst.get(name),
        trails: trailsHere,
      };
    }).sort(function(a, b){
      return String(a.firstDate).localeCompare(String(b.firstDate)) || a.name.localeCompare(b.name);
    });

    var lakes = stamps.filter(function(s){ return s.lake; }).length;
    var huts = stamps.filter(function(s){ return s.hut; }).length;
    var milestones = [
      { id: 'first', have: walks.length, target: 1 },
      { id: 'lakes', have: lakes, target: 1 },
      { id: 'huts', have: huts, target: 1 },
    ].concat(
      ladder('walks', walks.length, LADDER_WALKS),
      ladder('km', Math.round(km * 10) / 10, LADDER_KM),
      ladder('valleys', valleys.length, LADDER_VALLEYS)
    ).map(function(m){ m.done = m.have >= m.target; return m; });

    var since = walks.length ? walks[0].entry.date : null;

    return {
      since: since,
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

  var INKS = 4;          // visa ink colours, cycled so neighbours differ
  var SLOTS_SHOWN = 8;   // trails still to walk shown before "show the rest"

  function shortDate(value, lang, withYear){
    var d = new Date(value);
    if(isNaN(d)) return '';
    var opts = { day: 'numeric', month: 'short' };
    if(withYear) opts.year = 'numeric';
    return d.toLocaleDateString(lang, opts);
  }

  function trailHref(id){
    var regional = global.DoloPawsRegionalData;
    var slug = regional && regional.slugFor ? regional.slugFor(id) : id;
    return 'trail.html?id=' + encodeURIComponent(slug) + '&amp;from=journal.html';
  }

  // The front page: the dog's own ID, like the pet passport owners carry.
  function renderIdPage(passport, options, t, fmt, lang){
    var name = options.dogName || '';
    var photo = typeof options.dogPhoto === 'string' && /^data:image\/(png|jpe?g|webp|gif);/i.test(options.dogPhoto)
      ? options.dogPhoto : '';
    var face = photo
      ? '<img class="jp-photo" src="' + esc(photo) + '" alt="">'
      : '<span class="jp-photo jp-photo-empty" aria-hidden="true">' + esc((name || '?').charAt(0).toUpperCase()) + '</span>';
    var rows = [];
    if(name) rows.push([t('journal.passport.idName'), name]);
    if(options.dogBreed) rows.push([t('journal.passport.idBreed'), options.dogBreed]);
    if(passport.since) rows.push([t('journal.passport.idSince'), shortDate(passport.since, lang, true)]);
    var title = name ? t('journal.passport.titleFor', { name: name }) : t('journal.passport.title');
    return '<div class="jp-head"><h2 class="jp-title">' + esc(title) + '</h2>' +
        '<span class="jp-head-actions">' +
          (passport.stamps.length && options.canShare
            ? '<button type="button" class="jp-share">' + esc(t('journal.passport.share')) + '</button>' : '') +
          '<span class="jn-private-chip">' + esc(t('journal.passport.private')) + '</span>' +
        '</span></div>' +
      '<div class="jp-id">' + face + '<dl class="jp-idrows">' +
        rows.map(function(r){ return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') +
      '</dl></div>';
  }

  // Five stars, one per level: the game's way of saying how far along.
  function stars(level){
    var out = '';
    for(var i = 0; i < level.of; i++) out += i < level.level ? '★' : '☆';
    return out;
  }

  function levelLabel(v, t){
    return v.level.id ? t('journal.passport.level.' + v.level.id) : '';
  }

  function renderVisas(passport, options, t, fmt, lang){
    if(!passport.valleys.length) return '';
    var open = options.openValley || '';
    var visas = passport.valleys.map(function(v, i){
      var isOpen = v.name === open;
      var fresh = isNewVisa(v, options.now);
      return '<button type="button" class="jp-visa jp-ink' + (i % INKS) + (isOpen ? ' is-open' : '') + (fresh ? ' is-new' : '') + '"' +
        ' data-valley="' + esc(v.name) + '" aria-expanded="' + isOpen + '">' +
        (fresh ? '<span class="jp-visa-new">' + esc(t('journal.passport.newVisa')) + '</span>' : '') +
        '<span class="jp-visa-name">' + esc(v.name) + '</span>' +
        '<span class="jp-visa-date">' + esc(t('journal.passport.entered', { date: shortDate(v.firstDate, lang) })) + '</span>' +
        '<span class="jp-visa-level"><span class="jp-stars" aria-hidden="true">' + stars(v.level) + '</span> ' +
          esc(levelLabel(v, t)) + '</span>' +
      '</button>';
    }).join('');
    var openValley = passport.valleys.filter(function(v){ return v.name === open; })[0];
    return '<div class="jp-hrow"><h3 class="jp-h">' + esc(t('journal.passport.visas')) + '</h3>' +
        '<span class="jp-hint">' + esc(t('journal.passport.visasHint')) + '</span></div>' +
      '<div class="jp-visas">' + visas + '</div>' +
      (openValley ? renderValley(openValley, options, t, fmt, lang) : '');
  }

  // One valley: its level, how far to the next one, then the trails walked
  // and the ones to try next.
  function renderValley(v, options, t, fmt, lang){
    var lv = v.level;
    var pct = lv.next ? Math.max(6, Math.round((v.done - lv.from) / (lv.next.need - lv.from) * 100)) : 100;
    var nextName = lv.next ? t('journal.passport.level.' + lv.next.id) : '';
    var goal = lv.next
      ? t(lv.next.left === 1 ? 'journal.passport.nextLevelOne' : 'journal.passport.nextLevel', { n: fmt(lv.next.left), level: nextName })
      : t('journal.passport.topLevel', { valley: v.name });
    var fresh = isNewVisa(v, options.now);
    var slot = function(tr){
      var sub = tr.walked
        ? shortDate(tr.lastDate, lang)
        : (tr.distance ? fmt(Math.round(tr.distance * 10) / 10) + ' km' : '');
      return '<li><a class="jp-slot' + (tr.walked ? ' is-walked' : '') + '" href="' + trailHref(tr.id) + '">' +
        '<span class="jp-slot-mark" aria-hidden="true">' + (tr.walked ? '✓' : '') + '</span>' +
        '<span class="jp-slot-name">' + esc(tr.name) + '</span>' +
        '<span class="jp-slot-sub">' + esc(sub) + '</span>' +
        (tr.walked ? '' : '<span class="sr-only"> ' + esc(t('journal.passport.notYet')) + '</span>') +
      '</a></li>';
    };
    var walked = v.trails.filter(function(tr){ return tr.walked; });
    var left = v.trails.filter(function(tr){ return !tr.walked; });
    var shown = left.slice(0, SLOTS_SHOWN), rest = left.slice(SLOTS_SHOWN);
    return '<div class="jp-valley" id="jpValley">' +
      '<div class="jp-vrow"><strong>' + esc(v.name) + '</strong><span class="jp-of">' +
        '<span class="jp-stars" aria-hidden="true">' + stars(lv) + '</span> ' +
        esc(t('journal.passport.levelOf', { n: fmt(lv.level), of: fmt(lv.of), level: levelLabel(v, t) })) + '</span></div>' +
      '<span class="jp-bar' + (lv.next ? '' : ' is-top') + '"><i style="width:' + pct + '%"></i></span>' +
      '<p class="jp-goal">' + esc(goal) + '</p>' +
      (options.canShare
        ? '<button type="button" class="jp-visa-share" data-valley="' + esc(v.name) + '">' +
            esc(t(fresh ? 'journal.passport.shareNewVisa' : 'journal.passport.shareVisa')) + '</button>'
        : '') +
      (left.length
        ? '<p class="jp-next-tip">' + esc(t('journal.passport.whereNext')) + '</p>'
        : '<p class="jp-next-tip">' + esc(t('journal.passport.allDone')) + '</p>') +
      '<ul class="jp-slots">' + walked.concat(shown).map(slot).join('') + '</ul>' +
      (rest.length
        ? '<details class="jp-more"><summary>' + esc(t('journal.passport.showRest', { n: fmt(rest.length) })) + '</summary>' +
          '<ul class="jp-slots">' + rest.map(slot).join('') + '</ul></details>'
        : '') +
    '</div>';
  }

  // options: { t(key, vars), dogName, dogBreed, dogPhoto, openValley, lang, canShare, now }
  function renderPassport(passport, options){
    options = options || {};
    var t = options.t || function(key){ return key; };
    var lang = options.lang || undefined;
    var totals = passport.totals;
    var fmt = function(n){ return Number(n).toLocaleString(lang); };
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
      var when = shortDate(s.dates[s.dates.length - 1], lang);
      var d = outlinePath(s.path, 44);
      var times = s.dates.length > 1 ? ' · ' + t('journal.passport.times', { n: s.dates.length }) : '';
      return '<a class="jp-stamp" href="' + trailHref(s.trailId) + '">' +
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

    var milestones = '<h3 class="jp-h">' + esc(t('journal.passport.milestones')) + '</h3><div class="jp-miles">' +
      passport.milestones.map(function(m){
        var label;
        if(m.id === 'lakes') label = m.have > 1 ? t('journal.passport.lakes', { n: m.have }) : t('journal.passport.lakeOne');
        else if(m.id === 'huts') label = m.have > 1 ? t('journal.passport.huts', { n: m.have }) : t('journal.passport.hutOne');
        else label = t('journal.passport.mile.' + m.id, { n: fmt(m.target) });
        var left = Math.ceil(m.target - m.have);
        if(!m.done && m.target > 1 && m.have > 0) label += ' · ' + t('journal.passport.toGo', { n: fmt(left) });
        return '<span class="jp-mile' + (m.done ? ' is-done' : '') + '">' + (m.done ? '✓ ' : '') + esc(label) + '</span>';
      }).join('') + '</div>';

    return renderIdPage(passport, options, t, fmt, lang) +
      (totals.stamps
        ? '<p class="jp-sum">' + esc(summary) + '</p>'
        : '<p class="jp-empty">' + esc(t('journal.passport.empty')) + '</p>') +
      renderVisas(passport, options, t, fmt, lang) +
      '<h3 class="jp-h">' + esc(t('journal.passport.stampsTitle')) + '</h3>' +
      '<div class="jp-stamps">' + stamps + '</div>' +
      milestones +
      '<p class="jp-rule">' + esc(t('journal.passport.rule')) + '</p>';
  }

  var api = {
    buildPassport: buildPassport, renderPassport: renderPassport, outlinePath: outlinePath, isLake: isLake,
    valleyLevel: valleyLevel, isNewVisa: isNewVisa, stars: stars, VALLEY_LEVELS: VALLEY_LEVELS,
  };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  global.DoloPawsPassport = api;
})(typeof window !== 'undefined' ? window : globalThis);
