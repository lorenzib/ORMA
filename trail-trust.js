/**
 * Shared trust language for trail facts.
 *
 * Curated trails have been reviewed by DoloPaws against independent
 * sources. Imported trails are automated interpretations of OpenStreetMap
 * data: mapped facts may be useful, but absence from the map is not evidence
 * that a hazard is absent.
 */
(function (root) {
  'use strict';

  const imported = trail => !!trail && trail.curated === false;
  // The three public tiers a trail can sit in. See VERIFICATION.md ("Trail
  // tiers"). "under-review" is shown but not yet audited; "route-audited"
  // cleared the desk mechanism; "dolopaws-walked" means a human walked it.
  const TIERS = Object.freeze(['under-review', 'route-audited', 'dolopaws-walked']);

  // Single source of truth for a trail's tier. An explicit `trail.tier`
  // (or a `walked` flag) wins; otherwise the tier is derived so it can never
  // contradict the graduation/curation data:
  //   - a fully graduated trail (10/10 checks) is route-audited;
  //   - a hand-curated real listing is route-audited (published, not walked);
  //   - anything imported or still in progress is under-review.
  // No data migration is required — legacy `curated`-only trails resolve
  // correctly, and a trail publishes at whatever tier this returns.
  const hasRoute = trail => !!trail && Array.isArray(trail.path) && trail.path.length >= 2;

  function tierOf(trail) {
    if (root.DoloPawsEvidenceV1) {
      const canonicalTier = root.DoloPawsEvidenceV1.tierOf(trail);
      if (canonicalTier === 'field-verified') return 'dolopaws-walked';
      if (canonicalTier === 'route-audited') return 'route-audited';
      return 'under-review';
    }
    if (!trail) return 'under-review';
    let tier;
    if (TIERS.includes(trail.tier)) tier = trail.tier;
    else if (trail.walked === true) tier = 'dolopaws-walked';
    else {
      const graduation = graduationProgress(trail);
      if (graduation && graduation.verified) tier = 'route-audited';
      else tier = trail.curated === false ? 'under-review' : 'route-audited';
    }
    // Invariant: the published DoloPaws tiers claim the *route* was audited or
    // walked, so they require a mapped route. A trail with no `path` (a
    // viewpoint or place listing) has no route to audit — cap it at
    // under-review no matter what its flags say.
    if ((tier === 'route-audited' || tier === 'dolopaws-walked') && !hasRoute(trail)) {
      return 'under-review';
    }
    return tier;
  }

  // Short tier badge text — the headline label a visitor sees on a card or
  // trail page. The fuller `provenanceLabel` (below) adds progress/date detail.
  function tierLabel(trail) {
    const tier = tierOf(trail);
    if (tier === 'dolopaws-walked') return 'Walked by DoloPaws';
    if (tier === 'route-audited') return 'Reviewed by DoloPaws';
    return 'Trail overview';
  }

  // Badge visual style per tier, reusing the existing pill styles: under-review
  // keeps the muted "imported" look, the two DoloPaws tiers use the "verified" look.
  function tierBadgeStyle(trail) {
    return tierOf(trail) === 'under-review' ? 'imported' : 'verified';
  }

  const REVIEW_CATEGORIES = Object.freeze(['water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access']);
  const GRADUATION_CATEGORIES = Object.freeze(['photo', 'route', 'mapPoints', 'elevation', ...REVIEW_CATEGORIES]);
  const hasSourceReview = trail => !!(trail && trail.verified && Array.isArray(trail.verified.categories));
  const categoryVerified = (trail, category) => !hasSourceReview(trail) || trail.verified.categories.includes(category);

  function reviewProgress(trail) {
    if (!hasSourceReview(trail)) return null;
    const checked = REVIEW_CATEGORIES.filter(category => trail.verified.categories.includes(category));
    return { checked: checked.length, total: REVIEW_CATEGORIES.length, categories: checked };
  }

  function graduationProgress(trail) {
    if (!trail || !trail.graduation || !Array.isArray(trail.graduation.completed)) return null;
    const required = Array.isArray(trail.graduation.required) && trail.graduation.required.length
      ? trail.graduation.required
      : GRADUATION_CATEGORIES;
    const completed = required.filter(check => trail.graduation.completed.includes(check));
    return {
      completed: completed.length,
      total: required.length,
      checks: completed,
      blockers: trail.graduation.blockers || {},
      verified: trail.graduation.status === 'verified' && completed.length === required.length,
    };
  }

  function formatReviewDate(value) {
    if (root.DoloPawsEvidenceV1) return root.DoloPawsEvidenceV1.dateText(value);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return String(value || 'date unavailable');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
  }

  function translate(key, vars, fallback) {
    const out = typeof root.t === 'function' ? root.t(key, vars) : null;
    if (out && out !== key) return out;
    return Object.entries(vars || {}).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, value),
      fallback
    );
  }

  function riskLabel(trail, baseLabel) {
    return baseLabel;
  }

  function provenanceLabel(trail) {
    return tierLabel(trail);
  }

  function waterPointLabel(trail, label) {
    if (!categoryVerified(trail, 'water')) return `${String(label || 'Potential water location')} — availability can change`;
    if (!imported(trail)) return label;
    return String(label || 'Water point')
      .replace(/Drinking water\s*\(OSM-verified location\)/i, 'Water point mapped in OpenStreetMap')
      .replace(/OSM-verified/gi, 'mapped in OpenStreetMap');
  }

  function startPointLabel(trail, label) {
    if (!categoryVerified(trail, 'access')) return `Suggested start — ${String(label || 'route start').replace(/^Start here\s*[—-]\s*/i, '')}. Check current access before travelling.`;
    if (!imported(trail)) return label;
    const cleaned = String(label || 'Route start')
      .replace(/^Start here\s*[—-]\s*/i, '')
      .replace(/^Route start per OpenStreetMap\s*[—-]\s*/i, '')
      .replace(/\s*\(OSM-verified access point\)/gi, '')
      .replace(/OSM-verified/gi, 'mapped in OpenStreetMap');
    return `Mapped start suggestion — ${cleaned}. Check current access before travelling.`;
  }

  function waterAssessment(trail) {
    const mapped = Array.isArray(trail.waterSources) && trail.waterSources.length > 0;
    if (!categoryVerified(trail, 'water')) {
      return { ok: false, title: 'Bring your own water', detail: 'Do not rely on potential water locations being available or drinkable. Carry enough for the full walk.' };
    }
    if (imported(trail)) {
      return mapped
        ? { ok: false, title: 'Bring backup water', detail: 'A potential water point appears on the map, but availability can change. Carry enough for the full walk.' }
        : { ok: false, title: 'Bring your own water', detail: 'No water point appears on the route map. Carry enough for the full walk.' };
    }
    return mapped
      ? { ok: true, title: 'Water', detail: 'A reviewed water point is listed on this route. Seasonal availability can change, so bring a backup supply.' }
      : { ok: false, title: 'Water', detail: 'No water source is listed for this route. Carry enough for the dog, roughly 0.5 l per 10 kg on a warm day.' };
  }

  function heatAssessment(trail) {
    const shade = typeof trail.shadeCoverage === 'number' ? trail.shadeCoverage : null;
    if (!categoryVerified(trail, 'heat')) {
      return { ok: false, title: 'Plan for limited shade', detail: 'Use the live forecast, choose a cool walking window and plan as if exposed sections may have little shade.' };
    }
    if (imported(trail) && shade === null && !trail.heatRisk && trail.shadeDescription) {
      return { ok: false, title: 'Mixed shade', detail: `${trail.shadeDescription} Use the live forecast and plan exposed sections for a cool window.` };
    }
    if (imported(trail) && shade === null && !trail.heatRisk) {
      return { ok: false, title: 'Plan for limited shade', detail: 'Use the live forecast, choose a cool walking window and plan as if exposed sections may have little shade.' };
    }
    if (shade === null && !trail.heatRisk) return null;
    const shadeText = shade === null ? '' : `${shade}% shade`;
    const highHeat = trail.heatRisk === 'high' || (shade !== null && shade < 25);
    const lowHeat = trail.heatRisk === 'low' && (shade === null || shade >= 40);
    const detail = highHeat
      ? `${shadeText ? shadeText + '. ' : ''}The route is heat-exposed; use the live forecast to choose an early, cool window.`
      : lowHeat
        ? `${shadeText ? shadeText + '. ' : ''}The route has relatively favourable heat exposure.`
        : `${shadeText ? shadeText + '. ' : ''}Plan rests and use the live forecast to choose a cooler window.`;
    return { ok: !highHeat, title: 'Heat & shade', detail };
  }

  function exposureAssessment(trail) {
    if (trail.exposure === true) {
      return { ok: false, title: 'Exposed sections', detail: 'Narrow ledges or unprotected drop-offs occur on parts of the route. Keep the dog leashed and on the inside.' };
    }
    return null;
  }

  function livestockAssessment(trail, combinedText) {
    const noted = /livestock|patou|guardian|cattle|herd|pasture|alpage|graz/.test(combinedText || '');
    if (noted) {
      return { ok: false, title: 'Livestock & leash', detail: 'Grazing animals, possibly with guardian dogs, are reported on or near this route. Leash through pastures and give herds a wide berth.' };
    }
    return null;
  }

  function surfaceAssessment(trail) {
    if (Number(trail.terrainRank) === 0 && !(trail.surfaceHazards || []).length) return null;
    const hazards = Array.isArray(trail.surfaceHazards) && trail.surfaceHazards.length
      ? ` Reported hazards: ${trail.surfaceHazards.join('; ')}.`
      : '';
    return { ok: false, title: 'Surface & footing', detail: `${trail.terrainType || 'Variable mountain terrain'}.${hazards} Check pads at breaks and consider booties for tender paws.` };
  }

  function assessmentNote(trail) {
    return '<strong style="color: var(--ink);">Trail planning information:</strong> based on mapped route data and available DoloPaws sources. Conditions can change, so check locally before setting out.';
  }

  root.DoloPawsTrailTrust = Object.freeze({
    imported,
    TIERS,
    tierOf,
    tierLabel,
    tierBadgeStyle,
    categoryVerified,
    reviewProgress,
    graduationProgress,
    formatReviewDate,
    riskLabel,
    provenanceLabel,
    waterPointLabel,
    startPointLabel,
    waterAssessment,
    heatAssessment,
    exposureAssessment,
    livestockAssessment,
    surfaceAssessment,
    assessmentNote,
  });
})(window);
