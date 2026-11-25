// — public/stateManager.js

/**
 * ========================================================================
 * FILE: public/stateManager.js
 * PURPOSE: 0ms Synchronous Session Cache & Background Pre-Fetching Engine
 * ========================================================================
 */
import wixData from 'wix-data';
import { session } from 'wix-storage';
import wixWindowFrontend from 'wix-window-frontend';
import { getActiveUserId } from 'public/authEngine';
import { fetchSupabaseCrmBundle } from 'backend/aiBrain.web';
import { smartSyncRepeater } from 'public/repeaterEngine';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

const DB = {
    AUTO_WI: "autoWhatsIncluded",
    PACKAGES: "servicePackages",
    CATEGORIES: "vehicleCategories",
    BUTTONS: "siteButtons",
    TEMP_DATA: "temporaryData",
    VEHICLES: "customerVehicles",
    CONTACTS: "customerContacts",
    LOCATIONS: "customerLocations",  
    DETAILERS: "contractors",
    JOBS: "scheduledJobs",
    RULES: "availabilityRules"
};

let memCache = {
    allData: null,
    packages: null,
    categories: null,
    cartData: [],
    vehicles: [],
    contacts: [],
    locations: [],
    detailers: [],
    jobs: [],
    userAllJobs: [],
    rules: []
};

registerModuleState("stateManager", () => ({
    allDataCount: Array.isArray(memCache.allData) ? memCache.allData.length : 0,
    packagesCount: Array.isArray(memCache.packages) ? memCache.packages.length : 0,
    categoriesCount: Array.isArray(memCache.categories) ? memCache.categories.length : 0,
    cartDataCount: (memCache.cartData || []).length,
    vehiclesCount: (memCache.vehicles || []).length,
    contactsCount: (memCache.contacts || []).length,
    locationsCount: (memCache.locations || []).length,
    detailersCount: (memCache.detailers || []).length,
    jobsCount: (memCache.jobs || []).length,
    userAllJobsCount: (memCache.userAllJobs || []).length,
    rulesCount: (memCache.rules || []).length,
    cachedCartCountInSession: session.getItem("cached_cart_count") || "0",
    userBundleTimestamp: session.getItem("cache_userBundle_ts") || null
}));

registerDomElements({
    boxes: ["#cartCountsBox"],
    repeaters: ["#cartButtonMenuRep", "#accountButtonsRep", "#accountButtonsRepM", "#passwordButtonsRep"]
});

