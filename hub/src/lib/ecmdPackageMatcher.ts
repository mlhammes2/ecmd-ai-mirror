/**
 * ECMD Package Matcher — Wix `public/packageMatcher.js` + `packagesEngine.js` parity engine.
 * Normalizes vehicle keys/labels to the 4 CMS subCategories ("Sedan" | "Truck" | "Sm. SUV" | "Lg. SUV"),
 * matches the exact row in `public.ecmd_service_packages` (36-combination 3x3x4 matrix),
 * and builds the `$ctx.ecmdPkg` DataProvider context for Plasmic Studio bindings.
 */

export type PackageLevelName = "Classic" | "Premium" | "Luxury" | (string & {});
export type PackageDetailType = "Full" | "Interior" | "Exterior";
export type PackageScopeKey = "full" | "interior" | "exterior";
export type PackageSubCategory = "Sedan" | "Truck" | "Sm. SUV" | "Lg. SUV";

export interface EcmdServicePackageRow {
  id?: number | string;
  wix_id?: string | null;
  _id?: string | null;
  title?: string | null;
  sub_title?: string | null;
  subTitle?: string | null;
  package_level?: string | null;
  packageLevel?: string | null;
  detail_type?: string | null;
  detailType?: string | null;
  sub_category?: string | null;
  subCategory?: string | null;
  service_category?: string | null;
  serviceCategory?: string | null;
  price?: number | string | null;
  sale_price?: number | string | null;
  salePrice?: number | string | null;
  discount_percent?: number | string | null;
  discountPercent?: number | string | null;
  sale_title?: string | null;
  saleTitle?: string | null;
  mobile_fee?: number | string | null;
  mobileFee?: number | string | null;
  duration?: number | string | null;
  description?: string | null;
  desc?: string | null;
  interior_description?: string | null;
  interiorDescription?: string | null;
  exterior_description?: string | null;
  exteriorDescription?: string | null;
  main_display_image?: string | null;
  image?: string | null;
  hero_image_url?: string | null;
  bi_weekly_percent?: number | string | null;
  biWeeklyPercent?: number | string | null;
  monthly_percent?: number | string | null;
  monthlyPercent?: number | string | null;
  quarterly_percent?: number | string | null;
  quarterlyPercent?: number | string | null;
  sort_order?: number | string | null;
  sort?: number | string | null;
  enabled?: boolean | null;
  updated_at?: string | null;
  // Legacy ecmd_packages fields (graceful fallback)
  slug?: string | null;
  default_scope?: string | null;
  pricing_matrix?: {
    basePrice?: number;
    salePrice?: number;
    duration?: number | string;
    multipliers?: Record<string, number>;
  } | null;
  addons_count?: number | null;
  review_count?: string | number | null;
  review_score?: string | number | null;
  badge_image_url?: string | null;
}

export interface EcmdSavedAddOnItem {
  id?: number | string;
  _id?: string;
  wix_id?: string;
  title?: string;
  price?: number;
}

export type EcmdAddOnsMemoryMap = Record<string, EcmdSavedAddOnItem[]>;

export interface EcmdPackageCardContext {
  id: number | string;
  wixId: string;
  title: string;
  level: string;
  packageLevel: string;
  detailType: PackageDetailType;
  activeScope: PackageScopeKey;
  subCategory: PackageSubCategory;
  vehicleKey: string;
  vehicleLabel: string;
  price: number;
  basePrice: number;
  salePrice: number;
  effectivePrice: number;
  addOnsTotal: number;
  addOnsCount: number;
  savedAddOns: EcmdSavedAddOnItem[];
  hasSale: boolean;
  saleTitle: string;
  discountPercent: number;
  mobileFee: number;
  priceFormatted: string;
  basePriceFormatted: string;
  salePriceFormatted: string;
  duration: number;
  durationText: string;
  description: string;
  interiorDescription: string;
  exteriorDescription: string;
  mainDisplayImage: string;
  biWeeklyPercent: number;
  monthlyPercent: number;
  quarterlyPercent: number;
  biWeeklyPrice: number;
  monthlyPrice: number;
  quarterlyPrice: number;
  biWeeklyPriceFormatted: string;
  monthlyPriceFormatted: string;
  quarterlyPriceFormatted: string;
  rawPackage: EcmdServicePackageRow | null;
}

