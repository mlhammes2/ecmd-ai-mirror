import { spawn, execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const hub = "C:\\ECMD\\emerald-coast-detailing-hub";
const telemetryPath = path.join(hub, "public", "ai-telemetry.json");
const historyPath = path.join(hub, "public", "ai-history.json");
const promptFile = process.argv[2];
const rawTask = fs.readFileSync(promptFile, "utf8").trim();

let history = [];
try { history = JSON.parse(fs.readFileSync(historyPath, "utf8")); } catch {}
if (!Array.isArray(history)) history = [];
const refCode = `TURN-${String(history.length + 1).padStart(3, "0")}`;

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  ".output",
  ".nitro",
  ".tanstack",
  "coverage",
  ".vite",
]);

const IGNORED_FILES = new Set([
  "public/ai-telemetry.json",
  "public/ai-history.json",
]);

const snapshotWorkspaceFiles = (rootDir) => {
  const map = new Map();
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile()) {
        const rel = path.relative(rootDir, fullPath).split(path.sep).join("/");
        if (IGNORED_FILES.has(rel)) continue;
        try {
          const buf = fs.readFileSync(fullPath);
          const hash = crypto.createHash("sha1").update(buf).digest("hex");
          map.set(rel, hash);
        } catch {
          try {
            const st = fs.statSync(fullPath);
            map.set(rel, `${st.mtimeMs}:${st.size}`);
          } catch {}
        }
      }
    }
  };
  walk(rootDir);
  return map;
};

const diffWorkspaceSnapshots = (beforeMap, afterMap) => {
  const changed = [];
  for (const [rel, afterHash] of afterMap.entries()) {
    if (!beforeMap.has(rel) || beforeMap.get(rel) !== afterHash) {
      changed.push(rel);
    }
  }
  for (const rel of beforeMap.keys()) {
    if (!afterMap.has(rel)) {
      changed.push(rel);
    }
  }
  return changed.sort();
};

const beforeSnapshot = snapshotWorkspaceFiles(hub);

const footerInstruction = `
MANDATORY RULES FOR FAST, HANG-FREE EXECUTION (ECMD PEN v4.2 — ANTIGRAVITY AGY):
1. Never run watch-mode commands—always use "npx tsc --noEmit" and "npx vitest run", and always add AbortSignal.timeout(8000) on any external fetch().
2. NON-INTERACTIVE SHELL GUARD: NEVER run PowerShell Invoke-WebRequest or iwr without -UseBasicParsing (prefer Node fetch() or curl.exe -s for all HTTP checks so non-interactive stdin NEVER hangs on PowerShell's IE Security Warning prompt).
3. Fix any TypeScript or test errors before finishing, and briefly note any intermediate errors you encountered and fixed inside "errorsSummary".
4. End your final message with real, specific text (never copy placeholder words):
===ECMD_SUMMARY_START===
{"shortTitle":"Real 1-sentence summary of changes","humanBullets":["Specific change 1","Specific change 2"],"filesChanged":["src/..."],"errorsSummary":"0 final errors"}
===ECMD_SUMMARY_END===`;

const startedMs = Date.now();
const attemptsLog = ["[0:00] Booting Antigravity CLI (agy.exe --output-format stream-json)..."];
let currentAction = "Initializing Antigravity Gemini 4 workspace...";
let stepCount = 0;
let retryOrWarnCount = 0;

