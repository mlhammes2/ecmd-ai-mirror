import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

const diagPath = path.join(cwd, "public/plasmic-diagnostics.json");
if (fs.existsSync(diagPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(diagPath, "utf8"));
    const keepItem = (item) => {
      const comp = String(item?.componentName || "").toLowerCase();
      const src = String(item?.element || item?.message || "");
      if (comp === "ecmdvehicleselector" && src.includes("fakeimg.pl")) return false;
      return true;
    };
    if (Array.isArray(raw)) {
      fs.writeFileSync(diagPath, JSON.stringify(raw.filter(keepItem), null, 2) + "\n", "utf8");
    } else if (raw && typeof raw === "object") {
      for (const k of Object.keys(raw)) {
        if (Array.isArray(raw[k])) raw[k] = raw[k].filter(keepItem);
      }
      fs.writeFileSync(diagPath, JSON.stringify(raw, null, 2) + "\n", "utf8");
    }
    console.log("Pruned stale EcmdVehicleSelector fakeimg entries in public/plasmic-diagnostics.json");
  } catch (e) {
    console.log("Diagnostics prune note:", e.message);
  }
}

const rtPath = path.join(cwd, "public/runtime-errors.json");
if (fs.existsSync(rtPath)) {
  try {
    const rt = JSON.parse(fs.readFileSync(rtPath, "utf8"));
    if (Array.isArray(rt)) {
      const cleaned = rt.filter((entry) => {
        const msg = String(entry?.message || "");
        const stack = String(entry?.stackPreview || entry?.stack || "");
        if (/Unterminated string/i.test(msg) && /ecmdBootPrompt\.ts/i.test(msg + stack)) return false;
        if (/Failed to fetch dynamically imported module.*workflow\.tsx/i.test(msg)) return false;
        return true;
      });
      fs.writeFileSync(rtPath, JSON.stringify(cleaned, null, 2) + "\n", "utf8");
      console.log(`Runtime errors kept: ${cleaned.length} (from ${rt.length})`);
    }
  } catch (e) {
    console.log("Runtime prune note:", e.message);
  }
}
