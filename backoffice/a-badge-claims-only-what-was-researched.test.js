'use strict';

const {researchedSafetyCategories,SAFETY_CATEGORIES,SAFETY_CATEGORY_OF_CLAIM}=require('./workflows/compile-verified-dossier');
const {graduationFor,SAFETY_CHECKS,GRADUATION_CHECKS}=require('./workflows/build-publication-staging');
const {BASE_SPECIALISTS}=require('./workflows/apply-dossier-review');
const {CATEGORIES}=require('./workflows/run-trail-specialist');

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

  test('a claim counts by the category it answers, not by its id',()=>{
    // The ids the specialists are actually asked for, taken from the job spec
    // rather than retyped: none of dog-access, leash-rules, shade or surface is
    // a category name. Matching on the id recorded at most water, exposure and
    // livestock, so no trail could ever reach all eleven checks.
    const asked=Object.fromEntries(BASE_SPECIALISTS.map(spec=>[spec.agentId,spec.claimIds]));
    expect(asked.regulatoryRanger).toEqual(expect.arrayContaining(['dog-access','leash-rules']));
    expect(asked.regulatoryRanger).not.toContain('access');
    expect(asked.terrainPoi).toEqual(expect.arrayContaining(['shade','surface']));
    expect(asked.terrainPoi).not.toEqual(expect.arrayContaining(['heat']));
    expect(asked.terrainPoi).not.toEqual(expect.arrayContaining(['surfaceHazards']));

    const claim=(id,category,finding='supported-proposal')=>({id,category,finding});
    const review={specialistOutputs:[
      {agentId:'regulatoryRanger',result:{claims:[claim('dog-access','access'),claim('leash-rules','access','unresolved')]}},
      {agentId:'terrainPoi',result:{claims:[claim('water','water'),claim('shade','heat'),claim('surface','surfaceHazards'),
        claim('exposure','exposure'),claim('livestock','livestock','varies')]}},
    ]};
    expect(researchedSafetyCategories(review)).toEqual([...SAFETY_CATEGORIES]);
  });

  test('an assigned claim answers its safety question whatever the model labelled it',()=>{
    // The category is the model's label; a shade claim filed under `route`
    // still answers the heat question it was asked.
    const review={specialistOutputs:[
      {agentId:'regulatoryRanger',result:{claims:[{id:'leash-rules',category:'route',finding:'unresolved'}]}},
      {agentId:'terrainPoi',result:{claims:[{id:'shade',category:'route'},{id:'surface'}]}},
    ]};
    expect(researchedSafetyCategories(review)).toEqual(['heat','surfaceHazards','access']);
  });

  test('every id that stands for a safety question is one a specialist is asked',()=>{
    const assigned=BASE_SPECIALISTS.flatMap(spec=>spec.claimIds);
    for(const [id,category] of Object.entries(SAFETY_CATEGORY_OF_CLAIM)){
      expect(assigned).toContain(id);
      expect(SAFETY_CATEGORIES).toContain(category);
    }
  });

  test('every safety category is one a claim can declare',()=>{
    // The schema's category enum is what a specialist may answer with, so a
    // category outside it could never be researched at all.
    for(const category of SAFETY_CATEGORIES)expect(CATEGORIES).toContain(category);
  });

  test('a claim in another category does not count for a safety one',()=>{
    const review={specialistOutputs:[{agentId:'regulatoryRanger',result:{claims:[
      {id:'seasonal-restrictions',category:'route',finding:'supported-proposal'},
    ]}}]};
    expect(researchedSafetyCategories(review)).toEqual([]);
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
