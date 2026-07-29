const fs = require('fs');
const path = require('path');

const source = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

describe('full design handoff routes', () => {
  test.each([
    ['search.html', 'Search a valley, lake or trail'],
    ['notifications.html', 'Mark all as read'],
    ['reviews.html', 'Write a review'],
    ['photo-upload.html', 'Choose from library'],
    ['trail-report.html', 'What did you find?'],
  ])('%s implements its designed full-screen flow', (file, copy) => {
    expect(source(file)).toContain(copy);
    expect(source(file)).toContain('styles.css');
  });

  test('trail actions open the designed screens after authentication', () => {
    const reports = source('trail-reports.js');
    expect(reports).toContain('photo-upload.html?trail=');
    expect(reports).toContain('reviews.html?trail=');
    expect(reports).toContain('trail-report.html?trail=');
  });

  test('the app header notification bell opens the notification centre', () => {
    expect(source('script.js')).toContain("window.location.href = 'notifications.html'");
    expect(source('mobile-nav.js')).toContain("prefix + 'notifications.html'");
  });

  test('account uses the continuous dog-profile design', () => {
    const account = source('account.html');
    expect(account).toContain('How this shapes the trails');
    expect(account).toContain('Health conditions always outrank breed assumptions');
    expect(account).toContain('profile-design.js');
  });
});
