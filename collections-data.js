(function(root, factory){
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.DoloPawsCollections = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  // Collections are deliberately editorial. Add or remove a trail here and
  // both the landing-page count and the detail page update automatically.
  const COLLECTIONS = [
    {
      id:'lake-loops', title:'Lake loops', subtitle:'Circular walks shaped around alpine water',
      description:'A calm set of lake-side circuits, from short family outings to longer mountain loops. Open a trail for its individual water, access and terrain notes.',
      coverImage:'images/lago-di-braies.webp', chips:['Circular routes','Lakeside scenery','Compare distance and climb'],
      trailIds:['lago-braies','lago-carezza','osm-6250300','osm-9933643','osm-16395076','osm-3202880','osm-13338113','osm-14377007','osm-14378946','osm-19541366'],
    },
    {
      id:'shady-woodland', title:'Shady woodland walks', subtitle:'Routes with substantial recorded shade',
      description:'Woodland and tree-covered walks for days when exposed ground is less appealing. Shade varies with season and time of day, so check the trail details before setting out.',
      coverImage:'images/boucle-du-lac-vert.webp', chips:['Recorded shade','Woodland character','Season-aware planning'],
      trailIds:['lago-carezza','osm-3982382','osm-6250300'],
    },
    {
      id:'rifugio-days', title:'Rifugio days', subtitle:'Walks with a mapped hut or mountain stop',
      description:'Routes where a hut, rifugio or mountain stop is part of the day. Opening dates and dog rules can change, so confirm them directly before relying on a stop.',
      coverImage:'images/lago-di-carezza.webp', chips:['Mapped mountain stops','Long-lunch potential','Check current opening'],
      trailIds:['tre-cime','lago-braies','geotrail-bulla','giro-del-bulacia','sentiero-hans-e-paula-steger','osm-6250300','osm-9933643','osm-18055492','osm-14864704','osm-16322228'],
    },
    {
      id:'short-flat', title:'Short and flat', subtitle:'Compact routes with gentle ground and modest climb',
      description:'A starting point for easier days: each selected route is under 5 km, uses gentle or mixed terrain, and keeps the recorded ascent modest.',
      coverImage:'images/sentier-des-buis.webp', chips:['Under 5 km','Up to 200 m climb','Gentle or mixed terrain'],
      trailIds:['santa-maddalena','lago-braies','lago-carezza','valley-view','osm-3982382','osm-6250300','osm-10116283','osm-10116380','osm-16322228','osm-16395076','osm-3202880','osm-6244965','osm-6404633','osm-7546708'],
    },
    {
      id:'hot-day', title:'Hot-day walks', subtitle:'Selected shade and mapped water for warmer days',
      description:'Routes with both recorded shade and at least one mapped water point. This is a planning aid, not a heat-safety guarantee: carry water and adjust for the forecast and your dog.',
      coverImage:'images/lago-di-carezza.webp', chips:['Recorded shade','Mapped water','Early starts still recommended'],
      trailIds:['prato-piazza','lago-braies','lago-carezza','lago-sorapis','piancavallo','osm-3982382','osm-6250300','osm-11517208','osm-14864704'],
    },
    {
      id:'cable-car-days', title:'Cable-car days', subtitle:'Routes with a lift at or near the trailhead',
      description:'High-level walks that can begin with a cable car, gondola or lift. Services and dog policies are seasonal, so use each trail’s access notes and verify the operator timetable.',
      coverImage:'images/lago-di-braies.webp', chips:['Lift-assisted access','High-level starts','Verify dog policy'],
      trailIds:['alpe-siusi','seceda','sentiero-hans-e-paula-steger','osm-11517208','osm-1116675','osm-11828233','osm-11855879','osm-19697977','osm-9937537','osm-12745924','osm-14375158','osm-14376573'],
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
