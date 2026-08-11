# SAVE-01 — Canonical saved-trails experience

Status: complete (2026-08-11)

## Decision

`saved.html` is the only maintained saved-trails experience. It owns account
loading, dog-specific ranking, removal, empty, logged-out, and error states.

The retired `my-trails.html` path remains as a lightweight compatibility page
for existing bookmarks. It:

- is excluded from indexing;
- declares `saved.html` as canonical;
- redirects to the fixed same-origin `saved.html` destination;
- preserves the existing query string and fragment; and
- offers an accessible fallback link when scripting or refresh is unavailable.

It does not load, store, rank, or render trails itself.

## Acceptance evidence

- Maintained navigation and trail-card entry points link to `saved.html`.
- No application script links users to `my-trails.html`.
- The compatibility page cannot accept an external redirect destination.
- Automated coverage locks the canonical metadata, fallback, and state-preserving
  handoff in place.

