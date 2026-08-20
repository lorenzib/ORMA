'use strict';

const fs = require('fs/promises');
const path = require('path');
const { createStructuredResponse } = require('../services/openai-responses-client');
const { createCodexStructuredResponse } = require('../services/codex-structured-client');
const { validateContentExecution } = require('../contracts/content-result-v1');

const EDIT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    title: { type: 'string' }, summary: { type: 'string' },
    changes: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      section: { type: 'string' }, before: { type: 'string' }, after: { type: 'string' }, reason: { type: 'string' },
    }, required: ['section', 'before', 'after', 'reason'] } },
    sources: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      label: { type: 'string' }, url: { type: 'string' }, checkedAt: { type: 'string' }, supports: { type: 'string' },
    }, required: ['label', 'url', 'checkedAt', 'supports'] } },
    openQuestions: { type: 'array', items: { type: 'string' } },
  }, required: ['title', 'summary', 'changes', 'sources', 'openQuestions'],
};

function visibleText(html){
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim().slice(0, 24000);
}

async function guideInventory(root){
  const directory = path.join(root, 'guides');
  const names = (await fs.readdir(directory)).filter(name => name.endsWith('.html')).sort();
  return Promise.all(names.map(async name => {
    const file = path.join(directory, name); const stat = await fs.stat(file);
    return { id: name.replace(/\.html$/, ''), file, updatedAt: stat.mtime.toISOString() };
  }));
}

async function runGuideContent(root, options = {}){
  const at = options.at || new Date().toISOString();
  const inventory = await guideInventory(root);
  const guide = options.guideId ? inventory.find(item => item.id === options.guideId)
    : inventory.slice().sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))[0];
  if(!guide) throw new Error(`Guide not found: ${options.guideId || 'no guides available'}`);
  const original = await fs.readFile(guide.file, 'utf8');
  const runAgent = options.runAgent || (process.env.OPENAI_API_KEY?createStructuredResponse:(input,clientOptions)=>createCodexStructuredResponse(input,{root,...clientOptions}));
  const shared = `Guide ID: ${guide.id}\nLast repository modification: ${guide.updatedAt}\nCurrent source HTML:\n${original.slice(0, 60000)}`;
  const tasks = [
    {
      jobId: `guide-${guide.id}-edit`, agentId: 'copywriter', schemaName: 'orma_guide_edit', schema: EDIT_SCHEMA,
      prompt: [
        `Edit this ORMA dog-hiking guide as of ${at.slice(0,10)}. Preserve safety uncertainty and use dated authoritative sources for current claims.`,
        'This is a COPY review only. Do not propose layouts, design changes, images or image placement.',
        'Every changes[].before value must be one exact, unique, verbatim HTML block copied from Current source HTML. Its changes[].after value must be the complete replacement HTML block. Never use plain text as an anchor when the source contains markup.',
        `When the factual review is complete, update or add a visible "Last reviewed: ${new Date(at).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})}" line near the end.`,
        'Do not use em dashes or double hyphens as sentence punctuation. Write in a natural human-edited voice. Propose reviewable changes only.',
      ].join('\n'),
    },
  ];
  const outputs = await Promise.all(tasks.map(async task => {
    try{
      const response = await runAgent({
        schemaName: task.schemaName, schema: task.schema, webSearch: true,
        messages: [{ role: 'developer', content: task.prompt }, { role: 'user', content: shared }],
      }, options.clientOptions || {});
      return { jobId: task.jobId, agentId: task.agentId, status: 'ready-for-review', responseId: response.responseId, model: response.model, result: response.data, error: null };
    }catch(error){
      return { jobId: task.jobId, agentId: task.agentId, status: 'blocked', responseId: null, model: null, result: null, error: error.message };
    }
  }));
  const execution = {
    contractVersion: '1.0.0', generatedAt: at, mode: 'draft-only', publicMutationAllowed: false,
    subject: { type: 'guide', id: guide.id, sourceRef: path.relative(root, guide.file), updatedAt: guide.updatedAt, original },
    outputs,
    summary: { readyForReview: outputs.filter(output => output.status === 'ready-for-review').length, blocked: outputs.filter(output => output.status === 'blocked').length },
  };
  const errors = validateContentExecution(execution);
  if(errors.length) throw new Error(errors.join('; '));
  return execution;
}

module.exports = { EDIT_SCHEMA, visibleText, guideInventory, runGuideContent };
