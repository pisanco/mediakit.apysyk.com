// Every rendered asset of the kit, with its exact size and its layout. Layout
// numbers are in output pixels and derived from the size, so one composition
// family serves several sizes; the renderer then fits each headline to its box.

import { COPY } from "./brand.ts";
import { LOCKUP_ASPECT } from "./logo-geometry.ts";
import { buildScene, fieldColor, type Patch, type SceneSpec, type Variant } from "./scene.ts";
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

export const LOGO_FILES: { file: LogoFile; name: string; background: "dark" | "light" | "green" }[] = [
  { file: "lockup-on-dark.svg", name: "Lockup on dark", background: "dark" },
  { file: "lockup-on-light.svg", name: "Lockup on light", background: "light" },
  { file: "mark.svg", name: "Mark", background: "dark" },
  { file: "wordmark-light.svg", name: "Wordmark, light", background: "dark" },
  { file: "wordmark-dark.svg", name: "Wordmark, dark", background: "light" },
  { file: "lockup-white.svg", name: "Lockup, white", background: "green" },
  { file: "lockup-black.svg", name: "Lockup, black", background: "light" },
  { file: "mark-white.svg", name: "Mark, white", background: "green" },
  { file: "mark-black.svg", name: "Mark, black", background: "light" },
];

export const LOGO_WIDTHS = [512, 1024, 2048] as const;

/**
 * The apysyk.com cover cards the kit carries, as brand/source/og/<name>.jpg. The AI page's card is left
 * out: its headline presents Apysyk AI as available, and it is only coming soon.
 */
export const COVER_CARDS = ["home", "platform", "solutions"] as const;

const HEAD2: Line[] = [
  [COPY.headline[0], false],
  [COPY.headline[1], true],
];
// The same sentence broken for tall formats.
const HEAD4: Line[] = [
  ["The OS for", false],
  ["modern", false],
  ["cybersecurity", true],
  ["work.", true],
];

const round = Math.round;
const box = (x: number, y: number, w: number, h: number): Box => ({ x: round(x), y: round(y), w: round(w), h: round(h) });
const headline = (lines: Line[], max: number, leading?: number): Item => ({ kind: "headline", lines, max: round(max), min: 11, leading });
const logo = (file: LogoFile, h: number): Item => ({ kind: "logo", file, h: round(h) });
const gap = (h: number): Item => ({ kind: "gap", h: round(h) });
const pill = (h: number): Item => ({ kind: "pill", text: "apysyk.com", h: round(h) });
const label = (text: string, size: number): Item => ({ kind: "label", text, size: round(size) });
const eyebrow = (size: number): Item => ({ kind: "eyebrow", text: COPY.category, size: round(size) });

function scene(w: number, h: number, seed: string, unit: number, patches: Patch[], extra: Partial<SceneSpec> = {}): SceneSpec {
  return { width: w, height: h, variant: "dark", seed, unit, patches, ...extra };
}

function dark(w: number, h: number, sceneSpec: SceneSpec, stacks: Stack[]): Doc {
  return { width: w, height: h, background: "#000", scene: sceneSpec, stacks };
}

/** Lines one pixel wide at 600 px of short side, thicker above, so large banners stay crisp, not hairline. */
const bannerUnit = (w: number, h: number) => Math.max(1, Math.min(w, h) / 600);

/**
 * The og-image composition: logo top-left, lattice right, headline bottom-left. `leading` opens the
 * lines for headlines whose first line has descenders over the second's ascenders.
 */
function card(w: number, h: number, seed: string, lines: Line[] = HEAD2, url = "apysyk.com", leading?: number): Doc {
  const u = bannerUnit(w, h);
  const lh = h * 0.048;
  return dark(w, h, scene(w, h, seed, u, [{ cx: w * 0.71, cy: h * 0.36, radius: h * 0.215 }]), [
    { box: box(w * 0.05, h * 0.065, w * 0.4, lh), valign: "center", items: [logo("lockup-on-dark.svg", lh)] },
    { box: box(w * 0.5, h * 0.065, w * 0.45, lh), align: "end", valign: "center", items: [label(url, h * 0.026)] },
    { box: box(w * 0.05, h * 0.5, w * 0.84, h * 0.42), valign: "end", items: [headline(lines, h * 0.15, leading)] },
  ]);
}

