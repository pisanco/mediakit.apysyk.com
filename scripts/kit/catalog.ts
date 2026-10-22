// Every rendered asset of the kit, with its exact size and its layout. Layout
// numbers are in output pixels and derived from the size, so one composition
// family serves several sizes; the renderer then fits each headline to its box.
//
// Three surfaces carry everything: Forest, the brand gradient, and Paper. The
// logo is always drawn whole from its own files, sitting in a glow with clear
// space around it; the copy keeps to the side it leaves free.

import { COLORS, HEADLINES } from "./brand.ts";
import { LOCKUP_ASPECT, STACKED_ASPECT } from "./logo-geometry.ts";
import { fieldOf, logosOn, type Surface } from "./scene.ts";
import type { Box, Doc, Item, Line, LogoFile, Stack } from "./template.ts";

export type Group = "logos" | "banners" | "wallpapers";

export interface RenderedAsset {
  group: Group;
  /** Sub-section of the group, e.g. "social" or "phone". */
  category: string;
  /** Human name, e.g. "LinkedIn company cover". */
  name: string;
  /** File name without extension. */
  slug: string;
  variant?: Surface;
  width: number;
  height: number;
  format: "png" | "jpg";
  doc: Doc;
}

/** The background each logo file is made for: Paper or White, a dark field, Forest for the one-colour white files, or its own gradient. */
export const LOGO_FILES: { file: LogoFile; name: string; background: "dark" | "light" | "forest" }[] = [
  { file: "lockup-on-dark.svg", name: "Lockup on dark", background: "dark" },
  { file: "lockup-on-light.svg", name: "Lockup on light", background: "light" },
  { file: "mark.svg", name: "Mark", background: "light" },
  { file: "lockup-stacked-on-dark.svg", name: "Stacked lockup on dark", background: "dark" },
  { file: "lockup-stacked-on-light.svg", name: "Stacked lockup on light", background: "light" },
  { file: "lockup-on-gradient.svg", name: "Lockup on gradient", background: "light" },
  { file: "wordmark-light.svg", name: "Wordmark, light", background: "dark" },
  { file: "wordmark-dark.svg", name: "Wordmark, dark", background: "light" },
  { file: "mark-on-gradient.svg", name: "Mark on gradient", background: "light" },
  { file: "lockup-white.svg", name: "Lockup, white", background: "forest" },
  { file: "lockup-black.svg", name: "Lockup, black", background: "light" },
  { file: "lockup-stacked-white.svg", name: "Stacked lockup, white", background: "forest" },
  { file: "lockup-stacked-black.svg", name: "Stacked lockup, black", background: "light" },
  { file: "mark-white.svg", name: "Mark, white", background: "forest" },
  { file: "mark-black.svg", name: "Mark, black", background: "light" },
];

export const LOGO_WIDTHS = [512, 1024, 2048] as const;

/** A two-line headline as the layouts draw it: the second line in the accent. */
const lines = ([first, second]: readonly [string, string]): Line[] => [
  [first, false],
  [second, true],
];
/** The apysyk.com home hero; its two short lines also serve tall formats, where the width sets the size. */
const HEAD2 = lines(HEADLINES[0]);
/** The other approved lines, spread over the families so the kit shows the range: cards, Instagram, the photo covers. */
const HEAD_CARDS = lines(HEADLINES[1]);
const HEAD_SOCIAL = lines(HEADLINES[2]);
const HEAD_PHOTO = lines(HEADLINES[5]);

const round = Math.round;
const box = (x: number, y: number, w: number, h: number): Box => ({ x: round(x), y: round(y), w: round(w), h: round(h) });
const headline = (lines: Line[], max: number, leading?: number): Item => ({ kind: "headline", lines, max: round(max), min: 11, leading });
const logo = (file: LogoFile, h: number): Item => ({ kind: "logo", file, h: round(h) });
/** The box a lockup needs at height h: the logo item rounds its height, so the width follows the rounded one. */
const lockupWidth = (h: number): number => Math.ceil(round(h) * LOCKUP_ASPECT);
const gap = (h: number): Item => ({ kind: "gap", h: round(h) });
const pill = (h: number): Item => ({ kind: "pill", text: "apysyk.com", h: round(h) });
const label = (text: string, size: number): Item => ({ kind: "label", text, size: round(size) });
/** The product name above a headline, in sentence case like the apysyk.com hero. */
const eyebrow = (size: number): Item => ({ kind: "eyebrow", text: "Apysyk OS", size: round(size) });

