'use strict';

/**
 * `fetchSource` hardcoded one shape: fetch a url, parse it as an Atom feed,
 * declare the snapshot complete. Three fields per source, and no room for a
 * source that is a dated document rather than a live feed, that only publishes
 * in winter, or that names its area by code rather than in prose.
 *
 * The avalanche fixtures are the real 2026-02-25 bulletins in CAAML v6 JSON:
 * South Tyrol from avalanche.report (three bulletins, one of them covering
 * Austrian areas too) and Veneto from AINEVA. The parser was written against
 * those documents, not against a schema.
 */

const fs=require('fs');
const path=require('path');
const {CONNECTORS,inSeason,isoDay,caamlIsComplete,parseAvalancheBulletins,
  AVALANCHE_PUBLISH_FROM}=require('./workflows/hazard-sources');
const {fetchSource,withAvalancheRegions}=require('./cli/hazard-watch');
const {avalancheAppliesToTrail,avalancheDangerAt,buildHazardArtifacts}=require('./workflows/dynamic-hazards');

const SOUTH_TYROL=fs.readFileSync(
  path.join(__dirname,'fixtures/avalanche-report-2026-02-25-IT-32-BZ.json'),'utf8');
const VENETO=fs.readFileSync(
  path.join(__dirname,'fixtures/aineva-2026-02-25-IT-34.json'),'utf8');
const EUREGIO=CONNECTORS.find(connector=>connector.key==='avalanche-euregio');
const AINEVA=CONNECTORS.find(connector=>connector.key==='avalanche-aineva');
const WINTER='2026-02-25T08:00:00.000Z';
const AUTUMN='2026-10-09T08:00:00.000Z';
const reply=(body,status=200)=>({ok:status>=200&&status<300,status,text:async()=>body});
// A walk in the Gröden Dolomites micro-region, at a given high point.
const walk=(id,highPoint,regions=['IT-32-BZ-18-02'])=>({id,name:id,region:'dolomites',avalanche:{regions,highPoint}});

describe('the real bulletins, parsed', () => {
  test('one observation per bulletin, keeping only the areas its service owns', () => {
    const observations=parseAvalancheBulletins(SOUTH_TYROL,EUREGIO);
    expect(observations).toHaveLength(3);
    const ids=observations.flatMap(observation=>observation.regions.map(region=>region.id));
    // The South Tyrol file also covers Carinthia (AT-02), which is not ours.
    expect(ids.some(id=>id.startsWith('AT-02'))).toBe(false);
    expect(ids).toContain('IT-32-BZ-18-02');
    expect(ids).toContain('AT-07-15');
  });

  test('every micro-region is read, not only the first', () => {
    const groeden=parseAvalancheBulletins(SOUTH_TYROL,EUREGIO)
      .find(observation=>observation.regions.some(region=>region.id==='IT-32-BZ-18-02'));
    expect(groeden.regions.length).toBeGreaterThan(10);
    expect(groeden.regions.find(region=>region.id==='IT-32-BZ-18-02').name).toBe('Gröden Dolomites');
  });

  test('the height bands are kept, with "treeline" read as 1,800 m', () => {
    const groeden=parseAvalancheBulletins(SOUTH_TYROL,EUREGIO)
      .find(observation=>observation.regions.some(region=>region.id==='IT-32-BZ-18-02'));
    expect(groeden.bands).toEqual([{level:2,from:null,below:1800},{level:3,from:1800,below:null}]);
    const veneto=parseAvalancheBulletins(VENETO,AINEVA)[0];
    expect(veneto.bands).toEqual([{level:2,from:null,below:1800},{level:3,from:1800,below:null}]);
  });

  test('the expiry is the bulletin\'s own validity, so the existing rule removes it', () => {
    const [observation]=parseAvalancheBulletins(SOUTH_TYROL,EUREGIO);
    expect(observation.expiresAt).toBe('2026-02-25T16:00:00Z');
    expect(observation.effectiveAt).toBe('2026-02-24T16:00:00Z');
  });

  test('it carries the bulletin\'s own words rather than a generated sentence', () => {
    const [observation]=parseAvalancheBulletins(SOUTH_TYROL,EUREGIO);
    expect(observation.summary).toMatch(/avalanche situation/i);
  });

  test('a document that is not a CAAML bulletin is refused, not read as empty', () => {
    expect(()=>parseAvalancheBulletins('<html>maintenance</html>',EUREGIO))
      .toThrow(/did not return a CAAML bulletin/);
    expect(()=>parseAvalancheBulletins('{"message":"down"}',EUREGIO))
      .toThrow(/did not return a CAAML bulletin/);
  });

  test('completeness is a whole JSON document with its list of bulletins', () => {
    expect(caamlIsComplete(SOUTH_TYROL)).toBe(true);
    expect(caamlIsComplete(SOUTH_TYROL.slice(0,2000))).toBe(false);
  });
});

