'use strict';

// Contested or unresearched -- does evidence exist and disagree, or was none
// found? The two want opposite handling and the gate treated them alike, which
// is why a moderator was being asked to write forty-one defences, most of them
// of research nobody had done.

const {classifyBlocker,classifyBlockers,blockerDisposition,answerableCountsByAgent,
  UNATTRIBUTED}=require('./blocker-kinds');
const {dominantAgentFromBlockers,blockerCountsByAgent}=require('./revision-target');

// Verbatim from the 6 October gate-evidence report for osm-16363583 (Le Marais
// de Pré Lombard), the dossier whose list was read in full. Taken from the real
// thing rather than invented, because the shapes are what this classifies and a
// fixture in a shape production does not emit proves nothing -- that is how the
// route-guidance tests passed against a retired sentence for nineteen days.
const MARAIS=Object.freeze([
  'regulatoryRanger: recommendation is needs-resolution',
  'regulatoryRanger: open question — Do the authoritative current wetland and ZNIEFF polygons intersect the supplied OSM line continuously, or only at the marsh/Leysse end of the loop?',
  'regulatoryRanger/dog-access: The official route page does not expressly say “dogs welcome”; access is inferred from the municipal hiking guidance and absence of a stated dog prohibition.',
  'regulatoryRanger/seasonal-restrictions: No route-specific hunting map, hunt-day schedule, or temporary closure notice for the exact loop was located.',
  'terrainPoi: recommendation is block',
  'terrainPoi: open question — Can a field visit during the current grazing season document animals, temporary fencing, gates, or warning signs?',
  'terrainPoi/shade: conflicted',
  'terrainPoi/shade: No canopy or shade-layer measurement for the supplied route geometry.',
  'terrainPoi/shade: Official description includes wooded areas, conflicting with an unqualified \'almost shadeless\' label.',
  'terrainPoi/livestock: unresolved',
  'terrainPoi/livestock: five automated resolution strategies exhausted',
  'terrainPoi/livestock: No parcel-level or route-segment-level record verifies livestock or grazing.',
  'evidenceLibrarian: recommendation is block',
  'evidenceLibrarian/provenance-waymark-status: counter-evidence',
  'evidenceLibrarian/provenance-geometry-and-distance: conflicted',
]);

