const fs = require('fs');
const path = require('path');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('UX-05 guest context integration', () => {
  test.each(['index.html', 'browse-trails.html', 'trail.html'])(
    '%s loads guest context before authentication UI',
    page => {
      if(page === 'trail.html'){
        const { expectBundledBefore, expectTrailBundleLoaded } = require('./test-support/trail-runtime.js');
        expectTrailBundleLoaded();
        expectBundledBefore('guest-context.js', 'auth-ui.js');
        return;
      }
      const html = read(page);
      expect(html.indexOf('guest-context.js')).toBeGreaterThan(-1);
      expect(html.indexOf('guest-context.js')).toBeLessThan(html.indexOf('auth-ui.js'));
    }
  );

  test('homepage intercepts legacy migration before the older automatic handler', () => {
    const html = read('index.html');
    expect(html.indexOf('guest-context.js')).toBeLessThan(html.indexOf('script.js'));
    const controller = read('guest-context.js');
    expect(controller).toContain("win.addEventListener('dolopaws-auth-changed', authChanged)");
    expect(controller).toContain('adoptLegacyDogDraft(storage)');
    expect(controller).toContain('storage.removeItem(LEGACY_PROFILE_KEY)');
  });

  test('trail actions capture, validate, and consume versioned context', () => {
    const source = read('trail.js');
    expect(source).toContain('let pendingTrailAction');
    expect(source).toContain('window.DoloPawsGuestContext.captureCurrent(action, trailId)');
    expect(source).toContain('window.DoloPawsGuestContext.consumeAction(');
    expect(source).toContain('if(!context)');
    expect(source).toContain('get pending(){ return pendingTrailAction; }');
  });

  test('save and download share the resumable trail-action controller', () => {
    expect(read('trail.js')).toContain("window.DoloPawsTrailAction.request('save')");
    expect(read('trail.js')).toContain("window.DoloPawsTrailAction.consume('save')");
    expect(read('offline-packages.js')).toContain("window.DoloPawsTrailAction.request('download')");
    expect(read('offline-packages.js')).toContain("window.DoloPawsTrailAction.consume('download')");
  });
});
