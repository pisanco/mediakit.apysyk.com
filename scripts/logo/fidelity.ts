// Renders brand/logo SVGs in Chromium and compares the mark with the source PNG.
import type { Browser } from "@playwright/test";
import { decodePng, type Rgba } from "./png.ts";
import { classify, type Frame } from "./trace.ts";

/**
 * Rasterizes `svg` into a transparent size x size canvas with its viewBox
 * stretched over `frame`. The document is inlined as a nested <svg> so it
 * renders as vectors at fractional positions: an <img> snaps to whole pixels,
 * and an SVG <image> is resampled as a bitmap, whose cubic filter rings at
 * edges. overflow is visible because a nested viewport's anti-aliased clip
 * would darken the shapes that touch it.
 */
export async function renderSvg(browser: Browser, svg: string, size: number, frame: Frame): Promise<Rgba> {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  try {
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:transparent"><svg id="canvas" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" style="display:block"></svg></body></html>`,
    );
    await page.evaluate(
      ([markup, f]) => {
        const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
        if (doc.querySelector("parsererror")) throw new Error("SVG does not parse");
        const root = document.importNode(doc.documentElement, true);
        root.setAttribute("x", String(f.x));
        root.setAttribute("y", String(f.y));
        root.setAttribute("width", String(f.width));
        root.setAttribute("height", String(f.height));
        root.setAttribute("preserveAspectRatio", "none");
        root.setAttribute("overflow", "visible");
        document.getElementById("canvas")?.append(root);
      },
      [svg, frame] as const,
    );
    const shot = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    return decodePng(new Uint8Array(shot));
  } finally {
    await page.close();
  }
}

export interface Fidelity {
  /** Fully opaque source pixels. */
  opaque: number;
  /** Opaque pixels left out because they sit on an anti-aliased edge. */
  edge: number;
  compared: number;
  matched: number;
  ratio: number;
  /** The tile with the most mismatches. */
  worst: { x: number; y: number; size: number; mismatched: number; compared: number };
  /** Per pixel: 0 not opaque in the source, 1 matched, 2 mismatched, 3 edge (excluded). */
  mask: Uint8Array;
}

/** Per-channel tolerance for a match; flat fills render exactly, so this only absorbs rounding. */
export const TOLERANCE = 8;
/** An opaque pixel within this many pixels of a color boundary is an anti-aliased edge. */
export const EDGE_RADIUS = 1;
const TILE = 32;

/**
 * What the render should show at a source pixel. The default is the source
 * pixel itself; one-color marks map each flat color class to their own color,
 * or to transparent for the knocked-out faces.
 */
export type Expected = (source: Rgba, pixel: number, colorClass: number) => [number, number, number, number];

const SAME_AS_SOURCE: Expected = (source, p) => [source.data[p * 4], source.data[p * 4 + 1], source.data[p * 4 + 2], source.data[p * 4 + 3]];

/**
 * Compares a render with the source over the source's fully opaque pixels,
 * except those on anti-aliased edges (any pixel within EDGE_RADIUS whose flat
 * color class differs). Color classes are 1 + the index in `palette`.
 */
export function compareWithSource(source: Rgba, render: Rgba, palette: string[], expected: Expected = SAME_AS_SOURCE): Fidelity {
  const { width, height } = source;
  const classes = classify(source, palette);
  let opaque = 0;
  let edge = 0;
  let matched = 0;
  const tiles = new Map<number, { mismatched: number; compared: number }>();
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (source.data[p * 4 + 3] !== 255) continue;
      opaque++;
      let onEdge = false;
      for (let dy = -EDGE_RADIUS; dy <= EDGE_RADIUS && !onEdge; dy++) {
        for (let dx = -EDGE_RADIUS; dx <= EDGE_RADIUS; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || classes[ny * width + nx] !== classes[p]) {
            onEdge = true;
            break;
          }
        }
      }
      if (onEdge) {
        edge++;
        mask[p] = 3;
        continue;
      }
      const [r, g, b, a] = expected(source, p, classes[p]);
      const got = render.data.subarray(p * 4, p * 4 + 4);
      // Only opacity matters where the expected pixel is transparent.
      const ok =
        Math.abs(got[3] - a) <= TOLERANCE &&
        (a === 0 || (Math.abs(got[0] - r) <= TOLERANCE && Math.abs(got[1] - g) <= TOLERANCE && Math.abs(got[2] - b) <= TOLERANCE));
      if (ok) matched++;
      mask[p] = ok ? 1 : 2;
      const key = Math.floor(y / TILE) * 1024 + Math.floor(x / TILE);
      const tile = tiles.get(key) ?? { mismatched: 0, compared: 0 };
      tile.compared++;
      if (!ok) tile.mismatched++;
      tiles.set(key, tile);
    }
  }
  let worst = { x: 0, y: 0, size: TILE, mismatched: 0, compared: 0 };
  for (const [key, tile] of tiles) {
    if (tile.mismatched > worst.mismatched) {
      worst = { x: (key % 1024) * TILE, y: Math.floor(key / 1024) * TILE, size: TILE, ...tile };
    }
  }
  const compared = opaque - edge;
  return { opaque, edge, compared, matched, ratio: matched / compared, worst, mask };
}
