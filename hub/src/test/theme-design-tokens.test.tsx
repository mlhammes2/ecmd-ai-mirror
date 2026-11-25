import React, { useState } from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import {
  buildThemeDesignTokensRootCss,
  compileDesignTokenCssValue,
  createThemeDesignToken,
  updateThemeDesignTokenValue,
  type ThemeDesignToken,
} from "../lib/ecmdThemeEngine";
import {
  EcmdThemeGroupController,
  makeCssRule,
} from "../components/EcmdThemeGroupController";
import {
  EcmdDynamicGroupManagerControl,
  bindTokenToGroupState,
  buildInitialGroupsFromProps,
  deleteDesignTokenWithGroupFallback,
  detachTokenFromGroupState,
  type DynamicGroupsPayload,
} from "../components/EcmdDynamicGroupManager";
import { countGroupsUsingToken } from "../components/EcmdThemeTokensTab";

describe("Site Themes -> Reusable Attribute & Effect Design Tokens (`🔖 Tokens`)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves boxShadow, textShadow, and paint (gradient/solid) tokens, binds them via tokenRefs to multiple groups, emits :root CSS vars, and updates all linked groups automatically when edited", () => {
    const initialTokens: ThemeDesignToken[] = [];
    const boxTok = createThemeDesignToken(initialTokens, {
      name: "Glass Card Shadow",
      type: "boxShadow",
      value: { css: "0px 8px 24px -4px rgba(15,23,42,0.22)" },
    });
    const textTok = createThemeDesignToken([boxTok], {
      name: "Heading Crisp + Glow",
      type: "textShadow",
      value: {
        textShadowEnabled: true,
        textShadowX: 0,
        textShadowY: 1,
        textShadowBlur: 3,
        textShadowColor: "#10B981",
        textShadowOpacity: 50,
        textShadowCustom: "",
      },
    });
    const paintTok = createThemeDesignToken([boxTok, textTok], {
      name: "Emerald Luxe Gradient",
      type: "paint",
      value: "linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%)",
    });
    const tokens = [boxTok, textTok, paintTok];

    expect(boxTok.id).toBe("tok-box-shadow-glass-card-shadow");
    expect(textTok.id).toBe("tok-text-shadow-heading-crisp-glow");
    expect(paintTok.id).toBe("tok-paint-emerald-luxe-gradient");

    // Emits clean :root CSS custom properties
    const rootCss = buildThemeDesignTokensRootCss(tokens, "coastal-light");
    expect(rootCss).toContain("--ecmd-tok-box-shadow-glass-card-shadow: 0px 8px 24px -4px rgba(15,23,42,0.22);");
    expect(rootCss).toContain("--ecmd-tok-text-shadow-heading-crisp-glow: 0px 1px 3px rgba(16, 185, 129, 0.5);");
    expect(rootCss).toContain(
      "--ecmd-tok-paint-emerald-luxe-gradient: linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%);"
    );

    const payload = buildInitialGroupsFromProps({}, undefined);
    payload.designTokens = tokens;
    payload.groups["4"] = bindTokenToGroupState(
      bindTokenToGroupState(
        bindTokenToGroupState(payload.groups["4"]!, "default", "boxShadow", boxTok.id),
        "default",
        "textShadow",
        textTok.id
      ),
      "default",
      "background",
      paintTok.id
    );
    payload.groups["6"] = bindTokenToGroupState(
      bindTokenToGroupState(payload.groups["6"]!, "default", "boxShadow", boxTok.id),
      "hover",
      "background",
      paintTok.id
    );

    expect(countGroupsUsingToken(payload.groups, boxTok.id)).toBe(2);
    expect(countGroupsUsingToken(payload.groups, paintTok.id)).toBe(2);
    expect(countGroupsUsingToken(payload.groups, textTok.id)).toBe(1);

    const renderGroupCss = (groupId: string, activeTokens: ThemeDesignToken[]) => {
      const g = payload.groups[groupId]!;
      return makeCssRule(
        g.id,
        g.enabled,
        g.selector,
        g.clBg,
        g.clText,
        g.clBorder,
        g.radius,
        g.spacing,
        g.padding,
        g.margin,
        g.gap,
        g.clIcon,
        false,
        "",
        g.clSelBg,
        g.clSelText,
        {
          outerShadow: g.clOuterShadow,
          innerShadow: g.clInnerShadow,
          textShadow: g.clTextShadow,
          stateOverrides: g.stateOverrides,
          tokenRefs: g.tokenRefs,
          designTokens: activeTokens,
          activeThemeId: "coastal-light",
          isMs: false,
        }
      );
    };

    const g4CssBefore = renderGroupCss("4", tokens);
    const g6CssBefore = renderGroupCss("6", tokens);
    expect(g4CssBefore).toContain("box-shadow: 0px 8px 24px -4px rgba(15,23,42,0.22) !important;");
    expect(g4CssBefore).toContain("text-shadow: 0px 1px 3px rgba(16, 185, 129, 0.5) !important;");
    expect(g4CssBefore).toContain(
      "background-image: linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%) !important;"
    );
    expect(g6CssBefore).toContain("box-shadow: 0px 8px 24px -4px rgba(15,23,42,0.22) !important;");
    expect(g6CssBefore).toMatch(
      /\.btn-primary:hover[^}]*background-image: linear-gradient\(135deg, #059669 0%, #10B981 50%, #34D399 100%\) !important;/
    );

    // Update tokens globally -> ALL linked groups update automatically!
    let updatedTokens = updateThemeDesignTokenValue(
      tokens,
      boxTok.id,
      { css: "0px 18px 40px -6px rgba(13,148,136,0.38)" },
      { scope: "all" }
    );
    updatedTokens = updateThemeDesignTokenValue(
      updatedTokens,
      paintTok.id,
      "#0F766E",
      { scope: "all" }
    );
    updatedTokens = updateThemeDesignTokenValue(
      updatedTokens,
      textTok.id,
      {
        textShadowEnabled: true,
        textShadowX: 0,
        textShadowY: 2,
        textShadowBlur: 8,
        textShadowColor: "#0EA5E9",
        textShadowOpacity: 70,
        textShadowCustom: "",
      },
      { scope: "all" }
    );

    const g4CssAfter = renderGroupCss("4", updatedTokens);
    const g6CssAfter = renderGroupCss("6", updatedTokens);
    expect(g4CssAfter).toContain("box-shadow: 0px 18px 40px -6px rgba(13,148,136,0.38) !important;");
    expect(g6CssAfter).toContain("box-shadow: 0px 18px 40px -6px rgba(13,148,136,0.38) !important;");
    expect(g4CssAfter).toContain("background-color: #0F766E !important;");
    expect(g6CssAfter).toMatch(/\.btn-primary:hover[^}]*background-color: #0F766E !important;/);
    expect(g4CssAfter).toContain("text-shadow: 0px 2px 8px rgba(14, 165, 233, 0.7) !important;");
  });

  it("resolves per-theme themeOverrides so Light uses the base token shadow/paint while Dark uses its theme-specific override for the same tokenId", () => {
    const baseShadow = "0px 4px 12px 0px rgba(15,23,42,0.14)";
    const darkShadow = "0px 12px 32px 0px rgba(0,0,0,0.68)";
    let tokens: ThemeDesignToken[] = [
      createThemeDesignToken([], {
        name: "Adaptive Elevation",
        type: "boxShadow",
        value: { css: baseShadow },
      }),
    ];
    const tokId = tokens[0]!.id;
    tokens = updateThemeDesignTokenValue(
      tokens,
      tokId,
      { css: darkShadow },
      { scope: "theme", themeId: "midnight-slate" }
    );

    expect(compileDesignTokenCssValue(tokens[0], "coastal-light")).toBe(baseShadow);
    expect(compileDesignTokenCssValue(tokens[0], "midnight-slate")).toBe(darkShadow);

    const payload = buildInitialGroupsFromProps({}, undefined);
    payload.designTokens = tokens;
    payload.groups["4"] = bindTokenToGroupState(payload.groups["4"]!, "default", "boxShadow", tokId);

    const json = JSON.stringify(payload);
    const lightRender = render(
      <EcmdThemeGroupController
        presetTheme="coastal-light"
        matchSystemTheme={false}
        dynamicGroupsJson={json}
      />
    );
    const lightStyle = lightRender.container.querySelector("style")?.textContent || "";
    expect(lightStyle).toContain(`box-shadow: ${baseShadow} !important;`);
    expect(lightStyle).toContain(`--ecmd-${tokId}: ${baseShadow};`);
    lightRender.unmount();

    const darkRender = render(
      <EcmdThemeGroupController
        presetTheme="midnight-slate"
        matchSystemTheme={false}
        dynamicGroupsJson={json}
      />
    );
    const darkStyle = darkRender.container.querySelector("style")?.textContent || "";
    expect(darkStyle).toContain(`box-shadow: ${darkShadow} !important;`);
    expect(darkStyle).toContain(`--ecmd-${tokId}: ${darkShadow};`);
    darkRender.unmount();
  });

  it("preserves exact resolved values on detach (isolating from future edits) and safely falls back when a token is deleted without throwing or dropping styles", () => {
    const paintVal = "linear-gradient(135deg, #059669 0%, #0EA5E9 100%)";
    const shadowVal = "0px 10px 26px -4px rgba(15,23,42,0.30)";
    const darkShadowVal = "0px 14px 36px -4px rgba(0,0,0,0.65)";

    const paintTok = createThemeDesignToken([], {
      name: "Ocean Gradient",
      type: "paint",
      value: paintVal,
    });
    const shadowTok = createThemeDesignToken([paintTok], {
      name: "Card Lift",
      type: "boxShadow",
      value: { css: shadowVal },
      themeOverrides: { ms: { css: darkShadowVal } },
    });

    const payload: DynamicGroupsPayload = buildInitialGroupsFromProps({}, undefined);
    payload.designTokens = [paintTok, shadowTok];
    payload.groups["4"] = bindTokenToGroupState(
      bindTokenToGroupState(payload.groups["4"]!, "default", "background", paintTok.id),
      "default",
      "boxShadow",
      shadowTok.id
    );
    payload.groups["6"] = bindTokenToGroupState(payload.groups["6"]!, "default", "boxShadow", shadowTok.id);

    // 1. Detach boxShadow from Group 4 -> keeps resolved light & dark shadow values locally and clears tokenRef
    payload.groups["4"] = detachTokenFromGroupState(
      payload.groups["4"]!,
      "default",
      "boxShadow",
      payload.designTokens
    );
    expect(payload.groups["4"]!.tokenRefs?.boxShadow).toBeUndefined();
    expect(payload.groups["4"]!.clOuterShadow).toBe(shadowVal);
    expect(payload.groups["4"]!.msOuterShadow).toBe(darkShadowVal);

    // Mutate shadowTok afterwards -> Group 4 stays isolated at original shadow, Group 6 gets new shadow!
    const nextShadow = "0px 2px 4px 0px rgba(0,0,0,0.10)";
    payload.designTokens = updateThemeDesignTokenValue(
      payload.designTokens,
      shadowTok.id,
      { css: nextShadow },
      { scope: "all" }
    );

    const g4 = payload.groups["4"]!;
    const g6 = payload.groups["6"]!;
    const g4Css = makeCssRule(g4.id, true, g4.selector, g4.clBg, g4.clText, g4.clBorder, g4.radius, false, "", "", "", "", false, "", "", "", {
      outerShadow: g4.clOuterShadow,
      tokenRefs: g4.tokenRefs,
      designTokens: payload.designTokens,
      activeThemeId: "cl",
    });
    const g6Css = makeCssRule(g6.id, true, g6.selector, g6.clBg, g6.clText, g6.clBorder, g6.radius, false, "", "", "", "", false, "", "", "", {
      outerShadow: g6.clOuterShadow,
      tokenRefs: g6.tokenRefs,
      designTokens: payload.designTokens,
      activeThemeId: "cl",
    });
    expect(g4Css).toContain(`box-shadow: ${shadowVal} !important;`);
    expect(g6Css).toContain(`box-shadow: ${nextShadow} !important;`);

    // 2. Delete paintTok via deleteDesignTokenWithGroupFallback -> Group 4 keeps gradient locally & stale ref is cleared
    const afterDelete = deleteDesignTokenWithGroupFallback(payload, paintTok.id);
    expect(afterDelete.designTokens?.some((t) => t.id === paintTok.id)).toBe(false);
    expect(afterDelete.groups["4"]!.tokenRefs?.background).toBeUndefined();
    expect(afterDelete.groups["4"]!.clBg).toBe(paintVal);
    expect(afterDelete.groups["4"]!.msBg).toBe(paintVal);

    // 3. Direct stale ref safety check in makeCssRule (even if tokenRefs points to a non-existent ID, never throws & falls back!)
    const staleCss = makeCssRule(4, true, ".stale-card", "#123456", "#FFFFFF", "", "8px", false, "", "", "", "", false, "", "", "", {
      outerShadow: "0px 4px 10px 0px rgba(0,0,0,0.20)",
      tokenRefs: { background: "tok-deleted-ghost", boxShadow: "tok-missing-shadow" },
      designTokens: [],
      activeThemeId: "cl",
    });
    expect(staleCss).toContain("background-color: #123456 !important;");
    expect(staleCss).toContain("box-shadow: 0px 4px 10px 0px rgba(0,0,0,0.20) !important;");
  });

  it("supports end-to-end Theme Groups Inspector & 🔖 Tokens Tab interactive workflow (save token, bind, edit everywhere, detach, rename, duplicate, delete)", () => {
    function StudioHarness() {
      const [json, setJson] = useState<string>(() =>
        JSON.stringify(buildInitialGroupsFromProps({}, undefined))
      );
      return (
        <div>
          <EcmdDynamicGroupManagerControl
            value={json}
            updateValue={setJson}
            componentProps={{ presetTheme: "coastal-light" }}
          />
          <output data-testid="payload-json">{json}</output>
        </div>
      );
    }

    const { getByTestId } = render(<StudioHarness />);

    // Open Theme Groups Inspector popup
    act(() => {
      fireEvent.click(document.querySelector('button[title="Open Theme Groups Inspector"]')!);
    });

    // Expand Outer Shadow builder and save current shadow as a token
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-shadow-expand="outerShadow"]')!);
    });
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-save-as-token-btn="outerShadow"]')!);
    });
    const nameInput = document.querySelector('[data-ecmd-save-token-name-input="outerShadow"]') as HTMLInputElement;
    expect(nameInput).not.toBeNull();
    act(() => {
      fireEvent.change(nameInput, { target: { value: "Hero Glass Lift" } });
    });
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-save-token-confirm-btn="outerShadow"]')!);
    });

    // Linked banner appears immediately with [✏️ Edit Token Everywhere] and [⛓️‍💥 Detach]
    const banner = document.querySelector('[data-ecmd-linked-token-banner="outerShadow"]');
    expect(banner?.textContent).toContain("Linked: Hero Glass Lift");

    // Toggle [✏️ Edit Token Everywhere] and switch scope to "This Theme Only"
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-edit-token-everywhere-btn="outerShadow"]')!);
    });
    expect(document.querySelector('[data-ecmd-token-scope-bar="outerShadow"]')).not.toBeNull();
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-token-scope="theme"]')!);
    });

    // Switch to the dedicated 🔖 Tokens tab
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-studio-tab="tokens"]')!);
    });
    expect(document.querySelector('[data-ecmd-tokens-tab-root="true"]')).not.toBeNull();
    expect(document.querySelector('[data-ecmd-token-usage="tok-box-shadow-hero-glass-lift"]')?.textContent).toBe(
      "Used in 1 group"
    );

    // Duplicate token -> count becomes 2
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-token-duplicate-btn="tok-box-shadow-hero-glass-lift"]')!);
    });
    const parsedAfterDup = JSON.parse(getByTestId("payload-json").textContent || "{}") as DynamicGroupsPayload;
    expect(parsedAfterDup.designTokens?.length).toBe(2);

    // Delete original token -> safely preserves group shadow & clears stale tokenRef
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-token-delete-btn="tok-box-shadow-hero-glass-lift"]')!);
    });
    const parsedAfterDel = JSON.parse(getByTestId("payload-json").textContent || "{}") as DynamicGroupsPayload;
    expect(parsedAfterDel.designTokens?.length).toBe(1);
    expect(parsedAfterDel.groups["1"]?.tokenRefs?.boxShadow).toBeUndefined();
  });
});
