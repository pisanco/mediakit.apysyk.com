import { expect, test, type Page } from "@playwright/test";
import { COLORS, hexToRgb } from "../../scripts/kit/brand.ts";

const INK = hexToRgb(COLORS.ink);

async function raster(page: Page, svg: string, time: number): Promise<{ alpha: number[]; solidPixels: number; offInkPixels: number }> {
  await page.setContent(svg);
  await page.$eval("svg", (root, time) => {
    const image = root as SVGSVGElement;
    image.pauseAnimations();
    image.setCurrentTime(time);
  }, time);
  const screenshot = await page.screenshot({ omitBackground: true });
  return page.evaluate(
    async ([encoded, ink]) => {
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
      let solidPixels = 0;
      let offInkPixels = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        alpha.push(pixels[i + 3]);
        // Faint edges and glows are premultiplied in 8 bits and dithered, so their channels drift by many units: check
        // the solid pixels, within 6 units for overlapping-edge rounding. Forest, the nearest other brand color, is 34
        // units away in green. The unit tests check every painted value of the file itself.
        if (pixels[i + 3] < 192) continue;
        solidPixels++;
        if (Math.abs(pixels[i] - ink[0]) > 6 || Math.abs(pixels[i + 1] - ink[1]) > 6 || Math.abs(pixels[i + 2] - ink[2]) > 6) offInkPixels++;
      }
      return { alpha, solidPixels, offInkPixels };
    },
    [screenshot.toString("base64"), INK] as const,
  );
}

test("Ink downloads keep the rendered motion, masks and transparency, in Ink only", async ({ page, request }) => {
  // 7 animations × 4 frames × 2 colors: 56 screenshots, each read back pixel by pixel.
  test.setTimeout(120_000);
  await page.goto("/");
  await page.locator("#loading").scrollIntoViewIfNeeded();
  await expect(page.locator("#loading").getByRole("link", { name: /SVG, Ink/ }).first()).toBeVisible();
  const variants = await page.locator(".loading-card").evaluateAll((cards) => cards.map((card) => {
    const links = [...card.querySelectorAll<HTMLAnchorElement>("a[download]")];
    return {
      name: card.querySelector("h3")!.textContent!,
      ink: links.find((link) => link.querySelector(".dl__label")!.textContent!.startsWith("SVG, Ink"))!.href,
      forest: links.find((link) => link.querySelector(".dl__label")!.textContent!.startsWith("SVG, Forest"))!.href,
    };
  }));
  await page.setViewportSize({ width: 128, height: 128 });
  for (const variant of variants) {
    const forestResponse = await request.get(variant.forest);
    const inkResponse = await request.get(variant.ink);
    expect(forestResponse.status(), variant.name).toBe(200);
    expect(inkResponse.status(), variant.name).toBe(200);
    const forestSource = await forestResponse.text();
    const inkSource = await inkResponse.text();
    let solidPixels = 0;
    // At 0 s Sequence's first band is fully lit; the later samples are mid-motion.
    for (const time of [0, 0.35, 0.95, 1.65]) {
      const forest = await raster(page, forestSource, time);
      const ink = await raster(page, inkSource, time);
      solidPixels += ink.solidPixels;
      expect(ink.offInkPixels, `${variant.name} solid pixels in Ink at ${time}s`).toBe(0);
      let maximumAlphaError = 0;
      for (let i = 0; i < ink.alpha.length; i++) maximumAlphaError = Math.max(maximumAlphaError, Math.abs(ink.alpha[i] - forest.alpha[i]));
      // Antialiasing can round one 8-bit alpha unit apart.
      expect(maximumAlphaError, `${variant.name} rendered shape/opacity at ${time}s`).toBeLessThanOrEqual(1);
    }
    expect(solidPixels, `${variant.name} shows the solid mark at some sampled time`).toBeGreaterThan(0);
  }
});
