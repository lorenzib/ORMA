# Switzerland: walk sources and dog rules

Research note, 3 November 2026. Scope: Graubünden and Ticino first (the
Engadin, Val Poschiavo, Val Bregaglia, Valle Maggia, Verzasca), then Valais,
the Bernese Oberland, Central Switzerland and the Jura. Charter amendment
#1235 lets the catalogue grow into Switzerland; it says no Swiss walk is
sealed until the owner approves a Swiss dog standard. Section 3 is that
proposal. Nothing here changes a seal rule until it is approved.

**Owner's decision:** pending.

## 1. Walk sources

Every Swiss walk must cite one authority that publishes its distance, climb
and walking time. The same route can carry different figures from different
publishers (SchweizMobil 806, Morteratsch: 6 km, 240 m, 1 h 50; Engadin
Tourismus on Outdooractive: 5.8 km, 253 m, 2 h 10), so each walk cites one
authority and uses its figures only.

### Outdooractive pages of the regional tourism boards — usable, first choice

- **Page:** `https://www.outdooractive.com/en/r/<id>`. A public page; plain
  requests with the ORMA user agent return it. No key.
- **Figures:** the page's JSON-LD names the publisher and carries
  `elevation_ascent`, `elevation_descent` and `duration` (minutes), plus the
  line (`geo.line`). Distance is in the page text, not the JSON-LD.
  `build-board-line.js` already reads this (Nassfeld, Meran).
- **Checked:** Engadin Tourismus AG, Morteratsch glacier walk (23436574):
  publisher "Engadin Tourismus AG", 130 m up, 50 min, read by us on 3 Nov.
- **Official publishers found:** Engadin Tourismus AG, Valposchiavo Turismo,
  Bregaglia Engadin Turismo, Ascona-Locarno Tourism (Lago Maggiore e Valli),
  Bellinzona e Valli Turismo, Valais/Wallis Promotion, Berner Wanderwege.
- **Filter on `publisher.name`.** Region lists mix in community tours, which
  are not an authority. Some board tours say "Source: SwitzerlandMobility";
  those are SchweizMobil routes re-hosted by the board and are fine.
