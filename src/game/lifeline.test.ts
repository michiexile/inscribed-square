import { describe, expect, it } from 'vitest';
import { lifeLeft } from './lifeline';

describe('lifeLeft', () => {
  it('converts a known death to real seconds left at the level speed', () => {
    // Death 4 morph seconds ahead at 2x speed is 2 real seconds away.
    expect(lifeLeft(14, 10, 2, 6)).toEqual({ seconds: 2, fraction: 2 / 6, label: '2 s' });
  });

  it('shows a square with no known death as full, labelled as at least the horizon', () => {
    expect(lifeLeft(undefined, 10, 1, 6)).toEqual({ seconds: Infinity, fraction: 1, label: '6+ s' });
  });

  it('rounds the label up, so a square never reads 0 s while still alive', () => {
    expect(lifeLeft(10.2, 10, 1, 6).label).toBe('1 s');
    expect(lifeLeft(12.6, 10, 1, 6).label).toBe('3 s');
  });
});
