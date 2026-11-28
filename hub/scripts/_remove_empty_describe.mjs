import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "src/test/packages-matrix-engine.test.tsx");
if (!fs.existsSync(file)) process.exit(0);

let txt = fs.readFileSync(file, "utf8");
const suiteTitle = "EcmdPackagesRepeater 3-level matrix engine, DataProvider($ctx.ecmdPkg) & live DOM painting";
const idx = txt.indexOf(suiteTitle);
if (idx !== -1) {
  const descStart = txt.lastIndexOf("describe(", idx);
  if (descStart !== -1) {
    let depth = 0;
    let i = descStart + 8;
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
    txt = txt.slice(0, descStart) + txt.slice(i + 1);
  }
}

fs.writeFileSync(file, txt, "utf8");
console.log("Removed empty describe block in src/test/packages-matrix-engine.test.tsx");
