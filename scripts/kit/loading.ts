// Seven animated versions of the mark for loading states. Each one is a
// self-contained SVG (SMIL, no script): it works inline, in an <img> and as a
// background. The geometry is the mark's own (scripts/logo/mark.ts) and the
// paint stays tied to the brand gradient and its white/black variants.
import { MARK_SIZE, markLoops, markPath, type Point } from "../logo/mark.ts";
import { loopsToPath, num } from "../logo/svg.ts";
import { COLORS, MARK_GRADIENT } from "./brand.ts";

export interface LoadingVersion {
  /** File name without extension; monochrome files add "-dark" or "-black". */
  slug: string;
  name: string;
  /** What moves, and what the version suits. */
  description: string;
  /** The mark in its gradient, for light surfaces. */
  light: string;
  /** The mark in white, for dark surfaces. */
  dark: string;
  /** The mark in black, for light surfaces. */
  black: string;
}

const S = MARK_SIZE;
const C = S / 2;
const EASE = "0.65 0 0.35 1";

const loops = markLoops();
/** The four bands, clockwise from the top, and the whole mark. */
const bands = loops.map((loop) => loopsToPath([loop]));
const whole = loopsToPath(loops);
/** Where each band moves when it closes on the window: down, left, up, right. */
const INWARD: [number, number][] = [
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 0],
];

// Band centrelines for the traced version, from the top band's polygon, turned like the bands:
// from the middle of the arm's cut, down the arm at 45 degrees, along the band, up the other arm.
const top = loops[0];
const start: Point = { x: (top[0].x + top[1].x) / 2, y: 0 };
const middle = (top[2].y + top[7].y) / 2;
const centreline: Point[] = [start, { x: start.x + middle, y: middle }, { x: S - start.x - middle, y: middle }, { x: S - start.x, y: 0 }];
const centrelines = [0, 1, 2, 3].map((quarters) =>
  centreline.map((p) => {
    let q = p;
    for (let i = 0; i < quarters; i++) q = { x: S - q.y, y: q.x };
    return q;
  }),
);
const bandWidth = top[7].y - top[2].y;

/** The brand gradient in mark units, so bands animated on their own still share one gradient. */
function gradient(id: string): string {
  const stops = MARK_GRADIENT.map((color, i) => `<stop offset="${num(i / (MARK_GRADIENT.length - 1))}" stop-color="${color}"/>`).join("");
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${S}" x2="${S}" y2="0">${stops}</linearGradient>`;
}

/** Replace the mark paint without recoloring the white masks or clip geometry. */
function inMonochrome(svg: string, id: string, color: string): string {
  return svg.replace(gradient(id), "").replaceAll(`url(#${id})`, color);
}

