# ORMA hosted backoffice runbook

This runbook is the operator companion to
[`OPERATING_STANDARD.md`](./OPERATING_STANDARD.md). It explains how to observe,
recover and verify the live fleet without bypassing a human gate.

## Where the fleet lives

- Operator UI: `https://dolopaws-backoffice.web.app/backoffice-review.html`
- Intended custom domain: `https://backoffice.app-orma.com`
- Durable state and decision receipts: protected Firestore in the historical
  `dolopaws` Firebase project
- Scheduled execution: GitHub Actions in `lorenzib/ORMA`
- Public website changes: pull requests or the separately gated Editorial
  source-file publisher; agents do not silently mutate the public catalogue

The public ORMA app has no administrator sign-in or backoffice navigation.
Only a Firebase user with the `moderator` custom claim can read protected state
or append a CEO decision.

## Normal operating rhythm

| Workflow | Target cadence | Human gate |
| --- | --- | --- |
| Queue worker | Every fifteen minutes | Geometry, final dossier, trail content and release decisions |
| Publication receipt reconciler | Every fifteen minutes, inside the queue worker | No new gate; records only a commit already proven live by GitHub Pages |
| Groundskeeper | Hourly at minute 7, Europe/Rome, clear of the quarter-hour queue worker | Automatic removal only when a successfully fetched authoritative active-warning feed affirmatively resolves the warning; expiry-only cases remain human-gated |
| ORMA Verified intake | Daily at 09:30 Europe/Rome, after the Firestore quota reset window, plus due-only worker catch-up | New admissions still enter the normal trail gates |
| Strategy cycle | Parked during the MVP catalogue-and-coverage phase | Existing artifacts remain available for manual recovery |
| New Trail scouting | Monday–Saturday at 10:00 Europe/Rome, after the Firestore quota reset window, Dolomites first | Select, park or reject a candidate |
| Newsletter | Parked until content readiness is explicitly confirmed | Existing drafts are preserved read-only; no generation, revision or handoff runs |
| Analyst | Parked during the MVP catalogue-and-coverage phase | Existing work is preserved; no new opportunity or mock-up work is generated |

GitHub cron is a target rather than proof of execution. Backoffice Home reads
the saved worker and campaign health receipts and links the exact workflow run.

## What happens after a click

1. The page disables its controls and appends an immutable Firestore decision.
2. The decision immediately leaves the CEO queue and appears in **What happened
   after your clicks** as saved, queued, processing, processed or blocked.
3. The queue worker claims the handoff on its next healthy run. Revision jobs
   are processed immediately; they do not wait for a weekly cycle.
4. The revised or downstream artifact returns to the named desk. The same
   upstream fact is not reviewed twice.

If a page looks unchanged, use **Refresh now** on Backoffice Home. Do not click
the original action repeatedly: the visible receipt is the source of truth.

## Gates you never see

Some trails arrive at a gate asking for research rather than a decision: a start
point no source has been read for, a route sequence nobody has gone looking for.
Those are not yours to answer, so the worker sends them to the agent whose
findings they are, before it applies the decisions in the same pass. They appear
in the run output under `gateDispatches` and in the decision history as
`orma-gate-dispatch-v1`, and the trail comes back to the desk once the agent has
answered.

It only ever requests a revision. Nothing is approved, waived or rejected
without you. A gate is left standing — and stays visible to you — when its
blockers name no agent at all, when nothing on it is work a re-run could
finish, when the automated-resolution limit is reached, or when a decision of
yours is already waiting to be applied.

That second one is the common case and it is deliberate. Where the sources were
read and disagree, the agent has already answered; asking it again gets the same
disagreement back. Those gates are yours, and they are the ones the adjudicator
researches first.

The gates that are left get a recommendation instead. Beside each blocker you
can tick off, the adjudicator writes why it thinks the blocker does not stop
verification, with the publisher and a quote you can open. Nothing is ticked
for you and nothing is accepted until you tick it; the suggested sentence is
editable, and yours is what is kept with the verification. Where it looked and
could not justify accepting, it says so instead — that is the answer more
often than not, and it is worth reading before you decide. Recommendations
appear in the run output under `gateAdjudications`.

## Failure recovery

### Worker or model failure

Open Backoffice Home and inspect **Automation health**. A failed run records the
stage, short error, consecutive-failure count and workflow link. Transient model
errors retry the same job and do not consume one of the five evidence attempts.

### Evidence remains unresolved

The claim ledger runs five materially different strategies at 0, 0, 1, 1 and
6 hours. A strategy that ran and found nothing is followed promptly, because
the delay between strategies never protected anything: a model or provider
error is rescheduled separately and costs the claim none of its five attempts.
After the fifth unresolved result, the claim becomes
`source-exhausted`; it requires authority contact, a field check or a continued
block. No unknown fact is promoted to green.

