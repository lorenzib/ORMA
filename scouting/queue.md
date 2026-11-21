# Scouting queue

Pools waiting to be screened. A run takes the **first row with status `queued`**, and changes its status on the run's branch.

Laptop sessions should claim here too, by changing the status, so a pool is never screened twice. Adding a new source is an owner call: don't add rows yourself.

**Candidates file:** `pools/oa-official-candidates.tsv`, from the 19 Nov survey (`pools/survey-north-italy.md`).

**Box:** the optional `minLat,minLon,maxLat,maxLon` passed to `tools/make_pool.py`.

| # | Pool (publisher in the candidates file) | Region | Box | Notes | Status |
|---|---|---|---|---|---|
| 1 | CANAVESE VILLAGE | piedmont | | 60 tours. The Orco and Soana walks are mostly inside Gran Paradiso NP, where dogs are allowed only in valley areas and on listed paths in season: check the PNGP list, and hold anything off it. Valchiusella and the morainic hills are outside the park. | done 21 Nov (laptop session 4be75098): 8 of 60 pass; 3 built in lorenzib/ORMA#1570, 5 are owner calls |
| 2 | Oasi Zegna | piedmont | | 29 tours, Biella. Check the publisher is the Zegna oasis or the Trivero commune tourist office, and whether it counts as official. If not, write it up as an owner call and stop. | queued |
| 3 | VISITPIEMONTE. REGIONAL MARKETING AND PROMOTION | piedmont | 44.0,6.6,44.75,7.75 | Cuneo and Pinerolo valleys only (151 rows). Mostly one-way stages, so screen them as there and back. Likely the same data as piemonteoutdoor.it (Valsesia, already used): dedupe by line. | claimed 21 Nov by laptop session 4be75098 |
| 4 | Turismo Valle Camonica TCV | lombardy | | 16 tours, mostly steep. Adamello park: dogs on a lead. | queued |
| 5 | RivierALP | liguria | | 26 tours, Imperia hinterland (Triora, Bajardo). Liguria has no region file: screen only, and list "needs the Liguria region" in the findings. | queued |
| 6 | be active LIGURIA | liguria | | 31 tours, the Alta Via dei Monti Liguri stages (one way, road passes at the ends). Expect few to pass. Screen only. | queued |

## Claimed by laptop sessions (don't screen)
- UM.PASUBIO (Veneto): batch 1 in lorenzib/ORMA#1554. Folds and photo holds are still to re-run.
- in-Lombardia mountains, Visitlakeiseo, Comunità Montana Parco Alto Garda Bresciano: session ebfbc1a1.
- Turismo Torino e Provincia, Val Susa Outdoor: session 4be75098.
