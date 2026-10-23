// The media kit page, generated from the manifest so every preview, label and
// size on it is the real file's. Static HTML: no inline scripts or styles
// (the CSP forbids them); the copy buttons use app.js.

import { COLORS, CONTACT, COPY, FOOTER, LONG_BOILERPLATE, PALETTE, SITE_URL, hexToRgb } from "./brand.ts";
import { LOGO_FILES } from "./catalog.ts";
import { FONTS, fontByFamily, type BrandFont } from "./fonts.ts";
import { LOADING_VERSIONS } from "./loading.ts";
import { LOCKUP_GEOMETRY } from "./logo-geometry.ts";
import { formatBytes, type Manifest, type ManifestFile } from "./manifest.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'none'; object-src 'none'";

const DESCRIPTION =
  "The Risksquad media kit: logos, loading animations, colors, typography, banners, wallpapers and approved descriptions, free to use when writing about or referring to Risksquad and Apysyk OS.";

const SECTIONS = [
  ["about", "About"],
  ["logo", "Logo"],
  ["loading", "Loading"],
  ["color", "Color"],
  ["typography", "Typography"],
  ["banners", "Banners"],
  ["wallpapers", "Wallpapers"],
  ["downloads", "Downloads"],
  ["generator", "Generator"],
  ["contact", "Contact"],
] as const;

const dims = (f: ManifestFile) => `${f.width} × ${f.height}`;

/** A download link; the hidden prefix names the file for screen readers, the data attributes state its size for the tests. */
function download(f: ManifestFile, visible: string, context: string, className = "dl", detail?: string): string {
  const size = f.width ? ` data-width="${f.width}" data-height="${f.height}"` : "";
  const description = detail ? `<span class="dl__detail">${esc(detail)}</span>` : "";
  return `<a class="${className}" href="${esc(f.path)}" download${size}><span class="visually-hidden">${esc(context)}, </span><span class="dl__label">${esc(visible)}${description}</span> <span class="dl__meta">${formatBytes(f.bytes)}</span></a>`;
}

