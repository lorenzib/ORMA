'use strict';

const ENDPOINT = 'https://api.openai.com/v1/responses';

function outputText(response){
  return (response.output || []).flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text').map(item => item.text).join('');
}

async function createStructuredResponse(input, options = {}){
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if(!apiKey) throw new Error('OPENAI_API_KEY is required to execute Content Desk jobs');
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model || process.env.ORMA_CONTENT_MODEL || 'gpt-5.6-terra',
      input: input.messages,
      tools: input.webSearch ? [{ type: 'web_search' }] : [],
      text: { format: { type: 'json_schema', name: input.schemaName, strict: true, schema: input.schema } },
    }),
  });
  const payload = await response.json();
  if(!response.ok) throw new Error(`OpenAI request failed (${response.status}): ${payload.error?.message || 'unknown error'}`);
  const text = outputText(payload);
  if(!text) throw new Error('OpenAI response did not contain structured output text');
  return { data: JSON.parse(text), responseId: payload.id || null, model: payload.model || options.model || null };
}

module.exports = { ENDPOINT, outputText, createStructuredResponse };
