'use strict';

/**
 * `fetchSource` hardcoded one shape: fetch a url, parse it as an Atom feed,
 * declare the snapshot complete. Three fields per source, and no room for a
 * source that is a dated document rather than a live feed, that only publishes
 * in winter, or that names its area by code rather than in prose.
 *
 * The avalanche fixture is the real 2026-02-25 South Tyrol bulletin, trimmed to
 * its three `<Bulletin>` blocks. The parser was written against that document,
 * not against a schema.
 */

const fs=require('fs');
const path=require('path');
const {CONNECTORS,inSeason,isoDay,caamlIsComplete,parseAvalancheBulletin,
  AVALANCHE_PUBLISH_FROM}=require('./workflows/hazard-sources');
const {fetchSource}=require('./cli/hazard-watch');
const {avalancheAppliesToTrail,buildHazardArtifacts}=require('./workflows/dynamic-hazards');

const BULLETIN=fs.readFileSync(
  path.join(__dirname,'fixtures/avalanche-report-2026-02-25-IT-32-BZ.xml'),'utf8');
const SOUTH_TYROL=CONNECTORS.find(connector=>connector.key==='avalanche-south-tyrol');
const WINTER='2026-02-25T08:00:00.000Z';
const AUTUMN='2026-10-09T08:00:00.000Z';
const reply=(body,status=200)=>({ok:status>=200&&status<300,status,text:async()=>body});

describe('the real bulletin, parsed', () => {
  test('only the dangerous band is published, and the quiet ones are dropped', () => {
    const observations=parseAvalancheBulletin(BULLETIN,SOUTH_TYROL);

    // The document carries three sub-regions at danger 4, 3 and 2. ORMA's trails
    // are valley dog walks, so a moderate rating is not news for them and
    // publishing all three would bury the one that matters.
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      regionCode:'IT-32-BZ-05-03',dangerLevel:4,severity:'severe',
      // The event is the kind, so the display template reads as a sentence.
      event:'Avalanche danger',dangerWord:'high',
    });
    expect(AVALANCHE_PUBLISH_FROM).toBe(4);
  });

  test('the expiry is the bulletin\'s own validity, so the existing rule removes it', () => {
    const [observation]=parseAvalancheBulletin(BULLETIN,SOUTH_TYROL);
    expect(observation.expiresAt).toBe('2026-02-25T16:00:00Z');
    expect(observation.effectiveAt).toBe('2026-02-24T16:00:00Z');
  });

  test('it carries the bulletin\'s own words rather than a generated sentence', () => {
    const [observation]=parseAvalancheBulletin(BULLETIN,SOUTH_TYROL);
    expect(observation.summary).toMatch(/avalanche situation/i);
  });

  test('the id is the region and the day, so re-reading reconciles rather than duplicating', () => {
    const [first]=parseAvalancheBulletin(BULLETIN,SOUTH_TYROL);
    const [again]=parseAvalancheBulletin(BULLETIN,SOUTH_TYROL);
    expect(first.id).toBe(again.id);
    expect(first.id).toBe('avalanche-south-tyrol:IT-32-BZ-05-03:2026-02-24');
  });

  test('a document that is not a CAAML bulletin is refused, not read as empty', () => {
    expect(()=>parseAvalancheBulletin('<html>maintenance</html>',SOUTH_TYROL))
      .toThrow(/did not return a CAAML bulletin/);
  });

  test('completeness is the closing tag, same rule as the feeds', () => {
    expect(caamlIsComplete(BULLETIN)).toBe(true);
    expect(caamlIsComplete(BULLETIN.slice(0,9000))).toBe(false);
  });
});

