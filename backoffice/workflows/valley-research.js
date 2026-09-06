'use strict';

/**
 * Valley research: the honest way to verify trails in bulk.
 *
 * 156 of 164 trails are unverified, and each is missing the same three things:
 * a review date, sources for its claims, and a category review. Those are not
 * fields a script can fill; they are the record that a person did the work.
 *
 * What a script *can* do is stop the work being repeated 156 times. Leash
 * rules, alpine pasture and guard-dog seasons, and cable-car dog policies are
 * set per comune or park, so one properly sourced piece of research covers
 * every trail in that valley. The 156 unverified trails span 17 valleys.
 *
 * So: group the trails, state exactly which categories each valley still
 * needs, and let a person record real sources against them. Then write only
 * what those sources actually support. A category is never marked reviewed
 * unless a source in the worksheet declares that it covers it.
 */

// The categories a trail is reviewed against. Kept in step with the
// REVIEW_CATEGORIES the page generator and the campaign planner use.
const REVIEW_CATEGORIES = ['water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'];

const PLACEHOLDER_HOSTS = ['example.com', 'example.org', 'localhost', 'todo', 'tbd'];

function isVerified(trail) {
  return !!(trail && trail.verified && Array.isArray(trail.verified.categories));
}

/** Categories this trail still has no review for. */
function categoriesNeeded(trail) {
  const done = (trail && trail.verified && trail.verified.categories) || [];
  return REVIEW_CATEGORIES.filter(category => !done.includes(category));
}

function valleyOf(trail) {
  return (trail && (trail.valley || trail.area || trail.region)) || '(no valley recorded)';
}

function slug(value) {
  return String(value)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 60);
}

/**
 * Group by valley every trail that still needs a category reviewed, biggest
 * valley first. A partly reviewed trail belongs here too: having "access"
 * recorded says nothing about heat, livestock or exposure.
 */
function groupByValley(trails) {
  const groups = new Map();
  trails.filter(trail => categoriesNeeded(trail).length).forEach(trail => {
    const valley = valleyOf(trail);
    if (!groups.has(valley)) groups.set(valley, []);
    groups.get(valley).push(trail);
  });
  return [...groups.entries()]
    .map(([valley, list]) => {
      const needCounts = {};
      list.forEach(trail => categoriesNeeded(trail).forEach(category => {
        needCounts[category] = (needCounts[category] || 0) + 1;
      }));
      return {
        valley,
        slug: slug(valley),
        trailCount: list.length,
        categoriesNeeded: needCounts,
        trails: list.map(trail => ({
          id: trail.id,
          name: trail.name,
          needs: categoriesNeeded(trail),
        })),
      };
    })
    .sort((a, b) => b.trailCount - a.trailCount || a.valley.localeCompare(b.valley));
}

/** A blank worksheet for one valley: what it needs, and room to record sources. */
function worksheetFor(group) {
  return {
    contractVersion: '1.0.0',
    valley: group.valley,
    trailCount: group.trailCount,
    categoriesNeeded: group.categoriesNeeded,
    trails: group.trails,
    // Fill these in. Each source states which categories it actually covers;
    // nothing is marked reviewed beyond what a source here supports.
    sources: [
      { label: '', url: '', categories: [], note: '' },
    ],
  };
}

/**
 * Refuse anything that would record a review nobody did. Every message names
 * the fix, because this runs against safety copy people rely on.
 */
function validateWorksheet(worksheet) {
  const errors = [];
  if (!worksheet || typeof worksheet !== 'object') return ['The worksheet is not readable JSON.'];
  if (!worksheet.valley) errors.push('The worksheet has no valley name.');

  const sources = Array.isArray(worksheet.sources) ? worksheet.sources : [];
  const filled = sources.filter(source => source && (source.label || source.url || (source.categories || []).length));
  if (!filled.length) errors.push('No sources recorded yet. Add at least one before applying.');

  filled.forEach((source, index) => {
    const at = `Source ${index + 1}`;
    if (!String(source.label || '').trim()) errors.push(`${at}: needs a label naming the publisher.`);
    const url = String(source.url || '').trim();
    if (!/^https:\/\/\S+$/.test(url)) {
      errors.push(`${at}: needs a full https:// URL.`);
    } else if (PLACEHOLDER_HOSTS.some(host => url.toLowerCase().includes(host))) {
      errors.push(`${at}: "${url}" looks like a placeholder, not a real source.`);
    }
    const categories = Array.isArray(source.categories) ? source.categories : [];
    if (!categories.length) errors.push(`${at}: state which categories it covers (${REVIEW_CATEGORIES.join(', ')}).`);
    categories.filter(category => !REVIEW_CATEGORIES.includes(category))
      .forEach(category => errors.push(`${at}: "${category}" is not a review category.`));
  });

  return errors;
}

/** The categories the worksheet's sources genuinely cover, and by which source. */
function coverage(worksheet) {
  const covered = new Map();
  (worksheet.sources || []).forEach(source => {
    (source.categories || []).forEach(category => {
      if (!REVIEW_CATEGORIES.includes(category)) return;
      if (!covered.has(category)) covered.set(category, []);
      covered.get(category).push(source);
    });
  });
  return covered;
}

/**
 * What applying this worksheet would record, per trail. Pure: it decides
 * nothing about files, so the dry run and the write cannot disagree.
 *
 * `reviewedOn` must be the real date the person did the work — the caller
 * passes today, never a date read back from the worksheet.
 */
function planApply(worksheet, trails, reviewedOn) {
  const covered = coverage(worksheet);
  const ids = new Set((worksheet.trails || []).map(entry => entry.id));
  const plans = [];
  const skipped = [];

  trails.filter(trail => ids.has(trail.id)).forEach(trail => {
    const needs = categoriesNeeded(trail);
    if (!needs.length) {
      skipped.push({ id: trail.id, name: trail.name, reason: 'every category already reviewed' });
      return;
    }
    const gained = needs.filter(category => covered.has(category));
    if (!gained.length) {
      skipped.push({ id: trail.id, name: trail.name, reason: 'no source covers what it still needs' });
      return;
    }
    // Only the sources that actually back one of the gained categories are
    // recorded against the trail, so provenance stays truthful per trail.
    const used = [];
    gained.forEach(category => (covered.get(category) || []).forEach(source => {
      if (!used.includes(source)) used.push(source);
    }));
    plans.push({
      id: trail.id,
      name: trail.name,
      categories: gained,
      stillMissing: needs.filter(category => !gained.includes(category)),
      sourceLinks: used.map(source => ({
        label: String(source.label).trim(),
        url: String(source.url).trim(),
        categories: (source.categories || []).filter(category => gained.includes(category)),
      })),
      verified: {
        categories: gained,
        sources: used.map(source => String(source.label).trim()),
        date: reviewedOn,
      },
      reviewedAt: reviewedOn,
      reviewedBy: 'ORMA valley research',
    });
  });

  return { plans, skipped };
}

module.exports = {
  REVIEW_CATEGORIES,
  isVerified,
  categoriesNeeded,
  valleyOf,
  slug,
  groupByValley,
  worksheetFor,
  validateWorksheet,
  coverage,
  planApply,
};
