'use strict';

const ENDPOINT = 'https://api.openai.com/v1/responses';

function outputText(response){
  return (response.output || []).flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text').map(item => item.text).join('');
}

function responseHeader(response,name){
  return typeof response.headers?.get==='function'?response.headers.get(name):null;
}

function retryDelayMs(response,message){
  const milliseconds=Number.parseFloat(responseHeader(response,'retry-after-ms'));
  if(Number.isFinite(milliseconds)&&milliseconds>=0)return Math.min(Math.ceil(milliseconds)+250,30_000);
  const seconds=Number.parseFloat(responseHeader(response,'retry-after'));
  if(Number.isFinite(seconds)&&seconds>=0)return Math.min(Math.ceil(seconds*1000)+250,30_000);
  const match=String(message||'').match(/try again in\s+([\d.]+)s/i);
  if(match)return Math.min(Math.ceil(Number.parseFloat(match[1])*1000)+250,30_000);
  return 1_000;
}

function retryableRateLimit(response,message){
  return response.status===429&&!/quota/i.test(String(message||''))
    &&(/rate limit/i.test(String(message||''))||responseHeader(response,'retry-after')||responseHeader(response,'retry-after-ms'));
}

async function createStructuredResponse(input, options = {}){
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if(!apiKey) throw new Error('OPENAI_API_KEY is required to execute Content Desk jobs');
  const fetchImpl = options.fetchImpl || fetch;
  const sleep=options.sleep||((milliseconds)=>new Promise(resolve=>setTimeout(resolve,milliseconds)));
  const maximumRetries=Number.isInteger(options.maxRateLimitRetries)?options.maxRateLimitRetries:2;
  const request={
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model || process.env.ORMA_CONTENT_MODEL || 'gpt-5.6-terra',
      input: input.messages,
      tools: input.webSearch ? [{ type: 'web_search' }] : [],
      text: { format: { type: 'json_schema', name: input.schemaName, strict: true, schema: input.schema } },
    }),
  };
  for(let attempt=0;;attempt+=1){
    const response=await fetchImpl(ENDPOINT,request);
    const payload=await response.json();
    const message=payload.error?.message||'unknown error';
    if(response.ok){
      const text=outputText(payload);
      if(!text)throw new Error('OpenAI response did not contain structured output text');
      return {data:JSON.parse(text),responseId:payload.id||null,model:payload.model||options.model||null};
    }
    if(attempt<maximumRetries&&retryableRateLimit(response,message)){
      await sleep(retryDelayMs(response,message));
      continue;
    }
    throw new Error(`OpenAI request failed (${response.status}): ${message}`);
  }
}

module.exports = { ENDPOINT, outputText,responseHeader,retryDelayMs,retryableRateLimit,createStructuredResponse };
