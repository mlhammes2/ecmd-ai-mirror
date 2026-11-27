import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor, act } from "@testing-library/react";
import fs from "fs";
import path from "path";
import { ALLOWED_PLASMIC_TOKEN_TYPES } from "../lib/ecmdLiveComponentTelemetry";

describe("/plasmic-host Boot & Cross-Origin Studio Iframe Handshake", () => {
  const origTopDesc = Object.getOwnPropertyDescriptor(window, "top");
  const origParentDesc = Object.getOwnPropertyDescriptor(window, "parent");
  const origHash = window.location.hash;

  beforeEach(() => {
    // Clean any injected studio script or plasmic-app container between tests
    document.getElementById("plasmic-studio-script")?.remove();
    document.getElementById("plasmic-app")?.remove();
    document.getElementById("plasmic-hide-host-overlays")?.remove();
  });

  afterEach(() => {
    cleanup();
    if (origTopDesc) {
      Object.defineProperty(window, "top", origTopDesc);
    }
    if (origParentDesc) {
      Object.defineProperty(window, "parent", origParentDesc);
    }
    window.location.hash = origHash;
    vi.restoreAllMocks();
  });

  it("imports src/plasmic-init.ts with ZERO uncaught errors, ZERO console.errors, and 0 invalid token registrations", async () => {
    const uncaughtErrors: unknown[] = [];
    const onError = (ev: ErrorEvent) => uncaughtErrors.push(ev.error || ev.message);
    const onRejection = (ev: PromiseRejectionEvent) => uncaughtErrors.push(ev.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const plasmicInitSource = fs.readFileSync(
        path.join(__dirname, "../plasmic-init.ts"),
        "utf-8"
      );
      const codeOnly = plasmicInitSource
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");

      // Must NOT call non-existent registerDataToken or invalid registerToken(type: "string")
      expect(codeOnly).not.toMatch(/\bregisterDataToken\s*\(/);
      expect(codeOnly).not.toMatch(/\bregisterToken\s*\(/);

      const { PLASMIC } = await import("../plasmic-init");
      expect(PLASMIC).toBeDefined();
      expect(typeof PLASMIC.registerComponent).toBe("function");

      const compRegistry: Array<{ meta?: { name?: string } }> = Array.isArray(
        (window as any).__PlasmicComponentRegistry
      )
        ? (window as any).__PlasmicComponentRegistry
        : [];
      expect(compRegistry.length).toBeGreaterThanOrEqual(12);

      const tokenRegistry: Array<{ name?: string; type?: string }> = Array.isArray(
        (window as any).__PlasmicTokenRegistry
      )
        ? (window as any).__PlasmicTokenRegistry
        : [];
      for (const token of tokenRegistry) {
        expect(ALLOWED_PLASMIC_TOKEN_TYPES.has(token.type as any)).toBe(true);
        expect(String(token.name || "")).not.toMatch(/^ecmdImgClass_/);
      }

      const ctxRegistry: Array<{ meta?: { name?: string } }> = Array.isArray(
        (window as any).__PlasmicContextRegistry
      )
        ? (window as any).__PlasmicContextRegistry
        : [];
      expect(ctxRegistry.some((c) => c?.meta?.name === "EcmdDeviceGlobalContext")).toBe(true);

      expect(uncaughtErrors).toEqual([]);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    }
  });

  it("mounts <PlasmicHostPage /> cleanly inside a simulated cross-origin studio.plasmic.app iframe without throwing SecurityError or console.error", async () => {
    const uncaughtErrors: unknown[] = [];
    const onError = (ev: ErrorEvent) => uncaughtErrors.push(ev.error || ev.message);
    const onRejection = (ev: PromiseRejectionEvent) => uncaughtErrors.push(ev.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Simulate cross-origin iframe: window.top !== window and window.parent !== window,
    // and reading properties on cross-origin window.top/window.parent throws SecurityError.
    const crossOriginFrameProxy = new Proxy(
      {},
      {
        get(_target, prop) {
          // Real browser CrossOriginWindow allows symbol inspection / postMessage / closed / self / top / parent
          // and throws SecurityError on cross-origin string properties like document, location.href, EyeDropper, etc.
          if (typeof prop === "symbol") return undefined;
          if (prop === "postMessage") return () => {};
          throw new DOMException(
            `Blocked a frame with origin "http://localhost:8080" from accessing a cross-origin frame (prop: ${String(prop)}).`,
            "SecurityError"
          );
        },
      }
    );

    Object.defineProperty(window, "top", {
      configurable: true,
      get: () => crossOriginFrameProxy,
    });
    Object.defineProperty(window, "parent", {
      configurable: true,
      get: () => crossOriginFrameProxy,
    });
    window.location.hash = "#origin=https%3A%2F%2Fstudio.plasmic.app";

    try {
      const { PlasmicHostPage } = await import("../pages/PlasmicHost");
      expect(window.top !== window).toBe(true);
      expect(window.parent !== window).toBe(true);

      expect(() => {
        render(<PlasmicHostPage />);
      }).not.toThrow();

      // PlasmicCanvasHost defers mounting _PlasmicCanvasHost until after client hydration effect;
      // waitFor ensures the nested effect runs and injects Studio's script tag cleanly inside the iframe.
      await waitFor(() => {
        const studioScript = document.getElementById("plasmic-studio-script") as HTMLScriptElement | null;
        expect(studioScript).not.toBeNull();
        expect(studioScript?.src).toBe("https://studio.plasmic.app/js/studio.js");
      });

      expect(uncaughtErrors).toEqual([]);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    }
  });

  it("mounts <PlasmicHostPage /> cleanly in #canvas=true artboard mode and forwards iframe runtime errors via relative /__ecmd-runtime-error", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    window.location.hash = "#canvas=true";

    try {
      const { PlasmicHostPage } = await import("../pages/PlasmicHost");
      expect(() => {
        render(<PlasmicHostPage />);
      }).not.toThrow();

      // In #canvas=true mode, PlasmicCanvasHost creates #plasmic-app.__wab_user-body cleanly
      const plasmicApp = document.getElementById("plasmic-app");
      expect(plasmicApp).not.toBeNull();
      expect(plasmicApp?.classList.contains("__wab_user-body")).toBe(true);
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      // Verify runtime errors inside /plasmic-host forward via relative /__ecmd-runtime-error
      const { installEcmdRuntimeErrorBridge } = await import("../lib/ecmdLiveComponentTelemetry");
      installEcmdRuntimeErrorBridge();

      window.dispatchEvent(
        new ErrorEvent("error", {
          message: "Simulated /plasmic-host iframe crash probe",
          filename: "/src/plasmic-init.ts",
          lineno: 42,
          colno: 7,
          error: new Error("Simulated /plasmic-host iframe crash probe"),
        })
      );

      expect(fetchSpy).toHaveBeenCalled();
      const call = fetchSpy.mock.calls.find(([url]) =>
        String(url).includes("/__ecmd-runtime-error")
      );
      expect(call).toBeDefined();
      const [endpoint, init] = call!;
      // On localhost jsdom/dev host, relative "/__ecmd-runtime-error" is used
      expect(String(endpoint)).toMatch(/^(\/__ecmd-runtime-error|http:\/\/localhost:8080\/__ecmd-runtime-error)$/);
      const payload = JSON.parse(String((init as RequestInit)?.body || "{}"));
      expect(payload.message).toContain("Simulated /plasmic-host iframe crash probe");
      expect(payload.source).toContain("/src/plasmic-init.ts:42:7");
    } finally {
      fetchSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });

  it("disables SSR on /plasmic-host route and mounts purely client-side via createRoot in src/client.tsx to prevent mobile-413 hydration mismatches", async () => {
    const routeSource = fs.readFileSync(
      path.join(__dirname, "../routes/plasmic-host.tsx"),
      "utf-8"
    );
    expect(routeSource).toMatch(/\bssr\s*:\s*false\b/);

    const clientSource = fs.readFileSync(path.join(__dirname, "../client.tsx"), "utf-8");
    expect(clientSource).toContain("createRoot");
    expect(clientSource).toContain("isPlasmicHostPathname");

    const { isPlasmicHostPathname, mountPlasmicHostClientOnly, ECMD_PLASMIC_HOST_ROOT_ID } =
      await import("../client");

    expect(isPlasmicHostPathname("/plasmic-host")).toBe(true);
    expect(isPlasmicHostPathname("/plasmic-host/")).toBe(true);
    expect(isPlasmicHostPathname("/")).toBe(false);
    expect(isPlasmicHostPathname("/errors")).toBe(false);

    // Simulate Studio / extension pre-injected nodes in document.body on mobile-413
    const extNode = document.createElement("div");
    extNode.id = "simulated-extension-or-studio-node";
    document.body.prepend(extNode);
    window.location.hash = "#canvas=true&componentName=Homepage";

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let mountedRoot: Awaited<ReturnType<typeof mountPlasmicHostClientOnly>> | null = null;
    try {
      await act(async () => {
        mountedRoot = await mountPlasmicHostClientOnly(document);
      });
      await waitFor(() => {
        expect(document.getElementById(ECMD_PLASMIC_HOST_ROOT_ID)).not.toBeNull();
        expect(document.getElementById("plasmic-app")).not.toBeNull();
      });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      if (mountedRoot) {
        await act(async () => {
          mountedRoot!.unmount();
        });
      }
      extNode.remove();
      document.getElementById(ECMD_PLASMIC_HOST_ROOT_ID)?.remove();
      consoleErrorSpy.mockRestore();
    }
  });

  it("renders a deterministic #ecmd-plasmic-host-root container on /plasmic-host and keeps suppressHydrationWarning in __root.tsx for mobile-430", async () => {
    const routeSource = fs.readFileSync(
      path.join(__dirname, "../routes/plasmic-host.tsx"),
      "utf-8"
    );
    expect(routeSource).toMatch(/\bssr\s*:\s*false\b/);
    expect(routeSource).toContain("ecmd-plasmic-host-root");
    expect(routeSource).toContain("pendingComponent");

    const rootSource = fs.readFileSync(
      path.join(__dirname, "../routes/__root.tsx"),
      "utf-8"
    );
    expect(rootSource).toMatch(/<html[^>]*suppressHydrationWarning/);
    expect(rootSource).toMatch(/<head[^>]*suppressHydrationWarning/);
    expect(rootSource).toMatch(/<body[^>]*suppressHydrationWarning/);

    // Pre-populate #ecmd-plasmic-host-root as SSR pendingComponent does on mobile-430
    const ssrContainer = document.createElement("div");
    ssrContainer.id = "ecmd-plasmic-host-root";
    ssrContainer.style.display = "contents";
    document.body.appendChild(ssrContainer);

    const { mountPlasmicHostClientOnly, ECMD_PLASMIC_HOST_ROOT_ID } = await import("../client");
    window.location.hash = "#canvas=true&componentName=Homepage";

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let mountedRoot: Awaited<ReturnType<typeof mountPlasmicHostClientOnly>> | null = null;
    try {
      await act(async () => {
        mountedRoot = await mountPlasmicHostClientOnly(document);
      });
      await waitFor(() => {
        expect(document.getElementById(ECMD_PLASMIC_HOST_ROOT_ID)).toBe(ssrContainer);
        expect(document.getElementById("plasmic-app")).not.toBeNull();
      });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      if (mountedRoot) {
        await act(async () => {
          mountedRoot!.unmount();
        });
      }
      ssrContainer.remove();
      consoleErrorSpy.mockRestore();
    }
  });

  it("suppresses benign ResizeObserver loop error notifications in DEV bridges without blocking real runtime errors", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const {
      isBenignResizeObserverError,
      installBenignResizeObserverErrorGuard,
    } = await import("../client");
    const {
      ECMD_DEV_EARLY_ERROR_BRIDGE_SCRIPT,
      isBenignResizeObserverError: isBenignRootRoError,
    } = await import("../routes/__root");

    expect(
      isBenignResizeObserverError("ResizeObserver loop completed with undelivered notifications.")
    ).toBe(true);
    expect(isBenignResizeObserverError("ResizeObserver loop limit exceeded")).toBe(true);
    expect(isBenignResizeObserverError("ResizeObserver loop loop limit exceeded")).toBe(true);
    expect(isBenignRootRoError("ResizeObserver loop completed with undelivered notifications.")).toBe(
      true
    );
    expect(isBenignResizeObserverError("TypeError: Cannot read properties of undefined")).toBe(
      false
    );
    expect(ECMD_DEV_EARLY_ERROR_BRIDGE_SCRIPT).toContain("ResizeObserver loop");

    // Reset guard flag and verify capture-phase listener suppresses ResizeObserver errors
    // before any downstream bubble listener forwards to /__ecmd-runtime-error
    delete (window as any).__ecmdResizeObserverGuardInstalled;
    installBenignResizeObserverErrorGuard(window);

    let downstreamCalled = false;
    const downstreamListener = (ev: ErrorEvent) => {
      if (String(ev.message || "").includes("ResizeObserver")) {
        downstreamCalled = true;
      }
    };
    window.addEventListener("error", downstreamListener);

    try {
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: "ResizeObserver loop completed with undelivered notifications.",
          cancelable: true,
        })
      );
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: "ResizeObserver loop limit exceeded",
          cancelable: true,
        })
      );

      expect(downstreamCalled).toBe(false);
      const roFetchCalls = fetchSpy.mock.calls.filter(([url, init]) => {
        if (!String(url).includes("/__ecmd-runtime-error")) return false;
        const body = String((init as RequestInit)?.body || "");
        return body.includes("ResizeObserver");
      });
      expect(roFetchCalls).toHaveLength(0);
    } finally {
      window.removeEventListener("error", downstreamListener);
      fetchSpy.mockRestore();
    }
  });
});
