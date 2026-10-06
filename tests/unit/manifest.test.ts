// The manifest is what the page and the archives are built from: it must list
// every deliverable of the media kit requirements, at the exact size, and match the real files.

import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { imageSize } from "../../scripts/kit/image-size.ts";
import type { Manifest } from "../../scripts/kit/manifest.ts";

const DIST = resolve(import.meta.dir, "../../dist");
const manifestFile = Bun.file(join(DIST, "assets.json"));
if (!(await manifestFile.exists())) throw new Error("dist/assets.json is missing: run `bun run build` first");
const manifest: Manifest = await manifestFile.json();

const sizes = (category: string, variant?: string) =>
  manifest.files
    .filter((f) => f.category === category && (variant === undefined || f.variant === variant))
    .map((f) => `${f.width}x${f.height}`)
    .sort();

const sorted = (list: string[]) => [...list].sort();

describe("manifest", () => {
  test("every file exists with the listed byte size and pixel size", async () => {
    for (const f of manifest.files) {
      const file = Bun.file(join(DIST, f.path));
      expect(await file.exists(), f.path).toBe(true);
      expect(file.size, f.path).toBe(f.bytes);
      if (["png", "jpg", "webp"].includes(f.format)) {
        const size = imageSize(new Uint8Array(await file.arrayBuffer()));
        expect(`${size.width}x${size.height}`, f.path).toBe(`${f.width}x${f.height}`);
      }
      if (f.thumb) {
        const thumb = imageSize(new Uint8Array(await Bun.file(join(DIST, f.thumb.path)).arrayBuffer()));
        expect(`${thumb.width}x${thumb.height}`, f.thumb.path).toBe(`${f.thumb.width}x${f.thumb.height}`);
      }
    }
  });

  test("holds every size the media kit requirements ask for", () => {
    expect(sizes("avatars")).toEqual(["1024x1024", "1024x1024"]);
    expect(sizes("social")).toEqual(
      sorted(["1128x191", "1584x396", "1500x500", "1640x624", "2560x1440", "1280x640", "1200x630", "1080x1080", "1080x1350", "1080x1920"]),
    );
    expect(sizes("email")).toEqual(sorted(["600x150", "1200x300"]));
    expect(sizes("display")).toEqual(
      sorted(["300x250", "336x280", "728x90", "970x90", "970x250", "160x600", "300x600", "320x50", "320x100"]),
    );
    expect(sizes("imagery")).toEqual(["1200x630", "1200x630", "1200x630"]);
    for (const variant of ["dark", "green"]) {
      expect(sizes("desktop", variant)).toEqual(
        sorted(["1920x1080", "2560x1440", "3840x2160", "5120x2880", "3440x1440", "2560x1600", "3024x1964", "3456x2234"]),
      );
      expect(sizes("phone", variant)).toEqual(sorted(["1179x2556", "1290x2796", "1080x2400", "1440x3200"]));
      expect(sizes("tablet", variant)).toEqual(sorted(["2048x2732", "1640x2360"]));
      expect(sizes("video", variant)).toEqual(["1920x1080"]);
    }
    const share = manifest.files.find((f) => f.path === "og.png");
    expect(share && `${share.width}x${share.height}`).toBe("1200x630");
  });

  test("exports every logo as SVG and as PNG at 512, 1024 and 2048 px wide", () => {
    const svgs = manifest.files.filter((f) => f.category === "svg").map((f) => f.path.split("/").pop());
    expect(svgs.sort()).toEqual(
      [
        "mark",
        "mark-white",
        "mark-black",
        "wordmark-light",
        "wordmark-dark",
        "lockup-on-dark",
        "lockup-on-light",
        "lockup-white",
        "lockup-black",
      ]
        .map((n) => `apysyk-${n}.svg`)
        .sort(),
    );
    const pngs = manifest.files.filter((f) => f.category === "png");
    expect(pngs).toHaveLength(27);
    for (const svg of svgs) {
      const base = svg!.replace(/\.svg$/, "");
      expect(pngs.filter((p) => new RegExp(`/${base}-\\d+\\.png$`).test(p.path)).map((p) => p.width)).toEqual([512, 1024, 2048]);
    }
  });

  test("wallpapers are JPG and banners PNG", () => {
    for (const f of manifest.files) {
      if (f.group === "wallpapers") expect(f.format, f.path).toBe("jpg");
      if (f.group === "banners" && f.category !== "imagery") expect(f.format, f.path).toBe("png");
    }
  });
});
