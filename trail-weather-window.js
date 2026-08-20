(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.DoloPawsWeatherWindow=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const DAYLIGHT_BUFFER_MINUTES=60;
  const PLANNING_BUFFER_MINUTES=30;
  const LONG_ROUTE_HOURS=2.5;
  const MORNING_START_LIMIT=9*60;

  function dayKey(value){return String(value||'').slice(0,10);}

  function minuteOfDay(value){
    const match=String(value||'').match(/T(\d{2}):(\d{2})/);
    return match?Number(match[1])*60+Number(match[2]):null;
  }

  function formatTime(minutes){
    const value=Math.max(0,Math.round(Number(minutes)||0));
    return `${String(Math.floor(value/60)%24).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
  }

  function average(values){
    const finite=values.filter(Number.isFinite);
    return finite.length?finite.reduce((sum,value)=>sum+value,0)/finite.length:Infinity;
  }

  function recommendation(input){
    const durationHours=Math.min(12,Math.max(.5,Number(input?.durationHours)||1));
    const durationMinutes=Math.ceil(durationHours*60);
    const dailyDates=Array.isArray(input?.dailyDates)?input.dailyDates:[];
    const sunrises=Array.isArray(input?.sunrises)?input.sunrises:[];
    const sunsets=Array.isArray(input?.sunsets)?input.sunsets:[];
    const hourlyTimes=Array.isArray(input?.hourlyTimes)?input.hourlyTimes:[];
    const hourlyTemps=Array.isArray(input?.hourlyTemps)?input.hourlyTemps:[];
    const currentDay=dayKey(input?.currentTime)||dayKey(dailyDates[0]);
    const currentMinute=minuteOfDay(input?.currentTime);
    if(!dailyDates.length||!currentDay||currentMinute===null)return null;

    const hours=hourlyTimes.map((time,index)=>({
      day:dayKey(time),
      minute:minuteOfDay(time),
      temp:Number(hourlyTemps[index]),
    })).filter(hour=>hour.day&&hour.minute!==null);

    for(let dayOffset=0;dayOffset<Math.min(3,dailyDates.length);dayOffset+=1){
      const date=dayKey(dailyDates[dayOffset]);
      const sunrise=minuteOfDay(sunrises[dayOffset]);
      const sunset=minuteOfDay(sunsets[dayOffset]);
      if(!date||sunrise===null||sunset===null)continue;
      const earliestDaylightStart=Math.ceil(sunrise/60)*60;
      const latestStart=sunset-DAYLIGHT_BUFFER_MINUTES-durationMinutes;
      const earliestStart=dayOffset===0
        ? Math.max(earliestDaylightStart,Math.ceil((currentMinute+PLANNING_BUFFER_MINUTES)/60)*60)
        : earliestDaylightStart;
      const candidates=hours.filter(hour=>hour.day===date&&hour.minute>=earliestStart&&hour.minute<=latestStart);
      if(!candidates.length)continue;

      const morning=candidates.filter(hour=>hour.minute<=MORNING_START_LIMIT);
      const pool=durationHours>=LONG_ROUTE_HOURS?morning:(morning.length?morning:candidates);
      if(!pool.length)continue;
      const scored=pool.map(candidate=>{
        const routeTemps=hours
          .filter(hour=>hour.day===date&&hour.minute>=candidate.minute&&hour.minute<candidate.minute+durationMinutes)
          .map(hour=>hour.temp);
        return {...candidate,score:average(routeTemps)};
      }).sort((a,b)=>(a.score-b.score)||(a.minute-b.minute));
      const chosen=scored[0];
      return {
        dayOffset,
        date,
        startMinutes:chosen.minute,
        finishMinutes:chosen.minute+durationMinutes,
        sunsetMinutes:sunset,
        daylightBufferMinutes:DAYLIGHT_BUFFER_MINUTES,
        durationHours,
      };
    }
    return null;
  }

  function markup(result){
    if(!result)return 'No route-length daylight recommendation is available. Check the official forecast and plan to finish well before dusk.';
    const start=formatTime(result.startMinutes);
    const finish=formatTime(result.finishMinutes);
    const prefix=result.dayOffset===0
      ? 'Cooler daylight start:'
      : result.dayOffset===1
        ? 'Next cooler daylight start: tomorrow at'
        : `Next cooler daylight start on ${result.date}:`;
    return `${prefix} <strong>${start}</strong> · for this ${result.durationHours} h route, finish by <strong>${finish}</strong>, at least 1 hour before forecast sunset.`;
  }

  return {DAYLIGHT_BUFFER_MINUTES,PLANNING_BUFFER_MINUTES,minuteOfDay,formatTime,recommendation,markup};
});
