/**
 * scoring.js — browser compatibility facade for canonical recommendation v1.
 * Load after breeds-data.js, trust/evidence-v1.js, recommendation-v1.js, and
 * recommendation-adapters-v1.js.
 *
 * scoreTrail() remains temporarily available to existing views, but contains
 * no scoring rules: it returns the score from recommendTrail().
 */

// ============================================================
// FITNESS DEFAULTS — used both to derive the guest teaser scores
// and to score the real returning-user list against a saved profile.
// ============================================================
const FITNESS_DEFAULTS = {
  low:      { terrain:'0', distance:'5'  },
  moderate: { terrain:'1', distance:'10' },
  high:     { terrain:'2', distance:'18' },
};

const SCORING_VERSION = window.DoloPawsRecommendationV1
  ? window.DoloPawsRecommendationV1.VERSION : 'unavailable';

function recommendTrail(trail, subject, currentConditions){
  const adapter = window.DoloPawsRecommendationAdaptersV1;
  if(!adapter || typeof adapter.recommendLegacyTrail !== 'function'){
    throw new Error('Canonical scoring adapters are unavailable.');
  }
  return adapter.recommendLegacyTrail(trail, subject || {}, currentConditions);
}

function scoreTrail(trail, subject, currentConditions){
  return recommendTrail(trail, subject, currentConditions).score;
}

// The profile a visitor is scored against before they add a dog. The site
// already tells them so ("Scores use a medium-dog profile"), so guest maps can
// colour by match honestly rather than falling back to a different meaning.
const GUEST_SUBJECT = Object.freeze({ terrain:'1', distance:'10', heatSensitive:false });

window.DoloPawsScoring = Object.freeze({
  VERSION: SCORING_VERSION,
  GUEST_SUBJECT,
  recommendTrail,
  scoreTrail,
});

function matchColor(n){
  return n >= 85 ? 'var(--success)' : n >= 60 ? '#8A5A16' : 'var(--ink-soft)';
}
const SAFETY_DOT = { 'low-risk': '#2C5C34', 'moderate': '#8A5A16', 'caution': '#9C3A25' };

// ---- Profile triage: breed traits + age + weight + health conditions ----
// Turns the saved dog profile into effective scoring inputs. The exact
// rules and numbers are documented in SCORING.md — keep the two in sync.

const AGE_BAND_MID = { 'u1':0.5, '1-2':1.5, '3-4':3.5, '5-6':5.5, '7-8':7.5, '9-10':9.5, '11-12':11.5, '13plus':14 };
const WEIGHT_BAND_MID = { 'u5':4, '5-10':7.5, '10-15':12.5, '15-20':17.5, '20-30':25, '30-40':35, '40-55':47.5, '55plus':60 };

function dogAgeYears(profile){
  if(profile.dob){
    const d = new Date(profile.dob);
    if(!isNaN(d)) return Math.max(0, (Date.now() - d.getTime()) / 31557600000);
  }
  if(profile.ageBand && AGE_BAND_MID[profile.ageBand] != null) return AGE_BAND_MID[profile.ageBand];
  if(typeof profile.age === 'number') return profile.age; // legacy plain number
  return null;
}

function dogWeightKg(profile){
  if(profile.weightBand && WEIGHT_BAND_MID[profile.weightBand] != null) return WEIGHT_BAND_MID[profile.weightBand];
  if(typeof profile.weight === 'number') return profile.weight; // legacy plain number
  return null;
}

function dogConditions(profile){
  if(Array.isArray(profile.conditions)) return profile.conditions;
  // Legacy profiles: two booleans instead of the conditions list.
  return [profile.jointIssues && 'joints', profile.heatIssues && 'heat'].filter(Boolean);
}

/**
 * profileInsights(profile) → array of { icon, title, sub } insight lines,
 * layering breedInsights() (breed-name based) with insights derived from
 * the SAME weight/age/condition fields and thresholds effectiveOverrides()
 * below already uses for the real match score. This is what makes the
 * homepage card work for "Mixed breed — small/medium/large" and
 * "Rescue / unknown mix" profiles too: even with no breed name, weight,
 * age and declared health conditions are real, structured facts about
 * THIS dog, and every one of them already governs the score — so they
 * should govern the tailored text as well, not just named purebreds.
 */
