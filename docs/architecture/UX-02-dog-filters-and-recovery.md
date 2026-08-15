# UX-02 — Dog-specific filters and zero-result recovery

Status: complete in code (2026-07-29)

## User-facing filter set

Browse is the canonical filter surface. Its filters cover:

- known maximum distance;
- terrain tolerance, from gentle surfaces through known rocky terrain;
- reviewed water points;
- reviewed shade of at least 30%;
- reviewed absence of exposure;
- reviewed dog permission, including routes where a leash is required;
- ORMA route-audited or field-verified status;
- the existing trail rating, region, collection, search, and dog-match context.

Labels deliberately say "reviewed" where a positive result depends on safety
evidence. "Any" options do not claim that missing data is safe.

## Unknown-data rule

`discovery-filters.js` is the single predicate contract. A positive safety
filter requires both:

1. a known value that satisfies the requested constraint; and
2. a `verified` category state for water, heat, exposure, or access where that
   category can materially affect the dog's safety.

Examples:

- missing distance never passes "Up to 5 km";
- a mapped but unreviewed fountain never passes "Reviewed water point";
- `exposure: false` without reviewed exposure evidence never passes
  "No exposure, source-reviewed";
- unknown access never passes an allowed-dogs filter.

Collections use the same truth-preserving rules. Missing shade is no longer
treated as open meadow, and missing distance is no longer treated as a short
loop.

## Zero-result recovery

When the result is empty, Browse:

1. lists every active constraint in plain language;
2. tests each constraint independently to identify which removal restores
   results;
3. offers conservative broadenings first, such as a longer distance, known
   mixed terrain, or route-audited trails in place of field-only trails;
4. labels less conservative removals explicitly instead of silently weakening
   a safety requirement;
5. always offers a complete reset.

Recovery buttons update the canonical URL state, so the restored result remains
shareable and survives trail navigation.

The URL contract already understands stricter future states such as
field-verified-only and reviewed low heat risk. They are intentionally not
offered as controls while the current catalog has zero qualifying trails.
