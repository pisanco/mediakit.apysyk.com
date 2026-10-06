// Each archive must hold exactly its group's files, byte for byte.

import { expect, test } from "bun:test";
import { unzipSync } from "fflate";
import { join, resolve } from "node:path";
import type { Manifest } from "../../scripts/kit/manifest.ts";

const DIST = resolve(import.meta.dir, "../../dist");
const manifestFile = Bun.file(join(DIST, "assets.json"));
if (!(await manifestFile.exists())) throw new Error("dist/assets.json is missing: run `bun run build` first");
const manifest: Manifest = await manifestFile.json();

const EXPECTED: Record<string, string[]> = {
  "apysyk-media-kit": ["logos", "banners", "wallpapers"],
  "apysyk-logos": ["logos"],
  "apysyk-banners": ["banners"],
  "apysyk-wallpapers": ["wallpapers"],
};

const zips = manifest.files.filter((f) => f.format === "zip");

test("there is one archive per group and one with everything", () => {
  expect(zips.map((z) => z.path).sort()).toEqual(Object.keys(EXPECTED).map((s) => `downloads/${s}.zip`).sort());
});

for (const zip of zips) {
  const slug = zip.path.replace(/^downloads\//, "").replace(/\.zip$/, "");
  test(`${slug}.zip holds exactly its files`, async () => {
    const entries = unzipSync(new Uint8Array(await Bun.file(join(DIST, zip.path)).arrayBuffer()));
    const expected = manifest.files.filter((f) => EXPECTED[slug].includes(f.group));
    expect(expected.length).toBeGreaterThan(0);
    expect(Object.keys(entries).sort()).toEqual(expected.map((f) => `${slug}/${f.path.replace(/^files\//, "")}`).sort());
    for (const f of expected) {
      const inside = entries[`${slug}/${f.path.replace(/^files\//, "")}`];
      const original = new Uint8Array(await Bun.file(join(DIST, f.path)).arrayBuffer());
      expect(inside.length, f.path).toBe(original.length);
      expect(Buffer.compare(Buffer.from(inside), Buffer.from(original)), f.path).toBe(0);
    }
  });
}

// The fonts' Reserved Font Names allow redistributing only the unmodified files with their license;
// the kit points to the official sources instead, so no font binary is ever a download.
test("no archive and no manifest entry carries a font file", async () => {
  const font = /\.(woff2?|ttf|otf)$/i;
  expect(manifest.files.filter((f) => font.test(f.path)).map((f) => f.path)).toEqual([]);
  for (const zip of zips) {
    const entries = unzipSync(new Uint8Array(await Bun.file(join(DIST, zip.path)).arrayBuffer()));
    expect(Object.keys(entries).filter((n) => font.test(n)), zip.path).toEqual([]);
  }
});
