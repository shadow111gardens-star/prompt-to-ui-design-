/** Copy with a focused-element fallback for embedded browsers that deny Clipboard API access. */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Embedded browsers may deny the modern API even on localhost.
  }
  const previous = document.activeElement as HTMLElement | null;
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("aria-label", "Clipboard transfer");
  field.style.cssText = "position:fixed;left:-10000px;top:0;opacity:0";
  // Keep the selection inside the active modal's focus trap.
  const modal = previous?.closest('[role="dialog"]');
  (modal || document.body).appendChild(field);
  try {
    field.focus();
    field.select();
    if (!document.execCommand("copy")) throw new Error("Clipboard access was denied. Use the download option instead.");
  } finally {
    field.remove();
    previous?.focus();
  }
}
