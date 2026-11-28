import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

function showMatches(rel) {
  const full = path.join(cwd, rel);
  if (!fs.existsSync(full)) {
    console.log(`[MISSING] ${rel}`);
    return null;
  }
  const content = fs.readFileSync(full, "utf8");
  const lines = content.split(/\r?\n/);
  console.log(`\n--- ${rel} (${lines.length} lines) ---`);
  lines.forEach((l, i) => {
    if (/\b(export\s+(default\s+)?(function|const)|createFileRoute|return\s*\(|Copy All Errors JSON|Errors & Issues)/.test(l)) {
      console.log(`  L${i + 1}: ${l}`);
    }
  });
  return { full, content };
}

const rootInfo = showMatches("src/routes/__root.tsx");
const errorsInfo = showMatches("src/routes/errors.tsx");

const boxCompPath = path.join(cwd, "src/components/PsOnlyOutputPanel.tsx");
fs.mkdirSync(path.dirname(boxCompPath), { recursive: true });
fs.writeFileSync(
  boxCompPath,
  `import React, { useEffect, useState } from "react";

interface PsPayload {
  updatedAt?: string;
  source?: string;
  exitCode?: number;
  summary?: string;
  output?: string;
}

export async function copyPowerShellErrorsText(): Promise<string> {
  const res = await fetch("/powershell-results.json?_=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data: PsPayload = await res.json();
  const formatted = [
    "POWERSHELL OUTPUT & ERRORS",
    "Source: " + (data.source || "PowerShell"),
    "Updated: " + (data.updatedAt || ""),
    "Exit Code: " + (typeof data.exitCode === "number" ? data.exitCode : 0),
    data.summary ? "Summary: " + data.summary : "",
    "---",
    data.output || ""
  ].filter(Boolean).join("\\n");
  await navigator.clipboard.writeText(formatted);
  return formatted;
}

export function PsOnlyOutputPanel() {
  const [payload, setPayload] = useState<PsPayload | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  async function loadResults() {
    try {
      const res = await fetch("/powershell-results.json?_=" + Date.now(), { cache: "no-store" });
      if (!res.ok) return;
      setPayload(await res.json());
    } catch {}
  }

  useEffect(() => {
    loadResults();
    const timer = window.setInterval(loadResults, 2500);
    return () => window.clearInterval(timer);
  }, []);

  const failed = typeof payload?.exitCode === "number" && payload.exitCode !== 0;
  const textVal = payload
    ? [
        "POWERSHELL OUTPUT & ERRORS",
        "Source: " + (payload.source || "PowerShell"),
        "Updated: " + (payload.updatedAt || ""),
        "Exit Code: " + (typeof payload.exitCode === "number" ? payload.exitCode : 0),
        payload.summary ? "Summary: " + payload.summary : "",
        "---",
        payload.output || ""
      ].filter(Boolean).join("\\n")
    : "No PowerShell results written yet.";

  async function handleCopy() {
    try {
      await copyPowerShellErrorsText();
      setStatusMsg("Copied!");
      window.setTimeout(() => setStatusMsg(""), 1800);
    } catch {
      const area = document.getElementById("ps-only-output-textarea") as HTMLTextAreaElement | null;
      if (area) {
        area.select();
        document.execCommand("copy");
        setStatusMsg("Copied!");
        window.setTimeout(() => setStatusMsg(""), 1800);
      }
    }
  }

  return (
    <div
      id="ps-only-output-panel"
      style={{
        margin: "12px 0",
        padding: 12,
        borderRadius: 8,
        border: failed ? "2px solid #ef4444" : "1px solid #38bdf8",
        background: failed ? "#3b0a0a" : "#0f172a",
        color: "#f8fafc"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div>
          <strong>PowerShell Errors &amp; Output {failed ? "(Exit " + payload?.exitCode + ")" : "(Exit 0)"}</strong>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{payload?.updatedAt || "Waiting for /powershell-results.json"}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={loadResults} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #64748b", background: "transparent", color: "#f8fafc", cursor: "pointer" }}>
            Refresh PS
          </button>
          <button type="button" onClick={handleCopy} style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: "#38bdf8", color: "#020617", fontWeight: 700, cursor: "pointer" }}>
            {statusMsg || "Copy PS Errors"}
          </button>
        </div>
      </div>
      <textarea
        id="ps-only-output-textarea"
        readOnly
        rows={6}
        value={textVal}
        style={{ width: "100%", marginTop: 8, padding: 8, borderRadius: 6, border: "1px solid #334155", background: "#020617", color: "#e2e8f0", fontFamily: "monospace", fontSize: 12 }}
      />
    </div>
  );
}
`,
  "utf8"
);

for (const info of [rootInfo, errorsInfo]) {
  if (!info) continue;
  let src = info.content.replace(/^\s*<PsOnlyOutputPanel \/>\s*\r?\n?/gm, "").replace(/^\s*<button[^>]*data-ps-top-copy[^>]*>[\s\S]*?<\/button>\s*\r?\n?/gm, "");
  if (!src.includes('from "../components/PsOnlyOutputPanel"')) {
    src = 'import { PsOnlyOutputPanel, copyPowerShellErrorsText } from "../components/PsOnlyOutputPanel";\n' + src;
  }
  const retMatch = src.match(/return\s*\(\s*(?:<>|<[A-Za-z][^>]*>)/);
  if (retMatch && retMatch.index !== undefined) {
    const pos = retMatch.index + retMatch[0].length;
    const topBtn = `<button type="button" data-ps-top-copy="1" onClick={() => { void copyPowerShellErrorsText(); }} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #38bdf8", background: "#082f49", color: "#e0f2fe", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Copy PS Errors</button>`;
    src = src.slice(0, pos) + `\n      ${topBtn}\n      <PsOnlyOutputPanel />` + src.slice(pos);
    fs.writeFileSync(info.full, src, "utf8");
    const verified = fs.readFileSync(info.full, "utf8").includes("PsOnlyOutputPanel");
    console.log(`Patched ${path.basename(info.full)} | verified on disk: ${verified}`);
  } else {
    console.log(`Could not find JSX return block in ${path.basename(info.full)} - pass the printed lines to agy.`);
  }
}
