import "./lib/ecmdRuntimeBoot";
import { EcmdGroupSelectControl } from "./components/EcmdDynamicGroupManager";
import { getEcmdGroupChoiceOptions } from "./components/EcmdDynamicGroupManager";
import { EcmdDeviceGlobalContext } from "./components/EcmdDeviceGlobalContext";
import { EcmdDynamicGroupManagerControl, getDynamicGroupOptionsForPlasmic } from "./components/EcmdDynamicGroupManager";
import { initPlasmicLoader } from "@plasmicapp/loader-react";
import { bindEcmdPlasmicLoader, registerEcmdComponent, reportEcmdRuntimeError } from "./lib/ecmdLiveComponentTelemetry";
import { EcmdHoverTooltip } from "./components/EcmdHoverTooltip";
import { EcmdThemeGroupController } from "./components/EcmdThemeGroupController";
import { EcmdPaddingBoxControl, EcmdMarginBoxControl, EcmdGapControl, EcmdRadiusBoxControl, EcmdTogglesModalControl } from "./components/EcmdSpacingBoxControl";
import { EcmdThemeLogo } from "./components/EcmdThemeLogo";
import { EcmdThemeImage } from "./components/EcmdThemeImage";
import { EcmdAuthModalController, ECMD_AUTH_LOGO_DATA_URI } from "./components/EcmdAuthModalController";
import { EcmdSideMenuController } from "./components/EcmdSideMenuController";
import { HqDailyDispatchBoard } from "./components/booking-hq/HqDailyDispatchBoard";
import { HqInvoiceCard } from "./components/booking-hq/HqInvoiceCard";
import { HqMultiStateWorkspace } from "./components/booking-hq/HqMultiStateWorkspace";
import { HqWeeklyStrip } from "./components/booking-hq/HqWeeklyStrip";
import { EcmdVehicleSelector } from "./components/EcmdVehicleSelector";
import { EcmdSavedVehicleDropdown } from "./components/EcmdSavedVehicleDropdown";
import { EcmdWhatsIncludedModal } from "./components/EcmdWhatsIncludedModal";
import { EcmdBrushedSteelButton } from "./components/EcmdBrushedSteelButton";
import {
  EcmdPackagesRepeater,
  ECMD_PKG_HERO_PLACEHOLDER_URI,
  ECMD_PKG_GUARANTEE_BADGE_URI
} from "./components/EcmdPackagesRepeater";

export const PLASMIC = initPlasmicLoader({
  projects: [
    {
      id: "mrkoQykvpZZfVbEc1yjabw",
      token: "public_token_placeholder",
    },
  ],
  preview: true,
});

bindEcmdPlasmicLoader(PLASMIC);

function safePlasmicRegister(label: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    reportEcmdRuntimeError(err, `plasmic-init:${label}`);
    console.error(`[ECMD plasmic-init] ${label} failed:`, err);
  }
}

// STRICT TOKEN REGISTRATION GUARDRAIL:
// @plasmicapp/loader-react does NOT implement registerDataToken, and PLASMIC.registerToken
// strictly allows ONLY CSS token types: ["color", "spacing", "opacity", "line-height", "font-size", "font-family"].
// String/class tokens (like Theme Image Group classes) are provided via DataProvider ($ctx.ecmdImgClass)
// in EcmdDeviceGlobalContext and via [Copy Class] inside [Site Themes] -> Images — never registerToken!

registerEcmdComponent(HqWeeklyStrip, {
  name: "HqWeeklyStrip",
  displayName: "HQ Weekly Strip",
  importPath: "./components/booking-hq/HqWeeklyStrip",
  props: {
    days: { type: "object" },
  },
});

registerEcmdComponent(HqDailyDispatchBoard, {
  name: "HqDailyDispatchBoard",
  displayName: "HQ Daily Dispatch Board",
  importPath: "./components/booking-hq/HqDailyDispatchBoard",
  props: {
    dateText: { type: "string" },
    teams: { type: "object" },
    timeSlots: { type: "object" },
  },
});

registerEcmdComponent(HqInvoiceCard, {
  name: "HqInvoiceCard",
  displayName: "HQ Invoice Card",
  importPath: "./components/booking-hq/HqInvoiceCard",
  props: {
    packageName: { type: "string" },
    tag: { type: "string" },
    vehicleDescription: { type: "string" },
    location: { type: "string" },
    customerName: { type: "string" },
    addressLine1: { type: "string" },
    addressLine2: { type: "string" },
    arrivalDetails: { type: "string" },
    totalPrice: { type: "string" },
  },
});

registerEcmdComponent(HqMultiStateWorkspace, {
  name: "HqMultiStateWorkspace",
  displayName: "HQ Multi-State Workspace",
  importPath: "./components/booking-hq/HqMultiStateWorkspace",
  props: {
    aiResponseTitle: { type: "string" },
    aiResponseText: { type: "string" },
    aiCodeBoxTitle: { type: "string" },
    aiCodeSnippet: { type: "string" },
    activeTab: { type: "string" },
    inputPlaceholder: { type: "string" },
  },
});

