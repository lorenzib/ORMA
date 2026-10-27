# Proposed charter amendment — catalogue and offline scope

**Status:** Proposed 2026-10-27. Awaiting the product owner's decision. The
charter is unchanged until this is accepted. Under the charter's scope-change
rule, the charter and the Day 6 backlog are then updated together, in one pull
request.

## Why an amendment is needed

At its weekly review the charter asks: *"Does the charter still describe the
product being built?"* For the catalogue and offline packages, it no longer
does.

| The charter says | What is live on 2026-10-27 |
|---|---|
| Initial beta region: Val Gardena and nearby Alpe di Siusi. "Cortina, the wider Dolomites, and Savoy are outside the first beta scope." | 246 trails in the catalogue (245 published, 1 draft): 195 across South Tyrol, Trentino and Belluno, and 51 in Savoy. |
| "Broad OSM route expansion" is frozen. "New geographic regions" are excluded. | Since 22 Oct, hand verification has added walks in Val di Fassa, Primiero, Val di Fiemme, Val di Cembra and around Cortina. |
| "No other trail may advertise an offline package during the first beta until the two-route device and field matrix passes." | OFF-07 (23 Oct) gives every Verified trail an offline package. That is about 170 packages, offered on the trail pages, while the matrix is still pending. |
| "Verified" is reserved for the agreed evidence-backed process. | 171 trails are Verified, and about 95% of them by hand under the seal rules in the operating standard. This one still holds. |

The charter already allows part of this: *"Online planning and account features
may continue to cover the wider published catalogue."* The conflict is limited
to three things: offline packages beyond the two pilots, the continued growth
of the catalogue, and the regional wording used for recruitment.

Leaving the conflict unrecorded would let the readiness review (QA-05) judge
a product the charter does not describe. That is the "silent displacement" the
scope-change rule forbids.

## The proposal

Split the one "beta region" idea into three scopes that the charter names
separately.

### 1. Field-test scope (unchanged)

The physical gates stay exactly as they are: the **two pilot routes**, Lago di
Carezza and Alpe di Siusi, on the supported iPhone and Android targets
(`OFFLINE-IOS-CURRENT`, `OFFLINE-ANDROID-CURRENT`, `HIKE-RESTORE-GPS`,
`ROUTE-FIELD-REVIEW`). The offline hike-mode claim made to beta testers is
about these two routes.

### 2. Planning catalogue scope (amended)

The beta covers, for planning, the **published catalogue in the Dolomites
(South Tyrol, Trentino, Belluno) and Savoy**, with each trail showing its real
status: Verified, Reviewed or Imported. This replaces the line excluding
Cortina, the wider Dolomites and Savoy.

The catalogue may keep growing **within those two areas only**, under three
conditions:

- the seal rules in the operating standard are applied unchanged (authority
  climb and time, dog rules, lift and reserve holds, no seal on an
  illustration);
- the growth never takes priority over a step on the launch checklist's
  critical path;
- a new country, or a new area outside these two, remains excluded until
  after the readiness review.

"Broad OSM route expansion" stays frozen. Hand-verified walks drawn from an
authority's published route are not that expansion, but bulk imports of OSM
relations are.

### 3. Offline packages beyond the pilots (decision needed)

Two options.

**Option A (recommended): keep them, scope the claim.** Every Verified trail
keeps its package, as OFF-07 decided. The pilots' device results stand for the
shared reader, which is byte-identical across packages. The charter records
three things. First, a non-pilot package carries its trail's Verified status,
meaning source-audited, not walked with that package (OFF-08). Second, beta
invitations and the hike-mode claim name only the pilots. Third, if a device
gate fails, downloads for non-pilot trails are switched off until the fix
passes.

**Option B: strict charter.** Hide the download on every non-pilot trail until
the device matrix passes, then switch them back on. This is safer on paper,
but it removes a live feature, and it needs a build change and a revert.

Option A is recommended because the risk the charter guards against is a
*false readiness claim*, and Option A keeps every claim scoped to evidence.
Recruitment is still closed, so no tester relies on a non-pilot package
before the review.

## Edits once accepted

In `day-07-beta-charter.md`:

- Add a dated "Catalogue and offline scope amendment" under *Initial beta
  region* with sections 1–3 above.
- Replace "Cortina, the wider Dolomites, and Savoy are outside the first beta
  scope" with the planning-catalogue wording.
- Amend the offline-route amendment's last paragraph to the chosen option.
- Under *Explicitly excluded*, change "new geographic regions" to "new
  countries or areas outside the Dolomites and Savoy".

In `day-06-master-backlog.md`:

- Record OFF-07 and OFF-08 as accepted scope, with a pointer to this amendment.
- Add to QA-05's acceptance: "The readiness review is judged against the
  amended scope; the hike-mode claim covers the pilots only."

In `config/beta-readiness.json`: no gate changes. The ledger's `asOf` moves to
the amendment date.

## What this does not change

- No P0 or P1 gate is removed or waived.
- Recruitment stays closed until the readiness decision is recorded.
- "Unknown is not safe" and "mapped is not field-verified" still hold. A
  Reviewed or Imported trail never gets a package.
