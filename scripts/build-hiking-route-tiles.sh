#!/usr/bin/env bash
# Builds the hiking network we draw ourselves (see build-hiking-routes.js) as
# one folder of vector tiles covering every region:
#
#   scripts/build-hiking-route-tiles.sh <work-dir> <out-dir>
#
# <out-dir> ends up holding {z}/{x}/{y}.pbf, uncompressed so GitHub Pages can
# serve each tile as a plain file and MapLibre reads it with no plugin.
# <work-dir> keeps the extracts and one .mbtiles per region for measuring; an
# extract already there is reused rather than downloaded again.
#
# Needs osmium-tool, tippecanoe (with tile-join) and Node. The build server
# installs Ubuntu's own packages; nothing is built from source.
set -euo pipefail

WORK="$1"
OUT="$2"
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$WORK"

regions="$(node -p "Object.keys(require('$HERE/build-hiking-routes').REGIONS).join(' ')")"
for region in $regions; do
  bbox="$(node -p "require('$HERE/build-hiking-routes').REGIONS['$region'].bbox.join(',')")"
  extract="$(node -p "require('$HERE/build-hiking-routes').REGIONS['$region'].extract")"
  pbf="$WORK/$region.osm.pbf"
  if [ ! -s "$pbf" ]; then
    curl -fsSL --retry 3 -A "ORMA hiking route tiles (github.com/lorenzib/ORMA)" \
      -o "$pbf" "https://download.geofabrik.de/$extract-latest.osm.pbf"
  fi
  osmium extract --bbox "$bbox" --strategy complete_ways "$pbf" -o "$WORK/$region-area.osm.pbf" --overwrite
  osmium tags-filter "$WORK/$region-area.osm.pbf" r/route=hiking,foot -o "$WORK/$region-hiking.osm.pbf" --overwrite
  # Untagged nodes go once their coordinates are on the ways, and OPL leaves
  # those coordinates off unless asked for them.
  osmium add-locations-to-ways "$WORK/$region-hiking.osm.pbf" -o "$WORK/$region-located.osm.pbf" --overwrite
  osmium cat "$WORK/$region-located.osm.pbf" -f opl,locations_on_ways=true -o "$WORK/$region.opl" --overwrite
  node "$HERE/build-hiking-routes.js" "$WORK/$region.opl" "$WORK/$region.geojsonseq" | tee "$WORK/$region-counts.json"
  # z10 is the widest a trail page opens; MapLibre overzooms past 14. No tile
  # size limit, so no route is silently dropped from a crowded tile.
  tippecanoe -o "$WORK/$region.mbtiles" -l routes -Z10 -z14 \
    --clip-bounding-box="$bbox" --no-tile-size-limit --force --quiet \
    -y id -y ref -y name -y network -y rank \
    "$WORK/$region.geojsonseq"
done

rm -rf "$OUT"
# The regions never share a tile, so they join into one folder and one source.
tile-join -e "$OUT" --no-tile-compression --no-tile-size-limit --force \
  $(for region in $regions; do echo "$WORK/$region.mbtiles"; done)
echo "Tiles: $(find "$OUT" -name '*.pbf' | wc -l) files, $(du -sh "$OUT" | cut -f1)"
