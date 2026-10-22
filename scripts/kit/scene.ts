// The artwork under every rendered asset: one surface and one soft glow where
// the logo sits. The logo itself is always one of the brand/logo/ files, drawn
// whole, never cropped, never touching an edge; the layouts in catalog.ts
// place it.
//
// Paper, Forest and the brand gradient are flat. Aurora, Prism and Lattice
// are vector artwork and filters, sharp at any output size. The photographic
// surfaces share a green duotone; their CC0 sources live in brand/photos/.

import { COLORS, SURFACE_GRADIENT } from "./brand.ts";
import type { LogoFile } from "./template.ts";

export type Surface = "light" | "forest" | "gradient" | "aurora" | "prism" | "lattice" | "lighthouse" | "bridge" | "mountains" | "woods" | "highway" | "glass" | "dunes" | "shore";

export interface SceneSpec {
  width: number;
  height: number;
  surface: Surface;
  /** The glow's centre and radius, in output pixels. */
  glow?: { x: number; y: number; r: number };
}

const DARK = { glow: [COLORS.green, 0.35] as [string, number], lockup: "lockup-white.svg" as LogoFile, stacked: "lockup-stacked-on-dark.svg" as LogoFile, mark: "mark.svg" as LogoFile };
const PHOTO = { field: COLORS.forest, ...DARK, glow: [COLORS.green, 0.2] as [string, number] };

const SURFACES: Record<Surface, { field: string; glow: [color: string, opacity: number]; lockup: LogoFile; stacked: LogoFile; mark: LogoFile }> = {
  light: { field: COLORS.paper, glow: [COLORS.white, 1], lockup: "lockup-on-light.svg", stacked: "lockup-stacked-on-light.svg", mark: "mark.svg" },
  forest: { field: COLORS.forest, glow: [COLORS.green, 0.5], lockup: "lockup-white.svg", stacked: "lockup-stacked-on-dark.svg", mark: "mark.svg" },
  gradient: { field: COLORS.green, glow: [COLORS.white, 0.16], lockup: "lockup-white.svg", stacked: "lockup-stacked-white.svg", mark: "mark-white.svg" },
  aurora: { field: COLORS.forest, ...DARK },
  prism: { field: COLORS.forest, ...DARK },
  lattice: { field: COLORS.forest, ...DARK },
  lighthouse: PHOTO,
  bridge: PHOTO,
  mountains: PHOTO,
  woods: PHOTO,
  highway: PHOTO,
  glass: PHOTO,
  dunes: PHOTO,
  shore: PHOTO,
};

/**
 * The photographs: real pictures, CC0 (brand/photos/SOURCES.txt), rendered in a green duotone. `anchor`
 * says which side to keep when a frame's shape crops the picture, so the subject stays in portrait crops.
 * The lighthouse and the bridge also come as wallpapers and covers; the rest are the generator's.
 */
const PHOTOS: Partial<Record<Surface, { file: string; anchor: "xMinYMid" | "xMidYMid" | "xMaxYMid" }>> = {
  lighthouse: { file: "lighthouse.jpg", anchor: "xMinYMid" },
  bridge: { file: "bridge.jpg", anchor: "xMidYMid" },
  mountains: { file: "mountains.jpg", anchor: "xMidYMid" },
  woods: { file: "forest.jpg", anchor: "xMidYMid" },
  highway: { file: "highway.jpg", anchor: "xMidYMid" },
  glass: { file: "glass.jpg", anchor: "xMidYMid" },
  dunes: { file: "dunes.jpg", anchor: "xMidYMid" },
  shore: { file: "shore.jpg", anchor: "xMidYMid" },
};

/** Every photograph's file, for serving them to the generator. */
export const PHOTO_FILES = Object.values(PHOTOS).map((p) => p.file);

/** The CSS background under a surface's artwork. */
export function fieldOf(surface: Surface): string {
  return SURFACES[surface].field;
}

