# ORMA Backoffice MVP

> **Current operating contract:**
> [`OPERATING_STANDARD.md`](./OPERATING_STANDARD.md) defines the six-team model,
> CEO review gates, cadences, and publishing behaviour that all new backoffice
> work must preserve. Where older MVP notes below conflict with that standard,
> the operating standard takes precedence.

This directory contains ORMA's private, evidence-first trail production
pipeline. It is deliberately separate from the public trail catalogue.

## Historical implementation notes

The first workflow reads an existing OpenStreetMap snapshot, runs deterministic
geometry and hard-disqualifier checks, and writes a bounded local review queue.
The logistics workflow then ranks mapped parking within 500 metres of each
route and records exact parking and route-anchor coordinates. Suggestions are
never treated as reviewed facts. These workflows do not publish trails, update
Firebase, browse for evidence, or make safety claims.

Run it with:

```sh
npm run backoffice:discover -- --limit=10
npm run backoffice:logistics
```

### Editing and pictures flow

The deliberately narrow content flow creates two parallel draft jobs per trail:
one Copywriter edit and one Visual Director picture search. It cannot change
route or safety facts, download media, mutate the public catalogue, or publish.
Both editorial and asset/licensing review remain human gates.

```sh
npm run backoffice:content-flow -- --trails=alpe-siusi,tre-cime
# or take a bounded catalogue batch
npm run backoffice:content-flow -- --limit=10
```

The ignored runtime artifact is `backoffice-data/content-flow.json`.

### Content operations calendar

The broader content-operations planner runs the editing and picture-gathering
pair across guides, collections, a fortnightly newsletter, and a weekly library
freshness pass. Social media remains parked until explicitly enabled.

```sh
npm run backoffice:content-ops
npm run backoffice:content-ops -- --as-of=2026-08-18
# once ORMA launches its social channels:
npm run backoffice:content-ops -- --enable-social
```

This writes `backoffice-data/content-operations.json`. Each active workstream
gets one Copywriter job and one Visual Director job. The newsletter's next date
is 14 days after the cycle date; weekly streams advance seven days. The command
plans work only—it does not invoke a model, send a newsletter, post to social
media, or publish site changes.

Execute the first end-to-end guide slice with an API key in your shell:

```sh
OPENAI_API_KEY=... npm run backoffice:run-content-ops -- --guide=paw-protection
npm run backoffice:review
```

The runner uses `ORMA_CONTENT_MODEL` when set and otherwise defaults to
`gpt-5.6-terra`. It writes `backoffice-data/content-execution.json`; the Content
Desk renders proposed edits, sources, picture candidates and licensing state,
then offers approve, request-revision and reject decisions. These decisions are
included in the existing exported review record. Approval still does not alter
or publish a guide.

Run `npm run backoffice:review`, then open the printed localhost URL to review the
queue visually. Localhost is permitted as an explicit development mode; a
non-local deployment requires the existing Firebase moderator claim. Production
operators use the unlinked `/backoffice-login.html` entry; the public ORMA
navigation does not expose the administrator login or any backoffice link. Review
decisions remain in browser storage until exported as an audit JSON. The
generated queue is ignored by Git and is not included in the deployed site.

Route identity and geometry use a separate `geometry-approval` decision channel
so a route action cannot overwrite an approved parking decision. The review page
loads `backoffice-data/route-review.json`, exposes source findings, metric
comparisons, blockers and human checks, and keeps route approval disabled until
the Cartographer supplies a source-matched full-resolution proposal. Exported
audit JSON contains both the original parking decisions and a nested
`routeReview` record. Neither channel mutates public trail data.

Official GPX tracks are converted into draft GeoJSON proposals with
`npm run backoffice:build-route-proposals`. The converter preserves every track
point, records computed distance and closure, and marks every output as
`publicMutationAllowed: false`. When more than one valid route exists, the UI
requires the editor to choose a named variant before route approval is enabled.

Worked evidence dossiers live in `backoffice/dossiers/`. A dossier separates
supported, conflicted and unresolved claims, links every conclusion to named
sources, lists concrete human checks, and contains explicit promotion gates.
Parking approval remains disabled until a dossier's parking gate is cleared.

## Automated resolution policy

An unresolved mandatory claim may receive up to **five** automated research
attempts. Attempts are scheduled at 0, 1, 6, 24 and 72 hours. Every attempt
must use a materially different source or verification strategy; repeating a
search does not qualify as another attempt. After the fifth unsuccessful pass,
the claim becomes `source-exhausted` and must move to direct contact, a field
check, or remain blocked. The limit never authorizes an unknown claim to become
supported.

After the human geometry gate, the live orchestrator applies this policy to
every `unresolved` or `conflicted` Logistics, Regulatory Ranger, and Terrain &
POI finding before provenance and Red Team review. The five fixed strategies
are primary-authority scope, geospatial triangulation, local-institution
cross-check, counter-evidence/freshness review, and a final direct-verification
escalation check. Each claim has a durable Firestore ledger containing the
strategy, scheduled and eligible times, job receipt, finding, source count, and
blockers. Backoffice Trail evidence shows that ledger at the final human gate.

