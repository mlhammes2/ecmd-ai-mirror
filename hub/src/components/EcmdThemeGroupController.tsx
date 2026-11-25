import {
  buildInitialGroupsFromProps,
  resolveGroupPrimaryClass,
  hydrateLegacyStateOverrides,
  type GroupStateOverride,
  type SubGroupStateKey,
  type ThemeGroupBreakpointTarget,
  type GroupFluidScaleConfig
} from "./EcmdDynamicGroupManager";
import { EcmdAttributeProfilesModal } from "./EcmdAttributeProfilesModal";
import { resolveCombinedBoxShadow } from "./EcmdPlasmicColorRow";
import {
  buildGradientAwareStateCss,
  buildTextShadowCssValue,
  buildThemeDesignTokensRootCss,
  buildThemeImageGroupsCss,
  compileDesignTokenCssValue,
  extractTextShadowConfig,
  findDesignTokenById,
  hasExplicitTextShadowFields,
  isCssGradientValue,
  isZeroBorderWidthValue,
  normalizeBorderStyleValue,
  observeThemeImageGroups,
  resolveDesignTokenBorderConfig,
  resolveDesignTokenTextShadowConfig,
  type ThemeBorderMode,
  type ThemeBorderStyle,
  type ThemeDesignToken,
  type ThemeStateTokenRefs,
  type ThemeTextShadowConfig
} from "../lib/ecmdThemeEngine";
import { detectEcmdDeviceProfile, applyDeviceAttributesToDom } from "../utils/ecmdDeviceEnv";
import type { ToggleFlagsState } from "./EcmdSpacingBoxControl";
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { usePlasmicCanvasContext } from "@plasmicapp/host";

export type PresetTheme = "custom" | "emerald-dark" | "coastal-light" | "midnight-slate";

export interface EcmdThemeGroupControllerProps {
  className?: string;
  presetTheme?: PresetTheme;
  activeEditorGroup?: string;
  cardThemeGroup?: string;
  triggerThemeGroup?: string;
  trigger?: React.ReactNode;
  children?: React.ReactNode;
  dynamicGroupsJson?: string;
  openAttributeProfilesModal?: boolean;
  matchSystemTheme?: boolean;
  toggleFlags?: ToggleFlagsState | string;
  open?: boolean;
  defaultOpen?: boolean;
  enableLiveDropdown?: boolean;
  cardWidth?: string;
  offsetY?: number;
  align?: "left" | "right" | "center";
  fixedBreakout?: boolean;
  maskClosable?: boolean;
  closeOnSelect?: boolean;
  persistUserChoice?: boolean;
  smoothTransition?: boolean;
  hideTrigger?: boolean;
  showHelperBadgeInStudio?: boolean;
  showGroupLegendInStudio?: boolean;
  showSwatchPreview?: boolean;
  buttonLabel?: string;
  showActiveThemeInLabel?: boolean;
  syncTriggerDotWithTheme?: boolean;
  triggerClassName?: string;
  dropdownCardClassName?: string;
  highlightActiveRow?: boolean;
  activeRowSelector?: string;
  activeRowBg?: string;
  activeRowText?: string;
  cl_activeRowBg?: string;
  cl_activeRowText?: string;
  ms_activeRowBg?: string;
  ms_activeRowText?: string;
  onThemeChange?: (theme: string) => void;
  onOpenChange?: (open: boolean) => void;
  enableGroup1?: boolean; group1Name?: string; group1Selector?: string; group1Radius?: string;
  enableGroup2?: boolean; group2Name?: string; group2Selector?: string; group2Radius?: string;
  enableGroup3?: boolean; group3Name?: string; group3Selector?: string; group3Radius?: string;
  enableGroup4?: boolean; group4Name?: string; group4Selector?: string; group4Radius?: string;
  enableGroup5?: boolean; group5Name?: string; group5Selector?: string; group5Radius?: string;
  enableGroup6?: boolean; group6Name?: string; group6Selector?: string; group6Radius?: string;
  enableGroup7?: boolean; group7Name?: string; group7Selector?: string; group7Radius?: string;
  enableGroup8?: boolean; group8Name?: string; group8Selector?: string; group8Radius?: string;
  group1Spacing?: boolean; group1Padding?: string; group1Margin?: string; group1Gap?: string;
  group2Spacing?: boolean; group2Padding?: string; group2Margin?: string; group2Gap?: string;
  group3Spacing?: boolean; group3Padding?: string; group3Margin?: string; group3Gap?: string;
  group4Spacing?: boolean; group4Padding?: string; group4Margin?: string; group4Gap?: string;
  group5Spacing?: boolean; group5Padding?: string; group5Margin?: string; group5Gap?: string;
  group6Spacing?: boolean; group6Padding?: string; group6Margin?: string; group6Gap?: string;
  group7Spacing?: boolean; group7Padding?: string; group7Margin?: string; group7Gap?: string;
  group8Spacing?: boolean; group8Padding?: string; group8Margin?: string; group8Gap?: string;
  cl_g1Bg?: string; cl_g1Text?: string; cl_g1Border?: string;
  cl_g2Bg?: string; cl_g2Text?: string; cl_g2Border?: string;
  cl_g3Bg?: string; cl_g3Text?: string; cl_g3Border?: string;
  cl_g4Bg?: string; cl_g4Text?: string; cl_g4Border?: string;
  cl_g5Bg?: string; cl_g5Text?: string; cl_g5Border?: string;
  cl_g6Bg?: string; cl_g6Text?: string; cl_g6Border?: string;
  cl_g7Bg?: string; cl_g7Text?: string; cl_g7Border?: string;
  cl_g8Bg?: string; cl_g8Text?: string; cl_g8Border?: string;
  ms_g1Bg?: string; ms_g1Text?: string; ms_g1Border?: string;
  ms_g2Bg?: string; ms_g2Text?: string; ms_g2Border?: string;
  ms_g3Bg?: string; ms_g3Text?: string; ms_g3Border?: string;
  ms_g4Bg?: string; ms_g4Text?: string; ms_g4Border?: string;
  ms_g5Bg?: string; ms_g5Text?: string; ms_g5Border?: string;
  ms_g6Bg?: string; ms_g6Text?: string; ms_g6Border?: string;
  ms_g7Bg?: string; ms_g7Text?: string; ms_g7Border?: string;
  ms_g8Bg?: string; ms_g8Text?: string; ms_g8Border?: string;
  group1RecolorImgIcons?: boolean; cl_g1Icon?: string; ms_g1Icon?: string;
  group2RecolorImgIcons?: boolean; cl_g2Icon?: string; ms_g2Icon?: string;
  group3RecolorImgIcons?: boolean; cl_g3Icon?: string; ms_g3Icon?: string;
  group4RecolorImgIcons?: boolean; cl_g4Icon?: string; ms_g4Icon?: string;
  group5RecolorImgIcons?: boolean; cl_g5Icon?: string; ms_g5Icon?: string;
  group6RecolorImgIcons?: boolean; cl_g6Icon?: string; ms_g6Icon?: string;
  group7RecolorImgIcons?: boolean; cl_g7Icon?: string; ms_g7Icon?: string;
  group8RecolorImgIcons?: boolean; cl_g8Icon?: string; ms_g8Icon?: string;
  group1ExcludeIcons?: string;
  group2ExcludeIcons?: string;
  group3ExcludeIcons?: string;
  group4ExcludeIcons?: string;
  group5ExcludeIcons?: string;
  group6ExcludeIcons?: string;
  group7ExcludeIcons?: string;
  group8ExcludeIcons?: string;
  cl_g1SelBg?: string; cl_g1SelText?: string; ms_g1SelBg?: string; ms_g1SelText?: string;
  cl_g2SelBg?: string; cl_g2SelText?: string; ms_g2SelBg?: string; ms_g2SelText?: string;
  cl_g3SelBg?: string; cl_g3SelText?: string; ms_g3SelBg?: string; ms_g3SelText?: string;
  cl_g4SelBg?: string; cl_g4SelText?: string; ms_g4SelBg?: string; ms_g4SelText?: string;
  cl_g5SelBg?: string; cl_g5SelText?: string; ms_g5SelBg?: string; ms_g5SelText?: string;
  cl_g6SelBg?: string; cl_g6SelText?: string; ms_g6SelBg?: string; ms_g6SelText?: string;
  cl_g7SelBg?: string; cl_g7SelText?: string; ms_g7SelBg?: string; ms_g7SelText?: string;
  cl_g8SelBg?: string; cl_g8SelText?: string; ms_g8SelBg?: string; ms_g8SelText?: string;
}

const STORAGE_KEY = "ecmd_site_active_theme";

