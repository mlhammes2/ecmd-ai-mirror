#!/usr/bin/env node
/**
 * ECMD Automated Supabase + Full-Site Public AI Mirror Engine
 * Mirrors:
 *   - hub/             -> C:\ECMD\emerald-coast-detailing-hub (clean source mirror)
 *   - runner/          -> C:\ECMD\scripts, GEMINI.md, AGENTS.md, Wix Velo legacy src/, workflows
 *   - supabase-mirror/ -> Public schema, SQL functions, RLS, triggers, safe CMS/package/Wix table snapshots, edge functions
 *   - SITE_MANIFEST.md & SITE_MANIFEST.json at repo root with exact raw GitHub URLs
 *
 * Usage:
 *   node C:\ECMD\scripts\sync-ai-mirror.mjs           # build staging mirror & commit locally
 *   node C:\ECMD\scripts\sync-ai-mirror.mjs --push    # build, commit, create repo if needed, and push to origin/main
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const ROOT_DIR = "C:\\ECMD";
const HUB_DIR = path.join(ROOT_DIR, "emerald-coast-detailing-hub");
const STAGING_DIR = path.join(ROOT_DIR, ".ai-mirror");
const ECMD_SQL_SCRIPT = path.join(HUB_DIR, "scripts", "ecmd-sql.mjs");

const GITHUB_OWNER = "mlhammes2";
const GITHUB_REPO = "ecmd-ai-mirror";
const REPO_SLUG = `${GITHUB_OWNER}/${GITHUB_REPO}`;
const REMOTE_URL = `https://github.com/${REPO_SLUG}.git`;
const RAW_BASE_URL = `https://raw.githubusercontent.com/${REPO_SLUG}/main`;
const BRANCH_NAME = "main";

const SHOULD_PUSH = process.argv.includes("--push");
const SKIP_SUPABASE = process.argv.includes("--skip-supabase");

const MAX_TEXT_FILE_BYTES = 4 * 1024 * 1024; // 4 MB safety cap per mirrored text file

// Directories excluded anywhere during mirroring
const HUB_EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".vinxi",
  ".tanstack",
  ".output",
  ".wrangler",
  ".vite",
  ".carbon-staging",
  ".lovable",
  "coverage",
  ".temp",
  ".ai-mirror",
  ".cache",
  "tmp",
]);

const RUNNER_EXCLUDED_TOP_DIRS = new Set([
  "node_modules",
  ".git",
  ".ai-mirror",
  "emerald-coast-detailing-hub",
  "mobile-dist",
  ".wrangler",
  ".cache",
  "tmp",
  "logs",
]);

const RUNNER_EXCLUDED_SUBDIRS = new Set([
  "node_modules",
  ".git",
  ".wrangler",
  ".carbon-staging",
  ".cache",
  "dist",
  "coverage",
  ".temp",
  "tmp",
]);

const EXCLUDED_FILENAMES = new Set([
  "package-lock.json",
  "bun.lock",
  "bun.lockb",
  "yarn.lock",
  "pnpm-lock.yaml",
  "wix.lock",
  ".ecmd-machine-token",
  "gh_put.json",
  "LAST_SQL_RESULT.md",
  "DS_Store",
  ".DS_Store",
  "Thumbs.db",
  "ai-history.json",
  "wix-vault-index.json",
  "ai-site-manifest.json",
]);

const BINARY_OR_SKIP_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".ico",
  ".avif",
  ".tiff",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".7z",
  ".rar",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".node",
  ".bin",
  ".wasm",
  ".mp4",
  ".webm",
  ".mp3",
  ".wav",
  ".mov",
  ".map",
  ".pem",
  ".key",
  ".pfx",
  ".p12",
  ".crt",
  ".cer",
  ".log",
  ".tmp",
  ".bak",
]);

// Tables STRICTLY EXCLUDED from data export (auth, PII, customer/contractor CRM, private logs/queues)
const BLOCKED_TABLE_PATTERNS = [
  /member/i,
  /customer/i,
  /contact/i,
  /contractor/i,
  /user/i,
  /auth/i,
  /password/i,
  /secret/i,
  /token/i,
  /session/i,
  /payment/i,
  /invoice/i,
  /crm_/i,
  /conversation/i,
  /message/i,
  /inbox/i,
  /bridge_log/i,
  /sql_log/i,
  /cli_queue/i,
  /dev_job/i,
  /telemetry/i,
  /codebase/i,
  /files_mirror/i,
];

// Explicit allowlist of safe public config/CMS/package/Wix tables (+ dynamic pattern match for future safe tables)
const EXPLICIT_SAFE_TABLES = new Set([
  "ecmd_packages",
  "ecmd_external_ai_cms",
  "ecmd_wix_legacy_vault",
  "ecmd_site_blueprints",
  "ecmd_site_menu_buttons",
  "ecmd_plasmic_hydration",
  "ecmd_ai_registry",
  "ecmd_advanced_suggestions",
  "ecmd_brain",
  "ecmd_pen_turns",
  "ecmd_diagnostic_runs",
]);

const SAFE_TABLE_AUTO_PATTERN = /(theme|package|wix|cms|blueprint|menu|plasmic|config|setting|catalog)/i;

// Columns stripped from exported rows (sensitive fields or giant binary/embedding vectors)
const STRIPPED_COLUMN_PATTERN = /(password|pass_hash|hash|secret|token|api_key|private_key|ssn|credit_card|embedding)/i;

let totalRedactions = 0;

/**
 * Mandatory secret scrubber applied to every mirrored text/JSON/SQL/code file
 * so GitHub Push Protection and public privacy boundaries are never violated.
 */
