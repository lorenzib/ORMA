'use strict';

const {communesAlongLine,communesQuery,protectedAreasOnLine,natura2000Control,photoLocation,
  officialDistanceFromSource,lineAgainstOfficial,freeSealChecksFor,problemsIn,
  NATURA2000_CONTROL,OVERPASS_WAIT_MS}=require('./workflows/free-seal-checks');
const {mergedWithPrevious,inCheckingOrder}=require('./cli/free-seal-checks');
const {researchMethodHolds,lineLengthKm}=require('./workflows/research-methods');

/**
 * The free checks behind the seal. Every network answer here is a stub shaped
 * like the service's own reply, so nothing is fetched and nothing is spent.
 */

function loop(radiusM=1000,lat0=46.48,lng0=12.44){
  const R=6371000,dLat=radiusM/R*(180/Math.PI),dLng=dLat/Math.cos(lat0*Math.PI/180);
  return Array.from({length:361},(_,i)=>{const a=2*Math.PI*i/360;return [lat0+dLat*Math.sin(a),lng0+dLng*Math.cos(a)];});
}
const PATH=loop();
const LINE_KM=lineLengthKm(PATH);

const overpass=(...names)=>async()=>({endpoint:'https://overpass-api.de/api/interpreter',
  payload:{elements:names.map((name,i)=>({type:'area',id:3600000000+i,tags:{name,admin_level:'8'}}))}});

const eeaReply=(codes)=>({ok:true,json:async()=>({features:codes.map(code=>({attributes:{SITECODE:code,SITENAME:`Site ${code}`}}))})});

describe('municipalities along the whole line',()=>{
  test('every sample is asked, including the far side of a loop',()=>{
    const query=communesQuery([{lat:46.48,lng:12.45},{lat:46.48,lng:12.43}]);
    expect(query).toContain('is_in(46.480000,12.450000)');
    expect(query).toContain('is_in(46.480000,12.430000)');
    expect(query).toContain('admin_level=8');
  });

  test('a loop crossing two communes names both',async()=>{
    const result=await communesAlongLine(PATH,{runQuery:overpass('Lozzo di Cadore','Domegge di Cadore'),retryPauseMs:0});
    expect(result.status).toBe('checked');
    expect(result.communes.map(commune=>commune.name)).toEqual(['Domegge di Cadore','Lozzo di Cadore']);
  });

  test('a mirror that answers with no municipality is a failed lookup, never "none"',async()=>{
    await expect(communesAlongLine(PATH,{runQuery:overpass(),retryPauseMs:0,
      endpoints:['https://overpass.kumi.systems/api/interpreter']})).rejects.toThrow('No mirror named a municipality');
  });

  test('an empty mirror is passed over for one that answers',async()=>{
    let calls=0;
    const runQuery=async(query,options)=>{calls+=1;
      return options.endpoints[0].includes('kumi')?overpass()():overpass('Prags - Braies')();};
    const result=await communesAlongLine(PATH,{runQuery,retryPauseMs:0,
      endpoints:['https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter']});
    expect(result.communes.map(commune=>commune.name)).toEqual(['Prags - Braies']);
    expect(calls).toBe(2);
  });
});

describe('protected areas, with a control site',()=>{
  test('the sites the line touches are recorded with the control that proved the service answers',async()=>{
    const fetchImpl=async(url,init)=>eeaReply(String(init.body).includes('12.082')?[NATURA2000_CONTROL.code]:['IT3230089']);
    const result=await protectedAreasOnLine(PATH,{fetchImpl});
    expect(result.status).toBe('checked');
    expect(result.control.found).toBe(true);
    expect(result.sites.map(site=>site.code)).toEqual(['IT3230089']);
  });

  test('if the control site does not come back, an empty answer is not trusted',async()=>{
    const fetchImpl=async()=>eeaReply([]);
    const result=await protectedAreasOnLine(PATH,{fetchImpl});
    expect(result.status).toBe('service-unreliable');
    expect((await natura2000Control({fetchImpl})).found).toBe(false);
  });
});

