import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

const workflowNote = `## Deterministic PowerShell + GitHub/Supabase Eyes Workflow (Low-Turn Default)
- **Role Split:** Chrome Side Panel acts as Architect & Eyes (0ms /errors + GitHub AI Mirror \`mlhammes2/ecmd-ai-mirror\`); PowerShell executes deterministic scripts writing files, running \`node scripts/ecmd-sql.mjs\` on \`lvynkeuceiqxafgpgdvs\`, running \`npx tsc --noEmit\` & \`npx vitest run\`, and syncing GitHub/mirror without 50-90 turn agentic exploration loops.
- **Optional \`agy\` Path:** Use \`epen\` (\`agy.exe\` with \`-p\` as the LAST argument) only when interactive/agentic CLI execution is specifically desired; keep prompts tightly scoped (< 10 turns).
- **4-Target Sync Rule:** Any workflow/runner/script update syncs \`src/lib/ecmdBootPrompt.ts\` (\`/workflow\`), \`AGENTS.md\`, \`GEMINI.md\` (< 6 KB), and \`public.ecmd_external_ai_cms\` in the same turn.
- **Plain-English Explanations (Smart High-School Level):** Owner is a hands-on small business owner (not a coder) building on a tight budget with big goals. Explain architecture, bugs, SQL, and fixes in clear, everyday plain English—no unnecessary jargon.`;

const marker = "## Deterministic PowerShell + GitHub/Supabase Eyes Workflow (Low-Turn Default)";

function upsertMarkdown(filePath) {
  if (!fs.existsSync(filePath)) return { filePath, status: "missing" };
  const raw = fs.readFileSync(filePath, "utf8");
  const idx = raw.indexOf(marker);
  const base = idx >= 0 ? raw.slice(0, idx).trimEnd() : raw.trimEnd();
  const next = base + "\n\n" + workflowNote + "\n";
  fs.writeFileSync(filePath, next, "utf8");
  return { filePath, status: idx >= 0 ? "updated" : "appended" };
}

// 1. Update src/lib/ecmdBootPrompt.ts
const bootPath = path.join(cwd, "src/lib/ecmdBootPrompt.ts");
let bootStatus = "missing";
if (fs.existsSync(bootPath)) {
  const raw = fs.readFileSync(bootPath, "utf8");
  if (!raw.includes("Plain-English Explanations (Smart High-School Level)")) {
    const lastTick = raw.lastIndexOf("`");
    if (lastTick >= 0) {
      const next = raw.slice(0, lastTick) + "\n\n" + workflowNote + "\n" + raw.slice(lastTick);
      fs.writeFileSync(bootPath, next, "utf8");
      bootStatus = "updated";
    }
  } else {
    bootStatus = "already-up-to-date";
  }
}

// 2 & 3. Update AGENTS.md and GEMINI.md (keeping GEMINI.md < 6 KB)
const agentsStatus = upsertMarkdown(path.join(cwd, "AGENTS.md"));
const geminiPath = path.join(cwd, "GEMINI.md");
const geminiStatus = upsertMarkdown(geminiPath);
if (fs.existsSync(geminiPath)) {
  let gText = fs.readFileSync(geminiPath, "utf8");
  while (Buffer.byteLength(gText, "utf8") > 5900 && gText.includes("\n")) {
    const firstNewline = gText.indexOf("\n");
    const sectionStart = gText.indexOf(marker);
    if (sectionStart > 0 && firstNewline < sectionStart) {
      gText = gText.slice(firstNewline + 1);
    } else {
      break;
    }
  }
  fs.writeFileSync(geminiPath, gText, "utf8");
}

// 4. Create EcmdPowerShellResultsCard component with 1-click Copy button
const compPath = path.join(cwd, "src/components/EcmdPowerShellResultsCard.tsx");
const compCode = `import React, { useEffect, useState } from "react";

export interface PowerShellResultsData {
  updatedAt?: string;
  source?: string;
  exitCode?: number;
  summary?: string;
  output?: string;
}

export function EcmdPowerShellResultsCard() {
  const [payload, setPayload] = useState<PowerShellResultsData | null>(null);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    try {
      const resp = await fetch("/powershell-results.json?_=" + Date.now(), { cache: "no-store" });
      if (!resp.ok) return;
      const json = await resp.json();
      setPayload(json);
    } catch {
      // Ignore network/reload hiccups
    }
  }

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 3000);
    return () => window.clearInterval(id);
  }, []);

  const formattedText = payload
    ? [
        "Source: " + (payload.source || "PowerShell"),
        "Updated: " + (payload.updatedAt || ""),
        "Exit Code: " + (typeof payload.exitCode === "number" ? payload.exitCode : 0),
        "Summary: " + (payload.summary || ""),
        "",
        payload.output || ""
      ].join("\\n")
    : "";

  async function copyText() {
    if (!formattedText) return;
    try {
      await navigator.clipboard.writeText(formattedText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const box = document.getElementById("ecmd-ps-results-box") as HTMLTextAreaElement | null;
      if (box) {
        box.select();
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
        background: "rgba(15, 23, 42, 0.75)",
        color: "#e2e8f0"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>PowerShell Results</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {payload?.updatedAt ? "Last run: " + payload.updatedAt : "Waiting for PowerShell results"}
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
            onClick={copyText}
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
        id="ecmd-ps-results-box"
        readOnly
        rows={8}
        value={formattedText || "No PowerShell output saved yet."}
        style={{
          width: "100%",
          boxSizing: "border-box",
          marginTop: 10,
          padding: 10,
          borderRadius: 8,
          border: "1px solid rgba(148, 163, 184, 0.25)",
          background: "rgba(2, 6, 23, 0.85)",
          color: "#cbd5e1",
          fontFamily: "monospace",
          fontSize: 12
        }}
      />
    </section>
  );
}
`;
fs.writeFileSync(compPath, compCode, "utf8");

// Wire into /workflow and /errors routes if present
for (const rel of ["src/routes/workflow.tsx", "src/routes/errors.tsx"]) {
  const full = path.join(cwd, rel);
  if (!fs.existsSync(full)) continue;
  let txt = fs.readFileSync(full, "utf8");
  if (!txt.includes("EcmdPowerShellResultsCard")) {
    txt = `import { EcmdPowerShellResultsCard } from "../components/EcmdPowerShellResultsCard";\n` + txt;
    const endDiv = txt.lastIndexOf("</div>");
    txt = endDiv >= 0
      ? txt.slice(0, endDiv) + "\n      <EcmdPowerShellResultsCard />\n    " + txt.slice(endDiv)
      : txt + "\n<EcmdPowerShellResultsCard />\n";
    fs.writeFileSync(full, txt, "utf8");
  }
}

console.log(JSON.stringify({ bootStatus, agentsStatus, geminiStatus, cardCreated: true }, null, 2));