describe('out of season is not a failure', () => {
  test('the snow window wraps the new year', () => {
    expect(inSeason(SOUTH_TYROL.season,WINTER)).toBe(true);
    expect(inSeason(SOUTH_TYROL.season,'2026-12-20T00:00:00Z')).toBe(true);
    expect(inSeason(SOUTH_TYROL.season,AUTUMN)).toBe(false);
    // A source with no season always publishes.
    expect(inSeason(undefined,AUTUMN)).toBe(true);
  });

  test('in October it is not fetched at all, and reports ok without an error', async () => {
    let called=0;
    const run=await fetchSource(SOUTH_TYROL,async()=>{called+=1;return reply(BULLETIN);},{at:AUTUMN});

    expect(called).toBe(0);
    expect(run.result.ok).toBe(true);
    expect(run.result.error).toBeUndefined();
    expect(run.result.outOfSeason).toMatch(/publishes between/);
  });

  test('and it is NOT a complete snapshot, so it cannot remove last winter\'s warnings', async () => {
    const run=await fetchSource(SOUTH_TYROL,async()=>reply(BULLETIN),{at:AUTUMN});
    // A source that published nothing has not told us anything is over.
    expect(run.result.completeSnapshot).toBe(false);
  });
});

describe('a dated document, not a live feed', () => {
  test('today is tried first, then yesterday, because the edition lands in the afternoon', async () => {
    const asked=[];
    const run=await fetchSource(SOUTH_TYROL,async url=>{
      asked.push(url);
      return asked.length===1?reply('',404):reply(BULLETIN);
    },{at:WINTER});

    expect(asked[0]).toContain(`${isoDay(WINTER)}_IT-32-BZ_en.xml`);
    expect(asked[1]).toContain(`${isoDay(WINTER,-1)}_IT-32-BZ_en.xml`);
    expect(run.result).toMatchObject({ok:true,completeSnapshot:true,alertsRead:1});
  });

  test('both editions missing in season is a real failure, naming each attempt', async () => {
    const run=await fetchSource(SOUTH_TYROL,async()=>reply('',404),{at:WINTER});
    expect(run.result.ok).toBe(false);
    expect(run.result.error).toMatch(/HTTP 404.*HTTP 404/);
  });

  test('a truncated bulletin may add what it carried but not remove', async () => {
    const run=await fetchSource(SOUTH_TYROL,async()=>reply(BULLETIN.slice(0,9000)),{at:WINTER});
    expect(run.result.completeSnapshot).toBe(false);
    expect(run.result.partialSnapshot).toMatch(/did not close/);
  });
});

describe('a bulletin is matched by region code, not by searching prose', () => {
  const trail=(id,province)=>({id,name:id,province,region:'dolomites'});

  test('South Tyrol reaches an alto-adige trail and not a trentino one', () => {
    const alert={regionCode:'IT-32-BZ-05-03'};
    expect(avalancheAppliesToTrail(alert,trail('tre-cime','alto-adige'))).toBe(true);
    expect(avalancheAppliesToTrail(alert,trail('brenta','trentino'))).toBe(false);
    expect(avalancheAppliesToTrail(alert,trail('nuvolau','belluno'))).toBe(false);
  });

  test('Trentino reaches a trentino trail', () => {
    expect(avalancheAppliesToTrail({regionCode:'IT-32-TN-07'},trail('brenta','trentino'))).toBe(true);
  });

  test('an unknown region code matches nothing rather than everything', () => {
    expect(avalancheAppliesToTrail({regionCode:'AT-07-10'},trail('tre-cime','alto-adige'))).toBe(false);
    expect(avalancheAppliesToTrail({regionCode:''},trail('tre-cime','alto-adige'))).toBe(false);
  });

  test('it reaches the public warning set end to end', () => {
    const observations=parseAvalancheBulletin(BULLETIN,SOUTH_TYROL);
    const artifacts=buildHazardArtifacts({hazards:[]},observations,
      [{key:SOUTH_TYROL.key,ok:true,completeSnapshot:true,alertsRead:observations.length}],
      [trail('tre-cime','alto-adige'),trail('brenta','trentino')],{at:WINTER});
    const published=artifacts.publicData.hazards;

    expect(published).toHaveLength(1);
    expect(published[0].event).toBe('Avalanche danger');
    // The field is trailIds, not a hand-typed guess at the producer's shape.
    expect(published[0].trailIds).toEqual(['tre-cime']);
    expect(published[0].expiresAt).toBe('2026-02-25T16:00:00Z');
    // The standard's rule, carried automatically by the display template.
    expect(published[0].message).toMatch(/not a trail-closure notice/);
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
