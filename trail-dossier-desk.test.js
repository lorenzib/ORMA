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

  test('renders route-choice proposals and records the chosen variant to Firestore',async()=>{
    const html='<!doctype html><html><body><button id="refreshDossiers"></button><div id="dossierState"></div>'
      +'<section id="routeSection" hidden></section><div id="routeQueue"></div>'
      +'<div id="dossierQueue"></div><div id="fleetSummary"></div><ol id="agentActivity"></ol></body></html>';
    const dom=new JSDOM(html,{url:'https://dolopaws-backoffice.web.app/trail-dossier-desk.html',runScripts:'outside-only'});
    const {window}=dom;window.setInterval=()=>0;
    const routeReview={items:[{
      candidateId:'osm-relation-1484751',reviewState:'ready-for-human-route-choice',title:'Choose the intended Tre Cime loop',
      routeIdentity:'Two distinct official circuits start at Rifugio Auronzo.',selectionMode:'one-or-more',
      findings:['The stored candidate line is only an eight-point approximation.'],
      proposals:[
        {id:'tre-cime-classic-101-105',label:'Classic Tre Cime circuit',summary:'The closer circuit.',recommended:true,metrics:{computedDistanceKm:9.51,officialAscentM:468,pointCount:2077},warnings:['Officially rated hard.']},
        {id:'tre-cime-monte-paterno-101-104-105',label:'Extended Monte Paterno circuit',summary:'The longer circuit.',recommended:false,metrics:{computedDistanceKm:14.2,pointCount:2992},warnings:['Longer and more demanding.']},
      ],
    }]};
    const artifacts={
      'dossier-review-queue':{items:[]},
      'trail-orchestration':{trails:[],summary:{trails:1,awaitingHuman:0,running:0,states:{}}},
      'route-review':routeReview,
    };
    let submitted=null;
    window.ORMABackoffice={
      getArtifact:async id=>({ok:true,data:artifacts[id]}),
      getRevisionJobs:async()=>({ok:true,jobs:[]}),
      getRouteReviews:async()=>({ok:true,reviews:[]}),
      submitRouteReview:async payload=>{submitted=payload;return {ok:true,reviewId:'firestore-route-99',status:'queued'};},
    };
    const script=fs.readFileSync(path.join(__dirname,'trail-dossier-desk.js'),'utf8');
    window.eval(script);await new Promise(resolve=>window.setTimeout(resolve,20));

    // The section reveals and both official variants render as selectable panels.
    expect(window.document.getElementById('routeSection').hidden).toBe(false);
    const proposals=window.document.querySelectorAll('.bo-route-proposal');
    expect(proposals).toHaveLength(2);
    expect(window.document.querySelector('.bo-route-choice h2').textContent).toBe('Choose the intended Tre Cime loop');
    // The recommended variant is pre-selected.
    const classic=window.document.querySelector('input[data-proposal-id="tre-cime-classic-101-105"]');
    expect(classic.checked).toBe(true);
    // Keep both variants → approve-route-variants with both ids.
    window.document.querySelector('input[data-proposal-id="tre-cime-monte-paterno-101-104-105"]').checked=true;
    window.document.querySelector('.bo-route-controls [data-action="approve"]').click();
    await new Promise(resolve=>window.setTimeout(resolve,20));
    expect(submitted).toEqual({
      candidateId:'osm-relation-1484751',action:'approve-route-variants',
      proposalIds:['tre-cime-classic-101-105','tre-cime-monte-paterno-101-104-105'],note:'',
    });
    expect(window.document.querySelector('.bo-route-choice .bo-decision').textContent).toContain('firestore-route-99');
    expect(JSON.parse(window.localStorage.getItem('orma-route-review-receipts-v1'))['osm-relation-1484751'].action).toBe('approve-route-variants');
    dom.window.close();
  });

  test('a single kept variant submits approve-route',async()=>{
    const html='<!doctype html><html><body><button id="refreshDossiers"></button><div id="dossierState"></div>'
      +'<section id="routeSection" hidden></section><div id="routeQueue"></div>'
      +'<div id="dossierQueue"></div><div id="fleetSummary"></div><ol id="agentActivity"></ol></body></html>';
    const dom=new JSDOM(html,{url:'https://dolopaws-backoffice.web.app/trail-dossier-desk.html',runScripts:'outside-only'});
    const {window}=dom;window.setInterval=()=>0;
    const artifacts={
      'dossier-review-queue':{items:[]},
      'trail-orchestration':{trails:[],summary:{trails:1,awaitingHuman:0,running:0,states:{}}},
      'route-review':{items:[{candidateId:'osm-way-25736154',reviewState:'ready-for-human-review',title:'Review the Lago di Braies circuit',selectionMode:'one',proposals:[{id:'braies-loop',label:'Braies loop',recommended:true,metrics:{computedDistanceKm:3.6}}]}]},
    };
    let submitted=null;
    window.ORMABackoffice={
      getArtifact:async id=>({ok:true,data:artifacts[id]}),
      getRevisionJobs:async()=>({ok:true,jobs:[]}),
      getRouteReviews:async()=>({ok:true,reviews:[]}),
      submitRouteReview:async payload=>{submitted=payload;return {ok:true,reviewId:'firestore-route-1',status:'queued'};},
    };
    const script=fs.readFileSync(path.join(__dirname,'trail-dossier-desk.js'),'utf8');
    window.eval(script);await new Promise(resolve=>window.setTimeout(resolve,20));
    window.document.querySelector('.bo-route-controls [data-action="approve"]').click();
    await new Promise(resolve=>window.setTimeout(resolve,20));
    expect(submitted.action).toBe('approve-route');
    expect(submitted.proposalIds).toEqual(['braies-loop']);
    dom.window.close();
  });

  test('an already-queued route review shows a receipt instead of controls',async()=>{
    const html='<!doctype html><html><body><button id="refreshDossiers"></button><div id="dossierState"></div>'
      +'<section id="routeSection" hidden></section><div id="routeQueue"></div>'
      +'<div id="dossierQueue"></div><div id="fleetSummary"></div><ol id="agentActivity"></ol></body></html>';
    const dom=new JSDOM(html,{url:'https://dolopaws-backoffice.web.app/trail-dossier-desk.html',runScripts:'outside-only'});
    const {window}=dom;window.setInterval=()=>0;
    const artifacts={
      'dossier-review-queue':{items:[]},
      'trail-orchestration':{trails:[],summary:{trails:1,awaitingHuman:0,running:0,states:{}}},
      'route-review':{items:[{candidateId:'osm-relation-1372055',reviewState:'source-exhausted-direct-confirmation',title:'Hold Monte Pelmo',selectionMode:'one',proposals:[{id:'pelmo',label:'Monte Pelmo'}]}]},
    };
    window.ORMABackoffice={
      getArtifact:async id=>({ok:true,data:artifacts[id]}),
      getRevisionJobs:async()=>({ok:true,jobs:[]}),
      getRouteReviews:async()=>({ok:true,reviews:[{candidateId:'osm-relation-1372055',status:'queued'}]}),
      submitRouteReview:async()=>({ok:true,reviewId:'x',status:'queued'}),
    };
    const script=fs.readFileSync(path.join(__dirname,'trail-dossier-desk.js'),'utf8');
    window.eval(script);await new Promise(resolve=>window.setTimeout(resolve,20));
    expect(window.document.querySelector('.bo-route-controls')).toBeNull();
    expect(window.document.querySelector('.bo-route-choice .bo-decision').textContent).toContain('already queued');
    dom.window.close();
  });
});