const elapsed = () => {
  const s = Math.floor((Date.now() - startedMs) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const flushLiveTelemetry = () => {
  try {
    fs.writeFileSync(telemetryPath, JSON.stringify({
      refCode,
      engine: "ECMD PEN v4.2 (Antigravity agy)",
      status: "RUNNING",
      updatedAt: new Date().toISOString(),
      tscClean: true,
      shortTitle: `[AGY LIVE ${elapsed()}] Step ${stepCount}: ${currentAction}`,
      humanBullets: attemptsLog.slice(-10),
      attemptsLog,
      errorsSummary: `Running on Antigravity agy (${elapsed()} elapsed · ${stepCount} steps · ${retryOrWarnCount} self-heals)`
    }, null, 2));
  } catch {}
};

flushLiveTelemetry();
const heartbeat = setInterval(flushLiveTelemetry, 2000);

const logStep = (msg, isWarn = false) => {
  stepCount++;
  if (isWarn) retryOrWarnCount++;
  currentAction = msg;
  const line = `[${elapsed()}] #${stepCount} ${msg}`;
  attemptsLog.push(line);
  console.log(isWarn ? `\x1b[33m${line}\x1b[0m` : `\x1b[36m${line}\x1b[0m`);
  flushLiveTelemetry();
};

const agyExe = path.join(process.env.LOCALAPPDATA || "", "agy", "bin", "agy.exe");
const binToRun = fs.existsSync(agyExe) ? agyExe : "agy";
const fullPrompt = `${rawTask}\n\n${footerInstruction}`;

// CRITICAL: Keep -p as the VERY LAST argument in agy.exe args when piping via stdin!
const child = spawn(binToRun, ["--dangerously-skip-permissions", "--output-format", "stream-json", "--add-dir", "C:\\ECMD", "-p", "Execute the complete engineering task piped via stdin above."], {
  cwd: hub,
  env: { ...process.env, CI: "true" },
  stdio: ["pipe", "pipe", "pipe"]
});

child.stdin.write(fullPrompt);
child.stdin.end();

let assistantText = "";
let allJsonText = "";
let rawStdoutBuf = "";
let errText = "";

const walkForToolsAndText = (obj) => {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) { obj.forEach(walkForToolsAndText); return; }
  if (obj.type === "tool_use" || obj.type === "functionCall" || (obj.name && (obj.input || obj.args || obj.parameters))) {
    const name = obj.name || obj.tool_name || "tool";
    const a = obj.input || obj.args || obj.parameters || {};
    const target = a.file_path || a.path || a.command || a.cmd || a.dir_path || a.pattern || a.query || "";
    const shortTarget = String(target).replace("C:\\ECMD\\emerald-coast-detailing-hub\\", "").slice(0, 95);
    logStep(`TOOL ${name}${shortTarget ? " -> " + shortTarget : ""}`);
  }
  if (typeof obj.text === "string") assistantText += obj.text + "\n";
  if (typeof obj.result === "string") assistantText += obj.result + "\n";
  if (typeof obj.content === "string") assistantText += obj.content + "\n";
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") walkForToolsAndText(v);
  }
};

child.stdout.on("data", (chunk) => {
  const str = chunk.toString();
  rawStdoutBuf += str;
  allJsonText += str;
  const lines = rawStdoutBuf.split(/\r?\n/);
  rawStdoutBuf = lines.pop() || "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const evt = JSON.parse(trimmed);
      walkForToolsAndText(evt);
      if (evt.is_error || evt.type === "error") {
        logStep(`SELF-HEAL TRIGGERED: ${JSON.stringify(evt).slice(0, 140)}`, true);
      }
    } catch {
      assistantText += line + "\n";
    }
  }
});

child.stderr.on("data", (d) => {
  const s = d.toString();
  errText += s;
  const clean = s.trim().replace(/\s+/g, " ");
  if (!clean || /256-color|DeprecationWarning|Ripgrep/i.test(clean)) return;
  // Normal agy orchestrator progress messages (NOT warnings!)
  if (/root agent idle; waiting for|waiting for \d+ background task/i.test(clean)) {
    logStep(`AGY ORCHESTRATOR: ${clean.slice(0, 120)}`, false);
  } else if (/error|fail|denied|fatal/i.test(clean)) {
    logStep(`AGY WARN: ${clean.slice(0, 130)}`, true);
  } else {
    logStep(`AGY STATUS: ${clean.slice(0, 120)}`, false);
  }
});

