/**
 * Trail-by-trail presentation audits.
 *
 * Generated OSM trail files remain reproducible and untouched. This small
 * overlay records the human checks that cannot safely live in generated data:
 * official route facts, exact mapped waypoint coordinates, photo attribution,
 * and the date those presentation details were last reviewed.
 */
(function () {
  'use strict';

  const audits = {
    'osm-14381570': {
      // Route audit: 17 July 2026. Official route 09 record checked against
      // the stored OSM relation; mapped water coordinates checked against the
      // source GeoJSON; elevation compared with the official route figure.
      distance: 7.7,
      elevation: 249,
      hours: '3.5',
      elevationProfile: [
        { km: 0, elev: 1605 },
        { km: 0.6, elev: 1631 },
        { km: 1.3, elev: 1622 },
        { km: 1.8, elev: 1661 },
        { km: 2.3, elev: 1647 },
        { km: 2.9, elev: 1646 },
        { km: 3.5, elev: 1619 },
        { km: 4.1, elev: 1715 },
        { km: 4.7, elev: 1756 },
        { km: 5.3, elev: 1778 },
        { km: 5.8, elev: 1771 },
        { km: 6.4, elev: 1683 },
        { km: 7.0, elev: 1671 },
        { km: 7.6, elev: 1605 },
        { km: 7.7, elev: 1605 }
      ],
      imagePlaceholder: true,
      curated: true,
      tier: 'route-audited',
      reviewedAt: '2026-07-26',
      reviewedBy: 'ORMA route audit',
      routeAudit: {
        photo: 'No licensed trail photo is currently used; no credit is due.',
        route: 'Full route geometry present and matched to Les Karellis route 09.',
        routeNumbers: 'Les Karellis states the route follows green waymark no. 9 (\u201Csuivez le balisage vert n\u00B09\u201D) departing from the tourist office, which is the recommended start. The official description names no second number, so no numbered switch applies.',
        mapPoints: 'Mapped water points checked at their source GPS coordinates.',
        elevation: 'Profile present; headline ascent corrected to the official 249 m figure.'
      },
      graduation: {
        status: 'verified',
        required: ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'],
        completed: ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'],
        blockers: {}
      },
      verified: {
        categories: ['water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'],
        sources: [
          'Les Karellis, Randonnée vers Albanne',
          'AllTrails, Les Karellis–Albanne',
          'Service Public France, dogs in forests',
          'OpenStreetMap relation 14381570 and mapped water nodes'
        ],
        date: '2026-07-26'
      },
      shadeCoverage: 50,
      heatRisk: 'moderate',
      exposure: false,
      surfaceHazards: [],
      shadeDescription: 'The official route description alternates forest shade with open alpine pasture.',
      terrainDescription: 'The mapped relation is a closed loop using paved and compacted sections; the official route describes a marked, family-suitable walk through forest and alpine pasture.',
      waterDescription: 'Six water-related features are mapped at exact coordinates. Carry water and treat every mapped source as unconfirmed for current flow and potability.',
      dogNotes: 'Dogs are reported on this route. Keep the dog controlled through the alpages and follow French seasonal forest-leash rules; local signs and current livestock conditions take priority.',
      tips: 'Start at the Les Karellis tourist office and follow green route 09 toward Albanne. The route alternates shaded forest with open alpage; carry water even though mapped taps and springs appear near Albanne and Les Karellis.',
      sourceLinks: [
        {
          label: 'Les Karellis, Randonnée vers Albanne (official route 09)',
          url: 'https://www.karellis.com/activites-hiver/randonnee-vers-albanne/',
          categories: ['heat']
        },
        {
          label: 'AllTrails, Les Karellis–Albanne',
          url: 'https://www.alltrails.com/trail/france/savoie/les-karellis-albanne',
          categories: ['access']
        },
        {
          label: 'Service Public France, seasonal forest leash rule',
          url: 'https://www.service-public.gouv.fr/particuliers/actualites/A17343',
          categories: ['access']
        },
        {
          label: 'Waymarked Trails, Albanne, OSM relation 14381570',
          url: 'https://hiking.waymarkedtrails.org/#route?id=14381570'
        },
        {
          label: 'OpenStreetMap contributors',
          url: 'https://www.openstreetmap.org/relation/14381570'
        }
      ],
      startPoint: {
        lat: 45.2271183,
        lng: 6.404797,
        label: 'Route 09 start at Les Karellis; the official itinerary starts from the tourist office'
      },
      waterSources: [
        {
          km: 3.6,
          lat: 45.2057217,
          lng: 6.419306,
          label: 'Fountain mapped in Albanne village',
          osmId: 'node/10879608101'
        },
        {
          km: 3.6,
          lat: 45.205582,
          lng: 6.4194452,
          label: 'Public toilets with drinking water mapped in Albanne village',
          osmId: 'node/1105132294'
        },
        {
          km: 6.9,
          lat: 45.2220273,
          lng: 6.406229,
          label: 'Mapped spring box near the route',
          osmId: 'node/8996798123'
        },
        {
          km: 7.1,
          lat: 45.2229978,
          lng: 6.4045513,
          label: 'Mapped spring box near the route',
          osmId: 'node/8996798121'
        },
        {
          km: 7.1,
          lat: 45.2231275,
          lng: 6.4045236,
          label: 'Mapped spring box near the route',
          osmId: 'node/8996798122'
        },
        {
          km: 7.7,
          lat: 45.2278921,
          lng: 6.4048539,
          label: 'Mapped water tap at Les Karellis',
          osmId: 'node/13990407012'
        }
      ],
      desc: 'Official Les Karellis route 09: a 7.7 km loop from Les Karellis to Albanne through forest and alpine pasture, following green waymarks. The official route lists 249 m ascent and about 3½ hours.'
    },
    'osm-12731853': {
      // Route audit: 26 July 2026. The district overview board and route page
      // were checked against OSM relation 12731853. Official figures replace
      // the importer elevation estimate. Access: 21 October 2026. The Natz-Schabs
      // landscape plan (Durchfuehrungsbestimmungen in force since 4 April 2025,
      // Art. 3) protects Biotop 12/1 Laugen and lists what is forbidden inside
      // it: leaving the marked paths, disturbing wild animals, bathing. It
      // neither bans dogs nor sets a leash rule, which settles the access check.
      distance: 4.2,
      elevation: 100,
      hours: '1.5',
      elevationProfile: [
        { km: 0, elev: 815 },
        { km: 0.4, elev: 836 },
        { km: 0.8, elev: 878 },
        { km: 1.1, elev: 907 },
        { km: 1.5, elev: 886 },
        { km: 1.8, elev: 900 },
        { km: 2.2, elev: 883 },
        { km: 2.6, elev: 888 },
        { km: 3.0, elev: 916 },
        { km: 3.1, elev: 930 },
        { km: 3.6, elev: 918 },
        { km: 3.8, elev: 862 },
        { km: 4.1, elev: 833 },
        { km: 4.2, elev: 815 }
      ],
      imagePlaceholder: true,
      curated: true,
      tier: 'route-audited',
      reviewedAt: '2026-10-21',
      reviewedBy: 'ORMA route audit',
      routeAudit: {
        photo: 'No reusable trail photograph is used; the official board image is retained only as a source, not copied.',
        route: 'Closed OSM relation checked against the official Laugen–Elvas overview board; the official board lists a 4.2 km circuit.',
        routeNumbers: 'Bezirksgemeinschaft Eisacktal describes this circuit by name only, with no numbered waymark and no numbered switch, so the named-only statement stands in place of trail-number guidance.',
        mapPoints: 'Two water points and the suggested start were traced to exact source coordinates.',
        elevation: 'Profile present and scaled to 4.2 km; headline ascent corrected from the sampled 181 m to the official 100 m.'
      },
      graduation: {
        status: 'verified',
        required: ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'],
        completed: ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'],
        blockers: {}
      },
      verified: {
        categories: ['water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'],
        sources: [
          'Bezirksgemeinschaft Eisacktal, Rundweg Laugen Elvas',
          'Official Laugen–Elvas overview board',
          'South Tyrol nature portal, protected biotopes',
          'Landscape plan of Natz-Schabs, implementing provisions, Art. 3 (Biotop 12/1 Laugen)',
          'OpenStreetMap relation 12731853 and mapped water nodes'
        ],
        date: '2026-10-21'
      },
      shadeCoverage: 20,
      heatRisk: 'moderate',
      exposure: false,
      surfaceHazards: [],
      shadeDescription: 'The official description places most of the route in an intensively cultivated landscape, with a smaller reed-fringed pond and riparian-woodland section.',
      terrainDescription: 'The mapped circuit mixes paved, unpaved, gravel and natural-ground sections; neither the official board nor OSM records an alpine-grade or equipped section.',
      waterDescription: 'Two drinking-water points are mapped near Elvas at exact coordinates; one is marked seasonal. Availability can change, so carry a backup supply.',
      dogNotes: 'Dogs are not banned from the protected Laugen biotope, and its rules set no leash requirement. They do forbid leaving the marked paths, disturbing wild animals and bathing, so keep your dog on the path, out of the pond and under close control; a short lead through the wetland is the simple way to do that.',
      tips: 'The official circuit starts in Elvas and visits the Laugen wetland and its information stations. The route is 4.2 km with about 100 m ascent and takes roughly 1½ hours. Dogs are allowed through the Laugen biotope, but its protection rules forbid leaving the marked path, disturbing wildlife and bathing, so keep your dog on the path, out of the pond and under close control.',
      sourceLinks: [
        {
          label: 'Bezirksgemeinschaft Eisacktal, Rundweg Laugen Elvas',
          url: 'https://www.bzgeisacktal.it/de/Rundweg_Laugen_Elvas'
        },
        {
          label: 'Official Laugen–Elvas overview board',
          url: 'https://www.bzgeisacktal.it/system/web/GetDocument.ashx?cts=1535713140&fileId=1000136'
        },
        {
          label: 'South Tyrol nature portal, protected biotopes',
          url: 'https://natur-raum.provinz.bz.it/de/biotope'
        },
        {
          label: 'Landscape plan of Natz-Schabs, implementing provisions (newPlan)',
          url: 'https://newplan.civis.bz.it/newplan/api/newp/api/document/10974'
        },
        {
          label: 'Waymarked Trails, OSM relation 12731853',
          url: 'https://hiking.waymarkedtrails.org/#route?id=12731853'
        },
        {
          label: 'OpenStreetMap contributors',
          url: 'https://www.openstreetmap.org/relation/12731853'
        }
      ],
      startPoint: {
        lat: 46.7322121,
        lng: 11.6670963,
        label: 'Elvas route start beside the mapped bus stop'
      },
      waterSources: [
        {
          km: 0,
          lat: 46.732186,
          lng: 11.66711,
          label: 'Seasonal church fountain mapped in Elvas',
          osmId: 'node/7559966242'
        },
        {
          km: 4.2,
          lat: 46.7323292,
          lng: 11.66813,
          label: 'Drinking-water well mapped in Elvas',
          osmId: 'node/1388892411'
        }
      ],
      desc: 'A short interpretive circuit from Elvas to the Laugen wetland, a reed-fringed protected biotope set within the cultivated Natz–Schabs plateau. The official board lists 4.2 km, 100 m ascent and about 1½ hours.'
    },
    'osm-7548344': {
      // Route audit: 26 July 2026. The CAI Lozzo route description and map
      // were checked against OSM relation 7548344. Official distance/ascent
      // replace noisy terrain-sampling figures. 21 October 2026: the CAI sheet
      // defines "sv." as the waymark and lists this loop as sv. 5; both
      // municipalities the loop crosses require a leash on trails; no pasture
      // is described or mapped along the line.
      distance: 3,
      elevation: 250,
      hours: '1.5–2',
      elevationProfile: [
        { km: 0, elev: 945 },
        { km: 0.3, elev: 893 },
        { km: 0.4, elev: 851 },
        { km: 0.7, elev: 872 },
        { km: 0.8, elev: 970 },
        { km: 1.0, elev: 991 },
        { km: 1.3, elev: 1064 },
        { km: 1.6, elev: 1059 },
        { km: 1.8, elev: 1114 },
        { km: 2.2, elev: 1108 },
        { km: 2.5, elev: 1029 },
        { km: 2.8, elev: 1006 },
        { km: 3, elev: 945 }
      ],
      imagePlaceholder: true,
      curated: true,
      tier: 'route-audited',
      reviewedAt: '2026-10-21',
      reviewedBy: 'ORMA route audit',
      routeAudit: {
        photo: 'No reusable trail photograph is used; source-page images are not copied.',
        route: 'Closed OSM relation checked against CAI Lozzo route 5 and its published map; the official description lists a 3 km loop.',
        routeNumbers: 'The CAI Lozzo sheet defines sv. as the waymark (Anelli e Vie are marked green-and-white on the ground) and lists this loop as "Anello del sole (sv. 5)"; OSM records the same mark, a 5 on a green-and-white flag. Follow waymark 5 from Niante Aze round the loop. The official description names no other number, so no numbered switch applies.',
        mapPoints: 'No water, hut or food point is mapped on the loop; the mapped route start retains exact coordinates.',
        elevation: 'Profile present and scaled to 3 km; headline ascent corrected from the sampled 422 m to the official 250 m.'
      },
      graduation: {
        status: 'verified',
        required: ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'],
        completed: ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'],
        blockers: {}
      },
      verified: {
        categories: ['water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'],
        sources: [
          'CAI Lozzo di Cadore, Anelli e Vie route descriptions',
          'Lozzo di Cadore, Anello del Sole route page and map',
          'OpenStreetMap relation 7548344',
          'Comune di Lozzo di Cadore, Regolamento di Polizia Urbana (2018), Art. 39',
          'Comune di Domegge di Cadore, Regolamento di Polizia Urbana (1998, amended 2023), dogs in public places',
          'OpenStreetMap land cover and farm buildings along the loop'
        ],
        date: '2026-10-21'
      },
      shadeCoverage: 40,
      heatRisk: 'moderate',
      exposure: false,
      surfaceHazards: [],
      shadeDescription: 'The official description records pine, juniper, larch and spruce along the first climb, followed by a more open view beyond Lago d’Aosto.',
      terrainDescription: 'The marked loop climbs gently toward Lago d’Aosto on mostly natural ground. The official description rates the wider route collection E and names no equipped or alpine-grade section on route 5.',
      waterDescription: 'No drinking-water point is mapped on the loop. Carry a full supply; the marsh at Lago d’Aosto is not a drinking source.',
      dogNotes: 'Dogs must be on a leash: Lozzo di Cadore requires one on all public places, trails included, and the western end of the loop lies in Domegge di Cadore, which requires a leash of at most 1.3 m or a muzzle. No pasture is described or mapped along the loop, but two farm buildings stand beside the path, so animals may be kept close by.',
      tips: 'Start at Niante Aze outside Lozzo and follow route 5 toward Lago d’Aosto. The official route is about 3 km with 250 m ascent; carry all water you need. Keep your dog on a leash throughout: Lozzo di Cadore requires one on its trails, Domegge di Cadore (the western end of the loop) a leash of at most 1.3 m or a muzzle, and the path passes two farm buildings where animals may be kept.',
      sourceLinks: [
        {
          label: 'Lozzo di Cadore, Anello del Sole',
          url: 'https://www.lozzodicadore.eu/sito/node/183'
        },
        {
          label: 'CAI Lozzo di Cadore, Anelli e Vie route descriptions',
          url: 'https://www.lozzodicadore.eu/doc/pieghevoli/anelli-di-lozzo-di-cadore-descrizione.pdf'
        },
        {
          label: 'Lozzo di Cadore, route map',
          url: 'https://www.lozzodicadore.eu/doc/pieghevoli/anelli-di-lozzo-di-cadore-carta-25000.pdf'
        },
        {
          label: 'Comune di Lozzo di Cadore, Regolamento di Polizia Urbana (Art. 39, dogs)',
          url: 'https://lozzo-di-cadore-api.municipiumapp.it/s3/3676/allegati/regolamento-polizia-urbana-2018.pdf'
        },
        {
          label: 'Comune di Domegge di Cadore, Regolamento di Polizia Urbana',
          url: 'https://comune.domeggedicadore.bl.it/documenti/2556047/regolamento-polizia-urbana'
        },
        {
          label: 'Waymarked Trails, OSM relation 7548344',
          url: 'https://hiking.waymarkedtrails.org/#route?id=7548344'
        },
        {
          label: 'OpenStreetMap contributors',
          url: 'https://www.openstreetmap.org/relation/7548344'
        }
      ],
      startPoint: {
        lat: 46.4841247,
        lng: 12.4370359,
        label: 'Mapped route start at Niante Aze; verify current parking locally'
      },
      waterSources: [],
      desc: 'A compact woodland loop from Niante Aze toward the marshy Lago d’Aosto, passing gypsum outcrops and mixed conifers before opening to a view toward the Spalti di Toro. The official route lists about 3 km and 250 m ascent.'
    },
    // Corrections only, 22 October 2026: place, start and what a walker needs
    // to know, from the official source where one exists. These trails are not
    // audited; nothing here claims a check was done.
    'osm-12127424': {
      area: 'La Combe, Saint-Jean-de-Maurienne',
      desc: 'A short woodland loop of about 2.8 km on footpaths at La Combe, just outside Saint-Jean-de-Maurienne, waymarked EN04 on the Cœur de Maurienne Arvan network; a short stem from the car park is walked out and back. It is all path, with no road stretches, and part of it is a running circuit, so expect runners. Toilets with drinking water stand by the sports ground 55 m from the route.',
      startPoint: { lat: 45.265509, lng: 6.336686, label: 'La Combe 1 car park, Saint-Jean-de-Maurienne' }
    },
    'osm-14377007': {
      area: 'Les Karellis, Montricher-Albanne',
      desc: 'An out-and-back walk of about 3.9 km from Les Karellis to the Lac de Pramol at Albanne, with a short loop round the lake; it is not a circuit, so the way back is the way out. Almost all of it follows the wide Route du Lac track, which is also a green ski piste in winter and is not closed to cars, plus about 100 m on the asphalt lake road. Drinking water is mapped at the start and by the lake, and the Vinouve chairlift runs alongside in summer.',
      startPoint: { lat: 45.227201, lng: 6.40469, label: 'Vinouve chairlift lower station, Les Karellis' }
    },
    'osm-9487078': {
      area: 'Seis am Schlern / Siusi allo Sciliar – Kastelruth',
      desc: 'A forest loop of about 3.4 km on route 3 above Seis am Schlern, past the ruins of Hauenstein and Salegg castles, linked with the poet Oswald von Wolkenstein; the official route from the Seiser Alm cable-car valley station is about 5.7 km with 280 m of climbing. Mostly path and gravel track, with steps and a stream crossing, and not suitable for pushchairs. The approach from the valley station is on the asphalt Salegg road. No water is mapped on the loop.',
      startPoint: { lat: 46.540206, lng: 11.5637402, label: 'Seiser Alm cable-car valley station, Seis (official start)' }
    },
    'osm-13528390': {
      area: 'Pianon, Tambre (Alpago)',
      elevation: 212,
      desc: 'A loop of about 4.8 km from the square at Pianon in Tambre, down the old Sabbadalt path to the Puos–Tambre road and back up through the hamlet of Sabbadalt and the beech wood of the Bosco delle Fratte, waymarked 7. Much of it is surfaced: a steep descent on cement then asphalt, two crossings of the main road with a short stretch along it (cross with care and keep your dog close), and a paved road back to Pianon. Fountains are on the way, including the Fontana delle Lavine on the main-road bend.',
      startPoint: { lat: 46.141607, lng: 12.430358, label: 'Piazza 11 gennaio 1945, Pianon (official start)' }
    },
    'osm-3202880': {
      // Hand audit: 22 October 2026. The province hiking-trail register line
      // is covered 100% by the stored line, which is longer because the two
      // lakes form a figure-of-eight and the connector between them is walked
      // twice. Every sampled point is in Eppan, not Kaltern. Dog access rests
      // on Eppan's dog regulation (Art. 4, 8) and the Montiggler Wald area
      // plan (Art. 7(5) k, l): a lead of at most 1.5 m, no running free in the
      // biotope, no bathing at the lidos in summer.
      area: 'Eppan / Appiano – Montiggl',
      distance: 4.6,
      elevation: 110,
      hours: '1–1.5',
      curated: true,
      tier: 'route-audited',
      reviewedAt: '2026-10-22',
      reviewedBy: 'ORMA route audit',
      routeAudit: {
        photo: 'Giovanni Ussi, CC BY-SA 4.0 on Wikimedia Commons: the larger lake from the wooded shore path, 129 m from the line.',
        route: 'The province trail-register line (4.0 km, open-ended) lies entirely on the stored 4.6 km closed line; the difference is the 250 m connector between the lakes, walked twice.',
        routeNumbers: 'The register gives the loop no number and IDM describes it by name: from Parkplatz Montiggl follow 1/A to the small lake, go round it clockwise, then on to the big lake and back.',
        mapPoints: 'No drinking-water node lies within 150 m of the line; the start is where path 1/A meets the loop at the small lake (the car park beside it is private).',
        elevation: 'Headline ascent corrected from the sampled 156 m to the official 112 m (rounded to 110 m).'
      },
      graduation: {
        status: 'verified',
        required: ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'],
        completed: ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'],
        blockers: {}
      },
      verified: {
        categories: ['water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'],
        sources: [
          'Südtirol.info (IDM Südtirol), Montiggler Seen Runde',
          'Autonomous Province of Bolzano hiking-trail register, Rundweg Montiggler Seen',
          'Gemeinde Eppan, Verordnung über die Haltung und Führung von Hunden, Art. 4 and 8',
          'Gebietsplan Montiggler Wald–Mitterberg, Durchführungsbestimmungen, Art. 7(5)',
          'OpenStreetMap relation 3202880, Montiggler Wald forest and surface tags'
        ],
        date: '2026-10-22'
      },
      shadeCoverage: 90,
      heatRisk: 'moderate',
      exposure: false,
      surfaceHazards: [
        'About 0.6 km on asphalt access roads with lido and hotel traffic',
        'Short stretch on the Montiggler Straße',
        'Roots and stones, slippery when wet',
        'Wooden boardwalk'
      ],
      shadeDescription: 'Almost entirely in the deciduous Montiggl forest at about 500 m; only short lakeside stretches are open. Low and warm in summer.',
      terrainDescription: 'Easy woodland paths and gravel tracks round both lakes, with short climbs, roots and stones, and about 0.6 km on asphalt access roads near the lido.',
      waterDescription: 'No mapped fountain on the loop. Both lakes are on the route, but dogs may not bathe at the lidos or the signed bathing spots from 15 May to 15 September.',
      dogNotes: 'Eppan requires a lead of at most 1.5 m on all public ground and a muzzle carried. Both lakes are a protected biotope where dogs may not run free and nobody may leave the paths. From 15 May to 15 September dogs may not bathe at the lidos or the signed bathing spots, and they are banned from farmland, including the orchards and vineyards beside the path.',
      tips: 'The loop circles both Montiggl lakes in the shade of the Montiggl forest: 4.6 km with about 110 m of climbing, roughly an hour and a half. Keep your dog on a short lead (1.5 m at most) the whole way: Eppan requires it, and the lakes are a protected biotope where dogs may not run free and you must stay on the path. From mid-May to mid-September dogs may not swim at the lidos or the signed bathing spots, and there is no fountain, so bring water.',
      sourceLinks: [
        {
          label: 'Südtirol.info, Montiggler Seen Runde',
          url: 'https://www.suedtirol.info/de/de/erlebnisse-und-events/plp-erlebnisse/erlebnisse-suedtirol/pdp-erlebnisse.smgpoi78f78b7fec7706efe8118a3e4e471486.montiggler-seen-runde.montiggl'
        },
        {
          label: 'Province hiking-trail register, Rundweg Montiggler Seen (Open Data Hub)',
          url: 'https://tourism.api.opendatahub.com/v1/ODHActivityPoi/routes-hikingtrails.11428008'
        },
        {
          label: 'Gemeinde Eppan, Verordnung über die Haltung und Führung von Hunden',
          url: 'https://www.gemeinde.eppan.bz.it/de/Verwaltung/Dokumente/Verordnung_ueber_die_Haltung_und_Fuehrung_von_Hunden'
        },
        {
          label: 'Gebietsplan Montiggler Wald–Mitterberg, Durchführungsbestimmungen (newPlan)',
          url: 'https://newplan.civis.bz.it/newplan/api/newp/api/document/11069'
        },
        {
          label: 'Waymarked Trails, OSM relation 3202880',
          url: 'https://hiking.waymarkedtrails.org/#route?id=3202880'
        },
        {
          label: 'OpenStreetMap contributors',
          url: 'https://www.openstreetmap.org/relation/3202880'
        }
      ],
      startPoint: {
        lat: 46.42908,
        lng: 11.29422,
        label: 'North shore of the small Montiggl lake, where path 1/A arrives from Parkplatz Montiggl (1.2 km); the car park beside it is private'
      },
      waterSources: [],
      desc: 'A shaded loop round both Montiggl lakes in the Montiggl forest above Eppan: woodland paths along the small lake and the larger lake with its lido, joined by a short connector walked twice. The official route lists about 4 km and 112 m of ascent.'
    },
    'prato-piazza': {
      // Hand audit: 22 October 2026. The stored line was a different walk
      // (path 37 towards the Dürrensteinhütte); it is now the official route
      // to the Strudelkopf, routed on OpenStreetMap ways through the tourism
      // board's GPX (97.8% of its points within 25 m). Two municipalities,
      // Prags and Toblach, and the Fanes-Sennes-Prags nature park: a lead
      // everywhere.
      area: 'Plätzwiese / Prato Piazza – Prags and Toblach',
      hours: '2.5–3',
      curated: true,
      tier: 'route-audited',
      reviewedAt: '2026-10-22',
      reviewedBy: 'ORMA route audit',
      routeAudit: {
        photo: 'ORMA-owned photo of the gravel military road across the Plätzwiese plateau with the Cristallo group behind, in summer.',
        route: 'Official route: Plätzwiese to the Strudelkopf summit cross, 4.1 km one way; rebuilt on OSM ways through the board GPX at 4.03 km, and walked back the same way (8.2 km).',
        routeNumbers: 'The board’s text sends walkers along the 37 road towards the Dürrensteinhütte and left onto 34; its GPX, which the drawn line follows, takes the parallel footpath 40A across the plateau to the same junction. Then 34 to the saddle (about 2,200 m) and right for the summit; return the same way.',
        mapPoints: 'Start at the Berggasthof Plätzwiese; a drinking-water point (OSM node 14024034408) and a spring (node 5754395008) traced to exact coordinates; the saddle turn by the war memorial is a decision point.',
        elevation: 'Official 359 m up and 42 m down one way (1,991–2,305 m), so about 400 m of climbing for the round trip; profile sampled along the rebuilt line.'
      },
      graduation: { status: 'verified', required: ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'], completed: ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'], blockers: {} },
      verified: {
        categories: ['water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'],
        sources: [
          '3 Zinnen Dolomites, Sommerwanderung Parkplatz Plätzwiese – Strudelkopf',
          'Gemeinde Prags, Verordnung über die Haltung von Hunden, Art. 2',
          'Gemeinde Toblach, Verordnung über die Haltung und Führung von Hunden, Art. 4',
          'Province of Bolzano, code of conduct for the nature parks',
          'Naturpark Fanes-Sennes-Prags decree (DLH 72/V/LS of 4 March 1980), Art. 5 and 7',
          'OpenStreetMap ways along paths 37 and 34'
        ],
        date: '2026-10-22'
      },
      shadeCoverage: 5,
      heatRisk: 'moderate',
      exposure: false,
      surfaceHazards: ['Loose gravel on the summit path', 'Rough gravel tracks', 'Mountain bikes on the tracks', 'Hotel guests\' cars near the start'],
      shadeDescription: 'Almost no shade: open high pasture and dwarf pine between 2,000 and 2,300 m.',
      terrainDescription: 'Gravel tracks and grassy footpaths across the plateau, then a gravel path to a rounded summit; rated easy by the tourism board.',
      waterDescription: 'The Berggasthof at the start, a drinking-water point near km 1.4 and a spring at km 2.3; nothing on the last 1.7 km to the summit, so carry water.',
      dogNotes: 'Dogs must be on a lead for the whole walk: Prags and Toblach require it on all public ground (at most 1.5 m in Toblach), and so does the nature park. Grazing is permitted on the plateau, so expect cattle in summer.',
      tips: 'From the Berggasthof Plätzwiese cross the plateau on footpath 40A (or the parallel 37 road), turn onto 34 and climb to the Strudelkopf summit cross, then come back the same way: about 8.2 km and 400 m of climbing. Keep your dog on a short lead the whole way, as Prags, Toblach and the nature park all require, and give grazing cattle a wide berth. The summit section has no water or shade, so carry enough for your dog.',
      sourceLinks: [
        { label: '3 Zinnen Dolomites, Plätzwiese – Strudelkopf', url: 'https://www.dreizinnen.com/de/activity/sommerwanderung-parkplatz-pl-tzwiese-strudelkopf_50065' },
        { label: 'Gemeinde Prags, dog regulation', url: 'https://www.comune.braies.bz.it/de/Verwaltung/Dokumente/Verordnung_ueber_die_Haltung_von_Hunden' },
        { label: 'Gemeinde Toblach, dog regulation', url: 'https://www.gemeinde.toblach.bz.it/de/Verwaltung/Dokumente/Gemeindeverordnung_ueber_die_Haltung_und_Fuehrung_von_Hunden' },
        { label: 'Province of Bolzano, nature parks code of conduct', url: 'https://nature-parks.province.bz.it/en/code-of-conduct-for-the-nature-parks' },
        { label: 'Waymarked Trails, path 34 (OSM relation 1185346)', url: 'https://hiking.waymarkedtrails.org/#route?id=1185346' },
        { label: 'OpenStreetMap contributors', url: 'https://www.openstreetmap.org/relation/1185346' }
      ],
      desc: 'An easy climb across the open Plätzwiese plateau to the Strudelkopf summit cross, with wide views of the Cristallo and the Drei Zinnen: path 40A or the 37 road across the plateau, then 34 to the top and back the same way. The official route lists 4.1 km and 359 m of ascent each way up.'
    },
    'valley-view': {
      // Hand audit: 22 October 2026. The stored line was a 2.7 km one-way
      // fragment; it is now the official 6.6 km loop from St. Peter
      // (Sonnseitenweg, Panoramaweg, No. 11), rebuilt from OSM ways at
      // 6.60 km. Villnöss: lead of at most 1.5 m, no dogs on meadows.
      area: 'St. Peter, Villnöss / Funes',
      curated: true,
      tier: 'route-audited',
      reviewedAt: '2026-10-22',
      reviewedBy: 'ORMA route audit',
      routeAudit: {
        photo: 'Howwi, CC BY-SA 3.0: the Villnöss sunny-side slope looking west in September, the meadows the walk crosses.',
        route: 'Official 6.6 km loop (Südtirol.info, Tourismusgenossenschaft Odles); rebuilt on OSM relations 11817202, 11817269 and 948853 at 6.60 km, closed.',
        routeNumbers: 'From St. Peter centre follow the road towards Coll/Würzjoch to the first hairpin, take the Sonnseitenweg (sun symbol) east past the Pestbildstock to the Bühlerhof, climb on No. 32 to the Panoramaweg (mountain symbol) and follow it west to No. 11, then descend on No. 11 past the Gsoihof to the start.',
        mapPoints: 'Start at the official point in St. Peter; the village fountain (OSM node 9668988276) and three streams traced to exact coordinates.',
        elevation: 'Official 322 m up and down, highest point 1,395 m; profile sampled along the rebuilt line.'
      },
      graduation: { status: 'verified', required: ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'], completed: ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'], blockers: {} },
      verified: {
        categories: ['water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'],
        sources: [
          'Südtirol.info (Tourismusgenossenschaft Odles), Sonnseitenweg–Panoramaweg',
          'Gemeinde Villnöss, Verordnung über die Haltung und Führung von Hunden, Art. 4 and 8',
          'Villnöss landscape plan, implementing provisions (newPlan doc 9783)',
          'OpenStreetMap relations 11817202, 11817269 and 948853, farmyard and land-use tags'
        ],
        date: '2026-10-22'
      },
      shadeCoverage: 30,
      heatRisk: 'high',
      exposure: false,
      surfaceHazards: ['About 1.9 km of asphalt, including the road towards Coll/Würzjoch', 'Crossing of the Coller Straße', 'Short flights of steps', 'Rough gravel on the Panoramaweg', 'Ice in winter: the Panoramaweg is not always cleared'],
      shadeDescription: 'A south-facing sunny-side walk at 1,135–1,395 m: about a third in woodland, the rest across open meadows and farmyards.',
      terrainDescription: 'Farm roads and field paths on the Sonnseitenweg, a narrow gravel path on the Panoramaweg, and a compacted path and road back down on No. 11.',
      waterDescription: 'The fountain in St. Peter at the start and finish and three small streams on the way; nothing else, so carry water.',
      dogNotes: 'Villnöss requires a lead of at most 1.5 m on all public ground and a muzzle carried, bans dogs from meadows and fields, and forbids bathing in public fountains. The loop passes seven farmyards, so animals may be close by.',
      tips: 'A 6.6 km loop from St. Peter with views of the Odle/Geisler peaks: east on the Sonnseitenweg, back west on the Panoramaweg and down on No. 11, about 2 hours with 322 m of climbing. Keep your dog on a short lead (1.5 m at most) and off the hay meadows, as Villnöss requires, and out of the village fountains. Most of it is in sun, so start early in summer and carry water.',
      sourceLinks: [
        { label: 'Südtirol.info, Sonnseitenweg–Panoramaweg', url: 'https://www.suedtirol.info/de/de/erlebnisse-und-events/plp-erlebnisse/erlebnisse-suedtirol/pdp-erlebnisse.smgpoi4d53fc3760a30cad25696849c7669dd5.sonnseitenweg-panoramaweg.st--peter---villnoess' },
        { label: 'Gemeinde Villnöss, dog regulation', url: 'https://www.gemeinde.villnoess.bz.it/system/web/GetDocument.ashx?fileId=1048678' },
        { label: 'Villnöss landscape plan, implementing provisions (newPlan)', url: 'https://newplan.civis.bz.it/newplan/api/newp/api/document/9783' },
        { label: 'Waymarked Trails, Panoramaweg (OSM relation 11817269)', url: 'https://hiking.waymarkedtrails.org/#route?id=11817269' },
        { label: 'OpenStreetMap contributors', url: 'https://www.openstreetmap.org/relation/11817269' }
      ],
      desc: 'A sunny loop above St. Peter in Villnöss: out east on the Sonnseitenweg past farms and the Pestbildstock, back west on the higher Panoramaweg with the Odle/Geisler peaks ahead, and down on path 11. The official route lists 6.6 km and 322 m of ascent.'
    },
    'lago-carezza': {
      // Hand audit: 22 October 2026. The stored line was the lake circuit
      // only, drawn anticlockwise; it is now the official walk from the car
      // park through the underpass and clockwise round the lake, routed on
      // OSM ways through the tourism board's GPX (all points within 25 m),
      // plus the way back to the car. Welschnofen: lead of at most 1.5 m and
      // a muzzle carried; the lake is a natural monument fenced off.
      area: 'Carezza, Welschnofen / Nova Levante',
      curated: true,
      tier: 'route-audited',
      reviewedAt: '2026-10-22',
      reviewedBy: 'ORMA route audit',
      routeAudit: {
        photo: 'ORMA-owned photo of Lago di Carezza and the Latemar spires in summer.',
        route: 'Official walk 1.2 km from the car park to the viewing platform (Val d’Ega Turismo GPX); rebuilt on OSM ways at 1.5 km including the 180 m back to the car.',
        routeNumbers: 'No route number: from the car park follow the yellow signs through the underpass to the viewing platform, then walk round the lake clockwise.',
        mapPoints: 'Start at the car park (GPX first point); drinking water at OSM node 7468241992 just past the underpass.',
        elevation: 'Official 21 m up, high point 1,554 m, low point 1,539 m; profile drawn from the official high and low points because the terrain model is too coarse for the lakeshore.'
      },
      graduation: { status: 'verified', required: ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'], completed: ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'], blockers: {} },
      verified: {
        categories: ['water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'],
        sources: [
          'Val d’Ega Turismo, Breve giro del Lago di Carezza',
          'Gemeinde Welschnofen, Hundeverordnung (2023), Art. 4 and 8',
          'Welschnofen landscape plan, implementing provisions, Art. 3(4) (newPlan doc 8298)',
          'OpenStreetMap forest, footway and drinking-water tags'
        ],
        date: '2026-10-22'
      },
      shadeCoverage: 60,
      heatRisk: 'low',
      exposure: false,
      surfaceHazards: ['Busy car park at the start', 'Main road beside the lake, passed through an underpass', 'Gravel and pebble paths with a short muddy patch', 'Very crowded in summer'],
      shadeDescription: 'Spruce forest wraps most of the lake circuit; the shore-side edge and the car park are open.',
      terrainDescription: 'Flat, wide gravel and pebble footways suitable for pushchairs, with an asphalt approach from the car park through an underpass.',
      waterDescription: 'One drinking fountain just past the underpass (spring to autumn). The lake is fenced off, so dogs cannot drink from it.',
      dogNotes: 'Welschnofen requires a lead of at most 1.5 m on all public ground and a muzzle carried, and forbids dogs bathing in fountains and troughs. The lake is a protected natural monument: nobody may go past the fence.',
      tips: 'From the car park follow the yellow signs through the underpass and walk round the lake clockwise: about 1.5 km back to the car, 20 to 30 minutes. Keep your dog on a short lead (1.5 m at most) and carry a muzzle, as Welschnofen requires; the lake is a protected monument, so neither you nor your dog may go past the fence. Top up at the fountain just after the underpass, and come early, because the path is very crowded in summer.',
      sourceLinks: [
        { label: 'Val d’Ega Turismo, Breve giro del Lago di Carezza', url: 'https://eggental.com/it/activity/breve-giro-del-lago-di-carezza_5712' },
        { label: 'Gemeinde Welschnofen, Hundeverordnung (2023)', url: 'https://www.gemeinde.welschnofen.bz.it/system/web/GetDocument.ashx?cts=1724066701&fileId=1354988' },
        { label: 'Welschnofen landscape plan, implementing provisions (newPlan)', url: 'https://newplan.civis.bz.it/newplan/api/newp/api/document/8298' },
        { label: 'OpenStreetMap drinking water node 7468241992', url: 'https://www.openstreetmap.org/node/7468241992' }
      ]
    }
  };

  // Idempotent, and exported, because the overlay has to be applied again
  // whenever more trails arrive. A trail page loads only its own detail file up
  // front and fetches the rest of the region afterwards, so trails that land
  // late would otherwise show their un-audited generated figures -- the
  // regional data generator does not read this file, so for example
  // osm-14381570 is 7.9 km / 262 m there and 7.7 km / 249 m once audited.
  function apply(list) {
    if (!Array.isArray(list)) return list;
    list.forEach((trail) => {
      const audit = trail && audits[trail.id];
      if (audit) Object.assign(trail, audit);
    });
    return list;
  }

  if (typeof window !== 'undefined') window.DoloPawsTrailAudits = { apply: apply };
  if (typeof trails !== 'undefined' && Array.isArray(trails)) apply(trails);
})();
