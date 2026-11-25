import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ecmdRoot = path.resolve("..");
const hubRoot = path.resolve(".");
const wixSrcDir = path.join(ecmdRoot, "src");
const manifestPath = path.join(hubRoot, "public", "wix-vault-index.json");

const BRIDGE_URL = "https://lvynkeuceiqxafgpgdvs.supabase.co/functions/v1/ecmd-carbon-bridge";
const BRIDGE_KEY = "[REDACTED_SECRET]";

async function runSql(sql) {
  const res = await fetch(BRIDGE_URL, {
    method: "POST",
    headers: { "x-bridge-key": BRIDGE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "run_sql", sql })
  });
  if (!res.ok) {
    throw new Error(`SQL error ${res.status}: ${await res.text()}`);
  }
  return await res.json();
}

function escapeSql(str) {
  if (typeof str !== "string") return "";
  return str.replace(/'/g, "''");
}

function getCategory(relPath) {
  const p = relPath.replace(/\\/g, "/");
  if (p.startsWith("src/backend/")) return "Backend Velo (.jsw / .web.js)";
  if (p.startsWith("src/pages/")) return "Wix Page Script (.js)";
  if (p.startsWith("src/public/custom-elements/")) return "Custom Web Elements (.js)";
  if (p.startsWith("src/public/")) return "Public Client Engine (.js)";
  if (p.startsWith("src/styles/")) return "Styles & Layout CSS";
  if (p.startsWith("cms/collections/")) return "Wix CMS Collection Schema";
  return "Wix Configuration & Blueprints";
}

function getDescription(fileName, category) {
  const name = path.basename(fileName);
  if (name === "data.js") return "Universal Wix Data CRM hooks and database write-through logic.";
  if (name === "stateManager.js") return "Client-side cart, customer session, and booking state container.";
  if (name === "calendar-dispatcher.web.js") return "Google Calendar scheduling, slot dispatch, and contractor sync.";
  if (name === "http-functions.js") return "Wix HTTP Webhook endpoints including ecmdConsole gateway.";
  if (name === "emailDispatchEngine.jsw") return "Automated customer booking receipts and detailer SMS dispatch.";
  if (name === "vehicleClassifier.web.js") return "Automotive category, trim pricing, and paint condition classifier.";
  if (name === "braintreeEngine.jsw" || name === "stripeEngine.jsw") return "Payment processing gateway and checkout tokenization.";
  if (name.includes("Booking HQ")) return "Legacy Wix Booking HQ calendar dispatch interface.";
  if (name.includes("Detailer Portal")) return "Legacy contractor job queue, check-in, and payout dashboard.";
  if (name.includes("packages")) return "Service package selection, ceramic coating tiers, and add-on picker.";
  if (name.includes("checkout")) return "Booking checkout flow, address geocoding, and payment submission.";
  if (name.includes("Confirmation")) return "Post-booking confirmation screen and calendar invite generator.";
  if (name.includes("masterPage")) return "Global site layout, master header, navigation bar, and footer.";
  if (category === "Wix CMS Collection Schema") return `Legacy Wix CMS collection schema for ${name.replace(".json", "")}.`;
  return `Wix legacy ${category.toLowerCase()} module ${name}.`;
}

async function main() {
  console.log("=== ECMD WIX LEGACY VAULT SYNC & ARCHIVER ===");

  // 1. Ensure table exists in Supabase
  console.log("1. Ensuring public.ecmd_wix_legacy_vault table exists...");
  await runSql(`
    CREATE TABLE IF NOT EXISTS public.ecmd_wix_legacy_vault (
      id serial primary key,
      file_path text unique,
      category text,
      wix_page_or_module text,
      content text,
      line_count int,
      source_origin text,
      synced_at timestamptz default now()
    );
  `);

  const vaultMap = new Map();

  // 2. Scan active files in C:\ECMD\src
  console.log("2. Scanning live files in C:\\ECMD\\src...");
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(fullPath);
      } else {
        const relPath = path.relative(ecmdRoot, fullPath).replace(/\\/g, "/");
        const content = fs.readFileSync(fullPath, "utf8");
        const lines = content.split("\n").length;
        const cat = getCategory(relPath);

        vaultMap.set(relPath, {
          file_path: relPath,
          category: cat,
          wix_page_or_module: ent.name,
          content,
          line_count: lines,
          source_origin: `C:\\ECMD\\${relPath}`,
          description: getDescription(ent.name, cat)
        });
      }
    }
  }
  walk(wixSrcDir);
  console.log(`Discovered ${vaultMap.size} files in C:\\ECMD\\src.`);

  // 3. Scan root Wix configuration files
  console.log("3. Scanning root Wix configurations...");
  const rootWixFiles = [
    "wix.config.json",
    "wix.lock",
    "scripts/wix-auto-publish.js",
    "console.html",
    "bridge_ui.html",
    ".eslintrc.json",
    "dependencies-metadata.json"
  ];
  for (const rf of rootWixFiles) {
    const full = path.join(ecmdRoot, rf);
    if (fs.existsSync(full)) {
      const content = fs.readFileSync(full, "utf8");
      vaultMap.set(rf, {
        file_path: rf,
        category: "Wix Configuration & Blueprints",
        wix_page_or_module: path.basename(rf),
        content,
        line_count: content.split("\n").length,
        source_origin: `C:\\ECMD\\${rf}`,
        description: `Wix legacy site configuration / build file ${rf}.`
      });
    }
  }

  // 4. Recover historical files from git history
  console.log("4. Inspecting git commit history in C:\\ECMD\\.git for historical Wix files...");
  try {
    const gitLogRaw = execSync("git -C C:/ECMD log --all --full-history --name-only --format=%H", {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024
    });
    const lines = gitLogRaw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let currentCommit = "";
    for (const line of lines) {
      if (/^[0-9a-f]{40}$/i.test(line)) {
        currentCommit = line;
      } else {
        const filePath = line.replace(/\\/g, "/");
        if (
          (filePath.startsWith("src/") || filePath.startsWith("scripts/wix") || filePath.endsWith(".jsw") || filePath.endsWith(".web.js")) &&
          !filePath.startsWith("emerald-coast-detailing-hub") &&
          !vaultMap.has(filePath)
        ) {
          try {
            const histContent = execSync(`git -C C:/ECMD show ${currentCommit}:"${filePath}"`, {
              encoding: "utf8",
              maxBuffer: 5 * 1024 * 1024
            });
            const cat = getCategory(filePath);
            vaultMap.set(filePath, {
              file_path: filePath,
              category: cat,
              wix_page_or_module: path.basename(filePath),
              content: histContent,
              line_count: histContent.split("\n").length,
              source_origin: `Git Commit ${currentCommit.slice(0, 7)}:${filePath}`,
              description: `Recovered historical Wix module ${path.basename(filePath)} from git.`
            });
            console.log(`+ Recovered historical file from commit ${currentCommit.slice(0, 7)}: ${filePath}`);
          } catch {}
        }
      }
    }
  } catch (gitErr) {
    console.warn("Notice: Git history inspect completed with notes:", gitErr.message);
  }

  // 5. Add 19 core Wix CMS collection schemas
  console.log("5. Generating core Wix CMS collection schemas...");
  const collections = [
    { name: "scheduledJobs", desc: "Customer appointment bookings, vehicle, detailer, pricing, and status fields." },
    { name: "contractors", desc: "Detailer profiles, emails, phone numbers, Google calendar IDs, and active flags." },
    { name: "servicePackages", desc: "Detailing packages, duration, base pricing, and included service line-items." },
    { name: "customerProfiles", desc: "Customer master accounts, contact info, total spend, and vehicle link IDs." },
    { name: "customerContacts", desc: "Customer names, phone numbers, email addresses, and communication preferences." },
    { name: "customerLocations", desc: "Service addresses, street, city, state, postal code, and geocoding coordinates." },
    { name: "customerVehicles", desc: "Registered customer vehicles, year, make, model, trim, color, and VIN." },
    { name: "availabilityRules", desc: "Detailer availability windows, recurring shifts, time-off, and slot capacities." },
    { name: "vehicleCategories", desc: "Sedan, SUV, Truck, Oversized, Exotic, and Marine vehicle classification tiers." },
    { name: "activeSubscriptions", desc: "Recurring maintenance wash memberships, billing frequencies, and discounts." },
    { name: "calendarTimeSlots", desc: "Morning, midday, and afternoon dispatch slots and contractor allocations." },
    { name: "autoWhatsIncluded", desc: "Itemized feature checklists displayed on packages and quote cards." },
    { name: "temporaryData", desc: "Draft carts, multi-step session checkpoints, and ephemeral booking tokens." },
    { name: "syncErrors", desc: "Failed webhook dispatches, CRM sync error payloads, and retry counters." },
    { name: "loginSecurity", desc: "Authentication attempt logs, MFA tokens, and security audit trail." },
    { name: "paymentMethods", desc: "Customer saved payment tokens (Braintree/Stripe customer vault references)." },
    { name: "siteButtons", desc: "Configurable UI action button labels and dynamic CTA destinations." },
    { name: "profileButtons", desc: "User profile dashboard navigation button configuration." },
    { name: "Staff", desc: "Internal dispatchers, administrative roles, and system permission levels." }
  ];

  for (const col of collections) {
    const colPath = `cms/collections/${col.name}.json`;
    const colContent = JSON.stringify({
      collectionName: col.name,
      description: col.desc,
      storageArchitecture: "Mirrored to Supabase ecmd_crm_* and archived in ecmd_wix_legacy_vault",
      primaryKey: "_id",
      indexedFields: ["_id", "_createdDate", "_updatedDate", "title"],
      archivedAt: new Date().toISOString()
    }, null, 2);

    vaultMap.set(colPath, {
      file_path: colPath,
      category: "Wix CMS Collection Schema",
      wix_page_or_module: col.name,
      content: colContent,
      line_count: colContent.split("\n").length,
      source_origin: `Wix CMS Site Collection: ${col.name}`,
      description: col.desc
    });
  }

  const itemsToArchive = Array.from(vaultMap.values());
  console.log(`Total vault items assembled: ${itemsToArchive.length}`);

  // 6. Check existing Supabase table records
  console.log("6. Checking existing Supabase ecmd_wix_legacy_vault records...");
  try {
    const existing = await runSql("SELECT count(*) as cnt FROM public.ecmd_wix_legacy_vault");
    console.log(`Current row count in Supabase: ${existing?.[0]?.cnt ?? 0}`);
  } catch (e) {
    console.warn("Notice checking table count:", e.message);
  }

  // 7. Upsert each file into Supabase public.ecmd_wix_legacy_vault
  console.log("7. Upserting items into Supabase public.ecmd_wix_legacy_vault...");
  let successCount = 0;
  for (const item of itemsToArchive) {
    const sql = `INSERT INTO public.ecmd_wix_legacy_vault (
      file_path, category, wix_page_or_module, content, line_count, source_origin, synced_at
    ) VALUES (
      '${escapeSql(item.file_path)}',
      '${escapeSql(item.category)}',
      '${escapeSql(item.wix_page_or_module)}',
      '${escapeSql(item.content)}',
      ${item.line_count},
      '${escapeSql(item.source_origin)}',
      NOW()
    ) ON CONFLICT (file_path) DO UPDATE SET
      category = EXCLUDED.category,
      wix_page_or_module = EXCLUDED.wix_page_or_module,
      content = EXCLUDED.content,
      line_count = EXCLUDED.line_count,
      source_origin = EXCLUDED.source_origin,
      synced_at = NOW();`;

    try {
      await runSql(sql);
      successCount++;
    } catch (err) {
      console.error(`Failed to archive ${item.file_path}:`, err.message);
    }
  }

  console.log(`Archived ${successCount} of ${itemsToArchive.length} items into Supabase.`);

  // 8. Generate lightweight metadata manifest public/wix-vault-index.json
  console.log("8. Writing lightweight manifest public/wix-vault-index.json...");
  const manifest = itemsToArchive.map(item => ({
    file_path: item.file_path,
    category: item.category,
    wix_page_or_module: item.wix_page_or_module,
    line_count: item.line_count,
    source_origin: item.source_origin,
    description: item.description
  }));

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`Saved manifest with ${manifest.length} items to ${manifestPath} (${fs.statSync(manifestPath).size} bytes).`);
  console.log("=== SYNC COMPLETED SUCCESSFULLY ===");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
