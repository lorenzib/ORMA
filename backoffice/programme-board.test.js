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

  test('the headline is a sentence, and says the thing that has not happened', () => {
    // It read "0 verified · 0 ready for editorial" — two fragments and a dot.
    expect(find(board(),'catalogue-verification').headline).toBe('No trail has finished yet');
    expect(find(board(),'catalogue-verification').settled).toBe(false);
  });

  test('once something finishes, the headline says so and the card settles', () => {
    const done=buildProgrammeBoard({nowMs:NOW,
      programmeHealth:{...health,throughput:{...health.throughput,verified:1}}});
    expect(find(done,'catalogue-verification').headline).toBe('1 trail verified');
    expect(find(done,'catalogue-verification').settled).toBe(true);
  });

  test('four tiles, not six: the ones that matter cannot look like wallpaper', () => {
    const tiles=find(board(),'catalogue-verification').throughput;
    expect(tiles.map(tile=>tile.label)).toEqual(['In progress','Finished','Needs you','Stuck']);
    // Both gates as one number a person can act on, not two to add up.
    expect(tiles.find(tile=>tile.label==='Needs you').value).toBe(5);
  });
  test('gaps are two named piles, headed by who can clear them', () => {
    const gaps=find(board(),'catalogue-verification').gaps;
    expect(gaps).toMatchObject({unwaivable:11,waivable:16});
    expect(gaps.groups.map(group=>group.title))
      .toEqual(['Only an agent can supply these','You could judge these']);
    expect(gaps.groups[0].rows[0].claim).toBe('logistics/route-number-switches');
  });

  test('a claim is named in words, not as a path', () => {
    const gaps=find(board(),'catalogue-verification').gaps;
    // `logistics/route-number-switches` on screen is not an answer to anyone.
    expect(gaps.groups[0].rows[0].label).toBe('where the path changes');
    expect(gaps.groups[1].rows[0].label).toBe('livestock on the route');
  });

  test('an unnamed claim still reads as words rather than a path', () => {
    const odd=buildProgrammeBoard({nowMs:NOW,programmeHealth:{...health,
      evidenceGaps:{unwaivableOpen:0,waivableOpen:1,byClaim:[
        {claim:'someAgent/a-new-check',open:1,unwaivable:false,oldestDays:0,
          firstFindings:{unresolved:1}}]}}});
    expect(find(odd,'catalogue-verification').gaps.groups[0].rows[0].label).toBe('a new check');
  });

  test('an empty pile is not shown at all', () => {
    const only=buildProgrammeBoard({nowMs:NOW,programmeHealth:{...health,
      evidenceGaps:{unwaivableOpen:0,waivableOpen:1,byClaim:[
        {claim:'terrainPoi/water',open:1,unwaivable:false,oldestDays:1,
          firstFindings:{unresolved:1}}]}}});
    expect(find(only,'catalogue-verification').gaps.groups).toHaveLength(1);
    expect(find(only,'catalogue-verification').gaps.groups[0].title).toBe('You could judge these');
  });
  test('how it failed is said in words, because the two causes need different work', () => {
    const groups=find(board(),'catalogue-verification').gaps.groups;
    expect(groups[0].rows[0].why).toBe('found nothing 11×');
    expect(groups[1].rows[0].why).toBe('found nothing 14×, sources disagreed 2×');
  });

  test('the retries line is a sentence', () => {
    // It read "79 out of attempts of 5".
    expect(find(board(),'catalogue-verification').retries.sentence)
      .toBe('12 of 124 questions have used all 5 tries and will not be asked again.');
  });

  test('cost is a sentence, with a thousands separator', () => {
    const costly=buildProgrammeBoard({nowMs:NOW,
      programmeHealth:{...health,cost:{...health.cost,reads:1641,readsPerJob:182}}});
    expect(find(costly,'catalogue-verification').cost.sentence)
      .toBe('1,641 database lookups on the last run, 182 per job.');
  });  test('a strategy that never resolved anything is named', () => {
    expect(find(board(),'catalogue-verification').retries.neverPaid)
      .toEqual(['direct-verification-escalation-check']);
  });

  test('cost reports the last run, and separately what today has left', () => {
    const programme=find(board(),'catalogue-verification');
    expect(programme.cost).toMatchObject({readsPerPass:600,readsPerJob:90});
    // With no day total yet there is nothing honest to say about what is left.
    expect(programme.cost.todaySentence).toBeNull();
  });

  test('given a day total, it says what is left rather than what a day would fund', () => {
    const withDay=buildProgrammeBoard({nowMs:NOW,programmeHealth:{...health,
      cost:{...health.cost,today:{day:'2026-10-09',readsSoFar:13200,sharePercent:26,
        remainingReads:36800,passesLeft:22,
        sentence:'At least 13,200 of 50,000 free lookups used today (26%).'}}}});
    const cost=find(withDay,'catalogue-verification').cost;
    expect(cost.todayShare).toBe(26);
    expect(cost.todayPassesLeft).toBe(22);
    expect(cost.todaySentence).toMatch(/^At least 13,200/);
  });
  test('a stuck trail is marked for attention and explained', () => {
    const programme=find(board(),'catalogue-verification');
    expect(programme.throughput.find(tile=>tile.label==='Stuck'))
      .toMatchObject({value:1,warn:true});
    expect(programme.notes).toContain('1 stopped — no job will pick them up.');
  });

  test('a count worth nothing at zero gets neither a tile nor a sentence', () => {
    const calm=buildProgrammeBoard({nowMs:NOW,programmeHealth:{...health,
      throughput:{...health.throughput,inRedTeam:0,stalled:0}}});
    expect(find(calm,'catalogue-verification').notes).toEqual([]);
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

  test('only valleys that are actually thin are listed', () => {
    // It listed a 27-trail valley because it sorted third. A shortlist that
    // includes the fullest valley is not a shortlist.
    expect(find(board(),'geographical-expansion').thinnest.map(row=>row.valley))
      .toEqual(['Cortina – Ampezzo']);
  });

  test('four tiles here too, with what is left said in a line', () => {
    const programme=find(board(),'geographical-expansion');
    expect(programme.throughput.map(tile=>tile.label))
      .toEqual(['Valleys','Covered','Thin','Candidates awaiting you']);
    expect(programme.notes).toEqual(['1 started, 11 not started.']);
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
