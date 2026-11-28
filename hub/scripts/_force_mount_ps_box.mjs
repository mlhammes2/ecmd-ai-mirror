import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

// Ensure PsErrorsOnlyBox component exists
const boxFile = path.join(cwd, "src/components/PsErrorsOnlyBox.tsx");
fs.mkdirSync(path.dirname(boxFile), { recursive: true });
fs.writeFileSync(
  boxFile,
  `import React, { useEffect, useState } from "react";

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
      ].filter(Boolean).join("\\n")
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
`,
  "utf8"
);

// Mount <PsErrorsOnlyBox /> inside errors.tsx and workflow.tsx
for (const rel of ["src/routes/errors.tsx", "src/routes/workflow.tsx"]) {
  const full = path.join(cwd, rel);
  if (!fs.existsSync(full)) continue;
  let code = fs.readFileSync(full, "utf8");

  if (!code.includes("PsErrorsOnlyBox")) {
    code = 'import { PsErrorsOnlyBox } from "../components/PsErrorsOnlyBox";\n' + code;
  }

  if (!code.includes("<PsErrorsOnlyBox />")) {
    // Find first `return (` followed by an opening JSX tag
    const retIdx = code.search(/return\s*\(\s*(?:<>|<[A-Za-z][^>]*>)/);
    if (retIdx !== -1) {
      const openTagMatch = code.slice(retIdx).match(/return\s*\(\s*(?:<>|<[A-Za-z][^>]*>)/);
      if (openTagMatch) {
        const insertPos = retIdx + openTagMatch[0].length;
        code = code.slice(0, insertPos) + "\n      <PsErrorsOnlyBox />" + code.slice(insertPos);
      }
    }
  }

  fs.writeFileSync(full, code, "utf8");
  console.log("Ensured PsErrorsOnlyBox in " + rel);
}

// Prune deleted component diagnostics & old ecmdBootPrompt runtime entries if present
const removedSet = new Set([
  "ecmdbrushedsteelbutton",
  "ecmdcartsummarybar",
  "hqdailydispatchboard",
  "hqinvoicecard",
  "hqmultistateworkspace",
  "hqweeklystrip",
  "ecmdsavedvehicledropdown",
  "ecmdthemelogo",
  "ecmdvehicleselector",
  "ecmdwhatsincludedmodal",
  "ecmdwhatsincludeditempopup"
]);

const diagPath = path.join(cwd, "public/plasmic-diagnostics.json");
if (fs.existsSync(diagPath)) {
  try {
    const d = JSON.parse(fs.readFileSync(diagPath, "utf8"));
    const pruneArr = (arr) =>
      Array.isArray(arr)
        ? arr.filter((x) => !removedSet.has(String(x?.componentName || "").toLowerCase()))
        : arr;
    if (Array.isArray(d)) {
      fs.writeFileSync(diagPath, JSON.stringify(pruneArr(d), null, 2) + "\n", "utf8");
    } else if (d && typeof d === "object") {
      for (const k of Object.keys(d)) {
        if (Array.isArray(d[k])) d[k] = pruneArr(d[k]);
      }
      fs.writeFileSync(diagPath, JSON.stringify(d, null, 2) + "\n", "utf8");
    }
  } catch {}
}

const rtPath = path.join(cwd, "public/runtime-errors.json");
if (fs.existsSync(rtPath)) {
  try {
    const rt = JSON.parse(fs.readFileSync(rtPath, "utf8"));
    if (Array.isArray(rt)) {
      const filtered = rt.filter(
        (e) =>
          !/Unterminated string.*ecmdBootPrompt\.ts/i.test(String(e?.message || "")) &&
          !/Failed to fetch dynamically imported module.*workflow\.tsx/i.test(String(e?.message || ""))
      );
      fs.writeFileSync(rtPath, JSON.stringify(filtered, null, 2) + "\n", "utf8");
    }
  } catch {}
}
