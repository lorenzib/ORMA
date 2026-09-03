const trails = [
  {
    id:'alpe-siusi', name:'Alpe di Siusi Meadow Loop', area:'Alpe di Siusi / Seiser Alm', lat:46.5402, lng:11.6181,
    path:[[46.54017,11.61807],[46.54019,11.61838],[46.53977,11.61874],[46.53957,11.61881],[46.53918,11.61869],[46.53878,11.61821],[46.53823,11.61807],[46.53816,11.61851],[46.53824,11.61941],[46.53854,11.62092],[46.5384,11.62129],[46.53846,11.62179],[46.5384,11.62283],[46.53805,11.62374],[46.53774,11.62393],[46.53751,11.62387],[46.53718,11.62296],[46.53678,11.6222],[46.53648,11.62173],[46.53627,11.62171],[46.53618,11.62193],[46.53613,11.62326],[46.53548,11.62397],[46.53436,11.62685],[46.53321,11.62805],[46.53284,11.62909],[46.53231,11.62959],[46.53198,11.62956],[46.53204,11.62982],[46.53248,11.63043],[46.53313,11.63206],[46.53314,11.63314],[46.53348,11.6342],[46.53384,11.63598],[46.53412,11.63791],[46.5342,11.63962],[46.53452,11.64108],[46.53491,11.6414],[46.53526,11.64243],[46.53533,11.64364],[46.53608,11.64493],[46.53627,11.64507],[46.5365,11.64502],[46.53669,11.64477],[46.53683,11.64326],[46.53732,11.64238],[46.53779,11.64117],[46.53889,11.63965],[46.53929,11.63831],[46.53993,11.63692],[46.54065,11.63455],[46.54078,11.63357],[46.54115,11.63223],[46.54111,11.63076],[46.54142,11.63037],[46.54113,11.63045],[46.54137,11.62937],[46.54111,11.62839],[46.54109,11.62757],[46.5408,11.627],[46.5408,11.62601],[46.54063,11.62544],[46.54054,11.62414],[46.54064,11.6239],[46.54101,11.62363],[46.54115,11.62197],[46.54104,11.62116],[46.54065,11.62],[46.54055,11.61933],[46.54021,11.61924],[46.54017,11.61807]],
    distance:7.5, elevation:150, hours:'2–2.5', paid:false,
    terrainType:'Wide gravel & paved paths', terrainRank:0,
    elevationProfile:[{km:0, elev:1850}, {km:2, elev:1800}, {km:4, elev:1900}, {km:6, elev:1950}, {km:7.5, elev:1850}],
    surfaceHazards:[], shadeCoverage:20, heatRisk:'moderate', safetyLevel:'low-risk', exposure:false,
    waterSources:[{km:0,label:'Compatsch trailhead fountain'}],
    startPoint:{lat:46.5402,lng:11.6181,label:'Start here — Compatsch, main gondola station and trailhead'},
    decisionPoints:[
      {km:2.31,lat:46.5321524,lng:11.6295947,instruction:"Switch from trail 7 onto trail 6"},
      {km:4.23,lat:46.5366853,lng:11.6447916,instruction:"Switch from trail 6 onto trail 30"}
    ],
    rifugi:[],
    desc:"A real, GPS-verified loop from Compatsch using trails 7, 6, and 30 — confirmed by multiple independent hiking guides as wide gravel and paved paths, suitable even for all-terrain strollers. Europe's largest high-alpine meadow, gently rolling and wide open.",
    tips:"Multiple entry points; go early to find free parking, or take the cable car up from Ortisei/Siusi. This loop skips the longer Saltria detour some guides include via trail 9 — it's the shorter, easier variant of that bigger circuit."
  },
  {
    id:'seceda', name:'Seceda Ridge Trail', area:'Val Gardena', lat:46.599, lng:11.68,
    reviewedAt:'2026-07-17', reviewedBy:'ORMA desk review',
    source:'https://www.seceda.it/en/',
    sourceLinks:[
      {label:'Seceda Cableways — summer access and dog ticket',url:'https://www.seceda.it/en/',categories:['access']},
      {label:'Seceda official hiking map — leash and herd guidance',url:'https://www.seceda.it/files/wanderkarte_web.pdf',categories:['access','livestock']},
      {label:'Val Gardena — ways to reach Seceda',url:'https://www.valgardena.it/en/summer-holidays-dolomites/trekking/seceda/the-way-to-the-seceda/',categories:['access']}
    ],
    verified:{categories:['livestock','access'],sources:['Seceda Cableways','Seceda official hiking map','Dolomites Val Gardena'],date:'2026-07-17'},
    path:[[46.59794,11.72435],[46.59779,11.72446],[46.59827,11.72526],[46.59851,11.72591],[46.59901,11.72793],[46.5997,11.73005],[46.59985,11.73482],[46.59991,11.73466],[46.60007,11.73464],[46.60059,11.73511],[46.60068,11.73499],[46.60083,11.73536],[46.60102,11.73541],[46.6011,11.7359],[46.60169,11.73498],[46.60194,11.7351],[46.60185,11.7352],[46.60207,11.73534],[46.60206,11.73555],[46.60191,11.73569],[46.60196,11.73593],[46.60209,11.73598],[46.60211,11.73589],[46.60217,11.73597],[46.60228,11.73576],[46.60235,11.73581],[46.60274,11.73562],[46.60286,11.73586],[46.60303,11.73687],[46.60322,11.73713],[46.60329,11.73701],[46.60335,11.73712],[46.60338,11.73689],[46.60355,11.73709],[46.60363,11.73674],[46.60376,11.73696],[46.60382,11.73669],[46.60394,11.73692],[46.60402,11.73658],[46.60414,11.73683],[46.60419,11.73659],[46.60431,11.73677],[46.60435,11.73658],[46.60442,11.7367],[46.60481,11.73533],[46.60531,11.73452],[46.60539,11.73458],[46.60545,11.73449],[46.60548,11.73457],[46.60553,11.73447],[46.60557,11.73457],[46.6058,11.73379],[46.60594,11.73256],[46.60588,11.73195],[46.60601,11.73125],[46.60588,11.73112],[46.60593,11.73052],[46.60627,11.72988],[46.60639,11.72937],[46.60702,11.72852],[46.60734,11.72818],[46.6078,11.72824],[46.60792,11.72741],[46.60823,11.72658],[46.60831,11.72657],[46.60829,11.72627],[46.60841,11.72602],[46.60853,11.72597],[46.60866,11.72726],[46.60894,11.7278],[46.6095,11.72795],[46.60969,11.7278],[46.60996,11.7273],[46.61033,11.72716],[46.60996,11.7273],[46.60969,11.7278],[46.6095,11.72795],[46.60894,11.7278],[46.60866,11.72726],[46.60853,11.72597],[46.60841,11.72602],[46.60829,11.72627],[46.60831,11.72657],[46.60823,11.72658],[46.60792,11.72741],[46.6078,11.72824],[46.60734,11.72818],[46.60702,11.72852],[46.60639,11.72937],[46.60627,11.72988],[46.60593,11.73052],[46.60588,11.73112],[46.60601,11.73125],[46.60588,11.73195],[46.60594,11.73256],[46.60579,11.73388],[46.60557,11.73457],[46.60553,11.73447],[46.60548,11.73457],[46.60545,11.73449],[46.60539,11.73458],[46.60531,11.73452],[46.60481,11.73533],[46.60442,11.7367],[46.60435,11.73658],[46.60431,11.73677],[46.60419,11.73659],[46.60414,11.73683],[46.60402,11.73658],[46.60394,11.73692],[46.60382,11.73669],[46.60376,11.73696],[46.60363,11.73674],[46.60355,11.73709],[46.60338,11.73689],[46.60335,11.73712],[46.60329,11.73701],[46.60322,11.73713],[46.60303,11.73687],[46.60286,11.73586],[46.60274,11.73562],[46.60235,11.73581],[46.60228,11.73576],[46.60217,11.73597],[46.60211,11.73589],[46.60209,11.73598],[46.60196,11.73593],[46.60191,11.73569],[46.60206,11.73555],[46.60207,11.73534],[46.60185,11.7352],[46.60194,11.7351],[46.60169,11.73498],[46.6011,11.7359],[46.60102,11.73541],[46.60083,11.73536],[46.60068,11.73499],[46.60059,11.73511],[46.60007,11.73464],[46.59991,11.73466],[46.59985,11.73482],[46.59973,11.73205],[46.59989,11.73506],[46.59969,11.73721],[46.59981,11.73801],[46.59971,11.73794],[46.59973,11.73828],[46.59964,11.73838],[46.59938,11.73822],[46.59915,11.7379],[46.59901,11.73796],[46.59891,11.73817],[46.59874,11.73807],[46.5984,11.73848],[46.59813,11.73926],[46.59794,11.73949],[46.59813,11.73926],[46.5984,11.73848],[46.59874,11.73807],[46.59891,11.73817],[46.59901,11.73796],[46.59915,11.7379],[46.59945,11.73829],[46.59971,11.73836],[46.59971,11.73794],[46.59981,11.73801],[46.59969,11.73721],[46.59989,11.73506],[46.5998,11.73438],[46.5997,11.73005],[46.59901,11.72793],[46.59851,11.72591],[46.59827,11.72526],[46.59779,11.72446],[46.59794,11.72435]],
    startPoint:{lat:46.59794,lng:11.72435,label:'Start here — Seceda cable car mountain station'},
    decisionPoints:[
      {km:0.7,lat:46.59973,lng:11.73205,instruction:"Fork on the ridge path: continue north-east along the rim; the right-hand branch dropping toward Baita Troier is your return route"}
    ],
    distance:8, elevation:550, hours:'3–4', paid:true,
    terrainType:'Packed dirt with rocky steps', terrainRank:1,
    elevationProfile:[{km:0, elev:2426}, {km:1.6, elev:2270}, {km:3.2, elev:2040}, {km:4.8, elev:2230}, {km:5.5, elev:2420}, {km:6.5, elev:2280}, {km:8, elev:2426}],
    surfaceHazards:['Rocky steps near the ridge'], shadeCoverage:10, heatRisk:'high', safetyLevel:'moderate', exposure:false,
    waterSources:[{km:0,label:'Gondola station fountain',lat:46.59794,lng:11.72435}],
    rifugi:[{km:6.5,name:'Baita Troier',lat:46.59794,lng:11.73949}],
    desc:"Sweeping ridge views over Val Gardena. From the cable-car mountain station the route follows the panoramic rim path north-east above the Val di Funes cliffs to a quieter saddle viewpoint, then returns beneath the Fermeda towers past Baita Troier.",
    tips:"Dogs must stay on lead. Keep a safe distance from grazing herds. The Seceda lifts accept dogs for a separate ticket; check the operator's current conditions before travel."
  },
  {
    id:'santa-maddalena', name:'Santa Maddalena Viewpoint', area:'Val di Funes', lat:46.6423, lng:11.7174,
    path:[[46.64082,11.71624],[46.64079,11.71616],[46.6409,11.71646],[46.64112,11.71647],[46.64171,11.71617],[46.64195,11.71623],[46.64223,11.71647],[46.64262,11.71711],[46.64292,11.71721],[46.64342,11.71835],[46.64362,11.71826],[46.64355,11.71768],[46.64364,11.71667],[46.64386,11.71645],[46.6441,11.71653],[46.64461,11.71957],[46.64468,11.71973],[46.64478,11.71974],[46.64465,11.71984],[46.64478,11.72017],[46.6447,11.72057],[46.64379,11.72054],[46.64339,11.72041],[46.64328,11.72025],[46.6429,11.71943],[46.64283,11.71867],[46.64256,11.71802],[46.64226,11.71774],[46.64191,11.717],[46.64187,11.7167],[46.64209,11.7166],[46.64213,11.71642],[46.64175,11.71616],[46.64112,11.71647],[46.64088,11.71641]],
    startPoint:{lat:46.64082,lng:11.71624,label:'Start here — St. Magdalena village (Rundweg St. Magdalena)'},
    distance:1.6, elevation:75, hours:'0.5–1', paid:false,
    terrainType:'Paved farm road & packed dirt', terrainRank:0,
    elevationProfile:[{km:0, elev:1259}, {km:0.4, elev:1297}, {km:0.9, elev:1331}, {km:1.2, elev:1298}, {km:1.6, elev:1260}],
    surfaceHazards:[], shadeCoverage:30, heatRisk:'moderate', safetyLevel:'low-risk', exposure:false,
    waterSources:[{km:0,label:'Village fountain'}],
    rifugi:[],
    desc:"The postcard shot of the Dolomites — a church backed by the Odle peaks. This short village loop (Rundweg St. Magdalena) suits any dog.",
    tips:"Mostly open meadow with little shade — bring water for warm days."
  },
  {
    id:'tre-cime', name:'Tre Cime di Lavaredo Loop', area:'Sesto Dolomites', lat:46.618, lng:12.301,
    reviewedAt:'2026-07-17', reviewedBy:'ORMA desk review',
    source:'https://auronzo.info/en/tre-cime-di-lavaredo-dolomites/',
    sourceLinks:[
      {label:'Auronzo Tourism — official Tre Cime loop guide',url:'https://auronzo.info/en/tre-cime-di-lavaredo-dolomites/',categories:['surfaceHazards','access']},
      {label:'Auronzo Tourism — road, bus and walking access',url:'https://auronzo.info/en/how-to-get-to-the-tre-cime-di-lavaredo/',categories:['access']},
      {label:'3 Cime visitor guide — leash rule',url:'https://www.tre-cime.info/media/24bbbae6-15da-4f5d-a423-357169efceff/infobooklet-it-web.pdf',categories:['access']}
    ],
    verified:{categories:['surfaceHazards','access'],sources:['Auronzo Tourism','3 Cime visitor guide'],date:'2026-07-17'},
    path:[[46.61222,12.29641],[46.6133,12.29665],[46.6136,12.29764],[46.61365,12.29915],[46.61426,12.30163],[46.61416,12.30416],[46.61359,12.30496],[46.61363,12.30544],[46.61347,12.30666],[46.61351,12.3073],[46.6139,12.30832],[46.61408,12.30849],[46.61488,12.3087],[46.61558,12.3095],[46.61658,12.30997],[46.61723,12.31065],[46.61779,12.311],[46.61852,12.31203],[46.61945,12.31188],[46.62045,12.31204],[46.62071,12.31311],[46.62054,12.31419],[46.62089,12.31448],[46.62133,12.31436],[46.62153,12.31489],[46.62181,12.31516],[46.62276,12.31348],[46.62268,12.31245],[46.62238,12.31176],[46.62245,12.31147],[46.62327,12.31184],[46.62451,12.31297],[46.62488,12.31303],[46.6262,12.31273],[46.62725,12.31171],[46.62749,12.31173],[46.62809,12.31136],[46.62832,12.31135],[46.62827,12.31109],[46.6285,12.31095],[46.62954,12.31104],[46.63031,12.31057],[46.6316,12.31066],[46.63228,12.31109],[46.634,12.31188],[46.6342,12.31188],[46.63467,12.31157],[46.63495,12.31096],[46.63505,12.31098],[46.63501,12.31124],[46.63512,12.31113],[46.63513,12.31127],[46.63526,12.31103],[46.63531,12.31118],[46.63555,12.31095],[46.6356,12.31106],[46.63624,12.31112],[46.63653,12.31091],[46.63653,12.31111],[46.6369,12.31084],[46.63653,12.31111],[46.63653,12.31091],[46.63624,12.31112],[46.6356,12.31106],[46.63555,12.31095],[46.63529,12.31118],[46.63526,12.31103],[46.63515,12.31126],[46.6351,12.31114],[46.63471,12.31151],[46.63491,12.31099],[46.63473,12.31115],[46.63455,12.31037],[46.63469,12.30942],[46.63459,12.30814],[46.63484,12.30775],[46.63495,12.3068],[46.63469,12.30697],[46.63464,12.3062],[46.63419,12.30678],[46.63399,12.30682],[46.63421,12.30628],[46.63402,12.30647],[46.6337,12.30639],[46.63403,12.30599],[46.63409,12.3057],[46.63382,12.30571],[46.63366,12.30473],[46.63316,12.30405],[46.63268,12.30388],[46.63214,12.30396],[46.63171,12.30422],[46.63106,12.30422],[46.63041,12.30336],[46.63034,12.30246],[46.63012,12.30167],[46.63015,12.30017],[46.62992,12.29927],[46.62999,12.29875],[46.62986,12.29771],[46.62935,12.29614],[46.62899,12.29551],[46.62898,12.295],[46.62849,12.29437],[46.62812,12.29427],[46.62793,12.29403],[46.62737,12.29264],[46.62701,12.29244],[46.62681,12.29187],[46.62583,12.29058],[46.62507,12.29019],[46.6247,12.29018],[46.62458,12.28991],[46.62419,12.28978],[46.62396,12.2895],[46.62385,12.28806],[46.62413,12.28736],[46.62313,12.2861],[46.62279,12.28589],[46.62243,12.2857],[46.62108,12.28581],[46.62037,12.2852],[46.61953,12.28485],[46.61936,12.28495],[46.61788,12.28504],[46.61753,12.28473],[46.61752,12.28425],[46.61706,12.2844],[46.61637,12.28542],[46.61583,12.28675],[46.61584,12.28708],[46.61562,12.28729],[46.61545,12.28726],[46.6151,12.28784],[46.61495,12.28935],[46.61428,12.29103],[46.61375,12.29164],[46.61311,12.29292],[46.61213,12.29421],[46.61211,12.29492],[46.61187,12.29606],[46.61201,12.29635],[46.61222,12.29641]],
    distance:11.8, elevation:430, hours:'3–4', paid:true,
    terrainType:'Wide gravel', terrainRank:1,
    elevationProfile:[{km:0, elev:2320}, {km:2.4, elev:2344}, {km:4.2, elev:2454}, {km:7.2, elev:2405}, {km:9.8, elev:2240}, {km:11.8, elev:2320}],
    surfaceHazards:['Loose gravel patches near the rifugi'], shadeCoverage:5, heatRisk:'high', safetyLevel:'low-risk', exposure:false,
    waterSources:[{km:0,label:'Rifugio Auronzo fountain',lat:46.612205,lng:12.296095},{km:2.1,label:'Rifugio Lavaredo',lat:46.618326,lng:12.312094},{km:5.3,label:'Rifugio Locatelli',lat:46.636902,lng:12.31056}],
    decisionPoints:[{km:5.3,lat:46.636902,lng:12.31056,instruction:"Switch from trail 101 onto trail 105, right at Rifugio Locatelli"}],
    rifugi:[{km:0,name:'Rifugio Auronzo',lat:46.612205,lng:12.296095},{km:2.1,name:'Rifugio Lavaredo',lat:46.618326,lng:12.312094},{km:5.3,name:'Rifugio Locatelli',lat:46.636902,lng:12.31056}],
    startPoint:{lat:46.612205,lng:12.296095,label:'Start here — Rifugio Auronzo toll-road parking'},
    desc:"The classic loop around the iconic three peaks. The official guide describes a well-marked route without particular technical difficulties, over dirt roads and rocky mountain paths.",
    tips:"Starts and ends at Rifugio Auronzo. Motor access uses a paid, advance-booked road; seasonal buses and walking approaches are alternatives. Dogs must stay on lead. Snow and hut closures can affect the route outside late June–September."
  },
  {
    id:'cadini', name:'Cadini di Misurina Viewpoint', area:'Sesto Dolomites', lat:46.61, lng:12.265,
    reviewedAt:'2026-07-17', reviewedBy:'ORMA desk review',
    source:'https://auronzo.info/en/dolomites/',
    sourceLinks:[
      {label:'Auronzo Tourism — Cadini and equipped Bonacossa trail',url:'https://auronzo.info/en/dolomites/',categories:['exposure','surfaceHazards']},
      {label:'Rifugio Auronzo — Bonacossa route from the hut',url:'https://rifugioauronzo.it/la-posizione/',categories:['exposure','surfaceHazards']},
      {label:'Auronzo Tourism — Tre Cime road and seasonal access',url:'https://auronzo.info/en/how-to-get-to-the-tre-cime-di-lavaredo/',categories:['access']}
    ],
    verified:{categories:['exposure','surfaceHazards','access'],sources:['Auronzo Tourism','Rifugio Auronzo'],date:'2026-07-17'},
    distance:4, elevation:250, hours:'1.5–2.5', paid:true,
    terrainType:'Rocky switchbacks, loose scree', terrainRank:2,
    elevationProfile:[{km:0, elev:2320}, {km:2, elev:2500}, {km:3, elev:2600}, {km:4, elev:2320}],
    surfaceHazards:['Sharp limestone','Narrow ledges with drop-offs'], shadeCoverage:10, heatRisk:'high', safetyLevel:'caution', exposure:true,
    waterSources:[],
    rifugi:[{km:0,name:'Rifugio Auronzo'}],
    desc:"A short but steep out-and-back to a jagged, fantasy-film viewpoint. Narrow sections with real drop-offs near the top.",
    tips:"This viewpoint uses the opening section of equipped trail 117. Treat it as an exposed mountain route: skip wet, icy or snowy conditions and do not take a dog that is uncertain on narrow terrain."
  },
  {
    id:'prato-piazza', name:'Prato Piazza (Plätzwiese)', area:'Fanes-Sennes-Prags', lat:46.6538, lng:12.1791,
    path:[[46.65376,12.17907],[46.65293,12.17967],[46.65263,12.18026],[46.65259,12.18106],[46.65268,12.18134],[46.65297,12.18164],[46.65304,12.18196],[46.65266,12.18259],[46.65217,12.18267],[46.65068,12.18424],[46.65021,12.18459],[46.64948,12.18542],[46.6487,12.18663],[46.64773,12.18836],[46.64566,12.19112],[46.64493,12.19188],[46.64472,12.1925],[46.64439,12.19307],[46.64429,12.19364],[46.64309,12.19448],[46.6428,12.19504],[46.6424,12.19508],[46.64197,12.19547],[46.64297,12.19552],[46.64399,12.19487],[46.64452,12.19488],[46.64514,12.19448],[46.64558,12.19436],[46.64595,12.19393],[46.64636,12.19385],[46.64673,12.19348],[46.64701,12.19354],[46.6469,12.19422],[46.64736,12.19396],[46.6474,12.1941],[46.64726,12.19445],[46.64751,12.19445],[46.64708,12.19547],[46.64631,12.19674],[46.64623,12.19708],[46.64571,12.19714],[46.64589,12.19763],[46.64526,12.19886],[46.64444,12.19921],[46.64379,12.19983],[46.64288,12.19994],[46.64258,12.20038],[46.64245,12.20081],[46.64247,12.2009],[46.64284,12.20088],[46.6429,12.20097],[46.6425,12.20182],[46.6424,12.20265],[46.64254,12.20295],[46.64301,12.20323],[46.64354,12.20392],[46.64367,12.2043],[46.64368,12.20474],[46.64351,12.2052],[46.64362,12.20612],[46.64343,12.20672],[46.6432,12.20698],[46.64333,12.20755],[46.643,12.20828],[46.64296,12.20862],[46.64309,12.20891],[46.64343,12.20925],[46.64352,12.20986],[46.64367,12.21014],[46.64338,12.21117],[46.64337,12.21196],[46.64356,12.2122],[46.64395,12.21223],[46.64458,12.21253],[46.64459,12.21266],[46.6445,12.21268],[46.64459,12.21266],[46.64458,12.21253],[46.64395,12.21223],[46.64356,12.2122],[46.64337,12.21196],[46.64338,12.21117],[46.64367,12.21014],[46.64352,12.20986],[46.64343,12.20925],[46.64309,12.20891],[46.64296,12.20862],[46.643,12.20828],[46.64333,12.20755],[46.6432,12.20698],[46.64343,12.20672],[46.64362,12.20612],[46.64351,12.2052],[46.64368,12.20474],[46.64367,12.2043],[46.64354,12.20392],[46.64301,12.20323],[46.64254,12.20295],[46.6424,12.20265],[46.6425,12.20182],[46.6429,12.20097],[46.64284,12.20088],[46.64247,12.2009],[46.64245,12.20081],[46.64258,12.20038],[46.64288,12.19994],[46.64379,12.19983],[46.64444,12.19921],[46.64529,12.19881],[46.64589,12.19763],[46.64571,12.19714],[46.64623,12.19708],[46.64631,12.19674],[46.64708,12.19547],[46.64752,12.19452],[46.64747,12.19441],[46.64726,12.19445],[46.6474,12.1941],[46.64736,12.19396],[46.64724,12.19396],[46.64695,12.19425],[46.64688,12.19416],[46.64712,12.19303],[46.64708,12.19272],[46.64717,12.19274],[46.64724,12.19264],[46.6474,12.19216],[46.64786,12.19189],[46.64829,12.19143],[46.64884,12.19116],[46.64917,12.1907],[46.64928,12.19079],[46.64941,12.19074],[46.64963,12.19044],[46.64968,12.19028],[46.64942,12.19012],[46.64938,12.18991],[46.64954,12.18961],[46.64959,12.18908],[46.65039,12.18849],[46.65054,12.18868],[46.65176,12.1871],[46.65312,12.18556],[46.65367,12.18544],[46.65401,12.18521],[46.65431,12.18436],[46.65408,12.18394],[46.6541,12.18256],[46.65421,12.18192],[46.65357,12.18116],[46.65376,12.17907]],
    startPoint:{lat:46.65376,lng:12.17907,label:'Start here — Prato Piazza plateau, by Hotel Prato Piazza'},
    decisionPoints:[
      {km:4.05,lat:46.64351,lng:12.2052,instruction:"Leave the military road at the signed fork for the final climb to Monte Specie (Strudelkopf)"}
    ],
    distance:8.7, elevation:330, hours:'3–3.5', paid:false,
    terrainType:'Packed dirt & grass, occasional rock', terrainRank:1,
    elevationProfile:[{km:0, elev:1985}, {km:2, elev:2040}, {km:3.9, elev:2210}, {km:4.8, elev:2307}, {km:5.6, elev:2210}, {km:7.1, elev:2060}, {km:8.7, elev:1985}],
    surfaceHazards:['Occasional loose rock'], shadeCoverage:40, heatRisk:'moderate', safetyLevel:'low-risk', exposure:false,
    waterSources:[{km:0,label:'Trailhead fountain'}],
    rifugi:[{km:0,name:'Rifugio Prato Piazza',lat:46.65376,lng:12.17907},{km:2,name:'Rifugio Vallandro',lat:46.64197,lng:12.19547}],
    desc:"A loop from the Prato Piazza meadows up the old military road past Rifugio Vallandro to the panoramic summit of Monte Specie (Strudelkopf, 2307 m), returning across the plateau on the Alta Via 3 path — views to Tre Cime, Monte Cristallo and a WWI-era fort along the way.",
    tips:"Rocky in patches but no exposure — a relaxed, scenic option away from the busiest crowds."
  },
  {
    id:'nuvolau', name:'Passo Giau to Rifugio Nuvolau', area:'Cortina / Ampezzo', lat:46.488, lng:12.053,
    distance:6, elevation:520, hours:'2.5–3.5', paid:false,
    terrainType:'Loose rock mountain path', terrainRank:2,
    elevationProfile:[{km:0, elev:2236}, {km:2, elev:2350}, {km:4, elev:2480}, {km:6, elev:2575}],
    surfaceHazards:['Loose rock on the climb'], shadeCoverage:5, heatRisk:'high', safetyLevel:'moderate', exposure:false,
    waterSources:[],
    rifugi:[{km:3,name:'Rifugio Nuvolau',lat:46.495231,lng:12.045752}],
    desc:"A steady, rewarding climb from the 2236 m pass up to one of the best 360° viewpoints in the Dolomites.",
    tips:"Starts already at altitude — go slow with dogs unused to thin air, and carry all the water you'll need."
  },
  {
    id:'sassolungo', name:'Sassolungo–Sassopiatto Loop', area:'Val Gardena / Passo Sella', lat:46.531, lng:11.753,
    reviewedAt:'2026-07-17', reviewedBy:'ORMA desk review',
    source:'https://www.valgardena.it/en/outdoor/base/outdoor/sassolungo-circuit/800558069/',
    sourceLinks:[
      {label:'Dolomites Val Gardena — official Sassolungo circuit',url:'https://www.valgardena.it/en/outdoor/base/outdoor/sassolungo-circuit/800558069/',categories:['access']},
      {label:'Seceda / Val Gardena hiking map — leash and herd guidance',url:'https://www.seceda.it/files/wanderkarte_web.pdf',categories:['access','livestock']}
    ],
    verified:{categories:['livestock','access'],sources:['Dolomites Val Gardena','Val Gardena hiking map'],date:'2026-07-17'},
    distance:14, elevation:750, hours:'5–7', paid:true,
    terrainType:'Scree & rock', terrainRank:2,
    elevationProfile:[{km:0, elev:2244}, {km:3, elev:2500}, {km:6, elev:2680}, {km:9, elev:2550}, {km:12, elev:2350}, {km:14, elev:2244}],
    surfaceHazards:['Scree fields','Long exposed stretches'], shadeCoverage:10, heatRisk:'high', safetyLevel:'caution', exposure:true,
    waterSources:[{km:3,label:'Waterfall stream'}],
    rifugi:[{km:4,name:'Rifugio Sasso Piatto'},{km:8,name:'Rifugio Sandro Pertini'},{km:11,name:'Rifugio Vicenza'}],
    desc:"A long, officially rated difficult circuit from Passo Sella via paths 557, 527 and 526, passing a chain of rifugi around the Sassolungo massif.",
    tips:"The official circuit is rated difficult and requires substantial stamina. Dogs must stay on lead around grazing animals; keep well away from herds. Only consider it for very fit, trail-hardened dogs."
  },
  {
    id:'lago-braies', name:'Lago di Braies Loop', area:'Prags Valley', lat:46.695, lng:12.085, imageIcon:'images/lago-di-braies.webp',
    routeRefs:['1','19'],
    routeSource:{
      name:'Lago di Braies circuit (paths 1 and 19)',
      provider:'Südtirol official tourism portal',
      url:'https://www.suedtirol.info/en/en/experiences-and-events/plp-experiences/experiences-south-tyrol/pdp-experience.smgpoi633e6398a43354a62c64c2f3a96b24b6.summer-walk-around-the-lake-lago-di-braies-pragser-wildsee.braies-di-fuori-ausserprags',
    },
    path:[[46.69932,12.08516],[46.69902,12.08528],[46.69896,12.08547],[46.69869,12.08551],[46.69857,12.08566],[46.69851,12.08593],[46.69854,12.08633],[46.69876,12.08675],[46.69896,12.08683],[46.69934,12.08685],[46.69952,12.08697],[46.70024,12.08808],[46.70015,12.08821],[46.69958,12.08772],[46.69904,12.08769],[46.69883,12.08756],[46.69853,12.08751],[46.69796,12.08785],[46.69778,12.08831],[46.69744,12.08847],[46.69713,12.08832],[46.69683,12.08781],[46.69658,12.08766],[46.69642,12.08771],[46.69584,12.08813],[46.69543,12.08801],[46.69428,12.08854],[46.69394,12.08856],[46.69384,12.08844],[46.69431,12.08835],[46.69368,12.08783],[46.69359,12.08755],[46.6931,12.08695],[46.69224,12.08674],[46.69204,12.08679],[46.69168,12.08703],[46.69148,12.08706],[46.69108,12.08692],[46.69086,12.08649],[46.69066,12.08636],[46.69007,12.08617],[46.68961,12.08618],[46.68927,12.08604],[46.68917,12.08564],[46.68909,12.08389],[46.68915,12.08358],[46.68912,12.08218],[46.68918,12.0816],[46.68946,12.0813],[46.69001,12.08122],[46.69079,12.08095],[46.69109,12.08051],[46.6914,12.08046],[46.69158,12.08098],[46.69231,12.08174],[46.69314,12.08216],[46.69327,12.08237],[46.69355,12.08258],[46.69392,12.08302],[46.69449,12.0834],[46.69484,12.08349],[46.69532,12.0833],[46.69549,12.08333],[46.69629,12.0832],[46.69674,12.08327],[46.69697,12.08321],[46.69749,12.08355],[46.69824,12.08418],[46.69855,12.08422],[46.69871,12.08412],[46.69878,12.08415],[46.69932,12.08516]],
    distance:4, elevation:40, hours:'1', paid:false,
    terrainType:'Paved / packed gravel, flat', terrainRank:0,
    elevationProfile:[{km:0, elev:1496}, {km:1, elev:1500}, {km:2.5, elev:1496}, {km:4, elev:1496}],
    surfaceHazards:[], shadeCoverage:50, heatRisk:'low', safetyLevel:'low-risk', exposure:false,
    waterSources:[{km:0,label:'Lakeside fountain',lat:46.69932,lng:12.08516}],
    rifugi:[{km:0,name:'Lakeside hotel café',lat:46.69932,lng:12.08516}],
    startPoint:{lat:46.69932,lng:12.08516,label:'Start here — main lake access & parking, by Hotel Lago di Braies'},
    desc:"A flat, easy circuit around one of the Dolomites' most photographed lakes. Gentle enough for any dog.",
    tips:"Extremely popular — expect crowds and paid parking; arrive at opening time."
  },
  {
    id:'lago-carezza', name:'Lago di Carezza Loop', area:"Val d'Ega", lat:46.4091, lng:11.5752, imageIcon:'images/lago-di-carezza.webp',
    path:[[46.41032,11.57585],[46.41024,11.57584],[46.41022,11.57554],[46.40998,11.57483],[46.40973,11.57432],[46.40957,11.57404],[46.40934,11.57381],[46.40923,11.57361],[46.40913,11.57327],[46.40913,11.5728],[46.40878,11.57287],[46.40852,11.57299],[46.40829,11.57316],[46.4081,11.57345],[46.40802,11.574],[46.40804,11.57424],[46.4082,11.57459],[46.40815,11.57514],[46.40832,11.57547],[46.40844,11.5762],[46.40855,11.57631],[46.40883,11.57628],[46.40903,11.57639],[46.40892,11.57677],[46.40895,11.57703],[46.40917,11.57719],[46.40934,11.57739],[46.40941,11.57738],[46.40968,11.57714],[46.40992,11.57686],[46.41018,11.57675],[46.41023,11.57663],[46.41032,11.57585]],
    distance:1.3, elevation:20, hours:'0.5', paid:false,
    terrainType:'Paved, flat', terrainRank:0,
    elevationProfile:[{km:0, elev:1534}, {km:0.65, elev:1540}, {km:1.3, elev:1534}],
    surfaceHazards:[], shadeCoverage:70, heatRisk:'low', safetyLevel:'low-risk', exposure:false,
    waterSources:[{km:0,label:'Trailhead fountain',lat:46.41032,lng:11.57585}],
    rifugi:[],
    startPoint:{lat:46.41032,lng:11.57585,label:'Start here — main parking area at Lago di Carezza'},
    desc:"A short, flat, mostly forested path around a small, vividly colored lake — a perfect low-effort stop.",
    tips:"Lake is fenced off (no swimming) but it's a lovely easy leg-stretch for older or less mobile dogs."
  },
  {
    id:'lago-sorapis', name:'Lago di Sorapis Trail', area:"Cortina d'Ampezzo", lat:46.546, lng:12.226,
    reviewedAt:'2026-07-17', reviewedBy:'ORMA desk review',
    source:'https://cortina.dolomiti.org/en/escursioni/to-lago-sorapis-en/',
    sourceLinks:[
      {label:'Cortina Dolomiti — official Lago Sorapis route',url:'https://cortina.dolomiti.org/en/escursioni/to-lago-sorapis-en/',categories:['exposure','surfaceHazards']},
      {label:'Cortina hiking guide — exposed cable-protected sections',url:'https://www.dolomiti.org/storage/oassets/LayoutWEPagine/Guida%20Generale_ci%20vediamo%20a%20Cortina_ITA_web.pdf',categories:['exposure','surfaceHazards']}
    ],
    verified:{categories:['exposure','surfaceHazards'],sources:['Cortina Dolomiti official route','Cortina hiking guide'],date:'2026-07-17'},
    distance:11, elevation:450, hours:'4–5', paid:false,
    terrainType:'Rocky, roots, narrow ledges', terrainRank:2,
    elevationProfile:[{km:0, elev:1805}, {km:4, elev:2000}, {km:7, elev:2150}, {km:9, elev:2250}, {km:11, elev:1923}],
    surfaceHazards:['Sharp rock sections','Fixed cables on narrow ledges'], shadeCoverage:40, heatRisk:'moderate', safetyLevel:'caution', exposure:true,
    waterSources:[{km:2,label:'Stream crossing'},{km:5,label:'Lake shore'}],
    rifugi:[],
    desc:"A striking turquoise glacial lake, but the path in has narrow, exposed sections with fixed cables in places.",
    tips:"The official route is for expert hikers and includes metal ladders plus exposed ledges protected by wire ropes. Only consider it for a sure-footed, confident dog; popularity does not make it a beginner route."
  },
  {
    id:'valley-view', name:'Val di Funes Panorama Trail', area:'Val di Funes / Villnöß', lat:46.64881, lng:11.68957,
    source:'osm', curated:false, osmRelation:11817269,
    waymarkedtrails:'https://hiking.waymarkedtrails.org/#route?id=11817269&type=relation',
    routeSource:{name:'Panoramaweg (Villnöß) — Sentiero Panorama (Funes)',provider:'Waymarked Trails / OpenStreetMap',relation:11817269,fetchedAt:'2026-07-17'},
    path:[[46.64881,11.68957],[46.64879,11.69023],[46.64839,11.69168],[46.64751,11.69249],[46.6471,11.69249],[46.64682,11.69208],[46.64605,11.69258],[46.64578,11.69314],[46.64568,11.69374],[46.64504,11.69492],[46.64535,11.69587],[46.64582,11.6962],[46.64597,11.69746],[46.64565,11.70014],[46.64568,11.70168],[46.64573,11.70194],[46.64614,11.7023],[46.64631,11.70264],[46.64639,11.70356],[46.64656,11.70309],[46.64661,11.70661],[46.64674,11.70694],[46.64694,11.70706],[46.64697,11.70739],[46.64711,11.70721],[46.64732,11.70808],[46.64769,11.70874],[46.64766,11.70937],[46.64783,11.70988],[46.64794,11.71135],[46.64822,11.71272],[46.6489,11.71379],[46.64866,11.71544],[46.64823,11.71608],[46.64812,11.71603],[46.64792,11.71505],[46.64749,11.71456]],
    distance:2.8, elevation:null, hours:'1–1.5', paid:false,
    terrainType:'Packed dirt, meadow', terrainRank:0,
    elevationProfile:null,
    surfaceHazards:[], shadeCoverage:35, heatRisk:'moderate', safetyLevel:'low-risk', exposure:false,
    waterSources:[{km:1,label:'Creek'},{km:4,label:'Farm fountain'}],
    rifugi:[],
    desc:"The mapped Panoramaweg through the meadows above Val di Funes, following the current OpenStreetMap hiking relation from west to east toward Santa Maddalena.",
    tips:"This is now the actual 2.8 km waymarked route, not the former unverified 8 km placeholder. The route geometry is mapped; dog-safety and elevation checks are still pending."
  },
  {
    id:'piancavallo', name:'Piancavallo Malghe Loop', area:'Friulian Dolomites, Pordenone', lat:46.1118, lng:12.5305,
    path:[[46.11185,12.53045],[46.11197,12.53054],[46.11211,12.53102],[46.11237,12.53129],[46.11257,12.53188],[46.11293,12.53225],[46.11299,12.53244],[46.11297,12.53326],[46.11276,12.53372],[46.11273,12.53556],[46.11327,12.53647],[46.11361,12.53671],[46.11366,12.53688],[46.11361,12.53722],[46.1138,12.53867],[46.11374,12.53913],[46.11363,12.53948],[46.11323,12.53983],[46.11319,12.54015],[46.11324,12.54058],[46.11343,12.54078],[46.11349,12.5414],[46.11387,12.54238],[46.11392,12.54276],[46.1139,12.54285],[46.11349,12.54217],[46.11303,12.54188],[46.11321,12.54263],[46.11323,12.54338],[46.11298,12.5436],[46.11265,12.54433],[46.11227,12.54472],[46.11208,12.54549],[46.11203,12.5463],[46.11211,12.54665],[46.11307,12.54797],[46.11335,12.54866],[46.11331,12.54874],[46.1131,12.54868],[46.11297,12.54875],[46.11244,12.54926],[46.11216,12.54917],[46.11193,12.5493],[46.1102,12.55081],[46.1093,12.55183],[46.10871,12.55185],[46.10853,12.55169],[46.10839,12.55091],[46.10797,12.55069],[46.10762,12.55092],[46.10748,12.5505],[46.10676,12.54978],[46.10659,12.54949],[46.10657,12.54925],[46.10677,12.54879],[46.10629,12.54829],[46.10602,12.54776],[46.10592,12.54695],[46.10546,12.54644],[46.10522,12.54651],[46.10509,12.54692],[46.10496,12.54699],[46.10441,12.54635],[46.10404,12.54568],[46.10368,12.54544],[46.10348,12.54556],[46.10306,12.54618],[46.10282,12.54624],[46.10274,12.54618],[46.10265,12.54566],[46.10293,12.54538],[46.10307,12.5447],[46.10299,12.54355],[46.10249,12.54345],[46.10174,12.54261],[46.10051,12.54172],[46.1002,12.54129],[46.09971,12.54133],[46.0994,12.54122],[46.09866,12.54041],[46.09829,12.53955],[46.09826,12.53767],[46.09769,12.5363],[46.09732,12.53591],[46.09722,12.53532],[46.09684,12.53489],[46.09682,12.53465],[46.09694,12.53446],[46.09687,12.53408],[46.09654,12.5341],[46.09642,12.53338],[46.09548,12.53278],[46.09531,12.53211],[46.09556,12.53194],[46.09619,12.5311],[46.09669,12.53076],[46.09757,12.53043],[46.09843,12.53025],[46.09947,12.53031],[46.10033,12.52997],[46.10066,12.52996],[46.1014,12.52941],[46.10209,12.52909],[46.10289,12.52848],[46.10344,12.52841],[46.10444,12.52793],[46.10581,12.52768],[46.10732,12.5271],[46.10734,12.52655],[46.10744,12.52639],[46.10864,12.52602],[46.10891,12.52582],[46.10962,12.52491],[46.10992,12.52392],[46.11009,12.52367]],
    startPoint:{lat:46.11185,lng:12.53045,label:'Start here — Piancavallo, Passeggiata delle Malghe trailhead'},
    distance:7, elevation:180, hours:'2–2.5', paid:false,
    terrainType:'Packed dirt & gravel pasture track', terrainRank:1,
    elevationProfile:[{km:0, elev:1340}, {km:1, elev:1358}, {km:2.8, elev:1215}, {km:3.8, elev:1175}, {km:5.2, elev:1246}, {km:7, elev:1291}],
    surfaceHazards:[], shadeCoverage:40, heatRisk:'moderate', safetyLevel:'low-risk', exposure:false,
    waterSources:[{km:2,label:'Waterfall stream'},{km:4.3,label:'Malga fountain'}],
    rifugi:[{km:4.3,name:'Malga di Piancavallo'}],
    desc:"Rolling mountain pastures in the quieter Friulian Dolomites, passing a waterfall along the way.",
    tips:"A good pick if you want real mountain scenery without the Val Gardena / Cortina crowds."
  },
  {
    id:'geotrail-bulla', name:'Geotrail Bula / Pufels / Bulla', area:'Val Gardena', lat:46.5789, lng:11.6031,
    path:[[46.58025,11.62282],[46.58021,11.62267],[46.5793,11.62314],[46.57882,11.62323],[46.5787,11.6229],[46.57883,11.62278],[46.57885,11.62249],[46.57866,11.62199],[46.57828,11.62151],[46.57819,11.62088],[46.5783,11.62006],[46.57827,11.61879],[46.57816,11.61945],[46.57791,11.61983],[46.57736,11.62028],[46.57704,11.62028],[46.57692,11.62049],[46.57672,11.62059],[46.57641,11.62054],[46.57619,11.62029],[46.57602,11.62025],[46.57579,11.61969],[46.57565,11.6196],[46.57547,11.61974],[46.57506,11.61985],[46.57475,11.61924],[46.57462,11.61919],[46.57443,11.61927],[46.57405,11.61922],[46.57368,11.61945],[46.57264,11.62075],[46.57253,11.62141],[46.57231,11.62182],[46.57242,11.62215],[46.57225,11.62291],[46.57207,11.623],[46.57197,11.62319],[46.57186,11.62318],[46.57176,11.62332],[46.5715,11.6234],[46.57131,11.62366],[46.57108,11.62367],[46.57066,11.62387],[46.57041,11.62367],[46.57027,11.62376],[46.57014,11.62371],[46.57001,11.62391],[46.57016,11.6245],[46.57008,11.62479],[46.57023,11.62563],[46.57014,11.62584],[46.56982,11.62608],[46.56981,11.62696],[46.56961,11.62737],[46.56967,11.62815],[46.56956,11.62876],[46.56927,11.62993],[46.56893,11.63039],[46.56892,11.63102],[46.56914,11.63187],[46.56894,11.63265],[46.56822,11.63464],[46.5677,11.63436],[46.56722,11.63371],[46.56746,11.63442],[46.56743,11.6346],[46.56701,11.63441],[46.56685,11.63459],[46.56676,11.63459],[46.56622,11.63405],[46.56595,11.63352],[46.56537,11.6332],[46.56484,11.63322],[46.56429,11.6335],[46.56395,11.63356],[46.56425,11.63406],[46.56454,11.63411],[46.56482,11.6346],[46.56513,11.6355],[46.56594,11.63687],[46.5663,11.63704],[46.56667,11.63708],[46.56742,11.63686],[46.56793,11.63682],[46.56843,11.63636],[46.56887,11.63561],[46.56908,11.63493],[46.56891,11.6344],[46.56969,11.63185],[46.56977,11.63125],[46.56974,11.63065],[46.57014,11.63006],[46.57019,11.62955],[46.57041,11.62932],[46.5707,11.62876],[46.57078,11.62792],[46.57124,11.62777],[46.57128,11.62726],[46.57158,11.62718],[46.57202,11.62691],[46.57162,11.62627],[46.57145,11.62616],[46.57088,11.6245],[46.57064,11.6243],[46.57038,11.62428],[46.57047,11.62414],[46.57032,11.62409],[46.57054,11.62383],[46.57066,11.62387],[46.57108,11.62367],[46.57131,11.62366],[46.5715,11.6234],[46.57176,11.62332],[46.57186,11.62318],[46.57197,11.62319],[46.57207,11.623],[46.57225,11.62291],[46.57242,11.62215],[46.57231,11.62182],[46.57253,11.62141],[46.57264,11.62075],[46.57368,11.61945],[46.57405,11.61922],[46.57443,11.61927],[46.57462,11.61919],[46.57475,11.61924],[46.57506,11.61985],[46.57547,11.61974],[46.57565,11.6196],[46.57579,11.61969],[46.57602,11.62025],[46.57619,11.62029],[46.57641,11.62054],[46.57672,11.62059],[46.57692,11.62049],[46.57704,11.62028],[46.57736,11.62028],[46.57791,11.61983],[46.57816,11.61945],[46.57827,11.61879],[46.5783,11.62006],[46.57819,11.62088],[46.57828,11.62151],[46.57866,11.62199],[46.57885,11.62249],[46.57883,11.62278],[46.5787,11.6229],[46.57882,11.62323],[46.5793,11.62314],[46.58021,11.62267],[46.58025,11.62282]],
    startPoint:{lat:46.5802,lng:11.6228,label:'Start here — Passo Pinei (Panider Sattel), near Hotel Panider Sattel'},
    decisionPoints:[{km:1.6,lat:46.57264,lng:11.62075,instruction:"Leave trail 3A here — a signed connector path branches down toward the old Pufels road, which is the actual start of the geological trail itself"}],
    distance:8.8, elevation:340, hours:'2.5–3', paid:false,
    terrainType:'Forest road & meadow path', terrainRank:1,
    elevationProfile:[{km:0, elev:1437}, {km:2.2, elev:1530}, {km:4.4, elev:1440}, {km:6.6, elev:1500}, {km:8.8, elev:1437}],
    surfaceHazards:[], shadeCoverage:40, heatRisk:'moderate', safetyLevel:'moderate', exposure:false,
    waterSources:[],
    rifugi:[
      {km:0,name:'Restaurant Pinei Bar / Hotel Panider Sattel',lat:46.5802,lng:11.6228},
      {km:4.47,name:'Bulla village (St. Leonard Church)',lat:46.56513,lng:11.6355}
    ],
    desc:"A real, GPS-verified geological education trail between Passo Pinei and the village of Bulla — 8 information panels explain how the Dolomites formed, including a spot where you physically cross the 252-million-year-old Permian-Triassic boundary. Confirmed dog-friendly (leashed, off-leash in some areas) by multiple independent trail guides.",
    tips:"Reachable by bus (line 172) from Ortisei, or park at Passo Pinei. Best June through October. Moderate terrain with some real ascent/descent — not the flattest option on this list, but not technical either."
  },
  {
    id:'giro-del-bulacia', name:'Giro del Bulacia', area:'Tires / Fiè allo Sciliar', lat:46.545689, lng:11.6124627,
    path:[[46.545689,11.6124627],[46.5458311,11.6120166],[46.5458453,11.6102646],[46.5459299,11.6098149],[46.5468575,11.6086503],[46.5473717,11.6077324],[46.5479519,11.6075814],[46.5482725,11.6073391],[46.5487186,11.6057855],[46.5491273,11.6052406],[46.5496457,11.6039329],[46.5500327,11.6041106],[46.5505045,11.6038637],[46.5509402,11.6038382],[46.5511142,11.6032458],[46.5515682,11.6030217],[46.5518775,11.602009],[46.5525206,11.6008772],[46.552791,11.6008583],[46.553128,11.6011681],[46.5538783,11.6015332],[46.5547578,11.5996038],[46.5553109,11.5995279],[46.556108,11.5990671],[46.5569921,11.5992982],[46.5576057,11.6001432],[46.5576727,11.6017628],[46.5578297,11.6022983],[46.5582142,11.6025769],[46.558917,11.603943],[46.559667,11.6043274],[46.5593845,11.6055485],[46.5593238,11.6064885],[46.5590816,11.6071564],[46.5591126,11.6076228],[46.5597782,11.6074036],[46.5603365,11.6074227],[46.5607548,11.6079625],[46.5612155,11.6081871],[46.5619736,11.6079596],[46.5626358,11.6080467],[46.5628221,11.6078177],[46.562708,11.6085286],[46.5625334,11.6087571],[46.5627817,11.6092893],[46.5626808,11.6107267],[46.5632513,11.6116775],[46.5635006,11.6132215],[46.5637187,11.6136752],[46.5640286,11.6139717],[46.5644454,11.6161472],[46.5642983,11.6167486],[46.5639076,11.6172675],[46.5636322,11.6179836],[46.5636603,11.619112],[46.5634469,11.620279],[46.5635033,11.6209973],[46.5634331,11.6211091],[46.5631048,11.6202682],[46.5625045,11.6196347],[46.5603514,11.6189942],[46.5596746,11.6182753],[46.5591499,11.6182284],[46.5579326,11.6187434],[46.5568922,11.6186826],[46.5560641,11.6180836],[46.5558028,11.6176148],[46.5548271,11.6166499],[46.5543134,11.6167063],[46.5533372,11.6161089],[46.5523272,11.6166906],[46.5518316,11.6165531],[46.5516653,11.616364],[46.5513406,11.6165118],[46.5508406,11.6157822],[46.5501715,11.615132],[46.5498238,11.6151097],[46.548956,11.61379],[46.54869,11.6147275],[46.548599,11.6147181],[46.5486206,11.6149377],[46.548159,11.6146758],[46.5479738,11.6148661],[46.5478855,11.6148066],[46.547819,11.6149994],[46.5467298,11.6131195],[46.5462982,11.6126581],[46.545689,11.6124627]],
    distance:6.64, elevation:null, hours:'2.5–3 (estimated - not source-verified)', paid:true,
    terrainType:'Meadow & alpine pasture track', terrainRank:0,
    elevationProfile:[], // TODO: no elevation data sourced yet - run through Open-Meteo lookup
    surfaceHazards:['Electrified cattle gate partway up the ascent — guide dogs through calmly, a blogged account confirms a dog got a shock here','Avoid in heavy snow — some sections carry avalanche risk'],
    shadeCoverage:null, heatRisk:null, safetyLevel:'moderate', exposure:false,
    waterSources:[{km:null,label:'Tschötsch Alm (malga)'},{km:null,label:'Rifugio Puflatsch/Bullaccia'},{km:null,label:'Baita Arnica'}],
    rifugi:[{km:null,name:'Tschötsch Alm'},{km:null,name:'Rifugio Puflatsch'},{km:null,name:'Baita Arnica'}],
    startPoint:{lat:46.545689,lng:11.6124627,label:'Start here — Compaccio/Kompatsch area parking'},
    desc:"GPS-verified closed loop (Waymarked Trails relation 9483250) near Bulaccia in the Sciliar-Catinaccio park, officially marked as a \"PU\" trail. Confirmed dog-friendly via an independent hiking blog account of the route done together with a dog. Passes Tschötsch Alm, Rifugio Puflatsch, and the Panche delle Streghe (Witches' Benches) viewpoint.",
    tips:"There's an electrified cattle gate partway up — approach calmly and guide your dog through rather than letting them investigate it. Skip this trail if there's heavy snow cover (avalanche risk on some sections). Elevation profile and exact water-source/rifugio positions along the km-marks are not yet verified — treat as approximate."
  },
  {
    id:'sentiero-hans-e-paula-steger', name:'Sentiero Hans e Paula Steger', area:'Compaccio / Saltria, Alpe di Siusi', lat:46.5423615, lng:11.6174164,
    path:[[46.5423615,11.6174164],[46.5426391,11.6173178],[46.5427968,11.6176299],[46.5421798,11.6177015],[46.5415096,11.6175094],[46.5409841,11.6178889],[46.5401735,11.618069],[46.5402137,11.6192421],[46.540546,11.6193308],[46.5411319,11.6217267],[46.5411635,11.6223539],[46.5410185,11.6235928],[46.5405957,11.6239622],[46.5405464,11.6242988],[46.5406278,11.6254408],[46.5407978,11.6260135],[46.5408001,11.6269999],[46.5410901,11.6275745],[46.5411145,11.6283911],[46.5413673,11.629371],[46.5410682,11.6306401],[46.5414174,11.6303727],[46.5411123,11.6307607],[46.5411353,11.6323041],[46.5407818,11.6335697],[46.5406532,11.6345482],[46.539935,11.6369231],[46.5392946,11.6383105],[46.5388934,11.6396453],[46.5377942,11.6411747],[46.5373162,11.6423834],[46.5368335,11.6432568],[46.5366789,11.644943],[46.5359777,11.6476951],[46.5359786,11.64841],[46.5364174,11.6497632],[46.5371447,11.6503961],[46.5373071,11.6507434],[46.5373041,11.6511368],[46.5380082,11.6523555],[46.5378659,11.6535854],[46.5375929,11.6533298],[46.5373303,11.6525791],[46.5370774,11.6522729],[46.5368315,11.6521074],[46.5361077,11.6521759],[46.5356458,11.6520043],[46.5350942,11.6515822],[46.5342539,11.6504308],[46.5337564,11.6501296],[46.533675,11.6495425],[46.5331646,11.648518],[46.5327745,11.6473106],[46.5325282,11.6478194],[46.5320836,11.6482375],[46.5318727,11.6489851],[46.5317287,11.6491139],[46.5310197,11.6481129],[46.5313835,11.6474083],[46.531379,11.647118],[46.5303614,11.6466033],[46.5300569,11.6469276],[46.5298336,11.6478218],[46.5291497,11.6489524],[46.5288946,11.6491811],[46.5287442,11.6497375],[46.5275794,11.6505249],[46.5263461,11.6509264],[46.5258503,11.6515957],[46.5255427,11.651172],[46.525225,11.6516729],[46.5247206,11.6514555],[46.5244205,11.6518368],[46.5241402,11.6519071],[46.5232965,11.6514295],[46.5229381,11.6509273],[46.5222193,11.6506778],[46.5219334,11.6503217],[46.5215587,11.6501964],[46.5208302,11.6496434],[46.5203472,11.64948],[46.5194909,11.6499688],[46.5195013,11.6504806],[46.5201607,11.6516382],[46.519969,11.6524057],[46.5200848,11.6526319],[46.5201099,11.6531204],[46.5202852,11.6534313],[46.5202281,11.6540805],[46.5204112,11.6543343],[46.5207158,11.6553691],[46.5206542,11.6561303],[46.5208633,11.65683],[46.5209939,11.656919],[46.5212218,11.656637],[46.5213065,11.6556795],[46.52138,11.6556304],[46.5217354,11.6566305],[46.5220353,11.6567945],[46.5220623,11.6573063],[46.522453,11.6575016],[46.5226325,11.6573082],[46.5230829,11.6578084],[46.5232428,11.6576243],[46.52381,11.6588673],[46.5237455,11.6595205],[46.5238586,11.6607531],[46.5244419,11.6621125],[46.5248053,11.6628531],[46.5249798,11.6626075],[46.5259061,11.664459],[46.5266932,11.6653345],[46.5268134,11.6657255],[46.5271222,11.6660902],[46.5275844,11.6670656],[46.5292295,11.6679612],[46.5297552,11.6681026],[46.5300971,11.6679684],[46.5310184,11.6681785],[46.5317363,11.6685292]],
    distance:8.74, elevation:233, hours:'2.5–3', paid:true,
    terrainType:'Wide, mostly flat alpine path', terrainRank:0,
    elevationProfile:[], // TODO: no detailed elevation profile sourced yet - total gain (233m) is from AllTrails only
    surfaceHazards:['Livestock pasture crossing — cows with calves present, keep dogs close/leashed there','Brief uneven/rocky terrain on the final descent section','Crosses the paved Compaccio–Saltria road at a couple of points'],
    shadeCoverage:null, heatRisk:null, safetyLevel:'low-risk', exposure:false,
    waterSources:[{km:null,label:'Malga Laranzer / Rifugio area'}],
    rifugi:[{km:null,name:'Malga Laranzer'}],
    startPoint:{lat:46.5423615,lng:11.6174164,label:'Start here — Compaccio/Compatsch, Alpe di Siusi cable car mountain station'},
    desc:"GPS-verified path (Waymarked Trails relation 10399914) from Compaccio to Saltria on the Alpe di Siusi, dedicated to alpine skiing pioneers Hans Steger and Paula Wiesinger. Wide, easy, mostly flat with panoramic views of Sassolungo and Sasso Piatto. Explicitly confirmed dog-friendly by an independent source (\"Si può fare con i cani? Sì.\").",
    tips:"Part of the route crosses a cattle pasture with calves present — keep dogs close. Return the way you came, or take the Almbus back from Saltria to Compaccio. Exact water-source and rifugio km-marks are approximate, not GPS-verified."
  },
  {
    id:'sentiero-del-trenino', name:'Sentiero del Trenino', area:'Val Gardena (Ortisei – Santa Cristina – Selva)', lat:46.5752019, lng:11.6452059,
    path:[[46.5752019,11.6452059],[46.5750913,11.6450949],[46.5745105,11.6459977],[46.5728501,11.6476971],[46.5727229,11.6485296],[46.5730147,11.6499081],[46.5731088,11.6498812],[46.5734862,11.6510082],[46.5734372,11.6542422],[46.5735208,11.654796],[46.5739835,11.6566039],[46.5747761,11.6572764],[46.5749694,11.6589257],[46.5749261,11.6606685],[46.5744632,11.6616346],[46.5744921,11.6634137],[46.5738442,11.6645973],[46.5737527,11.6651494],[46.5738502,11.6656235],[46.5741813,11.6663278],[46.5744647,11.6664588],[46.5747985,11.6662879],[46.5749982,11.6680118],[46.5756305,11.671685],[46.575207,11.672323],[46.5746811,11.6747505],[46.5740465,11.6757971],[46.573136,11.6765744],[46.5730625,11.6773129],[46.5735393,11.6761827],[46.5728234,11.6778717],[46.5727345,11.6787486],[46.5720546,11.680693],[46.5714444,11.6812275],[46.5705886,11.682394],[46.5705068,11.6823451],[46.5691946,11.684982],[46.5680458,11.6861522],[46.5677947,11.6874091],[46.5672112,11.6886598],[46.5667146,11.6903349],[46.5650947,11.6943806],[46.5647134,11.6948675],[46.5645116,11.6954522],[46.5645224,11.6957498],[46.5648003,11.6962213],[46.5648544,11.696559],[46.5648441,11.6969436],[46.5645893,11.6975481],[46.5644798,11.6987203],[46.5643298,11.6989656],[46.5635571,11.6993644],[46.5630039,11.7006114],[46.562668,11.7017029],[46.5613823,11.7035327],[46.5612008,11.7042929],[46.5614102,11.7062957],[46.5607214,11.7076213],[46.5605825,11.708246],[46.5592391,11.7102138],[46.5597272,11.7109857],[46.5597636,11.7117358],[46.5589502,11.7135098],[46.558825,11.7140504],[46.5587917,11.7154684],[46.5589452,11.7158816],[46.5591336,11.715979],[46.5591796,11.716223],[46.5590875,11.7165122],[46.5592746,11.7167607],[46.5590445,11.7189321],[46.5591443,11.7198707],[46.5590241,11.7210925],[46.5591799,11.7221371],[46.5592047,11.7236635],[46.5590666,11.7242413],[46.5586261,11.7248335],[46.558548,11.7252188],[46.5590051,11.7262322],[46.5591888,11.7270106],[46.560007,11.7282878],[46.5602619,11.7289836],[46.5601609,11.7295068],[46.5603237,11.7296951],[46.5598419,11.7299706],[46.5591218,11.729759],[46.5587954,11.7294775],[46.5584677,11.7295114],[46.5583081,11.7298086],[46.5582441,11.730911],[46.5579509,11.7319476],[46.5582009,11.732646],[46.5590589,11.7335032],[46.5596786,11.7348625],[46.5595452,11.7359983],[46.5595646,11.7367849],[46.5591656,11.7390006],[46.559583,11.7420967],[46.5592548,11.7443732],[46.5596817,11.7458137],[46.5598044,11.7470646],[46.5597619,11.7478039],[46.5596444,11.7481147],[46.5575403,11.7491293],[46.5572896,11.7494274],[46.5569293,11.7502974],[46.5566178,11.7547653],[46.557256,11.7565449],[46.5577509,11.7572724],[46.557807,11.7581072],[46.5576779,11.7584778],[46.5573845,11.7587827],[46.5555282,11.7591609],[46.5549764,11.7595266],[46.5539189,11.7615089],[46.5537911,11.7621356],[46.5537087,11.7635837],[46.5536023,11.7637872],[46.5525271,11.7644312],[46.5521402,11.7640194],[46.5515759,11.7639845],[46.5504854,11.7659134],[46.5498115,11.7666717],[46.5479557,11.7681884],[46.5471208,11.7683956],[46.5463737,11.7693816],[46.5461395,11.7692386]],
    distance:12.43, elevation:462, hours:'3:38', paid:false,
    terrainType:'Old railway grade — wide, flat, largely paved/packed', terrainRank:0,
    elevationProfile:[], // TODO: only total ascent (462m, official source) known, no detailed profile
    surfaceHazards:[], // official Val Gardena tourism source: "no particular safety risks"
    shadeCoverage:null, heatRisk:'low', safetyLevel:'low-risk', exposure:false,
    waterSources:[],
    rifugi:[],
    startPoint:{lat:46.5752019,lng:11.6452059,label:'Start here — can begin from Ortisei, Santa Cristina, or Selva di Val Gardena'},
    desc:"GPS-verified path (Waymarked Trails relation 9445694) along the old Val Gardena narrow-gauge railway line (1916–1960), connecting Ortisei, Santa Cristina, and Selva. Historical information boards throughout; a restored railway tunnel is walkable near Santa Cristina. Official Val Gardena tourism source rates it \"facile\" (easy) with no particular safety risks, and it's explicitly described elsewhere as ideal to walk with dogs.",
    tips:"Very gentle, wide, stroller/bike-accessible in parts — a great low-effort option. Multiple access points along the valley floor, so you can walk just one section if you don't want the full 12km."
  },
  {
    id:'giro-del-sasso-lungo', name:'Giro del Sasso Lungo', area:'Passo Sella / Sassolungo, Val Gardena', lat:46.5092544, lng:11.7574789,
    path:[[46.5092544,11.7574789],[46.5089854,11.7569278],[46.5090729,11.7566896],[46.5089988,11.7561871],[46.5091093,11.7559063],[46.5096803,11.7565156],[46.5097205,11.7567032],[46.5102718,11.7563208],[46.5105411,11.7564359],[46.5107301,11.7567291],[46.5108862,11.7566272],[46.5112651,11.7568699],[46.5113472,11.7570442],[46.5121653,11.7566486],[46.5126003,11.7561174],[46.5132879,11.7555663],[46.5135222,11.7551704],[46.5137937,11.7551831],[46.5141979,11.7555212],[46.5149402,11.7554662],[46.5154684,11.7553506],[46.515841,11.7550969],[46.5163445,11.7552708],[46.5175866,11.7546653],[46.5184342,11.7547183],[46.5188322,11.7545526],[46.5194031,11.7534674],[46.519637,11.7533465],[46.520001,11.7526799],[46.5208459,11.7519959],[46.5215322,11.7512308],[46.5223633,11.7499497],[46.5224824,11.7494863],[46.5228075,11.749118],[46.5236221,11.7489194],[46.5238949,11.7486629],[46.5251974,11.7486261],[46.5262045,11.7487463],[46.5267435,11.7490644],[46.52765,11.7492558],[46.5287989,11.7485935],[46.5292799,11.7471028],[46.5298372,11.7467866],[46.5297607,11.7463976],[46.5300719,11.7461682],[46.5299755,11.7457839],[46.5302159,11.7456753],[46.5302807,11.7452139],[46.5304089,11.7452787],[46.5305052,11.7446801],[46.5306362,11.7447105],[46.5306422,11.743743],[46.5301507,11.7412076],[46.5300707,11.7397448],[46.5302522,11.7392343],[46.5302499,11.7389205],[46.5303834,11.7387838],[46.5303277,11.7377862],[46.5309786,11.7351694],[46.531645,11.7339717],[46.5320124,11.7308837],[46.5324634,11.7299679],[46.5324761,11.7293783],[46.5328715,11.7281235],[46.5323232,11.7263295],[46.5320931,11.7263083],[46.5323151,11.7256031],[46.5322514,11.7248666],[46.5313189,11.7239224],[46.5315703,11.7232466],[46.5311048,11.7229786],[46.5309194,11.722801],[46.5310799,11.7227856],[46.5305362,11.722288],[46.5296783,11.7206358],[46.5278927,11.7198757],[46.5271738,11.719792],[46.526196,11.7203314],[46.5255298,11.7210153],[46.5251614,11.7209711],[46.5246796,11.7207333],[46.5244548,11.7204487],[46.5243903,11.7200422],[46.5237749,11.7193608],[46.5234376,11.7195123],[46.5222075,11.7190009],[46.5223302,11.718897],[46.5221612,11.7184483],[46.5223053,11.717916],[46.5229106,11.7166847],[46.5227521,11.7152298],[46.5229388,11.7143993],[46.5229663,11.7134384],[46.5226549,11.7113291],[46.522754,11.7101558],[46.5229772,11.7096095],[46.5229401,11.7068562],[46.5227152,11.7063898],[46.5223057,11.7061399],[46.5223035,11.7056927],[46.5217899,11.7044137],[46.5216044,11.7033023],[46.5216745,11.7028223],[46.5218478,11.7024836],[46.5216406,11.7019291],[46.5213999,11.7016227],[46.5207474,11.7013102],[46.5201794,11.7004921],[46.5202058,11.700207],[46.520889,11.6996017],[46.5206451,11.6993953],[46.5207005,11.6993286],[46.5198748,11.6990614],[46.5195623,11.699198],[46.5193796,11.6988097],[46.5191214,11.6987547],[46.5172376,11.698975],[46.5169903,11.6992431],[46.5165125,11.6994135],[46.5161672,11.6994153],[46.5158425,11.6992193],[46.5140433,11.7004649],[46.5137411,11.700889],[46.513022,11.7010379],[46.5112981,11.7005251],[46.5109567,11.7002608],[46.5106402,11.7003906],[46.5103953,11.700144],[46.5102171,11.7002861],[46.5099738,11.7001614],[46.509671,11.700251],[46.5096273,11.7000417],[46.5093415,11.6999097],[46.5090318,11.6994949],[46.5087866,11.6988477],[46.5082833,11.698809],[46.5081548,11.6984675],[46.5081564,11.6979291],[46.5079411,11.6976834],[46.5062437,11.6983512],[46.505812,11.6987225],[46.5053223,11.6994616],[46.5047196,11.7006912],[46.5048986,11.7009971],[46.5051882,11.7005232],[46.5058145,11.7001731],[46.5063091,11.7001772],[46.5067494,11.7003961],[46.5071857,11.7011714],[46.5073013,11.7012083],[46.5076399,11.7021588],[46.5079683,11.7026024],[46.5081402,11.7033067],[46.5086096,11.7035925],[46.5085319,11.7037907],[46.5087126,11.7038556],[46.5085376,11.7044628],[46.5087889,11.7043576],[46.5087195,11.7045929],[46.5088763,11.7050563],[46.5092045,11.7048878],[46.5092308,11.705116],[46.5094971,11.7051593],[46.5101525,11.7056767],[46.5111851,11.7060493],[46.5114539,11.7064258],[46.5116344,11.7063879],[46.5115599,11.7067253],[46.5122437,11.7067238],[46.5124143,11.7068777],[46.5121386,11.7078366],[46.5119677,11.7080035],[46.5125473,11.7085512],[46.5124674,11.7087134],[46.5125268,11.708968],[46.5126115,11.708964],[46.5125309,11.7096706],[46.5127204,11.7107632],[46.5126277,11.7111331],[46.5127817,11.7116639],[46.5123873,11.7126717],[46.5123115,11.7133913],[46.512433,11.7136855],[46.511921,11.7148064],[46.5117684,11.7155668],[46.5120082,11.7162953],[46.5121234,11.7162575],[46.5121022,11.716571],[46.5122354,11.7169237],[46.5123629,11.7167242],[46.5124856,11.7168304],[46.5127881,11.7164187],[46.513198,11.7164284],[46.5057657,11.711161],[46.5052697,11.7119427],[46.5050713,11.7125121],[46.5047336,11.7125662],[46.5046206,11.7124128],[46.5041885,11.7127189],[46.5042695,11.7130891],[46.5045442,11.713485],[46.5045718,11.7139081],[46.5040057,11.7160753],[46.5038992,11.7166626],[46.503978,11.7167819],[46.5038457,11.7171541],[46.5036951,11.7172532],[46.5038636,11.7177538],[46.5036762,11.718658],[46.503775,11.7189477],[46.5039491,11.7190467],[46.5038917,11.7194414],[46.5042137,11.7198732],[46.5042275,11.7201413],[46.5038421,11.7205506],[46.5037892,11.7208388],[46.5033812,11.7214022],[46.5029637,11.7216173],[46.5029021,11.7223015],[46.503086,11.7225382],[46.5030765,11.7227479],[46.5025141,11.724452],[46.5021173,11.7249071],[46.5017418,11.7259399],[46.5017175,11.7265695],[46.50147,11.7270397],[46.5013253,11.7276335],[46.5013299,11.7290334],[46.5020143,11.7305783],[46.5021018,11.7310215],[46.5020573,11.7316776],[46.5016908,11.7327716],[46.5013252,11.7334671],[46.5003998,11.7340679],[46.5004488,11.7346161],[46.500988,11.7359465],[46.5004435,11.7359774],[46.4997826,11.7376156],[46.5003041,11.7388418],[46.5003541,11.7399653],[46.5004815,11.7404951],[46.5009434,11.7414822],[46.5010606,11.7420934],[46.5016117,11.7428477],[46.5020361,11.742753],[46.5012313,11.7436236],[46.5011771,11.7444325],[46.5009991,11.7450237],[46.5003743,11.7455391],[46.5000461,11.747296],[46.4996277,11.7483548],[46.5011283,11.7496],[46.5030045,11.7516768],[46.5032675,11.7518133],[46.503567,11.7516514],[46.503747,11.7517854],[46.5040449,11.7525293],[46.5043766,11.7528873],[46.505089,11.754332],[46.5053858,11.7552203],[46.5066131,11.7569677],[46.5066049,11.7571945],[46.5067535,11.7572729],[46.5068593,11.7576805],[46.5071869,11.758117],[46.5075086,11.7593163],[46.507927,11.7597035]],
    distance:18.18, elevation:null, hours:'5–6 (estimated - not source-verified)', paid:true,
    terrainType:'Alpine path, stays at lower elevation (avoids the Forcella climb)', terrainRank:1,
    elevationProfile:[], // TODO: no elevation data sourced yet
    surfaceHazards:['Road-walking section near the Passo Sella trailhead shares space with vehicle/bus traffic (SS242)','~5km bridging segment (via Alta Via 9 delle Dolomiti) has not been individually hazard-checked — treat with extra caution until verified'],
    shadeCoverage:null, heatRisk:null, safetyLevel:'moderate', exposure:false,
    waterSources:[], // TODO: likely passes near Rifugio Sasso Piatto/Comici area per official route description, not GPS-confirmed on this exact path
    rifugi:[],
    startPoint:{lat:46.5092544,lng:11.7574789,label:'Start here — Passo Sella, paid parking lot behind Hotel Passo Sella'},
    desc:"Route around the Sasso Lungo massif built from three verified OSM/Waymarked Trails sources (relations 9435720, 1640019, and a local bridging segment of Alta Via 9 delle Dolomiti, relation 11094256), deliberately avoiding trail 525 and the Forcella del Sassolungo climb — confirmed to stay 1.48km+ clear of the Forcella at every point, so there's no cable-assisted exposed section on this route. Confirmed dog-friendly for the official long variant of this hike via AllTrails (\"Dogs are welcome and may be off-leash in some areas\") — this route covers similar lower-elevation territory.",
    tips:"NOT a perfectly closed loop — a 225m gap remains between the start and end of the GPS track (down from 3.17km before adding the Alta Via 9 bridging segment), plus one internal ~920m jump partway through where two source segments meet. This is a long day out (18km) — better suited to fit dogs. The bridging segment hasn't been individually checked for hazards, so keep extra attention there until it's verified on the ground."
  },
  // --- Savoy, verified 2026-07-14 (promoted from OSM import; sources: Chartreuse
  //     Tourisme via Apidae, Waymarked Trails rel. 3982382, Visorando) ---
  {
    "id": "osm-3982382",
    "name": "Circuit Béatrice de Savoie",
    "area": "Chambéry",
    "lat": 45.43627,
    "lng": 5.75366,
    "osmRelation": 3982382,
    "waymarkedtrails": "https://hiking.waymarkedtrails.org/#route?id=3982382",
    "path": [
      [
        45.43627,
        5.75366
      ],
      [
        45.43622,
        5.75374
      ],
      [
        45.43623,
        5.7548
      ],
      [
        45.43672,
        5.75576
      ],
      [
        45.43729,
        5.75619
      ],
      [
        45.43767,
        5.7558
      ],
      [
        45.43819,
        5.75575
      ],
      [
        45.4381,
        5.75544
      ],
      [
        45.43872,
        5.75496
      ],
      [
        45.43881,
        5.75573
      ],
      [
        45.43924,
        5.75608
      ],
      [
        45.43954,
        5.75592
      ],
      [
        45.43985,
        5.75599
      ],
      [
        45.43997,
        5.7561
      ],
      [
        45.44046,
        5.75717
      ],
      [
        45.44093,
        5.75742
      ],
      [
        45.44108,
        5.75737
      ],
      [
        45.4415,
        5.75683
      ],
      [
        45.4419,
        5.75675
      ],
      [
        45.4422,
        5.75651
      ],
      [
        45.44261,
        5.75733
      ],
      [
        45.44273,
        5.75815
      ],
      [
        45.44297,
        5.75839
      ],
      [
        45.44346,
        5.75845
      ],
      [
        45.44379,
        5.75915
      ],
      [
        45.44399,
        5.7591
      ],
      [
        45.44418,
        5.75918
      ],
      [
        45.44463,
        5.75907
      ],
      [
        45.4452,
        5.75942
      ],
      [
        45.44546,
        5.76004
      ],
      [
        45.44569,
        5.76032
      ],
      [
        45.44636,
        5.76075
      ],
      [
        45.44654,
        5.76079
      ],
      [
        45.44688,
        5.76067
      ],
      [
        45.4472,
        5.75976
      ],
      [
        45.44727,
        5.75973
      ],
      [
        45.44773,
        5.76103
      ],
      [
        45.44786,
        5.76095
      ],
      [
        45.44805,
        5.7611
      ],
      [
        45.44841,
        5.76095
      ],
      [
        45.44864,
        5.76118
      ],
      [
        45.44845,
        5.76162
      ],
      [
        45.44805,
        5.7611
      ],
      [
        45.44815,
        5.76081
      ],
      [
        45.44844,
        5.76061
      ],
      [
        45.44847,
        5.76034
      ],
      [
        45.44875,
        5.76023
      ],
      [
        45.44886,
        5.76031
      ],
      [
        45.44901,
        5.76026
      ],
      [
        45.44956,
        5.75985
      ],
      [
        45.44936,
        5.75962
      ],
      [
        45.44914,
        5.75912
      ],
      [
        45.44909,
        5.75885
      ],
      [
        45.44915,
        5.75856
      ],
      [
        45.4494,
        5.75838
      ],
      [
        45.45005,
        5.75859
      ],
      [
        45.45013,
        5.7585
      ],
      [
        45.44914,
        5.75698
      ],
      [
        45.44863,
        5.7567
      ],
      [
        45.4484,
        5.75672
      ],
      [
        45.44801,
        5.75604
      ],
      [
        45.44732,
        5.75544
      ],
      [
        45.44621,
        5.75485
      ],
      [
        45.44444,
        5.75348
      ],
      [
        45.4434,
        5.75331
      ],
      [
        45.4434,
        5.75318
      ],
      [
        45.44229,
        5.75299
      ],
      [
        45.44221,
        5.7529
      ],
      [
        45.44087,
        5.75272
      ],
      [
        45.439,
        5.75324
      ],
      [
        45.43814,
        5.75362
      ],
      [
        45.43734,
        5.75318
      ],
      [
        45.43726,
        5.75346
      ],
      [
        45.43684,
        5.75346
      ]
    ],
    "distance": 4.5,
    "elevation": 145,
    "hours": "1.5–2",
    "paid": false,
    "terrainType": "Packed forest gravel & quiet village lanes",
    "terrainRank": 0,
    "elevationProfile": [
      {
        "km": 0,
        "elev": 392
      },
      {
        "km": 0.23,
        "elev": 406
      },
      {
        "km": 0.63,
        "elev": 433
      },
      {
        "km": 1.03,
        "elev": 464
      },
      {
        "km": 1.53,
        "elev": 491
      },
      {
        "km": 1.93,
        "elev": 529
      },
      {
        "km": 2.04,
        "elev": 529
      },
      {
        "km": 2.64,
        "elev": 427
      },
      {
        "km": 3.04,
        "elev": 408
      },
      {
        "km": 3.54,
        "elev": 391
      },
      {
        "km": 3.84,
        "elev": 389
      },
      {
        "km": 4.21,
        "elev": 392
      }
    ],
    "surfaceHazards": [],
    "shadeCoverage": 70,
    "heatRisk": "low",
    "safetyLevel": "low-risk",
    "exposure": false,
    "waterSources": [
      {
        "km": 0,
        "label": "Guiers Vif riverside at the trailhead"
      }
    ],
    "rifugi": [],
    "startPoint": {
      "lat": 45.436571,
      "lng": 5.753686,
      "label": "Start here: Rivièr'Alp leisure base parking, Place de la Corderie, Les Échelles"
    },
    "desc": "A short, mostly shaded loop above the village of Les Échelles, on the north-west edge of the Chartreuse regional park. From the Rivièr'Alp leisure base the trail passes the Cotterg pond and climbs through the Menuet forest on the GR9 to the Col de la Voûte and the Chapelle de la Madeleine viewpoint over the Chartreuse summits, then drops back down through Combe Noire. A waymarked circuit maintained by the Syndicat mixte de l'Avant-Pays Savoyard, listed as dog-friendly by Chartreuse Tourisme.",
    "tips": "Dogs stay on the leash here, that's the official rule. Keep them close on the two short road stretches too: the D921 crossing and the D1006 through the village centre both carry traffic. Forest cover keeps most of the loop cool, a lovely hot-day choice, though paths get slippery after rain. Signposted from May to November. No fountains up on the hill, so carry enough for your dog; the riverside by the start is the one reliable drink-and-splash spot. No car? The T41 bus between Chambéry and Voiron stops at Les Échelles Place. One map note: in three short stretches near the top, our route line straightens where the source map data has small gaps. On the ground the waymarking is continuous, so just follow the signs.",
    "imageIcon": "images/circuit-beatrice-de-savoie.webp",
    "imageCredit": {
      "text": "La Vie Nouvelle (edited)",
      "url": "https://www.la-vie-nouvelle.fr/2024/06/le-circuit-beatrice-de-savoie-depuis-les-echelles/"
    }
  },
  // --- Savoy, verified 2026-07-14 (promoted from OSM import; sources: Office de
  //     Tourisme de Passy via Apidae, Waymarked Trails rel. 6250300) ---
  {
    "id": "osm-6250300",
    "name": "Boucle du Lac Vert",
    "area": "Passy",
    "lat": 45.94953,
    "lng": 6.74153,
    "osmRelation": 6250300,
    "waymarkedtrails": "https://hiking.waymarkedtrails.org/#route?id=6250300",
    "path": [
      [
        45.94953,
        6.74153
      ],
      [
        45.94943,
        6.74146
      ],
      [
        45.94934,
        6.7415
      ],
      [
        45.94915,
        6.74187
      ],
      [
        45.94871,
        6.74216
      ],
      [
        45.94832,
        6.74278
      ],
      [
        45.94823,
        6.74307
      ],
      [
        45.94828,
        6.74385
      ],
      [
        45.94817,
        6.74443
      ],
      [
        45.94839,
        6.74515
      ],
      [
        45.9484,
        6.7456
      ],
      [
        45.94865,
        6.74611
      ],
      [
        45.94853,
        6.74659
      ],
      [
        45.94856,
        6.74701
      ],
      [
        45.94839,
        6.74756
      ],
      [
        45.94836,
        6.74817
      ],
      [
        45.94873,
        6.74917
      ],
      [
        45.94893,
        6.74932
      ],
      [
        45.94938,
        6.74945
      ],
      [
        45.94954,
        6.74972
      ],
      [
        45.94958,
        6.75008
      ],
      [
        45.95014,
        6.75125
      ],
      [
        45.95033,
        6.75145
      ],
      [
        45.95057,
        6.75146
      ],
      [
        45.95078,
        6.75164
      ],
      [
        45.95098,
        6.75192
      ],
      [
        45.95107,
        6.75236
      ],
      [
        45.95095,
        6.75336
      ],
      [
        45.95097,
        6.75436
      ],
      [
        45.95105,
        6.7548
      ],
      [
        45.95092,
        6.75548
      ],
      [
        45.95076,
        6.75578
      ],
      [
        45.95052,
        6.75582
      ],
      [
        45.95017,
        6.75612
      ],
      [
        45.95002,
        6.75673
      ],
      [
        45.94989,
        6.75617
      ],
      [
        45.94962,
        6.75577
      ],
      [
        45.94968,
        6.7552
      ],
      [
        45.94963,
        6.75495
      ],
      [
        45.94933,
        6.75466
      ],
      [
        45.94902,
        6.75459
      ],
      [
        45.94892,
        6.75431
      ],
      [
        45.9488,
        6.75421
      ],
      [
        45.94874,
        6.75362
      ],
      [
        45.94908,
        6.75356
      ],
      [
        45.94929,
        6.75361
      ],
      [
        45.9494,
        6.75394
      ],
      [
        45.94968,
        6.75393
      ],
      [
        45.94991,
        6.75426
      ],
      [
        45.95021,
        6.7544
      ],
      [
        45.95028,
        6.75423
      ],
      [
        45.95021,
        6.75367
      ],
      [
        45.95021,
        6.75367
      ],
      [
        45.9503,
        6.75334
      ],
      [
        45.95054,
        6.75293
      ],
      [
        45.95065,
        6.7525
      ],
      [
        45.95037,
        6.75213
      ],
      [
        45.95007,
        6.75204
      ],
      [
        45.94983,
        6.75216
      ],
      [
        45.94956,
        6.75263
      ],
      [
        45.94929,
        6.75361
      ],
      [
        45.94874,
        6.75362
      ],
      [
        45.94911,
        6.75221
      ],
      [
        45.94959,
        6.75143
      ],
      [
        45.94926,
        6.75038
      ],
      [
        45.94954,
        6.74972
      ],
      [
        45.94931,
        6.7494
      ],
      [
        45.94893,
        6.74932
      ],
      [
        45.94873,
        6.74917
      ],
      [
        45.9484,
        6.74838
      ],
      [
        45.94839,
        6.74756
      ],
      [
        45.94856,
        6.74701
      ],
      [
        45.94853,
        6.74659
      ],
      [
        45.94865,
        6.74611
      ],
      [
        45.9484,
        6.7456
      ],
      [
        45.94839,
        6.74515
      ],
      [
        45.94817,
        6.74443
      ],
      [
        45.94828,
        6.74385
      ],
      [
        45.94823,
        6.74307
      ],
      [
        45.94832,
        6.74278
      ],
      [
        45.94871,
        6.74216
      ],
      [
        45.94915,
        6.74187
      ],
      [
        45.94934,
        6.7415
      ],
      [
        45.94943,
        6.74146
      ],
      [
        45.94953,
        6.74153
      ]
    ],
    "distance": 3.6,
    "elevation": 140,
    "hours": "1–1.5",
    "paid": false,
    "terrainType": "Forest gravel and dirt paths, wooden boardwalks around the lake",
    "terrainRank": 0,
    "elevationProfile": [
      {
        "km": 0.04,
        "elev": 1353
      },
      {
        "km": 0.34,
        "elev": 1333
      },
      {
        "km": 0.54,
        "elev": 1343
      },
      {
        "km": 0.84,
        "elev": 1318
      },
      {
        "km": 1.14,
        "elev": 1335
      },
      {
        "km": 1.44,
        "elev": 1307
      },
      {
        "km": 1.64,
        "elev": 1278
      },
      {
        "km": 1.94,
        "elev": 1278
      },
      {
        "km": 2.24,
        "elev": 1311
      },
      {
        "km": 2.54,
        "elev": 1288
      },
      {
        "km": 2.84,
        "elev": 1327
      },
      {
        "km": 3.04,
        "elev": 1343
      },
      {
        "km": 3.34,
        "elev": 1332
      },
      {
        "km": 3.35,
        "elev": 1332
      },
      {
        "km": 3.61,
        "elev": 1353
      }
    ],
    "surfaceHazards": [],
    "shadeCoverage": 70,
    "heatRisk": "low",
    "safetyLevel": "low-risk",
    "exposure": false,
    "waterSources": [
      {
        "km": 1.64,
        "label": "Drinking water (OSM-verified location)"
      },
      {
        "km": 3.35,
        "label": "Aire naturelle de camping de Passy Plaine-Joux"
      },
      {
        "km": 3.55,
        "label": "Drinking water (OSM-verified location)"
      }
    ],
    "rifugi": [
      {
        "km": 0.3,
        "name": "Restaurant du Lac Vert"
      }
    ],
    "startPoint": {
      "lat": 45.94953,
      "lng": 6.74153,
      "label": "Start here: loop edge nearest the Plaine-Joux parking (321 chemin des Parchets, Passy), about 250 m via the link path"
    },
    "desc": "An easy loop at 1,300 m around Passy's famous emerald lake, where Mont Blanc reflects in water so clear you can see the sunken trunks below the surface. Wooden boardwalks carry the path around the shore, then gravel tracks swing west through the conifers beneath the Fiz cliffs. A protected natural site and an official Passy circuit, listed by the tourist office as dog-friendly on leash.",
    "tips": "Two rules to know: dogs stay on the leash, and they're not allowed in or on the lake. Swimming is forbidden for humans too, so despite the name there's no swim stop; three drinking-water points along the way (marked on the map) cover your dog instead. Skip the temptation to extend towards Lac de Pormenaz: the Passy nature reserve up there bans dogs entirely. The lake draws big crowds, so come early for a quiet lap, and mind the boardwalks when wet. The access road closes in winter. Restaurant du Lac Vert sits right by the water for a post-walk stop.",
    "imageIcon": "images/boucle-du-lac-vert.webp",
    "imageCredit": {
      "text": "Mangatome, CC BY-SA 3.0, via Wikimedia Commons (edited)",
      "url": "https://commons.wikimedia.org/wiki/File:Lac_vert_de_passy_(1).JPG"
    }
  },
  // --- Savoy, verified 2026-07-14 (promoted from OSM import; sources: Office de
  //     Tourisme de la Grande Plagne fiche, Waymarked Trails rel. 9933643) ---
  {
    "id": "osm-9933643",
    "name": "Le Lac Vert",
    "area": "La Plagne",
    "lat": 45.50741,
    "lng": 6.67658,
    "osmRelation": 9933643,
    "waymarkedtrails": "https://hiking.waymarkedtrails.org/#route?id=9933643",
    "path": [
      [
        45.50741,
        6.67658
      ],
      [
        45.50766,
        6.67672
      ],
      [
        45.50788,
        6.67704
      ],
      [
        45.50797,
        6.67751
      ],
      [
        45.50801,
        6.67878
      ],
      [
        45.50853,
        6.67989
      ],
      [
        45.50881,
        6.68014
      ],
      [
        45.50913,
        6.68023
      ],
      [
        45.50941,
        6.68015
      ],
      [
        45.50976,
        6.67989
      ],
      [
        45.50959,
        6.67998
      ],
      [
        45.51013,
        6.67978
      ],
      [
        45.51073,
        6.6797
      ],
      [
        45.51064,
        6.67954
      ],
      [
        45.51037,
        6.67954
      ],
      [
        45.5096,
        6.67924
      ],
      [
        45.50928,
        6.67869
      ],
      [
        45.509,
        6.67845
      ],
      [
        45.50891,
        6.67823
      ],
      [
        45.50873,
        6.67686
      ],
      [
        45.50828,
        6.67527
      ],
      [
        45.50832,
        6.67522
      ],
      [
        45.50857,
        6.67536
      ],
      [
        45.50866,
        6.67527
      ],
      [
        45.50852,
        6.67438
      ],
      [
        45.50863,
        6.67395
      ],
      [
        45.50885,
        6.67377
      ],
      [
        45.50879,
        6.67353
      ],
      [
        45.50894,
        6.6733
      ],
      [
        45.50928,
        6.67312
      ],
      [
        45.50962,
        6.67322
      ],
      [
        45.50974,
        6.67315
      ],
      [
        45.51006,
        6.67317
      ],
      [
        45.51049,
        6.67329
      ],
      [
        45.51203,
        6.67294
      ],
      [
        45.51219,
        6.67257
      ],
      [
        45.51218,
        6.67219
      ],
      [
        45.51261,
        6.67232
      ],
      [
        45.5129,
        6.67203
      ],
      [
        45.51314,
        6.67195
      ],
      [
        45.5129,
        6.6719
      ],
      [
        45.5126,
        6.672
      ],
      [
        45.51253,
        6.67195
      ],
      [
        45.51276,
        6.67161
      ],
      [
        45.51305,
        6.67147
      ],
      [
        45.5127,
        6.67138
      ],
      [
        45.51247,
        6.67154
      ],
      [
        45.51264,
        6.67116
      ],
      [
        45.51286,
        6.6712
      ],
      [
        45.513,
        6.67112
      ],
      [
        45.51282,
        6.67104
      ],
      [
        45.51273,
        6.67076
      ],
      [
        45.51236,
        6.67088
      ],
      [
        45.51258,
        6.67029
      ],
      [
        45.51281,
        6.67027
      ],
      [
        45.51252,
        6.67014
      ],
      [
        45.51239,
        6.67015
      ],
      [
        45.51231,
        6.67026
      ],
      [
        45.51229,
        6.67001
      ],
      [
        45.51259,
        6.66986
      ],
      [
        45.51262,
        6.66971
      ],
      [
        45.51243,
        6.66974
      ],
      [
        45.51281,
        6.66945
      ],
      [
        45.5128,
        6.66933
      ],
      [
        45.51226,
        6.66942
      ],
      [
        45.5121,
        6.66914
      ],
      [
        45.51157,
        6.66865
      ],
      [
        45.51158,
        6.66858
      ],
      [
        45.51174,
        6.66857
      ],
      [
        45.5116,
        6.66843
      ],
      [
        45.51172,
        6.66822
      ],
      [
        45.51217,
        6.66799
      ],
      [
        45.51217,
        6.66769
      ],
      [
        45.51235,
        6.66733
      ],
      [
        45.51177,
        6.66752
      ],
      [
        45.51096,
        6.66824
      ],
      [
        45.51015,
        6.66925
      ],
      [
        45.50995,
        6.6694
      ],
      [
        45.50974,
        6.66918
      ],
      [
        45.50959,
        6.66926
      ],
      [
        45.50906,
        6.6691
      ],
      [
        45.50882,
        6.66894
      ],
      [
        45.50846,
        6.66798
      ],
      [
        45.50809,
        6.66825
      ],
      [
        45.50788,
        6.669
      ],
      [
        45.50751,
        6.66947
      ],
      [
        45.50717,
        6.66963
      ],
      [
        45.50657,
        6.66965
      ],
      [
        45.50592,
        6.67013
      ],
      [
        45.50543,
        6.67162
      ],
      [
        45.50512,
        6.67215
      ],
      [
        45.50498,
        6.6731
      ],
      [
        45.50508,
        6.67359
      ],
      [
        45.50493,
        6.67378
      ],
      [
        45.50494,
        6.67407
      ],
      [
        45.5051,
        6.67502
      ],
      [
        45.50523,
        6.67526
      ],
      [
        45.50542,
        6.676
      ],
      [
        45.5066,
        6.67537
      ],
      [
        45.50677,
        6.67531
      ],
      [
        45.50695,
        6.67601
      ],
      [
        45.50725,
        6.67642
      ],
      [
        45.50725,
        6.6766
      ],
      [
        45.50733,
        6.67665
      ],
      [
        45.50741,
        6.67658
      ]
    ],
    "distance": 4.5,
    "elevation": 209,
    "hours": "1.5",
    "paid": false,
    "terrainType": "Resort paths and tracks, roughly half paved, half natural ground",
    "terrainRank": 0,
    "elevationProfile": [
      {
        "km": 0.1,
        "elev": 1938
      },
      {
        "km": 0.4,
        "elev": 1941
      },
      {
        "km": 0.8,
        "elev": 1916
      },
      {
        "km": 1.1,
        "elev": 1913
      },
      {
        "km": 1.5,
        "elev": 1949
      },
      {
        "km": 1.8,
        "elev": 1946
      },
      {
        "km": 2.1,
        "elev": 1977
      },
      {
        "km": 2.5,
        "elev": 2011
      },
      {
        "km": 2.5,
        "elev": 2020
      },
      {
        "km": 2.9,
        "elev": 2035
      },
      {
        "km": 3.2,
        "elev": 2060
      },
      {
        "km": 3.5,
        "elev": 2066
      },
      {
        "km": 3.9,
        "elev": 2010
      },
      {
        "km": 4.2,
        "elev": 1982
      },
      {
        "km": 4.53,
        "elev": 1938
      }
    ],
    "surfaceHazards": [],
    "shadeCoverage": 30,
    "heatRisk": "moderate",
    "safetyLevel": "low-risk",
    "exposure": false,
    "waterSources": [],
    "rifugi": [
      {
        "km": 3.6,
        "name": "Manaka Bar"
      },
      {
        "km": 3.9,
        "name": "Araucaria"
      },
      {
        "km": 3.9,
        "name": "Scotty's Bar"
      },
      {
        "km": 4.0,
        "name": "Le Brix, Bar à Bières & Cocktails"
      },
      {
        "km": 4.2,
        "name": "Luna Bar"
      },
      {
        "km": 4.2,
        "name": "Cafe de Montagne"
      }
    ],
    "startPoint": {
      "lat": 45.50741,
      "lng": 6.67658,
      "label": "Start here: war memorial (WW2 parachute drop) in Plagne Centre, by the shuttle stop and parking"
    },
    "imagePlaceholder": true,
    "desc": "A family loop from Plagne Centre at 2,000 m in the Tarentaise: down through the larches, across a stream, and up to the little Lac Vert with its Mont Blanc view, orientation table and picnic meadows, before returning past Plagne Aime 2000 and the Jean-Luc Cretier slalom slope. An official La Plagne resort circuit, rated green and easy; the tourist office lists dogs as welcome.",
    "tips": "No leash rule is published for this loop, but keep one handy: several stretches follow or cross the resort road, and the lake meadow fills with picnics and barbecues in season, so keep dogs out of the water (swimming is banned anyway). The path out of the village drops very steeply for about ten minutes; the road variant avoids it and suits all-terrain strollers. No fountains are mapped, so carry water; the stream crossing at the bottom is the natural drink stop. The tourist office quotes 3.4 km, while our mapped route measures 4.5 km with all its twists. Officially signposted daily from early July to late August, and the Telemetro lift can shortcut Aime 2000 back to the village."
  },
  // --- Savoy, verified 2026-07-14 (promoted from OSM import; sources: Syndicat
  //     Mixte des Glieres fiche, Waymarked Trails rel. 10116283, Haute-Savoie pastoral rules) ---
  {
    "id": "osm-10116283",
    "name": "Itinéraire de découverte historique",
    "area": "Plateau des Glières",
    "lat": 45.9661854,
    "lng": 6.3313277,
    "osmRelation": 10116283,
    "waymarkedtrails": "https://hiking.waymarkedtrails.org/#route?id=10116283",
    "path": [
      [
        45.96619,
        6.33133
      ],
      [
        45.96528,
        6.33255
      ],
      [
        45.96513,
        6.33282
      ],
      [
        45.96505,
        6.33346
      ],
      [
        45.96513,
        6.33386
      ],
      [
        45.96459,
        6.33336
      ],
      [
        45.96415,
        6.33276
      ],
      [
        45.96416,
        6.33302
      ],
      [
        45.96388,
        6.33381
      ],
      [
        45.9639,
        6.33464
      ],
      [
        45.96416,
        6.33474
      ],
      [
        45.96467,
        6.3353
      ],
      [
        45.96678,
        6.33835
      ],
      [
        45.9673,
        6.33933
      ],
      [
        45.96782,
        6.33967
      ],
      [
        45.96799,
        6.34022
      ],
      [
        45.96823,
        6.3407
      ],
      [
        45.96914,
        6.33981
      ],
      [
        45.97053,
        6.34226
      ],
      [
        45.97113,
        6.3419
      ],
      [
        45.97063,
        6.34061
      ],
      [
        45.97068,
        6.33991
      ],
      [
        45.97011,
        6.33775
      ],
      [
        45.96954,
        6.33607
      ],
      [
        45.96905,
        6.33527
      ],
      [
        45.96676,
        6.33228
      ],
      [
        45.96619,
        6.33133
      ]
    ],
    "distance": 2.7,
    "elevation": 50,
    "hours": "1–1.5",
    "paid": false,
    "terrainType": "Plateau tracks, meadow paths and wooden boardwalks",
    "terrainRank": 0,
    "elevationProfile": [
      {
        "km": 0,
        "elev": 1457
      },
      {
        "km": 0.2,
        "elev": 1428
      },
      {
        "km": 0.2,
        "elev": 1426
      },
      {
        "km": 0.4,
        "elev": 1433
      },
      {
        "km": 0.5,
        "elev": 1439
      },
      {
        "km": 0.6,
        "elev": 1433
      },
      {
        "km": 1,
        "elev": 1409
      },
      {
        "km": 1.1,
        "elev": 1403
      },
      {
        "km": 1.2,
        "elev": 1404
      },
      {
        "km": 1.6,
        "elev": 1402
      },
      {
        "km": 1.8,
        "elev": 1399
      },
      {
        "km": 2,
        "elev": 1418
      },
      {
        "km": 2.2,
        "elev": 1426
      },
      {
        "km": 2.7,
        "elev": 1457
      }
    ],
    "surfaceHazards": [],
    "shadeCoverage": 15,
    "heatRisk": "moderate",
    "safetyLevel": "low-risk",
    "exposure": false,
    "waterSources": [],
    "rifugi": [],
    "startPoint": {
      "lat": 45.9661854,
      "lng": 6.3313277,
      "label": "Start here: col des Glières parking, 150 m past the Maison du Plateau"
    },
    "desc": "A gentle history walk across the Plateau des Glières at 1,450 m, where 465 Resistance fighters gathered in the winter of 1944 to receive Allied parachute drops. Eleven panels along the loop tell how the maquisards lived, past the ruins of their chalets, before the finish at the National Resistance Monument. Between the stories it is a lovely open alpine plateau of meadows, a small conifer wood, and boardwalks over the peat bogs.",
    "tips": "Dogs are welcome on the plateau but the leash is required, and it matters here: the alpages are worked from June to September, so expect herds and possibly patou guard dogs. Give any flock a wide berth, even if it means leaving the path briefly, and keep calm around the big white dogs. Otherwise stay on the trail and boardwalks, as the peat bogs are fragile and protected. Almost no shade, so plan around the midday sun, and carry water since no fountains are mapped; the Maison du Plateau at the start has refreshments and local produce. Best from spring to autumn: in winter the plateau becomes a nordic ski domain. Free guided visits of the historic sites can be booked.",
    "imageIcon": "images/itineraire-de-decouverte-historique.webp",
    "imageCredit": {
      "text": "Guilhem Vellut, CC BY 2.0, via Wikimedia Commons (edited)",
      "url": "https://commons.wikimedia.org/wiki/File:Plateau_des_Gli%C3%A8res_(51177345320).jpg"
    }
  },
  // --- Savoy, verified 2026-07-14 (promoted from OSM import; sources: Waymarked Trails rel. 10116380, Glieres plateau rules) ---
  {
    "id": "osm-10116380",
    "name": "Itinéraire découverte de la nature",
    "area": "Plateau des Glières",
    "lat": 45.9651261,
    "lng": 6.3338562,
    "osmRelation": 10116380,
    "waymarkedtrails": "https://hiking.waymarkedtrails.org/#route?id=10116380",
    "path": [
      [
        45.96513,
        6.33386
      ],
      [
        45.96459,
        6.33336
      ],
      [
        45.96415,
        6.33276
      ],
      [
        45.96416,
        6.33302
      ],
      [
        45.96392,
        6.33363
      ],
      [
        45.96387,
        6.33404
      ],
      [
        45.96389,
        6.33541
      ],
      [
        45.9641,
        6.3363
      ],
      [
        45.96469,
        6.33733
      ],
      [
        45.96486,
        6.33778
      ],
      [
        45.96491,
        6.33842
      ],
      [
        45.96562,
        6.33977
      ],
      [
        45.96606,
        6.34009
      ],
      [
        45.96687,
        6.33969
      ],
      [
        45.96727,
        6.33926
      ],
      [
        45.96678,
        6.33835
      ],
      [
        45.96467,
        6.3353
      ],
      [
        45.96416,
        6.33474
      ],
      [
        45.9639,
        6.33464
      ],
      [
        45.96587,
        6.34042
      ],
      [
        45.96641,
        6.34118
      ],
      [
        45.96661,
        6.34199
      ],
      [
        45.96655,
        6.3422
      ],
      [
        45.96662,
        6.34241
      ],
      [
        45.96662,
        6.34341
      ],
      [
        45.96675,
        6.34367
      ],
      [
        45.96785,
        6.34422
      ],
      [
        45.96778,
        6.34434
      ],
      [
        45.96779,
        6.34461
      ],
      [
        45.96795,
        6.34471
      ],
      [
        45.96841,
        6.34559
      ],
      [
        45.96842,
        6.34626
      ],
      [
        45.96832,
        6.34684
      ],
      [
        45.96846,
        6.34702
      ],
      [
        45.96857,
        6.34709
      ],
      [
        45.96878,
        6.34694
      ],
      [
        45.96912,
        6.3469
      ],
      [
        45.96977,
        6.3473
      ],
      [
        45.9699,
        6.34698
      ],
      [
        45.96978,
        6.34634
      ],
      [
        45.96989,
        6.34627
      ],
      [
        45.97017,
        6.3466
      ],
      [
        45.97041,
        6.34666
      ],
      [
        45.97078,
        6.34723
      ],
      [
        45.97092,
        6.34689
      ],
      [
        45.97148,
        6.34675
      ],
      [
        45.97215,
        6.34599
      ],
      [
        45.97182,
        6.34518
      ],
      [
        45.97191,
        6.34415
      ],
      [
        45.97161,
        6.3435
      ],
      [
        45.97113,
        6.3419
      ],
      [
        45.97053,
        6.34226
      ],
      [
        45.96914,
        6.33981
      ],
      [
        45.96823,
        6.3407
      ],
      [
        45.96799,
        6.34022
      ],
      [
        45.96784,
        6.3397
      ],
      [
        45.96727,
        6.33926
      ]
    ],
    "distance": 4.2,
    "elevation": 95,
    "hours": "1–1.5",
    "paid": false,
    "terrainType": "Meadow and forest paths on natural ground, short boardwalk and gravel sections",
    "terrainRank": 0,
    "elevationProfile": [
      {
        "km": 0,
        "elev": 1426
      },
      {
        "km": 0.2,
        "elev": 1439
      },
      {
        "km": 0.5,
        "elev": 1428
      },
      {
        "km": 0.8,
        "elev": 1408
      },
      {
        "km": 1.4,
        "elev": 1432
      },
      {
        "km": 2.1,
        "elev": 1413
      },
      {
        "km": 2.2,
        "elev": 1418
      },
      {
        "km": 2.4,
        "elev": 1404
      },
      {
        "km": 2.6,
        "elev": 1401
      },
      {
        "km": 2.7,
        "elev": 1394
      },
      {
        "km": 2.9,
        "elev": 1393
      },
      {
        "km": 3.1,
        "elev": 1394
      },
      {
        "km": 3.4,
        "elev": 1392
      },
      {
        "km": 3.9,
        "elev": 1406
      },
      {
        "km": 4.2,
        "elev": 1413
      }
    ],
    "surfaceHazards": [],
    "shadeCoverage": 35,
    "heatRisk": "moderate",
    "safetyLevel": "low-risk",
    "exposure": false,
    "waterSources": [],
    "rifugi": [],
    "startPoint": {
      "lat": 45.9651261,
      "lng": 6.3338562,
      "label": "Start here: on the plateau path, about 200 m from the col des Glières parking and the Maison du Plateau"
    },
    "imageIcon": "images/itineraire-decouverte-de-la-nature.webp",
    "imageCredit": {
      "text": "Guilhem Vellut, CC BY 2.0, via Wikimedia Commons (edited)",
      "url": "https://commons.wikimedia.org/wiki/File:Plateau_des_Gli%C3%A8res_(51176314526).jpg"
    },
    "desc": "The nature-themed twin of the plateau's history walk: an easy wander across the Plateau des Glières at 1,400 m, through flower meadows, conifer stands and past the protected peat bogs, with interpretive panels on the mountain flora and fauna along the way. Gentle gradients and soft ground underfoot make it one of the plateau's most relaxed outings.",
    "tips": "Dogs are welcome on the plateau with the leash required, and the alpages are worked from June to September, so expect herds and possibly patou guard dogs; give any flock a wide berth and stay calm around the big white dogs. Keep to the path and boardwalks, since the peat bogs are fragile and protected. Shade comes and goes between the woods and open meadow, and no fountains are mapped, so carry water; the Maison du Plateau near the start has refreshments. One short stretch of the mapped route has a small gap in the source data, so the line briefly straightens; the waymarking on the ground is continuous. In winter the plateau becomes a nordic ski domain."
  },
  // --- Savoy, verified 2026-07-14 (promoted from OSM import; sources: trails-viewer D+733, Chemins du Maquis, Waymarked Trails rel. 20347406) ---
  {
    "id": "osm-20347406",
    "name": "Sentier des Patriotes",
    "area": "Plateau des Glières",
    "lat": 45.9661854,
    "lng": 6.3313277,
    "osmRelation": 20347406,
    "waymarkedtrails": "https://hiking.waymarkedtrails.org/#route?id=20347406",
    "path": [
      [
        45.96619,
        6.33133
      ],
      [
        45.96627,
        6.332
      ],
      [
        45.96647,
        6.33224
      ],
      [
        45.96648,
        6.33237
      ],
      [
        45.96619,
        6.33248
      ],
      [
        45.96553,
        6.33243
      ],
      [
        45.96524,
        6.33259
      ],
      [
        45.96513,
        6.33282
      ],
      [
        45.96505,
        6.33346
      ],
      [
        45.96513,
        6.33386
      ],
      [
        45.96459,
        6.33336
      ],
      [
        45.96415,
        6.33276
      ],
      [
        45.96416,
        6.33302
      ],
      [
        45.96388,
        6.33381
      ],
      [
        45.9639,
        6.33464
      ],
      [
        45.96416,
        6.33474
      ],
      [
        45.96467,
        6.3353
      ],
      [
        45.96678,
        6.33835
      ],
      [
        45.9673,
        6.33933
      ],
      [
        45.96782,
        6.33967
      ],
      [
        45.96799,
        6.34022
      ],
      [
        45.96823,
        6.3407
      ],
      [
        45.96914,
        6.33981
      ],
      [
        45.97053,
        6.34226
      ],
      [
        45.97113,
        6.3419
      ],
      [
        45.97161,
        6.3435
      ],
      [
        45.97191,
        6.34415
      ],
      [
        45.97182,
        6.34518
      ],
      [
        45.97214,
        6.34595
      ],
      [
        45.97235,
        6.34695
      ],
      [
        45.9728,
        6.34779
      ],
      [
        45.97329,
        6.34846
      ],
      [
        45.97358,
        6.34936
      ],
      [
        45.97394,
        6.35003
      ],
      [
        45.97404,
        6.34998
      ],
      [
        45.97417,
        6.35005
      ],
      [
        45.97441,
        6.35074
      ],
      [
        45.97453,
        6.3508
      ],
      [
        45.97574,
        6.34931
      ],
      [
        45.97585,
        6.34927
      ],
      [
        45.97597,
        6.34936
      ],
      [
        45.97682,
        6.3514
      ],
      [
        45.97742,
        6.35203
      ],
      [
        45.9786,
        6.35372
      ],
      [
        45.97939,
        6.35513
      ],
      [
        45.97982,
        6.35524
      ],
      [
        45.98035,
        6.3559
      ],
      [
        45.98355,
        6.36244
      ],
      [
        45.98399,
        6.36382
      ],
      [
        45.9844,
        6.36453
      ],
      [
        45.9851,
        6.36495
      ],
      [
        45.98561,
        6.36496
      ],
      [
        45.98625,
        6.36566
      ],
      [
        45.98656,
        6.36615
      ],
      [
        45.98659,
        6.36665
      ],
      [
        45.98739,
        6.36805
      ],
      [
        45.98755,
        6.36877
      ],
      [
        45.98783,
        6.36946
      ],
      [
        45.9883,
        6.37122
      ],
      [
        45.98833,
        6.37177
      ],
      [
        45.98823,
        6.37205
      ],
      [
        45.98799,
        6.37237
      ],
      [
        45.98803,
        6.37253
      ],
      [
        45.98839,
        6.37335
      ],
      [
        45.98913,
        6.37467
      ],
      [
        45.98899,
        6.37516
      ],
      [
        45.98868,
        6.37532
      ],
      [
        45.98896,
        6.37545
      ],
      [
        45.98909,
        6.3757
      ],
      [
        45.98947,
        6.37603
      ],
      [
        45.98965,
        6.37677
      ],
      [
        45.98979,
        6.37703
      ],
      [
        45.98981,
        6.37737
      ],
      [
        45.99022,
        6.37768
      ],
      [
        45.99049,
        6.37807
      ],
      [
        45.99063,
        6.37863
      ],
      [
        45.99113,
        6.37886
      ],
      [
        45.99106,
        6.37901
      ],
      [
        45.99135,
        6.37921
      ],
      [
        45.99099,
        6.37949
      ],
      [
        45.99138,
        6.37989
      ],
      [
        45.99144,
        6.38056
      ],
      [
        45.99159,
        6.38093
      ],
      [
        45.99162,
        6.38136
      ],
      [
        45.99132,
        6.38128
      ],
      [
        45.99108,
        6.38096
      ],
      [
        45.99077,
        6.38105
      ],
      [
        45.99071,
        6.38112
      ],
      [
        45.99077,
        6.38141
      ],
      [
        45.99062,
        6.38179
      ],
      [
        45.99029,
        6.38202
      ],
      [
        45.99015,
        6.38234
      ],
      [
        45.99068,
        6.38239
      ],
      [
        45.99053,
        6.38267
      ],
      [
        45.99068,
        6.38283
      ],
      [
        45.99087,
        6.38389
      ],
      [
        45.9905,
        6.38339
      ],
      [
        45.99067,
        6.38414
      ],
      [
        45.99038,
        6.384
      ],
      [
        45.99022,
        6.38377
      ],
      [
        45.99017,
        6.38381
      ],
      [
        45.99027,
        6.38446
      ],
      [
        45.99085,
        6.38533
      ],
      [
        45.99076,
        6.38539
      ],
      [
        45.99088,
        6.38568
      ],
      [
        45.99101,
        6.38576
      ],
      [
        45.99091,
        6.38583
      ],
      [
        45.99092,
        6.38594
      ],
      [
        45.99114,
        6.38621
      ],
      [
        45.99157,
        6.38643
      ],
      [
        45.99189,
        6.38621
      ],
      [
        45.99201,
        6.38591
      ],
      [
        45.99222,
        6.38587
      ],
      [
        45.99234,
        6.38603
      ],
      [
        45.99259,
        6.38606
      ],
      [
        45.99327,
        6.38594
      ],
      [
        45.99427,
        6.38588
      ],
      [
        45.9948,
        6.38571
      ],
      [
        45.99537,
        6.3858
      ],
      [
        45.99567,
        6.386
      ],
      [
        45.9961,
        6.3861
      ],
      [
        45.99618,
        6.38624
      ],
      [
        45.99628,
        6.38716
      ],
      [
        45.99648,
        6.38753
      ],
      [
        45.99645,
        6.38785
      ],
      [
        45.99659,
        6.38866
      ],
      [
        45.99687,
        6.38807
      ],
      [
        45.99704,
        6.38802
      ],
      [
        45.99764,
        6.38872
      ],
      [
        45.99813,
        6.38898
      ],
      [
        45.99831,
        6.38923
      ],
      [
        45.99862,
        6.3893
      ],
      [
        45.99873,
        6.38971
      ],
      [
        45.99898,
        6.38992
      ],
      [
        45.999,
        6.39024
      ],
      [
        45.9991,
        6.39042
      ],
      [
        45.99982,
        6.39087
      ],
      [
        45.99991,
        6.39113
      ],
      [
        46.00009,
        6.3913
      ],
      [
        46.0006,
        6.39167
      ],
      [
        46.00075,
        6.3917
      ],
      [
        46.00093,
        6.39193
      ],
      [
        46.00151,
        6.39237
      ],
      [
        46.0027,
        6.39317
      ],
      [
        46.00259,
        6.394
      ],
      [
        46.00272,
        6.39416
      ],
      [
        46.00336,
        6.39433
      ],
      [
        46.00411,
        6.39434
      ],
      [
        46.00454,
        6.39426
      ]
    ],
    "distance": 8.9,
    "elevation": 730,
    "hours": "2.5–3",
    "paid": false,
    "terrainType": "Mountain path and forest tracks, sparsely mapped surfaces; expect rough ground",
    "terrainRank": 1,
    "surfaceHazards": [
      "Sustained 700 m descent (or climb) between the plateau and the valley"
    ],
    "safetyLevel": "moderate",
    "exposure": false,
    "waterSources": [
      {
        "km": 8.8,
        "label": "Drinking water (OSM-verified location)"
      }
    ],
    "rifugi": [],
    "startPoint": {
      "lat": 45.9661854,
      "lng": 6.3313277,
      "label": "Start here: col des Glières parking, by the Maison du Plateau (route descends to Glières-Val-de-Borne)"
    },
    "imageIcon": "images/sentier-des-patriotes.webp",
    "imageCredit": {
      "text": "Guilhem Vellut, CC BY 2.0, via Wikimedia Commons (edited)",
      "url": "https://commons.wikimedia.org/wiki/File:Plateau_des_Gli%C3%A8res_(51177102199).jpg"
    },
    "desc": "The historic route between the Glières plateau and the village of Glières-Val-de-Borne (Petit-Bornand), following the paths the maquisards and the villagers who supplied them used in the winter of 1944. A linear mountain trail of about 9 km with roughly 730 m of vertical, through alpage pastures at the top and forest lower down, part of the Chemins du Maquis network.",
    "tips": "This is a one-way route, not a loop: either arrange a pickup in the valley or double the day by walking back up. The 730 m of sustained descent is the real test for dogs, hard on seniors and joint-prone breeds, so check your dog's match score honestly before committing. Leash rules and summer herds apply on the plateau section, patous included; give flocks a wide berth. Surfaces are only sparsely mapped in the source data, so expect rough mountain path in places. The only mapped water point sits near the valley end, so carry enough for the whole descent. Start early for shade in the forest half."
  },
  // --- Savoy, verified 2026-07-14 (promoted from OSM import; sources: Combloux
  //     OT fiche (leash/herds/season), AllTrails, Waymarked Trails rel. 11517208) ---
  {
    "id": "osm-11517208",
    "name": "La Croix des Salles",
    "area": "Megève",
    "lat": 45.8794896,
    "lng": 6.6035377,
    "osmRelation": 11517208,
    "waymarkedtrails": "https://hiking.waymarkedtrails.org/#route?id=11517208",
    "path": [
      [
        45.87949,
        6.60354
      ],
      [
        45.88015,
        6.60459
      ],
      [
        45.88077,
        6.60582
      ],
      [
        45.8811,
        6.60694
      ],
      [
        45.88119,
        6.60829
      ],
      [
        45.8817,
        6.61066
      ],
      [
        45.88197,
        6.61148
      ],
      [
        45.88199,
        6.61267
      ],
      [
        45.88218,
        6.61324
      ],
      [
        45.88208,
        6.61356
      ],
      [
        45.88208,
        6.61396
      ],
      [
        45.88248,
        6.61529
      ],
      [
        45.88309,
        6.6165
      ],
      [
        45.88331,
        6.6179
      ],
      [
        45.88348,
        6.61822
      ],
      [
        45.88372,
        6.61838
      ],
      [
        45.88461,
        6.61834
      ],
      [
        45.8853,
        6.61861
      ],
      [
        45.88565,
        6.61855
      ],
      [
        45.88595,
        6.61961
      ],
      [
        45.88642,
        6.62005
      ],
      [
        45.88657,
        6.6203
      ],
      [
        45.88673,
        6.62029
      ],
      [
        45.88712,
        6.61997
      ],
      [
        45.88723,
        6.62003
      ],
      [
        45.8876,
        6.62102
      ],
      [
        45.88824,
        6.62184
      ],
      [
        45.8876,
        6.62102
      ],
      [
        45.88723,
        6.62003
      ],
      [
        45.88712,
        6.61997
      ],
      [
        45.88673,
        6.62029
      ],
      [
        45.88657,
        6.6203
      ],
      [
        45.88642,
        6.62005
      ],
      [
        45.88595,
        6.61961
      ],
      [
        45.88565,
        6.61855
      ],
      [
        45.8853,
        6.61861
      ],
      [
        45.88461,
        6.61834
      ],
      [
        45.88382,
        6.61841
      ],
      [
        45.88348,
        6.61822
      ],
      [
        45.88331,
        6.6179
      ],
      [
        45.88309,
        6.6165
      ],
      [
        45.88248,
        6.61529
      ],
      [
        45.88214,
        6.61421
      ],
      [
        45.88208,
        6.61356
      ],
      [
        45.88218,
        6.61324
      ],
      [
        45.8821,
        6.61294
      ],
      [
        45.88142,
        6.61213
      ],
      [
        45.8811,
        6.61123
      ],
      [
        45.88043,
        6.61028
      ],
      [
        45.87983,
        6.60919
      ],
      [
        45.8796,
        6.60856
      ],
      [
        45.8797,
        6.60814
      ],
      [
        45.87965,
        6.60734
      ],
      [
        45.87933,
        6.60629
      ],
      [
        45.8792,
        6.60609
      ],
      [
        45.87871,
        6.60593
      ],
      [
        45.87829,
        6.6056
      ],
      [
        45.87816,
        6.60538
      ],
      [
        45.87819,
        6.60501
      ],
      [
        45.878,
        6.60433
      ],
      [
        45.87703,
        6.60352
      ],
      [
        45.87651,
        6.60279
      ],
      [
        45.876,
        6.6024
      ],
      [
        45.87577,
        6.60203
      ],
      [
        45.87566,
        6.60201
      ],
      [
        45.87545,
        6.60215
      ],
      [
        45.87488,
        6.60189
      ],
      [
        45.87396,
        6.60191
      ],
      [
        45.87388,
        6.60183
      ],
      [
        45.87389,
        6.60145
      ],
      [
        45.87355,
        6.6013
      ],
      [
        45.87308,
        6.6016
      ],
      [
        45.87292,
        6.60136
      ],
      [
        45.87265,
        6.60034
      ],
      [
        45.87221,
        6.60004
      ],
      [
        45.87183,
        6.59958
      ],
      [
        45.87141,
        6.59949
      ],
      [
        45.87104,
        6.59931
      ],
      [
        45.87024,
        6.59932
      ],
      [
        45.86958,
        6.59877
      ],
      [
        45.87043,
        6.59788
      ],
      [
        45.87078,
        6.59767
      ],
      [
        45.87159,
        6.59685
      ],
      [
        45.87255,
        6.59627
      ],
      [
        45.87279,
        6.59582
      ],
      [
        45.8732,
        6.59463
      ],
      [
        45.87396,
        6.59386
      ],
      [
        45.87481,
        6.59324
      ],
      [
        45.87555,
        6.59295
      ],
      [
        45.87619,
        6.59285
      ],
      [
        45.87637,
        6.59252
      ],
      [
        45.87661,
        6.59343
      ],
      [
        45.87657,
        6.5937
      ],
      [
        45.87683,
        6.59508
      ],
      [
        45.87663,
        6.59402
      ],
      [
        45.87616,
        6.59414
      ],
      [
        45.87577,
        6.59409
      ],
      [
        45.87527,
        6.59435
      ],
      [
        45.87461,
        6.59485
      ],
      [
        45.87445,
        6.59517
      ],
      [
        45.87441,
        6.59545
      ],
      [
        45.87464,
        6.59588
      ],
      [
        45.87486,
        6.59611
      ],
      [
        45.87509,
        6.5962
      ],
      [
        45.87518,
        6.59635
      ],
      [
        45.87526,
        6.597
      ],
      [
        45.8752,
        6.59758
      ],
      [
        45.87558,
        6.59856
      ],
      [
        45.87601,
        6.59865
      ],
      [
        45.87648,
        6.59857
      ],
      [
        45.87693,
        6.59878
      ],
      [
        45.87706,
        6.59898
      ],
      [
        45.87731,
        6.59902
      ],
      [
        45.87765,
        6.59928
      ],
      [
        45.87801,
        6.59973
      ],
      [
        45.87823,
        6.59977
      ],
      [
        45.87905,
        6.60112
      ],
      [
        45.87933,
        6.60312
      ],
      [
        45.87949,
        6.60354
      ]
    ],
    "distance": 7.6,
    "elevation": 510,
    "hours": "2.5–3.5",
    "paid": false,
    "terrainType": "Coarse pebblestone farm tracks and alpage paths throughout",
    "terrainRank": 1,
    "elevationProfile": [
      {
        "km": 0,
        "elev": 1543
      },
      {
        "km": 0.6,
        "elev": 1526
      },
      {
        "km": 1.2,
        "elev": 1420
      },
      {
        "km": 1.7,
        "elev": 1321
      },
      {
        "km": 2.3,
        "elev": 1335
      },
      {
        "km": 2.9,
        "elev": 1420
      },
      {
        "km": 3.5,
        "elev": 1478
      },
      {
        "km": 4.1,
        "elev": 1493
      },
      {
        "km": 4.6,
        "elev": 1530
      },
      {
        "km": 5.2,
        "elev": 1586
      },
      {
        "km": 5.8,
        "elev": 1660
      },
      {
        "km": 6.4,
        "elev": 1695
      },
      {
        "km": 6.9,
        "elev": 1635
      },
      {
        "km": 7.5,
        "elev": 1599
      },
      {
        "km": 7.6,
        "elev": 1543
      }
    ],
    "surfaceHazards": [],
    "shadeCoverage": 40,
    "heatRisk": "moderate",
    "safetyLevel": "moderate",
    "exposure": false,
    "waterSources": [
      {
        "km": 1.9,
        "label": "Drinking water (OSM-verified location)"
      },
      {
        "km": 3.7,
        "label": "Drinking water (OSM-verified location)"
      }
    ],
    "rifugi": [],
    "startPoint": {
      "lat": 45.8794896,
      "lng": 6.6035377,
      "label": "Start here: Alpage de Beauregard lift station, just above the Cuchet car park (route de La Cry-Cuchet, Combloux)"
    },
    "desc": "A half-day loop over the Jaillet alpages between Megève and Combloux, topping out at the Croix des Salles and its 360 degree panorama of Mont Blanc, the Aravis and the Fiz. The route climbs through forest and some of Haute-Savoie's most flower-rich mountain pastures, and includes the short out-and-back spur to the cross itself, the viewpoint that gives the walk its name. Waymarked by the Communaute de communes Pays du Mont-Blanc with cream-coloured signs.",
    "tips": "Dogs are accepted on a leash, and the tourist office warns that herds graze these alpages, so expect cattle and keep the leash on around them. The tracks are coarse pebble most of the way, tiring for soft paws over 7.6 km, so check pads after the descent. Two fountains are mapped, at km 1.9 and 3.7. Near the Jaillet gondola top you pass a panoramic playground, a summer food truck, and the Lac du Jaillet with its orientation-table pier, and the alpage restaurants around La Ravine and Beauregard make good rest stops. Marked open from early May to mid November outside snowy spells. The summit view is famous at sunset; bring a headlamp if you stay for it.",
    "decisionPoints": [
      {
        "km": 6.2,
        "lat": 45.87671,
        "lng": 6.59439,
        "instruction": "Short spur on the left to the Croix des Salles itself (1,695 m): the 360 degree Mont Blanc viewpoint the loop is named after, then back to the main track"
      }
    ],
    "imageIcon": "images/la-croix-des-salles.webp",
    "imageCredit": {
      "text": "AI-generated illustration of the Croix des Salles, not a photograph",
      "bare": true
    }
  },
  // --- Savoy, ENRICHED IMPORT 2026-07-14: kept curated:false (dog access has no
  //     citable source; official fiche offline). Facts from Decathlon Outdoor,
  //     Dept. Haute-Savoie fiche, Waymarked Trails rel. 14987412. Lives here so
  //     the pipeline cannot overwrite it; relation is on the promote skip-list. ---
  {
    "id": "osm-14987412",
    "source": "osm",
    "curated": false,
    "osmRelation": 14987412,
    "waymarkedtrails": "https://hiking.waymarkedtrails.org/#route?id=14987412",
    "name": "Sentier du Four",
    "area": "Arbusigny",
    "lat": 46.0901039,
    "lng": 6.2107469,
    "path": [
      [
        46.0901,
        6.21075
      ],
      [
        46.09016,
        6.21119
      ],
      [
        46.08987,
        6.21169
      ],
      [
        46.08973,
        6.21213
      ],
      [
        46.08973,
        6.21305
      ],
      [
        46.08987,
        6.21348
      ],
      [
        46.09011,
        6.21384
      ],
      [
        46.09051,
        6.21502
      ],
      [
        46.09081,
        6.21632
      ],
      [
        46.09116,
        6.21684
      ],
      [
        46.09134,
        6.21737
      ],
      [
        46.09168,
        6.21782
      ],
      [
        46.0916,
        6.21857
      ],
      [
        46.09129,
        6.2188
      ],
      [
        46.0911,
        6.21882
      ],
      [
        46.09019,
        6.21814
      ],
      [
        46.08969,
        6.21788
      ],
      [
        46.08854,
        6.21774
      ],
      [
        46.08814,
        6.21755
      ],
      [
        46.08743,
        6.21685
      ],
      [
        46.08753,
        6.21639
      ],
      [
        46.08747,
        6.21623
      ],
      [
        46.08705,
        6.21609
      ],
      [
        46.0859,
        6.215
      ],
      [
        46.08545,
        6.2147
      ],
      [
        46.08492,
        6.21447
      ],
      [
        46.0845,
        6.21447
      ],
      [
        46.08343,
        6.21415
      ],
      [
        46.08312,
        6.21326
      ],
      [
        46.08253,
        6.21238
      ],
      [
        46.08256,
        6.21097
      ],
      [
        46.08187,
        6.20934
      ],
      [
        46.08171,
        6.20866
      ],
      [
        46.08181,
        6.208
      ],
      [
        46.08239,
        6.20656
      ],
      [
        46.08382,
        6.20526
      ],
      [
        46.08373,
        6.2048
      ],
      [
        46.08373,
        6.20256
      ],
      [
        46.08341,
        6.20199
      ],
      [
        46.08324,
        6.20124
      ],
      [
        46.08398,
        6.20011
      ],
      [
        46.08416,
        6.19962
      ],
      [
        46.0841,
        6.19781
      ],
      [
        46.08465,
        6.19555
      ],
      [
        46.08488,
        6.19523
      ],
      [
        46.0853,
        6.19513
      ],
      [
        46.08577,
        6.19454
      ],
      [
        46.08605,
        6.19434
      ],
      [
        46.08633,
        6.194
      ],
      [
        46.08651,
        6.19395
      ],
      [
        46.0874,
        6.19302
      ],
      [
        46.08809,
        6.19047
      ],
      [
        46.08873,
        6.19122
      ],
      [
        46.08907,
        6.19198
      ],
      [
        46.08937,
        6.19236
      ],
      [
        46.0894,
        6.19294
      ],
      [
        46.0895,
        6.19309
      ],
      [
        46.08973,
        6.19319
      ],
      [
        46.09025,
        6.19293
      ],
      [
        46.0905,
        6.19292
      ],
      [
        46.09069,
        6.19303
      ],
      [
        46.09095,
        6.19298
      ],
      [
        46.0919,
        6.19355
      ],
      [
        46.09224,
        6.19395
      ],
      [
        46.09224,
        6.19477
      ],
      [
        46.09237,
        6.19498
      ],
      [
        46.09263,
        6.19514
      ],
      [
        46.0925,
        6.19622
      ],
      [
        46.09191,
        6.198
      ],
      [
        46.09187,
        6.19904
      ],
      [
        46.09193,
        6.19937
      ],
      [
        46.09228,
        6.2002
      ],
      [
        46.093,
        6.20094
      ],
      [
        46.09276,
        6.2023
      ],
      [
        46.09305,
        6.20236
      ],
      [
        46.0942,
        6.20331
      ],
      [
        46.09485,
        6.20355
      ],
      [
        46.09528,
        6.20381
      ],
      [
        46.0956,
        6.20422
      ],
      [
        46.09619,
        6.20448
      ],
      [
        46.09707,
        6.20507
      ],
      [
        46.09761,
        6.20448
      ],
      [
        46.09869,
        6.20485
      ],
      [
        46.09892,
        6.2051
      ],
      [
        46.09939,
        6.20623
      ],
      [
        46.09964,
        6.20732
      ],
      [
        46.10094,
        6.20882
      ],
      [
        46.10026,
        6.21063
      ],
      [
        46.09989,
        6.21196
      ],
      [
        46.09953,
        6.21253
      ],
      [
        46.09929,
        6.21309
      ],
      [
        46.09875,
        6.21337
      ],
      [
        46.09865,
        6.21354
      ],
      [
        46.09794,
        6.21291
      ],
      [
        46.09729,
        6.21281
      ],
      [
        46.09587,
        6.21218
      ],
      [
        46.09536,
        6.21217
      ],
      [
        46.09199,
        6.21142
      ],
      [
        46.09055,
        6.21091
      ],
      [
        46.09045,
        6.2108
      ],
      [
        46.0901,
        6.21075
      ],
      [
        46.08971,
        6.21025
      ],
      [
        46.08928,
        6.2094
      ],
      [
        46.08907,
        6.20918
      ],
      [
        46.08666,
        6.20907
      ]
    ],
    "distance": 8.3,
    "elevation": null,
    "hours": "2–3",
    "paid": false,
    "terrainType": "Farm tracks, forest paths and country lanes",
    "terrainRank": 1,
    "surfaceHazards": [
      "Several stretches on or across the D278 and D6 roads, open to traffic",
      "One rough, deeply rutted track section in poor condition"
    ],
    "safetyLevel": "moderate",
    "exposure": false,
    "waterSources": [
      {
        "km": 0.6,
        "label": "Drinking water (OSM-verified location)"
      }
    ],
    "rifugi": [
      {
        "km": 0.6,
        "name": "Le Bistro d'Arbu"
      }
    ],
    "startPoint": {
      "lat": 46.0901039,
      "lng": 6.2107469,
      "label": "Start here: Arbusigny chef-lieu, route du Col du Parc, by the bus stop (OSM-verified access point)"
    },
    "desc": "A country loop around Arbusigny on the Plateau des Bornes, known locally as the Chemin des Fours: it strings together the commune's hamlets past old communal bread ovens and mission crosses, with wide views over the Saleve, the Voirons, the Bornes and the Faucigny. Part of the route follows the historic Chemin du Sel, the old salt road, on a mix of farm tracks and quiet lanes at around 830 m.",
    "tips": "Imported route, not yet field-reviewed by ORMA. No published dog-access rule could be found for this circuit, so treat that as unconfirmed: it crosses working farmland and hamlets, and a leash is the safe default, especially near livestock and along the road stretches. Paths turn muddy after rain. The mapped line has a short disconnected piece along the D278 where the source data is broken; on the ground, simply follow the yellow waymarks.",
    "imageIcon": "images/sentier-du-four.webp",
    "imageCredit": {
      "text": "AI-generated illustration of the Chemin des Fours, not a photograph",
      "bare": true
    }
  },
  // --- Savoy, verified 2026-07-14 (promoted from OSM import; source: Mairie de
  //     Megeve fiche via Cirkwi/Apidae, updated 02/07/2026: dogs leashed, Moyen,
  //     673 m D+, start Telecabine du Mont d'Arbois) ---
  {
    "id": "osm-18055492",
    "name": "Le Mont d'Arbois - Mont Joux",
    "area": "Megève",
    "lat": 45.85329,
    "lng": 6.63183,
    "osmRelation": 18055492,
    "waymarkedtrails": "https://hiking.waymarkedtrails.org/#route?id=18055492",
    "path": [
      [
        45.85329,
        6.63183
      ],
      [
        45.85309,
        6.63181
      ],
      [
        45.85225,
        6.63224
      ],
      [
        45.85134,
        6.63291
      ],
      [
        45.85053,
        6.63328
      ],
      [
        45.84881,
        6.63456
      ],
      [
        45.84797,
        6.63558
      ],
      [
        45.84748,
        6.6365
      ],
      [
        45.84674,
        6.63718
      ],
      [
        45.84686,
        6.63762
      ],
      [
        45.84703,
        6.63769
      ],
      [
        45.84705,
        6.63779
      ],
      [
        45.84706,
        6.63803
      ],
      [
        45.84685,
        6.63827
      ],
      [
        45.84772,
        6.6398
      ],
      [
        45.84799,
        6.63995
      ],
      [
        45.84852,
        6.64243
      ],
      [
        45.84923,
        6.64417
      ],
      [
        45.84948,
        6.64535
      ],
      [
        45.84938,
        6.64564
      ],
      [
        45.84941,
        6.64622
      ],
      [
        45.84925,
        6.64657
      ],
      [
        45.84965,
        6.64705
      ],
      [
        45.8498,
        6.64735
      ],
      [
        45.84991,
        6.64804
      ],
      [
        45.84972,
        6.6487
      ],
      [
        45.84997,
        6.6494
      ],
      [
        45.85022,
        6.64975
      ],
      [
        45.85044,
        6.65093
      ],
      [
        45.8506,
        6.65106
      ],
      [
        45.8508,
        6.65167
      ],
      [
        45.8508,
        6.65233
      ],
      [
        45.85105,
        6.65296
      ],
      [
        45.8511,
        6.65336
      ],
      [
        45.85098,
        6.65523
      ],
      [
        45.85127,
        6.65638
      ],
      [
        45.85196,
        6.6571
      ],
      [
        45.8526,
        6.65717
      ],
      [
        45.85326,
        6.65748
      ],
      [
        45.8538,
        6.65743
      ],
      [
        45.85437,
        6.65697
      ],
      [
        45.85487,
        6.65672
      ],
      [
        45.85527,
        6.65605
      ],
      [
        45.85529,
        6.65569
      ],
      [
        45.85558,
        6.65454
      ],
      [
        45.85568,
        6.65437
      ],
      [
        45.85583,
        6.65438
      ],
      [
        45.85655,
        6.65532
      ],
      [
        45.85705,
        6.65563
      ],
      [
        45.85737,
        6.65644
      ],
      [
        45.85808,
        6.65756
      ],
      [
        45.85852,
        6.66072
      ],
      [
        45.85851,
        6.66126
      ],
      [
        45.85846,
        6.66167
      ],
      [
        45.85822,
        6.66204
      ],
      [
        45.85803,
        6.66262
      ],
      [
        45.85757,
        6.66273
      ],
      [
        45.85714,
        6.66298
      ],
      [
        45.85673,
        6.66353
      ],
      [
        45.85669,
        6.66388
      ],
      [
        45.85644,
        6.66433
      ],
      [
        45.85558,
        6.66673
      ],
      [
        45.85551,
        6.66845
      ],
      [
        45.85525,
        6.66864
      ],
      [
        45.85468,
        6.66883
      ],
      [
        45.85441,
        6.66904
      ],
      [
        45.85414,
        6.66933
      ],
      [
        45.85388,
        6.66984
      ],
      [
        45.85364,
        6.67063
      ],
      [
        45.85341,
        6.67239
      ],
      [
        45.85251,
        6.6751
      ],
      [
        45.8509,
        6.67625
      ],
      [
        45.85044,
        6.67669
      ],
      [
        45.85004,
        6.67684
      ],
      [
        45.84889,
        6.67704
      ],
      [
        45.84729,
        6.67627
      ],
      [
        45.84683,
        6.67591
      ],
      [
        45.84662,
        6.67592
      ],
      [
        45.8464,
        6.67613
      ],
      [
        45.84626,
        6.67587
      ],
      [
        45.84602,
        6.67578
      ],
      [
        45.84544,
        6.67433
      ],
      [
        45.84374,
        6.67198
      ],
      [
        45.843,
        6.67065
      ],
      [
        45.84282,
        6.67052
      ],
      [
        45.84256,
        6.66983
      ],
      [
        45.84246,
        6.66897
      ],
      [
        45.84209,
        6.66784
      ],
      [
        45.84138,
        6.66627
      ],
      [
        45.84086,
        6.66417
      ],
      [
        45.83945,
        6.66238
      ],
      [
        45.83901,
        6.66192
      ],
      [
        45.83871,
        6.66174
      ],
      [
        45.83794,
        6.66174
      ],
      [
        45.83777,
        6.66117
      ],
      [
        45.83775,
        6.66068
      ],
      [
        45.8378,
        6.6603
      ],
      [
        45.83812,
        6.65963
      ],
      [
        45.83821,
        6.65924
      ],
      [
        45.83819,
        6.65802
      ],
      [
        45.84046,
        6.65897
      ],
      [
        45.84102,
        6.65905
      ],
      [
        45.84048,
        6.65795
      ],
      [
        45.83974,
        6.65726
      ],
      [
        45.84009,
        6.65724
      ],
      [
        45.84078,
        6.65745
      ],
      [
        45.84108,
        6.65781
      ],
      [
        45.84123,
        6.65787
      ],
      [
        45.84245,
        6.65699
      ],
      [
        45.84333,
        6.65704
      ],
      [
        45.84376,
        6.65717
      ],
      [
        45.84406,
        6.657
      ],
      [
        45.84383,
        6.65624
      ],
      [
        45.84337,
        6.65541
      ],
      [
        45.84362,
        6.65499
      ],
      [
        45.84369,
        6.6546
      ],
      [
        45.844,
        6.65437
      ],
      [
        45.84462,
        6.65432
      ],
      [
        45.84448,
        6.65385
      ],
      [
        45.8445,
        6.65373
      ],
      [
        45.84496,
        6.65356
      ],
      [
        45.84493,
        6.65314
      ],
      [
        45.84471,
        6.65292
      ],
      [
        45.84479,
        6.65167
      ],
      [
        45.84505,
        6.651
      ],
      [
        45.84541,
        6.65074
      ],
      [
        45.84549,
        6.65028
      ],
      [
        45.84565,
        6.64997
      ],
      [
        45.8458,
        6.64876
      ],
      [
        45.84591,
        6.64845
      ],
      [
        45.84577,
        6.64744
      ],
      [
        45.84478,
        6.64557
      ],
      [
        45.84458,
        6.64478
      ],
      [
        45.84462,
        6.64386
      ],
      [
        45.84494,
        6.64299
      ],
      [
        45.84497,
        6.64266
      ],
      [
        45.84491,
        6.6424
      ],
      [
        45.84524,
        6.64089
      ],
      [
        45.84505,
        6.64015
      ],
      [
        45.84511,
        6.6398
      ],
      [
        45.84595,
        6.63894
      ],
      [
        45.84676,
        6.63716
      ],
      [
        45.84748,
        6.6365
      ],
      [
        45.84797,
        6.63558
      ],
      [
        45.84881,
        6.63456
      ],
      [
        45.85053,
        6.63328
      ],
      [
        45.85134,
        6.63291
      ],
      [
        45.85254,
        6.63208
      ],
      [
        45.85351,
        6.63169
      ],
      [
        45.85329,
        6.63183
      ]
    ],
    "distance": 11.6,
    "elevation": 673,
    "hours": "3.5–4",
    "paid": false,
    "terrainType": "Dirt alpage paths, crest tracks and short stretches of quiet road",
    "terrainRank": 1,
    "surfaceHazards": [],
    "shadeCoverage": 25,
    "heatRisk": "moderate",
    "safetyLevel": "moderate",
    "exposure": false,
    "waterSources": [],
    "rifugi": [
      {
        "km": 0,
        "name": "Le Hibou d'Arbois (télécabine base)"
      }
    ],
    "startPoint": {
      "lat": 45.85329,
      "lng": 6.63183,
      "label": "Start here: Télécabine du Mont d'Arbois base station, 3001 route Edmond de Rothschild, Megève; parking on site, seasonal shuttle stop opposite"
    },
    "decisionPoints": [
      {
        "km": 7.6,
        "lat": 45.83775,
        "lng": 6.66068,
        "instruction": "Mont Joux summit (1,958 m): orientation table and the full panorama over Mont Blanc, the Aravis, the Val d'Arly and the Arve valley"
      }
    ],
    "imageIcon": "images/le-mont-d-arbois-mont-joux.webp",
    "imageCredit": {
      "text": "Mairie de Megève, via Cirkwi (Apidae)",
      "url": "https://www.cirkwi.com/fr/circuit/47794-itineraire-rando-le-mont-d-arbois-mont-joux"
    },
    "desc": "A balcony loop above Megève, waymarked in yellow and red as a variant of the Tour du Pays du Mont-Blanc. From the Mont d'Arbois gondola base the route climbs via the Planellet hamlet to the top station and the Ideal 1850 restaurant, then follows the crest past the Bettex gondola up to Mont Joux, before dropping past the chalets and little Lac de Joux, through forest to the Tornay alpages and back. Along the way: one of the valley's last working farms amid gentians and alpine flowers, views over the golf course, and from the top the great sweep of the Mont Blanc massif. An official Megève circuit, dogs welcome.",
    "tips": "The leash is mandatory here, that's the town's official rule. In summer the gondola can lift you to the top station and spare the first 570 m of climbing, a real option for seniors or heat-sensitive dogs, but confirm dog access on board with the lift staff before relying on it. No fountains are mapped on the loop, so carry water for both of you; the crest is open and sun-exposed for long stretches. Dirt paths throughout, not stroller country. Signposted from May to the end of November, weather permitting."
  },
  // --- Savoy, verified 2026-07-14 (promoted from OSM import; sources: Lake Annecy
  //     TO fiche (Medium, 382 m D+, pets welcome, parkings), FFRandonnee/PDIPR 74,
  //     altituderando crest notes, Waymarked Trails rel. 14864704) ---
  {
    "id": "osm-14864704",
    "name": "Boucle du Taillefer",
    "area": "Duingt",
    "lat": 45.8271246,
    "lng": 6.2025044,
    "osmRelation": 14864704,
    "waymarkedtrails": "https://hiking.waymarkedtrails.org/#route?id=14864704",
    "path": [
      [
        45.82712,
        6.2025
      ],
      [
        45.82719,
        6.20288
      ],
      [
        45.827,
        6.20336
      ],
      [
        45.827,
        6.20364
      ],
      [
        45.82662,
        6.20375
      ],
      [
        45.82648,
        6.20373
      ],
      [
        45.8262,
        6.20343
      ],
      [
        45.82532,
        6.20289
      ],
      [
        45.82517,
        6.20259
      ],
      [
        45.8249,
        6.20103
      ],
      [
        45.82471,
        6.2004
      ],
      [
        45.82423,
        6.20009
      ],
      [
        45.82377,
        6.19925
      ],
      [
        45.82311,
        6.19877
      ],
      [
        45.82286,
        6.19848
      ],
      [
        45.82281,
        6.19822
      ],
      [
        45.82316,
        6.19778
      ],
      [
        45.82323,
        6.19753
      ],
      [
        45.82309,
        6.19741
      ],
      [
        45.82287,
        6.19756
      ],
      [
        45.82276,
        6.19701
      ],
      [
        45.82232,
        6.19711
      ],
      [
        45.82193,
        6.19704
      ],
      [
        45.82133,
        6.19721
      ],
      [
        45.82055,
        6.19679
      ],
      [
        45.81998,
        6.19688
      ],
      [
        45.81993,
        6.19681
      ],
      [
        45.81849,
        6.19657
      ],
      [
        45.81846,
        6.19624
      ],
      [
        45.81827,
        6.1962
      ],
      [
        45.8177,
        6.19579
      ],
      [
        45.81675,
        6.19413
      ],
      [
        45.81647,
        6.19417
      ],
      [
        45.81581,
        6.1945
      ],
      [
        45.81561,
        6.1949
      ],
      [
        45.81538,
        6.19504
      ],
      [
        45.8144,
        6.19443
      ],
      [
        45.81415,
        6.19381
      ],
      [
        45.81394,
        6.19352
      ],
      [
        45.8135,
        6.19345
      ],
      [
        45.81297,
        6.19361
      ],
      [
        45.81195,
        6.19281
      ],
      [
        45.81107,
        6.19247
      ],
      [
        45.81087,
        6.19274
      ],
      [
        45.81048,
        6.19273
      ],
      [
        45.80996,
        6.19314
      ],
      [
        45.80948,
        6.19305
      ],
      [
        45.80884,
        6.19362
      ],
      [
        45.8083,
        6.19385
      ],
      [
        45.80816,
        6.19407
      ],
      [
        45.80756,
        6.19412
      ],
      [
        45.80661,
        6.19394
      ],
      [
        45.80623,
        6.19414
      ],
      [
        45.80633,
        6.19439
      ],
      [
        45.80616,
        6.19454
      ],
      [
        45.80641,
        6.19482
      ],
      [
        45.80615,
        6.19485
      ],
      [
        45.80636,
        6.19522
      ],
      [
        45.80631,
        6.19529
      ],
      [
        45.80604,
        6.1952
      ],
      [
        45.806,
        6.19532
      ],
      [
        45.80626,
        6.1959
      ],
      [
        45.80713,
        6.19606
      ],
      [
        45.80754,
        6.19638
      ],
      [
        45.80778,
        6.19737
      ],
      [
        45.80813,
        6.19754
      ],
      [
        45.80857,
        6.19706
      ],
      [
        45.80902,
        6.19691
      ],
      [
        45.81011,
        6.1973
      ],
      [
        45.81037,
        6.19755
      ],
      [
        45.81064,
        6.19807
      ],
      [
        45.81099,
        6.19842
      ],
      [
        45.81142,
        6.1987
      ],
      [
        45.81207,
        6.19896
      ],
      [
        45.8123,
        6.19936
      ],
      [
        45.81268,
        6.19948
      ],
      [
        45.81274,
        6.19967
      ],
      [
        45.81288,
        6.19968
      ],
      [
        45.81294,
        6.19998
      ],
      [
        45.81317,
        6.2
      ],
      [
        45.81339,
        6.20033
      ],
      [
        45.81366,
        6.20037
      ],
      [
        45.81427,
        6.20022
      ],
      [
        45.81449,
        6.20002
      ],
      [
        45.8149,
        6.2001
      ],
      [
        45.81501,
        6.2
      ],
      [
        45.8155,
        6.20032
      ],
      [
        45.81567,
        6.20015
      ],
      [
        45.81608,
        6.20043
      ],
      [
        45.81655,
        6.20044
      ],
      [
        45.81686,
        6.20054
      ],
      [
        45.81706,
        6.20071
      ],
      [
        45.81733,
        6.20061
      ],
      [
        45.81785,
        6.20079
      ],
      [
        45.81803,
        6.20075
      ],
      [
        45.8186,
        6.20128
      ],
      [
        45.81918,
        6.20126
      ],
      [
        45.81941,
        6.20134
      ],
      [
        45.81959,
        6.2017
      ],
      [
        45.82013,
        6.2021
      ],
      [
        45.82034,
        6.2024
      ],
      [
        45.82077,
        6.20275
      ],
      [
        45.82099,
        6.20272
      ],
      [
        45.82124,
        6.20291
      ],
      [
        45.82154,
        6.20299
      ],
      [
        45.82193,
        6.20329
      ],
      [
        45.8221,
        6.20321
      ],
      [
        45.82254,
        6.20353
      ],
      [
        45.8228,
        6.20357
      ],
      [
        45.82308,
        6.2041
      ],
      [
        45.82322,
        6.20406
      ],
      [
        45.82334,
        6.20423
      ],
      [
        45.8237,
        6.20423
      ],
      [
        45.82407,
        6.20445
      ],
      [
        45.82482,
        6.20448
      ],
      [
        45.82486,
        6.20467
      ],
      [
        45.82499,
        6.20452
      ],
      [
        45.825,
        6.20477
      ],
      [
        45.8251,
        6.20479
      ],
      [
        45.82484,
        6.205
      ],
      [
        45.825,
        6.20513
      ],
      [
        45.82544,
        6.20511
      ],
      [
        45.8255,
        6.20495
      ],
      [
        45.82576,
        6.2048
      ],
      [
        45.82556,
        6.20539
      ],
      [
        45.82589,
        6.20535
      ],
      [
        45.82603,
        6.20511
      ],
      [
        45.82609,
        6.20538
      ],
      [
        45.82629,
        6.20515
      ],
      [
        45.82633,
        6.20533
      ],
      [
        45.82625,
        6.20577
      ],
      [
        45.82691,
        6.20548
      ],
      [
        45.82697,
        6.20526
      ],
      [
        45.82712,
        6.20544
      ],
      [
        45.82719,
        6.20522
      ],
      [
        45.82728,
        6.20558
      ],
      [
        45.82708,
        6.20587
      ],
      [
        45.82722,
        6.20587
      ],
      [
        45.82759,
        6.20561
      ],
      [
        45.82766,
        6.20525
      ],
      [
        45.82755,
        6.20499
      ],
      [
        45.82791,
        6.20517
      ],
      [
        45.82757,
        6.2046
      ],
      [
        45.82712,
        6.20417
      ],
      [
        45.82699,
        6.2035
      ],
      [
        45.82719,
        6.20288
      ],
      [
        45.82708,
        6.20234
      ]
    ],
    "distance": 6.7,
    "elevation": 382,
    "hours": "3",
    "paid": false,
    "terrainType": "Village lanes, dirt paths and a rocky ridge crest",
    "terrainRank": 1,
    "elevationProfile": [
      {
        "km": 0,
        "elev": 449
      },
      {
        "km": 0.6,
        "elev": 460
      },
      {
        "km": 1,
        "elev": 508
      },
      {
        "km": 1.6,
        "elev": 583
      },
      {
        "km": 2.1,
        "elev": 646
      },
      {
        "km": 2.6,
        "elev": 665
      },
      {
        "km": 3.1,
        "elev": 708
      },
      {
        "km": 3.6,
        "elev": 736
      },
      {
        "km": 4.1,
        "elev": 709
      },
      {
        "km": 4.6,
        "elev": 718
      },
      {
        "km": 5.1,
        "elev": 615
      },
      {
        "km": 5.6,
        "elev": 611
      },
      {
        "km": 6.1,
        "elev": 529
      },
      {
        "km": 6.6,
        "elev": 450
      },
      {
        "km": 6.7,
        "elev": 449
      }
    ],
    "surfaceHazards": [
      "Rocky, uneven sections along the Taillefer crest",
      "Short stretches on and across the D8 road on the return leg"
    ],
    "shadeCoverage": 45,
    "heatRisk": "moderate",
    "safetyLevel": "moderate",
    "exposure": false,
    "waterSources": [
      {
        "km": 0,
        "label": "Drinking water (OSM-verified location)"
      },
      {
        "km": 0,
        "label": "Drinking water (OSM-verified location)"
      },
      {
        "km": 2.4,
        "label": "Drinking water (OSM-verified location)"
      }
    ],
    "rifugi": [
      {
        "km": 0,
        "name": "Le Bon Wagon"
      }
    ],
    "startPoint": {
      "lat": 45.8271246,
      "lng": 6.2025044,
      "label": "Start here: parking de l'église, Duingt (overflow parking on route des Prés Bernard)"
    },
    "decisionPoints": [
      {
        "km": 3.6,
        "lat": 45.80857,
        "lng": 6.19706,
        "instruction": "Taillefer high point (766 m): benches and the double panorama over the Grand and Petit lac d'Annecy"
      }
    ],
    "desc": "The rocky spine that juts into Lake Annecy, walked as a loop from Duingt's old village on the quiet west shore. A lane past the Chemin de la Grotte leads to a first viewpoint within ten minutes, then dirt paths climb to the plateau and along the crest of the Taillefer, with the lake on both sides and the Bauges and Tournette all around, before dropping to the hamlet of Les Maisons and returning below the ridge. An FFRandonnee circuit from the official Haute-Savoie trail register; the tourist office ranks it among the area's most beautiful easy-reach hikes, and dogs are welcome.",
    "tips": "Keep the leash on, that's the official condition for dogs here. The loop is friendly in stages: the first stretch is tarmac with benches, the plateau suits children, and only the crest and return ask for surer feet, so turn back at the plateau junction with a tired dog. Skip it entirely after heavy rain and wear proper shoes. The two village fountains at the start and one at km 2.4 are the only water, and the crest is sunny, so fill up. Open all year outside snowy spells.",
    "imageIcon": "images/boucle-du-taillefer.webp",
    "imageCredit": {
      "text": "Lac Annecy Tourisme fiche (Apidae), edited",
      "url": "https://www.lac-annecy.com/itineraire-de-randonnee-pedestre/la-boucle-du-taillefer-duingt/"
    }
  },
  // --- Savoy, verified 2026-07-14 (Aix Riviera OT fiche: tres facile, 22 m D+,
  //     animaux acceptes Oui, cemetery parking; Waymarked Trails rel. 14095296) ---
  {
    "id": "osm-14095296",
    "name": "Les Marais d'Albens",
    "area": "Albens / Entrelacs",
    "lat": 45.7891,
    "lng": 5.94902,
    "osmRelation": 14095296,
    "waymarkedtrails": "https://hiking.waymarkedtrails.org/#route?id=14095296",
    "path": [
      [
        45.7891,
        5.94902
      ],
      [
        45.78959,
        5.94908
      ],
      [
        45.78965,
        5.94917
      ],
      [
        45.78974,
        5.95196
      ],
      [
        45.79075,
        5.95196
      ],
      [
        45.79069,
        5.9524
      ],
      [
        45.79037,
        5.95245
      ],
      [
        45.79069,
        5.9524
      ],
      [
        45.79075,
        5.95196
      ],
      [
        45.79099,
        5.95169
      ],
      [
        45.79227,
        5.95144
      ],
      [
        45.79234,
        5.9515
      ],
      [
        45.79188,
        5.95368
      ],
      [
        45.79192,
        5.95381
      ],
      [
        45.79216,
        5.95383
      ],
      [
        45.79224,
        5.95404
      ],
      [
        45.79132,
        5.95568
      ],
      [
        45.79144,
        5.95638
      ],
      [
        45.79574,
        5.95801
      ],
      [
        45.7976,
        5.9575
      ],
      [
        45.7983,
        5.95751
      ],
      [
        45.7997,
        5.95854
      ],
      [
        45.80132,
        5.95889
      ],
      [
        45.80226,
        5.95872
      ],
      [
        45.80323,
        5.95885
      ],
      [
        45.80427,
        5.95979
      ],
      [
        45.80577,
        5.96224
      ],
      [
        45.80612,
        5.96248
      ],
      [
        45.80661,
        5.96265
      ],
      [
        45.80683,
        5.96256
      ],
      [
        45.80706,
        5.96229
      ],
      [
        45.80773,
        5.96242
      ],
      [
        45.8081,
        5.96191
      ],
      [
        45.80764,
        5.9613
      ],
      [
        45.80741,
        5.96067
      ],
      [
        45.80729,
        5.9585
      ],
      [
        45.80738,
        5.95749
      ],
      [
        45.80732,
        5.95712
      ],
      [
        45.80712,
        5.95689
      ],
      [
        45.80651,
        5.95669
      ],
      [
        45.80637,
        5.95657
      ],
      [
        45.80625,
        5.95535
      ],
      [
        45.80592,
        5.95452
      ],
      [
        45.80495,
        5.95469
      ],
      [
        45.8043,
        5.95527
      ],
      [
        45.80385,
        5.95538
      ],
      [
        45.803,
        5.95497
      ],
      [
        45.80252,
        5.95445
      ],
      [
        45.80235,
        5.95475
      ],
      [
        45.8021,
        5.95451
      ],
      [
        45.80124,
        5.95412
      ],
      [
        45.80023,
        5.95389
      ],
      [
        45.79999,
        5.95403
      ],
      [
        45.79966,
        5.95445
      ],
      [
        45.79927,
        5.95475
      ],
      [
        45.79774,
        5.95708
      ],
      [
        45.79759,
        5.95695
      ],
      [
        45.79527,
        5.95649
      ],
      [
        45.79511,
        5.95493
      ],
      [
        45.79511,
        5.95322
      ],
      [
        45.79438,
        5.95333
      ],
      [
        45.79424,
        5.95313
      ],
      [
        45.79189,
        5.95363
      ],
      [
        45.79233,
        5.9516
      ],
      [
        45.79231,
        5.95144
      ],
      [
        45.79099,
        5.95169
      ],
      [
        45.79075,
        5.95196
      ],
      [
        45.78983,
        5.95199
      ],
      [
        45.78971,
        5.95186
      ],
      [
        45.78965,
        5.94917
      ],
      [
        45.78959,
        5.94908
      ],
      [
        45.7891,
        5.94902
      ]
    ],
    "distance": 6.6,
    "elevation": 22,
    "hours": "2–2.5",
    "paid": false,
    "terrainType": "Level country lanes, grass and compacted gravel; fine for all-terrain strollers",
    "terrainRank": 0,
    "elevationProfile": [
      {
        "km": 0.1,
        "elev": 353
      },
      {
        "km": 0.5,
        "elev": 348
      },
      {
        "km": 0.9,
        "elev": 347
      },
      {
        "km": 2.0,
        "elev": 359
      },
      {
        "km": 2.9,
        "elev": 356
      },
      {
        "km": 3.2,
        "elev": 365
      },
      {
        "km": 3.6,
        "elev": 365
      },
      {
        "km": 4.0,
        "elev": 360
      },
      {
        "km": 4.0,
        "elev": 360
      },
      {
        "km": 4.4,
        "elev": 358
      },
      {
        "km": 5.0,
        "elev": 353
      },
      {
        "km": 5.6,
        "elev": 347
      },
      {
        "km": 6.3,
        "elev": 350
      },
      {
        "km": 6.61,
        "elev": 353
      }
    ],
    "surfaceHazards": [],
    "shadeCoverage": 30,
    "heatRisk": "moderate",
    "safetyLevel": "low-risk",
    "exposure": false,
    "waterSources": [],
    "rifugi": [],
    "startPoint": {
      "lat": 45.7891,
      "lng": 5.94902,
      "label": "Start here: Albens cemetery parking, Entrelacs (do not park at the D1201 trail entrance, it is prohibited)"
    },
    "desc": "A completely flat wander through the old drained marshes of the Albens plain, fifteen minutes from Aix-les-Bains. The waymarked loop follows the river Deysse on quiet country lanes, skirts a poplar grove, passes the Crosagny mill and its ponds with their pontoons and rich birdlife, and crosses the village of Braille on the way round. Picnic tables and a fitness course dot the route; the tourist office rates it very easy and lists dogs as accepted.",
    "tips": "Dogs are accepted, and French rules on wetlands still apply: no free-roaming in marshes or along watercourses, so keep the leash on around the ponds and birdlife. There is barely a metre of climb but also barely a patch of deep shade, so avoid the hottest hours and carry water, as no fountains are mapped. Open all year in decent weather. Our mapped loop runs 6.6 km including the village link, a little over the 5.5 km the fiche quotes.",
    "imageIcon": "images/les-marais-d-albens.webp",
    "imageCredit": {
      "text": "lac-du-bourget.com (edited)",
      "url": "https://www.lac-du-bourget.com/les-marais-albens-promenade-a-entrelacs/"
    }
  },
  // --- Savoy, verified 2026-07-14: dogs on leash per Grand Chambery Apidae fiche
  //     (JS-only page, read in-browser by site owner). Facts: Challes fiche, CEN Savoie. ---
  {
    "id": "osm-16322228",
    "osmRelation": 16322228,
    "waymarkedtrails": "https://hiking.waymarkedtrails.org/#route?id=16322228",
    "name": "Boucle du Marais des Chassettes",
    "area": "Challes-les-Eaux",
    "lat": 45.5548545,
    "lng": 5.9786169,
    "path": [
      [
        45.55485,
        5.97862
      ],
      [
        45.55484,
        5.97887
      ],
      [
        45.55514,
        5.97896
      ],
      [
        45.55526,
        5.9793
      ],
      [
        45.55556,
        5.97964
      ],
      [
        45.55608,
        5.97823
      ],
      [
        45.55597,
        5.97816
      ],
      [
        45.55598,
        5.97746
      ],
      [
        45.55585,
        5.97727
      ],
      [
        45.55624,
        5.97673
      ],
      [
        45.55701,
        5.97327
      ],
      [
        45.55814,
        5.96925
      ],
      [
        45.55805,
        5.96879
      ],
      [
        45.55783,
        5.96863
      ],
      [
        45.55758,
        5.96867
      ],
      [
        45.55747,
        5.96835
      ],
      [
        45.55734,
        5.96832
      ],
      [
        45.55614,
        5.9687
      ],
      [
        45.5553,
        5.96878
      ],
      [
        45.55455,
        5.96909
      ],
      [
        45.55393,
        5.96951
      ],
      [
        45.55382,
        5.9699
      ],
      [
        45.55356,
        5.97011
      ],
      [
        45.5528,
        5.97146
      ],
      [
        45.55263,
        5.97199
      ],
      [
        45.55179,
        5.9733
      ],
      [
        45.55058,
        5.97388
      ],
      [
        45.55035,
        5.97388
      ],
      [
        45.54934,
        5.97528
      ],
      [
        45.54914,
        5.97567
      ],
      [
        45.54898,
        5.97642
      ],
      [
        45.54911,
        5.97633
      ],
      [
        45.54974,
        5.97622
      ],
      [
        45.5503,
        5.97588
      ],
      [
        45.55127,
        5.97549
      ],
      [
        45.55268,
        5.97582
      ],
      [
        45.55275,
        5.97603
      ],
      [
        45.55314,
        5.97635
      ],
      [
        45.55356,
        5.97577
      ],
      [
        45.55406,
        5.97555
      ],
      [
        45.55447,
        5.97546
      ],
      [
        45.55458,
        5.97557
      ],
      [
        45.5546,
        5.97608
      ],
      [
        45.55515,
        5.97625
      ],
      [
        45.55518,
        5.9765
      ],
      [
        45.55498,
        5.97665
      ],
      [
        45.55479,
        5.97719
      ],
      [
        45.55481,
        5.97788
      ],
      [
        45.5549,
        5.97801
      ],
      [
        45.55476,
        5.97841
      ],
      [
        45.55485,
        5.97862
      ]
    ],
    "distance": 3.3,
    "elevation": 20,
    "hours": "1",
    "paid": false,
    "terrainType": "Paved and gravel paths with short boardwalk stretches",
    "terrainRank": 0,
    "elevationProfile": [
      {
        "km": 0,
        "elev": 294
      },
      {
        "km": 0.1,
        "elev": 291
      },
      {
        "km": 0.3,
        "elev": 292
      },
      {
        "km": 1.1,
        "elev": 290
      },
      {
        "km": 1.2,
        "elev": 300
      },
      {
        "km": 1.5,
        "elev": 297
      },
      {
        "km": 1.8,
        "elev": 294
      },
      {
        "km": 2.3,
        "elev": 313
      },
      {
        "km": 2.4,
        "elev": 306
      },
      {
        "km": 2.8,
        "elev": 296
      },
      {
        "km": 3,
        "elev": 292
      },
      {
        "km": 3.2,
        "elev": 293
      },
      {
        "km": 3.3,
        "elev": 293
      }
    ],
    "surfaceHazards": [],
    "safetyLevel": "low-risk",
    "exposure": false,
    "waterSources": [],
    "rifugi": [
      {
        "km": 0.7,
        "name": "Bier Fest"
      }
    ],
    "startPoint": {
      "lat": 45.5548545,
      "lng": 5.9786169,
      "label": "Start here: parking avenue de Chambéry, Challes-les-Eaux; bus 2 and 3 stop Plan d'Eau opposite"
    },
    "desc": "An easy hour around the Chassettes, a 22 hectare pocket of former peat bog squeezed between Challes-les-Eaux and La Ravoire at the foot of the Bauges. Woods and marsh alternate along the way, with information panels on a birdlife that ranges from black kites and honey buzzards to black woodpeckers, and the Challes leisure lake sits right by the start. Dogs are welcome on a leash per the Grand Chambéry tourism fiche.",
    "tips": "Keep the leash on, that's the condition for dogs here, and sensible anyway around ground-nesting birds. A treat for local dogs: two fenced dog parks sit by the leisure lake at the start, one for training and one for free running. Flat, short and close to town, a good pick for seniors, puppies or a quick evening lap. No fountains are mapped, so bring water on warm days.",
    "imageIcon": "images/boucle-du-marais-des-chassettes.webp",
    "imageCredit": {
      "text": "Anthony Levrot, CC BY-SA, via Wikimedia Commons (edited)",
      "url": "https://fr.wikipedia.org/wiki/Fichier:Marais_des_Chassettes_-_Challes-les-Eaux,_2016.jpg"
    }
  },
  // --- Savoy, verified 2026-07-14: dogs on leash per Grand Chambery listing (read
  //     in-browser by site owner). Facts: Commune de La Motte-Servolex fiche; loop
  //     geometry rebuilt from full WMT relation (import had a broken 1.9 km gap). ---
  {
    "id": "osm-16363583",
    "osmRelation": 16363583,
    "waymarkedtrails": "https://hiking.waymarkedtrails.org/#route?id=16363583",
    "name": "Le Marais de Pré Lombard",
    "area": "La Motte-Servolex",
    "lat": 45.60459,
    "lng": 5.87048,
    "path": [
      [
        45.60459,
        5.87048
      ],
      [
        45.60657,
        5.86967
      ],
      [
        45.60785,
        5.86865
      ],
      [
        45.60911,
        5.86835
      ],
      [
        45.6133,
        5.86916
      ],
      [
        45.61389,
        5.87016
      ],
      [
        45.61398,
        5.87014
      ],
      [
        45.61399,
        5.86976
      ],
      [
        45.61438,
        5.87015
      ],
      [
        45.61453,
        5.87136
      ],
      [
        45.61487,
        5.87083
      ],
      [
        45.61567,
        5.87035
      ],
      [
        45.61618,
        5.87034
      ],
      [
        45.61641,
        5.87076
      ],
      [
        45.61671,
        5.87081
      ],
      [
        45.61672,
        5.86998
      ],
      [
        45.61707,
        5.86957
      ],
      [
        45.61734,
        5.86883
      ],
      [
        45.61741,
        5.86764
      ],
      [
        45.61735,
        5.86706
      ],
      [
        45.61786,
        5.8654
      ],
      [
        45.61767,
        5.86419
      ],
      [
        45.61903,
        5.864
      ],
      [
        45.61923,
        5.86418
      ],
      [
        45.61947,
        5.8661
      ],
      [
        45.61961,
        5.86654
      ],
      [
        45.61978,
        5.86678
      ],
      [
        45.62033,
        5.86709
      ],
      [
        45.62085,
        5.8677
      ],
      [
        45.62176,
        5.86795
      ],
      [
        45.62278,
        5.86784
      ],
      [
        45.62314,
        5.86752
      ],
      [
        45.62327,
        5.86758
      ],
      [
        45.62318,
        5.86802
      ],
      [
        45.62326,
        5.86899
      ],
      [
        45.62295,
        5.86966
      ],
      [
        45.62307,
        5.87046
      ],
      [
        45.62291,
        5.87123
      ],
      [
        45.62265,
        5.87152
      ],
      [
        45.62348,
        5.87172
      ],
      [
        45.62358,
        5.87195
      ],
      [
        45.62196,
        5.87309
      ],
      [
        45.62201,
        5.87383
      ],
      [
        45.62095,
        5.87551
      ],
      [
        45.62003,
        5.8779
      ],
      [
        45.61957,
        5.87795
      ],
      [
        45.6193,
        5.8782
      ],
      [
        45.61795,
        5.87951
      ],
      [
        45.61718,
        5.88063
      ],
      [
        45.61323,
        5.88165
      ],
      [
        45.61303,
        5.88243
      ],
      [
        45.61267,
        5.88292
      ],
      [
        45.6104,
        5.88343
      ],
      [
        45.61014,
        5.88335
      ],
      [
        45.60946,
        5.88252
      ],
      [
        45.60903,
        5.88237
      ],
      [
        45.60873,
        5.88252
      ],
      [
        45.60827,
        5.88324
      ],
      [
        45.60728,
        5.88353
      ],
      [
        45.60577,
        5.8844
      ],
      [
        45.60585,
        5.88351
      ],
      [
        45.6057,
        5.88282
      ],
      [
        45.60513,
        5.88198
      ],
      [
        45.6041,
        5.88133
      ],
      [
        45.6038,
        5.881
      ],
      [
        45.60363,
        5.8806
      ],
      [
        45.60319,
        5.87821
      ],
      [
        45.60306,
        5.87641
      ],
      [
        45.60364,
        5.87611
      ],
      [
        45.60481,
        5.87462
      ],
      [
        45.60581,
        5.87417
      ],
      [
        45.60562,
        5.87401
      ],
      [
        45.60524,
        5.87286
      ],
      [
        45.60504,
        5.87185
      ],
      [
        45.60463,
        5.87146
      ]
    ],
    "distance": 7.2,
    "elevation": null,
    "hours": "1.5–2",
    "paid": false,
    "terrainType": "Mostly paved lanes with gravel and dirt farm tracks",
    "terrainRank": 0,
    "surfaceHazards": [
      "One fairly steep path section descending to the La Combe stream"
    ],
    "safetyLevel": "low-risk",
    "exposure": false,
    "waterSources": [],
    "rifugi": [],
    "startPoint": {
      "lat": 45.60459,
      "lng": 5.87048,
      "label": "Start here: chemin de Pré-Marquis, La Motte-Servolex; park opposite the Post Office (place Rémi Catin), or bus C / 1 to La Motte Centre"
    },
    "desc": "A level circuit through the countryside west of La Motte-Servolex, waymarked by the commune and rich in biodiversity interpretation panels. The route climbs gently over the Servolex plateau past the château, crosses the Grands Champs farmland to the hamlets of Beauvoir and Montarlet, then drops to the marshes and follows a wide track along the Leysse, whose panels explain the fish life of this Lac du Bourget tributary. Dogs are welcome on a leash, out of respect for the wildlife and the working farmland.",
    "tips": "The leash is required along the whole loop, and it matters most by the Leysse and the streams, where wildlife rules apply, and through the farmed sections. Almost shadeless, so skip hot afternoons and carry water, as no fountains are mapped. The final stretch runs close to the motorway, so expect traffic noise and keep nervous dogs close. Our line was rebuilt from the full waymarked relation and shows the true closed loop at 7.2 km; the commune's fiche quotes 9 km for its fuller variant.",
    "imageIcon": "images/le-marais-de-pre-lombard.webp",
    "imageCredit": {
      "text": "Decathlon Outdoor (edited)",
      "url": "https://www.decathlon-outdoor.com/fr-fr/explore/france/balade-dans-les-marais-du-pre-lombard-et-rencontres-discretes-6111235376b92"
    }
  },
  // --- Savoy, verified 2026-07-14 (EmmeneTonChien + commune: leash compulsory,
  //     easy/accessible consensus; Waymarked Trails rel. 16395076) ---
  {
    "id": "osm-16395076",
    "name": "Boucle du Lac de la Thuile",
    "area": "La Thuile",
    "lat": 45.533274,
    "lng": 6.0551773,
    "osmRelation": 16395076,
    "waymarkedtrails": "https://hiking.waymarkedtrails.org/#route?id=16395076",
    "path": [
      [
        45.53327,
        6.05518
      ],
      [
        45.53306,
        6.05555
      ],
      [
        45.5323,
        6.0562
      ],
      [
        45.53171,
        6.05653
      ],
      [
        45.53069,
        6.05759
      ],
      [
        45.5297,
        6.05972
      ],
      [
        45.52927,
        6.06043
      ],
      [
        45.5284,
        6.06135
      ],
      [
        45.52805,
        6.06055
      ],
      [
        45.52789,
        6.05977
      ],
      [
        45.52809,
        6.05909
      ],
      [
        45.52805,
        6.05818
      ],
      [
        45.52894,
        6.05705
      ],
      [
        45.52904,
        6.05661
      ],
      [
        45.52898,
        6.056
      ],
      [
        45.52924,
        6.05547
      ],
      [
        45.52869,
        6.05462
      ],
      [
        45.52864,
        6.05433
      ],
      [
        45.52875,
        6.05406
      ],
      [
        45.52908,
        6.05392
      ],
      [
        45.52928,
        6.05354
      ],
      [
        45.52955,
        6.05335
      ],
      [
        45.52985,
        6.0534
      ],
      [
        45.53017,
        6.05309
      ],
      [
        45.53056,
        6.05309
      ],
      [
        45.53129,
        6.05337
      ],
      [
        45.53247,
        6.05429
      ],
      [
        45.53278,
        6.05487
      ],
      [
        45.53314,
        6.05487
      ],
      [
        45.53327,
        6.05518
      ]
    ],
    "distance": 2,
    "elevation": 35,
    "hours": "0.5–1",
    "paid": false,
    "terrainType": "Accessible lakeside path, paved and packed dirt",
    "terrainRank": 0,
    "surfaceHazards": [],
    "shadeCoverage": 25,
    "heatRisk": "moderate",
    "safetyLevel": "low-risk",
    "exposure": false,
    "waterSources": [
      {
        "km": 0,
        "label": "Drinking water (OSM-verified location)"
      }
    ],
    "rifugi": [],
    "startPoint": {
      "lat": 45.533274,
      "lng": 6.0551773,
      "label": "Start here: parking du lac de la Thuile, by the village and mairie"
    },
    "desc": "The gentle lap of the only natural lake in the Bauges massif, ringed by meadows below the village of La Thuile at 870 m. The shoreline path is level and accessible, wheelchairs, joelettes and strollers included, with the Bauges summits mirrored in the water and benches along the way. A short, calm outing that works in every season.",
    "tips": "The leash is compulsory around the lake, letting dogs run free is explicitly forbidden, and picking up after them is required. Swimming is neither supervised nor arranged, tolerated at your own risk and strictly banned when the lake freezes, so a paddling dog is at your judgement outside winter. A fountain sits at the start, and the village is right there for anything else. Fishing lines share the banks in season, so mind curious noses.",
    "imageIcon": "images/boucle-du-lac-de-la-thuile.webp",
    "imageCredit": {
      "text": "Rando'Bauges, PNR du Massif des Bauges (edited)",
      "url": "https://rando.parcdesbauges.com/trek/10361-Lac-de-la-Thuile-et-Rocher-de-Manettaz"
    }
  },
  // --- Savoy, verified 2026-07-14: dog-friendly confirmed by site owner. Facts:
  //     commune de Saint-Pierre-d'Albigny (Circuit du Belvedere, APA, 270 m),
  //     Waymarked Trails rel. 19153189 (operator, signed direction). ---
  {
    "id": "osm-19153189",
    "osmRelation": 19153189,
    "waymarkedtrails": "https://hiking.waymarkedtrails.org/#route?id=19153189",
    "name": "Le Belvédère (Saint-Pierre-d'Albigny)",
    "area": "Saint-Pierre-d'Albigny",
    "lat": 45.5719566,
    "lng": 6.1589676,
    "path": [
      [
        45.57196,
        6.15897
      ],
      [
        45.57266,
        6.15736
      ],
      [
        45.57266,
        6.1572
      ],
      [
        45.57277,
        6.15725
      ],
      [
        45.57287,
        6.15702
      ],
      [
        45.5734,
        6.15649
      ],
      [
        45.57363,
        6.15607
      ],
      [
        45.57457,
        6.15559
      ],
      [
        45.57493,
        6.15574
      ],
      [
        45.57534,
        6.15567
      ],
      [
        45.57586,
        6.15544
      ],
      [
        45.57614,
        6.15542
      ],
      [
        45.57635,
        6.15553
      ],
      [
        45.57659,
        6.15579
      ],
      [
        45.57669,
        6.15603
      ],
      [
        45.57695,
        6.15769
      ],
      [
        45.57663,
        6.15829
      ],
      [
        45.57685,
        6.15859
      ],
      [
        45.57693,
        6.15887
      ],
      [
        45.57679,
        6.15994
      ],
      [
        45.57669,
        6.16016
      ],
      [
        45.57702,
        6.16031
      ],
      [
        45.57701,
        6.16041
      ],
      [
        45.57741,
        6.1609
      ],
      [
        45.577,
        6.16172
      ],
      [
        45.57675,
        6.16202
      ],
      [
        45.57652,
        6.16212
      ],
      [
        45.57616,
        6.16281
      ],
      [
        45.57615,
        6.16389
      ],
      [
        45.5764,
        6.1644
      ],
      [
        45.57612,
        6.1654
      ],
      [
        45.57613,
        6.16584
      ],
      [
        45.57632,
        6.16602
      ],
      [
        45.57627,
        6.16657
      ],
      [
        45.57646,
        6.16716
      ],
      [
        45.5765,
        6.16767
      ],
      [
        45.57669,
        6.16796
      ],
      [
        45.57694,
        6.16865
      ],
      [
        45.57722,
        6.16903
      ],
      [
        45.57761,
        6.16937
      ],
      [
        45.57791,
        6.16987
      ],
      [
        45.57809,
        6.17041
      ],
      [
        45.57819,
        6.17036
      ],
      [
        45.57847,
        6.17053
      ],
      [
        45.57868,
        6.17152
      ],
      [
        45.5786,
        6.17211
      ],
      [
        45.57868,
        6.17305
      ],
      [
        45.57849,
        6.1733
      ],
      [
        45.57818,
        6.17252
      ],
      [
        45.5781,
        6.17207
      ],
      [
        45.57761,
        6.17173
      ],
      [
        45.57712,
        6.17176
      ],
      [
        45.57688,
        6.17157
      ],
      [
        45.57654,
        6.17148
      ],
      [
        45.57625,
        6.17121
      ],
      [
        45.57612,
        6.17132
      ],
      [
        45.57602,
        6.17179
      ],
      [
        45.57568,
        6.17202
      ],
      [
        45.57543,
        6.17193
      ],
      [
        45.57501,
        6.17149
      ],
      [
        45.57437,
        6.17034
      ],
      [
        45.57405,
        6.16817
      ],
      [
        45.57363,
        6.16619
      ],
      [
        45.57395,
        6.16362
      ],
      [
        45.57392,
        6.16319
      ],
      [
        45.57428,
        6.16198
      ],
      [
        45.57419,
        6.16112
      ],
      [
        45.57409,
        6.16072
      ],
      [
        45.57335,
        6.15912
      ],
      [
        45.57201,
        6.15903
      ]
    ],
    "distance": 4,
    "elevation": 270,
    "hours": "1.5–2",
    "paid": false,
    "terrainType": "Village lanes, grassy tracks and hillside paths",
    "terrainRank": 1,
    "surfaceHazards": [],
    "safetyLevel": "moderate",
    "exposure": false,
    "waterSources": [
      {
        "km": 0.9,
        "label": "Drinking water (OSM-verified location)"
      }
    ],
    "rifugi": [],
    "startPoint": {
      "lat": 45.5719566,
      "lng": 6.1589676,
      "label": "Start here: gymnasium parking, Saint-Pierre-d'Albigny, opposite the collège des Frontailles"
    },
    "desc": "One of seven circuits waymarked with a pink footprint by the Amicale Pédestre de l'Arclusaz around Saint-Pierre-d'Albigny, also signed as a trail-running loop. It climbs through the forest above the village to a belvedere sweeping from Mont Blanc and the Beaufortain round to the Grand Arc, Lauzière, Belledonne and Chartreuse, then returns via Mont Benoit, the col du Taccon and the Noiriat hamlet. Dog-friendly; not to be confused with the Belvédère de la Chambotte above the Lac du Bourget.",
    "tips": "Dogs are welcome; keep the leash on near pastures and through the village, the standard in the Bauges regional park. Follow the pink footprints in the signed direction, the loop is meant to be walked one way. One fountain is mapped at km 0.9, and the climb is honest for its short length, so pace older dogs.",
    "imageIcon": "images/le-belvedere-saint-pierre-d-albigny.webp",
    "imageCredit": {
      "text": "APA Saint-Pierre-d'Albigny, via Cœur de Savoie Tourisme (Apidae), edited",
      "url": "https://tourisme.coeurdesavoie.fr/fiches/circuit-trail-du-belvedere-6574100/"
    }
  },
  // --- Savoy, verified 2026-07-14 (Coeur de Savoie Tourisme fiche: dogs on leash,
  //     4h30, 780 m ascent tag; Manettaz belvedere danger sign -> exposure/caution) ---
  {
    "id": "osm-15591346",
    "name": "Sentier des Buis",
    "area": "Montmélian",
    "lat": 45.5046876,
    "lng": 6.0514101,
    "osmRelation": 15591346,
    "waymarkedtrails": "https://hiking.waymarkedtrails.org/#route?id=15591346",
    "path": [
      [
        45.50469,
        6.05141
      ],
      [
        45.50496,
        6.05129
      ],
      [
        45.50665,
        6.05269
      ],
      [
        45.50689,
        6.05331
      ],
      [
        45.50686,
        6.05456
      ],
      [
        45.507,
        6.05547
      ],
      [
        45.50717,
        6.05551
      ],
      [
        45.50723,
        6.05562
      ],
      [
        45.50731,
        6.05633
      ],
      [
        45.50753,
        6.05717
      ],
      [
        45.5087,
        6.05951
      ],
      [
        45.50888,
        6.06128
      ],
      [
        45.50932,
        6.0622
      ],
      [
        45.50956,
        6.06331
      ],
      [
        45.50963,
        6.06438
      ],
      [
        45.51009,
        6.06614
      ],
      [
        45.51043,
        6.06609
      ],
      [
        45.51079,
        6.06617
      ],
      [
        45.51127,
        6.06637
      ],
      [
        45.51173,
        6.06676
      ],
      [
        45.51223,
        6.06672
      ],
      [
        45.51262,
        6.0679
      ],
      [
        45.51324,
        6.06876
      ],
      [
        45.51334,
        6.06875
      ],
      [
        45.51334,
        6.06834
      ],
      [
        45.51345,
        6.06826
      ],
      [
        45.51405,
        6.06885
      ],
      [
        45.51454,
        6.06959
      ],
      [
        45.51497,
        6.06994
      ],
      [
        45.51525,
        6.07004
      ],
      [
        45.51573,
        6.07062
      ],
      [
        45.51643,
        6.07089
      ],
      [
        45.51696,
        6.07128
      ],
      [
        45.51727,
        6.07192
      ],
      [
        45.51808,
        6.07282
      ],
      [
        45.51832,
        6.07321
      ],
      [
        45.5192,
        6.07402
      ],
      [
        45.52002,
        6.07455
      ],
      [
        45.52047,
        6.07494
      ],
      [
        45.52114,
        6.07606
      ],
      [
        45.52164,
        6.07639
      ],
      [
        45.52198,
        6.07678
      ],
      [
        45.52258,
        6.07691
      ],
      [
        45.52295,
        6.0767
      ],
      [
        45.52219,
        6.07564
      ],
      [
        45.52209,
        6.07509
      ],
      [
        45.52236,
        6.07514
      ],
      [
        45.52254,
        6.07542
      ],
      [
        45.52327,
        6.07515
      ],
      [
        45.52384,
        6.07541
      ],
      [
        45.524,
        6.07539
      ],
      [
        45.52406,
        6.07527
      ],
      [
        45.52379,
        6.07494
      ],
      [
        45.52267,
        6.07292
      ],
      [
        45.5226,
        6.07205
      ],
      [
        45.52198,
        6.07011
      ],
      [
        45.52206,
        6.07002
      ],
      [
        45.52224,
        6.07007
      ],
      [
        45.52188,
        6.06883
      ],
      [
        45.52201,
        6.06751
      ],
      [
        45.52178,
        6.06635
      ],
      [
        45.52202,
        6.06634
      ],
      [
        45.52203,
        6.06617
      ],
      [
        45.52189,
        6.06527
      ],
      [
        45.52162,
        6.0644
      ],
      [
        45.52138,
        6.06383
      ],
      [
        45.52123,
        6.06368
      ],
      [
        45.52098,
        6.06208
      ],
      [
        45.52084,
        6.06166
      ],
      [
        45.52099,
        6.06106
      ],
      [
        45.52067,
        6.0611
      ],
      [
        45.52018,
        6.06071
      ],
      [
        45.52012,
        6.06043
      ],
      [
        45.52014,
        6.05981
      ],
      [
        45.52022,
        6.05953
      ],
      [
        45.52037,
        6.05942
      ],
      [
        45.52038,
        6.05922
      ],
      [
        45.5198,
        6.05873
      ],
      [
        45.5194,
        6.05825
      ],
      [
        45.51956,
        6.05779
      ],
      [
        45.51922,
        6.0569
      ],
      [
        45.51916,
        6.05628
      ],
      [
        45.519,
        6.05613
      ],
      [
        45.51902,
        6.05597
      ],
      [
        45.5189,
        6.05572
      ],
      [
        45.51828,
        6.05522
      ],
      [
        45.518,
        6.0544
      ],
      [
        45.51796,
        6.05513
      ],
      [
        45.51779,
        6.05456
      ],
      [
        45.51769,
        6.05449
      ],
      [
        45.51757,
        6.05516
      ],
      [
        45.51741,
        6.0547
      ],
      [
        45.51721,
        6.0545
      ],
      [
        45.51716,
        6.05456
      ],
      [
        45.5171,
        6.05451
      ],
      [
        45.51701,
        6.05408
      ],
      [
        45.51688,
        6.05422
      ],
      [
        45.51673,
        6.05333
      ],
      [
        45.51644,
        6.05299
      ],
      [
        45.51628,
        6.05254
      ],
      [
        45.51619,
        6.05189
      ],
      [
        45.51634,
        6.052
      ],
      [
        45.51617,
        6.05123
      ],
      [
        45.51594,
        6.05105
      ],
      [
        45.51592,
        6.05125
      ],
      [
        45.51548,
        6.05091
      ],
      [
        45.5156,
        6.05144
      ],
      [
        45.51457,
        6.05032
      ],
      [
        45.51446,
        6.05032
      ],
      [
        45.51417,
        6.05057
      ],
      [
        45.51381,
        6.05048
      ],
      [
        45.51421,
        6.05169
      ],
      [
        45.51375,
        6.05155
      ],
      [
        45.51283,
        6.05109
      ],
      [
        45.51253,
        6.05068
      ],
      [
        45.51233,
        6.05081
      ],
      [
        45.51246,
        6.05102
      ],
      [
        45.51251,
        6.05137
      ],
      [
        45.51273,
        6.05174
      ],
      [
        45.51244,
        6.05158
      ],
      [
        45.51223,
        6.05136
      ],
      [
        45.51201,
        6.05145
      ],
      [
        45.51217,
        6.05157
      ],
      [
        45.51231,
        6.05188
      ],
      [
        45.51249,
        6.05239
      ],
      [
        45.51253,
        6.05278
      ],
      [
        45.5131,
        6.05372
      ],
      [
        45.51308,
        6.0538
      ],
      [
        45.51298,
        6.0538
      ],
      [
        45.5127,
        6.05359
      ],
      [
        45.51212,
        6.05345
      ],
      [
        45.51158,
        6.05296
      ],
      [
        45.51125,
        6.05292
      ],
      [
        45.51082,
        6.05232
      ],
      [
        45.51053,
        6.05213
      ],
      [
        45.51021,
        6.05128
      ],
      [
        45.51016,
        6.05068
      ],
      [
        45.50997,
        6.05031
      ],
      [
        45.50949,
        6.04971
      ],
      [
        45.50956,
        6.04925
      ],
      [
        45.50949,
        6.04913
      ],
      [
        45.50931,
        6.04936
      ],
      [
        45.50916,
        6.04987
      ],
      [
        45.50935,
        6.05017
      ],
      [
        45.50945,
        6.05098
      ],
      [
        45.50943,
        6.05279
      ],
      [
        45.50959,
        6.05335
      ],
      [
        45.50955,
        6.05351
      ],
      [
        45.50966,
        6.05409
      ],
      [
        45.50979,
        6.05439
      ],
      [
        45.50976,
        6.05486
      ],
      [
        45.51008,
        6.05573
      ],
      [
        45.50977,
        6.05549
      ],
      [
        45.50939,
        6.05503
      ],
      [
        45.50919,
        6.05458
      ],
      [
        45.50916,
        6.05501
      ],
      [
        45.50934,
        6.0558
      ],
      [
        45.50933,
        6.05604
      ],
      [
        45.50906,
        6.05562
      ],
      [
        45.50908,
        6.05584
      ],
      [
        45.50837,
        6.05477
      ],
      [
        45.50799,
        6.05373
      ],
      [
        45.50788,
        6.05472
      ],
      [
        45.50791,
        6.05502
      ],
      [
        45.50784,
        6.05503
      ],
      [
        45.50767,
        6.05392
      ],
      [
        45.50759,
        6.0538
      ],
      [
        45.50751,
        6.054
      ],
      [
        45.50726,
        6.05375
      ],
      [
        45.50696,
        6.05309
      ],
      [
        45.50689,
        6.05331
      ],
      [
        45.50632,
        6.05195
      ],
      [
        45.50567,
        6.05121
      ],
      [
        45.50496,
        6.05129
      ],
      [
        45.50469,
        6.05141
      ]
    ],
    "distance": 9.7,
    "elevation": 780,
    "hours": "4–4.5",
    "paid": false,
    "terrainType": "Mountain paths through vineyard, boxwood and dry meadow, some rough tracks",
    "terrainRank": 2,
    "elevationProfile": [
      {
        "km": 0,
        "elev": 299
      },
      {
        "km": 0.9,
        "elev": 373
      },
      {
        "km": 1.5,
        "elev": 329
      },
      {
        "km": 2.2,
        "elev": 436
      },
      {
        "km": 3,
        "elev": 587
      },
      {
        "km": 3.8,
        "elev": 768
      },
      {
        "km": 4.4,
        "elev": 997
      },
      {
        "km": 5.2,
        "elev": 1027
      },
      {
        "km": 5.9,
        "elev": 1028
      },
      {
        "km": 6.7,
        "elev": 932
      },
      {
        "km": 7.4,
        "elev": 764
      },
      {
        "km": 8.1,
        "elev": 613
      },
      {
        "km": 8.9,
        "elev": 433
      },
      {
        "km": 9.6,
        "elev": 342
      },
      {
        "km": 9.7,
        "elev": 299
      }
    ],
    "surfaceHazards": [
      "Unprotected drop at the Roc de Manettaz belvedere (signed danger)",
      "Sustained mountain-path climbing on T2 ground"
    ],
    "shadeCoverage": 50,
    "heatRisk": "moderate",
    "safetyLevel": "caution",
    "exposure": true,
    "waterSources": [],
    "rifugi": [],
    "startPoint": {
      "lat": 45.5046876,
      "lng": 6.0514101,
      "label": "Start here: cemetery car park on chemin de Beauvoir, Montmélian, heading for the Calloudes hamlet"
    },
    "decisionPoints": [
      {
        "km": 2.9,
        "lat": 45.52047,
        "lng": 6.07494,
        "instruction": "Roc de Manettaz belvedere and orientation table: sweeping view over the Combe de Savoie and Belledonne, with an unprotected edge, keep dogs leashed and close here"
      }
    ],
    "desc": "A proper half-day loop above Montmélian through everything that makes the Combe de Savoie's sunny side special: the Arbin vineyards, locust and laburnum copses, pine woods, the protected dry meadow of La Générale, and the boxwood thickets that name the trail. The ridge rewards with the Roc de Manettaz belvedere and its orientation table before the descent past the Col du Mont picnic spot. A Coeur de Savoie circuit, waymarked in yellow; dogs are accepted on a leash.",
    "tips": "Keep the leash on, that's the official condition, and doubly wise in the protected meadow and near the belvedere's edge. No water is mapped anywhere on the loop, so carry a full supply for 4 hours plus; the south-facing vineyard slopes bake in summer, so start early. The 780 m of climbing on rough mountain paths is a genuine workout, check your dog's match score honestly. Best outside the hottest months; the dry-meadow flora peaks in late spring.",
    "imageIcon": "images/sentier-des-buis.webp",
    "imageCredit": {
      "text": "Cœur de Savoie Tourisme (Apidae), edited",
      "url": "https://tourisme.coeurdesavoie.fr/fiches/le-sentier-des-buis-114550/"
    }
  },
  // --- Savoy, ENRICHED IMPORT 2026-07-14: curated:false (no citable dog rule; cattle,
  //     fences, patou risk). Facts: Grand Chambery Alpes Tourisme fiche (red/hard,
  //     640 m, 5h, Le Fournet start, open 01/06-01/10). Loop rebuilt from WMT relation. ---
  {
    "id": "osm-16365005",
    "source": "osm",
    "curated": false,
    "osmRelation": 16365005,
    "waymarkedtrails": "https://hiking.waymarkedtrails.org/#route?id=16365005",
    "name": "La Galoppaz par la Combe Servenne",
    "area": "Thoiry (Bauges)",
    "lat": 45.58083,
    "lng": 6.06202,
    "path": [
      [
        45.58083,
        6.06202
      ],
      [
        45.58208,
        6.06295
      ],
      [
        45.58186,
        6.0632
      ],
      [
        45.58118,
        6.06318
      ],
      [
        45.58089,
        6.06356
      ],
      [
        45.58018,
        6.06404
      ],
      [
        45.5803,
        6.06548
      ],
      [
        45.58066,
        6.06548
      ],
      [
        45.5811,
        6.06587
      ],
      [
        45.58241,
        6.06574
      ],
      [
        45.5836,
        6.06628
      ],
      [
        45.58406,
        6.06611
      ],
      [
        45.58448,
        6.06665
      ],
      [
        45.58471,
        6.06723
      ],
      [
        45.58465,
        6.06747
      ],
      [
        45.58448,
        6.06759
      ],
      [
        45.58411,
        6.06764
      ],
      [
        45.58402,
        6.06805
      ],
      [
        45.58369,
        6.0682
      ],
      [
        45.58337,
        6.06862
      ],
      [
        45.58338,
        6.06902
      ],
      [
        45.58306,
        6.06901
      ],
      [
        45.583,
        6.06917
      ],
      [
        45.5832,
        6.06945
      ],
      [
        45.5828,
        6.06956
      ],
      [
        45.58252,
        6.06985
      ],
      [
        45.58299,
        6.07014
      ],
      [
        45.58286,
        6.0703
      ],
      [
        45.58314,
        6.07041
      ],
      [
        45.5832,
        6.0705
      ],
      [
        45.5831,
        6.07055
      ],
      [
        45.58333,
        6.07089
      ],
      [
        45.58289,
        6.07094
      ],
      [
        45.58247,
        6.07118
      ],
      [
        45.5829,
        6.07175
      ],
      [
        45.5829,
        6.07196
      ],
      [
        45.58246,
        6.07253
      ],
      [
        45.58276,
        6.07297
      ],
      [
        45.58301,
        6.07302
      ],
      [
        45.58393,
        6.07369
      ],
      [
        45.58357,
        6.07412
      ],
      [
        45.58319,
        6.07411
      ],
      [
        45.58215,
        6.07448
      ],
      [
        45.58162,
        6.07437
      ],
      [
        45.58107,
        6.07458
      ],
      [
        45.57944,
        6.07428
      ],
      [
        45.57799,
        6.07478
      ],
      [
        45.57754,
        6.07528
      ],
      [
        45.57735,
        6.0753
      ],
      [
        45.57659,
        6.07448
      ],
      [
        45.57543,
        6.07395
      ],
      [
        45.57482,
        6.07329
      ],
      [
        45.57478,
        6.07287
      ],
      [
        45.5746,
        6.07272
      ],
      [
        45.57362,
        6.07221
      ],
      [
        45.57265,
        6.0721
      ],
      [
        45.57241,
        6.07177
      ],
      [
        45.5717,
        6.07141
      ],
      [
        45.57127,
        6.07036
      ],
      [
        45.57043,
        6.06944
      ],
      [
        45.57017,
        6.06898
      ],
      [
        45.5693,
        6.06827
      ],
      [
        45.56846,
        6.06811
      ],
      [
        45.56793,
        6.06918
      ],
      [
        45.56788,
        6.06905
      ],
      [
        45.56751,
        6.06901
      ],
      [
        45.56681,
        6.06857
      ],
      [
        45.56623,
        6.06783
      ],
      [
        45.56572,
        6.06592
      ],
      [
        45.56648,
        6.06822
      ],
      [
        45.56637,
        6.06919
      ],
      [
        45.56542,
        6.06881
      ],
      [
        45.56483,
        6.06829
      ],
      [
        45.5642,
        6.06796
      ],
      [
        45.56374,
        6.06795
      ],
      [
        45.56329,
        6.0674
      ],
      [
        45.56303,
        6.06737
      ],
      [
        45.56308,
        6.06819
      ],
      [
        45.56299,
        6.06814
      ],
      [
        45.56268,
        6.06752
      ],
      [
        45.56224,
        6.06703
      ],
      [
        45.56169,
        6.06581
      ],
      [
        45.56184,
        6.06513
      ],
      [
        45.56229,
        6.06472
      ],
      [
        45.56266,
        6.06484
      ],
      [
        45.56238,
        6.06455
      ],
      [
        45.56298,
        6.06436
      ],
      [
        45.56334,
        6.06384
      ],
      [
        45.56345,
        6.06293
      ],
      [
        45.56417,
        6.06202
      ],
      [
        45.56409,
        6.06191
      ],
      [
        45.56455,
        6.06165
      ],
      [
        45.56553,
        6.06047
      ],
      [
        45.56604,
        6.06021
      ],
      [
        45.56693,
        6.05931
      ],
      [
        45.56756,
        6.05905
      ],
      [
        45.56779,
        6.05861
      ],
      [
        45.56799,
        6.05865
      ],
      [
        45.56886,
        6.05964
      ],
      [
        45.56967,
        6.0608
      ],
      [
        45.57058,
        6.06157
      ],
      [
        45.57102,
        6.06229
      ],
      [
        45.57108,
        6.06264
      ],
      [
        45.57183,
        6.06262
      ],
      [
        45.57341,
        6.06331
      ],
      [
        45.57373,
        6.06357
      ],
      [
        45.574,
        6.06419
      ],
      [
        45.57558,
        6.06517
      ],
      [
        45.57623,
        6.06585
      ],
      [
        45.57696,
        6.06575
      ],
      [
        45.57807,
        6.06603
      ],
      [
        45.57892,
        6.06566
      ],
      [
        45.57971,
        6.06498
      ],
      [
        45.57984,
        6.06503
      ],
      [
        45.5801,
        6.06563
      ],
      [
        45.5803,
        6.06548
      ]
    ],
    "distance": 8.1,
    "elevation": 640,
    "hours": "5",
    "paid": false,
    "terrainType": "Forest paths, steep alpage slopes and grassy mountain trails",
    "terrainRank": 2,
    "surfaceHazards": [
      "Livestock warning: cattle herds summer on the Buffaz and Servenne alpages, patou guard dogs possible",
      "Sustained steep climb after the forest, red-rated by the tourist office",
      "Faint trail sections and several pasture fences to cross on the descent"
    ],
    "safetyLevel": "caution",
    "exposure": false,
    "waterSources": [
      {
        "km": 1.3,
        "label": "Fontaine Aleure"
      },
      {
        "km": 3.4,
        "label": "Drinking water (OSM-verified location)"
      },
      {
        "km": 4,
        "label": "Drinking water (OSM-verified location)"
      },
      {
        "km": 8.9,
        "label": "Source du Dard"
      }
    ],
    "rifugi": [],
    "startPoint": {
      "lat": 45.58083,
      "lng": 6.06202,
      "label": "Start here: Le Fournet parking (1,043 m), on the D206 2 km before the Col des Prés, Thoiry"
    },
    "decisionPoints": [
      {
        "km": 3.1,
        "lat": 45.57543,
        "lng": 6.07395,
        "instruction": "Pointe de la Galoppaz (1,681 m), reached by a short out-and-back from the shoulder: full panorama over the Chambéry valley and the high Bauges, Colombier, Trélod and Arcalod"
      }
    ],
    "desc": "The little pyramid of the southern Bauges, climbed as a loop from Le Fournet on the Col des Prés road. The route warms up in forest, then takes a steep, sustained climb past the Chalet de l'Allier to the Buffaz alpage and its col, rolls through flower meadows where cattle summer, and tops out with an out-and-back to the Pointe de la Galoppaz before descending the grassy Combe Servenne past the Côtes de Marles chalets. Rated red (hard) by Grand Chambéry Alpes Tourisme, about 5 hours.",
    "tips": "Imported route, not yet field-reviewed by ORMA, and no dog rule is published for it, so treat that as unconfirmed. Around the herds: keep the leash on, give any flock a wide berth even if it means leaving the path, stay calm if a patou approaches, and close every fence behind you. Four water points are mapped, including the Fontaine Aleure at km 1.3 and the Source du Dard near the end. The fiche opens the route from June to the start of October only. The mapped line was rebuilt from the full waymarked relation, replacing the broken straight segment our import showed.",
    "imageIcon": "images/la-galoppaz-par-la-combe-servenne.webp",
    "imageCredit": {
      "text": "altituderando.com (edited)",
      "url": "https://www.altituderando.com/Pointe-de-la-Galoppaz-1681m-par-le-Fournet"
    }
  },
];

// Current Waymarked/OSM geometry recovered for legacy Dolomites records that
// previously rendered as a single map pin. These remain unverified until the
// ORMA graduation gates are complete.
const recoveredWaymarkedTrailOverrides = {"seceda":{"lat":46.59794,"lng":11.72435,"path":[[46.59794,11.72435],[46.59779,11.72446],[46.59813,11.72541],[46.5981,11.72621],[46.59773,11.72634],[46.59755,11.72717],[46.59789,11.7287],[46.59782,11.72945],[46.5974,11.72944],[46.5969,11.72875],[46.59635,11.72863],[46.59468,11.72656],[46.59391,11.72641],[46.59293,11.72672],[46.59341,11.72756],[46.59343,11.72833],[46.59361,11.7288],[46.59388,11.72882],[46.595,11.73047],[46.59501,11.73259],[46.5955,11.73455],[46.59518,11.73556],[46.59409,11.7359],[46.59404,11.73656],[46.59357,11.73719],[46.59362,11.73786],[46.5934,11.7382],[46.59305,11.73837],[46.59209,11.73807],[46.59131,11.73848],[46.59073,11.73851],[46.58975,11.73834],[46.58924,11.73777],[46.58879,11.73804],[46.5885,11.73917],[46.58826,11.73949],[46.58677,11.73972],[46.58632,11.74003],[46.586,11.7399],[46.5856,11.74019],[46.58449,11.74038],[46.58408,11.73986],[46.5834,11.7399],[46.583,11.73933],[46.58144,11.73986],[46.58126,11.7403],[46.58129,11.74116],[46.58108,11.742],[46.58065,11.74212],[46.57989,11.74297],[46.5789,11.74259],[46.57989,11.74297],[46.57945,11.74372],[46.5791,11.74371],[46.57892,11.74432],[46.57825,11.74477],[46.57781,11.74565],[46.57655,11.74646],[46.57584,11.74639],[46.57553,11.7461],[46.57583,11.74856],[46.57686,11.74953],[46.57759,11.74986],[46.57785,11.75025],[46.57783,11.75072],[46.57921,11.75243],[46.57947,11.75339],[46.58015,11.75356],[46.58104,11.755],[46.58125,11.75562],[46.5815,11.75574],[46.58226,11.75677],[46.58305,11.75711],[46.58374,11.75788],[46.58589,11.75937],[46.58682,11.75932],[46.58742,11.75956],[46.58747,11.7588],[46.58717,11.75824],[46.58814,11.75763],[46.58835,11.75583],[46.58864,11.75544],[46.58888,11.75418],[46.58979,11.7524],[46.58962,11.75118],[46.58989,11.7493],[46.58957,11.74845],[46.59053,11.74853],[46.59039,11.74811],[46.59048,11.74814],[46.59042,11.74783],[46.59056,11.7479],[46.59044,11.74756],[46.59071,11.74761],[46.59065,11.74732],[46.59216,11.7486],[46.5927,11.74862],[46.5934,11.74727],[46.59394,11.74566],[46.59339,11.7446],[46.59472,11.74399],[46.59513,11.74323],[46.59566,11.74294],[46.59592,11.74203],[46.59624,11.74163],[46.59648,11.74177],[46.59671,11.74161],[46.5974,11.73996],[46.59769,11.7397],[46.59796,11.73979],[46.59796,11.7394],[46.59874,11.73807],[46.59891,11.73817],[46.59915,11.7379],[46.59964,11.73838],[46.59971,11.73794],[46.59981,11.73801],[46.59969,11.73721],[46.59989,11.73506],[46.5997,11.73005],[46.59851,11.72591],[46.59779,11.72446],[46.59794,11.72435]],"distance":10.8,"hours":"3.5–4.5","source":"osm","curated":false,"osmRelation":6528494,"waymarkedRelations":[6528494,9430475],"waymarkedtrails":"https://hiking.waymarkedtrails.org/#route?id=6528494&type=relation","routeSource":{"name":"Seceda–Firenze–Troier circuit (paths 1 and 1A)","provider":"Waymarked Trails / OpenStreetMap","relations":[6528494,9430475],"fetchedAt":"2026-07-17"},"startPoint":{"lat":46.59794,"lng":11.72435,"label":"Start here — Seceda upper lift station"}},"santa-maddalena":{"name":"Rundweg St. Magdalena","lat":46.64082,"lng":11.71624,"path":[[46.64082,11.71624],[46.6409,11.71646],[46.64112,11.71647],[46.64195,11.71623],[46.64262,11.71711],[46.64292,11.71721],[46.64342,11.71835],[46.64362,11.71826],[46.64364,11.71667],[46.64386,11.71645],[46.6441,11.71653],[46.64461,11.71957],[46.64478,11.71974],[46.64465,11.71984],[46.64475,11.7205],[46.64339,11.72041],[46.64293,11.71954],[46.64287,11.71878],[46.64256,11.71802],[46.64226,11.71774],[46.64191,11.717],[46.64187,11.7167],[46.64213,11.71642],[46.64175,11.71616],[46.64088,11.71641]],"distance":1.6,"elevation":null,"elevationProfile":null,"hours":"0.5–1","source":"osm","curated":false,"osmRelation":11817704,"waymarkedtrails":"https://hiking.waymarkedtrails.org/#route?id=11817704&type=relation","routeSource":{"name":"Rundweg St. Magdalena","provider":"Waymarked Trails / OpenStreetMap","relation":11817704,"fetchedAt":"2026-07-17"},"startPoint":{"lat":46.64082,"lng":11.71624,"label":"Route start — St. Magdalena village"}},"cadini":{"lat":46.61204,"lng":12.29638,"path":[[46.61204,12.29638],[46.61156,12.29655],[46.61089,12.2973],[46.60978,12.29726],[46.60961,12.2987],[46.60933,12.29853],[46.60879,12.29876],[46.60781,12.29962],[46.60589,12.30042],[46.60497,12.30149],[46.6042,12.30114],[46.60391,12.30055],[46.60395,12.29982],[46.6037,12.29958],[46.60386,12.29932],[46.6033,12.29833],[46.603,12.2967],[46.60267,12.29607],[46.60221,12.29593],[46.60141,12.29529]],"distance":3.4,"elevation":148,"hours":"1.5","source":"osm","curated":false,"osmRelation":1067616,"waymarkedtrails":"https://hiking.waymarkedtrails.org/#route?id=1067616&type=relation","routeSource":{"name":"Sentiero Bonacossa 117 — Auronzo to viewpoint section","provider":"Waymarked Trails / OpenStreetMap","relation":1067616,"fetchedAt":"2026-07-17"},"startPoint":{"lat":46.61204,"lng":12.29638,"label":"Start here — Rifugio Auronzo"}},"prato-piazza":{"lat":46.65376,"lng":12.17907,"path":[[46.65376,12.17907],[46.65293,12.17967],[46.65263,12.18026],[46.65259,12.18106],[46.65304,12.18196],[46.65266,12.18259],[46.65217,12.18267],[46.64948,12.18542],[46.64773,12.18836],[46.64493,12.19188],[46.64439,12.19307],[46.64429,12.19364],[46.64271,12.19424],[46.64135,12.19433],[46.64075,12.19598],[46.64063,12.19692],[46.64019,12.19763]],"distance":4.6,"hours":"1.5–2","source":"osm","curated":false,"osmRelation":1155859,"waymarkedtrails":"https://hiking.waymarkedtrails.org/#route?id=1155859&type=relation","routeSource":{"name":"Path 37 — Prato Piazza to the WWI fort section","provider":"Waymarked Trails / OpenStreetMap","relation":1155859,"fetchedAt":"2026-07-17"},"startPoint":{"lat":46.65376,"lng":12.17907,"label":"Start here — Prato Piazza"}},"nuvolau":{"lat":46.48508,"lng":12.05337,"path":[[46.48508,12.05337],[46.48632,12.05342],[46.48686,12.05385],[46.48743,12.05399],[46.48796,12.05379],[46.48827,12.0541],[46.4884,12.05478],[46.48924,12.0551],[46.48962,12.05557],[46.4907,12.05548],[46.49121,12.0561],[46.49164,12.05575],[46.49209,12.05666],[46.4925,12.05685],[46.4926,12.05718],[46.49397,12.057],[46.49377,12.05633],[46.4932,12.05612],[46.49334,12.05546],[46.49306,12.05526],[46.49325,12.05507],[46.49294,12.05481],[46.49345,12.05409],[46.49331,12.05406],[46.49338,12.05389],[46.49422,12.05285],[46.49404,12.05277],[46.49434,12.05247],[46.49457,12.0525],[46.49475,12.05178],[46.49514,12.05156],[46.49531,12.05102],[46.49514,12.05079],[46.49437,12.05096],[46.49403,12.05085],[46.49382,12.05055],[46.49322,12.05064],[46.49365,12.04978],[46.49377,12.04868],[46.4936,12.04844],[46.49383,12.04771],[46.49365,12.04775],[46.49398,12.0471],[46.49476,12.04654],[46.49514,12.04575]],"distance":5.5,"source":"osm","curated":false,"osmRelation":3197403,"waymarkedRelations":[3197403,2261098],"waymarkedtrails":"https://hiking.waymarkedtrails.org/#route?id=3197403&type=relation","routeSource":{"name":"Passo Giau to Rifugio Nuvolau (paths 443 and 438)","provider":"Waymarked Trails / OpenStreetMap","relations":[3197403,2261098],"fetchedAt":"2026-07-17"},"startPoint":{"lat":46.48508,"lng":12.05337,"label":"Start here — Passo Giau"}},"sassolungo":{"lat":46.50795,"lng":11.76809,"path":[[46.50795,11.76809],[46.50802,11.76739],[46.50872,11.76622],[46.50812,11.76488],[46.50851,11.76281],[46.50798,11.76094],[46.50771,11.76066],[46.50799,11.76005],[46.50793,11.7597],[46.50751,11.75932],[46.50719,11.75812],[46.5066,11.75719],[46.50661,11.75697],[46.50539,11.75522],[46.50509,11.75433],[46.50375,11.75179],[46.503,11.75168],[46.50201,11.75052],[46.50069,11.74966],[46.49963,11.74835],[46.50005,11.7473],[46.50037,11.74554],[46.501,11.74502],[46.50123,11.74362],[46.50204,11.74275],[46.50161,11.74285],[46.50106,11.74209],[46.50035,11.73997],[46.5003,11.73884],[46.49978,11.73762],[46.50044,11.73598],[46.50099,11.73595],[46.50045,11.73462],[46.5004,11.73407],[46.50153,11.73316],[46.5021,11.73144],[46.50201,11.73058],[46.50133,11.72903],[46.50133,11.72763],[46.50172,11.72657],[46.50185,11.72555],[46.50251,11.72445],[46.50308,11.72275],[46.5029,11.7223],[46.50296,11.72162],[46.50338,11.7214],[46.50423,11.72014],[46.50421,11.71987],[46.50389,11.71944],[46.50395,11.71905],[46.50368,11.71866],[46.50386,11.71775],[46.5037,11.71725],[46.50398,11.71678],[46.50401,11.71608],[46.50457,11.71391],[46.50454,11.71349],[46.50419,11.71272],[46.50462,11.71241],[46.50482,11.71258],[46.5051,11.71247],[46.50577,11.71116],[46.50648,11.7091],[46.50634,11.70863],[46.50648,11.70751],[46.5064,11.70679],[46.50592,11.70588],[46.50587,11.70499],[46.50552,11.7046],[46.50527,11.70399],[46.5053,11.70179],[46.50472,11.70069],[46.50581,11.69872],[46.50629,11.69833],[46.50794,11.69768],[46.50816,11.69793],[46.50828,11.69881],[46.50879,11.69885],[46.50903,11.69949],[46.50963,11.70004],[46.50967,11.70025],[46.5104,11.70014],[46.51064,11.70039],[46.51096,11.70026],[46.5113,11.70053],[46.51302,11.70104],[46.51374,11.70089],[46.51404,11.70046],[46.51584,11.69922],[46.51651,11.69941],[46.51724,11.69898],[46.51912,11.69875],[46.51938,11.69881],[46.51956,11.6992],[46.51987,11.69906],[46.5207,11.69933],[46.52089,11.6996],[46.52021,11.70021],[46.52018,11.70049],[46.52075,11.70131],[46.5214,11.70162],[46.52164,11.70193],[46.52185,11.70248],[46.5216,11.7033],[46.52179,11.70441],[46.5223,11.70569],[46.52231,11.70614],[46.52272,11.70639],[46.52294,11.70686],[46.52298,11.70961],[46.52275,11.71016],[46.52265,11.71133],[46.52297,11.71344],[46.52275,11.71523],[46.52291,11.71668],[46.52231,11.71792],[46.52216,11.71845],[46.52233,11.7189],[46.52221,11.719],[46.52344,11.71951],[46.52377,11.71936],[46.52439,11.72004],[46.52445,11.72045],[46.52468,11.72073],[46.52516,11.72097],[46.52553,11.72102],[46.5262,11.72033],[46.52717,11.71979],[46.52789,11.71988],[46.52947,11.72051],[46.52976,11.72074],[46.53054,11.72229],[46.53108,11.72279],[46.53092,11.7228],[46.53157,11.72325],[46.53132,11.72392],[46.53225,11.72487],[46.53232,11.7256],[46.53209,11.72631],[46.53232,11.72633],[46.53287,11.72812],[46.53248,11.72938],[46.53246,11.72997],[46.53201,11.73088],[46.53164,11.73397],[46.53098,11.73517],[46.53037,11.7376],[46.53038,11.73878],[46.53007,11.73974],[46.53015,11.74121],[46.53064,11.74374],[46.53064,11.74471],[46.53051,11.74468],[46.53022,11.74568],[46.52998,11.74578],[46.53007,11.74617],[46.52976,11.7464],[46.52984,11.74679],[46.52928,11.7471],[46.5288,11.74859],[46.52789,11.74918],[46.5252,11.74863],[46.52389,11.74866],[46.52281,11.74912],[46.52153,11.75123],[46.52,11.75268],[46.51883,11.75455],[46.51759,11.75467],[46.51634,11.75527],[46.51584,11.7551],[46.51494,11.75547],[46.5142,11.75552],[46.51352,11.75517],[46.51217,11.75665],[46.51135,11.75704],[46.51027,11.75632],[46.50972,11.7567],[46.50911,11.75591],[46.50899,11.75693],[46.50925,11.75748]],"distance":17,"hours":"5–7","source":"osm","curated":false,"osmRelation":5412043,"waymarkedRelations":[5412043,1640019,9435720],"waymarkedtrails":"https://hiking.waymarkedtrails.org/#route?id=5412043&type=relation","routeSource":{"name":"Sassolungo circuit (paths 557, 527 and 526)","provider":"Waymarked Trails / OpenStreetMap","relations":[5412043,1640019,9435720],"fetchedAt":"2026-07-17"},"startPoint":{"lat":46.50795,"lng":11.76809,"label":"Start here — Passo Sella"}},"lago-sorapis":{"lat":46.55621,"lng":12.20445,"path":[[46.55621,12.20445],[46.55537,12.20523],[46.55461,12.2054],[46.55445,12.20621],[46.55335,12.20787],[46.55299,12.20684],[46.55251,12.20719],[46.55162,12.20914],[46.55115,12.21092],[46.55061,12.21223],[46.55014,12.21294],[46.54837,12.21346],[46.54766,12.21321],[46.54693,12.21249],[46.54661,12.21243],[46.54652,12.2136],[46.54601,12.21476],[46.54619,12.21503],[46.54624,12.21605],[46.54643,12.2165],[46.54618,12.21731],[46.54617,12.21803],[46.54527,12.21961],[46.54486,12.22093],[46.54433,12.22166],[46.54422,12.2223],[46.5438,12.22242],[46.5439,12.22284],[46.5437,12.22308],[46.54287,12.22339],[46.54228,12.22395],[46.54111,12.22404],[46.54019,12.22471],[46.53919,12.22479],[46.53839,12.2255],[46.53737,12.22589],[46.53692,12.22694],[46.5365,12.22733],[46.53636,12.22716],[46.53585,12.2274],[46.53507,12.22818],[46.53449,12.22848],[46.53291,12.22888],[46.53247,12.22873],[46.53284,12.22838],[46.53129,12.22778],[46.53089,12.22823],[46.53039,12.22813],[46.53013,12.22842],[46.52757,12.2285],[46.52728,12.22868],[46.52652,12.22831],[46.52599,12.22867],[46.52492,12.22762],[46.52404,12.22705],[46.52406,12.22691],[46.52302,12.22673],[46.52196,12.2257]],"distance":10.8,"source":"osm","curated":false,"osmRelation":3985745,"waymarkedtrails":"https://hiking.waymarkedtrails.org/#route?id=3985745&type=relation","routeSource":{"name":"Path 215 — Passo Tre Croci to Lago di Sorapis section","provider":"Waymarked Trails / OpenStreetMap","relation":3985745,"fetchedAt":"2026-07-17"},"startPoint":{"lat":46.55621,"lng":12.20445,"label":"Start here — Passo Tre Croci"}},"durrenstein":{"lat":46.65376,"lng":12.17907,"path":[[46.65376,12.17907],[46.65357,12.18116],[46.65423,12.1819],[46.65408,12.18394],[46.65431,12.18436],[46.65358,12.18599],[46.6535,12.18897],[46.65451,12.18829],[46.65494,12.18889],[46.65618,12.18845],[46.6569,12.18793],[46.65811,12.1876],[46.65866,12.18759],[46.65886,12.18775],[46.65873,12.18785],[46.65926,12.18816],[46.66027,12.18802],[46.66062,12.18748],[46.66106,12.18739],[46.66167,12.18666],[46.66187,12.1866],[46.66201,12.18695],[46.66241,12.18657],[46.66363,12.18489],[46.66386,12.18409],[46.66429,12.1833],[46.66465,12.18316],[46.66472,12.18283],[46.66496,12.18299],[46.66498,12.18372],[46.66524,12.18366],[46.66515,12.1856],[46.66533,12.18601],[46.66533,12.18646],[46.66523,12.18745],[46.66563,12.1871],[46.66556,12.18774],[46.66574,12.18773],[46.66577,12.18801],[46.66599,12.18792],[46.66603,12.18813],[46.66721,12.1871],[46.66726,12.1874],[46.66907,12.18507],[46.66907,12.18559],[46.66945,12.18542],[46.66945,12.18564],[46.67014,12.18523],[46.67018,12.18571],[46.67035,12.18568],[46.671,12.1851],[46.67102,12.18539],[46.67127,12.18513],[46.67146,12.18531],[46.67192,12.18513],[46.67242,12.18529],[46.67251,12.18555]],"distance":8.3,"elevation":837,"hours":"4.5–5.5","source":"osm","curated":false,"osmRelation":1185345,"waymarkedtrails":"https://hiking.waymarkedtrails.org/#route?id=1185345&type=relation","routeSource":{"name":"Path 40 — Prato Piazza to Dürrenstein","provider":"Waymarked Trails / OpenStreetMap","relation":1185345,"fetchedAt":"2026-07-17"},"startPoint":{"lat":46.65376,"lng":12.17907,"label":"Start here — Prato Piazza"}},"piancavallo":{"lat":46.11185,"lng":12.53045,"path":[[46.11185,12.53045],[46.11299,12.53244],[46.11297,12.53326],[46.11276,12.53372],[46.11273,12.53556],[46.11366,12.53688],[46.11374,12.53913],[46.11323,12.53983],[46.11319,12.54015],[46.11392,12.54276],[46.11349,12.54217],[46.11301,12.54191],[46.11321,12.54263],[46.11323,12.54338],[46.11227,12.54472],[46.11203,12.5463],[46.11211,12.54665],[46.11307,12.54797],[46.11335,12.54866],[46.11297,12.54875],[46.11244,12.54926],[46.11193,12.5493],[46.10918,12.55187],[46.10861,12.55181],[46.10839,12.55091],[46.10797,12.55069],[46.10762,12.55092],[46.10748,12.5505],[46.10676,12.54978],[46.10657,12.54925],[46.10677,12.54879],[46.10629,12.54829],[46.10602,12.54776],[46.10592,12.54695],[46.10546,12.54644],[46.10522,12.54651],[46.10496,12.54699],[46.10404,12.54568],[46.10368,12.54544],[46.10306,12.54618],[46.10274,12.54618],[46.10265,12.54566],[46.10293,12.54538],[46.10307,12.5447],[46.10299,12.54355],[46.10249,12.54345],[46.1002,12.54129],[46.0994,12.54122],[46.09869,12.54045],[46.09829,12.53955],[46.09826,12.53767],[46.09769,12.5363],[46.09732,12.53591],[46.09722,12.53532],[46.09684,12.53489],[46.09687,12.53408],[46.09654,12.5341],[46.09646,12.53343],[46.09563,12.53295],[46.09538,12.53259],[46.09531,12.53211],[46.09669,12.53076],[46.09843,12.53025],[46.09947,12.53031],[46.10066,12.52996],[46.10289,12.52848],[46.10732,12.5271],[46.10744,12.52639],[46.10891,12.52582],[46.10962,12.52491],[46.11009,12.52367]],"distance":7.1,"source":"osm","curated":false,"osmRelation":3508653,"waymarkedtrails":"https://hiking.waymarkedtrails.org/#route?id=3508653&type=relation","routeSource":{"name":"Passeggiata delle Malghe","provider":"Waymarked Trails / OpenStreetMap","relation":3508653,"fetchedAt":"2026-07-17"},"startPoint":{"lat":46.11185,"lng":12.53045,"label":"Waymarked route start — Piancavallo"}}};
Object.entries(recoveredWaymarkedTrailOverrides).forEach(([id, override]) => {
  const trail = trails.find(item => item.id === id);
  if (trail) Object.assign(trail, override);
});


// Gondola / cable-car access lines — real, verified station coordinates,
// rendered as straight lines (aerial cableways run point-to-point, unlike
// hiking trails which wind, so a straight line between real stations is an
// honest representation, not an approximation of unknown geometry).
const gondolas = [
  {
    name: 'Boè',
    liftType: 'gondola',
    status: 'summer',
    from: { lat:46.5487447, lng:11.8715103, label:'Valley/lower station' },
    to:   { lat:46.5266498, lng:11.862692, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Col Pradat',
    liftType: 'gondola',
    status: 'summer',
    from: { lat:46.557849, lng:11.8547516, label:'Valley/lower station' },
    to:   { lat:46.5619692, lng:11.8586655, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Padon',
    liftType: 'chair_lift',
    status: 'summer',
    from: { lat:46.4449499, lng:11.9070202, label:'Valley/lower station' },
    to:   { lat:46.463759, lng:11.892198, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Arabba - Monte Burz',
    liftType: 'chair_lift',
    status: 'summer',
    from: { lat:46.4971541, lng:11.8718812, label:'Valley/lower station' },
    to:   { lat:46.4997284, lng:11.8607991, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Rio Gere - Son Forca',
    liftType: 'chair_lift',
    status: 'summer',
    from: { lat:46.5517792, lng:12.1893736, label:'Valley/lower station' },
    to:   { lat:46.5678697, lng:12.1865709, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Pradel - Rodella',
    liftType: 'gondola',
    status: 'summer',
    from: { lat:46.4923672, lng:11.7810397, label:'Valley/lower station' },
    to:   { lat:46.5022941, lng:11.7524008, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Piza Pranseies',
    liftType: 'chair_lift',
    status: 'summer',
    from: { lat:46.5340068, lng:11.754863, label:'Valley/lower station' },
    to:   { lat:46.5383371, lng:11.7515822, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Fodom (Vauz - Pordoi)',
    liftType: 'gondola',
    status: 'summer',
    from: { lat:46.4881468, lng:11.8443384, label:'Valley/lower station' },
    to:   { lat:46.4879937, lng:11.8150105, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Malga Ciapela-Coston d’Antermoja',
    liftType: 'cable_car',
    status: 'summer',
    from: { lat:46.4276749, lng:11.9107626, label:'Valley/lower station' },
    to:   { lat:46.434732, lng:11.8976264, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Campolongo - Bec de Roces',
    liftType: 'chair_lift',
    status: 'summer',
    from: { lat:46.5195677, lng:11.8716667, label:'Valley/lower station' },
    to:   { lat:46.5130628, lng:11.8641242, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Monte Seura',
    liftType: 'chair_lift',
    status: 'summer',
    from: { lat:46.5506142, lng:11.7157559, label:'Valley/lower station' },
    to:   { lat:46.5390321, lng:11.7265788, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Tramans',
    liftType: 'chair_lift',
    status: 'summer',
    from: { lat:46.5351729, lng:11.7370872, label:'Valley/lower station' },
    to:   { lat:46.5336894, lng:11.7492577, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Colfosco',
    liftType: 'gondola',
    status: 'summer',
    from: { lat:46.5502146, lng:11.8532525, label:'Valley/lower station' },
    to:   { lat:46.5624512, lng:11.8508325, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Vallon',
    liftType: 'chair_lift',
    status: 'summer',
    from: { lat:46.5256114, lng:11.8622222, label:'Valley/lower station' },
    to:   { lat:46.522298, lng:11.8496575, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Costabella (near 46.5525005°N, 11.7639271°E)',
    liftType: 'chair_lift',
    status: 'summer',
    from: { lat:46.5525005, lng:11.7639271, label:'Valley/lower station' },
    to:   { lat:46.5525293, lng:11.7692989, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Falzarego - Lagazuoi',
    liftType: 'cable_car',
    status: 'summer',
    from: { lat:46.5191116, lng:12.008447, label:'Valley/lower station' },
    to:   { lat:46.5275056, lng:12.0089223, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Fedare - Nuvolao',
    liftType: 'chair_lift',
    status: 'summer',
    from: { lat:46.4878576, lng:12.0341521, label:'Valley/lower station' },
    to:   { lat:46.4997071, lng:12.0401598, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Coston d’Antermoja - Serauta',
    liftType: 'cable_car',
    status: 'summer',
    from: { lat:46.434732, lng:11.8976264, label:'Valley/lower station' },
    to:   { lat:46.4376128, lng:11.8793038, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Serauta - Punta Rocca',
    liftType: 'cable_car',
    status: 'summer',
    from: { lat:46.4376128, lng:11.8793038, label:'Valley/lower station' },
    to:   { lat:46.4336487, lng:11.8623795, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Col de Varda',
    liftType: 'chair_lift',
    status: 'summer',
    from: { lat:46.5783114, lng:12.2536929, label:'Valley/lower station' },
    to:   { lat:46.5708441, lng:12.2667424, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Ciampinoi',
    liftType: 'gondola',
    status: 'summer',
    from: { lat:46.5533122, lng:11.7617381, label:'Valley/lower station' },
    to:   { lat:46.538615, lng:11.7533895, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Furcela de Saslonch - Langkofelschartenbahn - Forcella del Sassolungo',
    liftType: 'gondola',
    status: 'summer',
    from: { lat:46.5088903, lng:11.7559296, label:'Valley/lower station' },
    to:   { lat:46.5144856, lng:11.7394796, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Borest',
    liftType: 'gondola',
    status: 'summer',
    from: { lat:46.5481617, lng:11.8710773, label:'Valley/lower station' },
    to:   { lat:46.5498197, lng:11.8541009, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Cortina – Mandres – Faloria',
    liftType: 'cable_car',
    status: 'summer',
    from: { lat:46.537995, lng:12.1406781, label:'Valley/lower station' },
    to:   { lat:46.532618, lng:12.1726708, label:'Mountain/upper station' },
    note: 'Open in summer (confirmed via OSM tagging).',
  },
  {
    name: 'Masarei',
    liftType: 'chair_lift',
    status: 'no-summer',
    from: { lat:46.5170489, lng:11.9075107, label:'Valley/lower station' },
    to:   { lat:46.5329549, lng:11.9159048, label:'Mountain/upper station' },
    note: 'Not open in summer (confirmed via OSM tagging) — winter/ski-season only.',
  },
  {
    name: 'Vizza',
    liftType: 'chair_lift',
    status: 'no-summer',
    from: { lat:46.5163685, lng:11.906331, label:'Valley/lower station' },
    to:   { lat:46.5162787, lng:11.8851324, label:'Mountain/upper station' },
    note: 'Not open in summer (confirmed via OSM tagging) — winter/ski-season only.',
  },
  {
    name: 'Cherz I',
    liftType: 'chair_lift',
    status: 'no-summer',
    from: { lat:46.5201987, lng:11.8733598, label:'Valley/lower station' },
    to:   { lat:46.5165199, lng:11.8843593, label:'Mountain/upper station' },
    note: 'Not open in summer (confirmed via OSM tagging) — winter/ski-season only.',
  },
  {
    name: 'Cherz II',
    liftType: 'chair_lift',
    status: 'no-summer',
    from: { lat:46.5199637, lng:11.8744098, label:'Valley/lower station' },
    to:   { lat:46.5166078, lng:11.8844389, label:'Mountain/upper station' },
    note: 'Not open in summer (confirmed via OSM tagging) — winter/ski-season only.',
  },
  {
    name: 'Le Pale',
    liftType: 'chair_lift',
    status: 'no-summer',
    from: { lat:46.5048704, lng:11.8606759, label:'Valley/lower station' },
    to:   { lat:46.5128058, lng:11.863109, label:'Mountain/upper station' },
    note: 'Not open in summer (confirmed via OSM tagging) — winter/ski-season only.',
  },
  {
    name: 'Costoratta',
    liftType: 'chair_lift',
    status: 'no-summer',
    from: { lat:46.5201795, lng:11.8726721, label:'Valley/lower station' },
    to:   { lat:46.5255635, lng:11.8680693, label:'Mountain/upper station' },
    note: 'Not open in summer (confirmed via OSM tagging) — winter/ski-season only.',
  },
  {
    name: 'Piz Sella',
    liftType: 'cable_car',
    status: 'no-summer',
    from: { lat:46.5337008, lng:11.7719835, label:'Valley/lower station' },
    to:   { lat:46.5319948, lng:11.7510577, label:'Mountain/upper station' },
    note: 'Not open in summer (confirmed via OSM tagging) — winter/ski-season only.',
  },
  {
    name: 'Arabba Fly',
    liftType: 'chair_lift',
    status: 'no-summer',
    from: { lat:46.4943425, lng:11.8719757, label:'Valley/lower station' },
    to:   { lat:46.4978625, lng:11.8691679, label:'Mountain/upper station' },
    note: 'Not open in summer (confirmed via OSM tagging) — winter/ski-season only.',
  },
  {
    name: 'Portados',
    liftType: 'gondola',
    status: 'no-summer',
    from: { lat:46.4953857, lng:11.8734859, label:'Valley/lower station' },
    to:   { lat:46.4839019, lng:11.8675634, label:'Mountain/upper station' },
    note: 'Not open in summer (confirmed via OSM tagging) — winter/ski-season only.',
  },
  {
    name: 'Paolina',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4079533, lng:11.5918943, label:'Valley/lower station' },
    to:   { lat:46.4156768, lng:11.6144507, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pozza - Buffaure',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.4278218, lng:11.6983512, label:'Valley/lower station' },
    to:   { lat:46.4307002, lng:11.7226224, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Canazei - Pecol',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.4743643, lng:11.7747887, label:'Valley/lower station' },
    to:   { lat:46.4811695, lng:11.7881708, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sass Pordoi',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.4887325, lng:11.8105866, label:'Valley/lower station' },
    to:   { lat:46.5002831, lng:11.8077521, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seilbahn Sulden - Funivia Solda I',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.5159832, lng:10.5959424, label:'Valley/lower station' },
    to:   { lat:46.5033951, lng:10.5973197, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Piz Sorega',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.56755, lng:11.9377485, label:'Valley/lower station' },
    to:   { lat:46.5563319, lng:11.9227899, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'La Fraina',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5605223, lng:11.9143181, label:'Valley/lower station' },
    to:   { lat:46.5561985, lng:11.9215165, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'La Brancia',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5550253, lng:11.9144127, label:'Valley/lower station' },
    to:   { lat:46.5534416, lng:11.9067245, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Braia Fraida',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5536049, lng:11.8908178, label:'Valley/lower station' },
    to:   { lat:46.5521287, lng:11.9064965, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Arlara',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5443458, lng:11.8840648, label:'Valley/lower station' },
    to:   { lat:46.5490903, lng:11.8984764, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pralongià',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5359516, lng:11.8897021, label:'Valley/lower station' },
    to:   { lat:46.5350825, lng:11.9044209, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Gardenaccia',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.585478, lng:11.9023599, label:'Valley/lower station' },
    to:   { lat:46.5879243, lng:11.8865452, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Doninz',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5840171, lng:11.9028231, label:'Valley/lower station' },
    to:   { lat:46.5845886, lng:11.8998498, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Col Alto',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.547568, lng:11.8764292, label:'Valley/lower station' },
    to:   { lat:46.5528112, lng:11.8862775, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Costes da l\'Ega',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5472417, lng:11.8726776, label:'Valley/lower station' },
    to:   { lat:46.544611, lng:11.8789183, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Forcelles',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5623925, lng:11.8525985, label:'Valley/lower station' },
    to:   { lat:46.5589611, lng:11.8400636, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Stella Alpina',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5625662, lng:11.85244, label:'Valley/lower station' },
    to:   { lat:46.5680585, lng:11.8507022, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pradüc',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.6076178, lng:11.8973958, label:'Valley/lower station' },
    to:   { lat:46.5992543, lng:11.9004054, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sponata',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5990692, lng:11.9001305, label:'Valley/lower station' },
    to:   { lat:46.5887959, lng:11.8907313, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ciampai',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5555535, lng:11.9141596, label:'Valley/lower station' },
    to:   { lat:46.5528498, lng:11.9210854, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Biok',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5546574, lng:11.9149083, label:'Valley/lower station' },
    to:   { lat:46.5470345, lng:11.9099752, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Bamby (near 46.5614431°N, 11.9145573°E)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5614431, lng:11.9145573, label:'Valley/lower station' },
    to:   { lat:46.5647306, lng:11.9062765, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Piz la Ila',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5809501, lng:11.9010705, label:'Valley/lower station' },
    to:   { lat:46.56549, lng:11.9060748, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ratschings-Jaufen - Racines-Giovo',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.8640839, lng:11.3089874, label:'Valley/lower station' },
    to:   { lat:46.847818, lng:11.3049965, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Wasserfalleralm',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.8609481, lng:11.3018512, label:'Valley/lower station' },
    to:   { lat:46.8458877, lng:11.2955404, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Saxner',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.849972, lng:11.2949011, label:'Valley/lower station' },
    to:   { lat:46.8416038, lng:11.2844434, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Kalcher Alm - Malga Calice',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.8506822, lng:11.3214339, label:'Valley/lower station' },
    to:   { lat:46.8425435, lng:11.3219241, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Rinneralm - Malga Rinner',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.8489078, lng:11.3070745, label:'Valley/lower station' },
    to:   { lat:46.8403714, lng:11.3143833, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Enzian',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.8479164, lng:11.3032883, label:'Valley/lower station' },
    to:   { lat:46.8408147, lng:11.3018814, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Spinale Express',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.228409, lng:10.8294225, label:'Valley/lower station' },
    to:   { lat:46.2232375, lng:10.8477798, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Monte Baranci',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.7300759, lng:12.2779119, label:'Valley/lower station' },
    to:   { lat:46.7181149, lng:12.2787929, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Tognola',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2549718, lng:11.7988176, label:'Valley/lower station' },
    to:   { lat:46.2416303, lng:11.77744, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Rododendro',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2463904, lng:11.7734551, label:'Valley/lower station' },
    to:   { lat:46.2412806, lng:11.7771236, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Madritsch - Madriccio',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4910119, lng:10.5994855, label:'Valley/lower station' },
    to:   { lat:46.4941636, lng:10.6193021, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Schöntauf I - Beltovo I',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4970935, lng:10.6147196, label:'Valley/lower station' },
    to:   { lat:46.4988691, lng:10.625029, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Schöntauf II - Beltovo II',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4971613, lng:10.6138956, label:'Valley/lower station' },
    to:   { lat:46.5029121, lng:10.623435, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Piz Seteur 1',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5324554, lng:11.7711498, label:'Valley/lower station' },
    to:   { lat:46.5275612, lng:11.7602766, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Città dei Sassi',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5233692, lng:11.7646806, label:'Valley/lower station' },
    to:   { lat:46.5158433, lng:11.7524045, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pian Frataces - Gherdecia',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.490651, lng:11.7829415, label:'Valley/lower station' },
    to:   { lat:46.4822306, lng:11.8049547, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sass Becè',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4822893, lng:11.8014343, label:'Valley/lower station' },
    to:   { lat:46.4782726, lng:11.8122496, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Antercrëp',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4701025, lng:11.8983763, label:'Valley/lower station' },
    to:   { lat:46.4641491, lng:11.8937882, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Mesola',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.470904, lng:11.8981493, label:'Valley/lower station' },
    to:   { lat:46.4737733, lng:11.8865486, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sodlisia',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5499774, lng:11.8556576, label:'Valley/lower station' },
    to:   { lat:46.5502029, lng:11.8452193, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Plans',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5479929, lng:11.8431124, label:'Valley/lower station' },
    to:   { lat:46.5481905, lng:11.8275048, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Val Setus',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5523587, lng:11.8090882, label:'Valley/lower station' },
    to:   { lat:46.5542591, lng:11.8049199, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cir',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.550099, lng:11.8063771, label:'Valley/lower station' },
    to:   { lat:46.5542711, lng:11.8000327, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seiseralmbahn',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.540206, lng:11.5637402, label:'Valley/lower station' },
    to:   { lat:46.5423625, lng:11.6170037, label:'Mountain/upper station' },
    note: 'Real access point for the Alpe di Siusi Meadow Loop (Compatsch). Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sass de la Vegla',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4812406, lng:11.8793586, label:'Valley/lower station' },
    to:   { lat:46.4736013, lng:11.8857804, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Vellau - Leiteralm  -  Velloi - Malga Leiter',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.6955978, lng:11.1093502, label:'Valley/lower station' },
    to:   { lat:46.7047148, lng:11.1083724, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Unnamed lift #1',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.6284085, lng:11.1173015, label:'Valley/lower station' },
    to:   { lat:46.635932, lng:11.100893, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seilbahn Unterstell - Funivia Unterstell',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.650781, lng:10.9917593, label:'Valley/lower station' },
    to:   { lat:46.6583864, lng:10.9830746, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Umlaufbahn Falzeben - Cabinovia Falzeben',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.6660745, lng:11.2414921, label:'Valley/lower station' },
    to:   { lat:46.6772969, lng:11.255164, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Bergbahn Meran 2000 - Funivia Merano 2000',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.6710754, lng:11.2101086, label:'Valley/lower station' },
    to:   { lat:46.6777985, lng:11.2536943, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Mittager',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.686191, lng:11.2807635, label:'Valley/lower station' },
    to:   { lat:46.6826865, lng:11.2949302, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Mezzocorona - Monte',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.2185675, lng:11.1188571, label:'Valley/lower station' },
    to:   { lat:46.224024, lng:11.1232466, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fondovalle - Doss dei Laresi',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2831699, lng:11.4715753, label:'Valley/lower station' },
    to:   { lat:46.2649093, lng:11.4805063, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'La Residenza - Passo Feudo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.342882, lng:11.5502708, label:'Valley/lower station' },
    to:   { lat:46.346561, lng:11.5585303, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: '5 Laghi',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2303127, lng:10.8258606, label:'Valley/lower station' },
    to:   { lat:46.2262133, lng:10.8012265, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Doss dei Laresi - Cermis',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2649626, lng:11.4807328, label:'Valley/lower station' },
    to:   { lat:46.2510795, lng:11.5034071, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Costabella (near 46.3793795°N, 11.7852276°E)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3793795, lng:11.7852276, label:'Valley/lower station' },
    to:   { lat:46.3933559, lng:11.7813404, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Stalimen - Gardonè',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.3277214, lng:11.6020491, label:'Valley/lower station' },
    to:   { lat:46.3406851, lng:11.57819, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Gardonè - Passo Feudo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3394319, lng:11.5773545, label:'Valley/lower station' },
    to:   { lat:46.3468575, lng:11.5587418, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Lorenzi',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.7449983, lng:12.0097118, label:'Valley/lower station' },
    to:   { lat:46.7433615, lng:11.9901073, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sonne',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.7321443, lng:11.9615566, label:'Valley/lower station' },
    to:   { lat:46.7378958, lng:11.9585345, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Olang I',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.7466929, lng:12.0106459, label:'Valley/lower station' },
    to:   { lat:46.743553, lng:11.9726018, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Olang II',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.743553, lng:11.9726018, label:'Valley/lower station' },
    to:   { lat:46.7394211, lng:11.9598305, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Arndt',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.7442885, lng:11.9906918, label:'Valley/lower station' },
    to:   { lat:46.7430667, lng:11.9717283, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Rotwand - Croda Rossa',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.6813525, lng:12.36489, label:'Valley/lower station' },
    to:   { lat:46.6650857, lng:12.3730616, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ortisei - Furnes',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5764208, lng:11.6750721, label:'Valley/lower station' },
    to:   { lat:46.5896654, lng:11.7021929, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Panorama (near 46.5433867°N, 11.622568°E)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5433867, lng:11.622568, label:'Valley/lower station' },
    to:   { lat:46.5313827, lng:11.6253432, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seilbahn Aschbach - Funivia Riolagundo',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.6450256, lng:11.0753471, label:'Valley/lower station' },
    to:   { lat:46.6655279, lng:11.0692637, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pejo Fonti - Tarlenta',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.3560387, lng:10.6624695, label:'Valley/lower station' },
    to:   { lat:46.370036, lng:10.660173, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cortina - Colfiere - Col Drusciè',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5457596, lng:12.1314156, label:'Valley/lower station' },
    to:   { lat:46.543575, lng:12.1039815, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Lazaun',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.7555108, lng:10.7810692, label:'Valley/lower station' },
    to:   { lat:46.7526508, lng:10.7658175, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Hochmuth - Alta Muta',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.6962688, lng:11.1520118, label:'Valley/lower station' },
    to:   { lat:46.7023708, lng:11.1317377, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pradalago',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2339822, lng:10.8255668, label:'Valley/lower station' },
    to:   { lat:46.2472386, lng:10.8129909, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fortini Express',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2357891, lng:10.8363083, label:'Valley/lower station' },
    to:   { lat:46.2505319, lng:10.8132099, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Grostè 1 express',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2367332, lng:10.8361424, label:'Valley/lower station' },
    to:   { lat:46.2262519, lng:10.8761385, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pinzolo - Prà Rodont',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.1635157, lng:10.7657124, label:'Valley/lower station' },
    to:   { lat:46.1671395, lng:10.7859856, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Prà Rodont - Doss del Sabion',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.1674319, lng:10.7853747, label:'Valley/lower station' },
    to:   { lat:46.1673608, lng:10.8063032, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fossadei - Malga Cioca',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1690937, lng:10.7867805, label:'Valley/lower station' },
    to:   { lat:46.1705428, lng:10.7980778, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Aloch',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4289845, lng:11.6943957, label:'Valley/lower station' },
    to:   { lat:46.4207051, lng:11.6962561, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Bergbahn',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.8215312, lng:11.6653099, label:'Valley/lower station' },
    to:   { lat:46.8353965, lng:11.6698075, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ski Express',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.8352455, lng:11.6839386, label:'Valley/lower station' },
    to:   { lat:46.8514113, lng:11.6859736, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'K-Express',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.9936175, lng:11.9783054, label:'Valley/lower station' },
    to:   { lat:46.9849366, lng:11.9853442, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Reinswald',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.6881946, lng:11.420581, label:'Valley/lower station' },
    to:   { lat:46.6954214, lng:11.4407587, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Rindole - Dos de Leva',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1613512, lng:11.0084971, label:'Valley/lower station' },
    to:   { lat:46.1602003, lng:11.0099269, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Andalo - Doss Pelà',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.1635736, lng:11.0055995, label:'Valley/lower station' },
    to:   { lat:46.1455635, lng:11.021341, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'La Selletta - Cima Paganella',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1490143, lng:11.0375311, label:'Valley/lower station' },
    to:   { lat:46.1438977, lng:11.0376976, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Albi de Mez - Cima Paganella',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1478679, lng:11.023554, label:'Valley/lower station' },
    to:   { lat:46.1428054, lng:11.0369319, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Norei - 5 Dita',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5021167, lng:11.7576208, label:'Valley/lower station' },
    to:   { lat:46.5046146, lng:11.7448758, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sasso Levante',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5101552, lng:11.7571697, label:'Valley/lower station' },
    to:   { lat:46.5057463, lng:11.7438958, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Salei',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5015906, lng:11.7577874, label:'Valley/lower station' },
    to:   { lat:46.4969845, lng:11.7517136, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Rodella des Alpes',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5017075, lng:11.7527276, label:'Valley/lower station' },
    to:   { lat:46.4970327, lng:11.7515427, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Comici I',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5265662, lng:11.758775, label:'Valley/lower station' },
    to:   { lat:46.5284225, lng:11.747738, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Toè',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.4803636, lng:11.789586, label:'Valley/lower station' },
    to:   { lat:46.4773217, lng:11.8045741, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Kristiania',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4851935, lng:11.7955524, label:'Valley/lower station' },
    to:   { lat:46.4747126, lng:11.8021999, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Lezuo',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.4866125, lng:11.8251045, label:'Valley/lower station' },
    to:   { lat:46.4787617, lng:11.8131874, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Taser Seilbahn - Funivia Taser',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.6986438, lng:11.2023424, label:'Valley/lower station' },
    to:   { lat:46.7051173, lng:11.222133, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Roby',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5560081, lng:11.8998592, label:'Valley/lower station' },
    to:   { lat:46.553726, lng:11.9062975, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Kronplatz I - Plan de Corones I',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.7721228, lng:11.9420883, label:'Valley/lower station' },
    to:   { lat:46.7487968, lng:11.9525024, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Korer',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.7726959, lng:11.9398903, label:'Valley/lower station' },
    to:   { lat:46.7637607, lng:11.9431692, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Panorama (near 46.9827436°N, 11.9824765°E)',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.9827436, lng:11.9824765, label:'Valley/lower station' },
    to:   { lat:46.975494, lng:11.9764022, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Klaussee 2',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.9717787, lng:11.9895544, label:'Valley/lower station' },
    to:   { lat:46.9637171, lng:12.0063538, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Klaussee 1',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.9815718, lng:11.9839445, label:'Valley/lower station' },
    to:   { lat:46.9718718, lng:11.990427, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Speikboden - Monte Spico',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.9326402, lng:11.9374809, label:'Valley/lower station' },
    to:   { lat:46.9257182, lng:11.9037249, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seenock',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.926148, lng:11.9039802, label:'Valley/lower station' },
    to:   { lat:46.9227095, lng:11.8892565, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sonnklar',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.9225616, lng:11.9050831, label:'Valley/lower station' },
    to:   { lat:46.9154585, lng:11.9026753, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Kronplatz 2000',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.771945, lng:11.9410267, label:'Valley/lower station' },
    to:   { lat:46.7394451, lng:11.9572226, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Col de Valvacin',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4300618, lng:11.7242375, label:'Valley/lower station' },
    to:   { lat:46.4339447, lng:11.7355569, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Buffaure',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4317437, lng:11.7172455, label:'Valley/lower station' },
    to:   { lat:46.432226, lng:11.7241217, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ochsenweide',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.3829101, lng:11.5249358, label:'Valley/lower station' },
    to:   { lat:46.3725121, lng:11.5323796, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Obereggen - Oberholz',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3834723, lng:11.5269915, label:'Valley/lower station' },
    to:   { lat:46.3717113, lng:11.5428077, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Telemix Laner',
    liftType: 'mixed_lift',
    status: 'unknown',
    from: { lat:46.3675877, lng:11.5310552, label:'Valley/lower station' },
    to:   { lat:46.3719244, lng:11.5324572, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Absam - Maierl',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3667162, lng:11.5310008, label:'Valley/lower station' },
    to:   { lat:46.3635008, lng:11.5483189, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Obereggen',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3499416, lng:11.5418845, label:'Valley/lower station' },
    to:   { lat:46.35325, lng:11.5370111, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Latemar',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.3423766, lng:11.5408574, label:'Valley/lower station' },
    to:   { lat:46.3506542, lng:11.5475881, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Monte Agnello',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3419112, lng:11.5410551, label:'Valley/lower station' },
    to:   { lat:46.3336325, lng:11.5478242, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Tresca',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.341923, lng:11.5486774, label:'Valley/lower station' },
    to:   { lat:46.3309223, lng:11.5574585, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Plateau',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.7418226, lng:11.974913, label:'Valley/lower station' },
    to:   { lat:46.7392555, lng:11.9598406, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ruis',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.7247924, lng:11.9640979, label:'Valley/lower station' },
    to:   { lat:46.7375557, lng:11.9572882, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cisles',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5823872, lng:11.7510383, label:'Valley/lower station' },
    to:   { lat:46.5843446, lng:11.7469641, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Saslong',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5570223, lng:11.729402, label:'Valley/lower station' },
    to:   { lat:46.5433848, lng:11.7410487, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sochers - Ciampinoi',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5433119, lng:11.7418093, label:'Valley/lower station' },
    to:   { lat:46.538742, lng:11.7524215, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Hirzer - Punta Cervina (near 46.728647°N, 11.2005689°E)',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.728647, lng:11.2005689, label:'Valley/lower station' },
    to:   { lat:46.7341661, lng:11.2269253, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pralongià II',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5391374, lng:11.9021694, label:'Valley/lower station' },
    to:   { lat:46.5333932, lng:11.9138801, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Colz',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.581716, lng:11.9023271, label:'Valley/lower station' },
    to:   { lat:46.5832621, lng:11.9009487, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Prè dai Corf',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5561833, lng:11.8990412, label:'Valley/lower station' },
    to:   { lat:46.5622068, lng:11.9034829, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Gran Paradiso',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5248795, lng:11.7589696, label:'Valley/lower station' },
    to:   { lat:46.5174253, lng:11.7515468, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sotsaslong',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5261117, lng:11.7587969, label:'Valley/lower station' },
    to:   { lat:46.525113, lng:11.7464112, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fermeda',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5866413, lng:11.7400674, label:'Valley/lower station' },
    to:   { lat:46.6005397, lng:11.7272376, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Panciana',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.3019523, lng:10.8120985, label:'Valley/lower station' },
    to:   { lat:46.286022, lng:10.820865, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Doss della Pesa',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2896764, lng:10.8201861, label:'Valley/lower station' },
    to:   { lat:46.2800007, lng:10.8153149, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Roccolo Ventura',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2464821, lng:10.4728443, label:'Valley/lower station' },
    to:   { lat:46.2386304, lng:10.4895685, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Vigo - Catinaccio',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.4212663, lng:11.671198, label:'Valley/lower station' },
    to:   { lat:46.4333313, lng:11.6652704, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pian Peccei - Pramartin',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4388565, lng:11.662641, label:'Valley/lower station' },
    to:   { lat:46.4333194, lng:11.6551026, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Vajolet I',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.438335, lng:11.6936234, label:'Valley/lower station' },
    to:   { lat:46.442824, lng:11.6815682, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Vajolet II',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.443246, lng:11.6815117, label:'Valley/lower station' },
    to:   { lat:46.4386472, lng:11.6633219, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pian Peccei - Ciampedie',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4381562, lng:11.6634632, label:'Valley/lower station' },
    to:   { lat:46.4341579, lng:11.6641571, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Tschein',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4219845, lng:11.5868426, label:'Valley/lower station' },
    to:   { lat:46.4397616, lng:11.598378, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Rittner Seilbahn - Funivia del Renon',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5277845, lng:11.4050114, label:'Valley/lower station' },
    to:   { lat:46.4999729, lng:11.3642502, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivia del Colle - Kohlerer Seilbahn',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.4909409, lng:11.3685415, label:'Valley/lower station' },
    to:   { lat:46.4783737, lng:11.3690585, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Gipfelbahn',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.7542589, lng:11.9587753, label:'Valley/lower station' },
    to:   { lat:46.7393873, lng:11.9580116, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Corno Bianco',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3485258, lng:11.4531007, label:'Valley/lower station' },
    to:   { lat:46.3523938, lng:11.4480021, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Kalditsch - Doladizza',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3426118, lng:11.4366987, label:'Valley/lower station' },
    to:   { lat:46.3383262, lng:11.4506109, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Costa - Moreta',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9180297, lng:11.1943825, label:'Valley/lower station' },
    to:   { lat:45.9096547, lng:11.2032445, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Malga Ortesino - Sommo Alto',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9005147, lng:11.2065293, label:'Valley/lower station' },
    to:   { lat:45.8939233, lng:11.1995053, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fondo Grande - Sommo Alto',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8922706, lng:11.1913842, label:'Valley/lower station' },
    to:   { lat:45.8869301, lng:11.2003765, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fondo Grande - Dosso Martinella',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.893074, lng:11.1875766, label:'Valley/lower station' },
    to:   { lat:45.8873065, lng:11.1790667, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pré da Peres',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.7228182, lng:11.9651741, label:'Valley/lower station' },
    to:   { lat:46.7161724, lng:11.9708035, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Skitrans Bronta',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.7045664, lng:11.9297466, label:'Valley/lower station' },
    to:   { lat:46.7012532, lng:11.9272554, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pedagà',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.7005337, lng:11.9280078, label:'Valley/lower station' },
    to:   { lat:46.6965977, lng:11.9214618, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Piz de Plaies',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.6965977, lng:11.9214618, label:'Valley/lower station' },
    to:   { lat:46.697705, lng:11.9120676, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Piculin',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.6923554, lng:11.8928248, label:'Valley/lower station' },
    to:   { lat:46.6979826, lng:11.91137, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Miara',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.7044547, lng:11.930465, label:'Valley/lower station' },
    to:   { lat:46.7109921, lng:11.9511505, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Col Toron',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.7111024, lng:11.9505889, label:'Valley/lower station' },
    to:   { lat:46.7194142, lng:11.9637609, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Costa',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.7229927, lng:11.9633065, label:'Valley/lower station' },
    to:   { lat:46.7268538, lng:11.968738, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Marchner',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.7336593, lng:11.9945186, label:'Valley/lower station' },
    to:   { lat:46.7365288, lng:11.9732833, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Santa Cristina - Monte Pana',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5565518, lng:11.7233567, label:'Valley/lower station' },
    to:   { lat:46.5518005, lng:11.7154831, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Hubertus',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.4075583, lng:11.5924505, label:'Valley/lower station' },
    to:   { lat:46.4031684, lng:11.6071038, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pra di Tori',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4036524, lng:11.6088204, label:'Valley/lower station' },
    to:   { lat:46.3956472, lng:11.6008289, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Falzarego',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5193227, lng:12.0183395, label:'Valley/lower station' },
    to:   { lat:46.5153472, lng:12.0168715, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Val',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5618513, lng:11.7707604, label:'Valley/lower station' },
    to:   { lat:46.5573626, lng:11.7773953, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pecol - Col dei Rossi',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.4809336, lng:11.7884271, label:'Valley/lower station' },
    to:   { lat:46.4746898, lng:11.801763, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Croda Negra',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4977747, lng:12.0323044, label:'Valley/lower station' },
    to:   { lat:46.5012397, lng:12.0312314, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Rittnerhornbahn - Funivia del Corno del Renon',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.576621, lng:11.4458771, label:'Valley/lower station' },
    to:   { lat:46.5957762, lng:11.4525162, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Bormio - Bormio 2000',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.4621355, lng:10.3724437, label:'Valley/lower station' },
    to:   { lat:46.4442457, lng:10.3882156, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Bormio 2000 - Cimino',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4442603, lng:10.3888941, label:'Valley/lower station' },
    to:   { lat:46.4332652, lng:10.4054743, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Maseben',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.8376624, lng:10.6424776, label:'Valley/lower station' },
    to:   { lat:46.8298204, lng:10.6497994, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Bormio 2000 - Cima Bianca',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.4439667, lng:10.3883928, label:'Valley/lower station' },
    to:   { lat:46.420502, lng:10.4110233, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Valbella - Bormio 3000',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4358845, lng:10.4052974, label:'Valley/lower station' },
    to:   { lat:46.420664, lng:10.4112862, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ciuk - Laghetti',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4536353, lng:10.3877178, label:'Valley/lower station' },
    to:   { lat:46.4464108, lng:10.3917261, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Belvedere (near 46.4821699°N, 11.8013078°E)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4821699, lng:11.8013078, label:'Valley/lower station' },
    to:   { lat:46.4784021, lng:11.8071104, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fungeia',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5466864, lng:11.7668908, label:'Valley/lower station' },
    to:   { lat:46.5471037, lng:11.7652328, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Bleis',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2638124, lng:10.5682326, label:'Valley/lower station' },
    to:   { lat:46.2774071, lng:10.5584608, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ghiacciaio Presena (near 46.2281115°N, 10.5803598°E)',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2281115, lng:10.5803598, label:'Valley/lower station' },
    to:   { lat:46.2200952, lng:10.5852875, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Bus Tofana',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5549886, lng:12.0835438, label:'Valley/lower station' },
    to:   { lat:46.5484026, lng:12.071469, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Duca d\'Aosta - Forcella Pomedes',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5375213, lng:12.0845174, label:'Valley/lower station' },
    to:   { lat:46.5364023, lng:12.076122, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Roncato - Festis (Tofana Express)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5340747, lng:12.1085623, label:'Valley/lower station' },
    to:   { lat:46.5383077, lng:12.0940008, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Breiteben',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5458204, lng:10.9411322, label:'Valley/lower station' },
    to:   { lat:46.5419977, lng:10.9318469, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Mutegg - Monte Muta',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5302204, lng:10.9171202, label:'Valley/lower station' },
    to:   { lat:46.5407463, lng:10.9045778, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Schwemmalmbahn - Cabinovia Malga Guazza',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5281335, lng:10.9554917, label:'Valley/lower station' },
    to:   { lat:46.5345963, lng:10.9215118, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Unnamed lift #2',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.4826496, lng:10.7998855, label:'Valley/lower station' },
    to:   { lat:46.4834985, lng:10.8268743, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivia Alperia Greenpower Srl GmbH (ex ENEL): Alpe di Riposo - Diga del lago di Quaira della miniera',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.5536398, lng:10.9222558, label:'Valley/lower station' },
    to:   { lat:46.5520001, lng:10.8940683, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seggiovia Monte Roen - Campi da Golf/Mezzavia',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4038991, lng:11.2066468, label:'Valley/lower station' },
    to:   { lat:46.3919373, lng:11.2086841, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'St. Oswald - S. Osvaldo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.6809378, lng:11.2760243, label:'Valley/lower station' },
    to:   { lat:46.6929204, lng:11.2722128, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Bergbahn Schöneben - Cabinovia Belpiano',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.8217017, lng:10.5088441, label:'Valley/lower station' },
    to:   { lat:46.804973, lng:10.4917198, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Jochbahn - Cabinovia Jochbahn',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.8072496, lng:10.4947085, label:'Valley/lower station' },
    to:   { lat:46.795474, lng:10.4930742, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fraiten',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.8041984, lng:10.4878705, label:'Valley/lower station' },
    to:   { lat:46.7954745, lng:10.4917812, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Rojensesselbahn - Seggiovia Rojen',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.8011847, lng:10.4763808, label:'Valley/lower station' },
    to:   { lat:46.7940117, lng:10.4898501, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Zwölferkopfbahn – Seggiovia Zwölferkopf',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.800984, lng:10.4762127, label:'Valley/lower station' },
    to:   { lat:46.791494, lng:10.4799479, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Mont Sëuc',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5728649, lng:11.6712802, label:'Valley/lower station' },
    to:   { lat:46.5580492, lng:11.6647087, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Mezdì',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5512079, lng:11.6631223, label:'Valley/lower station' },
    to:   { lat:46.5584824, lng:11.6577449, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Florian',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5308945, lng:11.6714346, label:'Valley/lower station' },
    to:   { lat:46.5155546, lng:11.6845837, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Unnamed lift #3',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.563349, lng:11.2247617, label:'Valley/lower station' },
    to:   { lat:46.5699009, lng:11.2369383, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Meran–Dorf Tirol / Merano–Tirolo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.6727296, lng:11.1623955, label:'Valley/lower station' },
    to:   { lat:46.6760555, lng:11.1642968, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'St. Martin - San Martino al Monte',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.6210918, lng:10.8663314, label:'Valley/lower station' },
    to:   { lat:46.6383588, lng:10.8543902, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Tarscher Alm Sessellift - Seggiovia Malga di Tarres',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5939129, lng:10.8924221, label:'Valley/lower station' },
    to:   { lat:46.5816356, lng:10.8886252, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivie Molveno Pradel',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.1446175, lng:10.9649316, label:'Valley/lower station' },
    to:   { lat:46.1515166, lng:10.9607757, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pradel - Palon di Tovre',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.152363, lng:10.9617729, label:'Valley/lower station' },
    to:   { lat:46.1562484, lng:10.9552217, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Doss dei Cembri',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.370611, lng:10.6640093, label:'Valley/lower station' },
    to:   { lat:46.3802143, lng:10.6593614, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seilbahn Verdins - Tall',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.7171178, lng:11.2085075, label:'Valley/lower station' },
    to:   { lat:46.7274472, lng:11.2273214, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Malghette',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2641996, lng:10.8305223, label:'Valley/lower station' },
    to:   { lat:46.2746903, lng:10.8273718, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Meriz - La Selletta',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1647343, lng:11.0505313, label:'Valley/lower station' },
    to:   { lat:46.1500628, lng:11.0378156, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Meriz',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1633608, lng:11.0504143, label:'Valley/lower station' },
    to:   { lat:46.1587737, lng:11.050304, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Santel - Meriz',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1753275, lng:11.0526073, label:'Valley/lower station' },
    to:   { lat:46.1638942, lng:11.0494965, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Teleferica Enel',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.2191954, lng:10.4780992, label:'Valley/lower station' },
    to:   { lat:46.2021745, lng:10.4736126, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Teola Pianoni Bassi (1)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.528862, lng:10.1380449, label:'Valley/lower station' },
    to:   { lat:46.522223, lng:10.1500824, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Trepalle (8)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5288236, lng:10.1731579, label:'Valley/lower station' },
    to:   { lat:46.5247816, lng:10.1613818, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Valfin Monte della Neve (4)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5224341, lng:10.1455505, label:'Valley/lower station' },
    to:   { lat:46.5103537, lng:10.1518124, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Monte Sponda (5)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5300829, lng:10.151349, label:'Valley/lower station' },
    to:   { lat:46.5171087, lng:10.1596725, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Algund-Vellau - Lagundo-Velloi',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.6865417, lng:11.114382, label:'Valley/lower station' },
    to:   { lat:46.6953344, lng:11.1089385, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivia Piani d\'Erna',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:45.8632353, lng:9.4286323, label:'Valley/lower station' },
    to:   { lat:45.8646641, lng:9.447429, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Federia (14)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5120235, lng:10.0728118, label:'Valley/lower station' },
    to:   { lat:46.511506, lng:10.0870303, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Blesaccia I (15)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5204846, lng:10.1117569, label:'Valley/lower station' },
    to:   { lat:46.520873, lng:10.0952407, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Alta Vista (16)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5231173, lng:10.1065561, label:'Valley/lower station' },
    to:   { lat:46.5264444, lng:10.090665, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Valandrea - Vetta (28)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5430417, lng:10.1163381, label:'Valley/lower station' },
    to:   { lat:46.5371793, lng:10.0990888, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fontane Vetta (19)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5343605, lng:10.1089755, label:'Valley/lower station' },
    to:   { lat:46.5298517, lng:10.0939801, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Livigno-Tagliede (25)',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5434309, lng:10.1366018, label:'Valley/lower station' },
    to:   { lat:46.5457945, lng:10.1287858, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Prämajur-Höferalm',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.7038583, lng:10.5086043, label:'Valley/lower station' },
    to:   { lat:46.7076794, lng:10.4931043, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivia Prada Costabella (near 45.673308°N, 10.7824959°E)',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:45.673308, lng:10.7824959, label:'Valley/lower station' },
    to:   { lat:45.676875, lng:10.8065763, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivia Prada Costabella (near 45.6768097°N, 10.8067542°E)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.6768097, lng:10.8067542, label:'Valley/lower station' },
    to:   { lat:45.6801136, lng:10.8169848, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Padeon',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5668976, lng:12.1760226, label:'Valley/lower station' },
    to:   { lat:46.5675533, lng:12.1860303, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'San Marco',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4654744, lng:12.2240417, label:'Valley/lower station' },
    to:   { lat:46.4717071, lng:12.2362118, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cabinovia Colverde',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2641261, lng:11.8052124, label:'Valley/lower station' },
    to:   { lat:46.2719358, lng:11.8212851, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivia Rosetta',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.2718846, lng:11.8218796, label:'Valley/lower station' },
    to:   { lat:46.2648189, lng:11.8329385, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivie del Lago Maggiore',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:45.9122296, lng:8.6209233, label:'Valley/lower station' },
    to:   { lat:45.9110482, lng:8.6369702, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Folgarida',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.3033098, lng:10.858904, label:'Valley/lower station' },
    to:   { lat:46.2906484, lng:10.8512062, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Taiarezze - Malón',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.558785, lng:12.4193025, label:'Valley/lower station' },
    to:   { lat:46.5547967, lng:12.402325, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Malón - Monte Agudo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5541894, lng:12.4012126, label:'Valley/lower station' },
    to:   { lat:46.5464046, lng:12.4051098, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Zur Sonne - Al Sole',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5538407, lng:11.6632756, label:'Valley/lower station' },
    to:   { lat:46.5577136, lng:11.6636386, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Malga',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0569841, lng:11.3136392, label:'Valley/lower station' },
    to:   { lat:46.0486926, lng:11.3193479, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Jochtalbahn',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.850557, lng:11.6210469, label:'Valley/lower station' },
    to:   { lat:46.8439548, lng:11.6009134, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Langenstein - Orso',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5260753, lng:10.5855934, label:'Valley/lower station' },
    to:   { lat:46.5192695, lng:10.5767705, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Monte Piz',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5470226, lng:11.6359052, label:'Valley/lower station' },
    to:   { lat:46.5482878, lng:11.6485354, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Steger Dellai',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5464188, lng:11.6354079, label:'Valley/lower station' },
    to:   { lat:46.5372048, lng:11.6368976, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Bamby (near 46.5310844°N, 11.6375972°E)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5310844, lng:11.6375972, label:'Valley/lower station' },
    to:   { lat:46.533903, lng:11.6348113, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Floralpina',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5303648, lng:11.6692561, label:'Valley/lower station' },
    to:   { lat:46.5264119, lng:11.6497495, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Goldknopf',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5257897, lng:11.6540156, label:'Valley/lower station' },
    to:   { lat:46.5145123, lng:11.6375611, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sanon',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5470582, lng:11.6564643, label:'Valley/lower station' },
    to:   { lat:46.5484092, lng:11.6491629, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Leo Demetz',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5501083, lng:11.648933, label:'Valley/lower station' },
    to:   { lat:46.5552364, lng:11.6477547, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sochers',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5428021, lng:11.7391754, label:'Valley/lower station' },
    to:   { lat:46.5377768, lng:11.7425895, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Palabione',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.1516944, lng:10.1541425, label:'Valley/lower station' },
    to:   { lat:46.1395551, lng:10.158872, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'La Rüa',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5817146, lng:11.9054154, label:'Valley/lower station' },
    to:   { lat:46.5816122, lng:11.9027681, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Col Raiser',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5650691, lng:11.7366984, label:'Valley/lower station' },
    to:   { lat:46.5847839, lng:11.7453183, label:'Mountain/upper station' },
    note: 'Alternate access point for the Seceda area. Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Mastellina',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2877115, lng:10.83268, label:'Valley/lower station' },
    to:   { lat:46.2798213, lng:10.8318568, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Bamby (near 46.2900212°N, 10.8515576°E)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2900212, lng:10.8515576, label:'Valley/lower station' },
    to:   { lat:46.2886761, lng:10.8472961, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Vigo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2788192, lng:10.8377162, label:'Valley/lower station' },
    to:   { lat:46.2755425, lng:10.8277465, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Orso Bruno',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2870475, lng:10.8193466, label:'Valley/lower station' },
    to:   { lat:46.2751667, lng:10.8269501, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Spolverino',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2899324, lng:10.851646, label:'Valley/lower station' },
    to:   { lat:46.2855707, lng:10.837608, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Bassetta',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2798575, lng:10.8374626, label:'Valley/lower station' },
    to:   { lat:46.2848839, lng:10.837216, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Grostè',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2189043, lng:10.8885843, label:'Valley/lower station' },
    to:   { lat:46.2111328, lng:10.9021054, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Genziana Express',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2641745, lng:10.8299471, label:'Valley/lower station' },
    to:   { lat:46.2564049, lng:10.8135108, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Piani di Pezzè',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.4052397, lng:12.0232345, label:'Valley/lower station' },
    to:   { lat:46.4129847, lng:12.0408026, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Col dei Baldi',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.4114358, lng:12.0437643, label:'Valley/lower station' },
    to:   { lat:46.4152457, lng:12.0686785, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pelmo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4172109, lng:12.0607472, label:'Valley/lower station' },
    to:   { lat:46.4156301, lng:12.0686743, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Col Fioret',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4173799, lng:12.060376, label:'Valley/lower station' },
    to:   { lat:46.4232682, lng:12.0502219, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seggiovia Fertazza',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4300145, lng:12.0510485, label:'Valley/lower station' },
    to:   { lat:46.423776, lng:12.0454653, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seggiovia Pescul - Fertazza',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4361885, lng:12.0697286, label:'Valley/lower station' },
    to:   { lat:46.4291368, lng:12.0520306, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pioda',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4027439, lng:12.0999353, label:'Valley/lower station' },
    to:   { lat:46.4065173, lng:12.0855917, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ladurns',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.9511417, lng:11.3880478, label:'Valley/lower station' },
    to:   { lat:46.9405915, lng:11.3744608, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Wastenegg',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.9471994, lng:11.3753744, label:'Valley/lower station' },
    to:   { lat:46.935939, lng:11.3658148, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivia Trento Sardagna',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.0660013, lng:11.102769, label:'Valley/lower station' },
    to:   { lat:46.0695707, lng:11.1156186, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sole',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5228909, lng:11.7688355, label:'Valley/lower station' },
    to:   { lat:46.5256835, lng:11.7627921, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Carbonera - Malga Polzone',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:45.9766124, lng:10.0738398, label:'Valley/lower station' },
    to:   { lat:45.9808099, lng:10.0549877, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Nube d\'Argento',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2410405, lng:10.8431835, label:'Valley/lower station' },
    to:   { lat:46.2334042, lng:10.8454092, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Vitelli',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5352891, lng:12.1791958, label:'Valley/lower station' },
    to:   { lat:46.527697, lng:12.1836421, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sghirlat',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2864658, lng:10.8222017, label:'Valley/lower station' },
    to:   { lat:46.2825862, lng:10.8250601, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Belvedere (near 46.736579°N, 11.9729532°E)',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.736579, lng:11.9729532, label:'Valley/lower station' },
    to:   { lat:46.7383882, lng:11.9592804, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Patascoss',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2297486, lng:10.8186206, label:'Valley/lower station' },
    to:   { lat:46.2289293, lng:10.7963122, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Miramonti',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2326153, lng:10.8241337, label:'Valley/lower station' },
    to:   { lat:46.2320731, lng:10.8189345, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Zeledria',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2512038, lng:10.8259066, label:'Valley/lower station' },
    to:   { lat:46.2508222, lng:10.814546, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Rododendro express',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2287969, lng:10.8657471, label:'Valley/lower station' },
    to:   { lat:46.2170658, lng:10.8899182, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Boch',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2251222, lng:10.8622894, label:'Valley/lower station' },
    to:   { lat:46.2241327, lng:10.8536513, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Nube d\'Oro',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2351568, lng:10.8474787, label:'Valley/lower station' },
    to:   { lat:46.2232158, lng:10.8482863, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fondo Piccolo - Cargaore',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8806514, lng:11.2008672, label:'Valley/lower station' },
    to:   { lat:45.8758523, lng:11.2053529, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fondo Piccolo - Cengio Rosso',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8779372, lng:11.2040292, label:'Valley/lower station' },
    to:   { lat:45.8744012, lng:11.2080336, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Rara',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.7214991, lng:11.9595843, label:'Valley/lower station' },
    to:   { lat:46.7189067, lng:11.9660822, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cianross',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.69769, lng:11.9283439, label:'Valley/lower station' },
    to:   { lat:46.6964964, lng:11.9247375, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Kanzel - Pulpito',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.524582, lng:10.5896154, label:'Valley/lower station' },
    to:   { lat:46.523073, lng:10.6074566, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seggiovia Pian del Poggio - Monte Chiappo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:44.6901486, lng:9.2132771, label:'Valley/lower station' },
    to:   { lat:44.6866512, lng:9.201574, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Furnes - Seceda',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.589805, lng:11.7023249, label:'Valley/lower station' },
    to:   { lat:46.597936, lng:11.7243474, label:'Mountain/upper station' },
    note: 'Real access point for the Seceda Ridge Trail. Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Rifugio Cai',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.6886875, lng:11.7342926, label:'Valley/lower station' },
    to:   { lat:46.6948886, lng:11.7334963, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Schönbodenbahn',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.6839795, lng:11.709442, label:'Valley/lower station' },
    to:   { lat:46.6906456, lng:11.7258912, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pfannspitz - Monte Fana',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.6776765, lng:11.7379103, label:'Valley/lower station' },
    to:   { lat:46.6912818, lng:11.7466612, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cavazes - Grohmann',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5042373, lng:11.7537862, label:'Valley/lower station' },
    to:   { lat:46.5052938, lng:11.7471975, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Delle Coste',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3926312, lng:12.0945439, label:'Valley/lower station' },
    to:   { lat:46.4002977, lng:12.0935372, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Col de la Grava',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3824739, lng:12.0852925, label:'Valley/lower station' },
    to:   { lat:46.3693665, lng:12.0924043, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pian del Crep',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.3909429, lng:12.0999755, label:'Valley/lower station' },
    to:   { lat:46.3814965, lng:12.0943889, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Valgranda',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3767182, lng:12.098878, label:'Valley/lower station' },
    to:   { lat:46.3688692, lng:12.0946595, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cristelin',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3823314, lng:12.1014408, label:'Valley/lower station' },
    to:   { lat:46.3807553, lng:12.0942707, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Puflatsch - Bullaccia',
    liftType: 'mixed_lift',
    status: 'unknown',
    from: { lat:46.5448386, lng:11.6240374, label:'Valley/lower station' },
    to:   { lat:46.5518419, lng:11.6171812, label:'Mountain/upper station' },
    note: 'Real access point for the Bullaccia/Puflatsch loop (trail 14) candidate. Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Spitzbühl',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.537747, lng:11.6053326, label:'Valley/lower station' },
    to:   { lat:46.5292083, lng:11.6008161, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Laurin',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5375413, lng:11.6086377, label:'Valley/lower station' },
    to:   { lat:46.5273874, lng:11.6204225, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Paradiso (near 46.5302974°N, 11.6383159°E)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5302974, lng:11.6383159, label:'Valley/lower station' },
    to:   { lat:46.519042, lng:11.6381611, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Orsa Maggiore',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4393066, lng:11.7350374, label:'Valley/lower station' },
    to:   { lat:46.4374804, lng:11.7592582, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pala del Gheiger',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4398319, lng:11.7339922, label:'Valley/lower station' },
    to:   { lat:46.4339198, lng:11.7332429, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Alba – Ciampac',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.4579431, lng:11.7886914, label:'Valley/lower station' },
    to:   { lat:46.4465999, lng:11.772194, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sella Brunech',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4452745, lng:11.7722627, label:'Valley/lower station' },
    to:   { lat:46.4389112, lng:11.7632107, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cacciatori',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5487421, lng:12.0832898, label:'Valley/lower station' },
    to:   { lat:46.5444374, lng:12.0785306, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Olympia',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5280352, lng:12.1126044, label:'Valley/lower station' },
    to:   { lat:46.5238867, lng:12.0976833, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Saletei (Maria)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4867283, lng:11.8237781, label:'Valley/lower station' },
    to:   { lat:46.4877845, lng:11.8146637, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Baby Lac Salin (13)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5140174, lng:10.0873953, label:'Valley/lower station' },
    to:   { lat:46.5161948, lng:10.08676, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Tagliede - Costaccia (27)',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5457945, lng:10.1287858, label:'Valley/lower station' },
    to:   { lat:46.5430491, lng:10.1175666, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Palmschoß - Plancios',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.6758882, lng:11.7129085, label:'Valley/lower station' },
    to:   { lat:46.684198, lng:11.7119088, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Almboden',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.9825346, lng:11.9828131, label:'Valley/lower station' },
    to:   { lat:46.9770471, lng:11.9850321, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Alm-Express',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.9282945, lng:11.9074879, label:'Valley/lower station' },
    to:   { lat:46.9227298, lng:11.9042892, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fondo Piccolo - Trugalait',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8812068, lng:11.1984216, label:'Valley/lower station' },
    to:   { lat:45.8774892, lng:11.2003034, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fondo Piccolo - Cima Spill',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8821809, lng:11.1955602, label:'Valley/lower station' },
    to:   { lat:45.8780231, lng:11.1939169, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Belvedere (near 46.2988473°N, 10.8669212°E)',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2988473, lng:10.8669212, label:'Valley/lower station' },
    to:   { lat:46.2906726, lng:10.8516932, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Brenzi',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2874362, lng:10.8465721, label:'Valley/lower station' },
    to:   { lat:46.2853391, lng:10.8377514, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pichler',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.9504305, lng:12.0663895, label:'Valley/lower station' },
    to:   { lat:46.9546763, lng:12.0596619, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivia Argegno-Pigra',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:45.9465844, lng:9.1299914, label:'Valley/lower station' },
    to:   { lat:45.9547439, lng:9.1289429, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pala di Santa',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3497807, lng:11.5418594, label:'Valley/lower station' },
    to:   { lat:46.3473067, lng:11.5274501, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Campo Scuola Latemar',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3468803, lng:11.5450905, label:'Valley/lower station' },
    to:   { lat:46.3493532, lng:11.5482549, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Colonia Vigili - Tonale',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2520706, lng:10.5444137, label:'Valley/lower station' },
    to:   { lat:46.2594519, lng:10.5734637, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sozzine',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.248783, lng:10.5272229, label:'Valley/lower station' },
    to:   { lat:46.2470341, lng:10.5145933, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Valbiolo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2630828, lng:10.5906671, label:'Valley/lower station' },
    to:   { lat:46.2809371, lng:10.5811675, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cadì Sit',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2582883, lng:10.5769412, label:'Valley/lower station' },
    to:   { lat:46.2642237, lng:10.5742672, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Serodine',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2581803, lng:10.5767844, label:'Valley/lower station' },
    to:   { lat:46.2686858, lng:10.5708845, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Scoiattolo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2584596, lng:10.5787233, label:'Valley/lower station' },
    to:   { lat:46.2613216, lng:10.5775071, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Vittoria',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2592764, lng:10.5817798, label:'Valley/lower station' },
    to:   { lat:46.2655083, lng:10.5782071, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Alpe Alta',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2596789, lng:10.5828326, label:'Valley/lower station' },
    to:   { lat:46.2708095, lng:10.5781208, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Valena',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2599552, lng:10.5832322, label:'Valley/lower station' },
    to:   { lat:46.2662447, lng:10.583473, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Nigritella',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2575641, lng:10.5648024, label:'Valley/lower station' },
    to:   { lat:46.2635958, lng:10.5677817, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seggiovia Malga Valbiolo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.280018, lng:10.5809522, label:'Valley/lower station' },
    to:   { lat:46.2790745, lng:10.5701602, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seggiovia Passo Contrabbandieri',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2811055, lng:10.5828441, label:'Valley/lower station' },
    to:   { lat:46.2916439, lng:10.574492, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Valbione',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2544654, lng:10.5090071, label:'Valley/lower station' },
    to:   { lat:46.2487294, lng:10.5063533, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Doss delle Pertiche',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2427245, lng:10.4936725, label:'Valley/lower station' },
    to:   { lat:46.239388, lng:10.5035443, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Santa Giulia',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2427489, lng:10.4928717, label:'Valley/lower station' },
    to:   { lat:46.234859, lng:10.4966458, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'La Croce',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.243756, lng:10.4836867, label:'Valley/lower station' },
    to:   { lat:46.2351067, lng:10.4960049, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Corno d\'Aola',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2483301, lng:10.5073786, label:'Valley/lower station' },
    to:   { lat:46.2415613, lng:10.5192283, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Casola',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2489927, lng:10.5058842, label:'Valley/lower station' },
    to:   { lat:46.239887, lng:10.503531, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ponte di Legno - Colonia Vigili',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2545503, lng:10.5111151, label:'Valley/lower station' },
    to:   { lat:46.2520706, lng:10.5444137, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ghiacciaio Presena (near 46.2383671°N, 10.5809786°E)',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2383671, lng:10.5809786, label:'Valley/lower station' },
    to:   { lat:46.2281115, lng:10.5803598, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Paradiso (near 46.256842°N, 10.5717326°E)',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.256842, lng:10.5717326, label:'Valley/lower station' },
    to:   { lat:46.2390552, lng:10.5803812, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Euro',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5446499, lng:11.623006, label:'Valley/lower station' },
    to:   { lat:46.5446825, lng:11.6141116, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Catores',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5938421, lng:11.7277739, label:'Valley/lower station' },
    to:   { lat:46.5992796, lng:11.7252856, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fortino',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9598623, lng:9.489905, label:'Valley/lower station' },
    to:   { lat:45.9610178, lng:9.5015295, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Camosci',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9596376, lng:9.4946088, label:'Valley/lower station' },
    to:   { lat:45.9568848, lng:9.5072596, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Chiavello',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9767575, lng:9.5099802, label:'Valley/lower station' },
    to:   { lat:45.9690602, lng:9.4973957, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ronchi - IV Baita',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0425459, lng:9.7578323, label:'Valley/lower station' },
    to:   { lat:46.0453609, lng:9.7720125, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'IV Baita - Montebello',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0456105, lng:9.7724481, label:'Valley/lower station' },
    to:   { lat:46.045862, lng:9.7819595, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Karjoch Express',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.7918018, lng:11.0989719, label:'Valley/lower station' },
    to:   { lat:46.7797297, lng:11.1055714, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Grünbodenexpress',
    liftType: 'mixed_lift',
    status: 'unknown',
    from: { lat:46.7969942, lng:11.0918862, label:'Valley/lower station' },
    to:   { lat:46.7912435, lng:11.1002504, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Mittelstation',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.7235384, lng:12.3476918, label:'Valley/lower station' },
    to:   { lat:46.7167322, lng:12.3612231, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Übungslift',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.7196063, lng:12.3559339, label:'Valley/lower station' },
    to:   { lat:46.7168299, lng:12.3613763, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Vierschach-Helm - Versciaco-Monte Elmo',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.7316366, lng:12.3297751, label:'Valley/lower station' },
    to:   { lat:46.7172749, lng:12.3620148, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Signaue',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.6800373, lng:12.3813862, label:'Valley/lower station' },
    to:   { lat:46.6699873, lng:12.3743367, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Hasenköpfl',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.7200034, lng:12.3564471, label:'Valley/lower station' },
    to:   { lat:46.7165751, lng:12.3744488, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Colbricon Express',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2640884, lng:11.7892612, label:'Valley/lower station' },
    to:   { lat:46.2737159, lng:11.7677983, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Coston (near 46.2618809°N, 11.7608704°E)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2618809, lng:11.7608704, label:'Valley/lower station' },
    to:   { lat:46.2640207, lng:11.7674064, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Valcigolera',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2615323, lng:11.7605817, label:'Valley/lower station' },
    to:   { lat:46.2513028, lng:11.7545446, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Punta Ces',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2682149, lng:11.7786401, label:'Valley/lower station' },
    to:   { lat:46.2679061, lng:11.7595898, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Castellazzo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3013765, lng:11.7865974, label:'Valley/lower station' },
    to:   { lat:46.302047, lng:11.7989917, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Paradiso (near 46.2931027°N, 11.7782785°E)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2931027, lng:11.7782785, label:'Valley/lower station' },
    to:   { lat:46.2874649, lng:11.7851015, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivia Margno-Pian delle Betulle',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.0314116, lng:9.383169, label:'Valley/lower station' },
    to:   { lat:46.0284348, lng:9.3994512, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Gremei 1',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9966315, lng:9.705477, label:'Valley/lower station' },
    to:   { lat:45.9891634, lng:9.714194, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Gremei 2',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9888888, lng:9.7142189, label:'Valley/lower station' },
    to:   { lat:45.9848949, lng:9.7195266, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Stock',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.9111504, lng:11.4101618, label:'Valley/lower station' },
    to:   { lat:46.9178021, lng:11.3955763, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: '6CLD/8MGD Panorama',
    liftType: 'mixed_lift',
    status: 'unknown',
    from: { lat:46.9136495, lng:11.397765, label:'Valley/lower station' },
    to:   { lat:46.9149725, lng:11.3873824, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Mottolino Gondola (3)',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5377584, lng:10.14258, label:'Valley/lower station' },
    to:   { lat:46.5280739, lng:10.1627255, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Texelbahn',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.6794213, lng:11.0640606, label:'Valley/lower station' },
    to:   { lat:46.6846163, lng:11.0475364, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Kesselberg - Costa Valcanova',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.6864973, lng:11.2807726, label:'Valley/lower station' },
    to:   { lat:46.691057, lng:11.302934, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Albino - Selvino',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:45.7688486, lng:9.7845174, label:'Valley/lower station' },
    to:   { lat:45.7862319, lng:9.7582727, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Palon',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0379827, lng:11.0582611, label:'Valley/lower station' },
    to:   { lat:46.0269684, lng:11.0587172, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Serrada - Dosso Martinella',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8909232, lng:11.1577289, label:'Valley/lower station' },
    to:   { lat:45.8881903, lng:11.1757854, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Prà Alpesina',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.7599053, lng:10.8778977, label:'Valley/lower station' },
    to:   { lat:45.7598434, lng:10.8655666, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Montagnola',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.7824831, lng:10.9383078, label:'Valley/lower station' },
    to:   { lat:45.7730222, lng:10.9489245, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Bucaneve',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.7858024, lng:10.9199179, label:'Valley/lower station' },
    to:   { lat:45.7767958, lng:10.9258536, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Forte Verena',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9183664, lng:11.4054841, label:'Valley/lower station' },
    to:   { lat:45.9302114, lng:11.4133204, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sessi',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0443167, lng:9.6992236, label:'Valley/lower station' },
    to:   { lat:46.0412553, lng:9.6894333, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Teresat',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1492101, lng:10.9956933, label:'Valley/lower station' },
    to:   { lat:46.147179, lng:10.996977, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Moggio - Artavaggio',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:45.9297168, lng:9.4917729, label:'Valley/lower station' },
    to:   { lat:45.9330617, lng:9.5237892, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sessellift Grube',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.7279052, lng:11.2273052, label:'Valley/lower station' },
    to:   { lat:46.733899, lng:11.2406861, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Alpe Soliva',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0215336, lng:9.7807073, label:'Valley/lower station' },
    to:   { lat:46.0308681, lng:9.7834684, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pescegallo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0378854, lng:9.5704133, label:'Valley/lower station' },
    to:   { lat:46.0281548, lng:9.573217, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivia Ponte di Piero-Monteviasco',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.0736163, lng:8.8160346, label:'Valley/lower station' },
    to:   { lat:46.0717465, lng:8.8272817, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Alpe Vago',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1518508, lng:10.1570745, label:'Valley/lower station' },
    to:   { lat:46.1494674, lng:10.1585682, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Quadrifoglio',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1392833, lng:10.1593598, label:'Valley/lower station' },
    to:   { lat:46.128692, lng:10.1644244, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Des Alpes',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5185686, lng:10.5784222, label:'Valley/lower station' },
    to:   { lat:46.5171705, lng:10.5700214, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cabinovia Aviatico - Monte Poieto',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:45.7947547, lng:9.770676, label:'Valley/lower station' },
    to:   { lat:45.7998434, lng:9.781913, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Roseal - Giumela',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4401904, lng:11.7693095, label:'Valley/lower station' },
    to:   { lat:46.436296, lng:11.7594063, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Barzio - Piani di Bobbio',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:45.9553494, lng:9.4638987, label:'Valley/lower station' },
    to:   { lat:45.9614897, lng:9.488077, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Gitschberg - Monte Cuzzo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.8524038, lng:11.6859303, label:'Valley/lower station' },
    to:   { lat:46.8592162, lng:11.6869735, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Gaibana',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.6887532, lng:11.0842555, label:'Valley/lower station' },
    to:   { lat:45.692389, lng:11.0973357, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Rosa del Sole',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.7773929, lng:10.9361853, label:'Valley/lower station' },
    to:   { lat:45.7729527, lng:10.9269509, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Raut',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.7313645, lng:12.3297097, label:'Valley/lower station' },
    to:   { lat:46.7283556, lng:12.3360492, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Salare Conca',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1450203, lng:11.0153245, label:'Valley/lower station' },
    to:   { lat:46.1391074, lng:11.0215428, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Prati di Gaggia - Paganella 2',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.149764, lng:10.9969844, label:'Valley/lower station' },
    to:   { lat:46.1407282, lng:11.0156303, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Laghet - Prati di Gaggia',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.1594145, lng:11.0014308, label:'Valley/lower station' },
    to:   { lat:46.1501075, lng:10.9965887, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Laghet - Doss',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1613658, lng:11.0025794, label:'Valley/lower station' },
    to:   { lat:46.1607456, lng:11.0042744, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cima Aquila',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9176669, lng:11.405487, label:'Valley/lower station' },
    to:   { lat:45.9187603, lng:11.4115872, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Bosco degli Urogalli',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.918521, lng:11.4047676, label:'Valley/lower station' },
    to:   { lat:45.9260297, lng:11.4079098, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Unnamed lift #4',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.1676299, lng:10.4741213, label:'Valley/lower station' },
    to:   { lat:46.1863985, lng:10.4741165, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Unnamed lift #5',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0990634, lng:11.6676001, label:'Valley/lower station' },
    to:   { lat:46.0967335, lng:11.655996, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Unnamed lift #6',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1148157, lng:11.6597665, label:'Valley/lower station' },
    to:   { lat:46.1048478, lng:11.6544202, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: '3-Tre',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0499785, lng:11.0723715, label:'Valley/lower station' },
    to:   { lat:46.0412412, lng:11.0696366, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Rocce-Rosse',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0410244, lng:11.0368374, label:'Valley/lower station' },
    to:   { lat:46.0268145, lng:11.0561043, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Bernhard Glück',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.9287776, lng:11.9108103, label:'Valley/lower station' },
    to:   { lat:46.9184488, lng:11.9053739, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Marilleva',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3014316, lng:10.8118601, label:'Valley/lower station' },
    to:   { lat:46.2902393, lng:10.8129835, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Daolasa 1',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.3191792, lng:10.8362018, label:'Valley/lower station' },
    to:   { lat:46.3030373, lng:10.8367528, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Albaré',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.3044109, lng:10.8117047, label:'Valley/lower station' },
    to:   { lat:46.3021564, lng:10.8119701, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Prè Ciablun',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.549642, lng:11.8991554, label:'Valley/lower station' },
    to:   { lat:46.5524884, lng:11.9017327, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ust',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9526574, lng:11.2802329, label:'Valley/lower station' },
    to:   { lat:45.9542883, lng:11.2847571, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sonneck',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9520436, lng:11.2803656, label:'Valley/lower station' },
    to:   { lat:45.9504606, lng:11.2760905, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Tablat',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9497532, lng:11.2646508, label:'Valley/lower station' },
    to:   { lat:45.9505991, lng:11.2755072, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Laghetto - Ust',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9575765, lng:11.2937849, label:'Valley/lower station' },
    to:   { lat:45.9542883, lng:11.2847571, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Laghetto - Virgo Maria',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9535712, lng:11.3023442, label:'Valley/lower station' },
    to:   { lat:45.9546082, lng:11.3178717, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Virgo Maria - Vezzena',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9553239, lng:11.3288429, label:'Valley/lower station' },
    to:   { lat:45.9546082, lng:11.3178717, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Coston - Monte Coston',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8990852, lng:11.2580318, label:'Valley/lower station' },
    to:   { lat:45.8844678, lng:11.256158, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Tre Sassi - Monte Coston',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8816074, lng:11.2573942, label:'Valley/lower station' },
    to:   { lat:45.8842605, lng:11.2560005, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Costa - Dosso della Madonna',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9179893, lng:11.1928802, label:'Valley/lower station' },
    to:   { lat:45.9163082, lng:11.193116, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Colla',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0418112, lng:9.7069495, label:'Valley/lower station' },
    to:   { lat:46.041832, lng:9.6987072, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Passo Coe - Plaut',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8771394, lng:11.2181163, label:'Valley/lower station' },
    to:   { lat:45.8811424, lng:11.2137033, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Val delle Lanze - Costa d\'Agra',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8814113, lng:11.2636342, label:'Valley/lower station' },
    to:   { lat:45.8780421, lng:11.2419181, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Malga Piovernetta - Monte Pioverna',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8749941, lng:11.2268012, label:'Valley/lower station' },
    to:   { lat:45.8812597, lng:11.2357619, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fondo Piccolo - Plaut',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8810011, lng:11.2002033, label:'Valley/lower station' },
    to:   { lat:45.8810494, lng:11.2128387, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Malga Piovernetta - Termental',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8750131, lng:11.2262339, label:'Valley/lower station' },
    to:   { lat:45.8803838, lng:11.2186377, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Steinermandl',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.8378019, lng:11.6065291, label:'Valley/lower station' },
    to:   { lat:46.8335368, lng:11.5995, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Hinterberg',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.8382877, lng:11.6063637, label:'Valley/lower station' },
    to:   { lat:46.8423263, lng:11.5934598, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Bormio 2000 - Pian dei Larici',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4443206, lng:10.3890379, label:'Valley/lower station' },
    to:   { lat:46.438615, lng:10.3976342, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ra Valles - Cima Tofana',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.5479558, lng:12.0852364, label:'Valley/lower station' },
    to:   { lat:46.5518772, lng:12.0672969, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Col Drusciè - Ra Valles',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.5437034, lng:12.1038855, label:'Valley/lower station' },
    to:   { lat:46.5477775, lng:12.0851627, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Rigolor',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0587911, lng:11.3219252, label:'Valley/lower station' },
    to:   { lat:46.0498108, lng:11.3299504, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sant\'Antonio',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1424082, lng:11.010204, label:'Valley/lower station' },
    to:   { lat:46.1370394, lng:11.0232011, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Rossalm',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.6885734, lng:11.7344596, label:'Valley/lower station' },
    to:   { lat:46.6923709, lng:11.7472337, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Coston (near 46.2677753°N, 11.7789261°E)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2677753, lng:11.7789261, label:'Valley/lower station' },
    to:   { lat:46.2640207, lng:11.7674064, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ferrari',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.292768, lng:11.7793938, label:'Valley/lower station' },
    to:   { lat:46.2937444, lng:11.7876959, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cimon',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2955448, lng:11.7824186, label:'Valley/lower station' },
    to:   { lat:46.2937731, lng:11.788011, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Kronplatz II',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.7487968, lng:11.9525024, label:'Valley/lower station' },
    to:   { lat:46.739359, lng:11.9574545, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Gigante',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3791372, lng:11.7945736, label:'Valley/lower station' },
    to:   { lat:46.392183, lng:11.8013813, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cima Uomo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3918835, lng:11.8009865, label:'Valley/lower station' },
    to:   { lat:46.3980634, lng:11.799236, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Col Margherita',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.377407, lng:11.8018743, label:'Valley/lower station' },
    to:   { lat:46.3676171, lng:11.7937046, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Falcade - Le Buse',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.3493661, lng:11.8592786, label:'Valley/lower station' },
    to:   { lat:46.353959, lng:11.8369595, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Paese - Piazzale Alberghi',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0431912, lng:9.7511427, label:'Valley/lower station' },
    to:   { lat:46.0417763, lng:9.7558634, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Meletta Davanti',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9232801, lng:11.5757411, label:'Valley/lower station' },
    to:   { lat:45.9192829, lng:11.579767, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Busa Fonda - Meletta',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9186659, lng:11.5624145, label:'Valley/lower station' },
    to:   { lat:45.9252773, lng:11.5730661, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Forte - Tadè',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4673502, lng:10.3372166, label:'Valley/lower station' },
    to:   { lat:46.4648502, lng:10.3203725, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Le Motte - Dossaccio',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4759534, lng:10.3498339, label:'Valley/lower station' },
    to:   { lat:46.46937, lng:10.3392331, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivia Malcesine-Monte Baldo (tratto primo)',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:45.7662047, lng:10.8133899, label:'Valley/lower station' },
    to:   { lat:45.7688671, lng:10.8313377, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Donico - Paghera Giogo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9305986, lng:10.0845986, label:'Valley/lower station' },
    to:   { lat:45.9270036, lng:10.0868763, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Montefalcone',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.6780165, lng:11.2200052, label:'Valley/lower station' },
    to:   { lat:45.6684521, lng:11.205001, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Piè Tofana - Duca d\'Aosta',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5410791, lng:12.098142, label:'Valley/lower station' },
    to:   { lat:46.5377819, lng:12.0852765, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Camoscio',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0443217, lng:9.699482, label:'Valley/lower station' },
    to:   { lat:46.0379502, lng:9.6965145, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Larici',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.435755, lng:9.3593309, label:'Valley/lower station' },
    to:   { lat:46.4309648, lng:9.3748917, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Vareno',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9011679, lng:10.1055392, label:'Valley/lower station' },
    to:   { lat:45.8915281, lng:10.1089121, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Termen',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8862177, lng:10.0927833, label:'Valley/lower station' },
    to:   { lat:45.8833236, lng:10.0953043, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cima Pora',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8893432, lng:10.0936507, label:'Valley/lower station' },
    to:   { lat:45.885699, lng:10.1084727, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Valzelli',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8869139, lng:10.0804928, label:'Valley/lower station' },
    to:   { lat:45.8822762, lng:10.0904078, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Kleinboden',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5527404, lng:10.5106215, label:'Valley/lower station' },
    to:   { lat:46.5698341, lng:10.5049998, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Wallpach',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.6712819, lng:11.2475814, label:'Valley/lower station' },
    to:   { lat:46.6774353, lng:11.2550714, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Schilling',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.850576, lng:11.6223982, label:'Valley/lower station' },
    to:   { lat:46.8424018, lng:11.6459856, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Gaisjoch',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.8349272, lng:11.6692308, label:'Valley/lower station' },
    to:   { lat:46.8422994, lng:11.6463126, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sattele',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.6990387, lng:11.4406972, label:'Valley/lower station' },
    to:   { lat:46.7005053, lng:11.4559134, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ried',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.7902441, lng:11.9781099, label:'Valley/lower station' },
    to:   { lat:46.7542589, lng:11.9587753, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Rio Gere - Pian de Ra Bigontina',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5459739, lng:12.1857618, label:'Valley/lower station' },
    to:   { lat:46.5509141, lng:12.1900906, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pian de Ra Bigontina',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5462014, lng:12.1851341, label:'Valley/lower station' },
    to:   { lat:46.5366251, lng:12.1829066, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Lago Cavia - Laresei',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3573095, lng:11.8174933, label:'Valley/lower station' },
    to:   { lat:46.3552604, lng:11.8197789, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Del Passo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3781313, lng:11.8014507, label:'Valley/lower station' },
    to:   { lat:46.3802733, lng:11.7973899, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Le Buse - Laresei',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3540303, lng:11.8356802, label:'Valley/lower station' },
    to:   { lat:46.3544731, lng:11.8204184, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Lago Cavia - Col Margherita',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3569913, lng:11.8147512, label:'Valley/lower station' },
    to:   { lat:46.3671058, lng:11.7933261, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fassane - Morea',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.3242466, lng:11.6982641, label:'Valley/lower station' },
    to:   { lat:46.3311983, lng:11.7080172, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Piavac',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3560895, lng:11.6851496, label:'Valley/lower station' },
    to:   { lat:46.345431, lng:11.6924457, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Campo Scuola Gardonè',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3409306, lng:11.5787926, label:'Valley/lower station' },
    to:   { lat:46.3418154, lng:11.5743606, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Campanil',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.349427, lng:11.5433009, label:'Valley/lower station' },
    to:   { lat:46.3515331, lng:11.5489886, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Baradello - Piana Galli',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1552307, lng:10.1663586, label:'Valley/lower station' },
    to:   { lat:46.1374602, lng:10.1764422, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Magnolta',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.149261, lng:10.1463494, label:'Valley/lower station' },
    to:   { lat:46.1327113, lng:10.1400529, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Piana Galli',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1330248, lng:10.138196, label:'Valley/lower station' },
    to:   { lat:46.1262956, lng:10.1506563, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funifor Arabba - Portavescovo',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.495421, lng:11.8744431, label:'Valley/lower station' },
    to:   { lat:46.4731123, lng:11.8671064, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Camp Scuola Ciampediè',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4366217, lng:11.6690718, label:'Valley/lower station' },
    to:   { lat:46.4337499, lng:11.6663883, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Trincerone - Livrio',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.5128942, lng:10.465877, label:'Valley/lower station' },
    to:   { lat:46.5178784, lng:10.4584071, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Passo Stelvio - Trincerone',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.5179894, lng:10.458348, label:'Valley/lower station' },
    to:   { lat:46.5272657, lng:10.4521825, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Scandola',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2402352, lng:11.7582326, label:'Valley/lower station' },
    to:   { lat:46.2393415, lng:11.7692143, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Campigol',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3787889, lng:11.7810319, label:'Valley/lower station' },
    to:   { lat:46.3831259, lng:11.7835474, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Saline-Laresei',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3438229, lng:11.8235257, label:'Valley/lower station' },
    to:   { lat:46.3518857, lng:11.8100182, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Dosso Rotondo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8160828, lng:10.2112207, label:'Valley/lower station' },
    to:   { lat:45.8156674, lng:10.2219961, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Monte Corniolo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8265331, lng:10.1888689, label:'Valley/lower station' },
    to:   { lat:45.8155951, lng:10.2060846, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Dosso Beccherie',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8374941, lng:10.2358713, label:'Valley/lower station' },
    to:   { lat:45.8413666, lng:10.2469268, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Gardena',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8276325, lng:10.1897138, label:'Valley/lower station' },
    to:   { lat:45.8258638, lng:10.1924116, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Larice',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8347517, lng:10.2343902, label:'Valley/lower station' },
    to:   { lat:45.8305946, lng:10.2275108, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Le Baite',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8350968, lng:10.2353451, label:'Valley/lower station' },
    to:   { lat:45.8371551, lng:10.2484994, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Prato Secondino',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8358728, lng:10.2167039, label:'Valley/lower station' },
    to:   { lat:45.8299213, lng:10.2267518, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Splaza',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8246005, lng:10.2200179, label:'Valley/lower station' },
    to:   { lat:45.8276881, lng:10.2254943, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Valmaione',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8162125, lng:10.2097188, label:'Valley/lower station' },
    to:   { lat:45.8090955, lng:10.2103803, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Stavelin',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3703992, lng:10.6630203, label:'Valley/lower station' },
    to:   { lat:46.3728712, lng:10.6615175, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Mezoli',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3554797, lng:10.6615767, label:'Valley/lower station' },
    to:   { lat:46.3581193, lng:10.6524178, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Spinale II',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2257034, lng:10.8353843, label:'Valley/lower station' },
    to:   { lat:46.2231646, lng:10.8474267, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Grual - Monte Grual',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1729955, lng:10.8135217, label:'Valley/lower station' },
    to:   { lat:46.175078, lng:10.817199, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Malga Grual - Doss del Sabion',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1779871, lng:10.81383, label:'Valley/lower station' },
    to:   { lat:46.167552, lng:10.8065358, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Puza dai Fò - Monte Grual',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1874665, lng:10.8164226, label:'Valley/lower station' },
    to:   { lat:46.1753713, lng:10.8170948, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Grual - Zapel',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1725841, lng:10.8125521, label:'Valley/lower station' },
    to:   { lat:46.1739058, lng:10.80799, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Rosskopf',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.904197, lng:11.42965, label:'Valley/lower station' },
    to:   { lat:46.9127079, lng:11.3980798, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Watles - Vatles',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.7086357, lng:10.4930489, label:'Valley/lower station' },
    to:   { lat:46.7197366, lng:10.4852241, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Toracchio',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9790722, lng:9.6976886, label:'Valley/lower station' },
    to:   { lat:45.9769061, lng:9.7068706, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Rambasì',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0193431, lng:10.0060383, label:'Valley/lower station' },
    to:   { lat:46.0092197, lng:10.0058205, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Due Baite',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.020866, lng:10.0082876, label:'Valley/lower station' },
    to:   { lat:46.0158803, lng:10.0100817, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cavandola',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0237889, lng:10.0111432, label:'Valley/lower station' },
    to:   { lat:46.0193004, lng:10.006209, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Le Ogne - Plai',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9363476, lng:10.1782749, label:'Valley/lower station' },
    to:   { lat:45.9256203, lng:10.1758693, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ogne 1',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9396485, lng:10.1807582, label:'Valley/lower station' },
    to:   { lat:45.9365254, lng:10.1793568, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Plai - Monte Altissimo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9257266, lng:10.1767642, label:'Valley/lower station' },
    to:   { lat:45.9146567, lng:10.1744359, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cabinovia dismessa',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:45.9887013, lng:9.6830549, label:'Valley/lower station' },
    to:   { lat:45.9796595, lng:9.6984127, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Gremei (dismessa)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9796552, lng:9.698784, label:'Valley/lower station' },
    to:   { lat:45.9785784, lng:9.7106246, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Bergbahn Haideralm',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.7652777, lng:10.5318498, label:'Valley/lower station' },
    to:   { lat:46.7611197, lng:10.5046024, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seggiovia Col dei Pez - Faverghera (II tronco)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0867003, lng:12.2883491, label:'Valley/lower station' },
    to:   { lat:46.0786555, lng:12.2999825, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seggiovia Nevegal - Col dei Pez (I tronco)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.092297, lng:12.2809254, label:'Valley/lower station' },
    to:   { lat:46.0868868, lng:12.2882751, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Gletscherbahn - Funivia Ghiacciai',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.7574278, lng:10.7827211, label:'Valley/lower station' },
    to:   { lat:46.7699617, lng:10.7974224, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funifor Pejo 3000',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.3698452, lng:10.6595977, label:'Valley/lower station' },
    to:   { lat:46.3837521, lng:10.6314092, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Montesel',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.046777, lng:11.0677178, label:'Valley/lower station' },
    to:   { lat:46.038894, lng:11.066027, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Rifugio',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0504521, lng:11.3170673, label:'Valley/lower station' },
    to:   { lat:46.0487224, lng:11.3188838, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Teufelsegg',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.7738288, lng:10.7824384, label:'Valley/lower station' },
    to:   { lat:46.7836312, lng:10.7638419, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Gletschersee 1',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.7797701, lng:10.7969357, label:'Valley/lower station' },
    to:   { lat:46.776476, lng:10.8008993, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Gletschersee 2',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.7797791, lng:10.7970935, label:'Valley/lower station' },
    to:   { lat:46.776557, lng:10.8009931, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Grawand',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.7760323, lng:10.8003957, label:'Valley/lower station' },
    to:   { lat:46.7699945, lng:10.7978959, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Hintereis',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.7818026, lng:10.7974758, label:'Valley/lower station' },
    to:   { lat:46.7918989, lng:10.7899131, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Roter Kofel',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.7580857, lng:10.7824089, label:'Valley/lower station' },
    to:   { lat:46.7737056, lng:10.7819409, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Persech',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8282914, lng:10.4169225, label:'Valley/lower station' },
    to:   { lat:45.8280705, lng:10.4067575, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fienili Barard (near 45.8330939°N, 10.4186193°E)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8330939, lng:10.4186193, label:'Valley/lower station' },
    to:   { lat:45.8300269, lng:10.4034843, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Zocchi',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8397893, lng:10.4052559, label:'Valley/lower station' },
    to:   { lat:45.8345759, lng:10.396208, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Persole - Dasdana',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8388196, lng:10.3922915, label:'Valley/lower station' },
    to:   { lat:45.8411942, lng:10.3770091, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Campo - Le Cune',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3318318, lng:11.7005847, label:'Valley/lower station' },
    to:   { lat:46.3438001, lng:11.6942463, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Campo - Lasté',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.331777, lng:11.7008602, label:'Valley/lower station' },
    to:   { lat:46.3448979, lng:11.7210894, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ronchi - Valbona',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.3680939, lng:11.6877826, label:'Valley/lower station' },
    to:   { lat:46.3578616, lng:11.6848972, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Carpazza',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4870453, lng:11.8588606, label:'Valley/lower station' },
    to:   { lat:46.4757608, lng:11.8665436, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Costabella (near 46.2503299°N, 11.4936728°E)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2503299, lng:11.4936728, label:'Valley/lower station' },
    to:   { lat:46.2422708, lng:11.503145, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Lagorai',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2509862, lng:11.5031075, label:'Valley/lower station' },
    to:   { lat:46.2426023, lng:11.5038478, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Prà Fiori',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.247221, lng:11.4884072, label:'Valley/lower station' },
    to:   { lat:46.2344939, lng:11.4998066, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Castelir - Fassane',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.3132149, lng:11.6880363, label:'Valley/lower station' },
    to:   { lat:46.3242466, lng:11.6982641, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Valbona - Le Cune',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.3578616, lng:11.6848972, label:'Valley/lower station' },
    to:   { lat:46.3460827, lng:11.6935011, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Carisole - Valgussera',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0366438, lng:9.7863288, label:'Valley/lower station' },
    to:   { lat:46.0390143, lng:9.7738499, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Carisole - Conca Nevosa',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0328598, lng:9.7832579, label:'Valley/lower station' },
    to:   { lat:46.0403862, lng:9.8032256, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'San Rocco (17a)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5245728, lng:10.1254385, label:'Valley/lower station' },
    to:   { lat:46.5251029, lng:10.1207194, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Campo Scuola (23)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5419083, lng:10.1360261, label:'Valley/lower station' },
    to:   { lat:46.543323, lng:10.1314096, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Botarel (29a)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5446967, lng:10.1375587, label:'Valley/lower station' },
    to:   { lat:46.5464051, lng:10.1275251, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cassana (30)',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5481443, lng:10.1377335, label:'Valley/lower station' },
    to:   { lat:46.546928, lng:10.1267811, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Blosegg - Maso Blasegger',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.8644259, lng:11.3073959, label:'Valley/lower station' },
    to:   { lat:46.8600027, lng:11.3028611, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pinzolo Campiglio express III',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2188064, lng:10.8218869, label:'Valley/lower station' },
    to:   { lat:46.2281236, lng:10.8151423, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pinzolo Campiglio express II',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.1977309, lng:10.8197615, label:'Valley/lower station' },
    to:   { lat:46.2187758, lng:10.8218896, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Groppera',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.415332, lng:9.4004931, label:'Valley/lower station' },
    to:   { lat:46.4239158, lng:9.3788446, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Val di Lei',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.424004, lng:9.4161592, label:'Valley/lower station' },
    to:   { lat:46.4147321, lng:9.40325, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Col d\'la Tenda',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.604821, lng:12.4765055, label:'Valley/lower station' },
    to:   { lat:46.6057267, lng:12.4505123, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Montalto',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4392269, lng:9.3618426, label:'Valley/lower station' },
    to:   { lat:46.4334423, lng:9.3730716, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Motta',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4215376, lng:9.3547818, label:'Valley/lower station' },
    to:   { lat:46.4179643, lng:9.3659037, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Serenissima',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4207389, lng:9.3649921, label:'Valley/lower station' },
    to:   { lat:46.4160234, lng:9.379583, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Colmenetta Est',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4265458, lng:9.3695419, label:'Valley/lower station' },
    to:   { lat:46.4186139, lng:9.3751658, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cima Sole',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4298474, lng:9.3751408, label:'Valley/lower station' },
    to:   { lat:46.4241583, lng:9.3790953, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Lago Azzurro',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4335263, lng:9.3574826, label:'Valley/lower station' },
    to:   { lat:46.4255101, lng:9.3743749, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Vigiljoch - San Vigilio',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.6205976, lng:11.139831, label:'Valley/lower station' },
    to:   { lat:46.6277341, lng:11.1176112, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cabinovia Recoaro Terme - Recoaro 1000',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:45.7043954, lng:11.2259177, label:'Valley/lower station' },
    to:   { lat:45.6899525, lng:11.2255543, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Vodala',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9704993, lng:9.961756, label:'Valley/lower station' },
    to:   { lat:45.9577883, lng:9.9763274, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Costa Gosa',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9689073, lng:9.9591744, label:'Valley/lower station' },
    to:   { lat:45.9597543, lng:9.9663919, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivia Boazzo',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.0533596, lng:10.5140214, label:'Valley/lower station' },
    to:   { lat:46.007755, lng:10.5117999, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pinzolo Campiglio express I',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.1977199, lng:10.8197565, label:'Valley/lower station' },
    to:   { lat:46.187788, lng:10.817059, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Baby Socrepes',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5338552, lng:12.1202787, label:'Valley/lower station' },
    to:   { lat:46.5330683, lng:12.1161831, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Conca',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.24362, lng:11.7661292, label:'Valley/lower station' },
    to:   { lat:46.2346348, lng:11.7736067, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Tulot - Malga Cioca',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.1762952, lng:10.7708217, label:'Valley/lower station' },
    to:   { lat:46.1736914, lng:10.8003185, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Bocchel del Torno',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2994997, lng:9.8911893, label:'Valley/lower station' },
    to:   { lat:46.3083351, lng:9.8803795, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Alpe Palú - Cima Motta',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.294245, lng:9.8686935, label:'Valley/lower station' },
    to:   { lat:46.2881348, lng:9.8844109, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Snow Eagle',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.273363, lng:9.8549542, label:'Valley/lower station' },
    to:   { lat:46.2871513, lng:9.8629187, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Del Dosso',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2909667, lng:9.8659585, label:'Valley/lower station' },
    to:   { lat:46.288685, lng:9.8672317, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Baby Bernina',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2941901, lng:9.8616155, label:'Valley/lower station' },
    to:   { lat:46.2917253, lng:9.8669969, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sponda Vaga',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9941448, lng:9.9999296, label:'Valley/lower station' },
    to:   { lat:46.0047853, lng:10.0083563, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Malga Polzone - Cima Bianca',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9808579, lng:10.0547021, label:'Valley/lower station' },
    to:   { lat:45.9712478, lng:10.04167, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Corne Gemelle - Ferrantino',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9760886, lng:10.0474339, label:'Valley/lower station' },
    to:   { lat:45.9692609, lng:10.0384593, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Vaccarizza',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9594246, lng:9.9709127, label:'Valley/lower station' },
    to:   { lat:45.9562246, lng:9.9778583, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Alpenrose (Vauz - La Viza)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4884001, lng:11.8440428, label:'Valley/lower station' },
    to:   { lat:46.4861794, lng:11.8557381, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'La Rossa - San Colombano',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.460547, lng:10.3253747, label:'Valley/lower station' },
    to:   { lat:46.4576707, lng:10.3100021, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Belvedere (near 46.5677155°N, 10.5035615°E)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5677155, lng:10.5035615, label:'Valley/lower station' },
    to:   { lat:46.5750029, lng:10.501003, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pedrana - Barchi - Palù',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3001449, lng:9.8409897, label:'Valley/lower station' },
    to:   { lat:46.2918476, lng:9.865097, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seggiovia Piazzo Cavalli',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2575866, lng:9.8706854, label:'Valley/lower station' },
    to:   { lat:46.2499887, lng:9.8717852, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seggiovia Sant\'Antonio',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2627554, lng:9.8659311, label:'Valley/lower station' },
    to:   { lat:46.2578087, lng:9.8703952, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Santa Caterina - Plaghera',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.4161074, lng:10.4861909, label:'Valley/lower station' },
    to:   { lat:46.404099, lng:10.4824159, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cima Laghetto',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0302162, lng:9.4041248, label:'Valley/lower station' },
    to:   { lat:46.0301109, lng:9.4114234, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fontanacce',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1893956, lng:10.0540612, label:'Valley/lower station' },
    to:   { lat:46.2051201, lng:10.0435969, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Palù',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4219722, lng:9.3551251, label:'Valley/lower station' },
    to:   { lat:46.4222633, lng:9.3582292, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seggiovia della Misa',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9141023, lng:10.4576434, label:'Valley/lower station' },
    to:   { lat:45.9093836, lng:10.4422533, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Drei Zinnen - Tre Cime',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.6804707, lng:12.381953, label:'Valley/lower station' },
    to:   { lat:46.6945616, lng:12.397261, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seggiovia Col Canil',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.086935, lng:12.2767995, label:'Valley/lower station' },
    to:   { lat:46.0771312, lng:12.2883069, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seilbahn Pawigl - Funivia Pavicolo',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.6216866, lng:11.1051312, label:'Valley/lower station' },
    to:   { lat:46.609949, lng:11.1171802, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivia ENEL Carona - Pian Casere',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.0196363, lng:9.7819414, label:'Valley/lower station' },
    to:   { lat:45.9994935, lng:9.7921849, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivia ENEL Carona - Sardegnana',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.016658, lng:9.8040035, label:'Valley/lower station' },
    to:   { lat:46.0226859, lng:9.7910183, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Kabinenbahn Rosim - Cabinovia Rosim',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5159013, lng:10.5951529, label:'Valley/lower station' },
    to:   { lat:46.5235603, lng:10.6097279, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cavalese - Fondovalle',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2831699, lng:11.4715753, label:'Valley/lower station' },
    to:   { lat:46.2851911, lng:11.4647308, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ronchetto - Meletta di Gallio',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9306648, lng:11.5802069, label:'Valley/lower station' },
    to:   { lat:45.926739, lng:11.5697453, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Baby',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4125841, lng:12.0445274, label:'Valley/lower station' },
    to:   { lat:46.4137333, lng:12.0432675, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Nuova Orscellera',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9593359, lng:9.4899393, label:'Valley/lower station' },
    to:   { lat:45.9551842, lng:9.4916142, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Isolaccia - Pian della Mota',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.4867434, lng:10.3031388, label:'Valley/lower station' },
    to:   { lat:46.4738863, lng:10.3001387, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Vallalpe',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3810247, lng:10.4815047, label:'Valley/lower station' },
    to:   { lat:46.3929906, lng:10.4645201, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Plaghera - Sobretta - Vallalpe',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.404099, lng:10.4824159, label:'Valley/lower station' },
    to:   { lat:46.3872458, lng:10.4787435, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Tunche',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.6780037, lng:11.2213897, label:'Valley/lower station' },
    to:   { lat:45.6798965, lng:11.2258905, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Tambres',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4594444, lng:12.2159486, label:'Valley/lower station' },
    to:   { lat:46.4621611, lng:12.2254321, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Nesselbahn',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.8353965, lng:11.6698075, label:'Valley/lower station' },
    to:   { lat:46.8462909, lng:11.6840652, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Unnamed lift #7',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1051837, lng:11.6668412, label:'Valley/lower station' },
    to:   { lat:46.1045743, lng:11.6600102, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Malga Cioca - Zapel',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.1770278, lng:10.7965175, label:'Valley/lower station' },
    to:   { lat:46.1739058, lng:10.80799, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pancugolo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2306329, lng:10.8092562, label:'Valley/lower station' },
    to:   { lat:46.2320651, lng:10.8049243, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Grostè 2 express',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2262519, lng:10.8761385, label:'Valley/lower station' },
    to:   { lat:46.2151075, lng:10.9008836, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Vagliana',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2290121, lng:10.8663184, label:'Valley/lower station' },
    to:   { lat:46.2358979, lng:10.8683017, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Brugger',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.9937934, lng:11.972616, label:'Valley/lower station' },
    to:   { lat:46.9913724, lng:11.9752133, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Steinhaus',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.9926931, lng:11.9720215, label:'Valley/lower station' },
    to:   { lat:46.9898188, lng:11.9738672, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Unnamed lift #8',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9724588, lng:11.404498, label:'Valley/lower station' },
    to:   { lat:45.969998, lng:11.3971288, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivia Malcesine-Monte Baldo (secondo tratto)',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:45.7688516, lng:10.8315603, label:'Valley/lower station' },
    to:   { lat:45.7692469, lng:10.8643811, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Unnamed lift #9',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.1303739, lng:11.6017977, label:'Valley/lower station' },
    to:   { lat:46.1308539, lng:11.5857589, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Monte Purito',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.7818647, lng:9.7556726, label:'Valley/lower station' },
    to:   { lat:45.7783023, lng:9.7588154, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'FUF Alba - Col dei Rossi',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.4576454, lng:11.7889485, label:'Valley/lower station' },
    to:   { lat:46.4742899, lng:11.8019697, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Campo scuola',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9693466, lng:9.959522, label:'Valley/lower station' },
    to:   { lat:45.9667711, lng:9.9648629, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Welschnofen Laurin 1 - Nova Levante Laurino 1',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.4441953, lng:11.5888346, label:'Valley/lower station' },
    to:   { lat:46.4322871, lng:11.5458439, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Comici II',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5293308, lng:11.7478895, label:'Valley/lower station' },
    to:   { lat:46.5319396, lng:11.7500595, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'ENEL (near 45.9755534°N, 9.8964141°E)',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:45.9755534, lng:9.8964141, label:'Valley/lower station' },
    to:   { lat:45.9971783, lng:9.8742795, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'ENEL (near 46.0444049°N, 10.021937°E)',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.0444049, lng:10.021937, label:'Valley/lower station' },
    to:   { lat:46.0644773, lng:10.0418599, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Alpen Connecting',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.7521194, lng:11.9929622, label:'Valley/lower station' },
    to:   { lat:46.743268, lng:11.9674947, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Dantercepies I',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5556488, lng:11.7679757, label:'Valley/lower station' },
    to:   { lat:46.5504312, lng:11.7946651, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Gfallhof',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.7144328, lng:10.8824062, label:'Valley/lower station' },
    to:   { lat:46.720912, lng:10.8787357, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Collio - Roccolo Crispe',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8088128, lng:10.3352994, label:'Valley/lower station' },
    to:   { lat:45.7990191, lng:10.3380582, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Saroden',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3753707, lng:10.6691775, label:'Valley/lower station' },
    to:   { lat:46.3821393, lng:10.6625578, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Duadello',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.7916323, lng:10.174805, label:'Valley/lower station' },
    to:   { lat:45.7841063, lng:10.1690014, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seilbahn Vöran - Funivia Verano',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.6005413, lng:11.1992629, label:'Valley/lower station' },
    to:   { lat:46.6036628, lng:11.2231209, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Carosello 3000 I (11)',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5207084, lng:10.1224568, label:'Valley/lower station' },
    to:   { lat:46.5194654, lng:10.1100927, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Carosello 3000 II (12)',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5194654, lng:10.1100927, label:'Valley/lower station' },
    to:   { lat:46.5169066, lng:10.0879609, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivia Enel Gerola Trona',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.052656, lng:9.5506324, label:'Valley/lower station' },
    to:   { lat:46.0322486, lng:9.5381668, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Arlecchino',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4402336, lng:9.3617304, label:'Valley/lower station' },
    to:   { lat:46.4415113, lng:9.365775, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Höllental',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.8014194, lng:10.5105199, label:'Valley/lower station' },
    to:   { lat:46.7955247, lng:10.4955285, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Haideralm – Schöneben',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.7656454, lng:10.5308014, label:'Valley/lower station' },
    to:   { lat:46.8012758, lng:10.5107815, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Unnamed lift #10',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.420895, lng:11.1786827, label:'Valley/lower station' },
    to:   { lat:46.418188, lng:11.1818638, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Yepi Lift (7)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5378551, lng:10.1656059, label:'Valley/lower station' },
    to:   { lat:46.5282052, lng:10.1629497, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Dantercepies II',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5504312, lng:11.7946651, label:'Valley/lower station' },
    to:   { lat:46.5536644, lng:11.7997603, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Piz Seteur 2',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5275612, lng:11.7602766, label:'Valley/lower station' },
    to:   { lat:46.5229257, lng:11.7612084, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Frara',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5481905, lng:11.8275048, label:'Valley/lower station' },
    to:   { lat:46.5559602, lng:11.8119417, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Daolasa 2',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.3030373, lng:10.8367528, label:'Valley/lower station' },
    to:   { lat:46.2807009, lng:10.8323412, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Reiterjoch',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3584805, lng:11.5332391, label:'Valley/lower station' },
    to:   { lat:46.3536893, lng:11.536701, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Busa Fonda - Monte Ongara',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9187146, lng:11.5620341, label:'Valley/lower station' },
    to:   { lat:45.9126677, lng:11.5601589, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Pian Dosson - Selletta',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.1542024, lng:11.0168964, label:'Valley/lower station' },
    to:   { lat:46.1499467, lng:11.0360333, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cigolera',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2466253, lng:11.7734356, label:'Valley/lower station' },
    to:   { lat:46.2488835, lng:11.7599308, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'La Crusc 2',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.6128642, lng:11.92426, label:'Valley/lower station' },
    to:   { lat:46.6145966, lng:11.9365732, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'König Laurin I - Re Laurino I',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.4440259, lng:11.5893638, label:'Valley/lower station' },
    to:   { lat:46.4413299, lng:11.6000814, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Stiergarten - Orto del Toro (near 46.6980728°N, 12.3818554°E)',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.6980728, lng:12.3818554, label:'Valley/lower station' },
    to:   { lat:46.694653, lng:12.3970457, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Helmjet Sexten',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.6972048, lng:12.3581167, label:'Valley/lower station' },
    to:   { lat:46.7159457, lng:12.3613903, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Alpe Potor - Nuvolao',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5085274, lng:12.0424738, label:'Valley/lower station' },
    to:   { lat:46.5001174, lng:12.0404446, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Scerscen - Cima Motta',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2964626, lng:9.8993586, label:'Valley/lower station' },
    to:   { lat:46.2880927, lng:9.8854828, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: '5 Torri',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5185234, lng:12.0385048, label:'Valley/lower station' },
    to:   { lat:46.5082428, lng:12.0465199, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ottava',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.3031531, lng:10.8591202, label:'Valley/lower station' },
    to:   { lat:46.300985, lng:10.8618279, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Marilleva 900',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.3140473, lng:10.8125409, label:'Valley/lower station' },
    to:   { lat:46.3013875, lng:10.8097624, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Col Tondo',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5494545, lng:12.1402708, label:'Valley/lower station' },
    to:   { lat:46.5536548, lng:12.1467347, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Tiers am Rosengarten - Frommeralm',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.4453788, lng:11.5894155, label:'Valley/lower station' },
    to:   { lat:46.4707797, lng:11.5603885, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cortina Skyline (Son dei Prade - Cianzopè)',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.519355, lng:12.0707974, label:'Valley/lower station' },
    to:   { lat:46.52286, lng:12.0981593, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cortina Skyline (Cianzopè - Bai de Dones)',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.519355, lng:12.0707974, label:'Valley/lower station' },
    to:   { lat:46.5186784, lng:12.0387311, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'König Laurin II - Re Laurino II',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.4413299, lng:11.6000814, label:'Valley/lower station' },
    to:   { lat:46.4423278, lng:11.6120184, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Nuova Ongania',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9593584, lng:9.4900814, label:'Valley/lower station' },
    to:   { lat:45.953912, lng:9.4995527, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fedaia-Pian dei Fiacconi',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.4585903, lng:11.8633329, label:'Valley/lower station' },
    to:   { lat:46.4459229, lng:11.8601166, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fedaia-Sass del Mul',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4534575, lng:11.8884704, label:'Valley/lower station' },
    to:   { lat:46.4434238, lng:11.881303, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivia ENEL Lago Cavia',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.3612148, lng:11.8194361, label:'Valley/lower station' },
    to:   { lat:46.3663057, lng:11.8334005, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Plosebahn II',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.6922058, lng:11.6992933, label:'Valley/lower station' },
    to:   { lat:46.685811, lng:11.7102198, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Plosebahn I',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.698143, lng:11.6829609, label:'Valley/lower station' },
    to:   { lat:46.6922058, lng:11.6992933, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Naifjoch - Passo di Nova I',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.6775509, lng:11.2570652, label:'Valley/lower station' },
    to:   { lat:46.6827051, lng:11.2640116, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Capanno',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.9785626, lng:10.0600376, label:'Valley/lower station' },
    to:   { lat:45.9783092, lng:10.0542337, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Cima Tognola',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2488004, lng:11.7595746, label:'Valley/lower station' },
    to:   { lat:46.2513123, lng:11.7553542, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Stiergarten - Orto del Toro (near 46.6968718°N, 12.3752158°E)',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.6968718, lng:12.3752158, label:'Valley/lower station' },
    to:   { lat:46.6980728, lng:12.3818554, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Sonnen',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.9895094, lng:11.9844152, label:'Valley/lower station' },
    to:   { lat:46.9792449, lng:11.9940502, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Laghet  Ferna',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.1596987, lng:11.0021214, label:'Valley/lower station' },
    to:   { lat:46.1566611, lng:11.0024349, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Hirzer - Punta Cervina (near 46.7342093°N, 11.2271326°E)',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.7342093, lng:11.2271326, label:'Valley/lower station' },
    to:   { lat:46.7383343, lng:11.2467526, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Fienili Barard (near 45.8331379°N, 10.4188716°E)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8331379, lng:10.4188716, label:'Valley/lower station' },
    to:   { lat:45.8330939, lng:10.4186193, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Schwemmeregg',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.5408098, lng:10.934189, label:'Valley/lower station' },
    to:   { lat:46.5369777, lng:10.9224211, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Porzen',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.6697524, lng:12.3827886, label:'Valley/lower station' },
    to:   { lat:46.6600123, lng:12.3723367, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Marinzen',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5666155, lng:11.5625999, label:'Valley/lower station' },
    to:   { lat:46.5605195, lng:11.5814152, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Nuova Paradiso',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4114266, lng:10.4963254, label:'Valley/lower station' },
    to:   { lat:46.399001, lng:10.4884598, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'La Crusc 1',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.609201, lng:11.8965462, label:'Valley/lower station' },
    to:   { lat:46.6127735, lng:11.923541, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seggiovia Pianezze',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.030549, lng:10.7327574, label:'Valley/lower station' },
    to:   { lat:46.0251949, lng:10.7331866, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Ometto',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.2878661, lng:10.8185989, label:'Valley/lower station' },
    to:   { lat:46.2743005, lng:10.8189744, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivia Alperia Greenpower Srl GmbH (ex ENEL): Alpe di Riposo - Centrale idroelettrica Pracomune',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.5535966, lng:10.9222554, label:'Valley/lower station' },
    to:   { lat:46.5514735, lng:10.919095, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Progetto Cabinovia',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.252298, lng:10.5444218, label:'Valley/lower station' },
    to:   { lat:46.2828605, lng:10.559659, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Unnamed lift #11',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.7178397, lng:10.8582036, label:'Valley/lower station' },
    to:   { lat:46.7171896, lng:10.8597939, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Progetto',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2808165, lng:10.5800848, label:'Valley/lower station' },
    to:   { lat:46.2830674, lng:10.5597952, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Unnamed lift #12',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:45.8449398, lng:11.4998899, label:'Valley/lower station' },
    to:   { lat:45.8541923, lng:11.498549, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Franzin',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.4225336, lng:11.5875612, label:'Valley/lower station' },
    to:   { lat:46.4148893, lng:11.6010121, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funivia delle mele',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.2986858, lng:11.0845265, label:'Valley/lower station' },
    to:   { lat:46.2993993, lng:11.0737279, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Unnamed lift #13',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.0753968, lng:8.7777459, label:'Valley/lower station' },
    to:   { lat:46.0758524, lng:8.7798427, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Lacedel-Socrepes',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.5351927, lng:12.1209624, label:'Valley/lower station' },
    to:   { lat:46.5321735, lng:12.1045084, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: '(progetto) Ciuk-La Rocca (near 46.4490511°N, 10.3922565°E)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4490511, lng:10.3922565, label:'Valley/lower station' },
    to:   { lat:46.4420447, lng:10.3987511, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Col Rodella',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.4744925, lng:11.7466991, label:'Valley/lower station' },
    to:   { lat:46.4958585, lng:11.7512895, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Francolini - Sommo Alto',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:45.9071957, lng:11.1811444, label:'Valley/lower station' },
    to:   { lat:45.8871782, lng:11.200967, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Moena-Valbona',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.3578044, lng:11.6841868, label:'Valley/lower station' },
    to:   { lat:46.3741368, lng:11.657893, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: '(progetto) Ciuk-La Rocca (near 46.4420447°N, 10.3987511°E)',
    liftType: 'chair_lift',
    status: 'unknown',
    from: { lat:46.4420447, lng:10.3987511, label:'Valley/lower station' },
    to:   { lat:46.4352257, lng:10.4047551, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Unnamed lift #14',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.0745686, lng:9.3650332, label:'Valley/lower station' },
    to:   { lat:46.0698861, lng:9.3642501, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Privatseilbahn Rabenstein',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.6744571, lng:11.0542877, label:'Valley/lower station' },
    to:   { lat:46.6798973, lng:11.045083, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Naifjoch - Passo di Nova II',
    liftType: 'gondola',
    status: 'unknown',
    from: { lat:46.6827051, lng:11.2640116, label:'Valley/lower station' },
    to:   { lat:46.6854471, lng:11.2725808, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Seilbahn Sulden - Funivia Solda II',
    liftType: 'cable_car',
    status: 'unknown',
    from: { lat:46.5033951, lng:10.5973197, label:'Valley/lower station' },
    to:   { lat:46.4910644, lng:10.5986686, label:'Mountain/upper station' },
    note: 'Operating season not recorded — check directly with the operator before planning around it.',
  },
  {
    name: 'Funiplagne Grande Rochette',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.5052883, lng:6.6771972, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4916746, lng:6.6843117, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'TPH Plan de l\'Aiguille',
    liftType: 'cable_car',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.9181363, lng:6.8701383, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.9016501, lng:6.884819, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch. DOGS NOT PERMITTED (explicit OSM tag: dog=no).',
  },
  {
    name: 'Brévent',
    liftType: 'cable_car',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.9355164, lng:6.8538115, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.9333613, lng:6.8378907, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Varet',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.5694725, lng:6.8280883, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.5547291, lng:6.8359554, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Vallandry',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.5565078, lng:6.7628263, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.5509259, lng:6.7872815, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Aiguille Rouge',
    liftType: 'cable_car',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.554457, lng:6.8362138, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.5516603, lng:6.8474821, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Caron',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.2942801, lng:6.5645469, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.2807705, lng:6.5626342, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Cime Caron',
    liftType: 'cable_car',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.2805688, lng:6.5626129, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.2638718, lng:6.5602865, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Roc 1',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.3224768, lng:6.5389369, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3304286, lng:6.5547509, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Cairn',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.2942801, lng:6.5645469, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.2986423, lng:6.5777589, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Grand Fond',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.2809651, lng:6.5681663, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.2662766, lng:6.5804175, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Moraine',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.2876951, lng:6.583316, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.2728223, lng:6.6061673, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Funitel 3 Vallées',
    liftType: 'cable_car',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.3050295, lng:6.5859941, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3123699, lng:6.5817855, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Caboche',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.8451662, lng:6.6254394, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.8324734, lng:6.6143584, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Chamois',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.8556776, lng:6.6180134, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.8454539, lng:6.6252219, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Mont d\'Arbois',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.8534624, lng:6.6322539, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.8585048, lng:6.6620103, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Princesse',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.8724214, lng:6.6507958, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.858872, lng:6.6622063, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Rocharbois',
    liftType: 'cable_car',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.8538949, lng:6.6320368, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.8453406, lng:6.6255988, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'TCD10 des Boisses',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4981344, lng:6.923439, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4902967, lng:6.9150933, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Daille',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4607613, lng:6.9638199, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4570123, lng:6.9433084, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Tovière',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4682354, lng:6.9072263, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4558044, lng:6.9196246, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Grande Motte',
    liftType: 'cable_car',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4233091, lng:6.8904986, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4135843, lng:6.874556, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Charamillon',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.0041261, lng:6.9473757, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.014816, lng:6.9562686, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Bochard',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.967907, lng:6.9429426, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.9480472, lng:6.9450535, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Grande Terche',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.2260879, lng:6.641346, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.2148862, lng:6.6318332, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Bruyères 2',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.3127643, lng:6.5583739, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3183164, lng:6.5785629, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Mont Vallon',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.3412645, lng:6.5901854, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3285956, lng:6.609598, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Pas du Lac 1',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.3721291, lng:6.5800972, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3799106, lng:6.5970627, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Pas du Lac 2',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.3799106, lng:6.5970627, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3812169, lng:6.6094865, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Vizelle',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.395786, lng:6.6202085, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3824756, lng:6.6151434, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Prarion',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.8946008, lng:6.7816415, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.8862349, lng:6.7531066, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Bellevue',
    liftType: 'cable_car',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.8895997, lng:6.7888652, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.8738372, lng:6.7793163, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'La Tania',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.431493, lng:6.5977912, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4172104, lng:6.6093018, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Chenus',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4145633, lng:6.6321542, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4063389, lng:6.6140792, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Tougnète 1',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.3908767, lng:6.5680234, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3771527, lng:6.5634756, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Rhodos 1',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.3920637, lng:6.5681967, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3939363, lng:6.5756206, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Saint Martin 1',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.3767064, lng:6.5045641, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3731997, lng:6.5286071, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Super-Châtel',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.2666962, lng:6.8423985, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.2675721, lng:6.8572178, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Téléphérique du Salève',
    liftType: 'cable_car',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.154406, lng:6.1931816, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.1627403, lng:6.1891515, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Flégère',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.9417715, lng:6.8852832, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.9603353, lng:6.8870417, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Ruelle',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.7727537, lng:6.6409716, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.777631, lng:6.6532448, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Jardin Alpin',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4147924, lng:6.6336146, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4010527, lng:6.6296623, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Ariondaz',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4171243, lng:6.6522707, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3957608, lng:6.6573807, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Croisette',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.319379, lng:6.5348985, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3219275, lng:6.5378023, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Saulire Express 1',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.3914274, lng:6.5671107, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3892763, lng:6.5880518, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Grangettes',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4216615, lng:6.642649, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4152257, lng:6.633353, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Vercland',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.0720838, lng:6.7005513, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.0535282, lng:6.6980114, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Kédeuze',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.0247055, lng:6.6444364, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.0263755, lng:6.6653107, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Beauregard',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.9032051, lng:6.4222491, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.8939684, lng:6.4068066, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Patinoire',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.9034135, lng:6.4224148, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.9024015, lng:6.4283579, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Transval',
    liftType: 'cable_car',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.8860092, lng:6.4340116, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.8834389, lng:6.4302316, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Fernuy',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.9100456, lng:6.4669304, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.891236, lng:6.4628756, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Balme',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.9100263, lng:6.4675544, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.9004988, lng:6.4812522, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Fornet',
    liftType: 'cable_car',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4503626, lng:7.0115654, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4427042, lng:7.0175949, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Vallon de l\'Iseran',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4425263, lng:7.01774, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.420882, lng:7.0332749, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Télébenne de Flaine Supérieur',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.0045576, lng:6.6958257, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.0052515, lng:6.6981867, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Mont Bochor',
    liftType: 'cable_car',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.3807635, lng:6.7222601, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3862701, lng:6.730291, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Pléney',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.1799048, lng:6.7019377, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.1695975, lng:6.6925855, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Côte du Bois',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.2546739, lng:6.2568656, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.2509676, lng:6.2473067, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Panthiaz',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.2911379, lng:6.7997934, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.3013315, lng:6.8120723, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Olympique',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4467218, lng:6.97622, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.442977, lng:6.9514922, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Nyon',
    liftType: 'cable_car',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.1669618, lng:6.7155772, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.157937, lng:6.7135193, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Jaillet',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.8647091, lng:6.6179887, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.8696646, lng:6.5998656, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Vallorcine',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.0334468, lng:6.9332136, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.0297618, lng:6.9493543, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Beauregard',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.8916445, lng:6.6220775, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.8796593, lng:6.6036791, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'L\'Alpin',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.8906495, lng:6.7080764, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.8748019, lng:6.6858677, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Princesse',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.880035, lng:6.6412249, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.8724214, lng:6.6507958, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Bettex - Arbois',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.8748914, lng:6.6854378, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.8552765, lng:6.669294, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Olympe 2',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4283625, lng:6.55757, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4080693, lng:6.5608801, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Les Coches',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.55921, lng:6.7343809, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.5536297, lng:6.7329654, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Vanoise Express 1',
    liftType: 'cable_car',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.549238, lng:6.7394277, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.5510663, lng:6.7632359, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Val Cenis le Haut',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.2906977, lng:6.918471, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.2849922, lng:6.9199502, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Vieux Moulin',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.2882568, lng:6.9041985, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.2749078, lng:6.9224676, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'TCD Sétaz',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.1625933, lng:6.4294581, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.1508128, lng:6.4348959, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'TCD8 Crêt de la Brive',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.1648221, lng:6.4309139, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.1619706, lng:6.4520007, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Cabriolet',
    liftType: 'cable_car',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.5718007, lng:6.8285396, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.5705782, lng:6.8307266, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Chavannes',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.1569639, lng:6.6687291, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.1502844, lng:6.6854888, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Mont Chéry',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.1607738, lng:6.6697611, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.1654621, lng:6.6586983, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Super-Morzine',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.1835453, lng:6.7035371, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.1911508, lng:6.7179166, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Preyerand',
    liftType: 'cable_car',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.3270294, lng:6.5351097, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.325504, lng:6.539131, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Télémétro',
    liftType: 'cable_car',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.5064923, lng:6.6765609, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.5110851, lng:6.665319, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Télécabine des Mémises',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.3904436, lng:6.7171958, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.3797758, lng:6.7235372, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Essert',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.2756646, lng:6.7210793, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.2649697, lng:6.7053045, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Panoramic Mont Blanc',
    liftType: 'cable_car',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.8460038, lng:6.9316539, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.8787696, lng:6.8879441, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch. DOGS NOT PERMITTED (explicit OSM tag: dog=no).',
  },
  {
    name: 'Téléphérique de service Barberine - Col de la Gueulaz',
    liftType: 'cable_car',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.0676169, lng:6.9356569, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.0505636, lng:6.9407514, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Saulire',
    liftType: 'cable_car',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.3964285, lng:6.6194946, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.383432, lng:6.6105018, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Télébourg',
    liftType: 'cable_car',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4620032, lng:6.4450677, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4588024, lng:6.4405954, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Verdons',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4147918, lng:6.6330778, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3962146, lng:6.6203154, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Rosières',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.7373887, lng:6.5052948, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.7469548, lng:6.5058067, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Chalets',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.3741118, lng:6.5801251, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3739233, lng:6.5731435, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Côte Brune',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.3361082, lng:6.5818017, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3192949, lng:6.579947, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Thorens',
    liftType: 'cable_car',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.2722456, lng:6.5918145, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.2659211, lng:6.5952763, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Montjoie',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.8114861, lng:6.7229938, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.8031049, lng:6.713541, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'La Gorge',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.8009628, lng:6.7198467, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.8027562, lng:6.7141827, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Signal',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.8028539, lng:6.7132471, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.7871796, lng:6.694408, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Saulire Express 2',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.3892763, lng:6.5880518, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3833503, lng:6.6101322, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Mélézet',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.200347, lng:6.6967051, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.1884042, lng:6.7001919, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Rosay',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.944952, lng:6.4349371, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.9588397, lng:6.4556527, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Télébus',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.5073542, lng:6.6785053, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.5063018, lng:6.6840141, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Rochebrune',
    liftType: 'cable_car',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.8498127, lng:6.6150849, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.8332674, lng:6.6132762, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Grand Massif Express',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.0765273, lng:6.7212323, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.0554664, lng:6.70232, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Planpraz',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.9240381, lng:6.8631901, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.9358506, lng:6.8525898, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Aup de Véran',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.0033983, lng:6.6916642, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.9860244, lng:6.7051374, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Morillon',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.081394, lng:6.6805757, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.0653095, lng:6.672816, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Lonzagne',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.5492133, lng:6.7540304, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.5508776, lng:6.7628432, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Joyère',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.9447434, lng:6.4354089, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.9490836, lng:6.4507454, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Grandes Platières',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.0041789, lng:6.6964849, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.9847294, lng:6.7221401, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Pierrafort',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4590975, lng:6.4431652, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4427336, lng:6.440974, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Celliers',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4788673, lng:6.4212659, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4766134, lng:6.4298412, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Super-Bissorte',
    liftType: 'cable_car',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.2031867, lng:6.5782628, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.1790843, lng:6.5756569, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Liaison Brévent - Flégère',
    liftType: 'cable_car',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.9559367, lng:6.8810135, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.9508327, lng:6.8721935, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Arrondaz',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.1726089, lng:6.6522915, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.1566707, lng:6.665186, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Prodains Express 3S',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.1889283, lng:6.7559532, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.1873975, lng:6.7748109, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Ligne de service Aiguille du Midi 1',
    liftType: 'cable_car',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.9171, lng:6.8712164, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.9016123, lng:6.885022, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'TPH Aiguille du Midi',
    liftType: 'cable_car',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.9014593, lng:6.8848818, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.8792938, lng:6.8869955, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch. DOGS NOT PERMITTED (explicit OSM tag: dog=no).',
  },
  {
    name: 'Téléphérique EDF',
    liftType: 'cable_car',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.7522322, lng:6.4356042, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.7579641, lng:6.434877, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Combelouvière',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4988886, lng:6.4546531, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4766599, lng:6.4301093, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Petit Moriond',
    liftType: 'cable_car',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4140969, lng:6.6495028, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4137888, lng:6.6512993, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Plan Joran',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.9790112, lng:6.9282173, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.9616911, lng:6.9405228, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Villards',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.5719807, lng:6.7790284, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.5708751, lng:6.7862002, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Plattieres',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.3710822, lng:6.5806646, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3435459, lng:6.5774816, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Montalbert',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.5345329, lng:6.6371345, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.5167143, lng:6.6497538, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Dahu',
    liftType: 'cable_car',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.5741035, lng:6.779974, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.5733283, lng:6.7855722, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Ardent',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:46.2137817, lng:6.7609866, label:'Station A (order not elevation-verified)' },
    to:   { lat:46.2079166, lng:6.7781291, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Solaise',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.446871, lng:6.9774546, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4321375, lng:6.9938219, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'TCD8 des Brévières',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.5062375, lng:6.9211432, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4983608, lng:6.9233235, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Lac Noir',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.5532234, lng:6.7316394, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.5392243, lng:6.7235096, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Télébuffette',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.5542561, lng:6.7284503, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.5533717, lng:6.7317976, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Funitel Péclet',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.2954658, lng:6.5758899, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.2916481, lng:6.6143849, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Praz',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4316468, lng:6.6192386, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4163953, lng:6.6347955, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Télécabine d\'Orelle-Caron',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.2462188, lng:6.5695936, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.2631082, lng:6.5598364, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Le Bois',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.6709734, lng:6.5415494, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.6660536, lng:6.5645349, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Vanoise Express 2',
    liftType: 'cable_car',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.5511328, lng:6.7632217, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.5493248, lng:6.7394204, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Belle Plagne',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.5123363, lng:6.6971317, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.5072659, lng:6.7075682, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Champagny',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4562172, lng:6.6931264, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4720742, lng:6.6944497, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Pointe de la Masse',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.3184145, lng:6.5353711, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.2967901, lng:6.5095438, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Télétraineau (installé en hiver)',
    liftType: 'cable_car',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.8091885, lng:6.519146, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.8088403, lng:6.5197952, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Le Valléen',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.9059848, lng:6.6998251, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.8909264, lng:6.7082205, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Planchamp',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4609125, lng:6.4414422, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.449549, lng:6.4242536, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'TC Mer de Glace',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.9310443, lng:6.9179368, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.9269267, lng:6.9216343, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Glaciers 1',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4909169, lng:6.7483889, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4935326, lng:6.7357723, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Glaciers 2',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4909214, lng:6.7485581, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4971959, lng:6.7726917, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Télécabine d\'Orelle',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.2076779, lng:6.5461498, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.2461581, lng:6.5698878, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Rhodos 2',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.3939363, lng:6.5756206, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.396414, lng:6.5855956, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Bruyères 1',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.3122463, lng:6.5425403, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3127643, lng:6.5583739, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Olympe 1',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4504866, lng:6.5657205, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4283625, lng:6.55757, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Olympe 3',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4080693, lng:6.5608801, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.3944767, lng:6.5655913, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Glaciers',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4909169, lng:6.7483889, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4909214, lng:6.7485581, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Face Nord',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.275896, lng:6.5988572, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.2661442, lng:6.5958292, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Deux Lacs',
    liftType: 'gondola',
    status: 'summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.2963684, lng:6.5713448, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.2819943, lng:6.5740017, label:'Station B (order not elevation-verified)' },
    note: 'Open in summer (confirmed via OSM tagging). Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Transarc II',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.5628936, lng:6.7946153, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.550533, lng:6.8100025, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Transarc I',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.5713797, lng:6.7791474, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.5628936, lng:6.7946153, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Villaroger',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.5945745, lng:6.8640429, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.5837877, lng:6.8434463, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'TCD10 Logère',
    liftType: 'gondola',
    status: 'no-summer',
    country: 'FR', region: 'Savoie',
    from: { lat:45.7936511, lng:6.5043828, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.7870704, lng:6.521994, label:'Station B (order not elevation-verified)' },
    note: 'Not open in summer (confirmed via OSM tagging) - winter/ski-season only. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Roche de Mio 1',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.5119796, lng:6.6971794, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4950163, lng:6.701089, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Roche de Mio',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.4950163, lng:6.701089, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.494833, lng:6.701391, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Roche de Mio 2',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.494833, lng:6.701391, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.4940166, lng:6.7341944, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Télécabine de Lognan',
    liftType: 'gondola',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.968817, lng:6.9432808, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.9785649, lng:6.9265841, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
  {
    name: 'Turra',
    liftType: 'cable_car',
    status: 'unknown',
    country: 'FR', region: 'Savoie',
    from: { lat:45.2681786, lng:6.8981951, label:'Station A (order not elevation-verified)' },
    to:   { lat:45.2653064, lng:6.8879103, label:'Station B (order not elevation-verified)' },
    note: 'Operating season not recorded - check directly with the operator before planning around it. Station order (from/to) reflects raw OSM way direction, NOT independently verified against elevation - treat the endpoint labels as unconfirmed for this batch.',
  },
];

// NOT included: "Mont Sëuc" (Ortisei's other Alpe di Siusi gondola). Its
// OSM geometry ends ~5.5km short of Compatsch — the only nearby feature is
// a chairlift, not a connecting gondola stage — so this may only be one
// stage of a multi-stage system, not the full Ortisei-to-Compatsch run
// described in tourism sources. Left out rather than risk showing a route
// that doesn't actually go where its name implies. Worth real verification
// before adding.