export const DEFAULT_PACKAGE_LEVEL_ORDER = ["Classic", "Premium", "Luxury"] as const;

export const ADDON_MEMORY_STORAGE_KEY = "ecmd_addOnMemory";
export const ADDON_MEMORY_TTL_MS = 86_400_000; // 24 hours (matches Wix packagesEngine.js)

/**
 * Normalizes any vehicleType string (from customerVehicles, vehicleCategories, or UI buttons)
 * into the exact subCategory stored in `public.ecmd_service_packages`:
 * "Sedan" | "Truck" | "Sm. SUV" | "Lg. SUV"
 */
export function normalizeToPackageSubCategory(rawVehicleType?: string | null): string | null {
  const t = String(rawVehicleType || "")
    .trim()
    .toLowerCase();
  if (!t) return null;

  if (
    t === "lg. suv" ||
    t === "lg suv" ||
    t === "lgsuv" ||
    t === "lg-suv" ||
    t.includes("3rd") ||
    t.includes("3 row") ||
    t.includes("three row") ||
    t.includes("large") ||
    t.includes("lg") ||
    t.includes("xl") ||
    t.includes("minivan") ||
    t.includes("van") ||
    t.includes("full size suv")
  ) {
    return "Lg. SUV";
  }

  if (
    t === "sm. suv" ||
    t === "sm suv" ||
    t === "smsuv" ||
    t === "sm-suv" ||
    t.includes("small") ||
    t.includes("sm") ||
    t.includes("2 row") ||
    t.includes("midsize suv") ||
    t.includes("compact suv") ||
    t.includes("crossover") ||
    t.includes("suv")
  ) {
    return "Sm. SUV";
  }

  if (t.includes("truck") || t.includes("pickup")) {
    return "Truck";
  }

  if (
    t.includes("sedan") ||
    t.includes("car") ||
    t.includes("coupe") ||
    t.includes("compact")
  ) {
    return "Sedan";
  }

  return String(rawVehicleType).trim();
}

/**
 * Maps an ECMD UI vehicleKey ("coupe", "car", "truck", "sm-suv", "lg-suv", etc.)
 * into one of the 4 canonical `ecmd_service_packages.sub_category` values.
 */
export function mapVehicleKeyToSubCategory(vehicleKey?: string | null): PackageSubCategory {
  const normalized = normalizeToPackageSubCategory(vehicleKey);
  if (normalized === "Truck") return "Truck";
  if (normalized === "Sm. SUV") return "Sm. SUV";
  if (normalized === "Lg. SUV") return "Lg. SUV";
  return "Sedan";
}

export function scopeToDetailType(scope?: string | null): PackageDetailType {
  const s = String(scope || "")
    .trim()
    .toLowerCase();
  if (s === "interior" || s.includes("interior")) return "Interior";
  if (s === "exterior" || s.includes("exterior")) return "Exterior";
  return "Full";
}

export function detailTypeToScope(detailType?: string | null): PackageScopeKey {
  const d = String(detailType || "")
    .trim()
    .toLowerCase();
  if (d === "interior" || d.includes("interior")) return "interior";
  if (d === "exterior" || d.includes("exterior")) return "exterior";
  return "full";
}

/**
 * Extracts packageLevel ("Classic" | "Premium" | "Luxury") and
 * detailType ("Full" | "Interior" | "Exterior") from a package, draft, or job object.
 */
