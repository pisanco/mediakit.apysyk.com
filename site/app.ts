// The theme toggle, the copy buttons and the generator (site/generator.ts).
//
// Theme: a stored choice wins, otherwise the system preference. The toggle
// flips the page, remembers the choice and announces it. The page is light
// until this runs; the CSP allows no inline script to pick the theme earlier.
//
// Copy buttons: a button copies data-copy-value, or else the text of the
// element named by data-copy-target; data-copy-name says what it copies, for
// the announcement. When the browser refuses, the target text is selected so
// the visitor can copy it by hand.

import { mountGenerator } from "./generator.ts";

const announcer = document.getElementById("copy-status");
const timers = new WeakMap<HTMLButtonElement, number>();

async function writeClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Older or locked-down browsers: fall back to a selection copy.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.className = "visually-hidden";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    if (!ok) throw new Error("copy failed");
  }
}

/** Clears the live region first, so the same message twice in a row is announced twice. */
function announce(message: string): void {
  if (!announcer) return;
  announcer.textContent = "";
  window.setTimeout(() => {
    announcer.textContent = message;
  }, 50);
}

const THEME_KEY = "theme";
const toggle = document.querySelector<HTMLButtonElement>(".theme-toggle");
const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

function applyTheme(dark: boolean): void {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  toggle?.setAttribute("aria-pressed", String(dark));
  if (themeColor) themeColor.content = dark ? "#0c1a12" : "#f6f8f4";
}

function storedTheme(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

applyTheme(storedTheme() ? storedTheme() === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);

toggle?.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  applyTheme(dark);
  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch {
    // Private mode or a locked-down browser: the choice lasts for this page only.
  }
  announce(dark ? "Dark mode on" : "Dark mode off");
});

document.addEventListener("click", async (event) => {
  const button = (event.target as Element | null)?.closest<HTMLButtonElement>("button.copy");
  if (!button) return;
  const { copyTarget, copyValue, copyName } = button.dataset;
  const target = document.getElementById(copyTarget ?? "");
  const text = copyValue ?? target?.textContent?.trim();
  if (!text) return;
  const label = button.querySelector(".copy__label");
  try {
    await writeClipboard(text);
    if (label) label.textContent = "Copied";
    button.classList.add("is-copied");
    announce(`${copyName ?? "Text"} copied`);
  } catch {
    if (target) {
      const range = document.createRange();
      range.selectNodeContents(target);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    if (label) label.textContent = "Copy failed: select and copy";
    announce(`Copy failed: select and copy the ${copyName ?? "text"} by hand`);
  }
  clearTimeout(timers.get(button));
  timers.set(
    button,
    window.setTimeout(() => {
      if (label) label.textContent = "Copy";
      button.classList.remove("is-copied");
    }, 1800),
  );
});

mountGenerator(announce);
