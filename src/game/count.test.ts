import { describe, expect, it } from 'vitest';
import { Claims } from './count';

describe('Claims', () => {
  it('clears the level only when every square is found', () => {
    const c = new Claims();
    expect(c.claim(5, 5, 0)).toEqual({ right: true });
    expect(c.cleared).toBe(true);
    expect(c.wrong).toBe(0);
  });

  it('marks a short even count as even, which proves a square is missing', () => {
    const c = new Claims();
    expect(c.claim(4, 5, 0)).toEqual({ right: false, even: true });
    expect(c.wrong).toBe(1);
    expect(c.cleared).toBe(false);
  });

  it('gives no parity hint for a short odd count, since an odd count can still be short', () => {
    const c = new Claims();
    expect(c.claim(3, 5, 0)).toEqual({ right: false, even: false });
  });

  it('remembers the last claim and when it was made, and stays cleared after a later claim', () => {
    const c = new Claims();
    c.claim(2, 3, 100);
    expect(c.last).toEqual({ result: { right: false, even: true }, at: 100, found: 2 });
    c.claim(3, 3, 900);
    c.claim(3, 3, 1200);
    expect(c.cleared).toBe(true);
    expect(c.wrong).toBe(1);
  });
});
