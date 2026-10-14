'use strict';

// The quality gate has to run where the work is done.
//
// AGENTS.md requires feature work in a git worktree and requires
// `npm run quality:gate` before asking to merge. A worktree has no
// node_modules of its own -- Node finds jest by walking up to the parent
// repository -- so the runner's hardcoded `ROOT/node_modules/jest/bin/jest.js`
// did not exist there, and the gate died with a bare MODULE_NOT_FOUND. The two
// standards could not both be met without a hand-made symlink in every new
// worktree.

const fs = require('fs');
const path = require('path');
const { jestBinary } = require('./scripts/run-firestore-rules-tests.cjs');

describe('finding jest from wherever the gate is run', () => {
  test('it resolves to a file that is actually there', () => {
    const resolved = jestBinary();
    expect(path.isAbsolute(resolved)).toBe(true);
    expect(fs.existsSync(resolved)).toBe(true);
    expect(resolved.endsWith(path.join('jest', 'bin', 'jest.js'))).toBe(true);
  });

  test('it does not assume node_modules sits beside the script', () => {
    // The regression this exists for: a path built from the repo root rather
    // than resolved is correct in a plain checkout and wrong in a worktree,
    // and nothing fails until someone runs the gate from one.
    const source = fs.readFileSync(
      path.join(__dirname, 'scripts', 'run-firestore-rules-tests.cjs'), 'utf8');
    expect(source).not.toMatch(/ROOT,\s*'node_modules'/);
    expect(source).toContain("require.resolve('jest/package.json')");
  });
});

// Not asserted here: that resolving `jest/bin/jest.js` directly throws
// ERR_PACKAGE_PATH_NOT_EXPORTED, which is why the manifest is resolved
// instead. Inside jest, `require.resolve` is jest's own resolver and reports a
// different error than Node's, so a test for it would be checking the test
// runner rather than the thing the script does. The reason is recorded where
// the code is.
