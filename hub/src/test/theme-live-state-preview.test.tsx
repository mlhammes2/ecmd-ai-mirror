import React, { useState } from "react";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import {
  ECMD_DYNAMIC_STYLES_ID,
  ECMD_LIVE_STATE_PREVIEW_STYLE_ID,
  compileGroupStatePreviewCss,
  createThemeDesignToken,
  setLiveStatePreview,
  updateThemeDesignTokenValue,
  type ThemeDesignToken,
} from "../lib/ecmdThemeEngine";
import {
  EcmdDynamicGroupManagerControl,
  bindTokenToGroupState,
  buildInitialGroupsFromProps,
  type DynamicGroupItem,
  type DynamicGroupsPayload,
} from "../components/EcmdDynamicGroupManager";

describe("Theme Groups Inspector — Live Canvas State Preview (`#ecmd-theme-live-state-preview`)", () => {
  beforeEach(() => {
    localStorage.clear();
    setLiveStatePreview(null);
    document.head.innerHTML = "";
  });

  afterEach(() => {
    setLiveStatePreview(null);
  });

  it("compiles merged Default + State CSS (Hover, Focus, Selected+Hover, Disabled) onto base selectors without pseudo-classes, including Solid<->Gradient, Border 0px, Shadows, and linked Design Tokens", () => {
    const gradPaint = "linear-gradient(135deg, #059669 0%, #0EA5E9 100%)";
    const hoverShadowLight = "0px 10px 24px -4px rgba(15,23,42,0.28)";
    const hoverShadowDark = "0px 16px 36px -4px rgba(0,0,0,0.72)";

    let tokens: ThemeDesignToken[] = [
      createThemeDesignToken([], {
        name: "Hover Lift Token",
        type: "boxShadow",
        value: { css: hoverShadowLight },
      }),
      createThemeDesignToken([], {
        name: "Hover Glow Text",
        type: "textShadow",
        value: {
          textShadowEnabled: true,
          textShadowX: 0,
          textShadowY: 2,
          textShadowBlur: 6,
          textShadowColor: "#10B981",
          textShadowOpacity: 60,
          textShadowCustom: "",
        },
      }),
      createThemeDesignToken([], {
        name: "Ocean Gradient Paint",
        type: "paint",
        value: gradPaint,
      }),
    ];
    const shadowTokId = tokens[0]!.id;
    const textShadowTokId = tokens[1]!.id;
    const paintTokId = tokens[2]!.id;

    // Add per-theme dark override to the boxShadow token
    tokens = updateThemeDesignTokenValue(
      tokens,
      shadowTokId,
      { css: hoverShadowDark },
      { scope: "theme", themeId: "midnight-slate" }
    );

    const payload = buildInitialGroupsFromProps({}, undefined);
    // Group 6 (Filled Button): Default has solid bg & 2px border; Hover switches to Gradient Paint token, 0px border, BoxShadow token, TextShadow token
    let g6: DynamicGroupItem = {
      ...payload.groups["6"]!,
      clBg: "#0B57D0",
      clText: "#FFFFFF",
      clBorder: "#0EA5E9",
      borderWidth: "2px",
      borderStyle: "solid" as const,
      stateOverrides: {
        ...payload.groups["6"]!.stateOverrides,
        hover: {
          borderMode: "none" as const,
          borderNone: true,
          borderWidth: "0px",
          cl: {
            text: "#F8FAFC",
          },
        },
        focus: {
          cl: {
            border: "#10B981",
          },
          borderWidth: "2px",
        },
        selected: {
          cl: {
            bg: "#047857",
            text: "#ECFDF5",
          },
        },
        selectedHover: {
          cl: {
            border: "#34D399",
            outerShadow: "0px 12px 28px 0px rgba(16,185,129,0.40)",
          },
        },
        disabled: {
          opacity: "45%",
          cursorNotAllowed: true,
          cl: {
            bg: "#94A3B8",
          },
        },
      },
    };
    g6 = bindTokenToGroupState(g6, "hover", "background", paintTokId);
    g6 = bindTokenToGroupState(g6, "hover", "boxShadow", shadowTokId);
    g6 = bindTokenToGroupState(g6, "hover", "textShadow", textShadowTokId);

    // 1. Default returns empty string
    expect(compileGroupStatePreviewCss(g6, "default", "cl", tokens)).toBe("");

    // 2. Hover: Solid -> Gradient Paint token, Border 0px, Light BoxShadow token, TextShadow token, NO :hover
    const hoverLightCss = compileGroupStatePreviewCss(g6, "hover", "cl", tokens);
    expect(hoverLightCss).toContain(".gm-btn-filled:not(#ecmd_preview_none)");
    expect(hoverLightCss).not.toContain(":hover");
    expect(hoverLightCss).toContain(`background-image: ${gradPaint} !important;`);
    expect(hoverLightCss).toContain("background-color: transparent !important;");
    expect(hoverLightCss).toContain("border: 0px none transparent !important;");
    expect(hoverLightCss).toContain("border-width: 0px !important;");
    expect(hoverLightCss).toContain("border-style: none !important;");
    expect(hoverLightCss).toContain(`box-shadow: ${hoverShadowLight} !important;`);
    expect(hoverLightCss).toContain("text-shadow: 0px 2px 6px rgba(16, 185, 129, 0.6) !important;");
    expect(hoverLightCss).toContain(".gm-btn-filled:not(#ecmd_preview_none) *");

    // Dark theme resolves themeOverrides on the linked token!
    const hoverDarkCss = compileGroupStatePreviewCss(g6, "hover", "ms", tokens);
    expect(hoverDarkCss).toContain(`box-shadow: ${hoverShadowDark} !important;`);

    // 3. Gradient -> Solid Hover transition emits background-image: none !important
    const gradDefaultGroup = {
      ...payload.groups["4"]!,
      clBg: gradPaint,
      stateOverrides: {
        hover: {
          cl: { bg: "#0F766E" },
        },
      },
    };
    const gradToSolidHoverCss = compileGroupStatePreviewCss(gradDefaultGroup, "hover", "cl", tokens);
    expect(gradToSolidHoverCss).toContain("background-image: none !important;");
    expect(gradToSolidHoverCss).toContain("background-color: #0F766E !important;");

    // 4. Selected + Hover cascades Default -> Selected -> Sel+Hover
    const selHoverCss = compileGroupStatePreviewCss(g6, "selectedHover", "cl", tokens);
    expect(selHoverCss).not.toContain(":hover");
    expect(selHoverCss).not.toContain("data-ecmd-selected");
    expect(selHoverCss).toContain("background-color: #047857 !important;");
    expect(selHoverCss).toContain("color: #ECFDF5 !important;");
    expect(selHoverCss).toContain("border-color: #34D399 !important;");
    expect(selHoverCss).toContain("box-shadow: 0px 12px 28px 0px rgba(16,185,129,0.40) !important;");

    // 5. Focus emits focus ring outline directly without :focus
    const focusCss = compileGroupStatePreviewCss(g6, "focus", "cl", tokens);
    expect(focusCss).not.toContain(":focus");
    expect(focusCss).toContain("border-color: #10B981 !important;");
    expect(focusCss).toContain("outline: 2px solid #10B981 !important;");

    // 6. Disabled emits opacity & cursor: not-allowed directly without :disabled
    const disabledCss = compileGroupStatePreviewCss(g6, "disabled", "cl", tokens);
    expect(disabledCss).not.toContain(":disabled");
    expect(disabledCss).toContain("background-color: #94A3B8 !important;");
    expect(disabledCss).toContain("opacity: 0.45 !important;");
    expect(disabledCss).toContain("cursor: not-allowed !important;");
  });

  it("injects #ecmd-theme-live-state-preview into document.head directly AFTER #ecmd-theme-dynamic-styles and removes it cleanly on null or default", () => {
    const dyn = document.createElement("style");
    dyn.id = ECMD_DYNAMIC_STYLES_ID;
    dyn.textContent = ".gm-btn-filled { background-color: #0B57D0 !important; }";
    document.head.appendChild(dyn);

    const payload = buildInitialGroupsFromProps({}, undefined);
    const g6 = payload.groups["6"]!;

    setLiveStatePreview({
      groupId: "6",
      selector: g6.selector,
      stateKey: "hover",
      group: g6,
      activeTheme: "cl",
      designTokens: [],
    });

    const previewEl = document.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID);
    expect(previewEl).not.toBeNull();
    expect(previewEl?.parentNode).toBe(document.head);
    expect(dyn.nextSibling).toBe(previewEl);
    expect(previewEl?.getAttribute("data-ecmd-preview-state")).toBe("hover");
    expect(previewEl?.textContent).toContain("background-color: #0842A0 !important;");
    expect(previewEl?.textContent).not.toContain(":hover");

    // Switching back to "default" immediately removes the transient style tag
    setLiveStatePreview({
      groupId: "6",
      selector: g6.selector,
      stateKey: "default",
      group: g6,
      activeTheme: "cl",
      designTokens: [],
    });
    expect(document.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID)).toBeNull();

    // Re-inject then clear with null
    setLiveStatePreview({
      groupId: "6",
      selector: g6.selector,
      stateKey: "hover",
      group: g6,
      activeTheme: "cl",
      designTokens: [],
    });
    expect(document.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID)).not.toBeNull();
    setLiveStatePreview(null);
    expect(document.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID)).toBeNull();
  });

  it("wires automatic live canvas preview + [👁️ Showing <State> on Canvas] toggle into Theme Groups Inspector and cleans up on Default, toggle OFF, tab switch, close, or unmount without mutating persisted theme data", () => {
    const initialPayload = buildInitialGroupsFromProps({}, undefined);
    const initialSerialized = JSON.stringify(initialPayload);

    function InspectorHarness() {
      const [json, setJson] = useState<string>(initialSerialized);
      return (
        <div>
          <EcmdDynamicGroupManagerControl
            value={json}
            updateValue={setJson}
            componentProps={{ presetTheme: "coastal-light" }}
          />
          <output data-testid="persisted-json">{json}</output>
        </div>
      );
    }

    const { getByTestId, unmount } = render(<InspectorHarness />);

    // Open Theme Groups Inspector popup
    act(() => {
      fireEvent.click(document.querySelector('button[title="Open Theme Groups Inspector"]')!);
    });

    // On Default tab -> no preview style tag injected
    expect(document.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID)).toBeNull();

    // Select Group 6 (Filled Button) so Hover has preset overrides
    const groupSelect = Array.from(document.querySelectorAll("select")).find((sel) =>
      Array.from(sel.options).some((opt) => opt.value === "6")
    ) as HTMLSelectElement;
    expect(groupSelect).toBeTruthy();
    act(() => {
      fireEvent.change(groupSelect, { target: { value: "6" } });
    });

    // Click Hover state tab -> live preview activates automatically and shows pill!
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-state-tab="hover"]')!);
    });

    const togglePill = document.querySelector('[data-ecmd-live-state-preview-toggle="true"]');
    expect(togglePill).not.toBeNull();
    expect(togglePill?.textContent).toContain("👁️ Showing Hover on Canvas");
    expect(togglePill?.getAttribute("data-ecmd-live-preview-active")).toBe("true");

    const previewTag = document.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID);
    expect(previewTag).not.toBeNull();
    expect(previewTag?.textContent).toContain(".gm-btn-filled:not(#ecmd_preview_none)");
    expect(previewTag?.textContent).toContain("background-color: #0842A0 !important;");

    // Persisted JSON has ZERO transient preview properties mutated into it
    const parsedBeforeToggle = JSON.parse(
      getByTestId("persisted-json").textContent || "{}"
    ) as DynamicGroupsPayload;
    expect(parsedBeforeToggle.groups["6"]?.clHoverBg).toBe("#0842A0");
    expect("liveStatePreview" in parsedBeforeToggle).toBe(false);

    // Toggle Live Preview OFF -> style tag immediately removed, pill updates
    act(() => {
      fireEvent.click(togglePill!);
    });
    expect(document.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID)).toBeNull();
    expect(
      document.querySelector('[data-ecmd-live-state-preview-toggle="true"]')?.getAttribute(
        "data-ecmd-live-preview-active"
      )
    ).toBe("false");

    // Toggle Live Preview back ON -> style tag immediately restored
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-live-state-preview-toggle="true"]')!);
    });
    expect(document.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID)).not.toBeNull();

    // Switch to Sel+Hover tab -> pill updates to Showing Sel+Hover on Canvas
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-state-tab="selectedHover"]')!);
    });
    expect(
      document.querySelector('[data-ecmd-live-state-preview-toggle="true"]')?.textContent
    ).toContain("👁️ Showing Sel+Hover on Canvas");
    expect(
      document.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID)?.getAttribute("data-ecmd-preview-state")
    ).toBe("selectedHover");

    // Live edit inside Hover tab (toggle Border -> 0px None) updates preview tag immediately!
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-state-tab="hover"]')!);
    });
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-border-none-toggle="true"]')!);
    });
    expect(document.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID)?.textContent).toContain(
      "border: 0px none transparent !important;"
    );

    // Switching away from 📂 Groups to 🔖 Tokens clears live preview immediately
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-studio-tab="tokens"]')!);
    });
    expect(document.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID)).toBeNull();

    // Switching back to 📂 Groups restores Hover preview, closing popup (✕) clears it
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-studio-tab="groups"]')!);
    });
    expect(document.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID)).not.toBeNull();

    const closeBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "✕"
    );
    expect(closeBtn).toBeTruthy();
    act(() => {
      fireEvent.click(closeBtn!);
    });
    expect(document.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID)).toBeNull();

    // Re-open, switch to Default -> still null, then activate Disabled and unmount -> MUST clear with zero leftovers!
    act(() => {
      fireEvent.click(document.querySelector('button[title="Open Theme Groups Inspector"]')!);
    });
    expect(document.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID)).not.toBeNull();

    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-state-tab="default"]')!);
    });
    expect(document.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID)).toBeNull();

    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-state-tab="disabled"]')!);
    });
    expect(document.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID)).not.toBeNull();

    unmount();
    expect(document.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID)).toBeNull();
  });
});
