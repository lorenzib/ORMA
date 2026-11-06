(function (global) {
  'use strict';

  // Script-written wording goes through i18n.js; the English sentence is its own key.
  function tx(text, vars) {
    const i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
    if (i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
    return vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : text;
  }

  // The words for a walk's season (trail.season, from data/trail-seasons.json),
  // shared by the static trail page and the app so the two say the same thing.
  // Each answer names its kind: the board's months are the board's, a snow
  // estimate says it is one, and winter use is read off the map.
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // Ski runs open with the snow; the boards publish no season for a piste, so
  // this is the usual Dolomites ski season and is said to be an estimate.
  const WINTER_SPORT_MONTHS = [12, 1, 2, 3, 4];

  const monthName = m => tx(MONTH_NAMES[m - 1]);
  // From the month's name in the reader's language: giugno and luglio are G and L.
  const monthInitial = m => monthName(m).charAt(0).toUpperCase();
  // "2026-11-06" -> "6 November 2026", in either language.
  function readOn(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return match ? `${Number(match[3])} ${monthName(Number(match[2]))} ${match[1]}` : String(iso || '');
  }

  // [5,6,7,8,9,10] -> "from May to October"; a run that crosses New Year
  // ([12,1,2]) reads as one run, "from December to February".
  function monthRange(months) {
    const set = new Set(months);
    if (set.size === 12) return tx('all year');
    const runs = [];
    for (let m = 1; m <= 12; m += 1) {
      if (!set.has(m) || set.has(m === 1 ? 12 : m - 1)) continue;
      let end = m;
      while (set.has(end === 12 ? 1 : end + 1)) end = end === 12 ? 1 : end + 1;
      runs.push(end === m ? tx('in {month}', { month: monthName(m) }) : tx('from {from} to {to}', { from: monthName(m), to: monthName(end) }));
    }
    return runs.join(tx(' and '));
  }

  const KIND_SENTENCES = {
    downhill: 'In winter, {km} km of this walk is a ski run{names}.',
    sled: 'In winter, {km} km of this walk is a sled run{names}.',
    nordic: 'In winter, {km} km of this walk is a cross-country ski track{names}.',
  };

  function describe(season, formatNumber) {
    if (!season || typeof season !== 'object') return null;
    const fmt = typeof formatNumber === 'function' ? formatNumber : value => value;
    const out = { kind: null, strip: [], line: '', source: null, winter: [], winterNote: '', winterSource: '' };
    if (season.recommended) {
      const good = new Set(season.recommended.months);
      out.kind = 'recommended';
      out.strip = MONTH_NAMES.map((name, i) => ({ month: i + 1, initial: monthInitial(i + 1), name: monthName(i + 1), state: good.has(i + 1) ? 'good' : 'off' }));
      out.line = tx('Recommended {range}.', { range: monthRange(season.recommended.months) });
      out.source = {
        before: tx('Source: '),
        label: tx(season.recommended.source.label),
        url: season.recommended.source.url,
        after: tx(', read on {date}.', { date: readOn(season.recommended.source.accessedAt) }),
      };
      out.legend = [['good', tx('Recommended')], ['off', tx('Outside the season')]];
    } else if (season.snow) {
      const snowy = new Set(season.snow.months);
      out.kind = 'snow';
      out.strip = MONTH_NAMES.map((name, i) => ({ month: i + 1, initial: monthInitial(i + 1), name: monthName(i + 1), state: snowy.has(i + 1) ? 'snow' : 'good' }));
      out.line = season.snow.likelihood === 'likely'
        ? tx('Snow is likely here {range}.', { range: monthRange(season.snow.months) })
        : tx('Snow is possible here {range}.', { range: monthRange(season.snow.months) });
      out.source = {
        before: tx('Estimated from the walk’s high point ({alt} m). No tourist board publishes this walk’s season, and every winter is different.', { alt: fmt(season.snow.highPoint) }),
      };
      out.legend = [['good', tx('Usually snow-free')], ['snow', season.snow.likelihood === 'likely' ? tx('Snow likely') : tx('Snow possible')]];
    }
    for (const use of season.winterUse || []) {
      const names = use.names && use.names.length ? ` (${use.names.join(', ')})` : '';
      out.winter.push(tx(KIND_SENTENCES[use.kind], { km: fmt(use.km), names }));
    }
    if (out.winter.length) {
      out.winterNote = tx('Expect skiers there while the runs are open, usually from December to April (an estimate).');
      out.winterSource = tx('Read off the map (OpenStreetMap).');
    }
    return out;
  }

  // What this month means for the walk, in one sentence, or '' when there is
  // nothing to say. month is 1-12.
  function nowNote(season, month) {
    if (!season || !month) return '';
    const name = monthName(month);
    const notes = [];
    if (season.recommended) {
      notes.push(season.recommended.months.includes(month)
        ? tx('{month} is in this walk’s season.', { month: name })
        : tx('{month} is outside the season the board publishes for this walk.', { month: name }));
    } else if (season.snow && season.snow.months.includes(month)) {
      notes.push(season.snow.likelihood === 'likely'
        ? tx('In {month} snow is likely on this walk.', { month: name })
        : tx('In {month} snow is possible on this walk.', { month: name }));
    }
    if ((season.winterUse || []).length && WINTER_SPORT_MONTHS.includes(month)) {
      notes.push(tx('Parts of it are likely to be ski runs or tracks now.'));
    }
    return notes.join(' ');
  }

  // Whether this month is one to warn about: outside the board's season, snowy
  // by the estimate, or a month the pistes on the line are likely in use.
  function outOfSeason(season, month) {
    if (!season || !month) return false;
    if (season.recommended && !season.recommended.months.includes(month)) return true;
    if (!season.recommended && season.snow && season.snow.likelihood === 'likely' && season.snow.months.includes(month)) return true;
    return (season.winterUse || []).length > 0 && WINTER_SPORT_MONTHS.includes(month);
  }

  const api = { MONTH_NAMES, WINTER_SPORT_MONTHS, monthRange, describe, nowNote, outOfSeason };
  global.DoloPawsTrailSeasonWords = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
