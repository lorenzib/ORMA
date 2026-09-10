'use strict';

/**
 * Where an artifact's bytes went.
 *
 * Backoffice artifacts are stored as one JSON string in a document's `data`
 * property, and Firestore refuses any property over 1,048,487 bytes. On
 * 2026-09-10 the worker began failing every pass with exactly that error, and
 * the message names the property but not the artifact, let alone the part of
 * it that grew. A total is not much better: knowing an artifact is 1.1 MB does
 * not say whether to trim one field on every entry or drop entries entirely.
 *
 * So this reports the shape of the weight: which top-level key holds it, and
 * inside the worst array, which entries and what they are. That is the
 * difference between a fix and a guess.
 */

/** Firestore's hard per-property ceiling, in bytes. */
const PROPERTY_LIMIT = 1_048_487;
/** Report anything this close to the ceiling: today's fine is tomorrow's outage. */
const WARN_RATIO = 0.8;

function bytes(value) {
  const encoded = JSON.stringify(value);
  return encoded === undefined ? 0 : Buffer.byteLength(encoded, 'utf8');
}

/** A name for an array entry, from whichever id-like field it happens to carry. */
function entryLabel(entry, index) {
  if (!entry || typeof entry !== 'object') return `[${index}]`;
  const named = ['trailId', 'candidateId', 'reviewId', 'id', 'jobId', 'trailName', 'name']
    .map(key => entry[key])
    .find(value => typeof value === 'string' && value.trim());
  return named ? String(named).slice(0, 60) : `[${index}]`;
}

/**
 * Which fields of an array's entries carry the weight. An array of 40 entries
 * that is 90% one field is trimmed at the field; one where every entry is
 * uniformly large is trimmed by dropping entries. The numbers say which.
 */
function fieldWeights(entries, limit = 5) {
  const totals = new Map();
  entries.forEach(entry => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
    Object.keys(entry).forEach(key => totals.set(key, (totals.get(key) || 0) + bytes(entry[key])));
  });
  return [...totals.entries()]
    .map(([field, size]) => ({ field, bytes: size }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, limit);
}

/**
 * @param {unknown} data  the artifact, already parsed
 * @returns a breakdown, largest part first
 */
function measureArtifact(data, options = {}) {
  const limit = options.limit || PROPERTY_LIMIT;
  const total = bytes(data);
  const report = {
    total,
    limit,
    ratio: total / limit,
    overLimit: total > limit,
    nearLimit: total > limit * WARN_RATIO,
    parts: [],
    heaviestArray: null,
  };
  if (!data || typeof data !== 'object') return report;

  const keys = Array.isArray(data) ? data.map((unused, index) => index) : Object.keys(data);
  report.parts = keys
    .map(key => {
      const value = data[key];
      return {
        key: String(key),
        bytes: bytes(value),
        count: Array.isArray(value) ? value.length : null,
      };
    })
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, options.parts || 8);

  // The array holding the most bytes is nearly always the thing that grew,
  // because artifacts grow by accumulating entries rather than by widening.
  let worst = null;
  keys.forEach(key => {
    const value = data[key];
    if (!Array.isArray(value) || !value.length) return;
    const size = bytes(value);
    if (!worst || size > worst.bytes) worst = { key: String(key), bytes: size, entries: value };
  });
  if (worst) {
    const sized = worst.entries
      .map((entry, index) => ({ label: entryLabel(entry, index), bytes: bytes(entry) }))
      .sort((a, b) => b.bytes - a.bytes);
    report.heaviestArray = {
      key: worst.key,
      bytes: worst.bytes,
      count: worst.entries.length,
      meanBytes: Math.round(worst.bytes / worst.entries.length),
      biggest: sized.slice(0, options.entries || 5),
      fields: fieldWeights(worst.entries),
    };
  }
  return report;
}

module.exports = { PROPERTY_LIMIT, WARN_RATIO, bytes, measureArtifact, fieldWeights, entryLabel };
