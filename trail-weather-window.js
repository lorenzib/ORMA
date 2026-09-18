(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.DoloPawsWeatherWindow=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const DAYLIGHT_BUFFER_MINUTES=60;
  const PLANNING_BUFFER_MINUTES=30;
  const PREFERRED_START_MINUTES=9*60;
  const SUNSET_NOTE_WINDOW_MINUTES=2*60;
  // Heat thresholds already shipped on the trail page's conditions card,
  // reused here so one number does not mean two different things in two places.
  const WARM_C=22;
  const HOT_C=28;

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

  // Trail durations are authored as strings, usually a range ("2–2.5", "3–4")
  // and sometimes annotated ("2.5–3 (estimated)"). Number() cannot parse those,
  // so a bare Number() silently collapsed every range to the 1 h fallback and
  // planned a four-hour hike as if it finished in one. Take the upper bound of
  // whatever numbers the string carries, so the finish-before-dark maths never
  // underestimates how long the walk takes.
  function parseDurationHours(value){
    if(typeof value==='number')return value;
    const matches=String(value==null?'':value).match(/\d+(?:\.\d+)?/g);
    return matches&&matches.length?Math.max(...matches.map(Number)):NaN;
  }

  function recommendation(input){
    const durationHours=Math.min(12,Math.max(.5,parseDurationHours(input?.durationHours)||1));
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

    // A reader who picked a day on the homepage is asking about that day, not
    // about whichever of the next three happens to be coolest. Without one,
    // the scan is unchanged: the first day that offers a usable window wins.
    const preferredDate=/^\d{4}-\d{2}-\d{2}$/.test(input?.preferredDate||'')?input.preferredDate:'';
    const lastDay=preferredDate?dailyDates.length:Math.min(3,dailyDates.length);
    for(let dayOffset=0;dayOffset<lastDay;dayOffset+=1){
      const date=dayKey(dailyDates[dayOffset]);
      if(preferredDate&&date!==preferredDate)continue;
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

      const practicalStart=Math.max(earliestStart,PREFERRED_START_MINUTES);
      const scored=candidates.map(candidate=>{
        const routeTemps=hours
          .filter(hour=>hour.day===date&&hour.minute>=candidate.minute&&hour.minute<candidate.minute+durationMinutes)
          .map(hour=>hour.temp)
          .filter(Number.isFinite);
        return {
          ...candidate,
          averageTemp:average(routeTemps),
          maxTemp:routeTemps.length?Math.max(...routeTemps):Infinity,
          hasTemperature:routeTemps.length>0,
          practicalDistance:Math.abs(candidate.minute-practicalStart),
        };
      });
      const weatherCandidates=scored.filter(candidate=>candidate.hasTemperature);
      const comfortable=weatherCandidates.filter(candidate=>candidate.maxTemp<WARM_C);
      let chosen;
      let reason;
      if(comfortable.length){
        // If every viable hour is cool, do not mistake dawn for a useful
        // recommendation merely because it is one degree colder. Prefer a
        // practical 09:00 start (or the next viable hour today). A genuinely
        // warm afternoon still narrows this pool to the cooler earlier hours.
        chosen=comfortable.sort((a,b)=>(a.practicalDistance-b.practicalDistance)||(a.minute-b.minute))[0];
        reason=weatherCandidates.some(candidate=>candidate.maxTemp>=WARM_C)?'avoid-heat':'comfortable';
      }else if(weatherCandidates.length){
        // No fully cool window exists: minimise the hottest hour across the
        // walk, then its average temperature, before breaking ties by time.
        chosen=weatherCandidates.sort((a,b)=>(a.maxTemp-b.maxTemp)||(a.averageTemp-b.averageTemp)||(a.minute-b.minute))[0];
        reason='least-warm';
      }else{
        chosen=scored.sort((a,b)=>(a.practicalDistance-b.practicalDistance)||(a.minute-b.minute))[0];
        reason='daylight-only';
      }
      return {
        dayOffset,
        date,
        startMinutes:chosen.minute,
        finishMinutes:chosen.minute+durationMinutes,
        sunsetMinutes:sunset,
        daylightBufferMinutes:DAYLIGHT_BUFFER_MINUTES,
        durationHours,
        maxTemperatureC:Number.isFinite(chosen.maxTemp)?Math.round(chosen.maxTemp):null,
        reason,
      };
    }
    return null;
  }

  function dayLabel(date){
    const parsed=/^\d{4}-\d{2}-\d{2}$/.test(date||'')?new Date(`${date}T12:00:00`):null;
    if(!parsed||Number.isNaN(parsed.getTime()))return date;
    try{
      return parsed.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'short'});
    }catch(error){ return date; }
  }

  function markup(result){
    if(!result)return 'No route-length daylight recommendation is available. Check the official forecast and plan to finish well before dusk.';
    const start=formatTime(result.startMinutes);
    const finish=formatTime(result.finishMinutes);
    // A day a reader picked is now the common case, not the exception, so it
    // is named the way they picked it rather than printed as an ISO string.
    const when=result.dayOffset===0
      ? `<strong>${start}</strong>`
      : result.dayOffset===1
        ? `tomorrow at <strong>${start}</strong>`
        : `on ${dayLabel(result.date)} at <strong>${start}</strong>`;
    const maximum=Number.isFinite(result.maxTemperatureC)?` (up to ${result.maxTemperatureC}°C)`:'';
    let lead;
    let close='';
    if(result.reason==='comfortable')lead=`The forecast stays cool during the walk${maximum}. Suggested start: ${when}`;
    else if(result.reason==='avoid-heat'){
      lead=`Cooler forecast window${maximum}: start ${when}`;
      close=' before the warmer part of the day';
    }else if(result.reason==='least-warm'){
      lead=`Least-warm forecast window${maximum}: start ${when}`;
      close=' before the hottest available hours';
    }else lead=`Suggested daylight start: ${when}`;
    const daylightMargin=result.sunsetMinutes-result.finishMinutes;
    const daylight=daylightMargin<=SUNSET_NOTE_WINDOW_MINUTES
      ? ` This leaves ${Math.max(1,Math.floor(daylightMargin/60))} hour${daylightMargin>=120?'s':''} before sunset.`
      : '';
    return `${lead} · for this ${result.durationHours} h route, finish around <strong>${finish}</strong>${close}.${daylight}`;
  }

  // The hour heat actually becomes a problem today, read off the forecast
  // rather than asserted. Returns null when the forecast never crosses the
  // threshold, so the caller can stay silent instead of inventing an hour.
  function heatOnset(input){
    const times=Array.isArray(input&&input.hourlyTimes)?input.hourlyTimes:[];
    const temps=Array.isArray(input&&input.hourlyTemps)?input.hourlyTemps:[];
    if(!times.length||times.length!==temps.length)return null;
    const today=dayKey(input.currentTime);
    const nowMinute=minuteOfDay(input.currentTime);
    if(!today||nowMinute===null)return null;
    const threshold=Number.isFinite(input.thresholdC)?input.thresholdC:HOT_C;

    for(let index=0;index<times.length;index+=1){
      if(dayKey(times[index])!==today)continue;
      const minute=minuteOfDay(times[index]);
      const temp=Number(temps[index]);
      if(minute===null||!Number.isFinite(temp))continue;
      if(minute<nowMinute)continue;
      if(temp>=threshold)return {minutes:minute,label:formatTime(minute),temperatureC:Math.round(temp)};
    }
    return null;
  }

  // Today's heat, in the vocabulary the recommendation engine reads.
  function currentConditions(input){
    const temp=Number(input&&input.temperatureC);
    if(!Number.isFinite(temp))return {status:'not-provided'};
    const heatRisk=temp>=HOT_C?'high':temp>=WARM_C?'moderate':'low';
    const onset=heatOnset(input);
    return {
      status:'known',
      heatRisk,
      // Only present when the forecast actually crosses the threshold later
      // today. Absent means the engine says nothing about an hour.
      hotFromLabel:onset&&heatRisk!=='high'?onset.label:null,
      // SCORE-01 requires a conditions snapshot to carry its observation time
      // and to stop being described as live once stale. Stamping it here means
      // a caller cannot forget it; isFresh() below is the shared expiry rule.
      capturedAt:Number.isFinite(Number(input&&input.capturedAt))?Number(input.capturedAt):Date.now(),
    };
  }

  // Weather goes out of date faster than a page stays open. pre-hike-readiness
  // already treats a forecast older than thirty minutes as unusable; the score
  // uses the same rule so the two cannot disagree about what "now" means.
  const CONDITIONS_MAX_AGE_MS=30*60*1000;

  function isFresh(conditions,now){
    if(!conditions||conditions.status!=='known')return false;
    const captured=Number(conditions.capturedAt);
    if(!Number.isFinite(captured))return false;
    const at=Number.isFinite(Number(now))?Number(now):Date.now();
    return at-captured<=CONDITIONS_MAX_AGE_MS&&at>=captured;
  }

  // What the engine should be handed: the snapshot while it is current, and an
  // explicit omission once it is not. Never a stale snapshot presented as live.
  function scoringConditions(conditions,now){
    return isFresh(conditions,now)?conditions:{status:'not-provided'};
  }

  return {DAYLIGHT_BUFFER_MINUTES,PLANNING_BUFFER_MINUTES,PREFERRED_START_MINUTES,WARM_C,HOT_C,CONDITIONS_MAX_AGE_MS,minuteOfDay,formatTime,dayLabel,parseDurationHours,recommendation,markup,heatOnset,currentConditions,isFresh,scoringConditions};
});
