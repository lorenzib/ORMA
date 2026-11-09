# UX-06 — Pre-hike readiness

Status: Complete in code (2026-07-30)

## One tap to record (SOCIAL-03, 2026-11-06)

Starting a hike no longer opens the readiness sheet first. "Start the hike"
begins recording at once, as Strava, Komoot and AllTrails do: the phone asks
for location itself, and hike mode explains a refusal, a timeout or a missing
position. While the GPS warms up the status panel says, in one line, that the
recording ends by itself and that the waymarks still lead.

The sheet repeated what the trail page already shows (the offline-map
button, the weather card, directions and the safety guide), so it now opens
only on a phone with no geolocation at all, as a checklist with no Start
button, because there is nothing to record with.

On a phone the recording screen is the map, a calm panel (time, km walked,
share of the route) and one pause button; pausing offers Resume or Finish
walk (SOCIAL-04). The one-tap "We walked this" is gone: a walk counts only
when it is recorded.

A recording ends itself once the walk is proven (75% of the line covered, see
`walk-proof.js`) and the walker is back at the finish: where the recording
started for a loop or an out-and-back (an out-and-back must have reached the
far end first), or the far end of the line for a one-way walk.

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

The sheet marks as blocking only what makes recording impossible:

- geolocation is unsupported;
- location permission is denied; or
- the device is offline and its attempted package is corrupt or incomplete.

A GPS fix not checked yet, or not yet accurate enough, is an advisory: hike
mode waits for a usable fix before it counts progress. Missing offline
coverage, a package not yet downloaded while online, stored information that
needs a current-notice check, unavailable weather, a missing trailhead pin,
and an unrun offline self-test are advisories too. The self-test is only
shown when an offline package is installed, because it has nothing to test
otherwise.

## Offline self-test

For an installed package, **Run test** re-verifies every required cached
resource with the package checksum contract. A pass is remembered for the
current page session for 12 hours. The user is then instructed to switch the
phone to airplane mode and open the offline map, since code cannot switch the
device's radio mode.

## Safety boundary

The readiness sheet always states that ORMA is a planning companion, not
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
