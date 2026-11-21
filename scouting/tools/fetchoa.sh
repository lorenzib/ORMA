#!/bin/bash
S="$1"; mkdir -p "$S/oa"
python3 -I -c "import json,sys;[print(o['id']) for o in json.load(open(sys.argv[1])) if o['step']=='go']" "$S/work/stage0.json" | while read id; do
  [ -s "$S/oa/$id.html" ] && continue
  curl -sL -A "ORMA/1.0 (github lorenzib/ORMA; board-line builder)" -o "$S/oa/$id.html" -w "$id %{http_code} %{size_download}\n" "https://www.outdooractive.com/it/r/$id"
  sleep 1.3
done
echo DONE
