// Side-by-side check of the traced mark: source PNG | mark.svg rendered by
// Chromium | where they differ. For a human look after regenerating the logo.
//   bun scripts/logo/compare.ts [out.png]
import { chromium } from "@playwright/test";
import { compareWithSource, renderSvg } from "./fidelity.ts";
import { LOGO_DIR, SOURCE_PNG } from "./generate.ts";
import { decodePng } from "./png.ts";
import { samplePalette, traceMark } from "./trace.ts";

const out = Bun.argv[2] ?? "/tmp/mediakit-shots/logo-compare.png";
const pngBytes = new Uint8Array(await Bun.file(SOURCE_PNG).arrayBuffer());
const source = decodePng(pngBytes);
const size = source.width;
const { frame } = traceMark(source);
const browser = await chromium.launch();
try {
  const markSvg = await Bun.file(`${LOGO_DIR}/mark.svg`).text();
  const render = await renderSvg(browser, markSvg, size, frame);
  const result = compareWithSource(source, render, samplePalette(source));
  const pct = (result.ratio * 100).toFixed(2);
  console.log(
    `match ${pct}% (${result.matched}/${result.compared} opaque pixels, ${result.edge} edge pixels excluded); worst ${result.worst.size}px tile at ${result.worst.x},${result.worst.y}: ${result.worst.mismatched}/${result.worst.compared} mismatched`,
  );

  const page = await browser.newPage({ viewport: { width: size * 3 + 80, height: size + 80 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><style>
    body { margin: 0; background: #202022; font: 600 20px system-ui, sans-serif; color: #f4f5f1; display: flex; gap: 20px; padding: 20px; }
    figure { margin: 0; }
    figcaption { height: 32px; }
    canvas { display: block; background: repeating-conic-gradient(#d8d8d8 0 25%, #f2f2f2 0 50%) 0 0 / 32px 32px; }
  </style></head><body>
    <figure><figcaption>Source PNG, ${size} px</figcaption><canvas id="a" width="${size}" height="${size}"></canvas></figure>
    <figure><figcaption>mark.svg in Chromium, ${size} px</figcaption><canvas id="b" width="${size}" height="${size}"></canvas></figure>
    <figure><figcaption>Mismatch (red), excluded edges (grey): ${pct}% match</figcaption><canvas id="c" width="${size}" height="${size}"></canvas></figure>
  </body></html>`);
  await page.evaluate(
    ([a, b, mask, n]) => {
      const put = (id: string, bytes: Uint8ClampedArray<ArrayBuffer>): void => {
        const ctx = (document.getElementById(id) as HTMLCanvasElement).getContext("2d") as CanvasRenderingContext2D;
        ctx.putImageData(new ImageData(bytes, n, n), 0, 0);
      };
      const decode = (b64: string): Uint8ClampedArray<ArrayBuffer> => Uint8ClampedArray.from(atob(b64), (ch) => ch.charCodeAt(0));
      const src = decode(a);
      put("a", src);
      put("b", decode(b));
      const m = decode(mask);
      const diff = new Uint8ClampedArray(n * n * 4);
      for (let p = 0; p < n * n; p++) {
        const i = p * 4;
        if (m[p] === 1) diff.set([src[i], src[i + 1], src[i + 2], 70], i);
        else if (m[p] === 2) diff.set([230, 30, 30, 255], i);
        else if (m[p] === 3) diff.set([120, 120, 120, 255], i);
      }
      put("c", diff);
    },
    [
      Buffer.from(source.data).toString("base64"),
      Buffer.from(render.data).toString("base64"),
      Buffer.from(result.mask).toString("base64"),
      size,
    ] as const,
  );
  await page.screenshot({ path: out });
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
}
