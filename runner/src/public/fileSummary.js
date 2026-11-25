// --- public/fileSummary.js ---

/**
 * ========================================================================
 * 🤖 AI CONTEXT & ARCHITECTURE NOTE
 * ========================================================================
 * FILE: public/fileSummary.js
 * DOM TARGETS: `#summaryLightboxState`
 * PURPOSE: Builds the final itemized receipt before Cart injection.
 * 
 * 🔗 CROSS-FILE BRANCHES:
 * - Pulls `DraftEnvelope` from `packagesEngine.js`.
 * - Handles "Batch Edit" queues sent by `cartUIEngine.js`.
 * 
 * 🛑 STRICT AI INSTRUCTIONS:
 * 1. MATH: Keep formula/discount reductions synced here. Ensure 
 *    `calculateCartData()` handles new fees before passing to Confirm button.
 * 2. REPEATERS: NEVER use native `.onItemReady()`. Use `repeaterEngine.js`.
 * ========================================================================
 */

import wixData from 'wix-data';
import { registerRepeater, smartSyncRepeater } from 'public/repeaterEngine';
import { formatPhoneNumber } from 'public/cartEngine';
import { getActiveUserId } from 'public/authEngine';
import { initRouterEngine, smartGoTo, openSideMenu, closeSideMenu, openOverlay, closeAllOverlays, closeTopOverlay, showSuccessMessage, showErrorMessage } from 'public/routerEngine';
import { APP_LOGS } from 'public/loggerConfig';
import { getDraftEnvelope, removePackageAddOn, unpackPackageState, clearActivePackageMemory, getWhatsIncludedMasterData } from 'public/packagesEngine';
import { findMatchingServicePackage, normalizeToPackageSubCategory } from 'public/packageMatcher';
import { getMemoryState } from 'public/stateManager';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';
import { pushCrmRecordToSupabase } from 'backend/aiBrain.web';

let $w;
let hooks;

