# OFF-05 — Package verification and truthful states

**Status:** Implemented for the first beta package; beta.5 physical-device
self-test and Android coverage remain open

**Implementation date:** 2026-07-29

## Outcome

“Ready offline” now means that every mandatory cached resource was read from
this device and passed both its declared byte length and SHA-256 checksum.
Presence in Cache Storage alone is not sufficient.

The same local inspection powers:

- the trail download panel;
- the downloaded-trails management screen; and
- the explicit offline self-test.

Corrupt or incomplete local data remains visible as a repairable state instead
of disappearing into “not downloaded.”

## Canonical lifecycle states

The shared controller publishes exactly these product states:

| State | Meaning |
|---|---|
| `not-downloaded` | No package data is stored for this trail. |
| `downloading` | Required resources are being fetched and verified into a temporary cache. |
| `ready` | Every mandatory stored resource passed a local checksum inspection. |
| `stale` | The package is technically usable, but at least one stored content-review category is stale. |
| `incomplete` | A temporary installation remains; it is never treated as ready. An older verified package may still be usable. |
| `update-available` | A newer online manifest exists; the current verified package remains usable. |
| `failed` | Stored mandatory data is missing, malformed, the wrong size, or checksum-invalid. |
| `removed` | Local package caches and metadata were deleted by the user. |

Content freshness and technical integrity remain separate. Missing observation
dates resolve to `unknown`, not current and not stale. The Lago di Carezza
package truthfully stores unknown freshness for all seven TRUST-01 categories
because it has not received a dated field review.

## Offline self-test

The **Test offline** action performs no network request. It:

1. opens the completed package cache;
2. reads and validates the cached manifest;
3. reads every mandatory cached resource;
4. checks byte length and SHA-256 against that manifest; and
5. reports the exact number of mandatory resources that passed.

A passing result tells the user that the package is locally ready, then asks
them to switch to airplane mode and open the map. The test does not claim to
toggle airplane mode or prove GPS behavior automatically.

## Evidence snapshot

Package `2026.07.29-beta.8` stores the TRUST-01 evidence contract version,
public tier, and source/freshness/date labels for route, water, heat, exposure,
livestock, surface hazards, and dog access. That detail remains internal
package metadata for integrity, scoring, and operations. The customer-facing
offline screen does not expand it category by category or show an unknown
freshness label. Vetted trails use the concise `Vetted by DoloPaws` label;
not-yet-vetted packages retain a short beta/local-notices warning.

The primary update message is simply **Update available**. The technical beta
revision remains secondary package information.

## Automated evidence

- Package tests re-check every declared file size and SHA-256 hash.
- Lifecycle tests reject missing and corrupt mandatory cached resources.
- The self-test fixture proves optional layers are ignored and no network fetch
  occurs.
- Tests cover all eight canonical lifecycle states and stale/unknown freshness.
- The normal application suite passes 204 tests.
- The static link checker passes all 173 HTML pages.

## Remaining validation

1. Update the existing iPhone package to beta.8 and run **Test offline**.
2. Repeat airplane-mode open, refresh, browser restart, and GPS checks.
3. Complete the supported Android Chrome physical-device matrix.
4. Complete the dated Lago di Carezza field review; until then evidence
   freshness remains unknown and the package remains explicitly beta.
