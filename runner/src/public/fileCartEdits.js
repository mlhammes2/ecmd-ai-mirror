/**
 * ========================================================================
 * 🤖 AI CONTEXT & ARCHITECTURE NOTE
 * ========================================================================
 * FILE: public/fileCartEdits.js
 * DOM TARGETS: `#repCartEdit`, `#selectVehicleRep`, `#selectContactRep`
 * PURPOSE: Data-assignment UI to attach Vehicles/Contacts to Cart items.
 * 
 * 🔗 CROSS-FILE BRANCHES:
 * - Triggered by `cartUIEngine.js` during checkout if data is missing.
 * - Sends validation failures to `routerEngine.js`.
 * ========================================================================
 */

import wixWindowFrontend from 'wix-window-frontend'; 
import { session } from 'wix-storage'; // 💥 NEW
import { registerRepeater, smartSyncRepeater } from 'public/repeaterEngine';
import { formatPhoneNumber } from 'public/cartEngine';
import { initRouterEngine, smartGoTo, openSideMenu, closeSideMenu, openOverlay, closeAllOverlays, closeTopOverlay, showSuccessMessage, showErrorMessage } from 'public/routerEngine';
import { APP_LOGS } from 'public/loggerConfig';
import { getMemoryState, getCatalogData } from 'public/stateManager';
import { findMatchingServicePackage, normalizeToPackageSubCategory } from 'public/packageMatcher';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

let $w;
let hooks;

