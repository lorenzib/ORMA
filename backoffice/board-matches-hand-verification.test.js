'use strict';

/**
 * By 23 October 72 of the 78 Verified walks had been verified by hand and paid
 * research was switched off, but the board still described the pipeline that
 * ran before: "Finished 0", hand-verified walks "in progress", agents
 * "researching" trails nothing would move, and a capacity of 15 two weeks
 * after it was raised to 60.
 */

const fs=require('fs');
const path=require('path');
const {buildTrailBoard}=require('./workflows/build-trail-board');
const {summariseProgrammeHealth}=require('./workflows/programme-health');
const {WITHDRAWN_STAGE}=require('./workflows/record-hand-verifications');
const {buildCoverageGrid,buildProgrammeBoard,deriveWorkerHealth,deriveCampaignHealth}=require('./dashboard-model');

const trail=id=>({id,name:`Trail ${id}`,area:'Somewhere / Valley',region:'dolomites',path:[[46.5,11.6],[46.51,11.61]],curated:false});
const flow=(id,state,extra={})=>({trailId:id,candidateId:id,trailName:`Trail ${id}`,state,blockers:[],updatedAt:'2026-10-20T10:00:00Z',...extra});
const orchestration={trails:[flow('hand','verified-by-hand'),flow('policy','ready-for-editorial'),flow('research','evidence-research'),
  flow('route','geometry-audit'),flow('withdrawn','imported',{stage:WITHDRAWN_STAGE}),flow('resting','imported')]};
const entry=(board,id)=>board.trails.find(item=>item.id===id);

describe('the board describes how trails are verified now',()=>{
  test('the Verified count is the one the site shows, not every approval in the pipeline',()=>{
    const ALL=['photo','route','routeNumbers','mapPoints','elevation','water','heat','exposure','livestock','surfaceHazards','access'];
    const sealed=id=>({...trail(id),curated:true,tier:'route-audited',
      graduation:{status:'verified',required:ALL,completed:ALL,blockers:{}},verified:{categories:ALL.slice(5),sources:['a'],date:'2026-10-21'}});
    // `policy` is approved by the evidence policy but carries no seal yet, so
    // it is not Verified: counting it is how the headline said 115 for 101.
    const productionTrails=[sealed('hand'),trail('policy'),trail('research')];
    const nowMs=Date.parse('2026-10-23T12:00:00Z');
    const health=summariseProgrammeHealth({orchestration,jobs:[],nowMs,productionTrails});
    expect(health.throughput).toEqual(expect.objectContaining({verified:1,verifiedByHand:1}));
    const board=buildProgrammeBoard({programmeHealth:health,nowMs});
    const verification=board.programmes.find(programme=>programme.id==='catalogue-verification');
    expect(verification.headline).toBe('1 trail Verified on the site, 1 of them by hand');
    expect(verification.throughput.find(tile=>tile.label==='Verified').value).toBe(1);
    const unknown=buildProgrammeBoard({programmeHealth:summariseProgrammeHealth({orchestration,jobs:[],nowMs}),nowMs});
    expect(unknown.programmes.find(programme=>programme.id==='catalogue-verification').headline).toBe('Verified count not recorded yet');
  });

  test('trail coverage counts a hand-verified walk as verified',()=>{
    const grid=buildCoverageGrid({orchestration,verifiedRegistry:{verified:[]},hazards:{hazards:[]}});
    expect(grid.rows.find(row=>row.trailId==='hand').verified).toBe('verified');
    expect(grid.rows.find(row=>row.trailId==='research').verified).toBe('in-progress');
  });

  test('research says it is paused while paid research is off, and route checks do not',()=>{
    const off=buildTrailBoard({trails:['research','route'].map(trail),orchestration});
    expect(off.summary.paidResearchEnabled).toBe(false);
    expect(entry(off,'research').next).toBe('Paused: paid research is off');
    expect(entry(off,'route').next).toBe('Route survey by the cartographer');
    const on=buildTrailBoard({trails:['research'].map(trail),orchestration,paidResearchEnabled:true});
    expect(entry(on,'research').next).toBe('Agents researching directions and safety facts');
  });

  test('a seal withdrawn by hand is not described as having no official page',()=>{
    const board=buildTrailBoard({trails:['withdrawn','resting'].map(trail),orchestration});
    expect(entry(board,'withdrawn').next).toBe('Seal withdrawn: no official climb or walking time');
    expect(entry(board,'resting').next).toBe('Resting: no official page to research from');
  });

  test('a running worker is automation, not agents',()=>{
    const nowMs=Date.parse('2026-10-23T12:00:00Z');
    const health=deriveWorkerHealth({status:'running',startedAt:'2026-10-23T11:55:00Z',runId:'1'},{nowMs});
    expect(health.label).toBe('Automation running');
  });

  test('campaign capacity comes from the run, not a typed 15',()=>{
    const running=deriveCampaignHealth({status:'running',startedAt:'2026-10-23T11:55:00Z',lastResult:{capacity:60}},{nowMs:Date.parse('2026-10-23T12:00:00Z')});
    expect(running.message).toContain('60-trail');
    expect(JSON.stringify(deriveCampaignHealth(null))).not.toContain('15');
  });

  test('the board footnote names the climb-and-time rule and hand verification',()=>{
    const page=fs.readFileSync(path.join(__dirname,'..','backoffice-hosted-review.html'),'utf8');
    expect(page).not.toContain('the evidence policy still decides every verification');
    expect(page).toContain('authority-published climb and walking time');
  });
});
