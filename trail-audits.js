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
    'osm-14379010': {
      // Hand audit 22 October 2026: route, figures and dog answer from the Office de Tourisme Les Karellis (Cirkwi, route N°08,
      // updated 22 May 2026); the official trace lies within 38 m of the line. Commune Montricher-Albanne publishes no dog order;
      // no Natura 2000 site, reserve or regional park on the line (EEA, Géoportail).
      "area": "Les Karellis, Montricher-Albanne",
      "distance": 8.1,
      "elevation": 203,
      "hours": "3",
      "startPoint": {
        "lat": 45.227544,
        "lng": 6.404557,
        "label": "Les Karellis resort, by the Vinouve chairlift (official start)"
      },
      "desc": "An easy, open loop from the Les Karellis resort towards the Col d'Albanne, waymarked as route 08 (green round marker), with the Croix de Pralognan, an orientation table and plenty of butterflies along the way. The signposts on the loop name Pignerol, Les Combes, Les Martères, Le Suiffet, Le Pin, Les Fraches, Pralognan and La Roche. Officially 8.4 km and 203 m of climb, about 3 hours, rated easy.\n\nDogs are accepted, according to the Karellis tourist office. Montricher-Albanne publishes no dog order, so the national rule applies: a lead in woods and fields off the paths from 15 April to 30 June. The loop runs through open meadow at 1,560 to 1,720 m, with almost no shade. About 1.2 km follows roads, including some 650 m of the resort's access road: keep your dog close there.",
      "tips": "The meadows beside the path may be grazed in summer, so keep your dog close near any animals. There is no shade on the loop: go early on hot days and bring water, though taps are mapped at the start and near the resort. Chairlifts and ski pistes cross the area but stand still in summer. A lead is sensible on the resort road stretches.",
      "shadeCoverage": 5,
      "heatRisk": "moderate",
      "exposure": false,
      "surfaceHazards": [
        "About 1.2 km on roads, including some 650 m of the resort access road"
      ],
      "routeNumberSource": {
        "provider": "Office de Tourisme Les Karellis (Cirkwi)",
        "name": "N°08 - Croix de Pralognan",
        "url": "https://www.cirkwi.com/fr/circuit/252706-itineraire-de-randonnee-08-croix-de-pralognan"
      },
      "curated": true,
      "tier": "route-audited",
      "reviewedAt": "2026-10-22",
      "reviewedBy": "ORMA route audit",
      "routeAudit": {
        "photo": "Panoramax (IGN), Licence Ouverte 2.0, a lane on the loop, 6.5 m from the line.",
        "route": "Published line 8.06 km; official 8.4 km; every point of the official trace within 38 m of the line.",
        "routeNumbers": "Route 08, green round marker (Station des Karellis); guideposts named along the loop; the official page names no switch.",
        "mapPoints": "Start at the official Les Karellis point; taps traced to OSM.",
        "elevation": "Official 203 m of climb."
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
          "Office de Tourisme Les Karellis, N°08 - Croix de Pralognan (Cirkwi, updated 22 May 2026): animals accepted",
          "Montricher-Albanne publishes no dog order; arrêté du 16 mars 1955 (national baseline)",
          "No Natura 2000 site, reserve or regional park on the line (EEA, Géoportail)",
          "OpenStreetMap relation 14379010: waymark 08, guideposts, road classes, land cover and water along the line"
        ],
        "date": "2026-10-22"
      },
      "sourceLinks": [
        {
          "label": "Office de Tourisme Les Karellis, N°08 - Croix de Pralognan",
          "url": "https://www.cirkwi.com/fr/circuit/252706-itineraire-de-randonnee-08-croix-de-pralognan"
        },
        {
          "label": "Arrêté du 16 mars 1955 (national baseline)",
          "url": "https://aida.ineris.fr/reglementation/arrete-160355-divagation-chiens"
        },
        {
          "label": "OpenStreetMap relation 14379010",
          "url": "https://www.openstreetmap.org/relation/14379010"
        }
      ]
    },
    'osm-6250300': {
      // Hand audit 22 October 2026: route, figures and dog rule from the Apidae route page (Combloux / Passy tourist offices).
      // The lake circuit matches the official GPX within about 20 m; the official route adds a 400 m approach on the paved road from
      // the Plaine-Joux car park, stated in the text. No Natura 2000 site or national reserve on the line (EEA, Géoportail).
      "area": "Passy, Plaine-Joux",
      "distance": 3.6,
      "elevation": 100,
      "hours": "1",
      "startPoint": {
        "lat": 45.94953,
        "lng": 6.74153,
        "label": "Lakeside path below the Lac Vert car park; the official start is the Plaine-Joux car park, 321 chemin des Parchets, 400 m up the road"
      },
      "desc": "An easy loop at about 1,300 m around Passy's emerald Lac Vert, a protected natural site where Mont Blanc reflects in water so clear you can see sunken trunks. The path circles the lake on its balcony and passes the lakeside restaurant, in a conifer forest below the Fiz cliffs. The official route starts at the Plaine-Joux car park and walks 400 m down the paved road to the lake; officially 3.1 km and 100 m of climb, about an hour, suitable for beginners.\n\nDogs must be kept on a lead, and they are not allowed in the lake, according to the official route page. Sled dogs live here in summer and winter. Most of the walk is shaded by conifers.",
      "tips": "Keep the lead on: it is the official rule, and sled dogs are kept nearby all year. Dogs may not go into the lake, and swimming is banned for people too, so use the taps by the lake (mapped) for water. The approach from the Plaine-Joux car park follows a paved road, and the loop crosses it once: keep your dog close there. The lake is busy in summer, so come early for a quiet lap.",
      "shadeCoverage": 60,
      "heatRisk": "low",
      "exposure": false,
      "surfaceHazards": [
        "The paved access road from the Plaine-Joux car park, crossed once on the loop"
      ],
      "routeNumberSource": {
        "provider": "Office de Tourisme de Combloux / Passy (Apidae)",
        "name": "Boucle du Lac Vert",
        "url": "https://www.combloux.com/itineraires/boucle-du-lac-vert/"
      },
      "curated": true,
      "tier": "route-audited",
      "reviewedAt": "2026-10-22",
      "reviewedBy": "ORMA route audit",
      "routeAudit": {
        "photo": "Commons, Mangatome, CC BY-SA 3.0, the Lac Vert itself, which the loop circles.",
        "route": "Published line 3.61 km; official 3.1 km. The lake circuit matches the official GPX within about 20 m; the line leaves out the 400 m road approach from Plaine-Joux and takes a slightly different link path. Stated in the text.",
        "routeNumbers": "No number; the official topo describes the loop by landmark (Cabanes du Mont-Blanc, balcony path, lakeside restaurant) with no switch to another route.",
        "mapPoints": "Start on the lakeside path; the official Plaine-Joux car park named in the text; taps traced to OSM.",
        "elevation": "Official 100 m of climb."
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
          "Office de Tourisme de Combloux, Boucle du Lac Vert (Apidae route page and official GPX): dogs on a lead, banned from the lake",
          "No Natura 2000 site, national reserve or regional park on the line (EEA, Géoportail)",
          "OpenStreetMap relation 6250300: paths, road classes, land cover and water along the line"
        ],
        "date": "2026-10-22"
      },
      "sourceLinks": [
        {
          "label": "Boucle du Lac Vert, official route page",
          "url": "https://www.combloux.com/itineraires/boucle-du-lac-vert/"
        },
        {
          "label": "Official GPX",
          "url": "https://static.apidae-tourisme.com/filestore/objets-touristiques/plans/128/177/16822656/Boucle+du+lac+Vert.gpx"
        },
        {
          "label": "OpenStreetMap relation 6250300",
          "url": "https://www.openstreetmap.org/relation/6250300"
        }
      ]
    },
    'osm-14381584': {
      // Hand audit 22 October 2026: route, start and figures from the Station des Karellis page and its GPX (every point within
      // 39 m of the line). The page states no dog rule; Montricher-Albanne publishes no dog order, so the national 1955 rule applies.
      // No Natura 2000 site, reserve or park on the line (EEA, Géoportail); Vanoise is about 40 km away.
      "area": "Les Karellis, Montricher-Albanne",
      "distance": 6.8,
      "elevation": 266,
      "startPoint": {
        "lat": 45.22798,
        "lng": 6.405,
        "label": "Les Karellis tourist office (official start)"
      },
      "desc": "A forest loop around the Les Karellis resort, waymarked as route 11 (green round marker). It sets off from the tourist office through larch and fir woods, rises to open viewpoints over the surrounding mountains and comes back to the start without retracing its steps. Officially 6.9 km and about 266 m of climb (216 m on the official GPX), an easy half-day.\n\nThe official page sets no dog rule, and Montricher-Albanne publishes no dog order, so the national rule applies: a lead in woods and fields off the paths from 15 April to 30 June. About 700 m follows resort lanes, mostly the Route du Lac, and the loop crosses the forest road: keep your dog close there.",
      "tips": "The meadows beside the path may be grazed in summer, so keep your dog close near any animals. Taps are mapped at the start in the resort; take water for the loop. Most of the way is shaded by larch and fir. Ski lifts and pistes cross the area but stand still in summer. A paper map of all the resort walks is sold at the tourist office.",
      "shadeCoverage": 60,
      "heatRisk": "low",
      "exposure": false,
      "surfaceHazards": [
        "About 700 m on resort lanes, mostly the Route du Lac",
        "One crossing of the forest road"
      ],
      "routeNumberSource": {
        "provider": "Station des Karellis",
        "name": "Randonnée Beaumollard (sentier n°11)",
        "url": "https://www.karellis.com/activites-ete/balades-et-randonnees/randonnee-beaumollard/"
      },
      "curated": true,
      "tier": "route-audited",
      "reviewedAt": "2026-10-22",
      "reviewedBy": "ORMA route audit",
      "routeAudit": {
        "photo": "Panoramax (IGN), Licence Ouverte 2.0, a lane through larch woods on the loop, 17 m from the line.",
        "route": "Published line 6.84 km; official 6.9 km; every official GPX point within 39 m of the line.",
        "routeNumbers": "Route 11, green round marker (Station des Karellis); the official page describes a full loop with no switch to another route.",
        "mapPoints": "Start at the Les Karellis tourist office named by the official page (5 m from the GPX start); taps traced to OSM.",
        "elevation": "Official ~266 m of climb in the page text, 216 m in its GPX summary."
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
          "Station des Karellis, Randonnée Beaumollard, sentier balisé n°11, and official GPX",
          "Montricher-Albanne publishes no dog order; arrêté du 16 mars 1955 (national baseline)",
          "No Natura 2000 site, reserve or park on the line (EEA, Géoportail)",
          "OpenStreetMap relation 14381584: waymark 11, road classes, land cover and water along the line"
        ],
        "date": "2026-10-22"
      },
      "sourceLinks": [
        {
          "label": "Station des Karellis, Randonnée Beaumollard",
          "url": "https://www.karellis.com/activites-ete/balades-et-randonnees/randonnee-beaumollard/"
        },
        {
          "label": "Official GPX",
          "url": "https://www.karellis.com/wp-content/uploads/11-Rando-Karellis-Beaumollard.gpx"
        },
        {
          "label": "Arrêté du 16 mars 1955 (national baseline)",
          "url": "https://aida.ineris.fr/reglementation/arrete-160355-divagation-chiens"
        },
        {
          "label": "OpenStreetMap relation 14381584",
          "url": "https://www.openstreetmap.org/relation/14381584"
        }
      ]
    },
    'osm-9937537': {
      // Hand audit 22 October 2026: route, figures and the exposed passage from the La Plagne tourist office route page;
      // the dog rule from the same office's Mont Jovet refuge circuit, which shares this ground. Outside the Vanoise national park
      // (core 10 km, adhesion area 6 km away) and any Natura 2000 site (Géoportail, EEA). Aime-la-Plagne publishes no dog order.
      "area": "Plagne Aime 2000, Aime-la-Plagne",
      "distance": 11,
      "elevation": 870,
      "hours": "6",
      "startPoint": {
        "lat": 45.510959,
        "lng": 6.664795,
        "label": "Plagne Aime 2000 (official start)"
      },
      "decisionPoints": [
        {
          "km": 6.8,
          "lat": 45.492767,
          "lng": 6.6462628,
          "instruction": "Pas des Brebis (2,440 m): the official page flags a steep, exposed passage here; keep your dog close on a short lead"
        }
      ],
      "desc": "A big alpine loop from Plagne Aime 2000 to the Mont Jovet (2,558 m), waymarked with an orange bar on white. It climbs past the Chalet des Envers and the Lac Bovet to the summit, with its panorama from Mont Blanc to the Vanoise glaciers, then follows the steep ridge to the Pas des Brebis and returns over the Martinet and the 4x4 track from the top of the Bécoin chairlift. Officially 12 km and 870 m of climb, about 6 hours, rated difficult.\n\nDogs must be kept on a lead because herds graze here, according to the La Plagne tourist office. The official page flags a steep, exposed passage at the Pas des Brebis. Almost the whole loop is open ground above 1,900 m, with no shade and no water.",
      "tips": "Keep the lead on: cattle and other herds graze these pastures in summer, and that is the reason the tourist office gives for the rule. Take the ridge to the Pas des Brebis slowly with your dog close beside you. Carry all the water you both need: there is no tap on the loop, and the Mont Jovet refuge, staffed in summer, is a 600 m detour. Start early on hot days. Dogs are welcome at the refuge by day on a lead, but not overnight.",
      "shadeCoverage": 3,
      "heatRisk": "high",
      "exposure": true,
      "surfaceHazards": [
        "Steep, exposed passage at the Pas des Brebis (official)",
        "Stony ground on the summit ridge",
        "Small stream crossings without bridges"
      ],
      "routeNumberSource": {
        "provider": "Office de Tourisme de la Grande Plagne",
        "name": "Randonnée vers le Mont Jovet",
        "url": "https://www.la-plagne.com/savourez-une-multitude-d-activites/la-plagne-l-ete/randonnee-pedestre-en-vanoise-et-en-tarentaise/itineraires-de-marche-et-randonnee/randonnee-vers-le-mont-jovet"
      },
      "curated": true,
      "tier": "route-audited",
      "reviewedAt": "2026-10-22",
      "reviewedBy": "ORMA route audit",
      "routeAudit": {
        "photo": "Commons, Jan Stępień, CC BY 3.0, panorama from the Mont Jovet summit, 13 m from the line.",
        "route": "Published line 11.04 km, closed; official 12 km; every landmark of the official text (Col du Lac, Lac Bovet, summit, Pas des Brebis, Martinet) lies within 50 m of the line.",
        "routeNumbers": "Orange bar on white (Office de Tourisme de la Plagne); the official text routes by landmark: left fork to the Col du Lac before Prajourdan, summit from the west, back by the Pas des Brebis, the Martinet and the Bécoin 4x4 track.",
        "mapPoints": "Start at the official Plagne Aime 2000 point (4 m from the line); Pas des Brebis guidepost from OSM.",
        "elevation": "Official 870 m of climb."
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
          "Office de Tourisme de la Grande Plagne, Randonnée vers le Mont Jovet: 12 km, 870 m, 6h00, Passage escarpé au niveau du Pas des Brebis",
          "Office de Tourisme de la Grande Plagne, Découverte de La Plagne avec nuit au refuge du Mont Jovet (Cirkwi): dogs on a lead because of herds",
          "Outside the Vanoise national park and any Natura 2000 site (Géoportail, EEA); Aime-la-Plagne publishes no dog order",
          "OpenStreetMap relation 9937537: waymark, guideposts, sac_scale, land cover and water along the line"
        ],
        "date": "2026-10-22"
      },
      "sourceLinks": [
        {
          "label": "La Plagne, Randonnée vers le Mont Jovet",
          "url": "https://www.la-plagne.com/savourez-une-multitude-d-activites/la-plagne-l-ete/randonnee-pedestre-en-vanoise-et-en-tarentaise/itineraires-de-marche-et-randonnee/randonnee-vers-le-mont-jovet"
        },
        {
          "label": "Mont Jovet refuge circuit (Cirkwi)",
          "url": "https://www.cirkwi.com/fr/circuit/381630-decouverte-de-la-plagne-avec-nuit-au-refuge-du-mont-jovet"
        },
        {
          "label": "OpenStreetMap relation 9937537",
          "url": "https://www.openstreetmap.org/relation/9937537"
        }
      ]
    },
    'osm-16180587': {
      // Hand audit 22 October 2026: route, start and dog answer from the Haute-Savoie Mont-Blanc fiche (Apidae 5668895) and its
      // GPX (91% of points within 60 m of the line); the lake's own rules from the Lac Vert route page. Outside the Passy nature
      // reserve (630 m away, dogs banned inside) and any Natura 2000 site (Géoportail, EEA). Passy publishes no dog order.
      "area": "Plateau d'Assy, Passy",
      "distance": 8.5,
      "elevation": 393,
      "hours": "2.5–3",
      "startPoint": {
        "lat": 45.93911,
        "lng": 6.710876,
        "label": "Place Tobé, Plateau d'Assy (official start)"
      },
      "terrainType": "Old lane, forest paths and the Nant Bordon suspension footbridge",
      "desc": "An out-and-back walk from the Plateau d'Assy to the Lac Vert, by the Promenade Marie Curie past the old Sancellemoz sanatorium and the old Lac Vert road, crossing the Nant Bordon on a 143 m suspension footbridge, with an optional lap of the lake. You come back the same way. The official fiche gives 10 km there and back (its GPX measures 7.5 km) and calls it easy.\n\nDogs are accepted, according to the official fiche. At the lake they must be on a lead and may not go into the water, by the lake's own rules. Passy publishes no dog order, so the national rule applies elsewhere: a lead in woods and fields off the paths from 15 April to 30 June. Most of the way, about 85%, runs through woods.",
      "tips": "The Nant Bordon footbridge has a metal grating floor and some sway; nervous dogs may need a slow first crossing. At the Lac Vert, keep the lead on and your dog out of the water, which is a protected site. Do not carry on uphill beyond the lake: the Passy nature reserve, where dogs are banned even on a lead, starts about 600 m away. A tap is mapped by the lake. About 500 m follows lanes open to cars near the start.",
      "shadeCoverage": 80,
      "heatRisk": "low",
      "exposure": false,
      "surfaceHazards": [
        "The Nant Bordon suspension footbridge (metal grating)",
        "About 500 m on lanes open to cars near the start"
      ],
      "routeNumberSource": {
        "provider": "Office de Tourisme de Passy (Apidae)",
        "name": "Balade du Plateau d'Assy au Lac Vert par la passerelle du Nant Bordon",
        "url": "https://hautesavoiemontblanc-tourisme.com/offres/balade-du-plateau-dassy-au-lac-vert-par-la-passerelle-du-nant-bordon-passy-fr-5866028/"
      },
      "curated": true,
      "tier": "route-audited",
      "reviewedAt": "2026-10-22",
      "reviewedBy": "ORMA route audit",
      "routeAudit": {
        "photo": "Commons, Mangatome, CC BY-SA 3.0, the Lac Vert that the walk reaches.",
        "route": "Published line 8.5 km out and back; official fiche 10 km, its GPX 7.5 km; 91% of GPX points within 60 m of the line.",
        "routeNumbers": "No number; the official text routes by landmark (Promenade Marie Curie, Sancellemoz, old Lac Vert road, Nant Bordon footbridge), back the same way, with no switch.",
        "mapPoints": "Start at the official Place Tobé point (50 m from the old one); tap at the lake traced to OSM.",
        "elevation": "393 m on the line; the GPX gives 407 m, the fiche 300 m."
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
          "Haute-Savoie Mont-Blanc, Balade du Plateau d'Assy au Lac Vert par la passerelle du Nant Bordon (Apidae 5668895) and official GPX: animals accepted",
          "Boucle du Lac Vert route page: at the lake, dogs on a lead and banned from the water",
          "Réserve naturelle de Passy 630 m from the line (dogs banned inside); no Natura 2000 site on the line (Géoportail, EEA); Passy publishes no dog order",
          "OpenStreetMap relation 16180587: road classes, footbridge, land cover and water along the line"
        ],
        "date": "2026-10-22"
      },
      "sourceLinks": [
        {
          "label": "Haute-Savoie Mont-Blanc, Plateau d'Assy au Lac Vert",
          "url": "https://hautesavoiemontblanc-tourisme.com/offres/balade-du-plateau-dassy-au-lac-vert-par-la-passerelle-du-nant-bordon-passy-fr-5866028/"
        },
        {
          "label": "Official GPX",
          "url": "https://static.apidae-tourisme.com/filestore/objets-touristiques/plans/38/47/13774630/Mon_parcours+1.gpx"
        },
        {
          "label": "Lac Vert rules (official route page)",
          "url": "https://www.combloux.com/itineraires/boucle-du-lac-vert/"
        },
        {
          "label": "OpenStreetMap relation 16180587",
          "url": "https://www.openstreetmap.org/relation/16180587"
        }
      ]
    },
    'osm-14376573': {
      // Hand audit 22 October 2026: route, figures, season, start and dog answer from the Office de Tourisme Les Karellis
      // (Cirkwi, route N°23, updated 8 Sep 2026). Commune Montricher-Albanne publishes no dog order; no Natura 2000 site, park
      // or reserve on the line (EEA). New photo from Panoramax, 48 m from the line.
      "area": "Les Karellis, Montricher-Albanne",
      "distance": 4.1,
      "elevation": 291,
      "hours": "3",
      "startPoint": {
        "lat": 45.212541,
        "lng": 6.402186,
        "label": "Top of the Vinouve chairlift, Les Karellis (official start)"
      },
      "terrainType": "Stony tracks and paths on open alpine ground, 2,130 to 2,420 m",
      "desc": "A high loop from the top of the Vinouve chairlift above Les Karellis, waymarked as route 23 (blue round marker), with a plunging view over the resort, cairns along the ridge and Mont Blanc on a clear day. Officially 4.1 km and 291 m of climb, about 3 hours, rated medium and advised for regular walkers. The ground is rock and stones.\n\nDogs are accepted, according to the Karellis tourist office. Montricher-Albanne publishes no dog order, so the national rule applies: a lead in fields off the paths from 15 April to 30 June. The whole loop is open ground above 2,100 m, with no shade and no water.",
      "tips": "The loop starts at the top of the Vinouve chairlift, which the office lists as running from early July to late August on Monday, Tuesday, Wednesday and Friday only, snow permitting. Ask at the lift whether your dog may ride; otherwise it is a long climb up the ski tracks from the resort. Carry all the water you both need, as there is none on the loop, and avoid the hottest hours. Watch your dog's paws on the sharp stones. Alpine pastures may hold livestock in summer, though none is mapped beside the path.",
      "shadeCoverage": 0,
      "heatRisk": "moderate",
      "exposure": false,
      "surfaceHazards": [
        "Rock and loose stones underfoot"
      ],
      "routeNumberSource": {
        "provider": "Office de Tourisme Les Karellis (Cirkwi)",
        "name": "N°23 - Crêt de Talière",
        "url": "https://www.cirkwi.com/fr/circuit/252709-itineraire-de-randonnee-23-cret-de-taliere"
      },
      "curated": true,
      "tier": "route-audited",
      "reviewedAt": "2026-10-22",
      "reviewedBy": "ORMA route audit",
      "routeAudit": {
        "photo": "Panoramax, AlexandreModesto73, CC BY-SA 4.0, the stony track on the loop with a chairlift pylon, 48 m from the line (replaces a photo taken 2 km away).",
        "route": "Published line 4.05 km, closed; official 4.1 km.",
        "routeNumbers": "Route 23, blue round marker (Station des Karellis); the official page names no switch.",
        "mapPoints": "Start at the official top of the Vinouve chairlift (24 m from the line).",
        "elevation": "Official 291 m of climb (was 387)."
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
          "Office de Tourisme Les Karellis, N°23 - Crêt de Talière (Cirkwi, updated 8 September 2026): animals accepted",
          "Montricher-Albanne publishes no dog order; arrêté du 16 mars 1955 (national baseline)",
          "No Natura 2000 site, park or reserve on the line (EEA)",
          "OpenStreetMap relation 14376573: waymark 23, tracks, land cover and water along the line"
        ],
        "date": "2026-10-22"
      },
      "sourceLinks": [
        {
          "label": "Office de Tourisme Les Karellis, N°23 - Crêt de Talière",
          "url": "https://www.cirkwi.com/fr/circuit/252709-itineraire-de-randonnee-23-cret-de-taliere"
        },
        {
          "label": "Arrêté du 16 mars 1955 (national baseline)",
          "url": "https://aida.ineris.fr/reglementation/arrete-160355-divagation-chiens"
        },
        {
          "label": "OpenStreetMap relation 14376573",
          "url": "https://www.openstreetmap.org/relation/14376573"
        }
      ]
    },
    'osm-14375158': {
      // Hand audit 22 October 2026: route, figures, waymark and the grazed meadow from the Station des Karellis page for its
      // trail-running course n°1, which follows hiking route n°10. The page states no dog rule; Montricher-Albanne publishes no dog
      // order, so the national rule applies. No Natura 2000 site or reserve on the line (EEA, INPN). New photo from Panoramax (IGN), 54 m.
      "area": "Les Karellis, Montricher-Albanne",
      "distance": 9,
      "elevation": 220,
      "startPoint": {
        "lat": 45.2271183,
        "lng": 6.404797,
        "label": "Les Karellis resort, by the Vinouve chairlift"
      },
      "terrainType": "Wide forest tracks (about three quarters) and paths, two short road stretches",
      "desc": "A rolling loop from Les Karellis, waymarked as hiking route 10 (green round marker) and also used as the resort's beginner trail-running course. It heads towards Albanne on the Nordic ski area, follows wide forest tracks to the Suiffet, climbs through a summer pasture to the orientation table and the Col d'Albanne, with views to the Grand Galibier and the Fort du Télégraphe, and returns by Bellecombe. Officially 9 km and 220 m of climb, without major technical difficulty.\n\nThe official page sets no dog rule, and Montricher-Albanne publishes no dog order, so the national rule applies: a lead in woods and fields off the paths from 15 April to 30 June. About three quarters of the loop runs on forest tracks.",
      "tips": "The way to the orientation table crosses a meadow grazed in summer, under an electric fence: put the lead on, and lift your dog's lead clear of the wire. Some forest tracks cross scree, so watch paws on the sharp stones. The loop uses two short road stretches of about 150 m each and crosses another road near the Col d'Albanne: keep your dog close there. A tap is mapped at the start.",
      "shadeCoverage": 60,
      "heatRisk": "low",
      "exposure": false,
      "surfaceHazards": [
        "Scree crossings on forest tracks",
        "Two road stretches of about 150 m and one road crossing",
        "Electric fence at the summer pasture"
      ],
      "routeNumberSource": {
        "provider": "Station des Karellis",
        "name": "Crêt de la Parenche n°10 (trail course n°1)",
        "url": "https://www.karellis.com/activites-ete/parcours-de-trail/"
      },
      "curated": true,
      "tier": "route-audited",
      "reviewedAt": "2026-10-22",
      "reviewedBy": "ORMA route audit",
      "routeAudit": {
        "photo": "Panoramax (IGN), Licence Ouverte 2.0, a forest lane through larches on the loop, 54 m from the line (replaces a photo taken 1.1 km away).",
        "route": "Published line 9 km, closed; official 9 km loop.",
        "routeNumbers": "Hiking route 10, green round marker (Station des Karellis); the official text routes by landmark (Nordic area, Suiffet, orientation table, Col d'Albanne, Bellecombe) with no switch.",
        "mapPoints": "Start at the Karellis resort centre named by the official text; tap at the start traced to OSM.",
        "elevation": "Official 220 m of climb (was 266)."
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
          "Station des Karellis, Parcours de trail: Crêt de la Parenche n°10, 9 km, 220 m, loop, hiking waymark n°10, summer pasture under an electric fence",
          "Montricher-Albanne publishes no dog order; arrêté du 16 mars 1955 (national baseline)",
          "No Natura 2000 site or national reserve on the line (EEA, INPN)",
          "OpenStreetMap relation 14375158: waymark 10, road classes, land cover and water along the line"
        ],
        "date": "2026-10-22"
      },
      "sourceLinks": [
        {
          "label": "Station des Karellis, Parcours de trail (Crêt de la Parenche n°10)",
          "url": "https://www.karellis.com/activites-ete/parcours-de-trail/"
        },
        {
          "label": "Arrêté du 16 mars 1955 (national baseline)",
          "url": "https://aida.ineris.fr/reglementation/arrete-160355-divagation-chiens"
        },
        {
          "label": "OpenStreetMap relation 14375158",
          "url": "https://www.openstreetmap.org/relation/14375158"
        }
      ]
    },
    'osm-12745924': {
      // Hand audit 23 October 2026. The stored OSM line was a different, longer walk (4.6 km); the line here is rebuilt on
      // OpenStreetMap ways along the official GPX of Haute Maurienne Vanoise Tourisme (every GPX point within 21 m; all points are
      // OSM nodes, so it stays map data, not a copied GPX). Route, figures, season and dog rule from the La Norma page. No Natura 2000
      // site, park, reserve or biotope order on the line (EEA, INPN).
      "area": "La Norma, Villarodin-Bourget",
      "path": [
        [
          45.19845,
          6.69075
        ],
        [
          45.19843,
          6.69051
        ],
        [
          45.19842,
          6.69046
        ],
        [
          45.19841,
          6.69042
        ],
        [
          45.19839,
          6.69038
        ],
        [
          45.19835,
          6.69031
        ],
        [
          45.19831,
          6.69026
        ],
        [
          45.19828,
          6.69025
        ],
        [
          45.19825,
          6.69025
        ],
        [
          45.1981,
          6.69022
        ],
        [
          45.19778,
          6.69012
        ],
        [
          45.19767,
          6.69007
        ],
        [
          45.19748,
          6.69003
        ],
        [
          45.19738,
          6.68997
        ],
        [
          45.19723,
          6.68999
        ],
        [
          45.19719,
          6.68996
        ],
        [
          45.19716,
          6.69013
        ],
        [
          45.19714,
          6.69004
        ],
        [
          45.19711,
          6.68997
        ],
        [
          45.1971,
          6.6901
        ],
        [
          45.19706,
          6.69023
        ],
        [
          45.19702,
          6.69018
        ],
        [
          45.19698,
          6.69007
        ],
        [
          45.19695,
          6.69022
        ],
        [
          45.19691,
          6.69035
        ],
        [
          45.1969,
          6.6902
        ],
        [
          45.19688,
          6.69011
        ],
        [
          45.19687,
          6.69018
        ],
        [
          45.19683,
          6.69009
        ],
        [
          45.19681,
          6.69017
        ],
        [
          45.19678,
          6.69025
        ],
        [
          45.19676,
          6.69013
        ],
        [
          45.19675,
          6.69006
        ],
        [
          45.19673,
          6.69005
        ],
        [
          45.1967,
          6.6902
        ],
        [
          45.19661,
          6.6901
        ],
        [
          45.19661,
          6.6902
        ],
        [
          45.19656,
          6.69027
        ],
        [
          45.1965,
          6.69038
        ],
        [
          45.1964,
          6.69043
        ],
        [
          45.1964,
          6.69055
        ],
        [
          45.19633,
          6.69036
        ],
        [
          45.19617,
          6.69023
        ],
        [
          45.19626,
          6.69047
        ],
        [
          45.19614,
          6.69038
        ],
        [
          45.19605,
          6.69025
        ],
        [
          45.19609,
          6.69044
        ],
        [
          45.19613,
          6.69047
        ],
        [
          45.19613,
          6.69049
        ],
        [
          45.19614,
          6.69053
        ],
        [
          45.19616,
          6.69056
        ],
        [
          45.19615,
          6.69064
        ],
        [
          45.19617,
          6.69068
        ],
        [
          45.19617,
          6.69075
        ],
        [
          45.19612,
          6.69083
        ],
        [
          45.19606,
          6.69095
        ],
        [
          45.19607,
          6.69097
        ],
        [
          45.19606,
          6.69101
        ],
        [
          45.19596,
          6.69109
        ],
        [
          45.19591,
          6.69099
        ],
        [
          45.19589,
          6.69099
        ],
        [
          45.19588,
          6.69114
        ],
        [
          45.19583,
          6.69118
        ],
        [
          45.19578,
          6.69112
        ],
        [
          45.19576,
          6.69122
        ],
        [
          45.19576,
          6.69138
        ],
        [
          45.1958,
          6.69167
        ],
        [
          45.19584,
          6.69192
        ],
        [
          45.19589,
          6.69214
        ],
        [
          45.19591,
          6.69235
        ],
        [
          45.19589,
          6.69251
        ],
        [
          45.19589,
          6.69261
        ],
        [
          45.19596,
          6.69281
        ],
        [
          45.19599,
          6.69298
        ],
        [
          45.19598,
          6.69306
        ],
        [
          45.19594,
          6.69314
        ],
        [
          45.19587,
          6.69296
        ],
        [
          45.19588,
          6.6931
        ],
        [
          45.19586,
          6.69322
        ],
        [
          45.19588,
          6.69335
        ],
        [
          45.19585,
          6.69328
        ],
        [
          45.19586,
          6.69343
        ],
        [
          45.19586,
          6.69349
        ],
        [
          45.19591,
          6.69365
        ],
        [
          45.1959,
          6.69383
        ],
        [
          45.19588,
          6.69377
        ],
        [
          45.19588,
          6.6938
        ],
        [
          45.19587,
          6.69384
        ],
        [
          45.19582,
          6.69377
        ],
        [
          45.19582,
          6.69381
        ],
        [
          45.19578,
          6.69379
        ],
        [
          45.19581,
          6.69386
        ],
        [
          45.19578,
          6.69385
        ],
        [
          45.19575,
          6.69391
        ],
        [
          45.19579,
          6.69397
        ],
        [
          45.1959,
          6.69421
        ],
        [
          45.196,
          6.6944
        ],
        [
          45.1962,
          6.69465
        ],
        [
          45.19635,
          6.69492
        ],
        [
          45.19644,
          6.69515
        ],
        [
          45.19656,
          6.69548
        ],
        [
          45.19666,
          6.69567
        ],
        [
          45.19688,
          6.69605
        ],
        [
          45.19701,
          6.69624
        ],
        [
          45.1971,
          6.69643
        ],
        [
          45.19729,
          6.69688
        ],
        [
          45.19752,
          6.69738
        ],
        [
          45.19777,
          6.6979
        ],
        [
          45.19799,
          6.69842
        ],
        [
          45.19816,
          6.69887
        ],
        [
          45.1983,
          6.69923
        ],
        [
          45.19827,
          6.69921
        ],
        [
          45.19824,
          6.69922
        ],
        [
          45.19827,
          6.69921
        ],
        [
          45.1983,
          6.69923
        ],
        [
          45.19842,
          6.69954
        ],
        [
          45.19851,
          6.69974
        ],
        [
          45.19858,
          6.69998
        ],
        [
          45.19863,
          6.7002
        ],
        [
          45.19869,
          6.70046
        ],
        [
          45.19874,
          6.70071
        ],
        [
          45.19875,
          6.70074
        ],
        [
          45.19878,
          6.70076
        ],
        [
          45.1988,
          6.70076
        ],
        [
          45.19882,
          6.70075
        ],
        [
          45.19883,
          6.70073
        ],
        [
          45.19884,
          6.70071
        ],
        [
          45.19885,
          6.70068
        ],
        [
          45.19884,
          6.70064
        ],
        [
          45.19882,
          6.70054
        ],
        [
          45.19879,
          6.70038
        ],
        [
          45.19872,
          6.69958
        ],
        [
          45.19867,
          6.6993
        ],
        [
          45.19872,
          6.69922
        ],
        [
          45.19871,
          6.69907
        ],
        [
          45.1987,
          6.69893
        ],
        [
          45.19868,
          6.6988
        ],
        [
          45.19866,
          6.69872
        ],
        [
          45.19864,
          6.69868
        ],
        [
          45.19862,
          6.69859
        ],
        [
          45.1986,
          6.69848
        ],
        [
          45.19858,
          6.69836
        ],
        [
          45.19858,
          6.69834
        ],
        [
          45.19859,
          6.69832
        ],
        [
          45.1986,
          6.69831
        ],
        [
          45.19862,
          6.69831
        ],
        [
          45.19863,
          6.69832
        ],
        [
          45.19866,
          6.69837
        ],
        [
          45.19877,
          6.69852
        ],
        [
          45.19885,
          6.69862
        ],
        [
          45.19909,
          6.69898
        ],
        [
          45.19916,
          6.6991
        ],
        [
          45.19921,
          6.69917
        ],
        [
          45.19927,
          6.6992
        ],
        [
          45.19937,
          6.69921
        ],
        [
          45.19968,
          6.69913
        ],
        [
          45.20032,
          6.69906
        ],
        [
          45.20075,
          6.69887
        ],
        [
          45.20081,
          6.69891
        ],
        [
          45.20089,
          6.69897
        ],
        [
          45.20101,
          6.69908
        ],
        [
          45.20109,
          6.69913
        ],
        [
          45.20115,
          6.69916
        ],
        [
          45.2012,
          6.69919
        ],
        [
          45.20123,
          6.69922
        ],
        [
          45.20126,
          6.69928
        ],
        [
          45.20123,
          6.69916
        ],
        [
          45.20121,
          6.69901
        ],
        [
          45.20118,
          6.69891
        ],
        [
          45.20115,
          6.6988
        ],
        [
          45.20115,
          6.6987
        ],
        [
          45.20114,
          6.69859
        ],
        [
          45.20113,
          6.69852
        ],
        [
          45.20111,
          6.69845
        ],
        [
          45.20109,
          6.69839
        ],
        [
          45.20104,
          6.69827
        ],
        [
          45.20098,
          6.69807
        ],
        [
          45.20093,
          6.6979
        ],
        [
          45.2008,
          6.69752
        ],
        [
          45.20075,
          6.69736
        ],
        [
          45.20068,
          6.69712
        ],
        [
          45.20063,
          6.69695
        ],
        [
          45.2006,
          6.69686
        ],
        [
          45.20055,
          6.69677
        ],
        [
          45.20049,
          6.6967
        ],
        [
          45.20048,
          6.69662
        ],
        [
          45.20047,
          6.69657
        ],
        [
          45.20042,
          6.69652
        ],
        [
          45.20029,
          6.69649
        ],
        [
          45.20017,
          6.69643
        ],
        [
          45.20009,
          6.69638
        ],
        [
          45.19999,
          6.69628
        ],
        [
          45.19987,
          6.69615
        ],
        [
          45.19976,
          6.69607
        ],
        [
          45.19966,
          6.69602
        ],
        [
          45.19954,
          6.69596
        ],
        [
          45.19946,
          6.69589
        ],
        [
          45.19941,
          6.69582
        ],
        [
          45.19933,
          6.69566
        ],
        [
          45.19928,
          6.69555
        ],
        [
          45.19919,
          6.69531
        ],
        [
          45.19915,
          6.69515
        ],
        [
          45.1991,
          6.69501
        ],
        [
          45.19901,
          6.69473
        ],
        [
          45.19896,
          6.69455
        ],
        [
          45.19895,
          6.69447
        ],
        [
          45.19893,
          6.69438
        ],
        [
          45.19888,
          6.69411
        ],
        [
          45.19884,
          6.69387
        ],
        [
          45.1988,
          6.6937
        ],
        [
          45.19878,
          6.69364
        ],
        [
          45.19875,
          6.69354
        ],
        [
          45.19871,
          6.69344
        ],
        [
          45.1987,
          6.69342
        ],
        [
          45.19862,
          6.69328
        ],
        [
          45.19856,
          6.69315
        ],
        [
          45.19853,
          6.69308
        ],
        [
          45.19852,
          6.693
        ],
        [
          45.19848,
          6.69286
        ],
        [
          45.19844,
          6.69278
        ],
        [
          45.19835,
          6.6926
        ],
        [
          45.19834,
          6.69257
        ],
        [
          45.19826,
          6.6923
        ],
        [
          45.19817,
          6.69211
        ],
        [
          45.19807,
          6.69191
        ],
        [
          45.19806,
          6.6917
        ],
        [
          45.19805,
          6.69158
        ],
        [
          45.19801,
          6.69147
        ],
        [
          45.198,
          6.69144
        ],
        [
          45.19805,
          6.69132
        ],
        [
          45.1981,
          6.6912
        ],
        [
          45.19825,
          6.69102
        ],
        [
          45.19845,
          6.69075
        ]
      ],
      "lat": 45.19845,
      "lng": 6.69075,
      "distance": 2.9,
      "elevation": 180,
      "hours": "0.75",
      "elevationProfile": [
        {
          "km": 0,
          "elev": 1360
        },
        {
          "km": 0.2,
          "elev": 1375
        },
        {
          "km": 0.5,
          "elev": 1419
        },
        {
          "km": 0.7,
          "elev": 1434
        },
        {
          "km": 0.9,
          "elev": 1521
        },
        {
          "km": 1.1,
          "elev": 1481
        },
        {
          "km": 1.3,
          "elev": 1472
        },
        {
          "km": 1.6,
          "elev": 1445
        },
        {
          "km": 1.8,
          "elev": 1418
        },
        {
          "km": 2,
          "elev": 1370
        },
        {
          "km": 2.3,
          "elev": 1362
        },
        {
          "km": 2.5,
          "elev": 1356
        },
        {
          "km": 2.7,
          "elev": 1354
        },
        {
          "km": 2.9,
          "elev": 1358
        }
      ],
      "waterSources": [
        {
          "km": 2.3,
          "lat": 45.1996713,
          "lng": 6.6951844,
          "osmId": "node/8923539056",
          "label": "Drinking water (OSM-verified location)"
        },
        {
          "km": 2.4,
          "lat": 45.1987448,
          "lng": 6.6955466,
          "osmId": "node/9027102204",
          "label": "Drinking water (OSM-verified location)"
        },
        {
          "km": 2.5,
          "lat": 45.1985455,
          "lng": 6.6946244,
          "osmId": "node/9027102203",
          "label": "Drinking water (OSM-verified location)"
        }
      ],
      "rifugi": [
        {
          "km": 1.9,
          "lat": 45.20116,
          "lng": 6.69698,
          "osmId": "node/4299232280",
          "name": "L'Antirouille"
        },
        {
          "km": 1.9,
          "lat": 45.20111,
          "lng": 6.69713,
          "osmId": "node/4299232281",
          "name": "Le Cairn"
        },
        {
          "km": 1.9,
          "lat": 45.20153,
          "lng": 6.6981,
          "osmId": "node/4301351798",
          "name": "La Bodega"
        },
        {
          "km": 1.9,
          "lat": 45.20155,
          "lng": 6.6982,
          "osmId": "node/4301351799",
          "name": "Le Dahu"
        },
        {
          "km": 1.9,
          "lat": 45.20149,
          "lng": 6.69773,
          "osmId": "way/111765252",
          "name": "L'Entre Deux"
        },
        {
          "km": 2,
          "lat": 45.20156,
          "lng": 6.69698,
          "osmId": "node/1272509337",
          "name": "Le Telemark"
        },
        {
          "km": 2,
          "lat": 45.20171,
          "lng": 6.69685,
          "osmId": "node/1272517490",
          "name": "Chez Éliane"
        },
        {
          "km": 2,
          "lat": 45.20147,
          "lng": 6.69675,
          "osmId": "way/111764876",
          "name": "Tao !"
        }
      ],
      "startPoint": {
        "lat": 45.19845,
        "lng": 6.69075,
        "label": "Base de loisirs des Avenières, chemin des Tufs, La Norma (official start)"
      },
      "terrainType": "Earth paths and forest tracks, a short lane at the start",
      "desc": "A short loop from the Avenières leisure base in La Norma, climbing through spruce and larch on the forest steps that give the walk its name and coming back past the turquoise snow-making pond. It shares its paths with PR and GR waymarks. Officially 3.1 km and 180 m of climb, about 45 minutes, open from mid-May to mid-October.\n\nDogs are accepted, and the La Norma tourist office asks that they stay on a lead out of respect for wildlife. No protected area touches the loop. Much of it runs through woods. Mountain bikers use the same paths, and the line passes ski lifts that stand still in summer.",
      "tips": "Keep the lead on, as the tourist office asks. Mountain bikers share the paths, so keep your dog close on the descents. Taps and springs are mapped near the end of the loop, by the leisure base. The forest paths are earth and can be slippery after rain.",
      "shadeCoverage": 50,
      "heatRisk": "low",
      "exposure": false,
      "surfaceHazards": [
        "Paths shared with mountain bikers"
      ],
      "routeNumberSource": {
        "provider": "Haute Maurienne Vanoise Tourisme (La Norma)",
        "name": "Les Escaliers walking trail",
        "url": "https://www.la-norma.fr/en/equipement/les-escaliers-walking-trail-la-norma/"
      },
      "curated": true,
      "tier": "route-audited",
      "reviewedAt": "2026-10-23",
      "reviewedBy": "ORMA route audit",
      "routeAudit": {
        "photo": "Commons, phase3 (Panoramio), CC BY 3.0, the Avenières pond at the start and finish, 49 m from the line (replaces a village photo 1.1 km away).",
        "route": "Line rebuilt on OSM ways along the official GPX: 2.93 km, closed; official 3.1 km; every GPX point within 21 m of the line.",
        "routeNumbers": "No number of its own: mixed PR and GR waymarking, as the official page states; no switch is named.",
        "mapPoints": "Start at the Avenières leisure base named by the official page; taps and springs traced to OSM along the new line.",
        "elevation": "Official 180 m of climb; profile recomputed for the new line."
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
          "La Norma tourist office (Haute Maurienne Vanoise), Les Escaliers walking trail, and official GPX: dogs allowed, kept on a lead",
          "No Natura 2000 site, park, reserve or biotope order on the line (EEA, INPN)",
          "OpenStreetMap ways along the official GPX: rebuilt line, road classes, land cover and water"
        ],
        "date": "2026-10-23"
      },
      "sourceLinks": [
        {
          "label": "La Norma, Les Escaliers walking trail",
          "url": "https://www.la-norma.fr/en/equipement/les-escaliers-walking-trail-la-norma/"
        },
        {
          "label": "Official GPX (guide for the rebuilt line)",
          "url": "https://static.apidae-tourisme.com/filestore/objets-touristiques/plans/129/63/21905281/3-+Circuit+des+escaliers+avec+alt.gpx"
        },
        {
          "label": "OpenStreetMap relation 12745924",
          "url": "https://www.openstreetmap.org/relation/12745924"
        }
      ]
    },
    'osm-10539302': {
      // Hand audit 23 October 2026: the line matches the official Valloire Tourisme GPX within 10 m (3.8 km). The page's own
      // figures (6.96 km, 387 m) belong to a longer version from Camping Sainte-Thècle, stated in the text. Dog rule from the official
      // page and the Valloire municipal lead order (Le Colporteur no. 31). No Natura 2000, park core, reserve or biotope order on the line.
      "area": "Valloire",
      "distance": 3.9,
      "elevation": 305,
      "desc": "The ONF's eco-forestry trail at Valloire: a loop from La Borgé up through the larch woods to the hamlet of Poingt-Ravier and back, with interpretation panels on the forest along the way. The line follows the official Valloire Tourisme GPX, about 3.8 km. The official page also quotes 6.96 km and 387 m of climb, for a longer version that starts at the Sainte-Thècle campsite.\n\nDogs must be on a lead: the official page asks for it, and a Valloire municipal order requires it for all dogs in the commune. About half the loop is under closed larch forest. Some 475 m follows the Route des Villards (D 81D, 30 km/h), and the loop crosses a short metal footbridge near the start.",
      "tips": "Keep the lead on, as Valloire requires. A dairy farm with Tarine cows, the Ferme du Petit Borgé, stands beside the path at La Borgé. Guardian dogs work the higher alpine pastures, not this loop; the tourist office's advice there is to keep your dog on a lead too. Taps are mapped at the start and at Poingt-Ravier. Keep your dog close on the Route des Villards stretch. The via ferrata nearby is a separate route that the walk does not use.",
      "shadeCoverage": 50,
      "heatRisk": "low",
      "exposure": false,
      "surfaceHazards": [
        "About 475 m along the Route des Villards (D 81D, 30 km/h)",
        "Short metal footbridge near the start",
        "Two short flights of wooden steps"
      ],
      "routeNumberSource": {
        "provider": "Valloire Tourisme (Apidae)",
        "name": "Le sentier écosylve de Valloire",
        "url": "https://www.valloire.net/sit/le-sentier-ecosylve-de-valloire-5841280/"
      },
      "curated": true,
      "tier": "route-audited",
      "reviewedAt": "2026-10-23",
      "reviewedBy": "ORMA route audit",
      "routeAudit": {
        "photo": "Commons, Florian Pépellin, CC BY-SA 3.0, the lower Valloirette valley, 6 m from the line.",
        "route": "Published line 3.91 km; official GPX 3.79 km, every GPX point within 10 m of the line. The page's 6.96 km is a longer version from the campsite, stated in the text.",
        "routeNumbers": "No number: the ONF eco-forestry trail, waymarked with its own panels and arrows; the official text names no switch.",
        "mapPoints": "Start at La Borgé on the line; taps traced to OSM.",
        "elevation": "305 m of climb on the line; the page's 387 m is for the longer version."
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
          "Valloire Tourisme, Le sentier écosylve de Valloire (Apidae) and official GPX: animals accepted, on a lead",
          "Mairie de Valloire, Le Colporteur no. 31 (November 2020): by municipal order all dogs must be kept on a lead in Valloire",
          "No Natura 2000 site, national park core, reserve or biotope order on the line (EEA, IGN); Écrins adhesion area nearby but not on the line",
          "OpenStreetMap relation 10539302 and IGN BD Forêt: road classes, larch forest share, water along the line"
        ],
        "date": "2026-10-23"
      },
      "sourceLinks": [
        {
          "label": "Valloire Tourisme, Le sentier écosylve",
          "url": "https://www.valloire.net/sit/le-sentier-ecosylve-de-valloire-5841280/"
        },
        {
          "label": "Official GPX",
          "url": "https://static.apidae-tourisme.com/filestore/objets-touristiques/plans/136/33/10101128/Cirkwi-Sentier_cosylve.gpx"
        },
        {
          "label": "Mairie de Valloire, Le Colporteur no. 31 (dogs on a lead)",
          "url": "https://www.mairie-valloire.fr/InfoliveDocuments/le_colporteur_-_nov_2020_ld.pdf"
        },
        {
          "label": "OpenStreetMap relation 10539302",
          "url": "https://www.openstreetmap.org/relation/10539302"
        }
      ]
    },
    'osm-19064561': {
      // Hand audit 23 October 2026. The stored OSM line ran one way from the Col du Feu (the winter start) past Très-le-Mont; the
      // line here is rebuilt on OpenStreetMap ways along the official GPX (96% of GPX points within 25 m; all points are OSM nodes).
      // Route, start and dog rule from the Apidae fiche (Alpes du Léman); cows from the department's alpage page. The line is in
      // Lullin. No Natura 2000 site, park, reserve or biotope order on the line (EEA, INPN).
      "area": "Très-le-Mont, Lullin",
      "path": [
        [
          46.28619,
          6.49194
        ],
        [
          46.28616,
          6.4919
        ],
        [
          46.28612,
          6.49188
        ],
        [
          46.28598,
          6.49179
        ],
        [
          46.28586,
          6.49172
        ],
        [
          46.28548,
          6.49148
        ],
        [
          46.28538,
          6.49142
        ],
        [
          46.28534,
          6.49139
        ],
        [
          46.28531,
          6.49135
        ],
        [
          46.28529,
          6.49131
        ],
        [
          46.28524,
          6.49125
        ],
        [
          46.28511,
          6.49107
        ],
        [
          46.28508,
          6.49104
        ],
        [
          46.28505,
          6.49099
        ],
        [
          46.285,
          6.49092
        ],
        [
          46.28488,
          6.49069
        ],
        [
          46.28482,
          6.4906
        ],
        [
          46.28473,
          6.49047
        ],
        [
          46.28469,
          6.49039
        ],
        [
          46.28465,
          6.49032
        ],
        [
          46.28461,
          6.49024
        ],
        [
          46.28458,
          6.49015
        ],
        [
          46.28453,
          6.48997
        ],
        [
          46.2845,
          6.48989
        ],
        [
          46.28446,
          6.48982
        ],
        [
          46.28442,
          6.48975
        ],
        [
          46.28438,
          6.48969
        ],
        [
          46.28422,
          6.48948
        ],
        [
          46.28421,
          6.48946
        ],
        [
          46.28419,
          6.48943
        ],
        [
          46.28416,
          6.48936
        ],
        [
          46.28415,
          6.48934
        ],
        [
          46.28413,
          6.48931
        ],
        [
          46.28411,
          6.4893
        ],
        [
          46.28408,
          6.48926
        ],
        [
          46.28379,
          6.48894
        ],
        [
          46.28384,
          6.48918
        ],
        [
          46.28385,
          6.48923
        ],
        [
          46.28387,
          6.4894
        ],
        [
          46.28389,
          6.48957
        ],
        [
          46.2839,
          6.48981
        ],
        [
          46.28385,
          6.48974
        ],
        [
          46.28382,
          6.48971
        ],
        [
          46.28379,
          6.48969
        ],
        [
          46.28376,
          6.48968
        ],
        [
          46.28364,
          6.48965
        ],
        [
          46.2836,
          6.48965
        ],
        [
          46.28356,
          6.48967
        ],
        [
          46.28353,
          6.4897
        ],
        [
          46.28345,
          6.4898
        ],
        [
          46.28339,
          6.48987
        ],
        [
          46.28334,
          6.48995
        ],
        [
          46.28329,
          6.49003
        ],
        [
          46.28325,
          6.49012
        ],
        [
          46.28319,
          6.49025
        ],
        [
          46.28316,
          6.49024
        ],
        [
          46.28314,
          6.49024
        ],
        [
          46.28312,
          6.49026
        ],
        [
          46.28308,
          6.49028
        ],
        [
          46.28303,
          6.4903
        ],
        [
          46.28297,
          6.49032
        ],
        [
          46.28294,
          6.49033
        ],
        [
          46.28291,
          6.49035
        ],
        [
          46.28288,
          6.49038
        ],
        [
          46.28286,
          6.4904
        ],
        [
          46.28282,
          6.49042
        ],
        [
          46.2828,
          6.49045
        ],
        [
          46.28278,
          6.49046
        ],
        [
          46.28276,
          6.49048
        ],
        [
          46.28274,
          6.49049
        ],
        [
          46.28272,
          6.49049
        ],
        [
          46.2827,
          6.4905
        ],
        [
          46.28267,
          6.4905
        ],
        [
          46.28262,
          6.49051
        ],
        [
          46.2826,
          6.4905
        ],
        [
          46.28248,
          6.49048
        ],
        [
          46.28243,
          6.49048
        ],
        [
          46.28237,
          6.49047
        ],
        [
          46.28216,
          6.49044
        ],
        [
          46.2821,
          6.49044
        ],
        [
          46.28203,
          6.49044
        ],
        [
          46.282,
          6.49043
        ],
        [
          46.28195,
          6.49041
        ],
        [
          46.28191,
          6.4903
        ],
        [
          46.28189,
          6.49025
        ],
        [
          46.28187,
          6.49022
        ],
        [
          46.28173,
          6.49002
        ],
        [
          46.28169,
          6.48998
        ],
        [
          46.28161,
          6.4899
        ],
        [
          46.28157,
          6.48986
        ],
        [
          46.2815,
          6.48978
        ],
        [
          46.28145,
          6.48973
        ],
        [
          46.2814,
          6.4897
        ],
        [
          46.28128,
          6.48963
        ],
        [
          46.28123,
          6.4896
        ],
        [
          46.28118,
          6.48956
        ],
        [
          46.28116,
          6.48955
        ],
        [
          46.28112,
          6.48954
        ],
        [
          46.2811,
          6.48954
        ],
        [
          46.28108,
          6.48955
        ],
        [
          46.28107,
          6.48958
        ],
        [
          46.28107,
          6.48961
        ],
        [
          46.28109,
          6.48964
        ],
        [
          46.28111,
          6.48967
        ],
        [
          46.28114,
          6.48971
        ],
        [
          46.28123,
          6.48987
        ],
        [
          46.28127,
          6.48995
        ],
        [
          46.28141,
          6.49031
        ],
        [
          46.28144,
          6.49039
        ],
        [
          46.28145,
          6.49047
        ],
        [
          46.28164,
          6.49158
        ],
        [
          46.28165,
          6.49169
        ],
        [
          46.28165,
          6.49198
        ],
        [
          46.28165,
          6.49203
        ],
        [
          46.28164,
          6.49207
        ],
        [
          46.28163,
          6.4921
        ],
        [
          46.28161,
          6.49212
        ],
        [
          46.28159,
          6.49213
        ],
        [
          46.28156,
          6.49212
        ],
        [
          46.28154,
          6.4921
        ],
        [
          46.28151,
          6.49207
        ],
        [
          46.28144,
          6.49198
        ],
        [
          46.28132,
          6.49185
        ],
        [
          46.28128,
          6.49178
        ],
        [
          46.28124,
          6.49171
        ],
        [
          46.2812,
          6.49163
        ],
        [
          46.28117,
          6.49157
        ],
        [
          46.28114,
          6.49148
        ],
        [
          46.28111,
          6.49144
        ],
        [
          46.28108,
          6.4914
        ],
        [
          46.28104,
          6.49138
        ],
        [
          46.28102,
          6.49136
        ],
        [
          46.281,
          6.49133
        ],
        [
          46.28095,
          6.49125
        ],
        [
          46.28085,
          6.4911
        ],
        [
          46.28081,
          6.49103
        ],
        [
          46.28076,
          6.49095
        ],
        [
          46.28071,
          6.49085
        ],
        [
          46.28067,
          6.49079
        ],
        [
          46.28061,
          6.4907
        ],
        [
          46.28055,
          6.49063
        ],
        [
          46.28048,
          6.49056
        ],
        [
          46.28029,
          6.49037
        ],
        [
          46.28021,
          6.49028
        ],
        [
          46.28015,
          6.49022
        ],
        [
          46.28008,
          6.49016
        ],
        [
          46.28004,
          6.49014
        ],
        [
          46.28001,
          6.49015
        ],
        [
          46.27997,
          6.49017
        ],
        [
          46.27995,
          6.49021
        ],
        [
          46.27994,
          6.49026
        ],
        [
          46.27994,
          6.49032
        ],
        [
          46.27999,
          6.49059
        ],
        [
          46.28,
          6.49062
        ],
        [
          46.28002,
          6.4907
        ],
        [
          46.28003,
          6.49076
        ],
        [
          46.28004,
          6.49083
        ],
        [
          46.28007,
          6.49105
        ],
        [
          46.28007,
          6.49112
        ],
        [
          46.28007,
          6.4912
        ],
        [
          46.28007,
          6.49124
        ],
        [
          46.28005,
          6.49127
        ],
        [
          46.28003,
          6.4913
        ],
        [
          46.28,
          6.49131
        ],
        [
          46.27996,
          6.49132
        ],
        [
          46.27991,
          6.49131
        ],
        [
          46.27987,
          6.4913
        ],
        [
          46.27972,
          6.49122
        ],
        [
          46.27964,
          6.49117
        ],
        [
          46.27944,
          6.49101
        ],
        [
          46.27941,
          6.49098
        ],
        [
          46.27932,
          6.49092
        ],
        [
          46.27885,
          6.49059
        ],
        [
          46.27881,
          6.49056
        ],
        [
          46.27873,
          6.4905
        ],
        [
          46.27867,
          6.49045
        ],
        [
          46.27863,
          6.49042
        ],
        [
          46.27861,
          6.49038
        ],
        [
          46.27857,
          6.49035
        ],
        [
          46.27854,
          6.49032
        ],
        [
          46.27828,
          6.49007
        ],
        [
          46.2782,
          6.49001
        ],
        [
          46.27817,
          6.49
        ],
        [
          46.27814,
          6.49
        ],
        [
          46.27812,
          6.49002
        ],
        [
          46.27809,
          6.49008
        ],
        [
          46.27808,
          6.49011
        ],
        [
          46.27808,
          6.49015
        ],
        [
          46.27809,
          6.49026
        ],
        [
          46.2781,
          6.49036
        ],
        [
          46.2781,
          6.49047
        ],
        [
          46.27809,
          6.49051
        ],
        [
          46.27807,
          6.49054
        ],
        [
          46.27806,
          6.49056
        ],
        [
          46.27802,
          6.49058
        ],
        [
          46.27792,
          6.49059
        ],
        [
          46.27787,
          6.49059
        ],
        [
          46.27782,
          6.49057
        ],
        [
          46.27777,
          6.49055
        ],
        [
          46.27771,
          6.49051
        ],
        [
          46.27754,
          6.49037
        ],
        [
          46.27718,
          6.49013
        ],
        [
          46.27713,
          6.4901
        ],
        [
          46.277,
          6.49004
        ],
        [
          46.27694,
          6.49002
        ],
        [
          46.27688,
          6.49002
        ],
        [
          46.27669,
          6.49002
        ],
        [
          46.27652,
          6.49001
        ],
        [
          46.27646,
          6.49
        ],
        [
          46.2764,
          6.48997
        ],
        [
          46.27613,
          6.48978
        ],
        [
          46.27608,
          6.48976
        ],
        [
          46.276,
          6.48973
        ],
        [
          46.27595,
          6.4897
        ],
        [
          46.27568,
          6.48951
        ],
        [
          46.2756,
          6.48946
        ],
        [
          46.27553,
          6.48943
        ],
        [
          46.27545,
          6.48941
        ],
        [
          46.27525,
          6.48938
        ],
        [
          46.27519,
          6.48936
        ],
        [
          46.27515,
          6.48932
        ],
        [
          46.27502,
          6.48918
        ],
        [
          46.27463,
          6.48877
        ],
        [
          46.27448,
          6.48862
        ],
        [
          46.27445,
          6.48859
        ],
        [
          46.2744,
          6.48857
        ],
        [
          46.27435,
          6.48855
        ],
        [
          46.27431,
          6.48852
        ],
        [
          46.27406,
          6.48837
        ],
        [
          46.27402,
          6.48835
        ],
        [
          46.27399,
          6.48834
        ],
        [
          46.27395,
          6.48833
        ],
        [
          46.27391,
          6.48833
        ],
        [
          46.27388,
          6.48834
        ],
        [
          46.27382,
          6.48835
        ],
        [
          46.27379,
          6.48836
        ],
        [
          46.27375,
          6.48836
        ],
        [
          46.27372,
          6.48836
        ],
        [
          46.27369,
          6.48835
        ],
        [
          46.27365,
          6.48833
        ],
        [
          46.27362,
          6.48831
        ],
        [
          46.27358,
          6.48828
        ],
        [
          46.27354,
          6.48824
        ],
        [
          46.27353,
          6.48823
        ],
        [
          46.27351,
          6.48821
        ],
        [
          46.2735,
          6.48819
        ],
        [
          46.27349,
          6.48817
        ],
        [
          46.27349,
          6.48815
        ],
        [
          46.27349,
          6.48812
        ],
        [
          46.27349,
          6.4881
        ],
        [
          46.2735,
          6.48808
        ],
        [
          46.27351,
          6.48807
        ],
        [
          46.27352,
          6.48806
        ],
        [
          46.27354,
          6.48804
        ],
        [
          46.27358,
          6.48803
        ],
        [
          46.27361,
          6.48802
        ],
        [
          46.27365,
          6.48802
        ],
        [
          46.2737,
          6.48805
        ],
        [
          46.27371,
          6.48801
        ],
        [
          46.27377,
          6.48801
        ],
        [
          46.27378,
          6.488
        ],
        [
          46.2738,
          6.488
        ],
        [
          46.27382,
          6.488
        ],
        [
          46.27383,
          6.488
        ],
        [
          46.27384,
          6.48799
        ],
        [
          46.27385,
          6.48798
        ],
        [
          46.27387,
          6.48796
        ],
        [
          46.27388,
          6.48794
        ],
        [
          46.2739,
          6.48793
        ],
        [
          46.27391,
          6.48792
        ],
        [
          46.27391,
          6.48791
        ],
        [
          46.2739,
          6.48791
        ],
        [
          46.27389,
          6.4879
        ],
        [
          46.27387,
          6.48789
        ],
        [
          46.27386,
          6.48787
        ],
        [
          46.27385,
          6.48786
        ],
        [
          46.27385,
          6.48784
        ],
        [
          46.27383,
          6.48784
        ],
        [
          46.27383,
          6.48783
        ],
        [
          46.27383,
          6.48782
        ],
        [
          46.27386,
          6.4878
        ],
        [
          46.27388,
          6.4878
        ],
        [
          46.27389,
          6.48779
        ],
        [
          46.27389,
          6.48777
        ],
        [
          46.2739,
          6.48776
        ],
        [
          46.27392,
          6.48775
        ],
        [
          46.27393,
          6.48774
        ],
        [
          46.27394,
          6.48773
        ],
        [
          46.27396,
          6.48772
        ],
        [
          46.27397,
          6.48772
        ],
        [
          46.27397,
          6.48771
        ],
        [
          46.27396,
          6.4877
        ],
        [
          46.27396,
          6.48769
        ],
        [
          46.27395,
          6.48767
        ],
        [
          46.27393,
          6.48764
        ],
        [
          46.27392,
          6.48761
        ],
        [
          46.27391,
          6.48758
        ],
        [
          46.2739,
          6.48757
        ],
        [
          46.27389,
          6.48757
        ],
        [
          46.27388,
          6.48757
        ],
        [
          46.27388,
          6.48756
        ],
        [
          46.27388,
          6.48755
        ],
        [
          46.27388,
          6.48754
        ],
        [
          46.2739,
          6.48753
        ],
        [
          46.27393,
          6.48753
        ],
        [
          46.27395,
          6.48753
        ],
        [
          46.27397,
          6.48752
        ],
        [
          46.27397,
          6.48751
        ],
        [
          46.27397,
          6.4875
        ],
        [
          46.27396,
          6.48749
        ],
        [
          46.27395,
          6.48748
        ],
        [
          46.27395,
          6.48747
        ],
        [
          46.27395,
          6.48746
        ],
        [
          46.27393,
          6.48744
        ],
        [
          46.27391,
          6.48742
        ],
        [
          46.27391,
          6.48741
        ],
        [
          46.27397,
          6.48738
        ],
        [
          46.27398,
          6.48737
        ],
        [
          46.27399,
          6.48736
        ],
        [
          46.27399,
          6.48734
        ],
        [
          46.27398,
          6.48733
        ],
        [
          46.27395,
          6.48729
        ],
        [
          46.27394,
          6.48728
        ],
        [
          46.27394,
          6.48726
        ],
        [
          46.27395,
          6.48725
        ],
        [
          46.27396,
          6.48724
        ],
        [
          46.27397,
          6.48723
        ],
        [
          46.27398,
          6.48722
        ],
        [
          46.27401,
          6.48716
        ],
        [
          46.27402,
          6.48714
        ],
        [
          46.27404,
          6.48712
        ],
        [
          46.27406,
          6.48711
        ],
        [
          46.27407,
          6.4871
        ],
        [
          46.27407,
          6.48708
        ],
        [
          46.27408,
          6.48705
        ],
        [
          46.27408,
          6.48704
        ],
        [
          46.2741,
          6.48703
        ],
        [
          46.27412,
          6.48703
        ],
        [
          46.27414,
          6.48703
        ],
        [
          46.27415,
          6.48703
        ],
        [
          46.27416,
          6.48701
        ],
        [
          46.27417,
          6.48699
        ],
        [
          46.27418,
          6.48697
        ],
        [
          46.27418,
          6.48694
        ],
        [
          46.27417,
          6.48692
        ],
        [
          46.27417,
          6.4869
        ],
        [
          46.27414,
          6.48686
        ],
        [
          46.27414,
          6.48685
        ],
        [
          46.27414,
          6.48683
        ],
        [
          46.27414,
          6.48682
        ],
        [
          46.27412,
          6.48681
        ],
        [
          46.27412,
          6.4868
        ],
        [
          46.27413,
          6.48679
        ],
        [
          46.27413,
          6.48678
        ],
        [
          46.27413,
          6.48677
        ],
        [
          46.27413,
          6.48674
        ],
        [
          46.27414,
          6.48671
        ],
        [
          46.27415,
          6.48668
        ],
        [
          46.27416,
          6.48666
        ],
        [
          46.27416,
          6.48665
        ],
        [
          46.27417,
          6.48663
        ],
        [
          46.27418,
          6.48661
        ],
        [
          46.27419,
          6.4866
        ],
        [
          46.2742,
          6.48658
        ],
        [
          46.2742,
          6.48657
        ],
        [
          46.27421,
          6.48655
        ],
        [
          46.27422,
          6.48654
        ],
        [
          46.27423,
          6.48654
        ],
        [
          46.27424,
          6.48653
        ],
        [
          46.27425,
          6.48651
        ],
        [
          46.27425,
          6.48646
        ],
        [
          46.27426,
          6.48642
        ],
        [
          46.2743,
          6.48632
        ],
        [
          46.27432,
          6.48629
        ],
        [
          46.27436,
          6.48623
        ],
        [
          46.27437,
          6.48622
        ],
        [
          46.27438,
          6.4862
        ],
        [
          46.27438,
          6.48617
        ],
        [
          46.27439,
          6.48613
        ],
        [
          46.2744,
          6.48609
        ],
        [
          46.27447,
          6.48597
        ],
        [
          46.27449,
          6.48592
        ],
        [
          46.27451,
          6.48587
        ],
        [
          46.27456,
          6.48572
        ],
        [
          46.27457,
          6.4857
        ],
        [
          46.27457,
          6.48566
        ],
        [
          46.27458,
          6.48561
        ],
        [
          46.27458,
          6.48542
        ],
        [
          46.27458,
          6.48538
        ],
        [
          46.27456,
          6.48527
        ],
        [
          46.27456,
          6.48523
        ],
        [
          46.27457,
          6.4852
        ],
        [
          46.27458,
          6.48518
        ],
        [
          46.27459,
          6.48514
        ],
        [
          46.27458,
          6.48518
        ],
        [
          46.27457,
          6.4852
        ],
        [
          46.27456,
          6.48523
        ],
        [
          46.27456,
          6.48527
        ],
        [
          46.27458,
          6.48538
        ],
        [
          46.27458,
          6.48542
        ],
        [
          46.27458,
          6.48561
        ],
        [
          46.27457,
          6.48566
        ],
        [
          46.27457,
          6.4857
        ],
        [
          46.27456,
          6.48572
        ],
        [
          46.27451,
          6.48587
        ],
        [
          46.27449,
          6.48592
        ],
        [
          46.27447,
          6.48597
        ],
        [
          46.2744,
          6.48609
        ],
        [
          46.27439,
          6.48613
        ],
        [
          46.27438,
          6.48617
        ],
        [
          46.27438,
          6.4862
        ],
        [
          46.27437,
          6.48622
        ],
        [
          46.27436,
          6.48623
        ],
        [
          46.27432,
          6.48629
        ],
        [
          46.2743,
          6.48632
        ],
        [
          46.27426,
          6.48642
        ],
        [
          46.27425,
          6.48646
        ],
        [
          46.27425,
          6.48651
        ],
        [
          46.27424,
          6.48653
        ],
        [
          46.27423,
          6.48654
        ],
        [
          46.27422,
          6.48654
        ],
        [
          46.27421,
          6.48655
        ],
        [
          46.2742,
          6.48657
        ],
        [
          46.2742,
          6.48658
        ],
        [
          46.27419,
          6.4866
        ],
        [
          46.27418,
          6.48661
        ],
        [
          46.27417,
          6.48663
        ],
        [
          46.27416,
          6.48665
        ],
        [
          46.27416,
          6.48666
        ],
        [
          46.27415,
          6.48668
        ],
        [
          46.27414,
          6.48671
        ],
        [
          46.27413,
          6.48674
        ],
        [
          46.27413,
          6.48677
        ],
        [
          46.27413,
          6.48678
        ],
        [
          46.27413,
          6.48679
        ],
        [
          46.27412,
          6.4868
        ],
        [
          46.27412,
          6.48681
        ],
        [
          46.27414,
          6.48682
        ],
        [
          46.27414,
          6.48683
        ],
        [
          46.27414,
          6.48685
        ],
        [
          46.27414,
          6.48686
        ],
        [
          46.27417,
          6.4869
        ],
        [
          46.27417,
          6.48692
        ],
        [
          46.27418,
          6.48694
        ],
        [
          46.27418,
          6.48697
        ],
        [
          46.27417,
          6.48699
        ],
        [
          46.27416,
          6.48701
        ],
        [
          46.27415,
          6.48703
        ],
        [
          46.27414,
          6.48703
        ],
        [
          46.27412,
          6.48703
        ],
        [
          46.2741,
          6.48703
        ],
        [
          46.27408,
          6.48704
        ],
        [
          46.27408,
          6.48705
        ],
        [
          46.27407,
          6.48708
        ],
        [
          46.27407,
          6.4871
        ],
        [
          46.27406,
          6.48711
        ],
        [
          46.27404,
          6.48712
        ],
        [
          46.27402,
          6.48714
        ],
        [
          46.27401,
          6.48716
        ],
        [
          46.27398,
          6.48722
        ],
        [
          46.27397,
          6.48723
        ],
        [
          46.27396,
          6.48724
        ],
        [
          46.27395,
          6.48725
        ],
        [
          46.27394,
          6.48726
        ],
        [
          46.27394,
          6.48728
        ],
        [
          46.27395,
          6.48729
        ],
        [
          46.27398,
          6.48733
        ],
        [
          46.27399,
          6.48734
        ],
        [
          46.27399,
          6.48736
        ],
        [
          46.27398,
          6.48737
        ],
        [
          46.27397,
          6.48738
        ],
        [
          46.27391,
          6.48741
        ],
        [
          46.27391,
          6.48742
        ],
        [
          46.27393,
          6.48744
        ],
        [
          46.27395,
          6.48746
        ],
        [
          46.27395,
          6.48747
        ],
        [
          46.27395,
          6.48748
        ],
        [
          46.27396,
          6.48749
        ],
        [
          46.27397,
          6.4875
        ],
        [
          46.27397,
          6.48751
        ],
        [
          46.27397,
          6.48752
        ],
        [
          46.27395,
          6.48753
        ],
        [
          46.27393,
          6.48753
        ],
        [
          46.2739,
          6.48753
        ],
        [
          46.27388,
          6.48754
        ],
        [
          46.27388,
          6.48755
        ],
        [
          46.27388,
          6.48756
        ],
        [
          46.27388,
          6.48757
        ],
        [
          46.27389,
          6.48757
        ],
        [
          46.2739,
          6.48757
        ],
        [
          46.27391,
          6.48758
        ],
        [
          46.27392,
          6.48761
        ],
        [
          46.27393,
          6.48764
        ],
        [
          46.27395,
          6.48767
        ],
        [
          46.27396,
          6.48769
        ],
        [
          46.27396,
          6.4877
        ],
        [
          46.27397,
          6.48771
        ],
        [
          46.27397,
          6.48772
        ],
        [
          46.27396,
          6.48772
        ],
        [
          46.27394,
          6.48773
        ],
        [
          46.27393,
          6.48774
        ],
        [
          46.27392,
          6.48775
        ],
        [
          46.2739,
          6.48776
        ],
        [
          46.27389,
          6.48777
        ],
        [
          46.27389,
          6.48779
        ],
        [
          46.27388,
          6.4878
        ],
        [
          46.27386,
          6.4878
        ],
        [
          46.27383,
          6.48782
        ],
        [
          46.27383,
          6.48783
        ],
        [
          46.27383,
          6.48784
        ],
        [
          46.27385,
          6.48784
        ],
        [
          46.27385,
          6.48786
        ],
        [
          46.27386,
          6.48787
        ],
        [
          46.27387,
          6.48789
        ],
        [
          46.27389,
          6.4879
        ],
        [
          46.2739,
          6.48791
        ],
        [
          46.27391,
          6.48791
        ],
        [
          46.27391,
          6.48792
        ],
        [
          46.2739,
          6.48793
        ],
        [
          46.27388,
          6.48794
        ],
        [
          46.27387,
          6.48796
        ],
        [
          46.27385,
          6.48798
        ],
        [
          46.27384,
          6.48799
        ],
        [
          46.27383,
          6.488
        ],
        [
          46.27382,
          6.488
        ],
        [
          46.2738,
          6.488
        ],
        [
          46.27378,
          6.488
        ],
        [
          46.27377,
          6.48801
        ],
        [
          46.27371,
          6.48801
        ],
        [
          46.2737,
          6.48805
        ],
        [
          46.27365,
          6.48802
        ],
        [
          46.27361,
          6.48802
        ],
        [
          46.27358,
          6.48803
        ],
        [
          46.27354,
          6.48804
        ],
        [
          46.27352,
          6.48806
        ],
        [
          46.27351,
          6.48807
        ],
        [
          46.2735,
          6.48808
        ],
        [
          46.27349,
          6.4881
        ],
        [
          46.27349,
          6.48812
        ],
        [
          46.27349,
          6.48815
        ],
        [
          46.27349,
          6.48817
        ],
        [
          46.2735,
          6.48819
        ],
        [
          46.27351,
          6.48821
        ],
        [
          46.27353,
          6.48823
        ],
        [
          46.27354,
          6.48824
        ],
        [
          46.27358,
          6.48828
        ],
        [
          46.27362,
          6.48831
        ],
        [
          46.27365,
          6.48833
        ],
        [
          46.27369,
          6.48835
        ],
        [
          46.27372,
          6.48836
        ],
        [
          46.27375,
          6.48836
        ],
        [
          46.27379,
          6.48836
        ],
        [
          46.27382,
          6.48835
        ],
        [
          46.27388,
          6.48834
        ],
        [
          46.27391,
          6.48833
        ],
        [
          46.27395,
          6.48833
        ],
        [
          46.27399,
          6.48834
        ],
        [
          46.27402,
          6.48835
        ],
        [
          46.27406,
          6.48837
        ],
        [
          46.27431,
          6.48852
        ],
        [
          46.27435,
          6.48855
        ],
        [
          46.2744,
          6.48857
        ],
        [
          46.27445,
          6.48859
        ],
        [
          46.27448,
          6.48862
        ],
        [
          46.27463,
          6.48877
        ],
        [
          46.27502,
          6.48918
        ],
        [
          46.27515,
          6.48932
        ],
        [
          46.27519,
          6.48936
        ],
        [
          46.27525,
          6.48938
        ],
        [
          46.27545,
          6.48941
        ],
        [
          46.27553,
          6.48943
        ],
        [
          46.2756,
          6.48946
        ],
        [
          46.27568,
          6.48951
        ],
        [
          46.27595,
          6.4897
        ],
        [
          46.276,
          6.48973
        ],
        [
          46.27608,
          6.48976
        ],
        [
          46.27613,
          6.48978
        ],
        [
          46.2764,
          6.48997
        ],
        [
          46.27646,
          6.49
        ],
        [
          46.27652,
          6.49001
        ],
        [
          46.27669,
          6.49002
        ],
        [
          46.27688,
          6.49002
        ],
        [
          46.27694,
          6.49002
        ],
        [
          46.277,
          6.49004
        ],
        [
          46.27713,
          6.4901
        ],
        [
          46.27718,
          6.49013
        ],
        [
          46.27754,
          6.49037
        ],
        [
          46.27771,
          6.49051
        ],
        [
          46.27777,
          6.49055
        ],
        [
          46.27782,
          6.49057
        ],
        [
          46.27787,
          6.49059
        ],
        [
          46.27792,
          6.49059
        ],
        [
          46.27802,
          6.49058
        ],
        [
          46.27806,
          6.49056
        ],
        [
          46.27807,
          6.49054
        ],
        [
          46.27809,
          6.49051
        ],
        [
          46.2781,
          6.49047
        ],
        [
          46.2781,
          6.49036
        ],
        [
          46.27809,
          6.49026
        ],
        [
          46.27808,
          6.49015
        ],
        [
          46.27808,
          6.49011
        ],
        [
          46.27809,
          6.49008
        ],
        [
          46.27812,
          6.49002
        ],
        [
          46.27814,
          6.49
        ],
        [
          46.27817,
          6.49
        ],
        [
          46.2782,
          6.49001
        ],
        [
          46.27828,
          6.49007
        ],
        [
          46.27854,
          6.49032
        ],
        [
          46.27857,
          6.49035
        ],
        [
          46.27861,
          6.49038
        ],
        [
          46.27863,
          6.49042
        ],
        [
          46.27867,
          6.49045
        ],
        [
          46.27873,
          6.4905
        ],
        [
          46.27881,
          6.49056
        ],
        [
          46.27885,
          6.49059
        ],
        [
          46.27932,
          6.49092
        ],
        [
          46.27941,
          6.49098
        ],
        [
          46.27944,
          6.49101
        ],
        [
          46.27964,
          6.49117
        ],
        [
          46.27972,
          6.49122
        ],
        [
          46.27987,
          6.4913
        ],
        [
          46.27991,
          6.49131
        ],
        [
          46.27996,
          6.49132
        ],
        [
          46.28,
          6.49131
        ],
        [
          46.28003,
          6.4913
        ],
        [
          46.28005,
          6.49127
        ],
        [
          46.28007,
          6.49124
        ],
        [
          46.28007,
          6.4912
        ],
        [
          46.28007,
          6.49112
        ],
        [
          46.28007,
          6.49105
        ],
        [
          46.28004,
          6.49083
        ],
        [
          46.28003,
          6.49076
        ],
        [
          46.28002,
          6.4907
        ],
        [
          46.28,
          6.49062
        ],
        [
          46.28008,
          6.49058
        ],
        [
          46.28013,
          6.49055
        ],
        [
          46.28018,
          6.49053
        ],
        [
          46.28023,
          6.49048
        ],
        [
          46.28029,
          6.49037
        ],
        [
          46.28021,
          6.49028
        ],
        [
          46.28029,
          6.49037
        ],
        [
          46.28048,
          6.49056
        ],
        [
          46.28055,
          6.49063
        ],
        [
          46.28061,
          6.4907
        ],
        [
          46.28067,
          6.49079
        ],
        [
          46.28071,
          6.49085
        ],
        [
          46.28076,
          6.49095
        ],
        [
          46.28081,
          6.49103
        ],
        [
          46.28085,
          6.4911
        ],
        [
          46.28095,
          6.49125
        ],
        [
          46.281,
          6.49133
        ],
        [
          46.28102,
          6.49136
        ],
        [
          46.28104,
          6.49138
        ],
        [
          46.28108,
          6.4914
        ],
        [
          46.28111,
          6.49144
        ],
        [
          46.28114,
          6.49148
        ],
        [
          46.28117,
          6.49157
        ],
        [
          46.2812,
          6.49163
        ],
        [
          46.28124,
          6.49171
        ],
        [
          46.28128,
          6.49178
        ],
        [
          46.28132,
          6.49185
        ],
        [
          46.28144,
          6.49198
        ],
        [
          46.28151,
          6.49207
        ],
        [
          46.28154,
          6.4921
        ],
        [
          46.28156,
          6.49212
        ],
        [
          46.28159,
          6.49213
        ],
        [
          46.28161,
          6.49212
        ],
        [
          46.28163,
          6.4921
        ],
        [
          46.28164,
          6.49207
        ],
        [
          46.28165,
          6.49203
        ],
        [
          46.28165,
          6.49198
        ],
        [
          46.28165,
          6.49169
        ],
        [
          46.28164,
          6.49158
        ],
        [
          46.28145,
          6.49047
        ],
        [
          46.28144,
          6.49039
        ],
        [
          46.28141,
          6.49031
        ],
        [
          46.28127,
          6.48995
        ],
        [
          46.28123,
          6.48987
        ],
        [
          46.28114,
          6.48971
        ],
        [
          46.28111,
          6.48967
        ],
        [
          46.28109,
          6.48964
        ],
        [
          46.28107,
          6.48961
        ],
        [
          46.28107,
          6.48958
        ],
        [
          46.28108,
          6.48955
        ],
        [
          46.2811,
          6.48954
        ],
        [
          46.28112,
          6.48954
        ],
        [
          46.28116,
          6.48955
        ],
        [
          46.28118,
          6.48956
        ],
        [
          46.28123,
          6.4896
        ],
        [
          46.28128,
          6.48963
        ],
        [
          46.2814,
          6.4897
        ],
        [
          46.28145,
          6.48973
        ],
        [
          46.2815,
          6.48978
        ],
        [
          46.28157,
          6.48986
        ],
        [
          46.28161,
          6.4899
        ],
        [
          46.28169,
          6.48998
        ],
        [
          46.28173,
          6.49002
        ],
        [
          46.28187,
          6.49022
        ],
        [
          46.28189,
          6.49025
        ],
        [
          46.28191,
          6.4903
        ],
        [
          46.28195,
          6.49041
        ],
        [
          46.282,
          6.49043
        ],
        [
          46.28203,
          6.49044
        ],
        [
          46.2821,
          6.49044
        ],
        [
          46.28216,
          6.49044
        ],
        [
          46.28237,
          6.49047
        ],
        [
          46.28243,
          6.49048
        ],
        [
          46.28248,
          6.49048
        ],
        [
          46.2826,
          6.4905
        ],
        [
          46.28262,
          6.49051
        ],
        [
          46.28267,
          6.4905
        ],
        [
          46.2827,
          6.4905
        ],
        [
          46.28272,
          6.49049
        ],
        [
          46.28274,
          6.49049
        ],
        [
          46.28276,
          6.49048
        ],
        [
          46.28278,
          6.49046
        ],
        [
          46.2828,
          6.49045
        ],
        [
          46.28282,
          6.49042
        ],
        [
          46.28284,
          6.49039
        ],
        [
          46.28287,
          6.49036
        ],
        [
          46.28294,
          6.49028
        ],
        [
          46.28297,
          6.49025
        ],
        [
          46.283,
          6.49022
        ],
        [
          46.28304,
          6.49016
        ],
        [
          46.28309,
          6.49012
        ],
        [
          46.28311,
          6.4901
        ],
        [
          46.28312,
          6.49007
        ],
        [
          46.28314,
          6.49005
        ],
        [
          46.28319,
          6.49002
        ],
        [
          46.28319,
          6.49006
        ],
        [
          46.28319,
          6.49011
        ],
        [
          46.28319,
          6.49016
        ],
        [
          46.28319,
          6.4902
        ],
        [
          46.28319,
          6.49025
        ],
        [
          46.28325,
          6.49012
        ],
        [
          46.28329,
          6.49003
        ],
        [
          46.28334,
          6.48995
        ],
        [
          46.28339,
          6.48987
        ],
        [
          46.28345,
          6.4898
        ],
        [
          46.28353,
          6.4897
        ],
        [
          46.28356,
          6.48967
        ],
        [
          46.28379,
          6.48948
        ],
        [
          46.28381,
          6.48947
        ],
        [
          46.28383,
          6.48945
        ],
        [
          46.28385,
          6.48943
        ],
        [
          46.28387,
          6.4894
        ],
        [
          46.28393,
          6.48931
        ],
        [
          46.28394,
          6.4893
        ],
        [
          46.28395,
          6.48929
        ],
        [
          46.28396,
          6.48928
        ],
        [
          46.28398,
          6.48928
        ],
        [
          46.28399,
          6.48927
        ],
        [
          46.284,
          6.48927
        ],
        [
          46.28403,
          6.48926
        ],
        [
          46.28404,
          6.48926
        ],
        [
          46.28408,
          6.48926
        ],
        [
          46.28411,
          6.4893
        ],
        [
          46.28413,
          6.48931
        ],
        [
          46.28415,
          6.48934
        ],
        [
          46.28416,
          6.48936
        ],
        [
          46.28415,
          6.48934
        ],
        [
          46.28413,
          6.48931
        ],
        [
          46.28411,
          6.4893
        ],
        [
          46.28408,
          6.48926
        ],
        [
          46.28379,
          6.48894
        ],
        [
          46.28352,
          6.4887
        ],
        [
          46.28346,
          6.48864
        ],
        [
          46.28338,
          6.48855
        ],
        [
          46.28333,
          6.4885
        ],
        [
          46.28314,
          6.48837
        ],
        [
          46.28333,
          6.4885
        ],
        [
          46.28338,
          6.48855
        ],
        [
          46.28346,
          6.48864
        ],
        [
          46.28352,
          6.4887
        ],
        [
          46.28379,
          6.48894
        ],
        [
          46.28408,
          6.48926
        ],
        [
          46.28411,
          6.4893
        ],
        [
          46.28413,
          6.48931
        ],
        [
          46.28415,
          6.48934
        ],
        [
          46.28416,
          6.48936
        ],
        [
          46.28419,
          6.48943
        ],
        [
          46.28421,
          6.48946
        ],
        [
          46.28422,
          6.48948
        ],
        [
          46.28438,
          6.48969
        ],
        [
          46.28442,
          6.48975
        ],
        [
          46.28446,
          6.48982
        ],
        [
          46.2845,
          6.48989
        ],
        [
          46.28453,
          6.48997
        ],
        [
          46.28458,
          6.49015
        ],
        [
          46.28461,
          6.49024
        ],
        [
          46.28465,
          6.49032
        ],
        [
          46.28469,
          6.49039
        ],
        [
          46.28473,
          6.49047
        ],
        [
          46.28482,
          6.4906
        ],
        [
          46.28488,
          6.49069
        ],
        [
          46.285,
          6.49092
        ],
        [
          46.28505,
          6.49099
        ],
        [
          46.28508,
          6.49104
        ],
        [
          46.28511,
          6.49107
        ],
        [
          46.28524,
          6.49125
        ],
        [
          46.28529,
          6.49131
        ],
        [
          46.28531,
          6.49135
        ],
        [
          46.28534,
          6.49139
        ],
        [
          46.28538,
          6.49142
        ],
        [
          46.28548,
          6.49148
        ],
        [
          46.28586,
          6.49172
        ],
        [
          46.28598,
          6.49179
        ],
        [
          46.28612,
          6.49188
        ],
        [
          46.28616,
          6.4919
        ],
        [
          46.28619,
          6.49194
        ]
      ],
      "lat": 46.28619,
      "lng": 6.49194,
      "distance": 5.3,
      "elevation": 250,
      "hours": "2",
      "elevationProfile": [
        {
          "km": 0,
          "elev": 1370
        },
        {
          "km": 0.4,
          "elev": 1347
        },
        {
          "km": 0.8,
          "elev": 1382
        },
        {
          "km": 1.2,
          "elev": 1436
        },
        {
          "km": 1.6,
          "elev": 1500
        },
        {
          "km": 2,
          "elev": 1483
        },
        {
          "km": 2.4,
          "elev": 1444
        },
        {
          "km": 2.8,
          "elev": 1493
        },
        {
          "km": 3.2,
          "elev": 1476
        },
        {
          "km": 3.6,
          "elev": 1474
        },
        {
          "km": 4,
          "elev": 1441
        },
        {
          "km": 4.4,
          "elev": 1371
        },
        {
          "km": 4.8,
          "elev": 1339
        },
        {
          "km": 5.2,
          "elev": 1370
        },
        {
          "km": 5.3,
          "elev": 1370
        }
      ],
      "waterSources": [],
      "rifugi": [
        {
          "km": 0,
          "lat": 46.28551,
          "lng": 6.49179,
          "osmId": "way/316607877",
          "name": "Au Petit Savoyard"
        }
      ],
      "startPoint": {
        "lat": 46.286192,
        "lng": 6.491922,
        "label": "Très-le-Mont car park at the end of the road, Lullin (official summer start)"
      },
      "terrainType": "Grassy alpage tracks and forest paths, a short lane at the start",
      "desc": "A discovery trail across the summer pastures of Très-le-Mont above Lullin, in the Chablais, with numbered markers and panels about life on the alpage, woods and meadows. Much of the way is walked out and back, with a loop at the far end. Officially 5 km and 250 m of climb, about two hours, rated easy. In summer it starts from the car park at the end of the Très-le-Mont road; in winter the road is not cleared and the walk starts at the Col du Feu, an hour further.\n\nDogs must be kept on a lead, according to the official fiche. Cows graze the alpage in summer, according to the tourist office, and the Département's alpage board at the car park sets out the rules for walkers. About half the walk is wooded. There is no tap on the way.",
      "tips": "Keep the lead on: it is the official rule, and cows graze the alpage in summer. Walk round the herd at a distance and keep your dog close and calm; if you meet a guardian dog, stop and let it see you are passing through. Close the gates behind you and step over the cattle grids carefully with your dog. Bring water for both of you; the restaurant at the car park is the only stop.",
      "shadeCoverage": 55,
      "heatRisk": "low",
      "exposure": false,
      "surfaceHazards": [
        "Cattle grids and gates on the track",
        "About 230 m of lane at the car park"
      ],
      "routeNumberSource": {
        "provider": "Alpes du Léman tourist office (Apidae)",
        "name": "Ombres sur l'Alpage, parcours de découverte",
        "url": "https://hautesavoiemontblanc-tourisme.com/offres/ombres-sur-lalpage-parcours-de-decouverte-lullin-fr-5867320/"
      },
      "curated": true,
      "tier": "route-audited",
      "reviewedAt": "2026-10-23",
      "reviewedBy": "ORMA route audit",
      "routeAudit": {
        "photo": "Flickr, Guilhem Vellut, CC BY 2.0, a grass track across the Très-le-Mont alpage, 3 m from the line (replaces a photo of the Mont Forchat ridge).",
        "route": "Line rebuilt on OSM ways along the official GPX: 5.28 km, closed; official 5.0 km (GPX 5.43 km); 96% of GPX points within 25 m.",
        "routeNumbers": "No number: red numbered markers 1 to 10 along the discovery trail; the official text names no switch.",
        "mapPoints": "Start at the official summer car park (Apidae point); no tap on the line.",
        "elevation": "Official 250 m of climb; profile recomputed for the new line."
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
          "Haute-Savoie Mont-Blanc / Alpes du Léman, Ombres sur l'Alpage (Apidae 5867320) and official GPX: dogs must be kept on a lead",
          "Haute-Savoie tourisme, Ombres sur l'Alpage: cows graze the alpage in summer",
          "No Natura 2000 site, park, reserve or biotope order on the line (EEA, INPN); ZNIEFF inventories only",
          "OpenStreetMap ways along the official GPX: rebuilt line, gates, cattle grids, land cover and road classes"
        ],
        "date": "2026-10-23"
      },
      "sourceLinks": [
        {
          "label": "Ombres sur l'Alpage, official fiche",
          "url": "https://hautesavoiemontblanc-tourisme.com/offres/ombres-sur-lalpage-parcours-de-decouverte-lullin-fr-5867320/"
        },
        {
          "label": "Alpes du Léman, Ombres sur l'Alpage",
          "url": "https://www.alpesduleman.com/ombres-sur-l-alpage-parcours-de-decouverte.html"
        },
        {
          "label": "Haute-Savoie tourisme, Ombres sur l'Alpage",
          "url": "https://www.haute-savoie-tourisme.org/nature/itineraires-randonnees/142515-ombres-sur-l-alpage-parcours-de-decouverte"
        },
        {
          "label": "Official GPX (guide for the rebuilt line)",
          "url": "https://www.alpesduleman.com/download?t=prestataire&id=287901&ext=.gpx"
        },
        {
          "label": "OpenStreetMap relation 19064561",
          "url": "https://www.openstreetmap.org/relation/19064561"
        }
      ]
    },
    'osm-5479112': {
      // Hand audit 23 October 2026. The stored OSM line was an 11.6 km loop; the official walk is 8.6 km there and back from Le
      // Buet to Barberine. The line here is rebuilt one way on OpenStreetMap ways along the official GPX (97% of GPX points within
      // 25 m; all points are OSM nodes) and declared out-and-back. Route and dog answer from the Apidae fiche (Office de Tourisme de
      // Chamonix). The Aiguilles Rouges reserve, where dogs are banned, stays 431 m from the line (INPN); no Natura 2000 site on it.
      "area": "Vallorcine",
      "path": [
        [
          46.0191,
          6.92026
        ],
        [
          46.01925,
          6.92015
        ],
        [
          46.01928,
          6.92019
        ],
        [
          46.01931,
          6.92023
        ],
        [
          46.01935,
          6.92025
        ],
        [
          46.01961,
          6.92036
        ],
        [
          46.01971,
          6.9204
        ],
        [
          46.0198,
          6.92046
        ],
        [
          46.01988,
          6.92052
        ],
        [
          46.02,
          6.92063
        ],
        [
          46.02013,
          6.92075
        ],
        [
          46.0202,
          6.92081
        ],
        [
          46.02035,
          6.921
        ],
        [
          46.02057,
          6.92124
        ],
        [
          46.02134,
          6.92211
        ],
        [
          46.02161,
          6.92242
        ],
        [
          46.02169,
          6.92241
        ],
        [
          46.02174,
          6.92237
        ],
        [
          46.02179,
          6.92238
        ],
        [
          46.02197,
          6.9224
        ],
        [
          46.02226,
          6.92252
        ],
        [
          46.02233,
          6.92259
        ],
        [
          46.02243,
          6.92264
        ],
        [
          46.02247,
          6.92265
        ],
        [
          46.02253,
          6.92266
        ],
        [
          46.02259,
          6.92267
        ],
        [
          46.02268,
          6.92269
        ],
        [
          46.02274,
          6.92273
        ],
        [
          46.0228,
          6.92275
        ],
        [
          46.02289,
          6.92277
        ],
        [
          46.023,
          6.92278
        ],
        [
          46.02308,
          6.92279
        ],
        [
          46.0232,
          6.92281
        ],
        [
          46.02327,
          6.92282
        ],
        [
          46.02343,
          6.92282
        ],
        [
          46.0235,
          6.92291
        ],
        [
          46.02356,
          6.92295
        ],
        [
          46.0236,
          6.92299
        ],
        [
          46.02366,
          6.92302
        ],
        [
          46.02385,
          6.92314
        ],
        [
          46.02403,
          6.92324
        ],
        [
          46.02415,
          6.92326
        ],
        [
          46.02432,
          6.92327
        ],
        [
          46.02449,
          6.92327
        ],
        [
          46.02459,
          6.92326
        ],
        [
          46.02463,
          6.92324
        ],
        [
          46.02477,
          6.9232
        ],
        [
          46.02479,
          6.92319
        ],
        [
          46.02481,
          6.92319
        ],
        [
          46.02483,
          6.9232
        ],
        [
          46.02487,
          6.92322
        ],
        [
          46.02495,
          6.92327
        ],
        [
          46.02511,
          6.92336
        ],
        [
          46.02533,
          6.92349
        ],
        [
          46.02541,
          6.92354
        ],
        [
          46.0255,
          6.9236
        ],
        [
          46.02555,
          6.92365
        ],
        [
          46.0256,
          6.9237
        ],
        [
          46.02565,
          6.92377
        ],
        [
          46.02568,
          6.92383
        ],
        [
          46.02573,
          6.92395
        ],
        [
          46.02577,
          6.92402
        ],
        [
          46.0258,
          6.92408
        ],
        [
          46.02595,
          6.92424
        ],
        [
          46.02603,
          6.92431
        ],
        [
          46.02611,
          6.92436
        ],
        [
          46.02616,
          6.92441
        ],
        [
          46.02618,
          6.92442
        ],
        [
          46.02622,
          6.92442
        ],
        [
          46.02626,
          6.92442
        ],
        [
          46.02629,
          6.92443
        ],
        [
          46.02642,
          6.92445
        ],
        [
          46.02643,
          6.92444
        ],
        [
          46.02644,
          6.92441
        ],
        [
          46.02664,
          6.92467
        ],
        [
          46.02666,
          6.9247
        ],
        [
          46.02674,
          6.92481
        ],
        [
          46.02685,
          6.92495
        ],
        [
          46.02691,
          6.92504
        ],
        [
          46.02695,
          6.9251
        ],
        [
          46.02697,
          6.92516
        ],
        [
          46.027,
          6.92524
        ],
        [
          46.02703,
          6.92524
        ],
        [
          46.02708,
          6.92528
        ],
        [
          46.02717,
          6.92535
        ],
        [
          46.02736,
          6.92557
        ],
        [
          46.02753,
          6.92576
        ],
        [
          46.02772,
          6.92602
        ],
        [
          46.02778,
          6.9261
        ],
        [
          46.02784,
          6.92616
        ],
        [
          46.02791,
          6.92616
        ],
        [
          46.02805,
          6.9262
        ],
        [
          46.02821,
          6.92626
        ],
        [
          46.02828,
          6.92625
        ],
        [
          46.0284,
          6.92625
        ],
        [
          46.02848,
          6.92627
        ],
        [
          46.02858,
          6.92635
        ],
        [
          46.02871,
          6.92648
        ],
        [
          46.02887,
          6.92667
        ],
        [
          46.02902,
          6.9268
        ],
        [
          46.02914,
          6.92695
        ],
        [
          46.02923,
          6.92708
        ],
        [
          46.02941,
          6.92738
        ],
        [
          46.02958,
          6.9276
        ],
        [
          46.02965,
          6.9277
        ],
        [
          46.02974,
          6.92781
        ],
        [
          46.02998,
          6.92796
        ],
        [
          46.03002,
          6.92793
        ],
        [
          46.03012,
          6.92798
        ],
        [
          46.03034,
          6.92807
        ],
        [
          46.03054,
          6.92814
        ],
        [
          46.03063,
          6.92817
        ],
        [
          46.03073,
          6.92824
        ],
        [
          46.03084,
          6.92832
        ],
        [
          46.03089,
          6.92837
        ],
        [
          46.0309,
          6.92839
        ],
        [
          46.03104,
          6.92862
        ],
        [
          46.03113,
          6.92875
        ],
        [
          46.03115,
          6.92877
        ],
        [
          46.0312,
          6.92883
        ],
        [
          46.03126,
          6.92888
        ],
        [
          46.03145,
          6.92904
        ],
        [
          46.03153,
          6.92911
        ],
        [
          46.03157,
          6.92914
        ],
        [
          46.03162,
          6.92917
        ],
        [
          46.03168,
          6.92919
        ],
        [
          46.03173,
          6.92921
        ],
        [
          46.03179,
          6.92925
        ],
        [
          46.0319,
          6.92932
        ],
        [
          46.03197,
          6.92938
        ],
        [
          46.03205,
          6.92948
        ],
        [
          46.0321,
          6.92953
        ],
        [
          46.03214,
          6.92957
        ],
        [
          46.03221,
          6.92961
        ],
        [
          46.03226,
          6.92963
        ],
        [
          46.03232,
          6.92964
        ],
        [
          46.0324,
          6.92963
        ],
        [
          46.0325,
          6.92961
        ],
        [
          46.0326,
          6.92958
        ],
        [
          46.03265,
          6.92957
        ],
        [
          46.03268,
          6.92956
        ],
        [
          46.03272,
          6.92958
        ],
        [
          46.03274,
          6.92962
        ],
        [
          46.03278,
          6.92972
        ],
        [
          46.03282,
          6.9298
        ],
        [
          46.03285,
          6.92984
        ],
        [
          46.03288,
          6.92988
        ],
        [
          46.03292,
          6.92992
        ],
        [
          46.03298,
          6.92996
        ],
        [
          46.03304,
          6.92999
        ],
        [
          46.03314,
          6.93003
        ],
        [
          46.03317,
          6.93006
        ],
        [
          46.03321,
          6.9301
        ],
        [
          46.03324,
          6.93015
        ],
        [
          46.03333,
          6.93027
        ],
        [
          46.03337,
          6.93035
        ],
        [
          46.03341,
          6.93043
        ],
        [
          46.03343,
          6.93047
        ],
        [
          46.03346,
          6.93052
        ],
        [
          46.03353,
          6.93064
        ],
        [
          46.03357,
          6.93072
        ],
        [
          46.03361,
          6.93083
        ],
        [
          46.03363,
          6.9309
        ],
        [
          46.03366,
          6.93097
        ],
        [
          46.03369,
          6.93102
        ],
        [
          46.03372,
          6.93106
        ],
        [
          46.03404,
          6.93139
        ],
        [
          46.03413,
          6.93147
        ],
        [
          46.03417,
          6.93149
        ],
        [
          46.03422,
          6.93151
        ],
        [
          46.03429,
          6.93153
        ],
        [
          46.03445,
          6.93159
        ],
        [
          46.03451,
          6.93161
        ],
        [
          46.03476,
          6.93167
        ],
        [
          46.03481,
          6.93167
        ],
        [
          46.03486,
          6.93166
        ],
        [
          46.03491,
          6.93165
        ],
        [
          46.03499,
          6.93164
        ],
        [
          46.03508,
          6.93163
        ],
        [
          46.03517,
          6.93165
        ],
        [
          46.03533,
          6.93168
        ],
        [
          46.0354,
          6.93168
        ],
        [
          46.03573,
          6.93168
        ],
        [
          46.03584,
          6.93168
        ],
        [
          46.0359,
          6.93169
        ],
        [
          46.03596,
          6.93171
        ],
        [
          46.03607,
          6.93175
        ],
        [
          46.03613,
          6.93175
        ],
        [
          46.03617,
          6.93177
        ],
        [
          46.03621,
          6.93178
        ],
        [
          46.0363,
          6.93184
        ],
        [
          46.03639,
          6.93192
        ],
        [
          46.0364,
          6.93193
        ],
        [
          46.03641,
          6.93197
        ],
        [
          46.03641,
          6.93202
        ],
        [
          46.03646,
          6.9322
        ],
        [
          46.03649,
          6.93228
        ],
        [
          46.03651,
          6.93232
        ],
        [
          46.03657,
          6.93245
        ],
        [
          46.03662,
          6.93254
        ],
        [
          46.03666,
          6.93265
        ],
        [
          46.03669,
          6.93271
        ],
        [
          46.03681,
          6.93292
        ],
        [
          46.03686,
          6.933
        ],
        [
          46.03701,
          6.93321
        ],
        [
          46.03711,
          6.93337
        ],
        [
          46.03721,
          6.93351
        ],
        [
          46.03728,
          6.93361
        ],
        [
          46.0374,
          6.93378
        ],
        [
          46.03745,
          6.93384
        ],
        [
          46.0375,
          6.93393
        ],
        [
          46.03762,
          6.93409
        ],
        [
          46.03773,
          6.93428
        ],
        [
          46.03777,
          6.93434
        ],
        [
          46.03781,
          6.93439
        ],
        [
          46.03787,
          6.93445
        ],
        [
          46.03797,
          6.93455
        ],
        [
          46.03821,
          6.9348
        ],
        [
          46.03829,
          6.9349
        ],
        [
          46.03832,
          6.93495
        ],
        [
          46.03837,
          6.93505
        ],
        [
          46.03841,
          6.93514
        ],
        [
          46.03844,
          6.93519
        ],
        [
          46.03849,
          6.93527
        ],
        [
          46.03854,
          6.93534
        ],
        [
          46.03859,
          6.9354
        ],
        [
          46.03868,
          6.93549
        ],
        [
          46.0389,
          6.9357
        ],
        [
          46.03906,
          6.93583
        ],
        [
          46.03911,
          6.93588
        ],
        [
          46.03908,
          6.93593
        ],
        [
          46.03914,
          6.93597
        ],
        [
          46.03943,
          6.93626
        ],
        [
          46.03946,
          6.9363
        ],
        [
          46.03954,
          6.93642
        ],
        [
          46.03959,
          6.9365
        ],
        [
          46.03963,
          6.9366
        ],
        [
          46.03966,
          6.9367
        ],
        [
          46.03969,
          6.93681
        ],
        [
          46.03974,
          6.93707
        ],
        [
          46.03977,
          6.93725
        ],
        [
          46.03987,
          6.9373
        ],
        [
          46.03988,
          6.9374
        ],
        [
          46.03989,
          6.93746
        ],
        [
          46.0399,
          6.93751
        ],
        [
          46.03992,
          6.93759
        ],
        [
          46.03992,
          6.93767
        ],
        [
          46.03993,
          6.93771
        ],
        [
          46.03994,
          6.93775
        ],
        [
          46.03998,
          6.93781
        ],
        [
          46.04004,
          6.93793
        ],
        [
          46.04008,
          6.938
        ],
        [
          46.04013,
          6.93807
        ],
        [
          46.04018,
          6.93811
        ],
        [
          46.04025,
          6.93817
        ],
        [
          46.04031,
          6.93823
        ],
        [
          46.04033,
          6.93824
        ],
        [
          46.04037,
          6.93825
        ],
        [
          46.0404,
          6.93827
        ],
        [
          46.04044,
          6.93827
        ],
        [
          46.0405,
          6.93829
        ],
        [
          46.04058,
          6.93833
        ],
        [
          46.04063,
          6.93835
        ],
        [
          46.04065,
          6.93838
        ],
        [
          46.04066,
          6.93839
        ],
        [
          46.04068,
          6.93842
        ],
        [
          46.0407,
          6.93848
        ],
        [
          46.0407,
          6.93855
        ],
        [
          46.04074,
          6.93861
        ],
        [
          46.04087,
          6.93878
        ],
        [
          46.04096,
          6.93888
        ],
        [
          46.04106,
          6.93896
        ],
        [
          46.04115,
          6.93903
        ],
        [
          46.04123,
          6.93908
        ],
        [
          46.04136,
          6.93915
        ],
        [
          46.04148,
          6.93921
        ],
        [
          46.0417,
          6.9393
        ],
        [
          46.04186,
          6.93936
        ],
        [
          46.04198,
          6.93938
        ],
        [
          46.04213,
          6.93939
        ],
        [
          46.04217,
          6.93939
        ],
        [
          46.04221,
          6.9394
        ],
        [
          46.04226,
          6.93936
        ],
        [
          46.04229,
          6.93936
        ],
        [
          46.04234,
          6.93937
        ],
        [
          46.04238,
          6.93939
        ],
        [
          46.0424,
          6.93941
        ],
        [
          46.04243,
          6.9394
        ],
        [
          46.04248,
          6.93938
        ],
        [
          46.04253,
          6.93935
        ],
        [
          46.04256,
          6.93933
        ],
        [
          46.04261,
          6.93932
        ],
        [
          46.04268,
          6.93929
        ],
        [
          46.04273,
          6.93928
        ],
        [
          46.04283,
          6.93926
        ],
        [
          46.0429,
          6.93925
        ],
        [
          46.04295,
          6.93926
        ],
        [
          46.04301,
          6.93927
        ],
        [
          46.04306,
          6.93928
        ],
        [
          46.04315,
          6.9393
        ],
        [
          46.04319,
          6.93931
        ],
        [
          46.04324,
          6.93935
        ],
        [
          46.04329,
          6.93938
        ],
        [
          46.04349,
          6.93948
        ],
        [
          46.04354,
          6.9395
        ],
        [
          46.0436,
          6.9395
        ],
        [
          46.04363,
          6.9395
        ],
        [
          46.04367,
          6.93953
        ],
        [
          46.0437,
          6.93959
        ],
        [
          46.04375,
          6.93969
        ],
        [
          46.0438,
          6.93974
        ],
        [
          46.04386,
          6.93978
        ],
        [
          46.04392,
          6.93979
        ],
        [
          46.04401,
          6.93979
        ],
        [
          46.04409,
          6.93979
        ],
        [
          46.04416,
          6.93981
        ],
        [
          46.04424,
          6.93986
        ],
        [
          46.0444,
          6.93986
        ],
        [
          46.04449,
          6.93987
        ],
        [
          46.04458,
          6.9399
        ],
        [
          46.04464,
          6.93993
        ],
        [
          46.04473,
          6.93994
        ],
        [
          46.04479,
          6.93997
        ],
        [
          46.04486,
          6.94002
        ],
        [
          46.04493,
          6.94008
        ],
        [
          46.04498,
          6.94015
        ],
        [
          46.04502,
          6.94025
        ],
        [
          46.04508,
          6.94032
        ],
        [
          46.04515,
          6.94038
        ],
        [
          46.04518,
          6.94044
        ],
        [
          46.04522,
          6.94053
        ],
        [
          46.04525,
          6.94061
        ],
        [
          46.0453,
          6.94065
        ],
        [
          46.04535,
          6.94067
        ],
        [
          46.04539,
          6.94067
        ],
        [
          46.04542,
          6.94069
        ],
        [
          46.04545,
          6.94072
        ],
        [
          46.04549,
          6.94076
        ],
        [
          46.04553,
          6.94079
        ],
        [
          46.04564,
          6.94079
        ],
        [
          46.04576,
          6.94082
        ],
        [
          46.04582,
          6.94083
        ],
        [
          46.04588,
          6.94082
        ],
        [
          46.04595,
          6.94082
        ],
        [
          46.04607,
          6.94083
        ],
        [
          46.04615,
          6.94079
        ],
        [
          46.04622,
          6.94076
        ],
        [
          46.0463,
          6.94072
        ],
        [
          46.04636,
          6.9407
        ],
        [
          46.04641,
          6.94069
        ],
        [
          46.04647,
          6.94069
        ],
        [
          46.04651,
          6.94071
        ],
        [
          46.04658,
          6.94076
        ],
        [
          46.04661,
          6.94078
        ],
        [
          46.04664,
          6.9408
        ],
        [
          46.04666,
          6.94084
        ],
        [
          46.04671,
          6.94092
        ],
        [
          46.04674,
          6.94094
        ],
        [
          46.04679,
          6.94097
        ],
        [
          46.04689,
          6.94103
        ],
        [
          46.04691,
          6.94104
        ],
        [
          46.04694,
          6.94103
        ],
        [
          46.04698,
          6.94103
        ],
        [
          46.04701,
          6.94104
        ],
        [
          46.04704,
          6.94105
        ],
        [
          46.04708,
          6.94104
        ],
        [
          46.04712,
          6.94104
        ],
        [
          46.04716,
          6.94106
        ],
        [
          46.04719,
          6.94107
        ],
        [
          46.04722,
          6.94108
        ],
        [
          46.04726,
          6.9411
        ],
        [
          46.0473,
          6.94111
        ],
        [
          46.04736,
          6.94113
        ],
        [
          46.0474,
          6.94115
        ],
        [
          46.04746,
          6.94117
        ],
        [
          46.04755,
          6.94123
        ],
        [
          46.04763,
          6.94129
        ],
        [
          46.0477,
          6.94135
        ],
        [
          46.04776,
          6.94141
        ],
        [
          46.0478,
          6.94147
        ],
        [
          46.04788,
          6.94159
        ],
        [
          46.04795,
          6.94168
        ],
        [
          46.04797,
          6.94172
        ],
        [
          46.048,
          6.94179
        ],
        [
          46.04804,
          6.94187
        ],
        [
          46.04808,
          6.94192
        ],
        [
          46.04811,
          6.94195
        ],
        [
          46.04814,
          6.94198
        ],
        [
          46.0482,
          6.94201
        ],
        [
          46.04826,
          6.94204
        ],
        [
          46.04832,
          6.94205
        ],
        [
          46.04838,
          6.94205
        ],
        [
          46.04845,
          6.94203
        ],
        [
          46.04851,
          6.94202
        ],
        [
          46.04859,
          6.94201
        ],
        [
          46.04866,
          6.942
        ],
        [
          46.04882,
          6.94198
        ],
        [
          46.04889,
          6.94198
        ],
        [
          46.04898,
          6.94199
        ],
        [
          46.04905,
          6.94202
        ],
        [
          46.04909,
          6.94203
        ],
        [
          46.04913,
          6.94202
        ],
        [
          46.04916,
          6.942
        ],
        [
          46.04918,
          6.94197
        ],
        [
          46.0492,
          6.94195
        ],
        [
          46.04921,
          6.94194
        ],
        [
          46.04928,
          6.94189
        ],
        [
          46.04933,
          6.94186
        ],
        [
          46.04935,
          6.94183
        ],
        [
          46.04937,
          6.94181
        ],
        [
          46.04939,
          6.94175
        ],
        [
          46.04942,
          6.94172
        ],
        [
          46.04947,
          6.94168
        ],
        [
          46.04956,
          6.94159
        ],
        [
          46.04958,
          6.94156
        ],
        [
          46.04962,
          6.94155
        ],
        [
          46.04967,
          6.94154
        ],
        [
          46.04976,
          6.94153
        ],
        [
          46.04985,
          6.94152
        ],
        [
          46.04996,
          6.9415
        ],
        [
          46.05001,
          6.94152
        ],
        [
          46.05013,
          6.94154
        ],
        [
          46.05021,
          6.94155
        ],
        [
          46.05026,
          6.94156
        ],
        [
          46.05033,
          6.94156
        ],
        [
          46.05036,
          6.94156
        ],
        [
          46.05039,
          6.94155
        ],
        [
          46.05046,
          6.94149
        ]
      ],
      "lat": 46.0191,
      "lng": 6.92026,
      "distance": 8.6,
      "elevation": 220,
      "hours": "3.5",
      "routeShape": "out-and-back",
      "routeShapeNote": "Official route: Le Buet to Barberine and back by the same way, 8.6 km (Apidae fiche, 'Aller / Retour'). The line is traced one way, 4.2 km, along the official GPX.",
      "elevationProfile": [
        {
          "km": 0,
          "elev": 1341
        },
        {
          "km": 0.3,
          "elev": 1322
        },
        {
          "km": 0.6,
          "elev": 1299
        },
        {
          "km": 1,
          "elev": 1306
        },
        {
          "km": 1.3,
          "elev": 1302
        },
        {
          "km": 1.6,
          "elev": 1302
        },
        {
          "km": 1.9,
          "elev": 1288
        },
        {
          "km": 2.2,
          "elev": 1282
        },
        {
          "km": 2.5,
          "elev": 1277
        },
        {
          "km": 2.9,
          "elev": 1248
        },
        {
          "km": 3.2,
          "elev": 1242
        },
        {
          "km": 3.5,
          "elev": 1208
        },
        {
          "km": 3.8,
          "elev": 1224
        },
        {
          "km": 4.1,
          "elev": 1177
        },
        {
          "km": 4.2,
          "elev": 1177
        }
      ],
      "waterSources": [
        {
          "km": 0,
          "lat": 46.0194849,
          "lng": 6.9194819,
          "osmId": "node/7881985308",
          "label": "Drinking water (OSM-verified location)"
        },
        {
          "km": 0.5,
          "lat": 46.023705,
          "lng": 6.924481,
          "osmId": "node/3693702697",
          "label": "Drinking water (OSM-verified location)"
        },
        {
          "km": 0.8,
          "lat": 46.026682,
          "lng": 6.9246573,
          "osmId": "node/3079977577",
          "label": "Drinking water (OSM-verified location)"
        },
        {
          "km": 0.8,
          "lat": 46.0265321,
          "lng": 6.9244714,
          "osmId": "node/4294180289",
          "label": "Drinking water (OSM-verified location)"
        },
        {
          "km": 0.8,
          "lat": 46.0264982,
          "lng": 6.9240252,
          "osmId": "node/7881985301",
          "label": "Drinking water (OSM-verified location)"
        },
        {
          "km": 2,
          "lat": 46.0348356,
          "lng": 6.9331905,
          "osmId": "node/5037193987",
          "label": "Drinking water (OSM-verified location)"
        },
        {
          "km": 2.1,
          "lat": 46.0364436,
          "lng": 6.9319985,
          "osmId": "node/3693702713",
          "label": "Drinking water (OSM-verified location)"
        },
        {
          "km": 2.6,
          "lat": 46.0393347,
          "lng": 6.9369315,
          "osmId": "node/13095057016",
          "label": "Drinking water (OSM-verified location)"
        },
        {
          "km": 2.8,
          "lat": 46.0411524,
          "lng": 6.9380304,
          "osmId": "node/3667756211",
          "label": "Drinking water (OSM-verified location)"
        },
        {
          "km": 2.8,
          "lat": 46.0409646,
          "lng": 6.937852,
          "osmId": "node/3693702724",
          "label": "Drinking water (OSM-verified location)"
        },
        {
          "km": 2.9,
          "lat": 46.0413418,
          "lng": 6.9381162,
          "osmId": "node/3667756213",
          "label": "Drinking water (OSM-verified location)"
        },
        {
          "km": 4,
          "lat": 46.0503303,
          "lng": 6.942261,
          "osmId": "node/5316547936",
          "label": "Drinking water (OSM-verified location)"
        },
        {
          "km": 4,
          "lat": 46.0502451,
          "lng": 6.9419459,
          "osmId": "node/5316547937",
          "label": "Drinking water (OSM-verified location)"
        },
        {
          "km": 4,
          "lat": 46.0499933,
          "lng": 6.9420163,
          "osmId": "node/5316547938",
          "label": "Drinking water (OSM-verified location)"
        }
      ],
      "rifugi": [
        {
          "km": 0,
          "lat": 46.01951,
          "lng": 6.91934,
          "osmId": "node/3693702668",
          "name": "Le Buet"
        },
        {
          "km": 0,
          "lat": 46.01877,
          "lng": 6.9196,
          "osmId": "node/9935441917",
          "name": "L’ail des ours"
        },
        {
          "km": 0,
          "lat": 46.01974,
          "lng": 6.91998,
          "osmId": "node/13071197428",
          "name": "Moon Tines"
        },
        {
          "km": 0,
          "lat": 46.01948,
          "lng": 6.91929,
          "osmId": "way/63751921",
          "name": "Le Buet"
        },
        {
          "km": 1.2,
          "lat": 46.02962,
          "lng": 6.92859,
          "osmId": "node/2115613875",
          "name": "La Ferme des 3 Ours"
        },
        {
          "km": 1.7,
          "lat": 46.0324,
          "lng": 6.93261,
          "osmId": "node/7779154087",
          "name": "L’Arrêt Bougnette"
        },
        {
          "km": 1.9,
          "lat": 46.03379,
          "lng": 6.93378,
          "osmId": "node/7881985307",
          "name": "Dormio - L'Ours Bleu"
        },
        {
          "km": 1.9,
          "lat": 46.03225,
          "lng": 6.93344,
          "osmId": "way/376650279",
          "name": "Le Café Comptoir"
        }
      ],
      "startPoint": {
        "lat": 46.019307,
        "lng": 6.920294,
        "label": "Le Buet station and car park, Vallorcine (official start)"
      },
      "terrainType": "Meadow paths and old lanes through the hamlets, short road stretches",
      "desc": "The old coaching road of the Vallorcine valley, walked from Le Buet down to Barberine and back the same way. From behind the station at Plan-Envers it follows the railway through meadows, then strings together the hamlets of Le Nant, Le Morzay, Plan-Droit, Le Crot, Sizeray and Le Mollard, with their stone and timber chalets. Officially 8.6 km there and back, about 3h30, rated easy; signposted as the Chemin des Diligences.\n\nDogs are accepted, according to the official fiche. Vallorcine publishes no dog order, so the national rule applies: a lead in woods and fields off the paths from 15 April to 30 June. The walk stays outside the Aiguilles Rouges nature reserve, where dogs are banned, but the reserve starts about 400 m from Le Buet. About 300 m follows or crosses the D1506.",
      "tips": "Do not head up into the Aiguilles Rouges from Le Buet with your dog: dogs are banned in the nature reserve, even on a lead. On this walk, keep your dog close on the D1506 stretches near Le Nant and Barberine, and on a lead past the hamlet meadows, which may be grazed. Fountains are frequent in the hamlets. Side paths to La Villaz, Loriaz and the Col de la Terrasse leave from Sizeray; stay on the Diligences signs. The fiche notes that access depends on snow and weather.",
      "shadeCoverage": 20,
      "heatRisk": "moderate",
      "exposure": false,
      "surfaceHazards": [
        "About 300 m on or across the D1506",
        "Village lanes through the hamlets"
      ],
      "routeNumberSource": {
        "provider": "Office de Tourisme de la Vallée de Chamonix-Mont-Blanc (Apidae)",
        "name": "Le chemin des Diligences",
        "url": "https://hautesavoiemontblanc-tourisme.com/offres/le-chemin-des-diligences-vallorcine-fr-5868893/"
      },
      "curated": true,
      "tier": "route-audited",
      "reviewedAt": "2026-10-23",
      "reviewedBy": "ORMA route audit",
      "routeAudit": {
        "photo": "Commons, Rémih, CC BY-SA 4.0, a grassy lane between stone chalets at Les Montets, 2 m from the line (replaces a photo 1.6 km away).",
        "route": "Line rebuilt one way on OSM ways along the official GPX: 4.17 km against the GPX's 4.27 km; walked there and back, 8.6 km officially. 97% of GPX points within 25 m; one 370 m stretch near Barberine follows the road bend up to 75 m from the GPX.",
        "routeNumbers": "No number: municipal signposts read 'Chemin des Diligences'; side routes to La Villaz, Loriaz and the Col de la Terrasse at Sizeray.",
        "mapPoints": "Start at the official Le Buet point; fountains traced to OSM along the new line.",
        "elevation": "About 220 m of climb there and back, measured on terrain data; the fiche gives none."
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
          "Office de Tourisme de la Vallée de Chamonix-Mont-Blanc, Le chemin des Diligences (Apidae 668163) and official GPX: aller / retour 8.6 km, animals accepted",
          "Décret du 27 janvier 2010, Réserve naturelle nationale des Aiguilles Rouges: dogs banned inside (Art. 4); the line stays 431 m outside (INPN)",
          "No Natura 2000 site on the line (EEA); Vallorcine publishes no dog order; arrêté du 16 mars 1955 (national baseline)",
          "OpenStreetMap ways along the official GPX: rebuilt line, road classes, land cover and water"
        ],
        "date": "2026-10-23"
      },
      "sourceLinks": [
        {
          "label": "Le chemin des Diligences, official fiche",
          "url": "https://hautesavoiemontblanc-tourisme.com/offres/le-chemin-des-diligences-vallorcine-fr-5868893/"
        },
        {
          "label": "Official GPX (guide for the rebuilt line)",
          "url": "https://static.apidae-tourisme.com/filestore/objets-touristiques/plans/40/204/4181032/Chemin+des+Diligences.gpx"
        },
        {
          "label": "Aiguilles Rouges reserve decree (dogs banned inside)",
          "url": "https://aida.ineris.fr/reglementation/decret-270110-portant-reclassement-reserve-naturelle-nationale-aiguilles-rouges"
        },
        {
          "label": "Arrêté du 16 mars 1955 (national baseline)",
          "url": "https://aida.ineris.fr/reglementation/arrete-160355-divagation-chiens"
        },
        {
          "label": "OpenStreetMap relation 5479112",
          "url": "https://www.openstreetmap.org/relation/5479112"
        }
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
