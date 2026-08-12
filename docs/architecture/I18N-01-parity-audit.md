# I18N-01 — Italian parity audit

Status: in progress (2026-08-12)

## Completed journey slices

- **Pre-hike readiness (UX-06):** package integrity and freshness, offline
  self-test, GPS permission/fix/error states, weather, trailhead, emergency
  boundary, summaries, and every modal action now render through the active
  English/Italian dictionary. English fallbacks remain available if the
  dictionary cannot be loaded.
- **Downloaded-trail management (OFF-03):** empty/error/signed-out states,
  lifecycle labels, ownership metadata surroundings, update and checksum
  progress, repair, self-test, and confirmed removal actions are bilingual.
- **Canonical recommendation (UX-04/SCORE-01):** conclusion, confidence,
  personalized context, stable coded reasons and cautions (including dynamic
  distance/ascent/terrain values), evidence summary, guide links, profile-gap
  prompts, and save/compare/download actions are bilingual. Scoring output is
  unchanged; translation happens only in presentation.
- **Trail-detail offline panel (OFF-03/OFF-05):** download, update, interrupted,
  repair, stale, verified, self-test, removal and account-required states are
  bilingual, including local package ownership/date/size context.
- **Saved trails (SAVE-01):** loading, signed-out, empty, load-error and stale
  catalogue-reference states are bilingual, together with personalized
  headings, recommendation reasons, card badges, accessible route/photo
  labels, trail actions, removal progress and outcome notices.
- **Walk journal (JOURNAL-01):** signed-out and empty states, personalized
  headings, summary metrics, filters, timeline actions, trail picker, manual
  logging, editing, photos, sharing, validation and storage errors are
  bilingual. Stored condition codes remain stable and only their display is
  translated.
- **Shared account access (AUTH-02):** sign-in and sign-up progress, local
  validation, password-reset failures, Google popup failures, invalid
  credentials, throttling and offline recovery are bilingual on every page
  that opens the shared authentication dialog. Firebase error codes remain
  machine-readable until presentation instead of leaking English backend copy.
- **Shared navigation:** skip link, primary destinations, notification bell,
  mobile menu state, account and dog switcher actions, saved/downloaded links,
  moderator access, logout and the injected alpine-plants guide link are
  bilingual. The navigation re-renders when i18n becomes ready so later auth
  refreshes cannot revert Italian labels to English.

## Machine-checkable boundary

`npm run check:i18n` now fails when:

- an English dictionary key lacks an Italian value or vice versa;
- a translated string changes or drops an interpolation placeholder;
- an HTML `data-i18n` attribute references an unknown key; or
- a literal JavaScript `t('…')` call references an unknown key.

The current dictionaries contain 800 matching English and Italian keys.

## Remaining migration

Dictionary parity is necessary but not sufficient. Several core screens still
create English state text directly in the account-management controller. Those
strings must move behind
stable keys before I18N-01 can be marked complete.

This work remains in the supporting backlog. It should be migrated by journey
and verified in both languages after concurrent navigation/notification UI work
has settled; the audit prevents new key/reference drift in the meantime.
