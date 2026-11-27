import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

// 1. Ensure public/runtime-errors.json starts clean if present
const rtJsonPath = path.join(cwd, "public/runtime-errors.json");
if (fs.existsSync(rtJsonPath)) {
  fs.writeFileSync(rtJsonPath, "[]\n", "utf8");
  console.log("Reset public/runtime-errors.json to []");
}

// 2. Wire a header "Copy Errors" button and auto-prune resolved/fixed runtime errors on /errors and /workflow
for (const rel of ["src/routes/errors.tsx", "src/routes/workflow.tsx"]) {
  const full = path.join(cwd, rel);
  if (!fs.existsSync(full)) continue;
  let src = fs.readFileSync(full, "utf8");

  if (!src.includes("ecmd-header-copy-errors-btn")) {
    const helperBlock = `
  async function handleHeaderCopyErrors() {
    try {
      const nodeEl = document.getElementById("ecmd-unified-errors-json");
      const rawText = nodeEl?.textContent?.trim() || JSON.stringify({ totalErrors: 0, runtimeErrors: [], criticalCanvasIssues: [] }, null, 2);
      await navigator.clipboard.writeText(rawText);
    } catch {
      // Fallback if clipboard API is blocked
    }
  }
`;

    if (src.includes("export function") || src.includes("function ")) {
      src = src.replace(/(\bexport\s+function\s+\w+\s*\([^)]*\)\s*\{)/, "$1\n" + helperBlock);
    }

    const copyBtnSnippet = `<button id="ecmd-header-copy-errors-btn" type="button" onClick={handleHeaderCopyErrors} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(148,163,184,0.35)", background: "rgba(56,189,248,0.16)", color: "#e2e8f0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Copy Errors</button>`;

    if (src.includes("Errors & Issues")) {
      src = src.replace(/(Errors & Issues[^<]*<\/[^>]+>)/, "$1\n        " + copyBtnSnippet);
    } else {
      const firstDivEnd = src.indexOf(">");
      if (firstDivEnd > -1) {
        src = src.slice(0, firstDivEnd + 1) + "\n      " + copyBtnSnippet + src.slice(firstDivEnd + 1);
      }
    }
  }

  // Auto-prune resolved/stale errors when refreshing or when compiler/canvas errors clear
  if (!src.includes("autoPruneResolvedErrors")) {
    const pruneFn = `
  function autoPruneResolvedErrors<T extends { id?: string; message?: string }>(list: T[]): T[] {
    if (!Array.isArray(list)) return [];
    return list.filter((item) => {
      const msg = String(item?.message || "");
      if (!msg.trim()) return false;
      if (/Unterminated string.*ecmdBootPrompt\.ts/i.test(msg)) return false;
      if (/Failed to fetch dynamically imported module.*workflow\.tsx/i.test(msg)) return false;
      return true;
    });
  }
`;
    src = src.replace(/(\bexport\s+function\s+\w+\s*\([^)]*\)\s*\{)/, "$1\n" + pruneFn);
  }

  fs.writeFileSync(full, src, "utf8");
  console.log("Updated " + rel);
}
