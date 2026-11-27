import React, { useEffect, useState } from "react";

export interface PowerShellResultsPayload {
  updatedAt?: string;
  source?: string;
  exitCode?: number;
  summary?: string;
  output?: string;
}

export function EcmdPowerShellResultsCard() {
  const [payload, setPayload] = useState<PowerShellResultsPayload | null>(null);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    try {
      const res = await fetch("/powershell-results.json?_=" + Date.now(), { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setPayload(json);
    } catch {
      // Ignore transient fetch errors during reloads
    }
  }

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => window.clearInterval(timer);
  }, []);

  const formattedText = payload
    ? [
        "Source: " + (payload.source || "PowerShell"),
        "Updated: " + (payload.updatedAt || ""),
        "Exit Code: " + (typeof payload.exitCode === "number" ? payload.exitCode : 0),
        "Summary: " + (payload.summary || ""),
        "",
        payload.output || ""
      ].join("\n")
    : "";

  async function handleCopy() {
    if (!formattedText) return;
    try {
      await navigator.clipboard.writeText(formattedText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const ta = document.getElementById("ecmd-ps-results-copy-box") as HTMLTextAreaElement | null;
      if (ta) {
        ta.select();
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
            {payload?.updatedAt ? "Updated: " + payload.updatedAt : "Waiting for PowerShell output"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={refresh}
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
            onClick={handleCopy}
            disabled={!formattedText}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              background: copied ? "#10b981" : "#38bdf8",
              color: "#041019",
              fontWeight: 700,
              cursor: formattedText ? "pointer" : "not-allowed"
            }}
          >
            {copied ? "Copied!" : "Copy Results"}
          </button>
        </div>
      </div>
      {payload?.summary && (
        <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600 }}>{payload.summary}</div>
      )}
      <textarea
        id="ecmd-ps-results-copy-box"
        readOnly
        rows={8}
        value={formattedText || "No PowerShell output captured yet."}
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
