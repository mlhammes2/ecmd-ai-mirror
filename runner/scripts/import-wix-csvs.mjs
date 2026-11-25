#!/usr/bin/env node
/**
 * ECMD Reusable Wix CMS CSV -> Supabase Importer
 *
 * Scans every `.csv` file in `C:\ECMD\wix-cms-exports`, parses RFC-4180 CSV
 * (quoted fields, commas, escaped quotes, multiline strings, UTF-8 BOM),
 * maps each collection to a canonical `public.ecmd_*` or `public.ecmd_wix_*` table,
 * auto-creates missing tables & adds missing columns dynamically, upserts rows
 * idempotently via `ecmd-carbon-bridge` (`run_sql`), and enforces strict
 * Public Mirrored vs RLS-Protected Private/PII security boundaries.
 *
 * Usage:
 *   node C:\ECMD\scripts\import-wix-csvs.mjs
 *   node C:\ECMD\scripts\import-wix-csvs.mjs --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const CSV_DIR = "C:\\ECMD\\wix-cms-exports";
const HUB_DIR = "C:\\ECMD\\emerald-coast-detailing-hub";
const ECMD_SQL_SCRIPT = path.join(HUB_DIR, "scripts", "ecmd-sql.mjs");
const BRIDGE_URL = "https://lvynkeuceiqxafgpgdvs.supabase.co/functions/v1/ecmd-carbon-bridge";
const OWNER_ADMIN_EMAIL = "mlhammes1@gmail.com";
const DRY_RUN = process.argv.includes("--dry-run");

const MAX_SQL_BATCH_BYTES = 180_000; // safe payload size per Edge Function request

function extractBridgeKey() {
  if (process.env.ECMD_BRIDGE_KEY) return process.env.ECMD_BRIDGE_KEY;
  const src = fs.readFileSync(ECMD_SQL_SCRIPT, "utf8");
  const m = src.match(/["']x-bridge-key["']\s*:\s*["']([^"']+)["']/i);
  if (!m || !m[1]) {
    throw new Error(`Could not extract x-bridge-key from ${ECMD_SQL_SCRIPT}`);
  }
  return m[1];
}

const BRIDGE_KEY = extractBridgeKey();

async function runSql(sql, attempt = 1) {
  if (DRY_RUN) {
    return { ok: true, rows: [], dryRun: true };
  }
  const res = await fetch(BRIDGE_URL, {
    method: "POST",
    headers: {
      "x-bridge-key": BRIDGE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "run_sql", sql }),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  if (!res.ok || !parsed.ok) {
    const errMsg = parsed?.error || `HTTP ${res.status}: ${text.slice(0, 300)}`;
    if (attempt < 3 && /timeout|502|503|504|network|fetch failed/i.test(errMsg)) {
      await new Promise((r) => setTimeout(r, 800 * attempt));
      return runSql(sql, attempt + 1);
    }
    throw new Error(errMsg);
  }
  return parsed;
}

/**
 * RFC-4180 CSV parser handling UTF-8 BOM, quoted fields, escaped quotes (""),
 * embedded commas, and multiline strings.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\r") {
        if (text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/**
 * Canonical mapping & classification for all 26 Wix CMS CSV collections.
 * Any future unknown CSV falls back to `public.ecmd_wix_<slug>` and is
 * automatically classified as RLS Private if its filename or headers match PII/private patterns.
 */
