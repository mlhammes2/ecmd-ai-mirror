import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

for (const rel of ["src/routes/errors.tsx", "src/routes/workflow.tsx"]) {
  const full = path.join(cwd, rel);
  if (!fs.existsSync(full)) continue;
  let code = fs.readFileSync(full, "utf8");

  // Remove any leftover __psBoxNode snippet or duplicate <PsErrorsOnlyBox />
  code = code.replace(/^\s*\/\/\s*Render dedicated PowerShell Errors & Output box\s*\r?\n/gm, "");
  code = code.replace(/^\s*const __psBoxNode\s*=\s*\r?\n?\s*;\s*void __psBoxNode;\s*\r?\n?/gm, "");
  code = code.replace(/\s*<PsErrorsOnlyBox \/>\s*/g, "\n");

  if (!code.includes('from "../components/PsErrorsOnlyBox"')) {
    code = 'import { PsErrorsOnlyBox } from "../components/PsErrorsOnlyBox";\n' + code;
  }

  // Insert <PsErrorsOnlyBox /> right after the opening JSX tag of the main return block
  const retMatch = code.match(/return\s*\(\s*(?:<>|<div[^>]*>|<main[^>]*>|<section[^>]*>)/);
  if (retMatch && retMatch.index !== undefined) {
    const pos = retMatch.index + retMatch[0].length;
    code = code.slice(0, pos) + "\n      <PsErrorsOnlyBox />" + code.slice(pos);
  }

  fs.writeFileSync(full, code, "utf8");
  console.log("Repaired and mounted PsErrorsOnlyBox in " + rel);
}
