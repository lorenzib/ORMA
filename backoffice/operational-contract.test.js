'use strict';

const path=require('path');
const {auditOperationalContract}=require('./workflows/audit-operational-contract');

describe('hosted ORMA operating contract',()=>{
  test('all automated production invariants pass together',async()=>{
    const report=await auditOperationalContract(path.resolve(__dirname,'..'),{at:'2026-08-20T10:00:00Z'});
    expect(report.status).toBe('pass');
    expect(report.summary).toEqual({passed:12,failed:0,total:12});
    expect(report.checks.every(item=>item.status==='pass')).toBe(true);
    expect(report.manualChecks.map(item=>item.id)).toEqual(['github-actions-pr-creation','moderator-access','social-launch']);
  });
});
