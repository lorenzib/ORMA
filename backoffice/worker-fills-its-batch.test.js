'use strict';

const {processTrailSpecialistJobs,claimNotBefore}=require('./workflows/run-live-backoffice-worker');

// The worker took the oldest N queued jobs and gave up on any it could not
// claim, so a handful of scheduled jobs at the front held back every job behind
// them — on every pass, for weeks, while the run reported only that it had
// attempted nothing. 116 queued, 0 running, 0 blocked, nothing moving.

const NOW='2026-10-06T17:00:00.000Z';
const LATER='2026-10-07T00:00:00.000Z';
const EARLIER='2026-10-06T16:00:00.000Z';

function job(id,overrides={}){
  return {id,jobType:'trail-claim-resolution',agentId:'logistics',candidateId:'tre-cime',
    status:'queued',createdAt:`2026-09-${id.padStart(2,'0')}T00:00:00.000Z`,inputRefs:[],...overrides};
}

function store(jobs){
  const claimed=[];
  return {claimed,jobs,
    listJobs:async()=>jobs,
    getArtifact:async()=>null,
    // The real claimJob refuses anything whose schedule is still ahead.
    claimJob:async id=>{
      const found=jobs.find(item=>item.id===id);
      if(!found||found.status!=='queued'||claimNotBefore(found,NOW))return null;
      claimed.push(id);return found;
    },
    setArtifact:async()=>{},completeSystemJob:async()=>{},failJob:async()=>{}};
}

const options={at:NOW,now:NOW,specialistLimit:2,
  productionTrails:[{id:'tre-cime',name:'Tre Cime'}],
  runAgent:async()=>({responseId:'r',model:'m',result:{claims:[]}})};

describe('a pass fills its batch instead of giving up on the head', () => {
  test('scheduled jobs at the front no longer starve the ones behind',async()=>{
    const target=store([
      job('01',{notBefore:LATER}),job('02',{notBefore:LATER}),job('03',{notBefore:LATER}),
      job('20'),job('21'),
    ]);
    await processTrailSpecialistJobs(target,options);
    expect(target.claimed).toEqual(['20','21']);
  });

  test('it still takes the oldest work it can actually run',async()=>{
    const target=store([job('05'),job('06'),job('07')]);
    await processTrailSpecialistJobs(target,options);
    expect(target.claimed).toEqual(['05','06']);
  });

  test('it never exceeds the batch it was given',async()=>{
    const target=store(['10','11','12','13','14'].map(id=>job(id)));
    await processTrailSpecialistJobs(target,options);
    expect(target.claimed).toHaveLength(2);
  });

  test('a queue where nothing is due claims nothing, and does not spin',async()=>{
    const target=store(['10','11','12'].map(id=>job(id,{notBefore:LATER})));
    const outcomes=await processTrailSpecialistJobs(target,options);
    expect(target.claimed).toEqual([]);
    expect(outcomes).toEqual([]);
  });

  test('a job whose schedule has passed is due',()=>{
    expect(claimNotBefore(job('01',{notBefore:EARLIER}),NOW)).toBe(false);
    expect(claimNotBefore(job('01',{notBefore:LATER}),NOW)).toBe(true);
    expect(claimNotBefore(job('01'),NOW)).toBe(false);
    // Firestore hands timestamps back as its own type, not as a string.
    expect(claimNotBefore(job('01',{notBefore:{seconds:Date.parse(LATER)/1000}}),NOW)).toBe(true);
  });
});