/** The lockup for a surface, in a box of exactly its size. */
function lockupAt(surface: Surface, x: number, y: number, h: number): Stack {
  return { box: box(x, y, lockupWidth(h), h), valign: "center", items: [logo(logosOn(surface).lockup, h)] };
}

/** The stacked lockup for a surface, centred on (x, y). */
function stackedAt(surface: Surface, x: number, y: number, h: number): Stack {
  const w = Math.ceil(round(h) * STACKED_ASPECT);
  return { box: box(x - w / 2, y - h / 2, w, h), align: "center", valign: "center", items: [logo(logosOn(surface).stacked, h)] };
}

/** The mark alone for a surface, centred on (x, y), pinned to a square so a rounded size never overflows. */
function markAt(surface: Surface, x: number, y: number, size: number): Stack {
  const s = round(size);
  return { box: box(x - s / 2, y - s / 2, s, s), align: "center", valign: "center", items: [{ kind: "logo", file: logosOn(surface).mark, h: s, w: s }] };
}

/** A document on a surface, with the glow centred where the hero logo sits. */
function scene(w: number, h: number, surface: Surface, stacks: Stack[], glow?: { x: number; y: number; r: number }): Doc {
  return {
    width: w,
    height: h,
    background: fieldOf(surface),
    tone: surface,
    art: { width: w, height: h, surface, glow },
    stacks,
  };
}

/** Identity top left, message below, the mark as the hero at the right: the share-card composition. */
function card(w: number, h: number, surface: Surface = "aurora"): Doc {
  const lh = h * 0.06;
  const size = h * 0.52;
  const at = { x: w * 0.78, y: h * 0.5 };
  return scene(
    w,
    h,
    surface,
    [
      lockupAt(surface, w * 0.055, h * 0.075, lh),
      { box: box(w * 0.055, h * 0.42, w * 0.52, h * 0.48), valign: "end", items: [eyebrow(h * 0.036), gap(h * 0.035), headline(surface === "bridge" ? HEAD_PHOTO : HEAD_CARDS, h * 0.17)] },
      markAt(surface, at.x, at.y, size),
    ],
    { ...at, r: h * 0.7 },
  );
}

/** Profile covers reserve the bottom-left avatar area; the mark sits at the right. */
function cover(w: number, h: number, withLogo: boolean, surface: Surface = "aurora"): Doc {
  const at = { x: w * 0.82, y: h * 0.5 };
  const stacks: Stack[] = [];
  if (withLogo) stacks.push(lockupAt(surface, w * 0.04, h * 0.12, h * 0.072));
  stacks.push({
    box: box(w * 0.34, h * 0.12, w * 0.3, h * 0.76),
    valign: "center",
    items: [eyebrow(Math.max(11, h * 0.04)), gap(h * 0.045), headline(surface === "bridge" ? HEAD_PHOTO : HEAD2, h * 0.21)],
  });
  stacks.push(markAt(surface, at.x, at.y, h * 0.56));
  return scene(w, h, surface, stacks, { ...at, r: h * 0.8 });
}

/** A page's share card: the lockup top left, the page's label and its headline, the mark at the right. */
function pageCard(pageLabel: string, lines: Line[], max: number): Doc {
  const [w, h] = [1200, 630];
  const at = { x: w * 0.79, y: h * 0.52 };
  return scene(
    w,
    h,
    "aurora",
    [
      lockupAt("aurora", 66, 40, 46),
      {
        box: box(66, 120, w * 0.54, h - 190),
        valign: "center",
        items: [{ kind: "eyebrow", text: pageLabel, size: 20, green: true }, gap(22), headline(lines, max)],
      },
      markAt("aurora", at.x, at.y, h * 0.5),
    ],
    { ...at, r: h * 0.7 },
  );
}

