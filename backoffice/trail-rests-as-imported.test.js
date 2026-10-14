'use strict';

const {restingState}=require('./workflows/apply-dossier-review');
const {ROUTE_GUIDANCE_CLAIM_IDS}=require('./workflows/compile-verified-dossier');
const {STATES}=require('./contracts/trail-orchestration-v1');
const {TERMINAL_STATES,agentWorking}=require('./workflows/start-live-trail-campaign');
const {TERMINAL}=require('./workflows/verification-funnel');

// A walk nobody has published directions for has not failed anything. Les
// Marais d'Albens is a real 6.6 km walk whose municipality has never described
// it, and no amount of research will produce a page that does not exist.
// Calling that `rejected` reads as "ORMA looked and says no", keeps it in the
// counts of things going wrong, and leaves it eligible to be paid for again.
//
// Eight of the catalogue's trails are in that position.

const directions=ROUTE_GUIDANCE_CLAIM_IDS.map(id=>`logistics/${id}: sourced route guidance is required`);

describe('where a refused trail goes',()=>{
  test('a refusal standing only on directions rests as imported',()=>{
    expect(restingState(directions)).toBe('imported');
    expect(restingState([directions[0]])).toBe('imported');
  });

  test('a broken line is rejected, because somebody could fix it',()=>{
    expect(restingState(['declared-route-unavailable: the route is gone'])).toBe('rejected');
    expect(restingState(['not-closed-loop: open'])).toBe('rejected');
    expect(restingState(['route-source-identity-contradicted: different route'])).toBe('rejected');
  });

  test('directions plus a broken line is still a rejection',()=>{
    // One fixable problem is enough: this is not a walk nobody wrote about.
    expect(restingState([...directions,'declared-route-unavailable: gone'])).toBe('rejected');
  });

  test('a refusal with nothing unwaivable is a rejection, not a rest',()=>{
    // Resting is for a walk that cannot qualify. Nothing unwaivable means the
    // refusal came from somewhere else and should not be quietly softened.
    expect(restingState(['terrainPoi/water: 3 automated resolution strategies exhausted'])).toBe('rejected');
    expect(restingState([])).toBe('rejected');
  });

  test('the split reads the blockers, never the wording of a note',()=>{
    // A reworded note is how an unwaivable class came to miss the blocker it
    // was written for (#472).
    const reworded=['logistics/route-number-switches: nobody has written this down anywhere'];
    expect(restingState(reworded)).toBe('imported');
  });
});

describe('a resting trail costs nothing',()=>{
  test('imported is a state the contract knows',()=>{
    expect(STATES).toContain('imported');
  });

  test('it is terminal, so it holds no place in the intake budget',()=>{
    expect(TERMINAL_STATES.has('imported')).toBe(true);
    expect(agentWorking('imported')).toBe(false);
    expect(TERMINAL).toContain('imported');
  });

  test('it is not a gate, so nobody is waiting on a decision',()=>{
    // A rested trail needs no moderator and no pass. It is finished.
    expect(agentWorking('dossier-human-gate')).toBe(false);
    expect(agentWorking('evidence-resolution')).toBe(true);
  });
});
