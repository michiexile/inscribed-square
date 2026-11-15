import type { Polygon } from '../geometry/polygon';
import { randomCurve } from '../geometry/random';
import { findSquares } from '../geometry/solver';
import { TOLERANCE } from './feel';
import { huntProblems } from './validate';

/**
 * The game modes. Each level launches one of them.
 * - `hunt`: Square Hunt. Find every inscribed square of a still curve.
 * - `folds`: Avoid Folds. Stay on an inscribed square of a morphing curve; when it folds away, jump to another.
 * - `count`: Odd One Out. Square Hunt with the count hidden; the player says when they have found them all.
 * - `choice`: Lifelines. Avoid Folds where every square shows how long it has left, so where to jump after a fold is
 *   a choice.
 * - `predict`: Fold Forecast. A morphing curve stops just before a fold; the player taps one of the two squares about
 *   to fold away.
 * - `steer`: Steer the Curve. The player reshapes a still curve to make a target square fold away while keeping
 *   their own.
 */
export type ModeId = 'hunt' | 'folds' | 'count' | 'choice' | 'predict' | 'steer';

export const MODE_NAMES: Record<ModeId, string> = {
  hunt: 'Square Hunt',
  folds: 'Avoid Folds',
  count: 'Odd One Out',
  choice: 'Lifelines',
  predict: 'Fold Forecast',
  steer: 'Steer the Curve',
};

/** Whether the mode plays on a still curve, `randomCurve(seed)`. */
export const isStill = (mode: ModeId): boolean => mode === 'hunt' || mode === 'count';

/** Whether the mode is played on a morphing curve by holding squares: Avoid Folds and Lifelines. */
export const isHeld = (mode: ModeId): boolean => mode === 'folds' || mode === 'choice';

/**
 * A level, or a random curve played in one mode (id null). The seed picks the curve: `randomCurve(seed)` for Square
 * Hunt and Odd One Out, `new MorphingCurve(seed)` for the morphing modes.
 */
export interface Level {
  readonly id: string | null;
  readonly name: string;
  readonly mode: ModeId;
  readonly seed: number;
  /** Morphing modes only: morph seconds per real second. Default 1. Later levels morph faster. */
  readonly speed?: number;
  /**
   * Steer the Curve only: the square to keep and the squares to fold away, as indices into `findSquares` of the
   * level's curve, and a push that clears it (`delta` per step at angle `psi`, `steps` times) to prove it can be
   * cleared. Random curves pick with `steerPick`.
   */
  readonly keeper?: number;
  readonly targets?: readonly number[];
  readonly hint?: { readonly psi: number; readonly delta: number; readonly steps: number };
  /** Fold Forecast only: the morph times its rounds stop at; random curves search for rounds instead. */
  readonly rounds?: readonly number[];
  /** Fold Forecast only: about how many morph seconds before the fold each question is asked. */
  readonly warning?: number;
  /**
   * Morphing modes: seconds held in one round that clear the level; Fold Forecast: right answers that clear it. Random morphing curves have none and run until lost.
   */
  readonly goal?: number;
}

/**
 * The campaign, in the order it is played. It opens with two still curves so the control is learnt before the curve
 * moves; their names show odd counts before the first Odd One Out level hides the count. Goals are guesses (#12).
 */
export const LEVELS: readonly Level[] = [
  { id: 'hunt-1', name: 'Three squares', mode: 'hunt', seed: 1 },
  { id: 'hunt-2', name: 'Five squares', mode: 'hunt', seed: 2 },
  { id: 'count-1', name: 'How many?', mode: 'count', seed: 100 },
  { id: 'folds-1', name: 'Drift', mode: 'folds', seed: 1, goal: 20 },
  { id: 'hunt-3', name: 'Seven squares', mode: 'hunt', seed: 5 },
  { id: 'choice-1', name: 'Lifeboats', mode: 'choice', seed: 9, goal: 30 },
  {
    id: 'predict-1',
    name: 'Pairs',
    mode: 'predict',
    seed: 7,
    warning: 1.5,
    rounds: [1, 14, 41.3, 50.4, 98.5],
    goal: 3,
  },
  {
    id: 'steer-1',
    name: 'Squeeze',
    mode: 'steer',
    seed: 3,
    keeper: 1,
    targets: [0],
    hint: { psi: 0, delta: -0.01, steps: 20 },
  },
  { id: 'folds-2', name: 'Undertow', mode: 'folds', seed: 2, speed: 1.5, goal: 25 },
  { id: 'count-2', name: 'Count them all', mode: 'count', seed: 105 },
  { id: 'hunt-4', name: 'Nine squares', mode: 'hunt', seed: 51 },
  { id: 'folds-3', name: 'Churn', mode: 'folds', seed: 5, speed: 2, goal: 30 },
  { id: 'choice-2', name: 'Crosscurrents', mode: 'choice', seed: 19, speed: 1.5, goal: 40 },
  {
    id: 'predict-2',
    name: 'Omens',
    mode: 'predict',
    seed: 23,
    warning: 3,
    rounds: [14, 34.8, 63.4, 86.8, 112.8],
    goal: 3,
  },
  {
    id: 'steer-2',
    name: 'Pinch',
    mode: 'steer',
    seed: 7,
    keeper: 3,
    targets: [0],
    hint: { psi: 0, delta: 0.01, steps: 40 },
  },
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

/** The still curve of a Square Hunt or Odd One Out level. */
export const levelCurve = (level: Level): Polygon => randomCurve(level.seed);

/** The URL hash for a level: `#hunt-2` for a level, `#folds/123` for a random curve. */
export const routeOf = (level: Level): string => (level.id ? `#${level.id}` : `#${level.mode}/${level.seed}`);

/** The level a URL hash names, or null for the menu. A bare number (`#992259`) is Square Hunt on that curve. */
export function parseRoute(hash: string): Level | null {
  const h = hash.replace(/^#/, '');
  const level = LEVELS.find((l) => l.id === h);
  if (level) return level;
  const random = /^(hunt|folds|count|choice|predict|steer)\/(\d+)$/.exec(h);
  if (random) return randomLevel(random[1] as ModeId, Number(random[2]));
  if (/^\d+$/.test(h)) return randomLevel('hunt', Number(h));
  return null;
}