export function extractLevelAndType(item: Record<string, any> = {}): {
  level: string;
  type: PackageDetailType;
} {
  const titleLower = String(item["packageTitle"] || item["title"] || "").toLowerCase();

  let level = String(item["level"] || item["packageLevel"] || item["package_level"] || "").trim();
  if (!level || level === "N/A") {
    if (titleLower.includes("luxury")) level = "Luxury";
    else if (titleLower.includes("premium")) level = "Premium";
    else level = "Classic";
  }

  let rawType = String(
    item["type"] ||
      item["detailType"] ||
      item["detail_type"] ||
      item["activeScope"] ||
      item["default_scope"] ||
      ""
  ).trim();
  if (!rawType || rawType === "N/A") {
    if (titleLower.includes("interior")) rawType = "Interior";
    else if (titleLower.includes("exterior")) rawType = "Exterior";
    else rawType = "Full";
  }

  return { level, type: scopeToDetailType(rawType) };
}

/**
 * Finds the exact `ecmd_service_packages` CMS row matching:
 * - package_level / packageLevel (Classic / Premium / Luxury)
 * - detail_type / detailType (Full / Interior / Exterior)
 * - sub_category / subCategory (Sedan / Truck / Sm. SUV / Lg. SUV)
 */
export function findMatchingServicePackage<T extends Record<string, any>>(
  packages: T[] = [],
  itemOrPkg: Record<string, any> = {},
  rawVehicleType: string | null = ""
): T | null {
  if (!Array.isArray(packages) || packages.length === 0) return null;

  const targetSubCat = normalizeToPackageSubCategory(
    rawVehicleType ||
      itemOrPkg["subCategory"] ||
      itemOrPkg["sub_category"] ||
      itemOrPkg["vehicleType"] ||
      itemOrPkg["vehicleSize"] ||
      ""
  );
  const { level, type } = extractLevelAndType(itemOrPkg);

  const getRowLevel = (p: T) =>
    String(p["package_level"] ?? p["packageLevel"] ?? "").trim().toLowerCase();
  const getRowType = (p: T) =>
    scopeToDetailType(String(p["detail_type"] ?? p["detailType"] ?? "")).toLowerCase();
  const getRowSubCat = (p: T) =>
    normalizeToPackageSubCategory(String(p["sub_category"] ?? p["subCategory"] ?? ""));

  let matched: T | null = null;
  if (targetSubCat) {
    matched =
      packages.find(
        (p) =>
          getRowLevel(p) === level.toLowerCase() &&
          getRowType(p) === type.toLowerCase() &&
          getRowSubCat(p) === targetSubCat
      ) || null;
  }

  if (!matched) {
    matched =
      packages.find(
        (p) => getRowLevel(p) === level.toLowerCase() && getRowType(p) === type.toLowerCase()
      ) || null;
  }

  return matched;
}

export function parsePackageLevelOrder(levelOrder?: string | null): string[] {
  const parts = String(levelOrder || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [...DEFAULT_PACKAGE_LEVEL_ORDER];
}

/**
 * Groups `ecmd_service_packages` rows into ordered unique package levels
 * (default: ["Classic", "Premium", "Luxury"]) using `levelOrder` then `sort_order`.
 */
export function extractOrderedPackageLevels(
  packages: EcmdServicePackageRow[],
  levelOrder = "Classic,Premium,Luxury"
): string[] {
  if (!Array.isArray(packages) || packages.length === 0) return [];
  const preferredOrder = parsePackageLevelOrder(levelOrder);
  const preferredMap = new Map<string, number>();
  preferredOrder.forEach((lvl, idx) => preferredMap.set(lvl.toLowerCase(), idx));

  const seen = new Map<string, { label: string; minSort: number }>();
  for (const row of packages) {
    const rawLevel = String(row.package_level ?? row.packageLevel ?? "").trim();
    if (!rawLevel) continue;
    const key = rawLevel.toLowerCase();
    const rowSort = Number(row.sort_order ?? row.sort ?? 999);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { label: rawLevel, minSort: Number.isFinite(rowSort) ? rowSort : 999 });
    } else if (Number.isFinite(rowSort) && rowSort < existing.minSort) {
      existing.minSort = rowSort;
    }
  }

  return Array.from(seen.entries())
    .sort(([keyA, a], [keyB, b]) => {
      const prefA = preferredMap.has(keyA) ? preferredMap.get(keyA)! : Number.MAX_SAFE_INTEGER;
      const prefB = preferredMap.has(keyB) ? preferredMap.get(keyB)! : Number.MAX_SAFE_INTEGER;
      if (prefA !== prefB) return prefA - prefB;
      if (a.minSort !== b.minSort) return a.minSort - b.minSort;
      return a.label.localeCompare(b.label);
    })
    .map(([, val]) => val.label);
}

