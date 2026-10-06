// The media kit's editorial split: a flat brand panel and an oversized crop
// of the real Apysyk mark. No ornamental cyber imagery. The same construction
// adapts to wide and tall formats without inventing a second visual language.

export type Variant = "dark" | "green";
export type PanelSide = "right" | "bottom" | "none";

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
  const { width: w, height: h, variant } = spec;
  const side = spec.side ?? (h > w * 1.2 ? "bottom" : "right");
  if (side === "none") {
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"/>` };
  }

  const ratio = spec.ratio ?? 0.28;
  const dark = variant === "dark";
  const panelFill = dark ? "#58a02d" : "#000000";
  const markFill = dark ? "#041003" : "#f4f5f1";
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
  const divider =
    side === "right"
      ? `<line x1="${r2(panel.x)}" y1="0" x2="${r2(panel.x)}" y2="${h}" stroke="#f4f5f1" stroke-opacity="0.12"/>`
      : `<line x1="0" y1="${r2(panel.y)}" x2="${w}" y2="${r2(panel.y)}" stroke="#f4f5f1" stroke-opacity="0.12"/>`;

  return {
    svg:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="geometricPrecision">` +
      `<defs><clipPath id="panel-clip"><rect x="${r2(panel.x)}" y="${r2(panel.y)}" width="${r2(panel.width)}" height="${r2(panel.height)}"/></clipPath></defs>` +
      `<rect x="${r2(panel.x)}" y="${r2(panel.y)}" width="${r2(panel.width)}" height="${r2(panel.height)}" fill="${panelFill}"/>` +
      divider +
      `<g clip-path="url(#panel-clip)"><g transform="translate(${r2(markX)} ${r2(markY)}) scale(${r2(scale)})"><path fill="${markFill}" d="${MARK_PATH}"/></g></g>` +
      `</svg>`,
  };
}
