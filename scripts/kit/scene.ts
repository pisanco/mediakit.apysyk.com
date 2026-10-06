// The brand imagery of apysyk.com (see https://apysyk.com/og/home.jpg), drawn
// as vectors so every size is crisp: a patch of hexagon lattice in gentle
// perspective, thin light lines with small nodes, one soft white-green glow at
// a node, a few green points and sparse dust.
//
// The geometry is computed here (deterministically, from a seed) and emitted as
// SVG. The large soft glows are painted per pixel by the template's canvas
// instead, because only there can they be dithered: a CSS or SVG gradient this
// dark bands visibly once it is saved as JPG.

export type Variant = "dark" | "green";

export interface Patch {
  /** Centre of the patch on the canvas, px. */
  cx: number;
  cy: number;
  /** On-screen radius of the patch, px (before perspective). */
  radius: number;
  /** Rings of cells from the centre to the edge. */
  rings?: number;
  /** Glow strength; 0 draws no glow. */
  glow?: number;
  /** Number of green nodes inside the patch. */
  greens?: number;
  /** Number of free points scattered just outside the patch. */
  strays?: number;
}

export interface SceneSpec {
  width: number;
  height: number;
  variant: Variant;
  seed: string;
  /** Line width in px; everything else (nodes, dust, halos) scales with it. */
  unit: number;
  patches: Patch[];
  /** Dust density multiplier (1 is the og image's density). */
  dust?: number;
  /** An ellipse kept free of dust, e.g. where a person sits on a video call. */
  calm?: { cx: number; cy: number; rx: number; ry: number };
}

/**
 * A soft light painted by the canvas: a Gaussian of the given colour.
 * "screen" brightens towards rgb and never clips; "add" adds rgb (a signed
 * delta) at full amount, which builds exact radial colour ramps.
 */
export interface Glow {
  x: number;
  y: number;
  sigma: number;
  rgb: [number, number, number];
  amount: number;
  mode?: "screen" | "add";
}

export interface Field {
  width: number;
  height: number;
  base: [number, number, number];
  glows: Glow[];
  /** Amplitude, in levels, of a coarse dither that survives JPG compression; 0 for none. */
  grain?: number;
}

export interface Scene {
  svg: string;
  field: Field;
}

/** mulberry32 seeded by an FNV-1a hash of the seed text: stable across machines. */
export function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

interface Vertex {
  /** Plane position, normalised so the patch radius is 1. */
  px: number;
  py: number;
  /** Screen position. */
  x: number;
  y: number;
  /** Perspective scale at this vertex. */
  k: number;
}

function buildPatch(p: Patch) {
  const rings = p.rings ?? 4;
  // The lattice plane, tilted 26 degrees around x, turned -20 around y and spun 11 in plane: enough
  // perspective to read as depth, never so much that the far cells squash.
  const rx = (26 * Math.PI) / 180;
  const ry = (-20 * Math.PI) / 180;
  const rz = (11 * Math.PI) / 180;
  // Pointy-top hexagons, like the cube of the mark. Cell circumradius s is
  // chosen so the outer ring's vertices land near radius 1.
  const s = 1 / (rings * Math.sqrt(3) + 1);
  const focal = 3.4;

  const project = (px: number, py: number): Vertex => {
    const x1 = px * Math.cos(rz) - py * Math.sin(rz);
    const y1 = px * Math.sin(rz) + py * Math.cos(rz);
    const y2 = y1 * Math.cos(rx);
    const z2 = y1 * Math.sin(rx);
    const x3 = x1 * Math.cos(ry) + z2 * Math.sin(ry);
    const z3 = -x1 * Math.sin(ry) + z2 * Math.cos(ry);
    const k = focal / (focal + z3);
    return { px, py, x: p.cx + x3 * k * p.radius, y: p.cy + y2 * k * p.radius, k };
  };

  const vertices = new Map<string, Vertex>();
  const edges = new Map<string, [string, string]>();
  const limit = rings * Math.sqrt(3) * s * 1.001;

  for (let r = -rings - 1; r <= rings + 1; r++) {
    for (let q = -rings - 1; q <= rings + 1; q++) {
      const cx = s * Math.sqrt(3) * (q + r / 2);
      const cy = s * 1.5 * r;
      if (Math.hypot(cx, cy) > limit) continue;
      const keys: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = ((-90 + 60 * i) * Math.PI) / 180;
        const vx = cx + s * Math.cos(a);
        const vy = cy + s * Math.sin(a);
        // Rounded so neighbouring cells share the vertex they have in common.
        const k = `${Math.round(vx * 1e4)},${Math.round(vy * 1e4)}`;
        if (!vertices.has(k)) vertices.set(k, project(vx, vy));
        keys.push(k);
      }
      for (let i = 0; i < 6; i++) {
        const a = keys[i];
        const b = keys[(i + 1) % 6];
        const ek = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (!edges.has(ek)) edges.set(ek, [a, b]);
      }
    }
  }
  return { vertices, edges: [...edges.values()] };
}

