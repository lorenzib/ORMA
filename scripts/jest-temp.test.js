'use strict';

const os = require('os');
const path = require('path');

// jest-temp-setup.js gives every run its own temporary folder, which the
// teardown removes, so nothing a test writes to os.tmpdir() outlives the run.
test('tests write temporary files into the run\'s own folder', () => {
  expect(process.env.ORMA_JEST_TMPDIR).toMatch(/orma-jest-[^/\\]+$/);
  expect(os.tmpdir()).toBe(process.env.ORMA_JEST_TMPDIR);
  expect(path.basename(path.dirname(os.tmpdir()))).not.toMatch(/^orma-jest-/);
});
