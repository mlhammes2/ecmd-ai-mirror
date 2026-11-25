// --- public/cartUIEngine.js ---

import wixData from 'wix-data';
import { session } from 'wix-storage';
import wixWindow from 'wix-window';
import wixAnimationsFrontend from 'wix-animations-frontend'; 

import { scheduleDetailingJob, updateOrRestoreDetailingJob, deleteGoogleEvent, broadcastCalendarUpdate, } from 'backend/calendar-dispatcher.web';
import { formatPhoneNumber, buildCalendarDates, getOrdinalSuffix } from 'public/cartEngine';
import { getDraftEnvelope, unpackPackageState, resetPackageSubscription } from 'public/packagesEngine';
import { getActiveUserId } from 'public/authEngine';
import { preloadAllProfileData } from 'public/profileEngine';
import { injectUpdatedJob, syncDetailJobs } from 'public/fileDetailInfo.js';
import { initRouterEngine, smartGoTo, openSideMenu, closeSideMenu, openOverlay, closeAllOverlays, closeTopOverlay, showSuccessMessage, showErrorMessage } from 'public/routerEngine';
import { registerRepeater, smartSyncRepeater } from 'public/repeaterEngine'; 
import { startCartEditsFlow, syncCartEditsDependencies } from 'public/fileCartEdits.js';
import { syncSummaryData, startSummaryEditFlow, updateSummary } from 'public/fileSummary';
import { syncCalendarQueueRepeater, jumpToDate } from 'public/calendarEngine'; 
import { APP_LOGS } from 'public/loggerConfig';
import { syncGlobalCartBadge, getCatalogData, getMemoryState } from 'public/stateManager';
import { findMatchingServicePackage, normalizeToPackageSubCategory } from 'public/packageMatcher';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';


let $w;
let hooks;