const DEBUG_MODE = APP_LOGS.MASTER_SWITCH && APP_LOGS.CART_EDITS;
const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [FILE_CART_EDITS]: ${msg}`, data) : console.log(`📌 [FILE_CART_EDITS]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [FILE_CART_EDITS]: ${msg}`, data) : console.warn(`📌 [FILE_CART_EDITS]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [FILE_CART_EDITS]: ${msg}`, data) : console.error(`📌 [FILE_CART_EDITS]: ${msg}`); }
};

// 🌟 Local State Memory
let itemsToEdit = [];
let currentEditIndex = 0;
let currentDraftItem = null; 

let globalVehicles = [];
let globalContacts = [];  
let globalLocations = []; 
let isRoutingToCalendar = false;
let isCartMenuEdit = false;
let isAnimatingSlider = false;

registerModuleState("fileCartEdits", () => ({
    itemsToEditCount: (itemsToEdit || []).length,
    currentEditIndex,
    isRoutingToCalendar,
    isCartMenuEdit,
    isAnimatingSlider,
    editingScheduledJobIdInSession: session.getItem("editingScheduledJobId") || null,
    globalVehiclesCount: (globalVehicles || []).length,
    globalContactsCount: (globalContacts || []).length,
    globalLocationsCount: (globalLocations || []).length,
    currentDraftItem: currentDraftItem ? {
        _id: currentDraftItem._id,
        packageTitle: currentDraftItem.packageTitle,
        vehicleId: currentDraftItem.vehicleId,
        vehicleType: currentDraftItem.vehicleType,
        contactId: currentDraftItem.contactId,
        locationId: currentDraftItem.locationId,
        basePrice: currentDraftItem.basePrice,
        totalPrice: currentDraftItem.totalPrice,
        specialInstructions: currentDraftItem.specialInstructions
    } : null
}));

registerDomElements({
    repeaters: ["#repCartEdit", "#selectVehicleRep", "#selectContactRep", "#selectLocationRep"],
    inputs: ["#siTextbox"]
});

// 🌟 SVG Assets
const SVG_UNSELECTED = "https://static.wixstatic.com/shapes/694137_c9b83245453c4be7902c1cc56aecc744.svg";
const SVG_SELECTED = "https://static.wixstatic.com/shapes/694137_617b0d3e655f4ff4b93f9b1b80eb9021.svg";

export function initCartEdits($wContext, providedHooks) {
    logger.info("Initializing Cart Edits Engine...");
    $w =$wContext;
    hooks = providedHooks;

    initStaticButtons();
    initSelectionRepeaters();
    
    if ($w("#repCartEdit").id) {
        registerRepeater($w, "#repCartEdit", ($item, itemData) => {
            paintSummaryCard($item, itemData);
            
            // 💥 THE SWIPE TRIPWIRE: Detect when a user natively swipes to a new card
            wixWindowFrontend.getBoundingRect().then((windowInfo) => {
                if (windowInfo.window.width <= 1200) {
                    if ($item("#cartItemTitle2").type) {
                        $item("#cartItemTitle2").onViewportEnter(() => {
                            syncSwipedItem(itemData);
                        });
                    }
                }
            });
        });
    }
}

// 🛡️ THE PAINT ENGINE
function paintSummaryCard($item, itemData) {
    try {
        if ($item("#cartItemTitle2").type) $item("#cartItemTitle2").text = itemData.packageTitle || "Detailing Package";
        if ($item("#cartTime2").type) $item("#cartTime2").text = `Duration: ${itemData.setDuration || "--"} hrs`;
        if ($item("#cartItemPrice2").type) $item("#cartItemPrice2").text = `$${Number(itemData.totalPrice || 0).toFixed(2)}`;
        if ($item("#textSI2").type) $item("#textSI2").text = itemData.assignedSlotText || "";
        if ($item("#cartAddOns2").type) $item("#cartAddOns2").text = `Add-Ons (${(itemData.interiorAddOns || []).length + (itemData.exteriorAddOns || []).length})`;
        
        let isSub = Array.isArray(itemData.discountsApplied) && itemData.discountsApplied.some(d => d.includes("Car Club")) ? "Subscription" : "Non-subscription";
        if ($item("#cartIsSubscription2").type) $item("#cartIsSubscription2").text = isSub;
        
        let img = itemData.packageImage;
        let isValidImg = img && (img.startsWith("http") || img.startsWith("wix:image"));
        if ($item("#cartImage2").type) { 
            if (isValidImg) $item("#cartImage2").src = img; 
            else $item("#cartImage2").hide(); 
        }

        // 1. Create a custom HTML checkmark in your exact color
        const TEAL_CHECK = `<span style="color: #30FFD6;">✔</span>`;
        
        let vehText = "⚠️ Required: Select Vehicle";
        let conText = "⚠️ Required: Select Contact";
        let locText = "⚠️ Required: Select Location";

        if (itemData.vehicleId && itemData.vehicleId !== "NONE") {
            let selVeh = globalVehicles.find(v => String(v._id) === String(itemData.vehicleId));
            if (selVeh) {
                let vType = selVeh.vehicleType || itemData.vehicleType || itemData.subCategory || "";
                let typeSuffix = vType ? ` (${vType})` : "";
                vehText = `${TEAL_CHECK} ${selVeh.year || ''} ${selVeh.make || ''} ${selVeh.model || ''}`.trim() + typeSuffix;
            }
        }

        if (itemData.contactId && itemData.contactId !== "NONE") {
            let selCon = globalContacts.find(c => String(c._id) === String(itemData.contactId));
            if (selCon) conText = `${TEAL_CHECK} ${selCon.firstName || ''} ${selCon.lastName || ''} - ${formatPhoneNumber(selCon.phone)}`.trim();
        }

        if (itemData.locationId && itemData.locationId !== "NONE") {
            let selLoc = globalLocations.find(l => String(l._id) === String(itemData.locationId));
            if (selLoc) locText = `${TEAL_CHECK} ${selLoc.address1 || ''}, ${selLoc.city || ''}`.trim();
        }

        // 2. Use .html instead of .text, and wrap it in your <h3> tag so it matches your Wix Editor typography!
        if ($item("#cartVehicle2").type) {
            $item("#cartVehicle2").html = `<h3 class="wixui-rich-text__text" style="color: #FFFFFF;">${vehText}</h3>`;
        }
        if ($item("#cartItemContactInfo2").type) {
            $item("#cartItemContactInfo2").html = `<h3 class="wixui-rich-text__text" style="color: #FFFFFF;">${conText}</h3>`;
        }
        if ($item("#cartItemLocationInfo2").type) {
            $item("#cartItemLocationInfo2").html = `<h3 class="wixui-rich-text__text" style="color: #FFFFFF;">${locText}</h3>`;
        }

    } catch (err) {
        logger.error("[CART EDITS REPEATER] Failed to render item. Cause:", err);
    }
}


export function syncCartEditsDependencies(vehicles, contacts, locations) {
    if (Array.isArray(vehicles)) globalVehicles = vehicles;
    if (Array.isArray(contacts)) globalContacts = contacts;
    if (Array.isArray(locations)) globalLocations = locations;

    if (currentDraftItem) {
        renderCurrentEditItem();
    }
}

function setupDraftItem() {
    if (!itemsToEdit || itemsToEdit.length === 0) return;
    if (currentEditIndex >= itemsToEdit.length) currentEditIndex = 0;

    let item = itemsToEdit[currentEditIndex];
    currentDraftItem = {
        ...item,
        vehicleId: item.vehicleId || "NONE",
        contactId: item.contactId || item.assignedContactId || "NONE",
        locationId: item.locationId || item.assignedLocationId || "NONE",
        specialInstructions: item.specialInstructions || ""
    };

    if ($w &&$w("#siTextbox").id) {
        $w("#siTextbox").value = currentDraftItem.specialInstructions;
    }

    if (currentDraftItem.vehicleId && currentDraftItem.vehicleId !== "NONE") {
     let existingVeh = globalVehicles.find(v => String(v._id) === String(currentDraftItem.vehicleId));
     if (existingVeh) syncDraftPackageToVehicle(existingVeh);
    }
}

export function startCartEditsFlow(items, routingToCalendar = false, fromCartMenu = false) {
    if (!items || items.length === 0) {
        // 💾 VAULT FALLBACK: If called with empty items on Back/Refresh, restore from session vault!
        let vaulted = session.getItem("vault_cartEdits_items");
        if (vaulted) {
            try { items = JSON.parse(vaulted); } catch (e) {}
        }
    }
    if (!items || items.length === 0) return;

    itemsToEdit = items.map(item => ({ ...item })); 
    isRoutingToCalendar = routingToCalendar;
    isCartMenuEdit = fromCartMenu;

    // 💾 SAVE FULL SNAPSHOT TO SESSION VAULT (Survives Refresh, Page Switch, and Back Button!)
    session.setItem("vault_cartEdits_items", JSON.stringify(itemsToEdit));
    session.setItem("vault_cartEdits_meta", JSON.stringify({
        isRoutingToCalendar: routingToCalendar,
        isCartMenuEdit: fromCartMenu
    }));

    let savedIdx = session.getItem("cartEditCurrentIndex");
    currentEditIndex = (savedIdx && Number(savedIdx) < itemsToEdit.length) ? Number(savedIdx) : 0;

    setupDraftItem();
    renderCurrentEditItem();
}

export function restoreCartEditsVaultIfNeeded() {
    let vaultedItemsRaw = session.getItem("vault_cartEdits_items");
    if (!vaultedItemsRaw) return false;
    try {
        let vaultedItems = JSON.parse(vaultedItemsRaw);
        let vaultedMeta = JSON.parse(session.getItem("vault_cartEdits_meta") || "{}");
        if (vaultedItems && vaultedItems.length > 0) {
            itemsToEdit = vaultedItems;
            isRoutingToCalendar = Boolean(vaultedMeta.isRoutingToCalendar);
            isCartMenuEdit = Boolean(vaultedMeta.isCartMenuEdit);
            let savedIdx = session.getItem("cartEditCurrentIndex");
            currentEditIndex = (savedIdx && Number(savedIdx) < itemsToEdit.length) ? Number(savedIdx) : 0;
            setupDraftItem();
            renderCurrentEditItem();
            return true;
        }
    } catch (e) {}
    return false;
}

async function renderCurrentEditItem() {
    // ⚡ AUTO-HYDRATE VEHICLES, CONTACTS & LOCATIONS FROM STATE MANAGER IF EMPTY!
    let mem = getMemoryState();
    if (!mem.packages || mem.packages.length === 0) {
        await getCatalogData(false);
        mem = getMemoryState();
    }
    if ((!globalVehicles || globalVehicles.length === 0) && mem.vehicles && mem.vehicles.length > 0) {
        globalVehicles = mem.vehicles;
    }
    if ((!globalContacts || globalContacts.length === 0) && mem.contacts && mem.contacts.length > 0) {
        globalContacts = mem.contacts;
    }
    if ((!globalLocations || globalLocations.length === 0) && mem.locations && mem.locations.length > 0) {
        globalLocations = mem.locations;
    }

    if (!itemsToEdit || itemsToEdit.length === 0) {
        let vaulted = session.getItem("vault_cartEdits_items");
        if (vaulted) {
            try { itemsToEdit = JSON.parse(vaulted); } catch (e) {}
        }
    }
    if (!itemsToEdit || itemsToEdit.length === 0) return;

    if (!currentDraftItem) {
        setupDraftItem();
    }
    if (!currentDraftItem) return;

    itemsToEdit[currentEditIndex] = { ...currentDraftItem };
    session.setItem("vault_cartEdits_items", JSON.stringify(itemsToEdit));
    session.setItem("cartEditCurrentIndex", String(currentEditIndex));
    
    if ($w("#cartEditsText").id) {
        $w("#cartEditsText").text = `Editing ${currentEditIndex + 1} out of ${itemsToEdit.length}`;
    }

    if ($w("#repCartEdit").id) {
        let windowInfo = await wixWindowFrontend.getBoundingRect();
        let isMobile = windowInfo.window.width <= 1200;

        let activeItems = [...itemsToEdit];
        activeItems[currentEditIndex] = currentDraftItem;

        let arrayToSync;
        if (isMobile) {
            // Shift the array so the current item is at index 0 (Viewport 1)
            let shiftedArray = activeItems.slice(currentEditIndex).concat(activeItems.slice(0, currentEditIndex));

            arrayToSync = shiftedArray.map((item, idx) => ({
                ...item,
                originalId: item.originalId || item._id,
                // Create a stable ID tied to the current index to defeat scroll anchoring
                _id: "slider_edit_" + currentEditIndex + "_" + idx
            }));
        } else {
            let displayItem = { ...currentDraftItem, _id: currentDraftItem._id + "_desktop" };
            arrayToSync = [displayItem];
        }

        smartSyncRepeater($w, "#repCartEdit", arrayToSync); 

        setTimeout(() => {
            $w("#repCartEdit").forEachItem(($item, itemData) => {
                paintSummaryCard($item, itemData);
            });
        }, 100);
    }

    if ($w("#selectVehicleRep").id) {
        let vData = globalVehicles.map(v => ({ ...v, isSelected: String(v._id) === String(currentDraftItem.vehicleId) }));
        smartSyncRepeater($w, "#selectVehicleRep", vData);
        if (vData.length > 0) $w("#selectVehicleRep").expand();
    }

    if ($w("#selectContactRep").id) {
        let cData = globalContacts.map(a => ({ ...a, isSelected: String(a._id) === String(currentDraftItem.contactId) }));
        smartSyncRepeater($w, "#selectContactRep", cData);
        if (cData.length > 0) $w("#selectContactRep").expand();
    }

    if ($w("#selectLocationRep").id) {
        let lData = globalLocations.map(a => ({ ...a, isSelected: String(a._id) === String(currentDraftItem.locationId) }));
        smartSyncRepeater($w, "#selectLocationRep", lData);
        if (lData.length > 0) $w("#selectLocationRep").expand();
    }

    // 1. Just show/hide the Prev button here (NO ONCLICK)
    if ($w("#prevItem").id) {
        if (currentEditIndex === 0) $w("#prevItem").hide(); 
        else $w("#prevItem").show();
    }
    
    // 2. Set up the Next/Submit button state on load
    if ($w("#submitCartEditsButton").id) {
        if (currentEditIndex < itemsToEdit.length - 1) {
            $w("#submitCartEditsButton").label = "Next";
        } else {
            $w("#submitCartEditsButton").label = "Submit";
        }
        
        let vValid = currentDraftItem.vehicleId && currentDraftItem.vehicleId !== "NONE";
        let cValid = currentDraftItem.contactId && currentDraftItem.contactId !== "NONE";
        let lValid = currentDraftItem.locationId && currentDraftItem.locationId !== "NONE";
        
        if (vValid && cValid && lValid) {
            $w("#submitCartEditsButton").enable(); 
        } else {
            $w("#submitCartEditsButton").disable(); 
        }
    }
} 

function syncSwipedItem(itemData) {
    if (isAnimatingSlider) return;
    // Look for our stable ID from the slider, or fallback to the standard ID
    let trueId = itemData.originalId || itemData._id;
    
    // Find where this item actually lives in the master itemsToEdit array
    let realIndex = itemsToEdit.findIndex(c => String(c._id) === String(trueId));
    
    // Only update if they actually swiped to a different item
    if (realIndex > -1 && realIndex !== currentEditIndex) {
        currentEditIndex = realIndex;
        setupDraftItem(); 
        
        // 1. Update the Header Text
        if ($w("#cartEditsText").id) {
            $w("#cartEditsText").text = `EDITING ${currentEditIndex + 1} OUT OF ${itemsToEdit.length}`;
        }
        
        // 2. Silently update the selection repeaters below so they match the newly swiped item
        if ($w("#selectVehicleRep").id) {
            let vData = globalVehicles.map(v => ({ ...v, isSelected: String(v._id) === String(currentDraftItem.vehicleId) }));
            smartSyncRepeater($w, "#selectVehicleRep", vData);
        }
        if ($w("#selectContactRep").id) {
            let cData = globalContacts.map(a => ({ ...a, isSelected: String(a._id) === String(currentDraftItem.contactId) }));
            smartSyncRepeater($w, "#selectContactRep", cData);
        }
        if ($w("#selectLocationRep").id) {
            let lData = globalLocations.map(a => ({ ...a, isSelected: String(a._id) === String(currentDraftItem.locationId) }));
            smartSyncRepeater($w, "#selectLocationRep", lData);
        }
        
        // 3. Update the Confirm Button state
        if ($w("#submitCartEditsButton").id) {
            // 💥 NEW: Dynamic Next/Submit Text
            if (currentEditIndex < itemsToEdit.length - 1) {
                $w("#submitCartEditsButton").label = "Next";
            } else {
                $w("#submitCartEditsButton").label = "Submit";
            }
            
            let vValid = currentDraftItem.vehicleId && currentDraftItem.vehicleId !== "NONE";
            let cValid = currentDraftItem.contactId && currentDraftItem.contactId !== "NONE";
            let lValid = currentDraftItem.locationId && currentDraftItem.locationId !== "NONE";
            
            if (vValid && cValid && lValid) {
                $w("#submitCartEditsButton").enable(); 
            } else {
                $w("#submitCartEditsButton").disable(); 
            }
        }

        // 4. Update Prev Button visibility
        if ($w("#prevItem").id) {
            if (currentEditIndex === 0) $w("#prevItem").hide(); 
            else $w("#prevItem").show();
        }
    }
}

function syncDraftPackageToVehicle(vehicleObj) {
    if (!currentDraftItem || !vehicleObj) return;
    let mem = getMemoryState();
    let allPackages = mem.packages || [];
    if (allPackages.length === 0) return;

    let vehType = vehicleObj.vehicleType || vehicleObj.subCategory || "";
    let matchedPkg = findMatchingServicePackage(allPackages, currentDraftItem, vehType);
    if (!matchedPkg) return;

    let newBase = Number(matchedPkg.price || 0);
    let newSale = Number(matchedPkg.salePrice || 0);
    let newMobile = Number(matchedPkg.mobileFee || 0);
    let newDuration = Number(matchedPkg.duration || currentDraftItem.setDuration || 2);
    let addOnsTotal = Number(currentDraftItem.totalAddOnsPrice || 0);

    let isSub = Array.isArray(currentDraftItem.discountsApplied) &&
        currentDraftItem.discountsApplied.some(d => String(d).includes("Car Club"));

    let newDiscountAmt = 0;
    let newDiscountsApplied = currentDraftItem.discountsApplied || [];

    if (!isSub) {
        if (newSale > 0 && newSale < newBase) {
            newDiscountAmt = newBase - newSale;
            let saleLabel = matchedPkg.saleTitle || "Special Offer";
            newDiscountsApplied = [saleLabel];
        } else {
            newDiscountAmt = 0;
            newDiscountsApplied = [];
        }
    } else {
        newDiscountAmt = Number(currentDraftItem.discountsTotal || 0);
    }

    currentDraftItem.packageId = matchedPkg._id;
    currentDraftItem.packageTitle = matchedPkg.title || currentDraftItem.packageTitle;
    currentDraftItem.level = matchedPkg.packageLevel || currentDraftItem.level;
    currentDraftItem.type = matchedPkg.detailType || currentDraftItem.type;
    currentDraftItem.subCategory = matchedPkg.subCategory || normalizeToPackageSubCategory(vehType);
    currentDraftItem.vehicleType = vehicleObj.vehicleType || matchedPkg.subCategory;
    currentDraftItem.vehicleCategory = vehicleObj.category || "Automotive";
    if (matchedPkg.image || matchedPkg.mainDisplayImage) {
        currentDraftItem.packageImage = matchedPkg.image || matchedPkg.mainDisplayImage;
    }

    currentDraftItem.basePrice = newBase;
    currentDraftItem.salePackagePrice = newSale;
    currentDraftItem.mobileFee = newMobile;
    currentDraftItem.setDuration = newDuration;
    currentDraftItem.discountsTotal = newDiscountAmt;
    currentDraftItem.discountsApplied = newDiscountsApplied;
    currentDraftItem.subTotal = newBase + newMobile + addOnsTotal;
    currentDraftItem.totalPrice = Math.max(0, (newBase + newMobile + addOnsTotal) - newDiscountAmt);
}

function autoSaveDraftToSessionAndDB() {
    if (!currentDraftItem) return;
    itemsToEdit[currentEditIndex] = { ...currentDraftItem };
    session.setItem("cartEditCurrentIndex", String(currentEditIndex));
    if (!session.getItem("editingScheduledJobId") && hooks.updateCartItemData) {
        hooks.updateCartItemData(currentDraftItem).catch(() => {});
    }
}

function initSelectionRepeaters() {
    if ($w("#selectVehicleRep").id) {
        registerRepeater($w, "#selectVehicleRep", ($item, itemData) => {
            if ($item("#selectVehicleRepText").type) {
                $item("#selectVehicleRepText").text = `${itemData.year || ''} ${itemData.make || ''} ${itemData.model || ''} ${itemData.color || ''}`.trim() || "Unknown Vehicle";
            }
            if ($item("#selectVehicleRepSVG").type) {
                $item("#selectVehicleRepSVG").src = itemData.isSelected ? SVG_SELECTED : SVG_UNSELECTED;
            }
            if ($item("#selectVehicleRepItem").type) {
                $item("#selectVehicleRepItem").onClick(() => {
                    currentDraftItem.vehicleId = itemData._id;
                    syncDraftPackageToVehicle(itemData);
                    autoSaveDraftToSessionAndDB();
                    renderCurrentEditItem();
                });
            }
        });
    }

    if ($w("#selectContactRep").id) {
        registerRepeater($w, "#selectContactRep", ($item, itemData) => {
            if ($item("#selectContactRepText").type) {
                let phoneStr = itemData.phone ? formatPhoneNumber(itemData.phone) : "";
                $item("#selectContactRepText").text = `${itemData.firstName || ''} ${itemData.lastName || ''}${phoneStr ? ' - ' + phoneStr : ''}`.trim();
            }
            if ($item("#selectContactRepSVG").type) {
                $item("#selectContactRepSVG").src = itemData.isSelected ? SVG_SELECTED : SVG_UNSELECTED;
            }
            if ($item("#selectContactRepItem").type) {
                $item("#selectContactRepItem").onClick(() => {
                    currentDraftItem.contactId = itemData._id; 
                    autoSaveDraftToSessionAndDB();
                    renderCurrentEditItem(); 
                });
            }
        });
    }

    if ($w("#selectLocationRep").id) {
        registerRepeater($w, "#selectLocationRep", ($item, itemData) => {
            if ($item("#selectAddress1RepText").type) {
                $item("#selectAddress1RepText").text = itemData.address1 || "No Address";
            }
            if ($item("#selectAddress2RepText").type) {
                if (itemData.address2 && itemData.address2.trim() !== "") {
                    $item("#selectAddress2RepText").text = itemData.address2;
                    $item("#selectAddress2RepText").expand();
                } else {
                    $item("#selectAddress2RepText").collapse();
                }
            }
            if ($item("#selectCitySTZipRepText").type) {
                let cityStr = itemData.city || '';
                let stateStr = itemData.state || '';
                let zipStr = itemData.zip || '';
                let formattedLine = `${cityStr}${cityStr && stateStr ? ', ' : ''}${stateStr} ${zipStr}`.trim();
                $item("#selectCitySTZipRepText").text = formattedLine || "No City/State/Zip";
            }
            if ($item("#selectLocationRepSVG").type) {
                $item("#selectLocationRepSVG").src = itemData.isSelected ? SVG_SELECTED : SVG_UNSELECTED;
            }
            if ($item("#selectLocationRepItem").type) {
                $item("#selectLocationRepItem").onClick(() => {
                    currentDraftItem.locationId = itemData._id; 
                    autoSaveDraftToSessionAndDB();
                    renderCurrentEditItem(); 
                });
            }
        });
    }
}

function initStaticButtons() {
    if ($w("#buttonSelectVehicle").id) {
        $w("#buttonSelectVehicle").onClick(() => {
            if (hooks.openOverlay) hooks.openOverlay($w, "lightbox", "addVehicleLightboxState");
        });
    }
    
    if ($w("#buttonSelectContact").id) {
        $w("#buttonSelectContact").onClick(() => {
            session.setItem("returnBreadcrumb", "cartEditsProfileState");
            smartGoTo("contactLocationsProfileState");
        });
    }

    if ($w("#buttonSelectLocation").id) {
        $w("#buttonSelectLocation").onClick(() => {
            session.setItem("returnBreadcrumb", "cartEditsProfileState");
            smartGoTo("contactLocationsProfileState"); 
        });
    }

    if ($w("#specialInstructionsButton").id) {
        $w("#specialInstructionsButton").onClick(() => {
            if (hooks.openOverlay) hooks.openOverlay($w, "popup", "vehicleInstructionsPopupState");
        });
    }
    
    if ($w("#submitSi").id) {
        $w("#submitSi").onClick(() => {
            if (currentDraftItem && $w("#siTextbox").id) {
                currentDraftItem.specialInstructions = $w("#siTextbox").value;
            }
        });
    }

    if ($w("#prevItem").id) {
        $w("#prevItem").onClick(async () => {
            if (currentEditIndex > 0) {
                currentEditIndex--; 
                setupDraftItem(); 

                let windowInfo = await wixWindowFrontend.getBoundingRect();
                if (windowInfo.window.width <= 1200) {
                    wixWindowFrontend.scrollTo(0, 0, { scrollAnimation: true });
                    
                    isAnimatingSlider = true; // Turn flag ON

                    await $w("#repCartEdit").hide("slide", { direction: "right", duration: 250 });
                    
                    // Await the new async render function
                    await renderCurrentEditItem();
                    
                    await new Promise(resolve => setTimeout(resolve, 150)); // let paint finish
                    await $w("#repCartEdit").show("slide", { direction: "left", duration: 250 });
                    
                    setTimeout(() => { isAnimatingSlider = false; }, 200); // Turn flag OFF
                } else {
                    await renderCurrentEditItem(); 
                }
            }
        });
    }

    if ($w("#submitCartEditsButton").id) {
        $w("#submitCartEditsButton").onClick(async () => {
            let vValid = currentDraftItem.vehicleId && currentDraftItem.vehicleId !== "NONE";
            let cValid = currentDraftItem.contactId && currentDraftItem.contactId !== "NONE";
            let lValid = currentDraftItem.locationId && currentDraftItem.locationId !== "NONE";

            if (!vValid || !cValid || !lValid) {
                showErrorMessage("⚠️ Missing vehicle, contact, or location.");
                return;
            }

            $w("#submitCartEditsButton").disable(); 
            $w("#submitCartEditsButton").label = "Saving...";

            itemsToEdit[currentEditIndex] = { ...currentDraftItem };

            // ==========================================
            // 💥 1. PROFILE EDIT MODE (Single Job Patch)
            // ==========================================
            let editJobId = session.getItem("editingScheduledJobId");
            
            if (editJobId) {
                let selVeh = globalVehicles.find(v => v._id === currentDraftItem.vehicleId);
                let selCon = globalContacts.find(c => c._id === currentDraftItem.contactId);
                let selLoc = globalLocations.find(l => l._id === currentDraftItem.locationId);

                let newUpdates = {};

                if (selVeh) {
                syncDraftPackageToVehicle(selVeh);
                    newUpdates.vehicleId = selVeh._id;
                    newUpdates.vehicleYear = selVeh.year || "";
                    newUpdates.vehicleMake = selVeh.make || "";
                    newUpdates.vehicleModel = selVeh.model || "";
                    newUpdates.vehicleColor = selVeh.color || "";
                    newUpdates.vehicleCategory = selVeh.category || "N/A";
                    newUpdates.vehicleType = selVeh.vehicleType || "N/A";
                    newUpdates.vehicleInfo = `${selVeh.year || ''} ${selVeh.make || ''} ${selVeh.model || ''} ${selVeh.color ? '- ' + selVeh.color : ''}`.replace(/\s+/g, ' ').trim();
                    newUpdates.basePrice = currentDraftItem.basePrice;
                    newUpdates.salePackagePrice = currentDraftItem.salePackagePrice;
                    newUpdates.mobileFee = currentDraftItem.mobileFee;
                    newUpdates.discountsTotal = currentDraftItem.discountsTotal;
                    newUpdates.discountsApplied = currentDraftItem.discountsApplied;
                    newUpdates.subTotal = currentDraftItem.subTotal;
                    newUpdates.totalPrice = currentDraftItem.totalPrice;
                    newUpdates.setDuration = currentDraftItem.setDuration;
                }

                if (selCon) {
                    newUpdates.contactId = selCon._id;
                    newUpdates.firstName = selCon.firstName || "";
                    newUpdates.lastName = selCon.lastName || "";
                    newUpdates.email = selCon.email || "";
                    newUpdates.phone = selCon.phone || "";
                }

                if (selLoc) {
                    newUpdates.locationId = selLoc._id;
                    newUpdates.address1 = selLoc.address1 || "";
                    newUpdates.address2 = selLoc.address2 || "";
                    newUpdates.city = selLoc.city || "";
                    newUpdates.state = selLoc.state || "";
                    newUpdates.zip = selLoc.zip || "";
                }
                
                if (currentDraftItem.specialInstructions !== undefined) {
                    newUpdates.specialInstructions = currentDraftItem.specialInstructions;
                }

                try {
                    logger.info(`Firing executeProfileJobEdit hook for Job ID: ${editJobId}`, newUpdates);
                    
                    if (!hooks.executeProfileJobEdit) {
                        throw new Error("executeProfileJobEdit is NOT defined in the Master Page hooks!");
                    }

                    let res = await hooks.executeProfileJobEdit(editJobId, newUpdates);
                    logger.info("Hook returned successfully:", res);

                    if (res && res.success) {
                        session.removeItem("editingScheduledJobId");
                        if (hooks.showSuccessMessage) hooks.showSuccessMessage("Details Updated!");
                        
                        // 🔥 INSTANT ROUTING: Removed the 800ms artificial delay
                        if (hooks.smartGoTo) hooks.smartGoTo("detailInfoProfileState");
                        
                        // Reset button instantly behind the scenes
                        $w("#submitCartEditsButton").enable();
                        $w("#submitCartEditsButton").label = "Save Changes";
                    } else {
                        throw new Error(res?.error || "Unknown error returned from hook.");
                    }
                } catch (err) {
                    logger.error("CRASH during executeProfileJobEdit:", err);
                    if (hooks.showErrorMessage) hooks.showErrorMessage("Update failed. Check console.");
                    
                    $w("#submitCartEditsButton").enable();
                    $w("#submitCartEditsButton").label = "Save Changes";
                }
                
                return; 
            }

            // ==========================================
            // 🛒 2. NORMAL CART CHECKOUT MODE
            // ==========================================
            if (hooks.updateCartItemData) {
                await hooks.updateCartItemData(itemsToEdit[currentEditIndex]);
            }
            
            if (currentEditIndex === itemsToEdit.length - 1) {
                if (hooks.finishCartEdits) hooks.finishCartEdits(isRoutingToCalendar, isCartMenuEdit);
            } else {
                currentEditIndex++;
                setupDraftItem(); 

                let windowInfo = await wixWindowFrontend.getBoundingRect();
                if (windowInfo.window.width <= 1200) {
                    wixWindowFrontend.scrollTo(0, 0, { scrollAnimation: true });
                    await $w("#repCartEdit").hide("slide", { direction: "left", duration: 250 });
                    
                    await renderCurrentEditItem();
                    
                    await new Promise(resolve => setTimeout(resolve, 150)); 
                    await $w("#repCartEdit").show("slide", { direction: "right", duration: 250 });
                } else {
                    await renderCurrentEditItem();
                }
            }

            if (currentEditIndex < itemsToEdit.length - 1) {
                $w("#submitCartEditsButton").label = "Next";
            } else {
                $w("#submitCartEditsButton").label = "Submit";
            }
            
            $w("#submitCartEditsButton").enable(); 
        }); 
    }
}