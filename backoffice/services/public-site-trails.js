'use strict';

// A public trail page requires both card and hero artwork. The 22 catalogue
// drafts without them are intentionally absent from the generated site; using
// this boundary keeps the requested existing-site backfill at the 140 records
// customers can currently open, without accidentally publishing draft intake.
function isCurrentSiteTrail(trail){
  return Boolean(trail&&trail.publicRecordPresent!==false
    &&String(trail.imageIcon||'').trim()&&String(trail.heroImage||'').trim());
}

function currentSiteTrails(trails){return (trails||[]).filter(isCurrentSiteTrail);}

module.exports={isCurrentSiteTrail,currentSiteTrails};
