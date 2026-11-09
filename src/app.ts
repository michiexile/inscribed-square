import type { Banner } from './game/banner';
import { CONTROL_NAMES, type Control, HeldSquare } from './game/control';
import {
  LEVELS,
  type Level,
  MODE_NAMES,
  type ModeId,
  levelCurve,
  parseRoute,
  randomLevel,
  routeOf,
} from './game/levels';
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

/**
 * Largest corner distance from the curve at which a held square snaps onto a nearby inscribed square, in curve units
 * (the curve is about 2 wide). The snap only happens onto a real square, so near-misses never count.
 */
const TOLERANCE = 0.05;
/** How long a snapped square must be held before it counts in Square Hunt, in milliseconds. */
const DWELL_MS = 500;
/** How long Avoid Folds gives the player to find another square after losing theirs, in milliseconds. */
const GRACE_MS = 3000;
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

function start(next: Level): void {
  game?.dispose();
  level = next;
  const label = next.id ? next.name : `random curve ${next.seed}`;
  game =
    next.mode === 'hunt'
      ? new HuntMode(levelCurve(next), TOLERANCE, DWELL_MS, label)
      : new FoldsMode(next.seed, TOLERANCE, GRACE_MS, label);
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
  menu!.hidden = false;
  hud!.textContent = '';
  showBanner(null);
  clear();
}

/** Clears the whole canvas. */
function clear(): void {
  ctx!.clearRect(0, 0, canvas!.clientWidth / scale, canvas!.clientHeight / scale);
}

function buildMenu(): void {
  menu!.replaceChildren();
  for (const mode of ['hunt', 'folds'] as ModeId[]) {
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = MODE_NAMES[mode];
    section.append(heading);
    const add = (text: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.addEventListener('click', onClick);
      section.append(b);
    };
    for (const l of LEVELS.filter((l) => l.mode === mode)) add(l.name, () => start(l));
    add('Random curve', () => start(randomLevel(mode, Math.floor(Math.random() * 1e6))));
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
  showBanner(game.banner());
  if (animate) requestDraw();
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
    button.textContent = b.action;
    button.addEventListener('click', () => {
      game?.restart();
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

buildMenu();
controlButton.textContent = CONTROL_NAMES[control];
window.addEventListener('resize', resize);
resize();
const initial = parseRoute(location.hash);
if (initial) start(initial);
else showMenu();
