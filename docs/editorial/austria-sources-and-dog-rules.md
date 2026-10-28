# Austria: walk sources and dog rules

Research note, 27 October 2026. Scope: East Tyrol (Osttirol) first, then
Carinthia's Gailtal and Lesachtal. Nothing here changes a seal rule on its own.
The dog default at the end needs the owner's decision, and Austria itself is
was outside the planning catalogue scope until the charter's catalogue area
amendment of the same day.

**Owner's decision, 27 October 2026:** the Austrian dog standard in section 3
is approved as proposed, and the charter scope is amended to include East
Tyrol and Carinthia.

## 1. Walk sources

### Osttirol tourism board (osttirol.com) — usable

- **Publisher:** Tourismusverband Osttirol, Mühlgasse 11, 9900 Lienz (imprint).
  Operated by its subsidiary Osttirol Werbung GmbH.
- **List:** `https://www.osttirol.com/aktiv-outdoor/wandern/wanderwege` links
  298 walk pages (`/aktiv-outdoor/wandern/detail/<slug>`). 296 of them carry the
  "Das Wichtigste auf einen Blick" block. 235 of those give both a climb and a
  walking time.
- **Figures on each page:** Streckenlänge (distance), Höhenmeter Bergauf and
  Bergab (climb and descent), Gehzeit Gesamt (walking time), Schwierigkeit
  (Leicht, Mittel or Schwer), start, end, route type, best season, bus and
  parking. These are the board's own published figures, so they meet the
  climb-and-time rule.
- **Official line:** every walk page links a GPX file at
  `https://tirol.mapservices.eu/nefos_app/api/gpx/osttirol/de/generate/<id>`.
  It is the Land Tirol / CONTWISE maps platform, needs no key, and is the same
  link the page offers to anyone.
- **Licence:** the imprint says „Alle Inhalte und Bilder sind urheberrechtlich
  geschützt“ (all content and images are protected by copyright). It grants no
  reuse licence. We therefore:
  - cite the figures as facts, with a link to the page;
  - use the GPX only as a guide. `scripts/build-board-line.js` draws our line
    on OSM ways along it, and the board's line is never stored;
  - never copy board text or photos.

  This is the same treatment as the Italian boards.
- **Data quality traps:**
  - Some times are plainly wrong. For example, the Hochstein stroller walk is
    6.8 km in 30 min. Check that time and distance agree before trusting them.
  - "Rundtour" (loop) is sometimes set on walks whose start and end differ, for
    example Goldriedsee, which runs from the lift top to the middle station.
  - Many walks start at a lift top. The 26 October rule applies: a closed
    cable car is fine, but any chairlift means hold. Confirm the lift type for
    each walk.
- **Tested:** Tristachersee Runde drew 1.46 km against the published 1.45 km,
  with 100% coverage both ways. `build-board-line.js` now reads a GPX guide as
  well as an Outdooractive page.

### Land Tirol open data (data.gv.at, tiris) — reference layers, not walks

There is **no walk list with figures** in Tirol's open data. What exists is
listed below. The licence is CC BY 4.0 on the data.gv.at records, credited as
"Land Tirol – data.tirol.gv.at".

- **"Bergwege Tirol"** (`gis.tirol.gv.at/arcgis/rest/services/Service_Public/ogd_sport/MapServer/17`).
  Path segments with a commune, but no names, numbers, times or climbs.
- **"Ausgesetztheit – Bergwege Tirol / Euregio"** (layer 18). Path exposure
  classes, useful for the hazard text.
- **"Schutzgebiete Naturschutz Tirol"** (ArcGIS FeatureServer, GeoJSON).
  Protected areas, used for the protected-area check.
- **"Außengrenze Nationalpark Hohe Tauern Tirol"** (GeoJSON zip). The park
  boundary.
- **"Wald- und Wildschutzzonen, verordnete Wildruheflächen Tirol"** (WFS).
  Wildlife quiet zones.

### Hohe Tauern National Park (hohetauern.at)

- The park publishes **ranger-guided tour programmes**, not a self-guided walk
  list with figures and GPX.
- The park's walks in East Tyrol (Innergschlöss, Umbaltal, Dorfertal, …) are on
  osttirol.com with figures and GPX, so that is the source.

### Carinthia: Gailtal and Lesachtal (nassfeld.at) — usable

- **Publisher:** NLW Tourismus Marketing GmbH, Hermagor, is responsible for
  content. The site owner is KIG Karnische Incoming GmbH. The board covers
  Nassfeld-Pressegger See, the Lesachtal and the Weissensee.
