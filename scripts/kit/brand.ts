// Brand facts shared by the asset templates, the generator and the page: the
// palette, the mark's geometry (scripts/logo/mark.ts) and the approved copy.
// Keep them in one place so a banner and the page can never disagree.

export const SITE_URL = "https://mediakit.risksquad.io/";
/** The public website: its address for links, and its host as printed on the page and the artwork. */
export const WEBSITE_URL = "https://risksquad.io/";
export const WEBSITE = new URL(WEBSITE_URL).host;
export const FOOTER = "© 2026 Risksquad. All rights reserved.";

/**
 * The whole palette: three colors and nothing else. Off-white surfaces, Ink for text and lines, Forest for
 * the mark, emphasis and every deep surface. Lines, dim text and glows are these colors at lower opacity.
 */
export const COLORS = {
  forest: "#123c2b",
  offWhite: "#eae6da",
  ink: "#0d1a12",
} as const;

/** A palette color at an opacity, as CSS. */
export function alpha(hex: string, opacity: number): string {
  return `rgba(${hexToRgb(hex).join(", ")}, ${opacity})`;
}

/** Secondary copy: Ink on Off-white (6.4:1) and Off-white on Forest (5.9:1). */
export const DIM = { onLight: alpha(COLORS.ink, 0.72), onDark: alpha(COLORS.offWhite, 0.72) } as const;

/**
 * The gradient surface, bottom-left to top-right: Ink to Forest. Off-white copy and logos read on all of
 * it, 9.9:1 or more.
 */
export const SURFACE_GRADIENT = [COLORS.ink, COLORS.forest] as const;

/** The swatches the page documents, in display order, with their measured contrast. */
export const PALETTE: { name: string; hex: string; role: string }[] = [
  { name: "Forest", hex: COLORS.forest, role: "The brand color: the mark, emphasis on Off-white and every deep surface. Forest and Off-white read 9.9:1 on each other." },
  { name: "Off-white", hex: COLORS.offWhite, role: "The page and every light surface, and the copy and logo on Forest and Ink." },
  { name: "Ink", hex: COLORS.ink, role: "Text and lines on Off-white (14.3:1), and the darkest surface." },
];

/**
 * The approved sentences, each one published verbatim on the website (the home page and its
 * description, the Solutions page). Nothing else may describe Risksquad.
 */
export const COPY = {
  oneLiner: "Risksquad brings security findings, applications and owners into one workflow.",
  short:
    "Risksquad brings security findings, applications and owners into one workflow. Prioritize the work, assign responsibility and track progress without replacing your tools.",
  context: "Scanners already find. Risksquad adds the context that turns a finding into owned work.",
  connect:
    "Risksquad connects the tools you already use and turns their signals into coordinated security work across AI, application security, supply chain, cloud, and posture management.",
  headline: ["Redefining how", "AppSec gets done"] as const,
  category: "One operating layer for every security workflow",
} as const;

/** The long boilerplate: the short text, the context it adds, then how it connects the tools. */
export const LONG_BOILERPLATE = `${COPY.short} ${COPY.context} ${COPY.connect}`;

/**
 * Short two-line headlines for banners and the generator. The site's own hero line comes first; every
 * other one restates one of the approved sentences above and claims nothing they do not.
 */
export const HEADLINES: readonly (readonly [first: string, second: string])[] = [
  COPY.headline,
  ["Findings.", "Owned."],
  ["One layer.", "Every workflow."],
  ["Prioritize.", "Assign. Track."],
  ["Scanners find.", "We add context."],
  ["Your tools.", "One workflow."],
  ["A finding becomes", "owned work."],
];

export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
