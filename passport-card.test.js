const fs = require('fs');
const path = require('path');
const passport = require('./dog-passport.js');
const card = require('./passport-card.js');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

const TRAILS = Array.from({ length: 12 }, (_, i) => ({
  id: 't' + i,
  name: 'Trail number ' + i,
  valley: i < 6 ? 'Val Gardena' : ['Val di Fassa', 'Alta Badia', 'Val di Funes', 'Primiero', 'Cembra', 'Fiemme'][i - 6],
  elevation: 100,
  rifugi: [],
  path: [[46.5, 11.7 + i / 100], [46.51, 11.71 + i / 100], [46.5, 11.72 + i / 100]],
}));
const walk = (trailId, date) => ({ id: trailId + date, trailId, trail: trailId, date, dist: '5', proof: 'gps' });
const t = (key, vars) => key + (vars ? JSON.stringify(vars) : '');

// A canvas that records the text drawn on it.
function fakeCanvas(){
  const texts = [];
  const ctx = new Proxy({ texts }, {
    get(target, prop){
      if(prop in target) return target[prop];
      if(prop === 'measureText') return text => ({ width: String(text).length * 14 });
      if(prop === 'fillText') return text => texts.push(String(text));
      return () => {};
    },
    set(){ return true; },
  });
  return { getContext: () => ctx, texts };
}

