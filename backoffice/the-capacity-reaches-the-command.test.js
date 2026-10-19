'use strict';

const fs=require('fs');
const path=require('path');
const {MAX_LIMIT,MAX_CAPACITY}=require('./cli/start-live-trail-campaign');

const ROOT=path.resolve(__dirname,'..');
const workflow=fs.readFileSync(path.join(ROOT,'.github/workflows/orma-trail-campaign.yml'),'utf8');

/**
 * The intake budget was raised to 60 on 18 October and admitted nobody on the
 * 18th and the 19th. Three layers, each of which alone was enough:
 *
 *   ORMA_CAMPAIGN_CAPACITY: 60      <- set, logged, read by nothing here
 *   CAMPAIGN_CAPACITY: '15'         <- what the command actually passed
 *   --capacity must be 1..25        <- what the command would have refused
 *
 * The invariant written for the first fix checked that the variable appeared
 * in both workflows. It did. A name that is set and not used reads exactly
 * like a number that does not work.
 */
describe('the capacity reaches the command that admits',()=>{
  test('the command passes the variable, not a copy of it',()=>{
    expect(workflow).toContain('--capacity "$ORMA_CAMPAIGN_CAPACITY"');
    expect(workflow).toContain('--limit "$ORMA_CAMPAIGN_LIMIT"');
  });

  test('and there is no second copy beside it to pass instead',()=>{
    const declared=[...workflow.matchAll(/^\s*([A-Z_]*CAMPAIGN_(?:CAPACITY|LIMIT)):/gm)].map(match=>match[1]);
    expect([...new Set(declared)].sort()).toEqual(['ORMA_CAMPAIGN_CAPACITY','ORMA_CAMPAIGN_LIMIT']);
  });

  test('every capacity the command is given is one it would accept',()=>{
    // Read off the workflow rather than assumed: the default in the `vars`
    // fallback is the number that runs when nobody has set the variable.
    const fallbacks=[...workflow.matchAll(/vars\.ORMA_CAMPAIGN_CAPACITY \|\| '(\d+)'/g)].map(match=>Number(match[1]));
    expect(fallbacks.length).toBeGreaterThan(0);
    for(const capacity of fallbacks){
      expect({capacity,accepted:capacity>=1&&capacity<=MAX_CAPACITY}).toEqual({capacity,accepted:true});
    }
  });

  // A pass is a batch; the fleet is the programme. They shared one ceiling.
  test('the fleet budget is not capped at the per-pass batch size',()=>{
    expect(MAX_CAPACITY).toBeGreaterThan(MAX_LIMIT);
    expect(MAX_CAPACITY).toBeGreaterThanOrEqual(60);
  });

  test('and a slipped digit is still refused',async()=>{
    const {main}=require('./cli/start-live-trail-campaign');
    await expect(main(['--capacity','2000'])).rejects.toThrow(/--capacity must be an integer between 1 and 200/);
    await expect(main(['--capacity','0'])).rejects.toThrow(/--capacity/);
    await expect(main(['--limit','60'])).rejects.toThrow(/--limit must be an integer between 1 and 25/);
  });
});
