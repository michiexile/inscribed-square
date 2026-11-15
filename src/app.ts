import { type Banner, introBanner } from './game/banner';
import { CONTROL_NAMES, type Control, HeldSquare } from './game/control';
import { GRACE_MS, TOLERANCE } from './game/feel';
import {
  LEVELS,
  type Level,
  MODE_NAMES,
  type ModeId,
  fitHuntSeed,
  levelCurve,
  nextLevel,
  parseRoute,
  randomLevel,
  routeOf,
} from './game/levels';
import { type KeyValueStore, Progress } from './game/progress';
import type { Vec } from './geometry/vec';
import { ThumbTracker } from './input/pointers';
import { uiScale } from './input/scale';
import { FoldsMode } from './modes/foldsMode';
import { HuntMode } from './modes/huntMode';
import type { GameMode } from './modes/mode';
import { Renderer } from './render';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const hud = document.querySelector<HTMLElement>('#hud');
const banner = document.querySelector<HTMLElement>('#banner');
const menu = document.querySelector<HTMLElement>('#menu');
const levelsButton = document.querySelector<HTMLButtonElement>('#levels');
const controlButton = document.querySelector<HTMLButtonElement>('#mode');
const newButton = document.querySelector<HTMLButtonElement>('#new');
const revealButton = document.querySelector<HTMLButtonElement>('#reveal');
if (!canvas || !hud || !banner || !menu || !levelsButton || !controlButton || !newButton || !revealButton)
  throw new Error('Missing page elements');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D canvas not supported');

/** How long a snapped square must be held before it counts in Square Hunt, in milliseconds. */
const DWELL_MS = 500;
/**
 * A thumb drives the point this many layout pixels above it, so the thumb doesn't cover the square or the curve near it.
 */
const GRAB_OFFSET = 80;

let control: Control = 'corners';
let reveal = false;
let level: Level | null = null;
let game: GameMode | null = null;
/**
 * CSS pixels per layout pixel (`uiScale`). Canvas drawing, pointer positions and the thumb offset are all in layout
 * pixels, and the buttons are zoomed by it, so a browser in desktop mode shows the game at phone size.
 */
let scale = 1;
const thumbs = new ThumbTracker();
const heldSquare = new HeldSquare();
/** Reading `localStorage` itself throws where site data is blocked. */
function storage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
const progress = new Progress(storage());
/** Whether this level shows its mode's intro until the player starts: only until they have seen it once. */
let intro = false;

function start(next: Level): void {
  game?.dispose();
  if (next.id === null && next.mode === 'hunt') next = { ...next, seed: fitHuntSeed(next.seed) };
  level = next;
  const label = next.id ? next.name : `random curve ${next.seed}`;
  game =
    next.mode === 'hunt'
      ? new HuntMode(levelCurve(next), TOLERANCE, DWELL_MS, label)
      : new FoldsMode(next.seed, next.speed ?? 1, TOLERANCE, GRACE_MS, label, next.goal);
  intro = !progress.hasSeenIntro(next.mode);
  heldSquare.reset();
  history.replaceState(null, '', routeOf(next));
  menu!.hidden = true;
  requestDraw();
}

function showMenu(): void {
  game?.dispose();
  game = null;
  level = null;
  history.replaceState(null, '', location.pathname + location.search);
  buildMenu();
  menu!.hidden = false;
  hud!.textContent = '';
  showBanner(null);
  clear();
}

/** Clears the whole canvas. */
function clear(): void {
  ctx!.clearRect(0, 0, canvas!.clientWidth / scale, canvas!.clientHeight / scale);
}

/** A menu button that runs `onClick`, appended to `parent`. */
function menuButton(parent: HTMLElement, text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.addEventListener('click', onClick);
  parent.append(b);
  return b;
}

/** The menu: a button for the first uncleared level, then every level by mode, cleared ones ticked. */
function buildMenu(): void {
  menu!.replaceChildren();
  const next = progress.next(LEVELS);
  if (next) {
    const section = document.createElement('section');
    const fresh = LEVELS.every((l) => !progress.isCleared(l.id!));
    menuButton(section, `${fresh ? 'Play' : 'Continue'}: ${next.name}`, () => start(next)).className =
      'primary';
    menu!.append(section);
  }
  for (const mode of ['hunt', 'folds'] as ModeId[]) {
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = MODE_NAMES[mode];
    section.append(heading);
    for (const l of LEVELS.filter((l) => l.mode === mode)) {
      const speed = l.speed && l.speed !== 1 ? ` · ${l.speed}× speed` : '';
      const tick = progress.isCleared(l.id!) ? ' ✓' : '';
      menuButton(section, `${l.name}${speed}${tick}`, () => start(l));
    }
    menuButton(section, 'Random curve', () => start(randomLevel(mode, Math.floor(Math.random() * 1e6))));
    menu!.append(section);
  }
}

/** Maps curve coordinates (roughly [-1.5, 1.5]²) to layout pixels, centred on the canvas. */
function view(): { toScreen: (p: Vec) => Vec; toCurve: (p: Vec) => Vec } {
  const w = canvas!.clientWidth / scale;
  const h = canvas!.clientHeight / scale;
  const k = Math.min(w, h) / 3.4;
  return {
    toScreen: (p) => ({ x: w / 2 + p.x * k, y: h / 2 - p.y * k }),
    toCurve: (p) => ({ x: (p.x - w / 2) / k, y: (h / 2 - p.y) / k }),
  };
}

