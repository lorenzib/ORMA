# UX-06 — Pre-hike readiness

Status: Complete in code (2026-07-30)

## One check before recording

Starting a new hike from the canonical trail page now opens a readiness sheet
before GPS recording begins. Resuming an already-started durable hike does not
repeat the gate.

The sheet combines the states already owned by the offline, GPS, weather, and
trail-detail components:

- installed-package verification;
- stored-information review state;
- the cached-file and airplane-mode self-test;
- browser location permission and a current usable GPS fix;
- a weather snapshot no older than 30 minutes;
- a real trailhead coordinate;
- EU emergency information and the safety guide.

No new safety facts are invented by this layer. Trailhead coordinates come
from the trail record, package status comes from checksum verification, GPS
quality comes from the shared HIKE-03 policy, and weather comes from the
existing Open-Meteo response.

## Blocking and advisory policy

A new hike cannot begin when:

- geolocation is unsupported;
- location permission is denied;
- no GPS check has been run;
- the fix is stale or too inaccurate for progress; or
- the device is offline and its attempted package is corrupt or incomplete.

Missing offline coverage, a package not yet downloaded while online, stored
information that needs a current-notice check, unavailable weather, a missing
trailhead pin, and an unrun offline self-test are advisories. They remain
visible without making every trail outside the first Carezza package unusable.

The final Start button becomes available only when blocking checks pass.

## Offline self-test

For an installed package, **Run test** re-verifies every required cached
resource with the package checksum contract. A pass is remembered for the
current page session for 12 hours. The user is then instructed to switch the
phone to airplane mode and open the offline map, since code cannot switch the
device's radio mode.

## Safety boundary

The readiness sheet always states that DoloPaws is a planning companion, not
an emergency-navigation service. It says that offline maps and GPS do not
replace waymarks, judgment, equipment, or emergency preparation, and links to
the emergency section of the safety guide.

## Verification

Automated tests cover:

- every blocking GPS state and the usable-fix path;
- package-ready, missing, broken-online, and broken-offline states;
- current and stale package information;
- current and expired weather snapshots;
- self-test expiry;
- real and missing trailhead coordinates;
- script ordering and weather-state publication; and
- the explicit emergency-navigation boundary.
