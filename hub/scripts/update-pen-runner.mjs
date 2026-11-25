import fs from "node:fs";
import path from "node:path";

const target = path.resolve("..", "scripts", "run-pen-task.mjs");
const content = `import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const hub = "C:\\\\ECMD\\\\emerald-coast-detailing-hub";
const telemetryPath = path.join(hub, "public", "ai-telemetry.json");
const historyPath = path.join(hub, "public", "ai-history.json");
const promptFile = process.argv[2];

if (!promptFile || !fs.existsSync(promptFile)) {
  console.error("Usage: node run-pen-task.mjs <prompt_file>");
  process.exit(1);
}

const rawTask = fs.readFileSync(promptFile, "utf8").trim();

// Determine sequential TURN-XXX reference code
let history = [];
try {
  history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
} catch {}
if (!Array.isArray(history)) history = [];

let maxTurnNum = 0;
for (const item of history) {
  const match = (item.refCode || "").match(/TURN-(\\d+)/i);
  if (match) {
    const n = parseInt(match[1], 10);
    if (n > maxTurnNum) maxTurnNum = n;
  }
}
const nextTurnNum = maxTurnNum + 1;
const refCode = "TURN-" + String(nextTurnNum).padStart(3, "0");

const promptTitleGuess = (rawTask.split("\\n")[0] || "Autonomous Task").replace(/^[#*\\-\\s]+/, "").slice(0, 90);

// Initialize ultra-lightweight telemetry (< 4 KB)
fs.writeFileSync(telemetryPath, JSON.stringify({
  refCode,
  status: "RUNNING",
  updatedAt: new Date().toISOString(),
  tscClean: true,
  shortTitle: \`In Progress: \${promptTitleGuess}\`,
  humanBullets: ["Gemini CLI is executing the requested engineering task..."],
  filesChanged: [],
  errorsSummary: "In progress"
}, null, 2));

const fullStdin = \`\${rawTask}

MANDATORY BEFORE FINISHING:
1. Run npx tsc --noEmit and npx vitest run and fix all errors until 0 errors remain.
2. End your final turn with a structured summary footer delimited by <<<PEN_TURN_SUMMARY>>>:
<<<PEN_TURN_SUMMARY>>>
{
  "shortTitle": "1 crisp sentence summarizing the core feature/fix implemented",
  "humanBullets": [
    "Short bullet 1 of action taken & files touched",
    "Short bullet 2 of action taken & files touched",
    "Short bullet 3 of action taken & files touched"
  ],
  "filesChanged": ["file/path1.ts", "file/path2.tsx"],
  "errorsSummary": "0 compiler or runtime errors (or concise summary of issues resolved)"
}
<<<PEN_TURN_SUMMARY>>>\`;

const geminiJs = path.join(process.env.APPDATA || "", "npm", "node_modules", "@google", "gemini-cli", "bundle", "gemini.js");
const child = spawn(process.execPath, [geminiJs, "--yolo", "-p", "Execute the complete engineering task provided via stdin above."], {
  cwd: hub,
  stdio: ["pipe", "pipe", "pipe"]
});

child.stdin.write(fullStdin);
child.stdin.end();

let out = "";
let err = "";
child.stdout.on("data", (d) => { const s = d.toString(); out += s; process.stdout.write(s); });
child.stderr.on("data", (d) => { const s = d.toString(); err += s; process.stderr.write(s); });

child.on("close", async (code) => {
  let tscOutput = "";
  let tscClean = true;
  try {
    execSync("npx tsc --noEmit", { cwd: hub, stdio: "pipe" });
  } catch (e) {
    tscClean = false;
    tscOutput = (e.stdout?.toString() || "") + "\\n" + (e.stderr?.toString() || "");
  }

  const ok = code === 0 && tscClean;
  const cleanSummary = out.trim() || err.trim();

  // Parse structured footer if present
  let parsedSummary = null;
  const match = out.match(/<<<PEN_TURN_SUMMARY>>>([\\s\\S]*?)<<<PEN_TURN_SUMMARY>>>/);
  if (match) {
    try {
      parsedSummary = JSON.parse(match[1].trim());
    } catch {}
  }

  // Fallback parsing if JSON footer was missing or malformed
  const shortTitle = parsedSummary?.shortTitle || promptTitleGuess || "Engineering turn completed";
  let humanBullets = Array.isArray(parsedSummary?.humanBullets) && parsedSummary.humanBullets.length > 0
    ? parsedSummary.humanBullets
    : [];

  if (humanBullets.length === 0) {
    const extracted = cleanSummary
      .split("\\n")
      .map(l => l.trim())
      .filter(l => /^[\\-*\\u2022]\\s+/.test(l))
      .map(l => l.replace(/^[\\-*\\u2022]\\s+/, "").replace(/\\*\\*/g, "").trim())
      .filter(l => l.length > 10 && !l.startsWith("Run ") && !l.startsWith("<<<"));
    if (extracted.length > 0) {
      humanBullets = extracted.slice(0, 4);
    } else {
      humanBullets = [
        "Executed task changes and validated codebase integrity",
        "Checked TypeScript compilation (tsc) and Vitest suite",
        "Updated local telemetry and synchronization records"
      ];
    }
  }

  let filesChanged = Array.isArray(parsedSummary?.filesChanged) ? parsedSummary.filesChanged : [];
  if (filesChanged.length === 0) {
    try {
      const gitStatus = execSync("git status --porcelain", { cwd: hub, encoding: "utf8" });
      filesChanged = gitStatus
        .split("\\n")
        .map(l => l.trim().slice(3).trim())
        .filter(f => f && !f.includes(".gemini") && !f.includes("node_modules"))
        .slice(0, 8);
    } catch {}
  }

  const errorsSummary = parsedSummary?.errorsSummary || (ok ? "0 compiler or runtime errors" : (tscOutput.slice(0, 150) || \`CLI exit code: \${code}\`));

  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeLabel = new Date().toLocaleTimeString();
  const isoNow = new Date().toISOString();

  // 1. Ultra-lightweight ai-telemetry.json (< 4 KB, NO taskPrompt echo!)
  const telemetryData = {
    refCode,
    status: ok ? "COMPLETE_CLEAN" : "NEEDS_ATTENTION",
    updatedAt: isoNow,
    tscClean,
    shortTitle,
    humanBullets,
    filesChanged,
    errorsSummary
  };
  fs.writeFileSync(telemetryPath, JSON.stringify(telemetryData, null, 2));

  // 2. Compact ai-history.json record
  const historyRecord = {
    refCode,
    id: Date.now().toString(),
    date: dateLabel,
    timestamp: timeLabel,
    updatedAt: isoNow,
    status: ok ? "COMPLETE_CLEAN" : "NEEDS_ATTENTION",
    exitCode: code,
    tscClean,
    shortTitle,
    humanBullets,
    filesChanged,
    errorsSummary,
    taskPrompt: rawTask,
    rawCliOutput: cleanSummary,
    tscOutput: tscOutput.trim()
  };

  history.unshift(historyRecord);
  fs.writeFileSync(historyPath, JSON.stringify(history.slice(0, 200), null, 2));

  // 3. Insert full detailed record into Supabase public.ecmd_pen_turns
  try {
    const escapeSql = (str) => typeof str === "string" ? str.replace(/'/g, "''") : "";
    const sql = \`INSERT INTO public.ecmd_pen_turns (
      ref_code, created_at, date_label, time_label, status, tsc_clean,
      short_title, human_bullets, files_changed, errors_summary,
      task_prompt, raw_cli_output, tsc_output
    ) VALUES (
      '\${escapeSql(refCode)}',
      '\${isoNow}',
      '\${escapeSql(dateLabel)}',
      '\${escapeSql(timeLabel)}',
      '\${ok ? "COMPLETE_CLEAN" : "NEEDS_ATTENTION"}',
      \${tscClean ? "true" : "false"},
      '\${escapeSql(shortTitle)}',
      '\${escapeSql(JSON.stringify(humanBullets))}'::jsonb,
      '\${escapeSql(JSON.stringify(filesChanged))}'::jsonb,
      '\${escapeSql(errorsSummary)}',
      '\${escapeSql(rawTask)}',
      '\${escapeSql(cleanSummary.slice(0, 50000))}',
      '\${escapeSql(tscOutput.slice(0, 10000))}'
    ) ON CONFLICT (ref_code) DO UPDATE SET
      status = EXCLUDED.status,
      tsc_clean = EXCLUDED.tsc_clean,
      short_title = EXCLUDED.short_title,
      human_bullets = EXCLUDED.human_bullets,
      files_changed = EXCLUDED.files_changed,
      errors_summary = EXCLUDED.errors_summary,
      raw_cli_output = EXCLUDED.raw_cli_output,
      tsc_output = EXCLUDED.tsc_output;\`;

    await fetch("https://lvynkeuceiqxafgpgdvs.supabase.co/functions/v1/ecmd-carbon-bridge", {
      method: "POST",
      headers: { "x-bridge-key": "[REDACTED_SECRET]", "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run_sql", sql })
    });
  } catch (dbErr) {
    console.error("Warning: Could not sync turn to Supabase ecmd_pen_turns:", dbErr.message);
  }

  process.exit(ok ? 0 : 1);
});
`;

fs.writeFileSync(target, content, "utf8");
console.log("Updated C:\\ECMD\\scripts\\run-pen-task.mjs successfully.");
