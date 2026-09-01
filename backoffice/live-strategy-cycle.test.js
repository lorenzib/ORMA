'use strict';

const fs=require('fs/promises');const os=require('os');const path=require('path');
const {buildNewsletterInputs,runLiveStrategyCycle}=require('./workflows/run-live-strategy-cycle');

describe('hosted weekly strategy cycle',()=>{
  test('marks Newsletter inputs parked unless content readiness is explicitly enabled',()=>{
    const parked=buildNewsletterInputs({at:'2026-08-20T12:00:00Z'});
    const enabled=buildNewsletterInputs({at:'2026-08-20T12:00:00Z',newsletterEnabled:true});
    expect(parked.status).toBe('parked-awaiting-content-readiness');
    expect(enabled.status).toBe('ready-for-newsletter-agent');
  });
  test('stores three protected copy packets, image audit, and a truthful health receipt',async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'orma-strategy-test-'));await fs.mkdir(path.join(root,'backoffice-data'),{recursive:true});
    const artifacts={'publication-staging':{items:[{candidateId:'trail-a',targetTrailId:'trail-a',state:'published'}]},'publication-requests':{requests:[{id:'release-a',candidateId:'trail-a',targetTrailId:'trail-a',status:'published',publicUrl:'https://www.app-orma.com/trail.html?id=trail-a'}]}};const store={getArtifact:async id=>artifacts[id]||null,setArtifact:async(id,value)=>{artifacts[id]=value;}};
    const runEditorialCycle=async cycleRoot=>{const ledger={contractVersion:'1.0.0',items:[]};await fs.writeFile(path.join(cycleRoot,'backoffice-data/editorial-ledger.json'),JSON.stringify(ledger));for(let slot=1;slot<=3;slot++){const packet={generatedAt:`2026-08-20T12:0${slot}:00Z`,outputs:[{status:'ready-for-review'}]};await fs.writeFile(path.join(cycleRoot,`backoffice-data/editorial-review-packet-${slot}.json`),JSON.stringify(packet));}return {preserved:[],generated:[1,2,3],blocked:[]};};
    artifacts['image-coverage']={summary:{pagesScanned:11,missing:8},gaps:[]};
    try{const result=await runLiveStrategyCycle(store,{root,at:'2026-08-20T12:00:00Z',completedAt:'2026-08-20T12:10:00Z',runId:'123',editorialEnabled:true,analystEnabled:true,newsletterEnabled:true,runEditorialCycle,runProductDiscovery:async()=>({contractVersion:'1.0.0',generatedAt:'2026-08-20T12:00:00Z',mode:'research-only',publicMutationAllowed:false,executiveSummary:'One idea',ideas:[{id:'idea-1',category:'feature',title:'Idea',signal:'Evidence',ormaOpportunity:'Opportunity',whyNow:'Now',impact:'high',confidence:'high',suggestedInvestigation:[],sources:[]}],summary:{total:1,awaitingReview:1,highImpact:1,categories:['feature']}}),runNewsletter:async()=>({contractVersion:'1.0.0',generatedAt:'2026-08-20T12:00:00Z',mode:'draft-only',publicMutationAllowed:false,subject:{type:'newsletter',id:'issue-1'},outputs:[{status:'ready-for-review'}],summary:{readyForReview:1,blocked:0}})});expect(result.summary).toEqual(expect.objectContaining({editorialActive:3,imageGaps:8,productIdeas:1,newsletterStatus:'draft ready'}));expect(artifacts['strategy-cycle-status']).toEqual(expect.objectContaining({status:'healthy',runId:'123',publicMutationAllowed:false}));expect(artifacts['editorial-review-packet-3']).toBeTruthy();expect(artifacts['newsletter-review-packet']).toBeTruthy();expect(artifacts['newsletter-inputs'].newlyPublishedTrails).toEqual([expect.objectContaining({candidateId:'trail-a',status:'published',publicUrl:'https://www.app-orma.com/trail.html?id=trail-a'})]);}
    finally{await fs.rm(root,{recursive:true,force:true});}
  });

  test('preserves Editorial and Analyst artifacts without generating new MVP work',async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'orma-strategy-paused-'));await fs.mkdir(path.join(root,'backoffice-data'),{recursive:true});
    const packet={generatedAt:'2026-08-20T12:00:00Z',subject:{type:'page',id:'privacy'},outputs:[{status:'ready-for-review'}]};
    const artifacts={'editorial-review-packet-1':packet,'product-ideas':{generatedAt:'2026-08-20T12:00:00Z',ideas:[{id:'saved'}]},'image-coverage':{summary:{pagesScanned:4,missing:3},gaps:[]}};
    const store={getArtifact:async id=>artifacts[id]||null,setArtifact:async(id,value)=>{artifacts[id]=value;}};
    try{const result=await runLiveStrategyCycle(store,{root,at:'2026-09-01T12:00:00Z'});expect(result.summary).toEqual(expect.objectContaining({editorialActive:0,editorialGenerated:0,editorialStatus:'parked for MVP; existing packets preserved',productStatus:'parked for MVP; existing ideas preserved'}));expect(artifacts['editorial-review-packet-1']).toEqual(packet);expect(artifacts['product-ideas'].ideas).toEqual([{id:'saved'}]);}
    finally{await fs.rm(root,{recursive:true,force:true});}
  });
});
