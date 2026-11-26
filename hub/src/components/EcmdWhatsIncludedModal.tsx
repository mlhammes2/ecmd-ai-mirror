import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { DataProvider } from "@plasmicapp/loader-react";
import { carbonQuery } from "../integrations/supabase/client";
import { ensureEcmdRootSizingStyles } from "../lib/ecmdRootSizing";
import { useEcmdBreakpoint } from "../lib/useEcmdBreakpoint";
import {
  DEFAULT_PACKAGE_LEVEL_ORDER,
  detailTypeToScope,
  findMatchingServicePackage,
  formatPackagePrice,
  getAddOnMemoryKey,
  loadSavedAddOnsMap,
  mapSubCategoryToVehicleKey,
  mapVehicleKeyToSubCategory,
  normalizeToPackageSubCategory,
  parsePackageLevelOrder,
  saveAddOnsMemoryMap,
  scopeToDetailType,
  type EcmdAddOnsMemoryMap,
  type EcmdPackageCardContext,
  type EcmdSavedAddOnItem,
  type EcmdServicePackageRow,
  type PackageDetailType,
  type PackageSubCategory,
} from "../lib/ecmdPackageMatcher";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type WhatsIncludedAddOnTab = "Interior" | "Exterior";

export interface EcmdWhatsIncludedRow {
  id?: number | string;
  _id?: string | null;
  wix_id?: string | null;
  title?: string | null;
  button_title?: string | null;
  buttonTitle?: string | null;
  add_on_title?: string | null;
  addOnTitle?: string | null;
  description?: string | null;
  detail_type?: string | string[] | null;
  detailType?: string | string[] | null;
  package_level?: string | string[] | null;
  packageLevel?: string | string[] | null;
  whats_included?: string | string[] | null;
  whatsIncluded?: string | string[] | null;
  price?: number | string | null;
  notice?: string | null;
  sort?: number | string | null;
  enabled?: boolean | null;
  slug_id?: string | null;
  intro?: string | null;
  overview?: string | null;
  [key: string]: any;
}

export interface EcmdSubscriptionEstimate {
  id: "sub_bi" | "sub_mo" | "sub_qu";
  frequency: "bi-weekly" | "monthly" | "quarterly";
  title: "Bi-Weekly" | "Monthly" | "Quarterly";
  discountPercent: number;
  price: number;
  priceFormatted: string;
}

export interface EcmdWhatsIncludedOpenDetail {
  pkg?: EcmdServicePackageRow | Record<string, any> | null;
  ecmdPkg?: Partial<EcmdPackageCardContext> | null;
  calculatedPrice?: number;
  totalPrice?: number;
  level?: string;
  detailType?: string;
  subCategory?: string;
  activeVehicle?: string;
  activeVehicleLabel?: string;
}

export interface EcmdWhatsIncludedAddToCartPayload {
  pkg: EcmdServicePackageRow | null;
  level: string;
  detailType: PackageDetailType;
  activeScope: ReturnType<typeof detailTypeToScope>;
  subCategory: PackageSubCategory;
  vehicleKey: string;
  title: string;
  basePrice: number;
  salePrice: number;
  resolvedPackagePrice: number;
  addOns: EcmdSavedAddOnItem[];
  addOnsTotal: number;
  totalPrice: number;
  totalPriceFormatted: string;
  source: "EcmdWhatsIncludedModal";
}

export interface EcmdWhatsIncludedContext {
  isOpen: boolean;
  level: string;
  detailType: PackageDetailType;
  subCategory: PackageSubCategory;
  vehicleKey: string;
  title: string;
  interiorDescription: string;
  exteriorDescription: string;
  basePrice: number;
  salePrice: number;
  resolvedPackagePrice: number;
  addOnsTotal: number;
  totalPrice: number;
  totalPriceFormatted: string;
  selectedAddOns: EcmdSavedAddOnItem[];
  selectedAddOnsCount: number;
  activeAddOnTab: WhatsIncludedAddOnTab;
  showInteriorSection: boolean;
  showExteriorSection: boolean;
  interiorItems: EcmdWhatsIncludedRow[];
  exteriorItems: EcmdWhatsIncludedRow[];
  availableAddOns: EcmdWhatsIncludedRow[];
  notices: string;
  subscriptions: EcmdSubscriptionEstimate[];
  activePackage: EcmdServicePackageRow | null;
}

export interface EcmdWhatsIncludedModalProps {
  className?: string;
  style?: React.CSSProperties;
  isOpen?: boolean;
  defaultOpen?: boolean;
  defaultLevel?: string;
  defaultDetailType?: PackageDetailType;
  defaultSubCategory?: PackageSubCategory;
  levelOrder?: string;
  whatsIncludedItems?: EcmdWhatsIncludedRow[];
  servicePackages?: EcmdServicePackageRow[];
  autoLoadFromSupabase?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  closeOnAddToCart?: boolean;
  inlinePreviewInStudio?: boolean;
  themeGroup?: string;
  buttonThemeGroup?: string;
  onClose?: () => void;
  onLevelChange?: (level: string, detail: { detailType: PackageDetailType; subCategory: PackageSubCategory }) => void;
  onAddOnsChange?: (detail: {
    level: string;
    detailType: PackageDetailType;
    memoryKey: string;
    selectedAddOns: EcmdSavedAddOnItem[];
    addOnsTotal: number;
  }) => void;
  onAddToCart?: (payload: EcmdWhatsIncludedAddToCartPayload) => void;
}

export const DEFAULT_INTERIOR_SUMMARY =
  "Interior detailing includes full wipe down and vacuuming.";
export const DEFAULT_EXTERIOR_SUMMARY =
  "Exterior detailing includes hand wash, wax, and tire shine.";

