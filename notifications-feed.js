(function(global){
  'use strict';

  // Script-written wording goes through i18n.js; the English sentence is its own key.
  function tx(text, vars){
    var i18n = typeof window !== 'undefined' && window.DoloPawsI18n;
    if (i18n && typeof i18n.phrase === 'function') return i18n.phrase(text, vars);
    return vars ? String(text).replace(/\{(\w+)\}/g, function(m, k){ return (k in vars ? vars[k] : m); }) : text;
  }

  // Notifications are derived, not stored: the feed is rebuilt on every
  // visit from genuine update events (active flags, operator notices and
  // dated route audits). Stable, revision-aware ids keep an item read while
  // allowing a materially new update to notify again.

  // Built on each call so the month names follow the page language; the
  // short form is the first three letters of the full name in every language.
  function monthNames(){
    return [tx('January'),tx('February'),tx('March'),tx('April'),tx('May'),tx('June'),tx('July'),tx('August'),tx('September'),tx('October'),tx('November'),tx('December')]
      .map(function(name){ return name.slice(0, 3); });
  }
  var AUDIT_LIMIT = 4;

  function shortDate(iso){
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if(!m) return '';
    return parseInt(m[3], 10) + ' ' + (monthNames()[parseInt(m[2], 10) - 1] || '');
  }

  function relTime(ts, now){
    var diff = now - ts;
    if(!(diff >= 0)) return tx('Just now');
    var mins = Math.floor(diff / 60000);
    if(mins < 1) return tx('Just now');
    if(mins < 60) return tx('{n}m ago', { n: mins });
    var hours = Math.floor(mins / 60);
    if(hours < 24) return tx('{n}h ago', { n: hours });
    var d = new Date(ts);
    return d.getDate() + ' ' + (monthNames()[d.getMonth()] || '');
  }

  function hazardLabels(){
    return {
      'guard-dogs-livestock': tx('Guardian dogs or livestock reported'),
      'dangerous-terrain': tx('Dangerous terrain reported'),
      'not-dog-friendly': tx('Reported as not dog-friendly'),
      'water-dry': tx('Water source reported dry'),
      'lift-refused-dog': tx('A lift refused a dog'),
      'other': tx('Hazard reported'),
    };
  }

  function toMillis(value){
    if(value == null) return null;
    if(typeof value === 'number') return value;
    if(typeof value.toMillis === 'function') return value.toMillis();
    return null;
  }

  // A source entry is the verifier's working note -- quotes, article numbers,
  // document ids -- and on 24 October the bell pasted whole paragraphs of them.
  // The bell says what happened in one line; the notes stay in the record.
  // Map data is how the line was drawn, not an authority, so it is not counted.
  function officialSourceCount(trail){
    var sources = trail && trail.verified && Array.isArray(trail.verified.sources) ? trail.verified.sources : [];
    return sources.filter(function(source){
      return !/^\s*openstreetmap\b/i.test(String(source || ''));
    }).length;
  }

  function auditLine(trail){
    if(!(trail && trail.graduation && trail.graduation.status === 'verified')) return tx('Reviewed by ORMA: trail details updated.');
    var count = officialSourceCount(trail);
    if(!count) return tx('Now ORMA Verified.');
    return count === 1
      ? tx('Now ORMA Verified: checked against 1 official source.')
      : tx('Now ORMA Verified: checked against {count} official sources.', { count: count });
  }

  // → [{id, icon, alert, group:'today'|'earlier', timeLabel, title, body, href}]
  function build(opts){
    opts = opts || {};
    var trails = Array.isArray(opts.trails) ? opts.trails : [];
    var favorites = opts.favorites || {};
    var hazardFlags = Array.isArray(opts.hazardFlags) ? opts.hazardFlags : [];
    var siteNotices = Array.isArray(opts.siteNotices) ? opts.siteNotices : [];
    var now = opts.now || 0;
    var items = [];
    var HAZARD_LABEL = hazardLabels();
    var nameOf = function(trailId){
      var t = trails.find(function(x){ return x && x.id === trailId; });
      return t ? t.name : trailId;
    };

    // Live community hazard reports on this account's saved trails, the
    // one feed section that genuinely arrives between visits.
    hazardFlags.forEach(function(flag){
      if(!flag || !flag.id) return;
      var created = toMillis(flag.confirmedAt) || toMillis(flag.createdAt);
      var fresh = created != null && (now - created) < 864e5;
      items.push({
        id: 'flag-' + flag.id,
        icon: 'warning', alert: true,
        group: fresh ? 'today' : 'earlier',
        timeLabel: created != null ? relTime(created, now) : tx('Reported'),
        title: tx('{label}: {name}', { label: HAZARD_LABEL[flag.type] || HAZARD_LABEL.other, name: nameOf(flag.trailId) }),
        body: (flag.text ? String(flag.text).slice(0, 160) + ' ' : '')
          + (flag.confirmationSource === 'community' && flag.confirmations > 0
            ? (flag.confirmations === 1 ? tx('Confirmed by 1 walker.') : tx('Confirmed by {count} walkers.', { count: flag.confirmations }))
            : tx('Community report, conditions can change.')),
        href: 'trail.html?id=' + encodeURIComponent((window.DoloPawsRegionalData && window.DoloPawsRegionalData.slugFor ? window.DoloPawsRegionalData.slugFor(flag.trailId) : (flag.trailId))),
      });
    });

    // Operator broadcast notices (new trails, safety advisories, news).
    siteNotices.forEach(function(notice){
      if(!notice || !notice.id) return;
      var created = toMillis(notice.createdAt);
      items.push({
        id: 'notice-' + notice.id,
        icon: notice.type === 'safety' ? 'warning' : 'new',
        alert: notice.type === 'safety',
        group: created != null && (now - created) < 864e5 ? 'today' : 'earlier',
        timeLabel: created != null ? relTime(created, now) : tx('New'),
        title: String(notice.title || ''),
        body: String(notice.body || ''),
        href: notice.href ? String(notice.href) : 'browse-trails.html',
      });
    });

    // Profile saves and static trail facts are confirmations/context, not new
    // events. They stay in their source screens and never raise the bell.

    // Facebook-style aging: news-type items leave the feed after 30 days
    // instead of sitting there forever as "the same notifications".
    var NEWS_MAX_AGE_MS = 30 * 864e5;
    trails
      .map(function(t){
        var date = (t && t.verified && t.verified.date) || (t && t.reviewedAt) || null;
        return date ? { t: t, date: date } : null;
      })
      .filter(Boolean)
      .filter(function(entry){
        var ts = Date.parse(entry.date + 'T12:00:00');
        return !Number.isFinite(ts) || !now || (now - ts) <= NEWS_MAX_AGE_MS;
      })
      .sort(function(a, b){ return b.date.localeCompare(a.date); })
      .slice(0, AUDIT_LIMIT)
      .forEach(function(entry){
        var t = entry.t;
        items.push({
          id: 'audit-' + t.id + '-' + entry.date,
          icon: 'verified', alert: false, group: 'earlier', timeLabel: shortDate(entry.date),
          title: t.name,
          body: auditLine(t),
          href: 'trail.html?id=' + encodeURIComponent((window.DoloPawsRegionalData && window.DoloPawsRegionalData.slugFor ? window.DoloPawsRegionalData.slugFor(t.id) : (t.id)))
        });
      });

    return items;
  }

  function unreadIds(feed, seenIds){
    var seen = Array.isArray(seenIds) ? seenIds : [];
    return feed.map(function(i){ return i.id; }).filter(function(id){ return seen.indexOf(id) === -1; });
  }

  function migrateReadIds(feed, seenIds){
    var read = Array.isArray(seenIds) ? seenIds.slice() : [];
    feed.forEach(function(item){
      if(!item || !/^audit-.+-\d{4}-\d{2}-\d{2}$/.test(item.id)) return;
      var legacyId = item.id.slice(0, -11);
      var legacyIndex = read.indexOf(legacyId);
      if(legacyIndex === -1) return;
      if(read.indexOf(item.id) === -1) read.push(item.id);
      read.splice(legacyIndex, 1);
    });
    return read;
  }

  // The badge and row state share one durable read list. Opening the
  // notification centre resolves every item currently displayed; items stay
  // in the history, and only a genuinely new stable id raises the badge again.
  function badgeCount(feed, readIds){
    return unreadIds(feed, readIds).length;
  }

  var api = {
    build: build,
    unreadIds: unreadIds,
    badgeCount: badgeCount,
    migrateReadIds: migrateReadIds,
    shortDate: shortDate,
    relTime: relTime
  };
  global.DoloPawsNotifFeed = api;
  if(typeof module !== 'undefined' && module.exports){ module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
