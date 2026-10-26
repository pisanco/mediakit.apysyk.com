import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { stageSite } from "../../scripts/publication.ts";

const temporaryRoots: string[] = [];
const origin = "https://mediakit.apysyk.com";

function put(root: string, path: string, content: string | Uint8Array): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}

function fixture() {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "mediakit-publication-test-"));
  temporaryRoots.push(temporaryRoot);
  const publishedRoot = join(temporaryRoot, "published");
  const buildRoot = join(temporaryRoot, "build");
  // These are the published legacy page's actual metadata and resource conventions.
  put(publishedRoot, "index.html", `<!doctype html><html><head>
<link rel="canonical" href="${origin}/">
<meta property="og:url" content="${origin}/">
<meta property="og:image" content="${origin}/og.png?v=legacy">
<link rel="stylesheet" href="styles.css">
<script type="module" src="app.js"></script>
</head><body>
<img src="files/logos/svg/apysyk-mark.svg">
<a href="downloads/apysyk-media-kit.zip" download>Everything</a>
<img src="/thumbs/logo.webp?size=320#preview">
<a href="/downloads/apysyk-logos.zip" download>Logos</a>
<a href="#downloads">Downloads</a>
<a href="https://apysyk.com/">Website</a>
<a href="https://github.com/mona-sans">Fonts</a>
<a href="//cdn.example.com/font.woff2">External font</a>
<a href="https://mediakit.apysyk.com.example.com/og.png">Other host</a>
<a href="mailto:sales@apysyk.com">Contact</a>
</body></html>`);
  put(publishedRoot, "styles.css", '@font-face { src: url("fonts/MonaSans.woff2"); }');
  put(publishedRoot, "app.js", 'document.title = "Legacy Apysyk";');
  put(publishedRoot, "fonts/MonaSans.woff2", new Uint8Array([119, 79, 70, 50, 7]));
  put(publishedRoot, "files/logos/svg/apysyk-mark.svg", '<svg xmlns="http://www.w3.org/2000/svg"/>');
  put(publishedRoot, "assets.json", JSON.stringify({
    site: `${origin}/`,
    files: [{ path: "files/logos/svg/apysyk-mark.svg" }, { path: "downloads/apysyk-media-kit.zip" }],
  }));
  put(publishedRoot, "downloads/apysyk-media-kit.zip", new Uint8Array([80, 75, 3, 4, 1]));
  put(publishedRoot, "downloads/apysyk-logos.zip", new Uint8Array([80, 75, 3, 4, 2]));
  put(publishedRoot, "thumbs/logo.webp", new Uint8Array([82, 73, 70, 70]));
  put(publishedRoot, "og.png", new Uint8Array([137, 80, 78, 71]));
  put(publishedRoot, "CNAME", "mediakit.apysyk.com\n");
  put(publishedRoot, ".nojekyll", "");
  put(publishedRoot, ".git/config", "repository control");
  put(publishedRoot, "new/index.html", "Consumed Risksquad site");
  put(publishedRoot, "new/stale.js", "Consumed bundle");
  put(buildRoot, "index.html", "Risksquad root");
  put(buildRoot, "assets.json", '{"site":"https://mediakit.apysyk.com/"}');
  put(buildRoot, "files/current.svg", "Current logo");
  return { publishedRoot, buildRoot };
}

function snapshot(root: string, prefix = ""): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) Object.assign(files, snapshot(root, path));
    else files[path] = readFileSync(join(root, path)).toString("base64");
  }
  return files;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("promotion archives every legacy asset and resolves page resources and metadata under /old/", () => {
  const { publishedRoot, buildRoot } = fixture();
  const original = snapshot(publishedRoot);
  stageSite({ publishedRoot, buildRoot, promoteLegacy: true });

  for (const [path, bytes] of Object.entries(original)) {
    if (path === "index.html" || path === "assets.json" || path === "CNAME" || path === ".nojekyll" || path.startsWith(".git/") || path.startsWith("new/")) continue;
    expect(readFileSync(join(publishedRoot, "old", path)).toString("base64"), path).toBe(bytes);
  }
  const archivedManifest = JSON.parse(readFileSync(join(publishedRoot, "old/assets.json"), "utf8"));
  const originalManifest = JSON.parse(Buffer.from(original["assets.json"]!, "base64").toString("utf8"));
  expect(archivedManifest).toEqual({ ...originalManifest, site: `${origin}/old/` });
  for (const file of archivedManifest.files) {
    const url = new URL(file.path, archivedManifest.site);
    expect(url.pathname, file.path).toBe(`/old/${file.path}`);
    expect(readFileSync(join(publishedRoot, url.pathname)).toString("base64"), file.path).toBe(original[file.path]);
  }

  const html = readFileSync(join(publishedRoot, "old/index.html"), "utf8");
  const attributes = [...html.matchAll(/\b(?:href|src|content)="([^"]*)"/g)].map((match) => match[1]);
  const urls = attributes.map((value) => new URL(value, `${origin}/old/`));
  expect(urls.some((url) => url.href === `${origin}/old/`)).toBe(true);
  expect(attributes.filter((value) => value === `${origin}/old/`)).toHaveLength(2);
  expect(attributes).toContain(`${origin}/old/og.png?v=legacy`);
  expect(attributes).toContain("/old/thumbs/logo.webp?size=320#preview");
  expect(attributes).toContain("/old/downloads/apysyk-logos.zip");
  for (const url of urls.filter((url) => url.origin === origin)) {
    expect(url.pathname.startsWith("/old/"), url.href).toBe(true);
    const path = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
    expect(existsSync(join(publishedRoot, path)), url.href).toBe(true);
  }
  for (const external of ["https://apysyk.com/", "https://github.com/mona-sans", "//cdn.example.com/font.woff2", "https://mediakit.apysyk.com.example.com/og.png", "mailto:sales@apysyk.com", "#downloads"]) {
    expect(attributes).toContain(external);
  }
  const css = readFileSync(join(publishedRoot, "old/styles.css"), "utf8");
  const font = /url\("([^"]+)"\)/.exec(css)![1];
  const fontUrl = new URL(font, `${origin}/old/styles.css`);
  expect(readFileSync(join(publishedRoot, fontUrl.pathname))).toEqual(Buffer.from([119, 79, 70, 50, 7]));
});

