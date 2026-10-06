// Vectorizes brand/source/logo-cube.png into flat polygons.
//
// The PNG is the only logo source, so the vector mark is recovered from its
// pixels:
// 1. classify every pixel by the logo's flat colors (sampled from the PNG);
// 2. split the image into regions, cutting the point contacts where two faces
//    of the same color touch only at a corner;
// 3. follow the cracks between regions as chains, each shared by exactly two
//    regions, so neighbouring faces get identical edges and no gaps;
// 4. fit a straight line to every long run of a chain and put the corners at
//    the line intersections, because the PNG's corners are slightly rounded;
// 5. snap edges that run close to the 2:1 dimetric directions onto them.
import type { Rgba } from "./png.ts";

export interface Point {
  x: number;
  y: number;
}

/** The mark's tight bounds inside the source PNG, in source pixels. */
export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TracedMark {
  frame: Frame;
  /** The near-white inner-face color. */
  white: string;
  /**
   * Bounds of the small inner cube, in mark coordinates (the frame's top-left
   * is 0,0). Its height is the brand's clear-space unit.
   */
  innerCube: Frame;
  /**
   * Paint these in order. Each layer is one face plus a thin underlay strip
   * reaching under every later neighbour, so every face shows exactly and each
   * shared edge is anti-aliased once, over an opaque face: abutting faces let
   * the background show through their anti-aliased seams.
   */
  layers: { color: string; loops: Point[][] }[];
  /** Outline of every face except the near-white ones, for one-color marks. */
  knockout: Point[][];
}

/** Below this alpha a pixel belongs to the transparent background. */
const OPAQUE_ALPHA = 128;
/** A color is part of the palette when it covers this share of opaque pixels. */
const PALETTE_SHARE = 0.005;
/** Connected pieces smaller than this are anti-aliasing debris, not faces. */
const MIN_REGION = 64;
/** Same-color contacts narrower than twice this are corners touching, not one face. */
const PINCH_RADIUS = 3;
/** Chains with at most this many cracks are a junction smeared by anti-aliasing. */
const SHORT_CHAIN = 12;
/** Douglas-Peucker tolerance in source pixels. */
const SIMPLIFY = 1.5;
/** Runs shorter than this are corner rounding, not edges of the drawing. */
const MIN_EDGE = 10;
/** Consecutive runs closer than this in angle are one edge with a wobble. */
const MERGE_DEGREES = 4;
/**
 * An edge is snapped to a dimetric direction only when that moves its far end
 * by at most this many pixels. The PNG draws the outer hexagon at 2:1, but some
 * inner edges run near 0.52-0.54, and forcing those would move them visibly.
 */
const SNAP_OFFSET = 2;
const DEG = Math.PI / 180;

/** The flat colors: every fully opaque color that covers a real share of the logo. */
export function samplePalette(img: Rgba): string[] {
  const counts = new Map<number, number>();
  let opaque = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] !== 255) continue;
    opaque++;
    const key = (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .filter(([, n]) => n >= opaque * PALETTE_SHARE)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([key]) => `#${key.toString(16).padStart(6, "0")}`);
}

export function rgbOf(color: string): [number, number, number] {
  const v = Number.parseInt(color.slice(1), 16);
  return [v >> 16, (v >> 8) & 255, v & 255];
}

/**
 * Per-pixel class: 0 is transparent, 1 + i is palette[i]. Edge pixels are
 * blends, and the nearest flat color puts the boundary at the blend midpoint.
 */
export function classify(img: Rgba, palette: string[]): Uint8Array {
  const rgb = palette.map(rgbOf);
  const classes = new Uint8Array(img.width * img.height);
  for (let p = 0; p < classes.length; p++) {
    const i = p * 4;
    if (img.data[i + 3] < OPAQUE_ALPHA) continue;
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let c = 0; c < rgb.length; c++) {
      const d = (img.data[i] - rgb[c][0]) ** 2 + (img.data[i + 1] - rgb[c][1]) ** 2 + (img.data[i + 2] - rgb[c][2]) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    classes[p] = best + 1;
  }
  return classes;
}

