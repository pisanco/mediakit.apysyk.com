// Outlines the wordmark "apysyk" from Hubot Sans with fontkit, as the site
// header sets it: weight 700, width 100, kerning on, letter-spacing -0.03em.
// The font is the unmodified upstream variable TTF; fontkit instances it with
// getVariation(), which applies gvar to the outlines and HVAR to the advances.
import * as fontkit from "fontkit";

/** The parts of fontkit's font object this module relies on (fontkit ships no types). */
interface Font {
  unitsPerEm: number;
  getVariation(axes: Record<string, number>): Font;
  layout(text: string): {
    glyphs: { path: { commands: { command: string; args: number[] }[] } }[];
    positions: { xAdvance: number; xOffset: number; yOffset: number }[];
  };
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Path commands in em units with screen y pointing down, baseline at y = 0. */
export type Command = { type: "M" | "L"; x: number; y: number } | { type: "Q"; cx: number; cy: number; x: number; y: number } | { type: "Z" };

export interface Outline {
  commands: Command[];
  /** Exact ink bounds (curve extrema included), in em units. */
  bbox: Box;
}

export interface WordmarkSettings {
  text: string;
  axes: Record<string, number>;
  /** Extra space between glyphs, in em (CSS letter-spacing). */
  letterSpacing: number;
}

export const WORDMARK: WordmarkSettings = { text: "apysyk", axes: { wght: 700, wdth: 100 }, letterSpacing: -0.03 };

/** A fontkit glyph path (font units, y up) to commands placed by `place`. */
function pathCommands(path: { command: string; args: number[] }[], place: (x: number, y: number) => { x: number; y: number }): Command[] {
  return path.map(({ command, args }): Command => {
    if (command === "closePath") return { type: "Z" };
    if (command === "quadraticCurveTo") {
      const c = place(args[0], args[1]);
      const e = place(args[2], args[3]);
      return { type: "Q", cx: c.x, cy: c.y, x: e.x, y: e.y };
    }
    if (command === "moveTo" || command === "lineTo") {
      const p = place(args[0], args[1]);
      return { type: command === "moveTo" ? "M" : "L", x: p.x, y: p.y };
    }
    // TrueType outlines are quadratic; a cubic would mean a different font format.
    throw new Error(`unexpected path command ${command}`);
  });
}

/** Bounds of the drawn outline, including quadratic extrema between points. */
export function outlineBox(commands: Command[]): Box {
  const box: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const add = (x: number, y: number): void => {
    box.minX = Math.min(box.minX, x);
    box.minY = Math.min(box.minY, y);
    box.maxX = Math.max(box.maxX, x);
    box.maxY = Math.max(box.maxY, y);
  };
  let px = 0;
  let py = 0;
  for (const c of commands) {
    if (c.type === "Z") continue;
    if (c.type === "Q") {
      for (const [p0, p1, p2, axis] of [
        [px, c.cx, c.x, 0],
        [py, c.cy, c.y, 1],
      ]) {
        const denom = p0 - 2 * p1 + p2;
        const t = denom === 0 ? -1 : (p0 - p1) / denom;
        if (t > 0 && t < 1) {
          const v = (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
          if (axis === 0) add(v, py);
          else add(px, v);
        }
      }
    }
    add(c.x, c.y);
    px = c.x;
    py = c.y;
  }
  return box;
}

export async function outlineWordmark(fontPath: string, settings: WordmarkSettings = WORDMARK): Promise<Outline> {
  const bytes = Buffer.from(await Bun.file(fontPath).arrayBuffer());
  const font = (fontkit.create(bytes) as Font).getVariation(settings.axes);
  const em = font.unitsPerEm;
  const run = font.layout(settings.text);
  const commands: Command[] = [];
  let pen = 0;
  run.glyphs.forEach((glyph, i) => {
    const pos = run.positions[i];
    commands.push(
      ...pathCommands(glyph.path.commands, (x, y) => ({ x: (pen + pos.xOffset + x) / em, y: -(pos.yOffset + y) / em })),
    );
    pen += pos.xAdvance + (i < run.glyphs.length - 1 ? settings.letterSpacing * em : 0);
  });
  return { commands, bbox: outlineBox(commands) };
}

/** Path data for an outline, scaled by `size` (the font size) and moved by (dx, dy). */
export function outlineToPath(commands: Command[], size: number, dx: number, dy: number, num: (v: number) => string): string {
  const x = (v: number): string => num(dx + v * size);
  const y = (v: number): string => num(dy + v * size);
  return commands
    .map((c) => {
      if (c.type === "Z") return "Z";
      if (c.type === "Q") return `Q${x(c.cx)} ${y(c.cy)} ${x(c.x)} ${y(c.y)}`;
      return `${c.type}${x(c.x)} ${y(c.y)}`;
    })
    .join("");
}
