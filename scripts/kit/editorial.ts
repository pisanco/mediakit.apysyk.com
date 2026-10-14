// The media kit's editorial split: a flat brand panel and an oversized crop
// of the real Apysyk mark. No ornamental cyber imagery. The same construction
// adapts to wide and tall formats without inventing a second visual language.

import { COLORS } from "./brand.ts";

export type Variant = "light" | "forest";
export type PanelSide = "right" | "bottom" | "none";

/** The colours of one variant: the field the copy sits on, the brand panel and the mark cropped inside it. */
export interface Tone {
  background: string;
  panel: string;
  mark: string;
}

/**
 * Light is the default, like apysyk.com: Paper with the one deep Forest band,
 * the mark cropped in it in Action Green, tone on tone, so the copy keeps the
 * only accent. Forest turns the field deep and the panel one step lighter
 * (Green Strong), with the same Action Green mark: quiet enough for wallpapers.
 */
export const TONES: Record<Variant, Tone> = {
  light: { background: COLORS.paper, panel: COLORS.forest, mark: COLORS.green },
  forest: { background: COLORS.forest, panel: COLORS.greenStrong, mark: COLORS.green },
};

export interface EditorialSpec {
  width: number;
  height: number;
  variant: Variant;
  side?: PanelSide;
  /** Panel share of the width (right) or height (bottom). */
  ratio?: number;
  /** Multiplier for the cropped mark inside the panel. */
  markScale?: number;
}

export interface EditorialArtwork {
  svg: string;
}

const MARK_PATH =
  "M618.57 154.51L309.55 0L0 154.77L0 476.21L309.56 630.99L618.57 476.48ZM121.96 219.75L203.51 260.53L309.4 204.55L412.42 259.86L412.42 369.45L203.51 260.53L203.51 374.95L305.48 425.93L412.42 369.45L497.62 412.05L309.56 509.03L121.96 415.23Z";

const r2 = (n: number) => Math.round(n * 100) / 100;

export function buildEditorial(spec: EditorialSpec): EditorialArtwork {
  const { width: w, height: h } = spec;
  const side = spec.side ?? (h > w * 1.2 ? "bottom" : "right");
  if (side === "none") {
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"/>` };
  }

  const tone = TONES[spec.variant];
  const ratio = spec.ratio ?? 0.28;
  const panel =
    side === "right"
      ? { x: w * (1 - ratio), y: 0, width: w * ratio, height: h }
      : { x: 0, y: h * (1 - ratio), width: w, height: h * ratio };
  const markSize =
    side === "right"
      ? panel.width * (spec.markScale ?? 1.4)
      : panel.height * (spec.markScale ?? 1.4);
  const markWidth = markSize * (618.57 / 630.99);
  const markX = panel.x + (panel.width - markWidth) / 2;
  const markY = panel.y + (panel.height - markSize) / 2;
  const scale = markSize / 630.99;

  return {
    svg:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="geometricPrecision">` +
      `<defs><clipPath id="panel-clip"><rect x="${r2(panel.x)}" y="${r2(panel.y)}" width="${r2(panel.width)}" height="${r2(panel.height)}"/></clipPath></defs>` +
      `<rect x="${r2(panel.x)}" y="${r2(panel.y)}" width="${r2(panel.width)}" height="${r2(panel.height)}" fill="${tone.panel}"/>` +
      `<g clip-path="url(#panel-clip)"><g transform="translate(${r2(markX)} ${r2(markY)}) scale(${r2(scale)})"><path fill="${tone.mark}" d="${MARK_PATH}"/></g></g>` +
      `</svg>`,
  };
}
