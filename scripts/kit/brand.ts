// Brand facts shared by the asset templates and the page. The values come from
// the apysyk.com design tokens (proteus-landing src/styles/tokens.css), the
// mark's geometry (scripts/logo/mark.ts) and the approved copy; keep them in one
// place so a banner and the page can never disagree.

import { MARK_COLOR } from "../logo/mark.ts";

export const SITE_URL = "https://mediakit.apysyk.com/new/";
export const CONTACT = "sales@apysyk.com";
export const FOOTER = "© 2026 Apysyk. All rights reserved.";

/** Light first, like apysyk.com: paper and white surfaces, ink text, green for emphasis, one deep forest band. */
export const COLORS = {
  paper: "#f6f8f4",
  white: "#ffffff",
  ink: "#0d1a12",
  ink2: "#3b463f",
  inkDim: "#68746c",
  green: "#28743e",
  green2: "#22653a",
  greenStrong: "#174a2a",
  greenTint: "#eaf3e3",
  forest: "#123c2b",
  lime: "#a4e35a",
  mark: MARK_COLOR,
} as const;

/**
 * The mark's gradient, bottom-left to top-right: Action Green through Apysyk
 * Green to Lime. The one-colour marks stay flat.
 */
export const MARK_GRADIENT = [COLORS.green, COLORS.mark, COLORS.lime] as const;

/**
 * The gradient of a surface that carries white copy or a white logo: Forest
 * through Action Green to Apysyk Green, the same direction, one step darker
 * than the mark's so white stays readable at its bright end.
 */
export const SURFACE_GRADIENT = [COLORS.forest, COLORS.green, COLORS.mark] as const;

/** The swatches the page documents, in display order. Contrast figures are the site's own. */
export const PALETTE: { name: string; hex: string; role: string }[] = [
  { name: "Apysyk Green", hex: COLORS.mark, role: "The middle of the mark's gradient, which runs from Action Green to Lime. For logos and the brand symbol, not for text." },
  { name: "Action Green", hex: COLORS.green, role: "Buttons, links and emphasis on light surfaces; white text on it reads 5.7:1." },
  { name: "Text Green", hex: COLORS.green2, role: "The green words of two-tone headlines and green text on light surfaces (7:1)." },
  { name: "Forest", hex: COLORS.forest, role: "The one deep surface; white text on it reads 12:1." },
  { name: "Lime", hex: COLORS.lime, role: "The accent on Forest only (8:1)." },
  { name: "Paper", hex: COLORS.paper, role: "The page and the background of every brand surface." },
  { name: "White", hex: COLORS.white, role: "Cards and reading surfaces on Paper." },
  { name: "Ink", hex: COLORS.ink, role: "Text and lines on light surfaces." },
];

/**
 * The approved sentences, each one published verbatim on apysyk.com (the home page and its
 * description, the Solutions page). Nothing else may describe Apysyk.
 */
export const COPY = {
  oneLiner: "Apysyk OS brings security findings, applications and owners into one workflow.",
  short:
    "Apysyk OS brings security findings, applications and owners into one workflow. Prioritize the work, assign responsibility and track progress without replacing your tools.",
  context: "Scanners already find. Apysyk OS adds the context that turns a finding into owned work.",
  connect:
    "Apysyk connects the tools you already use and turns their signals into coordinated security work across AI, application security, supply chain, cloud, and posture management.",
  headline: ["Security.", "In sync."] as const,
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
