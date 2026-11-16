(function(root){
  'use strict';

  // SOCIAL-02 proven walks. A walk counts -- in the public tally now, in the
  // dog passport later -- only when the phone shows it happened, the way only
  // a GPS activity earns a Strava segment. One kind of proof, 'gps': a hike
  // recorded in hike mode whose fixes covered most of the trail's line, at a
  // pace a person and a dog can walk. (SOCIAL-04 removed the one-tap
  // check-in: proof comes from recording.)
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
  const FINISH_M = 75;         // this close to the finish ends a proven walk
  const FAR_END_SHARE = 0.9;   // an out-and-back has turned round past here
  const STORAGE_KEY = 'orma-walk-coverage-v1';

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

  // ---- Where along the line a fix is ---------------------------------------
  // Many trails cross the same ground twice: a there-and-back is drawn out
  // and back over one path, a lollipop shares its stem. One fix then sits on
  // the line in two places, and the nearest point of the line put every fix
  // of the way home on the way out: coverage stalled near half and a walk
  // there and back could never be proven.

  // A step back along the line costs this many times a step forward.
  const BACK_WEIGHT = 4;

  // A line ready for placing fixes: flat metres, and the distance along it at
  // each point. Pass cum to measure along the line exactly as the caller does.
  function prepareLine(path, cum){
    const points = Array.isArray(path) ? path : [];
    const lat0 = points.reduce((sum, p) => sum + p[0], 0) / (points.length || 1);
    const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
    const xy = points.map(p => [p[1] * kx, p[0] * ky]);
    let along = cum;
    if(!Array.isArray(along) || along.length !== points.length){
      along = [0];
      for(let i = 1; i < xy.length; i++){
        along.push(along[i - 1] + Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]));
      }
    }
    return { xy, cum: along, kx, ky, lengthM: along[along.length - 1] || 0 };
  }

  // Every pass of the line near a fix, and the nearest point of all. A pass
  // is each low point of the distance from the fix as you go along the line,
  // kept when it is within nearM.
  function passesNear(line, lat, lng, nearM){
    const px = lng * line.kx, py = lat * line.ky;
    let nearest = { alongM: 0, distanceM: Infinity };
    const passes = [];
    let before = Infinity, low = null;
    for(let i = 1; i < line.xy.length; i++){
      const ax = line.xy[i - 1][0], ay = line.xy[i - 1][1];
      const dx = line.xy[i][0] - ax, dy = line.xy[i][1] - ay;
      const len2 = dx * dx + dy * dy;
      const f = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
      const ex = ax + dx * f - px, ey = ay + dy * f - py;
      const here = { alongM: line.cum[i - 1] + (line.cum[i] - line.cum[i - 1]) * f, distanceM: Math.sqrt(ex * ex + ey * ey) };
      if(here.distanceM < nearest.distanceM) nearest = here;
      // A pass ends where the distance stops falling and starts to rise again.
      if(here.distanceM < before) low = here;
      else if(here.distanceM > before && low){
        if(low.distanceM <= nearM) passes.push(low);
        low = null;
      }
      before = here.distanceM;
    }
    if(low && low.distanceM <= nearM) passes.push(low);
    return { nearest, passes };
  }

  // What moving along the line from one place to another costs.
  function moveCost(fromM, toM){
    return toM >= fromM ? toM - fromM : (fromM - toM) * BACK_WEIGHT;
  }

  // Placing a walk as it happens, for hike mode, which cannot see the fixes
  // still to come. It keeps every pass the latest fix could be on, each with
  // the least movement along the line that reaches it (a step back costing
  // BACK_WEIGHT times a step forward), and says the walker is on the cheapest.
  // Walking home down the second half of a there-and-back is then cheaper
  // within a few metres of the turnaround than walking backwards down the
  // first, while a fix that is wrong for a moment (GPS wobble, a switchback's
  // neighbouring leg) does not throw away the passes it did not choose: the
  // next fixes can still prove them right. Only the latest fix's passes are
  // kept, so it is a handful of numbers that fits beside the hike session.
  //
  // alongM seeds a placement already known (a hike resumed after a restart).
  function createPlacement(alongM){
    const at = Number(alongM);
    return { frontier: alongM !== null && alongM !== undefined && Number.isFinite(at) ? [{ alongM: at, cost: 0 }] : [] };
  }

  // Where along the line the walker is now: the cheapest kept pass, or null.
  function placedAlongM(placement){
    const frontier = placement && Array.isArray(placement.frontier) ? placement.frontier : [];
    let best = null;
    frontier.forEach(state => { if(!best || state.cost < best.cost) best = state; });
    return best ? best.alongM : null;
  }

  // Place one fix, given passesNear's answer for it. Returns the placement to
  // keep and the fix as markFix takes it. A fix with nothing near keeps its
  // nearest point (markFix ignores it) and leaves the placement as it was.
  function placeFix(placement, found){
    const frontier = placement && Array.isArray(placement.frontier) ? placement.frontier : [];
    const passes = found && Array.isArray(found.passes) ? found.passes : [];
    const nearest = (found && found.nearest) || { alongM: 0, distanceM: Infinity };
    if(!passes.length) return { placement: { frontier }, fix: nearest };
    const costs = passes.map(pass => {
      // The first fix of a walk. A walk begins at the start of its line, and
      // on a there-and-back or a lollipop the start is also the finish, so
      // the first fix favours the earliest pass -- weakly (a quarter of the
      // way to it) so that a recording begun part way round is soon found.
      if(!frontier.length) return pass.alongM / BACK_WEIGHT;
      let best = Infinity;
      frontier.forEach(state => {
        const cost = state.cost + moveCost(state.alongM, pass.alongM);
        if(cost < best) best = cost;
      });
      return best;
    });
    const least = Math.min.apply(null, costs);
    const k = costs.indexOf(least);
    return {
      placement: { frontier: passes.map((pass, i) => ({ alongM: pass.alongM, cost: costs[i] - least })) },
      fix: passes[k],
    };
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
    BIN_M, NEAR_M, FILL_M, MIN_SHARE, MAX_KMH, MAX_HOURS, STORAGE_KEY,
    FINISH_M, FAR_END_SHARE, BACK_WEIGHT,
    PROOFS: ['gps'],
    createCoverage, markFix, share, assessHike, reachedFinish,
    prepareLine, passesNear, moveCost, createPlacement, placeFix, placedAlongM,
    saveCoverage, loadCoverage, clearCoverage,
  };
  root.DoloPawsWalkProof = api;
  if(typeof module !== 'undefined' && module.exports){ module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
