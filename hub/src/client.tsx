import { installPlasmicHostTsrRouterGuard } from "./lib/ecmdRuntimeBoot";
import { StrictMode, startTransition } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

export const ECMD_PLASMIC_HOST_ROOT_ID = "ecmd-plasmic-host-root";

export const BENIGN_RESIZE_OBSERVER_ERROR_RE =
  /ResizeObserver loop (?:completed with undelivered notifications|(?:loop )?limit exceeded)/i;

export function isBenignResizeObserverError(input: unknown): boolean {
  if (!input) return false;
  const msg =
    typeof input === "string"
      ? input
      : input instanceof Error
      ? input.message || input.name
      : typeof input === "object" && "message" in input
      ? String((input as { message?: unknown }).message || "")
      : String(input);
  return BENIGN_RESIZE_OBSERVER_ERROR_RE.test(msg);
}

/**
 * Installs a DEV capture-phase error listener that suppresses benign browser
 * ResizeObserver loop notifications before they reach /__ecmd-runtime-error.
 */
export function installBenignResizeObserverErrorGuard(
  win: Window | null | undefined = typeof window !== "undefined" ? window : undefined
): void {
  if (!import.meta.env.DEV || !win) return;
  const w = win as Window & { __ecmdResizeObserverGuardInstalled?: boolean };
  if (w.__ecmdResizeObserverGuardInstalled) return;
  w.__ecmdResizeObserverGuardInstalled = true;

  win.addEventListener(
    "error",
    (event: ErrorEvent) => {
      const msg = event?.message || (event?.error as { message?: unknown } | null)?.message || "";
      if (isBenignResizeObserverError(msg)) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true
  );
}

export function isPlasmicHostPathname(pathname?: string | null): boolean {
  return String(pathname || "").trim().toLowerCase().replace(/\/+$/, "") === "/plasmic-host";
}

/**
 * Mounts /plasmic-host purely client-side via createRoot into a dedicated container
 * instead of calling hydrateRoot(document, <StartClient />).
 *
 * Why: Plasmic Studio loads same-origin artboard iframes (/plasmic-host#canvas=true for
 * desktop-1440, tablet-*, mobile-413, mobile-430) where Studio's outer frame (studio.js),
 * #plasmic-app portals, Vite dev stylesheets, or browser extensions can mutate <head>/<body>
 * before React finishes hydrating the full document. Using createRoot on /plasmic-host
 * eliminates React 19 document-level hydration mismatches completely while preserving full
 * SSR hydration on every customer and dashboard route.
 */
export async function mountPlasmicHostClientOnly(
  doc: Document = document
): Promise<ReturnType<typeof createRoot>> {
  const win = doc.defaultView || (typeof window !== "undefined" ? window : undefined);
  installBenignResizeObserverErrorGuard(win);
  installPlasmicHostTsrRouterGuard(win as any);
  const { PlasmicHostPage } = await import("./pages/PlasmicHost");
  let container = doc.getElementById(ECMD_PLASMIC_HOST_ROOT_ID);
  if (!container) {
    container = doc.createElement("div");
    container.id = ECMD_PLASMIC_HOST_ROOT_ID;
    container.style.display = "contents";
    doc.body.appendChild(container);
  } else {
    container.replaceChildren();
  }
  const root = createRoot(container);
  root.render(<PlasmicHostPage />);
  return root;
}

export function bootstrapEcmdClient(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  installBenignResizeObserverErrorGuard(window);

  if (isPlasmicHostPathname(window.location.pathname)) {
    const win = window as Window & { __ecmdPlasmicHostBooted?: boolean };
    if (win.__ecmdPlasmicHostBooted) return;
    win.__ecmdPlasmicHostBooted = true;
    void mountPlasmicHostClientOnly(document);
    return;
  }

  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>
    );
  });
}

// Guard auto-boot under Vitest so unit tests can import helpers cleanly without side effects.
const isTestEnv =
  typeof import.meta !== "undefined" &&
  Boolean((import.meta as any).env?.VITEST || (globalThis as any).__vitest_worker__);

if (!isTestEnv) {
  bootstrapEcmdClient();
}
