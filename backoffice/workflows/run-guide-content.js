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

const PICTURE_SCHEMA={
  type:'object',additionalProperties:false,
  properties:{
    searchSummary:{type:'string'},
    candidates:{type:'array',items:{type:'object',additionalProperties:false,properties:{
      title:{type:'string'},sourcePageUrl:{type:'string'},assetUrl:{type:'string'},creator:{type:'string'},
      license:{type:'string'},licenseUrl:{type:'string'},credit:{type:'string'},matchEvidence:{type:'string'},
      altText:{type:'string'},status:{type:'string',enum:['ready','blocked']},
    },required:['title','sourcePageUrl','assetUrl','creator','license','licenseUrl','credit','matchEvidence','altText','status']}},
    coverageGaps:{type:'array',items:{type:'string'}},
  },required:['searchSummary','candidates','coverageGaps'],
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

async function runEditorialSource(root, subject, options = {}){
  const { at, id, type, sourceRef, updatedAt, original } = subject;
  const runAgent = options.runAgent || (process.env.OPENAI_API_KEY?createStructuredResponse:(input,clientOptions)=>createCodexStructuredResponse(input,{root,...clientOptions}));
  const isGovernancePage = type === 'page';
  const shared = `${isGovernancePage?'Page':'Guide'} ID: ${id}\nSource: ${sourceRef}\nLast repository modification: ${updatedAt}\nCurrent source HTML:\n${original.slice(0, 60000)}`;
  const datedReviewInstruction = isGovernancePage
    ? 'Preserve the visible Last updated date unless the proposed copy materially changes the policy or terms. Flag any legal, operational or implementation uncertainty in openQuestions instead of inventing a commitment.'
    : `When the factual review is complete, update or add a visible "Last reviewed: ${new Date(at).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'})}" line near the end.`;
  const tasks = [
    {
      jobId: `${type}-${id}-edit`, agentId: 'copywriter', schemaName: isGovernancePage?'orma_governance_page_edit':'orma_guide_edit', schema: EDIT_SCHEMA,
      prompt: [
        isGovernancePage
          ? `Review this ORMA governance page as of ${at.slice(0,10)}. Improve clarity and consistency without weakening, expanding or inventing privacy, legal, safety or operational commitments. Use dated authoritative sources for any externally verifiable current claim.`
          : `Edit this ORMA dog-hiking guide as of ${at.slice(0,10)}. Preserve safety uncertainty and use dated authoritative sources for current claims.`,
        'This is a COPY review only. Do not propose layouts, design changes, images or image placement.',
        'Every changes[].before value must be one exact, unique, verbatim HTML block copied from Current source HTML. Its changes[].after value must be the complete replacement HTML block. Never use plain text as an anchor when the source contains markup.',
        datedReviewInstruction,
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
    subject: { type, id, sourceRef, updatedAt, original },
    outputs,
    summary: { readyForReview: outputs.filter(output => output.status === 'ready-for-review').length, blocked: outputs.filter(output => output.status === 'blocked').length },
  };
  const errors = validateContentExecution(execution);
  if(errors.length) throw new Error(errors.join('; '));
  return execution;
}

async function runGuideContent(root, options = {}){
  const at = options.at || new Date().toISOString();
  const inventory = await guideInventory(root);
  const guide = options.guideId ? inventory.find(item => item.id === options.guideId)
    : inventory.slice().sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))[0];
  if(!guide) throw new Error(`Guide not found: ${options.guideId || 'no guides available'}`);
  const original = await fs.readFile(guide.file, 'utf8');
  return runEditorialSource(root, {
    at, id:guide.id, type:'guide', sourceRef:path.relative(root,guide.file), updatedAt:guide.updatedAt, original,
  }, options);
}

async function runPageContent(root, options = {}){
  const at = options.at || new Date().toISOString();
  const pageId = options.pageId;
  const sourceRef = options.sourceRef || `${pageId}.html`;
  if(!pageId) throw new Error('pageId is required');
  const resolvedRoot=path.resolve(root);const file = path.resolve(resolvedRoot, sourceRef);
  if(file === resolvedRoot || !file.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error('Page source is outside the project');
  const [original, stat] = await Promise.all([fs.readFile(file,'utf8'),fs.stat(file)]);
  return runEditorialSource(root, {
    at, id:pageId, type:'page', sourceRef:path.relative(root,file), updatedAt:stat.mtime.toISOString(), original,
  }, options);
}

module.exports = { EDIT_SCHEMA, PICTURE_SCHEMA, visibleText, guideInventory, runEditorialSource, runGuideContent, runPageContent };
