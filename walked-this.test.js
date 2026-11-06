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

describe('SOCIAL-01 one-tap "We walked this"', () => {
  let walked;
  const noon = new Date(2026, 10, 6, 12, 0).getTime();
  const community = (ok = true) => ({ calls: [], recordTrailWalk(trailId, group){ this.calls.push([trailId, group]); return Promise.resolve(ok); } });

  beforeEach(() => {
    jest.resetModules();
    delete window.DoloPawsWalkedThis;
    delete window.breedGroupId;
    localStorage.clear();
    walked = require('./walked-this.js');
  });

  test('a tap writes one anonymous walk and the same day does not count twice', async () => {
    const service = community();
    expect(await walked.record('lago-carezza', 'g1', { community: service, now: noon })).toBe('recorded');
    expect(await walked.record('lago-carezza', 'g1', { community: service, now: noon + 3600000 })).toBe('already');
    expect(service.calls).toEqual([['lago-carezza', 'g1']]);
    expect(walked.walkedToday('lago-carezza', { now: noon })).toBe(true);
    expect(walked.walkedToday('lago-braies', { now: noon })).toBe(false);
  });

  test('the next calendar day counts again', async () => {
    const service = community();
    await walked.record('lago-carezza', 'g1', { community: service, now: noon });
    expect(await walked.record('lago-carezza', 'g1', { community: service, now: noon + 86400000 })).toBe('recorded');
    expect(service.calls).toHaveLength(2);
  });

  test('a refused or missing write leaves the tap free to retry', async () => {
    expect(await walked.record('lago-carezza', 'g1', { community: community(false), now: noon })).toBe('failed');
    expect(await walked.record('lago-carezza', 'g1', { community: null, now: noon })).toBe('unavailable');
    expect(walked.walkedToday('lago-carezza', { now: noon })).toBe(false);
    expect(await walked.record('lago-carezza', 'g1', { community: community(), now: noon })).toBe('recorded');
  });

  test('a write that throws is a failed tap, not a broken page', async () => {
    const throwing = { recordTrailWalk(){ throw new Error('offline'); } };
    expect(await walked.record('lago-carezza', 'g1', { community: throwing, now: noon })).toBe('failed');
  });

  test('marks older than thirty days are dropped', () => {
    walked.markWalked('old-trail', { now: noon - 40 * 86400000 });
    walked.markWalked('lago-carezza', { now: noon });
    expect(Object.keys(JSON.parse(localStorage.getItem(walked.STORAGE_KEY)))).toEqual(['lago-carezza']);
  });

  test('a corrupt store reads as nothing walked', () => {
    localStorage.setItem(walked.STORAGE_KEY, '[not json');
    expect(walked.walkedToday('lago-carezza', { now: noon })).toBe(false);
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
});

describe('SOCIAL-01 trail page wiring', () => {
  const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

  test('the button sits in the trail action row', () => {
    document.body.innerHTML = read('trail.html');
    const button = document.querySelector('.td2-actrow #walkedThisBtn');
    expect(button).not.toBeNull();
    expect(button.getAttribute('type')).toBe('button');
    expect(document.getElementById('walkedThisStatus').getAttribute('aria-live')).toBe('polite');
  });

  test('the bundle loads the tally before hike mode, which tags its walks through it', () => {
    const { SOURCES } = require('./scripts/build-trail-page-bundle.js');
    expect(SOURCES.indexOf('walked-this.js')).toBeGreaterThan(-1);
    expect(SOURCES.indexOf('walked-this.js')).toBeLessThan(SOURCES.indexOf('hike-mode.js'));
    expect(SOURCES.indexOf('walked-this.js')).toBeLessThan(SOURCES.indexOf('trail.js'));
  });

  test('every label exists in English and Italian', () => {
    const i18n = read('i18n.js');
    for(const key of ['page.trail.walkedThis', 'trail.walkedToday', 'trail.walkedRetry', 'trail.walkedThanks']){
      expect(i18n.split(`'${key}':`).length - 1).toBe(2);
    }
  });
});