function social(): RenderedAsset[] {
  const make = (slug: string, name: string, w: number, h: number, doc: Doc): RenderedAsset => ({
    group: "banners",
    category: "social",
    name,
    slug: `apysyk-${slug}-${w}x${h}`,
    width: w,
    height: h,
    format: "png",
    doc,
  });

  // Facebook crops the sides to 16:9 on phones: keep the message and the mark in that safe area.
  const fb = (surface: Surface) => {
    const [w, h] = [1640, 624];
    const safe = (w - h * (16 / 9)) / 2;
    const size = h * 0.56;
    const at = { x: w - safe - 60 - size / 2, y: h / 2 };
    return scene(
      w,
      h,
      surface,
      [
        {
          box: box(safe + 40, h * 0.15, 640, h * 0.7),
          valign: "center",
          items: [logo("lockup-white.svg", 34), gap(56), eyebrow(24), gap(20), headline(surface === "bridge" ? HEAD_PHOTO : HEAD2, 120)],
        },
        markAt(surface, at.x, at.y, size),
      ],
      { ...at, r: h * 0.8 },
    );
  };

  // YouTube: the message and the mark stay inside the centred 1546 x 423 area shown by every device.
  const yt = (surface: Surface) => {
    const [w, h] = [2560, 1440];
    const [sw, sh] = [1546, 423];
    const [sx, sy] = [(w - sw) / 2, (h - sh) / 2];
    const size = sh * 0.86;
    const at = { x: sx + sw - 24 - size / 2, y: h / 2 };
    return scene(
      w,
      h,
      surface,
      [
        { box: box(sx + 8, sy + 24, 760, sh - 48), valign: "center", items: [logo("lockup-white.svg", 44), gap(44), eyebrow(28), gap(16), headline(surface === "bridge" ? HEAD_PHOTO : HEAD2, 128)] },
        markAt(surface, at.x, at.y, size),
      ],
      { ...at, r: h * 0.45 },
    );
  };

  /** Instagram: the gradient itself, white copy, the mark in white as the hero. */
  const square = (w: number, h: number): Doc => {
    const pad = w * 0.078;
    const lh = w * 0.046;
    const story = h / w > 1.5;
    if (story) {
      // Stories reserve the top 13% and bottom 18% for Instagram controls.
      const at = { x: w / 2, y: h * 0.3 };
      return scene(
        w,
        h,
        "gradient",
        [
          markAt("gradient", at.x, at.y, w * 0.34),
          { box: box(pad, h * 0.44, w - 2 * pad, h * 0.28), valign: "center", items: [eyebrow(w * 0.028), gap(w * 0.03), headline(HEAD_SOCIAL, w * 0.17)] },
          lockupAt("gradient", pad, h * 0.76, lh),
        ],
        { ...at, r: w * 0.6 },
      );
    }
    const at = { x: w * 0.7, y: h * 0.4 };
    return scene(
      w,
      h,
      "gradient",
      [
        lockupAt("gradient", pad, pad, lh),
        markAt("gradient", at.x, at.y, w * 0.38),
        {
          box: box(pad, h * 0.56, w * 0.6, h * 0.36),
          valign: "end",
          items: [eyebrow(w * 0.028), gap(w * 0.03), headline(HEAD_SOCIAL, w * 0.12)],
        },
        { box: box(w * 0.6, h - pad - lh, w * 0.4 - pad, lh), align: "end", valign: "center", items: [label("apysyk.com", w * 0.022)] },
      ],
      { ...at, r: w * 0.55 },
    );
  };

  // One composition at two scales, so the 2x file is the 1x file drawn sharper. Light, as email clients are.
  const email = (s: number): Doc => {
    const [w, h] = [600 * s, 150 * s];
    const tile = 102 * s;
    return scene(w, h, "light", [
      { box: box(24 * s, (h - tile) / 2, tile, tile), valign: "center", items: [{ kind: "logo", file: "mark-on-gradient.svg", h: tile, w: tile }] },
      {
        box: box(150 * s, 20 * s, 420 * s, 110 * s),
        valign: "center",
        items: [logo("wordmark-dark.svg", 18 * s), gap(12 * s), headline(HEAD2, 24 * s), gap(10 * s), label("apysyk.com", 11 * s)],
      },
    ]);
  };

  // The wide covers and cards come on the Aurora and, as a second version, on the bridge photograph.
  const wide = (surface: Surface, suffix: string, variant?: Surface): RenderedAsset[] =>
    [
      make(`linkedin-company-cover${suffix}`, `LinkedIn company cover${variant ? `, ${variant}` : ""}`, 1128, 191, cover(1128, 191, false, surface)),
      make(`linkedin-profile-banner${suffix}`, `LinkedIn profile banner${variant ? `, ${variant}` : ""}`, 1584, 396, cover(1584, 396, true, surface)),
      make(`x-header${suffix}`, `X header${variant ? `, ${variant}` : ""}`, 1500, 500, cover(1500, 500, true, surface)),
      make(`facebook-cover${suffix}`, `Facebook cover${variant ? `, ${variant}` : ""}`, 1640, 624, fb(surface)),
      make(`youtube-banner${suffix}`, `YouTube banner${variant ? `, ${variant}` : ""}`, 2560, 1440, yt(surface)),
      make(`github-social-preview${suffix}`, `GitHub social preview${variant ? `, ${variant}` : ""}`, 1280, 640, card(1280, 640, surface)),
      make(`share-card${suffix}`, `Link share card${variant ? `, ${variant}` : ""}`, 1200, 630, card(1200, 630, surface)),
    ].map((a) => (variant ? { ...a, variant } : a));
  return [
    ...wide("aurora", ""),
    ...wide("bridge", "-bridge", "bridge"),
    make("instagram-square", "Instagram square", 1080, 1080, square(1080, 1080)),
    make("instagram-portrait", "Instagram portrait", 1080, 1350, square(1080, 1350)),
    make("instagram-story", "Instagram story", 1080, 1920, square(1080, 1920)),
    { ...make("email-signature", "Email signature", 600, 150, email(1)), category: "email" },
    { ...make("email-signature", "Email signature, 2x", 1200, 300, email(2)), category: "email" },
  ];
}

