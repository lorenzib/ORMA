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
});
