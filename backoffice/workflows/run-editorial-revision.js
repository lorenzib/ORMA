'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { validateContentExecution } = require('../contracts/content-result-v1');

const schemaPath = path.resolve(__dirname, '..', 'contracts', 'editorial-revision-output.schema.json');
const unsafeMarkup = /<script\b|javascript:|\son\w+\s*=/i;

function occurrences(haystack, needle){
  if(!needle) return 0;
  let count = 0; let from = 0;
  while((from = haystack.indexOf(needle, from)) !== -1){ count += 1; from += needle.length; }
  return count;
}

function outerTag(value){
  return String(value || '').trim().match(/^<([a-z][a-z0-9-]*)\b/i)?.[1]?.toLowerCase() || null;
}

function validateRevisionResult(result, sourceHtml){
  if(!result || typeof result !== 'object' || !Array.isArray(result.changes) || !result.changes.length){
    throw new Error('The revision agent returned no reviewable copy changes');
  }
  for(const change of result.changes){
    if(!change.before || occurrences(sourceHtml, change.before) !== 1){
      throw new Error(`Revision target is not unique in the current page: ${change.section || 'unnamed section'}`);
    }
    if(!change.after || unsafeMarkup.test(change.after)) throw new Error(`Revision contains unsafe markup: ${change.section || 'unnamed section'}`);
    const beforeTag = outerTag(change.before); const afterTag = outerTag(change.after);
    if(beforeTag && afterTag !== beforeTag) throw new Error(`Revision changed the content block type: ${change.section || 'unnamed section'}`);
  }
  return result;
}

function revisionPrompt(execution, note, sourceHtml){
  const currentCopy = (execution.outputs || []).find(output => output.agentId === 'copywriter')?.result || null;
  const governanceRule=execution.subject?.type==='page'
    ? 'This is a governance page. Do not weaken, expand or invent privacy, legal, safety or operational commitments; flag any uncertainty instead.'
    : null;
  return [
    'You are the ORMA editorial revision agent. Return only the structured response required by the supplied JSON schema.',
    `The editor requested this revision: ${JSON.stringify(note)}`,
    `Page: ${execution.subject.sourceRef}`,
    'Revise the recommendation promptly and literally follow the editor note.',
    'Each change.before must be an exact, complete, unique substring copied from CURRENT_SOURCE_HTML.',
    'Each change.after must retain the same outer HTML tag and must be ready to replace before directly.',
    'Keep the change set small. Do not rewrite unrelated copy. Do not use em dashes or double hyphens as sentence punctuation.',
    'Use current, authoritative sources when a factual or safety claim changes. Otherwise preserve the relevant existing sources.',
    governanceRule,
    `PREVIOUS_RECOMMENDATION_JSON:\n${JSON.stringify(currentCopy, null, 2)}`,
    `CURRENT_SOURCE_HTML:\n${sourceHtml}`,
  ].filter(Boolean).join('\n\n');
}

function codexBinary(){
  if(process.env.ORMA_CODEX_BIN) return process.env.ORMA_CODEX_BIN;
  const bundled = '/Applications/ChatGPT.app/Contents/Resources/codex';
  return fs.existsSync(bundled) ? bundled : 'codex';
}

function runCodex(prompt, options = {}){
  return new Promise((resolve, reject) => {
    const args = ['exec', '--ephemeral', '--sandbox', 'read-only',
      '--ignore-user-config', '--ignore-rules', '--output-schema', schemaPath, '-'];
    const child = spawn(options.binary || codexBinary(), args, { cwd: options.root, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let settled = false;
    const finish = (error, value) => { if(settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
    const timer = setTimeout(() => { child.kill('SIGTERM'); finish(new Error('The revision agent took longer than four minutes')); }, options.timeoutMs || 240000);
    child.stdout.on('data', chunk => { stdout += chunk; if(stdout.length > 1024 * 1024) child.kill('SIGTERM'); });
    child.stderr.on('data', chunk => { stderr += chunk; if(stderr.length > 1024 * 1024) stderr = stderr.slice(-1024 * 1024); });
    child.on('error', error => finish(new Error(`Could not start the revision agent: ${error.message}`)));
    child.on('close', code => {
      if(code !== 0) return finish(new Error(`Revision agent failed${stderr.trim() ? `: ${stderr.trim().split('\n').slice(-3).join(' ')}` : ''}`));
      try { finish(null, { data: JSON.parse(stdout.trim()), model: 'codex', responseId: null }); }
      catch(error){ finish(new Error(`Revision agent returned invalid structured output: ${error.message}`)); }
    });
    child.stdin.end(prompt);
  });
}

function chainPreviousAnchors(changes, execution){
  const previous = (execution.outputs || []).find(output => output.agentId === 'copywriter')?.result?.changes || [];
  return changes.map(change => {
    const related = previous.find(item => item.after === change.before || item.before === change.before);
    if(!related) return change;
    const alternatives = [...new Set([related.before, ...(related.beforeAlternatives || [])].filter(value => value && value !== change.before))];
    return alternatives.length ? { ...change, beforeAlternatives: alternatives } : change;
  });
}

async function runEditorialRevision(root, execution, note, options = {}){
  if(!execution?.subject?.sourceRef) throw new Error('The editorial packet has no source page');
  const sourcePath = path.resolve(root, execution.subject.sourceRef);
  if(sourcePath !== root && !sourcePath.startsWith(`${root}${path.sep}`)) throw new Error('Editorial source is outside the project');
  const sourceHtml = await fs.promises.readFile(sourcePath, 'utf8');
  const runAgent = options.runAgent || ((prompt) => runCodex(prompt, { root, ...options }));
  const response = await runAgent(revisionPrompt(execution, note, sourceHtml));
  const result = validateRevisionResult(response.data, sourceHtml);
  result.changes = chainPreviousAnchors(result.changes, execution);
  const generatedAt = options.at || new Date().toISOString();
  const suffix = generatedAt.replace(/[:.]/g, '-');
  const outputs = (execution.outputs || []).map(output => output.agentId === 'copywriter' ? {
    ...output, jobId: `${execution.subject.type}-${execution.subject.id}-copy-revision-${suffix}`, status: 'ready-for-review',
    responseId: response.responseId || null, model: response.model || 'codex', result, error: null,
    revision: { requestedAt: generatedAt, instruction: note },
  } : {
    ...output, jobId: `${output.jobId}-revision-${suffix}`,
    revision: { requestedAt: generatedAt, instruction: note, resolution: 'Existing picture recommendation retained for editorial revision.' },
  });
  const revised = {
    ...execution, generatedAt, selectionReason: 'revision-requested',
    subject: { ...execution.subject, updatedAt: generatedAt }, outputs,
    summary: { readyForReview: outputs.filter(output => output.status === 'ready-for-review').length, blocked: outputs.filter(output => output.status === 'blocked').length },
  };
  const errors = validateContentExecution(revised);
  if(errors.length) throw new Error(errors.join('; '));
  return revised;
}

module.exports = { occurrences, validateRevisionResult, revisionPrompt, chainPreviousAnchors, runCodex, runEditorialRevision };
