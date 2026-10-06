// Serializes traced polygons and glyph outlines into small, self-contained SVG.
import type { Point } from "./trace.ts";

/** Two decimals keep the error far below a pixel even at 2048 px exports. */
export function num(v: number): string {
  const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
}

/** Closed polygons as path data. */
export function loopsToPath(loops: Point[][], dx = 0, dy = 0, scale = 1): string {
  return loops
    .map((loop) => `M${loop.map((p) => `${num(dx + p.x * scale)} ${num(dy + p.y * scale)}`).join("L")}Z`)
    .join("");
}

export interface SvgOptions {
  title: string;
  width: number;
  height: number;
  /** Already serialized child elements. */
  body: string[];
}

export function svgDocument({ title, width, height, body }: SvgOptions): string {
  const w = num(width);
  const h = num(height);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">`,
    // The first-child <title> names the image; no id, so inlined copies cannot clash.
    `<title>${title}</title>`,
    ...body,
    "</svg>",
    "",
  ].join("\n");
}
