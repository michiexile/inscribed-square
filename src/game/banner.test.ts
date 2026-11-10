import { describe, expect, it } from 'vitest';
import { foldsBanner, huntBanner, introBanner } from './banner';

describe('foldsBanner', () => {
  it('shows nothing while searching or holding', () => {
    expect(foldsBanner({ phase: 'searching', graceLeft: 0 }, 0, 0, 0)).toBeNull();
    expect(foldsBanner({ phase: 'holding', graceLeft: 0 }, 5, 1, 5)).toBeNull();
  });

  it('counts the grace time down in whole seconds, rounding up so it never shows 0 before the end', () => {
    expect(foldsBanner({ phase: 'lost', graceLeft: 2100 }, 4, 0, 4)?.title).toBe('Lost it! 3');
    expect(foldsBanner({ phase: 'lost', graceLeft: 1 }, 4, 0, 4)?.title).toBe('Lost it! 1');
  });

  it('keeps the round result on screen with a button to play again', () => {
    const b = foldsBanner({ phase: 'over', graceLeft: 0 }, 23.44, 2, 31.2);
    expect(b?.title).toBe('Round over');
    expect(b?.detail).toBe('23.4 s held · 2 saved · best 31.2 s');
    expect(b?.action).toEqual({ label: 'Play again', kind: 'again' });
  });

  it('celebrates a cleared level', () => {
    const b = foldsBanner({ phase: 'won', graceLeft: 0 }, 20, 3, 20);
    expect(b?.tone).toBe('win');
    expect(b?.title).toBe('Cleared!');
    expect(b?.detail).toBe('20.0 s held · 3 saved');
  });
});

describe('huntBanner', () => {
  it('celebrates once every square is found, and not before', () => {
    expect(huntBanner(2, 3)).toBeNull();
    expect(huntBanner(3, 3)?.title).toBe('All 3 squares found!');
    expect(huntBanner(0, 0)).toBeNull();
  });
});

describe('introBanner', () => {
  it('explains the control actually in use: two thumbs for corners, one for the centre', () => {
    expect(introBanner('hunt', 'corners', undefined).detail).toMatch(/two thumbs/i);
    expect(introBanner('hunt', 'centre', undefined).detail).toMatch(/one thumb/i);
  });

  it("tells Avoid Folds players the level's goal and the grace time", () => {
    const b = introBanner('folds', 'corners', 20);
    expect(b.detail).toMatch(/20 s/);
    expect(b.detail).toMatch(/3 seconds/);
    expect(b.tone).toBe('info');
  });
});
