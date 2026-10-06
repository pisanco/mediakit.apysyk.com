// The media kit page, generated from the manifest so every preview, label and
// size on it is the real file's. Static HTML: no inline scripts or styles
// (the CSP forbids them); the copy buttons use app.js.

import { CONTACT, COPY, FOOTER, LONG_BOILERPLATE, PALETTE, SITE_URL, hexToRgb } from "./brand.ts";
import { LOGO_FILES } from "./catalog.ts";
import { FONTS, fontByFamily, type BrandFont } from "./fonts.ts";
import { LOCKUP_GEOMETRY } from "./logo-geometry.ts";
import { formatBytes, type Manifest, type ManifestFile } from "./manifest.ts";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'none'; object-src 'none'";

const DESCRIPTION =
  "The Apysyk media kit: logos, colors, typography, banners, wallpapers and approved descriptions, free to use when writing about or referring to Apysyk.";

const SECTIONS = [
  ["about", "About"],
  ["logo", "Logo"],
  ["color", "Color"],
  ["typography", "Typography"],
  ["banners", "Banners"],
  ["wallpapers", "Wallpapers"],
  ["downloads", "Downloads"],
  ["contact", "Contact"],
] as const;

const dims = (f: ManifestFile) => `${f.width} × ${f.height}`;

