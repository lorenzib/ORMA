const weatherWindow = require('./trail-weather-window');

function forecast(days = ['2026-08-20', '2026-08-21']){
  const hourlyTimes=[];
  const hourlyTemps=[];
  days.forEach((day,dayIndex)=>{
    for(let hour=0;hour<24;hour+=1){
      hourlyTimes.push(`${day}T${String(hour).padStart(2,'0')}:00`);
      hourlyTemps.push(dayIndex*2+Math.abs(hour-6));
    }
  });
  return {
    dailyDates:days,
    sunrises:days.map(day=>`${day}T05:58`),
    sunsets:days.map(day=>`${day}T20:18`),
    hourlyTimes,
    hourlyTemps,
  };
}

describe('route-aware walking window', () => {
  test('recommends an early morning start for a long alpine route', () => {
    const result=weatherWindow.recommendation({
      ...forecast(),
      currentTime:'2026-08-20T05:00',
      durationHours:3.5,
    });

    expect(result).toMatchObject({dayOffset:0,startMinutes:360,finishMinutes:570});
    expect(result.sunsetMinutes-result.finishMinutes).toBeGreaterThanOrEqual(60);
    expect(weatherWindow.markup(result)).toContain('Cooler daylight start: <strong>06:00</strong>');
    expect(weatherWindow.markup(result)).toContain('finish by <strong>09:30</strong>');
  });

  test('moves a long route to tomorrow morning once today’s morning window has passed', () => {
    const result=weatherWindow.recommendation({
      ...forecast(),
      currentTime:'2026-08-20T12:58',
      durationHours:3.5,
    });

    expect(result).toMatchObject({dayOffset:1,startMinutes:360,finishMinutes:570});
    expect(weatherWindow.markup(result)).toContain('Next cooler daylight start: tomorrow at <strong>06:00</strong>');
    expect(weatherWindow.markup(result)).not.toMatch(/18:00|21:00/);
  });

  test('never recommends a start that cannot preserve the sunset buffer', () => {
    const input=forecast(['2026-12-20']);
    input.sunrises=['2026-12-20T08:00'];
    input.sunsets=['2026-12-20T09:30'];
    const result=weatherWindow.recommendation({
      ...input,
      currentTime:'2026-12-20T06:00',
      durationHours:3.5,
    });

    expect(result).toBeNull();
    expect(weatherWindow.markup(result)).toContain('No route-length daylight recommendation');
  });

  test('parses forecast-local timestamps independently of the visitor timezone', () => {
    expect(weatherWindow.minuteOfDay('2026-08-20T06:30')).toBe(390);
    expect(weatherWindow.formatTime(390)).toBe('06:30');
  });
});

describe('heat onset and today\'s conditions', () => {
  // A day that climbs past 28C at 11:00 and cools again in the evening.
  function day(){
    const hourlyTimes = [];
    const hourlyTemps = [];
    for(let hour = 0; hour < 24; hour += 1){
      hourlyTimes.push(`2026-07-15T${String(hour).padStart(2, '0')}:00`);
      hourlyTemps.push(hour < 11 ? 18 + hour * 0.8 : hour < 18 ? 29 : 20);
    }
    return { hourlyTimes, hourlyTemps };
  }

  test('reads the hour heat becomes a problem off the forecast', () => {
    expect(weatherWindow.heatOnset({ currentTime:'2026-07-15T07:30', ...day() }))
      .toEqual({ minutes:660, label:'11:00', temperatureC:29 });
  });

  test('never looks backwards: an hour already past is not a warning', () => {
    // At 14:00 the 11:00 crossing is history; the next hot hour is now.
    expect(weatherWindow.heatOnset({ currentTime:'2026-07-15T14:00', ...day() }).label)
      .toBe('14:00');
    // After it cools, there is nothing left to warn about today.
    expect(weatherWindow.heatOnset({ currentTime:'2026-07-15T19:00', ...day() })).toBeNull();
  });

  test('says nothing rather than inventing an hour', () => {
    const cool = { hourlyTimes:['2026-07-15T08:00', '2026-07-15T09:00'], hourlyTemps:[12, 14] };
    expect(weatherWindow.heatOnset({ currentTime:'2026-07-15T07:30', ...cool })).toBeNull();
    expect(weatherWindow.heatOnset({ currentTime:'2026-07-15T07:30' })).toBeNull();
    // Mismatched arrays are unusable, not half-usable.
    expect(weatherWindow.heatOnset({ currentTime:'2026-07-15T07:30', hourlyTimes:['a', 'b'], hourlyTemps:[30] })).toBeNull();
  });

  test('maps today onto the vocabulary the scorer reads', () => {
    const forecastDay = day();
    // Warm now, hot later: the hour is the advice.
    expect(weatherWindow.currentConditions({ currentTime:'2026-07-15T07:30', temperatureC:23, ...forecastDay }))
      .toEqual({ status:'known', heatRisk:'moderate', hotFromLabel:'11:00', capturedAt:expect.any(Number) });
    // Already hot: an hour would be telling someone what they can feel.
    expect(weatherWindow.currentConditions({ currentTime:'2026-07-15T13:00', temperatureC:30, ...forecastDay }))
      .toEqual({ status:'known', heatRisk:'high', hotFromLabel:null, capturedAt:expect.any(Number) });
    expect(weatherWindow.currentConditions({ currentTime:'2026-07-15T07:30', temperatureC:12, ...forecastDay }).heatRisk)
      .toBe('low');
    // No reading at all stays 'not-provided', which the engine already
    // understands as "the score does not include today".
    expect(weatherWindow.currentConditions({ currentTime:'2026-07-15T07:30' }))
      .toEqual({ status:'not-provided' });
  });

  test('reuses the thresholds the conditions card already ships', () => {
    expect(weatherWindow.WARM_C).toBe(22);
    expect(weatherWindow.HOT_C).toBe(28);
  });
});
