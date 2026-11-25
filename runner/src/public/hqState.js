// --- public/hqState.js ---

import { formatPhoneNumber } from 'public/cartEngine';

export function createEmptyDraft() {
    return {
        editingCartId: null,
        customerId: null,
        primaryContactText: "No Primary Contact",
        vehicleId: null,
        contactId: null,
        locationId: null,
        packageId: null,
        packageTitle: "No Package Selected",
        level: null,
        type: null,
        basePrice: 0,
        salePackagePrice: 0,
        mobileFee: 0,
        subTotal: 0,
        setDuration: "3",
        totalPrice: 0,
        interiorAddOns: [],
        exteriorAddOns: [],
        customAddOns: [],
        totalAddOnsPrice: 0,
        discountsApplied: [],
        discountsTotal: 0,
        officeNotes: "",
        vehicleNotes: "",
        assignedDate: null,
        assignedTime: null,
        assignedDetailerId: null
    };
}

export const hqState = {
    $w: null,
    hooks: {},

    // UI Flags
    isVaultUnlocked: true,
    isMenuExpanded: false,
    isSavingInfo: false,
    isGeneratingWeeks: false,
    isHoveringOffice: false,
    isBookingRepInitialized: false,
    isSwitchingTab: false,
    newTabCounter: 0,

    // Master CMS Data
    globalDetailers: [],
    globalJobs: [],
    globalAvailabilityRules: [],
    globalPackages: [],
    globalAddOns: [],
    globalVehicleCategories: [],
    globalCustomerContacts: [],
    globalCustomerLocations: [],
    globalCustomerVehicles: [],
    globalBookingButtons: [],
    globalViewButtons: [],
    globalOfficeButtons: [],
    globalHqButtons: [],
    globalTimeSlots: [],

    // Calendar & Session State
    calendarData: [],
    selectedCalendarDate: null,
    currentWeekStartObj: null,
    globalCart: [],
    selectedCartItemId: null,
    draftSessions: [],
    activeTabId: null,
    selectedTabIds: [],
    selectedPreviousJobId: null,
    pendingJobUpdate: null,

    // Active Draft Object
    currentDraft: createEmptyDraft(),

    // Cross-Module Callback Registry (Avoids circular import dependencies)
    callbacks: {
        syncDailyButtonStyles: (...args) => {},
        loadDailyDetailers: (...args) => {},
        generateWeeklyCalendar: (...args) => {},
        paintWeeklyCalendarUI: (...args) => {},
        refreshCustomAddOnsRepeater: (...args) => {},
        paintSummaryBox: (...args) => {},
        clearDetailData: (...args) => {},
        clearCustomerData: (...args) => {},
        resetCustomerDropdowns: (...args) => {},
        openCustomerForm: (...args) => {},
        loadCustomerForExistingJob: async (...args) => {},
        loadCustomerHistory: async (...args) => {},
        triggerCancellationLightbox: (...args) => {},
        loadDraftFromCart: (...args) => {},
        closeOfficeMenu: (...args) => {},
        refreshHqCalendarMenuRepeater: (...args) => {},
        closeAllMenus: (...args) => {},
        syncHqPackagesToVehicle: (...args) => {}
    }
};

// ==========================================
// 🛠️ UNIVERSAL FORMATTERS & LIGHTBOX HELPERS
// ==========================================

export function getMountainDateString(rawDate) {
    if (!rawDate) return "";
    let d = new Date(rawDate);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString('en-US', { timeZone: 'America/Chicago' });
}

export function parseTags(tagArray) {
    if (!tagArray || !Array.isArray(tagArray)) return [];
    return tagArray.map(tag => {
        if (typeof tag === 'object') return { title: tag.title || "Add-On", price: parseFloat(tag.price) || 0 };
        let match = String(tag).match(/(.*?)\s*\(-?\$?([\d.]+)\)/);
        if (match) return { title: match[1].trim(), price: parseFloat(match[2]) };
        return { title: String(tag), price: 0 };
    });
}

