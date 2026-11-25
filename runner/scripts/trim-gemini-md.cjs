const fs = require("fs");
const p = "C:\\ECMD\\emerald-coast-detailing-hub\\GEMINI.md";
const raw = fs.readFileSync(p, "utf8");
const marker = "## LIVE CARBON 4 BRAIN CONTEXT FROM SUPABASE";
const trimmed = raw.includes(marker)
  ? raw.slice(0, raw.indexOf(marker)).trimEnd() + "\n"
  : raw;
fs.writeFileSync(p, trimmed, "utf8");
console.log(`Trimmed GEMINI.md: ${raw.length} -> ${trimmed.length} bytes!`);