function document(defs: string, body: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="Loading">`,
    "<title>Loading</title>",
    `<defs>${defs}</defs>`,
    body,
    "</svg>",
    "",
  ].join("\n");
}

function sequence(): string {
  const id = "loading-sequence";
  const paths = bands.map(
    (d, i) =>
      `<path d="${d}" opacity="0.25"><animate attributeName="opacity" values="1;0.25;0.25;1" keyTimes="0;0.4;0.85;1" dur="1.2s" begin="${num(-i * 0.3)}s" repeatCount="indefinite"/></path>`,
  );
  return document(gradient(id), `<g fill="url(#${id})">${paths.join("")}</g>`);
}

function turn(): string {
  const id = "loading-turn";
  // The clip turns and the gradient stays, so the light never moves with the mark. The mark sits at 70%
  // (its diagonal over its side), so no corner leaves the canvas mid-turn.
  const rotate = `<animateTransform attributeName="transform" type="rotate" values="0;0;90" keyTimes="0;0.3;1" calcMode="spline" keySplines="0 0 1 1;${EASE}" dur="1s" repeatCount="indefinite" additive="sum"/>`;
  return document(
    `${gradient(id)}<clipPath id="${id}-clip"><path d="${markPath(-C, -C)}" transform="translate(${num(C)} ${num(C)}) scale(0.7)">${rotate}</path></clipPath>`,
    `<rect width="${S}" height="${S}" fill="url(#${id})" clip-path="url(#${id}-clip)"/>`,
  );
}

function focus(): string {
  const id = "loading-focus";
  const paths = bands.map((d, i) => {
    const [x, y] = INWARD[i];
    return `<path d="${d}"><animateTransform attributeName="transform" type="translate" values="0 0;${x * 10} ${y * 10};0 0" keyTimes="0;0.5;1" calcMode="spline" keySplines="${EASE};${EASE}" dur="1.6s" repeatCount="indefinite"/></path>`;
  });
  return document(gradient(id), `<g fill="url(#${id})">${paths.join("")}</g>`);
}

function assemble(): string {
  const id = "loading-assemble";
  const paths = bands.map((d, i) => {
    const [x, y] = INWARD[i];
    const begin = `${num(i * 0.12)}s`;
    return (
      `<path d="${d}" opacity="0">` +
      `<animateTransform attributeName="transform" type="translate" values="${-x * 28} ${-y * 28};0 0;0 0;0 0" keyTimes="0;0.22;0.75;1" calcMode="spline" keySplines="0.2 0.8 0.2 1;0 0 1 1;0 0 1 1" dur="2.4s" begin="${begin}" repeatCount="indefinite"/>` +
      `<animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.18;0.7;0.82;1" dur="2.4s" begin="${begin}" repeatCount="indefinite"/>` +
      "</path>"
    );
  });
  return document(gradient(id), `<g fill="url(#${id})">${paths.join("")}</g>`);
}

function trace(): string {
  const id = "loading-trace";
  // A stroke along each band's centreline, clipped to the mark so its ends and corners are the mark's own.
  // Each band is drawn clockwise from its start to its end, holds, then leaves the same way: its start
  // erases first and the erasing travels to the end, the path it came in by. A short empty beat, then again.
  // The dash is the whole band and so is the gap: offset 100 hides it, 0 shows it, -100 has it gone past the end.
  const paths = centrelines.map(
    (line) =>
      `<path pathLength="100" stroke-dasharray="100 100" stroke-dashoffset="100" d="M${line.map((p) => `${num(p.x)} ${num(p.y)}`).join("L")}">` +
      `<animate attributeName="stroke-dashoffset" values="100;0;0;-100;-100" keyTimes="0;0.38;0.58;0.96;1" calcMode="spline" keySplines="${EASE};0 0 1 1;${EASE};0 0 1 1" dur="2.2s" repeatCount="indefinite"/>` +
      "</path>",
  );
  return document(
    `${gradient(id)}<clipPath id="${id}-clip"><path d="${whole}"/></clipPath>`,
    `<g clip-path="url(#${id}-clip)" fill="none" stroke="url(#${id})" stroke-width="${num(bandWidth + 1)}" stroke-linejoin="miter">${paths.join("")}</g>`,
  );
}

function pulse(): string {
  const id = "loading-pulse";
  // A heartbeat: two quick beats, then rest. The mark swells with each beat and a soft round glow behind it
  // swells with it. The mark sits at 84% so the beats have room.
  const rest = 0.84;
  const beat = (from: number, peak: number) => `${from};${peak};${from};${num(peak * 0.985)};${from};${from}`;
  const timing = `keyTimes="0;0.08;0.2;0.28;0.42;1" calcMode="spline" keySplines="0.2 0 0.2 1;0.4 0 0.6 1;0.2 0 0.2 1;0.4 0 0.6 1;0 0 1 1"`;
  const glow =
    `<circle r="${num(C * 0.92)}" fill="url(#${id}-glow)" opacity="0.6">` +
    `<animateTransform attributeName="transform" type="translate" values="${num(C)} ${num(C)}" dur="1.6s" repeatCount="indefinite"/>` +
    `<animateTransform attributeName="transform" type="scale" values="${beat(0.9, 1.08)}" ${timing} dur="1.6s" repeatCount="indefinite" additive="sum"/>` +
    `<animate attributeName="opacity" values="${beat(0.3, 0.7)}" ${timing} dur="1.6s" repeatCount="indefinite"/>` +
    "</circle>";
  const mark =
    `<path d="${markPath(-C, -C)}" fill="url(#${id})">` +
    `<animateTransform attributeName="transform" type="translate" values="${num(C)} ${num(C)}" dur="1.6s" repeatCount="indefinite"/>` +
    `<animateTransform attributeName="transform" type="scale" values="${beat(rest, rest * 1.1)}" ${timing} dur="1.6s" repeatCount="indefinite" additive="sum"/>` +
    "</path>";
  const glowDef = `<radialGradient id="${id}-glow"><stop offset="0" stop-color="${COLORS.mark}" stop-opacity="0.45"/><stop offset="1" stop-color="${COLORS.mark}" stop-opacity="0"/></radialGradient>`;
  return document(`${gradient(id)}${glowDef}`, `${glow}${mark}`);
}

