'use strict';

const fs=require('fs/promises');
const os=require('os');
const path=require('path');
const {main:confirmPublications}=require('./cli/confirm-publications');
const {main:findPagesDeployment}=require('./cli/find-pages-deployment');
const {selectSuccessfulPagesDeployment,findSuccessfulPagesDeployment}=require('./workflows/github-pages-deployment');
const {publicTrailUrl,recordPublicationDeployment}=require('./workflows/publication-deployment-receipts');

describe('truthful deployed-publication receipts',()=>{
  test('moves only committed PR receipts to published and updates staging truthfully',()=>{
    const requests={contractVersion:'1.0.0',requests:[
      {id:'approval-a',candidateId:'candidate-a',targetTrailId:'trail-a',status:'pull-request-opened',pullRequestUrl:'https://github.com/orma/pr/1',failureStage:'pull-request-creation',failureHistory:[{stage:'pull-request-creation'}]},
      {id:'approval-b',candidateId:'candidate-b',targetTrailId:'trail-b',status:'pull-request-opened'},
    ]};
    const staging={contractVersion:'1.0.0',summary:{trails:2,readyForPreview:2,waitingForApprovals:0,publicMutations:0},items:[
      {candidateId:'candidate-a',targetTrailId:'trail-a',state:'ready-for-publication-preview'},
      {candidateId:'candidate-b',targetTrailId:'trail-b',state:'ready-for-publication-preview'},
    ]};
    const overrides={trails:[{approvalId:'approval-a',candidateId:'candidate-a',id:'trail-a',fields:{ormaVerified:true}}]};
    const result=recordPublicationDeployment(requests,staging,overrides,{commitSha:'abcdef123456',deploymentRunUrl:'https://github.com/orma/actions/runs/9',publicBaseUrl:'https://www.app-orma.com'},{at:'2026-08-20T10:00:00Z'});
    expect(result.published).toBe(1);expect(result.candidateIds).toEqual(['candidate-a']);
    expect(result.requestsArtifact.requests[0]).toEqual(expect.objectContaining({status:'published',publicationCommit:'abcdef123456',publicMutationAllowed:false,publicMutationCompleted:true,publicUrl:'https://www.app-orma.com/trail.html?id=trail-a'}));
    expect(result.requestsArtifact.requests[0].failureStage).toBeUndefined();expect(result.requestsArtifact.requests[0].failureHistory).toHaveLength(1);
    expect(result.requestsArtifact.requests[1].status).toBe('pull-request-opened');
    expect(result.stagingArtifact.items[0]).toEqual(expect.objectContaining({state:'published',publicationApprovalId:'approval-a',publicMutationCompleted:true}));
    expect(result.stagingArtifact.summary).toEqual(expect.objectContaining({readyForPreview:1,published:1,publicMutations:1}));
  });

  test('requires both immutable commit and successful deployment-run evidence',()=>{
    expect(()=>recordPublicationDeployment({requests:[]},{items:[]},{trails:[]},{deploymentRunUrl:'https://github.com/run'})).toThrow('commit SHA');
    expect(publicTrailUrl('https://www.app-orma.com','lago braies')).toBe('https://www.app-orma.com/trail.html?id=lago+braies');
    expect(publicTrailUrl('https://www.app-orma.com/','tre-cime')).toBe('https://www.app-orma.com/trail.html?id=tre-cime');
  });

  test('reads approval IDs from the exact deployed checkout and saves both protected artifacts',async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'orma-deployment-receipt-'));
    const target=path.join(root,'deployed-site/data');await fs.mkdir(target,{recursive:true});
    await fs.writeFile(path.join(target,'verified-trail-overrides.json'),JSON.stringify({trails:[{approvalId:'approval-a',candidateId:'candidate-a',id:'trail-a'}]}));
    const artifacts={
      'publication-requests':{requests:[{id:'approval-a',candidateId:'candidate-a',targetTrailId:'trail-a',status:'pull-request-opened'}]},
      'publication-staging':{items:[{candidateId:'candidate-a',targetTrailId:'trail-a',state:'ready-for-publication-preview'}],summary:{}},
    };const writes=[];const store={getArtifact:async id=>artifacts[id],setArtifact:async(id,value,metadata)=>{artifacts[id]=value;writes.push({id,metadata});}};
    try{const result=await confirmPublications({root,store,at:'2026-08-20T10:00:00Z',env:{ORMA_PUBLICATION_OVERRIDES_PATH:'deployed-site/data/verified-trail-overrides.json',ORMA_PUBLICATION_COMMIT_SHA:'abc123',ORMA_PUBLICATION_DEPLOYMENT_URL:'https://github.com/orma/actions/runs/9'}});expect(result.published).toBe(1);expect(writes.map(item=>item.id).sort()).toEqual(['publication-requests','publication-staging']);expect(artifacts['publication-requests'].requests[0].status).toBe('published');}
    finally{await fs.rm(root,{recursive:true,force:true});}
  });

  test('selects only a successful main Pages deployment for the requested commit',()=>{
    const runs=[
      {id:1,name:'Validate ORMA',head_branch:'main',head_sha:'target',conclusion:'success',html_url:'https://github.com/orma/actions/runs/1'},
      {id:2,name:'pages build and deployment',head_branch:'feature',head_sha:'target',conclusion:'success',html_url:'https://github.com/orma/actions/runs/2'},
      {id:3,name:'pages build and deployment',head_branch:'main',head_sha:'other',conclusion:'success',html_url:'https://github.com/orma/actions/runs/3'},
      {id:4,name:'pages build and deployment',head_branch:'main',head_sha:'target',conclusion:'success',html_url:'https://github.com/orma/actions/runs/4',created_at:'2026-08-20T10:00:00Z'},
    ];
    expect(selectSuccessfulPagesDeployment(runs,{commitSha:'target'})).toEqual({found:true,commitSha:'target',deploymentRunUrl:'https://github.com/orma/actions/runs/4',deploymentRunId:4,createdAt:'2026-08-20T10:00:00Z'});
    expect(selectSuccessfulPagesDeployment(runs,{commitSha:'missing'})).toBeNull();
  });

  test('discovers the latest successful Pages evidence through the GitHub API',async()=>{
    const calls=[];const fetchImpl=async(url,request)=>{calls.push({url:String(url),request});return {ok:true,json:async()=>({workflow_runs:[{id:9,name:'pages build and deployment',head_branch:'main',head_sha:'abc123',conclusion:'success',html_url:'https://github.com/orma/actions/runs/9',created_at:'2026-08-20T10:00:00Z'}]})};};
    const evidence=await findSuccessfulPagesDeployment({repository:'lorenzib/ORMA',token:'secret-token',fetchImpl});
    expect(evidence).toEqual(expect.objectContaining({commitSha:'abc123',deploymentRunId:9}));
    expect(calls[0].url).toContain('/repos/lorenzib/ORMA/actions/runs?');
    expect(calls[0].url).toContain('branch=main');expect(calls[0].url).toContain('status=success');
    expect(calls[0].request.headers.Authorization).toBe('Bearer secret-token');
  });

  test('writes immutable Pages evidence to GitHub outputs and treats deployment delay as a no-op',async()=>{
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'orma-pages-evidence-'));const output=path.join(root,'github-output');
    try{
      const found=await findPagesDeployment({env:{GITHUB_REPOSITORY:'lorenzib/ORMA',GH_TOKEN:'token',GITHUB_OUTPUT:output},fetchImpl:async()=>({ok:true,json:async()=>({workflow_runs:[{id:9,name:'pages build and deployment',head_branch:'main',head_sha:'abc123',conclusion:'success',html_url:'https://github.com/orma/actions/runs/9'}]})})});
      expect(found).toEqual(expect.objectContaining({commitSha:'abc123'}));expect(await fs.readFile(output,'utf8')).toContain('found=true\ncommit_sha=abc123\nrun_url=https://github.com/orma/actions/runs/9');
      await fs.writeFile(output,'');
      const waiting=await findPagesDeployment({env:{GITHUB_REPOSITORY:'lorenzib/ORMA',GH_TOKEN:'token',GITHUB_OUTPUT:output,ORMA_PUBLICATION_COMMIT_SHA:'not-deployed'},fetchImpl:async()=>({ok:true,json:async()=>({workflow_runs:[]})})});
      expect(waiting).toEqual({found:false});expect(await fs.readFile(output,'utf8')).toBe('found=false\n');
    }finally{await fs.rm(root,{recursive:true,force:true});}
  });
});
