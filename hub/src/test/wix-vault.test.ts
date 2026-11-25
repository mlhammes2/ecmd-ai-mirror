import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Wix Legacy Vault & Public AI Mirror Grounding", () => {
  const hubRoot = path.resolve(__dirname, "../..");
  const workspaceRoot = path.resolve(hubRoot, "..");
  const mirrorScriptPath = path.join(workspaceRoot, "scripts", "sync-ai-mirror.mjs");
  const legacySrcDir = path.join(workspaceRoot, "src");

  it("removes obsolete bloated static dump files from public/", () => {
    expect(fs.existsSync(path.join(hubRoot, "public", "wix-vault-index.json"))).toBe(false);
    expect(fs.existsSync(path.join(hubRoot, "public", "ai-history.json"))).toBe(false);
    expect(fs.existsSync(path.join(hubRoot, "public", "ai-site-manifest.json"))).toBe(false);
  });

  it("preserves core Wix Velo legacy source files in C:\\ECMD\\src for mirror grounding", () => {
    expect(fs.existsSync(legacySrcDir)).toBe(true);
    expect(fs.existsSync(path.join(legacySrcDir, "backend", "data.js"))).toBe(true);
    expect(fs.existsSync(path.join(legacySrcDir, "public", "stateManager.js"))).toBe(true);
  });

  it("configures sync-ai-mirror.mjs to mirror ecmd_wix_legacy_vault and exclude obsolete static dumps", () => {
    expect(fs.existsSync(mirrorScriptPath)).toBe(true);
    const script = fs.readFileSync(mirrorScriptPath, "utf8");
    expect(script).toContain("ecmd_wix_legacy_vault");
    expect(script).toContain("mlhammes2");
    expect(script).toContain("ecmd-ai-mirror");
    expect(script).toContain("SITE_MANIFEST.md");
    expect(script).toContain("ai-history.json");
    expect(script).toContain("wix-vault-index.json");
  });
});
