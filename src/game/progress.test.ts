import { describe, expect, it } from 'vitest';
import { LEVELS } from './levels';
import { type KeyValueStore, Progress } from './progress';

/** An in-memory stand-in for localStorage. */
class MemoryStore implements KeyValueStore {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

/** Storage that refuses every access, as a private window or blocked site data can. */
const brokenStore: KeyValueStore = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('Progress', () => {
  it('remembers cleared levels across a reload from the same storage', () => {
    const store = new MemoryStore();
    const before = new Progress(store);
    before.clear('hunt-1');
    before.clear('folds-1');
    const after = new Progress(store);
    expect(after.isCleared('hunt-1')).toBe(true);
    expect(after.isCleared('folds-1')).toBe(true);
    expect(after.isCleared('hunt-2')).toBe(false);
  });

  it('remembers which intros the player has seen', () => {
    const store = new MemoryStore();
    new Progress(store).sawIntro('hunt');
    const after = new Progress(store);
    expect(after.hasSeenIntro('hunt')).toBe(true);
    expect(after.hasSeenIntro('folds')).toBe(false);
  });

  it('continues at the first uncleared level in campaign order, not the first after the last cleared', () => {
    const p = new Progress(new MemoryStore());
    expect(p.next(LEVELS)).toBe(LEVELS[0]);
    p.clear(LEVELS[0].id!);
    p.clear(LEVELS[2].id!);
    expect(p.next(LEVELS)).toBe(LEVELS[1]);
    for (const l of LEVELS) p.clear(l.id!);
    expect(p.next(LEVELS)).toBeNull();
  });

  it('starts empty from corrupt or foreign data instead of throwing', () => {
    for (const junk of ['not json', '42', 'null', '{"cleared":"hunt-1"}', '{"cleared":[1,2]}']) {
      const store = new MemoryStore();
      store.setItem(Progress.KEY, junk);
      const p = new Progress(store);
      expect(p.isCleared('hunt-1'), junk).toBe(false);
      p.clear('hunt-1');
      expect(new Progress(store).isCleared('hunt-1'), junk).toBe(true);
    }
  });

  it('works for the session when storage is blocked or missing', () => {
    for (const store of [brokenStore, null]) {
      const p = new Progress(store);
      p.clear('hunt-1');
      p.sawIntro('folds');
      expect(p.isCleared('hunt-1')).toBe(true);
      expect(p.hasSeenIntro('folds')).toBe(true);
    }
  });
});
