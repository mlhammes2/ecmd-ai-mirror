import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

const targets = [
  {
    symbol: "EcmdBrushedSteelButton",
    files: [
      "src/components/EcmdBrushedSteelButton.tsx",
      "src/styles/brushedSteelButton.css",
      "src/test/brushed-steel-button.test.tsx"
    ]
  },
  {
    symbol: "EcmdCartSummaryBar",
    files: [
      "src/components/EcmdCartSummaryBar.tsx",
      "src/test/ecmd-cart-summary-bar.test.tsx"
    ]
  },
  {
    symbol: "HqDailyDispatchBoard",
    files: [
      "src/components/booking-hq/HqDailyDispatchBoard.tsx",
      "src/components/HqDailyDispatchBoard.tsx"
    ]
  },
  {
    symbol: "HqInvoiceCard",
    files: [
      "src/components/booking-hq/HqInvoiceCard.tsx",
      "src/components/HqInvoiceCard.tsx"
    ]
  },
  {
    symbol: "HqMultiStateWorkspace",
    files: [
      "src/components/booking-hq/HqMultiStateWorkspace.tsx",
      "src/components/HqMultiStateWorkspace.tsx"
    ]
  },
  {
    symbol: "HqWeeklyStrip",
    files: [
      "src/components/booking-hq/HqWeeklyStrip.tsx",
      "src/components/HqWeeklyStrip.tsx"
    ]
  },
  {
    symbol: "EcmdSavedVehicleDropdown",
    files: [
      "src/components/EcmdSavedVehicleDropdown.tsx",
      "src/test/saved-vehicle-dropdown.test.tsx"
    ]
  },
  {
    symbol: "EcmdThemeLogo",
    files: [
      "src/components/EcmdThemeLogo.tsx"
    ]
  },
  {
    symbol: "EcmdVehicleSelector",
    files: [
      "src/components/EcmdVehicleSelector.tsx"
    ]
  },
  {
    symbol: "EcmdWhatsIncludedModal",
    files: [
      "src/components/EcmdWhatsIncludedModal.tsx",
      "src/test/whats-included-modal.test.tsx"
    ]
  },
  {
    symbol: "EcmdWhatsIncludedItemPopup",
    files: [
      "src/components/EcmdWhatsIncludedItemPopup.tsx",
      "src/test/EcmdWhatsIncludedItemPopup.test.tsx"
    ]
  }
];

const deletedFiles = [];
for (const item of targets) {
  for (const rel of item.files) {
    const full = path.join(cwd, rel);
    if (fs.existsSync(full)) {
      fs.rmSync(full, { force: true });
      deletedFiles.push(rel);
    }
  }
}

// Cleanly unregister matching symbols from src/plasmic-init.ts
const initPath = path.join(cwd, "src/plasmic-init.ts");
let initUpdated = false;
if (fs.existsSync(initPath)) {
  let initCode = fs.readFileSync(initPath, "utf8");
  const symbols = targets.map((t) => t.symbol);

  // Remove import lines referencing any removed symbol/file
  const lines = initCode.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("import ")) return true;
    return !symbols.some((sym) => trimmed.includes(sym));
  });
  initCode = lines.join("\n");

  // Remove registerEcmdComponent(...) or registerComponent(...) blocks for removed symbols
  for (const sym of symbols) {
    const blockRegex = new RegExp(
      `(?:registerEcmdComponent|registerComponent)\\s*\\(\\s*${sym}[\\s\\S]*?\\n\\s*\\)\\s*;?\\r?\\n?`,
      "g"
    );
    const before = initCode;
    initCode = initCode.replace(blockRegex, "");
    if (initCode !== before) initUpdated = true;
  }

  fs.writeFileSync(initPath, initCode, "utf8");
}

console.log(JSON.stringify({ deletedFiles, initUpdated }, null, 2));
