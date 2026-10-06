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

  return {hasRouteGeometryConflict,agentFromBlockers};
});
