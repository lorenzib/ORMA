'use strict';

/**
 * On 2026-10-08 the single biggest thing stopping ORMA Verified was that
 * `logistics/route-number-switches` blocked eleven trails and had come back
 * empty on all eleven — a question with no answer to find rather than hard
 * research. Nothing in the backoffice said so: Home read "needs you: 0" and was
 * telling the truth. Finding it meant dispatching a report, saving the run log
 * and parsing 124 claim records out of it by hand.
 *
 * These tests are mostly about that: the summary has to rank the claim nobody
 * can decide their way out of above the one that merely holds more trails.
 */

const {summariseProgrammeHealth,evidenceGaps,retries,cost,
  DAILY_FREE_READS}=require('./workflows/programme-health');
const {MAX_AUTOMATED_ATTEMPTS,STRATEGIES}=require('./workflows/claim-resolution');

const NOW=new Date('2026-10-08T12:00:00.000Z').getTime();

function entry(agentId,claimId,overrides={}){
  return {agentId,claimId,originalFinding:'unresolved',state:'researchable',
    updatedAt:'2026-10-08T00:00:00.000Z',attempts:[],...overrides};
}
function done(n){return Array.from({length:n},(_,i)=>({attemptNumber:i+1,status:'completed'}));}
function trail(candidateId,claims,overrides={}){
  return {trailId:candidateId,candidateId,state:'evidence-resolution',
    stage:'autonomous-claim-resolution',updatedAt:'2026-10-08T00:00:00.000Z',
    attempts:{},jobIds:[],blockers:[],
    claimResolution:Object.fromEntries(claims.map(item=>[`${item.agentId}:${item.claimId}`,item])),
    ...overrides};
}
const entriesOf=trails=>trails.flatMap(t=>Object.values(t.claimResolution).map(e=>({trail:t,entry:e})));

describe('evidence gaps separate work from judgement', () => {
  test('an unwaivable gap outranks a waivable one that holds more trails', () => {
    const trails=[
      ...Array.from({length:9},(_,i)=>trail(`t${i}`,[entry('terrainPoi','livestock')])),
      ...Array.from({length:2},(_,i)=>trail(`u${i}`,[entry('logistics','route-number-switches')])),
    ];
    const gaps=evidenceGaps(entriesOf(trails),NOW);

    expect(gaps.open).toBe(11);
    expect(gaps.unwaivableOpen).toBe(2);
    expect(gaps.waivableOpen).toBe(9);
    // Nine trails cannot be decided for; two cannot be decided at all.
    expect(gaps.byClaim[0].claim).toBe('logistics/route-number-switches');
    expect(gaps.byClaim[0].unwaivable).toBe(true);
    expect(gaps.byClaim[1].claim).toBe('terrainPoi/livestock');
  });

  test('it keeps the first finding, which is what told switches from recommended-start', () => {
    const trails=[
      trail('a',[entry('logistics','route-number-switches',{originalFinding:'unresolved'})]),
      trail('b',[entry('logistics','route-number-switches',{originalFinding:'unresolved'})]),
      trail('c',[entry('logistics','recommended-start',{originalFinding:'conflicted'})]),
    ];
    const gaps=evidenceGaps(entriesOf(trails),NOW);
    const switches=gaps.byClaim.find(row=>row.claimId==='route-number-switches');
    const start=gaps.byClaim.find(row=>row.claimId==='recommended-start');

    // "Found nothing, every time" and "found sources that disagree" need
    // different work, and the count alone cannot tell them apart.
    expect(switches.firstFindings).toEqual({unresolved:2});
    expect(start.firstFindings).toEqual({conflicted:1});
  });

  test('a resolved claim stops being a gap but is still counted', () => {
    const trails=[trail('a',[
      entry('logistics','recommended-start',{state:'supported'}),
      entry('logistics','route-number-switches'),
    ])];
    const gaps=evidenceGaps(entriesOf(trails),NOW);

    expect(gaps.open).toBe(1);
    expect(gaps.byClaim.map(row=>row.claimId)).toEqual(['route-number-switches']);
  });

  test('it names the trails, because a count cannot be acted on', () => {
    const gaps=evidenceGaps(entriesOf([trail('osm-7549783',[entry('logistics','route-number-switches')])]),NOW);
    expect(gaps.byClaim[0].trails).toEqual(['osm-7549783']);
  });

  test('source-exhausted is still owed — it will not retry itself', () => {
    const gaps=evidenceGaps(entriesOf([
      trail('a',[entry('logistics','route-number-switches',{state:'source-exhausted',attempts:done(5)})]),
    ]),NOW);
    expect(gaps.unwaivableOpen).toBe(1);
  });
});

