'use strict';

// Many tests build into os.tmpdir() and never remove what they made; the site
// build test alone left a 570 MB copy of the website on every run, and 268 of
// them had filled 77 GB of a laptop before anyone noticed. Rather than trust
// every test to clean up, each run gets its own temporary folder, and
// jest-temp-teardown.js removes it when the run ends. os.tmpdir() reads TMPDIR
// on every call, and the test workers and the scripts they spawn inherit it.
const fs = require('fs');
const os = require('os');
const path = require('path');

const PREFIX = 'orma-jest-';
const STALE_MS = 6 * 60 * 60 * 1000;

module.exports = async () => {
  const base = os.tmpdir();
  // A run that crashed never reached its teardown; clear what it left.
  for (const name of fs.readdirSync(base)) {
    if (!name.startsWith(PREFIX)) continue;
    const dir = path.join(base, name);
    try {
      if (Date.now() - fs.statSync(dir).mtimeMs > STALE_MS) fs.rmSync(dir, { recursive: true, force: true });
    } catch (error) {}
  }
  const run = fs.mkdtempSync(path.join(base, PREFIX));
  process.env.ORMA_JEST_TMPDIR = run;
  process.env.TMPDIR = run;
  process.env.TMP = run;
  process.env.TEMP = run;
};
