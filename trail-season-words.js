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
  // A winter walk (season.winterWalk) is the board's winter tour of a path: it
  // is offered only from November to April, whatever else its board lists.
  const WINTER_WALK_MONTHS = [11, 12, 1, 2, 3, 4];

  const monthName = m => tx(MONTH_NAMES[m - 1]);
  // From the month's name in the reader's language: giugno and luglio are G and L.
  const monthInitial = m => monthName(m).charAt(0).toUpperCase();
  // "2026-11-06" -> "6 November 2026", in either language.
  function readOn(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return match ? `${Number(match[3])} ${monthName(Number(match[2]))} ${match[1]}` : String(iso || '');
  }

  // "05-30" -> "30 May", in either language.
  function dayMonth(md) {
    const [month, day] = String(md || '').split('-').map(Number);
    return month && day ? `${day} ${monthName(month)}` : String(md || '');
  }

  // The lifts the walk rides (trail.season.lifts, from data/lift-seasons.json):
  // a lift the walk needs makes the months it is shut out of season.
  const requiredLifts = season => ((season && season.lifts) || []).filter(lift => lift.required);
  const liftShut = (lift, month) => (lift.shutMonths || []).includes(month);
  // Roads shut in winter that are the only drive to the start
  // (trail.season.roads, from data/road-seasons.json): like a needed lift, the
  // months a road is shut are out of season.
  const roadsOf = season => (season && season.roads) || [];
  const roadShut = (season, month) => roadsOf(season).some(road => (road.shutMonths || []).includes(month));
  const PART_WORDS = { early: 'early {month}', mid: 'mid-{month}', late: 'late {month}' };
  const partMonth = point => tx(PART_WORDS[point.part], { month: monthName(point.month) });
  // "The Tre Cime toll road is usually open from late May to late October."
  function roadLine(road) {
    return tx('The {road} is usually open from {from} to {to}.', { road: tx(road.name), from: partMonth(road.usually.from), to: partMonth(road.usually.to) });
  }

  // "The Col Raiser gondola runs from 30 May to 1 November and from 6 December
  // to 6 April (2025/26 dates)."
  function liftLine(lift) {
    if (lift.allYear) return tx('The {lift} runs all year ({year}), apart from closures the operator announces.', { lift: lift.name, year: lift.datesFor });
    const runs = lift.periods.map(p => tx('from {from} to {to}', { from: dayMonth(p.from), to: dayMonth(p.to) })).join(tx(' and '));
    if (lift.winterOnly) return tx('The {lift} runs {runs} ({year} dates; summer dates not yet published).', { lift: lift.name, runs, year: lift.datesFor });
    return lift.summerOnly
      ? tx('The {lift} runs {runs} ({year} dates; winter dates not yet published).', { lift: lift.name, runs, year: lift.datesFor })
      : tx('The {lift} runs {runs} ({year} dates).', { lift: lift.name, runs, year: lift.datesFor });
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

  // Seasonal risks to dogs (trail.season.dogSeasons, from data/dog-seasons.json):
  // a tag in the months they apply and a line under "When to go" with the source.
  const DOG_SEASON_TAGS = { caterpillars: 'Caterpillar season', ticks: 'Tick season', cows: 'Cows on the pastures', heat: 'Hot months', salt: 'Salted roads' };
  const DOG_SEASON_SENTENCES = {
    caterpillars: '{range}: pine processionary caterpillars come down from the pines below about {alt} m, and they are a danger to dogs. Keep your dog away from pines and from the caterpillars.',
    ticks: '{range}: ticks in the woods below about {alt} m, most of all from late May to mid-June. Check your dog after the walk.',
    cows: '{range} (an estimate): cows may be out on the pastures. Keep your dog close and give the herds a wide berth.',
    heat: '{range}: the valleys are hot, with average daily highs of about 30 °C in Bozen. Dogs bear heat badly: walk early in the morning or in the evening, and carry water.',
    salt: '{range} (an estimate): the roads and lanes on this walk may be salted when they ice over. Salt hurts dogs’ paws: check them after the walk and rinse them with warm water.',
  };
  const DOG_SEASON_ALT = { caterpillars: 1400, ticks: 1200 };
  // [3,4,5,6] -> "March to June"; the risks' months are one run each, and a
  // run across New Year ([12,1,2]) reads "December to February".
  function monthSpan(months) {
    const set = new Set(months);
    const prev = m => (m === 1 ? 12 : m - 1);
    const next = m => (m === 12 ? 1 : m + 1);
    const start = months.find(m => !set.has(prev(m))) || Math.min(...months);
    let end = start;
    while (set.has(next(end)) && next(end) !== start) end = next(end);
    return start === end ? monthName(start) : tx('{from} to {to}', { from: monthName(start), to: monthName(end) });
  }
  // "da marzo a giugno: …" opens a sentence: capital first letter.
  const capitalise = text => text.charAt(0).toUpperCase() + text.slice(1);
  // The risks that apply this month, as tags: [{ kind, label }].
  function dogSeasonsNow(season, month) {
    return ((season && season.dogSeasons) || [])
      .filter(risk => DOG_SEASON_TAGS[risk.kind] && risk.months.includes(month))
      .map(risk => ({ kind: risk.kind, label: tx(DOG_SEASON_TAGS[risk.kind]) }));
  }

  function describe(season, formatNumber) {
    if (!season || typeof season !== 'object') return null;
    const fmt = typeof formatNumber === 'function' ? formatNumber : value => value;
    const out = { kind: null, strip: [], line: '', source: null, winter: [], winterNote: '', winterSource: '', lifts: [] };
    if (season.recommended) {
      const good = new Set(season.recommended.months);
      out.kind = 'recommended';
      out.strip = MONTH_NAMES.map((name, i) => ({ month: i + 1, initial: monthInitial(i + 1), name: monthName(i + 1), state: good.has(i + 1) ? 'good' : 'off' }));
      out.line = tx('Recommended {range}.', { range: monthRange(season.recommended.months) });
      if (season.winterWalk) {
        const winter = winterWalkMonths(season.recommended.months);
        out.strip.forEach(m => { m.state = winter.includes(m.month) ? 'good' : 'off'; });
        out.line = tx('A winter walk, recommended {range}.', { range: monthRange(winter) });
      }
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
    // Months a needed lift is shut are marked on the strip whatever the board
    // or the snow says: without the lift the walk as described is not there.
    const needed = requiredLifts(season);
    if (needed.length && out.strip.length) {
      let marked = false;
      out.strip.forEach(m => {
        if (needed.some(lift => liftShut(lift, m.month))) { m.state = 'lift'; marked = true; }
      });
      if (marked) out.legend.push(['lift', tx('Lift not running')]);
    }
    if (roadsOf(season).length && out.strip.length) {
      let marked = false;
      out.strip.forEach(m => {
        if (m.state !== 'lift' && roadShut(season, m.month)) { m.state = 'road'; marked = true; }
      });
      if (marked) out.legend.push(['road', tx('Road closed')]);
    }
    // A key for a state no month shows any more (snow months the road covers) goes.
    if (out.legend) out.legend = out.legend.filter(([state]) => out.strip.some(m => m.state === state));
    out.lifts = ((season.lifts) || []).map(lift => ({
      line: [
        liftLine(lift),
        lift.required
          ? (lift.climbM ? tx('The walk needs it; when it is shut, the {m} m it covers are on foot, if a path allows.', { m: fmt(lift.climbM) }) : tx('The walk needs it.'))
          : tx('The walk does not need it.'),
      ].join(' '),
      source: {
        before: tx('Source: '),
        label: lift.operator || lift.name,
        url: lift.url,
        after: tx(', read on {date}.', { date: readOn(lift.accessedAt) }),
      },
    }));
    out.lifts = out.lifts.concat(roadsOf(season).map(road => ({
      line: [roadLine(road), tx('The walk starts at the end of it; while it is shut, there is no drive to the start.')].join(' '),
      source: {
        before: tx('Source: '),
        label: road.operator || road.name,
        url: road.url,
        after: tx(', read on {date}.', { date: readOn(road.accessedAt) }),
      },
    })));
    for (const use of season.winterUse || []) {
      const names = use.names && use.names.length ? ` (${use.names.join(', ')})` : '';
      out.winter.push(tx(KIND_SENTENCES[use.kind], { km: fmt(use.km), names }));
    }
    if (out.winter.length) {
      out.winterNote = tx('Expect skiers there while the runs are open, usually from December to April (an estimate).');
      out.winterSource = tx('Read off the map (OpenStreetMap).');
    }
    out.dogSeasons = ((season.dogSeasons) || []).map(risk => ({
      kind: risk.kind,
      line: capitalise(tx(DOG_SEASON_SENTENCES[risk.kind], { range: monthSpan(risk.months), alt: fmt(DOG_SEASON_ALT[risk.kind] || 0) })),
      sources: risk.sources.map(source => ({
        label: tx(source.label),
        url: source.url,
        after: tx(', read on {date}.', { date: readOn(source.accessedAt) }),
      })),
    }));
    return out;
  }

  // What this month means for the walk, in one sentence, or '' when there is
  // nothing to say. month is 1-12.
  function nowNote(season, month) {
    if (!season || !month) return '';
    const name = monthName(month);
    const notes = [];
    // A board month the walk's lift is shut is not "in season": the lift's
    // sentence below says why, and the two would contradict each other.
    const liftOut = requiredLifts(season).some(lift => liftShut(lift, month)) || roadShut(season, month);
    if (season.winterWalk && !WINTER_WALK_MONTHS.includes(month)) {
      notes.push(tx('{month} is outside winter, and this is the winter walk.', { month: name }));
    } else if (season.recommended && !(liftOut && season.recommended.months.includes(month))) {
      notes.push(season.recommended.months.includes(month)
        ? tx('{month} is in this walk’s season.', { month: name })
        : tx('{month} is outside the season the board publishes for this walk.', { month: name }));
    } else if (season.snow && season.snow.months.includes(month)) {
      notes.push(season.snow.likelihood === 'likely'
        ? tx('In {month} snow is likely on this walk.', { month: name })
        : tx('In {month} snow is possible on this walk.', { month: name }));
    }
    for (const lift of (season.lifts || [])) {
      if (!liftShut(lift, month)) continue;
      notes.push(lift.required
        ? tx('In {month} the {lift} is not running, and the walk needs it.', { month: name, lift: lift.name })
        : tx('In {month} the {lift} is not running; the walk does not need it.', { month: name, lift: lift.name }));
    }
    for (const road of roadsOf(season)) {
      if ((road.shutMonths || []).includes(month)) notes.push(tx('In {month} the {road} is closed, and the walk starts at the end of it.', { month: name, road: tx(road.name) }));
    }
    if ((season.winterUse || []).length && WINTER_SPORT_MONTHS.includes(month)) {
      notes.push(tx('In {month}, parts of it are likely to be ski runs or tracks.', { month: name }));
    }
    return notes.join(' ');
  }

  // The months that suit the walk: the board's months, else the months the
  // estimate keeps free of snow; with ski runs on the line, less the months
  // those are usually open (unless that leaves nothing, as for a winter walk);
  // and less the months a lift or road the walk needs is shut.
  // null when the walk has no season record.
  function winterWalkMonths(months) {
    const winter = (months || []).filter(m => WINTER_WALK_MONTHS.includes(m));
    return winter.length ? winter : WINTER_WALK_MONTHS.slice();
  }

  function bestMonths(season) {
    if (!season || typeof season !== 'object') return null;
    if (season.winterWalk) {
      return winterWalkMonths(season.recommended ? season.recommended.months : null).sort((a, b) => a - b);
    }
    if (!season.recommended && !season.snow && !(season.winterUse || []).length) return null;
    let months = season.recommended
      ? season.recommended.months.slice()
      : MONTH_NAMES.map((_, i) => i + 1).filter(m => !(season.snow && season.snow.months.includes(m)));
    if ((season.winterUse || []).length) {
      const summer = months.filter(m => !WINTER_SPORT_MONTHS.includes(m));
      if (summer.length) months = summer;
    }
    // Less the months a needed lift or road is shut. If that left nothing
    // the data would be wrong for this walk, so it is not applied.
    const needed = requiredLifts(season);
    if (needed.length || roadsOf(season).length) {
      const running = months.filter(m => !needed.some(lift => liftShut(lift, m)) && !roadShut(season, m));
      if (running.length) months = running;
    }
    return months.length ? months.sort((a, b) => a - b) : null;
  }

  // Out of season: this month is not one of the walk's best months. The one
  // rule behind the "Out of season" tag, the trail page's Season caution and
  // the match score, so they never disagree.
  function outOfSeason(season, month) {
    const best = bestMonths(season);
    return Boolean(best && month && !best.includes(month));
  }

  // A high-mountain walk is not offered while it is out of season: it stays off
  // the trail list, the map, the homepage and the collections. Its own page
  // still opens from a saved walk or a link, and says it is out of season.
  // High means it runs along a ski or sled run, or climbs to 1,800 m or more.
  // Cross-country tracks don't count: they are beside the path, not on it.
  // A winter walk sits out the rest of the year the same way.
  const HIGH_MOUNTAIN_M = 1800;
  function hiddenThisMonth(season, month) {
    if (!season) return false;
    const onPiste = (season.winterUse || []).some(use => use.kind === 'downhill' || use.kind === 'sled');
    const high = Number(season.highPoint) >= HIGH_MOUNTAIN_M;
    return (onPiste || high || Boolean(season.winterWalk)) && outOfSeason(season, month);
  }

  // "Best time: June to October" on a trail page, "Best time: Jun–Oct" on a
  // card, "Good all year" when every month suits. A run across New Year reads
  // as one run.
  function bestTime(season, short) {
    const best = bestMonths(season);
    if (!best) return '';
    if (best.length === 12) return tx('Good all year');
    const set = new Set(best);
    const name = m => (short ? monthName(m).slice(0, 3) : monthName(m));
    const runs = [];
    for (let m = 1; m <= 12; m += 1) {
      if (!set.has(m) || set.has(m === 1 ? 12 : m - 1)) continue;
      let end = m;
      while (set.has(end === 12 ? 1 : end + 1)) end = end === 12 ? 1 : end + 1;
      runs.push(end === m ? name(m) : (short ? `${name(m)}–${name(end)}` : tx('{from} to {to}', { from: name(m), to: name(end) })));
    }
    return tx('Best time: {range}', { range: runs.join(', ') });
  }

  // The month an out-of-season walk comes back into season: the next of its
  // best months after this one. null when it is in season or has no record.
  function backInSeason(season, month) {
    const best = bestMonths(season);
    if (!best || !month || best.includes(month)) return null;
    for (let step = 1; step <= 12; step += 1) {
      const next = ((month - 1 + step) % 12) + 1;
      if (best.includes(next)) return next;
    }
    return null;
  }

  // The "Out of season" tag with the month it comes back: "Out of season ·
  // back in June" ("back in Jun" on a card). '' when the walk is in season.
  function outOfSeasonTag(season, month, short) {
    const back = backInSeason(season, month);
    if (!back) return '';
    const name = short ? monthName(back).slice(0, 3) : monthName(back);
    return tx('Out of season · back in {month}', { month: name });
  }

  // A list in the order it came, with the walks out of season this month moved
  // to the end: the walks to go on now come first.
  function inSeasonFirst(items, seasonOf, month) {
    const now = [];
    const later = [];
    for (const item of items || []) (outOfSeason(seasonOf(item), month) ? later : now).push(item);
    return now.concat(later);
  }

  const api = { MONTH_NAMES, WINTER_SPORT_MONTHS, WINTER_WALK_MONTHS, HIGH_MOUNTAIN_M, monthName, monthRange, dayMonth, liftLine, roadLine, describe, nowNote, bestMonths, outOfSeason, hiddenThisMonth, bestTime, backInSeason, outOfSeasonTag, inSeasonFirst, DOG_SEASON_TAGS, dogSeasonsNow };
  global.DoloPawsTrailSeasonWords = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
