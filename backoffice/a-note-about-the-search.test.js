'use strict';

const {singleRelationGuidance}=require('./workflows/route-guidance-from-map');
const {dossierBlockingReasons,currentBlockingReasons,waivableBlocker,blockerId,
  supportedRouteGuidance,VERIFICATION_ROUTE_CLAIMS}=require('./workflows/compile-verified-dossier');

// The three-source ladder exists so that where the agent cannot establish a
// direction, the map or ORMA's record can. The agent's own admission that it
// could not was itself filed under the claim id -- which is in the class no
// reason can waive -- so the answer was computed, reported, and then overruled
// by the very failure the ladder exists to cover. It could never once rescue a
// trail.
//
// Anello di Ciampeviei, 15 October 2026: start, status and sequence from the
// Lozzo di Cadore authority, switches from the map. All four answered. The gate
// rejected it for `logistics/route-number-switches: unresolved`, and thirteen
// trails carrying a route number on their own relation stood behind it.

const CIAMPEVIEI_REF='69';

/** The audit as the cartographer writes one, from the real derivation. */
const audit=ref=>({agentId:'cartographer',result:{
  routeGuidance:singleRelationGuidance({tags:{ref}}),
  relation:{tags:{ref}},
  source:{externalId:'relation/7548201'},
}});

/** Logistics, with one route claim it reports as `finding` and the rest sourced. */
const logistics=(claimId,finding,over={})=>({agentId:'logistics',result:{
  recommendation:'needs-resolution',openQuestions:[],
  claims:[
    {id:claimId,category:'route',finding,proposedValue:'',confidence:0.2,
      rationale:'No published description names where the number changes.',
      sources:[],blockers:[],...over},
    ...VERIFICATION_ROUTE_CLAIMS.filter(id=>id!==claimId).map(id=>({id,category:'route',
      finding:'supported-proposal',proposedValue:`Start at the car park and follow ${CIAMPEVIEI_REF}.`,
      confidence:0.9,rationale:'Comune page.',
      sources:[{label:'Comune',url:'https://example.test/lozzo',
        authority:'Lozzo di Cadore / Parco Sentieristico Terre Alte'}],blockers:[]})),
  ]}});

const unwaivableIn=reasons=>reasons.filter(reason=>!waivableBlocker(reason)).map(blockerId);

describe('a note about the agent’s own search is not a missing answer',()=>{
  test("the map's answer stands, and the agent's unresolved note no longer rejects",()=>{
    const outputs=[audit(CIAMPEVIEI_REF),logistics('route-number-switches','unresolved')];
    // The map does answer it -- that is not in question.
    expect(supportedRouteGuidance({specialistOutputs:outputs},'route-number-switches').derivedFrom)
      .toBe('route-relations');

    const reasons=dossierBlockingReasons(outputs);
    expect(unwaivableIn(reasons)).toEqual([]);
    // Still recorded, still reaching the desk and the agent that could clear
    // it -- under its own suffix, as optional detail.
    expect(reasons).toContain('logistics/route-number-switches-caveat: unresolved');
    expect(reasons).not.toContain('logistics/route-number-switches: unresolved');
  });

  test('and the gate reaches the same verdict, since that is what decides',()=>{
    // The decision recomputes its own blockers from the stored outputs. The map
    // reads out of the cartographer's audit, so it answers there too.
    const outputs=[audit(CIAMPEVIEI_REF),logistics('route-number-switches','unresolved')];
    const reasons=currentBlockingReasons({specialistOutputs:outputs,blockingReasons:[],
      gateType:'dossier-approval'});
    expect(unwaivableIn(reasons)).toEqual([]);
  });

  test('a walk the map gives no number for is still refused',()=>{
    // Eight of the blocked trails carry no number at all. Nothing answered
    // those, so the agent's unresolved note is the whole truth and must decide.
    const reasons=dossierBlockingReasons([audit(null),logistics('route-number-switches','unresolved')]);
    expect(unwaivableIn(reasons)).toContain('logistics/route-number-switches');
  });

  test('an exhausted ladder moves too, because it is the same sentence after five tries',()=>{
    const spent=logistics('route-number-switches','unresolved',
      {resolution:{state:'source-exhausted',maximumAttempts:5}});
    const reasons=dossierBlockingReasons([audit(CIAMPEVIEI_REF),spent]);
    expect(unwaivableIn(reasons)).toEqual([]);
    // The words consumers match on are untouched, so the rule that stops a
    // trail circulating still recognises it.
    expect(reasons.some(reason=>/automated resolution strategies exhausted/i.test(reason))).toBe(true);
  });

  test('a contradiction still decides, because a measurement does not settle one',()=>{
    // `conflicted` and `counter-evidence` mean the agent learned something that
    // contradicts. Reading where the ways run does not resolve a disagreement
    // between two authorities about what anybody recommends.
    for(const finding of ['conflicted','counter-evidence']){
      const reasons=dossierBlockingReasons([audit(CIAMPEVIEI_REF),
        logistics('route-number-switches',finding)]);
      expect(unwaivableIn(reasons)).toContain('logistics/route-number-switches');
    }
  });

  test('a footnote on an answered claim keeps moving, whatever the finding says',()=>{
    // The first place this went wrong: Tre Cime's agent established the
    // Rifugio Locatelli switch, cited it, and noted that no coordinate was
    // published for it. The note was filed as the claim and rejected the
    // best-documented walk in the catalogue.
    const thorough={agentId:'logistics',result:{recommendation:'advance',openQuestions:[],
      claims:[{id:'route-number-switches',category:'route',finding:'supported-proposal',
        proposedValue:'At Rifugio Locatelli, 101 gives way to 105.',confidence:0.9,
        rationale:'Consorzio page.',
        sources:[{label:'Consorzio',url:'https://example.test/t',authority:'Consorzio Turistico'}],
        blockers:['no coordinate or distance-from-start was published for the switch']}]}};
    const reasons=dossierBlockingReasons([audit(CIAMPEVIEI_REF),thorough]);
    // Start and status are genuinely unanswered here and rightly still block;
    // the switch this agent established does not.
    expect(unwaivableIn(reasons)).not.toContain('logistics/route-number-switches');
    expect(reasons.some(reason=>reason.startsWith('logistics/route-number-switches-caveat:'))).toBe(true);
  });
});