### Approved trail publication fails

The approval stays valid. The worker writes a durable publication-failure
receipt with the failed stage, workflow link and next eligible retry. Correct
the external problem, then manually run **ORMA backoffice worker** with
**Force publication retry** enabled.

For the known GitHub PR-creation circuit breaker, an owner must first open:

`Repository Settings → Actions → General → Workflow permissions`

and enable **Allow GitHub Actions to create and approve pull requests**. This
allows the worker to open the review PR; it does not merge or publish the trail
without the existing final PR review.

After the PR is merged, the fifteen-minute **ORMA backoffice worker** checks for
the latest successful GitHub Pages run on `main`. It obtains the evidence from
the GitHub Actions API, checks out that exact deployed commit, matches the
committed approval IDs, changes the protected receipt from
`pull-request-opened` to `published`, records the commit and deployment-run
URL, clears the final-PR gate, and adds the live trail link to **What happened
after your clicks**. A delayed Pages run is an expected waiting state: the next
worker pass checks again without claiming publication early.

If reconciliation is ever missed, manually run **Confirm ORMA trail
deployment**. Leave its optional commit blank to verify the latest successful
Pages deployment, or supply the known deployed commit to verify that exact
deployment. The workflow discovers and validates the successful run itself; do
not paste an unverified run URL or edit the Firestore receipt directly.

## Draining the verification queue

The scheduled worker runs ten specialist jobs every three hours. When the
queue is longer than that clears -- the state report's `specialistJobs` says
how many are queued -- run **ORMA verification drain** from the Actions tab.
It repeats the worker's pass back to back under the worker's lock and stops
on the first of: two idle passes (nothing left to claim), the clock budget,
or the Firestore read or write budget. The defaults (240 minutes, 20,000
reads, 8,000 writes) leave most of the free tier's day to the crons and the
desk; lower them on a day the state report has already been run several
times, because every report is reads too.

The run summary and the `verification-drain` artifact carry the ledger: reads,
writes and jobs per pass, and reads per job. That is the number to size a
budget from -- and the number that says what Blaze would cost.

The drain publishes nothing. A trail it carries to editorial or publication
is picked up by the next scheduled worker pass, which materialises, opens
the pull request, merges after Validate ORMA, and deploys.

## Activation and verification

Required repository variables:

- `ORMA_WORKER_AUTOMATION_ENABLED=true`
- `ORMA_CAMPAIGN_AUTOMATION_ENABLED=true`
- `ORMA_HAZARD_AUTOMATION_ENABLED=true`
- `ORMA_NEW_TRAIL_AUTOMATION_ENABLED=true`, kept inert by
  `ORMA_NEW_TRAIL_INTAKE_RESUMED`, which stays unset while the trail-photo and
  ORMA Verified backfills run.

Gate dispatch is on by default and needs no variable. Set
`ORMA_GATE_DISPATCH_ENABLED=false` to stop it, or `ORMA_GATE_DISPATCH_LIMIT` to
change how many gates one pass may hand over (default 3).

The adjudicator is likewise on by default: `ORMA_GATE_ADJUDICATION_ENABLED=false`
stops it, `ORMA_GATE_ADJUDICATION_LIMIT` sets how many gates one pass may
research (default 2, lower than the dispatch because each one is a web search).

Trail-photo coverage no longer has an activation variable. It runs inside every
worker pass and stops queueing on its own once every published trail has a
photo, so `ORMA_IMAGE_AUTOMATION_ENABLED` is obsolete and can be deleted from
the repository variables.

Website copy review is parked during the MVP catalogue-and-coverage phase.
Existing packets, including Safety Library packets, remain retained in their
protected paused archives; no scheduled copy generation runs.

Required secrets are `OPEN_API_KEY` and `FIREBASE_SERVICE_ACCOUNT`. Social has
no production credentials and remains launch-gated.

Trail-photo uploads use the existing protected Firestore queue and do not need
a Firebase Storage bucket or a paid storage plan. The browser enforces the
560 KiB compressed-image limit; the publication worker moves approved bytes to
GitHub and removes the temporary Firestore copy after live deployment is proven.

Run the repeatable code-and-configuration audit before an operational release:

```sh
npm run backoffice:audit
npm run quality:gate
npm run build:backoffice-hosting
npm run test:static
```

`quality:gate` requires Java 21 for the Firestore emulator. GitHub's
**Validate ORMA** workflow supplies it. A production verification is complete
only when Firestore rules, private Hosting and Validate ORMA are green and a
controlled workflow run reports protected outputs without an unintended public
mutation.
