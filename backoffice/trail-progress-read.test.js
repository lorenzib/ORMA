'use strict';

const {trailProgress,jobsByAgent,agentOf,BASE_AGENTS}=require('./workflows/trail-progress-read');

/**
 * Four trails sat at evidence-resolution with no blockers and no claimable
 * work, and two passes each moved none of them. "Nothing standing" read as
 * ready; it was a stall. Advancement out of that stage needs a COMPLETED job
 * from each of the three base agents, and nothing said when one was missing.
 */

const job=(agent,status,n=1)=>({id:`trail-verification-t-${agent}-${n}-2026-10-13T00-00-00-000Z`,
  agentId:agent,status});
const trail=(overrides={})=>({trailId:'t',state:'evidence-resolution',blockers:[],
  claimResolution:{},...overrides});

describe('what advancement is waiting for',()=>{
  test('all three completed is not held',()=>{
    const p=trailProgress(trail(),BASE_AGENTS.map(a=>job(a,'completed')));
    expect(p.blockedBy).toEqual([]);
  });

  // The stall: a base agent whose job ended blocked rather than completed.
  test('a blocked base agent holds the trail, with no blocker to show for it',()=>{
    const p=trailProgress(trail(),[job('logistics','completed'),
      job('regulatoryRanger','completed'),job('terrainPoi','blocked')]);
    expect(p.blockedBy).toEqual(['terrainPoi']);
    expect(p.blockers).toBe(0);
  });

  test('an agent that never ran holds it the same way',()=>{
    const p=trailProgress(trail(),[job('logistics','completed')]);
    expect(p.blockedBy).toEqual(['regulatoryRanger','terrainPoi']);
    expect(p.base.find(e=>e.agentId==='terrainPoi').status).toBe('never ran');
  });

  test('a queued or running job is not a completed one',()=>{
    for(const status of ['queued','running','ready-for-review']){
      expect(trailProgress(trail(),[job('logistics',status),
        job('regulatoryRanger','completed'),job('terrainPoi','completed')]).blockedBy)
        .toEqual(['logistics']);
    }
  });

  // A later completed pass is what counts, not the first failure.
  test('the newest job per agent decides it',()=>{
    const p=trailProgress(trail(),[job('terrainPoi','blocked',1),job('terrainPoi','completed',2),
      job('logistics','completed'),job('regulatoryRanger','completed')]);
    expect(p.blockedBy).toEqual([]);
  });

  test('only the three base agents are counted, not every agent',()=>{
    const p=trailProgress(trail(),[...BASE_AGENTS.map(a=>job(a,'completed')),job('redTeam','blocked')]);
    expect(p.blockedBy).toEqual([]);
    expect(p.base).toHaveLength(3);
  });
});

describe('reading a job without being told its agent',()=>{
  test('the agent is recovered from the job id',()=>{
    expect(agentOf('trail-verification-osm-1-terrainPoi-15-2026-10-08T13-23-46-489Z')).toBe('terrainPoi');
    expect(agentOf('nonsense')).toBeNull();
  });

  test('a job with no agentId still counts, from its id',()=>{
    const byAgent=jobsByAgent([{id:'trail-verification-t-logistics-1-x',status:'completed'}]);
    expect(byAgent.get('logistics').status).toBe('completed');
  });
});

describe('what else it reports',()=>{
  test('the claim ledger is summarised by state',()=>{
    const p=trailProgress(trail({claimResolution:{
      a:{state:'supported'},b:{state:'researchable'},c:{state:'source-exhausted'},d:{state:'supported'}}}),[]);
    expect(p.claims).toEqual({total:4,supported:2,researchable:1,exhausted:1});
  });

  test('queued work is counted, because none of it is the other half of a stall',()=>{
    expect(trailProgress(trail(),[job('logistics','queued')]).queued).toBe(1);
  });

  test('a trail with nothing on record does not throw',()=>{
    expect(trailProgress(null,null).blockedBy).toEqual(BASE_AGENTS);
  });
});