registerEcmdComponent(EcmdAuthModalController, {
  name: "EcmdAuthModalController",
  displayName: "Auth Model (ECMD Engine)",
  importPath: "./src/components/EcmdAuthModalController",
  props: {
    open: { type: "boolean", displayName: "Open (Controlled)", description: "Toggle open in Studio to edit the modal interior" },
    defaultOpen: { type: "boolean", displayName: "Default Open", defaultValue: false },
    authMode: { type: "choice", options: ["login", "signup", "forgot"], defaultValue: "login", displayName: "Auth Mode (Login / Sign Up / Forgot)" },
    floatOverlay: { type: "boolean", defaultValue: true, displayName: "Open Outside Parent (Floating Overlay)?" },
    fixedBreakout: { type: "boolean", defaultValue: false, displayName: "Break Out of Clipped Parent (Fixed Position)?" },
    gapBelowTrigger: { type: "number", defaultValue: 10, displayName: "Gap Below Trigger Button" },
    alignModal: { type: "choice", options: ["left", "center", "right"], defaultValue: "right", displayName: "Align Trigger & Modal" },
    dimBackdrop: { type: "boolean", defaultValue: false, displayName: "Dim Page Behind Card?" },
    dimOpacity: { type: "number", defaultValue: 0, displayName: "Dim Opacity (0 to 1)" },
    blurBackdrop: { type: "boolean", defaultValue: false, displayName: "Blur Page Behind Card?" },
    overlayBlurPx: { type: "number", defaultValue: 3, displayName: "Backdrop Blur (px)" },
    hideTrigger: { type: "boolean", defaultValue: false, displayName: "Hide trigger button?" },
    showSecondTrigger: { type: "boolean", defaultValue: true, displayName: "Show Second Trigger Button (Sign Up)?" },
    secondTriggerText: { type: "string", defaultValue: "Sign Up", displayName: "Second Trigger Button Text" },
    autoSwapLogout: { type: "boolean", defaultValue: true, displayName: "Auto-Swap Trigger to Log Out When Logged In?" },
    loggedOutText: { type: "string", defaultValue: "Member Login", displayName: "Logged-Out Trigger Text" },
    loggedInText: { type: "string", defaultValue: "Log Out", displayName: "Logged-In Trigger Text" },
    previewState: { type: "choice", options: ["idle", "loading", "error", "success"], defaultValue: "idle", displayName: "Preview State (Design Banner)" },
    previewSuccessText: { type: "string", defaultValue: "Login Successful - Welcome back!", displayName: "Preview Green Success Text" },
    previewLoggedIn: { type: "boolean", defaultValue: false, displayName: "Preview Logged In State (Studio Only)" },
    showHeader: { type: "boolean", defaultValue: true, displayName: "Show Header Slot" },
    showFooter: { type: "boolean", defaultValue: true, displayName: "Show Footer Slot" },
    showCloseIcon: { type: "boolean", defaultValue: true, displayName: "Show X Close Button" },
    showPasswordEyeToggle: { type: "boolean", defaultValue: true, displayName: "Enable Show/Hide Password Eye" },
    showRememberMe: { type: "boolean", defaultValue: true, displayName: "Enable Remember Me Checkbox" },
    closeOnBackdropClick: { type: "boolean", defaultValue: true, displayName: "Close on Backdrop Click" },
    closeOnEscape: { type: "boolean", defaultValue: true, displayName: "Close on Escape Key" },
    shakeOnError: { type: "boolean", defaultValue: true, displayName: "Shake Card on Error" },
    autoCloseMs: { type: "number", defaultValue: 1200, displayName: "Auto-Close Delay (ms)" },
    supabaseUrl: { type: "string", defaultValue: "https://lvynkeuceiqxafgpgdvs.supabase.co/functions/v1/ecmd-carbon-bridge", displayName: "Auth Endpoint URL" },
    themeGroup: {
      type: "choice",
      options: (ps: any) => getEcmdGroupChoiceOptions(ps),
      defaultValue: "ecmd-group-3",
      displayName: "🎨 Theme Group (Sync with Site Themes)"
    },
    modalCardClassName: { type: "class", displayName: "Modal Card Style (Color Tokens, Bg, Border, Shadow)" },
    triggerSlotClassName: { type: "class", displayName: "Trigger Wrapper Style (Color Tokens)" },
    modalWidth: { type: "string", defaultValue: "420px", displayName: "Modal Width" },
    modalBackground: { type: "color", defaultValue: "#FFFFFF", displayName: "Modal Background" },
    modalBorderColor: { type: "color", defaultValue: "#E2E8F0", displayName: "Modal Border Color" },
    modalRadius: { type: "string", defaultValue: "12px", displayName: "Modal Corner Radius" },
    trigger: {
      type: "slot",
      defaultValue: [
        {
          type: "hbox",
          attrs: { id: "ecmd-auth-trigger-row" },
          styles: { alignItems: "center", justifyContent: "flex-start", columnGap: "0px", paddingTop: "8px", paddingBottom: "8px", paddingLeft: "0px", paddingRight: "0px", backgroundColor: "rgba(0,0,0,0)" },
          children: [
            {
              type: "button",
              value: "Member Login",
              attrs: { id: "ecmd-auth-trigger-btn" },
              styles: { backgroundColor: "rgba(248, 145, 145, 0)", color: "#FFFFFF", paddingTop: "0px", paddingBottom: "0px", paddingLeft: "10px", paddingRight: "10px", borderRadius: "8px", fontSize: "16px", fontWeight: 600 }
            },
            {
              type: "button",
              value: "Sign Up",
              attrs: { id: "ecmd-auth-signup-trigger-btn" },
              styles: { backgroundColor: "rgba(248, 145, 145, 0)", color: "#FFFFFF", paddingTop: "0px", paddingBottom: "0px", paddingLeft: "10px", paddingRight: "10px", borderRadius: "8px", fontSize: "16px", fontWeight: 600 }
            }
          ]
        }
      ]
    },
    closeIcon: {
      type: "slot",
      defaultValue: [{ type: "text", value: "✕", attrs: { id: "ecmd-auth-close-x" }, styles: {} }]
    },
    title: {
      type: "slot",
      defaultValue: [
        {
          type: "vbox",
          attrs: { id: "ecmd-auth-title-stack" },
          styles: { alignItems: "center", justifyContent: "flex-start", rowGap: "0px", width: "stretch", paddingTop: "8px", paddingBottom: "8px", paddingLeft: "0px", paddingRight: "0px" },
          children: [
            { type: "img", src: ECMD_AUTH_LOGO_DATA_URI, styles: { width: "100px", height: "80px" } },
            { type: "text", value: "Login", attrs: { id: "ecmd-auth-title-text" }, styles: {} }
          ]
        }
      ]
    },
    children: {
      type: "slot",
      defaultValue: [
        {
          type: "vbox",
          attrs: { id: "ecmd-auth-inputs-stack" },
          styles: { rowGap: "3px", alignItems: "center", justifyContent: "flex-start", width: "stretch", paddingTop: "8px", paddingBottom: "8px", paddingLeft: "0px", paddingRight: "0px" },
          children: [
            { type: "input", attrs: { id: "ecmd-auth-email-input", type: "email", placeholder: "Email Address" }, styles: { width: "stretch", height: "46.48px", paddingTop: "10px", paddingBottom: "10px", paddingLeft: "12px", paddingRight: "12px", borderRadius: "8px", backgroundColor: "#FFFFFF", fontSize: "16px", color: "#0F172A" } },
            { type: "input", attrs: { id: "ecmd-auth-password-input", type: "password", placeholder: "Password" }, styles: { width: "stretch", height: "46.48px", paddingTop: "10px", paddingBottom: "10px", paddingLeft: "12px", paddingRight: "12px", borderRadius: "8px", backgroundColor: "#FFFFFF", fontSize: "16px", color: "#0F172A" } },
            { type: "input", attrs: { id: "ecmd-auth-confirm-input", type: "password", placeholder: "Confirm Password" }, styles: { width: "stretch", height: "46.48px", paddingTop: "10px", paddingBottom: "10px", paddingLeft: "12px", paddingRight: "12px", borderRadius: "8px", backgroundColor: "#FFFFFF", fontSize: "16px", color: "#0F172A" } },
            {
              type: "hbox",
              attrs: { id: "ecmd-auth-links-row" },
              styles: { justifyContent: "space-between", alignItems: "stretch", width: "stretch", paddingTop: "4px", paddingBottom: "4px", paddingLeft: "8px", paddingRight: "8px" },
              children: [
                { type: "text", value: "Forgot Password?", attrs: { id: "ecmd-auth-forgot-link" }, styles: {} },
                {
                  type: "hbox",
                  attrs: { id: "ecmd-auth-signup-group" },
                  styles: { columnGap: "5px", alignItems: "center" },
                  children: [
                    { type: "text", value: "Need an account?", attrs: { id: "ecmd-auth-signup-prompt" }, styles: {} },
                    { type: "text", value: "Sign Up", attrs: { id: "ecmd-auth-signup-link" }, styles: {} }
                  ]
                }
              ]
            },
            {
              type: "hbox",
              attrs: { id: "ecmd-auth-extras-bar" },
              styles: { justifyContent: "space-between", alignItems: "center", width: "stretch", paddingTop: "4px", paddingBottom: "4px", paddingLeft: "0px", paddingRight: "0px" },
              children: [
                {
                  type: "hbox",
                  attrs: { id: "ecmd-auth-remember-row" },
                  styles: { columnGap: "5px", alignItems: "center", paddingTop: "8px", paddingBottom: "8px", paddingLeft: "0px", paddingRight: "0px" },
                  children: [
                    {
                      type: "hbox",
                      attrs: { id: "ecmd-auth-remember-box" },
                      styles: { width: "16px", height: "16px", borderRadius: "4px", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
                      children: [
                        { type: "text", value: "✓", attrs: { id: "ecmd-auth-remember-check" }, styles: {} }
                      ]
                    },
                    { type: "text", value: "Remember me", attrs: { id: "ecmd-auth-remember-text" }, styles: {} }
                  ]
                },
                {
                  type: "hbox",
                  attrs: { id: "ecmd-auth-eye-toggle-btn" },
                  styles: { columnGap: "5px", alignItems: "center", justifyContent: "center", paddingTop: "8px", paddingBottom: "0px", paddingLeft: "8px", paddingRight: "8px" },
                  children: [
                    { type: "text", value: "👁", attrs: { id: "ecmd-auth-eye-icon" }, styles: {} },
                    { type: "text", value: "Show Password", attrs: { id: "ecmd-auth-eye-text" }, styles: {} }
                  ]
                }
              ]
            },
            { type: "text", value: "Login Successful - Welcome back!", attrs: { id: "ecmd-auth-status-banner" }, styles: { width: "stretch", paddingTop: "10px", paddingRight: "10px", paddingBottom: "10px", paddingLeft: "10px", borderRadius: "8px", fontSize: "16px", fontWeight: 600, color: "#10B981", textAlign: "center" } }
          ]
        }
      ]
    },
    footer: {
      type: "slot",
      defaultValue: [
        {
          type: "hbox",
          attrs: { id: "ecmd-auth-footer-row" },
          styles: { justifyContent: "flex-end", alignItems: "stretch", columnGap: "8px", width: "stretch", paddingTop: "0px", paddingBottom: "0px", paddingLeft: "8px", paddingRight: "8px" },
          children: [
            { type: "button", value: "Cancel", attrs: { id: "ecmd-auth-cancel-btn" }, styles: {} },
            { type: "button", value: "Login", attrs: { id: "ecmd-auth-submit-btn" }, styles: {} }
          ]
        }
      ]
    },
    onOpenChange: { type: "eventHandler", argTypes: [{ name: "open", type: "boolean" }] },
    onLogout: { type: "eventHandler", argTypes: [] },
    onAuthSuccess: { type: "eventHandler", argTypes: [{ name: "user", type: "object" }] },
    onAuthError: { type: "eventHandler", argTypes: [{ name: "error", type: "string" }] },
    onModeChange: { type: "eventHandler", argTypes: [{ name: "mode", type: "string" }] },
    onOk: { type: "eventHandler", argTypes: [] },
    onCancel: { type: "eventHandler", argTypes: [] }
  }
});

const makeBrandAssetProps = () => ({
  coastalLightSrc: { type: "imageUrl", defaultValue: "/ecmd-dolphin-logo.svg", displayName: "Coastal Light Upload (SVG/PNG)" },
  midnightSlateSrc: { type: "imageUrl", displayName: "Midnight Slate Upload (SVG/PNG)" },
  customSrc: { type: "imageUrl", hidden: () => true },
  emeraldDarkSrc: { type: "imageUrl", hidden: () => true },
  width: { type: "string", displayName: "Lock Exact Width (Optional, or use Design -> Size)" },
  height: { type: "string", displayName: "Lock Exact Height (Optional, or use Design -> Size)" },
  objectFit: { type: "choice", options: ["contain", "cover", "fill", "scale-down"], defaultValue: "contain", displayName: "Fit Mode" },
  alt: { type: "string", defaultValue: "Emerald Coast Mobile Detailing", displayName: "Alt Text" }
});

registerEcmdComponent(EcmdThemeImage, {
  name: "EcmdBrandIcon",
  displayName: "Icon",
  importPath: "./src/components/EcmdThemeImage",
  defaultStyles: { width: "97px", height: "71px" },
  props: makeBrandAssetProps()
});

registerEcmdComponent(EcmdThemeImage, {
  name: "EcmdBrandWordMark",
  displayName: "WordMark",
  importPath: "./src/components/EcmdThemeImage",
  defaultStyles: { width: "220px", height: "60px" },
  props: makeBrandAssetProps()
});

registerEcmdComponent(EcmdThemeLogo, {
  name: "EcmdThemeLogo",
  displayName: "Theme Logo (SVG Switcher)",
  importPath: "./src/components/EcmdThemeLogo",
  props: {
    mode: {
      type: "choice",
      options: [
        { value: "recolor-single-svg", label: "Recolor 1 Single SVG Per Theme (Fastest)" },
        { value: "swap-slots", label: "Swap Different SVG/Image Files Per Theme" }
      ],
      defaultValue: "recolor-single-svg",
      displayName: "Logo Switch Mode"
    },
    customColor: { type: "color", defaultValue: "#FFFFFF", displayName: "1. Default Custom SVG Color", hidden: (p: any) => p.mode === "swap-slots" },
    emeraldDarkColor: { type: "color", defaultValue: "#FFFFFF", displayName: "2. Emerald Dark SVG Color", hidden: (p: any) => p.mode === "swap-slots" },
    coastalLightColor: { type: "color", defaultValue: "#0F172A", displayName: "3. Coastal Light SVG Color", hidden: (p: any) => p.mode === "swap-slots" },
    midnightSlateColor: { type: "color", defaultValue: "#F8FAFC", displayName: "4. Midnight Slate SVG Color", hidden: (p: any) => p.mode === "swap-slots" },
    children: { type: "slot", displayName: "Default SVG / Logo Element" },
    emeraldDarkSlot: { type: "slot", displayName: "Emerald Dark Logo Override", hidden: (p: any) => p.mode !== "swap-slots" },
    coastalLightSlot: { type: "slot", displayName: "Coastal Light Logo Override", hidden: (p: any) => p.mode !== "swap-slots" },
    midnightSlateSlot: { type: "slot", displayName: "Midnight Slate Logo Override", hidden: (p: any) => p.mode !== "swap-slots" }
  }
});

registerEcmdComponent(EcmdThemeGroupController, {
  name: "EcmdThemeGroupController",
  displayName: "Site Themes",
  importPath: "./src/components/EcmdThemeGroupController",
  props: {
    cardThemeGroup: {
      type: "custom",
      displayName: "🎨 Dropdown Card Theme Group",
      defaultValue: "ecmd-group-3",
      control: EcmdGroupSelectControl as any
    },
    triggerThemeGroup: {
      type: "custom",
      displayName: "🎨 Trigger Button Theme Group",
      defaultValue: "ecmd-group-4",
      control: EcmdGroupSelectControl as any
    },
    presetTheme: {
      type: "choice",
      options: [
        { value: "coastal-light", label: "☀️ Light theme" },
        { value: "midnight-slate", label: "🌙 Dark theme" }
      ],
      defaultValue: "coastal-light",
      displayName: "🎨 Active Theme (Switch Live Canvas & Edit Palette)"
    },
    toggleFlags: { type: "custom", control: EcmdTogglesModalControl as any, defaultValue: "", displayName: "⚙️ Behavior Toggles" },
    dynamicGroupsJson: { type: "custom", control: EcmdDynamicGroupManagerControl as any, defaultValue: "", displayName: "📂 Theme Groups" },
    openAttributeProfilesModal: { type: "boolean", defaultValue: false, displayName: "Open Attribute Profiles Popup" },
    activeEditorGroup: { hidden: () => true,
      type: "choice",
      options: (p: any) => {
        const opts = [
          { value: "Group 1", label: "Group 1 — " + (p.group1Name || "Bars & Surfaces") },
          { value: "Group 2", label: "Group 2 — " + (p.group2Name || "Header Buttons") },
          { value: "Group 3", label: "Group 3 — " + (p.group3Name || "Modals") },
          { value: "Group 4", label: "Group 4 — " + (p.group4Name || "Text buttons") }
        ];
        if (p.enableGroup5 !== false) opts.push({ value: "Group 5", label: "Group 5 — " + (p.group5Name || "text buttons (on dark)") });
        if (p.enableGroup6) opts.push({ value: "Group 6", label: "Group 6 — " + (p.group6Name || "Side Menu") });
        if (p.enableGroup7) opts.push({ value: "Group 7", label: "Group 7 — " + (p.group7Name || "Group 7") });
        if (p.enableGroup8) opts.push({ value: "Group 8", label: "Group 8 — " + (p.group8Name || "Group 8") });
        if (!p.enableGroup8) opts.push({ value: "Add Group", label: "➕ Add Group" });
        opts.push({ value: "Expand All", label: "Expand All Groups" }, { value: "Collapse All", label: "Collapse All" });
        return opts;
      },
      defaultValue: "Group 5",
      displayName: "📂 Click Group to Edit Colors (Live Group Names)"
    },
    enableGroup5: { type: "boolean", defaultValue: true, displayName: "↳ Enabled", hidden: () => true},
    group5Name: { type: "string", defaultValue: "text buttons (on dark)", displayName: "↳ Name", hidden: () => true},
    group5Selector: { type: "string", defaultValue: ".text-buttons-dark", displayName: "↳ CSS Selector", hidden: () => true},
    group5Radius: { type: "custom", control: EcmdRadiusBoxControl as any, defaultValue: "", displayName: "↳ Corner Radius", hidden: () => true},
    group5Spacing: { type: "boolean", defaultValue: false, displayName: "↳ 📐 Spacing", hidden: () => true},
    group5Padding: { type: "custom", control: EcmdPaddingBoxControl as any, defaultValue: "", displayName: "↳ Padding", hidden: () => true},
    group5Margin: { type: "custom", control: EcmdMarginBoxControl as any, defaultValue: "", displayName: "↳ Margin", hidden: () => true},
    group5Gap: { type: "custom", control: EcmdGapControl as any, defaultValue: "", displayName: "↳ Gap", hidden: () => true},
    cl_g5Bg: { type: "color", defaultValue: "transparent", displayName: "↳ Background", hidden: () => true},
    cl_g5Text: { type: "color", defaultValue: "#F8FAFC", displayName: "↳ Text", hidden: () => true},
    cl_g5Border: { type: "color", defaultValue: "transparent", displayName: "↳ Border", hidden: () => true},
    cl_g5Icon: { type: "color", defaultValue: "", displayName: "↳ Icon Color", hidden: () => true},
    cl_g5SelBg: { type: "color", defaultValue: "", displayName: "↳ Selected Background", hidden: () => true},
    cl_g5SelText: { type: "color", defaultValue: "", displayName: "↳ Selected Text", hidden: () => true},
    ms_g5Bg: { type: "color", defaultValue: "transparent", displayName: "↳ Background", hidden: () => true},
    ms_g5Text: { type: "color", defaultValue: "#F8FAFC", displayName: "↳ Text", hidden: () => true},
    ms_g5Border: { type: "color", defaultValue: "transparent", displayName: "↳ Border", hidden: () => true},
    ms_g5Icon: { type: "color", defaultValue: "", displayName: "↳ Icon Color", hidden: () => true},
    ms_g5SelBg: { type: "color", defaultValue: "", displayName: "↳ Selected Background", hidden: () => true},
    ms_g5SelText: { type: "color", defaultValue: "", displayName: "↳ Selected Text", hidden: () => true},
    enableGroup6: { type: "boolean", defaultValue: false, displayName: "↳ Enabled", hidden: () => true},
    group6Name: { type: "string", defaultValue: "Side Menu", displayName: "↳ Name", hidden: () => true},
    group6Selector: { type: "string", defaultValue: ".side-menu", displayName: "↳ CSS Selector", hidden: () => true},
    group6Radius: { type: "custom", control: EcmdRadiusBoxControl as any, defaultValue: "", displayName: "↳ Corner Radius", hidden: () => true},
    group6Spacing: { type: "boolean", defaultValue: false, displayName: "↳ 📐 Spacing", hidden: () => true},
    group6Padding: { type: "custom", control: EcmdPaddingBoxControl as any, defaultValue: "", displayName: "↳ Padding", hidden: () => true},
    group6Margin: { type: "custom", control: EcmdMarginBoxControl as any, defaultValue: "", displayName: "↳ Margin", hidden: () => true},
    group6Gap: { type: "custom", control: EcmdGapControl as any, defaultValue: "", displayName: "↳ Gap", hidden: () => true},
    cl_g6Bg: { type: "color", defaultValue: "#FFFFFF", displayName: "↳ Background", hidden: () => true},
    cl_g6Text: { type: "color", defaultValue: "#0F172A", displayName: "↳ Text", hidden: () => true},
    cl_g6Border: { type: "color", defaultValue: "#BAE6FD", displayName: "↳ Border", hidden: () => true},
    cl_g6Icon: { type: "color", defaultValue: "", displayName: "↳ Icon Color", hidden: () => true},
    cl_g6SelBg: { type: "color", defaultValue: "", displayName: "↳ Selected Background", hidden: () => true},
    cl_g6SelText: { type: "color", defaultValue: "", displayName: "↳ Selected Text", hidden: () => true},
    ms_g6Bg: { type: "color", defaultValue: "#0F172A", displayName: "↳ Background", hidden: () => true},
    ms_g6Text: { type: "color", defaultValue: "#F8FAFC", displayName: "↳ Text", hidden: () => true},
    ms_g6Border: { type: "color", defaultValue: "#334155", displayName: "↳ Border", hidden: () => true},
    ms_g6Icon: { type: "color", defaultValue: "", displayName: "↳ Icon Color", hidden: () => true},
    ms_g6SelBg: { type: "color", defaultValue: "", displayName: "↳ Selected Background", hidden: () => true},
    ms_g6SelText: { type: "color", defaultValue: "", displayName: "↳ Selected Text", hidden: () => true},
    enableGroup7: { type: "boolean", defaultValue: false, displayName: "↳ Enabled", hidden: () => true},
    group7Name: { type: "string", defaultValue: "Group 7", displayName: "↳ Name", hidden: () => true},
    group7Selector: { type: "string", defaultValue: ".ecmd-group-7", displayName: "↳ CSS Selector", hidden: () => true},
    group7Radius: { type: "custom", control: EcmdRadiusBoxControl as any, defaultValue: "", displayName: "↳ Corner Radius", hidden: () => true},
    group7Spacing: { type: "boolean", defaultValue: false, displayName: "↳ 📐 Spacing", hidden: () => true},
    group7Padding: { type: "custom", control: EcmdPaddingBoxControl as any, defaultValue: "", displayName: "↳ Padding", hidden: () => true},
    group7Margin: { type: "custom", control: EcmdMarginBoxControl as any, defaultValue: "", displayName: "↳ Margin", hidden: () => true},
    group7Gap: { type: "custom", control: EcmdGapControl as any, defaultValue: "", displayName: "↳ Gap", hidden: () => true},
    cl_g7Bg: { type: "color", defaultValue: "#FFFFFF", displayName: "↳ Background", hidden: () => true},
    cl_g7Text: { type: "color", defaultValue: "#0F172A", displayName: "↳ Text", hidden: () => true},
    cl_g7Border: { type: "color", defaultValue: "#BAE6FD", displayName: "↳ Border", hidden: () => true},
    cl_g7Icon: { type: "color", defaultValue: "", displayName: "↳ Icon Color", hidden: () => true},
    cl_g7SelBg: { type: "color", defaultValue: "", displayName: "↳ Selected Background", hidden: () => true},
    cl_g7SelText: { type: "color", defaultValue: "", displayName: "↳ Selected Text", hidden: () => true},
    ms_g7Bg: { type: "color", defaultValue: "#1E293B", displayName: "↳ Background", hidden: () => true},
    ms_g7Text: { type: "color", defaultValue: "#F8FAFC", displayName: "↳ Text", hidden: () => true},
    ms_g7Border: { type: "color", defaultValue: "#475569", displayName: "↳ Border", hidden: () => true},
    ms_g7Icon: { type: "color", defaultValue: "", displayName: "↳ Icon Color", hidden: () => true},
    ms_g7SelBg: { type: "color", defaultValue: "", displayName: "↳ Selected Background", hidden: () => true},
    ms_g7SelText: { type: "color", defaultValue: "", displayName: "↳ Selected Text", hidden: () => true},
    enableGroup8: { type: "boolean", defaultValue: false, displayName: "↳ Enabled", hidden: () => true},
    group8Name: { type: "string", defaultValue: "Group 8", displayName: "↳ Name", hidden: () => true},
    group8Selector: { type: "string", defaultValue: ".ecmd-group-8", displayName: "↳ CSS Selector", hidden: () => true},
    group8Radius: { type: "custom", control: EcmdRadiusBoxControl as any, defaultValue: "", displayName: "↳ Corner Radius", hidden: () => true},
    group8Spacing: { type: "boolean", defaultValue: false, displayName: "↳ 📐 Spacing", hidden: () => true},
    group8Padding: { type: "custom", control: EcmdPaddingBoxControl as any, defaultValue: "", displayName: "↳ Padding", hidden: () => true},
    group8Margin: { type: "custom", control: EcmdMarginBoxControl as any, defaultValue: "", displayName: "↳ Margin", hidden: () => true},
    group8Gap: { type: "custom", control: EcmdGapControl as any, defaultValue: "", displayName: "↳ Gap", hidden: () => true},
    cl_g8Bg: { type: "color", defaultValue: "#FFFFFF", displayName: "↳ Background", hidden: () => true},
    cl_g8Text: { type: "color", defaultValue: "#0F172A", displayName: "↳ Text", hidden: () => true},
    cl_g8Border: { type: "color", defaultValue: "#BAE6FD", displayName: "↳ Border", hidden: () => true},
    cl_g8Icon: { type: "color", defaultValue: "", displayName: "↳ Icon Color", hidden: () => true},
    cl_g8SelBg: { type: "color", defaultValue: "", displayName: "↳ Selected Background", hidden: () => true},
    cl_g8SelText: { type: "color", defaultValue: "", displayName: "↳ Selected Text", hidden: () => true},
    ms_g8Bg: { type: "color", defaultValue: "#1E293B", displayName: "↳ Background", hidden: () => true},
    ms_g8Text: { type: "color", defaultValue: "#F8FAFC", displayName: "↳ Text", hidden: () => true},
    ms_g8Border: { type: "color", defaultValue: "#475569", displayName: "↳ Border", hidden: () => true},
    ms_g8Icon: { type: "color", defaultValue: "", displayName: "↳ Icon Color", hidden: () => true},
    ms_g8SelBg: { type: "color", defaultValue: "", displayName: "↳ Selected Background", hidden: () => true},
    ms_g8SelText: { type: "color", defaultValue: "", displayName: "↳ Selected Text", hidden: () => true},
    showSwatchPreview: { type: "boolean", defaultValue: false, displayName: "Show Group Color Swatch Cheat-Sheet on Canvas?", hidden: () => true },
    enableGroup1: { type: "boolean", defaultValue: true, displayName: "↳ Enabled", hidden: () => true},
    group1Name: { type: "string", defaultValue: "Bars & Surfaces", displayName: "↳ Name", hidden: () => true},
    group1Selector: { type: "string", defaultValue: ".ecmd-group-1", displayName: "↳ CSS Selector", hidden: () => true},
    group1Radius: { type: "custom", control: EcmdRadiusBoxControl as any, defaultValue: "", displayName: "↳ Corner Radius", hidden: () => true},
    group1Spacing: { type: "boolean", defaultValue: false, displayName: "↳ 📐 Spacing", hidden: () => true},
    group1Padding: { type: "custom", control: EcmdPaddingBoxControl as any, defaultValue: "", displayName: "↳ Padding", hidden: () => true},
    group1Margin: { type: "custom", control: EcmdMarginBoxControl as any, defaultValue: "", displayName: "↳ Margin", hidden: () => true},
    group1Gap: { type: "custom", control: EcmdGapControl as any, defaultValue: "", displayName: "↳ Gap", hidden: () => true},
    group1Bg: { type: "color", defaultValue: "#0F172A", displayName: "↳ [Default Custom] G1 Background", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 1" && p.activeEditorGroup !== "Expand All") },
    group1Text: { type: "color", defaultValue: "#F8FAFC", displayName: "↳ [Default Custom] G1 Text", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 1" && p.activeEditorGroup !== "Expand All") },
    group1Border: { type: "color", defaultValue: "#1E293B", displayName: "↳ [Default Custom] G1 Border", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 1" && p.activeEditorGroup !== "Expand All") },
    ed_g1Bg: { type: "color", defaultValue: "#020617", displayName: "↳ [Emerald Dark] G1 Background", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 1" && p.activeEditorGroup !== "Expand All") },
    ed_g1Text: { type: "color", defaultValue: "#F8FAFC", displayName: "↳ [Emerald Dark] G1 Text", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 1" && p.activeEditorGroup !== "Expand All") },
    ed_g1Border: { type: "color", defaultValue: "#1E293B", displayName: "↳ [Emerald Dark] G1 Border", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 1" && p.activeEditorGroup !== "Expand All") },
    cl_g1Bg: { type: "color", defaultValue: "#F8FAFC", displayName: "↳ Background", hidden: () => true},
    cl_g1Text: { type: "color", defaultValue: "#0F172A", displayName: "↳ Text", hidden: () => true},
    cl_g1Border: { type: "color", defaultValue: "#E2E8F0", displayName: "↳ Border", hidden: () => true},
    cl_g1Icon: { type: "color", defaultValue: "", displayName: "↳ Icon Color", hidden: () => true},
    cl_g1SelBg: { type: "color", defaultValue: "", displayName: "↳ Selected Background", hidden: () => true},
    cl_g1SelText: { type: "color", defaultValue: "", displayName: "↳ Selected Text", hidden: () => true},
    ms_g1Bg: { type: "color", defaultValue: "#1E293B", displayName: "↳ Background", hidden: () => true},
    ms_g1Text: { type: "color", defaultValue: "#F8FAFC", displayName: "↳ Text", hidden: () => true},
    ms_g1Border: { type: "color", defaultValue: "#334155", displayName: "↳ Border", hidden: () => true},
    ms_g1Icon: { type: "color", defaultValue: "", displayName: "↳ Icon Color", hidden: () => true},
    ms_g1SelBg: { type: "color", defaultValue: "", displayName: "↳ Selected Background", hidden: () => true},
    ms_g1SelText: { type: "color", defaultValue: "", displayName: "↳ Selected Text", hidden: () => true},

    enableGroup2: { type: "boolean", defaultValue: true, displayName: "↳ Enabled", hidden: () => true},
    group2Name: { type: "string", defaultValue: "Primary Buttons", displayName: "↳ Name", hidden: () => true},
    group2Selector: { type: "string", defaultValue: ".ecmd-group-2", displayName: "↳ CSS Selector", hidden: () => true},
    group2Radius: { type: "custom", control: EcmdRadiusBoxControl as any, defaultValue: "", displayName: "↳ Corner Radius", hidden: () => true},
    group2Spacing: { type: "boolean", defaultValue: false, displayName: "↳ 📐 Spacing", hidden: () => true},
    group2Padding: { type: "custom", control: EcmdPaddingBoxControl as any, defaultValue: "", displayName: "↳ Padding", hidden: () => true},
    group2Margin: { type: "custom", control: EcmdMarginBoxControl as any, defaultValue: "", displayName: "↳ Margin", hidden: () => true},
    group2Gap: { type: "custom", control: EcmdGapControl as any, defaultValue: "", displayName: "↳ Gap", hidden: () => true},
    group2Bg: { type: "color", defaultValue: "#128FB1", displayName: "↳ [Default Custom] G2 Background", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 2" && p.activeEditorGroup !== "Expand All") },
    group2Text: { type: "color", defaultValue: "#FFFFFF", displayName: "↳ [Default Custom] G2 Text", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 2" && p.activeEditorGroup !== "Expand All") },
    group2Border: { type: "color", defaultValue: "#0E7490", displayName: "↳ [Default Custom] G2 Border", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 2" && p.activeEditorGroup !== "Expand All") },
    ed_g2Bg: { type: "color", defaultValue: "#10B981", displayName: "↳ [Emerald Dark] G2 Background", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 2" && p.activeEditorGroup !== "Expand All") },
    ed_g2Text: { type: "color", defaultValue: "#FFFFFF", displayName: "↳ [Emerald Dark] G2 Text", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 2" && p.activeEditorGroup !== "Expand All") },
    ed_g2Border: { type: "color", defaultValue: "#059669", displayName: "↳ [Emerald Dark] G2 Border", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 2" && p.activeEditorGroup !== "Expand All") },
    cl_g2Bg: { type: "color", defaultValue: "#0EA5E9", displayName: "↳ Background", hidden: () => true},
    cl_g2Text: { type: "color", defaultValue: "#FFFFFF", displayName: "↳ Text", hidden: () => true},
    cl_g2Border: { type: "color", defaultValue: "#0284C7", displayName: "↳ Border", hidden: () => true},
    cl_g2Icon: { type: "color", defaultValue: "", displayName: "↳ Icon Color", hidden: () => true},
    cl_g2SelBg: { type: "color", defaultValue: "", displayName: "↳ Selected Background", hidden: () => true},
    cl_g2SelText: { type: "color", defaultValue: "", displayName: "↳ Selected Text", hidden: () => true},
    ms_g2Bg: { type: "color", defaultValue: "#14B8A6", displayName: "↳ Background", hidden: () => true},
    ms_g2Text: { type: "color", defaultValue: "#FFFFFF", displayName: "↳ Text", hidden: () => true},
    ms_g2Border: { type: "color", defaultValue: "#0D9488", displayName: "↳ Border", hidden: () => true},
    ms_g2Icon: { type: "color", defaultValue: "", displayName: "↳ Icon Color", hidden: () => true},
    ms_g2SelBg: { type: "color", defaultValue: "", displayName: "↳ Selected Background", hidden: () => true},
    ms_g2SelText: { type: "color", defaultValue: "", displayName: "↳ Selected Text", hidden: () => true},

    enableGroup3: { type: "boolean", defaultValue: true, displayName: "↳ Enabled", hidden: () => true},
    group3Name: { type: "string", defaultValue: "Modals", displayName: "↳ Name", hidden: () => true},
    group3Selector: { type: "string", defaultValue: ".modals", displayName: "↳ CSS Selector", hidden: () => true},
    group3Radius: { type: "custom", control: EcmdRadiusBoxControl as any, defaultValue: "", displayName: "↳ Corner Radius", hidden: () => true},
    group3Spacing: { type: "boolean", defaultValue: false, displayName: "↳ 📐 Spacing", hidden: () => true},
    group3Padding: { type: "custom", control: EcmdPaddingBoxControl as any, defaultValue: "", displayName: "↳ Padding", hidden: () => true},
    group3Margin: { type: "custom", control: EcmdMarginBoxControl as any, defaultValue: "", displayName: "↳ Margin", hidden: () => true},
    group3Gap: { type: "custom", control: EcmdGapControl as any, defaultValue: "", displayName: "↳ Gap", hidden: () => true},
    group3Bg: { type: "color", defaultValue: "#FFFFFF", displayName: "↳ [Default Custom] G3 Background", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 3" && p.activeEditorGroup !== "Expand All") },
    group3Text: { type: "color", defaultValue: "#0F172A", displayName: "↳ [Default Custom] G3 Text", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 3" && p.activeEditorGroup !== "Expand All") },
    group3Border: { type: "color", defaultValue: "#E2E8F0", displayName: "↳ [Default Custom] G3 Border", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 3" && p.activeEditorGroup !== "Expand All") },
    ed_g3Bg: { type: "color", defaultValue: "#0F172A", displayName: "↳ [Emerald Dark] G3 Background", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 3" && p.activeEditorGroup !== "Expand All") },
    ed_g3Text: { type: "color", defaultValue: "#F8FAFC", displayName: "↳ [Emerald Dark] G3 Text", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 3" && p.activeEditorGroup !== "Expand All") },
    ed_g3Border: { type: "color", defaultValue: "#10B981", displayName: "↳ [Emerald Dark] G3 Border", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 3" && p.activeEditorGroup !== "Expand All") },
    cl_g3Bg: { type: "color", defaultValue: "#FFFFFF", displayName: "↳ Background", hidden: () => true},
    cl_g3Text: { type: "color", defaultValue: "#0F172A", displayName: "↳ Text", hidden: () => true},
    cl_g3Border: { type: "color", defaultValue: "#BAE6FD", displayName: "↳ Border", hidden: () => true},
    cl_g3Icon: { type: "color", defaultValue: "", displayName: "↳ Icon Color", hidden: () => true},
    cl_g3SelBg: { type: "color", defaultValue: "", displayName: "↳ Selected Background", hidden: () => true},
    cl_g3SelText: { type: "color", defaultValue: "", displayName: "↳ Selected Text", hidden: () => true},
    ms_g3Bg: { type: "color", defaultValue: "#1E293B", displayName: "↳ Background", hidden: () => true},
    ms_g3Text: { type: "color", defaultValue: "#F8FAFC", displayName: "↳ Text", hidden: () => true},
    ms_g3Border: { type: "color", defaultValue: "#475569", displayName: "↳ Border", hidden: () => true},
    ms_g3Icon: { type: "color", defaultValue: "", displayName: "↳ Icon Color", hidden: () => true},
    ms_g3SelBg: { type: "color", defaultValue: "", displayName: "↳ Selected Background", hidden: () => true},
    ms_g3SelText: { type: "color", defaultValue: "", displayName: "↳ Selected Text", hidden: () => true},
    highlightActiveRow: { type: "boolean", defaultValue: true, displayName: "↳ Auto-Highlight Active Row in Modals?", hidden: (p: any) => p.activeEditorGroup !== "Group 3" && p.activeEditorGroup !== "Expand All" },
    activeRowSelector: { type: "string", defaultValue: ".modals-active-row, .ecmd-active-row", displayName: "↳ Active Row Highlight CSS Classes", hidden: (p: any) => p.activeEditorGroup !== "Group 3" && p.activeEditorGroup !== "Expand All" },
    activeRowBg: { type: "color", defaultValue: "rgba(16, 185, 129, 0.16)", displayName: "↳ [Default Custom] Active Row Bg", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 3" && p.activeEditorGroup !== "Expand All") },
    activeRowText: { type: "color", defaultValue: "#10B981", displayName: "↳ [Default Custom] Active Row Text", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 3" && p.activeEditorGroup !== "Expand All") },
    ed_activeRowBg: { type: "color", defaultValue: "rgba(16, 185, 129, 0.22)", displayName: "↳ [Emerald Dark] Active Row Bg", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 3" && p.activeEditorGroup !== "Expand All") },
    ed_activeRowText: { type: "color", defaultValue: "#34D399", displayName: "↳ [Emerald Dark] Active Row Text", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 3" && p.activeEditorGroup !== "Expand All") },
    cl_activeRowBg: { type: "color", defaultValue: "rgba(14, 165, 233, 0.16)", displayName: "↳ [Coastal Light] Active Row Bg", hidden: (p: any) => p.presetTheme !== "coastal-light" || (p.activeEditorGroup !== "Group 3" && p.activeEditorGroup !== "Expand All") },
    cl_activeRowText: { type: "color", defaultValue: "#0284C7", displayName: "↳ [Coastal Light] Active Row Text", hidden: (p: any) => p.presetTheme !== "coastal-light" || (p.activeEditorGroup !== "Group 3" && p.activeEditorGroup !== "Expand All") },
    ms_activeRowBg: { type: "color", defaultValue: "rgba(20, 184, 166, 0.22)", displayName: "↳ [Midnight Slate] Active Row Bg", hidden: (p: any) => p.presetTheme !== "midnight-slate" || (p.activeEditorGroup !== "Group 3" && p.activeEditorGroup !== "Expand All") },
    ms_activeRowText: { type: "color", defaultValue: "#2DD4BF", displayName: "↳ [Midnight Slate] Active Row Text", hidden: (p: any) => p.presetTheme !== "midnight-slate" || (p.activeEditorGroup !== "Group 3" && p.activeEditorGroup !== "Expand All") },

    enableGroup4: { type: "boolean", defaultValue: true, displayName: "↳ Enabled", hidden: () => true},
    group4Name: { type: "string", defaultValue: "Custom Accents", displayName: "↳ Name", hidden: () => true},
    group4Selector: { type: "string", defaultValue: ".ecmd-group-4", displayName: "↳ CSS Selector", hidden: () => true},
    group4Radius: { type: "custom", control: EcmdRadiusBoxControl as any, defaultValue: "", displayName: "↳ Corner Radius", hidden: () => true},
    group4Spacing: { type: "boolean", defaultValue: false, displayName: "↳ 📐 Spacing", hidden: () => true},
    group4Padding: { type: "custom", control: EcmdPaddingBoxControl as any, defaultValue: "", displayName: "↳ Padding", hidden: () => true},
    group4Margin: { type: "custom", control: EcmdMarginBoxControl as any, defaultValue: "", displayName: "↳ Margin", hidden: () => true},
    group4Gap: { type: "custom", control: EcmdGapControl as any, defaultValue: "", displayName: "↳ Gap", hidden: () => true},
    group4Bg: { type: "color", defaultValue: "#1E293B", displayName: "↳ [Default Custom] G4 Background", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 4" && p.activeEditorGroup !== "Expand All") },
    group4Text: { type: "color", defaultValue: "#38BDF8", displayName: "↳ [Default Custom] G4 Text", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 4" && p.activeEditorGroup !== "Expand All") },
    group4Border: { type: "color", defaultValue: "#334155", displayName: "↳ [Default Custom] G4 Border", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 4" && p.activeEditorGroup !== "Expand All") },
    ed_g4Bg: { type: "color", defaultValue: "#064E3B", displayName: "↳ [Emerald Dark] G4 Background", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 4" && p.activeEditorGroup !== "Expand All") },
    ed_g4Text: { type: "color", defaultValue: "#6EE7B7", displayName: "↳ [Emerald Dark] G4 Text", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 4" && p.activeEditorGroup !== "Expand All") },
    ed_g4Border: { type: "color", defaultValue: "#059669", displayName: "↳ [Emerald Dark] G4 Border", hidden: (p: any) => true || (p.activeEditorGroup !== "Group 4" && p.activeEditorGroup !== "Expand All") },
    cl_g4Bg: { type: "color", defaultValue: "#E0F2FE", displayName: "↳ Background", hidden: () => true},
    cl_g4Text: { type: "color", defaultValue: "#0369A1", displayName: "↳ Text", hidden: () => true},
    cl_g4Border: { type: "color", defaultValue: "#7DD3FC", displayName: "↳ Border", hidden: () => true},
    cl_g4Icon: { type: "color", defaultValue: "", displayName: "↳ Icon Color", hidden: () => true},
    cl_g4SelBg: { type: "color", defaultValue: "", displayName: "↳ Selected Background", hidden: () => true},
    cl_g4SelText: { type: "color", defaultValue: "", displayName: "↳ Selected Text", hidden: () => true},
    ms_g4Bg: { type: "color", defaultValue: "#312E81", displayName: "↳ Background", hidden: () => true},
    ms_g4Text: { type: "color", defaultValue: "#C7D2FE", displayName: "↳ Text", hidden: () => true},
    ms_g4Border: { type: "color", defaultValue: "#475569", displayName: "↳ Border", hidden: () => true},
    ms_g4Icon: { type: "color", defaultValue: "", displayName: "↳ Icon Color", hidden: () => true},
    ms_g4SelBg: { type: "color", defaultValue: "", displayName: "↳ Selected Background", hidden: () => true},
    ms_g4SelText: { type: "color", defaultValue: "", displayName: "↳ Selected Text", hidden: () => true},
    buttonLabel: { type: "string", defaultValue: "Site Themes", displayName: "Button Label" },
    showActiveThemeInLabel: { type: "boolean", defaultValue: false, displayName: "Show Active Theme Name on Button?", hidden: () => true },
    syncTriggerDotWithTheme: { type: "boolean", defaultValue: false, displayName: "Sync Button Dot Color With Active Theme?", hidden: () => true },
    enableLiveDropdown: { type: "boolean", defaultValue: true, displayName: "Open Live Theme Dropdown Modal on Click?", hidden: () => true },
    open: { type: "boolean", defaultValue: true, displayName: "Preview Theme Dropdown Open?", hidden: () => true },
    cardWidth: { type: "string", defaultValue: "205px", displayName: "Dropdown Card Width (e.g. 220px)" },
    offsetY: { type: "number", defaultValue: 8, displayName: "Gap Below Trigger Button (px)" },
    align: { type: "choice", options: ["left", "center", "right"], defaultValue: "left", displayName: "Dropdown Alignment" },
    fixedBreakout: { type: "boolean", defaultValue: false, displayName: "Break Out of Clipped Parent (Fixed Position)?", hidden: () => true },
    maskClosable: { type: "boolean", defaultValue: true, displayName: "Click Outside to Close Dropdown?", hidden: () => true },
    closeOnSelect: { type: "boolean", defaultValue: true, displayName: "Close Dropdown After Selecting a Theme?", hidden: () => true },
    persistUserChoice: { type: "boolean", defaultValue: true, displayName: "Remember User Theme in Browser (Live Site)?", hidden: () => true },
    smoothTransition: { type: "boolean", defaultValue: true, displayName: "Smooth Color Fade Transition?", hidden: () => true },
    showHelperBadgeInStudio: { type: "boolean", defaultValue: false, displayName: "Show Site Themes Button?", hidden: () => true },
    triggerClassName: { type: "class", displayName: "Theme Button Wrapper Style" },
    dropdownCardClassName: { type: "class", displayName: "Theme Dropdown Card Style" },
    onThemeChange: { type: "eventHandler", argTypes: [{ name: "theme", type: "string" }] },
    onOpenChange: { type: "eventHandler", argTypes: [{ name: "open", type: "boolean" }] },
    trigger: {
      type: "slot",
      defaultValue: [
        {
          type: "hbox",
          attrs: { id: "ecmd-theme-trigger-btn" },
          styles: { width: "auto", alignItems: "center", columnGap: "8px", paddingTop: "6px", paddingBottom: "6px", paddingLeft: "14px", paddingRight: "14px", borderRadius: "999px", backgroundColor: "#0F172A" },
          children: [
            { type: "box", attrs: { id: "ecmd-theme-trigger-dot" }, styles: { width: "8px", height: "8px", minWidth: "8px", minHeight: "8px", borderRadius: "50%", backgroundColor: "#10B981" } },
            { type: "text", value: "Site Themes", attrs: { id: "ecmd-theme-trigger-label" }, styles: { color: "#F8FAFC", fontSize: "12px", fontWeight: "600" } },
            { type: "text", value: "▼", attrs: { id: "ecmd-theme-trigger-arrow" }, styles: { color: "#94A3B8", fontSize: "10px" } }
          ]
        }
      ]
    },
    children: {
      type: "slot",
      defaultValue: [
        {
          type: "vbox",
          attrs: { id: "ecmd-theme-dropdown-list" },
          styles: { width: "100%", rowGap: "3px" },
          children: [
            {
              type: "hbox",
              attrs: { id: "ecmd-theme-opt-custom" },
              styles: { width: "100%", alignItems: "center", justifyContent: "space-between", paddingTop: "7px", paddingBottom: "7px", paddingLeft: "10px", paddingRight: "10px", borderRadius: "7px" },
              children: [
                {
                  type: "hbox",
                  styles: { width: "auto", alignItems: "center", columnGap: "8px" },
                  children: [
                    { type: "box", styles: { width: "10px", height: "10px", minWidth: "10px", minHeight: "10px", borderRadius: "50%", backgroundColor: "#10B981" } },
                    { type: "text", value: "Default Custom", styles: { color: "#F8FAFC", fontSize: "12px", fontWeight: "600" } }
                  ]
                },
                { type: "text", value: "✓", attrs: { id: "ecmd-theme-check-custom" }, styles: { color: "#10B981", fontSize: "12px", fontWeight: "700" } }
              ]
            },
            {
              type: "hbox",
              attrs: { id: "ecmd-theme-opt-emerald-dark" },
              styles: { width: "100%", alignItems: "center", justifyContent: "space-between", paddingTop: "7px", paddingBottom: "7px", paddingLeft: "10px", paddingRight: "10px", borderRadius: "7px" },
              children: [
                {
                  type: "hbox",
                  styles: { width: "auto", alignItems: "center", columnGap: "8px" },
                  children: [
                    { type: "box", styles: { width: "10px", height: "10px", minWidth: "10px", minHeight: "10px", borderRadius: "50%", backgroundColor: "#059669" } },
                    { type: "text", value: "Emerald Dark", styles: { color: "#F8FAFC", fontSize: "12px", fontWeight: "500" } }
                  ]
                },
                { type: "text", value: "✓", attrs: { id: "ecmd-theme-check-emerald-dark" }, styles: { color: "#10B981", fontSize: "12px", fontWeight: "700" } }
              ]
            },
            {
              type: "hbox",
              attrs: { id: "ecmd-theme-opt-coastal-light" },
              styles: { width: "100%", alignItems: "center", justifyContent: "space-between", paddingTop: "7px", paddingBottom: "7px", paddingLeft: "10px", paddingRight: "10px", borderRadius: "7px" },
              children: [
                {
                  type: "hbox",
                  styles: { width: "auto", alignItems: "center", columnGap: "8px" },
                  children: [
                    { type: "box", styles: { width: "10px", height: "10px", minWidth: "10px", minHeight: "10px", borderRadius: "50%", backgroundColor: "#0EA5E9" } },
                    { type: "text", value: "Coastal Light", styles: { color: "#F8FAFC", fontSize: "12px", fontWeight: "500" } }
                  ]
                },
                { type: "text", value: "✓", attrs: { id: "ecmd-theme-check-coastal-light" }, styles: { color: "#10B981", fontSize: "12px", fontWeight: "700" } }
              ]
            },
            {
              type: "hbox",
              attrs: { id: "ecmd-theme-opt-midnight-slate" },
              styles: { width: "100%", alignItems: "center", justifyContent: "space-between", paddingTop: "7px", paddingBottom: "7px", paddingLeft: "10px", paddingRight: "10px", borderRadius: "7px" },
              children: [
                {
                  type: "hbox",
                  styles: { width: "auto", alignItems: "center", columnGap: "8px" },
                  children: [
                    { type: "box", styles: { width: "10px", height: "10px", minWidth: "10px", minHeight: "10px", borderRadius: "50%", backgroundColor: "#14B8A6" } },
                    { type: "text", value: "Midnight Slate", styles: { color: "#F8FAFC", fontSize: "12px", fontWeight: "500" } }
                  ]
                },
                { type: "text", value: "✓", attrs: { id: "ecmd-theme-check-midnight-slate" }, styles: { color: "#10B981", fontSize: "12px", fontWeight: "700" } }
              ]
            }
          ]
        }
      ]
    }
  }
});

registerEcmdComponent(EcmdSideMenuController, {
  name: "EcmdSideMenuController",
  displayName: "Side Menu Modal (☰)",
  importPath: "./components/EcmdSideMenuController",
  props: {
    open: {
      type: "boolean",
      displayName: "Open (Preview in Studio)",
      defaultValue: false,
    },
    defaultOpen: {
      type: "boolean",
      displayName: "Default Open",
      defaultValue: false,
    },
    enableLiveDropdown: {
      type: "boolean",
      displayName: "Enable Click to Toggle",
      defaultValue: true,
    },
    fixedBreakout: {
      type: "boolean",
      displayName: "Fixed Breakout (Viewport)",
      defaultValue: true,
    },
    align: {
      type: "choice",
      options: [
        { value: "right", label: "Right (Top-Right ☰ Trigger)" },
        { value: "left", label: "Left" },
        { value: "center", label: "Center" },
      ],
      defaultValue: "right",
      displayName: "Alignment",
    },
    offsetY: {
      type: "number",
      displayName: "Offset Y (px)",
      defaultValue: 10,
    },
    cardWidth: {
      type: "string",
      displayName: "Menu Card Width",
      defaultValue: "240px",
    },
    maskClosable: {
      type: "boolean",
      displayName: "Close on Outside Click",
      defaultValue: true,
    },
    closeOnSelect: {
      type: "boolean",
      displayName: "Close on Item Click",
      defaultValue: true,
    },
    hideTrigger: {
      type: "boolean",
      displayName: "Hide Trigger Button",
      defaultValue: false,
    },
    cardThemeGroup: {
      type: "custom",
      displayName: "🎨 Card Theme Group",
      defaultValue: "ecmd-group-3",
      control: EcmdGroupSelectControl as any,
    },
    itemThemeGroup: {
      type: "custom",
      displayName: "🎨 Buttons Theme Group",
      defaultValue: "ecmd-group-4",
      control: EcmdGroupSelectControl as any,
    },
    triggerThemeGroup: {
      type: "custom",
      displayName: "🎨 Trigger Theme Group",
      defaultValue: "none",
      control: EcmdGroupSelectControl as any,
    },
    syncFromSupabase: {
      type: "boolean",
      displayName: "Live Sync from Supabase",
      defaultValue: true,
    },
    activeButtonId: {
      type: "string",
      displayName: "Active Button ID (Preview Highlight)",
      defaultValue: "",
    },
    showHeaderSlot: {
      type: "boolean",
      displayName: "Show Header Slot",
      defaultValue: false,
    },
    showFooterSlot: {
      type: "boolean",
      displayName: "Show Footer Slot",
      defaultValue: false,
    },
    trigger: {
      type: "slot",
      displayName: "Custom Trigger Slot",
    },
    headerSlot: {
      type: "slot",
      displayName: "Menu Header Slot",
      hidden: (ps: any) => !ps.showHeaderSlot,
    },
    footerSlot: {
      type: "slot",
      displayName: "Menu Footer Slot",
      hidden: (ps: any) => !ps.showFooterSlot,
    },
  },
});

safePlasmicRegister("registerGlobalContext:EcmdDeviceGlobalContext", () => {
  PLASMIC.registerGlobalContext(EcmdDeviceGlobalContext, {
    name: "EcmdDeviceGlobalContext",
    displayName: "📱 Device & Wallet Detector (Apple / Google)",
    providesData: true,
    props: {
      previewEcosystem: {
        type: "choice",
        options: [
          { value: "auto", label: "Auto-Detect Real User Device" },
          { value: "apple", label: "Simulate Apple Device + Apple Pay" },
          { value: "google", label: "Simulate Android/Chrome + Google Pay" }
        ],
        defaultValue: "auto",
        displayName: "Device Simulation"
      }
    }
  });
});

registerEcmdComponent(EcmdVehicleSelector, {
  name: "EcmdVehicleSelector",
  displayName: "Vehicle Size Selector (4-Slot)",
  importPath: "./components/EcmdVehicleSelector",
  providesData: true,
  defaultStyles: { width: "100%" },
  props: {
    selectedVehicle: { type: "string", displayName: "Controlled Active Vehicle (Optional)" },
    defaultVehicle: { type: "choice", options: ["coupe", "truck", "sm-suv", "lg-suv"], defaultValue: "sm-suv", displayName: "Default Vehicle" },
    lockedVehicleKey: { type: "choice", options: ["", "coupe", "truck", "sm-suv", "lg-suv"], defaultValue: "", displayName: "🔒 Locked Vehicle Key (Optional)" },
    lockedSubCategory: { type: "choice", options: ["", "Sedan", "Truck", "Sm. SUV", "Lg. SUV"], defaultValue: "", displayName: "🔒 Locked SubCategory (Optional)" },
    persistChoice: { type: "boolean", defaultValue: true, displayName: "Persist to localStorage?" },
    themeGroup: { type: "custom", defaultValue: "ecmd-group-1", control: EcmdGroupSelectControl as any, displayName: "🎨 Wrapper Theme Group" },
    itemThemeGroup: { type: "custom", defaultValue: "ecmd-group-4", control: EcmdGroupSelectControl as any, displayName: "🎨 Slot Item Theme Group" },
    tabletBreakpointPx: { type: "number", defaultValue: 1024, displayName: "📱 Tablet Breakpoint (px)" },
    tabletLayout: {
      type: "choice",
      options: [
        { value: "inherit", label: "Inherit Desktop Row" },
        { value: "grid-2x2", label: "2×2 Grid" },
        { value: "horizontal-scroll", label: "Horizontal Scroll" },
        { value: "vertical-stack", label: "Vertical Stack" }
      ],
      defaultValue: "inherit",
      displayName: "📱 Tablet Layout"
    },
    tabletGap: { type: "number", defaultValue: 10, displayName: "📱 Tablet Gap (px)" },
    mobileBreakpointPx: { type: "number", defaultValue: 768, displayName: "📲 Mobile Breakpoint (px)" },
    mobileLayout: {
      type: "choice",
      options: [
        { value: "inherit", label: "Inherit Desktop Row" },
        { value: "grid-2x2", label: "2×2 Grid" },
        { value: "horizontal-scroll", label: "Horizontal Scroll" },
        { value: "vertical-stack", label: "Vertical Stack" }
      ],
      defaultValue: "grid-2x2",
      displayName: "📲 Mobile Layout"
    },
    mobileGap: { type: "number", defaultValue: 8, displayName: "📲 Mobile Gap (px)" },
    onVehicleChange: {
      type: "eventHandler",
      argTypes: [
        { name: "vehicleKey", type: "string" },
        { name: "meta", type: "object" }
      ],
      displayName: "On Vehicle Change"
    },
    onLockedAttempt: {
      type: "eventHandler",
      argTypes: [{ name: "detail", type: "object" }],
      displayName: "On Locked Vehicle Attempt"
    },
    slot1: {
      type: "slot",
      displayName: "Coupe / Car Slot",
      defaultValue: [
        { type: "vbox", styles: { alignItems: "center", justifyContent: "center" }, children: [
          { type: "img", src: "https://fakeimg.pl/60x30/121212/ffffff?text=Coupe", styles: { width: "60px", height: "30px", marginBottom: "5px" } },
          { type: "text", value: "Coupe / Car", styles: {} }
        ]}
      ]
    },
    slot2: {
      type: "slot",
      displayName: "Truck Slot",
      defaultValue: [
        { type: "vbox", styles: { alignItems: "center", justifyContent: "center" }, children: [
          { type: "img", src: "https://fakeimg.pl/60x30/121212/ffffff?text=Truck", styles: { width: "60px", height: "30px", marginBottom: "5px" } },
          { type: "text", value: "Truck", styles: {} }
        ]}
      ]
    },
    slot3: {
      type: "slot",
      displayName: "Sm. SUV Slot",
      defaultValue: [
        { type: "vbox", styles: { alignItems: "center", justifyContent: "center" }, children: [
          { type: "img", src: "https://fakeimg.pl/60x30/121212/ffffff?text=Sm.+SUV", styles: { width: "60px", height: "30px", marginBottom: "5px" } },
          { type: "text", value: "Sm. SUV", styles: {} }
        ]}
      ]
    },
    slot4: {
      type: "slot",
      displayName: "Lg. SUV/Van Slot",
      defaultValue: [
        { type: "vbox", styles: { alignItems: "center", justifyContent: "center" }, children: [
          { type: "img", src: "https://fakeimg.pl/60x30/121212/ffffff?text=Lg.+SUV", styles: { width: "60px", height: "30px", marginBottom: "5px" } },
          { type: "text", value: "Lg. SUV/Van", styles: {} }
        ]}
      ]
    }
  }
});

registerEcmdComponent(EcmdSavedVehicleDropdown, {
  name: "EcmdSavedVehicleDropdown",
  displayName: "Saved Vehicle Dropdown (#vehicleSelectDropButton)",
  description:
    "Wix packagesEngine.js parity saved-vehicle dropdown (#vehicleSelectDropButton / #vehicleSelectBox / #vehicleSelectRep / #vehicleTypeError) with vehicle tier locking, 3200ms locked-type error banner + pulse feedback, Browse Without a Vehicle reset, and + Add New Vehicle trigger.",
  importPath: "./components/EcmdSavedVehicleDropdown",
  providesData: true,
  defaultStyles: { width: "100%" },
  props: {
    vehicles: {
      type: "object",
      displayName: "Saved Vehicles List (Array)",
      description: "Array of customer vehicle objects ({ _id/id, year, make, model, color, vehicleType/subCategory })",
    },
    selectedVehicleId: {
      type: "string",
      displayName: "Controlled Selected Vehicle ID (Optional)",
    },
    defaultOpen: {
      type: "boolean",
      defaultValue: false,
      displayName: "Open Dropdown by Default (Studio Preview)",
    },
    previewLockedError: {
      type: "boolean",
      defaultValue: false,
      displayName: "Preview Locked Type Error (Studio Preview)",
    },
    introLabel: {
      type: "string",
      defaultValue: "Select Your Vehicle...",
      displayName: "Intro Button Label",
    },
    browseWithoutLabel: {
      type: "string",
      defaultValue: "Browse Without a Vehicle",
      displayName: "Browse Without Vehicle Option Label",
    },
    addNewLabel: {
      type: "string",
      defaultValue: "+ Add New Vehicle",
      displayName: "Add New Vehicle Option Label",
    },
    lockedErrorText: {
      type: "string",
      defaultValue: "Clear your selected vehicle to browse other vehicle types.",
      displayName: "Locked Vehicle Error Message",
    },
    errorDurationMs: {
      type: "number",
      defaultValue: 3200,
      displayName: "Error Auto-Hide Duration (ms)",
    },
    autoLoadFromSupabase: {
      type: "boolean",
      defaultValue: false,
      displayName: "Auto-Load Saved Vehicles from Supabase?",
    },
    userId: {
      type: "string",
      displayName: "Customer User ID (for Supabase Auto-Load)",
      hidden: (ps: any) => !ps.autoLoadFromSupabase,
    },
    themeGroup: {
      type: "custom",
      defaultValue: "ecmd-group-4",
      control: EcmdGroupSelectControl as any,
      displayName: "🎨 Trigger Button Theme Group",
    },
    menuThemeGroup: {
      type: "custom",
      defaultValue: "ecmd-group-3",
      control: EcmdGroupSelectControl as any,
      displayName: "🎨 Dropdown Menu Theme Group",
    },
    onVehicleSelect: {
      type: "eventHandler",
      argTypes: [
        { name: "vehicle", type: "object" },
        { name: "meta", type: "object" },
      ],
      displayName: "On Vehicle Select",
    },
    onClearVehicle: {
      type: "eventHandler",
      argTypes: [],
      displayName: "On Clear Vehicle",
    },
    onAddNewVehicle: {
      type: "eventHandler",
      argTypes: [],
      displayName: "On Add New Vehicle",
    },
    onLockedFeedback: {
      type: "eventHandler",
      argTypes: [{ name: "message", type: "string" }],
      displayName: "On Locked Error Triggered",
    },
  },
});

registerEcmdComponent(EcmdPackagesRepeater, {
  name: "EcmdPackagesRepeater",
  displayName: "Packages Repeater (#packagesRep)",
  importPath: "./components/EcmdPackagesRepeater",
  providesData: true,
  defaultStyles: { width: "100%" },
  props: {
    levelOrder: {
      type: "string",
      defaultValue: "Classic,Premium,Luxury",
      displayName: "📦 Package Level Order (Comma-Separated)",
      description: "Orders the 3 Wix package level cards (e.g. Classic,Premium,Luxury)",
    },
    themeGroup: { type: "custom", defaultValue: "ecmd-group-3", control: EcmdGroupSelectControl as any, displayName: "🎨 Card Theme Group" },
    orientation: {
      type: "choice",
      options: [
        { value: "vertical", label: "Vertical Stack" },
        { value: "horizontal-wrap", label: "Horizontal Wrap (Side-by-Side)" },
        { value: "horizontal-scroll", label: "Horizontal Scroll Strip" },
        { value: "grid", label: "Multi-Column Grid" }
      ],
      defaultValue: "vertical",
      displayName: "📐 Layout Orientation"
    },
    columns: {
      type: "number",
      min: 1,
      max: 4,
      defaultValue: 2,
      displayName: "Grid Columns (1–4)",
      hidden: (ps: any) => ps.orientation !== "grid"
    },
    cardWidth: {
      type: "string",
      defaultValue: "380px",
      displayName: "Card Width (Horizontal Modes)",
      hidden: (ps: any) => ps.orientation !== "horizontal-wrap" && ps.orientation !== "horizontal-scroll"
    },
    gap: {
      type: "number",
      defaultValue: 20,
      displayName: "Card Gap (px)"
    },
    tabletBreakpointPx: {
      type: "number",
      defaultValue: 1024,
      displayName: "📱 Tablet Breakpoint (px)"
    },
    tabletOrientation: {
      type: "choice",
      options: [
        { value: "inherit", label: "Inherit Desktop Orientation" },
        { value: "vertical", label: "Vertical Stack" },
        { value: "horizontal-wrap", label: "Horizontal Wrap (Side-by-Side)" },
        { value: "horizontal-scroll", label: "Horizontal Scroll Strip" },
        { value: "grid", label: "Multi-Column Grid" }
      ],
      defaultValue: "inherit",
      displayName: "📱 Tablet Orientation"
    },
    tabletColumns: {
      type: "number",
      min: 1,
      max: 4,
      defaultValue: 2,
      displayName: "📱 Tablet Grid Columns (1–4)",
      hidden: (ps: any) => ps.tabletOrientation !== "grid"
    },
    tabletCardWidth: {
      type: "string",
      defaultValue: "340px",
      displayName: "📱 Tablet Card Width",
      hidden: (ps: any) => ps.tabletOrientation !== "horizontal-wrap" && ps.tabletOrientation !== "horizontal-scroll"
    },
    tabletGap: {
      type: "number",
      defaultValue: 16,
      displayName: "📱 Tablet Card Gap (px)"
    },
    mobileBreakpointPx: {
      type: "number",
      defaultValue: 768,
      displayName: "📲 Mobile Breakpoint (px)"
    },
    mobileOrientation: {
      type: "choice",
      options: [
        { value: "inherit", label: "Inherit Desktop Orientation" },
        { value: "vertical", label: "Vertical Stack" },
        { value: "horizontal-wrap", label: "Horizontal Wrap (Side-by-Side)" },
        { value: "horizontal-scroll", label: "Horizontal Scroll Strip" },
        { value: "grid", label: "Multi-Column Grid" }
      ],
      defaultValue: "vertical",
      displayName: "📲 Mobile Orientation"
    },
    mobileColumns: {
      type: "number",
      min: 1,
      max: 4,
      defaultValue: 1,
      displayName: "📲 Mobile Grid Columns (1–4)",
      hidden: (ps: any) => ps.mobileOrientation !== "grid"
    },
    mobileCardWidth: {
      type: "string",
      defaultValue: "100%",
      displayName: "📲 Mobile Card Width",
      hidden: (ps: any) => ps.mobileOrientation !== "horizontal-wrap" && ps.mobileOrientation !== "horizontal-scroll"
    },
    mobileGap: {
      type: "number",
      defaultValue: 14,
      displayName: "📲 Mobile Card Gap (px)"
    },
    useSeparateMobileTemplate: {
      type: "boolean",
      defaultValue: false,
      displayName: "📲 Use Separate Mobile Card Template?"
    },
    mobileItemTemplate: {
      type: "slot",
      displayName: "📲 Mobile Package Card Template",
      hidden: (ps: any) => !ps.useSeparateMobileTemplate
    },
    desktopDetailsAction: {
      type: "choice",
      options: [
        { value: "inline", label: "Expand Inline" },
        { value: "modal", label: "Open Modal" },
        { value: "drawer", label: "Open Drawer" }
      ],
      defaultValue: "inline",
      displayName: "🖥️ Desktop Details Action"
    },
    tabletDetailsAction: {
      type: "choice",
      options: [
        { value: "inherit", label: "Inherit Desktop Action" },
        { value: "inline", label: "Expand Inline" },
        { value: "modal", label: "Open Modal" },
        { value: "drawer", label: "Open Drawer" }
      ],
      defaultValue: "inherit",
      displayName: "📱 Tablet Details Action"
    },
    mobileDetailsAction: {
      type: "choice",
      options: [
        { value: "inline", label: "Expand Inline" },
        { value: "modal", label: "Open Modal" },
        { value: "drawer", label: "Open Drawer" }
      ],
      defaultValue: "drawer",
      displayName: "📲 Mobile Details Action"
    },
    itemTemplate: {
      type: "slot",
      displayName: "Package Card Template",
      defaultValue: [
        {
          type: "vbox",
          attrs: { id: "ecmd-pkg-card-wrapper" },
          styles: { width: "100%", paddingTop: "20px", paddingRight: "20px", paddingBottom: "20px", paddingLeft: "20px", borderRadius: "12px" },
          children: [
            {
              type: "hbox",
              attrs: { "data-ecmd-pkg": "trust-bar" },
              styles: { justifyContent: "space-between", marginBottom: "15px", fontSize: "12px", color: "#64748B" },
              children: [
                { type: "text", value: "✓ Online Booking" },
                { type: "text", value: "✓ No Upfront Payments" },
                { type: "text", value: "✓ Money Back Guarantee" },
                { type: "text", value: "✓ Licensed, Insured, and Trained" }
              ]
            },
            {
              type: "hbox",
              styles: { justifyContent: "space-between", alignItems: "stretch" },
              children: [
                {
                  type: "vbox",
                  styles: {},
                  children: [
                    { type: "text", value: "Premium Plus - Ceramic Coating", attrs: { "data-ecmd-pkg": "title" }, styles: { fontSize: "24px", fontWeight: "bold", marginBottom: "10px" } },
                    { type: "text", value: "The ultimate protection and shine.", attrs: { "data-ecmd-pkg": "description" }, styles: { fontSize: "14px", marginBottom: "15px" } },
                    {
                      type: "hbox",
                      styles: {},
                      children: [
                        { type: "button", value: "Interior Only", attrs: { "data-ecmd-scope-btn": "interior" } },
                        { type: "button", value: "Full Detail", attrs: { "data-ecmd-scope-btn": "full", "data-ecmd-selected": "true" } },
                        { type: "button", value: "Exterior Only", attrs: { "data-ecmd-scope-btn": "exterior" } }
                      ]
                    },
                    {
                      type: "hbox",
                      styles: { justifyContent: "space-between", marginBottom: "20px", fontWeight: "bold", rowGap: "5px", columnGap: "5px" },
                      children: [
                        { type: "text", value: "Type: Sm. SUV", attrs: { "data-ecmd-pkg": "vehicle-label" } },
                        { type: "text", value: "Duration: 4Hrs", attrs: { "data-ecmd-pkg": "duration" } },
                        { type: "text", value: "SALE: $349", attrs: { "data-ecmd-pkg": "sale-price" }, styles: { color: "#10B981" } },
                        { type: "text", value: "Price: $399", attrs: { "data-ecmd-pkg": "regular-price" }, styles: {} },
                        { type: "text", value: "Add-Ons (99)", attrs: { "data-ecmd-pkg": "addons" } }
                      ]
                    },
                    {
                      type: "hbox",
                      styles: { rowGap: "10px", columnGap: "10px" },
                      children: [
                        { type: "button", value: "Add to Cart", attrs: { "data-ecmd-pkg": "add-to-cart-btn" }, styles: { backgroundColor: "#128FB1", color: "white", paddingTop: "10px", paddingBottom: "10px", paddingLeft: "20px", paddingRight: "20px", borderRadius: "8px" } },
                        { type: "button", value: "What's Included?", attrs: { "data-ecmd-pkg": "whats-included-btn" }, styles: { backgroundColor: "transparent", color: "#128FB1", paddingTop: "10px", paddingBottom: "10px", paddingLeft: "20px", paddingRight: "20px", borderRadius: "8px" } }
                      ]
                    }
                  ]
                },
                {
                  type: "vbox",
                  styles: {},
                  children: [
                    { type: "img", src: ECMD_PKG_HERO_PLACEHOLDER_URI, attrs: { "data-ecmd-pkg": "hero-image" }, styles: { width: "100%", height: "200px", borderRadius: "8px", marginBottom: "10px" } },
                    { type: "img", src: ECMD_PKG_GUARANTEE_BADGE_URI, attrs: { "data-ecmd-pkg": "guarantee-badge" }, styles: {} },
                    {
                      type: "hbox",
                      attrs: { "data-ecmd-pkg": "reviews-bar" },
                      styles: { alignItems: "center", rowGap: "5px", columnGap: "5px" },
                      children: [
                        { type: "text", value: "Google G ★★★★★", styles: { color: "#F59E0B" } },
                        { type: "text", value: "4.9", attrs: { "data-ecmd-pkg": "review-score" }, styles: { fontWeight: "bold" } },
                        { type: "text", value: "out of 9400 Google Reviews", attrs: { "data-ecmd-pkg": "review-count" }, styles: { fontSize: "12px", color: "#64748B" } }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  }
});

registerEcmdComponent(EcmdBrushedSteelButton, {
  name: "EcmdBrushedSteelButton",
  displayName: "Brushed Steel Button",
  description:
    "Version 7 props-driven Brushed Steel Button — independent sizing with container-type: size, height-responsive --button-radius, fixed-scale 160px x 160px repeating metal grain, container-query label scaling (55cqh / 18cqw), lift/press physics, and configurable #54E9EA Cyan / Emerald rear LED backlight glow.",
  importPath: "./components/EcmdBrushedSteelButton",
  defaultStyles: { width: "220px", height: "64px" },
  props: {
    label: {
      type: "string",
      defaultValue: "Exterior",
      displayName: "Button Label",
    },
    selected: {
      type: "boolean",
      defaultValue: false,
      displayName: "Selected (Backlight Glow)",
    },
    buttonRole: {
      type: "choice",
      options: [
        { value: "auto", label: "Auto (Detect from Label)" },
        { value: "scope-interior", label: "Scope: Interior" },
        { value: "scope-full", label: "Scope: Full Detail" },
        { value: "scope-exterior", label: "Scope: Exterior" },
        { value: "whats-included", label: "Action: What's Included" },
        { value: "add-to-cart", label: "Action: Add to Cart" },
      ],
      defaultValue: "auto",
      displayName: "Button Role Hook (Packages Engine)",
    },
    glowColor: {
      type: "color",
      defaultValue: "#54e9ea",
      displayName: "Glow Color (Default #54E9EA Cyan)",
    },
    fontSize: {
      type: "string",
      displayName: "Font Size Override (Optional, e.g. 18px; auto-scales via 55cqh / 18cqw)",
    },
    width: {
      type: "string",
      displayName: "Width Override (Optional, e.g. 100%, 352px)",
    },
    height: {
      type: "string",
      displayName: "Height Override (Optional, e.g. 44px, 64px)",
    },
    disabled: {
      type: "boolean",
      defaultValue: false,
      displayName: "Disabled",
    },
    onClick: {
      type: "eventHandler",
      argTypes: [{ name: "event", type: "object" }],
      displayName: "On Click",
    },
  },
});

registerEcmdComponent(EcmdWhatsIncludedModal, {
  name: "EcmdWhatsIncludedModal",
  displayName: "What's Included & Add-Ons Modal (#whatsIncludedLightbox)",
  description:
    "Wix fileWhatsIncluded.js parity modal powered by public.ecmd_whats_included & public.ecmd_service_packages with Classic/Premium/Luxury level switching, Interior/Exterior inclusion lists + notices, Bi-Weekly/Monthly/Quarterly subscription estimates, Interior/Exterior Add-On tabs persisted in localStorage('ecmd_addOnMemory'), live total (#whatsIncludedTotalPrice), and Add to Cart (#whatsIncludedAddCart).",
  importPath: "./components/EcmdWhatsIncludedModal",
  providesData: true,
  defaultStyles: { width: "100%" },
  props: {
    isOpen: {
      type: "boolean",
      displayName: "Open (Controlled)",
      description: "Controlled open state (leave unset to open via ecmd-open-whats-included event)",
    },
    defaultOpen: {
      type: "boolean",
      defaultValue: false,
      displayName: "Default Open (Studio Preview)",
    },
    inlinePreviewInStudio: {
      type: "boolean",
      defaultValue: false,
      displayName: "Render Inline (No Fixed Backdrop Overlay)",
    },
    defaultLevel: {
      type: "choice",
      options: ["Classic", "Premium", "Luxury"],
      defaultValue: "Classic",
      displayName: "Default Package Level",
    },
    defaultDetailType: {
      type: "choice",
      options: ["Full", "Interior", "Exterior"],
      defaultValue: "Full",
      displayName: "Default Detail Type",
    },
    defaultSubCategory: {
      type: "choice",
      options: ["Sedan", "Truck", "Sm. SUV", "Lg. SUV"],
      defaultValue: "Sm. SUV",
      displayName: "Default Vehicle Sub-Category",
    },
    levelOrder: {
      type: "string",
      defaultValue: "Classic,Premium,Luxury",
      displayName: "Package Level Order (Comma-Separated)",
    },
    autoLoadFromSupabase: {
      type: "boolean",
      defaultValue: true,
      displayName: "Auto-Load from public.ecmd_whats_included?",
    },
    closeOnBackdropClick: {
      type: "boolean",
      defaultValue: true,
      displayName: "Close on Backdrop Click",
    },
    closeOnEscape: {
      type: "boolean",
      defaultValue: true,
      displayName: "Close on Escape Key",
    },
    closeOnAddToCart: {
      type: "boolean",
      defaultValue: true,
      displayName: "Close Modal After Add to Cart",
    },
    themeGroup: {
      type: "custom",
      defaultValue: "ecmd-group-3",
      control: EcmdGroupSelectControl as any,
      displayName: "🎨 Modal Card Theme Group",
    },
    buttonThemeGroup: {
      type: "custom",
      defaultValue: "ecmd-group-2",
      control: EcmdGroupSelectControl as any,
      displayName: "🎨 Primary Button Theme Group",
    },
    whatsIncludedItems: {
      type: "object",
      displayName: "Override What's Included Items (Optional Array)",
    },
    servicePackages: {
      type: "object",
      displayName: "Override Service Packages Matrix (Optional Array)",
    },
    onClose: {
      type: "eventHandler",
      argTypes: [],
      displayName: "On Close",
    },
    onLevelChange: {
      type: "eventHandler",
      argTypes: [
        { name: "level", type: "string" },
        { name: "detail", type: "object" },
      ],
      displayName: "On Package Level Change",
    },
    onAddOnsChange: {
      type: "eventHandler",
      argTypes: [{ name: "detail", type: "object" }],
      displayName: "On Add-Ons Change",
    },
    onAddToCart: {
      type: "eventHandler",
      argTypes: [{ name: "payload", type: "object" }],
      displayName: "On Add to Cart",
    },
  },
});
