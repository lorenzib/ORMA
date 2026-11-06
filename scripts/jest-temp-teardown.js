'use strict';

// Removes the run's temporary folder that jest-temp-setup.js made.
const fs = require('fs');

module.exports = async () => {
  const run = process.env.ORMA_JEST_TMPDIR;
  if (run && /orma-jest-[^/\\]+$/.test(run)) fs.rmSync(run, { recursive: true, force: true });
};
