import { EcmdPlasmicColorRow, EcmdPlasmicShadowRow } from "./EcmdPlasmicColorRow";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EcmdPaddingBoxControl, EcmdMarginBoxControl, EcmdGapControl, EcmdRadiusBoxControl } from "./EcmdSpacingBoxControl";
import {
  ATTRIBUTE_PROFILES_EVENT,
  EcmdAttributeProfilesModal,
  applyAttributeProfileToDisabledProps,
  attributeProfileToDisabledProps,
  deleteAttributeProfileFromStore,
  loadAttributeProfilesStore,
  saveAttributeProfilesStore,
  type AttributeProfile,
  type AttributeProfilesStore
} from "./EcmdAttributeProfilesModal";
import { EcmdThemeImagesTab } from "./EcmdThemeImagesTab";
import { EcmdThemeTokensTab } from "./EcmdThemeTokensTab";
import {
  EcmdLinkedTokenPill,
  EcmdTokenPopoverSection,
  type EcmdTokenBindingContext
} from "./EcmdTokenBindingBar";
import { EcmdTextShadowControl } from "./EcmdTextShadowControl";
import {
  clearThemeDesignTokenOverride,
  compileDesignTokenCssValue,
  copyThemeGroupAttributes,
  createThemeDesignToken,
  deleteThemeDesignToken,
  duplicateThemeDesignToken,
  extractTextShadowConfig,
  filterAndSortThemeGroups,
  findDesignTokenById,
  hasExplicitTextShadowFields,
  hydrateThemeDesignTokens,
  hydrateThemeImageGroups,
  isZeroBorderWidthValue,
  normalizeBorderStyleValue,
  parseBorderWidthNumericPx,
  renameThemeDesignToken,
  resolveDesignTokenBorderConfig,
  resolveDesignTokenTextShadowConfig,
  resolveThemeBorderMode,
  saveLocalDesignTokensFallback,
  setLiveStatePreview,
  syncImageGroupSlotsAcrossThemes,
  toggleThemeDesignTokenPinned,
  updateThemeDesignTokenValue,
  type ThemeBorderMode,
  type ThemeBorderStyle,
  type ThemeBorderTokenValue,
  type ThemeDesignToken,
  type ThemeDesignTokenType,
  type ThemeDesignTokenValue,
  type ThemeGroupCopyScope,
  type ThemeImageGroup,
  type ThemeListSortMode,
  type ThemeStateTokenRefs,
  type ThemeTextShadowConfig,
  type ThemeTokenAttrKey
} from "../lib/ecmdThemeEngine";

export type GroupStateKey =
  | "default"
  | "hover"
  | "focus"
  | "selected"
  | "selectedHover"
  | "disabled";

export type SubGroupStateKey = Exclude<GroupStateKey, "default">;

export const GROUP_STATE_TABS: Array<{
  id: GroupStateKey;
  label: string;
  shortLabel: string;
  hint: string;
}> = [
  { id: "default", label: "Default", shortLabel: "Default", hint: "Base resting style" },
  { id: "hover", label: "Hover", shortLabel: "Hover", hint: "Interactive hover (not disabled, not selected)" },
  { id: "focus", label: "Focus / Active", shortLabel: "Focus", hint: "Keyboard focus & active press (not disabled)" },
  { id: "selected", label: "Selected", shortLabel: "Selected", hint: "Selected & not disabled (data-ecmd-selected / aria-selected / .is-selected)" },
  { id: "selectedHover", label: "Selected + Hover", shortLabel: "Sel+Hover", hint: "Hovering an already-selected element (not disabled)" },
  { id: "disabled", label: "Disabled", shortLabel: "Disabled", hint: "Disabled state — always wins even if selected" }
];

export interface GroupStateThemeValues extends ThemeTextShadowConfig {
  bg?: string | undefined;
  text?: string | undefined;
  border?: string | undefined;
  icon?: string | undefined;
  outerShadow?: string | undefined;
  innerShadow?: string | undefined;
}

export interface GroupStateOverride extends ThemeTextShadowConfig {
  cl?: GroupStateThemeValues | undefined;
  ms?: GroupStateThemeValues | undefined;
  borderMode?: ThemeBorderMode | undefined;
  borderNone?: boolean | undefined;
  borderWidth?: string | undefined;
  borderStyle?: ThemeBorderStyle | undefined;
  fontWeight?: string | undefined;
  radius?: string | undefined;
  opacity?: string | undefined;
  cursorNotAllowed?: boolean | undefined;
  disabledProps?: Record<string, boolean> | undefined;
  tokenRefs?: ThemeStateTokenRefs | undefined;
}

export type ThemeGroupBreakpointTarget = "all" | "desktop" | "tablet" | "mobile";

export const THEME_GROUP_BREAKPOINT_OPTIONS: Array<{
  value: ThemeGroupBreakpointTarget;
  label: string;
}> = [
  { value: "all", label: "All Breakpoints (Default)" },
  { value: "desktop", label: "🖥️ Desktop (> 1024px)" },
  { value: "tablet", label: "📱 Tablet (768px–1024px)" },
  { value: "mobile", label: "📲 Mobile (< 768px)" }
];

export interface GroupFluidScaleConfig {
  enabled?: boolean | undefined;
  desktopFontPx?: string | number | undefined;
  mobileFontPx?: string | number | undefined;
  desktopPadYPx?: string | number | undefined;
  mobilePadYPx?: string | number | undefined;
  desktopPadXPx?: string | number | undefined;
  mobilePadXPx?: string | number | undefined;
  desktopGapPx?: string | number | undefined;
  mobileGapPx?: string | number | undefined;
  stackOnMobile?: boolean | undefined;
}

export type GroupStylePropKey =
  | "radius"
  | "spacing"
  | "bg"
  | "text"
  | "border"
  | "icon"
  | "selBg"
  | "selText"
  | "hoverBg"
  | "hoverText"
  | "focusBorder"
  | "borderWidth"
  | "fontWeight"
  | "outerShadow"
  | "innerShadow"
  | "textShadow"
  | "opacity"
  | "fluidScale";

export interface DynamicGroupItem extends ThemeTextShadowConfig {
  id: number;
  enabled: boolean;
  name: string;
  selector: string;
  pinned?: boolean | undefined;
  breakpointTarget?: ThemeGroupBreakpointTarget | undefined;
  fluidScale?: GroupFluidScaleConfig | undefined;
  radius: string;
  spacing: boolean;
  padding: string;
  margin: string;
  gap: string;
  clBg: string;
  clText: string;
  clBorder: string;
  clIcon: string;
  clSelBg: string;
  clSelText: string;
  msBg: string;
  msText: string;
  msBorder: string;
  msIcon: string;
  msSelBg: string;
  msSelText: string;
  borderMode?: ThemeBorderMode | undefined;
  borderNone?: boolean | undefined;
  borderWidth?: string | undefined;
  borderStyle?: ThemeBorderStyle | undefined;
  fontWeight?: string | undefined;
  clHoverBg?: string | undefined;
  clHoverText?: string | undefined;
  clFocusBorder?: string | undefined;
  clShadow?: string | undefined;
  clOuterShadow?: string | undefined;
  clInnerShadow?: string | undefined;
  clTextShadow?: ThemeTextShadowConfig | undefined;
  msHoverBg?: string | undefined;
  msHoverText?: string | undefined;
  msFocusBorder?: string | undefined;
  msShadow?: string | undefined;
  msOuterShadow?: string | undefined;
  msInnerShadow?: string | undefined;
  msTextShadow?: ThemeTextShadowConfig | undefined;
  elevation?: string | undefined;
  outerShadow?: string | undefined;
  innerShadow?: string | undefined;
  disabledProps?: Record<string, boolean> | undefined;
  attributeProfileId?: string | undefined;
  tokenRefs?: ThemeStateTokenRefs | undefined;
  stateOverrides?: Partial<Record<SubGroupStateKey, GroupStateOverride>> | undefined;
}

export interface DynamicGroupsPayload {
  selectedId: number | "multi";
  multiIds?: number[] | undefined;
  groups: Record<string, DynamicGroupItem>;
  imageGroups?: ThemeImageGroup[] | undefined;
  designTokens?: ThemeDesignToken[] | undefined;
}

