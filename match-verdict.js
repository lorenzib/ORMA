// What a match score is called, in one place.
//
// The same trail read three ways: "Great match" on browse at 75, "Good" in the
// homepage search at 65, "Possible with cautions" on the homepage list at 60.
// Three vocabularies and three sets of cut-offs for one number, so a trail
// scoring 80 gave a different answer depending on which screen you were on.
//
// Worse than the wording: browse derived its verdict from the score alone, and
// the score alone does not carry what the engine decided. recommendTrail
// downgrades a strong option to "possible with cautions" when a category ORMA
// has not reviewed is one that matters, and caps a prohibited route at 5. A
// verdict rebuilt from the number loses the first of those, so browse could
// call a trail a great match on evidence the engine had already judged too thin
// to say so.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.OrmaMatchVerdict=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  // The engine's own categories, said the way a walker decides: what to do,
  // not how well the trail did.
  const VERDICTS=Object.freeze({
    'strong-option':{category:'strong-option',label:'Strong option',color:'#4A7856',tone:'great'},
    'possible-with-cautions':{category:'possible-with-cautions',label:'Possible with cautions',color:'#A96F1D',tone:'good'},
    'not-recommended':{category:'not-recommended',label:'Not recommended',color:'#9C3A25',tone:'check'},
  });

  // Matches recommendation-v1.js. Only reached when a caller has a bare score,
  // which is a caller that cannot see hard stops or unreviewed evidence.
  const STRONG_AT=85;
  const POSSIBLE_AT=60;

  function categoryForScore(score){
    const value=Number(score);
    if(!Number.isFinite(value))return 'not-recommended';
    return value>=STRONG_AT?'strong-option':value>=POSSIBLE_AT?'possible-with-cautions':'not-recommended';
  }

  /**
   * The verdict for a recommendation, or for a bare score where that is all a
   * caller has. The engine's category always wins: it already accounts for a
   * prohibition and for evidence too thin to reassure on.
   */
  function verdictFor(input){
    const recommendation=input&&typeof input==='object'?input:null;
    const score=recommendation
      ? (Number.isFinite(recommendation.score)?recommendation.score:null)
      : (Number.isFinite(Number(input))?Number(input):null);
    const declared=recommendation&&VERDICTS[recommendation.category]?recommendation.category:null;
    const verdict=VERDICTS[declared||categoryForScore(score)];
    return {...verdict,score:Number.isFinite(score)?score:null};
  }

  return {VERDICTS,STRONG_AT,POSSIBLE_AT,categoryForScore,verdictFor};
});
