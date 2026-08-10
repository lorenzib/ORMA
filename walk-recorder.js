(function(global){
  'use strict';

  // Record-anywhere walk engine. Pure state machine — the page feeds it
  // geolocation fixes and a clock; it answers with distance, elapsed time
  // and a route. No DOM, no timers, no geolocation calls in here, so the
  // whole thing is unit-testable.

  var MAX_ACCURACY_M = 50;    // reject fuzzy fixes (indoors, cold start)
  var MAX_SPEED_MPS = 30;     // reject GPS teleports
  var MIN_STEP_M = 2;         // ignore standing-still jitter

  function haversineM(a, b){
    var R = 6371000;
    var dLat = (b.lat - a.lat) * Math.PI / 180;
    var dLng = (b.lng - a.lng) * Math.PI / 180;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180)
      * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  // Thin the recorded path for storage: keep the first and last fix and
  // any point at least minGapM from the previously kept one.
  function simplifyPath(points, minGapM){
    var gap = minGapM || 15;
    if(points.length <= 2) return points.slice();
    var kept = [points[0]];
    for(var i = 1; i < points.length - 1; i++){
      if(haversineM(kept[kept.length - 1], points[i]) >= gap) kept.push(points[i]);
    }
    kept.push(points[points.length - 1]);
    return kept;
  }

  function createRecorder(){
    var state = {
      status: 'idle',            // idle | recording | paused | finished
      points: [],
      distanceM: 0,
      startedAt: null,
      segmentStartedAt: null,    // wall clock of the current recording segment
      elapsedBeforeMs: 0,        // accumulated across pauses
      lastFix: null,
      rejected: 0,
    };

    function start(now){
      if(state.status !== 'idle') return false;
      state.status = 'recording';
      state.startedAt = now;
      state.segmentStartedAt = now;
      return true;
    }

    function pause(now){
      if(state.status !== 'recording') return false;
      state.elapsedBeforeMs += now - state.segmentStartedAt;
      state.segmentStartedAt = null;
      state.status = 'paused';
      state.lastFix = null; // never bridge a pause with a straight line
      return true;
    }

    function resume(now){
      if(state.status !== 'paused') return false;
      state.segmentStartedAt = now;
      state.status = 'recording';
      return true;
    }

    function elapsedMs(now){
      var running = state.status === 'recording' && state.segmentStartedAt != null
        ? now - state.segmentStartedAt : 0;
      return state.elapsedBeforeMs + running;
    }

    function addFix(fix){
      if(state.status !== 'recording') return { accepted: false, reason: 'not-recording' };
      if(!fix || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)){
        return { accepted: false, reason: 'invalid' };
      }
      if(Number.isFinite(fix.accuracy) && fix.accuracy > MAX_ACCURACY_M){
        state.rejected++;
        return { accepted: false, reason: 'accuracy' };
      }
      var point = { lat: fix.lat, lng: fix.lng, t: fix.timestamp || 0 };
      if(state.lastFix){
        var meters = haversineM(state.lastFix, point);
        var seconds = Math.max(0.001, (point.t - state.lastFix.t) / 1000);
        if(point.t && state.lastFix.t && meters / seconds > MAX_SPEED_MPS){
          state.rejected++;
          return { accepted: false, reason: 'jump' };
        }
        if(meters < MIN_STEP_M) return { accepted: false, reason: 'jitter' };
        state.distanceM += meters;
      }
      state.lastFix = point;
      state.points.push(point);
      return { accepted: true };
    }

    function finish(now){
      if(state.status === 'recording') pause(now);
      state.status = 'finished';
      return summary(now);
    }

    function summary(now){
      return {
        distanceM: Math.round(state.distanceM),
        durationMs: elapsedMs(now),
        startedAt: state.startedAt,
        points: state.points.length,
        route: simplifyPath(
          state.points.map(function(p){ return { lat: p.lat, lng: p.lng }; })
        ).map(function(p){
          return [Math.round(p.lat * 1e5) / 1e5, Math.round(p.lng * 1e5) / 1e5];
        }),
      };
    }

    // Crash recovery: the page snapshots this to localStorage and can
    // rebuild a recorder mid-walk after a reload.
    function snapshot(){
      return {
        status: state.status, points: state.points, distanceM: state.distanceM,
        startedAt: state.startedAt, segmentStartedAt: state.segmentStartedAt,
        elapsedBeforeMs: state.elapsedBeforeMs, lastFix: state.lastFix,
      };
    }

    function restore(snap, now){
      if(!snap || !Array.isArray(snap.points)) return false;
      state.points = snap.points;
      state.distanceM = Number(snap.distanceM) || 0;
      state.startedAt = snap.startedAt || now;
      state.elapsedBeforeMs = Number(snap.elapsedBeforeMs) || 0;
      // A recording that died mid-segment can't know how long the gap was —
      // resume paused so the timer stays honest.
      if(snap.status === 'recording' && snap.segmentStartedAt != null){
        state.elapsedBeforeMs += Math.max(0, (snap.savedAt || snap.segmentStartedAt) - snap.segmentStartedAt);
      }
      state.segmentStartedAt = null;
      state.lastFix = null;
      state.status = 'paused';
      return true;
    }

    return {
      start: start, pause: pause, resume: resume, finish: finish,
      addFix: addFix, elapsedMs: elapsedMs, summary: summary,
      snapshot: snapshot, restore: restore,
      get status(){ return state.status; },
      get distanceM(){ return state.distanceM; },
      get pointCount(){ return state.points.length; },
    };
  }

  // A finished recording in the journal's own entry shape — recorded walks
  // file next to hand-logged ones with no special casing in the journal.
  function buildJournalEntry(walkSummary, options){
    options = options || {};
    var now = options.now || 0;
    var km = walkSummary.distanceM / 1000;
    var minutes = Math.max(1, Math.round(walkSummary.durationMs / 60000));
    return {
      id: 'w' + now,
      date: new Date(walkSummary.startedAt || now).toISOString(),
      trailId: null,
      trail: options.name || 'Recorded walk',
      region: '',
      dist: (Math.round(km * 10) / 10).toFixed(1),
      dur: String(minutes),
      cond: options.cond || 'Comfortable',
      rating: options.rating || 5,
      note: options.note || '',
      photos: 0,
      shareToTrail: false,
      recorded: true,
      route: walkSummary.route,
    };
  }

  var api = {
    createRecorder: createRecorder,
    haversineM: haversineM,
    simplifyPath: simplifyPath,
    buildJournalEntry: buildJournalEntry,
  };
  global.DoloPawsWalkRecorder = api;
  if(typeof module !== 'undefined' && module.exports){ module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
