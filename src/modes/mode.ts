import type { Banner } from '../game/banner';
import type { Held } from '../game/control';
import type { Polygon } from '../geometry/polygon';
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
  /** A large message the player must not miss, or null. */
  banner(): Banner | null;
  /** Starts the level over, after its banner's button is pressed. */
  restart(): void;
  /** Called when every thumb has lifted. */
  released(now: number): void;
  /** Frees background work. */
  dispose(): void;
}
