import React, { useState } from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import {
  ECMD_LIVE_STATE_PREVIEW_STYLE_ID,
  copyImageGroupAttributes,
  copyThemeGroupAttributes,
  createThemeDesignToken,
  createThemeImageGroup,
  getThemeImageGroupVariant,
  setLiveStatePreview,
  updateThemeImageGroupVariant,
  type ThemeImageGroup,
} from "../lib/ecmdThemeEngine";
import {
  EcmdDynamicGroupManagerControl,
  buildInitialGroupsFromProps,
  type DynamicGroupItem,
  type DynamicGroupsPayload,
} from "../components/EcmdDynamicGroupManager";

describe("In-Group Copy Attributes From (Pure Engine + Groups & Images UI + Undo)", () => {
  beforeEach(() => {
    localStorage.clear();
    setLiveStatePreview(null);
  });

  it("copyThemeGroupAttributes transfers all 6 states, gradients, shadows, border 0px/widths, and tokenRefs while preserving target identity with deep-clone isolation", () => {
    const base = buildInitialGroupsFromProps({}, undefined);
    const source: DynamicGroupItem & { label?: string } = {
      ...base.groups["1"]!,
      id: 1,
      name: "Primary Emerald CTA",
      label: "Primary Emerald CTA",
      selector: ".ecmd-primary-cta",
      pinned: true,
      radius: "14px",
      borderMode: "none",
      borderNone: true,
      borderWidth: "0px",
      borderStyle: "none",
      fontWeight: "700",
      clBg: "linear-gradient(135deg, #059669 0%, #10B981 100%)",
      clText: "#FFFFFF",
      clBorder: "transparent",
      clOuterShadow: "0px 8px 20px rgba(16,185,129,0.35), 0px 2px 6px rgba(0,0,0,0.12)",
      clInnerShadow: "inset 0px 1px 2px rgba(255,255,255,0.4)",
      clTextShadow: {
        textShadowEnabled: true,
        textShadowX: 0,
        textShadowY: 1,
        textShadowBlur: 3,
        textShadowColor: "#000000",
        textShadowOpacity: 45,
        textShadowCustom: "",
      },
      msBg: "linear-gradient(135deg, #047857 0%, #0D9488 100%)",
      msText: "#ECFDF5",
      msOuterShadow: "0px 10px 28px rgba(0,0,0,0.65)",
      tokenRefs: {
        background: "tok-paint-emerald-luxe",
        boxShadow: "tok-box-shadow-hero",
      },
      disabledProps: { icon: true },
      stateOverrides: {
        hover: {
          cl: {
            bg: "#047857",
            text: "#F8FAFC",
            outerShadow: "0px 12px 28px rgba(16,185,129,0.5)",
          },
          ms: { bg: "#065F46", text: "#FFFFFF" },
          borderMode: "custom",
          borderNone: false,
          borderWidth: "2px",
          borderStyle: "solid",
          tokenRefs: { border: "tok-border-glow" },
        },
        focus: {
          cl: { border: "#34D399" },
          ms: { border: "#6EE7B7" },
          borderWidth: "2px",
        },
        selected: {
          cl: { bg: "#065F46", text: "#FFFFFF" },
          ms: { bg: "#0F766E", text: "#FFFFFF" },
          fontWeight: "700",
        },
        selectedHover: {
          cl: { bg: "#064E3B" },
          ms: { bg: "#115E59" },
        },
        disabled: {
          cl: { bg: "#94A3B8", text: "#E2E8F0" },
          ms: { bg: "#334155", text: "#94A3B8" },
          opacity: "45%",
          cursorNotAllowed: true,
        },
      },
    };

    const target: DynamicGroupItem & { label?: string } = {
      ...base.groups["2"]!,
      id: 2,
      name: "Secondary Outline Pill",
      label: "Secondary Outline Pill",
      selector: ".ecmd-secondary-pill",
      pinned: false,
      radius: "4px",
      borderMode: "custom",
      borderNone: false,
      borderWidth: "1px",
      borderStyle: "dashed",
      clBg: "#FFFFFF",
      clText: "#0F172A",
      msBg: "#111827",
      msText: "#E5E7EB",
      stateOverrides: {
        hover: {
          cl: { bg: "#F1F5F9" },
          ms: { bg: "#1F2937" },
        },
      },
    };

    const result = copyThemeGroupAttributes({
      themes: { "1": source, "2": target },
      activeThemeId: "cl",
      sourceGroupId: 1,
      targetGroupId: 2,
      scope: "activeThemeAllStates",
    });

    const updated = result["2"]!;
    // Identity & metadata strictly untouched
    expect(updated.id).toBe(2);
    expect(updated.name).toBe("Secondary Outline Pill");
    expect(updated.label).toBe("Secondary Outline Pill");
    expect(updated.selector).toBe(".ecmd-secondary-pill");
    expect(updated.pinned).toBe(false);

    // Active theme ("cl") + all 6 states + gradients + shadows + border 0px + tokenRefs copied
    expect(updated.clBg).toBe("linear-gradient(135deg, #059669 0%, #10B981 100%)");
    expect(updated.clOuterShadow).toBe(source.clOuterShadow);
    expect(updated.clInnerShadow).toBe(source.clInnerShadow);
    expect(updated.clTextShadow?.textShadowBlur).toBe(3);
    expect(updated.borderNone).toBe(true);
    expect(updated.borderWidth).toBe("0px");
    expect(updated.borderStyle).toBe("none");
    expect(updated.radius).toBe("14px");
    expect(updated.tokenRefs).toEqual({
      background: "tok-paint-emerald-luxe",
      boxShadow: "tok-box-shadow-hero",
    });
    expect(updated.stateOverrides?.hover?.cl?.bg).toBe("#047857");
    expect(updated.stateOverrides?.hover?.borderWidth).toBe("2px");
    expect(updated.stateOverrides?.hover?.tokenRefs).toEqual({ border: "tok-border-glow" });
    expect(updated.stateOverrides?.focus?.cl?.border).toBe("#34D399");
    expect(updated.stateOverrides?.selected?.cl?.bg).toBe("#065F46");
    expect(updated.stateOverrides?.selectedHover?.cl?.bg).toBe("#064E3B");
    expect(updated.stateOverrides?.disabled?.opacity).toBe("45%");
    expect(updated.stateOverrides?.disabled?.cursorNotAllowed).toBe(true);

    // Other theme ("ms") preserved untouched when scope === "activeThemeAllStates"
    expect(updated.msBg).toBe("#111827");
    expect(updated.msText).toBe("#E5E7EB");
    expect(updated.stateOverrides?.hover?.ms?.bg).toBe("#1F2937");

    // Deep-clone isolation: mutating target nested objects never mutates source!
    updated.tokenRefs!.background = "tok-mutated";
    updated.clTextShadow!.textShadowBlur = 19;
    updated.stateOverrides!.hover!.cl!.bg = "#000000";
    updated.stateOverrides!.hover!.tokenRefs!.border = "tok-mutated-border";

    expect(source.tokenRefs?.background).toBe("tok-paint-emerald-luxe");
    expect(source.clTextShadow?.textShadowBlur).toBe(3);
    expect(source.stateOverrides?.hover?.cl?.bg).toBe("#047857");
    expect(source.stateOverrides?.hover?.tokenRefs?.border).toBe("tok-border-glow");
  });

  it("supports activeThemeCurrentState (hover-only without overwriting default/other themes) and allThemesAllStates (both Light & Dark)", () => {
    const base = buildInitialGroupsFromProps({}, undefined);
    const source: DynamicGroupItem = {
      ...base.groups["1"]!,
      id: 1,
      name: "Glass Card",
      selector: ".glass-card",
      clBg: "#E0F2FE",
      msBg: "#0C4A6E",
      radius: "20px",
      stateOverrides: {
        hover: {
          cl: { bg: "#BAE6FD", text: "#0369A1" },
          ms: { bg: "#075985", text: "#E0F2FE" },
          borderWidth: "2px",
          tokenRefs: { boxShadow: "tok-hover-lift" },
        },
        selected: {
          cl: { bg: "#0284C7" },
          ms: { bg: "#38BDF8" },
        },
      },
    };
    const target: DynamicGroupItem = {
      ...base.groups["2"]!,
      id: 2,
      name: "Pricing Tile",
      selector: ".pricing-tile",
      clBg: "#FFFFFF",
      msBg: "#1E293B",
      radius: "8px",
      stateOverrides: {
        hover: {
          cl: { bg: "#F8FAFC" },
          ms: { bg: "#334155" },
        },
        selected: {
          cl: { bg: "#FEF3C7" },
          ms: { bg: "#78350F" },
        },
      },
    };

    // 1) activeThemeCurrentState ("hover" on "cl"): copies ONLY hover (cl), keeps default + selected + ms intact!
    const hoverOnly = copyThemeGroupAttributes({
      themes: { "1": source, "2": target },
      activeThemeId: "cl",
      sourceGroupId: 1,
      targetGroupId: 2,
      scope: "activeThemeCurrentState",
      stateKey: "hover",
    })["2"]!;

    expect(hoverOnly.clBg).toBe("#FFFFFF"); // default untouched
    expect(hoverOnly.msBg).toBe("#1E293B"); // dark default untouched
    expect(hoverOnly.radius).toBe("8px"); // default radius untouched
    expect(hoverOnly.stateOverrides?.hover?.cl?.bg).toBe("#BAE6FD"); // hover cl copied
    expect(hoverOnly.stateOverrides?.hover?.cl?.text).toBe("#0369A1");
    expect(hoverOnly.stateOverrides?.hover?.borderWidth).toBe("2px");
    expect(hoverOnly.stateOverrides?.hover?.tokenRefs?.boxShadow).toBe("tok-hover-lift");
    expect(hoverOnly.stateOverrides?.hover?.ms?.bg).toBe("#334155"); // hover ms untouched
    expect(hoverOnly.stateOverrides?.selected?.cl?.bg).toBe("#FEF3C7"); // selected untouched

    // 2) allThemesAllStates: copies BOTH cl & ms across ALL 6 states while preserving target identity
    const allThemes = copyThemeGroupAttributes({
      themes: { "1": source, "2": target },
      activeThemeId: "cl",
      sourceGroupId: 1,
      targetGroupId: 2,
      scope: "allThemesAllStates",
    })["2"]!;

    expect(allThemes.id).toBe(2);
    expect(allThemes.name).toBe("Pricing Tile");
    expect(allThemes.selector).toBe(".pricing-tile");
    expect(allThemes.clBg).toBe("#E0F2FE");
    expect(allThemes.msBg).toBe("#0C4A6E");
    expect(allThemes.radius).toBe("20px");
    expect(allThemes.stateOverrides?.hover?.cl?.bg).toBe("#BAE6FD");
    expect(allThemes.stateOverrides?.hover?.ms?.bg).toBe("#075985");
    expect(allThemes.stateOverrides?.selected?.cl?.bg).toBe("#0284C7");
    expect(allThemes.stateOverrides?.selected?.ms?.bg).toBe("#38BDF8");
  });

  it("copyImageGroupAttributes copies width/height/mobileWidth/objectFit with and without assetUrl across active or all themes", () => {
    let imgGroups: ThemeImageGroup[] = [];
    const src = createThemeImageGroup(imgGroups, "Header Wordmark", ".ecmd-img-header");
    imgGroups = [src];
    const tgt: ThemeImageGroup = {
      ...createThemeImageGroup(imgGroups, "Footer Crest", ".ecmd-img-footer"),
      pinned: true,
    };
    imgGroups = [src, tgt];

    imgGroups = updateThemeImageGroupVariant(imgGroups, src.id, "cl", {
      assetUrl: "https://cdn.example.com/header-light.svg",
      assetName: "header-light.svg",
      width: "240px",
      height: "64px",
      mobileWidth: "150px",
      mobileHeight: "40px",
      maxWidth: "100%",
      objectFit: "cover",
      objectPosition: "left center",
      opacity: 90,
    });
    imgGroups = updateThemeImageGroupVariant(imgGroups, src.id, "ms", {
      assetUrl: "https://cdn.example.com/header-dark.svg",
      assetName: "header-dark.svg",
      width: "260px",
      height: "70px",
      mobileWidth: "160px",
      objectFit: "scale-down",
      opacity: 85,
    });
    imgGroups = updateThemeImageGroupVariant(imgGroups, tgt.id, "cl", {
      assetUrl: "https://cdn.example.com/footer-light.png",
      assetName: "footer-light.png",
      width: "120px",
      height: "32px",
      objectFit: "contain",
    });
    imgGroups = updateThemeImageGroupVariant(imgGroups, tgt.id, "ms", {
      assetUrl: "https://cdn.example.com/footer-dark.png",
      assetName: "footer-dark.png",
      width: "110px",
      height: "30px",
      objectFit: "contain",
    });

    // 1) Sizing & Fit Only (includeAsset: false) on activeTheme ("cl")
    const sizingOnly = copyImageGroupAttributes({
      themes: imgGroups,
      activeThemeId: "cl",
      sourceImageGroupId: src.id,
      targetImageGroupId: tgt.id,
      scope: "activeTheme",
      includeAsset: false,
    });
    const tgtSizingOnly = sizingOnly.find((g) => g.id === tgt.id)!;
    expect(tgtSizingOnly.id).toBe(tgt.id);
    expect(tgtSizingOnly.label).toBe("Footer Crest");
    expect(tgtSizingOnly.selector).toBe(".ecmd-img-footer");
    expect(tgtSizingOnly.pinned).toBe(true);

    const clAfterSizing = getThemeImageGroupVariant(tgtSizingOnly, "cl");
    expect(clAfterSizing.width).toBe("240px");
    expect(clAfterSizing.height).toBe("64px");
    expect(clAfterSizing.mobileWidth).toBe("150px");
    expect(clAfterSizing.objectFit).toBe("cover");
    expect(clAfterSizing.opacity).toBe(90);
    // Target's own asset preserved!
    expect(clAfterSizing.assetUrl).toBe("https://cdn.example.com/footer-light.png");
    expect(clAfterSizing.assetName).toBe("footer-light.png");
    // Dark theme untouched!
    const msAfterSizing = getThemeImageGroupVariant(tgtSizingOnly, "ms");
    expect(msAfterSizing.width).toBe("110px");
    expect(msAfterSizing.assetUrl).toBe("https://cdn.example.com/footer-dark.png");

    // 2) Sizing + Image Asset (includeAsset: true) across allThemes
    const withAssetsAll = copyImageGroupAttributes({
      themes: imgGroups,
      activeThemeId: "cl",
      sourceImageGroupId: src.id,
      targetImageGroupId: tgt.id,
      scope: "allThemes",
      includeAsset: true,
    });
    const tgtAll = withAssetsAll.find((g) => g.id === tgt.id)!;
    const clAll = getThemeImageGroupVariant(tgtAll, "cl");
    const msAll = getThemeImageGroupVariant(tgtAll, "ms");
    expect(clAll.assetUrl).toBe("https://cdn.example.com/header-light.svg");
    expect(clAll.width).toBe("240px");
    expect(msAll.assetUrl).toBe("https://cdn.example.com/header-dark.svg");
    expect(msAll.width).toBe("260px");
    expect(msAll.objectFit).toBe("scale-down");

    // Deep-clone isolation
    tgtAll.themes["cl"]!.width = "999px";
    expect(getThemeImageGroupVariant(imgGroups[0]!, "cl").width).toBe("240px");
  });

  it("renders icon-free Copy Attributes From dropdown in Groups & Images with Live State Preview sync and 1-click Undo", () => {
    const base = buildInitialGroupsFromProps({}, undefined);
    const tok = createThemeDesignToken([], {
      name: "Emerald Hover Glow",
      type: "paint",
      value: "#047857",
    });

    const g1: DynamicGroupItem = {
      ...base.groups["1"]!,
      id: 1,
      name: "Alpha Source CTA",
      selector: ".alpha-source-cta",
      clBg: "#059669",
      clText: "#FFFFFF",
      radius: "16px",
      stateOverrides: {
        hover: {
          cl: { bg: "#047857", text: "#ECFDF5" },
          tokenRefs: { background: tok.id },
        },
      },
    };
    const g2: DynamicGroupItem = {
      ...base.groups["2"]!,
      id: 2,
      name: "Beta Target Button",
      selector: ".beta-target-btn",
      clBg: "#FFFFFF",
      clText: "#0F172A",
      radius: "6px",
      stateOverrides: {
        hover: {
          cl: { bg: "#E2E8F0", text: "#1E293B" },
        },
      },
    };

    let imgGroups: ThemeImageGroup[] = [];
    const imgSrc = createThemeImageGroup(imgGroups, "Alpha Hero Logo", ".ecmd-img-alpha");
    imgGroups = [imgSrc];
    const imgTgt = createThemeImageGroup(imgGroups, "Beta Footer Logo", ".ecmd-img-beta");
    imgGroups = [imgSrc, imgTgt];
    imgGroups = updateThemeImageGroupVariant(imgGroups, imgSrc.id, "cl", {
      assetUrl: "https://cdn.example.com/alpha.svg",
      assetName: "alpha.svg",
      width: "210px",
      objectFit: "cover",
    });
    imgGroups = updateThemeImageGroupVariant(imgGroups, imgTgt.id, "cl", {
      assetUrl: "https://cdn.example.com/beta.svg",
      assetName: "beta.svg",
      width: "90px",
      objectFit: "contain",
    });

    const payload: DynamicGroupsPayload = {
      selectedId: 2,
      multiIds: [1, 2],
      groups: { "1": g1, "2": g2 },
      imageGroups: imgGroups,
      designTokens: [tok],
    };

    let latestPayload = payload;
    function Harness() {
      const [json, setJson] = useState<string>(() => JSON.stringify(payload));
      return (
        <EcmdDynamicGroupManagerControl
          value={json}
          updateValue={(next: string) => {
            latestPayload = JSON.parse(next);
            setJson(next);
          }}
          componentProps={{ presetTheme: "coastal-light" }}
        />
      );
    }

    render(<Harness />);

    // Open Theme Groups Inspector
    act(() => {
      fireEvent.click(document.querySelector('button[title="Open Theme Groups Inspector"]')!);
    });

    // Verify tab headers are icon-free
    expect(document.querySelector('[data-ecmd-studio-tab="groups"]')?.textContent?.trim()).toBe("Groups");
    expect(document.querySelector('[data-ecmd-studio-tab="images"]')?.textContent?.trim()).toBe("Images (2)");
    expect(document.querySelector('[data-ecmd-studio-tab="tokens"]')?.textContent?.trim()).toBe("Tokens (1)");

    // Switch to Hover state so Live State Preview is active on canvas
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-state-tab="hover"]')!);
    });
    const previewBefore = document.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID)?.textContent || "";
    expect(previewBefore).toContain("#E2E8F0");

    // Open icon-free Copy Attributes From ▾ on Beta Target Button (#2)
    const triggerBtn = document.querySelector('[data-ecmd-copy-attrs-trigger="2"]') as HTMLButtonElement;
    expect(triggerBtn).not.toBeNull();
    expect(triggerBtn.textContent?.trim()).toBe("Copy Attributes From ▾");

    act(() => {
      fireEvent.click(triggerBtn);
    });

    // Menu shows 3 scope pills + excludes target group (#2) from source candidates
    expect(document.querySelector('[data-ecmd-copy-scope-pill="activeThemeAllStates"]')?.textContent).toBe("All States");
    expect(document.querySelector('[data-ecmd-copy-scope-pill="activeThemeCurrentState"]')?.textContent).toBe("This State (Hover)");
    expect(document.querySelector('[data-ecmd-copy-scope-pill="allThemesAllStates"]')?.textContent).toBe("All Themes");
    expect(document.querySelector('[data-ecmd-copy-source-option="2"]')).toBeNull();
    expect(document.querySelector('[data-ecmd-copy-source-option="1"]')).not.toBeNull();

    // Select Alpha Source CTA (#1)
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-copy-source-option="1"]')!);
    });

    // Target keeps its own name/selector while inheriting source styles + Live State Preview updates immediately!
    expect(latestPayload.groups["2"]?.name).toBe("Beta Target Button");
    expect(latestPayload.groups["2"]?.selector).toBe(".beta-target-btn");
    expect(latestPayload.groups["2"]?.clBg).toBe("#059669");
    expect(latestPayload.groups["2"]?.radius).toBe("16px");
    const previewAfterCopy = document.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID)?.textContent || "";
    expect(previewAfterCopy).toContain("#047857");

    // Temporary inline confirmation bar + 1-click Undo restores pre-copy snapshot & Live State Preview
    const toast = document.querySelector('[data-ecmd-copy-attrs-toast="2"]');
    expect(toast?.textContent).toContain("Copied from Alpha Source CTA");
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-copy-attrs-undo="2"]')!);
    });
    expect(latestPayload.groups["2"]?.clBg).toBe("#FFFFFF");
    expect(latestPayload.groups["2"]?.radius).toBe("6px");
    const previewAfterUndo = document.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID)?.textContent || "";
    expect(previewAfterUndo).toContain("#E2E8F0");

    // Mirror check inside Images tab
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-studio-tab="images"]')!);
    });
    const imgTrigger = document.querySelector(
      `[data-ecmd-copy-image-attrs-trigger="${imgTgt.id}"]`
    ) as HTMLButtonElement;
    expect(imgTrigger).not.toBeNull();
    expect(imgTrigger.textContent?.trim()).toBe("Copy Attributes From ▾");

    act(() => {
      fireEvent.click(imgTrigger);
    });
    expect(document.querySelector('[data-ecmd-copy-image-mode-btn="sizing"]')?.textContent).toBe("Sizing & Fit Only");
    expect(document.querySelector('[data-ecmd-copy-image-mode-btn="asset"]')?.textContent).toBe("Sizing + Image Asset");

    act(() => {
      fireEvent.click(document.querySelector(`[data-ecmd-copy-image-source-option="${imgSrc.id}"]`)!);
    });

    const updatedBetaImg = latestPayload.imageGroups?.find((g) => g.id === imgTgt.id)!;
    expect(updatedBetaImg.label).toBe("Beta Footer Logo");
    expect(updatedBetaImg.selector).toBe(".ecmd-img-beta");
    expect(getThemeImageGroupVariant(updatedBetaImg, "cl").width).toBe("210px");
    expect(getThemeImageGroupVariant(updatedBetaImg, "cl").objectFit).toBe("cover");
    // Sizing & Fit Only kept Beta's original asset URL intact!
    expect(getThemeImageGroupVariant(updatedBetaImg, "cl").assetUrl).toBe("https://cdn.example.com/beta.svg");

    // 1-click Undo on Images tab restores 90px width
    act(() => {
      fireEvent.click(document.querySelector(`[data-ecmd-copy-image-attrs-undo="${imgTgt.id}"]`)!);
    });
    const undoneBetaImg = latestPayload.imageGroups?.find((g) => g.id === imgTgt.id)!;
    expect(getThemeImageGroupVariant(undoneBetaImg, "cl").width).toBe("90px");
  });
});
