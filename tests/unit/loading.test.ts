import { afterAll, beforeAll, expect, test } from "bun:test";
import { type Browser, chromium, type Page } from "@playwright/test";
import { LOADING_VERSIONS } from "../../scripts/kit/loading.ts";

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

async function raster(page: Page, svg: string, time: number): Promise<{ alpha: number[]; nonBlackPixels: number }> {
  await page.setContent(svg);
  await page.$eval("svg", (root, time) => {
    const image = root as SVGSVGElement;
    image.pauseAnimations();
    image.setCurrentTime(time);
  }, time);
  const screenshot = await page.screenshot({ omitBackground: true });
  return page.evaluate(async (encoded) => {
    const image = new Image();
    image.src = `data:image/png;base64,${encoded}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const alpha: number[] = [];
    let nonBlackPixels = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      alpha.push(pixels[i + 3]);
      if (pixels[i + 3] > 0 && (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0)) nonBlackPixels++;
    }
    return { alpha, nonBlackPixels };
  }, screenshot.toString("base64"));
}

test("black loaders preserve rendered motion, masks and transparency with native black ink", async () => {
  const page = await browser.newPage({ viewport: { width: 128, height: 128 } });
  try {
    // Each sample replaces the SVG document; one browser host serves this isolated test.
    for (const version of LOADING_VERSIONS) {
      for (const time of [0.35, 0.95, 1.65]) {
        const original = await raster(page, version.light, time);
        const black = await raster(page, version.black, time);
        expect(black.nonBlackPixels, `${version.name} native ink, including its glow at ${time}s`).toBe(0);
        let maximumAlphaError = 0;
        for (let i = 0; i < black.alpha.length; i++) maximumAlphaError = Math.max(maximumAlphaError, Math.abs(black.alpha[i] - original.alpha[i]));
        // Native solid/gradient antialiasing can round one 8-bit alpha unit apart.
        expect(maximumAlphaError, `${version.name} rendered shape/opacity at ${time}s`).toBeLessThanOrEqual(1);
      }
    }
  } finally {
    await page.close();
  }
}, 60_000);
