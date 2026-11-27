import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

const removedSymbols = [
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
];

// 1. Clean src/components/booking-hq/index.ts
const hqIndex = path.join(cwd, "src/components/booking-hq/index.ts");
if (fs.existsSync(hqIndex)) {
  const lines = fs
    .readFileSync(hqIndex, "utf8")
    .split(/\r?\n/)
    .filter((l) => !removedSymbols.some((s) => l.includes(s)));
  fs.writeFileSync(hqIndex, lines.join("\n").trimEnd() + "\n", "utf8");
  console.log("Cleaned src/components/booking-hq/index.ts");
}

// 2. Clean src/plasmic-init.ts imports and registerEcmdComponent / registerComponent calls for removed symbols
const initPath = path.join(cwd, "src/plasmic-init.ts");
if (fs.existsSync(initPath)) {
  let code = fs.readFileSync(initPath, "utf8");

  // Remove standalone import lines mentioning any removed symbol
  code = code
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t.startsWith("import ")) return true;
      return !removedSymbols.some((sym) => new RegExp(`\\b${sym}\\b`).test(t));
    })
    .join("\n");

  // Remove any registerEcmdComponent(RemovedSym, { ... }); or registerComponent(RemovedSym, { ... }); block
  for (const sym of removedSymbols) {
    // Match from `registerEcmdComponent(Sym,` or `registerComponent(Sym,` up to the matching closing `);`
    let idx = code.indexOf(`(${sym},`);
    if (idx === -1) idx = code.indexOf(`(${sym} ,`);
    while (idx !== -1) {
      const stmtStart = Math.max(
        code.lastIndexOf("registerEcmdComponent", idx),
        code.lastIndexOf("registerComponent", idx)
      );
      if (stmtStart === -1) break;
      let depth = 0;
      let i = stmtStart;
      let foundOpen = false;
      for (; i < code.length; i++) {
        const ch = code[i];
        if (ch === "(") {
          depth++;
          foundOpen = true;
        } else if (ch === ")") {
          depth--;
          if (foundOpen && depth === 0) {
            i++;
            if (code[i] === ";") i++;
            if (code[i] === "\r") i++;
            if (code[i] === "\n") i++;
            break;
          }
        }
      }
      code = code.slice(0, stmtStart) + code.slice(i);
      idx = code.indexOf(`(${sym},`);
      if (idx === -1) idx = code.indexOf(`(${sym} ,`);
    }
  }

  fs.writeFileSync(initPath, code, "utf8");
  console.log("Cleaned removed component registrations from src/plasmic-init.ts");
}

// 3. Remove or neutralize broken imports in the 4 test files
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
  const hadRemovedImport = removedSymbols.some((sym) => txt.includes(sym));
  if (hadRemovedImport) {
    // Comment out import statements that pull from removed component files
    txt = txt.replace(
      /import\s+[\s\S]*?from\s+["']\.\.\/components\/(?:EcmdVehicleSelector|EcmdBrushedSteelButton|EcmdCartSummaryBar|EcmdSavedVehicleDropdown|EcmdThemeLogo|EcmdWhatsIncludedModal|EcmdWhatsIncludedItemPopup)["'];?\r?\n?/g,
      (m) => "// removed component import: " + m.replace(/\r?\n/g, " ") + "\n"
    );
    fs.writeFileSync(full, txt, "utf8");
    console.log("Updated imports in " + rel);
  }
}