export const FALLBACK_WHATS_INCLUDED_ITEMS: EcmdWhatsIncludedRow[] = [
  {
    id: 1,
    wix_id: "wi-door-jams",
    title: "Door Jam Cleaning:",
    button_title: "Door Jam Cleaning",
    add_on_title: "Door Jam Cleaning",
    detail_type: '["Interior"]',
    package_level: '["All"]',
    whats_included: '["Classic","Premium","Luxury"]',
    price: 20,
    notice: "",
    sort: 1,
    enabled: true,
  },
  {
    id: 2,
    wix_id: "wi-vacuum",
    title: "Full Interior & Trunk Vacuuming:",
    button_title: "Complete Vacuum",
    add_on_title: "Complete Vacuum",
    detail_type: '["Interior"]',
    package_level: '["All"]',
    whats_included: '["Classic","Premium","Luxury"]',
    price: 40,
    notice: "",
    sort: 2,
    enabled: true,
  },
  {
    id: 3,
    wix_id: "wi-spot-shampoo",
    title: "Seats/Carpets - Spot Shampooed:",
    button_title: "Spot Shampoo",
    add_on_title: "Spot Shampoo",
    detail_type: '["Interior"]',
    package_level: '["All"]',
    whats_included: '["Classic"]',
    price: 40,
    notice:
      "Spot shampoo is not a complete interior shampoo. It includes up to 3 softball size spots. Upgrade to Premium for complete shampoo.",
    sort: 3,
    enabled: true,
  },
  {
    id: 4,
    wix_id: "wi-complete-shampoo",
    title: "Complete Interior Shampoo:",
    button_title: "Complete Int. Shampoo",
    add_on_title: "Complete Interior Shampoo",
    detail_type: '["Interior"]',
    package_level: '["Classic","All"]',
    whats_included: '["Premium","Luxury"]',
    price: 70,
    notice: "",
    sort: 4,
    enabled: true,
  },
  {
    id: 5,
    wix_id: "wi-leather-condition",
    title: "Leather Deep Clean & Conditioning:",
    button_title: "Leather Clean/Condition",
    add_on_title: "Leather Clean/Condition",
    detail_type: '["Interior"]',
    package_level: '["Classic","All"]',
    whats_included: '["Premium","Luxury"]',
    price: 40,
    notice: "",
    sort: 10,
    enabled: true,
  },
  {
    id: 6,
    wix_id: "wi-odor-removal",
    title: "Odor Removal:",
    button_title: "Odor Removal",
    add_on_title: "Odor Removal",
    detail_type: '["Interior"]',
    package_level: '["Premium","Classic","All"]',
    whats_included: '["Luxury"]',
    price: 30,
    notice: "",
    sort: 13,
    enabled: true,
  },
  {
    id: 7,
    wix_id: "wi-hand-wash",
    title: "Hand Wash, Rinse, & Bug Removal:",
    button_title: "Hand Wash/Bug Removal",
    add_on_title: "Hand Wash/Bug Removal",
    detail_type: '["Exterior"]',
    package_level: '["All"]',
    whats_included: '["Classic","Premium","Luxury"]',
    price: 30,
    notice: "",
    sort: 15,
    enabled: true,
  },
  {
    id: 8,
    wix_id: "wi-headlight-restoration",
    title: "Headlight Restoration:",
    button_title: "Headlight Restoration",
    add_on_title: "Headlight Restoration",
    detail_type: '["Exterior"]',
    package_level: '["Classic","All"]',
    whats_included: '["Premium","Luxury"]',
    price: 30,
    notice: "",
    sort: 20,
    enabled: true,
  },
  {
    id: 9,
    wix_id: "wi-clay-bar",
    title: "Nano Clay Bar Decontamination:",
    button_title: "Nano Claybar Decon.",
    add_on_title: "Nano Claybar Decon",
    detail_type: '["Exterior"]',
    package_level: '["Classic","Premium","All"]',
    whats_included: '["Luxury"]',
    price: 40,
    notice: "",
    sort: 23,
    enabled: true,
  },
  {
    id: 10,
    wix_id: "wi-ceramic-coating",
    title: "2-3 Year Ceramic Coating:",
    button_title: "2-3 Year Ceramic Coating",
    add_on_title: "2-3 Year Ceramic Coating",
    detail_type: '["Exterior"]',
    package_level: '["Premium","Classic","All"]',
    whats_included: '["Luxury"]',
    price: 150,
    notice: "",
    sort: 30,
    enabled: true,
  },
];

export const FALLBACK_SERVICE_PACKAGES: EcmdServicePackageRow[] = [
  {
    id: 1,
    wix_id: "fallback-classic-full",
    title: "Full Classic Detail",
    package_level: "Classic",
    detail_type: "Full",
    sub_category: "Sm. SUV",
    price: 179,
    sale_price: 0,
    bi_weekly_percent: 20,
    monthly_percent: 15,
    quarterly_percent: 10,
    sort_order: 11,
    enabled: true,
  },
  {
    id: 2,
    wix_id: "fallback-premium-full",
    title: "Full Premium Detail",
    package_level: "Premium",
    detail_type: "Full",
    sub_category: "Sm. SUV",
    price: 299,
    sale_price: 149,
    bi_weekly_percent: 20,
    monthly_percent: 15,
    quarterly_percent: 10,
    sort_order: 21,
    enabled: true,
  },
  {
    id: 3,
    wix_id: "fallback-luxury-full",
    title: "Full Luxury Detail",
    package_level: "Luxury",
    detail_type: "Full",
    sub_category: "Sm. SUV",
    price: 399,
    sale_price: 0,
    bi_weekly_percent: 20,
    monthly_percent: 15,
    quarterly_percent: 10,
    sort_order: 31,
    enabled: true,
  },
];

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

/**
 * Normalizes a Supabase JSON-array text field (e.g. '["Classic","Premium"]'),
 * native array, or plain string into a lowercase token array for Wix-parity matching.
 */
