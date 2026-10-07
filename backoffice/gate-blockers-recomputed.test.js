'use strict';

// A gate item is written once, at the transition into a gate, and its outputs
// can be refreshed afterwards without the reasons being recomputed. Six
// dossiers reached the desk that way. One stored 41 reasons where the same
// outputs yield 17, omitting redTeam's recommendation to block and a
// logistics/recommended-start requirement -- route guidance, the one class no
// written reason can answer. The desk was offering an approval the contract
// would have refused.
//
// b23d447a fixed that for an item that had gone missing and stated the rule for
// all of them: re-run the real checks rather than trusting a stored flag.

const {currentBlockingReasons,unacceptedBlockers,dossierBlockingReasons,
  routeGuidanceBlockingReasons}=require('./workflows/compile-verified-dossier');

// Taken from the producer, never retyped. A hand-typed copy of this sentence is
// exactly what went stale when #472 reworded it.

const output=(agentId,result)=>({agentId,jobId:`${agentId}-1`,result});
const claim=(id,finding)=>({id,finding,proposedValue:`value for ${id}`,blockers:[],sources:[]});
const review=(overrides={})=>({gateType:'dossier-approval',blockingReasons:[],specialistOutputs:[],...overrides});

describe('the blockers a gate is judged on',()=>{
  test('come from the evidence attached to it, not from what was written down',()=>{
    const reasons=currentBlockingReasons(review({
      blockingReasons:['terrainPoi/shade: conflicted'],
      specialistOutputs:[output('redTeam',{recommendation:'block',claims:[claim('waymark-status','counter-evidence')]})],
    }));
    expect(reasons).toContain('redTeam: recommendation is block');
    expect(reasons).toContain('redTeam/waymark-status: counter-evidence');
    expect(reasons).not.toContain('terrainPoi/shade: conflicted');
  });

  // The case that prompted this. redTeam ran on all six dossier gates and
  // recommended block on five; none of it reached a single gate.
  test('an adversarial verdict recorded after the gate opened now reaches it',()=>{
    const stale=review({blockingReasons:[],specialistOutputs:[
      output('redTeam',{recommendation:'block',claims:[]}),
    ]});
    expect(unacceptedBlockers(stale,[])).toContain('redTeam: recommendation is block');
  });

  // Route guidance is the floor. A stored list that omits it would offer an
  // approval assertRouteGuidance refuses a moment later.
  test('a route-guidance requirement the stored list omitted is restored',()=>{
    const required=routeGuidanceBlockingReasons([]);
    expect(required).not.toHaveLength(0);
    const reasons=currentBlockingReasons(review({
      blockingReasons:['terrainPoi/shade: conflicted'],
      specialistOutputs:[output('logistics',{recommendation:'advance',claims:[]})],
    }));
    expect(reasons).toEqual(expect.arrayContaining(required));
  });

  // The chosen semantics, and the one direction that makes a decision easier:
  // a blocker the evidence no longer produces does not stand.
  test('a stored blocker the evidence no longer produces is cleared',()=>{
    const reasons=currentBlockingReasons(review({
      blockingReasons:['terrainPoi/livestock: five automated resolution strategies exhausted'],
      specialistOutputs:[output('logistics',{recommendation:'advance',
        claims:['recommended-start','route-number-status','route-number-sequence','route-number-switches']
          .map(id=>({...claim(id,'supported-proposal'),sources:[{url:'https://example.test/route',authority:'Mairie'}]}))})],
    }));
    expect(reasons).toEqual([]);
  });

  // Evidence that cannot be re-read is a reason to keep what a human last saw,
  // not to wave a dossier through on an empty list.
  test('with nothing to re-read, the stored list stands',()=>{
    const stored=['terrainPoi/livestock: unresolved'];
    expect(currentBlockingReasons(review({blockingReasons:stored,specialistOutputs:[]}))).toEqual(stored);
    expect(currentBlockingReasons(review({blockingReasons:stored,specialistOutputs:undefined}))).toEqual(stored);
  });

  describe('a geometry gate',()=>{
    // Its blockers are the cartographer's own, never the dossier's: running the
    // dossier checks over a cartographer output would invent route-guidance
    // requirements for a gate that is only about the line.
    test('is judged on the cartographer\'s blockers',()=>{
      const reasons=currentBlockingReasons(review({gateType:'geometry-approval',
        blockingReasons:['stale'],
        specialistOutputs:[output('cartographer',{blockers:['not-closed-loop','official-distance-conflict']})]}));
      expect(reasons).toEqual(['not-closed-loop','official-distance-conflict']);
    });

    test('and a cartographer that found nothing blocks nothing',()=>{
      expect(currentBlockingReasons(review({gateType:'geometry-approval',
        blockingReasons:['stale'],
        specialistOutputs:[output('cartographer',{blockers:[]})]}))).toEqual([]);
    });

    test('falling back to the stored list when the output carries no blockers field',()=>{
      expect(currentBlockingReasons(review({gateType:'geometry-approval',
        blockingReasons:['stale'],
        specialistOutputs:[output('cartographer',{})]}))).toEqual(['stale']);
    });
  });

  test('the computation is the same one the gate transition uses',()=>{
    const outputs=[output('terrainPoi',{recommendation:'block',claims:[claim('shade','conflicted')]})];
    expect(currentBlockingReasons(review({specialistOutputs:outputs})))
      .toEqual(dossierBlockingReasons(outputs));
  });
});
