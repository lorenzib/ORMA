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
    'osm-16395076': {
      // Hand audit 22 October 2026: route, start and ascent from the official page (Grand Chambéry Alpes Tourisme,
      // Apidae 108809); dogs on a lead at all times per that page and the commune's lake rules.
      "area": "La Thuile – Bauges",
      "elevation": 20,
      "hours": "0.75",
      "desc": "A gentle 2 km loop round the Lac de la Thuile, the only natural lake in the Bauges, below the village of La Thuile at about 874 m: a dirt path along the south shore, the quiet lake road along the east shore past the inn and the town hall, and back past the cemetery. \n\nThe lake is a protected natural area and private ground: the commune allows dogs on a lead, forbids letting them off, and asks you to pick up after them. Just over half the loop is on quiet tarmac where cars can come at any moment, the dirt sections can be wet, and there is little shade. Keep your dog off the meadows and the reed beds.",
      "tips": "Start at the village-hall car park (salle des fêtes) in La Thuile, the official start. A tap is mapped by the lake car park and public toilets stand near the town hall; carry water on hot days.",
      "startPoint": {
        "lat": 45.530335,
        "lng": 6.053048,
        "label": "Village-hall car park (salle des fêtes), La Thuile (official start)"
      },
      "shadeCoverage": 15,
      "heatRisk": "moderate",
      "exposure": false,
      "surfaceHazards": [],
      "curated": true,
      "tier": "route-audited",
      "reviewedAt": "2026-10-22",
      "reviewedBy": "ORMA route audit",
      "routeAudit": {
        "photo": "Commons, Florian Pépellin, CC BY-SA 3.0, taken 19 m from the line.",
        "route": "Closed line within 2% and 15 m of the official GPX (2.0 km).",
        "routeNumbers": "The official page names the loop without a number and marks its turns by landmarks (inn, town hall, cemetery); no numbered switch applies.",
        "mapPoints": "Start moved to the official car park; tap and toilets traced to OSM.",
        "elevation": "Headline ascent corrected to the official 20 m."
      },
      "graduation": {
        "status": "verified",
        "required": [
          "photo",
          "route",
          "routeNumbers",
          "mapPoints",
          "elevation",
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "completed": [
          "photo",
          "route",
          "routeNumbers",
          "mapPoints",
          "elevation",
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "blockers": {}
      },
      "verified": {
        "categories": [
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "sources": [
          "Grand Chambéry Alpes Tourisme, La boucle du lac de la Thuile (Apidae 108809)",
          "Commune de La Thuile, Le lac de La Thuile (rules for the site)",
          "Natura 2000, nature reserves and biotope orders: none on the line (EEA, INPN)",
          "OpenStreetMap relation 16395076, road classes and land cover along the line"
        ],
        "date": "2026-10-22"
      },
      "sourceLinks": [
        {
          "label": "Grand Chambéry Alpes Tourisme, La boucle du lac de la Thuile",
          "url": "https://explore.chamberymontagnes.com/fr/itineraires/la-boucle-du-lac-de-la-thuile"
        },
        {
          "label": "Commune de La Thuile, Le lac de La Thuile",
          "url": "https://www.la-thuile.com/la-commune/le-lac-de-la-thuile"
        },
        {
          "label": "OpenStreetMap relation 16395076",
          "url": "https://www.openstreetmap.org/relation/16395076"
        }
      ]
    },
    'osm-19153189': {
      // Hand audit 22 October 2026: route, start, distance and climb from the Amicale Pédestre de l'Arclusaz
      // (operator) pages and topo; no commune, park or reserve dog rule on the line, so the national baseline applies.
      "area": "Saint-Pierre-d'Albigny – Combe de Savoie",
      "distance": 4,
      "elevation": 270,
      "hours": "1.25–1.5",
      "desc": "A 4.1 km loop above Saint-Pierre-d'Albigny, one of the Amicale Pédestre de l'Arclusaz trail circuits, waymarked with pink plates showing a trail-shoe print and an arrow. From the gym car park it climbs through the village and across about 700 m of meadows to the Mont-Benoît path and the belvedere (IGN marker 655) over the Combe de Savoie, then returns by Mont-Benoît, Mollard and the col du Taccon with a steep descent to La Noiriat. \n\nNo commune, park or reserve rule restricts dogs here, so the national rules apply: do not let your dog stray, and keep it on a lead in woods and fields off the paths from 15 April to 30 June. The loop crosses the D101 and the D911 twice each, and a stretch runs through the Natura 2000 site of the eastern Bauges. About half of it is wooded; the open, south-facing stretches get hot in summer.",
      "tips": "Start at the gym car park in Saint-Pierre-d'Albigny, by the Frontailles schools, and follow the pink trail-shoe plates in the direction of the arrows. A drinking-water point is mapped about 1 km in, and the stone basin at Mont-Benoît (about km 2.1) is a place for your dog to cool off. Keep your dog on the path through the meadows.",
      "startPoint": {
        "lat": 45.57186,
        "lng": 6.15893,
        "label": "Gym car park, Saint-Pierre-d'Albigny (official start)"
      },
      "shadeCoverage": 47,
      "heatRisk": "moderate",
      "exposure": false,
      "surfaceHazards": [],
      "curated": true,
      "tier": "route-audited",
      "reviewedAt": "2026-10-22",
      "reviewedBy": "ORMA route audit",
      "routeAudit": {
        "photo": "Commons, Florian Pépellin, CC BY-SA 4.0, taken 10 m from the line at the belvedere.",
        "route": "Closed line, 4.01 km against the official 4.1 km, same direction as the topo.",
        "routeNumbers": "No number: the circuit is waymarked by colour (pink) with direction arrows; the topo names no junction with another circuit, so no switch applies.",
        "mapPoints": "Start at the official gym car park; water point and Mont-Benoît basin traced to OSM.",
        "elevation": "Official climb 270 m."
      },
      "graduation": {
        "status": "verified",
        "required": [
          "photo",
          "route",
          "routeNumbers",
          "mapPoints",
          "elevation",
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "completed": [
          "photo",
          "route",
          "routeNumbers",
          "mapPoints",
          "elevation",
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "blockers": {}
      },
      "verified": {
        "categories": [
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "sources": [
          "Amicale Pédestre de l'Arclusaz, Circuit du belvédère (page and topo)",
          "Arrêté du 16 mars 1955 on dogs straying (national baseline)",
          "Commune of Saint-Pierre-d'Albigny, published municipal orders: none on dogs",
          "Natura 2000 FR8202002 on about 630 m; no reserve, national park or biotope order on the line (EEA, INPN)",
          "OpenStreetMap relation 19153189, road classes, land cover and water along the line"
        ],
        "date": "2026-10-22"
      },
      "sourceLinks": [
        {
          "label": "Amicale Pédestre de l'Arclusaz, Circuit du belvédère",
          "url": "https://ap-arclusaz.fr/fr/rb/324820/circuit-du-belvedere"
        },
        {
          "label": "Amicale Pédestre de l'Arclusaz, the trail circuits",
          "url": "https://ap-arclusaz.fr/fr/rb/335220/lassociation-et-les-parcours-trail"
        },
        {
          "label": "Arrêté du 16 mars 1955 (dogs straying)",
          "url": "https://aida.ineris.fr/reglementation/arrete-160355-divagation-chiens"
        },
        {
          "label": "OpenStreetMap relation 19153189",
          "url": "https://www.openstreetmap.org/relation/19153189"
        }
      ]
    },
    'osm-3982382': {
      // Hand audit 22 October 2026: route, figures and dog rule from Chartreuse Tourisme (Apidae) and its official
      // topo; the published line is the official GPX. Road stretches measured on OSM.
      "area": "Les Échelles / Saint-Pierre-de-Genebroz – Chartreuse",
      "distance": 4.9,
      "elevation": 173,
      "desc": "A loop of about 4.9 km from Les Échelles on the north-western edge of the Chartreuse regional park, following the GR9 from the Croix des Carriers past the Chapelle de la Madeleine viewpoint and returning on a yellow-waymarked path through the valley. \n\nDogs are accepted on a lead, according to Chartreuse Tourisme, and the official topo records no livestock guardian dogs. About half the walk is wooded. The way back runs about 430 m along the D921, part of it at 80 km/h with no pavement, then short stretches of the D1006 and D920 through the village at 30 km/h: keep your dog close there.",
      "tips": "Start at the Place de la Corderie car park (Rivièr'Alp, by the Maison du Guiers) or the church car park in Les Échelles. A tap is mapped by the Maison du Guiers picnic area at the start; there is no water on the hill. The route is described for 1 May to 30 November.",
      "startPoint": {
        "lat": 45.43596,
        "lng": 5.75551,
        "label": "Place de la Corderie car park (Rivièr'Alp / Maison du Guiers), Les Échelles"
      },
      "shadeCoverage": 55,
      "heatRisk": "moderate",
      "exposure": false,
      "surfaceHazards": [],
      "curated": true,
      "tier": "route-audited",
      "reviewedAt": "2026-10-22",
      "reviewedBy": "ORMA route audit",
      "routeAudit": {
        "photo": "Commons, TomdeSavoie738, CC BY-SA 4.0, the Guiers from the bridge at Les Échelles by the start.",
        "route": "Published line is the official GPX (4.88 km); official page 4.9 km.",
        "routeNumbers": "No number: GR9 (white-red) from the Croix des Carriers past the Chapelle de la Madeleine, then the yellow-waymarked path back, as the official text describes.",
        "mapPoints": "Start at the Place de la Corderie car park named by the official page; tap at the Maison du Guiers traced to OSM.",
        "elevation": "Official 173 m of climb (the topo PDF gives 145 m)."
      },
      "graduation": {
        "status": "verified",
        "required": [
          "photo",
          "route",
          "routeNumbers",
          "mapPoints",
          "elevation",
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "completed": [
          "photo",
          "route",
          "routeNumbers",
          "mapPoints",
          "elevation",
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "blockers": {}
      },
      "verified": {
        "categories": [
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "sources": [
          "Chartreuse Tourisme, Sur les pas de Béatrice de Savoie (Apidae) and official topo (17 June 2024)",
          "Parc naturel régional de Chartreuse: no dog restriction on the line; no reserve, biotope order or Natura 2000 site (EEA, INPN)",
          "OpenStreetMap relation 3982382, road classes and water along the line"
        ],
        "date": "2026-10-22"
      },
      "sourceLinks": [
        {
          "label": "Chartreuse Tourisme, Sur les pas de Béatrice de Savoie",
          "url": "https://www.chartreuse-tourisme.com/offres/sur-les-pas-de-beatrice-de-savoie-les-echelles-fr-2777404/"
        },
        {
          "label": "Official topo (PDF)",
          "url": "https://static.apidae-tourisme.com/filestore/objets-touristiques/documents/18/151/23369490/topos-randos-beatrice-de-savoie-les-echelles-17juin24.pdf"
        },
        {
          "label": "OpenStreetMap relation 3982382",
          "url": "https://www.openstreetmap.org/relation/3982382"
        }
      ]
    },
    'osm-16322228': {
      // Hand audit 22 October 2026: route and figures from the Grand Chambéry route sheet (Apidae PDF), dog rule
      // from the Challes-les-Eaux commune page. No reserve, biotope order or Natura 2000 site on the line (EEA, INPN).
      "area": "Challes-les-Eaux / La Ravoire",
      "distance": 3.5,
      "elevation": 16,
      "terrainType": "Paved and gravel paths, flat",
      "startPoint": {
        "lat": 45.55609,
        "lng": 5.97849,
        "label": "Parking du plan d'eau, avenue de Chambéry, Challes-les-Eaux; bus 2 and 3 stop Plan d'Eau"
      },
      "desc": "An easy hour around the Chassettes, a 22 hectare former peat bog between Challes-les-Eaux and La Ravoire at the foot of the Bauges. Woods and marsh alternate along the way, with information panels on the birdlife, and the Challes leisure lake sits right by the start. The official route sheet gives 3.5 km and 16 m of climb.\n\nDogs must be on a lead: Challes-les-Eaux requires it on public roads and in the commune's parks. About 40% of the loop is shaded. The loop crosses the D1006 once, where traffic runs at 70 km/h, and shares about 900 m with a cycle path: keep your dog close there.",
      "tips": "Start at the plan d'eau car park on avenue de Chambéry, opposite the Plan d'Eau bus stop. Two fenced dog parks sit by the leisure lake at the start, one for training and one for free running. There is no water on the loop, so bring some on warm days. Flat and short, a good pick for older dogs, puppies or a quick evening lap.",
      "shadeCoverage": 40,
      "heatRisk": "moderate",
      "exposure": false,
      "surfaceHazards": [],
      "routeNumberSource": {
        "provider": "Grand Chambéry Alpes Tourisme (Apidae)",
        "name": "La boucle du marais des Chassettes",
        "url": "https://static.apidae-tourisme.com/filestore/objets-touristiques/documents/160/129/13533600/13-La-boucle-du-marais-des-chassettes.pdf"
      },
      "curated": true,
      "tier": "route-audited",
      "reviewedAt": "2026-10-22",
      "reviewedBy": "ORMA route audit",
      "routeAudit": {
        "photo": "Commons, Anthony Levrot, CC BY-SA 4.0, the marsh woods about 3 m from the line.",
        "route": "Published line 3.35 km; official sheet 3.509 km, loop.",
        "routeNumbers": "No number: the official sheet describes the loop by landmark from the plan d'eau car park, with no switch to another route.",
        "mapPoints": "Start at the plan d'eau car park named by the official sheet; no water on the line.",
        "elevation": "Official 16 m of climb."
      },
      "graduation": {
        "status": "verified",
        "required": [
          "photo",
          "route",
          "routeNumbers",
          "mapPoints",
          "elevation",
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "completed": [
          "photo",
          "route",
          "routeNumbers",
          "mapPoints",
          "elevation",
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "blockers": {}
      },
      "verified": {
        "categories": [
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "sources": [
          "Grand Chambéry Alpes Tourisme, La boucle du marais des Chassettes, route sheet (Apidae PDF)",
          "Commune de Challes-les-Eaux: dogs on a lead on public roads and in the commune's parks",
          "No reserve, biotope order or Natura 2000 site on the line (EEA, INPN); ZNIEFF only, an inventory without rules",
          "OpenStreetMap relation 16322228: road classes, land cover and water along the line"
        ],
        "date": "2026-10-22"
      },
      "sourceLinks": [
        {
          "label": "Official route sheet (PDF)",
          "url": "https://static.apidae-tourisme.com/filestore/objets-touristiques/documents/160/129/13533600/13-La-boucle-du-marais-des-chassettes.pdf"
        },
        {
          "label": "Challes-les-Eaux, dogs in the commune",
          "url": "https://www.ville-challesleseaux.fr/decouvrir-et-bouger-au-quotidien/cadre-de-vie-mobilite-et-environnement/parc-canin"
        },
        {
          "label": "OpenStreetMap relation 16322228",
          "url": "https://www.openstreetmap.org/relation/16322228"
        }
      ]
    },
    'osm-14864704': {
      // Hand audit 22 October 2026: route and figures from the Office de Tourisme du Lac d'Annecy (Apidae 5632895), dog rule
      // and season from the Haute-Savoie departmental fiche (Apidae 151941); both official GPX tracks lie within 50 m of the line.
      // The stored line runs the opposite way to the official sheets, and the text says so. No Natura 2000, reserve or biotope order.
      "area": "Duingt",
      "distance": 6.7,
      "elevation": 382,
      "startPoint": {
        "lat": 45.8271246,
        "lng": 6.2025044,
        "label": "Parking de l'église, Duingt (paid in July and August); free car park on route des Prés Bernard"
      },
      "desc": "The rocky spine that juts into Lake Annecy, walked as a loop from Duingt's old village on the quiet west shore. As drawn here it heads out first: along the Route des Viviers and a short stretch of the D8 to the hamlet of Les Maisons, then up past the edge of the old quarry to the crest of the Taillefer and its viewpoints, with the lake on both sides, before dropping back to the village by the Chemin de la Grotte. The official sheets describe the same loop the other way round; either direction works. Officially 6.8 km and 382 m of climb.\n\nDogs are accepted on a lead only, according to the Haute-Savoie departmental route fiche. The loop lies inside the Bauges regional park, with no extra dog rule there. About 1.4 km is on tarmac, including some 230 m of the D8: keep your dog close there. The crest is wooded, so about 60% of the walk is in shade.",
      "tips": "Keep the lead on: that is the official condition for dogs. The viewpoints on the crest stand at the rim of the old quarry, with a sheer drop a few metres from the path, so keep your dog close there. Livestock may graze in the meadows on the first half; no pasture or guardian-dog notice is posted. Taps at the start and at km 2.4 are the only water. Avoid the loop after heavy rain and wear proper shoes: the crest has a few rocky passages. The departmental fiche gives the season as 15 January to 1 November.",
      "shadeCoverage": 60,
      "heatRisk": "moderate",
      "exposure": false,
      "surfaceHazards": [
        "A few rocky, uneven passages along the Taillefer crest",
        "About 1.4 km on tarmac, including some 230 m of the D8 road"
      ],
      "routeNumberSource": {
        "provider": "Office de Tourisme du Lac d'Annecy (Apidae)",
        "name": "La boucle du Taillefer",
        "url": "https://www.lac-annecy.com/itineraire-de-randonnee-pedestre/la-boucle-du-taillefer-duingt/"
      },
      "curated": true,
      "tier": "route-audited",
      "reviewedAt": "2026-10-22",
      "reviewedBy": "ORMA route audit",
      "routeAudit": {
        "photo": "Commons, Guilhem Vellut, CC BY 2.0, Lac d'Annecy from the Taillefer, about 5 m from the line.",
        "route": "Published line 6.69 km; official 6.8 km (tourist office) and 7.0 km (department); both official GPX tracks within 50 m. Line stored in the reverse direction, stated in the text.",
        "routeNumbers": "No number: waymarked with yellow arrows and signposts; switches are the short loop to Mont Gerbet at the plateau and the optional detour to Dhéré, as the commune page describes.",
        "mapPoints": "Start at the church car park named by the official fiche (17 m from its point); taps traced to OSM.",
        "elevation": "Official 382 m of climb."
      },
      "graduation": {
        "status": "verified",
        "required": [
          "photo",
          "route",
          "routeNumbers",
          "mapPoints",
          "elevation",
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "completed": [
          "photo",
          "route",
          "routeNumbers",
          "mapPoints",
          "elevation",
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "blockers": {}
      },
      "verified": {
        "categories": [
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "sources": [
          "Office de Tourisme du Lac d'Annecy, La boucle du Taillefer (Apidae 5632895, updated 27 May 2024)",
          "Haute-Savoie departmental fiche, La boucle pédestre du Taillefer (Apidae 151941): dogs on a lead only, season 15 January to 1 November",
          "Parc naturel régional du Massif des Bauges: no dog restriction on the line; no reserve, biotope order or Natura 2000 site (EEA, INPN)",
          "OpenStreetMap relation 14864704: road classes, land cover, cliffs and water along the line"
        ],
        "date": "2026-10-22"
      },
      "sourceLinks": [
        {
          "label": "Office de Tourisme du Lac d'Annecy, La boucle du Taillefer",
          "url": "https://www.lac-annecy.com/itineraire-de-randonnee-pedestre/la-boucle-du-taillefer-duingt/"
        },
        {
          "label": "Haute-Savoie Mont Blanc, La boucle pédestre du Taillefer",
          "url": "https://hautesavoiemontblanc-tourisme.com/offres/la-boucle-pedestre-du-taillefer-duingt-fr-5867298/"
        },
        {
          "label": "OpenStreetMap relation 14864704",
          "url": "https://www.openstreetmap.org/relation/14864704"
        }
      ]
    },
    'osm-15591346': {
      // Hand audit 22 October 2026: route, figures and dog note from Office de Tourisme Cœur de Savoie (Apidae 114550); the official
      // GPX lies within 40 m of the line, which is stored the other way round (stated in the text). Communes: Montmélian and
      // Arbin publish no dog order; Cruet bans straying only. Natura 2000 FR8201775/FR8212013 and the CEN site La Générale carry no dog rule.
      "area": "Montmélian / Arbin / Cruet",
      "distance": 9.7,
      "elevation": 780,
      "decisionPoints": [
        {
          "km": 5.2,
          "lat": 45.51896,
          "lng": 6.05815,
          "instruction": "Roc de Manettaz belvedere and orientation table: wide view over the Combe de Savoie and Belledonne, with an unprotected edge, so keep your dog close here"
        }
      ],
      "desc": "A proper half-day loop above Montmélian through the sunny side of the Combe de Savoie: the Arbin vineyards, pine and boxwood woods, the ridge with the Roc de Manettaz belvedere, and the protected dry meadow of La Générale. As drawn here it climbs first above Arbin and Cruet to the Col du Mont picnic table, follows the ridge to the belvedere, and comes down through La Générale. The official sheet describes the same loop the other way round. Officially 9.5 km and 780 m of climb, about 4h30, rated difficult. Waymarked in yellow.\n\nDogs are accepted, according to the official route page. Montmélian and Arbin publish no dog order, and Cruet bans only letting dogs stray, so the national rule applies: a lead in woods and fields off the paths from 15 April to 30 June. About 60% of the loop is wooded, and part of it lies in a Natura 2000 site with no dog rule.",
      "tips": "The belvedere at the Roc de Manettaz has an unprotected edge, signed as a danger: keep your dog close there. A lead is wise in the protected meadow of La Générale. The official sheet mentions alpine pasture, so cattle may graze on the ridge meadows in summer; no guardian-dog notice is posted. There is no water on the loop: carry enough for over four hours, and start early, because the south-facing vineyard slopes bake in summer. The first 500 m follow the chemin de Beauvoir, which has a pavement; cross the road after 100 m. At the Col du Mont a path branches off to the Lac de la Thuile (1.5 km).",
      "shadeCoverage": 60,
      "heatRisk": "moderate",
      "exposure": true,
      "surfaceHazards": [
        "Unprotected drop at the Roc de Manettaz belvedere (signed danger)",
        "Sustained climbing on mountain paths (T2)",
        "About 500 m along the chemin de Beauvoir at the start, with a pavement"
      ],
      "routeNumberSource": {
        "provider": "Office de Tourisme Cœur de Savoie (Apidae)",
        "name": "Le sentier des Buis",
        "url": "https://tourisme.coeurdesavoie.fr/fiches/le-sentier-des-buis-114550/"
      },
      "curated": true,
      "tier": "route-audited",
      "reviewedAt": "2026-10-22",
      "reviewedBy": "ORMA route audit",
      "routeAudit": {
        "photo": "Commons, Florian Pépellin, CC BY-SA 4.0, the vineyard below La Savoyarde, about 6 m from the line.",
        "route": "Published line 9.67 km; official 9.5 km; official GPX (9.39 km) within 40 m of the line throughout. Line stored in the reverse direction, stated in the text.",
        "routeNumbers": "No number: yellow waymarks (Cœur de Savoie); one switch, the branch to the Lac de la Thuile at the Col du Mont, as the official text describes.",
        "mapPoints": "Start at the cemetery car park on the chemin de Beauvoir named by the official text (11 m from the GPX start); belvedere moved to the Roc de Manettaz.",
        "elevation": "Official 780 m of climb."
      },
      "graduation": {
        "status": "verified",
        "required": [
          "photo",
          "route",
          "routeNumbers",
          "mapPoints",
          "elevation",
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "completed": [
          "photo",
          "route",
          "routeNumbers",
          "mapPoints",
          "elevation",
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "blockers": {}
      },
      "verified": {
        "categories": [
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "sources": [
          "Office de Tourisme Cœur de Savoie, Le sentier des Buis (Apidae 114550) and official GPX: dogs accepted",
          "Commune de Cruet, Savoir vivre: straying banned (arrêté préfectoral du 4 septembre 2001); Montmélian and Arbin publish no dog order",
          "Arrêté du 16 mars 1955 on dogs straying (national baseline)",
          "Natura 2000 FR8201775 and FR8212013 and the CEN site La Générale on the line, without dog rules; no reserve, national park or biotope order (EEA, INPN)",
          "OpenStreetMap relation 15591346: road classes, land cover, cliffs and water along the line"
        ],
        "date": "2026-10-22"
      },
      "sourceLinks": [
        {
          "label": "Office de Tourisme Cœur de Savoie, Le sentier des Buis",
          "url": "https://tourisme.coeurdesavoie.fr/fiches/le-sentier-des-buis-114550/"
        },
        {
          "label": "Official GPX",
          "url": "https://static.apidae-tourisme.com/filestore/objets-touristiques/plans/94/168/20031582/SentierdesBuis.gpx"
        },
        {
          "label": "Commune de Cruet, Savoir vivre",
          "url": "https://www.cruet.fr/?page_id=45"
        },
        {
          "label": "Arrêté du 16 mars 1955 (national baseline)",
          "url": "https://aida.ineris.fr/reglementation/arrete-160355-divagation-chiens"
        },
        {
          "label": "OpenStreetMap relation 15591346",
          "url": "https://www.openstreetmap.org/relation/15591346"
        }
      ]
    },
    'osm-14378946': {
      // Hand audit 22 October 2026: route, figures and dog rule from the Office de Tourisme des Karellis (Cirkwi, route N°05,
      // updated 22 May 2026). Commune Montricher-Albanne (Les Karellis); no Natura 2000 site or reserve on the line (EEA, Géoportail).
      // An ONF 'parc communal protégé' sign stands on the line; the office's lead rule covers the whole route through it.
      "area": "Les Karellis, Montricher-Albanne",
      "distance": 5.3,
      "elevation": 181,
      "hours": "3",
      "startPoint": {
        "lat": 45.227544,
        "lng": 6.404557,
        "label": "Les Karellis resort, by the Vinouve chairlift (official start)"
      },
      "desc": "An easy loop from the Les Karellis resort above the Maurienne, waymarked as route 05 (green round marker). It follows the Blanchon discovery trail to the small Lac de Pramol, past a peat bog and a gypsum sinkhole, with views to the Croix des Têtes. Officially 5.5 km and 181 m of climb, about 3 hours at an easy pace, and rated easy.\n\nDogs must be kept on a lead, according to the Karellis tourist office. Most of the loop runs through woods, at 1,600 to 1,770 m. Cattle graze the meadows right beside the path in summer, and about 400 m is on tarmac, including the lake road, which is open to cars.",
      "tips": "Keep the lead on: that is the official rule here, and cattle graze beside the path in summer. Keep your dog out of the peat bog, which is signed as a danger, and on the path through the protected communal woodland. Taps and fountains are mapped at the start and along the first 2 km. The lake road is open to cars in summer, so keep your dog close there.",
      "shadeCoverage": 75,
      "heatRisk": "low",
      "exposure": false,
      "surfaceHazards": [
        "Peat bog beside the path (signed danger)",
        "About 400 m on tarmac, including the lake road open to cars"
      ],
      "routeNumberSource": {
        "provider": "Office de Tourisme Les Karellis (Cirkwi)",
        "name": "N°05 - Lac de Pramol",
        "url": "https://www.cirkwi.com/fr/circuit/137780-itineraire-de-randonnee-05-lac-de-pramol"
      },
      "curated": true,
      "tier": "route-audited",
      "reviewedAt": "2026-10-22",
      "reviewedBy": "ORMA route audit",
      "routeAudit": {
        "photo": "Commons, Patrick OTER, CC0, Lac de Pramol, 17 m from the line.",
        "route": "Published line 5.32 km, closed; official 5.5 km.",
        "routeNumbers": "Route 05, green round marker, operated by the Karellis resort; the official page names the Blanchon discovery trail as the way out and no other switch.",
        "mapPoints": "Start at the official Les Karellis point (40 m from the old one); taps traced to OSM.",
        "elevation": "Official 181 m of climb."
      },
      "graduation": {
        "status": "verified",
        "required": [
          "photo",
          "route",
          "routeNumbers",
          "mapPoints",
          "elevation",
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "completed": [
          "photo",
          "route",
          "routeNumbers",
          "mapPoints",
          "elevation",
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "blockers": {}
      },
      "verified": {
        "categories": [
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "sources": [
          "Office de Tourisme Les Karellis, N°05 - Lac de Pramol (Cirkwi, updated 22 May 2026): dogs on a lead",
          "No Natura 2000 site, reserve or regional park on the line (EEA, Géoportail); Vanoise core zone about 40 km away",
          "OpenStreetMap relation 14378946: waymark 05, grazing land, road classes, land cover and water along the line"
        ],
        "date": "2026-10-22"
      },
      "sourceLinks": [
        {
          "label": "Office de Tourisme Les Karellis, N°05 - Lac de Pramol",
          "url": "https://www.cirkwi.com/fr/circuit/137780-itineraire-de-randonnee-05-lac-de-pramol"
        },
        {
          "label": "OpenStreetMap relation 14378946",
          "url": "https://www.openstreetmap.org/relation/14378946"
        }
      ]
    },
    'osm-19541366': {
      // Hand audit 22 October 2026: route, figures, season and dog rule from Office de Tourisme Val Thorens; the official GPX
      // lies within 45 m of the line for 95% of its points. Commune Les Belleville, Vanoise national park adhesion area (outside
      // the core, 753 m away, where dogs are banned). Les Belleville publishes no lead order.
      "area": "Val Thorens, Les Belleville",
      "distance": 6.4,
      "elevation": 510,
      "hours": "2.5",
      "startPoint": {
        "lat": 45.29711,
        "lng": 6.58594,
        "label": "Rue de Gébroulaz, Val Thorens (official start; free street parking in summer)"
      },
      "desc": "A high loop from Val Thorens to the Lac Blanc, below the Péclet glacier, waymarked as route 18 (red). It climbs from the resort on stony tracks and paths to a top of about 2,750 m and returns to the rue du Slalom. Officially 6.0 km and 510 m of climb, about 2h30, rated difficult for the altitude and the climb. Open from 1 June to 30 September, snow permitting.\n\nDogs must be kept on a lead, according to the Val Thorens tourist office. The loop lies in the outer area of the Vanoise national park; dogs are banned only in the park's core, which this route does not enter. There is no shade and no water on the way, and no grazing land is mapped beside the path.",
      "tips": "Keep the lead on: that is the official rule here. Stay on this route: the Vanoise national park core, where dogs are banned, lies less than a kilometre away. Carry water for both of you, since there is no tap or spring on the loop, and go early on hot days, as there is no shade above 2,300 m. The tracks are shared with the summer ski area, so watch for service vehicles. Snow can linger near the lake into early summer.",
      "shadeCoverage": 0,
      "heatRisk": "moderate",
      "exposure": false,
      "surfaceHazards": [
        "Stony ground at up to 2,750 m",
        "Tracks shared with ski-area service vehicles"
      ],
      "routeNumberSource": {
        "provider": "Office de Tourisme Val Thorens (Apidae)",
        "name": "Randonnée pédestre - Le Lac Blanc",
        "url": "https://www.valthorens.com/randonnee/randonnee-pedestre-le-lac-blanc/"
      },
      "curated": true,
      "tier": "route-audited",
      "reviewedAt": "2026-10-22",
      "reviewedBy": "ORMA route audit",
      "routeAudit": {
        "photo": "Commons, Rémih, CC BY-SA 4.0, the Lac Blanc that the loop reaches.",
        "route": "Published line 6.37 km, closed; official 6.0 km; official GPX within 45 m for 95% of its points, 105 m at most.",
        "routeNumbers": "Route 18, red waymark; the official page names start rue de Gébroulaz and finish rue du Slalom, no switch.",
        "mapPoints": "Start at the first point of the official GPX, on the rue de Gébroulaz.",
        "elevation": "Official 510 m of climb; top 2,749 m."
      },
      "graduation": {
        "status": "verified",
        "required": [
          "photo",
          "route",
          "routeNumbers",
          "mapPoints",
          "elevation",
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "completed": [
          "photo",
          "route",
          "routeNumbers",
          "mapPoints",
          "elevation",
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "blockers": {}
      },
      "verified": {
        "categories": [
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "sources": [
          "Office de Tourisme Val Thorens, Randonnée pédestre - Le Lac Blanc, and official GPX: dogs on a lead, open 1 June to 30 September",
          "Parc national de la Vanoise: the line lies in the adhesion area, outside the core where dogs are banned (Géoportail; FFRandonnée, 24 March 2026)",
          "Commune des Belleville, published acts: no lead or straying order; no Natura 2000 site, reserve or biotope order on the line (EEA, Géoportail)",
          "OpenStreetMap relation 19541366: waymark 18, road classes, land cover and water along the line"
        ],
        "date": "2026-10-22"
      },
      "sourceLinks": [
        {
          "label": "Office de Tourisme Val Thorens, Le Lac Blanc",
          "url": "https://www.valthorens.com/randonnee/randonnee-pedestre-le-lac-blanc/"
        },
        {
          "label": "Official GPX",
          "url": "https://static.apidae-tourisme.com/filestore/objets-touristiques/plans/237/59/32259053/Randonnee+pedestre+du+Lac+Blanc+-+Val+Thorens.gpx"
        },
        {
          "label": "FFRandonnée, walking with a dog in the Vanoise",
          "url": "https://www.ffrandonnee.fr/s-informer/actualites/randonner-avec-son-chien-dans-le-parc-de-la-vanoise"
        },
        {
          "label": "OpenStreetMap relation 19541366",
          "url": "https://www.openstreetmap.org/relation/19541366"
        }
      ]
    },
    'osm-12118490': {
      // Hand audit 22 October 2026: route, step-by-step topo, figures and dog rule from the Office de Tourisme Intercommunal
      // Cœur de Maurienne (Apidae 'Sentier botanique des Plagnes', updated 31 Dec 2025). The line is stored the other way round to
      // the topo (stated in the text). No Natura 2000, park, reserve or biotope order on the line (EEA, Géoportail).
      "area": "Le Châtel, La Tour-en-Maurienne",
      "distance": 4.7,
      "elevation": 320,
      "hours": "2",
      "startPoint": {
        "lat": 45.30711,
        "lng": 6.358698,
        "label": "Car park in front of the mairie, Le Châtel (official start)"
      },
      "terrainType": "Forest paths and tracks, about 500 m on village lanes",
      "waterSources": [
        {
          "km": 0,
          "lat": 45.3077851,
          "lng": 6.3573001,
          "osmId": "node/2432060443",
          "label": "Village fountain by the start (not marked as drinking water)"
        }
      ],
      "desc": "The botanical trail above Le Châtel in the Maurienne, waymarked B05 in yellow, through woods with open views over the valley and towards Montvernier. As drawn here it leaves the mairie along the D77 through the hamlet of Ventour, climbs about 1.7 km on B05 to the Plan de la Croix signpost, follows the balcony path past Beauchamp, where a short detour leads to the ruins, and comes back down by the Rieu Salomon lane. The official topo walks the same loop the other way round. Officially 4.75 km and 320 m of climb, about 2 hours, rated moderate.\n\nDogs are accepted on a lead only, according to the official route page. About two thirds of the loop is wooded. Roughly 500 m follows village lanes and the D77, part of it at 30 km/h: keep your dog close there.",
      "tips": "Keep the lead on: that is the official rule here. The meadows beside the path may be grazed in summer, and the commune has a large pastoral area above the village; no guardian-dog notice is posted. The fountain by the start is not marked as drinking water, so bring your own. Several small streams cross the path. At the S04 junction stay on B05, and in Ventour stay on the D77 where the L02 path joins.",
      "shadeCoverage": 65,
      "heatRisk": "moderate",
      "exposure": false,
      "surfaceHazards": [
        "About 500 m on village lanes and the D77",
        "Small stream crossings without bridges"
      ],
      "routeNumberSource": {
        "provider": "Office de Tourisme Intercommunal Cœur de Maurienne (Apidae)",
        "name": "Sentier botanique des Plagnes",
        "url": "https://www.explore-savoie.com/randonnees-et-balades/sentier-botanique-des-plagnes-7628788/"
      },
      "curated": true,
      "tier": "route-audited",
      "reviewedAt": "2026-10-22",
      "reviewedBy": "ORMA route audit",
      "routeAudit": {
        "photo": "Commons, Florian Pépellin, CC BY-SA 3.0, panorama of Montvernier taken from Le Châtel, 27 m from the line.",
        "route": "Published line 4.7 km, member ways 4.75 km; official 4.75 km. Line stored in the reverse direction to the topo, stated in the text.",
        "routeNumbers": "B05, yellow waymark (3CMA); switches from the topo: the Beauchamp ruins detour, the S04 junction (stay on B05) and the L02 junction in Ventour (stay on the D77).",
        "mapPoints": "Start at the official coordinate in front of the mairie; fountain relabelled as not marked drinkable.",
        "elevation": "Official 320 m of climb."
      },
      "graduation": {
        "status": "verified",
        "required": [
          "photo",
          "route",
          "routeNumbers",
          "mapPoints",
          "elevation",
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "completed": [
          "photo",
          "route",
          "routeNumbers",
          "mapPoints",
          "elevation",
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "blockers": {}
      },
      "verified": {
        "categories": [
          "water",
          "heat",
          "exposure",
          "livestock",
          "surfaceHazards",
          "access"
        ],
        "sources": [
          "Office de Tourisme Intercommunal Cœur de Maurienne, Sentier botanique des Plagnes (Apidae, updated 31 December 2025): topo, figures, dogs on a lead only",
          "No Natura 2000 site, national or regional park, reserve or biotope order on the line (EEA, Géoportail); La Tour-en-Maurienne publishes no dog order",
          "OpenStreetMap relation 12118490: waymark B05, road classes, land cover and water along the line"
        ],
        "date": "2026-10-22"
      },
      "sourceLinks": [
        {
          "label": "Savoie Mont Blanc, Sentier botanique des Plagnes",
          "url": "https://www.explore-savoie.com/randonnees-et-balades/sentier-botanique-des-plagnes-7628788/"
        },
        {
          "label": "OpenStreetMap relation 12118490",
          "url": "https://www.openstreetmap.org/relation/12118490"
        }
      ]
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
