'use strict';

const {applyEditedCopy,ingestEditorialReviews,processEditorialJobs}=require('./workflows/hosted-editorial');
const {queuePriorityImageSourcing,ingestImageReviews,processImageJobs,compactImageResults}=require('./workflows/hosted-image-coverage');

const at='2026-08-20T12:00:00.000Z';
function packet(generatedAt=at){return {contractVersion:'1.0.0',generatedAt,mode:'draft-only',publicMutationAllowed:false,subject:{type:'guide',id:'paw-care',sourceRef:'guides/paw-protection.html',original:'<p>Old</p>'},outputs:[{jobId:'guide-paw-care-edit',agentId:'copywriter',status:'ready-for-review',result:{title:'Paw care',summary:'Update',changes:[{section:'Intro',before:'<p>Old</p>',after:'<p>New</p>',reason:'Freshness'}],sources:[],openQuestions:[]}}],summary:{readyForReview:1,blocked:0}};}
function memoryStore(seed={}){
  const artifacts={...seed};const jobs=[];const reviews={editorial:[],image:[]};const marks=[];
  return {artifacts,jobs,reviews,marks,getArtifact:async id=>artifacts[id]||null,setArtifact:async(id,value)=>{artifacts[id]=value;},putJob:async job=>jobs.push(job),putJobIfAbsent:async job=>{if(jobs.some(item=>item.id===job.id))return false;jobs.push(job);return true;},listJobs:async statuses=>jobs.filter(job=>statuses.includes(job.status)),claimJob:async(id,workerId)=>{const job=jobs.find(item=>item.id===id&&item.status==='queued');if(!job)return null;job.status='running';return {...job,workerId};},completeSystemJob:async(id,fields)=>Object.assign(jobs.find(item=>item.id===id),fields,{status:'completed'}),failJob:async(id,error)=>Object.assign(jobs.find(item=>item.id===id),{status:'queued',systemFailures:1,lastError:error.message}),listEditorialReviews:async()=>reviews.editorial,markEditorialReview:async(id,status,fields)=>{const review=reviews.editorial.find(item=>item.id===id);Object.assign(review,{status,...fields});marks.push({kind:'editorial',id,status,fields});},listImageReviews:async()=>reviews.image,markImageReview:async(id,status,fields)=>{const review=reviews.image.find(item=>item.id===id);Object.assign(review,{status,...fields});marks.push({kind:'image',id,status,fields});}};
}

