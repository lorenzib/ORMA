// One answer to "what is the weather doing for this trail, for scoring".
//
// A match percentage is a promise that the same dog on the same trail gets the
// same number wherever it is read. It did not. Five surfaces passed today's
// conditions to the engine and eight did not, so the engine reported conditions
// as not included and returned the ignore-the-day score instead. Across
// representative dogs, trails and weather the two answers differ in about a
// third of cases, by a median of 10 points and as much as 25 -- and in some of
// those the verdict word changes too, so one screen says "Strong option" while
// another says "Possible with cautions" about the same walk on the same day.
//
// Worst of it was on one page: trail.js and trail-blueprint.js ship in the same
// bundle and paint three personal-match numbers on a trail page, of which only
// the ring included the day.
//
// The two sources were never in conflict about meaning -- both end in
// weatherWindow.scoringConditions, which applies the shared expiry -- only about
// which snapshot they hold. So this picks between them rather than replacing
// them, and every caller asks the same question the same way.
(function(root, factory){
  const api = factory(root);
  if(typeof module === 'object' && module.exports) module.exports = api;
  if(root) root.ORMAScoringConditions = api;
})(typeof window !== 'undefined' ? window : globalThis, function(root){
  'use strict';

  // A page that fetched one forecast knows which trail it was for. Without
  // that, a trail page would hand its own valley's weather to the nearby picks
  // beside it, which are different trails at different altitudes -- a wrong
  // number rather than an absent one.
  let declaredTrailId = null;
  let declaredConditions = null;

  function declareForTrail(trailId, conditions){
    declaredTrailId = trailId == null ? null : String(trailId);
    declaredConditions = conditions || null;
  }

  function reset(){
    declaredTrailId = null;
    declaredConditions = null;
  }

  /**
   * Conditions for scoring `trail`, or undefined when the day is not known for
   * it. Undefined is a real answer: the engine reports conditions as not
   * included and says so on the card, which is honest. Handing over another
   * trail's forecast to avoid an undefined would not be.
   *
   * An area forecast wins over a single declared one because it is computed per
   * trail, altitude included, and answers for any trail rather than one.
   */
  function forTrail(trail){
    const scope = root || {};
    const area = scope.DoloPawsHomeConditions;
    if(area && typeof area.forTrail === 'function'){
      const found = area.forTrail(trail);
      if(found) return found;
    }
    const id = trail && trail.id != null ? String(trail.id) : null;
    if(declaredConditions && id && id === declaredTrailId) return declaredConditions;
    return undefined;
  }

  return { forTrail, declareForTrail, reset };
});