describe('what a blocker is',()=>{
  test('a claim the sources disagree about is contested',()=>{
    expect(classifyBlocker('terrainPoi/shade: conflicted'))
      .toEqual({agent:'terrainPoi',kind:'claim-status',claim:'shade',finding:'conflicted'});
    const {contested}=blockerDisposition(['terrainPoi/shade: conflicted']);
    expect(contested).toEqual(['terrainPoi/shade: conflicted']);
  });

  test('a claim nobody could find a source for is unresearched',()=>{
    const {unresearched,contested}=blockerDisposition(['terrainPoi/livestock: unresolved']);
    expect(unresearched).toHaveLength(1);
    expect(contested).toEqual([]);
  });

  test('an open question is the agent\'s own unfinished work, never a decision',()=>{
    // The shape that most inflated the counts: a question the agent wrote down
    // because it could not answer it. She cannot answer it either.
    const {unresearched}=blockerDisposition([
      'terrainPoi: open question — Can a field visit during the current grazing season document animals?']);
    expect(unresearched).toHaveLength(1);
  });

  test('a detail follows the claim it is filed under, not its own wording',()=>{
    // The same sentence means different things depending on the claim's
    // standing, so the claim decides. "No canopy measurement" under a
    // conflicted shade claim is explaining a disagreement; under an unresolved
    // one it is the absence itself.
    const underConflict=blockerDisposition([
      'terrainPoi/shade: conflicted',
      'terrainPoi/shade: No canopy or shade-layer measurement for the supplied route geometry.']);
    expect(underConflict.contested).toHaveLength(2);
    expect(underConflict.unresearched).toEqual([]);

    const underUnresolved=blockerDisposition([
      'terrainPoi/shade: unresolved',
      'terrainPoi/shade: No canopy or shade-layer measurement for the supplied route geometry.']);
    expect(underUnresolved.unresearched).toHaveLength(2);
    expect(underUnresolved.contested).toEqual([]);
  });

  test('an exhausted retry ledger is the plainest unresearched there is',()=>{
    const {unresearched}=blockerDisposition(['terrainPoi/livestock: five automated resolution strategies exhausted']);
    expect(unresearched).toHaveLength(1);
  });

  test('a verdict follows the worst of the agent\'s own findings',()=>{
    // A block from an agent holding a real conflict is contested; a block from
    // one that merely ran out of sources is the debt restated, and counting it
    // as a decision is how a list of research reads as a list of problems.
    const withConflict=blockerDisposition([
      'terrainPoi: recommendation is block','terrainPoi/shade: conflicted']);
    expect(withConflict.contested).toContain('terrainPoi: recommendation is block');

    const withoutConflict=blockerDisposition([
      'terrainPoi: recommendation is block','terrainPoi/livestock: unresolved']);
    expect(withoutConflict.unresearched).toContain('terrainPoi: recommendation is block');
    expect(withoutConflict.contested).toEqual([]);
  });

  test('a verdict is read per agent, not across the dossier',()=>{
    // evidenceLibrarian holds a conflict and terrainPoi does not. Pooling them
    // would make terrainPoi's block look contested and send the gate to the
    // wrong agent.
    const {classified}=blockerDisposition([
      'terrainPoi: recommendation is block','terrainPoi/livestock: unresolved',
      'evidenceLibrarian: recommendation is block','evidenceLibrarian/provenance: conflicted']);
    const verdict=agent=>classified.find(entry=>entry.kind==='verdict'&&entry.agent===agent).disposition;
    expect(verdict('terrainPoi')).toBe('unresearched');
    expect(verdict('evidenceLibrarian')).toBe('contested');
  });

  test('a blocker naming no agent stays undetermined, never quietly debt',()=>{
    // An unattributed blocker is a decision, the rule the dispatch already
    // follows. Folding it into either side would either hide it from her or
    // send it to an agent that does not own it.
    const {undetermined,classified}=blockerDisposition(['not-closed-loop']);
    expect(undetermined).toEqual(['not-closed-loop']);
    expect(classified[0].agent).toBe(UNATTRIBUTED);
  });

  test('a detail whose claim has no status line is undetermined, not debt',()=>{
    const {undetermined}=blockerDisposition(['terrainPoi/water: No verified potable-water POI.']);
    expect(undetermined).toHaveLength(1);
  });

  test('all-unclassified is its own case, and says nothing about evidence',()=>{
    // Found on the live queue: osm-14381930 (La Plagne) carried exactly one
    // blocker and it classified as undetermined. Reporting "no source was
    // found for any of it" there would be asserting something nobody measured
    // -- the only true statement is that it could not be placed.
    const {contested,unresearched,undetermined}=blockerDisposition(['declared-route-unavailable']);
    expect([contested,unresearched]).toEqual([[],[]]);
    expect(undetermined).toEqual(['declared-route-unavailable']);
  });

  test('every blocker lands in exactly one class',()=>{
    const {contested,unresearched,undetermined}=blockerDisposition(MARAIS);
    expect(contested.length+unresearched.length+undetermined.length).toBe(MARAIS.length);
    expect(new Set([...contested,...unresearched,...undetermined]).size).toBe(MARAIS.length);
  });
});

describe('the real dossier, divided',()=>{
  test('most of it is research, and the few decisions are nameable',()=>{
    const {contested,unresearched}=blockerDisposition(MARAIS);
    // Three claims the sources actually disagree about -- shade, the waymark
    // status and the geometry/distance provenance -- plus the two verdicts of
    // the agents holding them. Everything else is work nobody finished.
    expect(contested).toEqual([
      'terrainPoi: recommendation is block',
      'terrainPoi/shade: conflicted',
      'terrainPoi/shade: No canopy or shade-layer measurement for the supplied route geometry.',
      'terrainPoi/shade: Official description includes wooded areas, conflicting with an unqualified \'almost shadeless\' label.',
      'evidenceLibrarian: recommendation is block',
      'evidenceLibrarian/provenance-waymark-status: counter-evidence',
      'evidenceLibrarian/provenance-geometry-and-distance: conflicted',
    ]);
    expect(unresearched.length).toBeGreaterThan(contested.length / 2);
  });
});