- **List:** `https://www.nassfeld.at/sitemap.tour.xml` holds 782 German tour
  pages (`/de/Tour/<name>_t_<id>`), including skitours and bike routes, which
  have to be filtered out.
- **Figures on each page:** distance, Dauer (walking time), Aufstieg and
  Abstieg (climb and descent), lowest and highest point, and difficulty.
  Example: Gailwanderung Liesing, 4.8 km, 1.4 h, 170 m up.
- **Official line:** each page names its Outdooractive tour
  (`outdooractive.com/oar-nlw-tourismus/r/<id>`). The public Outdooractive page
  carries the line in JSON-LD, which `build-board-line.js` already reads.
  Tested: 218 points, start "Liesing im Lesachtal". No API key is used.
- **Licence:** „Alle Inhalte dieser Webseite … unterliegen dem Urheberrecht“
  (all content is under copyright). The same treatment as Osttirol applies:
  cite figures, draw our own line, copy no text or photos.
- **Times in decimal hours:** the board gives times like "1.4 h". Convert
  them to h:mm (1.4 h = 1:24) for `--time`.
- **Land Kärnten open data:** "Kommunales Wegenetz Kärnten" (GeoPackage) and
  "Schutzgebiete Naturschutz Kärnten (INSPIRE)", for the protected-area check.

## 2. Dog rules

The Italian national ordinance does not apply in Austria. There is no Austrian
federal leash law; the states and communes regulate dogs. Sources below were
read on 27 October 2026 from RIS (ogd.ris.bka.gv.at) unless a commune site is
named.

### Tyrol

- **Landes-Polizeigesetz § 6a** (LGBl. 60/1976, as amended by LGBl. 23/2025).
  - **Abs. 2:** „Hunde sind an öffentlichen Orten innerhalb geschlossener
    Ortschaften … an der Leine oder mit Maulkorb zu führen“. In public places
    inside a built-up area, the dog must be on a lead or wear a muzzle.
  - **Crowded places and public transport:** lead **and** muzzle.
  - **Abs. 2a:** a commune may order a lead or muzzle outside built-up areas on
    named paths or in named areas.
  - **There is no statewide lead rule for open country.**
- **Almschutzverordnung § 2** (LGBl. 71/2020, in force 1 July 2020).
  - „Während der Zeit des Almbetriebes haben Besucher von Almen, welche einen
    Hund mit sich führen, diesen unter Kontrolle zu halten und an der kurzen
    Leine zu führen … Ist ein Angriff von Weidevieh absehbar, so ist der Hund
    sofort abzuleinen.“
  - While a pasture is grazed, the dog goes on a **short lead**. If cattle are
    about to attack, let the dog off the lead.
  - This is **binding law**, not guidance, and covers most summer walks in
    Osttirol.
- **ABGB § 1320 Abs. 2** (federal, 2019): the walker's own responsibility on
  pastures is judged against the published rules of conduct. This is
  liability law; it gives no lead order.
- **Tiroler Jagdgesetz § 35 Abs. 1 lit. c:** hunting wardens may kill a dog
  that is out of its owner's control and plainly endangering game. This
  warrants a warning in the text, not a hold.
- **Hohe Tauern National Park, Tyrol:**
  - The Tyrolean park law contains no dog rule. Full-text RIS search for
    „Hund“ found none in it or in any East Tyrol protected-area order.
  - The park's visitor code says „Im gesamten Nationalpark: Hunde an die
    Leine!“. That is guidance; we state it as the park's request.
- **No dog ban** was found for any East Tyrol valley (Innergschlöss, Umbaltal,
  Dorfertal, Schwarzach). One unconfirmed secondary source says the Panorama
  Trail is closed to dogs.

### East Tyrol communes

