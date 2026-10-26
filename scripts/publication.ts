import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

const controls: Record<string, true> = { ".git": true, CNAME: true, ".nojekyll": true };
const reserved: Record<string, true> = { ...controls, old: true, new: true };

function contains(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith("../"));
}

function archiveHtml(html: string): string {
  // The published legacy page uses relative assets and absolute canonical/OG URLs.
  // Read its own origin rather than coupling archival to the new kit's SITE_URL.
  const canonical = html.match(/<link\b[^>]*\brel=(["'])canonical\1[^>]*\bhref=(["'])(.*?)\2[^>]*>/i)?.[3];
  if (!canonical) throw new Error("deploy: legacy index.html is missing its canonical URL");
  const page = new URL(canonical);
  if (!/^https?:$/.test(page.protocol) || page.pathname !== "/") {
    throw new Error("deploy: legacy canonical URL must identify the published root");
  }

  // Only URL attributes change: copy, fragment links, external sites, mailto links,
  // relative downloads, and the original CSS/JS/font/asset bytes remain untouched.
  return html.replace(/\b(href|src|content)=(['"])(.*?)\2/gi, (attribute, name: string, quote: string, value: string) => {
    if (value.startsWith("/") && !value.startsWith("//")) {
      return `${name}=${quote}/old${value}${quote}`;
    }
    if (!/^(https?:)?\/\//i.test(value)) return attribute;
    const url = new URL(value, page);
    if (url.origin !== page.origin) return attribute;
    return `${name}=${quote}${url.origin}/old${url.pathname}${url.search}${url.hash}${quote}`;
  });
}

/** Stage a complete root release in a temporary gh-pages checkout, without publishing it. */
export function stageSite({ publishedRoot, buildRoot, promoteLegacy }: {
  publishedRoot: string;
  buildRoot: string;
  promoteLegacy: boolean;
}): void {
  const published = resolve(publishedRoot);
  const build = resolve(buildRoot);
  if (contains(published, build) || contains(build, published)) {
    throw new Error("deploy: build and publication directories must not overlap");
  }
  const entries = readdirSync(published);
  const buildEntries = readdirSync(build);
  for (const name of buildEntries) {
    if (Object.hasOwn(reserved, name)) throw new Error(`deploy: build contains reserved publication entry ${name}`);
  }
  for (const name of ["index.html", "assets.json"]) {
    if (!buildEntries.includes(name) || !statSync(join(build, name)).isFile()) {
      throw new Error(`deploy: build/${name} is missing; run \`bun run build\` first`);
    }
  }

  const archive = join(published, "old");
  let archivedHtml: string | undefined;
  let archivedManifest: string | undefined;
  if (promoteLegacy) {
    if (entries.includes("old")) throw new Error("deploy: /old/ already exists; refusing to overwrite the legacy archive");
    archivedHtml = archiveHtml(readFileSync(join(published, "index.html"), "utf8"));
    const manifest = JSON.parse(readFileSync(join(published, "assets.json"), "utf8")) as { site: string; [key: string]: unknown };
    archivedManifest = `${JSON.stringify({ ...manifest, site: new URL("old/", manifest.site).href }, null, 2)}\n`;
  } else if (!entries.includes("old")) {
    throw new Error("deploy: first root publication requires --promote-legacy-root to archive the legacy site");
  } else if (!statSync(archive).isDirectory() || !readdirSync(archive).includes("index.html") || !statSync(join(archive, "index.html")).isFile()) {
    throw new Error("deploy: existing archive is missing old/index.html; refusing root publication");
  }

  if (promoteLegacy) {
    mkdirSync(archive);
    for (const name of entries) {
      if (!Object.hasOwn(reserved, name)) cpSync(join(published, name), join(archive, name), { recursive: true });
    }
    writeFileSync(join(archive, "index.html"), archivedHtml!);
    writeFileSync(join(archive, "assets.json"), archivedManifest!);
  }
  for (const name of entries) {
    if (name !== "old" && !Object.hasOwn(controls, name)) rmSync(join(published, name), { recursive: true, force: true });
  }
  for (const name of buildEntries) cpSync(join(build, name), join(published, name), { recursive: true });
}