describe('the level that counts is the one at the walk\'s height', () => {
  const bands=[{level:2,from:null,below:1800},{level:3,from:1800,below:null}];

  test('below the band edge it is the lower level, at or above it the upper one', () => {
    expect(avalancheDangerAt(bands,1500)).toBe(2);
    expect(avalancheDangerAt(bands,1800)).toBe(3);
    expect(avalancheDangerAt(bands,2400)).toBe(3);
  });

  test('a morning and an afternoon rating for one band: the higher counts', () => {
    expect(avalancheDangerAt([{level:2,from:null,below:null},{level:3,from:null,below:null}],1200)).toBe(3);
  });

  test('from considerable (3) up it is published; moderate is a normal winter', () => {
    expect(AVALANCHE_PUBLISH_FROM).toBe(3);
    const [groeden]=parseAvalancheBulletins(SOUTH_TYROL,EUREGIO)
      .filter(observation=>observation.regions.some(region=>region.id==='IT-32-BZ-18-02'));
    expect(avalancheAppliesToTrail(groeden,walk('high',2100))).toBe(true);
    expect(avalancheAppliesToTrail(groeden,walk('valley',1500))).toBe(false);
  });

  test('a walk in other micro-regions of the same province is not matched', () => {
    const [groeden]=parseAvalancheBulletins(SOUTH_TYROL,EUREGIO)
      .filter(observation=>observation.regions.some(region=>region.id==='IT-32-BZ-18-02'));
    expect(avalancheAppliesToTrail(groeden,walk('elsewhere',2400,['IT-32-BZ-08-03']))).toBe(false);
    expect(avalancheAppliesToTrail(groeden,{id:'unmapped',name:'unmapped',province:'alto-adige'})).toBe(false);
  });
});

describe('out of season is not a failure', () => {
  test('the snow window wraps the new year', () => {
    expect(inSeason(EUREGIO.season,WINTER)).toBe(true);
    expect(inSeason(EUREGIO.season,'2026-12-20T00:00:00Z')).toBe(true);
    expect(inSeason(EUREGIO.season,AUTUMN)).toBe(false);
    // A source with no season always publishes.
    expect(inSeason(undefined,AUTUMN)).toBe(true);
  });

  test('in October it is not fetched at all, and reports ok without an error', async () => {
    let called=0;
    const run=await fetchSource(EUREGIO,async()=>{called+=1;return reply(SOUTH_TYROL);},{at:AUTUMN});

    expect(called).toBe(0);
    expect(run.result.ok).toBe(true);
    expect(run.result.error).toBeUndefined();
    expect(run.result.outOfSeason).toMatch(/publishes between/);
  });

  test('and it is NOT a complete snapshot, so it cannot remove last winter\'s warnings', async () => {
    const run=await fetchSource(EUREGIO,async()=>reply(SOUTH_TYROL),{at:AUTUMN});
    // A source that published nothing has not told us anything is over.
    expect(run.result.completeSnapshot).toBe(false);
  });
});

describe('a dated document, not a live feed', () => {
  test('today is tried first, then yesterday, because the edition lands in the afternoon', async () => {
    const asked=[];
    const run=await fetchSource(EUREGIO,async url=>{
      asked.push(url);
      return asked.length===1?reply('',404):reply(SOUTH_TYROL);
    },{at:WINTER});

    expect(asked[0]).toBe(`https://static.avalanche.report/bulletins/${isoDay(WINTER)}/${isoDay(WINTER)}_EUREGIO_en_CAAMLv6.json`);
    expect(asked[1]).toContain(`${isoDay(WINTER,-1)}_EUREGIO_en_CAAMLv6.json`);
    expect(run.result).toMatchObject({ok:true,completeSnapshot:true,alertsRead:3});
  });

  test('AINEVA is read from its own dated file', () => {
    expect(AINEVA.urls(WINTER)[0])
      .toBe('https://bollettini.aineva.it/albina_files/2026-02-25/2026-02-25_AINEVA_en_CAAMLv6.json');
  });

  test('no edition yet (both 404) is a bulletin not issued: no failure, nothing removed', async () => {
    const run=await fetchSource(EUREGIO,async()=>reply('',404),{at:WINTER});
    expect(run.result.ok).toBe(true);
    expect(run.result.completeSnapshot).toBe(false);
    expect(run.result.noBulletin).toMatch(/has not issued/);
  });

  test('a server error is still a real failure, naming each attempt', async () => {
    const run=await fetchSource(EUREGIO,async()=>reply('',503),{at:WINTER});
    expect(run.result.ok).toBe(false);
    expect(run.result.error).toMatch(/HTTP 503.*HTTP 503/);
  });

  test('a cut-off bulletin cannot be read, so it is a failure and removes nothing', async () => {
    const run=await fetchSource(EUREGIO,async()=>reply(SOUTH_TYROL.slice(0,2000)),{at:WINTER});
    expect(run.result.ok).toBe(false);
  });
});

