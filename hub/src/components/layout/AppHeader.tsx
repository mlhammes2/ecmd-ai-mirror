import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { NAV_LINKS } from "./nav-links";
import {
  getDiagnosticBreakpoint,
  getDiagnosticSeverityTier,
  type CanvasDiagnostic,
} from "../../lib/ecmdLiveComponentTelemetry";
import { copyPowerShellErrorsText } from "../PsOnlyOutputPanel";

interface DiagnosticsCounts {
  totalActive: number;
  criticalCount: number;
  desktopCount: number;
  deferredCount: number;
  runtimeCount: number;
  compilerCount: number;
}

function summarizeDiagnostics(
  activeList: Array<Partial<CanvasDiagnostic>> | undefined,
  fallbackTotal = 0,
  runtimeCount = 0,
  compilerCount = 0
): DiagnosticsCounts {
  if (!Array.isArray(activeList)) {
    return {
      totalActive: fallbackTotal + runtimeCount + compilerCount,
      criticalCount: compilerCount + runtimeCount,
      desktopCount: fallbackTotal,
      deferredCount: 0,
      runtimeCount,
      compilerCount,
    };
  }
  let criticalCount = compilerCount + runtimeCount;
  let desktopCount = 0;
  let deferredCount = 0;
  for (const item of activeList) {
    const bp = getDiagnosticBreakpoint(item);
    const tier = getDiagnosticSeverityTier(item);
    if (tier === "critical") criticalCount++;
    if (bp === "desktop") desktopCount++;
    if (bp !== "desktop" && tier === "layout") deferredCount++;
  }
  return {
    totalActive: activeList.length + runtimeCount + compilerCount,
    criticalCount,
    desktopCount,
    deferredCount,
    runtimeCount,
    compilerCount,
  };
}

