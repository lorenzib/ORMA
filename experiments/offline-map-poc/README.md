# Offline map proof of concept

This isolated experiment validates the download, verification, offline shell,
and GPS-overlay mechanics required by backlog item `OFF-01`.

It does **not**:

- register a service worker outside this directory;
- change the production `sw.js`;
- contain production map data;
- prove iPhone or Android support;
- make a production map-provider decision.

The background map is an explicitly synthetic fixture. It exists to test the
package boundary without copying or bulk-caching a third-party tile service.

## Run locally

From the repository root:

```sh
python3 -m http.server 8080
```

Open:

```text
http://localhost:8080/experiments/offline-map-poc/
```

Then:

1. Select **Download test trail**.
2. Wait for **Ready offline**.
3. Select **Verify package**.
4. In browser developer tools, switch the network to offline.
5. Close and reopen the proof-of-concept URL.
6. Confirm that the shell, map fixture, route, and safety facts still render.
7. Use **Simulate GPS** to move the position marker without granting location.

Real-device testing remains mandatory before `OFF-01` can be closed.

## Architecture exercised

- A versioned service-worker shell cache.
- A separate, versioned cache per downloaded package.
- An explicit manifest listing required resources.
- Post-download verification before showing `Ready offline`.
- Storage usage and quota estimates through `StorageManager`.
- A georeferenced local image with route and position overlays.
- Cache removal that targets only this experiment.

