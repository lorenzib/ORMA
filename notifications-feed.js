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

  // → [{id, icon, alert, group:'today'|'earlier', timeLabel, title, body, href}]
  function build(opts){
    opts = opts || {};
    var trails = Array.isArray(opts.trails) ? opts.trails : [];
    var favorites = opts.favorites || {};
    var profileEvent = opts.profileEvent || null;
    var now = opts.now || 0;
    var items = [];

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

    trails
      .map(function(t){
        var date = (t && t.verified && t.verified.date) || (t && t.reviewedAt) || null;
        return date ? { t: t, date: date } : null;
      })
      .filter(Boolean)
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

  var api = { build: build, unreadIds: unreadIds, shortDate: shortDate, relTime: relTime };
  global.DoloPawsNotifFeed = api;
  if(typeof module !== 'undefined' && module.exports){ module.exports = api; }
})(typeof window !== 'undefined' ? window : globalThis);
