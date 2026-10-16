'use strict';

const {researchedSafetyCategories,SAFETY_CATEGORIES}=require('./workflows/compile-verified-dossier');
const {graduationFor,SAFETY_CHECKS,GRADUATION_CHECKS}=require('./workflows/build-publication-staging');

// Publication asserted all eleven checks complete and all six safety
// categories reviewed, unconditionally, on every trail.
//
// That was safe for exactly as long as nothing could be verified without five
// specialists having researched it. It stopped being safe on 16 October 2026,
// when a trail whose directions the free survey had settled was verified with
// no specialist having spoken. Publishing the old record would have told a
// walker ORMA had checked its water and its livestock. Somebody could take a
// dog up a shadeless ridge in August on a badge that meant nothing.
//
// The dossier recorded findings and never recorded whether anybody looked, so
// absence of a finding and absence of a look were the same shape -- in the one
// place that decides what a live trail page claims.

const output=(agentId,ids,finding='supported-proposal')=>({agentId,
  result:{claims:ids.map(id=>({id,finding}))}});

describe('a badge claims only what a specialist was asked',()=>{
  test('a category an agent returned a claim for counts as researched',()=>{
    const review={specialistOutputs:[output('terrainPoi',['water','heat'])]};
    expect(researchedSafetyCategories(review)).toEqual(['water','heat']);
  });

  test('whatever the finding, because looking and not settling it is a check',()=>{
    // The page shows the reader "unknown" unchanged, which is an honest outcome
    // of having looked.
    for(const finding of ['unresolved','conflicted','counter-evidence','varies']){
      expect(researchedSafetyCategories({specialistOutputs:[output('terrainPoi',['water'],finding)]}))
        .toEqual(['water']);
    }
  });

  test('a trail nobody asked has none of them',()=>{
    // The fast lane: a geometry survey settled the directions and no specialist
    // ran. Not even an accepted unknown, because nothing was researched.
    expect(researchedSafetyCategories({specialistOutputs:[output('cartographer',[])]})).toEqual([]);
    expect(researchedSafetyCategories({specialistOutputs:[]})).toEqual([]);
    expect(researchedSafetyCategories(null)).toEqual([]);
  });

  test('the survey is not a specialist, whatever claims it carries',()=>{
    // Its claim ids are route guidance and geometry; it never asks about water.
    expect(researchedSafetyCategories({specialistOutputs:[output('cartographer',['water','access'])]}))
      .toEqual([]);
  });

  test('the two halves agree on which six they are',()=>{
    expect([...SAFETY_CATEGORIES]).toEqual([...SAFETY_CHECKS]);
    expect(GRADUATION_CHECKS).toHaveLength(11);
  });

  test('all six researched earns the seal; none of them does not',()=>{
    expect(graduationFor([...SAFETY_CHECKS],true,true).status).toBe('verified');
    const reviewed=graduationFor([],true,true);
    expect(reviewed.status).toBe('in-progress');
    // What it did earn: the line is real and the directions are sourced.
    expect(reviewed.completed).toEqual(expect.arrayContaining(['route','routeNumbers']));
  });

  test('it upgrades by itself as research lands',()=>{
    // Nothing has to remember to promote a trail: the next publication derives
    // a fuller list from a fuller dossier.
    const statuses=SAFETY_CHECKS.map((_,index)=>
      graduationFor(SAFETY_CHECKS.slice(0,index+1),true,true).status);
    expect(statuses).toEqual(['in-progress','in-progress','in-progress',
      'in-progress','in-progress','verified']);
  });

  test('a missing photo or missing structured fields also hold the seal back',()=>{
    expect(graduationFor([...SAFETY_CHECKS],false,true).status).toBe('in-progress');
    expect(graduationFor([...SAFETY_CHECKS],true,false).status).toBe('in-progress');
    expect(graduationFor([...SAFETY_CHECKS],false,true).completed).not.toContain('photo');
    expect(graduationFor([...SAFETY_CHECKS],true,false).completed).not.toContain('elevation');
  });
});