function thumb(f: ManifestFile, alt: string, className = "preview__img"): string {
  const t = f.thumb;
  if (!t) throw new Error(`${f.path} has no thumbnail`);
  return `<img class="${className}" src="${esc(t.path)}" width="${t.width}" height="${t.height}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
}

/**
 * A copy button. It copies `value`, or else the text of the element `target`; app.js announces
 * "<name> copied", and selects `target` when the browser refuses the copy, so it can be copied by hand.
 */
function copyButton(target: string, name: string, value?: string): string {
  const literal = value === undefined ? "" : ` data-copy-value="${esc(value)}"`;
  return `<button class="copy" type="button" data-copy-target="${target}" data-copy-name="${esc(name)}"${literal}><span class="copy__label">Copy</span><span class="visually-hidden"> ${esc(name)}</span></button>`;
}

function sectionHead(id: string, title: string, lead: string): string {
  return `<header class="section__head">
  <h2 class="headline" id="${id}-title">${title}</h2>
  <p class="intro">${lead}</p>
</header>`;
}

/** `shareVersion` is the share image's hash, carried in its URL so share caches refetch a changed banner. */
export function renderPage(manifest: Manifest, shareVersion: string): string {
  const files = manifest.files;
  const byPath = (path: string) => {
    const f = files.find((x) => x.path === path);
    if (!f) throw new Error(`missing in manifest: ${path}`);
    return f;
  };
  const where = (pred: (f: ManifestFile) => boolean) => files.filter(pred);
  const zip = (slug: string) => byPath(`downloads/${slug}.zip`);
  const everything = zip("apysyk-media-kit");
  const kitFiles = files.filter((f) => ["logos", "loading", "banners", "wallpapers"].includes(f.group));
  const count = (pred: (f: ManifestFile) => boolean) => kitFiles.filter(pred).length;
  const mark = byPath("files/logos/svg/apysyk-mark.svg");
  const markPng = where((f) => /^files\/logos\/png\/apysyk-mark-\d+\.png$/.test(f.path))[0];
  // The page is light first: the lockup and its size come from the version drawn for light backgrounds; the dark page swaps the file.
  const lockup = byPath("files/logos/svg/apysyk-lockup-on-light.svg");
  const lockupDark = byPath("files/logos/svg/apysyk-lockup-on-dark.svg");
  const lockupPng = where((f) => f.path.startsWith("files/logos/png/apysyk-lockup-on-light-"))[0];
  const lockupHeight = (width: number) => Math.round((width * lockupPng.height!) / lockupPng.width!);

  // ---------- About ----------
  const boilerplates = [
    ["one-liner", "One-liner", COPY.oneLiner],
    ["short", "Short boilerplate", COPY.short],
    ["long", "Long boilerplate", LONG_BOILERPLATE],
  ]
    .map(
      ([id, title, text]) => `<article class="card copy-card">
  <div class="card__top"><h3 class="card__label">${title}</h3>${copyButton(`copy-${id}`, title)}</div>
  <p class="copy-card__text" id="copy-${id}">${esc(text)}</p>
</article>`,
    )
    .join("\n");
  const about = `<section class="section" id="about" aria-labelledby="about-title">
${sectionHead("about", "About Apysyk", "Approved descriptions. Quote them as they are.")}
<div class="about">
  <div class="about__copy">${boilerplates}</div>
  <aside class="card facts" aria-labelledby="facts-title">
    <h3 class="card__label" id="facts-title">Quick facts</h3>
    <dl>
      <div><dt>Company</dt><dd>Risksquad</dd></div>
      <div><dt>Product</dt><dd>Apysyk OS</dd></div>
      <div><dt>Category</dt><dd>${COPY.category}</dd></div>
      <div><dt>Website</dt><dd><a href="https://apysyk.com/">apysyk.com</a></dd></div>
      <div><dt>Contact</dt><dd><a href="mailto:${CONTACT}">${CONTACT}</a></dd></div>
    </dl>
  </aside>
</div>
</section>`;

  // ---------- Logo ----------
  // Each preview sits on the background the file is drawn for: light on Paper, dark and one-color white on Forest.
  const logoCards = LOGO_FILES.map(({ file, name, background }) => {
    const base = `apysyk-${file.replace(/\.svg$/, "")}`;
    const svg = byPath(`files/logos/svg/${base}.svg`);
    const pngs = where((f) => f.category === "png" && new RegExp(`^files/logos/png/${base}-\\d+\\.png$`).test(f.path));
    const ref = pngs[0];
    const kind = file.startsWith("lockup-stacked") ? "stacked" : file === "mark-on-gradient.svg" ? "tile" : file === "lockup-on-gradient.svg" ? "badge" : file.startsWith("mark") ? "mark" : file.startsWith("wordmark") ? "wordmark" : "lockup";
    return `<article class="card logo-card">
  <div class="preview preview--${background} preview--${kind}"><img src="${svg.path}" width="${ref.width}" height="${ref.height}" alt="${esc(`Risksquad ${name.toLowerCase()}`)}" loading="lazy" decoding="async"></div>
  <div class="logo-card__body">
    <h3 class="card__title">${esc(name)}</h3>
    <div class="dl-row">${download(svg, "SVG", name)}${pngs.map((p) => download(p, `PNG ${p.width}`, `${name}, ${dims(p)} px`)).join("")}</div>
  </div>
</article>`;
  }).join("\n");
  const avatars = where((f) => f.category === "avatars")
    .map(
      (f) => `<article class="card asset-card">
  <div class="preview preview--frame">${thumb(f, `${f.name}: the Risksquad mark centered`, "preview__img preview__img--avatar")}</div>
  <div class="asset-card__body"><h4 class="card__title">${esc(f.name)}</h4><p class="size">${dims(f)} px</p>${download(f, "PNG", `${f.name}, ${dims(f)} px`)}</div>
</article>`,
    )
    .join("\n");
  // Clear space x: the side of the mark's window, around the lockup's own viewBox.
  const { clearSpace: x, width: lw, height: lh } = LOCKUP_GEOMETRY;
  const n = (v: number) => Math.round(v * 100) / 100;
  const clearSpace = `<svg class="clearspace__svg" viewBox="${n(-x)} ${n(-x)} ${n(lw + 2 * x)} ${n(lh + 2 * x)}" role="img" aria-labelledby="clearspace-title">
  <title id="clearspace-title">Clear space: the side of the mark's window on every side of the lockup</title>
  <rect x="${n(-x)}" y="${n(-x)}" width="${n(lw + 2 * x)}" height="${n(lh + 2 * x)}" fill="${COLORS.green}" fill-opacity="0.08"/>
  <rect x="${n(-x)}" y="${n(-x)}" width="${n(lw + 2 * x)}" height="${n(lh + 2 * x)}" fill="none" stroke="${COLORS.green}" stroke-width="${n(x * 0.04)}" stroke-dasharray="${n(x * 0.17)} ${n(x * 0.13)}"/>
  <rect x="0" y="0" width="${lw}" height="${lh}" fill="${COLORS.white}"/>
  <image href="${lockup.path}" x="0" y="0" width="${lw}" height="${lh}"/>
  <g fill="${COLORS.green2}" font-family="JetBrains Mono, monospace" font-size="${n(x * 0.57)}" text-anchor="middle">
    <text x="${n(-x / 2)}" y="${n(lh / 2 + x * 0.2)}">x</text><text x="${n(lw + x / 2)}" y="${n(lh / 2 + x * 0.2)}">x</text>
    <text x="${n(lw / 2)}" y="${n(-x / 2 + x * 0.2)}">x</text><text x="${n(lw / 2)}" y="${n(lh + x / 2 + x * 0.2)}">x</text>
  </g>
</svg>`;
  const donts = [
    ["recolor", "Recolor it"],
    ["stretch", "Stretch or squash it"],
    ["rotate", "Rotate it"],
    ["effects", "Add shadows, glows or other effects"],
    ["outline", "Outline it"],
    ["busy", "Place it on a busy background"],
  ]
    .map(
      ([k, t]) => `<li class="dont"><div class="dont__demo dont__demo--${k}" aria-hidden="true"><img src="${mark.path}" width="62" height="62" alt="" loading="lazy" decoding="async"></div><p>${t}</p></li>`,
    )
    .join("");
  const logo = `<section class="section" id="logo" aria-labelledby="logo-title">
${sectionHead("logo", "Logo", "Four bands in the green gradient around an open square, and the wordmark: side by side, stacked, alone, and in white on the gradient. Use the files as supplied: full color on light or dark backgrounds, one color where color is not possible.")}
<div class="grid grid--logos">${logoCards}</div>
<h3 class="subhead">Avatars</h3>
<div class="grid grid--avatars">${avatars}</div>
<div class="rules">
  <article class="card rule">
    <h3 class="card__title">Clear space</h3>
    <p class="body">Keep free space around the logo equal to the side of the mark's window, <em>x</em>, on every side.</p>
    <div class="clearspace">${clearSpace}</div>
  </article>
  <article class="card rule">
    <h3 class="card__title">Minimum size</h3>
    <p class="body">Never smaller than 24 px tall for the mark, or 96 px wide for the lockup.</p>
    <div class="minsize">
      <figure><img class="minsize__mark" src="${mark.path}" width="24" height="24" alt="The mark at 24 px" loading="lazy"><figcaption class="size">Mark · 24 px</figcaption></figure>
      <figure><img class="minsize__lockup" src="${lockup.path}" width="96" height="${lockupHeight(96)}" alt="The lockup at 96 px wide" loading="lazy"><figcaption class="size">Lockup · 96 px</figcaption></figure>
    </div>
  </article>
</div>
<h3 class="subhead">Don't</h3>
<ul class="donts">${donts}</ul>
</section>`;

  // ---------- Loading ----------
  // The animations play in the previews: an <img> runs an SVG's own animation, with no script on the page.
  // Each card previews the gradient and black on Paper, and white on Forest.
  const loadingCards = LOADING_VERSIONS.map((v) => {
    const light = byPath(`files/loading/${v.slug}.svg`);
    const dark = byPath(`files/loading/${v.slug}-dark.svg`);
    const black = byPath(`files/loading/${v.slug}-black.svg`);
    return `<article class="card loading-card">
  <div class="loading-card__previews">
    <div class="preview preview--light preview--loading"><img src="${light.path}" width="96" height="96" alt="${esc(`${v.name}: the mark animated, for light surfaces`)}" loading="lazy" decoding="async"></div>
    <div class="preview preview--light preview--loading"><img src="${black.path}" width="96" height="96" alt="${esc(`${v.name}: the mark animated in black, for light surfaces`)}" loading="lazy" decoding="async"></div>
    <div class="preview preview--forest preview--loading"><img src="${dark.path}" width="96" height="96" alt="${esc(`${v.name}: the mark animated in white, for dark surfaces`)}" loading="lazy" decoding="async"></div>
  </div>
  <div class="loading-card__body">
    <h3 class="card__title">${esc(v.name)}</h3>
    <p class="body">${esc(v.description)}</p>
    <div class="dl-row">${download(light, "SVG, light", `${v.name}, for light surfaces`)}${download(black, "SVG, black", `${v.name}, in black for light surfaces`)}${download(dark, "SVG, dark", `${v.name}, for dark surfaces`)}</div>
  </div>
</article>`;
  }).join("\n");
  const loading = `<section class="section" id="loading" aria-labelledby="loading-title">
${sectionHead("loading", "Loading", "Seven animated versions of the mark for loading states, each in the brand gradient, black and white. Every file is a self-contained SVG with no script: it works inline, in an image tag and as a background. Show the still mark instead when someone prefers reduced motion.")}
<div class="grid grid--loading">${loadingCards}</div>
</section>`;

  // ---------- Color ----------
  const swatches = PALETTE.map(({ name, hex, role }) => {
    const rgb = hexToRgb(hex).join(", ");
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    return `<article class="card swatch">
  <div class="swatch__chip swatch__chip--${slug}"></div>
  <div class="swatch__body">
    <h3 class="card__title">${esc(name)}</h3>
    <p class="body swatch__role">${esc(role)}</p>
    <dl class="swatch__values">
      <div><dt>HEX</dt><dd><code id="hex-${slug}">${hex}</code>${copyButton(`hex-${slug}`, `${name} HEX`, hex)}</dd></div>
      <div><dt>RGB</dt><dd><code id="rgb-${slug}">${rgb}</code>${copyButton(`rgb-${slug}`, `${name} RGB`, `rgb(${rgb})`)}</dd></div>
    </dl>
  </div>
</article>`;
  }).join("\n");
  const color = `<section class="section" id="color" aria-labelledby="color-title">
${sectionHead("color", "Color", "Light first: Paper and White surfaces, Ink for text, green for emphasis and one deep Forest band. Copy the values exactly.")}
<div class="grid grid--swatches">${swatches}</div>
</section>`;

  // ---------- Typography ----------
  // Ranges come from the font files, so the specimens never claim weights the fonts lack.
  const range = (a: { min: number; max: number }, unit = "") => `${a.min}${unit}–${a.max}${unit}`;
  const axesLabel = (f: BrandFont, role: string) =>
    [role, `weights ${range(f.releaseWeight ?? f.weight)}`, ...(f.width ? [`widths ${range(f.width, "%")}`] : [])].join(" · ");
  const licenseLink = (f: BrandFont) => `fonts/${f.license}`;
  const hubot = fontByFamily("Hubot Sans");
  const mona = fontByFamily("Mona Sans");
  const jet = fontByFamily("JetBrains Mono");
  const sourceLink = (f: BrandFont) => `<a href="${f.source}">${f.source.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "")}</a>`;
  const typography = `<section class="section" id="typography" aria-labelledby="typography-title">
