'use strict';

/**
 * `reconcileHazards` treats a complete successful snapshot as the authoritative
 * list of currently active warnings, so absence from it is removal evidence —
 * and a warning removed from `data/dynamic-hazards.json` disappears from the
 * public page.
 *
 * `completeSnapshot` was hardcoded `true` for any HTTP 200 whose body parsed as
 * an Atom feed. A truncated response, a partial transfer or a document cut off
 * mid-stream would therefore have authorised deleting every live warning for
 * that source, silently, and a source outage is the one case the operating
 * standard is careful about. This was the uncareful one.
 */

const {feedIsComplete,buildHazardArtifacts}=require('./workflows/dynamic-hazards');
const {fetchSource}=require('./cli/hazard-watch');

// The real connector, not a hand-made stand-in: it carries its own parse and
// completeness rules now, and a fixture that invents them tests nothing.
const {CONNECTORS}=require('./workflows/hazard-sources');
const SOURCE=CONNECTORS.find(connector=>connector.key==='meteoalarm-italy');
const AT='2026-10-09T08:00:00.000Z';

const entry=`<entry><identifier>IT-1</identifier><event>Thunderstorm</event>`
  +`<areaDesc>Trentino-Alto Adige</areaDesc><severity>Severe</severity>`
  +`<sent>2026-10-09T06:00:00Z</sent></entry>`;
const whole=body=>`<feed xmlns="http://www.w3.org/2005/Atom">${body}</feed>`;

const reply=(body,status=200)=>({ok:status>=200&&status<300,status,text:async()=>body});

describe('a feed only authorises removals when it arrived whole', () => {
  test('a quiet feed with no entries is still complete — that is the normal case', () => {
    expect(feedIsComplete(whole(''))).toBe(true);
  });

  test('a document cut off mid-stream is not complete', () => {
    expect(feedIsComplete(`<feed>${entry}`)).toBe(false);
    expect(feedIsComplete('<feed><entry><title>Stor')).toBe(false);
  });

  test('trailing whitespace does not make a whole feed look truncated', () => {
    expect(feedIsComplete(`${whole(entry)}\n\n`)).toBe(true);
  });

  test('a whole feed reports completeSnapshot, and a truncated one does not', async () => {
    const complete=await fetchSource(SOURCE,async()=>reply(whole(entry)));
    expect(complete.result).toMatchObject({ok:true,completeSnapshot:true,alertsRead:1});

    const cut=await fetchSource(SOURCE,async()=>reply(`<feed>${entry}`));
    // It still read the warning it carried — that alert is real.
    expect(cut.result).toMatchObject({ok:true,completeSnapshot:false,alertsRead:1});
    expect(cut.result.partialSnapshot).toMatch(/did not close/);
    expect(cut.observations).toHaveLength(1);
  });

  test('a partial-content response is refused outright', async () => {
    const partial=await fetchSource(SOURCE,async()=>reply(whole(entry),206));
    expect(partial.result.ok).toBe(false);
    expect(partial.result.error).toMatch(/206/);
  });
});

describe('what a partial feed may and may not do', () => {
  const previous={hazards:[{
    id:'meteoalarm-italy:IT-OLD',sourceKey:'meteoalarm-italy',sourceLabel:'MeteoAlarm Italy',
    event:'Heavy snow',area:'Trentino-Alto Adige',severity:'severe',title:'Heavy snow — Trentino',
    summary:'',expiresAt:'2026-10-20T00:00:00Z',firstPublishedAt:'2026-10-01T00:00:00Z',
  }]};
  const trails=[{id:'tre-cime',name:'Tre Cime',province:'alto-adige'}];
  // Matched on the event rather than the id: reconcile re-keys a warning to a
  // canonical `source:event:area`, so a hand-typed raw id asserts nothing.
  const events=artifacts=>artifacts.publicData.hazards.map(hazard=>hazard.event);
  const run=source=>buildHazardArtifacts(previous,[],[source],trails,{at:AT});

  test('a complete feed that no longer lists a warning removes it', () => {
    const artifacts=run({key:'meteoalarm-italy',ok:true,completeSnapshot:true,alertsRead:0});
    expect(events(artifacts)).toEqual([]);
  });

  test('a truncated feed that no longer lists it keeps it', () => {
    const artifacts=run({key:'meteoalarm-italy',ok:true,completeSnapshot:false,alertsRead:0});
    // The whole point: a body that may have been cut off is not evidence of
    // safety, exactly as an outage is not.
    expect(events(artifacts)).toEqual(['Heavy snow']);
  });

  test('an outage still keeps it, which was already true and must stay true', () => {
    const artifacts=run({key:'meteoalarm-italy',ok:false,alertsRead:0,error:'HTTP 503'});
    expect(events(artifacts)).toEqual(['Heavy snow']);
    expect(artifacts.publicData.hazards[0].sourceStatus).toBe('unavailable');
  });

  test('a truncated feed still adds the warnings it did carry', () => {
    const fresh={id:'meteoalarm-italy:IT-NEW',sourceKey:'meteoalarm-italy',
      sourceLabel:'MeteoAlarm Italy',event:'Thunderstorm',area:'Trentino-Alto Adige',
      severity:'severe',title:'Thunderstorm — Trentino',summary:'',expiresAt:'2026-10-20T00:00:00Z'};
    const artifacts=buildHazardArtifacts(previous,[fresh],
      [{key:'meteoalarm-italy',ok:true,completeSnapshot:false,alertsRead:1}],trails,{at:AT});
    // Add but not remove: the alerts a partial body carried are real.
    expect(events(artifacts).sort()).toEqual(['Heavy snow','Thunderstorm']);
  });
});