const DEBUG_MODE = APP_LOGS.MASTER_SWITCH && APP_LOGS.SUMMARY;
const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [FILE_SUMMARY]: ${msg}`, data) : console.log(`📌 [FILE_SUMMARY]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [FILE_SUMMARY]: ${msg}`, data) : console.warn(`📌 [FILE_SUMMARY]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [FILE_SUMMARY]: ${msg}`, data) : console.error(`📌 [FILE_SUMMARY]: ${msg}`); }
};

// 🌟 Local State Memory
let summaryQueue = [];
let currentSummaryIndex = 0;
let isBatchMode = false;
let selectedSummaryVehicleId = "NONE";

// 🌟 Shared Database Memory
let cartData = [];
let globalVehicles = [];
let globalContacts = [];
let globalLocations = [];
let g_allData = [];

registerModuleState("fileSummary", () => {
    let activeEnv = null;
    try { activeEnv = getDraftEnvelope(); } catch (e) {}
    return {
        isBatchMode,
        currentSummaryIndex,
        summaryQueueCount: (summaryQueue || []).length,
        selectedSummaryVehicleId,
        cartDataCount: (cartData || []).length,
        activeDraftEnvelope: activeEnv
    };
});

registerDomElements({
    repeaters: ["#repWI", "#repWE", "#noticeRep", "#repIAddonsG", "#repEAddonsG"]
});

export function initSummaryEngine($wContext, providedHooks) {
    logger.info("Initializing Summary Engine...");
    $w = $wContext;
    hooks = providedHooks;

    initSummaryRepeaters();
    initConfirmButtons();
}

export function syncSummaryData(cart, vehicles, contacts, locations, allData) {
    if (cart) cartData = cart;
    if (vehicles) globalVehicles = vehicles;
    if (contacts) globalContacts = contacts;
    if (locations) globalLocations = locations;
    if (allData) g_allData = allData;
}

export function setSelectedSummaryVehicle(vehicleId) {
    selectedSummaryVehicleId = vehicleId;
}

export function startSummaryEditFlow(itemsToEdit) {
    summaryQueue = itemsToEdit;
    currentSummaryIndex = 0;
    isBatchMode = true;
    renderSummaryItem();
}

// ==========================================
// 🎨 CORE PAINTING ENGINES
// ==========================================
export function updateSummary() {
    console.log("🚀 [SUMMARY ENGINE] updateSummary() TRIGGERED!");
    
    let env = getDraftEnvelope();
    if (!env) {
        console.error("🚨 [SUMMARY ENGINE ERROR] getDraftEnvelope() returned null/undefined!");
        return; 
    }
    
    console.log("📦 [SUMMARY ENGINE] Draft Envelope Fetched:", env);
    
    const cart = calculateCartData(env);

    if ($w("#sumTitleG").id) $w("#sumTitleG").text = env.title;
    
    if ($w("#sumIsSubscription2G").id) {
        $w("#sumIsSubscription2G").text = cart.isSub ? "Subscription" : "Non-subscription";
    }

    if (cart.isSub || cart.discountAmount > 0) {
        if ($w("#saleTitleG").id) { 
            $w("#saleTitleG").text = cart.isSub ? `Car Club: ${cart.subFrequency}` : env.saleTitle; 
            $w("#saleTitleG").expand(); 
        }
    } else {
        if ($w("#saleTitleG").id) $w("#saleTitleG").collapse(); 
    }

    if ($w("#sumAddOnAmountG").id) $w("#sumAddOnAmountG").text = `Add-Ons (${env.addOns.length})`;

    let parsedDuration = Number(String(env.duration).replace(/[^0-9.]/g, '')) || "--";
    if ($w("#sumTime2G").id) $w("#sumTime2G").text = `Duration: ${parsedDuration} hr(s)`;
    
    if ($w("#sumImage1G").id) {
        if (env.image) {
            $w("#sumImage1G").src = env.image;
            $w("#sumImage1G").show("fade", { duration: 200 });
        } else {
            $w("#sumImage1G").hide();
        }
    }

    if ($w("#packagePrice202").id) $w("#packagePrice202").text = `$${Number(cart.basePrice).toFixed(2)}`;
    if ($w("#addOnsTotal202").id) $w("#addOnsTotal202").text = `$${Number(cart.addOnsTotal).toFixed(2)}`;
    if ($w("#mobileFee02").id) $w("#mobileFee02").text = env.mobileFee ? `$${Number(env.mobileFee).toFixed(2)}` : "$0.00";

    if ($w("#totalDiscounts02").id) {
        if (cart.discountAmount > 0) {
            let discountName = cart.isSub ? `Car Club: ${cart.subFrequency}` : env.saleTitle;
            $w("#totalDiscounts02").text = `${discountName} (-$${cart.discountAmount.toFixed(2)})`;
        } else {
            $w("#totalDiscounts02").text = "$0.00";
        }
    }

    if ($w("#grandTotal02").id) $w("#grandTotal02").text = `$${Number(cart.grandTotal).toFixed(2)}`;

    let wiData = getWhatsIncludedData(env.level, env.type);
    console.log("🧩 [SUMMARY ENGINE] WhatsIncludedData Parsed:", wiData);
    
    // --- WI REPEATER LOGGING ---
    if ($w("#repWI").id) {
        console.log(`✅ [SUMMARY ENGINE] #repWI found in DOM. IntData length: ${wiData.intData.length}`);
        smartSyncRepeater($w, "#repWI", wiData.intData);
        if (wiData.intData.length > 0) $w("#repWI").expand();
        else $w("#repWI").collapse();
    }
    
    // --- WE REPEATER LOGGING ---
    if ($w("#repWE").id) {
        console.log(`✅ [SUMMARY ENGINE] #repWE found in DOM. ExtData length: ${wiData.extData.length}`);
        smartSyncRepeater($w, "#repWE", wiData.extData);
        if (wiData.extData.length > 0) $w("#repWE").expand();
        else $w("#repWE").collapse();
    }

    // --- NOTICE REPEATER LOGGING ---
    if ($w("#noticeRep").id) {
        let allWiItems = [...wiData.intData, ...wiData.extData];
        let notices = allWiItems
            .filter(item => item.notice && item.notice.trim() !== "")
            .map((item, idx) => ({ _id: item._id || `notice_${idx}`, noticeText: item.notice }));

        console.log(`✅ [SUMMARY ENGINE] #noticeRep found in DOM. Notices length: ${notices.length}`);
        smartSyncRepeater($w, "#noticeRep", notices);
        if (notices.length > 0) $w("#noticeRep").expand();
        else $w("#noticeRep").collapse();
    }

    let interiorAddOns = env.addOns.filter(a => a.detailType && a.detailType.includes("Interior"));
    let exteriorAddOns = env.addOns.filter(a => a.detailType && a.detailType.includes("Exterior"));

    if ($w("#repIAddonsG").id) { 
        smartSyncRepeater($w, "#repIAddonsG", interiorAddOns.length > 0 ? interiorAddOns : [{ _id: "empty_int", title: "No Add-Ons Selected", price: 0, isPlaceholder: true }]); 
        $w("#repIAddonsG").expand(); 
    }
    if ($w("#repEAddonsG").id) { 
        smartSyncRepeater($w, "#repEAddonsG", exteriorAddOns.length > 0 ? exteriorAddOns : [{ _id: "empty_ext", title: "No Add-Ons Selected", price: 0, isPlaceholder: true }]); 
        $w("#repEAddonsG").expand(); 
    }
}

