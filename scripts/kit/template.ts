// Builds the HTML document that Chromium renders into one asset. Layouts are
// described as boxes in output pixels; the browser then fits each headline to
// its box and the renderer refuses any text that overflows or is too small.

import { fontFaces } from "./fonts.ts";
import { buildScene, type Field, type SceneSpec } from "./scene.ts";

export type LogoFile =
  | "mark.svg"
  | "mark-white.svg"
  | "mark-black.svg"
  | "wordmark-light.svg"
  | "wordmark-dark.svg"
  | "lockup-on-dark.svg"
  | "lockup-on-light.svg"
  | "lockup-white.svg"
  | "lockup-black.svg";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Align = "start" | "center" | "end";

/** One line of a headline; `green` paints it in the accent green. */
export type Line = [text: string, green: boolean];

export type Item =
  /** A logo at height h; w pins the width too, so a rounded export size never overflows. */
  | { kind: "logo"; file: LogoFile; h: number; w?: number }
  /** `leading` overrides the line height, for lines whose descenders meet the next line's ascenders. */
  | { kind: "headline"; lines: Line[]; max: number; min?: number; leading?: number }
  | { kind: "eyebrow"; text: string; size: number }
  | { kind: "label"; text: string; size: number }
  | { kind: "pill"; text: string; h: number }
  | { kind: "gap"; h: number };

/** A column of items placed in a box; at most one headline, which is fitted to the space left. */
export interface Stack {
  box: Box;
  /** Horizontal alignment of the items, and vertical placement of the column. */
  align?: Align;
  valign?: Align;
  items: Item[];
}

export interface Doc {
  width: number;
  height: number;
  /** CSS background; "transparent" keeps the alpha channel for logo exports. */
  background: string;
  scene?: SceneSpec;
  stacks: Stack[];
}

