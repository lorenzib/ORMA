#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.createContext(context);

for (const file of ['trails-data.js', 'osm-trails-data.js', 'osm-trails-savoy-data.js', 'trail-audits.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename:file });
}

const trails = vm.runInContext('trails', context);
const reviewed = trails.filter(t => t.curated !== false);
const imported = trails.filter(t => t.curated === false);
const missing = (list, field) => list.filter(t => t[field] === undefined || t[field] === null).length;
const risks = list => Object.fromEntries(['low-risk', 'moderate', 'caution'].map(level => [level, list.filter(t => t.safetyLevel === level).length]));
const reviewCategories = ['water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'];
const graduationCategories = ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', ...reviewCategories];
const sourceReviewed = trails.filter(t => t.verified && Array.isArray(t.verified.categories));
const graduationReviewed = trails.filter(t => t.graduation && Array.isArray(t.graduation.completed));

const report = {
  total: trails.length,
  reviewed: {
    count: reviewed.length,
    missingReviewDate: missing(reviewed, 'reviewedAt'),
    missingCoreSource: missing(reviewed, 'source'),
    missingShade: missing(reviewed, 'shadeCoverage'),
    missingHeat: missing(reviewed, 'heatRisk'),
    riskRatings: risks(reviewed),
  },
  imported: {
    count: imported.length,
    missingExposure: missing(imported, 'exposure'),
    missingShade: missing(imported, 'shadeCoverage'),
    missingHeat: missing(imported, 'heatRisk'),
    missingElevation: missing(imported, 'elevation'),
    missingDuration: missing(imported, 'hours'),
    riskRatings: risks(imported),
  },
  sourceReviews: {
    count: sourceReviewed.length,
    complete: sourceReviewed.filter(t => reviewCategories.every(category => t.verified.categories.includes(category))).length,
    partial: sourceReviewed.filter(t => !reviewCategories.every(category => t.verified.categories.includes(category))).length,
    byCategory: Object.fromEntries(reviewCategories.map(category => [category, sourceReviewed.filter(t => t.verified.categories.includes(category)).length])),
  },
  graduation: {
    inProgress: graduationReviewed.filter(t => t.graduation.status !== 'verified').length,
    verified: graduationReviewed.filter(t => t.graduation.status === 'verified').length,
  },
};

console.log(JSON.stringify(report, null, 2));

const invalid = trails.filter(t =>
  !t.id || !t.name || !Number.isFinite(Number(t.distance)) ||
  !['low-risk', 'moderate', 'caution'].includes(t.safetyLevel)
);
const invalidSourceReviews = sourceReviewed.filter(t =>
  !t.reviewedAt || !Array.isArray(t.sourceLinks) || !t.sourceLinks.length ||
  t.verified.categories.some(category => !reviewCategories.includes(category))
);
const invalidGraduations = graduationReviewed.filter(t => {
  const required = Array.isArray(t.graduation.required) ? t.graduation.required : graduationCategories;
  const completed = t.graduation.completed;
  const hasUnknownCheck = required.some(check => !graduationCategories.includes(check));
  const allComplete = required.every(check => completed.includes(check));
  const modernRouteNumbersComplete = completed.includes('routeNumbers');
  const safetyMirrored = reviewCategories.every(category =>
    !completed.includes(category) || (t.verified && t.verified.categories.includes(category))
  );
  if (t.graduation.status === 'verified') return hasUnknownCheck || !allComplete || !modernRouteNumbersComplete || !safetyMirrored || t.curated === false;
  // Existing curated trails may re-enter verification when a new mandatory
  // check is introduced (for example authoritative route-number guidance).
  return hasUnknownCheck || !safetyMirrored;
});

if (invalid.length || invalidSourceReviews.length || invalidGraduations.length) {
  if (invalid.length) console.error(`\n${invalid.length} trails are missing an id, name, distance, or valid safety rating.`);
  if (invalidSourceReviews.length) console.error(`\n${invalidSourceReviews.length} source-reviewed trails have invalid categories, no review date, or no source links.`);
  if (invalidGraduations.length) console.error(`\n${invalidGraduations.length} trails violate the imported-to-verified graduation gates.`);
  process.exitCode = 1;
} else {
  console.log('\nCore trail records are structurally valid. Missing observations must remain labelled unknown until reviewed.');
}
