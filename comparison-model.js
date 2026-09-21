(function(root, factory){
  const api = factory(root);
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsComparisonModel = api;
})(typeof window !== 'undefined' ? window : globalThis, function(root){
  'use strict';

  // The verdict's words come from match-verdict.js, which owns them. This file
  // kept its own copy, so the wording could be changed in one place and stay
  // the same here -- which is how a product with one vocabulary ends up with
  // several. Without the module there is no verdict to name, and the row says
  // so rather than guessing from a copy that may have drifted.
  function categoryLabel(category){
    const shared = root && root.OrmaMatchVerdict;
    const verdict = shared && shared.VERDICTS[category];
    return (verdict && verdict.label) || '';
  }
  const TERRAIN = {
    0:'Gentle or paved',
    1:'Mixed natural terrain',
    2:'Rocky or technical',
    3:'Highly technical',
  };
  const ACCESS = {
    allowed:'Dogs allowed',
    'leash-required':'Dogs allowed on leash',
    'seasonal-restrictions':'Seasonal restrictions',
    prohibited:'Dogs prohibited',
  };
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
      : `${phrases.slice(0, -1).join(', ')} and ${phrases[phrases.length - 1]}`;
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
    return cell(`Not listed, ${label}`, 'unknown');
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
    return /\b(?:h|hr|hour|hours|min|minute|minutes)\b/i.test(text)
      ? text : `${text} h`;
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
    const fine = view && !concerns.length ? view.fine.slice(0, 4) : [];
    // A missing profile field is not a property of a trail, and in a table
    // comparing trails for one dog it would be the same on every column.
    const unknownCount = view ? view.trailUnknowns.length : 0;
    const reviewedWater = Array.isArray(parts.waypoints)
      ? parts.waypoints.filter(point => point.type === 'water' && point.status === 'reviewed').length
      : 0;
    const hazards = Array.isArray(suitability.surfaceHazards) ? suitability.surfaceHazards : null;
    const access = suitability.dogAccess && suitability.dogAccess.status;

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
            [confidenceWords(recommendation.confidence), `scoring ${recommendation.scoringVersion}`]
              .filter(Boolean).join(' · '))
          : unknown('dog match'),
        reasons: concerns.length || fine.length
          ? cell(concerns.length ? concerns.join(' ') : sentence(fine),
            concerns.length ? 'caution' : 'known',
            unknownCount
              ? `${unknownCount} unknown item${unknownCount === 1 ? ' also affects' : 's also affect'} confidence`
              : null)
          : unknown('recommendation reasons'),
        distance: formatNumber(metrics.distanceKm, ' km')
          ? cell(formatNumber(metrics.distanceKm, ' km')) : unknown('distance'),
        elevation: formatNumber(metrics.ascentM, ' m ascent')
          ? cell(formatNumber(metrics.ascentM, ' m ascent')) : unknown('elevation'),
        duration: formatDuration(trail.hours)
          ? cell(formatDuration(trail.hours)) : unknown('duration'),
        terrain: terrainKnown
          ? cell(TERRAIN[suitability.terrainRank] || `Terrain level ${suitability.terrainRank}`,
            categoryVerified(parts, 'surfaceHazards') ? 'known' : 'mapped',
            categoryVerified(parts, 'surfaceHazards') ? 'Surface evidence reviewed' : 'Mapped terrain; surface hazards not reviewed')
          : unknown('terrain'),
        exposure: categoryVerified(parts, 'exposure')
          ? cell(suitability.exposure ? 'Exposed sections recorded' : 'No exposure recorded in reviewed evidence',
            suitability.exposure ? 'caution' : 'known')
          : unknown('exposure'),
        shade: categoryVerified(parts, 'heat') && Number.isFinite(suitability.shadePercent)
          ? cell(`${Math.round(suitability.shadePercent)}% reviewed shade`,
            suitability.shadePercent < 20 ? 'caution' : 'known')
          : unknown('shade'),
        heat: categoryVerified(parts, 'heat') && ['low','moderate','high'].includes(suitability.heatRisk)
          ? cell(`${suitability.heatRisk[0].toUpperCase()}${suitability.heatRisk.slice(1)} baseline heat risk`,
            suitability.heatRisk === 'high' ? 'caution' : 'known')
          : unknown('heat'),
        water: categoryVerified(parts, 'water')
          ? cell(reviewedWater
            ? `${reviewedWater} reviewed water point${reviewedWater === 1 ? '' : 's'}`
            : 'No usable water point confirmed, carry a full supply',
          reviewedWater ? 'known' : 'caution')
          : unknown('water'),
        hazards: categoryVerified(parts, 'surfaceHazards')
          ? cell(hazards && hazards.length ? hazards.join(' · ') : 'No material surface hazards in reviewed evidence',
            hazards && hazards.length ? 'caution' : 'known')
          : unknown('surface hazards'),
        restrictions: categoryVerified(parts, 'access') && ACCESS[access]
          ? cell(ACCESS[access], ['prohibited','seasonal-restrictions'].includes(access) ? 'caution' : 'known')
          : unknown('dog-access rules'),
        verification: cell(tierLabel(tier), ['imported','mapped'].includes(tier) ? 'mapped' : 'known'),
      },
    };
  }

  return Object.freeze({ categoryLabel, build, cell, unknown });
});
