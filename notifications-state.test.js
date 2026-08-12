const fs = require('fs');
const path = require('path');
const feed = require('./notifications-feed.js');

const notificationsScript = fs.readFileSync(path.join(__dirname, 'notifications.js'), 'utf8');

function pageMarkup(){
  return `
    <button id="markRead">Mark all as read</button>
    <p id="notifTodayKicker" hidden></p><section id="notifToday" hidden></section>
    <p id="notifEarlierKicker" hidden></p><section id="notifEarlier" hidden></section>
    <div id="notifEmpty" hidden></div>`;
}

async function settle(){
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe('notification centre durable read behaviour', () => {
  test('opening and refreshing resolves the badge but preserves notification history', async () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const isolated = frame.contentWindow;
    isolated.localStorage.clear();
    isolated.document.body.innerHTML = pageMarkup();
    isolated.DoloPawsNotifFeed = feed;
    isolated.trails = [];
    const setNotifSeen = jest.fn().mockResolvedValue(true);
    isolated.DoloPawsAuth = {
      currentUser: { uid:'member-1' },
      getFavorites: jest.fn().mockResolvedValue({}),
    };
    isolated.DoloPawsCommunity = {
      getNotifSeen: jest.fn().mockResolvedValue([]),
      setNotifSeen,
      getActiveFlagsForTrails: jest.fn().mockResolvedValue([]),
      getSiteNotices: jest.fn().mockResolvedValue([{
        id:'welcome', type:'trail', title:'A new trail', body:'Open the trail.',
        href:'browse-trails.html', createdAt:Date.now(),
      }]),
    };

    isolated.eval(notificationsScript);
    await settle();

    expect(isolated.document.querySelectorAll('[data-notif-id]')).toHaveLength(1);
    expect(isolated.document.querySelector('[data-notif-id]').classList)
      .not.toContain('notification-row--unread');
    expect(JSON.parse(isolated.localStorage.getItem('dolopaws-notif-seen')))
      .toContain('notice-welcome');
    expect(isolated.localStorage.getItem('dolopaws-notif-unread')).toBe('0');
    expect(setNotifSeen).toHaveBeenCalledWith(expect.arrayContaining(['notice-welcome']));

    // Simulate a page refresh with the same browser storage and same feed.
    isolated.document.body.innerHTML = pageMarkup();
    isolated.eval(notificationsScript);
    await settle();

    expect(isolated.document.querySelectorAll('[data-notif-id]')).toHaveLength(1);
    expect(isolated.localStorage.getItem('dolopaws-notif-unread')).toBe('0');
    expect(feed.badgeCount(
      feed.build({ trails:[], siteNotices:[{ id:'welcome' }], now:Date.now() }),
      JSON.parse(isolated.localStorage.getItem('dolopaws-notif-seen'))
    )).toBe(0);
  });

  test('migrates notifications resolved by the previous glanced state', async () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const isolated = frame.contentWindow;
    isolated.localStorage.clear();
    isolated.localStorage.setItem('dolopaws-notif-glanced', JSON.stringify(['notice-old']));
    isolated.document.body.innerHTML = pageMarkup();
    isolated.DoloPawsNotifFeed = feed;
    isolated.trails = [];
    isolated.DoloPawsAuth = { currentUser:null };
    isolated.DoloPawsCommunity = {
      getSiteNotices:jest.fn().mockResolvedValue([{
        id:'old', title:'Previously viewed', body:'Still in history.', createdAt:Date.now(),
      }]),
    };

    isolated.eval(notificationsScript);
    await settle();

    expect(JSON.parse(isolated.localStorage.getItem('dolopaws-notif-seen')))
      .toContain('notice-old');
    expect(isolated.localStorage.getItem('dolopaws-notif-glanced')).toBeNull();
    expect(isolated.localStorage.getItem('dolopaws-notif-unread')).toBe('0');
  });
});
