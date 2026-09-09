const fs=require('fs');
const {startLiveTrailCampaign,agentWorking,DEFAULT_TRAIL_CAPACITY,DEFAULT_GATE_CAPACITY}=require('./workflows/start-live-trail-campaign.js');

// The pipeline as it actually stood on 2026-09-08: fifteen active trails against
// a capacity of fifteen, so the campaign admitted nothing and 145 trails could
// not enter. Five of those fifteen were only waiting on a moderator.
const REAL_PIPELINE=[
  ...Array(7).fill('evidence-resolution'),
  ...Array(3).fill('geometry-human-gate'),
  ...Array(2).fill('geometry-audit'),
  ...Array(2).fill('dossier-human-gate'),
  'evidence-research',
  'blocked',
].map((state,index)=>trail(`t${index}`,state));

function trail(id,state){
  return {trailId:id,candidateId:id,trailName:id,state,stage:state,
    attempts:{},resolutionAttempts:{},jobIds:[],blockers:[],
    gate:null,latestOutputRef:null,publicMutationAllowed:false,
    updatedAt:'2026-09-08T10:00:00.000Z'};
}

function storeWith(trails){
  const artifacts={'trail-orchestration':{contractVersion:'1.0.0',publicMutationAllowed:false,trails:[...trails]}};
  const jobs=[];
  return {jobs,
    artifacts,
    getArtifact:async id=>artifacts[id]||null,
    setArtifact:async(id,value)=>{artifacts[id]=value;},
    putJobIfAbsent:async job=>{jobs.push(job);},
  };
}

// Candidates the planner will accept: unverified, with an OSM relation to audit.
function candidates(count){
  const src=fs.readFileSync('data/regions/dolomites-trails.js','utf8');
  const all=JSON.parse(src.match(/var incoming=(\[[\s\S]*?\]);/)[1]);
  return all.filter(trail=>trail.osmRelation).slice(0,count);
}

describe('the two budgets protect different things', () => {
  test('a trail waiting on a moderator is not agent work', () => {
    expect(agentWorking('geometry-human-gate')).toBe(false);
    expect(agentWorking('dossier-human-gate')).toBe(false);
  });

  test('a trail being researched is', () => {
    ['evidence-resolution','evidence-research','geometry-audit'].forEach(state=>
      expect(agentWorking(state)).toBe(true));
  });

  test('a terminal trail is neither, so it holds no place', () => {
    ['blocked','rejected','ready-for-editorial'].forEach(state=>
      expect(agentWorking(state)).toBe(false));
  });

  // A state this list has not met must consume the tight budget, never free it.
  test('an unrecognised state counts as agent work', () => {
    expect(agentWorking('some-future-state')).toBe(true);
  });
});

describe('intake against the real stalled pipeline', () => {
  test('the five gate-parked trails no longer block new work', async () => {
    const store=storeWith(REAL_PIPELINE);
    await startLiveTrailCampaign(store,candidates(30),
      {at:'2026-09-08T18:00:00.000Z',limit:10,capacity:15,queueCapacity:40});
    // 10 agent-working of 15, so five slots free where there were none.
    const {lastCampaign}=store.artifacts['trail-orchestration'];
    expect(lastCampaign.activeBefore).toBe(10);
    expect(lastCampaign.parkedBefore).toBe(5);
    expect(store.jobs.length).toBe(5);
  });

  test('the agent budget still stops runaway research', async () => {
    const store=storeWith(Array(15).fill('evidence-resolution').map((state,index)=>trail(`t${index}`,state)));
    await startLiveTrailCampaign(store,candidates(30),
      {at:'2026-09-08T18:00:00.000Z',limit:10,capacity:15,queueCapacity:40});
    expect(store.jobs.length).toBe(0);
  });

  // Admitting more when the moderator already has a backlog helps nobody, and
  // the review queue artifact has its own byte ceiling.
  test('a moderator backlog eventually stops intake too', async () => {
    const store=storeWith(Array(40).fill('dossier-human-gate').map((state,index)=>trail(`t${index}`,state)));
    await startLiveTrailCampaign(store,candidates(30),
      {at:'2026-09-08T18:00:00.000Z',limit:10,capacity:15,queueCapacity:40});
    expect(store.jobs.length).toBe(0);
  });

  test('blocked trails free their place, which is what lets work move on', async () => {
    const store=storeWith(Array(15).fill('blocked').map((state,index)=>trail(`t${index}`,state)));
    await startLiveTrailCampaign(store,candidates(30),
      {at:'2026-09-08T18:00:00.000Z',limit:10,capacity:15,queueCapacity:40});
    expect(store.jobs.length).toBe(10);
  });

  test('the gate budget is far looser than the agent budget', () => {
    expect(DEFAULT_GATE_CAPACITY).toBeGreaterThan(DEFAULT_TRAIL_CAPACITY);
  });
});

describe('the desk shows trails that gave up', () => {
  const desk=fs.readFileSync('trail-verify-desk.js','utf8');
  const page=fs.readFileSync('trail-verify-desk.html','utf8');
  const styles=fs.readFileSync('backoffice-review.css','utf8');

  // A blocked trail has no gate, so it is in no review queue and used to appear
  // nowhere at all.
  test('it reads them from the orchestration, not the review queue', () => {
    expect(desk).toContain("filter(trail=>trail.state==='blocked')");
    expect(desk).toContain('function renderBlocked()');
    expect(desk).toContain('renderBlocked();');
  });

  test('the page gives it somewhere to render, hidden until there are any', () => {
    expect(page).toContain('id="verifyBlocked"');
    expect(page).toContain('hidden');
    expect(styles).toContain('.vd-blocked{');
  });

  test('it says why each one stopped, in the same words as the queue', () => {
    expect(desk).toContain('groupBlockers(trail.reasons)');
    expect(desk).toContain('No reason was recorded.');
  });
});
