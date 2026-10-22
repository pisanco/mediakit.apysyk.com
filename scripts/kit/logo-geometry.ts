// Logo proportions read from the logo sources, so the clear-space diagram and
// the layouts follow the SVGs if they are ever regenerated.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { MARK_SIZE, WINDOW } from "../logo/mark.ts";

const LOGO_DIR = resolve(import.meta.dir, "../../brand/logo");

function svg(file: string): string {
  return readFileSync(join(LOGO_DIR, file), "utf8");
}

export function viewBox(file: string): { w: number; h: number } {
  const m = svg(file).match(/viewBox="([^"]+)"/);
  if (!m) throw new Error(`${file}: no viewBox`);
  const [, , w, h] = m[1].trim().split(/[\s,]+/).map(Number);
  return { w, h };
}

const lockup = viewBox("lockup-on-dark.svg");
const stacked = viewBox("lockup-stacked-on-dark.svg");

/** Width over height of every lockup (they share one geometry), and of every stacked lockup. */
export const LOCKUP_ASPECT = lockup.w / lockup.h;
export const STACKED_ASPECT = stacked.w / stacked.h;

// The clear-space unit is the side of the mark's window, in mark units. In the lockup, the mark is
// the first path (the wordmark is the second), and its y extent is the mark's height there.
const paths = [...svg("lockup-on-dark.svg").matchAll(/<path[^>]* d="([^"]+)"/g)].map((m) => m[1]);
if (paths.length !== 2) throw new Error("lockup-on-dark.svg: expected the mark path and the wordmark path");
const ys = [...paths[0].matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((p) => Number(p[2]));
const markInLockup = Math.max(...ys) - Math.min(...ys);

export const LOCKUP_GEOMETRY = {
  width: lockup.w,
  height: lockup.h,
  /** The clear-space unit, in lockup viewBox units. */
  clearSpace: (WINDOW * markInLockup) / MARK_SIZE,
};
