'use strict';

const {evaluatePublicationGate,inFlight}=require('./backoffice/workflows/publication-gate');
const {apiUrl,main}=require('./backoffice/cli/check-publication-gate');

const SHA='fd8037ee9c1a4b2d8e5f0a3c7b6d9e2f1a4c8b70';
const run=(overrides={})=>({status:'completed',conclusion:'success',head_sha:SHA,
  html_url:'https://github.com/lorenzib/ORMA/actions/runs/1',created_at:'2026-10-02T11:42:12Z',
  updated_at:'2026-10-02T11:43:45Z',...overrides});

describe('a validation run still going is a wait, not a fault',()=>{
  test('the 2 October race: checked 31 seconds after the push, mid-validation',()=>{
    // The worker runs on a schedule and landed inside the ~90s validation window.
    // Before this, publication reported "blocked · missing" and the desk showed
    // an alarm for something that passed a minute later on its own.
    const gate=evaluatePublicationGate([run({status:'in_progress',conclusion:null})],SHA);
    expect(gate).toEqual(expect.objectContaining({allowed:false,pending:true,status:'pending'}));
    expect(gate.message).toContain('still running');
    expect(gate.message).toContain('Nothing is wrong');
    // Publication is still withheld: nobody knows yet whether the commit is good.
    expect(gate.allowed).toBe(false);
    expect(gate.validationRunUrl).toBe('https://github.com/lorenzib/ORMA/actions/runs/1');
  });

  test('a queued run counts as in flight too',()=>{
    expect(evaluatePublicationGate([run({status:'queued',conclusion:null})],SHA).pending).toBe(true);
  });

  test('no run at all is still blocked, because nothing is coming',()=>{
    const gate=evaluatePublicationGate([],SHA);
    expect(gate).toEqual(expect.objectContaining({allowed:false,pending:false,status:'blocked',conclusion:'missing'}));
  });

  test('a failed run is blocked and never reads as pending',()=>{
    const gate=evaluatePublicationGate([run({conclusion:'failure'})],SHA);
    expect(gate).toEqual(expect.objectContaining({allowed:false,pending:false,status:'blocked',conclusion:'failure'}));
  });

  test('a completed success outranks a later in-flight rerun',()=>{
    // Validation that has already passed for this commit is an answer; a rerun
    // beside it must not withdraw it.
    const gate=evaluatePublicationGate([run(),run({status:'in_progress',conclusion:null})],SHA);
    expect(gate).toEqual(expect.objectContaining({allowed:true,pending:false,status:'open'}));
  });

  test('runs for another commit are ignored in both directions',()=>{
    const other={...run({status:'in_progress',conclusion:null}),head_sha:'0'.repeat(40)};
    expect(inFlight([other],SHA)).toBeNull();
    expect(evaluatePublicationGate([other],SHA).status).toBe('blocked');
  });
});

describe('the lookup has to be able to see an unfinished run',()=>{
  test('the API query no longer filters to completed runs',()=>{
    const url=apiUrl({GITHUB_REPOSITORY:'lorenzib/ORMA',GITHUB_SHA:SHA});
    // With status=completed in the query an in-flight run never comes back, so
    // the evaluator above could never have distinguished the two cases.
    expect(url).not.toContain('status=completed');
    expect(url).toContain(`head_sha=${SHA}`);
  });

  test('the CLI publishes the pending flag the workflow branches on',async()=>{
    const fs=require('fs');const os=require('os');const path=require('path');
    const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'orma-gate-')),'out.txt');
    const fetchStub=async()=>({ok:true,json:async()=>({workflow_runs:[run({status:'in_progress',conclusion:null})]})});
    const gate=await main({env:{GITHUB_REPOSITORY:'lorenzib/ORMA',GITHUB_SHA:SHA,GITHUB_TOKEN:'t',GITHUB_OUTPUT:file},fetch:fetchStub});
    expect(gate.pending).toBe(true);
    const written=fs.readFileSync(file,'utf8');
    expect(written).toContain('publication_allowed=false');
    expect(written).toContain('publication_pending=true');
  });
});
