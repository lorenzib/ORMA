(function(root, factory){
  const api = factory(root);
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsComparisonModel = api;
})(typeof window !== 'undefined' ? window : globalThis, function(root){
  'use strict';

  // Script-written wording goes through i18n.js; the English sentence is its own key.
  function tx(text, vars){
    const i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
    if (i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
    return vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : text;
  }

  // The verdict's words come from match-verdict.js, which owns them. This file
  // kept its own copy, so the wording could be changed in one place and stay
  // the same here -- which is how a product with one vocabulary ends up with
  // several. Without the module there is no verdict to name, and the row says
  // so rather than guessing from a copy that may have drifted.
  function categoryLabel(category){
    const shared = root && root.OrmaMatchVerdict;
    if(shared && typeof shared.categoryLabel === 'function') return shared.categoryLabel(category) || '';
    const verdict = shared && shared.VERDICTS[category];
    return (verdict && verdict.label) || '';
  }
  // Read when a row is built, so the words follow the reader's language.
  function terrainWords(){
    return {
      0:tx('Gentle or paved'),
      1:tx('Mixed natural terrain'),
      2:tx('Rocky or technical'),
      3:tx('Highly technical'),
    };
  }
  function accessWords(){
    return {
      allowed:tx('Dogs allowed'),
      'leash-required':tx('Dogs allowed on leash'),
      'seasonal-restrictions':tx('Seasonal restrictions'),
      prohibited:tx('Dogs prohibited'),
    };
  }
  // The evidence tier's words come from trust/evidence-v1.js, which owns them.
  // This table was a fourth vocabulary for the field, and it disagreed rather
  // than merely repeating: it collapsed route-audited and field-verified into
  // one "Verified by ORMA", so a comparison hid the distinction between a
  // route ORMA audited from sources and one ORMA walked -- the very
  // distinction a reader opens a comparison to see.
  // "the terrain, the 3.6 km distance and the 39 m climb" as a sentence.
  function sentence(phrases){
    if(!phrases.length) return '';
    const joined = phrases.length === 1
      ? phrases[0]
      : tx('{list} and {last}', { list:phrases.slice(0, -1).join(', '), last:phrases[phrases.length - 1] });
    return `${joined.charAt(0).toUpperCase()}${joined.slice(1)}.`;
  }

  function confidenceWords(level){
    const shared = root && root.OrmaMatchVerdict;
    return shared && typeof shared.confidenceLabel === 'function' ? shared.confidenceLabel(level) : '';
  }

  function tierLabel(tier){
    const shared = root && root.DoloPawsEvidenceV1;
    return shared && typeof shared.tierLabel === 'function' ? shared.tierLabel(tier) : '';
  }

  function cell(text, kind, detail){
    return { text, kind:kind || 'known', detail:detail || null };
  }
  function unknown(label){
    return cell(tx('Not listed, {what}', { what:label }), 'unknown');
  }
  function categoryVerified(parts, category){
    return parts.verification && parts.verification.categories
      && parts.verification.categories[category] === 'verified';
  }
  function formatNumber(value, suffix){
    return Number.isFinite(value) ? `${Math.round(value * 10) / 10}${suffix}` : null;
  }
  function formatDuration(value){
    if(value === null || value === undefined || value === '') return null;
    const text = String(value).trim();
    if(/\b(?:h|hr|hour|hours|min|minute|minutes)\b/i.test(text)) return text;
    const routeReturn = root.ORMARouteReturn;
    return (routeReturn && routeReturn.formatDuration(text)) || `${text} h`;
  }

  function build(trail, options){
    options = options || {};
    const normalizeTrail = options.normalizeTrail
      || (root.DoloPawsRecommendationAdaptersV1 && root.DoloPawsRecommendationAdaptersV1.normalizeTrail);
    const parts = normalizeTrail ? normalizeTrail(trail) : trail;
    const recommendation = options.recommendation || (
      root.DoloPawsScoring && typeof root.DoloPawsScoring.recommendTrail === 'function'
        ? root.DoloPawsScoring.recommendTrail(trail, options.subject || {},
            root.ORMAScoringConditions && root.ORMAScoringConditions.forTrail(trail))
        : null
    );
    const suitability = parts.suitability || {};
    const metrics = parts.metrics || {};
    const tier = parts.verification && parts.verification.tier || 'imported';
    const terrainKnown = Number.isFinite(suitability.terrainRank);
    // The reasoning, from the view that owns it. This row used to read the
    // engine's raw sentences in the order the engine emitted them: untranslated
    // whatever language the reader had chosen, unranked, and -- where a trail
    // had nothing to caution about -- one templated sentence per positive,
    // "Terrain is within this dog's effective tolerance. The 3.6 km route is
    // within this dog's effective range." The same three sentences with the
    // nouns swapped, which is what recommendation-decision.js was written to
    // stop and what #455 stopped on the homepage.
    const view = recommendation && root && root.DoloPawsRecommendationDecision
      ? root.DoloPawsRecommendationDecision.present(recommendation, {
        translate: root.t,
        dogName: options.dogName || '',
      })
      : null;
    const concerns = view ? view.cautions.slice(0, 3) : [];
    // Nothing to caution about: say what fits, folded into one line rather
    // than listed sentence by sentence. The column heading already names the
    // dog, so the phrases do not repeat it.
    // Never under a Not recommended verdict: there the list reads as
    // reassurance that contradicts the verdict in the row above.
    const fine = view && !concerns.length && recommendation.category !== 'not-recommended'
      ? view.fine.slice(0, 4) : [];
    // A missing profile field is not a property of a trail, and in a table
    // comparing trails for one dog it would be the same on every column.
    const unknownCount = view ? view.trailUnknowns.length : 0;
    const reviewedWater = Array.isArray(parts.waypoints)
      ? parts.waypoints.filter(point => point.type === 'water' && point.status === 'reviewed').length
      : 0;
    const hazards = Array.isArray(suitability.surfaceHazards) ? suitability.surfaceHazards : null;
    const access = suitability.dogAccess && suitability.dogAccess.status;
    const TERRAIN = terrainWords();
    const ACCESS = accessWords();
    const ascent = formatNumber(metrics.ascentM, '');

    return {
      id:trail.id,
      name:trail.name,
      area:trail.area || trail.valley || '',
      cells:{
        match: recommendation
          // The verdict, not the verdict and the number. Two trails both called
          // a strong option are separated by the rows below this one -- their
          // distance, climb, terrain, water and shade -- not by three points of
          // a score whose evidence does not carry that precision.
          ? cell(categoryLabel(recommendation.category), recommendation.category === 'not-recommended' ? 'caution' : 'known',
            // "high confidence" was a third phrasing of this one field, on a
            // page whose whole job is putting two trails in the same words.
            [confidenceWords(recommendation.confidence), tx('scoring {version}', { version:recommendation.scoringVersion })]
              .filter(Boolean).join(' · '))
          : unknown(tx('dog match')),
        reasons: concerns.length || fine.length
          ? cell(concerns.length ? concerns.join(' ') : sentence(fine),
            concerns.length ? 'caution' : 'known',
            unknownCount
              ? (unknownCount === 1
                ? tx('{n} unknown item also affects confidence', { n:unknownCount })
                : tx('{n} unknown items also affect confidence', { n:unknownCount }))
              : null)
          : unknown(tx('recommendation reasons')),
        distance: formatNumber(metrics.distanceKm, ' km')
          ? cell(formatNumber(metrics.distanceKm, ' km')) : unknown(tx('distance')),
        elevation: ascent
          ? cell(tx('{m} m ascent', { m:ascent })) : unknown(tx('elevation')),
        duration: formatDuration(trail.hours)
          ? cell(formatDuration(trail.hours)) : unknown(tx('duration')),
        terrain: terrainKnown
          ? cell(TERRAIN[suitability.terrainRank] || tx('Terrain level {n}', { n:suitability.terrainRank }),
            categoryVerified(parts, 'surfaceHazards') ? 'known' : 'mapped',
            categoryVerified(parts, 'surfaceHazards') ? tx('Surface evidence reviewed') : tx('Mapped terrain; surface hazards not reviewed'))
          : unknown(tx('terrain')),
        exposure: categoryVerified(parts, 'exposure')
          ? cell(suitability.exposure ? tx('Exposed sections recorded') : tx('No exposure recorded in reviewed evidence'),
            suitability.exposure ? 'caution' : 'known')
          : unknown(tx('exposure')),
        shade: categoryVerified(parts, 'heat') && Number.isFinite(suitability.shadePercent)
          ? cell(tx('{n}% reviewed shade', { n:Math.round(suitability.shadePercent) }),
            suitability.shadePercent < 20 ? 'caution' : 'known')
          : unknown(tx('shade')),
        heat: categoryVerified(parts, 'heat') && ['low','moderate','high'].includes(suitability.heatRisk)
          ? cell({
            low:tx('Low baseline heat risk'),
            moderate:tx('Moderate baseline heat risk'),
            high:tx('High baseline heat risk'),
          }[suitability.heatRisk],
            suitability.heatRisk === 'high' ? 'caution' : 'known')
          : unknown(tx('heat')),
        water: categoryVerified(parts, 'water')
          ? cell(reviewedWater
            ? (reviewedWater === 1
              ? tx('{n} reviewed water point', { n:reviewedWater })
              : tx('{n} reviewed water points', { n:reviewedWater }))
            : tx('No usable water point confirmed, carry a full supply'),
          reviewedWater ? 'known' : 'caution')
          : unknown(tx('water')),
        hazards: categoryVerified(parts, 'surfaceHazards')
          ? cell(hazards && hazards.length ? hazards.join(' · ') : tx('No material surface hazards in reviewed evidence'),
            hazards && hazards.length ? 'caution' : 'known')
          : unknown(tx('surface hazards')),
        restrictions: categoryVerified(parts, 'access') && ACCESS[access]
          ? cell(ACCESS[access], ['prohibited','seasonal-restrictions'].includes(access) ? 'caution' : 'known')
          : unknown(tx('dog-access rules')),
        verification: cell(tierLabel(tier), ['imported','mapped'].includes(tier) ? 'mapped' : 'known'),
      },
    };
  }

  return Object.freeze({ categoryLabel, build, cell, unknown });
});
