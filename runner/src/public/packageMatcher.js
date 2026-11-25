// --- public/packageMatcher.js ---

import { registerModuleState } from 'public/aiTelemetry';

let lastPackageMatchDiagnostics = null;

registerModuleState("packageMatcher", () => ({
    lastPackageMatchDiagnostics
}));

/**
 * Normalizes any vehicleType string (from customerVehicles, vehicleCategories, or UI buttons)
 * into the exact subCategory stored in the `servicePackages` CMS:
 * "Sedan" | "Truck" | "Sm. SUV" | "Lg. SUV"
 */
export function normalizeToPackageSubCategory(rawVehicleType = "") {
    const t = String(rawVehicleType || "").trim().toLowerCase();
    if (!t) return null;

    if (
        t === "lg. suv" ||
        t === "lg suv" ||
        t === "lgsuv" ||
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

    return rawVehicleType.trim();
}

/**
 * Extracts packageLevel ("Classic" | "Premium" | "Luxury") and
 * detailType ("Full" | "Interior" | "Exterior") from a job/draft/package object.
 */
export function extractLevelAndType(item = {}) {
    const titleLower = String(item.packageTitle || item.title || "").toLowerCase();

    let level = item.level || item.packageLevel || "";
    if (!level || level === "N/A") {
        if (titleLower.includes("luxury")) level = "Luxury";
        else if (titleLower.includes("premium")) level = "Premium";
        else level = "Classic";
    }

    let type = item.type || item.detailType || "";
    if (!type || type === "N/A") {
        if (titleLower.includes("interior")) type = "Interior";
        else if (titleLower.includes("exterior")) type = "Exterior";
        else type = "Full";
    }

    return { level: level.trim(), type: type.trim() };
}

/**
 * Finds the exact servicePackages CMS row that matches:
 * - packageLevel (Classic / Premium / Luxury)
 * - detailType (Full / Interior / Exterior)
 * - subCategory (Sedan / Truck / Sm. SUV / Lg. SUV)
 */
export function findMatchingServicePackage(packages = [], itemOrPkg = {}, rawVehicleType = "", _optionalVehicleObj = null) {
    if (!Array.isArray(packages) || packages.length === 0) return null;

    const targetSubCat = normalizeToPackageSubCategory(
        rawVehicleType || itemOrPkg.subCategory || itemOrPkg.vehicleType || itemOrPkg.vehicleSize || ""
    );
    const { level, type } = extractLevelAndType(itemOrPkg);

    let matched = null;
    if (targetSubCat) {
        matched = packages.find(p =>
            String(p.packageLevel || "").trim().toLowerCase() === level.toLowerCase() &&
            String(p.detailType || "").trim().toLowerCase() === type.toLowerCase() &&
            normalizeToPackageSubCategory(p.subCategory) === targetSubCat
        ) || null;
    }

    if (!matched) {
        matched = packages.find(p =>
            String(p.packageLevel || "").trim().toLowerCase() === level.toLowerCase() &&
            String(p.detailType || "").trim().toLowerCase() === type.toLowerCase()
        ) || null;
    }

    lastPackageMatchDiagnostics = {
        rawVehicleType,
        normalizedSubCategory: targetSubCat,
        requestedLevel: level,
        requestedType: type,
        matchedPackageId: matched ? matched._id : null,
        matchedTitle: matched ? matched.title : null,
        matchedPrice: matched ? matched.price : null
    };

    return matched;
}