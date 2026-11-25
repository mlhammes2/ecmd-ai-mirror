import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Wix Legacy Vault Metadata Index", () => {
  const manifestPath = path.resolve(__dirname, "../../public/wix-vault-index.json");

  it("exists in public directory and contains valid JSON", () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    const content = fs.readFileSync(manifestPath, "utf8");
    const json = JSON.parse(content);
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThanOrEqual(40);
  });

  it("contains well-formed vault metadata items with required fields", () => {
    const json = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    for (const item of json) {
      expect(item).toHaveProperty("file_path");
      expect(item).toHaveProperty("category");
      expect(item).toHaveProperty("wix_page_or_module");
      expect(item).toHaveProperty("line_count");
      expect(item).toHaveProperty("source_origin");
      expect(item).toHaveProperty("description");
      expect(typeof item.line_count).toBe("number");
      expect(item.line_count).toBeGreaterThan(0);
    }
  });

  it("includes core backend, page scripts, and CMS collection schemas", () => {
    const json = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const paths = json.map((i: any) => i.file_path);

    expect(paths).toContain("src/backend/data.js");
    expect(paths).toContain("src/public/stateManager.js");
    expect(paths).toContain("cms/collections/scheduledJobs.json");
    expect(paths).toContain("cms/collections/contractors.json");
  });
});
