'use strict';

/**
 * The authoritative sources the hazard watch reads, each declaring its own
 * shape rather than all of them being assumed to be one.
 *
 * `fetchSource` used to hardcode a single format: fetch the url, parse it as an
 * Atom feed, declare the snapshot complete. Three fields per source and no room
 * for a source that is a dated document rather than a live feed, that is only
 * published in winter, or that identifies its area by code rather than by name.
 *
 * A connector therefore says, for itself:
 *
 *   urls(at)   the documents to try, in order -- a feed has one, a dated
 *              bulletin has today's and yesterday's, because the day's edition
 *              is published in the afternoon for the night ahead.
 *   parse      body -> observations.
 *   complete   whether the body arrived whole. Only a complete body may remove
 *              a warning (#682); a partial one may add what it carried.
 *   season     the months it publishes at all, where it is seasonal.
 *
 * Out of season is NOT a failure. An avalanche bulletin does not exist in
 * October, and reporting that as a source failure every three hours teaches an
 * operator to ignore source failures -- which is the one signal in this lane
 * that must never become noise.
 */

const {parseAtomFeed, feedIsComplete, avalancheBoundMetres, avalancheDangerAt,
  AVALANCHE_DANGER_WORDS, AVALANCHE_PUBLISH_FROM} = require('./dynamic-hazards');

