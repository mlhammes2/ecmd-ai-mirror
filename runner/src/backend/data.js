// --- backend/data.js ---

import wixData from 'wix-data';
import { deleteGoogleEvent } from 'backend/calendar-dispatcher.web';
import { pushCrmRecordToSupabase } from 'backend/aiBrain.web';

// ==========================================
// 🌎 DYNAMIC US SERVICE ADDRESS TIMEZONE RESOLVER (0ms)
// ==========================================
export function resolveServiceTimezone(stateRaw = "", zipRaw = "") {
    let st = String(stateRaw || "").trim().toUpperCase();
    let zip = String(zipRaw || "").trim();
    let zip3 = zip.substring(0, 3);

    // 1. ZIP-prefix overrides for split states (Florida Panhandle, Texas El Paso, etc.)
    if (zip3 === "324" || zip3 === "325") return "America/Chicago"; // Pensacola / Panama City, FL (Central)
    if (zip.startsWith("32") || zip.startsWith("33") || zip.startsWith("34")) return "America/New_York"; // Rest of FL (Eastern)
    if (zip.startsWith("84")) return "America/Denver"; // Utah (Mountain)
    if (zip3 === "798" || zip3 === "799") return "America/Denver"; // El Paso, TX (Mountain)

    // 2. State-level lookup
    const stateMap = {
        // Mountain Time
        "UT": "America/Denver", "UTAH": "America/Denver",
        "CO": "America/Denver", "COLORADO": "America/Denver",
        "WY": "America/Denver", "WYOMING": "America/Denver",
        "MT": "America/Denver", "MONTANA": "America/Denver",
        "NM": "America/Denver", "NEW MEXICO": "America/Denver",
        "ID": "America/Denver", "IDAHO": "America/Denver",
        "AZ": "America/Phoenix", "ARIZONA": "America/Phoenix",

        // Central Time
        "AL": "America/Chicago", "ALABAMA": "America/Chicago",
        "MS": "America/Chicago", "MISSISSIPPI": "America/Chicago",
        "LA": "America/Chicago", "LOUISIANA": "America/Chicago",
        "TX": "America/Chicago", "TEXAS": "America/Chicago",
        "OK": "America/Chicago", "OKLAHOMA": "America/Chicago",
        "AR": "America/Chicago", "ARKANSAS": "America/Chicago",
        "TN": "America/Chicago", "TENNESSEE": "America/Chicago",
        "IL": "America/Chicago", "ILLINOIS": "America/Chicago",
        "MO": "America/Chicago", "MISSOURI": "America/Chicago",
        "WI": "America/Chicago", "WISCONSIN": "America/Chicago",
        "MN": "America/Chicago", "MINNESOTA": "America/Chicago",
        "IA": "America/Chicago", "IOWA": "America/Chicago",
        "KS": "America/Chicago", "KANSAS": "America/Chicago",
        "NE": "America/Chicago", "NEBRASKA": "America/Chicago",

        // Eastern Time
        "GA": "America/New_York", "GEORGIA": "America/New_York",
        "SC": "America/New_York", "SOUTH CAROLINA": "America/New_York",
        "NC": "America/New_York", "NORTH CAROLINA": "America/New_York",
        "VA": "America/New_York", "VIRGINIA": "America/New_York",
        "NY": "America/New_York", "NEW YORK": "America/New_York",
        "PA": "America/New_York", "PENNSYLVANIA": "America/New_York",
        "OH": "America/New_York", "OHIO": "America/New_York",
        "MI": "America/New_York", "MICHIGAN": "America/New_York",

        // Pacific Time
        "CA": "America/Los_Angeles", "CALIFORNIA": "America/Los_Angeles",
        "NV": "America/Los_Angeles", "NEVADA": "America/Los_Angeles",
        "OR": "America/Los_Angeles", "OREGON": "America/Los_Angeles",
        "WA": "America/Los_Angeles", "WASHINGTON": "America/Los_Angeles"
    };

    if (st === "FL" || st === "FLORIDA") return "America/Chicago";

    return stateMap[st] || "America/Chicago";
}

