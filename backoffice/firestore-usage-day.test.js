'use strict';

/**
 * The board said "about 30 passes left in today's free allowance". It was
 * computing `50,000 / cost-per-pass` and subtracting nothing, so it read "30
 * left" whether the day was untouched or nearly gone — and it was asked exactly
 * that question ("can I run a drain today?") the day it shipped.
 */

const {quotaDay,accumulateUsage,describeDayUsage,
  DAILY_FREE_READS}=require('./workflows/firestore-usage-day');

const NOON='2026-10-09T12:00:00.000Z';

describe('the day boundary is Firestore\'s own, not UTC', () => {
  test('it rolls at midnight US-Pacific in summer time', () => {
    expect(quotaDay('2026-10-09T06:59:00Z')).toBe('2026-10-08');
    expect(quotaDay('2026-10-09T07:01:00Z')).toBe('2026-10-09');
  });

  test('and an hour later in winter, which a fixed offset would get wrong', () => {
    expect(quotaDay('2026-01-15T07:59:00Z')).toBe('2026-01-14');
    expect(quotaDay('2026-01-15T08:01:00Z')).toBe('2026-01-15');
  });
});

describe('a day accumulates, then resets by itself', () => {
  test('passes add up', () => {
    let usage=null;
    for(let pass=0;pass<8;pass+=1)usage=accumulateUsage(usage,{reads:1650,writes:50},NOON);
    expect(usage).toMatchObject({day:'2026-10-09',reads:13_200,writes:400,passes:8});
  });

  test('yesterday\'s total is replaced, not added to', () => {
    const yesterday={day:'2026-10-08',reads:48_000,writes:900,passes:30};
    const today=accumulateUsage(yesterday,{reads:1650,writes:50},NOON);
    expect(today).toMatchObject({day:'2026-10-09',reads:1650,passes:1});
  });

  test('it keeps the window it covers, so nobody assumes it starts at the reset', () => {
    const first=accumulateUsage(null,{reads:100},'2026-10-09T09:00:00Z');
    const later=accumulateUsage(first,{reads:100},'2026-10-09T18:00:00Z');
    expect(later.firstSeenAt).toBe(first.firstSeenAt);
    expect(later.updatedAt).not.toBe(first.updatedAt);
  });

  test('a negative or missing figure cannot reduce the total', () => {
    const usage=accumulateUsage({day:quotaDay(NOON),reads:500,writes:10,passes:1},
      {reads:-9000},NOON);
    expect(usage.reads).toBe(500);
    expect(accumulateUsage(null,{},NOON).reads).toBe(0);
  });
});

describe('what the board is told', () => {
  const eightPasses=()=>{
    let usage=null;
    for(let pass=0;pass<8;pass+=1)usage=accumulateUsage(usage,{reads:1650,writes:50},NOON);
    return usage;
  };

  test('it reports what is left, not what a whole free day would fund', () => {
    const described=describeDayUsage(eightPasses(),1650);
    expect(described).toMatchObject({readsSoFar:13_200,sharePercent:26,
      remainingReads:DAILY_FREE_READS-13_200,passesLeft:22});
    // The old figure was 50,000/1,650 = 30, at any hour of any day.
    expect(described.passesLeft).not.toBe(30);
  });

  test('it says "at least", because the desk reads Firestore directly', () => {
    const described=describeDayUsage(eightPasses(),1650);
    expect(described.sentence).toMatch(/^At least 13,200 of 50,000/);
    expect(described.sentence).toMatch(/desk reads Firestore directly and is not counted/);
  });

  test('an exhausted day leaves no room, and never goes negative', () => {
    const described=describeDayUsage({day:'2026-10-09',reads:62_000,writes:0,passes:40},1650);
    expect(described.remainingReads).toBe(0);
    expect(described.passesLeft).toBe(0);
  });

  test('before any pass has reported a cost, it does not guess at how many fit', () => {
    expect(describeDayUsage({day:'2026-10-09',reads:0,writes:0,passes:0},0).passesLeft).toBeNull();
  });

  test('no total yet is nothing to show, not a zero', () => {
    expect(describeDayUsage(null,1650)).toBeNull();
  });
});
