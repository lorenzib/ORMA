const fs=require('fs');

// A squash merge makes a new commit. The validate run that passed on the
// snapshot pull request was for the branch head, a sha that no longer exists,
// and a push made with the workflow token starts no runs of its own -- so main
// carried no completed validation and evaluatePublicationGate paused every
// backoffice pass. e525e791 sat unvalidated for eleven hours on 2026-09-14.
const watch=fs.readFileSync('.github/workflows/orma-hazard-watch.yml','utf8');
const validate=fs.readFileSync('.github/workflows/validate.yml','utf8');
const {evaluatePublicationGate}=require('./workflows/publication-gate.js');

describe('the snapshot commit gets validated like anyone else’s', () => {
  test('validation is dispatched as soon as the snapshot merges', () => {
    const merged=watch.slice(watch.lastIndexOf('= "MERGED"'));
    expect(merged).toContain('gh workflow run validate.yml --ref main');
  });

  test('a run that ended before dispatching is caught up on the next pass', () => {
    expect(watch).toContain('for workflow in validate.yml deploy-pages.yml; do');
    // Idempotent: it dispatches only where main has no run for that commit.
    expect(watch).toContain("--json headSha --jq '.[].headSha' | grep -qx \"$head\"");
  });

  test('validate can be dispatched at all, which is what this relies on', () => {
    expect(validate).toContain('workflow_dispatch');
  });
});

// The gate these dispatches exist to satisfy.
describe('what the gate asks for', () => {
  const run=(sha,conclusion)=>({status:'completed',conclusion,head_sha:sha,
    html_url:'https://example.org/run',updated_at:'2026-09-14T05:00:00Z'});

  test('a passing run for this exact commit opens it', () => {
    expect(evaluatePublicationGate([run('abc','success')],'abc').allowed).toBe(true);
  });

  test('a passing run for a different commit does not', () => {
    // This is the bug: the pull request passed, the merge commit is another sha.
    const gate=evaluatePublicationGate([run('branch-head','success')],'merge-commit');
    expect(gate.allowed).toBe(false);
    expect(gate.message).toContain('no completed result for commit merge-commit');
  });

  test('a failing run pauses and says so', () => {
    expect(evaluatePublicationGate([run('abc','failure')],'abc').message)
      .toContain('concluded failure');
  });

  test('a pause never claims work was lost', () => {
    expect(evaluatePublicationGate([],'abc').message)
      .toContain('Queue and agent work may continue; approvals stay saved');
  });
});