function extractCalendarYMD(rawDate, tz = "America/Chicago") {
    let d = new Date(rawDate);
    let utcHour = d.getUTCHours();
    if (utcHour <= 8 || utcHour === 12) {
        return {
            year: d.getUTCFullYear(),
            month: d.getUTCMonth(),
            day: d.getUTCDate()
        };
    }
    let parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(d);

    return {
        year: Number(parts.find(p => p.type === 'year').value),
        month: Number(parts.find(p => p.type === 'month').value) - 1,
        day: Number(parts.find(p => p.type === 'day').value)
    };
}

function normalizeCalendarDateToNoonUTC(rawDate, tz = "America/Chicago") {
    if (!rawDate) return null;
    let d = new Date(rawDate);
    if (isNaN(d.getTime())) return rawDate;

    let { year, month, day } = extractCalendarYMD(d, tz);
    return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
}

function buildLocalServiceTimestamp(rawServiceDate, targetHour24, tz = "America/Chicago") {
    if (!rawServiceDate) return null;
    let { year, month, day } = extractCalendarYMD(rawServiceDate, tz);

    let probeUTC = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
    let tzParts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'shortOffset'
    }).formatToParts(probeUTC);

    let offsetStr = tzParts.find(p => p.type === 'timeZoneName')?.value || "GMT-5";
    let offsetHours = parseInt(offsetStr.replace("GMT", ""), 10);
    if (isNaN(offsetHours)) offsetHours = -5;

    return new Date(Date.UTC(year, month, day, targetHour24 - offsetHours, 0, 0, 0));
}

function normalizeTimeToken(timeToken, scheduledTime = "") {
    let t = String(timeToken || "").trim();
    let s = String(scheduledTime || "").toLowerCase();

    if (t === "token_1" || t === "slot_1" || t === "AM" || s.includes("9-11")) return "token_1";
    if (t === "token_2" || t === "slot_2" || t === "PM" || s.includes("1-3")) return "token_2";
    if (t === "token_3" || t === "slot_3" || t === "3rd" || s.includes("4-6")) return "token_3";
    return t || "token_1";
}

function normalizeDiscountsArray(discountsApplied, discountsTotal = 0) {
    if (!Array.isArray(discountsApplied) || discountsApplied.length === 0) return [];
    return discountsApplied.map(d => {
        if (typeof d === "object" && d !== null) {
            let title = d.title || "Discount";
            let amt = Number(d.price || discountsTotal || 0).toFixed(2);
            return `${title} (-$${amt})`;
        }
        let str = String(d).trim();
        if (/^\d+(\.\d+)?\)$/.test(str)) {
            return `Discount (-$${str}`;
        }
        if (str.endsWith("-") && Number(discountsTotal) > 0) {
            return `${str} (-$${Number(discountsTotal).toFixed(2)})`;
        }
        return str;
    });
}

function applyServiceAddressScheduleTimes(item) {
    let jobTimezone = resolveServiceTimezone(item.state, item.zip);

    if (item.correctionDate) {
        item.correctionDate = normalizeCalendarDateToNoonUTC(item.correctionDate, jobTimezone);
    }
    if (item.correctionTimeToken || item.correctionTime) {
        item.correctionTimeToken = normalizeTimeToken(item.correctionTimeToken, item.correctionTime);
    }

    if (!item.serviceDate) return;

    item.serviceDate = normalizeCalendarDateToNoonUTC(item.serviceDate, jobTimezone);
    if (item.originalScheduledDate) {
        item.originalScheduledDate = normalizeCalendarDateToNoonUTC(item.originalScheduledDate, jobTimezone);
    }

    item.timeToken = normalizeTimeToken(item.timeToken, item.scheduledTime);

    let arrivalHour = 9;
    let expectedHour = 11;
    if (item.timeToken === "token_2") {
        arrivalHour = 13;
        expectedHour = 15;
    } else if (item.timeToken === "token_3") {
        arrivalHour = 16;
        expectedHour = 18;
    }

    item.scheduledStartTime = buildLocalServiceTimestamp(item.serviceDate, arrivalHour, jobTimezone);
    item.deadlineTime = buildLocalServiceTimestamp(item.serviceDate, expectedHour, jobTimezone);
}

