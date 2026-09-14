'use strict';

const {EVIDENCE_SCOUTING_CONTRACT,PROMPTS}=require('./workflows/run-trail-specialist');
const {STRATEGIES}=require('./workflows/claim-resolution');

describe('global verification evidence-scouting contract',()=>{
  const agents=['logistics','regulatoryRanger','terrainPoi','evidenceLibrarian','redTeam','auditor'];

  test.each(agents)('%s receives the complete source-ladder instruction',agentId=>{
    expect(PROMPTS[agentId]).toContain(EVIDENCE_SCOUTING_CONTRACT);
    expect(PROMPTS[agentId]).toContain('Optional does not mean optional research');
    expect(PROMPTS[agentId]).toContain('linked PDFs, GPX files, maps, geoportals and current notices');
    expect(PROMPTS[agentId]).toContain('credible local or specialist secondary sources');
    expect(PROMPTS[agentId]).toContain('exact authority contact, field observation or measurement');
  });

  test('source exhaustion still requires all materially different resolution passes',()=>{
    expect(STRATEGIES.map(strategy=>strategy.id)).toEqual([
      'primary-authority-scope-check',
      'geospatial-source-triangulation',
      'local-institution-cross-check',
      'counter-evidence-and-freshness-review',
      'direct-verification-escalation-check',
    ]);
  });
});
