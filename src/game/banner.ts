import type { Control } from './control';
import type { LastClaim } from './count';
import type { PredictPhase } from './predict';
import type { BuildCount } from './build';
import type { SteerState } from './steer';
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
      : 'Drag one finger anywhere on the screen to move a square, like on a trackpad; it fits itself to the curve.';
  if (mode === 'build') {
    return {
      title: 'Build a curve',
      detail:
        `Drag with one finger: the curve stretches toward it. Give it exactly ${goal ?? 5} squares. Lift your ` +
        'finger to count them.',
      tone: 'info',
    };
  }
  if (mode === 'steer') {
    return {
      title: 'Steer the curve',
      detail:
        'Drag with one finger: the curve stretches toward it. Make the red square vanish, but keep the gold one. ' +
        'Squares vanish in pairs, when two of them meet.',
      tone: 'info',
    };
  }
  if (mode === 'predict') {
    return {
      title: 'Which two fold?',
      detail:
        'Two of these squares are about to meet and vanish together: watch them move, and look for two that are ' +
        'closing in on each other. Press and hold the card of one of them to choose it, then see if you were right.',
      tone: 'info',
    };
  }
  if (mode === 'count') {
    return {
      title: 'How many squares?',
      detail:
        `This time we won't say how many squares the curve has. ${hold} Find the squares, then tap That's all ` +
        'when you think you have every one.',
      tone: 'info',
    };
  }
  if (mode === 'hunt') {
    return {
      title: 'Find the squares',
      detail:
        `${hold} When all four corners touch the curve, hold still until it fills in. Squares you have found ` +
        'turn teal.',
      tone: 'info',
    };
  }
  const target =
    goal === undefined ? 'Hold on as long as you can.' : `Hold on for ${goal} s to clear the level.`;
  if (mode === 'choice') {
    return {
      title: 'Choose your lifeline',
      detail:
        `The curve moves, and its squares drift. ${hold} Each square shows how long it has left. When yours ` +
        `vanishes, the others appear: pick one that will last, and get onto it within ${GRACE_MS / 1000} seconds. ` +
        target,
      tone: 'info',
    };
  }
  return {
    title: 'Keep your square',
    detail:
      `The curve moves, and its squares drift. ${hold} Get onto a square and stay with it. When it vanishes, ` +
      `find another within ${GRACE_MS / 1000} seconds. ${target}`,
    tone: 'info',
  };
}

/** How long the message after a wrong claim stays up, in milliseconds. */
export const CLAIM_MESSAGE_MS = 3000;

/**
 * The Odd One Out banner: the result of a wrong claim for a few seconds, never giving the count away, and the count
 * once the level is cleared.
 */
export function countBanner(
  last: LastClaim | null,
  now: number,
  cleared: boolean,
  total: number,
  wrong: number,
): Banner | null {
  if (cleared) {
    const detail = wrong === 0 ? 'First try' : `After ${wrong} wrong guess${wrong === 1 ? '' : 'es'}`;
    return { title: `All ${total} found!`, detail, tone: 'win' };
  }
  if (!last || last.result.right || now - last.at >= CLAIM_MESSAGE_MS) return null;
  const detail =
    last.found === 0
      ? 'Find a square first.'
      : last.result.even
        ? `${last.found} is even. Look again.`
        : 'There are more to find.';
  return { title: 'Not yet', detail, tone: 'warn' };
}

/** The Fold Forecast banner: whether the last answer was right while its fold plays out, then the result. */
export function predictBanner(state: {
  readonly phase: PredictPhase;
  readonly last: { readonly right: boolean } | null;
  readonly score: number;
  readonly length: number;
  readonly goal: number;
}): Banner | null {
  if (state.phase === 'answered' && state.last) {
    return state.last.right
      ? { title: 'Right!', detail: 'Those two met and vanished together.', tone: 'win' }
      : { title: 'Not that one', detail: 'Watch which two meet.', tone: 'warn' };
  }
  if (state.phase !== 'done') return null;
  const result = `${state.score} of ${state.length} right`;
  if (state.score >= state.goal) return { title: 'Cleared!', detail: result, tone: 'win' };
  return {
    title: result,
    detail: `You need ${state.goal}.`,
    tone: 'over',
    action: { label: 'Play again', kind: 'again' },
  };
}

/** The Steer the Curve banner: the result once the targets are gone or the keeper is. */
export function steerBanner(state: SteerState): Banner | null {
  if (state === 'won')
    return { title: 'Cleared!', detail: 'The red square vanished, and yours held.', tone: 'win' };
  if (state === 'lost') {
    return {
      title: 'Your square vanished',
      detail: 'It met another square, and the two folded away together.',
      tone: 'over',
      action: { label: 'Try again', kind: 'again' },
    };
  }
  return null;
}

/** The Build a Curve banner, once the curve has the target count. */
export function buildBanner(state: BuildCount): Banner | null {
  return state.met
    ? { title: 'Built!', detail: `Your curve has exactly ${state.count} squares.`, tone: 'win' }
    : null;
}
