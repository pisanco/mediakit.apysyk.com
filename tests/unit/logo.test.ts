import { afterAll, beforeAll, expect, test } from "bun:test";
import { type Browser, chromium } from "@playwright/test";
import { LOGO_FILES } from "../../scripts/kit/catalog.ts";
import { LOADING_VERSIONS } from "../../scripts/kit/loading.ts";
import { LOGO_DIR } from "../../scripts/logo/generate.ts";

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

test(
  "every logo and loading SVG parses, is self-contained, has a title and renders",
  async () => {
    const page = await browser.newPage();
    try {
      const files = [
        ...(await Promise.all(LOGO_FILES.map(async ({ file }) => ({ file, markup: await Bun.file(`${LOGO_DIR}/${file}`).text() })))),
        ...LOADING_VERSIONS.flatMap((v) => [
          { file: `${v.slug}.svg`, markup: v.light },
          { file: `${v.slug}-dark.svg`, markup: v.dark },
        ]),
      ];
      for (const { file, markup } of files) {
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
          // Anything that loads, runs or depends on something outside the file. url(#id) stays inside it.
          const banned = ["script", "foreignObject", "image", "use", "style", "text", "a", "iframe", "link", "font", "font-face"];
          for (const el of Array.from(doc.getElementsByTagName("*"))) {
            if (banned.includes(el.localName)) found.push(`<${el.localName}>`);
            for (const attr of Array.from(el.attributes)) {
              if (attr.localName === "href" || attr.name.startsWith("on") || /url\((?!#)/i.test(attr.value)) {
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

test("horizontal lockup aligns capital letters with the symbol without clipping the descender", async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(await Bun.file(`${LOGO_DIR}/lockup-black.svg`).text());
    const geometry = await page.$eval("svg", (root) => {
      if (!(root instanceof SVGSVGElement)) throw new Error("Expected an SVG root");
      const [mark, wordmark] = Array.from(root.querySelectorAll("path"), (path) => path.getBBox());
      const frame = root.viewBox.baseVal;
      return {
        heightRatio: wordmark.height / mark.height,
        gapRatio: (wordmark.x - mark.x - mark.width) / mark.height,
        capCenterOffset: (wordmark.y + wordmark.height * 7 / 18 - mark.y - mark.height / 2) / mark.height,
        inside: [mark, wordmark].every((box) => box.x >= frame.x && box.y >= frame.y && box.x + box.width <= frame.x + frame.width + 0.01 && box.y + box.height <= frame.y + frame.height + 0.01),
      };
    });
    expect(geometry.heightRatio).toBeCloseTo(51 / 54, 3);
    expect(geometry.gapRatio).toBeCloseTo(27 / 54, 3);
    expect(geometry.capCenterOffset).toBeCloseTo(0, 3);
    expect(geometry.inside).toBe(true);
  } finally {
    await page.close();
  }
});
