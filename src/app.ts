import { Hunt } from './game/hunt';
import { type CentreFit, fitSquareAtCentre } from './geometry/centre';
import { radialFourier } from './geometry/fourier';
import type { Polygon } from './geometry/polygon';
import { randomCurve } from './geometry/random';
import { type InscribedSquare, findSquares } from './geometry/solver';
import { type Corners, bestEdgeSquare } from './geometry/square';
import type { Vec } from './geometry/vec';
import { ThumbTracker } from './input/pointers';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
const hud = document.querySelector<HTMLElement>('#hud');
const modeButton = document.querySelector<HTMLButtonElement>('#mode');
const newButton = document.querySelector<HTMLButtonElement>('#new');
const revealButton = document.querySelector<HTMLButtonElement>('#reveal');
if (!canvas || !hud || !modeButton || !newButton || !revealButton) throw new Error('Missing page elements');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D canvas not supported');

/**
 * Largest corner distance from the curve at which a held square snaps onto a nearby inscribed square, in curve units
 * (the curve is about 2 wide). The snap only happens when refinement finds a real square, so near-misses never count.
 */
const TOLERANCE = 0.05;

type Mode = 'corners' | 'centre';
const MODE_LABELS: Record<Mode, string> = { corners: 'Two corners', centre: 'Drag centre' };

// The default curve is a fixed, deliberately asymmetric loop; "New curve" draws random ones by seed.
const defaultCurve = (): Polygon =>
  radialFourier(
    [
      { k: 2, amplitude: 0.18, phase: 0.4 },
      { k: 3, amplitude: 0.12, phase: 1.9 },
      { k: 5, amplitude: 0.05, phase: 0.7 },
    ],
    240,
  );

let mode: Mode = 'corners';
let reveal = false;
let curve: Polygon = defaultCurve();
let seed: number | null = null;
let hunt = new Hunt(curve, [], TOLERANCE);
let solveMs = 0;
let lastFit: CentreFit | undefined;
let lastFound = 0;

function loadCurve(newSeed: number | null): void {
  seed = newSeed;
  curve = newSeed === null ? defaultCurve() : randomCurve(newSeed);
  const t0 = performance.now();
  hunt = new Hunt(curve, findSquares(curve), TOLERANCE);
  solveMs = performance.now() - t0;
  lastFit = undefined;
  history.replaceState(null, '', newSeed === null ? location.pathname : `#${newSeed}`);
}

const thumbs = new ThumbTracker();
const THUMB_COLOURS = ['#4fc3f7', '#ffb74d'];

/** Maps curve coordinates (roughly [-1.5, 1.5]²) to CSS pixels, centred on the canvas. */
function view(): { toScreen: (p: Vec) => Vec; toCurve: (p: Vec) => Vec } {
  const w = canvas!.clientWidth;
  const h = canvas!.clientHeight;
  const k = Math.min(w, h) / 3.4;
  return {
    toScreen: (p) => ({ x: w / 2 + p.x * k, y: h / 2 - p.y * k }),
    toCurve: (p) => ({ x: (p.x - w / 2) / k, y: (h / 2 - p.y) / k }),
  };
}

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas!.width = Math.round(canvas!.clientWidth * dpr);
  canvas!.height = Math.round(canvas!.clientHeight * dpr);
  ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

let drawPending = false;
/** Redraws once on the next animation frame, however many pointer events arrive before it. */
function requestDraw(): void {
  if (drawPending) return;
  drawPending = true;
  requestAnimationFrame(() => {
    drawPending = false;
    draw();
  });
}

/** Green when a corner is within tolerance, through yellow, to red at eight times the tolerance. */
function closeness(d: number): string {
  const t = Math.min(1, Math.max(0, (d - TOLERANCE) / (7 * TOLERANCE)));
  return `hsl(${Math.round(120 * (1 - t))}, 85%, 55%)`;
}

function polygonPath(points: readonly Vec[], toScreen: (p: Vec) => Vec): void {
  ctx!.beginPath();
  points.forEach((v, i) => {
    const p = toScreen(v);
    if (i === 0) ctx!.moveTo(p.x, p.y);
    else ctx!.lineTo(p.x, p.y);
  });
  ctx!.closePath();
}

function dot(p: Vec, r: number, colour: string): void {
  ctx!.fillStyle = colour;
  ctx!.beginPath();
  ctx!.arc(p.x, p.y, r, 0, 2 * Math.PI);
  ctx!.fill();
}

/**
 * Draws a held square. Snapped onto an inscribed square, it is drawn as that exact square, filled. Otherwise it shows
 * its outline, with free corners coloured by distance and tethered to their nearest curve points.
 */
