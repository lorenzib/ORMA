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

const {parseAtomFeed, feedIsComplete} = require('./dynamic-hazards');

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
// Avalanche bulletins — avalanche.report (ALBINA), the joint Tyrol / South
// Tyrol / Trentino service. CAAML v5 EAWS profile, verified against the real
// 2026-02-25 IT-32-BZ document rather than written from a schema.
//
// Structure actually used:
//   <ObsCollection><observations>
//     <Bulletin gml:id="…">
//       <validTime><TimePeriod><beginPosition>…</beginPosition>
//                               <endPosition>…</endPosition>
//       <BulletinMeasurements>
//         <avActivityHighlights>…</avActivityHighlights>
//         <DangerRating><mainValue>1..5</mainValue></DangerRating>
//       <locRef xlink:href="IT-32-BZ-05-03"/>
// ---------------------------------------------------------------------------

// ORMA's trails are valley dog walks, not backcountry ski terrain, so a
// moderate rating is not news for them and publishing every bulletin would
// bury the warnings that matter. 4 (high) and 5 (very high) are the levels at
// which conditions reach the kind of ground ORMA sends people to.
const AVALANCHE_PUBLISH_FROM = 4;
const DANGER_WORDS = Object.freeze({1:'low', 2:'moderate', 3:'considerable', 4:'high', 5:'very high'});

function tagText(xml, name){
  const match = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i').exec(xml);
  return match ? match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

function caamlIsComplete(xml){
  return typeof xml === 'string' && /<\/ObsCollection\s*>\s*$/i.test(xml.trim());
}

function parseAvalancheBulletin(xml, source = {}){
  if(typeof xml !== 'string' || !/<ObsCollection\b/i.test(xml)){
    throw new Error('Avalanche source did not return a CAAML bulletin');
  }
  return [...xml.matchAll(/<Bulletin\b([^>]*)>([\s\S]*?)<\/Bulletin>/gi)].flatMap(match => {
    const body = match[2];
    const regionCode = (/<locRef\b[^>]*xlink:href=["']([^"']+)["']/i.exec(body) || [])[1] || '';
    // The highest band's rating: a bulletin carries one per elevation range and
    // the walk could be in any of them.
    const ratings = [...body.matchAll(/<mainValue>\s*(\d)\s*<\/mainValue>/gi)].map(hit => Number(hit[1]));
    const danger = ratings.length ? Math.max(...ratings) : 0;
    if(!regionCode || !danger) return [];
    const begins = tagText(body, 'beginPosition') || null;
    const ends = tagText(body, 'endPosition') || null;
    const headline = tagText(body, 'avActivityHighlights');
    return [{
      // Keyed on the region and the day, so re-reading the same bulletin
      // reconciles onto the same warning rather than duplicating it.
      id: `${source.key}:${regionCode}:${(begins || '').slice(0, 10)}`,
      sourceKey: source.key, sourceLabel: source.label, sourceUrl: source.pageUrl || '',
      identifier: `${regionCode}:${begins || ''}`,
      // The event is the kind of hazard, not its level: the display template
      // reads "An official <severity> <event> warning", and "severe avalanche
      // danger high warning" is not a sentence. The level travels in severity,
      // in dangerLevel and in the bulletin's own summary.
      event: 'Avalanche danger',
      // Both a code for matching and a name for reading.
      area: regionCode, regionCode,
      severity: danger >= 5 ? 'extreme' : 'severe',
      certainty: 'likely', urgency: 'expected',
      dangerLevel: danger,
      sentAt: begins, effectiveAt: begins,
      // The bulletin's own validity is the expiry, so the existing rule removes
      // it when it lapses and no new removal logic is needed.
      expiresAt: ends,
      title: `Avalanche danger ${DANGER_WORDS[danger] || danger} — ${regionCode}`,
      dangerWord: DANGER_WORDS[danger] || String(danger),
      summary: headline,
    }];
  }).filter(observation => observation.dangerLevel >= AVALANCHE_PUBLISH_FROM);
}

function avalancheConnector(key, label, regionCode){
  return {
    key, label, kind: 'avalanche-bulletin', regionCode,
    pageUrl: 'https://avalanche.report/',
    // Published in the afternoon for the night ahead, so yesterday's edition is
    // still the current one for a morning run.
    urls: at => [
      `https://avalanche.report/bulletins/${isoDay(at)}/${isoDay(at)}_${regionCode}_en.xml`,
      `https://avalanche.report/bulletins/${isoDay(at, -1)}/${isoDay(at, -1)}_${regionCode}_en.xml`,
    ],
    // Declared, not promised: the service's own window is not published as data,
    // and the newest bulletin seen while building this was 2026-04-07.
    season: {from: '11-15', to: '05-15'},
    parse: parseAvalancheBulletin,
    complete: caamlIsComplete,
  };
}

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
  avalancheConnector('avalanche-south-tyrol', 'Avalanche.report — South Tyrol', 'IT-32-BZ'),
  avalancheConnector('avalanche-trentino', 'Avalanche.report — Trentino', 'IT-32-TN'),
]);

module.exports = {
  CONNECTORS, AVALANCHE_PUBLISH_FROM, DANGER_WORDS,
  isoDay, inSeason, caamlIsComplete, parseAvalancheBulletin, avalancheConnector,
};
