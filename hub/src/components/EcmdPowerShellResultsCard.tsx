import React, { useEffect, useState } from "react";

export interface PowerShellResultsRecord {
  updatedAt?: string;
  source?: string;
  exitCode?: number;
  summary?: string;
  output?: string;
}

export function EcmdPowerShellResultsCard() {
  const [info, setInfo] = useState<PowerShellResultsRecord | null>(null);
  const [copied, setCopied] = useState(false);

  async function pullResults() {
    try {
      const r = await fetch("/powershell-results.json?_=" + Date.now(), { cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json();
      setInfo(data);
    } catch {
      // Ignore transient dev server hiccups
    }
  }

  useEffect(() => {
    pullResults();
    const t = window.setInterval(pullResults, 3000);
    return () => window.clearInterval(t);
  }, []);

  const copyPayload = info
    ? [
        "Source: " + (info.source || "PowerShell"),
        "Updated: " + (info.updatedAt || ""),
        "Exit Code: " + (typeof info.exitCode === "number" ? info.exitCode : 0),
        "Summary: " + (info.summary || ""),
        "",
        info.output || ""
      ].join("\n")
    : "";

  async function copyNow() {
    if (!copyPayload) return;
    try {
      await navigator.clipboard.writeText(copyPayload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const area = document.getElementById("ecmd-powershell-copy-textarea") as HTMLTextAreaElement | null;
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
      aria-label="PowerShell Results"
      style={{
        marginTop: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        border: "1px solid rgba(148, 163, 184, 0.3)",
        background: "rgba(15, 23, 42, 0.78)",
        color: "#e2e8f0"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>PowerShell Results</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {info?.updatedAt ? "Updated: " + info.updatedAt : "Waiting for /powershell-results.json"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={pullResults}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid rgba(148, 163, 184, 0.35)",
              background: "transparent",
              color: "inherit",
              cursor: "pointer"
            }}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={copyNow}
            disabled={!copyPayload}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              background: copied ? "#10b981" : "#38bdf8",
              color: "#041019",
              fontWeight: 700,
              cursor: copyPayload ? "pointer" : "not-allowed"
            }}
          >
            {copied ? "Copied!" : "Copy Results"}
          </button>
        </div>
      </div>
      {info?.summary && (
        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600 }}>{info.summary}</div>
      )}
      <textarea
        id="ecmd-powershell-copy-textarea"
        readOnly
        rows={8}
        value={copyPayload || "No PowerShell results captured yet."}
        style={{
          width: "100%",
          boxSizing: "border-box",
          marginTop: 10,
          padding: 10,
          borderRadius: 8,
          border: "1px solid rgba(148, 163, 184, 0.25)",
          background: "rgba(2, 6, 23, 0.88)",
          color: "#cbd5e1",
          fontFamily: "monospace",
          fontSize: 12
        }}
      />
    </section>
  );
}