const KNOWN_COLLECTION_CONFIG = {
  // --- PUBLIC / SAFE MIRRORED TABLES (14) ---
  "servicePackages.csv": {
    table: "ecmd_service_packages",
    classification: "public",
    mode: "canonical_service_packages",
    reason: "Core 36-row package pricing matrix",
  },
  "What_s+Included+(Auto).csv": {
    table: "ecmd_whats_included",
    classification: "public",
    mode: "canonical_whats_included",
    reason: "Package inclusions & add-ons catalog",
  },
  "Vehicle+Categories.csv": {
    table: "ecmd_wix_vehicle_categories",
    classification: "public",
    reason: "Vehicle categories & sizing options",
  },
  "Site+Buttons.csv": {
    table: "ecmd_wix_site_buttons",
    classification: "public",
    reason: "Site menu & UI button definitions",
  },
  "Profile Buttons.csv": {
    table: "ecmd_wix_profile_buttons",
    classification: "public",
    reason: "Profile UI button definitions",
  },
  "Availability+Rules.csv": {
    table: "ecmd_wix_availability_rules",
    classification: "public",
    reason: "Scheduling availability rules (non-PII day-of-week blocks)",
  },
  "Calendar+Time+Slots.csv": {
    table: "ecmd_wix_calendar_time_slots",
    classification: "public",
    reason: "Arrival window time slots",
  },
  "Discounts.csv": {
    table: "ecmd_wix_discounts",
    classification: "public",
    reason: "Discount pricing catalog",
  },
  "Promo+Codes.csv": {
    table: "ecmd_wix_promo_codes",
    classification: "public",
    reason: "Promo code definitions",
  },
  "globalSettings.csv": {
    table: "ecmd_wix_global_settings",
    classification: "public",
    reason: "Non-PII global site settings",
  },
  "AI+Brain+Master+Index.csv": {
    table: "ecmd_wix_ai_brain_master_index",
    classification: "public",
    reason: "Non-PII AI pipeline index",
  },
  "AI+Capabilities+&+Rules.csv": {
    table: "ecmd_wix_ai_capabilities_rules",
    classification: "public",
    reason: "Non-PII AI capability specs",
  },
  "AI+Persona+&+Response+Rules.csv": {
    table: "ecmd_wix_ai_persona_response_rules",
    classification: "public",
    reason: "Non-PII AI persona rules",
  },
  "1CodeAndBlueprints.csv": {
    table: "ecmd_wix_code_and_blueprints",
    classification: "public",
    reason: "Wix Velo code & DOM blueprints",
  },

  // --- RLS-PROTECTED PRIVATE / PII TABLES (12) ---
  "Customer+Profiles.csv": {
    table: "ecmd_wix_customer_profiles",
    classification: "private",
    reason: "Customer PII (names, emails, phones, addresses)",
  },
  "Customer+Contacts.csv": {
    table: "ecmd_wix_customer_contacts",
    classification: "private",
    reason: "Customer contact PII",
  },
  "Customer+Locations.csv": {
    table: "ecmd_wix_customer_locations",
    classification: "private",
    reason: "Customer street addresses",
  },
  "Customer+Vehicles.csv": {
    table: "ecmd_wix_customer_vehicles",
    classification: "private",
    reason: "Customer vehicle records & user IDs",
  },
  "Contractors.csv": {
    table: "ecmd_wix_contractors",
    classification: "private",
    reason: "Contractor/staff PII (phones, emails, home addresses, pay)",
  },
  "Bookings.csv": {
    table: "ecmd_wix_bookings",
    classification: "private",
    reason: "Customer bookings",
  },
  "Scheduled+Jobs.csv": {
    table: "ecmd_wix_scheduled_jobs",
    classification: "private",
    reason: "Scheduled customer jobs (PII, addresses, payouts)",
  },
  "Active+Subscriptions.csv": {
    table: "ecmd_wix_active_subscriptions",
    classification: "private",
    reason: "Customer subscriptions",
  },
  "paymentMethods.csv": {
    table: "ecmd_wix_payment_methods",
    classification: "private",
    reason: "Payment provider configuration",
  },
  "Temporary+Data.csv": {
    table: "ecmd_wix_temporary_data",
    classification: "private",
    reason: "Temp carts & in-progress customer order drafts",
  },
  "Login+Security.csv": {
    table: "ecmd_wix_login_security",
    classification: "private",
    reason: "Login & security configuration",
  },
  "SyncErrors.csv": {
    table: "ecmd_wix_sync_errors",
    classification: "private",
    reason: "Calendar/sync error logs",
  },
};

