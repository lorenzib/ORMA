'use strict';

const fs=require('fs');
const path=require('path');
const {parseArgs,SECTIONS,WORKFLOW}=require('./show-verification-state');

// Every backoffice report needs the Firestore service account, which lives in
// GitHub Actions and nowhere else, so running one on a laptop fails with
// "Could not load the default credentials" and says nothing about trails.
// This runs the report where the credentials already are.
describe('reading the verification state from a laptop',()=>{
  test('defaults to the report that answers "how close is anything"',()=>{
    expect(parseArgs([])).toEqual({section:'closest',trail:null});
    expect(SECTIONS.closest).toBe('closest');
  });

  test('a trail and a section can be named',()=>{
    expect(parseArgs(['--trail=osm-19153189','--section=yield']))
      .toEqual({section:'yield',trail:'osm-19153189'});
    expect(parseArgs(['--all']).section).toBe('all');
  });

  test('it dispatches the read-only workflow that exists',()=>{
    expect(WORKFLOW).toBe('orma-verification-state.yml');
    expect(fs.existsSync(path.join(__dirname,'..','.github/workflows',WORKFLOW))).toBe(true);
  });

  test('every section names a report the workflow actually runs',()=>{
    const workflow=fs.readFileSync(path.join(__dirname,'..','.github/workflows',WORKFLOW),'utf8');
    // The workflow runs these CLIs; each tags its lines with the prefix above.
    for(const command of ['backoffice:closest','backoffice:resolution-yield',
      'backoffice:verification-funnel','backoffice:verification-state','backoffice:gate-evidence','backoffice:gate-dryrun']){
      expect(workflow).toContain(command);
    }
    expect(Object.keys(SECTIONS)).toEqual(['closest','yield','funnel','state','evidence','gate','progress']);
  });

  test('it is registered under a name that is short enough to remember',()=>{
    const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'..','package.json'),'utf8'));
    expect(manifest.scripts['backoffice:state']).toBe('node scripts/show-verification-state.js');
  });
});

// A step that names the credentials again can name them wrongly. The gate
// dry-run did: it wrote FIREBASE_SERVICE_ACCOUNT_JSON where the secret is
// FIREBASE_SERVICE_ACCOUNT, so a step-level override replaced the job's
// working value with an empty one and the run failed on "Could not load the
// default credentials" -- in a workflow whose every other step simply inherits
// them.
describe('no step re-declares the credentials the job already provides',()=>{
  const yaml=require('js-yaml');
  const fs=require('fs');
  const path=require('path');

  test('the reports inherit the job credentials rather than naming their own',()=>{
    const file=path.join(__dirname,'..','.github/workflows',WORKFLOW);
    const job=Object.values(yaml.load(fs.readFileSync(file,'utf8')).jobs)[0];
    expect(Object.keys(job.env)).toEqual(expect.arrayContaining(
      ['FIREBASE_PROJECT_ID','FIREBASE_SERVICE_ACCOUNT_JSON']));
    const offenders=(job.steps||[])
      .filter(step=>step.env&&Object.keys(step.env).some(key=>key.startsWith('FIREBASE_')))
      .map(step=>step.name);
    expect(offenders).toEqual([]);
  });
});
