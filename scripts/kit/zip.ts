// ZIP archives with fflate. Already-compressed formats are stored, the rest
// deflated; a fixed timestamp keeps the archive bytes stable between builds.

import { zipSync, type Zippable } from "fflate";

const STORED = /\.(png|jpe?g|webp|woff2|zip)$/i;
const MTIME = new Date("2026-01-01T00:00:00");

export function makeZip(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const tree: Zippable = {};
  for (const { name, data } of entries) {
    tree[name] = [data, { level: STORED.test(name) ? 0 : 9, mtime: MTIME }];
  }
  return zipSync(tree);
}
