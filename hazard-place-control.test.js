/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://app-orma.com/trail.html?id=giro-del-bulacia"}
 */
const fs=require('fs');

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
  const settle=()=>new Promise(resolve=>setTimeout(resolve,0));

  beforeEach(async () => {
    jest.resetModules();
    trail=loadTrail('giro-del-bulacia');
    map=stubMap();
    sent=[];
    document.body.innerHTML=`
      <div id="ormaHazardMount"></div>
      <div id="trailMapBox"><button id="addReportBtn" type="button">Report a hazard</button></div>
      <section id="td2Hazards"><div id="trailFlagsList">
        <div id="trailPublishedHazards"></div><div id="trailLegacyHazards"></div>
        <div id="trailHazardsPending"></div><div id="trailHazardsEmpty"></div>
      </div></section>`;

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
    await settle();
    document.getElementById('addReportBtn').click();
  });

  test('a tap on the route is submitted as a km along it and shown as pending', async () => {
    const panel=document.querySelector('.orma-hazard-report');
    const form=panel.querySelector('form');
    const place=panel.querySelector('[data-hazard-place]');
    expect(panel.closest('#trailMapBox')).not.toBeNull();
    expect(form.hidden).toBe(true);
    expect(place.textContent).toBe('Tap the trail line now');

    const [lat,lng]=trail.path[10];
    map.fire('click',{lngLat:{lat,lng}});

    const where=panel.querySelector('[data-hazard-where]');
    expect(where.textContent).toContain('km along the route');
    expect(where.classList.contains('is-off')).toBe(false);
    expect(place.textContent).toBe('Move the pin');
    expect(form.hidden).toBe(false);

    form.querySelector('textarea').value='Guardian dogs loose on the pasture crossing';
    form.dispatchEvent(new window.Event('submit'));
    await settle();

    expect(sent).toHaveLength(1);
    const location=sent[0][4];
    expect(location.km).toBeGreaterThan(0);
    expect(location.onRoute).toBe(true);
    expect(location.offRouteM).toBeLessThanOrEqual(1);
    expect(document.querySelector('[data-hazard-pending]').textContent).toContain('being checked');
  });

  test('a tap far from the trail is refused until the user skips location', async () => {
    const panel=document.querySelector('.orma-hazard-report');
    map.fire('click',{lngLat:{lat:46.9,lng:12.2}});

    const where=panel.querySelector('[data-hazard-where]');
    expect(where.classList.contains('is-off')).toBe(true);
    expect(where.textContent).toContain('from this trail');
    expect(panel.querySelector('form').hidden).toBe(true);

    panel.querySelector('[data-hazard-skip]').click();
    const form=panel.querySelector('form');
    form.querySelector('textarea').value='Guardian dogs loose on the pasture crossing';
    form.dispatchEvent(new window.Event('submit'));
    await settle();
    expect(sent[0][4]).toBeNull();
  });

  test('skipping map placement still sends the report without a position', async () => {
    const panel=document.querySelector('.orma-hazard-report');
    panel.querySelector('[data-hazard-skip]').click();
    const form=panel.querySelector('form');
    form.querySelector('textarea').value='Bridge plank is broken near the ford';
    form.dispatchEvent(new window.Event('submit'));
    await settle();
    expect(sent).toHaveLength(1);
    expect(sent[0][4]).toBeNull();
  });
});

describe('where there is no map', () => {
  test('the control requests the map and never renders a detached form', async () => {
    jest.resetModules();
    document.body.innerHTML='<button id="addReportBtn">Report a hazard</button><div id="ormaHazardMount"></div>';
    window.OrmaHazardLocation=require('./hazard-location.js');
    delete window.DoloPawsTrailMapContext;
    const start=jest.fn();
    window.DoloPawsStartTrailMap=start;
    global.fetch=()=>Promise.resolve({ok:true,json:()=>({hazards:[]})});
    require('./trail-hazards.js');
    await new Promise(resolve=>setTimeout(resolve,0));

    document.getElementById('addReportBtn').click();
    expect(start).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.orma-hazard-report')).toBeNull();
    expect(document.getElementById('addReportBtn').getAttribute('aria-busy')).toBe('true');
  });
});
