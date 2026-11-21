# North Italy mountain sources: survey (19 Nov 2026)

This is a read-only survey. No lines were built and nothing in the repo was touched.

**What's live on origin/main:**
- Lombardy has 14 walks: 10 at Lake Como/Lecco (in-Lombardia) and 4 in Sondrio (Valtellina Outdoor, Bormio).
- Piedmont has 6 walks, all in Valsesia.
- No Bergamo, Brescia, Varese or Turin/Cuneo walks are live yet.

**Scratch files (all in this folder):**
- `in-lombardia-easy.tsv`: 250 itineraries at ≤15 km and ≤800 m, all with a GPX, scraped from all 804 sitemap pages.
- `oa-official-candidates.tsv`: 1,119 Outdooractive tours from official-looking publishers, with km, ascent, time, start point and URL.
- `oa/full.json`: all 2,845 OA hiking tours in 18 area slugs, with their publishers.
- `sites/beigua.jsonl`: 61 Beigua itineraries.
- `photo-density.json`: the photo samples.

**Counting notes:**
- "Easy" here means 2–15 km and ≤800 m climb, as published. For the Ligurian parks it also excludes EE.
- The OA counts come from the OA tour sitemap (373k URLs) filtered by area slug, with the publisher read from "Responsible for this content".
- A publisher's tours that sit under slugs I didn't fetch are not counted, so OA pools are lower bounds.

**Photo check:**
- It's a Commons geosearch for files within 500 m of the walk start, plus the GPX midpoint where I had the GPX. It was paced at 5 s.
- That's a density signal only: none of the photos was checked for being on the path or in season.
- **Overall: mountain starts usually have 0–7 files within 500 m.** Only town or landmark starts reach 18–100 (Limone, Sacra di San Michele, Stupinigi, Deiva).
- Expect the photo to stay the bottleneck everywhere.

---

## LOMBARDY

