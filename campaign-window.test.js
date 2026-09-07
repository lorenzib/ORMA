const { nextCampaignWindow } = require('./backoffice/workflows/campaign-scheduler');

// On 2026-09-07 the campaign skipped the day. Its cron is 09:30 Europe/Rome,
// but eligibility was "24 hours after the last success" and the previous run
// had come from the worker at 12:12 UTC, so the next window was 12:12 -- four
// hours after the cron fired. Two paths can run the campaign, and whenever the
// worker won, the following morning was lost.

const romeTime = iso => new Intl.DateTimeFormat('en-GB', {
  timeZone:'Europe/Rome', hour:'2-digit', minute:'2-digit', hour12:false,
}).format(new Date(iso));

const romeDate = iso => new Intl.DateTimeFormat('en-CA', {
  timeZone:'Europe/Rome', year:'numeric', month:'2-digit', day:'2-digit',
}).format(new Date(iso));

describe('eligibility lands on the campaign window, not a rolling interval', () => {
  test('the exact case that skipped a day now falls before the cron', () => {
    // Yesterday's success, from the worker rather than the cron.
    const next = nextCampaignWindow('2026-09-06T12:12:38.819Z');
    expect(romeDate(next)).toBe('2026-09-07');
    expect(romeTime(next)).toBe('09:30');
    // The cron fired at 07:44 UTC and was told "not due". Now it is due.
    expect(new Date('2026-09-07T07:44:00Z') >= new Date(next)).toBe(true);
  });

  test('a run inside its own window waits for the next day, not minutes later', () => {
    const next = nextCampaignWindow('2026-09-07T07:35:00Z'); // 09:35 Rome
    expect(romeDate(next)).toBe('2026-09-08');
    expect(romeTime(next)).toBe('09:30');
  });

  test('a run before the window is eligible the same morning', () => {
    // The quota resets around 09:00 Rome, so a 02:00 run must not consume the day.
    const next = nextCampaignWindow('2026-09-07T00:00:00Z'); // 02:00 Rome
    expect(romeDate(next)).toBe('2026-09-07');
    expect(romeTime(next)).toBe('09:30');
  });

  test('the window stays at 09:30 local across the DST change', () => {
    // Europe/Rome leaves CEST on 2026-10-25. Local time is what matters, since
    // the cron is expressed in local time too.
    const beforeDst = nextCampaignWindow('2026-10-24T12:00:00Z');
    const afterDst = nextCampaignWindow('2026-10-26T12:00:00Z');
    expect(romeTime(beforeDst)).toBe('09:30');
    expect(romeTime(afterDst)).toBe('09:30');
  });

  test('whoever ran it last, the next morning is still eligible', () => {
    for(const hour of ['00:05','07:31','12:12','18:40','23:50']){
      const next = nextCampaignWindow(`2026-09-06T${hour}:00Z`);
      expect(romeTime(next)).toBe('09:30');
      // Always within the next day, never skipping one.
      expect(new Date(next) - new Date(`2026-09-06T${hour}:00Z`)).toBeLessThan(36 * 60 * 60 * 1000);
    }
  });
});
