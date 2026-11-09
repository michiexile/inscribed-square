import { describe, expect, it } from 'vitest';
import { foldsBanner, huntBanner } from './banner';

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
    expect(b?.action).toBe('Play again');
  });
});

describe('huntBanner', () => {
  it('celebrates once every square is found, and not before', () => {
    expect(huntBanner(2, 3)).toBeNull();
    expect(huntBanner(3, 3)?.title).toBe('All 3 squares found!');
    expect(huntBanner(0, 0)).toBeNull();
  });
});
