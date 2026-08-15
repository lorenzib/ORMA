# TRUST-01 — Provenance and freshness contract

**Status:** Complete

**Decision date:** 2026-07-28

## Outcome

ORMA now has one versioned contract for answering two different questions
about every trail-safety category:

1. **Source state:** what kind of evidence supports this statement?
2. **Freshness state:** when was that evidence last observed, and is that date
   still suitable for its category?

The implementation is `trust/evidence-v1.js`, its representative data is
`trust/evidence-fixtures-v1.json`, and its invariants are covered by
`evidence-contract.test.js`.

Interactive trail surfaces and the static page generator now reference the
same public tier-label contract.

## Trail evidence tiers

| Stored tier | Public label | Meaning |
|---|---|---|
| `imported` | Imported map data | An automated import exists; it has not passed the ORMA route review. |
| `mapped` | Mapped route | A usable route geometry exists, but dog-safety categories are not fully reviewed. |
| `route-audited` | ORMA route-audited | Route and declared category evidence passed the documented desk/source review. |
| `field-verified` | ORMA field-verified | The route and all required safety categories passed the field process with field evidence. |

Having coordinates does not make a route audited. A recorded hike does not by
itself make the route field-verified. A route without at least two positions
cannot claim `mapped`, `route-audited`, or `field-verified`.

## Category source states

Every canonical category returns exactly one source state:

| State | Public label | Rule |
|---|---|---|
| `unknown` | Evidence unknown | No usable category evidence is recorded. |
| `mapped` | Mapped data | The value comes from map data and has not passed category review. |
| `source-listed` | Source listed, not reviewed | A source is attached, but the category has not passed review. |
| `source-reviewed` | ORMA source-reviewed | The category passed the declared source-review process. |
| `field-checked` | ORMA field-checked | The trail is field-verified and a field-review source supports this category. |

The seven canonical categories are:

- route;
- water;
- heat;
- exposure;
- livestock;
- surface hazards;
- dog access.

`field-checked` requires both the field-verified tier and a field-review source.
A tier flag alone is insufficient.

## Freshness states

Every category independently returns:

- `current` — inside the category's review window;
- `aging` — past 75% of the review window;
- `stale` — older than the review window;
- `unknown` — no valid observation date, an invalid date, or a future date.

Public labels are:

| State | Public label |
|---|---|
| `current` | Current for its review window |
| `aging` | Review becoming old |
| `stale` | Review stale |
| `unknown` | Freshness unknown |

Missing dates must render as **date unknown**. They must not fall back to page
generation time, download time, the current date, or an undated “recent”
label.

## Initial category review windows

These windows determine when ORMA should ask for renewed evidence. They do
not guarantee that a fact remains unchanged throughout the window.

| Category | Maximum age |
|---|---:|
| Route geometry | 365 days |
| Water | 90 days |
| Heat and shade | 180 days |
| Exposure | 365 days |
| Livestock | 90 days |
| Surface hazards | 180 days |
| Dog access | 90 days |

Water, livestock, and access use shorter windows because seasonal or
administrative changes are common. A field-checked fact can still become
stale.

Changing a window is a trust-contract decision and requires fixture review.

## Which date is used

The category chooses its observation date in this order:

1. the latest valid `observedAt` among sources supporting that category;
2. canonical freshness fallback:
   - route → `freshness.geometryAt`;
   - access → `freshness.accessAt`;
   - other safety categories → `freshness.safetyAt`;
3. for legacy reviewed data only, the dated review record.

`retrievedAt` is not substituted for `observedAt`. Downloading or retrieving
an old source today does not make its underlying observation current.

Freshness is calculated against an explicit `asOfDate` input. This keeps build
outputs and tests deterministic.

## Community observations

Community reports are a separate channel:

```text
ORMA assessment
├── tier
└── seven category source/freshness records

Community observations
└── unconfirmed / confirmed / disputed / resolved reports
```

Adding, confirming, disputing, expiring, or removing a community report does
not mutate:

- the ORMA evidence tier;
- category source state;
- category freshness;
- canonical safety assessment;
- recommendation score.

The community observation may appear alongside the assessment with a label
such as **Community report · unconfirmed**. A moderator or reviewer must use
the documented evidence workflow to change the ORMA assessment.

## Use of “verified”

For trail evidence, public wording may use **verified** only for:

- the `field-verified` trail tier; or
- a completed evidence-backed process whose exact scope is named.

Use **mapped** for OpenStreetMap or similar geometry and points. Use
**source-reviewed** or **route-audited** for desk work. Do not use
“OSM-verified,” “verified map data,” or an unqualified “verified trail.”

Technical integrity messages such as “package checksum verified” are allowed
when their technical scope is explicit; they are not evidence claims about
trail safety or current conditions.

## Presentation requirements

Decision surfaces should present:

1. public trail tier;
2. recommendation confidence and scoring version;
3. each material category's source label;
4. each material category's observation date and freshness label;
5. sources;
6. community observations in a visibly separate block.

Cards may use only the short tier label. Trail detail, comparison, download
readiness, and the offline package must expose the category details.

The same formatter is used by interactive and generated surfaces. Templates
must not invent alternative labels.

## Versioning

The evidence contract version is `1.0.0`.

- Patch: wording correction that preserves state meanings and fixture results.
- Minor: a backward-compatible optional output.
- Major: a tier, source state, freshness state, category, date-selection rule,
  or review-window change that can alter public meaning.

Offline packages store the evidence version, tier, category states, dates, and
labels current at generation time. They must not imply that an old package
received a newer review.

## TRUST-01 acceptance

- All seven categories return both source and freshness states.
- Imported, mapped, source-reviewed, field-checked, stale, and unknown states
  have distinct labels.
- Missing and future dates resolve to unknown.
- “Verified” is reserved for an explicitly scoped process.
- Interactive and generated consumers reference the shared tier labels.
- Community observations remain mechanically separate from ORMA evidence.

## Follow-on work

1. **DATA-02:** adapt every production trail into the canonical DATA-01
   evidence fields.
2. **SCORE-02:** include evidence version, tier, confidence, and category
   unknowns in every recommendation.
3. **OFF-02/OFF-05:** store and display evidence and freshness in offline
   packages and readiness checks.
4. **MOD-01 through MOD-03:** implement community confirmation, dispute,
   expiry, and promotion workflows without silent assessment mutation.
