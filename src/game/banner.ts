import type { Control } from './control';
import { GRACE_MS } from './feel';
import type { Phase } from './folds';
import type { ModeId } from './levels';

/**
 * A button under a banner: `again` restarts the level, `next` opens the next level in the campaign.
 */
export interface BannerAction {
  readonly label: string;
  readonly kind: 'again' | 'next';
}

/** A large message across the top of the screen, for moments the player must not miss. */
export interface Banner {
  readonly title: string;
  readonly detail?: string;
  readonly tone: 'info' | 'warn' | 'over' | 'win';
  readonly action?: BannerAction;
}

/**
 * The Avoid Folds banner: a countdown while the square is lost, and the result once the round is over or the level
 * cleared.
 */
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
      action: { label: 'Play again', kind: 'again' },
    };
  }
  if (state.phase === 'won') {
    return { title: 'Cleared!', detail: `${score.toFixed(1)} s held · ${saves} saved`, tone: 'win' };
  }
  return null;
}

/** The Square Hunt banner, once every square the solver knows of has been found. */
export function huntBanner(found: number, total: number): Banner | null {
  return total > 0 && found >= total ? { title: `All ${total} squares found!`, tone: 'win' } : null;
}

/**
 * The first-time explanation of a mode, for the control in use. Avoid Folds names the level's goal in seconds, if it
 * has one.
 */
export function introBanner(mode: ModeId, control: Control, goal: number | undefined): Banner {
  const hold =
    control === 'corners'
      ? 'Put two thumbs on the screen: each one slides a corner of a square along the curve.'
      : 'Drag one thumb to move a square around; it fits itself to the curve.';
  if (mode === 'hunt') {
    return {
      title: 'Find the squares',
      detail: `${hold} When all four corners touch the curve, hold still until it fills in.`,
      tone: 'info',
    };
  }
  const target =
    goal === undefined ? 'Hold on as long as you can.' : `Hold on for ${goal} s to clear the level.`;
  return {
    title: 'Keep your square',
    detail:
      `The curve moves, and its squares drift. ${hold} Get onto a square and stay with it. When it vanishes, ` +
      `find another within ${GRACE_MS / 1000} seconds. ${target}`,
    tone: 'info',
  };
}