An OpenAI transport, rate-limit, validation, or worker failure is a system
retry on the same job and does **not** consume another evidence strategy. A
supported retry replaces only its targeted claim and preserves unrelated
supported findings. A fifth unresolved retry is labelled `source-exhausted`;
approval stays locked rather than allowing the model to manufacture a green
claim. Exact route identity and geometry remain a separate mandatory human
gate because a language-model search cannot approve coordinates.

The default outputs are `backoffice-data/review-queue.json` and
`backoffice-data/logistics-review.json`. These evidence and decision artifacts
form the reproducible seed/audit baseline for Firestore; they must be reviewed
before being committed and must never contain credentials. Use
`--input=/path/to/input.json` or `--output=/path/to/output.json` to override the
defaults.

## Workflow boundary

Candidates currently stop at `geometry_validated`. Later phases must attach
claim-level evidence and move a candidate through explicit workflow states.
No component may skip directly from discovery to publication.

The contracts are designed to map to Firestore documents later, while remaining
plain JSON for the local MVP.

## Live worker infrastructure

The production backoffice uses Firestore rather than the ignored local JSON
directory. `backofficeArtifacts` holds the current locked queue, execution and
publication staging packets; `backofficeJobs` holds the persistent specialist
job lifecycle; and `backofficeReviews` contains immutable moderator decisions.
Client rules permit moderators to read state and append decisions, but only the
Admin SDK worker can change an artifact or job status.

`.github/workflows/orma-backoffice-worker.yml` has a five-minute GitHub schedule
target and may also be started with **Run workflow** in GitHub Actions. GitHub
can delay scheduled starts, so the worker writes a protected `worker-health`
artifact at run start and completion. Backoffice Home classifies the real
heartbeat as healthy, running, delayed, stale or failed and links the exact
workflow run; it never treats the cron expression as proof that work ran. The
worker claims jobs with a
lease, runs the appropriate specialist through the OpenAI Responses API,
validates the structured result against the locked dossier, and records either
`ready-for-review`, a delayed retry, or `blocked`. An expired running lease is
automatically returned to the queue after a worker interruption. No worker
result is approval.

Routine trail research (Logistics, Regulatory Ranger and Terrain & POI) uses
`ORMA_CONTENT_ROUTINE_MODEL`, which defaults to `gpt-5.6-luna`. Judgment passes
(Evidence Librarian, Red Team and human-requested Auditor revisions) use
`ORMA_CONTENT_AUDIT_MODEL`, which defaults to `gpt-5.6-terra`. The legacy
`ORMA_CONTENT_MODEL` remains a shared override for local testing. Manual worker
runs may also supply a candidate ID and specialist-call limit so a funded API
project can be validated on one trail without draining the entire queue.
Transient API token-per-minute limits are retried inside the model client using
the server-provided delay. They do not consume one of the five evidence
resolution attempts; exhausted transport retries remain visible as system
failures and are returned to the durable queue.

When the moderator approves the final evidence dossier as ORMA Verified, that
same protected decision atomically creates two idempotent trail-only jobs:
`verified-trail-editorial-first-pass` for the Copywriter and Visual Director.
The Copywriter receives only the locked facts and must return exactly About the
trail, Why it suits dogs, and Important practical notes. The Visual Director
may search for reusable imagery, but a ready candidate requires a direct
preview, source page, creator, explicit licence, licence URL, credit, and safe
alt text; otherwise it returns an owned-photo coverage checklist. Both outputs
return to separate human gates in Content & release. Guide content is never
admitted to this trail handoff, and neither first pass can authorize
publication.

Scheduled worker events are inert until the repository variable
`ORMA_WORKER_AUTOMATION_ENABLED` is `true`; the daily intake campaign uses the
separate `ORMA_CAMPAIGN_AUTOMATION_ENABLED` variable. Manual workflow runs are
always allowed, preserving a controlled activation path.

The same workflow then consumes explicit publication approvals. It writes a
small `data/verified-trail-overrides.json` change, regenerates and validates the
website, opens a GitHub pull request, and records that PR URL back in Firestore.
It never pushes a trail directly to the default branch. Re-running the worker
is idempotent: one human publication approval can produce only one override.
Failed releases keep that approval and apply a bounded retry cooldown. Ordinary
automation failures back off from 15 minutes through 72 hours; the known
GitHub Actions PR-permission failure opens a manual circuit breaker so the
schedule cannot create duplicate failed runs continuously. After correcting
the external setting, start the workflow manually with **Force publication
retry** to bypass the remaining cooldown. The failure receipt and next eligible
time stay visible in Home and Content & release.

One-time repository secrets:

- `OPEN_API_KEY`: server-side OpenAI project key used by GitHub Actions.
- `FIREBASE_SERVICE_ACCOUNT`: the complete Firebase service-account JSON.

Seed the existing verified-trail state once from an authorized operator shell:

```sh
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/firebase-service-account.json
npm run backoffice:seed:live
```

