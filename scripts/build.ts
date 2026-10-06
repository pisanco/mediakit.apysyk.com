// bun run build: renders every asset, thumbnail, archive, the manifest and the
// page into dist/. Runs the same on macOS and ubuntu-latest (Playwright Chromium).

import { availableParallelism } from "node:os";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { COVER_CARDS, LOGO_FILES, LOGO_WIDTHS, heroArt, icon, logoExport, ogImage, renderedAssets } from "./kit/catalog.ts";
import { FONTS, fontFaces } from "./kit/fonts.ts";
import { imageSize } from "./kit/image-size.ts";
import { formatBytes, type Manifest, type ManifestFile, type ManifestGroup } from "./kit/manifest.ts";
import { renderPage } from "./kit/page.ts";
import { Renderer } from "./kit/render.ts";
import { makeZip } from "./kit/zip.ts";
import { SITE_URL } from "./kit/brand.ts";

const ROOT = resolve(import.meta.dir, "..");
const DIST = join(ROOT, "dist");
const started = performance.now();

async function write(path: string, data: Uint8Array | string): Promise<number> {
  const file = join(DIST, path);
  await mkdir(dirname(file), { recursive: true });
  return Bun.write(file, data);
}

async function read(path: string): Promise<Uint8Array> {
  return new Uint8Array(await Bun.file(join(ROOT, path)).arrayBuffer());
}

/** Fails the build when a render does not have the exact size the catalog promises. */
function checked(name: string, data: Uint8Array, width: number, height: number): Uint8Array {
  const size = imageSize(data);
  if (size.width !== width || size.height !== height) {
    throw new Error(`${name}: rendered ${size.width}x${size.height}, expected ${width}x${height}`);
  }
  return data;
}

/** Thumbnail bounds by category: the page shows previews at about half these sizes, so they stay sharp at 2x. */
const THUMB_BOX: Record<string, [number, number]> = {
  avatars: [320, 320],
  social: [720, 720],
  email: [600, 300],
  imagery: [720, 720],
  display: [970, 600],
  desktop: [720, 720],
  video: [720, 720],
  phone: [300, 700],
  tablet: [400, 700],
};

await rm(DIST, { recursive: true, force: true });
const renderer = await Renderer.start(Math.min(4, availableParallelism()));
const files: ManifestFile[] = [];

try {
  // Logos: the SVG sources as they are, plus transparent PNGs at three widths.
  // Collected per item and flattened in catalog order, so concurrency never reorders the manifest.
  const logos = await Promise.all(
    LOGO_FILES.map(async ({ file, name }) => {
      const out: ManifestFile[] = [];
      const base = `apysyk-${file.replace(/\.svg$/, "")}`;
      const svg = await read(`brand/logo/${file}`);
      const path = `files/logos/svg/${base}.svg`;
      const viewBox = new TextDecoder().decode(svg).match(/viewBox="([\d.\s-]+)"/);
      if (!viewBox) throw new Error(`${file}: no viewBox`);
      const [, , vw, vh] = viewBox[1].trim().split(/\s+/).map(Number);
      out.push({ group: "logos", category: "svg", name, width: null, height: null, format: "svg", bytes: await write(path, svg), path });
      for (const width of LOGO_WIDTHS) {
        const height = Math.round((width * vh) / vw);
        const png = checked(file, await renderer.render(`${file}@${width}`, logoExport(file, width, height), { format: "png" }), width, height);
        const pngPath = `files/logos/png/${base}-${width}.png`;
        out.push({ group: "logos", category: "png", name, width, height, format: "png", bytes: await write(pngPath, png), path: pngPath });
      }
      return out;
    }),
  );
  files.push(...logos.flat());

  // Avatars, banners, ads and wallpapers.
  const rendered = await Promise.all(
    renderedAssets().map(async (a): Promise<ManifestFile> => {
      const data = checked(a.slug, await renderer.render(a.slug, a.doc, { format: a.format, quality: 92 }), a.width, a.height);
      const path = `files/${a.group}/${a.category}/${a.slug}.${a.format}`;
      return {
        group: a.group,
        category: a.category,
        name: a.name,
        variant: a.variant,
        width: a.width,
        height: a.height,
        format: a.format,
        bytes: await write(path, data),
        path,
      };
    }),
  );
  files.push(...rendered);

  // Three of the site's cover cards, already public on apysyk.com: their headlines are the live pages'.
  for (const page of COVER_CARDS) {
    const data = checked(page, await read(`brand/source/og/${page}.jpg`), 1200, 630);
    const path = `files/banners/imagery/apysyk-cover-${page}-1200x630.jpg`;
    files.push({ group: "banners", category: "imagery", name: `Cover card: ${page[0].toUpperCase()}${page.slice(1)}`, width: 1200, height: 630, format: "jpg", bytes: await write(path, data), path });
  }

  // The fonts the page itself renders with, each with its license. They are served for the page only,
  // not offered as downloads: visitors get them from the official sources.
  for (const font of FONTS) {
    await write(`fonts/${font.file}`, await read(`brand/fonts/${font.file}`));
    await write(`fonts/${font.license}`, await read(`brand/fonts/${font.license}`));
  }

  // The page's own images.
  const og = checked("og.png", await renderer.render("og", ogImage(), { format: "png" }), 1200, 630);
  files.push({ group: "site", category: "share", name: "Media kit share image", width: 1200, height: 630, format: "png", bytes: await write("og.png", og), path: "og.png" });
  await write("favicon.svg", await read("brand/logo/mark.svg"));
  await write("favicon-32.png", checked("favicon", await renderer.render("favicon", icon(32, "transparent", 0.94), { format: "png" }), 32, 32));
  await write("apple-touch-icon.png", checked("touch", await renderer.render("touch", icon(180, "#000", 0.6), { format: "png" }), 180, 180));
  const hero = heroArt();
  await write(".work/hero.png", await renderer.render("hero", hero, { format: "png" }));
  await write("hero.webp", await renderer.thumbnail(".work/hero.png", hero.width, hero.height, 0.86));
  await rm(join(DIST, ".work"), { recursive: true });

  // Previews: real renders downscaled in the browser.
  await Promise.all(
    files.map(async (f) => {
      const box = THUMB_BOX[f.category];
      if (!box || !f.width || !f.height) return;
      const scale = Math.min(1, box[0] / f.width, box[1] / f.height);
      const width = Math.round(f.width * scale);
      const height = Math.round(f.height * scale);
      const path = `thumbs/${f.path.replace(/^files\//, "").replace(/\.\w+$/, ".webp")}`;
      await write(path, checked(`${f.path} thumb`, await renderer.thumbnail(f.path, width, height), width, height));
      f.thumb = { path, width, height };
    }),
  );
} finally {
  await renderer.close();
}