function renderSummaryItem() {
    if (summaryQueue.length === 0) return; 
    let currentItem = summaryQueue[currentSummaryIndex];
    
    if ($w("#sumTime2G").id) $w("#sumTime2G").text = `Duration: ${currentItem.setDuration || "--"}`;
    
    let isSub = Array.isArray(currentItem.discountsApplied) && currentItem.discountsApplied.some(d => d.includes("Car Club")) ? "Subscription" : "Non-subscription";
    if ($w("#sumIsSubscription2G").id) $w("#sumIsSubscription2G").text = isSub;
    
    if ($w("#sumImage1G").id) {
        if (currentItem.packageImage) {
            $w("#sumImage1G").src = currentItem.packageImage;
            $w("#sumImage1G").show("fade", { duration: 200 });
        } else {
            $w("#sumImage1G").hide();
        }
    }

    if ($w("#packagePrice202").id) $w("#packagePrice202").text = currentItem.basePrice ? `$${Number(currentItem.basePrice).toFixed(2)}` : "$0.00";

    if ($w("#addOnsTotal202").id) {
        let addonsTotal = currentItem.totalAddOnsPrice || 0;
        $w("#addOnsTotal202").text = `$${Number(addonsTotal).toFixed(2)}`;
    }

    if ($w("#mobileFee02").id) $w("#mobileFee02").text = currentItem.mobileFee ? `$${Number(currentItem.mobileFee).toFixed(2)}` : "$0.00";

    if ($w("#totalDiscounts02").id) {
        let discounts = currentItem.discountsTotal || 0;
        if (discounts > 0 && currentItem.discountsApplied && currentItem.discountsApplied.length > 0) {
            let discountName = currentItem.discountsApplied[0];
            $w("#totalDiscounts02").text = `${discountName} (-$${Number(discounts).toFixed(2)})`;
        } else if (discounts > 0) {
            $w("#totalDiscounts02").text = `-$${Number(discounts).toFixed(2)}`;
        } else {
            $w("#totalDiscounts02").text = "$0.00";
        }
    }

    if ($w("#grandTotal02").id) $w("#grandTotal02").text = currentItem.totalPrice ? `$${Number(currentItem.totalPrice).toFixed(2)}` : "$0.00";

    let currentLevel = currentItem.level || "Classic";
    let currentType = currentItem.type || "Full";
    let wiDataQ = getWhatsIncludedData(currentLevel, currentType);
    
    if ($w("#repWI").id) {
        smartSyncRepeater($w, "#repWI", wiDataQ.intData);
        if (wiDataQ.intData.length > 0) $w("#repWI").expand();
        else $w("#repWI").collapse();
    }
    
    if ($w("#repWE").id) {
        smartSyncRepeater($w, "#repWE", wiDataQ.extData);
        if (wiDataQ.extData.length > 0) $w("#repWE").expand();
        else $w("#repWE").collapse();
    }

    if ($w("#noticeRep").id) {
        let allWiItems = [...wiDataQ.intData, ...wiDataQ.extData];
        let notices = allWiItems
            .filter(item => item.notice && item.notice.trim() !== "")
            .map((item, idx) => ({ _id: item._id || `notice_${idx}`, noticeText: item.notice }));

        smartSyncRepeater($w, "#noticeRep", notices);
        if (notices.length > 0) $w("#noticeRep").expand();
        else $w("#noticeRep").collapse();
    }

    let intCount = (currentItem.interiorAddOns && Array.isArray(currentItem.interiorAddOns)) ? currentItem.interiorAddOns.length : 0; 
    let extCount = (currentItem.exteriorAddOns && Array.isArray(currentItem.exteriorAddOns)) ? currentItem.exteriorAddOns.length : 0;
    if ($w("#sumAddOnAmountG").id) $w("#sumAddOnAmountG").text = `Add-Ons (${intCount + extCount})`;

    if (Array.isArray(currentItem.discountsApplied) && currentItem.discountsApplied.length > 0) {
        if ($w("#saleTitleG").id) { $w("#saleTitleG").text = currentItem.discountsApplied[0]; $w("#saleTitleG").expand(); }
    } else { 
        if ($w("#saleTitleG").id) $w("#saleTitleG").collapse(); 
    }

    const parseAddOnTag = (tag) => { 
        let match = tag.match(/(.*?)\s*\(\$([\d.]+)\)/); 
        if (match) return { title: match[1].trim(), price: `$${match[2]}` }; 
        return { title: tag, price: "$0.00" }; 
    };
    
    let intAddOns = (currentItem.interiorAddOns || []).map((tag, idx) => { let p = parseAddOnTag(tag); return { _id: `int_${idx}`, title: p.title, price: p.price, originalTag: tag }; });
    let extAddOns = (currentItem.exteriorAddOns || []).map((tag, idx) => { let p = parseAddOnTag(tag); return { _id: `ext_${idx}`, title: p.title, price: p.price, originalTag: tag }; });

    if ($w("#repIAddonsG").id) { 
        smartSyncRepeater($w, "#repIAddonsG", intAddOns.length > 0 ? intAddOns : [{ _id: "empty_int", title: "No Add-Ons Selected", price: "$0.00", isPlaceholder: true }]); 
        $w("#repIAddonsG").expand(); 
    }
    if ($w("#repEAddonsG").id) { 
        smartSyncRepeater($w, "#repEAddonsG", extAddOns.length > 0 ? extAddOns : [{ _id: "empty_ext", title: "No Add-Ons Selected", price: "$0.00", isPlaceholder: true }]); 
        $w("#repEAddonsG").expand(); 
    }

    if ($w("#confirmEditG").id) {
        if (currentSummaryIndex === summaryQueue.length - 1) {
            $w("#confirmEditG").label = "Done";
        } else {
            $w("#confirmEditG").label = `Next Package (${currentSummaryIndex + 1} of ${summaryQueue.length})`;
        }
    }
}