// ⚡ SYNCHRONOUS 0ms CACHE READERS & WRITERS (No 'await' needed!)
export function getInstantCache(key) {
    let raw = session.getItem(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
}

export function setInstantCache(key, data) {
    try { session.setItem(key, JSON.stringify(data)); } catch (e) {}
}

// Hydrate memCache synchronously on file load if session data already exists!
(function hydrateMemoryOnBoot() {
    let cachedBundle = getInstantCache("cache_userBundle");
    if (cachedBundle) Object.assign(memCache, cachedBundle);
    let cachedAll = getInstantCache("cache_autoWI");
    let cachedPkgs = getInstantCache("cache_packages");
    if (cachedAll) memCache.allData = cachedAll;
    if (cachedPkgs) memCache.packages = cachedPkgs;
})();

export function getMemoryState() {
    return memCache;
}

// 1. CACHED PUBLIC CATALOG DATA (Packages & What's Included)
export async function getCatalogData(forceRefresh = false) {
    if (!forceRefresh && memCache.allData && memCache.packages) {
        return { allData: memCache.allData, packages: memCache.packages };
    }

    let cachedAll = !forceRefresh ? getInstantCache("cache_autoWI") : null;
    let cachedPkgs = !forceRefresh ? getInstantCache("cache_packages") : null;

    if (cachedAll && cachedPkgs) {
        memCache.allData = cachedAll;
        memCache.packages = cachedPkgs;
        return { allData: cachedAll, packages: cachedPkgs };
    }

    console.log(`📌 [STATE_MANAGER -> getCatalogData]: Fetching live catalog (forceRefresh=${forceRefresh})...`);
    let [wiResults, pkgResults] = await Promise.all([
        wixData.query(DB.AUTO_WI).limit(1000).find(),
        wixData.query(DB.PACKAGES).ascending("sort").limit(100).find()
    ]);

    memCache.allData = wiResults.items || [];
    memCache.packages = pkgResults.items || [];

    setInstantCache("cache_autoWI", memCache.allData);
    setInstantCache("cache_packages", memCache.packages);

    return { allData: memCache.allData, packages: memCache.packages };
}

// 2. CACHED VEHICLE CATEGORIES
export async function getVehicleCategories() {
    if (memCache.categories) return memCache.categories;
    let cached = getInstantCache("cache_categories");
    if (cached) { memCache.categories = cached; return cached; }

    let res = await wixData.query(DB.CATEGORIES).ascending("sort").find();
    memCache.categories = res.items || [];
    setInstantCache("cache_categories", memCache.categories);
    return memCache.categories;
}

// 3. CACHED GLOBAL BUTTONS (Paints synchronously in 0ms if cached!)
export function syncGlobalCartBadge($w, count) {
    if (!$w) return;
    let safeCount = Number(count || 0);
    session.setItem("cached_cart_count", String(safeCount));

    if ($w("#cartCounts").id) {
        $w("#cartCounts").text = safeCount.toString();
    }
    if ($w("#cartCountsBox").id) {
        if (safeCount > 0) {
            $w("#cartCountsBox").expand();
            if ($w("#cartCountsBox").hidden) {
                $w("#cartCountsBox").show();
            }
        } else {
            if (!$w("#cartCountsBox").hidden) {
                $w("#cartCountsBox").hide();
            }
        }
    }
}

export async function bindGlobalRepeaterButtons($w) {
    let savedCount = session.getItem("cached_cart_count");
    if (savedCount !== null && savedCount !== undefined) {
        syncGlobalCartBadge($w, Number(savedCount));
    } else if (memCache.cartData && memCache.cartData.length > 0) {
        syncGlobalCartBadge($w, memCache.cartData.length);
    }

    getActiveUserId().then(userId => {
        wixData.query(DB.TEMP_DATA).eq("userId", String(userId)).count().then(count => {
            syncGlobalCartBadge($w, count);
        }).catch(() => {});
    });

    const applyButtonsToDOM = (items) => {
        let cartMenuItems = items.filter(i => i.category === "Cart Menu");
        let accountItems = items.filter(i => i.category && i.category.trim() === "Account");
        let passwordItems = items.filter(i => i.category && i.category.trim() === "Password");

        const bindRep = (id, data, shouldExpand = true) => {
            if ($w(id).id) {
                if (!shouldExpand) $w(id).collapse();
                smartSyncRepeater($w, id, data);
                if (data.length > 0 && shouldExpand) {
                    $w(id).expand();
                    if ($w(id).hidden) $w(id).show();
                }
            }
        };

        bindRep("#cartButtonMenuRep", cartMenuItems);

        if (wixWindowFrontend.formFactor === "Desktop") {
            bindRep("#accountButtonsRep", accountItems, false);
            bindRep("#passwordButtonsRep", passwordItems, false);
        } else {
            bindRep("#accountButtonsRepM", accountItems, false);
            bindRep("#accountButtonsRep", accountItems, false);
            bindRep("#passwordButtonsRep", passwordItems, false);
        }
    };

    let cachedItems = getInstantCache("cache_siteButtons");
    if (cachedItems) {
        applyButtonsToDOM(cachedItems);
        return;
    }

    let res = await wixData.query(DB.BUTTONS).limit(100).ascending("sort").find();
    let items = res.items || [];
    setInstantCache("cache_siteButtons", items);
    applyButtonsToDOM(items);
}

// 4. USER & CART DATA BUNDLE
export async function fetchUserAndCartBundle(forceRefresh = false) {
    let cachedBundle = !forceRefresh ? getInstantCache("cache_userBundle") : null;
    let cacheTime = Number(session.getItem("cache_userBundle_ts") || 0);
    let isCacheFresh = cachedBundle && (Date.now() - cacheTime < 60000);

    if (isCacheFresh) {
        Object.assign(memCache, cachedBundle);
        return memCache;
    }

    let userId = String(await getActiveUserId());
    console.log(`📌 [STATE_MANAGER -> fetchUserAndCartBundle]: Fetching fresh user/cart bundle for userId=${userId}...`);
    let todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const safeFetch = (query) => query.find().catch(() => ({ items: [] }));

    let [cartRes, vehRes, contactRes, locRes, detRes, jobsRes, userJobsRes, rulesRes, supaCrm] = await Promise.all([
        safeFetch(wixData.query(DB.TEMP_DATA).eq("userId", userId)),
        safeFetch(wixData.query(DB.VEHICLES).eq("userId", userId).ne("archived", true)),
        safeFetch(wixData.query(DB.CONTACTS).eq("userId", userId).ne("archived", true)),
        safeFetch(wixData.query(DB.LOCATIONS).eq("userId", userId).ne("archived", true)),
        safeFetch(wixData.query(DB.DETAILERS).eq("isActiveDetailer", true)),
        safeFetch(wixData.query(DB.JOBS).ge("serviceDate", todayStart).limit(1000)),
        safeFetch(wixData.query(DB.JOBS).eq("userId", userId).ne("status", "Cancelled")),
        safeFetch(wixData.query(DB.RULES)),
        fetchSupabaseCrmBundle(userId).catch(() => ({ ok: false }))
    ]);

    const mergeById = (supaArr = [], wixArr = []) => {
        const map = new Map();
        (wixArr || []).forEach(item => { if (item && item._id) map.set(item._id, item); });
        (supaArr || []).forEach(item => { if (item && item._id) map.set(item._id, { ...(map.get(item._id) || {}), ...item }); });
        return Array.from(map.values());
    };

    memCache.cartData = cartRes.items || [];
    memCache.vehicles = mergeById(supaCrm?.vehicles, vehRes.items);
    memCache.contacts = mergeById(supaCrm?.contacts, contactRes.items);
    memCache.locations = mergeById(supaCrm?.locations, locRes.items);
    memCache.detailers = detRes.items || [];
    memCache.jobs = (jobsRes.items || []).filter(job => job.status !== "Cancelled");
    memCache.userAllJobs = mergeById((supaCrm?.jobs || []).filter(j => j.status !== "Cancelled"), userJobsRes.items);
    memCache.rules = rulesRes.items || [];

    setInstantCache("cache_userBundle", memCache);
    session.setItem("cache_userBundle_ts", String(Date.now()));

    return memCache;
}

// ⚡ 5. SILENT BACKGROUND PRE-FETCHER
export function prewarmAllUserDataInBackground() {
    setTimeout(async () => {
        try {
            await Promise.all([
                getCatalogData(false),
                getVehicleCategories(),
                fetchUserAndCartBundle(false)
            ]);
        } catch (e) {}
    }, 600);
}