const PRIVATE_FALLBACK_PATTERN =
  /(customer|member|contractor|staff|booking|scheduled|job|vehicle|message|inbox|payment|subscription|temporary|temp_?cart|login|security|sync_?error|auth|secret|token|invoice)/i;

function slugifyIdentifier(raw) {
  let s = String(raw || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  if (!s) s = "col";
  if (/^[0-9]/.test(s)) s = `c_${s}`;
  if (s.length > 58) s = s.slice(0, 58).replace(/_+$/g, "");
  return s;
}

function resolveCollectionConfig(filename) {
  if (KNOWN_COLLECTION_CONFIG[filename]) {
    return KNOWN_COLLECTION_CONFIG[filename];
  }
  const base = filename.replace(/\.csv$/i, "");
  const slug = slugifyIdentifier(base.replace(/\+/g, "_")).replace(/^c_/, "");
  const isPrivate = PRIVATE_FALLBACK_PATTERN.test(base);
  return {
    table: `ecmd_wix_${slug}`,
    classification: isPrivate ? "private" : "public",
    reason: isPrivate ? "Auto-classified private/PII" : "Auto-classified public catalog",
  };
}

function sqlLiteral(val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  if (typeof val === "number") return Number.isFinite(val) ? String(val) : "NULL";
  const str = String(val);
  // Use UTF-8 base64 decoding for strings containing quotes, newlines, backslashes, or non-ASCII
  // to avoid any SQL escaping edge cases (including dollar-quote collisions inside Velo source code!)
  if (str.length === 0) return "''";
  if (/^[a-zA-Z0-9 _.:/,#@()-]{1,120}$/.test(str)) {
    return `'${str}'`;
  }
  const b64 = Buffer.from(str, "utf8").toString("base64");
  return `convert_from(decode('${b64}','base64'),'UTF8')`;
}

function sqlIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function parseOptionalNumber(raw, fallback = 0) {
  const s = String(raw ?? "").trim();
  if (!s) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function parseOptionalInt(raw, fallback = 10) {
  const s = String(raw ?? "").trim();
  if (!s) return fallback;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : fallback;
}

function stripHtmlSummary(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function inferColumnType(colName, values) {
  const nonEmpty = values.map((v) => String(v ?? "").trim()).filter((v) => v.length > 0);
  if (nonEmpty.length === 0) return "TEXT";

  // Keep IDs, zips, phones, sort codes with leading zeros, dates, and URLs as TEXT
  if (/(^id$|_id$|zip|phone|code|sort|token|date|time|url|image|video|html|css|email)/i.test(colName)) {
    return "TEXT";
  }

  if (nonEmpty.every((v) => v === "true" || v === "false")) {
    return "BOOLEAN";
  }

  if (
    nonEmpty.every((v) => /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(v) && Number.isFinite(Number(v)))
  ) {
    return "NUMERIC";
  }

  return "TEXT";
}

function coerceValueForType(rawVal, pgType) {
  const str = rawVal == null ? "" : String(rawVal);
  const trimmed = str.trim();
  const t = String(pgType || "text").toLowerCase();

  if (t.includes("bool")) {
    if (!trimmed) return null;
    if (/^(true|1|yes)$/i.test(trimmed)) return true;
    if (/^(false|0|no)$/i.test(trimmed)) return false;
    return null;
  }
  if (t.includes("int") || t.includes("numeric") || t.includes("double") || t.includes("real") || t.includes("decimal")) {
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? (t.includes("int") ? Math.trunc(n) : n) : null;
  }
  if (t === "jsonb" || t === "json") {
    if (!trimmed) return null;
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      return JSON.stringify(str);
    }
  }
  return str;
}

function buildHeaderColumnMap(headers, reservedMap = {}) {
  const used = new Set(Object.values(reservedMap));
  const mapping = [];

  for (let idx = 0; idx < headers.length; idx++) {
    const rawHeader = headers[idx];
    if (Object.prototype.hasOwnProperty.call(reservedMap, rawHeader)) {
      mapping.push({ index: idx, header: rawHeader, col: reservedMap[rawHeader], reserved: true });
      continue;
    }
    let base = slugifyIdentifier(rawHeader);
    if (base === "id") base = "wix_id";
    if (base === "created_date") base = "wix_created_date";
    if (base === "updated_date") base = "wix_updated_date";
    if (base === "owner") base = "wix_owner";

    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}_${suffix++}`;
    }
    used.add(candidate);
    mapping.push({ index: idx, header: rawHeader, col: candidate, reserved: false });
  }

  return mapping;
}

async function getExistingColumns(tableName) {
  const res = await runSql(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${sqlLiteral(tableName)};`
  );
  const map = new Map();
  for (const r of res.rows || []) {
    map.set(r.column_name, { dataType: r.data_type, nullable: r.is_nullable === "YES" });
  }
  return map;
}

async function applySecurityAndPolicies(tableName, classification) {
  if (classification === "public") {
    const policyName = `Public read ${tableName}`;
    const sql = `
      ALTER TABLE public.${sqlIdent(tableName)} ENABLE ROW LEVEL SECURITY;
      GRANT SELECT ON public.${sqlIdent(tableName)} TO anon, authenticated;
      DROP POLICY IF EXISTS ${sqlIdent(policyName)} ON public.${sqlIdent(tableName)};
      CREATE POLICY ${sqlIdent(policyName)}
        ON public.${sqlIdent(tableName)}
        FOR SELECT
        TO anon, authenticated
        USING (true);
    `;
    await runSql(sql);
  } else {
    const ownerPolicy = `Owner admin access ${tableName}`;
    const publicPolicy = `Public read ${tableName}`;
    const sql = `
      ALTER TABLE public.${sqlIdent(tableName)} ENABLE ROW LEVEL SECURITY;
      REVOKE ALL ON public.${sqlIdent(tableName)} FROM anon;
      DROP POLICY IF EXISTS ${sqlIdent(publicPolicy)} ON public.${sqlIdent(tableName)};
      DROP POLICY IF EXISTS ${sqlIdent(ownerPolicy)} ON public.${sqlIdent(tableName)};
      CREATE POLICY ${sqlIdent(ownerPolicy)}
        ON public.${sqlIdent(tableName)}
        FOR ALL
        TO authenticated
        USING ((auth.jwt() ->> 'email') = ${sqlLiteral(OWNER_ADMIN_EMAIL)})
        WITH CHECK ((auth.jwt() ->> 'email') = ${sqlLiteral(OWNER_ADMIN_EMAIL)});
    `;
    await runSql(sql);
  }
}

async function executeUpsertBatches(tableName, conflictCol, colNames, colTypes, valueTuples, updateCols) {
  if (valueTuples.length === 0) return;

  const colListSql = colNames.map(sqlIdent).join(", ");
  const updateSetSql = updateCols
    .map((c) => `${sqlIdent(c)} = EXCLUDED.${sqlIdent(c)}`)
    .join(", ");

  let batch = [];
  let batchBytes = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    const sql = `
      INSERT INTO public.${sqlIdent(tableName)} (${colListSql})
      VALUES
      ${batch.join(",\n")}
      ON CONFLICT (${sqlIdent(conflictCol)}) DO UPDATE SET
      ${updateSetSql};
    `;
    await runSql(sql);
    batch = [];
    batchBytes = 0;
  };

  for (const tuple of valueTuples) {
    const rowSql = `(${tuple
      .map((val, i) => {
        const pgType = colTypes[i];
        if (pgType === "jsonb" && val !== null) {
          return `${sqlLiteral(val)}::jsonb`;
        }
        return sqlLiteral(val);
      })
      .join(", ")})`;

    if (batch.length > 0 && batchBytes + rowSql.length > MAX_SQL_BATCH_BYTES) {
      await flush();
    }
    batch.push(rowSql);
    batchBytes += rowSql.length;

    if (batchBytes >= MAX_SQL_BATCH_BYTES) {
      await flush();
    }
  }
  await flush();
}

async function importCanonicalServicePackages(headers, dataRows) {
  const tableName = "ecmd_service_packages";
  const reservedMap = {
    ID: "wix_id",
    title: "title",
    packageLevel: "package_level",
    detailType: "detail_type",
    subCategory: "sub_category",
    Category: "service_category",
    price: "price",
    salePrice: "sale_price",
    discountPercent: "discount_percent",
    saleTitle: "sale_title",
    mobileFee: "mobile_fee",
    duration: "duration",
    description: "description",
    Image: "main_display_image",
    biWeeklyPercent: "bi_weekly_percent",
    monthlyPercent: "monthly_percent",
    quarterlyPercent: "quarterly_percent",
    sort: "sort_order",
    "Created Date": "wix_created_date",
    "Updated Date": "wix_updated_date",
    Owner: "wix_owner",
  };

  const colMap = buildHeaderColumnMap(headers, reservedMap);
  const existingCols = await getExistingColumns(tableName);

  // Ensure table exists & unique index on wix_id
  await runSql(`
    CREATE UNIQUE INDEX IF NOT EXISTS ecmd_service_packages_wix_id_uidx
      ON public.ecmd_service_packages (wix_id);
  `);

  // Add any new columns dynamically
  const alterStmts = [];
  for (const entry of colMap) {
    if (!existingCols.has(entry.col)) {
      const colVals = dataRows.map((r) => r[entry.index]);
      const inferred = inferColumnType(entry.col, colVals);
      alterStmts.push(
        `ALTER TABLE public.${sqlIdent(tableName)} ADD COLUMN IF NOT EXISTS ${sqlIdent(entry.col)} ${inferred};`
      );
      existingCols.set(entry.col, { dataType: inferred.toLowerCase(), nullable: true });
    }
  }
  if (!existingCols.has("raw_wix_data")) {
    alterStmts.push(
      `ALTER TABLE public.${sqlIdent(tableName)} ADD COLUMN IF NOT EXISTS raw_wix_data JSONB NOT NULL DEFAULT '{}'::jsonb;`
    );
    existingCols.set("raw_wix_data", { dataType: "jsonb", nullable: false });
  }
  if (alterStmts.length > 0) {
    await runSql(alterStmts.join("\n"));
  }

  const colNames = [
    ...colMap.map((c) => c.col),
    "enabled",
    "raw_wix_data",
    "updated_at",
  ];
  const colTypes = colNames.map((c) => {
    if (c === "raw_wix_data") return "jsonb";
    if (c === "updated_at") return "timestamptz";
    if (c === "enabled") return "boolean";
    return existingCols.get(c)?.dataType || "text";
  });

  const tuples = dataRows.map((row, rowIdx) => {
    const rawObj = {};
    headers.forEach((h, i) => {
      rawObj[h] = row[i] ?? "";
    });

    const values = colMap.map((entry) => {
      const raw = row[entry.index] ?? "";
      const col = entry.col;
      if (col === "wix_id") {
        return String(raw).trim() || `svc-${rowIdx + 1}`;
      }
      if (col === "title") return String(raw).trim() || "Service Package";
      if (col === "package_level") return String(raw).trim() || "Classic";
      if (col === "detail_type") return String(raw).trim() || "Full";
      if (col === "sub_category") return String(raw).trim() || "Sedan";
      if (col === "service_category") return String(raw).trim() || "Auto";
      if (col === "sale_title" || col === "description" || col === "main_display_image") {
        return String(raw ?? "");
      }
      if (col === "price" || col === "sale_price" || col === "discount_percent" || col === "mobile_fee") {
        return parseOptionalNumber(raw, 0);
      }
      if (col === "duration") return parseOptionalNumber(raw, 2);
      if (col === "bi_weekly_percent") return parseOptionalNumber(raw, 20);
      if (col === "monthly_percent") return parseOptionalNumber(raw, 15);
      if (col === "quarterly_percent") return parseOptionalNumber(raw, 10);
      if (col === "sort_order") return parseOptionalInt(raw, 10);
      return coerceValueForType(raw, existingCols.get(col)?.dataType || "text");
    });

    values.push(true); // enabled
    values.push(JSON.stringify(rawObj)); // raw_wix_data
    values.push(new Date().toISOString()); // updated_at
    return values;
  });

  const updateCols = colNames.filter((c) => c !== "wix_id");
  await executeUpsertBatches(tableName, "wix_id", colNames, colTypes, tuples, updateCols);
  await applySecurityAndPolicies(tableName, "public");
  return dataRows.length;
}

async function importCanonicalWhatsIncluded(headers, dataRows) {
  const tableName = "ecmd_whats_included";
  const reservedMap = {
    ID: "wix_id",
    Title: "title",
    "Button Title": "button_title",
    "Detail Type": "detail_type",
    "Package Level": "package_level",
    "What's Included": "whats_included",
    Price: "price",
    Notice: "notice",
    Sort: "sort",
    "Created Date": "wix_created_date",
    "Updated Date": "wix_updated_date",
    Owner: "wix_owner",
  };

  const colMap = buildHeaderColumnMap(headers, reservedMap);
  const existingCols = await getExistingColumns(tableName);

  await runSql(`
    CREATE UNIQUE INDEX IF NOT EXISTS ecmd_whats_included_wix_id_uidx
      ON public.ecmd_whats_included (wix_id);
  `);

  const alterStmts = [];
  for (const entry of colMap) {
    if (!existingCols.has(entry.col)) {
      const colVals = dataRows.map((r) => r[entry.index]);
      const inferred = inferColumnType(entry.col, colVals);
      alterStmts.push(
        `ALTER TABLE public.${sqlIdent(tableName)} ADD COLUMN IF NOT EXISTS ${sqlIdent(entry.col)} ${inferred};`
      );
      existingCols.set(entry.col, { dataType: inferred.toLowerCase(), nullable: true });
    }
  }
  if (!existingCols.has("raw_wix_data")) {
    alterStmts.push(
      `ALTER TABLE public.${sqlIdent(tableName)} ADD COLUMN IF NOT EXISTS raw_wix_data JSONB NOT NULL DEFAULT '{}'::jsonb;`
    );
    existingCols.set("raw_wix_data", { dataType: "jsonb", nullable: false });
  }
  if (alterStmts.length > 0) {
    await runSql(alterStmts.join("\n"));
  }

  // Remove old synthetic placeholder seed rows (`wi-...`) before importing the 30 real Wix CSV rows
  await runSql(`DELETE FROM public.ecmd_whats_included WHERE wix_id LIKE 'wi-%';`);

  const introIdx = headers.indexOf("Intro");
  const overviewIdx = headers.indexOf("Overview");

  const colNames = [
    ...colMap.map((c) => c.col),
    "description",
    "enabled",
    "raw_wix_data",
  ];
  const colTypes = colNames.map((c) => {
    if (c === "raw_wix_data") return "jsonb";
    if (c === "enabled") return "boolean";
    if (c === "description") return "text";
    return existingCols.get(c)?.dataType || "text";
  });

  const tuples = dataRows.map((row, rowIdx) => {
    const rawObj = {};
    headers.forEach((h, i) => {
      rawObj[h] = row[i] ?? "";
    });

    const values = colMap.map((entry) => {
      const raw = row[entry.index] ?? "";
      const col = entry.col;
      if (col === "wix_id") return String(raw).trim() || `wix-wi-${rowIdx + 1}`;
      if (col === "title") return String(raw).trim() || "Included Item";
      if (col === "button_title" || col === "package_level" || col === "whats_included" || col === "notice") {
        return String(raw ?? "");
      }
      if (col === "detail_type") return String(raw).trim() || "Interior";
      if (col === "price") return parseOptionalNumber(raw, 0);
      if (col === "sort") return parseOptionalInt(raw, 10);
      return coerceValueForType(raw, existingCols.get(col)?.dataType || "text");
    });

    const introText = introIdx >= 0 ? stripHtmlSummary(row[introIdx]) : "";
    const overviewText = overviewIdx >= 0 ? stripHtmlSummary(row[overviewIdx]) : "";
    const description = introText || overviewText || "";

    values.push(description);
    values.push(true);
    values.push(JSON.stringify(rawObj));
    return values;
  });

  const updateCols = colNames.filter((c) => c !== "wix_id");
  await executeUpsertBatches(tableName, "wix_id", colNames, colTypes, tuples, updateCols);
  await applySecurityAndPolicies(tableName, "public");
  return dataRows.length;
}

async function importGenericWixCsv(tableName, classification, headers, dataRows) {
  // 1. Auto-create base table if missing
  await runSql(`
    CREATE TABLE IF NOT EXISTS public.${sqlIdent(tableName)} (
      wix_id TEXT PRIMARY KEY,
      wix_created_date TEXT,
      wix_updated_date TEXT,
      wix_owner TEXT,
      raw_wix_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const reservedMap = {
    ID: "wix_id",
    "Created Date": "wix_created_date",
    "Created date": "wix_created_date",
    "Updated Date": "wix_updated_date",
    "Updated date": "wix_updated_date",
    Owner: "wix_owner",
  };

  const colMap = buildHeaderColumnMap(headers, reservedMap);
  const existingCols = await getExistingColumns(tableName);

  // 2. Dynamically add any missing columns from CSV headers
  const alterStmts = [];
  for (const entry of colMap) {
    if (!existingCols.has(entry.col)) {
      const colVals = dataRows.map((r) => r[entry.index]);
      const inferred = inferColumnType(entry.col, colVals);
      alterStmts.push(
        `ALTER TABLE public.${sqlIdent(tableName)} ADD COLUMN IF NOT EXISTS ${sqlIdent(entry.col)} ${inferred};`
      );
      existingCols.set(entry.col, { dataType: inferred.toLowerCase(), nullable: true });
    }
  }
  if (!existingCols.has("raw_wix_data")) {
    alterStmts.push(
      `ALTER TABLE public.${sqlIdent(tableName)} ADD COLUMN IF NOT EXISTS raw_wix_data JSONB NOT NULL DEFAULT '{}'::jsonb;`
    );
    existingCols.set("raw_wix_data", { dataType: "jsonb", nullable: false });
  }
  if (!existingCols.has("imported_at")) {
    alterStmts.push(
      `ALTER TABLE public.${sqlIdent(tableName)} ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ NOT NULL DEFAULT now();`
    );
    existingCols.set("imported_at", { dataType: "timestamptz", nullable: false });
  }
  if (alterStmts.length > 0) {
    await runSql(alterStmts.join("\n"));
  }

  // 3. Upsert all rows if any exist
  if (dataRows.length > 0) {
    const hasWixIdCol = colMap.some((c) => c.col === "wix_id");
    const colNames = [
      ...(hasWixIdCol ? [] : ["wix_id"]),
      ...colMap.map((c) => c.col),
      "raw_wix_data",
      "imported_at",
    ];
    const colTypes = colNames.map((c) => {
      if (c === "raw_wix_data") return "jsonb";
      if (c === "imported_at") return "timestamptz";
      return existingCols.get(c)?.dataType || "text";
    });

    const seenIds = new Set();
    const tuples = dataRows.map((row, rowIdx) => {
      const rawObj = {};
      headers.forEach((h, i) => {
        const val = row[i] ?? "";
        rawObj[h] =
          tableName === "ecmd_wix_code_and_blueprints" && val.length > 2000
            ? `${val.slice(0, 2000)}... [full text stored in dedicated column; ${val.length} chars]`
            : val;
      });

      const hashFallback = crypto
        .createHash("sha1")
        .update(`${tableName}:${rowIdx}:${JSON.stringify(rawObj)}`)
        .digest("hex")
        .slice(0, 20);

      const values = [];
      if (!hasWixIdCol) {
        values.push(`gen_${hashFallback}`);
      }
      for (const entry of colMap) {
        const raw = row[entry.index] ?? "";
        if (entry.col === "wix_id") {
          let idVal = String(raw).trim() || `gen_${hashFallback}`;
          if (seenIds.has(idVal)) idVal = `${idVal}_${rowIdx + 1}`;
          seenIds.add(idVal);
          values.push(idVal);
        } else {
          values.push(coerceValueForType(raw, existingCols.get(entry.col)?.dataType || "text"));
        }
      }
      values.push(JSON.stringify(rawObj));
      values.push(new Date().toISOString());
      return values;
    });

    const updateCols = colNames.filter((c) => c !== "wix_id");
    await executeUpsertBatches(tableName, "wix_id", colNames, colTypes, tuples, updateCols);
  }

  // 4. Enforce RLS & grants
  await applySecurityAndPolicies(tableName, classification);
  return dataRows.length;
}

async function main() {
  if (!fs.existsSync(CSV_DIR)) {
    throw new Error(`CSV directory not found: ${CSV_DIR}`);
  }

  const csvFiles = fs
    .readdirSync(CSV_DIR)
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  console.log(
    `[import-wix-csvs] Found ${csvFiles.length} CSV file(s) in ${CSV_DIR}${DRY_RUN ? " (DRY RUN)" : ""}`
  );

  const report = [];

  for (const filename of csvFiles) {
    const fullPath = path.join(CSV_DIR, filename);
    const content = fs.readFileSync(fullPath, "utf8");
    const parsedRows = parseCsv(content);
    const headers = parsedRows[0] || [];
    const dataRows = parsedRows.slice(1);
    const cfg = resolveCollectionConfig(filename);

    process.stdout.write(
      `  -> Importing ${filename} (${dataRows.length} rows, ${headers.length} cols) => public.${cfg.table} [${cfg.classification.toUpperCase()}]... `
    );

    let importedCount = 0;
    if (cfg.mode === "canonical_service_packages") {
      importedCount = await importCanonicalServicePackages(headers, dataRows);
    } else if (cfg.mode === "canonical_whats_included") {
      importedCount = await importCanonicalWhatsIncluded(headers, dataRows);
    } else {
      importedCount = await importGenericWixCsv(cfg.table, cfg.classification, headers, dataRows);
    }

    console.log(`OK (${importedCount} rows)`);
    report.push({
      csv: filename,
      table: `public.${cfg.table}`,
      rows: importedCount,
      cols: headers.length,
      classification:
        cfg.classification === "public"
          ? "Public Mirrored"
          : "RLS Private (Excluded from Mirror)",
    });
  }

  console.log("\n=== WIX CMS CSV IMPORT SUMMARY (26 COLLECTIONS) ===");
  console.log("| # | CSV File | Supabase Table | Rows | Cols | Security & Mirror Classification |");
  console.log("|---:|---|---|---:|---:|---|");
  report.forEach((r, idx) => {
    console.log(
      `| ${idx + 1} | ${r.csv} | ${r.table} | ${r.rows} | ${r.cols} | ${r.classification} |`
    );
  });

  const pubCount = report.filter((r) => r.classification === "Public Mirrored").length;
  const privCount = report.length - pubCount;
  const totalRows = report.reduce((s, r) => s + r.rows, 0);
  console.log(
    `\nTotal: ${report.length} CSVs processed | ${totalRows} rows imported | ${pubCount} Public Mirrored | ${privCount} RLS Private (Excluded from Mirror)`
  );
}

main().catch((err) => {
  console.error(`\n[import-wix-csvs] FAILED: ${err.message}`);
  process.exit(1);
});