function parseSelectorTokens(rawSel?: string): string[] {

  return (rawSel || "")
    .replace(", #ecmd-auth-modal", "")
    .replace("#ecmd-auth-modal,", "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith(".") || s.startsWith("#") || s.startsWith("[") ? s : "." + s));
}

function normalizeSelectorList(groupNum: number, rawSel?: string): string {
  const parts = parseSelectorTokens(rawSel);
  const expanded: string[] = [".ecmd-group-" + groupNum];
  parts.forEach((p) => {
    expanded.push(p);
    const lower = p.toLowerCase();
    if (lower !== p) expanded.push(lower);
  });
  return Array.from(new Set(expanded)).join(", ");
}

function extractClassNamesFromSelector(rawSel?: string): string {
  return parseSelectorTokens(rawSel)
    .filter((t) => t.startsWith(".") && !t.includes(" ") && !t.includes(">") && !t.includes(":"))
    .map((t) => t.slice(1))
    .join(" ");
}

function buildExcludeIconGuard(rawExcl?: string): string {
  const baseGuards = [
    ":not([data-ecmd-brand-asset=\"true\"])",
    ":not([data-ecmd-brand-asset=\"true\"] *)",
    ":not(.ecmd-brand-asset)",
    ":not(.keep-icon-color)",
    ":not(.keep-icon-color *)"
  ];
  const tokens = (rawExcl || "").split(",").map((s) => s.trim()).filter(Boolean);
  tokens.forEach((tok) => {
    if (tok.startsWith(".") || tok.startsWith("#") || tok.startsWith("[")) {
      baseGuards.push(":not(" + tok + ")", ":not(" + tok + " *)");
    } else {
      const cleanName = tok.replace(/\.(svg|png|webp)$/i, "");
      baseGuards.push(
        ":not(#" + cleanName + ")",
        ":not(#" + cleanName + " *)",
        ":not(." + cleanName + ")",
        ":not(." + cleanName + " *)",
        ":not([src*=\"" + cleanName + "\"])",
        ":not([alt*=\"" + cleanName + "\"])"
      );
    }
  });
  return baseGuards.join("");
}
function isLightColor(col?: string): boolean {
  const c = (col || "").trim();
  const hex = c.replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
    const g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
    const b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 155;
  }
  if (/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 155;
  }
  return /white|#fff|#f8fafc|#f1f5f9|#e2e8f0/i.test(c);
}
function normCssVal(raw?: string): string {
  return (raw || "").trim();
}

const NOT_DISABLED_GUARD =
  ":not(:disabled):not([disabled]):not([aria-disabled=\"true\"]):not([data-disabled=\"true\"])";
const NOT_SELECTED_GUARD =
  ":not([data-ecmd-selected=\"true\"]):not([aria-selected=\"true\"]):not([aria-pressed=\"true\"]):not(.is-selected)";

