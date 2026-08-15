# CLEAN-01 — Production tree cleanup

Status: complete (2026-08-11)

## Removed artifacts

- `.DS_Store`: tracked macOS Finder metadata with no product value.
- `ORMA Homepage - Split Hero.html`: a 938 KB bundled historical homepage
  prototype superseded by `index.html` and the canonical discovery journey.
- `dolopaws-combined-preview.html`: a standalone new/returning-user mockup whose
  behaviour is now implemented by the canonical homepage and account state.

Both prototypes had no application links or script consumers and were already
excluded explicitly from the production build. Their Git history is the
recovery archive; keeping duplicate HTML in the deployable repository root
would make obsolete UI look maintained.

## Preserved experiments

`experiments/` remains tracked and excluded by `_config.yml`. Its offline-map
proof of concept and package harness have documented architecture value and
tests, so they are not dead prototypes.

## Ongoing hygiene

`.gitignore` excludes `.DS_Store`, debug logs, dependency trees and caches.
Automated coverage verifies that retired previews stay absent and the active
experiment boundary stays excluded from deployment.

