const {validateVariesClaims,VARIABLE_CLAIM_IDS,MIN_VARIES_RESOLUTION_ATTEMPT,
  SPECIALIST_SCHEMA,PROMPTS}=require('./workflows/run-trail-specialist.js');
const {RESOLVABLE_FINDINGS}=require('./workflows/claim-resolution.js');
const {dossierBlockingReasons}=require('./workflows/advance-trail-orchestration.js');

// Whether cattle are on a summer pasture depends on the day you walk. Answering
// that is finishing the question, not failing it -- but it must be a conclusion
// drawn from looking, never a way of saying nothing was found.
const varies=over=>({id:'livestock',category:'livestock',
  proposedValue:'Cattle graze the alpage between June and late September.',
  finding:'varies',variesWith:'The grazing season, roughly June to late September.',
  confidence:0.9,rationale:'',blockers:[],entityName:null,rule:'not-applicable',
  observedAt:null,location:null,
  sources:[{label:'Commune alpage notice',url:'https://example.org/alpage',
    authority:'municipality',accessedAt:'2026-09-10'}],...over});
const job=attempt=>({agentId:'terrainPoi',resolutionAttempt:attempt});

describe('a question that has no fixed answer', () => {
  test('livestock may be answered "varies" once it has been tried', () => {
    expect(()=>validateVariesClaims({claims:[varies()]},job(2))).not.toThrow();
  });

  test('seasonal restrictions may too', () => {
    expect(()=>validateVariesClaims({claims:[varies({id:'seasonal-restrictions'})]},job(3))).not.toThrow();
  });

  // Water and shade are features of the route, not conditions of the day.
  test.each(['water','shade','recommended-start','elevation'])
    ('%s cannot be answered "varies"', id => {
      expect(()=>validateVariesClaims({claims:[varies({id})]},job(3)))
        .toThrow(/does not vary by the day/);
    });

  test('the eligible set stays deliberately small', () => {
    expect(VARIABLE_CLAIM_IDS).toEqual(['livestock','seasonal-restrictions']);
  });
});

describe('it has to be a conclusion, not an excuse', () => {
  test('it cannot be given on the first pass', () => {
    expect(()=>validateVariesClaims({claims:[varies()]},job(0)))
      .toThrow(/cannot be answered "varies" before resolution attempt 2/);
    expect(()=>validateVariesClaims({claims:[varies()]},job(1))).toThrow(/before resolution attempt 2/);
    expect(MIN_VARIES_RESOLUTION_ATTEMPT).toBe(2);
  });

  test('it must say what it varies with', () => {
    expect(()=>validateVariesClaims({claims:[varies({variesWith:'   '})]},job(2)))
      .toThrow(/does not say what it varies with/);
    expect(()=>validateVariesClaims({claims:[varies({variesWith:null})]},job(2)))
      .toThrow(/does not say what it varies with/);
  });

  // The evidence is for the variability, not for a value.
  test('it must cite a source establishing the variability', () => {
    expect(()=>validateVariesClaims({claims:[varies({sources:[]})]},job(2)))
      .toThrow(/requires a source establishing that it varies/);
  });

  test('every other finding is untouched by the check', () => {
    const ordinary={...varies(),finding:'unresolved',id:'water',variesWith:null,sources:[]};
    expect(()=>validateVariesClaims({claims:[ordinary]},job(0))).not.toThrow();
  });
});

describe('answering "varies" finishes the claim', () => {
  test('it is not retried, so it stops burning attempts', () => {
    expect(RESOLVABLE_FINDINGS.has('varies')).toBe(false);
    expect(RESOLVABLE_FINDINGS.has('unresolved')).toBe(true);
  });

  test('it does not hold the trail at the dossier gate', () => {
    const outputs=[{agentId:'terrainPoi',jobId:'j1',
      result:{recommendation:'advance',openQuestions:[],claims:[varies()]}}];
    expect(dossierBlockingReasons(outputs).filter(reason=>reason.includes('livestock'))).toEqual([]);
  });

  test('an unresolved claim still does, so nothing was loosened by accident', () => {
    const outputs=[{agentId:'terrainPoi',jobId:'j1',
      result:{recommendation:'advance',openQuestions:[],
        claims:[{...varies(),finding:'unresolved'}]}}];
    expect(dossierBlockingReasons(outputs)).toContain('terrainPoi/livestock: unresolved');
  });
});

