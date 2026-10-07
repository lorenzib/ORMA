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

// `runTrailSpecialist` reads `response.data`. This fixture said `result`, so
// every job in this suite failed validation and the assertions — all about
// which jobs were claimed — passed anyway. Corrected so the suite exercises a
// job that actually completes.
const options={at:NOW,now:NOW,specialistLimit:2,
  productionTrails:[{id:'tre-cime',name:'Tre Cime'}],
  runAgent:async()=>({responseId:'r',model:'m',data:{claims:[]}})};

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

/**
 * The jobs in a batch are independent — different trails, different claims —
 * but they were asked one at a time, so a pass spent nearly all of its twelve
 * minutes waiting for one answer. That is what made a 45-minute drain window
 * fit three passes instead of eleven.
 *
 * Claiming stays serial. A claim has to win a race against other workers, and
 * claiming in parallel would make which jobs a pass takes depend on which
 * transaction landed first.
 */
describe('a pass asks about its batch concurrently', () => {
  function tracker(){
    let inFlight=0,peak=0;
    return {
      peak:()=>peak,
      runAgent:async()=>{
        inFlight+=1;peak=Math.max(peak,inFlight);
        await new Promise(resolve=>setTimeout(resolve,5));
        inFlight-=1;
        return {responseId:'r',model:'m',data:{claims:[]}};
      },
    };
  }

  const batch=['20','21','22','23','24','25'];

  test('several model calls are in flight at once',async()=>{
    const target=store(batch.map(id=>job(id)));
    const probe=tracker();
    await processTrailSpecialistJobs(target,{...options,specialistLimit:6,
      specialistConcurrency:3,runAgent:probe.runAgent});

    expect(target.claimed).toEqual(batch);
    expect(probe.peak()).toBe(3);
  });

  test('the concurrency is a ceiling, never exceeded',async()=>{
    const target=store(batch.map(id=>job(id)));
    const probe=tracker();
    await processTrailSpecialistJobs(target,{...options,specialistLimit:6,
      specialistConcurrency:2,runAgent:probe.runAgent});

    expect(probe.peak()).toBeLessThanOrEqual(2);
  });

  test('one at a time is still available, and still works',async()=>{
    const target=store(batch.slice(0,3).map(id=>job(id)));
    const probe=tracker();
    const outcomes=await processTrailSpecialistJobs(target,{...options,specialistLimit:3,
      specialistConcurrency:1,runAgent:probe.runAgent});

    expect(probe.peak()).toBe(1);
    expect(outcomes).toHaveLength(3);
  });

  // A pass summary that changes shape because one agent answered faster would
  // make two identical passes look different.
  test('outcomes stay in queue order however the answers arrive',async()=>{
    const target=store(batch.slice(0,4).map(id=>job(id,{agentId:'terrainPoi'})));
    // The first job asked takes longest to answer, the second is quickest, so
    // the answers arrive in a different order from the batch.
    const delays=[40,5,30,10];let call=0;
    const outcomes=await processTrailSpecialistJobs(target,{...options,specialistLimit:4,
      specialistConcurrency:4,
      runAgent:async()=>{
        const wait=delays[call]??5;call+=1;
        await new Promise(resolve=>setTimeout(resolve,wait));
        return {responseId:'r',model:'m',data:{claims:[]}};
      }});

    expect(outcomes.map(outcome=>outcome.jobId)).toEqual(['20','21','22','23']);
    expect(outcomes.every(outcome=>outcome.status==='completed')).toBe(true);
  });

  test('claiming is still serial, so a scheduled head still starves nobody',async()=>{
    const target=store([
      job('01',{notBefore:LATER}),job('02',{notBefore:LATER}),
      job('30'),job('31'),job('32'),
    ]);
    await processTrailSpecialistJobs(target,{...options,specialistLimit:3,specialistConcurrency:3});

    expect(target.claimed).toEqual(['30','31','32']);
  });
});
