const fs = require('fs');

describe('mobile map trail-card selection', () => {
  const homepage = fs.readFileSync('index.html', 'utf8');
  const script = fs.readFileSync('script.js', 'utf8');
  const mobile = fs.readFileSync('homepage-mobile.css', 'utf8');

  test('completes route selection before showing the matching card', () => {
    expect(script).toContain('function liRouteDistanceMeters(first, second)');
    expect(script).toContain('liRouteDistanceMeters(route[0], route[route.length - 1]) <= 75');
    expect(script).not.toContain('visible && distMeters(route[0], route[route.length - 1]) <= 75');
    expect(script).toContain("if(typeof showMapCallout === 'function') showMapCallout(t)");
  });

  test('ports the selected card above the mobile trail sheet', () => {
    expect(homepage).toContain('id="mapCallout" class="map-callout" aria-live="polite"');
    expect(script).toContain("window.addEventListener('dolopaws-mobile-layout-change', placeMapCallout)");
    expect(script).toContain('const target = mobileTarget ? document.body : mapWrap');
    expect(mobile).toContain('body.mhome-active > .map-callout{position:fixed;');
    expect(mobile).toContain('z-index:60;max-height:min(42dvh,330px);');
  });
});
