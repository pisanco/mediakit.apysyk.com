// bun run serve: serves dist/ on http://localhost:4480 (PORT overrides), like
// GitHub Pages would: index.html for directories, 404 for anything missing.

import { join, normalize, resolve } from "node:path";

const DIST = resolve(import.meta.dir, "../dist");
const port = Number(process.env.PORT ?? 4480);

const server = Bun.serve({
  port,
  hostname: process.env.HOST ?? "127.0.0.1",
  async fetch(request) {
    const url = new URL(request.url);
    let path = normalize(decodeURIComponent(url.pathname));
    if (path.endsWith("/")) path += "index.html";
    const file = Bun.file(join(DIST, path));
    // normalize() already collapsed "..", so the joined path cannot leave dist/.
    if (!(await file.exists())) return new Response("Not found", { status: 404 });
    return new Response(request.method === "HEAD" ? null : file, {
      headers: { "Content-Type": file.type, "Content-Length": String(file.size) },
    });
  },
});

console.log(`Serving dist/ at ${server.url}`);
