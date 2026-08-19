'use strict';

const fs=require('fs');
const path=require('path');
const {TextEncoder,TextDecoder}=require('util');
global.TextEncoder=global.TextEncoder||TextEncoder;global.TextDecoder=global.TextDecoder||TextDecoder;
const {JSDOM}=require('jsdom');

describe('ORMA executive backoffice dashboard',()=>{
  test('uses live Firestore trail state and surfaces blocked human gates',async()=>{
    const root=__dirname;const html=fs.readFileSync(path.join(root,'backoffice-review.html'),'utf8');
    const script=fs.readFileSync(path.join(root,'backoffice-dashboard.js'),'utf8');
    const dom=new JSDOM(html,{url:'https://www.app-orma.com/backoffice-review.html',runScripts:'outside-only'});
    const {window}=dom;window.fetch=async()=>({ok:false,status:404});
    const artifacts={
      'trail-orchestration':{trails:[{state:'dossier-human-gate',stage:'complete-evidence-dossier',blockers:['regulatoryRanger/access: conflicted']}],summary:{trails:1}},
      'dossier-review-queue':{items:[{state:'awaiting-human',candidateId:'osm-16363583',trailName:'Le Marais de Pré Lombard',approvalAllowed:false}]},
      'verified-trail-editorial-execution':{outputs:[]},
      'publication-staging':{items:[]},
      'content-review-queue':{submissions:[]},
    };
    window.ORMABackoffice={
      getArtifact:async id=>({ok:true,data:artifacts[id]}),
      getRevisionJobs:async()=>({ok:true,jobs:[]}),
    };
    window.eval(script);await new Promise(resolve=>window.setTimeout(resolve,20));
    expect(window.document.getElementById('dashboardUpdated').textContent).toContain('Live Firestore');
    expect(window.document.getElementById('needsReviewCount').textContent).toBe('1');
    expect(window.document.getElementById('executiveDecisionQueue').textContent).toContain('Existing Trail evidence');
    expect(window.document.getElementById('executiveDecisionQueue').textContent).toContain('locked by evidence findings');
    dom.window.close();
  });
});
