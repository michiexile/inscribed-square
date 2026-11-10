import type { Level } from './levels';

/** The part of `localStorage` that `Progress` uses. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface Saved {
  cleared: string[];
  intros: string[];
}

const isStrings = (x: unknown): x is string[] => Array.isArray(x) && x.every((v) => typeof v === 'string');

/**
 * The player's progress on this device: which levels they have cleared and which intros they have seen. Storage can
 * be missing, blocked or hold junk; then progress lasts only for the session, and the game still runs.
 */
export class Progress {
  static readonly KEY = 'inscribed-square.progress';
  private readonly cleared = new Set<string>();
  private readonly intros = new Set<string>();

  constructor(private readonly store: KeyValueStore | null) {
    try {
      const raw: unknown = JSON.parse(store?.getItem(Progress.KEY) ?? 'null');
      if (raw && typeof raw === 'object') {
        const { cleared, intros } = raw as Partial<Record<keyof Saved, unknown>>;
        if (isStrings(cleared)) for (const id of cleared) this.cleared.add(id);
        if (isStrings(intros)) for (const id of intros) this.intros.add(id);
      }
    } catch {
      /* unreadable: start empty */
    }
  }

  isCleared(id: string): boolean {
    return this.cleared.has(id);
  }

  clear(id: string): void {
    if (this.cleared.has(id)) return;
    this.cleared.add(id);
    this.save();
  }

  hasSeenIntro(key: string): boolean {
    return this.intros.has(key);
  }

  sawIntro(key: string): void {
    if (this.intros.has(key)) return;
    this.intros.add(key);
    this.save();
  }

  /** The first level in `levels` not yet cleared, or null when all are. */
  next(levels: readonly Level[]): Level | null {
    return levels.find((l) => l.id !== null && !this.cleared.has(l.id)) ?? null;
  }

  private save(): void {
    const saved: Saved = { cleared: [...this.cleared], intros: [...this.intros] };
    try {
      this.store?.setItem(Progress.KEY, JSON.stringify(saved));
    } catch {
      /* blocked: keep progress for this session only */
    }
  }
}