export function parseWhatsIncludedTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v ?? "").trim()).filter(Boolean);
  }
  const str = String(raw ?? "").trim();
  if (!str) return [];
  if (str.startsWith("[") && str.endsWith("]")) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v ?? "").trim()).filter(Boolean);
      }
    } catch {
      // Fallback to string split below
    }
  }
  return str
    .split(",")
    .map((s) => s.replace(/^["'\s]+|["'\s]+$/g, "").trim())
    .filter(Boolean);
}

export function tagsInclude(raw: unknown, needle: string): boolean {
  const target = String(needle || "")
    .trim()
    .toLowerCase();
  if (!target) return false;
  const tags = parseWhatsIncludedTags(raw);
  if (tags.length > 0) {
    return tags.some((t) => t.toLowerCase() === target || t.toLowerCase().includes(target));
  }
  return String(raw ?? "")
    .toLowerCase()
    .includes(target);
}

export function getWhatsIncludedRowId(row: EcmdWhatsIncludedRow | EcmdSavedAddOnItem): string {
  return String(
    (row as any).wix_id ?? (row as any)._id ?? (row as any).id ?? (row as any).title ?? ""
  ).trim();
}

export function getWhatsIncludedDisplayLabel(row: EcmdWhatsIncludedRow): string {
  const raw = String(
    row.button_title ?? row.buttonTitle ?? row.add_on_title ?? row.addOnTitle ?? row.title ?? "Item"
  ).trim();
  return raw.replace(/:+$/, "").trim() || "Item";
}

export function getAddOnDisplayLabel(row: EcmdWhatsIncludedRow): string {
  const raw = String(
    row.add_on_title ?? row.addOnTitle ?? row.button_title ?? row.buttonTitle ?? row.title ?? "Add-On"
  ).trim();
  return raw.replace(/:+$/, "").trim() || "Add-On";
}

function compareWhatsIncludedRows(a: EcmdWhatsIncludedRow, b: EcmdWhatsIncludedRow): number {
  const numA = Number(a.sort);
  const numB = Number(b.sort);
  if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) {
    return numA - numB;
  }
  return String(a.sort ?? "").localeCompare(String(b.sort ?? ""));
}

/**
 * Resolves the effective base/sale price of a package row (matching Wix `fileWhatsIncluded.js`).
 */
export function resolvePackageBasePrice(
  pkg?: EcmdServicePackageRow | null,
  explicitCalculatedPrice?: number | null
): { basePrice: number; salePrice: number; resolvedPrice: number } {
  const rawBase = Number(pkg?.price ?? 0) || 0;
  const rawSale = Number(pkg?.sale_price ?? pkg?.salePrice ?? 0) || 0;
  if (rawBase > 0 || rawSale > 0) {
    const resolvedPrice = rawSale > 0 && rawSale < rawBase ? rawSale : rawBase;
    return { basePrice: rawBase, salePrice: rawSale, resolvedPrice };
  }
  const fallback = Number(explicitCalculatedPrice ?? 0) || 0;
  return { basePrice: fallback, salePrice: 0, resolvedPrice: fallback };
}

/**
 * Computes Wix-parity subscription estimate tiers (Bi-Weekly 20%, Monthly 15%, Quarterly 10%).
 */
export function computeSubscriptionEstimates(
  resolvedPrice: number,
  pkg?: EcmdServicePackageRow | null
): EcmdSubscriptionEstimate[] {
  const safeBase = Number.isFinite(resolvedPrice) ? Math.max(0, resolvedPrice) : 0;
  const biPct = Number(pkg?.bi_weekly_percent ?? pkg?.biWeeklyPercent ?? 20) || 20;
  const moPct = Number(pkg?.monthly_percent ?? pkg?.monthlyPercent ?? 15) || 15;
  const quPct = Number(pkg?.quarterly_percent ?? pkg?.quarterlyPercent ?? 10) || 10;

  const biPrice = safeBase - safeBase * (biPct / 100);
  const moPrice = safeBase - safeBase * (moPct / 100);
  const quPrice = safeBase - safeBase * (quPct / 100);

  return [
    {
      id: "sub_bi",
      frequency: "bi-weekly",
      title: "Bi-Weekly",
      discountPercent: biPct,
      price: biPrice,
      priceFormatted: `$${biPrice.toFixed(2)}`,
    },
    {
      id: "sub_mo",
      frequency: "monthly",
      title: "Monthly",
      discountPercent: moPct,
      price: moPrice,
      priceFormatted: `$${moPrice.toFixed(2)}`,
    },
    {
      id: "sub_qu",
      frequency: "quarterly",
      title: "Quarterly",
      discountPercent: quPct,
      price: quPrice,
      priceFormatted: `$${quPrice.toFixed(2)}`,
    },
  ];
}

/**
 * Wix `fileWhatsIncluded.js` parity: splits `ecmd_whats_included` rows into Interior & Exterior
 * inclusion lists for the selected `level`, plus combined notice text for the active `detailType`.
 */
export function buildWhatsIncludedLists(
  items: EcmdWhatsIncludedRow[],
  level: string,
  detailType: PackageDetailType
): {
  interiorItems: EcmdWhatsIncludedRow[];
  exteriorItems: EcmdWhatsIncludedRow[];
  notices: string;
} {
  const safeLevel = String(level || "Classic").trim();
  const inclusions = (Array.isArray(items) ? items : []).filter(
    (item) => item && item.enabled !== false && tagsInclude(item.whats_included ?? item.whatsIncluded, safeLevel)
  );

  const interiorItems = inclusions
    .filter((i) => tagsInclude(i.detail_type ?? i.detailType, "Interior"))
    .sort(compareWhatsIncludedRows);
  const exteriorItems = inclusions
    .filter((i) => tagsInclude(i.detail_type ?? i.detailType, "Exterior"))
    .sort(compareWhatsIncludedRows);

  const activeInclusions =
    detailType === "Interior"
      ? interiorItems
      : detailType === "Exterior"
      ? exteriorItems
      : [...interiorItems, ...exteriorItems];

  const seenNotices = new Set<string>();
  const noticeList: string[] = [];
  for (const item of activeInclusions) {
    const trimmed = String(item.notice || "").trim();
    if (trimmed && !seenNotices.has(trimmed)) {
      seenNotices.add(trimmed);
      noticeList.push(trimmed);
    }
  }

  return {
    interiorItems,
    exteriorItems,
    notices: noticeList.join("\n\n"),
  };
}

/**
 * Wix `fileWhatsIncluded.js` parity: filters available add-ons for the active `level`, `detailType`,
 * and `activeTab` (`"Interior"` | `"Exterior"`).
 */
export function filterAvailableAddOns(
  items: EcmdWhatsIncludedRow[],
  level: string,
  detailType: PackageDetailType,
  activeTab: WhatsIncludedAddOnTab
): EcmdWhatsIncludedRow[] {
  let targetTag = String(level || "Classic").trim();
  if (
    (detailType === "Interior" && activeTab === "Exterior") ||
    (detailType === "Exterior" && activeTab === "Interior")
  ) {
    targetTag = "All";
  }

  return (Array.isArray(items) ? items : [])
    .filter((item) => {
      if (!item || item.enabled === false) return false;
      const matchesDetail = tagsInclude(item.detail_type ?? item.detailType, activeTab);
      const matchesLevel = tagsInclude(item.package_level ?? item.packageLevel, targetTag);
      return matchesDetail && matchesLevel;
    })
    .sort(compareWhatsIncludedRows);
}

/**
 * Wix `fileWhatsIncluded.js` parity: defaults to `"Exterior"` when exterior add-ons exist for the
 * active package, otherwise `"Interior"`.
 */
export function resolveDefaultAddOnTab(
  items: EcmdWhatsIncludedRow[],
  level: string,
  detailType: PackageDetailType
): WhatsIncludedAddOnTab {
  const exteriorMatches = filterAvailableAddOns(items, level, detailType, "Exterior");
  return exteriorMatches.length > 0 ? "Exterior" : "Interior";
}

function toSavedAddOnItem(row: EcmdWhatsIncludedRow): EcmdSavedAddOnItem {
  const id = getWhatsIncludedRowId(row);
  return {
    id: row.id ?? id,
    _id: row._id ?? row.wix_id ?? id,
    ...(row.wix_id != null ? { wix_id: row.wix_id } : {}),
    title: getAddOnDisplayLabel(row),
    price: Number(row.price || 0) || 0,
  };
}

export function EcmdWhatsIncludedModal({
  className = "",
  style,
  isOpen: controlledIsOpen,
  defaultOpen = false,
  defaultLevel = "Classic",
  defaultDetailType = "Full",
  defaultSubCategory = "Sm. SUV",
  levelOrder = "Classic,Premium,Luxury",
  whatsIncludedItems: itemsProp,
  servicePackages: packagesProp,
  autoLoadFromSupabase = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  closeOnAddToCart = true,
  inlinePreviewInStudio = false,
  themeGroup = "ecmd-group-3",
  buttonThemeGroup = "ecmd-group-2",
  onClose,
  onLevelChange,
  onAddOnsChange,
  onAddToCart,
}: EcmdWhatsIncludedModalProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState<boolean>(Boolean(defaultOpen));
  const [loadedItems, setLoadedItems] = useState<EcmdWhatsIncludedRow[]>(() =>
    Array.isArray(itemsProp) && itemsProp.length > 0 ? itemsProp : FALLBACK_WHATS_INCLUDED_ITEMS
  );
  const [loadedPackages, setLoadedPackages] = useState<EcmdServicePackageRow[]>(() =>
    Array.isArray(packagesProp) && packagesProp.length > 0
      ? packagesProp
      : FALLBACK_SERVICE_PACKAGES
  );
  const [activeLevel, setActiveLevel] = useState<string>(defaultLevel || "Classic");
  const [activeDetailType, setActiveDetailType] = useState<PackageDetailType>(
    scopeToDetailType(defaultDetailType)
  );
  const [activeSubCategory, setActiveSubCategory] = useState<PackageSubCategory>(
    mapVehicleKeyToSubCategory(defaultSubCategory)
  );
  const [explicitPackage, setExplicitPackage] = useState<EcmdServicePackageRow | null>(null);
  const [explicitCalculatedPrice, setExplicitCalculatedPrice] = useState<number | null>(null);
  const [activeAddOnTab, setActiveAddOnTab] = useState<WhatsIncludedAddOnTab>("Exterior");
  const [addOnsMap, setAddOnsMap] = useState<EcmdAddOnsMemoryMap>({});
  const [expandedDetailItemId, setExpandedDetailItemId] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<EcmdWhatsIncludedRow[]>(loadedItems);
  itemsRef.current = loadedItems;

  const { viewportMode, isMobile } = useEcmdBreakpoint();
  const isModalOpen = controlledIsOpen !== undefined ? Boolean(controlledIsOpen) : uncontrolledOpen;

  useIsomorphicLayoutEffect(() => {
    ensureEcmdRootSizingStyles(rootRef.current?.ownerDocument);
  }, []);

  // Keep local state in sync when explicit props are provided
  useEffect(() => {
    if (Array.isArray(itemsProp) && itemsProp.length > 0) {
      setLoadedItems(itemsProp);
    }
  }, [itemsProp]);

  useEffect(() => {
    if (Array.isArray(packagesProp) && packagesProp.length > 0) {
      setLoadedPackages(packagesProp);
    }
  }, [packagesProp]);

  // Load `public.ecmd_whats_included` & `public.ecmd_service_packages` from Supabase (SSR-safe)
  useEffect(() => {
    if (!autoLoadFromSupabase) return;
    let cancelled = false;

    const loadData = async () => {
      if (!Array.isArray(itemsProp) || itemsProp.length === 0) {
        try {
          const wiRows = await carbonQuery<EcmdWhatsIncludedRow>(
            "SELECT * FROM public.ecmd_whats_included WHERE enabled = true ORDER BY sort ASC, id ASC"
          );
          if (!cancelled && Array.isArray(wiRows) && wiRows.length > 0) {
            setLoadedItems(wiRows);
          }
        } catch {
          // Retain clean fallback rows when offline
        }
      }

      if (!Array.isArray(packagesProp) || packagesProp.length === 0) {
        try {
          const pkgRows = await carbonQuery<EcmdServicePackageRow>(
            "SELECT * FROM public.ecmd_service_packages WHERE enabled = true ORDER BY sort_order ASC, id ASC"
          );
          if (!cancelled && Array.isArray(pkgRows) && pkgRows.length > 0) {
            setLoadedPackages(pkgRows);
          }
        } catch {
          // Retain clean fallback packages when offline
        }
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [autoLoadFromSupabase, itemsProp, packagesProp]);

  // Hydrate add-ons memory from localStorage on client mount & stay synced across events
  useEffect(() => {
    if (typeof window === "undefined") return;
    setAddOnsMap(loadSavedAddOnsMap());

    const syncAddOnsFromStorage = () => {
      setAddOnsMap(loadSavedAddOnsMap());
    };

    window.addEventListener("ecmd-addons-change", syncAddOnsFromStorage);
    window.addEventListener("ecmd-addons-updated", syncAddOnsFromStorage);
    window.addEventListener("storage", syncAddOnsFromStorage);
    return () => {
      window.removeEventListener("ecmd-addons-change", syncAddOnsFromStorage);
      window.removeEventListener("ecmd-addons-updated", syncAddOnsFromStorage);
      window.removeEventListener("storage", syncAddOnsFromStorage);
    };
  }, []);

  const handleClose = useCallback(() => {
    setExpandedDetailItemId(null);
    if (controlledIsOpen === undefined) {
      setUncontrolledOpen(false);
    }
    if (onClose) {
      onClose();
    }
  }, [controlledIsOpen, onClose]);

  // Listen for `ecmd-open-whats-included` window events from EcmdPackagesRepeater or external buttons
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOpenEvent = (e: Event) => {
      const ce = e as CustomEvent<EcmdWhatsIncludedOpenDetail>;
      // Signal to EcmdPackagesRepeater that EcmdWhatsIncludedModal is handling the popup
      if (ce.cancelable) {
        ce.preventDefault();
      }

      const detail = ce.detail || {};
      const pkg = (detail.pkg || detail.ecmdPkg?.rawPackage || null) as EcmdServicePackageRow | null;
      const ecmdPkg = detail.ecmdPkg || null;

      const resolvedLevel = String(
        detail.level ||
          ecmdPkg?.level ||
          ecmdPkg?.packageLevel ||
          pkg?.package_level ||
          pkg?.packageLevel ||
          "Classic"
      ).trim();

      const resolvedDetailType = scopeToDetailType(
        detail.detailType ||
          ecmdPkg?.detailType ||
          ecmdPkg?.activeScope ||
          pkg?.detail_type ||
          pkg?.detailType ||
          "Full"
      );

      const rawSubCat =
        detail.subCategory ||
        ecmdPkg?.subCategory ||
        detail.activeVehicle ||
        pkg?.sub_category ||
        pkg?.subCategory ||
        "Sm. SUV";
      const resolvedSubCat = mapVehicleKeyToSubCategory(
        normalizeToPackageSubCategory(rawSubCat) || rawSubCat
      );

      setActiveLevel(resolvedLevel);
      setActiveDetailType(resolvedDetailType);
      setActiveSubCategory(resolvedSubCat);
      setExplicitPackage(pkg);
      setExplicitCalculatedPrice(
        detail.calculatedPrice != null && Number.isFinite(Number(detail.calculatedPrice))
          ? Number(detail.calculatedPrice)
          : null
      );
      setAddOnsMap(loadSavedAddOnsMap());
      setExpandedDetailItemId(null);
      setActiveAddOnTab(
        resolveDefaultAddOnTab(itemsRef.current, resolvedLevel, resolvedDetailType)
      );

      if (controlledIsOpen === undefined) {
        setUncontrolledOpen(true);
      }
    };

    window.addEventListener("ecmd-open-whats-included", handleOpenEvent);
    return () => {
      window.removeEventListener("ecmd-open-whats-included", handleOpenEvent);
    };
  }, [controlledIsOpen]);

  // Escape key close handler
  useEffect(() => {
    if (!isModalOpen || !closeOnEscape || typeof document === "undefined") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isModalOpen, closeOnEscape, handleClose]);

  const orderedLevels = useMemo(() => {
    const parsed = parsePackageLevelOrder(levelOrder);
    return parsed.length > 0 ? parsed : [...DEFAULT_PACKAGE_LEVEL_ORDER];
  }, [levelOrder]);

  // Resolve the active package row from loaded matrix (or explicit opened package)
  const activePackage = useMemo<EcmdServicePackageRow | null>(() => {
    const matchedFromMatrix = findMatchingServicePackage(
      loadedPackages,
      { package_level: activeLevel, detail_type: activeDetailType },
      activeSubCategory
    );
    if (matchedFromMatrix) {
      // If explicitPackage matches the same level/type/subCategory and has richer fields, merge cleanly
      if (
        explicitPackage &&
        String(explicitPackage.package_level ?? explicitPackage.packageLevel ?? "")
          .trim()
          .toLowerCase() === activeLevel.toLowerCase() &&
        scopeToDetailType(
          String(explicitPackage.detail_type ?? explicitPackage.detailType ?? activeDetailType)
        ) === activeDetailType
      ) {
        return { ...matchedFromMatrix, ...explicitPackage };
      }
      return matchedFromMatrix;
    }
    return explicitPackage;
  }, [loadedPackages, activeLevel, activeDetailType, activeSubCategory, explicitPackage]);

  const { basePrice, salePrice, resolvedPrice: resolvedPackagePrice } = useMemo(
    () => resolvePackageBasePrice(activePackage, explicitCalculatedPrice),
    [activePackage, explicitCalculatedPrice]
  );

  const memoryKey = useMemo(
    () => getAddOnMemoryKey(activeLevel, activeDetailType),
    [activeLevel, activeDetailType]
  );

  const selectedAddOns = useMemo<EcmdSavedAddOnItem[]>(
    () => (Array.isArray(addOnsMap[memoryKey]) ? addOnsMap[memoryKey] : []),
    [addOnsMap, memoryKey]
  );

  const addOnsTotal = useMemo(
    () => selectedAddOns.reduce((sum, item) => sum + (Number(item?.price) || 0), 0),
    [selectedAddOns]
  );

  const totalPrice = resolvedPackagePrice + addOnsTotal;
  const totalPriceFormatted = `$${totalPrice.toFixed(2)}`;

  const { interiorItems, exteriorItems, notices } = useMemo(
    () => buildWhatsIncludedLists(loadedItems, activeLevel, activeDetailType),
    [loadedItems, activeLevel, activeDetailType]
  );

  const availableAddOns = useMemo(
    () => filterAvailableAddOns(loadedItems, activeLevel, activeDetailType, activeAddOnTab),
    [loadedItems, activeLevel, activeDetailType, activeAddOnTab]
  );

  const subscriptions = useMemo(
    () => computeSubscriptionEstimates(resolvedPackagePrice, activePackage),
    [resolvedPackagePrice, activePackage]
  );

  const showInteriorSection = activeDetailType === "Full" || activeDetailType === "Interior";
  const showExteriorSection = activeDetailType === "Full" || activeDetailType === "Exterior";

  const interiorDescription =
    String(
      activePackage?.interior_description ?? activePackage?.interiorDescription ?? ""
    ).trim() || DEFAULT_INTERIOR_SUMMARY;
  const exteriorDescription =
    String(
      activePackage?.exterior_description ?? activePackage?.exteriorDescription ?? ""
    ).trim() || DEFAULT_EXTERIOR_SUMMARY;

  const packageTitle =
    String(activePackage?.title || "").trim() ||
    (activeDetailType === "Full"
      ? `Full ${activeLevel} Detail`
      : `${activeLevel} ${activeDetailType} Detail`);

  const activeVehicleKey = mapSubCategoryToVehicleKey(activeSubCategory) || "sm-suv";

  const handleLevelSwitch = useCallback(
    (nextLevel: string) => {
      const normalized = String(nextLevel || "").trim();
      if (!normalized) return;
      setActiveLevel(normalized);
      // Clear stale explicit override from previous level so matrix row takes over cleanly
      setExplicitPackage(null);
      setExplicitCalculatedPrice(null);
      setExpandedDetailItemId(null);
      setAddOnsMap(loadSavedAddOnsMap());
      setActiveAddOnTab(resolveDefaultAddOnTab(loadedItems, normalized, activeDetailType));

      if (onLevelChange) {
        onLevelChange(normalized, {
          detailType: activeDetailType,
          subCategory: activeSubCategory,
        });
      }
    },
    [loadedItems, activeDetailType, activeSubCategory, onLevelChange]
  );

  const handleToggleAddOn = useCallback(
    (row: EcmdWhatsIncludedRow) => {
      const targetId = getWhatsIncludedRowId(row);
      const currentMap = loadSavedAddOnsMap();
      const existing = Array.isArray(currentMap[memoryKey]) ? currentMap[memoryKey] : [];
      const alreadyChecked = existing.some((a) => getWhatsIncludedRowId(a) === targetId);

      const nextList: EcmdSavedAddOnItem[] = alreadyChecked
        ? existing.filter((a) => getWhatsIncludedRowId(a) !== targetId)
        : [...existing, toSavedAddOnItem(row)];

      const nextMap: EcmdAddOnsMemoryMap = {
        ...currentMap,
        [memoryKey]: nextList,
      };

      saveAddOnsMemoryMap(nextMap);
      setAddOnsMap(nextMap);

      const nextAddOnsTotal = nextList.reduce((sum, a) => sum + (Number(a?.price) || 0), 0);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("ecmd-addons-change", {
            detail: {
              level: activeLevel,
              detailType: activeDetailType,
              memoryKey,
              selectedAddOns: nextList,
              addOnsMap: nextMap,
              addOnsTotal: nextAddOnsTotal,
              source: "EcmdWhatsIncludedModal",
            },
          })
        );
      }

      if (onAddOnsChange) {
        onAddOnsChange({
          level: activeLevel,
          detailType: activeDetailType,
          memoryKey,
          selectedAddOns: nextList,
          addOnsTotal: nextAddOnsTotal,
        });
      }
    },
    [memoryKey, activeLevel, activeDetailType, onAddOnsChange]
  );

  const handleAddToCart = useCallback(() => {
    const payload: EcmdWhatsIncludedAddToCartPayload = {
      pkg: activePackage,
      level: activeLevel,
      detailType: activeDetailType,
      activeScope: detailTypeToScope(activeDetailType),
      subCategory: activeSubCategory,
      vehicleKey: activeVehicleKey,
      title: packageTitle,
      basePrice,
      salePrice,
      resolvedPackagePrice,
      addOns: selectedAddOns,
      addOnsTotal,
      totalPrice,
      totalPriceFormatted,
      source: "EcmdWhatsIncludedModal",
    };

    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem("ecmd_return_breadcrumb", "whatsIncludedLightboxState");
      } catch {
        // Storage restriction
      }
      window.dispatchEvent(
        new CustomEvent("ecmd-add-to-cart", {
          detail: {
            ...payload,
            activeVehicle: activeVehicleKey,
            activeVehicleLabel: activeSubCategory,
          },
        })
      );
    }

    if (onAddToCart) {
      onAddToCart(payload);
    }

    if (closeOnAddToCart) {
      handleClose();
    }
  }, [
    activePackage,
    activeLevel,
    activeDetailType,
    activeSubCategory,
    activeVehicleKey,
    packageTitle,
    basePrice,
    salePrice,
    resolvedPackagePrice,
    selectedAddOns,
    addOnsTotal,
    totalPrice,
    totalPriceFormatted,
    onAddToCart,
    closeOnAddToCart,
    handleClose,
  ]);

  const providerData: EcmdWhatsIncludedContext = {
    isOpen: isModalOpen,
    level: activeLevel,
    detailType: activeDetailType,
    subCategory: activeSubCategory,
    vehicleKey: activeVehicleKey,
    title: packageTitle,
    interiorDescription,
    exteriorDescription,
    basePrice,
    salePrice,
    resolvedPackagePrice,
    addOnsTotal,
    totalPrice,
    totalPriceFormatted,
    selectedAddOns,
    selectedAddOnsCount: selectedAddOns.length,
    activeAddOnTab,
    showInteriorSection,
    showExteriorSection,
    interiorItems,
    exteriorItems,
    availableAddOns,
    notices,
    subscriptions,
    activePackage,
  };

  // Zero-Inline-Width Root Law: NEVER hardcode inline width: "100%" on root.
  // Default width lives in zero-specificity :where(.ecmd-whats-included-modal-root) CSS.
  const rootStyle: React.CSSProperties | undefined = style ? { ...style } : undefined;
  const cardThemeClass = themeGroup && themeGroup !== "none" ? themeGroup : "";
  const primaryBtnThemeClass = buttonThemeGroup && buttonThemeGroup !== "none" ? buttonThemeGroup : "";

  const modalCard = (
    <div
      id="whatsIncludedLightbox"
      data-ecmd-wi="dialog-card"
      role="dialog"
      aria-modal={!inlinePreviewInStudio}
      aria-label={`${packageTitle} — What's Included`}
      className={`${cardThemeClass} ecmd-whats-included-card`.trim()}
      onClick={(e) => e.stopPropagation()}
      style={{
        width: inlinePreviewInStudio ? "100%" : "min(860px, 100%)",
        maxHeight: inlinePreviewInStudio ? undefined : "90vh",
        overflowY: inlinePreviewInStudio ? undefined : "auto",
        backgroundColor: "#0F172A",
        color: "#F8FAFC",
        border: "1px solid rgba(84, 233, 234, 0.35)",
        borderRadius: isMobile && !inlinePreviewInStudio ? "16px 16px 0 0" : "16px",
        padding: isMobile ? "18px" : "24px",
        boxShadow: "0 24px 64px rgba(2, 6, 23, 0.72)",
        boxSizing: "border-box",
      }}
    >
      {/* Header + Top Level Switcher */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          paddingBottom: "14px",
          borderBottom: "1px solid rgba(148, 163, 184, 0.2)",
        }}
      >
        <div>
          <div
            data-ecmd-wi="subtitle"
            style={{
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#54E9EA",
              marginBottom: "4px",
            }}
          >
            What&apos;s Included • {activeDetailType} • {activeSubCategory}
          </div>
          <h2
            data-ecmd-wi="title"
            style={{ margin: 0, fontSize: isMobile ? "20px" : "24px", fontWeight: 800 }}
          >
            {packageTitle}
          </h2>
        </div>

        <button
          type="button"
          data-ecmd-wi="close-btn"
          data-ecmd-action="close-whats-included"
          aria-label="Close What's Included"
          onClick={handleClose}
          style={{
            background: "rgba(148, 163, 184, 0.14)",
            border: "1px solid rgba(148, 163, 184, 0.3)",
            borderRadius: "8px",
            color: "#E2E8F0",
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 700,
          }}
        >
          ✕
        </button>
      </div>

      {/* Level Switcher Bar (Classic / Premium / Luxury) */}
      <div
        id="whatsIncludedRep"
        data-ecmd-wi="level-bar"
        role="tablist"
        aria-label="Package Levels"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          marginTop: "14px",
          marginBottom: "16px",
        }}
      >
        {orderedLevels.map((lvl) => {
          const isActive = lvl.toLowerCase() === activeLevel.toLowerCase();
          return (
            <button
              key={lvl}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-pressed={isActive}
              data-ecmd-wi="level-btn"
              data-ecmd-level={lvl}
              data-ecmd-action={`switch-wi-level-${lvl.toLowerCase()}`}
              data-ecmd-selected={isActive ? "true" : "false"}
              onClick={() => handleLevelSwitch(lvl)}
              style={{
                flex: "1 1 110px",
                padding: "10px 14px",
                borderRadius: "10px",
                border: isActive
                  ? "1px solid #54E9EA"
                  : "1px solid rgba(148, 163, 184, 0.25)",
                backgroundColor: isActive
                  ? "rgba(84, 233, 234, 0.16)"
                  : "rgba(30, 41, 59, 0.7)",
                color: isActive ? "#54E9EA" : "#CBD5E1",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {lvl}
            </button>
          );
        })}
      </div>

      {/* Subscription Estimates (Bi-Weekly / Monthly / Quarterly) */}
      <div
        id="repSubscriptions"
        data-ecmd-wi="subscriptions"
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
          gap: "10px",
          marginBottom: "18px",
        }}
      >
        {subscriptions.map((sub) => (
          <div
            key={sub.id}
            data-ecmd-wi="subscription-item"
            data-ecmd-subscription-frequency={sub.frequency}
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              backgroundColor: "rgba(15, 23, 42, 0.72)",
              border: "1px solid rgba(20, 184, 166, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#E2E8F0" }}>
                {sub.title}:
              </div>
              <div style={{ fontSize: "11px", color: "#5EEAD4" }}>
                Save {sub.discountPercent}%
              </div>
            </div>
            <div
              data-ecmd-wi={`subscription-price-${sub.frequency}`}
              style={{ fontSize: "16px", fontWeight: 800, color: "#10B981" }}
            >
              {sub.priceFormatted}
            </div>
          </div>
        ))}
      </div>

      {/* Interior & Exterior Inclusion Lists */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            !isMobile && showInteriorSection && showExteriorSection
              ? "repeat(2, minmax(0, 1fr))"
              : "1fr",
          gap: "14px",
          marginBottom: "16px",
        }}
      >
        {/* Interior Section */}
        <section
          id="interiorFlexItem"
          data-ecmd-wi="interior-section"
          data-ecmd-expanded={showInteriorSection ? "true" : "false"}
          hidden={!showInteriorSection}
          style={{
            padding: "14px",
            borderRadius: "12px",
            backgroundColor: "rgba(30, 41, 59, 0.55)",
            border: "1px solid rgba(148, 163, 184, 0.2)",
          }}
        >
          <h3 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 700, color: "#54E9EA" }}>
            Interior Included ({interiorItems.length})
          </h3>
          <p
            id="interiorText"
            data-ecmd-wi="interior-summary"
            style={{ margin: "0 0 10px", fontSize: "12px", color: "#94A3B8", lineHeight: 1.45 }}
          >
            {interiorDescription}
          </p>
          <ul
            id="repFullInterior"
            data-ecmd-wi="interior-list"
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {interiorItems.map((item) => {
              const rowId = getWhatsIncludedRowId(item);
              const label = getWhatsIncludedDisplayLabel(item);
              const isExpanded = expandedDetailItemId === rowId;
              const detailCopy = String(item.description || "").trim();
              return (
                <li key={rowId} data-ecmd-wi="interior-item">
                  <button
                    type="button"
                    data-ecmd-action="toggle-wi-inclusion-info"
                    aria-expanded={detailCopy ? isExpanded : undefined}
                    onClick={() =>
                      setExpandedDetailItemId((prev) => (prev === rowId ? null : rowId))
                    }
                    style={{
                      width: "100%",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      padding: "7px 10px",
                      borderRadius: "8px",
                      border: "1px solid rgba(148, 163, 184, 0.16)",
                      backgroundColor: "rgba(15, 23, 42, 0.65)",
                      color: "#F1F5F9",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <span>✓ {label}</span>
                    {detailCopy && (
                      <span style={{ fontSize: "11px", color: "#94A3B8" }}>
                        {isExpanded ? "▴" : "▾"}
                      </span>
                    )}
                  </button>
                  {isExpanded && detailCopy && (
                    <div
                      style={{
                        marginTop: "4px",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        backgroundColor: "rgba(2, 6, 23, 0.65)",
                        fontSize: "12px",
                        color: "#CBD5E1",
                        lineHeight: 1.45,
                      }}
                    >
                      {detailCopy}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Exterior Section */}
        <section
          id="exteriorFlexItem"
          data-ecmd-wi="exterior-section"
          data-ecmd-expanded={showExteriorSection ? "true" : "false"}
          hidden={!showExteriorSection}
          style={{
            padding: "14px",
            borderRadius: "12px",
            backgroundColor: "rgba(30, 41, 59, 0.55)",
            border: "1px solid rgba(148, 163, 184, 0.2)",
          }}
        >
          <h3 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 700, color: "#54E9EA" }}>
            Exterior Included ({exteriorItems.length})
          </h3>
          <p
            id="exteriorText"
            data-ecmd-wi="exterior-summary"
            style={{ margin: "0 0 10px", fontSize: "12px", color: "#94A3B8", lineHeight: 1.45 }}
          >
            {exteriorDescription}
          </p>
          <ul
            id="repFullExterior"
            data-ecmd-wi="exterior-list"
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            {exteriorItems.map((item) => {
              const rowId = getWhatsIncludedRowId(item);
              const label = getWhatsIncludedDisplayLabel(item);
              const isExpanded = expandedDetailItemId === rowId;
              const detailCopy = String(item.description || "").trim();
              return (
                <li key={rowId} data-ecmd-wi="exterior-item">
                  <button
                    type="button"
                    data-ecmd-action="toggle-wi-inclusion-info"
                    aria-expanded={detailCopy ? isExpanded : undefined}
                    onClick={() =>
                      setExpandedDetailItemId((prev) => (prev === rowId ? null : rowId))
                    }
                    style={{
                      width: "100%",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      padding: "7px 10px",
                      borderRadius: "8px",
                      border: "1px solid rgba(148, 163, 184, 0.16)",
                      backgroundColor: "rgba(15, 23, 42, 0.65)",
                      color: "#F1F5F9",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <span>✓ {label}</span>
                    {detailCopy && (
                      <span style={{ fontSize: "11px", color: "#94A3B8" }}>
                        {isExpanded ? "▴" : "▾"}
                      </span>
                    )}
                  </button>
                  {isExpanded && detailCopy && (
                    <div
                      style={{
                        marginTop: "4px",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        backgroundColor: "rgba(2, 6, 23, 0.65)",
                        fontSize: "12px",
                        color: "#CBD5E1",
                        lineHeight: 1.45,
                      }}
                    >
                      {detailCopy}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Notice Banner (shown only when active inclusions carry a notice) */}
      {notices && (
        <div
          id="noticeWhatsIncluded"
          data-ecmd-wi="notice"
          role="note"
          style={{
            marginBottom: "16px",
            padding: "10px 14px",
            borderRadius: "10px",
            backgroundColor: "rgba(245, 158, 11, 0.14)",
            border: "1px solid rgba(245, 158, 11, 0.45)",
            color: "#FDE68A",
            fontSize: "13px",
            lineHeight: 1.5,
            whiteSpace: "pre-line",
          }}
        >
          {notices}
        </div>
      )}

      {/* Optional Add-Ons Section with Interior / Exterior Filter Tabs */}
      <div
        data-ecmd-wi="addons-section"
        style={{
          padding: "14px",
          borderRadius: "12px",
          backgroundColor: "rgba(15, 23, 42, 0.72)",
          border: "1px solid rgba(148, 163, 184, 0.22)",
          marginBottom: "18px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            marginBottom: "12px",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#F8FAFC" }}>
              Optional Add-Ons ({selectedAddOns.length} selected)
            </h3>
            <div style={{ fontSize: "12px", color: "#94A3B8" }}>
              Saved for {activeLevel} ({activeDetailType})
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              id="buttonAi"
              type="button"
              data-ecmd-wi="tab-interior"
              data-ecmd-action="wi-addon-tab-interior"
              data-ecmd-selected={activeAddOnTab === "Interior" ? "true" : "false"}
              aria-pressed={activeAddOnTab === "Interior"}
              onClick={() => setActiveAddOnTab("Interior")}
              style={{
                padding: "7px 14px",
                borderRadius: "8px",
                border:
                  activeAddOnTab === "Interior"
                    ? "1px solid #54E9EA"
                    : "1px solid rgba(148, 163, 184, 0.25)",
                backgroundColor:
                  activeAddOnTab === "Interior"
                    ? "rgba(84, 233, 234, 0.16)"
                    : "rgba(30, 41, 59, 0.65)",
                color: activeAddOnTab === "Interior" ? "#54E9EA" : "#CBD5E1",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Interior
            </button>
            <button
              id="buttonAe"
              type="button"
              data-ecmd-wi="tab-exterior"
              data-ecmd-action="wi-addon-tab-exterior"
              data-ecmd-selected={activeAddOnTab === "Exterior" ? "true" : "false"}
              aria-pressed={activeAddOnTab === "Exterior"}
              onClick={() => setActiveAddOnTab("Exterior")}
              style={{
                padding: "7px 14px",
                borderRadius: "8px",
                border:
                  activeAddOnTab === "Exterior"
                    ? "1px solid #54E9EA"
                    : "1px solid rgba(148, 163, 184, 0.25)",
                backgroundColor:
                  activeAddOnTab === "Exterior"
                    ? "rgba(84, 233, 234, 0.16)"
                    : "rgba(30, 41, 59, 0.65)",
                color: activeAddOnTab === "Exterior" ? "#54E9EA" : "#CBD5E1",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Exterior
            </button>
          </div>
        </div>

        {availableAddOns.length === 0 ? (
          <div
            id="textAddOnLuxury"
            data-ecmd-wi="addons-empty"
            style={{
              padding: "12px",
              borderRadius: "8px",
              backgroundColor: "rgba(30, 41, 59, 0.45)",
              color: "#94A3B8",
              fontSize: "13px",
              textAlign: "center",
            }}
          >
            There are currently no Add-Ons for the &apos;{activeLevel || "Selected"}&apos; Package.
          </div>
        ) : (
          <div
            id="repAdd"
            data-ecmd-wi="addons-list"
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))",
              gap: "8px",
            }}
          >
            {availableAddOns.map((addon) => {
              const rowId = getWhatsIncludedRowId(addon);
              const isSelected = selectedAddOns.some((a) => getWhatsIncludedRowId(a) === rowId);
              const addonLabel = getAddOnDisplayLabel(addon);
              const addonPrice = Number(addon.price || 0) || 0;
              return (
                <button
                  key={rowId}
                  type="button"
                  data-ecmd-wi="addon-item"
                  data-ecmd-addon-id={rowId}
                  data-ecmd-action="toggle-wi-addon"
                  data-ecmd-selected={isSelected ? "true" : "false"}
                  aria-pressed={isSelected}
                  onClick={() => handleToggleAddOn(addon)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: isSelected
                      ? "1px solid #10B981"
                      : "1px solid rgba(148, 163, 184, 0.22)",
                    backgroundColor: isSelected
                      ? "rgba(16, 185, 129, 0.16)"
                      : "rgba(30, 41, 59, 0.65)",
                    color: "#F8FAFC",
                    fontSize: "13px",
                    fontWeight: isSelected ? 700 : 500,
                    cursor: "pointer",
                    textAlign: "left",
                    boxSizing: "border-box",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "5px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: 800,
                        backgroundColor: isSelected ? "#10B981" : "transparent",
                        border: isSelected
                          ? "1px solid #10B981"
                          : "1px solid rgba(148, 163, 184, 0.45)",
                        color: "#022C22",
                        flexShrink: 0,
                      }}
                    >
                      {isSelected ? "✓" : ""}
                    </span>
                    <span>{addonLabel}</span>
                  </span>
                  <span style={{ fontWeight: 700, color: "#54E9EA", flexShrink: 0 }}>
                    +${addonPrice.toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer: Live Total Price & Add to Cart */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          paddingTop: "14px",
          borderTop: "1px solid rgba(148, 163, 184, 0.2)",
        }}
      >
        <div>
          <div style={{ fontSize: "12px", color: "#94A3B8" }}>
            Package ({formatPackagePrice(resolvedPackagePrice)})
            {addOnsTotal > 0 ? ` + Add-Ons (${formatPackagePrice(addOnsTotal)})` : ""}
          </div>
          <div
            id="whatsIncludedTotalPrice"
            data-ecmd-wi="total-price"
            style={{ fontSize: "26px", fontWeight: 800, color: "#10B981", lineHeight: 1.15 }}
          >
            {totalPriceFormatted}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            data-ecmd-wi="cancel-btn"
            data-ecmd-action="close-whats-included"
            onClick={handleClose}
            style={{
              padding: "11px 16px",
              borderRadius: "10px",
              border: "1px solid rgba(148, 163, 184, 0.3)",
              backgroundColor: "transparent",
              color: "#CBD5E1",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Close
          </button>
          <button
            id="whatsIncludedAddCart"
            type="button"
            className={`${primaryBtnThemeClass} ecmd-whats-included-add-cart`.trim()}
            data-ecmd-wi="add-to-cart"
            data-ecmd-action="wi-add-to-cart"
            onClick={handleAddToCart}
            style={{
              padding: "11px 22px",
              borderRadius: "10px",
              border: "1px solid #14B8A6",
              backgroundColor: "#0EA5E9",
              color: "#FFFFFF",
              fontSize: "15px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Add to Cart • {totalPriceFormatted}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <SafePlasmicDataProvider name="ecmdWhatsIncluded" data={providerData}>
      <div
        ref={rootRef}
        className={`ecmd-whats-included-modal-root ${className}`.trim()}
        data-ecmd-viewport={viewportMode}
        data-ecmd-wi="root"
        data-ecmd-open={isModalOpen ? "true" : "false"}
        data-ecmd-level={activeLevel}
        data-ecmd-detail-type={activeDetailType}
        data-ecmd-sub-category={activeSubCategory}
        style={rootStyle}
      >
        {isModalOpen &&
          (inlinePreviewInStudio ? (
            modalCard
          ) : (
            <div
              data-ecmd-wi="backdrop"
              onClick={closeOnBackdropClick ? handleClose : undefined}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                backgroundColor: "rgba(2, 6, 23, 0.78)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: isMobile ? "flex-end" : "center",
                justifyContent: "center",
                padding: isMobile ? "0px" : "20px",
                boxSizing: "border-box",
              }}
            >
              {modalCard}
            </div>
          ))}
      </div>
    </SafePlasmicDataProvider>
  );
}
