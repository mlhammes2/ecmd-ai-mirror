import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { DataProvider } from "@plasmicapp/loader-react";
import { ensureEcmdRootSizingStyles } from "../lib/ecmdRootSizing";
import { useEcmdBreakpoint } from "../lib/useEcmdBreakpoint";
import {
  detailTypeToScope,
  formatPackagePrice,
  getAddOnMemoryKey,
  loadSavedAddOnsMap,
  mapSubCategoryToVehicleKey,
  mapVehicleKeyToSubCategory,
  normalizeToPackageSubCategory,
  scopeToDetailType,
  type EcmdPackageCardContext,
  type EcmdSavedAddOnItem,
  type EcmdServicePackageRow,
  type PackageDetailType,
  type PackageScopeKey,
  type PackageSubCategory,
} from "../lib/ecmdPackageMatcher";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export const CART_DRAFT_STORAGE_KEY = "ecmd_cart_draft";

export interface EcmdCartDraft {
  pkg?: EcmdServicePackageRow | Record<string, unknown> | null;
  pkgId?: number | string;
  title: string;
  level: string;
  detailType: PackageDetailType;
  activeScope: PackageScopeKey;
  subCategory: PackageSubCategory;
  vehicleKey: string;
  vehicleLabel: string;
  basePrice: number;
  salePrice: number;
  resolvedPackagePrice: number;
  addOns: EcmdSavedAddOnItem[];
  addOnsCount: number;
  addOnsTotal: number;
  totalPrice: number;
  totalPriceFormatted: string;
  source?: string;
  updatedAt: string;
}

export interface EcmdAddToCartEventDetail {
  pkg?: EcmdServicePackageRow | Record<string, unknown> | null;
  ecmdPkg?: Partial<EcmdPackageCardContext> | null;
  pkgId?: number | string;
  title?: string;
  level?: string;
  detailType?: string;
  activeScope?: string;
  subCategory?: string;
  vehicleKey?: string;
  vehicleLabel?: string;
  activeVehicle?: string;
  activeVehicleLabel?: string;
  basePrice?: number;
  salePrice?: number;
  resolvedPackagePrice?: number;
  addOns?: EcmdSavedAddOnItem[];
  addOnsCount?: number;
  addOnsTotal?: number;
  totalPrice?: number;
  totalPriceFormatted?: string;
  source?: string;
}

export interface EcmdCartSummaryBarContext {
  hasDraft: boolean;
  draft: EcmdCartDraft | null;
  packageTitle: string;
  level: string;
  detailType: PackageDetailType | "";
  subCategory: PackageSubCategory | "";
  vehicleLabel: string;
  addOnsCount: number;
  addOnsTotal: number;
  totalPrice: number;
  totalPriceFormatted: string;
}

export interface EcmdCartSummaryBarProps {
  className?: string;
  style?: React.CSSProperties;
  initialDraft?: EcmdCartDraft | null;
  hideWhenEmpty?: boolean;
  stickyBottom?: boolean;
  showClearButton?: boolean;
  emptyText?: string;
  editAddOnsLabel?: string;
  openSummaryLabel?: string;
  themeGroup?: string;
  buttonThemeGroup?: string;
  onOpenSummary?: (draft: EcmdCartDraft) => void;
  onCartChange?: (draft: EcmdCartDraft | null) => void;
}

function SafePlasmicDataProvider({
  name,
  data,
  children,
}: {
  name: string;
  data: unknown;
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

function toFiniteNonNegative(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const num = Number(val);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, num);
}

function sanitizeAddOnsList(raw: unknown): EcmdSavedAddOnItem[] {
  if (!Array.isArray(raw)) return [];
  const clean: EcmdSavedAddOnItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const item: EcmdSavedAddOnItem = {
      title: String(rec["title"] ?? "Add-On").trim() || "Add-On",
      price: toFiniteNonNegative(rec["price"]) ?? 0,
    };
    const rawId = rec["id"];
    if (typeof rawId === "number" || typeof rawId === "string") {
      item.id = rawId;
    }
    const rawUnderscoreId = rec["_id"];
    if (typeof rawUnderscoreId === "string" && rawUnderscoreId.trim()) {
      item._id = rawUnderscoreId.trim();
    }
    const rawWixId = rec["wix_id"];
    if (typeof rawWixId === "string" && rawWixId.trim()) {
      item.wix_id = rawWixId.trim();
    }
    clean.push(item);
  }
  return clean;
}