/** Display ads: all on the gradient, white copy, the mark in white beside the message. */
function display(): RenderedAsset[] {
  const make = (name: string, w: number, h: number, doc: Doc): RenderedAsset => ({
    group: "banners",
    category: "display",
    name,
    slug: `apysyk-ad-${w}x${h}`,
    width: w,
    height: h,
    format: "png",
    doc,
  });

  const rectangle = (w: number, h: number): Doc => {
    const s = w / 300;
    const size = 92 * s;
    const at = { x: w - 18 * s - size / 2, y: 86 * s };
    return scene(
      w,
      h,
      "gradient",
      [
        lockupAt("gradient", 18 * s, 18 * s, 18 * s),
        markAt("gradient", at.x, at.y, size),
        { box: box(18 * s, 140 * s, 180 * s, h - 158 * s), valign: "end", items: [headline(HEAD2, 40 * s), gap(16 * s), pill(30 * s)] },
      ],
      { ...at, r: h * 0.7 },
    );
  };

  /** Leaderboards: one horizontal reading order, the mark closing the line at the right. */
  const strip = (w: number, h: number, logoHeight: number): Doc => {
    const logoX = h * 0.22;
    const hx = logoX + lockupWidth(logoHeight) + h * 0.3;
    const size = h * 0.6;
    const at = { x: w - h * 0.3 - size / 2, y: h / 2 };
    const pillW = 150;
    return scene(
      w,
      h,
      "gradient",
      [
        lockupAt("gradient", logoX, 0, logoHeight),
        { box: box(hx, h * 0.1, at.x - size / 2 - h * 0.3 - pillW - hx, h * 0.8), valign: "center", items: [headline(HEAD2, h * 0.32)] },
        { box: box(at.x - size / 2 - h * 0.3 - pillW, 0, pillW, h), align: "end", valign: "center", items: [pill(h * 0.4)] },
        markAt("gradient", at.x, at.y, size),
      ],
      { ...at, r: h * 1.4 },
    );
  };

  /** Tall ads: the message in the upper half, the mark below it. */
  const tall = (w: number, h: number): Doc => {
    const at = { x: w / 2, y: h * 0.82 };
    if (w < 200) {
      return scene(
        w,
        h,
        "gradient",
        [
          lockupAt("gradient", 16, 18, 16),
          { box: box(16, 70, w - 32, 240), valign: "center", items: [eyebrow(13), gap(10), headline(HEAD2, 40)] },
          { box: box(16, h * 0.56, w - 32, 24), items: [label("apysyk.com", 12)] },
          markAt("gradient", at.x, at.y, w * 0.5),
        ],
        { ...at, r: w * 1.2 },
      );
    }
    return scene(
      w,
      h,
      "gradient",
      [
        lockupAt("gradient", 24, 24, 22),
        { box: box(24, 100, w - 48, 255), valign: "center", items: [eyebrow(17), gap(14), headline(HEAD2, 72)] },
        { box: box(24, h * 0.62, w - 48, 34), items: [pill(34)] },
        markAt("gradient", at.x, at.y, w * 0.42),
      ],
      { ...at, r: w * 1.1 },
    );
  };

  const mobile = (w: number, h: number): Doc => {
    if (h <= 50) {
      return scene(w, h, "gradient", [
        { box: box(10, 0, 28, h), valign: "center", items: [logo("mark-white.svg", 26)] },
        { box: box(46, 4, 118, h - 8), valign: "center", items: [headline(HEAD2, 20)] },
        { box: box(174, 0, 136, h), align: "end", valign: "center", items: [label("apysyk.com", 11)] },
      ]);
    }
    return scene(w, h, "gradient", [
      lockupAt("gradient", 16, 14, 16),
      { box: box(16, 42, 150, 44), valign: "end", items: [headline(HEAD2, 24)] },
      { box: box(176, 42, 128, 44), align: "end", valign: "end", items: [pill(28)] },
    ]);
  };

  const billboard = (() => {
    const [w, h] = [970, 250];
    const at = { x: w * 0.8, y: h / 2 };
    return scene(
      w,
      h,
      "gradient",
      [
        { box: box(40, 30, 560, 190), valign: "center", items: [logo("lockup-white.svg", 26), gap(26), headline(HEAD2, 60), gap(20), pill(36)] },
        markAt("gradient", at.x, at.y, h * 0.56),
      ],
      { ...at, r: h * 0.9 },
    );
  })();

  return [
    make("Medium rectangle", 300, 250, rectangle(300, 250)),
    make("Large rectangle", 336, 280, rectangle(336, 280)),
    make("Leaderboard", 728, 90, strip(728, 90, 22)),
    make("Large leaderboard", 970, 90, strip(970, 90, 24)),
    make("Billboard", 970, 250, billboard),
    make("Wide skyscraper", 160, 600, tall(160, 600)),
    make("Half page", 300, 600, tall(300, 600)),
    make("Mobile banner", 320, 50, mobile(320, 50)),
    make("Large mobile banner", 320, 100, mobile(320, 100)),
  ];
}

