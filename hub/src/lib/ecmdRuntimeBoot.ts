import { installEcmdRuntimeErrorBridge } from "./ecmdLiveComponentTelemetry";

/**
 * Ensures `window.__TSR_ROUTER__` has a safe `{ routesById: {} }` fallback on `/plasmic-host`
 * in DEV mode. Because `/plasmic-host` boots CSR via `createRoot(<PlasmicHostPage />)` without
 * mounting TanStack Router's `<StartClient />`, Vite HMR updates to route files
 * (`src/routes/__root.tsx`, `src/routes/errors.tsx`, `src/routes/workflow.tsx`) otherwise throw
 * `TypeError: Cannot read properties of undefined (reading 'routesById')` inside TanStack
 * Router's injected `handleRouteUpdate` hook.
 */
export function installPlasmicHostTsrRouterGuard(
  win: unknown = typeof window !== "undefined" ? window : undefined
): void {
  if (!import.meta.env.DEV || !win) return;
  try {
    const target = win as {
      location?: { pathname?: string };
      __TSR_ROUTER__?: { routesById?: Record<string, unknown> };
    };
    const pathname = String(target.location?.pathname || "")
      .trim()
      .toLowerCase()
      .replace(/\/+$/, "");
    if (pathname !== "/plasmic-host") return;
    if (!target.__TSR_ROUTER__) {
      target.__TSR_ROUTER__ = { routesById: {} };
    } else if (!target.__TSR_ROUTER__.routesById) {
      target.__TSR_ROUTER__.routesById = {};
    }
  } catch {
    // ignore cross-origin or restricted location access
  }
}

// Attach DEV global runtime error & unhandled rejection bridge before plasmic-init or routes evaluate
// so synchronous host-boot failures are always streamed to http://localhost:8080/errors.
if (import.meta.env.DEV) {
  installPlasmicHostTsrRouterGuard();
  installEcmdRuntimeErrorBridge();
}



