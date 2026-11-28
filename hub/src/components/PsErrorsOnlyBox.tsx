import React, { useEffect, useState } from "react";

export interface PsErrorBoxData {
  updatedAt?: string;
  source?: string;
  exitCode?: number;
  summary?: string;
  output?: string;
}

export function PsErrorsOnlyBox() {
  const [ps, setPs] = useState<PsErrorBoxData | null>(null);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    try {
      const r = await fetch("/powershell-results.json?_=" + Date.now(), { cache: "no-store" });
      if (!r.ok) return;
      setPs(await r.json());
    } catch {}
  }

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 2500);
    return () => window.clearInterval(t);
  }, []);

  const isErr = typeof ps?.exitCode === "number" && ps.exitCode !== 0;

  const formatted = ps
    ? [
        "=== POWERSHELL ERRORS & OUTPUT ===",
        "Source: " + (ps.source || "PowerShell"),
        "Updated: " + (ps.updatedAt || ""),
        "Exit Code: " + (typeof ps.exitCode === "number" ? ps.exitCode : 0),
        ps.summary ? "Summary: " + ps.summary : "",
        "---",
        ps.output || ""
      ].filter(Boolean).join("\n")
    : "No PowerShell output recorded yet.";

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const el = document.getElementById("ps-errors-only-output") as HTMLTextAreaElement | null;
      if (el) {
        el.select();
        document.execCommand("copy");
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    }
  }

  return (
    <section
      id="ps-errors-only-box"
      aria-label="PowerShell Errors & Terminal Output"
      style={{
        margin: "12px 0 16px",
        padding: 14,
        borderRadius: 10,
        border: isErr ? "2px solid #ef4444" : "1px solid rgba(56, 189, 248, 0.55)",
        background: isErr ? "rgba(69, 10, 10, 0.9)" : "rgba(15, 23, 42, 0.92)",
        color: "#f8fafc"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            PowerShell Errors &amp; Terminal Output {isErr ? "(ERROR Exit " + ps?.exitCode + ")" : "(OK)"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {ps?.updatedAt ? "Updated: " + ps.updatedAt : "Waiting for /powershell-results.json"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={refresh}
            style={{
              padding: "5px 10px",
              borderRadius: 6,
              border: "1px solid rgba(148,163,184,0.4)",
              background: "transparent",
              color: "#e2e8f0",
              fontSize: 12,
              cursor: "pointer"
            }}
          >
            Refresh PS
          </button>
          <button
            type="button"
            onClick={copyOutput}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "none",
              background: copied ? "#10b981" : (isErr ? "#ef4444" : "#38bdf8"),
              color: "#041019",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer"
            }}
          >
            {copied ? "Copied PS Errors!" : "Copy PS Errors"}
          </button>
        </div>
      </div>
      <textarea
        id="ps-errors-only-output"
        readOnly
        rows={7}
        value={formatted}
        style={{
          width: "100%",
          boxSizing: "border-box",
          marginTop: 10,
          padding: 10,
          borderRadius: 8,
          border: "1px solid rgba(148, 163, 184, 0.25)",
          background: "#020617",
          color: isErr ? "#fecaca" : "#e2e8f0",
          fontFamily: "monospace",
          fontSize: 12
        }}
      />
    </section>
  );
}
