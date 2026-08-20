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
