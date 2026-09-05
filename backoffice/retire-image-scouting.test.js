'use strict';

const {retireAutomatedImageSourcing,RETIRED_SOURCE_PREFERENCES}=require('./workflows/hosted-image-coverage');

const AT='2026-09-05T21:00:00.000Z';

function store(jobs){
  const written=[];
  return {written,listJobs:async()=>jobs,putJob:async job=>written.push(job)};
}

describe('the automated photo scouting lane is retired',()=>{
  test('cancels queued and running agent scouting jobs',async()=>{
    const jobs=[
      {id:'a',jobType:'hosted-image-sourcing',sourcePreference:'find-licensed',status:'queued'},
      {id:'b',jobType:'hosted-image-sourcing',sourcePreference:'generate-ai',status:'running'},
    ];
    const target=store(jobs);
    const result=await retireAutomatedImageSourcing(target,{at:AT});
    expect(result.retired).toEqual(['a','b']);
    expect(target.written.every(job=>job.status==='cancelled'&&job.cancelledAt===AT)).toBe(true);
    expect(target.written[0].cancelledReason).toMatch(/retired/);
  });

  test('never touches work the owner initiated',async()=>{
    const jobs=[
      {id:'upload',jobType:'hosted-image-sourcing',sourcePreference:'upload-owner-photo',status:'queued'},
      {id:'approve',jobType:'hosted-image-sourcing',sourcePreference:'approve-uploaded-photo',status:'queued'},
      {id:'candidate',jobType:'hosted-image-sourcing',sourcePreference:'approve-image-candidate',status:'queued'},
      {id:'library',jobType:'hosted-image-sourcing',sourcePreference:'use-orma-library',status:'queued'},
    ];
    const target=store(jobs);
    expect((await retireAutomatedImageSourcing(target,{at:AT})).retired).toEqual([]);
    expect(target.written).toEqual([]);
  });

  test('leaves every other kind of job alone',async()=>{
    const jobs=[
      {id:'spec',jobType:'trail-verification-specialist',sourcePreference:'find-licensed',status:'queued'},
      {id:'claim',jobType:'trail-claim-resolution',status:'queued'},
    ];
    const target=store(jobs);
    expect((await retireAutomatedImageSourcing(target,{at:AT})).retired).toEqual([]);
  });

  test('only these two preferences are retired',()=>{
    expect(RETIRED_SOURCE_PREFERENCES).toEqual(['find-licensed','generate-ai']);
  });
});