function neighbours4(p: number, width: number, height: number): number[] {
  const x = p % width;
  const y = (p - x) / width;
  const out: number[] = [];
  if (x > 0) out.push(p - 1);
  if (x < width - 1) out.push(p + 1);
  if (y > 0) out.push(p - width);
  if (y < height - 1) out.push(p + width);
  return out;
}

/** 4-connected components of equal `key`; pixels with key -1 belong to none. */
function components(key: Int32Array | Uint8Array, width: number, height: number): { ids: Int32Array; sizes: number[] } {
  const ids = new Int32Array(key.length).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < key.length; start++) {
    if (ids[start] !== -1 || key[start] === -1) continue;
    const id = sizes.length;
    let size = 0;
    ids[start] = id;
    stack.push(start);
    while (stack.length > 0) {
      const p = stack.pop() as number;
      size++;
      for (const q of neighbours4(p, width, height)) {
        if (ids[q] === -1 && key[q] === key[start]) {
          ids[q] = id;
          stack.push(q);
        }
      }
    }
    sizes.push(size);
  }
  return { ids, sizes };
}

/** Folds pieces smaller than MIN_REGION into the class that borders them most. */
function despeckle(classes: Uint8Array, width: number, height: number): void {
  for (;;) {
    const { ids, sizes } = components(classes, width, height);
    const votes = new Map<number, Map<number, number>>();
    for (let p = 0; p < classes.length; p++) {
      if (sizes[ids[p]] >= MIN_REGION) continue;
      for (const q of neighbours4(p, width, height)) {
        if (ids[q] === ids[p]) continue;
        const tally = votes.get(ids[p]) ?? new Map<number, number>();
        tally.set(classes[q], (tally.get(classes[q]) ?? 0) + 1);
        votes.set(ids[p], tally);
      }
    }
    if (votes.size === 0) return;
    const target = new Map<number, number>();
    for (const [id, tally] of votes) {
      target.set(id, [...tally].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]);
    }
    for (let p = 0; p < classes.length; p++) {
      const cls = target.get(ids[p]);
      if (cls !== undefined) classes[p] = cls;
    }
  }
}

/**
 * Regions are pixels grown from cores that sit deeper than PINCH_RADIUS inside
 * their class. Two faces of one color that only touch at a corner share no
 * core, so they stay separate faces. Thin runs with no core at all are blends
 * along an edge (white over dark averages to the light grey, for example), so
 * they join the nearest face and take its class.
 */
function splitPinches(classes: Uint8Array, width: number, height: number): Int32Array {
  // Chessboard distance to the nearest pixel of another class (BFS over 8-neighbours).
  const depth = new Int32Array(classes.length).fill(-1);
  let frontier: number[] = [];
  for (let p = 0; p < classes.length; p++) {
    const x = p % width;
    const y = (p - x) / width;
    let edge = false;
    for (let dy = -1; dy <= 1 && !edge; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && classes[ny * width + nx] !== classes[p]) {
          edge = true;
          break;
        }
      }
    }
    if (edge) {
      depth[p] = 1;
      frontier.push(p);
    }
  }
  for (let d = 2; frontier.length > 0 && d <= PINCH_RADIUS + 1; d++) {
    const next: number[] = [];
    for (const p of frontier) {
      const x = p % width;
      const y = (p - x) / width;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const q = ny * width + nx;
          if (depth[q] === -1) {
            depth[q] = d;
            next.push(q);
          }
        }
      }
    }
    frontier = next;
  }
  const coreKey = new Int32Array(classes.length);
  for (let p = 0; p < classes.length; p++) {
    coreKey[p] = depth[p] === -1 || depth[p] > PINCH_RADIUS ? classes[p] : -1;
  }
  const { ids } = components(coreKey, width, height);
  const grow = (sameClass: boolean): void => {
    // Breadth first, so contested pixels go to the nearest core.
    let queue: number[] = [];
    for (let p = 0; p < ids.length; p++) if (ids[p] !== -1) queue.push(p);
    while (queue.length > 0) {
      const next: number[] = [];
      for (const p of queue) {
        for (const q of neighbours4(p, width, height)) {
          if (ids[q] === -1 && (!sameClass || classes[q] === classes[p])) {
            ids[q] = ids[p];
            classes[q] = classes[p];
            next.push(q);
          }
        }
      }
      queue = next;
    }
  };
  grow(true);
  grow(false);
  return ids;
}

