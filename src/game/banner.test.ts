import { describe, expect, it } from 'vitest';
import {
  buildBanner,
  countBanner,
  foldsBanner,
  huntBanner,
  introBanner,
  predictBanner,
  steerBanner,
} from './banner';

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
  it('explains the control actually in use: two thumbs for corners, one finger for the centre', () => {
    expect(introBanner('hunt', 'corners', undefined).detail).toMatch(/two thumbs/i);
    expect(introBanner('hunt', 'centre', undefined).detail).toMatch(/one finger/i);
    // The finger works like a trackpad, so it can stay off the curve.
    expect(introBanner('hunt', 'centre', undefined).detail).toMatch(/anywhere/i);
    expect(introBanner('hunt', 'centre', undefined).detail).toMatch(/teal/i);
  });

  it("tells Avoid Folds players the level's goal and the grace time", () => {
    const b = introBanner('folds', 'corners', 20);
    expect(b.detail).toMatch(/20 s/);
    expect(b.detail).toMatch(/3 seconds/);
    expect(b.tone).toBe('info');
  });
});

describe('countBanner', () => {
  const wrong = (found: number, even: boolean, at = 0) => ({
    result: { right: false as const, even },
    at,
    found,
  });

  it('never shows the count before the level is cleared', () => {
    expect(countBanner(null, 0, false, 5, 0)).toBeNull();
    const b = countBanner(wrong(4, true), 100, false, 5, 1);
    expect(JSON.stringify(b)).not.toMatch(/5/);
  });

  it('points at an even count after a wrong claim, without saying how many are left', () => {
    const b = countBanner(wrong(4, true), 100, false, 5, 1);
    expect(b?.tone).toBe('warn');
    expect(b?.detail).toMatch(/4 is even/);
  });

  it('says only that there are more after a short odd count', () => {
    const b = countBanner(wrong(3, false), 100, false, 5, 1);
    expect(b?.detail).not.toMatch(/even|odd/);
  });

  it('asks for a square first after claiming with none found', () => {
    expect(countBanner(wrong(0, true), 100, false, 5, 1)?.detail).not.toMatch(/even/);
  });

  it('lets a wrong-claim message fade after a few seconds', () => {
    expect(countBanner(wrong(4, true), 2000, false, 5, 1)).not.toBeNull();
    expect(countBanner(wrong(4, true), 5000, false, 5, 1)).toBeNull();
  });

  it('shows the count once cleared, with the wrong guesses', () => {
    expect(countBanner(null, 0, true, 5, 0)).toMatchObject({
      title: 'All 5 found!',
      detail: 'First try',
      tone: 'win',
    });
    expect(countBanner(null, 0, true, 5, 2)?.detail).toBe('After 2 wrong guesses');
    expect(countBanner(null, 0, true, 5, 1)?.detail).toBe('After 1 wrong guess');
  });
});

describe('introBanner for Odd One Out', () => {
  it("names the That's all button and hides the count", () => {
    const b = introBanner('count', 'corners', undefined);
    expect(b.detail).toMatch(/That's all/);
    expect(b.detail).toMatch(/two thumbs/i);
  });
});

describe('introBanner for Lifelines', () => {
  it('says each square shows its time left, and names the goal and grace time', () => {
    const b = introBanner('choice', 'centre', 30);
    expect(b.detail).toMatch(/how long/i);
    expect(b.detail).toMatch(/30 s/);
    expect(b.detail).toMatch(/3 seconds/);
    expect(b.detail).toMatch(/one finger/i);
  });
});

describe('predictBanner', () => {
  const state = (phase: 'asking' | 'answered' | 'done', right: boolean | null, score = 0) => ({
    phase,
    last: right === null ? null : { id: 1, right },
    score,
    length: 5,
    goal: 4,
  });

  it('shows nothing while asking', () => {
    expect(predictBanner(state('asking', null))).toBeNull();
  });

  it('says whether an answer was right while the fold plays out', () => {
    expect(predictBanner(state('answered', true))).toMatchObject({ title: 'Right!', tone: 'win' });
    expect(predictBanner(state('answered', false))).toMatchObject({ title: 'Not that one', tone: 'warn' });
  });

  it('clears with enough right, and offers another go without', () => {
    expect(predictBanner(state('done', null, 4))).toMatchObject({
      title: 'Cleared!',
      detail: '4 of 5 right',
    });
    expect(predictBanner(state('done', null, 3))).toMatchObject({
      title: '3 of 5 right',
      detail: 'You need 4.',
      action: { label: 'Play again', kind: 'again' },
    });
  });
});

describe('introBanner for Fold Forecast', () => {
  it('asks for one of the pair, by tapping', () => {
    const b = introBanner('predict', 'centre', undefined);
    expect(b.detail).toMatch(/two of these squares/i);
    expect(b.detail).toMatch(/tap the card/i);
    expect(b.detail).toMatch(/closing in/i);
  });
});

describe('steerBanner', () => {
  it('shows nothing while playing', () => {
    expect(steerBanner('playing')).toBeNull();
  });

  it('celebrates a win, and explains a loss with a retry', () => {
    expect(steerBanner('won')).toMatchObject({ title: 'Cleared!', tone: 'win' });
    expect(steerBanner('lost')).toMatchObject({
      tone: 'over',
      action: { label: 'Try again', kind: 'again' },
    });
    expect(steerBanner('lost')?.detail).toMatch(/met another square/);
  });
});

describe('introBanner for Steer the Curve', () => {
  it('names the gold and red squares and says squares vanish in pairs', () => {
    const b = introBanner('steer', 'centre', undefined);
    expect(b.detail).toMatch(/gold/);
    expect(b.detail).toMatch(/red/);
    expect(b.detail).toMatch(/pairs/);
  });
});

describe('buildBanner', () => {
  it('celebrates only a met target', () => {
    expect(buildBanner({ count: 5, settled: true, met: true })).toMatchObject({
      title: 'Built!',
      tone: 'win',
    });
    expect(buildBanner({ count: 5, settled: true, met: false })).toBeNull();
  });
});

describe('introBanner for Build a Curve', () => {
  it('names the target count and says lifting the finger counts', () => {
    const b = introBanner('build', 'centre', 5);
    expect(b.detail).toMatch(/exactly 5 squares/);
    expect(b.detail).toMatch(/lift/i);
  });
});
