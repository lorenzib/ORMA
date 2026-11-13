// The app's "Add from Apple Health" (iPhone) and "Add from Health Connect"
// (Android) on the journal page. Most people who walk with a watch already
// have the walk in their phone's health store, so the app can read it there
// instead of asking for an exported file. The app's own native plugin, one
// per phone with the same four methods and answers
// (ios/App/App/HealthWalksPlugin.swift,
// android/app/src/main/java/com/apporma/orma/HealthWalksPlugin.kt), only
// reads: walking and hiking workouts, and the GPS route of the one chosen.
// Nothing is written to either store.
//
// The route is judged by the same check as a file (gpx-walk.js
// assessPoints) and shown, saved and stamped by the journal's own file window
// (window.DoloPawsJournalImport in journal.html). Apple never tells an app
// whether it may read Health data, so "no walks" and "not allowed" look the
// same; the empty list says where to check. The Android plugin answers the
// same way when permission is missing.
//
// scripts/build-app.js adds this script to the app's journal.html only.
// The look is in app-shell.css under .app-health.
(function(root){
  'use strict';

  var DAYS = 90;
  var LIMIT = 40;
  var DUPLICATE_MS = 30 * 60 * 1000;

  // ---- No DOM below this line until wire(): tested in app-health.test.js ----

  var PLATFORMS = ['ios', 'android'];

  // The words that name the store: Apple Health on an iPhone, Health Connect
  // on Android. Everything else on the sheet is the same on both.
  var STORE_WORDS = {
    ios: {
      add: ['journal.health.add', 'Add from Apple Health'],
      title: ['journal.health.title', 'Walks in Apple Health'],
      loading: ['journal.health.loading', 'Reading Apple Health…'],
      none: ['journal.health.none', 'No walks or hikes found in Apple Health. If you said no to ORMA reading them, or shared only recent data, you can change it in the Health app: Sharing, Apps, ORMA.'],
      error: ['journal.health.error', 'Apple Health could not be read just now. Try again in a moment.'],
      resultTitle: ['journal.health.resultTitle', 'Walk from Apple Health'],
    },
    android: {
      add: ['journal.health.android.add', 'Add from Health Connect'],
      title: ['journal.health.android.title', 'Walks in Health Connect'],
      loading: ['journal.health.android.loading', 'Reading Health Connect…'],
      none: ['journal.health.android.none', 'No walks or hikes found in Health Connect. If you said no to ORMA reading them, you can change it in Health Connect: App permissions, ORMA. A new app sees only the last 30 days.'],
      error: ['journal.health.android.error', 'Health Connect could not be read just now. Try again in a moment.'],
      resultTitle: ['journal.health.android.resultTitle', 'Walk from Health Connect'],
    },
  };

  function storeWord(platform, name){
    var words = STORE_WORDS[platform] || STORE_WORDS.ios;
    return label(words[name][0], words[name][1]);
  }

  function label(key, fallback, vars){
    var value = typeof root.t === 'function' ? root.t(key, vars) : '';
    if(value && value !== key) return value;
    return vars ? String(fallback).replace(/\{(\w+)\}/g, function(m, k){ return k in vars ? vars[k] : m; }) : fallback;
  }

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch){
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function duration(minutes){
    var m = Math.max(0, Math.round(minutes));
    return m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') : m + ' min';
  }

  // One line per walk, newest first: when, what, how far, how long, from what.
  // A walk already in the journal (started within half an hour) is marked.
  function walkRows(walks, entries, options){
    var opts = options || {};
    var lang = opts.lang || 'en';
    var saved = (Array.isArray(entries) ? entries : []).map(function(e){ return Date.parse(e && e.date || ''); })
      .filter(Number.isFinite);
    return (Array.isArray(walks) ? walks : [])
      .filter(function(w){ return w && w.id && Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start; })
      .sort(function(a, b){ return b.start - a.start; })
      .map(function(w){
        var km = Number(w.metres) > 0 ? Math.round(w.metres / 100) / 10 : null;
        return {
          id: String(w.id),
          start: w.start,
          date: new Date(w.start).toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' }),
          kind: w.kind === 'hiking' ? label('journal.health.hike', 'Hike') : label('journal.health.walk', 'Walk'),
          km: km === null ? '' : km.toLocaleString(lang) + ' km',
          time: duration((w.end - w.start) / 60000),
          source: String(w.source || '').slice(0, 40),
          inJournal: saved.some(function(t){ return Math.abs(t - w.start) < DUPLICATE_MS; }),
        };
      });
  }

  function listHtml(rows, platform){
    if(!rows.length){
      // No number of days on iOS: it lets the walker share only the last 30.
      return '<p class="app-health-empty">' + esc(storeWord(platform, 'none')) + '</p>';
    }
    return '<ul class="app-health-list">' + rows.map(function(r){
      return '<li><button type="button" class="app-health-walk" data-id="' + esc(r.id) + '">' +
        '<span class="app-health-when">' + esc(r.date) + ' · ' + esc(r.kind) + '</span>' +
        '<span class="app-health-facts">' + esc([r.km, r.time, r.source].filter(Boolean).join(' · ')) + '</span>' +
        (r.inJournal ? '<span class="app-health-saved">' + esc(label('journal.health.inJournal', 'In your journal')) + '</span>' : '') +
        '</button></li>';
    }).join('') + '</ul>';
  }

  // The plugin, only inside the iPhone or Android app. The pages do not bundle
  // Capacitor's JavaScript library, so there is no registerPlugin: the native
  // bridge's own nativePromise calls the plugin by its name (jsName).
  var METHODS = ['isAvailable', 'requestAccess', 'listWalks', 'getRoute'];
  function plugin(){
    var cap = root.Capacitor;
    if(!cap || typeof cap.getPlatform !== 'function' || PLATFORMS.indexOf(cap.getPlatform()) < 0) return null;
    if(cap.Plugins && cap.Plugins.HealthWalks) return cap.Plugins.HealthWalks;
    if(typeof cap.registerPlugin === 'function') return cap.registerPlugin('HealthWalks');
    if(typeof cap.nativePromise !== 'function') return null;
    var bridged = {};
    METHODS.forEach(function(method){
      bridged[method] = function(options){ return cap.nativePromise('HealthWalks', method, options || {}); };
    });
    return bridged;
  }

  // ---- The page ----------------------------------------------------------------

  function wire(){
    var health = plugin();
    var journal = root.DoloPawsJournalImport;
    var gpx = root.DoloPawsGpxWalk;
    var row = document.querySelector('.jn-gpx-row');
    if(!health || !journal || !gpx || !row || document.getElementById('appHealthBtn')) return;
    var platform = root.Capacitor.getPlatform();
    var word = function(name){ return storeWord(platform, name); };

    Promise.resolve(health.isAvailable()).then(function(r){
      if(!r || !r.available) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'appHealthBtn';
      btn.className = 'jn-gpx-btn app-health-btn';
      btn.textContent = word('add');
      row.insertBefore(btn, row.firstChild);
      btn.addEventListener('click', openList);
    }).catch(function(){});

    var overlay = null;
    function sheet(){
      if(overlay) return overlay;
      overlay = document.createElement('div');
      overlay.className = 'jn-overlay app-health';
      overlay.hidden = true;
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'appHealthTitle');
      overlay.innerHTML = '<div class="jn-modal">' +
        '<div class="jn-modal-head"><h2 id="appHealthTitle">' + esc(word('title')) + '</h2>' +
        '<button type="button" class="jn-x app-health-close" aria-label="' + esc(label('journal.close', 'Close')) + '">&times;</button></div>' +
        '<p class="app-health-sub">' + esc(label('journal.health.sub', 'Choose a walk. A walk that follows most of an ORMA trail leaves a pawprint.')) + '</p>' +
        '<div class="app-health-body" role="status"></div></div>';
      document.body.appendChild(overlay);
      overlay.querySelector('.app-health-close').addEventListener('click', close);
      overlay.addEventListener('click', function(e){
        if(e.target === overlay){ close(); return; }
        var pick = e.target.closest('.app-health-walk');
        if(pick) choose(pick.dataset.id);
      });
      overlay.addEventListener('keydown', function(e){ if(e.key === 'Escape'){ e.preventDefault(); close(); } });
      return overlay;
    }
    function close(){ if(overlay) overlay.hidden = true; }
    function body(html){ sheet().querySelector('.app-health-body').innerHTML = html; }
    var lang = function(){ return (root.DoloPawsI18n && root.DoloPawsI18n.lang) || 'en'; };

    function openList(){
      var o = sheet();
      body('<p class="app-health-wait">' + esc(word('loading')) + '</p>');
      o.hidden = false;
      Promise.resolve(health.requestAccess()).then(function(){
        return health.listWalks({ days: DAYS, limit: LIMIT });
      }).then(function(r){
        body(listHtml(walkRows(r && r.walks, journal.entries(), { lang: lang() }), platform));
        var first = o.querySelector('.app-health-walk, .app-health-close');
        if(first) first.focus();
      }).catch(function(){
        body('<p class="app-health-empty">' + esc(word('error')) + '</p>');
      });
    }

    function choose(id){
      body('<p class="app-health-wait">' + esc(label('journal.health.reading', 'Reading the route…')) + '</p>');
      Promise.resolve(health.getRoute({ id: id })).then(function(r){
        var result = gpx.assessPoints(r && r.points, journal.trails(), { now: Date.now() });
        close();
        journal.show(result, {
          title: word('resultTitle'),
          againLabel: label('journal.health.again', 'Choose another walk'),
          onAgain: openList,
        });
      }).catch(function(){
        body('<p class="app-health-empty">' + esc(word('error')) + '</p>');
      });
    }
  }

  var api = { DAYS: DAYS, walkRows: walkRows, listHtml: listHtml, storeWord: storeWord, plugin: plugin, wire: wire };
  if(typeof module !== 'undefined' && module.exports){ module.exports = api; return; }
  if(root.__ormaAppHealth) return;
  root.__ormaAppHealth = true;
  // The journal sets up DoloPawsJournalImport in its own DOMContentLoaded
  // handler, and this deferred script runs before that event fires. So wait
  // for the journal rather than for the page: try now, after
  // DOMContentLoaded (the journal's handler was added first, so it runs
  // first) and after load, and wire once.
  var wired = false;
  function start(){
    if(wired || !root.DoloPawsJournalImport) return;
    wired = true;
    wire();
  }
  start();
  document.addEventListener('DOMContentLoaded', start);
  root.addEventListener('load', start);
})(typeof window !== 'undefined' ? window : globalThis);