// ==========================================
// 🔴 DEBUGGING & LOGGING ENGINE
// ==========================================
const DEBUG_MODE = APP_LOGS.MASTER_SWITCH && APP_LOGS.CART_UI;
const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [CART_UI_ENGINE]: ${msg}`, data) : console.log(`📌 [CART_UI_ENGINE]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [CART_UI_ENGINE]: ${msg}`, data) : console.warn(`📌 [CART_UI_ENGINE]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [CART_UI_ENGINE]: ${msg}`, data) : console.error(`📌 [CART_UI_ENGINE]: ${msg}`); }
};

// 🌟 GLOBALS
let cartData = [];
let globalVehicles = [];
let globalContacts = [];  
let globalLocations = []; 
let globalDetailers = [];
let g_allData = [];

// 🛒 CART UI STATE
let selectedCartItemIds = [];

// 🧙‍♂️ BATCH EDIT STATE
let batchEditQueue = [];
let currentBatchIndex = 0;
let isBatchMode = false;
let editingOrderId = null;

export let returnBreadcrumb = null; 
export function clearBreadcrumb() { returnBreadcrumb = null; }

registerModuleState("cartUIEngine", () => ({
    cartItemCount: (cartData || []).length,
    selectedCartItemIds,
    isBatchMode,
    currentBatchIndex,
    batchEditQueue,
    editingOrderId,
    returnBreadcrumb,
    checkoutSelectedIdsInSession: session.getItem("checkout_selectedIds") || null,
    reschedulingJobIdInSession: session.getItem("reschedulingJobId") || null,
    cartItemsSummary: (cartData || []).map(c => ({
        _id: c._id,
        packageTitle: c.packageTitle,
        level: c.level,
        type: c.type,
        subCategory: c.subCategory,
        vehicleId: c.vehicleId,
        vehicleType: c.vehicleType,
        contactId: c.contactId,
        locationId: c.locationId,
        basePrice: c.basePrice,
        totalPrice: c.totalPrice,
        assignedSlotText: c.assignedSlotText || null,
        assignedDetailerId: c.assignedDetailerId || null
    }))
}));

registerDomElements({
    msb: ["#msbProfile", "#msbLightbox"],
    repeaters: ["#repCart", "#cartButtonMenuRep", "#confirmationRep"],
    inputs: ["#siTextbox"]
});




export function initCartUIEngine(wixContext, providedHooks) {
    logger.info("Initializing Cart UI Engine...");
    $w = wixContext; hooks = providedHooks;

    initCartRepeater();
    initBulkButtons();
    initCheckoutButton();
    initSpecialInstructionsEngine($w);

    // 💥 FIX 2: The Envelope Hydration Listener
    if ($w("#msbProfile").id) {
        $w("#msbProfile").onChange((event) => {
            let newState = event.target.currentState.id;
            
            // 🧹 If they cancel and return to the main cart, destroy the envelope
            if (newState === "cartProfileState") {
                session.removeItem("checkout_selectedIds");
            } 
            // 📦 If they navigate backward into Cart Edits, unpack the envelope!
            else if (newState === "cartEditsProfileState") {
                let savedIdsStr = session.getItem("checkout_selectedIds");
                if (savedIdsStr && cartData.length > 0) {
                    try {
                        let savedIds = JSON.parse(savedIdsStr);
                        let activeItems = cartData.filter(c => savedIds.includes(c._id));
                        if (activeItems.length > 0) {
                            syncCartEditsDependencies(globalVehicles, globalContacts, globalLocations);
                            startCartEditsFlow(activeItems, true, false);
                        }
                    } catch(e) {}
                }
            }
            // 📅 NEW: If they navigate backward into the Calendar, instantly repaint it!
            else if (newState === "calendarProfileState") {
                let savedIdsStr = session.getItem("checkout_selectedIds");
                if (savedIdsStr && cartData.length > 0) {
                    try {
                        let savedIds = JSON.parse(savedIdsStr);
                        let activeItems = cartData.filter(c => savedIds.includes(c._id));
                        if (activeItems.length > 0) {
                            syncCalendarQueueRepeater(activeItems);
                        }
                    } catch(e) {}
                }
            }
        });
    }
}


export async function syncCartData(ignoredCartData, vehs, contacts, locations, dets, allData) {
    if (vehs) globalVehicles = vehs;
    if (contacts) globalContacts = contacts;
    if (locations) globalLocations = locations;
    if (dets) globalDetailers = dets;
    if (allData) g_allData = allData;
   
    try {
        let userId = await getActiveUserId();
        let [cartRes, catalog] = await Promise.all([
            wixData.query("temporaryData").eq("userId", userId).find(),
            getCatalogData(false)
        ]);
        cartData = cartRes.items || [];
        let allPackages = (catalog && catalog.packages) ? catalog.packages : (getMemoryState().packages || []);

        // 🔄 AUTO-SYNC TEMPORARY DATA TO VEHICLE TYPE & PACKAGE PRICING
        if (allPackages.length > 0 && cartData.length > 0) {
            let dbUpdates = [];
            for (let item of cartData) {
                let selVeh = globalVehicles.find(v => String(v._id) === String(item.vehicleId));
                let rawType = selVeh
                    ? (selVeh.vehicleType || selVeh.subCategory || "")
                    : (item.vehicleType || item.subCategory || "");

                if (!rawType) continue;

                let matchedPkg = findMatchingServicePackage(allPackages, item, rawType);
                if (!matchedPkg) continue;

                let expectedBase = Number(matchedPkg.price || 0);
                let expectedSale = Number(matchedPkg.salePrice || 0);
                let expectedMobile = Number(matchedPkg.mobileFee || 0);
                let expectedDuration = Number(matchedPkg.duration || item.setDuration || 2);
                let addOnsTotal = Number(item.totalAddOnsPrice || 0);

                let isSub = Array.isArray(item.discountsApplied) &&
                    item.discountsApplied.some(d => String(d).includes("Car Club"));

                let expectedDiscount = Number(item.discountsTotal || 0);
                let expectedDiscountsApplied = item.discountsApplied || [];

                if (!isSub) {
                    if (expectedSale > 0 && expectedSale < expectedBase) {
                        expectedDiscount = expectedBase - expectedSale;
                        expectedDiscountsApplied = [matchedPkg.saleTitle || "Special Offer"];
                    } else {
                        expectedDiscount = 0;
                        expectedDiscountsApplied = [];
                    }
                }

                let expectedTotal = Math.max(0, (expectedBase + expectedMobile + addOnsTotal) - expectedDiscount);
                let resolvedVehType = selVeh ? (selVeh.vehicleType || matchedPkg.subCategory) : (matchedPkg.subCategory || rawType);

                if (
                    Number(item.basePrice) !== expectedBase ||
                    Number(item.totalPrice) !== expectedTotal ||
                    String(item.vehicleType || "") !== String(resolvedVehType || "")
                ) {
                    item.packageId = matchedPkg._id;
                    item.packageTitle = matchedPkg.title || item.packageTitle;
                    item.level = matchedPkg.packageLevel || item.level;
                    item.type = matchedPkg.detailType || item.type;
                    item.subCategory = matchedPkg.subCategory;
                    item.vehicleType = resolvedVehType;
                    if (selVeh) {
                        item.vehicleYear = selVeh.year || "";
                        item.vehicleMake = selVeh.make || "";
                        item.vehicleModel = selVeh.model || "";
                        item.vehicleColor = selVeh.color || "";
                    }
                    item.basePrice = expectedBase;
                    item.salePackagePrice = expectedSale;
                    item.mobileFee = expectedMobile;
                    item.setDuration = expectedDuration;
                    item.discountsTotal = expectedDiscount;
                    item.discountsApplied = expectedDiscountsApplied;
                    item.subTotal = expectedBase + expectedMobile + addOnsTotal;
                    item.totalPrice = expectedTotal;

                    dbUpdates.push(wixData.update("temporaryData", item).catch(() => {}));
                }
            }
            if (dbUpdates.length > 0) {
                await Promise.all(dbUpdates);
            }
        }

        syncSummaryData(cartData, globalVehicles, globalContacts, globalLocations, g_allData);

        // 🔄 WIZARD RESTORE LOGIC (FOR REFRESHES)
        let savedIdsStr = session.getItem("checkout_selectedIds");
        if (savedIdsStr && $w("#msbProfile").id && $w("#msbProfile").currentState) {
            try {
                let savedIds = JSON.parse(savedIdsStr);
                selectedCartItemIds = savedIds;
                let activeItems = cartData.filter(c => savedIds.includes(c._id));
                let currentState = $w("#msbProfile").currentState.id;
               
                if (currentState === "cartEditsProfileState" && activeItems.length > 0) {
                    syncCartEditsDependencies(globalVehicles, globalContacts, globalLocations);
                    startCartEditsFlow(activeItems, true, false);
                } else if (currentState === "calendarProfileState" && activeItems.length > 0) {
                    syncCalendarQueueRepeater(activeItems);
                } else if (currentState === "confirmBookingProfileState" && activeItems.length > 0) {
                    smartSyncRepeater($w, "#confirmationRep", activeItems);
                }
            } catch(e) { logger.error("Failed to restore wizard state", e); }
        }

    } catch(err) { logger.error("Cart Engine Fetch Error:", err); }
    
    refreshCartUI();
}

export function bootBatchMode() {
    let savedQueue = session.getItem("editQueue");
    if (savedQueue) {
        batchEditQueue = JSON.parse(savedQueue);
        if (batchEditQueue.length > 0) { isBatchMode = true; loadNextBatchItem(); } 
        else session.removeItem("editQueue");
    }
}

export function getSelectedCartItemIds() { return selectedCartItemIds; }
export function refreshCartVisuals() { refreshCartUI(); checkConfirmButtonState(); } 

export async function loadCalendarCartSlider(injectedJob = null) {
    let rescheduleId = session.getItem("reschedulingJobId");
    
    if (rescheduleId) {
        if (injectedJob) { 
            // 💥 Formats the job to look like a "Selected" Cart Item
            injectedJob.assignedDate = new Date(injectedJob.serviceDate);
            injectedJob.assignedTime = injectedJob.scheduledTime;
            injectedJob.assignedTimeToken = injectedJob.timeToken;
            injectedJob.assignedDetailerId = injectedJob.detailerId;
            
            let dObj = new Date(injectedJob.serviceDate);
            injectedJob.assignedSlotText = `${dObj.toLocaleDateString('en-US', { month: 'short' })} ${dObj.getDate()}, ${dObj.getFullYear()} ${injectedJob.scheduledTime} Time`;

            // 💥 Force the calendar UI to jump to this date!
            if (typeof jumpToDate === "function") jumpToDate(injectedJob.serviceDate);

            syncCalendarQueueRepeater([injectedJob]); 
            return; 
        }
        
        try {
            let res = await wixData.query("scheduledJobs").eq("_id", rescheduleId).find();
            if (res.items.length > 0) { 
                let fetchedJob = res.items[0];
                fetchedJob.assignedDate = new Date(fetchedJob.serviceDate);
                fetchedJob.assignedTime = fetchedJob.scheduledTime;
                fetchedJob.assignedTimeToken = fetchedJob.timeToken;
                fetchedJob.assignedDetailerId = fetchedJob.detailerId;
                
                let dObj = new Date(fetchedJob.serviceDate);
                fetchedJob.assignedSlotText = `${dObj.toLocaleDateString('en-US', { month: 'short' })} ${dObj.getDate()}, ${dObj.getFullYear()} ${fetchedJob.scheduledTime} Time`;

                if (typeof jumpToDate === "function") jumpToDate(fetchedJob.serviceDate);

                syncCalendarQueueRepeater([fetchedJob]); 
            }
        } catch(e) { logger.error("Failed to load reschedule slider", e); }
        return; 
    }

    let sliderItems = cartData.filter(item => selectedCartItemIds.includes(item._id));
    syncCalendarQueueRepeater(sliderItems);
}

async function loadNextBatchItem() {
    if (currentBatchIndex >= batchEditQueue.length) { session.removeItem("editQueue"); hooks.smartGoTo("cartProfileState"); return; }
    try {
        let draft = await wixData.get("temporaryData", batchEditQueue[currentBatchIndex]);
        if (draft) {
            editingOrderId = draft.orderId; 
            let tempAddOns = [];
            if (draft.addOns && Array.isArray(draft.addOns)) { draft.addOns.forEach(addonString => { let matchedAddon = g_allData.find(item => addonString.startsWith(item.buttonTitle || item.title || "Add-On")); if (matchedAddon) tempAddOns.push(matchedAddon); }); }
            unpackPackageState(draft.level, draft.type, tempAddOns); 
            
            updateSummary(); 
            
            if ($w("#lightboxBoxG").id) $w("#lightboxBoxG").show("fade", { duration: 200 });
            if ($w("#msbLightbox").id) { $w("#msbLightbox").show("slide", { direction: "bottom", duration: 400 }); $w("#msbLightbox").changeState("summaryLightboxState"); }
            if ($w("#confirmButtonLBG").id) $w("#confirmButtonLBG").hide();
            if ($w("#confirmEditG").id) {
                $w("#confirmEditG").show();
                $w("#confirmEditG").label = currentBatchIndex === batchEditQueue.length - 1 ? `Finish & Return to Cart` : `Save & Edit Next (${currentBatchIndex + 1} of ${batchEditQueue.length})`;
            }
        }
    } catch (err) { logger.error("Batch Load Error", err); }
}

function refreshCartUI() {
    if ($w("#repCart").id) { 
        let syncReadyData = cartData.map(item => { return { ...item, isSelected: selectedCartItemIds.includes(item._id) }});
        smartSyncRepeater($w, "#repCart", syncReadyData);
        
        if (cartData.length > 0) { 
            $w("#repCart").expand(); $w("#repCart").show("fade", { duration: 200 }); 
        } else { 
            $w("#repCart").collapse(); $w("#repCart").hide("fade", { duration: 200 }); 
        }
    }
    
    let grandTotal = cartData.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0);
    if ($w("#textGrandTotal").id) $w("#textGrandTotal").text = `$${grandTotal.toFixed(2)}`;
    if ($w("#cartCount").id) $w("#cartCount").text = cartData.length.toString();

    syncGlobalCartBadge($w, cartData.length);
}

function initCartRepeater() {
    if (!$w("#repCart") || !$w("#repCart").id) return;
    
    registerRepeater($w, "#repCart", ($item, itemData) => {
        if ($item("#cartItemTitle").type) $item("#cartItemTitle").text = itemData.packageTitle || "Detailing Package";
        if ($item("#cartItemPrice").type) $item("#cartItemPrice").text = `$${Number(itemData.totalPrice || 0).toFixed(2)}`;
        if ($item("#cartTime").type) $item("#cartTime").text = `Duration: ${itemData.setDuration || "--"} hrs`;
        if ($item("#cartAddOns").type) $item("#cartAddOns").text = `Add-Ons (${(itemData.interiorAddOns || []).length + (itemData.exteriorAddOns || []).length})`;
        
        let isSub = (itemData.discountsApplied || []).some(d => d.includes("Car Club")) ? "Subscription" : "Non-subscription";
        if ($item("#cartIsSubscription").type) $item("#cartIsSubscription").text = isSub;
        
        let img = itemData.packageImage;
        let isValidImg = img && (img.startsWith("http") || img.startsWith("wix:image"));
        if ($item("#cartImage").type) { if (isValidImg) $item("#cartImage").src = img; else $item("#cartImage").hide(); }

        let selVeh = globalVehicles.find(v => v._id === itemData.vehicleId);
        if ($item("#cartVehicle").type) {
            let vType = selVeh ? (selVeh.vehicleType || itemData.vehicleType || itemData.subCategory || "") : (itemData.vehicleType || itemData.subCategory || "");
            let typeSuffix = vType ? ` (${vType})` : "";
            let baseVehStr = selVeh
                ? `${selVeh.year || ''} ${selVeh.make || ''} ${selVeh.model || ''} ${selVeh.color || ''}`.replace(/\s+/g, ' ').trim()
                : "No vehicle assigned";
            $item("#cartVehicle").text = `${baseVehStr}${typeSuffix}`;
        }

        let selCon = globalContacts.find(c => c._id === itemData.contactId);
        if ($item("#cartItemContactInfo").type) $item("#cartItemContactInfo").text = selCon ? `${selCon.firstName || ''} ${selCon.lastName || ''} - ${formatPhoneNumber(selCon.phone)}`.trim() : "No contact assigned";

        let selLoc = globalLocations.find(l => l._id === itemData.locationId);
        if ($item("#cartItemLocationInfo").type) $item("#cartItemLocationInfo").text = selLoc ? `${selLoc.address1 || ''}, ${selLoc.city || ''} ${selLoc.zip || ''}`.trim() : "No location assigned";

        let hasBooking = !!itemData.assignedSlotText;
        if ($item("#cartItemContainer").type) $item("#cartItemContainer").style.borderColor = itemData.isSelected ? "#30FFD6" : "#FFFFFF"; // 👈 Simplified
        if ($item("#cartCheckmark").type) { if (itemData.isSelected) $item("#cartCheckmark").show(); else $item("#cartCheckmark").hide(); }
        if ($item("#cartCheckbox").type) $item("#cartCheckbox").show();
        if ($item("#reservedDate").type) { if (hasBooking) { $item("#reservedDate").text = itemData.assignedSlotText; $item("#reservedDate").expand(); } else $item("#reservedDate").collapse(); }
    });

    if ($w("#cartItemContainer").id) {
        $w("#cartItemContainer").onClick((event) => { 
            if (event.target.id === "cartCheckbox" || event.target.id === "cartCheckmark") return; 
            let realId = event.context.itemId; 
            toggleCartSelection(realId); // 👈 FIX: Removed the blocker! You can now select booked items.
        });
        $w("#cartItemContainer").onMouseIn((event) => { $w.at(event.context)("#cartItemContainer").style.borderColor = "#30FFD6"; });
        $w("#cartItemContainer").onMouseOut((event) => { let isSelected = selectedCartItemIds.includes(event.context.itemId); $w.at(event.context)("#cartItemContainer").style.borderColor = isSelected ? "#24BAA8" : "#FFFFFF"; });
    }

    if ($w("#cartCheckbox").id) {
        $w("#cartCheckbox").onClick(async (event) => { 
            let realId = event.context.itemId; 
            toggleCartSelection(realId); // 👈 FIX: Removed the automatic un-booking when clicking the checkbox.
        });
    }
}

function toggleCartSelection(realId, forceState = null) {
    let freshItem = cartData.find(c => c._id === realId);
    if (!freshItem) return; 
    
    if (forceState !== null) {
        if (forceState && !selectedCartItemIds.includes(realId)) selectedCartItemIds.push(realId);
        else if (!forceState) selectedCartItemIds = selectedCartItemIds.filter(id => id !== realId);
    } else {
        if (selectedCartItemIds.includes(realId)) selectedCartItemIds = selectedCartItemIds.filter(id => id !== realId); 
        else selectedCartItemIds.push(realId); 
    }
    
    refreshCartUI(); 
}

function initBulkButtons() {
    if ($w("#cartDeleteButton").id) {
        $w("#cartDeleteButton").onClick(async () => {
            if (selectedCartItemIds.length === 0) return; 
            $w("#cartDeleteButton").disable(); $w("#cartDeleteButton").label = "Deleting...";
            let fadePromises = [];
            if ($w("#repCart").id) { $w("#repCart").forEachItem(($c, d) => { if (selectedCartItemIds.includes(d._id) && $c("#cartItemContainer").type) fadePromises.push($c("#cartItemContainer").hide("fade", { duration: 250 })); }); }
            if (fadePromises.length > 0) await Promise.all(fadePromises);
            try { await wixData.bulkRemove("temporaryData", selectedCartItemIds); cartData = cartData.filter(c => !selectedCartItemIds.includes(c._id)); selectedCartItemIds = []; refreshCartUI(); } catch (err) {}
            $w("#cartDeleteButton").enable(); $w("#cartDeleteButton").label = "Delete";
        });
    }

    if (!$w("#cartButtonMenuRep") || !$w("#cartButtonMenuRep").id) return;

    registerRepeater($w, "#cartButtonMenuRep", ($item, itemData) => {
        let btnTitle = itemData.title || "";
        if ($item("#cartButtonMenu").type) $item("#cartButtonMenu").label = btnTitle;
    });

    if ($w("#cartButtonMenu").id) {
        $w("#cartButtonMenu").onClick(async (event) => {
            let itemData = $w("#cartButtonMenuRep").data.find(d => d._id === event.context.itemId);
            if (!itemData) return;
            let btnTitle = itemData.title || "";
            let btn = $w.at(event.context)("#cartButtonMenu");

            if (selectedCartItemIds.length === 0) { btn.style.backgroundColor = "#DF3131"; setTimeout(() => { btn.style.backgroundColor = "#000000"; }, 500); return; }

            if (btnTitle === "Edit Package") { 
                let selectedItems = cartData.filter(item => selectedCartItemIds.includes(item._id));
                startSummaryEditFlow(selectedItems); 
                hooks.smartGoTo("summaryLightboxState"); 
            } 
            else if (btnTitle === "Edit Info") {
                let selectedItems = cartData.filter(item => selectedCartItemIds.includes(item._id));
                syncCartEditsDependencies(globalVehicles, globalContacts, globalLocations);
                startCartEditsFlow(selectedItems, false, true);
                hooks.smartGoTo("cartEditsProfileState");
            }
            else if (btnTitle === "Duplicate") {
                btn.disable(); btn.label = "Copying...";
                try {
                    let itemsToDuplicate = cartData.filter(item => selectedCartItemIds.includes(item._id));
                    let newPayloads = itemsToDuplicate.map(item => { let dup = { ...item }; delete dup._id; dup.orderId = "ord_" + Date.now().toString() + Math.floor(Math.random() * 1000); dup.assignedSlotText = null; dup.assignedDetailerId = null; dup.assignedDate = null; dup.assignedTime = null; return dup; });
                    await wixData.bulkInsert("temporaryData", newPayloads); selectedCartItemIds = []; await hooks.loadCartData(); 
                } catch (err) { logger.error("Duplicate Error", err); }
                btn.enable(); btn.label = btnTitle;
            } 
            else if (btnTitle === "Delete") {
                btn.disable(); btn.label = "Deleting...";
                let fadePromises = [];
                if ($w("#repCart").id) { $w("#repCart").forEachItem(($c, d) => { if (selectedCartItemIds.includes(d._id) && $c("#cartItemContainer").type) fadePromises.push($c("#cartItemContainer").hide("fade", { duration: 250 })); }); }
                if (fadePromises.length > 0) await Promise.all(fadePromises);
                try { await wixData.bulkRemove("temporaryData", selectedCartItemIds); selectedCartItemIds = []; await hooks.loadCartData(); } catch (err) {}
                btn.enable(); btn.label = btnTitle;
            }
        });
    }
}

function checkConfirmButtonState() { if ($w("#confirmButton").id) $w("#confirmButton").enable(); }

function initCheckoutButton() {
    if ($w("#confirmButton").id) {
        $w("#confirmButton").enable(); 
        $w("#confirmButton").onClick(async () => { 
            if ($w("#packageRep").id) {
                if (!isBatchMode) resetPackageSubscription();
                updateSummary(); 
                hooks.smartGoTo("summaryLightboxState"); 
                return;
            }
            wixWindow.getBoundingRect().then(() => { processCalendarClick(); });
        });
    }
    
    if ($w("#calendarButton").id) {
        $w("#calendarButton").onClick(() => {
            wixWindow.getBoundingRect().then(() => { processCalendarClick(); });
        });
    }
}

export function syncSingleCartItem(updatedItem) {
    let index = cartData.findIndex(c => String(c._id) === String(updatedItem._id));
    if (index > -1) {
        cartData[index] = updatedItem;
        refreshCartUI();
    }
}

export function initSpecialInstructionsEngine($w) {
    if ($w("#submitSi").id) {
        $w("#submitSi").onClick(async () => {
            let currentText = $w("#siTextbox").id ? $w("#siTextbox").value : "";
            let editingJobId = session.getItem("editingScheduledJobId");
            
            if (editingJobId) {
                try {
                    let jobRes = await wixData.query("scheduledJobs").eq("_id", editingJobId).find();
                    if (jobRes.items.length > 0) {
                        let activeJob = jobRes.items[0];
                        activeJob.specialInstructions = currentText;
                        await wixData.update("scheduledJobs", activeJob);
                        if (typeof injectUpdatedJob === "function") injectUpdatedJob(activeJob);
                    }
                } catch(e) { logger.error("SI Error:", e); }
            } else {
                if ($w("#specialInstructionsText").id) {
                    $w("#specialInstructionsText").text = (currentText && currentText.trim() !== "") ? "Instructions Added" : "Add Instructions...";
                }
            }
            closeTopOverlay($w);
        });
    }
}

export async function triggerCheckoutFlow(items, toCalendar = false) {
    session.removeItem("editingScheduledJobId");
    session.removeItem("returnBreadcrumb");
    session.removeItem("reschedulingJobId");
   
    // 💾 SAVE ACTIVE WIZARD ITEMS FOR PAGE REFRESH
    session.setItem("checkout_selectedIds", JSON.stringify(items.map(i => i._id)));
   
    syncCartEditsDependencies(globalVehicles, globalContacts, globalLocations);
    startCartEditsFlow(items, toCalendar, false);
   
    let userId = await getActiveUserId();
    hooks.smartGoTo(userId.startsWith("guest_") ? "registryProfileState" : "cartEditsProfileState");
}

export function processCalendarClick() {
    session.removeItem("reschedulingJobId"); session.removeItem("editingScheduledJobId");
    
    let selectedItems = cartData.filter(item => selectedCartItemIds.includes(item._id));
    
    // 👈 FIX: If nothing is selected, select everything! Don't ignore booked items!
    if (selectedItems.length === 0) {
        selectedCartItemIds = cartData.map(item => item._id); 
        selectedItems = cartData; 
        refreshCartVisuals(); 
    }
    if (selectedItems.length === 0) return; 

    triggerCheckoutFlow(selectedItems, true); 
}


export function getFreshCartData() { return cartData; }

export async function processDesktopSlotSelection(cartItemId, detailerId, timeString, dateString, timeToken) {
    let item = cartData.find(c => String(c._id) === String(cartItemId));
    if (!item) return;

    item.assignedDate = new Date(dateString);
    item.assignedTime = timeString;
    item.assignedTimeToken = timeToken;
    item.assignedDetailerId = detailerId;
    
    let dObj = new Date(dateString);
    let monthName = dObj.toLocaleDateString('en-US', { month: 'short' });
    let dateNum = dObj.getDate();
    let yearNum = dObj.getFullYear();
    
    item.assignedSlotText = `${monthName} ${dateNum}, ${yearNum} ${timeString} Time`;

    wixData.update("temporaryData", item).catch(e => logger.error("Slot Selection Update Failed", e));
    syncSingleCartItem(item);
    refreshCartVisuals();
}

async function submitScheduledJobs(jobsToBook) {
    try {
        let activeUserId = await getActiveUserId();
        let timeSlotsRes = await wixData.query("calendarTimeSlots").find();
        let allTimeSlots = timeSlotsRes.items;
        
        // 💥 FETCH DATA FOR PAYROLL MATH
        let [pkgRes, addOnRes] = await Promise.all([
            wixData.query("servicePackages").find(),
            wixData.query("autoWhatsIncluded").limit(1000).find()
        ]);
        let cmsPackages = pkgRes.items || [];
        let cmsAddOns = addOnRes.items || [];

        let payloads = jobsToBook.map(item => {
            let selCon = globalContacts.find(c => String(c._id) === String(item.contactId));
            let selLoc = globalLocations.find(l => String(l._id) === String(item.locationId));
            let selVeh = globalVehicles.find(v => String(v._id) === String(item.vehicleId));

            // 🌎 Resolve timezone from the service address (State + ZIP)
            let st = String(selLoc?.state || "").trim().toUpperCase();
            let zip = String(selLoc?.zip || "").trim();
            let zip3 = zip.substring(0, 3);
            let serviceTz = "America/Chicago"; // Default Pensacola HQ
            if (zip3 === "324" || zip3 === "325") serviceTz = "America/Chicago";
            else if (zip.startsWith("32") || zip.startsWith("33") || zip.startsWith("34")) serviceTz = "America/New_York";
            else if (zip.startsWith("84") || ["UT", "CO", "WY", "MT", "NM", "ID"].includes(st)) serviceTz = "America/Denver";
            else if (st === "AZ") serviceTz = "America/Phoenix";
            else if (["CA", "NV", "OR", "WA"].includes(st)) serviceTz = "America/Los_Angeles";
            else if (["GA", "SC", "NC", "VA", "NY", "PA", "OH", "MI"].includes(st)) serviceTz = "America/New_York";

            let rawAssigned = new Date(item.assignedDate);
            let yr = rawAssigned.getFullYear();
            let mo = rawAssigned.getMonth();
            let dy = rawAssigned.getDate();

            // 1. Service Date (Anchored to 12:00 UTC so calendar date never shifts across timezones)
            let targetDate = new Date(Date.UTC(yr, mo, dy, 12, 0, 0, 0));

            let matchedSlot = allTimeSlots.find(s => s.token === item.assignedTimeToken);
            let aHour = matchedSlot ? (matchedSlot.arrivalHour || 9) : 9;
            let dHour = matchedSlot ? (matchedSlot.expectedHour || (aHour + 2)) : (aHour + 2);

            let tzParts = new Intl.DateTimeFormat('en-US', { timeZone: serviceTz, timeZoneName: 'shortOffset' }).formatToParts(targetDate);
            let offsetStr = tzParts.find(p => p.type === 'timeZoneName')?.value || "GMT-5";
            let offsetHours = parseInt(offsetStr.replace("GMT", ""), 10);
            if (isNaN(offsetHours)) offsetHours = -5;

            // 2. Scheduled Start Time & 3. Deadline Time (Locked to Service Address Timezone!)
            let scheduledStart = new Date(Date.UTC(yr, mo, dy, aHour - offsetHours, 0, 0, 0));
            let deadlineTime = new Date(Date.UTC(yr, mo, dy, dHour - offsetHours, 0, 0, 0));

            let base = Number(item.basePrice || 0); let mobile = Number(item.mobileFee || 0); let addons = Number(item.totalAddOnsPrice || 0); let calcSubTotal = base + mobile + addons; let discTotal = Number(item.discountsTotal || 0); 
            let formattedDiscounts = (item.discountsApplied && item.discountsApplied.length > 0) ? [`${item.discountsApplied[0]} (-$${discTotal.toFixed(2)})`] : [];
            let selDet = globalDetailers.find(d => String(d._id) === String(item.assignedDetailerId));

            // 💸 PAYROLL & VEHICLE-MATCHED PACKAGE ENGINE
            let detailerLevel = selDet ? (selDet.payLevel || 1) : 1;
            let pkg = findMatchingServicePackage(cmsPackages, item, selVeh?.vehicleType || item.vehicleType);
            let basePayout = pkg ? (detailerLevel === 2 ? (pkg.payoutL2 || 0) : (pkg.payoutL1 || 0)) : 0;

            if (pkg) {
                base = Number(pkg.price || base || 0);
                mobile = Number(pkg.mobileFee || mobile || 0);
                calcSubTotal = base + mobile + addons;
                item.totalPrice = Math.max(0, calcSubTotal - discTotal);
                item.setDuration = Number(pkg.duration || item.setDuration || 3);
            }
            
            let addOnPayout = 0;
            const ADDON_COMMISSION_RATE = 0.70; // 70% Add-on Commission
            let allAddOns = [...(item.interiorAddOns || []), ...(item.exteriorAddOns || [])];
            
            allAddOns.forEach(addonTag => {
                let addOnCms = cmsAddOns.find(a => addonTag.includes(a.buttonTitle || a.title));
                if (addOnCms && addOnCms.price) {
                    addOnPayout += (Number(addOnCms.price) * ADDON_COMMISSION_RATE);
                }
            });
            
            let totalPayout = basePayout + addOnPayout;
            let trainerPayout = totalPayout;
            let traineePayout = 0;
            let traineeId = item.assignedTraineeId || null; 

            if (traineeId) {
                trainerPayout = totalPayout * 0.60;
                traineePayout = totalPayout * 0.40;
            }
            // 💸 END PAYROLL MATH ENGINE
            
            return {
                userId: item.userId || activeUserId,
                firstName: selCon ? selCon.firstName : "", lastName: selCon ? selCon.lastName : "", email: selCon ? selCon.email : "", phone: selCon ? selCon.phone : "",
                address1: selLoc ? selLoc.address1 : "", address2: selLoc ? selLoc.address2 : "", city: selLoc ? selLoc.city : "", state: selLoc ? selLoc.state : "", zip: selLoc ? selLoc.zip : "",
                vehicleId: item.vehicleId, 
                vehicleYear: selVeh ? (selVeh.vehicleYear || selVeh.year || "") : "",
                vehicleMake: selVeh ? (selVeh.vehicleMake || selVeh.make || "") : "",
                vehicleModel: selVeh ? (selVeh.vehicleModel || selVeh.model || "") : "",
                vehicleColor: selVeh ? (selVeh.vehicleColor || selVeh.color || "") : "",
                vehicleInfo: selVeh ? `${selVeh.vehicleYear || selVeh.year || ''} ${selVeh.vehicleMake || selVeh.make || ''} ${selVeh.vehicleModel || selVeh.model || ''} ${selVeh.vehicleColor || selVeh.color ? '- ' + (selVeh.vehicleColor || selVeh.color) : ''}`.replace(/\s+/g, ' ').trim() : (item.vehicleInfo || "Unknown Vehicle"),
                vehicleType: selVeh ? selVeh.vehicleType : "", 
                vehicleCategory: selVeh ? selVeh.category : "", 
                locationId: item.locationId, contactId: item.contactId, 
                orderId: item.orderId || "JOB_" + Date.now().toString() + Math.floor(Math.random() * 1000),
                packageTitle: item.packageTitle, packageImage: item.packageImage || "",
                level: item.level || "N/A", type: item.type || "N/A",
                basePrice: base, mobileFee: mobile, subTotal: calcSubTotal, discountsTotal: discTotal, totalPrice: Number(item.totalPrice || 0),
                setDuration: Number(item.setDuration || 3), totalAddOnsPrice: addons, 
                ...(item.salePackagePrice !== undefined && item.salePackagePrice !== null && { salePackagePrice: Number(item.salePackagePrice) }), 
                
                // 💥 UPDATED LINE HERE:
                serviceDate: targetDate, originalScheduledDate: targetDate, scheduledStartTime: scheduledStart, deadlineTime: deadlineTime, scheduledTime: item.assignedTime, timeToken: item.assignedTimeToken, 
                
                detailerId: item.assignedDetailerId, detailerAlias: selDet ? (selDet.teamAlias || "Detailer Team") : "Unassigned", detailerName: selDet ? selDet.first : "Unassigned",
                interiorAddOns: item.interiorAddOns || [], exteriorAddOns: item.exteriorAddOns || [], customAddOns: item.customAddOns || [], discountsApplied: formattedDiscounts, 
                specialInstructions: item.specialInstructions || "", officeNotes: item.officeNotes || "", status: "Scheduled",
                googleEventId: null, googleAdminEventId: null,
                payoutTotal: totalPayout,
                basePayout: basePayout,
                addOnPayout: addOnPayout,
                trainerPayout: trainerPayout,
                traineePayout: traineePayout,
                traineeId: traineeId
            };
        }); 

        for (let job of payloads) {
            try {
                let detailer = globalDetailers.find(d => String(d._id) === String(job.detailerId));
                let detailerCalId = detailer?.googleCalendarId || detailer?.email;

                if (detailerCalId && typeof scheduleDetailingJob === "function") {
                    let times = buildCalendarDates(job.serviceDate, job.scheduledTime); 
                    let syncRes = await scheduleDetailingJob(detailerCalId, { 
                        title: `${job.vehicleInfo} - ${job.packageTitle}`, 
                        description: `Order: ${job.orderId}\nVehicle: ${job.vehicleInfo}\nInstructions: ${job.officeNotes || 'None'}\nPhone: ${job.phone}`, 
                        startTime: times.start, endTime: times.end, detailerName: job.detailerName 
                    });
                    if (syncRes && syncRes.success) {
                        job.googleEventId = syncRes.eventId || null; job.googleAdminEventId = syncRes.adminEventId || null;
                    }
                }
            } catch (googleErr) {}
        }
        
        let insertResults = await wixData.bulkInsert("scheduledJobs", payloads);
        let insertedJobs = insertResults.inserted || payloads.map(p => ({...p, _id: p["_id"] || "temp_" + Math.random().toString(36).substring(2)}));
        
        try { await broadcastCalendarUpdate(); } catch (rtErr) {}
        
        let idsToDelete = jobsToBook.map(i => i._id);
        await wixData.bulkRemove("temporaryData", idsToDelete);
        
        cartData = cartData.filter(c => !idsToDelete.includes(c._id));
        selectedCartItemIds = selectedCartItemIds.filter(id => !idsToDelete.includes(id));
        
        if (hooks.loadCartData) await hooks.loadCartData(); 
        refreshCartUI();

        if (typeof syncDetailJobs === "function") syncDetailJobs(insertedJobs);
        setTimeout(() => { if (typeof preloadAllProfileData === "function") preloadAllProfileData(true); }, 2500);
        
        let remainingSliderItems = cartData.filter(item => selectedCartItemIds.includes(item._id) && !item.assignedSlotText);
        
        if ($w("#msbProfile").id && $w("#msbProfile").currentState.id === "calendarProfileState" && remainingSliderItems.length > 0) {
            loadCalendarCartSlider(); return; 
        }

        if ($w("#confirmBookingText").id) $w("#confirmBookingText").text = ""; 
        closeAllOverlays($w); 
        
        session.removeItem("checkout_selectedIds"); // Clear memory on success
        showSuccessMessage("Booking Confirmed!"); 
        
        if (hooks.smartGoTo) hooks.smartGoTo("cartProfileState"); 
        if (hooks.loadGarageData) await hooks.loadGarageData(); 

    } catch (err) { 
        logger.error("Checkout Database Error:", err);
        showErrorMessage("Failed to schedule booking. Please try again."); 
    }
}

export async function executeReschedule(item) {
    try {
        let targetDate = new Date(item.assignedDate); 
        let selDet = globalDetailers.find(d => String(d._id) === String(item.assignedDetailerId));
        let times = buildCalendarDates(targetDate, item.assignedTime);

        // 💥 PAYROLL RECALCULATION ENGINE
        let [pkgRes] = await Promise.all([
            wixData.query("servicePackages").limit(100).find()
        ]);

        let pkg = findMatchingServicePackage(pkgRes.items || [], item, item.vehicleType);
        let detailerLevel = selDet ? (selDet.payLevel || 1) : 1;
        let basePayout = pkg ? (detailerLevel === 2 ? (pkg.payoutL2 || 0) : (pkg.payoutL1 || 0)) : 0;
        
        let addOnPayout = 0;
        const ADDON_COMMISSION_RATE = 0.70; // 70% Add-on Commission
        let allAddOns = [...(item.interiorAddOns || []), ...(item.exteriorAddOns || [])];
        
        allAddOns.forEach(addonTag => {
            // g_allData is already available in this file!
            let addOnCms = g_allData.find(a => addonTag.includes(a.buttonTitle || a.title));
            if (addOnCms && addOnCms.price) {
                addOnPayout += (Number(addOnCms.price) * ADDON_COMMISSION_RATE);
            }
        });
        
        let totalPayout = basePayout + addOnPayout;
        let trainerPayout = totalPayout;
        let traineePayout = 0;
        let traineeId = item.assignedTraineeId || null;

        if (traineeId) {
            trainerPayout = totalPayout * 0.60;
            traineePayout = totalPayout * 0.40;
        }

        // Apply it to the item before save:
        item.payoutTotal = totalPayout;
        item.basePayout = basePayout;
        item.addOnPayout = addOnPayout;    
        item.trainerPayout = trainerPayout;
        item.traineePayout = traineePayout;
        item.traineeId = traineeId;
        // 💥 END PAYROLL RECALCULATION

        // 💥 Capture old data before overwriting
        let oldDetailerId = item.detailerId; 
        let oldEventId = item.googleEventId;
        let oldAdminEventId = item.googleAdminEventId;

        // 🌎 Resolve timezone from the job's service address (State + ZIP)
        let st = String(item.state || "").trim().toUpperCase();
        let zip = String(item.zip || "").trim();
        let zip3 = zip.substring(0, 3);
        let serviceTz = "America/Chicago";
        if (zip3 === "324" || zip3 === "325") serviceTz = "America/Chicago";
        else if (zip.startsWith("32") || zip.startsWith("33") || zip.startsWith("34")) serviceTz = "America/New_York";
        else if (zip.startsWith("84") || ["UT", "CO", "WY", "MT", "NM", "ID"].includes(st)) serviceTz = "America/Denver";
        else if (st === "AZ") serviceTz = "America/Phoenix";
        else if (["CA", "NV", "OR", "WA"].includes(st)) serviceTz = "America/Los_Angeles";
        else if (["GA", "SC", "NC", "VA", "NY", "PA", "OH", "MI"].includes(st)) serviceTz = "America/New_York";

        let yr = targetDate.getFullYear();
        let mo = targetDate.getMonth();
        let dy = targetDate.getDate();

        // 1. Anchor serviceDate to 12:00 UTC
        let cleanServiceDate = new Date(Date.UTC(yr, mo, dy, 12, 0, 0, 0));

        // 2. Compute exact start & deadline hours in the service address timezone
        let aHour = 9;
        let timeLower = String(item.assignedTime || "").toLowerCase();
        if (item.assignedTimeToken === "token_2" || timeLower.includes("1-3")) aHour = 13;
        else if (item.assignedTimeToken === "token_3" || timeLower.includes("4-6")) aHour = 16;

        let tzParts = new Intl.DateTimeFormat('en-US', { timeZone: serviceTz, timeZoneName: 'shortOffset' }).formatToParts(cleanServiceDate);
        let offsetStr = tzParts.find(p => p.type === 'timeZoneName')?.value || "GMT-5";
        let offsetHours = parseInt(offsetStr.replace("GMT", ""), 10);
        if (isNaN(offsetHours)) offsetHours = -5;

        let scheduledStart = new Date(Date.UTC(yr, mo, dy, aHour - offsetHours, 0, 0, 0));
        let deadlineTime = new Date(Date.UTC(yr, mo, dy, (aHour + 2) - offsetHours, 0, 0, 0));
        let scheduledEnd = new Date(Date.UTC(yr, mo, dy, (aHour + Number(item.setDuration || 3)) - offsetHours, 0, 0, 0));

        times = { start: scheduledStart.toISOString(), end: scheduledEnd.toISOString() };

        item.serviceDate = cleanServiceDate;
        item.scheduledStartTime = scheduledStart;
        item.deadlineTime = deadlineTime;
        
        item.scheduledTime = item.assignedTime; 
        item.timeToken = item.assignedTimeToken;
        item.detailerId = item.assignedDetailerId;
        item.detailerAlias = selDet ? (selDet.teamAlias || "Detailer Team") : "Unassigned";
        item.detailerName = selDet ? selDet.first : "Unassigned";
        item.wasRescheduled = true; 
        item.status = "Scheduled"; 
        item.whenRescheduled = new Date();

        // 💥 1. Strip the temporary assigned data BEFORE injecting to Profile UI
        delete item.assignedDate; 
        delete item.assignedTime; 
        delete item.assignedTimeToken; 
        delete item.assignedDetailerId; 
        delete item.isRescheduleMode;
        delete item.assignedSlotText;

        try {
            // 💥 2. Force DB Query for Old Detailer to ensure deletion succeeds
            if (oldEventId && oldDetailerId) {
                let oldDetRes = await wixData.query("contractors").eq("_id", oldDetailerId).find();
                if (oldDetRes.items.length > 0) {
                    let oldDetailerCalId = oldDetRes.items[0].googleCalendarId || oldDetRes.items[0].email;
                    if (oldDetailerCalId && typeof deleteGoogleEvent === "function") {
                        await deleteGoogleEvent(oldDetailerCalId, oldEventId, oldAdminEventId);
                    }
                }
            }

            // 💥 3. Create the New Event from Scratch
            let newDetailerCalId = selDet?.googleCalendarId || selDet?.email;
            if (newDetailerCalId && typeof scheduleDetailingJob === "function") {
                let appointmentDetails = {
                    title: `${item.vehicleInfo} - ${item.packageTitle}`,
                    description: `Order: ${item.orderId}\nVehicle: ${item.vehicleInfo}\nPhone: ${item.phone}\nInstructions: ${item.specialInstructions || 'None'}`,
                    startTime: times.start, endTime: times.end, detailerName: item.detailerName 
                };

                let syncRes = await scheduleDetailingJob(newDetailerCalId, appointmentDetails);
                if (syncRes && syncRes.success) {
                    item.googleEventId = syncRes.eventId;
                    item.googleAdminEventId = syncRes.adminEventId;
                }
            }
        } catch(syncErr) {
            logger.error("Google Calendar Reschedule Sync Failed", syncErr);
        }

        // 💥 4. Save and Inject Clean Data
        await wixData.update("scheduledJobs", item);
        if (typeof injectUpdatedJob === "function") injectUpdatedJob(item);

        try { await broadcastCalendarUpdate(); } catch (rtErr) {}
        
        session.removeItem("reschedulingJobId");
        
        showSuccessMessage("Appointment Rescheduled!"); 
        
        setTimeout(async () => {
            session.removeItem("lockProfileSync"); 
            if (hooks.loadCartData) await hooks.loadCartData(); 
            if (typeof preloadAllProfileData === "function") await preloadAllProfileData(true);
            
            if (hooks.smartGoTo) hooks.smartGoTo("upcomingProfileState");
        }, 800);
        
    } catch (err) {
        logger.error("Failed to reschedule", err);
        showErrorMessage("Failed to reschedule. Please try again."); 
    }
}

export function spinCartBubble($w, newTotal) {
    if (!$w("#repHeaderButtons") || !$w("#repHeaderButtons").id) return;

    $w("#repHeaderButtons").forEachItem(($item, itemData) => {
        if (itemData.title.toLowerCase().includes("cart")) {
            if (newTotal === 0) {
                if ($item("#cartCountsBox").type) $item("#cartCountsBox").hide("fade", { duration: 200 });
            } else {
                if ($item("#cartCounts").type) $item("#cartCounts").text = newTotal.toString();
                if ($item("#cartCountsBox").type && $item("#cartCountsBox").hidden) $item("#cartCountsBox").show("fade", { duration: 200 });
                
                const timeline = wixAnimationsFrontend.timeline();
                timeline.add($item("#cartCountsBox"), {
                    y: -15, scale: 1.2, rotate: 180, duration: 250, easing: "easeOutSine"
                }).add($item("#cartCountsBox"), {
                    y: 0, scale: 1, rotate: 360, duration: 400, easing: "easeOutBounce" 
                });
                
                timeline.play().onComplete(() => {
                    wixAnimationsFrontend.timeline().add($item("#cartCountsBox"), { rotate: 0, duration: 0 }).play();
                });
            }
        }
    });
}