const fs=require('fs');
const source=fs.readFileSync('./trail-verify-desk.js','utf8');

// The desk sent a revision to whichever specialist output happened to be first.
// Six trails sit at the dossier gate blocked entirely on logistics route
// guidance; handing those to terrainPoi returns the same dossier and costs a
// model call to learn nothing.
function agentFromBlockers(){
  const start=source.indexOf('  function agentFromBlockers(reasons){');
  const end=source.indexOf('  function groupBlockers(reasons){');
  expect(start).toBeGreaterThan(-1);
  return new Function(`${source.slice(start,end)}\nreturn agentFromBlockers;`)();
}

const ROUTE_GUIDANCE=id=>`logistics/${id}: supported authoritative route guidance is required`;

describe('a revision goes to the agent its blockers name', () => {
  let pick;
  beforeEach(()=>{pick=agentFromBlockers();});

  test('the six dossier-gate trails ask logistics', () => {
    expect(pick(['recommended-start','route-number-status','route-number-sequence','route-number-switches']
      .map(ROUTE_GUIDANCE))).toBe('logistics');
  });

  test('an agent named without a slash is read too', () => {
    expect(pick(['logistics: open question — is the parking usable?',
      'logistics: recommendation is needs-resolution'])).toBe('logistics');
  });

  test('a terrain problem asks terrainPoi', () => {
    expect(pick(['terrainPoi/livestock: five automated resolution strategies exhausted',
      'terrainPoi/shade: conflicted'])).toBe('terrainPoi');
  });

  // Two agents disagreeing is not one agent's revision to make.
  test('blockers spanning agents fall back rather than guess', () => {
    expect(pick([ROUTE_GUIDANCE('recommended-start'),'terrainPoi/shade: conflicted'])).toBeNull();
  });

  test('anything it cannot read falls back rather than guess', () => {
    expect(pick(['not-closed-loop'])).toBeNull();
    expect(pick([])).toBeNull();
    expect(pick(undefined)).toBeNull();
    expect(pick([ROUTE_GUIDANCE('recommended-start'),'not-closed-loop'])).toBeNull();
  });
});

describe('the fallback is still there', () => {
  test('it only overrides the first output when the blockers agree', () => {
    expect(source).toContain("agentFromBlockers(item.blockingReasons)||(item.specialistOutputs||[])[0]?.agentId||'auditor'");
  });

  test('both the decision and its submit use the same target', () => {
    const uses=source.split('agentFromBlockers(item.blockingReasons)').length-1;
    expect(uses).toBe(2);
  });
});
