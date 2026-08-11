# SEO-01 — Generated trail handoff

Status: complete (2026-08-11)

## Decision

Generated `trails/<slug>.html` pages are search-discovery documents. They keep
a self-referencing canonical URL so useful trail facts remain indexable, but
they are not a second interactive product.

Every published page hands the visitor to the exact canonical application
record at `trail.html?id=<trail-id>` through a prominent primary call to action
placed before the supporting article content. Dog-specific calls to action use
the same trail ID.

Generated pages must not automatically redirect. This preserves readable
search results and a working no-JavaScript experience while making the richer
map, recommendation, download, and hike tools one explicit action away.

## Acceptance evidence

- Production validation currently publishes 142 schema-valid trail pages and
  holds 22 unsafe or malformed routes as drafts.
- Every published page has one self-referencing HTTPS canonical URL.
- Every primary handoff targets a local `trail.html?id=…` URL with a bounded,
  URL-encoded trail ID.
- No generated page uses meta refresh or `location.replace`.
- `npm run check:generated` proves the committed pages match the generator.
- `seo-trail-handoff.test.js` applies the handoff contract to every generated
  trail page, not only selected fixtures.