describe('hosted Editorial operations',()=>{
  test('CEO edits are embedded in the immutable approval input',()=>{
    const edited=applyEditedCopy(packet(),[{jobId:'guide-paw-care-edit',afterByIndex:['<p>Edited by CEO</p>']}]);
    expect(edited.outputs[0].result.changes[0].after).toBe('<p>Edited by CEO</p>');
  });

  test('approval is consumed once into a durable publication job',async()=>{
    const store=memoryStore({'editorial-review-packet-1':packet()});store.reviews.editorial.push({id:'review-1',packetGeneratedAt:at,sourceRef:'guides/paw-protection.html',action:'approve',edits:[],submittedAt:at});
    const outcomes=await ingestEditorialReviews(store);
    expect(outcomes).toEqual([expect.objectContaining({status:'processing',jobId:'hosted-editorial-publication-paw-care-review-1'})]);
    expect(store.jobs[0]).toEqual(expect.objectContaining({jobType:'hosted-editorial-publication',humanGate:'editorial-approval-consumed'}));
    expect(store.reviews.editorial[0].status).toBe('processing');
  });

  test('revision returns a new protected packet to the same slot',async()=>{
    const store=memoryStore({'editorial-review-packet-1':packet(),'editorial-ledger':{contractVersion:'1.0.0',items:[{contentId:'guide-paw-care',type:'guide',sourceRef:'guides/paw-protection.html',status:'in-review',contentFingerprint:'x',sourcesFingerprint:null,lastDecision:'in-review',lastReviewedAt:at,lastPublishedAt:null,nextEligibleAt:'2026-09-01T00:00:00Z',activePacketFingerprint:'x'}]}});store.reviews.editorial.push({id:'review-2',packetGeneratedAt:at,sourceRef:'guides/paw-protection.html',action:'request-revision',note:'Shorter.',edits:[],submittedAt:at});await ingestEditorialReviews(store);
    const revised=packet('2026-08-20T12:05:00.000Z');
    const outcomes=await processEditorialJobs(store,{workerId:'worker',root:process.cwd(),runEditorialRevision:async()=>revised});
    expect(outcomes).toEqual([expect.objectContaining({status:'revision-ready'})]);expect(store.artifacts['editorial-review-packet-1'].generatedAt).toBe(revised.generatedAt);expect(store.reviews.editorial[0].status).toBe('processed');
  });

  test('publication success records the commit receipt without requiring a second approval',async()=>{
    const store=memoryStore({'editorial-review-packet-1':packet(),'editorial-ledger':{contractVersion:'1.0.0',items:[]}});store.reviews.editorial.push({id:'review-3',packetGeneratedAt:at,sourceRef:'guides/paw-protection.html',action:'approve',edits:[],submittedAt:at});await ingestEditorialReviews(store);
    const outcomes=await processEditorialJobs(store,{workerId:'worker',root:process.cwd(),publishEditorialPacket:async()=>({status:'published',commit:'abcdef123456',paths:['guides/paw-protection.html'],deployment:'github-pages-triggered',publishedAt:'2026-08-20T12:10:00.000Z'})});
    expect(outcomes[0]).toEqual(expect.objectContaining({status:'published',commit:'abcdef123456'}));expect(store.artifacts['editorial-publication-receipts'].receipts[0]).toEqual(expect.objectContaining({reviewId:'review-3',status:'published'}));expect(store.reviews.editorial[0].status).toBe('processed');
  });
});

