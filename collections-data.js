(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsCollections = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  // Collections are deliberately editorial and geographically scoped. A
  // collection may cover one ORMA region in one country only, so it can work
  // as a practical multi-day shortlist rather than a cross-border theme.
  const COLLECTIONS = [
    {
      id:'lake-loops', title:'Dolomites lake-loop days', subtitle:'Three lake walks for a short Dolomites stay',
      description:'A three-day Dolomites shortlist built around Lago di Braies, Lago di Carezza and Montiggler Seen. Use each trail page to compare the drive, climb, water and terrain before choosing the order.',
      coverImage:'images/lago-di-braies.webp', chips:['Circular routes','Lakeside scenery','Compare distance and climb'],
      countryCode:'IT', country:'Italy', region:'dolomites', regionLabel:'Dolomites', tripLength:'3 days',
      trailIds:['lago-braies','lago-carezza','osm-3202880'],
    },
    {
      id:'rifugio-days', title:'Dolomites rifugio days', subtitle:'Five walks with a mapped hut or mountain stop',
      description:'A Dolomites week built around routes where a rifugio or mountain stop is part of the day. Opening dates and dog rules can change, so confirm them directly before relying on a stop.',
      coverImage:'images/lago-di-carezza.webp', chips:['Mapped mountain stops','Long-lunch potential','Check current opening'],
      countryCode:'IT', country:'Italy', region:'dolomites', regionLabel:'Dolomites', tripLength:'5 days',
      trailIds:['tre-cime','lago-braies','geotrail-bulla','giro-del-bulacia','sentiero-hans-e-paula-steger'],
    },
    {
      id:'short-flat', title:'Gentler Dolomites week', subtitle:'A flexible week of shorter, lower-climb walks',
      description:'A Dolomites base for easier days: the selected routes are under 5 km, use gentle or mixed terrain and keep recorded ascent modest. Choose four to seven according to weather and recovery.',
      coverImage:'images/lago-di-carezza.webp', chips:['Under 5 km','Up to 200 m climb','Gentle or mixed terrain'],
      countryCode:'IT', country:'Italy', region:'dolomites', regionLabel:'Dolomites', tripLength:'4–7 days',
      trailIds:['santa-maddalena','lago-braies','lago-carezza','valley-view','osm-3202880','osm-6244965','osm-6404633','osm-7546708'],
    },
    {
      id:'hot-day', title:'Warmer Dolomites days', subtitle:'Five alternatives with selected shade and mapped water',
      description:'A Dolomites shortlist with recorded shade and at least one mapped water point. This is a planning aid, not a heat-safety guarantee: carry water and adjust every day for the forecast and your dog.',
      coverImage:'images/lago-di-carezza.webp', chips:['Recorded shade','Mapped water','Early starts still recommended'],
      countryCode:'IT', country:'Italy', region:'dolomites', regionLabel:'Dolomites', tripLength:'3–5 days',
      trailIds:['prato-piazza','lago-braies','lago-carezza','lago-sorapis','piancavallo'],
    },
    {
      id:'cable-car-days', title:'Lift-assisted Dolomites week', subtitle:'Seven high-level options with a lift near the start',
      description:'A Dolomites week of walks that can begin with a cable car, gondola or lift. Services and dog policies are seasonal, so use each trail’s access notes and verify the operator timetable.',
      coverImage:'images/lago-di-braies.webp', chips:['Lift-assisted access','High-level starts','Verify dog policy'],
      countryCode:'IT', country:'Italy', region:'dolomites', regionLabel:'Dolomites', tripLength:'4–7 days',
      trailIds:['alpe-siusi','seceda','sentiero-hans-e-paula-steger','osm-1116675','osm-11828233','osm-11855879','osm-19697977'],
    },
    {
      id:'savoy-lake-loops', title:'Savoy lake-loop week', subtitle:'Seven lake walks across one French alpine region',
      description:'A Savoy week of lakeside circuits, from short outings to longer mountain loops. Use the individual trail pages to group nearby valleys and balance distance and climb across the stay.',
      coverImage:'images/boucle-du-lac-vert.webp', chips:['Circular routes','Lakeside scenery','Seven-day shortlist'],
      countryCode:'FR', country:'France', region:'savoy', regionLabel:'Savoy', tripLength:'5–7 days',
      trailIds:['osm-6250300','osm-9933643','osm-16395076','osm-13338113','osm-14377007','osm-14378946','osm-19541366'],
    },
    {
      id:'shady-woodland', title:'Shady Savoy weekend', subtitle:'Two woodland options for a short French Alps stay',
      description:'A two-day Savoy pairing for times when exposed ground is less appealing. Shade changes with season and time of day, so check each trail and the forecast before setting out.',
      coverImage:'images/circuit-beatrice-de-savoie.webp', chips:['Recorded shade','Woodland character','Weekend pairing'],
      countryCode:'FR', country:'France', region:'savoy', regionLabel:'Savoy', tripLength:'2 days',
      trailIds:['osm-3982382','osm-6250300'],
    },
    {
      id:'savoy-rifugio-days', title:'Savoy mountain-stop days', subtitle:'Five walks with a mapped hut or mountain stop',
      description:'A Savoy shortlist where a hut or mountain stop can anchor the day. Opening dates and dog rules can change, so confirm them directly before relying on a stop.',
      coverImage:'images/le-mont-d-arbois-mont-joux.webp', chips:['Mapped mountain stops','Long-lunch potential','Check current opening'],
      countryCode:'FR', country:'France', region:'savoy', regionLabel:'Savoy', tripLength:'3–5 days',
      trailIds:['osm-6250300','osm-9933643','osm-18055492','osm-14864704','osm-16322228'],
    },
    {
      id:'savoy-short-flat', title:'Gentler Savoy week', subtitle:'Six compact walks with modest recorded climb',
      description:'A Savoy base for easier days: each route is under 5 km, uses gentle or mixed terrain and keeps recorded ascent modest. Pick the nearest options rather than crossing the whole region each day.',
      coverImage:'images/boucle-du-marais-des-chassettes.webp', chips:['Under 5 km','Up to 200 m climb','Gentle or mixed terrain'],
      countryCode:'FR', country:'France', region:'savoy', regionLabel:'Savoy', tripLength:'4–6 days',
      trailIds:['osm-3982382','osm-6250300','osm-10116283','osm-10116380','osm-16322228','osm-16395076'],
    },
    {
      id:'savoy-hot-day', title:'Warmer Savoy days', subtitle:'Four alternatives with selected shade and mapped water',
      description:'A Savoy shortlist with recorded shade and at least one mapped water point. This is a planning aid, not a heat-safety guarantee: carry water and adjust every day for the forecast and your dog.',
      coverImage:'images/boucle-du-taillefer.webp', chips:['Recorded shade','Mapped water','Early starts still recommended'],
      countryCode:'FR', country:'France', region:'savoy', regionLabel:'Savoy', tripLength:'3–4 days',
      trailIds:['osm-3982382','osm-6250300','osm-11517208','osm-14864704'],
    },
    {
      id:'savoy-cable-car-days', title:'Lift-assisted Savoy days', subtitle:'Five high-level options with a lift near the start',
      description:'A Savoy shortlist of walks that can begin with a cable car, gondola or lift. Services and dog policies are seasonal, so use each trail’s access notes and verify the operator timetable.',
      coverImage:'images/la-croix-des-salles.webp', chips:['Lift-assisted access','High-level starts','Verify dog policy'],
      countryCode:'FR', country:'France', region:'savoy', regionLabel:'Savoy', tripLength:'3–5 days',
      trailIds:['osm-11517208','osm-9937537','osm-12745924','osm-14375158','osm-14376573'],
    },
  ];

  function all(){ return COLLECTIONS.slice(); }
  function get(id){ return COLLECTIONS.find(collection => collection.id === id) || null; }
  function trailsFor(collectionOrId, trails){
    const collection = typeof collectionOrId === 'string' ? get(collectionOrId) : collectionOrId;
    if(!collection) return [];
    const byId = new Map((Array.isArray(trails) ? trails : []).map(trail => [trail.id, trail]));
    return collection.trailIds.map(id => byId.get(id)).filter(Boolean);
  }

  return Object.freeze({ all, get, trailsFor });
});
