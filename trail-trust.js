/**
 * Shared trust language for trail facts.
 *
 * Curated trails have been reviewed by ORMA against independent
 * sources. Imported trails are automated interpretations of OpenStreetMap
 * data: mapped facts may be useful, but absence from the map is not evidence
 * that a hazard is absent.
 */
(function (root) {
  'use strict';

  // Script-written wording goes through i18n.js; the English sentence is its own key.
  function tx(text, vars) {
    const i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
    if (i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
    return vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : text;
  }

  // A trail's own words in the reader's language, from data/trail-text-it.
  // Anything sorted or matched on (hazard kinds, rough ground) reads the English.
  function trailWords(text) {
    const i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
    return i18n && typeof i18n.trailText === 'function' ? i18n.trailText(text) : text;
  }

  const imported = trail => !!trail && trail.curated === false;
  // A day hike tops out around here; beyond it a route is a multi-day itinerary
  // (or a whole trail network imported as one line), which most visitors are not
  // looking for. These are classified as multi-day and kept out of the default
  // day-hike lists, reachable through the "Multi-day" filter.
  const MULTI_DAY_MIN_KM = 25;
  const isMultiDay = trail => !!trail && Number(trail.distance) > MULTI_DAY_MIN_KM;
  // The three public tiers a trail can sit in. See VERIFICATION.md ("Trail
  // tiers"). "under-review" is shown but not yet audited; "route-audited"
  // cleared the desk mechanism; "dolopaws-walked" means a human walked it.
  const TIERS = Object.freeze(['under-review', 'route-reviewed', 'route-audited', 'dolopaws-walked']);

  // Single source of truth for a trail's tier. An explicit `trail.tier`
  // (or a `walked` flag) wins; otherwise the tier is derived so it can never
  // contradict the graduation/curation data:
  //   - a fully graduated trail (10/10 checks) is route-audited;
  //   - a hand-curated real listing is route-audited (published, not walked);
  //   - anything imported or still in progress is under-review.
  // No data migration is required, legacy `curated`-only trails resolve
  // correctly, and a trail publishes at whatever tier this returns.
  const hasRoute = trail => !!trail && Array.isArray(trail.path) && trail.path.length >= 2;

  function tierOf(trail) {
    if (root.DoloPawsEvidenceV1) {
      const canonicalTier = root.DoloPawsEvidenceV1.tierOf(trail);
      if (canonicalTier === 'field-verified') return 'dolopaws-walked';
      if (canonicalTier === 'route-audited') return 'route-audited';
      // `mapped` is a route reviewed by ORMA but not yet field-verified. On a
      // curated listing that reads "Reviewed by ORMA"; on an imported one it is
      // still just imported map data.
      if (canonicalTier === 'mapped') return trail && trail.curated === false ? 'under-review' : 'route-reviewed';
      return 'under-review';
    }
    if (!trail) return 'under-review';
    let tier;
    if (TIERS.includes(trail.tier)) tier = trail.tier;
    else if (trail.walked === true) tier = 'dolopaws-walked';
    else {
      const graduation = graduationProgress(trail);
      // The verified seal is earned by a graduated evidence dossier, never by
      // curation alone; a curated-but-unverified listing is "route-reviewed".
      if (graduation && graduation.verified) tier = 'route-audited';
      else tier = trail.curated === false ? 'under-review' : 'route-reviewed';
    }
    // Invariant: the published ORMA tiers claim the *route* was audited or
    // walked, so they require a mapped route. A trail with no `path` (a
    // viewpoint or place listing) has no route to audit, cap it at
    // under-review no matter what its flags say.
    if ((tier === 'route-audited' || tier === 'dolopaws-walked' || tier === 'route-reviewed') && !hasRoute(trail)) {
      return 'under-review';
    }
    return tier;
  }

  // The dictionary lookup when a page has one (i18n.js exposes `t` globally);
  // tests and the build have none, and then the English here stands.
  function translated(key, fallback) {
    const g = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
    const t = g && typeof g.t === 'function' ? g.t : null;
    if (t) {
      const value = t(key);
      if (value && value !== key) return value;
    }
    return fallback;
  }

  // Short tier badge text, the headline label a visitor sees on a card or
  // trail page. The fuller `provenanceLabel` (below) adds progress/date detail.
  function tierLabel(trail) {
    const tier = tierOf(trail);
    if (tier === 'dolopaws-walked' || tier === 'route-audited') return translated('tier.routeAudited', 'Verified by ORMA');
    if (tier === 'route-reviewed') return translated('tier.reviewed', 'Reviewed by ORMA');
    return translated('tier.imported', 'Not yet verified');
  }

  // Badge visual style per tier. Only an earned verification gets the green
  // "verified" pill; a reviewed-but-not-verified listing takes the muted
  // "neutral" pill so the seal is never mistaken for field verification, and an
  // imported trail keeps the "imported" look.
  function tierBadgeStyle(trail) {
    const tier = tierOf(trail);
    if (tier === 'dolopaws-walked' || tier === 'route-audited') return 'verified';
    if (tier === 'route-reviewed') return 'neutral';
    return 'imported';
  }

  const REVIEW_CATEGORIES = Object.freeze(['water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access']);
  // The eleven checks, in the order the desk and the board list them. This is
  // only the fallback for a record that names no `required` list; it said ten
  // for months because it had left out routeNumbers, the directions check.
  const GRADUATION_CATEGORIES = Object.freeze(['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', ...REVIEW_CATEGORIES]);
  const hasSourceReview = trail => !!(trail && trail.verified && Array.isArray(trail.verified.categories));
  // An absent `verified` field means no category review is recorded, so no
  // category is verified. Defaulting the other way let an unreviewed trail
  // skip every caveat and describe its water as reviewed, which VERIFICATION.md
  // explicitly forbids: only a full six-category record may be called verified.
  const categoryVerified = (trail, category) => hasSourceReview(trail) && trail.verified.categories.includes(category);

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
    if (!match) return String(value || tx('date unavailable'));
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

  // Machine wording a reader should never see, and the prefixes a sentence has
  // to lose before another one is put in front of it.
  //
  // The separator class lists the colon. It did not, and every label in the
  // catalogue writes "Start here: parking du lac", so a start point that was
  // not reviewed printed "Suggested start, Start here: parking du lac" on seven
  // pages. The cleanup also runs on the reviewed-but-unresearched branch now;
  // before, "(OSM-verified access point)" reached the page whole.
  // The label is translated first (trailWords), so the Italian forms of the
  // importer's prefix and tag are trimmed too.
  const plainStartLabel = label => String(label || 'route start')
    .replace(/^Start here\s*[,.:;—–-]*\s*/i, '')
    .replace(/^(?:Parti da qui|Partenza qui)\s*[,.:;—–-]*\s*/i, '')
    .replace(/^(?:Route start per OpenStreetMap|Partenza del percorso secondo OpenStreetMap)\s*[,.:;—–-]*\s*/i, '')
    .replace(/\s*\((?:OSM-verified access point|punto di accesso verificato su OSM)\)/gi, '')
    .replace(/OSM-verified/gi, 'mapped in OpenStreetMap');

  // A reviewed point keeps its own name but loses the importer's tag. "(OSM-
  // verified location)" printed on 46 live pages, eight of them trails without
  // the seal, and a reader takes "verified" next to ORMA's name as ORMA's.
  const withoutOsmTag = label => String(label || '')
    .replace(/\s*\((?:OSM-verified|punto di accesso verificato su OSM)[^)]*\)/gi, '')
    .replace(/OSM-verified/gi, 'mapped in OpenStreetMap')
    .trim();

  function waterPointLabel(trail, label) {
    const base = String(label || tx('Water point'))
      .replace(/Drinking water\s*\(OSM-verified location\)/i, 'Water point mapped in OpenStreetMap')
      .replace(/OSM-verified/gi, 'mapped in OpenStreetMap');
    // A fixed name is the phrase table's; any other is the trail's own words.
    const shown = /^Water point(?: mapped in OpenStreetMap)?$/.test(base) ? tx(base) : trailWords(base);
    if (!categoryVerified(trail, 'water')) return tx('{label}, availability can change', { label: shown });
    return imported(trail) ? shown : trailWords(withoutOsmTag(label));
  }

  // Several real fountains in one village square are separate OSM nodes, but
  // the importer rounds each to the nearest 0.1 km, so on 3 November 2026 67 of
  // 427 published trails printed the same line more than once ("km 0 ·
  // Drinking water" four times on Dorfrundweg - Giro del Paese). The points
  // stay in the data for the map; a list shows each km and label once, with
  // how many points it stands for.
  function waterLines(trail, sources, labelFor = waterPointLabel) {
    const lines = new Map();
    for (const point of Array.isArray(sources) ? sources : []) {
      if (!point) continue;
      const label = labelFor(trail, point.label || point.name);
      const key = `${point.km}|${label}`;
      if (lines.has(key)) lines.get(key).count += 1;
      else lines.set(key, { km: point.km, label, count: 1 });
    }
    return [...lines.values()];
  }

  function startPointLabel(trail, label) {
    label = trailWords(label);
    if (!categoryVerified(trail, 'access') && !imported(trail)) {
      return tx('Suggested start, {place}. Check current access before travelling.', { place: plainStartLabel(label) });
    }
    if (!imported(trail)) return withoutOsmTag(label);
    return tx('Suggested start from map data, {place}. Check current access before travelling.', { place: plainStartLabel(label) });
  }

  function waterAssessment(trail) {
    const mapped = Array.isArray(trail.waterSources) && trail.waterSources.length > 0;
    if (!categoryVerified(trail, 'water')) {
      return { ok: false, title: tx('Bring your own water'), detail: tx('Don’t count on water along the way. Carry enough for the whole walk.') };
    }
    if (imported(trail)) {
      return mapped
        ? { ok: false, title: tx('Bring backup water'), detail: tx('A water point is on the map, but it may be dry. Carry enough for the whole walk.') }
        : { ok: false, title: tx('Bring your own water'), detail: tx('No water on the map. Carry enough for the whole walk.') };
    }
    return mapped
      ? { ok: true, title: tx('Water'), detail: tx('A reviewed water point is listed on this route. Seasonal availability can change, so bring a backup supply.') }
      : { ok: false, title: tx('Water'), detail: tx('No water on the way. Carry about 0.5 l per 10 kg of dog on a warm day.') };
  }

  // The walk-day forecast, read by the same rule the score uses, so this
  // section and the score cannot disagree about whether today is warm. No
  // forecast (or no engine) means nothing is assumed: the summer reading stays.
  const engine = () => root.DoloPawsRecommendationV1 || null;
  const coolDay = conditions => !!(engine() && engine().isCoolDay(conditions));
  const coldDay = conditions => !!(engine() && engine().isColdDay(conditions));
  const heatOnly = hazard => !!(engine() && engine().isHeatOnlyHazard(hazard));

  // Recorded cautions arrive as one list. Cars and bikes are not something a
  // dog walks on, so they are told apart from what is underfoot, and a caution
  // that is only about heat ("Hot tarmac") belongs with heat.
  // A bare "crossing" is not traffic: "stream crossings" are underfoot.
  const TRAFFIC_HAZARD = /\b(?:roads?|traffic|cars?|vehicles?|tractors?|cycl\w*|bikes?|streets?|zebra|SS\d+|SP\d+|km\/h)\b/i;
  const LIVESTOCK_HAZARD = /\b(?:livestock|cattle|cows?|herds?|graz\w*|sheep|goats?|pastures?|alpage|patou|guardian dogs?)\b/i;
  const GROUND_HAZARD = /\b(?:scree|roots?|rock\w*|stony|stones|boulders?|slipp\w*|uneven|loose|mud\w*|steps|ladders?|grid|tarmac|stream crossings?|unbridged|without bridges|wet)\b/i;
  function recordedHazards(trail) {
    const tidy = hazard => String(hazard || '').trim().replace(/[.;]+$/, '');
    const all = (Array.isArray(trail && trail.surfaceHazards) ? trail.surfaceHazards : [])
      .map(hazard => ({ en: tidy(hazard), shown: tidy(trailWords(hazard)) }))
      .filter(hazard => hazard.en);
    const heat = all.filter(hazard => heatOnly(hazard.en));
    const rest = all.filter(hazard => !heat.includes(hazard));
    const shown = list => list.map(hazard => hazard.shown);
    const traffic = rest.filter(hazard => TRAFFIC_HAZARD.test(hazard.en));
    const livestock = rest.filter(hazard => !traffic.includes(hazard) && LIVESTOCK_HAZARD.test(hazard.en));
    const left = rest.filter(hazard => !traffic.includes(hazard) && !livestock.includes(hazard));
    return {
      heat: shown(heat),
      traffic: shown(traffic),
      livestock: shown(livestock),
      underfoot: shown(left.filter(hazard => GROUND_HAZARD.test(hazard.en))),
      other: shown(left.filter(hazard => !GROUND_HAZARD.test(hazard.en))),
    };
  }

  function heatAssessment(trail, conditions) {
    const shade = typeof trail.shadeCoverage === 'number' ? trail.shadeCoverage : null;
    // A cool day makes the route's sun exposure irrelevant; a cold one turns
    // the advice the other way.
    if (coldDay(conditions)) {
      return { ok: false, title: tx('Cold day'), guide: null, detail: tx('Up to {temp} °C today. Keep rests short, dry your dog off, and bring a coat for a small or short-haired dog.', { temp: conditions.dayMaxC }) };
    }
    if (coolDay(conditions)) {
      return { ok: true, title: tx('Heat & shade'), detail: tx('The forecast stays cool, up to {temp} °C, so sun and shade do not matter for this walk.', { temp: conditions.dayMaxC }) };
    }
    const hot = recordedHazards(trail).heat;
    const withHot = result => (result && hot.length && !result.ok ? { ...result, items: hot } : result);
    return withHot(summerHeat(trail, shade));
  }

  function summerHeat(trail, shade) {
    if (!categoryVerified(trail, 'heat')) {
      return { ok: false, title: tx('Plan for limited shade'), detail: tx('Expect little shade. Walk in the cool part of the day.') };
    }
    if (imported(trail) && shade === null && !trail.heatRisk && trail.shadeDescription) {
      return { ok: false, title: tx('Mixed shade'), detail: `${trailWords(trail.shadeDescription)} ${tx('Walk the open stretches in the cool part of the day.')}` };
    }
    if (imported(trail) && shade === null && !trail.heatRisk) {
      return { ok: false, title: tx('Plan for limited shade'), detail: tx('Expect little shade. Walk in the cool part of the day.') };
    }
    if (shade === null && !trail.heatRisk) return null;
    const shadeText = shade === null ? '' : tx('{n}% shade', { n: shade });
    const highHeat = trail.heatRisk === 'high' || (shade !== null && shade < 25);
    const lowHeat = trail.heatRisk === 'low' && (shade === null || shade >= 40);
    const detail = highHeat
      ? `${shadeText ? shadeText + '. ' : ''}${tx('Little shade. Go early on warm days.')}`
      : lowHeat
        ? `${shadeText ? shadeText + '. ' : ''}${tx('The route has relatively favourable heat exposure.')}`
        : `${shadeText ? shadeText + '. ' : ''}${tx('Plan rests and pick a cool time of day.')}`;
    return { ok: !highHeat, title: tx('Heat & shade'), detail };
  }

  function exposureAssessment(trail) {
    if (trail.exposure === true) {
      return { ok: false, title: tx('Exposed sections'), detail: tx('Narrow ledges and drops in places. Keep your dog on a lead, on the inside.') };
    }
    return null;
  }

  // Grazing animals: one lead line; guardian dogs only when the walk says so.
  function livestockAssessment(trail, combinedText) {
    const text = combinedText || '';
    const items = recordedHazards(trail).livestock;
    if (!items.length && !/livestock|patou|guardian|cattle|herd|pasture|alpage|graz/.test(text)) return null;
    const guardians = /patou|guardian/i.test(text);
    const detail = tx('Keep your dog on a lead near herds and give them space.')
      + (guardians ? ' ' + tx('Watch for guardian dogs.') : '');
    return { ok: false, title: tx('Grazing animals'), detail, items };
  }

  // OSM surface tags in plain words. Several tags read the same to a walker
  // (unpaved, dirt, natural ground), so they are added together.
  const SURFACE_WORDS = [
    [/^(?:paved|asphalt|concrete|paving stones)$/, 'tarmac'],
    [/^(?:stone setts|sett|cobblestone)$/, 'cobbles'],
    [/gravel|pebblestone|compacted/, 'gravel'],
    [/^(?:unpaved|dirt|earth|ground|natural ground|mud)$/, 'dirt'],
    [/^grass$/, 'grass'],
    [/^(?:rock|rocky)$/, 'rock'],
    [/^sand$/, 'sand'],
  ];
  function listWords(words) {
    if (words.length < 2) return words[0] || '';
    return tx('{list} and {last}', { list: words.slice(0, -1).join(', '), last: words[words.length - 1] });
  }
  function plainGround(terrainType) {
    const raw = String(terrainType || '').trim();
    if (!raw || /not yet field-verified/i.test(raw)) return tx('Mixed ground');
    if (/from OSM surface data/i.test(raw)) {
      const shares = new Map();
      for (const [, tag, pct] of raw.matchAll(/([a-z][a-z ]*?)\s*\((\d+)%\)/gi)) {
        const hit = SURFACE_WORDS.find(([test]) => test.test(tag.trim().toLowerCase()));
        if (hit) shares.set(hit[1], (shares.get(hit[1]) || 0) + Number(pct));
      }
      const ranked = [...shares].sort((a, b) => b[1] - a[1]);
      const kept = ranked.filter(([, pct], index) => index === 0 || pct >= 20).map(([word]) => tx(word));
      return kept.length ? tx('Mostly {ground}', { ground: listWords(kept) }) : tx('Mixed ground');
    }
    const shown = String(trailWords(raw)).trim().replace(/[.;]+$/, '').replace(/:\s+/, ', ');
    return shown.charAt(0).toUpperCase() + shown.slice(1);
  }

  // What is underfoot in plain words, then any rough spots the walk records.
  // Pad advice fits the ground: rough ground cuts pads, smooth ground does not.
  function surfaceAssessment(trail) {
    const underfoot = recordedHazards(trail).underfoot;
    if (Number(trail.terrainRank) === 0 && !underfoot.length) return null;
    const ground = String(trail.terrainType || '');
    const rough = Number(trail.terrainRank) > 0 || /rock|scree|stony|stones|boulder|roots/i.test(ground);
    const detail = `${plainGround(trail.terrainType)}.` + (rough ? ' ' + tx('Check paws at breaks.') : '');
    return { ok: false, title: tx('Ground'), detail, items: underfoot };
  }

  // Roads, tractors and bikes: a lead question, not a paw question.
  function trafficAssessment(trail) {
    const traffic = recordedHazards(trail).traffic;
    if (!traffic.length) return null;
    return { ok: false, title: tx('Traffic'), detail: tx('Short lead where vehicles pass.'), items: traffic };
  }

  // Anything else the walk records (ruins, snow, a lift to check) as its own
  // card, rather than filed under the ground.
  function alongTheWayAssessment(trail) {
    const other = recordedHazards(trail).other;
    if (!other.length) return null;
    return { ok: false, title: tx('Also watch for'), detail: '', guide: null, items: other };
  }

  function assessmentNote(trail) {
    return '<strong style="color: var(--ink);">' + tx('Trail planning information:') + '</strong> ' + tx('based on map data and ORMA’s own sources. Conditions can change, so check locally before setting out.');
  }

  root.DoloPawsTrailTrust = Object.freeze({
    imported,
    MULTI_DAY_MIN_KM,
    isMultiDay,
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
    waterLines,
    startPointLabel,
    waterAssessment,
    heatAssessment,
    exposureAssessment,
    livestockAssessment,
    surfaceAssessment,
    trafficAssessment,
    alongTheWayAssessment,
    plainGround,
    assessmentNote,
  });
})(window);
