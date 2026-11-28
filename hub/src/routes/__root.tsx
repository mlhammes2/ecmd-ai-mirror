import { PsErrorsOnlyBox } from "../components/PsErrorsOnlyBox";
import "../lib/ecmdRuntimeBoot";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AppHeader } from "../components/layout/AppHeader";
import { reportLovableError } from "../lib/lovable-error-reporting";
import {
  installEcmdRuntimeErrorBridge,
  reportEcmdRuntimeError,
} from "../lib/ecmdLiveComponentTelemetry";

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
 * Inline DEV-only early error capture script injected in <head> BEFORE module scripts.
 * Catches ESM static linking SyntaxErrors and synchronous /plasmic-host iframe boot crashes
 * before any ES module body executes, forwarding them via relative fetch("/__ecmd-runtime-error").
 * Suppresses benign browser ResizeObserver loop notifications before any bubble listener sees them.
 */
export const ECMD_DEV_EARLY_ERROR_BRIDGE_SCRIPT = `(function(){
  if (typeof window === "undefined" || window.__ecmdEarlyErrorBridgeInstalled) return;
  window.__ecmdEarlyErrorBridgeInstalled = true;
  var sent = {};
  var BENIGN_RO_RE = /ResizeObserver loop (?:completed with undelivered notifications|(?:loop )?limit exceeded)/i;
  function isBenignRo(msg) {
    return BENIGN_RO_RE.test(String(msg || ""));
  }
  function sendErr(kind, message, source, line, col, stack) {
    try {
      var msg = String(message || "").trim().slice(0, 400);
      if (!msg || isBenignRo(msg)) return;
      var src = String(source || (window.location && window.location.pathname) || "unknown").slice(0, 260);
      var key = (msg + "::" + src).toLowerCase();
      var now = Date.now();
      if (sent[key] && now - sent[key] < 1500) return;
      sent[key] = now;
      var w = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 1440;
      var vp = w < 768 ? "mobile" : (w <= 1024 ? "tablet" : "desktop");
      var body = JSON.stringify({
        kind: kind,
        message: msg,
        source: src,
        line: typeof line === "number" ? line : null,
        column: typeof col === "number" ? col : null,
        stackPreview: String(stack || (msg + " at " + src)).slice(0, 700),
        url: (window.location && window.location.href) || "",
        artboardTag: vp + "-" + Math.round(w),
        viewportMode: vp,
        timestamp: new Date().toISOString()
      });
      fetch("/__ecmd-runtime-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        keepalive: true
      }).catch(function(){});
    } catch (e) {}
  }
  window.addEventListener("error", function(ev) {
    var err = ev && ev.error;
    var msg = (ev && ev.message) || (err && err.message) || "Uncaught runtime error";
    if (isBenignRo(msg)) {
      if (ev && typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
      if (ev && typeof ev.preventDefault === "function") ev.preventDefault();
      return;
    }
    if (window.__ecmdRuntimeErrorBridgeInstalled) return;
    var file = (ev && ev.filename) || (window.location && window.location.pathname) || "unknown";
    var src = ev && ev.lineno ? file + ":" + ev.lineno + (ev.colno ? ":" + ev.colno : "") : file;
    sendErr("error", msg, src, ev && ev.lineno, ev && ev.colno, err && err.stack);
  }, true);
  window.addEventListener("unhandledrejection", function(ev) {
    var r = ev && ev.reason;
    var msg = r && typeof r === "object" && r.message ? r.message : String(r || "Unhandled promise rejection");
    if (isBenignRo(msg)) {
      if (ev && typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
      if (ev && typeof ev.preventDefault === "function") ev.preventDefault();
      return;
    }
    if (window.__ecmdRuntimeErrorBridgeInstalled) return;
    var stack = r && typeof r === "object" && r.stack ? r.stack : msg;
    sendErr("unhandledrejection", msg, "unhandledrejection@" + ((window.location && window.location.pathname) || "/"), null, null, stack);
  }, true);
})();`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {typeof window !== "undefined" && (window.location.pathname.startsWith("/errors") || window.location.pathname.startsWith("/workflow")) && <PsErrorsOnlyBox />}
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    if (import.meta.env.DEV && !isBenignResizeObserverError(error)) {
      reportEcmdRuntimeError(error, "tanstack-root-error-boundary");
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    // Replace these placeholders with the app's name and description when first building the app.
    // Each content route, / included, must still set its own head(). Never add og:image or
    // twitter:image here: every page without its own would inherit the root's preview image.
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Emerald Coast Mobile Detailing" },
      { name: "description", content: "Emerald Coast Mobile Detailing (ECMD)" },
      { name: "author", content: "Emerald Coast Mobile Detailing" },
      { property: "og:title", content: "Emerald Coast Mobile Detailing" },
      { property: "og:description", content: "Emerald Coast Mobile Detailing (ECMD)" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head suppressHydrationWarning>
        <HeadContent />
        {import.meta.env.DEV && (
          <script
            id="ecmd-dev-early-error-bridge"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: ECMD_DEV_EARLY_ERROR_BRIDGE_SCRIPT }}
          />
        )}
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const isPlasmicHost = normalizedPath === "/plasmic-host";
  const isDevDashboardRoute =
    normalizedPath === "/workflow" || normalizedPath === "/errors";

  useEffect(() => {
    if (import.meta.env.DEV) {
      installEcmdRuntimeErrorBridge();
    }
  }, []);

  if (isPlasmicHost || !isDevDashboardRoute) {
    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <div className="flex min-h-screen flex-col bg-background bg-ambient">
        <AppHeader />
        <Outlet />
      </div>
    </QueryClientProvider>
  );
}
