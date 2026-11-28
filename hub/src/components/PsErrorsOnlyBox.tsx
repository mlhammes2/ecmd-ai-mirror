import React, { useEffect, useState } from "react";

export interface PsErrorsPayload {
  updatedAt?: string;
  source?: string;
  exitCode?: number;
  summary?: string;
  output?: string;
}

export function PsErrorsOnlyBox() {
  const [info, setInfo] = useState<PsErrorsPayload | null>(null);
  const [copied, setCopied] = useState(false);

  async function pullPs() {
    try {
      const resp = await fetch("/powershell-results.json?_=" + Date.now(), { cache: "no-store" });
      if (!resp.ok) return;
      const json = await resp.json();
      setInfo(json);
    } catch {}
  }

  useEffect(() => {
    pullPs();
    const handle = window.setInterval(pullPs, 2500);
    return () => window.clearInterval(handle);
  }, []);

  const isErr = typeof info?.exitCode === "number" && info.exitCode !== 0;

  const textToCopy = info
    ? [
        "=== POWERSHELL ERRORS & OUTPUT ===",
        "Source: " + (info.source || "PowerShell"),
        "Updated: " + (info.updatedAt || ""),
        "Exit Code: " + (typeof info.exitCode === "number" ? info.exitCode : 0),
        info.summary ? "Summary: " + info.summary : "",
        "---",
        info.output || ""
      ].filter(Boolean).join("\n")
    : "No PowerShell output recorded yet.";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const el = document.getElementById("ps-errors-only-box-txt") as HTMLTextAreaElement | null;
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
        margin: "14px 0",
        padding: 14,
        borderRadius: 10,
        border: isErr ? "2px solid #ef4444" : "1px solid rgba(56, 189, 248, 0.5)",
        background: isErr ? "rgba(69, 10, 10, 0.88)" : "rgba(15, 23, 42, 0.9)",
        color: "#f8fafc"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            PowerShell Errors &amp; Terminal Output {isErr ? "(Exit Code " + info?.exitCode + ")" : "(Exit Code 0)"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {info?.updatedAt ? "Updated: " + info.updatedAt : "Waiting for /powershell-results.json"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={pullPs}
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
            id="copy-ps-errors-btn"
            type="button"
            onClick={handleCopy}
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
        id="ps-errors-only-box-txt"
        readOnly
        rows={8}
        value={textToCopy}
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