export function AppHeader() {
  const [copiedPs, setCopiedPs] = useState(false);
  const [diagCounts, setDiagCounts] = useState<DiagnosticsCounts>({
    totalActive: 0,
    criticalCount: 0,
    desktopCount: 0,
    deferredCount: 0,
    runtimeCount: 0,
    compilerCount: 0,
  });

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    let active = true;
    let latestCanvasList: Array<Partial<CanvasDiagnostic>> = [];
    let latestRuntimeCount = 0;
    let latestCompilerCount = 0;

    const syncCounts = () => {
      if (!active) return;
      setDiagCounts(
        summarizeDiagnostics(latestCanvasList, 0, latestRuntimeCount, latestCompilerCount)
      );
    };

    const pollDiagnostics = async () => {
      try {
        const fetchInit: RequestInit =
          typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
            ? { signal: AbortSignal.timeout(8000) }
            : {};
        const ts = Date.now();
        const [diagRes, rtRes, telRes] = await Promise.all([
          fetch("/plasmic-diagnostics.json?t=" + ts, fetchInit).catch(() => null),
          fetch("/runtime-errors.json?t=" + ts, fetchInit).catch(() => null),
          fetch("/ai-telemetry.json?t=" + ts, fetchInit).catch(() => null),
        ]);

        let finalDiagRes = diagRes;
        if (!finalDiagRes || !finalDiagRes.ok) {
          finalDiagRes = await fetch("/__ecmd-live-dom?t=" + ts, fetchInit).catch(() => null);
        }

        if (finalDiagRes && finalDiagRes.ok) {
          const json = await finalDiagRes.json();
          const diag =
            json?.diagnostics && typeof json.diagnostics.totalActive === "number"
              ? json.diagnostics
              : json;
          if (diag && Array.isArray(diag.activeDiagnostics)) {
            latestCanvasList = diag.activeDiagnostics;
          }
        }

        if (rtRes && rtRes.ok) {
          const rtJson = await rtRes.json();
          latestRuntimeCount = Array.isArray(rtJson?.errors)
            ? rtJson.errors.length
            : Number(rtJson?.totalCount || 0);
        }

        if (telRes && telRes.ok) {
          const telJson = await telRes.json();
          latestCompilerCount = telJson?.tscClean === false ? 1 : 0;
        }

        syncCounts();
      } catch {
        // Silent in dev if diagnostics endpoint is transiently unavailable
      }
    };

    pollDiagnostics();
    const interval = setInterval(pollDiagnostics, 3000);
    const onDiagUpdated = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (Array.isArray(detail?.activeDiagnostics)) {
        latestCanvasList = detail.activeDiagnostics;
        syncCounts();
      } else {
        pollDiagnostics();
      }
    };
    const onRuntimeUpdated = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (typeof detail?.totalCount === "number") {
        latestRuntimeCount = detail.totalCount;
        syncCounts();
      } else {
        pollDiagnostics();
      }
    };
    window.addEventListener("ecmd:diagnostics-updated", onDiagUpdated);
    window.addEventListener("ecmd:runtime-errors-updated", onRuntimeUpdated);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("ecmd:diagnostics-updated", onDiagUpdated);
      window.removeEventListener("ecmd:runtime-errors-updated", onRuntimeUpdated);
    };
  }, []);

  const hasUrgent = diagCounts.criticalCount > 0 || diagCounts.desktopCount > 0;
  const hasOnlyDeferred = !hasUrgent && diagCounts.deferredCount > 0;

  const pillClass = hasUrgent
    ? diagCounts.criticalCount > 0
      ? "border-rose-400/55 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25 shadow-[0_0_12px_rgba(244,63,94,0.28)]"
      : "border-amber-400/50 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
    : hasOnlyDeferred
    ? "border-sky-400/45 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25"
    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20";

  const pillIcon = hasUrgent ? "🚨" : hasOnlyDeferred ? "📐" : "✓";
  const pillText = hasUrgent
    ? diagCounts.desktopCount > 0
      ? `${diagCounts.criticalCount} Critical / ${diagCounts.desktopCount} Desktop`
      : `${diagCounts.criticalCount} Critical`
    : hasOnlyDeferred
    ? `${diagCounts.deferredCount} Mobile/Tablet Queued`
    : "0 Errors";

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-500/20 bg-[#040B14]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link to="/workflow" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 font-display text-sm font-black text-[#040B14] shadow-[0_0_15px_rgba(16,185,129,0.4)]">
              E
            </span>
            <div className="flex flex-col">
              <span className="font-display text-sm font-bold tracking-wider text-white">ECMD</span>
              <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400">Carbon 4</span>
            </div>
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto text-xs">
            {NAV_LINKS.map((link) => {
              const isErrorsTab = link.to === "/errors";
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  activeOptions={{ exact: true }}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 font-medium text-slate-400 transition-all hover:bg-emerald-950/40 hover:text-emerald-300"
                  activeProps={{ className: "border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 font-semibold shadow-sm shadow-emerald-950/50" }}
                >
                  <span>{link.label}</span>
                  {isErrorsTab && import.meta.env.DEV && (
                    <span
                      data-testid="ecmd-nav-errors-count-badge"
                      className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] font-bold ${
                        hasUrgent
                          ? "bg-rose-500/25 text-rose-200 border border-rose-400/50"
                          : hasOnlyDeferred
                          ? "bg-sky-500/20 text-sky-200 border border-sky-400/40"
                          : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                      }`}
                    >
                      {diagCounts.totalActive}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2.5">
          {import.meta.env.DEV && (
            <button
              id="ecmd-top-bar-copy-ps-btn"
              data-testid="ecmd-top-bar-copy-ps-btn"
              type="button"
              onClick={async () => {
                try {
                  await copyPowerShellErrorsText();
                  setCopiedPs(true);
                  window.setTimeout(() => setCopiedPs(false), 1800);
                } catch {
                  // Ignore clipboard unavailability
                }
              }}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all ${
                copiedPs
                  ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                  : "border-sky-400/45 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25"
              }`}
              title="Copy latest PowerShell terminal output from /powershell-results.json"
            >
              <span>{copiedPs ? "✓" : "📋"}</span>
              <span>{copiedPs ? "Copied PS Errors" : "Copy PS Errors"}</span>
            </button>
          )}
          {import.meta.env.DEV && (
            <Link
              to="/errors"
              data-testid="ecmd-nav-canvas-diagnostics-pill"
              data-ecmd-diag-state={hasUrgent ? "urgent" : hasOnlyDeferred ? "deferred" : "clean"}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all ${pillClass}`}
              title="Open Unified Errors & Issues Center (/errors)"
            >
              <span>{pillIcon}</span>
              <span>{pillText}</span>
            </Link>
          )}
          <Link
            to="/"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-all hover:border-emerald-500/60 hover:bg-emerald-900/50 hover:text-emerald-300 shadow-sm"
          >
            <span>Live Site (/)</span>
            <span className="text-[10px]">↗</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
