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


/**
 * groupBlockers and the label it leans on, lifted out of the desk and run for
 * real: these tests are about what the operator ends up reading, so evaluating
 * the actual source beats restating it.
 */
function loadGrouping(){
  const grouping = script.slice(script.indexOf('const BLOCKER_GROUPS'), script.indexOf('const MIN_NOTE'));
  const label = script.slice(script.indexOf('function blockerLabel'), script.indexOf('function renderCoverage'));
  return new Function(`${grouping}\n${label}\nreturn groupBlockers;`)();
}

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

  test('answers how many trails are verified and how many remain', () => {
    // The desk previously showed only the queue, which is usually empty, so it
    // never said where the catalogue actually stood.
    expect(html).toContain('id="verifyHeadline"');
    expect(script).toMatch(/trails verified · \$\{remaining\} to go/);
    expect(script).toMatch(/written by hand/);
    expect(script).toMatch(/imported from OpenStreetMap/);
  });

  test('trusts the registry when the catalogue flag lags behind it', () => {
    const coverage = script.slice(script.indexOf('function renderCoverage'));
    expect(coverage).toMatch(/registryCount=\(registry\.verified\|\|\[\]\)\.length/);
    expect(coverage).toMatch(/Math\.max\(flagged,registryCount\)/);
  });

  test('ranks the shared blockers instead of listing trails one by one', () => {
    const coverage = script.slice(script.indexOf('function renderCoverage'));
    expect(coverage).toMatch(/sort\(\(a,b\)=>b\[1\]-a\[1\]\)/);
    // Verified trails must not contribute to the blocker tally.
    expect(coverage).toMatch(/modernGraduationVerified===true\)return/);
  });

  test('turns machine blocker ids into words', () => {
    const label = new Function(`${script.slice(script.indexOf('function blockerLabel'), script.indexOf('function renderCoverage'))}; return blockerLabel;`)();
    expect(label('shadeCoverage-unknown')).toBe('Shade coverage unknown');
    expect(label('review-date-missing')).toBe('Review date missing');
    expect(label('claim-sources-missing')).toBe('Claim sources missing');
  });

  test('spells out what verified means, including what does not count', () => {
    // "Is it zero because we added shading to the match score?" is the question
    // this panel exists to answer, so the answer is on the page.
    expect(html).toContain('What &quot;verified&quot; means'.replace('&quot;', '"').replace('&quot;', '"'));
    expect(script).toMatch(/routeNumbers','Route numbers'/);
    expect(html).toMatch(/Shade cover, heat risk and exposure <em>values<\/em>/);
    expect(html).toMatch(/not verification checks/);
  });

  test('explains why the count is low instead of only showing it', () => {
    const coverage = script.slice(script.indexOf('function renderCoverage'));
    expect(coverage).toMatch(/completed all eleven checks/);
    expect(coverage).toMatch(/waiting earlier in the process/);
    // Trails that cannot start must not be counted as progress.
    expect(coverage).not.toMatch(/have entered verification/);
  });

  test('states it when the registry and the catalogue disagree', () => {
    const coverage = script.slice(script.indexOf('function renderCoverage'));
    expect(coverage).toMatch(/registryCount!==flagged/);
    expect(coverage).toMatch(/They disagree/);
  });

  test('never reports an unreadable catalogue as a count of zero', () => {
    // A daily Firestore quota is a recurring cause here, and a silent zero
    // reads exactly like genuine bad news.
    const coverage = script.slice(script.indexOf('function renderCoverage'));
    expect(coverage).toMatch(/not a count of zero/);
    expect(script).toMatch(/quota/i);
  });

  test('states one problem once, however many claims reported it', () => {
    // Three logistics claims fail with the same sentence; that is one problem.
    const { groups, loose } = loadGrouping()([
      'logistics/recommended-start: supported authoritative route guidance is required',
      'logistics/route-number-status: supported authoritative route guidance is required',
      'logistics/route-number-sequence: supported authoritative route guidance is required',
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].group.title).toBe('No start point or directions');
    expect(groups[0].raw).toHaveLength(3); // kept, for hovering
    expect(loose).toEqual([]);
  });

  test('every grouped blocker says what would clear it', () => {
    const groups = new Function(`${script.slice(script.indexOf('const BLOCKER_GROUPS'), script.indexOf('const MIN_NOTE'))}; return BLOCKER_GROUPS;`)();
    groups.forEach(group => {
      expect(group.title).toBeTruthy();
      expect(group.remedy).toBeTruthy();
      // No machine vocabulary in what the operator reads.
      expect(`${group.title} ${group.detail} ${group.remedy}`).not.toMatch(/logistics\/|claim|dossier/i);
    });
  });

  test('an unrecognised blocker is still shown, not swallowed', () => {
    const { groups, loose } = loadGrouping()(['something/new: a reason nobody has grouped yet']);
    expect(groups).toEqual([]);
    // The heading is the check that filed it; the claim stays in the text.
    expect(loose).toEqual([{ heading:'Something', texts:['something/new: a reason nobody has grouped yet'] }]);
  });

  test('one heading per agent, however many reasons it filed', () => {
    // Three reasons from logistics used to render as three full-width blocks
    // all headed "Logistics", which reads as three problems.
    const { loose } = loadGrouping()([
      'logistics/parking: conflicted',
      'logistics/access: unresolved',
      'terrainPoi/surface: conflicted',
    ]);
    expect(loose.map(entry => entry.heading))
      .toEqual(['Getting there and getting around', 'Terrain and what is on the route']);
    expect(loose[0].texts).toHaveLength(2);
  });

  test('the line under a heading does not repeat the heading', () => {
    // "Terrain poi" followed by "terrainPoi/surface: conflicted" says the same
    // word twice and the machine's spelling of it once.
    const grouping = script.slice(script.indexOf('const BLOCKER_GROUPS'), script.indexOf('const MIN_NOTE'));
    const label = script.slice(script.indexOf('function blockerLabel'), script.indexOf('function renderCoverage'));
    const looseText = new Function(`${grouping}\n${label}\nreturn looseText;`)();
    expect(looseText('terrainPoi/surface: conflicted')).toBe('Surface — conflicted');
    expect(looseText('logistics: five automated resolution strategies exhausted'))
      .toBe('five automated resolution strategies exhausted');
  });

  test('the agent thinking aloud is not a blocker', () => {
    // advance-trail-orchestration pushes the agent's recommendation and every
    // open question into the same flat list as the claim that actually failed.
    // Only the last of those is a problem a person can act on.
    const { groups, loose, working } = loadGrouping()([
      'logistics/recommended-start: supported authoritative route guidance is required',
      'logistics: recommendation is needs-resolution',
      'logistics: open question — What is the exact legal vehicle entrance?',
      'logistics: open question — Should the trailhead be a parking coordinate?',
    ]);
    expect(groups).toHaveLength(1);
    expect(loose).toEqual([]);
    expect(working).toHaveLength(3);
  });

  test('the working folds away only when something else names the problem', () => {
    const card = script.slice(script.indexOf('function card('), script.indexOf('async function decide'));
    // Kept, never dropped: a card whose only content is the agent's questions
    // would otherwise say nothing at all about why it is blocked.
    expect(card).toContain("const named=groups.length||loose.length;");
    expect(card).toMatch(/named\?el\('details','vd-blocker-working'\):el\('div','vd-blocker'\)/);
    expect(card).toMatch(/The check did not finish/);
  });

  test('a blocked card drops the approval checklist and facts', () => {
    // They exist to help say yes. On a trail that cannot be approved they are
    // noise sitting above the reason it cannot.
    const card = script.slice(script.indexOf('function card('), script.indexOf('async function decide'));
    expect(card).toMatch(/if\(decision\.ready\)article\.append\(el\('p','vd-question'/);
    expect(card).toMatch(/const checks=decision\.ready\?decision\.gate\.checklist\.slice\(\):\[\]/);
    expect(card).toMatch(/if\(decision\.ready&&decision\.facts\.length\)/);
    // And the reason comes before the evidence disclosure.
    expect(card.indexOf('vd-blockers')).toBeLessThan(card.indexOf('decision.evidence()'));
  });

  // ---- what the machine is doing ----

  test('reads the pipeline summary instead of listing jobs from the browser', () => {
    // Listing backofficeJobs on a desk that polls once a minute is hundreds of
    // document reads a minute against a 50K free-tier daily quota. The worker
    // writes one summary; the desk reads one document.
    expect(script).toContain("artifact('pipeline-health'");
    expect(script).not.toContain('getRevisionJobs');
  });

  test('never reports stopped work as one undifferentiated number', () => {
    // "88 blocked" reads as a broken pipeline when 68 of them are an unpaid
    // bill that resumes by itself. The split is the finding.
    const stuck = script.slice(script.indexOf('function renderStuck'));
    expect(stuck).toContain('stopped.needsDecision');
    expect(stuck).toContain('stopped.resumesItself');
    expect(stuck).toMatch(/need a decision from you/);
    expect(stuck).toMatch(/start again on their own/);
  });

  test('offers no way to stop a lane that carries verification', () => {
    // Retiring one of those drops a trail out of verification with nobody
    // deciding to. The CLI refuses it too; the desk must not even ask.
    const stuck = script.slice(script.indexOf('function renderStuck'));
    const guard = stuck.indexOf('lane.carriesVerification');
    const stop = stuck.indexOf('retire-blocked-jobs');
    expect(guard).toBeGreaterThan(-1);
    expect(stop).toBeGreaterThan(guard);
  });

  test('hands over the stop command rather than pretending to run it', () => {
    // Firestore refuses every browser write to backofficeJobs, on purpose. A
    // button claiming to stop a lane would be a lie, so the desk copies the line.
    expect(script).toContain('function commandBox');
    expect(script).toContain('navigator.clipboard.writeText');
    const scripts = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).scripts;
    const command = script.match(/npm run (backoffice:[a-z-]+)[^`]*--job-type/);
    expect(command).not.toBeNull();
    // The desk must not hand out a command that does not exist.
    expect(scripts[command[1]]).toBeTruthy();
  });

  test('says whether the automation is actually running', () => {
    // A stopped pipeline and a healthy idle one look identical in a job count.
    expect(script).toContain("artifact('worker-health'");
    const state = script.slice(script.indexOf('function renderMachineState'), script.indexOf('function renderMachine('));
    expect(state).toMatch(/behind or switched off/);
    expect(state).toContain('delayAfterMinutes');
  });

  test('the human queue is above the coverage explanation', () => {
    // The desk exists to be worked, not read. Counts and definitions come after
    // the trails waiting on a decision.
    expect(html.indexOf('verifyQueueTitle')).toBeLessThan(html.indexOf('verifyCoverageTitle'));
  });

  test('the coverage explanation is collapsed, and its summary still names it', () => {
    // It was made visible because "0 of 165 verified" was unexplainable. It
    // stays reachable and self-describing, but it is not the top of the page.
    expect(html).toMatch(/<details class="vd-explain">\s*<summary>What "verified" means, and why the number is low<\/summary>/);
  });
});
