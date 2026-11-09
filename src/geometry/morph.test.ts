import { describe, expect, it } from 'vitest';
import { MorphingCurve } from './morph';
import { findSquares } from './solver';
import { dist } from './vec';

describe('MorphingCurve', () => {
  it('gives the same curve for the same seed and time', () => {
    expect(new MorphingCurve(3).at(12.5).vertices).toEqual(new MorphingCurve(3).at(12.5).vertices);
    expect(new MorphingCurve(3).at(12.5).vertices).not.toEqual(new MorphingCurve(4).at(12.5).vertices);
  });

  it('moves continuously: no vertex moves faster than a fixed speed', () => {
    // A morph that cuts between keyframes, or renormalises with a discontinuous factor, jumps somewhere in a minute.
    const m = new MorphingCurve(5);
    const dt = 0.01;
    let worst = 0;
    for (let time = 0; time < 60; time += dt) {
      const a = m.at(time).vertices;
      const b = m.at(time + dt).vertices;
      for (let i = 0; i < a.length; i++) worst = Math.max(worst, dist(a[i], b[i]) / dt);
    }
    expect(worst).toBeLessThan(m.maxSpeed);
    expect(worst).toBeGreaterThan(m.maxSpeed / 20); // and it does move
  });

  it('stays simple and keeps every harmonic, so it never passes through a symmetric curve', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const m = new MorphingCurve(seed);
      for (let time = 0; time < 300; time += 0.7) {
        const hs = m.harmonicsAt(time);
        const total = hs.reduce((acc, h) => acc + h.amplitude, 0);
        expect(total).toBeLessThan(0.9);
        for (const h of hs) expect(h.amplitude).toBeGreaterThan(0.01);
      }
    }
  });

  it('changes its square count within a minute, so folds happen', () => {
    const m = new MorphingCurve(1);
    const counts = new Set<number>();
    for (let time = 0; time < 60; time += 2) counts.add(findSquares(m.at(time)).length);
    expect(counts.size).toBeGreaterThan(1);
  });
});
