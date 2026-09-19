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

  // How completely a trail is known, said calmly. Confidence describes the data
  // ORMA holds, not how dangerous the walk is, so "low" must not read as a
  // warning -- missing evidence never lowers a score, it only widens what the
  // score cannot promise.
  //
  // The homepage said "High confidence / Moderate confidence / Limited data"
  // from a table of its own, untranslated, while the trail page said "Based on
  // detailed trail data" from another. Two vocabularies for one field, and one
  // of them read as a verdict on the trail rather than on the evidence.
  const CONFIDENCE_LEVELS=Object.freeze(['high','medium','low']);
  const CONFIDENCE_LABELS=Object.freeze({
    high:'Based on detailed trail data',
    medium:'Based on available trail data',
    low:'Based on partial data',
  });

  /**
   * The words for a confidence level, translated where a dictionary is loaded.
   * An unknown level has no words: a level nobody set is not "low", and saying
   * so would invent a caveat out of a missing field.
   */
  function confidenceLabel(level,translate){
    const key=String(level==null?'':level).trim().toLowerCase();
    const fallback=CONFIDENCE_LABELS[key];
    if(!fallback)return '';
    if(typeof translate==='function'){
      const value=translate(`recommendation.confidence.${key}`);
      if(value&&value!==`recommendation.confidence.${key}`)return value;
    }
    return fallback;
  }

  // How well a verdict is known, in one line instead of two.
  //
  // Confidence next to "ORMA route-audited" says the same thing twice: an
  // audited route is the confident case, so the words only earn their place
  // when they qualify it. Saying nothing where there is nothing to add is what
  // leaves room for the caveat to be noticed when there is.
  //
  // It takes the level, not a rendered string. Deciding whether to show the
  // words meant matching the words, so the rule lived in one file and the
  // wording in another, and changing the wording silently switched the rule
  // off.
  function evidenceLine(parts){
    const provenance=String(parts&&parts.provenance||'').trim();
    const level=String(parts&&parts.confidence||'').trim().toLowerCase();
    const checked=String(parts&&parts.checkedLabel||'').trim();
    const qualifies=CONFIDENCE_LEVELS.includes(level)&&level!=='high';
    const confidence=qualifies?confidenceLabel(level,parts&&parts.translate):'';
    return [provenance,confidence,checked].filter(Boolean).join(' · ');
  }

  return {VERDICTS,STRONG_AT,POSSIBLE_AT,CONFIDENCE_LEVELS,CONFIDENCE_LABELS,
    categoryForScore,verdictFor,confidenceLabel,evidenceLine};
});
