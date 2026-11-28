import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

// Clean single-line EcmdBrushedSteelButton import in packages-matrix-engine.test.tsx
const matrixTest = path.join(cwd, "src/test/packages-matrix-engine.test.tsx");
if (fs.existsSync(matrixTest)) {
  let t = fs.readFileSync(matrixTest, "utf8");
  t = t.replace(/import\s*\{\s*resolveSteelButtonRoleAttrs\s*\}\s*from\s*["']\.\.\/components\/EcmdBrushedSteelButton["'];?/g, "");
  // Replace JSX <EcmdBrushedSteelButton ... /> with a plain <button> in tests
  t = t.replace(/<EcmdBrushedSteelButton([^>]*)\/>/g, "<button$1 />");
  t = t.replace(/<EcmdBrushedSteelButton([^>]*)>([\s\S]*?)<\/EcmdBrushedSteelButton>/g, "<button$1>$2</button>");
  fs.writeFileSync(matrixTest, t, "utf8");
}

// Clean <EcmdVehicleSelector ... /> JSX usages in test files where the component was deleted
for (const rel of [
  "src/test/ecmd-telemetry-breakpoint.test.tsx",
  "src/test/packages-repeater.test.tsx",
  "src/test/plasmic-controllers.test.tsx"
]) {
  const full = path.join(cwd, rel);
  if (!fs.existsSync(full)) continue;
  let t = fs.readFileSync(full, "utf8");
  t = t.replace(/<EcmdVehicleSelector[\s\S]*?\/>/g, "<div data-testid=\"removed-vehicle-selector\" />");
  t = t.replace(/registerEcmdComponent\(\s*EcmdVehicleSelector\s*,[\s\S]*?\n\s*\)/g, "(() => null)");
  fs.writeFileSync(full, t, "utf8");
}

// Relax hardcoded >= 12 component count assertion now that 11 components were intentionally removed
for (const rel of ["src/test/plasmic-host-boot.test.tsx", "src/test/plasmic-init-styles.test.ts"]) {
  const full = path.join(cwd, rel);
  if (!fs.existsSync(full)) continue;
  let t = fs.readFileSync(full, "utf8");
  t = t.replace(/\.toBeGreaterThanOrEqual\(12\)/g, ".toBeGreaterThanOrEqual(1)");
  fs.writeFileSync(full, t, "utf8");
}

// Add dedicated PowerShell Errors & Output box with Copy PowerShell Output button on /workflow and /errors
for (const rel of ["src/routes/workflow.tsx", "src/routes/errors.tsx"]) {
  const full = path.join(cwd, rel);
  if (!fs.existsSync(full)) continue;
  let code = fs.readFileSync(full, "utf8");

  if (!code.includes("ecmd-ps-errors-output-box")) {
    const boxComponent = `
function EcmdDedicatedPsOutputBox() {
  const [psData, setPsData] = React.useState<{ updatedAt?: string; source?: string; exitCode?: number; summary?: string; output?: string } | null>(null);
  const [copiedPs, setCopiedPs] = React.useState(false);

  async function loadPs() {
    try {
      const res = await fetch("/powershell-results.json?_=" + Date.now(), { cache: "no-store" });
      if (!res.ok) return;
      setPsData(await res.json());
    } catch {}
  }

  React.useEffect(() => {
    loadPs();
    const timer = window.setInterval(loadPs, 3000);
    return () => window.clearInterval(timer);
  }, []);

  const bodyText = psData
    ? [
        "Source: " + (psData.source || "PowerShell"),
        "Updated: " + (psData.updatedAt || ""),
        "Exit Code: " + (typeof psData.exitCode === "number" ? psData.exitCode : 0),
        psData.summary ? "Summary: " + psData.summary : "",
        "",
        psData.output || ""
      ].filter(Boolean).join("\\n")
    : "No PowerShell output recorded yet.";

  async function copyPs() {
    try {
      await navigator.clipboard.writeText(bodyText);
      setCopiedPs(true);
      window.setTimeout(() => setCopiedPs(false), 1800);
    } catch {}
  }

  const hasError = typeof psData?.exitCode === "number" && psData.exitCode !== 0;

  return (
    <section
      id="ecmd-ps-errors-output-box"
      aria-label="PowerShell Errors & Output"
      style={{
        marginTop: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        border: hasError ? "1px solid rgba(248, 113, 113, 0.55)" : "1px solid rgba(148, 163, 184, 0.3)",
        background: "rgba(15, 23, 42, 0.82)",
        color: "#e2e8f0"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            PowerShell Errors &amp; Output {hasError ? "(Error Exit Code " + psData?.exitCode + ")" : "(OK)"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {psData?.updatedAt ? "Updated: " + psData.updatedAt : "Waiting for public/powershell-results.json"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={loadPs}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid rgba(148, 163, 184, 0.35)",
              background: "transparent",
              color: "inherit",
              cursor: "pointer"
            }}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={copyPs}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "none",
              background: copiedPs ? "#10b981" : (hasError ? "#f87171" : "#38bdf8"),
              color: "#041019",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            {copiedPs ? "Copied!" : "Copy PowerShell Output"}
          </button>
        </div>
      </div>
      <textarea
        readOnly
        rows={9}
        value={bodyText}
        style={{
          width: "100%",
          boxSizing: "border-box",
          marginTop: 10,
          padding: 10,
          borderRadius: 8,
          border: "1px solid rgba(148, 163, 184, 0.25)",
          background: "rgba(2, 6, 23, 0.9)",
          color: hasError ? "#fecaca" : "#cbd5e1",
          fontFamily: "monospace",
          fontSize: 12
        }}
      />
    </section>
  );
}
`;

    if (!code.includes("import React")) {
      code = 'import React from "react";\n' + code;
    }

    const lastImport = code.lastIndexOf("\nimport ");
    if (lastImport >= 0) {
      const endLine = code.indexOf("\n", lastImport + 1);
      const pos = endLine >= 0 ? endLine + 1 : code.length;
      code = code.slice(0, pos) + boxComponent + code.slice(pos);
    } else {
      code = boxComponent + "\n" + code;
    }

    const retMatch = code.match(/return\s*\(\s*(?:<>|<div[^>]*>)/);
    if (retMatch && retMatch.index !== undefined) {
      const at = retMatch.index + retMatch[0].length;
      code = code.slice(0, at) + "\n      <EcmdDedicatedPsOutputBox />" + code.slice(at);
    }
  }

  fs.writeFileSync(full, code, "utf8");
}
console.log("Updated tests and wired EcmdDedicatedPsOutputBox.");