/** The logo files drawn on each surface: the lockup, the stacked lockup and the mark alone. */
export function logosOn(surface: Surface): { lockup: LogoFile; stacked: LogoFile; mark: LogoFile } {
  return SURFACES[surface];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** A point as a fraction of the frame. */
type Spot = [x: number, y: number];

/**
 * Aurora: ribbons of light along the frame's diagonal, from the lower left
 * to the upper right, bent by low-frequency noise and softened by a blur.
 * Landscape frames keep the left half calm; portrait frames keep the middle
 * calm.
 */
function aurora(w: number, h: number): { defs: string[]; body: string[] } {
  const portrait = h > w;
  const short = Math.min(w, h);
  const diagonal = Math.hypot(w, h);
  const angle = -(Math.atan2(h, w) * 180) / Math.PI;
  const ribbons: { at: Spot; length: number; thickness: number; color: string; opacity: number }[] = portrait
    ? [
        { at: [0.62, 0.18], length: 0.6, thickness: 0.3, color: COLORS.lime, opacity: 0.5 },
        { at: [0.3, 0.3], length: 0.7, thickness: 0.42, color: COLORS.mark, opacity: 0.45 },
        { at: [0.55, 0.82], length: 0.65, thickness: 0.5, color: COLORS.green, opacity: 0.8 },
        { at: [0.75, 0.9], length: 0.5, thickness: 0.22, color: COLORS.lime, opacity: 0.35 },
        { at: [0.1, 0.65], length: 0.5, thickness: 0.3, color: COLORS.green, opacity: 0.5 },
      ]
    : [
        { at: [0.7, 0.36], length: 0.6, thickness: 0.3, color: COLORS.lime, opacity: 0.5 },
        { at: [0.8, 0.2], length: 0.7, thickness: 0.42, color: COLORS.mark, opacity: 0.45 },
        { at: [0.62, 0.7], length: 0.65, thickness: 0.5, color: COLORS.green, opacity: 0.8 },
        { at: [0.92, 0.82], length: 0.5, thickness: 0.22, color: COLORS.lime, opacity: 0.35 },
        { at: [0.3, 0.95], length: 0.5, thickness: 0.3, color: COLORS.green, opacity: 0.5 },
      ];
  const soft = (name: string, color: string) =>
    `<radialGradient id="soft-${name}"><stop offset="0" stop-color="${color}" stop-opacity="1"/><stop offset="0.55" stop-color="${color}" stop-opacity="0.45"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
  const names: Record<string, string> = { [COLORS.lime]: "lime", [COLORS.mark]: "mark", [COLORS.green]: "green" };
  const shapes = ribbons
    .map(({ at, length, thickness, color, opacity }) => {
      const [cx, cy] = [at[0] * w, at[1] * h];
      return `<ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(length * diagonal * 0.5)}" ry="${r2(thickness * short * 0.5)}" transform="rotate(${r2(angle)} ${r2(cx)} ${r2(cy)})" fill="url(#soft-${names[color]})" opacity="${opacity}"/>`;
    })
    .join("");
  return {
    defs: [
      soft("lime", COLORS.lime),
      soft("mark", COLORS.mark),
      soft("green", COLORS.green),
      `<filter id="aurora" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">` +
        `<feTurbulence type="fractalNoise" baseFrequency="${(1.6 / w).toFixed(6)} ${(1.6 / h).toFixed(6)}" numOctaves="2" seed="7" result="noise"/>` +
        `<feDisplacementMap in="SourceGraphic" in2="noise" scale="${r2(short * 0.12)}" xChannelSelector="R" yChannelSelector="G"/>` +
        `<feGaussianBlur stdDeviation="${r2(short * 0.03)}"/>` +
        "</filter>",
      `<radialGradient id="vignette" gradientUnits="userSpaceOnUse" cx="${r2(w / 2)}" cy="${r2(h / 2)}" r="${r2(diagonal * 0.6)}">` +
        `<stop offset="0.45" stop-color="${COLORS.forest}" stop-opacity="0"/><stop offset="1" stop-color="#0a2219" stop-opacity="0.5"/>` +
        "</radialGradient>",
    ],
    body: [`<g filter="url(#aurora)">${shapes}</g>`, `<rect width="${w}" height="${h}" fill="url(#vignette)"/>`],
  };
}

/**
 * Prism: chamfered bars of frosted glass at 45 degrees, lit along one edge,
 * the far ones softened. Landscape frames gather them at the right; portrait
 * frames at the top and the bottom.
 */
