const fs = require('fs');
const path = require('path');
const phrases = require('./scripts/check-i18n-phrases');
const trailText = require('./scripts/trail-text-it');

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
  // copy; a line in its head sends them on before it draws. Same rule as i18n.js:
  // their saved choice, else the browser language. The Italian copies lack it.
  test.each(documents)('%s sends an Italian reader to the Italian copy before it draws', page => {
    const head = read(page).split('<title>')[0];
    expect(head).toContain("localStorage.getItem('dolopaws-lang')");
    expect(head).toContain("location.replace('/it'+location.pathname+location.search+location.hash)");
    expect(read(`it/${page}`)).not.toContain("location.replace('/it'");
  });

  test('the legal copies say the English version prevails', () => {
    ['privacy.html', 'terms.html'].forEach(page => {
      expect(read(`it/${page}`)).toContain('In caso di differenze tra questa versione e la versione inglese, prevale la versione inglese.');
    });
  });
});
