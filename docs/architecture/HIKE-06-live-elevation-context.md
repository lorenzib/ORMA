# HIKE-06 — Live elevation context

**Status:** online hike mode and stored offline route profiles implemented for
Carezza and Alpe di Siusi; an offline DEM decision and physical-device
validation remain open.

## Outcome

Entering fullscreen map or hike mode now moves the existing elevation profile
into the map as a persistent bottom panel. The map remains full-height behind
the panel, while the hike status and map controls are repositioned above it.

The live GPS update already drives the profile cursor. It now uses the nearest
point along the route segment, rather than the nearest stored route vertex. The
two distance concepts are deliberately kept separate:

- the hike status reports distance actually walked since Start, independent of
  the recommended trailhead or direction; and
- the profile cursor reports position along the route geometry so it can show
  the corresponding elevation; plus
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

Carezza beta.17 and Alpe di Siusi beta.4 now contain a mandatory, checksum-
verified `route-profile-v1` resource. The standalone offline screen renders
the stored profile and drives its cursor from nearest-segment route progress.
The readout remains explicitly approximate route elevation rather than GPS
altitude.

No offline DEM is currently packaged. The screen therefore keeps the stored
basemap flat and says so instead of exposing an elevation-map control that
would fail in airplane mode. Closing the remaining offline milestone requires:

1. deciding whether a licensed, size-bounded offline DEM materially improves
   the beta journey;
2. retaining Flat map as the safe fallback when no DEM is packaged; and
3. repeating iPhone and Android airplane-mode tests for profile rendering and
   live cursor behavior.

## Verification

Automated page checks require the live panel, explicit Flat map / Elevation map
labels, fullscreen panel relocation, nearest-segment progress, conservative
hillshade method, and accessible Close map state. Phone-sized browser checks
verify that the full map canvas, controls, and profile fit without clipping.