export function buildScene(spec: SceneSpec): Scene {
  const { width: W, height: H, unit: u, variant } = spec;
  const rand = rng(spec.seed);
  const dark = variant === "dark";
  // Light lines on both variants: the green field runs from brand green at the glow to near-black at the
  // edges, and only a light line stays visible across that whole range.
  const line = "#f4f5f1";
  const accent = dark ? "#8ee05a" : "#eef6e8";

  const lines: string[] = [];
  const nodes: string[] = [];
  const lights: string[] = [];
  const glows: Glow[] = [];

  for (const patch of spec.patches) {
    const { vertices, edges } = buildPatch(patch);
    const alpha = 0.62;
    // Lines fade towards the rim so the patch dissolves instead of ending hard.
    const fade = (px: number, py: number) => {
      const d = Math.min(1, Math.hypot(px, py));
      return 1 - 0.6 * d * d;
    };
    for (const [a, b] of edges) {
      const va = vertices.get(a)!;
      const vb = vertices.get(b)!;
      const o = alpha * fade((va.px + vb.px) / 2, (va.py + vb.py) / 2);
      const w = u * 0.92 * ((va.k + vb.k) / 2);
      lines.push(
        `<line x1="${r2(va.x)}" y1="${r2(va.y)}" x2="${r2(vb.x)}" y2="${r2(vb.y)}" stroke-width="${r3(w)}" stroke-opacity="${r3(o)}"/>`,
      );
    }
    const list = [...vertices.values()];
    for (const v of list) {
      const o = Math.min(1, alpha * 1.25 * fade(v.px, v.py));
      nodes.push(`<circle cx="${r2(v.x)}" cy="${r2(v.y)}" r="${r3(u * 1.35 * v.k)}" fill-opacity="${r3(o)}"/>`);
    }

    // The glow sits at the node nearest a point a little off centre.
    const gx = (rand() - 0.5) * 0.36;
    const gy = (rand() - 0.5) * 0.36;
    let glowAt = list[0];
    for (const v of list) {
      if (Math.hypot(v.px - gx, v.py - gy) < Math.hypot(glowAt.px - gx, glowAt.py - gy)) glowAt = v;
    }
    const strength = patch.glow ?? 1;
    if (strength > 0) {
      const R = patch.radius;
      if (dark) {
        glows.push({ x: glowAt.x, y: glowAt.y, sigma: R * 0.06, rgb: [255, 255, 255], amount: 0.7 * strength });
        glows.push({ x: glowAt.x, y: glowAt.y, sigma: R * 0.18, rgb: [142, 224, 90], amount: 0.26 * strength });
        glows.push({ x: glowAt.x, y: glowAt.y, sigma: R * 0.6, rgb: [88, 160, 45], amount: 0.11 * strength });
      } else {
        // A deep green field lit from the glow node: brand green there, forest green (#1d3a10) around the
        // lattice's rim, near-black green (#0b170a, the base) at the edges. Two additive Gaussians whose
        // deltas sum to exactly #58a02d at the node, then a small screen glow for the light itself.
        glows.push({ x: glowAt.x, y: glowAt.y, sigma: R * 1.15, rgb: [18, 35, 6], amount: strength, mode: "add" });
        glows.push({ x: glowAt.x, y: glowAt.y, sigma: R * 0.4, rgb: [59, 102, 29], amount: strength, mode: "add" });
        glows.push({ x: glowAt.x, y: glowAt.y, sigma: R * 0.05, rgb: [255, 255, 255], amount: 0.5 * strength });
        glows.push({ x: glowAt.x, y: glowAt.y, sigma: R * 0.16, rgb: [142, 224, 90], amount: 0.22 * strength });
      }
      lights.push(
        `<circle cx="${r2(glowAt.x)}" cy="${r2(glowAt.y)}" r="${r3(u * 2.6)}" fill="#ffffff"/>`,
      );
    }

    // Green nodes: picked at random among the inner vertices.
    const inner = list.filter((v) => v !== glowAt && Math.hypot(v.px, v.py) < 0.92);
    const greens = patch.greens ?? 4;
    for (let i = 0; i < greens && inner.length; i++) {
      const [v] = inner.splice(Math.floor(rand() * inner.length), 1);
      lights.push(point(v.x, v.y, u * 1.9, accent, u));
    }
    const strays = patch.strays ?? 3;
    for (let i = 0; i < strays; i++) {
      const a = rand() * Math.PI * 2;
      const d = patch.radius * (1.12 + rand() * 0.45);
      const x = patch.cx + Math.cos(a) * d;
      const y = patch.cy + Math.sin(a) * d;
      if (x < u * 12 || y < u * 12 || x > W - u * 12 || y > H - u * 12) continue;
      if (spec.calm && insideEllipse(x, y, spec.calm)) continue;
      lights.push(point(x, y, u * 1.6, accent, u));
    }
  }

  // Dust: sparse, faint, everywhere except the calm area.
  const dust: string[] = [];
  const count = Math.round(((spec.dust ?? 1) * 0.00021 * W * H) / (u * u));
  for (let i = 0; i < count; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const o = 0.06 + rand() * rand() * 0.3;
    const r = u * (0.45 + rand() * 0.55);
    const tint = rand() < 0.1;
    if (spec.calm && insideEllipse(x, y, spec.calm)) continue;
    dust.push(
      `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r3(r)}" fill="${tint ? accent : line}" fill-opacity="${r3(o)}"/>`,
    );
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="geometricPrecision">`,
    `<defs><radialGradient id="halo"><stop offset="0" stop-color="${accent}" stop-opacity="0.5"/><stop offset="0.35" stop-color="${accent}" stop-opacity="0.16"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs>`,
    `<g>${dust.join("")}</g>`,
    `<g fill="none" stroke="${line}" stroke-linecap="round">${lines.join("")}</g>`,
    `<g fill="${line}">${nodes.join("")}</g>`,
    `<g>${lights.join("")}</g>`,
    `</svg>`,
  ].join("");

  // The green field's ramps are shallow (about 20 levels over the frame), so it needs the coarse grain.
  return { svg, field: { width: W, height: H, base: dark ? [0, 0, 0] : [11, 23, 10], glows, grain: dark ? 0 : 2 } };
}

/** The field's colour at a point, before dithering: lets a layout pick a logo colour for its background. */
export function fieldColor(field: Field, x: number, y: number): [number, number, number] {
  const c: [number, number, number] = [...field.base];
  for (const g of field.glows) {
    const e = g.amount * Math.exp(-((x - g.x) ** 2 + (y - g.y) ** 2) / (2 * g.sigma * g.sigma));
    for (let i = 0; i < 3; i++) c[i] += g.mode === "add" ? g.rgb[i] * e : (255 - c[i]) * (g.rgb[i] / 255) * e;
  }
  return c;
}

function point(x: number, y: number, r: number, color: string, u: number): string {
  return (
    `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r3(u * 9)}" fill="url(#halo)"/>` +
    `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r3(r)}" fill="${color}"/>`
  );
}

function insideEllipse(x: number, y: number, e: { cx: number; cy: number; rx: number; ry: number }): boolean {
  return ((x - e.cx) / e.rx) ** 2 + ((y - e.cy) / e.ry) ** 2 < 1;
}
