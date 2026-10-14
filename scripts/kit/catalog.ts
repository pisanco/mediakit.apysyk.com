// Every rendered asset of the kit, with its exact size and its layout. Layout
// numbers are in output pixels and derived from the size, so one composition
// family serves several sizes; the renderer then fits each headline to its box.

import { COLORS, COPY } from "./brand.ts";
import { TONES, type PanelSide, type Variant } from "./editorial.ts";
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
  variant?: Variant;
  width: number;
  height: number;
  format: "png" | "jpg";
  doc: Doc;
}

/** The background each logo file is made for: Paper or White, a dark field, or Forest for the one-colour white files. */
export const LOGO_FILES: { file: LogoFile; name: string; background: "dark" | "light" | "forest" }[] = [
  { file: "lockup-on-dark.svg", name: "Lockup on dark", background: "dark" },
  { file: "lockup-on-light.svg", name: "Lockup on light", background: "light" },
  { file: "mark.svg", name: "Mark", background: "light" },
  { file: "wordmark-light.svg", name: "Wordmark, light", background: "dark" },
  { file: "wordmark-dark.svg", name: "Wordmark, dark", background: "light" },
  { file: "lockup-white.svg", name: "Lockup, white", background: "forest" },
  { file: "lockup-black.svg", name: "Lockup, black", background: "light" },
  { file: "mark-white.svg", name: "Mark, white", background: "forest" },
  { file: "mark-black.svg", name: "Mark, black", background: "light" },
];

export const LOGO_WIDTHS = [512, 1024, 2048] as const;

/** The apysyk.com home hero; its two short lines also serve tall formats, where the width sets the size. */
const HEAD2: Line[] = [
  [COPY.headline[0], false],
  [COPY.headline[1], true],
];

/** The lockup drawn for each variant's field. */
const LOCKUP: Record<Variant, LogoFile> = { light: "lockup-on-light.svg", forest: "lockup-white.svg" };

const round = Math.round;
const box = (x: number, y: number, w: number, h: number): Box => ({ x: round(x), y: round(y), w: round(w), h: round(h) });
const headline = (lines: Line[], max: number, leading?: number): Item => ({ kind: "headline", lines, max: round(max), min: 11, leading });
const logo = (file: LogoFile, h: number): Item => ({ kind: "logo", file, h: round(h) });
const gap = (h: number): Item => ({ kind: "gap", h: round(h) });
const pill = (h: number): Item => ({ kind: "pill", text: "apysyk.com", h: round(h) });
const label = (text: string, size: number): Item => ({ kind: "label", text, size: round(size) });
/** The product name above a headline, in sentence case like the apysyk.com hero. */
const eyebrow = (size: number): Item => ({ kind: "eyebrow", text: "Apysyk OS", size: round(size) });

interface EditorialOptions {
  variant?: Variant;
  side?: PanelSide;
  ratio?: number;
  markScale?: number;
}

function editorial(w: number, h: number, stacks: Stack[], options: EditorialOptions = {}): Doc {
  const variant = options.variant ?? "light";
  return {
    width: w,
    height: h,
    background: TONES[variant].background,
    tone: variant,
    art: {
      width: w,
      height: h,
      variant,
      side: options.side,
      ratio: options.ratio,
      markScale: options.markScale,
    },
    stacks,
  };
}

/**
 * Primary share-card composition: identity and message on Paper, with the
 * flat brand panel acting as a deliberate edge, never decoration.
 */
function card(w: number, h: number): Doc {
  const lh = h * 0.06;
  return editorial(w, h, [
    { box: box(w * 0.055, h * 0.075, w * 0.34, lh), valign: "center", items: [logo("lockup-on-light.svg", lh)] },
    { box: box(w * 0.44, h * 0.075, w * 0.22, lh), align: "end", valign: "center", items: [label("apysyk.com", h * 0.03)] },
    { box: box(w * 0.055, h * 0.42, w * 0.6, h * 0.48), valign: "end", items: [eyebrow(h * 0.036), gap(h * 0.035), headline(HEAD2, h * 0.17)] },
  ]);
}

