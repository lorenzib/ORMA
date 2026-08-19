'use strict';

const fs=require('fs');const path=require('path');const os=require('os');const {spawn}=require('child_process');

function codexBinary(){
  if(process.env.ORMA_CODEX_BIN)return process.env.ORMA_CODEX_BIN;
  const bundled='/Applications/ChatGPT.app/Contents/Resources/codex';return fs.existsSync(bundled)?bundled:'codex';
}

async function createCodexStructuredResponse(input,options={}){
  const temporary=await fs.promises.mkdtemp(path.join(os.tmpdir(),'orma-codex-schema-'));const schemaPath=path.join(temporary,'schema.json');
  await fs.promises.writeFile(schemaPath,`${JSON.stringify(input.schema,null,2)}\n`,'utf8');
  try{return await new Promise((resolve,reject)=>{
    const args=['exec','--ephemeral','--sandbox','read-only','--ignore-user-config','--ignore-rules','--output-schema',schemaPath,'-'];
    const child=spawn(options.binary||codexBinary(),args,{cwd:options.root||path.resolve(__dirname,'../..'),stdio:['pipe','pipe','pipe']});let stdout='';let stderr='';let settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
    const timer=setTimeout(()=>{child.kill('SIGTERM');finish(new Error(`${input.schemaName} took longer than six minutes`));},options.timeoutMs||360000);
    child.stdout.on('data',chunk=>{stdout+=chunk;if(stdout.length>2*1024*1024)child.kill('SIGTERM');});child.stderr.on('data',chunk=>{stderr+=chunk;if(stderr.length>1024*1024)stderr=stderr.slice(-1024*1024);});
    child.on('error',error=>finish(new Error(`Could not start ${input.schemaName}: ${error.message}`)));
    child.on('close',code=>{if(code!==0)return finish(new Error(`${input.schemaName} failed${stderr.trim()?`: ${stderr.trim().split('\n').slice(-3).join(' ')}`:''}`));try{finish(null,{data:JSON.parse(stdout.trim()),model:'codex',responseId:null});}catch(error){finish(new Error(`${input.schemaName} returned invalid JSON: ${error.message}`));}});
    child.stdin.end((input.messages||[]).map(message=>`${message.role.toUpperCase()}:\n${message.content}`).join('\n\n'));
  });}finally{await fs.promises.rm(temporary,{recursive:true,force:true});}
}

module.exports={codexBinary,createCodexStructuredResponse};
