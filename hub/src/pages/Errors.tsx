import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  getDiagnosticBreakpoint,
  getDiagnosticSeverityTier,
  type CanvasDiagnostic,
  type RuntimeErrorEntry,
  type RuntimeErrorsStore,
} from "../lib/ecmdLiveComponentTelemetry";

interface AiTelemetry {
  refCode?: string;
  engine?: string;
  status?: string;
  updatedAt?: string;
  tscClean?: boolean;
  shortTitle?: string;
  errorsSummary?: string;
  tscOutput?: string;
}

interface DiagnosticsStore {
  updatedAt?: string | null;
  totalActive?: number;
  totalDismissed?: number;
  dismissedIds?: string[];
  diagnostics?: CanvasDiagnostic[];
  activeDiagnostics?: CanvasDiagnostic[];
}

export interface UnifiedErrorsPayload {
  totalErrors: number;
  tscClean: boolean;
  tscOutput: string;
  refCode: string | null;
  errorsSummary: string;
  criticalCanvasIssues: CanvasDiagnostic[];
  desktopIssues: CanvasDiagnostic[];
  tabletIssues: CanvasDiagnostic[];
  mobileIssues: CanvasDiagnostic[];
  runtimeErrors: RuntimeErrorEntry[];
  counts: {
    compilerErrors: number;
    criticalCanvas: number;
    runtimeJs: number;
    deferredLayout: number;
    desktop: number;
    tablet: number;
    mobile: number;
  };
  updatedAt: string;
}

function getFetchInit(): RequestInit {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return { signal: AbortSignal.timeout(8000) };
  }
  return {};
}

