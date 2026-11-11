'use strict';

// Seasonal risks to dogs (pine processionary caterpillars, ticks, cows on the
// pastures, heat in the valleys, salt on the roads), from data/dog-seasons.json. Each risk carries the months its
// sources give and a rule saying which walks it reaches: the region, the
// province or valley, the walk's lowest point, words in the walk's own
// text, its heat rating, or words in its surface description. A walk the rule reaches gets the risk in trail.season.dogSeasons:
//
//   { kind, months, estimate?, sources: [{ label, url, accessedAt }] }
//
// A walk without a risk is one the rule does not reach, not one shown to be
// free of it, which is why the pages only ever say when a risk applies.

const KINDS = ['caterpillars', 'ticks', 'cows', 'heat', 'salt'];

function validateRisk(kind, risk){
  if(!KINDS.includes(kind)) throw new Error(`Dog season ${kind} is not one the pages know how to word`);
  if(!Array.isArray(risk.months) || !risk.months.length || !risk.months.every(m => Number.isInteger(m) && m >= 1 && m <= 12)){
    throw new Error(`Dog season ${kind} has bad months`);
  }
  if(!risk.rule || !Array.isArray(risk.rule.regions) || !risk.rule.regions.length) throw new Error(`Dog season ${kind} names no region`);
  if(!Array.isArray(risk.sources) || !risk.sources.length) throw new Error(`Dog season ${kind} has no source`);
  for(const source of risk.sources){
    if(!/^https:\/\//.test(source.url || '') || !source.label) throw new Error(`Dog season ${kind} has a source without a label or url`);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(source.accessedAt || '')) throw new Error(`Dog season ${kind} has a source without a read-on date`);
  }
}

function lowPoint(trail){
  const profile = Array.isArray(trail.elevationProfile) ? trail.elevationProfile.map(p => Number(p.elev)).filter(Number.isFinite) : [];
  return profile.length ? Math.min(...profile) : null;
}

// The walk's own words about itself, for a rule that reads them.
function ownText(trail){
  return [trail.desc, trail.tips, trail.dogNotes, trail.shadeDescription, trail.terrainDescription, ...(trail.surfaceHazards || [])]
    .filter(value => typeof value === 'string').join(' ');
}

function reaches(rule, trail){
  if(!rule.regions.includes(trail.region)) return false;
  const places = [...(rule.provinces || []).map(p => trail.province === p), ...(rule.valleys || []).map(v => trail.valley === v)];
  if(places.length && !places.some(Boolean)) return false;
  if(rule.lowPointAtMostM !== undefined){
    const low = lowPoint(trail);
    if(low === null || low > rule.lowPointAtMostM) return false;
  }
  if(rule.textMentions && !new RegExp(rule.textMentions, 'i').test(ownText(trail))) return false;
  // The walk's own heat rating (trail.heatRisk: low, moderate, high).
  if(rule.heatRisk && !rule.heatRisk.includes(trail.heatRisk)) return false;
  // Words in the surface description alone (trail.terrainType), so a road
  // named in the walk's story does not count as one underfoot.
  if(rule.surfaceMentions && !new RegExp(rule.surfaceMentions, 'i').test(String(trail.terrainType || ''))) return false;
  return true;
}

function applyDogSeasons(trails, artifact){
  const risks = (artifact && artifact.risks) || {};
  Object.entries(risks).forEach(([kind, risk]) => validateRisk(kind, risk));
  return trails.map(trail => {
    const dogSeasons = KINDS.filter(kind => risks[kind] && reaches(risks[kind].rule, trail)).map(kind => {
      const risk = risks[kind];
      return {
        kind,
        months: risk.months.slice(),
        ...(risk.estimate ? { estimate: true } : {}),
        // A source that speaks for one province or valley is cited only there.
        sources: risk.sources
          .filter(source => !source.appliesTo || reaches({ regions: [trail.region], ...source.appliesTo }, trail))
          .map(({ label, url, accessedAt }) => ({ label, url, accessedAt })),
      };
    });
    if(!dogSeasons.length) return trail;
    return { ...trail, season: { ...(trail.season || {}), dogSeasons } };
  });
}

module.exports = { applyDogSeasons, KINDS };
