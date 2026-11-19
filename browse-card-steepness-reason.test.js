const fs = require('fs');
const path = require('path');
const vm = require('vm');

// The browse card's one reason line says why steepness lowered the match, in
// the trail page's words. Before, a gentle-only dog moved 193 of 405 cards down
// a band and the card still only said "Water access listed at 2 points".
const html = fs.readFileSync(path.join(__dirname, 'browse-trails.html'), 'utf8');

function pageFunction(name){
  const start = html.indexOf(`function ${name}(`);
  if(start < 0) throw new Error(`${name} not found in browse-trails.html`);
  let depth = 0;
  for(let i = html.indexOf('{', start); i < html.length; i++){
    if(html[i] === '{') depth++;
    else if(html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`${name} is not closed`);
}

function runtime(){
  const ctx = { console, Date, Math, JSON };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for(const file of ['breeds-data.js', 'data/regions/dolomites-trails.js', 'scoring/recommendation-v1.js', 'scoring/recommendation-adapters-v1.js', 'scoring.js']){
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), ctx, { filename:file });
  }
  vm.runInContext(`function scoredSubjectName(){ return 'Teo'; }
    ${pageFunction('steepnessCaution')}
    ${pageFunction('steepnessReason')}`, ctx, { filename:'browse-trails.html' });
  return ctx;
}

const ctx = runtime();
const teo = { name:'Teo', fitness:'moderate', ageBand:'3-4', weightBand:'20-30', conditions:[] };
const sorapis = ctx.trails.find(trail => trail.id === 'lago-sorapis');

function cardReason(profile){
  const subject = vm.runInContext('effectiveOverrides', ctx)(profile, null);
  const recommendation = ctx.DoloPawsScoring.recommendTrail(sorapis, subject, null);
  const steepness = ctx.steepnessCaution(recommendation);
  return steepness ? ctx.steepnessReason(steepness) : null;
}

describe('the browse card says when steepness lowered the match', () => {
  test('a gentle-only Teo is told how steep Lago di Sorapis gets', () => {
    expect(cardReason({ ...teo, steepnessLimit:0 })).toBe('Steeper than Teo likes, up to 32% in places.');
  });

  test('a healthy Teo with no steepness answer gets no steepness line', () => {
    expect(cardReason(teo)).toBeNull();
  });

  test('the line takes the place of water or shade, except on a strong option', () => {
    expect(html).toMatch(/const reason = verdict\.steepness && verdict\.category !== 'strong-option' \? steepnessReason\(verdict\.steepness\)/);
    expect(html).toMatch(/steepness:steepnessCaution\(recommendation\)/);
  });

  test('both sentences already have Italian', () => {
    const it = fs.readFileSync(path.join(__dirname, 'i18n-phrases-it.js'), 'utf8');
    expect(it).toContain('"Steeper than {name} likes, up to {steepest}% in places."');
    expect(it).toContain('"Steeper than {name} likes."');
  });
});