// ==========================================
// 💸 HELPER: UNIVERSAL PAYROLL CALCULATOR
// ==========================================
async function enrichJobPayrollAndDetailer(item) {
    try {
        let [detRes, pkgRes, addOnRes] = await Promise.all([
            item.detailerId
                ? wixData.query("contractors").eq("_id", item.detailerId).find({ suppressAuth: true })
                : Promise.resolve({ items: [] }),
            wixData.query("servicePackages").limit(100).find({ suppressAuth: true }),
            wixData.query("autoWhatsIncluded").limit(1000).find({ suppressAuth: true })
        ]);

        let detailer = detRes.items?.[0] || null;
        let allPkgs = pkgRes.items || [];
        let cmsAddOns = addOnRes.items || [];

        const normSub = (v) => {
            let s = String(v || "").trim().toLowerCase();
            if (!s) return "";
            if (s.includes("3rd") || s.includes("lg") || s.includes("large") || s.includes("minivan") || s.includes("van")) return "lg. suv";
            if (s.includes("sm") || s.includes("small") || s.includes("suv")) return "sm. suv";
            if (s.includes("truck") || s.includes("pickup")) return "truck";
            if (s.includes("sedan") || s.includes("car")) return "sedan";
            return s;
        };
        let targetSub = normSub(item.vehicleType || item.subCategory || "");
        let targetLevel = String(item.level || "").trim().toLowerCase();
        let targetType = String(item.type || "").trim().toLowerCase();

        let pkg = allPkgs.find(p =>
            normSub(p.subCategory) === targetSub &&
            String(p.packageLevel || "").trim().toLowerCase() === targetLevel &&
            String(p.detailType || "").trim().toLowerCase() === targetType
        ) || allPkgs.find(p => p.title === item.packageTitle) || null;

        if (detailer) {
            if (!item.detailerName || item.detailerName === "Unassigned") {
                item.detailerName = detailer.first || detailer.firstName || detailer.title || "Detailer";
            }
            if (!item.detailerAlias || item.detailerAlias === "Unassigned") {
                item.detailerAlias = detailer.teamAlias || "Detailer Team";
            }
        }

        let detailerLevel = detailer ? Number(detailer.payLevel || 1) : 1;
        let basePayout = pkg
            ? Number(detailerLevel === 2 ? (pkg.payoutL2 || 0) : (pkg.payoutL1 || 0))
            : Number(item.basePayout || 0);

        let addOnPayout = 0;
        const ADDON_COMMISSION_RATE = 0.70;
        let allAddOns = [
            ...(Array.isArray(item.interiorAddOns) ? item.interiorAddOns : []),
            ...(Array.isArray(item.exteriorAddOns) ? item.exteriorAddOns : []),
            ...(Array.isArray(item.customAddOns) ? item.customAddOns : [])
        ];

        allAddOns.forEach(addonTag => {
            let tagStr = typeof addonTag === "object" ? `${addonTag.title} ($${addonTag.price})` : String(addonTag);
            let priceMatch = tagStr.match(/\(\$([\d.]+)\)/);
            if (priceMatch) {
                addOnPayout += (parseFloat(priceMatch[1]) * ADDON_COMMISSION_RATE);
            } else {
                let addOnCms = cmsAddOns.find(a => tagStr.includes(a.buttonTitle || a.title));
                if (addOnCms && addOnCms.price) {
                    addOnPayout += (Number(addOnCms.price) * ADDON_COMMISSION_RATE);
                }
            }
        });

        let totalPayout = Number((basePayout + addOnPayout).toFixed(2));
        let traineeId = item.traineeId || item.assignedTraineeId || null;
        let trainerPayout = traineeId ? Number((totalPayout * 0.60).toFixed(2)) : totalPayout;
        let traineePayout = traineeId ? Number((totalPayout * 0.40).toFixed(2)) : 0;

        item.basePayout = Number(basePayout.toFixed(2));
        item.addOnPayout = Number(addOnPayout.toFixed(2));
        item.payoutTotal = totalPayout;
        item.trainerPayout = trainerPayout;
        item.traineePayout = traineePayout;
        item.traineeId = traineeId;
    } catch (err) {
        console.error("📌 [BACKEND_DATA_HOOKS -> enrichJobPayrollAndDetailer]: 🚨 Payroll enrichment error:", err);
    }
    return item;
}

