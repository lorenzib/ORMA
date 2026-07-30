# METRIC-01 — Privacy-safe event API

Status: Complete in code (2026-07-30)

## Consent first

Product analytics are disabled by default. Until the user explicitly enables
**Share anonymous product usage** in Settings, `metrics.js` does not create a
pseudonymous identifier and rejects every event with `consent-required`.

Enabling the setting creates a random browser-only identifier. Withdrawing
consent immediately removes the queued events and identifier. Consent status
and its hour-level update time remain locally so the preference is respected.

This is separate from the anonymous per-trail weekly hike counter, which stores
only a server timestamp under the public trail ID and does not use this API.

## Schema-locked events

The API accepts exactly the eight Day 4 families:

1. `discovery_search`
2. `dog_profile`
3. `trail_decision`
4. `trail_saved`
5. `offline_package`
6. `hike_session`
7. `community_contribution`
8. `post_hike_outcome`

Each family has an explicit state list and property allowlist. Values are
limited to booleans, bounded counts, IDs, version strings, and controlled
category slugs. Unknown families, states, properties, and malformed values are
rejected before storage.

Property names associated with personal content, authentication, search text,
health information, precise location, coordinates, or GPS history are rejected
even if a future caller accidentally attempts to submit them. Arrays and
nested objects are not accepted.

## Queue and delivery

Accepted events contain:

- schema version;
- a stable event ID;
- the random browser identifier;
- family and state;
- allowlisted properties; and
- an hour-level timestamp.

The local queue is capped at 200 events and each event expires after 30 days.
Offline events remain queued. A delivery failure retains the same event ID for
retry, allowing the eventual receiver to enforce idempotency. Successful
delivery removes the event before the next one is attempted.

METRIC-01 deliberately does not install an advertising or third-party
analytics SDK and does not invent a production receiver. METRIC-02 will connect
the core funnel to this API and its approved first-party transport.

## Separation from operational state

The queue has its own `dolopaws-metrics-v1` key. It does not read active hike
sessions, completion records, profiles, authentication, community content, or
offline packages. Operational GPS progress therefore remains separate from
product analytics.

## Verification

Automated tests cover all eight families, consent-off behavior, withdrawal,
schema and value validation, prohibited properties, coarse timestamps,
retention and queue limits, offline queuing, failed delivery, stable retry IDs,
and exactly-once removal after acknowledgement.