function resize(): void {
  scale = uiScale(window.innerWidth, window.screen.width, window.matchMedia('(pointer: coarse)').matches);
  for (const el of [document.querySelector<HTMLElement>('#bar'), menu])
    el?.style.setProperty('zoom', String(scale));
  const dpr = window.devicePixelRatio || 1;
  canvas!.width = Math.round(canvas!.clientWidth * dpr);
  canvas!.height = Math.round(canvas!.clientHeight * dpr);
  ctx!.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  requestDraw();
}

let drawPending = false;
/** Redraws once on the next animation frame, however many pointer events arrive before it. */
function requestDraw(): void {
  if (drawPending) return;
  drawPending = true;
  requestAnimationFrame((now) => {
    drawPending = false;
    draw(now);
  });
}

function draw(now: number): void {
  if (!game) return;
  const { toScreen, toCurve } = view();
  clear();
  game.advance(now);
  const curve = game.curve;
  const ts = thumbs.thumbs();
  const grab = ts.map((t) => (t ? { x: t.x, y: t.y - GRAB_OFFSET } : null));
  const held = heldSquare.update(
    curve,
    control,
    grab.map((g) => (g ? toCurve(g) : null)),
  );
  const r = new Renderer(ctx!, toScreen, TOLERANCE);
  const animate = game.frame(r, held, now, reveal);
  ts.forEach((t, i) => {
    if (!t) return;
    const g = grab[i]!;
    if (control === 'corners') r.thumb(t, i, toScreen(curve.nearest(toCurve(g)).point));
    else if (t === (ts[0] ?? ts[1])) r.thumb(t, 0, g);
  });
  hud!.textContent = `${MODE_NAMES[level!.mode]} · ${game.hud()}`;
  showBanner(currentBanner(game, level!));
  if (animate) requestDraw();
}

/**
 * The banner to show: the mode's own, with a button to the next level once the level is cleared; else the mode's
 * intro, until the player first finds or latches onto a square. Records cleared levels and seen intros.
 */
function currentBanner(game: GameMode, level: Level): Banner | null {
  const b = game.banner();
  if (game.cleared()) {
    if (level.id) progress.clear(level.id);
    const next = nextLevel(level);
    return b && next ? { ...b, action: { label: `Next: ${next.name}`, kind: 'next' } } : b;
  }
  if (b) return b;
  if (intro && game.started()) {
    intro = false;
    progress.sawIntro(level.mode);
  }
  return intro ? introBanner(level.mode, control, level.goal) : null;
}

let shownBanner = '';
/** Shows the mode's banner, rebuilding the element only when its content changes. */
function showBanner(b: Banner | null): void {
  const key = b ? JSON.stringify(b) : '';
  if (key === shownBanner) return;
  shownBanner = key;
  banner!.hidden = !b;
  banner!.replaceChildren();
  if (!b) return;
  banner!.dataset.tone = b.tone;
  const title = document.createElement('strong');
  title.textContent = b.title;
  banner!.append(title);
  if (b.detail) {
    const detail = document.createElement('span');
    detail.textContent = b.detail;
    banner!.append(detail);
  }
  if (b.action) {
    const button = document.createElement('button');
    button.type = 'button';
    const action = b.action;
    button.textContent = action.label;
    button.addEventListener('click', () => {
      const next = level && nextLevel(level);
      if (action.kind === 'next' && next) start(next);
      else game?.restart();
      requestDraw();
    });
    banner!.append(button);
  }
}

const pos = (e: PointerEvent): Vec => {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
};

canvas.addEventListener('pointerdown', (e) => {
  if (thumbs.down(e.pointerId, pos(e)) !== null) {
    // Capture keeps moves coming when a thumb slides off the canvas edge. It can fail for a pointer the
    // browser has already released, which must not stop the redraw.
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }
  requestDraw();
});
canvas.addEventListener('pointermove', (e) => {
  thumbs.move(e.pointerId, pos(e));
  requestDraw();
});
for (const type of ['pointerup', 'pointercancel'] as const) {
  canvas.addEventListener(type, (e) => {
    thumbs.up(e.pointerId);
    if (thumbs.thumbs().every((t) => t === null)) game?.released(performance.now());
    requestDraw();
  });
}

levelsButton.addEventListener('click', showMenu);
controlButton.addEventListener('click', () => {
  control = control === 'corners' ? 'centre' : 'corners';
  controlButton.textContent = CONTROL_NAMES[control];
  heldSquare.reset();
  requestDraw();
});
newButton.addEventListener('click', () => {
  start(randomLevel(level?.mode ?? 'hunt', Math.floor(Math.random() * 1e6)));
});
revealButton.addEventListener('click', () => {
  reveal = !reveal;
  revealButton.setAttribute('aria-pressed', String(reveal));
  requestDraw();
});

controlButton.textContent = CONTROL_NAMES[control];
window.addEventListener('resize', resize);
resize();
// A link to another level on this page changes only the hash; follow it.
window.addEventListener('hashchange', () => {
  const next = parseRoute(location.hash);
  if (next) start(next);
  else showMenu();
});
// A first visit goes straight into the first level; its intro explains the control.
const initial =
  parseRoute(location.hash) ?? (LEVELS.some((l) => progress.isCleared(l.id!)) ? null : LEVELS[0]);
if (initial) start(initial);
else showMenu();