/** A download link; the hidden prefix names the file for screen readers, the data attributes state its size for the tests. */
function download(f: ManifestFile, visible: string, context: string, className = "dl"): string {
  const size = f.width ? ` data-width="${f.width}" data-height="${f.height}"` : "";
  return `<a class="${className}" href="${esc(f.path)}" download${size}><span class="visually-hidden">${esc(context)}, </span><span class="dl__label">${esc(visible)}</span> <span class="dl__meta">${formatBytes(f.bytes)}</span></a>`;
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

function sectionHead(id: string, eyebrow: string, title: string, lead: string): string {
  return `<header class="section__head">
  <p class="eyebrow">${esc(eyebrow)}</p>
  <h2 class="display display--l" id="${id}-title">${title}</h2>
  <p class="lead">${lead}</p>
</header>`;
}

export function renderPage(manifest: Manifest): string {
  const files = manifest.files;
  const byPath = (path: string) => {
    const f = files.find((x) => x.path === path);
    if (!f) throw new Error(`missing in manifest: ${path}`);
    return f;
  };
  const where = (pred: (f: ManifestFile) => boolean) => files.filter(pred);
  const zip = (slug: string) => byPath(`downloads/${slug}.zip`);
  const everything = zip("apysyk-media-kit");
  const kitFiles = files.filter((f) => ["logos", "banners", "wallpapers"].includes(f.group));
  const count = (pred: (f: ManifestFile) => boolean) => kitFiles.filter(pred).length;
  const mark = byPath("files/logos/svg/apysyk-mark.svg");

  // ---------- About ----------
  const boilerplates = [
    ["one-liner", "One-liner", COPY.oneLiner],
    ["short", "Short boilerplate", COPY.short],
    ["long", "Long boilerplate", LONG_BOILERPLATE],
  ]
    .map(
      ([id, title, text]) => `<article class="card copy-card">
  <div class="card__top"><h3 class="label">${title}</h3>${copyButton(`copy-${id}`, title)}</div>
  <p class="copy-card__text" id="copy-${id}">${esc(text)}</p>
</article>`,
    )
    .join("\n");
  const about = `<section class="section" id="about" aria-labelledby="about-title">
${sectionHead("about", "About", "About Apysyk", "Approved descriptions. Quote them as they are.")}
<div class="about">
  <div class="about__copy">${boilerplates}</div>
  <aside class="card facts" aria-labelledby="facts-title">
    <h3 class="label" id="facts-title">Quick facts</h3>
    <dl>
      <div><dt>Company</dt><dd>Apysyk</dd></div>
      <div><dt>Product</dt><dd>Apysyk OS</dd></div>
      <div><dt>Category</dt><dd>${COPY.category}</dd></div>
      <div><dt>Website</dt><dd><a href="https://apysyk.com/">apysyk.com</a></dd></div>
      <div><dt>Contact</dt><dd><a href="mailto:${CONTACT}">${CONTACT}</a></dd></div>
    </dl>
  </aside>
</div>
</section>`;

  // ---------- Logo ----------
  const logoCards = LOGO_FILES.map(({ file, name, background }) => {
    const base = `apysyk-${file.replace(/\.svg$/, "")}`;
    const svg = byPath(`files/logos/svg/${base}.svg`);
    const pngs = where((f) => f.category === "png" && new RegExp(`^files/logos/png/${base}-\\d+\\.png$`).test(f.path));
    const ref = pngs[0];
    const kind = file.startsWith("mark") ? "mark" : file.startsWith("wordmark") ? "wordmark" : "lockup";
    return `<article class="card logo-card">
  <div class="preview preview--${background} preview--${kind}"><img src="${svg.path}" width="${ref.width}" height="${ref.height}" alt="${esc(`Apysyk ${name.toLowerCase()}`)}" loading="lazy" decoding="async"></div>
  <div class="logo-card__body">
    <h3 class="card__title">${esc(name)}</h3>
    <div class="dl-row">${download(svg, "SVG", name)}${pngs.map((p) => download(p, `PNG ${p.width}`, `${name}, ${dims(p)} px`)).join("")}</div>
  </div>
</article>`;
  }).join("\n");
  const avatars = where((f) => f.category === "avatars")
    .map(
      (f) => `<article class="card asset-card">
  <div class="preview preview--frame">${thumb(f, `${f.name}: the Apysyk mark centered`, "preview__img preview__img--avatar")}</div>
  <div class="asset-card__body"><h4 class="card__title">${esc(f.name)}</h4><p class="size">${dims(f)} px</p>${download(f, "PNG", `${f.name}, ${dims(f)} px`)}</div>
</article>`,
    )
    .join("\n");
  const lockup = byPath("files/logos/svg/apysyk-lockup-on-dark.svg");
  const lockupPng = where((f) => f.path.startsWith("files/logos/png/apysyk-lockup-on-dark-"))[0];
  // Clear space x: the height of the cube's inner square, around the lockup's own viewBox.
  const { clearSpace: x, width: lw, height: lh } = LOCKUP_GEOMETRY;
  const n = (v: number) => Math.round(v * 100) / 100;
  const clearSpace = `<svg class="clearspace__svg" viewBox="${n(-x)} ${n(-x)} ${n(lw + 2 * x)} ${n(lh + 2 * x)}" role="img" aria-labelledby="clearspace-title">
  <title id="clearspace-title">Clear space: the height of the inner cube on every side of the lockup</title>
  <rect x="${n(-x)}" y="${n(-x)}" width="${n(lw + 2 * x)}" height="${n(lh + 2 * x)}" fill="#58a02d" fill-opacity="0.12"/>
  <rect x="${n(-x)}" y="${n(-x)}" width="${n(lw + 2 * x)}" height="${n(lh + 2 * x)}" fill="none" stroke="#6dbb3a" stroke-width="8" stroke-dasharray="36 28"/>
  <rect x="0" y="0" width="${lw}" height="${lh}" fill="#000"/>
  <image href="${lockup.path}" x="0" y="0" width="${lw}" height="${lh}"/>
  <g fill="#8ee05a" font-family="JetBrains Mono, monospace" font-size="120" text-anchor="middle">
    <text x="${n(-x / 2)}" y="${n(lh / 2 + 42)}">x</text><text x="${n(lw + x / 2)}" y="${n(lh / 2 + 42)}">x</text>
    <text x="${n(lw / 2)}" y="${n(-x / 2 + 42)}">x</text><text x="${n(lw / 2)}" y="${n(lh + x / 2 + 42)}">x</text>
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
      ([k, t]) => `<li class="dont"><div class="dont__demo dont__demo--${k}" aria-hidden="true"><img src="${mark.path}" width="62" height="63" alt="" loading="lazy" decoding="async"></div><p>${t}</p></li>`,
    )
    .join("");
  const logo = `<section class="section" id="logo" aria-labelledby="logo-title">
${sectionHead("logo", "Logo", "Logo", "A flat isometric cube and the lowercase wordmark. Use the files as supplied: full color on black or white, one color where color is not possible.")}
<div class="grid grid--logos">${logoCards}</div>
<h3 class="subhead">Avatars</h3>
<div class="grid grid--avatars">${avatars}</div>
<div class="rules">
  <article class="card rule">
    <h3 class="card__title">Clear space</h3>
    <p class="body">Keep free space around the logo equal to the height of the cube's inner square, <em>x</em>, on every side.</p>
    <div class="clearspace">${clearSpace}</div>
  </article>
  <article class="card rule">
    <h3 class="card__title">Minimum size</h3>
    <p class="body">Never smaller than 24 px tall for the mark, or 96 px wide for the lockup.</p>
    <div class="minsize">
      <figure><img class="minsize__mark" src="${mark.path}" width="24" height="24" alt="The mark at 24 px" loading="lazy"><figcaption class="size">Mark · 24 px</figcaption></figure>
      <figure><img class="minsize__lockup" src="${lockup.path}" width="96" height="${Math.round((96 * lockupPng.height!) / lockupPng.width!)}" alt="The lockup at 96 px wide" loading="lazy"><figcaption class="size">Lockup · 96 px</figcaption></figure>
    </div>
  </article>
</div>
<h3 class="subhead">Don't</h3>
<ul class="donts">${donts}</ul>
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
${sectionHead("color", "Color", "Color", "Black first, green for signal. Copy the values exactly.")}
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
${sectionHead("typography", "Typography", "Typography", "Three open-source families from GitHub and JetBrains, all free under the SIL Open Font License. Get them from their official sources.")}
<div class="type">
  <article class="card specimen specimen--hubot">
    <div class="specimen__meta"><h3 class="card__title">Hubot Sans</h3><p class="size">${axesLabel(hubot, "Display")}</p></div>
    <p class="specimen__sample specimen__sample--display">The OS for modern <em>cybersecurity work.</em></p>
    <p class="body">Headlines: weight 700, slightly wide, tight tracking and leading. The wordmark is Hubot Sans 700 at its default width.</p>
    <p class="specimen__links">${sourceLink(hubot)} · <a href="${licenseLink(hubot)}">License</a></p>
  </article>
  <article class="card specimen specimen--mona">
    <div class="specimen__meta"><h3 class="card__title">Mona Sans</h3><p class="size">${axesLabel(mona, "Text")}</p></div>
    <p class="specimen__sample specimen__sample--text">${esc(COPY.oneLiner)}</p>
    <p class="body">Body copy, buttons and interface text.</p>
    <p class="specimen__links">${sourceLink(mona)} · <a href="${licenseLink(mona)}">License</a></p>
  </article>
  <article class="card specimen specimen--mono">
    <div class="specimen__meta"><h3 class="card__title">JetBrains Mono</h3><p class="size">${axesLabel(jet, "Labels")}</p></div>
    <p class="specimen__sample specimen__sample--mono">${esc(COPY.category)}</p>
    <p class="body">Small uppercase labels with wide tracking.</p>
    <p class="specimen__links">${sourceLink(jet)} · <a href="${licenseLink(jet)}">License</a></p>
  </article>
</div>
<p class="body type__credits">${FONTS.map((f) => `${esc(f.family)}: ${esc(f.copyright)}.`).join(" ")} Licensed under the <a href="https://openfontlicense.org/">SIL Open Font License 1.1</a>.</p>
</section>`;

  // ---------- Banners ----------
  // Very wide covers take two columns, so they preview larger and the grid closes without gaps;
  // leaderboards are marked so phones can give them a tile of their own shape.
  const cardClass = (f: ManifestFile) => {
    const ratio = f.width! / f.height!;
    if (f.category === "social" && ratio > 3) return " asset-card--span";
    if (f.category === "display" && ratio > 3) return " asset-card--strip";
    return "";
  };
  const assetCard = (f: ManifestFile) => `<article class="card asset-card${cardClass(f)}">
  <div class="preview preview--fit">${thumb(f, `${f.name}, ${dims(f)} px preview`)}</div>
  <div class="asset-card__body"><h4 class="card__title">${esc(f.name)}</h4><p class="size">${dims(f)} px</p>${download(f, f.format.toUpperCase(), `${f.name}, ${dims(f)} px`)}</div>
</article>`;
  const banners = `<section class="section" id="banners" aria-labelledby="banners-title">
${sectionHead("banners", "Banners", "Banners", "Covers and posts for every network, standard display ads and an email signature, each at its exact size.")}
<h3 class="subhead">Social</h3>
<div class="grid grid--social">${where((f) => f.category === "social").map(assetCard).join("\n")}</div>
<h3 class="subhead">Display ads</h3>
<div class="grid grid--ads">${where((f) => f.category === "display").map(assetCard).join("\n")}</div>
<h3 class="subhead">Email signature</h3>
<div class="grid grid--email">${where((f) => f.category === "email").map(assetCard).join("\n")}</div>
<h3 class="subhead">Cover cards</h3>
<div class="grid grid--covers">${where((f) => f.category === "imagery").map(assetCard).join("\n")}</div>
</section>`;

  // ---------- Wallpapers ----------
  const wallGroup = (category: string, title: string, note: string) => {
    const variants = ["dark", "green"].map((variant) => {
      const list = where((f) => f.category === category && f.variant === variant);
      // Preview: the most common size of the group.
      const preview = list.find((f) => f.width === 2560 && f.height === 1440) ?? list[0];
      const label = `${variant[0].toUpperCase()}${variant.slice(1)}`;
      return `<article class="card wall-card">
  <div class="preview preview--frame">${thumb(preview, `${title}, ${variant} variant preview`)}</div>
  <div class="wall-card__body">
    <h4 class="card__title">${label}</h4>
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
${sectionHead("wallpapers", "Wallpapers", "Wallpapers", "Quiet backgrounds in two variants: black with the lattice and its glow, or deep green lit with the brand green from the lattice's glow.")}
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
    "apysyk-wallpapers": "Desktop, phone, tablet and video calls, dark and green.",
  };
  const downloads = `<section class="section" id="downloads" aria-labelledby="downloads-title">
${sectionHead("downloads", "Downloads", "Downloads", "Everything in one archive, or one archive per group.")}
<ul class="zips">${where((f) => f.group === "downloads")
    .map((f) => {
      const slug = f.path.slice(f.path.lastIndexOf("/") + 1, -4);
      return `<li class="zip${slug === "apysyk-media-kit" ? " zip--main" : ""}">
  <div><h3 class="card__title">${esc(f.name)}</h3><p class="body">${zipBlurb[slug]} <span class="size">${f.contents!.length} files</span></p></div>
  ${download(f, `${slug}.zip`, f.name, slug === "apysyk-media-kit" ? "button" : "button button--ghost")}
</li>`;
    })
    .join("\n")}</ul>
</section>`;

  // ---------- Contact ----------
  const contact = `<section class="section section--contact" id="contact" aria-labelledby="contact-title">
  <p class="eyebrow">Contact</p>
  <h2 class="display display--xl" id="contact-title">Press and partnerships: <a href="mailto:${CONTACT}">${CONTACT}</a></h2>
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
<title>Media kit · Apysyk</title>
<meta name="description" content="${esc(DESCRIPTION)}">
<link rel="canonical" href="${SITE_URL}">
<meta name="theme-color" content="#000000">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Apysyk">
<meta property="og:url" content="${SITE_URL}">
<meta property="og:title" content="Media kit · Apysyk">
<meta property="og:description" content="${esc(DESCRIPTION)}">
<meta property="og:image" content="${SITE_URL}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Apysyk media kit">
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
    <a class="brand" href="#top"><img class="brand__mark" src="${mark.path}" width="17" height="17" alt="">apysyk<span class="brand__kit">Media kit</span></a>
    <nav class="nav" aria-label="Sections"><ul class="nav__list">${nav}</ul></nav>
    <a class="button button--header" href="${everything.path}" download><span>Download <span class="button__wide">everything </span>${everythingLabel}</span></a>
  </div>
</header>
<main id="main">
<section class="hero" id="top" aria-labelledby="hero-title">
  <img class="hero__art" src="hero.webp" width="1600" height="1100" alt="" fetchpriority="high">
  <div class="shell hero__inner">
    <p class="eyebrow eyebrow--dot">Media kit</p>
    <h1 class="display display--cover" id="hero-title">Apysyk <em>brand assets.</em></h1>
    <p class="lead">Everything here may be used to write about or refer to Apysyk.</p>
    <dl class="hero__stats">
      <div><dt>Logo files</dt><dd>${count((f) => f.group === "logos")}</dd></div>
      <div><dt>Banner files</dt><dd>${count((f) => f.group === "banners")}</dd></div>
      <div><dt>Wallpaper files</dt><dd>${count((f) => f.group === "wallpapers")}</dd></div>
      <div><dt>All files</dt><dd>${kitFiles.length}</dd></div>
    </dl>
  </div>
</section>
<div class="shell sections">
${about}
${logo}
${color}
${typography}
${banners}
${wallpapers}
${downloads}
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
