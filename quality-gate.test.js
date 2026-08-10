const fs = require('fs');
const path = require('path');
const gate = require('./scripts/run-quality-gate.js');
const generated = require('./scripts/check-generated-artifacts.js');

describe('QA-01 complete quality gate', () => {
  test('covers data, tests, security, static assets, and generated drift', () => {
    const commands = gate.steps.flatMap(([, args]) => args).join(' ');
    expect(commands).toContain('validate:alpine-plants');
    expect(commands).toContain('validate:trail-schema');
    expect(commands).toContain('validate:production-trails:check');
    expect(commands).toContain('audit:trail-trust');
    expect(commands).toContain('--runInBand');
    expect(commands).toContain('test:firestore-rules');
    expect(commands).toContain('test:static');
    expect(commands).toContain('check:generated');
  });

  test('checks every committed generated surface', () => {
    expect(generated.generatedTargets).toEqual(expect.arrayContaining([
      'browse-trails.html',
      'sitemap.xml',
      'trails',
      'data/regions',
      'data/regions-manifest.json',
      'regions-runtime-manifest.js',
      'data/generated/trail-validation-report.json',
    ]));
  });

  test('CI invokes the same single local command', () => {
    const workflow = fs.readFileSync(path.join(__dirname, '.github/workflows/validate.yml'), 'utf8');
    expect(workflow).toContain('run: npm run quality:gate');
    expect(workflow).not.toContain('FIREBASE_SERVICE_ACCOUNT');
  });

  test('the gate checks the emulator runtime before doing lengthy work', () => {
    const source = fs.readFileSync(path.join(__dirname, 'scripts/run-quality-gate.js'), 'utf8');
    expect(source.indexOf('requireJava();')).toBeLessThan(source.indexOf('for(const [label, args] of steps)'));
    expect(source).toContain('Java 21 is required');
  });

  test('volatile regional generation time does not create false drift', () => {
    const a = Buffer.from('{"generatedAt":"2026-01-01T00:00:00.000Z","regions":{}}');
    const b = Buffer.from('{"generatedAt":"2026-02-02T00:00:00.000Z","regions":{}}');
    expect(generated.normalized('data/regions-manifest.json', a))
      .toBe(generated.normalized('data/regions-manifest.json', b));
  });
});