export function parseSummaryTags(rawVal) {
    if (!rawVal || !Array.isArray(rawVal)) return [];
    return rawVal.map(tag => {
        if (typeof tag === 'object') return { title: tag.title || "Item", price: Number(tag.price || 0) };
        let match = String(tag).match(/(.*?)\s*\(-?\$?([\d.]+)\)/);
        if (match) return { title: match[1].trim(), price: parseFloat(match[2]) };
        return { title: String(tag), price: 0 };
    });
}

export function formatPrevPackageAbbrev(job) {
    if (!job) return "Full Classic";
    let rawType = (job.type || "").toLowerCase();
    let rawLevel = job.level || "";
    let pkgTitle = (job.packageTitle || "").toLowerCase();

    let typeAbbrev = "Full";
    if (rawType.includes("ext") || pkgTitle.includes("exterior")) {
        typeAbbrev = "Ext";
    } else if (rawType.includes("int") || pkgTitle.includes("interior")) {
        typeAbbrev = "Int";
    } else if (rawType.includes("full") || pkgTitle.includes("full")) {
        typeAbbrev = "Full";
    }

    if (!rawLevel || rawLevel === "N/A") {
        if (pkgTitle.includes("premium plus")) rawLevel = "Premium Plus";
        else if (pkgTitle.includes("premium")) rawLevel = "Premium";
        else if (pkgTitle.includes("luxury")) rawLevel = "Luxury";
        else rawLevel = "Classic";
    }

    return `${typeAbbrev} ${rawLevel}`.trim();
}

export function formatPrevVehicleShort(job) {
    if (!job) return "No Vehicle";
    let yrRaw = String(job.vehicleYear || "").trim();
    let model = String(job.vehicleModel || "").trim();
    let color = String(job.vehicleColor || "").trim();

    if (!yrRaw && !model && job.vehicleId) {
        let matchedVeh = hqState.globalCustomerVehicles.find(v => v._id === job.vehicleId);
        if (matchedVeh) {
            yrRaw = String(matchedVeh.year || "").trim();
            model = String(matchedVeh.model || "").trim();
            color = String(matchedVeh.color || "").trim();
        }
    }

    if (!yrRaw && !model && job.vehicleInfo) {
        let parts = String(job.vehicleInfo).trim().split(/\s+/);
        if (parts.length > 0 && /^\d{4}$/.test(parts[0])) {
            yrRaw = parts.shift();
        }
        if (parts.length > 0) parts.shift(); // skip make
        if (parts.length > 1) {
            color = parts.pop();
            model = parts.join(" ");
        } else if (parts.length === 1) {
            model = parts[0];
        }
    }

    let shortYr = yrRaw.length >= 2 ? `'${yrRaw.slice(-2)}` : yrRaw;
    let firstModelWord = model ? model.split(/\s+/)[0] : "";

    return [shortYr, firstModelWord, color].filter(Boolean).join(" ").trim() || "No Vehicle";
}

export function formatBookingDateText(item) {
    if (item && (item.assignedDate || item.serviceDate)) {
        let d = new Date(item.assignedDate || item.serviceDate);
        let timeStr = item.assignedTime || item.scheduledTime || "";
        if (!isNaN(d.getTime())) {
            let dateFormatted = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
            return timeStr ? `${dateFormatted} @ ${timeStr}` : dateFormatted;
        }
    }
    return "No Date Scheduled";
}

export function formatBookingVehicleText(item) {
    if (!item) return "No Vehicle attached";
    let v = item.rawVehicle || (item.vehicleId ? hqState.globalCustomerVehicles.find(veh => veh._id === item.vehicleId) : null);
    if (v) {
        let baseVeh = `${v.year || ''} ${v.make || ''} ${v.model || ''} ${v.color || ''}`.replace(/\s+/g, ' ').trim();
        let lenVal = Number(v.length || 0);
        let lenStr = lenVal > 0 ? ` - ${lenVal} ft` : "";
        return (baseVeh + lenStr).trim() || "No Vehicle attached";
    }
    return item.resolvedVehicle || item.vehicleInfo || "No Vehicle attached";
}

