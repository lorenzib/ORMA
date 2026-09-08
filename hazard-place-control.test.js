/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://app-orma.com/trail.html?id=giro-del-bulacia"}
 */
const fs=require('fs');

// Drive the real control against a stub map, because the wiring between a tap,
// the projection and what gets submitted is exactly what a source-level test
// cannot see.
function stubMap(){
  const handlers={};
  return {
    handlers,
    getCanvas:()=>({style:{}}),
    once:(event,fn)=>{handlers[event]=fn;},
    fire:(event,payload)=>handlers[event]&&handlers[event](payload),
  };
}

function loadTrail(id){
  const src=fs.readFileSync('data/regions/dolomites-trails.js','utf8');
  return JSON.parse(src.match(/var incoming=(\[[\s\S]*?\]);/)[1]).find(item=>item.id===id);
}

describe('placing a hazard on the trail map', () => {
  let trail,map,sent;

  beforeEach(() => {
    jest.resetModules();
    trail=loadTrail('giro-del-bulacia');
    map=stubMap();
    sent=[];
    document.body.innerHTML='<div id="ormaHazardMount"></div><div id="trailMapBox"></div>';

    const markers=[];
    global.maplibregl={Marker:class{
      constructor(options){this.options=options;this.events={};markers.push(this);}
      setLngLat(value){this.lngLat=value;return this;}
      addTo(){return this;}
      on(event,fn){this.events[event]=fn;return this;}
      getLngLat(){return {lat:this.lngLat[1],lng:this.lngLat[0]};}
      remove(){this.removed=true;}
    }};
    global.markers=markers;
    window.maplibregl=global.maplibregl;
    window.OrmaHazardLocation=require('./hazard-location.js');
    window.DoloPawsTrailMapContext={map,trail};
    window.DoloPawsAuthReady=true;
    window.DoloPawsCommunity={reportTrailHazard:(...args)=>{sent.push(args);return {ok:true,message:'ok'};}};
    global.fetch=()=>Promise.resolve({ok:true,json:()=>({hazards:[]})});
    require('./trail-hazards.js');
  });

  const settle=()=>new Promise(resolve=>setTimeout(resolve,0));

  test('a tap on the route is submitted as a km along it', async () => {
    await settle();
    const form=document.querySelector('.orma-hazard-report form');
    expect(form).not.toBeNull();
    const place=form.querySelector('.orma-hazard-report__place button');
    expect(place.textContent).toBe('Point to it on the map');

    place.click();
    expect(place.textContent).toBe('Tap the map where you saw it');

    const [lat,lng]=trail.path[10];
    map.fire('click',{lngLat:{lat,lng}});

    const where=form.querySelector('.orma-hazard-report__where');
    expect(where.textContent).toContain('km along the route');
    expect(where.classList.contains('is-off')).toBe(false);
    expect(place.textContent).toBe('Move the pin');

    form.querySelector('textarea').value='Guardian dogs loose on the pasture crossing';
    form.dispatchEvent(new window.Event('submit'));
    await settle();

    expect(sent).toHaveLength(1);
    const location=sent[0][4];
    expect(location.km).toBeGreaterThan(0);
    expect(location.onRoute).toBe(true);
    // Snapped onto the path, not left where the finger landed.
    expect(location.offRouteM).toBeLessThanOrEqual(1);
  });

  test('a tap far from the trail is refused, and nothing is submitted for it', async () => {
    await settle();
    const form=document.querySelector('.orma-hazard-report form');
    form.querySelector('.orma-hazard-report__place button').click();
    map.fire('click',{lngLat:{lat:46.9,lng:12.2}});

    const where=form.querySelector('.orma-hazard-report__where');
    expect(where.classList.contains('is-off')).toBe(true);
    expect(where.textContent).toContain('from this trail');

    form.querySelector('textarea').value='Guardian dogs loose on the pasture crossing';
    form.dispatchEvent(new window.Event('submit'));
    await settle();
    expect(sent[0][4]).toBeNull();
  });

  test('a report sent without placing anything still goes', async () => {
    await settle();
    const form=document.querySelector('.orma-hazard-report form');
    form.querySelector('textarea').value='Bridge plank is broken near the ford';
    form.dispatchEvent(new window.Event('submit'));
    await settle();
    expect(sent).toHaveLength(1);
    expect(sent[0][4]).toBeNull();
  });
});

describe('where there is no map', () => {
  test('the report control still works and nothing is placed', async () => {
    jest.resetModules();
    document.body.innerHTML='<div id="ormaHazardMount"></div>';
    const sent=[];
    window.OrmaHazardLocation=require('./hazard-location.js');
    delete window.DoloPawsTrailMapContext;
    window.DoloPawsAuthReady=true;
    window.DoloPawsCommunity={reportTrailHazard:(...args)=>{sent.push(args);return {ok:true};}};
    global.fetch=()=>Promise.resolve({ok:true,json:()=>({hazards:[]})});
    require('./trail-hazards.js');
    await new Promise(resolve=>setTimeout(resolve,0));

    const form=document.querySelector('.orma-hazard-report form');
    expect(form).not.toBeNull();
    expect(form.querySelector('.orma-hazard-report__place')).toBeNull();
    form.querySelector('textarea').value='Snow field across the path at the col';
    form.dispatchEvent(new window.Event('submit'));
    await new Promise(resolve=>setTimeout(resolve,0));
    expect(sent[0][4]).toBeNull();
  });
});
