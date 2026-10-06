# mediakit.apysyk.com

The public Apysyk media kit: logos, colors, typography, banners, wallpapers and
approved descriptions, published with GitHub Pages at https://mediakit.apysyk.com/.

Only sources live here. Every image, thumbnail, archive and the page itself is
rendered by `bun run build` into `dist/` (ignored by git). `bun run deploy`
publishes that tested build to the `gh-pages` branch, which GitHub Pages serves.

```sh
bun install
bunx playwright install chromium webkit
bun run build        # renders everything into dist/
bun run serve        # http://127.0.0.1:4480/ (PORT overrides)
bun run typecheck
bun test tests/unit  # manifest, archives and logo fidelity (needs dist/)
bunx playwright test # the page in Chromium and WebKit, desktop and phone (needs dist/)
bun run deploy       # after the checks pass and the changes are committed
```

- `brand/logo/`: the logo SVG sources (`bun run logo` regenerates them from `brand/source/logo-cube.png` and Hubot Sans).
- `brand/fonts/`: the fonts the page renders with, each with its SIL Open Font License: the unmodified upstream Hubot Sans (variable TTF) and Mona Sans, and a JetBrains Mono subset used only to render the page. None is offered as a download.
- `scripts/kit/`: the asset catalog and layouts, the editorial split system, the renderer, the page.
- `site/`: the page's stylesheet and its one script (the copy buttons).

Questions: sales@apysyk.com.