// ==========================================
// 🔒 1. BEFORE INSERT HOOK
// ==========================================
export async function scheduledJobs_beforeInsert(item, context) {
    console.log(`📌 [BACKEND_DATA_HOOKS -> scheduledJobs_beforeInsert]: Enriching new job (${item?.packageTitle || "Detail"})`);
    applyServiceAddressScheduleTimes(item);
    item.discountsApplied = normalizeDiscountsArray(item.discountsApplied, item.discountsTotal);

    await enrichJobPayrollAndDetailer(item);
    return item;
}

// ==========================================
// 🔒 2. BEFORE UPDATE HOOK (Enforces Completed Lock + Allows Correction Updates)
// ==========================================
export async function scheduledJobs_beforeUpdate(item, context) {
    try {
        if (item._id) {
            let existingJob = await wixData.get("scheduledJobs", item._id, { suppressAuth: true });

            let jobTimezone = resolveServiceTimezone(item.state || existingJob?.state, item.zip || existingJob?.zip);
            if (item.correctionDate) {
                item.correctionDate = normalizeCalendarDateToNoonUTC(item.correctionDate, jobTimezone);
            }
            if (item.correctionTimeToken || item.correctionTime) {
                item.correctionTimeToken = normalizeTimeToken(item.correctionTimeToken, item.correctionTime);
            }

            if (existingJob && existingJob.status === "Completed") {
                const lockedFields = [
                    "status", "serviceDate", "originalScheduledDate", "scheduledTime", "timeToken",
                    "scheduledStartTime", "deadlineTime", "detailerId", "detailerName", "detailerAlias",
                    "userId", "contactId", "locationId", "vehicleId", "vehicleInfo",
                    "vehicleYear", "vehicleMake", "vehicleModel", "vehicleColor", "vehicleType", "vehicleCategory",
                    "firstName", "lastName", "phone", "email", "address1", "address2", "city", "state", "zip",
                    "packageTitle", "level", "type", "basePrice", "salePackagePrice", "mobileFee",
                    "subTotal", "discountsApplied", "discountsTotal", "totalPrice", "totalAddOnsPrice",
                    "interiorAddOns", "exteriorAddOns", "customAddOns",
                    "basePayout", "addOnPayout", "payoutTotal", "trainerPayout", "traineePayout", "traineeId"
                ];
                lockedFields.forEach(field => {
                    if (existingJob[field] !== undefined) {
                        item[field] = existingJob[field];
                    }
                });
                console.log(`📌 [BACKEND_DATA_HOOKS -> scheduledJobs_beforeUpdate]: Enforced Completed immutability lock on job ${item._id}`);
                return item;
            }
        }
    } catch (e) {
        console.error("📌 [BACKEND_DATA_HOOKS -> scheduledJobs_beforeUpdate]: 🚨 Failed checking existing job:", e);
    }

    applyServiceAddressScheduleTimes(item);
    item.discountsApplied = normalizeDiscountsArray(item.discountsApplied, item.discountsTotal);

    await enrichJobPayrollAndDetailer(item);
    return item;
}

