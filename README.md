# mediakit.risksquad.io

The public Risksquad media kit: logos, loading animations, colors, typography,
banners, wallpapers and approved descriptions, published at https://mediakit.risksquad.io/.
The page, banners and generator link to and print the website as https://risksquad.io/
(`WEBSITE_URL` and `WEBSITE` in `scripts/kit/brand.ts`). The kit publishes no email
address or contact section.

Only sources live here. Every image, thumbnail, archive and the page itself is
rendered by `bun run build` into `dist/` (ignored by git). The new
`mediakit.risksquad.io` host reuses the existing institutional AWS CloudFront/S3
hosting under the `/mediakit` storage prefix. Its publication is managed separately
from this repository's legacy publisher.
`bun run deploy` targets the existing `gh-pages` branch and GitHub Pages host,
not the new AWS host. Its existing domain, archives and consumers are preserved.
The legacy publication procedure below documents that publisher only.

For the AWS host, publish the checked `dist/` contents under `s3://risksquad-site-content/mediakit/` (hub account, distribution `EVF2Q8CCR9LZ9`; the `apysyk.com` bucket was deleted on 2026-11-14), assets before HTML, without a bucket-root delete. `index.html`, `assets.json`, `styles.css` and `app.js` keep fixed names, so they go up with `Cache-Control: no-cache`; everything else with `public,max-age=3600`. Delete objects the build no longer produces only after backing them up, then invalidate `/mediakit/*` (the function rewrites the media host's paths before the cache lookup). The institutional CloudFront viewer-request function must run on both its default and explicit `/index.html` behaviors and prefix every media-host path, including files with extensions. Its response headers policy permits data images for the generator while keeping scripts/styles/fonts same-origin and forms disabled. Copy the landing's standalone `404.html`, `error.css`, `assets/risksquad-lockup-black.svg`, `assets/risksquad-lockup-black.png` and `assets/risksquad-favicon.svg` into this prefix too; the shared custom-error response relies on those files. The landing workflow preserves the prefix and refreshes these common error assets. `mediakit.apysyk.com` now redirects to this host.

The current kit uses `risksquad-*` for every public asset filename, preview,
download archive and archive member. The page, manifest and browser generator
consume those paths together. Copyright uses Risksquad too.
The AWS publication retires only superseded generated `apysyk-*`
objects under `mediakit/`, after backing them up and validating the replacement.
It preserves the shared error assets and does not change the legacy GitHub Pages
host or its historical archive.

The first promotion requires `bun run deploy --promote-legacy-root`: it archives
the published legacy root once before installing the Risksquad kit at `/`.
Subsequent releases use `bun run deploy` without that flag and preserve `/old/`
unchanged; they never replace the archive with the current root. Root `CNAME`
and `.nojekyll` files are retained.
The archive's canonical/share metadata and `assets.json` site URL point to `/old/`;
its artwork, fonts, scripts, styles and download archives keep their original bytes.

Verify the built kit and the staged root/archive filesystem before publication.
Deployment checks the build inputs and archive guards, stages the complete result
in a temporary `gh-pages` checkout, then publishes it with one normal fast-forward
push, never a force-push. It does not run the test suites or a full staged-site
verification itself; those are release prerequisites. A staging failure leaves
the published branch untouched.

```sh
bun install
bunx playwright install chromium webkit
bun run build        # renders everything into dist/
bun run serve        # http://127.0.0.1:4480/ (PORT overrides)
bun run typecheck
bun test tests/unit  # manifest, archives and the logo files (needs dist/)
bunx playwright test # the page in Chromium and WebKit, desktop and phone (needs dist/)
bun run deploy --promote-legacy-root # first promotion only, after checks and commit
bun run deploy       # later checked, committed releases; preserves /old/
```

- Palette: three colors and nothing else (founder decision, 2026-11-16): Off-white `#eae6da`, Ink `#0d1a12` and Forest `#123c2b`, in `scripts/kit/brand.ts`. Lines, dim text, glows and the photo tritone are these colors at lower opacity or blended between them. `tests/unit/logo.test.ts` fails if a logo or loading SVG paints any other color. The supplied master PNG keeps its original `#181818` ink.
- `brand/logo/`: generated SVG sources and the supplied master PNG (`risksquad-lockup-reference.png`, 763 × 126, exact source bytes). The original is previewable, downloadable and included in logo/full-kit archives without re-encoding. `bun run logo` combines the unchanged mark geometry with Space Grotesk Medium (500). Horizontal lockups keep the master's geometry: a symbol/name gap of 57:117 and full-ink wordmark/symbol heights of 51:54. Capital letters are optically centered on the symbol, excluding the q descender from alignment; the full descender remains inside the frame. The color files pair the Forest mark with the Ink name; the one-color files are Ink (`*-black`, `wordmark-dark`) or Off-white (`*-white`, `wordmark-light`) and share the same geometry. On dark surfaces the logo is Off-white, so there are no separate on-dark color files. The favicon is the Off-white mark on a Forest tile, as on risksquad.io, so it reads on light and dark tab strips.
- `brand/fonts/`: unmodified upstream font files and their SIL Open Font Licenses. Space Grotesk supplies the outlined wordmark; Mona Sans remains the display/body typeface and JetBrains Mono the technical typeface. The previous Hubot source is retained for historical work, not used by the active logo. Fonts are not offered as downloads. Space Grotesk's variable TTF and license come from `google/fonts` commit `5e8a3ba899557829a76cfdac30fa512bda91d7ca`, `ofl/spacegrotesk/`, without conversion.
- `brand/photos/`: eight real CC0 photographs, with their credits and source URLs in `SOURCES.txt`. All are available in the generator; the six new surfaces (Mountains, Woods, Highway, Glass, Dunes and Shore) are generator-only, so they do not multiply the prebuilt downloads.
- `scripts/kit/`: the asset catalog and layouts, shared surface artwork, loading animations, renderer and page.
- Loading: all seven motions have Ink (`-black.svg`), Off-white (`-dark.svg`) and Forest (`.svg`) downloads, each built from the same geometry and motion. Cards preview Ink/Off-white; both loading and full-kit ZIPs include all three. White luminance masks are not paint; the Ink Pulse variant also uses an Ink radial glow.
- `site/`: the stylesheet, theme and copy controls, and the client-side generator. The generator offers fourteen surfaces and exports full-resolution PNG banners or JPEG wallpapers.
- Approved primary headline: “Redefining how AppSec gets done”, shared by the page's copy, prebuilt banners and client-side generator.

The Banners section shows each composition once, edge to edge without a white mat,
with direct download buttons for every network or size. All 31 files remain available individually and in the banner archive.