interface Chain {
  from: number;
  to: number;
  /** Pixel-corner coordinates from node `from` to node `to`, endpoints included. */
  points: Point[];
  left: number;
  right: number;
}

/** Unit steps with screen y pointing down: right, down, left, up. */
const STEPS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/**
 * Walks the cracks between pixels of different regions. Corners where three or
 * more regions meet (or two meet diagonally) become nodes; the cracks between
 * nodes become chains with one region on each side.
 */
function traceChains(ids: Int32Array, width: number, height: number, outside: number): { nodes: Point[]; chains: Chain[] } {
  const cw = width + 1;
  const region = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= width || y >= height ? outside : ids[y * width + x];
  // [left, right] pixels of the crack leaving corner (x,y) in direction d.
  const sides = (x: number, y: number, d: number): [number, number] => {
    if (d === 0) return [region(x, y - 1), region(x, y)];
    if (d === 1) return [region(x, y), region(x - 1, y)];
    if (d === 2) return [region(x - 1, y), region(x - 1, y - 1)];
    return [region(x - 1, y - 1), region(x, y - 1)];
  };
  const isCrack = (x: number, y: number, d: number): boolean => {
    const [l, r] = sides(x, y, d);
    return l !== r;
  };
  // Horizontal cracks are keyed by their left corner, vertical ones by their top corner.
  const crackKey = (x: number, y: number, d: number): number => {
    if (d === 0) return (y * cw + x) * 2;
    if (d === 2) return (y * cw + x - 1) * 2;
    if (d === 1) return (y * cw + x) * 2 + 1;
    return ((y - 1) * cw + x) * 2 + 1;
  };
  const nodeOf = new Map<number, number>();
  const nodes: Point[] = [];
  for (let y = 0; y <= height; y++) {
    for (let x = 0; x <= width; x++) {
      let degree = 0;
      for (let d = 0; d < 4; d++) if (isCrack(x, y, d)) degree++;
      if (degree > 2) {
        nodeOf.set(y * cw + x, nodes.length);
        nodes.push({ x, y });
      }
    }
  }
  const visited = new Set<number>();
  const chains: Chain[] = [];
  const walk = (sx: number, sy: number, sd: number, startNode: number): void => {
    const [left, right] = sides(sx, sy, sd);
    const points: Point[] = [{ x: sx, y: sy }];
    let x = sx;
    let y = sy;
    let d = sd;
    for (;;) {
      visited.add(crackKey(x, y, d));
      x += STEPS[d][0];
      y += STEPS[d][1];
      points.push({ x, y });
      const node = nodeOf.get(y * cw + x);
      if (node !== undefined) {
        chains.push({ from: startNode, to: node, points, left, right });
        return;
      }
      // A degree-2 corner: leave by the crack we did not come in on.
      const back = (d + 2) % 4;
      let next = -1;
      for (let nd = 0; nd < 4; nd++) if (nd !== back && isCrack(x, y, nd)) next = nd;
      if (next < 0) throw new Error(`boundary dead end at ${x},${y}`);
      d = next;
    }
  };
  for (const [corner, node] of nodeOf) {
    const x = corner % cw;
    const y = (corner - x) / cw;
    for (let d = 0; d < 4; d++) if (isCrack(x, y, d) && !visited.has(crackKey(x, y, d))) walk(x, y, d, node);
  }
  // A boundary without any junction is a closed loop; give it a node of its own.
  for (let y = 0; y <= height; y++) {
    for (let x = 0; x <= width; x++) {
      for (let d = 0; d < 2; d++) {
        if (isCrack(x, y, d) && !visited.has(crackKey(x, y, d))) {
          nodeOf.set(y * cw + x, nodes.length);
          nodes.push({ x, y });
          walk(x, y, d, nodes.length - 1);
        }
      }
    }
  }
  return { nodes, chains };
}

