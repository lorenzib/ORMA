'use strict';

const fs=require('fs/promises');
const os=require('os');
const path=require('path');
const {evaluatePublicationGate}=require('./workflows/publication-gate');
const {apiUrl,main}=require('./cli/check-publication-gate');

const run=(overrides={})=>({status:'completed',conclusion:'success',head_sha:'abc',updated_at:'2026-09-05T08:00:00Z',html_url:'https://github.com/lorenzib/ORMA/actions/runs/1',...overrides});

describe('website publication validation circuit breaker',()=>{
  test('opens only for the latest completed successful validation of the exact commit',()=>{
    const gate=evaluatePublicationGate([
      run({conclusion:'failure',updated_at:'2026-09-05T07:00:00Z'}),
      run({conclusion:'success',updated_at:'2026-09-05T08:00:00Z'}),
      run({head_sha:'other',updated_at:'2026-09-05T09:00:00Z'}),
    ],'abc');
    expect(gate).toEqual(expect.objectContaining({allowed:true,status:'open',conclusion:'success',commitSha:'abc'}));
  });

  test.each([['failed validation',[run({conclusion:'failure'})],'failure'],['missing validation',[],'missing']])('blocks %s while preserving queue progress wording',(_label,runs,conclusion)=>{
    const gate=evaluatePublicationGate(runs,'abc');
    expect(gate).toEqual(expect.objectContaining({allowed:false,status:'blocked',conclusion}));
    expect(gate.message).toMatch(/Queue and agent work may continue; approvals stay saved/);
  });

  test('uses the named Validate ORMA workflow for the current commit',()=>{
    expect(apiUrl({GITHUB_REPOSITORY:'lorenzib/ORMA',GITHUB_SHA:'abc'})).toBe('https://api.github.com/repos/lorenzib/ORMA/actions/workflows/validate.yml/runs?head_sha=abc&status=completed&per_page=10');
  });

  test('CLI fails closed and emits GitHub outputs when the lookup is unavailable',async()=>{
    const directory=await fs.mkdtemp(path.join(os.tmpdir(),'orma-publication-gate-'));const output=path.join(directory,'output');
    const gate=await main({env:{GITHUB_REPOSITORY:'lorenzib/ORMA',GITHUB_SHA:'abc',GH_TOKEN:'token',GITHUB_OUTPUT:output},fetch:async()=>{throw new Error('network unavailable');}});
    const written=await fs.readFile(output,'utf8');
    expect(gate.allowed).toBe(false);
    expect(written).toContain('publication_allowed=false');
    expect(written).toContain('validation health could not be checked');
  });
});
