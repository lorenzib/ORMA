const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('guest dog persistence and the quick wizard chairlift question', () => {
  const controller = read('homepage-search.js');

  test('the quick wizard picks the device dog back up on load', () => {
    expect(controller).toContain("localStorage.getItem('dolopaws-pending-dog-profile')");
    expect(controller).toMatch(/restoreDeviceDog\(\);\s*renderAll\(\);/);
    expect(controller).toContain("state.dog = 'custom';");
  });

  test('a small dog is asked about open chairlifts and the answer is stored on the profile', () => {
    expect(controller).toContain("function asksChairlift(w) { return w.size === 'small'; }");
    expect(controller).toContain("{ label: 'Not for us, or never tried', v: 'never' }");
    expect(controller).toContain("{ label: 'Yes, held on my lap with harness and leash', v: 'ok' }");
    expect(controller).toContain("optBtns(CHAIRLIFT_OPTS, w.chairlift, 'chairlift', true)");
    expect(controller).toContain("behaviour.chairlift = w.chairlift;");
    expect(controller).toContain('behaviour: behaviour,');
  });

  test('a declared small dog sees chairlift-assisted routes on the guest homepage', () => {
    expect(controller).toContain('adapters.chairliftSafe(activeProfile())');
    expect(controller).toContain('filters.matches(t, fstate, options)');
  });

  test('Browse scores for the device dog unless the URL names a dog', () => {
    const browse = read('browse-trails.html');
    expect(browse).toContain("dogValue = urlParams.has('dog') ? (canonical.dog || 'medium') : (deviceDogProfile() ? 'custom' : 'medium');");
    expect(browse).toContain("if(dogValue === 'custom') dogProfile = deviceDogProfile() || dogProfile;");
  });

  test('Compare defaults to the device dog unless the URL names a dog', () => {
    const compare = read('compare-page.js');
    expect(compare).toContain("const dogParam = params.get('dog') || (deviceDogProfile() ? 'custom' : 'medium');");
    expect(compare).toContain("if(dog === 'custom') return deviceDogProfile() || profiles.medium;");
    expect(compare).toContain('dog:dogParam,');
    expect(read('compare.html')).toContain('compare-page.js?v=20260917-1');
  });

  test('the homepage ships the new controller and guest-context versions', () => {
    const html = read('index.html');
    expect(html).toContain('homepage-search.js?v=20260917-2');
    expect(html).toContain('guest-context.js?v=20260917-2');
    expect(read('browse-trails.html')).toContain('guest-context.js?v=20260917-2');
  });
});
