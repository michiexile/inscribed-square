import type { Vec } from '../geometry/vec';

/** Number of thumbs the game tracks. */
export const THUMBS = 2;

/**
 * Assigns touch pointers to a fixed number of thumb slots.
 * A thumb keeps its slot until it lifts, so the other thumb never changes which control it drives.
 * Pointers beyond the available slots are ignored until they lift.
 */
export class ThumbTracker {
  private readonly slots: ({ id: number; pos: Vec } | null)[] = Array.from({ length: THUMBS }, () => null);

  /** Registers a new pointer. Returns its thumb slot, or null if every slot is taken. */
  down(id: number, pos: Vec): number | null {
    const free = this.slots.findIndex((s) => s === null);
    if (free < 0) return null;
    this.slots[free] = { id, pos };
    return free;
  }

  move(id: number, pos: Vec): void {
    const slot = this.slots.find((s) => s?.id === id);
    if (slot) slot.pos = pos;
  }

  /** Releases a pointer that lifted or was cancelled. */
  up(id: number): void {
    const i = this.slots.findIndex((s) => s?.id === id);
    if (i >= 0) this.slots[i] = null;
  }

  /** Current position of each thumb slot, or null when the slot is empty. */
  thumbs(): (Vec | null)[] {
    return this.slots.map((s) => (s ? s.pos : null));
  }
}
