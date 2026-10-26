// The generator: pick a format, generate, download. It composes an SVG in the
// browser from the kit's own parts (the surfaces in scripts/kit/scene.ts, the
// logo files, the approved headlines, Mona Sans) and rasterizes it on a canvas.
// The SVG embeds everything it needs as data URLs, because an SVG drawn as an
// image may load nothing external and the canvas must stay untainted.

import { COLORS, HEADLINES } from "../scripts/kit/brand.ts";
import { buildScene, logosOn, photoOf, type Surface } from "../scripts/kit/scene.ts";

type Family = "cover" | "card" | "square" | "story" | "wallpaper";

interface Format {
  id: string;
  name: string;
  w: number;
  h: number;
  family: Family;
}

const FORMATS: Format[] = [
  { id: "linkedin-banner", name: "LinkedIn profile banner · 1584 × 396", w: 1584, h: 396, family: "cover" },
  { id: "linkedin-cover", name: "LinkedIn company cover · 1128 × 191", w: 1128, h: 191, family: "cover" },
  { id: "x-header", name: "X header · 1500 × 500", w: 1500, h: 500, family: "cover" },
  { id: "facebook-cover", name: "Facebook cover · 1640 × 624", w: 1640, h: 624, family: "cover" },
  { id: "share-card", name: "Link share card · 1200 × 630", w: 1200, h: 630, family: "card" },
  { id: "github-preview", name: "GitHub social preview · 1280 × 640", w: 1280, h: 640, family: "card" },
  { id: "instagram-square", name: "Instagram square · 1080 × 1080", w: 1080, h: 1080, family: "square" },
  { id: "instagram-story", name: "Instagram story · 1080 × 1920", w: 1080, h: 1920, family: "story" },
  { id: "wallpaper-qhd", name: "Desktop wallpaper · 2560 × 1440", w: 2560, h: 1440, family: "wallpaper" },
  { id: "wallpaper-4k", name: "Desktop wallpaper · 3840 × 2160", w: 3840, h: 2160, family: "wallpaper" },
  { id: "phone", name: "Phone wallpaper · 1179 × 2556", w: 1179, h: 2556, family: "wallpaper" },
];

const SURFACES: { id: Surface; name: string }[] = [
  { id: "aurora", name: "Aurora" },
  { id: "prism", name: "Prism" },
  { id: "lattice", name: "Lattice" },
  { id: "lighthouse", name: "Lighthouse" },
  { id: "bridge", name: "Bridge" },
  { id: "mountains", name: "Mountains" },
  { id: "woods", name: "Woods" },
  { id: "highway", name: "Highway" },
  { id: "glass", name: "Glass" },
  { id: "dunes", name: "Dunes" },
  { id: "shore", name: "Shore" },
  { id: "forest", name: "Forest" },
  { id: "gradient", name: "Gradient" },
  { id: "light", name: "Light" },
];

/** The ink of the copy on a surface: text, the accent of the second line, and dim labels. */
interface Ink {
  text: string;
  accent: string;
  dim: string;
}

/** The ink of the copy on each surface, as the kit's layouts paint it. */
function inkOn(surface: Surface): Ink {
  if (surface === "light") return { text: COLORS.ink, accent: COLORS.green2, dim: COLORS.inkDim };
  if (surface === "gradient") return { text: COLORS.white, accent: COLORS.white, dim: "rgba(255,255,255,0.72)" };
  return { text: COLORS.white, accent: COLORS.lime, dim: "rgba(255,255,255,0.72)" };
}

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

// ---------- Assets, fetched once ----------

const cache = new Map<string, Promise<string>>();

function fetchText(url: string): Promise<string> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.text();
    });
    cache.set(url, p);
  }
  return p;
}

