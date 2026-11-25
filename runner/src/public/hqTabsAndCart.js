// --- public/hqTabsAndCart.js ---

import wixData from 'wix-data';
import { formatPhoneNumber } from 'public/cartEngine';
import {
    hqState,
    createEmptyDraft,
    parseTags,
    parseSummaryTags,
    formatPrevPackageAbbrev,
    formatPrevVehicleShort,
    formatBookingVehicleText,
    formatBookingDateText,
    formatBookingAddressLines,
    formatBookingCustomerText,
    closeAllLightboxes
} from 'public/hqState';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

let lastAddTabClickTime = 0;
let lastSwitchTabClickTime = 0;
let lastHqMenuClickTime = 0;
let isHqMenuRepInitialized = false;
let isTabMenusWired = false;

registerModuleState("hqTabsAndCart", () => ({
    activeTabId: hqState.activeTabId,
    selectedCartItemId: hqState.selectedCartItemId,
    selectedTabIds: hqState.selectedTabIds || [],
    newTabCounter: hqState.newTabCounter || 0,
    isSwitchingTab: Boolean(hqState.isSwitchingTab),
    isBookingRepInitialized: Boolean(hqState.isBookingRepInitialized),
    isHqMenuRepInitialized,
    isTabMenusWired,
    draftSessionsCount: (hqState.draftSessions || []).length,
    tabsSummary: (hqState.draftSessions || []).map(d => ({
        _id: d._id,
        label: d.label,
        isExistingBooking: Boolean(d.isExistingBooking),
        isCorrectionDraft: Boolean(d.isCorrectionDraft),
        isReschedulingMode: Boolean(d.isReschedulingMode),
        packageTitle: d.packageTitle,
        totalPrice: d.totalPrice
    }))
}));

registerDomElements({
    boxes: ["#tabMenuBox", "#hqCalendarMenuBox"],
    repeaters: ["#tabRepeater", "#hqCalendarMenuRep", "#bookingRep"]
});