test("promotion replaces the entire root, consumes /new/ and retains deployment controls only at root", () => {
  const { publishedRoot, buildRoot } = fixture();
  stageSite({ publishedRoot, buildRoot, promoteLegacy: true });
  expect(readFileSync(join(publishedRoot, "index.html"), "utf8")).toBe("Risksquad root");
  expect(readFileSync(join(publishedRoot, "files/current.svg"), "utf8")).toBe("Current logo");
  for (const obsolete of ["new", "styles.css", "app.js", "fonts", "downloads", "files/logos", "old/new", "old/.git", "old/CNAME", "old/.nojekyll"]) {
    expect(existsSync(join(publishedRoot, obsolete)), obsolete).toBe(false);
  }
  expect(readFileSync(join(publishedRoot, "CNAME"), "utf8")).toBe("mediakit.apysyk.com\n");
  expect(readFileSync(join(publishedRoot, ".nojekyll"), "utf8")).toBe("");
  expect(readFileSync(join(publishedRoot, ".git/config"), "utf8")).toBe("repository control");
});

test("later root releases leave the existing archive byte-for-byte intact", () => {
  const { publishedRoot, buildRoot } = fixture();
  stageSite({ publishedRoot, buildRoot, promoteLegacy: true });
  const archive = snapshot(join(publishedRoot, "old"));
  put(publishedRoot, "new/index.html", "Obsolete duplicate");
  put(buildRoot, "index.html", "Updated Risksquad root");
  rmSync(join(buildRoot, "files"), { recursive: true });
  put(buildRoot, "updated.js", "Updated bundle");
  stageSite({ publishedRoot, buildRoot, promoteLegacy: false });
  expect(snapshot(join(publishedRoot, "old"))).toEqual(archive);
  expect(readFileSync(join(publishedRoot, "index.html"), "utf8")).toBe("Updated Risksquad root");
  expect(readFileSync(join(publishedRoot, "updated.js"), "utf8")).toBe("Updated bundle");
  expect(existsSync(join(publishedRoot, "files"))).toBe(false);
  expect(existsSync(join(publishedRoot, "new"))).toBe(false);
});

test("initial promotion must be explicit and refuses any existing archive without changing published bytes", () => {
  const { publishedRoot, buildRoot } = fixture();
  const original = snapshot(publishedRoot);
  expect(() => stageSite({ publishedRoot, buildRoot, promoteLegacy: false })).toThrow("--promote-legacy-root");
  expect(snapshot(publishedRoot)).toEqual(original);
  put(publishedRoot, "old/keep.txt", "Existing archive");
  const withArchive = snapshot(publishedRoot);
  expect(() => stageSite({ publishedRoot, buildRoot, promoteLegacy: true })).toThrow("already exists");
  expect(snapshot(publishedRoot)).toEqual(withArchive);
});

test("a build cannot overwrite the archive or repository and deployment controls", () => {
  for (const reserved of ["old", "new", ".git", "CNAME", ".nojekyll"]) {
    const { publishedRoot, buildRoot } = fixture();
    put(buildRoot, reserved, "Unexpected build entry");
    const original = snapshot(publishedRoot);
    expect(() => stageSite({ publishedRoot, buildRoot, promoteLegacy: true })).toThrow("reserved");
    expect(snapshot(publishedRoot)).toEqual(original);
  }
});

test("incomplete builds or archives fail before changing the published site", () => {
  const { publishedRoot, buildRoot } = fixture();
  rmSync(join(buildRoot, "assets.json"));
  const original = snapshot(publishedRoot);
  expect(() => stageSite({ publishedRoot, buildRoot, promoteLegacy: true })).toThrow("assets.json");
  expect(snapshot(publishedRoot)).toEqual(original);
  put(buildRoot, "assets.json", "{}");
  put(publishedRoot, "old/keep.txt", "Incomplete archive");
  const withArchive = snapshot(publishedRoot);
  expect(() => stageSite({ publishedRoot, buildRoot, promoteLegacy: false })).toThrow("old/index.html");
  expect(snapshot(publishedRoot)).toEqual(withArchive);
});
