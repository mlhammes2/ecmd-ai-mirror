import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { carbonQuery } from "../integrations/supabase/client";
import {
  useEcmdBreakpoint,
  resolveBreakpointAction,
  executeBreakpointAction,
} from "../lib/useEcmdBreakpoint";
import { ensureEcmdRootSizingStyles } from "../lib/ecmdRootSizing";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const SCOPE_BUTTON_TEXT_PATTERNS: Array<{ pattern: RegExp; scope: "interior" | "full" | "exterior" }> = [
  { pattern: /^interior\s*only$/i, scope: "interior" },
  { pattern: /^full\s*detail$/i, scope: "full" },
  { pattern: /^exterior\s*only$/i, scope: "exterior" },
];

export function autoHealPackageScopeButtons(root: HTMLElement | null): number {
  if (!root) return 0;
  let healed = 0;
  const buttons = root.querySelectorAll("button");
  buttons.forEach((btn) => {
    const existing = (btn.getAttribute("data-ecmd-scope-btn") || "").trim();
    if (existing) return;
    const normalizedText = (btn.textContent || "").replace(/\s+/g, " ").trim();
    if (!normalizedText) return;
    for (const rule of SCOPE_BUTTON_TEXT_PATTERNS) {
      if (rule.pattern.test(normalizedText)) {
        btn.setAttribute("data-ecmd-scope-btn", rule.scope);
        healed++;
        break;
      }
    }
  });
  return healed;
}

export type PackagesOrientation = "vertical" | "horizontal-wrap" | "horizontal-scroll" | "grid";
export type ResponsivePackagesOrientation = "inherit" | PackagesOrientation;
export type MobilePackagesOrientation = ResponsivePackagesOrientation;
export type TabletPackagesOrientation = ResponsivePackagesOrientation;
export type PackageDetailsAction = "inline" | "modal" | "drawer";
export type TabletPackageDetailsAction = "inherit" | PackageDetailsAction;

export const ECMD_PKG_HERO_PLACEHOLDER_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#062825"/>
      <stop offset="55%" stop-color="#0A3A4A"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>
    <linearGradient id="shine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#14B8A6" stop-opacity="0"/>
      <stop offset="50%" stop-color="#38BDF8" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#14B8A6" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" rx="14" fill="url(#bg)"/>
  <circle cx="540" cy="70" r="110" fill="#14B8A6" fill-opacity="0.12"/>
  <circle cx="110" cy="310" r="95" fill="#0EA5E9" fill-opacity="0.12"/>
  <rect x="44" y="218" width="552" height="3" rx="1.5" fill="url(#shine)"/>
  <path d="M168 196 L212 142 C222 130 238 124 256 124 L378 124 C400 124 418 134 434 150 L476 170 C492 178 500 188 500 202 L500 212 L152 212 L152 204 C152 199 158 196 168 196 Z" fill="#E2E8F0" fill-opacity="0.14" stroke="#38BDF8" stroke-width="2.5"/>
  <circle cx="222" cy="212" r="22" fill="#0F172A" stroke="#14B8A6" stroke-width="4"/>
  <circle cx="430" cy="212" r="22" fill="#0F172A" stroke="#14B8A6" stroke-width="4"/>
  <path d="M474 96 L480 112 L496 118 L480 124 L474 140 L468 124 L452 118 L468 112 Z" fill="#5EEAD4"/>
  <text x="320" y="274" text-anchor="middle" fill="#F8FAFC" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="700" letter-spacing="1.2">EMERALD COAST MOBILE DETAILING</text>
  <text x="320" y="302" text-anchor="middle" fill="#94A3B8" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="500" letter-spacing="2">CERAMIC PROTECTION • PRECISION FINISH</text>
</svg>`
  );

export const ECMD_PKG_GUARANTEE_BADGE_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 44" width="220" height="44">
  <rect x="1" y="1" width="218" height="42" rx="21" fill="#062825" stroke="#14B8A6" stroke-width="1.5"/>
  <circle cx="24" cy="22" r="11" fill="#10B981"/>
  <path d="M19 22 L22.5 25.5 L29.5 18.5" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="44" y="26" fill="#E2E8F0" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="700">100% Satisfaction Guarantee</text>
</svg>`
  );

