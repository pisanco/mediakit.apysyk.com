// The three brand fonts as the page and the renders load them. Hubot Sans and
// Mona Sans are the unmodified upstream releases (their Reserved Font Names
// allow nothing else); JetBrains Mono, which has no Reserved Font Name, is a
// subset used only to render the page. Axis ranges are read from the files
// instead of being typed in, so the @font-face rules never claim weights or
// widths a file does not have.

import { create } from "fontkit";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const FONTS_DIR = resolve(import.meta.dir, "../../brand/fonts");

interface Axis {
  min: number;
  max: number;
}

export interface BrandFont {
  family: string;
  file: string;
  /** The CSS format() name of the file. */
  format: "truetype" | "woff2";
  /** Weight axis of the file served here. */
  weight: Axis;
  /** Width axis in percent, when the font has one. */
  width?: Axis;
  /** Weight range of the official release, when the file here is a subset with less. */
  releaseWeight?: Axis;
  /** Official source, for the page's credits. */
  source: string;
  /** The license file next to the font in brand/fonts. */
  license: string;
  /** The copyright notice, from the license's first line. */
  copyright: string;
}

function axes(file: string): Record<string, Axis> {
  const font = create(readFileSync(join(FONTS_DIR, file))) as { variationAxes: Record<string, Axis> };
  return font.variationAxes;
}

function load(family: string, file: string, source: string, releaseWeight?: Axis): BrandFont {
  const a = axes(file);
  if (!a.wght) throw new Error(`${file}: no weight axis`);
  const license = `OFL-${file.replace(/\.(woff2|ttf)$/, "")}.txt`;
  const first = readFileSync(join(FONTS_DIR, license), "utf8").split("\n")[0];
  // "Copyright 2022 The Mona Sans Project Authors (https://...), with Reserved ..." -> "Copyright 2022 The Mona Sans Project Authors"
  const copyright = first.replace(/\s*with Reserved.*$/, "").replace(/\s*\(?https?:\/\/\S+/, "").replace(/,\s*$/, "").trim();
  const format = file.endsWith(".ttf") ? "truetype" : "woff2";
  return { family, file, format, weight: a.wght, width: a.wdth, releaseWeight, source, license, copyright };
}

export const FONTS: BrandFont[] = [
  // Served as the upstream TTF: converting it to WOFF2 would make it a Modified Version.
  load("Hubot Sans", "HubotSans.ttf", "https://github.com/github/hubot-sans"),
  load("Mona Sans", "MonaSans.woff2", "https://github.com/github/mona-sans"),
  // The official JetBrains Mono release spans weights 100-800; the subset here keeps 400-600.
  load("JetBrains Mono", "JetBrainsMono.woff2", "https://www.jetbrains.com/lp/mono/", { min: 100, max: 800 }),
];

export function fontByFamily(family: string): BrandFont {
  const font = FONTS.find((f) => f.family === family);
  if (!font) throw new Error(`unknown font ${family}`);
  return font;
}

/** @font-face rules for the three fonts, served from `base` (e.g. "fonts/" or "/fonts/"). */
export function fontFaces(base: string): string {
  return FONTS.map(
    (f) => `@font-face {
  font-family: "${f.family}";
  src: url("${base}${f.file}") format("${f.format}");
  font-weight: ${f.weight.min} ${f.weight.max};${f.width ? `\n  font-stretch: ${f.width.min}% ${f.width.max}%;` : ""}
  font-display: swap;
}`,
  ).join("\n\n");
}