describe('hosted image coverage routing',()=>{
  test('large result history is compacted without dropping reviewable photos',()=>{
    const payload='x'.repeat(30000);const history=Array.from({length:50},(_,index)=>({slug:`old-${index}`,summary:payload,candidates:[]}));
    const ready={slug:'uploaded',sourcePreference:'upload-owner-photo',candidates:[{status:'ready-for-asset-review',uploadRef:'backofficeImageUploads/one'}]};
    const compacted=compactImageResults([...history,ready],{contractVersion:'1.0.0'});
    expect(compacted).toContain(ready);
    expect(Buffer.byteLength(JSON.stringify({contractVersion:'1.0.0',items:compacted}),'utf8')).toBeLessThanOrEqual(850000);
    expect(compacted.length).toBeLessThan(51);
  });

  test('automatically fills a bounded queue with credited-photo scouting jobs',async()=>{
    const gaps=Array.from({length:20},(_,index)=>({slug:`trail-${index}`,trailId:`trail-${index}`,title:`Trail ${index}`,sourceRef:`trail.html?id=trail-${index}`,reasons:['Missing image'],libraryMatches:[]}));
    const store=memoryStore({'image-coverage':{gaps}});
    const result=await queuePriorityImageSourcing(store,{gaps},{at,capacity:15});
    expect(result).toEqual(expect.objectContaining({queued:15,active:15,capacity:15}));
    expect(store.jobs).toHaveLength(15);
    expect(store.jobs[0]).toEqual(expect.objectContaining({jobType:'hosted-image-sourcing',sourcePreference:'find-licensed',humanGate:'asset-and-rights-approval',reviewId:null,publicMutationAllowed:false}));
  });

  test('automatic licensed scouting returns candidates without inventing a human review receipt',async()=>{
    const gap={slug:'seceda',trailId:'seceda',title:'Seceda Ridge Trail',sourceRef:'trail.html?id=seceda',reasons:['Missing image'],libraryMatches:[]};
    const store=memoryStore({'image-coverage':{gaps:[gap]}});await queuePriorityImageSourcing(store,{gaps:[gap]},{at,capacity:1});
    await processImageJobs(store,{workerId:'worker',runAgent:async()=>({data:{summary:'Credited option',candidates:[{title:'Seceda',sourcePageUrl:'https://commons.wikimedia.org/wiki/File:Seceda.jpg',assetUrl:'https://upload.wikimedia.org/seceda.jpg',creator:'Example photographer',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',rightsEvidence:'The file page identifies the creator and licence.',altText:'Seceda ridge in summer',status:'ready-for-asset-review',generationPrompt:null}]}})});
    expect(store.artifacts['image-coverage-results'].items[0].candidates[0]).toEqual(expect.objectContaining({creator:'Example photographer',license:'CC BY-SA 4.0',status:'ready-for-asset-review'}));
    expect(store.marks).toEqual([]);
  });

  test('owned image route returns an actual preview candidate but does not place it',async()=>{
    const audit={gaps:[{slug:'seceda',trailId:'seceda',title:'Seceda Ridge Trail',sourceRef:'trail.html?id=seceda',reasons:['Missing image'],libraryMatches:[{source:'orma-library',fileName:'mountain.jpg',sourceRef:'images/mountain.jpg'}]}]};const store=memoryStore({'image-coverage':audit});store.reviews.image.push({id:'image-1',slug:'seceda',trailId:'seceda',action:'use-orma-library',assetRef:'images/mountain.jpg',note:'',submittedAt:at});await ingestImageReviews(store);const outcomes=await processImageJobs(store,{workerId:'worker'});
    expect(outcomes[0].status).toBe('completed');expect(store.artifacts['image-coverage-results'].items[0].candidates[0]).toEqual(expect.objectContaining({assetUrl:'images/mountain.jpg',license:'ORMA-owned',status:'ready-for-asset-review'}));expect(store.artifacts['image-coverage-results'].items[0].publicMutationAllowed).toBe(false);
  });

  test('moderator upload returns a protected preview candidate',async()=>{
    const audit={gaps:[{slug:'seceda',trailId:'seceda',title:'Seceda Ridge Trail',sourceRef:'trail.html?id=seceda',reasons:['Missing image'],libraryMatches:[]}]};
    const store=memoryStore({'image-coverage':audit});store.reviews.image.push({id:'upload-1',slug:'seceda',trailId:'seceda',action:'upload-owner-photo',assetRef:'backofficeImageUploads/upload-asset-1',uploadRef:'backofficeImageUploads/upload-asset-1',fileName:'one.jpg',mimeType:'image/jpeg',fileSize:100,width:1200,height:800,creator:'Benedetta Lorenzi',rightsBasis:'orma-owned',altText:'Seceda ridge in summer',note:'',submittedAt:at});
    await ingestImageReviews(store);await processImageJobs(store,{workerId:'worker'});
    expect(store.artifacts['image-coverage-results'].items[0].candidates[0]).toEqual(expect.objectContaining({uploadRef:'backofficeImageUploads/upload-asset-1',creator:'Benedetta Lorenzi',status:'ready-for-asset-review'}));
    expect(store.artifacts['trail-image-publication-requests']).toBeUndefined();
  });

  test('moderator uploads bypass older delayed automatic searches',async()=>{
    const gaps=[
      {slug:'old-one',trailId:'old-one',title:'Old one',sourceRef:'trail.html?id=old-one',reasons:['Missing image'],libraryMatches:[]},
      {slug:'old-two',trailId:'old-two',title:'Old two',sourceRef:'trail.html?id=old-two',reasons:['Missing image'],libraryMatches:[]},
      {slug:'seceda',trailId:'seceda',title:'Seceda Ridge Trail',sourceRef:'trail.html?id=seceda',reasons:['Missing image'],libraryMatches:[]},
    ];
    const store=memoryStore({'image-coverage':{gaps}});
    store.jobs.push(
      {id:'auto-old-one',jobType:'hosted-image-sourcing',slug:'old-one',status:'queued',sourcePreference:'find-licensed',createdAt:'2026-08-19T00:00:00Z'},
      {id:'auto-old-two',jobType:'hosted-image-sourcing',slug:'old-two',status:'queued',sourcePreference:'find-licensed',createdAt:'2026-08-19T00:01:00Z'},
      {id:'upload-new',jobType:'hosted-image-sourcing',slug:'seceda',trailId:'seceda',status:'queued',sourcePreference:'upload-owner-photo',reviewId:'upload-review',uploadRef:'backofficeImageUploads/upload-new',fileName:'new.jpg',mimeType:'image/jpeg',fileSize:100,creator:'Benedetta Lorenzi',rightsBasis:'orma-owned',altText:'Seceda ridge',createdAt:'2026-09-03T00:00:00Z'},
    );
    store.reviews.image.push({id:'upload-review',slug:'seceda',status:'processing'});
    const claimed=[];const originalClaim=store.claimJob;
    store.claimJob=async(id,workerId)=>{claimed.push(id);if(id.startsWith('auto-'))return null;return originalClaim(id,workerId);};
    const outcomes=await processImageJobs(store,{workerId:'worker',imageLimit:1});
    expect(claimed).toEqual(['upload-new']);
    expect(outcomes).toEqual([expect.objectContaining({jobId:'upload-new',status:'completed'})]);
    expect(store.artifacts['image-coverage-results'].items[0].candidates[0].uploadRef).toBe('backofficeImageUploads/upload-new');
  });

  test('exact uploaded preview approval creates a human-gated publication request',async()=>{
    const candidate={title:'one.jpg',uploadRef:'backofficeImageUploads/upload-asset-1',creator:'Benedetta Lorenzi',license:'ORMA-owned',altText:'Seceda ridge in summer',status:'ready-for-asset-review',mimeType:'image/jpeg',fileSize:100,width:1200,height:800};
    const audit={gaps:[{slug:'seceda',trailId:'seceda',title:'Seceda Ridge Trail',sourceRef:'trail.html?id=seceda',reasons:['Missing image'],libraryMatches:[]}]};
    const store=memoryStore({'image-coverage':audit,'image-coverage-results':{items:[{slug:'seceda',generatedAt:at,summary:'Ready',candidates:[candidate]}]}});
    store.reviews.image.push({id:'approval-1',slug:'seceda',trailId:'seceda',action:'approve-uploaded-photo',assetRef:candidate.uploadRef,uploadRef:candidate.uploadRef,fileName:candidate.title,mimeType:candidate.mimeType,fileSize:100,width:1200,height:800,creator:candidate.creator,rightsBasis:'orma-owned',altText:candidate.altText,note:'Approved',submittedAt:at});
    await ingestImageReviews(store);await processImageJobs(store,{workerId:'worker'});
    expect(store.artifacts['trail-image-publication-requests'].requests[0]).toEqual(expect.objectContaining({id:'approval-1',trailId:'seceda',uploadRef:candidate.uploadRef,status:'approved-for-pr-creation',publicMutationAllowed:false}));
  });

  test('an exact licensed candidate can use the same publication lane',async()=>{
    const assetUrl='https://upload.wikimedia.org/example/seceda.jpg';const candidate={title:'Seceda',assetUrl,sourcePageUrl:'https://commons.wikimedia.org/wiki/File:Seceda.jpg',creator:'Example photographer',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',altText:'Seceda ridge',status:'ready-for-asset-review'};
    const audit={gaps:[{slug:'seceda',trailId:'seceda',title:'Seceda Ridge Trail',sourceRef:'trail.html?id=seceda',reasons:['Missing image'],libraryMatches:[]}]};
    const store=memoryStore({'image-coverage':audit,'image-coverage-results':{items:[{slug:'seceda',generatedAt:at,summary:'Licensed candidate',candidates:[candidate]}]}});
    store.reviews.image.push({id:'approval-licensed',slug:'seceda',trailId:'seceda',action:'approve-image-candidate',assetRef:assetUrl,creator:candidate.creator,rightsBasis:'licensed',license:candidate.license,licenseUrl:candidate.licenseUrl,sourcePageUrl:candidate.sourcePageUrl,sourceType:'licensed-source',altText:candidate.altText,note:'Approved',submittedAt:at});
    await ingestImageReviews(store);await processImageJobs(store,{workerId:'worker'});
    expect(store.artifacts['trail-image-publication-requests'].requests[0]).toEqual(expect.objectContaining({id:'approval-licensed',assetRef:assetUrl,license:'CC BY-SA 4.0',sourceType:'licensed-source',status:'approved-for-pr-creation'}));
  });
});
