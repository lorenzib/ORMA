const fs = require('fs');
const path = require('path');
const vm = require('vm');

// The published Lago di Carezza loop, as the trail page receives it.
function realTrail(id){
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'data/trail-details', `${id}.js`), 'utf8'), context);
  return context.window.trails.find(trail => trail.id === id);
}

const M_PER_DEG = 111000;
function metersBetween(a, b){
  const dLat = (b[0] - a[0]) * M_PER_DEG;
  const dLng = (b[1] - a[1]) * M_PER_DEG * Math.cos(((a[0] + b[0]) / 2) * Math.PI / 180);
  return Math.hypot(dLat, dLng);
}

// Walk the line the way hike mode reports it: distance along the line plus
// distance off it, one fix per vertex.
function walkLine(proof, line, { upToShare = 1, offsetM = 10 } = {}){
  const cum = [0];
  for(let i = 1; i < line.length; i++) cum.push(cum[i - 1] + metersBetween(line[i - 1], line[i]));
  const total = cum[cum.length - 1];
  let coverage = proof.createCoverage(total);
  for(let i = 0; i < line.length && cum[i] <= total * upToShare; i++){
    coverage = proof.markFix(coverage, { alongM: cum[i], distanceM: offsetM });
  }
  return { coverage, total };
}

