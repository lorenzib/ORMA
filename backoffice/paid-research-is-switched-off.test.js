'use strict';

const {processTrailSpecialistJobs}=require('./workflows/run-live-backoffice-worker');
const {workerOptions}=require('./cli/live-worker');
const fs=require('fs');
const path=require('path');

// A credit top-up lasted 31 hours (20-21 October 2026), and 95 of the 101 model
// calls it paid for were retries on optional detail. Verification research is
// done by hand now, so the backoffice must not spend on its own -- but the
// geometry survey is free and keeps the pipeline moving, so it must not stop.

const NOW='2026-10-22T17:00:00.000Z';
const job=(id,agentId,extra={})=>({id,agentId,jobType:'trail-verification-specialist',candidateId:'tre-cime',
  status:'queued',createdAt:`2026-10-${id.padStart(2,'0')}T00:00:00.000Z`,inputRefs:[],...extra});

// Records every claim it is asked for and grants none, so nothing is run and
// the test sees exactly which jobs the pass would have taken.
function store(jobs){
  const asked=[];
  return {asked,listJobs:async()=>jobs,getArtifact:async()=>null,
    claimJob:async id=>{asked.push(id);return null;},
    setArtifact:async()=>{},completeSystemJob:async()=>{},failJob:async()=>{}};
}
const base={at:NOW,now:NOW,specialistLimit:5,productionTrails:[{id:'tre-cime',name:'Tre Cime'}]};
const jobs=()=>[job('01','regulatoryRanger'),job('02','terrainPoi'),job('03','cartographer'),
  job('04','logistics',{jobType:'trail-claim-resolution'})];

describe('paid research can be switched off while the free survey runs',()=>{
  test('off: only the free survey is taken, and the paid jobs stay queued',async()=>{
    const target=store(jobs());
    const outcomes=await processTrailSpecialistJobs(target,{...base,paidResearchEnabled:false});
    expect(target.asked).toEqual(['03']);
    expect(outcomes).toEqual([{status:'paid-research-off',held:3}]);
    // Not an attempt: nothing failed, nothing was spent.
    expect(outcomes.every(entry=>!entry.jobId)).toBe(true);
  });

  test('on: the paid jobs are taken as before',async()=>{
    const target=store(jobs());
    await processTrailSpecialistJobs(target,{...base,paidResearchEnabled:true});
    expect(target.asked.sort()).toEqual(['01','02','03','04']);
  });

  test('it is off unless the repository says otherwise',()=>{
    expect(workerOptions({}).paidResearchEnabled).toBe(false);
    expect(workerOptions({ORMA_PAID_RESEARCH_ENABLED:'false'}).paidResearchEnabled).toBe(false);
    expect(workerOptions({ORMA_PAID_RESEARCH_ENABLED:'true'}).paidResearchEnabled).toBe(true);
    for(const file of ['orma-backoffice-worker.yml','orma-verification-drain.yml']){
      const workflow=fs.readFileSync(path.join(__dirname,'..','.github','workflows',file),'utf8');
      expect(workflow).toContain("ORMA_PAID_RESEARCH_ENABLED: ${{ vars.ORMA_PAID_RESEARCH_ENABLED || 'false' }}");
    }
  });
});