// Archives: one per group and one with everything.
const ZIPS: { slug: string; name: string; groups: ManifestGroup[] }[] = [
  { slug: "apysyk-media-kit", name: "Everything", groups: ["logos", "banners", "wallpapers"] },
  { slug: "apysyk-logos", name: "Logos", groups: ["logos"] },
  { slug: "apysyk-banners", name: "Banners", groups: ["banners"] },
  { slug: "apysyk-wallpapers", name: "Wallpapers", groups: ["wallpapers"] },
];
const zips: ManifestFile[] = [];
for (const z of ZIPS) {
  const members = files.filter((f) => z.groups.includes(f.group));
  const entries = await Promise.all(
    members.map(async (f) => ({
      name: `${z.slug}/${f.path.replace(/^files\//, "")}`,
      data: new Uint8Array(await Bun.file(join(DIST, f.path)).arrayBuffer()),
    })),
  );
  const path = `downloads/${z.slug}.zip`;
  const bytes = await write(path, makeZip(entries));
  zips.push({ group: "downloads", category: "zip", name: z.name, width: null, height: null, format: "zip", bytes, path, contents: members.map((f) => f.path) });
}
files.push(...zips);

const manifest: Manifest = { site: SITE_URL, files };
await write("assets.json", `${JSON.stringify(manifest, null, 2)}\n`);

// The page.
await write("index.html", renderPage(manifest));
await write("styles.css", `${fontFaces("fonts/")}\n\n${new TextDecoder().decode(await read("site/styles.css"))}`);
const app = await Bun.build({ entrypoints: [join(ROOT, "site/app.ts")], minify: true, target: "browser" });
if (!app.success) throw new AggregateError(app.logs, "site/app.ts failed to build");
await write("app.js", await app.outputs[0].text());
await write("robots.txt", `User-agent: *\nAllow: /\n`);

// Summary.
async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}
const all = await walk(DIST);
let total = 0;
for (const f of all) total += (await stat(f)).size;
console.log(`dist: ${all.length} files, ${formatBytes(total)} (${total} bytes)`);
for (const z of zips) console.log(`  ${relative(DIST, join(DIST, z.path))}: ${formatBytes(z.bytes)} (${z.bytes} bytes, ${z.contents?.length} files)`);
console.log(`built in ${((performance.now() - started) / 1000).toFixed(1)} s`);