export function normalizeAddToCartPayload(raw: unknown): EcmdCartDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const detail = raw as EcmdAddToCartEventDetail & Record<string, unknown>;
  const pkg = (detail.pkg ?? detail.ecmdPkg?.rawPackage ?? null) as
    | (EcmdServicePackageRow & Record<string, unknown>)
    | null;
  const ecmdPkg = detail.ecmdPkg ?? null;

  const level = String(
    detail.level ??
      ecmdPkg?.level ??
      ecmdPkg?.packageLevel ??
      pkg?.package_level ??
      pkg?.packageLevel ??
      ""
  ).trim();

  const rawTitle = String(detail.title ?? ecmdPkg?.title ?? pkg?.title ?? "").trim();
  if (!level && !rawTitle && !pkg && !ecmdPkg) {
    return null;
  }

  const resolvedLevel = level || "Classic";
  const detailType = scopeToDetailType(
    detail.detailType ??
      detail.activeScope ??
      ecmdPkg?.detailType ??
      ecmdPkg?.activeScope ??
      pkg?.detail_type ??
      pkg?.detailType ??
      "Full"
  );
  const activeScope = detailTypeToScope(detailType);

  const rawSubCat = String(
    detail.subCategory ??
      ecmdPkg?.subCategory ??
      detail.vehicleKey ??
      detail.activeVehicle ??
      pkg?.sub_category ??
      pkg?.subCategory ??
      "Sm. SUV"
  ).trim();
  const subCategory = mapVehicleKeyToSubCategory(
    normalizeToPackageSubCategory(rawSubCat) || rawSubCat
  );
  const vehicleKey =
    mapSubCategoryToVehicleKey(detail.vehicleKey ?? detail.activeVehicle ?? subCategory) ||
    "sm-suv";
  const vehicleLabel =
    String(
      detail.vehicleLabel ??
        detail.activeVehicleLabel ??
        ecmdPkg?.vehicleLabel ??
        subCategory
    ).trim() || subCategory;

  const title =
    rawTitle ||
    (detailType === "Full"
      ? `Full ${resolvedLevel} Detail`
      : `${resolvedLevel} ${detailType} Detail`);

  const addOns = sanitizeAddOnsList(detail.addOns ?? ecmdPkg?.savedAddOns);
  const addOnsCount =
    addOns.length > 0
      ? addOns.length
      : Math.round(toFiniteNonNegative(detail.addOnsCount ?? ecmdPkg?.addOnsCount) ?? 0);
  const computedAddOnsTotal = addOns.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
  const addOnsTotal = toFiniteNonNegative(detail.addOnsTotal) ?? computedAddOnsTotal;

  const rawBasePrice =
    toFiniteNonNegative(detail.basePrice) ??
    toFiniteNonNegative(pkg?.price) ??
    (ecmdPkg?.basePrice != null ? Math.max(0, Number(ecmdPkg.basePrice) - addOnsTotal) : 0);

  const rawSalePrice =
    toFiniteNonNegative(detail.salePrice) ??
    toFiniteNonNegative(pkg?.sale_price ?? pkg?.salePrice) ??
    (ecmdPkg?.hasSale && ecmdPkg.salePrice != null
      ? Math.max(0, Number(ecmdPkg.salePrice) - addOnsTotal)
      : 0);

  const resolvedPackagePrice =
    toFiniteNonNegative(detail.resolvedPackagePrice) ??
    (rawSalePrice > 0 && rawSalePrice < rawBasePrice ? rawSalePrice : rawBasePrice);

  const totalPrice =
    toFiniteNonNegative(detail.totalPrice) ??
    toFiniteNonNegative(ecmdPkg?.effectivePrice) ??
    resolvedPackagePrice + addOnsTotal;

  const draft: EcmdCartDraft = {
    pkg,
    title,
    level: resolvedLevel,
    detailType,
    activeScope,
    subCategory,
    vehicleKey,
    vehicleLabel,
    basePrice: rawBasePrice,
    salePrice: rawSalePrice,
    resolvedPackagePrice,
    addOns,
    addOnsCount,
    addOnsTotal,
    totalPrice,
    totalPriceFormatted: formatPackagePrice(totalPrice),
    updatedAt:
      typeof detail["updatedAt"] === "string" && detail["updatedAt"].trim()
        ? detail["updatedAt"].trim()
        : new Date().toISOString(),
  };

  const resolvedPkgId = detail.pkgId ?? ecmdPkg?.id ?? pkg?.id ?? pkg?.wix_id;
  if (typeof resolvedPkgId === "number" || (typeof resolvedPkgId === "string" && resolvedPkgId)) {
    draft.pkgId = resolvedPkgId;
  }

  if (typeof detail.source === "string" && detail.source.trim()) {
    draft.source = detail.source.trim();
  }

  return draft;
}

