const fs = require('fs');
const path = require('path');
const phrases = require('./scripts/check-i18n-phrases');
const trailText = require('./scripts/trail-text-it');
const { ITALIAN_COPY_BANNER } = require('./scripts/italian-copy-banner');

// Italian reaches what scripts write, every trail's own words, and the guides
// and legal pages. English stays the source; these keep the Italian complete.

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');

describe('wording scripts write on the page', () => {
  test('every wrapped sentence has its Italian, with the same placeholders', () => {
    expect(phrases.check().errors).toEqual([]);
  });

  test('i18n.js fetches the Italian table only for Italian readers', () => {
    expect(read('i18n.js')).toMatch(/if \(lang === 'it' && !window\.ORMA_PHRASES_IT && document\.readyState === 'loading'\)/);
  });

});

describe("each trail's own words", () => {
  const trails = trailText.loadTrails();

  test('a trail page fetches its Italian file for Italian readers', () => {
    expect(read('regional-trails-loader.js')).toMatch(/data\/trail-text-it\//);
  });

  // A new or reworded walk arrives with its Italian. To fill the gap:
  //   node scripts/trail-text-it.js --missing missing.json
  //   (translate each sentence into a {"English": "Italiano"} file)
  //   node scripts/trail-text-it.js --apply translated.json
  // then regenerate the trail pages (node scripts/generate-trail-pages.js).
  test('every sentence a trail says has its Italian', () => {
    const missing = [];
    trails.forEach(trail => {
      const table = trailText.readTable(trail.id);
      trailText.sentencesOf(trail).forEach(sentence => {
        if(!Object.prototype.hasOwnProperty.call(table, sentence) || !String(table[sentence]).trim()) {
          missing.push(`${trail.id}: ${sentence.slice(0, 60)}`);
        }
      });
    });
    expect(missing).toEqual([]);
  });

  test('every Italian entry is a sentence its trail still says', () => {
    const stale = [];
    trails.forEach(trail => {
      const said = new Set(trailText.sentencesOf(trail));
      Object.keys(trailText.readTable(trail.id)).forEach(sentence => {
        if(!said.has(sentence)) stale.push(`${trail.id}: ${sentence.slice(0, 60)}`);
      });
    });
    expect(stale).toEqual([]);
  });

  test("the route audit's sentence is translated when it is the walk's directions, and only then", () => {
    const sentence = 'Start at the church in the village and follow the signed loop past the farms and back to the church.';
    const shown = { id: 'x', routeAudit: { routeNumbers: sentence } };
    expect(trailText.sentencesOf(shown)).toContain(sentence);
    // With structured guidance the page shows that instead, so the sentence is evidence only.
    const guided = { ...shown, routeNumberGuidance: { start: 'a', sequence: 'b', switches: 'c' } };
    expect(trailText.sentencesOf(guided)).not.toContain(sentence);
    // The app wraps it for translation too.
    expect(read('trail-blueprint.js')).toContain('esc(trailWords(auditDirections.text');
  });

  test('no file is left for a trail that is no longer in the catalogue', () => {
    const live = new Set(trails.map(trail => trail.id));
    const orphans = fs.readdirSync(path.join(__dirname, 'data', 'trail-text-it'))
      .map(file => file.replace(/\.js$/, '')).filter(id => !live.has(id));
    expect(orphans).toEqual([]);
  });
});

describe('guides and legal pages', () => {
  const documents = ['safety-guide.html', 'privacy.html', 'terms.html',
    ...fs.readdirSync(path.join(__dirname, 'guides')).filter(file => file.endsWith('.html')).map(file => `guides/${file}`)];

  test.each(documents)('%s has an Italian copy linked both ways', page => {
    const italian = read(`it/${page}`);
    expect(italian).toMatch(/<html lang="it" data-orma-lang="it"/);
    for(const html of [read(page), italian]){
      expect(html).toContain(`<link rel="alternate" hreflang="it" href="https://www.app-orma.com/it/${page}">`);
      expect(html).toContain(`<link rel="alternate" hreflang="en" href="https://www.app-orma.com/${page}">`);
    }
  });

  // A search result or shared link can bring an Italian reader to the English
  // copy; a line in its head offers the Italian copy under the top bar. A link,
  // never a redirect, so the English page stays the page search engines index.
  test.each(documents)('%s offers an Italian reader its Italian copy', page => {
    const english = read(page);
    expect(english.split('<title>')[0]).toContain(ITALIAN_COPY_BANNER);
    expect(english).not.toMatch(/http-equiv="refresh"|location\.replace\s*\(/i);
    expect(read(`it/${page}`)).not.toContain(ITALIAN_COPY_BANNER);
  });

  test('trail pages do the same, and the phone app, which carries no Italian copies, drops the line', () => {
    const english = fs.readdirSync(path.join(__dirname, 'trails')).filter(file => file.endsWith('.html') && file !== 'index.html')
      .filter(file => !/http-equiv="refresh"/.test(read(`trails/${file}`)));
    const without = english.filter(file => !read(`trails/${file}`).split('<title>')[0].includes(ITALIAN_COPY_BANNER));
    expect(english.length).toBeGreaterThan(400);
    expect(without).toEqual([]);
    expect(read(`it/trails/${english[0]}`)).not.toContain(ITALIAN_COPY_BANNER);
    expect(read('scripts/build-app.js')).toContain("after.split(`${ITALIAN_COPY_BANNER}\\n`).join('')");
  });

  test('the legal copies say the English version prevails', () => {
    ['privacy.html', 'terms.html'].forEach(page => {
      expect(read(`it/${page}`)).toContain('In caso di differenze tra questa versione e la versione inglese, prevale la versione inglese.');
    });
  });
});