function prism(w: number, h: number): { defs: string[]; body: string[] } {
  const portrait = h > w;
  const short = Math.min(w, h);
  const diagonal = Math.hypot(w, h);
  const bars: { at: Spot; length: number; thickness: number; opacity: number; far: boolean }[] = portrait
    ? [
        { at: [0.3, 0.14], length: 0.42, thickness: 0.16, opacity: 0.22, far: false },
        { at: [0.75, 0.22], length: 0.36, thickness: 0.1, opacity: 0.16, far: true },
        { at: [0.55, 0.05], length: 0.3, thickness: 0.07, opacity: 0.12, far: true },
        { at: [0.3, 0.86], length: 0.38, thickness: 0.14, opacity: 0.2, far: false },
        { at: [0.78, 0.92], length: 0.42, thickness: 0.09, opacity: 0.14, far: true },
      ]
    : [
        { at: [0.8, 0.32], length: 0.42, thickness: 0.17, opacity: 0.22, far: false },
        { at: [0.92, 0.6], length: 0.34, thickness: 0.1, opacity: 0.16, far: true },
        { at: [0.7, 0.82], length: 0.36, thickness: 0.14, opacity: 0.2, far: false },
        { at: [0.96, 0.1], length: 0.28, thickness: 0.09, opacity: 0.13, far: true },
        { at: [0.62, 0.12], length: 0.26, thickness: 0.07, opacity: 0.11, far: true },
      ];
  const shapes = bars
    .map(({ at, length, thickness, opacity, far }) => {
      const [cx, cy] = [at[0] * w, at[1] * h];
      const [hw, hh] = [(length * diagonal) / 2, (thickness * short) / 2];
      const bar = `<rect x="${r2(cx - hw)}" y="${r2(cy - hh)}" width="${r2(hw * 2)}" height="${r2(hh * 2)}" fill="url(#glass)" opacity="${opacity}"/>`;
      const edge = `<rect x="${r2(cx - hw)}" y="${r2(cy - hh)}" width="${r2(hw * 2)}" height="${r2(Math.max(2, short * 0.003))}" fill="${COLORS.lime}" opacity="${far ? 0.25 : 0.55}"/>`;
      return `<g transform="rotate(-45 ${r2(cx)} ${r2(cy)})"${far ? ' filter="url(#far)"' : ""}>${bar}${edge}</g>`;
    })
    .join("");
  return {
    defs: [
      `<linearGradient id="glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${COLORS.white}" stop-opacity="0.1"/><stop offset="0.5" stop-color="${COLORS.white}" stop-opacity="1"/><stop offset="1" stop-color="${COLORS.lime}" stop-opacity="0.2"/></linearGradient>`,
      `<filter id="far" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${r2(short * 0.012)}"/></filter>`,
      `<radialGradient id="vignette" gradientUnits="userSpaceOnUse" cx="${r2(w / 2)}" cy="${r2(h / 2)}" r="${r2(diagonal * 0.6)}">` +
        `<stop offset="0.45" stop-color="${COLORS.forest}" stop-opacity="0"/><stop offset="1" stop-color="#0a2219" stop-opacity="0.6"/>` +
        "</radialGradient>",
    ],
    body: [shapes, `<rect width="${w}" height="${h}" fill="url(#vignette)"/>`],
  };
}

/**
 * Lattice: the mark's own 45-degree geometry as a quiet pattern, thin lines both ways forming diamonds,
 * fading toward the centre so the logo sits on calm Forest.
 */