/** Profile covers where an avatar overlaps the bottom-left: text right, lattice left of centre. */
function cover(w: number, h: number, seed: string, withLogo: boolean): Doc {
  const u = bannerUnit(w, h);
  const stacks: Stack[] = [];
  if (withLogo) stacks.push({ box: box(w * 0.04, h * 0.12, w * 0.3, h * 0.072), valign: "center", items: [logo("lockup-on-dark.svg", h * 0.072)] });
  stacks.push({
    box: box(w * 0.5, h * 0.16, w * 0.455, h * 0.68),
    valign: "center",
    items: [eyebrow(Math.max(11, h * 0.034)), gap(h * 0.055), headline(HEAD2, h * 0.19)],
  });
  return dark(w, h, scene(w, h, seed, u, [{ cx: w * 0.3, cy: h * 0.5, radius: h * 0.32, rings: h < 250 ? 3 : 4 }]), stacks);
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

  // Facebook crops the sides to 16:9 on phones: keep everything in the centre 1109 px.
  const fb = (() => {
    const [w, h] = [1640, 624];
    const safe = (w - h * (16 / 9)) / 2;
    return dark(w, h, scene(w, h, "facebook", bannerUnit(w, h), [{ cx: w - safe - 210, cy: h * 0.48, radius: h * 0.29 }]), [
      {
        box: box(safe + 40, h * 0.15, 660, h * 0.7),
        valign: "center",
        items: [logo("lockup-on-dark.svg", 34), gap(48), headline(HEAD2, 90)],
      },
    ]);
  })();

  // YouTube: text inside the centred 1546 x 423 safe area that every device shows.
  const yt = (() => {
    const [w, h] = [2560, 1440];
    const [sw, sh] = [1546, 423];
    const [sx, sy] = [(w - sw) / 2, (h - sh) / 2];
    return dark(w, h, scene(w, h, "youtube", 2, [{ cx: sx + sw - 250, cy: h / 2, radius: 180 }]), [
      { box: box(sx + 8, sy + 24, 1000, sh - 48), valign: "center", items: [logo("lockup-on-dark.svg", 44), gap(48), headline(HEAD2, 118)] },
    ]);
  })();

  const square = (w: number, h: number, seed: string): Doc => {
    const u = Math.max(1, w / 640);
    const pad = w * 0.078;
    const lh = w * 0.037;
    const story = h / w > 1.5;
    const squareFormat = h === w;
    // Stories: Instagram draws its own bars over the top 13% and the bottom 18%.
    const top = story ? h * 0.135 : pad;
    const bottom = story ? h * 0.18 : pad;
    // The square has the least height: a smaller lattice and headline keep them apart.
    const patch: Patch = story
      ? { cx: w * 0.52, cy: h * 0.41, radius: w * 0.27, rings: 4 }
      : squareFormat
        ? { cx: w * 0.69, cy: h * 0.275, radius: h * 0.13, rings: 4 }
        : { cx: w * 0.66, cy: top + lh + h * 0.2, radius: h * 0.18, rings: 4 };
    return dark(w, h, scene(w, h, seed, u, [patch]), [
      { box: box(pad, top, w * 0.45, lh), valign: "center", items: [logo("lockup-on-dark.svg", lh)] },
      { box: box(w * 0.5, top, w * 0.5 - pad, lh), align: "end", valign: "center", items: [label("apysyk.com", w * 0.019)] },
      {
        box: box(pad, story ? h * 0.575 : h * 0.47, w - 2 * pad, story ? h * (1 - 0.575) - bottom : h * 0.53 - pad),
        valign: story ? "start" : "end",
        items: [eyebrow(w * 0.018), gap(w * 0.04), headline(HEAD4, w * (squareFormat ? 0.105 : 0.13))],
      },
    ]);
  };

  // One composition at two scales: the same seed, with every length (unit included) times s, gives
  // the same dust, points and lattice, so the 2x file is the 1x file drawn sharper.
  const email = (s: number): Doc => {
    const [w, h] = [600 * s, 150 * s];
    return dark(w, h, scene(w, h, "email", s, [{ cx: w - 100 * s, cy: h / 2, radius: 50 * s, rings: 3, greens: 2, strays: 1 }], { dust: 0.8 }), [
      {
        box: box(28 * s, 20 * s, 380 * s, 110 * s),
        valign: "center",
        items: [logo("lockup-on-dark.svg", 20 * s), gap(14 * s), headline(HEAD2, 24 * s), gap(10 * s), label("apysyk.com", 11 * s)],
      },
    ]);
  };

  return [
    make("linkedin-company-cover", "LinkedIn company cover", 1128, 191, cover(1128, 191, "li-company", false)),
    make("linkedin-profile-banner", "LinkedIn profile banner", 1584, 396, cover(1584, 396, "li-profile", true)),
    make("x-header", "X header", 1500, 500, cover(1500, 500, "x", true)),
    make("facebook-cover", "Facebook cover", 1640, 624, fb),
    make("youtube-banner", "YouTube banner", 2560, 1440, yt),
    make("github-social-preview", "GitHub social preview", 1280, 640, card(1280, 640, "github")),
    make("share-card", "Link share card", 1200, 630, card(1200, 630, "share")),
    make("instagram-square", "Instagram square", 1080, 1080, square(1080, 1080, "ig-square")),
    make("instagram-portrait", "Instagram portrait", 1080, 1350, square(1080, 1350, "ig-portrait")),
    make("instagram-story", "Instagram story", 1080, 1920, square(1080, 1920, "ig-story")),
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
  const sc = (w: number, h: number, patches: Patch[]) => scene(w, h, `ad-${w}x${h}`, 1, patches, { dust: 0.7 });

  const rectangle = (w: number, h: number): Doc => {
    const s = w / 300;
    return dark(w, h, sc(w, h, [{ cx: 214 * s, cy: 70 * s, radius: 44 * s, rings: 3, greens: 3, strays: 1 }]), [
      { box: box(18 * s, 18 * s, 150 * s, 18 * s), valign: "center", items: [logo("lockup-on-dark.svg", 18 * s)] },
      { box: box(18 * s, 108 * s, 264 * s, 124 * s), valign: "end", items: [headline(HEAD2, 30 * s), gap(14 * s), pill(30 * s)] },
    ]);
  };

  /** Leaderboards: logo, headline, a small lattice, the URL pill, left to right. */
  const strip = (w: number, h: number, o: { logo: number; head: [number, number]; patch: number; pillH: number }): Doc => {
    const [hx, hw] = o.head;
    const pillW = o.pillH * 3.6;
    return dark(w, h, sc(w, h, [{ cx: o.patch, cy: h / 2, radius: h * 0.38, rings: 2, greens: 1, strays: 1 }]), [
      { box: box(h * 0.22, 0, hx - h * 0.3, h), valign: "center", items: [logo("lockup-on-dark.svg", o.logo)] },
      { box: box(hx, h * 0.08, hw, h * 0.84), valign: "center", items: [headline(HEAD2, h * 0.32)] },
      { box: box(w - pillW - h * 0.22, 0, pillW, h), align: "end", valign: "center", items: [pill(o.pillH)] },
    ]);
  };

  const tall = (w: number, h: number): Doc => {
    if (w < 200) {
      // The narrow skyscraper reads top to bottom: logo, message, lattice, then the URL.
      return dark(w, h, sc(w, h, [{ cx: w / 2, cy: 352, radius: 58, rings: 3 }]), [
        { box: box(16, 18, w - 32, 16), valign: "center", items: [logo("lockup-on-dark.svg", 16)] },
        { box: box(16, 70, w - 32, 160), items: [headline(HEAD4, 30)] },
        { box: box(16, h - 16 - 30, w - 32, 30), valign: "end", items: [pill(30)] },
      ]);
    }
    return dark(w, h, sc(w, h, [{ cx: w / 2, cy: 215, radius: 108, rings: 4 }]), [
      { box: box(24, 24, w - 48, 22), valign: "center", items: [logo("lockup-on-dark.svg", 22)] },
      { box: box(24, 340, w - 48, h - 364), valign: "end", items: [headline(HEAD4, 56), gap(24), pill(38)] },
    ]);
  };

  const mobile = (w: number, h: number): Doc => {
    if (h <= 50) {
      return dark(w, h, sc(w, h, []), [
        { box: box(10, 0, 28, h), valign: "center", items: [logo("mark.svg", 26)] },
        { box: box(46, 4, 164, h - 8), valign: "center", items: [headline(HEAD2, 20)] },
        { box: box(w - 104, 0, 96, h), align: "end", valign: "center", items: [pill(28)] },
      ]);
    }
    return dark(w, h, sc(w, h, [{ cx: 270, cy: 34, radius: 26, rings: 2, greens: 1, strays: 0 }]), [
      { box: box(16, 14, 160, 16), valign: "center", items: [logo("lockup-on-dark.svg", 16)] },
      { box: box(16, 40, 186, 48), valign: "end", items: [headline(HEAD2, 24)] },
      { box: box(w - 112, 54, 102, 32), align: "end", valign: "end", items: [pill(30)] },
    ]);
  };

  return [
    make("Medium rectangle", 300, 250, rectangle(300, 250)),
    make("Large rectangle", 336, 280, rectangle(336, 280)),
    make("Leaderboard", 728, 90, strip(728, 90, { logo: 22, head: [176, 330], patch: 556, pillH: 32 })),
    make("Large leaderboard", 970, 90, strip(970, 90, { logo: 24, head: [214, 430], patch: 744, pillH: 36 })),
    make(
      "Billboard",
      970,
      250,
      dark(970, 250, sc(970, 250, [{ cx: 760, cy: 125, radius: 98, rings: 4, strays: 2 }]), [
        { box: box(40, 30, 560, 190), valign: "center", items: [logo("lockup-on-dark.svg", 26), gap(24), headline(HEAD2, 56), gap(20), pill(36)] },
      ]),
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

/** WCAG relative luminance of an sRGB colour given as 0-255 channels. */
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function wallpaper(category: "desktop" | "phone" | "tablet" | "video", variant: Variant, w: number, h: number): RenderedAsset {
  let unit: number;
  let patches: Patch[];
  let calm: SceneSpec["calm"];
  // Where the logo goes; the file is chosen once the field under it is known.
  let place: { box: Box; h: number; kind: "mark" | "lockup"; align: "start" | "center" };
  if (category === "desktop") {
    // Line width follows the display's likely pixel ratio: 1 at 1080p, 2 on a 2160 px tall 4K.
    unit = Math.min(w, h) / 1080;
    const lh = h * 0.021;
    patches = [{ cx: w * (w / h > 2 ? 0.6 : 0.64), cy: h * 0.45, radius: h * 0.28, rings: 5, greens: 5, strays: 4 }];
    // Bottom-left, above any taskbar and clear of a centred dock.
    place = { box: box(h * 0.06, h - h * 0.08 - lh, w * 0.3, lh), h: lh, kind: "lockup", align: "start" };
  } else if (category === "video") {
    unit = 1;
    patches = [{ cx: w * 0.85, cy: h * 0.27, radius: h * 0.16, rings: 4, greens: 3, strays: 2, glow: 0.8 }];
    // The person sits in the middle: no lattice and no dust there.
    calm = { cx: w / 2, cy: h * 0.62, rx: w * 0.3, ry: h * 0.55 };
    place = { box: box(h * 0.06, h * 0.06, w * 0.3, 40), h: 40, kind: "lockup", align: "start" };
  } else {
    const phone = category === "phone";
    // Phones are viewed at about 3x, tablets at 2x: keep lines about one point wide.
    unit = phone ? w / 430 : w / 820;
    // Top centre stays clear for the clock, the bottom for the dock.
    patches = [{ cx: w / 2, cy: h * (phone ? 0.56 : 0.5), radius: w * (phone ? 0.36 : 0.3), rings: phone ? 4 : 5, greens: 4, strays: 3 }];
    const mh = w * (phone ? 0.045 : 0.03);
    place = { box: box(0, h * (phone ? 0.8 : 0.85), w, mh), h: mh, kind: "mark", align: "center" };
  }
  const sceneSpec: SceneSpec = { width: w, height: h, variant, seed: `${category}-${variant}-${w}x${h}`, unit, patches, calm, dust: variant === "green" ? 0.8 : 1 };

  // The full-colour logo needs its green faces (#4da61d) at 3:1 or more against the field under it;
  // where the field is lighter, the one-colour white logo takes its place. Sampled across the logo's width.
  const { field } = buildScene(sceneSpec);
  const width = place.kind === "lockup" ? place.h * LOCKUP_ASPECT : place.h;
  const x0 = place.align === "start" ? place.box.x : place.box.x + (place.box.w - width) / 2;
  const brightest = Math.max(
    ...[0, 0.25, 0.5, 0.75, 1].map((t) => luminance(fieldColor(field, x0 + width * t, place.box.y + place.box.h / 2))),
  );
  const fullColor = (luminance([77, 166, 29]) + 0.05) / (brightest + 0.05) >= 3;
  const file: LogoFile =
    place.kind === "mark" ? (fullColor ? "mark.svg" : "mark-white.svg") : fullColor ? "lockup-on-dark.svg" : "lockup-white.svg";

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
    doc: {
      width: w,
      height: h,
      background: variant === "green" ? "#0b170a" : "#000",
      scene: sceneSpec,
      stacks: [{ box: place.box, align: place.align, valign: "center", items: [logo(file, place.h)] }],
    },
  };
}

function wallpapers(): RenderedAsset[] {
  const out: RenderedAsset[] = [];
  for (const variant of ["dark", "green"] as const) {
    for (const [w, h] of DESKTOP) out.push(wallpaper("desktop", variant, w, h));
    for (const [w, h] of PHONE) out.push(wallpaper("phone", variant, w, h));
    for (const [w, h] of TABLET) out.push(wallpaper("tablet", variant, w, h));
    out.push(wallpaper("video", variant, 1920, 1080));
  }
  return out;
}

function avatars(): RenderedAsset[] {
  return (["black", "white"] as const).map((bg) => ({
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
      background: bg === "black" ? "#000" : "#fff",
      // 56% of the side keeps the hexagon inside a circular crop with room around it.
      stacks: [{ box: box(0, 0, 1024, 1024), align: "center", valign: "center", items: [logo("mark.svg", 1024 * 0.56)] }],
    },
  }));
}

export function renderedAssets(): RenderedAsset[] {
  return [...avatars(), ...social(), ...display(), ...wallpapers()];
}

/** The page's own share image. The "y" of "Apysyk" sits over the "d" and "k" of "media kit": open the lines. */
export function ogImage(): Doc {
  return card(1200, 630, "mediakit-og", [["Apysyk", false], ["media kit", true]], "mediakit.apysyk.com", 1);
}

/**
 * The hero art of the page: the lattice alone, on black, at 2x for retina screens. The page's headline
 * overlaps the art's left side on wide screens, so no stray points or dust go there.
 */
export function heroArt(): Doc {
  const [w, h] = [1600, 1100];
  const calm = { cx: 0, cy: h * 0.5, rx: w * 0.36, ry: h * 0.5 };
  return dark(w, h, scene(w, h, "hero", 2, [{ cx: w * 0.56, cy: h * 0.5, radius: h * 0.34, rings: 5, greens: 5, strays: 4 }], { calm }), []);
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
