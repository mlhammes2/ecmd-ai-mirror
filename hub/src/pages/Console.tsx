import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { carbonQuery } from "../integrations/supabase/client";
import { ECMD_SIDEBAR_BOOT_PROMPT } from "../lib/ecmdBootPrompt";
import "../plasmic-init";
import {
  ECMD_REGISTERED_COMPONENTS,
  getDiagnosticBreakpoint,
  getDiagnosticSeverityTier,
  type CanvasDiagnostic,
} from "../lib/ecmdLiveComponentTelemetry";
import { classifyBreakpointFromWidth, type EcmdViewportMode } from "../lib/useEcmdBreakpoint";

interface AiTelemetry {
  refCode?: string;
  engine?: string;
  status?: "COMPLETE_CLEAN" | "RUNNING" | "NEEDS_ATTENTION" | string;
  updatedAt?: string;
  tscClean?: boolean;
  shortTitle?: string;
  humanBullets?: string[];
  attemptsLog?: string[];
  filesChanged?: string[];
  errorsSummary?: string;
  cliSummary?: string;
  exitCode?: number;
  taskPrompt?: string;
  tscOutput?: string;
  cliStderr?: string;
}

interface LiveDomStore {
  updatedAt?: string | null;
  entries?: Record<string, any>;
  componentNames?: string[];
}

interface DiagnosticsStore {
  updatedAt?: string | null;
  totalActive?: number;
  totalDismissed?: number;
  dismissedIds?: string[];
  diagnostics?: CanvasDiagnostic[];
  activeDiagnostics?: CanvasDiagnostic[];
}

