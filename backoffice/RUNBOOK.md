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

## Failure recovery

### Worker or model failure

Open Backoffice Home and inspect **Automation health**. A failed run records the
stage, short error, consecutive-failure count and workflow link. Transient model
errors retry the same job and do not consume one of the five evidence attempts.

### Evidence remains unresolved

The claim ledger runs five materially different strategies at 0, 1, 6, 24 and
72 hours. After the fifth unresolved result, the claim becomes
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

## Activation and verification

Required repository variables:

- `ORMA_WORKER_AUTOMATION_ENABLED=true`
- `ORMA_CAMPAIGN_AUTOMATION_ENABLED=true`
- `ORMA_HAZARD_AUTOMATION_ENABLED=true`
- `ORMA_NEW_TRAIL_AUTOMATION_ENABLED=true`, kept inert by
  `ORMA_NEW_TRAIL_INTAKE_RESUMED`, which stays unset while the trail-photo and
  ORMA Verified backfills run.

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
