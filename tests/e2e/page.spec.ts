// The published page, as a visitor gets it from dist/ (run `bun run build` first).

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
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode().catch(() => undefined))));
}

test("renders with no console errors, CSP violations or third-party requests", async ({ page }) => {
  const problems = await open(page);
  await expect(page).toHaveTitle("Media kit · Apysyk");
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
  const missing = manifest.files.filter((f) => ["logos", "banners", "wallpapers", "downloads"].includes(f.group) && !linked.has(f.path));
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

test("axe finds no serious or critical accessibility violations", async ({ page }) => {
  await open(page);
  await loadEverything(page);
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(serious).toEqual([]);
});

test("no horizontal scroll, down to 360 px wide", async ({ page }) => {
  await open(page);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);
  if (page.viewportSize()!.width < 600) {
    await page.setViewportSize({ width: 360, height: 740 });
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
    ['.copy[data-copy-value="#58a02d"]', "#58a02d", "Apysyk Green HEX copied"],
    ['.copy[data-copy-value="rgb(88, 160, 45)"]', "rgb(88, 160, 45)", "Apysyk Green RGB copied"],
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

test("every link and button is reachable by keyboard", async ({ page, browserName }) => {
  // WebKit skips links on Tab unless the OS setting "Tab to all controls" is on, so Chromium measures the order.
  test.skip(browserName !== "chromium", "Tab order measured in Chromium");
  await open(page);
  const total = await page.locator("a[href], button").count();
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