export function getAddOnMemoryKey(level: string, detailType: string): string {
  return `${level}_${scopeToDetailType(detailType)}`;
}

export function loadSavedAddOnsMap(): EcmdAddOnsMemoryMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ADDON_MEMORY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const ts = Number(parsed.timestamp || 0);
    if (ts > 0 && Date.now() - ts >= ADDON_MEMORY_TTL_MS) {
      window.localStorage.removeItem(ADDON_MEMORY_STORAGE_KEY);
      return {};
    }
    const map = parsed.map && typeof parsed.map === "object" ? parsed.map : parsed;
    const clean: EcmdAddOnsMemoryMap = {};
    for (const [k, v] of Object.entries(map)) {
      if (Array.isArray(v)) clean[k] = v as EcmdSavedAddOnItem[];
    }
    return clean;
  } catch {
    return {};
  }
}

export function formatPackagePrice(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const rounded = Math.round(safe * 100) / 100;
  if (Number.isInteger(rounded)) {
    return `$${rounded}`;
  }
  return `$${rounded.toFixed(2)}`;
}

export function formatPackageDuration(duration: number | string | null | undefined): string {
  if (typeof duration === "string" && /[a-z]/i.test(duration.trim())) {
    return duration.trim();
  }
  const num = Number(duration);
  if (!Number.isFinite(num) || num <= 0) return "-- Hrs";
  return `${num} ${num === 1 ? "Hr" : "Hrs"}`;
}

/**
 * Builds the unified `$ctx.ecmdPkg` DataProvider payload for a package level card
 * (works with both `ecmd_service_packages` 36-row matrix rows and legacy `ecmd_packages` rows).
 */
