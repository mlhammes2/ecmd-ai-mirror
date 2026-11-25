import React, { useState, useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { carbonQuery } from "../integrations/supabase/client";

export interface HistoryRecord {
  refCode?: string;
  id: string;
  date: string;
  timestamp: string;
  updatedAt: string;
  status: "COMPLETE_CLEAN" | "RUNNING" | "NEEDS_ATTENTION" | string;
  exitCode: number;
  tscClean: boolean;
  shortTitle?: string;
  humanBullets?: string[];
  filesChanged?: string[];
  errorsSummary?: string;
  taskPrompt?: string;
  rawCliOutput?: string;
  cliSummary?: string;
  cliStderr?: string;
  tscOutput?: string;
}

export default function History() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "CLEAN" | "ATTENTION">("ALL");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [activeSubTab, setActiveSubTab] = useState<Record<string, "errors" | "prompt" | "trace">>({});
  const [copiedRef, setCopiedRef] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [supabaseSyncStatus, setSupabaseSyncStatus] = useState<string>("");

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/ai-history.json?t=" + Date.now());
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setRecords(data);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const copyRefCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedRef(code);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
    if (!activeSubTab[id]) {
      setActiveSubTab((prev) => ({ ...prev, [id]: "errors" }));
    }
  };

  const setSubTab = (id: string, tab: "errors" | "prompt" | "trace") => {
    setActiveSubTab((prev) => ({ ...prev, [id]: tab }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    records.forEach((r) => { next[r.id] = true; });
    setExpandedIds(next);
  };

  const collapseAll = () => {
    setExpandedIds({});
  };

  // Sync turn from Supabase if trace missing
  const fetchSupabaseTurn = async (refCode: string, id: string) => {
    try {
      setSupabaseSyncStatus(`Fetching ${refCode} from Supabase...`);
      const rows = await carbonQuery<any>(
        `SELECT * FROM public.ecmd_pen_turns WHERE ref_code = '${refCode}' LIMIT 1`
      );
      if (rows && rows.length > 0) {
        const row = rows[0];
        setRecords((prev) =>
          prev.map((r) => {
            if (r.id === id || r.refCode === refCode) {
              return {
                ...r,
                shortTitle: row.short_title || r.shortTitle,
                humanBullets: row.human_bullets || r.humanBullets,
                filesChanged: row.files_changed || r.filesChanged,
                errorsSummary: row.errors_summary || r.errorsSummary,
                taskPrompt: row.task_prompt || r.taskPrompt,
                rawCliOutput: row.raw_cli_output || r.rawCliOutput,
                tscOutput: row.tsc_output || r.tscOutput
              };
            }
            return r;
          })
        );
        setSupabaseSyncStatus(`Synced ${refCode} live from Supabase!`);
        setTimeout(() => setSupabaseSyncStatus(""), 3000);
      }
    } catch {
      setSupabaseSyncStatus(`Notice: Local record active.`);
      setTimeout(() => setSupabaseSyncStatus(""), 3000);
    }
  };

  // Filter and sort records
  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        if (statusFilter === "CLEAN" && !(r.status === "COMPLETE_CLEAN" || r.tscClean)) return false;
        if (statusFilter === "ATTENTION" && (r.status === "COMPLETE_CLEAN" || r.tscClean)) return false;
        if (!searchTerm.trim()) return true;
        const q = searchTerm.toLowerCase();
        return (
          r.refCode?.toLowerCase().includes(q) ||
          r.shortTitle?.toLowerCase().includes(q) ||
          r.humanBullets?.some((b) => b.toLowerCase().includes(q)) ||
          r.filesChanged?.some((f) => f.toLowerCase().includes(q)) ||
          r.taskPrompt?.toLowerCase().includes(q) ||
          r.cliSummary?.toLowerCase().includes(q) ||
          r.date?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  }, [records, searchTerm, statusFilter]);

  // Group by date header
  const groupedRecords = useMemo(() => {
    const groups: { [date: string]: HistoryRecord[] } = {};
    filteredRecords.forEach((record) => {
      const dateKey = record.date || "Today";
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(record);
    });
    return groups;
  }, [filteredRecords]);

  return (
    <div className="min-h-screen bg-[#040B14] text-[#F8FAFC] pb-16 font-sans">
      {/* Header Banner */}
      <div className="border-b border-emerald-500/20 bg-gradient-to-b from-[#062825] to-[#040B14] px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Autonomous Action Log &amp; Reference Codes
              </div>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Action &amp; Turn Log
              </h1>
              <p className="mt-1 max-w-2xl text-xs text-slate-300">
                Synchronized live between <code className="text-emerald-300">public.ecmd_pen_turns</code> and <code className="text-emerald-300">run-pen-task.mjs</code>. Reference any turn to Gemini in Chrome Sidebar using its unique <code className="text-emerald-300">TURN-XXX</code> code.
              </p>
              {supabaseSyncStatus && (
                <div className="mt-2 text-xs text-emerald-400 font-mono animate-fade-in">
                  ⚡ {supabaseSyncStatus}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchHistory}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
              >
                <span className={isLoading ? "animate-spin" : ""}>↻</span>
                <span>Refresh Log</span>
              </button>
              <Link
                to="/console"
                className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 shadow-md shadow-emerald-500/20"
              >
                Command Console ↗
              </Link>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-[#071324]/80 p-3">
            <div className="flex flex-1 items-center gap-2 min-w-[240px]">
              <span className="text-slate-400 text-sm">🔍</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search reference code (e.g. TURN-001), short title, files, or bullets..."
                className="w-full rounded-lg border border-slate-800 bg-[#030712] px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="text-xs text-slate-400 hover:text-white px-1.5"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-slate-800 bg-[#030712] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className={`rounded-md px-2.5 py-1 font-semibold transition ${
                    statusFilter === "ALL" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:text-white"
                  }`}
                >
                  All ({records.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("CLEAN")}
                  className={`rounded-md px-2.5 py-1 font-semibold transition ${
                    statusFilter === "CLEAN" ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Clean
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("ATTENTION")}
                  className={`rounded-md px-2.5 py-1 font-semibold transition ${
                    statusFilter === "ATTENTION" ? "bg-rose-500/20 text-rose-300" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Needs Attention
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={expandAll}
                  className="rounded border border-slate-800 bg-slate-900/60 px-2 py-1 text-slate-400 hover:text-white"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="rounded border border-slate-800 bg-slate-900/60 px-2 py-1 text-slate-400 hover:text-white"
                >
                  Collapse All
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grouped History Feed */}
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-8 space-y-8">
        {Object.keys(groupedRecords).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-[#06101E]/40 p-12 text-center">
            <div className="text-3xl mb-2">📜</div>
            <div className="text-base font-bold text-white">No Action Turns Match Filter</div>
            <p className="mt-1 text-xs text-slate-400">
              {searchTerm ? "Try broadening your search query or reset the filter." : "Gemini CLI runs will appear here automatically."}
            </p>
            {searchTerm && (
              <button
                type="button"
                onClick={() => { setSearchTerm(""); setStatusFilter("ALL"); }}
                className="mt-4 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          Object.entries(groupedRecords).map(([dateHeader, dayRecords]) => (
            <div key={dateHeader} className="space-y-4">
              {/* Date Header Strip */}
              <div className="sticky top-28 z-20 flex items-center gap-3 bg-[#040B14]/90 backdrop-blur py-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-300">
                  {dateHeader}
                </h2>
                <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                  {dayRecords.length} turn{dayRecords.length === 1 ? "" : "s"}
                </span>
                <div className="h-[1px] flex-1 bg-gradient-to-r from-emerald-500/20 to-transparent" />
              </div>

              {/* Cards for this day */}
              <div className="space-y-4">
                {dayRecords.map((record, index) => {
                  const isExpanded = !!expandedIds[record.id];
                  const isClean = record.status === "COMPLETE_CLEAN" || record.tscClean;
                  const refCode = record.refCode || `TURN-${String(dayRecords.length - index).padStart(3, "0")}`;
                  const currentSubTab = activeSubTab[record.id] || "errors";

                  // Extract bullets with robust fallback for older seed records (max 4-5 concise bullets)
                  const bullets = Array.isArray(record.humanBullets) && record.humanBullets.length > 0
                    ? record.humanBullets.slice(0, 5)
                    : (record.cliSummary || record.rawCliOutput || "")
                        .split("\n")
                        .map(l => l.trim())
                        .filter(l => /^[-*•\d+.]\s+/.test(l))
                        .map(l => l.replace(/^[-*•\d+.]\s+/, "").replace(/\*\*/g, "").trim())
                        .filter(l => l.length > 10 && !l.startsWith("Run ") && !l.startsWith("<<<"))
                        .slice(0, 4)
                        .concat(
                          (record.cliSummary || record.rawCliOutput || "").split("\n").filter(l => /^[-*•\d+.]\s+/.test(l)).length === 0
                            ? ["Executed codebase modifications and validated TypeScript compiler cleanly."]
                            : []
                        );

                  const title = record.shortTitle || record.cliSummary?.split("\n")[0]?.replace(/^#+\s*/, "") || "Autonomous Engineering Turn";
                  const files = Array.isArray(record.filesChanged) && record.filesChanged.length > 0
                    ? record.filesChanged
                    : [];

                  return (
                    <article
                      key={record.id}
                      className="rounded-2xl border border-emerald-500/20 bg-[#06101E]/90 p-5 shadow-lg transition hover:border-emerald-500/40"
                    >
                      {/* Card Top Row */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          {/* Copyable Reference Code Badge */}
                          <button
                            type="button"
                            onClick={() => copyRefCode(refCode)}
                            title="Click to copy Turn Reference Code"
                            className="group inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-1 font-mono text-xs font-black text-emerald-300 transition hover:bg-emerald-500 hover:text-slate-950"
                          >
                            <span>{refCode}</span>
                            <span className="text-[10px] text-emerald-400 group-hover:text-slate-950">
                              {copiedRef === refCode ? "✓ Copied" : "📋"}
                            </span>
                          </button>

                          <span className="font-mono text-xs text-slate-400">
                            {record.timestamp}
                          </span>

                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                              isClean
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                            }`}
                          >
                            {record.status}
                          </span>

                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                              record.tscClean
                                ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20"
                                : "bg-rose-950/40 text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            {record.tscClean ? "tsc: 0 errors" : "tsc: Fail"}
                          </span>

                          <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                            exit: {record.exitCode ?? 0}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleExpand(record.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white"
                        >
                          <span>{isExpanded ? "Hide Dissection ▲" : "Dissect Attempts & Errors ▼"}</span>
                        </button>
                      </div>

                      {/* Main Card Body (Crisp & Human-Readable) */}
                      <div className="mt-3.5 space-y-2.5">
                        <h3 className="text-sm font-bold text-white tracking-tight leading-snug">
                          {title}
                        </h3>

                        {/* Plain-English Action Bullets */}
                        <ul className="space-y-1.5 text-xs text-slate-300">
                          {bullets.map((bullet, idx) => (
                            <li key={idx} className="flex items-start gap-2 leading-relaxed">
                              <span className="text-emerald-400 font-bold mt-0.5 text-xs">▸</span>
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>

                        {/* Compact File Pills */}
                        {files.length > 0 && (
                          <div className="pt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                              Files:
                            </span>
                            {files.map((file, fIdx) => (
                              <span
                                key={fIdx}
                                className="rounded border border-slate-800 bg-[#02050B] px-2 py-0.5 font-mono text-[10px] text-emerald-300/90"
                              >
                                {file}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Errors Summary Pill */}
                        <div className="pt-1 flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Compiler / Check:
                          </span>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                              record.tscClean
                                ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
                                : "border-rose-500/30 bg-rose-950/40 text-rose-300"
                            }`}
                          >
                            <span>{record.tscClean ? "✓" : "⚠"}</span>
                            <span>{record.errorsSummary || (record.tscClean ? "0 compiler or runtime errors" : "Errors detected")}</span>
                          </span>
                        </div>
                      </div>

                      {/* Expandable Dissection View */}
                      {isExpanded && (
                        <div className="mt-4 border-t border-slate-800/90 pt-4 space-y-3">
                          {/* Sub-tab navigation */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSubTab(record.id, "errors")}
                                className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                                  currentSubTab === "errors"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : "text-slate-400 hover:text-white"
                                }`}
                              >
                                Errors &amp; Compiler Check
                              </button>
                              <button
                                type="button"
                                onClick={() => setSubTab(record.id, "prompt")}
                                className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                                  currentSubTab === "prompt"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : "text-slate-400 hover:text-white"
                                }`}
                              >
                                Prompt Sent
                              </button>
                              <button
                                type="button"
                                onClick={() => setSubTab(record.id, "trace")}
                                className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                                  currentSubTab === "trace"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : "text-slate-400 hover:text-white"
                                }`}
                              >
                                Full CLI Output
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => fetchSupabaseTurn(refCode, record.id)}
                              className="text-[11px] text-emerald-400/80 hover:text-emerald-300 font-mono"
                            >
                              Fetch Live from Supabase ⚡
                            </button>
                          </div>

                          {/* Sub-tab Content: Errors & Compiler Output */}
                          {currentSubTab === "errors" && (
                            <div className="space-y-3">
                              <div className="rounded-lg border border-slate-800 bg-[#02050B] p-3 text-xs">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                  Errors Summary:
                                </div>
                                <div className={`font-mono ${record.tscClean ? "text-emerald-400" : "text-rose-400"}`}>
                                  {record.errorsSummary || (record.tscClean ? "0 compiler or runtime errors" : "Compilation or exit status issues encountered")}
                                </div>
                              </div>

                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between mb-1">
                                  <span>TypeScript Compiler Output (npx tsc --noEmit):</span>
                                  <span className={record.tscClean ? "text-emerald-400" : "text-rose-400"}>
                                    {record.tscClean ? "✓ Clean" : "✕ Errors"}
                                  </span>
                                </div>
                                <pre
                                  className={`max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border p-3 font-mono text-xs leading-relaxed ${
                                    record.tscClean
                                      ? "border-emerald-500/20 bg-[#02050B] text-emerald-400/90"
                                      : "border-rose-500/30 bg-[#160608] text-rose-300"
                                  }`}
                                >
                                  {record.tscOutput?.trim() || "✓ Clean compilation: 0 TypeScript errors detected."}
                                </pre>
                              </div>

                              {record.cliStderr && (
                                <div>
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                    CLI Stderr:
                                  </div>
                                  <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border border-amber-500/30 bg-[#160D04] p-3 font-mono text-xs text-amber-300 leading-relaxed">
                                    {record.cliStderr}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Sub-tab Content: Injected Prompt */}
                          {currentSubTab === "prompt" && (
                            <div>
                              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                <span>Task Prompt Dispatched to Gemini CLI:</span>
                                <button
                                  type="button"
                                  onClick={() => copyRefCode(record.taskPrompt || "")}
                                  className="text-emerald-400 hover:text-emerald-300"
                                >
                                  Copy Prompt 📋
                                </button>
                              </div>
                              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-[#02050B] p-3 font-mono text-xs text-slate-300 leading-relaxed">
                                {record.taskPrompt || "(No prompt recorded)"}
                              </pre>
                            </div>
                          )}

                          {/* Sub-tab Content: Raw CLI Trace */}
                          {currentSubTab === "trace" && (
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                Raw Execution Output:
                              </div>
                              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-[#02050B] p-3 font-mono text-xs text-slate-300 leading-relaxed">
                                {record.rawCliOutput || record.cliSummary || "(No raw CLI trace available)"}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
