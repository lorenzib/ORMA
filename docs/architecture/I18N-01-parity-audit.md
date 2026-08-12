# I18N-01 — Italian parity audit

Status: in progress (2026-08-12)

## Completed journey slices

- **Pre-hike readiness (UX-06):** package integrity and freshness, offline
  self-test, GPS permission/fix/error states, weather, trailhead, emergency
  boundary, summaries, and every modal action now render through the active
  English/Italian dictionary. English fallbacks remain available if the
  dictionary cannot be loaded.

## Machine-checkable boundary

`npm run check:i18n` now fails when:

- an English dictionary key lacks an Italian value or vice versa;
- a translated string changes or drops an interpolation placeholder;
- an HTML `data-i18n` attribute references an unknown key; or
- a literal JavaScript `t('…')` call references an unknown key.

The current dictionaries contain 453 matching English and Italian keys.

## Remaining migration

Dictionary parity is necessary but not sufficient. Several core screens still
create English state text directly in controllers, including recommendation,
recommendation, offline-download, saved-trail, journal, account-error and
mobile-nav states. Those strings must move behind stable keys before I18N-01
can be marked complete.

This work remains in the supporting backlog. It should be migrated by journey
and verified in both languages after concurrent navigation/notification UI work
has settled; the audit prevents new key/reference drift in the meantime.