function scrubSecrets(text) {
  if (typeof text !== "string" || !text) return text;
  let out = text;

  const replaceWithCount = (regex, replacement) => {
    out = out.replace(regex, (...args) => {
      totalRedactions++;
      if (typeof replacement === "function") {
        return replacement(...args);
      }
      const match = args[0];
      return match.replace(regex, replacement);
    });
  };

  // 1. Private key PEM blocks
  replaceWithCount(
    /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
    () => "[REDACTED_SECRET]"
  );

  // 2. JWTs (header.payload.signature)
  replaceWithCount(
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    () => "[REDACTED_SECRET]"
  );

  // 3. Supabase access tokens & secret keys
  replaceWithCount(/\bsbp_[A-Za-z0-9_-]{16,}\b/g, () => "[REDACTED_SECRET]");
  replaceWithCount(/\bsb_secret_[A-Za-z0-9_-]{12,}\b/g, () => "[REDACTED_SECRET]");

  // 4. Google API keys
  replaceWithCount(/\bAIza[0-9A-Za-z_-]{35}\b/g, () => "[REDACTED_SECRET]");

  // 5. GitHub tokens
  replaceWithCount(/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g, () => "[REDACTED_SECRET]");
  replaceWithCount(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, () => "[REDACTED_SECRET]");

  // 6. OpenAI / Anthropic / Stripe / AWS / Slack keys
  replaceWithCount(/\bsk-(?:proj-|ant-|live-|test-)?[A-Za-z0-9_-]{20,}\b/g, () => "[REDACTED_SECRET]");
  replaceWithCount(/\brk_(?:live|test)_[A-Za-z0-9]{16,}\b/g, () => "[REDACTED_SECRET]");
  replaceWithCount(/\bAKIA[0-9A-Z]{16}\b/g, () => "[REDACTED_SECRET]");
  replaceWithCount(/\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g, () => "[REDACTED_SECRET]");

  // 7. Postgres connection strings with embedded password
  replaceWithCount(
    /(postgres(?:ql)?:\/\/[^:\s"'`]+:)([^@\s"'`]+)(@)/gi,
    (_m, p1, _p2, p3) => `${p1}[REDACTED_SECRET]${p3}`
  );

  // 8. ECMD internal bridge/gateway/machine keys & env secret assignments
  replaceWithCount(
    /(["']?x-bridge-key["']?\s*[:=]\s*["'])([^"']+)(["'])/gi,
    (_m, p1, _p2, p3) => `${p1}[REDACTED_SECRET]${p3}`
  );
  replaceWithCount(
    /(\b(?:const|let|var)\s+M_TOK\s*=\s*["'])([A-Za-z0-9_-]{24,})(["'])/g,
    (_m, p1, _p2, p3) => `${p1}[REDACTED_SECRET]${p3}`
  );
  replaceWithCount(
    /(\b(?:const|let|var)\s+KEY\s*=\s*["'])(ecmd_cf_[^"']+)(["'])/g,
    (_m, p1, _p2, p3) => `${p1}[REDACTED_SECRET]${p3}`
  );
  replaceWithCount(/\becmd_cf_[A-Za-z0-9_-]{4,}\b/g, () => "[REDACTED_SECRET]");
  replaceWithCount(
    /(\b(?:SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|GEMINI_API_KEY|OPENAI_API_KEY|LOVABLE_API_KEY|ECMD_BRIDGE_KEY|STRIPE_SECRET_KEY|TWILIO_AUTH_TOKEN|BRAINTREE_PRIVATE_KEY|BRIDGE_KEY)\s*[:=]\s*["'])([^"'\s]{8,})(["'])/gi,
    (_m, p1, _p2, p3) => `${p1}[REDACTED_SECRET]${p3}`
  );
  replaceWithCount(
    /(Bearer\s+)([A-Za-z0-9._-]{24,})/g,
    (_m, p1, p2) => (p2 === "[REDACTED_SECRET]" ? `${p1}${p2}` : `${p1}[REDACTED_SECRET]`)
  );

  // Also scrub any known bridge password if it appears outside the x-bridge-key header
  const bridgeSecret = extractLocalBridgeSecret();
  if (bridgeSecret && out.includes(bridgeSecret)) {
    const escaped = bridgeSecret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    replaceWithCount(new RegExp(escaped, "g"), () => "[REDACTED_SECRET]");
  }

  return out;
}

let cachedBridgeSecret;
function extractLocalBridgeSecret() {
  if (cachedBridgeSecret !== undefined) return cachedBridgeSecret;
  cachedBridgeSecret = "";
  try {
    const src = fs.readFileSync(ECMD_SQL_SCRIPT, "utf8");
    const m = src.match(/["']x-bridge-key["']\s*:\s*["']([^"']+)["']/i);
    if (m && m[1]) cachedBridgeSecret = m[1];
  } catch {
    // ignore
  }
  return cachedBridgeSecret;
}

function isEnvFile(filename) {
  const lower = filename.toLowerCase();
  return lower === ".env" || lower.startsWith(".env.") || lower.endsWith(".env");
}

function isBinaryBuffer(buf) {
  const checkLen = Math.min(buf.length, 4096);
  for (let i = 0; i < checkLen; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cleanDirPreservingGit(targetDir) {
  if (!fs.existsSync(targetDir)) return;
  for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    fs.rmSync(path.join(targetDir, entry.name), { recursive: true, force: true });
  }
}

function writeScrubbedTextFile(destPath, content) {
  ensureDir(path.dirname(destPath));
  const scrubbed = scrubSecrets(content);
  fs.writeFileSync(destPath, scrubbed, "utf8");
  return Buffer.byteLength(scrubbed, "utf8");
}

function copyDirectoryClean(srcRoot, destRoot, excludedDirs, opts = {}) {
  const { maxDepth = 30, topLevelFilter = null } = opts;
  const mirroredFiles = [];

  const walk = (currSrc, currDest, depth) => {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(currSrc, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const name = entry.name;
      if (depth === 0 && topLevelFilter && !topLevelFilter(name, entry.isDirectory())) {
        continue;
      }
      if (isEnvFile(name) || EXCLUDED_FILENAMES.has(name)) continue;

      const srcPath = path.join(currSrc, name);
      const destPath = path.join(currDest, name);

      if (entry.isDirectory()) {
        if (excludedDirs.has(name)) continue;
        walk(srcPath, destPath, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(name).toLowerCase();
        if (BINARY_OR_SKIP_EXTENSIONS.has(ext)) continue;

        let stat;
        try {
          stat = fs.statSync(srcPath);
        } catch {
          continue;
        }
        if (stat.size > MAX_TEXT_FILE_BYTES) continue;

        let buf;
        try {
          buf = fs.readFileSync(srcPath);
        } catch {
          continue;
        }
        if (isBinaryBuffer(buf)) continue;

        const text = buf.toString("utf8");
        const writtenBytes = writeScrubbedTextFile(destPath, text);
        mirroredFiles.push({
          relPath: path.relative(STAGING_DIR, destPath).split(path.sep).join("/"),
          sizeBytes: writtenBytes,
        });
      }
    }
  };

  walk(srcRoot, destRoot, 0);
  return mirroredFiles;
}

function runSupabaseSql(sql) {
  const out = execFileSync(process.execPath, [ECMD_SQL_SCRIPT, sql], {
    cwd: HUB_DIR,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: 25000,
  });
  const parsed = JSON.parse(out.trim());
  if (!parsed.ok) {
    throw new Error(parsed.error || "Supabase SQL query failed");
  }
  return parsed.rows || [];
}

function isSafeTableToMirror(tableName) {
  if (EXPLICIT_SAFE_TABLES.has(tableName)) return true;
  if (BLOCKED_TABLE_PATTERNS.some((re) => re.test(tableName))) return false;
  return SAFE_TABLE_AUTO_PATTERN.test(tableName);
}

function sanitizeRowForPublicMirror(tableName, row) {
  const clean = {};
  for (const [k, v] of Object.entries(row || {})) {
    if (STRIPPED_COLUMN_PATTERN.test(k)) continue;
    if (tableName === "ecmd_pen_turns" && k === "raw_cli_output" && typeof v === "string" && v.length > 4000) {
      clean[k] = `${v.slice(0, 4000)}\n... [TRUNCATED FOR MIRROR: ${v.length} chars total]`;
      continue;
    }
    if (
      tableName === "ecmd_external_ai_cms" &&
      row.entry_type === "console_ui_bundle" &&
      k === "system_prompt_directive" &&
      typeof v === "string" &&
      v.length > 3000
    ) {
      clean[k] = `${v.slice(0, 3000)}\n... [TRUNCATED HTML BUNDLE: ${v.length} chars total]`;
      continue;
    }
    clean[k] = v;
  }
  return clean;
}

function generateSchemaOverviewSql({ tables, columnsByTable, constraints, policies, triggers, functions }) {
  const lines = [
    "-- ============================================================================",
    "-- ECMD Supabase Schema Overview (lvynkeuceiqxafgpgdvs)",
    `-- Generated: ${new Date().toISOString()}`,
    "-- Public schema tables, columns, constraints, triggers, RLS policies & custom SQL functions",
    "-- ============================================================================",
    "",
  ];

  for (const t of tables) {
    const cols = columnsByTable[t.table_name] || [];
    lines.push(`-- Table: public.${t.table_name} (rows: ${t.row_count ?? "unknown"}, rls: ${t.rls_enabled ? "ON" : "OFF"})`);
    lines.push(`CREATE TABLE IF NOT EXISTS public.${t.table_name} (`);
    cols.forEach((c, idx) => {
      const nullable = c.is_nullable === "NO" ? " NOT NULL" : "";
      const def = c.column_default ? ` DEFAULT ${c.column_default}` : "";
      const comma = idx < cols.length - 1 ? "," : "";
      lines.push(`  ${c.column_name} ${c.data_type}${nullable}${def}${comma}`);
    });
    lines.push(");");

    const tConstraints = constraints.filter((c) => c.table_name === t.table_name);
    for (const con of tConstraints) {
      lines.push(`--   CONSTRAINT ${con.constraint_name} (${con.constraint_type}): ${con.definition}`);
    }

    const tPolicies = policies.filter((p) => p.tablename === t.table_name);
    for (const pol of tPolicies) {
      lines.push(
        `--   POLICY "${pol.policyname}" ON public.${pol.tablename} FOR ${pol.cmd} TO ${pol.roles} USING (${pol.qual || "true"})${pol.with_check ? ` WITH CHECK (${pol.with_check})` : ""};`
      );
    }

    const tTriggers = triggers.filter((tr) => tr.table_name === t.table_name);
    for (const tr of tTriggers) {
      lines.push(`--   TRIGGER ${tr.trigger_name} (${tr.action_timing} ${tr.event_manipulation}): ${tr.action_statement}`);
    }

    lines.push("");
  }

  lines.push("-- ============================================================================");
  lines.push("-- Custom Public SQL Functions (pg_proc, excluding pgvector internals)");
  lines.push("-- ============================================================================");
  lines.push("");

  for (const fn of functions) {
    lines.push(`-- Function: public.${fn.proname}(${fn.args})`);
    lines.push(fn.definition || `-- (definition unavailable)`);
    lines.push("");
  }

  return lines.join("\n");
}

function mirrorSupabase() {
  const supaDest = path.join(STAGING_DIR, "supabase-mirror");
  const schemaDest = path.join(supaDest, "schema");
  const tablesDest = path.join(supaDest, "tables");
  const edgeDest = path.join(supaDest, "edge-functions");
  ensureDir(schemaDest);
  ensureDir(tablesDest);
  ensureDir(edgeDest);

  const summary = {
    projectRef: "lvynkeuceiqxafgpgdvs",
    exportedAt: new Date().toISOString(),
    tables: [],
    mirroredTables: [],
    excludedTables: [],
    edgeFunctions: [],
    error: null,
  };

  // 1. Copy any local Supabase Edge Functions
  const localFnDirs = [
    path.join(HUB_DIR, "supabase", "functions"),
    path.join(ROOT_DIR, "supabase", "functions"),
  ];
  const discoveredFunctions = new Map();

  for (const fnRoot of localFnDirs) {
    if (!fs.existsSync(fnRoot)) continue;
    for (const entry of fs.readdirSync(fnRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const fnName = entry.name;
      const srcFnDir = path.join(fnRoot, fnName);
      const dstFnDir = path.join(edgeDest, fnName);
      copyDirectoryClean(srcFnDir, dstFnDir, new Set(["node_modules", ".git", ".temp"]));
      discoveredFunctions.set(fnName, {
        name: fnName,
        source: "local",
        localMirrorPath: `supabase-mirror/edge-functions/${fnName}`,
        endpoint: `https://lvynkeuceiqxafgpgdvs.supabase.co/functions/v1/${fnName}`,
      });
    }
  }

  // Also scan workspace scripts/workflows for deployed Supabase Edge Function URLs
  const knownUrlPatterns = [
    path.join(ROOT_DIR, ".github", "workflows", "supabase-deploy.yml"),
    path.join(HUB_DIR, "scripts", "ecmd-sql.mjs"),
    path.join(ROOT_DIR, "scripts", "run-pen-task.mjs"),
  ];
  for (const filePath of knownUrlPatterns) {
    if (!fs.existsSync(filePath)) continue;
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const matches = content.matchAll(/functions\/v1\/([a-zA-Z0-9_-]+)/g);
      for (const m of matches) {
        const fnName = m[1];
        if (!discoveredFunctions.has(fnName)) {
          discoveredFunctions.set(fnName, {
            name: fnName,
            source: "deployed_reference",
            localMirrorPath: null,
            endpoint: `https://lvynkeuceiqxafgpgdvs.supabase.co/functions/v1/${fnName}`,
          });
        }
      }
      const deployMatches = content.matchAll(/functions\s+deploy\s+([a-zA-Z0-9_-]+)/g);
      for (const m of deployMatches) {
        const fnName = m[1];
        if (!discoveredFunctions.has(fnName)) {
          discoveredFunctions.set(fnName, {
            name: fnName,
            source: "workflow_deploy",
            localMirrorPath: null,
            endpoint: `https://lvynkeuceiqxafgpgdvs.supabase.co/functions/v1/${fnName}`,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  for (const fnName of ["ecmd-carbon-bridge", "ecmd-dev-gateway", "geminiAssistant"]) {
    if (!discoveredFunctions.has(fnName)) {
      discoveredFunctions.set(fnName, {
        name: fnName,
        source: "known_platform_function",
        localMirrorPath: null,
        endpoint: `https://lvynkeuceiqxafgpgdvs.supabase.co/functions/v1/${fnName}`,
      });
    }
  }

  summary.edgeFunctions = Array.from(discoveredFunctions.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  writeScrubbedTextFile(
    path.join(edgeDest, "deployed_functions.json"),
    JSON.stringify(
      {
        projectRef: "lvynkeuceiqxafgpgdvs",
        exportedAt: summary.exportedAt,
        functions: summary.edgeFunctions,
      },
      null,
      2
    )
  );

  if (SKIP_SUPABASE) {
    summary.error = "Skipped via --skip-supabase flag";
    return summary;
  }

  try {
    // 2. Query tables + row counts + RLS status
    const tables = runSupabaseSql(`
      SELECT
        t.table_name,
        COALESCE(c.relrowsecurity, false) AS rls_enabled,
        (xpath('/row/cnt/text()', query_to_xml(format('SELECT count(*) AS cnt FROM %I.%I', t.table_schema, t.table_name), false, true, '')))[1]::text::int AS row_count
      FROM information_schema.tables t
      LEFT JOIN pg_class c ON c.relname = t.table_name
      LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name;
    `);

    const columns = runSupabaseSql(`
      SELECT
        table_name,
        ordinal_position,
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);

    const constraints = runSupabaseSql(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        pg_get_constraintdef(pgc.oid) AS definition
      FROM information_schema.table_constraints tc
      JOIN pg_constraint pgc ON pgc.conname = tc.constraint_name
      JOIN pg_namespace n ON n.oid = pgc.connamespace AND n.nspname = tc.table_schema
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_name;
    `);

    const policies = runSupabaseSql(`
      SELECT
        tablename,
        policyname,
        permissive,
        roles::text AS roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);

    const triggers = runSupabaseSql(`
      SELECT
        event_object_table AS table_name,
        trigger_name,
        action_timing,
        event_manipulation,
        action_statement
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table, trigger_name;
    `);

    const functions = runSupabaseSql(`
      SELECT
        p.proname,
        pg_get_function_identity_arguments(p.oid) AS args,
        pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prokind = 'f'
        AND p.proname NOT LIKE 'vector%'
        AND p.proname NOT LIKE 'halfvec%'
        AND p.proname NOT LIKE 'sparsevec%'
        AND p.proname NOT LIKE 'array_to_%vec%'
        AND p.proname NOT IN (
          'avg', 'sum', 'binary_quantize', 'cosine_distance', 'hamming_distance',
          'hnsw_bit_support', 'hnsw_halfvec_support', 'hnsw_sparsevec_support', 'hnswhandler',
          'inner_product', 'ivfflat_bit_support', 'ivfflat_halfvec_support', 'ivfflathandler',
          'jaccard_distance', 'l1_distance', 'l2_distance', 'l2_norm', 'l2_normalize', 'subvector'
        )
      ORDER BY p.proname;
    `);

    const columnsByTable = {};
    for (const col of columns) {
      if (!columnsByTable[col.table_name]) columnsByTable[col.table_name] = [];
      columnsByTable[col.table_name].push(col);
    }

    const schemaJson = {
      projectRef: "lvynkeuceiqxafgpgdvs",
      exportedAt: summary.exportedAt,
      tableCount: tables.length,
      tables: tables.map((t) => ({
        table_name: t.table_name,
        row_count: t.row_count,
        rls_enabled: t.rls_enabled,
        mirrored: isSafeTableToMirror(t.table_name),
        columns: columnsByTable[t.table_name] || [],
        constraints: constraints.filter((c) => c.table_name === t.table_name),
        policies: policies.filter((p) => p.tablename === t.table_name),
        triggers: triggers.filter((tr) => tr.table_name === t.table_name),
      })),
      functions,
    };

    writeScrubbedTextFile(
      path.join(schemaDest, "tables_and_columns.json"),
      JSON.stringify(schemaJson, null, 2)
    );

    const overviewSql = generateSchemaOverviewSql({
      tables,
      columnsByTable,
      constraints,
      policies,
      triggers,
      functions,
    });
    writeScrubbedTextFile(path.join(schemaDest, "schema_overview.sql"), overviewSql);

    // 3. Export safe non-auth/non-PII table snapshots
    for (const t of tables) {
      const name = t.table_name;
      const safe = isSafeTableToMirror(name);
      summary.tables.push({
        table_name: name,
        row_count: t.row_count,
        rls_enabled: t.rls_enabled,
        mirrored: safe,
      });

      if (!safe) {
        summary.excludedTables.push(name);
        continue;
      }

      try {
        const cols = (columnsByTable[name] || [])
          .map((c) => c.column_name)
          .filter((colName) => !STRIPPED_COLUMN_PATTERN.test(colName));

        if (!cols.length) continue;
        const selectList = cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(", ");
        const orderCol = cols.includes("sort_order")
          ? '"sort_order" ASC'
          : cols.includes("updated_at")
            ? '"updated_at" DESC'
            : cols.includes("created_at")
              ? '"created_at" DESC'
              : cols.includes("id")
                ? '"id" ASC'
                : `"${cols[0].replace(/"/g, '""')}" ASC`;

        const rows = runSupabaseSql(`SELECT ${selectList} FROM public."${name}" ORDER BY ${orderCol} LIMIT 250;`);
        const sanitizedRows = rows.map((r) => sanitizeRowForPublicMirror(name, r));

        writeScrubbedTextFile(
          path.join(tablesDest, `${name}.json`),
          JSON.stringify(
            {
              table: name,
              exportedAt: summary.exportedAt,
              totalRowsInDb: t.row_count,
              exportedRowCount: sanitizedRows.length,
              rows: sanitizedRows,
            },
            null,
            2
          )
        );
        summary.mirroredTables.push(name);
      } catch (tableErr) {
        console.warn(`[sync-ai-mirror] Warning exporting table ${name}: ${tableErr.message}`);
      }
    }
  } catch (err) {
    summary.error = err.message;
    console.warn(`[sync-ai-mirror] Supabase mirror warning: ${err.message}`);
  }

  return summary;
}

function parseRegisteredPlasmicComponents() {
  const initPath = path.join(HUB_DIR, "src", "plasmic-init.ts");
  if (!fs.existsSync(initPath)) return [];
  const src = fs.readFileSync(initPath, "utf8");
  const results = [];
  const regex = /registerEcmdComponent\s*\(\s*([A-Za-z0-9_$]+)\s*,\s*\{([\s\S]*?)\n\}\);/g;
  let match;
  while ((match = regex.exec(src)) !== null) {
    const symbol = match[1];
    const body = match[2];
    const nameMatch = body.match(/\bname\s*:\s*["']([^"']+)["']/);
    const displayMatch = body.match(/\bdisplayName\s*:\s*["']([^"']+)["']/);
    const importMatch = body.match(/\bimportPath\s*:\s*["']([^"']+)["']/);
    results.push({
      symbol,
      name: nameMatch ? nameMatch[1] : symbol,
      displayName: displayMatch ? displayMatch[1] : nameMatch ? nameMatch[1] : symbol,
      importPath: importMatch ? importMatch[1] : "",
    });
  }
  return results;
}

function getLatestTurnCode() {
  try {
    const tel = JSON.parse(fs.readFileSync(path.join(HUB_DIR, "public", "ai-telemetry.json"), "utf8"));
    if (tel?.refCode) return tel.refCode;
  } catch {
    // ignore
  }
  return "TURN-000";
}

function inferPurposeAndExports(absPath, relPath) {
  const ext = path.extname(relPath).toLowerCase();
  const base = path.basename(relPath);

  if (relPath.startsWith("supabase-mirror/schema/")) {
    return base.endsWith(".sql")
      ? "Supabase public schema DDL, RLS policies, triggers & custom functions"
      : "Supabase public tables, columns, constraints, policies & functions JSON";
  }
  if (relPath.startsWith("supabase-mirror/tables/")) {
    return `Supabase public.${base.replace(/\.json$/i, "")} table snapshot (scrubbed)`;
  }
  if (relPath.startsWith("supabase-mirror/edge-functions/")) {
    return base === "deployed_functions.json"
      ? "Supabase Edge Functions registry & endpoint metadata"
      : "Supabase Edge Function source";
  }

  let text = "";
  try {
    text = fs.readFileSync(absPath, "utf8").slice(0, 12000);
  } catch {
    return ext ? `${ext.slice(1).toUpperCase()} file` : "File";
  }

  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".jsw"].includes(ext)) {
    const exportsSet = new Set();
    for (const m of text.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class|interface|type|enum)\s+([A-Za-z0-9_$]+)/g)) {
      exportsSet.add(m[1]);
      if (exportsSet.size >= 6) break;
    }
    if (exportsSet.size === 0) {
      for (const m of text.matchAll(/export\s*\{\s*([^}]+)\}/g)) {
        for (const sym of m[1].split(",")) {
          const clean = sym.trim().split(/\s+as\s+/i)[0].trim();
          if (clean) exportsSet.add(clean);
          if (exportsSet.size >= 6) break;
        }
      }
    }
    if (exportsSet.size === 0) {
      for (const m of text.matchAll(/(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/g)) {
        exportsSet.add(m[1]);
        if (exportsSet.size >= 5) break;
      }
    }
    if (exportsSet.size > 0) {
      return `exports: ${Array.from(exportsSet).join(", ")}`;
    }
    if (relPath.includes("/test/") || base.includes(".test.")) return "Vitest automated test suite";
    if (relPath.startsWith("runner/src/pages/")) return "Wix Velo legacy page controller";
    if (relPath.startsWith("runner/src/public/")) return "Wix Velo legacy client engine";
    if (relPath.startsWith("runner/src/backend/")) return "Wix Velo legacy backend module";
    if (relPath.startsWith("runner/scripts/")) return "ECMD automation/PEN runner script";
    return "Code module";
  }

  if (ext === ".md") {
    const h1 = text.match(/^#\s+(.+)$/m);
    return h1 ? `Doc: ${h1[1].trim().slice(0, 75)}` : "Markdown documentation";
  }
  if (ext === ".css") return "Stylesheet";
  if (ext === ".ps1") return "PowerShell automation script";
  if (ext === ".yml" || ext === ".yaml") return "GitHub Actions / YAML workflow";
  if (ext === ".json") {
    if (base === "package.json") return "Package manifest & scripts";
    if (base.startsWith("tsconfig")) return "TypeScript configuration";
    if (base.includes("diagnostics")) return "Plasmic Canvas live diagnostics store";
    if (base.includes("runtime-errors")) return "DEV browser runtime errors store";
    if (base.includes("telemetry")) return "ECMD PEN live turn telemetry";
    if (base.includes("wix-vault")) return "Wix legacy vault file index";
    return "JSON data / config";
  }
  if (ext === ".html") return "HTML template / console";
  if (ext === ".svg") return "SVG vector asset";
  if (ext === ".sql") return "SQL script";
  return "Text/config file";
}

function collectAllMirroredFiles() {
  const files = [];
  const sections = ["hub", "runner", "supabase-mirror"];

  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const rel = path.relative(STAGING_DIR, full).split(path.sep).join("/");
        const stat = fs.statSync(full);
        const section = rel.split("/")[0];
        files.push({
          section,
          path: rel,
          rawUrl: `${RAW_BASE_URL}/${rel.split("/").map(encodeURIComponent).join("/")}`,
          sizeBytes: stat.size,
          purpose: inferPurposeAndExports(full, rel),
        });
      }
    }
  };

  for (const sec of sections) {
    walk(path.join(STAGING_DIR, sec));
  }
  return files;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function findWixMigrationFiles(allFiles) {
  const migrationRegex =
    /(wix|packagesEngine|whatsIncluded|repeaterEngine|packageMatcher|EcmdPackagesRepeater|EcmdVehicleSelector|EcmdAuthModalController|EcmdThemeGroupController|EcmdBrushedSteelButton|ecmd_wix_legacy_vault|ecmd_packages|filePackageEdits|fileCartEdits|hqBookingEngine|booking|cartEngine)/i;
  return allFiles.filter((f) => migrationRegex.test(f.path));
}

function generateManifests({ supaSummary, registeredComponents, latestTurn, allFiles }) {
  const generatedAt = new Date().toISOString();
  const migrationFiles = findWixMigrationFiles(allFiles);

  const bySection = {
    hub: allFiles.filter((f) => f.section === "hub"),
    runner: allFiles.filter((f) => f.section === "runner"),
    "supabase-mirror": allFiles.filter((f) => f.section === "supabase-mirror"),
  };

  const manifestJson = {
    repo: REPO_SLUG,
    branch: BRANCH_NAME,
    rawBaseUrl: RAW_BASE_URL,
    manifestUrl: `${RAW_BASE_URL}/SITE_MANIFEST.md`,
    generatedAt,
    latestTurn,
    counts: {
      totalFiles: allFiles.length,
      hubFiles: bySection.hub.length,
      runnerFiles: bySection.runner.length,
      supabaseMirrorFiles: bySection["supabase-mirror"].length,
      registeredPlasmicComponents: registeredComponents.length,
      supabasePublicTables: supaSummary.tables.length,
      supabaseMirroredTables: supaSummary.mirroredTables.length,
      secretsRedacted: totalRedactions,
    },
    supabase: supaSummary,
    registeredComponents,
    wixToPlasmicMigrationFiles: migrationFiles.map((f) => ({
      path: f.path,
      rawUrl: f.rawUrl,
      sizeBytes: f.sizeBytes,
      purpose: f.purpose,
    })),
    files: allFiles,
  };

  const md = [];
  md.push(`# ECMD Full-Site Public AI Mirror — \`SITE_MANIFEST.md\``);
  md.push("");
  md.push(
    `> **Auto-synced public AI grounding mirror** for **Emerald Coast Mobile Detailing (ECMD)** (\`${REPO_SLUG}\`, branch \`${BRANCH_NAME}\`).`
  );
  md.push(`> Chrome Gemini Sidebar & external architects: fetch this manifest first, then fetch any exact raw GitHub URL below on demand.`);
  md.push("");
  md.push("## Summary");
  md.push(`- **Generated At:** \`${generatedAt}\``);
  md.push(`- **Latest Turn:** \`${latestTurn}\``);
  md.push(`- **Manifest Raw URL:** ${RAW_BASE_URL}/SITE_MANIFEST.md`);
  md.push(`- **JSON Manifest Raw URL:** ${RAW_BASE_URL}/SITE_MANIFEST.json`);
  md.push(
    `- **Mirrored Files:** **${allFiles.length}** total (\`hub/\`: ${bySection.hub.length}, \`runner/\`: ${bySection.runner.length}, \`supabase-mirror/\`: ${bySection["supabase-mirror"].length})`
  );
  md.push(`- **Secrets Scrubbed:** ${totalRedactions} redaction(s) applied (zero \`.env*\`, zero auth/PII tables exported)`);
  md.push("");

  md.push("## Supabase Summary (`lvynkeuceiqxafgpgdvs`)");
  if (supaSummary.error) {
    md.push(`- **Note:** \`${supaSummary.error}\``);
  }
  md.push(
    `- **Public Tables:** ${supaSummary.tables.length} total · **${supaSummary.mirroredTables.length}** safe config/CMS/package/Wix tables mirrored · **${supaSummary.excludedTables.length}** auth/PII/log tables strictly excluded`
  );
  md.push(`- **Schema DDL:** ${RAW_BASE_URL}/supabase-mirror/schema/schema_overview.sql`);
  md.push(`- **Schema JSON:** ${RAW_BASE_URL}/supabase-mirror/schema/tables_and_columns.json`);
  md.push(`- **Edge Functions Registry:** ${RAW_BASE_URL}/supabase-mirror/edge-functions/deployed_functions.json`);
  md.push("");
  if (supaSummary.tables.length > 0) {
    md.push("| Table | Rows | RLS | Mirrored |");
    md.push("|---|---:|:---:|:---:|");
    for (const t of supaSummary.tables) {
      const mirrorCell = t.mirrored
        ? `[JSON](${RAW_BASE_URL}/supabase-mirror/tables/${t.table_name}.json)`
        : "Excluded (Auth/PII/Log)";
      md.push(`| \`${t.table_name}\` | ${t.row_count ?? 0} | ${t.rls_enabled ? "ON" : "OFF"} | ${mirrorCell} |`);
    }
    md.push("");
  }

  md.push(`## Plasmic Registered Components (\`ECMD_REGISTERED_COMPONENTS\` — ${registeredComponents.length})`);
  md.push("| Name | Display Name | Import Path |");
  md.push("|---|---|---|");
  for (const c of registeredComponents) {
    md.push(`| \`${c.name}\` | ${c.displayName} | \`${c.importPath}\` |`);
  }
  md.push("");

  md.push(`## Key Wix-to-Plasmic Migration Files (${migrationFiles.length})`);
  for (const f of migrationFiles) {
    md.push(`- \`${f.path}\` (${formatSize(f.sizeBytes)}) — ${f.purpose} — ${f.rawUrl}`);
  }
  md.push("");

  const renderSection = (title, key) => {
    const list = bySection[key];
    md.push(`## Files: \`${title}\` (${list.length})`);
    md.push("| Path | Size | Exports / Purpose | Raw GitHub URL |");
    md.push("|---|---:|---|---|");
    for (const f of list) {
      const safePurpose = String(f.purpose || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
      md.push(`| \`${f.path}\` | ${formatSize(f.sizeBytes)} | ${safePurpose} | ${f.rawUrl} |`);
    }
    md.push("");
  };

  renderSection("hub/", "hub");
  renderSection("runner/", "runner");
  renderSection("supabase-mirror/", "supabase-mirror");

  writeScrubbedTextFile(path.join(STAGING_DIR, "SITE_MANIFEST.md"), md.join("\n"));
  writeScrubbedTextFile(path.join(STAGING_DIR, "SITE_MANIFEST.json"), JSON.stringify(manifestJson, null, 2));

  const readmeContent = [
    `# ECMD Automated Public AI Mirror (\`${REPO_SLUG}\`)`,
    "",
    `Automatically mirrored from \`C:\\ECMD\`, \`C:\\ECMD\\emerald-coast-detailing-hub\`, and Supabase project \`lvynkeuceiqxafgpgdvs\` (public schema + safe non-PII tables) with mandatory secret scrubbing.`,
    "",
    `- **Start here:** [${RAW_BASE_URL}/SITE_MANIFEST.md](${RAW_BASE_URL}/SITE_MANIFEST.md)`,
    `- **Machine JSON:** [${RAW_BASE_URL}/SITE_MANIFEST.json](${RAW_BASE_URL}/SITE_MANIFEST.json)`,
    `- **Latest Turn:** \`${latestTurn}\``,
    `- **Last Synced:** \`${generatedAt}\``,
    "",
  ].join("\n");
  writeScrubbedTextFile(path.join(STAGING_DIR, "README.md"), readmeContent);
  writeScrubbedTextFile(path.join(STAGING_DIR, ".gitignore"), ".env*\n*.log\n*.tmp\nnode_modules/\n");
}

function runCmd(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    cwd: opts.cwd || STAGING_DIR,
    encoding: "utf8",
    stdio: opts.stdio || "pipe",
    env: { ...process.env, ...(opts.env || {}) },
  });
}

async function ensureGitHubRepoExists() {
  // 1. Try gh CLI first
  const ghAuth = runCmd("gh", ["auth", "status"]);
  if (ghAuth.status === 0) {
    const view = runCmd("gh", ["repo", "view", REPO_SLUG]);
    if (view.status === 0) {
      return { ready: true, method: "gh-existing" };
    }
    console.log(`[sync-ai-mirror] Creating public GitHub repository ${REPO_SLUG} via gh CLI...`);
    const create = runCmd("gh", [
      "repo",
      "create",
      REPO_SLUG,
      "--public",
      "--description",
      "ECMD Automated Public AI Mirror (hub + runner + Supabase schema/CMS)",
    ]);
    if (create.status === 0) {
      return { ready: true, method: "gh-created" };
    }
    return {
      ready: false,
      method: "gh-failed",
      detail: (create.stderr || create.stdout || "").trim(),
    };
  }

  // 2. Fallback to GitHub REST API if GITHUB_TOKEN / GH_TOKEN is set
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) {
    try {
      const checkRes = await fetch(`https://api.github.com/repos/${REPO_SLUG}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "ecmd-ai-mirror",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (checkRes.ok) return { ready: true, method: "rest-existing" };

      const createRes = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "ecmd-ai-mirror",
        },
        body: JSON.stringify({
          name: GITHUB_REPO,
          private: false,
          description: "ECMD Automated Public AI Mirror (hub + runner + Supabase schema/CMS)",
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (createRes.ok) return { ready: true, method: "rest-created" };
      const errBody = await createRes.text();
      return { ready: false, method: "rest-failed", detail: errBody.slice(0, 200) };
    } catch (err) {
      return { ready: false, method: "rest-error", detail: err.message };
    }
  }

  return {
    ready: false,
    method: "unauthenticated",
    detail: `Run once to create & push: gh auth login && gh repo create ${REPO_SLUG} --public && git -C "${STAGING_DIR}" push -u origin ${BRANCH_NAME}`,
  };
}

function getGitIdentityFallback() {
  const nameRes = runCmd("git", ["config", "user.name"], { cwd: HUB_DIR });
  const emailRes = runCmd("git", ["config", "user.email"], { cwd: HUB_DIR });
  return {
    name: (nameRes.stdout || "").trim() || "ECMD AI Mirror Bot",
    email: (emailRes.stdout || "").trim() || "ecmd-mirror@emeraldcoastdetailing.local",
  };
}

async function syncGitAndPush(latestTurn, totalFiles) {
  if (!fs.existsSync(path.join(STAGING_DIR, ".git"))) {
    runCmd("git", ["init", "-b", BRANCH_NAME]);
  } else {
    runCmd("git", ["checkout", "-B", BRANCH_NAME]);
  }

  const identity = getGitIdentityFallback();
  runCmd("git", ["config", "user.name", identity.name]);
  runCmd("git", ["config", "user.email", identity.email]);
  runCmd("git", ["config", "core.autocrlf", "false"]);

  const existingRemote = runCmd("git", ["remote", "get-url", "origin"]);
  if (existingRemote.status !== 0) {
    runCmd("git", ["remote", "add", "origin", REMOTE_URL]);
  } else if (existingRemote.stdout.trim() !== REMOTE_URL) {
    runCmd("git", ["remote", "set-url", "origin", REMOTE_URL]);
  }

  runCmd("git", ["add", "-A"]);
  const status = runCmd("git", ["status", "--porcelain"]);
  const hasChanges = Boolean((status.stdout || "").trim());

  if (hasChanges) {
    const msg = `sync(${latestTurn}): ECMD AI mirror (${totalFiles} files, ${totalRedactions} redactions)`;
    const commitRes = runCmd("git", ["commit", "-m", msg]);
    if (commitRes.status !== 0) {
      throw new Error(`git commit failed: ${(commitRes.stderr || commitRes.stdout || "").trim()}`);
    }
    console.log(`[sync-ai-mirror] Committed locally: ${msg}`);
  } else {
    console.log(`[sync-ai-mirror] No mirror changes to commit.`);
  }

  if (!SHOULD_PUSH) {
    console.log(`[sync-ai-mirror] Staging mirror ready at ${STAGING_DIR} (pass --push to push to ${REMOTE_URL}).`);
    return { pushed: false, skippedPush: true };
  }

  const repoCheck = await ensureGitHubRepoExists();
  if (!repoCheck.ready) {
    console.warn(`[sync-ai-mirror] Local commit ready, but remote repo could not be verified/created (${repoCheck.method}):`);
    console.warn(`  ${repoCheck.detail}`);
    return { pushed: false, reason: repoCheck.detail };
  }

  const pushRes = runCmd("git", ["push", "-u", "origin", BRANCH_NAME, "--force-with-lease"]);
  if (pushRes.status !== 0) {
    // Fallback if remote branch doesn't exist yet or diverged on initial mirror setup
    const pushFallback = runCmd("git", ["push", "-u", "origin", BRANCH_NAME]);
    if (pushFallback.status !== 0) {
      const errOut = (pushFallback.stderr || pushFallback.stdout || "").trim();
      throw new Error(`git push failed: ${errOut}`);
    }
  }

  console.log(`[sync-ai-mirror] Pushed cleanly to ${REMOTE_URL} (${BRANCH_NAME})`);
  console.log(`[sync-ai-mirror] Manifest URL: ${RAW_BASE_URL}/SITE_MANIFEST.md`);
  return { pushed: true, repoMethod: repoCheck.method };
}

async function main() {
  const startedAt = Date.now();
  console.log(`[sync-ai-mirror] Building ECMD Public AI Mirror -> ${STAGING_DIR}`);

  ensureDir(STAGING_DIR);
  cleanDirPreservingGit(STAGING_DIR);

  // 1. Mirror hub/
  const hubFiles = copyDirectoryClean(HUB_DIR, path.join(STAGING_DIR, "hub"), HUB_EXCLUDED_DIRS);
  console.log(`[sync-ai-mirror] Mirrored hub/: ${hubFiles.length} files`);

  // 2. Mirror runner/ (scripts, GEMINI.md, AGENTS.md, Wix Velo legacy src/, workflows, proxy/console)
  const runnerDest = path.join(STAGING_DIR, "runner");
  const runnerFiles = copyDirectoryClean(ROOT_DIR, runnerDest, RUNNER_EXCLUDED_SUBDIRS, {
    topLevelFilter: (name, isDir) => {
      if (isDir) return !RUNNER_EXCLUDED_TOP_DIRS.has(name);
      return !isEnvFile(name) && !EXCLUDED_FILENAMES.has(name);
    },
  });
  console.log(`[sync-ai-mirror] Mirrored runner/: ${runnerFiles.length} files`);

  // 3. Mirror supabase-mirror/
  const supaSummary = mirrorSupabase();
  console.log(
    `[sync-ai-mirror] Mirrored supabase-mirror/: ${supaSummary.tables.length} schema tables, ${supaSummary.mirroredTables.length} safe table snapshots, ${supaSummary.edgeFunctions.length} edge function entries`
  );

  // 4. Generate SITE_MANIFEST.md & SITE_MANIFEST.json
  const registeredComponents = parseRegisteredPlasmicComponents();
  const latestTurn = getLatestTurnCode();
  const allFiles = collectAllMirroredFiles();
  generateManifests({ supaSummary, registeredComponents, latestTurn, allFiles });
  console.log(
    `[sync-ai-mirror] Generated SITE_MANIFEST.md & SITE_MANIFEST.json (${allFiles.length} indexed files, ${totalRedactions} secrets redacted)`
  );

  // 5. Git commit (& optional push)
  await syncGitAndPush(latestTurn, allFiles.length);

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[sync-ai-mirror] Done in ${elapsedSec}s.`);
}

main().catch((err) => {
  console.error(`[sync-ai-mirror] ERROR: ${err.message}`);
  process.exit(1);
});