export function formatDynamicTabLabel(item) {
    if (!item) return "New Tab 1";
    if (item.isExistingBooking) return "Prev";
    if (item.isCorrectionDraft) return "Corr";

    // 1. Check for Package Level (abbv)
    let hasPackage = Boolean(
        item.packageId ||
        (item.packageTitle && item.packageTitle !== "No Package Selected")
    );
    let pkgAbbrev = hasPackage ? formatPrevPackageAbbrev(item) : "";

    // 2. Check for Vehicle Model
    let modelStr = "";
    let v = item.rawVehicle || (item.vehicleId ? hqState.globalCustomerVehicles.find(veh => veh._id === item.vehicleId) : null);
    if (v && v.model) {
        modelStr = String(v.model).trim();
    } else if (item.vehicleModel) {
        modelStr = String(item.vehicleModel).trim();
    } else if (item.resolvedVehicle && item.resolvedVehicle !== "Pending Vehicle..." && item.resolvedVehicle !== "No Vehicle attached" && item.resolvedVehicle !== "No Vehicle") {
        let parts = String(item.resolvedVehicle).split(" - ")[0].trim().split(/\s+/);
        if (parts.length > 0 && (/^\d{4}$/.test(parts[0]) || /^'\d{2}$/.test(parts[0]))) parts.shift();
        if (parts.length > 1) parts.shift(); // skip make if make + model present
        modelStr = parts[0] || "";
    }

    // 3. Check for City (first 6 characters)
    let cityStr = "";
    let l = item.rawLocation || (item.locationId ? hqState.globalCustomerLocations.find(loc => loc._id === item.locationId) : null);
    if (l && l.city) {
        cityStr = String(l.city).trim().substring(0, 6);
    } else if (item.city && item.city !== "Local") {
        cityStr = String(item.city).trim().substring(0, 6);
    } else if (item.resolvedLocation && item.resolvedLocation !== "Pending Location..." && item.resolvedLocation !== "No Location attached") {
        let locParts = String(item.resolvedLocation).split("-");
        let afterDash = locParts.length > 1 ? locParts[locParts.length - 1] : locParts[0];
        let commaParts = afterDash.split(",");
        let candidateCity = commaParts.length > 1 ? commaParts[0].trim() : "";
        if (candidateCity && !/^\d/.test(candidateCity)) {
            cityStr = candidateCity.substring(0, 6);
        }
    }

    // Combine only the pieces that are actually available
    let availableParts = [pkgAbbrev, modelStr, cityStr].filter(Boolean);
    if (availableParts.length > 0) {
        return availableParts.join(", ");
    }

    // Fallback when tab has no data yet
    let tabNum = item.emptyTabNumber || 1;
    return `New Tab ${tabNum}`;
}

export function syncTabMenuButtonLabel() {
    const $w = hqState.$w;
    if (!$w || !$w("#tabMenu").id) return;

    let activeItem = hqState.activeTabId
        ? hqState.draftSessions.find(d => d._id === hqState.activeTabId)
        : null;

    if (activeItem) {
        activeItem.label = formatDynamicTabLabel(activeItem);
        $w("#tabMenu").label = activeItem.label;
    } else {
        $w("#tabMenu").label = "No Tab Selected";
    }
}

function hideBackdropIfNoHqMenusOpen($w, closingIds = []) {
    if (!$w || !$w("#lightboxBackground").id || $w("#lightboxBackground").hidden) return;
    const isVisible = (id) => !closingIds.includes(id) && $w(id).id && !$w(id).hidden && !$w(id).collapsed;

    if (
        !isVisible("#tabMenuBox") &&
        !isVisible("#hqCalendarMenuBox") &&
        !isVisible("#addOnBoxI") &&
        !isVisible("#addOnBoxE") &&
        !isVisible("#officeBox") &&
        !isVisible("#msbOffice") &&
        !isVisible("#msbMenu") &&
        !isVisible("#siteMenu")
    ) {
        $w("#lightboxBackground").hide("fade", { duration: 150 }).then(() => {
            if ($w("#lightboxBackground").hidden) $w("#lightboxBackground").collapse();
        }).catch(() => {});
    }
}

export function closeTabAndCalendarMenus() {
    const $w = hqState.$w;
    if (!$w) return;
    hideBackdropIfNoHqMenusOpen($w, ["#tabMenuBox", "#hqCalendarMenuBox"]);

    if ($w("#tabMenuBox").id && !$w("#tabMenuBox").hidden) {
        $w("#tabMenuBox").hide("fade", { duration: 150 }).then(() => {
            if ($w("#tabMenuBox").hidden) $w("#tabMenuBox").collapse();
        }).catch(() => {});
    }
    if ($w("#hqCalendarMenuBox").id && !$w("#hqCalendarMenuBox").hidden) {
        $w("#hqCalendarMenuBox").hide("fade", { duration: 150 }).then(() => {
            if ($w("#hqCalendarMenuBox").hidden) $w("#hqCalendarMenuBox").collapse();
        }).catch(() => {});
    }
}

function initToggleMenusOnce() {
    const $w = hqState.$w;
    if (!$w || isTabMenusWired) return;
    isTabMenusWired = true;

    if ($w("#tabMenuBox").id && !$w("#tabMenuBox").hidden) {
        $w("#tabMenuBox").hide();
    }
    if ($w("#hqCalendarMenuBox").id && !$w("#hqCalendarMenuBox").hidden) {
        $w("#hqCalendarMenuBox").hide();
    }

    if ($w("#tabMenu").id) {
        $w("#tabMenu").onClick(async () => {
            if (!$w("#tabMenuBox").id) return;
            if ($w("#tabMenuBox").hidden || $w("#tabMenuBox").collapsed) {
                if ($w("#hqCalendarMenuBox").id && !$w("#hqCalendarMenuBox").hidden) {
                    $w("#hqCalendarMenuBox").hide("fade", { duration: 150 });
                }
                if ($w("#lightboxBackground").id) {
                    $w("#lightboxBackground").expand();
                    $w("#lightboxBackground").show("fade", { duration: 150 }).catch(() => {});
                }
                renderTabs(true);
                if ($w("#tabMenuBox").collapsed) $w("#tabMenuBox").expand();
                await $w("#tabMenuBox").show("fade", { duration: 150 });
            } else {
                await $w("#tabMenuBox").hide("fade", { duration: 150 });
                $w("#tabMenuBox").collapse();
                hideBackdropIfNoHqMenusOpen($w);
            }
        });
    }

    if ($w("#hqCalendarMenu").id) {
        $w("#hqCalendarMenu").onClick(async () => {
            if (!$w("#hqCalendarMenuBox").id) return;
            if ($w("#hqCalendarMenuBox").hidden || $w("#hqCalendarMenuBox").collapsed) {
                if ($w("#tabMenuBox").id && !$w("#tabMenuBox").hidden) {
                    $w("#tabMenuBox").hide("fade", { duration: 150 });
                }
                if ($w("#lightboxBackground").id) {
                    $w("#lightboxBackground").expand();
                    $w("#lightboxBackground").show("fade", { duration: 150 }).catch(() => {});
                }
                refreshHqCalendarMenuRepeater();
                if ($w("#hqCalendarMenuBox").collapsed) $w("#hqCalendarMenuBox").expand();
                await $w("#hqCalendarMenuBox").show("fade", { duration: 150 });
            } else {
                await $w("#hqCalendarMenuBox").hide("fade", { duration: 150 });
                $w("#hqCalendarMenuBox").collapse();
                hideBackdropIfNoHqMenusOpen($w);
            }
        });
    }
}

// ==========================================
// 🗂️ MULTI-TAB SESSION MANAGER
// ==========================================
export function createNewTab() {
    let now = Date.now();
    if (hqState.isSwitchingTab || (now - lastAddTabClickTime < 350)) return;
    lastAddTabClickTime = now;

    hqState.newTabCounter = (hqState.newTabCounter || 0) + 1;
    let tabNum = hqState.newTabCounter;
    let newTabId = "draft_" + now.toString();

    let newDraft = {
        ...createEmptyDraft(),
        _id: newTabId,
        editingCartId: newTabId,
        isJob: true,
        emptyTabNumber: tabNum,
        label: `New Tab ${tabNum}`,
        originalJobId: null,
        serviceDate: null,
        timeToken: null
    };

    // 🌟 New tabs always move to the TOP of the list, pushing older tabs down!
    hqState.draftSessions.unshift(newDraft);
    hqState.globalCart = hqState.draftSessions;

    hqState.selectedTabIds = [newTabId];
    hqState.activeTabId = null;
    renderTabs(true);
    switchTab(newTabId, true);
}

export async function switchTab(tabId, forceSelect = false) {
    const $w = hqState.$w;
    if (!$w || hqState.isSwitchingTab) return;
    hqState.isSwitchingTab = true;

    try {
        let currentState = ($w("#msbCustomer").id && $w("#msbCustomer").currentState)
            ? $w("#msbCustomer").currentState.id
            : "bCalendar";
        let isCalendarState = (currentState === "bCalendar");

        let prevTab = hqState.draftSessions.find(d => d.isExistingBooking);
        if (prevTab && !forceSelect) {
            if (tabId === prevTab._id && hqState.activeTabId === prevTab._id) {
                hqState.draftSessions = hqState.draftSessions.filter(d => !d.isExistingBooking);
                hqState.activeTabId = hqState.draftSessions.length > 0 ? hqState.draftSessions[0]._id : null;
                hqState.selectedCartItemId = hqState.activeTabId;
                hqState.selectedTabIds = hqState.activeTabId ? [hqState.activeTabId] : [];
                renderTabs(true);
            } else if (tabId !== prevTab._id) {
                hqState.draftSessions = hqState.draftSessions.filter(d => !d.isExistingBooking);
                hqState.activeTabId = tabId;
                hqState.selectedCartItemId = tabId;
                hqState.selectedTabIds = [tabId];
                renderTabs(true);
            }
        } else if (!forceSelect) {
            if (isCalendarState) {
                if (hqState.activeTabId === tabId) {
                    hqState.activeTabId = null;
                    hqState.selectedCartItemId = null;
                    hqState.selectedTabIds = [];
                } else {
                    hqState.activeTabId = tabId;
                    hqState.selectedCartItemId = tabId;
                    hqState.selectedTabIds = [tabId];
                }
            } else {
                if (hqState.selectedTabIds.includes(tabId)) {
                    hqState.selectedTabIds = hqState.selectedTabIds.filter(id => id !== tabId);
                } else {
                    hqState.selectedTabIds.push(tabId);
                }
                hqState.activeTabId = hqState.selectedTabIds.length > 0
                    ? hqState.selectedTabIds[hqState.selectedTabIds.length - 1]
                    : null;
                hqState.selectedCartItemId = hqState.activeTabId;
            }
        } else {
            hqState.activeTabId = tabId;
            hqState.selectedCartItemId = tabId;
            hqState.selectedTabIds = [tabId];
        }

        syncTabButtonsState();
        syncTabMenuButtonLabel();

        if (!hqState.activeTabId) {
            hqState.currentDraft = createEmptyDraft();
            hqState.callbacks.resetCustomerDropdowns();
            hqState.callbacks.clearDetailData();
            await paintBookingCart(false);
            hqState.callbacks.syncDailyButtonStyles();
            return;
        }

        let foundTab = hqState.draftSessions.find(d => d._id === hqState.activeTabId);
        if (foundTab) hqState.currentDraft = foundTab;

        await paintBookingCart(false);
        hqState.callbacks.syncDailyButtonStyles();

        let cd = hqState.currentDraft;
        if ($w("#vehicleDropdown").id) $w("#vehicleDropdown").value = cd.vehicleId || null;
        if ($w("#contactDropdown").id) $w("#contactDropdown").value = cd.contactId || null;
        if ($w("#locationDropdown").id) $w("#locationDropdown").value = cd.locationId || null;
        if ($w("#newPackagesDropdown").id) $w("#newPackagesDropdown").value = cd.packageId || null;
        if ($w("#masterPriceInput").id) $w("#masterPriceInput").value = cd.totalPrice ? cd.totalPrice.toString() : "";
        if ($w("#newNotes").id) $w("#newNotes").value = cd.officeNotes || "";

        hqState.callbacks.refreshCustomAddOnsRepeater();
        hqState.callbacks.paintSummaryBox();
    } finally {
        hqState.isSwitchingTab = false;
    }
}

export function initTabs() {
    const $w = hqState.$w;
    if (!$w) return;

    initToggleMenusOnce();
    if (!$w("#tabRepeater").id) return;

    // 🌟 Only uses #tabButton inside #tabRepeater (including "Add a New Tab" at the bottom)
    $w("#tabRepeater").onItemReady(($item, initialItemData) => {
        if ($item("#addTabButton").id) $item("#addTabButton").collapse();

        if ($item("#tabButton").id) {
            $item("#tabButton").expand();
            $item("#tabButton").label = initialItemData.label || "New Tab 1";

            if (initialItemData.isJob && hqState.selectedTabIds.includes(initialItemData._id)) {
                $item("#tabButton").disable();
            } else {
                $item("#tabButton").enable();
            }

            $item("#tabButton").onClick(() => {
                let now = Date.now();
                if (now - lastSwitchTabClickTime < 250) return;
                lastSwitchTabClickTime = now;

                let currentData = $w("#tabRepeater").data || [];
                let liveItem = currentData.find(d => String(d._id) === String(initialItemData._id)) || initialItemData;

                if (!liveItem.isJob || liveItem._id === "add_new_btn") {
                    createNewTab();
                    closeTabAndCalendarMenus();
                } else {
                    switchTab(liveItem._id, false);
                    closeTabAndCalendarMenus();
                }
            });
        }
    });
}

export function syncTabButtonsState() {
    const $w = hqState.$w;
    if (!$w || !$w("#tabRepeater").id) return;

    $w("#tabRepeater").forEachItem(($item, itemData) => {
        if ($item("#addTabButton").id) $item("#addTabButton").collapse();

        if ($item("#tabButton").id) {
            $item("#tabButton").expand();
            if (itemData.isJob) {
                let liveDraft = hqState.draftSessions.find(d => d._id === itemData._id);
                let resolvedLabel = liveDraft ? formatDynamicTabLabel(liveDraft) : (itemData.label || "New Tab 1");
                if (liveDraft) liveDraft.label = resolvedLabel;
                $item("#tabButton").label = resolvedLabel;

                if (hqState.selectedTabIds.includes(itemData._id)) {
                    $item("#tabButton").disable();
                } else {
                    $item("#tabButton").enable();
                }
            } else {
                $item("#tabButton").label = "Add a New Tab";
                $item("#tabButton").enable();
            }
        }
    });

    syncTabMenuButtonLabel();
}

export function renderTabs(forceDataSync = false) {
    const $w = hqState.$w;
    if (!$w || !$w("#tabRepeater").id) return;

    let currentData = $w("#tabRepeater").data || [];
    let expectedLength = hqState.draftSessions.length + 1;

    if (forceDataSync || currentData.length !== expectedLength) {
        let tabData = hqState.draftSessions.map((d, idx) => {
            if (!d.emptyTabNumber) {
                hqState.newTabCounter = Math.max(hqState.newTabCounter || 0, idx + 1);
                d.emptyTabNumber = hqState.newTabCounter;
            }
            d.label = formatDynamicTabLabel(d);
            return { _id: d._id, isJob: true, label: d.label };
        });

        // Always keep "Add a New Tab" as the last item in the repeater list
        tabData.push({ _id: "add_new_btn", isJob: false, label: "Add a New Tab" });

        $w("#tabRepeater").data = tabData;
    }

    syncTabButtonsState();
}

export async function clearBookedTabFromCartAndRepeater(completedTabId) {
    hqState.draftSessions = hqState.draftSessions.filter(d => d._id !== completedTabId && !d.isExistingBooking);
    hqState.globalCart = hqState.draftSessions;

    hqState.activeTabId = null;
    hqState.selectedCartItemId = null;
    hqState.selectedTabIds = [];

    hqState.callbacks.clearDetailData();
    renderTabs(true);
    await paintBookingCart(false);
    hqState.callbacks.syncDailyButtonStyles();
}

export async function removePrevTabAndDeselect() {
    hqState.draftSessions = hqState.draftSessions.filter(d => !d.isExistingBooking);
    hqState.globalCart = hqState.draftSessions;
    hqState.activeTabId = null;
    hqState.selectedCartItemId = null;
    hqState.selectedTabIds = [];
    renderTabs(true);
    hqState.callbacks.syncDailyButtonStyles();
    await paintBookingCart(false);
}

// ==========================================
// 📋 HQ CALENDAR MENU REPEATER (#hqCalendarMenuRep)
// ==========================================
// Helper: Checks if the active tab has a package or add-ons attached
export function hasDetailAttached(item) {
    if (!item) return false;
    let hasPkg = Boolean(
        item.packageId ||
        (item.packageTitle &&
         item.packageTitle !== "No Package Selected" &&
         item.packageTitle !== "Scheduled Detail")
    );
    let hasAddOns = Boolean(
        (Array.isArray(item.interiorAddOns) && item.interiorAddOns.length > 0) ||
        (Array.isArray(item.exteriorAddOns) && item.exteriorAddOns.length > 0) ||
        (Array.isArray(item.customAddOns) && item.customAddOns.length > 0)
    );
    return hasPkg || hasAddOns;
}

export function refreshHqCalendarMenuRepeater() {
    const $w = hqState.$w;
    if (!$w || !$w("#hqCalendarMenuRep").id) return;

    let baseButtons = hqState.globalHqButtons && hqState.globalHqButtons.length > 0
        ? [...hqState.globalHqButtons]
        : [
            { _id: "hq_calendar", title: "Calendar", sort: "0" },
            { _id: "hq_edit_detail", title: "Edit Detail", sort: "a" },
            { _id: "hq_edit_info", title: "Edit Info", sort: "b" },
            { _id: "hq_reschedule", title: "Reschedule", sort: "c" },
            { _id: "hq_duplicate", title: "Duplicate", sort: "d" },
            { _id: "hq_delete", title: "Delete", sort: "e" }
        ];

    // Ensure "Calendar" is present even if not added to #siteButtons CMS yet
    if (!baseButtons.some(b => String(b.title || "").toLowerCase().includes("calendar"))) {
        baseButtons.unshift({ _id: "hq_calendar", title: "Calendar", sort: "0" });
    }

    // Sort A-Z by #sort
    baseButtons.sort((a, b) => {
        let sA = String(a.sort ?? "").trim();
        let sB = String(b.sort ?? "").trim();
        if (sA !== sB) {
            return sA.localeCompare(sB, undefined, { numeric: true, sensitivity: 'base' });
        }
        return String(a.title || "").localeCompare(String(b.title || ""));
    });

    $w("#hqCalendarMenuRep").data = baseButtons;
    syncHqCalendarMenuButtonsState();
}

export function syncHqCalendarMenuButtonsState() {
    const $w = hqState.$w;
    if (!$w || !$w("#hqCalendarMenuRep").id) return;

    let activeItem = hqState.activeTabId ? hqState.draftSessions.find(d => d._id === hqState.activeTabId) : null;
    let isCompletedJob = Boolean(activeItem && activeItem.isExistingBooking && activeItem.status === "Completed");
    let isBookedJob = Boolean(activeItem && (activeItem.isExistingBooking || activeItem.originalJobId));
    let isResched = Boolean(!isCompletedJob && isBookedJob && activeItem.isReschedulingMode);
    let detailAttached = hasDetailAttached(activeItem);

    $w("#hqCalendarMenuRep").forEachItem(($item, itemData) => {
        let btn = $item("#hqCalendarMenuButton");
        if (!btn.id) return;

        let rawTitle = String(itemData.title || "Action");
        let t = rawTitle.toLowerCase();

        // "Calendar" button is always enabled regardless of tab selection
        if (t.includes("calendar")) {
            btn.label = rawTitle;
            btn.enable();
            return;
        }

        // Dynamic label for "Edit Detail" / "Add a Detail"
        if (t.includes("detail")) {
            btn.label = detailAttached ? "Edit Detail" : "Add a Detail";
            if (!activeItem || isCompletedJob) {
                btn.disable();
            } else {
                btn.enable();
            }
            return;
        }

        if (!activeItem) {
            btn.label = rawTitle;
            btn.disable();
            return;
        }

        if (t.includes("reschedule")) {
            if (isCompletedJob) {
                btn.label = "Completed";
                btn.disable();
            } else if (!isBookedJob) {
                btn.label = rawTitle;
                btn.disable();
            } else {
                btn.label = isResched ? `Stop ${rawTitle}` : rawTitle;
                btn.enable();
            }
        } else if (t.includes("duplicate")) {
            btn.label = rawTitle;
            btn.enable();
        } else if (t.includes("delete") || t.includes("cancel") || t.includes("info")) {
            btn.label = rawTitle;
            isCompletedJob ? btn.disable() : btn.enable();
        } else {
            btn.label = rawTitle;
            btn.enable();
        }
    });
}

async function handleHqMenuAction(itemData) {
    const $w = hqState.$w;
    if (!$w) return;

    let t = String(itemData.title || "").toLowerCase();
    let target = String(itemData.targetState || "").toLowerCase();

    const closeHqMenu = () => {
        closeTabAndCalendarMenus();
    };

    // 0. Calendar -> Switch #msbCustomer to state "bCalendar"
    if (t.includes("calendar") || target.includes("bcalendar")) {
        closeHqMenu();
        closeAllLightboxes();
        if ($w("#msbCustomer").id && $w("#msbCustomer").currentState?.id !== "bCalendar") {
            $w("#msbCustomer").changeState("bCalendar");
        }
        return;
    }

    let activeItem = hqState.activeTabId ? hqState.draftSessions.find(d => d._id === hqState.activeTabId) : null;
    if (!activeItem) return;

    // 1. Edit Detail / Add a Detail
    if (t.includes("detail") || target.includes("bnewdetail")) {
        if (activeItem.status === "Completed") return;
        closeHqMenu();
        hqState.callbacks.loadDraftFromCart(hqState.activeTabId, true, "bNewDetail");
        return;
    }

    // 2. Edit Info -> Hydrate the selected tab's customer data into #customerInfoBox using the PRIMARY account phone in #phoneSearch
    if (t.includes("info") || t.includes("customer") || target.includes("customerinfobox")) {
        if (activeItem.status === "Completed") return;
        closeHqMenu();

        hqState.callbacks.loadDraftFromCart(hqState.activeTabId, true, "customerInfoBox");

        if (activeItem.customerId) {
            await hqState.callbacks.loadCustomerForExistingJob(activeItem.customerId);

            if ($w("#contactDropdown").id && activeItem.contactId) {
                $w("#contactDropdown").value = activeItem.contactId;
                hqState.currentDraft.contactId = activeItem.contactId;
            }
            if ($w("#locationDropdown").id && activeItem.locationId) {
                $w("#locationDropdown").value = activeItem.locationId;
                hqState.currentDraft.locationId = activeItem.locationId;
            }
            if ($w("#vehicleDropdown").id && activeItem.vehicleId) {
                $w("#vehicleDropdown").value = activeItem.vehicleId;
                hqState.currentDraft.vehicleId = activeItem.vehicleId;
            }

            // 🌟 Auto-select this scheduled job inside #previousRep so #customerInfoBox knows which job is active!
            if (activeItem.originalJobId && $w("#previousRep").id) {
                hqState.selectedPreviousJobId = activeItem.originalJobId;
                $w("#previousRep").forEachItem(($item, itemData) => {
                    let isSel = String(itemData._id) === String(activeItem.originalJobId);
                    if ($item("#previousRepItem").id) {
                        $item("#previousRepItem").style.borderColor = isSel ? "#1A6AFF" : "#FFFFFF";
                    }
                });
            }
        } else {
            hqState.callbacks.clearCustomerData(false);
        }
        return;
    }

    // 3. Duplicate
    if (t.includes("duplicate") || t.includes("copy")) {
        closeHqMenu();
        hqState.newTabCounter = (hqState.newTabCounter || 0) + 1;
        let tabNum = hqState.newTabCounter;
        let newTabId = "draft_" + Date.now().toString();

        let duplicatedDraft = {
            ...activeItem,
            _id: newTabId,
            editingCartId: newTabId,
            emptyTabNumber: tabNum,
            status: "Scheduled",
            isExistingBooking: false,
            isReschedulingMode: false,
            originalJobId: null,
            assignedDate: null,
            assignedTime: null,
            assignedDetailerId: null,
            interiorAddOns: [...(activeItem.interiorAddOns || [])],
            exteriorAddOns: [...(activeItem.exteriorAddOns || [])],
            customAddOns: [...(activeItem.customAddOns || [])],
            discountsApplied: [...(activeItem.discountsApplied || [])]
        };
        duplicatedDraft.label = formatDynamicTabLabel(duplicatedDraft);

        hqState.draftSessions.unshift(duplicatedDraft);
        hqState.globalCart = hqState.draftSessions;
        renderTabs(true);
        switchTab(newTabId, true);
        return;
    }

    // 4. Delete / Cancel
    if (t.includes("delete") || t.includes("remove") || t.includes("cancel")) {
        if (activeItem.status === "Completed") return;
        closeHqMenu();

        if (activeItem.isExistingBooking || (activeItem.originalJobId && !activeItem.isCorrectionDraft)) {
            hqState.callbacks.triggerCancellationLightbox(activeItem);
        } else {
            hqState.draftSessions = hqState.draftSessions.filter(d => d._id !== activeItem._id);
            hqState.globalCart = hqState.draftSessions;
            if (hqState.draftSessions.length === 0) {
                createNewTab();
            } else {
                let nextId = hqState.draftSessions[0]._id;
                renderTabs(true);
                switchTab(nextId, true);
            }
        }
        return;
    }

    // 5. Reschedule
    if (t.includes("reschedule") || t.includes("move")) {
        let isBookedJob = Boolean(activeItem.isExistingBooking || activeItem.originalJobId);
        if (!isBookedJob || activeItem.status === "Completed") return;

        activeItem.isReschedulingMode = !activeItem.isReschedulingMode;
        syncHqCalendarMenuButtonsState();
        hqState.callbacks.syncDailyButtonStyles();
        closeHqMenu();

        if ($w("#msbCustomer").id && $w("#msbCustomer").currentState?.id !== "bCalendar") {
            $w("#msbCustomer").changeState("bCalendar");
        }
        return;
    }
}

export function initHqCalendarMenuRepeater() {
    const $w = hqState.$w;
    if (!$w || isHqMenuRepInitialized) return;
    initToggleMenusOnce();

    if (!$w("#hqCalendarMenuRep").id) return;
    isHqMenuRepInitialized = true;

    $w("#hqCalendarMenuRep").onItemReady(($item, initialItemData) => {
        let btn = $item("#hqCalendarMenuButton");
        if (!btn.id) return;

        btn.label = initialItemData.title || "Action";

        btn.onClick(() => {
            let now = Date.now();
            if (now - lastHqMenuClickTime < 250) return;
            lastHqMenuClickTime = now;

            let repData = $w("#hqCalendarMenuRep").data || [];
            let liveItem = repData.find(b => String(b._id) === String(initialItemData._id)) || initialItemData;
            handleHqMenuAction(liveItem);
        });
    });

    refreshHqCalendarMenuRepeater();
}

export function initBookingCartRepeater() {
    const $w = hqState.$w;
    if (!$w || hqState.isBookingRepInitialized) return;
    hqState.isBookingRepInitialized = true;

    initToggleMenusOnce();
    initHqCalendarMenuRepeater();

    if (!$w("#bookingRep").id) return;

    $w("#bookingRep").onItemReady(($item) => {
        [
            "#bookingDetail", "#bookingPrice", "#bookingVehicle", "#bookingDate",
            "#bookingInfoSource", "#bookingInfoAddress", "#bookingInfoAddress2",
            "#bookingInfoCustomer", "#bookingInfoAddOns", "#bookingInfoDiscounts"
        ].forEach(id => {
            if ($item(id).id) $item(id).expand();
        });
    });

    $w("#bookingRep").data = [{ _id: "static_active_slot" }];
    $w("#bookingRep").expand();
}

export async function paintBookingCart(animateFade = false) {
    const $w = hqState.$w;
    if (!$w || !$w("#bookingRep").id) return;
    initBookingCartRepeater();

    hqState.globalCart = hqState.draftSessions;

    if (animateFade && !$w("#bookingRep").hidden) {
        await $w("#bookingRep").hide("fade", { duration: 120 });
    }

    let activeItem = hqState.activeTabId ? hqState.draftSessions.find(d => d._id === hqState.activeTabId) : null;

    // Keep #tabRepeater, #tabMenu button label, and #hqCalendarMenuRep in sync whenever cart paints!
    syncTabButtonsState();
    syncHqCalendarMenuButtonsState();

    $w("#bookingRep").forEachItem(($item) => {
        if (activeItem) {
            let pkgTitleText = activeItem.packageTitle || formatPrevPackageAbbrev(activeItem) || "Scheduled Detail";
            if ($item("#bookingDetail").id) $item("#bookingDetail").text = pkgTitleText;
            if ($item("#bookingPrice").id) $item("#bookingPrice").text = `$${Number(activeItem.totalPrice || 0).toFixed(2)}`;
            if ($item("#bookingVehicle").id) $item("#bookingVehicle").text = formatBookingVehicleText(activeItem);
            if ($item("#bookingDate").id) $item("#bookingDate").text = formatBookingDateText(activeItem);

            if ($item("#bookingInfoSource").id) {
                let sourceStr = activeItem.wasBookedByPhone === false ? "Customer Booking" : "Office Booking";
                let durStr = `${activeItem.setDuration || activeItem.totalDuration || "3"} Hrs`;
                $item("#bookingInfoSource").text = `${sourceStr}  |  ${durStr}`;
            }

            let addrLines = formatBookingAddressLines(activeItem);
            if ($item("#bookingInfoAddress").id) $item("#bookingInfoAddress").text = addrLines.line1 || "No Street Address";
            if ($item("#bookingInfoAddress2").id) $item("#bookingInfoAddress2").text = addrLines.line2 || "No City, State, Zip";
            if ($item("#bookingInfoCustomer").id) $item("#bookingInfoCustomer").text = formatBookingCustomerText(activeItem);

            if ($item("#bookingInfoAddOns").id) {
                let allAddons = [
                    ...parseSummaryTags(activeItem.interiorAddOns),
                    ...parseSummaryTags(activeItem.exteriorAddOns),
                    ...parseSummaryTags(activeItem.customAddOns)
                ];
                if (allAddons.length > 0) {
                    $item("#bookingInfoAddOns").text = activeItem.isCorrectionDraft
                        ? allAddons.map((a, i) => `${i + 1}. ${a.title}`).join("\n")
                        : allAddons.map(a => `${a.title} (+$${Number(a.price).toFixed(2)})`).join("\n");
                } else {
                    $item("#bookingInfoAddOns").text = "No Add-Ons Selected";
                }
            }

            if ($item("#bookingInfoDiscounts").id) {
                let discounts = parseSummaryTags(activeItem.discountsApplied);
                if (discounts.length > 0) {
                    $item("#bookingInfoDiscounts").text = discounts.map(d => `${d.title} (-$${Number(d.price).toFixed(2)})`).join("\n");
                } else {
                    $item("#bookingInfoDiscounts").text = "No Discounts Applied";
                }
            }
        } else {
            if ($item("#bookingDetail").id) $item("#bookingDetail").text = "No Tab Selected";
            if ($item("#bookingPrice").id) $item("#bookingPrice").text = "$0.00";
            if ($item("#bookingVehicle").id) $item("#bookingVehicle").text = "No Vehicle attached";
            if ($item("#bookingDate").id) $item("#bookingDate").text = "No Date Scheduled";
            if ($item("#bookingInfoSource").id) $item("#bookingInfoSource").text = "Office Booking  |  0 Hrs";
            if ($item("#bookingInfoAddress").id) $item("#bookingInfoAddress").text = "No Street Address";
            if ($item("#bookingInfoAddress2").id) $item("#bookingInfoAddress2").text = "No City, State, Zip";
            if ($item("#bookingInfoCustomer").id) $item("#bookingInfoCustomer").text = "No Customer attached";
            if ($item("#bookingInfoAddOns").id) $item("#bookingInfoAddOns").text = "No Add-Ons Selected";
            if ($item("#bookingInfoDiscounts").id) $item("#bookingInfoDiscounts").text = "No Discounts Applied";
        }
    });

    if (animateFade && $w("#bookingRep").hidden) {
        await $w("#bookingRep").show("fade", { duration: 120 });
    }
}

export async function loadExistingJobIntoCart(jobId, actionType = "View") {
    const $w = hqState.$w;
    if (!$w || !jobId) return;

    let job = hqState.globalJobs.find(j => String(j._id) === String(jobId));
    if (!job) {
        let repData = $w("#previousRep").id ? ($w("#previousRep").data || []) : [];
        job = repData.find(j => String(j._id) === String(jobId) && !j.isPlaceholder);
        if (!job) {
            job = await wixData.get("scheduledJobs", jobId).catch(() => null);
        }
        if (job) hqState.globalJobs.push(job);
    }
    if (!job) return;

    // 1. Only replace an existing "Prev" tab — keep all regular tabs ("Tab 1", etc.) intact!
    hqState.draftSessions = hqState.draftSessions.filter(c => !c.isExistingBooking);

    let contactStr = job.firstName
        ? `${job.firstName} ${job.lastName || ""} - ${formatPhoneNumber(job.phone)}`.trim()
        : "Unknown Contact";
    let locationStr = job.address1
        ? `${job.address1}, ${job.address2 ? job.address2 + " " : ""}${job.city || ""} ${job.state || ""}`.trim()
        : (job.locationText || "Unknown Location");

    if (contactStr.endsWith("-")) contactStr = contactStr.substring(0, contactStr.length - 1).trim();

    let resolvedPkgTitle = job.packageTitle || job.PackageTitle || formatPrevPackageAbbrev(job) || "Scheduled Detail";
    let prevTabId = "prev_job_" + job._id;

    let cartItem = {
        _id: prevTabId,
        editingCartId: prevTabId,
        isJob: true,
        label: "Prev",
        originalJobId: job._id,
        status: job.status || "Scheduled",
        isExistingBooking: true,
        isReschedulingMode: (actionType === "Reschedule" && job.status !== "Completed"),
        isEditingOnly: (actionType === "Edit" && job.status !== "Completed"),

        customerId: job.userId || hqState.currentDraft.customerId,
        primaryContactText: contactStr,
        vehicleId: job.vehicleId,
        resolvedVehicle: job.vehicleInfo || formatPrevVehicleShort(job),
        resolvedContact: contactStr,
        resolvedLocation: locationStr,
        address1: job.address1 || "",
        address2: job.address2 || "",
        city: job.city || "",
        state: job.state || "",
        zip: job.zip || "",

        contactId: job.contactId,
        locationId: job.locationId,

        packageId: job.orderId,
        packageTitle: resolvedPkgTitle,
        level: job.level || "Classic",
        type: job.type || "Full",

        basePrice: Number(job.basePrice || 0),
        salePackagePrice: Number(job.salePackagePrice || 0),
        mobileFee: Number(job.mobileFee || 0),
        subTotal: Number(job.subTotal || 0),
        discountsTotal: Number(job.discountsTotal || 0),
        totalPrice: Number(job.totalPrice || 0),
        setDuration: String(job.setDuration || job.totalDuration || "3"),
        totalAddOnsPrice: Number(job.totalAddOnsPrice || 0),

        assignedDate: job.serviceDate,
        assignedTime: job.scheduledTime,
        assignedDetailerId: job.detailerId,
        wasBookedByPhone: job.wasBookedByPhone,

        interiorAddOns: parseTags(job.interiorAddOns),
        exteriorAddOns: parseTags(job.exteriorAddOns),
        customAddOns: parseTags(job.customAddOns),
        discountsApplied: parseTags(job.discountsApplied),

        officeNotes: job.officeNotes || "",
        vehicleNotes: job.vehicleNotes || ""
    };

    // 2. Immediately add "Prev" to draftSessions and select it FIRST!
    hqState.draftSessions.unshift(cartItem);
    hqState.globalCart = hqState.draftSessions;
    hqState.activeTabId = prevTabId;
    hqState.selectedCartItemId = prevTabId;
    hqState.selectedTabIds = [prevTabId];
    hqState.currentDraft = cartItem;

    renderTabs(true);
    await paintBookingCart(false);
    hqState.callbacks.syncDailyButtonStyles();

    // 3. Load customer dropdowns in the background without overwriting the "Prev" cartItem, then highlight in #previousRep!
    if (job.userId) {
        hqState.callbacks.loadCustomerForExistingJob(job.userId).then(() => {
            hqState.selectedPreviousJobId = job._id;
            if ($w("#previousRep").id) {
                $w("#previousRep").forEachItem(($item, itemData) => {
                    let isSel = String(itemData._id) === String(job._id);
                    if ($item("#previousRepItem").id) {
                        $item("#previousRepItem").style.borderColor = isSel ? "#1A6AFF" : "#FFFFFF";
                    }
                });
            }
        }).catch(() => {});
    }
}
