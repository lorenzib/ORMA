(function(){
  'use strict';

  // ---- Language -------------------------------------------------------------
  // The offline page cannot fetch i18n.js (it is not in the package), so it
  // carries its own Italian. Same choice as the site: the saved language, else
  // the phone's. The English sentence is the key, as in i18n-phrases-it.js.
  const LANG = (() => {
    let saved = null;
    try{ saved = window.localStorage.getItem('dolopaws-lang'); }catch(error){ saved = null; }
    if(saved === 'en' || saved === 'it') return saved;
    return String(navigator.language || '').toLowerCase().startsWith('it') ? 'it' : 'en';
  })();
  const LOCALE = LANG === 'it' ? 'it-IT' : undefined;

  const IT = {
    // The page itself (offline/trail.html).
    'Offline trail · ORMA': 'Sentiero offline · ORMA',
    'ORMA home': 'Home di ORMA',
    'Checking connection…': 'Verifica della connessione…',
    '← Downloaded trails': '← Sentieri scaricati',
    'Ready on this device': 'Pronto su questo dispositivo',
    'Loading downloaded trail…': 'Caricamento del sentiero scaricato…',
    'Available offline': 'Disponibile offline',
    'Verifying package resources…': 'Verifica dei file del pacchetto…',
    'Downloaded route': 'Percorso scaricato',
    'Offline trail map': 'Mappa offline del sentiero',
    'Route, paths and useful points saved on this device.': 'Percorso, sentieri e punti utili salvati su questo dispositivo.',
    'Show my position': 'Mostra la mia posizione',
    'Route summary': 'Riepilogo del percorso',
    'Distance': 'Distanza',
    'Time': 'Tempo',
    'Climb': 'Salita',
    'Shade': 'Ombra',
    'Offline route map': 'Mappa offline del percorso',
    'Saved map': 'Mappa salvata',
    'Stored route points': 'Punti del percorso salvati',
    'Closest point on trail': 'Punto più vicino del sentiero',
    'Current GPS position': 'Posizione GPS attuale',
    'Map key': 'Legenda',
    'ORMA route': 'Percorso ORMA',
    'Start / finish': 'Partenza / arrivo',
    'Stored water point': 'Punto acqua salvato',
    'Mapped path': 'Sentiero mappato',
    'Road': 'Strada',
    'Water': 'Acqua',
    'Stored route profile': 'Profilo del percorso salvato',
    'Elevation': 'Altimetria',
    'Waiting for GPS': 'In attesa del GPS',
    'Stored route elevation profile': 'Profilo altimetrico del percorso salvato',
    'Start': 'Partenza',
    'High point': 'Punto più alto',
    'Route elevation is stored offline. The cursor shows the nearest position along the route, not exact GPS altitude. The offline basemap remains flat.':
      'L’altimetria del percorso è salvata offline. Il cursore mostra la posizione più vicina lungo il percorso, non l’altitudine GPS esatta. La mappa di base offline resta piatta.',
    'GPS is off. The route and safety information remain available.': 'Il GPS è spento. Il percorso e le informazioni di sicurezza restano disponibili.',
    'Find closest trail point': 'Trova il punto più vicino del sentiero',
    'Unfinished hike found': 'Trovata un’escursione non conclusa',
    'Resume hike': 'Riprendi l’escursione',
    'Pause': 'Pausa',
    'Finish hike': 'Termina l’escursione',
    'Discard hike': 'Elimina l’escursione',
    'Private trail feedback': 'Riscontro privato sul sentiero',
    'Did this trail suit your dog?': 'Questo sentiero era adatto al tuo cane?',
    'This structured check-in helps ORMA improve trail guidance. It never becomes a public review.':
      'Questo breve questionario aiuta ORMA a migliorare le indicazioni sui sentieri. Non diventa mai una recensione pubblica.',
    'Choose one response': 'Scegli una risposta',
    'Yes, it was appropriate': 'Sì, era adatto',
    'Yes, with unexpected cautions': 'Sì, ma con rischi imprevisti',
    'No, it was not appropriate': 'No, non era adatto',
    'We did not complete it': 'Non l’abbiamo completato',
    'Prefer not to answer': 'Preferisco non rispondere',
    'Water information': 'Informazioni sull’acqua',
    '(optional)': '(facoltativo)',
    'Not answered': 'Nessuna risposta',
    'Accurate': 'Corrette',
    'Less water than listed': 'Meno acqua di quanto indicato',
    'More water than listed': 'Più acqua di quanto indicato',
    'I did not check': 'Non ho controllato',
    'Unexpected cautions': 'Rischi imprevisti',
    'Surface': 'Fondo',
    'Exposure': 'Esposizione',
    'Livestock': 'Bestiame',
    'Heat': 'Caldo',
    'Access': 'Accesso',
    'Save private feedback': 'Salva il riscontro privato',
    'Use with local signs.': 'Da usare con la segnaletica locale.',
    'This downloaded map works without connectivity, but it is not an emergency-navigation service.':
      'Questa mappa scaricata funziona senza connessione, ma non è un servizio di navigazione per le emergenze.',
    'Trail facts': 'Dati del sentiero',
    'Safety and cautions': 'Sicurezza e precauzioni',
    'Emergency:': 'Emergenza:',
    'This trail is not ready offline': 'Questo sentiero non è pronto offline',
    'A required package resource is unavailable.': 'Manca un file necessario del pacchetto.',
    'Return to the trail page when online': 'Torna alla pagina del sentiero quando sei online',

    // Written by this script.
    'Not yet verified by ORMA': 'Non ancora verificato da ORMA',
    'Browser reports online': 'Il browser risulta online',
    'Browser reports offline': 'Il browser risulta offline',
    'Package verification failed.': 'Verifica del pacchetto non riuscita.',
    'Package verification is unavailable.': 'La verifica del pacchetto non è disponibile.',
    '{label} is missing.': 'Manca: {label}.',
    '{label} has changed size.': '{label}: la dimensione è cambiata.',
    '{label} failed verification.': '{label}: verifica non riuscita.',
    'Not recorded': 'Non registrato',
    '{start} · water': '{start} · acqua',
    'Water point': 'Punto acqua',
    'Waiting for reliable GPS': 'In attesa di un GPS affidabile',
    '{km} km · ~{m} m route elevation': '{km} km · ~{m} m di quota sul percorso',
    'Rejoin trail: follow the blue mapped path for about {m} m. Check local signs and closures.':
      'Per tornare sul sentiero: segui il sentiero mappato in blu per circa {m} m. Controlla segnaletica e chiusure locali.',
    'No connected mapped footpath was found. Return to the last marked path or follow local signs.':
      'Nessun sentiero mappato collegato trovato. Torna all’ultimo sentiero segnato o segui la segnaletica locale.',
    'GPS is not supported in this browser.': 'Il GPS non è supportato da questo browser.',
    'GPS stopped.': 'GPS fermato.',
    'Waiting for a GPS fix…': 'In attesa del segnale GPS…',
    'Stop GPS': 'Ferma il GPS',
    'You are about {km} km from this route. Rejoin guidance is unavailable this far away; use an official navigation source.':
      'Sei a circa {km} km da questo percorso. A questa distanza non ci sono indicazioni per rientrare: usa una fonte di navigazione ufficiale.',
    'You appear to be off route · about {m} m away.': 'Sembri fuori percorso · a circa {m} m.',
    'Route distance unavailable.': 'Distanza dal percorso non disponibile.',
    'GPS fix is stale; waiting for a newer position.': 'Il segnale GPS è vecchio; in attesa di una posizione più recente.',
    'GPS is weak; off-route warnings are paused.': 'Il GPS è debole; gli avvisi di fuori percorso sono sospesi.',
    'none yet': 'ancora nessuno',
    '{km} km from this route': '{km} km da questo percorso',
    'About {m} m from the trail': 'Circa {m} m dal sentiero',
    'Checking route position': 'Verifica della posizione sul percorso',
    'On trail': 'Sul sentiero',
    'Position near trail': 'Posizione vicina al sentiero',
    'Walked {km} km · ': 'Percorsi {km} km · ',
    '{summary} · GPS ±{accuracy} m · last valid fix {time}': '{summary} · GPS ±{accuracy} m · ultimo segnale valido {time}',
    'GPS position found; route distance unavailable.': 'Posizione GPS trovata; distanza dal percorso non disponibile.',
    'Your GPS position is outside this downloaded map.': 'La tua posizione GPS è fuori da questa mappa scaricata.',
    'Try GPS again': 'Riprova il GPS',
    'Hike paused': 'Escursione in pausa',
    'Location permission was denied. Enable it for ORMA in browser settings.':
      'L’accesso alla posizione è stato negato. Abilitalo per ORMA nelle impostazioni del browser.',
    'A GPS fix is currently unavailable. The stored route remains visible.':
      'Il segnale GPS al momento non è disponibile. Il percorso salvato resta visibile.',
    'Started {time} · last saved progress {progress}.': 'Iniziata alle {time} · ultimo avanzamento salvato: {progress}.',
    'at the trailhead': 'alla partenza',
    'Hike resumed': 'Escursione ripresa',
    'GPS tracking is active. Your latest valid progress stays saved on this device.':
      'Il tracciamento GPS è attivo. Il tuo ultimo avanzamento valido resta salvato su questo dispositivo.',
    'Hike paused. Your progress is saved on this device.': 'Escursione in pausa. Il tuo avanzamento è salvato su questo dispositivo.',
    'Your progress is saved on this device.': 'Il tuo avanzamento è salvato su questo dispositivo.',
    'Choose one response. It will be stored privately on this device.': 'Scegli una risposta. Verrà salvata in privato su questo dispositivo.',
    'This completion has no account owner, so private feedback cannot be saved.':
      'Questa escursione completata non è legata a un account, quindi il riscontro privato non può essere salvato.',
    'Feedback could not be stored. Free some device storage and try again.':
      'Impossibile salvare il riscontro. Libera spazio sul dispositivo e riprova.',
    'Private feedback saved': 'Riscontro privato salvato',
    'Saved privately · pending sync until you reconnect.': 'Salvato in privato · in attesa di sincronizzazione finché non torni online.',
    'Saved privately · synced.': 'Salvato in privato · sincronizzato.',
    'The completed hike could not be saved. Your active hike is still preserved.':
      'Impossibile salvare l’escursione completata. La tua escursione in corso resta conservata.',
    'Completion not saved': 'Completamento non salvato',
    'Free some device storage and tap Finish hike again.': 'Libera spazio sul dispositivo e tocca di nuovo Termina l’escursione.',
    'Hike completed and saved on this device.': 'Escursione completata e salvata su questo dispositivo.',
    'Hike completed': 'Escursione completata',
    'Your completion is stored offline and ready for a later journal or synchronization step.':
      'Il completamento è salvato offline, pronto per il diario o per la sincronizzazione.',
    'Old unfinished hike': 'Vecchia escursione non conclusa',
    'This saved hike is more than 36 hours old. Discard it before starting another hike.':
      'Questa escursione salvata ha più di 36 ore. Eliminala prima di iniziarne un’altra.',
    'Hike cannot be restored': 'Impossibile ripristinare l’escursione',
    'The saved record is damaged or from an unsupported version. Discard it safely.':
      'Il dato salvato è danneggiato o di una versione non supportata. Eliminalo in sicurezza.',
    'Hike finished': 'Escursione terminata',
    'Save the completion on this device before opening a later journal step.':
      'Salva il completamento su questo dispositivo prima di aprire il diario.',
    'No downloaded package is configured for this trail.': 'Per questo sentiero non è configurato nessun pacchetto scaricato.',
    'The package manifest is unavailable.': 'L’elenco dei file del pacchetto non è disponibile.',
    'The package manifest is invalid.': 'L’elenco dei file del pacchetto non è valido.',
    'Required map, route, safety, elevation, or footpath routing data is missing.':
      'Mancano dati necessari: mappa, percorso, sicurezza, altimetria o rete dei sentieri.',
    'The stored elevation profile is invalid.': 'Il profilo altimetrico salvato non è valido.',
    'The stored footpath routing graph is invalid.': 'La rete dei sentieri salvata non è valida.',
    'Offline route map for {name}': 'Mappa offline del percorso: {name}',
    'Ready offline · {size} · {count} stored files verified': 'Pronto offline · {size} · {count} file salvati verificati',
    'Route': 'Percorso',
    'Ascent': 'Dislivello in salita',
    'Highest point': 'Punto più alto',
    'Expected time': 'Tempo previsto',
    'Difficulty': 'Difficoltà',

    // The fixed wording every package's safety.json is built from
    // (scripts/build-offline-packages.js safetyFor). Wording a walk wrote itself
    // travels in that walk's safety.json as textIt.
    'Loop': 'Anello',
    'One way': 'Solo andata',
    'Easy': 'Facile',
    'Moderate': 'Moderato',
    'Hard': 'Impegnativo',
    'Start of the route': 'Inizio del percorso',
    'Water point mapped in OpenStreetMap': 'Punto acqua mappato in OpenStreetMap',
    'Seasonal; not field-verified': 'Stagionale; non verificato sul posto',
    'Not field-verified': 'Non verificato sul posto',
    'Seasonal availability not field-verified': 'Disponibilità stagionale non verificata sul posto',
    'Heat risk is high on this walk: start early and carry extra water.':
      'Il rischio di caldo è alto su questa passeggiata: parti presto e porta acqua in più.',
    'Parts of this walk are exposed; keep your dog close and on a short lead.':
      'Alcuni tratti di questa passeggiata sono esposti: tieni il cane vicino e al guinzaglio corto.',
    'Carry water even though water points are listed.': 'Porta comunque acqua, anche se sono indicati punti acqua.',
    'No water point is listed on this walk: carry enough for you and your dog.':
      'Su questa passeggiata non è indicato nessun punto acqua: portane abbastanza per te e per il cane.',
    'Follow local signs, lead rules and temporary closures.':
      'Rispetta la segnaletica locale, le regole sul guinzaglio e le chiusure temporanee.',
    'Call the European emergency number when urgent help is required. Connectivity is not guaranteed.':
      'Chiama il numero di emergenza europeo quando serve un aiuto urgente. La copertura di rete non è garantita.',
  };

  // The shared files a package stores, named by role so a failure reads in
  // the reader's language whatever label the manifest was built with.
  const ROLE_IT = {
    shell:'Pagina offline del sentiero',
    style:'Stili della pagina offline',
    app:'Applicazione offline del sentiero',
    'gps-policy':'Regole di sicurezza del GPS',
    'route-rejoin':'Indicazioni per tornare sul percorso',
    'hike-distance':'Distanza percorsa',
    'footpath-router':'Rete dei sentieri offline',
    'elevation-engine':'Altimetria offline',
    session:'Escursione salvata',
    completion:'Completamento salvato',
    outcome:'Riscontro privato',
    map:'Mappa offline',
    route:'Percorso',
    'footpath-network':'Rete dei sentieri del percorso',
    'elevation-profile':'Profilo altimetrico',
    safety:'Informazioni di sicurezza',
  };

  function has(table, key){
    return Object.prototype.hasOwnProperty.call(table, key);
  }

  // A number as the reader writes it: 6,7 km in Italian, 6.7 km in English.
  function num(value){
    const text = String(value);
    return LANG === 'it' ? text.replace(/(\d)\.(\d)/g, '$1,$2') : text;
  }

  // English sentence in, the reader's sentence out, with {name} slots filled.
  function say(english, values){
    const template = LANG === 'it' && has(IT, english) ? IT[english] : english;
    return template.replace(/\{(\w+)\}/g, (whole, key) =>
      values && has(values, key) ? String(values[key]) : whole);
  }

  function resourceLabel(resource){
    return (LANG === 'it' && ROLE_IT[resource.role]) || resource.label || resource.url;
  }

  // Wording from the package's safety.json: the walk's own Italian (textIt)
  // first, then the fixed wording above. Generated packages write durations as
  // "2 h 30 min", which Italian reads as is; the pilots still say "2.5 hours"
  // or "30 minutes". Anything else unknown stays as the package wrote it.
  let packageTextIt = {};
  function packageText(english){
    if(LANG !== 'it' || english === null || english === undefined) return english;
    const text = String(english);
    if(has(packageTextIt, text)) return packageTextIt[text];
    if(has(IT, text)) return IT[text];
    const duration = text.match(/^(\d+(?:\.\d+)?(?:\s*[–-]\s*\d+(?:\.\d+)?)?)\s+(hours?|minutes?)$/);
    if(duration){
      const one = duration[1] === '1';
      const unit = /^hour/.test(duration[2]) ? (one ? 'ora' : 'ore') : (one ? 'minuto' : 'minuti');
      return `${num(duration[1])} ${unit}`;
    }
    return text;
  }

  // The page's fixed wording is English in trail.html; an Italian reader gets
  // it swapped in place, text and labels alike, before anything shows.
  function translateShell(){
    document.documentElement.lang = LANG;
    if(LANG !== 'it') return;
    document.title = say(document.title);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const trimmed = node.nodeValue.trim();
      if(trimmed && has(IT, trimmed)) node.nodeValue = node.nodeValue.replace(trimmed, IT[trimmed]);
    });
    document.querySelectorAll('[aria-label], [alt]').forEach(element => {
      ['aria-label', 'alt'].forEach(name => {
        const value = element.getAttribute(name);
        if(value && has(IT, value)) element.setAttribute(name, IT[value]);
      });
    });
  }

  // Every package sits at packages/<trail id>/. Which trails have one is the
  // download controller's list; the reader only needs a well-formed id.
  function packageManifestUrl(trailId){
    return /^[a-z0-9-]+$/.test(trailId || '') ? `packages/${trailId}/manifest.json` : null;
  }
  let manifestUrl = null;
  let watchId = null;
  let activeSession = null;
  let routeCoordinates = [];
  let footpathGraph = null;
  let routeTotalM = 0;
  let routeIsLoop = false;
  let elevationProfile = null;
  let distanceTracker = null;
  let latestFix = null;
  let manualRejoinActive = false;
  let activeBounds = null;
  let offRouteStreak = 0;
  let offRouteSince = null;
  let lastValidFixAt = null;
  let completedRecord = null;

  const elements = {
    trailName: document.getElementById('trailName'),
    packageState: document.getElementById('packageState'),
    mapSection: document.getElementById('mapSection'),
    factsSection: document.getElementById('factsSection'),
    failure: document.getElementById('failure'),
    failureMessage: document.getElementById('failureMessage'),
    offlineMap: document.getElementById('offlineMap'),
    mapFrame: document.getElementById('mapFrame'),
    mapAnnotations: document.getElementById('mapAnnotations'),
    mapDistance: document.getElementById('mapDistance'),
    mapDuration: document.getElementById('mapDuration'),
    mapAscent: document.getElementById('mapAscent'),
    mapShade: document.getElementById('mapShade'),
    locationButton: document.getElementById('locationButton'),
    locationState: document.getElementById('locationState'),
    rejoinButton: document.getElementById('offlineRejoinBtn'),
    positionDot: document.getElementById('positionDot'),
    rejoinDirection: document.getElementById('rejoinDirection'),
    rejoinDirectionLine: document.getElementById('rejoinDirectionLine'),
    rejoinTarget: document.getElementById('rejoinTarget'),
    routeWarning: document.getElementById('offlineRouteWarning'),
    hikeRecovery: document.getElementById('hikeRecovery'),
    hikeRecoveryTitle: document.getElementById('hikeRecoveryTitle'),
    hikeRecoveryMessage: document.getElementById('hikeRecoveryMessage'),
    hikeResumeButton: document.getElementById('hikeResumeBtn'),
    hikePauseButton: document.getElementById('hikePauseBtn'),
    hikeFinishButton: document.getElementById('hikeFinishBtn'),
    hikeDiscardButton: document.getElementById('hikeDiscardBtn'),
    offlineOutcome: document.getElementById('offlineOutcome'),
    offlineOutcomeResponses: document.getElementById('offlineOutcomeResponses'),
    offlineOutcomeWater: document.getElementById('offlineOutcomeWater'),
    offlineOutcomeHazards: document.getElementById('offlineOutcomeHazards'),
    offlineOutcomeSave: document.getElementById('offlineOutcomeSave'),
    offlineOutcomeStatus: document.getElementById('offlineOutcomeStatus'),
    facts: document.getElementById('facts'),
    cautions: document.getElementById('cautions'),
    emergency: document.getElementById('emergency'),
    networkState: document.getElementById('networkState'),
    elevation: document.getElementById('offlineElevation'),
    elevationArea: document.getElementById('offlineElevationArea'),
    elevationLine: document.getElementById('offlineElevationLine'),
    elevationCursor: document.getElementById('offlineElevationCursor'),
    elevationLive: document.getElementById('offlineElevationLive'),
    elevationStart: document.getElementById('offlineElevationStart'),
    elevationHigh: document.getElementById('offlineElevationHigh'),
    elevationClimb: document.getElementById('offlineElevationClimb'),
  };

  function bytesToHex(buffer){
    return Array.from(new Uint8Array(buffer))
      .map(value => value.toString(16).padStart(2, '0'))
      .join('');
  }

  async function sha256(buffer){
    if(!(window.crypto && window.crypto.subtle)) throw new Error(say('Package verification is unavailable.'));
    return bytesToHex(await window.crypto.subtle.digest('SHA-256', buffer));
  }

  async function verifiedResource(resource){
    const response = await fetch(new URL(resource.url, new URL(manifestUrl, window.location.href)));
    if(!response.ok) throw new Error(say('{label} is missing.', { label:resourceLabel(resource) }));
    const buffer = await response.arrayBuffer();
    if(buffer.byteLength !== resource.bytes) throw new Error(say('{label} has changed size.', { label:resourceLabel(resource) }));
    if(await sha256(buffer) !== resource.sha256) throw new Error(say('{label} failed verification.', { label:resourceLabel(resource) }));
    return new Response(buffer, { headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream' } });
  }

  function formatBytes(bytes){
    return bytes < 1024 * 1024
      ? `${Math.ceil(bytes / 1024)} KB`
      : `${num((bytes / (1024 * 1024)).toFixed(1))} MB`;
  }

  // A route ORMA has not verified says so under the title (OFF-08). A
  // Verified one shows nothing there: the header was crowded, and the trail
  // page already carries the seal.
  function routeStatusLabel(status){
    if(status === 'not-verified') return say('Not yet verified by ORMA');
    return '';
  }

  function setNetworkState(){
    elements.networkState.textContent = navigator.onLine
      ? say('Browser reports online')
      : say('Browser reports offline');
  }

  function showFailure(message){
    elements.mapSection.hidden = true;
    elements.factsSection.hidden = true;
    elements.failure.hidden = false;
    elements.packageState.textContent = say('Package verification failed.');
    elements.failureMessage.textContent = message;
  }

  function addFact(label, value){
    // A generated package leaves out what the trail does not record (shade,
    // for one) rather than print "null%".
    if(value === null || value === undefined || /\bnull\b|\bundefined\b/.test(String(value))) return;
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = say(label);
    detail.textContent = value;
    elements.facts.append(term, detail);
  }

  function addMapAnnotation(label, type, lat, lng, bounds, detail){
    if(!elements.mapAnnotations || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const point = positionPercent(lat, lng, bounds);
    if(point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100) return;
    const marker = document.createElement('span');
    marker.className = `map-annotation map-annotation--${type}`;
    marker.style.left = `${point.x}%`;
    marker.style.top = `${point.y}%`;
    marker.setAttribute('role', 'img');
    marker.setAttribute('aria-label', detail ? `${label}. ${detail}` : label);
    marker.innerHTML = `<i aria-hidden="true"></i><b>${label}</b>`;
    elements.mapAnnotations.appendChild(marker);
  }

  function renderMapDetails(safety, bounds){
    const facts = safety.facts || {};
    elements.mapDistance.textContent = Number.isFinite(facts.distanceKm) ? `${num(facts.distanceKm)} km` : say('Not recorded');
    elements.mapDuration.textContent = packageText(facts.expectedDuration) || say('Not recorded');
    elements.mapAscent.textContent = Number.isFinite(facts.ascentM) ? `${facts.ascentM} m` : say('Not recorded');
    elements.mapShade.textContent = Number.isFinite(facts.shadePercent) ? `${facts.shadePercent}%` : say('Not recorded');
    elements.mapAnnotations.replaceChildren();
    const waypoints = safety.waypoints || [];
    const trailheadWater = safety.trailhead && waypoints.find(waypoint =>
      waypoint.type === 'water' &&
      Math.abs(waypoint.lat - safety.trailhead.lat) < 0.00001 &&
      Math.abs(waypoint.lng - safety.trailhead.lng) < 0.00001
    );
    if(safety.trailhead){
      addMapAnnotation(
        trailheadWater
          ? say('{start} · water', { start:say(routeIsLoop ? 'Start / finish' : 'Start') })
          : say(routeIsLoop ? 'Start / finish' : 'Start'),
        'start',
        safety.trailhead.lat,
        safety.trailhead.lng,
        bounds,
        packageText(safety.trailhead.label)
      );
    }
    waypoints.filter(waypoint => waypoint !== trailheadWater).forEach(waypoint => addMapAnnotation(
      waypoint.type === 'water' ? say('Water point') : packageText(waypoint.label),
      waypoint.type === 'water' ? 'water' : 'point',
      waypoint.lat,
      waypoint.lng,
      bounds,
      packageText(waypoint.reliability || waypoint.label)
    ));
  }

  function positionPercent(lat, lng, bounds){
    return {
      x: (lng - bounds.west) / (bounds.east - bounds.west) * 100,
      y: (bounds.north - lat) / (bounds.north - bounds.south) * 100,
    };
  }

  function metersBetween(aLat, aLng, bLat, bLng){
    const metresPerDegree = 111000;
    const dLat = (bLat - aLat) * metresPerDegree;
    const dLng = (bLng - aLng) * metresPerDegree *
      Math.cos(((aLat + bLat) / 2) * Math.PI / 180);
    return Math.hypot(dLat, dLng);
  }

  function routeProgress(lat, lng){
    if(routeCoordinates.length < 2) return null;
    const route = routeCoordinates.map(([routeLng, routeLat]) => ({
      lat: routeLat,
      lng: routeLng,
    }));
    const rejoin = window.DoloPawsRouteRejoin &&
      window.DoloPawsRouteRejoin.guidance({ lat, lng }, route);
    if(!rejoin) return null;
    const cumulative = [0];
    for(let index = 1; index < routeCoordinates.length; index++){
      const [routeLng, routeLat] = routeCoordinates[index];
      const [previousLng, previousLat] = routeCoordinates[index - 1];
      cumulative.push(cumulative[index - 1] +
        metersBetween(previousLat, previousLng, routeLat, routeLng));
    }
    const segmentStart = routeCoordinates[rejoin.segmentIndex];
    const segmentEnd = routeCoordinates[rejoin.segmentIndex + 1];
    const segmentM = metersBetween(
      segmentStart[1], segmentStart[0], segmentEnd[1], segmentEnd[0]
    );
    return {
      pathIndex: rejoin.segmentFraction >= 0.5
        ? rejoin.segmentIndex + 1
        : rejoin.segmentIndex,
      km: (cumulative[rejoin.segmentIndex] + segmentM * rejoin.segmentFraction) / 1000,
      nearestM: rejoin.distanceM,
      rejoin,
    };
  }

  function elevationAtKm(profile, km){
    return window.DoloPawsOfflineElevation
      ? window.DoloPawsOfflineElevation.elevationAtKm(profile, km)
      : null;
  }

  function validElevationProfile(profile, trailId){
    return !!(window.DoloPawsOfflineElevation &&
      window.DoloPawsOfflineElevation.validProfile(profile, trailId));
  }

  function renderElevationProfile(profile){
    const points = profile.points;
    const geometry = window.DoloPawsOfflineElevation.chartGeometry(profile, 600, 150);
    elements.elevationLine.setAttribute('d', geometry.line);
    elements.elevationArea.setAttribute('d', geometry.area);
    elements.elevationStart.textContent = `${Math.round(points[0].elev)} m`;
    elements.elevationHigh.textContent = `${Math.round(geometry.high)} m`;
    elements.elevationClimb.textContent = `${Math.round(profile.ascentM)} m`;
    elements.elevation.hidden = false;
  }

  function updateElevationCursor(progress){
    if(!elevationProfile || !progress){
      elements.elevationCursor.hidden = true;
      if(elevationProfile) elements.elevationLive.textContent = say('Waiting for reliable GPS');
      return;
    }
    const km = Math.max(0, Math.min(progress.km, elevationProfile.distanceKm));
    const x = window.DoloPawsOfflineElevation.chartGeometry(
      elevationProfile, 600, 150
    ).xForKm(km);
    const elevation = elevationAtKm(elevationProfile, km);
    elements.elevationCursor.setAttribute('x1', x.toFixed(1));
    elements.elevationCursor.setAttribute('x2', x.toFixed(1));
    elements.elevationCursor.hidden = false;
    elements.elevationLive.textContent = say('{km} km · ~{m} m route elevation', { km:num(km.toFixed(1)), m:Math.round(elevation) });
  }

  function hideRejoinGuidance(){
    elements.rejoinDirection.hidden = true;
    elements.rejoinTarget.hidden = true;
  }

  function mappedRejoinGuidance(){
    return latestFix && footpathGraph && window.DoloPawsFootpathRouter
      ? window.DoloPawsFootpathRouter.routeToTrail(
        { lat:latestFix.lat, lng:latestFix.lng },
        footpathGraph,
        {
          maxSnapDistanceM:Math.min(60, Math.max(25, latestFix.accuracy + 10)),
          maxRouteDistanceM:1500,
        }
      )
      : null;
  }

  function renderManualRejoin(){
    const guidance = mappedRejoinGuidance();
    elements.routeWarning.textContent = guidance
      ? say('Rejoin trail: follow the blue mapped path for about {m} m. Check local signs and closures.', { m:Math.round(guidance.distanceM) })
      : say('No connected mapped footpath was found. Return to the last marked path or follow local signs.');
    elements.routeWarning.hidden = false;
    if(guidance && activeBounds) showRejoinGuidance(guidance, activeBounds);
    else hideRejoinGuidance();
  }

  function showRejoinGuidance(guidance, bounds){
    const target = positionPercent(
      guidance.target.lat,
      guidance.target.lng,
      bounds
    );
    elements.rejoinTarget.style.left = `${target.x}%`;
    elements.rejoinTarget.style.top = `${target.y}%`;
    elements.rejoinTarget.hidden = false;
    elements.rejoinDirectionLine.setAttribute('points', guidance.path.map(point => {
      const projected = positionPercent(point.lat, point.lng, bounds);
      return `${projected.x},${projected.y}`;
    }).join(' '));
    elements.rejoinDirection.hidden = false;
  }

  function keepSessionResult(result){
    if(result && result.session) activeSession = result.session;
    return !!(result && result.ok);
  }

  function stopLocation(message){
    if(watchId !== null){
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    elements.positionDot.hidden = true;
    elements.locationButton.textContent = say('Show my position');
    elements.locationButton.disabled = false;
    elements.routeWarning.hidden = true;
    elements.rejoinButton.hidden = true;
    manualRejoinActive = false;
    latestFix = null;
    hideRejoinGuidance();
    offRouteStreak = 0;
    offRouteSince = null;
    updateElevationCursor(null);
    if(message) elements.locationState.textContent = message;
  }

  function startLocation(bounds){
    if(!('geolocation' in navigator)){
      elements.locationState.textContent = say('GPS is not supported in this browser.');
      return;
    }
    if(watchId !== null){
      if(activeSession && activeSession.state === 'active') pauseRecoveredHike();
      else stopLocation(say('GPS stopped.'));
      return;
    }
    elements.locationButton.disabled = true;
    activeBounds = bounds;
    elements.locationState.textContent = say('Waiting for a GPS fix…');
    watchId = navigator.geolocation.watchPosition(position => {
      elements.locationButton.disabled = false;
      elements.locationButton.textContent = say('Stop GPS');
      const point = positionPercent(position.coords.latitude, position.coords.longitude, bounds);
      const onMap = point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100;
      elements.positionDot.hidden = !onMap;
      if(onMap){
        elements.positionDot.style.left = `${point.x}%`;
        elements.positionDot.style.top = `${point.y}%`;
      }
      const progress = routeProgress(position.coords.latitude, position.coords.longitude);
      const fixTimestamp = Number.isFinite(position.timestamp)
        ? position.timestamp
        : Date.now();
      latestFix = {
        lat:position.coords.latitude,
        lng:position.coords.longitude,
        accuracy:position.coords.accuracy,
      };
      const assessment = progress && window.DoloPawsGpsPolicy
        ? window.DoloPawsGpsPolicy.assessFix({
          timestamp: fixTimestamp,
          now: Date.now(),
          accuracyM: position.coords.accuracy,
          routeDistanceM: progress.nearestM,
          previousOffRouteStreak: offRouteStreak,
          previousOffRouteSince: offRouteSince,
        })
        : null;
      updateElevationCursor(assessment && assessment.usableForProgress &&
        !assessment.farFromRoute ? progress : null);
      offRouteStreak = assessment ? assessment.nextOffRouteStreak : 0;
      offRouteSince = assessment ? assessment.nextOffRouteSince : null;
      if(assessment && assessment.usableForProgress) lastValidFixAt = fixTimestamp;
      if(activeSession && activeSession.state === 'active' &&
         assessment && assessment.usableForProgress && progress.nearestM <= 2000){
          if(window.DoloPawsHikeDistance){
            distanceTracker = window.DoloPawsHikeDistance.update(
              distanceTracker || window.DoloPawsHikeDistance.create(
                activeSession.lastProgress && activeSession.lastProgress.km || 0
              ),
              {
                lat:position.coords.latitude,
                lng:position.coords.longitude,
                timestamp:fixTimestamp,
                accuracyM:position.coords.accuracy,
                routePositionM:progress.km * 1000,
                nearRoute:progress.nearestM <= 60,
                usable:true,
              },
              { totalRouteM:routeTotalM, loop:routeIsLoop }
            );
          }
          keepSessionResult(window.DoloPawsHikeSession.updateProgress(activeSession, {
            km:distanceTracker ? distanceTracker.distanceM / 1000 : 0,
            pathIndex: progress.pathIndex,
            accuracyM: position.coords.accuracy,
            recordedAt: fixTimestamp,
          }));
      }
      if(assessment && assessment.farFromRoute){
        elements.routeWarning.textContent =
          say('You are about {km} km from this route. Rejoin guidance is unavailable this far away; use an official navigation source.',
            { km:num((progress.nearestM / 1000).toFixed(1)) });
        elements.routeWarning.hidden = false;
        elements.rejoinButton.hidden = true;
        manualRejoinActive = false;
        hideRejoinGuidance();
      }else{
        const rejoinAvailable = assessment && assessment.usableForProgress &&
          !!footpathGraph && progress.nearestM > Math.max(15, position.coords.accuracy * 0.5) &&
          progress.nearestM <= 1500;
        elements.rejoinButton.hidden = !rejoinAvailable;
        if(!rejoinAvailable) manualRejoinActive = false;
        if(manualRejoinActive){
          renderManualRejoin();
        }else if(assessment && assessment.offRouteState === 'confirmed'){
          elements.routeWarning.textContent =
            say('You appear to be off route · about {m} m away.', { m:Math.round(progress.nearestM) });
          elements.routeWarning.hidden = false;
          hideRejoinGuidance();
        }else{
          elements.routeWarning.hidden = true;
          hideRejoinGuidance();
        }
      }
      const reliability = !assessment
        ? say('Route distance unavailable.')
        : assessment.freshness === 'stale'
          ? say('GPS fix is stale; waiting for a newer position.')
          : !assessment.reliableForWarning
            ? say('GPS is weak; off-route warnings are paused.')
            : '';
      const lastFixText = lastValidFixAt
        ? new Date(lastValidFixAt).toLocaleTimeString(LOCALE)
        : say('none yet');
      const positionSummary = assessment
        ? assessment.farFromRoute
          ? say('{km} km from this route', { km:num((progress.nearestM / 1000).toFixed(1)) })
          : assessment.offRouteState === 'confirmed'
            ? say('About {m} m from the trail', { m:Math.round(progress.nearestM) })
            : assessment.offRouteState === 'possible'
              ? say('Checking route position')
              : assessment.upperBoundM < window.DoloPawsGpsPolicy.THRESHOLDS.onRouteM
                ? say('On trail')
                : say('Position near trail')
        : '';
      elements.locationState.textContent = assessment
        ? `${activeSession && activeSession.lastProgress ? say('Walked {km} km · ', { km:num(activeSession.lastProgress.km.toFixed(1)) }) : ''}` +
          say('{summary} · GPS ±{accuracy} m · last valid fix {time}', {
            summary:positionSummary, accuracy:Math.round(position.coords.accuracy), time:lastFixText,
          }) + (reliability ? ` · ${reliability}` : '')
        : onMap
          ? say('GPS position found; route distance unavailable.')
          : say('Your GPS position is outside this downloaded map.');
    }, error => {
      elements.locationButton.disabled = false;
      elements.locationButton.textContent = say('Try GPS again');
      watchId = null;
      hideRejoinGuidance();
      elements.rejoinButton.hidden = true;
      manualRejoinActive = false;
      if(activeSession && activeSession.state === 'active'){
        keepSessionResult(window.DoloPawsHikeSession.setState(
          activeSession,
          'paused',
          Date.now()
        ));
        elements.hikeRecoveryTitle.textContent = say('Hike paused');
        elements.hikeResumeButton.hidden = false;
        elements.hikePauseButton.hidden = true;
      }
      elements.locationState.textContent = error.code === 1
        ? say('Location permission was denied. Enable it for ORMA in browser settings.')
        : say('A GPS fix is currently unavailable. The stored route remains visible.');
    }, {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 20000,
    });
  }

  function recoveryMessage(session){
    const progress = session.lastProgress;
    const time = new Date(session.startedAt).toLocaleTimeString(LOCALE ? [LOCALE] : [], {
      hour: '2-digit',
      minute: '2-digit',
    });
    return say('Started {time} · last saved progress {progress}.', {
      time,
      progress:progress ? `${num(progress.km.toFixed(1))} km` : say('at the trailhead'),
    });
  }

  function showRecoveryIssue(title, message){
    elements.hikeRecovery.hidden = false;
    elements.hikeRecoveryTitle.textContent = title;
    elements.hikeRecoveryMessage.textContent = message;
    elements.hikeResumeButton.hidden = true;
    elements.hikePauseButton.hidden = true;
    elements.hikeFinishButton.hidden = true;
    elements.hikeDiscardButton.hidden = false;
  }

  function resumeRecoveredHike(bounds){
    if(!activeSession) return;
    keepSessionResult(window.DoloPawsHikeSession.setState(
      activeSession,
      'active',
      Date.now()
    ));
    elements.hikeRecoveryTitle.textContent = say('Hike resumed');
    elements.hikeRecoveryMessage.textContent =
      say('GPS tracking is active. Your latest valid progress stays saved on this device.');
    elements.hikeResumeButton.hidden = true;
    elements.hikePauseButton.hidden = false;
    elements.hikeFinishButton.hidden = false;
    startLocation(bounds);
  }

  function pauseRecoveredHike(){
    if(activeSession){
      keepSessionResult(window.DoloPawsHikeSession.setState(
        activeSession,
        'paused',
        Date.now()
      ));
    }
    stopLocation(say('Hike paused. Your progress is saved on this device.'));
    elements.hikeRecoveryTitle.textContent = say('Hike paused');
    elements.hikeRecoveryMessage.textContent = activeSession
      ? recoveryMessage(activeSession)
      : say('Your progress is saved on this device.');
    elements.hikeResumeButton.hidden = false;
    elements.hikePauseButton.hidden = true;
    elements.hikeFinishButton.hidden = false;
  }

  function showOfflineOutcome(completion){
    completedRecord = completion;
    elements.offlineOutcome.hidden = false;
    elements.offlineOutcomeStatus.textContent = completion.ownerId
      ? say('Choose one response. It will be stored privately on this device.')
      : say('This completion has no account owner, so private feedback cannot be saved.');
    elements.offlineOutcomeSave.disabled = true;
  }

  function selectedOutcomeResponse(){
    const selected = elements.offlineOutcomeResponses.querySelector(
      'input[name="offlineOutcomeResponse"]:checked'
    );
    return selected ? selected.value : null;
  }

  async function saveOfflineOutcome(){
    if(!completedRecord || !completedRecord.ownerId ||
       !window.DoloPawsPostHikeOutcomes) return;
    const response = selectedOutcomeResponse();
    if(!response) return;
    const hazards = Array.from(
      elements.offlineOutcomeHazards.querySelectorAll('input:checked'),
      input => input.value
    );
    const result = window.DoloPawsPostHikeOutcomes.save(
      completedRecord,
      {
        response,
        waterAccuracy:elements.offlineOutcomeWater.value || null,
        hazards,
        offlinePackageUsed:true,
      },
      completedRecord.ownerId
    );
    if(!result.ok){
      elements.offlineOutcomeStatus.textContent =
        say('Feedback could not be stored. Free some device storage and try again.');
      return;
    }
    elements.offlineOutcome.querySelectorAll('input, select, button')
      .forEach(control => { control.disabled = true; });
    elements.offlineOutcomeSave.textContent = say('Private feedback saved');
    elements.offlineOutcomeStatus.textContent =
      say('Saved privately · pending sync until you reconnect.');
    if(navigator.onLine){
      const sync = await window.DoloPawsPostHikeOutcomes.syncBrowser();
      if(sync.ok && sync.pending === 0){
        elements.offlineOutcomeStatus.textContent = say('Saved privately · synced.');
      }
    }
  }

  function finishRecoveredHike(){
    if(!activeSession || !window.DoloPawsHikeCompletions) return;
    const completedAt = activeSession.state === 'completion-pending'
      ? activeSession.updatedAt
      : Date.now();
    keepSessionResult(window.DoloPawsHikeSession.setState(
      activeSession,
      'completion-pending',
      completedAt
    ));
    const result = window.DoloPawsHikeCompletions.save(activeSession, {
      completedAt,
      distanceKm: activeSession.lastProgress && activeSession.lastProgress.km || 0,
    });
    if(!result.ok){
      stopLocation(say('The completed hike could not be saved. Your active hike is still preserved.'));
      elements.hikeRecoveryTitle.textContent = say('Completion not saved');
      elements.hikeRecoveryMessage.textContent =
        say('Free some device storage and tap Finish hike again.');
      elements.hikeResumeButton.hidden = true;
      elements.hikePauseButton.hidden = true;
      elements.hikeFinishButton.hidden = false;
      return;
    }
    window.DoloPawsHikeSession.clear();
    activeSession = null;
    stopLocation(say('Hike completed and saved on this device.'));
    elements.hikeRecoveryTitle.textContent = say('Hike completed');
    elements.hikeRecoveryMessage.textContent =
      say('Your completion is stored offline and ready for a later journal or synchronization step.');
    elements.hikeResumeButton.hidden = true;
    elements.hikePauseButton.hidden = true;
    elements.hikeFinishButton.hidden = true;
    elements.hikeDiscardButton.hidden = true;
    showOfflineOutcome(result.record);
  }

  function discardRecoveredHike(){
    stopLocation(say('GPS is off. The route and safety information remain available.'));
    window.DoloPawsHikeSession.clear();
    activeSession = null;
    elements.hikeRecovery.hidden = true;
  }

  function configureRecovery(trailId, bounds){
    if(!window.DoloPawsHikeSession) return;
    elements.hikeResumeButton.addEventListener('click', () => resumeRecoveredHike(bounds));
    elements.hikePauseButton.addEventListener('click', pauseRecoveredHike);
    elements.hikeFinishButton.addEventListener('click', finishRecoveredHike);
    elements.hikeDiscardButton.addEventListener('click', discardRecoveredHike);
    elements.offlineOutcomeResponses.addEventListener('change', () => {
      elements.offlineOutcomeSave.disabled =
        !completedRecord || !completedRecord.ownerId || !selectedOutcomeResponse();
    });
    elements.offlineOutcomeSave.addEventListener('click', saveOfflineOutcome);
    const loaded = window.DoloPawsHikeSession.load();
    const ownerId = loaded.status === 'ready' ? loaded.session.ownerId : null;
    const recovery = window.DoloPawsHikeSession.recoveryState({
      trailId,
      ownerId,
      packageAvailable: true,
    });
    if(recovery.status === 'empty' || recovery.status === 'unavailable' ||
       recovery.status === 'other-trail' || recovery.status === 'owner-mismatch'){
      return;
    }
    if(recovery.status === 'expired'){
      showRecoveryIssue(
        say('Old unfinished hike'),
        say('This saved hike is more than 36 hours old. Discard it before starting another hike.')
      );
      return;
    }
    if(recovery.status === 'corrupt' || recovery.status === 'incompatible'){
      showRecoveryIssue(
        say('Hike cannot be restored'),
        say('The saved record is damaged or from an unsupported version. Discard it safely.')
      );
      return;
    }
    activeSession = recovery.session;
    lastValidFixAt = activeSession.lastProgress
      ? activeSession.lastProgress.recordedAt
      : null;
    elements.hikeRecovery.hidden = false;
    elements.hikeDiscardButton.hidden = false;
    if(activeSession.state === 'completion-pending'){
      elements.hikeRecoveryTitle.textContent = say('Hike finished');
      elements.hikeRecoveryMessage.textContent =
        say('Save the completion on this device before opening a later journal step.');
      elements.hikeResumeButton.hidden = true;
      elements.hikePauseButton.hidden = true;
      elements.hikeFinishButton.hidden = false;
      return;
    }
    elements.hikeRecoveryTitle.textContent = say('Unfinished hike found');
    elements.hikeRecoveryMessage.textContent = recoveryMessage(activeSession);
    elements.hikeResumeButton.hidden = false;
    elements.hikePauseButton.hidden = true;
    elements.hikeFinishButton.hidden = false;
  }

  async function init(){
    translateShell();
    setNetworkState();
    window.addEventListener('online', setNetworkState);
    window.addEventListener('offline', setNetworkState);

    const trailId = new URLSearchParams(window.location.search).get('id');
    manifestUrl = packageManifestUrl(trailId);
    if(!manifestUrl){
      showFailure(say('No downloaded package is configured for this trail.'));
      return;
    }

    try{
      const manifestResponse = await fetch(manifestUrl);
      if(!manifestResponse.ok) throw new Error(say('The package manifest is unavailable.'));
      const manifest = await manifestResponse.json();
      if(manifest.trailId !== trailId || manifest.schemaVersion !== 1) throw new Error(say('The package manifest is invalid.'));

      const resources = {};
      for(const resource of manifest.resources){
        try{
          const response = await verifiedResource(resource);
          resources[resource.role] = response;
        }catch(error){
          if(resource.required !== false) throw error;
        }
      }
      if(!resources.map || !resources.route || !resources.safety ||
         !resources['footpath-network'] || !resources['elevation-profile']){
        throw new Error(say('Required map, route, safety, elevation, or footpath routing data is missing.'));
      }

      const safety = await resources.safety.json();
      packageTextIt = safety.textIt && typeof safety.textIt === 'object' ? safety.textIt : {};
      const route = await resources.route.json();
      elevationProfile = await resources['elevation-profile'].json();
      if(!validElevationProfile(elevationProfile, trailId)){
        throw new Error(say('The stored elevation profile is invalid.'));
      }
      footpathGraph = await resources['footpath-network'].json();
      if(!window.DoloPawsFootpathRouter ||
         !window.DoloPawsFootpathRouter.validateGraph(footpathGraph)){
        throw new Error(say('The stored footpath routing graph is invalid.'));
      }
      routeCoordinates = route.features && route.features[0] &&
        route.features[0].geometry && route.features[0].geometry.coordinates || [];
      routeTotalM = routeCoordinates.slice(1).reduce((total, coordinate, index) =>
        total + metersBetween(
          routeCoordinates[index][1], routeCoordinates[index][0],
          coordinate[1], coordinate[0]
        ), 0);
      routeIsLoop = routeCoordinates.length > 2 && metersBetween(
        routeCoordinates[0][1], routeCoordinates[0][0],
        routeCoordinates[routeCoordinates.length - 1][1],
        routeCoordinates[routeCoordinates.length - 1][0]
      ) <= 75;
      const trailName = packageText(manifest.name);
      elements.trailName.textContent = trailName;
      elements.offlineMap.alt = say('Offline route map for {name}', { name:trailName });
      const failureLink = document.getElementById('failureTrailLink');
      if(failureLink) failureLink.href = `../trail.html?id=${encodeURIComponent(trailId)}`;
      const requiredCount = manifest.resources.filter(resource => resource.required !== false).length;
      elements.packageState.textContent = say('Ready offline · {size} · {count} stored files verified', {
        size:formatBytes(manifest.packageBytes), count:requiredCount,
      });
      elements.offlineMap.src = URL.createObjectURL(await resources.map.blob());
      if(manifest.image && manifest.image.width && manifest.image.height){
        elements.mapFrame.style.aspectRatio = `${manifest.image.width} / ${manifest.image.height}`;
      }
      renderElevationProfile(elevationProfile);
      renderMapDetails(safety, manifest.bounds);

      addFact('Route', packageText(safety.facts.routeType));
      addFact('Distance', `${num(safety.facts.distanceKm)} km`);
      addFact('Ascent', `${safety.facts.ascentM} m`);
      addFact('Highest point', `${safety.facts.highestPointM} m`);
      addFact('Expected time', packageText(safety.facts.expectedDuration));
      addFact('Difficulty', packageText(safety.facts.difficulty));
      addFact('Shade', `${safety.facts.shadePercent}%`);
      safety.cautions.forEach(caution => {
        const item = document.createElement('li');
        item.textContent = packageText(caution);
        elements.cautions.appendChild(item);
      });
      elements.emergency.textContent = `${safety.emergency.number}. ${packageText(safety.emergency.note)}`;
      const routeStatus = document.getElementById('routeStatus');
      if(routeStatus && routeStatusLabel(manifest.verificationStatus)){
        routeStatus.textContent = routeStatusLabel(manifest.verificationStatus);
        routeStatus.dataset.status = manifest.verificationStatus;
        routeStatus.hidden = false;
      }
      elements.locationButton.addEventListener('click', () => startLocation(manifest.bounds));
      elements.rejoinButton.addEventListener('click', () => {
        manualRejoinActive = true;
        renderManualRejoin();
      });
      configureRecovery(trailId, manifest.bounds);

      elements.mapSection.hidden = false;
      elements.factsSection.hidden = false;
    }catch(error){
      showFailure(error.message || say('A required package resource is unavailable.'));
    }
  }

  window.DoloPawsOfflineApp = { positionPercent, routeProgress, elevationAtKm, validElevationProfile };
  init();
})();