/** Douglas-Peucker; returns the indices of the kept points. */
function douglasPeucker(points: Point[], first: number, last: number, epsilon: number): number[] {
  const a = points[first];
  const b = points[last];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  let worst = -1;
  let worstDist = epsilon;
  for (let i = first + 1; i < last; i++) {
    const p = points[i];
    const dist = len === 0 ? Math.hypot(p.x - a.x, p.y - a.y) : Math.abs(dy * (p.x - a.x) - dx * (p.y - a.y)) / len;
    if (dist > worstDist) {
      worstDist = dist;
      worst = i;
    }
  }
  if (worst < 0) return [first, last];
  return [...douglasPeucker(points, first, worst, epsilon).slice(0, -1), ...douglasPeucker(points, worst, last, epsilon)];
}

interface Line {
  /** A point on the line (the centroid of the fitted points). */
  c: Point;
  /** Unit direction. */
  u: Point;
  from: number;
  to: number;
}

/** Total-least-squares line through points[from..to]. */
function fitLine(points: Point[], from: number, to: number): Line {
  // Skip a little at both ends: that is where the PNG rounds its corners.
  const trim = Math.min(2, Math.floor((to - from) / 4));
  let sx = 0;
  let sy = 0;
  const n = to - from - 2 * trim + 1;
  for (let i = from + trim; i <= to - trim; i++) {
    sx += points[i].x;
    sy += points[i].y;
  }
  const c = { x: sx / n, y: sy / n };
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (let i = from + trim; i <= to - trim; i++) {
    const dx = points[i].x - c.x;
    const dy = points[i].y - c.y;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  }
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  return { c, u: { x: Math.cos(angle), y: Math.sin(angle) }, from, to };
}

/** Angle between two undirected lines, in radians. */
function angleBetween(a: Point, b: Point): number {
  const cos = Math.min(1, Math.abs(a.x * b.x + a.y * b.y));
  return Math.acos(cos);
}

function intersect(a: Line, b: Line): Point | null {
  const det = a.u.x * b.u.y - a.u.y * b.u.x;
  if (Math.abs(det) < 1e-6) return null;
  const t = ((b.c.x - a.c.x) * b.u.y - (b.c.y - a.c.y) * b.u.x) / det;
  return { x: a.c.x + t * a.u.x, y: a.c.y + t * a.u.y };
}

/** The straight edges of one chain: DP breakpoints, short runs dropped, wobbles merged. */
function chainLines(points: Point[]): Line[] {
  const breaks = douglasPeucker(points, 0, points.length - 1, SIMPLIFY);
  let lines: Line[] = [];
  for (let k = 1; k < breaks.length; k++) {
    const a = points[breaks[k - 1]];
    const b = points[breaks[k]];
    if (Math.hypot(b.x - a.x, b.y - a.y) >= MIN_EDGE) lines.push(fitLine(points, breaks[k - 1], breaks[k]));
  }
  for (let merged = true; merged; ) {
    merged = false;
    const out: Line[] = [];
    for (const line of lines) {
      const prev = out[out.length - 1];
      if (prev && angleBetween(prev.u, line.u) < MERGE_DEGREES * DEG) {
        out[out.length - 1] = fitLine(points, prev.from, line.to);
        merged = true;
      } else {
        out.push(line);
      }
    }
    lines = out;
  }
  return lines;
}

/** The dimetric directions as (dx, dy), screen y down: vertical and the two 2:1 slopes. */
const DIMETRIC: [number, number][] = [
  [0, 1],
  [2, 1],
  [2, -1],
];

/** Index into DIMETRIC of the direction this edge should snap to, or -1. */
function dimetricDirection(a: Point, b: Point): number {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  return DIMETRIC.findIndex(([dx, dy]) => {
    const angle = angleBetween(u, { x: dx / Math.hypot(dx, dy), y: dy / Math.hypot(dx, dy) });
    return len * Math.sin(angle) <= SNAP_OFFSET;
  });
}

/** Solves a x = b by Gaussian elimination with partial pivoting (a, b are consumed). */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    for (let r = col + 1; r < n; r++) {
      const f = a[r][col] / a[col][col];
      if (f === 0) continue;
      for (let c = col; c < n; c++) a[r][c] -= f * a[col][c];
      b[r] -= f * b[col];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let c = r + 1; c < n; c++) s -= a[r][c] * x[c];
    x[r] = s / a[r][r];
  }
  return x;
}

