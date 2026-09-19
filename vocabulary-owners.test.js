const fs = require('fs');
const { generatedDirectoryPattern } = require('./scripts/generated-directories');

// Every bug in this run was a second copy of something: a second verdict
// table, a second set of thresholds, a second subject label, a second name for
// one page. Three of them had a guard that should have caught them and did
// not, because the guard listed the files somebody remembered.
//
// So this one lists the words instead. Each vocabulary names its owner, and
// any other shipped file that spells the words out is a copy — whatever it is
// called and wherever it was added.
const VOCABULARIES = [
  {
    what: 'how complete a trail’s evidence is',
    owner: 'match-verdict.js',
    words: ['Based on detailed trail data', 'Based on available trail data', 'Based on partial data'],
    // The wording this replaced. It read as a verdict on the walk rather than
    // on the data, and it was never in a dictionary, so it stayed English.
    retired: ['High confidence', 'Moderate confidence', 'Limited data'],
  },
  {
    what: 'where a trail’s evidence came from',
    owner: 'trust/evidence-v1.js',
    words: ['ORMA route-audited', 'ORMA field-verified', 'Mapped route', 'Imported map data'],
    retired: [],
  },
];

// trail-trust.js is not a copy of the tier vocabulary, it is a shorter one
// for badges -- "Verified by ORMA" or "Imported trail" -- and it derives its
// tier from trust/evidence-v1.js rather than deciding one. A badge on a card
// says less than a provenance line, deliberately. What went wrong was Compare
// borrowing the badge words for its verification row, where the reader has
// opened a table precisely to see the difference the badge leaves out.


// i18n.js is every vocabulary's translations, by design. Tests name words in
// order to assert on them, and nothing in a test ships.
//
// The build directories come from one shared list rather than a copy here:
// the guard in #480 kept its own, missed _site, and failed for anyone who had
// built the site -- it found the published copy of a module and reported the
// file as a second place the words were spelled out. A guard against copies,
// undone by a copy.
const SKIP = new RegExp(
  `^(?:${generatedDirectoryPattern()}|backoffice-data|backoffice|docs|prototypes|scripts)(?:/|$)`
  + '|\\.bundle\\.js$|\\.test\\.js$|\\.md$|\\.json$|^i18n\\.js$'
);

function shippedSources(){
  const found = [];
  const walk = dir => {
    for(const entry of fs.readdirSync(dir, { withFileTypes:true })){
      const full = dir === '.' ? entry.name : `${dir}/${entry.name}`;
      if(SKIP.test(full)) continue;
      if(entry.isDirectory()){ walk(full); continue; }
      if(/\.(?:js|html)$/.test(entry.name)) found.push(full);
    }
  };
  walk('.');
  return found;
}

describe('one owner per vocabulary', () => {
  const sources = shippedSources();

  test('there are sources to check at all', () => {
    expect(sources.length).toBeGreaterThan(150);
  });

  VOCABULARIES.forEach(({ what, owner, words, retired }) => {
    test(`only ${owner} spells out ${what}`, () => {
      const copies = sources.filter(file => {
        if(file === owner) return false;
        const source = fs.readFileSync(file, 'utf8');
        // One of the words is prose quoting a label. All of them together is
        // a table.
        return words.filter(word => source.includes(word)).length === words.length;
      });
      expect(copies).toEqual([]);
    });

    (retired.length ? test : test.skip)(`and the words it replaced are gone (${what})`, () => {
      const survivors = [];
      for(const file of sources){
        const source = fs.readFileSync(file, 'utf8');
        for(const word of retired){
          // A comment may explain what was retired; a string literal is the
          // thing itself.
          if(new RegExp(`['"\`]${word}['"\`]`).test(source)) survivors.push(`${file}: ${word}`);
        }
      }
      expect(survivors).toEqual([]);
    });
  });

  // The trail rating is the one vocabulary that cannot move into a module:
  // script.js and trail.js are page scripts with no loader between them. They
  // are identical instead, and go through the dictionary, which is what keeps
  // them saying the same thing in every language.
  test('the fuller tier is what a comparison shows, not the badge’s shorthand', () => {
    require('./trust/evidence-v1.js');
    const model = require('./comparison-model.js');
    // A tier reaches the model through the trail's own verification record,
    // and a trail without a usable route is "imported" whatever it claims.
    const cell = tier => model.build({
      id:'t', name:'T', hours:'1', path:[[46.5, 11.7], [46.51, 11.71]],
      verification:{ tier },
    }, { normalizeTrail:value => value }).cells.verification.text;
    // Route-audited and field-verified are different claims: one ORMA read
    // from sources, one ORMA walked. The table used to call both "Verified by
    // ORMA", which is the badge's shorthand -- and a reader opens a comparison
    // precisely to see what the badge leaves out.
    expect(cell('route-audited')).toBe('ORMA route-audited');
    expect(cell('field-verified')).toBe('ORMA field-verified');
    expect(cell('imported')).toBe('Imported map data');
  });

  test('the trail rating is read from the dictionary, never spelled out', () => {
    const reader = /function safetyLabel\(level\)\{\s*if\(level === 'low-risk'\) return t\('safety\.low'\);\s*if\(level === 'moderate'\) return t\('safety\.moderate'\);\s*return t\('safety\.caution'\);\s*\}/;
    for(const page of ['script.js', 'trail.js']){
      expect(fs.readFileSync(page, 'utf8')).toMatch(reader);
    }
    // hike-mode.js held its own English table, so the one badge a walker sees
    // at the end of a hike stayed English on the Italian site.
    const hike = fs.readFileSync('hike-mode.js', 'utf8');
    expect(hike).toContain('trailSafetyLabel(trail)');
    expect(hike).not.toMatch(/'low-risk':\s*'Low-risk'/);
  });
});
