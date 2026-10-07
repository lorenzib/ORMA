/**
 * @jest-environment jsdom
 */
'use strict';

// A waiting gate's blockingReasons are a ballot, not reading material. Approval
// needs an accepted entry per blocker, acceptedBlockerMap keys on the blocker's
// exact text, and the gate checks those keys against the full list recomputed
// from the specialist outputs. So the queue's compaction and the gate have to
// agree on the list down to the character -- and they did not:
//
//   - the cap kept 40 entries and appended a summary line, which is why every
//     one of seven dossier gates reported exactly 41 "blockers". 41 was
//     MAX_REASONS + 1, not a count of anything;
//   - a reason over 300 characters was stored as "<300 chars>…", so a tick on
//     it was filed under text the gate never looks for.
//
// Both end the same way: the desk shows an approvable card, the moderator fills
// in every box on it, the decision is queued, and the worker's compile refuses
// it where nobody can see. These tests run the whole seam -- outputs through
// compaction to the approval guard -- because each side is self-consistent and
// only the join was wrong.

const {compactDecidedItem,fitReviewQueue,BUDGET_REASONS}=require('./workflows/review-queue-compaction');
const {unacceptedBlockers,dossierBlockingReasons,waivableBlocker}=require('./workflows/compile-verified-dossier');
const {buildGateEvidence}=require('./workflows/gate-evidence');

/**
 * What a moderator working the card cannot clear: she ticks every box the
 * ballot shows, and this is what the gate still holds against her. Route
 * guidance is excluded because no reason answers it by design -- it is supplied
 * or the trail goes back -- so a waivable blocker left standing here is one
 * that had no box.
 */
const unclearable=item=>unacceptedBlockers(item,acceptAll(item)).filter(waivableBlocker);

// A terrainPoi output carrying `count` detail blockers on one claim, one of
// which is long enough to have been truncated. The real dossiers reach 41 this
// way: five agents, each with a verdict, open questions and per-claim detail.
function terrainOutput(count,{longAt=null}={}){
  const blockers=Array.from({length:count},(unused,index)=>
    index===longAt?`No parcel-level record verifies livestock. ${'Grazing evidence was sought from the commune, the DDT parcel register and the operator directly. '.repeat(4)}`
      :`No parcel-level record verifies livestock, reason ${index}.`);
  return {agentId:'terrainPoi',jobId:'terrainPoi-1',
    result:{recommendation:'block',claims:[{id:'livestock',finding:'unresolved',blockers,sources:[]}]}};
}

const waiting=outputs=>({
  reviewId:'r-1',candidateId:'osm-16363583',trailName:'Le Marais de Pré Lombard',
  gateType:'dossier-approval',state:'awaiting-human',openedAt:'2026-09-19T00:00:00Z',
  approvalAllowed:false,
  // Written at the transition into the gate, exactly as the worker writes it.
  blockingReasons:dossierBlockingReasons(outputs),
  specialistOutputs:outputs,
});

/** Accept every blocker the stored ballot shows, as a moderator working the card would. */
const acceptAll=item=>(item.blockingReasons||[])
  .map(blocker=>({blocker,reason:'Checked on the ground in August; it does not stop verification.'}));

describe('the ballot a gate shows and the list it checks',()=>{
  test('a gate with more than forty blockers can be approved by ticking its boxes',()=>{
    const outputs=[terrainOutput(48)];
    const item=compactDecidedItem(waiting(outputs));
    // Before the fix this was 41 -- forty reasons and "…and N more" -- so eight
    // blockers had no box, and ticking every box left eight standing.
    expect(item.blockingReasons.length).toBeGreaterThan(41);
    expect(item.blockingReasons.some(reason=>/and \d+ more/.test(reason))).toBe(false);
    expect(unclearable(item)).toEqual([]);
  });

  test('a blocker too long to print is still accepted by the text it is shown as',()=>{
    const outputs=[terrainOutput(6,{longAt:2})];
    const item=compactDecidedItem(waiting(outputs));
    const long=item.blockingReasons.find(reason=>reason.length>300);
    // The point of the case: it is over the old 300-character cap, so the
    // stored text used to end in "…" while the gate looked for the whole
    // sentence, and the tick on it matched nothing.
    expect(long).toBeDefined();
    expect(long.endsWith('…')).toBe(false);
    expect(unclearable(item)).toEqual([]);
  });

  test('a blocker whose sentence ends in a space is still acceptable',()=>{
    // Agent prose is assembled from fragments and arrives with trailing
    // whitespace. acceptedBlockerMap files the acceptance under the trimmed
    // text, so comparing the raw reason made such a blocker unclearable --
    // one stray space and the trail could never be approved.
    const padded={...waiting([]),specialistOutputs:[],
      blockingReasons:['terrainPoi/livestock: no record.  ','terrainPoi: recommendation is block']};
    expect(unclearable(padded)).toEqual([]);
  });

  test('a recomputation from summarised evidence is never the shorter answer',()=>{
    // The permissive direction, and the one that would have mattered. Compaction
    // drops a claim's blockers, its resolution and the output's openQuestions,
    // so recomputing from a summary sees three reasons where the evidence has
    // fifty. Recomputing is meant to be the stricter reading; if rehydration
    // cannot follow its pointer, this must not become a discount.
    const outputs=[terrainOutput(48)];
    const item=compactDecidedItem(waiting(outputs));
    expect(item.specialistOutputs[0].result.detailWithheld).toBe(true);
    // The summary on its own yields a small fraction of the real list. Stated
    // against the full list rather than as a fixed number, because what matters
    // is the gap, and the absolute count moves whenever a new required claim is
    // added upstream.
    const full=dossierBlockingReasons(outputs).length;
    expect(dossierBlockingReasons(item.specialistOutputs).length).toBeLessThan(full/4);
    // The gate still weighs the full list.
    expect(unacceptedBlockers(item,[]).length).toBe(full);
  });

  test('the stored ballot is the list the gate checks, entry for entry',()=>{
    const outputs=[terrainOutput(45,{longAt:0})];
    const item=compactDecidedItem(waiting(outputs));
    // Same seam, stated directly: no entry the gate requires is missing from
    // the card, and no entry on the card is one the gate will not recognise.
    expect(item.blockingReasons).toEqual(dossierBlockingReasons(outputs));
  });
});

