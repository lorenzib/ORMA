'use strict';

const {routeSourceReady,verifiableFirst}=require('./workflows/run-trail-specialist');
const {loadProductionTrails}=require('../scripts/load-production-trails');

/**
 * The four route claims are unwaivable and a trail whose only source is the OSM
 * relation its line came from can never supply them. Measured 12 October: 126
 * of 162 catalogue trails are in that position, and their jobs were researched
 * first simply because they were queued first.
 */

const osm=id=>({label:'Waymarked Trails relation',
  url:`https://hiking.waymarkedtrails.org/#route?id=${id}`,authority:'OpenStreetMap'});
const official=host=>({label:'Official route page',url:`https://${host}/sentiero`,authority:host});
const trail=(id,sourceLinks)=>({id,name:id,sourceLinks});

describe('a trail with nothing but map data cannot be verified',()=>{
  test('an OSM relation is not a route authority',()=>{
    expect(routeSourceReady(trail('a',[osm(1)]))).toBe(false);
  });

  test('nor is waymarkedtrails under any label',()=>{
    expect(routeSourceReady(trail('a',[{label:'Route',
      url:'https://hiking.waymarkedtrails.org/#route?id=9',authority:'Comune'}]))).toBe(false);
  });

  test('an official page is, even beside the relation',()=>{
    expect(routeSourceReady(trail('a',[osm(1),official('comune.example')]))).toBe(true);
  });

  // The agent supplies the authority itself, so a bare official link counts.
  test('a non-map link with no authority recorded still counts',()=>{
    expect(routeSourceReady(trail('a',[{label:'Route',url:'https://comune.example/x'}]))).toBe(true);
  });

  test('http and a trail with no links at all do not',()=>{
    expect(routeSourceReady(trail('a',[{label:'x',url:'http://comune.example/x'}]))).toBe(false);
    expect(routeSourceReady(trail('a',[]))).toBe(false);
    expect(routeSourceReady(null)).toBe(false);
  });

  // Derived from the catalogue, not retyped: a hand-written number would pass
  // against a figure nothing emits.
  test('the live catalogue splits as measured',()=>{
    const trails=loadProductionTrails(path());
    const ready=trails.filter(routeSourceReady);
    expect(trails.length).toBeGreaterThan(150);
    expect(ready.length).toBeGreaterThan(0);
    expect(ready.length).toBeLessThan(trails.length);
  });
  function path(){return require('path').resolve(__dirname,'..');}
});

describe('the budget goes to the trails that can finish',()=>{
  const trailById=new Map([
    ['ready-a',trail('ready-a',[official('comune.a')])],
    ['ready-b',trail('ready-b',[official('comune.b')])],
    ['osm-a',trail('osm-a',[osm(1)])],
    ['osm-b',trail('osm-b',[osm(2)])],
  ]);
  const job=candidateId=>({id:`job-${candidateId}`,candidateId});

  test('a source-ready trail is claimed before one awaiting a source',()=>{
    const order=verifiableFirst([job('osm-a'),job('ready-a')],trailById);
    expect(order.map(entry=>entry.candidateId)).toEqual(['ready-a','osm-a']);
  });

  test('queue order is kept inside each group, so nothing else changes',()=>{
    const order=verifiableFirst(
      [job('osm-a'),job('ready-a'),job('osm-b'),job('ready-b')],trailById);
    expect(order.map(entry=>entry.candidateId))
      .toEqual(['ready-a','ready-b','osm-a','osm-b']);
  });

  // Not dropped. A trail awaiting a source is still researched once the ones
  // that can finish are done, so sourcing one later costs nothing here.
  test('nothing is discarded, only reordered',()=>{
    const jobs=[job('osm-a'),job('ready-a'),job('osm-b')];
    expect(verifiableFirst(jobs,trailById)).toHaveLength(jobs.length);
  });

  test('an unknown trail sorts with the ones awaiting a source',()=>{
    const order=verifiableFirst([job('mystery'),job('ready-a')],trailById);
    expect(order.map(entry=>entry.candidateId)).toEqual(['ready-a','mystery']);
  });

  test('it copes with an empty queue and a missing index',()=>{
    expect(verifiableFirst([],trailById)).toEqual([]);
    expect(verifiableFirst([job('ready-a')],undefined).map(e=>e.candidateId)).toEqual(['ready-a']);
  });
});
