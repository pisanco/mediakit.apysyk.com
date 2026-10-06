// Copy buttons. A button copies data-copy-value, or else the text of the
// element named by data-copy-target; data-copy-name says what it copies, for
// the announcement. When the browser refuses, the target text is selected so
// the visitor can copy it by hand.

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
