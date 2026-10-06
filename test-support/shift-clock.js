'use strict';

/**
 * Run the suite at a date in the future, to find tests that will break on
 * their own.
 *
 * homepage-conditions.test.js asked for the forecast for '2026-10-02', which
 * was comfortably ahead when it was written. On 2 October 2026 it became
 * today, load() stopped taking the future-day branch, and main went red with
 * no commit behind it. Nothing was wrong with the code, and the failure
 * pointed at whichever branch happened to rebase onto it next.
 *
 * A date-shifted run finds that class before the calendar does:
 *
 *   CLOCK_SHIFT_DAYS=365 npx jest --setupFilesAfterEnv=./test-support/shift-clock.js
 *
 * It is not part of the normal run -- a suite that must pass at every future
 * date cannot assert anything about today -- so it is a sweep to repeat now
 * and then, not a gate.
 */
const SHIFT_MS = Number(process.env.CLOCK_SHIFT_DAYS || 180) * 24 * 60 * 60 * 1000;
const RealDate = Date;
class ShiftedDate extends RealDate {
  constructor(...args){
    if(args.length === 0) super(RealDate.now() + SHIFT_MS);
    else super(...args);
  }
  static now(){ return RealDate.now() + SHIFT_MS; }
}
ShiftedDate.parse = RealDate.parse;
ShiftedDate.UTC = RealDate.UTC;
global.Date = ShiftedDate;
