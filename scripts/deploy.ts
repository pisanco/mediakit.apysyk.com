/**
 * Publishes the tested build in dist/ to the gh-pages branch, which GitHub
 * Pages serves at https://mediakit.apysyk.com/. Run `bun run build` (and the
 * tests) first.
 *
 * Why a branch and not a GitHub Actions workflow: pushing workflow files needs
 * the OAuth `workflow` scope, which the publishing account does not grant. A
 * branch also publishes exactly the bytes that were checked locally.
 *
 * The branch holds one orphan commit with the latest build, force-pushed each
 * time, so the repository does not grow by tens of megabytes per release.
 */
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { $ } from "bun";

const DOMAIN = "mediakit.apysyk.com";
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
  cpSync(dist, work, { recursive: true });
  // The custom domain for branch-published Pages, and no Jekyll processing of the static files.
  writeFileSync(join(work, "CNAME"), `${DOMAIN}\n`);
  writeFileSync(join(work, ".nojekyll"), "");
  await $`git -C ${work} init -q -b gh-pages`;
  await $`git -C ${work} add -A`;
  await $`git -C ${work} commit -q -m ${`Deploy ${source}`}`;
  await $`git -C ${work} push -q -f ${remote} gh-pages`;
  console.log(`deployed ${source} to gh-pages: https://${DOMAIN}/ (GitHub Pages publishes it in a minute or two)`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
