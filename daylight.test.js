/**
 * @jest-environment jsdom
 */
'use strict';

const daylight = require('./daylight');

const minutes = text => {
  const [h, m] = text.split(':').map(Number);
  return h * 60 + m;
};
const at = (iso, lat, lng) => {
  const date = new Date(iso);
  const times = daylight.sunTimesUtcMinutes(date, lat, lng);
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return {
    sunrise: daylight.formatTime(new Date(midnight + times.sunrise * 60000)),
    sunset: daylight.formatTime(new Date(midnight + times.sunset * 60000)),
  };
};

describe('sunset at a walk', () => {
  test('in Meran on the shortest and longest days, within a few minutes of the tables', () => {
    // Published for Bolzano/Meran: about 07:50 and 16:35 on 21 December,
    // 05:20 and 21:10 on 21 June (local time).
    const winter = at('2026-12-21T10:00:00Z', 46.67, 11.16);
    expect(Math.abs(minutes(winter.sunset) - minutes('16:33'))).toBeLessThanOrEqual(6);
    expect(Math.abs(minutes(winter.sunrise) - minutes('07:52'))).toBeLessThanOrEqual(6);
    const summer = at('2026-06-21T10:00:00Z', 46.67, 11.16);
    expect(Math.abs(minutes(summer.sunset) - minutes('21:10'))).toBeLessThanOrEqual(6);
  });
});

describe('the walk time', () => {
  test('reads a number, a range (the longer end) and a comma', () => {
    expect(daylight.walkHours('2.5')).toBe(2.5);
    expect(daylight.walkHours('2.5–3')).toBe(3);
    expect(daylight.walkHours('1-1.5')).toBe(1.5);
    expect(daylight.walkHours('1,5')).toBe(1.5);
    expect(daylight.walkHours(2)).toBe(2);
    expect(daylight.walkHours('')).toBeNull();
  });
});

describe('the latest start', () => {
  const walk = { lat: 46.54, lng: 11.62, hours: '2.5–3' };

  test('is sunset less the walk, rounded down to a quarter hour', () => {
    const day = daylight.daylightFor(walk, new Date('2026-11-21T10:00:00Z'));
    expect(daylight.formatTime(day.sunset)).toBe('16:36');
    expect(daylight.formatTime(day.startBy)).toBe('13:30');
  });

  test('is only worked out from October to March', () => {
    expect(daylight.daylightFor(walk, new Date('2026-07-15T10:00:00Z'))).toBeNull();
    expect(daylight.daylightFor(walk, new Date('2027-03-15T10:00:00Z'))).not.toBeNull();
  });

  test('needs a position and a time', () => {
    expect(daylight.daylightFor({ lat: 46.5, lng: 11.6 }, new Date('2026-12-01T10:00:00Z'))).toBeNull();
    expect(daylight.daylightFor({ hours: '2' }, new Date('2026-12-01T10:00:00Z'))).toBeNull();
  });
});

describe('the line on a trail page', () => {
  test('is filled from its template and shown', () => {
    document.documentElement.lang = 'en';
    document.body.innerHTML = '<p class="sp-daylight" hidden data-lat="46.54" data-lng="11.62" data-hours="2.5–3" data-template="Sunset {sunset}, start by {start}."></p>';
    daylight.fillPage(document, new Date('2026-11-21T10:00:00Z'));
    const line = document.querySelector('.sp-daylight');
    expect(line.hidden).toBe(false);
    expect(line.textContent).toBe('Sunset 16:36, start by 13:30.');
  });

  test('stays hidden in summer', () => {
    document.body.innerHTML = '<p class="sp-daylight" hidden data-lat="46.54" data-lng="11.62" data-hours="2" data-template="x"></p>';
    daylight.fillPage(document, new Date('2026-07-01T10:00:00Z'));
    expect(document.querySelector('.sp-daylight').hidden).toBe(true);
  });
});
