'use strict';

const {verifiableFirst,costsNoModelCall,FREE_AGENTS,
  routeSourceReady}=require('./workflows/run-trail-specialist');

// The verifiable-first rule exists to stop the model budget going on trails
// that cannot pass. It had no business ordering work that costs nothing -- and
// it was, because a free survey job carries the same unverifiable trail as a
// paid research job for it.
//
// That produced a circle. A trail with no published source ranks last; its
// survey is the free job that would answer its directions from the map and make
// it verifiable; and the survey never ran, because it sat behind every paid job
// and a pass takes ten. Six surveys were queued by hand on 16 October 2026 and
// not one ran until each trail was scoped on its own.

const job=(agentId,candidateId)=>({id:`${candidateId}-${agentId}`,agentId,candidateId});

// A trail whose only source is the OSM relation its line came from: the shape
// that ranks last, and the shape a survey rescues. Built to the shape
// routeGuidanceLeads actually reads -- `sourceLinks` and the guidance's own
// sources -- and asserted against routeSourceReady below rather than assumed.
const unsourced={id:'osm-6250300',
  sourceLinks:[{url:'https://www.openstreetmap.org/relation/6250300'}]};
const sourced={id:'lago-braies',
  sourceLinks:[{url:'https://www.drei-zinnen.it/en/trail'}]};

const trailById=new Map([['osm-6250300',unsourced],['lago-braies',sourced]]);
const ids=jobs=>jobs.map(entry=>entry.id);

describe('free work goes first',()=>{
  test('a survey for an unsourced trail outranks paid research for a sourced one',()=>{
    // The whole circle, in one assertion.
    const queue=[job('logistics','lago-braies'),job('cartographer','osm-6250300')];
    expect(ids(verifiableFirst(queue,trailById)))
      .toEqual(['osm-6250300-cartographer','lago-braies-logistics']);
  });

  test('among paid work the verifiable-first rule is unchanged',()=>{
    const queue=[job('logistics','osm-6250300'),job('terrainPoi','lago-braies')];
    expect(ids(verifiableFirst(queue,trailById)))
      .toEqual(['lago-braies-terrainPoi','osm-6250300-logistics']);
    // And that rule still reads the trail's sources, not its queue position.
    expect(routeSourceReady(sourced)).toBe(true);
    expect(routeSourceReady(unsourced)).toBe(false);
  });

  test('the three groups come out in order, and keep the queue order inside each',()=>{
    const queue=[
      job('logistics','osm-6250300'),   // paid, unverifiable
      job('terrainPoi','lago-braies'),  // paid, verifiable
      job('cartographer','lago-braies'),// free
      job('regulatoryRanger','osm-6250300'),
      job('cartographer','osm-6250300'),
    ];
    expect(ids(verifiableFirst(queue,trailById))).toEqual([
      'lago-braies-cartographer','osm-6250300-cartographer',
      'lago-braies-terrainPoi',
      'osm-6250300-logistics','osm-6250300-regulatoryRanger',
    ]);
  });

  test('only the deterministic agent is free, and one list says which',()=>{
    expect(FREE_AGENTS).toEqual(['cartographer']);
    expect(costsNoModelCall(job('cartographer','x'))).toBe(true);
    for(const agentId of ['logistics','regulatoryRanger','terrainPoi','evidenceLibrarian','redTeam']){
      expect(costsNoModelCall(job(agentId,'x'))).toBe(false);
    }
    expect(costsNoModelCall(null)).toBe(false);
  });

  test('a trail the catalogue does not know still sorts, behind free work',()=>{
    const queue=[job('logistics','osm-nonsense'),job('cartographer','osm-nonsense')];
    expect(ids(verifiableFirst(queue,trailById)))
      .toEqual(['osm-nonsense-cartographer','osm-nonsense-logistics']);
    expect(ids(verifiableFirst(queue,null))).toHaveLength(2);
  });

  test('an empty queue is an empty queue',()=>{
    expect(verifiableFirst([],trailById)).toEqual([]);
    expect(verifiableFirst(null,trailById)).toEqual([]);
  });
});
