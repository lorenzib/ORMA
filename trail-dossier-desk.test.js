'use strict';

const fs=require('fs');
const path=require('path');
const {TextEncoder,TextDecoder}=require('util');
global.TextEncoder=global.TextEncoder||TextEncoder;global.TextDecoder=global.TextDecoder||TextDecoder;
const {JSDOM}=require('jsdom');

describe('Trail Verification Desk revision controls',()=>{
  test('preserves a Cartographer draft across refresh and shows a queued receipt',async()=>{
    const html='<!doctype html><html><body><button id="refreshDossiers"></button><div id="dossierState"></div><div id="dossierQueue"></div><div id="fleetSummary"></div><ol id="agentActivity"></ol></body></html>';
    const dom=new JSDOM(html,{url:'https://dolopaws-backoffice.web.app/trail-dossier-desk.html',runScripts:'outside-only'});
    const {window}=dom;window.setInterval=()=>0;
    const queue={items:[{reviewId:'review-route-1',candidateId:'osm-route-1',trailName:'Test loop',gateType:'dossier-approval',state:'awaiting-human',approvalAllowed:true,specialistOutputs:[{agentId:'cartographer',result:{candidateId:'osm-route-1'}}]}]};
    const artifacts={
      'dossier-review-queue':queue,
      'trail-orchestration':{trails:[],summary:{trails:1,awaitingHuman:1,running:0,states:{}}},
    };
    let submitted=null;
    window.ORMABackoffice={
      getArtifact:async id=>({ok:true,data:artifacts[id]}),
      getRevisionJobs:async()=>({ok:true,jobs:[]}),
      submitDossierReview:async payload=>{submitted=payload;return {ok:true,reviewId:'firestore-review-123',status:'queued'};},
    };
    const script=fs.readFileSync(path.join(__dirname,'trail-dossier-desk.js'),'utf8');
    window.eval(script);await new Promise(resolve=>window.setTimeout(resolve,20));

    let note=window.document.querySelector('.bo-dossier-controls textarea');
    expect(note).not.toBeNull();
    expect(window.document.querySelector('[data-action="request-revision"]').textContent).toBe('Send revision to Cartographer');
    note.value='Rebuild the route from the official relation and explain the closure gap.';
    note.dispatchEvent(new window.Event('input',{bubbles:true}));note.blur();
    window.document.getElementById('refreshDossiers').click();await new Promise(resolve=>window.setTimeout(resolve,20));
    note=window.document.querySelector('.bo-dossier-controls textarea');
    expect(note.value).toBe('Rebuild the route from the official relation and explain the closure gap.');
    expect(window.document.querySelector('.bo-decision').textContent).toContain('Draft saved');

    window.document.querySelector('[data-action="request-revision"]').click();
    await new Promise(resolve=>window.setTimeout(resolve,20));
    expect(submitted).toEqual({
      reviewId:'review-route-1',candidateId:'osm-route-1',action:'request-revision',targetAgent:'cartographer',
      note:'Rebuild the route from the official relation and explain the closure gap.',
    });
    expect(window.document.querySelector('.bo-decision').textContent).toContain('Revision saved for Cartographer');
    expect(window.document.querySelector('.bo-decision').textContent).toContain('firestore-review-123');
    expect(JSON.parse(window.localStorage.getItem('orma-dossier-review-receipts-v1'))['review-route-1'].submissionId).toBe('firestore-review-123');
    dom.window.close();
  });
});
