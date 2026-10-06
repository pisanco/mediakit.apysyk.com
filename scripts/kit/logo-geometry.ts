// Logo proportions read from the logo sources, so the clear-space diagram and
// the layouts follow the SVGs if they are ever regenerated.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { markGeometry } from "../logo/generate.ts";

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

/** Width over height of every lockup (they share one geometry). */
export const LOCKUP_ASPECT = lockup.w / lockup.h;

// The clear-space unit is the height of the cube's small inner square. The trace gives it in mark
// units; in the lockup, the mark is every path before the last one (the wordmark), and its y extent
// is the mark's height there.
const mark = await markGeometry();
const paths = [...svg("lockup-on-dark.svg").matchAll(/<path[^>]* d="([^"]+)"/g)].map((m) => m[1]);
if (paths.length < 2) throw new Error("lockup-on-dark.svg: expected the mark paths and the wordmark path");
const ys = paths.slice(0, -1).flatMap((d) => [...d.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((p) => Number(p[2])));
const markInLockup = Math.max(...ys) - Math.min(...ys);

export const LOCKUP_GEOMETRY = {
  width: lockup.w,
  height: lockup.h,
  /** The clear-space unit, in lockup viewBox units. */
  clearSpace: (mark.innerCubeHeight * markInLockup) / mark.height,
};
