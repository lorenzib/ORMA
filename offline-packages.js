(function(){
  'use strict';

  // Every trail with a package under offline/packages/: the two pilots and
  // each Verified trail. Written by scripts/build-offline-packages.js from the
  // manifests; do not edit the block by hand.
  // <offline-package-registry>
  const PACKAGE_NAMES = {
    'alpe-siusi': "Alpe di Siusi Meadow Loop",
    'altabadia-da-furnacia-a-la-crusc': "Furnacia – La Crusc",
    'altabadia-da-san-cassiano-al-pralongia-fino-a-corvara': "San Cassiano – Pralongiá – Corvara",
    'altabadia-escursione-corvara-colfosco': "Corvara – Colfosco",
    'altabadia-escursione-corvara-la-villa': "Corvara – La Villa",
    'altabadia-passeggiata-borest-cascate-del-pisciadu': "Borest – Pisciadú waterfall",
    'altabadia-sentiero-degli-artisti-tru-di-artisc': "Tru di artisć",
    'aosta-champoluc-cascata-mascognaz': "Champoluc – Mascognaz waterfall",
    'aosta-periasc-antagnod': "Périasc – Antagnod",
    'aosta-ru-courtaud': "Rû Courtaud",
    'aosta-sentiero-della-regina': "Sentiero della Regina",
    'aosta-strada-lombarda': "Strada Lombarda",
    'aosta-villaggi-di-alpenzu-piccolo-e-alpenzu-grande': "Alpenzù Piccolo and Alpenzù Grande",
    'campiglio-escursione-a-malga-ritort-da-madonna-di-campiglio': "Madonna di Campiglio – Malga Ritort",
    'campiglio-laghi-di-san-giuliano-garzone-e-vacarsa': "San Giuliano, Garzonè and Vacarsa lakes",
    'campiglio-madonna-di-campiglio-monte-spinale': "Madonna di Campiglio – Monte Spinale",
    'campiglio-monte-spinale-rifugio-graffer': "Monte Spinale – Rifugio Graffer",
    'campiglio-trekking-al-lago-di-nambino': "Lago di Nambino",
    'campiglio-trekking-al-rifugio-segantini': "Rifugio Segantini loop",
    'campiglio-valina-d-amola-rifugio-segantini-cornisello': "Valina d’Amola – Segantini – Cornisello",
    'cembra-dos-paion': "Passeggiata al belvedere del Dos Paion sul Monte Corona",
    'cembra-erbe-della-salute': "Le erbe della salute",
    'cembra-giro-masi-grumes': "Il Giro dei Masi di Grumes",
    'cembra-lago-lases-buse-giaz': "Il Lago di Lases e le buse del giaz",
    'cembra-lago-santo': "Il Lago Santo",
    'cembra-monte-pat-malga-vernera': "Dalla Baita Monte Pat a Malga Vernera",
    'cembra-pascoli-malga-vernera': "Sui Pascoli di Malga Vernera",
    'cembra-pietra-del-futuro': "La pietra del futuro - Percorso con audioguida dei ragazzi della scuola elementare di Lona Lases",
    'cembra-piz-de-le-agole': "Il Piz de le Agole, balcone sulla valle",
    'cembra-rifugio-potzmauer': "Al Rifugio Potzmauer",
    'cinque-torri-assisted': "Cinque Torri three-refuges assisted circuit",
    'cortina-castello-di-botestagno': "Castello di Botestagno",
    'cortina-mortisa-e-le-grotte-di-volpera': "Mortisa e le Grotte di Volpera",
    'cortina-sotecordes': "Escursione di Sotecordes",
    'fassa-alpe-di-fuciade': "Alpe di Fuciade",
    'fassa-antichi-bagnes': "Agli antichi Bagnes",
    'fassa-borgo-dei-patins': "Vigo, borgo dei patins",
    'fassa-borgo-di-tamion': "Alla scoperta del borgo ladino di Tamion",
    'fassa-da-alba-a-penia': "Da Alba a Penìa",
    'fassa-dipinti-del-giotto': "Sulle tracce dei dipinti del Giotto della Val di Fassa",
    'fassa-malga-aloch': "Malga Aloch e Masc Aloch",
    'fassa-moena-soraga-acqua': "Da Moena a Soraga, dove l'acqua ha segnato la storia",
    'fassa-moena-soraga-someda': "Da Moena a Soraga, la natura a due passi da casa",
    'fassa-passato-ritrovato': "Il passato ritrovato",
    'fassa-pastori-erranti': "Sulla via degli antichi pastori erranti",
    'fassa-prato-di-sorte': "Prato di Sorte",
    'fassa-santuario-dei-pellegrini': "Al santuario di Santa Giuliana",
    'fassa-sentiero-della-foresta': "Sentiero della Foresta",
    'fassa-val-freida': "Sulle tracce dei pastori all'imbocco della Val Freida",
    'fiemme-cascatelle-di-ziano': "Le Cascatelle di Ziano di Fiemme",
    'fiemme-cavalese-passeggiata-panoramica': "Cavalese - Passeggiata panoramica",
    'fiemme-larici-verso-anterivo': "Passeggiata col passeggino tra i larici verso Anterivo",
    'fiemme-pradi-da-le-fior': "I Pradi da le Fior",
    'fiemme-scalata-alle-malghette': "La “scalata” alle Malghette",
    'fiemme-sentiero-botanico': "Sentiero botanico naturalistico",
    'fvg-anello-lago-di-verzegnis': "Anello del Lago di Verzegnis",
    'fvg-borgo-stavoli-moggio': "Il borgo isolato di Stavoli di Moggio",
    'fvg-fontanon-di-goriuda': "Fontanon di Goriuda",
    'fvg-lago-di-sella-sompdogna': "Il laghetto di sella Sompdogna",
    'fvg-monte-rest-da-passo-rest': "Dal Passo Rest al Monte Rest",
    'fvg-sappada-rifugio-calvi': "Rifugio Calvi",
    'giro-del-bulacia': "Giro della Bullaccia",
    'giudicarie-senter-dei-popi-madonna-del-lares': "Senter dei Popi – Madonna del Lares",
    'kronplatz-attraverso-il-sentiero-panoramico-a-brunico': "Panoramic path from Olang to Bruneck",
    'kronplatz-escursione-da-antermoia-attraverso-colac-val-a-rina': "Antermoia to Rina",
    'kronplatz-passeggiata-leggendaria-sul-kienberg': "The Kienberg legends loop",
    'kronplatz-passeggiata-san-vigilio-le-dla-creda': "San Vigilio to Lé dla Creda",
    'kronplatz-passeggiata-senza-barriere-brach-pieve-di-marebbe': "Brach to Pieve di Marebbe",
    'kronplatz-passeggiata-valdaora-monguelfo': "Olang to Welsberg by the reservoir",
    'kronplatz-san-lorenzo-maria-sares': "San Lorenzo to Maria Sares",
    'kronplatz-sentiero-della-roggia-a-gais-sentieri-degli-elementi': "The Gais channel path loop",
    'kronplatz-valdaora-di-sopra-goste': "Valdaora di Sopra to the Alte Goste",
    'kronplatz-valdaora-di-sotto-casola-bagni-di-pervalle': "Valdaora di Sotto to Bad Bergfall",
    'lago-braies': "Lago di Braies Seeweg circuit",
    'lago-carezza': "Lago di Carezza Loop",
    'lario-anello-ai-piedi-del-monte-oriolo': "Lasnigo, Barni and the Crezzo lake",
    'lario-caslino-sullacqua': "Caslino d’Erba and the Lambro",
    'lario-il-sentiero-del-viandante': "Sentiero del Viandante: Varenna – Bellano",
    'lario-salendo-al-monte-scioscia-ad-ammirare-la-brianza': "Monte Scioscia viewpoint loop",
    'lesachtal-spazierweg-maria-luggau-gailweg': "Gail river walk, Maria Luggau",
    'lesachtal-tuffbad': "Tuffbad loop, Lesachtal",
    'nuvolau': "Passo Giau to Rifugio Nuvolau",
    'osm-10116380': "Itinéraire découverte de la nature",
    'osm-10220399': "Martinsweg",
    'osm-10539302': "Sentier éco-sylve de Poingt-Ravier",
    'osm-11270309': "Passeggiata delle Sorgenti - Quellenpromenade",
    'osm-11517208': "La Croix des Salles",
    'osm-11764094': "Dörferrunde: Natz, Raas, Schabs and Viums",
    'osm-11768853': "Panoramaweg in Feldthurns",
    'osm-11775760': "Carl-Toldt-Weg",
    'osm-11775923': "Törggeleweg",
    'osm-11780502': "Naturerlebnispfad Zans",
    'osm-11791915': "Dorfrundweg Aicha",
    'osm-11795251': "Dörferrundweg (Vintl)",
    'osm-11814834': "Geotrail Bula - Pufels - Bulla",
    'osm-11828233': "Valser Rundweg",
    'osm-11832013': "Seerundweg",
    'osm-11833313': "Römerweg Kiens",
    'osm-11839597': "Fenn Promenade",
    'osm-11860429': "Roda dles Viles",
    'osm-12118490': "Le Balcon des Plagnes",
    'osm-12121346': "Le tour des hameaux de Montandré, Champessuit et Grenis",
    'osm-12121798': "Le terroir de Serpolière",
    'osm-12142337': "Rundweg Peitlerkofel",
    'osm-12150790': "Giro dei Capitelli - Kapellenrunde",
    'osm-12164395': "Dörferrundweg",
    'osm-12172440': "Natur- und Kulturweg",
    'osm-12173549': "Mühlenweg",
    'osm-12173965': "Kleine Schlossrunde",
    'osm-12173984': "Große Schlossrunde",
    'osm-12182895': "Talrundweg",
    'osm-12190657': "Rundweg Langfenn",
    'osm-12302137': "Dorfrundweg Mittertal",
    'osm-12302182': "Dorfrundweg Niedertal",
    'osm-12302191': "Dorfrundweg Rasen",
    'osm-123162': "Planetenweg - Sentiero dei pianeti",
    'osm-12731853': "Rundweg Laugen Elvas",
    'osm-12736753': "Albeins-Klerant-Milland - Albes-Cleran-Millan",
    'osm-12737724': "Historische Rundwanderung Teis",
    'osm-12745924': "Circuit des escaliers",
    'osm-12953352': "Archeopfad Brixen",
    'osm-13338113': "Lac de Darbon",
    'osm-13491868': "Birmehlweg - Sentiero Birmehl",
    'osm-14095296': "Les Marais d'Albens",
    'osm-14375158': "Crêt de la Parenche",
    'osm-14376573': "Crêt de Talière",
    'osm-14378946': "Lac de Pramol",
    'osm-14379010': "Croix de Pralognan",
    'osm-14381570': "Albanne",
    'osm-14381584': "Beaumollard",
    'osm-14864704': "Boucle du Taillefer",
    'osm-1506470': "Sissiweg - Sentiero Sissi",
    'osm-15591346': "Sentier des Buis",
    'osm-15791408': "Giro di Bedolpian",
    'osm-16180587': "Balade du Plateau d'Assy au Lac Vert",
    'osm-16218739': "Circuit du Ragairon",
    'osm-16322228': "Boucle du Marais des Chassettes",
    'osm-16365005': "La Galoppaz par la Combe Servenne",
    'osm-16395076': "Boucle du Lac de la Thuile",
    'osm-1671736': "Höfeweg",
    'osm-18055492': "Le Mont d'Arbois - Mont Joux",
    'osm-19064561': "Ombres sur l'Alpage",
    'osm-19153189': "Le Belvédère (Saint-Pierre-d'Albigny)",
    'osm-19330972': "Dorfrundweg - Giro del Paese",
    'osm-19541366': "Lac Blanc",
    'osm-19703479': "Rundweg Beimsteinkogel",
    'osm-19855818': "Boucle des cascades",
    'osm-19974724': "Mittlerer Rundweg am Karer See",
    'osm-19974725': "Langer Rundweg am Karer See",
    'osm-20380913': "Hinzlweg",
    'osm-2376630': "Rundweg Katharinaberg",
    'osm-3202880': "Rundweg Montiggler Seen",
    'osm-3707731': "Gratschenbergrunde",
    'osm-3885162': "Seeweg, Val d'Ultimo",
    'osm-3982382': "Circuit Béatrice de Savoie",
    'osm-5479112': "Chemin des Diligences",
    'osm-5512443': "Wallburgweg",
    'osm-5597577': "Rundweg Gsindboden",
    'osm-6244965': "Steine erzählen",
    'osm-6250300': "Boucle du Lac Vert",
    'osm-6401355': "Panoramarundweg Concordia 360°",
    'osm-6404258': "Rundweg Salla",
    'osm-6410700': "Dolomitenblickrunde",
    'osm-6453504': "Walderlebnispfad Aschbach",
    'osm-6601608': "Naturerlebnispfad Sand in Taufers",
    'osm-7045225': "Giro del Fausior",
    'osm-7424683': "Marlinger Waalweg",
    'osm-7426648': "Algunder Waalweg",
    'osm-7426666': "Maiser Waalweg",
    'osm-7446701': "Waltner Rundweg 18",
    'osm-7547653': "Anello dei Forti",
    'osm-7547983': "Anello di Valzalina",
    'osm-7548344': "Anello del Sole",
    'osm-7549783': "Anello del Troi de le Ciaure",
    'osm-7567918': "Seerundweg Antholzer See",
    'osm-7655311': "Sonnenberger Panoramaweg - Sentiero",
    'osm-8396539': "Kulturwanderweg Peter Mitterhofer",
    'osm-9450411': "Poststeig",
    'osm-9492594': "Vogelweider Rundweg",
    'osm-9493733': "Tru di Lëc",
    'osm-9511999': "Tru dles Viles",
    'osm-9648632': "Pana Raida",
    'osm-9937537': "Le Mont Jovet",
    'osttirol-kinder-naturerlebnispfad-kals-ag': "Children’s nature trail, Kals",
    'osttirol-naturkraftweg-umbalfaelle': "Umbal Falls nature walk",
    'osttirol-spazierweg-kreuzweg': "Kreuzweg to Klaunz, Matrei",
    'osttirol-spazierweg-nikolauskirche': "St. Nikolaus church walk, Matrei",
    'osttirol-themenweg-kreuzweg-virgen': "Kreuzweg to Maria Schnee, Virgen",
    'osttirol-weg-der-sinne-virgen': "Weg der Sinne, Virgen",
    'paganella-giro-della-toresela': "Giro della Toresela",
    'prato-piazza': "Prato Piazza (Plätzwiese)",
    'primiero-anello-di-valpiana': "Anello di Valpiana",
    'primiero-anello-molaren-via-nova-marine': "Anello Molaren - Via Nova - Marine",
    'primiero-fiera-pieve': "Fiera-Pieve",
    'primiero-la-guana-di-primiero': "La Guana di Primiero",
    'primiero-malga-ces': "San Martino di Castrozza - Malga Ces",
    'primiero-malga-valcigolera': "San Martino di Castrozza - Malga Valcigolera",
    'primiero-percorso-verde': "Percorso Verde (I percorsi del benessere)",
    'primiero-ponte-su-funi': "Ponte su Funi Rio San Piero da Mezzano",
    'primiero-san-martino-di-castrozza-val-di-roda-prati-col': "San Martino di Castrozza - Val di Roda - Prati Col",
    'primiero-siror': "Siror",
    'primiero-tonadico': "Tonadico",
    'primiero-transacqua': "Transacqua",
    'rendena-giro-del-belvedere-giustino': "Giro del Belvedere",
    'santa-maddalena': "Rundweg St. Magdalena",
    'sentiero-del-trenino': "Sentiero del Trenino",
    'sentiero-hans-e-paula-steger': "Sentiero Hans e Paula Steger",
    'tre-cime': "Tre Cime di Lavaredo classic circuit",
    'trecime-bagni-di-san-candido': "Wildbad Innichen",
    'trecime-bellavista-montecosta': "Niederdorf – Bellavista",
    'trecime-carbonin-rifugio-vallandro': "Schluderbach – Dürrensteinhütte",
    'trecime-cimabanche-prato-piazza': "Cimabanche – Plätzwiese",
    'trecime-dobbiaco-lago-di-dobbiaco': "Toblach – Lago di Dobbiaco",
    'trecime-gasthof-panorama-rifugio-pendio-monte-elmo': "Fort Mitterberg – Helmhanghütte",
    'trecime-giro-delle-baite-lago-di-braies': "Pragser Wildsee huts circuit",
    'trecime-haus-der-berge-rifugio-larice': "Haus der Berge – Lärchenhütte",
    'trecime-helmjet-waldruhe-sexten': "Helm – Waldruhe – Sexten",
    'trecime-innichen-waldkapelle-sexten': "Innichen – Waldkapelle – Sexten",
    'trecime-lago-di-braies-malga-foresta': "Lago di Braies – Grünwaldalm",
    'trecime-lago-di-braies-malga-rossalm': "Pragser Wildsee – Rossalm",
    'trecime-monte-casella-di-fuori': "Außergsell – Innergsell loop",
    'trecime-monte-elmo-da-moso': "Moos – Helm",
    'trecime-monte-elmo-versciaco': "Helm – Vierschach",
    'trecime-rotwandwiesen-moos': "Rotwandwiesen – Moos",
    'trecime-san-candido-costa-dei-nosellari-dobbiaco': "Innichen – Haselsberg – Toblach",
    'trecime-sasso-di-sesto': "Fischleintal – Sextner Stein",
    'trecime-sentiero-gustav-mahler': "Gustav Mahler path",
    'trecime-sesto-alte-saege-val-campo-di-dentro': "Sexten – Innerfeldtal",
    'trecime-sesto-cappella-del-bosco': "Sexten – Waldkapelle",
    'trecime-sesto-chiesa-gasthof-panorama': "Sexten – Gasthof Panorama",
    'trecime-sesto-san-candido': "Sexten – Innichen and back",
    'trecime-villabassa-lanaweg': "Niederdorf – Lanaweg loop",
    'trecime-villabassa-mooskirche': "Niederdorf – Mooskirche",
    'valdisole-bivacco-malga-baselga': "Bivacco Malga Baselga",
    'valdisole-fazzon-lago-dei-caprioli': "Rifugio Fazzon – Lago dei Caprioli",
    'valdisole-lago-dei-caprioli-malga-alta-di-fazzon': "Lago dei Caprioli – Malga Alta di Fazzon",
    'valdisole-marilleva-1400-malga-alta-di-fazzon': "Marilleva 1400 – Malga Alta di Fazzon",
    'valdisole-monclassico-presson-meridiane': "Monclassico and Presson, the sundial villages",
    'valdisole-ortise-malga-stabli': "Ortisè – Malga Stabli",
    'valdisole-passo-tonale-forte-mero': "Passo Tonale – Forte Mero",
    'valdisole-passo-tonale-forte-mero-forte-zaccarana': "Passo Tonale – Forte Mero and Forte Zaccarana",
    'valdisole-rifugio-stavel-denza': "Rifugio Stavel – Francesco Denza",
    'valgardena-escursione-al-brogles': "Resciesa – Brogles",
    'valgardena-escursione-al-resciesa': "Resciesa summit loop",
    'valgardena-escursione-al-seeurasas': "Ortisei – Sëurasas",
    'valgardena-escursione-al-terrazzo-panoramico-seeurasas': "Sëurasas",
    'valgardena-escursione-nella-vallunga': "Vallunga",
    'valgardena-giro-della-via-crucis': "Via Crucis, Santa Cristina",
    'valgardena-passeggiata-alla-chiesetta-di-san-giacomo': "San Giacomo from Ortisei",
    'valgardena-passeggiata-da-ortisei-a-s-cristina': "Ortisei valley promenade",
    'valgardena-raida-dl-luech-giro-del-paese': "Raida dl luech",
    'valgardena-seceda-da-col-raiser': "Col Raiser – Seceda",
    'valgardena-tour-alla-volta-del-lech-sant': "Lech Sant",
    'valgardena-uciei-de-freeines': "Uciei de Frëines",
    'valgardena-val-danna-percorso-kneipp': "Val d’Anna",
    'valley-view': "Val di Funes Panorama Trail",
    'weissensee-nordic-5-genoesns-bruendl': "Genösn’s Bründl loop, Weissensee",
    'weissensee-nordic-6-rothns-bichl': "Rothn’s Bichl loop, Weissensee",
    'weissensee-nordic-7-franz-josephs-hoehe': "Franz-Josephs-Höhe loop, Weissensee",
    'weissensee-nordic-8-naggler-alm': "Climb to the Naggler Alm, Weissensee",
    'weissensee-ortsee-ronacherfels': "Neusach to the east shore by the Kleine Steinwand, Weissensee",
    'weissensee-slow-trail': "Slow Trail Weissensee",
    'weissensee-techendorf-tschabitscher-kreuzwirt': "Techendorf to the Kreuzwirt, Weissensee",
  };
  // </offline-package-registry>
  const PACKAGES = Object.freeze(Object.fromEntries(Object.keys(PACKAGE_NAMES).map(trailId => [trailId, Object.freeze({
    name: PACKAGE_NAMES[trailId],
    manifestUrl: `/offline/packages/${trailId}/manifest.json`,
    trailUrl: `/trail.html?id=${trailId}`,
    offlineUrl: `/offline/trail.html?id=${trailId}`,
  })])));
  const CACHE_PREFIX = 'dolopaws-trail-';
  const METADATA_PREFIX = 'dolopaws-offline:';
  const OWNER_SALT_KEY = 'dolopaws-offline-owner-salt';
  const METADATA_DB_NAME = 'dolopaws-offline';
  const METADATA_DB_VERSION = 1;
  const METADATA_STORE = 'packages';
  const STORAGE_SAFETY_BYTES = 1024 * 1024;
  const PACKAGE_STATES = Object.freeze([
    'not-downloaded',
    'downloading',
    'ready',
    'stale',
    'incomplete',
    'update-available',
    'failed',
    'removed',
  ]);

  function tr(key, fallback, vars){
    if(typeof window.t === 'function'){
      const value = window.t(key, vars);
      if(value && value !== key) return value;
    }
    let output = fallback;
    for(const name of Object.keys(vars || {})){
      output = output.split(`{${name}}`).join(vars[name]);
    }
    return output;
  }

  function localizedOwnershipLabel(state){
    return tr(`downloads.owner.${state}`, ownershipLabel(state));
  }

  function bytesToHex(buffer){
    return Array.from(new Uint8Array(buffer))
      .map(value => value.toString(16).padStart(2, '0'))
      .join('');
  }

  async function sha256(buffer){
    if(!(window.crypto && window.crypto.subtle)){
      throw new Error(tr('offlinePanel.error.crypto', 'This browser cannot verify offline packages.'));
    }
    return bytesToHex(await window.crypto.subtle.digest('SHA-256', buffer));
  }

  function deviceOwnerSalt(){
    let salt = localStorage.getItem(OWNER_SALT_KEY);
    if(salt) return salt;
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    salt = bytesToHex(bytes);
    localStorage.setItem(OWNER_SALT_KEY, salt);
    return salt;
  }

  async function ownerMarkerFor(user){
    if(!(user && user.uid)) throw new Error(tr('offlinePanel.error.login', 'Log in to download this offline map.'));
    if(!(window.crypto && window.crypto.subtle && window.crypto.getRandomValues)){
      throw new Error(tr('offlinePanel.error.ownerMetadata', 'This browser cannot create private offline ownership metadata.'));
    }
    const input = new TextEncoder().encode(
      `dolopaws-owner-v1:${deviceOwnerSalt()}:${user.uid}`
    );
    return `v1:${await sha256(input)}`;
  }

  function metadataKey(trailId){
    return `${METADATA_PREFIX}${trailId}`;
  }

  function readLegacyPackageMetadata(trailId){
    try{
      const value = JSON.parse(localStorage.getItem(metadataKey(trailId)) || 'null');
      return value && typeof value === 'object' ? value : null;
    }catch(error){
      return null;
    }
  }

  function openMetadataDatabase(){
    if(!window.indexedDB) return Promise.reject(new Error('IndexedDB is unavailable.'));
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(METADATA_DB_NAME, METADATA_DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if(!database.objectStoreNames.contains(METADATA_STORE)){
          database.createObjectStore(METADATA_STORE, { keyPath:'trailId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB could not be opened.'));
      request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked.'));
    });
  }

  async function metadataOperation(mode, operation){
    const database = await openMetadataDatabase();
    try{
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(METADATA_STORE, mode);
        const store = transaction.objectStore(METADATA_STORE);
        const request = operation(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Offline metadata operation failed.'));
        transaction.onabort = () => reject(transaction.error || new Error('Offline metadata transaction was aborted.'));
      });
    }finally{
      database.close();
    }
  }

  async function readPackageMetadata(trailId){
    const legacy = readLegacyPackageMetadata(trailId);
    try{
      const stored = await metadataOperation('readonly', store => store.get(trailId));
      if(stored) return stored;
      if(!legacy) return null;
      const migrated = { ...legacy, trailId };
      await metadataOperation('readwrite', store => store.put(migrated));
      localStorage.removeItem(metadataKey(trailId));
      return migrated;
    }catch(error){
      return legacy;
    }
  }

  async function writePackageMetadata(trailId, metadata){
    const record = { ...metadata, trailId };
    try{
      await metadataOperation('readwrite', store => store.put(record));
      localStorage.removeItem(metadataKey(trailId));
    }catch(error){
      localStorage.setItem(metadataKey(trailId), JSON.stringify(metadata));
    }
    return record;
  }

  async function removePackageMetadata(trailId){
    try{
      await metadataOperation('readwrite', store => store.delete(trailId));
    }catch(error){ /* local cleanup still applies when IndexedDB is unavailable */ }
    localStorage.removeItem(metadataKey(trailId));
  }

  async function deleteMetadataDatabase(){
    if(!window.indexedDB) return false;
    return new Promise(resolve => {
      let request;
      try{ request = window.indexedDB.deleteDatabase(METADATA_DB_NAME); }
      catch(error){ resolve(false); return; }
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
      request.onblocked = () => resolve(false);
    });
  }

  function formatInstalledDate(value){
    const date = new Date(value);
    if(!value || Number.isNaN(date.getTime())) return 'date unavailable';
    try{
      return new Intl.DateTimeFormat(
        document.documentElement.lang || 'en-GB',
        { dateStyle: 'medium' }
      ).format(date);
    }catch(error){
      return date.toISOString().slice(0, 10);
    }
  }

  async function ownershipState(metadata, user){
    if(!(metadata && metadata.ownerMarker)) return 'legacy-owner-unknown';
    if(!(user && user.uid)) return 'signed-out-owner-retained';
    return metadata.ownerMarker === await ownerMarkerFor(user)
      ? 'current-account'
      : 'another-account';
  }

  function ownershipLabel(state){
    const labels = {
      'current-account': 'downloaded by this account',
      'another-account': 'downloaded by another account on this device',
      'signed-out-owner-retained': 'downloaded account retained on this device',
      'legacy-owner-unknown': 'download owner not recorded',
    };
    return labels[state] || labels['legacy-owner-unknown'];
  }

  function resourceUrl(resource, manifestUrl){
    return new URL(resource.url, new URL(manifestUrl, window.location.href)).href;
  }

  function cacheName(manifest){
    return `${CACHE_PREFIX}${manifest.trailId}-${manifest.version}`;
  }

  function resourceIsRequired(resource){
    return !resource || resource.required !== false;
  }

  function contentFreshnessState(manifest){
    const categories = manifest && manifest.evidence && manifest.evidence.categories;
    if(!categories || typeof categories !== 'object') return 'unknown';
    const states = Object.values(categories).map(category =>
      category && category.freshnessState || 'unknown'
    );
    if(states.includes('stale')) return 'stale';
    if(!states.length || states.includes('unknown')) return 'unknown';
    if(states.includes('aging')) return 'aging';
    return states.every(state => state === 'current') ? 'current' : 'unknown';
  }

  function validateManifest(manifest, expectedTrailId){
    if(!manifest || manifest.schemaVersion !== 1) throw new Error(tr('offlinePanel.error.format', 'Unsupported package format.'));
    if(manifest.trailId !== expectedTrailId) throw new Error(tr('offlinePanel.error.wrongTrail', 'Package trail does not match this page.'));
    if(
      !manifest.version ||
      !Number.isFinite(manifest.packageBytes) ||
      manifest.packageBytes <= 0 ||
      !Array.isArray(manifest.resources) ||
      !manifest.resources.length
    ){
      throw new Error(tr('offlinePanel.error.manifestIncomplete', 'Package manifest is incomplete.'));
    }
    for(const resource of manifest.resources){
      if(!resource.url || !resource.sha256 || !Number.isFinite(resource.bytes)){
        throw new Error(tr('offlinePanel.error.resourceInvalid', 'A required package resource is invalid.'));
      }
    }
    if(
      Number.isFinite(manifest.packageBudgetBytes) &&
      manifest.packageBytes > manifest.packageBudgetBytes
    ){
      throw new Error(tr('offlinePanel.error.budget', 'This offline package exceeds its declared storage budget.'));
    }
    return manifest;
  }

  function requiredStorageBytes(packageBytes){
    if(!Number.isFinite(packageBytes) || packageBytes <= 0) return STORAGE_SAFETY_BYTES;
    // Installation briefly holds the staging and committed copies together.
    return Math.ceil(packageBytes * 2) + STORAGE_SAFETY_BYTES;
  }

  async function storageCapacity(packageBytes){
    const requiredBytes = requiredStorageBytes(packageBytes);
    if(!(navigator.storage && typeof navigator.storage.estimate === 'function')){
      return { supported: false, enough: null, requiredBytes };
    }
    try{
      const estimate = await navigator.storage.estimate();
      if(!Number.isFinite(estimate.quota) || !Number.isFinite(estimate.usage)){
        return { supported: false, enough: null, requiredBytes };
      }
      const availableBytes = Math.max(0, estimate.quota - estimate.usage);
      return {
        supported: true,
        enough: availableBytes >= requiredBytes,
        requiredBytes,
        availableBytes,
      };
    }catch(error){
      return { supported: false, enough: null, requiredBytes };
    }
  }

  async function assertStorageCapacity(packageBytes){
    const capacity = await storageCapacity(packageBytes);
    if(capacity.enough !== false) return capacity;
    const error = new Error(
      tr('offlinePanel.error.storage', 'Not enough browser storage for this offline map. It needs about {required} free, but this browser reports {available}. Remove a saved offline map or free device storage, then retry.', {
        required:formatBytes(capacity.requiredBytes),
        available:formatBytes(capacity.availableBytes),
      })
    );
    error.name = 'DoloPawsStorageError';
    throw error;
  }

  function isQuotaError(error){
    return !!(
      error &&
      (
        error.name === 'QuotaExceededError' ||
        error.code === 22 ||
        error.code === 1014
      )
    );
  }

  async function fetchVerifiedResource(resource, manifestUrl){
    const url = resourceUrl(resource, manifestUrl);
    const response = await fetch(url, { cache: 'no-store' });
    if(!response.ok) throw new Error(tr('offlinePanel.error.resourceDownload', 'Could not download {resource}.', { resource:resource.label || resource.url }));
    const buffer = await response.arrayBuffer();
    if(buffer.byteLength !== resource.bytes){
      throw new Error(tr('offlinePanel.error.resourceSize', '{resource} has an unexpected size.', { resource:resource.label || resource.url }));
    }
    if(await sha256(buffer) !== resource.sha256){
      throw new Error(tr('offlinePanel.error.resourceVerification', '{resource} failed verification.', { resource:resource.label || resource.url }));
    }
    return {
      url,
      response: new Response(buffer, {
        status: 200,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
          'Content-Length': String(buffer.byteLength),
          'X-ORMA-Verified': 'sha256',
        },
      }),
    };
  }

  async function verifyCachedResource(cache, resource, manifestUrl){
    const url = resourceUrl(resource, manifestUrl);
    const response = await cache.match(url);
    if(!response) throw new Error(tr('offlinePanel.error.resourceMissing', '{resource} is missing from this device.', { resource:resource.label || resource.url }));
    const buffer = await response.arrayBuffer();
    if(buffer.byteLength !== resource.bytes){
      throw new Error(tr('offlinePanel.error.storedSize', '{resource} has an unexpected stored size.', { resource:resource.label || resource.url }));
    }
    if(await sha256(buffer) !== resource.sha256){
      throw new Error(tr('offlinePanel.error.checksum', '{resource} failed its stored checksum.', { resource:resource.label || resource.url }));
    }
    return { url, bytes: buffer.byteLength };
  }

  async function removeOlderVersions(trailId, keepName){
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(`${CACHE_PREFIX}${trailId}-`) && name !== keepName)
      .map(name => caches.delete(name)));
  }

  async function installPackage(trailId, onProgress, ownerUser){
    if(!('caches' in window)) throw new Error(tr('offlinePanel.error.storageUnsupported', 'Offline storage is not supported in this browser.'));
    const config = PACKAGES[trailId];
    if(!config) throw new Error(tr('offlinePanel.error.unavailable', 'No offline package is available for this trail.'));
    const ownerMarker = await ownerMarkerFor(ownerUser);

    if('serviceWorker' in navigator){
      await navigator.serviceWorker.register('/offline/offline-sw.js', { scope: '/offline/' });
    }else{
      throw new Error(tr('offlinePanel.error.reopenUnsupported', 'Offline reopening is not supported in this browser.'));
    }

    const manifestResponse = await fetch(config.manifestUrl, { cache: 'no-store' });
    if(!manifestResponse.ok) throw new Error(tr('offlinePanel.error.manifestDownload', 'The package manifest could not be downloaded.'));
    const manifest = validateManifest(await manifestResponse.clone().json(), trailId);
    await assertStorageCapacity(manifest.packageBytes);
    const name = cacheName(manifest);
    const temporaryName = `${name}-installing`;
    await caches.delete(temporaryName);
    const temporary = await caches.open(temporaryName);

    try{
      for(let index = 0; index < manifest.resources.length; index += 1){
        const resource = manifest.resources[index];
        if(onProgress) onProgress(index + 1, manifest.resources.length, resource);
        try{
          const verified = await fetchVerifiedResource(resource, config.manifestUrl);
          await temporary.put(verified.url, verified.response);
        }catch(error){
          if(resourceIsRequired(resource)) throw error;
          if(onProgress){
            onProgress(index + 1, manifest.resources.length, resource, 'optional-missing');
          }
        }
      }
      await temporary.put(
        new URL(config.manifestUrl, window.location.href).href,
        manifestResponse
      );

      await caches.delete(name);
      const destination = await caches.open(name);
      const requests = await temporary.keys();
      for(const request of requests){
        const response = await temporary.match(request);
        await destination.put(request, response);
      }
      await caches.delete(temporaryName);
      await removeOlderVersions(trailId, name);
      await writePackageMetadata(trailId, {
        cacheName: name,
        version: manifest.version,
        installedAt: new Date().toISOString(),
        packageBytes: manifest.packageBytes,
        verificationStatus: manifest.verificationStatus,
        ownerMarker,
      });
      return manifest;
    }catch(error){
      await caches.delete(temporaryName);
      if(isQuotaError(error)){
        throw new Error(tr('offlinePanel.error.storageRuntime', 'Your browser ran out of storage while saving this offline map. Remove a saved offline map or free device storage, then retry.'));
      }
      throw error;
    }
  }

  async function inspectPackage(trailId, onProgress){
    if(!('caches' in window)){
      return {
        state: 'failed',
        usable: false,
        hasLocalData: false,
        message: 'Offline storage is not supported in this browser.',
      };
    }
    const config = PACKAGES[trailId];
    if(!config){
      return { state: 'not-downloaded', usable: false, hasLocalData: false };
    }
    const names = await caches.keys();
    const incomplete = names.some(name =>
      name.startsWith(`${CACHE_PREFIX}${trailId}-`) && name.endsWith('-installing')
    );
    const candidates = names.filter(name =>
      name.startsWith(`${CACHE_PREFIX}${trailId}-`) && !name.endsWith('-installing')
    );
    const metadata = await readPackageMetadata(trailId);
    if(metadata && metadata.cacheName && candidates.includes(metadata.cacheName)){
      candidates.sort((first, second) =>
        first === metadata.cacheName ? -1 : second === metadata.cacheName ? 1 : 0
      );
    }
    let failureMessage = null;
    for(const name of candidates){
      const cache = await caches.open(name);
      const manifestResponse = await cache.match(new URL(config.manifestUrl, window.location.href).href);
      if(!manifestResponse){
        failureMessage = 'The stored package manifest is missing.';
        continue;
      }
      try{
        const manifest = validateManifest(await manifestResponse.json(), trailId);
        const required = manifest.resources.filter(resourceIsRequired);
        for(let index = 0; index < required.length; index += 1){
          if(onProgress) onProgress(index + 1, required.length, required[index]);
          await verifyCachedResource(cache, required[index], config.manifestUrl);
        }
        const freshness = contentFreshnessState(manifest);
        return {
          state: incomplete ? 'incomplete' : freshness === 'stale' ? 'stale' : 'ready',
          usable: true,
          hasLocalData: true,
          manifest,
          metadata,
          cacheName: name,
          requiredChecked: required.length,
          contentFreshness: freshness,
          checkedAt: new Date().toISOString(),
          message: incomplete
            ? 'A previous update was interrupted; the existing verified package remains usable.'
            : null,
        };
      }catch(error){
        failureMessage = error.message || 'A stored package resource failed verification.';
      }
    }
    if(candidates.length){
      return {
        state: 'failed',
        usable: false,
        hasLocalData: true,
        metadata,
        message: failureMessage || 'The stored package failed verification.',
      };
    }
    if(incomplete){
      return {
        state: 'incomplete',
        usable: false,
        hasLocalData: true,
        metadata,
        message: 'A previous download was interrupted. No partial package is ready offline.',
      };
    }
    return { state: 'not-downloaded', usable: false, hasLocalData: false, metadata };
  }

  async function verifyInstalledPackage(trailId, onProgress){
    return inspectPackage(trailId, onProgress);
  }

  async function installedPackageRecord(trailId){
    const inspection = await inspectPackage(trailId);
    if(!inspection.usable) return null;
    return {
      manifest: inspection.manifest,
      metadata: inspection.metadata,
      state: inspection.state,
      checkedAt: inspection.checkedAt,
      requiredChecked: inspection.requiredChecked,
      contentFreshness: inspection.contentFreshness,
    };
  }

  async function installedPackage(trailId){
    const record = await installedPackageRecord(trailId);
    return record ? record.manifest : null;
  }

  async function incompleteInstallation(trailId){
    if(!('caches' in window)) return false;
    const names = await caches.keys();
    return names.some(name =>
      name.startsWith(`${CACHE_PREFIX}${trailId}-`) && name.endsWith('-installing')
    );
  }

  async function availablePackage(trailId){
    const config = PACKAGES[trailId];
    if(!config) return null;
    const response = await fetch(config.manifestUrl, { cache: 'no-store' });
    if(!response.ok) return null;
    return validateManifest(await response.json(), trailId);
  }

  async function removePackage(trailId){
    if(!('caches' in window)) return;
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(`${CACHE_PREFIX}${trailId}-`))
      .map(name => caches.delete(name)));
    await removePackageMetadata(trailId);
  }

  async function removeAllPackages(){
    if('caches' in window){
      const names = await caches.keys();
      await Promise.all(names
        .filter(name => name.startsWith(CACHE_PREFIX))
        .map(name => caches.delete(name)));
    }
    for(const trailId of Object.keys(PACKAGES)){
      await removePackageMetadata(trailId);
    }
    await deleteMetadataDatabase();
    try{
      const keys = [];
      for(let index = 0; index < localStorage.length; index += 1){
        const key = localStorage.key(index);
        if(key && key.startsWith(METADATA_PREFIX)) keys.push(key);
      }
      keys.forEach(key => localStorage.removeItem(key));
      localStorage.removeItem(OWNER_SALT_KEY);
    }catch(error){ /* cache deletion remains the authoritative cleanup */ }
    return true;
  }

  async function listInstalledPackages(user){
    return (await listPackageStates(user)).filter(record => record.usable);
  }

  async function listPackageStates(user){
    const records = [];
    // A trail with no cache under its prefix is 'not-downloaded', which is
    // never listed. With every Verified trail registered, asking each one in
    // turn cost the page one metadata read per trail to list a handful.
    // Without Cache Storage nothing can have been downloaded at all.
    const cacheNames = 'caches' in window ? await caches.keys() : [];
    const stored = Object.keys(PACKAGES).filter(trailId =>
      cacheNames.some(name => name.startsWith(`${CACHE_PREFIX}${trailId}-`)));
    for(const trailId of stored){
      const config = PACKAGES[trailId];
      const inspection = await inspectPackage(trailId);
      if(inspection.state === 'not-downloaded') continue;
      let available = null;
      try{ available = await availablePackage(trailId); }catch(error){ /* offline is expected */ }
      const manifest = inspection.manifest;
      const updateAvailable = !!(
        manifest && available && available.version !== manifest.version
      );
      records.push({
        trailId,
        name: config.name,
        trailUrl: config.trailUrl,
        offlineUrl: config.offlineUrl,
        version: manifest && manifest.version || null,
        packageBytes: manifest && manifest.packageBytes ||
          inspection.metadata && inspection.metadata.packageBytes || null,
        installedAt: inspection.metadata && inspection.metadata.installedAt || null,
        verificationStatus: manifest && manifest.verificationStatus ||
          inspection.metadata && inspection.metadata.verificationStatus || null,
        // What the trail's latest package says, when the network allows reading
        // it: a map downloaded before OFF-08 carries a retired label.
        currentVerificationStatus: available && available.verificationStatus || null,
        ownership: await ownershipState(inspection.metadata, user),
        state: ['ready', 'stale'].includes(inspection.state) && updateAvailable
          ? 'update-available'
          : inspection.state,
        stateMessage: inspection.message,
        usable: inspection.usable,
        hasLocalData: inspection.hasLocalData,
        updateAvailable,
        requiredChecked: inspection.requiredChecked || 0,
        contentFreshness: inspection.contentFreshness || 'unknown',
        checkedAt: inspection.checkedAt || null,
      });
    }
    return records;
  }

  function formatBytes(bytes){
    if(!Number.isFinite(bytes)) return '';
    if(bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatPackageVersion(version){
    const beta = String(version || '').match(/beta\.(\d+)$/i);
    if(beta) return `Package ${beta[1]}`;
    return version ? `Package ${version}` : 'Package revision unavailable';
  }

  function availabilityForTrail(trailId, trailCollection){
    const trail = Array.isArray(trailCollection)
      ? trailCollection.find(item => item && item.id === trailId)
      : null;
    const packageReady = !!PACKAGES[trailId];
    if(trail && trail.curated === false){
      return { visible:true, enabled:false, reason:'imported' };
    }
    if(packageReady){
      return { visible:true, enabled:true, reason:'verified-package' };
    }
    if(trail){
      return { visible:true, enabled:false, reason:'package-pending' };
    }
    return { visible:false, enabled:false, reason:'unknown-trail' };
  }

  function initPanel(){
    const panel = document.getElementById('offlinePackagePanel');
    const downloadButton = document.getElementById('offlineDownloadBtn');
    const openButton = document.getElementById('offlineOpenBtn');
    const removeButton = document.getElementById('offlineRemoveBtn');
    const status = document.getElementById('offlinePackageStatus');
    if(!panel || !downloadButton || !openButton || !removeButton || !status) return;

    const raw = new URLSearchParams(window.location.search).get('id');
    // Offline packages are keyed by trail id, not by the slug in the URL
    // (lago-carezza's is lago-di-carezza-loop), so an unresolved param hides
    // the panel.
    const trailId = (window.DoloPawsRegionalData && window.DoloPawsRegionalData.resolveTrailId ? window.DoloPawsRegionalData.resolveTrailId(raw) : (raw));
    const trailCollection = typeof trails !== 'undefined' ? trails : null;
    const availability = availabilityForTrail(trailId, trailCollection);
    if(!availability.visible) return;
    panel.hidden = false;

    function setStatus(message, state){
      status.textContent = message;
      status.dataset.state = state || '';
      const busy = ['downloading', 'checking', 'removing'].includes(state);
      status.setAttribute('aria-busy', String(busy));
      panel.setAttribute('aria-busy', String(busy));
    }

    if(!availability.enabled){
      panel.dataset.availability = availability.reason;
      downloadButton.hidden = false;
      downloadButton.disabled = true;
      downloadButton.setAttribute('aria-disabled', 'true');
      downloadButton.textContent = tr(
        'offlinePanel.action.notEnabled',
        'Offline map not enabled yet'
      );
      setStatus(
        availability.reason === 'imported'
          ? tr(
            'offlinePanel.unavailable.imported',
            'Offline map download is not enabled yet for imported trails.'
          )
          : tr(
            'offlinePanel.unavailable.verified',
            'This verified trail’s offline package is still being prepared.'
          ),
        'unavailable'
      );
      return;
    }
    panel.dataset.availability = availability.reason;
    // trail.html carried a fixed link to the Carezza pilot, which was right
    // while it was the only package; every trail opens its own map.
    openButton.href = PACKAGES[trailId].offlineUrl;

    // A Verified trail's map is the verified line itself, so the panel says so
    // beside the trail page's badge rather than leaving it to be guessed.
    function sameRouteNote(manifest){
      return manifest && manifest.verificationStatus === 'source-verified'
        ? ` ${tr('offlinePanel.sameRoute', 'Same verified route, saved to your phone.')}`
        : '';
    }

    function signedIn(){
      return !!(window.DoloPawsAuth && window.DoloPawsAuth.currentUser);
    }

    async function refresh(options){
      const failureMessage = options && options.failureMessage;
      const removed = options && options.removed;
      const inspection = await inspectPackage(trailId);
      const manifest = inspection.usable ? inspection.manifest : null;
      const metadata = inspection.metadata;
      let available = null;
      try{ available = await availablePackage(trailId); }catch(error){ /* offline is expected */ }
      const updateAvailable = !!(manifest && available && manifest.version !== available.version);
      const ownership = manifest
        ? await ownershipState(
          metadata,
          window.DoloPawsAuth && window.DoloPawsAuth.currentUser
        )
        : null;
      openButton.hidden = !inspection.usable;
      removeButton.hidden = !inspection.hasLocalData;
      downloadButton.hidden = (
        inspection.state === 'ready' ||
        inspection.state === 'stale'
      ) && !updateAvailable && !failureMessage;
      if(failureMessage){
        downloadButton.textContent = signedIn()
          ? (manifest
            ? tr('offlinePanel.action.retryUpdate', 'Retry update')
            : tr('offlinePanel.action.retryDownload', 'Retry download'))
          : tr('offlinePanel.action.loginRetry', 'Log in to retry');
        setStatus(
          `${failureMessage} ${
            manifest
              ? tr('offlinePanel.failure.preserved', 'Your existing package remains ready offline.')
              : tr('offlinePanel.failure.notReady', 'No incomplete package has been marked ready.')
          }`,
          'failed'
        );
      }else if(removed){
        downloadButton.textContent = signedIn()
          ? tr('offlinePanel.action.downloadAgain', 'Download again')
          : tr('offlinePanel.action.loginDownload', 'Log in to download');
        setStatus(tr('offlinePanel.removed', 'Removed from this device. No offline package remains.'), 'removed');
      }else if(inspection.state === 'failed'){
        downloadButton.textContent = signedIn()
          ? tr('downloads.action.repair', 'Repair download')
          : tr('downloads.action.loginRepair', 'Log in to repair');
        setStatus(
          `${inspection.message || tr('offlinePanel.failed.verification', 'The stored package failed verification.')} ` +
          tr('offlinePanel.failed.recovery', 'It is not ready offline. Repair or remove it.'),
          'failed'
        );
      }else if(inspection.state === 'incomplete'){
        downloadButton.textContent = signedIn()
          ? (manifest
            ? tr('downloads.action.restartUpdate', 'Restart update')
            : tr('downloads.action.restartDownload', 'Restart download'))
          : tr('offlinePanel.action.loginRetry', 'Log in to retry');
        setStatus(
          `${manifest
            ? tr('offlinePanel.interrupted.update', 'A previous update was interrupted.')
            : tr('offlinePanel.interrupted.download', 'A previous download was interrupted.')} ${
            manifest
              ? tr('offlinePanel.failure.preserved', 'Your existing package remains ready offline.')
              : tr('offlinePanel.interrupted.partial', 'The partial package is not available offline.')
          } ${tr('offlinePanel.interrupted.restart', 'Restart to verify every required resource.')}`,
          'incomplete'
        );
      }else if(updateAvailable){
        downloadButton.textContent = signedIn()
          ? tr('offlinePanel.action.update', 'Update offline map')
          : tr('downloads.action.loginUpdate', 'Log in to update');
        setStatus(
          tr('offlinePanel.updateAvailable', 'Update available · current package {size} · downloaded {date} · {owner}. Your existing package remains usable offline.', {
            size:formatBytes(manifest.packageBytes),
            date:formatInstalledDate(metadata && metadata.installedAt),
            owner:localizedOwnershipLabel(ownership),
          }),
          'update-available'
        );
      }else if(inspection.state === 'stale'){
        setStatus(
          tr('offlinePanel.stale', 'Ready offline, but at least one content review is stale · {size} · downloaded {date} · {owner}. Check current notices before hiking.', {
            size:formatBytes(manifest.packageBytes),
            date:formatInstalledDate(metadata && metadata.installedAt),
            owner:localizedOwnershipLabel(ownership),
          }),
          'stale'
        );
      }else if(manifest){
        setStatus(
          tr('offlinePanel.ready', 'Ready offline · {size} · downloaded {date} · {owner} · {count} required resources checked', {
            size:formatBytes(manifest.packageBytes),
            date:formatInstalledDate(metadata && metadata.installedAt),
            owner:localizedOwnershipLabel(ownership),
            count:inspection.requiredChecked,
          }),
          'ready'
        );
      }else if(signedIn()){
        setStatus(
          `${tr('offlinePanel.notDownloaded.signedIn', 'Offline map not downloaded.')}${sameRouteNote(available)}`,
          'not-downloaded'
        );
        downloadButton.textContent = tr('offlinePanel.action.download', 'Download offline map');
      }else{
        setStatus(
          `${tr('offlinePanel.notDownloaded.signedOut', 'Offline map not downloaded.')}${sameRouteNote(available)}`,
          'not-downloaded'
        );
        downloadButton.textContent = tr('offlinePanel.action.loginDownload', 'Log in to download');
      }
    }

    async function download(){
      if(!signedIn()){
        if(window.DoloPawsTrailAction) window.DoloPawsTrailAction.request('download');
        else if(window.DoloPawsAuthUI) window.DoloPawsAuthUI.openLogin();
        return;
      }
      downloadButton.disabled = true;
      setStatus(tr('offlinePanel.download.preparing', 'Preparing a verified offline download…'), 'downloading');
      let failureMessage = null;
      try{
        const manifest = await installPackage(
          trailId,
          (current, total, resource) => {
            setStatus(tr('downloads.update.progress', 'Downloading {current} of {total}: {resource}', {
              current, total, resource:resource.label || resource.url,
            }), 'downloading');
          },
          window.DoloPawsAuth.currentUser
        );
        setStatus(
          tr('offlinePanel.download.verified', 'Verified {count} required resources.', {
            count:manifest.resources.filter(resourceIsRequired).length,
          }),
          'ready'
        );
      }catch(error){
        failureMessage = error.message || tr('offlinePanel.download.failed', 'The package could not be downloaded.');
      }finally{
        downloadButton.disabled = false;
        await refresh(failureMessage ? { failureMessage } : null);
      }
    }

    downloadButton.addEventListener('click', download);
    removeButton.addEventListener('click', async () => {
      removeButton.disabled = true;
      setStatus(tr('offlinePanel.remove.removing', 'Removing this trail from this device…'), 'removing');
      await removePackage(trailId);
      removeButton.disabled = false;
      await refresh({ removed: true });
    });

    function authChanged(){
      refresh();
      if(signedIn() && window.DoloPawsTrailAction && window.DoloPawsTrailAction.consume('download')){
        download();
      }
    }
    if(window.DoloPawsAuth) window.DoloPawsAuth.onChange(authChanged);
    else window.addEventListener('dolopaws-auth-ready', () => window.DoloPawsAuth.onChange(authChanged), { once: true });
    refresh();
  }

  function hasPackage(trailId){
    return Object.prototype.hasOwnProperty.call(PACKAGES, trailId);
  }

  window.DoloPawsOffline = {
    hasPackage,
    installPackage,
    installedPackage,
    installedPackageRecord,
    inspectPackage,
    verifyInstalledPackage,
    incompleteInstallation,
    listInstalledPackages,
    listPackageStates,
    availablePackage,
    removePackage,
    removeAllPackages,
    ownerMarkerFor,
    ownershipState,
    ownershipLabel,
    readPackageMetadata,
    writePackageMetadata,
    removePackageMetadata,
    formatInstalledDate,
    validateManifest,
    formatBytes,
    formatPackageVersion,
    requiredStorageBytes,
    storageCapacity,
    assertStorageCapacity,
    isQuotaError,
    resourceIsRequired,
    contentFreshnessState,
    availabilityForTrail,
    verifyCachedResource,
    PACKAGE_STATES,
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPanel);
  else initPanel();
})();
