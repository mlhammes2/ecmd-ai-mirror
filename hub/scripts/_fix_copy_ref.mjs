import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

for (const rel of ["src/routes/__root.tsx", "src/routes/errors.tsx"]) {
  const full = path.join(cwd, rel);
  if (!fs.existsSync(full)) continue;
  let code = fs.readFileSync(full, "utf8");

  code = code.replace(/\bcopyLatestPsOutput\b/g, "copyPowerShellErrorsText");
  if (code.includes("copyPowerShellErrorsText") && !code.includes('from "../components/PsOnlyOutputPanel"')) {
    code = 'import { PsOnlyOutputPanel, copyPowerShellErrorsText } from "../components/PsOnlyOutputPanel";\n' + code;
  }

  fs.writeFileSync(full, code, "utf8");
  console.log("Updated " + rel);
}