// ==========================================
// 🛠️ REPEATER REGISTRATION & HELPERS
// ==========================================

function getWhatsIncludedData(level, type) {
    // 💥 Pull the populated array directly from the packages engine!
    let masterData = getWhatsIncludedMasterData() || [];
    
    console.log(`🔍 [SUMMARY ENGINE] getWhatsIncludedData called with Level: '${level}', Type: '${type}'`);
    console.log(`📦 [SUMMARY ENGINE] Current masterData array length: ${masterData.length}`);

    let levelItems = masterData.filter(item => item.whatsIncluded && item.whatsIncluded.includes(level))
                              .sort((a, b) => (a.sort || "").toString().localeCompare((b.sort || "").toString()));
    
    console.log(`🎯 [SUMMARY ENGINE] Items matching level '${level}': ${levelItems.length}`);

    let intData = type !== "Exterior" ? levelItems.filter(i => i.detailType && i.detailType.includes("Interior")) : [];
    let extData = type !== "Interior" ? levelItems.filter(i => i.detailType && i.detailType.includes("Exterior")) : [];
    
    return { intData, extData };
}

function calculateCartData(env) {
    let addOnsTotal = 0; 
    let formattedAddOnsList = [];
    
    env.addOns.forEach(item => { 
        let itemPrice = Number(item.price || 0); 
        addOnsTotal += itemPrice; 
        formattedAddOnsList.push(`${item.buttonTitle || item.title || "Add-On"} ($${itemPrice.toFixed(2)})`); 
    });

    let activeBase = env.basePrice; 
    let activeDiscount = 0;
    if (env.isSub) {
        activeDiscount = env.basePrice - env.subPrice; 
    } else if (env.salePrice > 0) {
        activeDiscount = env.basePrice - env.salePrice;
    }

    return { 
        basePrice: activeBase, 
        discountAmount: activeDiscount, 
        addOnsTotal, 
        formattedAddOns: formattedAddOnsList, 
        grandTotal: (activeBase - activeDiscount + addOnsTotal + env.mobileFee), 
        isSub: env.isSub, 
        subFrequency: env.subFrequency 
    };
}