- **Licence:** all rights reserved (board imprints, e.g. "©2026 Organizzazione
  turistica Lago Maggiore e Valli"). Same treatment as Osttirol and the
  Italian boards: cite the figures as facts with a link, use the line only as
  a guide for our own OSM line, copy no text or photos.

### Schweizer Wanderwege (schweizer-wanderwege.ch) — usable

- The Swiss Hiking Trail Federation. `/de/wandervorschlaege/` lists 1,776
  suggestions; each page gives the T grade, time, distance, climb and
  descent, with a public GPX link offered to every visitor.
- © Schweizer Wanderwege; no open licence. Cite, never copy.
- Their suggestions run harder than ours (many T2 with exposure); useful
  mainly where no board publishes, e.g. Central Switzerland and the Jura.

### SchweizMobil / Wanderland (schweizmobil.ch) — usable, figures only from the page

- Route pages give distance, climb, descent and time. The page is a script
  app, so it must be rendered. GPX export needs a paid account, and the page
  carries an embedded API key: **we never use it.**
- The route lines themselves are open government data (layer
  `ch.astra.wanderland` on api3.geo.admin.ch, opendata.swiss "free use, source
  required"). Where we use one as a guide, the credit is "Federal Roads Office,
  Canton, SwitzerlandMobility Foundation". Texts and photos stay copyrighted.

### Reference only (find walks there, never cite them)

- **MySwitzerland:** the same figures as SchweizMobil, no GPX, a bot challenge
  page, and terms that require prior written consent for reuse.
- **graubuenden.ch, engadin.com (Scuol/Zernez), ticino.ch:** built on
  platforms that need API keys, or that showed 0 km / 0 h on the page. Cite
  the board's own Outdooractive page instead.
- **Swiss National Park routes:** no climb is published, and dogs are banned.

### Reference layers (open data, map.geo.admin.ch)

- `ch.bafu.bundesinventare-jagdbanngebiete`: federal hunting reserves
  (download, free with source).
- `ch.bafu.wrz-wildruhezonen_portal`: wildlife rest zones. View only on the
  federal portal. The data is downloadable per canton from geodienste.ch
  (free for VS, BE, UR, SZ, LU, VD; GR also publishes at wildruhe.gr.ch).
- `ch.bafu.schutzgebiete-schweizerischer_nationalpark`: the park boundary.
- `ch.swisstopo.swisstlm3d-wanderwege`: the signed trail network, to check
  that our OSM line follows signed paths.

## 2. Dog rules

There is **no federal leash law.** The federal animal-welfare article on
keeping dogs under control (TSchV art. 77) was repealed on 1 February 2025.
Cantons and communes regulate dogs. Sources were read on 3 November 2026;
those marked *unconfirmed* are from secondary sources only.

### Federal rules that apply everywhere

- **Swiss National Park (Zernez, Graubünden):** Nationalparkordnung BR 498.200
  art. 5 para. 1 lit. g bans taking or carrying dogs into the park, even on a
  lead. This is binding law.
- **Federal hunting reserves (Jagdbanngebiete)**, VEJ SR 922.31 art. 5 para. 1
  lit. c: "Hunde sind an der Leine zu führen" (dogs must be on a lead), all
  year; farm working dogs are exempt. Graubünden examples: Piz Ela,
  Bernina-Albris, Trescolmen.
- **Water and migratory bird reserves**, WZVV SR 922.32 art. 5: the same
  wording.
- **Wildlife rest zones (Wildruhezonen):** cantons and communes designate
  them (JSG art. 7 para. 4). Red zones are binding, yellow zones are
  recommendations, and each zone sets its own season and rules. Most apply
  in the winter half-year, outside ORMA's May–October season.
- **Poaching dogs:** letting a dog chase game is an offence under JSG art. 18
  (fine up to CHF 20,000). Cantons decide when wardens may shoot a dog.

### Graubünden

- **No cantonal dog law and no cantonal lead rule in open country.** The
  Veterinärgesetz BR 914.000 art. 64 leaves dog rules to the communes;
  art. 66 allows a lead or muzzle order only for one dog found dangerous.
- **No seasonal forest lead period.** The hunting office may order a local,
  time-limited lead duty in a wildlife emergency (Hegeverordnung BR 740.300
  art. 8; used in winter 2019 in Surselva, Prättigau and Lower Engadin).
- **Shooting:** only game wardens, and only a dog that has killed game or
  poached repeatedly (RJV BR 740.020 art. 32).
- **Wildlife protection areas** (VWSG BR 740.200): a lead in hare refuges
  and on some listed paths.

### Ticino

- **Legge sui cani** RL 482.300 art. 7 para. 4: "Nei luoghi frequentati dal
  pubblico o da altri animali, i cani devono essere tenuti al guinzaglio".
  A lead wherever people **or other animals** are; that reads as covering
  grazed pastures.
- **Hunting regulation** RL 922.110 (status July 2024; the 2026 text is
  *unconfirmed*): art. 37 para. 1, no dog may roam free at any time of year;
  art. 36, a lead in every no-hunting zone. Under art. 37 para. 2 hunting
  police may shoot an unsupervised dog chasing game; art. 115 allows stray
  dogs found more than 300 m from houses to be caught or shot.
- **Breed list:** about 30 breeds (bull-type terriers, molossers, German,
  Belgian and Dutch shepherds, Dobermann, Czechoslovakian wolfdog; Presa
  Canario and Saarloos from 1 Jan 2026) need a permit, and may be walked
  only one at a time. Whether visitors staying under 30 days are still
  exempt under the 2026 regulation is *unconfirmed*.
- **No dated forest lead period;** the year-round no-roaming rule covers it.

### Graubünden and Ticino communes

| Commune | Rule found | Source |
|---|---|---|
| Poschiavo | Lead "as a rule"; off-lead only under control; no roaming; lead in public buildings, schools, playgrounds, sports grounds, restaurants, car parks. Applies to visitors | Legge sui cani 2012 |
| Bregaglia | Lead in the built-up area (CHF 50 fine) | fines list 2012 |
| Davos | Lead on the lake promenade | Hundegesetz 1977 art. 3; BGer 1P.665/2005 |
| Locarno | Lead along the whole Maggia embankment, off-lead area on the right bank | commune |
| Blenio | Lead also on paths and in woods | commune |
| Bellinzona | New ordinance of 10 June 2026, text not read | — |
| St. Moritz, Pontresina, Samedan, Scuol, Zernez, Maggia, Lavizzara, Verzasca | Nothing published online | checked commune sites |

Each batch rechecks the communes its walks touch.

### Pastures and cattle

- Outside Ticino there is **no binding pasture law** in these cantons. Bern
  (Hundegesetz BSG 916.31 art. 7) and Vaud (all year) require a lead on
  pastures with livestock.
- **Suckler cows** (Mutterkuh Schweiz guidance): lead on the pasture, keep
  your distance, let go of the lead if the cows attack.
- **Livestock guardian dogs** (AGRIDEA / Herdenschutz Schweiz, funded by
  BAFU): lead your dog, go round the flock and never through it, turn back
  if in doubt. Sign boards mark these pastures.

### Later cantons (for their batches)

| Canton | Village lead | Seasonal forest lead | Open country |
|---|---|---|---|
| Valais | Built-up areas, stations, busy roads, **near livestock**, where signed (SGS 455.1 art. 30) | none | under control, no roaming |
| Bern | Schools, playgrounds, public transport, **pastures with livestock**, commune zones (BSG 916.31 art. 7) | none (motion not adopted) | off-lead only under effective control; lead zones in many wildlife areas since Aug 2024 |
| Uri | commune | **1 Apr–31 Jul, forest and 50 m from its edge** (RB 40.3111 art. 28) | — |
| Schwyz | **all year on public paths and roads** (SRSZ 546.100 § 2) | covered | no roaming |
| Obwalden | commune | forests, dates *unconfirmed* (press release 2022) | — |
| Nidwalden | commune | none found; rest zones 15 Dec–30 Apr | — |
| Lucerne | busy roads, nature reserves (SRL 849 § 3) | **1 Apr–31 Jul, forest and 50 m** (SRL 725a § 27) | — |
| Jura | commune | none found; lead in forest if not under control (RSJU 922.111 art. 40) | no roaming |
| Neuchâtel | voice control, else lead | **15 Apr–30 Jun in forest** (RSN 922.10 art. 21) | voice control, else lead |
| Vaud | control, else lead | **1 Apr–15 Jul, forest, edge and adjoining meadows** (BLV 922.03.1 art. 2a) | **lead all year on cattle pastures** |

**Valais bans 12 breeds and their crosses** (AmStaff, Bull Terrier,
Staffordshire, Pit Bull, Dobermann, Dogo Argentino, Fila, Tosa, Rottweiler,
Mastiff, Neapolitan and Spanish Mastiff; American Bully too). Visitors may
bring one for up to 30 days a year, on a lead and muzzled.

### Public transport and lifts

- A dog over 30 cm needs a ticket (half-fare 2nd class or a CHF 25 dog day
  pass, valid on trains, PostBus and boats). Small dogs in a carrier ride
  free. No national lead or muzzle rule on transport.
- Rhaetian Railway and cable-car dog rules are *unconfirmed*; walks that
  start from a lift say "check the lift's dog rule". The lift rule stands:
  a closed gondola or cable car is fine, any chairlift means hold.

## 3. Proposed Swiss dog standard (needs the owner's approval)

Where the commune's own rule is found, it wins and is stated. Where it is
not, the record says "commune rule not found, probably exists" and applies
the canton's rule and the rules below.

1. **Every Swiss walk says:** **"Keep your dog on a lead for the whole walk."**
   This is stricter than Graubünden's law and matches Ticino's. It also
   covers cattle, wildlife reserves and the seasonal forest periods, without
   a different sentence per canton.
2. **Plus one canton line:**
   - Graubünden: "Graubünden has no lead law of its own; the commune's rule
     and the federal reserve rules apply. Wardens may shoot a dog that kills
     game."
   - Ticino: "Ticino law requires a lead wherever people or other animals
     are, and no dog may roam free at any time of year."
   - Later cantons: their village rule and, where one exists, the forest
     period with its dates (e.g. Lucerne "lead in and within 50 m of forest,
     1 April–31 July").
3. **Pastures:** "Cows with calves and guardian dogs graze many summer
   pastures. Keep your dog on a short lead, go round the herd, and let go of
   the lead if the cows come at you."
4. **Hold:**
   - any walk that enters the Swiss National Park;
   - any walk through a **binding (red) wildlife rest zone** whose dates
     overlap May–October, or whose rules ban dogs;
   - any walk in a commune whose rule exists but cannot be read (as with
     Lavant in Austria).
5. **Not a hold, but stated:** a federal hunting or bird reserve ("Federal
   wildlife reserve: dogs on a lead all year, by federal law"); a line that
   only runs beside the National Park boundary.
6. **Warnings in the text:** livestock guardian dogs where signed; the
   Valais breed ban and the Ticino breed list on walks in those cantons;
   "a dog needs its own ticket on Swiss trains and buses" where the walk
   starts from public transport.
7. **Protected-area check:** for each walk, intersect the line with the
   National Park boundary, federal hunting and bird reserves, and the
   canton's wildlife rest zones (geodienste.ch, wildruhe.gr.ch).

## 4. What the catalogue needs for Switzerland

- **Region:** the Switzerland region (country CH) with Graubünden and Ticino
  localities is PR #1239. The other cantons add their localities with their
  first batch.
- **Map tiles:** #1239 adds Switzerland to our hiking-route tiles (Geofabrik
  `europe/switzerland`).
- **Huts and water:** `fetch-huts-bars.js` only queries the Dolomites and
  Savoy, so the Swiss packages stay empty until it is widened. Lombardy and
  Tyrol share this gap.
- **Hazards:** there is no SLF avalanche or MeteoSwiss connector yet.
- **Trail grade:** Swiss walks carry a T grade (T1 yellow paths, T2–T3
  white-red-white). Batches start with T1 walks and easy T2, in keeping with
  "easiest walks first".