function drawHeld(
  corners: Corners,
  free: readonly number[],
  toScreen: (p: Vec) => Vec,
  error: number,
  snapped: InscribedSquare | null,
): void {
  if (snapped) {
    polygonPath(snapped.corners, toScreen);
    ctx!.fillStyle = 'rgba(102, 220, 120, 0.3)';
    ctx!.fill();
    ctx!.strokeStyle = closeness(0);
    ctx!.lineWidth = 3;
    ctx!.stroke();
    for (const c of snapped.corners) dot(toScreen(c), 6, closeness(0));
    return;
  }
  polygonPath(corners, toScreen);
  ctx!.strokeStyle = closeness(error);
  ctx!.lineWidth = 2;
  ctx!.stroke();
  for (const k of free) {
    const c = corners[k];
    const n = curve.nearest(c);
    const p = toScreen(c);
    const q = toScreen(n.point);
    ctx!.strokeStyle = closeness(n.distance);
    ctx!.lineWidth = 1.5;
    ctx!.setLineDash([3, 4]);
    ctx!.beginPath();
    ctx!.moveTo(p.x, p.y);
    ctx!.lineTo(q.x, q.y);
    ctx!.stroke();
    ctx!.setLineDash([]);
    dot(p, 6, closeness(n.distance));
  }
}

function draw(): void {
  const { toScreen, toCurve } = view();
  ctx!.clearRect(0, 0, canvas!.clientWidth, canvas!.clientHeight);

  polygonPath(curve.vertices, toScreen);
  ctx!.strokeStyle = '#e0e6eb';
  ctx!.lineWidth = 2;
  ctx!.stroke();

  for (const q of hunt.found) {
    polygonPath(q.corners, toScreen);
    ctx!.fillStyle = 'rgba(102, 220, 120, 0.12)';
    ctx!.fill();
  }
  if (reveal) {
    ctx!.setLineDash([6, 6]);
    for (const q of hunt.squares) {
      polygonPath(q.corners, toScreen);
      ctx!.strokeStyle = 'rgba(200, 160, 255, 0.7)';
      ctx!.lineWidth = 1.5;
      ctx!.stroke();
    }
    ctx!.setLineDash([]);
  }

  const ts = thumbs.thumbs();
  let error: number | null = null;
  let snapped: InscribedSquare | null = null;
  if (mode === 'corners') {
    const params = ts.map((t) => (t ? curve.nearest(toCurve(t)).s : null));
    if (params[0] !== null && params[1] !== null) {
      const sq = bestEdgeSquare(curve, params[0], params[1]);
      error = sq.error;
      snapped = hunt.check(sq.corners, sq.error);
      drawHeld(sq.corners, [2, 3], toScreen, sq.error, snapped);
    }
    ts.forEach((t, i) => {
      if (!t) return;
      const corner = toScreen(curve.point(params[i]!));
      ctx!.strokeStyle = THUMB_COLOURS[i];
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.arc(t.x, t.y, 36, 0, 2 * Math.PI);
      ctx!.stroke();
      ctx!.setLineDash([4, 6]);
      ctx!.beginPath();
      ctx!.moveTo(t.x, t.y);
      ctx!.lineTo(corner.x, corner.y);
      ctx!.stroke();
      ctx!.setLineDash([]);
      dot(corner, 7, THUMB_COLOURS[i]);
    });
  } else {
    const t = ts[0] ?? ts[1];
    if (t) {
      lastFit = fitSquareAtCentre(curve, toCurve(t), lastFit);
      error = lastFit.error;
      snapped = hunt.check(lastFit.corners, lastFit.error);
      drawHeld(lastFit.corners, [0, 1, 2, 3], toScreen, lastFit.error, snapped);
      ctx!.strokeStyle = THUMB_COLOURS[0];
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.arc(t.x, t.y, 36, 0, 2 * Math.PI);
      ctx!.stroke();
      dot(t, 4, THUMB_COLOURS[0]);
    } else {
      lastFit = undefined;
    }
  }

  if (hunt.found.length > lastFound) navigator.vibrate?.(40);
  lastFound = hunt.found.length;
  const extra = hunt.extra > 0 ? ` (${hunt.extra} the solver missed)` : '';
  const err = error === null ? '' : ` · error ${error.toFixed(3)}${snapped ? ' ✓' : ''}`;
  hud!.textContent =
    `Found ${hunt.found.length} of ${hunt.squares.length}${extra}${err}` +
    ` · curve ${seed ?? 'default'} · solved in ${solveMs.toFixed(0)} ms`;
}

const pos = (e: PointerEvent): Vec => {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
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
    requestDraw();
  });
}

modeButton.addEventListener('click', () => {
  mode = mode === 'corners' ? 'centre' : 'corners';
  modeButton.textContent = MODE_LABELS[mode];
  lastFit = undefined;
  requestDraw();
});
newButton.addEventListener('click', () => {
  loadCurve(Math.floor(Math.random() * 1e6));
  requestDraw();
});
revealButton.addEventListener('click', () => {
  reveal = !reveal;
  revealButton.setAttribute('aria-pressed', String(reveal));
  requestDraw();
});

const hashSeed = Number.parseInt(location.hash.slice(1), 10);
loadCurve(Number.isFinite(hashSeed) ? hashSeed : null);
modeButton.textContent = MODE_LABELS[mode];
window.addEventListener('resize', resize);
resize();