/** Profile covers reserve the bottom-left avatar area and keep copy off the brand panel. */
function cover(w: number, h: number, withLogo: boolean): Doc {
  const stacks: Stack[] = [];
  if (withLogo) stacks.push({ box: box(w * 0.04, h * 0.12, w * 0.26, h * 0.072), valign: "center", items: [logo("lockup-on-light.svg", h * 0.072)] });
  stacks.push({
    box: box(w * 0.34, h * 0.12, w * 0.34, h * 0.76),
    valign: "center",
    items: [eyebrow(Math.max(11, h * 0.04)), gap(h * 0.045), headline(HEAD2, h * 0.21)],
  });
  return editorial(w, h, stacks);
}

/**
 * A page's share card as apysyk.com draws it: the opening of the page on
 * Paper, lockup top-left, the page's label, a two-line headline with the
 * green second line. No brand panel, like the site's own share images.
 */
function pageCard(pageLabel: string, lines: Line[], centered: boolean, max: number): Doc {
  const [w, h] = [1200, 630];
  return {
    width: w,
    height: h,
    background: COLORS.paper,
    tone: "light",
    stacks: [
      { box: box(66, 40, 320, 46), valign: "center", items: [logo("lockup-on-light.svg", 46)] },
      {
        box: box(66, 120, w - 132, h - 190),
        align: centered ? "center" : "start",
        valign: "center",
        items: [{ kind: "eyebrow", text: pageLabel, size: centered ? 22 : 18, green: !centered }, gap(centered ? 18 : 22), headline(lines, max)],
      },
    ],
  };
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

  // Facebook crops the sides to 16:9 on phones: keep the message in that safe area.
  const fb = (() => {
    const [w, h] = [1640, 624];
    const safe = (w - h * (16 / 9)) / 2;
    return editorial(w, h, [
      {
        box: box(safe + 40, h * 0.15, 690, h * 0.7),
        valign: "center",
        items: [logo("lockup-on-light.svg", 34), gap(56), eyebrow(24), gap(20), headline(HEAD2, 120)],
      },
    ]);
  })();

  // YouTube: the message stays inside the centred 1546 x 423 area shown by every device.
  const yt = (() => {
    const [w, h] = [2560, 1440];
    const [sw, sh] = [1546, 423];
    const [sx, sy] = [(w - sw) / 2, (h - sh) / 2];
    return editorial(w, h, [
      { box: box(sx + 8, sy + 24, 1000, sh - 48), valign: "center", items: [logo("lockup-on-light.svg", 44), gap(44), eyebrow(28), gap(16), headline(HEAD2, 128)] },
    ]);
  })();

  const square = (w: number, h: number): Doc => {
    const pad = w * 0.078;
    const lh = w * 0.046;
    const story = h / w > 1.5;
    // Stories reserve the top 13% and bottom 18% for Instagram controls.
    const top = story ? h * 0.135 : pad;
    const textY = story ? h * 0.3 : h * 0.44;
    const textH = story ? h * 0.36 : h * 0.46;
    return editorial(
      w,
      h,
      [
        { box: box(pad, top, w * 0.38, lh), valign: "center", items: [logo("lockup-on-light.svg", lh)] },
        { box: box(w * 0.45, top, w * 0.18, lh), align: "end", valign: "center", items: [label("apysyk.com", w * 0.022)] },
        {
          box: box(pad, textY, story ? w - 2 * pad : w * 0.56, textH),
          valign: story ? "center" : "end",
          items: [eyebrow(w * 0.028), gap(w * 0.03), headline(HEAD2, w * (story ? 0.17 : 0.12))],
        },
      ],
      { side: story ? "bottom" : "right", ratio: story ? 0.28 : 0.3 },
    );
  };

  // One composition at two scales, so the 2x file is the 1x file drawn sharper.
  const email = (s: number): Doc => {
    const [w, h] = [600 * s, 150 * s];
    return editorial(
      w,
      h,
      [
        {
          box: box(28 * s, 20 * s, 380 * s, 110 * s),
          valign: "center",
          items: [logo("lockup-on-light.svg", 20 * s), gap(14 * s), headline(HEAD2, 26 * s), gap(10 * s), label("apysyk.com", 11 * s)],
        },
      ],
      { ratio: 0.24 },
    );
  };

  return [
    make("linkedin-company-cover", "LinkedIn company cover", 1128, 191, cover(1128, 191, false)),
    make("linkedin-profile-banner", "LinkedIn profile banner", 1584, 396, cover(1584, 396, true)),
    make("x-header", "X header", 1500, 500, cover(1500, 500, true)),
    make("facebook-cover", "Facebook cover", 1640, 624, fb),
    make("youtube-banner", "YouTube banner", 2560, 1440, yt),
    make("github-social-preview", "GitHub social preview", 1280, 640, card(1280, 640)),
    make("share-card", "Link share card", 1200, 630, card(1200, 630)),
    make("instagram-square", "Instagram square", 1080, 1080, square(1080, 1080)),
    make("instagram-portrait", "Instagram portrait", 1080, 1350, square(1080, 1350)),
    make("instagram-story", "Instagram story", 1080, 1920, square(1080, 1920)),
    { ...make("email-signature", "Email signature", 600, 150, email(1)), category: "email" },
    { ...make("email-signature", "Email signature, 2x", 1200, 300, email(2)), category: "email" },
  ];
}

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
    return editorial(
      w,
      h,
      [
        { box: box(18 * s, 18 * s, 150 * s, 18 * s), valign: "center", items: [logo("lockup-on-light.svg", 18 * s)] },
        { box: box(18 * s, 80 * s, 174 * s, 152 * s), valign: "end", items: [headline(HEAD2, 40 * s), gap(16 * s), pill(30 * s)] },
      ],
      { ratio: 0.3 },
    );
  };

  /** Leaderboards use one horizontal reading order; the brand panel closes the frame. */
  const strip = (w: number, h: number, o: { logo: number; head: [number, number] }): Doc => {
    const [hx, hw] = o.head;
    return editorial(
      w,
      h,
      [
        { box: box(h * 0.22, 0, hx - h * 0.3, h), valign: "center", items: [logo("lockup-on-light.svg", o.logo)] },
        { box: box(hx, h * 0.1, hw, h * 0.8), valign: "center", items: [headline(HEAD2, h * 0.32)] },
        { box: box(w * 0.68, 0, w * 0.12, h), align: "end", valign: "center", items: [label("apysyk.com", 12)] },
      ],
      { ratio: 0.16 },
    );
  };

  const tall = (w: number, h: number): Doc => {
    if (w < 200) {
      return editorial(
        w,
        h,
        [
          { box: box(16, 18, w - 32, 16), valign: "center", items: [logo("lockup-on-light.svg", 16)] },
          { box: box(16, 70, w - 32, 240), valign: "center", items: [eyebrow(13), gap(10), headline(HEAD2, 40)] },
          { box: box(16, h * 0.64, w - 32, 24), items: [label("apysyk.com", 12)] },
        ],
        { side: "bottom", ratio: 0.28 },
      );
    }
    return editorial(
      w,
      h,
      [
        { box: box(24, 24, w - 48, 22), valign: "center", items: [logo("lockup-on-light.svg", 22)] },
        { box: box(24, 100, w - 48, 255), valign: "center", items: [eyebrow(17), gap(14), headline(HEAD2, 72)] },
        { box: box(24, h * 0.62, w - 48, 34), items: [pill(34)] },
      ],
      { side: "bottom", ratio: 0.28 },
    );
  };

  const mobile = (w: number, h: number): Doc => {
    if (h <= 50) {
      return editorial(
        w,
        h,
        [
          { box: box(10, 0, 28, h), valign: "center", items: [logo("mark.svg", 26)] },
          { box: box(46, 4, 108, h - 8), valign: "center", items: [headline(HEAD2, 20)] },
          { box: box(164, 0, 78, h), valign: "center", items: [label("apysyk.com", 11)] },
        ],
        { ratio: 0.22 },
      );
    }
    return editorial(
      w,
      h,
      [
        { box: box(16, 14, 160, 16), valign: "center", items: [logo("lockup-on-light.svg", 16)] },
        { box: box(16, 42, 138, 44), valign: "end", items: [headline(HEAD2, 24)] },
        { box: box(164, 42, 78, 44), valign: "end", items: [label("apysyk.com", 11)] },
      ],
      { ratio: 0.24 },
    );
  };

  return [
    make("Medium rectangle", 300, 250, rectangle(300, 250)),
    make("Large rectangle", 336, 280, rectangle(336, 280)),
    make("Leaderboard", 728, 90, strip(728, 90, { logo: 22, head: [176, 300] })),
    make("Large leaderboard", 970, 90, strip(970, 90, { logo: 24, head: [214, 390] })),
    make(
      "Billboard",
      970,
      250,
      editorial(
        970,
        250,
        [{ box: box(40, 30, 580, 190), valign: "center", items: [logo("lockup-on-light.svg", 26), gap(26), headline(HEAD2, 60), gap(20), pill(36)] }],
        { ratio: 0.25 },
      ),
    ),
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

function wallpaper(category: "desktop" | "phone" | "tablet" | "video", variant: Variant, w: number, h: number): RenderedAsset {
  const vertical = category === "phone" || category === "tablet";
  const side: PanelSide = vertical ? "bottom" : "right";
  const ratio = category === "phone" ? 0.28 : category === "tablet" ? 0.26 : category === "video" ? 0.24 : 0.26;
  let place: { box: Box; h: number };

  if (category === "desktop") {
    const lh = h * 0.023;
    // Above the taskbar and clear of a centred dock.
    place = { box: box(h * 0.06, h - h * 0.085 - lh, w * 0.38, lh), h: lh };
  } else if (category === "video") {
    place = { box: box(h * 0.06, h * 0.06, w * 0.34, 40), h: 40 };
  } else {
    const phone = category === "phone";
    const lh = w * (phone ? 0.04 : 0.03);
    // Keep the centre clear for the clock and the bottom clear for the dock.
    place = { box: box(w * 0.075, h * (phone ? 0.13 : 0.09), w * 0.45, lh), h: lh };
  }

  const label = category === "video" ? "Video call background" : `${category[0].toUpperCase()}${category.slice(1)} wallpaper`;
  return {
    group: "wallpapers",
    category,
    variant,
    name: `${label}, ${variant}`,
    slug: `apysyk-${category === "video" ? "video-call" : "wallpaper"}-${variant}-${w}x${h}`,
    width: w,
    height: h,
    format: "jpg",
    doc: editorial(
      w,
      h,
      [{ box: place.box, valign: "center", items: [logo(LOCKUP[variant], place.h)] }],
      { variant, side, ratio },
    ),
  };
}

function wallpapers(): RenderedAsset[] {
  const out: RenderedAsset[] = [];
  for (const variant of ["light", "forest"] as const) {
    for (const [w, h] of DESKTOP) out.push(wallpaper("desktop", variant, w, h));
    for (const [w, h] of PHONE) out.push(wallpaper("phone", variant, w, h));
    for (const [w, h] of TABLET) out.push(wallpaper("tablet", variant, w, h));
    out.push(wallpaper("video", variant, 1920, 1080));
  }
  return out;
}

/** The apysyk.com share images: each page's label and hero, as the site shows them. */
function imagery(): RenderedAsset[] {
  const cards: { slug: string; name: string; doc: Doc }[] = [
    { slug: "home", name: "Home", doc: pageCard("Apysyk OS", HEAD2, true, 150) },
    {
      slug: "platform",
      name: "Platform",
      doc: pageCard(
        "Platform",
        [
          ["The operating model for", false],
          ["cybersecurity execution.", true],
        ],
        false,
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
        false,
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
      // 56% of the side keeps the hexagon inside a circular crop with room around it.
      stacks: [{ box: box(0, 0, 1024, 1024), align: "center", valign: "center", items: [logo("mark.svg", 1024 * 0.56)] }],
    },
  }));
}

export function renderedAssets(): RenderedAsset[] {
  return [...avatars(), ...social(), ...display(), ...imagery(), ...wallpapers()];
}

/** The page's own share image, drawn like the apysyk.com cover cards with the page's hero. */
export function ogImage(): Doc {
  return pageCard("Apysyk media kit", [["Brand", false], ["assets.", true]], true, 170);
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
