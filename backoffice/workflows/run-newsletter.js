'use strict';

const {createStructuredResponse}=require('../services/openai-responses-client');
const {createCodexStructuredResponse}=require('../services/codex-structured-client');
const {validateContentExecution}=require('../contracts/content-result-v1');

const NEWSLETTER_SCHEMA={type:'object',additionalProperties:false,properties:{
  issueTitle:{type:'string'},subjectOptions:{type:'array',minItems:2,maxItems:4,items:{type:'string'}},preheader:{type:'string'},introduction:{type:'string'},
  sections:{type:'array',minItems:1,maxItems:6,items:{type:'object',additionalProperties:false,properties:{heading:{type:'string'},body:{type:'string'},linkUrl:{type:['string','null']},sourceRefs:{type:'array',items:{type:'string'}}},required:['heading','body','linkUrl','sourceRefs']}},
  closing:{type:'string'},sources:{type:'array',items:{type:'object',additionalProperties:false,properties:{label:{type:'string'},url:{type:'string'},checkedAt:{type:'string'},supports:{type:'string'}},required:['label','url','checkedAt','supports']}},
},required:['issueTitle','subjectOptions','preheader','introduction','sections','closing','sources']};

async function runNewsletter(inputs,options={}){
  const at=options.at||new Date().toISOString();const root=options.root||require('path').resolve(__dirname,'../..');
  const runAgent=options.runAgent||(process.env.OPENAI_API_KEY?createStructuredResponse:(input,clientOptions)=>createCodexStructuredResponse(input,{root,...clientOptions}));
  let output;
  try{
    const response=await runAgent({schemaName:'orma_newsletter_draft',schema:NEWSLETTER_SCHEMA,webSearch:true,messages:[
      {role:'developer',content:[
        'You are the ORMA Newsletter editor. Prepare one concise, warm, useful issue for people who hike with dogs in the Alps.',
        'Use approved ORMA facts from the supplied inputs. Use directly linked sources for timely claims. A weather warning is a topic signal, never proof of a trail closure.',
        'Prioritise newly published trails and published guide changes. Use current signals only when they genuinely add reader value.',
        'Do not invent publication status, trail facts, images, partnerships or links. Do not send or publish anything.',
        options.revisionNote?`The CEO requested this immediate revision: ${options.revisionNote}`:'This is a fresh issue draft.',
      ].join('\n')},
      {role:'user',content:`Issue date: ${at.slice(0,10)}\nNewsletter inputs:\n${JSON.stringify(inputs,null,2).slice(0,60000)}${options.previousPacket?`\n\nPrevious draft:\n${JSON.stringify(options.previousPacket.outputs?.[0]?.result||{},null,2).slice(0,30000)}`:''}`},
    ]},options.clientOptions||{});
    output={jobId:`newsletter-${at.replace(/[:.]/g,'-')}-copy`,agentId:'copywriter',status:'ready-for-review',responseId:response.responseId,model:response.model,result:response.data,error:null};
  }catch(error){output={jobId:`newsletter-${at.replace(/[:.]/g,'-')}-copy`,agentId:'copywriter',status:'blocked',responseId:null,model:null,result:null,error:error.message};}
  const execution={contractVersion:'1.0.0',generatedAt:at,mode:'draft-only',publicMutationAllowed:false,workstream:'newsletter',subject:{type:'newsletter',id:`issue-${at.slice(0,10)}`,sourceRef:'backoffice-data/newsletter-draft.html',updatedAt:at,original:''},outputs:[output],summary:{readyForReview:output.status==='ready-for-review'?1:0,blocked:output.status==='blocked'?1:0}};
  const errors=validateContentExecution(execution);if(errors.length)throw new Error(errors.join('; '));return execution;
}

function newsletterIsDue(packet,review,at){
  if(!packet||packet.subject?.id==='awaiting-first-run')return true;
  const ready=(packet.outputs||[]).some(output=>output.status==='ready-for-review');const decision=(review?.decisions||[]).find(item=>item.generatedAt===packet.generatedAt);
  if(ready&&!decision)return false;
  if(!ready)return true;
  const anchor=new Date(decision?.reviewedAt||packet.generatedAt).getTime();return new Date(at).getTime()-anchor>=14*24*60*60*1000;
}

module.exports={NEWSLETTER_SCHEMA,newsletterIsDue,runNewsletter};
