(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ORMARouteReturn=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  // A one-way walk's figures cover one direction only: the authority publishes
  // the walk from A to B, and a reader without a bus back walks it twice. This
  // works out the figures for walking it there and back, so the page can show
  // them and score the dog on the longer walk.
  //
  // Climb is not simply doubled. Walking back, the outward descent becomes
  // climb: Rotwandwiesen from the gondola is 1 m up and 561 m down, so there
  // and back is about 562 m up, not 2 m. The descent of one leg is the stated
  // ascent less the net height gained, read from the trail's own profile ends;
  // the summed profile itself undercounts, so it is not used for the climb.

  const VIEWS=Object.freeze({ONE_WAY:'one-way',OUT_AND_BACK:'out-and-back'});

  function isOneWay(trail){
    return Boolean(trail&&trail.routeShape==='point-to-point'&&!trail.oneWayOf
      &&Number.isFinite(Number(trail.distance))&&Number(trail.distance)>0);
  }

  // An out-and-back walk's published figures are the whole round trip: the
  // board's km and climb cover going and coming back on the same path. A copy
  // made by outAndBack() below is not one of these: it has a returnLeg.
  function isThereAndBack(trail){
    return Boolean(trail&&trail.routeShape==='out-and-back'&&!trail.returnLeg
      &&Number.isFinite(Number(trail.distance))&&Number(trail.distance)>0);
  }

  // Walks a reader can see either way: every walk that is not a loop.
  function hasChoice(trail){
    return isOneWay(trail)||isThereAndBack(trail);
  }

  // Net height gained from start to finish, or null when the profile is too
  // thin to say.
  function netGain(trail){
    const profile=Array.isArray(trail&&trail.elevationProfile)?trail.elevationProfile:[];
    if(profile.length<2)return null;
    const first=Number(profile[0]&&profile[0].elev);
    const last=Number(profile[profile.length-1]&&profile[profile.length-1].elev);
    return Number.isFinite(first)&&Number.isFinite(last)?last-first:null;
  }

  // Hours are authored as strings: "0.75", "2.5–3", "3:38". Each bound is read
  // as hours, an h:mm bound as hours and minutes.
  function parseHoursRange(value){
    const text=String(value==null?'':value);
    const bounds=(text.match(/\d+:\d{2}|\d+(?:\.\d+)?/g)||[]).slice(0,2).map(part=>{
      if(part.includes(':')){
        const [h,m]=part.split(':').map(Number);
        return h+m/60;
      }
      return Number(part);
    }).filter(Number.isFinite);
    return bounds.length?bounds:null;
  }

  function formatHours(hours){
    const quarter=Math.max(0.25,Math.round(hours*4)/4);
    return String(Number(quarter.toFixed(2)));
  }

  // The standard walking-time rule (DIN 33466: 4 km/h on the flat, 300 m an
  // hour up, 500 m an hour down; the larger part plus half the smaller). It is
  // used only as a ratio, to scale the authority's own time for the leg back,
  // so a symmetric walk comes out at exactly double.
  function ruleHours(km,up,down){
    const flat=km/4;
    const vertical=up/300+down/500;
    return Math.max(flat,vertical)+Math.min(flat,vertical)/2;
  }

  function outAndBack(trail){
    if(!isOneWay(trail))return null;
    const km=Number(trail.distance);
    const up=Number.isFinite(Number(trail.elevation))?Math.max(0,Number(trail.elevation)):null;
    const net=netGain(trail);
    const statedDown=trail.descent==null||!Number.isFinite(Number(trail.descent))?null:Math.max(0,Number(trail.descent));
    // A profile that gains more than the stated ascent is noise at the ends;
    // the descent cannot be below zero. Without a profile, the authority's own
    // descent says how much of the way back is climb.
    const down=up===null?null:net!==null?Math.max(0,up-net):statedDown!==null?statedDown:up;
    const climb=up===null?null:Math.round(up+down);
    const bounds=parseHoursRange(trail.hours);
    let hours=trail.hours;
    if(bounds&&up!==null){
      const out=ruleHours(km,up,down);
      const back=ruleHours(km,down,up);
      const factor=out>0?1+back/out:2;
      hours=bounds.map(bound=>formatHours(bound*factor)).filter((v,i,all)=>all.indexOf(v)===i).join('–');
    }else if(bounds){
      hours=bounds.map(bound=>formatHours(bound*2)).filter((v,i,all)=>all.indexOf(v)===i).join('–');
    }
    return {
      ...trail,
      distance:Math.round(km*2*10)/10,
      elevation:climb,
      descent:climb,
      hours,
      routeShape:'out-and-back',
      // What the copy was made from, so a reader of the record can tell the
      // estimate from the authority's figures.
      returnLeg:{
        oneWayDistance:km,
        oneWayAscent:up,
        oneWayDescent:down===null?null:Math.round(down),
        oneWayHours:trail.hours,
        hoursEstimated:true,
      },
    };
  }

  // The out leg of an out-and-back walk: from the start to where it turns
  // round, for a reader with a lift, a bus or a second car to get back. The
  // distance is exactly half the round trip. The climb is the board's round
  // trip climb split by the profile: going out climbs what the profile climbs
  // before the turn, coming back climbs what it drops, so the share is an
  // estimate. No board publishes a one-way time for these walks, so there is
  // none: hours is left empty rather than halved.
  function profileClimb(points){
    let up=0,down=0;
    for(let i=1;i<points.length;i+=1){
      const step=Number(points[i].elev)-Number(points[i-1].elev);
      if(!Number.isFinite(step))continue;
      if(step>0)up+=step;else down-=step;
    }
    return {up,down};
  }
  function outLeg(trail){
    const profile=Array.isArray(trail.elevationProfile)?trail.elevationProfile:[];
    if(profile.length<2)return [];
    const total=Number(trail.distance);
    const last=Number(profile[profile.length-1].km);
    // A profile drawn one way only (the line stops at the turn) is the out
    // leg already; a round-trip profile turns at half the distance.
    if(!(last>total*0.75))return profile;
    const turn=last/2;
    const leg=profile.filter(point=>Number(point.km)<=turn+1e-9);
    const next=profile.find(point=>Number(point.km)>turn+1e-9);
    if(next&&leg.length&&Number(leg[leg.length-1].km)<turn-0.05)leg.push(next);
    return leg;
  }
  function oneWayLeg(trail){
    if(!isThereAndBack(trail))return null;
    const roundKm=Number(trail.distance);
    const roundClimb=Number.isFinite(Number(trail.elevation))?Math.max(0,Number(trail.elevation)):null;
    const leg=outLeg(trail);
    const {up:legUp,down:legDown}=profileClimb(leg);
    let up=null,down=null;
    if(roundClimb!==null){
      const share=legUp+legDown>0?legUp/(legUp+legDown):0.5;
      up=Math.round(roundClimb*share);
      down=Math.round(roundClimb-up);
    }
    return {
      ...trail,
      distance:Math.round(roundKm/2*10)/10,
      elevation:up,
      descent:down,
      hours:null,
      elevationProfile:leg.length>1?leg:trail.elevationProfile,
      routeShape:'point-to-point',
      oneWayOf:{
        roundTripDistance:roundKm,
        roundTripClimb:roundClimb,
        roundTripHours:trail.hours==null?null:trail.hours,
        climbEstimated:true,
        hoursPublished:false,
      },
    };
  }

  // The view a walk opens on is the one its source describes: a one-way
  // walk one way, an out-and-back walk there and back. The reader can switch
  // on the trail page; the choice holds for that walk while the page is open
  // (not remembered between pages), and every score on the page follows it
  // (scoring.js).
  function sourceView(trail){
    return isThereAndBack(trail)?VIEWS.OUT_AND_BACK:VIEWS.ONE_WAY;
  }
  const chosen=new Map();
  function keyOf(trail){
    return trail&&trail.id!=null?String(trail.id):'';
  }
  function view(trail){
    return chosen.get(keyOf(trail))||sourceView(trail);
  }
  function setView(next,trail){
    const value=next===VIEWS.ONE_WAY?VIEWS.ONE_WAY:VIEWS.OUT_AND_BACK;
    if(!trail||value===view(trail))return;
    if(value===sourceView(trail))chosen.delete(keyOf(trail));
    else chosen.set(keyOf(trail),value);
    if(typeof window!=='undefined'&&typeof window.dispatchEvent==='function'&&typeof CustomEvent==='function'){
      window.dispatchEvent(new CustomEvent('orma-route-view-changed',{detail:{view:value,id:keyOf(trail)}}));
    }
  }
  // The trail as the page should show and score it right now.
  function forView(trail){
    if(!hasChoice(trail))return trail;
    const wanted=view(trail);
    if(wanted===VIEWS.OUT_AND_BACK&&isOneWay(trail))return outAndBack(trail);
    if(wanted===VIEWS.ONE_WAY&&isThereAndBack(trail))return oneWayLeg(trail);
    return trail;
  }

  // Hours as a reader says them: "3.9" is "3 h 55 min", not 3 h 9 min.
  // Rounded to 5 minutes; a range keeps both ends ("1 h 30 min – 2 h",
  // "2–3 h"). Empty when there is no number to read.
  function durationParts(hours){
    const minutes=Math.max(5,Math.round(hours*12)*5);
    return {h:Math.floor(minutes/60),m:minutes%60};
  }
  function durationText({h,m}){
    if(!h)return `${m} min`;
    return m?`${h} h ${m} min`:`${h} h`;
  }
  function formatDuration(value){
    const bounds=parseHoursRange(value);
    if(!bounds)return '';
    const parts=bounds.map(durationParts);
    const texts=parts.map(durationText).filter((v,i,all)=>all.indexOf(v)===i);
    if(texts.length===1)return texts[0];
    if(parts.every(p=>p.h&&!p.m))return `${parts[0].h}–${parts[1].h} h`;
    if(parts.every(p=>!p.h))return `${parts[0].m}–${parts[1].m} min`;
    return texts.join(' – ');
  }

  return {VIEWS,isOneWay,isThereAndBack,hasChoice,sourceView,netGain,parseHoursRange,formatHours,formatDuration,ruleHours,outAndBack,oneWayLeg,view,setView,forView};
});
