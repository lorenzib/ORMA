(function(root){
  'use strict';

  // SOCIAL-02 proven walks. A walk counts -- in the public tally now, in the
  // dog passport later -- only when the phone shows it happened, the way only
  // a GPS activity earns a Strava segment. Two kinds of proof:
  //
  //   'gps'     a hike recorded in hike mode whose fixes covered most of the
  //             trail's line, at a pace a person and a dog can walk;
  //   'checkin' a tap on "We walked this" made on the trail, with the phone
  //             placing the walker within reach of the line.
  //
  // Anything else proves nothing and is not counted. The checks run on the
  // phone (the free Firebase plan has no server to run them), so they stop
  // honest mistakes and casual claims, not a forged GPS track.
  //
  // No Firebase, no DOM, no clock of its own, so it is testable on its own.

  const BIN_M = 50;            // the line is judged in 50 m stretches
  const NEAR_M = 60;           // a fix this close to the line walks it
  const FILL_M = 250;          // two on-line fixes this close along the line
                               // vouch for the stretch between them
  const MIN_SHARE = 0.75;      // share of the line a proven walk covers
  const MAX_KMH = 7;           // faster than this over the covered line is not a walk
  const MAX_HOURS = 16;        // one walk, one day
  const CHECKIN_M = 150;       // how close a check-in must be to the line
  const MAX_ACCURACY_M = 100;  // a vaguer position proves nothing
  const FINISH_M = 75;         // this close to the finish ends a proven walk
  const FAR_END_SHARE = 0.9;   // an out-and-back has turned round past here
  const STORAGE_KEY = 'orma-walk-coverage-v1';

  const M_PER_DEG = 111000;

  // Metres on a local flat projection around the point: plenty for distances
  // of a few hundred metres, which is all these checks ever compare.
  function project(lat, lng, refLat){
    return [lng * M_PER_DEG * Math.cos(refLat * Math.PI / 180), lat * M_PER_DEG];
  }

  function distanceToLine(lat, lng, path){
    if(!Array.isArray(path) || path.length === 0) return Infinity;
    const p = project(lat, lng, lat);
    let best = Infinity;
    for(let i = 0; i < path.length; i++){
      const a = project(path[i][0], path[i][1], lat);
      const b = i + 1 < path.length ? project(path[i + 1][0], path[i + 1][1], lat) : a;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const length2 = dx * dx + dy * dy;
      const t = length2 > 0
        ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2))
        : 0;
      const d = Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
      if(d < best) best = d;
    }
    return best;
  }

  // ---- GPS coverage of the line --------------------------------------------
  // The line is cut into BIN_M stretches; a stretch is walked once a usable
  // fix lands near it. Kept as a string of '0'/'1' so it fits beside the
  // durable hike session and survives the app closing mid-walk.

  function createCoverage(lineMeters){
    const bins = Math.max(1, Math.ceil((Number(lineMeters) || 0) / BIN_M));
    return { binM: BIN_M, walked: '0'.repeat(bins), lastAlongM: null };
  }

  function validCoverage(coverage){
    return !!coverage && typeof coverage.walked === 'string' && /^[01]+$/.test(coverage.walked) &&
      coverage.binM === BIN_M;
  }

  function markFix(coverage, fix){
    if(!validCoverage(coverage)) return coverage;
    const alongM = Number(fix && fix.alongM);
    const distanceM = Number(fix && fix.distanceM);
    if(!Number.isFinite(alongM) || !Number.isFinite(distanceM) || distanceM > NEAR_M) return coverage;
    const bins = coverage.walked.split('');
    const last = bins.length - 1;
    const binOf = metres => Math.max(0, Math.min(last, Math.floor(metres / BIN_M)));
    const here = binOf(alongM);
    let from = here;
    let to = here;
    const previous = coverage.lastAlongM;
    if(Number.isFinite(previous) && Math.abs(alongM - previous) <= FILL_M){
      from = Math.min(here, binOf(previous));
      to = Math.max(here, binOf(previous));
    }
    for(let i = from; i <= to; i++) bins[i] = '1';
    return { binM: BIN_M, walked: bins.join(''), lastAlongM: alongM };
  }

  function share(coverage){
    if(!validCoverage(coverage)) return 0;
    const walked = coverage.walked.split('').filter(bin => bin === '1').length;
    return walked / coverage.walked.length;
  }

  // Judge a finished hike. Returns { proof: 'gps' | null, share, reason }.
  function assessHike(input){
    const opts = input || {};
    const covered = share(opts.coverage);
    const result = (proof, reason) => ({ proof, share: covered, reason });
    if(covered < MIN_SHARE) return result(null, 'too-little-of-the-route');
    const hours = (Number(opts.completedAt) - Number(opts.startedAt)) / 3600000;
    if(!Number.isFinite(hours) || hours <= 0 || hours > MAX_HOURS) return result(null, 'not-one-walk');
    const lineKm = (opts.coverage.walked.length * BIN_M) / 1000;
    if((lineKm * covered) / hours > MAX_KMH) return result(null, 'too-fast');
    return result('gps', 'proven');
  }

  // SOCIAL-03: a recording ends itself, so nobody has to remember Finish.
  // The walk is over once it is proven (MIN_SHARE of the line walked) and the
  // walker is back where the walk ends:
  //   loop / out-and-back  where the recording started (a loop may be begun
  //                        from any car park on it; an out-and-back must
  //                        also have reached the far end first);
  //   one-way              the far end of the line.
  function reachedFinish(input){
    const opts = input || {};
    if(share(opts.coverage) < MIN_SHARE) return false;
    if(opts.shape === 'out-and-back'){
      return Number(opts.furthestShare) >= FAR_END_SHARE && Number(opts.toStartM) <= FINISH_M;
    }
    if(opts.shape === 'loop') return Number(opts.toStartM) <= FINISH_M;
    return Number(opts.toEndM) <= FINISH_M;
  }

  // Judge a tap on "We walked this" against where the phone says it is.
  // Returns { proof: 'checkin' | null, reason, distanceM }.
  function assessCheckIn(position, path){
    const coords = position && position.coords;
    if(!coords) return { proof: null, reason: 'no-position', distanceM: null };
    const accuracy = Number(coords.accuracy);
    if(!Number.isFinite(accuracy) || accuracy > MAX_ACCURACY_M){
      return { proof: null, reason: 'position-too-vague', distanceM: null };
    }
    const distanceM = distanceToLine(Number(coords.latitude), Number(coords.longitude), path);
    if(!(distanceM <= CHECKIN_M)) return { proof: null, reason: 'not-on-the-trail', distanceM };
    return { proof: 'checkin', reason: 'on-the-trail', distanceM };
  }

  // ---- Keeping coverage across a restart -----------------------------------

  function safeStorage(storage){
    if(storage) return storage;
    try {
      return root.localStorage;
    } catch (error) {
      return null;
    }
  }

  // One hike at a time, so one slot, tagged with its session.
  function saveCoverage(sessionId, coverage, storage){
    const store = safeStorage(storage);
    if(!store || !sessionId || !validCoverage(coverage)) return false;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify({ sessionId: String(sessionId), coverage }));
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadCoverage(sessionId, storage){
    const store = safeStorage(storage);
    if(!store || !sessionId) return null;
    try {
      const saved = JSON.parse(store.getItem(STORAGE_KEY) || 'null');
      return saved && saved.sessionId === String(sessionId) && validCoverage(saved.coverage)
        ? saved.coverage
        : null;
    } catch (error) {
      return null;
    }
  }

  function clearCoverage(storage){
    const store = safeStorage(storage);
    if(!store) return;
    try { store.removeItem(STORAGE_KEY); } catch (error) { /* nothing to clear */ }
  }

  const api = {
    BIN_M, NEAR_M, FILL_M, MIN_SHARE, MAX_KMH, MAX_HOURS, CHECKIN_M, MAX_ACCURACY_M, STORAGE_KEY,
    FINISH_M, FAR_END_SHARE,
    PROOFS: ['gps', 'checkin'],
    distanceToLine, createCoverage, markFix, share, assessHike, assessCheckIn, reachedFinish,
    saveCoverage, loadCoverage, clearCoverage,
  };
  root.DoloPawsWalkProof = api;
  if(typeof module !== 'undefined' && module.exports){ module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
