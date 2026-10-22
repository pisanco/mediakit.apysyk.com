# mediakit.apysyk.com

The public Risksquad media kit for Risksquad and Apysyk OS: logos, loading animations,
colors, typography, banners, wallpapers and approved descriptions, published at https://mediakit.apysyk.com/new/.

Only sources live here. Every image, thumbnail, archive and the page itself is
rendered by `bun run build` into `dist/` (ignored by git). `bun run deploy`
publishes that tested build to `/new/` on the existing `gh-pages` branch, which
GitHub Pages serves. The live root and every file outside `/new/` are preserved;
deployment uses a normal fast-forward push, never a force-push.

```sh
bun install
bunx playwright install chromium webkit
bun run build        # renders everything into dist/
bun run serve        # http://127.0.0.1:4480/ (PORT overrides)
bun run typecheck
bun test tests/unit  # manifest, archives and the logo files (needs dist/)
bunx playwright test # the page in Chromium and WebKit, desktop and phone (needs dist/)
bun run deploy       # after the checks pass and the changes are committed
```

- `brand/logo/`: the logo SVG sources (`bun run logo` regenerates them from the mark's geometry in `scripts/logo/mark.ts` and Hubot Sans).
- `brand/fonts/`: the fonts the page renders with, each with its SIL Open Font License: the unmodified upstream Hubot Sans (variable TTF) and Mona Sans, and a JetBrains Mono subset used only to render the page. None is offered as a download.
- `brand/photos/`: eight real CC0 photographs, with their credits and source URLs in `SOURCES.txt`. All are available in the generator; the six new surfaces (Mountains, Woods, Highway, Glass, Dunes and Shore) are generator-only, so they do not multiply the prebuilt downloads.
- `scripts/kit/`: the asset catalog and layouts, shared surface artwork, loading animations, renderer and page.
- `site/`: the stylesheet, theme and copy controls, and the client-side generator. The generator offers fourteen surfaces and exports full-resolution PNG banners or JPEG wallpapers.

The Banners section shows each composition once, edge to edge without a white mat,
with direct download buttons for every network or size. All 31 files remain available individually and in the banner archive.

Questions: sales@apysyk.com.
