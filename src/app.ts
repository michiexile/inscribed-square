import { type Banner, introBanner } from './game/banner';
import { CONTROL_NAMES, type Control, DEFAULT_CONTROL, HeldSquare } from './game/control';
import { GRACE_MS, LIFELINE_HORIZON, TOLERANCE } from './game/feel';
import {
  LEVELS,
  type Level,
  MODE_NAMES,
  type ModeId,
  fitHuntSeed,
  isStill,
  levelCurve,
  nextLevel,
  parseRoute,
  randomLevel,
  routeOf,
} from './game/levels';
import { type KeyValueStore, Progress } from './game/progress';
import type { Vec } from './geometry/vec';
import { ThumbTracker } from './input/pointers';
import { CURVE_SPAN, curveCentreY, uiScale } from './input/scale';
import { FoldsMode } from './modes/foldsMode';
import { HuntMode } from './modes/huntMode';
import { PredictMode } from './modes/predictMode';
import { SteerMode } from './modes/steerMode';
import { BuildMode } from './modes/buildMode';
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
const claimButton = document.querySelector<HTMLButtonElement>('#claim');
if (
  !canvas ||
  !hud ||
  !banner ||
  !menu ||
  !levelsButton ||
  !controlButton ||
  !newButton ||
  !revealButton ||
  !claimButton
)
  throw new Error('Missing page elements');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D canvas not supported');

/** How long a snapped square must be held before it counts in Square Hunt, in milliseconds. */
const DWELL_MS = 500;
/**
 * A thumb drives the point this many layout pixels above it, so the thumb doesn't cover the square or the curve near it.
 */
const GRAB_OFFSET = 80;

let reveal = false;
let level: Level | null = null;
let game: GameMode | null = null;
/**
 * CSS pixels per layout pixel (`uiScale`). Canvas drawing, pointer positions and the thumb offset are all in layout
 * pixels, and the buttons are zoomed by it, so a browser in desktop mode shows the game at phone size.
 */
let scale = 1;
/**
 * Where the top bar ends, in layout pixels; the bar is drawn over the canvas, which starts at the top of the page.
 * Measured on resize only, so the curve does not jump when the HUD text wraps.
 */
let barBottom = 0;
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
let control: Control = progress.control() ?? DEFAULT_CONTROL;
/** Whether this level shows its mode's intro until the player starts: only until they have seen it once. */
let intro = false;

function start(next: Level): void {
  game?.dispose();
  if (next.id === null && isStill(next.mode)) next = { ...next, seed: fitHuntSeed(next.seed) };
  level = next;
  const label = next.id ? next.name : `random curve ${next.seed}`;
  game = isStill(next.mode)
    ? new HuntMode(levelCurve(next), TOLERANCE, DWELL_MS, label, next.mode === 'count')
    : next.mode === 'predict'
      ? new PredictMode(next.seed, next.warning, next.rounds, next.goal, label)
      : next.mode === 'steer'
        ? new SteerMode(next.seed, next.keeper, next.targets, label)
        : next.mode === 'build'
          ? new BuildMode(next.seed, next.goal, TOLERANCE, label)
          : new FoldsMode(
              next.seed,
              next.speed ?? 1,
              TOLERANCE,
              GRACE_MS,
              label,
              next.goal,
              next.mode === 'choice' ? LIFELINE_HORIZON : 0,
            );
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
  claimButton!.hidden = true;
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
  for (const mode of ['hunt', 'count', 'folds', 'choice', 'predict', 'steer', 'build'] as ModeId[]) {
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
  const k = Math.min(w, h) / CURVE_SPAN;
  const cy = curveCentreY(w, h, barBottom);
  return {
    toScreen: (p) => ({ x: w / 2 + p.x * k, y: cy - p.y * k }),
    toCurve: (p) => ({ x: (p.x - w / 2) / k, y: (cy - p.y) / k }),
  };
}

function resize(): void {
  scale = uiScale(window.innerWidth, window.screen.width, window.matchMedia('(pointer: coarse)').matches);
  for (const el of [document.querySelector<HTMLElement>('#bar'), menu])
    el?.style.setProperty('zoom', String(scale));
  barBottom = (hud!.getBoundingClientRect().bottom + 8) / scale;
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
  const ts = thumbs.thumbs();
  const grab = ts.map((t) => (t ? { x: t.x, y: t.y - GRAB_OFFSET } : null));
  // A mode that takes the finger directly gets the first finger's point, and no held square.
  const first = grab[0] ?? grab[1];
  const direct = game.pointer !== undefined;
  game.pointer?.(first ? toCurve(first) : null);
  game.advance(now);
  const curve = game.curve;
  const held =
    game.tapOnly || game.pointer
      ? null
      : heldSquare.update(
          curve,
          control,
          grab.map((g) => (g ? toCurve(g) : null)),
        );
  const r = new Renderer(ctx!, toScreen, TOLERANCE, {
    width: canvas!.clientWidth / scale,
    height: canvas!.clientHeight / scale,
  });
  const animate = game.frame(r, held, now, reveal);
  if (!game.tapOnly)
    ts.forEach((t, i) => {
      if (!t) return;
      const g = grab[i]!;
      if (control === 'corners' && !direct) r.thumb(t, i, toScreen(curve.nearest(toCurve(g)).point));
      else if (t === (ts[0] ?? ts[1]))
        // Drag the centre moves the square like a trackpad: tie the finger to the square it moves.
        r.thumb(
          t,
          0,
          held && !direct
            ? toScreen({
                x: (held.corners[0].x + held.corners[2].x) / 2,
                y: (held.corners[0].y + held.corners[2].y) / 2,
              })
            : g,
        );
    });
  hud!.textContent = `${MODE_NAMES[level!.mode]} · ${game.hud()}`;
  claimButton!.hidden = !game.claim || game.cleared();
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
  game?.tap?.(pos(e), performance.now());
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
  progress.setControl(control);
  controlButton.textContent = CONTROL_NAMES[control];
  heldSquare.reset();
  requestDraw();
});
newButton.addEventListener('click', () => {
  start(randomLevel(level?.mode ?? 'hunt', Math.floor(Math.random() * 1e6)));
});
claimButton.addEventListener('click', () => {
  game?.claim?.(performance.now());
  requestDraw();
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
