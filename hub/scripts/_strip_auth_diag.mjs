import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const diagFile = path.join(cwd, "public/plasmic-diagnostics.json");

if (!fs.existsSync(diagFile)) {
  console.log("public/plasmic-diagnostics.json not found");
  process.exit(0);
}

const raw = JSON.parse(fs.readFileSync(diagFile, "utf8"));
let removedCount = 0;

function pruneArr(arr) {
  return arr.filter((item) => {
    const comp = String(item?.componentName || "").toLowerCase();
    const id = String(item?.id || "").toLowerCase();
    const match = comp === "ecmdauthmodalcontroller" || id.startsWith("ecmdauthmodalcontroller::");
    if (match) removedCount++;
    return !match;
  });
}

if (Array.isArray(raw)) {
  fs.writeFileSync(diagFile, JSON.stringify(pruneArr(raw), null, 2) + "\n", "utf8");
} else if (raw && typeof raw === "object") {
  for (const k of Object.keys(raw)) {
    if (Array.isArray(raw[k])) {
      raw[k] = pruneArr(raw[k]);
    }
  }
  fs.writeFileSync(diagFile, JSON.stringify(raw, null, 2) + "\n", "utf8");
}

console.log(`Removed ${removedCount} EcmdAuthModalController diagnostic entry/entries.`);
