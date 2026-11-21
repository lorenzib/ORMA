#!/bin/bash
# Dry-builds every row of $S/work/jobs.tsv with run.js (never --apply).
# usage: buildall.sh <workDir> [repoDir]   (repoDir defaults to this checkout)
S="$1"; REPO="${2:-$(git -C "$(dirname "$0")" rev-parse --show-toplevel)}"
mkdir -p "$S/builds" "$S/tiles"
while IFS=$'\t' read id km up t tb title; do
  [ -s "$S/builds/$id.log" ] && continue
  extra=""; [ "$tb" = 1 ] && { extra="--there-and-back"; km=$(python3 -c "print(round($km*2,1))"); }
  OUT="$S/builds/$id.feature.json" node "$(dirname "$0")/run.js" "$REPO" "$S/tiles" "$S/oa/$id.html" -- --id "scout-oa$id" --name "oa$id" --operator "OA board" --source "https://www.outdooractive.com/it/r/$id" --guide "https://www.outdooractive.com/it/r/$id" --km $km --ascent $up --time $t $extra > "$S/builds/$id.log" 2>&1
  echo "$id: $(grep -E 'STATUS|refused|VERDICT|SHAPE|not drawable|reads as' "$S/builds/$id.log" | tr '\n' ' ' | cut -c1-300)"
done < "$S/work/jobs.tsv"
echo ALLBUILT
