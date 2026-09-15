const fs = require('fs');
const path = require('path');
const vm = require('vm');

const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');

/**
 * The wizard leaves weight, health and behaviour optional deliberately — the
 * engine says what it does not know rather than inventing a value. What was
 * missing is the other half: the homepage stated the consequence ("Weight is
 * missing, so size adjustments are not applied") and offered no way to fix it,
 * while the trail page had had an actionable version all along.
 */
function load(translate){
  const start = script.indexOf('function liDogGapFields(');
  const end = script.indexOf('function liRecommendationExplanationHtml(');
  const context = { window:translate ? { t:translate } : {}, JSON };
  vm.createContext(context);
  vm.runInContext(`${script.slice(start, end)}\nthis.__exports = { liDogGapFields, liGapFieldList, liT };`, context);
  return context.__exports;
}

/** The English table, as i18n.js serves it at runtime. */
const EN = {
  'recommendation.profileField.fitness':'fitness level',
  'recommendation.profileField.age':'age',
  'recommendation.profileField.weight':'weight',
  'recommendation.list.and':'{first} and {last}',
};
function englishT(key, vars){
  let value = EN[key];
  if(value === undefined) return key;
  for(const name of Object.keys(vars || {})) value = value.split(`{${name}}`).join(vars[name]);
  return value;
}

describe('completing a dog from the homepage', () => {
  test('only gaps the reader owns become a prompt', () => {
    const { liDogGapFields } = load();
    const fields = liDogGapFields({ unknowns:[
      { code:'dog.weight.unknown' },
      { code:'dog.age.unknown' },
      // Nobody reading the homepage can supply these.
      { code:'trail.shade.unknown' },
      { code:'conditions.heat.unknown' },
      null,
    ] });
    expect(fields).toEqual(['weight', 'age']);
  });

  test('a complete dog is asked for nothing', () => {
    const { liDogGapFields } = load();
    expect(liDogGapFields({ unknowns:[{ code:'trail.exposure.unknown' }] })).toEqual([]);
    expect(liDogGapFields({})).toEqual([]);
  });

  test('the fields are named the way a person would say them', () => {
    const { liGapFieldList } = load(englishT);
    expect(liGapFieldList(['weight'])).toBe('weight');
    expect(liGapFieldList(['weight', 'age'])).toBe('weight and age');
    // "fitness level", not the field name the code happens to use.
    expect(liGapFieldList(['fitness', 'weight', 'age'])).toBe('fitness level, weight and age');
  });

  test('with no translator loaded it still reads, rather than breaking', () => {
    // liT falls back to the copy written inline, so a page where i18n has not
    // attached yet shows the field name instead of an empty prompt.
    const { liGapFieldList, liT } = load();
    expect(liGapFieldList(['weight', 'age'])).toBe('weight and age');
    expect(liT('recommendation.gap.fields', 'Add {name}\u2019s {fields} \u2192',
      { name:'Juno', fields:'weight' })).toBe('Add Juno\u2019s weight \u2192');
  });

  test('a gap that became a prompt is not also listed as a finding', () => {
    // Saying the same thing twice on one card reads as two problems.
    const block = script.slice(script.indexOf('function liRecommendationExplanationHtml('),
      script.indexOf('function liScheduleNewMatchSync('));
    expect(block).toContain('const gapCodes = new Set(gapFields.map(field => `dog.${field}.unknown`))');
    expect(block).toMatch(/unknowns \|\| \[\]\)\.filter\(entry => !\(entry && gapCodes\.has\(entry\.code\)\)\)/);
  });

  test('a guest is not asked to complete a dog that does not exist', () => {
    // Without a profile the right prompt is "add a dog", which the card
    // already carries elsewhere; asking for its weight would be nonsense.
    const block = script.slice(script.indexOf('function liRecommendationExplanationHtml('),
      script.indexOf('function liScheduleNewMatchSync('));
    expect(block).toContain('profile && profile.name ? liDogGapFields(recommendation) : []');
  });

  test('the prompt opens the wizard on that dog, not a page to go hunting on', () => {
    const wiring = script.slice(script.indexOf("listEl.querySelectorAll('[data-complete-dog]')"));
    expect(wiring).toContain('liResolveActiveProfile(currentProfileForAdjust)');
    expect(wiring).toContain('window.DoloPawsWizard.open(dog || null, { returnToPage:true })');
    // And still goes somewhere useful where the wizard was never loaded.
    expect(wiring).toContain("window.location.href = 'account.html'");
  });

  test('the wording is the one already translated, not a second copy', () => {
    const i18n = fs.readFileSync(path.join(__dirname, 'i18n.js'), 'utf8');
    ['recommendation.gap.fields', 'recommendation.list.and',
      'recommendation.profileField.weight', 'recommendation.profileField.age',
      'recommendation.profileField.fitness'].forEach(key => {
      expect(i18n).toContain(`'${key}'`);
    });
    expect(script).toContain("liT('recommendation.gap.fields'");
  });
});
