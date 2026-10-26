/**
 * Publishes the tested dist/ build at the domain root on the gh-pages branch.
 * The initial release requires --promote-legacy-root to archive the current site
 * at /old/. Later releases preserve that archive. Build and test before deploying.
 *
 * Why a branch and not a GitHub Actions workflow: pushing workflow files needs
 * the OAuth `workflow` scope, which the publishing account does not grant. A
 * branch also publishes exactly the bytes that were checked locally.
 *
 * A normal fast-forward push publishes the staged tree and preserves branch history.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { $ } from "bun";

import { SITE_URL } from "./kit/brand.ts";
import { stageSite } from "./publication.ts";

if (new URL(SITE_URL).pathname !== "/") throw new Error("deploy: SITE_URL must identify the domain root");
const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--promote-legacy-root")) throw new Error("deploy: only --promote-legacy-root is supported");
const promoteLegacy = args.includes("--promote-legacy-root");
const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");

for (const required of ["index.html", "assets.json"]) {
  if (!(await Bun.file(join(dist, required)).exists())) throw new Error(`deploy: dist/${required} is missing; run \`bun run build\` first`);
}
// The published build must match a commit, so it can be traced and rebuilt.
if ((await $`git -C ${root} status --porcelain`.text()).trim() !== "") throw new Error("deploy: commit your changes first");
const source = (await $`git -C ${root} rev-parse --short HEAD`.text()).trim();
const remote = (await $`git -C ${root} remote get-url origin`.text()).trim();

const work = mkdtempSync(join(tmpdir(), "mediakit-deploy-"));
try {
  await $`git clone -q --depth 1 --single-branch --branch gh-pages ${remote} ${work}`;
  stageSite({ publishedRoot: work, buildRoot: dist, promoteLegacy });
  await $`git -C ${work} add -A`;
  await $`git -C ${work} commit -q -m ${`Deploy ${source} to /${promoteLegacy ? " and archive legacy root at /old/" : ""}`}`;
  await $`git -C ${work} push -q origin gh-pages`;
  console.log(`deployed ${source} to ${SITE_URL} (/old/ preserved; GitHub Pages publishes it in a minute or two)`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
