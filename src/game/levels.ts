import type { Polygon } from '../geometry/polygon';
import { randomCurve } from '../geometry/random';
import { findSquares } from '../geometry/solver';
import { TOLERANCE } from './feel';
import { huntProblems } from './validate';

/**
 * The game modes. Each level launches one of them.
 * - `hunt`: Square Hunt. Find every inscribed square of a still curve.
 * - `folds`: Avoid Folds. Stay on an inscribed square of a morphing curve; when it folds away, jump to another.
 */
export type ModeId = 'hunt' | 'folds';

export const MODE_NAMES: Record<ModeId, string> = { hunt: 'Square Hunt', folds: 'Avoid Folds' };

/**
 * A level, or a random curve played in one mode (id null). The seed picks the curve: `randomCurve(seed)` for Square
 * Hunt, `new MorphingCurve(seed)` for Avoid Folds.
 */
export interface Level {
  readonly id: string | null;
  readonly name: string;
  readonly mode: ModeId;
  readonly seed: number;
  /** Avoid Folds only: morph seconds per real second. Default 1. Later levels morph faster. */
  readonly speed?: number;
  /** Avoid Folds only: seconds held in one round that clear the level. Random curves have none and run until lost. */
  readonly goal?: number;
}

/**
 * The campaign, in the order it is played. It opens with two still curves so the control is learnt before the curve
 * moves, then alternates modes. Goals are guesses (#12).
 */
export const LEVELS: readonly Level[] = [
  { id: 'hunt-1', name: 'Three squares', mode: 'hunt', seed: 1 },
  { id: 'hunt-2', name: 'Five squares', mode: 'hunt', seed: 2 },
  { id: 'folds-1', name: 'Drift', mode: 'folds', seed: 1, goal: 20 },
  { id: 'hunt-3', name: 'Seven squares', mode: 'hunt', seed: 5 },
  { id: 'folds-2', name: 'Undertow', mode: 'folds', seed: 2, speed: 1.5, goal: 25 },
  { id: 'hunt-4', name: 'Nine squares', mode: 'hunt', seed: 51 },
  { id: 'folds-3', name: 'Churn', mode: 'folds', seed: 5, speed: 2, goal: 30 },
  { id: 'folds-4', name: 'Rapids', mode: 'folds', seed: 3, speed: 3, goal: 30 },
];

/** The level after this one in the campaign, or null after the last level or a random curve. */
export function nextLevel(level: Level): Level | null {
  const i = level.id === null ? -1 : LEVELS.findIndex((l) => l.id === level.id);
  return i >= 0 && i + 1 < LEVELS.length ? LEVELS[i + 1] : null;
}

/** A random curve in the given mode. */
export const randomLevel = (mode: ModeId, seed: number): Level => ({ id: null, name: 'Random', mode, seed });

/**
 * The first seed from `seed` on whose Square Hunt curve passes `huntProblems`, so a random curve never has squares
 * the player cannot tell apart. About one seed in seven is skipped.
 */
export function fitHuntSeed(seed: number): number {
  for (let s = seed; ; s++) {
    const curve = randomCurve(s);
    if (huntProblems(curve, findSquares(curve), TOLERANCE).length === 0) return s;
  }
}

/** The still curve of a Square Hunt level. */
export const levelCurve = (level: Level): Polygon => randomCurve(level.seed);

/** The URL hash for a level: `#hunt-2` for a level, `#folds/123` for a random curve. */
export const routeOf = (level: Level): string => (level.id ? `#${level.id}` : `#${level.mode}/${level.seed}`);

/** The level a URL hash names, or null for the menu. A bare number (`#992259`) is Square Hunt on that curve. */
export function parseRoute(hash: string): Level | null {
  const h = hash.replace(/^#/, '');
  const level = LEVELS.find((l) => l.id === h);
  if (level) return level;
  const random = /^(hunt|folds)\/(\d+)$/.exec(h);
  if (random) return randomLevel(random[1] as ModeId, Number(random[2]));
  if (/^\d+$/.test(h)) return randomLevel('hunt', Number(h));
  return null;
}