${sectionHead("typography", "Typography", "Three open-source families from GitHub and JetBrains, all free under the SIL Open Font License. Get them from their official sources.")}
<div class="type">
  <article class="card specimen specimen--mona">
    <div class="specimen__meta"><h3 class="card__title">Mona Sans</h3><p class="size">${axesLabel(mona, "Display and text")}</p></div>
    <p class="specimen__sample specimen__sample--display">${esc(COPY.headline[0])} <em>${esc(COPY.headline[1])}</em></p>
    <p class="specimen__sample specimen__sample--text">${esc(COPY.oneLiner)}</p>
    <p class="body">Headlines at weight 600 with tight tracking, in sentence case. Body copy, buttons and interface text.</p>
    <p class="specimen__links">${sourceLink(mona)} · <a href="${licenseLink(mona)}">License</a></p>
  </article>
  <article class="card specimen specimen--hubot">
    <div class="specimen__meta"><h3 class="card__title">Hubot Sans</h3><p class="size">${axesLabel(hubot, "Wordmark")}</p></div>
    <p class="specimen__sample specimen__sample--glyphs" aria-hidden="true">Aa</p>
    <p class="body">The wordmark is Hubot Sans 700 at its default width. Use the logo files; never retype the wordmark.</p>
    <p class="specimen__links">${sourceLink(hubot)} · <a href="${licenseLink(hubot)}">License</a></p>
  </article>
  <article class="card specimen specimen--mono">
    <div class="specimen__meta"><h3 class="card__title">JetBrains Mono</h3><p class="size">${axesLabel(jet, "Technical values")}</p></div>
    <p class="specimen__sample specimen__sample--mono">${COLORS.green} · 1500 × 500 px</p>
    <p class="body">Technical values only: color codes, sizes and file sizes.</p>
    <p class="specimen__links">${sourceLink(jet)} · <a href="${licenseLink(jet)}">License</a></p>
  </article>
