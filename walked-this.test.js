const fs = require('fs');
const path = require('path');
const vm = require('vm');

// breeds-data.js has no exports; lift the real breedGroupId out of it.
function realBreedGroupId(){
  const context = {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'breeds-data.js'), 'utf8') +
    '\n;this.breedGroupId = breedGroupId;', context);
  return context.breedGroupId;
}

describe('SOCIAL-01 walk tally', () => {
  let walked;

  beforeEach(() => {
    jest.resetModules();
    delete window.DoloPawsWalkedThis;
    delete window.breedGroupId;
    localStorage.clear();
    walked = require('./walked-this.js');
  });

  test('the dog is reduced to its FCI group, as the tally rule allows', () => {
    const breedGroupId = realBreedGroupId();
    window.breedGroupId = breedGroupId;
    localStorage.setItem('dolopaws-profile-summary', JSON.stringify({
      activeDogId: 'b', dogs: [{ id: 'a', breed: 'Pug' }, { id: 'b', breed: 'Border Collie' }],
    }));
    const group = walked.activeDogGroup();
    expect(group).toBe(breedGroupId('Border Collie'));
    expect(group).toMatch(/^(g\d{1,2}|unknown)$/);
    expect(group.length).toBeLessThanOrEqual(12);
    localStorage.removeItem('dolopaws-profile-summary');
    expect(walked.activeDogGroup()).toBe(breedGroupId(''));
  });

  test('a corrupt profile tags the walk unknown', () => {
    localStorage.setItem('dolopaws-profile-summary', '[not json');
    expect(walked.activeDogGroup()).toBe('unknown');
  });
});

describe('SOCIAL-04 a walk counts only by recording it', () => {
  const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

  test('the trail page has no one-tap "We walked this"', () => {
    document.body.innerHTML = read('trail.html');
    expect(document.getElementById('walkedThisBtn')).toBeNull();
    expect(document.getElementById('walkedThisStatus')).toBeNull();
    expect(read('trail.js')).not.toContain('walkedThisBtn');
    expect(read('i18n.js')).not.toContain("'page.trail.walkedThis'");
  });

  test('the bundle loads the tally helper before hike mode, which tags its walks through it', () => {
    const { SOURCES } = require('./scripts/build-trail-page-bundle.js');
    expect(SOURCES.indexOf('walked-this.js')).toBeGreaterThan(-1);
    expect(SOURCES.indexOf('walked-this.js')).toBeLessThan(SOURCES.indexOf('hike-mode.js'));
    expect(SOURCES.indexOf('walk-proof.js')).toBeGreaterThan(-1);
    expect(SOURCES.indexOf('walk-proof.js')).toBeLessThan(SOURCES.indexOf('hike-mode.js'));
  });
});

describe('SOCIAL-04 a simpler walk', () => {
  const hikeMode = fs.readFileSync(path.join(__dirname, 'hike-mode.js'), 'utf8');
  const section = (from, to) => hikeMode.slice(hikeMode.indexOf(from), hikeMode.indexOf(to));

  test('pause keeps the map and offers Resume or Finish walk', () => {
    const pause = section('function pauseHike', 'function persistCompletionAndShow');
    expect(pause).toContain('stopHike(true, true)');
    expect(pause).toContain('showPauseSheet()');
    expect(hikeMode).toContain('data-pause="resume"');
    expect(hikeMode).toContain('data-pause="finish"');
    expect(hikeMode).toContain("dock.querySelector('.hk-dock-pause').addEventListener('click', () => pauseHike());");
  });

  test('finishing short of the proof says so before, not after', () => {
    const sheet = section('function showPauseSheet', 'function hidePauseSheet');
    expect(sheet).toContain('routeShare() >= walkProof.MIN_SHARE');
  });

  test('the finish card asks one question and keeps the rest behind Tell us more', () => {
    const outcome = section('function renderOutcome', "q('#hkMoreToggle').addEventListener");
    expect(outcome).toMatch(/\['appropriate', window\.t\('hike\.suitYes'\)\],\s*\['appropriate_with_unexpected_cautions', window\.t\('hike\.suitCare'\)\],\s*\['not_appropriate', window\.t\('hike\.suitNo'\)\],\s*\]\.concat\(showMore/);
    expect(outcome).toContain("!showMore || !outcomeResponse");
    expect(hikeMode).toContain('<div class="hk-block hk-more" hidden>');
  });

  test('every new label exists in English and Italian', () => {
    const i18n = fs.readFileSync(path.join(__dirname, 'i18n.js'), 'utf8');
    for(const key of ['hike.dockWalked', 'hike.dockOfRoute', 'hike.pausedTitle', 'hike.pausedSummary',
      'hike.resumeAction', 'hike.finishWalk', 'hike.finishWontCount', 'hike.suitQuestion',
      'hike.suitQuestionYourDog', 'hike.suitPrivate', 'hike.suitYes', 'hike.suitCare', 'hike.suitNo', 'hike.tellMore']){
      expect(i18n.split(`'${key}':`).length - 1).toBe(2);
    }
  });
});