### L1. in-Lombardia (Regione Lombardia), Bergamo + Brescia provinces: score 4
- **URL:** https://www.in-lombardia.it/itinerari/<slug>. The sitemap has 97 pages and 804 itineraries.
- **Lines and figures:** a GPX on every page (`/sites/default/files/itinerari/gpx/...`), plus time, km and up-climb.
- **Pool** (walking types, 2–15 km, ≤800 m, with GPX):
  - **BG 76:** Orobie, Val Brembana, Val Seriana, Val di Scalve, Val Taleggio.
  - **BS 23:** Valcamonica (Ponte di Legno, Corteno Golgi, Edolo, Vezza), Bagolino, Iseo/Monte Isola, Tremosine.
  - Unscreened elsewhere: VA 8, CO 37, LC 18, SO 39. The CO and LC pools are mostly exhausted (#1254).
  - Authors: Orobie Active writes 113 of the 250, then Lago di Como GAL, the in-Lombardia editors, VisitBergamo.net (17) and Ecomuseo Val Taleggio (11).
- **Scraping:** done (`il-items.jsonl`). Use the existing `--guide <GPX>` path.
- **Blockers:**
  - **75% of BG km figures are whole numbers**, so the 10% length check will cost walks.
  - Many walks go one way to a rifugio, so they'd be sealed there and back.
  - The memory notes already warn about km typos and "h,mm" times.
- **Parks and dog rules:**
  - Parco Orobie Bergamasche: no dog regulation found online, so the national rule applies, subject to a check.
  - Adamello regional park (Valcamonica): the park's 2025/2026 leaflet says dogs must be on a lead. No ban was found.
  - Stelvio, Lombard sector: a secondary source (montagna.tv) cites Art. 33 of DGR 3665/2020: dogs on a lead and on marked paths in zones B, C and D. That would mean **no dogs in zone A**. Verify.
  - Natura 2000 sites: lead and stay on paths under DGR 1029/2013 and 4429/2015.
- **Commune dog rules:** not checked.
- **Photos:** Val Taleggio→Regadur 1/3, Ponteranica 0/1, Pianone→Parafulmine 0/3, Monte Angolo 3/1, Valli di Sant'Antonio err/0. Thin.
- **Why 4:** the largest untouched official pool with lines, and the pipeline is proven. Rounded km and sparse photos will thin it.

### L2. Comunità Montana Parco Alto Garda Bresciano (Outdooractive): score 3
- **Publisher:** a public body. Tours in the OA slugs `parco-dell-alto-garda-bresciano` and `brescia`.
- **Pool:** 24 tours, 17 easy. They cover Tremosine, Tignale, Limone, Gardone, Valvestino/Armo and Bondo.
- **Lines and figures:** OA track, km, time and climb.
- **Dog rule:** a regional park; its rule was not looked up.
- **Photos:** Limone nature trail 100; Valley of the Paper Mills 0.
- **Why 3:** a public publisher with a clean OA format, but a small pool, and several walks are low lakeside rather than mountain.

### L3. Visitlakeiseo (Outdooractive): score 3
- **Pool:** 53 tours, 39 easy. They cover Sebino and the Bergamo/Brescia prealps: Zone pyramids, Monte Aguina, Predore, Bossico, Riva di Solto.
- **Publisher status is unconfirmed:** it appears to be the Lake Iseo tourism DMO; check its legal entity.
- **Lines and figures:** OA track, km, time and climb.
- **Photos:** Valle del Freddo 7; Bossico 6.
- **Why 3:** a decent pool of prealpine walks; the publisher's status needs confirming.

### L4. Turismo Valle Camonica TCV (Outdooractive) + Adamello park: score 2
- **TCV:** 16 tours on OA, 4 easy. Most are steep: Torsoleto 1,200 m, Concarena 1,490 m, Trabucco 820 m.
- **Parco dell'Adamello:** the park site has text itineraries but **no GPX was found**.
- **Why 2:** small and steep. The Valcamonica walks in L1 are the better route in.

### L5. Varese prealps: score 1–2
- in-Lombardia has VA 8 easy (Redazione Varese, Promovarese), already counted in L1.
- The OA varese slug has 39 tours, almost all from private users.
- The Campo dei Fiori park home page shows no GPX or figures.
- **Why:** very thin official supply.

**Not separately checked:** VisitBergamo.net's own site, visitbrembo, the Valle Trompia/Sabbia tourism sites (Turismo Valle Sabbia has 3 on OA), and CAI Bergamo.

---

## VENETO (outside the Belluno Dolomites): needs a new region file

### V1. UM.PASUBIO (Unione Montana Pasubio Alto Vicentino) on Outdooractive: score 4
- **Publisher:** a public body, an OA "Verified partner".
- **Pool:** 125 tours, **87 easy.**
- **Area:** Valli del Pasubio, Val Leogra, Posina, Torrebelvicino, Schio area, Piccole Dolomiti fringe. Many are CAI-numbered loops (Montagnole CAI 120, Tricolor 105-120, CAI 143, Laghetti/Posina).
- **Lines and figures:** OA track, km, time and climb.
- **Scraping:** OA sitemap slug `vicenza`; full rows are in `oa-official-candidates.tsv`.
- **Protected areas:** no park in the core area. The Natura 2000 sites (e.g. IT3210040) apply; their Veneto dog rule was not checked.
- **Commune dog rules:** not checked. The Comune di Recoaro Terme also publishes 2 tours.
- **Photos:** Sentiero delle Mole 3, Vajo Pelegatta 2. Thin.
- **Why 4:** the biggest public, OA-formatted pool in this survey. Photos and T3/EE ground will be the filters.

### V2. Altopiano di Asiago 7 Comuni: score 1–2
- **asiago.it:** about 39 itineraries with difficulty, climb, km and time, but **no GPX was found**.
- Its figures can disagree with themselves: Valmaron gives "Dislivello 152 m" in the box but 350 m in the text.
- Who publishes asiago.it is not confirmed.
- **On OA:** the "Altopiano di Asiago 7 Comuni" partner has only 2 tours in the slugs fetched.
- **Why 1–2:** no line unless the OA partner has more tours under other slugs.

### V3. Lessinia regional park, Monte Baldo, Monte Grappa: score 1
- **Lessinia (lessiniapark.it):** no GPX on the trail page. The park's dog rule was not found online.
- **Monte Baldo and Monte Grappa:** no official GPX set was found. The leads are:
  - SityTrail routes authored by CAI Caprino Veronese / CAI Verona, and one by the Lessinia park.
  - CAI Dolomiti Bellunesi on OA (in grappa-gruppe, mostly >900 m climb).
  - APT Rovereto Vallagarina Monte Baldo (2 tours) and Comune di Valbrenta (2 tours).
- **Why 1:** no usable official pool found yet.

**New Veneto region would need:**
- **Rough bbox:** lat 45.45–46.05, lon 10.65–12.30 (Monte Baldo across Lessinia, Pasubio, Asiago and Grappa to the Prealpi Trevigiane).
- **Base towns:** Malcesine, San Zeno di Montagna, Bosco Chiesanuova, Giazza, Recoaro Terme, Valli del Pasubio, Schio, Posina, Asiago, Gallio, Bassano del Grappa, Possagno, Valdobbiadene.
- **The Feltre/Grappa north side is Belluno province,** so it's already in the dolomites file. Decide where Grappa sits.
- **Lake Garda's Veneto shore** is hot in summer, so the existing heat season rules apply.

---

## LIGURIA: needs a new region file

### G1. Parco Naturale Regionale del Beigua (UNESCO Geopark): score 3
- **Listings:** https://www.parcobeigua.it/iti-sentiericonsigliati.php and the other iti-*.php pages.
- **Detail pages:** `iti_dettaglio.php?id_iti=N`, with the GPX at `/gpx/PRBEI_N.gpx`.
- **Figures:** each page gives start/end commune, time, difficulty (T/E/EE), km, climb and a GPX.
- **Pool:** 61 itineraries. 57 have a GPX, 55 a km figure and 46 a climb figure. **20 are easy and not EE.**
- **Many are one way** (Varazze–Faie, Agueta–Lago della Tina), so they'd be sealed there and back.
- **Dog rule:** only a secondary source says "dogs admitted on lead". The park regulation was not found.
- **Photos:** Masone–Forte Geremia 1/0; La foresta della Deiva 100/0.
- **Why 3:** an official park source with real GPX and figures. The pool is small, and coastal heat is an issue.

### G2. be active LIGURIA (Agenzia In Liguria, the regional tourism agency) on Outdooractive: score 2
- **Pool:** 31 tours, 28 easy. **They are the Alta Via dei Monti Liguri stages ("Trail no. 01–43")** running between passes.
- **Lines and figures:** OA track, km, time and climb.
- **Blockers:** the stages are one way and start and end at road passes. There-and-back is possible, but the trailheads sit on roads.
- **Photos:** Turchino–Praglia 7; Lame–Spingarda 3.
- **Why 2:** official, but the ridge stages are a poor fit for loops and for the road rule.

### G3. Parco dell'Antola and Parco dell'Aveto: score 1
- **Antola (parcoantola.it):** 14 itineraries, **no GPX**, and only 1 has a km figure.
- **Aveto (parcoaveto.it):** 13 itineraries, **no GPX** and no climb figures; 6 give km.
- **Why 1:** no line and incomplete figures.

### G4. Regione Liguria REL (472 paths, about 3,000 km): not scored
- REL is the regional path inventory, and OSM relations carry its refs. No official per-path sheet with a GPX and figures was found online.
- Parco Alpi Liguri (parconaturalealpiliguri.it) didn't respond.
- Portofino park: no itinerary links on its home page.
- Finale Outdoor (a consortium) has only 3 tours in the fetched slugs.

### Cinque Terre National Park
- **No official dog rule was found online.** A secondary dog guide says dogs are "banned in areas marked by the park".
- Treat it as unverified, and consider holding it until the park regulation text is read.
- The high paths (AVG/SVA) aren't published with GPX on any official page I found.

**New Liguria region would need:**
- **Rough bbox:** lat 43.78–44.68, lon 7.50–9.95.
- **Base towns:** Triora, Mendatica, Monesi (Alpi Liguri); Finale Ligure; Sassello, Varazze, Arenzano, Masone (Beigua); Torriglia, Montebruno (Antola); Santo Stefano d'Aveto, Rezzoaglio (Aveto); Camogli (Portofino); Levanto, Monterosso, Riomaggiore (Cinque Terre).
- **Seasons:** summer heat matters on the coastal side.

---

## PIEDMONT (resume at Biella, then Canavese, the Turin valleys and Cuneo)

### P1. Turismo Torino e Provincia (the official ATL) on Outdooractive: score 4
- **Pool:** 91 tours, **67 easy.**
- **By area:**
  - Turin valleys (Susa, Lanzo): 35 tours, 20 easy.
  - South of 45.0°N and west of 7.75°E (Pinerolese and northern Cuneo): 31 tours, 26 easy.
  - Turin hills: 25 tours.
- **Lines and figures:** OA track, km, time and climb.
- **Parks:** the Alpi Cozie parks' dog rule is in Reg. PRAS-2021-00024 A1, not read. Parco La Mandria (also on OA, 11 tours) is a lowland park.
- **Photos:** Stupinigi 82 (lowland); Campiglia Soana San Besso 0.
- **Why 4:** an official ATL with a good mountain share and clean OA data.

### P2. Val Susa Outdoor on Outdooractive: score 4
- **Pool:** 64 tours, **50 easy** (46 in Val Susa/Sangone): Sestriere, Avigliana lakes, Musiné, Montebenedetto, Venaus–Rifugio Avanzà, Novalesa.
- **Publisher:** the photos credit "Sauze d'Oulx Ufficio del Turismo", so it looks like the valley tourism offices' platform. **Confirm its legal publisher.**
- **Lines and figures:** OA track, km, time and climb.
- **Parks:** Orsiera-Rocciavrè and Gran Bosco di Salbertrand (Alpi Cozie rule, not read).
- **Photos:** Sacra di San Michele 18; Novalesa waterfall 11. The best density of the mountain samples.
- **Why 4:** a good pool and better photos.

### P3. VISITPIEMONTE (regional DMO) on Outdooractive: score 3
- **Pool:** 550 tours, 273 easy.
- **Mountain share of the easy walks:**
  - 76 Cuneo/Pinerolo valleys (GTA stages, Lou Viage, Percorsi Occitani, Vermenagna loop).
  - 47 Turin valleys.
  - 32 Ossola/VCO, which is exhausted. Skip.
  - Only 5 Biella/Valsesia.
- **Blockers:**
  - **Mostly stages:** one way, so there-and-back.
  - **This is very likely the same dataset as piemonteoutdoor.it**, already used for Valsesia; dedupe by title.
- **Photos:** Monterotta–Chalmette 7; Trek Nature stage 1; Castagnito 0.
- **Why 3:** huge but stage-heavy, and it overlaps a source we already know.

### P4. CANAVESE VILLAGE (Turismo in Canavese) on Outdooractive: score 3
- **Pool:** 60 tours, 45 easy: Valchiusella, Soana, Orco/Noasca, Piamprato and the Settimo Vittone hills.
- **Lines and figures:** OA track, km, time and climb.
- **Blocker:** **the Orco and Soana walks are largely inside Gran Paradiso NP.** Dogs are allowed there only in valley-floor areas and on about 25 listed paths, 15 Jul–15 Sep (per montagna.tv; the official PNGP list wasn't opened). Valchiusella and the morainic hills are outside the park.
- **Photos:** Piamprato 0; Settimo Vittone 5.
- **Why 3:** official, but the park rule removes the best mountain walks.

### P5. Biella: score 2
- **ATL Biella (atl.biella.it):** returns HTTP 403 to our user agent. Not retried.
- **Oasi Zegna on OA:** 29 tours, 26 easy, Bielmonte/Valsessera, with tracks and figures. **It is a private company's oasis, not a public body,** so it's an owner call.
- **Associazione Movimento Lento:** 7 Biella tours (an association).
- **Photos (Oasi Zegna):** Carabo route 29; San Bernardo 0.
- **Why 2:** no public Biella source with tracks found.

### P6. Cuneo valleys: Alpi Marittime / Marguareis parks, RivierALP, Monviso: score 2
- **Alpi Marittime and Marguareis parks (official page):**
  - **Dogs only in villages, on communal/provincial roads and on listed signed paths,** always on a lead and with a muzzle carried.
  - The maps of permitted paths are on areeprotettealpimarittime.it (updated 05/05/2023).
- **RivierALP:** an Interreg partnership on OA. 26 tours, but only 9 easy.
- **Parco del Monviso:** a secondary source says its 2021 regulation Art. 4 allows dogs on a lead. The site lists about 10 itineraries; GPX not checked.
- **Other OA content** in Maira, Varaita and Stura is mostly private users and German Alpine clubs.
- **Why 2:** the strict dog rule plus a thin official supply. The Cuneo walks in P1 and P3 are the way in.

**Valsesia leftovers** (per the memory note): Torno–Roy and Belvedere–Dorchetta need only a photo.

---

## National-park dog bans and rules
- **Gran Paradiso NP:** dogs only in valley-floor areas and on about 25 listed paths, 15 Jul–15 Sep. **This is effectively a ban.**
- **Stelvio NP, Lombard sector:** reportedly a lead and marked paths in zones B, C and D, which implies **no dogs in zone A**. Verify.
- **Cinque Terre NP:** no official text found. Unverified.
- **Val Grande NP** (Ossola): not checked, and Ossola is exhausted.
- **Regional parks with whitelists:** Alpi Marittime and Marguareis allow dogs on listed paths only.
- **Seasonal ban:** Veglia-Devero bans dogs 1 Dec–31 May.

## Not done or not verified
- No line drawing, road, sac_scale or OSM checks were run.
- No commune dog rules were checked.
- The Commons counts are within 500 m of start/mid points only.
- The publisher legal status is unconfirmed for Visitlakeiseo, Val Susa Outdoor and Canavese Village.
- The OA pools cover only the slugs fetched.
