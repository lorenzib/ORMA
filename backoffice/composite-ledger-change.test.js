'use strict';

const {compositesChanged,describeChange}=require('./workflows/composite-ledger-change');

const ledger=(composites,updatedAt='2026-10-06T00:00:00.000Z')=>
  JSON.stringify({contractVersion:'1.0.0',updatedAt,composites});
const proposed={'lago-braies':{state:'proposed',coveragePercent:100,relations:[{externalRelationId:'relation/1'}]}};
const approved={'lago-braies':{state:'approved',coveragePercent:100,relations:[{externalRelationId:'relation/1'}],
  approvedBy:'Benedetta Lorenzi (ORMA owner)'}};

describe('telling a decision from a timestamp',()=>{
  test('a run that ruled on nothing is not a change',()=>{
    // The 6 October run: every proposal held because Overpass was unreachable,
    // and the only difference in the file was updatedAt. It opened a PR anyway.
    const before=ledger(proposed,'2026-10-06T14:44:35.259Z');
    const after=ledger(proposed,'2026-10-06T14:58:58.082Z');
    expect(before).not.toEqual(after);
    expect(compositesChanged(before,after)).toBe(false);
  });

  test('an approval is a change, and says so',()=>{
    expect(compositesChanged(ledger(proposed),ledger(approved))).toBe(true);
    expect(describeChange(ledger(proposed),ledger(approved))).toEqual(['lago-braies: proposed -> approved']);
  });

  test('a new proposal is a change',()=>{
    expect(compositesChanged(ledger({}),ledger(proposed))).toBe(true);
    expect(describeChange(ledger({}),ledger(proposed))).toEqual(['lago-braies: absent -> proposed']);
  });

  test('reordered keys are not a decision',()=>{
    // The CLI rewrites the whole object; a different key order is not a ruling.
    const a=ledger({x:{state:'proposed',coveragePercent:90},y:{state:'approved',coveragePercent:100}});
    const b=ledger({y:{coveragePercent:100,state:'approved'},x:{coveragePercent:90,state:'proposed'}});
    expect(compositesChanged(a,b)).toBe(false);
  });

  test('a changed figure inside a composite still counts',()=>{
    const a=ledger({'x':{state:'proposed',coveragePercent:100}});
    const b=ledger({'x':{state:'proposed',coveragePercent:72}});
    expect(compositesChanged(a,b)).toBe(true);
    // The state did not move, so there is nothing to name -- but it is a change.
    expect(describeChange(a,b)).toEqual([]);
  });

  test('an unreadable baseline opens the pull request rather than swallowing it',()=>{
    expect(compositesChanged('not json',ledger(approved))).toBe(true);
  });
});
