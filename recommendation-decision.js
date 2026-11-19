(function(root, factory){
  const api = factory(root);
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsRecommendationDecision = api;
})(typeof window !== 'undefined' ? window : globalThis, function(root){
  'use strict';

  // Script-written wording goes through i18n.js; the English sentence is its own key.
  function tx(text, vars){
    const i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
    if (i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
    return vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : text;
  }
  // A number as the reader writes it (6,7 km in Italian); English is unchanged.
  function num(value){ const i18n = typeof window!=='undefined' && window.DoloPawsI18n; return i18n && typeof i18n.num==='function' ? i18n.num(value) : value; }
  // A value filled into wording: a number, or text that is only a number or
  // range, is written the reader's way (as i18n.js does for its own wording).
  function fillNum(value){
    if(typeof value === 'number') return num(value);
    if(typeof value === 'string' && /^[\d.,\s–—+\-≈~]+$/.test(value) && /\d/.test(value)) return num(value);
    return value;
  }

  const CATEGORY = Object.freeze({
    'strong-option': { label:'Strong option', tone:'strong' },
    'possible-with-cautions': { label:'Good with care', tone:'caution' },
    'not-recommended': { label:'Low match', tone:'stop' },
  });

  // A recorded caution quoted from the trail's own text, in the reader's
  // language where the trail page has loaded its Italian (the engine strips
  // the closing full stop, so both forms are tried).
  function cautionWords(text){
    const i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
    if(!(i18n && typeof i18n.trailText === 'function') || typeof text !== 'string') return text;
    return text.split('; ').map(part => {
      const shown = i18n.trailText(part);
      if(shown !== part) return shown.replace(/[.;]+$/, '');
      const stopped = i18n.trailText(`${part}.`);
      return stopped !== `${part}.` ? stopped.replace(/[.;]+$/, '') : part;
    }).join('; ');
  }

  // `extra` carries what the engine does not know, such as the dog's name, so
  // a translation can say "fine for Teo" where the engine said "this dog".
  function translatedMessage(item, translate, extra){
    if(!(item && item.message)) return '';
    if(typeof translate !== 'function') return item.message;
    const key = `recommendation.reason.${item.messageKey || item.code}`;
    const vars = extra || item.vars ? { ...(extra || {}), ...(item.vars || {}) } : undefined;
    if(vars && typeof vars.hazards === 'string') vars.hazards = cautionWords(vars.hazards);
    if(vars && typeof vars.first === 'string') vars.first = cautionWords(vars.first);
    const value = translate(key, vars);
    return value && value !== key ? value : item.message;
  }

  function messages(items, translate, extra){
    return (Array.isArray(items) ? items : [])
      .map(item => translatedMessage(item, translate, extra))
      .filter(Boolean);
  }

  // A positive that cost nothing, as a short phrase. The comparison page
  // folds them into one line: "The 7.5 km distance, the 150 m climb and
  // shade."
  const FINE_PHRASES = Object.freeze({
    'trail.distance.within-range': 'the {distance} km distance',
    'trail.ascent.within-range': 'the {ascent} m climb',
    'trail.terrain.within-tolerance': 'the steepness',
    'trail.duration.within-preference': 'the walking time',
    'conditions.heat.low': 'today’s temperatures',
    'trail.heat.low': 'heat exposure',
    'trail.shade.good': 'shade',
    'trail.exposure.none-known': 'no exposed sections',
    'trail.surface-hazards.none-known': 'no recorded surface hazards',
    'trail.water.reviewed': 'water on the route',
    'trail.dog-access.allowed': 'dog access',
    'trail.dog-access.leash': 'dog access on a leash',
    'trail.livestock.none': 'no livestock recorded',
    'trail.wildlife.low': 'low wildlife activity',
    'trail.road.none': 'no road sections',
    'trail.crowding.quiet': 'a quiet route',
    'trail.sightlines.open': 'open sightlines',
  });

  /**
   * The same positives as whole sentences, for a trail-page row whose code has
   * no shorter fact in ROW_FACTS, so nothing is dropped. "recorded" stays
   * wherever the phrase above has it: mapped absence of a hazard is not
   * evidence the hazard is absent, and the sentence must not quietly upgrade it.
   */
  // Each is read when the page renders, so the sentence comes out in the
  // page's language; it keeps its {placeholders} for tr() to fill.
  const FIT_SENTENCES = Object.freeze({
    'trail.distance.within-range': () => tx('The {distance} km distance is comfortable.'),
    'trail.ascent.within-range': () => tx('The {ascent} m climb is gentle.'),
    'trail.terrain.within-tolerance': () => tx('The slopes are fine.'),
    'trail.duration.within-preference': () => tx('The walking time fits.'),
    'conditions.heat.low': () => tx('Today is cool enough.'),
    'trail.heat.low': () => tx('The route does not get too hot.'),
    'trail.shade.good': () => tx('There is good shade.'),
    'trail.exposure.none-known': () => tx('No exposed sections are recorded.'),
    'trail.surface-hazards.none-known': () => tx('No surface hazards are recorded.'),
    'trail.water.reviewed': () => tx('There is water on the route.'),
    'trail.dog-access.allowed': () => tx('Dogs are allowed.'),
    'trail.dog-access.leash': () => tx('Dogs are allowed on a leash.'),
    'trail.livestock.none': () => tx('No livestock is recorded.'),
    'trail.wildlife.low': () => tx('Wildlife activity is low.'),
    'trail.road.none': () => tx('There are no road sections.'),
    'trail.crowding.quiet': () => tx('The route is usually quiet.'),
    'trail.sightlines.open': () => tx('The sightlines are open.'),
  });

  /**
   * The homepage card's cautions, and the cost rows of the trail page's
   * "Why 44% for Teo" breakdown, in the same plain voice as FIT_SENTENCES.
   *
   * The engine's sentences are written to be checked against the score, so
   * they carry its working: "The terrain is harder than Teo is up to (grade 2,
   * tolerance 1)." To a reader that is jargon. These say the same thing the way
   * the safety guides now talk (#1304): short, everyday words, "we" and "you".
   * The points beside each breakdown row already say how much it cost.
   *
   * Keyed by messageKey, else code. A caution with no card sentence keeps the
   * engine's, so nothing is dropped; the hard stops (chairlift, dogs banned)
   * are already plain and are left as they are on purpose.
   */
  const CARD_SENTENCES = Object.freeze({
    'trail.terrain.above-tolerance': vars => (vars.steepest
      ? tx('Steeper than {name} likes, up to {steepest}% in places.')
      : tx('Steeper than {name} likes.')),
    'trail.distance.above-range': () => tx('{distance} km is a long way for {name}.'),
    'trail.ascent.above-range': () => tx('{ascent} m of climbing is a lot for {name}.'),
    'trail.descent.joint-load': () => tx('The long way down is hard on {name}’s joints.'),
    'trail.exposure.present': () => tx('Parts of the path run beside steep drops.'),
    'trail.heat.high': () => tx('This route gets hot.'),
    'trail.heat.high.sensitive': () => tx('This route gets hot, and {name} feels the heat.'),
    'trail.heat.moderate': () => tx('This route can get warm.'),
    'trail.heat.moderate.sensitive': () => tx('This route can get warm, and {name} feels the heat.'),
    'trail.shade.very-low': () => tx('There’s almost no shade.'),
    'trail.shade.low': () => tx('There isn’t much shade.'),
    'trail.water.none-reviewed': () => tx('We know of no water on the way. Bring all {name} needs.'),
    'trail.season.outside': () => tx('It’s not the season for this walk.'),
    'evidence.critical.capped': () => tx('We haven’t checked this trail’s safety details yet.'),
    'trail.dog-access.unknown': () => tx('We haven’t found this area’s dog rules yet. Ask the local tourist office before you go.'),
    'trail.terrain.unknown': () => tx('We don’t know how steep the path is.'),
    'trail.distance.unknown': () => tx('We don’t know how long it is.'),
    'trail.ascent.unknown': () => tx('We don’t know how much climbing there is.'),
    'trail.descent.unknown': () => tx('We don’t know how much of it is downhill.'),
    'trail.exposure.unknown': () => tx('We don’t know yet if there are steep drops.'),
    'trail.heat.unknown': () => tx('We don’t know yet how warm this route gets.'),
    'trail.shade.unknown': () => tx('We don’t know how much shade there is.'),
    'trail.surface-hazards.unknown': () => tx('We don’t know what the path is like underfoot.'),
    'score.floor': () => tx('This walk asks too much of {name}, so the score stays at its lowest.'),
  });

  // A list of route cautions becomes the first one, as the board wrote it:
  // the trail page has them all. The caution is the
  // trail's own English, so an Italian reader gets it only where the trail's
  // Italian text is loaded; otherwise the card counts them, rather than drop an
  // English sentence into an Italian card.
  function hazardCardSentence(item, tr, extra){
    const vars = item.vars || {};
    const count = Number(vars.count) || 0;
    const first = String(vars.first || '').trim();
    const i18n = root && root.DoloPawsI18n;
    const local = first && i18n && typeof i18n.trailText === 'function' ? i18n.trailText(first) : first;
    const foreign = Boolean(i18n && i18n.lang && i18n.lang !== 'en' && local === first);
    if(!first || foreign){
      return count === 1
        ? tr('recommendation.card.surface-hazards.count.one', tx('There’s one thing to watch for on this route. The trail page says what.'), extra)
        : tr('recommendation.card.surface-hazards.count.many', tx('There are {count} things to watch for on this route. The trail page lists them.'), { ...extra, count });
    }
    // The card links to the trail page, which lists the rest, so the card no
    // longer counts them ("The trail page has one more.").
    return `${local.replace(/[.;:]+$/, '')}.`;
  }

  // The trail page lists every caution, so it keeps the whole list and only
  // loses the "Recorded route cautions:" heading. One caution is just itself.
  function hazardBreakdownSentence(item, tr, extra){
    const vars = item.vars || {};
    const hazards = cautionWords(String(vars.hazards || '').trim());
    if(!hazards) return translatedMessage(item, null, extra);
    if(Number(vars.count) === 1) return `${hazards.replace(/[.;:]+$/, '')}.`;
    return `${hazards.replace(/[.;:]+$/, '')}.`;
  }

  // forPage 'card' (the homepage card) or 'trail' (the trail page breakdown).
  function cardMessage(item, translate, tr, extra, forPage = 'card'){
    const key = item && (item.messageKey || item.code);
    if(key === 'trail.surface-hazards.present.one' || key === 'trail.surface-hazards.present.many'){
      return forPage === 'trail' ? hazardBreakdownSentence(item, tr, extra) : hazardCardSentence(item, tr, extra);
    }
    const sentence = CARD_SENTENCES[key];
    if(!sentence) return translatedMessage(item, translate, extra);
    const vars = steepnessVars(item.vars);
    return tr(`recommendation.card.${key}`, sentence(vars), { ...extra, ...vars });
  }

  /**
   * Steepness, in words. The engine grades a walk 0-2 by its steepest stretch
   * that holds for 300 m (under 10%, 10-18%, 18% or more) and gives each dog a
   * limit on the same scale. "Grade 1, tolerance 1" meant nothing to a reader;
   * how-scoring-works.html#steepness explains the scale these words stand for.
   */
  const STEEPNESS_LEVELS = Object.freeze([
    () => tx('Gentle'), () => tx('Moderately steep'), () => tx('Steep'),
  ]);
  const STEEPNESS_LIMITS = Object.freeze([
    () => tx('gentle slopes'), () => tx('moderate slopes'), () => tx('steep slopes'),
  ]);
  function steepnessLevel(rank){
    const level = STEEPNESS_LEVELS[rank];
    return level ? level() : null;
  }
  function steepnessVars(vars){
    vars = vars || {};
    if(!Number.isFinite(vars.tolerance)) return vars;
    const limit = STEEPNESS_LIMITS[Math.max(0, Math.min(2, vars.tolerance))];
    return { ...vars, limit:limit() };
  }

  /**
   * The trail page's "Why 100% for Teo", one row per thing the score looked
   * at: what it is, what this walk has, and what that meant for the score.
   *
   * It replaced a list of costs followed by "Fine for Teo: the terrain, the
   * 9.6 km distance, ..." -- one long line with no verb -- and a positive with
   * no short form stood alone under a bare "fine" chip. A row says the fact
   * ("9.6 km") and leaves the verdict to its status, so nothing reads as a
   * sentence fragment and nothing is labelled "fine" without saying what.
   *
   * Keyed by code prefix; the first match wins, so longer prefixes go first.
   */
  const ROW_TOPICS = Object.freeze([
    ['trail.distance.', () => tx('Distance')],
    ['trail.duration.', () => tx('Walking time')],
    ['trail.ascent.', () => tx('Climb')],
    ['trail.descent.', () => tx('Way down')],
    ['trail.terrain.', () => tx('Steepness')],
    ['trail.exposure.', () => tx('Drops')],
    ['trail.surface-hazards.', () => tx('Underfoot')],
    ['trail.water.', () => tx('Water')],
    ['trail.heat.', () => tx('Heat')],
    ['trail.shade.', () => tx('Shade')],
    ['conditions.', () => tx('Today')],
    ['trail.season.', () => tx('Season')],
    ['trail.dog-access.', () => tx('Dog rules')],
    ['trail.lift.', () => tx('Lifts')],
    ['dog.chairlift.', () => tx('Lifts')],
    ['trail.livestock.', () => tx('Livestock')],
    ['trail.wildlife.', () => tx('Wildlife')],
    ['trail.road.', () => tx('Roads')],
    ['trail.crowding.', () => tx('Crowds')],
    ['trail.sightlines.', () => tx('Sightlines')],
    ['segment.', () => tx('On the route')],
    ['evidence.', () => tx('Checks')],
  ]);
  function rowTopic(code){
    const match = ROW_TOPICS.find(([prefix]) => String(code || '').startsWith(prefix));
    return match ? match[1]() : tx('Other');
  }

  // What a positive row says about the walk itself. The status beside it
  // carries the verdict, so these are facts, not judgements.
  const ROW_FACTS = Object.freeze({
    'trail.distance.within-range': () => tx('{distance} km'),
    'trail.ascent.within-range': () => tx('{ascent} m up'),
    'trail.duration.within-preference': () => tx('Fits the time you have'),
    'trail.exposure.none-known': () => tx('No steep drops recorded'),
    'trail.surface-hazards.none-known': () => tx('Nothing recorded to watch for'),
    'trail.water.reviewed.one': () => tx('At one point on the way'),
    'trail.water.reviewed.many': () => tx('At {count} points on the way'),
    'trail.heat.low': () => tx('Stays cool'),
    'trail.shade.good': () => tx('Plenty of shade'),
    'conditions.heat.low': () => tx('Cool enough today'),
    'trail.season.inside': () => tx('In season this month'),
    'trail.dog-access.allowed': () => tx('Dogs allowed'),
    'trail.dog-access.leash': () => tx('Dogs allowed on a lead'),
    'trail.livestock.none': () => tx('None recorded'),
    'trail.wildlife.low': () => tx('Little activity recorded'),
    'trail.road.none': () => tx('Keeps clear of roads'),
    'trail.crowding.quiet': () => tx('Usually quiet'),
    'trail.sightlines.open': () => tx('Open, you can see ahead'),
  });

  // The trail page says what fits in one line of short chips ("6 km",
  // "330 m climb", "No drops") rather than a row each: the reader needs to see
  // that it fits, not read why. A fit with no chip falls back to its topic.
  const FIT_CHIPS = Object.freeze({
    'trail.distance.within-range': () => tx('{distance} km'),
    'trail.ascent.within-range': () => tx('{ascent} m climb'),
    'trail.duration.within-preference': () => tx('Fits your time'),
    'trail.exposure.none-known': () => tx('No drops'),
    'trail.surface-hazards.none-known': () => tx('Easy underfoot'),
    'trail.water.reviewed': () => tx('Water on the way'),
    'trail.heat.low': () => tx('Stays cool'),
    'trail.shade.good': () => tx('Plenty of shade'),
    'conditions.heat.low': () => tx('Cool today'),
    'trail.season.inside': () => tx('In season'),
    'trail.dog-access.leash': () => tx('Dogs on a lead'),
    'trail.livestock.none': () => tx('No livestock'),
    'trail.wildlife.low': () => tx('Little wildlife'),
    'trail.road.none': () => tx('No roads'),
    'trail.crowding.quiet': () => tx('Usually quiet'),
    'trail.sightlines.open': () => tx('Clear views ahead'),
  });
  function fitChip(entry, source, tr, extra){
    const vars = { ...extra, ...(source.vars || {}) };
    if(entry.code === 'trail.terrain.within-tolerance'){
      const level = steepnessLevel(source.vars && source.vars.terrain);
      if(level) return level;
    }
    const key = Object.keys(FIT_CHIPS).find(code => entry.code === code || entry.code.startsWith(`${code}.`));
    if(!key) return rowTopic(entry.code);
    return tr(`recommendation.chip.${key}`, FIT_CHIPS[key](), vars);
  }
  // Dog rules are said only when they restrict the walk: a ban (a hard stop),
  // seasonal limits (a caution) or a lead (a chip). "Dogs allowed" says
  // nothing on a site where every walk takes dogs, and an unknown rule is not
  // said at all (owner, 19 Nov).
  const SILENT_FITS = Object.freeze(['trail.dog-access.allowed']);

  function steepnessFact(vars){
    const level = steepnessLevel(vars && vars.terrain);
    if(!level) return null;
    return Number.isFinite(vars.steepest) && vars.steepest > 0
      ? tx('{level}, steepest stretch about {steepest}%', { level, steepest:num(vars.steepest) })
      : level;
  }

  /**
   * The homepage card's one-line verdict: "Good for Teo: 9.6 km, a gentle
   * 170 m climb and water on the way." A card is skimmed in a list of a dozen,
   * so it says the three facts an owner plans around, in this order, and
   * leaves the rest to the trail page's rows.
   */
  const VERDICT_PHRASES = Object.freeze([
    ['trail.distance.within-range', () => tx('{distance} km')],
    ['trail.ascent.within-range', () => tx('a gentle {ascent} m climb')],
    ['trail.water.reviewed', () => tx('water on the way')],
    ['trail.shade.good', () => tx('plenty of shade')],
    ['trail.terrain.within-tolerance', () => tx('no slopes too steep')],
    ['trail.exposure.none-known', () => tx('no steep drops recorded')],
  ]);
  const VERDICT_PHRASE_LIMIT = 3;

  // Calm framing: confidence describes data completeness, not danger. "low"
  // must not read as a warning, missing data never lowers the score. The words
  // live in match-verdict.js, beside the rule about when they are worth saying
  // -- this file held the only copy that agreed with them, and the homepage
  // held one that did not.
  function confidenceWords(level, translate){
    const shared = root && root.OrmaMatchVerdict;
    return shared ? shared.confidenceLabel(level, translate) : '';
  }

  function present(recommendation, context){
    recommendation = recommendation || {};
    context = context || {};
    const category = CATEGORY[recommendation.category] || {
      label:'Recommendation unavailable',
      tone:'unknown',
    };
    const translate = context.translate;
    const tr = (key, fallback, vars) => {
      if(typeof translate === 'function'){
        const value = translate(key, vars);
        if(value && value !== key) return value;
      }
      let output = fallback;
      for(const name of Object.keys(vars || {})){
        output = output.split(`{${name}}`).join(fillNum(vars[name]));
      }
      return output;
    };
    // Only four reasons and four cautions reach the card, so what survives the
    // cut decides whether the explanation reads as specific to this dog or as
    // boilerplate. The engine emits in calculation order, which puts every
    // behaviour and positioned advisory last, exactly the lines worth
    // showing. Rank before slicing; ties keep the engine's own order.
    const rank = (tiers, fallback) => item => {
      const code = typeof item.code === 'string' ? item.code : '';
      const index = tiers.findIndex(tier => tier.some(prefix => code.startsWith(prefix)));
      return index === -1 ? fallback : index;
    };
    const ordered = (items, tiers, fallback) => {
      const score = rank(tiers, fallback);
      return items
        .map((item, index) => ({ item, index, tier:score(item) }))
        .sort((a, b) => a.tier - b.tier || a.index - b.index)
        .map(entry => entry.item);
    };

    const REASON_TIERS = [
      // What the owner asked for: does this route fit this dog, this walk?
      ['trail.distance.within-range', 'trail.duration.within-preference'],
      // Present properties an owner plans around, and that are true of this
      // dog in particular.
      ['trail.sightlines.', 'trail.water.reviewed'],
      // Absences rank below presences: "no livestock recorded" is weaker
      // information than "water at two points", and reads as filler when it
      // crowds out a fact the owner can act on.
      ['trail.livestock.none', 'trail.wildlife.low', 'trail.road.none',
        'trail.crowding.quiet', 'trail.dog-access.'],
    ];
    const CAUTION_TIERS = [
      // Route facts that can end a walk.
      ['trail.dog-access.', 'trail.exposure.present', 'trail.terrain.above-tolerance',
        'segment.avoid'],
      // Positioned and behavioural: specific, and actionable on the day.
      ['segment.', 'trail.livestock.', 'trail.wildlife.', 'trail.road.',
        'trail.sightlines.', 'trail.crowding.'],
    ];
    const dogName = String(context.dogName || '').trim();
    const subject = dogName || tr('recommendation.subject.guest', 'a medium dog');
    const extra = { name:subject };

    const codesOf = items => new Set((Array.isArray(items) ? items : [])
      .filter(Boolean).map(item => item.code).filter(Boolean));
    const positiveCodes = codesOf(recommendation.positiveReasons);
    const stopCodes = codesOf(recommendation.hardStops);
    const kindOf = entry => stopCodes.has(entry.code) ? 'stop'
      : positiveCodes.has(entry.code) ? 'positive'
      : 'caution';

    const allFactors = (Array.isArray(recommendation.factors) ? recommendation.factors : [])
      .filter(entry => entry && typeof entry.message === 'string');
    const floorEntry = allFactors.find(entry => entry.code === 'score.floor') || null;
    const breakdownFactors = allFactors
      .filter(entry => entry !== floorEntry)
      .map(entry => ({
        impact:Number.isFinite(entry.impact) ? entry.impact : 0,
        // The engine's own sentence stays on `factors`; the reader gets the plain one.
        message:cardMessage(entry, translate, tr, extra, 'trail'),
        code:entry.code,
        kind:kindOf(entry),
      }));
    // The positives that cost nothing, as short phrases ("the 3.6 km
    // distance"), for the comparison page's single "what fits" line.
    const finePhrase = entry => {
      const fallback = FINE_PHRASES[entry.code];
      if(!fallback) return null;
      return tr(`recommendation.fine.${entry.code}`, fallback, { ...extra, ...(entry.vars || {}) });
    };
    const fitSentence = entry => {
      const sentence = FIT_SENTENCES[entry.code];
      if(!sentence) return null;
      return tr(`recommendation.fits.${entry.code}`, sentence(), { ...extra, ...(entry.vars || {}) });
    };
    const fine = breakdownFactors
      .filter(entry => entry.kind === 'positive' && entry.impact >= 0)
      .map(entry => finePhrase(allFactors.find(factor => factor.code === entry.code) || entry))
      .filter(Boolean);

    const rankedReasons = ordered(
      (Array.isArray(recommendation.positiveReasons) ? recommendation.positiveReasons : [])
        .filter(Boolean),
      REASON_TIERS, REASON_TIERS.length);
    const rankedCautions = ordered(
      (Array.isArray(recommendation.cautions) ? recommendation.cautions : []).filter(Boolean),
      CAUTION_TIERS, CAUTION_TIERS.length);

    const reasons = messages(rankedReasons, translate, extra);
    // Hard stops always lead: nothing below them changes the decision.
    const cautions = messages(recommendation.hardStops, translate, extra)
      .concat(messages(rankedCautions, translate, extra));
    const rawUnknowns = (Array.isArray(recommendation.unknowns) ? recommendation.unknowns : [])
      .filter(Boolean);
    const unknowns = messages(rawUnknowns, translate, extra);
    // The unknown codes encode their owner: dog.* gaps are fixable by the
    // user right now (profile fields); everything else is trail data.
    const isDogGap = item => typeof item.code === 'string' && item.code.startsWith('dog.');
    const dogGapFields = rawUnknowns
      .filter(isDogGap)
      .map(item => item.code.split('.')[1])
      .filter(Boolean);
    // A gap the card turns into "add Eddie's weight" must not also sit above
    // it as a finding: said twice, one missing field reads as two problems.
    // Callers that render the prompt list these instead of `unknowns`.
    const trailUnknowns = messages(rawUnknowns.filter(item => !isDogGap(item)), translate, extra);
    // The same cautions and unknowns, in the order above, said the card's way.
    const cardMessages = items => (Array.isArray(items) ? items : []).filter(Boolean)
      .map(item => cardMessage(item, translate, tr, extra)).filter(Boolean);
    const cardCautions = cardMessages(recommendation.hardStops).concat(cardMessages(rankedCautions));
    const cardTrailUnknowns = cardMessages(rawUnknowns.filter(item => !isDogGap(item)));

    // The trail page's rows (see ROW_TOPICS): what stops the walk, then what
    // cost points, most first, then notes, then everything that fits.
    // The pill says what a factor does in words; the points themselves sit in
    // the closed "How the score adds up" list, so a row never reads as a sum.
    const rowPoints = entry => entry.kind === 'stop'
      ? tr('recommendation.breakdown.stop', 'Stop')
      : entry.impact < 0 ? `\u2212${Math.abs(entry.impact)}` : '0';
    const rowStatus = entry => entry.kind === 'stop'
      ? { status:tr('recommendation.breakdown.stop', 'Stop'), tone:'stop' }
      : entry.impact < 0
        ? { status:tr('recommendation.row.lowers', tx('Lowers score')), tone:'cost' }
        : entry.kind === 'positive'
          ? { status:tr('recommendation.row.fits', tx('Fits')), tone:'ok' }
          : { status:tr('recommendation.breakdown.note', 'Note'), tone:'note' };
    const rowDetail = (entry, source) => {
      if(entry.kind !== 'positive') return entry.message;
      if(entry.code === 'trail.terrain.within-tolerance') return steepnessFact(source.vars) || entry.message;
      const fact = ROW_FACTS[source.messageKey] || ROW_FACTS[entry.code];
      if(!fact) return fitSentence(source) || entry.message;
      return tr(`recommendation.row.${source.messageKey || entry.code}`, fact(), { ...extra, ...(source.vars || {}) });
    };
    const toneOrder = { stop:0, cost:1, note:2, ok:3 };
    const factorRows = breakdownFactors
      .map((entry, index) => {
        const source = allFactors.find(factor => factor.code === entry.code) || entry;
        return { topic:rowTopic(entry.code), detail:rowDetail(entry, source), code:entry.code,
          impact:entry.impact, points:rowPoints(entry), index, ...rowStatus(entry) };
      })
      .sort((a, b) => toneOrder[a.tone] - toneOrder[b.tone]
        || (a.tone === 'cost' ? a.impact - b.impact : 0) || a.index - b.index)
      .map(({ index, ...row }) => row);
    // What the score could not look at, said apart from the rows: an unknown
    // costs nothing, so a row for it would sit beside a 100% as if it agreed.
    const notChecked = cardTrailUnknowns.slice(0, 5);
    // The short version the trail page and card now show: the reasons that
    // lower the score (or stop it), in the order above, and what fits, as
    // chips. Unknowns are not listed: none of them is worth a line.
    const shortReasons = factorRows.filter(row => row.tone !== 'ok').map(row => ({ text:row.detail, tone:row.tone }));
    const fitChips = breakdownFactors
      .filter(entry => entry.kind === 'positive' && !SILENT_FITS.includes(entry.code))
      .map(entry => fitChip(entry, allFactors.find(factor => factor.code === entry.code) || entry, tr, extra))
      .filter((chip, index, all) => chip && all.indexOf(chip) === index);

    // The card's verdict line (VERDICT_PHRASES). A low match gets none: its
    // reasons are the cautions, and a list of what is fine would contradict it.
    const positivesByCode = new Map((Array.isArray(recommendation.positiveReasons) ? recommendation.positiveReasons : [])
      .filter(Boolean).map(item => [item.code, item]));
    const verdictPhrases = VERDICT_PHRASES
      .filter(([code]) => positivesByCode.has(code))
      .slice(0, VERDICT_PHRASE_LIMIT)
      .map(([code, phrase]) => tr(`recommendation.verdict.${code}`, phrase(), { ...extra, ...(positivesByCode.get(code).vars || {}) }));
    const verdictLead = recommendation.category === 'strong-option'
      ? tr('recommendation.verdict.lead.strong', tx('Good for {name}'), extra)
      : tr('recommendation.verdict.lead.caution', tx('Mostly fine for {name}'), extra);
    const cardVerdict = recommendation.category !== 'not-recommended' && verdictPhrases.length
      ? { lead:verdictLead, facts:verdictPhrases.length <= 1 ? verdictPhrases.join('') : tr('recommendation.list.and', '{first} and {last}', {
          first:verdictPhrases.slice(0, -1).join(', '), last:verdictPhrases[verdictPhrases.length - 1] }) }
      : null;

    return {
      factorRows,
      notChecked,
      shortReasons,
      fitChips,
      cardVerdict,
      confidenceLabel:confidenceWords(recommendation.confidence, translate) || null,
      dogGapFields,
      trailUnknownCount:rawUnknowns.length - dogGapFields.length,
      conclusion:tr(`recommendation.category.${recommendation.category || 'unavailable'}`, category.label),
      tone:category.tone,
      score:Number.isFinite(recommendation.score) ? recommendation.score : null,
      confidence:recommendation.confidence || 'unknown',
      scoringVersion:recommendation.scoringVersion || 'unknown',
      evidenceTier:recommendation.evidenceTier || 'unknown',
      contextLabel:dogName
        ? tr('recommendation.context.dog', 'Recommendation for {name}', { name:dogName })
        : tr('recommendation.context.guest', 'Unpersonalized planning view'),
      dogName:dogName || null,
      reasons:reasons.slice(0, 4),
      cautions:cautions.slice(0, 4),
      // P0-1: the full ordered breakdown, most negative first. Unlike the two
      // summary lists above this is not truncated, the acceptance criterion
      // is that it lists exactly the factors the score was computed from.
      breakdownFor:subject,
      breakdown:breakdownFactors,
      fine,
      // The floor is not a factor the reader can act on, and rendering its
      // positive impact alongside the costs reads as a bonus. It closes the
      // list as a note instead, explaining why the total stops where it does.
      breakdownNote:floorEntry ? cardMessage(floorEntry, translate, tr, extra, 'trail') : null,
      unknowns:unknowns.slice(0, 5),
      trailUnknowns:trailUnknowns.slice(0, 5),
      // For the homepage card's check lines (see CARD_SENTENCES).
      cardCautions:cardCautions.slice(0, 4),
      cardTrailUnknowns:cardTrailUnknowns.slice(0, 5),
      additionalUnknowns:Math.max(0, unknowns.length - 5),
      heroSummary:dogName
        ? tr('recommendation.hero.dog', '{conclusion} for {name}.', {
          conclusion:tr(`recommendation.category.${recommendation.category || 'unavailable'}`, category.label),
          name:dogName,
        })
        : tr('recommendation.hero.guest', '{conclusion} in an unpersonalized planning view.', {
          conclusion:tr(`recommendation.category.${recommendation.category || 'unavailable'}`, category.label),
        }),
    };
  }

  // P0-3: what changed when the reader added their own dog. A move of two
  // points or less is not a move, claiming one would be inventing drama the
  // score does not support -- and saying "same score" out loud is a banner
  // whose whole content is that nothing happened. Below the tolerance the
  // callout says nothing at all.
  const SAME_SCORE_TOLERANCE = 2;

  function firstRunCallout(before, after, translate){
    if(!before || !after) return null;
    if(!Number.isFinite(before.score) || !Number.isFinite(after.score)) return null;
    if(!before.forName || !after.forName || before.forName === after.forName) return null;

    const tr = (key, fallback, vars) => {
      if(typeof translate === 'function'){
        const value = translate(key, vars);
        if(value && value !== key) return value;
      }
      let output = fallback;
      for(const name of Object.keys(vars || {})) output = output.split(`{${name}}`).join(fillNum(vars[name]));
      return output;
    };

    if(Math.abs(after.score - before.score) <= SAME_SCORE_TOLERANCE) return null;
    return tr('recommendation.firstRun.moved',
      tx('Was {beforeScore}% for {before} · now {afterScore}% for {name}. See why below.'),
      { beforeScore:before.score, before:before.forName, afterScore:after.score, name:after.forName });
  }

  return Object.freeze({ CATEGORY, SAME_SCORE_TOLERANCE, present, translatedMessage, firstRunCallout });
});