// ==========================================
// ⚡ 3. REAL-TIME SUPABASE CRM MIRROR HOOKS (All Collections)
// ==========================================
function mirrorToSupabaseAsync(collectionName, item, isRemoved = false) {
    if (!item) return;
    const payload = isRemoved ? { ...item, status: collectionName === 'scheduledJobs' ? 'Cancelled' : item.status, archived: true } : item;
    pushCrmRecordToSupabase(collectionName, payload).catch(err => {
        console.warn(`📌 [BACKEND_DATA_HOOKS -> mirrorToSupabaseAsync]: Warning syncing ${collectionName}:`, err?.message || err);
    });
}

export async function scheduledJobs_afterInsert(item, context) {
    mirrorToSupabaseAsync('scheduledJobs', item, false);
    return item;
}

export async function scheduledJobs_afterUpdate(item, context) {
    mirrorToSupabaseAsync('scheduledJobs', item, false);
    return item;
}

export async function customerVehicles_afterInsert(item, context) {
    mirrorToSupabaseAsync('customerVehicles', item, false);
    return item;
}

export async function customerVehicles_afterUpdate(item, context) {
    mirrorToSupabaseAsync('customerVehicles', item, false);
    return item;
}

export async function customerVehicles_afterRemove(item, context) {
    mirrorToSupabaseAsync('customerVehicles', item, true);
    return item;
}

export async function customerContacts_afterInsert(item, context) {
    mirrorToSupabaseAsync('customerContacts', item, false);
    return item;
}

export async function customerContacts_afterUpdate(item, context) {
    mirrorToSupabaseAsync('customerContacts', item, false);
    return item;
}

export async function customerContacts_afterRemove(item, context) {
    mirrorToSupabaseAsync('customerContacts', item, true);
    return item;
}

export async function customerLocations_afterInsert(item, context) {
    mirrorToSupabaseAsync('customerLocations', item, false);
    return item;
}

export async function customerLocations_afterUpdate(item, context) {
    mirrorToSupabaseAsync('customerLocations', item, false);
    return item;
}

export async function customerLocations_afterRemove(item, context) {
    mirrorToSupabaseAsync('customerLocations', item, true);
    return item;
}

export async function temporaryData_afterInsert(item, context) {
    mirrorToSupabaseAsync('temporaryData', item, false);
    return item;
}

export async function temporaryData_afterUpdate(item, context) {
    mirrorToSupabaseAsync('temporaryData', item, false);
    return item;
}

// ==========================================
// 🗑️ 4. AFTER REMOVE HOOK (Wipes Google Calendar Events + Marks Cancelled in Supabase)
// ==========================================
export async function scheduledJobs_afterRemove(item, context) {
    mirrorToSupabaseAsync('scheduledJobs', item, true);
    let googleEventId = item.googleEventId;
    let googleAdminEventId = item.googleAdminEventId;

    if (!googleEventId && !googleAdminEventId) return item;

    try {
        let detailerCalId = null;

        if (item.detailerId) {
            let detailerRes = await wixData.query("contractors")
                .eq("_id", item.detailerId)
                .find({ suppressAuth: true });
            
            if (detailerRes.items.length > 0) {
                let selDet = detailerRes.items[0];
                detailerCalId = selDet.googleCalendarId || selDet.email;
            }
        }

        console.log(`📌 [BACKEND_DATA_HOOKS -> scheduledJobs_afterRemove]: Job ${item?._id} deleted in CMS. Wiping Google Events...`);
        await deleteGoogleEvent(detailerCalId, googleEventId, googleAdminEventId);
        
    } catch (err) {
        console.error("📌 [BACKEND_DATA_HOOKS -> scheduledJobs_afterRemove]: 🚨 Error wiping Google Events:", err);
    }

    return item;
}