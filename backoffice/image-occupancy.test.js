'use strict';

const path=require('path');
const {tally,buildImageOccupancyReport}=require('./cli/report-image-occupancy');

describe('trail-photo occupancy report',()=>{
  const root=path.resolve(__dirname,'..');

  function store({jobs=[],results=null,requests=null}={}){
    const reads=[];
    return {reads,
      listJobs:async statuses=>{reads.push(statuses);return jobs;},
      getArtifact:async id=>id==='image-coverage-results'?results:id==='trail-image-publication-requests'?requests:null};
  }

  test('counts nothing when no gap holds a slot',async()=>{
    const report=await buildImageOccupancyReport({store:store(),root,at:'2026-09-05T10:00:00Z'});
    expect(report.occupied).toBe(0);
    expect(report.freeSlots).toBe(report.capacity);
    expect(report.gaps).toBeGreaterThan(0);
  });

  test('separates uploads awaiting approval from stuck agent jobs',async()=>{
    const {auditImageCoverage}=require('./workflows/audit-image-coverage');
    const audit=await auditImageCoverage(root,{at:'2026-09-05T10:00:00Z'});
    const [a,b,c]=audit.gaps.map(gap=>gap.slug);
    const target=store({
      jobs:[{jobType:'hosted-image-sourcing',slug:a,status:'queued',sourcePreference:'find-licensed',systemFailures:2,lastError:'429'}],
      results:{items:[
        {slug:b,candidates:[{status:'ready-for-asset-review',uploadRef:'backofficeImageUploads/x'}]},
        {slug:c,candidates:[{status:'ready-for-asset-review',assetUrl:'https://example/photo.jpg'}]},
      ]},
      requests:{requests:[{trailId:a,status:'approved-for-pr-creation'}]},
    });
    const report=await buildImageOccupancyReport({store:target,root,at:'2026-09-05T10:00:00Z'});
    expect(report.occupied).toBe(3);
    expect(report.holders).toEqual({sourcingJobs:1,awaitingPreview:2,awaitingPreviewFromYourUploads:1,openPublicationRequests:1});
    expect(report.sampleSourcingJobs[0]).toEqual(expect.objectContaining({slug:a,failures:2}));
  });

  test('ignores published requests and trails that already have a photo',async()=>{
    const target=store({requests:{requests:[{trailId:'not-a-gap',status:'approved-for-pr-creation'},
      {trailId:'also-not',status:'published'}]}});
    const report=await buildImageOccupancyReport({store:target,root,at:'2026-09-05T10:00:00Z'});
    expect(report.occupied).toBe(0);
  });

  test('reads only the three statuses the backfill counts, and writes nothing',async()=>{
    const target=store();
    await buildImageOccupancyReport({store:target,root,at:'2026-09-05T10:00:00Z'});
    expect(target.reads).toEqual([['queued','running','ready-for-review']]);
    expect(target.setArtifact).toBeUndefined();
  });

  test('tally groups and orders by frequency',()=>{
    expect(tally([{s:'a'},{s:'b'},{s:'a'}],'s')).toEqual([['a',2],['b',1]]);
  });
});