export function formatBookingCustomerText(item) {
    if (!item) return "No Customer attached";
    let c = item.rawContact || (item.contactId ? hqState.globalCustomerContacts.find(con => con._id === item.contactId) : null);
    if (c) {
        let name = `${c.firstName || ''} ${c.lastName || ''}`.trim();
        let phone = c.phone ? formatPhoneNumber(c.phone) : "";
        if (name && phone) return `${name} - ${phone}`;
        return name || phone || "No Customer attached";
    }
    if (item.resolvedContact && item.resolvedContact !== "Pending Contact...") {
        return item.resolvedContact;
    }
    if (item.primaryContactText && item.primaryContactText !== "No Primary Contact") {
        return item.primaryContactText;
    }
    return "No Customer attached";
}

export function formatBookingAddressLines(item) {
    if (!item) return { line1: "No Location attached", line2: "" };
    let l = item.rawLocation || (item.locationId ? hqState.globalCustomerLocations.find(loc => loc._id === item.locationId) : null);
    if (l) {
        let addr1 = `${l.address1 || ''} ${l.address2 || ''}`.replace(/\s+/g, ' ').trim();
        let cityStateZip = `${l.city || ''}${l.city && l.state ? ', ' : ''}${l.state || ''} ${l.zip || ''}`.replace(/\s+/g, ' ').trim();
        return {
            line1: addr1 || "No Street Address",
            line2: cityStateZip || ""
        };
    }
    if (item.address1) {
        let addr1 = `${item.address1 || ''} ${item.address2 || ''}`.replace(/\s+/g, ' ').trim();
        let cityStateZip = `${item.city || ''}${item.city && item.state ? ', ' : ''}${item.state || ''} ${item.zip || ''}`.replace(/\s+/g, ' ').trim();
        return {
            line1: addr1,
            line2: cityStateZip
        };
    }
    if (item.resolvedLocation && item.resolvedLocation !== "Pending Location...") {
        let parts = item.resolvedLocation.split(" - ");
        return {
            line1: parts[0] ? parts[0].trim() : item.resolvedLocation,
            line2: parts[1] ? parts[1].trim() : ""
        };
    }
    return {
        line1: item.locationText || "No Location attached",
        line2: ""
    };
}

export function closeAllLightboxes(hideBackdrop = true) {
    const $w = hqState.$w;
    if (!$w) return;

    console.log(`📌 [HQ_STATE -> closeAllLightboxes]: Closing all lightboxes (hideBackdrop=${hideBackdrop})`);

    ["#addOnBoxI", "#addOnBoxE", "#tabMenuBox", "#hqCalendarMenuBox"].forEach(boxId => {
        if ($w(boxId).id) {
            $w(boxId).hide("fade", { duration: 150 });
            $w(boxId).collapse();
        }
    });

    if ($w("#msbOffice").id && !$w("#msbOffice").collapsed) {
        $w("#msbOffice").collapse();
    }

    if ($w("#officeBox").id && !$w("#officeBox").hidden) {
        $w("#officeBox").hide("fade", { duration: 150 }).then(() => {
            $w("#officeBox").collapse();
        });
    }

    if (hideBackdrop && $w("#lightboxBackground").id && !$w("#lightboxBackground").hidden) {
        $w("#lightboxBackground").hide("fade", { duration: 150 });
    }
}

export function safeOpenOffice(targetState) {
    const $w = hqState.$w;
    if (!$w) return;

    if ($w("#msbOffice").id) {
        $w("#msbOffice").changeState(targetState);
        $w("#msbOffice").expand();
    }
    if ($w("#officeBox").id) {
        $w("#officeBox").expand();
        $w("#officeBox").show();
    }
    if ($w("#lightboxBackground").id) {
        $w("#lightboxBackground").expand();
        $w("#lightboxBackground").show("fade", { duration: 200 });
    }
}