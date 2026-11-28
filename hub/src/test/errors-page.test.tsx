import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Errors from "../pages/Errors";
import { AppHeader } from "../components/layout/AppHeader";

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
});
