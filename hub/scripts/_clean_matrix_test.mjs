import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), "src/test/packages-matrix-engine.test.tsx");
if (!fs.existsSync(file)) process.exit(0);

let txt = fs.readFileSync(file, "utf8");

// Remove invalid `label` and `buttonRole` attributes on <button ... />
txt = txt.replace(/\s+label="[^"]*"/g, "");
txt = txt.replace(/\s+buttonRole="[^"]*"/g, "");

// Remove the test block that specifically asserts deleted EcmdBrushedSteelButton selected state attributes
const marker = "syncs steel button glow, and live-paints DOM in place";
const idx = txt.indexOf(marker);
if (idx !== -1) {
  const itStart = txt.lastIndexOf("it(", idx);
  if (itStart !== -1) {
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
}

fs.writeFileSync(file, txt, "utf8");
console.log("Cleaned src/test/packages-matrix-engine.test.tsx");
