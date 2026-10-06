// Writes every SVG in brand/logo/ from the two sources: the cube PNG and Hubot Sans.
//   bun scripts/logo/generate.ts
import { mkdir } from "node:fs/promises";
import { decodePng, type Rgba } from "./png.ts";
import { loopsToPath, num, svgDocument } from "./svg.ts";
import { type TracedMark, traceMark } from "./trace.ts";
import { type Outline, outlineToPath, outlineWordmark } from "./wordmark.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
export const SOURCE_PNG = `${ROOT}brand/source/logo-cube.png`;
export const WORDMARK_FONT = `${ROOT}brand/fonts/HubotSans.ttf`;
export const LOGO_DIR = `${ROOT}brand/logo`;

const INK = "#f4f5f1";
const BLACK = "#000000";
const WHITE = "#ffffff";

/**
 * The site header: a 28 px PNG (1024 px source) 10 px left of 20.48 px text.
 * In source pixels the font size is 1024 * 20.48 / 28 and the gap is 10 px
 * scaled the same way plus the PNG's transparent margin right of the cube.
 */
const HEADER = { pngPx: 28, fontPx: 20.48, gapPx: 10 };

type MarkStyle = "color" | string;

function markPaths(mark: TracedMark, style: MarkStyle, dx: number, dy: number): string[] {
  if (style === "color") {
    return mark.layers.map((layer) => `<path fill="${layer.color}" d="${loopsToPath(layer.loops, dx, dy)}"/>`);
  }
  return [`<path fill="${style}" d="${loopsToPath(mark.knockout, dx, dy)}"/>`];
}

interface Lockup {
  width: number;
  height: number;
  body: (markStyle: MarkStyle, wordColor: string) => string[];
}

function lockup(mark: TracedMark, word: Outline, sourceSize: number): Lockup {
  const scale = sourceSize / HEADER.pngPx;
  const fontSize = HEADER.fontPx * scale;
  const rightMargin = sourceSize - (mark.frame.x + mark.frame.width);
  const textX = mark.frame.width + HEADER.gapPx * scale + rightMargin;
  // The wordmark's ink is centred on the cube.
  const baseline = mark.frame.height / 2 - ((word.bbox.minY + word.bbox.maxY) / 2) * fontSize;
  const top = Math.min(0, baseline + word.bbox.minY * fontSize);
  const bottom = Math.max(mark.frame.height, baseline + word.bbox.maxY * fontSize);
  return {
    width: textX + word.bbox.maxX * fontSize,
    height: bottom - top,
    body: (markStyle, wordColor) => [
      ...markPaths(mark, markStyle, 0, -top),
      `<path fill="${wordColor}" d="${outlineToPath(word.commands, fontSize, textX, baseline - top, num)}"/>`,
    ],
  };
}

async function traceSource(): Promise<{ png: Rgba; mark: TracedMark }> {
  const png = decodePng(new Uint8Array(await Bun.file(SOURCE_PNG).arrayBuffer()));
  if (png.width !== png.height) throw new Error("the logo source should be square");
  return { png, mark: traceMark(png) };
}

export interface MarkGeometry {
  /** mark.svg's viewBox size. The lockups draw the mark at this same size. */
  width: number;
  height: number;
  /** Height of the small inner cube, in the same units: the clear-space unit. */
  innerCubeHeight: number;
}

/** Traces the source PNG (about a second) for the numbers the page needs; same trace as the SVGs. */
export async function markGeometry(): Promise<MarkGeometry> {
  const { mark } = await traceSource();
  return { width: mark.frame.width, height: mark.frame.height, innerCubeHeight: mark.innerCube.height };
}

export async function generateLogos(): Promise<Record<string, string>> {
  const { png, mark } = await traceSource();
  const word = await outlineWordmark(WORDMARK_FONT);
  const files: Record<string, string> = {};
  const { width, height } = mark.frame;
  files["mark.svg"] = svgDocument({ title: "Apysyk logo mark", width, height, body: markPaths(mark, "color", 0, 0) });
  files["mark-white.svg"] = svgDocument({ title: "Apysyk logo mark", width, height, body: markPaths(mark, WHITE, 0, 0) });
  files["mark-black.svg"] = svgDocument({ title: "Apysyk logo mark", width, height, body: markPaths(mark, BLACK, 0, 0) });

  // The standalone wordmark is set at 1000 units per em and cropped to its ink.
  const em = 1000;
  const wordBox = { width: (word.bbox.maxX - word.bbox.minX) * em, height: (word.bbox.maxY - word.bbox.minY) * em };
  for (const [name, color] of [
    ["wordmark-light.svg", INK],
    ["wordmark-dark.svg", BLACK],
  ]) {
    files[name] = svgDocument({
      title: "Apysyk wordmark",
      ...wordBox,
      body: [`<path fill="${color}" d="${outlineToPath(word.commands, em, -word.bbox.minX * em, -word.bbox.minY * em, num)}"/>`],
    });
  }

  const lock = lockup(mark, word, png.width);
  for (const [name, markStyle, wordColor] of [
    ["lockup-on-dark.svg", "color", INK],
    ["lockup-on-light.svg", "color", BLACK],
    ["lockup-white.svg", WHITE, WHITE],
    ["lockup-black.svg", BLACK, BLACK],
  ]) {
    files[name] = svgDocument({ title: "Apysyk", width: lock.width, height: lock.height, body: lock.body(markStyle, wordColor) });
  }
  return files;
}

if (import.meta.main) {
  const files = await generateLogos();
  await mkdir(LOGO_DIR, { recursive: true });
  for (const [name, svg] of Object.entries(files)) {
    await Bun.write(`${LOGO_DIR}/${name}`, svg);
    const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1];
    console.log(`${name.padEnd(22)} viewBox ${viewBox}  ${svg.length} bytes`);
  }
  const geometry = await markGeometry();
  console.log(`inner cube height ${num(geometry.innerCubeHeight)} (${((geometry.innerCubeHeight / geometry.height) * 100).toFixed(1)}% of the mark)`);
}
