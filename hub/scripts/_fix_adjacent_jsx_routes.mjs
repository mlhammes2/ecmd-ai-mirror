import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

for (const rel of ["src/routes/errors.tsx", "src/routes/workflow.tsx"]) {
  const full = path.join(cwd, rel);
  if (!fs.existsSync(full)) continue;
  let code = fs.readFileSync(full, "utf8");

  // Fix adjacent <EcmdPowerShellResultsCard /> and #ecmd-header-copy-errors-btn placed at top level
  code = code.replace(
    /<EcmdPowerShellResultsCard \/>\s*<button id="ecmd-header-copy-errors-btn"[^>]*>Copy Errors<\/button>/g,
    (btnMatch) => {
      const onlyBtn = btnMatch.replace("<EcmdPowerShellResultsCard />", "").trim();
      return `<>\n      <EcmdPowerShellResultsCard />\n      ${onlyBtn}\n    </>`;
    }
  );

  // Also ensure no bare <button id="ecmd-header-copy-errors-btn" sits without a wrapper if paired with another top-level node
  const lines = code.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('id="ecmd-header-copy-errors-btn"')) {
      const prev = i > 0 ? lines[i - 1].trim() : "";
      const next = i + 1 < lines.length ? lines[i + 1].trim() : "";
      if (prev.startsWith("<") && !prev.startsWith("</") && !prev.startsWith("<>") && next.startsWith("<") && !next.startsWith("</")) {
        lines[i - 1] = "<>\n" + lines[i - 1];
        lines[i] = lines[i] + "\n</>";
      }
    }
  }

  fs.writeFileSync(full, lines.join("\n"), "utf8");
  console.log("Repaired JSX wrapper in " + rel);
}
