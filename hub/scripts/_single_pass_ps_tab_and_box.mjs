import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

// 1. Create dedicated PowerShell Errors & Output component
const boxPath = path.join(cwd, "src/components/PsErrorsOnlyBox.tsx");
fs.mkdirSync(path.dirname(boxPath), { recursive: true });
fs.writeFileSync(
  boxPath,
  `import React, { useEffect, useState } from "react";

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
      ].filter(Boolean).join("\\n")
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
`,
  "utf8"
);

// 2. Add top-bar Copy PS Errors helper & conditional box in src/routes/__root.tsx
const rootPath = path.join(cwd, "src/routes/__root.tsx");
if (fs.existsSync(rootPath)) {
  let rootCode = fs.readFileSync(rootPath, "utf8");
  rootCode = rootCode.replace(/^\s*\{[^}]*PsErrorsOnlyBox[^}]*\}\s*\r?\n?/gm, "");
  rootCode = rootCode.replace(/^\s*<PsErrorsOnlyBox \/>\s*\r?\n?/gm, "");
  rootCode = rootCode.replace(/^\s*<button[^>]*ecmd-top-tab-copy-ps[^>]*>[\s\S]*?<\/button>\s*\r?\n?/gm, "");

  if (!rootCode.includes('from "../components/PsErrorsOnlyBox"')) {
    rootCode = 'import { PsErrorsOnlyBox } from "../components/PsErrorsOnlyBox";\n' + rootCode;
  }

  const topTabCopyBtn = `<button id="ecmd-top-tab-copy-ps" type="button" onClick={async () => { try { const r = await fetch("/powershell-results.json?_=" + Date.now(), { cache: "no-store" }); if (r.ok) { const j = await r.json(); await navigator.clipboard.writeText(["=== POWERSHELL ERRORS & OUTPUT ===", "Source: " + (j.source || "PowerShell"), "Updated: " + (j.updatedAt || ""), "Exit Code: " + (j.exitCode ?? 0), j.summary ? "Summary: " + j.summary : "", "---", j.output || ""].filter(Boolean).join("\\n")); } } catch {} }} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(56,189,248,0.5)", background: "rgba(56,189,248,0.16)", color: "#e0f2fe", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Copy PS Errors</button>`;
  const boxOnRoute = `{typeof window !== "undefined" && (window.location.pathname.startsWith("/errors") || window.location.pathname.startsWith("/workflow")) && <PsErrorsOnlyBox />}`;

  const retMatch = rootCode.match(/return\s*\(\s*(?:<>|<div[^>]*>|<main[^>]*>|<section[^>]*>)/);
  if (retMatch && retMatch.index !== undefined) {
    const pos = retMatch.index + retMatch[0].length;
    rootCode = rootCode.slice(0, pos) + "\n      " + topTabCopyBtn + "\n      " + boxOnRoute + rootCode.slice(pos);
  }

  fs.writeFileSync(rootPath, rootCode, "utf8");
  console.log("Updated src/routes/__root.tsx with top-tab Copy PS Errors button and box.");
}
