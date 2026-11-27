import fs from "node:fs";
import path from "node:path";

const bootPath = path.join(process.cwd(), "src/lib/ecmdBootPrompt.ts");
if (!fs.existsSync(bootPath)) {
  console.log("src/lib/ecmdBootPrompt.ts not found");
  process.exit(0);
}

let raw = fs.readFileSync(bootPath, "utf8");

// Remove stray lines accidentally placed after the closing backtick of the prompt string
const strayMarker = "## Deterministic PowerShell + GitHub/Supabase Eyes Workflow (Low-Turn Default)";
const lastTick = raw.lastIndexOf("`");
const strayIdx = raw.indexOf(strayMarker);
if (strayIdx > lastTick && lastTick >= 0) {
  raw = raw.slice(0, strayIdx).trimEnd() + "\n";
}

const cleanLines = [
  "",
  "## Deterministic PowerShell + GitHub/Supabase Eyes Workflow (Low-Turn Default)",
  "- Role Split: Chrome Side Panel acts as Architect & Eyes (0ms /errors + GitHub AI Mirror mlhammes2/ecmd-ai-mirror); PowerShell runs deterministic scripts updating files, running node scripts/ecmd-sql.mjs on lvynkeuceiqxafgpgdvs, running npx tsc --noEmit & npx vitest run, and syncing GitHub/mirror without 50-90 turn loops.",
  "- Optional agy Path: Use epen (agy.exe with -p as the LAST argument) only when interactive CLI execution is desired; keep prompts under 10 turns.",
  "- 4-Target Sync Rule: Any workflow/runner/script update syncs src/lib/ecmdBootPrompt.ts (/workflow), AGENTS.md, GEMINI.md (< 6 KB), and public.ecmd_external_ai_cms in the same turn.",
  "- Plain-English Explanations (Smart High-School Level): Owner is a hands-on small business owner (not a coder) building on a tight budget with big goals. Explain architecture, bugs, SQL, and fixes in clear, everyday plain English with no unnecessary jargon."
].join("\n");

const endTick = raw.lastIndexOf("`");
if (endTick >= 0 && !raw.includes("Plain-English Explanations (Smart High-School Level)")) {
  raw = raw.slice(0, endTick) + cleanLines + "\n" + raw.slice(endTick);
}

fs.writeFileSync(bootPath, raw, "utf8");
console.log("Repaired src/lib/ecmdBootPrompt.ts cleanly.");
