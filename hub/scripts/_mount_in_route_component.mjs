import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

for (const rel of ["src/routes/errors.tsx", "src/routes/workflow.tsx"]) {
  const full = path.join(cwd, rel);
  if (!fs.existsSync(full)) continue;
  let code = fs.readFileSync(full, "utf8");

  // Remove any earlier misplaced `<PsErrorsOnlyBox />` tags so we place it once in the right spot
  code = code.replace(/\s*<PsErrorsOnlyBox \/>\s*/g, "\n");

  if (!code.includes('from "../components/PsErrorsOnlyBox"')) {
    code = 'import { PsErrorsOnlyBox } from "../components/PsErrorsOnlyBox";\n' + code;
  }

  // Target the `component:` handler inside `createFileRoute(...)({ ... component: (...) => { ... return ( <Tag> ... ) } })`
  // or `function ErrorsPage() { ... return ( <Tag> ... ) }`
  const compIdx = code.indexOf("component:");
  let inserted = false;

  if (compIdx !== -1) {
    const sub = code.slice(compIdx);
    const retMatch = sub.match(/return\s*\(\s*(?:<>|<div[^>]*>|<main[^>]*>|<section[^>]*>)/);
    if (retMatch && retMatch.index !== undefined) {
      const pos = compIdx + retMatch.index + retMatch[0].length;
      code = code.slice(0, pos) + "\n      <PsErrorsOnlyBox />" + code.slice(pos);
      inserted = true;
    }
  }

  if (!inserted) {
    const anyRet = code.match(/return\s*\(\s*(?:<>|<div[^>]*>|<main[^>]*>|<section[^>]*>)/);
    if (anyRet && anyRet.index !== undefined) {
      const pos = anyRet.index + anyRet[0].length;
      code = code.slice(0, pos) + "\n      <PsErrorsOnlyBox />" + code.slice(pos);
    }
  }

  fs.writeFileSync(full, code, "utf8");
  console.log("Mounted PsErrorsOnlyBox inside route component of " + rel);
}
