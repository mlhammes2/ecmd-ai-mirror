// --- backend/vehicleClassifier.web.js ---
import { Permissions, webMethod } from 'wix-web-module';
import { fetch } from 'wix-fetch';
import wixData from 'wix-data';

const EDGE_URL = 'https://lvynkeuceiqxafgpgdvs.supabase.co/functions/v1/ecmd-carbon-bridge';

const THREE_ROW_MODELS = [
    "suburban", "tahoe", "yukon", "escalade", "expedition", "navigator",
    "wagoneer", "grand wagoneer", "telluride", "palisade", "pilot", "mdx",
    "highlander", "grand highlander", "sequoia", "4runner", "land cruiser",
    "gx", "lx", "tx", "atlas", "traverse", "enclave", "acadia", "explorer",
    "aviator", "durango", "pathfinder", "armada", "qx60", "qx80", "cx-9",
    "cx-90", "ascent", "sorento", "carnival", "odyssey", "sienna", "pacifica",
    "voyager", "town & country", "caravan", "grand caravan", "sedona",
    "model x", "r1s", "gls", "gle", "x7", "q7", "xc90", "defender 130",
    "yukon xl", "expedition max"
];

const TWO_ROW_SUV_MODELS = [
    "rav4", "cr-v", "crv", "rogue", "equinox", "terrain", "escape", "bronco",
    "bronco sport", "wrangler", "cherokee", "grand cherokee", "compass",
    "renegade", "forester", "outback", "crosstrek", "cx-5", "cx-30", "cx-50",
    "tucson", "santa fe", "kona", "venue", "sportage", "seltos", "soul",
    "niro", "hr-v", "hrv", "passport", "murano", "kicks", "tiguan", "taos",
    "atlas cross sport", "blazer", "trailblazer", "trax", "envision",
    "encore", "xt4", "xt5", "corsair", "nautilus", "edge", "mach-e",
    "model y", "macan", "cayenne", "x1", "x3", "x5", "q3", "q5", "q8",
    "glc", "gla", "glb", "xc40", "xc60", "rx", "nx", "ux", "rdx", "velar",
    "evoque", "range rover sport", "defender"
];

const TRUCK_MODELS = [
    "f-150", "f150", "f-250", "f250", "f-350", "f350", "silverado", "sierra",
    "ram 1500", "ram 2500", "ram 3500", "1500", "2500", "3500", "tacoma",
    "tundra", "ranger", "maverick", "colorado", "canyon", "frontier", "titan",
    "ridgeline", "gladiator", "cybertruck", "r1t", "hummer ev"
];

function matchBucketToCmsOption(bucket, cmsTypes = []) {
    if (!cmsTypes || cmsTypes.length === 0) return null;
    const findMatch = (keywords) => cmsTypes.find(t => {
        const lower = t.toLowerCase();
        return keywords.some(kw => lower.includes(kw));
    });
    if (bucket === "3ROW_SUV") return findMatch(["3rd", "3 row", "three row", "large suv", "xl suv", "full size suv", "minivan", "van"]) || findMatch(["suv"]);
    if (bucket === "SMALL_SUV") return findMatch(["small suv", "2 row", "midsize suv", "compact suv", "crossover", "suv"]);
    if (bucket === "TRUCK") return findMatch(["truck", "pickup"]);
    if (bucket === "CAR") return findMatch(["car", "sedan", "coupe", "compact"]);
    return null;
}

