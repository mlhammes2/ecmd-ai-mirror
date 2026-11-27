import fs from "node:fs";
import path from "node:path";

const bootPath = path.join(process.cwd(), "src/lib/ecmdBootPrompt.ts");
if (!fs.existsSync(bootPath)) {
  console.error("Missing src/lib/ecmdBootPrompt.ts");
  process.exit(1);
}

const raw = fs.readFileSync(bootPath, "utf8");
const lines = raw.split(/\r?\n/);

// Find the declaration line for ECMD_SIDEBAR_BOOT_PROMPT and rebuild cleanly up to where the stray lines started
const declIdx = lines.findIndex((l) => l.includes("ECMD_SIDEBAR_BOOT_PROMPT"));
const strayIdx = lines.findIndex(
  (l, idx) =>
    idx > 10 &&
    (l.trim().startsWith("- **Role Split:**") ||
      l.trim().startsWith("- Role Split:") ||
      l.trim().startsWith("## Deterministic PowerShell + GitHub/Supabase Eyes Workflow"))
);

if (declIdx >= 0 && strayIdx > declIdx) {
  // Walk backward from strayIdx to find the closing backtick line of the template literal
  let closeLineIdx = strayIdx - 1;
  while (closeLineIdx > declIdx && !lines[closeLineIdx].includes("`")) {
    closeLineIdx--;
  }

  const headLines = lines.slice(0, closeLineIdx);
  const closingLine = lines[closeLineIdx] || "`;";

  const noteLines = [
    "",
    "## Deterministic PowerShell + GitHub/Supabase Eyes Workflow (Low-Turn Default)",
    "- Role Split: Chrome Side Panel acts as Architect & Eyes (0ms /errors + GitHub AI Mirror mlhammes2/ecmd-ai-mirror); PowerShell runs deterministic scripts updating files, running node scripts/ecmd-sql.mjs on lvynkeuceiqxafgpgdvs, running npx tsc --noEmit & npx vitest run, and syncing GitHub/mirror without 50-90 turn loops.",
    "- Optional agy Path: Use epen (agy.exe with -p as the LAST argument) only when interactive CLI execution is desired; keep prompts under 10 turns.",
    "- 4-Target Sync Rule: Any workflow/runner/script update syncs src/lib/ecmdBootPrompt.ts (/workflow), AGENTS.md, GEMINI.md (< 6 KB), and public.ecmd_external_ai_cms in the same turn.",
    "- Plain-English Explanations (Smart High-School Level): Owner is a hands-on small business owner (not a coder) building on a tight budget with big goals. Explain architecture, bugs, SQL, and fixes in clear, everyday plain English with no unnecessary jargon."
  ];

  // Ensure closingLine ends with `;`
  const normalizedClose = closingLine.trim().endsWith(";") ? closingLine : closingLine + ";";

  // Keep anything after strayIdx only if it's a valid export/helper declaration (not stray markdown bullets)
  const afterStray = lines.slice(strayIdx).filter((l) => {
    const t = l.trim();
    if (!t) return false;
    if (t.startsWith("-") || t.startsWith("##") || t.startsWith("*")) return false;
    return t.startsWith("export ") || t.startsWith("function ") || t.startsWith("const ");
  });

  const fixed = [
    ...headLines,
    ...noteLines,
    normalizedClose,
    ...afterStray,
    ""
  ].join("\n");

  fs.writeFileSync(bootPath, fixed, "utf8");
  console.log("Cleanly rebuilt src/lib/ecmdBootPrompt.ts around line " + (strayIdx + 1));
} else {
  console.log("No stray block detected around line 65; checking file as-is.");
}
