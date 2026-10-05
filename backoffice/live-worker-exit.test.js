'use strict';

const {blockedLanes,REVIEW_LANES}=require('./cli/live-worker');
const worker=require('./workflows/run-live-backoffice-worker');

describe('live worker exit code',()=>{
  test('only reads lanes the worker actually returns',()=>{
    // Retiring a lane once left a dangling read here, and the undefined lane threw
    // before the exit code could be set. Pin the contract to the worker's exports.
    const source=require('fs').readFileSync(require.resolve('./workflows/run-live-backoffice-worker'),'utf8');
    const returned=source.match(/return \{ workerId:options\.workerId \|\| null,([\s\S]*?)completedAt:/)[1];
    for(const lane of REVIEW_LANES) expect(returned).toContain(lane);
    expect(returned).not.toContain('editorialReviews');
    expect(returned).not.toContain('newsletterReviews');
    expect(returned).not.toContain('analystReviews');
  });

  test('a result missing every lane does not throw',()=>{
    expect(blockedLanes({})).toEqual([]);
    expect(blockedLanes()).toEqual([]);
  });

  test('a blocked review or a failed hazard vetting fails the run',()=>{
    expect(blockedLanes({reviews:[{status:'blocked'}]})).toEqual(['reviews']);
    // A route choice the worker could not apply is the editor's decision going
    // nowhere, which is exactly what a red run is for.
    expect(blockedLanes({routeReviews:[{status:'blocked'}]})).toEqual(['routeReviews']);
    expect(blockedLanes({routeReviews:[{status:'superseded'}]})).toEqual([]);
    // A trail waiting for a free fleet slot is not a failure; an admission that
    // could not be written is.
    expect(blockedLanes({routeAdmissions:[{status:'held',reason:'verification-capacity-reached'}]})).toEqual([]);
    expect(blockedLanes({routeAdmissions:[{status:'blocked',error:'contract'}]})).toEqual(['routeAdmissions']);
    expect(blockedLanes({publications:[{status:'processed'}]})).toEqual([]);
    expect(blockedLanes({communityHazards:{vetted:[{status:'vetting-failed'}]}})).toEqual(['communityHazards']);
    expect(blockedLanes({communityHazards:{vetted:[{status:'published'}]}})).toEqual([]);
  });

  test('the worker still exports the lanes the exit check names',()=>{
    expect(typeof worker.runLiveBackofficeWorker).toBe('function');
    expect(REVIEW_LANES).toEqual(['reviews','routeReviews','routeAdmissions','dossierReviews','publications']);
  });
});