</div>
<p class="body type__credits">${FONTS.map((f) => `${esc(f.family)}: ${esc(f.copyright)}.`).join(" ")} Licensed under the <a href="https://openfontlicense.org/">SIL Open Font License 1.1</a>.</p>
</section>`;

  // ---------- Banners ----------
  // Show each composition once; the download buttons offer every network and size without repeating the art.
  const familyCard = (title: string, note: string, preview: ManifestFile, choices: [ManifestFile, string][], wide = false) => `<article class="card family-card${wide ? " family-card--wide" : ""}">
  <div class="preview">${thumb(preview, `${title}: ${preview.name}, ${dims(preview)} px`)}</div>
  <div class="family-card__body">
    <h4 class="card__title">${esc(title)}</h4>
    <p class="body">${esc(note)}</p>
    <ul class="family-card__downloads">${choices.map(([f, label]) => `<li>${download(f, label, `${title}, ${label}, ${dims(f)} px`, "dl family-card__download", `${dims(f)} · ${f.format.toUpperCase()}`)}</li>`).join("")}</ul>
  </div>
</article>`;
  const socialFile = (slug: string) => byPath(`files/banners/social/apysyk-${slug}.png`);
  const socialFamilies = (["aurora", "bridge"] as const).map((surface) => {
    const suffix = surface === "bridge" ? "-bridge" : "";
    const name = surface === "bridge" ? "Bridge" : "Aurora";
    return familyCard(`Covers · ${name}`, "One composition, adapted to each network. Choose your download.", socialFile(`linkedin-profile-banner${suffix}-1584x396`), [
      [socialFile(`linkedin-profile-banner${suffix}-1584x396`), "LinkedIn profile"],
      [socialFile(`linkedin-company-cover${suffix}-1128x191`), "LinkedIn company"],
      [socialFile(`x-header${suffix}-1500x500`), "X"],
      [socialFile(`facebook-cover${suffix}-1640x624`), "Facebook"],
      [socialFile(`youtube-banner${suffix}-2560x1440`), "YouTube"],
    ]);
  });
  const shareFamilies = (["aurora", "bridge"] as const).map((surface) => {
    const suffix = surface === "bridge" ? "-bridge" : "";
    const name = surface === "bridge" ? "Bridge" : "Aurora";
    return familyCard(`Share cards · ${name}`, "For link previews and repository sharing.", socialFile(`share-card${suffix}-1200x630`), [
      [socialFile(`share-card${suffix}-1200x630`), "Link preview"],
      [socialFile(`github-social-preview${suffix}-1280x640`), "GitHub"],
    ]);
  });
  const instagram = familyCard("Instagram", "One composition in three formats: feed, portrait and story.", socialFile("instagram-square-1080x1080"), [
    [socialFile("instagram-square-1080x1080"), "Square"],
    [socialFile("instagram-portrait-1080x1350"), "Portrait"],
    [socialFile("instagram-story-1080x1920"), "Story"],
  ], true);
  const ads = where((f) => f.category === "display");
  const email = where((f) => f.category === "email");
  const covers = where((f) => f.category === "imagery");
  const banners = `<section class="section" id="banners" aria-labelledby="banners-title">
