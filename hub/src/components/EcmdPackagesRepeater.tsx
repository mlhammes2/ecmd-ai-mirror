import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { DataProvider } from "@plasmicapp/loader-react";
import { carbonQuery } from "../integrations/supabase/client";
import {
  useEcmdBreakpoint,
  resolveBreakpointAction,
  executeBreakpointAction,
} from "../lib/useEcmdBreakpoint";
import { ensureEcmdRootSizingStyles } from "../lib/ecmdRootSizing";
import {
  buildPackageCardContext,
  detailTypeToScope,
  extractOrderedPackageLevels,
  findMatchingServicePackage,
  loadSavedAddOnsMap,
  mapVehicleKeyToSubCategory,
  scopeToDetailType,
  type EcmdAddOnsMemoryMap,
  type EcmdPackageCardContext,
  type EcmdServicePackageRow,
  type PackageScopeKey,
} from "../lib/ecmdPackageMatcher";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function SafePlasmicDataProvider({
  name,
  data,
  children,
}: {
  name: string;
  data: any;
  children?: React.ReactNode;
}) {
  if (typeof DataProvider === "function") {
    return (
      <DataProvider name={name} data={data}>
        {children}
      </DataProvider>
    );
  }
  return <>{children}</>;
}

export const SCOPE_BUTTON_TEXT_PATTERNS: Array<{
  pattern: RegExp;
  scope: PackageScopeKey;
}> = [
  { pattern: /^interior(?:\s+only)?$/i, scope: "interior" },
  { pattern: /^full(?:\s+detail)?$/i, scope: "full" },
  { pattern: /^exterior(?:\s+only)?$/i, scope: "exterior" },
];