export interface EcmdPackagesRepeaterProps {
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  themeGroup?: string;
  orientation?: PackagesOrientation;
  columns?: number;
  cardWidth?: string;
  gap?: number;
  tabletBreakpointPx?: number;
  tabletOrientation?: TabletPackagesOrientation;
  tabletColumns?: number;
  tabletCardWidth?: string;
  tabletGap?: number;
  mobileBreakpointPx?: number;
  mobileOrientation?: MobilePackagesOrientation;
  mobileColumns?: number;
  mobileCardWidth?: string;
  mobileGap?: number;
  useSeparateMobileTemplate?: boolean;
  mobileItemTemplate?: React.ReactNode;
  desktopDetailsAction?: PackageDetailsAction;
  tabletDetailsAction?: TabletPackageDetailsAction;
  mobileDetailsAction?: PackageDetailsAction;
  itemTemplate?: React.ReactNode;
  cardTemplate?: React.ReactNode;
  setControlContextData?: (data: any) => void;
}

function isBrokenPlaceholderSrc(src?: string | null): boolean {
  const s = (src || "").trim();
  if (!s) return true;
  if (/fakeimg\.pl/i.test(s)) return true;
  return false;
}

function mapDetailsActionToCommand(action: PackageDetailsAction): string {
  if (action === "modal") return "open-modal";
  if (action === "drawer") return "open-drawer";
  return "expand-inline";
}