${sectionHead("banners", "Banners", "Each composition appears once. Pick your network or format below it to download the correctly sized file, without cropping the artwork yourself.")}
<h3 class="subhead">Social</h3>
<div class="grid grid--families">${socialFamilies.join("\n")}${shareFamilies.join("\n")}${instagram}</div>
<h3 class="subhead">Display ads</h3>
${familyCard("Display ads", "The gradient campaign, from mobile banners to billboards. Nine standard sizes.", byPath("files/banners/display/apysyk-ad-970x250.png"), ads.map((f) => [f, f.name]), true)}
<h3 class="subhead">Email signature</h3>
${familyCard("Email signature", "The same signature at standard and double resolution.", byPath("files/banners/email/apysyk-email-signature-1200x300.png"), email.map((f) => [f, f.width === 600 ? "Standard · 1×" : "Retina · 2×"]), true)}
<h3 class="subhead">Cover cards</h3>
${familyCard("Website covers", "Approved page-specific messages for Home, Platform and Solutions.", byPath("files/banners/imagery/apysyk-cover-home-1200x630.jpg"), covers.map((f) => [f, f.name.replace("Cover card: ", "")]), true)}
</section>`;

  // ---------- Wallpapers ----------
  const wallGroup = (category: string, title: string, note: string) => {
    const group = where((f) => f.category === category);
    // One card per variant, in the order the catalog renders them.
    const variants = [...new Set(group.map((f) => f.variant!))].map((variant) => {
      const list = group.filter((f) => f.variant === variant);
      // Preview: the most common size of the group.
      const preview = list.find((f) => f.width === 2560 && f.height === 1440) ?? list[0];
      return `<article class="card wall-card">
  <div class="preview preview--frame">${thumb(preview, `${title}, ${variant} variant preview`)}</div>
  <div class="wall-card__body">
    <h4 class="card__title">${variant[0].toUpperCase()}${variant.slice(1)}</h4>
    <ul class="sizes">${list.map((f) => `<li>${download(f, dims(f), `${title}, ${variant}, ${dims(f)} px`)}</li>`).join("")}</ul>
  </div>
