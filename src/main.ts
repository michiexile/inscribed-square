import { radialFourier } from './geometry/fourier';
import type { Vec } from './geometry/vec';
import { ThumbTracker } from './input/pointers';

const canvas = document.querySelector<HTMLCanvasElement>('#game');
if (!canvas) throw new Error('Missing #game canvas');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D canvas not supported');

// A fixed, deliberately asymmetric loop. Level curves come later.
const curve = radialFourier(
  [
    { k: 2, amplitude: 0.18, phase: 0.4 },
    { k: 3, amplitude: 0.12, phase: 1.9 },
    { k: 5, amplitude: 0.05, phase: 0.7 },
  ],
  240,
);

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

function draw(): void {
  const { toScreen, toCurve } = view();
  ctx!.clearRect(0, 0, canvas!.clientWidth, canvas!.clientHeight);

  ctx!.beginPath();
  curve.vertices.forEach((v, i) => {
    const p = toScreen(v);
    if (i === 0) ctx!.moveTo(p.x, p.y);
    else ctx!.lineTo(p.x, p.y);
  });
  ctx!.closePath();
  ctx!.strokeStyle = '#e0e6eb';
  ctx!.lineWidth = 2;
  ctx!.stroke();

  thumbs.thumbs().forEach((t, i) => {
    if (!t) return;
    const corner = toScreen(curve.nearest(toCurve(t)).point);
    ctx!.strokeStyle = THUMB_COLOURS[i];
    ctx!.fillStyle = THUMB_COLOURS[i];
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
    ctx!.beginPath();
    ctx!.arc(corner.x, corner.y, 7, 0, 2 * Math.PI);
    ctx!.fill();
  });
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
  draw();
});
canvas.addEventListener('pointermove', (e) => {
  thumbs.move(e.pointerId, pos(e));
  draw();
});
for (const type of ['pointerup', 'pointercancel'] as const) {
  canvas.addEventListener(type, (e) => {
    thumbs.up(e.pointerId);
    draw();
  });
}
window.addEventListener('resize', resize);
resize();