describe('when the queue genuinely has to shorten a ballot',()=>{
  // The budget is real and takes precedence -- a trail waiting on a person must
  // never vanish from the queue to save bytes. What must not happen is an
  // abridged ballot presented as a decidable one.
  const heavy=index=>({
    reviewId:`r${index}`,candidateId:`osm-${index}`,state:'awaiting-human',
    openedAt:new Date(Date.UTC(2026,0,1)+index*86400000).toISOString(),
    gateType:'dossier-approval',approvalAllowed:false,
    blockingReasons:Array.from({length:60},(unused,n)=>`terrainPoi/livestock: ${'x'.repeat(900)} ${n}`),
    specialistOutputs:Array.from({length:4},(unused,n)=>({agentId:`a${n}`,jobId:`j${index}-${n}`,
      result:{summary:'s',trace:'t'.repeat(9000)}})),
  });

  test('it says so, rather than offering boxes that cannot add up',()=>{
    const fitted=fitReviewQueue({items:Array.from({length:60},(unused,index)=>heavy(index))});
    const abridged=fitted.items.filter(entry=>entry.blockingReasonsAbridged===true);
    expect(abridged.length).toBeGreaterThan(0);
    // Abridged means cut, and cut means short of the full list by construction.
    abridged.forEach(entry=>{
      expect(entry.blockingReasons.length).toBeLessThanOrEqual(BUDGET_REASONS+1);
    });
    // And every waiting review is still in the queue.
    expect(fitted.items.filter(entry=>entry.state==='awaiting-human')).toHaveLength(60);
  });

  test('a ballot that fits is never marked abridged',()=>{
    const item=compactDecidedItem(waiting([terrainOutput(48)]));
    expect(item.blockingReasonsAbridged).toBeUndefined();
  });

  test('the desk refuses an approval whose list it cannot fully show',()=>{
    const fs=require('fs');
    const source=fs.readFileSync('./trail-verify-desk.js','utf8');
    const start=source.indexOf('  const MIN_ACCEPT_REASON=10;');
    const end=source.indexOf('  function card(decision){');
    expect(start).toBeGreaterThan(-1);
    const acceptanceList=new Function('document','looseText',`
      function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
      ${source.slice(start,end)}
      return acceptanceList;`)(global.document,text=>String(text));
    const result=acceptanceList({blockers:['terrainPoi/livestock: unresolved','…and 54 more, in the full agent output'],
      ballotAbridged:true,ready:false},()=>{});
    // No tick is offered at all: approvable() needs every blocker waivable and
    // accepted, so an empty waivable list is what keeps the button down.
    expect(result.node.querySelectorAll('input[type=checkbox]')).toHaveLength(0);
    expect(result.waivable).toEqual([]);
    expect(result.node.textContent).toMatch(/not every blocker is shown/);
  });
});

describe('what the report prints',()=>{
  test('the count comes from the evidence, so a cap can never be read as a count',()=>{
    const outputs=[terrainOutput(48)];
    const item=compactDecidedItem(waiting(outputs));
    const report=buildGateEvidence({orchestration:{trails:[]},reviewQueue:{items:[item]},
      nowMs:Date.parse('2026-10-06T00:00:00Z')});
    expect(report.items).toHaveLength(1);
    expect(report.items[0].blockers).toHaveLength(dossierBlockingReasons(outputs).length);
    expect(report.items[0].blockers.some(entry=>/and \d+ more/.test(entry.reason))).toBe(false);
    expect(report.items[0].ballotAbridged).toBe(false);
  });

  test('an abridged ballot is reported as abridged',()=>{
    const item={...compactDecidedItem(waiting([terrainOutput(8)])),
      blockingReasonsAbridged:true,specialistOutputs:undefined};
    const report=buildGateEvidence({orchestration:{trails:[]},reviewQueue:{items:[item]}});
    expect(report.items[0].ballotAbridged).toBe(true);
  });
});
