// The shape of dist/assets.json. The page is generated from it and the tests
// check it against the real files, so it is the one list of what the kit holds.

export type ManifestGroup = "logos" | "banners" | "wallpapers" | "downloads" | "site";

export interface Thumb {
  path: string;
  width: number;
  height: number;
}

export interface ManifestFile {
  group: ManifestGroup;
  /** Sub-section, e.g. "svg", "png", "avatars", "social", "display", "phone", "zip". */
  category: string;
  name: string;
  /** Pixel size for images; null for SVGs and archives. */
  width: number | null;
  height: number | null;
  format: string;
  bytes: number;
  /** Path from the site root, without a leading slash. */
  path: string;
  variant?: string;
  thumb?: Thumb;
  /** For archives: the manifest paths they contain. */
  contents?: string[];
}

export interface Manifest {
  site: string;
  files: ManifestFile[];
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1e6) {
    const mb = bytes / 1e6;
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}