const DESKTOP = [
  [1920, 1080],
  [2560, 1440],
  [3840, 2160],
  [5120, 2880],
  [3440, 1440],
  [2560, 1600],
  [3024, 1964],
  [3456, 2234],
] as const;
const PHONE = [
  [1179, 2556],
  [1290, 2796],
  [1080, 2400],
  [1440, 3200],
] as const;
const TABLET = [
  [2048, 2732],
  [1640, 2360],
] as const;

/**
 * Wallpapers: the stacked lockup in a glow, on each of the three surfaces.
 * Desktops and tablets centre it; phones carry it below the clock and above
 * the dock; video calls keep the centre calm for the person, with the lockup
 * top left and the mark at the right.
 */
function wallpaper(category: "desktop" | "phone" | "tablet" | "video", surface: Surface, w: number, h: number): RenderedAsset {
  let stacks: Stack[];
  let glow: { x: number; y: number; r: number };
  if (category === "video") {
    const at = { x: w * 0.8, y: h * 0.5 };
    stacks = [lockupAt(surface, h * 0.06, h * 0.06, 40), markAt(surface, at.x, at.y, h * 0.4)];
    glow = { ...at, r: h * 0.7 };
  } else {
    const phone = category === "phone";
    const lh = category === "desktop" ? h * 0.3 : w * (phone ? 0.34 : 0.3);
    // The lighthouse stands in the left third of its picture: on wide screens the lockup takes the open sky at the right.
    // On phones the bridge's deck crosses the middle, so the lockup rises into the fog above it.
    const at = {
      x: surface === "lighthouse" && !phone && category !== "tablet" ? w * 0.68 : w / 2,
      y: phone ? (surface === "bridge" ? h * 0.4 : h * 0.6) : h / 2,
    };
    stacks = [stackedAt(surface, at.x, at.y, lh)];
    glow = { ...at, r: Math.max(w, h) * 0.45 };
  }

  const label = category === "video" ? "Video call background" : `${category[0].toUpperCase()}${category.slice(1)} wallpaper`;
  return {
    group: "wallpapers",
    category,
    variant: surface,
    name: `${label}, ${surface}`,
    slug: `apysyk-${category === "video" ? "video-call" : "wallpaper"}-${surface}-${w}x${h}`,
    width: w,
    height: h,
    format: "jpg",
    doc: scene(w, h, surface, stacks, glow),
  };
}

