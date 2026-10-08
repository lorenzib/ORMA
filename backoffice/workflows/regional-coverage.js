'use strict';

/**
 * Geographical expansion, as a number rather than a feeling.
 *
 * Scouting produced a *list*: four candidates, every one tagged
 * `existing-area`, ranked by how close it sat to something ORMA already had.
 * A list has no denominator, so no valley could ever be called finished and
 * "where should we go next" had no answer but instinct.
 *
 * The denominator was already in the repository and nothing read it:
 * `regions-config.js` carries the locality-to-valley taxonomy the import
 * pipeline uses, and `backoffice-data/valley-research/` holds a file per valley
 * naming the evidence each one still needs. This joins them to the catalogue.
 *
 * Two axes, deliberately kept apart, because they are two different
 * programmes:
 *
 *   verification coverage -- of the trails we publish in this valley, how many
 *     carry ORMA Verified. This is the catalogue-verification programme's
 *     business.
 *   catalogue depth -- how many trails we publish here at all. A valley with
 *     one trail is not badly verified, it is barely covered, and that is the
 *     expansion programme's business.
 *
 * Reading them as one number is how "28 valleys, 3 verified" and "24 valleys
 * with seven trails or fewer" become the same misleading sentence.
 *
 * Everything here comes from files in the repository, so it costs no Firestore
 * reads and can run in CI.
 */

// Named, in one place, and meant to be argued with. A threshold invented
// silently inside a calculation is not a target anybody agreed.
const DEFAULT_POLICY=Object.freeze({
  // Fewer published trails than this and the valley is thin, whatever its
  // verification share: there is not enough here to be worth a visit.
  thinBelowPublished:5,
  // Share of published trails carrying ORMA Verified for the valley to count
  // as covered rather than merely started.
  coveredAtVerifiedShare:0.5,
});

const UNPLACED='(no valley recorded)';

function round(value){return Math.round(value*100)/100;}

/** Valley for a scouting candidate, from the same lookup the importer uses. */
function candidateValley(candidate,nearestLocality){
  const centre=candidate&&candidate.center;
  if(!Array.isArray(centre)||centre.length<2||typeof nearestLocality!=='function')return null;
  // regions-config stores [lng, lat]; nearestLocality takes (lat, lng).
  const found=nearestLocality(Number(centre[1]),Number(centre[0]));
  return found&&found.valley?found.valley:null;
}

function coverageState(published,verified,policy){
  if(!published)return 'no-trails';
  if(published<policy.thinBelowPublished)return verified?'thin-started':'thin';
  if(!verified)return 'unstarted';
  return verified/published>=policy.coveredAtVerifiedShare?'covered':'started';
}

/**
 * @param options.trails production catalogue records (need `valley`, `ormaVerified`).
 * @param options.valleyResearch the per-valley evidence files, as parsed objects.
 * @param options.scoutingCandidates candidates awaiting selection.
 * @param options.nearestLocality regions-config's lookup, for placing candidates.
 */
function summariseRegionalCoverage(options={}){
  const policy={...DEFAULT_POLICY,...(options.policy||{})};
  const trails=options.trails||[];
  const research=new Map((options.valleyResearch||[]).filter(Boolean).map(file=>[file.valley,file]));
  const candidates=options.scoutingCandidates||[];

  const rows=new Map();
  const row=valley=>{
    if(!rows.has(valley))rows.set(valley,{valley,published:0,verified:0,candidates:0,
      researchFile:false,evidenceStillNeeded:[],closableValleyWide:[],trails:[]});
    return rows.get(valley);
  };

  for(const trail of trails){
    // A trail with no valley is not in any coverage figure, which is worth
    // saying out loud rather than quietly dropping: cinque-torri-assisted is
    // ORMA Verified and invisible to every per-valley number.
    const entry=row(trail.valley||UNPLACED);
    entry.published+=1;
    if(trail.ormaVerified){entry.verified+=1;entry.trails.push(trail.id);}
  }

  for(const candidate of candidates){
    const valley=candidateValley(candidate,options.nearestLocality);
    row(valley||UNPLACED).candidates+=1;
  }

  for(const entry of rows.values()){
    const file=research.get(entry.valley);
    if(file){
      entry.researchFile=true;
      entry.evidenceStillNeeded=Object.keys(file.categoriesNeeded||{});
      // Evidence one source can settle for the whole valley rather than per
      // trail: the cheapest work available in that valley.
      entry.closableValleyWide=[...(file.canCloseHere||[])];
    }
    entry.verifiedShare=entry.published?round(entry.verified/entry.published):0;
    entry.state=coverageState(entry.published,entry.verified,policy);
  }

  const ordered=[...rows.values()].sort((a,b)=>
    b.published-a.published||a.valley.localeCompare(b.valley));
  const placed=ordered.filter(entry=>entry.valley!==UNPLACED);
  const tally=state=>placed.filter(entry=>entry.state===state).length;

  return {
    contractVersion:'1.0.0',
    programme:'geographical-expansion',
    generatedAt:options.at||new Date().toISOString(),
    policy,
    totals:{
      valleys:placed.length,
      published:ordered.reduce((sum,entry)=>sum+entry.published,0),
      verified:ordered.reduce((sum,entry)=>sum+entry.verified,0),
      candidatesAwaitingSelection:ordered.reduce((sum,entry)=>sum+entry.candidates,0),
      covered:tally('covered'),started:tally('started')+tally('thin-started'),
      unstarted:tally('unstarted'),thin:tally('thin')+tally('thin-started'),
    },
    // What stops a valley being measurable at all, named rather than counted.
    gaps:{
      valleysWithoutResearchFile:placed.filter(entry=>!entry.researchFile).map(entry=>entry.valley),
      unplacedTrails:rows.get(UNPLACED)?rows.get(UNPLACED).published:0,
      unplacedVerifiedTrails:rows.get(UNPLACED)?rows.get(UNPLACED).trails:[],
    },
    valleys:ordered,
  };
}

module.exports={DEFAULT_POLICY,UNPLACED,candidateValley,coverageState,summariseRegionalCoverage};
