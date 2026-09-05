'use strict';

const {promotePendingOwnerUploads,processImageJobs}=require('./workflows/hosted-image-coverage');

const AT='2026-09-05T15:00:00.000Z';
const gap={slug:'seceda',trailId:'seceda',title:'Seceda Ridge Trail',libraryMatches:[],reasons:['no photo']};

function store(artifacts={}){
  const map=new Map(Object.entries(artifacts));const writes=[];
  return {map,writes,
    getArtifact:async id=>map.get(id)??null,
    setArtifact:async(id,value)=>{map.set(id,value);writes.push(id);},
    listJobs:async()=>[],
    claimJob:async(id)=>({id,...(map.get('__job')||{})}),
    completeSystemJob:async()=>{},
    markImageReview:async()=>{},
    failJob:async(id,error)=>{throw error;}};
}

describe('an owner upload does not need a second approval',()=>{
  test('a fresh upload goes straight to the publishing lane',async()=>{
    const job={id:'j1',jobType:'hosted-image-sourcing',slug:'seceda',sourcePreference:'upload-owner-photo',
      reviewId:'rev-1',uploadRef:'backofficeImageUploads/u1',fileName:'seceda.jpg',mimeType:'image/jpeg',
      fileSize:400000,width:1400,height:900,creator:'Benedetta Lorenzi',rightsBasis:'orma-owned',altText:'Seceda in summer'};
    const target=store({'image-coverage':{gaps:[gap]},'__job':job});
    target.listJobs=async()=>[job];
    const outcomes=await processImageJobs(target,{workerId:'w',imageLimit:1});
    expect(outcomes[0].status).toBe('completed');

    const requests=target.map.get('trail-image-publication-requests');
    expect(requests.requests).toHaveLength(1);
    expect(requests.requests[0]).toEqual(expect.objectContaining({trailId:'seceda',uploadRef:'backofficeImageUploads/u1',
      status:'approved-for-pr-creation',approvedBy:'owner-upload',creator:'Benedetta Lorenzi',altText:'Seceda in summer'}));

    const results=target.map.get('image-coverage-results');
    expect(results.items[0].candidates[0].status).toBe('approved-for-publication');
    expect(results.items[0].candidates[0].status).not.toBe('ready-for-asset-review');
  });

  test('uploads already waiting on the old second approval are moved on',async()=>{
    const target=store({
      'image-coverage':{gaps:[gap]},
      'image-coverage-results':{items:[{slug:'seceda',trailId:'seceda',reviewId:'rev-9',
        candidates:[{uploadRef:'backofficeImageUploads/u9',status:'ready-for-asset-review',
          title:'seceda.jpg',creator:'Benedetta Lorenzi',license:'ORMA-owned',altText:'Seceda',mimeType:'image/jpeg',fileSize:300000}]}]},
    });
    const result=await promotePendingOwnerUploads(target,{at:AT});
    expect(result.promoted).toEqual(['seceda']);
    expect(target.map.get('trail-image-publication-requests').requests[0]).toEqual(
      expect.objectContaining({trailId:'seceda',status:'approved-for-pr-creation',rightsBasis:'orma-owned'}));
    expect(target.map.get('image-coverage-results').items[0].candidates[0].status).toBe('approved-for-publication');
  });

  test('a licensed candidate still waits for a human look',async()=>{
    const target=store({
      'image-coverage':{gaps:[gap]},
      'image-coverage-results':{items:[{slug:'seceda',trailId:'seceda',
        candidates:[{assetUrl:'https://upload.wikimedia.org/x.jpg',status:'ready-for-asset-review',creator:'Someone',license:'CC BY-SA 4.0'}]}]},
    });
    const result=await promotePendingOwnerUploads(target,{at:AT});
    expect(result.promoted).toEqual([]);
    expect(target.map.get('trail-image-publication-requests')).toBeUndefined();
  });

  test('a trail that already has an open request is left alone',async()=>{
    const target=store({
      'image-coverage':{gaps:[gap]},
      'image-coverage-results':{items:[{slug:'seceda',trailId:'seceda',
        candidates:[{uploadRef:'backofficeImageUploads/u9',status:'ready-for-asset-review',license:'ORMA-owned'}]}]},
      'trail-image-publication-requests':{requests:[{id:'old',trailId:'seceda',status:'awaiting-pr-merge'}]},
    });
    expect((await promotePendingOwnerUploads(target,{at:AT})).promoted).toEqual([]);
  });

  test('a trail that already has a published photo is never revisited',async()=>{
    const target=store({
      'image-coverage':{gaps:[]},
      'image-coverage-results':{items:[{slug:'seceda',trailId:'seceda',
        candidates:[{uploadRef:'backofficeImageUploads/u9',status:'ready-for-asset-review',license:'ORMA-owned'}]}]},
    });
    expect((await promotePendingOwnerUploads(target,{at:AT})).promoted).toEqual([]);
  });

  test('nothing to promote writes nothing',async()=>{
    const target=store({'image-coverage':{gaps:[gap]}});
    expect((await promotePendingOwnerUploads(target,{at:AT})).promoted).toEqual([]);
    expect(target.writes).toEqual([]);
  });
});