export function Errors() {
  const [telemetry, setTelemetry] = useState<AiTelemetry | null>(null);
  const [diagnosticsStore, setDiagnosticsStore] = useState<DiagnosticsStore | null>(null);
  const [runtimeStore, setRuntimeStore] = useState<RuntimeErrorsStore | null>(null);
  const [selectedDiagTab, setSelectedDiagTab] = useState<
    "desktop" | "tablet" | "mobile" | "critical" | "all"
  >("desktop");
  const [autoPoll, setAutoPoll] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isRescanning, setIsRescanning] = useState<boolean>(false);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [lastPolled, setLastPolled] = useState<string>("");

  const fetchAllErrors = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const ts = Date.now();
      const init = getFetchInit();
      const [resTel, resDiag, resRt] = await Promise.all([
        fetch("/ai-telemetry.json?t=" + ts, init).catch(() => null),
        fetch("/plasmic-diagnostics.json?t=" + ts, init).catch(() => null),
        fetch("/runtime-errors.json?t=" + ts, init).catch(() => null),
      ]);

      let latestTel: AiTelemetry | null = null;
      let latestDiag: DiagnosticsStore | null = null;
      let latestRt: RuntimeErrorsStore | null = null;

      if (resTel && resTel.ok) {
        latestTel = await resTel.json();
        setTelemetry(latestTel);
      }
      if (resDiag && resDiag.ok) {
        latestDiag = await resDiag.json();
        setDiagnosticsStore(latestDiag);
      }
      if (resRt && resRt.ok) {
        latestRt = await resRt.json();
        setRuntimeStore(latestRt);
      }

      setLastPolled(new Date().toLocaleTimeString());

      if (typeof window !== "undefined") {
        if (latestDiag) {
          window.dispatchEvent(
            new CustomEvent("ecmd:diagnostics-updated", {
              detail: {
                totalActive: latestDiag.totalActive ?? (latestDiag.activeDiagnostics?.length || 0),
                activeDiagnostics: latestDiag.activeDiagnostics || [],
              },
            })
          );
        }
        if (latestRt) {
          window.dispatchEvent(
            new CustomEvent("ecmd:runtime-errors-updated", {
              detail: {
                totalCount: latestRt.totalCount ?? (latestRt.errors?.length || 0),
                errors: latestRt.errors || [],
              },
            })
          );
        }
      }
    } catch {
      // Keep prior state on transient network failure
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAllErrors();
    if (!autoPoll) return;
    const interval = setInterval(fetchAllErrors, 2000);
    return () => clearInterval(interval);
  }, [autoPoll, fetchAllErrors]);

  const activeDiagnostics: CanvasDiagnostic[] = useMemo(
    () => diagnosticsStore?.activeDiagnostics || [],
    [diagnosticsStore]
  );

  const runtimeErrors: RuntimeErrorEntry[] = useMemo(
    () => (Array.isArray(runtimeStore?.errors) ? runtimeStore.errors : []),
    [runtimeStore]
  );

  const categorizedDiagnostics = useMemo(() => {
    const desktop: CanvasDiagnostic[] = [];
    const tablet: CanvasDiagnostic[] = [];
    const mobile: CanvasDiagnostic[] = [];
    const critical: CanvasDiagnostic[] = [];
    const otherBpCritical: CanvasDiagnostic[] = [];
    let deferredLayoutCount = 0;

    for (const diag of activeDiagnostics) {
      const bp = getDiagnosticBreakpoint(diag);
      const tier = getDiagnosticSeverityTier(diag);
      if (bp === "desktop") desktop.push(diag);
      else if (bp === "tablet") tablet.push(diag);
      else mobile.push(diag);

      if (tier === "critical") {
        critical.push(diag);
        if (bp !== "desktop") otherBpCritical.push(diag);
      } else {
        deferredLayoutCount++;
      }
    }

    return {
      desktop,
      tablet,
      mobile,
      critical,
      otherBpCritical,
      deferredLayoutCount,
      all: activeDiagnostics,
    };
  }, [activeDiagnostics]);

  const visibleDiagnostics = useMemo(() => {
    switch (selectedDiagTab) {
      case "desktop":
        return categorizedDiagnostics.desktop;
      case "tablet":
        return categorizedDiagnostics.tablet;
      case "mobile":
        return categorizedDiagnostics.mobile;
      case "critical":
        return categorizedDiagnostics.critical;
      case "all":
      default:
        return categorizedDiagnostics.all;
    }
  }, [categorizedDiagnostics, selectedDiagTab]);

  const tscClean = telemetry?.tscClean !== false;
  const compilerErrorCount = tscClean ? 0 : 1;
  const criticalCanvasCount = categorizedDiagnostics.critical.length;
  const runtimeErrorCount = runtimeErrors.length;
  const deferredLayoutCount = categorizedDiagnostics.deferredLayoutCount;
  const totalActiveIssues =
    compilerErrorCount + criticalCanvasCount + runtimeErrorCount + deferredLayoutCount;

  const unifiedPayload: UnifiedErrorsPayload = useMemo(
    () => ({
      totalErrors: totalActiveIssues,
      tscClean,
      tscOutput: telemetry?.tscOutput || "",
      refCode: telemetry?.refCode || null,
      errorsSummary: telemetry?.errorsSummary || (tscClean ? "0 compiler errors" : "TypeScript errors detected"),
      criticalCanvasIssues: categorizedDiagnostics.critical,
      desktopIssues: categorizedDiagnostics.desktop,
      tabletIssues: categorizedDiagnostics.tablet,
      mobileIssues: categorizedDiagnostics.mobile,
      runtimeErrors,
      counts: {
        compilerErrors: compilerErrorCount,
        criticalCanvas: criticalCanvasCount,
        runtimeJs: runtimeErrorCount,
        deferredLayout: deferredLayoutCount,
        desktop: categorizedDiagnostics.desktop.length,
        tablet: categorizedDiagnostics.tablet.length,
        mobile: categorizedDiagnostics.mobile.length,
      },
      updatedAt:
        diagnosticsStore?.updatedAt ||
        runtimeStore?.updatedAt ||
        telemetry?.updatedAt ||
        "",
    }),
    [
      totalActiveIssues,
      tscClean,
      telemetry,
      categorizedDiagnostics,
      runtimeErrors,
      compilerErrorCount,
      criticalCanvasCount,
      runtimeErrorCount,
      deferredLayoutCount,
      diagnosticsStore,
      runtimeStore,
    ]
  );

  const handleRescanCanvas = async () => {
    setIsRescanning(true);
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ecmd:snapshot-now"));
      }
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("ecmd-live-dom");
        bc.postMessage({ type: "snapshot-now", requestedAt: Date.now() });
        bc.close();
      }
      const res = await fetch("/__ecmd-live-dom?t=" + Date.now(), getFetchInit()).catch(() => null);
      if (res && res.ok) {
        const json = await res.json();
        if (json?.diagnostics) {
          setDiagnosticsStore(json.diagnostics);
        }
      }
      setTimeout(() => {
        fetchAllErrors();
      }, 300);
    } catch {
      await fetchAllErrors();
    } finally {
      setTimeout(() => setIsRescanning(false), 450);
    }
  };

  const dismissDiagnostic = async (payload: {
    id?: string;
    clearResolved?: boolean;
    clearAll?: boolean;
    restoreAll?: boolean;
  }) => {
    try {
      const res = await fetch("/__ecmd-live-dom/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        ...getFetchInit(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.diagnostics) {
          setDiagnosticsStore(json.diagnostics);
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("ecmd:diagnostics-updated", {
                detail: {
                  totalActive: json.diagnostics?.totalActive ?? 0,
                  activeDiagnostics: json.diagnostics?.activeDiagnostics || [],
                },
              })
            );
          }
        }
      }
    } catch {
      // ignore if dev middleware is unavailable
    }
  };

  const clearRuntimeLog = async () => {
    try {
      const res = await fetch("/__ecmd-runtime-error/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true }),
        ...getFetchInit(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.runtimeErrors) {
          setRuntimeStore(json.runtimeErrors);
        } else {
          setRuntimeStore({ updatedAt: new Date().toISOString(), totalCount: 0, errors: [] });
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("ecmd:runtime-errors-updated", {
              detail: { totalCount: 0, errors: [] },
            })
          );
        }
      }
    } catch {
      // ignore if dev middleware is unavailable
    }
  };

  const copyAllErrorsJson = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(unifiedPayload, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  const hasUrgent = compilerErrorCount > 0 || criticalCanvasCount > 0 || runtimeErrorCount > 0;

  return (
    <div className="min-h-screen bg-[#040B14] text-[#F8FAFC] pb-16 font-sans">
      {/* Sticky Control Bar */}
      <div className="sticky top-14 z-30 border-b border-emerald-500/20 bg-[#071324]/95 backdrop-blur-md px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
                hasUrgent
                  ? "border-rose-500/50 bg-rose-500/15 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.28)]"
                  : deferredLayoutCount > 0
                  ? "border-sky-500/45 bg-sky-500/15 text-sky-200"
                  : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  hasUrgent
                    ? "bg-rose-400 animate-pulse"
                    : deferredLayoutCount > 0
                    ? "bg-sky-400"
                    : "bg-emerald-400"
                }`}
              />
              <span>
                {hasUrgent
                  ? `🚨 ${compilerErrorCount + criticalCanvasCount + runtimeErrorCount} Urgent Error(s)`
                  : deferredLayoutCount > 0
                  ? `📐 ${deferredLayoutCount} Layout Polish Item(s)`
                  : "✓ 0 Active Errors"}
              </span>
            </div>

            <div className="hidden items-center gap-1.5 rounded-lg border border-slate-800 bg-[#030712] px-2.5 py-1.5 font-mono text-xs text-slate-400 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
              <span>{lastPolled ? `Polled ${lastPolled}` : "Polling..."}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRescanCanvas}
              disabled={isRescanning}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/50 bg-sky-500/20 px-3 py-1.5 text-xs font-bold text-sky-200 transition hover:bg-sky-500/30 disabled:opacity-60"
            >
              <span>📸</span>
              <span>{isRescanning ? "Re-Scanning..." : "Re-Scan Canvas"}</span>
            </button>

            <button
              type="button"
              onClick={() => dismissDiagnostic({ clearResolved: true })}
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              Clear Resolved / Stale
            </button>

            <button
              type="button"
              onClick={copyAllErrorsJson}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/45 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25"
            >
              <span>{copiedJson ? "✓" : "📋"}</span>
              <span>{copiedJson ? "Copied Errors JSON" : "Copy All Errors JSON"}</span>
            </button>

            <button
              type="button"
              onClick={() => setAutoPoll((prev) => !prev)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                autoPoll
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                  : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  autoPoll ? "bg-emerald-400 animate-pulse" : "bg-slate-600"
                }`}
              />
              <span>Auto-Poll (2s): {autoPoll ? "ON" : "OFF"}</span>
            </button>

            <button
              type="button"
              onClick={fetchAllErrors}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
            >
              <span className={isRefreshing ? "animate-spin" : ""}>↻</span>
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Unified Full-Stack Error &amp; Diagnostics Center
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Errors &amp; Issues
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Single source of truth for Compiler/TSC (<code className="text-emerald-300">/ai-telemetry.json</code>), Plasmic Canvas Hooks &amp; Box-Model (<code className="text-sky-300">/plasmic-diagnostics.json</code>), and Browser Runtime Exceptions (<code className="text-rose-300">/runtime-errors.json</code>).
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/workflow"
              className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-900/50"
            >
              Workflow &amp; Boot-Up ↗
            </Link>
            <a
              href="https://github.com/mlhammes2/ecmd-ai-mirror"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
            >
              GitHub AI Mirror ↗
            </a>
          </div>
        </div>

        {/* Top Summary Strip */}
        <section
          aria-label="Unified Error Summary Strip"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div
            className={`rounded-xl border p-4 ${
              totalActiveIssues > 0
                ? hasUrgent
                  ? "border-rose-500/45 bg-[#190F1E]"
                  : "border-sky-500/40 bg-[#081526]"
                : "border-emerald-500/35 bg-[#061816]"
            }`}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Active Issues
            </div>
            <div className="mt-1 text-2xl font-black text-white">{totalActiveIssues}</div>
            <div className="mt-1 text-[11px] text-slate-400">All layers combined</div>
          </div>

          <div
            className={`rounded-xl border p-4 ${
              compilerErrorCount > 0
                ? "border-rose-500/45 bg-[#190F1E]"
                : "border-emerald-500/25 bg-[#071320]"
            }`}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Compiler / TSC Errors
            </div>
            <div
              className={`mt-1 text-2xl font-black ${
                compilerErrorCount > 0 ? "text-rose-300" : "text-emerald-300"
              }`}
            >
              {compilerErrorCount}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              {tscClean ? "tscClean: true" : "tscClean: false"}
            </div>
          </div>

          <div
            className={`rounded-xl border p-4 ${
              criticalCanvasCount > 0
                ? "border-rose-500/45 bg-[#190F1E]"
                : "border-emerald-500/25 bg-[#071320]"
            }`}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Critical Canvas Issues
            </div>
            <div
              className={`mt-1 text-2xl font-black ${
                criticalCanvasCount > 0 ? "text-rose-300" : "text-emerald-300"
              }`}
            >
              {criticalCanvasCount}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Hooks &amp; broken images</div>
          </div>

          <div
            className={`rounded-xl border p-4 ${
              runtimeErrorCount > 0
                ? "border-rose-500/45 bg-[#190F1E]"
                : "border-emerald-500/25 bg-[#071320]"
            }`}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Runtime JS Errors
            </div>
            <div
              className={`mt-1 text-2xl font-black ${
                runtimeErrorCount > 0 ? "text-rose-300" : "text-emerald-300"
              }`}
            >
              {runtimeErrorCount}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Uncaught &amp; rejections</div>
          </div>

          <div className="rounded-xl border border-sky-500/25 bg-[#071320] p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Deferred Layout Polish
            </div>
            <div className="mt-1 text-2xl font-black text-sky-300">{deferredLayoutCount}</div>
            <div className="mt-1 font-mono text-[10px] text-slate-400">
              D:{categorizedDiagnostics.desktop.length} · T:{categorizedDiagnostics.tablet.length} · M:
              {categorizedDiagnostics.mobile.length}
            </div>
          </div>
        </section>

        {/* Panel 1 — Compiler & PEN (agy) Build Status */}
        <section
          id="ecmd-compiler-status"
          className={`rounded-2xl border p-5 shadow-xl sm:p-6 ${
            tscClean
              ? "border-emerald-500/25 bg-[#06101E]/90"
              : "border-rose-500/45 bg-[#150C18]"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <span
                className={`grid h-7 w-7 place-items-center rounded-lg border text-xs font-bold ${
                  tscClean
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : "border-rose-500/45 bg-rose-500/15 text-rose-300"
                }`}
              >
                TS
              </span>
              <div>
                <h2 className="text-base font-bold text-white">
                  Panel 1 — Compiler &amp; PEN (<code className="text-emerald-300">agy</code>) Build Status
                </h2>
                <div className="text-xs text-slate-400">
                  Live TypeScript verification from <code className="text-sky-300">/ai-telemetry.json</code>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {telemetry?.refCode && (
                <span className="rounded bg-emerald-500/15 border border-emerald-500/35 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-300">
                  {telemetry.refCode}
                </span>
              )}
              <span
                className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold border ${
                  tscClean
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : "border-rose-500/45 bg-rose-500/20 text-rose-200"
                }`}
              >
                {tscClean ? "✓ tscClean: 0 errors" : "🚨 TypeScript Errors"}
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-800 bg-[#030710] px-4 py-3 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong className="text-slate-200">Summary:</strong>{" "}
                {telemetry?.errorsSummary || (tscClean ? "0 final compiler errors" : "Compiler errors reported")}
              </span>
              {telemetry?.updatedAt && (
                <span className="font-mono text-[10px] text-slate-400">
                  {new Date(telemetry.updatedAt).toLocaleString()}
                </span>
              )}
            </div>

            {telemetry?.tscOutput ? (
              <pre className="max-h-64 overflow-auto rounded-xl border border-rose-500/35 bg-[#12060E] p-4 font-mono text-xs text-rose-200 leading-relaxed whitespace-pre-wrap">
                {telemetry.tscOutput}
              </pre>
            ) : (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-4 py-3 text-xs text-emerald-300">
                ✓ TypeScript compiler (<code className="font-mono">npx tsc --noEmit</code>) is clean with 0 errors.
              </div>
            )}
          </div>
        </section>

        {/* Panel 2 — Plasmic Canvas Hook, Asset & Box-Model Diagnostics */}
        <section
          id="ecmd-canvas-diagnostics"
          className={`rounded-2xl border p-5 shadow-xl sm:p-6 ${
            categorizedDiagnostics.critical.length > 0
              ? "border-rose-500/45 bg-[#120C17]"
              : categorizedDiagnostics.desktop.length > 0
              ? "border-amber-500/45 bg-[#0D101B]"
              : activeDiagnostics.length > 0
              ? "border-sky-500/35 bg-[#07101E]"
              : "border-emerald-500/25 bg-[#070D18]"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`flex h-2.5 w-2.5 rounded-full ${
                    categorizedDiagnostics.critical.length > 0
                      ? "bg-rose-400 animate-pulse"
                      : categorizedDiagnostics.desktop.length > 0
                      ? "bg-amber-400 animate-pulse"
                      : activeDiagnostics.length > 0
                      ? "bg-sky-400"
                      : "bg-emerald-400"
                  }`}
                />
                <h2 className="text-base font-bold text-white">
                  Panel 2 — Plasmic Canvas Hook, Asset &amp; Box-Model Diagnostics
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold border ${
                    categorizedDiagnostics.critical.length > 0
                      ? "border-rose-500/45 bg-rose-500/15 text-rose-200"
                      : categorizedDiagnostics.desktop.length > 0
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                      : activeDiagnostics.length > 0
                      ? "border-sky-500/40 bg-sky-500/15 text-sky-200"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  }`}
                >
                  {categorizedDiagnostics.critical.length > 0 || categorizedDiagnostics.desktop.length > 0
                    ? `🚨 ${categorizedDiagnostics.critical.length} Critical / ${categorizedDiagnostics.desktop.length} Desktop`
                    : activeDiagnostics.length > 0
                    ? `📐 ${activeDiagnostics.length} Mobile/Tablet Queued`
                    : "✓ 0 Canvas Issues"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                3-tier (<strong className="text-slate-200">Desktop &gt; 1024px</strong> ·{" "}
                <strong className="text-slate-200">Tablet 768–1024px</strong> ·{" "}
                <strong className="text-slate-200">Mobile &lt; 768px</strong>) canvas linter from{" "}
                <code className="text-sky-300">/plasmic-diagnostics.json</code>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeDiagnostics.length > 0 && (
                <button
                  type="button"
                  onClick={() => dismissDiagnostic({ clearAll: true })}
                  className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/25"
                >
                  Dismiss All
                </button>
              )}
              {(diagnosticsStore?.totalDismissed ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => dismissDiagnostic({ restoreAll: true })}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:text-white"
                >
                  Restore Dismissed ({diagnosticsStore?.totalDismissed})
                </button>
              )}
            </div>
          </div>

          {/* 3-Tier Filter Tabs */}
          <div
            className="mt-4 flex flex-wrap items-center gap-2"
            role="tablist"
            aria-label="Diagnostics Breakpoint Categories"
          >
            {(
              [
                {
                  id: "desktop",
                  label: `🖥️ Desktop (${categorizedDiagnostics.desktop.length})`,
                  urgent: categorizedDiagnostics.desktop.length > 0,
                },
                {
                  id: "tablet",
                  label: `📱 Tablet (${categorizedDiagnostics.tablet.length})`,
                  urgent: false,
                },
                {
                  id: "mobile",
                  label: `📲 Mobile (${categorizedDiagnostics.mobile.length})`,
                  urgent: false,
                },
                {
                  id: "critical",
                  label: `🚨 Critical Across All (${categorizedDiagnostics.critical.length})`,
                  urgent: categorizedDiagnostics.critical.length > 0,
                },
                {
                  id: "all",
                  label: `All Breakpoints (${categorizedDiagnostics.all.length})`,
                  urgent: false,
                },
              ] as const
            ).map((tab) => {
              const isSelected = selectedDiagTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  data-ecmd-diag-tab={tab.id}
                  onClick={() => setSelectedDiagTab(tab.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                    isSelected
                      ? tab.id === "critical"
                        ? "border-rose-400/70 bg-rose-500/25 text-rose-100 shadow-sm"
                        : "border-emerald-400/70 bg-emerald-500/20 text-emerald-200 shadow-sm"
                      : tab.id === "critical" && tab.urgent
                      ? "border-rose-500/45 bg-rose-950/40 text-rose-300 hover:bg-rose-900/50"
                      : "border-slate-700/80 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {selectedDiagTab === "desktop" && categorizedDiagnostics.otherBpCritical.length > 0 && (
            <div
              data-ecmd-other-bp-critical-banner="true"
              className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/50 bg-rose-950/35 px-4 py-2.5 text-xs text-rose-200"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold">🚨</span>
                <span>
                  <strong>{categorizedDiagnostics.otherBpCritical.length} CRITICAL</strong> interactive hook / broken asset issue
                  {categorizedDiagnostics.otherBpCritical.length === 1 ? "" : "s"} detected on Tablet/Mobile artboards.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDiagTab("critical")}
                className="rounded-md border border-rose-400/60 bg-rose-500/20 px-2.5 py-1 text-[11px] font-bold text-rose-100 transition hover:bg-rose-500/35"
              >
                Inspect Critical Across All ↗
              </button>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {visibleDiagnostics.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-4 py-4 text-xs text-emerald-300 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">✓</span>
                  <span>
                    {selectedDiagTab === "desktop"
                      ? activeDiagnostics.length > 0
                        ? `Desktop (> 1024px) is 100% clean! ${categorizedDiagnostics.tablet.length} Tablet and ${categorizedDiagnostics.mobile.length} Mobile item(s) are parked in their breakpoint tabs.`
                        : "All monitored Plasmic canvas components passed interactive hook, overflow, box-model, and image integrity checks across Desktop, Tablet, and Mobile."
                      : `0 active issues in the "${selectedDiagTab}" category.`}
                  </span>
                </div>
                {diagnosticsStore?.updatedAt && (
                  <span className="font-mono text-[10px] text-slate-400">
                    Checked {new Date(diagnosticsStore.updatedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            ) : (
              visibleDiagnostics.map((diag) => {
                const bp = getDiagnosticBreakpoint(diag);
                const tier = getDiagnosticSeverityTier(diag);
                const isCritical = tier === "critical";
                return (
                  <div
                    key={diag.id}
                    data-ecmd-diag-item={diag.code}
                    data-ecmd-diag-tier={tier}
                    data-ecmd-diag-bp={bp}
                    className={`rounded-xl border p-4 space-y-2 ${
                      isCritical
                        ? "border-rose-500/45 bg-[#19101E]"
                        : "border-amber-500/35 bg-[#121625]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 font-mono text-[10px] font-black uppercase ${
                            isCritical
                              ? "bg-rose-500/25 text-rose-200 border border-rose-400/50"
                              : "bg-sky-500/20 text-sky-200 border border-sky-400/40"
                          }`}
                        >
                          {isCritical ? "🚨 CRITICAL" : "📐 LAYOUT"}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                            diag.severity === "error" || isCritical
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          }`}
                        >
                          {diag.code}
                        </span>
                        <span className="rounded bg-slate-900 border border-slate-700 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-indigo-300">
                          {bp === "desktop" ? "🖥️ desktop" : bp === "tablet" ? "📱 tablet" : "📲 mobile"}
                        </span>
                        <span className="rounded bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 font-mono text-[11px] font-semibold text-sky-300">
                          {diag.componentName}
                        </span>
                        <span className="rounded bg-slate-900 border border-slate-700 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                          {diag.artboardTag}
                        </span>
                        <code className="text-[11px] font-mono text-slate-300">{diag.element}</code>
                      </div>
                      <button
                        type="button"
                        onClick={() => dismissDiagnostic({ id: diag.id })}
                        className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-amber-400/50 hover:text-white"
                      >
                        Dismiss
                      </button>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">{diag.message}</p>
                    <div className="rounded-lg border border-emerald-500/20 bg-[#071219] px-3 py-2 text-[11px] text-emerald-300">
                      <strong>How to fix:</strong> {diag.fixHint}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Panel 3 — Browser Runtime & Unhandled Promise Errors */}
        <section
          id="ecmd-runtime-errors"
          className={`rounded-2xl border p-5 shadow-xl sm:p-6 ${
            runtimeErrors.length > 0
              ? "border-rose-500/45 bg-[#150C18]"
              : "border-emerald-500/25 bg-[#06101E]/90"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <span
                className={`grid h-7 w-7 place-items-center rounded-lg border text-xs font-bold ${
                  runtimeErrors.length > 0
                    ? "border-rose-500/45 bg-rose-500/15 text-rose-300"
                    : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                }`}
              >
                JS
              </span>
              <div>
                <h2 className="text-base font-bold text-white">
                  Panel 3 — Browser Runtime &amp; Unhandled Promise Errors
                </h2>
                <div className="text-xs text-slate-400">
                  DEV-only uncaught exceptions &amp; rejected promises streamed to{" "}
                  <code className="text-rose-300">/runtime-errors.json</code> (deduplicated, last 50)
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold border ${
                  runtimeErrors.length > 0
                    ? "border-rose-500/45 bg-rose-500/20 text-rose-200"
                    : "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                }`}
              >
                {runtimeErrors.length > 0
                  ? `🚨 ${runtimeErrors.length} Runtime Error(s)`
                  : "✓ 0 Runtime Errors"}
              </span>
              <button
                type="button"
                onClick={clearRuntimeLog}
                className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
              >
                Clear Runtime Log
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {runtimeErrors.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-4 py-4 text-xs text-emerald-300">
                ✓ Zero uncaught browser exceptions or unhandled promise rejections recorded.
              </div>
            ) : (
              runtimeErrors.map((err) => (
                <div
                  key={err.id}
                  data-ecmd-runtime-error={err.kind}
                  className="rounded-xl border border-rose-500/40 bg-[#19101E] p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-rose-500/25 border border-rose-400/50 px-2 py-0.5 font-mono text-[10px] font-black uppercase text-rose-200">
                        {err.kind === "unhandledrejection" ? "PROMISE REJECTION" : "RUNTIME ERROR"}
                      </span>
                      {err.count > 1 && (
                        <span className="rounded bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-200">
                          ×{err.count}
                        </span>
                      )}
                      <span className="rounded bg-slate-900 border border-slate-700 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                        {err.artboardTag}
                      </span>
                      <code className="text-[11px] font-mono text-sky-300">{err.source}</code>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      {err.timestamp ? new Date(err.timestamp).toLocaleTimeString() : ""}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-rose-100 leading-relaxed">{err.message}</p>
                  {err.url && (
                    <div className="font-mono text-[10px] text-slate-400 truncate">URL: {err.url}</div>
                  )}
                  {err.stackPreview && (
                    <pre className="max-h-36 overflow-auto rounded-lg border border-slate-800 bg-[#050810] p-2.5 font-mono text-[11px] text-slate-300 whitespace-pre-wrap">
                      {err.stackPreview}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Panel 4 — 0ms Machine-Readable Unified Error Node */}
        <section className="rounded-2xl border border-sky-500/25 bg-[#06101E]/90 p-5 shadow-xl sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-500/15 border border-sky-500/40 text-xs font-bold text-sky-400">
                0ms
              </span>
              <div>
                <h2 className="text-base font-bold text-white">
                  Panel 4 — 0ms Machine-Readable Unified Error Node (
                  <code className="text-sky-400 text-xs font-mono">#ecmd-unified-errors-json</code>)
                </h2>
                <div className="text-xs text-slate-400">
                  Chrome Gemini Sidebar reads 100% of compiler, canvas (Desktop/Tablet/Mobile), and runtime errors from this single DOM node.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={copyAllErrorsJson}
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              {copiedJson ? "✓ Copied JSON" : "Copy All Errors JSON"}
            </button>
          </div>

          <div className="mt-4">
            <pre
              id="ecmd-unified-errors-json"
              className="max-h-96 overflow-auto rounded-xl border border-slate-800 bg-[#02050B] p-4 font-mono text-xs text-sky-300 leading-relaxed"
            >
              {JSON.stringify(unifiedPayload, null, 2)}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Errors;
