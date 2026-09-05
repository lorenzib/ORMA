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

  if (typeof trails === 'undefined' || !Array.isArray(trails)) return;

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
          'Les Karellis — Randonnée vers Albanne',
          'AllTrails — Les Karellis–Albanne',
          'Service Public France — dogs in forests',
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
          label: 'Les Karellis — Randonnée vers Albanne (official route 09)',
          url: 'https://www.karellis.com/activites-hiver/randonnee-vers-albanne/',
          categories: ['heat']
        },
        {
          label: 'AllTrails — Les Karellis–Albanne',
          url: 'https://www.alltrails.com/trail/france/savoie/les-karellis-albanne',
          categories: ['access']
        },
        {
          label: 'Service Public France — seasonal forest leash rule',
          url: 'https://www.service-public.gouv.fr/particuliers/actualites/A17343',
          categories: ['access']
        },
        {
          label: 'Waymarked Trails — Albanne, OSM relation 14381570',
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
      // the importer elevation estimate; dog rules for the Laugen protected
      // biotope remain unresolved, so this trail stays under review.
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
      reviewedAt: '2026-07-26',
      reviewedBy: 'ORMA route audit',
      routeAudit: {
        photo: 'No reusable trail photograph is used; the official board image is retained only as a source, not copied.',
        route: 'Closed OSM relation checked against the official Laugen–Elvas overview board; the official board lists a 4.2 km circuit.',
        routeNumbers: 'Bezirksgemeinschaft Eisacktal describes this circuit by name only, with no numbered waymark and no numbered switch, so the named-only statement stands in place of trail-number guidance.',
        mapPoints: 'Two water points and the suggested start were traced to exact source coordinates.',
        elevation: 'Profile present and scaled to 4.2 km; headline ascent corrected from the sampled 181 m to the official 100 m.'
      },
      graduation: {
        status: 'in-progress',
        required: ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'],
        completed: ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards'],
        blockers: {
          access: 'The official route crosses the protected Laugen biotope but the available route material does not state the dog-access or leash rule for this specific reserve.'
        }
      },
      verified: {
        categories: ['water', 'heat', 'exposure', 'livestock', 'surfaceHazards'],
        sources: [
          'Bezirksgemeinschaft Eisacktal — Rundweg Laugen Elvas',
          'Official Laugen–Elvas overview board',
          'South Tyrol nature portal — protected biotopes',
          'OpenStreetMap relation 12731853 and mapped water nodes'
        ],
        date: '2026-07-26'
      },
      shadeCoverage: 20,
      heatRisk: 'moderate',
      exposure: false,
      surfaceHazards: [],
      shadeDescription: 'The official description places most of the route in an intensively cultivated landscape, with a smaller reed-fringed pond and riparian-woodland section.',
      terrainDescription: 'The mapped circuit mixes paved, unpaved, gravel and natural-ground sections; neither the official board nor OSM records an alpine-grade or equipped section.',
      waterDescription: 'Two drinking-water points are mapped near Elvas at exact coordinates; one is marked seasonal. Availability can change, so carry a backup supply.',
      dogNotes: 'Dog access for the protected Laugen biotope is not yet confirmed. Keep your dog leashed, stay on the marked route and check the posted reserve rules before entering.',
      tips: 'The official circuit starts in Elvas and visits the Laugen wetland and its information stations. The route is 4.2 km with about 100 m ascent and takes roughly 1½ hours.',
      sourceLinks: [
        {
          label: 'Bezirksgemeinschaft Eisacktal — Rundweg Laugen Elvas',
          url: 'https://www.bzgeisacktal.it/de/Rundweg_Laugen_Elvas'
        },
        {
          label: 'Official Laugen–Elvas overview board',
          url: 'https://www.bzgeisacktal.it/system/web/GetDocument.ashx?cts=1535713140&fileId=1000136'
        },
        {
          label: 'South Tyrol nature portal — protected biotopes',
          url: 'https://natur-raum.provinz.bz.it/de/biotope'
        },
        {
          label: 'Waymarked Trails — OSM relation 12731853',
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
      // replace noisy terrain-sampling figures. Dog rules remain unresolved.
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
      reviewedAt: '2026-07-26',
      reviewedBy: 'ORMA route audit',
      routeAudit: {
        photo: 'No reusable trail photograph is used; source-page images are not copied.',
        route: 'Closed OSM relation checked against CAI Lozzo route 5 and its published map; the official description lists a 3 km loop.',
        mapPoints: 'No water, hut or food point is mapped on the loop; the mapped route start retains exact coordinates.',
        elevation: 'Profile present and scaled to 3 km; headline ascent corrected from the sampled 422 m to the official 250 m.'
      },
      graduation: {
        status: 'in-progress',
        required: ['photo', 'route', 'routeNumbers', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'livestock', 'surfaceHazards', 'access'],
        completed: ['photo', 'route', 'mapPoints', 'elevation', 'water', 'heat', 'exposure', 'surfaceHazards'],
        blockers: {
          routeNumbers: 'Verify the ordered trail-number guidance and every numbered switch, or an authoritative named-only/no-switch statement.',
          livestock: 'The available official route material does not address current livestock or guardian-dog conditions.',
          access: 'The available official route material does not state a route-specific dog-access or leash rule.'
        }
      },
      verified: {
        categories: ['water', 'heat', 'exposure', 'surfaceHazards'],
        sources: [
          'CAI Lozzo di Cadore — Anelli e Vie route descriptions',
          'Lozzo di Cadore — Anello del Sole route page and map',
          'OpenStreetMap relation 7548344'
        ],
        date: '2026-07-26'
      },
      shadeCoverage: 40,
      heatRisk: 'moderate',
      exposure: false,
      surfaceHazards: [],
      shadeDescription: 'The official description records pine, juniper, larch and spruce along the first climb, followed by a more open view beyond Lago d’Aosto.',
      terrainDescription: 'The marked loop climbs gently toward Lago d’Aosto on mostly natural ground. The official description rates the wider route collection E and names no equipped or alpine-grade section on route 5.',
      waterDescription: 'No drinking-water point is mapped on the loop. Carry a full supply; the marsh at Lago d’Aosto is not a drinking source.',
      dogNotes: 'Route-specific dog access and livestock conditions are not yet confirmed. Keep your dog leashed, stay on the green-and-white route 5 markings and check local signs.',
      tips: 'Start at Niante Aze outside Lozzo and follow route 5 toward Lago d’Aosto. The official route is about 3 km with 250 m ascent; carry all water you need.',
      sourceLinks: [
        {
          label: 'Lozzo di Cadore — Anello del Sole',
          url: 'https://www.lozzodicadore.eu/sito/node/183'
        },
        {
          label: 'CAI Lozzo di Cadore — Anelli e Vie route descriptions',
          url: 'https://www.lozzodicadore.eu/doc/pieghevoli/anelli-di-lozzo-di-cadore-descrizione.pdf'
        },
        {
          label: 'Lozzo di Cadore — route map',
          url: 'https://www.lozzodicadore.eu/doc/pieghevoli/anelli-di-lozzo-di-cadore-carta-25000.pdf'
        },
        {
          label: 'Waymarked Trails — OSM relation 7548344',
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
    }
  };

  trails.forEach((trail) => {
    const audit = audits[trail.id];
    if (audit) Object.assign(trail, audit);
  });
})();