describe('where the photograph was taken',()=>{
  const json=data=>({ok:true,json:async()=>data});
  test('Wikimedia Commons: the camera position',async()=>{
    const fetchImpl=async()=>json({query:{pages:[{coordinates:[
      {lat:46.0,lon:12.0},{lat:46.4801,lon:12.4531,primary:''}]}]}});
    const result=await photoLocation({heroImage:'x.jpg',imageSourcePage:'https://commons.wikimedia.org/wiki/File:A.jpg'},{fetchImpl});
    expect(result).toEqual({status:'located',geotag:{lat:46.4801,lng:12.4531},from:'wikimedia-commons'});
  });
  test('Panoramax and iNaturalist: the point they publish',async()=>{
    const panoramax=await photoLocation({heroImage:'x',imageSourcePage:'https://panoramax.ign.fr/api/collections/c/items/i'},
      {fetchImpl:async()=>json({geometry:{coordinates:[6.3,45.2]}})});
    expect(panoramax.geotag).toEqual({lat:45.2,lng:6.3});
    const inat=await photoLocation({heroImage:'x',imageSourcePage:'https://www.inaturalist.org/observations/294576616'},
      {fetchImpl:async()=>json({results:[{geojson:{coordinates:[11.9,46.5]}}]})});
    expect(inat.geotag).toEqual({lat:46.5,lng:11.9});
  });
  test('a host that needs a key says so rather than guessing',async()=>{
    expect((await photoLocation({heroImage:'x',imageSourcePage:'https://www.mapillary.com/app/?pKey=1'})).status)
      .toBe('host-not-supported');
    expect((await photoLocation({})).status).toBe('no-photo');
  });
});

describe('the line against the official distance ORMA recorded',()=>{
  test('one distance in the official quote is read; two are not guessed between',()=>{
    expect(officialDistanceFromSource({quote:'Distance 6.8km · Dénivelé positif 382m · Durée 03h00'}).km).toBe(6.8);
    expect(officialDistanceFromSource({quote:'1h00 · 3,509 km · 16 m'}).km).toBe(3.509);
    expect(officialDistanceFromSource({quote:'4 km loop, or 7 km with the variant'})).toBeNull();
    expect(officialDistanceFromSource({quote:'A pleasant walk'})).toBeNull();
  });
  test('a line a third short is found, one within ten per cent is not',()=>{
    const trail={path:PATH,routeShape:'loop'};
    expect(lineAgainstOfficial(trail,{quote:'9.5 km'}).status).toBe('differs');
    expect(lineAgainstOfficial(trail,{quote:`${(LINE_KM*1.05).toFixed(1)} km`}).status).toBe('matches');
    expect(lineAgainstOfficial(trail,null).status).toBe('no-published-distance');
  });
});

describe('a run of the checks',()=>{
  const fetchImpl=async(url,init)=>{
    if(String(url).includes('discomap'))return eeaReply(String(init.body).includes('12.082')?[NATURA2000_CONTROL.code]:[]);
    return {ok:true,json:async()=>({query:{pages:[{coordinates:[{lat:46.55,lon:12.44,primary:''}]}]}})};
  };
  const trail={id:'osm-1',path:PATH,routeShape:'loop',heroImage:'x.jpg',
    imageSourcePage:'https://commons.wikimedia.org/wiki/File:Far.jpg'};

  test('it records each check and names what needs a person to look',async()=>{
    const entry=await freeSealChecksFor(trail,{fetchImpl,runQuery:overpass('Lozzo di Cadore','Domegge di Cadore'),
      retryPauseMs:0,routeSource:{quote:'9.5 km',url:'https://example.test',publisher:'Board'},at:'2026-10-23T10:00:00Z'});
    expect(entry.photo.onTheWalk).toBe(false);
    const problems=problemsIn(entry).join(' | ');
    expect(problems).toMatch(/photograph was taken \d+\.\d km from the walk/);
    expect(problems).toMatch(/official page says 9\.5 km/);
    expect(problems).toMatch(/crosses 2 municipalities/);
  });

  test('a lookup that fails is recorded and the others still run',async()=>{
    const entry=await freeSealChecksFor(trail,{fetchImpl,retryPauseMs:0,
      runQuery:async()=>{throw new Error('Overpass returned HTTP 502');}});
    expect(entry.communes.status).toBe('lookup-failed');
    expect(entry.protectedAreas.status).toBe('checked');
  });

  test('an outage keeps the last real answer, never an empty one',()=>{
    const failed={communes:{status:'lookup-failed',error:'502'}};
    const good={communes:{status:'checked',communes:[{name:'Lozzo di Cadore'}]}};
    expect(mergedWithPrevious(failed,good,'T').communes).toMatchObject({status:'checked',staleSince:'T',lastError:'502'});
    const empty={communes:{status:'checked',communes:[]}};
    expect(mergedWithPrevious(failed,empty,'T').communes.status).toBe('lookup-failed');
    const measured={protectedAreas:{status:'checked',sites:[{code:'IT3110049'}]}};
    const outage={protectedAreas:{status:'service-unreliable',sites:[]}};
    expect(mergedWithPrevious(outage,measured,'T').protectedAreas)
      .toMatchObject({status:'checked',sites:[{code:'IT3110049'}],staleSince:'T'});
  });
});

