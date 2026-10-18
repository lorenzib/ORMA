'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const {loadProductionTrails}=require('./scripts/load-production-trails');

const ROOT=__dirname;

/**
 * The page and the app must say the same thing about the same trail.
 *
 * They did not. scripts/generate-trail-pages.js granted "Verified by ORMA" once
 * six safety categories were reviewed; trail-trust.js has, since #616, granted
 * it only on the full eleven-check graduation. Measured on 18 October 2026 the
 * two disagreed about 22 live pages, each showing a green Verified seal for a
 * trail the app called Reviewed -- and with the publication lane open the
 * disagreement ran the other way too: a trail published through the reviewed
 * scope read "Imported trail" on its own page.
 *
 * Two copies of one rule, in two languages, with nothing comparing them. This
 * compares them, for every trail in the catalogue.
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

// The generator's own function, not a copy of it, so this cannot pass against
// a rule the generator has stopped using.
const {badgeForTrail,displayStartLabel,displayWaterLabel}=require('./scripts/generate-trail-pages');

describe('one badge rule for the page and the app',()=>{
  const trust=appTrust();
  const badgeFor=badgeForTrail;
  const trails=loadProductionTrails(ROOT);

  test('the catalogue is actually loaded',()=>{
    expect(trails.length).toBeGreaterThan(150);
  });

  test('every trail gets the same label on its page as on its card',()=>{
    const disagreements=trails
      .map(trail=>({id:trail.id,page:badgeFor(trail).label,app:trust.tierLabel(trail)}))
      .filter(row=>row.page!==row.app);
    expect(disagreements).toEqual([]);
  });

  test('and the same pill, so the seal looks like the seal in both places',()=>{
    const disagreements=trails
      .map(trail=>({id:trail.id,page:badgeFor(trail).style,app:trust.tierBadgeStyle(trail)}))
      .filter(row=>row.page!==row.app);
    expect(disagreements).toEqual([]);
  });

  // The rule itself, stated once: the three sealed trails and nobody else.
  test('the green seal is on the trails that earned the eleven checks',()=>{
    const sealed=trails.filter(trail=>badgeFor(trail).style==='verified').map(trail=>trail.id).sort();
    const graduated=trails.filter(trail=>trail.graduation?.status==='verified')
      .map(trail=>trail.id).sort();
    expect(sealed).toEqual(graduated);
    expect(sealed.length).toBeGreaterThan(0);
  });

  test('a reviewed trail is not sealed and is not called imported',()=>{
    const reviewed=trails.filter(trail=>badgeFor(trail).label==='Reviewed by ORMA');
    expect(reviewed.length).toBeGreaterThan(0);
    for(const trail of reviewed){
      expect(badgeFor(trail).style).toBe('neutral');
      expect(trail.graduation?.status).not.toBe('verified');
    }
  });

  // The published pages themselves, because the rule is only worth anything
  // where it has actually been run.
  test('no published page shows a seal the record has not earned',()=>{
    const slugs=JSON.parse(fs.readFileSync(path.join(ROOT,'data/regions-manifest.json'),'utf8')).trailSlug;
    const overclaiming=[];
    for(const trail of trails){
      const file=path.join(ROOT,'trails',`${slugs[trail.id]}.html`);
      if(!fs.existsSync(file))continue;
      const html=fs.readFileSync(file,'utf8');
      const sealed=html.includes('dp-badge dp-badge--verified">')||html.includes('Verified by ORMA on ');
      if(sealed&&badgeFor(trail).style!=='verified')overclaiming.push(trail.id);
    }
    expect(overclaiming).toEqual([]);
  });
});

describe('and one rule for the caveats',()=>{
  const trust=appTrust();
  const trails=loadProductionTrails(ROOT);

  // Both of these keyed off curation, which is not a review. A trail published
  // with its directions settled and its water never researched would have had
  // its mapped points titled "Water on trail" with the caveat removed, and its
  // start point printed with the raw "(OSM-verified access point)" wording.
  test('a start point reads the same on the page as in the app',()=>{
    const disagreements=trails
      .map(trail=>({id:trail.id,
        page:displayStartLabel(trail,trail.startPoint&&trail.startPoint.label),
        app:trust.startPointLabel(trail,trail.startPoint&&trail.startPoint.label)}))
      .filter(row=>row.page!==row.app);
    expect(disagreements).toEqual([]);
  });

  test('a water point reads the same on the page as in the app',()=>{
    const disagreements=[];
    for(const trail of trails){
      for(const point of Array.isArray(trail.waterSources)?trail.waterSources:[]){
        const label=point&&(point.label||point.name);
        const page=displayWaterLabel(trail,label);
        const app=trust.waterPointLabel(trail,label);
        if(page!==app)disagreements.push({id:trail.id,page,app});
      }
    }
    expect(disagreements).toEqual([]);
  });

  test('an unresearched category keeps its caveat, whatever the listing',()=>{
    const unreviewed={id:'t',curated:true,startPoint:{label:'Start here: the village car park'},
      waterSources:[{label:'Drinking water (OSM-verified location)'}]};
    expect(displayStartLabel(unreviewed,unreviewed.startPoint.label))
      .toBe('Suggested start, the village car park. Check current access before travelling.');
    expect(displayWaterLabel(unreviewed,unreviewed.waterSources[0].label))
      .toBe('Water point mapped in OpenStreetMap, availability can change');
    // And no machine wording survives into either sentence.
    expect(displayStartLabel(unreviewed,'Start here: Parking (OSM-verified access point)'))
      .not.toMatch(/OSM-verified|Start here/);
  });
});
