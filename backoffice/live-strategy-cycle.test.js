'use strict';

const fs=require('fs/promises');const os=require('os');const path=require('path');
const {runLiveStrategyCycle}=require('./workflows/run-live-strategy-cycle');

describe('hosted weekly strategy cycle',()=>{
  test('stores three protected copy packets, image audit, and a truthful health receipt',async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'orma-strategy-test-'));await fs.mkdir(path.join(root,'backoffice-data'),{recursive:true});
    const artifacts={};const store={getArtifact:async id=>artifacts[id]||null,setArtifact:async(id,value)=>{artifacts[id]=value;}};
    const runEditorialCycle=async cycleRoot=>{const ledger={contractVersion:'1.0.0',items:[]};await fs.writeFile(path.join(cycleRoot,'backoffice-data/editorial-ledger.json'),JSON.stringify(ledger));for(let slot=1;slot<=3;slot++){const packet={generatedAt:`2026-08-20T12:0${slot}:00Z`,outputs:[{status:'ready-for-review'}]};await fs.writeFile(path.join(cycleRoot,`backoffice-data/editorial-review-packet-${slot}.json`),JSON.stringify(packet));}return {preserved:[],generated:[1,2,3],blocked:[]};};
    try{const result=await runLiveStrategyCycle(store,{root,at:'2026-08-20T12:00:00Z',completedAt:'2026-08-20T12:10:00Z',runId:'123',runEditorialCycle,auditImageCoverage:async()=>({summary:{pagesScanned:11,missing:8},gaps:[]}),runProductDiscovery:async()=>({contractVersion:'1.0.0',generatedAt:'2026-08-20T12:00:00Z',mode:'research-only',publicMutationAllowed:false,executiveSummary:'One idea',ideas:[{id:'idea-1',category:'feature',title:'Idea',signal:'Evidence',ormaOpportunity:'Opportunity',whyNow:'Now',impact:'high',confidence:'high',suggestedInvestigation:[],sources:[]}],summary:{total:1,awaitingReview:1,highImpact:1,categories:['feature']}}),runNewsletter:async()=>({contractVersion:'1.0.0',generatedAt:'2026-08-20T12:00:00Z',mode:'draft-only',publicMutationAllowed:false,subject:{type:'newsletter',id:'issue-1'},outputs:[{status:'ready-for-review'}],summary:{readyForReview:1,blocked:0}})});expect(result.summary).toEqual(expect.objectContaining({editorialActive:3,imageGaps:8,productIdeas:1,newsletterStatus:'draft ready'}));expect(artifacts['strategy-cycle-status']).toEqual(expect.objectContaining({status:'healthy',runId:'123',publicMutationAllowed:false}));expect(artifacts['editorial-review-packet-3']).toBeTruthy();expect(artifacts['newsletter-review-packet']).toBeTruthy();}
    finally{await fs.rm(root,{recursive:true,force:true});}
  });
});
