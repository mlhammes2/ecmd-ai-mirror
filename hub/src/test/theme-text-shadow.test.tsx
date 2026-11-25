import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import {
  buildTextShadowCssValue,
  matchTextShadowPresetId,
  TEXT_SHADOW_PRESETS,
  type ThemeTextShadowConfig,
} from "../lib/ecmdThemeEngine";
import { EcmdThemeGroupController, makeCssRule } from "../components/EcmdThemeGroupController";
import {
  EcmdDynamicGroupManagerControl,
  buildInitialGroupsFromProps,
} from "../components/EcmdDynamicGroupManager";

describe("Site Themes -> Groups -> Visual ✨ Text Shadow Builder", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("emits exact rgba(...) text-shadow CSS with descendant rich-text cascade for Default, Hover, Focus, and Disabled states when enabled", () => {
    const css = makeCssRule(
      2,
      true,
      ".hero-heading",
      "transparent",
      "#FFFFFF",
      "",
      "",
      false,
      "",
      "",
      "",
      "",
      false,
      "",
      "",
      "",
      {
        isMs: false,
        textShadow: {
          textShadowEnabled: true,
          textShadowX: 0,
          textShadowY: 1,
          textShadowBlur: 2,
          textShadowColor: "#000000",
          textShadowOpacity: 40,
        },
        stateOverrides: {
          hover: {
            cl: {
              textShadowEnabled: true,
              textShadowX: 0,
              textShadowY: 0,
              textShadowBlur: 10,
              textShadowColor: "#10b981",
              textShadowOpacity: 45,
            },
          },
          focus: {
            cl: {
              textShadowEnabled: true,
              textShadowX: 2,
              textShadowY: 3,
              textShadowBlur: 6,
              textShadowColor: "#0EA5E9",
              textShadowOpacity: 50,
            },
          },
          disabled: {
            cl: {
              textShadowEnabled: true,
              textShadowCustom: "none",
            },
          },
        },
      }
    );

    // Default state: exact rgba(0, 0, 0, 0.4) on element + nested Plasmic rich-text spans (*)
    expect(css).toContain(
      ".ecmd-group-2, .hero-heading { background-color: transparent !important; color: #FFFFFF !important; text-shadow: 0px 1px 2px rgba(0, 0, 0, 0.4) !important; }"
    );
    expect(css).toContain(
      ".ecmd-group-2 *, .hero-heading * { text-shadow: 0px 1px 2px rgba(0, 0, 0, 0.4) !important; }"
    );

    // Hover state: Emerald Glow rgba(16, 185, 129, 0.45) + descendant cascade
    expect(css).toContain(
      "text-shadow: 0px 0px 10px rgba(16, 185, 129, 0.45) !important;"
    );
    expect(css).toMatch(
      /\.hero-heading:hover[^}]*text-shadow: 0px 0px 10px rgba\(16, 185, 129, 0\.45\) !important;/
    );
    expect(css).toMatch(
      /\.hero-heading:hover[^\{]* \* \{ text-shadow: 0px 0px 10px rgba\(16, 185, 129, 0\.45\) !important; \}/
    );

    // Focus / Active state: custom offset & sky-blue shadow
    expect(css).toMatch(
      /\.hero-heading:focus-visible[^}]*text-shadow: 2px 3px 6px rgba\(14, 165, 233, 0\.5\) !important;/
    );
    expect(css).toMatch(
      /\.hero-heading:focus[^\{]* \* \{ text-shadow: 2px 3px 6px rgba\(14, 165, 233, 0\.5\) !important; \}/
    );

    // Disabled state: explicit "None (Clear)" emits text-shadow: none !important
    expect(css).toMatch(
      /\.hero-heading:disabled[^}]*text-shadow: none !important;/
    );
    expect(css).toMatch(
      /\.hero-heading:disabled[^\{]* \* \{ text-shadow: none !important; \}/
    );

    // Strict cascade order preserved: Default < Hover < Focus < Disabled
    const idxDef = css.indexOf("text-shadow: 0px 1px 2px rgba(0, 0, 0, 0.4) !important;");
    const idxHov = css.indexOf("text-shadow: 0px 0px 10px rgba(16, 185, 129, 0.45) !important;");
    const idxFoc = css.indexOf("text-shadow: 2px 3px 6px rgba(14, 165, 233, 0.5) !important;");
    const idxDis = css.indexOf("text-shadow: none !important;");
    expect(idxDef).toBeGreaterThanOrEqual(0);
    expect(idxHov).toBeGreaterThan(idxDef);
    expect(idxFoc).toBeGreaterThan(idxHov);
    expect(idxDis).toBeGreaterThan(idxFoc);
  });

  it("supports multi-layer custom override presets (Crisp + Glow) and omits text-shadow completely when textShadowEnabled is false or unset", () => {
    const crispGlowPreset = TEXT_SHADOW_PRESETS.find((p) => p.id === "crisp-glow")!;
    expect(buildTextShadowCssValue(crispGlowPreset.config)).toBe(
      "0 1px 2px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(16, 185, 129, 0.35)"
    );
    expect(matchTextShadowPresetId(crispGlowPreset.config)).toBe("crisp-glow");

    // Disabled config with saved values must NOT emit any text-shadow
    const offConfig: ThemeTextShadowConfig = {
      textShadowEnabled: false,
      textShadowX: 2,
      textShadowY: 4,
      textShadowBlur: 8,
      textShadowColor: "#10B981",
      textShadowOpacity: 60,
    };
    expect(buildTextShadowCssValue(offConfig)).toBe("");

    const cssWhenOff = makeCssRule(
      4,
      true,
      ".plain-text-card",
      "#FFFFFF",
      "#0F172A",
      "",
      "",
      false,
      "",
      "",
      "",
      "",
      false,
      "",
      "",
      "",
      {
        isMs: false,
        textShadow: offConfig,
        stateOverrides: {
          hover: {
            cl: {
              bg: "#F1F5F9",
              textShadowEnabled: false,
              textShadowX: 0,
              textShadowY: 2,
              textShadowBlur: 6,
            },
          },
        },
      }
    );

    expect(cssWhenOff).not.toContain("text-shadow:");
    expect(cssWhenOff).toContain("color: #0F172A !important;");
  });

  it("switches text-shadow cleanly per theme (Coastal Light vs Midnight Slate) without leaking across themes", () => {
    const payload = buildInitialGroupsFromProps({}, undefined);
    payload.selectedId = 4;
    payload.groups["4"] = {
      ...payload.groups["4"]!,
      selector: ".theme-title",
      clTextShadow: {
        textShadowEnabled: true,
        textShadowX: 0,
        textShadowY: 1,
        textShadowBlur: 2,
        textShadowColor: "#000000",
        textShadowOpacity: 40,
      },
      msTextShadow: {
        textShadowEnabled: true,
        textShadowX: 0,
        textShadowY: 0,
        textShadowBlur: 10,
        textShadowColor: "#10B981",
        textShadowOpacity: 45,
      },
      stateOverrides: {
        hover: {
          cl: {
            textShadowEnabled: true,
            textShadowX: 0,
            textShadowY: 2,
            textShadowBlur: 6,
            textShadowColor: "#000000",
            textShadowOpacity: 30,
          },
          // Intentionally no hover text-shadow in Midnight Slate -> must NOT leak Coastal Light hover!
          ms: {
            textShadowEnabled: false,
          },
        },
      },
    };
    const json = JSON.stringify(payload);

    // Coastal Light theme
    const { container: lightCtrl, unmount: unmountLight } = render(
      <EcmdThemeGroupController
        presetTheme="coastal-light"
        matchSystemTheme={false}
        dynamicGroupsJson={json}
      />
    );
    const lightCss = lightCtrl.querySelector("style")?.textContent || "";
    expect(lightCss).toContain("text-shadow: 0px 1px 2px rgba(0, 0, 0, 0.4) !important;");
    expect(lightCss).toContain("text-shadow: 0px 2px 6px rgba(0, 0, 0, 0.3) !important;");
    expect(lightCss).not.toContain("rgba(16, 185, 129, 0.45)");
    unmountLight();

    // Midnight Slate theme
    const { container: darkCtrl, unmount: unmountDark } = render(
      <EcmdThemeGroupController
        presetTheme="midnight-slate"
        matchSystemTheme={false}
        dynamicGroupsJson={json}
      />
    );
    const darkCss = darkCtrl.querySelector("style")?.textContent || "";
    expect(darkCss).toContain("text-shadow: 0px 0px 10px rgba(16, 185, 129, 0.45) !important;");
    expect(darkCss).not.toContain("0px 1px 2px rgba(0, 0, 0, 0.4)");
    expect(darkCss).not.toContain("0px 2px 6px rgba(0, 0, 0, 0.3)");
    unmountDark();

    // Verify Light-only textShadow NEVER leaks into Dark when msTextShadow is undefined
    const lightOnlyPayload = buildInitialGroupsFromProps({}, undefined);
    lightOnlyPayload.groups["4"] = {
      ...lightOnlyPayload.groups["4"]!,
      selector: ".light-only-text",
      clTextShadow: {
        textShadowEnabled: true,
        textShadowX: 1,
        textShadowY: 2,
        textShadowBlur: 4,
        textShadowColor: "#000000",
        textShadowOpacity: 35,
      },
      msTextShadow: undefined,
    };
    const { container: darkClean, unmount: unmountDarkClean } = render(
      <EcmdThemeGroupController
        presetTheme="midnight-slate"
        matchSystemTheme={false}
        dynamicGroupsJson={JSON.stringify(lightOnlyPayload)}
      />
    );
    const darkCleanCss = darkClean.querySelector("style")?.textContent || "";
    const lightOnlyLines = darkCleanCss
      .split("\n")
      .filter((l) => l.includes(".light-only-text"));
    expect(lightOnlyLines.join("\n")).not.toContain("text-shadow:");
    unmountDarkClean();
  });

  it("renders visual ✨ Text Shadow controls in [Site Themes] -> 📂 Groups with presets, X/Y/Blur/Color/Opacity sliders, live Aa preview chip, and per-state persistence", () => {
    const payload = buildInitialGroupsFromProps({}, undefined);
    payload.selectedId = 4;
    payload.groups["4"] = {
      ...payload.groups["4"]!,
      selector: ".studio-heading",
    };

    const onUpdate = vi.fn();
    const { container, rerender } = render(
      <EcmdDynamicGroupManagerControl
        value={JSON.stringify(payload)}
        componentProps={{ presetTheme: "coastal-light" }}
        updateValue={onUpdate}
      />
    );

    if (!document.querySelector('[data-ecmd-text-shadow-preset="true"]')) {
      act(() => {
        fireEvent.click(container.querySelector("button")!);
      });
    }

    const syncLatest = () => {
      const latest = onUpdate.mock.calls[onUpdate.mock.calls.length - 1]?.[0] as string;
      rerender(
        <EcmdDynamicGroupManagerControl
          value={latest}
          componentProps={{ presetTheme: "coastal-light" }}
          updateValue={onUpdate}
        />
      );
      return latest;
    };

    // (1) Select "Crisp + Glow" quick preset -> updates live "Aa" preview chip & stores dual-layer CSS
    const presetSelect = document.querySelector(
      '[data-ecmd-text-shadow-preset="true"]'
    ) as HTMLSelectElement;
    expect(presetSelect).toBeInTheDocument();

    act(() => {
      fireEvent.change(presetSelect, { target: { value: "crisp-glow" } });
    });
    const afterPresetJson = syncLatest();
    const parsedPreset = JSON.parse(afterPresetJson);
    expect(parsedPreset.groups["4"].clTextShadow.textShadowEnabled).toBe(true);
    expect(parsedPreset.groups["4"].clTextShadow.textShadowCustom).toBe(
      "0 1px 2px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(16, 185, 129, 0.35)"
    );

    const previewChip = document.querySelector(
      '[data-ecmd-text-shadow-preview="true"]'
    ) as HTMLElement;
    expect(previewChip).toBeInTheDocument();
    expect(previewChip.textContent).toBe("Aa");
    expect(previewChip.style.textShadow).toContain("rgba(16, 185, 129, 0.35)");

    // (2) Adjust X, Y, Blur, Shadow Color, and Opacity sliders -> switches cleanly to single-layer rgba()
    act(() => {
      fireEvent.change(document.querySelector('[data-ecmd-text-shadow-input="x"]')!, {
        target: { value: "2" },
      });
    });
    syncLatest();
    act(() => {
      fireEvent.change(document.querySelector('[data-ecmd-text-shadow-input="y"]')!, {
        target: { value: "3" },
      });
    });
    syncLatest();
    act(() => {
      fireEvent.change(document.querySelector('[data-ecmd-text-shadow-input="blur"]')!, {
        target: { value: "8" },
      });
    });
    syncLatest();
    act(() => {
      fireEvent.change(document.querySelector('[data-ecmd-text-shadow-input="color"]')!, {
        target: { value: "#10B981" },
      });
    });
    syncLatest();
    act(() => {
      fireEvent.change(document.querySelector('[data-ecmd-text-shadow-input="opacity"]')!, {
        target: { value: "55" },
      });
    });
    const afterCustomJson = syncLatest();
    const parsedCustom = JSON.parse(afterCustomJson);
    expect(parsedCustom.groups["4"].clTextShadow).toEqual({
      textShadowEnabled: true,
      textShadowX: 2,
      textShadowY: 3,
      textShadowBlur: 8,
      textShadowColor: "#10B981",
      textShadowOpacity: 55,
      textShadowCustom: "",
    });
    expect(
      (document.querySelector('[data-ecmd-text-shadow-preview="true"]') as HTMLElement).style
        .textShadow
    ).toBe("2px 3px 8px rgba(16, 185, 129, 0.55)");

    // (3) Switch to Hover state tab and pick "Emerald Glow" preset -> saved under stateOverrides.hover.cl
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-state-tab="hover"]')!);
    });
    const hoverPreset = document.querySelector(
      '[data-ecmd-text-shadow-preset="true"]'
    ) as HTMLSelectElement;
    act(() => {
      fireEvent.change(hoverPreset, { target: { value: "emerald-glow" } });
    });
    const afterHoverJson = syncLatest();
    const parsedHover = JSON.parse(afterHoverJson);
    expect(parsedHover.groups["4"].stateOverrides.hover.cl.textShadowEnabled).toBe(true);
    expect(parsedHover.groups["4"].stateOverrides.hover.cl.textShadowBlur).toBe(10);
    expect(parsedHover.groups["4"].stateOverrides.hover.cl.textShadowColor).toBe("#10B981");
    expect(parsedHover.groups["4"].stateOverrides.hover.cl.textShadowOpacity).toBe(45);

    // (4) Switch back to Default and pick "None (Reset)" -> disables text-shadow cleanly
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-state-tab="default"]')!);
    });
    act(() => {
      fireEvent.change(document.querySelector('[data-ecmd-text-shadow-preset="true"]')!, {
        target: { value: "none-reset" },
      });
    });
    const afterResetJson = syncLatest();
    expect(JSON.parse(afterResetJson).groups["4"].clTextShadow.textShadowEnabled).toBe(false);
  });
});
