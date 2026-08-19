'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { createStructuredResponse } = require('../services/openai-responses-client');

const PRODUCT_IDEAS_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    executiveSummary: { type: 'string' },
    ideas: { type: 'array', minItems: 3, maxItems: 8, items: {
      type: 'object', additionalProperties: false,
      properties: {
        id: { type: 'string' },
        category: { type: 'string', enum: ['competitor-signal', 'feature', 'ui', 'editorial-gap'] },
        title: { type: 'string' }, signal: { type: 'string' }, ormaOpportunity: { type: 'string' },
        whyNow: { type: 'string' }, impact: { type: 'string', enum: ['high', 'medium', 'low'] },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        suggestedInvestigation: { type: 'array', items: { type: 'string' } },
        sources: { type: 'array', minItems: 1, items: {
          type: 'object', additionalProperties: false,
          properties: { label: { type: 'string' }, url: { type: 'string' }, checkedAt: { type: 'string' }, supports: { type: 'string' } },
          required: ['label', 'url', 'checkedAt', 'supports'],
        } },
      },
      required: ['id', 'category', 'title', 'signal', 'ormaOpportunity', 'whyNow', 'impact', 'confidence', 'suggestedInvestigation', 'sources'],
    } },
  },
  required: ['executiveSummary', 'ideas'],
};

const FOCUSED_INVESTIGATION_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    conclusion: { type: 'string' },
    findings: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      competitor: { type: 'string' }, finding: { type: 'string' }, implicationForOrma: { type: 'string' },
    }, required: ['competitor', 'finding', 'implicationForOrma'] } },
    recommendation: { type: 'string', enum: ['prioritise', 'prototype', 'monitor', 'do-not-pursue'] },
    nextQuestions: { type: 'array', items: { type: 'string' } },
    sources: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      label: { type: 'string' }, url: { type: 'string' }, checkedAt: { type: 'string' }, supports: { type: 'string' },
    }, required: ['label', 'url', 'checkedAt', 'supports'] } },
  },
  required: ['conclusion', 'findings', 'recommendation', 'nextQuestions', 'sources'],
};

function codexBinary(){
  if(process.env.ORMA_CODEX_BIN) return process.env.ORMA_CODEX_BIN;
  const bundled = '/Applications/ChatGPT.app/Contents/Resources/codex';
  return fs.existsSync(bundled) ? bundled : 'codex';
}

function createCodexStructuredResponse(input, options = {}){
  return new Promise((resolve, reject) => {
    const schemaPath = input.schemaName === 'orma_product_investigation'
      ? path.resolve(__dirname, '..', 'contracts', 'product-investigation-output.schema.json')
      : path.resolve(__dirname, '..', 'contracts', 'product-ideas-output.schema.json');
    const args = ['exec', '--ephemeral', '--sandbox', 'read-only', '--ignore-user-config', '--ignore-rules', '--output-schema', schemaPath, '-'];
    const child = spawn(options.binary || codexBinary(), args, { cwd: options.root || path.resolve(__dirname, '..', '..'), stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let settled = false;
    const finish = (error, value) => { if(settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
    const timer = setTimeout(() => { child.kill('SIGTERM'); finish(new Error('Product research took longer than six minutes')); }, options.timeoutMs || 360000);
    child.stdout.on('data', chunk => { stdout += chunk; if(stdout.length > 2*1024*1024) child.kill('SIGTERM'); });
    child.stderr.on('data', chunk => { stderr += chunk; if(stderr.length > 1024*1024) stderr = stderr.slice(-1024*1024); });
    child.on('error', error => finish(new Error(`Could not start product research: ${error.message}`)));
    child.on('close', code => {
      if(code !== 0) return finish(new Error(`Product research failed${stderr.trim()?`: ${stderr.trim().split('\n').slice(-3).join(' ')}`:''}`));
      try{finish(null,{data:JSON.parse(stdout.trim()),model:'codex',responseId:null});}
      catch(error){finish(new Error(`Product research returned invalid structured output: ${error.message}`));}
    });
    child.stdin.end(input.messages.map(message=>`${message.role.toUpperCase()}:\n${message.content}`).join('\n\n'));
  });
}

function defaultRunner(){ return process.env.OPENAI_API_KEY ? createStructuredResponse : createCodexStructuredResponse; }

function prompt(asOf){
  return [
    'You are ORMA Market Discovery and Market Opportunity. ORMA is a dog-first hiking product in the Alps.',
    `Research current competitor launches and product patterns as of ${asOf.slice(0, 10)}.`,
    'Look for useful signals from outdoor navigation products, not ideas to copy blindly.',
    'Turn the strongest signals into concrete ORMA opportunities across features, UI and editorial gaps.',
    'Prefer official product announcements, release notes and support documentation. Every idea needs at least one directly supporting source.',
    'Keep the packet executive-friendly. This is research only: do not claim that any feature has been approved or built.',
    'Give each idea a stable kebab-case id and a short list of questions for deeper investigation.',
  ].join('\n');
}

function normalizeDiscovery(data, at, response = {}){
  const ideas = (data.ideas || []).map(idea => ({ ...idea, status: 'awaiting-review' }));
  return {
    contractVersion: '1.0.0', generatedAt: at, mode: 'research-only', publicMutationAllowed: false,
    generatedBy: { agents: ['marketDiscovery', 'marketOpportunity'], model: response.model || null, responseId: response.responseId || null },
    executiveSummary: data.executiveSummary, ideas,
    summary: {
      total: ideas.length, awaitingReview: ideas.length,
      highImpact: ideas.filter(idea => idea.impact === 'high').length,
      categories: [...new Set(ideas.map(idea => idea.category))],
    },
  };
}

async function runProductDiscovery(options = {}){
  const at = options.at || new Date().toISOString();
  const runAgent = options.runAgent || defaultRunner();
  const response = await runAgent({
    schemaName: 'orma_product_ideas', schema: PRODUCT_IDEAS_SCHEMA, webSearch: true,
    messages: [
      { role: 'developer', content: prompt(at) },
      { role: 'user', content: 'Prepare the next ORMA product ideas and investigation review packet.' },
    ],
  }, options.clientOptions || {});
  return normalizeDiscovery(response.data, at, response);
}

async function runFocusedInvestigation(idea, focus, options = {}){
  const at = options.at || new Date().toISOString();
  const runAgent = options.runAgent || defaultRunner();
  const response = await runAgent({
    schemaName: 'orma_product_investigation', schema: FOCUSED_INVESTIGATION_SCHEMA, webSearch: true,
    messages: [
      { role: 'developer', content: [
        'You are ORMA Market Opportunity. Run a focused, current competitor benchmark for one proposed opportunity.',
        'Use primary sources such as official release notes, product pages and support documentation. Clearly distinguish evidence from inference.',
        'Make a concise recommendation for ORMA. This is research only and does not authorise feature work.',
      ].join('\n') },
      { role: 'user', content: `IDEA:\n${JSON.stringify(idea,null,2)}\n\nEDITOR FOCUS:\n${focus || idea.suggestedInvestigation.join(' ')}` },
    ],
  }, options.clientOptions || {});
  return { contractVersion:'1.0.0', ideaId:idea.id, generatedAt:at, mode:'research-only', publicMutationAllowed:false, ...response.data };
}

module.exports = { PRODUCT_IDEAS_SCHEMA, FOCUSED_INVESTIGATION_SCHEMA, normalizeDiscovery, runProductDiscovery, runFocusedInvestigation, createCodexStructuredResponse };
