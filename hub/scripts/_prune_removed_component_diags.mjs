import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const removedNames = [
  "ecmdbrushedsteelbutton",
  "ecmdcartsummarybar",
  "hqdailydispatchboard",
  "hqinvoicecard",
  "hqmultistateworkspace",
  "hqweeklystrip",
  "ecmdsavedvehicledropdown",
  "ecmdthemelogo",
  "ecmdvehicleselector",
  "ecmdwhatsincludedmodal",
  "ecmdwhatsincludeditempopup"
];

const diagFile = path.join(cwd, "public/plasmic-diagnostics.json");
if (fs.existsSync(diagFile)) {
  try {
    const raw = JSON.parse(fs.readFileSync(diagFile, "utf8"));
    const filterList = (arr) =>
      Array.isArray(arr)
        ? arr.filter((item) => !removedNames.includes(String(item?.componentName || "").toLowerCase()))
        : arr;

    if (Array.isArray(raw)) {
      fs.writeFileSync(diagFile, JSON.stringify(filterList(raw), null, 2) + "\n", "utf8");
    } else if (raw && typeof raw === "object") {
      for (const k of Object.keys(raw)) {
        if (Array.isArray(raw[k])) raw[k] = filterList(raw[k]);
      }
      fs.writeFileSync(diagFile, JSON.stringify(raw, null, 2) + "\n", "utf8");
    }
    console.log("Pruned removed component entries from public/plasmic-diagnostics.json");
  } catch (e) {
    console.log("Could not parse public/plasmic-diagnostics.json:", e.message);
  }
}