function fetchDataUrl(url: string): Promise<string> {
  const key = `data:${url}`;
  let p = cache.get(key);
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
        return r.blob();
      })
      .then((blob) => {
        const { promise, resolve, reject } = Promise.withResolvers<string>();
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
        return promise;
      });
    cache.set(key, p);
  }
  return p;
}

/** Mona Sans as the page serves it, loaded for measuring and embedded in every SVG for drawing. */
async function font(): Promise<string> {
  const data = await fetchDataUrl("fonts/MonaSans.woff2");
  if (!document.fonts.check('600 20px "Mona Sans"')) {
    const face = new FontFace("Mona Sans", `url(${data})`, { weight: "200 900" });
    document.fonts.add(await face.load());
  }
  return `<style>@font-face{font-family:"Mona Sans";src:url(${data}) format("woff2");font-weight:200 900}</style>`;
}

interface Logo {
  inner: string;
  viewBox: string;
  w: number;
  h: number;
}

/** A logo file's drawing and viewBox, for nesting as an inner <svg>. */
async function logo(file: string): Promise<Logo> {
  const svg = await fetchText(`files/logos/svg/apysyk-${file}`);
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1];
  const inner = svg.replace(/^[^]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<title>[^<]*<\/title>/, "");
  if (!viewBox) throw new Error(`${file}: no viewBox`);
  const [, , w, h] = viewBox.split(/\s+/).map(Number);
  return { inner, viewBox, w, h };
}

const place = (l: Logo, x: number, y: number, w: number, h: number) =>
  `<svg x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" viewBox="${l.viewBox}">${l.inner}</svg>`;

const r = (n: number) => Math.round(n * 100) / 100;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------- Text ----------

const measurer = document.createElement("canvas").getContext("2d")!;

/** Width of a line at a size, with the layouts' tracking (-0.028em plus 0.3px per glyph). */
function widthOf(text: string, size: number, weight: number): number {
  measurer.font = `${weight} ${size}px "Mona Sans"`;
  return measurer.measureText(text).width + text.length * (-0.028 * size + 0.3);
}

/** The largest size, down to a quarter pixel, at which the widest line fits the box. */
function fit(lines: readonly string[], max: number, boxWidth: number): number {
  let size = max;
  while (size > 11 && Math.max(...lines.map((l) => widthOf(l, size, 600))) > boxWidth) size -= 0.25;
  return size;
}

function text(s: string, x: number, y: number, size: number, weight: number, color: string, anchor = "start"): string {
  return `<text x="${r(x)}" y="${r(y)}" font-family="Mona Sans" font-weight="${weight}" font-size="${r(size)}" letter-spacing="${r(-0.028 * size + 0.3)}" fill="${color}" text-anchor="${anchor}">${esc(s)}</text>`;
}

/**
 * An eyebrow and a two-line headline, drawn upward from a baseline or downward from a top, as the kit's
 * stacks do: "Risksquad" above, then the two lines at line-height 0.96, the second in the accent.
 */
function message(headline: readonly [string, string], x: number, boxWidth: number, max: number, eyebrowSize: number, anchor: "top" | "bottom", edge: number, ink: Ink): string {
  const size = fit(headline, max, boxWidth);
  const lead = size * 0.96;
  // Baselines: with ascenders at about 0.72 em above the baseline, the block reads from eyebrow to the second line.
  const top = anchor === "top" ? edge : edge - (eyebrowSize * 1.2 + size * 0.035 * 10 + lead * 2);
  const eyebrowBase = top + eyebrowSize * 0.95;
  const firstBase = eyebrowBase + size * 0.035 * 10 + size * 0.74;
  const secondBase = firstBase + lead;
  return [text("Risksquad", x, eyebrowBase, eyebrowSize, 600, ink.text), text(headline[0], x, firstBase, size, 600, ink.text), text(headline[1], x, secondBase, size, 600, ink.accent)].join("");
}

// ---------- Composition ----------

interface Choice {
  format: Format;
  surface: Surface;
  headline: readonly [string, string] | null;
}