export function loadCartDraft(): EcmdCartDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CART_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return normalizeAddToCartPayload(parsed);
  } catch {
    return null;
  }
}

export function saveCartDraft(draft: EcmdCartDraft | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!draft) {
      window.localStorage.removeItem(CART_DRAFT_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(CART_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Cross-origin iframe or storage quota restriction
  }
}

export function EcmdCartSummaryBar({
  className = "",
  style,
  initialDraft,
  hideWhenEmpty = false,
  stickyBottom = false,
  showClearButton = false,
  emptyText = "Select a detail package to build your booking",
  editAddOnsLabel = "Edit Add-Ons",
  openSummaryLabel = "Continue to Summary",
  themeGroup = "ecmd-group-1",
  buttonThemeGroup = "ecmd-group-2",
  onOpenSummary,
  onCartChange,
}: EcmdCartSummaryBarProps) {
  const [draft, setDraft] = useState<EcmdCartDraft | null>(() =>
    initialDraft ? normalizeAddToCartPayload(initialDraft) : null
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const onCartChangeRef = useRef(onCartChange);
  onCartChangeRef.current = onCartChange;

  const { viewportMode, isMobile } = useEcmdBreakpoint();

  useIsomorphicLayoutEffect(() => {
    ensureEcmdRootSizingStyles(rootRef.current?.ownerDocument);
  }, []);

  // Keep local state in sync when an explicit initialDraft prop changes
  useEffect(() => {
    if (initialDraft !== undefined) {
      setDraft(initialDraft ? normalizeAddToCartPayload(initialDraft) : null);
    }
  }, [initialDraft]);

  // Client-only hydration from localStorage + live window event listeners
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (initialDraft === undefined) {
      const stored = loadCartDraft();
      if (stored) {
        setDraft(stored);
      }
    }

    const handleAddToCart = (e: Event) => {
      const detail =
        e instanceof CustomEvent
          ? (e.detail as EcmdAddToCartEventDetail | undefined)
          : undefined;
      const normalized = normalizeAddToCartPayload(detail);
      if (!normalized) return;
      saveCartDraft(normalized);
      setDraft(normalized);
      if (onCartChangeRef.current) {
        onCartChangeRef.current(normalized);
      }
    };

    const handleAddOnsSync = () => {
      const addOnsMap = loadSavedAddOnsMap();
      setDraft((prev) => {
        if (!prev) return prev;
        const memKey = getAddOnMemoryKey(prev.level, prev.detailType);
        const nextAddOns = sanitizeAddOnsList(addOnsMap[memKey]);
        const nextAddOnsTotal = nextAddOns.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
        const nextTotal = prev.resolvedPackagePrice + nextAddOnsTotal;
        const updated: EcmdCartDraft = {
          ...prev,
          addOns: nextAddOns,
          addOnsCount: nextAddOns.length,
          addOnsTotal: nextAddOnsTotal,
          totalPrice: nextTotal,
          totalPriceFormatted: formatPackagePrice(nextTotal),
          updatedAt: new Date().toISOString(),
        };
        saveCartDraft(updated);
        if (onCartChangeRef.current) {
          onCartChangeRef.current(updated);
        }
        return updated;
      });
    };

    const handleCartClear = () => {
      saveCartDraft(null);
      setDraft(null);
      if (onCartChangeRef.current) {
        onCartChangeRef.current(null);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === CART_DRAFT_STORAGE_KEY || e.key === null) {
        setDraft(loadCartDraft());
      }
    };

    window.addEventListener("ecmd-add-to-cart", handleAddToCart);
    window.addEventListener("ecmd-addons-change", handleAddOnsSync);
    window.addEventListener("ecmd-addons-updated", handleAddOnsSync);
    window.addEventListener("ecmd-cart-clear", handleCartClear);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("ecmd-add-to-cart", handleAddToCart);
      window.removeEventListener("ecmd-addons-change", handleAddOnsSync);
      window.removeEventListener("ecmd-addons-updated", handleAddOnsSync);
      window.removeEventListener("ecmd-cart-clear", handleCartClear);
      window.removeEventListener("storage", handleStorage);
    };
  }, [initialDraft]);

  const handleEditAddOns = useCallback(() => {
    if (!draft || typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("ecmd-open-whats-included", {
        cancelable: true,
        detail: {
          pkg: draft.pkg ?? null,
          level: draft.level,
          detailType: draft.detailType,
          activeScope: draft.activeScope,
          subCategory: draft.subCategory,
          activeVehicle: draft.vehicleKey,
          activeVehicleLabel: draft.vehicleLabel,
          calculatedPrice: draft.resolvedPackagePrice,
          totalPrice: draft.totalPrice,
          source: "EcmdCartSummaryBar",
        },
      })
    );
  }, [draft]);

  const handleOpenSummary = useCallback(() => {
    if (!draft) return;
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ecmd-open-summary", {
          detail: { cart: draft },
        })
      );
    }
    if (onOpenSummary) {
      onOpenSummary(draft);
    }
  }, [draft, onOpenSummary]);

  const handleClear = useCallback(() => {
    saveCartDraft(null);
    setDraft(null);
    if (onCartChange) {
      onCartChange(null);
    }
  }, [onCartChange]);

  const providerData: EcmdCartSummaryBarContext = {
    hasDraft: Boolean(draft),
    draft,
    packageTitle: draft ? draft.title : "",
    level: draft ? draft.level : "",
    detailType: draft ? draft.detailType : "",
    subCategory: draft ? draft.subCategory : "",
    vehicleLabel: draft ? draft.vehicleLabel : "",
    addOnsCount: draft ? draft.addOnsCount : 0,
    addOnsTotal: draft ? draft.addOnsTotal : 0,
    totalPrice: draft ? draft.totalPrice : 0,
    totalPriceFormatted: draft ? draft.totalPriceFormatted : "$0",
  };

  const addOnsCountText = draft
    ? `${draft.addOnsCount} ${draft.addOnsCount === 1 ? "Add-On" : "Add-Ons"}${
        draft.addOnsTotal > 0 ? ` (+${formatPackagePrice(draft.addOnsTotal)})` : ""
      }`
    : "0 Add-Ons";

  const surfaceThemeClass = themeGroup && themeGroup !== "none" ? themeGroup : "";
  const primaryBtnThemeClass =
    buttonThemeGroup && buttonThemeGroup !== "none" ? buttonThemeGroup : "";

  // Zero-Inline-Width Root Law + exactOptionalPropertyTypes safety:
  // Never hardcode style={{ width: "100%" }} on the root element.
  const mergedRootStyle: React.CSSProperties | undefined = stickyBottom
    ? {
        position: "sticky",
        bottom: "12px",
        zIndex: 90,
        ...(style || {}),
      }
    : style
    ? { ...style }
    : undefined;

  const rootStyleProps = mergedRootStyle ? { style: mergedRootStyle } : {};

  if (hideWhenEmpty && !draft) {
    return (
      <SafePlasmicDataProvider name="ecmdCart" data={providerData}>
        <div
          ref={rootRef}
          className={`ecmd-cart-summary-bar-root ${className}`.trim()}
          data-ecmd-viewport={viewportMode}
          data-ecmd-cart="bar"
          data-ecmd-has-draft="false"
          {...rootStyleProps}
        />
      </SafePlasmicDataProvider>
    );
  }

  return (
    <SafePlasmicDataProvider name="ecmdCart" data={providerData}>
      <div
        ref={rootRef}
        className={`ecmd-cart-summary-bar-root ${surfaceThemeClass} ${className}`.trim()}
        data-ecmd-viewport={viewportMode}
        data-ecmd-cart="bar"
        data-ecmd-has-draft={draft ? "true" : "false"}
        {...rootStyleProps}
      >
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: "space-between",
            gap: isMobile ? "12px" : "16px",
            padding: isMobile ? "14px 16px" : "14px 20px",
            borderRadius: "14px",
            backgroundColor: "rgba(15, 23, 42, 0.92)",
            border: "1px solid rgba(84, 233, 234, 0.35)",
            boxShadow: "0 14px 36px rgba(2, 6, 23, 0.45)",
            color: "#F8FAFC",
            boxSizing: "border-box",
          }}
        >
          {/* Left: Readout summary */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: isMobile ? "8px 14px" : "10px 20px",
              flex: 1,
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#94A3B8",
                }}
              >
                Package
              </span>
              <span
                data-ecmd-cart="package"
                style={{
                  fontSize: "15px",
                  fontWeight: 800,
                  color: draft ? "#F8FAFC" : "#94A3B8",
                  lineHeight: 1.3,
                }}
              >
                {draft ? `${draft.title} (${draft.detailType})` : emptyText}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#94A3B8",
                }}
              >
                Vehicle
              </span>
              <span
                data-ecmd-cart="vehicle"
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: draft ? "#E2E8F0" : "#64748B",
                }}
              >
                {draft ? draft.vehicleLabel || draft.subCategory : "--"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#94A3B8",
                }}
              >
                Add-Ons
              </span>
              <span
                data-ecmd-cart="addons-count"
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: draft && draft.addOnsCount > 0 ? "#54E9EA" : "#CBD5E1",
                }}
              >
                {addOnsCountText}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#94A3B8",
                }}
              >
                Total
              </span>
              <span
                data-ecmd-cart="total"
                style={{
                  fontSize: "18px",
                  fontWeight: 800,
                  color: "#54E9EA",
                  lineHeight: 1.2,
                }}
              >
                {draft ? draft.totalPriceFormatted : "$0"}
              </span>
            </div>
          </div>

          {/* Right: Action buttons */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: isMobile ? "stretch" : "flex-end",
              gap: "10px",
              flexShrink: 0,
            }}
          >
            {showClearButton && draft && (
              <button
                type="button"
                data-ecmd-cart="clear"
                data-ecmd-action="clear-cart"
                onClick={handleClear}
                style={{
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  backgroundColor: "transparent",
                  color: "#94A3B8",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            )}

            <button
              type="button"
              data-ecmd-cart="edit-addons"
              data-ecmd-action="edit-addons"
              disabled={!draft}
              onClick={handleEditAddOns}
              style={{
                ...(isMobile ? { flex: 1 } : {}),
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(84, 233, 234, 0.4)",
                backgroundColor: "rgba(30, 41, 59, 0.85)",
                color: draft ? "#E2E8F0" : "#64748B",
                fontSize: "13px",
                fontWeight: 700,
                cursor: draft ? "pointer" : "not-allowed",
                opacity: draft ? 1 : 0.6,
              }}
            >
              {editAddOnsLabel}
            </button>

            <button
              type="button"
              className={primaryBtnThemeClass}
              data-ecmd-cart="open-summary"
              data-ecmd-action="open-summary"
              disabled={!draft}
              onClick={handleOpenSummary}
              style={{
                ...(isMobile ? { flex: 1 } : {}),
                padding: "10px 18px",
                borderRadius: "8px",
                border: "1px solid rgba(84, 233, 234, 0.6)",
                backgroundColor: draft ? "#0EA5E9" : "rgba(51, 65, 85, 0.7)",
                color: draft ? "#FFFFFF" : "#94A3B8",
                fontSize: "14px",
                fontWeight: 800,
                cursor: draft ? "pointer" : "not-allowed",
                opacity: draft ? 1 : 0.6,
              }}
            >
              {openSummaryLabel}
            </button>
          </div>
        </div>
      </div>
    </SafePlasmicDataProvider>
  );
}