After the Firestore rules are deployed, the deployed Trail Content Desk uses
Firebase Authentication and these collections automatically. Localhost keeps
the JSON/server adapter for development and contract testing.

### Production activation checklist

1. Review and merge the backoffice code and its seed/audit artifacts.
2. Deploy `firestore.rules` to the `dolopaws` Firebase project.
3. Add `OPENAI_API_KEY` and `FIREBASE_SERVICE_ACCOUNT` as GitHub Actions secrets.
4. In GitHub Actions settings, allow workflows to create pull requests.
5. Run `npm run backoffice:seed:live` once from an authorized operator shell.
6. Start **ORMA backoffice worker** once with **Run workflow** and confirm it is
   green.
7. Set `ORMA_WORKER_AUTOMATION_ENABLED=true` only after the controlled run has
   reached the expected human gate. Enable the separate campaign variable only
   when automatic catalogue admission is also approved.

The moderator reviews verification work at `/trail-dossier-desk.html`, then
reviews copy and pictures at `/trail-content-desk.html` only after a dossier is
ORMA Verified. **Agent activity** shows queued, running, retrying, blocked, and ready-for-review jobs.
A revision remains visible until the moderator approves, rejects, or requests
another pass. **Approve for PR creation** is a second, separate human gate.
The resulting GitHub pull request is the final website diff and must still be
reviewed and merged.

The live trail-verification vertical includes Cartographer, Logistics,
Regulatory Ranger, Terrain & POI, Evidence Librarian and Red Team execution,
plus the verified-trail Copywriter and Visual Director revision loop. New Trail
scouting, dynamic hazard monitoring, image coverage, Newsletter and Analyst
packets are separate team workflows with their own desks and human gates. Their
code being present does not mean their schedules are active.

## Six-team operating commands

Run the broader review preparation locally with:

```sh
npm run backoffice:strategy-cycle
npm run backoffice:hazard-watch
npm run backoffice:review
```

The strategy cycle preserves unresolved work, keeps exactly three Editorial
copy packets active, refreshes image coverage and New Trail candidates, and
creates Newsletter and Analyst packets only when due. It prepares decisions;
it does not publish. The CEO dashboard links to the dedicated desks for each
queue, while Social remains launch-gated.

The hosted hazard workflow is inert unless it is started manually or the
repository variable `ORMA_HAZARD_AUTOMATION_ENABLED` is set to `true`. A run
opens or updates a dedicated hazard pull request; merging that reviewed PR is
the public warning gate. New Trail intake is also inert until manually
dispatched or `ORMA_NEW_TRAIL_AUTOMATION_ENABLED` is enabled. A selected
candidate enters the Existing Trails verification fleet; selection never
publishes a trail.

### Automatic verification cycle

`.github/workflows/orma-trail-campaign.yml` checks the catalogue every day at
06:15 UTC and fills, but never exceeds, a five-trail in-flight limit. It admits
only trails not already represented in durable orchestration state. The main
worker then performs this sequence:

1. Cartographer reconstructs the current OSM relation and opens the geometry
   human gate in `/trail-dossier-desk.html`.
2. A human geometry approval queues Logistics, Regulatory Ranger and Terrain &
   POI in parallel.
3. Evidence Librarian audits provenance; Red Team searches for counter-evidence.
4. Only a dossier with no mandatory unresolved, conflicted or counter-evidence
   finding unlocks final human approval.
5. Final approval changes the internal state to `ready-for-editorial`; it does
   not publish or mutate the website.

A human revision request targets one named specialist and blocks advancement
until that exact job completes. Each specialist receives up to five automated
resolution attempts after its initial pass. The sixth request blocks the trail
for manual escalation.

## Fleet registry and specialist agents

`agents/registry-v1.js` is the canonical list of logical ORMA agents. The first
specialist additions are the Cartographer, Regulatory Ranger, Evidence
Librarian and Red Team. Their complete operating instructions live in
`agents/prompts/`, and `contracts/agent-job-v1.js` defines the jobs that Cloud
Tasks will eventually dispatch to them.

`workflows/fleet-router-v1.js` assigns unresolved claims to their responsible
specialist. Agents may propose evidence and corrections but cannot approve a
claim or publish a trail. Once all mandatory claims appear supported, the
Evidence Librarian and Red Team must still run before the dossier reaches its
human editorial gate.

### Cartographer execution

`npm run backoffice:cartographer` fetches the current full-resolution OSM
relation for the selected candidate, reconstructs connected member ways,
retains the relation version and timestamp, compares computed distance with the
dossier's official reference metrics, and writes
`backoffice-data/cartographer-review.json`. Its output always requires the
human `geometry-approval` gate; a successful reconstruction is a proposal, not
an approved public route.

## Existing-catalogue verification campaign

`npm run backoffice:campaign -- --limit=5` inventories every production trail,
applies the modern ten-check graduation baseline, ranks incomplete public
records, and creates at most five draft Cartographer jobs. The campaign output
is `backoffice-data/catalogue-campaign.json`. It is explicitly `draft-only` and
cannot mutate public trail data. Existing curated presentation is not accepted
as modern verification when its source, date or graduation evidence is absent.