async function compose({ format, surface, headline }: Choice): Promise<string> {
  const { w, h } = format;
  const logos = logosOn(surface);
  const ink = inkOn(surface);
  const [faces, lockup, stacked, mark] = await Promise.all([font(), logo(logos.lockup), logo(logos.stacked), logo(logos.mark)]);
  const photoFile = photoOf(surface);
  const photoData = photoFile ? await fetchDataUrl(`photos/${photoFile}`) : "";
  const parts: string[] = [];
  let glow: { x: number; y: number; r: number } | undefined;

  const lockupAt = (x: number, y: number, lh: number) => place(lockup, x, y, lh * (lockup.w / lockup.h), lh);
  const markAt = (cx: number, cy: number, size: number) => place(mark, cx - size / 2, cy - size / 2, size, size);
  const stackedAt = (cx: number, cy: number, lh: number) => place(stacked, cx - (lh * (stacked.w / stacked.h)) / 2, cy - lh / 2, lh * (stacked.w / stacked.h), lh);

  switch (format.family) {
    case "cover": {
      const at = { x: w * 0.82, y: h * 0.5 };
      glow = { ...at, r: h * 0.8 };
      parts.push(lockupAt(w * 0.04, h * 0.12, h * 0.072), markAt(at.x, at.y, h * 0.56));
      if (headline) parts.push(message(headline, w * 0.34, w * 0.3, h * 0.21, Math.max(11, h * 0.04), "top", h * 0.3, ink));
      break;
    }
    case "card": {
      const at = { x: w * 0.78, y: h * 0.5 };
      glow = { ...at, r: h * 0.7 };
      parts.push(lockupAt(w * 0.055, h * 0.075, h * 0.06), markAt(at.x, at.y, h * 0.52));
      if (headline) parts.push(message(headline, w * 0.055, w * 0.52, h * 0.17, h * 0.036, "bottom", h * 0.9, ink));
      break;
    }
    case "square": {
      const pad = w * 0.078;
      const at = { x: w * 0.7, y: h * 0.4 };
      glow = { ...at, r: w * 0.55 };
      parts.push(lockupAt(pad, pad, w * 0.046), markAt(at.x, at.y, w * 0.38));
      if (headline) parts.push(message(headline, pad, w * 0.6, w * 0.12, w * 0.028, "bottom", h * 0.92, ink));
      parts.push(text("apysyk.com", w - pad, h - pad, w * 0.022, 500, ink.dim, "end"));
      break;
    }
    case "story": {
      const pad = w * 0.078;
      const at = { x: w / 2, y: h * 0.3 };
      glow = { ...at, r: w * 0.6 };
      parts.push(markAt(at.x, at.y, w * 0.34), lockupAt(pad, h * 0.76, w * 0.046));
      if (headline) parts.push(message(headline, pad, w - 2 * pad, w * 0.17, w * 0.028, "top", h * 0.47, ink));
      break;
    }
    case "wallpaper": {
      const phone = h > w;
      const lh = phone ? w * 0.34 : h * 0.3;
      const at = { x: surface === "lighthouse" && !phone ? w * 0.68 : w / 2, y: phone ? h * 0.6 : h / 2 };
      glow = { ...at, r: Math.max(w, h) * 0.45 };
      parts.push(stackedAt(at.x, at.y, lh));
      break;
    }
  }

  const scene = buildScene({ width: w, height: h, surface, glow }, () => photoData).svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${faces}${scene}${parts.join("")}</svg>`;
}

/** Draws the SVG on a canvas at full size and returns the file to download: PNG for banners, JPEG for wallpapers. */
async function rasterize(svg: string, format: Format): Promise<Blob> {
  const image = new Image();
  image.decoding = "async";
  const { promise: loaded, resolve, reject } = Promise.withResolvers<void>();
  image.onload = () => resolve();
  image.onerror = () => reject(new Error("the composition did not render"));
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await loaded;
  const canvas = document.createElement("canvas");
  canvas.width = format.w;
  canvas.height = format.h;
  canvas.getContext("2d")!.drawImage(image, 0, 0, format.w, format.h);
  const type = format.family === "wallpaper" ? "image/jpeg" : "image/png";
  const { promise, resolve: done, reject: fail } = Promise.withResolvers<Blob>();
  canvas.toBlob((blob) => (blob ? done(blob) : fail(new Error("no image"))), type, 0.92);
  return promise;
}

// ---------- The section ----------

export function mountGenerator(announce: (message: string) => void): void {
  const root = document.querySelector<HTMLElement>("[data-generator]");
  if (!root) return;
  const formatSelect = root.querySelector<HTMLSelectElement>('select[name="format"]')!;
  const surfaceSelect = root.querySelector<HTMLSelectElement>('select[name="surface"]')!;
  const headlineSelect = root.querySelector<HTMLSelectElement>('select[name="headline"]')!;
  const generate = root.querySelector<HTMLButtonElement>("[data-generate]")!;
  const download = root.querySelector<HTMLButtonElement>("[data-download]")!;
  const stage = root.querySelector<HTMLElement>("[data-stage]")!;
  const caption = root.querySelector<HTMLElement>("[data-caption]")!;

  for (const f of FORMATS) formatSelect.add(new Option(f.name, f.id));
  surfaceSelect.add(new Option("Surprise me", "random"));
  for (const s of SURFACES) surfaceSelect.add(new Option(s.name, s.id));
  headlineSelect.add(new Option("Surprise me", "random"));
  HEADLINES.forEach((line, i) => headlineSelect.add(new Option(`${line[0]} ${line[1]}`, String(i))));
  headlineSelect.add(new Option("Logo only", "none"));

  let current: { choice: Choice; svg: string } | null = null;

  async function run(): Promise<void> {
    const format = FORMATS.find((f) => f.id === formatSelect.value) ?? FORMATS[0];
    const surface = surfaceSelect.value === "random" ? pick(SURFACES).id : (surfaceSelect.value as Surface);
    const headline = headlineSelect.value === "none" ? null : headlineSelect.value === "random" ? pick(HEADLINES) : HEADLINES[Number(headlineSelect.value)];
    const choice: Choice = { format, surface, headline };
    generate.disabled = true;
    download.disabled = true;
    stage.classList.add("is-busy");
    try {
      const svg = await compose(choice);
      current = { choice, svg };
      const img = new Image(format.w, format.h);
      img.alt = `${format.name} on ${surface}${headline ? `: ${headline[0]} ${headline[1]}` : ""}`;
      img.className = "generator__preview";
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      stage.replaceChildren(img);
      stage.style.aspectRatio = `${format.w} / ${format.h}`;
      caption.textContent = `${format.name} · ${SURFACES.find((s) => s.id === surface)?.name ?? surface}${headline ? ` · ${headline[0]} ${headline[1]}` : " · logo only"}`;
      download.disabled = false;
      announce(`Generated: ${caption.textContent}`);
    } catch (error) {
      caption.textContent = `Could not generate: ${(error as Error).message}`;
      announce(caption.textContent);
    } finally {
      generate.disabled = false;
      stage.classList.remove("is-busy");
    }
  }

  generate.addEventListener("click", () => void run());
  download.addEventListener("click", async () => {
    if (!current) return;
    download.disabled = true;
    try {
      const blob = await rasterize(current.svg, current.choice.format);
      const ext = blob.type === "image/jpeg" ? "jpg" : "png";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `risksquad-${current.choice.format.id}-${current.choice.surface}-${current.choice.format.w}x${current.choice.format.h}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      announce("Download started");
    } catch (error) {
      announce(`Could not download: ${(error as Error).message}`);
    } finally {
      download.disabled = false;
    }
  });
}
