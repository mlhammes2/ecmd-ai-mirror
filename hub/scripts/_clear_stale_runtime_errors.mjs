import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const candidates = [
  path.join(cwd, "public/runtime-errors.json"),
  path.join(cwd, ".ecmd-runtime-errors.json"),
  path.join(cwd, "runtime-errors.json")
];

let clearedFiles = 0;
for (const file of candidates) {
  if (fs.existsSync(file)) {
    fs.writeFileSync(file, "[]\n", "utf8");
    clearedFiles++;
  }
}

console.log("Cleared local runtime error files:", clearedFiles);