function lock(): string {
  const id = "loading-lock";
  // Focus and Turn at once: the bands close on the window while the mark makes a quarter turn, hold,
  // then open while it makes the next quarter turn; a half turn lands on the same mark, so the loop is
  // seamless. The paths animate inside a mask, so the gradient stays still on the screen. The mark sits
  // at 74%, so even the closed mark keeps every corner inside the canvas as it turns.
  const closing = (i: number) => {
    const [x, y] = INWARD[i];
    return `<animateTransform attributeName="transform" type="translate" values="0 0;${x * 10} ${y * 10};${x * 10} ${y * 10};0 0" keyTimes="0;0.45;0.55;1" calcMode="spline" keySplines="${EASE};0 0 1 1;${EASE}" dur="2.4s" repeatCount="indefinite"/>`;
  };
  const turning = `<animateTransform attributeName="transform" type="rotate" values="0;90;90;180" keyTimes="0;0.45;0.55;1" calcMode="spline" keySplines="${EASE};0 0 1 1;${EASE}" dur="2.4s" repeatCount="indefinite" additive="sum"/>`;
  return document(
    `${gradient(id)}<mask id="${id}-mask"><g transform="translate(${num(C)} ${num(C)}) scale(0.74)">${turning}<g transform="translate(${num(-C)} ${num(-C)})">${bands.map((d, i) => `<path d="${d}" fill="#ffffff">${closing(i)}</path>`).join("")}</g></g></mask>`,
    `<rect width="${S}" height="${S}" fill="url(#${id})" mask="url(#${id}-mask)"/>`,
  );
}

const VERSIONS: { key: string; name: string; description: string; build: () => string }[] = [
  { key: "sequence", name: "Sequence", description: "One band lights up after another, clockwise, with a tail. The classic spinner, built from the mark's own parts.", build: sequence },
  { key: "turn", name: "Turn", description: "A quarter turn, a pause, again. The mark's 90° symmetry closes the loop, and the gradient stays still.", build: turn },
  { key: "focus", name: "Focus", description: "The four bands close on the window and open again, like a lens finding focus. Slow, and no spin.", build: focus },
  { key: "assemble", name: "Assemble", description: "The bands fly in one by one, form the mark, hold and leave. For longer waits, such as a screen opening.", build: assemble },
  { key: "lock", name: "Lock", description: "Focus and Turn at once: the bands close on the window as the mark turns, hold, then open as it turns again. Like a lock.", build: lock },
  { key: "trace", name: "Trace", description: "The bands are drawn clockwise, end to end, hold, then leave the way they came: the stroke erases along the same path.", build: trace },
  { key: "pulse", name: "Pulse", description: "A heartbeat: two quick beats and a rest. The mark swells with each beat, and a soft glow behind it swells too.", build: pulse },
];

export const LOADING_VERSIONS: LoadingVersion[] = VERSIONS.map(({ key, name, description, build }) => {
  const light = build();
  const id = `loading-${key}`;
  // Pulse's translucent glow is paint too; masks must retain their white fills.
  const black = inMonochrome(light, id, "#000000").replaceAll(`stop-color="${COLORS.mark}"`, 'stop-color="#000000"');
  return { slug: `apysyk-loading-${key}`, name, description, light, dark: inMonochrome(light, id, COLORS.white), black };
});
