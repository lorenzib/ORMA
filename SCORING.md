# DoloPaws scoring — internal reference

> **Legacy implementation notice (2026-07-28):** this file describes the
> percentage-only scorer still used by production pages. The canonical
> versioned replacement is defined in
> `docs/architecture/SCORE-01-canonical-recommendation-contract.md` and
> `scoring/recommendation-v1.js`. SCORE-02 will migrate every consumer before
> this legacy contract is removed.

How trails are classified and how the personal match % is computed.
Keep this file in sync with `script.js` (scoreTrail, effectiveOverrides),
`breeds-data.js` (trait sets) and `account.js` (band tables). Last updated: July 2026.

## The two layers — the core design decision

**Layer 1 — trail classification (Low-risk / Moderate / Caution).**
A property of the *trail*, never of the dog. It comes from the curated trail
data: terrain rank, exposure, and surface hazards. It answers "how demanding
and how dangerous is this ground, objectively?" and is the same for every
visitor. Community flags display alongside it but never silently change it.

**Layer 2 — personal match % .**
A property of the *pairing* between one trail and one dog. It starts at 100
and subtracts penalties based on the trail's facts and the dog's profile.
It answers "how good an idea is this trail for THIS dog, today?"

Keeping the layers separate means a Caution trail is always labelled Caution
(honesty about the mountain), while the match % does the triage (honesty
about the dog).

## Layer 1 — how a trail gets its classification

Each curated trail stores:

| Field | Values | Meaning |
|---|---|---|
| `terrainRank` | 0 / 1 / 2 | 0 = paved or packed dirt, 1 = gravel & mixed rock, 2 = loose rock, scree, scrambles |
| `exposure` | true/false | narrow ledges or unprotected drop-offs anywhere on the route |
| `surfaceHazards` | list | sharp rock, loose scree, fixed cables, ladders, stream crossings… |
| `heatRisk` | low / moderate / high | south-facing, altitude, typical summer conditions |
| `shadeCoverage` | 0–100 | % of the route with meaningful shade |
| `safetyLevel` | low-risk / moderate / caution | the badge and map colour |

`safetyLevel` is assigned when a trail is curated: **caution** if `exposure`
is true or `terrainRank` is 2 or hazards include cables/ladders; **moderate**
if `terrainRank` is 1 or there are any surface hazards; **low-risk** otherwise.
Imported (non-verified) trails inherit a conservative estimate from OSM
`sac_scale`/`surface` and stay marked IMPORTED until verified.

## Layer 2 — the dog profile

Saved profile fields (account.html): name, breed (FCI nomenclature list,
groups 1–10 + non-FCI + mixed), fitness (low/moderate/high), date of birth
*or* age band, weight band, health conditions (multi-select), free-text notes.
Free-text notes are shown back to the owner but never scored — only
structured fields affect scoring, so behaviour is predictable and explainable.

### Derived values

Age (years) = from DOB when present, else the age-band midpoint
(`u1`→0.5, `1-2`→1.5, `3-4`→3.5, `5-6`→5.5, `7-8`→7.5, `9-10`→9.5,
`11-12`→11.5, `13plus`→14). Life stages: **puppy** < 1y, **senior** ≥ 8y,
**very senior** ≥ 11y.

Weight (kg) = weight-band midpoint (`u5`→4, `5-10`→7.5, `10-15`→12.5,
`15-20`→17.5, `20-30`→25, `30-40`→35, `40-55`→47.5, `55plus`→60).
**Giant** = giant-breed trait or ≥ 45 kg. **Toy** = < 5 kg.

Breed traits (breeds-data.js): `brachy` (flat-nosed), `thickCoat` (cold-bred
double coat), `giant`, `shortLegged`, `backRisk` (IVDD-prone). Unknown or
free-text breeds get no traits — the health-conditions dropdown is the
catch-all, so a rescue mix is never penalised for a name we can't classify.

**Orthopedic risk** = conditions include joints, back, or recovering, OR the
breed is backRisk. **Fragile** = orthopedic risk or senior.
**Heat-sensitive** = brachy or thickCoat breed, OR conditions include heat,
cardiac, or overweight.

### Effective tolerances (computed before scoring)

Terrain tolerance — start from fitness (low→0, moderate→1, high→2), then:

| Rule | Effect |
|---|---|
| puppy or senior | −1 |
| orthopedic risk | −1 |
| short-legged or giant | capped at 1 |
| floor | never below 0 |

Distance cap (km) — start from fitness (low→5, moderate→10, high→no limit), then multiply:

| Rule | × |
|---|---|
| puppy or very senior | 0.5 |
| senior (8–10y) | 0.75 |
| heart condition | 0.6 |
| joints or back condition | 0.75 |
| overweight | 0.75 |
| toy (< 5 kg) | 0.8 |
| floor | 2 km |

### Penalty table (scoreTrail)

Score starts at 100; floor is 5. All numbers live in `scoreTrail()`.

| Factor | Penalty |
|---|---|
| Terrain above tolerance | −30 per rank exceeded |
| Distance above cap | −5 per km over, max −35 |
| Exposure | −30; −40 if fragile or impaired vision |
| Heat risk high | −25 heat-sensitive / −12 otherwise |
| Heat risk moderate | −10 heat-sensitive / −4 otherwise |
| Shade < 20% | −10 (any dog) |
| Shade 20–39% | −5 (any dog) |
| Surface hazards | −8 each, max −20; ×1.5 each and max −30 if fragile |

The "Adjust for today" panel overrides terrain + distance only, for the
session — it never rewrites the saved profile, and the health-derived
modifiers still apply when the panel is not in use.

### Worked example

Bernese Mountain Dog, 5y, 40–55 kg band, moderate fitness, joint issues.
Traits: thickCoat + giant → heat-sensitive; joints → orthopedic → fragile.
Terrain tolerance: 1 (moderate) − 1 (orthopedic) = 0. Distance: 10 × 0.75 = 7.5 km.
A gravel trail of 9 km, moderate heat risk, 35% shade, 1 hazard:
100 − 30 (terrain 1 > 0) − 7.5 (1.5 km over) − 10 (heat, sensitive) − 5 (shade)
− 12 (hazard ×1.5) ≈ **36%** — shown, not hidden: the owner sees why.

## Principles (the short version — the public wording lives in the safety guide)

1. Trail facts and dog fit are scored separately and never mixed.
2. Only structured, owner-declared data is scored — no guesses from photos or names we can't classify.
3. Conservative by default: when age, weight or breed is missing, we score as an average adult dog, and health conditions always outrank breed assumptions.
4. Breed affects the score only through documented physical traits (flat nose, heavy coat, size, leg length, disc risk) — never through temperament stereotypes.
5. A low match % is information, not a verdict — the owner knows their dog best.

## File map

- `script.js` — FITNESS_DEFAULTS, band tables, dogAgeYears/dogWeightKg/dogConditions, effectiveOverrides, scoreTrail
- `breeds-data.js` — FCI_BREED_GROUPS, DOG_BREEDS, trait sets, breedTraits()
- `account.js` / `account.html` — profile form, band values, legacy migration
- `trails-data.js` — per-trail Layer-1 fields
