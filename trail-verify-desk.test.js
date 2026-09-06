const fs = require('fs');
const path = require('path');

/**
 * The verify desk exists because the older desks explained the pipeline
 * instead of asking a question. These tests lock the three properties that
 * made it usable, so a later change cannot quietly undo them:
 * the human check leads, the machine's workings stay collapsed, and the
 * page speaks in words an operator already knows.
 */
const html = fs.readFileSync(path.join(__dirname, 'trail-verify-desk.html'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, 'trail-verify-desk.js'), 'utf8');

describe('trail verification desk', () => {
  test('asks a plain question for every gate it can present', () => {
    // Each gate must carry a question and the label on its approve button;
    // a gate without them would fall back to naming the pipeline stage.
    ['geometry-approval', 'dossier-approval', 'content', 'publish'].forEach(gate => {
      const block = script.slice(script.indexOf(`${gate.includes('-') ? `'${gate}'` : gate}:{`));
      expect(block).toMatch(/question:'[^']+\?'/);
      expect(block).toMatch(/approve:'[^']+'/);
    });
  });

  test('evidence is disclosed, never dumped', () => {
    // Raw agent output and the route drawing live inside <details>, so a card
    // opens on the checklist rather than on a wall of JSON.
    expect(script).toContain("el('details','vd-evidence')");
    expect(script).toContain("el('summary','','Show the evidence')");
    const evidence = script.slice(script.indexOf('function evidenceBlock'), script.indexOf('function claimLines'));
    expect(evidence).toContain('JSON.stringify');
    expect(evidence).toContain("el('details','vd-raw')");
    // No open-by-default disclosure: the old desk shipped details.open = true.
    expect(script).not.toMatch(/vd-(evidence|raw)'\);[\s\S]{0,80}\.open\s*=\s*true/);
  });

  test('the checklist is rendered before the evidence', () => {
    const card = script.slice(script.indexOf('function card('), script.indexOf('async function decide'));
    expect(card.indexOf('vd-checklist')).toBeGreaterThan(-1);
    expect(card.indexOf('vd-checklist')).toBeLessThan(card.indexOf('decision.evidence()'));
  });

  test('the page carries no pipeline vocabulary', () => {
    // These are the words that made the old desks unreadable. They may still
    // appear in code comments, but never in what an operator reads.
    const visible = html.replace(/<!--[\s\S]*?-->/g, '');
    ['dossier', 'gate', 'fleet', 'orchestration', 'heartbeat', 'receipt', 'candidate', 'provenance', 'red-team']
      .forEach(word => expect(visible.toLowerCase()).not.toContain(word));
  });

  test('states plainly that it cannot change the website', () => {
    expect(html).toMatch(/Nothing here changes the website/i);
    expect(html).toMatch(/Last check before the website changes/i);
  });

  test('stays off the public site and ships to the backoffice', () => {
    const config = fs.readFileSync(path.join(__dirname, '_config.yml'), 'utf8');
    expect(config).toMatch(/^\s*-\s*trail-verify-desk\.html\s*$/m);
    expect(config).toMatch(/^\s*-\s*trail-verify-desk\.js\s*$/m);

    const build = fs.readFileSync(path.join(__dirname, 'scripts/build-backoffice-hosting.js'), 'utf8');
    expect(build).toContain("hostedPage('trail-verify-desk.html')");
    expect(build).toContain("'trail-verify-desk.js'");
  });

  test('submits through the existing review APIs rather than writing its own', () => {
    // The desk changes presentation only. Re-implementing the writes would
    // bypass the moderator checks those APIs perform.
    expect(script).toContain('submitDossierReview');
    expect(script).toContain('submitPublicationReview');
    expect(script).toContain("submitTrailReview({gate:'content-review'");
    expect(script).not.toMatch(/addDoc|collection\(db/);
  });

  test('requires a written reason before sending work back', () => {
    const decide = script.slice(script.indexOf('async function decide'));
    expect(decide).toMatch(/action!=='approve'&&!note\.value\.trim\(\)/);
  });
});