describe('a run that cannot check every trail at once',()=>{
  test('never-checked trails go first, then the oldest check, so the next run carries on',()=>{
    const trails=['a','b','c','d'].map(id=>({id}));
    const previous={trails:{a:{checkedAt:'2026-10-26T05:00:00Z'},b:{checkedAt:'2026-10-19T05:00:00Z'},
      d:{checkedAt:'2026-10-26T04:50:00Z'}}};
    expect(inCheckingOrder(trails,previous).map(trail=>trail.id)).toEqual(['c','b','d','a']);
    expect(inCheckingOrder(trails,null).map(trail=>trail.id)).toEqual(['a','b','c','d']);
  });

  test('a silent mirror is given up on, not waited on for three minutes',async()=>{
    const waits=[];
    const runQuery=async(query,options)=>{waits.push(options.timeoutMs);
      return {endpoint:options.endpoints[0],payload:{elements:[{id:1,tags:{name:'Braies'}}]}};};
    await communesAlongLine([[46.69,12.08],[46.70,12.09]],{runQuery,endpoints:['https://one.example/api'],retryPauseMs:0});
    expect(waits).toEqual([OVERPASS_WAIT_MS]);
    expect(OVERPASS_WAIT_MS).toBeLessThan(180000);
  });

  test('a photo host that never answers is abandoned with a time limit',async()=>{
    let signal=null;
    const fetchImpl=async(url,init)=>{signal=init.signal;return {ok:true,json:async()=>({query:{pages:[{coordinates:[]}]}})};};
    await photoLocation({heroImage:'x.jpg',imageSourcePage:'https://commons.wikimedia.org/wiki/File:X.jpg'},{fetchImpl});
    expect(signal).toBeInstanceOf(AbortSignal);
  });
});

describe('the seal reads what the free checks measured',()=>{
  const free={communes:{status:'checked',communes:[{name:'Lozzo di Cadore'}]},
    protectedAreas:{status:'checked',sites:[],control:{found:true}},
    photo:{status:'located',geotag:{lat:46.48,lng:12.453}},line:{status:'matches',officialKm:Math.round(LINE_KM*10)/10}};
  const trail={path:PATH,routeShape:'loop',heroImage:'x.jpg',region:'dolomites'};
  const item={lockedFacts:[],evidenceSources:[]};

  test('measured communes, protected areas, photo and distance clear their holds',()=>{
    const without=researchMethodHolds(item,trail).holds;
    expect(without).toEqual(expect.arrayContaining(['communes-unchecked','protected-areas-unchecked',
      'photo-place-unconfirmed','official-distance-unpublished']));
    const withFree=researchMethodHolds(item,trail,{freeChecks:free}).holds;
    for(const id of ['communes-unchecked','protected-areas-unchecked','photo-place-unconfirmed',
      'official-distance-unpublished','line-differs-from-official'])expect(withFree).not.toContain(id);
  });

  test('what still needs reading still holds the seal: climb, time and each commune’s dog rule',()=>{
    expect(researchMethodHolds(item,trail,{freeChecks:free}).holds)
      .toEqual(['official-climb-unpublished','official-time-unpublished','dog-rule-unsettled']);
  });

  test('a protected-area lookup whose control failed does not count',()=>{
    const unreliable={...free,protectedAreas:{status:'service-unreliable',sites:[],control:{found:false}}};
    expect(researchMethodHolds(item,trail,{freeChecks:unreliable}).holds).toContain('protected-areas-unchecked');
  });

  test('a photograph measured far from the line holds it',()=>{
    const far={...free,photo:{status:'located',geotag:{lat:46.55,lng:12.44}}};
    expect(researchMethodHolds(item,trail,{freeChecks:far}).holds).toContain('photo-off-the-line');
  });
});
