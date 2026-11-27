import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

const fnDef = `
async function handleHeaderCopyErrors() {
  try {
    const el = document.getElementById("ecmd-unified-errors-json");
    const text = el?.textContent?.trim() || JSON.stringify({ totalErrors: 0, runtimeErrors: [], criticalCanvasIssues: [] }, null, 2);
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback if clipboard API is unavailable
  }
}
`;

for (const rel of ["src/routes/errors.tsx", "src/routes/workflow.tsx"]) {
  const full = path.join(cwd, rel);
  if (!fs.existsSync(full)) continue;
  let src = fs.readFileSync(full, "utf8");

  if (src.includes("handleHeaderCopyErrors") && !src.includes("async function handleHeaderCopyErrors")) {
    const lastImportIdx = src.lastIndexOf("\nimport ");
    if (lastImportIdx >= 0) {
      const lineEnd = src.indexOf("\n", lastImportIdx + 1);
      const insertAt = lineEnd >= 0 ? lineEnd + 1 : src.length;
      src = src.slice(0, insertAt) + fnDef + src.slice(insertAt);
    } else {
      src = fnDef + "\n" + src;
    }
    fs.writeFileSync(full, src, "utf8");
    console.log("Added handleHeaderCopyErrors definition to " + rel);
  } else {
    console.log("Already ok in " + rel);
  }
}
