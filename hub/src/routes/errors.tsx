import { PsErrorsOnlyBox } from "../components/PsErrorsOnlyBox";
import React from "react";
import { EcmdPowerShellResultsCard } from "../components/EcmdPowerShellResultsCard";
import { createFileRoute } from "@tanstack/react-router";
import Errors from "../pages/Errors";

function EcmdDedicatedPsOutputBox() {
  const [psData, setPsData] = React.useState<{ updatedAt?: string; source?: string; exitCode?: number; summary?: string; output?: string } | null>(null);
  const [copiedPs, setCopiedPs] = React.useState(false);

  async function loadPs() {
    try {
      const res = await fetch("/powershell-results.json?_=" + Date.now(), { cache: "no-store" });
      if (!res.ok) return;
      setPsData(await res.json());
    } catch {}
  }

  React.useEffect(() => {
    loadPs();
    const timer = window.setInterval(loadPs, 3000);
return () => window.clearInterval(timer);
  }, []);

  const bodyText = psData
    ? [
        "Source: " + (psData.source || "PowerShell"),
        "Updated: " + (psData.updatedAt || ""),
        "Exit Code: " + (typeof psData.exitCode === "number" ? psData.exitCode : 0),
        psData.summary ? "Summary: " + psData.summary : "",
        "",
        psData.output || ""
      ].filter(Boolean).join("\n")
    : "No PowerShell output recorded yet.";

  async function copyPs() {
    try {
      await navigator.clipboard.writeText(bodyText);
      setCopiedPs(true);
      window.setTimeout(() => setCopiedPs(false), 1800);
    } catch {}
  }

  const hasError = typeof psData?.exitCode === "number" && psData.exitCode !== 0;

  return (
    <section
      id="ecmd-ps-errors-output-box"
      aria-label="PowerShell Errors & Output"
      style={{
        marginTop: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        border: hasError ? "1px solid rgba(248, 113, 113, 0.55)" : "1px solid rgba(148, 163, 184, 0.3)",
        background: "rgba(15, 23, 42, 0.82)",
        color: "#e2e8f0"
      }}
    >
      <PsErrorsOnlyBox />
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            PowerShell Errors &amp; Output {hasError ? "(Error Exit Code " + psData?.exitCode + ")" : "(OK)"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {psData?.updatedAt ? "Updated: " + psData.updatedAt : "Waiting for public/powershell-results.json"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={loadPs}
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
            onClick={copyPs}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              background: copiedPs ? "#10b981" : (hasError ? "#f87171" : "#38bdf8"),
              color: "#041019",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            {copiedPs ? "Copied!" : "Copy PowerShell Output"}
          </button>
        </div>
      </div>
      <textarea
        readOnly
        rows={9}
        value={bodyText}
        style={{
          width: "100%",
          boxSizing: "border-box",
          marginTop: 10,
          padding: 10,
          borderRadius: 8,
          border: "1px solid rgba(148, 163, 184, 0.25)",
          background: "rgba(2, 6, 23, 0.9)",
          color: hasError ? "#fecaca" : "#cbd5e1",
          fontFamily: "monospace",
          fontSize: 12
        }}
      />
    </section>
  );
}

async function handleHeaderCopyErrors() {
  try {
    const el = document.getElementById("ecmd-unified-errors-json");
    const text = el?.textContent?.trim() || JSON.stringify({ totalErrors: 0, runtimeErrors: [], criticalCanvasIssues: [] }, null, 2);
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback if clipboard API is unavailable
  }
}

export const Route = createFileRoute("/errors")({ component: Errors });

<>
      <EcmdPowerShellResultsCard />
      <button id="ecmd-header-copy-errors-btn" type="button" onClick={handleHeaderCopyErrors} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(148,163,184,0.35)", background: "rgba(56,189,248,0.16)", color: "#e2e8f0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Copy Errors</button>
    </>