</article>`;
    });
    return `<div class="wall-group wall-group--${category}">
  <div class="wall-group__head"><h3 class="subhead">${title}</h3><p class="body">${note}</p></div>
  <div class="grid grid--walls">${variants.join("\n")}</div>
</div>`;
  };
  const wallpapers = `<section class="section" id="wallpapers" aria-labelledby="wallpapers-title">
${sectionHead("wallpapers", "Wallpapers", "The stacked lockup in a soft glow, on five surfaces of the brand: Paper, Forest, the gradient, and two drawn in light on Forest, Aurora and Prism.")}
${wallGroup("desktop", "Desktop", "Common laptop and monitor resolutions, up to 5K and ultrawide.")}
${wallGroup("phone", "Phone", "The top stays clear for the clock, the bottom for the dock.")}
${wallGroup("tablet", "Tablet", "Portrait, for tablets such as the 10.9 and 12.9 inch iPad.")}
${wallGroup("video", "Video calls", "The center stays calm where you sit; the logo sits top left.")}
</section>`;

  // ---------- Downloads ----------
  const zipBlurb: Record<string, string> = {
    "apysyk-media-kit": "Every file on this page.",
    "apysyk-logos": "SVG sources, PNGs at 512, 1024 and 2048 px, and avatars.",
    "apysyk-banners": "Social, display ads, email signature and cover cards.",
    "apysyk-wallpapers": "Desktop, phone, tablet and video calls: light, forest, gradient, aurora, prism, lattice, lighthouse and bridge.",
    "apysyk-loading": "Seven animated versions of the mark, each for light and for dark surfaces, as self-contained SVG.",
  };
  const downloads = `<section class="section" id="downloads" aria-labelledby="downloads-title">
