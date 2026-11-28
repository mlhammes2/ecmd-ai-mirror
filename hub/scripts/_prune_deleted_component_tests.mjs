import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

function removeItBlocksMatching(filePath, patterns) {
  const full = path.join(cwd, filePath);
  if (!fs.existsSync(full)) return;
  let txt = fs.readFileSync(full, "utf8");
  for (const pat of patterns) {
    const idx = txt.indexOf(pat);
    if (idx === -1) continue;
    const itStart = txt.lastIndexOf("it(", idx);
    if (itStart === -1) continue;
    // Find matching closing `});` for `it(...)`
    let depth = 0;
    let i = itStart + 2;
    let foundOpen = false;
    for (; i < txt.length; i++) {
      const ch = txt[i];
      if (ch === "(") {
        depth++;
        foundOpen = true;
      } else if (ch === ")") {
        depth--;
        if (foundOpen && depth === 0) {
          if (txt[i + 1] === ";") i++;
          if (txt[i + 1] === "\r") i++;
          if (txt[i + 1] === "\n") i++;
          break;
        }
      }
    }
    txt = txt.slice(0, itStart) + txt.slice(i + 1);
  }
  fs.writeFileSync(full, txt, "utf8");
}

removeItBlocksMatching("src/test/ecmd-telemetry-breakpoint.test.tsx", [
  "EcmdPackagesRepeater & EcmdVehicleSelector apply Tablet & Mobile breakpoint overrides"
]);

removeItBlocksMatching("src/test/packages-matrix-engine.test.tsx", [
  "resolveSteelButtonRoleAttrs",
  "stamps role hooks for every buttonRole choice"
]);

removeItBlocksMatching("src/test/packages-repeater.test.tsx", [
  "EcmdVehicleSelector renders 4 slots and dispatches event on click",
  "keeps per-card slot wrapper transparent"
]);

removeItBlocksMatching("src/test/plasmic-controllers.test.tsx", [
  "EcmdVehicleSelector wrapped via registerEcmdComponent forwards Plasmic className"
]);

// Remove hardcoded expectation that deleted HqWeeklyStrip / EcmdBrushedSteelButton are still registered
const initStyleTest = path.join(cwd, "src/test/plasmic-init-styles.test.ts");
if (fs.existsSync(initStyleTest)) {
  let s = fs.readFileSync(initStyleTest, "utf8");
  s = s.replace(
    /for\s*\(\s*const\s+expected\s+of\s*\[[\s\S]*?\]\s*\)\s*\{\s*expect\(names\)\.toContain\(expected\);\s*\}/g,
    "// Removed component registration check skipped after deleting legacy components"
  );
  fs.writeFileSync(initStyleTest, s, "utf8");
}

console.log("Pruned obsolete test blocks for deleted components.");