async function removeAddOnFromCart(tagToRemove, type) {
    let currentItem = summaryQueue[currentSummaryIndex];
    
    if (type === "interior") {
        currentItem.interiorAddOns = currentItem.interiorAddOns.filter(t => t !== tagToRemove); 
    } else {
        currentItem.exteriorAddOns = currentItem.exteriorAddOns.filter(t => t !== tagToRemove);
    }
    
    let match = tagToRemove.match(/\(\$([\d.]+)\)/); 
    let priceToSubtract = match ? parseFloat(match[1]) : 0;
    
    currentItem.totalAddOnsPrice = Math.max(0, (currentItem.totalAddOnsPrice || 0) - priceToSubtract); 
    currentItem.totalPrice = Math.max(0, (currentItem.totalPrice || 0) - priceToSubtract);
    
    try { 
        let updatedCartItem = await wixData.update("temporaryData", currentItem);
        pushCrmRecordToSupabase("temporaryData", updatedCartItem || currentItem).catch(() => {});
        let mainIndex = cartData.findIndex(c => String(c._id) === String(currentItem._id)); 
        if (mainIndex > -1) cartData[mainIndex] = currentItem; 
        
        if (hooks.refreshCartVisuals) hooks.refreshCartVisuals();
        renderSummaryItem(); 
    } catch(e) {
        logger.error("Failed to remove Addon:", e);
    }
}

function initSummaryRepeaters() {

    const paintWI = ($item, itemData, prefix) => {
        let titleId = `#repW${prefix}Text1`;
        if ($item(titleId).type) $item(titleId).text = itemData.buttonTitle || itemData.title || "Included Item";
    };

    if ($w("#repWI").id) registerRepeater($w, "#repWI", ($item, itemData) => paintWI($item, itemData, "I"));
    if ($w("#repWE").id) registerRepeater($w, "#repWE", ($item, itemData) => paintWI($item, itemData, "E"));

    if ($w("#noticeRep").id) {
        registerRepeater($w, "#noticeRep", ($item, itemData) => {
            if ($item("#noticeRepText").type) $item("#noticeRepText").text = itemData.noticeText;
        });
    }

    const handleAddOnDelete = async (itemData, type) => {
        if (summaryQueue && summaryQueue.length > 0) {
            await removeAddOnFromCart(itemData.originalTag || itemData.title, type);
        } else { 
            removePackageAddOn(itemData._id); 
            updateSummary(); 
        }
    };

    const paintSummaryAddon = ($item, itemData, type) => {
        let titleId = type === "interior" ? "#sumItitleG" : "#sumEtitleG";
        let priceId = type === "interior" ? "#sumIpricesG" : "#sumEpricesG";
        let delId = type === "interior" ? "#addIdeleteG" : "#addEdeleteG";

        if ($item(titleId).type) $item(titleId).text = itemData.buttonTitle || itemData.title;
        if ($item(priceId).type) $item(priceId).text = typeof itemData.price === 'string' ? itemData.price : `$${Number(itemData.price || 0).toFixed(2)}`;
        
        if (itemData.isPlaceholder) { 
            if ($item(delId).type) $item(delId).hide(); 
        } else { 
            if ($item(delId).type) $item(delId).show(); 
        }
    };

    if ($w("#repIAddonsG").id) registerRepeater($w, "#repIAddonsG", ($item, itemData) => paintSummaryAddon($item, itemData, "interior"));
    if ($w("#repEAddonsG").id) registerRepeater($w, "#repEAddonsG", ($item, itemData) => paintSummaryAddon($item, itemData, "exterior"));

    if ($w("#addIdeleteG").id) {
        $w("#addIdeleteG").onClick(async (event) => {
            let itemData = $w("#repIAddonsG").data.find(d => d._id === event.context.itemId);
            if (itemData && !itemData.isPlaceholder) await handleAddOnDelete(itemData, "interior");
        });
    }
    if ($w("#addEdeleteG").id) {
        $w("#addEdeleteG").onClick(async (event) => {
            let itemData = $w("#repEAddonsG").data.find(d => d._id === event.context.itemId);
            if (itemData && !itemData.isPlaceholder) await handleAddOnDelete(itemData, "exterior");
        });
    }
}

