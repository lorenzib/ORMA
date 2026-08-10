const fs = require('fs');
const path = require('path');
const elevation = require('./offline-elevation.js');

const root = __dirname;
const profile = trailId => JSON.parse(fs.readFileSync(
  path.join(root, 'offline', 'packages', trailId, 'elevation-profile.json'),
  'utf8'
));

describe('offline elevation profiles', () => {
  test.each(['lago-carezza', 'alpe-siusi'])('%s has a valid bounded profile', trailId => {
    const data = profile(trailId);
    expect(elevation.validProfile(data, trailId)).toBe(true);
    expect(elevation.elevationAtKm(data, -1)).toBe(data.points[0].elev);
    expect(elevation.elevationAtKm(data, data.distanceKm + 1))
      .toBe(data.points[data.points.length - 1].elev);
  });

  test('interpolates route elevation between stored samples', () => {
    expect(elevation.elevationAtKm(profile('lago-carezza'), 0.325)).toBeCloseTo(1537);
    expect(elevation.elevationAtKm(profile('alpe-siusi'), 3)).toBeCloseTo(1850);
  });

  test('builds a finite SVG profile and clamps the live cursor', () => {
    const data = profile('alpe-siusi');
    const chart = elevation.chartGeometry(data, 600, 150);
    expect(chart.line).toMatch(/^M 12\.0 /);
    expect(chart.area).toContain('Z');
    expect(chart.xForKm(-1)).toBe(12);
    expect(chart.xForKm(99)).toBe(588);
    expect(chart.high).toBe(1950);
  });

  test('offline shell loads elevation logic before the application', () => {
    const shell = fs.readFileSync(path.join(root, 'offline', 'trail.html'), 'utf8');
    expect(shell).toContain('id="offlineElevation"');
    expect(shell.indexOf('offline-elevation.js')).toBeLessThan(shell.indexOf('offline-app.js'));
  });
});
