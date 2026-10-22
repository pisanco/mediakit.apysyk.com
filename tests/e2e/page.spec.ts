// The published page, as a visitor gets it from dist/ (run `bun run build` first).

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { COPY, LONG_BOILERPLATE } from "../../scripts/kit/brand.ts";
import { imageSize } from "../../scripts/kit/image-size.ts";
import { formatBytes, type Manifest } from "../../scripts/kit/manifest.ts";

/** Opens the page and records anything a visitor's console would show, plus any request leaving the origin. */
async function open(page: Page): Promise<string[]> {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`console ${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  // The first request is the page itself: everything after it must come from the same host.
  let origin: string | undefined;
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.protocol === "data:") return;
    origin ??= url.host;
    if (url.host !== origin) problems.push(`third-party request: ${r.url()}`);
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => w.__csp.push(`${e.violatedDirective}: ${e.blockedURI}`));
  });
  await page.goto("/");
  return problems;
}

/** Scrolls to the end so every lazy preview loads, then waits for them. */
async function loadEverything(page: Page): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = page.viewportSize()!.height;
  for (let y = 0; y < height; y += step) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    await page.waitForTimeout(40);
  }
  // A preview the scroll passed while the main thread was busy never starts loading, and WebKit's
  // decode() then waits for it forever: ask for every image now, so the wait has an end.
  await page.evaluate(() => {
    for (const img of document.images) img.loading = "eager";
  });
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode().catch(() => undefined))));
}

test("renders with no console errors, CSP violations or third-party requests", async ({ page }) => {
  const problems = await open(page);
  await expect(page).toHaveTitle("Media kit · Risksquad");
  await loadEverything(page);
  const csp = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
  expect(csp).toEqual([]);
  expect(problems).toEqual([]);
  // Every preview loaded, at the size its width and height attributes promise.
  const images = await page.evaluate(() =>
    [...document.images]
      .filter((img) => !img.currentSrc.endsWith(".svg"))
      .map((img) => ({ src: img.currentSrc, natural: `${img.naturalWidth}x${img.naturalHeight}`, attrs: `${img.getAttribute("width")}x${img.getAttribute("height")}` })),
  );
  expect(images.length).toBeGreaterThan(0);
  for (const img of images) expect(img.natural, img.src).toBe(img.attrs);
});

test("every download answers 200 and every image is the size its label says", async ({ page, request }, info) => {
  test.skip(info.project.name !== "chromium-desktop", "the files are the same for every browser: checked once");
  await open(page);
  const links = await page.locator("a[download]").evaluateAll((els) =>
    els.map((a) => ({
      href: (a as HTMLAnchorElement).href,
      width: a.getAttribute("data-width"),
      height: a.getAttribute("data-height"),
      label: a.querySelector(".dl__label")?.textContent ?? a.textContent ?? "",
    })),
  );
  // Every file of the kit has a download link on the page.
  const manifest: Manifest = await (await request.get("/assets.json")).json();
  const linked = new Set(links.map((l) => new URL(l.href).pathname.slice(1)));
  const missing = manifest.files.filter((f) => ["logos", "loading", "banners", "wallpapers", "downloads"].includes(f.group) && !linked.has(f.path));
  expect(missing.map((f) => f.path)).toEqual([]);
  for (const link of links) {
    const response = await request.get(link.href);
    expect(response.status(), link.href).toBe(200);
    if (!link.width) continue;
    const real = imageSize(new Uint8Array(await response.body()));
    expect(`${real.width}x${real.height}`, link.href).toBe(`${link.width}x${link.height}`);
    // The visible label names the same size: "1500 × 500" for banners, "PNG 512" (the width) for logos.
    const both = link.label.match(/(\d+) × (\d+)/);
    const width = link.label.match(/PNG (\d+)/);
    if (both) expect(`${both[1]}x${both[2]}`, link.href).toBe(`${real.width}x${real.height}`);
    if (width) expect(Number(width[1]), link.href).toBe(real.width);
  }
  // The header button states the real size of the archive.
  const header = page.locator(".site-header a[download]");
  const zip = await request.get(await header.evaluate((a) => (a as HTMLAnchorElement).href));
  await expect(header).toContainText(`(.zip, ${formatBytes((await zip.body()).length)})`);
});

test("the share image's URL carries its own hash, so share caches refetch it when it changes", async ({ page, request }, info) => {
  test.skip(info.project.name !== "chromium-desktop", "the file is the same for every browser: checked once");
  await open(page);
  const tag = page.locator('meta[property="og:image"]');
  const canonical = (await page.locator('link[rel="canonical"]').getAttribute("href"))!;
  const url = new URL((await tag.getAttribute("content"))!);
  expect(`${url.origin}${url.pathname}`).toBe(new URL("og.png", canonical).href);
  const file = await request.get(`/og.png${url.search}`);
  expect(file.status()).toBe(200);
  const body = await file.body();
  expect(url.searchParams.get("v")).toBe(createHash("sha256").update(body).digest("hex").slice(0, 10));
  // The real size is the size the tags declare.
  const real = imageSize(new Uint8Array(body));
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", String(real.width));
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", String(real.height));
});

test("axe finds no serious or critical accessibility violations", async ({ page }) => {
  await open(page);
  await loadEverything(page);
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(serious).toEqual([]);
});

test("the theme toggle turns the page dark, remembers it, and the dark page passes axe too", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desktop", "the theme is the same page everywhere: checked once");
  await open(page);
  const toggle = page.getByRole("button", { name: "Dark mode" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0c1a12");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await loadEverything(page);
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(serious).toEqual([]);
  await page.getByRole("button", { name: "Dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("the generator composes a banner in the browser and downloads it at the format's size", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desktop", "canvas rasterization: checked once");
  await open(page);
  const generator = page.locator("[data-generator]");
  await generator.locator('select[name="format"]').selectOption("share-card");
  await generator.locator('select[name="surface"]').selectOption("lattice");
  await generator.locator('select[name="headline"]').selectOption("1");
  await generator.getByRole("button", { name: "Generate" }).click();
  const preview = generator.locator(".generator__preview");
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBe(1200);
  await expect(generator.locator("[data-caption]")).toContainText("Findings. Owned.");
  const download = page.waitForEvent("download");
  await generator.getByRole("button", { name: "Download" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^risksquad-share-card-lattice-1200x630\.png$/);
  const bytes = new Uint8Array(await readFile((await file.path())!));
  expect(imageSize(bytes)).toEqual({ width: 1200, height: 630 });
});

test("no horizontal scroll, down to 320 px wide", async ({ page }) => {
  await open(page);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);
  if (page.viewportSize()!.width < 600) {
    await page.setViewportSize({ width: 320, height: 740 });
    expect(await overflow()).toBeLessThanOrEqual(0);
  }
});

test("copy buttons put the right text on the clipboard", async ({ page, context, browserName }) => {
  // Chromium lets the test read the real clipboard. WebKit refuses readText() to scripts, so there the
  // test records what the page hands to the Clipboard API, after it succeeds.
  const readable = browserName === "chromium";
  if (readable) await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  else {
    await page.addInitScript(() => {
      const clip = navigator.clipboard;
      const write = clip.writeText.bind(clip);
      clip.writeText = async (text: string) => {
        await write(text);
        (window as unknown as { __copied: string }).__copied = text;
      };
    });
  }
  // The page scrolls smoothly; under load a click could land while Playwright's scroll-into-view is still moving.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  const cases: [selector: string, text: string, announced: string][] = [
    ["#about .copy-card:nth-of-type(1) .copy", COPY.oneLiner, "One-liner copied"],
    ["#about .copy-card:nth-of-type(2) .copy", COPY.short, "Short boilerplate copied"],
    ["#about .copy-card:nth-of-type(3) .copy", LONG_BOILERPLATE, "Long boilerplate copied"],
    ['.copy[data-copy-value="#4da61d"]', "#4da61d", "Apysyk Green HEX copied"],
    ['.copy[data-copy-value="rgb(77, 166, 29)"]', "rgb(77, 166, 29)", "Apysyk Green RGB copied"],
  ];
  for (const [selector, expected, announced] of cases) {
    const button = page.locator(selector);
    await button.click();
    await expect(button).toContainText("Copied");
    await expect(page.locator("#copy-status")).toHaveText(announced);
    const copied = readable
      ? await page.evaluate(() => navigator.clipboard.readText())
      : await page.evaluate(() => (window as unknown as { __copied?: string }).__copied);
    expect(copied).toBe(expected);
  }
});

test("every link, button and select is reachable by keyboard", async ({ page, browserName }) => {
  // WebKit skips links on Tab unless the OS setting "Tab to all controls" is on, so Chromium measures the order.
  test.skip(browserName !== "chromium", "Tab order measured in Chromium");
  await open(page);
  const total = await page.locator("a[href], button:not([disabled]), select").count();
  const reached = new Set<string>();
  for (let i = 0; i < total + 5; i++) {
    await page.keyboard.press("Tab");
    const id = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const w = window as unknown as { __seen?: number };
      el.dataset.e2e ??= String((w.__seen = (w.__seen ?? 0) + 1));
      return el.dataset.e2e;
    });
    if (id) reached.add(id);
  }
  expect(reached.size).toBe(total);
});