export function EcmdPackagesRepeater({
  id = "packagesRep",
  className = "",
  style,
  themeGroup = "ecmd-group-3",
  orientation = "vertical",
  columns = 2,
  cardWidth = "380px",
  gap = 20,
  tabletBreakpointPx = 1024,
  tabletOrientation = "inherit",
  tabletColumns,
  tabletCardWidth,
  tabletGap,
  mobileBreakpointPx = 768,
  mobileOrientation = "vertical",
  mobileColumns = 1,
  mobileCardWidth = "100%",
  mobileGap = 14,
  useSeparateMobileTemplate = false,
  mobileItemTemplate,
  desktopDetailsAction = "inline",
  tabletDetailsAction = "inherit",
  mobileDetailsAction = "drawer",
  itemTemplate,
  cardTemplate,
  setControlContextData,
}: EcmdPackagesRepeaterProps) {
  const [packages, setPackages] = useState<any[]>([]);
  const [activeVehicle, setActiveVehicle] = useState("sm-suv");
  const [activeVehicleLabel, setActiveVehicleLabel] = useState("Sm. SUV");
  const [inlineExpandedPkgId, setInlineExpandedPkgId] = useState<number | string | null>(null);
  const [overlayDetails, setOverlayDetails] = useState<{
    mode: "modal" | "drawer";
    pkg: any;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { isMobile, isTablet, viewportMode } = useEcmdBreakpoint(
    mobileBreakpointPx,
    tabletBreakpointPx
  );

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const data = await carbonQuery(
          "SELECT * FROM public.ecmd_packages WHERE enabled = true ORDER BY sort_order ASC"
        );
        if (data && data.length > 0) {
          const pkgs = data.map((p: any) => ({ ...p, activeScope: p.default_scope || "full" }));
          setPackages(pkgs);
        }
      } catch (err) {
        console.error("Failed to fetch packages", err);
      }
    };

    fetchPackages();

    let savedVehicle: string | null = null;
    try {
      savedVehicle = window.localStorage.getItem("ecmd_selected_vehicle");
    } catch {
      // Cross-origin iframe storage restriction
    }
    if (savedVehicle) {
      setActiveVehicle(savedVehicle);
      let lbl = "Car";
      if (savedVehicle === "truck") lbl = "Truck";
      if (savedVehicle === "sm-suv") lbl = "Sm. SUV";
      if (savedVehicle === "lg-suv") lbl = "Lg. SUV/Van";
      setActiveVehicleLabel(lbl);
    }

    const handleVehicleChange = (e: any) => {
      setActiveVehicle(e.detail.vehicleKey);
      setActiveVehicleLabel(e.detail.label);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("ecmd-vehicle-change", handleVehicleChange);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("ecmd-vehicle-change", handleVehicleChange);
      }
    };
  }, []);

  // Inject zero-specificity :where(...) root sizing defaults + auto-heal missing data-ecmd-scope-btn
  // across all breakpoints (desktop/tablet/mobile) BEFORE telemetry snapshots run.
  useIsomorphicLayoutEffect(() => {
    const root = containerRef.current;
    ensureEcmdRootSizingStyles(root?.ownerDocument);
    if (!root) return;

    autoHealPackageScopeButtons(root);

    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      autoHealPackageScopeButtons(root);
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-ecmd-scope-btn"],
    });
    return () => observer.disconnect();
  }, [packages, itemTemplate, mobileItemTemplate, isMobile, isTablet, viewportMode, useSeparateMobileTemplate]);

  // Ensure any missing/broken [data-ecmd-pkg="hero-image"] or [data-ecmd-pkg="guarantee-badge"] renders clean inline SVG banner instead of a broken placeholder
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    autoHealPackageScopeButtons(root);

    const cleanups: Array<() => void> = [];
    const heroImgs = root.querySelectorAll('img[data-ecmd-pkg="hero-image"]');
    heroImgs.forEach((node) => {
      const img = node as HTMLImageElement;
      if (isBrokenPlaceholderSrc(img.getAttribute("src"))) {
        img.src = ECMD_PKG_HERO_PLACEHOLDER_URI;
      }
      const onErr = () => {
        if (img.src !== ECMD_PKG_HERO_PLACEHOLDER_URI) {
          img.src = ECMD_PKG_HERO_PLACEHOLDER_URI;
        }
      };
      img.addEventListener("error", onErr);
      cleanups.push(() => img.removeEventListener("error", onErr));
    });

    const badgeImgs = root.querySelectorAll('img[data-ecmd-pkg="guarantee-badge"]');
    badgeImgs.forEach((node) => {
      const img = node as HTMLImageElement;
      if (isBrokenPlaceholderSrc(img.getAttribute("src"))) {
        img.src = ECMD_PKG_GUARANTEE_BADGE_URI;
      }
      const onErr = () => {
        if (img.src !== ECMD_PKG_GUARANTEE_BADGE_URI) {
          img.src = ECMD_PKG_GUARANTEE_BADGE_URI;
        }
      };
      img.addEventListener("error", onErr);
      cleanups.push(() => img.removeEventListener("error", onErr));
    });

    return () => cleanups.forEach((fn) => fn());
  }, [packages, itemTemplate, mobileItemTemplate, isMobile, useSeparateMobileTemplate]);

  const handleScopeChange = (pkgId: number, scope: string) => {
    setPackages((prev) =>
      prev.map((p) => (p.id === pkgId ? { ...p, activeScope: scope } : p))
    );
  };

  const useTabletLayoutOverride = isTablet && Boolean(tabletOrientation && tabletOrientation !== "inherit");
  const effectiveOrientation: PackagesOrientation =
    isMobile && mobileOrientation && mobileOrientation !== "inherit"
      ? mobileOrientation
      : useTabletLayoutOverride
      ? (tabletOrientation as PackagesOrientation)
      : orientation;
  const rawCols = isMobile
    ? mobileColumns
    : isTablet
    ? (tabletColumns ?? (useTabletLayoutOverride ? 2 : columns))
    : columns;
  const clampedCols = Math.max(
    1,
    Math.min(4, Math.round(Number(rawCols) || (isMobile ? 1 : 2)))
  );
  const rawGap = isMobile
    ? mobileGap
    : isTablet
    ? (tabletGap ?? (useTabletLayoutOverride ? 16 : gap))
    : gap;
  const gapPx = `${
    Number.isFinite(Number(rawGap)) ? Number(rawGap) : isMobile ? 14 : isTablet ? 16 : 20
  }px`;
  const rawCardWidth = isMobile
    ? mobileCardWidth
    : isTablet
    ? (tabletCardWidth ?? (useTabletLayoutOverride ? "340px" : cardWidth))
    : cardWidth;
  const resolvedCardWidth = (
    rawCardWidth || (isMobile ? "100%" : isTablet ? "340px" : "380px")
  ).trim();
  const isHorizontal =
    effectiveOrientation === "horizontal-wrap" || effectiveOrientation === "horizontal-scroll";

  const primaryTemplate = itemTemplate ?? cardTemplate;
  const activeTemplate =
    isMobile && useSeparateMobileTemplate && mobileItemTemplate ? mobileItemTemplate : primaryTemplate;
  const hasCustomTemplate = Boolean(activeTemplate);

  const effectiveDetailsAction: PackageDetailsAction = isMobile
    ? mobileDetailsAction
    : isTablet && tabletDetailsAction && tabletDetailsAction !== "inherit"
    ? tabletDetailsAction
    : desktopDetailsAction;

  // Zero-Inline-Width Root Law: NEVER hardcode inline width: "100%" on the root box.
  // Default width (100%) lives in zero-specificity :where(.ecmd-packages-repeater-root) CSS
  // so Plasmic Studio Design -> Width (e.g. 980px), Max Width, Margin, and Align always win.
  const containerStyle: React.CSSProperties =
    effectiveOrientation === "grid"
      ? {
          display: "grid",
          gridTemplateColumns: `repeat(${clampedCols}, minmax(0, 1fr))`,
          alignItems: "stretch",
          gap: gapPx,
        }
      : effectiveOrientation === "horizontal-wrap"
      ? {
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "stretch",
          gap: gapPx,
        }
      : effectiveOrientation === "horizontal-scroll"
      ? {
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          overflowX: "auto",
          alignItems: "stretch",
          gap: gapPx,
        }
      : {
          display: "flex",
          flexDirection: "column",
          gap: gapPx,
        };

  const cardStyle: React.CSSProperties = isHorizontal
    ? {
        display: "flex",
        flexDirection: "column",
        width: resolvedCardWidth,
        minWidth: resolvedCardWidth,
        maxWidth: "100%",
        flexShrink: 0,
        boxSizing: "border-box",
      }
    : {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      };

  const renderPackage = (pkg: any, index: number) => {
    const matrix = pkg.pricing_matrix || {};
    const multipliers = matrix.multipliers || {
      coupe: 1,
      truck: 1.2,
      "sm-suv": 1.25,
      "lg-suv": 1.4,
    };
    const multiplier = multipliers[activeVehicle] || 1;

    const basePrice = (matrix.basePrice || 0) * multiplier;
    const salePrice = (matrix.salePrice || 0) * multiplier;
    const duration = matrix.duration || 0;
    const hasSale = salePrice > 0 && salePrice < basePrice;
    const pkgKey = pkg.id ?? index;
    const isInlineOpen = inlineExpandedPkgId === pkgKey;

    // Transparent Per-Card Slot Wrapper: when a Package Card Template slot is provided,
    // keep the outer per-card wrapper free of themeGroup surface classes (e.g. ecmd-group-3 white box)
    // and stamp data-ecmd-slot-wrapper="transparent" so zero-specificity :where(...) rules keep
    // background: transparent, border: none, box-shadow: none, padding: 0 behind rounded user cards.
    const wrapperThemeClass =
      !hasCustomTemplate && themeGroup && themeGroup !== "none" ? themeGroup : "";

    return (
      <div
        key={pkgKey}
        className={`${wrapperThemeClass} ecmd-package-card`.trim()}
        data-ecmd-slot-wrapper={hasCustomTemplate ? "transparent" : "default"}
        style={cardStyle}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const scopeBtn = target.closest("[data-ecmd-scope-btn]");
          if (scopeBtn) {
            const scope = scopeBtn.getAttribute("data-ecmd-scope-btn");
            if (scope) handleScopeChange(pkg.id, scope);
          }

          const explicitAction = resolveBreakpointAction(target, viewportMode);
          const detailsTrigger = target.closest('[data-ecmd-pkg="whats-included-btn"]');
          const resolvedAction =
            explicitAction ||
            (detailsTrigger ? mapDetailsActionToCommand(effectiveDetailsAction) : null);

          if (resolvedAction) {
            executeBreakpointAction(resolvedAction, {
              element: (detailsTrigger as HTMLElement | null) || target,
              viewportMode,
              isMobile,
              payload: {
                pkg,
                pkgId: pkgKey,
                activeVehicle,
                activeVehicleLabel,
                basePrice,
                salePrice,
                duration,
              },
              onExpandInline: () =>
                setInlineExpandedPkgId((prev) => (prev === pkgKey ? null : pkgKey)),
              onOpenModal: () => setOverlayDetails({ mode: "modal", pkg }),
              onOpenDrawer: () => setOverlayDetails({ mode: "drawer", pkg }),
            });
          }
        }}
      >
        <div style={{ display: "none" }} data-ecmd-pkg="active-context">
          {JSON.stringify({
            pkg,
            activeVehicle,
            activeVehicleLabel,
            basePrice,
            salePrice,
            duration,
            hasSale,
            viewportMode,
          })}
        </div>
        {setControlContextData ? (
          <React.Fragment>{activeTemplate}</React.Fragment>
        ) : (
          activeTemplate
        )}
        {isInlineOpen && (
          <div
            data-ecmd-pkg="inline-details-panel"
            style={{
              marginTop: "12px",
              padding: "12px 14px",
              borderRadius: "8px",
              border: "1px solid rgba(20, 184, 166, 0.35)",
              backgroundColor: "rgba(15, 23, 42, 0.72)",
              color: "#E2E8F0",
              fontSize: "13px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{pkg.title || "Package Details"} — What&apos;s Included</strong>
              <button
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  setInlineExpandedPkgId(null);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94A3B8",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>
            <p style={{ marginTop: "6px", marginBottom: 0, opacity: 0.9 }}>
              {pkg.description ||
                `Complete ${pkg.activeScope || "full"} detail tailored for ${activeVehicleLabel} (${duration || 4} hrs).`}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      id={id}
      ref={containerRef}
      data-ecmd-orientation={effectiveOrientation}
      data-ecmd-viewport={viewportMode}
      className={`ecmd-packages-repeater-root ecmd-packages-repeater-container ${className}`.trim()}
      style={style ? { ...containerStyle, ...style } : containerStyle}
    >
      {packages.length > 0 ? (
        packages.map((pkg, index) => renderPackage(pkg, index))
      ) : (
        <div>Loading Packages...</div>
      )}

      {overlayDetails && (
        <div
          data-ecmd-pkg={`details-${overlayDetails.mode}-overlay`}
          role="dialog"
          aria-modal="true"
          onClick={() => setOverlayDetails(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(2, 6, 23, 0.72)",
            display: "flex",
            alignItems: overlayDetails.mode === "drawer" ? "flex-end" : "center",
            justifyContent: "center",
            padding: overlayDetails.mode === "drawer" ? "0px" : "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: overlayDetails.mode === "drawer" ? "100%" : "min(520px, 100%)",
              maxHeight: "82vh",
              overflowY: "auto",
              backgroundColor: "#0F172A",
              color: "#F8FAFC",
              border: "1px solid rgba(20, 184, 166, 0.4)",
              borderRadius: overlayDetails.mode === "drawer" ? "16px 16px 0 0" : "14px",
              padding: "20px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>
                {overlayDetails.pkg?.title || "Package Details"}
              </h3>
              <button
                type="button"
                aria-label="Close package details"
                onClick={() => setOverlayDetails(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94A3B8",
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>
            <p style={{ marginTop: "10px", fontSize: "14px", lineHeight: 1.5, color: "#CBD5E1" }}>
              {overlayDetails.pkg?.description ||
                `Complete ${overlayDetails.pkg?.activeScope || "full"} detail for ${activeVehicleLabel}.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
