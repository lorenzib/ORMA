const states = require('./community-content-states');

describe('MOD-01 community content state contract', () => {
  test('defines the accepted lifecycle once', () => {
    expect(states.STATES).toEqual([
      'draft', 'pending', 'visible', 'reported', 'hidden', 'removed',
    ]);
    expect(states.SERVER_STATES).not.toContain('draft');
  });

  test.each(['review', 'photo', 'hazard'])(
    'holds first and later %s submissions for moderation',
    type => expect(states.POLICIES[type]).toMatchObject({
      initialServerState:'pending',
      firstContributionState:'pending',
    })
  );

  test('only pending is client-creatable and author edits return to pending', () => {
    expect(states.canClientCreate('pending')).toBe(true);
    ['draft', 'visible', 'reported', 'hidden', 'removed'].forEach(status => {
      expect(states.canClientCreate(status)).toBe(false);
    });
    expect(states.authorEditState('visible')).toBe('pending');
  });

  test('ratings include only publicly displayed reviews', () => {
    expect(states.countsTowardRating('visible')).toBe(true);
    expect(states.countsTowardRating('reported')).toBe(true);
    ['draft', 'pending', 'hidden', 'removed'].forEach(status => {
      expect(states.countsTowardRating(status)).toBe(false);
    });
  });

  test('moderator transitions are explicit', () => {
    expect(states.canModeratorTransition('pending', 'visible')).toBe(true);
    expect(states.canModeratorTransition('visible', 'reported')).toBe(true);
    expect(states.canModeratorTransition('reported', 'visible')).toBe(true);
    expect(states.canModeratorTransition('removed', 'visible')).toBe(true);
    expect(states.canModeratorTransition('pending', 'reported')).toBe(false);
    expect(states.canModeratorTransition('visible', 'pending')).toBe(false);
  });

  test('hazard expiry is type-specific', () => {
    const start = new Date('2026-07-30T10:00:00Z');
    expect(states.hazardExpiryDate('water-dry', start).toISOString())
      .toBe('2026-08-06T10:00:00.000Z');
    expect(states.hazardExpiryDate('guard-dogs-livestock', start).toISOString())
      .toBe('2026-08-13T10:00:00.000Z');
    expect(states.hazardExpiryDate('dangerous-terrain', start).toISOString())
      .toBe('2026-08-29T10:00:00.000Z');
    expect(states.hazardExpiryDate('not-dog-friendly', start).toISOString())
      .toBe('2026-10-28T10:00:00.000Z');
  });

  test('hazard trust keeps official, ORMA, and community evidence distinct', () => {
    expect(states.hazardTrustState({ confirmationSource:'official' }))
      .toBe('official-confirmed');
    expect(states.hazardTrustState({ confirmationSource:'dolopaws-reviewed' }))
      .toBe('dolopaws-reviewed');
    expect(states.hazardTrustState({ confirmations:2, disputes:0 }))
      .toBe('community-confirmed');
    expect(states.hazardTrustState({ confirmations:1, disputes:2 }))
      .toBe('community-disputed');
    expect(states.hazardTrustState({ confirmations:1, disputes:0 }))
      .toBe('unconfirmed');
  });

  test('missing or elapsed expiry is never active', () => {
    const now = new Date('2026-07-30T10:00:00Z');
    expect(states.hazardIsExpired({}, now)).toBe(true);
    expect(states.hazardIsExpired({ expiresAt:new Date('2026-07-30T09:59:59Z') }, now))
      .toBe(true);
    expect(states.hazardIsExpired({ expiresAt:new Date('2026-07-30T10:00:01Z') }, now))
      .toBe(false);
  });
});
