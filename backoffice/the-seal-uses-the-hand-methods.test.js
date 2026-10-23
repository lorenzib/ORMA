'use strict';

const {compileVerifiedDossier,verificationRecord}=require('./workflows/compile-verified-dossier');
const {editorialItem}=require('./workflows/verified-editorial-handoff');
const {graduationFor,SAFETY_CHECKS,SETTLED_FOR_SEAL}=require('./workflows/build-publication-staging');
const {singleRelationGuidance}=require('./workflows/route-guidance-from-map');
const {researchMethodHolds,dogRuleBasis,lineSamples,lineLengthKm,NATIONAL_DOG_DEFAULT,
  PHOTO_MAX_OFF_LINE_M}=require('./workflows/research-methods');

/**
 * The seal is earned the way hand verification earns it (23 October 2026).
 *
 * Every fixture here goes through the real chain -- an agent's claims, the
 * dossier compiler, the editorial handoff -- so the facts the seal reads are
 * the ones the producers write, not a hand-typed copy of them. Each rule is
 * shown holding a walk that breaks it and passing one that meets it.
 */

const AT='2026-10-23T10:00:00Z';

// A loop of a kilometre's radius around Lozzo di Cadore: 6.28 km of line,
// built rather than typed so its length is a measurement.
function loop(radiusM=1000,lat0=46.48,lng0=12.44){
  const R=6371000,dLat=radiusM/R*(180/Math.PI),dLng=dLat/Math.cos(lat0*Math.PI/180);
  const points=[];
  for(let i=0;i<=360;i+=1){const a=2*Math.PI*i/360;points.push([lat0+dLat*Math.sin(a),lng0+dLng*Math.cos(a)]);}
  return points;
}
const PATH=loop();
const LINE_KM=lineLengthKm(PATH);

const TOURISM={label:'Anello di Lozzo',url:'https://www.dolomiti.it/it/escursioni/anello-lozzo',authority:'Consorzio Turistico Dolomiti',accessedAt:AT};
const COMMUNE_PAGE={label:'Regolamento cani',url:'https://www.comune.lozzodicadore.bl.it/regolamento-cani',authority:'Comune di Lozzo di Cadore',accessedAt:AT};
const EEA={label:'Natura 2000 viewer',url:'https://natura2000.eea.europa.eu/?query=IT3230089',authority:'European Environment Agency',accessedAt:AT};
const OSM={label:'Relation',url:'https://www.openstreetmap.org/relation/11839597',authority:'OpenStreetMap',accessedAt:AT};

const claim=(id,fields={})=>({id,category:'elevation',finding:'supported-proposal',confidence:0.9,
  proposedValue:`${id} established`,rationale:'Read on the authority page.',sources:[TOURISM],blockers:[],
  entityName:null,rule:'not-applicable',observedAt:null,location:null,variesWith:null,basis:null,figure:null,...fields});

function figures(overrides={}){
  return [
    claim('official-distance',{basis:'published',figure:Math.round(LINE_KM*10)/10,...overrides['official-distance']}),
    claim('official-ascent',{basis:'published',figure:180,...overrides['official-ascent']}),
    claim('official-walking-time',{basis:'published',figure:120,...overrides['official-walking-time']}),
  ];
}

function ranger(overrides={}){
  return [
    claim('commune-on-line-lozzo-di-cadore',{category:'access',entityName:'Lozzo di Cadore',
      proposedValue:'Samples at km 0, 1, 2, 5 and 6.3 fall in Lozzo di Cadore.'}),
    claim('commune-dog-rule-lozzo-di-cadore',{category:'access',entityName:'Lozzo di Cadore',basis:'published',
      sources:[COMMUNE_PAGE],proposedValue:'Dogs on a lead in the village centre.'}),
    ...(overrides.secondCommune?[
      claim('commune-on-line-domegge-di-cadore',{category:'access',entityName:'Domegge di Cadore',
        proposedValue:'Samples at km 3 and 4 fall in Domegge di Cadore.'}),
      ...(overrides.secondRule?[claim('commune-dog-rule-domegge-di-cadore',{category:'access',
        entityName:'Domegge di Cadore',...overrides.secondRule})]:[]),
    ]:[]),
    ...(overrides.protectedAreas===null?[]:[claim('protected-areas',{category:'access',
      proposedValue:'The line touches no Natura 2000 site; IT3230089 returned as a control.',
      sources:[EEA],...overrides.protectedAreas})]),
  ];
}

