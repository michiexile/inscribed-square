/** How much life an inscribed square has left, as Lifelines shows it. */
export interface LifeLeft {
  /** Real seconds until the square folds away; Infinity if not within the horizon. */
  readonly seconds: number;
  /** Seconds as a fraction of the horizon, capped at 1, for a ring. */
  readonly fraction: number;
  readonly label: string;
}

/**
 * The life left of a square that dies at morph time `death` (undefined if not known to die within the look-ahead),
 * seen at morph time `now` on a level morphing at `speed` morph seconds per real second, with a horizon of `horizon`
 * real seconds.
 */
export function lifeLeft(death: number | undefined, now: number, speed: number, horizon: number): LifeLeft {
  if (death === undefined) return { seconds: Infinity, fraction: 1, label: `${horizon}+ s` };
  const seconds = Math.max(0, (death - now) / speed);
  return {
    seconds,
    fraction: Math.min(1, seconds / horizon),
    label: `${Math.max(1, Math.ceil(seconds - 1e-9))} s`,
  };
}