function wallpapers(): RenderedAsset[] {
  const out: RenderedAsset[] = [];
  for (const surface of ["light", "forest", "gradient", "aurora", "prism", "lattice", "lighthouse", "bridge"] as const) {
    for (const [w, h] of DESKTOP) out.push(wallpaper("desktop", surface, w, h));
    for (const [w, h] of PHONE) out.push(wallpaper("phone", surface, w, h));
    for (const [w, h] of TABLET) out.push(wallpaper("tablet", surface, w, h));
    out.push(wallpaper("video", surface, 1920, 1080));
  }
  return out;
}

/** The apysyk.com share images: each page's label and hero. */
function imagery(): RenderedAsset[] {
  const cards: { slug: string; name: string; doc: Doc }[] = [
    { slug: "home", name: "Home", doc: pageCard("Apysyk OS", HEAD2, 150) },
    {
      slug: "platform",
      name: "Platform",
      doc: pageCard(
        "Platform",
        [
          ["The operating model for", false],
          ["cybersecurity execution.", true],
        ],
        104,
      ),
    },
    {
      slug: "solutions",
      name: "Solutions",
      doc: pageCard(
        "Solutions",
        [
          ["One operating layer for every", false],
          ["security workflow.", true],
        ],
        104,
      ),
    },
  ];
  return cards.map(({ slug, name, doc }) => ({
    group: "banners",
    category: "imagery",
    name: `Cover card: ${name}`,
    slug: `apysyk-cover-${slug}-1200x630`,
    width: 1200,
    height: 630,
    format: "jpg",
    doc,
  }));
}

function avatars(): RenderedAsset[] {
  return (["white", "forest"] as const).map((bg) => ({
    group: "logos",
    category: "avatars",
    name: `Avatar on ${bg}`,
    slug: `apysyk-avatar-${bg}-1024`,
    width: 1024,
    height: 1024,
    format: "png",
    doc: {
      width: 1024,
      height: 1024,
      background: COLORS[bg],
      // 56% of the side keeps the mark inside a circular crop with room around it.
      stacks: [{ box: box(0, 0, 1024, 1024), align: "center", valign: "center", items: [logo("mark.svg", 1024 * 0.56)] }],
    },
  }));
}

export function renderedAssets(): RenderedAsset[] {
  return [...avatars(), ...social(), ...display(), ...imagery(), ...wallpapers()];
}

/** The page's own share image, drawn like the apysyk.com cover cards with the page's hero. */
export function ogImage(): Doc {
  return pageCard(
    "Risksquad media kit",
    [
      ["Brand", false],
      ["assets.", true],
    ],
    170,
  );
}

/** A logo file alone on a transparent or solid square, for favicons. */
export function icon(size: number, background: string, scale: number): Doc {
  return {
    width: size,
    height: size,
    background,
    stacks: [{ box: box(0, 0, size, size), align: "center", valign: "center", items: [logo("mark.svg", size * scale)] }],
  };
}

/** A logo export at an exact width; the height follows the SVG's viewBox. */
export function logoExport(file: LogoFile, width: number, height: number): Doc {
  return {
    width,
    height,
    background: "transparent",
    stacks: [{ box: box(0, 0, width, height), align: "center", valign: "center", items: [{ kind: "logo", file, h: height, w: width }] }],
  };
}
