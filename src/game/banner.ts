import type { Phase } from './folds';

/** A large message across the top of the screen, for moments the player must not miss. */
export interface Banner {
  readonly title: string;
  readonly detail?: string;
  readonly tone: 'warn' | 'over' | 'win';
  /** Label of a button under the message, when it offers one. */
  readonly action?: string;
}

/** The Avoid Folds banner: a countdown while the square is lost, and the result once the round is over. */
export function foldsBanner(
  state: { readonly phase: Phase; readonly graceLeft: number },
  score: number,
  saves: number,
  best: number,
): Banner | null {
  if (state.phase === 'lost') {
    return {
      title: `Lost it! ${Math.ceil(state.graceLeft / 1000)}`,
      detail: 'Find another square',
      tone: 'warn',
    };
  }
  if (state.phase === 'over') {
    return {
      title: 'Round over',
      detail: `${score.toFixed(1)} s held · ${saves} saved · best ${best.toFixed(1)} s`,
      tone: 'over',
      action: 'Play again',
    };
  }
  return null;
}

/** The Square Hunt banner, once every square the solver knows of has been found. */
export function huntBanner(found: number, total: number): Banner | null {
  return total > 0 && found >= total ? { title: `All ${total} squares found!`, tone: 'win' } : null;
}
