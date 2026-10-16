'use strict';

const {latestOutputsByAgent}=require('./workflows/gate-dry-run');
const {timeValue}=require('./workflows/advance-trail-orchestration');

// The gate dry run exists to say what the gate would decide, and it was reading
// an arbitrary survey.
//
// A Firestore timestamp arrives as an object, so `String(at)` is
// "[object Object]" for every job: the comparison was always false and the
// FIRST job won, whichever that happened to be. Boucle du Taillefer has eleven
// surveys, and the one shown on 16 October 2026 predated the marks that say
// whether a walk carries a number -- so a fresh survey looked like no survey,
// and an afternoon went on why the landmark answer would not fire for a trail
// that had already been measured.
//
// The orchestration has always handled this. One definition now serves both.

// How Firestore hands a timestamp back, which is not a string.
const stamp=iso=>({seconds:Math.floor(Date.parse(iso)/1000),nanoseconds:0,
  toMillis(){return Date.parse(iso);}});

const job=(id,completedAt)=>({id,candidateId:'osm-14864704',agentId:'cartographer',
  status:'completed',completedAt});

describe('newest means newest',()=>{
  test('a Firestore timestamp orders correctly, whatever order the jobs arrive in',()=>{
    const old=job('cartographer-1',stamp('2026-10-10T09:00:00Z'));
    const fresh=job('cartographer-11',stamp('2026-10-16T12:03:52Z'));
    for(const jobs of [[old,fresh],[fresh,old]]){
      expect(latestOutputsByAgent(jobs,'osm-14864704',id=>({id})))
        .toEqual([{agentId:'cartographer',jobId:'cartographer-11',result:{id:'cartographer-11'}}]);
    }
  });

  test('the bug it replaces: every such timestamp stringifies the same',()=>{
    // Which is why the comparison was always false and the first job won.
    expect(String(stamp('2026-10-10T09:00:00Z'))).toBe(String(stamp('2026-10-16T12:03:52Z')));
    // And why timeValue is needed instead.
    expect(timeValue(stamp('2026-10-16T12:03:52Z')))
      .toBeGreaterThan(timeValue(stamp('2026-10-10T09:00:00Z')));
  });

  test('an ISO string still orders, because both shapes turn up',()=>{
    const jobs=[job('cartographer-11','2026-10-16T12:03:52Z'),job('cartographer-1','2026-10-10T09:00:00Z')];
    expect(latestOutputsByAgent(jobs,'osm-14864704',id=>({id}))[0].jobId).toBe('cartographer-11');
  });

  test('one newest per agent, and only completed jobs',()=>{
    const jobs=[
      job('cartographer-1',stamp('2026-10-10T09:00:00Z')),
      job('cartographer-2',stamp('2026-10-16T09:00:00Z')),
      {...job('logistics-1',stamp('2026-10-15T09:00:00Z')),agentId:'logistics'},
      {...job('cartographer-9',stamp('2026-10-16T23:00:00Z')),status:'blocked'},
    ];
    const got=latestOutputsByAgent(jobs,'osm-14864704',id=>({id}));
    expect(got.map(output=>output.jobId).sort()).toEqual(['cartographer-2','logistics-1']);
  });

  test('a job whose output is missing is dropped, not substituted',()=>{
    const jobs=[job('cartographer-11',stamp('2026-10-16T12:00:00Z'))];
    expect(latestOutputsByAgent(jobs,'osm-14864704',()=>null)).toEqual([]);
  });

  test('another trail’s jobs are not this trail’s',()=>{
    const jobs=[{...job('cartographer-1',stamp('2026-10-16T09:00:00Z')),candidateId:'osm-other'}];
    expect(latestOutputsByAgent(jobs,'osm-14864704',id=>({id}))).toEqual([]);
  });
});
