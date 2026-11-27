import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const ruleLine = '- PowerShell Paste Rule: Every PowerShell script ends with Write-Host "DONE" (and a trailing blank line) so it runs all the way through without asking for an extra Enter.';
const marker = "PowerShell Paste Rule:";

const bootPath = path.join(cwd, "src/lib/ecmdBootPrompt.ts");
if (fs.existsSync(bootPath)) {
  const raw = fs.readFileSync(bootPath, "utf8");
  if (!raw.includes(marker)) {
    const match = raw.match(/export const ECMD_SIDEBAR_BOOT_PROMPT = ([\s\S]*?);\s*(?:export default|\s*$)/);
    if (match) {
      let currentVal;
      try {
        currentVal = Function('"use strict"; return (' + match[1] + ');')();
      } catch {
        currentVal = null;
      }
      if (typeof currentVal === "string") {
        const nextVal = currentVal.trimEnd() + "\n" + ruleLine;
        const nextFile = "export const ECMD_SIDEBAR_BOOT_PROMPT = " + JSON.stringify(nextVal) + ";\n\nexport default ECMD_SIDEBAR_BOOT_PROMPT;\n";
        fs.writeFileSync(bootPath, nextFile, "utf8");
        console.log("Updated src/lib/ecmdBootPrompt.ts");
      }
    }
  } else {
    console.log("src/lib/ecmdBootPrompt.ts already has PowerShell Paste Rule");
  }
}

for (const mdName of ["AGENTS.md", "GEMINI.md"]) {
  const mdPath = path.join(cwd, mdName);
  if (!fs.existsSync(mdPath)) continue;
  const txt = fs.readFileSync(mdPath, "utf8");
  if (!txt.includes(marker)) {
    fs.writeFileSync(mdPath, txt.trimEnd() + "\n" + ruleLine + "\n", "utf8");
    console.log("Updated " + mdName);
  }
}