${sectionHead("downloads", "Downloads", "Everything in one archive, or one archive per group.")}
<ul class="zips">${where((f) => f.group === "downloads")
    .map((f) => {
      const slug = f.path.slice(f.path.lastIndexOf("/") + 1, -4);
      const main = slug === "apysyk-media-kit";
      return `<li class="card zip${main ? " zip--main" : ""}">
  <div class="zip__text"><h3 class="card__title">${esc(f.name)}</h3><p class="body">${zipBlurb[slug]} <span class="size">${f.contents!.length} files</span></p></div>
  ${download(f, `${slug}.zip`, f.name, main ? "button" : "button button--ghost")}
</li>`;
    })
    .join("\n")}</ul>
</section>`;

  // ---------- Generator ----------
  // Filled and driven by site/generator.ts: the selects get their options there, from the same lists the kit renders with.
  const generator = `<section class="section" id="generator" aria-labelledby="generator-title">
${sectionHead("generator", "Generator", "Pick a format and generate a banner or wallpaper on the spot. Every result is built from the kit's own surfaces, logo files and approved lines, in the browser, so it is on brand by construction. Download it as a file when you like it.")}
<div class="card generator" data-generator>
  <div class="generator__controls">
    <label class="generator__field"><span class="generator__label">Format</span><select class="generator__select" name="format"></select></label>
    <label class="generator__field"><span class="generator__label">Surface</span><select class="generator__select" name="surface"></select></label>
    <label class="generator__field"><span class="generator__label">Headline</span><select class="generator__select" name="headline"></select></label>
    <div class="generator__actions">
      <button class="button" type="button" data-generate>Generate</button>
      <button class="button button--ghost" type="button" data-download disabled>Download</button>
    </div>
  </div>
  <div class="generator__stage preview preview--frame" data-stage><p class="body generator__hint">Choose a format and press Generate. “Surprise me” picks a surface and a line at random, so every press is a new one.</p></div>
  <p class="size generator__caption" data-caption></p>
</div>
</section>`;

  // ---------- Contact ----------
  // The page's one deep band: Forest, with Lime for the accent.
  const contact = `<section class="section section--contact" id="contact" aria-labelledby="contact-title">
  <div class="band">
    <p class="kicker">Contact</p>
    <h2 class="headline" id="contact-title">Press and partnerships: <a href="mailto:${CONTACT}">${CONTACT}</a></h2>
  </div>
