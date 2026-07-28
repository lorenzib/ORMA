# AUTH-01 — Account, entitlement, and local-data rules

**Status:** Complete

**Decision date:** 2026-07-27

## Outcome

DoloPaws uses an account to acquire or change account-bound services, not to
unlock safety data that is already on the device.

- Browsing and trying the dog recommendation flow remain available to guests.
- Installing or updating an offline trail package requires a valid session.
- An installed package, its map, and its GPS position remain usable without a
  token refresh, after session expiry, and after logout.
- Anyone using the device can remove a local package without signing in.
- Saving, syncing, GPX export, and other server-backed private actions require
  a valid session.
- Public contribution is a separate entitlement. Authentication is necessary
  but not sufficient; publication requires the verified-contributor policy
  defined by AUTH-02.

The machine-readable source of truth is
`config/account-entitlements.json`. Automated tests protect its safety-critical
invariants.

## Identity and session states

| State | Meaning |
|---|---|
| Guest | No DoloPaws account is authenticated on this device. |
| Authenticated | A valid session exists, but contribution eligibility is not established. |
| Verified contributor | A valid session exists and AUTH-02's publication requirements are satisfied. |
| Expired session | This device previously authenticated the owner, but cannot currently authorize server work. |
| Logged out | A user explicitly ended the session. |
| Deleted account | The server identity no longer exists. Only deliberately retained public local data can remain. |

An account that is disabled, revoked, or otherwise rejected by the server is
treated like an expired session until the client receives a definitive account
state. It cannot install, update, export, sync, or publish.

## Capability matrix

| Capability | Guest | Authenticated | Verified contributor | Expired | Logged out | Deleted |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Browse trails | Yes | Yes | Yes | Yes | Yes | Yes |
| Use an unsaved local dog-profile draft | Yes | Yes | Yes | Yes | Yes | Yes |
| Save or sync private data | No | Yes | Yes | No | No | No |
| Install or update an offline package | No | Yes | Yes | No | No | No |
| Open an installed package | Yes | Yes | Yes | Yes | Yes | Yes |
| Use GPS in an installed package | Yes | Yes | Yes | Yes | Yes | Yes |
| Remove an installed package | Yes | Yes | Yes | Yes | Yes | Yes |
| Export GPX | No | Yes | Yes | No | No | No |
| Draft a community contribution locally | Yes | Yes | Yes | Yes | Yes | Yes |
| Publish a community contribution | No | No | Yes | No | No | No |
| Queue an owner-bound private hike outcome | No | Yes | Yes | Yes | No | No |
| Sync a queued private hike outcome | No | Yes | Yes | No | No | No |

“Draft” means text may exist temporarily in the form while a user authenticates.
It does not mean DoloPaws accepts, stores, or displays the contribution
publicly. Free-form contribution content must not be placed in a URL.

Package removal is deliberately exempt from the account requirement for
package management. A person must always be able to recover device storage and
erase local data.

## Offline package ownership

The beta offline package contains public trail data: map, route, safety points,
trail facts, manifest, licence, and attribution. It must contain no
authentication token, email address, display name, dog profile, precise
location history, or private hike outcome.

At installation, package metadata will record an opaque device-owner key. The
key is used only to distinguish accounts on the same browser. The interface
must say “Downloaded by another account on this device”; it must not reveal the
other person's identity.

The ownership rules are:

1. The current authenticated account can install or update a package.
2. Any device user can open an installed package and use its GPS view.
3. Any device user can remove an installed package.
4. A different signed-in account may replace and reassociate the public
   package through a new authenticated download.
5. Owner-bound private records, pending uploads, and active-hike history are
   stored separately from the public package and are never exposed to another
   account.

The browser may evict storage. “Available offline on this device” is the
permitted promise; “permanently downloaded” is not.

## Session expiry and offline operation

Token refresh is not part of the offline safety path. When a session expires
or connectivity disappears:

- verified installed resources continue to open;
- GPS permission and fixes are handled entirely on the device;
- the last valid fix, route geometry, safety facts, attribution, and package
  status remain available;
- package installation and update are disabled until reauthentication;
- server reads, saving, GPX export, sync, and contribution publication wait for
  reauthentication;
- an already identified owner may queue a private hike outcome locally, but
  only the same account can sync it after reauthentication.

The client must never delete an installed trail merely because token refresh
failed.

## Logout

Ordinary logout:

1. ends the authenticated session;
2. clears cached profile summaries and other directly identifying UI state;
3. locks owner-bound private local data;
4. retains verified public offline trail packages by default so a route is not
   unexpectedly lost;