const survey={routeGuidance:singleRelationGuidance({tags:{ref:'20'}}),
  relation:{tags:{name:'Anello di Lozzo',ref:'20'}},
  source:{url:'https://www.openstreetmap.org/relation/11839597',externalId:'relation/11839597',
    endpoint:'https://api.openstreetmap.org/api/0.6/relation/11839597/full',
    relationVersion:3,relationTimestamp:'2026-09-01T00:00:00Z',licence:'ODbL-1.0'},
  geometry:{type:'LineString',coordinates:PATH.map(([lat,lng])=>[lng,lat])},
  assessment:{issues:[],pointCount:PATH.length,distanceKm:LINE_KM}};

const trail={candidateId:'osm-11839597',trailId:'osm-11839597',trailName:'Anello di Lozzo',
  region:'dolomites',routeShape:'loop',path:PATH,startPoint:{lat:46.48,lng:12.45,label:'Piazza di Lozzo'},
  heroImage:'images/trails/anello.jpg',imageIcon:'images/trails/anello.jpg',
  imageGeotag:{lat:46.48,lng:12.453},imagePlace:'Lozzo di Cadore'};

/** The facts the seal reads, produced by the real chain from these agent answers. */
function itemFor({terrain=figures(),rangerClaims=ranger()}={}){
  const review={reviewId:'r',approvalAllowed:true,blockingReasons:[],specialistOutputs:[
    {agentId:'cartographer',jobId:'c1',result:survey},
    {agentId:'terrainPoi',jobId:'t1',result:{claims:terrain}},
    {agentId:'regulatoryRanger',jobId:'g1',result:{claims:rangerClaims}},
  ]};
  const dossier=compileVerifiedDossier(review,trail,{at:AT,trail});
  return {item:editorialItem(dossier,verificationRecord(dossier),AT),dossier};
}

const holdsFor=(options={},record=trail)=>researchMethodHolds(itemFor(options).item,record).holds;