describe('SOCIAL-02 proven walks', () => {
  let proof;
  let trail;
  const start = new Date(2026, 10, 6, 10, 0).getTime();

  beforeEach(() => {
    jest.resetModules();
    delete window.DoloPawsWalkProof;
    localStorage.clear();
    proof = require('./walk-proof.js');
    trail = realTrail('lago-carezza');
  });

  test('a hike that walks the whole route at walking pace is proven by GPS', () => {
    const { coverage } = walkLine(proof, trail.path);
    const verdict = proof.assessHike({ coverage, startedAt: start, completedAt: start + 30 * 60000 });
    expect(verdict.proof).toBe('gps');
    expect(verdict.share).toBeGreaterThan(0.95);
  });

  test('a hike that stops halfway is not proven, and says how much it covered', () => {
    const { coverage } = walkLine(proof, trail.path, { upToShare: 0.5 });
    const verdict = proof.assessHike({ coverage, startedAt: start, completedAt: start + 30 * 60000 });
    expect(verdict.proof).toBeNull();
    expect(verdict.reason).toBe('too-little-of-the-route');
    expect(verdict.share).toBeGreaterThan(0.4);
    expect(verdict.share).toBeLessThan(proof.MIN_SHARE);
  });

  test('fixes that never come near the line walk none of it', () => {
    const { coverage } = walkLine(proof, trail.path, { offsetM: proof.NEAR_M + 1 });
    expect(proof.share(coverage)).toBe(0);
  });

  test('the whole route in a few minutes is not a walk', () => {
    const { coverage, total } = walkLine(proof, trail.path);
    const tooQuickMs = (total / 1000) / (proof.MAX_KMH * 2) * 3600000;
    expect(proof.assessHike({ coverage, startedAt: start, completedAt: start + tooQuickMs }).reason).toBe('too-fast');
  });

  test('a hike left running for days is not one walk', () => {
    const { coverage } = walkLine(proof, trail.path);
    const verdict = proof.assessHike({ coverage, startedAt: start, completedAt: start + (proof.MAX_HOURS + 1) * 3600000 });
    expect(verdict.reason).toBe('not-one-walk');
  });

  test('a gap in the fixes is bridged only when it is short', () => {
    let coverage = proof.createCoverage(2000);
    coverage = proof.markFix(coverage, { alongM: 0, distanceM: 5 });
    coverage = proof.markFix(coverage, { alongM: proof.FILL_M - 10, distanceM: 5 });
    const bridged = proof.share(coverage);
    expect(bridged).toBeCloseTo((Math.floor((proof.FILL_M - 10) / proof.BIN_M) + 1) * proof.BIN_M / 2000);
    coverage = proof.markFix(coverage, { alongM: 1900, distanceM: 5 });
    expect(proof.share(coverage)).toBeCloseTo(bridged + proof.BIN_M / 2000);
  });

  test('coverage survives the app closing, for the same hike only', () => {
    const { coverage } = walkLine(proof, trail.path, { upToShare: 0.5 });
    expect(proof.saveCoverage('session-1', coverage)).toBe(true);
    expect(proof.loadCoverage('session-1')).toEqual(coverage);
    expect(proof.loadCoverage('session-2')).toBeNull();
    proof.clearCoverage();
    expect(proof.loadCoverage('session-1')).toBeNull();
    localStorage.setItem(proof.STORAGE_KEY, '{broken');
    expect(proof.loadCoverage('session-1')).toBeNull();
  });

  describe('a recording ends itself', () => {
    const proven = () => walkLine(proof, trail.path).coverage;
    const half = () => walkLine(proof, trail.path, { upToShare: 0.5 }).coverage;

    test('a loop ends back where the recording started, once it is proven', () => {
      expect(proof.reachedFinish({ coverage: proven(), shape: 'loop', toStartM: 20, toEndM: 5000 })).toBe(true);
      expect(proof.reachedFinish({ coverage: proven(), shape: 'loop', toStartM: proof.FINISH_M + 1, toEndM: 0 })).toBe(false);
    });

    test('a walk not yet proven never ends itself, even at the finish', () => {
      expect(proof.reachedFinish({ coverage: half(), shape: 'loop', toStartM: 0 })).toBe(false);
      expect(proof.reachedFinish({ coverage: half(), shape: 'one-way', toEndM: 0 })).toBe(false);
    });

    test('an out-and-back must reach the far end before the start ends it', () => {
      expect(proof.reachedFinish({ coverage: proven(), shape: 'out-and-back', toStartM: 10, furthestShare: 0.6 })).toBe(false);
      expect(proof.reachedFinish({ coverage: proven(), shape: 'out-and-back', toStartM: 10, furthestShare: 0.95 })).toBe(true);
    });

    test('a one-way walk ends at the far end of the line', () => {
      expect(proof.reachedFinish({ coverage: proven(), shape: 'one-way', toStartM: 0, toEndM: 30 })).toBe(true);
      expect(proof.reachedFinish({ coverage: proven(), shape: 'one-way', toStartM: 0, toEndM: 500 })).toBe(false);
    });
  });

  describe('a tap on "We walked this"', () => {
    const at = (lat, lng, accuracy = 15) => ({ coords: { latitude: lat, longitude: lng, accuracy } });

    test('made on the trail is a check-in', () => {
      const [lat, lng] = trail.path[Math.floor(trail.path.length / 2)];
      expect(proof.assessCheckIn(at(lat, lng), trail.path)).toMatchObject({ proof: 'checkin' });
    });

    test('made between two points of the line still counts', () => {
      const a = trail.path[10];
      const b = trail.path[11];
      const mid = at((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      expect(proof.assessCheckIn(mid, trail.path).distanceM).toBeLessThan(5);
    });

    test('made from home proves nothing', () => {
      // Bolzano station, about 20 km from the lake.
      const verdict = proof.assessCheckIn(at(46.4964, 11.3580), trail.path);
      expect(verdict.proof).toBeNull();
      expect(verdict.reason).toBe('not-on-the-trail');
      expect(verdict.distanceM).toBeGreaterThan(10000);
    });

    test('a vague or missing position proves nothing', () => {
      const [lat, lng] = trail.path[0];
      expect(proof.assessCheckIn(at(lat, lng, proof.MAX_ACCURACY_M + 1), trail.path).reason).toBe('position-too-vague');
      expect(proof.assessCheckIn(null, trail.path).reason).toBe('no-position');
    });
  });
});

describe('SOCIAL-02 wiring', () => {
  const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

  test('the client sends only the proofs the rules accept', () => {
    const { PROOFS } = require('./walk-proof.js');
    const rules = read('firestore.rules');
    expect(rules).toContain(`request.resource.data.proof in [${PROOFS.map(p => `'${p}'`).join(', ')}]`);
    expect(require('./walked-this.js').PROOFS).toEqual(PROOFS);
    expect(read('firebase-init.js')).toContain('if (proof !== "gps" && proof !== "checkin") return false;');
  });

  test('a finished hike is counted only when GPS proves it', () => {
    const hikeMode = read('hike-mode.js');
    const finish = hikeMode.slice(hikeMode.indexOf('function persistCompletionAndShow'), hikeMode.indexOf('function finishHike'));
    expect(finish).toContain("proof.proof === 'gps'");
    expect(finish).toContain("recordTrailWalk(trail.id, activeDogGroup(), 'gps')");
    expect(finish.indexOf('assessHike')).toBeLessThan(finish.indexOf('clearDurableSession()'));
  });

  test('hike mode ends a proven walk by itself, after the fix is stored', () => {
    const hikeMode = read('hike-mode.js');
    const onFix = hikeMode.slice(hikeMode.indexOf('function onFix'), hikeMode.indexOf('function onError'));
    expect(onFix).toContain('walkProof.reachedFinish(');
    expect(onFix).toContain('finishHike()');
    expect(onFix.indexOf('markCoverage(')).toBeLessThan(onFix.indexOf('reachedFinish('));
  });

  test('the tap checks where the phone is before it records', () => {
    const trailJs = read('trail.js');
    const handler = trailJs.slice(trailJs.indexOf("walkedThisBtn.addEventListener('click'"));
    expect(handler.indexOf('assessCheckIn')).toBeGreaterThan(-1);
    expect(handler.indexOf('assessCheckIn')).toBeLessThan(handler.indexOf('walked.record('));
    expect(handler).toContain('proof: checkIn.proof');
  });
});
