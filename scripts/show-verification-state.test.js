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