const FONTS = fontFaces("/fonts/");

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { overflow: hidden; -webkit-font-smoothing: antialiased; }
#field, #art { position: absolute; inset: 0; display: block; }
.stack { position: absolute; display: flex; flex-direction: column; }
.stack > * { flex: none; }
img { display: block; }
.headline { font-family: "Hubot Sans"; font-weight: 700; font-stretch: 108%; letter-spacing: -0.045em; line-height: 0.9; color: #f4f5f1; white-space: nowrap; }
/* Room for the descenders of "cybersecurity", so the measured box holds the ink. */
.headline { padding-bottom: 0.1em; }
.headline span { display: block; width: max-content; }
.headline .g { color: #6dbb3a; }
.eyebrow { display: flex; align-items: center; gap: 0.95em; font-family: "JetBrains Mono"; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(244, 245, 241, 0.8); white-space: nowrap; }
.eyebrow::before { content: ""; width: 0.5em; height: 0.5em; border-radius: 50%; background: #8ee05a; box-shadow: 0 0 1em #58a02d; flex: none; }
.label { font-family: "JetBrains Mono"; font-weight: 500; letter-spacing: 0.06em; color: rgba(244, 245, 241, 0.72); white-space: nowrap; }
.pill { display: inline-flex; align-items: center; border-radius: 999px; background: #58a02d; color: #041003; font-family: "Mona Sans"; font-weight: 600; white-space: nowrap; }`;

const JUSTIFY: Record<Align, string> = { start: "flex-start", center: "center", end: "flex-end" };

function itemHtml(item: Item): string {
  switch (item.kind) {
    case "logo":
      return `<img src="/logo/${item.file}" alt="" style="height:${item.h}px;width:${item.w ? `${item.w}px` : "auto"}">`;
    case "headline": {
      const lines = item.lines.map(([t, g]) => `<span${g ? ' class="g"' : ""}>${t}</span>`).join("");
      const leading = item.leading ? ` style="line-height:${item.leading}"` : "";
      return `<div class="headline" data-text data-fit data-max="${item.max}" data-min="${item.min ?? 11}"${leading}>${lines}</div>`;
    }
    case "eyebrow":
      return `<div class="eyebrow" data-text style="font-size:${item.size}px">${item.text}</div>`;
    case "label":
      return `<div class="label" data-text style="font-size:${item.size}px">${item.text}</div>`;
    case "pill":
      return `<div class="pill" data-text style="height:${item.h}px;padding:0 ${Math.round(item.h * 0.5)}px;font-size:${Math.round(item.h * 0.4 * 4) / 4}px">${item.text}</div>`;
    case "gap":
      return `<div class="gap" style="height:${item.h}px"></div>`;
  }
}

export interface Prepared {
  html: string;
  field: Field | null;
}

export function documentFor(doc: Doc): Prepared {
  const scene = doc.scene ? buildScene(doc.scene) : null;
  const stacks = doc.stacks
    .map((s) => {
      const { x, y, w, h } = s.box;
      const style = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;align-items:${JUSTIFY[s.align ?? "start"]};justify-content:${JUSTIFY[s.valign ?? "start"]}`;
      return `<div class="stack" style="${style}">${s.items.map(itemHtml).join("")}</div>`;
    })
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}${CSS}
html, body { width: ${doc.width}px; height: ${doc.height}px; background: ${doc.background}; }</style></head><body>
${scene ? `<canvas id="field" width="${doc.width}" height="${doc.height}"></canvas><div id="art">${scene.svg}</div>` : ""}
${stacks}</body></html>`;
  return { html, field: scene?.field ?? null };
}

/**
 * Runs inside the page before the screenshot (Playwright serialises it, so it
 * must be self-contained): waits for fonts and images, paints the dithered
 * field, fits headlines and returns every layout problem it finds.
 */
export async function preparePage(field: Field | null): Promise<string[]> {
  await Promise.all([...document.fonts].map((f) => f.load()));
  await document.fonts.ready;
  await Promise.all([...document.images].map((img) => img.decode()));

  if (field) {
    const canvas = document.getElementById("field") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d")!;
    const { width: W, height: H } = field;
    const buf = new Float32Array(W * H * 3);
    for (let i = 0; i < W * H; i++) {
      buf[i * 3] = field.base[0];
      buf[i * 3 + 1] = field.base[1];
      buf[i * 3 + 2] = field.base[2];
    }
    for (const g of field.glows) {
      // Beyond 4 sigma a Gaussian is under 1/2900 of its peak, far below one level: skip those pixels.
      const reach = g.sigma * 4;
      const x0 = Math.max(0, Math.floor(g.x - reach));
      const x1 = Math.min(W - 1, Math.ceil(g.x + reach));
      const y0 = Math.max(0, Math.floor(g.y - reach));
      const y1 = Math.min(H - 1, Math.ceil(g.y + reach));
      const k = -1 / (2 * g.sigma * g.sigma);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const e = g.amount * Math.exp(((x - g.x) ** 2 + (y - g.y) ** 2) * k);
          const i = (y * W + x) * 3;
          if (g.mode === "add") {
            buf[i] += g.rgb[0] * e;
            buf[i + 1] += g.rgb[1] * e;
            buf[i + 2] += g.rgb[2] * e;
          } else {
            // Screen blend: light adds up but never clips to a flat white disc.
            buf[i] += (255 - buf[i]) * (g.rgb[0] / 255) * e;
            buf[i + 1] += (255 - buf[i + 1]) * (g.rgb[1] / 255) * e;
            buf[i + 2] += (255 - buf[i + 2]) * (g.rgb[2] / 255) * e;
          }
        }
      }
    }
    // Triangular dither of one step per pixel, from an integer hash so it is the same on every run.
    // JPG quantises single-pixel noise away; `grain` adds a 2x2-pixel component that survives it, for
    // fields whose ramps are too shallow for the per-pixel dither alone.
    const tri = (seed: number) => {
      let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
      h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
      h ^= h >>> 16;
      return ((h & 0xffff) + ((h >>> 16) & 0xffff)) / 65535 - 1;
    };
    const grain = field.grain ?? 0;
    const out = ctx.createImageData(W, H);
    const px = out.data;
    for (let i = 0; i < W * H; i++) {
      const x = i % W;
      const y = (i - x) / W;
      const n = tri(i) + (grain ? grain * tri(0x40000000 + (y >> 1) * W + (x >> 1)) : 0);
      px[i * 4] = Math.round(buf[i * 3] + n);
      px[i * 4 + 1] = Math.round(buf[i * 3 + 1] + n);
      px[i * 4 + 2] = Math.round(buf[i * 3 + 2] + n);
      px[i * 4 + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
  }

  const errors: string[] = [];
  const fits = (stack: HTMLElement) => {
    const box = stack.getBoundingClientRect();
    return [...stack.children].every((c) => {
      const r = c.getBoundingClientRect();
      return r.left >= box.left - 0.5 && r.right <= box.right + 0.5 && r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5;
    });
  };
  for (const stack of document.querySelectorAll<HTMLElement>(".stack")) {
    const head = stack.querySelector<HTMLElement>("[data-fit]");
    if (head) {
      // Widest size that fits, in quarter pixels: deterministic and crisp enough.
      const width = () => Math.max(...[...head.children].map((c) => c.getBoundingClientRect().width));
      let lo = Number(head.dataset.min) * 4;
      let hi = Number(head.dataset.max) * 4;
      head.style.fontSize = `${lo / 4}px`;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        head.style.fontSize = `${mid / 4}px`;
        if (fits(stack) && width() <= stack.clientWidth + 0.5) lo = mid;
        else hi = mid - 1;
      }
      head.style.fontSize = `${lo / 4}px`;
    }
    if (!fits(stack)) errors.push(`overflow in stack: ${stack.textContent?.trim().slice(0, 60) || "(logo)"}`);
  }
  for (const el of document.querySelectorAll<HTMLElement>("[data-text]")) {
    const size = Number.parseFloat(getComputedStyle(el).fontSize);
    if (size < 11) errors.push(`text below 11px (${size}px): ${el.textContent?.slice(0, 40)}`);
  }
  const placed = [...document.querySelectorAll<HTMLElement>(".stack > :not(.gap)")];
  for (const el of placed) {
    const r = el.getBoundingClientRect();
    if (r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) {
      errors.push(`outside the canvas: ${el.textContent?.slice(0, 40) || el.tagName}`);
    }
    // Items of different stacks must never collide, e.g. a pill over the end of a headline.
    for (const other of placed) {
      if (other === el || other.parentElement === el.parentElement) continue;
      const o = other.getBoundingClientRect();
      if (r.left < o.right && o.left < r.right && r.top < o.bottom && o.top < r.bottom) {
        errors.push(`overlap: ${el.textContent?.slice(0, 30) || el.tagName} / ${other.textContent?.slice(0, 30) || other.tagName}`);
      }
    }
  }
  return errors;
}
