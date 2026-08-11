(function(){
  'use strict';

  // Renders the derived feed (notifications-feed.js) with per-item read
  // state, Facebook-style: opening this page clears the bell badge (every
  // item becomes "glanced"), while rows stay tinted until actually clicked
  // ("read"). Read state also syncs through the account (Firestore
  // notifSeen) so another device doesn't re-announce old items.
  var SEEN_KEY = 'dolopaws-notif-seen';
  var GLANCED_KEY = 'dolopaws-notif-glanced';
  var UNREAD_KEY = 'dolopaws-notif-unread';
  var EVENT_KEY = 'dolopaws-notif-profile-event';

  function idList(key){
    try {
      var raw = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch(e){ return []; }
  }
  function seenIds(){ return idList(SEEN_KEY); }
  function saveSeen(list){ try { localStorage.setItem(SEEN_KEY, JSON.stringify(list)); } catch(e){} }
  function saveGlanced(list){ try { localStorage.setItem(GLANCED_KEY, JSON.stringify(list)); } catch(e){} }
  function setUnreadCache(n){ try { localStorage.setItem(UNREAD_KEY, String(n)); } catch(e){} }
  // Reading state is account data: push the merged read list to Firestore
  // whenever it changes so other devices pick it up. Fire-and-forget.
  function pushSeen(list){
    var auth = window.DoloPawsAuth;
    if(auth && auth.currentUser && typeof auth.setNotifSeen === 'function'){
      auth.setNotifSeen(list).catch(function(){});
    }
  }
  function profileEvent(){
    try { return JSON.parse(localStorage.getItem(EVENT_KEY) || 'null'); } catch(e){ return null; }
  }
  function esc(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function rowHtml(item, unread){
    var cls = 'notification-row' + (item.alert ? ' notification-row--alert' : '') + (unread ? ' notification-row--unread' : '');
    return '<a class="' + cls + '" href="' + esc(item.href) + '" data-notif-id="' + esc(item.id) + '">' +
      '<span class="notification-icon"><span data-dp-icon="' + esc(item.icon) + '" data-dp-icon-size="17"></span></span>' +
      '<div class="notification-copy"><b>' + esc(item.title) + '</b>' +
      '<span class="notification-time">' + esc(item.timeLabel) + '</span>' +
      '<p>' + esc(item.body) + '</p></div>' +
      (unread ? '<span class="notification-dot"></span>' : '') +
      '</a>';
  }

  function render(feed){
    var seen = seenIds();
    var groups = { today: [], earlier: [] };
    feed.forEach(function(item){ (groups[item.group] || groups.earlier).push(item); });

    ['today', 'earlier'].forEach(function(key){
      var wrap = document.getElementById(key === 'today' ? 'notifToday' : 'notifEarlier');
      var kicker = document.getElementById(key === 'today' ? 'notifTodayKicker' : 'notifEarlierKicker');
      if(!wrap) return;
      var items = groups[key];
      wrap.hidden = kicker.hidden = items.length === 0;
      wrap.innerHTML = items.map(function(item){
        return rowHtml(item, seen.indexOf(item.id) === -1);
      }).join('');
    });

    var empty = document.getElementById('notifEmpty');
    if(empty) empty.hidden = feed.length > 0;

    if(window.DoloPawsIcons) window.DoloPawsIcons.hydrate(document);

    // Opening the centre "glances" everything currently in it — the bell
    // badge drops to zero even though unclicked rows keep their tint.
    var glanced = idList(GLANCED_KEY);
    feed.forEach(function(item){ if(glanced.indexOf(item.id) === -1) glanced.push(item.id); });
    saveGlanced(glanced);
    setUnreadCache(window.DoloPawsNotifFeed.badgeCount(feed, glanced));

    var unread = window.DoloPawsNotifFeed.unreadIds(feed, seen);

    var markBtn = document.getElementById('markRead');
    if(markBtn){
      markBtn.disabled = unread.length === 0;
      markBtn.textContent = unread.length === 0 ? 'All read' : 'Mark all as read';
    }

    document.querySelectorAll('[data-notif-id]').forEach(function(row){
      row.addEventListener('click', function(){
        var id = row.getAttribute('data-notif-id');
        var list = seenIds();
        if(list.indexOf(id) === -1){ list.push(id); saveSeen(list); pushSeen(list); }
      });
    });

    return feed;
  }

  var currentFeed = [];

  var booted = false;

  function init(){
    booted = true;
    var auth = window.DoloPawsAuth;
    // Members: merge the account's synced read list into this browser's
    // before building, so items read elsewhere don't come back as unread.
    var seenSyncP = (auth && auth.currentUser && typeof auth.getNotifSeen === 'function')
      ? auth.getNotifSeen().catch(function(){ return []; })
      : Promise.resolve([]);
    var pending = (auth && auth.currentUser)
      ? auth.getFavorites().catch(function(){ return {}; })
      : Promise.resolve({});
    seenSyncP.then(function(remoteSeen){
      if(Array.isArray(remoteSeen) && remoteSeen.length){
        var list = seenIds(), grew = false;
        remoteSeen.forEach(function(id){
          if(list.indexOf(id) === -1){ list.push(id); grew = true; }
        });
        if(grew) saveSeen(list);
      }
      return pending;
    }).then(function(favorites){
      favorites = favorites || {};
      // Live Firestore content: hazard flags on saved trails (members) and
      // operator notices (everyone). Both degrade to empty on any failure —
      // the derived feed still renders.
      var flagsP = (auth && auth.currentUser && typeof auth.getActiveFlagsForTrails === 'function')
        ? auth.getActiveFlagsForTrails(Object.keys(favorites)).catch(function(){ return []; })
        : Promise.resolve([]);
      var noticesP = (auth && typeof auth.getSiteNotices === 'function')
        ? auth.getSiteNotices().catch(function(){ return []; })
        : Promise.resolve([]);
      Promise.all([flagsP, noticesP]).then(function(live){
        currentFeed = window.DoloPawsNotifFeed.build({
          trails: typeof trails !== 'undefined' ? trails : [],
          favorites: favorites,
          profileEvent: profileEvent(),
          hazardFlags: live[0],
          siteNotices: live[1],
          now: Date.now()
        });
        render(currentFeed);
      });
    });
  }

  var markBtn = document.getElementById('markRead');
  if(markBtn){
    markBtn.addEventListener('click', function(){
      var list = seenIds();
      currentFeed.forEach(function(item){ if(list.indexOf(item.id) === -1) list.push(item.id); });
      saveSeen(list);
      pushSeen(list);
      render(currentFeed);
    });
  }

  // The pre-feed implementation stored one global read flag; drop it so it
  // can never mask the per-item state.
  try { localStorage.removeItem('dolopaws-notifications-read'); } catch(e){}

  if(window.DoloPawsAuth) init();
  else window.addEventListener('dolopaws-auth-ready', init, { once: true });
  window.addEventListener('dolopaws-auth-changed', init);
  // If Firebase never arrives (offline, blocked), still show the site-news
  // portion of the feed rather than a blank page.
  setTimeout(function(){ if(!booted) init(); }, 2500);
})();
