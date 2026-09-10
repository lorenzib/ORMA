#!/usr/bin/env node
'use strict';

/**
 * report-artifact-sizes — which backoffice artifact is about to break the
 * worker, and which part of it grew.
 *
 *   npm run backoffice:artifact-sizes
 *   npm run backoffice:artifact-sizes -- --artifact dossier-review-queue
 *
 * Read-only. Every artifact is one JSON string in a document's `data`
 * property, and Firestore refuses any property over 1,048,487 bytes; on
 * 2026-09-10 the worker began failing every pass on exactly that, with an
 * error that names the property and nothing else.
 *
 * Reads the collection directly rather than through getArtifact, because the
 * question is the stored size and getArtifact hands back parsed data with the
 * encoding already gone.
 */

const { FirestoreBackofficeStore } = require('../services/firestore-backoffice-store');
const { PROPERTY_LIMIT, WARN_RATIO, measureArtifact } = require('../workflows/artifact-size');

function parseArgs(argv) {
  let artifact = null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--artifact') artifact = argv[index += 1];
  }
  return { artifact };
}

function kb(value) {
  return `${(value / 1024).toFixed(1)} KB`;
}

function bar(ratio) {
  const filled = Math.min(20, Math.round(ratio * 20));
  return `${'#'.repeat(filled)}${'.'.repeat(20 - filled)}`;
}

/** The stored size is the encoded string's, not the parsed object's. */
function storedSize(document) {
  const raw = document.data;
  if (typeof raw === 'string') return Buffer.byteLength(raw, 'utf8');
  return Buffer.byteLength(JSON.stringify(raw) || '', 'utf8');
}

function parsed(document) {
  const raw = document.data;
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch (error) { return null; }
}

async function main(options = {}) {
  const { artifact } = parseArgs(options.argv || process.argv.slice(2));
  const store = options.store || new FirestoreBackofficeStore();
  const snapshot = await store.db.collection('backofficeArtifacts').get();

  const rows = snapshot.docs
    .map(doc => ({ id: doc.id, size: storedSize(doc.data()), doc: doc.data() }))
    .sort((a, b) => b.size - a.size);

  console.log(`[sizes] ${rows.length} artifact(s). Firestore refuses any one over ${kb(PROPERTY_LIMIT)}.\n`);
  rows.forEach(row => {
    const ratio = row.size / PROPERTY_LIMIT;
    const flag = ratio > 1 ? '  OVER THE LIMIT — every write of this fails'
      : ratio > WARN_RATIO ? '  close to the limit'
      : '';
    console.log(`  ${bar(ratio)} ${String(Math.round(ratio * 100)).padStart(3)}%  ${kb(row.size).padStart(10)}  ${row.id}${flag}`);
  });

  // The worst one, or the named one, broken down. A total says there is a
  // problem; this says what to do about it.
  const target = artifact ? rows.find(row => row.id === artifact) : rows[0];
  if (!target) {
    console.error(`\n[sizes] No artifact named "${artifact}".`);
    process.exitCode = 1;
    return { rows: rows.length };
  }
  const data = parsed(target.doc);
  if (data === null) {
    console.log(`\n[sizes] ${target.id} could not be parsed, so it cannot be broken down.`);
    return { rows: rows.length };
  }

  const report = measureArtifact(data);
  console.log(`\n[sizes] Inside ${target.id} (${kb(report.total)}):\n`);
  report.parts.forEach(part => {
    const share = Math.round((part.bytes / report.total) * 100);
    const count = part.count === null ? '' : ` · ${part.count} entries`;
    console.log(`  ${String(share).padStart(3)}%  ${kb(part.bytes).padStart(10)}  ${part.key}${count}`);
  });

  const heavy = report.heaviestArray;
  if (heavy) {
    console.log(`\n[sizes] ${heavy.key}: ${heavy.count} entries, ${kb(heavy.meanBytes)} each on average.`);
    console.log('        Biggest entries:');
    heavy.biggest.forEach(entry => console.log(`          ${kb(entry.bytes).padStart(10)}  ${entry.label}`));
    console.log('        Where the bytes are, across all entries:');
    heavy.fields.forEach(field => {
      const share = Math.round((field.bytes / heavy.bytes) * 100);
      console.log(`          ${String(share).padStart(3)}%  ${kb(field.bytes).padStart(10)}  ${field.field}`);
    });
    // The two shapes need opposite fixes, so name which one this is.
    const dominant = heavy.fields[0];
    if (dominant && dominant.bytes / heavy.bytes > 0.5) {
      console.log(`\n[sizes] One field, "${dominant.field}", is most of it. Trim or stop storing that field.`);
    } else {
      console.log('\n[sizes] The weight is spread across entries. Keep fewer of them.');
    }
  }
  console.log('\n[sizes] Nothing was changed.');
  return { rows: rows.length, largest: target.id, bytes: target.size };
}

module.exports = { main, storedSize, parsed };

if (require.main === module) {
  main().catch(error => { console.error(`[sizes] ${error.stack || error.message}`); process.exitCode = 1; });
}
