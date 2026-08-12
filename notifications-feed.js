(function(global){
  'use strict';

  // Notifications are derived, not stored: the feed is rebuilt on every
  // visit from the trail dataset plus the visitor's own state (saved
  // trails, profile edits). Ids are stable per underlying fact, so the
  // per-browser seen-list keeps an item read once it has been opened.

  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var AUDIT_LIMIT = 4;

  function shortDate(iso){
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if(!m) return '';
    return parseInt(m[3], 10) + ' ' + (MONTHS[parseInt(m[2], 10) - 1] || '');
  }

  function relTime(ts, now){
    var diff = now - ts;
    if(!(diff >= 0)) return 'Just now';
    var mins = Math.floor(diff / 60000);
    if(mins < 1) return 'Just now';
    if(mins < 60) return mins + 'm ago';
    var hours = Math.floor(mins / 60);
    if(hours < 24) return hours + 'h ago';
    var d = new Date(ts);
    return d.getDate() + ' ' + (MONTHS[d.getMonth()] || '');
  }

  var HAZARD_LABEL = {
    'guard-dogs-livestock': 'Guardian dogs or livestock reported',
    'dangerous-terrain': 'Dangerous terrain reported',
    'not-dog-friendly': 'Reported as not dog-friendly',
    'water-dry': 'Water source reported dry',
    'lift-refused-dog': 'A lift refused a dog',
    'other': 'Hazard reported',
  };

  function toMillis(value){
    if(value == null) return null;
    if(typeof value === 'number') return value;
    if(typeof value.toMillis === 'function') return value.toMillis();
    return null;
  }

  // → [{id, icon, alert, group:'today'|'earlier', timeLabel, title, body, href}]
  function build(opts){
    opts = opts || {};
    var trails = Array.isArray(opts.trails) ? opts.trails : [];
    var favorites = opts.favorites || {};
    var profileEvent = opts.profileEvent || null;
    var hazardFlags = Array.isArray(opts.hazardFlags) ? opts.hazardFlags : [];
    var siteNotices = Array.isArray(opts.siteNotices) ? opts.siteNotices : [];
    var now = opts.now || 0;
    var items = [];
    var nameOf = function(trailId){
      var t = trails.find(function(x){ return x && x.id === trailId; });
      return t ? t.name : trailId;
    };

    // Live community hazard reports on this account's saved trails — the
    // one feed section that genuinely arrives between visits.
    hazardFlags.forEach(function(flag){
      if(!flag || !flag.id) return;
      var created = toMillis(flag.confirmedAt) || toMillis(flag.createdAt);
      var fresh = created != null && (now - created) < 864e5;
      items.push({
        id: 'flag-' + flag.id,
        icon: 'warning', alert: true,
        group: fresh ? 'today' : 'earlier',
        timeLabel: created != null ? relTime(created, now) : 'Reported',
        title: (HAZARD_LABEL[flag.type] || HAZARD_LABEL.other) + ': ' + nameOf(flag.trailId),
        body: (flag.text ? String(flag.text).slice(0, 160) + ' ' : '')
          + (flag.confirmationSource === 'community' && flag.confirmations > 0
            ? 'Confirmed by ' + flag.confirmations + ' walker' + (flag.confirmations === 1 ? '' : 's') + '.'
            : 'Community report — conditions can change.'),
        href: 'trail.html?id=' + flag.trailId,
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
        timeLabel: created != null ? relTime(created, now) : 'New',
        title: String(notice.title || ''),
        body: String(notice.body || ''),
        href: notice.href ? String(notice.href) : 'browse-trails.html',
      });
    });

    if(profileEvent && profileEvent.ts){
      items.push({
        id: 'profile-' + profileEvent.ts,
        icon: 'dog', alert: false,
        group: (now - profileEvent.ts) < 864e5 ? 'today' : 'earlier',
        timeLabel: relTime(profileEvent.ts, now),
        title: (profileEvent.name || 'Your dog') + '’s profile updated',
        body: 'Trail scores now reflect the new details.',
        href: 'settings.html'
      });
    }

    var saved = trails.filter(function(t){ return t && favorites[t.id]; });

    saved.forEach(function(t){
      if(t.heatRisk !== 'high') return;
      var shade = typeof t.shadeCoverage === 'number' ? t.shadeCoverage + '% shade' : 'little shade';
      items.push({
        id: 'heat-' + t.id,
        icon: 'heat', alert: true, group: 'today', timeLabel: 'Today',
        title: 'Heat advisory: ' + t.name,
        body: 'Only ' + shade + ' on this saved route — plan an early start and pack water.',
        href: 'trail.html?id=' + t.id
      });
    });

    saved.forEach(function(t){
      var hazards = Array.isArray(t.surfaceHazards) ? t.surfaceHazards.filter(Boolean) : [];
      if(!hazards.length) return;
      items.push({
        id: 'hazard-' + t.id,
        icon: 'warning', alert: true, group: 'today', timeLabel: 'Today',
        title: 'Trail advisory: ' + t.name,
        body: hazards.join(' · ') + '. Route open — take it steady with your dog.',
        href: 'trail.html?id=' + t.id
      });
    });

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
        var sources = t.verified && Array.isArray(t.verified.sources) && t.verified.sources.length
          ? 'Checked against ' + t.verified.sources.join(', ') + '.'
          : 'Desk-reviewed by DoloPaws.';
        items.push({
          id: 'audit-' + t.id,
          icon: 'verified', alert: false, group: 'earlier', timeLabel: shortDate(entry.date),
          title: t.name + ' is route-audited',
          body: sources + ' Its rating and facts are confirmed.',
          href: 'trail.html?id=' + t.id
        });
      });

    return items;
  }

  function unreadIds(feed, seenIds){
    var seen = Array.isArray(seenIds) ? seenIds : [];
    return feed.map(function(i){ return i.id; }).filter(function(id){ return seen.indexOf(id) === -1; });
  }

  // The badge and row state share one durable read list. Opening the
  // notification centre resolves every item currently displayed; items stay
  // in the history, and only a genuinely new stable id raises the badge again.
  function badgeCount(feed, readIds){
    return unreadIds(feed, readIds).length;
  }

  var api = { build: build, unreadIds: unreadIds, badgeCount: badgeCount, shortDate: shortDate, relTime: relTime };
  global.DoloPawsNotifFeed = api;
  if(typeof module !== 'undefined' && module.exports){ module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
