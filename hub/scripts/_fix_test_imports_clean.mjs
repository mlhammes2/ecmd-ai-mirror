import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

const removedSet = new Set([
  "HqWeeklyStrip",
  "HqDailyDispatchBoard",
  "HqInvoiceCard",
  "HqMultiStateWorkspace",
  "EcmdThemeLogo",
  "EcmdVehicleSelector",
  "EcmdSavedVehicleDropdown",
  "EcmdBrushedSteelButton",
  "EcmdWhatsIncludedModal",
  "EcmdWhatsIncludedItemPopup",
  "EcmdCartSummaryBar"
]);

const testFiles = [
  "src/test/ecmd-telemetry-breakpoint.test.tsx",
  "src/test/packages-matrix-engine.test.tsx",
  "src/test/packages-repeater.test.tsx",
  "src/test/plasmic-controllers.test.tsx"
];

for (const rel of testFiles) {
  const full = path.join(cwd, rel);
  if (!fs.existsSync(full)) continue;
  let txt = fs.readFileSync(full, "utf8");

  // Uncomment lines we previously commented out so we can filter individual identifiers cleanly
  txt = txt.replace(/^\/\/ removed component import: /gm, "");

  // Filter removed symbols out of named import braces `{ A, B, C }`
  txt = txt.replace(/import\s*\{([\s\S]*?)\}\s*from\s*(["'][^"']+["']);?/g, (match, inner, fromPart) => {
    const items = inner
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((item) => {
        const baseName = item.split(/\s+as\s+/i)[0].trim();
        return !removedSet.has(baseName);
      });
    if (items.length === 0) return "";
    return `import { ${items.join(", ")} } from ${fromPart};`;
  });

  // Remove any remaining standalone `import RemovedSym from ...`
  for (const sym of removedSet) {
    txt = txt.replace(new RegExp(`^import\\s+${sym}\\s+from\\s+["'][^"']+["'];?\\r?\\n?`, "gm"), "");
  }

  fs.writeFileSync(full, txt, "utf8");
  console.log("Cleaned imports in " + rel);
}
