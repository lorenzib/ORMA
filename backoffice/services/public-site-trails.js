'use strict';

// A public trail page requires both card and hero artwork. The catalogue
// records without them are intentionally absent from the generated site; using
// this boundary keeps the existing-site backfill at the 140 records customers
// can currently open, without accidentally publishing draft intake.
//
// Artwork is the only test here, and it is not the same thing as publication.
// Those two sets were once the same 22 records, which is why this comment used
// to name the drafts; after the OSM member-role fix the drafts are 7 while 23
// records still have no artwork. A trail can therefore pass publication
// validation and still, correctly, not be on the site.
function isCurrentSiteTrail(trail){
  return Boolean(trail&&trail.publicRecordPresent!==false
    &&String(trail.imageIcon||'').trim()&&String(trail.heroImage||'').trim());
}

function currentSiteTrails(trails){return (trails||[]).filter(isCurrentSiteTrail);}

module.exports={isCurrentSiteTrail,currentSiteTrails};
