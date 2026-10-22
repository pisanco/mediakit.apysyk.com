/**
 * Publishes the tested build in dist/ at SITE_URL on the gh-pages branch.
 * The existing site outside that subdirectory is preserved. Run
 * `bun run build` (and the tests) first.
 *
 * Why a branch and not a GitHub Actions workflow: pushing workflow files needs
 * the OAuth `workflow` scope, which the publishing account does not grant. A
 * branch also publishes exactly the bytes that were checked locally.
 *
 * A normal fast-forward push preserves the published root and branch history.
 */
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { $ } from "bun";

import { SITE_URL } from "./kit/brand.ts";

const directory = new URL(SITE_URL).pathname.slice(1);
if (!directory) throw new Error("deploy: SITE_URL must name a subdirectory; publishing over the live root is not allowed");
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
  const destination = join(work, directory);
  rmSync(destination, { recursive: true, force: true });
  cpSync(dist, destination, { recursive: true });
  await $`git -C ${work} add -- ${directory}`;
  await $`git -C ${work} commit -q -m ${`Deploy ${source} to /${directory}`}`;
  await $`git -C ${work} push -q origin gh-pages`;
  console.log(`deployed ${source} to ${SITE_URL} (the existing root is unchanged; GitHub Pages publishes it in a minute or two)`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