export default function Console() {
  const [telemetry, setTelemetry] = useState<AiTelemetry | null>(null);
  const [plasmicHydration, setPlasmicHydration] = useState<any>(null);
  const [liveDom, setLiveDom] = useState<LiveDomStore | null>(null);
  const [diagnosticsStore, setDiagnosticsStore] = useState<DiagnosticsStore | null>(null);
  const [selectedComponentFilter, setSelectedComponentFilter] = useState<string>("ALL");
  const [selectedViewportFilter, setSelectedViewportFilter] = useState<"ALL" | EcmdViewportMode>("ALL");
  const [selectedArtboardFilter, setSelectedArtboardFilter] = useState<string>("ALL");
  const [isSnapshotting, setIsSnapshotting] = useState<boolean>(false);
  const [copiedLiveDom, setCopiedLiveDom] = useState<boolean>(false);
  const [lastPolled, setLastPolled] = useState<string>("");
  const [autoPoll, setAutoPoll] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [copiedRaw, setCopiedRaw] = useState<boolean>(false);
  const [copiedHydration, setCopiedHydration] = useState<boolean>(false);
  const [copiedBootPrompt, setCopiedBootPrompt] = useState<boolean>(false);
  const [feedExpanded, setFeedExpanded] = useState<boolean>(true);

  // Auto-expand feed whenever status transitions to RUNNING
  useEffect(() => {
    if (telemetry?.status === "RUNNING") {
      setFeedExpanded(true);
    }
  }, [telemetry?.status]);

  // Supabase ping state
  const [supabasePing, setSupabasePing] = useState<{
    status: "idle" | "pinging" | "success" | "error";
    tableCount?: number;
    message?: string;
    pingTime?: string;
  }>({ status: "idle" });

  const fetchTelemetry = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const ts = Date.now();
      const [resTel, resHyd, resLive, resDiag] = await Promise.all([
        fetch("/ai-telemetry.json?t=" + ts),
        fetch("/plasmic-layout-hydration.json?t=" + ts),
        fetch("/plasmic-live-dom.json?t=" + ts).catch(() => null),
        fetch("/plasmic-diagnostics.json?t=" + ts).catch(() => null),
      ]);
      if (resTel.ok) {
        const data = await resTel.json();
        setTelemetry(data);
        setLastPolled(new Date().toLocaleTimeString());
      }
      if (resHyd.ok) {
        const dataHyd = await resHyd.json();
        setPlasmicHydration(dataHyd);
      }
      if (resLive && resLive.ok) {
        const dataLive = await resLive.json();
        setLiveDom(dataLive);
      }
      if (resDiag && resDiag.ok) {
        const dataDiag = await resDiag.json();
        setDiagnosticsStore(dataDiag);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("ecmd:diagnostics-updated", {
              detail: {
                totalActive: dataDiag?.totalActive ?? 0,
                activeDiagnostics: dataDiag?.activeDiagnostics || [],
              },
            })
          );
        }
      }
    } catch {
      // keep prior state on transient fetch error
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const triggerCanvasSnapshotNow = async () => {
    setIsSnapshotting(true);
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ecmd:snapshot-now"));
      }
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("ecmd-live-dom");
        bc.postMessage({ type: "snapshot-now", requestedAt: Date.now() });
        bc.close();
      }
      const res = await fetch("/__ecmd-live-dom?t=" + Date.now());
      if (res.ok) {
        const json = await res.json();
        if (json?.liveDom) setLiveDom(json.liveDom);
        if (json?.diagnostics) {
          setDiagnosticsStore(json.diagnostics);
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
      setTimeout(() => {
        fetchTelemetry();
      }, 350);
    } catch {
      await fetchTelemetry();
    } finally {
      setTimeout(() => setIsSnapshotting(false), 450);
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

  const copyLiveDom = () => {
    navigator.clipboard.writeText(JSON.stringify(filteredLiveDomView, null, 2));
    setCopiedLiveDom(true);
    setTimeout(() => setCopiedLiveDom(false), 2000);
  };

  const liveEntriesArray = useMemo(() => {
    const entriesObj = liveDom?.entries || {};
    return Object.values(entriesObj) as Array<any>;
  }, [liveDom]);

  const mountedCountByComponent = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of liveEntriesArray) {
      const name = String(entry?.componentName || "");
      if (!name) continue;
      map.set(name, (map.get(name) || 0) + 1);
    }
    return map;
  }, [liveEntriesArray]);

  const availableArtboards = useMemo(() => {
    const set = new Set<string>();
    for (const entry of liveEntriesArray) {
      if (entry?.artboardTag) set.add(String(entry.artboardTag));
    }
    return Array.from(set).sort();
  }, [liveEntriesArray]);

  const componentFilterPills = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ name: string; displayName: string; mountedCount: number }> = [];
    for (const comp of ECMD_REGISTERED_COMPONENTS) {
      if (seen.has(comp.name)) continue;
      seen.add(comp.name);
      list.push({
        name: comp.name,
        displayName: comp.displayName || comp.name,
        mountedCount: mountedCountByComponent.get(comp.name) || 0,
      });
    }
    for (const [name, count] of mountedCountByComponent.entries()) {
      if (!seen.has(name)) {
        seen.add(name);
        list.push({ name, displayName: name, mountedCount: count });
      }
    }
    return list;
  }, [mountedCountByComponent]);

  const resolveEntryViewportMode = (entry: any): EcmdViewportMode => {
    if (
      entry?.viewportMode === "desktop" ||
      entry?.viewportMode === "tablet" ||
      entry?.viewportMode === "mobile"
    ) {
      return entry.viewportMode;
    }
    if (typeof entry?.viewportWidthPx === "number" && Number.isFinite(entry.viewportWidthPx)) {
      return classifyBreakpointFromWidth(entry.viewportWidthPx);
    }
    const m = String(entry?.artboardTag || "").match(/(\d+)$/);
    if (m && m[1]) return classifyBreakpointFromWidth(Number(m[1]));
    if (String(entry?.artboardTag || "").startsWith("mobile")) return "mobile";
    if (String(entry?.artboardTag || "").startsWith("tablet")) return "tablet";
    return "desktop";
  };

  const liveDomCountsByViewport = useMemo(() => {
    let desktop = 0;
    let tablet = 0;
    let mobile = 0;
    for (const entry of liveEntriesArray) {
      const mode = resolveEntryViewportMode(entry);
      if (mode === "desktop") desktop++;
      else if (mode === "tablet") tablet++;
      else mobile++;
    }
    return { desktop, tablet, mobile, all: liveEntriesArray.length };
  }, [liveEntriesArray]);

  const filteredLiveDomView = useMemo(() => {
    let entries = liveEntriesArray;
    if (selectedComponentFilter === "MOUNTED") {
      entries = entries.filter((e) => Boolean(e?.snapshot));
    } else if (selectedComponentFilter !== "ALL") {
      entries = entries.filter((e) => e?.componentName === selectedComponentFilter);
    }
    if (selectedViewportFilter !== "ALL") {
      entries = entries.filter((e) => resolveEntryViewportMode(e) === selectedViewportFilter);
    }
    if (selectedArtboardFilter !== "ALL") {
      entries = entries.filter((e) => e?.artboardTag === selectedArtboardFilter);
    }
    return {
      updatedAt: liveDom?.updatedAt || null,
      registeredComponentsCount: ECMD_REGISTERED_COMPONENTS.length,
      mountedEntriesCount: liveEntriesArray.length,
      filter: {
        component: selectedComponentFilter,
        viewport: selectedViewportFilter,
        artboard: selectedArtboardFilter,
      },
      activeDiagnosticsCount: diagnosticsStore?.totalActive ?? 0,
      entries,
    };
  }, [
    liveDom,
    liveEntriesArray,
    selectedComponentFilter,
    selectedViewportFilter,
    selectedArtboardFilter,
    diagnosticsStore,
  ]);

  const activeDiagnostics: CanvasDiagnostic[] = diagnosticsStore?.activeDiagnostics || [];

  const categorizedDiagnostics = useMemo(() => {
    const desktop: CanvasDiagnostic[] = [];
    const tablet: CanvasDiagnostic[] = [];
    const mobile: CanvasDiagnostic[] = [];
    const critical: CanvasDiagnostic[] = [];
    const otherBpCritical: CanvasDiagnostic[] = [];

    for (const diag of activeDiagnostics) {
      const bp = getDiagnosticBreakpoint(diag);
      const tier = getDiagnosticSeverityTier(diag);
      if (bp === "desktop") desktop.push(diag);
      else if (bp === "tablet") tablet.push(diag);
      else mobile.push(diag);

      if (tier === "critical") {
        critical.push(diag);
        if (bp !== "desktop") otherBpCritical.push(diag);
      }
    }

    return { desktop, tablet, mobile, critical, otherBpCritical, all: activeDiagnostics };
  }, [activeDiagnostics]);

  useEffect(() => {
    fetchTelemetry();
    if (!autoPoll) return;
    const interval = setInterval(fetchTelemetry, 2000);
    return () => clearInterval(interval);
  }, [autoPoll, fetchTelemetry]);

  const pingSupabase = async () => {
    setSupabasePing({ status: "pinging" });
    try {
      const rows = await carbonQuery<{ cnt: number | string }>(
        "SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema='public'"
      );
      const count = Number(rows?.[0]?.cnt ?? 0);
      setSupabasePing({
        status: "success",
        tableCount: count,
        message: `Verified connection to Supabase lvynkeuceiqxafgpgdvs (${count} public tables ready)`,
        pingTime: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setSupabasePing({
        status: "error",
        message: err?.message || "Failed to reach Supabase bridge",
        pingTime: new Date().toLocaleTimeString(),
      });
    }
  };

  const copyRawTelemetry = () => {
    navigator.clipboard.writeText(JSON.stringify(telemetry, null, 2));
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  const copySidebarBootPrompt = () => {
    navigator.clipboard.writeText(ECMD_SIDEBAR_BOOT_PROMPT);
    setCopiedBootPrompt(true);
    setTimeout(() => setCopiedBootPrompt(false), 2500);
  };

  const copyHydration = () => {
    navigator.clipboard.writeText(JSON.stringify(plasmicHydration, null, 2));
    setCopiedHydration(true);
    setTimeout(() => setCopiedHydration(false), 2000);
  };

  const status = telemetry?.status || "STANDBY";
  const isClean = status === "COMPLETE_CLEAN" || telemetry?.tscClean === true;
  const isRunning = status === "RUNNING";

  return (
    <div className="min-h-screen bg-[#040B14] text-[#F8FAFC] pb-16 font-sans">
      {/* Top Status & Control Bar */}
      <div className="sticky top-14 z-30 border-b border-emerald-500/20 bg-[#071324]/95 backdrop-blur-md px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          {/* Status Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Pen Status Badge */}
            <div
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
                isClean
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                  : isRunning
                  ? "border-sky-500/40 bg-sky-500/15 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.3)]"
                  : "border-rose-500/40 bg-rose-500/15 text-rose-300"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isClean
                    ? "bg-emerald-400"
                    : isRunning
                    ? "bg-sky-400 animate-ping"
                    : "bg-rose-400"
                }`}
              />
              <span>ECMD PEN v4 (agy): {status}</span>
            </div>

            {/* tscClean Badge */}
            <div
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                telemetry?.tscClean
                  ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-400"
                  : telemetry?.tscClean === false
                  ? "border-rose-500/40 bg-rose-950/40 text-rose-400"
                  : "border-slate-800 bg-slate-900/50 text-slate-400"
              }`}
            >
              <span>tscClean:</span>
              <span className="font-bold">
                {telemetry?.tscClean ? "Clean (0 errors)" : telemetry?.tscClean === false ? "Errors Detected" : "Unknown"}
              </span>
            </div>

            {/* Polled Clock */}
            <div className="hidden items-center gap-1.5 rounded-lg border border-slate-800 bg-[#030712] px-2.5 py-1.5 font-mono text-xs text-slate-400 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
              <span>{lastPolled ? `Polled ${lastPolled}` : "Polling..."}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 1-Click Copy Sidebar Boot Prompt Button */}
            <button
              type="button"
              onClick={copySidebarBootPrompt}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-3.5 py-1.5 text-xs font-bold text-emerald-300 shadow-md shadow-emerald-500/10 transition hover:bg-emerald-500/30"
              title="Copy Gemini Sidebar Eyes & Architect boot prompt"
            >
              <span>{copiedBootPrompt ? "✓" : "📋"}</span>
              <span>{copiedBootPrompt ? "Copied Boot Prompt!" : "Copy Sidebar Boot Prompt"}</span>
            </button>

            {/* Auto-Poll Toggle */}
            <button
              type="button"
              onClick={() => setAutoPoll((prev) => !prev)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                autoPoll
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                  : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${autoPoll ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
              <span>Auto-Poll (2s): {autoPoll ? "ON" : "OFF"}</span>
            </button>

            {/* Force Refresh Button */}
            <button
              type="button"
              onClick={fetchTelemetry}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white disabled:opacity-50"
            >
              <span className={isRefreshing ? "animate-spin" : ""}>↻</span>
              <span>Refresh</span>
            </button>

            {/* Ping Supabase Button */}
            <button
              type="button"
              onClick={pingSupabase}
              disabled={supabasePing.status === "pinging"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/30 disabled:opacity-50"
            >
              <span>⚡</span>
              <span>
                {supabasePing.status === "pinging"
                  ? "Pinging DB..."
                  : supabasePing.status === "success"
                  ? `Supabase: Connected (${supabasePing.tableCount} tables)`
                  : "Ping Supabase Schema"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Console Workspace */}
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-8 space-y-6">
        {/* Header Title */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Autonomous Real-Time Diagnostics
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
              ECMD Command Console
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Live status from <strong className="text-emerald-300">ECMD PEN v4 (Antigravity <code className="text-emerald-300">agy</code> Engine)</strong> (<code className="text-emerald-300">/ai-telemetry.json</code>). Grounded with 0ms visual latency for Chrome Sidebar.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/errors"
              className="rounded-lg border border-rose-500/35 bg-rose-950/30 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-900/45"
            >
              Errors &amp; Issues (/errors) ↗
            </Link>
            <Link
              to="/history"
              className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-900/50"
            >
              Action &amp; Turn Log ↗
            </Link>
            <Link
              to="/workflow"
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
            >
              Workflow Guide ↗
            </Link>
          </div>
        </div>

        {/* Dual-AI Architecture & Customer API Key Reminder Banner */}
        <section
          aria-label="Dual-AI Architecture & Customer API Key Reminder"
          className="rounded-2xl border border-amber-500/35 bg-gradient-to-br from-[#0B172A] via-[#081322] to-[#071A19] p-5 shadow-xl sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 pb-3.5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg border border-amber-400/40 bg-amber-500/15 text-sm">
                🛡️
              </span>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-amber-300 sm:text-base">
                  Dual-AI Architecture &amp; Customer API Key Reminder
                </h2>
                <p className="text-xs text-slate-400">
                  Hard security &amp; Google ToS isolation between Owner Local Engineering (<code className="text-sky-300">agy</code>) and Public Customer Site AI (<code className="text-emerald-300">GEMINI_API_KEY</code>).
                </p>
              </div>
            </div>
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 font-mono text-[11px] font-bold text-emerald-300">
              100% ISOLATED ENGINES
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Column 1: Admin & Dev Engine */}
            <div className="rounded-xl border border-sky-500/30 bg-[#05101F]/90 p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-sky-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  1) ADMIN &amp; DEV ENGINE
                </span>
                <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-300 border border-sky-500/20">
                  $0.00/turn · Gemini 4
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-white">
                Antigravity CLI (<code className="text-sky-300">agy</code> v1.5.15)
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Authenticated via personal <code className="text-sky-300">@gmail.com</code> Google OAuth. Strictly for owner/admin local engineering, Plasmic code components, SQL migrations, and internal operations via <code className="text-emerald-300">epen</code>.
              </p>
              <div className="rounded-lg border border-rose-500/35 bg-rose-950/35 px-3 py-2 text-[11px] font-semibold text-rose-200 leading-relaxed">
                ⚠️ NEVER wire <code className="text-rose-100">agy</code> or personal OAuth to public website visitors (Google ToS account-ban &amp; security boundary).
              </div>
            </div>

            {/* Column 2: Customer-Facing Site AI */}
            <div className="rounded-xl border border-emerald-500/35 bg-[#041615]/90 p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  2) CUSTOMER-FACING SITE AI
                </span>
                <span className="rounded bg-emerald-950/70 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                  ALREADY OWNED &amp; CONFIGURED
                </span>
              </div>
              <h3 className="text-sm font-extrabold text-white">
                Dedicated <code className="text-emerald-300">GEMINI_API_KEY</code> (Supabase Edge)
              </h3>
              <p className="text-xs text-emerald-100/95 leading-relaxed">
                <strong className="text-amber-300">REMINDER:</strong> You already have a dedicated Gemini API Key configured for public customer-facing website AI (quotes, package helpers, customer chat) running inside serverless Supabase Edge Functions (<code className="text-emerald-300">ecmd-carbon-bridge</code> / <code className="text-emerald-300">geminiAssistant</code>), 100% isolated from Antigravity (<code className="text-sky-300">agy</code>).
              </p>
              <div className="rounded-lg border border-emerald-500/25 bg-[#030D0D] px-3 py-2 font-mono text-[11px] text-emerald-300">
                ✓ Check Supabase Edge secrets before ever buying a duplicate API key.
              </div>
            </div>
          </div>
        </section>

        {/* Supabase Notification Banner if pinged */}
        {supabasePing.status !== "idle" && (
          <div
            className={`flex items-center justify-between rounded-xl border p-3.5 text-xs ${
              supabasePing.status === "success"
                ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
                : supabasePing.status === "error"
                ? "border-rose-500/40 bg-rose-950/40 text-rose-300"
                : "border-sky-500/40 bg-sky-950/40 text-sky-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{supabasePing.status === "success" ? "✓" : supabasePing.status === "error" ? "✕" : "⏳"}</span>
              <span className="font-semibold">{supabasePing.message}</span>
            </div>
            {supabasePing.pingTime && (
              <span className="font-mono text-[11px] opacity-75">Pinged at {supabasePing.pingTime}</span>
            )}
          </div>
        )}

        {/* Human-Readable CLI Summary Card */}
        <section className="rounded-2xl border border-emerald-500/25 bg-[#06101E]/90 p-5 shadow-xl sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-xs font-bold text-emerald-400">
                ✍️
              </span>
              <div>
                <h2 className="text-base font-bold text-white">ECMD PEN v4 (Antigravity agy Engine) Executive Summary</h2>
                <div className="text-xs text-slate-400">Human-readable readout of the last executed Antigravity agy turn</div>
              </div>
            </div>
            {telemetry?.updatedAt && (
              <span className="rounded-md bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-400">
                Updated: {new Date(telemetry.updatedAt).toLocaleString()}
              </span>
            )}
          </div>

          <div className="mt-4 space-y-4">
            {telemetry?.taskPrompt && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Task Prompt Requested:</div>
                <div className="mt-1 rounded-lg border border-slate-800 bg-[#030710] p-3 text-xs text-slate-300 leading-relaxed font-sans">
                  {telemetry.taskPrompt}
                </div>
              </div>
            )}

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Execution Summary:</div>
              <div className="mt-1 rounded-lg border border-emerald-500/30 bg-[#051412] p-4 text-xs font-sans text-slate-200 leading-relaxed">
                {telemetry?.shortTitle || (telemetry?.humanBullets && telemetry.humanBullets.length > 0) ? (
                  <div className="space-y-3">
                    {telemetry.shortTitle && (
                      <div className="flex items-center gap-2">
                        {telemetry.refCode && (
                          <span className="rounded bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                            {telemetry.refCode}
                          </span>
                        )}
                        <span className="font-bold text-white text-sm">
                          {telemetry.shortTitle}
                        </span>
                      </div>
                    )}

                    {telemetry.humanBullets && telemetry.humanBullets.length > 0 && (
                      <ul className="space-y-1.5 pl-1">
                        {telemetry.humanBullets.map((bullet, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                            <span className="text-emerald-400 font-bold select-none">•</span>
                            <span className="leading-relaxed">{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {telemetry.filesChanged && telemetry.filesChanged.length > 0 && (
                      <div className="pt-2 border-t border-emerald-500/20 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="font-semibold text-slate-400">Files:</span>
                        {telemetry.filesChanged.map((f, i) => (
                          <span key={i} className="rounded bg-slate-900 border border-slate-700/60 px-2 py-0.5 font-mono text-emerald-400">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}

                    {telemetry.errorsSummary && (
                      <div className="text-[11px] font-mono text-slate-400">
                        Errors Status: <span className={telemetry.tscClean ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>{telemetry.errorsSummary}</span>
                      </div>
                    )}

                    {telemetry.cliSummary && (
                      <div className="pt-2 border-t border-emerald-500/10 font-mono text-[11px] text-emerald-300 whitespace-pre-wrap">
                        {telemetry.cliSummary}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="font-mono text-emerald-300 whitespace-pre-wrap">
                    {telemetry?.cliSummary || "Awaiting task from ECMD PEN v4 (Antigravity agy Engine)..."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ECMD PEN v4 Live Step & Self-Heal Feed */}
        <section className="rounded-2xl border border-sky-500/25 bg-[#06101E]/90 p-5 shadow-xl sm:p-6">
          <div
            className="flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none border-b border-slate-800 pb-4"
            onClick={() => setFeedExpanded((prev) => !prev)}
          >
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-500/15 border border-sky-500/40 text-xs font-bold text-sky-400">
                ⚡
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white">ECMD PEN v4 (Antigravity agy) Live Step &amp; Self-Heal Feed</h2>
                  <span className="rounded bg-sky-500/10 px-2 py-0.5 font-mono text-[10px] text-sky-400 border border-sky-500/20">
                    {telemetry?.attemptsLog?.length ?? 0} Steps
                  </span>
                  {isRunning && (
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] text-emerald-300 border border-emerald-500/30 animate-pulse">
                      LIVE STREAMING
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">Real-time Antigravity agy stream-json steps and automatic self-heal audits</div>
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                setFeedExpanded((prev) => !prev);
              }}
            >
              {feedExpanded ? "Collapse ▲" : "Expand ▼"}
            </button>
          </div>

          {feedExpanded && (
            <div className="mt-4">
              {Array.isArray(telemetry?.attemptsLog) && telemetry.attemptsLog.length > 0 ? (
                <div className="max-h-80 overflow-y-auto space-y-1 rounded-xl border border-slate-800 bg-[#02050B] p-3.5 font-mono text-xs">
                  {telemetry.attemptsLog.map((line, idx) => {
                    const isSelfHealOrWarn =
                      line.includes("SELF-HEAL TRIGGERED") ||
                      line.includes("AGY INFO/WARN") ||
                      line.includes("CLI WARN") ||
                      line.includes("WARN") ||
                      line.includes("SELF-HEAL");
                    return (
                      <div
                        key={idx}
                        className={`leading-relaxed px-2 py-1 rounded transition-colors ${
                          isSelfHealOrWarn
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold"
                            : "text-slate-300 hover:bg-slate-900/40"
                        }`}
                      >
                        {line}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-800/80 bg-[#02050B] p-4 text-xs font-mono text-slate-500 italic">
                  Awaiting active ECMD PEN v4 (Antigravity agy) steps...
                </div>
              )}
            </div>
          )}
        </section>

        {/* 0ms Machine-Readable Telemetry Node for Chrome Sidebar */}
        <section className="rounded-2xl border border-emerald-500/25 bg-[#06101E]/90 p-5 shadow-xl sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-500/15 border border-sky-500/40 text-xs font-bold text-sky-400">
                0ms
              </span>
              <div>
                <h2 className="text-base font-bold text-white">
                  Machine-Readable Telemetry Node (<code className="text-sky-400 text-xs font-mono">#ecmd-live-pen-telemetry</code>)
                </h2>
                <div className="text-xs text-slate-400">
                  Chrome Gemini Sidebar (Eyes) reads this DOM node with 0ms visual latency to verify build results.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={copyRawTelemetry}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-bold text-slate-200 transition hover:bg-slate-700"
            >
              {copiedRaw ? "✓ Copied JSON" : "Copy Raw JSON"}
            </button>
          </div>

          {/* Crisp Scannable Live Telemetry Card (refCode, shortTitle, humanBullets) */}
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-[#040E1B] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-1 font-mono text-xs font-black text-emerald-300">
                  {telemetry?.refCode || "TURN-LIVE"}
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    isClean
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : isRunning
                      ? "bg-sky-500/20 text-sky-300 border border-sky-500/30 animate-pulse"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  }`}
                >
                  {status}
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                    telemetry?.tscClean
                      ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20"
                      : "bg-rose-950/40 text-rose-400 border border-rose-500/20"
                  }`}
                >
                  {telemetry?.tscClean ? "tsc: 0 errors" : "tsc: Checking..."}
                </span>
              </div>
              {telemetry?.updatedAt && (
                <span className="font-mono text-[11px] text-slate-400">
                  {new Date(telemetry.updatedAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                {telemetry?.shortTitle || (telemetry?.cliSummary ? telemetry.cliSummary.split("\n")[0] : "ECMD PEN v4 (Antigravity agy) Status")}
              </h3>

              {/* Crisp Human Bullets */}
              <ul className="space-y-1.5 text-xs text-slate-300">
                {(Array.isArray(telemetry?.humanBullets) && telemetry.humanBullets.length > 0
                  ? telemetry.humanBullets
                  : (telemetry?.cliSummary || "")
                      .split("\n")
                      .map((l) => l.trim())
                      .filter((l) => /^[-*•\d+.]\s+/.test(l))
                      .map((l) => l.replace(/^[-*•\d+.]\s+/, "").replace(/\*\*/g, "").trim())
                      .filter((l) => l.length > 10 && !l.startsWith("Run ") && !l.startsWith("<<<"))
                      .slice(0, 4)
                      .concat(
                        (telemetry?.cliSummary || "").split("\n").filter((l) => /^[-*•\d+.]\s+/.test(l)).length === 0
                          ? ["Awaiting next engineering task from Chrome Sidebar..."]
                          : []
                      )
                ).map((bullet: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-emerald-400 font-bold mt-0.5 text-xs">▸</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>

              {/* Files changed & errors summary */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/60">
                {Array.isArray(telemetry?.filesChanged) && telemetry.filesChanged.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Files:
                    </span>
                    {telemetry.filesChanged.map((file: string, fIdx: number) => (
                      <span
                        key={fIdx}
                        className="rounded border border-slate-800 bg-[#02050B] px-2 py-0.5 font-mono text-[10px] text-emerald-300/90"
                      >
                        {file}
                      </span>
                    ))}
                  </div>
                )}
                {telemetry?.errorsSummary && (
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-400">
                    <span>✓</span>
                    <span>{telemetry.errorsSummary}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <pre
              id="ecmd-live-pen-telemetry"
              className="max-h-96 overflow-auto rounded-xl border border-slate-800 bg-[#02050B] p-4 font-mono text-xs text-sky-400 leading-relaxed"
            >
              {telemetry ? JSON.stringify(telemetry, null, 2) : "Fetching /ai-telemetry.json..."}
            </pre>
          </div>
        </section>

        {/* Compact Canvas & Unified Errors Summary Card pointing to /errors */}
        <section
          id="ecmd-canvas-diagnostics"
          className={`mt-8 rounded-2xl border p-5 shadow-2xl ${
            categorizedDiagnostics.critical.length > 0
              ? "border-rose-500/45 bg-[#120C17]"
              : categorizedDiagnostics.desktop.length > 0
              ? "border-amber-500/45 bg-[#0D101B]"
              : activeDiagnostics.length > 0
              ? "border-sky-500/35 bg-[#07101E]"
              : "border-emerald-500/25 bg-[#070D18]"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
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
                  Canvas Diagnostics &amp; Unified Errors Center
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
                Desktop: <strong className="text-slate-200">{categorizedDiagnostics.desktop.length}</strong> · Tablet:{" "}
                <strong className="text-slate-200">{categorizedDiagnostics.tablet.length}</strong> · Mobile:{" "}
                <strong className="text-slate-200">{categorizedDiagnostics.mobile.length}</strong> · Critical:{" "}
                <strong className="text-rose-300">{categorizedDiagnostics.critical.length}</strong>. Full Compiler/TSC, Canvas 3-Tier Breakpoint Tabs, Runtime JS Errors, and <code className="text-sky-300">#ecmd-unified-errors-json</code> live on <code className="text-emerald-300">/errors</code>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => dismissDiagnostic({ clearResolved: true })}
                className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
              >
                Clear Resolved
              </button>
              <Link
                to="/errors"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3.5 py-1.5 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/30"
              >
                <span>Open Errors &amp; Issues (/errors)</span>
                <span>↗</span>
              </Link>
            </div>
          </div>
        </section>

        {/* 0ms Live Component DOM, Size & Spacing Inspector */}
        <section className="mt-8 rounded-2xl border border-sky-500/25 bg-[#070D18] p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-500/15 border border-sky-500/40 text-xs font-bold text-sky-300">
                  DOM
                </span>
                <h2 className="text-lg font-bold text-white">
                  0ms Live Component DOM, Size &amp; Spacing Inspector (
                  <code className="text-sky-400 text-xs font-mono">#ecmd-live-component-dom</code>)
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Real-time post-edit DOM tree, bounding rects, box-model padding/margin/gap, flex/grid styles, <code className="text-emerald-300">data-ecmd-*</code> hooks, and matched <strong className="text-slate-200">Site Themes</strong> groups (<strong className="text-emerald-300">Theme Groups Inspector</strong> = <code className="text-emerald-300">[Site Themes] -&gt; Groups</code> w/ sticky Search + Auto A–Z Natural Sort + Pinning + Collapse/Expand All, in-card <code className="text-emerald-300">Copy Attributes From ▾</code> w/ <code className="text-emerald-300">All States / This State / All Themes</code> + 1-click <code className="text-emerald-300">Undo</code>, <strong className="text-emerald-200">Live Canvas State Preview</strong> <code className="text-emerald-300">[👁️ Showing &lt;State&gt; on Canvas]</code>, Border <code className="text-emerald-300">Off / 0px</code>, Width &amp; Style controls · <strong className="text-sky-300">Image Groups Inspector</strong> = <code className="text-sky-300">[Site Themes] -&gt; Images</code> w/ <code className="text-sky-300">Copy Attributes From ▾</code> · <strong className="text-violet-300">Design Tokens</strong> = <code className="text-violet-300">[Site Themes] -&gt; Tokens</code>) streamed from Plasmic Studio iframes (<code className="text-sky-300">/plasmic-live-dom.json</code>).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={triggerCanvasSnapshotNow}
                disabled={isSnapshotting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400/50 bg-sky-500/20 px-3 py-1.5 text-xs font-bold text-sky-200 transition hover:bg-sky-500/30 disabled:opacity-60"
              >
                <span>📸</span>
                <span>{isSnapshotting ? "Snapshotting..." : "Snapshot Canvas Now"}</span>
              </button>
              <button
                type="button"
                onClick={copyLiveDom}
                className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
              >
                {copiedLiveDom ? "✓ Copied" : "Copy Live DOM JSON"}
              </button>
            </div>
          </div>

          {/* Dynamic Filter Pills auto-generated from ECMD_REGISTERED_COMPONENTS */}
          <div className="mt-4 space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedComponentFilter("ALL")}
                className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${
                  selectedComponentFilter === "ALL"
                    ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                    : "border-slate-700 bg-slate-900/70 text-slate-400 hover:text-white"
                }`}
              >
                All ({ECMD_REGISTERED_COMPONENTS.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedComponentFilter("MOUNTED")}
                className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${
                  selectedComponentFilter === "MOUNTED"
                    ? "border-sky-400/60 bg-sky-500/20 text-sky-200"
                    : "border-slate-700 bg-slate-900/70 text-slate-400 hover:text-white"
                }`}
              >
                Mounted Only ({liveEntriesArray.length})
              </button>
              {componentFilterPills.map((comp) => (
                <button
                  key={comp.name}
                  type="button"
                  onClick={() => setSelectedComponentFilter(comp.name)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                    selectedComponentFilter === comp.name
                      ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                      : comp.mountedCount > 0
                      ? "border-sky-500/35 bg-sky-950/35 text-sky-300 hover:bg-sky-900/40"
                      : "border-slate-800 bg-slate-950/70 text-slate-400 hover:text-slate-200"
                  }`}
                  title={comp.displayName}
                >
                  <span>{comp.name}</span>
                  {comp.mountedCount > 0 && (
                    <span className="rounded-full bg-emerald-500/25 px-1.5 text-[10px] font-mono text-emerald-300">
                      {comp.mountedCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* 3-Tier Breakpoint Filter Pills for Live Component DOM */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="font-mono uppercase text-slate-500">Breakpoint:</span>
              {(
                [
                  { id: "ALL", label: `All (${liveDomCountsByViewport.all})` },
                  { id: "desktop", label: `🖥️ Desktop (${liveDomCountsByViewport.desktop})` },
                  { id: "tablet", label: `📱 Tablet (${liveDomCountsByViewport.tablet})` },
                  { id: "mobile", label: `📲 Mobile (${liveDomCountsByViewport.mobile})` },
                ] as const
              ).map((bpPill) => (
                <button
                  key={bpPill.id}
                  type="button"
                  data-ecmd-live-dom-bp-pill={bpPill.id}
                  onClick={() => {
                    setSelectedViewportFilter(bpPill.id);
                    setSelectedArtboardFilter("ALL");
                  }}
                  className={`rounded-full border px-2.5 py-0.5 font-semibold transition ${
                    selectedViewportFilter === bpPill.id
                      ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                      : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                  }`}
                >
                  {bpPill.label}
                </button>
              ))}
            </div>

            {availableArtboards.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="font-mono uppercase text-slate-500">Artboard:</span>
                <button
                  type="button"
                  onClick={() => setSelectedArtboardFilter("ALL")}
                  className={`rounded border px-2 py-0.5 font-mono transition ${
                    selectedArtboardFilter === "ALL"
                      ? "border-sky-400/50 bg-sky-500/20 text-sky-200"
                      : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                  }`}
                >
                  All ({availableArtboards.length})
                </button>
                {availableArtboards.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedArtboardFilter(tag)}
                    className={`rounded border px-2 py-0.5 font-mono transition ${
                      selectedArtboardFilter === tag
                        ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                        : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4">
            <pre
              id="ecmd-live-component-dom"
              className="max-h-96 overflow-auto rounded-xl border border-slate-800 bg-[#02050B] p-4 font-mono text-xs text-sky-300 leading-relaxed"
            >
              {JSON.stringify(filteredLiveDomView, null, 2)}
            </pre>
          </div>
        </section>

        {/* Plasmic Page Layout & Element Map (0ms Chrome Sidebar AI Grounding) */}
        <section className="mt-8 rounded-2xl border border-slate-800 bg-[#070D18] p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h2 className="text-lg font-bold text-white">Plasmic Page Layout &amp; Element Map</h2>
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400 border border-emerald-500/20">
                  0ms Sidebar Grounding
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Machine-readable Plasmic layout hierarchy, controller IDs, slots, and interactive DOM hooks.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-slate-400">
                Components: <strong className="text-emerald-400">{plasmicHydration?.componentsCount ?? 0}</strong>
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Project: <code className="text-sky-300">{plasmicHydration?.projectId ?? "mrkoQykvpZZfVbEc1yjabw"}</code>
              </span>
              <button
                type="button"
                onClick={copyHydration}
                className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-300 hover:border-slate-600 hover:text-white transition"
              >
                {copiedHydration ? "✓ Copied" : "Copy Map JSON"}
              </button>
            </div>
          </div>

          <div className="mt-4">
            <pre
              id="ecmd-plasmic-layout-map"
              className="max-h-96 overflow-auto rounded-xl border border-slate-800 bg-[#02050B] p-4 font-mono text-xs text-emerald-400 leading-relaxed"
            >
              {plasmicHydration ? JSON.stringify(plasmicHydration, null, 2) : "Fetching /plasmic-layout-hydration.json..."}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}
