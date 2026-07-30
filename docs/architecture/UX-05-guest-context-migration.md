# UX-05 — Guest context through account creation

Status: Complete in code (2026-07-30)

## Preserved context

`guest-context.js` stores one versioned, bounded pending-context record in
local storage. It can contain:

- the intended account-gated action;
- the current trail ID and safe same-site return target;
- allowlisted discovery filters and region; and
- a sanitized dog-profile draft.

The record lasts no longer than 30 minutes. Return targets, trail IDs, actions,
filter fields, and dog-profile fields are allowlisted. Passwords, tokens,
email addresses, free-form contributions, and location history are never
included.

Save and Download both use the trail action controller. When a guest selects
one of those actions, the controller records the current context before opening
sign-in. After authentication, only a matching, unexpired, trail-bound action
can be consumed. Consumption is single-use and removes the action from the URL.

## Dog-profile migration

The existing dog wizard still creates its local device draft. On the next
authentication event, the guest-context controller adopts a fresh legacy draft
before the older automatic migration handler can run.

Migration then requires an explicit choice:

- **Save dog profile** rechecks the account immediately before writing.
- **Keep on this device** leaves the wizard's local draft in place.
- When an account profile already exists, it is kept and never overwritten;
  the user can keep or discard the device draft.

This preserves the value created before registration without making account
data changes merely because somebody signed in.

## Failure behavior

Malformed, expired, future-dated, cross-trail, unsupported-action, and unsafe
return-target records fail closed. A stale URL action is cleared without
performing Save or Download. Storage failures leave the normal authentication
flow available but do not authorize the deferred action.

## Verification

Automated tests cover:

- versioned capture and allowlisting;
- expiry and malformed-record removal;
- trail-bound, single-use consumption;
- safe legacy-draft adoption and conflict detection;
- script ordering before authentication handlers; and
- Save and Download integration with the shared action controller.
