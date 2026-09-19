'use strict';

// Everything a build writes, which nothing should read back as source.
//
// Three walkers kept their own copy of this list and all three differed. The
// i18n audit read dist/ while another suite was rebuilding it, so the full run
// failed roughly one time in twelve on a path that had vanished between being
// collected and being read (#476). This list is the other half of the same
// story: match-vocabulary.test.js named node_modules, dist, coverage and three
// more, but not _site, so the entire suite failed locally for anyone who had
// built the site -- it found the published copy of match-verdict.js and
// reported the file as a second place the verdicts were spelled out.
//
// A list each caller maintains separately goes stale the moment somebody adds
// a build directory, and it goes stale silently.
const GENERATED_DIRECTORIES = Object.freeze([
  '.git', 'node_modules', '_site', 'dist', 'coverage', '.cache', '.firebase',
]);

/** Is this entry name a directory some build writes? */
function isGeneratedDirectory(name){
  return GENERATED_DIRECTORIES.includes(name);
}

/**
 * The generated directories as an alternation for a path-prefix test, with
 * every character that means something to a regular expression escaped. '.git'
 * without that is a dot matching any character.
 */
function generatedDirectoryPattern(){
  return GENERATED_DIRECTORIES
    .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
}

module.exports = { GENERATED_DIRECTORIES, isGeneratedDirectory, generatedDirectoryPattern };
