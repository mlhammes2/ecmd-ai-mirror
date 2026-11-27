import fs from "node:fs";
import path from "node:path";

const bootPath = path.join(process.cwd(), "src/lib/ecmdBootPrompt.ts");
if (!fs.existsSync(bootPath)) {
  console.log("src/lib/ecmdBootPrompt.ts not found");
  process.exit(1);
}

const raw = fs.readFileSync(bootPath, "utf8");
const lastBacktick = raw.lastIndexOf("`");
if (lastBacktick === -1) {
  console.log("Could not find closing backtick in src/lib/ecmdBootPrompt.ts");
  process.exit(1);
}

// Everything after the closing backtick on the template literal was stray text
const beforeClose = raw.slice(0, lastBacktick);
const afterClose = raw.slice(lastBacktick + 1);

// Keep only valid TS lines after the closing backtick (like `;` or `export ...` or comments), dropping stray bullet lines
const keptTailLines = afterClose
  .split(/\r?\n/)
  .filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (trimmed.startsWith("- ") || trimmed.startsWith("## ") || trimmed.startsWith("* ")) return false;
    return true;
  });

const extraSection = [
  "",
  "## Deterministic PowerShell + GitHub/Supabase Eyes Workflow (Low-Turn Default)",
  "- Role Split: Chrome Side Panel acts as Architect & Eyes (0ms /errors + GitHub AI Mirror mlhammes2/ecmd-ai-mirror); PowerShell runs deterministic scripts updating files, running node scripts/ecmd-sql.mjs on lvynkeuceiqxafgpgdvs, running npx tsc --noEmit & npx vitest run, and syncing GitHub/mirror without 50-90 turn loops.",
  "- Optional agy Path: Use epen (agy.exe with -p as the LAST argument) only when interactive CLI execution is desired; keep prompts under 10 turns.",
  "- 4-Target Sync Rule: Any workflow/runner/script update syncs src/lib/ecmdBootPrompt.ts (/workflow), AGENTS.md, GEMINI.md (< 6 KB), and public.ecmd_external_ai_cms in the same turn.",
  "- Plain-English Explanations (Smart High-School Level): Owner is a hands-on small business owner (not a coder) building on a tight budget with big goals. Explain architecture, bugs, SQL, and fixes in clear, everyday plain English with no unnecessary jargon."
].join("\n");

const hasNoteAlready = beforeClose.includes("Plain-English Explanations (Smart High-School Level)");
const newBody = hasNoteAlready ? beforeClose : beforeClose + extraSection + "\n";
const rebuilt = newBody + "`" + (keptTailLines.length ? "\n" + keptTailLines.join("\n").trimStart() : ";\n");

fs.writeFileSync(bootPath, rebuilt, "utf8");
console.log("Cleaned stray lines after closing backtick in src/lib/ecmdBootPrompt.ts");
