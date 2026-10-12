'use strict';

const fs=require('fs');
const path=require('path');

/**
 * Every schema sent to the Responses API has to satisfy the strict
 * structured-output rules, and the API is the only thing that was checking.
 *
 * #717 renamed a verdict's `blocker` to `blockerId` and the edit to the
 * `required` array beside it silently did not apply. The unit tests all passed,
 * because they call the reviewer directly with an injected agent and never send
 * the schema anywhere. Live, every adjudication came back
 *
 *   400: Invalid schema for response_format 'orma_gate_adjudication' ...
 *   'required' is required to be supplied and to be an array including every
 *   key in properties. Missing 'blockerId'.
 *
 * so the gate adjudicator was broken outright for the three days the fix was
 * merged, and no test could see it. This closes that: the rules the API
 * enforces are asserted here, over every schema the workflows export.
 */

const WORKFLOWS=path.join(__dirname,'workflows');

function schemasInRepo(){
  const found=[];
  for(const file of fs.readdirSync(WORKFLOWS).filter(name=>name.endsWith('.js'))){
    let module;
    try{module=require(path.join(WORKFLOWS,file));}catch(error){continue;}
    for(const [name,value] of Object.entries(module||{})){
      if(!/SCHEMA|CONTRACT/.test(name))continue;
      if(value&&typeof value==='object'&&typeof value.type==='string'){
        found.push({id:`${file}:${name}`,schema:value});
      }
    }
  }
  return found;
}

/** Every object node in a schema, with the path a reader can follow. */
function objectNodes(node,at='(root)',into=[]){
  if(!node||typeof node!=='object')return into;
  if(node.type==='object'&&node.properties)into.push({at,node});
  for(const [key,value] of Object.entries(node)){
    if(key==='properties'){
      for(const [property,sub] of Object.entries(value))objectNodes(sub,`${at}.${property}`,into);
    }else if(key==='items'){
      objectNodes(value,`${at}[]`,into);
    }else if(['anyOf','oneOf','allOf'].includes(key)&&Array.isArray(value)){
      value.forEach((sub,index)=>objectNodes(sub,`${at}{${key}:${index}}`,into));
    }
  }
  return into;
}

describe('every schema the agents are given is one the API will accept',()=>{
  const schemas=schemasInRepo();

  // Pinned like the operational-contract count: a schema added without being
  // covered here should be a decision, not an omission. If this fails because
  // you added one, add it to the list -- the cases below then cover it.
  test('every agent-facing schema in the repository is on this list',()=>{
    expect(schemas.map(entry=>entry.id).sort()).toEqual([
      'adjudicate-gate-blockers.js:ADJUDICATION_SCHEMA',
      'community-hazard-vetting.js:HAZARD_VETTING_SCHEMA',
      'run-guide-content.js:EDIT_SCHEMA',
      'run-guide-content.js:PICTURE_SCHEMA',
      'run-trail-specialist.js:SPECIALIST_SCHEMA',
      'scout-area-closures.js:SCOUT_SCHEMA',
    ]);
  });

  // The rule the API states verbatim: required must include every key in
  // properties. A property missing from it is a 400, not a lenient default.
  test.each(schemas.map(entry=>[entry.id,entry.schema]))
    ('%s lists every property as required',(id,schema)=>{
      for(const {at,node} of objectNodes(schema)){
        const properties=Object.keys(node.properties).sort();
        const required=[...(node.required||[])].sort();
        expect({at,required}).toEqual({at,required:properties});
      }
    });

  test.each(schemas.map(entry=>[entry.id,entry.schema]))
    ('%s closes every object to extra properties',(id,schema)=>{
      for(const {at,node} of objectNodes(schema)){
        expect({at,additionalProperties:node.additionalProperties})
          .toEqual({at,additionalProperties:false});
      }
    });
});