child.on("close", async (code) => {
  clearInterval(heartbeat);
  logStep("FINAL CHECK: npx tsc --noEmit");
  let tscOutput = "";
  let tscClean = true;
  try {
    execSync("npx tsc --noEmit", { cwd: hub, stdio: "pipe" });
  } catch (e) {
    tscClean = false;
    tscOutput = ((e.stdout?.toString() || "") + "\n" + (e.stderr?.toString() || "")).trim();
    logStep(`FINAL TSC FAILED: ${tscOutput.slice(0, 140)}`, true);
  }

  let vitestClean = true;
  if (tscClean) {
    logStep("FINAL CHECK: npx vitest run");
    try {
      execSync("npx vitest run", { cwd: hub, stdio: "pipe", timeout: 120000 });
    } catch (e) {
      vitestClean = false;
      const vtErr = ((e.stdout?.toString() || "") + "\n" + (e.stderr?.toString() || "")).trim();
      logStep(`FINAL VITEST FAILED: ${vtErr.slice(0, 140)}`, true);
    }
  } else {
    vitestClean = false;
  }

  if (tscClean && vitestClean) {
    const mirrorScript = "C:\\ECMD\\scripts\\sync-ai-mirror.mjs";
    if (fs.existsSync(mirrorScript)) {
      logStep("AUTO-SYNC: node C:\\ECMD\\scripts\\sync-ai-mirror.mjs --push");
      try {
        execSync(`node "${mirrorScript}" --push`, { cwd: hub, stdio: "pipe", timeout: 90000 });
        logStep("AUTO-SYNC COMPLETE: mlhammes2/ecmd-ai-mirror updated");
      } catch (mirrorErr) {
        const mMsg = ((mirrorErr.stderr?.toString() || "") || mirrorErr.message || "").trim();
        logStep(`AUTO-SYNC NON-FATAL WARN: ${mMsg.slice(0, 140)}`, true);
      }
    }
  }

  const afterSnapshot = snapshotWorkspaceFiles(hub);
  const autoChanged = diffWorkspaceSnapshots(beforeSnapshot, afterSnapshot);

  const finalOut = (assistantText || allJsonText).trim();
  let parsed = {
    shortTitle: `Completed ${refCode} via Antigravity (agy) in ${elapsed()}`,
    humanBullets: attemptsLog.slice(-6),
    filesChanged: autoChanged,
    errorsSummary: tscClean ? "0 final compiler errors" : "TypeScript errors need attention"
  };

  const m = finalOut.match(/===ECMD_SUMMARY_START===\s*([\s\S]*?)\s*===ECMD_SUMMARY_END===/);
  if (m && m[1]) {
    try {
      const p = JSON.parse(m[1]);
      parsed = { ...parsed, ...p, filesChanged: p.filesChanged?.length ? p.filesChanged : autoChanged };
    } catch {}
  }
  const cleanCliText = finalOut.replace(/===ECMD_SUMMARY_START===[\s\S]*?===ECMD_SUMMARY_END===/, "").trim();

  const ok = code === 0 && tscClean;
  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeLabel = now.toLocaleTimeString();
  const fullErrSummary = `${parsed.errorsSummary} | agy ${stepCount} steps, ${retryOrWarnCount} self-heals in ${elapsed()}`;

  const slimTelemetry = {
    refCode,
    engine: "ECMD PEN v4.2 (Antigravity agy)",
    status: ok ? "COMPLETE_CLEAN" : "NEEDS_ATTENTION",
    updatedAt: now.toISOString(),
    date: dateLabel,
    timestamp: timeLabel,
    tscClean,
    shortTitle: parsed.shortTitle,
    humanBullets: parsed.humanBullets,
    filesChanged: parsed.filesChanged,
    errorsSummary: fullErrSummary,
    attemptsLog: attemptsLog.slice(-35),
    tscOutput: tscOutput.slice(0, 1500)
  };
  fs.writeFileSync(telemetryPath, JSON.stringify(slimTelemetry, null, 2));

  const traceReport = `=== ANTIGRAVITY (AGY) STEP & SELF-HEAL LOG ===\n${attemptsLog.join("\n")}\n\n=== ASSISTANT SUMMARY ===\n${cleanCliText.slice(0, 8000)}`;

  let latestHistory = [];
  try { latestHistory = JSON.parse(fs.readFileSync(historyPath, "utf8")); } catch {}
  if (!Array.isArray(latestHistory)) latestHistory = [];
  latestHistory.unshift({ ...slimTelemetry, id: refCode, exitCode: code, taskPrompt: rawTask, cliSummary: traceReport, cliStderr: errText.trim() });
  fs.writeFileSync(historyPath, JSON.stringify(latestHistory.slice(0, 50), null, 2));

  try {
    const b64 = (s) => Buffer.from(String(s || ""), "utf8").toString("base64");
    const sql = `INSERT INTO public.ecmd_pen_turns (ref_code, date_label, time_label, status, tsc_clean, short_title, human_bullets, files_changed, errors_summary, task_prompt, raw_cli_output, tsc_output) VALUES ('${refCode}', convert_from(decode('${b64(dateLabel)}','base64'),'UTF8'), '${timeLabel}', '${slimTelemetry.status}', ${tscClean}, convert_from(decode('${b64(parsed.shortTitle)}','base64'),'UTF8'), convert_from(decode('${b64(JSON.stringify(parsed.humanBullets))}','base64'),'UTF8')::jsonb, convert_from(decode('${b64(JSON.stringify(parsed.filesChanged))}','base64'),'UTF8')::jsonb, convert_from(decode('${b64(fullErrSummary)}','base64'),'UTF8'), convert_from(decode('${b64(rawTask)}','base64'),'UTF8'), convert_from(decode('${b64(traceReport)}','base64'),'UTF8'), convert_from(decode('${b64(tscOutput)}','base64'),'UTF8')) ON CONFLICT (ref_code) DO UPDATE SET status = EXCLUDED.status, raw_cli_output = EXCLUDED.raw_cli_output;`;
    await fetch("https://lvynkeuceiqxafgpgdvs.supabase.co/functions/v1/ecmd-carbon-bridge", {
      method: "POST",
      headers: { "x-bridge-key": "[REDACTED_SECRET]", "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run_sql", sql }),
      signal: AbortSignal.timeout(8000)
    });
  } catch {}

  process.exit(ok ? 0 : 1);
});
