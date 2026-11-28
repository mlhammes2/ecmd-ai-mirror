import React, { useCallback, useEffect, useState } from "react";

export interface PsPayload {
  updatedAt?: string;
  source?: string;
  exitCode?: number;
  summary?: string;
  output?: string;
}

function getPsFetchInit(): RequestInit {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return { cache: "no-store", signal: AbortSignal.timeout(8000) };
  }
  return { cache: "no-store" };
}

export function formatPowerShellResultsText(data: PsPayload | null): string {
  if (!data) {
    return "No PowerShell output recorded yet. Waiting for /powershell-results.json.";
  }
  return [
    "=== POWERSHELL ERRORS & TERMINAL OUTPUT ===",
    `Source: ${data.source || "PowerShell"}`,
    `Updated: ${data.updatedAt || ""}`,
    `Exit Code: ${typeof data.exitCode === "number" ? data.exitCode : 0}`,
    data.summary ? `Summary: ${data.summary}` : "",
    "---",
    data.output || "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function fetchPowerShellResults(): Promise<PsPayload | null> {
  try {
    const res = await fetch("/powershell-results.json?_=" + Date.now(), getPsFetchInit());
    if (!res.ok) return null;
    return (await res.json()) as PsPayload;
  } catch {
    return null;
  }
}

export async function copyPowerShellErrorsText(fallbackText?: string): Promise<string> {
  const data = await fetchPowerShellResults();
  const formatted = data ? formatPowerShellResultsText(data) : (fallbackText || formatPowerShellResultsText(null));
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    await navigator.clipboard.writeText(formatted);
    return formatted;
  }
  if (typeof document !== "undefined") {
    const area = document.getElementById("ps-only-output-textarea") as HTMLTextAreaElement | null;
    if (area) {
      area.select();
      document.execCommand("copy");
    }
  }
  return formatted;
}

export function PsOnlyOutputPanel() {
  const [payload, setPayload] = useState<PsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadResults = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchPowerShellResults();
      if (data) setPayload(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadResults();
    const timer = window.setInterval(() => {
      void loadResults();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [loadResults]);

  const failed = typeof payload?.exitCode === "number" && payload.exitCode !== 0;
  const textVal = formatPowerShellResultsText(payload);

  async function handleCopy() {
    try {
      await copyPowerShellErrorsText(textVal);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const area = document.getElementById("ps-only-output-textarea") as HTMLTextAreaElement | null;
      if (area) {
        area.select();
        document.execCommand("copy");
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    }
  }

  return (
    <section
      id="ecmd-ps-errors-output-box"
      data-testid="ecmd-ps-errors-output-box"
      aria-label="PowerShell Errors & Terminal Output"
      className={`rounded-2xl border p-5 shadow-xl sm:p-6 ${
        failed
          ? "border-rose-500/50 bg-[#180B14]"
          : "border-sky-500/35 bg-[#061224]/95"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <span
            className={`grid h-7 w-7 place-items-center rounded-lg border font-mono text-xs font-bold ${
              failed
                ? "border-rose-500/50 bg-rose-500/15 text-rose-300"
                : "border-sky-400/45 bg-sky-500/15 text-sky-300"
            }`}
          >
            PS
          </span>
          <div>
            <h2 className="text-base font-bold text-white">
              PowerShell Errors &amp; Terminal Output
            </h2>
            <div className="text-xs text-slate-400">
              Live PowerShell run results from{" "}
              <code className="text-sky-300">/powershell-results.json</code>{" "}
              (isolated from{" "}
              <code className="text-slate-300">#ecmd-unified-errors-json</code>)
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-bold ${
              failed
                ? "border-rose-500/50 bg-rose-500/20 text-rose-200"
                : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
            }`}
          >
            {payload
              ? failed
                ? `🚨 Exit ${payload.exitCode}`
                : `✓ Exit ${payload.exitCode ?? 0}`
              : "Waiting..."}
          </span>

          <button
            type="button"
            onClick={() => {
              void loadResults();
            }}
            disabled={isLoading}
            className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
          >
            {isLoading ? "Refreshing..." : "Refresh PS"}
          </button>

          <button
            id="ecmd-ps-box-copy-btn"
            type="button"
            onClick={() => {
              void handleCopy();
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
              copied
                ? "border-emerald-400/60 bg-emerald-500/25 text-emerald-200"
                : failed
                ? "border-rose-400/60 bg-rose-500/25 text-rose-100 hover:bg-rose-500/35"
                : "border-sky-400/55 bg-sky-500/20 text-sky-200 hover:bg-sky-500/30"
            }`}
          >
            <span>{copied ? "✓" : "📋"}</span>
            <span>{copied ? "Copied PS Errors" : "Copy PS Errors"}</span>
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#030710] px-4 py-2.5 text-xs text-slate-300">
          <span>
            <strong className="text-slate-200">
              {payload?.source || "PowerShell"}:
            </strong>{" "}
            {payload?.summary || "Waiting for latest PowerShell output..."}
          </span>
          {payload?.updatedAt && (
            <span className="font-mono text-[10px] text-slate-400">
              {new Date(payload.updatedAt).toLocaleString()}
            </span>
          )}
        </div>

        <textarea
          id="ps-only-output-textarea"
          readOnly
          rows={6}
          value={textVal}
          aria-label="PowerShell Errors and Terminal Output Log"
          className={`w-full rounded-xl border bg-[#020612] p-3.5 font-mono text-xs leading-relaxed focus:outline-none ${
            failed
              ? "border-rose-500/40 text-rose-200"
              : "border-slate-800 text-sky-200"
          }`}
        />
      </div>
    </section>
  );
}