function parseOpacityCss(raw?: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  if (s.endsWith("%")) {
    const n = parseFloat(s.slice(0, -1));
    if (!Number.isFinite(n)) return "";
    return String(Math.max(0, Math.min(1, Math.round(n) / 100)));
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return "";
  if (n > 1) return String(Math.max(0, Math.min(1, Math.round(n) / 100)));
  return String(Math.max(0, Math.min(1, n)));
}

function parseFiniteNonNegPx(raw?: string | number | null): number | null {
  if (raw === undefined || raw === null) return null;
  const str = String(raw).trim().replace(/px$/i, "");
  if (!str) return null;
  const n = Number(str);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Generates a smooth CSS clamp() expression linearly interpolated between
 * 375px Mobile and 1440px Desktop viewports.
 */
export function buildFluidClampCss(
  mobilePxRaw?: string | number | null,
  desktopPxRaw?: string | number | null,
  minVw = 375,
  maxVw = 1440
): string {
  const mob = parseFiniteNonNegPx(mobilePxRaw);
  const desk = parseFiniteNonNegPx(desktopPxRaw);
  if (mob === null && desk === null) return "";
  if (mob === null && desk !== null) return `${desk}px`;
  if (mob !== null && desk === null) return `${mob}px`;
  const m = mob as number;
  const d = desk as number;
  if (m === d) return `${d}px`;

  const minVal = Math.min(m, d);
  const maxVal = Math.max(m, d);
  const span = Math.max(1, maxVw - minVw);
  const slopeVw = Number((((d - m) / span) * 100).toFixed(4));
  const interceptPx = Number((m - (d - m) * (minVw / span)).toFixed(2));
  const preferred =
    interceptPx >= 0
      ? `calc(${interceptPx}px + ${slopeVw}vw)`
      : `calc(${slopeVw}vw - ${Math.abs(interceptPx)}px)`;
  return `clamp(${minVal}px, ${preferred}, ${maxVal}px)`;
}

export function wrapCssWithBreakpointMedia(
  css: string,
  breakpointTarget?: ThemeGroupBreakpointTarget
): string {
  const trimmed = css.trim();
  if (!trimmed) return "";
  if (breakpointTarget === "desktop") {
    return `@media (min-width: 1025px) {\n${trimmed}\n}`;
  }
  if (breakpointTarget === "tablet") {
    return `@media (min-width: 768px) and (max-width: 1024px) {\n${trimmed}\n}`;
  }
  if (breakpointTarget === "mobile") {
    return `@media (max-width: 767px) {\n${trimmed}\n}`;
  }
  return trimmed;
}

export function makeCssRule(
  groupNum: number,
  enabled: boolean | undefined,
  sel: string | undefined,
  bg?: string,
  txt?: string,
  brd?: string,
  rad?: string,
  useSpacing?: boolean,
  pad?: string,
  mar?: string,
  gap?: string,
  ico?: string,
  _recolorImg?: boolean,
  _excludeIcons?: string,
  selBg?: string,
  selTxt?: string,
  extraM3?: {
    borderMode?: ThemeBorderMode | undefined;
    borderNone?: boolean | undefined;
    borderWidth?: string | undefined;
    borderStyle?: ThemeBorderStyle | undefined;
    fontWeight?: string | undefined;
    hoverBg?: string | undefined;
    hoverText?: string | undefined;
    focusBorder?: string | undefined;
    shadow?: string | undefined;
    elevation?: string | undefined;
    outerShadow?: string | undefined;
    innerShadow?: string | undefined;
    textShadow?: ThemeTextShadowConfig | undefined;
    textShadowEnabled?: boolean | undefined;
    textShadowX?: number | undefined;
    textShadowY?: number | undefined;
    textShadowBlur?: number | undefined;
    textShadowColor?: string | undefined;
    textShadowOpacity?: number | undefined;
    textShadowCustom?: string | undefined;
    disabledProps?: Record<string, boolean> | undefined;
    stateOverrides?: Partial<Record<SubGroupStateKey, GroupStateOverride>> | undefined;
    breakpointTarget?: ThemeGroupBreakpointTarget | undefined;
    fluidScale?: GroupFluidScaleConfig | undefined;
    tokenRefs?: ThemeStateTokenRefs | undefined;
    designTokens?: ThemeDesignToken[] | undefined;
    activeThemeId?: string | undefined;
    isMs?: boolean | undefined;
  }
): string {
  if (enabled === false) return "";
  const disabled = extraM3?.disabledProps;
  const isOff = (key: string): boolean => Boolean(disabled?.[key]);
  const fullSel = normalizeSelectorList(groupNum, sel);
  const baseTokens = fullSel.split(",").map((s) => s.trim()).filter(Boolean);
  const rules: string[] = [];
  const designTokens = extraM3?.designTokens || [];
  const activeThemeId = extraM3?.activeThemeId || (extraM3?.isMs ? "ms" : "cl");
  const defRefs = extraM3?.tokenRefs;

  // Resolve Default state token bindings with safe fallback to literal values
  const defBgTok = findDesignTokenById(designTokens, defRefs?.background);
  const defTxtTok = findDesignTokenById(designTokens, defRefs?.text);
  const defBrdTok = findDesignTokenById(designTokens, defRefs?.border);
  const defBrdTokCfg = resolveDesignTokenBorderConfig(defBrdTok, activeThemeId);
  const defRadTok = findDesignTokenById(designTokens, defRefs?.borderRadius);
  const defBoxShadowTok = findDesignTokenById(designTokens, defRefs?.boxShadow);
  const defInnerShadowTok = findDesignTokenById(designTokens, defRefs?.innerShadow);
  const defTextShadowTok = findDesignTokenById(designTokens, defRefs?.textShadow);

  const resolvedDefBg = defBgTok ? compileDesignTokenCssValue(defBgTok, activeThemeId) : bg;
  const resolvedDefTxt = defTxtTok ? compileDesignTokenCssValue(defTxtTok, activeThemeId) : txt;
  const resolvedDefBrd = defBrdTokCfg?.color !== undefined ? defBrdTokCfg.color : brd;
  const resolvedDefBorderMode =
    defBrdTok?.type === "border" && defBrdTokCfg?.borderMode !== undefined
      ? defBrdTokCfg.borderMode
      : extraM3?.borderMode;
  const resolvedDefBorderNone =
    defBrdTok?.type === "border" && defBrdTokCfg?.borderNone !== undefined
      ? defBrdTokCfg.borderNone
      : extraM3?.borderNone;
  const resolvedDefBorderWidth =
    defBrdTok?.type === "border" && defBrdTokCfg?.width !== undefined
      ? defBrdTokCfg.width
      : extraM3?.borderWidth;
  const resolvedDefBorderStyle =
    defBrdTok?.type === "border" && defBrdTokCfg?.style !== undefined
      ? defBrdTokCfg.style
      : extraM3?.borderStyle;
  const resolvedDefRad = defRadTok
    ? compileDesignTokenCssValue(defRadTok, activeThemeId)
    : defBrdTok?.type === "border" && defBrdTokCfg?.radius
      ? defBrdTokCfg.radius
      : rad;
  const resolvedDefOuterShadow = defBoxShadowTok
    ? compileDesignTokenCssValue(defBoxShadowTok, activeThemeId)
    : extraM3?.outerShadow;
  const resolvedDefInnerShadow = defInnerShadowTok
    ? compileDesignTokenCssValue(defInnerShadowTok, activeThemeId)
    : extraM3?.innerShadow;

  // ===========================================================================
  // 1) DEFAULT (Base Selector)
  // ===========================================================================
  const decls: string[] = [];
  const normRad = isOff("radius") ? "" : normCssVal(resolvedDefRad);
  const effectiveSpacing = Boolean(useSpacing) && !isOff("spacing");
  const normPad = effectiveSpacing ? normCssVal(pad) : "";
  const normMar = effectiveSpacing ? normCssVal(mar) : "";
  const normGap = effectiveSpacing ? normCssVal(gap) : "";
  const effBg = isOff("bg") ? "" : normCssVal(resolvedDefBg);
  const effTxt = isOff("text") ? "" : normCssVal(resolvedDefTxt);
  const effBrd = isOff("border") ? "" : normCssVal(resolvedDefBrd);
  const bWidthDisabled = isOff("borderWidth");
  const bWidth = bWidthDisabled ? "" : normCssVal(resolvedDefBorderWidth);
  const effBorderMode = isOff("border") ? undefined : resolvedDefBorderMode;
  const effBorderNone = isOff("border") ? false : Boolean(resolvedDefBorderNone);
  const effBorderStyle = isOff("border") ? "" : normalizeBorderStyleValue(resolvedDefBorderStyle);
  const defaultBorderIsOff =
    effBorderMode === "none" ||
    effBorderNone ||
    effBorderStyle === "none" ||
    isZeroBorderWidthValue(bWidth);

  const defaultGradRes = buildGradientAwareStateCss({
    selectors: baseTokens,
    bg: effBg,
    text: effTxt,
    border: effBrd,
    borderMode: effBorderMode,
    borderNone: effBorderNone,
    borderWidth: bWidth,
    borderStyle: effBorderStyle || undefined,
    borderWidthDisabled: bWidthDisabled,
    isSubState: false
  });
  const defaultHasBgGradient = isCssGradientValue(effBg);
  const defaultHasTextGradient = isCssGradientValue(effTxt);
  const defaultHasBorderGradient = !defaultBorderIsOff && isCssGradientValue(effBrd);
  const defaultSolidBg = !defaultHasBgGradient && effBg ? effBg : "";

  decls.push(...defaultGradRes.hostDecls);
  if (normRad) decls.push("border-radius: " + normRad + " !important;");
  const fWeight = isOff("fontWeight") ? "" : normCssVal(extraM3?.fontWeight);
  if (fWeight) decls.push("font-weight: " + fWeight + " !important;");
  const bShadow = resolveCombinedBoxShadow({
    outerShadow: resolvedDefOuterShadow,
    innerShadow: resolvedDefInnerShadow,
    legacyShadow: extraM3?.shadow,
    legacyElevation: extraM3?.elevation,
    disabledProps: disabled
  });
  if (bShadow) decls.push("box-shadow: " + bShadow + " !important;");
  const defaultTextShadowCfg =
    (defTextShadowTok ? resolveDesignTokenTextShadowConfig(defTextShadowTok, activeThemeId) : undefined) ??
    extraM3?.textShadow ??
    (hasExplicitTextShadowFields(extraM3) ? extractTextShadowConfig(extraM3) : undefined);
  const tShadow = buildTextShadowCssValue(defaultTextShadowCfg, disabled);
  if (tShadow) decls.push("text-shadow: " + tShadow + " !important;");
  if (effectiveSpacing) {
    if (normPad) decls.push("padding: " + normPad + " !important;");
    if (normMar) decls.push("margin: " + normMar + " !important;");
    if (normGap) {
      const gpParts = normGap.split(/\s+/);
      const rGap = gpParts[0] ?? normGap;
      const cGap = gpParts[1] ?? rGap;
      decls.push("gap: " + rGap + " " + cGap + " !important;");
      decls.push("row-gap: " + rGap + " !important;");
      decls.push("column-gap: " + cGap + " !important;");
    }
  }
  if (decls.length) {
    rules.push(fullSel + " { " + decls.join(" ") + " }");
  }
  if (defaultGradRes.extraRules.length) {
    rules.push(...defaultGradRes.extraRules);
  }
  if (tShadow) {
    const textShadowChildSels = baseTokens.map((s) => s + " *").join(", ");
    rules.push(textShadowChildSels + " { text-shadow: " + tShadow + " !important; }");
  }
  if (effectiveSpacing && normGap) {
    const gpParts = normGap.split(/\s+/);
    const rGap = gpParts[0] ?? normGap;
    const cGap = gpParts[1] ?? rGap;
    // Boost specificity with :not(#ecmd_none) so our !important beats Plasmic multi-class .__wab_flex-container > * !important rules
    const directFlexSel = baseTokens.map((s) => {
      const b = s + ":not(#ecmd_none)";
      return b + ", " + b + " > .__wab_flex-container, " + b + " > [class*=\"flex-container\"]";
    }).join(", ");
    const wabWrapperFixSel = baseTokens.map((s) => {
      const b = s + ":not(#ecmd_none)";
      return b + " > .__wab_flex-container, " + b + " > [class*=\"flex-container\"]";
    }).join(", ");
    const allStackChildrenSel = baseTokens.map((s) => {
      const b = s + ":not(#ecmd_none)";
      return b + " > :not(.__wab_flex-container), " + b + " > .__wab_flex-container > *, " + b + " > [class*=\"flex-container\"] > *";
    }).join(", ");
    rules.push(directFlexSel + " { gap: " + rGap + " " + cGap + " !important; row-gap: " + rGap + " !important; column-gap: " + cGap + " !important; --plsmc-rc-col-gap: " + cGap + " !important; }");
    rules.push(wabWrapperFixSel + " { width: 100% !important; margin-left: 0 !important; margin-top: 0 !important; }");
    rules.push(allStackChildrenSel + " { margin-left: 0 !important; margin-top: 0 !important; }");
  }
  // Clean, zero-collateral Icon Color: ONLY sets CSS `color` (currentColor) on `.theme-icon` or direct `svg.theme-icon`
  const effIcon = (!isOff("icon") && ico && ico.trim() && ico.trim() !== "transparent") ? ico.trim() : "";
  if (effIcon) {
    const iconColorSel = baseTokens.map((b) =>
      b + " .theme-icon:not([data-ecmd-img-group]):not([data-ecmd-svg-swapped=\"true\"]), " +
      b + ".theme-icon:not([data-ecmd-img-group]):not([data-ecmd-svg-swapped=\"true\"]), " +
      "svg" + b + ":not(#gemini-color):not([data-ecmd-brand-asset=\"true\"]):not([data-ecmd-img-group]):not([data-ecmd-svg-swapped=\"true\"])"
    ).join(", ");
    rules.push(iconColorSel + " { color: " + effIcon + " !important; }");
  }

  // Helper to resolve effective per-state attributes respecting True Bypass (per-state & global disabledProps)
  const themeKey: "cl" | "ms" = extraM3?.isMs ? "ms" : "cl";
  const isSubPropOff = (
    stOv: GroupStateOverride | undefined,
    propKey: string,
    legacyDisKey?: string
  ): boolean => {
    if (stOv?.disabledProps && stOv.disabledProps[propKey] !== undefined) {
      return Boolean(stOv.disabledProps[propKey]);
    }
    if (legacyDisKey && isOff(legacyDisKey)) return true;
    if (propKey === "outerShadow") {
      return isOff("outerShadow") || isOff("shadow") || isOff("elevation");
    }
    if (propKey === "opacity") return false;
    return isOff(propKey);
  };

  const emitStateBlock = (
    selectors: string[],
    stOv: GroupStateOverride | undefined,
    legacyFallbacks?: {
      bg?: string | undefined;
      text?: string | undefined;
      border?: string | undefined;
      legacyBgDisKey?: string;
      legacyTextDisKey?: string;
      legacyBorderDisKey?: string;
      addFocusOutline?: boolean;
      addInnerTextCascade?: boolean;
      allowDisabledVisuals?: boolean;
    }
  ) => {
    const tVals = stOv?.[themeKey];
    const stRefs = stOv?.tokenRefs;
    const stBgTok = findDesignTokenById(designTokens, stRefs?.background);
    const stTxtTok = findDesignTokenById(designTokens, stRefs?.text);
    const stBrdTok = findDesignTokenById(designTokens, stRefs?.border);
    const stBrdTokCfg = resolveDesignTokenBorderConfig(stBrdTok, activeThemeId);
    const stRadTok = findDesignTokenById(designTokens, stRefs?.borderRadius);
    const stBoxShadowTok = findDesignTokenById(designTokens, stRefs?.boxShadow);
    const stInnerShadowTok = findDesignTokenById(designTokens, stRefs?.innerShadow);
    const stTextShadowTok = findDesignTokenById(designTokens, stRefs?.textShadow);

    const stBg = isSubPropOff(stOv, "bg", legacyFallbacks?.legacyBgDisKey)
      ? ""
      : normCssVal(
          stBgTok ? compileDesignTokenCssValue(stBgTok, activeThemeId) : (tVals?.bg ?? legacyFallbacks?.bg)
        );
    const stTxt = isSubPropOff(stOv, "text", legacyFallbacks?.legacyTextDisKey)
      ? ""
      : normCssVal(
          stTxtTok ? compileDesignTokenCssValue(stTxtTok, activeThemeId) : (tVals?.text ?? legacyFallbacks?.text)
        );
    const stBorderOffProp = isSubPropOff(stOv, "border", legacyFallbacks?.legacyBorderDisKey);
    const stBrd = stBorderOffProp
      ? ""
      : normCssVal(
          stBrdTokCfg?.color !== undefined ? stBrdTokCfg.color : (tVals?.border ?? legacyFallbacks?.border)
        );
    const stIconRaw = isSubPropOff(stOv, "icon") ? "" : normCssVal(tVals?.icon);
    const stIcon = stIconRaw && stIconRaw !== "transparent" ? stIconRaw : "";
    const stRad = isSubPropOff(stOv, "radius")
      ? ""
      : normCssVal(
          stRadTok
            ? compileDesignTokenCssValue(stRadTok, activeThemeId)
            : stBrdTok?.type === "border" && stBrdTokCfg?.radius
              ? stBrdTokCfg.radius
              : stOv?.radius
        );
    const stBWDisabled = isSubPropOff(stOv, "borderWidth");
    const stBW = stBWDisabled
      ? ""
      : normCssVal(
          stBrdTok?.type === "border" && stBrdTokCfg?.width !== undefined ? stBrdTokCfg.width : stOv?.borderWidth
        );
    const stBorderMode = stBorderOffProp
      ? undefined
      : stBrdTok?.type === "border" && stBrdTokCfg?.borderMode !== undefined
        ? stBrdTokCfg.borderMode
        : stOv?.borderMode;
    const stBorderNone = stBorderOffProp
      ? false
      : Boolean(
          stBrdTok?.type === "border" && stBrdTokCfg?.borderNone !== undefined
            ? stBrdTokCfg.borderNone
            : stOv?.borderNone
        );
    const stBorderStyle = stBorderOffProp
      ? ""
      : normalizeBorderStyleValue(
          stBrdTok?.type === "border" && stBrdTokCfg?.style !== undefined ? stBrdTokCfg.style : stOv?.borderStyle
        );
    const stFW = isSubPropOff(stOv, "fontWeight") ? "" : normCssVal(stOv?.fontWeight);
    const stShadow = resolveCombinedBoxShadow({
      outerShadow: isSubPropOff(stOv, "outerShadow")
        ? ""
        : stBoxShadowTok
          ? compileDesignTokenCssValue(stBoxShadowTok, activeThemeId)
          : tVals?.outerShadow,
      innerShadow: isSubPropOff(stOv, "innerShadow")
        ? ""
        : stInnerShadowTok
          ? compileDesignTokenCssValue(stInnerShadowTok, activeThemeId)
          : tVals?.innerShadow
    });
    const otherThemeKey: "cl" | "ms" = themeKey === "ms" ? "cl" : "ms";
    const stTextShadowCfg: ThemeTextShadowConfig | undefined =
      (stTextShadowTok ? resolveDesignTokenTextShadowConfig(stTextShadowTok, activeThemeId) : undefined) ??
      (hasExplicitTextShadowFields(tVals)
        ? extractTextShadowConfig(tVals)
        : !hasExplicitTextShadowFields(stOv?.[otherThemeKey]) && hasExplicitTextShadowFields(stOv)
          ? extractTextShadowConfig(stOv)
          : undefined);
    const stTextShadow = isSubPropOff(stOv, "textShadow")
      ? ""
      : buildTextShadowCssValue(stTextShadowCfg);
    const stOpacity =
      legacyFallbacks?.allowDisabledVisuals && !isSubPropOff(stOv, "opacity")
        ? parseOpacityCss(stOv?.opacity)
        : "";
    const stCursorNotAllowed =
      Boolean(legacyFallbacks?.allowDisabledVisuals && stOv?.cursorNotAllowed);

    const stDecls: string[] = [];
    const stGradRes = buildGradientAwareStateCss({
      selectors,
      bg: stBg,
      text: stTxt,
      border: stBrd,
      borderMode: stBorderMode,
      borderNone: stBorderNone,
      borderWidth: stBW,
      fallbackBorderWidth: bWidth,
      borderStyle: stBorderStyle || undefined,
      borderWidthDisabled: stBWDisabled,
      isSubState: true,
      defaultHasBgGradient,
      defaultHasTextGradient,
      defaultHasBorderGradient,
      defaultBorderUsedMask: defaultGradRes.borderUsedMask,
      defaultSolidBg,
      addInnerTextCascade: legacyFallbacks?.addInnerTextCascade,
      addFocusOutline: legacyFallbacks?.addFocusOutline
    });
    stDecls.push(...stGradRes.hostDecls);
    if (stRad) stDecls.push("border-radius: " + stRad + " !important;");
    if (stFW) stDecls.push("font-weight: " + stFW + " !important;");
    if (stShadow) stDecls.push("box-shadow: " + stShadow + " !important;");
    if (stTextShadow) stDecls.push("text-shadow: " + stTextShadow + " !important;");
    if (stOpacity) stDecls.push("opacity: " + stOpacity + " !important;");
    if (stCursorNotAllowed) stDecls.push("cursor: not-allowed !important;");

    if (stDecls.length) {
      rules.push(selectors.join(", ") + " { " + stDecls.join(" ") + " }");
    }
    if (stGradRes.extraRules.length) {
      rules.push(...stGradRes.extraRules);
    }
    if (stTextShadow) {
      const tsChildSels = selectors.map((s) => s + " *").join(", ");
      rules.push(tsChildSels + " { text-shadow: " + stTextShadow + " !important; }");
    }
    if (stIcon) {
      const iconSels = selectors
        .map((s) => s + " .theme-icon, " + s + ".theme-icon")
        .join(", ");
      rules.push(iconSels + " { color: " + stIcon + " !important; }");
    }
  };

  const stateOv = extraM3?.stateOverrides;

  // ===========================================================================
  // 2) HOVER (Not Disabled & Not Selected — prevents flashing Hover over Selected!)
  // ===========================================================================
  const hoverSelectors = baseTokens.map(
    (b) => b + ":hover" + NOT_DISABLED_GUARD + NOT_SELECTED_GUARD
  );
  emitStateBlock(hoverSelectors, stateOv?.hover, {
    bg: extraM3?.hoverBg,
    text: extraM3?.hoverText,
    legacyBgDisKey: "hoverBg",
    legacyTextDisKey: "hoverText"
  });

  // ===========================================================================
  // 3) FOCUS / ACTIVE (Not Disabled)
  // ===========================================================================
  const focusSelectors = baseTokens.flatMap((b) => [
    b + ":focus-visible" + NOT_DISABLED_GUARD,
    b + ":focus" + NOT_DISABLED_GUARD,
    b + ":active" + NOT_DISABLED_GUARD
  ]);
  emitStateBlock(focusSelectors, stateOv?.focus, {
    border: extraM3?.focusBorder,
    legacyBorderDisKey: "focusBorder",
    addFocusOutline: true
  });

  // ===========================================================================
  // 4) SELECTED (Not Disabled)
  // ===========================================================================
  const selectedSelectors = baseTokens.flatMap((b) => [
    b + "[data-ecmd-selected=\"true\"]" + NOT_DISABLED_GUARD,
    b + "[aria-selected=\"true\"]" + NOT_DISABLED_GUARD,
    b + "[aria-pressed=\"true\"]" + NOT_DISABLED_GUARD,
    b + ".is-selected" + NOT_DISABLED_GUARD,
    b + "[aria-current=\"page\"]" + NOT_DISABLED_GUARD,
    b + ".active" + NOT_DISABLED_GUARD
  ]);
  emitStateBlock(selectedSelectors, stateOv?.selected, {
    bg: selBg,
    text: selTxt,
    legacyBgDisKey: "selBg",
    legacyTextDisKey: "selText",
    addInnerTextCascade: true
  });

  // ===========================================================================
  // 5) SELECTED + HOVER (Not Disabled)
  // ===========================================================================
  const selectedHoverSelectors = baseTokens.flatMap((b) => [
    b + "[data-ecmd-selected=\"true\"]:hover" + NOT_DISABLED_GUARD,
    b + "[aria-selected=\"true\"]:hover" + NOT_DISABLED_GUARD,
    b + "[aria-pressed=\"true\"]:hover" + NOT_DISABLED_GUARD,
    b + ".is-selected:hover" + NOT_DISABLED_GUARD
  ]);
  emitStateBlock(selectedHoverSelectors, stateOv?.selectedHover, {
    addInnerTextCascade: true
  });

  // ===========================================================================
  // 6) DISABLED (Always LAST in cascade — wins even if data-ecmd-selected="true"!)
  // ===========================================================================
  const disabledSelectors = baseTokens.flatMap((b) => [
    b + ":disabled",
    b + "[disabled]",
    b + "[aria-disabled=\"true\"]",
    b + "[data-disabled=\"true\"]"
  ]);
  emitStateBlock(disabledSelectors, stateOv?.disabled, {
    allowDisabledVisuals: true
  });

  // ===========================================================================
  // 7) FLUID AUTO-SCALE (RESPONSIVE clamp() 375px -> 1440px)
  // ===========================================================================
  const extraTopLevelRules: string[] = [];
  const fluidCfg = extraM3?.fluidScale;
  const fluidEnabled = !isOff("fluidScale") && Boolean(fluidCfg) && fluidCfg?.enabled !== false;
  if (fluidEnabled && fluidCfg) {
    const fluidDecls: string[] = [];
    const clampFont = buildFluidClampCss(fluidCfg.mobileFontPx, fluidCfg.desktopFontPx);
    const clampPadY = buildFluidClampCss(fluidCfg.mobilePadYPx, fluidCfg.desktopPadYPx);
    const clampPadX = buildFluidClampCss(fluidCfg.mobilePadXPx, fluidCfg.desktopPadXPx);
    const clampGap = buildFluidClampCss(fluidCfg.mobileGapPx, fluidCfg.desktopGapPx);

    if (clampFont) fluidDecls.push("font-size: " + clampFont + " !important;");
    if (clampPadY && clampPadX) {
      fluidDecls.push("padding: " + clampPadY + " " + clampPadX + " !important;");
    } else if (clampPadY) {
      fluidDecls.push("padding-top: " + clampPadY + " !important;", "padding-bottom: " + clampPadY + " !important;");
    } else if (clampPadX) {
      fluidDecls.push("padding-left: " + clampPadX + " !important;", "padding-right: " + clampPadX + " !important;");
    }
    if (clampGap) {
      fluidDecls.push(
        "gap: " + clampGap + " !important;",
        "row-gap: " + clampGap + " !important;",
        "column-gap: " + clampGap + " !important;"
      );
    }

    if (fluidDecls.length) {
      rules.push(fullSel + " { " + fluidDecls.join(" ") + " }");
    }
    if (clampGap) {
      const fluidFlexSel = baseTokens
        .map((s) => {
          const b = s + ":not(#ecmd_none)";
          return b + ", " + b + " > .__wab_flex-container, " + b + " > [class*=\"flex-container\"]";
        })
        .join(", ");
      rules.push(
        fluidFlexSel +
          " { gap: " +
          clampGap +
          " !important; row-gap: " +
          clampGap +
          " !important; column-gap: " +
          clampGap +
          " !important; --plsmc-rc-col-gap: " +
          clampGap +
          " !important; }"
      );
    }
    if (fluidCfg.stackOnMobile) {
      const stackSel = baseTokens
        .map((s) => {
          const b = s + ":not(#ecmd_none)";
          return b + ", " + b + " > .__wab_flex-container, " + b + " > [class*=\"flex-container\"]";
        })
        .join(", ");
      const stackRule =
        stackSel + " { flex-direction: column !important; flex-wrap: wrap !important; }";
      if (extraM3?.breakpointTarget === "mobile") {
        rules.push(stackRule);
      } else {
        extraTopLevelRules.push("@media (max-width: 767px) {\n" + stackRule + "\n}");
      }
    }
  }

  const scopedBaseCss = wrapCssWithBreakpointMedia(
    rules.join("\n"),
    extraM3?.breakpointTarget
  );
  return [scopedBaseCss, ...extraTopLevelRules].filter(Boolean).join("\n");
}

export function EcmdThemeGroupController(props: EcmdThemeGroupControllerProps) {
  const inCanvas = Boolean(usePlasmicCanvasContext());
  const {
    className,
    presetTheme = "coastal-light",
    cardThemeGroup = "ecmd-group-3",
    triggerThemeGroup = "none",
    trigger,
    children,
    toggleFlags,
    open: rawOpen,
    defaultOpen = false,
    enableLiveDropdown: rawEnableLive = true,
    cardWidth = "205px",
    offsetY = 10,
    align = "left",
    fixedBreakout: rawFixedBreakout = true,
    maskClosable: rawMaskClosable = true,
    closeOnSelect: rawCloseOnSelect = true,
    persistUserChoice: rawPersist = true,
    smoothTransition: rawSmooth = true,
    hideTrigger: rawHideTrigger = false,
    showHelperBadgeInStudio = false,
    showGroupLegendInStudio = false,
    showSwatchPreview: rawSwatch = false,
    buttonLabel = "Site Themes",
    showActiveThemeInLabel: rawShowActiveLbl = false,
    syncTriggerDotWithTheme: rawSyncDot = false,
    triggerClassName,
    dropdownCardClassName,
    highlightActiveRow = true,
    activeRowBg = "rgba(20, 184, 166, 0.16)",
    activeRowText = "#14B8A6",
    cl_activeRowBg,
    cl_activeRowText,
    ms_activeRowBg,
    ms_activeRowText,
    onThemeChange,
    onOpenChange,
    enableGroup1 = true, group1Name = "Bars & Surfaces", group1Selector = ".bars", group1Radius = "",
    enableGroup2 = true, group2Name = "Header Buttons", group2Selector = ".headerButtons", group2Radius = "",
    enableGroup3 = true, group3Name = "Modals", group3Selector = ".modals", group3Radius = "",
    enableGroup4 = true, group4Name = "Text buttons", group4Selector = ".text-buttons", group4Radius = "",
    enableGroup5 = true, group5Name = "text buttons (on dark)", group5Selector = ".text-buttons-dark", group5Radius = "",
    enableGroup6 = false, group6Name = "Side Menu", group6Selector = ".side-menu", group6Radius = "",
    enableGroup7 = false, group7Name = "Group 7", group7Selector = ".ecmd-group-7", group7Radius = "",
    enableGroup8 = false, group8Name = "Group 8", group8Selector = ".ecmd-group-8", group8Radius = "",
    cl_g1Bg = "#F8FAFC", cl_g1Text = "#0F172A", cl_g1Border = "#E2E8F0",
    cl_g2Bg = "#0D9488", cl_g2Text = "#FFFFFF", cl_g2Border = "#0D9488",
    cl_g3Bg = "#FFFFFF", cl_g3Text = "#0F172A", cl_g3Border = "#CBD5E1",
    cl_g4Bg = "transparent", cl_g4Text = "#0F172A", cl_g4Border = "transparent",
    cl_g5Bg = "transparent", cl_g5Text = "#F8FAFC", cl_g5Border = "transparent",
    cl_g6Bg = "#FFFFFF", cl_g6Text = "#0F172A", cl_g6Border = "#BAE6FD",
    cl_g7Bg = "#FFFFFF", cl_g7Text = "#0F172A", cl_g7Border = "#BAE6FD",
    cl_g8Bg = "#FFFFFF", cl_g8Text = "#0F172A", cl_g8Border = "#BAE6FD",
    ms_g1Bg = "#0F172A", ms_g1Text = "#F8FAFC", ms_g1Border = "#1E293B",
    ms_g2Bg = "#14B8A6", ms_g2Text = "#042F2E", ms_g2Border = "#14B8A6",
    ms_g3Bg = "#1E293B", ms_g3Text = "#F8FAFC", ms_g3Border = "#334155",
    ms_g4Bg = "transparent", ms_g4Text = "#F8FAFC", ms_g4Border = "transparent",
    ms_g5Bg = "transparent", ms_g5Text = "#F8FAFC", ms_g5Border = "transparent",
    ms_g6Bg = "#0F172A", ms_g6Text = "#F8FAFC", ms_g6Border = "#334155",
    ms_g7Bg = "#1E293B", ms_g7Text = "#F8FAFC", ms_g7Border = "#475569",
    ms_g8Bg = "#1E293B", ms_g8Text = "#F8FAFC", ms_g8Border = "#475569",
  } = props;

  let tf: ToggleFlagsState = {};
  if (typeof toggleFlags === "string" && toggleFlags.trim().startsWith("{")) {
    try { tf = JSON.parse(toggleFlags); } catch {}
  } else if (toggleFlags && typeof toggleFlags === "object") {
    tf = toggleFlags;
  }
  const open = typeof tf.open === "boolean" ? tf.open : rawOpen;
  const enableLiveDropdown = typeof tf.enableLiveDropdown === "boolean" ? tf.enableLiveDropdown : rawEnableLive;
  const fixedBreakout = typeof tf.fixedBreakout === "boolean" ? tf.fixedBreakout : rawFixedBreakout;
  const maskClosable = typeof tf.maskClosable === "boolean" ? tf.maskClosable : rawMaskClosable;
  const closeOnSelect = typeof tf.closeOnSelect === "boolean" ? tf.closeOnSelect : rawCloseOnSelect;
  const persistUserChoice = typeof tf.persistUserChoice === "boolean" ? tf.persistUserChoice : rawPersist;
  const smoothTransition = typeof tf.smoothTransition === "boolean" ? tf.smoothTransition : rawSmooth;
  const hideTrigger = typeof tf.hideTrigger === "boolean" ? tf.hideTrigger : rawHideTrigger;
  const showSwatchPreview = typeof tf.showSwatchPreview === "boolean" ? tf.showSwatchPreview : rawSwatch;
  const showActiveThemeInLabel = typeof tf.showActiveThemeInLabel === "boolean" ? tf.showActiveThemeInLabel : rawShowActiveLbl;
  const syncTriggerDotWithTheme = typeof tf.syncTriggerDotWithTheme === "boolean" ? tf.syncTriggerDotWithTheme : rawSyncDot;
  const normalizedPreset: PresetTheme = presetTheme === "midnight-slate" ? "midnight-slate" : "coastal-light";
  const [activeTheme, setActiveTheme] = useState<PresetTheme>(normalizedPreset);
  const canvasCtx = usePlasmicCanvasContext();
  const isDesignCanvas = Boolean(canvasCtx && !canvasCtx.interactive);
  const [isOpen, setIsOpen] = useState<boolean>(Boolean(defaultOpen));
  const [attrProfilesOpen, setAttrProfilesOpen] = useState<boolean>(Boolean(props.openAttributeProfilesModal));
  const [fixedCoords, setFixedCoords] = useState<{ top: number; left?: number; right?: number }>({ top: 44, left: 16 });

  useEffect(() => {
    setAttrProfilesOpen(Boolean(props.openAttributeProfilesModal));
  }, [props.openAttributeProfilesModal]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const trigRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const lastToggleTsRef = useRef<number>(0);
  const uid = "ecmd-tg-" + useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    setActiveTheme(normalizedPreset);
    if (persistUserChoice && typeof window !== "undefined") {
      try { window.localStorage.setItem(STORAGE_KEY, normalizedPreset); } catch {}
    }
  }, [normalizedPreset, persistUserChoice]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-ecmd-active-theme", activeTheme);
    }
  }, [activeTheme]);

  // Outside isDesignCanvas, showMenu is driven purely by isOpen state (initialized from Boolean(defaultOpen))
  const showMenu = isDesignCanvas ? Boolean(open ?? defaultOpen) : isOpen;

  // Mutual popover coordination: close when other popovers (e.g. side-menu, auth-modal) open
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOtherPopover = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail?.source && ce.detail.source !== "theme-group") {
        setIsOpen(false);
        onOpenChange?.(false);
      }
    };
    window.addEventListener("ecmd-popover-opened", handleOtherPopover);
    return () => window.removeEventListener("ecmd-popover-opened", handleOtherPopover);
  }, [onOpenChange]);

  const recomputePosition = useCallback(() => {
    const anchor = (trigRef.current?.querySelector("#ecmd-theme-trigger-btn") as HTMLElement | null) || trigRef.current || wrapRef.current;
    if (!fixedBreakout || !anchor) return;
    const docWin = anchor.ownerDocument?.defaultView || window;
    const rect = anchor.getBoundingClientRect();
    const gap = Number.isFinite(Number(offsetY)) ? Number(offsetY) : 10;
    const top = Math.max(4, rect.bottom + gap);
    if (align === "right") {
      setFixedCoords({ top, right: Math.max(8, docWin.innerWidth - rect.right) });
    } else if (align === "center") {
      const numW = parseFloat(cardWidth) || 205;
      setFixedCoords({ top, left: Math.max(8, rect.left + rect.width / 2 - numW / 2) });
    } else {
      setFixedCoords({ top, left: Math.max(8, rect.left) });
    }
  }, [fixedBreakout, offsetY, align, cardWidth]);

  // Unified click toggle with 150ms deduplication so native capture and React clicks never double-toggle
  const toggleDropdown = useCallback(() => {
    const now = Date.now();
    if (now - lastToggleTsRef.current < 150) {
      return;
    }
    lastToggleTsRef.current = now;
    setIsOpen((prev) => {
      const next = !prev;
      onOpenChange?.(next);
      if (next) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("ecmd-popover-opened", { detail: { source: "theme-group" } }));
        }
        recomputePosition();
      }
      return next;
    });
  }, [onOpenChange, recomputePosition]);

  // Reliable native capture-phase click handler on trigRef (handles nested Header Button, SVGs, Links)
  useEffect(() => {
    const trigEl = trigRef.current;
    if (!trigEl) return;

    const handleCaptureClick = (e: MouseEvent) => {
      if (isDesignCanvas) return;
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown();
    };

    trigEl.addEventListener("click", handleCaptureClick, true);
    return () => {
      trigEl.removeEventListener("click", handleCaptureClick, true);
    };
  }, [isDesignCanvas, toggleDropdown]);

  useLayoutEffect(() => {
    if (!showMenu || !fixedBreakout) return;
    recomputePosition();
    const anchor = trigRef.current || wrapRef.current;
    const win = anchor?.ownerDocument?.defaultView || window;
    win.addEventListener("resize", recomputePosition);
    win.addEventListener("scroll", recomputePosition, true);
    const timer = win.setInterval(recomputePosition, 200);
    return () => {
      win.removeEventListener("resize", recomputePosition);
      win.removeEventListener("scroll", recomputePosition, true);
      win.clearInterval(timer);
    };
  }, [showMenu, fixedBreakout, recomputePosition]);

  useEffect(() => {
    if (!showMenu || isDesignCanvas || typeof document === "undefined") return;
    const doc = wrapRef.current?.ownerDocument || document;
    const onDocClick = (e: MouseEvent) => {
      if (!maskClosable) return;
      const target = e.target as Node;
      const targetEl = (target instanceof Element ? target : (target as Node)?.parentElement) as HTMLElement | null;
      if (
        wrapRef.current?.contains(target) ||
        trigRef.current?.contains(target) ||
        dropRef.current?.contains(target) ||
        Boolean(targetEl?.closest("#ecmd-theme-trigger-btn, #ecmd-theme-trigger, [data-ecmd-theme-trigger]"))
      ) {
        return;
      }
      setIsOpen(false);
      onOpenChange?.(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        onOpenChange?.(false);
      }
    };
    doc.addEventListener("mousedown", onDocClick, true);
    doc.addEventListener("keydown", onKey, true);
    return () => {
      doc.removeEventListener("mousedown", onDocClick, true);
      doc.removeEventListener("keydown", onKey, true);
    };
  }, [maskClosable, showMenu, isDesignCanvas, onOpenChange]);

  const isMs = activeTheme === "midnight-slate";
  const resolvedDynPayload = buildInitialGroupsFromProps(props, props.dynamicGroupsJson);
  const resolvedDynGroups = resolvedDynPayload.groups;
  const resolvedImageGroups = resolvedDynPayload.imageGroups || [];
  const resolvedDesignTokens = resolvedDynPayload.designTokens || [];
  const imageGroupsSignature = JSON.stringify(resolvedImageGroups);
  const imageGroupsRef = useRef(resolvedImageGroups);
  imageGroupsRef.current = resolvedImageGroups;
  const activeThemeRef = useRef(activeTheme);
  activeThemeRef.current = activeTheme;

  // Live DOM engine for Theme-Aware Image Groups (<img> + <svg> + wrappers + MutationObserver for Plasmic artboards)
  useEffect(() => {
    const rootDoc = wrapRef.current?.ownerDocument || (typeof document !== "undefined" ? document : null);
    if (!rootDoc) return;
    return observeThemeImageGroups(
      rootDoc,
      () => imageGroupsRef.current,
      () => activeThemeRef.current
    );
  }, [activeTheme, imageGroupsSignature]);
  const menuItemGrp = resolvedDynGroups["5"];
  const effRowBg = menuItemGrp?.disabledProps?.["selBg"]
    ? ""
    : (menuItemGrp ? (isMs ? menuItemGrp.msSelBg : menuItemGrp.clSelBg) : "") || (isMs ? ms_activeRowBg : cl_activeRowBg) || "transparent";
  const effRowTxt = menuItemGrp?.disabledProps?.["selText"]
    ? ""
    : (menuItemGrp ? (isMs ? menuItemGrp.msSelText : menuItemGrp.clSelText) : "") || (isMs ? ms_activeRowText : cl_activeRowText) || "#FFFFFF";

  useEffect(() => {
    if (!showMenu || !dropRef.current) return;
    const rawFirst = dropRef.current.firstElementChild;
    const safeFirst = rawFirst && !rawFirst.hasAttribute("data-ecmd-theme-toolbar") ? rawFirst : null;
    const listRoot =
      dropRef.current.querySelector("#ecmd-theme-dropdown-list") ||
      dropRef.current.querySelector("[class*=vertical]") ||
      safeFirst;
    if (!listRoot) return;
    const rows = Array.from(listRoot.children) as HTMLElement[];
    const order: PresetTheme[] = rows.length >= 4
      ? ["custom", "emerald-dark", "coastal-light", "midnight-slate"]
      : ["coastal-light", "midnight-slate"];
    const cleanups: Array<() => void> = [];
    rows.forEach((rowEl, idx) => {
      if (rows.length >= 4 && idx < 2) {
        rowEl.style.display = "none";
        return;
      }
      const targetTheme = order[idx];
      if (!targetTheme) return;
      rowEl.style.cursor = isDesignCanvas ? "" : "pointer";
      const isAct = activeTheme === targetTheme;
      if (highlightActiveRow && isAct) {
        rowEl.setAttribute("data-ecmd-selected", "true");
        rowEl.classList.add("is-selected");
      } else {
        rowEl.removeAttribute("data-ecmd-selected");
        rowEl.classList.remove("is-selected");
        rowEl.style.backgroundColor = "";
        rowEl.style.color = "";
      }
      if (!isDesignCanvas) {
        const handler = (ev: Event) => {
          ev.stopPropagation();
          setActiveTheme(targetTheme);
          onThemeChange?.(targetTheme);
          if (persistUserChoice && typeof window !== "undefined") {
            try { window.localStorage.setItem(STORAGE_KEY, targetTheme); } catch {}
          }
          if (closeOnSelect) {
            setIsOpen(false);
            onOpenChange?.(false);
          }
        };
        rowEl.addEventListener("click", handler);
        cleanups.push(() => rowEl.removeEventListener("click", handler));
      }
    });
    return () => cleanups.forEach((fn) => fn());
  }, [showMenu, isDesignCanvas, activeTheme, highlightActiveRow, effRowBg, effRowTxt, persistUserChoice, closeOnSelect, onThemeChange, onOpenChange]);

  const groupSelectorsMap: Record<string, string> = (() => {
    const dynGroups = buildInitialGroupsFromProps(props, props.dynamicGroupsJson).groups;
    const m: Record<string, string> = {};
    Object.values(dynGroups).forEach((g) => {
      if (!g || !g.enabled) return;
      const cls = resolveGroupPrimaryClass(g.id, props);
      m["ecmd-group-" + g.id] = cls;
      m[String(g.id)] = cls;
    });
    return m;
  })();

  const transitionRule = smoothTransition
    ? ".ecmd-group-1, .ecmd-group-2, .ecmd-group-3, .ecmd-group-4, .ecmd-group-5, .ecmd-group-6, .bars, .headerButtons, .modals, .text-buttons, .side-menu, .side-menu-card, .side-menu-btn, .ecmd-side-menu-divider { transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease; }"
    : "";

  const cssRules = [
    buildThemeDesignTokensRootCss(resolvedDesignTokens, activeTheme),
    transitionRule,
    ...Object.values(resolvedDynGroups)
      .filter((g): g is NonNullable<typeof g> => Boolean(g))
      .sort((a, b) => a.id - b.id)
      .map((g) =>
        makeCssRule(
          g.id,
          g.enabled,
          g.selector,
          isMs ? g.msBg : g.clBg,
          isMs ? g.msText : g.clText,
          isMs ? g.msBorder : g.clBorder,
          g.radius,
          g.spacing,
          g.padding,
          g.margin,
          g.gap,
          isMs ? g.msIcon : g.clIcon,
          false,
          "",
          isMs ? g.msSelBg : g.clSelBg,
          isMs ? g.msSelText : g.clSelText,
          {
            borderMode: g.borderMode,
            borderNone: g.borderNone,
            borderWidth: g.borderWidth,
            borderStyle: g.borderStyle,
            fontWeight: g.fontWeight,
            hoverBg: isMs ? g.msHoverBg : g.clHoverBg,
            hoverText: isMs ? g.msHoverText : g.clHoverText,
            focusBorder: isMs ? g.msFocusBorder : g.clFocusBorder,
            shadow: isMs ? g.msShadow : g.clShadow,
            elevation: g.elevation,
            outerShadow: isMs ? g.msOuterShadow : g.clOuterShadow,
            innerShadow: isMs ? g.msInnerShadow : g.clInnerShadow,
            textShadow: isMs
              ? (g.msTextShadow ?? (!g.clTextShadow && hasExplicitTextShadowFields(g) ? extractTextShadowConfig(g) : undefined))
              : (g.clTextShadow ?? (!g.msTextShadow && hasExplicitTextShadowFields(g) ? extractTextShadowConfig(g) : undefined)),
            disabledProps: g.disabledProps,
            stateOverrides: hydrateLegacyStateOverrides(g).stateOverrides,
            breakpointTarget: g.breakpointTarget,
            fluidScale: g.fluidScale,
            tokenRefs: g.tokenRefs,
            designTokens: resolvedDesignTokens,
            activeThemeId: activeTheme,
            isMs
          }
        )
      ),
    !Boolean(inCanvas) ? "html:not([data-ecmd-apple-pay=\"true\"]) .apple-pay-only { display: none !important; }" : "",
    !Boolean(inCanvas) ? "html:not([data-ecmd-google-pay=\"true\"]) .google-pay-only { display: none !important; }" : "",
    !Boolean(inCanvas) ? "html:not([data-ecmd-ecosystem=\"apple\"]) .apple-device-only { display: none !important; }" : "",
    !Boolean(inCanvas) ? "html:not([data-ecmd-ecosystem=\"google\"]) .google-device-only { display: none !important; }" : "",
    "#ecmd-theme-dropdown-list > div:nth-child(4n+1), #ecmd-theme-dropdown-list > div:nth-child(4n+2) { display: none !important; }",
    "[data-ecmd-theme-trigger], [data-ecmd-theme-trigger] *, #ecmd-theme-trigger, #ecmd-theme-trigger * { cursor: pointer !important; }",
    highlightActiveRow && (effRowBg || effRowTxt)
      ? "#ecmd-theme-dropdown-card [data-ecmd-selected=\"true\"] { " +
        [
          effRowBg ? "background-color: " + effRowBg + " !important;" : "",
          effRowTxt ? "color: " + effRowTxt + " !important;" : ""
        ]
          .filter(Boolean)
          .join(" ") +
        " }"
      : "",
    buildThemeImageGroupsCss(resolvedImageGroups, activeTheme)
  ].filter(Boolean).join("\n");

  const trigExtraCls = [
    triggerThemeGroup && triggerThemeGroup !== "none" ? triggerThemeGroup : "",
    triggerThemeGroup && triggerThemeGroup !== "none" ? (groupSelectorsMap[triggerThemeGroup] || "") : "",
    triggerClassName || ""
  ].filter(Boolean).join(" ");

  const cardExtraCls = [
    cardThemeGroup && cardThemeGroup !== "none" ? cardThemeGroup : "",
    cardThemeGroup && cardThemeGroup !== "none" ? (groupSelectorsMap[cardThemeGroup] || "modals") : "",
    dropdownCardClassName || ""
  ].filter(Boolean).join(" ");

  const absAlignStyle: React.CSSProperties =
    align === "right" ? { right: 0 } :
    align === "center" ? { left: "50%", transform: "translateX(-50%)" } :
    { left: 0 };

  const cardPositionStyle: React.CSSProperties = fixedBreakout
    ? {
        position: "fixed",
        top: fixedCoords.top + "px",
        ...(fixedCoords.left !== undefined ? { left: fixedCoords.left + "px" } : {}),
        ...(fixedCoords.right !== undefined ? { right: fixedCoords.right + "px" } : {}),
        width: cardWidth || "205px",
        zIndex: 2147483000
      }
    : {
        position: "absolute",
        top: "calc(100% + " + (Number(offsetY) || 10) + "px)",
        ...absAlignStyle,
        width: cardWidth || "205px",
        zIndex: 9999
      };

  const groupsMeta = [
    { n: 1, nm: group1Name, bg: isMs ? ms_g1Bg : cl_g1Bg, tx: isMs ? ms_g1Text : cl_g1Text, en: enableGroup1 },
    { n: 2, nm: group2Name, bg: isMs ? ms_g2Bg : cl_g2Bg, tx: isMs ? ms_g2Text : cl_g2Text, en: enableGroup2 },
    { n: 3, nm: group3Name, bg: isMs ? ms_g3Bg : cl_g3Bg, tx: isMs ? ms_g3Text : cl_g3Text, en: enableGroup3 },
    { n: 4, nm: group4Name, bg: isMs ? ms_g4Bg : cl_g4Bg, tx: isMs ? ms_g4Text : cl_g4Text, en: enableGroup4 },
    { n: 5, nm: group5Name, bg: isMs ? ms_g5Bg : cl_g5Bg, tx: isMs ? ms_g5Text : cl_g5Text, en: enableGroup5 },
    { n: 6, nm: group6Name, bg: isMs ? ms_g6Bg : cl_g6Bg, tx: isMs ? ms_g6Text : cl_g6Text, en: enableGroup6 },
    { n: 7, nm: group7Name, bg: isMs ? ms_g7Bg : cl_g7Bg, tx: isMs ? ms_g7Text : cl_g7Text, en: enableGroup7 },
    { n: 8, nm: group8Name, bg: isMs ? ms_g8Bg : cl_g8Bg, tx: isMs ? ms_g8Text : cl_g8Text, en: enableGroup8 }
  ].filter((x) => x.en);

  const dotColor = isMs ? "#14B8A6" : "#0EA5E9";
  const activeLabel = isMs ? "Midnight Slate" : "Coastal Light";
  const showSwatches = Boolean(showSwatchPreview || showGroupLegendInStudio);

  useEffect(() => {
    if (typeof document !== "undefined") {
      applyDeviceAttributesToDom(document, detectEcmdDeviceProfile());
    }
    const shouldMatchSys = typeof tf.matchSystemTheme === "boolean" ? tf.matchSystemTheme : (props.matchSystemTheme !== false);
    if (
Boolean(inCanvas)
 || !shouldMatchSys || typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const syncOs = (dark: boolean) => {
      try {
        const manual = persistUserChoice ? window.localStorage.getItem("ecmd_site_theme_user_override_v1") : null;
        if (manual === "coastal-light" || manual === "midnight-slate") 
setActiveTheme
(manual);
        else 
setActiveTheme
(dark ? "midnight-slate" : "coastal-light");
      } catch {
        
setActiveTheme
(dark ? "midnight-slate" : "coastal-light");
      }
    };
    syncOs(mql.matches);
    const onChange = (e: MediaQueryListEvent) => syncOs(e.matches);
    if (typeof mql.addEventListener === "function") mql.addEventListener("change", onChange);
    return () => {
      if (typeof mql.removeEventListener === "function") mql.removeEventListener("change", onChange);
    };
  }, [
Boolean(inCanvas)
, tf.matchSystemTheme, props.matchSystemTheme, persistUserChoice]);


      // Sync .is-selected state AND theme bar-color preview dots onto BOTH Light and Dark Horizontal Stacks
  useEffect(() => {
    const selectedIsDark = activeTheme === "midnight-slate";
    const dynGroups = buildInitialGroupsFromProps(props, props.dynamicGroupsJson).groups;
    const barGrp = dynGroups["1"];
    const clBarBg = (barGrp && barGrp.clBg) ? barGrp.clBg : "#F8FAFD";
    const msBarBg = (barGrp && barGrp.msBg) ? barGrp.msBg : "#28292A";
    const clBarBorder = (barGrp && barGrp.clBorder) ? barGrp.clBorder : "#CBD5E1";
    const msBarBorder = (barGrp && barGrp.msBorder) ? barGrp.msBorder : "#444746";

    const syncThemeOptionSelectedDom = () => {
      const rootDoc = typeof document !== "undefined" ? document : null;
      if (!rootDoc) return;
      const pairs: Array<{ id: string; selected: boolean; dotBg: string; dotBorder: string }> = [
        { id: "ecmd-theme-opt-coastal-light", selected: !selectedIsDark, dotBg: clBarBg, dotBorder: clBarBorder },
        { id: "ecmd-theme-opt-midnight-slate", selected: selectedIsDark, dotBg: msBarBg, dotBorder: msBarBorder }
      ];
      for (let p = 0; p < pairs.length; p++) {
        const item = pairs[p];
        if (!item) continue;
        const el = rootDoc.getElementById(item.id);
        if (!el) continue;
        const menuHost = (el.closest(".gm-menu-item, .listbuttons, [class*=\"ecmd-group-\"]") as HTMLElement | null) || el;
        const targets: HTMLElement[] = menuHost !== el ? [menuHost, el] : [el];
        for (let t = 0; t < targets.length; t++) {
          const box = targets[t];
          if (!box) continue;
          box.classList.toggle("is-selected", item.selected);
          box.setAttribute("data-ecmd-selected", item.selected ? "true" : "false");
          box.setAttribute("aria-selected", item.selected ? "true" : "false");
          box.style.removeProperty("background");
          box.style.removeProperty("background-color");
          box.style.removeProperty("color");
          box.style.removeProperty("border-color");
        }
        let paintedDot = false;
        const innerNodes = menuHost.querySelectorAll("*");
        for (let i = 0; i < innerNodes.length; i++) {
          const child = innerNodes[i];
          if (child instanceof HTMLElement) {
            const txt = (child.textContent || "").trim();
            // First empty child DIV/SPAN inside the option stack is the free-box theme preview dot!
            if (!paintedDot && txt.length === 0 && child.children.length === 0 && (child.tagName === "DIV" || child.tagName === "SPAN")) {
              paintedDot = true;
              child.setAttribute("data-ecmd-theme-dot", "true");
              child.style.setProperty("background", item.dotBg, "important");
              child.style.setProperty("background-color", item.dotBg, "important");
              child.style.setProperty("border", "1px solid " + item.dotBorder, "important");
              continue;
            }
            child.classList.toggle("is-selected", item.selected);
            child.setAttribute("data-ecmd-selected", item.selected ? "true" : "false");
            if (txt.length > 0) {
              child.style.removeProperty("color");
              child.style.removeProperty("-webkit-text-fill-color");
              if (child.tagName === "A") {
                child.style.removeProperty("background");
                child.style.removeProperty("background-color");
              }
            }
            if ((txt === "✓" || txt === "✔") && child.children.length === 0) {
              child.style.opacity = item.selected ? "1" : "0";
            }
          }
        }
      }
    };
    syncThemeOptionSelectedDom();
    const t1 = setTimeout(syncThemeOptionSelectedDom, 60);
    const t2 = setTimeout(syncThemeOptionSelectedDom, 250);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [activeTheme, props]);

  // Bind Coastal Light free-box to .gm-bar Light Bg & Midnight Slate free-box to .gm-bar Dark Bg
  useEffect(() => {
    const rootDoc = typeof document !== "undefined" ? document : null;
    if (!rootDoc) return;
    const allGrps = Object.values(buildInitialGroupsFromProps(props, props.dynamicGroupsJson).groups);
    const gmBarGrp = allGrps.find((g) => g && (g.selector || "").split(",").some((s) => s.trim() === ".gm-bar")) || allGrps.find((g) => g && g.id === 1);
    const lightBarBg = (gmBarGrp && gmBarGrp.clBg) ? gmBarGrp.clBg : "#F8FAFD";
    const darkBarBg = (gmBarGrp && gmBarGrp.msBg) ? gmBarGrp.msBg : "#28292A";

    let styleTag = rootDoc.getElementById("ecmd-gm-bar-dots-style") as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = rootDoc.createElement("style");
      styleTag.id = "ecmd-gm-bar-dots-style";
      rootDoc.head.appendChild(styleTag);
    }
    styleTag.textContent = [
      ".gm-bar-dot-light, [data-ecmd-dot-theme=\"coastal-light\"] { background: " + lightBarBg + " !important; background-color: " + lightBarBg + " !important; border: 1px solid rgba(15, 23, 42, 0.25) !important; min-width: 12px !important; min-height: 12px !important; border-radius: 999px !important; display: inline-block !important; flex-shrink: 0 !important; }",
      ".gm-bar-dot-dark, [data-ecmd-dot-theme=\"midnight-slate\"] { background: " + darkBarBg + " !important; background-color: " + darkBarBg + " !important; border: 1px solid rgba(255, 255, 255, 0.25) !important; min-width: 12px !important; min-height: 12px !important; border-radius: 999px !important; display: inline-block !important; flex-shrink: 0 !important; }"
    ].join("\n");

    const stampDots = () => {
      const pairs: Array<{ rowId: string; key: string; labelText: string; otherText: string }> = [
        { rowId: "ecmd-theme-opt-coastal-light", key: "coastal-light", labelText: "Coastal Light", otherText: "Midnight Slate" },
        { rowId: "ecmd-theme-opt-midnight-slate", key: "midnight-slate", labelText: "Midnight Slate", otherText: "Coastal Light" }
      ];
      for (let i = 0; i < pairs.length; i++) {
        const p = pairs[i];
        if (!p) continue;
        let host: HTMLElement | null = rootDoc.getElementById(p.rowId);
        if (!host) {
          const candidates = rootDoc.querySelectorAll(".gm-menu-item, [class*=\"horizontal\"], div");
          for (let d = 0; d < candidates.length; d++) {
            const cand = candidates[d];
            if (cand instanceof HTMLElement) {
              const t = cand.textContent || "";
              if (t.includes(p.labelText) && !t.includes(p.otherText) && cand.children.length >= 2 && cand.children.length <= 5) {
                host = cand;
                break;
              }
            }
          }
        }
        if (!host) continue;
        const firstChild = host.firstElementChild;
        if (firstChild instanceof HTMLElement && (firstChild.textContent || "").trim() === "") {
          firstChild.setAttribute("data-ecmd-dot-theme", p.key);
          continue;
        }
        const kids = host.querySelectorAll("div, span");
        for (let k = 0; k < kids.length; k++) {
          const el = kids[k];
          if (el instanceof HTMLElement && (el.textContent || "").trim() === "" && el.children.length === 0) {
            el.setAttribute("data-ecmd-dot-theme", p.key);
            break;
          }
        }
      }
    };
    stampDots();
    const t1 = setTimeout(stampDots, 80);
    const t2 = setTimeout(stampDots, 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [activeTheme, props]);

  // Sync trigger dot inside #ecmd-theme-trigger-btn (or trigRef) to active theme color
  useEffect(() => {
    const isMsTheme = activeTheme === "midnight-slate";
    const themeDotColor = isMsTheme ? "#14B8A6" : "#0EA5E9";

    const syncTriggerDot = () => {
      const rootDoc = typeof document !== "undefined" ? document : null;
      if (!rootDoc) return;
      const host = (rootDoc.getElementById("ecmd-theme-trigger-btn") as HTMLElement | null) || trigRef.current;
      if (!host) return;

      const candidates = host.querySelectorAll("div, span");
      for (let i = 0; i < candidates.length; i++) {
        const el = candidates[i];
        if (el instanceof HTMLElement) {
          const txt = (el.textContent || "").trim();
          if (txt.length === 0 && el.children.length === 0) {
            el.setAttribute("data-ecmd-trigger-dot", "true");
            el.style.setProperty("background", themeDotColor, "important");
            el.style.setProperty("background-color", themeDotColor, "important");
            el.style.setProperty("border-radius", "999px", "important");
            break;
          }
        }
      }
    };

    syncTriggerDot();
    const t1 = setTimeout(syncTriggerDot, 50);
    const t2 = setTimeout(syncTriggerDot, 200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [activeTheme]);

  return (
    <div
      ref={wrapRef}
      id={uid}
      className={className}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", overflow: "visible" }}
    >
      <style id="ecmd-theme-dynamic-styles" dangerouslySetInnerHTML={{ __html: cssRules }} />
      {!hideTrigger && (
        <div
          ref={trigRef}
          id="ecmd-theme-trigger"
          data-ecmd-theme-trigger="true"
          className={trigExtraCls}
          onClick={(e) => {
            if (isDesignCanvas) return;
            e.preventDefault();
            e.stopPropagation();
            toggleDropdown();
          }}
          style={{ display: "inline-flex", alignItems: "center", gap: "4px", cursor: isDesignCanvas ? "default" : "pointer", userSelect: "none" }}
        >
          {trigger || (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "6px", fontSize: "13px", fontWeight: 500 }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "999px", backgroundColor: dotColor, display: "inline-block" }} />
              <span>{buttonLabel}{showActiveThemeInLabel ? ": " + activeLabel : ""}</span>
            </div>
          )}
        </div>
      )}
      {showMenu && (
        <div
          ref={dropRef}
          id="ecmd-theme-dropdown-card"
          className={cardExtraCls}
          style={{
            ...cardPositionStyle,
            boxSizing: "border-box",
            borderRadius: "12px",
            padding: "8px",
            boxShadow: "0 16px 36px rgba(0, 0, 0, 0.32)",
            borderWidth: "1px",
            borderStyle: "solid"
          }}
        >
          {children}
          <div
            data-ecmd-theme-toolbar="true"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              marginTop: children ? "7px" : "0px",
              paddingTop: children ? "7px" : "0px",
              borderTop: children ? "1px solid rgba(148, 163, 184, 0.25)" : "none"
            }}
          >
            <button
              type="button"
              data-ecmd-open-groups-btn="true"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("ecmd-open-groups-modal"));
                }
              }}
              style={{
                flex: 1,
                padding: "4px 6px",
                borderRadius: "6px",
                border: "1px solid rgba(148, 163, 184, 0.32)",
                background: "rgba(15, 23, 42, 0.12)",
                color: "inherit",
                fontSize: "10.5px",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              📂 Groups
            </button>
            <button
              type="button"
              data-ecmd-open-images-btn="true"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("ecmd-open-images-modal"));
                }
              }}
              style={{
                flex: 1,
                padding: "4px 6px",
                borderRadius: "6px",
                border: "1px solid rgba(148, 163, 184, 0.32)",
                background: "rgba(15, 23, 42, 0.12)",
                color: "inherit",
                fontSize: "10.5px",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              🖼️ Images
            </button>
            <button
              type="button"
              data-ecmd-open-tokens-btn="true"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("ecmd-open-tokens-modal"));
                }
              }}
              style={{
                flex: 1,
                padding: "4px 6px",
                borderRadius: "6px",
                border: "1px solid rgba(148, 163, 184, 0.32)",
                background: "rgba(15, 23, 42, 0.12)",
                color: "inherit",
                fontSize: "10.5px",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              🔖 Tokens
            </button>
            <button
              type="button"
              data-ecmd-open-attr-profiles-btn="true"
              onClick={() => setAttrProfilesOpen((v) => !v)}
              style={{
                flex: 1,
                padding: "4px 6px",
                borderRadius: "6px",
                border: attrProfilesOpen ? "1px solid #14B8A6" : "1px solid rgba(148, 163, 184, 0.32)",
                background: attrProfilesOpen ? "rgba(20, 184, 166, 0.20)" : "rgba(15, 23, 42, 0.12)",
                color: "inherit",
                fontSize: "10.5px",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              🎛️ Attributes
            </button>
          </div>
        </div>
      )}
      <EcmdAttributeProfilesModal
        open={attrProfilesOpen}
        onClose={() => setAttrProfilesOpen(false)}
        anchorDoc={wrapRef.current?.ownerDocument || null}
      />
      {showSwatches && (
        <div style={{ display: "flex", gap: "6px", marginLeft: "8px", fontSize: "11px" }}>
          {groupsMeta.map((g) => (
            <span key={g.n} style={{ background: g.bg || "#1e293b", color: g.tx || "#fff", padding: "2px 6px", borderRadius: "4px" }}>
              G{g.n}: {g.nm}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}