function profileInsights(profile){
  if(!profile) return [];
  const breedName = profile.breed || '';
  const out = (typeof breedInsights === 'function') ? breedInsights(breedName).slice() : [];
  const alreadyHas = title => out.some(l => l.title === title);

  const tr = (typeof breedTraits === 'function') ? breedTraits(breedName) : {};
  const conds = dogConditions(profile);
  const age = dogAgeYears(profile);
  const kg = dogWeightKg(profile);

  // Weight-derived, breed-agnostic — same >=45kg / <5kg thresholds used
  // below for giant/toy handling, so an unnamed or mixed-breed dog still
  // gets the physically correct caution based on its own declared weight.
  const heavyAlready = tr.giant
    || (typeof HEAVY_BUILD_BREEDS !== 'undefined' && HEAVY_BUILD_BREEDS.includes(breedName));
  if(kg != null && kg >= 45 && !heavyAlready){
    out.push({ icon:'mountain', title:'Weight adds up on descents',
      sub:'At this weight, descents load joints hard on rock — favour gradual descents and a slow pace down.' });
  }
  const toyAlready = tr.shortLegged
    || (typeof TOY_BREEDS !== 'undefined' && TOY_BREEDS.includes(breedName));
  if(kg != null && kg < 5 && !toyAlready){
    out.push({ icon:'paw', title:'Small strides, long day',
      sub:'At this weight, a normal route is far more steps — scale distance down and watch recovery closely.' });
    if(!alreadyHas('Loses heat fast when wet')){
      out.push({ icon:'cold', title:'Loses heat fast when wet',
        sub:'A small body chills quickly after rain or a stream crossing — carry a dry layer.' });
    }
  }

  // Life stage — same puppy / senior thresholds effectiveOverrides() uses.
  if(age != null && age < 1){
    out.push({ icon:'paw', title:'Still growing',
      sub:'Growth plates are still closing — avoid long climbs and let a puppy set the pace, not the itinerary.' });
  } else if(age != null && age >= 8){
    out.push({ icon:'mountain', title:'Built for shorter days now',
      sub:'Senior joints and stamina fade before the enthusiasm does — plan shorter routes with flat stretches and frequent rests.' });
  }

  // Declared health conditions — already scored by effectiveOverrides()
  // below, surfaced here in plain terms instead of only moving a number.
  if(conds.includes('joints') || conds.includes('back') || conds.includes('recovering')){
    out.push({ icon:'paw', title:'Go easy on the joints',
      sub:'A declared joint, back or recovering condition means technical, uneven ground costs more — favour smoother, gentler trails.' });
  }
  if((conds.includes('heat') || conds.includes('cardiac') || conds.includes('overweight')) && !tr.heatSensitive){
    out.push({ icon:'heat', title:'Extra care in the heat',
      sub:'A declared heart, weight or heat-related condition means hot, exposed routes cost more — start early and prioritise shade.' });
  }
  if(conds.includes('vision')){
    out.push({ icon:'mountain', title:'Extra care on exposed edges',
      sub:'A vision condition raises the stakes on narrow ledges and drop-offs — favour wider, well-marked paths.' });
  }

  return out;
}

function effectiveOverrides(profile, adjustOverride){
  if(adjustOverride){
    const base = effectiveOverrides(profile, null);
    const adjusted = { ...base, ...adjustOverride, _profile: profile };
    if(adjusted.energy === 'low') adjusted.distance = String(Math.min(5, Number(adjusted.distance) || 5));
    if(adjusted.energy === 'high') adjusted.distance = '18';
    return adjusted;
  }
  const defaults = FITNESS_DEFAULTS[profile.fitness] || FITNESS_DEFAULTS.moderate;
  const traits = (typeof breedTraits === 'function') ? breedTraits(profile.breed)
    : { heatSensitive: (typeof HEAT_SENSITIVE_BREEDS !== 'undefined') && HEAT_SENSITIVE_BREEDS.includes(profile.breed) };
  const conds = dogConditions(profile);
  const age = dogAgeYears(profile);
  const kg = dogWeightKg(profile);

  const puppy = age != null && age < 1;
  const senior = age != null && age >= 8;
  const verySenior = age != null && age >= 11;
  const orthopedic = conds.includes('joints') || conds.includes('back')
    || conds.includes('recovering') || traits.backRisk;
  const giant = traits.giant || (kg != null && kg >= 45);

  // Terrain tolerance: start from fitness, then subtract for life stage
  // and orthopedic risk; short legs and giant builds cap at "mixed rock".
  let terrain = parseInt(defaults.terrain, 10);
  if(puppy || senior) terrain -= 1;
  if(orthopedic) terrain -= 1;
  if((traits.shortLegged || giant) && terrain > 1) terrain = 1;
  terrain = Math.max(0, terrain);

  // Daily range: start from fitness, then scale down for life stage,
  // heart/weight issues, orthopedic risk, and toy builds.
  let distance = parseFloat(defaults.distance);
  if(puppy || verySenior) distance *= 0.5;
  else if(senior) distance *= 0.75;
  if(conds.includes('cardiac')) distance *= 0.6;
  if(conds.includes('joints') || conds.includes('back')) distance *= 0.75;
  if(conds.includes('overweight')) distance *= 0.75;
  if(kg != null && kg < 5) distance *= 0.8;
  distance = Math.max(2, Math.round(distance * 10) / 10);

  const heatSensitive = !!(traits.heatSensitive || conds.includes('heat')
    || conds.includes('cardiac') || conds.includes('overweight'));
  const fragile = orthopedic || senior;

  return {
    terrain: String(terrain),
    distance: String(distance),
    heatSensitive,
    hazardMult: fragile ? 1.5 : 1,
    exposureExtra: (fragile || conds.includes('vision')) ? 10 : 0,
    _profile: profile,
  };
}
