const fs = require('fs');
const path = require('path');
const { validateReadiness, summarise } = require('./scripts/check-beta-readiness.js');

const root = __dirname;
const readiness = JSON.parse(fs.readFileSync(
  path.join(root, 'config', 'beta-readiness.json'),
  'utf8'
));

describe('beta readiness ledger', () => {
  test('is structurally valid and all evidence paths exist', () => {
    expect(validateReadiness(readiness, root)).toEqual([]);
  });

  test('does not claim readiness while physical and human gates remain', () => {
    const summary = summarise(readiness);
    expect(readiness.decision).toBe('not-ready');
    expect(summary.ready).toBe(false);
    expect(summary.blockers.map(gate => gate.id)).toEqual(expect.arrayContaining([
      'OFFLINE-IOS-CURRENT',
      'OFFLINE-ANDROID-CURRENT',
      'ROUTE-FIELD-REVIEW',
      'HIKE-RESTORE-GPS',
      'GPX-AUTHENTICATED-EXPORT',
      'ACCESSIBILITY-VOICEOVER',
      'QA-INTERNAL-USABILITY',
    ]));
  });

  test('rejects accepted exceptions for launch-blocking P0 gates', () => {
    const copy = JSON.parse(JSON.stringify(readiness));
    copy.gates[0].status = 'accepted-exception';
    expect(validateReadiness(copy, root)).toContain(
      'DATA-SCORE-TRUST cannot accept an exception for a P0 gate'
    );
  });

  test('requires a safe fallback for pending work', () => {
    const copy = JSON.parse(JSON.stringify(readiness));
    const gate = copy.gates.find(item => item.status === 'pending');
    delete gate.safeFallback;
    expect(validateReadiness(copy, root)).toContain(
      `${gate.id} needs a safe fallback while pending`
    );
  });

  test('GPX acceptance points to the production export/import record', () => {
    const gate = readiness.gates.find(item => item.id === 'GPX-AUTHENTICATED-EXPORT');
    expect(gate.status).toBe('pending');
    expect(gate.evidence).toBe('docs/testing/OFF-06-gpx-acceptance.md');
    const protocol = fs.readFileSync(path.join(root, gate.evidence), 'utf8');
    expect(protocol).toContain('Guest was gated without a download');
    expect(protocol).toContain('SHA-256');
    expect(protocol).toContain('Ordered closed route rendered near Carezza');
  });

  test('VoiceOver acceptance points to the supported production journey record', () => {
    const gate = readiness.gates.find(item => item.id === 'ACCESSIBILITY-VOICEOVER');
    expect(gate.status).toBe('pending');
    expect(gate.evidence).toBe('docs/testing/A11Y-01-voiceover-acceptance.md');
    const protocol = fs.readFileSync(path.join(root, gate.evidence), 'utf8');
    expect(protocol).toContain('iPhone 13 Pro');
    expect(protocol).toContain('Hike status understandable without speech flooding');
    expect(protocol).toContain('Reduce Motion journey');
  });

  test('current iPhone retest names the package revisions shipped by both manifests', () => {
    const gate = readiness.gates.find(item => item.id === 'OFFLINE-IOS-CURRENT');
    const packageVersions = [
      'offline/packages/lago-carezza/manifest.json',
      'offline/packages/alpe-siusi/manifest.json',
    ].map(file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')).version);

    packageVersions.forEach(version => {
      const betaLabel = version.match(/beta\.\d+$/)?.[0];
      expect(betaLabel).toBeTruthy();
      expect(gate.summary).toContain(betaLabel);
    });

    const deviceRecord = fs.readFileSync(path.join(root, gate.evidence), 'utf8');
    packageVersions.forEach(version => {
      const betaLabel = version.match(/beta\.\d+$/)[0];
      expect(deviceRecord).toContain(betaLabel);
    });
  });

  test('preflight summary lists every pending evidence boundary', () => {
    const preflight = fs.readFileSync(
      path.join(root, 'docs/architecture/QA-05-beta-readiness-preflight.md'),
      'utf8'
    );
    [
      'iPhone airplane-mode',
      'physical Android',
      'route-specific field review',
      'physical restoration',
      'GPX export',
      'VoiceOver acceptance',
      'uncoached internal usability',
    ].forEach(boundary => expect(preflight).toContain(boundary));
  });
});