</section>`;

  const nav = SECTIONS.map(([id, label]) => `<li><a href="#${id}">${label}</a></li>`).join("");
  const everythingLabel = `(.zip, ${formatBytes(everything.bytes)})`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>Media kit · Risksquad</title>
<meta name="description" content="${esc(DESCRIPTION)}">
<link rel="canonical" href="${SITE_URL}">
<meta name="theme-color" content="${COLORS.paper}">
<meta name="color-scheme" content="light dark">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Risksquad">
<meta property="og:url" content="${SITE_URL}">
<meta property="og:title" content="Media kit · Risksquad">
<meta property="og:description" content="${esc(DESCRIPTION)}">
<meta property="og:image" content="${SITE_URL}og.png?v=${shareVersion}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Risksquad media kit">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="icon" href="favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="stylesheet" href="styles.css">
<script type="module" src="app.js"></script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="shell site-header__inner">
    <a class="brand" href="#top"><img class="brand__lockup brand__lockup--light" src="${lockup.path}" width="152" height="${lockupHeight(152)}" alt="Risksquad"><img class="brand__lockup brand__lockup--dark" src="${lockupDark.path}" width="152" height="${lockupHeight(152)}" alt="" aria-hidden="true"><span class="brand__kit">Media kit</span></a>
    <nav class="nav" aria-label="Sections"><ul class="nav__list">${nav}</ul></nav>
    <button class="theme-toggle" type="button" aria-pressed="false" aria-label="Dark mode">
      <svg class="theme-toggle__moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
      <svg class="theme-toggle__sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
    </button>
    <a class="button button--header" href="${everything.path}" download><span>Download <span class="button__wide">everything </span><span class="button__size">${everythingLabel}</span></span></a>
  </div>
</header>
<main id="main">
<section class="hero" id="top" aria-labelledby="hero-title">
  <div class="shell hero__inner">
    <p class="kicker hero__kicker">Risksquad media kit</p>
    <h1 class="hero__title" id="hero-title"><span>Brand</span> <em>assets.</em></h1>
    <p class="intro hero__lead">Everything here may be used to write about or refer to Risksquad and Apysyk OS, its product.</p>
    <figure class="hero__stage">
      <img class="hero__mark" src="${mark.path}" width="${markPng.width}" height="${markPng.height}" alt="The Risksquad mark" fetchpriority="high">
    </figure>
    <dl class="hero__stats">
      <div><dt>Logo files</dt><dd>${count((f) => f.group === "logos")}</dd></div>
      <div><dt>Loading files</dt><dd>${count((f) => f.group === "loading")}</dd></div>
      <div><dt>Banner files</dt><dd>${count((f) => f.group === "banners")}</dd></div>
      <div><dt>Wallpaper files</dt><dd>${count((f) => f.group === "wallpapers")}</dd></div>
      <div><dt>All files</dt><dd>${kitFiles.length}</dd></div>
    </dl>
  </div>
</section>
<div class="shell sections">
${about}
${logo}
${loading}
${color}
${typography}
${banners}
${wallpapers}
${downloads}
${generator}
${contact}
</div>
</main>
<footer class="site-footer">
  <div class="shell site-footer__inner">
    <p>${FOOTER}</p>
    <ul class="site-footer__links">
      <li><a href="https://apysyk.com/">apysyk.com</a></li>
      <li><a href="https://apysyk.com/privacy/">Privacy</a></li>
      <li>Font licenses: ${FONTS.map((f) => `<a href="${licenseLink(f)}">${esc(f.family)}</a>`).join(", ")}</li>
    </ul>
  </div>
</footer>
<p class="visually-hidden" id="copy-status" role="status" aria-live="polite"></p>
</body>
</html>
`;
}
