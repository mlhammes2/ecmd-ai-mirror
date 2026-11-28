import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

// 1. Standalone component showing ONLY PowerShell errors & output (distinct from JSON)
const compPath = path.join(cwd, "src/components/PsErrorsOnlyBox.tsx");
fs.mkdirSync(path.dirname(compPath), { recursive: true });

const compCode = `import React, { useEffect, useState } from "react";

interface PsResultPayload {
  updatedAt?: string;
  source?: string;
  exitCode?: number;
  summary?: string;
  output?: string;
}

export function PsErrorsOnlyBox() {
  const [data, setData] = useState<PsResultPayload | null>(null);
  const [copied, setCopied] = useState(false);

  async function refreshPs() {
    try {
      const r = await fetch("/powershell-results.json?_=" + Date.now(), { cache: "no-store" });
      if (!r.ok) return;
      const json = await r.json();
      setData(json);
    } catch {
      // Ignore transient fetch hiccups
    }
  }

  useEffect(() => {
    refreshPs();
    const id = window.setInterval(refreshPs, 2500);
    return () => window.clearInterval(id);
  }, []);

  const hasPsError = typeof data?.exitCode === "number" && data.exitCode !== 0;

  const copyText = data
    ? [
        "=== POWERSHELL OUTPUT & ERRORS (NOT IN UNIFIED JSON) ===",
        "Source: " + (data.source || "PowerShell"),
        "Updated: " + (data.updatedAt || ""),
        "Exit Code: " + (typeof data.exitCode === "number" ? data.exitCode : 0),
        data.summary ? "Summary: " + data.summary : "",
        "---",
        data.output || "(no terminal output captured)"
      ].filter(Boolean).join("\\n")
    : "No PowerShell output captured yet.";

  async function copyPsErrors() {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const ta = document.getElementById("ps-errors-only-textarea") as HTMLTextAreaElement | null;
      if (ta) {
        ta.select();
        document.execCommand("copy");
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    }
  }

  return (
    <div
      id="ps-errors-only-box"
      style={{
        margin: "12px 0",
        padding: 14,
        borderRadius: 10,
        border: hasPsError ? "2px solid #ef4444" : "1px solid rgba(56, 189, 248, 0.45)",
        background: hasPsError ? "rgba(69, 10, 10, 0.85)" : "rgba(15, 23, 42, 0.88)",
        color: "#f8fafc"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <strong style={{ fontSize: 14 }}>
            PowerShell Errors &amp; Terminal Output {hasPsError ? "— ERROR (Exit " + data?.exitCode + ")" : "— Clean"}
          </strong>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Separate from Unified Error JSON · {data?.updatedAt ? "Updated " + data.updatedAt : "Waiting for public/powershell-results.json"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={refreshPs}
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
            onClick={copyPsErrors}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "none",
              background: copied ? "#10b981" : (hasPsError ? "#ef4444" : "#38bdf8"),
              color: "#041019",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer"
            }}
          >
            {copied ? "Copied PS Output!" : "Copy PS Errors"}
          </button>
        </div>
      </div>
      <textarea
        id="ps-errors-only-textarea"
        readOnly
        rows={8}
        value={copyText}
        style={{
          width: "100%",
          boxSizing: "border-box",
          marginTop: 10,
          padding: 10,
          borderRadius: 8,
          border: "1px solid rgba(148, 163, 184, 0.25)",
          background: "#020617",
          color: hasPsError ? "#fecaca" : "#e2e8f0",
          fontFamily: "monospace",
          fontSize: 12
        }}
      />
    </div>
  );
}
`;

fs.writeFileSync(compPath, compCode, "utf8");

// 2. Inject <PsErrorsOnlyBox /> inside the main component body of errors.tsx and workflow.tsx
for (const rel of ["src/routes/errors.tsx", "src/routes/workflow.tsx"]) {
  const full = path.join(cwd, rel);
  if (!fs.existsSync(full)) continue;
  let code = fs.readFileSync(full, "utf8");

  if (!code.includes("PsErrorsOnlyBox")) {
    code = 'import { PsErrorsOnlyBox } from "../components/PsErrorsOnlyBox";\n' + code;
  }

  if (!code.includes("<PsErrorsOnlyBox />")) {
    // Place right before the first `return (` inside a component function
    code = code.replace(
      /(function\s+[A-Z]\w*\s*\([^)]*\)\s*\{[\s\S]*?)(\n\s*return\s*\()/,
      "$1\n  // Render dedicated PowerShell Errors & Output box\n  const __psBoxNode = <PsErrorsOnlyBox />; void __psBoxNode;$2"
    );
    // Insert `<PsErrorsOnlyBox />` right after the opening tag of the returned JSX
    code = code.replace(
      /(return\s*\(\s*(?:<>|<div[^>]*>|<main[^>]*>|<section[^>]*>))/,
      "$1\n      <PsErrorsOnlyBox />"
    );
  }

  fs.writeFileSync(full, code, "utf8");
  console.log("Mounted PsErrorsOnlyBox in " + rel);
}