describe('retries say whether the research budget pays', () => {
  test('a strategy that never resolved anything is named', () => {
    const summary=retries(entriesOf([
      trail('a',[entry('logistics','recommended-start',{state:'supported',attempts:done(3)})]),
      trail('b',[entry('logistics','recommended-start',{state:'supported',attempts:done(3)})]),
    ]));

    expect(summary.resolvedAtAttempt).toEqual({3:2});
    expect(summary.maximumAttempts).toBe(MAX_AUTOMATED_ATTEMPTS);
    // Four of the five strategies bought nothing here, and that is the point.
    expect(summary.strategyNeverPaid.map(row=>row.attempt)).toEqual([1,2,4,5]);
    expect(summary.strategyNeverPaid[0].strategy).toBe(STRATEGIES[0].id);
  });

  test('exhausted claims are counted apart from ones still trying', () => {
    const summary=retries(entriesOf([
      trail('a',[entry('logistics','route-number-switches',{state:'source-exhausted',attempts:done(5)})]),
      trail('b',[entry('logistics','route-number-switches',{attempts:done(2)})]),
      trail('c',[entry('terrainPoi','water')]),
    ]));

    expect(summary.exhausted).toBe(1);
    expect(summary.neverRetried).toBe(1);
    expect(summary.byAttemptsSpent).toEqual({0:1,2:1,5:1});
  });
});

describe('cost is stated against the ceiling that actually stops the lane', () => {
  test('per-job cost, and no claim about the day without a day total', () => {
    const summary=cost({reads:1500,writes:60},10);
    expect(summary.readsPerJob).toBe(150);
    expect(summary.dailyFreeReads).toBe(DAILY_FREE_READS);
    // The figure that used to live here was DAILY_FREE_READS / reads, which
    // subtracted nothing and read the same at 9am and 9pm.
    expect(summary.passesLeftInFreeReads).toBeUndefined();
    expect(summary.today).toBeNull();
  });

  test('given the day\'s running total, it carries what is actually left', () => {
    const summary=cost({reads:1650,writes:50},9,
      {day:'2026-10-09',reads:13_200,writes:400,passes:8});
    expect(summary.today).toMatchObject({readsSoFar:13_200,sharePercent:26,passesLeft:22});
  });
  test('a pass that did no work reports no per-job figure rather than zero', () => {
    const summary=cost({reads:300,writes:0},0);
    expect(summary.readsPerJob).toBeNull();
    expect(summary.writesPerJob).toBeNull();
  });

  test('the per-call-site breakdown is carried through when the meter has one', () => {
    const summary=cost({reads:1500,writes:60,bySource:[{source:'job-get-by-id',reads:900}]},10);
    expect(summary.bySource).toEqual([{source:'job-get-by-id',reads:900}]);
  });
});

describe('the whole summary', () => {
  const orchestration={generatedAt:'2026-10-08T06:00:00.000Z',trails:[
    trail('a',[entry('logistics','route-number-switches',{updatedAt:'2026-10-01T00:00:00.000Z'})]),
    trail('b',[entry('terrainPoi','livestock')],{state:'red-team',stage:'counter-evidence-review'}),
  ]};

  test('it reads the funnel\'s own fields rather than a copy of them', () => {
    const health=summariseProgrammeHealth({orchestration,jobs:[],usage:{reads:1500,writes:60},
      jobsDone:10,nowMs:NOW});

    expect(health.throughput.inPipeline).toBe(2);
    expect(Array.isArray(health.throughput.stages)).toBe(true);
    expect(health.throughput.stages.some(row=>row.state==='evidence-resolution'&&row.trails===1)).toBe(true);
    expect(health.throughput.inRedTeam).toBe(1);
    // Stated even when it is 0 — that is the programme's headline.
    expect(health.throughput.readyForEditorial).toBe(0);
  });

  test('freshness notices a claim nobody has touched for a week', () => {
    const health=summariseProgrammeHealth({orchestration,jobs:[],nowMs:NOW});
    expect(health.freshness.oldestClaimDays).toBe(7);
    expect(health.freshness.orchestrationUpdatedDays).toBe(0);
  });

  test('an empty pipeline summarises to zeroes, not to a crash', () => {
    const health=summariseProgrammeHealth({orchestration:{trails:[]},jobs:[],nowMs:NOW});
    expect(health.throughput.inPipeline).toBe(0);
    expect(health.evidenceGaps.open).toBe(0);
    expect(health.retries.claims).toBe(0);
    expect(health.freshness.oldestClaimDays).toBeNull();
  });
});