| Commune | Rule found | Source |
|---|---|---|
| Lienz | Lead outside the village only on named paths (Drau and Isel cycle paths, Totenweg, Maria Trost, Zauchenweg, Tennishalle–Amlach), map attached | lienz.gv.at, Gemeinderat 23.06.2020 |
| Tristach | Lead on **every** footpath and forest road outside the village, except stretches marked on the map | tristach.at, 15.05.2020 |
| Sillian | Lead all year on public roads and paths and the Drau path; lead 1 April–31 October on farmed land | marktgemeinde-sillian.at, 2011/2012 |
| Innervillgraten | Lead in the village and on farmed land outside it | innervillgraten.at, 20.01.2026 |
| Prägraten a. G. | Lead everywhere outside private buildings (commune's answer on oesterreich.gv.at, 2020; ordinance text not found) | oesterreich.gv.at |
| Lavant | Lead order exists, but its map is viewable only at the commune office | oesterreich.gv.at |
| Dölsach | 2010 lead order repealed in December 2024; dog-waste rules only | doelsach.at |
| Nußdorf-Debant, Virgen | State law only | oesterreich.gv.at |
| Matrei, Kals, St. Jakob i. D., Obertilliach, Kartitsch, Amlach | Nothing published online | checked commune sites, oesterreich.gv.at, RIS |

### Carinthia (Gailtal, Lesachtal)

- **K-HHWS-VO § 1** (LGBl. 62/2025, in force 29 October 2025): in hunting
  grounds outside built-up areas, dogs must be „ausnahmslos, bei Tag und
  Nacht, an der Leine“. That means a lead at all times in open country, all
  year.
- **K-LSiG § 8:** in public places with people, a lead or muzzle; elsewhere
  one must be carried.
- **Nationalparkgesetz (K-NBG 2019) § 6 Abs. 3 lit. e:** no free-running dogs in
  core zones. A dog on a lead is allowed.

### Lifts and buses

- Tyrolean statute requires a lead and a muzzle on public transport.
- Cable-car companies (Lienzer Bergbahnen, Großglockner Resort) publish no dog
  rule. Treat "carry a muzzle" as the safe instruction.

## 3. Austrian dog standard (approved by the owner, 27 October 2026)

The owner's words: "commune rule first; Tyrol and Carinthia defaults, pasture
short-lead rule, hunting warning, 'lead for the whole walk, carry a muzzle';
hold on a dog ban or Lavant-style unpublished rules". State it in each PR.

Where the commune's own rule is found, it wins. Where it is not:

1. **Tyrol:**
   - Lead or muzzle in the village (LPolG § 6a).
   - **Short lead on any pasture while it is grazed** (Almschutzverordnung § 2).
   - Lead inside Hohe Tauern, stated as the park's request.
   - A warning about dogs out of control in hunting grounds.

   Each trail says: **"Keep your dog on a lead for the whole walk and carry a
   muzzle."**
2. **Carinthia:** lead for the whole walk outside villages (K-HHWS-VO), plus
   the K-LSiG muzzle rule in villages.
3. **Protected-area check:** Tyrol and Carinthia protected-area layers, the
   Hohe Tauern boundary, and wildlife quiet zones. Hold a walk where an area
   bans dogs, and apply the 100 m strict-reserve rule to Carinthian core and
   special zones and Tyrolean Ruhegebiete.
4. **Map-based commune zones** (Tristach, Prägraten, Lavant): stating the
   stricter rule ("lead throughout") is safe. Lavant walks are held until its
   map is seen.

## 4. What the catalogue needs for Austria

Findings from the code, 27 October 2026:

- **Decided 27 October:** a new region "Tyrol & Carinthia" (country AT), added
  as a REGIONS entry with localities on top of PR #1103, which makes regions
  data-driven. No separate region plumbing is built for Austria.
- **Region and country (why):**
  - The country comes from the region (`regions-config.js` REGIONS).
  - Without new localities, an Austrian walk would be labelled "Alta Pusteria"
    or "Val Pusteria, Italy". It would also fail `locality-coverage.test.js`
    (12 km label limit).
  - A new region (e.g. `tyrol`, AT) needs about 25 hard-coded `dolomites` /
    `savoy` sites changed. The critical one is `byRegion` in
    `scripts/build-regional-runtime-data.js`, which would silently drop the
    trails. Others include the `savoy ? 'FR' : 'IT'` ternaries in `script.js`,
    the browse and homepage country filters, i18n keys, and the backoffice
    hazard area mapping.
- **Map tiles:**
  - Our OSM route tiles stop at 12.66°E (`map-style.js` HIKING_BOUNDS,
    `scripts/build-hiking-routes.js`) and are built from the Geofabrik
    `italy/nord-est` extract only.
  - Lienz (12.77°E) needs the Austria extract and wider bounds. Until then the
    map falls back to Waymarked Trails.
- **Hazards:** no Austrian MeteoAlarm or Tyrol (AT-07) avalanche connector yet.
- **Slugs:** `slugify` handles ß and umlauts (ß→ss, ö→o); German slugs
  already exist.
- **Not needed:**
  - Board walks need no new promote region.
  - The elevation cache, offline packages and weather work by coordinates.
