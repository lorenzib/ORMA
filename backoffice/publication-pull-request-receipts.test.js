'use strict';

const {pullRequestNumber,recordPublicationPullRequestStates}=require('./workflows/publication-pull-request-receipts');
const {main}=require('./cli/reconcile-publication-pull-requests');
const {buildDashboardModel}=require('./dashboard-model');

const OPEN='https://github.com/benedettalorenzi/dolopaws/pull/950';
const CLOSED='https://github.com/benedettalorenzi/dolopaws/pull/949';
const MERGED='https://github.com/benedettalorenzi/dolopaws/pull/925';

function artifact(){
  return {contractVersion:'1.0.0',requests:[
    {id:'a',candidateId:'trail-open',targetTrailId:'open',status:'pull-request-opened',pullRequestUrl:OPEN},
    {id:'b',candidateId:'trail-closed',targetTrailId:'closed',status:'pull-request-opened',pullRequestUrl:CLOSED},
    {id:'c',candidateId:'trail-merged',targetTrailId:'merged',status:'pull-request-opened',pullRequestUrl:MERGED},
    {id:'d',candidateId:'trail-live',targetTrailId:'live',status:'published',pullRequestUrl:CLOSED},
  ]};
}

describe('publication pull request receipts',()=>{
  test('reads the number out of a pull request URL',()=>{
    expect(pullRequestNumber(CLOSED)).toBe(949);
    expect(pullRequestNumber('https://github.com/orma/pr/1')).toBeNull();
  });

  test('a closed pull request ends its request, a merged one waits for the deployment receipt',()=>{
    const states=new Map([
      [OPEN,{state:'open',merged:false}],
      [CLOSED,{state:'closed',merged:false,closedAt:'2026-10-23T12:57:52Z'}],
      [MERGED,{state:'closed',merged:true,mergedAt:'2026-10-22T09:50:54Z'}],
    ]);
    const result=recordPublicationPullRequestStates(artifact(),states,{at:'2026-10-23T18:00:00Z'});
    const [open,closed,merged,live]=result.artifact.requests;
    expect(result).toEqual(expect.objectContaining({closed:1,merged:1}));
    expect(open.status).toBe('pull-request-opened');
    expect(closed).toEqual(expect.objectContaining({status:'pull-request-closed',retryable:false,pullRequestClosedAt:'2026-10-23T12:57:52Z'}));
    expect(merged).toEqual(expect.objectContaining({status:'pull-request-opened',pullRequestMergedAt:'2026-10-22T09:50:54Z'}));
    expect(live.status).toBe('published');
  });

  test('the board asks for a review only of a pull request that is still open',()=>{
    const states=new Map([[CLOSED,{state:'closed',merged:false}],[MERGED,{state:'closed',merged:true,mergedAt:'2026-10-22T09:50:54Z'}]]);
    const publicationRequests=recordPublicationPullRequestStates(artifact(),states).artifact;
    const model=buildDashboardModel({orchestration:{trails:[]},dossiers:{items:[]},publication:{items:[]},history:[],jobs:[],publicationRequests});
    expect(model.decisions.filter(item=>item.kind==='pull-request').map(item=>item.href)).toEqual([OPEN]);
    expect(model.activity.find(item=>item.status==='pull-request-closed').message).toContain('closed without merging');
  });

  test('the worker step asks GitHub once per pull request and writes only when something changed',async()=>{
    let stored=artifact();const writes=[];const asked=[];
    const store={getArtifact:async()=>stored,setArtifact:async(id,data)=>{writes.push(id);stored=data;}};
    const answers={949:{state:'closed',merged_at:null,closed_at:'2026-10-23T12:57:52Z'},925:{state:'closed',merged_at:'2026-10-22T09:50:54Z'},950:{state:'open',merged_at:null}};
    const fetch=async url=>{const n=Number(url.split('/').pop());asked.push(n);return {ok:true,json:async()=>answers[n]};};
    const log=jest.spyOn(console,'log').mockImplementation(()=>{});
    await main({env:{GITHUB_REPOSITORY:'benedettalorenzi/dolopaws'},store,fetch});
    expect(asked.sort()).toEqual([925,949,950]);
    expect(writes).toEqual(['publication-requests']);
    asked.length=0;writes.length=0;
    await main({env:{},store,fetch});
    expect(asked).toEqual([950]);
    expect(writes).toEqual([]);
    log.mockRestore();
  });
});
