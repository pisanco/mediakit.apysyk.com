// Renders documents to exact-size images with Playwright Chromium, and makes
// WebP thumbnails by downscaling finished renders in the browser.
//
// Every request goes to a virtual origin served from disk by a route handler,
// so fonts and logos load the same way on macOS and on ubuntu-latest without
// file:// access rules or a local server.

import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { join, resolve } from "node:path";
import { documentFor, preparePage, type Doc } from "./template.ts";

const ORIGIN = "http://kit.render";
const ROOT = resolve(import.meta.dir, "../..");

const MOUNTS: Record<string, string> = {
  fonts: join(ROOT, "brand/fonts"),
  logo: join(ROOT, "brand/logo"),
  dist: join(ROOT, "dist"),
};

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  svg: "image/svg+xml",
  woff2: "font/woff2",
  ttf: "font/ttf",
  png: "image/png",
  jpg: "image/jpeg",
};

export interface Output {
  format: "png" | "jpg";
  /** JPEG quality, 0-100. */
  quality?: number;
}

export class Renderer {
  // In-memory documents by id; "blank.html" gives thumbnails a same-origin page to fetch from.
  private readonly docs = new Map<string, string>([["blank.html", "<!doctype html><title>thumb</title>"]]);
  private readonly idle: Page[] = [];
  private readonly waiting: ((page: Page) => void)[] = [];
  private next = 0;

  private constructor(
    private readonly browser: Browser,
    private readonly context: BrowserContext,
  ) {}

  static async start(concurrency: number): Promise<Renderer> {
    const browser = await chromium.launch();
    const context = await browser.newContext({ deviceScaleFactor: 1, colorScheme: "dark" });
    const renderer = new Renderer(browser, context);
    await context.route(`${ORIGIN}/**`, async (route) => {
      const path = decodeURIComponent(new URL(route.request().url()).pathname);
      const [, mount, ...rest] = path.split("/");
      const ext = path.slice(path.lastIndexOf(".") + 1);
      if (mount === "doc") {
        const html = renderer.docs.get(rest.join("/"));
        return html === undefined
          ? route.fulfill({ status: 404 })
          : route.fulfill({ status: 200, contentType: TYPES.html, body: html });
      }
      const dir = MOUNTS[mount];
      const file = dir && Bun.file(join(dir, ...rest));
      if (!file || !(await file.exists())) return route.fulfill({ status: 404 });
      return route.fulfill({
        status: 200,
        contentType: TYPES[ext] ?? "application/octet-stream",
        body: Buffer.from(await file.arrayBuffer()),
      });
    });
    for (let i = 0; i < concurrency; i++) renderer.idle.push(await context.newPage());
    return renderer;
  }

  private async withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
    const page = this.idle.pop() ?? (await new Promise<Page>((r) => this.waiting.push(r)));
    try {
      return await fn(page);
    } finally {
      const waiter = this.waiting.shift();
      if (waiter) waiter(page);
      else this.idle.push(page);
    }
  }

  /** Renders a document; throws if any text overflows, leaves the canvas or is under 11 px. */
  async render(name: string, doc: Doc, out: Output): Promise<Buffer> {
    const { html } = documentFor(doc);
    const id = `${this.next++}.html`;
    this.docs.set(id, html);
    try {
      return await this.withPage(async (page) => {
        await page.setViewportSize({ width: doc.width, height: doc.height });
        await page.goto(`${ORIGIN}/doc/${id}`, { waitUntil: "load" });
        const errors = await page.evaluate(preparePage);
        if (errors.length) throw new Error(`${name}: ${errors.join("; ")}`);
        return page.screenshot({
          type: out.format === "jpg" ? "jpeg" : "png",
          quality: out.format === "jpg" ? (out.quality ?? 92) : undefined,
          omitBackground: doc.background === "transparent",
          animations: "disabled",
          caret: "hide",
          timeout: 120_000,
        });
      });
    } finally {
      this.docs.delete(id);
    }
  }

  /**
   * Downscales a file already written under dist/ to a WebP of the given size.
   * Halving steps before the last draw preserve fine edges.
   */
  async thumbnail(distPath: string, width: number, height: number, quality = 0.82): Promise<Buffer> {
    return this.withPage(async (page) => {
      await page.setViewportSize({ width: 64, height: 64 });
      await page.goto(`${ORIGIN}/doc/blank.html`);
      const b64 = await page.evaluate(
        async ({ url, width, height, quality }) => {
          const blob = await (await fetch(url)).blob();
          let image: ImageBitmap | OffscreenCanvas = await createImageBitmap(blob);
          while (image.width / 2 >= width * 1.5) {
            const half = new OffscreenCanvas(Math.round(image.width / 2), Math.round(image.height / 2));
            const c = half.getContext("2d")!;
            c.imageSmoothingQuality = "high";
            c.drawImage(image, 0, 0, half.width, half.height);
            image = half;
          }
          const canvas = new OffscreenCanvas(width, height);
          const ctx = canvas.getContext("2d")!;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(image, 0, 0, width, height);
          const webp = await canvas.convertToBlob({ type: "image/webp", quality });
          if (webp.type !== "image/webp") throw new Error(`no WebP encoder: ${webp.type}`);
          const bytes = new Uint8Array(await webp.arrayBuffer());
          let s = "";
          for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          return btoa(s);
        },
        { url: `${ORIGIN}/dist/${distPath}`, width, height, quality },
      );
      return Buffer.from(b64, "base64");
    });
  }

  async close(): Promise<void> {
    await this.context.close();
    await this.browser.close();
  }
}