/**
 * Moves vertices as little as possible (least squares) while making every
 * near-dimetric segment exactly vertical or exactly 2:1.
 */
function snapToDimetric(vertices: Point[], segments: [number, number][]): Point[] {
  const n = vertices.length * 2;
  const stiffness = 1e6;
  const a = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const b = new Array<number>(n).fill(0);
  vertices.forEach((v, i) => {
    a[2 * i][2 * i] += 1;
    a[2 * i + 1][2 * i + 1] += 1;
    b[2 * i] += v.x;
    b[2 * i + 1] += v.y;
  });
  for (const [i, j] of segments) {
    const k = dimetricDirection(vertices[i], vertices[j]);
    if (k < 0) continue;
    // (vj - vi) x dir = 0, as a stiff quadratic penalty.
    const [dx, dy] = DIMETRIC[k];
    const coeffs: [number, number][] = [
      [2 * j, dy],
      [2 * j + 1, -dx],
      [2 * i, -dy],
      [2 * i + 1, dx],
    ];
    for (const [r, cr] of coeffs) for (const [c, cc] of coeffs) a[r][c] += stiffness * cr * cc;
  }
  const x = solve(a, b);
  return vertices.map((_, i) => ({ x: x[2 * i], y: x[2 * i + 1] }));
}

interface Edge {
  /** Vertex indices from the chain's start node to its end node. */
  path: number[];
  left: number;
  right: number;
}

/** Links the edges that bound `inside` into closed loops with `inside` on the left. */
function boundaryLoops(edges: Edge[], inside: (region: number) => boolean): number[][] {
  const oriented: number[][] = [];
  for (const e of edges) {
    const l = inside(e.left);
    if (l !== inside(e.right)) oriented.push(l ? e.path : e.path.slice().reverse());
  }
  const byStart = new Map<number, number[][]>();
  for (const path of oriented) byStart.set(path[0], [...(byStart.get(path[0]) ?? []), path]);
  // Any pairing at a pinch gives the same nonzero winding, so the first free edge will do.
  const used = new Set<number[]>();
  const loops: number[][] = [];
  for (const first of oriented) {
    if (used.has(first)) continue;
    const loop: number[] = [];
    for (let path: number[] | undefined = first; path; ) {
      used.add(path);
      loop.push(...path.slice(0, -1));
      const end: number = path[path.length - 1];
      path = byStart.get(end)?.find((p) => !used.has(p));
      if (!path && end !== loop[0]) throw new Error("open boundary");
    }
    loops.push(loop);
  }
  return loops;
}

/** Drops vertices that sit on the straight line between their neighbours. */
function dropCollinear(loop: Point[]): Point[] {
  return loop.filter((p, i) => {
    const a = loop[(i + loop.length - 1) % loop.length];
    const b = loop[(i + 1) % loop.length];
    const cross = (p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x);
    return Math.abs(cross) / Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1e-9) > 0.05;
  });
}

/** Deepest underlay strip, in source pixels: a full output pixel at marks down to ~80 px. */
const UNDERLAY = 8;

function properlyCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const side = (p: Point, q: Point, r: Point): number => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = side(c, d, a);
  const d2 = side(c, d, b);
  const d3 = side(a, b, c);
  const d4 = side(a, b, d);
  return d1 * d2 < -1e-9 && d3 * d4 < -1e-9;
}

function insideLoops(p: Point, loops: Point[][]): boolean {
  let inside = false;
  for (const loop of loops) {
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const a = loop[i];
      const b = loop[j];
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
  }
  return inside;
}

/**
 * A thin strip of face `loops` along the shared `path` (given with that face on
 * its left): the path and its inward offset, whose ends follow the bisectors of
 * the face's corners. Painted under the face, it gives the edge an opaque
 * underlay without reaching the face's other edges, so only the face itself
 * anti-aliases them.
 */
