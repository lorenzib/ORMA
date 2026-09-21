const fs = require('fs');
const { pageScripts, expectLoadedBefore } = require('./test-support/page-runtime');

// A test that stands in for a page has to load what the page loads. Four
// suites here did not, each because the list was written by hand once and the
// page moved on: comparison-model rendered an empty verification cell and a
// reasons row reading "unknown", homepage-filters lost the card's evidence
// line, recommendation-ui lost the confidence chip, recommendation-decision
// fell back to a table of its own. Every assertion passed.
//
// Nothing in the code was wrong in three of those four. The tests were
// describing a program nobody ships.
const SHARED = ['match-verdict.js', 'recommendation-decision.js', 'trust/evidence-v1.js'];

// Reading a module to assert on its source, or requiring the one under test,
// is not building a runtime. Evaluating one into a context is.
const RUNS_CODE = /(?:runInContext|window\.eval|\beval)\s*\(/;

describe('a test runtime is the page’s, not the test’s', () => {
  const suites = fs.readdirSync('.').filter(file => file.endsWith('.test.js'));

  test('there are suites to check', () => {
    expect(suites.length).toBeGreaterThan(100);
  });

  test('no suite evaluates a shared module from a list of its own', () => {
    const handRolled = [];
    for(const suite of suites){
      const source = fs.readFileSync(suite, 'utf8');
      for(const line of source.split('\n')){
        if(!RUNS_CODE.test(line)) continue;
        for(const module of SHARED){
          // The helper names modules too, but it is handed them, not reading
          // them: a line that both names a module and runs code is the shape
          // this is looking for.
          if(line.includes(`'${module}'`)) handRolled.push(`${suite}: ${line.trim()}`);
        }
      }
    }
    expect(handRolled).toEqual([]);
  });

  // The helper only knows what a page loads. Whether the order is right is a
  // claim about the code, and it belongs here beside the rest.
  test('a vocabulary is loaded before the view that reads it', () => {
    for(const page of ['index.html', 'compare.html']){
      expectLoadedBefore(page, 'match-verdict.js', 'recommendation-decision.js');
    }
  });

  test('and the evidence vocabulary before the scripts that read it', () => {
    expectLoadedBefore('index.html', 'trust/evidence-v1.js', 'script.js');
    expectLoadedBefore('compare.html', 'trust/evidence-v1.js', 'comparison-model.js');
  });

  test('the reader of a page’s scripts sees what is actually there', () => {
    // Guard the guard: a parser that silently returned nothing would make
    // every check above vacuous.
    const scripts = pageScripts('compare.html');
    expect(scripts).toContain('comparison-model.js');
    expect(scripts).toContain('match-verdict.js');
    expect(scripts.every(file => !file.includes('?'))).toBe(true);
    expect(scripts.every(file => !/^https?:/.test(file))).toBe(true);
  });
});