export function buildPackageCardContext(params: {
  level: string;
  activeScope: PackageScopeKey;
  vehicleKey: string;
  vehicleLabel: string;
  matchedRow: EcmdServicePackageRow | null;
  addOnsMap?: EcmdAddOnsMemoryMap;
}): EcmdPackageCardContext {
  const { level, activeScope, vehicleKey, vehicleLabel, matchedRow, addOnsMap = {} } = params;
  const detailType = scopeToDetailType(activeScope);
  const subCategory = mapVehicleKeyToSubCategory(vehicleKey);

  const memKey = getAddOnMemoryKey(level, detailType);
  const savedAddOns = Array.isArray(addOnsMap[memKey]) ? addOnsMap[memKey] : [];
  const addOnsTotal = savedAddOns.reduce((sum, a) => sum + (Number(a?.price) || 0), 0);

  let basePrice = 0;
  let salePrice = 0;
  let durationNum = 2;

  if (matchedRow?.pricing_matrix && matchedRow.price == null) {
    // Graceful legacy `ecmd_packages` fallback
    const matrix = matchedRow.pricing_matrix;
    const multipliers = matrix.multipliers || {
      coupe: 1,
      truck: 1.2,
      "sm-suv": 1.25,
      "lg-suv": 1.4,
    };
    const multiplier = multipliers[vehicleKey] || 1;
    basePrice = (Number(matrix.basePrice) || 0) * multiplier;
    salePrice = (Number(matrix.salePrice) || 0) * multiplier;
    durationNum = Number(matrix.duration) || 2;
  } else if (matchedRow) {
    basePrice = Number(matchedRow.price ?? 0) || 0;
    salePrice = Number(matchedRow.sale_price ?? matchedRow.salePrice ?? 0) || 0;
    durationNum = Number(matchedRow.duration ?? 2) || 2;
  }

  const hasSale = salePrice > 0 && salePrice < basePrice;
  const displayBase = basePrice + addOnsTotal;
  const displaySale = hasSale ? salePrice + addOnsTotal : 0;
  const effectivePrice = hasSale ? displaySale : displayBase;

  const discountPercent =
    Number(matchedRow?.discount_percent ?? matchedRow?.discountPercent ?? 0) ||
    (hasSale && basePrice > 0 ? Math.round(((basePrice - salePrice) / basePrice) * 100) : 0);

  const biWeeklyPercent =
    Number(matchedRow?.bi_weekly_percent ?? matchedRow?.biWeeklyPercent ?? 20) || 20;
  const monthlyPercent =
    Number(matchedRow?.monthly_percent ?? matchedRow?.monthlyPercent ?? 15) || 15;
  const quarterlyPercent =
    Number(matchedRow?.quarterly_percent ?? matchedRow?.quarterlyPercent ?? 10) || 10;

  const biWeeklyPrice = effectivePrice * (1 - biWeeklyPercent / 100);
  const monthlyPrice = effectivePrice * (1 - monthlyPercent / 100);
  const quarterlyPrice = effectivePrice * (1 - quarterlyPercent / 100);

  const defaultTitle =
    detailType === "Full" ? `Full ${level} Detail` : `${level} ${detailType} Detail`;
  const title = String(matchedRow?.title || "").trim() || defaultTitle;
  const description =
    String(matchedRow?.description ?? matchedRow?.desc ?? "").trim() ||
    `Complete ${detailType.toLowerCase()} ${level} detail tailored for ${subCategory}.`;
  const interiorDescription =
    String(matchedRow?.interior_description ?? matchedRow?.interiorDescription ?? "").trim() ||
    description;
  const exteriorDescription =
    String(matchedRow?.exterior_description ?? matchedRow?.exteriorDescription ?? "").trim() ||
    description;
  const mainDisplayImage = String(
    matchedRow?.main_display_image ?? matchedRow?.image ?? matchedRow?.hero_image_url ?? ""
  ).trim();

  return {
    id: matchedRow?.id ?? matchedRow?.wix_id ?? `pkg-${level.toLowerCase()}`,
    wixId: String(matchedRow?.wix_id ?? matchedRow?._id ?? ""),
    title,
    level,
    packageLevel: level,
    detailType,
    activeScope,
    subCategory,
    vehicleKey,
    vehicleLabel: vehicleLabel || subCategory,
    price: effectivePrice,
    basePrice: displayBase,
    salePrice: displaySale,
    effectivePrice,
    addOnsTotal,
    addOnsCount: savedAddOns.length,
    savedAddOns,
    hasSale,
    saleTitle: String(matchedRow?.sale_title ?? matchedRow?.saleTitle ?? ""),
    discountPercent,
    mobileFee: Number(matchedRow?.mobile_fee ?? matchedRow?.mobileFee ?? 0) || 0,
    priceFormatted: formatPackagePrice(effectivePrice),
    basePriceFormatted: formatPackagePrice(displayBase),
    salePriceFormatted: hasSale ? formatPackagePrice(displaySale) : "",
    duration: durationNum,
    durationText: formatPackageDuration(durationNum),
    description,
    interiorDescription,
    exteriorDescription,
    mainDisplayImage,
    biWeeklyPercent,
    monthlyPercent,
    quarterlyPercent,
    biWeeklyPrice,
    monthlyPrice,
    quarterlyPrice,
    biWeeklyPriceFormatted: formatPackagePrice(biWeeklyPrice),
    monthlyPriceFormatted: formatPackagePrice(monthlyPrice),
    quarterlyPriceFormatted: formatPackagePrice(quarterlyPrice),
    rawPackage: matchedRow,
  };
}