describe('the seal holds on the methods that verify a walk by hand',()=>{
  test('a walk that meets every method is held by none of them, and graduates',()=>{
    const {holds}=researchMethodHolds(itemFor().item,trail);
    expect(holds).toEqual([]);
    expect(graduationFor([...SAFETY_CHECKS],true,true,[...SETTLED_FOR_SEAL],{researchHolds:holds}).status)
      .toBe('verified');
  });

  test('any hold keeps it reviewed, and says why',()=>{
    const graduation=graduationFor([...SAFETY_CHECKS],true,true,[...SETTLED_FOR_SEAL],
      {researchHolds:['official-climb-unpublished']});
    expect(graduation.status).toBe('in-progress');
    expect(graduation.heldFor).toContain('official-climb-unpublished');
  });

  describe('1. an authority publishes the climb and the walking time',()=>{
    test('a climb ORMA measured holds the seal',()=>{
      expect(holdsFor({terrain:figures({'official-ascent':{basis:'measured'}})}))
        .toContain('official-climb-unpublished');
    });
    test('an estimated walking time holds the seal',()=>{
      expect(holdsFor({terrain:figures({'official-walking-time':{basis:'estimated'}})}))
        .toContain('official-time-unpublished');
    });
    test('a figure cited only to the map holds it too',()=>{
      expect(holdsFor({terrain:figures({'official-ascent':{sources:[OSM]}})}))
        .toContain('official-climb-unpublished');
    });
    test('the fast lane, with no terrain answer at all, is held',()=>{
      const held=holdsFor({terrain:[]});
      expect(held).toEqual(expect.arrayContaining(['official-climb-unpublished','official-time-unpublished']));
    });
    test('both published by an authority: nothing held for figures',()=>{
      const held=holdsFor();
      expect(held).not.toContain('official-climb-unpublished');
      expect(held).not.toContain('official-time-unpublished');
    });
  });

  describe('2. every municipality the line crosses, with its dog rule',()=>{
    test('a second commune with no rule holds the seal',()=>{
      const {item}=itemFor({rangerClaims:ranger({secondCommune:true})});
      const result=researchMethodHolds(item,trail);
      expect(result.holds).toContain('dog-rule-unsettled');
      expect(result.detail.join(' ')).toContain('Domegge di Cadore');
    });
    test('no municipality established at all holds the seal',()=>{
      expect(holdsFor({rangerClaims:[]})).toContain('communes-unchecked');
    });
    test('no protected-area check against the EEA holds the seal',()=>{
      expect(holdsFor({rangerClaims:ranger({protectedAreas:null})})).toContain('protected-areas-unchecked');
      expect(holdsFor({rangerClaims:ranger({protectedAreas:{sources:[COMMUNE_PAGE]}})}))
        .toContain('protected-areas-unchecked');
    });
    test('each commune with a published rule: nothing held',()=>{
      const held=holdsFor({rangerClaims:ranger({secondCommune:true,
        secondRule:{basis:'published',sources:[COMMUNE_PAGE]}})});
      expect(held).not.toContain('dog-rule-unsettled');
      expect(held).not.toContain('communes-unchecked');
    });
  });

  describe('3. the Italian national default settles an unpublished commune rule',()=>{
    const national={basis:'national-default',sources:[COMMUNE_PAGE],
      proposedValue:'No municipal rule is published; the national ordinance of 2013 applies.'};
    test('in Italy it settles the commune, and the record says so',()=>{
      const {item,dossier}=itemFor({rangerClaims:ranger({secondCommune:true,secondRule:national})});
      expect(researchMethodHolds(item,trail).holds).not.toContain('dog-rule-unsettled');
      const recorded=dossier.ormaVerification.dogRuleBasis.find(entry=>entry.commune==='Domegge di Cadore');
      expect(recorded).toEqual({commune:'Domegge di Cadore',basis:'national-default',
        statement:NATIONAL_DOG_DEFAULT.statement});
      expect(dogRuleBasis(item)).toEqual(dossier.ormaVerification.dogRuleBasis);
    });
    test('outside Italy there is no default, and the commune stays unsettled',()=>{
      const {item}=itemFor({rangerClaims:ranger({secondCommune:true,secondRule:national})});
      expect(researchMethodHolds(item,{...trail,region:'savoy'}).holds).toContain('dog-rule-unsettled');
    });
    test('it still needs the protected-area check',()=>{
      expect(holdsFor({rangerClaims:ranger({secondCommune:true,secondRule:national,protectedAreas:null})}))
        .toContain('protected-areas-unchecked');
    });
  });

  describe('4. the line is as long as the walk its authority publishes',()=>{
    test('a line a third short of the published distance holds the seal',()=>{
      const result=researchMethodHolds(itemFor({terrain:figures({'official-distance':{figure:9.5}})}).item,trail);
      expect(result.holds).toContain('line-differs-from-official');
      expect(result.detail.join(' ')).toMatch(/9\.5 km/);
    });
    test('no published distance to check against holds it',()=>{
      expect(holdsFor({terrain:figures({'official-distance':{basis:'measured'}})}))
        .toContain('official-distance-unpublished');
    });
    test('an out-and-back published with its return leg is the same walk',()=>{
      const out={...trail,routeShape:'out-and-back'};
      expect(holdsFor({terrain:figures({'official-distance':{figure:Math.round(LINE_KM*20)/10}})},out))
        .not.toContain('line-differs-from-official');
    });
    test('within ten per cent: nothing held',()=>{
      expect(holdsFor({terrain:figures({'official-distance':{figure:Math.round(LINE_KM*1.08*10)/10}})}))
        .not.toContain('line-differs-from-official');
    });
  });

  describe('5. the photograph is of this walk, at this place',()=>{
    test('a photograph taken kilometres away holds the seal',()=>{
      const far={...trail,imageGeotag:{lat:46.55,lng:12.44}};
      expect(holdsFor({},far)).toContain('photo-off-the-line');
    });
    test('a photograph labelled with a different town holds it',()=>{
      expect(holdsFor({},{...trail,imagePlace:'Auronzo di Cadore'})).toContain('photo-wrong-place');
    });
    test('a photograph with no geotag and no place label cannot be checked, and holds it',()=>{
      expect(holdsFor({},{...trail,imageGeotag:undefined,imagePlace:undefined})).toContain('photo-place-unconfirmed');
    });
    test('a geotag within a kilometre of the line, in the right town: nothing held',()=>{
      const held=holdsFor();
      expect(held.filter(id=>id.startsWith('photo-'))).toEqual([]);
      expect(PHOTO_MAX_OFF_LINE_M).toBe(1000);
    });
  });
});

describe('samples run the whole line',()=>{
  test('a loop is asked about on its far side, not only at the start',()=>{
    const samples=lineSamples(PATH);
    expect(samples[0].kind).toBe('start');
    expect(samples.at(-1).kind).toBe('end');
    expect(samples.some(sample=>sample.kind==='farthest-from-start')).toBe(true);
    // One a kilometre between, so a 6.3 km loop is asked about at least six times.
    expect(samples.length).toBeGreaterThanOrEqual(7);
    const far=samples.find(sample=>sample.kind==='farthest-from-start');
    expect(far.lng).toBeLessThan(12.44);
  });
});
