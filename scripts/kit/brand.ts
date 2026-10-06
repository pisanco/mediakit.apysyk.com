// Brand facts shared by the asset templates and the page. The values come from
// the apysyk.com design tokens and the approved copy; keep them in one
// place so a banner and the page can never disagree.

export const SITE_URL = "https://mediakit.apysyk.com/";
export const CONTACT = "sales@apysyk.com";
export const FOOTER = "© 2026 Apysyk. All rights reserved.";

export const COLORS = {
  black: "#000000",
  ink: "#f4f5f1",
  green: "#58a02d",
  green2: "#6dbb3a",
  glow: "#8ee05a",
  surface: "#08110a",
  onGreen: "#041003",
} as const;

/** The swatches the page documents, in display order. */
export const PALETTE: { name: string; hex: string; role: string }[] = [
  { name: "Apysyk Green", hex: COLORS.green, role: "Primary brand color: buttons, marks, highlights." },
  { name: "Green 2", hex: COLORS.green2, role: "The green part of two-tone headlines." },
  { name: "Green Glow", hex: COLORS.glow, role: "Light: glows, active dots, focus rings." },
  { name: "Black", hex: COLORS.black, role: "The background of every brand surface." },
  { name: "Surface", hex: COLORS.surface, role: "Cards and panels on black." },
  { name: "Ink", hex: COLORS.ink, role: "Text and lines on dark backgrounds." },
  { name: "Deep Green", hex: COLORS.onGreen, role: "Text on the green sheet and on green buttons." },
];

/** The approved sentences. Nothing else may describe Apysyk. */
export const COPY = {
  oneLiner:
    "Apysyk is the operating layer where security teams see risk, decide priority, execute fixes, and prove the work is done.",
  short:
    "Apysyk is not another scanner. It is where security teams collect findings, choose priorities, assign owners, execute fixes, and prove the work is done.",
  product: "Apysyk OS turns findings into owned, fixed, and verified security work.",
  problem:
    "Software now moves faster than security can operate. Findings are everywhere, ownership is unclear, and the work gets lost between scanners, tickets, pipelines, and people.",
  headline: ["The OS for modern", "cybersecurity work."] as const,
  category: "The Cybersecurity Operating Layer",
} as const;

/** The long boilerplate: the short text, the problem, then the product line. */
export const LONG_BOILERPLATE = `${COPY.short} ${COPY.problem} ${COPY.product}`;

export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
