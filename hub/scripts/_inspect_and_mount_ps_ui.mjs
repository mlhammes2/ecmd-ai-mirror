import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

function inspectFile(rel) {
  const full = path.join(cwd, rel);
  if (!fs.existsSync(full)) {
    console.log(rel + ": MISSING");
    return;
  }
  const lines = fs.readFileSync(full, "utf8").split(/\r?\n/);
  console.log("=== " + rel + " (total lines: " + lines.length + ") ===");
  lines.forEach((line, idx) => {
    if (
      line.includes("return") ||
      line.includes("component:") ||
      line.includes("Errors & Issues") ||
      line.includes("Copy All Errors JSON") ||
      line.includes("Workflow & Boot-Up")
    ) {
      console.log(`  ${idx + 1}: ${line.trim()}`);
    }
  });
}

inspectFile("src/routes/__root.tsx");
inspectFile("src/routes/errors.tsx");
inspectFile("src/routes/workflow.tsx");

// Ensure PsErrorsOnlyBox exists
const boxPath = path.join(cwd, "src/components/PsErrorsOnlyBox.tsx");
fs.mkdirSync(path.dirname(boxPath), { recursive: true });
fs.writeFileSync(
  boxPath,
  `import React, { useEffect, useState } from "react";

export interface PsResultsData {
  updatedAt?: string;
  source?: string;
  exitCode?: number;
  summary?: string;
  output?: string;
}

export async function copyLatestPsOutput(): Promise<boolean> {
  try {
    const r = await fetch("/powershell-results.json?_=" + Date.now(), { cache: "no-store" });
    if (!r.ok) return false;
    const j: PsResultsData = await r.json();
    const text = [
      "=== POWERSHELL ERRORS & OUTPUT ===",
      "Source: " + (j.source || "PowerShell"),
      "Updated: " + (j.updatedAt || ""),
      "Exit Code: " + (typeof j.exitCode === "number" ? j.exitCode : 0),
      j.summary ? "Summary: " + j.summary : "",
      "---",
      j.output || ""
    ].filter(Boolean).join("\\n");
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function PsErrorsOnlyBox() {
  const [info, setInfo] = useState<PsResultsData | null>(null);
  const [copied, setCopied] = useState(false);

  async function pull() {
    try {
      const r = await fetch("/powershell-results.json?_=" + Date.now(), { cache: "no-store" });
      if (!r.ok) return;
      setInfo(await r.json());
    } catch {}
  }

  useEffect(() => {
    pull();
    const t = window.setInterval(pull, 2500);
    return () => window.clearInterval(t);
  }, []);

  const isErr = typeof info?.exitCode === "number" && info.exitCode !== 0;

  const displayText = info
    ? [
        "=== POWERSHELL ERRORS & OUTPUT ===",
        "Source: " + (info.source || "PowerShell"),
        "Updated: " + (info.updatedAt || ""),
        "Exit Code: " + (typeof info.exitCode === "number" ? info.exitCode : 0),
        info.summary ? "Summary: " + info.summary : "",
        "---",
        info.output || ""
      ].filter(Boolean).join("\\n")
    : "No PowerShell output recorded yet.";

  async function onCopy() {
    const ok = await copyLatestPsOutput();
    if (!ok) {
      const ta = document.getElementById("ps-errors-only-box-textarea") as HTMLTextAreaElement | null;
      if (ta) {
        ta.select();
        document.execCommand("copy");
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
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
        background: isErr ? "rgba(69, 10, 10, 0.92)" : "rgba(15, 23, 42, 0.92)",
        color: "#f8fafc"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            PowerShell Errors &amp; Terminal Output {isErr ? "(ERROR Exit " + info?.exitCode + ")" : "(OK)"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {info?.updatedAt ? "Updated: " + info.updatedAt : "Waiting for /powershell-results.json"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={pull}
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
            onClick={onCopy}
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
        id="ps-errors-only-box-textarea"
        readOnly
        rows={7}
        value={displayText}
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

// Inject into __root.tsx (top bar button + box on /errors & /workflow) and errors.tsx
const topBtnCode = `<button id="ecmd-top-bar-copy-ps-btn" type="button" onClick={() => { void copyLatestPsOutput(); }} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(56,189,248,0.5)", background: "rgba(56,189,248,0.18)", color: "#e0f2fe", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Copy PS Errors</button>`;
const condBoxCode = `{typeof window !== "undefined" && (window.location.pathname.startsWith("/errors") || window.location.pathname.startsWith("/workflow")) && <PsErrorsOnlyBox />}`;

for (const rel of ["src/routes/__root.tsx", "src/routes/errors.tsx"]) {
  const full = path.join(cwd, rel);
  if (!fs.existsSync(full)) continue;
  let src = fs.readFileSync(full, "utf8");

  src = src.replace(/^\s*\{[^}]*PsErrorsOnlyBox[^}]*\}\s*\r?\n?/gm, "");
  src = src.replace(/^\s*<PsErrorsOnlyBox \/>\s*\r?\n?/gm, "");
  src = src.replace(/^\s*<button[^>]*ecmd-top-bar-copy-ps-btn[^>]*>[\s\S]*?<\/button>\s*\r?\n?/gm, "");

  if (!src.includes('from "../components/PsErrorsOnlyBox"')) {
    src = 'import { PsErrorsOnlyBox, copyLatestPsOutput } from "../components/PsErrorsOnlyBox";\n' + src;
  }

  // Place right after `return (` followed by any `<...` tag
  const match = src.match(/return\s*\(\s*(?:<>|<[A-Za-z][^>]*>)/);
  if (match && match.index !== undefined) {
    const pos = match.index + match[0].length;
    const injection = rel.endsWith("__root.tsx")
      ? `\n      ${topBtnCode}\n      ${condBoxCode}`
      : `\n      ${topBtnCode}\n      <PsErrorsOnlyBox />`;
    src = src.slice(0, pos) + injection + src.slice(pos);
  }

  fs.writeFileSync(full, src, "utf8");
  console.log("Updated " + rel);
}
