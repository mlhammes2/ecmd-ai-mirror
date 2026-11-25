import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import {
  isZeroBorderWidthValue,
  parseBorderWidthNumericPx,
  resolveThemeBorderMode,
} from "../lib/ecmdThemeEngine";
import { makeCssRule } from "../components/EcmdThemeGroupController";
import {
  EcmdDynamicGroupManagerControl,
  buildInitialGroupsFromProps,
} from "../components/EcmdDynamicGroupManager";

describe("Theme Groups Inspector ([Site Themes] -> 📂 Groups) Border Off/0px, Width & Style Controls", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("emits explicit border: 0px none transparent !important for borderNone / 0px on Default and cleanly overrides Default solid or gradient borders on Hover", () => {
    // 1. Default with borderNone: true suppresses border & gradient-border mask completely
    const defaultOffCss = makeCssRule(
      2,
      true,
      ".borderless-btn",
      "#0B57D0",
      "#FFFFFF",
      "linear-gradient(135deg, #10B981 0%, #0EA5E9 100%)",
      "9999px",
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
        borderNone: true,
        isMs: false,
      }
    );
    expect(defaultOffCss).toContain(
      "border: 0px none transparent !important; border-width: 0px !important; border-style: none !important; border-color: transparent !important;"
    );
    expect(defaultOffCss).not.toContain("border-box");
    expect(defaultOffCss).not.toContain("::before");

    // 2. Default with borderWidth: "0px" also activates 0px none mode cleanly
    const zeroWidthCss = makeCssRule(
      3,
      true,
      ".flat-pill",
      "#FFFFFF",
      "#0F172A",
      "#CBD5E1",
      "8px",
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
        borderWidth: "0px",
        isMs: false,
      }
    );
    expect(zeroWidthCss).toContain("border: 0px none transparent !important;");
    expect(zeroWidthCss).toContain("border-width: 0px !important;");
    expect(zeroWidthCss).toContain("border-style: none !important;");
    expect(zeroWidthCss).toContain("border-color: transparent !important;");

    // 3. Default solid border + Hover borderNone: true -> Hover overrides cleanly to 0px none
    const hoverClearsSolidCss = makeCssRule(
      4,
      true,
      ".solid-to-none-btn",
      "#FFFFFF",
      "#0F172A",
      "#CBD5E1",
      "10px",
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
        borderWidth: "1px",
        borderStyle: "solid",
        isMs: false,
        stateOverrides: {
          hover: {
            borderNone: true,
          },
        },
      }
    );
    expect(hoverClearsSolidCss).toContain(
      "border-color: #CBD5E1 !important; border-width: 1px !important; border-style: solid !important;"
    );
    expect(hoverClearsSolidCss).toMatch(
      /\.solid-to-none-btn:hover[^}]*border: 0px none transparent !important; border-width: 0px !important; border-style: none !important; border-color: transparent !important;/
    );

    // 4. Default layered gradient border (solid bg) + Hover borderNone: true -> clears padding-box/border-box composite & sets 0px none
    const gradBorder = "linear-gradient(135deg, #10B981 0%, #0EA5E9 100%)";
    const hoverClearsLayeredGradCss = makeCssRule(
      5,
      true,
      ".layered-grad-to-none",
      "#0F172A",
      "#F8FAFC",
      gradBorder,
      "12px",
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
        borderWidth: "2px",
        isMs: true,
        stateOverrides: {
          hover: {
            borderWidth: "0px",
          },
        },
      }
    );
    expect(hoverClearsLayeredGradCss).toContain(
      `background: linear-gradient(#0F172A, #0F172A) padding-box, ${gradBorder} border-box !important;`
    );
    expect(hoverClearsLayeredGradCss).toMatch(
      /\.layered-grad-to-none:hover[^}]*border: 0px none transparent !important;[^}]*background: #0F172A !important;/
    );

    // 5. Default ::before mask gradient border (transparent bg) + Hover borderNone: true -> hides ::before mask & sets 0px none
    const hoverClearsMaskGradCss = makeCssRule(
      6,
      true,
      ".mask-grad-to-none",
      "transparent",
      "#FFFFFF",
      gradBorder,
      "14px",
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
        borderWidth: "2px",
        isMs: true,
        stateOverrides: {
          hover: {
            borderMode: "none",
          },
        },
      }
    );
    expect(hoverClearsMaskGradCss).toContain(".mask-grad-to-none::before");
    expect(hoverClearsMaskGradCss).toMatch(
      /\.mask-grad-to-none:hover[^}]*border: 0px none transparent !important;/
    );
    expect(hoverClearsMaskGradCss).toMatch(
      /\.mask-grad-to-none:hover[^\{]*::before \{ display: none !important; \}/
    );
  });

  it("emits exact custom borderWidth + borderStyle (dashed/dotted/solid) for solid and rounded-gradient borders, defaults to 1px when width is blank, and emits zero border CSS when Unset", () => {
    // 1. Custom 2px dashed solid-color border
    const dashedSolidCss = makeCssRule(
      7,
      true,
      ".dashed-dropzone",
      "#F8FAFC",
      "#0F172A",
      "#0D9488",
      "12px",
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
        borderWidth: "2px",
        borderStyle: "dashed",
        isMs: false,
      }
    );
    expect(dashedSolidCss).toContain("border-color: #0D9488 !important;");
    expect(dashedSolidCss).toContain("border-width: 2px !important;");
    expect(dashedSolidCss).toContain("border-style: dashed !important;");

    // 2. Rounded-Gradient border with custom 3px width + solid style (never border-image!)
    const gradBorder = "linear-gradient(135deg, #059669 0%, #38BDF8 100%)";
    const grad3pxCss = makeCssRule(
      8,
      true,
      ".grad-3px-card",
      "#0F172A",
      "#FFFFFF",
      gradBorder,
      "16px",
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
        borderWidth: "3px",
        borderStyle: "solid",
        isMs: true,
      }
    );
    expect(grad3pxCss).not.toContain("border-image");
    expect(grad3pxCss).toContain("border-color: transparent !important;");
    expect(grad3pxCss).toContain("border-style: solid !important;");
    expect(grad3pxCss).toContain("border-width: 3px !important;");

    // 3. Gradient border with blank borderWidth defaults to 1px (both layered and ::before mask)
    const gradBlankWidthLayered = makeCssRule(
      9,
      true,
      ".grad-default-1px",
      "#0F172A",
      "#FFFFFF",
      gradBorder,
      "12px",
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
        borderWidth: "",
        isMs: true,
      }
    );
    expect(gradBlankWidthLayered).toContain("border-width: 1px !important;");
    expect(gradBlankWidthLayered).toContain("border-style: solid !important;");

    const gradBlankWidthMask = makeCssRule(
      10,
      true,
      ".grad-mask-1px",
      "transparent",
      "#FFFFFF",
      gradBorder,
      "12px",
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
        borderWidth: "",
        isMs: true,
      }
    );
    expect(gradBlankWidthMask).toContain("padding: 1px !important;");

    // 4. Unset / Inherit emits ZERO border declarations
    const unsetCss = makeCssRule(
      11,
      true,
      ".inherit-plasmic-box",
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
      }
    );
    expect(unsetCss).not.toContain("border:");
    expect(unsetCss).not.toContain("border-width:");
    expect(unsetCss).not.toContain("border-style:");
    expect(unsetCss).not.toContain("border-color:");
  });

  it("exposes Theme Groups Inspector header and interactive Border None (0px), Width (0-16px), Style, and Reset controls across Default and Hover tabs", () => {
    const initial = buildInitialGroupsFromProps({}, "");
    initial.selectedId = 4;
    let latestJson = JSON.stringify(initial);
    const updateValue = vi.fn((next: string) => {
      latestJson = next;
    });

    const { rerender } = render(
      <EcmdDynamicGroupManagerControl
        value={latestJson}
        updateValue={updateValue}
        componentProps={{ presetTheme: "coastal-light", dynamicGroupsJson: latestJson }}
      />
    );

    // Open Theme Groups Inspector popup
    const openBtn = document.querySelector('button[title="Open Theme Groups Inspector"]') as HTMLButtonElement;
    expect(openBtn).not.toBeNull();
    act(() => {
      fireEvent.click(openBtn);
    });

    // Header reflects canonical official name "Theme Groups Inspector"
    expect(document.querySelector('[data-ecmd-groups-inspector-header="true"]')?.textContent).toContain(
      "Theme Groups Inspector"
    );

    // Helper to re-render with updated JSON
    const sync = () => {
      rerender(
        <EcmdDynamicGroupManagerControl
          value={latestJson}
          updateValue={updateValue}
          componentProps={{ presetTheme: "coastal-light", dynamicGroupsJson: latestJson }}
        />
      );
    };

    // 1. Click 1-click [🚫 None (0px)] pill on Default
    const noneBtn = document.querySelector('[data-ecmd-border-none-toggle="true"]') as HTMLButtonElement;
    expect(noneBtn).not.toBeNull();
    act(() => {
      fireEvent.click(noneBtn);
    });
    sync();
    let parsed = JSON.parse(latestJson);
    expect(parsed.groups["4"].borderMode).toBe("none");
    expect(parsed.groups["4"].borderNone).toBe(true);
    expect(parsed.groups["4"].borderWidth).toBe("0px");
    expect(parsed.groups["4"].borderStyle).toBe("none");

    // 2. Enter Width = 2 and Style = dashed
    const widthInput = document.querySelector('[data-ecmd-border-width-input="true"]') as HTMLInputElement;
    act(() => {
      fireEvent.change(widthInput, { target: { value: "2" } });
    });
    sync();
    const styleSelect = document.querySelector('[data-ecmd-border-style-select="true"]') as HTMLSelectElement;
    act(() => {
      fireEvent.change(styleSelect, { target: { value: "dashed" } });
    });
    sync();
    parsed = JSON.parse(latestJson);
    expect(parsed.groups["4"].borderMode).toBe("custom");
    expect(parsed.groups["4"].borderNone).toBe(false);
    expect(parsed.groups["4"].borderWidth).toBe("2px");
    expect(parsed.groups["4"].borderStyle).toBe("dashed");

    // 3. Entering 0 in Width automatically activates 0px none!
    act(() => {
      fireEvent.change(widthInput, { target: { value: "0" } });
    });
    sync();
    parsed = JSON.parse(latestJson);
    expect(parsed.groups["4"].borderMode).toBe("none");
    expect(parsed.groups["4"].borderNone).toBe(true);
    expect(parsed.groups["4"].borderWidth).toBe("0px");

    // 4. Click [↺] Reset button returns to Unset
    const resetBtn = document.querySelector('[data-ecmd-border-reset-btn="true"]') as HTMLButtonElement;
    act(() => {
      fireEvent.click(resetBtn);
    });
    sync();
    parsed = JSON.parse(latestJson);
    expect(parsed.groups["4"].borderMode).toBe("unset");
    expect(parsed.groups["4"].borderNone).toBe(false);
    expect(parsed.groups["4"].borderWidth).toBe("");
    expect(parsed.groups["4"].clBorder).toBe("");

    // 5. Switch to Hover state tab and toggle [🚫 None (0px)]
    const hoverTab = document.querySelector('[data-ecmd-state-tab="hover"]') as HTMLButtonElement;
    act(() => {
      fireEvent.click(hoverTab);
    });
    const hoverNoneBtn = document.querySelector('[data-ecmd-border-none-toggle="true"]') as HTMLButtonElement;
    act(() => {
      fireEvent.click(hoverNoneBtn);
    });
    sync();
    parsed = JSON.parse(latestJson);
    expect(parsed.groups["4"].stateOverrides.hover.borderMode).toBe("none");
    expect(parsed.groups["4"].stateOverrides.hover.borderNone).toBe(true);
    expect(parsed.groups["4"].stateOverrides.hover.borderWidth).toBe("0px");

    // Helper sanity checks
    expect(isZeroBorderWidthValue("0px")).toBe(true);
    expect(isZeroBorderWidthValue("0")).toBe(true);
    expect(isZeroBorderWidthValue("1px")).toBe(false);
    expect(parseBorderWidthNumericPx("4px")).toBe(4);
    expect(parseBorderWidthNumericPx("0 0 1px 0")).toBeNull();
    expect(resolveThemeBorderMode({ borderWidth: "0px" })).toBe("none");
    expect(resolveThemeBorderMode({})).toBe("unset");
  });
});