function cleanTokenRefsObj(refs?: ThemeStateTokenRefs): ThemeStateTokenRefs | undefined {
  if (!refs) return undefined;
  const next: ThemeStateTokenRefs = {};
  for (const [k, v] of Object.entries(refs)) {
    if (typeof v === "string" && v.trim()) {
      next[k as ThemeTokenAttrKey] = v.trim();
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function bindTokenToGroupState(
  group: DynamicGroupItem,
  stateKey: GroupStateKey,
  attr: ThemeTokenAttrKey,
  tokenId: string
): DynamicGroupItem {
  if (stateKey === "default") {
    const nextRefs = cleanTokenRefsObj({ ...(group.tokenRefs || {}), [attr]: tokenId });
    return { ...group, tokenRefs: nextRefs };
  }
  const prevOv = group.stateOverrides?.[stateKey] || {};
  const nextRefs = cleanTokenRefsObj({ ...(prevOv.tokenRefs || {}), [attr]: tokenId });
  return {
    ...group,
    stateOverrides: {
      ...(group.stateOverrides || {}),
      [stateKey]: { ...prevOv, tokenRefs: nextRefs }
    }
  };
}

function applyResolvedTokenSnapshotToGroupState(
  group: DynamicGroupItem,
  stateKey: GroupStateKey,
  attr: ThemeTokenAttrKey,
  token: ThemeDesignToken | undefined
): DynamicGroupItem {
  const removeRef = (refs?: ThemeStateTokenRefs): ThemeStateTokenRefs | undefined => {
    if (!refs) return undefined;
    const copy = { ...refs };
    delete copy[attr];
    return cleanTokenRefsObj(copy);
  };

  if (stateKey === "default") {
    const next: DynamicGroupItem = { ...group, tokenRefs: removeRef(group.tokenRefs) };
    if (!token) return next;
    const clCss = compileDesignTokenCssValue(token, "cl");
    const msCss = compileDesignTokenCssValue(token, "ms");
    if (attr === "background") {
      next.clBg = clCss;
      next.msBg = msCss;
    } else if (attr === "text") {
      next.clText = clCss;
      next.msText = msCss;
    } else if (attr === "border") {
      const clCfg = resolveDesignTokenBorderConfig(token, "cl");
      const msCfg = resolveDesignTokenBorderConfig(token, "ms");
      if (clCfg?.color !== undefined) next.clBorder = clCfg.color;
      if (msCfg?.color !== undefined) next.msBorder = msCfg.color;
      if (token.type === "border" && clCfg) {
        if (clCfg.width !== undefined) next.borderWidth = clCfg.width;
        if (clCfg.style !== undefined) next.borderStyle = clCfg.style;
        if (clCfg.borderMode !== undefined) next.borderMode = clCfg.borderMode;
        if (clCfg.borderNone !== undefined) next.borderNone = clCfg.borderNone;
        if (clCfg.radius !== undefined && !next.tokenRefs?.borderRadius) next.radius = clCfg.radius;
      }
    } else if (attr === "borderRadius") {
      next.radius = clCss || msCss;
    } else if (attr === "boxShadow") {
      next.clOuterShadow = clCss;
      next.clShadow = clCss;
      next.msOuterShadow = msCss;
      next.msShadow = msCss;
    } else if (attr === "innerShadow") {
      next.clInnerShadow = clCss;
      next.msInnerShadow = msCss;
    } else if (attr === "textShadow") {
      const clTs = resolveDesignTokenTextShadowConfig(token, "cl");
      const msTs = resolveDesignTokenTextShadowConfig(token, "ms");
      if (clTs) next.clTextShadow = clTs;
      if (msTs) next.msTextShadow = msTs;
    }
    return next;
  }

  const prevOv = group.stateOverrides?.[stateKey] || {};
  const nextOv: GroupStateOverride = {
    ...prevOv,
    tokenRefs: removeRef(prevOv.tokenRefs),
    cl: prevOv.cl ? { ...prevOv.cl } : undefined,
    ms: prevOv.ms ? { ...prevOv.ms } : undefined
  };
  const nextGroup: DynamicGroupItem = { ...group };
  if (token) {
    const clCss = compileDesignTokenCssValue(token, "cl");
    const msCss = compileDesignTokenCssValue(token, "ms");
    if (attr === "background") {
      nextOv.cl = { ...(nextOv.cl || {}), bg: clCss };
      nextOv.ms = { ...(nextOv.ms || {}), bg: msCss };
      if (stateKey === "hover") { nextGroup.clHoverBg = clCss; nextGroup.msHoverBg = msCss; }
      if (stateKey === "selected") { nextGroup.clSelBg = clCss; nextGroup.msSelBg = msCss; }
    } else if (attr === "text") {
      nextOv.cl = { ...(nextOv.cl || {}), text: clCss };
      nextOv.ms = { ...(nextOv.ms || {}), text: msCss };
      if (stateKey === "hover") { nextGroup.clHoverText = clCss; nextGroup.msHoverText = msCss; }
      if (stateKey === "selected") { nextGroup.clSelText = clCss; nextGroup.msSelText = msCss; }
    } else if (attr === "border") {
      const clCfg = resolveDesignTokenBorderConfig(token, "cl");
      const msCfg = resolveDesignTokenBorderConfig(token, "ms");
      if (clCfg?.color !== undefined) nextOv.cl = { ...(nextOv.cl || {}), border: clCfg.color };
      if (msCfg?.color !== undefined) nextOv.ms = { ...(nextOv.ms || {}), border: msCfg.color };
      if (stateKey === "focus") {
        if (clCfg?.color !== undefined) nextGroup.clFocusBorder = clCfg.color;
        if (msCfg?.color !== undefined) nextGroup.msFocusBorder = msCfg.color;
      }
      if (token.type === "border" && clCfg) {
        if (clCfg.width !== undefined) nextOv.borderWidth = clCfg.width;
        if (clCfg.style !== undefined) nextOv.borderStyle = clCfg.style;
        if (clCfg.borderMode !== undefined) nextOv.borderMode = clCfg.borderMode;
        if (clCfg.borderNone !== undefined) nextOv.borderNone = clCfg.borderNone;
        if (clCfg.radius !== undefined && !nextOv.tokenRefs?.borderRadius) nextOv.radius = clCfg.radius;
      }
    } else if (attr === "borderRadius") {
      nextOv.radius = clCss || msCss;
    } else if (attr === "boxShadow") {
      nextOv.cl = { ...(nextOv.cl || {}), outerShadow: clCss };
      nextOv.ms = { ...(nextOv.ms || {}), outerShadow: msCss };
    } else if (attr === "innerShadow") {
      nextOv.cl = { ...(nextOv.cl || {}), innerShadow: clCss };
      nextOv.ms = { ...(nextOv.ms || {}), innerShadow: msCss };
    } else if (attr === "textShadow") {
      const clTs = resolveDesignTokenTextShadowConfig(token, "cl");
      const msTs = resolveDesignTokenTextShadowConfig(token, "ms");
      if (clTs) nextOv.cl = { ...(nextOv.cl || {}), ...clTs };
      if (msTs) nextOv.ms = { ...(nextOv.ms || {}), ...msTs };
    }
  }
  nextGroup.stateOverrides = {
    ...(group.stateOverrides || {}),
    [stateKey]: nextOv
  };
  return nextGroup;
}

export function detachTokenFromGroupState(
  group: DynamicGroupItem,
  stateKey: GroupStateKey,
  attr: ThemeTokenAttrKey,
  tokens: ThemeDesignToken[]
): DynamicGroupItem {
  const tokenId =
    stateKey === "default"
      ? group.tokenRefs?.[attr]
      : group.stateOverrides?.[stateKey]?.tokenRefs?.[attr];
  const token = findDesignTokenById(tokens, tokenId);
  return applyResolvedTokenSnapshotToGroupState(group, stateKey, attr, token);
}

export function deleteDesignTokenWithGroupFallback(
  payload: DynamicGroupsPayload,
  tokenId: string
): DynamicGroupsPayload {
  const tokens = hydrateThemeDesignTokens(payload.designTokens);
  const targetToken = findDesignTokenById(tokens, tokenId);
  const subStates: SubGroupStateKey[] = ["hover", "focus", "selected", "selectedHover", "disabled"];
  const nextGroups: Record<string, DynamicGroupItem> = {};

  for (const [k, rawGroup] of Object.entries(payload.groups || {})) {
    if (!rawGroup) continue;
    let updated = rawGroup;
    if (updated.tokenRefs) {
      for (const [attr, refId] of Object.entries(updated.tokenRefs)) {
        if (refId === tokenId) {
          updated = applyResolvedTokenSnapshotToGroupState(
            updated,
            "default",
            attr as ThemeTokenAttrKey,
            targetToken
          );
        }
      }
    }
    if (updated.stateOverrides) {
      for (const st of subStates) {
        const refs = updated.stateOverrides?.[st]?.tokenRefs;
        if (!refs) continue;
        for (const [attr, refId] of Object.entries(refs)) {
          if (refId === tokenId) {
            updated = applyResolvedTokenSnapshotToGroupState(
              updated,
              st,
              attr as ThemeTokenAttrKey,
              targetToken
            );
          }
        }
      }
    }
    nextGroups[k] = updated;
  }

  return {
    ...payload,
    groups: nextGroups,
    designTokens: deleteThemeDesignToken(tokens, tokenId)
  };
}

function cleanVal(v?: string): string {
  return typeof v === "string" ? v.trim() : "";
}

export function hydrateLegacyStateOverrides(group: DynamicGroupItem): DynamicGroupItem {
  const rawAny = group as any;
  const existing = group.stateOverrides || {};
  const nextOverrides: Partial<Record<SubGroupStateKey, GroupStateOverride>> = {
    ...existing
  };
  const gDis = group.disabledProps || {};

  // Hover hydration from legacy flat clHoverBg/msHoverBg/clHoverText/msHoverText/hoverBg/hoverText
  const clHBg = cleanVal(group.clHoverBg ?? rawAny.hoverBg);
  const msHBg = cleanVal(group.msHoverBg ?? rawAny.hoverBg);
  const clHTxt = cleanVal(group.clHoverText ?? rawAny.hoverText);
  const msHTxt = cleanVal(group.msHoverText ?? rawAny.hoverText);
  if (clHBg || msHBg || clHTxt || msHTxt || existing.hover) {
    const prevH = existing.hover || {};
    const prevHDis: Record<string, boolean> = { ...(prevH.disabledProps || {}) };
    if (gDis["hoverBg"] && prevHDis["bg"] === undefined) prevHDis["bg"] = true;
    if (gDis["hoverText"] && prevHDis["text"] === undefined) prevHDis["text"] = true;
    nextOverrides.hover = {
      ...prevH,
      cl: {
        ...(prevH.cl || {}),
        bg: prevH.cl?.bg !== undefined ? prevH.cl.bg : (clHBg || undefined),
        text: prevH.cl?.text !== undefined ? prevH.cl.text : (clHTxt || undefined)
      },
      ms: {
        ...(prevH.ms || {}),
        bg: prevH.ms?.bg !== undefined ? prevH.ms.bg : (msHBg || undefined),
        text: prevH.ms?.text !== undefined ? prevH.ms.text : (msHTxt || undefined)
      },
      disabledProps: Object.keys(prevHDis).length > 0 ? prevHDis : undefined
    };
  }

  // Selected hydration from legacy flat clSelBg/msSelBg/clSelText/msSelText/selectedBg/selectedText
  const clSBg = cleanVal(group.clSelBg ?? rawAny.selectedBg);
  const msSBg = cleanVal(group.msSelBg ?? rawAny.selectedBg);
  const clSTxt = cleanVal(group.clSelText ?? rawAny.selectedText);
  const msSTxt = cleanVal(group.msSelText ?? rawAny.selectedText);
  if (clSBg || msSBg || clSTxt || msSTxt || existing.selected) {
    const prevS = existing.selected || {};
    const prevSDis: Record<string, boolean> = { ...(prevS.disabledProps || {}) };
    if (gDis["selBg"] && prevSDis["bg"] === undefined) prevSDis["bg"] = true;
    if (gDis["selText"] && prevSDis["text"] === undefined) prevSDis["text"] = true;
    nextOverrides.selected = {
      ...prevS,
      cl: {
        ...(prevS.cl || {}),
        bg: prevS.cl?.bg !== undefined ? prevS.cl.bg : (clSBg || undefined),
        text: prevS.cl?.text !== undefined ? prevS.cl.text : (clSTxt || undefined)
      },
      ms: {
        ...(prevS.ms || {}),
        bg: prevS.ms?.bg !== undefined ? prevS.ms.bg : (msSBg || undefined),
        text: prevS.ms?.text !== undefined ? prevS.ms.text : (msSTxt || undefined)
      },
      disabledProps: Object.keys(prevSDis).length > 0 ? prevSDis : undefined
    };
  }

  // Focus hydration from legacy flat clFocusBorder/msFocusBorder/focusBorder
  const clFBrd = cleanVal(group.clFocusBorder ?? rawAny.focusBorder);
  const msFBrd = cleanVal(group.msFocusBorder ?? rawAny.focusBorder);
  if (clFBrd || msFBrd || existing.focus) {
    const prevF = existing.focus || {};
    const prevFDis: Record<string, boolean> = { ...(prevF.disabledProps || {}) };
    if (gDis["focusBorder"] && prevFDis["border"] === undefined) prevFDis["border"] = true;
    nextOverrides.focus = {
      ...prevF,
      cl: {
        ...(prevF.cl || {}),
        border: prevF.cl?.border !== undefined ? prevF.cl.border : (clFBrd || undefined)
      },
      ms: {
        ...(prevF.ms || {}),
        border: prevF.ms?.border !== undefined ? prevF.ms.border : (msFBrd || undefined)
      },
      disabledProps: Object.keys(prevFDis).length > 0 ? prevFDis : undefined
    };
  }

  return {
    ...group,
    stateOverrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined
  };
}

export function hasStateOverrides(group: DynamicGroupItem | null | undefined, stateKey: GroupStateKey): boolean {
  if (!group) return false;
  if (stateKey === "default") {
    return Boolean(
      cleanVal(group.clBg) ||
      cleanVal(group.msBg) ||
      cleanVal(group.clText) ||
      cleanVal(group.msText) ||
      cleanVal(group.clBorder) ||
      cleanVal(group.msBorder) ||
      cleanVal(group.radius) ||
      cleanVal(group.borderWidth) ||
      cleanVal(group.borderStyle) ||
      group.borderNone ||
      group.borderMode === "none" ||
      cleanVal(group.fontWeight) ||
      cleanVal(group.clOuterShadow) ||
      cleanVal(group.msOuterShadow) ||
      cleanVal(group.clInnerShadow) ||
      cleanVal(group.msInnerShadow) ||
      group.clTextShadow?.textShadowEnabled ||
      group.msTextShadow?.textShadowEnabled ||
      group.textShadowEnabled ||
      Boolean(group.tokenRefs && Object.keys(group.tokenRefs).length > 0)
    );
  }
  const ov = group.stateOverrides?.[stateKey];
  if (!ov) return false;
  const themeHas = (t?: GroupStateThemeValues) =>
    Boolean(
      cleanVal(t?.bg) ||
      cleanVal(t?.text) ||
      cleanVal(t?.border) ||
      cleanVal(t?.icon) ||
      cleanVal(t?.outerShadow) ||
      cleanVal(t?.innerShadow) ||
      t?.textShadowEnabled
    );
  return Boolean(
    themeHas(ov.cl) ||
    themeHas(ov.ms) ||
    ov.textShadowEnabled ||
    cleanVal(ov.borderWidth) ||
    cleanVal(ov.borderStyle) ||
    ov.borderNone ||
    ov.borderMode === "none" ||
    cleanVal(ov.fontWeight) ||
    cleanVal(ov.radius) ||
    cleanVal(ov.opacity) ||
    ov.cursorNotAllowed ||
    Boolean(ov.tokenRefs && Object.keys(ov.tokenRefs).length > 0)
  );
}

export function createGroupWithAttributeProfile(
  slotId: number,
  name: string,
  profile?: AttributeProfile | null,
  prev?: Partial<DynamicGroupItem>
): DynamicGroupItem {
  const profileDisabled = attributeProfileToDisabledProps(profile);
  return {
    id: slotId,
    enabled: true,
    name,
    selector: prev?.selector && prev.selector.trim() ? prev.selector : (".gm-group-" + slotId),
    radius: prev?.radius || "",
    spacing: prev?.spacing ?? false,
    padding: prev?.padding || "",
    margin: prev?.margin || "",
    gap: prev?.gap || "",
    clBg: prev?.clBg || "",
    clText: prev?.clText || "",
    clBorder: prev?.clBorder || "",
    clIcon: prev?.clIcon || "",
    clSelBg: prev?.clSelBg || "",
    clSelText: prev?.clSelText || "",
    msBg: prev?.msBg || "",
    msText: prev?.msText || "",
    msBorder: prev?.msBorder || "",
    msIcon: prev?.msIcon || "",
    msSelBg: prev?.msSelBg || "",
    msSelText: prev?.msSelText || "",
    attributeProfileId: profile?.id,
    disabledProps: profileDisabled
  };
}

function emitChange(props: any, val: string) {
  if (typeof props?.updateValue === "function") props.updateValue(val);
  if (typeof props?.onChange === "function" && props.onChange !== props.updateValue) props.onChange(val);
}

export function buildInitialGroupsFromProps(compProps: any, rawJson?: string): DynamicGroupsPayload {
  let parsed: any = null;
  if (typeof rawJson === "string" && rawJson.trim().startsWith("{")) {
    try { parsed = JSON.parse(rawJson); } catch {}
  }
  const groups: Record<string, DynamicGroupItem> = (parsed && parsed.groups) ? { ...parsed.groups } : {};

  const googleM3Presets: Record<number, DynamicGroupItem> = {
    1: {
      id: 1, enabled: true, name: "Surface Bar", selector: ".gm-bar, .bars",
      radius: "", borderWidth: "0 0 1px 0", fontWeight: "", spacing: false, padding: "", margin: "", gap: "",
      clBg: "#F8FAFD", clText: "#1F1F1F", clBorder: "#E1E3E1", clIcon: "#444746", clSelBg: "#D3E3FD", clSelText: "#041E49",
      clHoverBg: "", clHoverText: "", clFocusBorder: "", clShadow: "0 1px 2px rgba(0,0,0,0.05)",
      msBg: "#28292A", msText: "#E3E3E3", msBorder: "#444746", msIcon: "#C4C7C5", msSelBg: "#004A77", msSelText: "#C2E7FF",
      msHoverBg: "", msHoverText: "", msFocusBorder: "", msShadow: "0 1px 3px rgba(0,0,0,0.35)"
    },
    2: {
      id: 2, enabled: true, name: "Icon Button", selector: ".gm-icon-btn, .headerButtons",
      radius: "9999px", borderWidth: "0px", fontWeight: "500", spacing: false, padding: "", margin: "", gap: "",
      clBg: "transparent", clText: "#444746", clBorder: "transparent", clIcon: "#444746", clSelBg: "#D3E3FD", clSelText: "#041E49",
      clHoverBg: "rgba(31, 31, 31, 0.08)", clHoverText: "#1F1F1F", clFocusBorder: "#0B57D0", clShadow: "none",
      msBg: "transparent", msText: "#E3E3E3", msBorder: "transparent", msIcon: "#E3E3E3", msSelBg: "#004A77", msSelText: "#C2E7FF",
      msHoverBg: "rgba(227, 227, 227, 0.08)", msHoverText: "#FFFFFF", msFocusBorder: "#A8C7FA", msShadow: "none"
    },
    3: {
      id: 3, enabled: true, name: "Dialog & Drawer", selector: ".gm-dialog, .modals",
      radius: "16px", borderWidth: "1px", fontWeight: "", spacing: false, padding: "", margin: "", gap: "",
      clBg: "#FFFFFF", clText: "#1F1F1F", clBorder: "#E1E3E1", clIcon: "#444746", clSelBg: "#D3E3FD", clSelText: "#041E49",
      clHoverBg: "", clHoverText: "", clFocusBorder: "", clShadow: "0 8px 24px rgba(15, 23, 42, 0.14), 0 2px 6px rgba(15, 23, 42, 0.08)",
      msBg: "#303134", msText: "#E3E3E3", msBorder: "#444746", msIcon: "#C4C7C5", msSelBg: "#004A77", msSelText: "#C2E7FF",
      msHoverBg: "", msHoverText: "", msFocusBorder: "", msShadow: "0 12px 32px rgba(0, 0, 0, 0.52), 0 2px 6px rgba(0, 0, 0, 0.36)"
    },
    4: {
      id: 4, enabled: true, name: "Surface Card", selector: ".gm-card, .cards",
      radius: "12px", borderWidth: "1px", fontWeight: "", spacing: false, padding: "", margin: "", gap: "",
      clBg: "#F3F6FC", clText: "#1F1F1F", clBorder: "#E1E3E1", clIcon: "#444746", clSelBg: "#D3E3FD", clSelText: "#041E49",
      clHoverBg: "#EDF2FA", clHoverText: "", clFocusBorder: "#0B57D0", clShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
      msBg: "#28292A", msText: "#E3E3E3", msBorder: "#444746", msIcon: "#C4C7C5", msSelBg: "#004A77", msSelText: "#C2E7FF",
      msHoverBg: "#2E3032", msHoverText: "", msFocusBorder: "#A8C7FA", msShadow: "0 2px 6px rgba(0, 0, 0, 0.36)"
    },
    5: {
      id: 5, enabled: true, name: "Menu Item", selector: ".gm-menu-item, .listbuttons",
      radius: "8px", borderWidth: "0px", fontWeight: "500", spacing: false, padding: "", margin: "", gap: "",
      clBg: "transparent", clText: "#1F1F1F", clBorder: "transparent", clIcon: "#444746", clSelBg: "#D3E3FD", clSelText: "#041E49",
      clHoverBg: "rgba(31, 31, 31, 0.08)", clHoverText: "#1F1F1F", clFocusBorder: "#0B57D0", clShadow: "none",
      msBg: "transparent", msText: "#E3E3E3", msBorder: "transparent", msIcon: "#C4C7C5", msSelBg: "#004A77", msSelText: "#C2E7FF",
      msHoverBg: "rgba(227, 227, 227, 0.08)", msHoverText: "#E3E3E3", msFocusBorder: "#A8C7FA", msShadow: "none"
    },
    6: {
      id: 6, enabled: true, name: "Filled Button", selector: ".gm-btn-filled, .btn-primary",
      radius: "9999px", borderWidth: "0px", fontWeight: "500", spacing: false, padding: "", margin: "", gap: "",
      clBg: "#0B57D0", clText: "#FFFFFF", clBorder: "transparent", clIcon: "#FFFFFF", clSelBg: "#0842A0", clSelText: "#FFFFFF",
      clHoverBg: "#0842A0", clHoverText: "#FFFFFF", clFocusBorder: "#0B57D0", clShadow: "0 1px 2px rgba(0, 0, 0, 0.18)",
      msBg: "#A8C7FA", msText: "#062E6F", msBorder: "transparent", msIcon: "#062E6F", msSelBg: "#8AB4F8", msSelText: "#041E49",
      msHoverBg: "#B8D4FE", msHoverText: "#041E49", msFocusBorder: "#D3E3FD", msShadow: "0 1px 3px rgba(0, 0, 0, 0.42)"
    },
    7: {
      id: 7, enabled: true, name: "Tonal Button", selector: ".gm-btn-tonal, .btn-tonal",
      radius: "9999px", borderWidth: "0px", fontWeight: "500", spacing: false, padding: "", margin: "", gap: "",
      clBg: "#D3E3FD", clText: "#041E49", clBorder: "transparent", clIcon: "#041E49", clSelBg: "#A8C7FA", clSelText: "#041E49",
      clHoverBg: "#C2D7FC", clHoverText: "#041E49", clFocusBorder: "#0B57D0", clShadow: "none",
      msBg: "#004A77", msText: "#C2E7FF", msBorder: "transparent", msIcon: "#C2E7FF", msSelBg: "#00639B", msSelText: "#D3E3FD",
      msHoverBg: "#005B8F", msHoverText: "#D3E3FD", msFocusBorder: "#A8C7FA", msShadow: "none"
    },
    8: {
      id: 8, enabled: true, name: "Outlined Field", selector: ".gm-field, .inputs",
      radius: "8px", borderWidth: "1px", fontWeight: "400", spacing: false, padding: "", margin: "", gap: "",
      clBg: "#FFFFFF", clText: "#1F1F1F", clBorder: "#747775", clIcon: "#444746", clSelBg: "#FFFFFF", clSelText: "#0B57D0",
      clHoverBg: "#FFFFFF", clHoverText: "#1F1F1F", clFocusBorder: "#0B57D0", clShadow: "none",
      msBg: "#1F1F1F", msText: "#E3E3E3", msBorder: "#8E918F", msIcon: "#C4C7C5", msSelBg: "#1F1F1F", msSelText: "#A8C7FA",
      msHoverBg: "#1F1F1F", msHoverText: "#E3E3E3", msFocusBorder: "#A8C7FA", msShadow: "none"
    },
    9: {
      id: 9, enabled: true, name: "Subtle Text", selector: ".gm-text-subtle, .text-muted",
      radius: "", borderWidth: "", fontWeight: "400", spacing: false, padding: "", margin: "", gap: "",
      clBg: "", clText: "#444746", clBorder: "", clIcon: "#444746", clSelBg: "", clSelText: "",
      clHoverBg: "", clHoverText: "#1F1F1F", clFocusBorder: "", clShadow: "",
      msBg: "", msText: "#C4C7C5", msBorder: "", msIcon: "#C4C7C5", msSelBg: "", msSelText: "",
      msHoverBg: "", msHoverText: "#E3E3E3", msFocusBorder: "", msShadow: ""
    },
    10: {
      id: 10, enabled: true, name: "Assist Chip", selector: ".gm-chip, .chips",
      radius: "8px", borderWidth: "1px", fontWeight: "500", spacing: false, padding: "", margin: "", gap: "",
      clBg: "#F0F4F9", clText: "#1F1F1F", clBorder: "#C4C7C5", clIcon: "#444746", clSelBg: "#D3E3FD", clSelText: "#041E49",
      clHoverBg: "#E4EAF2", clHoverText: "#1F1F1F", clFocusBorder: "#0B57D0", clShadow: "none",
      msBg: "#333537", msText: "#E3E3E3", msBorder: "#444746", msIcon: "#C4C7C5", msSelBg: "#004A77", msSelText: "#C2E7FF",
      msHoverBg: "#3C4043", msHoverText: "#FFFFFF", msFocusBorder: "#A8C7FA", msShadow: "none"
    }
  };

  const oldAutoNames = new Set([
    "bars & surfaces", "bars & header", "header buttons", "modals & cards", "modals & drawers",
    "cards & surfaces", "list buttons", "primary cta buttons", "tonal / secondary btns",
    "inputs & fields", "muted / secondary text", "chips & badges",
    "group 4", "group 5", "group 6", "group 7", "group 8"
  ]);
  const oldAutoSelectors = new Set([
    ".bars", ".headerbuttons", ".modals", ".cards", ".listbuttons",
    ".btn-primary", ".btn-tonal", ".inputs", ".text-muted", ".chips",
    ".group-4", ".group-6", ".group-7", ".group-8"
  ]);

  // Only seed default groups if rawJson has NEVER been saved yet (so if user deletes all groups down to 0, they stay deleted!)
  const hasSavedJson = Boolean(parsed && parsed.groups);
  if (!hasSavedJson) {
    for (let n = 1; n <= 10; n++) {
      const k = String(n);
      const d = googleM3Presets[n];
      if (!d) continue;
      if (!groups[k]) {
        const propNm = (n <= 8 && compProps?.["group" + n + "Name"]) ? String(compProps["group" + n + "Name"]) : "";
        const propSel = (n <= 8 && compProps?.["group" + n + "Selector"]) ? String(compProps["group" + n + "Selector"]) : "";
        const useM3Name = !propNm || oldAutoNames.has(propNm.trim().toLowerCase());
        const useM3Sel = !propSel || oldAutoSelectors.has(propSel.trim().toLowerCase());
        groups[k] = hydrateLegacyStateOverrides({
          ...d,
          enabled: true,
          name: useM3Name ? d.name : propNm,
          selector: useM3Sel ? d.selector : propSel,
          radius: (n <= 8 && compProps?.["group" + n + "Radius"]) ? compProps["group" + n + "Radius"] : d.radius,
          spacing: n <= 8 ? Boolean(compProps?.["group" + n + "Spacing"]) : d.spacing,
          padding: (n <= 8 && compProps?.["group" + n + "Padding"]) ? compProps["group" + n + "Padding"] : d.padding,
          margin: (n <= 8 && compProps?.["group" + n + "Margin"]) ? compProps["group" + n + "Margin"] : d.margin,
          gap: (n <= 8 && compProps?.["group" + n + "Gap"]) ? compProps["group" + n + "Gap"] : d.gap,
          clBg: (n <= 8 && compProps?.["cl_g" + n + "Bg"]) ? compProps["cl_g" + n + "Bg"] : d.clBg,
          clText: (n <= 8 && compProps?.["cl_g" + n + "Text"]) ? compProps["cl_g" + n + "Text"] : d.clText,
          clBorder: (n <= 8 && compProps?.["cl_g" + n + "Border"]) ? compProps["cl_g" + n + "Border"] : d.clBorder,
          clIcon: (n <= 8 && compProps?.["cl_g" + n + "Icon"]) ? compProps["cl_g" + n + "Icon"] : d.clIcon,
          clSelBg: (n <= 8 && compProps?.["cl_g" + n + "SelBg"]) ? compProps["cl_g" + n + "SelBg"] : d.clSelBg,
          clSelText: (n <= 8 && compProps?.["cl_g" + n + "SelText"]) ? compProps["cl_g" + n + "SelText"] : d.clSelText,
          clOuterShadow: d.clShadow ?? "",
          clInnerShadow: "",
          msBg: (n <= 8 && compProps?.["ms_g" + n + "Bg"]) ? compProps["ms_g" + n + "Bg"] : d.msBg,
          msText: (n <= 8 && compProps?.["ms_g" + n + "Text"]) ? compProps["ms_g" + n + "Text"] : d.msText,
          msBorder: (n <= 8 && compProps?.["ms_g" + n + "Border"]) ? compProps["ms_g" + n + "Border"] : d.msBorder,
          msIcon: (n <= 8 && compProps?.["ms_g" + n + "Icon"]) ? compProps["ms_g" + n + "Icon"] : d.msIcon,
          msSelBg: (n <= 8 && compProps?.["ms_g" + n + "SelBg"]) ? compProps["ms_g" + n + "SelBg"] : d.msSelBg,
          msSelText: (n <= 8 && compProps?.["ms_g" + n + "SelText"]) ? compProps["ms_g" + n + "SelText"] : d.msSelText,
          msOuterShadow: d.msShadow ?? "",
          msInnerShadow: ""
        });
      }
    }
  } else {
    // Auto-upgrade untouched legacy group names/selectors AND seamlessly hydrate legacy elevation/shadow into clOuterShadow/msOuterShadow + clInnerShadow/msInnerShadow!
    Object.keys(groups).forEach((k) => {
      const ex = groups[k];
      if (!ex) return;
      const numId = Number(k);
      const d = Number.isFinite(numId) ? googleM3Presets[numId] : undefined;
      const curNm = (ex.name || "").trim().toLowerCase();
      const curSel = (ex.selector || "").trim().toLowerCase();

      const resolvedClOuter =
        ex.clOuterShadow !== undefined
          ? ex.clOuterShadow
          : ex.outerShadow !== undefined
            ? ex.outerShadow
            : ex.elevation !== undefined
              ? ex.elevation
              : ex.clShadow !== undefined
                ? ex.clShadow
                : (d?.clShadow ?? "");

      const resolvedMsOuter =
        ex.msOuterShadow !== undefined
          ? ex.msOuterShadow
          : ex.outerShadow !== undefined
            ? ex.outerShadow
            : ex.elevation !== undefined
              ? ex.elevation
              : ex.msShadow !== undefined
                ? ex.msShadow
                : (d?.msShadow ?? "");

      const resolvedClInner =
        ex.clInnerShadow !== undefined
          ? ex.clInnerShadow
          : (ex.innerShadow !== undefined ? ex.innerShadow : "");

      const resolvedMsInner =
        ex.msInnerShadow !== undefined
          ? ex.msInnerShadow
          : (ex.innerShadow !== undefined ? ex.innerShadow : "");

      let nextDisabled: Record<string, boolean> | undefined = ex.disabledProps ? { ...ex.disabledProps } : undefined;
      if (nextDisabled && (nextDisabled["shadow"] || nextDisabled["elevation"]) && nextDisabled["outerShadow"] === undefined) {
        nextDisabled["outerShadow"] = true;
      }

      groups[k] = hydrateLegacyStateOverrides({
        ...ex,
        name: d && oldAutoNames.has(curNm) ? d.name : ex.name,
        selector: d && oldAutoSelectors.has(curSel) ? d.selector : ex.selector,
        borderWidth: ex.borderWidth !== undefined ? ex.borderWidth : d?.borderWidth,
        fontWeight: ex.fontWeight !== undefined ? ex.fontWeight : d?.fontWeight,
        clHoverBg: ex.clHoverBg !== undefined ? ex.clHoverBg : d?.clHoverBg,
        clHoverText: ex.clHoverText !== undefined ? ex.clHoverText : d?.clHoverText,
        clFocusBorder: ex.clFocusBorder !== undefined ? ex.clFocusBorder : d?.clFocusBorder,
        clShadow: resolvedClOuter,
        clOuterShadow: resolvedClOuter,
        clInnerShadow: resolvedClInner,
        msHoverBg: ex.msHoverBg !== undefined ? ex.msHoverBg : d?.msHoverBg,
        msHoverText: ex.msHoverText !== undefined ? ex.msHoverText : d?.msHoverText,
        msFocusBorder: ex.msFocusBorder !== undefined ? ex.msFocusBorder : d?.msFocusBorder,
        msShadow: resolvedMsOuter,
        msOuterShadow: resolvedMsOuter,
        msInnerShadow: resolvedMsInner,
        disabledProps: nextDisabled
      });
    });
  }

  const enabledIds = Object.values(groups).filter((g) => g && g.enabled).map((g) => g.id).sort((a, b) => a - b);
  const firstId = enabledIds[0] ?? 0;
  const rawSel = parsed?.selectedId === "all" ? "multi" : (parsed?.selectedId ?? firstId);
  const multiIds = Array.isArray(parsed?.multiIds) ? parsed.multiIds : enabledIds.slice(0, 2);
  const imageGroups = hydrateThemeImageGroups(parsed?.imageGroups);
  const designTokens = hydrateThemeDesignTokens(parsed?.designTokens);
  return { selectedId: rawSel, multiIds, groups, imageGroups, designTokens };
}

function findNextAvailableGroupSlotAndName(groups: Record<string, DynamicGroupItem>): { slotId: number; defaultName: string } {
  const usedNames = new Set(
    Object.values(groups)
      .filter((g) => g && g.enabled)
      .map((g) => (g.name || "").trim().toLowerCase())
  );
  let slotId = 1;
  for (let i = 1; i <= 100; i++) {
    const existing = groups[String(i)];
    if (!existing || !existing.enabled) { slotId = i; break; }
  }
  let defaultName = "Group " + slotId;
  if (usedNames.has(defaultName.toLowerCase())) {
    for (let i = 1; i <= 100; i++) {
      const candidate = "Group " + i;
      if (!usedNames.has(candidate.toLowerCase())) {
        defaultName = candidate;
        break;
      }
    }
  }
  return { slotId, defaultName };
}

// --- Color Row with Native Swatch + Hex Input + Far-Right 3-Dot Menu (Eyedropper, Transparent, Copy, Clear) + Mixed Indicator ---
function ColorRow({ label, value, isMixed, onChange }: { label: string; value: string; isMixed?: boolean; onChange: (v: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const hexMatch = /^#[0-9a-fA-F]{6}$/.test((value || "").trim()) ? value.trim() : "#0F172A";
  const isTrans = (value || "").trim().toLowerCase() === "transparent";

  useEffect(() => {
    if (!menuOpen) return;
    const doc = btnRef.current?.ownerDocument || document;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    doc.addEventListener("mousedown", onDown, true);
    return () => doc.removeEventListener("mousedown", onDown, true);
  }, [menuOpen]);

  const pickWithEyedropper = async () => {
    setMenuOpen(false);
    try {
      const docWin: any = btnRef.current?.ownerDocument?.defaultView || window;
      let topEyeDropper: any = undefined;
      try {
        topEyeDropper = (window.top as any)?.EyeDropper;
      } catch {
        // Cross-origin iframe access to window.top is blocked
      }
      const EyeDropperCtor = docWin.EyeDropper || (window as any).EyeDropper || topEyeDropper;
      if (EyeDropperCtor) {
        const dropper = new EyeDropperCtor();
        const res = await dropper.open();
        if (res?.sRGBHex) onChange(res.sRGBHex.toUpperCase());
      }
    } catch {}
  };

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "3px 0" }}>
      <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500, width: "92px", flexShrink: 0 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "5px", flex: 1, minWidth: 0 }}>
        <label
          title="Click to open color picker"
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "5px",
            border: isMixed ? "1px dashed #8B5CF6" : "1px solid #CBD5E1",
            background: isMixed
              ? "linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 50%, #94A3B8 100%)"
              : isTrans
                ? "repeating-conic-gradient(#CBD5E1 0% 25%, #FFFFFF 0% 50%) 50% / 8px 8px"
                : (value && value.trim() ? value.trim() : "#FFFFFF"),
            cursor: "pointer",
            flexShrink: 0,
            position: "relative",
            overflow: "hidden"
          }}
        >
          <input
            type="color"
            value={hexMatch}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer" }}
          />
        </label>
        <input
          type="text"
          value={isMixed ? "" : (value || "")}
          placeholder={isMixed ? "Mixed — edit to sync" : "unset"}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "4px 7px",
            fontSize: "11.5px",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            borderRadius: "6px",
            border: isMixed ? "1px dashed rgba(139,92,246,0.55)" : "1px solid #E2E8F0",
            background: isMixed ? "rgba(139,92,246,0.05)" : "#F8FAFC",
            color: "#0F172A",
            outline: "none"
          }}
        />
        <button
          ref={btnRef}
          type="button"
          title="Color Tools (Eyedropper, Transparent, Clear)"
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            width: "22px",
            height: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: menuOpen ? "1px solid #0D9488" : "1px solid #E2E8F0",
            borderRadius: "5px",
            background: menuOpen ? "rgba(13,148,136,0.10)" : "#F8FAFC",
            color: "#475569",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
            padding: 0
          }}
        >
          ⋮
        </button>
      </div>

      {menuOpen && (
        <div
          ref={menuRef}
          style={{
            position: "absolute",
            top: "28px",
            right: 0,
            width: "168px",
            background: "#FFFFFF",
            border: "1px solid #CBD5E1",
            borderRadius: "8px",
            boxShadow: "0 12px 28px rgba(15, 23, 42, 0.22)",
            padding: "4px",
            zIndex: 2147483646,
            display: "flex",
            flexDirection: "column",
            gap: "2px"
          }}
        >
          <button
            type="button"
            onClick={pickWithEyedropper}
            style={{ display: "flex", alignItems: "center", gap: "7px", width: "100%", textAlign: "left", padding: "6px 8px", border: "none", borderRadius: "5px", background: "transparent", color: "#0F172A", fontSize: "11.5px", fontWeight: 600, cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span>💧</span><span>Eyedropper</span>
          </button>
          <button
            type="button"
            onClick={() => { onChange("transparent"); setMenuOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: "7px", width: "100%", textAlign: "left", padding: "6px 8px", border: "none", borderRadius: "5px", background: "transparent", color: "#0F172A", fontSize: "11.5px", fontWeight: 500, cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span>🫥</span><span>Set Transparent</span>
          </button>
          {value && !isMixed && (
            <button
              type="button"
              onClick={() => { navigator.clipboard?.writeText(value); setMenuOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: "7px", width: "100%", textAlign: "left", padding: "6px 8px", border: "none", borderRadius: "5px", background: "transparent", color: "#0F172A", fontSize: "11.5px", fontWeight: 500, cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F1F5F9")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span>📋</span><span>Copy Value</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => { onChange(""); setMenuOpen(false); }}
            style={{ display: "flex", alignItems: "center", gap: "7px", width: "100%", textAlign: "left", padding: "6px 8px", border: "none", borderRadius: "5px", background: "transparent", color: "#DC2626", fontSize: "11.5px", fontWeight: 500, cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#FEF2F2")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span>✕</span><span>Clear (Unset)</span>
          </button>
        </div>
      )}
    </div>
  );
}

const STUDIO_UI_STORAGE_KEY = "ecmd_group_studio_ui_state_v2";

interface WinBoxRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface PersistedStudioUI {
  panelOpen: boolean;
  multiPickerOpen: boolean;
  editPalette?: string;
  activeStudioTab?: "groups" | "images" | "tokens";
  groupSortBy?: ThemeListSortMode;
  hasMoved: boolean;
  box: WinBoxRect;
}

function normalizeSortMode(raw: unknown): ThemeListSortMode {
  return raw === "za" || raw === "custom" ? raw : "az";
}

let memoryStudioUI: PersistedStudioUI | null = null;

function clampBoxToViewport(box: WinBoxRect, minW: number, minH: number, docWin: Window): WinBoxRect {
  const vw = docWin.innerWidth || 1280;
  const vh = docWin.innerHeight || 800;
  const width = Math.max(minW, Math.min(box.width, Math.max(minW, vw - 16)));
  const height = Math.max(minH, Math.min(box.height, Math.max(minH, vh - 16)));
  const left = Math.max(4, Math.min(box.left, Math.max(4, vw - 80)));
  const top = Math.max(4, Math.min(box.top, Math.max(4, vh - 48)));
  return { top, left, width, height };
}

function loadStudioUI(minW: number, minH: number, docWin: Window): PersistedStudioUI | null {
  try {
    const latestRaw = window.localStorage.getItem(STUDIO_UI_STORAGE_KEY);
    if (latestRaw) {
      const lp = JSON.parse(latestRaw);
      if (lp && lp.box && typeof lp.box.width === "number") {
        memoryStudioUI = {
          panelOpen: Boolean(lp.panelOpen),
          multiPickerOpen: Boolean(lp.multiPickerOpen),
          editPalette: lp.editPalette,
          activeStudioTab: lp.activeStudioTab === "images" ? "images" : lp.activeStudioTab === "tokens" ? "tokens" : "groups",
          groupSortBy: normalizeSortMode(lp.groupSortBy),
          hasMoved: Boolean(lp.hasMoved),
          box: clampBoxToViewport(lp.box, minW, minH, docWin)
        };
        return memoryStudioUI;
      }
    }
  } catch {}
  if (memoryStudioUI) {
    return { ...memoryStudioUI, box: clampBoxToViewport(memoryStudioUI.box, minW, minH, docWin) };
  }
  try {
    const raw = window.localStorage.getItem(STUDIO_UI_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && p.box && typeof p.box.width === "number") {
      const loaded: PersistedStudioUI = {
        panelOpen: Boolean(p.panelOpen),
        multiPickerOpen: Boolean(p.multiPickerOpen),
        editPalette: typeof p.editPalette === "string" ? p.editPalette : undefined,
        activeStudioTab: p.activeStudioTab === "images" ? "images" : p.activeStudioTab === "tokens" ? "tokens" : "groups",
        groupSortBy: normalizeSortMode(p.groupSortBy),
        hasMoved: Boolean(p.hasMoved),
        box: clampBoxToViewport(p.box, minW, minH, docWin)
      };
      memoryStudioUI = loaded;
      return loaded;
    }
  } catch {}
  return null;
}

function saveStudioUI(next: PersistedStudioUI) {
  memoryStudioUI = next;
  try {
    window.localStorage.setItem(STUDIO_UI_STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

export const STUDIO_THEME_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "cl", label: "☀️ Light theme" },
  { id: "ms", label: "🌙 Dark theme" }
];
export function EcmdDynamicGroupManagerControl(props: any) {
  const MIN_W = 346;
  const MIN_H = 440;
  const ASPECT = MIN_W / MIN_H;

  const compProps = props?.componentProps || {};
  const propIsMs = compProps?.presetTheme === "midnight-slate";
  const triggerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const getDocWin = (): Window => triggerRef.current?.ownerDocument?.defaultView || modalRef.current?.ownerDocument?.defaultView || window;
  const savedInit = loadStudioUI(MIN_W, MIN_H, typeof window !== "undefined" ? window : ({} as any));

  const [editPalette, setEditPalette] = useState<string>(() => savedInit?.editPalette || (propIsMs ? "ms" : "cl"));
  const [activeStudioTab, setActiveStudioTab] = useState<"groups" | "images" | "tokens">(() =>
    savedInit?.activeStudioTab === "images" ? "images" : savedInit?.activeStudioTab === "tokens" ? "tokens" : "groups"
  );
  const [openBorderTokenTray, setOpenBorderTokenTray] = useState<string | null>(null);
  const [openRadiusTokenTray, setOpenRadiusTokenTray] = useState<string | null>(null);
  const [borderTokenEditMode, setBorderTokenEditMode] = useState(false);
  const [borderTokenEditScope, setBorderTokenEditScope] = useState<"all" | "theme">("all");
  const [radiusTokenEditMode, setRadiusTokenEditMode] = useState(false);
  const [radiusTokenEditScope, setRadiusTokenEditScope] = useState<"all" | "theme">("all");
  const [state, setState] = useState<DynamicGroupsPayload>(() => buildInitialGroupsFromProps(compProps, props?.value));
  const [panelOpen, setPanelOpen] = useState<boolean>(() => savedInit ? savedInit.panelOpen : false);
  const [multiPickerOpen, setMultiPickerOpen] = useState<boolean>(() => savedInit ? savedInit.multiPickerOpen : false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | "multi" | "revert" | null>(null);
  const [activeState, setActiveState] = useState<GroupStateKey>("default");
  const [liveStatePreviewEnabled, setLiveStatePreviewEnabled] = useState<boolean>(true);
  const [fluidScaleOpen, setFluidScaleOpen] = useState<boolean>(false);
  const [attrStore, setAttrStore] = useState<AttributeProfilesStore>(() => loadAttributeProfilesStore());
  const [attrProfilesOpen, setAttrProfilesOpen] = useState<boolean>(false);
  const [newGroupProfileId, setNewGroupProfileId] = useState<string>(() => loadAttributeProfilesStore().defaultProfileId);
  const [multiProfileId, setMultiProfileId] = useState<string>("");
  const [groupSearch, setGroupSearch] = useState<string>("");
  const [groupSortBy, setGroupSortBy] = useState<ThemeListSortMode>(() => normalizeSortMode(savedInit?.groupSortBy));
  const [focusedRenameId, setFocusedRenameId] = useState<number | null>(null);
  const [frozenOrderIds, setFrozenOrderIds] = useState<number[] | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<number>>(() => {
    const initSel = buildInitialGroupsFromProps(compProps, props?.value).selectedId;
    return typeof initSel === "number" && initSel > 0 ? new Set([initSel]) : new Set();
  });
  const [allCollapsed, setAllCollapsed] = useState<boolean>(false);
  const [copyMenuTargetId, setCopyMenuTargetId] = useState<number | null>(null);
  const [copyScope, setCopyScope] = useState<ThemeGroupCopyScope>("activeThemeAllStates");
  const [copySearch, setCopySearch] = useState<string>("");
  const [copyUndoNotice, setCopyUndoNotice] = useState<{
    targetId: number;
    sourceName: string;
    scopeLabel: string;
    previousGroup: DynamicGroupItem;
  } | null>(null);
  const copyUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFocusGroupIdRef = useRef<number | null>(null);
  const groupCardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const groupRenameInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [winBox, setWinBox] = useState<WinBoxRect>(() => savedInit?.box || {
    top: 84,
    left: 100,
    width: MIN_W,
    height: 520
  });
  const hasUserMovedRef = useRef<boolean>(Boolean(savedInit?.hasMoved));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onAttrSync = (e: Event) => {
      const ce = e as CustomEvent<AttributeProfilesStore>;
      const next = ce.detail && Array.isArray(ce.detail.profiles) ? ce.detail : loadAttributeProfilesStore();
      setAttrStore(next);
      setNewGroupProfileId((prev) =>
        next.profiles.some((p) => p.id === prev) ? prev : next.defaultProfileId
      );
      setMultiProfileId((prev) =>
        prev && next.profiles.some((p) => p.id === prev) ? prev : ""
      );
    };
    const onOpenGroups = () => {
      setActiveStudioTab("groups");
      setPanelOpen(true);
    };
    const onOpenImages = () => {
      setActiveStudioTab("images");
      setPanelOpen(true);
    };
    const onOpenTokens = () => {
      setActiveStudioTab("tokens");
      setPanelOpen(true);
    };
    window.addEventListener(ATTRIBUTE_PROFILES_EVENT, onAttrSync);
    window.addEventListener("ecmd-open-groups-modal", onOpenGroups);
    window.addEventListener("ecmd-open-images-modal", onOpenImages);
    window.addEventListener("ecmd-open-tokens-modal", onOpenTokens);
    return () => {
      window.removeEventListener(ATTRIBUTE_PROFILES_EVENT, onAttrSync);
      window.removeEventListener("ecmd-open-groups-modal", onOpenGroups);
      window.removeEventListener("ecmd-open-images-modal", onOpenImages);
      window.removeEventListener("ecmd-open-tokens-modal", onOpenTokens);
    };
  }, []);

  // Sync if user changes Active Theme dropdown outside the popup
  const prevPropThemeRef = useRef(compProps?.presetTheme);
  useEffect(() => {
    if (prevPropThemeRef.current !== compProps?.presetTheme) {
      prevPropThemeRef.current = compProps?.presetTheme;
      setEditPalette(propIsMs ? "ms" : "cl");
    }
  }, [compProps?.presetTheme, propIsMs]);

  useEffect(() => {
    setState(buildInitialGroupsFromProps(compProps, props?.value));
  }, [props?.value]);

  const isMs = editPalette === "ms";

  // Initial default placement ONLY if user has never moved/resized the popup yet; otherwise clamp saved box to Plasmic Studio ownerDocument window!
  useLayoutEffect(() => {
    if (!triggerRef.current) return;
    const docWin = getDocWin();
    const latest = loadStudioUI(MIN_W, MIN_H, docWin);
    if (latest && latest.hasMoved) {
      hasUserMovedRef.current = true;
      setWinBox(latest.box);
      return;
    }
    if (!panelOpen || hasUserMovedRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const initH = Math.min(540, Math.max(MIN_H, docWin.innerHeight - 48));
    const preferLeft = rect.left - MIN_W - 16;
    const left = preferLeft >= 12 ? preferLeft : Math.max(12, Math.min(rect.right - MIN_W, docWin.innerWidth - MIN_W - 12));
    const top = Math.max(14, Math.min(rect.top - 28, docWin.innerHeight - initH - 14));
    setWinBox({ top, left, width: MIN_W, height: initH });
  }, [panelOpen]);

  // Persist open/closed state, multi-picker state, active palette, sort preference, and exact window size + coordinates on every change!
  useEffect(() => {
    saveStudioUI({
      panelOpen,
      multiPickerOpen,
      editPalette,
      activeStudioTab,
      groupSortBy,
      hasMoved: hasUserMovedRef.current,
      box: winBox
    });
  }, [panelOpen, multiPickerOpen, editPalette, activeStudioTab, groupSortBy, winBox]);

  const startHeaderDrag = (e: React.MouseEvent) => {
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === "select" || tag === "option" || tag === "button") return;
    e.preventDefault();
    e.stopPropagation();
    hasUserMovedRef.current = true;
    const doc = modalRef.current?.ownerDocument || document;
    const docWin = doc.defaultView || window;
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { ...winBox };
    const onMove = (ev: MouseEvent) => {
      const nextLeft = Math.max(4, Math.min(orig.left + (ev.clientX - startX), docWin.innerWidth - 80));
      const nextTop = Math.max(4, Math.min(orig.top + (ev.clientY - startY), docWin.innerHeight - 48));
      setWinBox((prev) => ({ ...prev, left: nextLeft, top: nextTop }));
    };
    const onUp = () => {
      doc.removeEventListener("mousemove", onMove, true);
      doc.removeEventListener("mouseup", onUp, true);
    };
    doc.addEventListener("mousemove", onMove, true);
    doc.addEventListener("mouseup", onUp, true);
  };

  // Equal / Proportional Window Resize via Top Bar Edge OR Bottom-Left Corner Grip (locked to MIN_W x MIN_H floor!)
  const startProportionalResize = (mode: "top" | "bottom-left") => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    hasUserMovedRef.current = true;
    const doc = modalRef.current?.ownerDocument || document;
    const docWin = doc.defaultView || window;
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { ...winBox };
    const ratio = orig.width / orig.height || ASPECT;

    const onMove = (ev: MouseEvent) => {
      if (mode === "top") {
        // Pulling UP (negative dy) grows height AND width equally, keeping bottom-center anchored!
        const dy = startY - ev.clientY;
        const maxH = orig.top + orig.height - 8;
        const nextH = Math.max(MIN_H, Math.min(maxH, orig.height + dy));
        const scale = nextH / orig.height;
        const nextW = Math.max(MIN_W, Math.min(docWin.innerWidth - 16, Math.round(orig.width * scale)));
        const syncedH = Math.max(MIN_H, Math.round(nextW / ratio));
        const bottomEdge = orig.top + orig.height;
        const centerX = orig.left + orig.width / 2;
        const nextTop = Math.max(6, bottomEdge - syncedH);
        const nextLeft = Math.max(6, Math.min(docWin.innerWidth - nextW - 6, Math.round(centerX - nextW / 2)));
        setWinBox({ top: nextTop, left: nextLeft, width: nextW, height: syncedH });
      } else {
        // Bottom-left corner: pulling LEFT (-dx) and/or DOWN (+dy) scales width & height equally, keeping top-right corner anchored!
        const dx = startX - ev.clientX;
        const dy = ev.clientY - startY;
        const dominantDelta = Math.abs(dx) > Math.abs(dy) ? dx : Math.round(dy * ratio);
        const rightEdge = orig.left + orig.width;
        const maxWByLeft = rightEdge - 6;
        const maxWByBottom = Math.round((docWin.innerHeight - orig.top - 8) * ratio);
        const nextW = Math.max(MIN_W, Math.min(maxWByLeft, maxWByBottom, orig.width + dominantDelta));
        const nextH = Math.max(MIN_H, Math.round(nextW / ratio));
        const nextLeft = Math.max(6, rightEdge - nextW);
        setWinBox({ top: orig.top, left: nextLeft, width: nextW, height: nextH });
      }
    };
    const onUp = () => {
      doc.removeEventListener("mousemove", onMove, true);
      doc.removeEventListener("mouseup", onUp, true);
    };
    doc.addEventListener("mousemove", onMove, true);
    doc.addEventListener("mouseup", onUp, true);
  };


  // Independent Horizontal (Left/Right) & Vertical (Bottom) Edge Grab Resize (locked to MIN_W x MIN_H floor!)
  const startEdgeResize = (edge: "left" | "right" | "bottom") => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    hasUserMovedRef.current = true;
    const doc = modalRef.current?.ownerDocument || document;
    const docWin = doc.defaultView || window;
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = { ...winBox };

    const onMove = (ev: MouseEvent) => {
      if (edge === "left") {
        const rightEdge = orig.left + orig.width;
        const dx = startX - ev.clientX;
        const nextW = Math.max(MIN_W, Math.min(rightEdge - 6, orig.width + dx));
        const nextLeft = Math.max(6, rightEdge - nextW);
        setWinBox((prev) => ({ ...prev, left: nextLeft, width: nextW }));
      } else if (edge === "right") {
        const dx = ev.clientX - startX;
        const maxW = docWin.innerWidth - orig.left - 6;
        const nextW = Math.max(MIN_W, Math.min(maxW, orig.width + dx));
        setWinBox((prev) => ({ ...prev, width: nextW }));
      } else if (edge === "bottom") {
        const dy = ev.clientY - startY;
        const maxH = docWin.innerHeight - orig.top - 6;
        const nextH = Math.max(MIN_H, Math.min(maxH, orig.height + dy));
        setWinBox((prev) => ({ ...prev, height: nextH }));
      }
    };
    const onUp = () => {
      doc.removeEventListener("mousemove", onMove, true);
      doc.removeEventListener("mouseup", onUp, true);
    };
    doc.addEventListener("mousemove", onMove, true);
    doc.addEventListener("mouseup", onUp, true);
  };

  const commitState = (next: DynamicGroupsPayload) => {
    const normalizedTokens = hydrateThemeDesignTokens(next.designTokens ?? state.designTokens ?? []);
    const normalized: DynamicGroupsPayload = {
      ...next,
      imageGroups: syncImageGroupSlotsAcrossThemes(next.imageGroups ?? state.imageGroups ?? []),
      designTokens: normalizedTokens
    };
    const serialized = JSON.stringify(normalized);
    setState(normalized);
    saveLocalDesignTokensFallback(normalizedTokens);
    emitChange(props, serialized);
  };

  const imageGroups = syncImageGroupSlotsAcrossThemes(state.imageGroups || []);
  const designTokens = hydrateThemeDesignTokens(state.designTokens || []);

  const handleCreateDesignToken = (input: {
    name: string;
    type: ThemeDesignTokenType;
    value: ThemeDesignTokenValue;
  }): ThemeDesignToken => {
    const created = createThemeDesignToken(designTokens, input);
    commitState({ ...state, designTokens: [...designTokens, created] });
    return created;
  };

  const handleUpdateDesignTokenValue = (
    tokenId: string,
    nextValue: ThemeDesignTokenValue,
    scope: "all" | "theme"
  ) => {
    const nextTokens = updateThemeDesignTokenValue(designTokens, tokenId, nextValue, {
      themeId: editPalette,
      scope
    });
    commitState({ ...state, designTokens: nextTokens });
  };

  const handleClearDesignTokenOverride = (tokenId: string, themeId: string) => {
    commitState({
      ...state,
      designTokens: clearThemeDesignTokenOverride(designTokens, tokenId, themeId)
    });
  };

  const handleRenameDesignToken = (tokenId: string, nextName: string) => {
    commitState({
      ...state,
      designTokens: renameThemeDesignToken(designTokens, tokenId, nextName)
    });
  };

  const handleDuplicateDesignToken = (tokenId: string) => {
    const { tokens: nextTokens } = duplicateThemeDesignToken(designTokens, tokenId);
    commitState({ ...state, designTokens: nextTokens });
  };

  const handleDeleteDesignToken = (tokenId: string) => {
    commitState(deleteDesignTokenWithGroupFallback(state, tokenId));
  };

  const handleTogglePinDesignToken = (tokenId: string) => {
    commitState({
      ...state,
      designTokens: toggleThemeDesignTokenPinned(designTokens, tokenId)
    });
  };

  const getGroupStateTokenId = (
    group: DynamicGroupItem | null | undefined,
    stateKey: GroupStateKey,
    attr: ThemeTokenAttrKey
  ): string | undefined => {
    if (!group) return undefined;
    return stateKey === "default"
      ? group.tokenRefs?.[attr]
      : group.stateOverrides?.[stateKey]?.tokenRefs?.[attr];
  };

  const bindTokenOnGroups = (
    ids: number[],
    stateKey: GroupStateKey,
    attr: ThemeTokenAttrKey,
    tokenId: string,
    overrideTokens?: ThemeDesignToken[]
  ) => {
    const nextGroups = { ...state.groups };
    ids.forEach((id) => {
      const cur = nextGroups[String(id)];
      if (cur) nextGroups[String(id)] = bindTokenToGroupState(cur, stateKey, attr, tokenId);
    });
    commitState({
      ...state,
      groups: nextGroups,
      designTokens: overrideTokens ?? designTokens
    });
  };

  const detachTokenOnGroups = (
    ids: number[],
    stateKey: GroupStateKey,
    attr: ThemeTokenAttrKey
  ) => {
    const nextGroups = { ...state.groups };
    ids.forEach((id) => {
      const cur = nextGroups[String(id)];
      if (cur) nextGroups[String(id)] = detachTokenFromGroupState(cur, stateKey, attr, designTokens);
    });
    commitState({ ...state, groups: nextGroups });
  };

  const saveAndBindTokenOnGroups = (
    ids: number[],
    stateKey: GroupStateKey,
    attr: ThemeTokenAttrKey,
    type: ThemeDesignTokenType,
    name: string,
    value: ThemeDesignTokenValue
  ) => {
    const created = createThemeDesignToken(designTokens, { name, type, value });
    bindTokenOnGroups(ids, stateKey, attr, created.id, [...designTokens, created]);
  };

  const makeTokenBindingForGroups = (opts: {
    groupIds: number[];
    stateKey: GroupStateKey;
    attr: ThemeTokenAttrKey;
    tokenType: ThemeDesignTokenType;
    linkedTokenId?: string | undefined;
    getCurrentValue: () => ThemeDesignTokenValue;
  }): EcmdTokenBindingContext => ({
    tokens: designTokens,
    activePalette: editPalette,
    linkedTokenId: opts.linkedTokenId,
    onSelectToken: (tokId) => bindTokenOnGroups(opts.groupIds, opts.stateKey, opts.attr, tokId),
    onDetachToken: () => detachTokenOnGroups(opts.groupIds, opts.stateKey, opts.attr),
    onSaveAsToken: (name) =>
      saveAndBindTokenOnGroups(
        opts.groupIds,
        opts.stateKey,
        opts.attr,
        opts.tokenType,
        name,
        opts.getCurrentValue()
      ),
    onEditLinkedToken: (tokId, nextVal, scope) =>
      handleUpdateDesignTokenValue(tokId, nextVal as ThemeDesignTokenValue, scope)
  });

  const resolveDisplayedStringWithToken = (
    tokenId: string | undefined,
    fallback: string
  ): string => {
    const tok = findDesignTokenById(designTokens, tokenId);
    return tok ? compileDesignTokenCssValue(tok, editPalette) : fallback;
  };

  const resolveDisplayedTextShadowWithToken = (
    tokenId: string | undefined,
    fallback: ThemeTextShadowConfig | undefined
  ): ThemeTextShadowConfig | undefined => {
    const tok = findDesignTokenById(designTokens, tokenId);
    return tok ? resolveDesignTokenTextShadowConfig(tok, editPalette) : fallback;
  };

  const allGroupsSorted = Object.values(state.groups).filter((g): g is DynamicGroupItem => Boolean(g)).sort((a, b) => a.id - b.id);
  const enabledGroups = allGroupsSorted.filter((g) => g.enabled);

  const sortedEnabledGroups = filterAndSortThemeGroups(enabledGroups, {
    sortBy: groupSortBy,
    tokensMap: designTokens
  });

  const visibleGroups = filterAndSortThemeGroups(enabledGroups, {
    query: groupSearch,
    sortBy: groupSortBy,
    tokensMap: designTokens,
    frozenOrderIds: focusedRenameId !== null ? frozenOrderIds || undefined : undefined,
    focusedRenameId
  });

  // Auto-expand when selectedId changes externally or via dropdown, and scroll/focus newly created group
  const prevSelectedIdRef = useRef<number | "multi">(state.selectedId);
  useEffect(() => {
    if (prevSelectedIdRef.current !== state.selectedId) {
      prevSelectedIdRef.current = state.selectedId;
      if (typeof state.selectedId === "number" && state.selectedId > 0) {
        setAllCollapsed(false);
        setExpandedGroupIds((prev) => {
          if (prev.has(state.selectedId as number)) return prev;
          const next = new Set(prev);
          next.add(state.selectedId as number);
          return next;
        });
      }
    }
  }, [state.selectedId]);

  useEffect(() => {
    const targetId = pendingFocusGroupIdRef.current;
    if (targetId === null || !panelOpen || activeStudioTab !== "groups") return;
    pendingFocusGroupIdRef.current = null;
    const focusNewCard = () => {
      const cardEl = groupCardRefs.current[targetId];
      if (cardEl && typeof cardEl.scrollIntoView === "function") {
        try {
          cardEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } catch {}
      }
      const renameEl = groupRenameInputRefs.current[targetId];
      if (renameEl && typeof renameEl.focus === "function") {
        renameEl.focus();
        if (typeof renameEl.select === "function") {
          try {
            renameEl.select();
          } catch {}
        }
      }
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(focusNewCard);
    } else {
      setTimeout(focusNewCard, 0);
    }
  }, [state.selectedId, state.groups, panelOpen, activeStudioTab]);

  const handleRenameFocus = (id: number) => {
    setFocusedRenameId(id);
    setFrozenOrderIds((prev) => (prev && prev.length > 0 ? prev : visibleGroups.map((g) => g.id)));
  };

  const handleRenameBlur = (id: number) => {
    setFocusedRenameId((prev) => {
      if (prev === id) {
        setFrozenOrderIds(null);
        return null;
      }
      return prev;
    });
  };

  const handleToggleGroupPin = (id: number) => {
    const cur = state.groups[String(id)];
    if (!cur) return;
    updateSingleGroup(id, { pinned: cur.pinned ? undefined : true });
  };

  const handleCollapseAllGroups = () => {
    setExpandedGroupIds(new Set());
    setAllCollapsed(true);
  };

  const handleExpandAllGroups = () => {
    setExpandedGroupIds(new Set(visibleGroups.map((g) => g.id)));
    setAllCollapsed(false);
  };

  const handleToggleGroupAccordion = (id: number) => {
    const isCurrentlyExpanded = !allCollapsed && expandedGroupIds.has(id);
    if (isCurrentlyExpanded && state.selectedId === id) {
      setExpandedGroupIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    setAllCollapsed(false);
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    if (state.selectedId !== id) {
      commitState({ ...state, selectedId: id });
      setMultiPickerOpen(false);
    }
  };

  const handleDropdownChange = (val: string) => {
    if (val === "__SYNC_GOOGLE_M3__") {
      setPanelOpen(true);
      setConfirmDeleteId("revert");
      return;
    }
    if (val === "__APPLY_REVERT_NOW__") {
      const freshM3 = buildInitialGroupsFromProps({}, undefined).groups;
      const merged: Record<string, DynamicGroupItem> = { ...state.groups };
      Object.keys(freshM3).forEach((k) => {
        const m3 = freshM3[k];
        if (!m3) return;
        const ex = merged[k];
        merged[k] = ex ? {
          ...m3,
          enabled: true,
          spacing: ex.spacing,
          padding: ex.padding,
          margin: ex.margin,
          gap: ex.gap
        } : { ...m3, enabled: true };
      });
      commitState({ ...state, selectedId: 1, groups: merged });
      setMultiPickerOpen(false);
      setPanelOpen(true);
      return;
    }
    if (val === "__ADD_GROUP__") {
      const { slotId, defaultName } = findNextAvailableGroupSlotAndName(state.groups);
      const prev = state.groups[String(slotId)];
      const latestStore = loadAttributeProfilesStore();
      const targetProfileId = newGroupProfileId || latestStore.defaultProfileId;
      const chosenProfile =
        latestStore.profiles.find((p) => p.id === targetProfileId) ||
        latestStore.profiles.find((p) => p.id === latestStore.defaultProfileId);
      const created = createGroupWithAttributeProfile(slotId, defaultName, chosenProfile, prev);
      setGroupSearch("");
      setFocusedRenameId(null);
      setFrozenOrderIds(null);
      setAllCollapsed(false);
      setExpandedGroupIds((prevExp) => {
        const next = new Set(prevExp);
        next.add(slotId);
        return next;
      });
      pendingFocusGroupIdRef.current = slotId;
      commitState({ ...state, selectedId: slotId, groups: { ...state.groups, [String(slotId)]: created } });
      setActiveState("default");
      setMultiPickerOpen(false);
      setPanelOpen(true);
      return;
    }
    if (val === "multi") {
      const validMulti = (state.multiIds || []).filter((id) => state.groups[String(id)]?.enabled);
      const seededMulti = validMulti.length > 0 ? validMulti : sortedEnabledGroups.map((g) => g.id);
      commitState({ ...state, selectedId: "multi", multiIds: seededMulti });
      setPanelOpen(true);
      setMultiPickerOpen(true);
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      setAllCollapsed(false);
      setExpandedGroupIds((prevExp) => {
        const next = new Set(prevExp);
        next.add(num);
        return next;
      });
      commitState({ ...state, selectedId: num });
      setMultiPickerOpen(false);
      setPanelOpen(true);
    }
  };

  const updateSingleGroup = (id: number, patch: Partial<DynamicGroupItem>) => {
    const cur = state.groups[String(id)];
    if (!cur) return;
    commitState({ ...state, groups: { ...state.groups, [String(id)]: { ...cur, ...patch } } });
  };

  const updateSingleGroupFluidScale = (id: number, patch: Partial<GroupFluidScaleConfig>) => {
    const cur = state.groups[String(id)];
    if (!cur) return;
    const prevFluid = cur.fluidScale || {};
    const nextFluid: GroupFluidScaleConfig = {
      enabled: true,
      ...prevFluid,
      ...patch
    };
    updateSingleGroup(id, { fluidScale: nextFluid });
  };

  const isPropEnabled = (group: DynamicGroupItem | null | undefined, propKey: GroupStylePropKey): boolean => {
    if (propKey === "outerShadow") {
      return !Boolean(group?.disabledProps?.["outerShadow"] || group?.disabledProps?.["shadow"] || group?.disabledProps?.["elevation"]);
    }
    return !Boolean(group?.disabledProps?.[propKey]);
  };

  const toggleSingleGroupProp = (id: number, propKey: GroupStylePropKey, nextEnabled: boolean) => {
    const cur = state.groups[String(id)];
    if (!cur) return;
    const nextDisabled: Record<string, boolean> = { ...(cur.disabledProps || {}) };
    if (nextEnabled) {
      delete nextDisabled[propKey];
      if (propKey === "outerShadow") {
        delete nextDisabled["shadow"];
        delete nextDisabled["elevation"];
      }
    } else {
      nextDisabled[propKey] = true;
    }
    commitState({
      ...state,
      groups: {
        ...state.groups,
        [String(id)]: {
          ...cur,
          disabledProps: Object.keys(nextDisabled).length > 0 ? nextDisabled : undefined
        }
      }
    });
  };

  const isStatePropEnabled = (
    group: DynamicGroupItem | null | undefined,
    stateKey: GroupStateKey,
    propKey: GroupStylePropKey
  ): boolean => {
    if (stateKey === "default") return isPropEnabled(group, propKey);
    const stOv = group?.stateOverrides?.[stateKey];
    if (stOv?.disabledProps && stOv.disabledProps[propKey] !== undefined) {
      return !stOv.disabledProps[propKey];
    }
    if (propKey === "opacity") return true;
    return isPropEnabled(group, propKey);
  };

  const toggleSingleGroupStateProp = (
    id: number,
    stateKey: SubGroupStateKey,
    propKey: GroupStylePropKey,
    nextEnabled: boolean
  ) => {
    const cur = state.groups[String(id)];
    if (!cur) return;
    const prevOv = cur.stateOverrides?.[stateKey] || {};
    const nextStDisabled: Record<string, boolean> = { ...(prevOv.disabledProps || {}) };
    nextStDisabled[propKey] = !nextEnabled;
    const nextGroup: DynamicGroupItem = {
      ...cur,
      stateOverrides: {
        ...(cur.stateOverrides || {}),
        [stateKey]: {
          ...prevOv,
          disabledProps: nextStDisabled
        }
      }
    };
    // Keep legacy disabled flags synced for backward compatibility
    if (stateKey === "hover" && (propKey === "bg" || propKey === "text")) {
      const legacyKey = propKey === "bg" ? "hoverBg" : "hoverText";
      const gDis = { ...(cur.disabledProps || {}) };
      if (nextEnabled) delete gDis[legacyKey];
      else gDis[legacyKey] = true;
      nextGroup.disabledProps = Object.keys(gDis).length > 0 ? gDis : undefined;
    } else if (stateKey === "selected" && (propKey === "bg" || propKey === "text")) {
      const legacyKey = propKey === "bg" ? "selBg" : "selText";
      const gDis = { ...(cur.disabledProps || {}) };
      if (nextEnabled) delete gDis[legacyKey];
      else gDis[legacyKey] = true;
      nextGroup.disabledProps = Object.keys(gDis).length > 0 ? gDis : undefined;
    } else if (stateKey === "focus" && propKey === "border") {
      const gDis = { ...(cur.disabledProps || {}) };
      if (nextEnabled) delete gDis["focusBorder"];
      else gDis["focusBorder"] = true;
      nextGroup.disabledProps = Object.keys(gDis).length > 0 ? gDis : undefined;
    }
    commitState({ ...state, groups: { ...state.groups, [String(id)]: nextGroup } });
  };

  const updateSingleGroupStateTheme = (
    id: number,
    stateKey: SubGroupStateKey,
    field: keyof GroupStateThemeValues,
    val: string
  ) => {
    const cur = state.groups[String(id)];
    if (!cur) return;
    const themeBucket: "cl" | "ms" = isMs ? "ms" : "cl";
    const prevOv = cur.stateOverrides?.[stateKey] || {};
    const nextOv: GroupStateOverride = {
      ...prevOv,
      [themeBucket]: {
        ...(prevOv[themeBucket] || {}),
        [field]: val
      }
    };
    const patch: Partial<DynamicGroupItem> = {
      stateOverrides: {
        ...(cur.stateOverrides || {}),
        [stateKey]: nextOv
      }
    };
    // Mirror into legacy flat fields for 100% backward compatibility
    if (stateKey === "hover" && field === "bg") {
      if (isMs) patch.msHoverBg = val; else patch.clHoverBg = val;
    } else if (stateKey === "hover" && field === "text") {
      if (isMs) patch.msHoverText = val; else patch.clHoverText = val;
    } else if (stateKey === "selected" && field === "bg") {
      if (isMs) patch.msSelBg = val; else patch.clSelBg = val;
    } else if (stateKey === "selected" && field === "text") {
      if (isMs) patch.msSelText = val; else patch.clSelText = val;
    } else if (stateKey === "focus" && field === "border") {
      if (isMs) patch.msFocusBorder = val; else patch.clFocusBorder = val;
    }
    updateSingleGroup(id, patch);
  };

  const updateSingleGroupStateScalar = (
    id: number,
    stateKey: SubGroupStateKey,
    patch: Partial<Pick<GroupStateOverride, "borderMode" | "borderNone" | "borderWidth" | "borderStyle" | "fontWeight" | "radius" | "opacity" | "cursorNotAllowed">>
  ) => {
    const cur = state.groups[String(id)];
    if (!cur) return;
    const prevOv = cur.stateOverrides?.[stateKey] || {};
    updateSingleGroup(id, {
      stateOverrides: {
        ...(cur.stateOverrides || {}),
        [stateKey]: { ...prevOv, ...patch }
      }
    });
  };

  const resolveSingleDefaultTextShadow = (group: DynamicGroupItem): ThemeTextShadowConfig | undefined => {
    const themeSpecific = isMs ? group.msTextShadow : group.clTextShadow;
    if (themeSpecific) return themeSpecific;
    const otherTheme = isMs ? group.clTextShadow : group.msTextShadow;
    if (!otherTheme && hasExplicitTextShadowFields(group)) {
      return extractTextShadowConfig(group);
    }
    return undefined;
  };

  const resolveSingleStateTextShadow = (
    stOv: GroupStateOverride | undefined
  ): ThemeTextShadowConfig | undefined => {
    if (!stOv) return undefined;
    const themeBucket: "cl" | "ms" = isMs ? "ms" : "cl";
    const otherBucket: "cl" | "ms" = isMs ? "cl" : "ms";
    const tVals = stOv[themeBucket];
    if (hasExplicitTextShadowFields(tVals)) return extractTextShadowConfig(tVals);
    if (!hasExplicitTextShadowFields(stOv[otherBucket]) && hasExplicitTextShadowFields(stOv)) {
      return extractTextShadowConfig(stOv);
    }
    return undefined;
  };

  const updateSingleGroupTextShadow = (id: number, nextCfg: ThemeTextShadowConfig) => {
    updateSingleGroup(id, isMs ? { msTextShadow: nextCfg } : { clTextShadow: nextCfg });
  };

  const updateSingleGroupStateTextShadow = (
    id: number,
    stateKey: SubGroupStateKey,
    nextCfg: ThemeTextShadowConfig
  ) => {
    const cur = state.groups[String(id)];
    if (!cur) return;
    const themeBucket: "cl" | "ms" = isMs ? "ms" : "cl";
    const prevOv = cur.stateOverrides?.[stateKey] || {};
    const nextOv: GroupStateOverride = {
      ...prevOv,
      [themeBucket]: {
        ...(prevOv[themeBucket] || {}),
        textShadowEnabled: nextCfg.textShadowEnabled,
        textShadowX: nextCfg.textShadowX,
        textShadowY: nextCfg.textShadowY,
        textShadowBlur: nextCfg.textShadowBlur,
        textShadowColor: nextCfg.textShadowColor,
        textShadowOpacity: nextCfg.textShadowOpacity,
        textShadowCustom: nextCfg.textShadowCustom
      }
    };
    updateSingleGroup(id, {
      stateOverrides: {
        ...(cur.stateOverrides || {}),
        [stateKey]: nextOv
      }
    });
  };

  const clearSingleGroupState = (id: number, stateKey: SubGroupStateKey) => {
    const cur = state.groups[String(id)];
    if (!cur) return;
    const nextOverrides = { ...(cur.stateOverrides || {}) };
    delete nextOverrides[stateKey];
    const patch: Partial<DynamicGroupItem> = {
      stateOverrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined
    };
    if (stateKey === "hover") {
      patch.clHoverBg = ""; patch.msHoverBg = ""; patch.clHoverText = ""; patch.msHoverText = "";
    } else if (stateKey === "selected") {
      patch.clSelBg = ""; patch.msSelBg = ""; patch.clSelText = ""; patch.msSelText = "";
    } else if (stateKey === "focus") {
      patch.clFocusBorder = ""; patch.msFocusBorder = "";
    }
    updateSingleGroup(id, patch);
  };

  const applyProfileToSingleGroup = (id: number, profileId: string) => {
    if (!profileId) return;
    const cur = state.groups[String(id)];
    const profile = attrStore.profiles.find((p) => p.id === profileId);
    if (!cur || !profile) return;
    updateSingleGroup(id, {
      attributeProfileId: profile.id,
      disabledProps: applyAttributeProfileToDisabledProps(cur.disabledProps, profile)
    });
  };

  const handleQuickDeleteAttributeProfile = (profileId: string) => {
    if (!profileId) return;
    const latest = loadAttributeProfilesStore();
    const nextStore = deleteAttributeProfileFromStore(latest, profileId);
    if (!nextStore) return;
    saveAttributeProfilesStore(nextStore);
    setAttrStore(nextStore);
    setNewGroupProfileId((prev) =>
      prev === profileId || !nextStore.profiles.some((p) => p.id === prev)
        ? nextStore.defaultProfileId
        : prev
    );
    setMultiProfileId((prev) => (prev === profileId ? "" : prev));
  };

  const activeMultiIds = (state.multiIds || []).filter((id) => state.groups[String(id)]?.enabled);
  const multiTargetGroups = activeMultiIds.map((id) => state.groups[String(id)]).filter((g): g is DynamicGroupItem => Boolean(g));

  const updateMultipleGroups = (patch: Partial<DynamicGroupItem>) => {
    if (!activeMultiIds.length) return;
    const nextGroups = { ...state.groups };
    activeMultiIds.forEach((id) => {
      const cur = nextGroups[String(id)];
      if (cur) nextGroups[String(id)] = { ...cur, ...patch };
    });
    commitState({ ...state, groups: nextGroups });
  };

  const updateMultipleGroupsFluidScale = (patch: Partial<GroupFluidScaleConfig>) => {
    if (!activeMultiIds.length) return;
    const nextGroups = { ...state.groups };
    activeMultiIds.forEach((id) => {
      const cur = nextGroups[String(id)];
      if (!cur) return;
      nextGroups[String(id)] = {
        ...cur,
        fluidScale: {
          enabled: true,
          ...(cur.fluidScale || {}),
          ...patch
        }
      };
    });
    commitState({ ...state, groups: nextGroups });
  };

  const isMultiPropEnabled = (propKey: GroupStylePropKey): boolean => {
    if (!multiTargetGroups.length) return true;
    return multiTargetGroups.some((g) => isPropEnabled(g, propKey));
  };

  const toggleMultipleGroupsProp = (propKey: GroupStylePropKey, nextEnabled: boolean) => {
    if (!activeMultiIds.length) return;
    const nextGroups = { ...state.groups };
    activeMultiIds.forEach((id) => {
      const cur = nextGroups[String(id)];
      if (!cur) return;
      const nextDisabled: Record<string, boolean> = { ...(cur.disabledProps || {}) };
      if (nextEnabled) {
        delete nextDisabled[propKey];
        if (propKey === "outerShadow") {
          delete nextDisabled["shadow"];
          delete nextDisabled["elevation"];
        }
      } else {
        nextDisabled[propKey] = true;
      }
      nextGroups[String(id)] = {
        ...cur,
        disabledProps: Object.keys(nextDisabled).length > 0 ? nextDisabled : undefined
      };
    });
    commitState({ ...state, groups: nextGroups });
  };

  const applyProfileToMultipleGroups = (profileId: string) => {
    if (!profileId || !activeMultiIds.length) return;
    const profile = attrStore.profiles.find((p) => p.id === profileId);
    if (!profile) return;
    const nextGroups = { ...state.groups };
    activeMultiIds.forEach((id) => {
      const cur = nextGroups[String(id)];
      if (!cur) return;
      nextGroups[String(id)] = {
        ...cur,
        attributeProfileId: profile.id,
        disabledProps: applyAttributeProfileToDisabledProps(cur.disabledProps, profile)
      };
    });
    commitState({ ...state, groups: nextGroups });
  };

  const isMultiStatePropEnabled = (stateKey: GroupStateKey, propKey: GroupStylePropKey): boolean => {
    if (!multiTargetGroups.length) return true;
    return multiTargetGroups.some((g) => isStatePropEnabled(g, stateKey, propKey));
  };

  const toggleMultipleGroupsStateProp = (
    stateKey: SubGroupStateKey,
    propKey: GroupStylePropKey,
    nextEnabled: boolean
  ) => {
    if (!activeMultiIds.length) return;
    const nextGroups = { ...state.groups };
    activeMultiIds.forEach((id) => {
      const cur = nextGroups[String(id)];
      if (!cur) return;
      const prevOv = cur.stateOverrides?.[stateKey] || {};
      const nextStDisabled: Record<string, boolean> = { ...(prevOv.disabledProps || {}) };
      nextStDisabled[propKey] = !nextEnabled;
      nextGroups[String(id)] = {
        ...cur,
        stateOverrides: {
          ...(cur.stateOverrides || {}),
          [stateKey]: { ...prevOv, disabledProps: nextStDisabled }
        }
      };
    });
    commitState({ ...state, groups: nextGroups });
  };

  const updateMultipleGroupsStateTheme = (
    stateKey: SubGroupStateKey,
    field: keyof GroupStateThemeValues,
    val: string
  ) => {
    if (!activeMultiIds.length) return;
    const themeBucket: "cl" | "ms" = isMs ? "ms" : "cl";
    const nextGroups = { ...state.groups };
    activeMultiIds.forEach((id) => {
      const cur = nextGroups[String(id)];
      if (!cur) return;
      const prevOv = cur.stateOverrides?.[stateKey] || {};
      const updated: DynamicGroupItem = {
        ...cur,
        stateOverrides: {
          ...(cur.stateOverrides || {}),
          [stateKey]: {
            ...prevOv,
            [themeBucket]: { ...(prevOv[themeBucket] || {}), [field]: val }
          }
        }
      };
      if (stateKey === "hover" && field === "bg") {
        if (isMs) updated.msHoverBg = val; else updated.clHoverBg = val;
      } else if (stateKey === "hover" && field === "text") {
        if (isMs) updated.msHoverText = val; else updated.clHoverText = val;
      } else if (stateKey === "selected" && field === "bg") {
        if (isMs) updated.msSelBg = val; else updated.clSelBg = val;
      } else if (stateKey === "selected" && field === "text") {
        if (isMs) updated.msSelText = val; else updated.clSelText = val;
      } else if (stateKey === "focus" && field === "border") {
        if (isMs) updated.msFocusBorder = val; else updated.clFocusBorder = val;
      }
      nextGroups[String(id)] = updated;
    });
    commitState({ ...state, groups: nextGroups });
  };

  const updateMultipleGroupsStateScalar = (
    stateKey: SubGroupStateKey,
    patch: Partial<Pick<GroupStateOverride, "borderMode" | "borderNone" | "borderWidth" | "borderStyle" | "fontWeight" | "radius" | "opacity" | "cursorNotAllowed">>
  ) => {
    if (!activeMultiIds.length) return;
    const nextGroups = { ...state.groups };
    activeMultiIds.forEach((id) => {
      const cur = nextGroups[String(id)];
      if (!cur) return;
      const prevOv = cur.stateOverrides?.[stateKey] || {};
      nextGroups[String(id)] = {
        ...cur,
        stateOverrides: {
          ...(cur.stateOverrides || {}),
          [stateKey]: { ...prevOv, ...patch }
        }
      };
    });
    commitState({ ...state, groups: nextGroups });
  };

  const getSharedStateThemeVal = (
    stateKey: SubGroupStateKey,
    field: keyof GroupStateThemeValues
  ): { val: string; mixed: boolean } => {
    const themeBucket: "cl" | "ms" = isMs ? "ms" : "cl";
    if (!multiTargetGroups.length) return { val: "", mixed: false };
    const first = String(multiTargetGroups[0]?.stateOverrides?.[stateKey]?.[themeBucket]?.[field] || "");
    const allSame = multiTargetGroups.every(
      (g) => String(g.stateOverrides?.[stateKey]?.[themeBucket]?.[field] || "") === first
    );
    return { val: first, mixed: !allSame };
  };

  const getSharedStateScalarVal = <K extends "borderMode" | "borderNone" | "borderWidth" | "borderStyle" | "fontWeight" | "radius" | "opacity" | "cursorNotAllowed">(
    stateKey: SubGroupStateKey,
    field: K
  ): { val: GroupStateOverride[K]; mixed: boolean } => {
    if (!multiTargetGroups.length) return { val: undefined, mixed: false };
    const first = multiTargetGroups[0]?.stateOverrides?.[stateKey]?.[field];
    const allSame = multiTargetGroups.every(
      (g) => (g.stateOverrides?.[stateKey]?.[field] ?? "") === (first ?? "")
    );
    return { val: first, mixed: !allSame };
  };

  const updateMultipleGroupsTextShadow = (nextCfg: ThemeTextShadowConfig) => {
    updateMultipleGroups(isMs ? { msTextShadow: nextCfg } : { clTextShadow: nextCfg });
  };

  const updateMultipleGroupsStateTextShadow = (
    stateKey: SubGroupStateKey,
    nextCfg: ThemeTextShadowConfig
  ) => {
    if (!activeMultiIds.length) return;
    const themeBucket: "cl" | "ms" = isMs ? "ms" : "cl";
    const nextGroups = { ...state.groups };
    activeMultiIds.forEach((id) => {
      const cur = nextGroups[String(id)];
      if (!cur) return;
      const prevOv = cur.stateOverrides?.[stateKey] || {};
      nextGroups[String(id)] = {
        ...cur,
        stateOverrides: {
          ...(cur.stateOverrides || {}),
          [stateKey]: {
            ...prevOv,
            [themeBucket]: {
              ...(prevOv[themeBucket] || {}),
              textShadowEnabled: nextCfg.textShadowEnabled,
              textShadowX: nextCfg.textShadowX,
              textShadowY: nextCfg.textShadowY,
              textShadowBlur: nextCfg.textShadowBlur,
              textShadowColor: nextCfg.textShadowColor,
              textShadowOpacity: nextCfg.textShadowOpacity,
              textShadowCustom: nextCfg.textShadowCustom
            }
          }
        }
      };
    });
    commitState({ ...state, groups: nextGroups });
  };

  const getSharedDefaultTextShadow = (): { val: ThemeTextShadowConfig | undefined; mixed: boolean } => {
    if (!multiTargetGroups.length) return { val: undefined, mixed: false };
    const first = resolveSingleDefaultTextShadow(multiTargetGroups[0]!);
    const sig = JSON.stringify(first || {});
    const allSame = multiTargetGroups.every((g) => JSON.stringify(resolveSingleDefaultTextShadow(g) || {}) === sig);
    return { val: first, mixed: !allSame };
  };

  const getSharedStateTextShadow = (
    stateKey: SubGroupStateKey
  ): { val: ThemeTextShadowConfig | undefined; mixed: boolean } => {
    if (!multiTargetGroups.length) return { val: undefined, mixed: false };
    const first = resolveSingleStateTextShadow(multiTargetGroups[0]?.stateOverrides?.[stateKey]);
    const sig = JSON.stringify(first || {});
    const allSame = multiTargetGroups.every(
      (g) => JSON.stringify(resolveSingleStateTextShadow(g.stateOverrides?.[stateKey]) || {}) === sig
    );
    return { val: first, mixed: !allSame };
  };

  const toggleMultiId = (id: number) => {
    const curSet = new Set(activeMultiIds);
    if (curSet.has(id)) curSet.delete(id);
    else curSet.add(id);
    commitState({ ...state, multiIds: Array.from(curSet).sort((a, b) => a - b) });
  };

  const getSharedProp = <K extends keyof DynamicGroupItem>(key: K): { val: DynamicGroupItem[K]; mixed: boolean } => {
    const firstGroup = multiTargetGroups[0];
    if (!firstGroup) return { val: "" as any, mixed: false };
    const first = firstGroup[key];
    const allSame = multiTargetGroups.every((g) => g[key] === first);
    return { val: first, mixed: !allSame };
  };

  const removeGroup = (id: number) => {
    const cur = state.groups[String(id)];
    if (!cur) return;
    const nextGroups = { ...state.groups, [String(id)]: { ...cur, enabled: false } };
    const remaining = Object.values(nextGroups).filter((g) => g && g.enabled).sort((a, b) => a.id - b.id);
    commitState({ ...state, selectedId: remaining[0]?.id || 1, groups: nextGroups });
  };

  const executeConfirmedDelete = () => {
    if (confirmDeleteId === null) return;
    if (confirmDeleteId === "revert") {
      setConfirmDeleteId(null);
      handleDropdownChange("__APPLY_REVERT_NOW__");
      return;
    }
    const nextGroups = { ...state.groups };
    if (confirmDeleteId === "multi") {
      activeMultiIds.forEach((id) => { delete nextGroups[String(id)]; });
    } else {
      delete nextGroups[String(confirmDeleteId)];
    }
    const remaining = Object.values(nextGroups).filter((g): g is DynamicGroupItem => Boolean(g && g.enabled)).sort((a, b) => a.id - b.id);
    const nextSel = remaining[0]?.id ?? 0;
    commitState({ selectedId: nextSel, multiIds: remaining.map((g) => g.id), groups: nextGroups, imageGroups: state.imageGroups, designTokens: state.designTokens });
    setConfirmDeleteId(null);
    setMultiPickerOpen(false);
  };
  const isMultiMode = state.selectedId === "multi";
  const singleGroup = (!isMultiMode && enabledGroups.length > 0) ? (state.groups[String(state.selectedId)] || enabledGroups[0] || null) : null;
  const activeTitle = enabledGroups.length === 0 ? "No Groups (0)" : isMultiMode ? ("Multiple (" + activeMultiIds.length + ")") : (singleGroup?.name || ("Group " + state.selectedId));

  const portalTarget = triggerRef.current?.ownerDocument?.body || (typeof document !== "undefined" ? document.body : null);

  // Live Canvas State Preview: projects active Hover / Focus / Selected / Sel+Hover / Disabled styles
  // directly onto matching canvas elements in real time via transient `#ecmd-theme-live-state-preview`
  // with ZERO mutation of persisted theme data, and cleans up immediately on Default / tab switch / close / unmount.
  useLayoutEffect(() => {
    const ownerDocs = [
      triggerRef.current?.ownerDocument,
      modalRef.current?.ownerDocument
    ];
    if (!panelOpen || activeStudioTab !== "groups" || !liveStatePreviewEnabled || activeState === "default") {
      setLiveStatePreview(null);
      return;
    }
    if (isMultiMode) {
      const activeTargets = multiTargetGroups.filter((g) => g && g.enabled);
      if (activeTargets.length === 0) {
        setLiveStatePreview(null);
        return;
      }
      setLiveStatePreview({
        groupId: activeTargets.map((g) => String(g.id)).join(","),
        selector: activeTargets.map((g) => g.selector || (".gm-group-" + g.id)).join(", "),
        stateKey: activeState,
        groups: activeTargets,
        activeTheme: editPalette,
        designTokens,
        targetDocuments: ownerDocs
      });
      return;
    }
    if (!singleGroup || !singleGroup.enabled) {
      setLiveStatePreview(null);
      return;
    }
    setLiveStatePreview({
      groupId: String(singleGroup.id),
      selector: singleGroup.selector || (".gm-group-" + singleGroup.id),
      stateKey: activeState,
      group: singleGroup,
      activeTheme: editPalette,
      designTokens,
      targetDocuments: ownerDocs
    });
  }, [
    panelOpen,
    activeStudioTab,
    liveStatePreviewEnabled,
    activeState,
    isMultiMode,
    singleGroup,
    multiTargetGroups,
    editPalette,
    designTokens
  ]);

  useEffect(() => {
    return () => {
      setLiveStatePreview(null);
      if (copyUndoTimerRef.current) {
        clearTimeout(copyUndoTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!panelOpen || activeStudioTab !== "groups") {
      setCopyMenuTargetId(null);
      setCopySearch("");
    }
  }, [panelOpen, activeStudioTab]);

  const activeStateShortLabel =
    GROUP_STATE_TABS.find((t) => t.id === activeState)?.shortLabel || activeState;

  const handleCopyGroupAttributesFrom = (
    targetGroupId: number,
    sourceGroup: DynamicGroupItem
  ) => {
    const prevTarget = state.groups[String(targetGroupId)];
    if (!prevTarget || sourceGroup.id === targetGroupId) return;
    const preCopySnapshot = JSON.parse(JSON.stringify(prevTarget)) as DynamicGroupItem;
    const nextGroups = copyThemeGroupAttributes({
      themes: state.groups,
      activeThemeId: editPalette,
      sourceGroupId: sourceGroup.id,
      targetGroupId,
      scope: copyScope,
      stateKey: activeState
    });
    commitState({ ...state, groups: nextGroups });
    setCopyMenuTargetId(null);
    setCopySearch("");
    const scopeLabel =
      copyScope === "allThemesAllStates"
        ? "All Themes"
        : copyScope === "activeThemeCurrentState"
          ? activeStateShortLabel
          : "All States";
    if (copyUndoTimerRef.current) {
      clearTimeout(copyUndoTimerRef.current);
    }
    setCopyUndoNotice({
      targetId: targetGroupId,
      sourceName: sourceGroup.name || ("Group " + sourceGroup.id),
      scopeLabel,
      previousGroup: preCopySnapshot
    });
    copyUndoTimerRef.current = setTimeout(() => {
      setCopyUndoNotice((prev) => (prev && prev.targetId === targetGroupId ? null : prev));
    }, 10000);
  };

  const handleUndoCopyGroupAttributes = () => {
    if (!copyUndoNotice) return;
    if (copyUndoTimerRef.current) {
      clearTimeout(copyUndoTimerRef.current);
      copyUndoTimerRef.current = null;
    }
    const { targetId, previousGroup } = copyUndoNotice;
    const restoredGroups = {
      ...state.groups,
      [String(targetId)]: previousGroup
    };
    commitState({ ...state, groups: restoredGroups });
    setCopyUndoNotice(null);
  };

  const renderCopyAttributesTrigger = (targetGroup: DynamicGroupItem) => {
    const isOpen = copyMenuTargetId === targetGroup.id;
    const otherCount = enabledGroups.filter((g) => g.id !== targetGroup.id).length;
    return (
      <button
        type="button"
        data-ecmd-copy-attrs-trigger={targetGroup.id}
        aria-expanded={isOpen}
        aria-haspopup="true"
        disabled={otherCount === 0}
        onClick={(e) => {
          e.stopPropagation();
          if (otherCount === 0) return;
          setCopySearch("");
          setCopyMenuTargetId((prev) => (prev === targetGroup.id ? null : targetGroup.id));
        }}
        title={
          otherCount === 0
            ? "Create at least one other group to copy attributes from"
            : "Copy visual style attributes from another group while keeping this group's name and CSS selector"
        }
        style={{
          padding: "2px 7px",
          fontSize: "10px",
          fontWeight: 700,
          borderRadius: "5px",
          border: isOpen ? "1px solid #0D9488" : "1px solid #CBD5E1",
          background: isOpen ? "rgba(13, 148, 136, 0.12)" : "#F8FAFC",
          color: otherCount === 0 ? "#94A3B8" : isOpen ? "#0F766E" : "#334155",
          cursor: otherCount === 0 ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
          flexShrink: 0,
          opacity: otherCount === 0 ? 0.6 : 1
        }}
      >
        Copy Attributes From {isOpen ? "▴" : "▾"}
      </button>
    );
  };

  const renderCopyAttributesDropdownAndNotice = (targetGroup: DynamicGroupItem) => {
    const isOpen = copyMenuTargetId === targetGroup.id;
    const showUndo = copyUndoNotice && copyUndoNotice.targetId === targetGroup.id;
    if (!isOpen && !showUndo) return null;

    const sourceCandidates = isOpen
      ? filterAndSortThemeGroups(
          enabledGroups.filter((g) => g.id !== targetGroup.id),
          {
            query: copySearch,
            sortBy: "az",
            tokensMap: designTokens
          }
        )
      : [];

    return (
      <>
        {isOpen && (
          <div
            data-ecmd-copy-attrs-menu={targetGroup.id}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              border: "1px solid #CBD5E1",
              borderRadius: "8px",
              background: "#FFFFFF",
              boxShadow: "0 10px 24px rgba(15, 23, 42, 0.14)",
              padding: "7px 8px",
              display: "flex",
              flexDirection: "column",
              gap: "6px"
            }}
          >
            {/* Scope Pills: All States (default) | This State (<ActiveState>) | All Themes */}
            <div
              data-ecmd-copy-attrs-scopes="true"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "3px",
                background: "#F1F5F9",
                padding: "2px",
                borderRadius: "6px",
                border: "1px solid #E2E8F0"
              }}
            >
              {(
                [
                  { id: "activeThemeAllStates", label: "All States", title: "Copy all 6 states for the active theme" },
                  { id: "activeThemeCurrentState", label: `This State (${activeStateShortLabel})`, title: `Copy only ${activeStateShortLabel} state for the active theme` },
                  { id: "allThemesAllStates", label: "All Themes", title: "Copy all 6 states across every theme (Light & Dark)" }
                ] as const
              ).map((opt) => {
                const active = copyScope === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-ecmd-copy-scope-pill={opt.id}
                    aria-pressed={active}
                    title={opt.title}
                    onClick={() => setCopyScope(opt.id)}
                    style={{
                      padding: "3px 4px",
                      fontSize: "9.5px",
                      fontWeight: 700,
                      borderRadius: "4px",
                      border: "none",
                      background: active ? "#FFFFFF" : "transparent",
                      color: active ? "#0F766E" : "#475569",
                      boxShadow: active ? "0 1px 2px rgba(15,23,42,0.10)" : "none",
                      cursor: "pointer",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Quick-Filter Search Input */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <input
                type="text"
                aria-label="Filter source groups"
                data-ecmd-copy-attrs-search={targetGroup.id}
                value={copySearch}
                placeholder="Filter source groups..."
                onChange={(e) => setCopySearch(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Escape") {
                    setCopyMenuTargetId(null);
                    setCopySearch("");
                  }
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "4px 7px",
                  fontSize: "10.5px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  background: "#F8FAFC",
                  color: "#0F172A",
                  outline: "none"
                }}
              />
              <button
                type="button"
                aria-label="Close Copy Attributes menu"
                onClick={() => {
                  setCopyMenuTargetId(null);
                  setCopySearch("");
                }}
                style={{
                  border: "1px solid #E2E8F0",
                  background: "#F8FAFC",
                  color: "#475569",
                  borderRadius: "5px",
                  padding: "3px 6px",
                  fontSize: "10px",
                  fontWeight: 700,
                  cursor: "pointer",
                  flexShrink: 0
                }}
              >
                Close
              </button>
            </div>

            {/* Natural A -> Z Source Groups List */}
            <div
              data-ecmd-copy-attrs-list={targetGroup.id}
              style={{
                maxHeight: "152px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "3px"
              }}
            >
              {sourceCandidates.length === 0 ? (
                <div style={{ padding: "8px 6px", textAlign: "center", fontSize: "10px", color: "#64748B" }}>
                  No matching source groups.
                </div>
              ) : (
                sourceCandidates.map((src) => {
                  const srcBg = isMs ? src.msBg : src.clBg;
                  const srcTxt = isMs ? src.msText : src.clText;
                  const srcPrimarySel = ((src.selector || (".gm-group-" + src.id)).split(",")[0] || "").trim();
                  return (
                    <button
                      key={src.id}
                      type="button"
                      data-ecmd-copy-source-option={src.id}
                      onClick={() => handleCopyGroupAttributesFrom(targetGroup.id, src)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "6px",
                        width: "100%",
                        padding: "4px 7px",
                        borderRadius: "6px",
                        border: "1px solid #E2E8F0",
                        background: "#F8FAFC",
                        color: "#0F172A",
                        cursor: "pointer",
                        textAlign: "left"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            width: "12px",
                            height: "12px",
                            borderRadius: "3px",
                            border: "1px solid #CBD5E1",
                            background: srcBg || "#FFFFFF",
                            color: srcTxt || "#0F172A",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "7.5px",
                            fontWeight: 800,
                            flexShrink: 0
                          }}
                        >
                          A
                        </span>
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 700,
                            color: "#0F172A",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {src.name || ("Group " + src.id)}
                        </span>
                      </div>
                      <code
                        style={{
                          fontSize: "9.5px",
                          color: "#64748B",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "105px",
                          flexShrink: 0
                        }}
                      >
                        {srcPrimarySel}
                      </code>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {showUndo && copyUndoNotice && (
          <div
            data-ecmd-copy-attrs-toast={targetGroup.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "6px",
              padding: "5px 8px",
              borderRadius: "6px",
              background: "#ECFDF5",
              border: "1px solid #10B981",
              color: "#065F46",
              fontSize: "10px",
              fontWeight: 600
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
              Copied from <b>{copyUndoNotice.sourceName}</b> ({copyUndoNotice.scopeLabel})
            </span>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
              <button
                type="button"
                data-ecmd-copy-attrs-undo={targetGroup.id}
                onClick={handleUndoCopyGroupAttributes}
                style={{
                  border: "1px solid #059669",
                  background: "#FFFFFF",
                  color: "#047857",
                  borderRadius: "4px",
                  padding: "1px 6px",
                  fontSize: "9.5px",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Undo
              </button>
              <button
                type="button"
                aria-label="Dismiss copy confirmation"
                onClick={() => setCopyUndoNotice(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#047857",
                  fontSize: "10px",
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: "0 2px"
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}
      </>
    );
  };

  const renderLiveStatePreviewRow = () => {
    const isSubState = activeState !== "default";
    const isShowing = isSubState && liveStatePreviewEnabled;
    return (
      <div
        data-ecmd-state-bar-header="true"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
          marginTop: "2px"
        }}
      >
        <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B", letterSpacing: "0.02em", textTransform: "uppercase" }}>
          Interactive State
        </span>
        {isSubState ? (
          <button
            type="button"
            data-ecmd-live-state-preview-toggle="true"
            data-ecmd-live-preview-active={isShowing ? "true" : "false"}
            data-ecmd-live-preview-state={activeState}
            aria-pressed={liveStatePreviewEnabled}
            onClick={() => setLiveStatePreviewEnabled((prev) => !prev)}
            title={
              isShowing
                ? `Live Canvas Preview ON — Showing ${activeStateShortLabel} directly on canvas without hovering. Click to pause and test native interaction.`
                : `Live Canvas Preview PAUSED — Native :hover/:focus active. Click to show ${activeStateShortLabel} live on canvas.`
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 7px",
              borderRadius: "999px",
              border: isShowing ? "1px solid #10B981" : "1px solid #F59E0B",
              background: isShowing ? "#ECFDF5" : "#FFFBEB",
              color: isShowing ? "#047857" : "#B45309",
              fontSize: "10px",
              fontWeight: 700,
              cursor: "pointer",
              lineHeight: 1.3,
              whiteSpace: "nowrap"
            }}
          >
            <span>
              {isShowing
                ? `👁️ Showing ${activeStateShortLabel} on Canvas`
                : `👁️‍🗨️ Preview Off (${activeStateShortLabel})`}
            </span>
          </button>
        ) : !liveStatePreviewEnabled ? (
          <button
            type="button"
            data-ecmd-live-state-preview-toggle="true"
            data-ecmd-live-preview-active="false"
            data-ecmd-live-preview-state="default"
            aria-pressed={false}
            onClick={() => setLiveStatePreviewEnabled(true)}
            title="Live Canvas State Preview is currently paused. Click to re-enable auto-preview when selecting Hover/Focus/Selected/Disabled."
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 7px",
              borderRadius: "999px",
              border: "1px solid #F59E0B",
              background: "#FFFBEB",
              color: "#B45309",
              fontSize: "9.5px",
              fontWeight: 700,
              cursor: "pointer",
              lineHeight: 1.3,
              whiteSpace: "nowrap"
            }}
          >
            <span>👁️‍🗨️ Live Preview Paused</span>
          </button>
        ) : null}
      </div>
    );
  };

  // Shared checks for Multi-Group Batch Mode
  const mRad = getSharedProp("radius");
  const mSpc = getSharedProp("spacing");
  const mPad = getSharedProp("padding");
  const mMar = getSharedProp("margin");
  const mGap = getSharedProp("gap");
  const mBg = getSharedProp(isMs ? "msBg" : "clBg");
  const mTxt = getSharedProp(isMs ? "msText" : "clText");
  const mBrd = getSharedProp(isMs ? "msBorder" : "clBorder");
  const mIco = getSharedProp(isMs ? "msIcon" : "clIcon");
  const mSBg = getSharedProp(isMs ? "msSelBg" : "clSelBg");
  const mSTx = getSharedProp(isMs ? "msSelText" : "clSelText");
  const mBM = getSharedProp("borderMode");
  const mBNone = getSharedProp("borderNone");
  const mBW = getSharedProp("borderWidth");
  const mBS = getSharedProp("borderStyle");
  const mFW = getSharedProp("fontWeight");
  const mHBg = getSharedProp(isMs ? "msHoverBg" : "clHoverBg");
  const mHTx = getSharedProp(isMs ? "msHoverText" : "clHoverText");
  const mFBr = getSharedProp(isMs ? "msFocusBorder" : "clFocusBorder");
  const mOuterShd = getSharedProp(isMs ? "msOuterShadow" : "clOuterShadow");
  const mInnerShd = getSharedProp(isMs ? "msInnerShadow" : "clInnerShadow");
  const mBreakpointTarget = getSharedProp("breakpointTarget");
  const anySpacingInMulti = multiTargetGroups.some((g) => g.spacing);

  const renderBorderControlsBlock = (opts: {
    stateTag: GroupStateKey;
    colorValue: string;
    colorMixed?: boolean;
    borderEnabled: boolean;
    onToggleBorderEnabled: (en: boolean) => void;
    onChangeColor: (nextColor: string) => void;
    borderWidthEnabled: boolean;
    onToggleBorderWidthEnabled: (en: boolean) => void;
    borderMode?: ThemeBorderMode | undefined;
    borderNone?: boolean | undefined;
    borderWidth?: string | undefined;
    borderWidthMixed?: boolean;
    borderStyle?: ThemeBorderStyle | undefined;
    borderStyleMixed?: boolean;
    onPatchBorder: (patch: {
      borderMode?: ThemeBorderMode | undefined;
      borderNone?: boolean | undefined;
      borderWidth?: string | undefined;
      borderStyle?: ThemeBorderStyle | undefined;
      color?: string | undefined;
    }) => void;
    borderTokenBinding?: EcmdTokenBindingContext | undefined;
    borderPaintTokenBinding?: EcmdTokenBindingContext | undefined;
    radiusValueForToken?: string | undefined;
  }) => {
    const linkedBorderTok = opts.borderTokenBinding
      ? findDesignTokenById(opts.borderTokenBinding.tokens, opts.borderTokenBinding.linkedTokenId)
      : undefined;
    const isLinkedFullBorderTok = linkedBorderTok?.type === "border";
    const resolvedBorderTokCfg = isLinkedFullBorderTok
      ? resolveDesignTokenBorderConfig(linkedBorderTok, editPalette)
      : undefined;
    const effColorVal =
      linkedBorderTok?.type === "paint"
        ? compileDesignTokenCssValue(linkedBorderTok, editPalette)
        : resolvedBorderTokCfg?.color !== undefined
          ? resolvedBorderTokCfg.color
          : opts.colorValue;
    const effBorderMode =
      resolvedBorderTokCfg?.borderMode !== undefined ? resolvedBorderTokCfg.borderMode : opts.borderMode;
    const effBorderNone =
      resolvedBorderTokCfg?.borderNone !== undefined ? resolvedBorderTokCfg.borderNone : opts.borderNone;
    const effBorderWidth =
      resolvedBorderTokCfg?.width !== undefined ? resolvedBorderTokCfg.width : opts.borderWidth;
    const effBorderStyle =
      resolvedBorderTokCfg?.style !== undefined ? resolvedBorderTokCfg.style : opts.borderStyle;

    const resolvedMode = resolveThemeBorderMode({
      borderMode: effBorderMode,
      borderNone: effBorderNone,
      borderWidth: opts.borderWidthMixed ? "" : effBorderWidth,
      borderStyle: opts.borderStyleMixed ? undefined : effBorderStyle,
      borderColor: opts.colorMixed ? "" : effColorVal
    });
    const isNoneActive = resolvedMode === "none";
    const parsedNumPx = opts.borderWidthMixed
      ? null
      : isNoneActive
        ? 0
        : parseBorderWidthNumericPx(effBorderWidth);
    const rawWidthStr = opts.borderWidthMixed ? "" : String(effBorderWidth || "").trim();
    const hasCustomShorthand = Boolean(rawWidthStr) && parsedNumPx === null && !isZeroBorderWidthValue(rawWidthStr);
    const currentStyleVal = opts.borderStyleMixed
      ? "__MIXED__"
      : isNoneActive
        ? ""
        : (() => {
            const norm = normalizeBorderStyleValue(effBorderStyle);
            return norm === "solid" || norm === "dashed" || norm === "dotted" ? norm : "";
          })();
    const isUnset =
      resolvedMode === "unset" &&
      !rawWidthStr &&
      !String(effColorVal || "").trim() &&
      !effBorderStyle;

    const commitBorderPatch = (patch: {
      borderMode?: ThemeBorderMode | undefined;
      borderNone?: boolean | undefined;
      borderWidth?: string | undefined;
      borderStyle?: ThemeBorderStyle | undefined;
      color?: string | undefined;
    }) => {
      if (isLinkedFullBorderTok && linkedBorderTok && borderTokenEditMode && opts.borderTokenBinding?.onEditLinkedToken) {
        const nextTokVal: ThemeBorderTokenValue = {
          width: patch.borderWidth !== undefined ? patch.borderWidth : effBorderWidth,
          style: patch.borderStyle !== undefined ? patch.borderStyle : effBorderStyle,
          color: patch.color !== undefined ? patch.color : effColorVal,
          radius: resolvedBorderTokCfg?.radius,
          borderMode: patch.borderMode !== undefined ? patch.borderMode : effBorderMode,
          borderNone: patch.borderNone !== undefined ? patch.borderNone : effBorderNone
        };
        opts.borderTokenBinding.onEditLinkedToken(linkedBorderTok.id, nextTokVal, borderTokenEditScope);
        return;
      }
      opts.onPatchBorder(patch);
    };

    const handleColorChange = (nextColor: string) => {
      if (nextColor.trim() && isNoneActive) {
        commitBorderPatch({
          color: nextColor,
          borderMode: "custom",
          borderNone: false,
          borderWidth: "1px",
          borderStyle: "solid"
        });
      } else if (isLinkedFullBorderTok && linkedBorderTok && borderTokenEditMode && opts.borderTokenBinding?.onEditLinkedToken) {
        commitBorderPatch({ color: nextColor });
      } else {
        opts.onChangeColor(nextColor);
      }
    };

    const handleToggleNone = () => {
      if (isNoneActive) {
        commitBorderPatch({
          borderMode: "unset",
          borderNone: false,
          borderWidth: "",
          borderStyle: undefined
        });
      } else {
        commitBorderPatch({
          borderMode: "none",
          borderNone: true,
          borderWidth: "0px",
          borderStyle: "none"
        });
      }
    };

    const handleWidthInputChange = (rawVal: string) => {
      const trimmed = rawVal.trim();
      if (trimmed === "") {
        commitBorderPatch({
          borderMode: String(effColorVal || "").trim() || currentStyleVal ? "custom" : "unset",
          borderNone: false,
          borderWidth: "",
          borderStyle: isNoneActive ? undefined : effBorderStyle
        });
        return;
      }
      const num = Number(trimmed);
      if (!Number.isFinite(num)) return;
      const clamped = Math.max(0, Math.min(16, Math.round(num)));
      if (clamped === 0) {
        commitBorderPatch({
          borderMode: "none",
          borderNone: true,
          borderWidth: "0px",
          borderStyle: "none"
        });
      } else {
        const nextStyle: ThemeBorderStyle =
          effBorderStyle && effBorderStyle !== "none" ? effBorderStyle : "solid";
        commitBorderPatch({
          borderMode: "custom",
          borderNone: false,
          borderWidth: `${clamped}px`,
          borderStyle: nextStyle
        });
      }
    };

    const handleStyleChange = (nextStyleRaw: string) => {
      if (nextStyleRaw === "__MIXED__") return;
      if (!nextStyleRaw) {
        commitBorderPatch({
          borderMode: isNoneActive ? "unset" : rawWidthStr || String(effColorVal || "").trim() ? "custom" : "unset",
          borderNone: false,
          borderStyle: undefined
        });
        return;
      }
      const styleVal = nextStyleRaw as ThemeBorderStyle;
      commitBorderPatch({
        borderMode: "custom",
        borderNone: false,
        borderWidth: isNoneActive || isZeroBorderWidthValue(rawWidthStr) ? "1px" : rawWidthStr || "1px",
        borderStyle: styleVal
      });
    };

    const handleResetUnset = () => {
      commitBorderPatch({
        borderMode: "unset",
        borderNone: false,
        borderWidth: "",
        borderStyle: undefined,
        color: ""
      });
    };

    const borderTrayKey = `${opts.stateTag}-border`;
    const borderTrayOpen = openBorderTokenTray === borderTrayKey;

    return (
      <div
        data-ecmd-border-block={opts.stateTag}
        data-ecmd-border-mode={resolvedMode}
        style={{ display: "flex", flexDirection: "column", gap: "4px" }}
      >
        <EcmdPlasmicColorRow
          propKey="border"
          label="Border"
          value={effColorVal}
          isMixed={opts.colorMixed}
          enabled={opts.borderEnabled}
          onToggleEnabled={opts.onToggleBorderEnabled}
          onChange={handleColorChange}
          tokenBinding={opts.borderPaintTokenBinding}
        />
        <div
          data-ecmd-prop-row="borderWidth"
          data-ecmd-border-controls-bar="true"
          data-ecmd-prop-enabled={opts.borderWidthEnabled ? "true" : "false"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            paddingLeft: "0px",
            paddingBottom: "3px",
            opacity: opts.borderWidthEnabled ? 1 : 0.45,
            transition: "opacity 0.15s ease",
            flexWrap: "nowrap"
          }}
        >
          <input
            type="checkbox"
            checked={opts.borderWidthEnabled}
            aria-label="Enable Border Width"
            data-ecmd-prop-toggle="borderWidth"
            title={
              opts.borderWidthEnabled
                ? "Disable Border Width override (keeps saved value)"
                : "Enable Border Width override"
            }
            onChange={(e) => opts.onToggleBorderWidthEnabled(e.target.checked)}
            style={{ width: "13px", height: "13px", margin: 0, cursor: "pointer", flexShrink: 0, accentColor: "#0D9488" }}
          />
          <button
            type="button"
            data-ecmd-border-none-toggle="true"
            aria-pressed={isNoneActive}
            onClick={handleToggleNone}
            title={
              isNoneActive
                ? "Border Off (0px none) active — click to return to Unset"
                : "Turn border completely Off (emits 0px none transparent !important)"
            }
            style={{
              padding: "3px 6px",
              fontSize: "10px",
              fontWeight: 700,
              borderRadius: "5px",
              border: isNoneActive ? "1px solid #DC2626" : "1px solid #CBD5E1",
              background: isNoneActive ? "rgba(239, 68, 68, 0.12)" : "#F8FAFC",
              color: isNoneActive ? "#B91C1C" : "#475569",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              lineHeight: 1.2
            }}
          >
            🚫 None (0px)
          </button>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "2px",
              borderRadius: "5px",
              border: "1px solid #E2E8F0",
              background: "#F8FAFC",
              padding: "1px 4px",
              flexShrink: 0
            }}
            title={
              hasCustomShorthand
                ? `Multi-side border width (${rawWidthStr}) — type 0–16 to set uniform px`
                : "Border Width in px (0–16; entering 0 activates None / 0px)"
            }
          >
            <input
              type="number"
              min={0}
              max={16}
              step={1}
              aria-label="Border Width (px)"
              data-ecmd-border-width-input="true"
              value={parsedNumPx !== null ? String(parsedNumPx) : ""}
              placeholder={opts.borderWidthMixed ? "Mix" : hasCustomShorthand ? "…" : "px"}
              onChange={(e) => handleWidthInputChange(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              style={{
                width: "34px",
                border: "none",
                background: "transparent",
                fontSize: "11px",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                color: isNoneActive ? "#B91C1C" : "#0F172A",
                outline: "none",
                padding: "2px 1px",
                textAlign: "right"
              }}
            />
            <span style={{ fontSize: "9.5px", color: "#64748B", fontFamily: "ui-monospace, monospace" }}>px</span>
          </div>
          <select
            aria-label="Border Style"
            data-ecmd-border-style-select="true"
            value={currentStyleVal}
            onChange={(e) => handleStyleChange(e.target.value)}
            title="Border line style (solid, dashed, dotted)"
            style={{
              flex: 1,
              minWidth: "56px",
              padding: "3px 4px",
              fontSize: "10.5px",
              fontWeight: 600,
              borderRadius: "5px",
              border: "1px solid #E2E8F0",
              background: "#F8FAFC",
              color: "#334155",
              cursor: "pointer",
              outline: "none"
            }}
          >
            {opts.borderStyleMixed && <option value="__MIXED__">Mixed</option>}
            <option value="">{isNoneActive ? "none" : "Style"}</option>
            <option value="solid">solid</option>
            <option value="dashed">dashed</option>
            <option value="dotted">dotted</option>
          </select>
          <button
            type="button"
            data-ecmd-border-reset-btn="true"
            disabled={isUnset && !opts.colorMixed && !opts.borderWidthMixed && !opts.borderStyleMixed}
            onClick={handleResetUnset}
            title="Reset Border to Unset (Inherit Plasmic styling)"
            aria-label="Reset Border to Unset"
            style={{
              padding: "3px 5px",
              fontSize: "10.5px",
              fontWeight: 700,
              borderRadius: "5px",
              border: "1px solid #E2E8F0",
              background: isUnset ? "#F1F5F9" : "#FFFFFF",
              color: isUnset ? "#94A3B8" : "#334155",
              cursor: isUnset ? "default" : "pointer",
              opacity: isUnset ? 0.55 : 1,
              flexShrink: 0,
              lineHeight: 1.1
            }}
          >
            ↺
          </button>
          {opts.borderTokenBinding && (
            <button
              type="button"
              data-ecmd-border-token-toggle={opts.stateTag}
              title="Link or Save Border Token"
              onClick={() => setOpenBorderTokenTray(borderTrayOpen ? null : borderTrayKey)}
              style={{
                padding: "3px 5px",
                fontSize: "10px",
                fontWeight: 700,
                borderRadius: "5px",
                border: borderTrayOpen || isLinkedFullBorderTok ? "1px solid #0D9488" : "1px solid #E2E8F0",
                background: borderTrayOpen || isLinkedFullBorderTok ? "rgba(13, 148, 136, 0.12)" : "#FFFFFF",
                color: borderTrayOpen || isLinkedFullBorderTok ? "#0F766E" : "#475569",
                cursor: "pointer",
                flexShrink: 0,
                lineHeight: 1.1
              }}
            >
              🔖
            </button>
          )}
        </div>
        {isLinkedFullBorderTok && linkedBorderTok && opts.borderTokenBinding && (
          <div style={{ marginLeft: "18px", display: "flex", alignItems: "center" }}>
            <EcmdLinkedTokenPill
              token={linkedBorderTok}
              attrTag="border"
              onClickPill={() => setOpenBorderTokenTray(borderTrayKey)}
              onDetach={() => {
                setBorderTokenEditMode(false);
                opts.borderTokenBinding?.onDetachToken();
              }}
            />
          </div>
        )}
        {borderTrayOpen && opts.borderTokenBinding && (
          <div style={{ marginLeft: "18px" }}>
            <EcmdTokenPopoverSection
              tokens={opts.borderTokenBinding.tokens}
              compatibleTypes={["border"]}
              activePalette={opts.borderTokenBinding.activePalette}
              linkedTokenId={isLinkedFullBorderTok ? opts.borderTokenBinding.linkedTokenId : undefined}
              editTokenMode={borderTokenEditMode}
              onToggleEditTokenMode={setBorderTokenEditMode}
              editTokenScope={borderTokenEditScope}
              onChangeEditTokenScope={setBorderTokenEditScope}
              onSelectToken={(tokId) => opts.borderTokenBinding?.onSelectToken(tokId)}
              onDetachToken={() => {
                setBorderTokenEditMode(false);
                opts.borderTokenBinding?.onDetachToken();
              }}
              onSaveAsToken={(name) => opts.borderTokenBinding?.onSaveAsToken(name)}
              saveButtonLabel="+ Save Border Token"
              defaultTokenName="Card Border"
              attrTag="border-full"
            />
          </div>
        )}
      </div>
    );
  };

  const renderRadiusControlRow = (opts: {
    stateTag: GroupStateKey;
    enabled: boolean;
    onToggleEnabled: (en: boolean) => void;
    value: string;
    isMixed?: boolean;
    onChange: (val: string) => void;
    tokenBinding: EcmdTokenBindingContext;
    borderTop?: boolean;
  }) => {
    const linkedRadTok = findDesignTokenById(opts.tokenBinding.tokens, opts.tokenBinding.linkedTokenId);
    const effVal = linkedRadTok ? compileDesignTokenCssValue(linkedRadTok, editPalette) : opts.value;
    const trayKey = `${opts.stateTag}-radius`;
    const trayOpen = openRadiusTokenTray === trayKey;

    const handleRadiusChange = (nextVal: string) => {
      if (linkedRadTok && radiusTokenEditMode && opts.tokenBinding.onEditLinkedToken) {
        opts.tokenBinding.onEditLinkedToken(linkedRadTok.id, nextVal, radiusTokenEditScope);
        return;
      }
      opts.onChange(nextVal);
    };

    return (
      <div
        data-ecmd-prop-row="radius"
        data-ecmd-prop-enabled={opts.enabled ? "true" : "false"}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          paddingTop: opts.borderTop ? "3px" : undefined,
          borderTop: opts.borderTop ? "1px dashed #E2E8F0" : undefined,
          opacity: opts.enabled ? 1 : 0.45,
          transition: "opacity 0.15s ease"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
          <input
            type="checkbox"
            checked={opts.enabled}
            aria-label={opts.stateTag === "default" ? "Enable Corner Radius" : "Enable State Corner Radius"}
            data-ecmd-prop-toggle="radius"
            title={opts.enabled ? "Disable Corner Radius override (keeps saved value)" : "Enable Corner Radius override"}
            onChange={(e) => opts.onToggleEnabled(e.target.checked)}
            style={{ width: "13px", height: "13px", margin: 0, cursor: "pointer", flexShrink: 0, accentColor: "#0D9488" }}
          />
          <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500, width: "80px", flexShrink: 0 }}>Corner Radius</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <EcmdRadiusBoxControl value={opts.isMixed && !linkedRadTok ? "" : effVal} updateValue={handleRadiusChange} />
          </div>
          <button
            type="button"
            data-ecmd-radius-token-toggle={opts.stateTag}
            title="Link or Save Radius Token"
            onClick={() => setOpenRadiusTokenTray(trayOpen ? null : trayKey)}
            style={{
              padding: "3px 5px",
              fontSize: "10px",
              fontWeight: 700,
              borderRadius: "5px",
              border: trayOpen || linkedRadTok ? "1px solid #0D9488" : "1px solid #E2E8F0",
              background: trayOpen || linkedRadTok ? "rgba(13, 148, 136, 0.12)" : "#FFFFFF",
              color: trayOpen || linkedRadTok ? "#0F766E" : "#475569",
              cursor: "pointer",
              flexShrink: 0,
              lineHeight: 1.1
            }}
          >
            🔖
          </button>
        </div>
        {linkedRadTok && (
          <div style={{ marginLeft: "18px", display: "flex", alignItems: "center" }}>
            <EcmdLinkedTokenPill
              token={linkedRadTok}
              attrTag="borderRadius"
              onClickPill={() => setOpenRadiusTokenTray(trayKey)}
              onDetach={() => {
                setRadiusTokenEditMode(false);
                opts.tokenBinding.onDetachToken();
              }}
            />
          </div>
        )}
        {trayOpen && (
          <div style={{ marginLeft: "18px" }}>
            <EcmdTokenPopoverSection
              tokens={opts.tokenBinding.tokens}
              compatibleTypes={["radius"]}
              activePalette={opts.tokenBinding.activePalette}
              linkedTokenId={opts.tokenBinding.linkedTokenId}
              editTokenMode={radiusTokenEditMode}
              onToggleEditTokenMode={setRadiusTokenEditMode}
              editTokenScope={radiusTokenEditScope}
              onChangeEditTokenScope={setRadiusTokenEditScope}
              onSelectToken={(tokId) => opts.tokenBinding.onSelectToken(tokId)}
              onDetachToken={() => {
                setRadiusTokenEditMode(false);
                opts.tokenBinding.onDetachToken();
              }}
              onSaveAsToken={(name) => opts.tokenBinding.onSaveAsToken(name)}
              saveButtonLabel="+ Save Radius Token"
              defaultTokenName="Card Radius"
              attrTag="borderRadius"
            />
          </div>
        )}
      </div>
    );
  };

  const renderFluidAutoScaleSection = (opts: {
    enabled: boolean;
    onToggleEnabled: (next: boolean) => void;
    fluid: GroupFluidScaleConfig | undefined;
    onPatchFluid: (patch: Partial<GroupFluidScaleConfig>) => void;
  }) => {
    const f = opts.fluid || {};
    const hasValues = Boolean(
      f.desktopFontPx ||
        f.mobileFontPx ||
        f.desktopPadYPx ||
        f.mobilePadYPx ||
        f.desktopPadXPx ||
        f.mobilePadXPx ||
        f.desktopGapPx ||
        f.mobileGapPx ||
        f.stackOnMobile
    );
    const isFluidActive = opts.enabled && f.enabled !== false && hasValues;
    const numInputStyle: React.CSSProperties = {
      width: "100%",
      minWidth: 0,
      boxSizing: "border-box",
      padding: "3px 6px",
      fontSize: "11px",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      borderRadius: "5px",
      border: "1px solid #E2E8F0",
      background: "#F8FAFC",
      color: "#0F172A",
      outline: "none"
    };

    return (
      <div
        data-ecmd-prop-row="fluidScale"
        data-ecmd-prop-enabled={opts.enabled ? "true" : "false"}
        style={{
          marginTop: "4px",
          paddingTop: "6px",
          borderTop: "1px dashed #E2E8F0",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          opacity: opts.enabled ? 1 : 0.45,
          transition: "opacity 0.15s ease"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0 }}>
            <input
              type="checkbox"
              checked={opts.enabled}
              aria-label="Enable Fluid Auto-Scale"
              data-ecmd-prop-toggle="fluidScale"
              title={
                opts.enabled
                  ? "Disable Fluid Auto-Scale CSS (keeps saved clamp values)"
                  : "Enable Fluid Auto-Scale CSS"
              }
              onChange={(e) => opts.onToggleEnabled(e.target.checked)}
              style={{ width: "13px", height: "13px", margin: 0, cursor: "pointer", flexShrink: 0, accentColor: "#0D9488" }}
            />
            <button
              type="button"
              data-ecmd-fluid-scale-expand="true"
              onClick={() => setFluidScaleOpen((v) => !v)}
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "4px",
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
                fontSize: "11.5px",
                fontWeight: 600,
                color: "#0F766E"
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                📏 Fluid Auto-Scale (Responsive)
              </span>
              <span style={{ fontSize: "10px", color: "#64748B", flexShrink: 0 }}>
                {isFluidActive ? "clamp() · " : ""}
                {fluidScaleOpen ? "▾" : "▸"}
              </span>
            </button>
          </div>
        </div>

        {fluidScaleOpen && (
          <div
            data-ecmd-fluid-scale-panel="true"
            style={{
              padding: "7px 8px",
              borderRadius: "7px",
              border: "1px solid #CBD5E1",
              background: "#F8FAFC",
              display: "flex",
              flexDirection: "column",
              gap: "6px"
            }}
          >
            <div style={{ fontSize: "10px", color: "#475569", lineHeight: 1.35 }}>
              Smoothly scales via CSS <code>clamp()</code> from <b>375px</b> Mobile to <b>1440px</b> Desktop.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "68px 1fr 1fr", gap: "4px 6px", alignItems: "center" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B" }}>Metric</span>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#0F766E" }}>Desktop (px)</span>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#0369A1" }}>Mobile (px)</span>

              <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#334155" }}>Font</span>
              <input
                type="number"
                min={0}
                placeholder="e.g. 24"
                aria-label="Desktop Font (px)"
                data-ecmd-fluid-input="desktopFontPx"
                value={f.desktopFontPx ?? ""}
                onChange={(e) => opts.onPatchFluid({ desktopFontPx: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                style={numInputStyle}
              />
              <input
                type="number"
                min={0}
                placeholder="e.g. 16"
                aria-label="Mobile Font (px)"
                data-ecmd-fluid-input="mobileFontPx"
                value={f.mobileFontPx ?? ""}
                onChange={(e) => opts.onPatchFluid({ mobileFontPx: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                style={numInputStyle}
              />

              <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#334155" }}>Pad Y</span>
              <input
                type="number"
                min={0}
                placeholder="e.g. 24"
                aria-label="Desktop Pad Y (px)"
                data-ecmd-fluid-input="desktopPadYPx"
                value={f.desktopPadYPx ?? ""}
                onChange={(e) => opts.onPatchFluid({ desktopPadYPx: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                style={numInputStyle}
              />
              <input
                type="number"
                min={0}
                placeholder="e.g. 12"
                aria-label="Mobile Pad Y (px)"
                data-ecmd-fluid-input="mobilePadYPx"
                value={f.mobilePadYPx ?? ""}
                onChange={(e) => opts.onPatchFluid({ mobilePadYPx: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                style={numInputStyle}
              />

              <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#334155" }}>Pad X</span>
              <input
                type="number"
                min={0}
                placeholder="e.g. 32"
                aria-label="Desktop Pad X (px)"
                data-ecmd-fluid-input="desktopPadXPx"
                value={f.desktopPadXPx ?? ""}
                onChange={(e) => opts.onPatchFluid({ desktopPadXPx: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                style={numInputStyle}
              />
              <input
                type="number"
                min={0}
                placeholder="e.g. 14"
                aria-label="Mobile Pad X (px)"
                data-ecmd-fluid-input="mobilePadXPx"
                value={f.mobilePadXPx ?? ""}
                onChange={(e) => opts.onPatchFluid({ mobilePadXPx: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                style={numInputStyle}
              />

              <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#334155" }}>Gap</span>
              <input
                type="number"
                min={0}
                placeholder="e.g. 20"
                aria-label="Desktop Gap (px)"
                data-ecmd-fluid-input="desktopGapPx"
                value={f.desktopGapPx ?? ""}
                onChange={(e) => opts.onPatchFluid({ desktopGapPx: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                style={numInputStyle}
              />
              <input
                type="number"
                min={0}
                placeholder="e.g. 10"
                aria-label="Mobile Gap (px)"
                data-ecmd-fluid-input="mobileGapPx"
                value={f.mobileGapPx ?? ""}
                onChange={(e) => opts.onPatchFluid({ mobileGapPx: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                style={numInputStyle}
              />
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                paddingTop: "4px",
                borderTop: "1px solid #E2E8F0",
                fontSize: "10.5px",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer"
              }}
            >
              <input
                type="checkbox"
                data-ecmd-fluid-stack-mobile="true"
                checked={Boolean(f.stackOnMobile)}
                onChange={(e) => opts.onPatchFluid({ stackOnMobile: e.target.checked })}
                style={{ width: "13px", height: "13px", margin: 0, accentColor: "#0D9488", cursor: "pointer" }}
              />
              <span>Stack Horizontals on Mobile (&lt; 768px)</span>
            </label>
          </div>
        )}
      </div>
    );
  };

  const studioModal = panelOpen ? (
    <div
      ref={modalRef}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: winBox.top + "px",
        left: winBox.left + "px",
        width: winBox.width + "px",
        height: winBox.height + "px",
        minWidth: MIN_W + "px",
        minHeight: MIN_H + "px",
        display: "flex",
        flexDirection: "column",
        background: "#FFFFFF",
        color: "#0F172A",
        borderRadius: "12px",
        boxShadow: "0 22px 54px rgba(15, 23, 42, 0.34), 0 0 0 1px rgba(148, 163, 184, 0.42)",
        zIndex: 2147483550,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "12px",
        userSelect: "none"
      }}
    >
      {/* Windows-Style Top Bar Edge Resize Handle (Equally Resizes Window Above Minimum Floor) */}
      <div
        title="Drag top edge to resize equally"
        onMouseDown={startProportionalResize("top")}
        style={{
          position: "absolute",
          top: "-4px",
          left: "12px",
          right: "12px",
          height: "8px",
          cursor: "ns-resize",
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <div style={{ width: "36px", height: "3px", borderRadius: "999px", background: "#CBD5E1" }} />
      </div>

      {/* Draggable Title Bar (Move Window Anywhere) + Live Theme Dropdown + Close Button */}
      <div
        onMouseDown={startHeaderDrag}
        title="Drag header bar to move window"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "11px 12px 9px",
          borderBottom: "1px solid #E2E8F0",
          background: "#F8FAFC",
          borderRadius: "12px 12px 0 0",
          cursor: "grab",
          flexShrink: 0
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "4px", minWidth: 0, flexWrap: "wrap" }}>
          <div
            data-ecmd-studio-tabs="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "2px",
              padding: "2px",
              borderRadius: "7px",
              background: "#E2E8F0"
            }}
          >
            <button
              type="button"
              data-ecmd-studio-tab="groups"
              aria-pressed={activeStudioTab === "groups"}
              title="Theme Groups Inspector (Groups Inspector)"
              onClick={() => setActiveStudioTab("groups")}
              style={{
                padding: "3px 7px",
                fontSize: "10.5px",
                fontWeight: 700,
                borderRadius: "5px",
                border: "none",
                background: activeStudioTab === "groups" ? "#FFFFFF" : "transparent",
                color: activeStudioTab === "groups" ? "#0F172A" : "#475569",
                boxShadow: activeStudioTab === "groups" ? "0 1px 2px rgba(15,23,42,0.12)" : "none",
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              Groups
            </button>
            <button
              type="button"
              data-ecmd-studio-tab="images"
              aria-pressed={activeStudioTab === "images"}
              title="Image Groups Inspector"
              onClick={() => setActiveStudioTab("images")}
              style={{
                padding: "3px 7px",
                fontSize: "10.5px",
                fontWeight: 700,
                borderRadius: "5px",
                border: "none",
                background: activeStudioTab === "images" ? "#FFFFFF" : "transparent",
                color: activeStudioTab === "images" ? "#0F766E" : "#475569",
                boxShadow: activeStudioTab === "images" ? "0 1px 2px rgba(15,23,42,0.12)" : "none",
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              Images{imageGroups.length > 0 ? ` (${imageGroups.length})` : ""}
            </button>
            <button
              type="button"
              data-ecmd-studio-tab="tokens"
              aria-pressed={activeStudioTab === "tokens"}
              title="Reusable Design Tokens (Shadows, Paints, Borders, Radii)"
              onClick={() => setActiveStudioTab("tokens")}
              style={{
                padding: "3px 7px",
                fontSize: "10.5px",
                fontWeight: 700,
                borderRadius: "5px",
                border: "none",
                background: activeStudioTab === "tokens" ? "#FFFFFF" : "transparent",
                color: activeStudioTab === "tokens" ? "#0F766E" : "#475569",
                boxShadow: activeStudioTab === "tokens" ? "0 1px 2px rgba(15,23,42,0.12)" : "none",
                cursor: "pointer",
                whiteSpace: "nowrap"
              }}
            >
              Tokens{designTokens.length > 0 ? ` (${designTokens.length})` : ""}
            </button>
          </div>
          <button
            type="button"
            data-ecmd-groups-open-attrs-btn="true"
            onClick={() => setAttrProfilesOpen((v) => !v)}
            title="Open Attribute Profiles popup"
            style={{
              padding: "3px 6px",
              fontSize: "10.5px",
              fontWeight: 700,
              borderRadius: "6px",
              border: attrProfilesOpen ? "1px solid #0D9488" : "1px solid #CBD5E1",
              background: attrProfilesOpen ? "rgba(13, 148, 136, 0.14)" : "#FFFFFF",
              color: attrProfilesOpen ? "#0F766E" : "#334155",
              cursor: "pointer"
            }}
          >
            🎛️
          </button>
          <select
            value={editPalette}
            data-ecmd-studio-palette-select="true"
            onChange={(e) => setEditPalette(e.target.value)}
            title="Select theme palette to edit"
            style={{
              padding: "3px 6px",
              fontSize: "10.5px",
              fontWeight: 700,
              borderRadius: "6px",
              border: isMs ? "1px solid #334155" : "1px solid #CBD5E1",
              background: isMs ? "#1E293B" : "#FFFFFF",
              color: isMs ? "#F8FAFC" : "#0F766E",
              cursor: "pointer",
              outline: "none",
              maxWidth: "112px"
            }}
          >
            {STUDIO_THEME_OPTIONS.map((t) => (
              <option key={t.id} value={t.id} style={{ background: "#FFFFFF", color: "#0F172A" }}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => { setMultiPickerOpen(false); setPanelOpen(false); }}
          style={{ border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#0F172A", borderRadius: "6px", padding: "3px 8px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
        >
          ✕
        </button>
      </div>

      {/* Theme Groups Inspector Sticky Filter, Sort, Accordion & Selector Bar */}
      {activeStudioTab === "groups" && (
      <div
        data-ecmd-groups-sticky-toolbar="true"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 12,
          background: "#FFFFFF",
          padding: "8px 14px 8px",
          borderBottom: "1px solid #E2E8F0",
          display: "flex",
          flexDirection: "column",
          gap: "6px"
        }}
      >
        <div
          data-ecmd-groups-inspector-header="true"
          title="Theme Groups Inspector (Groups Inspector) — per-state CSS class/selector styling panel"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}
        >
          <span style={{ fontSize: "10.5px", fontWeight: 800, letterSpacing: "0.02em", color: "#0F766E" }}>
            Theme Groups Inspector
          </span>
          <span
            data-ecmd-groups-showing-badge="true"
            style={{
              fontSize: "9.5px",
              fontWeight: 700,
              color: groupSearch.trim() ? "#0F766E" : "#64748B",
              background: groupSearch.trim() ? "rgba(13, 148, 136, 0.10)" : "#F1F5F9",
              padding: "1px 6px",
              borderRadius: "999px"
            }}
          >
            Showing {visibleGroups.length} of {enabledGroups.length}
          </span>
        </div>

        {/* Live Search Input (matches Name, Selector/Class, & Linked Token Names) */}
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <input
            type="text"
            aria-label="Search groups, classes, or tokens"
            data-ecmd-groups-search-input="true"
            value={groupSearch}
            placeholder="🔍 Search groups, classes, or tokens..."
            onChange={(e) => setGroupSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: groupSearch ? "5px 26px 5px 8px" : "5px 8px",
              fontSize: "11px",
              borderRadius: "7px",
              border: groupSearch ? "1px solid #0D9488" : "1px solid #CBD5E1",
              background: "#F8FAFC",
              color: "#0F172A",
              outline: "none"
            }}
          />
          {groupSearch.length > 0 && (
            <button
              type="button"
              aria-label="Clear groups search"
              data-ecmd-groups-search-clear="true"
              onClick={() => setGroupSearch("")}
              title="Clear search"
              style={{
                position: "absolute",
                right: "4px",
                width: "18px",
                height: "18px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                borderRadius: "4px",
                background: "#E2E8F0",
                color: "#334155",
                fontSize: "10px",
                fontWeight: 700,
                cursor: "pointer",
                padding: 0
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Sort Pills (A → Z Default / Z → A / Custom) + Collapse All / Expand All */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px", flexWrap: "wrap" }}>
          <div
            data-ecmd-groups-sort-bar="true"
            style={{ display: "inline-flex", alignItems: "center", gap: "2px", background: "#F1F5F9", padding: "2px", borderRadius: "6px", border: "1px solid #E2E8F0" }}
          >
            {(
              [
                { id: "az", label: "A → Z", title: "Natural alphabetical order (A to Z)" },
                { id: "za", label: "Z → A", title: "Reverse natural alphabetical order (Z to A)" },
                { id: "custom", label: "Custom", title: "Custom / Recent creation order" }
              ] as const
            ).map((opt) => {
              const active = groupSortBy === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-ecmd-groups-sort-btn={opt.id}
                  aria-pressed={active}
                  title={opt.title}
                  onClick={() => {
                    setFocusedRenameId(null);
                    setFrozenOrderIds(null);
                    setGroupSortBy(opt.id);
                  }}
                  style={{
                    padding: "2px 6px",
                    fontSize: "9.5px",
                    fontWeight: 700,
                    borderRadius: "4px",
                    border: "none",
                    background: active ? "#FFFFFF" : "transparent",
                    color: active ? "#0F766E" : "#475569",
                    boxShadow: active ? "0 1px 2px rgba(15,23,42,0.10)" : "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap"
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {!isMultiMode && enabledGroups.length > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
              <button
                type="button"
                data-ecmd-groups-collapse-all="true"
                onClick={handleCollapseAllGroups}
                title="Collapse all group cards to 1-line headers"
                style={{
                  padding: "2px 6px",
                  fontSize: "9.5px",
                  fontWeight: 700,
                  borderRadius: "5px",
                  border: "1px solid #CBD5E1",
                  background: allCollapsed ? "rgba(13, 148, 136, 0.12)" : "#F8FAFC",
                  color: allCollapsed ? "#0F766E" : "#334155",
                  cursor: "pointer",
                  whiteSpace: "nowrap"
                }}
              >
                ▾ Collapse All
              </button>
              <button
                type="button"
                data-ecmd-groups-expand-all="true"
                onClick={handleExpandAllGroups}
                title="Expand all visible group cards"
                style={{
                  padding: "2px 6px",
                  fontSize: "9.5px",
                  fontWeight: 700,
                  borderRadius: "5px",
                  border: "1px solid #CBD5E1",
                  background: !allCollapsed && visibleGroups.length > 1 && expandedGroupIds.size >= visibleGroups.length ? "rgba(13, 148, 136, 0.12)" : "#F8FAFC",
                  color: !allCollapsed && visibleGroups.length > 1 && expandedGroupIds.size >= visibleGroups.length ? "#0F766E" : "#334155",
                  cursor: "pointer",
                  whiteSpace: "nowrap"
                }}
              >
                ▸ Expand All
              </button>
            </div>
          )}
        </div>

        <select
          value={String(state.selectedId)}
          onChange={(e) => handleDropdownChange(e.target.value)}
          style={{
            width: "100%",
            padding: "6px 9px",
            fontSize: "12px",
            fontWeight: 600,
            borderRadius: "7px",
            border: isMultiMode ? "1px solid #8B5CF6" : "1px solid #CBD5E1",
            background: isMultiMode ? "rgba(139, 92, 246, 0.06)" : "#FFFFFF",
            color: "#0F172A",
            cursor: "pointer",
            outline: "none"
          }}
        >
          {enabledGroups.length === 0 && <option value="0">— No Groups (Click Add Group) —</option>}
          {enabledGroups.length < 100 && <option value="__ADD_GROUP__">➕ Add Group...</option>}
          {enabledGroups.length > 1 && <option value="multi">✨ Edit Multiple...</option>}
          <option value="__SYNC_GOOGLE_M3__">🔄 Revert Google Default</option>
          {enabledGroups.length > 0 && <option disabled>──────────────</option>}
          {sortedEnabledGroups.map((g) => (
            <option key={g.id} value={String(g.id)}>
              {g.pinned ? "📌 " : ""}{g.name || ("Group " + g.id)} ({(g.selector || "").split(",")[0]})
            </option>
          ))}
        </select>

        {/* Compact + New Group with Attribute Profile Bar */}
        {enabledGroups.length < 100 && (() => {
          const validNewGroupProfileId = attrStore.profiles.some((p) => p.id === newGroupProfileId)
            ? newGroupProfileId
            : (attrStore.defaultProfileId || attrStore.profiles[0]?.id || "");
          const canQuickDelNewProfile = Boolean(validNewGroupProfileId) && attrStore.profiles.length > 1;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <select
                aria-label="New Group Attribute Profile"
                data-ecmd-new-group-profile-select="true"
                value={validNewGroupProfileId}
                onChange={(e) => setNewGroupProfileId(e.target.value)}
                title="Attribute Profile pre-applied when creating + New Group"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "4px 6px",
                  fontSize: "10.5px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: "1px solid #E2E8F0",
                  background: "#F8FAFC",
                  color: "#334155",
                  cursor: "pointer",
                  outline: "none"
                }}
              >
                {attrStore.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    🎛️ {p.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Quick delete selected New Group Attribute Profile"
                data-ecmd-quick-delete-new-group-profile="true"
                disabled={!canQuickDelNewProfile}
                onClick={() => handleQuickDeleteAttributeProfile(validNewGroupProfileId)}
                title={canQuickDelNewProfile ? "Delete selected Attribute Profile (keeps existing group styles untouched)" : "Keep at least 1 profile"}
                style={{
                  padding: "4px 6px",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  borderRadius: "6px",
                  border: canQuickDelNewProfile ? "1px solid rgba(220, 38, 38, 0.30)" : "1px solid #E2E8F0",
                  background: canQuickDelNewProfile ? "rgba(239, 68, 68, 0.10)" : "#F1F5F9",
                  color: canQuickDelNewProfile ? "#DC2626" : "#94A3B8",
                  cursor: canQuickDelNewProfile ? "pointer" : "not-allowed",
                  opacity: canQuickDelNewProfile ? 1 : 0.55,
                  flexShrink: 0,
                  lineHeight: 1
                }}
              >
                🗑️
              </button>
              <button
                type="button"
                data-ecmd-new-group-btn="true"
                onClick={() => handleDropdownChange("__ADD_GROUP__")}
                style={{
                  padding: "4px 8px",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  borderRadius: "6px",
                  border: "1px solid rgba(13, 148, 136, 0.45)",
                  background: "rgba(13, 148, 136, 0.12)",
                  color: "#0F766E",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0
                }}
              >
                + New Group
              </button>
            </div>
          );
        })()}

        {/* Nested Scrollable Boolean Group Selector Popup When in "Edit Multiple" Mode! */}
        {isMultiMode && (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setMultiPickerOpen((v) => !v)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderRadius: "7px",
                border: "1px solid rgba(139, 92, 246, 0.45)",
                background: "rgba(139, 92, 246, 0.10)",
                color: "#5B21B6",
                fontSize: "11.5px",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              <span>🎯 Target Groups ({activeMultiIds.length} of {enabledGroups.length} toggled ON)</span>
              <span>{multiPickerOpen ? "▴" : "▾"}</span>
            </button>

            {multiPickerOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "36px",
                  left: 0,
                  right: 0,
                  background: "#FFFFFF",
                  border: "1px solid #CBD5E1",
                  borderRadius: "10px",
                  boxShadow: "0 16px 36px rgba(15, 23, 42, 0.25)",
                  padding: "8px 10px 10px",
                  zIndex: 2147483645,
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "6px", borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button type="button" onClick={() => commitState({ ...state, multiIds: enabledGroups.map((g) => g.id) })} style={{ border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#334155", borderRadius: "5px", padding: "2px 7px", fontSize: "10.5px", fontWeight: 600, cursor: "pointer" }}>All</button>
                    <button type="button" onClick={() => commitState({ ...state, multiIds: [] })} style={{ border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", borderRadius: "5px", padding: "2px 7px", fontSize: "10.5px", fontWeight: 600, cursor: "pointer" }}>None</button>
                  </div>
                  <button type="button" onClick={() => setMultiPickerOpen(false)} style={{ border: "none", background: "#8B5CF6", color: "#FFFFFF", borderRadius: "5px", padding: "3px 9px", fontSize: "10.5px", fontWeight: 700, cursor: "pointer" }}>✓ Done</button>
                </div>

                <div style={{ maxHeight: Math.max(196, winBox.height - 175) + "px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px", paddingRight: "2px" }}>
                  {sortedEnabledGroups.map((g) => {
                    const checked = activeMultiIds.includes(g.id);
                    return (
                      <div
                        key={g.id}
                        onClick={() => toggleMultiId(g.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "5px 8px",
                          borderRadius: "6px",
                          background: checked ? "rgba(139, 92, 246, 0.10)" : "#F8FAFC",
                          border: checked ? "1px solid rgba(139, 92, 246, 0.35)" : "1px solid #F1F5F9",
                          cursor: "pointer"
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                          <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.pinned ? "📌 " : ""}{g.name || ("Group " + g.id)}</span>
                          <span style={{ fontSize: "10px", color: "#64748B", fontFamily: "ui-monospace, monospace" }}>{g.selector || (".group-" + g.id)}</span>
                        </div>
                        {/* Pill Toggle Switch */}
                        <span style={{ width: "30px", height: "17px", borderRadius: "999px", background: checked ? "#8B5CF6" : "#CBD5E1", position: "relative", transition: "background 0.15s ease", flexShrink: 0 }}>
                          <span style={{ position: "absolute", top: "2px", left: checked ? "15px" : "2px", width: "13px", height: "13px", borderRadius: "50%", background: "#FFFFFF", transition: "left 0.15s ease" }} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Body: Either 🖼️ Images Tab OR 🔖 Tokens Tab OR Batch Shared-Property Editor OR Single Group Editor */}
      <div style={{ flex: 1, minHeight: 0, padding: "10px 14px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
        {activeStudioTab === "images" ? (
          <EcmdThemeImagesTab
            imageGroups={imageGroups}
            activePalette={editPalette}
            ownerDoc={triggerRef.current?.ownerDocument || modalRef.current?.ownerDocument || null}
            onChange={(nextImageGroups) => commitState({ ...state, imageGroups: nextImageGroups })}
          />
        ) : activeStudioTab === "tokens" ? (
          <EcmdThemeTokensTab
            tokens={designTokens}
            groups={state.groups}
            activePalette={editPalette}
            onCreateToken={handleCreateDesignToken}
            onUpdateTokenValue={handleUpdateDesignTokenValue}
            onClearTokenOverride={handleClearDesignTokenOverride}
            onRenameToken={handleRenameDesignToken}
            onDuplicateToken={handleDuplicateDesignToken}
            onDeleteToken={handleDeleteDesignToken}
            onTogglePinToken={handleTogglePinDesignToken}
          />
        ) : isMultiMode ? (
          activeMultiIds.length === 0 ? (
            <div style={{ padding: "18px 12px", textAlign: "center", color: "#64748B", background: "#F8FAFC", borderRadius: "8px", border: "1px dashed #CBD5E1" }}>
              Click <b>🎯 Target Groups</b> above and toggle ON at least 2 groups to batch-edit their shared styles!
            </div>
          ) : (
            <div style={{ border: "1px solid rgba(139, 92, 246, 0.35)", borderRadius: "9px", padding: "10px 12px", background: "#FFFFFF", display: "flex", flexDirection: "column", gap: "7px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", paddingBottom: "6px", borderBottom: "1px solid #F1F5F9" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", flex: 1, minWidth: 0 }}>
                  {multiTargetGroups.map((g) => (
                    <span key={g.id} style={{ fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "5px", background: "rgba(139, 92, 246, 0.10)", color: "#5B21B6" }}>
                      {g.name || ("G" + g.id)}
                    </span>
                  ))}
                </div>
                <button type="button" onClick={() => setConfirmDeleteId("multi")} style={{ border: "1px solid rgba(220,38,38,0.25)", background: "rgba(239,68,68,0.10)", color: "#DC2626", borderRadius: "5px", padding: "3px 7px", fontSize: "10.5px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>🗑️ Delete ({activeMultiIds.length})</button>
              </div>

              {/* Apply Attribute Profile... (Non-destructive) + Quick-Delete Profile Icon */}
              {(() => {
                const validMultiProfileId =
                  multiProfileId && attrStore.profiles.some((p) => p.id === multiProfileId) ? multiProfileId : "";
                const canQuickDelMulti = Boolean(validMultiProfileId) && attrStore.profiles.length > 1;
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <select
                      aria-label="Apply Attribute Profile to selected groups"
                      data-ecmd-apply-attr-profile="true"
                      value={validMultiProfileId}
                      onChange={(e) => {
                        setMultiProfileId(e.target.value);
                        if (e.target.value) applyProfileToMultipleGroups(e.target.value);
                      }}
                      style={{ flex: 1, minWidth: 0, padding: "4px 7px", fontSize: "11px", fontWeight: 600, borderRadius: "6px", border: "1px solid #CBD5E1", background: "#F8FAFC", color: "#334155", cursor: "pointer", outline: "none" }}
                    >
                      <option value="">🎛️ Apply Attribute Profile...</option>
                      {attrStore.profiles.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label="Quick delete selected Attribute Profile"
                      data-ecmd-quick-delete-multi-attr-profile="true"
                      disabled={!canQuickDelMulti}
                      onClick={() => handleQuickDeleteAttributeProfile(validMultiProfileId)}
                      title={
                        attrStore.profiles.length <= 1
                          ? "Keep at least 1 profile"
                          : !validMultiProfileId
                            ? "Select an Attribute Profile to delete"
                            : "Delete selected Attribute Profile (keeps existing group styles untouched)"
                      }
                      style={{
                        padding: "4px 6px",
                        fontSize: "10.5px",
                        fontWeight: 700,
                        borderRadius: "6px",
                        border: canQuickDelMulti ? "1px solid rgba(220, 38, 38, 0.30)" : "1px solid #E2E8F0",
                        background: canQuickDelMulti ? "rgba(239, 68, 68, 0.10)" : "#F1F5F9",
                        color: canQuickDelMulti ? "#DC2626" : "#94A3B8",
                        cursor: canQuickDelMulti ? "pointer" : "not-allowed",
                        opacity: canQuickDelMulti ? 1 : 0.55,
                        flexShrink: 0,
                        lineHeight: 1
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                );
              })()}

              {/* Breakpoint Target Scope (Multi-Group) */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500, width: "92px", flexShrink: 0 }}>Breakpoint</span>
                <select
                  aria-label="Breakpoint Target"
                  data-ecmd-breakpoint-target-select="true"
                  value={mBreakpointTarget.mixed ? "__MIXED__" : String(mBreakpointTarget.val || "all")}
                  onChange={(e) => {
                    if (e.target.value !== "__MIXED__") {
                      updateMultipleGroups({ breakpointTarget: e.target.value as ThemeGroupBreakpointTarget });
                    }
                  }}
                  style={{ flex: 1, minWidth: 0, padding: "4px 7px", fontSize: "11px", fontWeight: 600, borderRadius: "6px", border: "1px solid #CBD5E1", background: "#F8FAFC", color: "#334155", cursor: "pointer", outline: "none" }}
                >
                  {mBreakpointTarget.mixed && <option value="__MIXED__">Mixed — select to sync</option>}
                  {THEME_GROUP_BREAKPOINT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* 6-State Interactive Variant Bar + Live Canvas State Preview Toggle */}
              {renderLiveStatePreviewRow()}
              <div
                data-ecmd-state-bar="true"
                style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "4px", padding: "4px", borderRadius: "8px", background: "#F1F5F9", border: "1px solid #E2E8F0" }}
              >
                {GROUP_STATE_TABS.map((tab) => {
                  const isAct = activeState === tab.id;
                  const hasOv = multiTargetGroups.some((g) => hasStateOverrides(g, tab.id));
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      title={tab.hint}
                      data-ecmd-state-tab={tab.id}
                      aria-pressed={isAct}
                      onClick={() => setActiveState(tab.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px",
                        padding: "4px 5px",
                        borderRadius: "6px",
                        border: isAct ? "1px solid #8B5CF6" : "1px solid transparent",
                        background: isAct ? "#FFFFFF" : "transparent",
                        color: isAct ? "#5B21B6" : "#475569",
                        fontSize: "10px",
                        fontWeight: isAct ? 700 : 600,
                        cursor: "pointer",
                        boxShadow: isAct ? "0 1px 2px rgba(15,23,42,0.08)" : "none"
                      }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tab.shortLabel}</span>
                      {hasOv && (
                        <span
                          data-ecmd-state-dot={tab.id}
                          style={{ width: "5px", height: "5px", borderRadius: "999px", background: isAct ? "#8B5CF6" : "#14B8A6", flexShrink: 0 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {activeState === "default" ? (
                <>
                  {(() => {
                    const sharedMultiTokId = (attr: ThemeTokenAttrKey): string | undefined => {
                      const first = multiTargetGroups[0]?.tokenRefs?.[attr];
                      if (!first) return undefined;
                      return multiTargetGroups.every((g) => g.tokenRefs?.[attr] === first) ? first : undefined;
                    };
                    const mRadTokId = sharedMultiTokId("borderRadius");
                    const mBgTokId = sharedMultiTokId("background");
                    const mTxtTokId = sharedMultiTokId("text");
                    const mBrdTokId = sharedMultiTokId("border");
                    const mOuterTokId = sharedMultiTokId("boxShadow");
                    const mInnerTokId = sharedMultiTokId("innerShadow");
                    const mTextShdTokId = sharedMultiTokId("textShadow");
                    return (
                      <>
                  {renderRadiusControlRow({
                    stateTag: "default",
                    enabled: isMultiPropEnabled("radius"),
                    onToggleEnabled: (en) => toggleMultipleGroupsProp("radius", en),
                    value: String(mRad.val || ""),
                    isMixed: mRad.mixed,
                    onChange: (v) => updateMultipleGroups({ radius: v }),
                    tokenBinding: makeTokenBindingForGroups({
                      groupIds: activeMultiIds,
                      stateKey: "default",
                      attr: "borderRadius",
                      tokenType: "radius",
                      linkedTokenId: mRadTokId,
                      getCurrentValue: () => String(mRad.val || "12px")
                    })
                  })}

                  <div
                    data-ecmd-prop-row="spacing"
                    data-ecmd-prop-enabled={isMultiPropEnabled("spacing") ? "true" : "false"}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", padding: "2px 0", opacity: isMultiPropEnabled("spacing") ? 1 : 0.45, transition: "opacity 0.15s ease" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <input
                        type="checkbox"
                        checked={isMultiPropEnabled("spacing")}
                        aria-label="Enable Spacing"
                        data-ecmd-prop-toggle="spacing"
                        title={isMultiPropEnabled("spacing") ? "Disable Spacing override (keeps saved Padding/Margin/Gap)" : "Enable Spacing override"}
                        onChange={(e) => toggleMultipleGroupsProp("spacing", e.target.checked)}
                        style={{ width: "13px", height: "13px", margin: 0, cursor: "pointer", flexShrink: 0, accentColor: "#0D9488" }}
                      />
                      <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500 }}>📐 Spacing {mSpc.mixed ? "(Mixed)" : ""}</span>
                    </div>
                    <input type="checkbox" checked={Boolean(anySpacingInMulti)} onChange={(e) => updateMultipleGroups({ spacing: e.target.checked })} style={{ cursor: "pointer" }} />
                  </div>

                  {anySpacingInMulti && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", paddingLeft: "8px", borderLeft: "2px solid #C4B5FD", opacity: isMultiPropEnabled("spacing") ? 1 : 0.45, transition: "opacity 0.15s ease" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                        <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500, width: "82px", flexShrink: 0 }}>Padding</span>
                        <div style={{ flex: 1, minWidth: 0 }}><EcmdPaddingBoxControl value={mPad.mixed ? "" : String(mPad.val || "")} updateValue={(v: string) => updateMultipleGroups({ padding: v })} /></div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                        <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500, width: "82px", flexShrink: 0 }}>Margin</span>
                        <div style={{ flex: 1, minWidth: 0 }}><EcmdMarginBoxControl value={mMar.mixed ? "" : String(mMar.val || "")} updateValue={(v: string) => updateMultipleGroups({ margin: v })} /></div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                        <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500, width: "82px", flexShrink: 0 }}>Gap</span>
                        <div style={{ flex: 1, minWidth: 0 }}><EcmdGapControl value={mGap.mixed ? "" : String(mGap.val || "")} updateValue={(v: string) => updateMultipleGroups({ gap: v })} /></div>
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: "3px", paddingTop: "7px", borderTop: "1px solid #F1F5F9", display: "flex", flexDirection: "column", gap: "4px" }}>
                    <EcmdPlasmicColorRow
                      propKey="bg"
                      label="Background"
                      value={resolveDisplayedStringWithToken(mBgTokId, String(mBg.val || ""))}
                      isMixed={mBg.mixed && !mBgTokId}
                      enabled={isMultiPropEnabled("bg")}
                      onToggleEnabled={(en) => toggleMultipleGroupsProp("bg", en)}
                      onChange={(v) => updateMultipleGroups(isMs ? { msBg: v } : { clBg: v })}
                      tokenBinding={makeTokenBindingForGroups({
                        groupIds: activeMultiIds,
                        stateKey: "default",
                        attr: "background",
                        tokenType: "paint",
                        linkedTokenId: mBgTokId,
                        getCurrentValue: () => resolveDisplayedStringWithToken(mBgTokId, String(mBg.val || ""))
                      })}
                    />
                    <EcmdPlasmicColorRow
                      propKey="text"
                      label="Text"
                      value={resolveDisplayedStringWithToken(mTxtTokId, String(mTxt.val || ""))}
                      isMixed={mTxt.mixed && !mTxtTokId}
                      enabled={isMultiPropEnabled("text")}
                      onToggleEnabled={(en) => toggleMultipleGroupsProp("text", en)}
                      onChange={(v) => updateMultipleGroups(isMs ? { msText: v } : { clText: v })}
                      tokenBinding={makeTokenBindingForGroups({
                        groupIds: activeMultiIds,
                        stateKey: "default",
                        attr: "text",
                        tokenType: "paint",
                        linkedTokenId: mTxtTokId,
                        getCurrentValue: () => resolveDisplayedStringWithToken(mTxtTokId, String(mTxt.val || ""))
                      })}
                    />
                    {renderBorderControlsBlock({
                      stateTag: "default",
                      colorValue: String(mBrd.val || ""),
                      colorMixed: mBrd.mixed && !mBrdTokId,
                      borderEnabled: isMultiPropEnabled("border"),
                      onToggleBorderEnabled: (en) => toggleMultipleGroupsProp("border", en),
                      onChangeColor: (v) => updateMultipleGroups(isMs ? { msBorder: v } : { clBorder: v }),
                      borderWidthEnabled: isMultiPropEnabled("borderWidth"),
                      onToggleBorderWidthEnabled: (en) => toggleMultipleGroupsProp("borderWidth", en),
                      borderMode: mBM.mixed ? undefined : mBM.val,
                      borderNone: mBNone.mixed ? undefined : Boolean(mBNone.val),
                      borderWidth: mBW.mixed ? "" : String(mBW.val || ""),
                      borderWidthMixed: mBW.mixed && !mBrdTokId,
                      borderStyle: mBS.mixed ? undefined : mBS.val,
                      borderStyleMixed: mBS.mixed && !mBrdTokId,
                      onPatchBorder: ({ color, ...rest }) =>
                        updateMultipleGroups({
                          ...rest,
                          ...(color !== undefined ? (isMs ? { msBorder: color } : { clBorder: color }) : {})
                        }),
                      borderPaintTokenBinding: makeTokenBindingForGroups({
                        groupIds: activeMultiIds,
                        stateKey: "default",
                        attr: "border",
                        tokenType: "paint",
                        linkedTokenId: findDesignTokenById(designTokens, mBrdTokId)?.type === "paint" ? mBrdTokId : undefined,
                        getCurrentValue: () => resolveDisplayedStringWithToken(mBrdTokId, String(mBrd.val || ""))
                      }),
                      borderTokenBinding: makeTokenBindingForGroups({
                        groupIds: activeMultiIds,
                        stateKey: "default",
                        attr: "border",
                        tokenType: "border",
                        linkedTokenId: mBrdTokId,
                        getCurrentValue: () => ({
                          width: String(mBW.val || "1px"),
                          style: mBS.val || "solid",
                          color: String(mBrd.val || "#CBD5E1"),
                          radius: String(mRad.val || ""),
                          borderMode: mBM.val,
                          borderNone: Boolean(mBNone.val)
                        })
                      })
                    })}
                    <EcmdPlasmicColorRow propKey="icon" label="Icon Color" value={String(mIco.val || "")} isMixed={mIco.mixed} enabled={isMultiPropEnabled("icon")} onToggleEnabled={(en) => toggleMultipleGroupsProp("icon", en)} onChange={(v) => updateMultipleGroups(isMs ? { msIcon: v } : { clIcon: v })} />

                    <div
                      data-ecmd-prop-row="fontWeight"
                      data-ecmd-prop-enabled={isMultiPropEnabled("fontWeight") ? "true" : "false"}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", opacity: isMultiPropEnabled("fontWeight") ? 1 : 0.45, transition: "opacity 0.15s ease" }}
                    >
                      <input
                        type="checkbox"
                        checked={isMultiPropEnabled("fontWeight")}
                        aria-label="Enable Font Weight"
                        data-ecmd-prop-toggle="fontWeight"
                        title={isMultiPropEnabled("fontWeight") ? "Disable Font Weight override (keeps saved value)" : "Enable Font Weight override"}
                        onChange={(e) => toggleMultipleGroupsProp("fontWeight", e.target.checked)}
                        style={{ width: "13px", height: "13px", margin: 0, cursor: "pointer", flexShrink: 0, accentColor: "#0D9488" }}
                      />
                      <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500, width: "80px", flexShrink: 0 }}>Font Weight</span>
                      <select value={mFW.mixed ? "__MIXED__" : String(mFW.val || "")} onChange={(e) => { if (e.target.value !== "__MIXED__") updateMultipleGroups({ fontWeight: e.target.value }); }} style={{ flex: 1, minWidth: 0, padding: "4px 7px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#0F172A", outline: "none" }}>
                        {mFW.mixed && <option value="__MIXED__">Mixed — select to sync</option>}
                        <option value="">Unset (Inherit)</option>
                        <option value="400">400 — Regular</option>
                        <option value="500">500 — Google Medium</option>
                        <option value="600">600 — Semi-Bold</option>
                        <option value="700">700 — Bold</option>
                      </select>
                    </div>
                    <EcmdPlasmicShadowRow
                      mode="outer"
                      propKey="outerShadow"
                      label="Outer Shadow"
                      value={resolveDisplayedStringWithToken(mOuterTokId, String(mOuterShd.val || ""))}
                      isMixed={mOuterShd.mixed && !mOuterTokId}
                      enabled={isMultiPropEnabled("outerShadow")}
                      onToggleEnabled={(en) => toggleMultipleGroupsProp("outerShadow", en)}
                      onChange={(v) => updateMultipleGroups(isMs ? { msOuterShadow: v, msShadow: v } : { clOuterShadow: v, clShadow: v })}
                      tokenBinding={makeTokenBindingForGroups({
                        groupIds: activeMultiIds,
                        stateKey: "default",
                        attr: "boxShadow",
                        tokenType: "boxShadow",
                        linkedTokenId: mOuterTokId,
                        getCurrentValue: () => ({
                          css: resolveDisplayedStringWithToken(mOuterTokId, String(mOuterShd.val || ""))
                        })
                      })}
                    />
                    <EcmdPlasmicShadowRow
                      mode="inner"
                      propKey="innerShadow"
                      label="Inner Shadow"
                      value={resolveDisplayedStringWithToken(mInnerTokId, String(mInnerShd.val || ""))}
                      isMixed={mInnerShd.mixed && !mInnerTokId}
                      enabled={isMultiPropEnabled("innerShadow")}
                      onToggleEnabled={(en) => toggleMultipleGroupsProp("innerShadow", en)}
                      onChange={(v) => updateMultipleGroups(isMs ? { msInnerShadow: v } : { clInnerShadow: v })}
                      tokenBinding={makeTokenBindingForGroups({
                        groupIds: activeMultiIds,
                        stateKey: "default",
                        attr: "innerShadow",
                        tokenType: "boxShadow",
                        linkedTokenId: mInnerTokId,
                        getCurrentValue: () => ({
                          css: resolveDisplayedStringWithToken(mInnerTokId, String(mInnerShd.val || "")),
                          inset: true
                        })
                      })}
                    />
                    {(() => {
                      const mTextShd = getSharedDefaultTextShadow();
                      const effTextShd = resolveDisplayedTextShadowWithToken(mTextShdTokId, mTextShd.val);
                      return (
                        <EcmdTextShadowControl
                          value={effTextShd}
                          isMixed={mTextShd.mixed && !mTextShdTokId}
                          isDarkTheme={isMs}
                          previewTextColor={mTxt.mixed ? undefined : String(mTxt.val || "")}
                          onChange={(nextCfg) => updateMultipleGroupsTextShadow(nextCfg)}
                          tokenBinding={makeTokenBindingForGroups({
                            groupIds: activeMultiIds,
                            stateKey: "default",
                            attr: "textShadow",
                            tokenType: "textShadow",
                            linkedTokenId: mTextShdTokId,
                            getCurrentValue: () => ({
                              ...(effTextShd || {}),
                              textShadowEnabled: true
                            })
                          })}
                        />
                      );
                    })()}
                    {renderFluidAutoScaleSection({
                      enabled: isMultiPropEnabled("fluidScale"),
                      onToggleEnabled: (en) => toggleMultipleGroupsProp("fluidScale", en),
                      fluid: multiTargetGroups[0]?.fluidScale,
                      onPatchFluid: (patch) => updateMultipleGroupsFluidScale(patch)
                    })}
                  </div>
                      </>
                    );
                  })()}
                </>
              ) : (() => {
                const stKey = activeState as SubGroupStateKey;
                const smBg = getSharedStateThemeVal(stKey, "bg");
                const smTxt = getSharedStateThemeVal(stKey, "text");
                const smBrd = getSharedStateThemeVal(stKey, "border");
                const smIco = getSharedStateThemeVal(stKey, "icon");
                const smOuter = getSharedStateThemeVal(stKey, "outerShadow");
                const smInner = getSharedStateThemeVal(stKey, "innerShadow");
                const smRad = getSharedStateScalarVal(stKey, "radius");
                const smBM = getSharedStateScalarVal(stKey, "borderMode");
                const smBNone = getSharedStateScalarVal(stKey, "borderNone");
                const smBW = getSharedStateScalarVal(stKey, "borderWidth");
                const smBS = getSharedStateScalarVal(stKey, "borderStyle");
                const smFW = getSharedStateScalarVal(stKey, "fontWeight");
                const smOp = getSharedStateScalarVal(stKey, "opacity");
                const smCur = getSharedStateScalarVal(stKey, "cursorNotAllowed");
                const tabMeta = GROUP_STATE_TABS.find((t) => t.id === stKey);
                const sharedMultiStTokId = (attr: ThemeTokenAttrKey): string | undefined => {
                  const first = multiTargetGroups[0]?.stateOverrides?.[stKey]?.tokenRefs?.[attr];
                  if (!first) return undefined;
                  return multiTargetGroups.every((g) => g.stateOverrides?.[stKey]?.tokenRefs?.[attr] === first)
                    ? first
                    : undefined;
                };
                const smBgTokId = sharedMultiStTokId("background");
                const smTxtTokId = sharedMultiStTokId("text");
                const smBrdTokId = sharedMultiStTokId("border");
                const smRadTokId = sharedMultiStTokId("borderRadius");
                const smOuterTokId = sharedMultiStTokId("boxShadow");
                const smInnerTokId = sharedMultiStTokId("innerShadow");
                const smTextShdTokId = sharedMultiStTokId("textShadow");
                return (
                  <div data-ecmd-state-editor={stKey} style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ fontSize: "10px", color: "#5B21B6", background: "rgba(139,92,246,0.08)", borderRadius: "6px", padding: "5px 8px", fontWeight: 600 }}>
                      {tabMeta?.label}: {tabMeta?.hint}
                    </div>
                    <EcmdPlasmicColorRow
                      propKey="bg"
                      label="Background"
                      value={resolveDisplayedStringWithToken(smBgTokId, smBg.val)}
                      isMixed={smBg.mixed && !smBgTokId}
                      enabled={isMultiStatePropEnabled(stKey, "bg")}
                      onToggleEnabled={(en) => toggleMultipleGroupsStateProp(stKey, "bg", en)}
                      onChange={(v) => updateMultipleGroupsStateTheme(stKey, "bg", v)}
                      tokenBinding={makeTokenBindingForGroups({
                        groupIds: activeMultiIds,
                        stateKey: stKey,
                        attr: "background",
                        tokenType: "paint",
                        linkedTokenId: smBgTokId,
                        getCurrentValue: () => resolveDisplayedStringWithToken(smBgTokId, smBg.val)
                      })}
                    />
                    <EcmdPlasmicColorRow
                      propKey="text"
                      label="Text"
                      value={resolveDisplayedStringWithToken(smTxtTokId, smTxt.val)}
                      isMixed={smTxt.mixed && !smTxtTokId}
                      enabled={isMultiStatePropEnabled(stKey, "text")}
                      onToggleEnabled={(en) => toggleMultipleGroupsStateProp(stKey, "text", en)}
                      onChange={(v) => updateMultipleGroupsStateTheme(stKey, "text", v)}
                      tokenBinding={makeTokenBindingForGroups({
                        groupIds: activeMultiIds,
                        stateKey: stKey,
                        attr: "text",
                        tokenType: "paint",
                        linkedTokenId: smTxtTokId,
                        getCurrentValue: () => resolveDisplayedStringWithToken(smTxtTokId, smTxt.val)
                      })}
                    />
                    {renderBorderControlsBlock({
                      stateTag: stKey,
                      colorValue: smBrd.val,
                      colorMixed: smBrd.mixed && !smBrdTokId,
                      borderEnabled: isMultiStatePropEnabled(stKey, "border"),
                      onToggleBorderEnabled: (en) => toggleMultipleGroupsStateProp(stKey, "border", en),
                      onChangeColor: (v) => updateMultipleGroupsStateTheme(stKey, "border", v),
                      borderWidthEnabled: isMultiStatePropEnabled(stKey, "borderWidth"),
                      onToggleBorderWidthEnabled: (en) => toggleMultipleGroupsStateProp(stKey, "borderWidth", en),
                      borderMode: smBM.mixed ? undefined : smBM.val,
                      borderNone: smBNone.mixed ? undefined : Boolean(smBNone.val),
                      borderWidth: smBW.mixed ? "" : String(smBW.val || ""),
                      borderWidthMixed: smBW.mixed && !smBrdTokId,
                      borderStyle: smBS.mixed ? undefined : smBS.val,
                      borderStyleMixed: smBS.mixed && !smBrdTokId,
                      onPatchBorder: ({ color, ...rest }) => {
                        if (!activeMultiIds.length) return;
                        const themeBucket: "cl" | "ms" = isMs ? "ms" : "cl";
                        const nextGroups = { ...state.groups };
                        activeMultiIds.forEach((id) => {
                          const cur = nextGroups[String(id)];
                          if (!cur) return;
                          const prevOv = cur.stateOverrides?.[stKey] || {};
                          const updated: DynamicGroupItem = {
                            ...cur,
                            stateOverrides: {
                              ...(cur.stateOverrides || {}),
                              [stKey]: {
                                ...prevOv,
                                ...rest,
                                ...(color !== undefined
                                  ? { [themeBucket]: { ...(prevOv[themeBucket] || {}), border: color } }
                                  : {})
                              }
                            }
                          };
                          if (color !== undefined && stKey === "focus") {
                            if (isMs) updated.msFocusBorder = color;
                            else updated.clFocusBorder = color;
                          }
                          nextGroups[String(id)] = updated;
                        });
                        commitState({ ...state, groups: nextGroups });
                      },
                      borderPaintTokenBinding: makeTokenBindingForGroups({
                        groupIds: activeMultiIds,
                        stateKey: stKey,
                        attr: "border",
                        tokenType: "paint",
                        linkedTokenId: findDesignTokenById(designTokens, smBrdTokId)?.type === "paint" ? smBrdTokId : undefined,
                        getCurrentValue: () => resolveDisplayedStringWithToken(smBrdTokId, smBrd.val)
                      }),
                      borderTokenBinding: makeTokenBindingForGroups({
                        groupIds: activeMultiIds,
                        stateKey: stKey,
                        attr: "border",
                        tokenType: "border",
                        linkedTokenId: smBrdTokId,
                        getCurrentValue: () => ({
                          width: String(smBW.val || "1px"),
                          style: smBS.val || "solid",
                          color: smBrd.val,
                          radius: String(smRad.val || ""),
                          borderMode: smBM.val,
                          borderNone: Boolean(smBNone.val)
                        })
                      })
                    })}
                    <EcmdPlasmicColorRow propKey="icon" label="Icon Color" value={smIco.val} isMixed={smIco.mixed} enabled={isMultiStatePropEnabled(stKey, "icon")} onToggleEnabled={(en) => toggleMultipleGroupsStateProp(stKey, "icon", en)} onChange={(v) => updateMultipleGroupsStateTheme(stKey, "icon", v)} />
                    {renderRadiusControlRow({
                      stateTag: stKey,
                      enabled: isMultiStatePropEnabled(stKey, "radius"),
                      onToggleEnabled: (en) => toggleMultipleGroupsStateProp(stKey, "radius", en),
                      value: String(smRad.val || ""),
                      isMixed: smRad.mixed,
                      onChange: (v) => updateMultipleGroupsStateScalar(stKey, { radius: v }),
                      tokenBinding: makeTokenBindingForGroups({
                        groupIds: activeMultiIds,
                        stateKey: stKey,
                        attr: "borderRadius",
                        tokenType: "radius",
                        linkedTokenId: smRadTokId,
                        getCurrentValue: () => resolveDisplayedStringWithToken(smRadTokId, String(smRad.val || "12px"))
                      })
                    })}
                    <div data-ecmd-prop-row="fontWeight" data-ecmd-prop-enabled={isMultiStatePropEnabled(stKey, "fontWeight") ? "true" : "false"} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", opacity: isMultiStatePropEnabled(stKey, "fontWeight") ? 1 : 0.45 }}>
                      <input type="checkbox" checked={isMultiStatePropEnabled(stKey, "fontWeight")} aria-label="Enable State Font Weight" data-ecmd-prop-toggle="fontWeight" onChange={(e) => toggleMultipleGroupsStateProp(stKey, "fontWeight", e.target.checked)} style={{ width: "13px", height: "13px", margin: 0, cursor: "pointer", flexShrink: 0, accentColor: "#0D9488" }} />
                      <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500, width: "80px", flexShrink: 0 }}>Font Weight</span>
                      <select value={smFW.mixed ? "__MIXED__" : String(smFW.val || "")} onChange={(e) => { if (e.target.value !== "__MIXED__") updateMultipleGroupsStateScalar(stKey, { fontWeight: e.target.value }); }} style={{ flex: 1, minWidth: 0, padding: "4px 7px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#0F172A", outline: "none" }}>
                        {smFW.mixed && <option value="__MIXED__">Mixed</option>}
                        <option value="">Inherit Default</option>
                        <option value="400">400 — Regular</option>
                        <option value="500">500 — Google Medium</option>
                        <option value="600">600 — Semi-Bold</option>
                        <option value="700">700 — Bold</option>
                      </select>
                    </div>
                    <EcmdPlasmicShadowRow
                      mode="outer"
                      propKey="outerShadow"
                      label="Outer Shadow"
                      value={resolveDisplayedStringWithToken(smOuterTokId, smOuter.val)}
                      isMixed={smOuter.mixed && !smOuterTokId}
                      enabled={isMultiStatePropEnabled(stKey, "outerShadow")}
                      onToggleEnabled={(en) => toggleMultipleGroupsStateProp(stKey, "outerShadow", en)}
                      onChange={(v) => updateMultipleGroupsStateTheme(stKey, "outerShadow", v)}
                      tokenBinding={makeTokenBindingForGroups({
                        groupIds: activeMultiIds,
                        stateKey: stKey,
                        attr: "boxShadow",
                        tokenType: "boxShadow",
                        linkedTokenId: smOuterTokId,
                        getCurrentValue: () => ({ css: resolveDisplayedStringWithToken(smOuterTokId, smOuter.val) })
                      })}
                    />
                    <EcmdPlasmicShadowRow
                      mode="inner"
                      propKey="innerShadow"
                      label="Inner Shadow"
                      value={resolveDisplayedStringWithToken(smInnerTokId, smInner.val)}
                      isMixed={smInner.mixed && !smInnerTokId}
                      enabled={isMultiStatePropEnabled(stKey, "innerShadow")}
                      onToggleEnabled={(en) => toggleMultipleGroupsStateProp(stKey, "innerShadow", en)}
                      onChange={(v) => updateMultipleGroupsStateTheme(stKey, "innerShadow", v)}
                      tokenBinding={makeTokenBindingForGroups({
                        groupIds: activeMultiIds,
                        stateKey: stKey,
                        attr: "innerShadow",
                        tokenType: "boxShadow",
                        linkedTokenId: smInnerTokId,
                        getCurrentValue: () => ({ css: resolveDisplayedStringWithToken(smInnerTokId, smInner.val), inset: true })
                      })}
                    />
                    {(() => {
                      const smTextShd = getSharedStateTextShadow(stKey);
                      const effSmTextShd = resolveDisplayedTextShadowWithToken(smTextShdTokId, smTextShd.val);
                      return (
                        <EcmdTextShadowControl
                          value={effSmTextShd}
                          isMixed={smTextShd.mixed && !smTextShdTokId}
                          isDarkTheme={isMs}
                          previewTextColor={smTxt.mixed ? undefined : (smTxt.val || (mTxt.mixed ? undefined : String(mTxt.val || "")))}
                          onChange={(nextCfg) => updateMultipleGroupsStateTextShadow(stKey, nextCfg)}
                          tokenBinding={makeTokenBindingForGroups({
                            groupIds: activeMultiIds,
                            stateKey: stKey,
                            attr: "textShadow",
                            tokenType: "textShadow",
                            linkedTokenId: smTextShdTokId,
                            getCurrentValue: () => ({
                              ...(effSmTextShd || {}),
                              textShadowEnabled: true
                            })
                          })}
                        />
                      );
                    })()}
                    {stKey === "disabled" && (
                      <div style={{ borderTop: "1px dashed #E2E8F0", paddingTop: "6px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                          <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500, width: "92px", flexShrink: 0 }}>Opacity (%)</span>
                          <input type="text" data-ecmd-disabled-opacity-input="true" value={smOp.mixed ? "" : String(smOp.val || "")} placeholder="e.g. 50%" onChange={(e) => updateMultipleGroupsStateScalar("disabled", { opacity: e.target.value })} onKeyDown={(e) => e.stopPropagation()} style={{ flex: 1, minWidth: 0, padding: "4px 7px", fontSize: "11.5px", fontFamily: "ui-monospace, monospace", borderRadius: "6px", border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#0F172A", outline: "none" }} />
                        </div>
                        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#334155", fontWeight: 500, cursor: "pointer" }}>
                          <input type="checkbox" data-ecmd-disabled-cursor-toggle="true" checked={Boolean(smCur.val)} onChange={(e) => updateMultipleGroupsStateScalar("disabled", { cursorNotAllowed: e.target.checked })} style={{ accentColor: "#0D9488" }} />
                          <span>Force <code>cursor: not-allowed</code></span>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )
        ) : enabledGroups.length > 0 ? (
          visibleGroups.length === 0 ? (
            <div
              data-ecmd-groups-search-empty="true"
              style={{
                padding: "20px 14px",
                textAlign: "center",
                background: "#F8FAFC",
                borderRadius: "10px",
                border: "1px dashed #CBD5E1",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#0F172A" }}>
                No groups match &apos;{groupSearch.trim()}&apos;
              </span>
              <span style={{ fontSize: "10.5px", color: "#64748B" }}>
                Search matches group names, CSS selectors/classes, and linked design token names.
              </span>
              <button
                type="button"
                data-ecmd-groups-clear-search-empty="true"
                onClick={() => setGroupSearch("")}
                style={{
                  border: "1px solid #0D9488",
                  background: "rgba(13, 148, 136, 0.12)",
                  color: "#0F766E",
                  borderRadius: "6px",
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Clear Search
              </button>
            </div>
          ) : (
            <div data-ecmd-groups-accordion-list="true" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {visibleGroups.map((grp) => {
                const isSelected = singleGroup?.id === grp.id;
                const isExpanded = !allCollapsed && expandedGroupIds.has(grp.id);
                const swatchBg = isMs ? grp.msBg : grp.clBg;
                const swatchTxt = isMs ? grp.msText : grp.clText;
                const primarySel = ((grp.selector || (".gm-group-" + grp.id)).split(",")[0] || "").trim();

                return (
                  <div
                    key={grp.id}
                    ref={(el) => { groupCardRefs.current[grp.id] = el; }}
                    data-ecmd-group-card={grp.id}
                    data-ecmd-group-expanded={isExpanded ? "true" : "false"}
                    data-ecmd-group-pinned={grp.pinned ? "true" : "false"}
                    style={{
                      border: isSelected ? "1px solid #0D9488" : grp.pinned ? "1px solid #F59E0B" : "1px solid #E2E8F0",
                      borderRadius: "9px",
                      background: "#FFFFFF",
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden"
                    }}
                  >
                    {/* Compact 1-Line Scannable Group Accordion Header */}
                    <div
                      data-ecmd-group-header={grp.id}
                      onClick={() => handleToggleGroupAccordion(grp.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "6px",
                        padding: "6px 9px",
                        background: isSelected ? "rgba(13, 148, 136, 0.08)" : grp.pinned ? "rgba(245, 158, 11, 0.06)" : "#F8FAFC",
                        borderBottom: isExpanded ? "1px solid #E2E8F0" : "none",
                        cursor: "pointer",
                        userSelect: "none"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: "10px", color: "#64748B", width: "10px", flexShrink: 0, textAlign: "center" }}>
                          {isExpanded ? "▾" : "▸"}
                        </span>
                        <span
                          title="Active theme background / text preview"
                          style={{
                            width: "12px",
                            height: "12px",
                            borderRadius: "3px",
                            border: "1px solid #CBD5E1",
                            background: swatchBg || "#FFFFFF",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "7.5px",
                            fontWeight: 800,
                            color: swatchTxt || "#0F172A",
                            flexShrink: 0
                          }}
                        >
                          A
                        </span>
                        <span
                          data-ecmd-group-header-name={grp.id}
                          style={{
                            fontSize: "11.5px",
                            fontWeight: 700,
                            color: "#0F172A",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {grp.name || ("Group " + grp.id)}
                        </span>
                        {primarySel && (
                          <code
                            style={{
                              fontSize: "9.5px",
                              color: "#64748B",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "110px"
                            }}
                          >
                            {primarySel}
                          </code>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                        <button
                          type="button"
                          aria-label={grp.pinned ? `Unpin ${grp.name || ("Group " + grp.id)}` : `Pin ${grp.name || ("Group " + grp.id)} to top`}
                          aria-pressed={Boolean(grp.pinned)}
                          data-ecmd-group-pin-btn={grp.id}
                          title={grp.pinned ? "Pinned to top (click to unpin)" : "Pin favorite group to top"}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleGroupPin(grp.id);
                          }}
                          style={{
                            border: grp.pinned ? "1px solid #F59E0B" : "1px solid transparent",
                            background: grp.pinned ? "#FEF3C7" : "transparent",
                            color: grp.pinned ? "#B45309" : "#94A3B8",
                            borderRadius: "4px",
                            padding: "1px 4px",
                            fontSize: "10px",
                            lineHeight: 1.2,
                            cursor: "pointer",
                            opacity: grp.pinned ? 1 : 0.65
                          }}
                        >
                          📌
                        </button>
                      </div>
                    </div>

                    {isExpanded && !isSelected && (
                      <div
                        data-ecmd-group-compact-body={grp.id}
                        style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: "6px", background: "#FFFFFF" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "10.5px", color: "#475569", fontWeight: 600, width: "60px", flexShrink: 0 }}>Name</span>
                          <input
                            type="text"
                            ref={(el) => { groupRenameInputRefs.current[grp.id] = el; }}
                            data-ecmd-group-rename-input={grp.id}
                            value={grp.name}
                            placeholder={"Group " + grp.id}
                            onFocus={() => handleRenameFocus(grp.id)}
                            onBlur={() => handleRenameBlur(grp.id)}
                            onChange={(e) => updateSingleGroup(grp.id, { name: e.target.value })}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Enter") {
                                (e.currentTarget as HTMLInputElement).blur();
                              }
                            }}
                            style={{ flex: 1, minWidth: 0, padding: "3px 7px", fontSize: "11px", borderRadius: "5px", border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#0F172A", outline: "none" }}
                          />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "10.5px", color: "#475569", fontWeight: 600, width: "60px", flexShrink: 0 }}>Selector</span>
                          <input
                            type="text"
                            value={grp.selector}
                            placeholder={".group-" + grp.id}
                            onChange={(e) => updateSingleGroup(grp.id, { selector: e.target.value })}
                            onKeyDown={(e) => e.stopPropagation()}
                            style={{ flex: 1, minWidth: 0, padding: "3px 7px", fontSize: "10.5px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", borderRadius: "5px", border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#0F172A", outline: "none" }}
                          />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "10px", color: "#64748B" }}>
                            #{grp.id} · {grp.breakpointTarget && grp.breakpointTarget !== "all" ? grp.breakpointTarget : "all breakpoints"}
                          </span>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                            {renderCopyAttributesTrigger(grp)}
                            <button
                              type="button"
                              data-ecmd-group-open-inspector-btn={grp.id}
                              onClick={() => {
                                setAllCollapsed(false);
                                setExpandedGroupIds((prev) => new Set([...prev, grp.id]));
                                commitState({ ...state, selectedId: grp.id });
                              }}
                              style={{
                                padding: "3px 8px",
                                fontSize: "10px",
                                fontWeight: 700,
                                borderRadius: "5px",
                                border: "1px solid rgba(13, 148, 136, 0.45)",
                                background: "rgba(13, 148, 136, 0.12)",
                                color: "#0F766E",
                                cursor: "pointer"
                              }}
                            >
                              Edit States &amp; Styles
                            </button>
                          </div>
                        </div>
                        {renderCopyAttributesDropdownAndNotice(grp)}
                      </div>
                    )}

                    {isExpanded && isSelected && singleGroup && (
                      <div style={{ padding: "10px 12px", background: "#FFFFFF", display: "flex", flexDirection: "column", gap: "7px" }}>
            <div
              data-ecmd-group-action-bar={singleGroup.id}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", flexWrap: "wrap", paddingBottom: "6px", borderBottom: "1px solid #F1F5F9" }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: 700, color: "#0F172A", cursor: "pointer" }}>
                <input type="checkbox" checked={singleGroup.enabled} onChange={(e) => updateSingleGroup(singleGroup.id, { enabled: e.target.checked })} />
                <span>Enabled (#{singleGroup.id})</span>
              </label>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                {renderCopyAttributesTrigger(singleGroup)}
                <button type="button" onClick={() => setConfirmDeleteId(singleGroup.id)} style={{ border: "1px solid rgba(220,38,38,0.25)", background: "rgba(239,68,68,0.10)", color: "#DC2626", borderRadius: "5px", padding: "2px 8px", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>Delete</button>
              </div>
            </div>
            {renderCopyAttributesDropdownAndNotice(singleGroup)}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
              <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500, width: "92px", flexShrink: 0 }}>Name</span>
              <input
                type="text"
                ref={(el) => { groupRenameInputRefs.current[singleGroup.id] = el; }}
                data-ecmd-group-rename-input={singleGroup.id}
                value={singleGroup.name}
                placeholder={"Group " + singleGroup.id}
                onFocus={() => handleRenameFocus(singleGroup.id)}
                onBlur={() => handleRenameBlur(singleGroup.id)}
                onChange={(e) => updateSingleGroup(singleGroup.id, { name: e.target.value })}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    (e.currentTarget as HTMLInputElement).blur();
                  }
                }}
                style={{ flex: 1, minWidth: 0, padding: "4px 8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#0F172A", outline: "none" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
              <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500, width: "92px", flexShrink: 0 }}>CSS Selector</span>
              <input type="text" value={singleGroup.selector} placeholder={".group-" + singleGroup.id} onChange={(e) => updateSingleGroup(singleGroup.id, { selector: e.target.value })} onKeyDown={(e) => e.stopPropagation()} style={{ flex: 1, minWidth: 0, padding: "4px 8px", fontSize: "11.5px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", borderRadius: "6px", border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#0F172A", outline: "none" }} />
            </div>

            {/* Apply Attribute Profile... (Non-destructive ON/OFF rows toggle) + Quick-Delete Profile Icon */}
            {(() => {
              const selectedGroupProfileId =
                singleGroup.attributeProfileId && attrStore.profiles.some((p) => p.id === singleGroup.attributeProfileId)
                  ? singleGroup.attributeProfileId
                  : "";
              const canQuickDelGroupProfile = Boolean(selectedGroupProfileId) && attrStore.profiles.length > 1;
              return (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                  <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500, width: "92px", flexShrink: 0 }}>Attr Profile</span>
                  <select
                    aria-label="Apply Attribute Profile"
                    data-ecmd-apply-attr-profile="true"
                    value={selectedGroupProfileId}
                    onChange={(e) => {
                      if (e.target.value) applyProfileToSingleGroup(singleGroup.id, e.target.value);
                    }}
                    style={{ flex: 1, minWidth: 0, padding: "4px 7px", fontSize: "11px", fontWeight: 600, borderRadius: "6px", border: "1px solid #CBD5E1", background: "#F8FAFC", color: "#0F766E", cursor: "pointer", outline: "none" }}
                  >
                    <option value="">Apply Attribute Profile...</option>
                    {attrStore.profiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label="Quick delete selected Attribute Profile"
                    data-ecmd-quick-delete-attr-profile="true"
                    disabled={!canQuickDelGroupProfile}
                    onClick={() => handleQuickDeleteAttributeProfile(selectedGroupProfileId)}
                    title={
                      attrStore.profiles.length <= 1
                        ? "Keep at least 1 profile"
                        : !selectedGroupProfileId
                          ? "Select an Attribute Profile to delete"
                          : "Delete selected Attribute Profile (keeps existing group styles untouched)"
                    }
                    style={{
                      padding: "4px 6px",
                      fontSize: "10.5px",
                      fontWeight: 700,
                      borderRadius: "6px",
                      border: canQuickDelGroupProfile ? "1px solid rgba(220, 38, 38, 0.30)" : "1px solid #E2E8F0",
                      background: canQuickDelGroupProfile ? "rgba(239, 68, 68, 0.10)" : "#F1F5F9",
                      color: canQuickDelGroupProfile ? "#DC2626" : "#94A3B8",
                      cursor: canQuickDelGroupProfile ? "pointer" : "not-allowed",
                      opacity: canQuickDelGroupProfile ? 1 : 0.55,
                      flexShrink: 0,
                      lineHeight: 1
                    }}
                  >
                    🗑️
                  </button>
                </div>
              );
            })()}

            {/* Breakpoint Target Scope */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
              <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500, width: "92px", flexShrink: 0 }}>Breakpoint</span>
              <select
                aria-label="Breakpoint Target"
                data-ecmd-breakpoint-target-select="true"
                value={singleGroup.breakpointTarget || "all"}
                onChange={(e) =>
                  updateSingleGroup(singleGroup.id, {
                    breakpointTarget: e.target.value as ThemeGroupBreakpointTarget
                  })
                }
                style={{ flex: 1, minWidth: 0, padding: "4px 7px", fontSize: "11px", fontWeight: 600, borderRadius: "6px", border: "1px solid #CBD5E1", background: "#F8FAFC", color: "#334155", cursor: "pointer", outline: "none" }}
              >
                {THEME_GROUP_BREAKPOINT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* 6-State Interactive Variant Bar + Live Canvas State Preview Toggle */}
            {renderLiveStatePreviewRow()}
            <div
              data-ecmd-state-bar="true"
              style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "4px", padding: "4px", borderRadius: "8px", background: "#F1F5F9", border: "1px solid #E2E8F0" }}
            >
              {GROUP_STATE_TABS.map((tab) => {
                const isAct = activeState === tab.id;
                const hasOv = hasStateOverrides(singleGroup, tab.id);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    title={tab.hint}
                    data-ecmd-state-tab={tab.id}
                    aria-pressed={isAct}
                    onClick={() => setActiveState(tab.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      padding: "4px 5px",
                      borderRadius: "6px",
                      border: isAct ? "1px solid #0D9488" : "1px solid transparent",
                      background: isAct ? "#FFFFFF" : "transparent",
                      color: isAct ? "#0F766E" : "#475569",
                      fontSize: "10px",
                      fontWeight: isAct ? 700 : 600,
                      cursor: "pointer",
                      boxShadow: isAct ? "0 1px 2px rgba(15,23,42,0.08)" : "none"
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tab.shortLabel}</span>
                    {hasOv && (
                      <span
                        data-ecmd-state-dot={tab.id}
                        style={{ width: "5px", height: "5px", borderRadius: "999px", background: "#0D9488", flexShrink: 0 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {activeState === "default" ? (
              <>
                {(() => {
                  const sRadTokId = getGroupStateTokenId(singleGroup, "default", "borderRadius");
                  const sBgTokId = getGroupStateTokenId(singleGroup, "default", "background");
                  const sTxtTokId = getGroupStateTokenId(singleGroup, "default", "text");
                  const sBrdTokId = getGroupStateTokenId(singleGroup, "default", "border");
                  const sOuterTokId = getGroupStateTokenId(singleGroup, "default", "boxShadow");
                  const sInnerTokId = getGroupStateTokenId(singleGroup, "default", "innerShadow");
                  const sTextShdTokId = getGroupStateTokenId(singleGroup, "default", "textShadow");
                  const dispBg = resolveDisplayedStringWithToken(sBgTokId, isMs ? singleGroup.msBg : singleGroup.clBg);
                  const dispTxt = resolveDisplayedStringWithToken(sTxtTokId, isMs ? singleGroup.msText : singleGroup.clText);
                  const dispOuter = resolveDisplayedStringWithToken(
                    sOuterTokId,
                    (isMs ? (singleGroup.msOuterShadow ?? singleGroup.msShadow) : (singleGroup.clOuterShadow ?? singleGroup.clShadow)) || ""
                  );
                  const dispInner = resolveDisplayedStringWithToken(
                    sInnerTokId,
                    (isMs ? singleGroup.msInnerShadow : singleGroup.clInnerShadow) || ""
                  );
                  const dispTextShd = resolveDisplayedTextShadowWithToken(
                    sTextShdTokId,
                    resolveSingleDefaultTextShadow(singleGroup)
                  );
                  return (
                    <>
                {renderRadiusControlRow({
                  stateTag: "default",
                  enabled: isPropEnabled(singleGroup, "radius"),
                  onToggleEnabled: (en) => toggleSingleGroupProp(singleGroup.id, "radius", en),
                  value: singleGroup.radius,
                  onChange: (v) => updateSingleGroup(singleGroup.id, { radius: v }),
                  tokenBinding: makeTokenBindingForGroups({
                    groupIds: [singleGroup.id],
                    stateKey: "default",
                    attr: "borderRadius",
                    tokenType: "radius",
                    linkedTokenId: sRadTokId,
                    getCurrentValue: () => resolveDisplayedStringWithToken(sRadTokId, singleGroup.radius || "12px")
                  })
                })}

                <div
                  data-ecmd-prop-row="spacing"
                  data-ecmd-prop-enabled={isPropEnabled(singleGroup, "spacing") ? "true" : "false"}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", padding: "2px 0", opacity: isPropEnabled(singleGroup, "spacing") ? 1 : 0.45, transition: "opacity 0.15s ease" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <input
                      type="checkbox"
                      checked={isPropEnabled(singleGroup, "spacing")}
                      aria-label="Enable Spacing"
                      data-ecmd-prop-toggle="spacing"
                      title={isPropEnabled(singleGroup, "spacing") ? "Disable Spacing override (keeps saved Padding/Margin/Gap)" : "Enable Spacing override"}
                      onChange={(e) => toggleSingleGroupProp(singleGroup.id, "spacing", e.target.checked)}
                      style={{ width: "13px", height: "13px", margin: 0, cursor: "pointer", flexShrink: 0, accentColor: "#0D9488" }}
                    />
                    <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500 }}>📐 Spacing</span>
                  </div>
                  <input type="checkbox" checked={Boolean(singleGroup.spacing)} onChange={(e) => updateSingleGroup(singleGroup.id, { spacing: e.target.checked })} style={{ cursor: "pointer" }} />
                </div>

                {singleGroup.spacing && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", paddingLeft: "8px", borderLeft: "2px solid #CBD5E1", opacity: isPropEnabled(singleGroup, "spacing") ? 1 : 0.45, transition: "opacity 0.15s ease" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500, width: "82px", flexShrink: 0 }}>Padding</span>
                      <div style={{ flex: 1, minWidth: 0 }}><EcmdPaddingBoxControl value={singleGroup.padding} updateValue={(v: string) => updateSingleGroup(singleGroup.id, { padding: v })} /></div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500, width: "82px", flexShrink: 0 }}>Margin</span>
                      <div style={{ flex: 1, minWidth: 0 }}><EcmdMarginBoxControl value={singleGroup.margin} updateValue={(v: string) => updateSingleGroup(singleGroup.id, { margin: v })} /></div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500, width: "82px", flexShrink: 0 }}>Gap</span>
                      <div style={{ flex: 1, minWidth: 0 }}><EcmdGapControl value={singleGroup.gap} updateValue={(v: string) => updateSingleGroup(singleGroup.id, { gap: v })} /></div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: "3px", paddingTop: "7px", borderTop: "1px solid #F1F5F9", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <EcmdPlasmicColorRow
                    propKey="bg"
                    label="Background"
                    value={dispBg}
                    enabled={isPropEnabled(singleGroup, "bg")}
                    onToggleEnabled={(en) => toggleSingleGroupProp(singleGroup.id, "bg", en)}
                    onChange={(v) => updateSingleGroup(singleGroup.id, isMs ? { msBg: v } : { clBg: v })}
                    tokenBinding={makeTokenBindingForGroups({
                      groupIds: [singleGroup.id],
                      stateKey: "default",
                      attr: "background",
                      tokenType: "paint",
                      linkedTokenId: sBgTokId,
                      getCurrentValue: () => dispBg
                    })}
                  />
                  <EcmdPlasmicColorRow
                    propKey="text"
                    label="Text"
                    value={dispTxt}
                    enabled={isPropEnabled(singleGroup, "text")}
                    onToggleEnabled={(en) => toggleSingleGroupProp(singleGroup.id, "text", en)}
                    onChange={(v) => updateSingleGroup(singleGroup.id, isMs ? { msText: v } : { clText: v })}
                    tokenBinding={makeTokenBindingForGroups({
                      groupIds: [singleGroup.id],
                      stateKey: "default",
                      attr: "text",
                      tokenType: "paint",
                      linkedTokenId: sTxtTokId,
                      getCurrentValue: () => dispTxt
                    })}
                  />
                  {renderBorderControlsBlock({
                    stateTag: "default",
                    colorValue: isMs ? singleGroup.msBorder : singleGroup.clBorder,
                    borderEnabled: isPropEnabled(singleGroup, "border"),
                    onToggleBorderEnabled: (en) => toggleSingleGroupProp(singleGroup.id, "border", en),
                    onChangeColor: (v) => updateSingleGroup(singleGroup.id, isMs ? { msBorder: v } : { clBorder: v }),
                    borderWidthEnabled: isPropEnabled(singleGroup, "borderWidth"),
                    onToggleBorderWidthEnabled: (en) => toggleSingleGroupProp(singleGroup.id, "borderWidth", en),
                    borderMode: singleGroup.borderMode,
                    borderNone: singleGroup.borderNone,
                    borderWidth: singleGroup.borderWidth,
                    borderStyle: singleGroup.borderStyle,
                    onPatchBorder: ({ color, ...rest }) =>
                      updateSingleGroup(singleGroup.id, {
                        ...rest,
                        ...(color !== undefined ? (isMs ? { msBorder: color } : { clBorder: color }) : {})
                      }),
                    borderPaintTokenBinding: makeTokenBindingForGroups({
                      groupIds: [singleGroup.id],
                      stateKey: "default",
                      attr: "border",
                      tokenType: "paint",
                      linkedTokenId: findDesignTokenById(designTokens, sBrdTokId)?.type === "paint" ? sBrdTokId : undefined,
                      getCurrentValue: () => resolveDisplayedStringWithToken(sBrdTokId, isMs ? singleGroup.msBorder : singleGroup.clBorder)
                    }),
                    borderTokenBinding: makeTokenBindingForGroups({
                      groupIds: [singleGroup.id],
                      stateKey: "default",
                      attr: "border",
                      tokenType: "border",
                      linkedTokenId: sBrdTokId,
                      getCurrentValue: () => ({
                        width: singleGroup.borderWidth || "1px",
                        style: singleGroup.borderStyle || "solid",
                        color: isMs ? singleGroup.msBorder : singleGroup.clBorder,
                        radius: singleGroup.radius || undefined,
                        borderMode: singleGroup.borderMode,
                        borderNone: singleGroup.borderNone
                      })
                    })
                  })}
                  <EcmdPlasmicColorRow propKey="icon" label="Icon Color" value={isMs ? singleGroup.msIcon : singleGroup.clIcon} enabled={isPropEnabled(singleGroup, "icon")} onToggleEnabled={(en) => toggleSingleGroupProp(singleGroup.id, "icon", en)} onChange={(v) => updateSingleGroup(singleGroup.id, isMs ? { msIcon: v } : { clIcon: v })} />

                  <div
                    data-ecmd-prop-row="fontWeight"
                    data-ecmd-prop-enabled={isPropEnabled(singleGroup, "fontWeight") ? "true" : "false"}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", opacity: isPropEnabled(singleGroup, "fontWeight") ? 1 : 0.45, transition: "opacity 0.15s ease" }}
                  >
                    <input
                      type="checkbox"
                      checked={isPropEnabled(singleGroup, "fontWeight")}
                      aria-label="Enable Font Weight"
                      data-ecmd-prop-toggle="fontWeight"
                      title={isPropEnabled(singleGroup, "fontWeight") ? "Disable Font Weight override (keeps saved value)" : "Enable Font Weight override"}
                      onChange={(e) => toggleSingleGroupProp(singleGroup.id, "fontWeight", e.target.checked)}
                      style={{ width: "13px", height: "13px", margin: 0, cursor: "pointer", flexShrink: 0, accentColor: "#0D9488" }}
                    />
                    <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500, width: "80px", flexShrink: 0 }}>Font Weight</span>
                    <select value={singleGroup.fontWeight || ""} onChange={(e) => updateSingleGroup(singleGroup.id, { fontWeight: e.target.value })} style={{ flex: 1, minWidth: 0, padding: "4px 8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#0F172A", outline: "none" }}>
                      <option value="">Unset (Inherit)</option>
                      <option value="400">400 — Regular</option>
                      <option value="500">500 — Google Medium</option>
                      <option value="600">600 — Semi-Bold</option>
                      <option value="700">700 — Bold</option>
                    </select>
                  </div>
                  <EcmdPlasmicShadowRow
                    mode="outer"
                    propKey="outerShadow"
                    label="Outer Shadow"
                    value={dispOuter}
                    enabled={isPropEnabled(singleGroup, "outerShadow")}
                    onToggleEnabled={(en) => toggleSingleGroupProp(singleGroup.id, "outerShadow", en)}
                    onChange={(v) => updateSingleGroup(singleGroup.id, isMs ? { msOuterShadow: v, msShadow: v } : { clOuterShadow: v, clShadow: v })}
                    tokenBinding={makeTokenBindingForGroups({
                      groupIds: [singleGroup.id],
                      stateKey: "default",
                      attr: "boxShadow",
                      tokenType: "boxShadow",
                      linkedTokenId: sOuterTokId,
                      getCurrentValue: () => ({ css: dispOuter })
                    })}
                  />
                  <EcmdPlasmicShadowRow
                    mode="inner"
                    propKey="innerShadow"
                    label="Inner Shadow"
                    value={dispInner}
                    enabled={isPropEnabled(singleGroup, "innerShadow")}
                    onToggleEnabled={(en) => toggleSingleGroupProp(singleGroup.id, "innerShadow", en)}
                    onChange={(v) => updateSingleGroup(singleGroup.id, isMs ? { msInnerShadow: v } : { clInnerShadow: v })}
                    tokenBinding={makeTokenBindingForGroups({
                      groupIds: [singleGroup.id],
                      stateKey: "default",
                      attr: "innerShadow",
                      tokenType: "boxShadow",
                      linkedTokenId: sInnerTokId,
                      getCurrentValue: () => ({ css: dispInner, inset: true })
                    })}
                  />
                  <EcmdTextShadowControl
                    value={dispTextShd}
                    isDarkTheme={isMs}
                    previewTextColor={dispTxt}
                    onChange={(nextCfg) => updateSingleGroupTextShadow(singleGroup.id, nextCfg)}
                    tokenBinding={makeTokenBindingForGroups({
                      groupIds: [singleGroup.id],
                      stateKey: "default",
                      attr: "textShadow",
                      tokenType: "textShadow",
                      linkedTokenId: sTextShdTokId,
                      getCurrentValue: () => ({
                        ...(dispTextShd || {}),
                        textShadowEnabled: true
                      })
                    })}
                  />
                  {renderFluidAutoScaleSection({
                    enabled: isPropEnabled(singleGroup, "fluidScale"),
                    onToggleEnabled: (en) => toggleSingleGroupProp(singleGroup.id, "fluidScale", en),
                    fluid: singleGroup.fluidScale,
                    onPatchFluid: (patch) => updateSingleGroupFluidScale(singleGroup.id, patch)
                  })}
                </div>
                    </>
                  );
                })()}
              </>
            ) : (() => {
              const stKey = activeState as SubGroupStateKey;
              const stOv = singleGroup.stateOverrides?.[stKey];
              const tVals = isMs ? stOv?.ms : stOv?.cl;
              const tabMeta = GROUP_STATE_TABS.find((t) => t.id === stKey);
              const hasOv = hasStateOverrides(singleGroup, stKey);
              const stBgTokId = getGroupStateTokenId(singleGroup, stKey, "background");
              const stTxtTokId = getGroupStateTokenId(singleGroup, stKey, "text");
              const stBrdTokId = getGroupStateTokenId(singleGroup, stKey, "border");
              const stRadTokId = getGroupStateTokenId(singleGroup, stKey, "borderRadius");
              const stOuterTokId = getGroupStateTokenId(singleGroup, stKey, "boxShadow");
              const stInnerTokId = getGroupStateTokenId(singleGroup, stKey, "innerShadow");
              const stTextShdTokId = getGroupStateTokenId(singleGroup, stKey, "textShadow");
              const dispStBg = resolveDisplayedStringWithToken(stBgTokId, tVals?.bg || "");
              const dispStTxt = resolveDisplayedStringWithToken(stTxtTokId, tVals?.text || "");
              const dispStOuter = resolveDisplayedStringWithToken(stOuterTokId, tVals?.outerShadow || "");
              const dispStInner = resolveDisplayedStringWithToken(stInnerTokId, tVals?.innerShadow || "");
              const dispStTextShd = resolveDisplayedTextShadowWithToken(stTextShdTokId, resolveSingleStateTextShadow(stOv));
              return (
                <div data-ecmd-state-editor={stKey} style={{ display: "flex", flexDirection: "column", gap: "5px", paddingTop: "3px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", background: "rgba(13, 148, 136, 0.08)", border: "1px solid rgba(13, 148, 136, 0.22)", borderRadius: "6px", padding: "5px 8px" }}>
                    <span style={{ fontSize: "10px", color: "#0F766E", fontWeight: 600, lineHeight: 1.3 }}>
                      <b>{tabMeta?.label}:</b> {tabMeta?.hint}
                    </span>
                    {hasOv && (
                      <button
                        type="button"
                        data-ecmd-clear-state-btn={stKey}
                        onClick={() => clearSingleGroupState(singleGroup.id, stKey)}
                        style={{ border: "none", background: "transparent", color: "#DC2626", fontSize: "10px", fontWeight: 700, cursor: "pointer", flexShrink: 0, padding: 0 }}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <EcmdPlasmicColorRow
                    propKey="bg"
                    label="Background"
                    value={dispStBg}
                    enabled={isStatePropEnabled(singleGroup, stKey, "bg")}
                    onToggleEnabled={(en) => toggleSingleGroupStateProp(singleGroup.id, stKey, "bg", en)}
                    onChange={(v) => updateSingleGroupStateTheme(singleGroup.id, stKey, "bg", v)}
                    tokenBinding={makeTokenBindingForGroups({
                      groupIds: [singleGroup.id],
                      stateKey: stKey,
                      attr: "background",
                      tokenType: "paint",
                      linkedTokenId: stBgTokId,
                      getCurrentValue: () => dispStBg
                    })}
                  />
                  <EcmdPlasmicColorRow
                    propKey="text"
                    label="Text"
                    value={dispStTxt}
                    enabled={isStatePropEnabled(singleGroup, stKey, "text")}
                    onToggleEnabled={(en) => toggleSingleGroupStateProp(singleGroup.id, stKey, "text", en)}
                    onChange={(v) => updateSingleGroupStateTheme(singleGroup.id, stKey, "text", v)}
                    tokenBinding={makeTokenBindingForGroups({
                      groupIds: [singleGroup.id],
                      stateKey: stKey,
                      attr: "text",
                      tokenType: "paint",
                      linkedTokenId: stTxtTokId,
                      getCurrentValue: () => dispStTxt
                    })}
                  />
                  {renderBorderControlsBlock({
                    stateTag: stKey,
                    colorValue: tVals?.border || "",
                    borderEnabled: isStatePropEnabled(singleGroup, stKey, "border"),
                    onToggleBorderEnabled: (en) => toggleSingleGroupStateProp(singleGroup.id, stKey, "border", en),
                    onChangeColor: (v) => updateSingleGroupStateTheme(singleGroup.id, stKey, "border", v),
                    borderWidthEnabled: isStatePropEnabled(singleGroup, stKey, "borderWidth"),
                    onToggleBorderWidthEnabled: (en) => toggleSingleGroupStateProp(singleGroup.id, stKey, "borderWidth", en),
                    borderMode: stOv?.borderMode,
                    borderNone: stOv?.borderNone,
                    borderWidth: stOv?.borderWidth,
                    borderStyle: stOv?.borderStyle,
                    onPatchBorder: ({ color, ...rest }) => {
                      const cur = state.groups[String(singleGroup.id)];
                      if (!cur) return;
                      const themeBucket: "cl" | "ms" = isMs ? "ms" : "cl";
                      const prevOv = cur.stateOverrides?.[stKey] || {};
                      const nextOv: GroupStateOverride = {
                        ...prevOv,
                        ...rest,
                        ...(color !== undefined
                          ? {
                              [themeBucket]: {
                                ...(prevOv[themeBucket] || {}),
                                border: color
                              }
                            }
                          : {})
                      };
                      const patch: Partial<DynamicGroupItem> = {
                        stateOverrides: {
                          ...(cur.stateOverrides || {}),
                          [stKey]: nextOv
                        }
                      };
                      if (color !== undefined && stKey === "focus") {
                        if (isMs) patch.msFocusBorder = color;
                        else patch.clFocusBorder = color;
                      }
                      updateSingleGroup(singleGroup.id, patch);
                    },
                    borderPaintTokenBinding: makeTokenBindingForGroups({
                      groupIds: [singleGroup.id],
                      stateKey: stKey,
                      attr: "border",
                      tokenType: "paint",
                      linkedTokenId: findDesignTokenById(designTokens, stBrdTokId)?.type === "paint" ? stBrdTokId : undefined,
                      getCurrentValue: () => resolveDisplayedStringWithToken(stBrdTokId, tVals?.border || "")
                    }),
                    borderTokenBinding: makeTokenBindingForGroups({
                      groupIds: [singleGroup.id],
                      stateKey: stKey,
                      attr: "border",
                      tokenType: "border",
                      linkedTokenId: stBrdTokId,
                      getCurrentValue: () => ({
                        width: stOv?.borderWidth || "1px",
                        style: stOv?.borderStyle || "solid",
                        color: tVals?.border || "",
                        radius: stOv?.radius || undefined,
                        borderMode: stOv?.borderMode,
                        borderNone: stOv?.borderNone
                      })
                    })
                  })}
                  <EcmdPlasmicColorRow propKey="icon" label="Icon Color" value={tVals?.icon || ""} enabled={isStatePropEnabled(singleGroup, stKey, "icon")} onToggleEnabled={(en) => toggleSingleGroupStateProp(singleGroup.id, stKey, "icon", en)} onChange={(v) => updateSingleGroupStateTheme(singleGroup.id, stKey, "icon", v)} />

                  {renderRadiusControlRow({
                    stateTag: stKey,
                    borderTop: true,
                    enabled: isStatePropEnabled(singleGroup, stKey, "radius"),
                    onToggleEnabled: (en) => toggleSingleGroupStateProp(singleGroup.id, stKey, "radius", en),
                    value: stOv?.radius || "",
                    onChange: (v) => updateSingleGroupStateScalar(singleGroup.id, stKey, { radius: v }),
                    tokenBinding: makeTokenBindingForGroups({
                      groupIds: [singleGroup.id],
                      stateKey: stKey,
                      attr: "borderRadius",
                      tokenType: "radius",
                      linkedTokenId: stRadTokId,
                      getCurrentValue: () => resolveDisplayedStringWithToken(stRadTokId, stOv?.radius || "12px")
                    })
                  })}
                  <div
                    data-ecmd-prop-row="fontWeight"
                    data-ecmd-prop-enabled={isStatePropEnabled(singleGroup, stKey, "fontWeight") ? "true" : "false"}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", opacity: isStatePropEnabled(singleGroup, stKey, "fontWeight") ? 1 : 0.45 }}
                  >
                    <input type="checkbox" checked={isStatePropEnabled(singleGroup, stKey, "fontWeight")} aria-label="Enable State Font Weight" data-ecmd-prop-toggle="fontWeight" onChange={(e) => toggleSingleGroupStateProp(singleGroup.id, stKey, "fontWeight", e.target.checked)} style={{ width: "13px", height: "13px", margin: 0, cursor: "pointer", flexShrink: 0, accentColor: "#0D9488" }} />
                    <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500, width: "80px", flexShrink: 0 }}>Font Weight</span>
                    <select value={stOv?.fontWeight || ""} onChange={(e) => updateSingleGroupStateScalar(singleGroup.id, stKey, { fontWeight: e.target.value })} style={{ flex: 1, minWidth: 0, padding: "4px 8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#0F172A", outline: "none" }}>
                      <option value="">Inherit Default</option>
                      <option value="400">400 — Regular</option>
                      <option value="500">500 — Google Medium</option>
                      <option value="600">600 — Semi-Bold</option>
                      <option value="700">700 — Bold</option>
                    </select>
                  </div>
                  <EcmdPlasmicShadowRow
                    mode="outer"
                    propKey="outerShadow"
                    label="Outer Shadow"
                    value={dispStOuter}
                    enabled={isStatePropEnabled(singleGroup, stKey, "outerShadow")}
                    onToggleEnabled={(en) => toggleSingleGroupStateProp(singleGroup.id, stKey, "outerShadow", en)}
                    onChange={(v) => updateSingleGroupStateTheme(singleGroup.id, stKey, "outerShadow", v)}
                    tokenBinding={makeTokenBindingForGroups({
                      groupIds: [singleGroup.id],
                      stateKey: stKey,
                      attr: "boxShadow",
                      tokenType: "boxShadow",
                      linkedTokenId: stOuterTokId,
                      getCurrentValue: () => ({ css: dispStOuter })
                    })}
                  />
                  <EcmdPlasmicShadowRow
                    mode="inner"
                    propKey="innerShadow"
                    label="Inner Shadow"
                    value={dispStInner}
                    enabled={isStatePropEnabled(singleGroup, stKey, "innerShadow")}
                    onToggleEnabled={(en) => toggleSingleGroupStateProp(singleGroup.id, stKey, "innerShadow", en)}
                    onChange={(v) => updateSingleGroupStateTheme(singleGroup.id, stKey, "innerShadow", v)}
                    tokenBinding={makeTokenBindingForGroups({
                      groupIds: [singleGroup.id],
                      stateKey: stKey,
                      attr: "innerShadow",
                      tokenType: "boxShadow",
                      linkedTokenId: stInnerTokId,
                      getCurrentValue: () => ({ css: dispStInner, inset: true })
                    })}
                  />
                  <EcmdTextShadowControl
                    value={dispStTextShd}
                    isDarkTheme={isMs}
                    previewTextColor={dispStTxt || (isMs ? singleGroup.msText : singleGroup.clText)}
                    onChange={(nextCfg) => updateSingleGroupStateTextShadow(singleGroup.id, stKey, nextCfg)}
                    tokenBinding={makeTokenBindingForGroups({
                      groupIds: [singleGroup.id],
                      stateKey: stKey,
                      attr: "textShadow",
                      tokenType: "textShadow",
                      linkedTokenId: stTextShdTokId,
                      getCurrentValue: () => ({
                        ...(dispStTextShd || {}),
                        textShadowEnabled: true
                      })
                    })}
                  />

                  {stKey === "disabled" && (
                    <div style={{ borderTop: "1px dashed #E2E8F0", paddingTop: "6px", marginTop: "2px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div
                        data-ecmd-prop-row="opacity"
                        data-ecmd-prop-enabled={isStatePropEnabled(singleGroup, "disabled", "opacity") ? "true" : "false"}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px", opacity: isStatePropEnabled(singleGroup, "disabled", "opacity") ? 1 : 0.45 }}
                      >
                        <input
                          type="checkbox"
                          checked={isStatePropEnabled(singleGroup, "disabled", "opacity")}
                          aria-label="Enable Disabled Opacity"
                          data-ecmd-prop-toggle="opacity"
                          onChange={(e) => toggleSingleGroupStateProp(singleGroup.id, "disabled", "opacity", e.target.checked)}
                          style={{ width: "13px", height: "13px", margin: 0, cursor: "pointer", flexShrink: 0, accentColor: "#0D9488" }}
                        />
                        <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500, width: "80px", flexShrink: 0 }}>Opacity (%)</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={(() => {
                            const n = parseFloat(String(stOv?.opacity || "").replace("%", ""));
                            if (!Number.isFinite(n)) return 50;
                            return n <= 1 && !String(stOv?.opacity || "").includes("%") ? Math.round(n * 100) : Math.round(n);
                          })()}
                          onChange={(e) => updateSingleGroupStateScalar(singleGroup.id, "disabled", { opacity: `${e.target.value}%` })}
                          style={{ flex: 1, minWidth: 0, accentColor: "#0D9488", cursor: "pointer" }}
                        />
                        <input
                          type="text"
                          data-ecmd-disabled-opacity-input="true"
                          value={stOv?.opacity || ""}
                          placeholder="50%"
                          onChange={(e) => updateSingleGroupStateScalar(singleGroup.id, "disabled", { opacity: e.target.value })}
                          onKeyDown={(e) => e.stopPropagation()}
                          style={{ width: "48px", padding: "3px 5px", fontSize: "11px", fontFamily: "ui-monospace, monospace", textAlign: "right", borderRadius: "5px", border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#0F172A", outline: "none" }}
                        />
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#334155", fontWeight: 500, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          data-ecmd-disabled-cursor-toggle="true"
                          checked={Boolean(stOv?.cursorNotAllowed)}
                          onChange={(e) => updateSingleGroupStateScalar(singleGroup.id, "disabled", { cursorNotAllowed: e.target.checked })}
                          style={{ accentColor: "#0D9488" }}
                        />
                        <span>Apply <code>cursor: not-allowed</code> visual treatment</span>
                      </label>
                    </div>
                  )}
                </div>
              );
            })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div style={{ padding: "22px 14px", textAlign: "center", background: "#F8FAFC", borderRadius: "10px", border: "1px dashed #CBD5E1", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#0F172A" }}>No Theme Groups Active</span>
            <span style={{ fontSize: "11px", color: "#64748B", lineHeight: 1.4 }}>All groups have been deleted. Create a fresh blank group or restore Google Material 3 defaults:</span>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
              <button type="button" onClick={() => handleDropdownChange("__ADD_GROUP__")} style={{ border: "none", background: "#0B57D0", color: "#FFFFFF", borderRadius: "6px", padding: "6px 12px", fontSize: "11.5px", fontWeight: 700, cursor: "pointer" }}>➕ Add Group</button>
              <button type="button" onClick={() => handleDropdownChange("__SYNC_GOOGLE_M3__")} style={{ border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#0F172A", borderRadius: "6px", padding: "6px 12px", fontSize: "11.5px", fontWeight: 600, cursor: "pointer" }}>🔄 Revert Google Default</button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Verification Popup Overlay */}
      {confirmDeleteId !== null && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(15, 23, 42, 0.48)",
            backdropFilter: "blur(2px)",
            borderRadius: "12px",
            zIndex: 2147483647,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "18px"
          }}
        >
          <div style={{ width: "100%", maxWidth: "296px", background: "#FFFFFF", borderRadius: "10px", padding: "14px 16px", boxShadow: "0 18px 40px rgba(15, 23, 42, 0.35)", border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", color: "#0F172A" }}>
              {confirmDeleteId === "revert" ? "Revert to Google M3 Defaults?" : confirmDeleteId === "multi"
                ? ("Delete " + activeMultiIds.length + " Selected Groups?")
                : ("Delete \"" + (state.groups[String(confirmDeleteId)]?.name || ("Group " + confirmDeleteId)) + "\"?")}
            </div>
            <div style={{ fontSize: "11.5px", color: "#475569", lineHeight: 1.45 }}>
              {confirmDeleteId === "revert" ? "This resets Groups 1–10 back to Google Material 3 Light & Dark colors while keeping your custom Padding, Margin, and Gap intact." : confirmDeleteId === "multi"
                ? "This will permanently remove all toggled groups and their custom theme rules. Are you sure?"
                : ("Elements using " + (state.groups[String(confirmDeleteId)]?.selector || (".gm-group-" + confirmDeleteId)) + " will stop receiving custom theme colors. This cannot be undone.")}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                style={{ border: "1px solid #CBD5E1", background: "#F8FAFC", color: "#334155", borderRadius: "6px", padding: "5px 11px", fontSize: "11.5px", fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeConfirmedDelete}
                style={{ border: "none", background: confirmDeleteId === "revert" ? "#0B57D0" : "#DC2626", color: "#FFFFFF", borderRadius: "6px", padding: "5px 12px", fontSize: "11.5px", fontWeight: 700, cursor: "pointer" }}
              >
                {confirmDeleteId === "revert" ? "🔄 Yes, Revert" : "🗑️ Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left Edge Grab — Horizontal Resize */}
      <div
        title="Drag left edge to resize width"
        onMouseDown={startEdgeResize("left")}
        style={{ position: "absolute", top: "14px", bottom: "24px", left: "-4px", width: "8px", cursor: "ew-resize", zIndex: 22 }}
      />

      {/* Right Edge Grab — Horizontal Resize */}
      <div
        title="Drag right edge to resize width"
        onMouseDown={startEdgeResize("right")}
        style={{ position: "absolute", top: "14px", bottom: "10px", right: "-4px", width: "8px", cursor: "ew-resize", zIndex: 22 }}
      />

      {/* Bottom Edge Grab — Vertical Resize */}
      <div
        title="Drag bottom edge to resize height"
        onMouseDown={startEdgeResize("bottom")}
        style={{ position: "absolute", bottom: "-4px", left: "24px", right: "10px", height: "8px", cursor: "ns-resize", zIndex: 22 }}
      />

      {/* Bottom-Left Corner Tab — Equally / Proportionally Resizes Popup (Locked to Current Size Minimum!) */}
      <div
        title="Drag bottom-left corner to resize equally"
        onMouseDown={startProportionalResize("bottom-left")}
        style={{
          position: "absolute",
          bottom: "0px",
          left: "0px",
          width: "22px",
          height: "22px",
          cursor: "nesw-resize",
          zIndex: 25,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "flex-start",
          padding: "3px 4px",
          borderBottomLeftRadius: "12px",
          background: "linear-gradient(45deg, rgba(148,163,184,0.28) 0%, rgba(148,163,184,0.10) 52%, transparent 53%)"
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ pointerEvents: "none" }}>
          <line x1="1" y1="3" x2="7" y2="9" stroke="#64748B" strokeWidth="1.4" strokeLinecap="round" />
          <line x1="1" y1="6.5" x2="3.5" y2="9" stroke="#64748B" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  ) : null;

  return (
    <div ref={triggerRef} style={{ display: "flex", flexDirection: "column", gap: "5px", width: "100%" }}>
      <select
        value={String(state.selectedId)}
        onChange={(e) => handleDropdownChange(e.target.value)}
        style={{
          width: "100%",
          padding: "5px 7px",
          fontSize: "11.5px",
          fontWeight: 600,
          borderRadius: "6px",
          border: isMultiMode ? "1px solid #8B5CF6" : "1px solid #CBD5E1",
          background: "#FFFFFF",
          color: "#0F172A",
          cursor: "pointer",
          outline: "none"
        }}
      >
          {enabledGroups.length === 0 && <option value="0">— No Groups (Click Add Group) —</option>}
          {enabledGroups.length < 100 && <option value="__ADD_GROUP__">➕ Add Group...</option>}
          {enabledGroups.length > 1 && <option value="multi">✨ Edit Multiple...</option>}
          <option value="__SYNC_GOOGLE_M3__">🔄 Revert Google Default</option>
          {enabledGroups.length > 0 && <option disabled>──────────────</option>}
          {sortedEnabledGroups.map((g) => (
            <option key={g.id} value={String(g.id)}>
              {g.pinned ? "📌 " : ""}{g.name || ("Group " + g.id)} ({(g.selector || "").split(",")[0]})
            </option>
          ))}
      </select>

      <button
        type="button"
        title="Open Theme Groups Inspector"
        onClick={() => setPanelOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "5px 9px",
          borderRadius: "6px",
          border: panelOpen ? "1px solid #0D9488" : "1px solid #CBD5E1",
          background: panelOpen ? "rgba(13, 148, 136, 0.12)" : "#F8FAFC",
          color: "#0F172A",
          fontSize: "11.5px",
          fontWeight: 600,
          cursor: "pointer"
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🎨 Edit {activeTitle}</span>
        <span style={{ fontSize: "10px", opacity: 0.7, flexShrink: 0 }}>{panelOpen ? "▾" : "▸"}</span>
      </button>

      {panelOpen && (portalTarget ? createPortal(studioModal, portalTarget) : studioModal)}
      <EcmdAttributeProfilesModal
        open={attrProfilesOpen}
        onClose={() => setAttrProfilesOpen(false)}
        onProfilesChange={(nextStore) => {
          setAttrStore(nextStore);
          setNewGroupProfileId((prev) =>
            nextStore.profiles.some((p) => p.id === prev) ? prev : nextStore.defaultProfileId
          );
          setMultiProfileId((prev) =>
            prev && nextStore.profiles.some((p) => p.id === prev) ? prev : ""
          );
        }}
        anchorDoc={triggerRef.current?.ownerDocument || null}
      />
    </div>
  );
}

export function getDynamicGroupOptionsForPlasmic(compProps?: any): Array<{ value: string; label: string }> {
  const state = buildInitialGroupsFromProps(compProps || {}, compProps?.dynamicGroupsJson);
  const enabled = Object.values(state.groups)
    .filter((g): g is DynamicGroupItem => Boolean(g && g.enabled))
    .sort((a, b) => a.id - b.id);
  const opts: Array<{ value: string; label: string }> = [{ value: "none", label: "None (Unstyled)" }];
  enabled.forEach((g) => {
    const primarySel = ((g.selector || (".gm-group-" + g.id)).split(",")[0] || "").trim();
    opts.push({
      value: String(g.id),
      label: "Group " + g.id + " — " + (g.name || ("Group " + g.id)) + (primarySel ? (" (" + primarySel + ")") : "")
    });
  });
  return opts;
}

export function resolveGroupPrimaryClass(groupRef: string | number | undefined, compProps?: any): string {
  if (groupRef === undefined || groupRef === null) return "";
  const raw = String(groupRef).trim();
  if (!raw || raw === "none" || raw === "0" || raw === "false") return "";
  const state = buildInitialGroupsFromProps(compProps || {}, compProps?.dynamicGroupsJson);
  // Support numeric ID ("1", "3", "10"), "group-3", "g3", OR legacy class string (".bars", "modals", "headerButtons")
  let num = parseInt(raw.replace(/^(group-|g)/i, ""), 10);
  if (isNaN(num)) {
    const clean = raw.replace(/^\./, "").toLowerCase();
    const matched = Object.values(state.groups).find((g) => {
      if (!g) return false;
      return (g.selector || "").split(",").some((s) => s.trim().replace(/^\./, "").toLowerCase() === clean);
    });
    if (matched) num = matched.id;
  }
  if (!isNaN(num) && num >= 1) {
    const grp = state.groups[String(num)];
    if (grp && grp.selector) {
      const classes = grp.selector
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.startsWith(".") && !s.includes(" ") && !s.includes(">") && !s.includes(":"))
        .map((s) => s.slice(1));
      if (classes.length > 0) return classes.join(" ");
    }
    return "gm-group-" + num + " group-" + num;
  }
  return raw.replace(/^\./, "");
}
export function getEcmdGroupChoiceOptions(compProps?: any): Array<{ value: string; label: string }> {
  const state = buildInitialGroupsFromProps(compProps || {}, compProps?.dynamicGroupsJson);
  const enabled = Object.values(state.groups)
    .filter((g): g is DynamicGroupItem => Boolean(g && g.enabled))
    .sort((a, b) => a.id - b.id);
  const opts: Array<{ value: string; label: string }> = [{ value: "none", label: "None (Unstyled)" }];
  enabled.forEach((g) => {
    const primarySel = ((g.selector || (".gm-group-" + g.id)).split(",")[0] || "").trim();
    opts.push({
      value: "ecmd-group-" + g.id,
      label: (g.name || ("Group " + g.id)) + (primarySel ? (" (" + primarySel + ")") : "")
    });
  });
  return opts;
}
export function EcmdGroupSelectControl(props: any) {
  const compProps = props?.componentProps || {};
  const state = buildInitialGroupsFromProps(compProps, compProps?.dynamicGroupsJson);
  const enabled = Object.values(state.groups)
    .filter((g): g is DynamicGroupItem => Boolean(g && g.enabled))
    .sort((a, b) => a.id - b.id);
  const curVal = props?.value ? String(props.value) : "none";
  const handleChange = (nextVal: string) => {
    if (typeof props?.updateValue === "function") props.updateValue(nextVal);
    else if (typeof props?.onChange === "function") props.onChange(nextVal);
  };
  return (
    <select
      value={curVal}
      onChange={(e) => handleChange(e.target.value)}
      style={{
        width: "100%",
        padding: "5px 8px",
        fontSize: "11.5px",
        fontWeight: 500,
        borderRadius: "6px",
        border: "1px solid #CBD5E1",
        background: "#F8FAFC",
        color: "#0F172A",
        cursor: "pointer",
        outline: "none"
      }}
    >
      <option value="none">None (Use Design Tab Colors)</option>
      {enabled.map((g) => {
        const primarySel = ((g.selector || (".gm-group-" + g.id)).split(",")[0] || "").trim();
        return (
          <option key={g.id} value={"ecmd-group-" + g.id}>
            {"Group " + g.id + ": " + (g.name || ("Group " + g.id)) + (primarySel ? (" (" + primarySel + ")") : "")}
          </option>
        );
      })}
    </select>
  );
}