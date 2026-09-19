const fs=require('fs');
const {verdictFor,evidenceLine,VERDICTS,STRONG_AT,POSSIBLE_AT}=require('./match-verdict.js');
const { generatedDirectoryPattern } = require('./scripts/generated-directories');

// One trail, three answers. "Great match" on browse at 75, "Good" in the
// homepage search at 65, "Possible with cautions" in the homepage list at 60 --
// so a trail scoring 80 said something different depending on the screen.
describe('one vocabulary for one score', () => {
  test.each([
    [92,'Strong option'],
    [85,'Strong option'],
    [80,'Possible with cautions'],
    [60,'Possible with cautions'],
    [59,'Not recommended'],
    [5,'Not recommended'],
  ])('a score of %s reads as "%s" everywhere', (score,label) => {
    expect(verdictFor(score).label).toBe(label);
  });

  test('the cut-offs are the engine’s own', () => {
    const engine=fs.readFileSync('scoring/recommendation-v1.js','utf8');
    expect(engine).toContain(`score >= ${STRONG_AT} ? 'strong-option'`);
    expect(engine).toContain(`score >= ${POSSIBLE_AT} ? 'possible-with-cautions'`);
  });

  test('it says what to do, not how well the trail scored', () => {
    expect(Object.values(VERDICTS).map(entry=>entry.label))
      .toEqual(['Strong option','Possible with cautions','Not recommended']);
  });
});

// The part the score alone cannot carry.
describe('the engine’s verdict outranks the number', () => {
  test('a high score the engine downgraded stays downgraded', () => {
    // recommendation-v1.js: a critical unreviewed category drops a strong
    // option, and a bare score knows nothing about it.
    expect(verdictFor({score:90,category:'possible-with-cautions'}).label)
      .toBe('Possible with cautions');
    expect(verdictFor(90).label).toBe('Strong option');
  });

  test('a prohibited route is not recommended whatever its number', () => {
    expect(verdictFor({score:99,category:'not-recommended'}).label).toBe('Not recommended');
  });

  test('a recommendation with no category falls back to its score', () => {
    expect(verdictFor({score:90}).label).toBe('Strong option');
  });

  test('an unusable input is never called a strong option', () => {
    [null,undefined,{},'','abc',NaN].forEach(input=>
      expect(verdictFor(input).label).toBe('Not recommended'));
  });

  test('the score comes back with the verdict, or null if there was none', () => {
    expect(verdictFor(72).score).toBe(72);
    expect(verdictFor({}).score).toBeNull();
  });
});

describe('both surfaces ask the same question', () => {
  const browse=fs.readFileSync('browse-trails.html','utf8');
  const home=fs.readFileSync('script.js','utf8');
  const page=fs.readFileSync('index.html','utf8');
  const guestSearch=fs.readFileSync('homepage-search.js','utf8');

  test('browse reads the engine’s recommendation, not just the score', () => {
    expect(browse).toContain('window.DoloPawsScoring.recommendTrail(');
    expect(browse).toContain('const verdict = matchVerdict(t);');
    // The old thresholds are gone.
    expect(browse).not.toContain("match >= 75 ? 'Great match'");
  });

  test('the homepage search and list both defer to it', () => {
    expect(home).toContain('window.OrmaMatchVerdict');
    expect(home).not.toContain("score >= 65 ? { color: '#C98A2E', label: 'Good' }");
  });

  test('both pages load it', () => {
    expect(page).toContain('match-verdict.js');
    expect(browse).toContain('match-verdict.js');
  });

  // The guard that used to run here read browse and the logged-in homepage and
  // stopped, which is how the guest homepage kept its own table -- with its own
  // words AND its own cut-offs -- for as long as this file has existed. A trail
  // scoring 80 was "Great match" on the first screen a visitor sees and
  // "Possible with cautions" on every screen after it.
  test('no surface keeps a private vocabulary', () => {
    [browse,home,guestSearch].forEach(source=>{
      expect(source).not.toMatch(/'Great match'/);
      expect(source).not.toMatch(/'Check first'/);
    });
  });

  // Naming the files to check is what let this drift twice: the guard listed
  // the surfaces someone remembered, and a copy of the table in a file nobody
  // added went unnoticed for months. So the guard stopped keeping a list. It
  // reads every shipped source and fails on any file that spells out the three
  // verdicts itself, which is what a private copy of the table looks like.
  test('and nothing else in the tree spells the verdicts out', () => {
    const OWNERS = new Set([
      // The module that owns the words.
      'match-verdict.js',
      // The canonical view, which maps the engine's categories to the same
      // three labels for the trail page and the homepage explanation. It is a
      // second spelling, and the test below holds the two in agreement.
      'recommendation-decision.js',
    ]);
    // Tests name the vocabulary in order to assert on it, and nothing in a
    // test ships. Everything else is a surface.
    // The generated directories come from the shared list, so a new build
    // directory cannot leave this walker reading published copies of the very
    // files it is auditing. backoffice-data and docs are this test's own.
    const skip = new RegExp(
      `^(?:${generatedDirectoryPattern()}|backoffice-data|docs)(?:/|$)`
      + String.raw`|\.bundle\.js$|\.test\.js$|\.md$|^i18n\.js$`);
    const offenders = [];
    const walk = dir => {
      for(const entry of fs.readdirSync(dir, { withFileTypes:true })){
        const full = (dir === '.' ? entry.name : `${dir}/${entry.name}`);
        if(skip.test(full)) continue;
        if(entry.isDirectory()){ walk(full); continue; }
        if(!/\.(?:js|html)$/.test(entry.name)) continue;
        if(OWNERS.has(full)) continue;
        const source = fs.readFileSync(full, 'utf8');
        // A private table is the three labels together in one file. One of
        // them alone is prose, and prose is allowed to quote a verdict.
        const spelled = ['Strong option','Possible with cautions','Not recommended']
          .filter(label => source.includes(label));
        if(spelled.length === 3) offenders.push(full);
      }
    };
    walk('.');
    expect(offenders).toEqual([]);
  });

  test('the canonical view and the module agree, label for label', () => {
    const decision = require('./recommendation-decision.js');
    Object.keys(VERDICTS).forEach(category => {
      expect(decision.present({ category }, {}).conclusion).toBe(VERDICTS[category].label);
    });
  });

  test('the guest homepage defers to it, cut-offs and all', () => {
    expect(guestSearch).toContain('window.OrmaMatchVerdict');
    expect(guestSearch).not.toMatch(/s >= 75/);
    expect(guestSearch).not.toMatch(/s >= 55/);
  });

  test('no surface prints the number beside the verdict', () => {
    // The percentage is the verdict said twice, with a precision the evidence
    // does not have. It survived in both typeaheads after the cards dropped it.
    expect(home).not.toContain('${trail.score}%');
    expect(guestSearch).not.toContain("'<span>%</span>'");
  });
});

