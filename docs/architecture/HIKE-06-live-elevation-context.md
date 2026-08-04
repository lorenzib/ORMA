# HIKE-06 — Live elevation context

**Status:** online hike-mode milestone implemented; offline elevation-map data
and physical-device validation remain open.

## Outcome

Entering fullscreen map or hike mode now moves the existing elevation profile
into the map as a persistent bottom panel. The map remains full-height behind
the panel, while the hike status and map controls are repositioned above it.

The live GPS update already drives the profile cursor. It now uses the nearest
point along the route segment, rather than the nearest stored route vertex, and
the visible readout reports:

- progress in kilometres; and
- interpolated **route elevation**, prefixed with `~` to avoid presenting sparse
  route samples as exact GPS altitude.

The static profile also exposes start elevation, high point, total climb, and
the route elevation range.

## Map elevation selector

The grouped map selector now uses the explicit labels:

- **Flat map** — the default label-first navigation view;
- **Satellite** — imagery under the route and labels; and
- **Elevation map** — a top-down MapLibre `hillshade` layer using the `igor`
  method and restrained colors.

Elevation map intentionally remains top-down. A tilted 3D terrain camera was
rejected for active navigation because remote DEM failure could blank or
distort the basemap. Shaded relief provides slope context while retaining route
geometry, labels, controls, and comparable screen distances. The implementation
follows the official MapLibre hillshade layer contract.

## Offline boundary

The Carezza offline package does not yet include an elevation profile or DEM
corridor. The standalone offline screen therefore must not claim this feature
yet. Closing the offline milestone requires:

1. adding a versioned elevation profile to the package contract;
2. driving its cursor from offline nearest-segment progress;
3. deciding whether a licensed, size-bounded offline DEM is viable;
4. showing Flat map only when no DEM is packaged; and
5. repeating iPhone and Android airplane-mode tests.

## Verification

Automated page checks require the live panel, explicit Flat map / Elevation map
labels, fullscreen panel relocation, nearest-segment progress, conservative
hillshade method, and accessible Close map state. Phone-sized browser checks
verify that the full map canvas, controls, and profile fit without clipping.