// ==========================================
// ⚙️ CONFIRMATION BUTTONS ENGINE
// ==========================================
function initConfirmButtons() {
    if ($w("#confirmButtonLBG").id) {
        $w("#confirmButtonLBG").onClick(async () => {
            $w("#confirmButtonLBG").disable(); 
            $w("#confirmButtonLBG").label = "Adding to Cart...";
            
            try {
                let env = getDraftEnvelope(); 
                const cart = calculateCartData(env);
                
                let safeDurationStr = String(env.duration || "0");
                let parsedDuration = Number(safeDurationStr.replace(/[^0-9.]/g, '')) || 0;

                let intAddOnsList = []; 
                let extAddOnsList = [];
                
                env.addOns.forEach(item => {
                    let itemPrice = Number(item.price || 0); 
                    let tagString = `${item.buttonTitle || item.title || "Add-On"} ($${itemPrice.toFixed(2)})`;
                    if (item.detailType && item.detailType.includes("Exterior")) extAddOnsList.push(tagString); 
                    else intAddOnsList.push(tagString);
                });

                let discountNameArr = cart.isSub ? [`Car Club: ${cart.subFrequency}`] : (cart.discountAmount > 0 ? [env.saleTitle] : []);
                let safeVehicleId = (selectedSummaryVehicleId && selectedSummaryVehicleId !== "NONE" && selectedSummaryVehicleId !== "ADD_NEW") ? selectedSummaryVehicleId : null;
                let selVeh = globalVehicles.find(v => String(v._id) === String(safeVehicleId));
                let activeUserId = await getActiveUserId();

                let initialSubCat = normalizeToPackageSubCategory(selVeh ? selVeh.vehicleType : env.vehicleSize) || "Sedan";
                let resolvedBasePrice = cart.basePrice;
                let resolvedSalePrice = env.salePrice;
                let resolvedMobileFee = env.mobileFee;
                let resolvedDiscount = cart.discountAmount;
                let resolvedTotal = cart.grandTotal;

                // If a vehicle is already attached, guarantee package price matches that vehicle's type
                if (selVeh) {
                    let allPkgs = getMemoryState().packages || [];
                    let matchedPkg = findMatchingServicePackage(allPkgs, env, selVeh.vehicleType, selVeh);
                    if (matchedPkg) {
                        resolvedBasePrice = Number(matchedPkg.price || 0);
                        resolvedSalePrice = Number(matchedPkg.salePrice || 0);
                        resolvedMobileFee = Number(matchedPkg.mobileFee || 0);
                        parsedDuration = Number(matchedPkg.duration || parsedDuration || 0);
                        if (!cart.isSub) {
                            resolvedDiscount = (resolvedSalePrice > 0 && resolvedSalePrice < resolvedBasePrice)
                                ? (resolvedBasePrice - resolvedSalePrice)
                                : 0;
                            discountNameArr = resolvedDiscount > 0 ? [matchedPkg.saleTitle || "Special Offer"] : [];
                        }
                        resolvedTotal = Math.max(0, (resolvedBasePrice - resolvedDiscount) + cart.addOnsTotal + resolvedMobileFee);
                    }
                }

                let payload = {
                    userId: activeUserId,
                    status: "Draft",
                    packageTitle: env.title,
                    level: env.level,
                    type: env.type,
                    subCategory: initialSubCat,
                    vehicleType: selVeh ? (selVeh.vehicleType || initialSubCat) : initialSubCat,
                    packageImage: env.image || env.mainImage || env.mainDisplayImage || "",
                    vehicleYear: selVeh ? (selVeh.vehicleYear || selVeh.year || "") : "",
                    vehicleMake: selVeh ? (selVeh.vehicleMake || selVeh.make || "") : "",
                    vehicleModel: selVeh ? (selVeh.vehicleModel || selVeh.model || "") : "",
                    vehicleColor: selVeh ? (selVeh.vehicleColor || selVeh.color || "") : "",
                    basePrice: resolvedBasePrice,
                    mobileFee: resolvedMobileFee,
                    totalAddOnsPrice: cart.addOnsTotal,
                    interiorAddOns: intAddOnsList,
                    exteriorAddOns: extAddOnsList,
                    discountsTotal: resolvedDiscount,
                    discountsApplied: discountNameArr,
                    salePackagePrice: resolvedSalePrice,
                    totalPrice: resolvedTotal,
                    setDuration: parsedDuration,
                    orderId: "ord_" + Date.now().toString() + Math.floor(Math.random() * 1000)
                };

                if (safeVehicleId) payload.vehicleId = safeVehicleId;

                if (summaryQueue && summaryQueue.length > 0) {
                    payload._id = summaryQueue[currentSummaryIndex]._id;
                    let updatedDraft = await wixData.update("temporaryData", payload);
                    pushCrmRecordToSupabase("temporaryData", updatedDraft || payload).catch(() => {});
                    let idx = cartData.findIndex(c => String(c._id) === String(payload._id));
                    if (idx > -1) cartData[idx] = payload;
                    summaryQueue = []; 
                } else {
                    let insertedItem = await wixData.insert("temporaryData", payload);
                    pushCrmRecordToSupabase("temporaryData", insertedItem || payload).catch(() => {});
                    cartData.unshift(insertedItem);
                }

                if (typeof clearActivePackageMemory === "function") {
                    clearActivePackageMemory();
                }
                
                $w("#confirmButtonLBG").label = "Added to Cart!";
                $w("#confirmButtonLBG").style.backgroundColor = "#17E6AD"; 
                $w("#confirmButtonLBG").style.color = "#000000";
                
                if (hooks.refreshCartVisuals) hooks.refreshCartVisuals();
                if (hooks.loadCartData) hooks.loadCartData();

                setTimeout(() => {
                    if (hooks.unlockSlider) hooks.unlockSlider();
                    if (hooks.closeAllOverlays) hooks.closeAllOverlays($w);
                    $w("#confirmButtonLBG").enable(); 
                    $w("#confirmButtonLBG").label = "Confirm Add to Cart";
                    $w("#confirmButtonLBG").style.backgroundColor = "#000000"; 
                    $w("#confirmButtonLBG").style.color = "#FFFFFF";
                }, 600);

            } catch (err) {
                logger.error("Checkout Summary Payload Error", err);
                $w("#confirmButtonLBG").enable(); 
                $w("#confirmButtonLBG").label = "Error. Try Again."; 
                $w("#confirmButtonLBG").style.backgroundColor = "#DF3131"; 
                
                showErrorMessage(`⚠️ ${String(err).substring(0, 50)}...`);
            }
        });
    }

    if ($w("#confirmEditG").id) {
        $w("#confirmEditG").onClick(() => {
            if (currentSummaryIndex === summaryQueue.length - 1) {
                if (hooks.closeAllOverlays) hooks.closeAllOverlays($w);
            } else { 
                currentSummaryIndex++; 
                renderSummaryItem(); 
            } 
        });
    }
}