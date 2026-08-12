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
});
