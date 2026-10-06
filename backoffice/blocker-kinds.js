// What kind of thing a blocker is, and therefore who it is addressed to.
//
// A dossier gate's blocker list is long -- forty-plus on every one of the seven
// standing on 6 October -- and reads as forty-plus problems. It is not. Read in
// full, one gate's list (osm-16363583, Le Marais de Pré Lombard) is mostly the
// agents' own unfinished work:
//
//   terrainPoi: recommendation is block                      the agent's verdict
//   terrainPoi: open question — Can a field visit document…  nobody looked yet
//   terrainPoi/shade: conflicted                             the sources disagree
//   terrainPoi/livestock: unresolved                         nobody could find out
//   terrainPoi/shade: Official description includes wooded…  why that one stands
//
// Those want opposite handling. "The sources disagree about shade" is a
// judgement, and a moderator who has read both can make it. "No parcel-level
// record verifies livestock" is not a judgement at all -- it is research the
// agent could not finish, and she cannot finish it either. Asking her to write
// a defence of each is asking her to certify work nobody did.
//
// So this module answers one question per blocker: is it **contested**, meaning
// evidence exists and disagrees, or **unresearched**, meaning no evidence was
// found. Contested is hers. Unresearched is the agent's debt.
//
// Two rules make the classification worth trusting:
//
//   - A detail line follows its claim. "No parcel-level record verifies
//     livestock" is filed under terrainPoi/livestock, and that claim is
//     `unresolved`, so the detail is unresearched too. The same sentence under
//     a `conflicted` claim would be explaining a conflict, and contested.
//   - An agent's verdict follows that agent's worst finding. A `block` from an
//     agent that holds a real conflict is contested; a `block` from one that
//     only ran out of sources is the debt restated.
//
// This module decides nothing about what gates. It says what each blocker is,
// so the dispatch can ask the agent that can actually answer, and so the desk
// and the report can say how much of a long list is genuinely a decision.
//
// Dual-loaded like revision-target.js: the desk is a browser script and cannot
// require, and a second hand-maintained copy of a taxonomy is how the
// route-guidance regex went stale for nineteen days.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ORMABlockerKinds=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const UNATTRIBUTED='(unattributed)';

  // Findings that mean evidence was read and does not agree, as opposed to
  // evidence that was never found. `needs-resolution` is a recommendation
  // rather than a claim finding, but it reaches this list the same way and
  // means the agent wants another pass -- debt, not disagreement.
  const CONTESTED_FINDINGS=Object.freeze(['conflicted','counter-evidence']);
  const UNRESEARCHED_FINDINGS=Object.freeze(['unresolved','needs-resolution']);

  const AGENT=/^([A-Za-z][A-Za-z0-9]*)\s*[/:]/;
  const VERDICT=/^[A-Za-z][A-Za-z0-9]*:\s*recommendation is\s*(.+)$/;
  // The em dash is the producer's: dossierBlockingReasons writes
  // `${agentId}: open question — ${question}`.
  const OPEN_QUESTION=/open question\s+—/;
  const CLAIM_STATUS=/^[A-Za-z][A-Za-z0-9]*\/([\w-]+):\s*(conflicted|unresolved|counter-evidence|needs-resolution)\s*$/;
  const CLAIM_DETAIL=/^[A-Za-z][A-Za-z0-9]*\/([\w-]+):\s*(.+)$/;
  // "five automated resolution strategies exhausted" is the retry ledger
  // speaking, and it is the clearest statement of unresearched there is: the
  // machine tried everything it has.
  const EXHAUSTED=/automated resolution strategies exhausted/;

  function agentOf(reason){
    const match=AGENT.exec(String(reason).trim());
    return match?match[1]:UNATTRIBUTED;
  }

  /** The shape of one blocker, before its claim's standing is known. */
  function classifyBlocker(reason){
    const text=String(reason).trim();
    const agent=agentOf(text);
    const verdict=VERDICT.exec(text);
    if(verdict)return {agent,kind:'verdict',recommendation:verdict[1].trim()};
    if(OPEN_QUESTION.test(text))return {agent,kind:'open-question'};
    const status=CLAIM_STATUS.exec(text);
    if(status)return {agent,kind:'claim-status',claim:status[1],finding:status[2]};
    const detail=CLAIM_DETAIL.exec(text);
    return {agent,kind:'detail',...(detail?{claim:detail[1]}:{})};
  }

  /**
   * Every blocker, classified, with a disposition: 'contested', 'unresearched'
   * or 'undetermined'.
   *
   * Undetermined is a real answer and is never quietly folded into either side.
   * It covers a blocker that names no agent, and a detail whose claim has no
   * status line in this list -- both are things a person has to read, so they
   * stay a decision rather than being counted as debt.
   */
  function classifyBlockers(reasons){
    const list=(reasons||[]).map(reason=>({reason:String(reason),...classifyBlocker(reason)}));

    // A claim's standing, from its own status line. Keyed agent/claim because
    // two agents can hold a claim of the same name -- `provenance` appears
    // under evidenceLibrarian and redTeam on the live gates.
    const standing=new Map();
    for(const entry of list){
      if(entry.kind==='claim-status')standing.set(`${entry.agent}/${entry.claim}`,entry.finding);
    }

    const dispositionOf=entry=>{
      if(entry.agent===UNATTRIBUTED)return 'undetermined';
      if(entry.kind==='open-question')return 'unresearched';
      if(EXHAUSTED.test(entry.reason))return 'unresearched';
      if(entry.kind==='claim-status'){
        if(CONTESTED_FINDINGS.includes(entry.finding))return 'contested';
        if(UNRESEARCHED_FINDINGS.includes(entry.finding))return 'unresearched';
        return 'undetermined';
      }
      if(entry.kind==='detail'){
        const finding=entry.claim?standing.get(`${entry.agent}/${entry.claim}`):undefined;
        if(finding&&CONTESTED_FINDINGS.includes(finding))return 'contested';
        if(finding&&UNRESEARCHED_FINDINGS.includes(finding))return 'unresearched';
        return 'undetermined';
      }
      return 'undetermined';
    };

    const decided=list.map(entry=>({...entry,disposition:dispositionOf(entry)}));

    // An agent's verdict is the rest of its findings restated, so it follows
    // the worst of them. Done after the first pass because it depends on it.
    const worstByAgent=new Map();
    for(const entry of decided){
      if(entry.kind==='verdict')continue;
      const current=worstByAgent.get(entry.agent);
      if(entry.disposition==='contested')worstByAgent.set(entry.agent,'contested');
      else if(entry.disposition==='unresearched'&&current!=='contested')worstByAgent.set(entry.agent,'unresearched');
    }
    return decided.map(entry=>entry.kind==='verdict'
      ? {...entry,disposition:worstByAgent.get(entry.agent)||'undetermined'}
      : entry);
  }

  /** The same list, split the way a sitting actually divides. */
  function blockerDisposition(reasons){
    const classified=classifyBlockers(reasons);
    const pick=disposition=>classified.filter(entry=>entry.disposition===disposition).map(entry=>entry.reason);
    return {
      contested:pick('contested'),
      unresearched:pick('unresearched'),
      undetermined:pick('undetermined'),
      classified,
    };
  }

  /**
   * Per agent, how many of its blockers a re-run could actually answer.
   *
   * This is what a dispatch target should be chosen on. dominantAgentFromBlockers
   * picked the agent holding the most blockers of any kind, and an agent's open
   * questions inflate that count -- so the agent that asked the most questions
   * got asked again, ahead of one sitting on a genuine contradiction. Counting
   * only the answerable share is the same rule the geometry precedence already
   * encodes: ask about the thing that can move.
   */
  function answerableCountsByAgent(reasons){
    const counts=new Map();
    for(const entry of classifyBlockers(reasons)){
      if(entry.disposition!=='unresearched')continue;
      if(entry.agent===UNATTRIBUTED)continue;
      // A verdict is the agent's other findings restated, so counting it is
      // counting the same work twice -- and it would give an agent with one
      // open claim the same weight as one with two.
      if(entry.kind==='verdict')continue;
      counts.set(entry.agent,(counts.get(entry.agent)||0)+1);
    }
    return counts;
  }

  return {UNATTRIBUTED,CONTESTED_FINDINGS,UNRESEARCHED_FINDINGS,
    classifyBlocker,classifyBlockers,blockerDisposition,answerableCountsByAgent};
});
