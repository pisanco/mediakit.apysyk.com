// The Apysyk mark, drawn from its proportions: four bands bridge the sides of
// a square window, each one running along a side and climbing at 45 degrees
// to the two nearest corners, with the square's diagonals left open. Every
// file in brand/logo/ and every layout that draws the mark reads this one
// geometry, so they can never disagree.
import { loopsToPath } from "./svg.ts";

export interface Point {
  x: number;
  y: number;
}

/** The green of the mark: the only colour of mark.svg and of the mark inside the colour lockups. */
export const MARK_COLOR = "#4da61d";

/** The mark's square, in its own units: the viewBox of mark.svg. */
export const MARK_SIZE = 96;
/** From the square's edge to the outer edge of a band. */
const INSET = 15;
/** Thickness of a band, measured across it. */
const BAND = 11.25;
/** Width of the open diagonal between two neighbouring bands, measured across it. */
const CHANNEL = 13;
/** Side of the window between the bands: the brand's clear-space unit. */
export const WINDOW = MARK_SIZE - 2 * (INSET + BAND);

/** The four bands as closed polygons, in mark units: top, right, bottom, left. */
export function markLoops(): Point[][] {
  const w = MARK_SIZE;
  // Where a channel edge, then the band's far edge, meet the square's edge, measured from its corner.
  const near = CHANNEL / Math.SQRT2;
  const far = near + BAND * Math.SQRT2;
  const inner = INSET + BAND;
  const top: Point[] = [
    { x: near, y: 0 },
    { x: far, y: 0 },
    { x: far + INSET, y: INSET },
    { x: w - far - INSET, y: INSET },
    { x: w - far, y: 0 },
    { x: w - near, y: 0 },
    { x: w - near - inner, y: inner },
    { x: near + inner, y: inner },
  ];
  // Quarter turns about the centre: (x, y) -> (w - y, x).
  return [0, 1, 2, 3].map((quarters) =>
    top.map((p) => {
      let q = p;
      for (let i = 0; i < quarters; i++) q = { x: w - q.y, y: q.x };
      return q;
    }),
  );
}

/** Path data of the mark, with its top-left corner at (dx, dy). */
export function markPath(dx = 0, dy = 0): string {
  return loopsToPath(markLoops(), dx, dy);
}