export const verifyVehicleType = webMethod(Permissions.Anyone, async (year, make, model, userSelectedType = "") => {
    const cleanMake = String(make || "").trim().toLowerCase();
    const cleanModel = String(model || "").trim().toLowerCase();
    const cleanYear = String(year || "").trim();

    if (!cleanModel) {
        return { detectedBucket: null, detectedCategory: null, detectedType: null, isMismatch: false };
    }

    let detectedBucket = null;

    if (cleanModel.includes("grand cherokee l") || THREE_ROW_MODELS.some(m => cleanModel === m || cleanModel.includes(m))) {
        detectedBucket = "3ROW_SUV";
    } else if (TRUCK_MODELS.some(m => cleanModel === m || cleanModel.includes(m))) {
        detectedBucket = "TRUCK";
    } else if (TWO_ROW_SUV_MODELS.some(m => cleanModel === m || cleanModel.includes(m))) {
        detectedBucket = "SMALL_SUV";
    }

    if (!detectedBucket && cleanYear && cleanMake && cleanModel) {
        try {
            const optUrl = `https://www.fueleconomy.gov/ws/rest/vehicle/menu/options?year=${encodeURIComponent(cleanYear)}&make=${encodeURIComponent(make.trim())}&model=${encodeURIComponent(model.trim())}`;
            const optRes = await fetch(optUrl, { headers: { "Accept": "application/json" } });
            if (optRes.ok) {
                const optData = await optRes.json();
                const firstOption = Array.isArray(optData?.menuItem) ? optData.menuItem[0] : optData?.menuItem;
                if (firstOption?.value) {
                    const vehUrl = `https://www.fueleconomy.gov/ws/rest/vehicle/${firstOption.value}`;
                    const vehRes = await fetch(vehUrl, { headers: { "Accept": "application/json" } });
                    const vehData = await vehRes.json();
                    const vClass = String(vehData?.VClass || "").toLowerCase();
                    if (vClass.includes("pickup")) detectedBucket = "TRUCK";
                    else if (vClass.includes("minivan") || vClass.includes("van") || vClass.includes("standard sport utility")) detectedBucket = "3ROW_SUV";
                    else if (vClass.includes("small sport utility") || vClass.includes("sport utility")) detectedBucket = "SMALL_SUV";
                    else if (vClass.includes("car") || vClass.includes("sedan") || vClass.includes("coupe") || vClass.includes("wagon") || vClass.includes("seater")) detectedBucket = "CAR";
                }
            }
        } catch (err) {}
    }

    // 3. Fallback to Supabase Gemini Classifier if still unrecognized
    if (!detectedBucket) {
        try {
            const aiRes = await fetch(EDGE_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "classify_vehicle", vehicleInput: `${cleanYear} ${cleanMake} ${cleanModel}`.trim() })
            });
            const aiData = await aiRes.json();
            const parsed = JSON.parse(aiData.answer || "{}");
            if (parsed.detectedBucket) detectedBucket = parsed.detectedBucket;
        } catch (err) {}
    }

    let detectedCategory = "Automotive";
    let detectedType = null;

    if (detectedBucket) {
        try {
            const catRes = await wixData.query("vehicleCategories").ascending("sort").limit(200).find();
            const allItems = catRes.items || [];
            const autoItems = allItems.filter(i => (i.category || "").toLowerCase() === "automotive");
            const pool = autoItems.length > 0 ? autoItems : allItems;
            if (pool.length > 0 && pool[0].category) detectedCategory = pool[0].category;
            const uniqueTypes = [...new Set(pool.map(i => i.vehicleType || i.title).filter(Boolean))];
            detectedType = matchBucketToCmsOption(detectedBucket, uniqueTypes);
        } catch (err) {}
    }

    const isMismatch = Boolean(detectedType && userSelectedType && detectedType.toLowerCase().trim() !== String(userSelectedType).toLowerCase().trim());
    return { detectedBucket, detectedCategory, detectedType, userSelectedType, isMismatch };
});

function normalizeToSubCatBackend(rawType = "") {
    const t = String(rawType || "").trim().toLowerCase();
    if (!t) return null;
    if (t === "lg. suv" || t === "lg suv" || t === "lgsuv" || t.includes("3rd") || t.includes("3 row") || t.includes("three row") || t.includes("large") || t.includes("lg") || t.includes("xl") || t.includes("minivan") || t.includes("van") || t.includes("full size suv")) return "Lg. SUV";
    if (t === "sm. suv" || t === "sm suv" || t === "smsuv" || t.includes("small") || t.includes("sm") || t.includes("2 row") || t.includes("midsize suv") || t.includes("compact suv") || t.includes("crossover") || t.includes("suv")) return "Sm. SUV";
    if (t.includes("truck") || t.includes("pickup")) return "Truck";
    if (t.includes("sedan") || t.includes("car") || t.includes("coupe") || t.includes("compact")) return "Sedan";
    return rawType.trim();
}

