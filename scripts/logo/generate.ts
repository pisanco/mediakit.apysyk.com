// Writes every SVG in brand/logo/ from the original mark geometry and Space Grotesk Medium.
//   bun scripts/logo/generate.ts
import { mkdir } from "node:fs/promises";
import { MARK_GRADIENT, SURFACE_GRADIENT } from "../kit/brand.ts";
import { MARK_SIZE, WINDOW, markPath } from "./mark.ts";
import { num, svgDocument } from "./svg.ts";
import { type Outline, outlineToPath, outlineWordmark } from "./wordmark.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
export const WORDMARK_FONT = `${ROOT}brand/fonts/SpaceGrotesk.ttf`;
export const LOGO_DIR = `${ROOT}brand/logo`;

const INK = "#f4f5f1";
const BLACK = "#000000";
const WHITE = "#ffffff";

/** What the mark is painted with: a flat colour, or the gradient a file defines once under a fixed id. */
interface Paint {
  defs: string[];
  fill: string;
}

function flat(color: string): Paint {
  return { defs: [], fill: color };
}

// Every colour file carries the same definition under the same id, so inlined copies resolve to one gradient.
const GRADIENT_ID = "mark-gradient";
const GRADIENT: Paint = {
  defs: [
    `<defs><linearGradient id="${GRADIENT_ID}" x1="0" y1="1" x2="1" y2="0">${MARK_GRADIENT.map(
      (color, i) => `<stop offset="${num(i / (MARK_GRADIENT.length - 1))}" stop-color="${color}"/>`,
    ).join("")}</linearGradient></defs>`,
  ],
  fill: `url(#${GRADIENT_ID})`,
};

/**
 * Keep the reference's full-ink heights and gap, but align the symbol with the
 * capital letters. The q descender must not pull the name above the symbol.
 */
const LOCKUP = { wordHeight: 51 / 54, gap: 27 / 54 };

interface Lockup {
  width: number;
  height: number;
  body: (mark: Paint, wordColor: string) => string[];
}

function lockup(word: Outline): Lockup {
  const fontSize = (LOCKUP.wordHeight * MARK_SIZE) / (word.bbox.maxY - word.bbox.minY);
  const textX = MARK_SIZE * (1 + LOCKUP.gap) - word.bbox.minX * fontSize;
  const baseline = (MARK_SIZE + word.capHeight * fontSize) / 2;
  const top = Math.min(0, baseline + word.bbox.minY * fontSize);
  const bottom = Math.max(MARK_SIZE, baseline + word.bbox.maxY * fontSize);
  return {
    width: textX + word.bbox.maxX * fontSize,
    height: bottom - top,
    body: (mark, wordColor) => [
      ...mark.defs,
      `<path fill="${mark.fill}" d="${markPath(0, -top)}"/>`,
      `<path fill="${wordColor}" d="${outlineToPath(word.commands, fontSize, textX, baseline - top, num)}"/>`,
    ],
  };
}

/**
 * The stacked lockup: the mark centred above the wordmark, which is set 2.3
 * marks wide, with a gap of 0.28 of the mark between them.
 */
const STACKED = { wordWidth: 2.3, gap: 0.28 };

function stacked(word: Outline): Lockup {
  const width = STACKED.wordWidth * MARK_SIZE;
  const fontSize = width / (word.bbox.maxX - word.bbox.minX);
  const wordTop = MARK_SIZE * (1 + STACKED.gap);
  return {
    width,
    height: wordTop + (word.bbox.maxY - word.bbox.minY) * fontSize,
    body: (mark, wordColor) => [
      ...mark.defs,
      `<path fill="${mark.fill}" d="${markPath((width - MARK_SIZE) / 2, 0)}"/>`,
      `<path fill="${wordColor}" d="${outlineToPath(word.commands, fontSize, -word.bbox.minX * fontSize, wordTop - word.bbox.minY * fontSize, num)}"/>`,
    ],
  };
}

/** A logo in white on its own gradient field: a plain rectangle, no rounding, with one and a half clear-space units around the logo. */
function onGradient(title: string, lock: Lockup): string {
  const [padX, padY] = [WINDOW * 1.5, WINDOW * 1.5];
  const width = lock.width + 2 * padX;
  const height = lock.height + 2 * padY;
  const field = `<defs><linearGradient id="field" x1="0" y1="1" x2="1" y2="0">${SURFACE_GRADIENT.map(
    (color, i) => `<stop offset="${num(i / (SURFACE_GRADIENT.length - 1))}" stop-color="${color}"/>`,
  ).join("")}</linearGradient></defs>`;
  return svgDocument({
    title,
    width,
    height,
    body: [field, `<rect width="${num(width)}" height="${num(height)}" fill="url(#field)"/>`, `<g transform="translate(${num(padX)} ${num(padY)})">`, ...lock.body(flat(WHITE), WHITE), "</g>"],
  });
}

export async function generateLogos(): Promise<Record<string, string>> {
  const word = await outlineWordmark(WORDMARK_FONT);
  const files: Record<string, string> = {};
  for (const [name, paint] of [
    ["mark.svg", GRADIENT],
    ["mark-white.svg", flat(WHITE)],
    ["mark-black.svg", flat(BLACK)],
  ] as const) {
    files[name] = svgDocument({ title: "Risksquad logo mark", width: MARK_SIZE, height: MARK_SIZE, body: [...paint.defs, `<path fill="${paint.fill}" d="${markPath()}"/>`] });
  }

  // The standalone wordmark is set at 1000 units per em and cropped to its ink.
  const em = 1000;
  const wordBox = { width: (word.bbox.maxX - word.bbox.minX) * em, height: (word.bbox.maxY - word.bbox.minY) * em };
  for (const [name, color] of [
    ["wordmark-light.svg", WHITE],
    ["wordmark-dark.svg", BLACK],
  ]) {
    files[name] = svgDocument({
      title: "Risksquad wordmark",
      ...wordBox,
      body: [`<path fill="${color}" d="${outlineToPath(word.commands, em, -word.bbox.minX * em, -word.bbox.minY * em, num)}"/>`],
    });
  }

  const lock = lockup(word);
  const stack = stacked(word);
  for (const [name, geometry, mark, wordColor] of [
    ["lockup-on-dark.svg", lock, GRADIENT, INK],
    ["lockup-on-light.svg", lock, GRADIENT, BLACK],
    ["lockup-white.svg", lock, flat(WHITE), WHITE],
    ["lockup-black.svg", lock, flat(BLACK), BLACK],
    ["lockup-stacked-on-dark.svg", stack, GRADIENT, INK],
    ["lockup-stacked-on-light.svg", stack, GRADIENT, BLACK],
    ["lockup-stacked-white.svg", stack, flat(WHITE), WHITE],
    ["lockup-stacked-black.svg", stack, flat(BLACK), BLACK],
  ] as const) {
    files[name] = svgDocument({ title: "Risksquad", width: geometry.width, height: geometry.height, body: geometry.body(mark, wordColor) });
  }

  // White on the gradient: the lockup as a badge, and the mark as a tile.
  files["lockup-on-gradient.svg"] = onGradient("Risksquad", lock);
  files["mark-on-gradient.svg"] = onGradient("Risksquad logo mark", {
    width: MARK_SIZE,
    height: MARK_SIZE,
    body: (mark) => [...mark.defs, `<path fill="${mark.fill}" d="${markPath()}"/>`],
  });
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
}