describe('it reaches the public warning set end to end', () => {
  const build=(observations,trails,key=EUREGIO.key)=>buildHazardArtifacts({hazards:[]},observations,
    [{key,ok:true,completeSnapshot:true,alertsRead:observations.length}],trails,{at:WINTER}).publicData.hazards;

  test('a high walk gets the upper band, a valley walk in the same area nothing', () => {
    const published=build(parseAvalancheBulletins(SOUTH_TYROL,EUREGIO),[walk('seceda',2450),walk('ortisei-river',1250)]);
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      kind:'avalanche',event:'Avalanche danger',dangerLevel:3,severity:'moderate',
      area:'Gröden Dolomites',trailIds:['seceda'],expiresAt:'2026-02-25T16:00:00Z',
    });
    expect(published[0].message).toMatch(/considerable danger \(3 of 5\) at this walk's height/);
  });

  test('walks at different levels get different cards, each naming its own areas', () => {
    const published=build(parseAvalancheBulletins(SOUTH_TYROL,EUREGIO),[
      walk('seceda',2450),
      // Tuxer Alps West, in the bulletin at high (4) above the treeline.
      walk('tux',2200,['AT-07-15']),
    ]);
    expect(published.map(item=>[item.trailIds[0],item.dangerLevel,item.severity]).sort())
      .toEqual([['seceda',3,'moderate'],['tux',4,'severe']]);
  });

  test('Belluno is covered, by AINEVA', () => {
    const published=build(parseAvalancheBulletins(VENETO,AINEVA),[walk('nuvolau',2570,['IT-34-BL-02'])],AINEVA.key);
    expect(published).toHaveLength(1);
    expect(published[0].sourceLabel).toBe('AINEVA');
  });

  test('tomorrow\'s bulletin saying the same thing carries the same warning on', () => {
    const today=build(parseAvalancheBulletins(SOUTH_TYROL,EUREGIO),[walk('seceda',2450)]);
    const tomorrow=JSON.parse(SOUTH_TYROL);
    tomorrow.bulletins.forEach(bulletin=>{bulletin.bulletinID=`${bulletin.bulletinID}-next`;});
    const next=buildHazardArtifacts({hazards:today},parseAvalancheBulletins(JSON.stringify(tomorrow),EUREGIO),
      [{key:EUREGIO.key,ok:true,completeSnapshot:true}],[walk('seceda',2450)],{at:'2026-02-26T08:00:00Z'});
    expect(next.publicData.hazards).toHaveLength(1);
    expect(next.publicData.hazards[0].id).toBe(today[0].id);
    expect(next.publicData.hazards[0].firstPublishedAt).toBe(WINTER);
    expect(next.status.automaticRemovals).toEqual([]);
  });

  test('the hazard watch joins each walk to its micro-regions from the data file', () => {
    const root=path.resolve(__dirname,'..');
    const map=require('../data/trail-avalanche-regions.json').trails;
    const [id]=Object.keys(map);
    const [joined]=withAvalancheRegions([{id,name:id}],root);
    expect(joined.avalanche).toEqual(map[id]);
    // A relative root is how the CLI is often run; it must not quietly read nothing.
    const [relative]=withAvalancheRegions([{id,name:id}],path.relative(process.cwd(),root)||'.');
    expect(relative.avalanche).toEqual(map[id]);
  });
});

describe('the registry', () => {
  test('every connector declares what the watch needs from it', () => {
    for(const connector of CONNECTORS){
      expect(typeof connector.urls).toBe('function');
      expect(connector.urls('2026-02-25T00:00:00Z').length).toBeGreaterThan(0);
      expect(typeof connector.parse).toBe('function');
      expect(typeof connector.complete).toBe('function');
      expect(connector.key).toMatch(/^[a-z0-9-]+$/);
      expect(connector.label).toBeTruthy();
    }
  });

  test('the two weather feeds are unchanged and unseasonal', () => {
    const weather=CONNECTORS.filter(connector=>connector.kind==='weather-feed');
    expect(weather.map(connector=>connector.key))
      .toEqual(['meteoalarm-italy','meteoalarm-france']);
    expect(weather.every(connector=>!connector.season)).toBe(true);
    expect(weather[0].urls()[0]).toMatch(/meteoalarm-legacy-atom-italy$/);
  });
});
