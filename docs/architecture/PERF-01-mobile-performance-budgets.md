# PERF-01 — Mobile performance budgets

**Status:** Complete in code

**Baseline date:** 2026-08-10

## What is measured

The runner exercises five customer-critical states against the current local
source, served over HTTP:

| Scenario | Reproducible action |
|---|---|
| Homepage | Load `index.html`, focus search, type “Carezza” |
| Discovery | Load `browse-trails.html`, focus the trail search, type “Carezza” |
| Trail detail | Load Carezza and expand the detail map |
| Download flow | Load Carezza, choose download while logged out, verify the login handoff |
| Active hike | Load Carezza, initialise the real hike-mode module with deterministic Carezza GPS data, start recording, and verify the live status UI |

The active-hike setup deliberately replaces browser permission prompts and the
external basemap with deterministic lab doubles. It still executes the real
Carezza data, `initHikeMode`, durable-session logic, GPS assessment, and hike
UI. This keeps the measurement repeatable and prevents map-tile availability
from deciding whether the scenario can start.

## Mobile lab profile

- Chrome for Testing `139.0.7258.66`, managed by Puppeteer
- 390 × 844 CSS-pixel viewport at 3× device scale
- 150 ms network latency
- 1.6 Mbps download and 750 Kbps upload throughput
- 4× CPU slowdown
- disabled browser cache
- three independent runs per scenario; the median is the baseline

These conditions represent a constrained mobile lab profile. They are a
regression environment, not a claim that every physical phone or mountain
connection behaves identically.

## Metrics

- **Transferred KB:** encoded network bytes observed by Chrome DevTools.
- **LCP:** Largest Contentful Paint from the browser Performance Observer.
- **INP:** the longest Event Timing duration produced by the scripted lab
  interaction. Field INP still requires real-user percentile data.
- **CLS:** layout-shift entries without recent user input.
- **JavaScript execution:** Chrome `ScriptDuration` for the measured journey.

## Recorded baseline and budgets

| Scenario | Baseline KB | Budget KB | LCP baseline / budget | INP baseline / budget | CLS baseline / budget | JS baseline / budget |
|---|---:|---:|---:|---:|---:|---:|
| Homepage | 2010.4 | 2325 | 5220 / 6300 ms | 112 / 200 ms | 0.715 / 0.90 | 243 / 300 ms |
| Discovery | 1396.5 | 1625 | 2916 / 3500 ms | 104 / 200 ms | 0.527 / 0.66 | 180 / 300 ms |
| Trail detail | 1907.0 | 2200 | 10196 / 12300 ms | 88 / 200 ms | 0.824 / 1.03 | 311 / 400 ms |
| Download flow | 1905.8 | 2200 | 10160 / 12200 ms | 88 / 200 ms | 0.824 / 1.03 | 282 / 400 ms |
| Active hike | 1916.8 | 2225 | 10244 / 12300 ms | 88 / 200 ms | 0.824 / 1.03 | 373 / 500 ms |

The checked-in budgets are regression ceilings derived from the median plus a
15–25% variability margin and rounded upward. They are not “good experience”
targets. The current transfer size, LCP and CLS results establish the priority
for PERF-02 rather than disguising the initial state behind an overall score.

The complete raw runs, browser version and conditions are in
`docs/performance/mobile-baseline.json`. Machine-readable ceilings are in
`config/performance-budgets.json`.

## Reproducing the result

```bash
npm install
npm run perf:mobile
```

`npm run perf:mobile` runs the three-pass measurement and exits non-zero when
any scenario crosses its ceiling. To intentionally record a new baseline after
reviewing a performance change:

```bash
npm run perf:mobile:baseline
git diff -- config/performance-budgets.json docs/performance/mobile-baseline.json
```

Never accept a new baseline solely to make a regression pass. Review the raw
metric and the affected resources first.

## PERF-02 handoff

The initial data makes the next work concrete:

1. reduce the approximately 1.9–2.0 MB homepage/trail payloads;
2. reserve stable space for late-rendered homepage, discovery and trail-page
   content to reduce CLS;
3. move the trail page's largest visible content earlier than its current
   roughly 10-second mobile baseline; and
4. rerun the same five scenarios after each asset or regional-loading change.

## Verification

- `performance-budget.test.js` locks the five scenarios, metric coverage and
  throttle profile.
- `scripts/run-mobile-performance.mjs` owns collection, median aggregation,
  baseline writing and budget enforcement.
- `npm run perf:mobile` is the local regression command.