function underlayStrip(path: number[], loops: number[][], at: (i: number) => Point): Point[] {
  const points = loops.map((loop) => loop.map(at));
  // Inward miter offset of the face's corner at path[k].
  const corners = path.map((v, k) => {
    for (const loop of loops) {
      for (let j = 0; j < loop.length; j++) {
        if (loop[j] !== v) continue;
        const prev = loop[(j + loop.length - 1) % loop.length];
        const next = loop[(j + 1) % loop.length];
        if ((k < path.length - 1 && next !== path[k + 1]) || (k > 0 && prev !== path[k - 1])) continue;
        const p = at(prev);
        const c = at(v);
        const n = at(next);
        const l1 = Math.hypot(c.x - p.x, c.y - p.y);
        const l2 = Math.hypot(n.x - c.x, n.y - c.y);
        // The face is on the left of travel: normal (dy, -dx) with screen y down.
        const n1 = { x: (c.y - p.y) / l1, y: -(c.x - p.x) / l1 };
        const n2 = { x: (n.y - c.y) / l2, y: -(n.x - c.x) / l2 };
        const k1 = 1 + n1.x * n2.x + n1.y * n2.y;
        return { c, miter: { x: (n1.x + n2.x) / k1, y: (n1.y + n2.y) / k1 } };
      }
    }
    throw new Error("shared edge is not on the face's boundary");
  });
  for (let depth = UNDERLAY; depth >= 0.5; depth /= 2) {
    const offset = corners.map(({ c, miter }) => ({ x: c.x + miter.x * depth, y: c.y + miter.y * depth }));
    const ring = [...corners.map(({ c }) => c), ...offset.slice().reverse()];
    const fits =
      offset.every((o) => insideLoops(o, points)) &&
      ring.every((a, i) => {
        const b = ring[(i + 1) % ring.length];
        return points.every((loop) => loop.every((c, j) => !properlyCross(a, b, c, loop[(j + 1) % loop.length])));
      });
    if (fits) return ring;
  }
  throw new Error("no room for an underlay strip");
}

