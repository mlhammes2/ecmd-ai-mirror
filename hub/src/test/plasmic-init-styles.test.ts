import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { ALLOWED_PLASMIC_TOKEN_TYPES } from "../lib/ecmdLiveComponentTelemetry";

export const ALLOWED_PLASMIC_STYLE_KEYS = new Set([
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "backgroundColor",
  "color",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "textAlign",
  "borderRadius",
  "rowGap",
  "columnGap",
  "gap",
  "alignItems",
  "justifyContent",
  "opacity",
]);

const ATOMIC_SPACING_KEYS = new Set([
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
]);

interface StyleBlock {
  kind: "styles" | "defaultStyles";
  startLine: number;
  body: string;
}

function extractStyleBlocks(source: string): StyleBlock[] {
  const blocks: StyleBlock[] = [];
  const regex = /\b(styles|defaultStyles)\s*:\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source)) !== null) {
    const kind = match[1] as "styles" | "defaultStyles";
    const openBraceIdx = match.index + match[0].length - 1;
    let depth = 0;
    let inString: string | null = null;
    let escaped = false;
    let closeBraceIdx = -1;

    for (let i = openBraceIdx; i < source.length; i++) {
      const ch = source[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === inString) {
          inString = null;
        }
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        inString = ch;
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          closeBraceIdx = i;
          break;
        }
      }
    }

    if (closeBraceIdx !== -1) {
      const startLine = source.slice(0, match.index).split("\n").length;
      const body = source.slice(openBraceIdx + 1, closeBraceIdx);
      blocks.push({ kind, startLine, body });
    }
  }

  return blocks;
}