describe('SOCIAL-07 the passport as a picture', () => {
  const entries = TRAILS.map((tr, i) => walk(tr.id, '2026-10-' + String(10 + i)));
  const p = passport.buildPassport(entries, TRAILS);

  test('a story holds four visas and six stamps, newest stamps first, and counts the rest', () => {
    const c = card.cardContent(p, { format: 'story' });
    expect(c.format.height).toBe(1920);
    expect(c.stamps.map(s => s.trailId)).toEqual(['t11', 't10', 't9', 't8', 't7', 't6']);
    expect(c.moreStamps).toBe(6);
    expect(c.valleys.map(v => v.name)).toEqual(['Val Gardena', 'Val di Fassa', 'Alta Badia', 'Val di Funes']);
    expect(c.moreValleys).toBe(3);
    const post = card.cardContent(p, { format: 'post' });
    expect(post.format.height).toBe(1350);
    expect(post.stamps).toHaveLength(4);
    expect(post.valleys).toHaveLength(2);
  });

  test('the card draws the dog, the visas, the stamps and the footer', () => {
    const canvas = fakeCanvas();
    card.renderPassportCard(p, { t, format: 'story', dogName: 'Luna', dogBreed: 'Border collie' }, canvas);
    expect(canvas.width).toBe(1080);
    expect(canvas.height).toBe(1920);
    const all = canvas.texts.join('\n');
    expect(all).toContain('Luna');
    expect(all).toContain('Border collie');
    expect(all).toContain('VAL GARDENA');
    expect(all).toContain('Trail number 11');
    expect(all).not.toContain('Trail number 5');
    expect(all).toContain('journal.passport.card.more{"n":"6"}');
    expect(all).toContain('journal.passport.card.footer');
  });

  test('a story keeps its visas and stamps clear of the bottom 260 px, where Instagram puts its reply bar', () => {
    const c = card.cardContent(p, { format: 'story' });
    expect(180 + card.contentHeight(c)).toBeLessThanOrEqual(c.format.height - 260);
    const post = card.cardContent(p, { format: 'post' });
    expect(180 + card.contentHeight(post)).toBeLessThanOrEqual(post.format.height - post.format.footerFromBottom - 20);
  });

  test('a passport with one stamp and no dog name still draws', () => {
    const one = passport.buildPassport([walk('t0', '2026-10-10')], TRAILS);
    const canvas = fakeCanvas();
    expect(() => card.renderPassportCard(one, { t, format: 'post' }, canvas)).not.toThrow();
    expect(canvas.texts).toContain('1');
    expect(canvas.texts.join('\n')).not.toContain('more');
  });

  test('the caption gives counts only', () => {
    expect(card.shareText(p, { t, dogName: 'Luna' }))
      .toBe('journal.passport.card.caption{"name":"Luna","stamps":"12","valleys":"7","km":"60"}');
  });

  test('the card draws the trails’ published lines, never the walker’s own track', () => {
    const source = read('passport-card.js');
    expect(source).not.toMatch(/segments|\.route\b|\.track\b/);
    expect(source).toContain('api.outlinePath(s.path, 44)');
  });

  test('the passport offers Share only when there is something to share and a way to share it', () => {
    const html = passport.renderPassport(p, { t, canShare: true });
    expect(html).toContain('<button type="button" class="jp-share">journal.passport.share</button>');
    expect(passport.renderPassport(p, { t })).not.toContain('jp-share');
    expect(passport.renderPassport(passport.buildPassport([], TRAILS), { t, canShare: true })).not.toContain('jp-share');
  });

  test('a visa on the card shows its level, not a count of the whole valley', () => {
    const canvas = fakeCanvas();
    card.renderPassportCard(p, { t, format: 'story' }, canvas);
    const all = canvas.texts.join('\n');
    expect(all).toContain('★★★★★ journal.passport.level.legend'); // every trail of a valley is the top level
    expect(all).not.toContain('journal.passport.of');
    const two = passport.buildPassport([walk('t0', '2026-10-10'), walk('t1', '2026-10-11')], TRAILS);
    const first = fakeCanvas();
    card.renderPassportCard(two, { t, format: 'post' }, first);
    expect(first.texts.join('\n')).toContain('★☆☆☆☆ journal.passport.level.visitor');
  });

  test('a new visa is its own picture: the dog, the valley, its level and the trails stamped there', () => {
    const c = card.visaContent(p, { valley: 'Val Gardena', format: 'story' });
    expect(c.valley.name).toBe('Val Gardena');
    expect(c.stamps.map(s => s.trailId)).toEqual(['t5', 't4', 't3']);
    expect(c.moreStamps).toBe(3);
    expect(card.visaContent(p, { valley: 'Nowhere' })).toBeNull();
    const canvas = fakeCanvas();
    const now = Date.parse('2026-10-20T12:00:00Z'); // Val Gardena was entered on 10 Oct
    card.renderVisaCard(p, { t, valley: 'Val Gardena', format: 'story', dogName: 'Luna', now }, canvas);
    const all = canvas.texts.join('\n');
    expect(all).toContain('journal.passport.card.visaTitle{"name":"Luna"}');
    expect(all).toContain('VAL GARDENA');
    expect(all).toContain('Trail number 5');
    expect(all).not.toContain('Trail number 6'); // another valley's trail
    expect(all).toContain('journal.passport.card.more{"n":"3"}');
    const nameless = fakeCanvas();
    card.renderVisaCard(p, { t, valley: 'Cembra', format: 'post', now }, nameless);
    expect(nameless.texts).toContain('journal.passport.card.visaTitleNoName');
    expect(card.shareText(p, { t, valley: 'Cembra', dogName: 'Luna', now }))
      .toBe('journal.passport.card.visaCaption{"name":"Luna","valley":"Cembra","level":"journal.passport.level.legend"}');
    // A visa from months ago is shared as a visa, not a new one.
    const later = Date.parse('2027-03-01');
    const old = fakeCanvas();
    card.renderVisaCard(p, { t, valley: 'Val Gardena', format: 'story', dogName: 'Luna', now: later }, old);
    expect(old.texts).toContain('journal.passport.card.visaTitlePlain{"name":"Luna"}');
    expect(old.texts.join('\n')).not.toContain('card.visaTitle{');
    expect(card.shareText(p, { t, valley: 'Cembra', dogName: 'Luna', now: later }))
      .toBe('journal.passport.card.visaCaptionPlain{"name":"Luna","valley":"Cembra","level":"journal.passport.level.legend"}');
  });

  test('a level just reached is shared as a level up', () => {
    const canvas = fakeCanvas();
    card.renderVisaCard(p, { t, valley: 'Val Gardena', format: 'story', dogName: 'Luna', moment: 'level' }, canvas);
    expect(canvas.texts).toContain('JOURNAL.PASSPORT.CARD.LEVELKICKER');
    expect(canvas.texts).toContain('journal.passport.card.levelTitle{"name":"Luna"}');
    expect(card.shareText(p, { t, valley: 'Val Gardena', dogName: 'Luna', moment: 'level' }))
      .toBe('journal.passport.card.levelCaption{"name":"Luna","valley":"Val Gardena","level":"journal.passport.level.legend"}');
  });

  test('the visa picture keeps clear of Instagram’s reply bar and still shows the dog on a post', () => {
    ['story', 'post'].forEach(format => {
      const c = card.visaContent(p, { valley: 'Val Gardena', format });
      const photo = card.visaPhoto(c);
      expect(photo).toBeGreaterThanOrEqual(120);
      const bottom = card.VISA_TOP + photo + 40 + card.visaHeight(c);
      const limit = format === 'story' ? c.format.height - 260 : c.format.height - c.format.footerFromBottom - 40;
      expect(bottom).toBeLessThanOrEqual(limit);
    });
  });

  test('the journal wires the share window', () => {
    const page = read('journal.html');
    expect(page.indexOf('dog-passport.js')).toBeLessThan(page.indexOf('passport-card.js'));
    expect(page).toContain('id="jnPassShareOverlay"');
    expect(page).toContain("ev.target.closest('.jp-share')");
    expect(page).toContain('canShare: !!window.DoloPawsPassportCard,');
    expect(page).toContain("ev.target.closest('.jp-visa-share')");
    expect(page).toContain('valley: passShareValley || undefined,');
    expect(page).toContain('moment: passShareMoment || undefined,');
  });

  test('every card label exists in English and Italian', () => {
    const i18n = read('i18n.js');
    const keys = new Set();
    [read('passport-card.js'), read('journal.html')].forEach(src => {
      for(const m of src.matchAll(/['"](journal\.passport\.card\.\w+)['"]/g)) keys.add(m[1]);
    });
    keys.add('journal.passport.share');
    expect(keys.size).toBeGreaterThan(12);
    keys.forEach(key => expect(i18n.split(`'${key}':`).length - 1).toBe(2));
  });
});