export function traceMark(img: Rgba): TracedMark {
  const { width, height } = img;
  const palette = samplePalette(img);
  const brightness = palette.map((c) => rgbOf(c).reduce((s, v) => s + v, 0));
  const white = palette[brightness.indexOf(Math.max(...brightness))];
  const classes = classify(img, palette);
  despeckle(classes, width, height);
  if (classes[0] !== 0) throw new Error("the image corner should be transparent");
  const ids = splitPinches(classes, width, height);
  const regionClass = new Map<number, number>();
  const regionArea = new Map<number, number>();
  for (let p = 0; p < ids.length; p++) {
    regionClass.set(ids[p], classes[p]);
    regionArea.set(ids[p], (regionArea.get(ids[p]) ?? 0) + 1);
  }
  const outside = ids[0];
  const { nodes, chains } = traceChains(ids, width, height, outside);

  // Collapse junctions that anti-aliasing smeared into several nodes joined by tiny chains.
  const parent = nodes.map((_, i) => i);
  const root = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  for (const c of chains) if (c.from !== c.to && c.points.length - 1 <= SHORT_CHAIN) parent[root(c.from)] = root(c.to);
  const kept = chains.filter((c) => !(root(c.from) === root(c.to) && c.points.length - 1 <= SHORT_CHAIN));

  // Fit the straight edges of every chain; interior corners are where they meet.
  const vertices: Point[] = [];
  const nodeVertex = new Map<number, number>();
  const nodeLines = new Map<number, Line[]>();
  const nodeCorners = new Map<number, Point[]>();
  for (let i = 0; i < nodes.length; i++) {
    const r = root(i);
    nodeCorners.set(r, [...(nodeCorners.get(r) ?? []), nodes[i]]);
  }
  const edges: Edge[] = kept.map((c) => {
    const from = root(c.from);
    const to = root(c.to);
    const lines = chainLines(c.points);
    if (lines.length === 0) throw new Error(`chain without straight edges near ${c.points[0].x},${c.points[0].y}`);
    nodeLines.set(from, [...(nodeLines.get(from) ?? []), lines[0]]);
    nodeLines.set(to, [...(nodeLines.get(to) ?? []), lines[lines.length - 1]]);
    const interior: number[] = [];
    for (let k = 1; k < lines.length; k++) {
      const corner = intersect(lines[k - 1], lines[k]) ?? c.points[lines[k].from];
      vertices.push(corner);
      interior.push(vertices.length - 1);
    }
    for (const node of [from, to]) {
      if (!nodeVertex.has(node)) {
        vertices.push({ x: 0, y: 0 });
        nodeVertex.set(node, vertices.length - 1);
      }
    }
    return { path: [nodeVertex.get(from) as number, ...interior, nodeVertex.get(to) as number], left: c.left, right: c.right };
  });
  // A node sits at the least-squares meeting point of the edges that end there,
  // pulled weakly towards its pixel corners when those edges are near parallel.
  for (const [node, vi] of nodeVertex) {
    const corners = nodeCorners.get(node) as Point[];
    const cx = corners.reduce((s, p) => s + p.x, 0) / corners.length;
    const cy = corners.reduce((s, p) => s + p.y, 0) / corners.length;
    const pull = 1e-3;
    let a11 = pull;
    let a12 = 0;
    let a22 = pull;
    let b1 = pull * cx;
    let b2 = pull * cy;
    for (const line of nodeLines.get(node) ?? []) {
      const nx = -line.u.y;
      const ny = line.u.x;
      const d = nx * line.c.x + ny * line.c.y;
      a11 += nx * nx;
      a12 += nx * ny;
      a22 += ny * ny;
      b1 += nx * d;
      b2 += ny * d;
    }
    const det = a11 * a22 - a12 * a12;
    vertices[vi] = { x: (b1 * a22 - b2 * a12) / det, y: (a11 * b2 - a12 * b1) / det };
  }

  const segments: [number, number][] = [];
  for (const e of edges) for (let k = 1; k < e.path.length; k++) segments.push([e.path[k - 1], e.path[k]]);
  const snapped = snapToDimetric(vertices, segments);
  const xs = snapped.map((p) => p.x);
  const ys = snapped.map((p) => p.y);
  const frame: Frame = { x: Math.min(...xs), y: Math.min(...ys), width: 0, height: 0 };
  frame.width = Math.max(...xs) - frame.x;
  frame.height = Math.max(...ys) - frame.y;
  const at = (i: number): Point => ({ x: snapped[i].x - frame.x, y: snapped[i].y - frame.y });
  const loopsFor = (inside: (region: number) => boolean): Point[][] =>
    boundaryLoops(edges, inside).map((loop) => dropCollinear(loop.map(at)));

  const faces = [...regionClass.keys()]
    .filter((r) => r !== outside)
    .map((region) => ({
      region,
      color: palette[(regionClass.get(region) as number) - 1],
      area: regionArea.get(region) as number,
      loops: loopsFor((q) => q === region),
    }))
    .sort((a, b) => b.area - a.area || a.region - b.region);
  // Each layer is its face plus an underlay strip into every later neighbour.
  const layers = faces.map((face, pos) => {
    const strips: Point[][] = [];
    for (const later of faces.slice(pos + 1)) {
      const laterLoops = boundaryLoops(edges, (q) => q === later.region);
      for (const e of edges) {
        if (e.left === face.region && e.right === later.region) strips.push(underlayStrip(e.path.slice().reverse(), laterLoops, at));
        if (e.right === face.region && e.left === later.region) strips.push(underlayStrip(e.path, laterLoops, at));
      }
    }
    return { color: face.color, loops: [...face.loops, ...strips] };
  });
  // The mark nests three shapes: the outer hexagon, the C-shaped band and the
  // small inner cube. The inner cube is the two smallest faces, which must meet.
  const [top, side] = faces.slice(-2);
  if (!edges.some((e) => (e.left === top.region && e.right === side.region) || (e.left === side.region && e.right === top.region))) {
    throw new Error("the two smallest faces should form the inner cube");
  }
  const inner = [...top.loops, ...side.loops].flat();
  const innerX = Math.min(...inner.map((p) => p.x));
  const innerY = Math.min(...inner.map((p) => p.y));
  const innerCube: Frame = {
    x: innerX,
    y: innerY,
    width: Math.max(...inner.map((p) => p.x)) - innerX,
    height: Math.max(...inner.map((p) => p.y)) - innerY,
  };
  const whiteClass = palette.indexOf(white) + 1;
  return {
    frame,
    white,
    innerCube,
    layers,
    knockout: loopsFor((q) => q !== outside && regionClass.get(q) !== whiteClass),
  };
}
