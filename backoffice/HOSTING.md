# ORMA private backoffice hosting

The operator interface is a separate Firebase Hosting site:

- Firebase site ID: `dolopaws-backoffice`
- temporary address: `https://dolopaws-backoffice.web.app`
- intended address: `https://backoffice.app-orma.com`
- Firebase project: `dolopaws` (the project's historical internal name)

## Security boundary

Firebase Hosting serves static interface files publicly. A browser redirect is
not a data-security boundary, so the Hosting package must never contain files
from `backoffice-data/`, `data/`, or any generated review JSON.

The deployed package contains only the sign-in shell and protected operator
interfaces. Existing Trails, New Trails, Groundskeeper, Editorial, image
coverage, Newsletter and Analyst state is read from or appended to Firestore
after Firebase verifies the `moderator` custom claim. Firestore rules remain
the authoritative access boundary. Social remains visible but launch-gated and
has no publishing credentials.

Trail verification and guide editing remain separate workflows even though
both are reachable from the persistent backoffice navigation.

## Deployment

`npm run build:backoffice-hosting` creates `dist/backoffice` from an explicit
allowlist and fails if a JSON or internal data directory enters the package.

Pull requests validate that package. A change merged to `main` deploys only the
`backoffice` Firebase target, which maps to `dolopaws-backoffice`, subject to the
repository's production environment gate. The GitHub deployment identity uses
the existing `FIREBASE_SERVICE_ACCOUNT` secret and the Firebase Hosting Admin
role.

The temporary Firebase domain and, once connected, `backoffice.app-orma.com`
must both be listed in Firebase Authentication's authorized domains.

See [`RUNBOOK.md`](./RUNBOOK.md) for schedules, decision receipts, health and
failure recovery.