5. says explicitly that downloaded trails remain on the device.

Logout must also offer **Log out and remove local data** for shared devices.
That action removes DoloPaws-owned packages, owner-bound local records, active
hikes, pending uploads, and profile summaries for the current browser. It must
not delete unrelated browser caches.

If an active hike exists, the user must be told exactly whether it will be
finished, retained for the same account, or discarded before logout proceeds.
HIKE-01 and AUTH-03 will implement that choice.

## Account deletion

Deleting the server account and cleaning the current device are separate
operations and must be described separately.

The required sequence is:

1. Reauthenticate the user.
2. Name the server data scheduled for deletion.
3. Complete the server deletion, or show a precise failure without claiming
   success.
4. Always remove authentication state and owner-bound private data from the
   current device.
5. Ask whether to retain the public offline trail packages on this device or
   remove all DoloPaws local data. On a shared device, removal is the recommended
   default.
6. Confirm separately what was deleted from the server and what remains on the
   device.

A retained public package remains usable after deletion, but it has no account
entitlement: it cannot be updated until another account authenticates.

The current account screen's broad promise to delete “all dog profiles, saved
trails and journals” must not be relied on until AUTH-03 inventories and
deletes every server collection and local record.

## Authentication detours and pending intent

When a guest selects a protected action, DoloPaws preserves only enough intent
to resume it:

- an allowlisted action: `save`, `download`, `review`, `photo`, `report`, or
  `export-gpx`;
- the trail identifier;
- a same-origin, allowlisted return path;
- creation time and a maximum lifetime of 30 minutes.

Pending intent is single-use. It never contains a password, token, email
address, free-form contribution body, dog profile, or precise location
history. Malformed, expired, cross-origin, or already-consumed intent is
discarded, and the user returns to the relevant trail with a neutral
explanation.

After authentication, the action is resumed only if the new session has the
required entitlement. In particular, login may resume a contribution draft,
but publication still waits for verified-contributor eligibility.

## Security boundary

This contract controls product behavior; it is not server authorization.

- Client-side buttons and route guards are usability controls only.
- Firestore Security Rules must independently enforce ownership, field shape,
  size, allowed state transitions, and verified-contributor publication.
- Firebase Authentication tokens must never be stored in offline package
  manifests, Cache Storage, URLs, analytics, or application logs.
- Public offline packages are not confidential and are not digital-rights
  management.
- Later paid access cannot retroactively change these safety guarantees without
  a new explicit entitlement and migration decision.

SEC-01 and SEC-02 implement and test the server boundary.

## Current implementation gaps

AUTH-01 defines the contract; it does not claim these follow-ons are built:

| Gap | Follow-on |
|---|---|
| Offline metadata has no opaque owner key. | OFF-03 / AUTH-03 |
| Logout neither discloses retained packages nor offers complete local cleanup. | AUTH-03 |
| Owner-bound offline hikes and queued outcomes are not partitioned yet. | HIKE-01 / OUT-01 |
| Account-deletion copy overstates the data currently deleted. | AUTH-03 |
| Server deletion does not yet inventory every user-owned collection. | AUTH-03 / SEC-01 |
| Any signed-in account can currently attempt community publication. | AUTH-02 / SEC-01 |
| Pending intent uses a URL action but has no timestamp or 30-minute expiry. | UX-05 |

These gaps are explicit backlog work. They do not weaken the rule that the
already installed map and GPS view must remain available during a hike.

## Acceptance scenarios

1. A guest cannot start a download and is returned to the same trail after
   login; the download then starts only after confirmation.
2. An installed package opens in airplane mode with no token refresh.
3. A session expiring during a hike does not close the map or GPS view.
4. A logged-out user can open or remove an installed package but cannot update
   it.
5. A second account cannot read the first account's private drafts, active
   hike, or queued outcomes.
6. An authenticated but unverified account can download a route but cannot
   publish a review, rating, photo, or hazard report.
7. A verified contributor can publish only when server rules independently
   approve the request.
8. Account deletion removes private local data and clearly records whether
   public packages were retained.
9. An invalid or expired pending action is discarded without redirecting
   off-site or exposing form content.

## Follow-on work

1. **AUTH-02:** define and implement verified-contributor eligibility and
   recovery messages.
2. **SEC-01/02:** enforce and test the same rules on the server.
3. **AUTH-03:** implement explicit logout cleanup and account-deletion scopes.
4. **OFF-03:** add owner-aware package metadata and storage management.
5. **UX-05:** replace the current URL-only pending action with the bounded,
   expiring contract.
