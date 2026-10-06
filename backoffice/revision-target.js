// Which agent a blocked gate is actually asking.
//
// This rule was written for the desk, and for a while it only ever ran there:
// it decided where Benedetta's "request revision" click was sent. That made it
// unreachable by anything else, and the pipeline paid for it. Nothing re-runs
// an agent on a trail parked at a human gate -- advance-trail-orchestration
// handles geometry-audit, evidence-research, evidence-resolution,
// provenance-audit and red-team, and `dossier-human-gate` is not in that state
// machine -- so a gate whose blockers only an agent can clear waits for a
// person who cannot clear them either. Measured 2026-09-15: seven dossier gates
// held logistics output captured before the route-guidance contract existed,
// and all 28 required claims came back absent. Waiting could never fix one of
// them.
//
// So the rule lives here, where both the desk and the worker can read it, and
// the worker's dispatch pass (workflows/dispatch-unanswered-gates.js) asks the
// agent directly. One rule, one place: the desk and the automation cannot
// disagree about who is being asked.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ORMARevisionTarget=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  // An explicit mismatch between the official route and the mapped geometry has
  // to be settled before Logistics can write directions for that line. Agents
  // currently report that mismatch inside their open questions rather than as a
  // cartographer-prefixed blocker, so recognise only the concrete source/shape
  // comparisons they produce. This keeps a route-identity problem from spending
  // another cycle asking Logistics to describe geometry that may be wrong.
  function hasRouteGeometryConflict(reasons){
    return (reasons||[]).some(reason=>{
      const text=String(reason).toLowerCase();
      return (/(?:supplied|mapped|osm)\s+(?:route\s+)?geometry/.test(text)
          &&/(?:official|published)\b.{0,50}\b(?:route|loop|gpx)/.test(text))
        ||/specific osm member ways/.test(text)
        ||(/official\s+(?:route\s+)?gpx/.test(text)
          &&/(?:same|match|correspond|difference|extension)/.test(text));
    });
  }

  // The desk used to send a revision to whichever specialist output happened to
  // be first, so a trail blocked entirely on logistics route guidance could
  // have its revision handed to terrainPoi, which cannot supply route guidance
  // and would return the same dossier. Every blocking reason names the agent it
  // belongs to -- "logistics/route-number-sequence: ..." or "logistics: open
  // question ..." -- so when they all name the same one, that is who is being
  // asked.
  //
  // Route guidance is mandatory and only Logistics can supply it. A dossier can
  // also carry Ranger or Terrain findings, so the generic "all reasons name the
  // same agent" rule below would otherwise fall back to the first output --
  // usually the Cartographer -- and send the revision to somebody who cannot
  // clear the gate. Geometry conflicts above are the one prerequisite.
  //
  // Returning null is a real answer: it means the blockers do not name one
  // agent, so nothing can be dispatched on their strength alone. The desk falls
  // back to the first specialist output for a human who has read the card; the
  // automation does not guess and leaves the gate standing.
  function agentFromBlockers(reasons){
    if(hasRouteGeometryConflict(reasons))return 'cartographer';
    if((reasons||[]).some(reason=>/^logistics\/(recommended-start|route-number-(status|sequence|switches))\s*:/.test(String(reason).trim())))return 'logistics';
    const named=new Set();
    for(const reason of reasons||[]){
      const match=/^([A-Za-z][A-Za-z0-9]*)\s*[/:]/.exec(String(reason).trim());
      if(!match)return null;
      named.add(match[1]);
    }
    return named.size===1?[...named][0]:null;
  }

  /** How many blockers each named agent is carrying. Unattributed reasons name
   * nobody and are counted for nobody. */
  function blockerCountsByAgent(reasons){
    const counts=new Map();
    for(const reason of reasons||[]){
      const match=/^([A-Za-z][A-Za-z0-9]*)\s*[/:]/.exec(String(reason).trim());
      if(!match)continue;
      counts.set(match[1],(counts.get(match[1])||0)+1);
    }
    return counts;
  }

  // The agent to ask when the blockers name several.
  //
  // agentFromBlockers answers "do these blockers belong to exactly one agent",
  // and the automation held the gate whenever they did not. Measured against
  // the live queue on 6 October that was every gate: all seven dossiers carried
  // blockers from four or five agents at once -- terrainPoi, evidenceLibrarian,
  // regulatoryRanger, redTeam and logistics -- so the dispatch pass asked
  // nobody anything and 17 gates kept waiting for a moderator who cannot do
  // research either. A rule that never matches is not conservatism.
  //
  // A revision carries one targetAgent, so a gate with five agents' findings is
  // asked one agent at a time, heaviest load first. Each pass clears one
  // agent's share and the gate returns with the rest, so the queue converges
  // over passes rather than in one shot -- bounded per agent by the
  // resolution-attempt limit, so a gate cannot cycle forever.
  //
  // Ties go to the agent appearing first in the blocker list, which is stable
  // for a given dossier. Still null when nothing names an agent: an
  // unattributed blocker is a decision, not a dispatch.
  function dominantAgentFromBlockers(reasons){
    const single=agentFromBlockers(reasons);
    if(single)return single;
    const counts=blockerCountsByAgent(reasons);
    if(!counts.size)return null;
    let best=null,bestCount=0;
    for(const [agent,count] of counts){
      if(count>bestCount){best=agent;bestCount=count;}
    }
    return best;
  }

  /** Only the blockers the dispatched agent is being asked to answer. */
  function blockersForAgent(reasons,agentId){
    const prefix=String(agentId);
    return (reasons||[]).filter(reason=>{
      const match=/^([A-Za-z][A-Za-z0-9]*)\s*[/:]/.exec(String(reason).trim());
      return Boolean(match)&&match[1]===prefix;
    });
  }

  return {hasRouteGeometryConflict,agentFromBlockers,blockerCountsByAgent,dominantAgentFromBlockers,blockersForAgent};
});
