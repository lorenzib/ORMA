const fs=require('fs');
const client=fs.readFileSync('backoffice-firebase.js','utf8');

// Six "Needs work" decisions never reached Firestore, and the desk could only
// say "Could not save: dossier-review-submit-failed" -- the name of the call
// that failed, which is the one thing already known. Whether the moderator was
// signed out, offline, or refused by the rules was in the caught error and
// thrown away, so diagnosing it meant asking someone to read a console.
function writeFailure(){
  const start=client.indexOf('function writeFailure(scope,error){');
  const end=client.indexOf('\n}',start)+2;
  expect(start).toBeGreaterThan(-1);
  return new Function(`${client.slice(start,end)}\nreturn writeFailure;`)();
}

describe('a failed decision says why', () => {
  let fail;
  beforeEach(()=>{fail=writeFailure();});

  test('a rules refusal names itself', () => {
    const result=fail('dossier-review-submit-failed',
      Object.assign(new Error('Missing or insufficient permissions.'),{code:'permission-denied'}));
    expect(result.ok).toBe(false);
    expect(result.error).toBe('dossier-review-submit-failed: permission-denied');
    expect(result.code).toBe('permission-denied');
  });

  test('being offline names itself too', () => {
    expect(fail('dossier-review-submit-failed',
      Object.assign(new Error('Failed to get document'),{code:'unavailable'})).error)
      .toBe('dossier-review-submit-failed: unavailable');
  });

  test('an error with no code falls back to its message', () => {
    expect(fail('review-submit-failed',new Error('Network  request   failed')).error)
      .toBe('review-submit-failed: Network request failed');
  });

  test('an empty failure still says which call it was', () => {
    expect(fail('review-submit-failed',undefined).error).toBe('review-submit-failed');
  });

  test('a long message is bounded', () => {
    expect(fail('x',new Error('e'.repeat(500))).detail.length).toBe(200);
  });
});

describe('every moderator write reports its reason', () => {
  test('no submit swallows its error any more', () => {
    // Only the caught-error pattern. A precondition like 'moderator-required'
    // already says what is wrong and is not a swallowed failure.
    const silent=client.match(/catch\(error\)\{[^}]*return \{ok:false,error:'[a-z-]+'\};\}/g)||[];
    expect(silent).toEqual([]);
  });

  test('the decision path a moderator uses is one of them', () => {
    expect(client).toContain("return writeFailure('dossier-review-submit-failed',error);");
  });
});
