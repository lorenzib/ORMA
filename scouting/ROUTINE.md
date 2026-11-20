# Weekly scouting run

The weekly cloud routine follows this file, start to finish. A laptop session can use it too.

A run **screens** one pool and reports what it finds. It never builds walks into the site.

## Hard limits
- Never run `build-board-line.js --apply`, `tools/apply.js`, or any script that writes the site's data.
- Commit only under `scouting/`.
- Never merge, never mark a PR ready, and never push to `main`.
- Never decide an owner call. Write it down and move on.
- Never print a token or secret.
- Be polite to every site:
  - Send the User-Agent `ORMA/1.0 (github lorenzib/ORMA; board-line builder)`. The tools already do.
  - Allow at least 1 s between requests (5 s for Commons).
  - Back off on 429, 509 and 5xx.

## 0. Setup
```bash
DATE=$(date -u +%F)
git checkout -b claude/scouting-$DATE origin/main   # cloud sessions push claude/* branches
```
The tools need only Node and Python 3 (no `npm ci`). Read `scouting/RULES.md` and `scouting/queue.md`.

**Pick the pool:** the first row with status `queued`.
- If there is none, append `- $DATE · queue empty, nothing screened` to `log.md`, commit it, open a draft PR titled "Scouting: queue empty", and stop.
- Otherwise set the row's status to `screening $DATE (routine)`. Then:

```bash
S=/tmp/scout/<pool-slug>; mkdir -p $S/work $S/analysis $S/photos $S/directions
T=scouting/tools
```

## 1. Network check (2 minutes)
Fetch one page from each of these:
- `https://www.outdooractive.com/it/r/<an id from the pool>`
- `https://overpass.kumi.systems/api/interpreter?data=[out:json];node(1);out;`
- `https://api.openstreetmap.org/api/0.6/node/1.json`
- `https://commons.wikimedia.org/w/api.php?action=query&meta=siteinfo&format=json`
- `https://api.opentopodata.org/v1/eudem25m?locations=46,11`
- `https://bio.discomap.eea.europa.eu/arcgis/rest/services/ProtectedSites/Natura2000Sites/MapServer?f=json`

If Outdooractive or OSM is blocked, the run can't screen anything:
- write `findings/$DATE-network.md` listing which hosts failed and with what error;
- set the pool back to `queued`;
- open a draft PR "Scouting: network blocked";
- stop.

If only Commons, opentopodata or the EEA service is blocked, carry on and mark those checks "not run" in the findings.

## 2. Pool, scope, figures
```bash
python3 $T/make_pool.py scouting/pools/oa-official-candidates.tsv "<publisher>" $S [box]
# Read the titles. Put plain, lowland, multi-day, seasonal and variant routes in $S/scope-out.json.
python3 $T/scope.py $S
bash $T/fetchoa.sh $S             # Outdooractive pages, 1.3 s apart
python3 $T/parseoa.py $S          # figures, grade, tags, board line -> guides/<id>.json
node $T/maintrails.js . $S/work/main_trails.json
python3 $T/step1_2.py $S          # one-way doubling, size, grade, duplicates
```
**Confirm the publisher** on one page ("Responsabile del contenuto"). If it isn't an official board, park or public body, stop and write it up as an owner call.

## 3. Draw the lines (dry)
```bash
python3 $T/make_jobs.py $S
bash $T/buildall.sh $S            # long: run it in the background and wait
python3 $T/verdicts.py $S         # CLEAN / REFUSED per walk -> work/clean.txt
```
For walks refused only as folds, check whether the board's own line folds there. If it does, re-run them with `run-fold.js` and list them as "walkedTwice candidates" (an owner check).

## 4. Screen the clean lines
```bash
python3 $T/analyse.py $S $S                 # roads, lanes and shade per walk
python3 $T/sac.py $S                        # metres per sac_scale
python3 $T/n2000.py $S $(cat $S/work/clean.txt)
```
Apply the rules in RULES.md:
- **Roads:** lanes at most half the walk; tertiary or bigger roads under 300 m.
- **Grade:** T3+ holds; T2 gets a caution line.
- **Variant wording:** read each page's description and the author's tip ("Consiglio dell'autore").
- **Times:** two different times on one page holds the walk.

Check the region's parks too. For Piedmont, `python3 $T/parks_piemonte.py $S $S/work/clean.txt` does it. Elsewhere, look up the park's boundary and its rules.

Write the walks that pass to `$S/work/alive.txt`.

## 5. Photos
```bash
python3 $T/photos.py $S $(cat $S/work/alive.txt)            # Commons within 150 m
python3 $T/mapillary.py $S $(cat $S/work/alive.txt) || true  # skipped without MAPILLARY_TOKEN
python3 $T/cmget.py $S <walk>=<file fragment> ...            # download a candidate to look at it
```
**Open and look at every candidate.** Keep only photos that pass the photo rule. For each one, record:
- the file page;
- the author and licence;
- the date;
- the distance from the line.

## 6. Dogs and directions
For each walk that passes, look up the dog rule. Check:
- the commune's police or animal regulation;
- the park's rules;
- the regional Natura 2000 measures.

Quote the rule with its source URL. Hold any walk with a route ban, and flag it.

`python3 $T/waysseq.py $S <ids>` and `python3 $T/elev.py $S <ids>` give the way sequence, landmarks and a measured DIN time. These feed the findings' directions sketch.

## 7. Findings, PR, log
Write `scouting/findings/$DATE-<pool-slug>.md`, in plain short English. It contains:
1. **Funnel:** tours → in scope → drawn clean → pass roads/grade/variants → with photo.
2. **Ready to build:** one block per walk. Give:
   - the OA id and link, and the title;
   - one-way or loop, and the km, climb and time used (board or measured);
   - lanes %, tertiary metres, T2 metres, shade;
   - Natura 2000 and park;
   - the dog rule with its source (or "nothing beyond the national rule", with sources);
   - the chosen photo with its credit;
   - a 3–4 line directions sketch from the way sequence.
3. **Held, photo only:** the walks that pass everything but the photo.
4. **Held, other reasons:** one line each.
5. **Owner calls:** each one a yes/no question.
6. **Checks not run** (blocked hosts), if any.

Then:
- set the queue row's status to `screened $DATE`;
- append one line to `log.md`;
- commit (`scouting: <pool> screened`);
- push the branch;
- open a **draft** PR (`gh pr create --draft`, or the session's GitHub tools) titled "Scouting: <pool> (<n> ready, <m> photo holds)", with the summary and owner calls in the body.

A laptop session builds the "ready" walks later, after the owner reads the PR.

If time is running out, commit what you have, mark the unfinished steps in the findings, and still open the draft PR. Leave the pool at `screening` so the next run carries on from the findings.