const WHATS_INCLUDED_TEXT_PATTERN = /^what['’]?s\s+included\??$/i;
const ADD_TO_CART_TEXT_PATTERN = /^add\s+to\s+cart$/i;

function isInsideBottomCtaRow(btn: HTMLButtonElement): boolean {
  const scopes: Array<HTMLElement | null> = [
    btn.parentElement,
    btn.parentElement?.parentElement ?? null,
  ];
  for (const container of scopes) {
    if (!container || container.classList.contains("ecmd-package-card")) continue;
    const siblingButtons = Array.from(container.querySelectorAll("button"));
    if (siblingButtons.length === 0 || siblingButtons.length > 4) continue;
    const hasCtaSibling = siblingButtons.some((sib) => {
      if (sib === btn) return false;
      const pkgAttr = (sib.getAttribute("data-ecmd-pkg") || "").trim();
      const actionAttr = (sib.getAttribute("data-ecmd-action") || "").trim();
      if (
        pkgAttr === "add-to-cart-btn" ||
        pkgAttr === "whats-included-btn" ||
        actionAttr === "add-to-cart" ||
        actionAttr === "open-whats-included"
      ) {
        return true;
      }
      const txt = (sib.textContent || "").replace(/\s+/g, " ").trim();
      return ADD_TO_CART_TEXT_PATTERN.test(txt) || WHATS_INCLUDED_TEXT_PATTERN.test(txt);
    });
    if (hasCtaSibling) return true;
  }
  return false;
}

export function autoHealPackageScopeButtons(root: HTMLElement | null): number {
  if (!root) return 0;
  let healed = 0;
  const buttons = root.querySelectorAll("button");

  buttons.forEach((btn) => {
    const existingScope = (btn.getAttribute("data-ecmd-scope-btn") || "").trim();
    const existingAction = (btn.getAttribute("data-ecmd-action") || "").trim();
    const existingPkg = (btn.getAttribute("data-ecmd-pkg") || "").trim();
    const normalizedText = (btn.textContent || "").replace(/\s+/g, " ").trim();

    // Ensure explicit CTA pkg hooks also carry data-ecmd-action so sibling-hook linting stays clean
    if (existingPkg === "add-to-cart-btn" && !existingAction) {
      btn.setAttribute("data-ecmd-action", "add-to-cart");
      healed++;
    } else if (existingPkg === "whats-included-btn" && !existingAction) {
      btn.setAttribute("data-ecmd-action", "open-whats-included");
      healed++;
    }

    if (existingScope || existingAction) {
      const steelRoot = btn.closest(".ecmd-steel-button-root");
      if (steelRoot && existingScope && !steelRoot.getAttribute("data-ecmd-scope-btn")) {
        steelRoot.setAttribute("data-ecmd-scope-btn", existingScope);
      }
      return;
    }

    if (!normalizedText) return;

    // 1. Match What's Included CTA
    if (WHATS_INCLUDED_TEXT_PATTERN.test(normalizedText)) {
      btn.setAttribute("data-ecmd-action", "open-whats-included");
      btn.setAttribute("data-ecmd-pkg", "whats-included-btn");
      healed++;
      return;
    }

    // 2. Match Add to Cart CTA
    if (ADD_TO_CART_TEXT_PATTERN.test(normalizedText)) {
      btn.setAttribute("data-ecmd-action", "add-to-cart");
      btn.setAttribute("data-ecmd-pkg", "add-to-cart-btn");
      healed++;
      return;
    }

    // 3. Skip buttons inside the bottom CTA row from receiving false scope hooks
    //    (e.g. a newly dropped BrushedSteelButton with default label "Exterior" next to "Add to Cart")
    if (isInsideBottomCtaRow(btn)) {
      return;
    }

    // 4. Match Scope Toggle buttons: Interior / Interior Only, Full / Full Detail, Exterior / Exterior Only
    for (const rule of SCOPE_BUTTON_TEXT_PATTERNS) {
      if (rule.pattern.test(normalizedText)) {
        btn.setAttribute("data-ecmd-scope-btn", rule.scope);
        const steelRoot = btn.closest(".ecmd-steel-button-root");
        if (steelRoot && !steelRoot.getAttribute("data-ecmd-scope-btn")) {
          steelRoot.setAttribute("data-ecmd-scope-btn", rule.scope);
        }
        healed++;
        break;
      }
    }
  });

  return healed;
}

function isStaticFieldLabel(text: string): boolean {
  const trimmed = text.trim();
  return /^(?:type|vehicle|duration|sale|price|regular\s*price|addons|add-ons)\s*:$/i.test(trimmed);
}

function setLeafTextPreservingPrefix(el: HTMLElement, newValue: string): void {
  if (el.children.length > 0) return;
  const current = (el.textContent || "").trim();
  if (isStaticFieldLabel(current)) return;

  const colonIdx = current.indexOf(":");
  if (colonIdx > 0 && colonIdx < 20) {
    const prefix = current.slice(0, colonIdx + 1).trim();
    const rest = current.slice(colonIdx + 1).trim();
    if (rest.length > 0) {
      el.textContent = `${prefix} ${newValue}`;
      return;
    }
  }
  el.textContent = newValue;
}

function paintCardDomInPlace(cardEl: HTMLElement, ctx: EcmdPackageCardContext): void {
  // 1. Title
  cardEl
    .querySelectorAll('[data-ecmd-pkg="title"], #packageTitle, #packageRepTitle')
    .forEach((node) => {
      if (node instanceof HTMLElement && node.children.length === 0) {
        node.textContent = ctx.title;
      }
    });

  // 2. Description
  cardEl
    .querySelectorAll('[data-ecmd-pkg="description"], #packageDescription, #packageRepDescrition')
    .forEach((node) => {
      if (node instanceof HTMLElement && node.children.length === 0) {
        node.textContent = ctx.description;
      }
    });

  // 3. Vehicle Label / SubCategory
  cardEl
    .querySelectorAll('[data-ecmd-pkg="vehicle-label"], #packageVehicle, #packageRepVehicle')
    .forEach((node) => {
      if (node instanceof HTMLElement) {
        setLeafTextPreservingPrefix(node, ctx.subCategory);
      }
    });

  // 4. Duration
  cardEl
    .querySelectorAll('[data-ecmd-pkg="duration"], #packageDuration, #packageRepDuration')
    .forEach((node) => {
      if (node instanceof HTMLElement) {
        setLeafTextPreservingPrefix(node, ctx.durationText);
      }
    });

  // 5. Regular / Base Price (or primary price)
  cardEl
    .querySelectorAll(
      '[data-ecmd-pkg="price"], [data-ecmd-pkg="regular-price"], #packagePrice, #packageRepPrice'
    )
    .forEach((node) => {
      if (node instanceof HTMLElement) {
        setLeafTextPreservingPrefix(node, ctx.basePriceFormatted);
      }
    });

  // 6. Sale Price
  cardEl
    .querySelectorAll('[data-ecmd-pkg="sale-price"], #packageSalePrice, #packageRepSalePrice')
    .forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (ctx.hasSale) {
        if (node.style.display === "none") node.style.display = "";
        setLeafTextPreservingPrefix(node, ctx.salePriceFormatted);
      } else {
        node.style.display = "none";
      }
    });

  // 7. Add-Ons badge
  cardEl
    .querySelectorAll('[data-ecmd-pkg="addons"], #packageRepAddons')
    .forEach((node) => {
      if (node instanceof HTMLElement && node.children.length === 0) {
        node.textContent = `Add-Ons (${ctx.addOnsCount})`;
      }
    });

  // 8. Sync active scope selection glow onto every [data-ecmd-scope-btn] & .ecmd-steel-button-root
  const scopeEls = cardEl.querySelectorAll("[data-ecmd-scope-btn]");
  scopeEls.forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const scope = (node.getAttribute("data-ecmd-scope-btn") || "").trim().toLowerCase();
    const isActive = scope === ctx.activeScope;
    const selectedStr = isActive ? "true" : "false";

    node.setAttribute("data-ecmd-selected", selectedStr);
    if (node.tagName.toLowerCase() === "button") {
      node.setAttribute("aria-pressed", selectedStr);
    }

    const steelRoot = node.classList.contains("ecmd-steel-button-root")
      ? node
      : (node.closest(".ecmd-steel-button-root") as HTMLElement | null);
    if (steelRoot) {
      steelRoot.setAttribute("data-ecmd-selected", selectedStr);
      const innerBtn = steelRoot.querySelector("button.ecmd-steel-button, button.steel-button");
      if (innerBtn instanceof HTMLElement) {
        innerBtn.setAttribute("data-ecmd-selected", selectedStr);
        innerBtn.setAttribute("aria-pressed", selectedStr);
      }
    }
  });
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
  levelOrder?: string;
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

