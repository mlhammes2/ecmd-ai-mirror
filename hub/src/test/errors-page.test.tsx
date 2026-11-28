import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Errors from "../pages/Errors";
import { AppHeader } from "../components/layout/AppHeader";
import {
  applyDismissAction,
  buildTelemetryPayloads,
  createDiagnosticsRuntimeState,
  handleComponentUnmount,
  ingestLiveDomSnapshot,
} from "../lib/ecmdDiagnosticsStore";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...rest }: any) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

describe("Unified /errors Page (#ecmd-unified-errors-json)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("renders #ecmd-unified-errors-json aggregating compiler, desktop/tablet/mobile canvas, and runtime errors", async () => {
    const mockTelemetry = {
      refCode: "TURN-021",
      status: "NEEDS_ATTENTION",
      tscClean: false,
      tscOutput: "src/pages/Demo.tsx(12,5): error TS2322: Type 'number' is not assignable to type 'string'.",
      errorsSummary: "1 TypeScript compiler error",
      updatedAt: "2026-11-24T04:15:00.000Z",
    };

    const mockDiagnostics = {
      updatedAt: "2026-11-24T04:15:05.000Z",
      totalActive: 3,
      totalDismissed: 0,
      dismissedIds: [],
      diagnostics: [],
      activeDiagnostics: [
        {
          id: "hero::desktop-1440::broken_image::img-logo",
          code: "BROKEN_IMAGE",
          severity: "error",
          severityTier: "critical",
          breakpoint: "desktop",
          componentName: "EcmdBrandIcon",
          artboardTag: "desktop-1440",
          viewportMode: "desktop",
          element: "img.hero-logo",
          message: "Broken image detected on desktop",
          fixHint: "Use valid inline SVG or uploaded image asset.",
          detectedAt: "2026-11-24T04:15:01.000Z",
        },
        {
          id: "pkg::tablet-834::horizontal_overflow::div-cards",
          code: "HORIZONTAL_OVERFLOW",
          severity: "warning",
          severityTier: "layout",
          breakpoint: "tablet",
          componentName: "EcmdPackagesRepeater",
          artboardTag: "tablet-834",
          viewportMode: "tablet",
          element: "div.cards-row",
          message: "Horizontal overflow detected (+24px)",
          fixHint: "Set tabletOrientation to grid or horizontal-scroll.",
          detectedAt: "2026-11-24T04:15:02.000Z",
        },
        {
          id: "pkg::mobile-413::collapsed_zero_size::div-badge",
          code: "COLLAPSED_ZERO_SIZE",
          severity: "warning",
          severityTier: "layout",
          breakpoint: "mobile",
          componentName: "EcmdPackagesRepeater",
          artboardTag: "mobile-413",
          viewportMode: "mobile",
          element: "div.badge-box",
          message: "Visible node has collapsed zero size (0x0px)",
          fixHint: "Check minHeight on mobile artboard.",
          detectedAt: "2026-11-24T04:15:03.000Z",
        },
      ],
    };

    const mockRuntimeErrors = {
      updatedAt: "2026-11-24T04:15:06.000Z",
      totalCount: 1,
      errors: [
        {
          id: "rt::abc123",
          kind: "unhandledrejection",
          message: "Failed to fetch pricing matrix",
          source: "src/components/EcmdPackagesRepeater.tsx:138",
          line: 138,
          column: 12,
          stackPreview: "Error: Failed to fetch pricing matrix\n  at fetchPackages",
          url: "http://localhost:8080/",
          artboardTag: "desktop-1440",
          viewportMode: "desktop",
          timestamp: "2026-11-24T04:15:06.000Z",
          count: 2,
        },
      ],
    };

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/ai-telemetry.json")) {
        return new Response(JSON.stringify(mockTelemetry), { status: 200 });
      }
      if (url.includes("/plasmic-diagnostics.json")) {
        return new Response(JSON.stringify(mockDiagnostics), { status: 200 });
      }
      if (url.includes("/runtime-errors.json")) {
        return new Response(JSON.stringify(mockRuntimeErrors), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }) as any;

    render(<Errors />);

    await waitFor(() => {
      const pre = document.getElementById("ecmd-unified-errors-json");
      expect(pre).not.toBeNull();
      const parsed = JSON.parse(pre!.textContent || "{}");
      expect(parsed.totalErrors).toBe(5); // 1 compiler + 3 canvas + 1 runtime
      expect(parsed.tscClean).toBe(false);
      expect(parsed.tscOutput).toContain("error TS2322");
      expect(parsed.criticalCanvasIssues).toHaveLength(1);
      expect(parsed.desktopIssues).toHaveLength(1);
      expect(parsed.tabletIssues).toHaveLength(1);
      expect(parsed.mobileIssues).toHaveLength(1);
      expect(parsed.runtimeErrors).toHaveLength(1);
      expect(parsed.runtimeErrors[0].message).toBe("Failed to fetch pricing matrix");
      expect(parsed.updatedAt).toBeTruthy();
    });

    // Verify 3-tier tabs switch displayed canvas diagnostics cleanly
    expect(screen.getByText("Broken image detected on desktop")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Tablet \(1\)/i }));
    expect(screen.getByText("Horizontal overflow detected (+24px)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Mobile \(1\)/i }));
    expect(screen.getByText("Visible node has collapsed zero size (0x0px)")).toBeInTheDocument();
  });

  it("renders dedicated PowerShell Errors & Terminal Output box and Copy PS Errors buttons reading /powershell-results.json separately", async () => {
    const mockPsResults = {
      updatedAt: "2026-11-27T18:05:00.000Z",
      source: "Deploy Check Script",
      exitCode: 1,
      summary: "1 script error detected",
      output: "Write-Error: Sample PowerShell failure line",
    };

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/powershell-results.json")) {
        return new Response(JSON.stringify(mockPsResults), { status: 200 });
      }
      if (url.includes("/ai-telemetry.json")) {
        return new Response(JSON.stringify({ tscClean: true, errorsSummary: "0 errors" }), { status: 200 });
      }
      if (url.includes("/plasmic-diagnostics.json")) {
        return new Response(JSON.stringify({ activeDiagnostics: [] }), { status: 200 });
      }
      if (url.includes("/runtime-errors.json")) {
        return new Response(JSON.stringify({ totalCount: 0, errors: [] }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }) as any;

    render(
      <>
        <AppHeader />
        <Errors />
      </>
    );

    await waitFor(() => {
      const box = document.getElementById("ecmd-ps-errors-output-box");
      expect(box).not.toBeNull();
      const textarea = document.getElementById("ps-only-output-textarea") as HTMLTextAreaElement | null;
      expect(textarea?.value).toContain("Sample PowerShell failure line");
      expect(textarea?.value).toContain("Exit Code: 1");
    });

    // Ensure #ecmd-unified-errors-json stays separate from PowerShell output
    const unified = document.getElementById("ecmd-unified-errors-json")?.textContent || "";
    expect(unified).not.toContain("Sample PowerShell failure line");

    // Verify top header Copy PS Errors button exists and copies formatted PowerShell results
    const topCopyBtn = document.getElementById("ecmd-top-bar-copy-ps-btn");
    expect(topCopyBtn).not.toBeNull();
    fireEvent.click(topCopyBtn!);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Sample PowerShell failure line"));
    });
  });

  it("persists dismissed items and cleared stale components cleanly across auto-poll and refreshes", async () => {
    const staleRepeaterDiag = {
      id: "ecmdpackagesrepeater::tablet-1020::collapsed_zero_size::div-packagesrep",
      code: "COLLAPSED_ZERO_SIZE" as const,
      severity: "warning" as const,
      severityTier: "layout" as const,
      breakpoint: "tablet" as const,
      componentName: "EcmdPackagesRepeater",
      artboardTag: "tablet-1020",
      viewportMode: "tablet" as const,
      element: "div#packagesRep",
      message: "Stale repeater collapsed size from unmounted canvas",
      fixHint: "Remove stale component",
      detectedAt: "2026-11-27T18:53:05.336Z",
    };

    const desktopDiag = {
      id: "ecmdbrandicon::desktop-1440::broken_image::img-logo",
      code: "BROKEN_IMAGE" as const,
      severity: "error" as const,
      severityTier: "critical" as const,
      breakpoint: "desktop" as const,
      componentName: "EcmdBrandIcon",
      artboardTag: "desktop-1440",
      viewportMode: "desktop" as const,
      element: "img.logo",
      message: "Broken brand icon image",
      fixHint: "Replace broken src",
      detectedAt: "2026-11-28T02:30:00.000Z",
    };

    // Simulate a static/lagging /plasmic-diagnostics.json that still returns both items on poll
    const staleServerDiagnostics = {
      updatedAt: "2026-11-28T02:35:02.484Z",
      totalActive: 2,
      totalDismissed: 0,
      dismissedIds: [],
      diagnostics: [desktopDiag, staleRepeaterDiag],
      activeDiagnostics: [desktopDiag, staleRepeaterDiag],
    };

    const dismissRequests: any[] = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/__ecmd-live-dom/dismiss")) {
        const body = JSON.parse(String(init?.body || "{}"));
        dismissRequests.push(body);
        return new Response(
          JSON.stringify({ ok: true, diagnostics: staleServerDiagnostics }),
          { status: 200 }
        );
      }
      if (url.includes("/ai-telemetry.json")) {
        return new Response(JSON.stringify({ tscClean: true, errorsSummary: "0 errors" }), { status: 200 });
      }
      if (url.includes("/plasmic-diagnostics.json")) {
        return new Response(JSON.stringify(staleServerDiagnostics), { status: 200 });
      }
      if (url.includes("/runtime-errors.json")) {
        return new Response(JSON.stringify({ totalCount: 0, errors: [] }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }) as any;

    render(<Errors />);

    await waitFor(() => {
      expect(screen.getByText("Broken brand icon image")).toBeInTheDocument();
    });

    // Dismiss the desktop diagnostic via UI
    fireEvent.click(screen.getByRole("button", { name: /^Dismiss$/i }));
    await waitFor(() => {
      expect(screen.queryByText("Broken brand icon image")).not.toBeInTheDocument();
    });

    // Switch to Tablet tab and clear stale EcmdPackagesRepeater component
    fireEvent.click(screen.getByRole("tab", { name: /Tablet \(1\)/i }));
    expect(screen.getByText("Stale repeater collapsed size from unmounted canvas")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Clear EcmdPackagesRepeater/i }));
    await waitFor(() => {
      expect(
        screen.queryByText("Stale repeater collapsed size from unmounted canvas")
      ).not.toBeInTheDocument();
    });

    // Trigger manual Refresh (same path as auto-poll) while server still serves old JSON
    fireEvent.click(screen.getAllByRole("button", { name: /Refresh/i })[0]!);

    await waitFor(() => {
      const pre = document.getElementById("ecmd-unified-errors-json");
      const parsed = JSON.parse(pre!.textContent || "{}");
      expect(parsed.totalErrors).toBe(0);
      expect(parsed.desktopIssues).toHaveLength(0);
      expect(parsed.tabletIssues).toHaveLength(0);
    });

    expect(dismissRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: desktopDiag.id }),
        expect.objectContaining({
          removeComponent: "EcmdPackagesRepeater",
          artboardTag: "tablet-1020",
        }),
      ])
    );

    // Restore Dismissed brings dismissed items back when requested
    fireEvent.click(screen.getByRole("button", { name: /Restore Dismissed/i }));
    fireEvent.click(screen.getByRole("tab", { name: /Desktop/i }));
    await waitFor(() => {
      expect(screen.getByText("Broken brand icon image")).toBeInTheDocument();
    });
  });

  it("ecmdDiagnosticsStore keeps user dismissals across transient snapshots, prunes stale non-mounted entries, and handles unmount + rescan", () => {
    const nowMs = Date.parse("2026-11-28T02:35:00.000Z");
    const staleIso = "2026-11-27T18:53:05.000Z"; // > 7 hours old
    const freshIso = "2026-11-28T02:34:30.000Z"; // 30s old

    const state = createDiagnosticsRuntimeState(
      {
        updatedAt: freshIso,
        entries: {
          "EcmdPackagesRepeater::tablet-1020": {
            key: "EcmdPackagesRepeater::tablet-1020",
            componentName: "EcmdPackagesRepeater",
            artboardTag: "tablet-1020",
            updatedAt: staleIso,
            diagnostics: [
              {
                id: "ecmdpackagesrepeater::tablet-1020::collapsed_zero_size::root",
                code: "COLLAPSED_ZERO_SIZE",
                severity: "warning",
                severityTier: "layout",
                breakpoint: "tablet",
                componentName: "EcmdPackagesRepeater",
                artboardTag: "tablet-1020",
                viewportMode: "tablet",
                element: "div#packagesRep",
                message: "Collapsed",
                fixHint: "Fix",
                detectedAt: staleIso,
              },
            ],
          },
          "EcmdBrandIcon::desktop-1440": {
            key: "EcmdBrandIcon::desktop-1440",
            componentName: "EcmdBrandIcon",
            artboardTag: "desktop-1440",
            updatedAt: freshIso,
            diagnostics: [
              {
                id: "ecmdbrandicon::desktop-1440::broken_image::logo",
                code: "BROKEN_IMAGE",
                severity: "error",
                severityTier: "critical",
                breakpoint: "desktop",
                componentName: "EcmdBrandIcon",
                artboardTag: "desktop-1440",
                viewportMode: "desktop",
                element: "img.logo",
                message: "Broken logo",
                fixHint: "Fix",
                detectedAt: freshIso,
              },
            ],
          },
        },
      },
      { dismissedIds: [] }
    );

    const registered = new Set(["EcmdPackagesRepeater", "EcmdBrandIcon"]);

    // 1. User dismisses EcmdBrandIcon diagnostic
    applyDismissAction(
      state,
      { id: "ecmdbrandicon::desktop-1440::broken_image::logo" },
      registered,
      nowMs
    );

    // 2. Transient empty snapshot followed by diagnostic returning MUST NOT undo user dismissal
    ingestLiveDomSnapshot(
      state,
      {
        componentName: "EcmdBrandIcon",
        artboardTag: "desktop-1440",
        updatedAt: "2026-11-28T02:35:05.000Z",
        diagnostics: [],
      },
      registered,
      nowMs + 5000
    );
    ingestLiveDomSnapshot(
      state,
      {
        componentName: "EcmdBrandIcon",
        artboardTag: "desktop-1440",
        updatedAt: "2026-11-28T02:35:10.000Z",
        diagnostics: [
          {
            id: "ecmdbrandicon::desktop-1440::broken_image::logo",
            code: "BROKEN_IMAGE",
            severity: "error",
            severityTier: "critical",
            breakpoint: "desktop",
            componentName: "EcmdBrandIcon",
            artboardTag: "desktop-1440",
            viewportMode: "desktop",
            element: "img.logo",
            message: "Broken logo",
            fixHint: "Fix",
            detectedAt: "2026-11-28T02:35:10.000Z",
          },
        ],
      },
      registered,
      nowMs + 10000
    );

    // 3. Stale EcmdPackagesRepeater::tablet-1020 (>60m old) was automatically pruned; brand icon stays dismissed
    let built = buildTelemetryPayloads(state, "2026-11-28T02:35:10.000Z");
    expect(built.liveDomPayload.entries["EcmdPackagesRepeater::tablet-1020"]).toBeUndefined();
    expect(built.diagnosticsPayload.totalActive).toBe(0);
    expect(built.diagnosticsPayload.dismissedIds).toContain(
      "ecmdbrandicon::desktop-1440::broken_image::logo"
    );

    // 4. Component unmount removes fresh entry and rejects delayed pre-unmount snapshots
    ingestLiveDomSnapshot(
      state,
      {
        componentName: "EcmdPackagesRepeater",
        artboardTag: "desktop-1440",
        updatedAt: "2026-11-28T02:35:15.000Z",
        diagnostics: [
          {
            id: "ecmdpackagesrepeater::desktop-1440::horizontal_overflow::row",
            code: "HORIZONTAL_OVERFLOW",
            severity: "warning",
            severityTier: "layout",
            breakpoint: "desktop",
            componentName: "EcmdPackagesRepeater",
            artboardTag: "desktop-1440",
            viewportMode: "desktop",
            element: "div.row",
            message: "Overflow",
            fixHint: "Fix",
            detectedAt: "2026-11-28T02:35:15.000Z",
          },
        ],
      },
      registered,
      nowMs + 15000
    );
    handleComponentUnmount(state, "EcmdPackagesRepeater", "desktop-1440", nowMs + 20000);
    const delayed = ingestLiveDomSnapshot(
      state,
      {
        componentName: "EcmdPackagesRepeater",
        artboardTag: "desktop-1440",
        updatedAt: "2026-11-28T02:35:18.000Z", // predates unmount at +20s
        diagnostics: [],
      },
      registered,
      nowMs + 21000
    );
    expect(delayed.accepted).toBe(false);

    // 5. resetForRescan clears all live entries while preserving user dismissedIds
    applyDismissAction(state, { resetForRescan: true }, registered, nowMs + 25000);
    built = buildTelemetryPayloads(state, "2026-11-28T02:35:25.000Z");
    expect(Object.keys(built.liveDomPayload.entries)).toHaveLength(0);
    expect(built.diagnosticsPayload.dismissedIds).toContain(
      "ecmdbrandicon::desktop-1440::broken_image::logo"
    );
  });
});
