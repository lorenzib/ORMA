const fs = require('fs');
const path = require('path');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'trail.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'trail.js'), 'utf8');

describe('bounded loop route composer', () => {
  beforeEach(() => {
    document.body.innerHTML = html;
  });

  test('provides a map-first Close loop flow with accessible alternatives to map taps', () => {
    const open = document.getElementById('mapLoopComposerBtn');
    const panel = document.getElementById('mapLoopComposerPanel');
    const close = document.getElementById('mapLoopCloseBtn');
    const addCentre = document.getElementById('mapLoopAddCentreBtn');
    const points = document.getElementById('mapLoopPointList');

    expect(open).not.toBeNull();
    expect(open.getAttribute('aria-controls')).toBe('mapLoopComposerPanel');
    expect(panel.getAttribute('aria-labelledby')).toBe('mapLoopComposerTitle');
    expect(close.textContent).toBe('Close loop');
    expect(close.disabled).toBe(true);
    expect(addCentre.textContent).toBe('Add map centre');
    expect(points.getAttribute('aria-label')).toBe('Selected route points');
    expect(document.getElementById('mapLoopStatus').getAttribute('aria-live')).toBe('polite');
  });

  test('uses only the published graph router and preserves selected points on failure', () => {
    expect(source).toContain("router.routeThroughPoints(points, graph, options)");
    expect(source).toContain("router.routeLoop(points, graph, options)");
    expect(source).toContain('maxLegDistanceM:MAX_LEG_DISTANCE_M');
    expect(source).toContain('maxTotalDistanceM:MAX_TOTAL_DISTANCE_M');
    expect(source).toContain("'These points cannot form a bounded mapped route. Remove a point and choose a closer path.'");
    expect(source).toContain("'ORMA’s walking graph is unavailable here right now. Your points have been kept.'");
    expect(source).not.toContain('loop-external-route');
    expect(source).not.toContain('loop-straight-line');
  });

  test('requires a closed valid preview before Save loop can be used', () => {
    const close = document.getElementById('mapLoopCloseBtn');
    const save = document.getElementById('mapLoopSaveBtn');

    expect(close.disabled).toBe(true);
    expect(save.hidden).toBe(true);
    expect(save.disabled).toBe(true);
    expect(source).toContain('closeButton.disabled = busy || points.length < MAX_POINTS || !preview');
    expect(source).toContain('saveButton.disabled = busy || !closed || !preview');
    expect(source).toContain("const STORAGE_KEY = 'orma-custom-loops-v1'");
    expect(source).toContain("status.textContent = 'Loop saved on this device. Review local signs and conditions before walking.'");
  });

  test('keeps unsupported ascent and dog-specific claims out of the computed result', () => {
    expect(document.getElementById('mapLoopAscent').textContent).toBe('Unavailable');
    expect(html).not.toContain('id="mapLoopDogSafe"');
    expect(source).not.toContain('loop is safe for your dog');
    expect(source).toContain('Review mapped access, signs, and current conditions before saving.');
  });
});