describe("Plasmic Component Registrations — Strict CSS Whitelist", () => {
  it("enforces ONLY ALLOWED_PLASMIC_STYLE_KEYS and single-token atomic spacing in every styles & defaultStyles object in src/plasmic-init.ts", () => {
    const filePath = path.join(__dirname, "../plasmic-init.ts");
    const source = fs.readFileSync(filePath, "utf-8");
    const blocks = extractStyleBlocks(source);

    expect(blocks.length).toBeGreaterThan(0);

    const violations: string[] = [];

    for (const block of blocks) {
      const propRegex = /(?:["']([^"']+)["']|([A-Za-z_$][\w$-]*))\s*:\s*(?:"([^"]*)"|'([^']*)'|([^,}\n]+))/g;
      let propMatch: RegExpExecArray | null;

      while ((propMatch = propRegex.exec(block.body)) !== null) {
        const key = (propMatch[1] || propMatch[2] || "").trim();
        const rawVal = (propMatch[3] ?? propMatch[4] ?? propMatch[5] ?? "").trim();
        if (!key) continue;

        if (!ALLOWED_PLASMIC_STYLE_KEYS.has(key)) {
          violations.push(
            `Line ${block.startLine} (${block.kind}): forbidden CSS key '${key}' (value: ${rawVal})`
          );
          continue;
        }

        if (ATOMIC_SPACING_KEYS.has(key) && /\s+/.test(rawVal)) {
          violations.push(
            `Line ${block.startLine} (${block.kind}): multi-value spacing '${key}: "${rawVal}"' must be a single atomic value`
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("enforces registerEcmdComponent across ALL components in src/plasmic-init.ts with ZERO bare registerComponent calls", async () => {
    const filePath = path.join(__dirname, "../plasmic-init.ts");
    const source = fs.readFileSync(filePath, "utf-8");

    // Strip comments before asserting zero bare registerComponent( calls
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const bareMatches = codeOnly.match(/\bregisterComponent\s*\(/g) || [];
    expect(bareMatches).toEqual([]);

    const wrappedMatches = codeOnly.match(/\bregisterEcmdComponent\s*\(/g) || [];
    expect(wrappedMatches.length).toBeGreaterThanOrEqual(12);

    await import("../plasmic-init");
    const { ECMD_REGISTERED_COMPONENTS } = await import("../lib/ecmdLiveComponentTelemetry");
    const names = ECMD_REGISTERED_COMPONENTS.map((c) => c.name);
    for (const expected of [
      "HqWeeklyStrip",
      "HqDailyDispatchBoard",
      "HqInvoiceCard",
      "HqMultiStateWorkspace",
      "EcmdAuthModalController",
      "EcmdBrandIcon",
      "EcmdBrandWordMark",
      "EcmdThemeLogo",
      "EcmdThemeGroupController",
      "EcmdSideMenuController",
      "EcmdVehicleSelector",
      "EcmdSavedVehicleDropdown",
      "EcmdPackagesRepeater",
      "EcmdWhatsIncludedModal",
      "EcmdWhatsIncludedItemPopup",
      "EcmdBrushedSteelButton",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("enforces ALLOWED_PLASMIC_TOKEN_TYPES on EVERY PLASMIC.registerToken call (static source scan + runtime registry check; NEVER type: 'string')", async () => {
    const filePath = path.join(__dirname, "../plasmic-init.ts");
    const source = fs.readFileSync(filePath, "utf-8");
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    // 1. Static source inspection: extract every .registerToken({ ... }) call and validate `type`
    const regTokenRegex = /\bregisterToken\s*\(\s*\{/g;
    let match: RegExpExecArray | null;
    const violations: string[] = [];

    while ((match = regTokenRegex.exec(codeOnly)) !== null) {
      const openBraceIdx = match.index + match[0].length - 1;
      let depth = 0;
      let inString: string | null = null;
      let escaped = false;
      let closeBraceIdx = -1;

      for (let i = openBraceIdx; i < codeOnly.length; i++) {
        const ch = codeOnly[i];
        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (ch === "\\") {
            escaped = true;
          } else if (ch === inString) {
            inString = null;
          }
          continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") {
          inString = ch;
          continue;
        }
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            closeBraceIdx = i;
            break;
          }
        }
      }

      const body = closeBraceIdx !== -1 ? codeOnly.slice(openBraceIdx + 1, closeBraceIdx) : "";
      const typeMatch = body.match(/\btype\s*:\s*["']([^"']+)["']/);
      const tokenType = typeMatch ? typeMatch[1] : "(missing)";
      if (!ALLOWED_PLASMIC_TOKEN_TYPES.has(tokenType as any)) {
        violations.push(
          `Forbidden PLASMIC.registerToken type "${tokenType}" — only [${Array.from(ALLOWED_PLASMIC_TOKEN_TYPES).join(", ")}] are allowed (use registerDataToken for string tokens).`
        );
      }
    }

    expect(violations).toEqual([]);

    // 2. Runtime registry & loader inspection after importing src/plasmic-init.ts
    const { PLASMIC } = await import("../plasmic-init");
    const tokenRegistry: Array<{ name?: string; type?: string }> = Array.isArray(
      (window as any).__PlasmicTokenRegistry
    )
      ? (window as any).__PlasmicTokenRegistry
      : [];

    for (const token of tokenRegistry) {
      expect(
        ALLOWED_PLASMIC_TOKEN_TYPES.has(token.type as any),
        `Invalid runtime token "${token.name}" with type "${token.type}"`
      ).toBe(true);
    }

    // Also inspect internal loader token registrations if exposed by @plasmicapp/loader-react
    const internalTokens: Array<{ name?: string; type?: string }> =
      (PLASMIC as any)?.registeredTokens ||
      (PLASMIC as any)?.tokens ||
      [];
    for (const token of internalTokens) {
      expect(
        ALLOWED_PLASMIC_TOKEN_TYPES.has(token.type as any),
        `Invalid PLASMIC registered token "${token.name}" with type "${token.type}"`
      ).toBe(true);
    }
  });

  it("streams synchronous host-boot registration errors straight to /__ecmd-runtime-error in DEV", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const { registerEcmdComponent } = await import("../lib/ecmdLiveComponentTelemetry");
      const throwingLoader = {
        registerComponent: vi.fn(() => {
          throw new Error("Simulated synchronous Plasmic host boot failure");
        }),
      };

      const DummyComp = () => null;
      // Must NOT crash the host; must catch and forward to /__ecmd-runtime-error
      expect(() =>
        registerEcmdComponent(
          DummyComp,
          { name: "EcmdSimulatedFailureProbe", props: {} },
          throwingLoader
        )
      ).not.toThrow();

      expect(fetchSpy).toHaveBeenCalled();
      const [url, init] = fetchSpy.mock.calls[0] || [];
      expect(String(url)).toContain("/__ecmd-runtime-error");
      const body = JSON.parse(String((init as RequestInit)?.body || "{}"));
      expect(body.message).toContain("Simulated synchronous Plasmic host boot failure");
      expect(body.source).toContain("plasmic-init:registerComponent:EcmdSimulatedFailureProbe");
    } finally {
      fetchSpy.mockRestore();
      errSpy.mockRestore();
    }
  });
});
