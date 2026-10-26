import { expect, test, type Page } from "@playwright/test";

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

test("black downloads preserve rendered motion, masks and transparency with native black ink", async ({ page, request }) => {
  await page.goto("/");
  await page.locator("#loading").scrollIntoViewIfNeeded();
  await expect(page.locator("#loading").getByRole("link", { name: /SVG, black/ }).first()).toBeVisible();
  const variants = await page.locator(".loading-card").evaluateAll((cards) => cards.map((card) => {
    const links = [...card.querySelectorAll<HTMLAnchorElement>("a[download]")];
    return {
      name: card.querySelector("h3")!.textContent!,
      black: links.find((link) => link.querySelector(".dl__label")!.textContent!.startsWith("SVG, black"))!.href,
      color: links.find((link) => link.querySelector(".dl__label")!.textContent!.startsWith("SVG, color"))!.href,
    };
  }));
  await page.setViewportSize({ width: 128, height: 128 });
  for (const variant of variants) {
    const colorResponse = await request.get(variant.color);
    const blackResponse = await request.get(variant.black);
    expect(colorResponse.status(), variant.name).toBe(200);
    expect(blackResponse.status(), variant.name).toBe(200);
    const colorSource = await colorResponse.text();
    const blackSource = await blackResponse.text();
    for (const time of [0.35, 0.95, 1.65]) {
      const original = await raster(page, colorSource, time);
      const black = await raster(page, blackSource, time);
      expect(black.nonBlackPixels, `${variant.name} native ink, including its glow at ${time}s`).toBe(0);
      let maximumAlphaError = 0;
      for (let i = 0; i < black.alpha.length; i++) maximumAlphaError = Math.max(maximumAlphaError, Math.abs(black.alpha[i] - original.alpha[i]));
      // Native solid/gradient antialiasing can round one 8-bit alpha unit apart.
      expect(maximumAlphaError, `${variant.name} rendered shape/opacity at ${time}s`).toBeLessThanOrEqual(1);
    }
  }
});
