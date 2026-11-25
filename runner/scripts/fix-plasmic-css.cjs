const fs = require("fs");
const p = "C:\\ECMD\\emerald-coast-detailing-hub\\src\\plasmic-init.ts";
let src = fs.readFileSync(p, "utf8");

const ALLOWED = new Set([
  "width","height","minWidth","maxWidth","minHeight","maxHeight",
  "paddingTop","paddingRight","paddingBottom","paddingLeft",
  "marginTop","marginRight","marginBottom","marginLeft",
  "backgroundColor","color","fontSize","fontWeight","lineHeight","textAlign",
  "borderRadius","rowGap","columnGap","gap","alignItems","justifyContent","opacity"
]);

const removed = new Set();
src = src.replace(/\b(styles|defaultStyles)\s*:\s*\{([^{}]*)\}/g, (full, propName, body) => {
  const keptLines = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const m = rawLine.match(/^\s*([a-zA-Z0-9_]+)\s*:\s*(.+?)(,?)\s*$/);
    if (!m) {
      if (rawLine.trim()) keptLines.push(rawLine);
      continue;
    }
    const key = m[1];
    const val = m[2];
    if (!ALLOWED.has(key)) {
      removed.add(key);
      continue;
    }
    if ((key.startsWith("padding") || key.startsWith("margin")) && /\s/.test(val.replace(/["']/g, "").trim())) {
      removed.add(key + ":" + val);
      continue;
    }
    keptLines.push(rawLine);
  }
  return propName + ": {\n" + keptLines.join("\n") + "\n}";
});

fs.writeFileSync(p, src, "utf8");
console.log("Removed unsupported Plasmic CSS keys:", [...removed]);
