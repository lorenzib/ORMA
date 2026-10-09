'use strict';

/**
 * Backoffice Home could read "needs you: 0" truthfully while eleven trails sat
 * on a question that had no valid answer, because nothing on the page described
 * a programme's own health. Finding that on 2026-10-08 meant dispatching a
 * report, saving the run log and parsing 124 claim records by hand.
 */

const {buildProgrammeBoard}=require('./dashboard-model');

const NOW=Date.parse('2026-10-09T12:00:00.000Z');
const find=(board,id)=>board.programmes.find(programme=>programme.id===id);

const health={
  generatedAt:'2026-10-09T11:00:00.000Z',
  throughput:{inPipeline:48,verified:0,readyForEditorial:0,inRedTeam:2,stalled:1,
    stages:[{state:'geometry-human-gate',trails:5},{state:'evidence-resolution',trails:17}]},
  evidenceGaps:{open:27,unwaivableOpen:11,waivableOpen:16,byClaim:[
    {claim:'logistics/route-number-switches',open:11,unwaivable:true,oldestDays:8,
      firstFindings:{unresolved:11}},
    {claim:'terrainPoi/livestock',open:16,unwaivable:false,oldestDays:2,
      firstFindings:{unresolved:14,conflicted:2}},
  ]},
  retries:{claims:124,exhausted:12,maximumAttempts:5,
    strategyNeverPaid:[{attempt:5,strategy:'direct-verification-escalation-check',resolved:0}]},
  cost:{reads:600,writes:50,readsPerJob:90,dailyFreeReads:50_000,passesLeftInFreeReads:83},
  freshness:{oldestClaimDays:8,oldestStateDays:19},
};

const coverage={
  generatedAt:'2026-10-09T11:00:00.000Z',
  totals:{valleys:29,published:162,verified:3,candidatesAwaitingSelection:4,
    covered:0,started:1,unstarted:11,thin:16},
  gaps:{valleysWithoutResearchFile:['Valsugana','Paganella'],unplacedTrails:1},
  valleys:[
    {valley:'Alta Pusteria – Tre Cime',published:27,verified:2,state:'started'},
    {valley:'Cortina – Ampezzo',published:2,verified:0,state:'thin'},
    {valley:'Val di Non – Nonsberg',published:0,verified:0,state:'no-trails'},
  ],
};

describe('the three programmes each answer the same five questions', () => {
  test('all three appear, named, even with nothing to show', () => {
    const board=buildProgrammeBoard({nowMs:NOW});
    expect(board.programmes.map(programme=>programme.id))
      .toEqual(['catalogue-verification','geographical-expansion','dynamic-safety']);
  });

  test('a missing summary says so rather than rendering zeroes as fact', () => {
    const board=buildProgrammeBoard({nowMs:NOW});
    expect(find(board,'catalogue-verification').available).toBe(false);
    expect(find(board,'catalogue-verification').headline).toMatch(/next worker pass/);
  });
});

describe('catalogue verification', () => {
  const board=()=>buildProgrammeBoard({programmeHealth:health,nowMs:NOW});

  test('the headline is the number the programme exists to move, at zero', () => {
    // "0 verified" is the point of putting it on the wall, not a reason to hide it.
    expect(find(board(),'catalogue-verification').headline)
      .toBe('0 verified · 0 ready for editorial');
    expect(find(board(),'catalogue-verification').settled).toBe(false);
  });

  test('gaps are split by whether a decision could clear them', () => {
    const gaps=find(board(),'catalogue-verification').gaps;
    // 16 livestock gaps are a judgement she could make; 11 route-guidance ones
    // are not. Counting them together is what hid the switches problem.
    expect(gaps).toMatchObject({unwaivable:11,waivable:16});
    expect(gaps.rows[0]).toMatchObject({claim:'logistics/route-number-switches',unwaivable:true});
  });

  test('a gap carries how it first failed, which the count cannot say', () => {
    const rows=find(board(),'catalogue-verification').gaps.rows;
    expect(rows[0].firstFinding).toBe('unresolved 11');
    expect(rows[1].firstFinding).toBe('unresolved 14 · conflicted 2');
  });

  test('a strategy that never resolved anything is named', () => {
    expect(find(board(),'catalogue-verification').retries.neverPaid)
      .toEqual(['direct-verification-escalation-check']);
  });

  test('cost is a share of the free day, not a bare number', () => {
    expect(find(board(),'catalogue-verification').cost)
      .toMatchObject({readsPerPass:600,readsPerJob:90,shareOfFreeDay:1,passesLeft:83});
  });

  test('a stalled trail is marked for attention', () => {
    const stalled=find(board(),'catalogue-verification').throughput
      .find(item=>item.label==='Stalled');
    expect(stalled).toMatchObject({value:1,warn:true});
  });

  test('freshness is stated, because a green panel over a stale summary is the failure', () => {
    expect(find(board(),'catalogue-verification').freshness)
      .toEqual({writtenHoursAgo:1,oldestClaimDays:8,oldestStateDays:19});
  });
});

describe('geographical expansion', () => {
  const board=()=>buildProgrammeBoard({regionalCoverage:coverage,nowMs:NOW});

  test('the headline is coverage, not trail count', () => {
    expect(find(board(),'geographical-expansion').headline).toBe('0 of 29 valleys covered');
  });

  test('the thinnest valleys that have any trails are listed', () => {
    // A valley with none is an expansion candidate, not a thin one to top up;
    // the scouting lane ranks those.
    expect(find(board(),'geographical-expansion').thinnest.map(row=>row.valley))
      .toEqual(['Cortina – Ampezzo','Alta Pusteria – Tre Cime']);
  });

  test('what cannot be measured is surfaced', () => {
    expect(find(board(),'geographical-expansion'))
      .toMatchObject({unmeasured:2,unplacedTrails:1});
  });
});

describe('dynamic safety', () => {
  test('a partial feed is flagged, because it may add but never remove', () => {
    const board=buildProgrammeBoard({nowMs:NOW,
      hazards:{hazards:[{id:'a',origin:'authority'},{id:'b',origin:'community'}]},
      hazardStatus:{checkedAt:'2026-10-09T09:00:00.000Z',summary:{sourceFailures:1},
        sources:[{key:'italy',ok:true,completeSnapshot:false},{key:'france',ok:true,completeSnapshot:true}]}});
    const safety=find(board,'dynamic-safety');

    expect(safety.headline).toBe('2 live warnings');
    expect(safety.settled).toBe(false);
    const value=label=>safety.throughput.find(item=>item.label===label);
    expect(value('Partial feeds')).toMatchObject({value:1,warn:true});
    expect(value('Source failures')).toMatchObject({value:1,warn:true});
    expect(value('Community-reported').value).toBe(1);
    expect(safety.freshness.writtenHoursAgo).toBe(3);
  });

  test('a clean check is settled', () => {
    const board=buildProgrammeBoard({nowMs:NOW,hazards:{hazards:[]},
      hazardStatus:{checkedAt:'2026-10-09T11:30:00.000Z',summary:{sourceFailures:0},
        sources:[{key:'italy',ok:true,completeSnapshot:true}]}});
    expect(find(board,'dynamic-safety').settled).toBe(true);
  });
});
