'use strict';

const {buildFunnel,stalled,attemptCount}=require('./workflows/verification-funnel');

const trail=(overrides={})=>({
  trailId:overrides.trailId||'t1',candidateId:overrides.candidateId||overrides.trailId||'t1',
  state:'evidence-research',stage:null,updatedAt:'2026-09-10T00:00:00Z',
  attempts:{},resolutionAttempts:{},jobIds:[],blockers:[],publicMutationAllowed:false,...overrides,
});
const NOW=Date.parse('2026-09-17T00:00:00Z');
const build=(trails,jobs=[],reviewQueue=null)=>buildFunnel({orchestration:{trails},jobs,reviewQueue,nowMs:NOW});

describe('where trails actually stop',()=>{
  test('a trail owed no job and not at a gate is stopped, not slow',()=>{
    const waiting=trail({trailId:'waiting'});
    const stopped=trail({trailId:'stopped'});
    const jobs=[{candidateId:'waiting',status:'queued'}];
    expect(stalled(waiting,new Map([['waiting',jobs]]))).toBe(false);
    expect(stalled(stopped,new Map())).toBe(true);
    const report=build([waiting,stopped],jobs);
    expect(report.stalled.total).toBe(1);
    expect(report.stalled.sample[0].trailId).toBe('stopped');
  });

  test('a trail at a human gate is waiting on a person, never counted as stalled',()=>{
    // It has no job by design; the desk owes it a decision, not the worker.
    const report=build([trail({trailId:'gate',state:'geometry-human-gate'})]);
    expect(report.stalled.total).toBe(0);
  });

  test('a blocked trail is not counted as stalled either',()=>{
    expect(build([trail({trailId:'dead',state:'blocked'})]).stalled.total).toBe(0);
  });
});

describe('the two ways into the final gate are not the same thing',()=>{
  test('an agent failure lands in dossier-human-gate but can never be approved',()=>{
    // The live pipeline on 2026-09-17: one trail in the state, zero approvable.
    const report=build([trail({trailId:'osm-19153189',state:'dossier-human-gate',stage:'agent-execution-failure'})],
      [],{items:[{gateType:'agent-failure',state:'awaiting-human'}]});
    expect(report.dossierGate).toEqual(expect.objectContaining({
      inState:1,genuine:0,viaAgentFailure:1,approvableItemsInQueue:0,everReachedRedTeam:0,
    }));
  });

  test('a completed dossier is counted separately and is approvable',()=>{
    const report=build([trail({trailId:'real',state:'dossier-human-gate',stage:'complete-evidence-dossier'})],
      [],{items:[{gateType:'dossier-approval',state:'awaiting-human'}]});
    expect(report.dossierGate).toEqual(expect.objectContaining({inState:1,genuine:1,viaAgentFailure:0,approvableItemsInQueue:1}));
  });

  test('the two are distinguished even when both sit in the state at once',()=>{
    const report=build([
      trail({trailId:'real',state:'dossier-human-gate',stage:'complete-evidence-dossier'}),
      trail({trailId:'failed',state:'dossier-human-gate',stage:'agent-execution-failure'}),
    ],[],{items:[{gateType:'dossier-approval',state:'awaiting-human'}]});
    expect(report.dossierGate).toEqual(expect.objectContaining({inState:2,genuine:1,viaAgentFailure:1,approvableItemsInQueue:1}));
  });
});

describe('the funnel reads in the order trails travel',()=>{
  test('stages come out in pipeline order, so the drop-off is where it looks',()=>{
    const report=build([]);
    expect(report.stages.map(stage=>stage.state)).toEqual([
      'geometry-audit','geometry-human-gate','evidence-research','evidence-resolution',
      'provenance-audit','red-team','dossier-human-gate','ready-for-editorial','rejected','blocked',
    ]);
  });

  test('dwell time reports the oldest trail in each stage, not the newest',()=>{
    const report=build([
      trail({trailId:'old',updatedAt:'2026-08-18T00:00:00Z'}),
      trail({trailId:'new',updatedAt:'2026-09-16T00:00:00Z'}),
    ]);
    const research=report.stages.find(stage=>stage.state==='evidence-research');
    expect(research).toEqual(expect.objectContaining({trails:2,oldestDaysInState:30}));
  });

  test('attempts are summed across agents and resolutions, so a loop shows up',()=>{
    expect(attemptCount(trail({attempts:{cartographer:3,logistics:2},resolutionAttempts:{water:4}}))).toBe(9);
    const report=build([trail({trailId:'looping',attempts:{cartographer:9},resolutionAttempts:{heat:6}}),trail({trailId:'fresh'})]);
    expect(report.mostAttempts[0]).toEqual(expect.objectContaining({trailId:'looping',attempts:15}));
  });
});