function isoDay(at, offsetDays = 0){
  const date = new Date(at);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

/** Whether a seasonal source publishes on this date, inclusive of both ends. */
function inSeason(season, at){
  if(!season) return true;
  const monthDay = new Date(at).toISOString().slice(5, 10);
  const {from, to} = season;
  // A window that wraps the new year, which every snow season does.
  return from <= to ? monthDay >= from && monthDay <= to : monthDay >= from || monthDay <= to;
}

// ---------------------------------------------------------------------------
// Avalanche bulletins, in the CAAML v6 JSON every EAWS service publishes.
// Read against the real 2026-02-25 documents, not written from a schema.
//
//   { bulletins: [{
//       bulletinID, validTime: {startTime, endTime},
//       regions: [{regionID: 'IT-32-BZ-18-02', name: 'Gröden Dolomites'}, …],
//       dangerRatings: [{mainValue: 'moderate', elevation: {upperBound: '1800'},
//                        validTimePeriod: 'all_day'}, …],
//       highlights, avalancheActivity: {highlights, comment} }] }
//
// One bulletin covers several small areas ("micro-regions") and gives a level
// per height band. A walk is matched by the micro-regions its line crosses
// (data/trail-avalanche-regions.json), and the level that counts is the one at
// its own high point -- not the worst band in the bulletin, and not the whole
// province.
// ---------------------------------------------------------------------------

const DANGER_LEVELS = Object.freeze({low:1, moderate:2, considerable:3, high:4, very_high:5});

/** The ratings in a bulletin as numbers with metre bounds. */
function dangerBands(bulletin){
  return (bulletin.dangerRatings || []).map(rating => ({
    level: DANGER_LEVELS[rating.mainValue] || 0,
    from: avalancheBoundMetres(rating.elevation && rating.elevation.lowerBound),
    below: avalancheBoundMetres(rating.elevation && rating.elevation.upperBound),
  })).filter(band => band.level);
}

// Some services write names in capitals ("ALPI CARNICHE OCCIDENTALI").
function regionName(region){
  const name = String(region.name || region.regionID).trim();
  if(name !== name.toUpperCase() || !/[A-Z]/.test(name)) return name;
  return name.toLowerCase().replace(/(^|[\s'(\/-])(\p{L})/gu, (all, lead, letter) => lead + letter.toUpperCase());
}

function bulletinsOf(body){
  let document;
  try{ document = typeof body === 'string' ? JSON.parse(body) : body; }
  catch{ throw new Error('Avalanche source did not return a CAAML bulletin'); }
  if(!document || !Array.isArray(document.bulletins)) throw new Error('Avalanche source did not return a CAAML bulletin');
  return document.bulletins;
}

/** A JSON body that parses with its list of bulletins arrived whole. */
function caamlIsComplete(body){
  try{ return Array.isArray(bulletinsOf(body)); }catch{ return false; }
}

function parseAvalancheBulletins(body, source = {}){
  const areas = source.areas || [];
  const ours = id => !areas.length || areas.some(area => id === area || id.startsWith(`${area}-`));
  return bulletinsOf(body).flatMap(bulletin => {
    // A service's file also carries its neighbours' areas (the South Tyrol
    // bulletin covers parts of Austria); each area is read from its own service.
    const regions = (bulletin.regions || []).filter(region => region && region.regionID && ours(region.regionID))
      .map(region => ({id: region.regionID, name: regionName(region)}));
    const bands = dangerBands(bulletin);
    if(!regions.length || !bands.length) return [];
    const worst = avalancheDangerAt(bands);
    const begins = (bulletin.validTime && bulletin.validTime.startTime) || null;
    const ends = (bulletin.validTime && bulletin.validTime.endTime) || null;
    const activity = bulletin.avalancheActivity || {};
    return [{
      id: `${source.key}:${bulletin.bulletinID}`,
      kind: 'avalanche',
      sourceKey: source.key, sourceLabel: source.label, sourceUrl: source.pageUrl || '',
      identifier: bulletin.bulletinID || `${regions[0].id}:${begins || ''}`,
      event: 'Avalanche danger',
      area: regions.map(region => region.name).join(' / '),
      regions, bands,
      dangerLevel: worst, dangerWord: AVALANCHE_DANGER_WORDS[worst],
      sentAt: (bulletin.publicationTime || begins), effectiveAt: begins,
      // The bulletin's own validity is the expiry, so the existing rule removes
      // it when it lapses and no new removal logic is needed.
      expiresAt: ends,
      summary: activity.highlights || bulletin.highlights || '',
    }];
  });
}

function avalancheConnector({key, label, pageUrl, file, areas, dated}){
  return {
    key, label, kind: 'avalanche-bulletin', areas, pageUrl,
    // Published in the afternoon for the day ahead, so yesterday's edition is
    // still the current one for a morning run.
    urls: at => [dated(isoDay(at), file), dated(isoDay(at, -1), file)],
    // The services start in late November or December and stop in May; the
    // weeks either side are answered as "no bulletin issued" below.
    season: {from: '11-15', to: '05-15'},
    // A dated file that does not exist yet is a bulletin not issued, not a
    // broken service: the 2025 season opened on 20 November (AINEVA) and
    // 1 December (Euregio). It removes nothing.
    missingMeansNoBulletin: true,
    parse: parseAvalancheBulletins,
    complete: caamlIsComplete,
  };
}

const AVALANCHE_CONNECTORS = Object.freeze([
  // Euregio: South Tyrol, Trentino and Tyrol, one service and one file.
  avalancheConnector({
    key: 'avalanche-euregio', label: 'Avalanche.report — Euregio', pageUrl: 'https://avalanche.report/',
    file: 'EUREGIO', areas: ['IT-32-BZ', 'IT-32-TN', 'AT-07'],
    dated: (day, file) => `https://static.avalanche.report/bulletins/${day}/${day}_${file}_en_CAAMLv6.json`,
  }),
  // AINEVA: the other Italian Alpine regions -- Veneto (Belluno), Friuli,
  // Lombardy, Piedmont and Aosta.
  avalancheConnector({
    key: 'avalanche-aineva', label: 'AINEVA', pageUrl: 'https://bollettini.aineva.it/',
    file: 'AINEVA', areas: ['IT-34', 'IT-36', 'IT-25', 'IT-21', 'IT-23'],
    dated: (day, file) => `https://bollettini.aineva.it/albina_files/${day}/${day}_${file}_en_CAAMLv6.json`,
  }),
]);

const CONNECTORS = Object.freeze([
  {
    key: 'meteoalarm-italy', label: 'MeteoAlarm Italy', kind: 'weather-feed',
    urls: () => ['https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-italy'],
    parse: parseAtomFeed, complete: feedIsComplete,
  },
  {
    key: 'meteoalarm-france', label: 'MeteoAlarm France', kind: 'weather-feed',
    urls: () => ['https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-france'],
    parse: parseAtomFeed, complete: feedIsComplete,
  },
  ...AVALANCHE_CONNECTORS,
]);

module.exports = {
  CONNECTORS, AVALANCHE_PUBLISH_FROM,
  isoDay, inSeason, caamlIsComplete, parseAvalancheBulletins, avalancheConnector, dangerBands,
};
