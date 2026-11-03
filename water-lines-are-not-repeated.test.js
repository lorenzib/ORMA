'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const {loadProductionTrails}=require('./scripts/load-production-trails');
const {buildCanonicalCatalog}=require('./scripts/trail-adapter');
const {displayWaterLines}=require('./scripts/generate-trail-pages');

const ROOT=__dirname;

/**
 * On 3 November 2026, 67 of 427 published trails listed the same water point
 * more than once under "Water on trail": 154 repeated lines, such as "km 0 ·
 * Drinking water" four times on Dorfrundweg - Giro del Paese. They were real,
 * separate fountains a few dozen metres apart in one village, which the OSM
 * importer rounds to the same 0.1 km. The points stay in the data for the map;
 * every list a reader sees shows each km and label once, with a count.
 */
function appTrust(){
  const sandbox={window:{},console};
  sandbox.self=sandbox;sandbox.globalThis=sandbox;
  vm.createContext(sandbox);
  for(const file of ['trust/evidence-v1.js','trail-trust.js']){
    vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),sandbox,{filename:file});
  }
  return sandbox.window.DoloPawsTrailTrust;
}

const repeats=lines=>{
  const seen=new Set();
  return lines.map(line=>`km ${line.km} · ${line.label}`).filter(key=>seen.has(key)||!seen.add(key));
};

describe('a water point is listed once',()=>{
  const trust=appTrust();
  const trails=loadProductionTrails(ROOT);
  const published=new Set(buildCanonicalCatalog(trails).records
    .filter(record=>record.lifecycle==='published').map(record=>record.id));
  const live=trails.filter(trail=>published.has(trail.id));

  test('the published catalogue is loaded, with nearby fountains still in the data',()=>{
    expect(live.length).toBeGreaterThan(400);
    const giro=live.find(trail=>trail.id==='osm-19330972');
    expect(giro.waterSources.filter(point=>point.km===0)).toHaveLength(4);
  });

  test('no published trail repeats a line on its page or in the app',()=>{
    const repeated=[];
    for(const trail of live){
      const page=repeats(displayWaterLines(trail));
      const app=repeats(trust.waterLines(trail,trail.waterSources));
      if(page.length||app.length)repeated.push({id:trail.id,page,app});
    }
    expect(repeated).toEqual([]);
  });

  test('the page and the app merge the same points into the same lines',()=>{
    const disagreements=live
      .map(trail=>({id:trail.id,page:displayWaterLines(trail),app:trust.waterLines(trail,trail.waterSources)}))
      .filter(row=>JSON.stringify(row.page)!==JSON.stringify(row.app));
    expect(disagreements).toEqual([]);
  });

  test('a merged line says how many points it stands for, and every point is counted',()=>{
    const giro=live.find(trail=>trail.id==='osm-19330972');
    const lines=displayWaterLines(giro);
    expect(lines[0]).toEqual({km:0,label:'Drinking water',count:4});
    expect(lines.reduce((sum,line)=>sum+line.count,0)).toBe(giro.waterSources.length);
  });

  test('the generated page prints the merged line',()=>{
    const html=fs.readFileSync(path.join(ROOT,'trails','dorfrundweg-giro-del-paese.html'),'utf8');
    expect(html).toContain('<li>km 0 · Drinking water (4 points)</li>');
    expect(html.match(/<li>km 0 · Drinking water/g)).toHaveLength(1);
  });
});
