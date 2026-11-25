const sql = process.argv.slice(2).join(" ");
if (!sql) { console.error("Usage: node scripts/ecmd-sql.mjs \"SELECT ...\""); process.exit(1); }
const res = await fetch("https://lvynkeuceiqxafgpgdvs.supabase.co/functions/v1/ecmd-carbon-bridge", {
  method: "POST",
  headers: { "x-bridge-key": "[REDACTED_SECRET]", "Content-Type": "application/json" },
  body: JSON.stringify({ action: "run_sql", sql })
});
console.log(await res.text());
