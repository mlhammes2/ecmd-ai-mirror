import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const rootFile = path.join(cwd, "src/routes/__root.tsx");

if (!fs.existsSync(rootFile)) {
  console.log("src/routes/__root.tsx not found");
  process.exit(0);
}

let code = fs.readFileSync(rootFile, "utf8");

// Clean any prior misplaced <PsErrorsOnlyBox /> blocks we added earlier
code = code.replace(/^\s*\{[^}]*PsErrorsOnlyBox[^}]*\}\s*\r?\n?/gm, "");
code = code.replace(/^\s*<PsErrorsOnlyBox \/>\s*\r?\n?/gm, "");

if (!code.includes('from "../components/PsErrorsOnlyBox"')) {
  code = 'import { PsErrorsOnlyBox } from "../components/PsErrorsOnlyBox";\n' + code;
}

const conditionalBox = `{typeof window !== "undefined" && (window.location.pathname.startsWith("/errors") || window.location.pathname.startsWith("/workflow")) && <PsErrorsOnlyBox />}`;

// Insert right after the first opening JSX tag inside `return (`
const retMatch = code.match(/return\s*\(\s*(?:<>|<div[^>]*>|<main[^>]*>|<section[^>]*>)/);
if (retMatch && retMatch.index !== undefined) {
  const pos = retMatch.index + retMatch[0].length;
  code = code.slice(0, pos) + "\n      " + conditionalBox + code.slice(pos);
}

fs.writeFileSync(rootFile, code, "utf8");
console.log("Mounted conditional PsErrorsOnlyBox in src/routes/__root.tsx");
