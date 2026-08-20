#!/usr/bin/env node
'use strict';

const path=require('path');
const {auditOperationalContract}=require('../workflows/audit-operational-contract');

async function main(){
  const report=await auditOperationalContract(path.resolve(__dirname,'../..'));
  if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
  else{
    console.log(`[backoffice-audit] ${report.summary.passed}/${report.summary.total} automated operating checks passed.`);
    for(const check of report.checks)console.log(`${check.status==='pass'?'PASS':'FAIL'}  ${check.id} — ${check.detail}`);
    console.log('\nManual production checks:');for(const check of report.manualChecks)console.log(`MANUAL  ${check.id} — ${check.instruction}`);
  }
  if(report.status!=='pass')process.exitCode=1;
}

main().catch(error=>{console.error(`[backoffice-audit] ${error.stack||error.message}`);process.exitCode=1;});
