/**
 * Zero-Specificity Root Sizing Defaults (Zero-Inline-Width Root Law).
 *
 * Uses CSS `:where(...)` (specificity 0,0,0) so every registered Plasmic layout
 * code component defaults cleanly to `width: 100%; box-sizing: border-box;`
 * while allowing ANY Plasmic Studio Design -> Size / Max Width / Min Width /
 * Margin / Align class (specificity >= 0,1,0) to win 100% of the time without
 * inline `style={{ width: "100%" }}` specificity battles.
 */
export const ECMD_ROOT_SIZING_STYLE_ID = "ecmd-root-sizing-defaults";

export const ECMD_ROOT_SIZING_CSS = `
:where(.ecmd-packages-repeater-root),
:where(.ecmd-packages-repeater-container),
:where(.ecmd-vehicle-selector-root),
:where(.ecmd-vehicle-selector),
:where(.ecmd-saved-vehicle-dropdown-root),
:where(.ecmd-whats-included-modal-root),
:where(.ecmd-hq-weekly-strip-root),
:where(.ecmd-hq-daily-dispatch-root),
:where(.ecmd-hq-invoice-card-root),
:where(.ecmd-hq-workspace-root) {
  width: 100%;
  box-sizing: border-box;
}

@keyframes ecmd-vehicle-drop-pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.06);
  }
}

.ecmd-vehicle-drop-pulse {
  animation: ecmd-vehicle-drop-pulse 520ms ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .ecmd-vehicle-drop-pulse {
    animation: none !important;
    transform: none !important;
  }
}

:where(.ecmd-packages-repeater-root[data-ecmd-orientation="vertical"] > .ecmd-package-card),
:where(.ecmd-packages-repeater-root[data-ecmd-orientation="grid"] > .ecmd-package-card) {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

:where(.ecmd-packages-repeater-root > .ecmd-package-card[data-ecmd-slot-wrapper="transparent"]),
:where(.ecmd-vehicle-selector-root > .ecmd-vehicle-slot[data-ecmd-slot-wrapper="transparent"]) {
  background: transparent;
  background-color: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}

:where(.ecmd-packages-repeater-root > .ecmd-package-card > *) {
  max-width: 100%;
  box-sizing: border-box;
}

:where(.ecmd-vehicle-slot) {
  box-sizing: border-box;
}
`.trim();

export function ensureEcmdRootSizingStyles(targetDoc?: Document | null): void {
  const doc = targetDoc ?? (typeof document !== "undefined" ? document : null);
  if (!doc || !doc.head) return;
  let styleEl = doc.getElementById(ECMD_ROOT_SIZING_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    const existingStyles = Array.from(doc.head.querySelectorAll("style"));
    styleEl = doc.createElement("style");
    styleEl.id = ECMD_ROOT_SIZING_STYLE_ID;
    styleEl.textContent = ECMD_ROOT_SIZING_CSS;
    // Insert at the very top of <head> so both zero-specificity :where(...) AND source order
    // guarantee Plasmic Studio Design -> Width / Max Width / Margin classes always win.
    if (doc.head.firstChild) {
      doc.head.insertBefore(styleEl, doc.head.firstChild);
    } else {
      doc.head.appendChild(styleEl);
    }
    // JSDOM tracks StyleSheetList in insertion-event order rather than DOM order and does not
    // zero out :where() specificity; preserve DOM cascade order in JSDOM test environments only.
    if (
      existingStyles.length > 0 &&
      typeof navigator !== "undefined" &&
      /jsdom/i.test(navigator.userAgent || "")
    ) {
      for (const s of existingStyles) {
        if (s !== styleEl && s.parentNode === doc.head) {
          doc.head.appendChild(s);
        }
      }
    }
  } else if (styleEl.textContent !== ECMD_ROOT_SIZING_CSS) {
    styleEl.textContent = ECMD_ROOT_SIZING_CSS;
  }
}

// Note: Do NOT mutate document.head at module evaluation time!
// TanStack Start hydrates the full <html>/<head>/<body> document in React 19;
// injecting <style> before hydrateRoot() causes SSR/client hydration mismatches on /plasmic-host.
// Base defaults are already loaded via src/styles.css, and ensureEcmdRootSizingStyles() runs
// inside component useIsomorphicLayoutEffect after hydration completes.
