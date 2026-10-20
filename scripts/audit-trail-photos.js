#!/usr/bin/env node
'use strict';

/**
 * audit-trail-photos — who took each photograph, and under what terms.
 *
 *   npm run audit:trail-photos
 *
 * Read-only. Every trail that shows a picture, grouped by what the record can
 * actually say about it.
 *
 * This was a one-off question on 20 October 2026 and the answer was worth
 * keeping: sixteen Savoy walks were showing a photograph credited to a
 * tourism board or a commercial site -- "Decathlon Outdoor (edited)", "Lac
 * Annecy Tourisme fiche (Apidae)" -- with no licence, creator or terms
 * recorded anywhere. A credit line says where a picture came from. It does
 * not say that anyone may use it.
 *
 * Five of the seventeen turned out to carry their licence in the credit text
 * all along -- Wikimedia Commons, CC BY and CC BY-SA -- and were verified
 * against their source pages and recorded properly. Two are ORMA's own AI
 * illustrations. The rest are still unestablished, and this is how anybody
 * sees which, without reading seventeen JSON blobs.
 */

const path = require('path');
const { loadProductionTrails } = require('./load-production-trails');
const { existingImageFields, NOT_A_PHOTOGRAPH } = require('../backoffice/workflows/build-publication-staging');

function creditText(trail){
  const credit = trail.imageCredit;
  if (typeof credit === 'string') return credit;
  return (credit && credit.text) || trail.imageCreditText || '';
}

function sourceHost(trail){
  const credit = trail.imageCredit;
  const url = (credit && credit.url) || trail.imageSourcePage || '';
  try { return new URL(url).host; } catch { return ''; }
}

/** What the record can say about this trail's picture. */
function standingOf(trail){
  if (!String(trail.imageIcon || '').trim()) return 'no-picture';
  if (NOT_A_PHOTOGRAPH.includes(String(trail.imageSourceType || ''))) return 'illustration';
  const licensed = String(trail.imageLicence || '').trim() && String(trail.imageCreator || '').trim();
  if (!licensed) return 'terms-not-established';
  return existingImageFields(trail) ? 'established' : 'established-but-not-published';
}

function auditTrailPhotos(trails){
  const groups = { established:[], 'established-but-not-published':[], illustration:[],
    'terms-not-established':[], 'no-picture':[] };
  for (const trail of trails) groups[standingOf(trail)].push(trail);
  return groups;
}

function main(root = path.resolve(__dirname, '..')){
  const trails = loadProductionTrails(root);
  const groups = auditTrailPhotos(trails);
  const show = (key, headline) => {
    const rows = groups[key];
    console.log(`\n[photos] ${headline}: ${rows.length}`);
    for (const trail of rows.slice(0, 40)){
      const where = sourceHost(trail);
      console.log(`[photos]   ${trail.id.padEnd(15)}${String(trail.name).slice(0,34).padEnd(36)}`
        + `${String(trail.imageLicence || '—').padEnd(18)}${where || creditText(trail).slice(0, 40)}`);
    }
  };
  console.log(`[photos] ${trails.length} trails.`);
  show('established', 'carry a photograph with its creator and licence recorded');
  show('established-but-not-published', 'have the terms but are short of a hero image or alt text');
  show('illustration', 'show an ORMA illustration, which is not a photograph of the walk');
  show('terms-not-established', 'show a picture whose terms nobody has recorded');
  console.log(`\n[photos] ${groups['no-picture'].length} trails show no picture at all.`);
  if (groups['terms-not-established'].length){
    console.log('[photos] A credit line says where a picture came from. It does not say that');
    console.log('[photos] anyone may use it, and these cannot be published as the trail’s own');
    console.log('[photos] until somebody establishes the terms.');
  }
  console.log('\n[photos] Nothing was changed.');
  return groups;
}

if (require.main === module) main();

module.exports = { standingOf, auditTrailPhotos, creditText, sourceHost, main };
