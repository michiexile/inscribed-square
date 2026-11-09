/**
 * How far the morph advances in a frame, in morph seconds: the real time since the last frame, capped at 0.1 s so a
 * hidden tab or a stalled frame never asks the tracker to bridge a long jump, times the level's morph speed.
 */
export function morphStep(realDtMs: number, speed: number): number {
  return Math.min(0.1, Math.max(0, realDtMs) / 1000) * speed;
}
