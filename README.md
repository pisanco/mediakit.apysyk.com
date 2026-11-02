# mediakit.apysyk.com

The public Risksquad media kit: logos, loading animations, colors, typography,
banners, wallpapers and approved descriptions, published at https://mediakit.apysyk.com/.

Only sources live here. Every image, thumbnail, archive and the page itself is
rendered by `bun run build` into `dist/` (ignored by git). `bun run deploy`
publishes that tested build at the domain root on the existing `gh-pages` branch,
which GitHub Pages serves. The legacy Apysyk kit is archived at `/old/`, including
its resources and downloads. The former `/new/` deployment is removed, not kept
as a duplicate or alias.

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

- `brand/logo/`: generated SVG sources and the supplied master PNG (`risksquad-lockup-reference.png`, 763 × 126, exact source bytes). The original is previewable, downloadable and included in logo/full-kit archives without re-encoding. `bun run logo` combines the unchanged mark geometry with Space Grotesk Medium (500). Horizontal lockups match the master: `#181818` ink, a symbol/name gap of 57:117 and full-ink wordmark/symbol heights of 51:54. Capital letters are optically centered on the symbol, excluding the q descender from alignment; the full descender remains inside the frame. White variants retain the same geometry for dark surfaces.
- `brand/fonts/`: unmodified upstream font files and their SIL Open Font Licenses. Space Grotesk supplies the outlined wordmark; Mona Sans remains the display/body typeface and JetBrains Mono the technical typeface. The previous Hubot source is retained for historical work, not used by the active logo. Fonts are not offered as downloads. Space Grotesk's variable TTF and license come from `google/fonts` commit `5e8a3ba899557829a76cfdac30fa512bda91d7ca`, `ofl/spacegrotesk/`, without conversion.
- `brand/photos/`: eight real CC0 photographs, with their credits and source URLs in `SOURCES.txt`. All are available in the generator; the six new surfaces (Mountains, Woods, Highway, Glass, Dunes and Shore) are generator-only, so they do not multiply the prebuilt downloads.
- `scripts/kit/`: the asset catalog and layouts, shared surface artwork, loading animations, renderer and page.
- Loading: all seven motions have native black (`-black.svg`), white (`-dark.svg`) and original gradient (`.svg`) downloads. Cards preview black/white; both loading and full-kit ZIPs include all three. Recoloring preserves timing, shape, transparency and white luminance masks; the black Pulse variant also uses a black radial glow.
- `site/`: the stylesheet, theme and copy controls, and the client-side generator. The generator offers fourteen surfaces and exports full-resolution PNG banners or JPEG wallpapers.
- Approved primary headline: “Redefining how AppSec gets done”, shared by the page's copy, prebuilt banners and client-side generator.

The Banners section shows each composition once, edge to edge without a white mat,
with direct download buttons for every network or size. All 31 files remain available individually and in the banner archive.

Questions: sales@apysyk.com.