describe('who the gate is dispatched to',()=>{
  test('the agent holding the most answerable blockers, not the most blockers',()=>{
    // The change this module is for. regulatoryRanger carries four blockers,
    // all of them research; terrainPoi carries more in total but two of its
    // five are a shade conflict only she can settle. Counting raw blockers
    // pointed at terrainPoi -- re-running it cannot settle a disagreement.
    const reasons=[
      'terrainPoi: recommendation is block',
      'terrainPoi/shade: conflicted',
      'terrainPoi/shade: Official description includes wooded areas.',
      'terrainPoi/livestock: unresolved',
      'regulatoryRanger: open question — Are hunting-day closures issued for this sector?',
      'regulatoryRanger: open question — Does on-site signage impose a dog restriction?',
      'regulatoryRanger/seasonal-restrictions: unresolved',
      'regulatoryRanger/dog-access: unresolved',
    ];
    expect(blockerCountsByAgent(reasons).get('terrainPoi')).toBe(4);
    expect(answerableCountsByAgent(reasons).get('terrainPoi')).toBe(1);
    expect(answerableCountsByAgent(reasons).get('regulatoryRanger')).toBe(4);
    expect(dominantAgentFromBlockers(reasons)).toBe('regulatoryRanger');
  });

  test('a verdict does not count as answerable work of its own',()=>{
    // It restates the agent's other findings, so counting it would give an
    // agent with one open claim the weight of one with two -- and on the
    // dispatch fixture from #621 it flipped the target.
    const reasons=['terrainPoi: recommendation is block','terrainPoi/livestock: unresolved',
      'regulatoryRanger: recommendation is needs-resolution','regulatoryRanger/dog-access: unresolved'];
    expect(answerableCountsByAgent(reasons).get('terrainPoi')).toBe(1);
    expect(answerableCountsByAgent(reasons).get('regulatoryRanger')).toBe(1);
  });

  test('a gate with nothing answerable still names somebody',()=>{
    // All contested: no re-run helps, and this is genuinely hers. The dispatch
    // pass has its own reasons to hold a gate; this function must not start
    // returning null and turn a decision into a silent hold.
    const reasons=['terrainPoi/shade: conflicted','evidenceLibrarian/provenance: counter-evidence',
      'evidenceLibrarian/provenance-dates: counter-evidence'];
    expect(answerableCountsByAgent(reasons).size).toBe(0);
    expect(dominantAgentFromBlockers(reasons)).toBe('evidenceLibrarian');
  });

  test('the precedence rules above it are untouched',()=>{
    // Geometry first, then route guidance: both are prerequisites, and both
    // must keep beating a raw or answerable count.
    expect(dominantAgentFromBlockers([
      'evidenceLibrarian/provenance-geometry-and-distance: conflicted',
      'terrainPoi: open question — a','terrainPoi: open question — b','terrainPoi: open question — c',
    ])).toBe('cartographer');
    expect(dominantAgentFromBlockers([
      'logistics/recommended-start: a sourced recommended start is required',
      'terrainPoi: open question — a','terrainPoi: open question — b',
    ])).toBe('logistics');
  });

  test('nothing naming an agent is still no dispatch',()=>{
    // Unattributed and outside every precedence rule: no agent is named and
    // none can be inferred, so this stays a decision. (A raw geometry id like
    // not-closed-loop is NOT this case -- #639 lists those explicitly as
    // cartographer work, asserted below.)
    expect(dominantAgentFromBlockers(['content-enrichment-missing','photo-licence-unverified'])).toBeNull();
  });

  test('a raw geometry blocker still goes to the cartographer',()=>{
    // The precedence this must not disturb: these name no agent in their text,
    // and #639 made the inference explicit.
    expect(dominantAgentFromBlockers(['not-closed-loop','disconnected-components'])).toBe('cartographer');
  });
});
