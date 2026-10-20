'use strict';

const {compactOrchestration}=require('./workflows/advance-trail-orchestration');
const {PROPERTY_LIMIT}=require('./workflows/artifact-size');

// trail-orchestration reached 1020.6 KB of a 1023.9 KB ceiling on 2026-10-20
// and every worker write failed with
// "The value of property \"data\" is longer than 1048487 bytes".
// The size report named the field: claimResolution, 51 trails, 20 KB each.
// Inside it, every completed attempt carried the claim's whole blocker list --
// strings nothing ever read back.

/** A ledger shaped like the live one: real blocker sentences, repeated. */
function trailWithLedger(id,{claims=10,attempts=5}={}){
  const claimResolution={};
  for(let c=0;c<claims;c+=1){
    claimResolution[`terrainPoi:claim-${c}`]={
      key:`terrainPoi:claim-${c}`,agentId:'terrainPoi',claimId:`claim-${c}`,category:'terrain',
      state:'unresolved',latestFinding:'unresolved',
      attempts:Array.from({length:attempts},(_,a)=>({
        strategy:`strategy-${a}`,status:'completed',completedAt:'2026-10-13T00:00:00Z',
        finding:'unresolved',confidence:0.4,sourceCount:3,
        blockers:[
          'Resolve whether the published elevation field should be 16 m, 18 m or 20 m.',
          'Obtain a mapped coordinate for the wet beam crossing or bridge if it is to be stated.',
          'Remove or separately substantiate the boardwalk description.',
        ],
      })),
    };
  }
  return {trailId:id,candidateId:id,state:'evidence-resolution',blockers:[],jobIds:[],attempts:{},claimResolution};
}

const bytes=value=>Buffer.byteLength(JSON.stringify(value),'utf8');

describe('the orchestration record stays writable', () => {
  test('compaction drops the blocker sentences nothing reads, and keeps the count', () => {
    const state={contractVersion:'1.0.0',trails:[trailWithLedger('osm-1')]};
    const compacted=compactOrchestration(state);
    const entry=compacted.trails[0].claimResolution['terrainPoi:claim-0'];

    expect(entry.attempts.every(attempt=>attempt.blockers===undefined)).toBe(true);
    // How many things stood in the way survives; the sentences do not.
    expect(entry.attempts.every(attempt=>attempt.blockerCount===3)).toBe(true);
    // Everything the ledger is actually read for is untouched.
    expect(entry.attempts.map(a=>a.strategy)).toEqual(['strategy-0','strategy-1','strategy-2','strategy-3','strategy-4']);
    expect(entry.attempts.every(a=>a.finding==='unresolved'&&a.sourceCount===3)).toBe(true);
    expect(entry.state).toBe('unresolved');
  });

  test('a record the size of the live one comes back under the ceiling', () => {
    // 51 trails is what the size report counted.
    const state={contractVersion:'1.0.0',
      trails:Array.from({length:51},(_,i)=>trailWithLedger(`osm-${i}`))};
    const before=bytes(state);
    const after=bytes(compactOrchestration(state));

    // Over the ceiling before, which is the state the worker died in.
    expect(before).toBeGreaterThan(PROPERTY_LIMIT);
    expect(after).toBeLessThan(PROPERTY_LIMIT);
    // Not a rounding difference: the sentences were the bulk.
    expect(after).toBeLessThan(before / 2);
  });

  test('compaction is idempotent, so a second pass neither grows nor re-adds', () => {
    const state={contractVersion:'1.0.0',trails:[trailWithLedger('osm-1')]};
    const once=compactOrchestration(state);
    const twice=compactOrchestration(once);
    expect(bytes(twice)).toBe(bytes(once));
  });

  test('an attempt that never had blockers is left exactly alone', () => {
    const state={contractVersion:'1.0.0',trails:[{trailId:'t',candidateId:'t',jobIds:[],attempts:{},
      claimResolution:{'a:b':{key:'a:b',agentId:'a',claimId:'b',state:'supported',
        attempts:[{strategy:'strategy-0',status:'completed',finding:'supported-proposal'}]}}}]};
    const compacted=compactOrchestration(state);
    expect(compacted.trails[0].claimResolution['a:b'].attempts[0])
      .toEqual({strategy:'strategy-0',status:'completed',finding:'supported-proposal'});
  });
});