// A reader with no dog is scored against a default. Saying "your dog" over
// that score claims a personalisation that did not happen -- on the one line
// the reader is being asked to trust. recommendation-decision.js has had the
// honest word since it was written, and trail.html has always used it.
describe('the score says whose it is', () => {
  const browse=fs.readFileSync('browse-trails.html','utf8');
  const home=fs.readFileSync('script.js','utf8');
  const decision=require('./recommendation-decision.js');

  test('the canonical view names the default rather than the reader', () => {
    const guest=decision.present({category:'strong-option',score:90},{});
    expect(guest.breakdownFor).toBe('a medium dog');
    expect(guest.contextLabel).toBe('Unpersonalized planning view');
    expect(guest.dogName).toBeNull();

    const named=decision.present({category:'strong-option',score:90},{dogName:'Eddie'});
    expect(named.breakdownFor).toBe('Eddie');
    expect(named.contextLabel).toBe('Recommendation for Eddie');
  });

  test('the homepage list uses one subject everywhere it labels a verdict', () => {
    expect(home).toContain("function liScoredSubject(profile)");
    expect(home).toContain("return liT('recommendation.subject.guest', 'a medium dog');");
    // The card, its reasons, the toggle, the section heading and the
    // alternatives heading all ask the same function.
    expect((home.match(/liScoredSubject\(/g)||[]).length).toBeGreaterThanOrEqual(6);
    expect(home).not.toContain("'Chosen for your dog'");
  });

  test('browse names the dog it actually scored', () => {
    expect(browse).toContain('function scoredSubjectLabel()');
    expect(browse).toContain('${esc(scoredSubjectLabel())}');
    // The claim that was there before, made of whatever was in the scorer.
    expect(browse).not.toContain('<small>FOR YOUR DOG</small>');
  });
});

// Six signals on the homepage card and five on browse, for one question. The
// percentage was the verdict said twice -- and the second time with a precision
// the evidence does not have -- while "High confidence" beside "ORMA
// route-audited" was the same statement in two vocabularies.
describe('how well a verdict is known, in one line', () => {
  test('an audited route with high confidence says it once', () => {
    expect(evidenceLine({provenance:'ORMA route-audited',confidence:'High confidence',
      checkedLabel:'Checked 3 Sep 2026'})).toBe('ORMA route-audited · Checked 3 Sep 2026');
  });

  test('a caveat earns its place and is kept', () => {
    expect(evidenceLine({provenance:'Imported map data',confidence:'Limited data'}))
      .toBe('Imported map data · Limited data');
    expect(evidenceLine({provenance:'ORMA route-audited',confidence:'Moderate confidence'}))
      .toBe('ORMA route-audited · Moderate confidence');
  });

  test('missing parts leave no stray separators', () => {
    expect(evidenceLine({provenance:'Mapped route'})).toBe('Mapped route');
    expect(evidenceLine({confidence:'Limited data'})).toBe('Limited data');
    expect(evidenceLine({})).toBe('');
    expect(evidenceLine(null)).toBe('');
  });
});

describe('the number is gone from browse', () => {
  const browse=require('fs').readFileSync('browse-trails.html','utf8');
  const home=require('fs').readFileSync('script.js','utf8');

  test('the card leads with the verdict, not a percentage', () => {
    expect(browse).toContain('<strong>${tier}</strong>');
    expect(browse).not.toContain('<strong>${match}<span>%</span></strong>');
    expect(browse).not.toContain('MATCH FOR YOUR DOG');
  });

  test('the styling that sized two digits went with it', () => {
    expect(browse).not.toContain('.simple-card__tier{');
    expect(browse).not.toContain(".simple-card__match strong span{font-size:11px;}");
  });

  test('nothing is left computing a score the card no longer shows', () => {
    expect(browse).not.toContain('const match = matchScore(t);');
    // matchScore still sorts and filters, so it stays.
    expect(browse).toContain('function matchScore(trail)');
  });

  test('confidence left the homepage verdict column for the evidence line', () => {
    expect(home).not.toContain('li-match-confidence');
    expect(home).toContain('verdict.evidenceLine({ confidence: presentation.confidence })');
  });
});
