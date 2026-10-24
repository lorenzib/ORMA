'use strict';

// A publication request waits at `pull-request-opened` until the deployment
// receipt says the merged change is live. Nothing moved it when its pull
// request was closed instead of merged (#949 was closed as stale on 23 Oct),
// so the board kept asking for a review of a pull request that no longer
// existed. This reads what GitHub says about each pull request and records it.
//
// A closed pull request ends that request: it is not retried, because the
// trails it carried may since have been verified by hand or withdrawn, and a
// rebuild would put them back. A fresh approval publishes again. A merged one
// keeps its status, so the deployment receipt can still record it as live.

function pullRequestNumber(url){
  const match=/\/pull\/(\d+)(?:[/?#]|$)/.exec(String(url||''));
  return match?Number(match[1]):null;
}

function recordPublicationPullRequestStates(artifact,states,options={}){
  if(!artifact||!Array.isArray(artifact.requests))throw new Error('Publication request artifact is missing');
  const at=options.at||new Date().toISOString();
  let closed=0;let merged=0;
  const requests=artifact.requests.map(request=>{
    if(request.status!=='pull-request-opened'||!request.pullRequestUrl)return request;
    const state=states.get(request.pullRequestUrl);
    if(!state)return request;
    if(state.merged){
      if(request.pullRequestMergedAt)return request;
      merged+=1;
      return {...request,pullRequestMergedAt:state.mergedAt||at};
    }
    if(state.state!=='closed')return request;
    closed+=1;
    return {...request,status:'pull-request-closed',retryable:false,publicMutationAllowed:false,
      pullRequestClosedAt:state.closedAt||at,reconciledAt:at};
  });
  return {artifact:closed||merged?{...artifact,updatedAt:at,requests}:artifact,closed,merged};
}

module.exports={pullRequestNumber,recordPublicationPullRequestStates};
