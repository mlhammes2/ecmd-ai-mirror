import "./lib/ecmdRuntimeBoot";
import { StrictMode, startTransition } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

export const ECMD_PLASMIC_HOST_ROOT_ID = "ecmd-plasmic-host-root";

export function isPlasmicHostPathname(pathname?: string | null): boolean {
  return String(pathname || "").replace(/\/+$/, "") === "/plasmic-host";
}

/**
 * Mounts /plasmic-host purely client-side via createRoot into a dedicated container
 * instead of calling hydrateRoot(document, <StartClient />).
 *
 * Why: Plasmic Studio loads same-origin artboard iframes (/plasmic-host#canvas=true for
 * desktop-1440, tablet-*, mobile-413) where Studio's outer frame (studio.js), #plasmic-app
 * portals, Vite dev stylesheets, or browser extensions can mutate <head>/<body> before
 * React finishes hydrating the full document. Using createRoot on /plasmic-host eliminates
 * React 19 document-level hydration mismatches completely while preserving full SSR
 * hydration on every customer and dashboard route.
 */
export async function mountPlasmicHostClientOnly(
  doc: Document = document
): Promise<ReturnType<typeof createRoot>> {
  const { PlasmicHostPage } = await import("./pages/PlasmicHost");
  let container = doc.getElementById(ECMD_PLASMIC_HOST_ROOT_ID);
  if (!container) {
    container = doc.createElement("div");
    container.id = ECMD_PLASMIC_HOST_ROOT_ID;
    container.style.display = "contents";
    doc.body.appendChild(container);
  }
  const root = createRoot(container);
  root.render(<PlasmicHostPage />);
  return root;
}

export function bootstrapEcmdClient(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  if (isPlasmicHostPathname(window.location.pathname)) {
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
