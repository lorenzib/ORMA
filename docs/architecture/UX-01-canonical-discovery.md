# UX-01 — Canonical discovery journey

Status: complete in code (2026-07-29)

## Decision

`browse-trails.html` is the canonical search and filtering surface.

The production journey works backwards from a trail decision:

1. A homepage search, popular prompt, or collection sends a canonical URL state
   to Browse.
2. Browse owns filtering, pagination, and result rendering.
3. Opening a trail includes the complete Browse URL as the validated `from`
   target.
4. The trail breadcrumb returns to the same search, region, filters, dog
   context, and page.

The guest homepage remains the fast entry and orientation surface. It can
preview dog context and promote themes, but submitting its discovery controls
hands the state to Browse instead of rendering a second public catalog.

The signed-in homepage remains a personalised map dashboard. Its lightweight
map refinements are dashboard state, not a replacement public catalog; its
global Browse link always enters the canonical journey.

`collections.html` remains only as a backwards-compatible redirect to the
Collections section of Browse.

## URL contract

The canonical state helper is `discovery-state.js`. It accepts only allowlisted
values and serializes:

- `search`
- `region`
- `risk`
- `distance`
- `water`
- `collection`
- `dog`
- `difficulty`
- `terrain`
- `shade`
- `minMatch`
- `page`

Default values are omitted. Invalid values are discarded. The same helper
builds trail return links, preventing each surface from inventing its own URL
contract.

The richer dog-filter controls and zero-result explanations are intentionally
handled by UX-02. UX-01 guarantees that their state already survives navigation.

## Production exclusions

Design previews and experimental harnesses are excluded from the Jekyll
production build in `_config.yml`. They stay in source control as development
evidence, but are not published as user-facing pages.