function isServicePackagesMatrixRow(row: any): boolean {
  return Boolean(row && (row.package_level || row.packageLevel));
}

export function EcmdPackagesRepeater({
  id = "packagesRep",
  className = "",
  style,
  levelOrder = "Classic,Premium,Luxury",
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
  const [servicePackages, setServicePackages] = useState<EcmdServicePackageRow[]>([]);
  const [legacyPackages, setLegacyPackages] = useState<any[]>([]);
  const [scopeByCardKey, setScopeByCardKey] = useState<Record<string, PackageScopeKey>>({});
  const [addOnsMap, setAddOnsMap] = useState<EcmdAddOnsMemoryMap>({});
  const [activeVehicle, setActiveVehicle] = useState("sm-suv");
  const [activeVehicleLabel, setActiveVehicleLabel] = useState("Sm. SUV");
  const [inlineExpandedPkgId, setInlineExpandedPkgId] = useState<number | string | null>(null);
  const [overlayDetails, setOverlayDetails] = useState<{
    mode: "modal" | "drawer";
    ctx: EcmdPackageCardContext;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { isMobile, isTablet, viewportMode } = useEcmdBreakpoint(
    mobileBreakpointPx,
    tabletBreakpointPx
  );

  useEffect(() => {
    let cancelled = false;

    const fetchPackages = async () => {
      try {
        const matrixRows = await carbonQuery<EcmdServicePackageRow>(
          "SELECT * FROM public.ecmd_service_packages WHERE enabled = true ORDER BY sort_order ASC, id ASC"
        );
        if (cancelled) return;

        if (Array.isArray(matrixRows) && matrixRows.length > 0) {
          if (matrixRows.some(isServicePackagesMatrixRow)) {
            setServicePackages(matrixRows);
            setLegacyPackages([]);
            return;
          }
          // Mock or legacy shape returned from first query
          setLegacyPackages(
            matrixRows.map((p: any) => ({ ...p, activeScope: p.default_scope || "full" }))
          );
          setServicePackages([]);
          return;
        }
      } catch (err) {
        console.warn("ecmd_service_packages query failed, falling back to ecmd_packages:", err);
      }

      try {
        const fallbackRows = await carbonQuery(
          "SELECT * FROM public.ecmd_packages WHERE enabled = true ORDER BY sort_order ASC"
        );
        if (cancelled) return;
        if (Array.isArray(fallbackRows) && fallbackRows.length > 0) {
          setLegacyPackages(
            fallbackRows.map((p: any) => ({ ...p, activeScope: p.default_scope || "full" }))
          );
          setServicePackages([]);
        }
      } catch (err) {
        console.error("Failed to fetch packages", err);
      }
    };

    fetchPackages();
    setAddOnsMap(loadSavedAddOnsMap());

    let savedVehicle: string | null = null;
    try {
      savedVehicle = window.localStorage.getItem("ecmd_selected_vehicle");
    } catch {
      // Cross-origin iframe storage restriction
    }
    if (savedVehicle) {
      setActiveVehicle(savedVehicle);
      setActiveVehicleLabel(mapVehicleKeyToSubCategory(savedVehicle));
    }

    const handleVehicleChange = (e: any) => {
      const nextKey = e?.detail?.vehicleKey || "sm-suv";
      const nextLabel = e?.detail?.label || mapVehicleKeyToSubCategory(nextKey);
      setActiveVehicle(nextKey);
      setActiveVehicleLabel(nextLabel);
    };

    const handleAddOnsUpdated = () => {
      setAddOnsMap(loadSavedAddOnsMap());
    };

    if (typeof window !== "undefined") {
      window.addEventListener("ecmd-vehicle-change", handleVehicleChange);
      window.addEventListener("ecmd-addons-change", handleAddOnsUpdated);
      window.addEventListener("ecmd-addons-updated", handleAddOnsUpdated);
      window.addEventListener("storage", handleAddOnsUpdated);
    }
    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("ecmd-vehicle-change", handleVehicleChange);
        window.removeEventListener("ecmd-addons-change", handleAddOnsUpdated);
        window.removeEventListener("ecmd-addons-updated", handleAddOnsUpdated);
        window.removeEventListener("storage", handleAddOnsUpdated);
      }
    };
  }, []);

  const orderedLevels = useMemo(
    () => extractOrderedPackageLevels(servicePackages, levelOrder),
    [servicePackages, levelOrder]
  );

  // Build resolved card models (either 3-level matrix cards or legacy fallback cards)
  const resolvedCards = useMemo(() => {
    if (orderedLevels.length > 0) {
      return orderedLevels.map((level) => {
        const cardKey = `level:${level}`;
        const activeScope: PackageScopeKey = scopeByCardKey[cardKey] || "full";
        const detailType = scopeToDetailType(activeScope);
        const matchedRow = findMatchingServicePackage(
          servicePackages,
          { package_level: level, detail_type: detailType },
          activeVehicle
        );
        const ctx = buildPackageCardContext({
          level,
          activeScope,
          vehicleKey: activeVehicle,
          vehicleLabel: activeVehicleLabel,
          matchedRow,
          addOnsMap,
        });
        return {
          cardKey,
          ctx,
          legacyPkg: null as any,
        };
      });
    }

    return legacyPackages.map((pkg, index) => {
      const cardKey = `legacy:${pkg.id ?? index}`;
      const activeScope: PackageScopeKey =
        scopeByCardKey[cardKey] || detailTypeToScope(pkg.activeScope || pkg.default_scope);
      const level = pkg.package_level || pkg.title || `Package ${index + 1}`;
      const ctx = buildPackageCardContext({
        level,
        activeScope,
        vehicleKey: activeVehicle,
        vehicleLabel: activeVehicleLabel,
        matchedRow: pkg,
        addOnsMap,
      });
      return {
        cardKey,
        ctx,
        legacyPkg: { ...pkg, activeScope },
      };
    });
  }, [orderedLevels, servicePackages, legacyPackages, scopeByCardKey, activeVehicle, activeVehicleLabel, addOnsMap]);

  // Inject zero-specificity :where(...) root sizing defaults + auto-heal missing scope/CTA hooks
  // + live-paint each card's Wix-parity DOM nodes & brushed steel button selection states
  // across all breakpoints (desktop/tablet/mobile) BEFORE telemetry snapshots run.
  useIsomorphicLayoutEffect(() => {
    const root = containerRef.current;
    ensureEcmdRootSizingStyles(root?.ownerDocument);
    if (!root) return;

    const syncAllCards = () => {
      autoHealPackageScopeButtons(root);
      const cardEls = root.querySelectorAll<HTMLElement>(".ecmd-package-card[data-ecmd-card-key]");
      cardEls.forEach((cardEl) => {
        const key = cardEl.getAttribute("data-ecmd-card-key");
        const found = resolvedCards.find((c) => c.cardKey === key);
        if (found) {
          paintCardDomInPlace(cardEl, found.ctx);
        }
      });
    };

    syncAllCards();

    if (typeof MutationObserver === "undefined") return;
    let isInternalSync = false;
    const observer = new MutationObserver(() => {
      if (isInternalSync) return;
      isInternalSync = true;
      try {
        syncAllCards();
      } finally {
        isInternalSync = false;
      }
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-ecmd-scope-btn", "data-ecmd-action"],
    });
    return () => observer.disconnect();
  }, [
    resolvedCards,
    itemTemplate,
    mobileItemTemplate,
    isMobile,
    isTablet,
    viewportMode,
    useSeparateMobileTemplate,
  ]);

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
  }, [resolvedCards, itemTemplate, mobileItemTemplate, isMobile, useSeparateMobileTemplate]);

  const handleScopeChange = (cardKey: string, rawScope: string) => {
    const normalized = detailTypeToScope(rawScope);
    setScopeByCardKey((prev) => ({
      ...prev,
      [cardKey]: normalized,
    }));
  };

  const useTabletLayoutOverride =
    isTablet && Boolean(tabletOrientation && tabletOrientation !== "inherit");
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
    isMobile && useSeparateMobileTemplate && mobileItemTemplate
      ? mobileItemTemplate
      : primaryTemplate;
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

  const renderPackageCard = (
    card: { cardKey: string; ctx: EcmdPackageCardContext; legacyPkg: any },
    index: number
  ) => {
    const { cardKey, ctx, legacyPkg } = card;
    const pkgKey = ctx.id ?? index;
    const isInlineOpen = inlineExpandedPkgId === cardKey;

    // Transparent Per-Card Slot Wrapper: when a Package Card Template slot is provided,
    // keep the outer per-card wrapper free of themeGroup surface classes (e.g. ecmd-group-3 white box)
    // and stamp data-ecmd-slot-wrapper="transparent" so zero-specificity :where(...) rules keep
    // background: transparent, border: none, box-shadow: none, padding: 0 behind rounded user cards.
    const wrapperThemeClass =
      !hasCustomTemplate && themeGroup && themeGroup !== "none" ? themeGroup : "";

    const serializedContext = {
      pkg: legacyPkg
        ? legacyPkg
        : {
            ...(ctx.rawPackage || {}),
            id: ctx.id,
            title: ctx.title,
            package_level: ctx.level,
            detail_type: ctx.detailType,
            sub_category: ctx.subCategory,
            activeScope: ctx.activeScope,
          },
      ecmdPkg: ctx,
      activeVehicle,
      activeVehicleLabel,
      subCategory: ctx.subCategory,
      basePrice: ctx.basePrice,
      salePrice: ctx.salePrice,
      duration: ctx.duration,
      hasSale: ctx.hasSale,
      viewportMode,
    };

    return (
      <div
        key={cardKey}
        className={`${wrapperThemeClass} ecmd-package-card`.trim()}
        data-ecmd-card-key={cardKey}
        data-ecmd-package-level={ctx.level}
        data-ecmd-active-scope={ctx.activeScope}
        data-ecmd-slot-wrapper={hasCustomTemplate ? "transparent" : "default"}
        style={cardStyle}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const scopeBtn = target.closest("[data-ecmd-scope-btn]");
          if (scopeBtn) {
            const scope = scopeBtn.getAttribute("data-ecmd-scope-btn");
            if (scope) handleScopeChange(cardKey, scope);
            return;
          }

          const addToCartTrigger = target.closest(
            '[data-ecmd-action="add-to-cart"], [data-ecmd-pkg="add-to-cart-btn"]'
          );
          if (addToCartTrigger && typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("ecmd-add-to-cart", {
                detail: {
                  ecmdPkg: ctx,
                  pkgId: pkgKey,
                  activeVehicle,
                  activeVehicleLabel,
                },
              })
            );
          }

          const explicitAction = resolveBreakpointAction(target, viewportMode);
          const detailsTrigger = target.closest(
            '[data-ecmd-pkg="whats-included-btn"], [data-ecmd-action="open-whats-included"]'
          );
          const isWhatsIncludedAction =
            explicitAction === "open-whats-included" || Boolean(detailsTrigger);

          let handledByWhatsIncludedModal = false;
          if (isWhatsIncludedAction && typeof window !== "undefined") {
            const rawBase =
              Number(ctx.rawPackage?.price ?? Math.max(0, ctx.basePrice - ctx.addOnsTotal)) || 0;
            const rawSale =
              Number(
                ctx.rawPackage?.sale_price ??
                  ctx.rawPackage?.salePrice ??
                  (ctx.hasSale ? Math.max(0, ctx.salePrice - ctx.addOnsTotal) : 0)
              ) || 0;
            const calculatedBasePrice = rawSale > 0 && rawSale < rawBase ? rawSale : rawBase;
            const wiEvent = new CustomEvent("ecmd-open-whats-included", {
              cancelable: true,
              detail: {
                pkg: serializedContext.pkg,
                ecmdPkg: ctx,
                pkgId: pkgKey,
                calculatedPrice: calculatedBasePrice,
                totalPrice: ctx.effectivePrice,
                level: ctx.level,
                detailType: ctx.detailType,
                subCategory: ctx.subCategory,
                activeVehicle,
                activeVehicleLabel,
              },
            });
            window.dispatchEvent(wiEvent);
            handledByWhatsIncludedModal = wiEvent.defaultPrevented;
          }

          const resolvedAction =
            explicitAction && explicitAction !== "open-whats-included"
              ? explicitAction
              : isWhatsIncludedAction
              ? mapDetailsActionToCommand(effectiveDetailsAction)
              : null;

          if (resolvedAction && !handledByWhatsIncludedModal) {
            executeBreakpointAction(resolvedAction, {
              element: (detailsTrigger as HTMLElement | null) || target,
              viewportMode,
              isMobile,
              payload: {
                pkg: serializedContext.pkg,
                ecmdPkg: ctx,
                pkgId: pkgKey,
                activeVehicle,
                activeVehicleLabel,
                basePrice: ctx.basePrice,
                salePrice: ctx.salePrice,
                duration: ctx.duration,
              },
              onExpandInline: () =>
                setInlineExpandedPkgId((prev) => (prev === cardKey ? null : cardKey)),
              onOpenModal: () => setOverlayDetails({ mode: "modal", ctx }),
              onOpenDrawer: () => setOverlayDetails({ mode: "drawer", ctx }),
            });
          }
        }}
      >
        <div style={{ display: "none" }} data-ecmd-pkg="active-context">
          {JSON.stringify(serializedContext)}
        </div>
        <SafePlasmicDataProvider name="ecmdPkg" data={ctx}>
          {setControlContextData ? (
            <React.Fragment>{activeTemplate}</React.Fragment>
          ) : (
            activeTemplate
          )}
        </SafePlasmicDataProvider>
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
              <strong>
                {ctx.title} ({ctx.subCategory}) — What&apos;s Included
              </strong>
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
            <p style={{ marginTop: "6px", marginBottom: 0, opacity: 0.9 }}>{ctx.description}</p>
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
      {resolvedCards.length > 0 ? (
        resolvedCards.map((card, index) => renderPackageCard(card, index))
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
                {overlayDetails.ctx.title} ({overlayDetails.ctx.subCategory})
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
              {overlayDetails.ctx.description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