describe('the contract and the agents agree', () => {
  test('the schema offers the finding and the field', () => {
    const claim=SPECIALIST_SCHEMA.properties.claims.items;
    expect(claim.properties.finding.enum).toContain('varies');
    expect(claim.required).toContain('variesWith');
  });

  test('both agents are told when it applies and when it does not', () => {
    expect(PROMPTS.terrainPoi).toContain('Never use "varies" for a question you simply could not answer');
    expect(PROMPTS.terrainPoi).toContain('tree cover and the existence of a fountain are features of the route');
    expect(PROMPTS.regulatoryRanger).toContain('Never use "varies" for a rule you simply could not find');
  });
});

// The rule lived only in the validator. An agent on a first pass got no
// resolution prompt at all, read "only after you have tried to pin it down",
// concluded it had tried, and answered "varies" -- then was refused by an
// attempt number nobody had given it. The retry re-sent the identical prompt,
// so it answered identically until the budget was gone. Seven
// seasonal-restrictions jobs blocked that way, each one burning five model
// calls to be told the same thing in a language it never heard.
describe('the agent is told which attempt it is on', () => {
  const {runTrailSpecialist}=require('./workflows/run-trail-specialist.js');
  const trail={id:'osm-1',name:'Test trail',path:[[11.9,46.6],[11.91,46.61]]};
  const clean={claims:[],openQuestions:[],recommendation:'advance',summary:'nothing to report'};

  async function developerPrompt(resolutionAttempt){
    let captured='';
    const runAgent=async({messages})=>{captured=messages[0].content;return {responseId:'r',model:'m',data:clean};};
    await runTrailSpecialist({job:{agentId:'terrainPoi',candidateId:'osm-1',action:'verify'},trail,context:[]},{runAgent});
    if(resolutionAttempt===0)return captured;
    const withAttempt=async({messages})=>{captured=messages[0].content;return {responseId:'r',model:'m',data:clean};};
    await runTrailSpecialist({job:{agentId:'terrainPoi',candidateId:'osm-1',action:'verify',
      resolutionAttempt,resolutionStrategy:'s',resolutionStrategyLabel:'Label',resolutionInstruction:'Try harder.',claimIds:[]},
      trail,context:[]},{runAgent:withAttempt});
    return captured;
  }

  test('a first pass is told plainly not to answer "varies", and what to do instead', async () => {
    const prompt=await developerPrompt(0);
    expect(prompt).toContain('Do not return finding "varies" on this pass');
    expect(prompt).toContain(`resolution attempt ${MIN_VARIES_RESOLUTION_ATTEMPT}`);
    // Without an alternative the agent just picks "varies" again.
    expect(prompt).toContain('return finding "unresolved"');
  });

  test('an attempt that may use it is told so, with the conditions attached', async () => {
    const prompt=await developerPrompt(MIN_VARIES_RESOLUTION_ATTEMPT);
    expect(prompt).toContain('you may conclude finding "varies"');
    expect(prompt).toContain('variesWith');
    expect(prompt).not.toContain('Do not return finding "varies" on this pass');
  });

  test('the attempt below the threshold is still refused', async () => {
    const prompt=await developerPrompt(MIN_VARIES_RESOLUTION_ATTEMPT-1);
    expect(prompt).toContain('Do not return finding "varies" on this pass');
  });

  test('the instruction names the same claims the validator allows', async () => {
    // Built from VARIABLE_CLAIM_IDS rather than written out, so widening the
    // rule cannot leave the agent being told the old one.
    const prompt=await developerPrompt(0);
    for(const id of VARIABLE_CLAIM_IDS) expect(prompt).toContain(id);
  });

  test('what the agent is told and what the validator enforces agree', async () => {
    // The pairing that was broken: permitted by the prompt, refused by the code.
    const permitted=await developerPrompt(MIN_VARIES_RESOLUTION_ATTEMPT);
    expect(permitted).toContain('you may conclude finding "varies"');
    expect(()=>validateVariesClaims({claims:[varies()]},job(MIN_VARIES_RESOLUTION_ATTEMPT))).not.toThrow();

    const refused=await developerPrompt(0);
    expect(refused).toContain('Do not return finding "varies"');
    expect(()=>validateVariesClaims({claims:[varies()]},job(0)))
      .toThrow(/cannot be answered "varies" before resolution attempt/);
  });
});