export const auditAndSyncUpcomingJobs = webMethod(Permissions.Anyone, async () => {
    try {
        let today = new Date();
        today.setHours(0, 0, 0, 0);
        let [jobsRes, pkgRes, vehRes] = await Promise.all([
            wixData.query("scheduledJobs").ne("status", "Completed").ne("status", "Cancelled").ge("serviceDate", today).limit(1000).find({ suppressAuth: true }),
            wixData.query("servicePackages").limit(100).find({ suppressAuth: true }),
            wixData.query("customerVehicles").ne("archived", true).limit(1000).find({ suppressAuth: true })
        ]);
        let upcomingJobs = jobsRes.items || [];
        let allPackages = pkgRes.items || [];
        let allVehicles = vehRes.items || [];
        let updatedJobsCount = 0;
        let updatedVehiclesCount = 0;

        for (let veh of allVehicles) {
            let cat = String(veh.category || "Automotive").toLowerCase();
            if (cat !== "automotive" && cat !== "auto") continue;
            if (!veh.model) continue;
            let check = await verifyVehicleType(veh.year, veh.make, veh.model, veh.vehicleType);
            if (check && check.detectedType && check.isMismatch) {
                veh.vehicleType = check.detectedType;
                await wixData.update("customerVehicles", veh, { suppressAuth: true });
                updatedVehiclesCount++;
            }
        }

        for (let job of upcomingJobs) {
            if (job.level === "Correction" || job.isCorrection) continue;
            let linkedVeh = allVehicles.find(v => String(v._id) === String(job.vehicleId));
            let vYear = job.vehicleYear || linkedVeh?.year || "";
            let vMake = job.vehicleMake || linkedVeh?.make || "";
            let vModel = job.vehicleModel || linkedVeh?.model || "";
            let currentType = linkedVeh?.vehicleType || job.vehicleType || "";

            if (!vModel && job.vehicleInfo && job.vehicleInfo !== "Unknown Vehicle") {
                let cleanInfo = String(job.vehicleInfo).split("-")[0].trim();
                let parts = cleanInfo.split(/\s+/);
                if (parts.length >= 3 && /^\d{4}$/.test(parts[0])) {
                    vYear = parts[0]; vMake = parts[1]; vModel = parts.slice(2).join(" ");
                } else if (parts.length >= 2) {
                    vMake = parts[0]; vModel = parts.slice(1).join(" ");
                }
            }

            let verifiedType = currentType;
            if (vModel) {
                let check = await verifyVehicleType(vYear, vMake, vModel, currentType);
                if (check && check.detectedType) verifiedType = check.detectedType;
            }

            let targetSubCat = normalizeToSubCatBackend(verifiedType);
            if (!targetSubCat) continue;

            let titleLower = String(job.packageTitle || "").toLowerCase();
            let level = job.level && job.level !== "N/A" ? job.level : (titleLower.includes("luxury") ? "Luxury" : titleLower.includes("premium") ? "Premium" : "Classic");
            let type = job.type && job.type !== "N/A" ? job.type : (titleLower.includes("interior") ? "Interior" : titleLower.includes("exterior") ? "Exterior" : "Full");

            let matchedPkg = allPackages.find(p =>
                normalizeToSubCatBackend(p.subCategory) === targetSubCat &&
                String(p.packageLevel || "").trim().toLowerCase() === level.trim().toLowerCase() &&
                String(p.detailType || "").trim().toLowerCase() === type.trim().toLowerCase()
            );
            if (!matchedPkg) continue;

            let expectedBase = Number(matchedPkg.price || 0);
            let expectedSale = Number(matchedPkg.salePrice || 0);
            let expectedDuration = Number(matchedPkg.duration || job.setDuration || 3);
            let currentBase = Number(job.basePrice || 0);

            if (String(job.vehicleType || "").trim() !== String(verifiedType || "").trim() || currentBase !== expectedBase) {
                job.vehicleType = verifiedType;
                job.subCategory = matchedPkg.subCategory;
                job.basePrice = expectedBase;
                job.salePackagePrice = expectedSale;
                job.setDuration = expectedDuration;
                let mobile = Number(job.mobileFee || matchedPkg.mobileFee || 0);
                let addons = Number(job.totalAddOnsPrice || 0);
                job.subTotal = expectedBase + mobile + addons;

                let hasOfficeDiscount = Array.isArray(job.discountsApplied) && job.discountsApplied.some(d => String(d).includes("Office Discount"));
                let hasCarClub = Array.isArray(job.discountsApplied) && job.discountsApplied.some(d => String(d).includes("Car Club"));
                if (!hasOfficeDiscount && !hasCarClub) {
                    if (expectedSale > 0 && expectedSale < expectedBase) {
                        let discAmt = expectedBase - expectedSale;
                        let saleLabel = matchedPkg.saleTitle || "Special Offer";
                        job.discountsTotal = discAmt;
                        job.discountsApplied = [`${saleLabel} (-$${discAmt.toFixed(2)})`];
                    } else {
                        job.discountsTotal = 0;
                        job.discountsApplied = [];
                    }
                }
                job.totalPrice = Math.max(0, job.subTotal - Number(job.discountsTotal || 0));
                await wixData.update("scheduledJobs", job, { suppressAuth: true });
                updatedJobsCount++;
            }
        }
        return { success: true, updatedVehiclesCount, updatedJobsCount };
    } catch (err) {
        return { success: false, error: String(err.message || err) };
    }
});
