import type { TorusPoint } from '../game/torus';
import type { Banner } from '../game/banner';
import type { Held } from '../game/control';
import type { Polygon } from '../geometry/polygon';
import type { Vec } from '../geometry/vec';
import type { Renderer } from '../render';

/** A running level in one game mode, driven by the app's frame loop. */
export interface GameMode {
  /** The curve as of the last `advance`. */
  readonly curve: Polygon;
  /** Moves the mode's clock to `now` (milliseconds), updating the curve if it morphs. */
  advance(now: number): void;
  /**
   * Updates the game with this frame's held square and draws everything but the thumbs. Returns true when the mode
   * needs another frame even if no input arrives.
   */
  frame(r: Renderer, held: Held | null, now: number, reveal: boolean): boolean;
  /** One line of status for the HUD. */
  hud(): string;
  /** True once the player has done the mode's first thing: found a square, or latched onto one. */
  started(): boolean;
  /** True once the level is cleared: every square found, or the Avoid Folds goal reached. */
  cleared(): boolean;
  /** A large message the player must not miss, or null. */
  banner(): Banner | null;
  /** True for a mode played by tapping, not by holding a square: the app then draws no held square or thumbs. */
  readonly tapOnly?: boolean;
  /**
   * For modes that use the finger directly instead of a held square: the point the first finger drives, in curve
   * coordinates, or null when no finger is down. Called every frame before `advance`.
   */
  pointer?(p: Vec | null): void;
  /** Points to mark on the torus map, such as the squares found so far. */
  marks?(): readonly TorusPoint[];
  /** A tap at a point in layout pixels, for modes played by tapping. */
  tap?(p: Vec, now: number): void;
  /** Odd One Out only: the player says they have found every square, at time `now` (milliseconds). */
  claim?(now: number): void;
  /** Starts the level over, after its banner's button is pressed. */
  restart(): void;
  /** Called when every thumb has lifted. */
  released(now: number): void;
  /** Frees background work. */
  dispose(): void;
}
