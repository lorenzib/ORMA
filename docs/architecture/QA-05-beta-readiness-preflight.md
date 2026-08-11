# QA-05 — Beta readiness preflight

**Status:** Not ready; automated ledger implemented and manual evidence gates remain.

The machine-readable source of truth is
`config/beta-readiness.json`. It deliberately separates implementation evidence
from physical-device and observed-human acceptance. A green unit-test suite is
necessary but cannot change a physical or manual gate to passed.

Run the structural report with:

```bash
npm run check:beta-readiness
```

The report succeeds when the ledger is valid, even if the beta is not ready.
Release automation must use the strict form:

```bash
npm run check:beta-readiness -- --require-ready
```

The strict form exits non-zero while any pending gate remains. P0 exceptions
are rejected. A P1 exception is valid only when the charter permits it and the
ledger records its owner, rationale, evidence, and safe fallback.

## Current blocking evidence

- current-package iPhone airplane-mode retest for Carezza and Alpe di Siusi;
- physical Android Chrome and installed-PWA matrix;
- dated route-specific field review for each beta route;
- physical restoration, GPS, rejoin, completion, and elevation-cursor matrix;
- manual VoiceOver acceptance; and
- one uncoached internal usability session using the QA-03 protocol.

Until these are recorded, recruitment remains closed and the readiness
decision remains `not-ready`.