function lattice(w: number, h: number): { defs: string[]; body: string[] } {
  const short = Math.min(w, h);
  const cell = r2(short / 9);
  const stroke = r2(Math.max(1, short / 900));
  return {
    defs: [
      `<pattern id="lattice" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
        `<path d="M0 0H${cell}M0 0V${cell}" stroke="${COLORS.lime}" stroke-width="${stroke}" fill="none"/>` +
        "</pattern>",
      `<radialGradient id="fade" gradientUnits="userSpaceOnUse" cx="${r2(w / 2)}" cy="${r2(h / 2)}" r="${r2(Math.hypot(w, h) * 0.5)}">` +
        `<stop offset="0" stop-color="${COLORS.forest}" stop-opacity="1"/><stop offset="0.35" stop-color="${COLORS.forest}" stop-opacity="0.85"/><stop offset="1" stop-color="${COLORS.forest}" stop-opacity="0"/>` +
        "</radialGradient>",
    ],
    body: [`<rect width="${w}" height="${h}" fill="url(#lattice)" opacity="0.22"/>`, `<rect width="${w}" height="${h}" fill="url(#fade)"/>`],
  };
}

/**
 * A photograph in duotone: luminance mapped from deep Forest through Action Green to a muted bright
 * green, so every picture shares the brand's light and white copy stays readable on it.
 */
function photo(w: number, h: number, surface: Surface, href: (file: string) => string): { defs: string[]; body: string[] } {
  const { file, anchor } = PHOTOS[surface]!;
  return {
    defs: [
      `<filter id="duotone" color-interpolation-filters="sRGB">` +
        `<feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0"/>` +
        `<feComponentTransfer>` +
        `<feFuncR type="table" tableValues="0.03 0.12 0.27"/>` +
        `<feFuncG type="table" tableValues="0.1 0.4 0.6"/>` +
        `<feFuncB type="table" tableValues="0.07 0.22 0.28"/>` +
        "</feComponentTransfer>" +
        "</filter>",
      `<radialGradient id="vignette" gradientUnits="userSpaceOnUse" cx="${r2(w / 2)}" cy="${r2(h / 2)}" r="${r2(Math.hypot(w, h) * 0.6)}">` +
        `<stop offset="0.5" stop-color="${COLORS.forest}" stop-opacity="0"/><stop offset="1" stop-color="#0a2219" stop-opacity="0.55"/>` +
        "</radialGradient>",
    ],
    body: [
      `<image href="${href(file)}" width="${w}" height="${h}" preserveAspectRatio="${anchor} slice" filter="url(#duotone)"/>`,
      `<rect width="${w}" height="${h}" fill="url(#vignette)"/>`,
    ],
  };
}

/** The files a photographic surface needs, by surface, so a caller can load them ahead of time. */
export function photoOf(surface: Surface): string | undefined {
  return PHOTOS[surface]?.file;
}

/**
 * `photo` turns a photograph's file name into the URL the artwork loads it from: the renderer's own
 * mount by default, a data URL in the browser, where an SVG drawn as an image may load nothing external.
 */
export function buildScene(spec: SceneSpec, photoHref: (file: string) => string = (file) => `/photos/${file}`): { svg: string } {
  const { width: w, height: h, surface, glow } = spec;
  const tone = SURFACES[surface];
  const defs: string[] = [];
  const body: string[] = [];

  if (surface === "gradient") {
    const stops = SURFACE_GRADIENT.map((color, i) => `<stop offset="${r2(i / (SURFACE_GRADIENT.length - 1))}" stop-color="${color}"/>`).join("");
    defs.push(`<linearGradient id="field" gradientUnits="userSpaceOnUse" x1="0" y1="${h}" x2="${w}" y2="0">${stops}</linearGradient>`);
    body.push(`<rect width="${w}" height="${h}" fill="url(#field)"/>`);
  } else {
    body.push(`<rect width="${w}" height="${h}" fill="${tone.field}"/>`);
  }

  const art =
    surface === "aurora" ? aurora(w, h) : surface === "prism" ? prism(w, h) : surface === "lattice" ? lattice(w, h) : PHOTOS[surface] ? photo(w, h, surface, photoHref) : null;
  if (art) {
    defs.push(...art.defs);
    body.push(...art.body);
  }

  if (glow) {
    defs.push(
      `<radialGradient id="glow" gradientUnits="userSpaceOnUse" cx="${r2(glow.x)}" cy="${r2(glow.y)}" r="${r2(glow.r)}">` +
        `<stop offset="0" stop-color="${tone.glow[0]}" stop-opacity="${tone.glow[1]}"/><stop offset="1" stop-color="${tone.glow[0]}" stop-opacity="0"/>` +
        "</radialGradient>",
    );
    body.push(`<rect width="${w}" height="${h}" fill="url(#glow)"/>`);
  }

  return {
    svg:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="geometricPrecision">` +
      (defs.length ? `<defs>${defs.join("")}</defs>` : "") +
      body.join("") +
      "</svg>",
  };
}
