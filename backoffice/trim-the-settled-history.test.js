'use strict';

const {trimSettledAttempts,compactOrchestration,SETTLED_STATES}
  =require('./workflows/advance-trail-orchestration');

/**
 * trail-orchestration reached 1017.1 KB against Firestore's 1023.9 KB limit on
 * 13 October and every worker run failed on the save -- scheduled and manual
 * alike -- with "The value of property data is longer than 1048487 bytes". The
 * pipeline stopped completely. 48 trails at 21.2 KB each, and claimResolution
 * was most of it.
 *
 * A claim that has finished is not going to be attempted again, so the
 * scheduling detail on each attempt is dead weight.
 */

const attempt=n=>({attemptNumber:n,strategy:'strategy-'+n,status:'completed',
  jobId:'trail-verification-osm-14864704-terrainPoi-'+n+'-2026-10-13T00-00-00-000Z',
  scheduledAt:'2026-10-13T00:00:00.000Z',notBefore:'2026-10-13T06:00:00.000Z'});
const entry=(state,n=5)=>({key:'terrainPoi/water',agentId:'terrainPoi',claimId:'water',
  state,attempts:Array.from({length:n},(_,i)=>attempt(i+1))});

describe('a finished claim keeps what is still read',()=>{
  test('the scheduling detail goes',()=>{
    const [first]=trimSettledAttempts(entry('source-exhausted')).attempts;
    expect(first.jobId).toBeUndefined();
    expect(first.scheduledAt).toBeUndefined();
    expect(first.notBefore).toBeUndefined();
  });

  // Both are read: the yield report counts attempts, and a reopened claim must
  // not repeat a strategy it already tried.
  test('how many there were and what each tried both survive',()=>{
    const trimmed=trimSettledAttempts(entry('supported'));
    expect(trimmed.attempts).toHaveLength(5);
    expect(trimmed.attempts.map(a=>a.strategy)).toEqual(
      ['strategy-1','strategy-2','strategy-3','strategy-4','strategy-5']);
    expect(trimmed.attempts[0].attemptNumber).toBe(1);
  });

  test('every settled state is trimmed',()=>{
    for(const state of SETTLED_STATES){
      expect(trimSettledAttempts(entry(state)).attempts[0].jobId).toBeUndefined();
    }
  });

  // A claim still being researched needs its jobId: pendingAttempt matches on it.
  test('a claim still being researched is left alone',()=>{
    expect(trimSettledAttempts(entry('researchable')).attempts[0].jobId).toBeDefined();
  });

  test('it is worth doing',()=>{
    const before=JSON.stringify(entry('source-exhausted')).length;
    const after=JSON.stringify(trimSettledAttempts(entry('source-exhausted'))).length;
    expect(after).toBeLessThan(before*0.5);
  });

  test('trimming twice changes nothing the second time',()=>{
    const once=trimSettledAttempts(entry('supported'));
    expect(trimSettledAttempts(once)).toBe(once);
  });

  test('an entry with no attempts, or none to trim, is untouched',()=>{
    const bare={key:'a/b',state:'supported',attempts:[]};
    expect(trimSettledAttempts(bare)).toBe(bare);
    expect(trimSettledAttempts(null)).toBeNull();
  });
});

describe('the whole artifact shrinks',()=>{
  const trail=id=>({trailId:id,candidateId:id,state:'evidence-resolution',jobIds:[],
    claimResolution:Object.fromEntries(['water','shade','livestock','mountain-huts']
      .map(claim=>[`terrainPoi/${claim}`,{...entry('source-exhausted'),claimId:claim,key:`terrainPoi/${claim}`}]))});

  test('a catalogue of settled trails is materially smaller',()=>{
    const state={trails:Array.from({length:48},(_,i)=>trail('osm-'+i))};
    const before=JSON.stringify(state).length;
    const after=JSON.stringify(compactOrchestration(state)).length;
    expect(after).toBeLessThan(before*0.5);
  });

  test('and nothing is lost from a trail that is still working',()=>{
    const working={trails:[{...trail('osm-1'),
      claimResolution:{'terrainPoi/water':entry('researchable')}}]};
    expect(compactOrchestration(working)).toEqual(working);
  });

  test('an artifact with no trails is handled',()=>{
    expect(compactOrchestration(null)).toBeNull();
    expect(compactOrchestration({trails:[]})).toEqual({trails:[]});
  });
});
