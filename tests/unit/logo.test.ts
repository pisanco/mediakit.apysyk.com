import { afterAll, beforeAll, expect, test } from "bun:test";
import { type Browser, chromium } from "@playwright/test";
import { LOGO_FILES } from "../../scripts/kit/catalog.ts";
import { compareWithSource, type Expected, type Fidelity, renderSvg } from "../../scripts/logo/fidelity.ts";
import { LOGO_DIR, SOURCE_PNG } from "../../scripts/logo/generate.ts";
import { decodePng } from "../../scripts/logo/png.ts";
import { rgbOf, samplePalette, traceMark } from "../../scripts/logo/trace.ts";

const source = decodePng(new Uint8Array(await Bun.file(SOURCE_PNG).arrayBuffer()));
const palette = samplePalette(source);
// The tracer is deterministic, so its frame says where mark.svg sits on the PNG.
const { frame, white } = traceMark(source);

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

function report(name: string, r: Fidelity): string {
  return `${name}: ${(r.ratio * 100).toFixed(2)}% of ${r.compared} opaque pixels match (${r.edge} anti-aliased edge pixels excluded); worst ${r.worst.size}px tile at ${r.worst.x},${r.worst.y} with ${r.worst.mismatched}/${r.worst.compared} mismatched`;
}

test(
  "mark.svg matches the source PNG on at least 99% of its opaque pixels",
  async () => {
    const svg = await Bun.file(`${LOGO_DIR}/mark.svg`).text();
    const result = compareWithSource(source, await renderSvg(browser, svg, source.width, frame), palette);
    console.log(report("mark.svg", result));
    expect(result.ratio).toBeGreaterThanOrEqual(0.99);
  },
  60_000,
);

for (const [file, color] of [
  ["mark-white.svg", "#ffffff"],
  ["mark-black.svg", "#000000"],
] as const) {
  test(
    `${file} is the mark in ${color} with the near-white faces knocked out`,
    async () => {
      const [r, g, b] = rgbOf(color);
      const whiteClass = palette.indexOf(white) + 1;
      const expected: Expected = (_, __, cls) => (cls === whiteClass ? [0, 0, 0, 0] : [r, g, b, 255]);
      const svg = await Bun.file(`${LOGO_DIR}/${file}`).text();
      const result = compareWithSource(source, await renderSvg(browser, svg, source.width, frame), palette, expected);
      console.log(report(file, result));
      expect(result.ratio).toBeGreaterThanOrEqual(0.99);
    },
    60_000,
  );
}

test(
  "every logo SVG parses, is self-contained, has a title and renders",
  async () => {
    const page = await browser.newPage();
    try {
      for (const { file } of LOGO_FILES) {
        const markup = await Bun.file(`${LOGO_DIR}/${file}`).text();
        const problems = await page.evaluate(async (svg) => {
          const found: string[] = [];
          const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
          if (doc.querySelector("parsererror")) return ["does not parse"];
          const root = doc.documentElement;
          if (root.namespaceURI !== "http://www.w3.org/2000/svg" || root.localName !== "svg") found.push("root is not <svg>");
          const title = root.firstElementChild;
          if (title?.localName !== "title" || !title.textContent?.trim()) found.push("first child is not a non-empty <title>");
          const viewBox = (root.getAttribute("viewBox") ?? "").split(/\s+/).map(Number);
          if (viewBox.length !== 4 || !(viewBox[2] > 0 && viewBox[3] > 0)) found.push("no usable viewBox");
          // Anything that loads, runs or depends on something outside the file.
          const banned = ["script", "foreignObject", "image", "use", "style", "text", "a", "iframe", "link", "font", "font-face"];
          for (const el of Array.from(doc.getElementsByTagName("*"))) {
            if (banned.includes(el.localName)) found.push(`<${el.localName}>`);
            for (const attr of Array.from(el.attributes)) {
              if (attr.localName === "href" || attr.name.startsWith("on") || /url\(/i.test(attr.value)) {
                found.push(`${el.localName}[${attr.name}]`);
              }
            }
          }
          const img = new Image();
          img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
          await img.decode().catch(() => found.push("does not decode as an image"));
          if (!(img.naturalWidth > 0)) found.push("renders with no size");
          return found;
        }, markup);
        expect({ file, problems }).toEqual({ file, problems: [] });
      }
    } finally {
      await page.close();
    }
  },
  60_000,
);
