// --- public/filePackageEdits.js ---

/**
 * ========================================================================
 * 🤖 AI CONTEXT & ARCHITECTURE NOTE
 * ========================================================================
 * FILE: public/filePackageEdits.js
 * DOM TARGETS: `#packageEditsLightboxState` (Lightbox state)
 * PURPOSE: Handles modifying/upgrading ALREADY scheduled jobs (from Profile).
 * 
 * 🔗 CROSS-FILE BRANCHES:
 * - Injects updated jobs directly back into `profileEngine.js` via hooks 
 *   to avoid circular imports.
 * ========================================================================
 */

import wixData from 'wix-data';
import { session } from 'wix-storage';
import { initRouterEngine, smartGoTo, openSideMenu, closeSideMenu, openOverlay, closeAllOverlays, closeTopOverlay, showSuccessMessage, showErrorMessage } from 'public/routerEngine';
import { updateOrRestoreDetailingJob, broadcastCalendarUpdate } from 'backend/calendar-dispatcher.web';
import { buildCalendarDates } from 'public/cartEngine';
import { registerRepeater, smartSyncRepeater } from 'public/repeaterEngine'; 
import { openDetailedWiPopup } from 'public/fileWhatsIncludedG';
import { APP_LOGS } from 'public/loggerConfig';
import { normalizeToPackageSubCategory } from 'public/packageMatcher';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

let $w;
let hooks; 

const DEBUG_MODE = APP_LOGS.MASTER_SWITCH && APP_LOGS.PACKAGE_EDITS;

const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [FILE_PACKAGE_EDITS]: ${msg}`, data) : console.log(`📌 [FILE_PACKAGE_EDITS]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [FILE_PACKAGE_EDITS]: ${msg}`, data) : console.warn(`📌 [FILE_PACKAGE_EDITS]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [FILE_PACKAGE_EDITS]: ${msg}`, data) : console.error(`📌 [FILE_PACKAGE_EDITS]: ${msg}`); }
};

// 🌟 LOCALIZED STATE
let tempPackageJob = null;
let masterPackageData = []; 
let masterAddOnData = []; 
let packageEditActiveTab = "Exterior"; 
let isPackageEngineInitialized = false; 

registerModuleState("filePackageEdits", () => ({
    isPackageEngineInitialized,
    packageEditActiveTab,
    masterPackageDataCount: (masterPackageData || []).length,
    masterAddOnDataCount: (masterAddOnData || []).length,
    tempPackageJob: tempPackageJob ? {
        _id: tempPackageJob._id,
        packageTitle: tempPackageJob.packageTitle,
        level: tempPackageJob.level,
        type: tempPackageJob.type,
        subCategory: tempPackageJob.subCategory,
        basePrice: tempPackageJob.basePrice,
        totalAddOnsPrice: tempPackageJob.totalAddOnsPrice,
        totalPrice: tempPackageJob.totalPrice,
        interiorAddOns: tempPackageJob.interiorAddOns || [],
        exteriorAddOns: tempPackageJob.exteriorAddOns || []
    } : null
}));

registerDomElements({
    boxes: ["#packageEditCustom", "#lightbox2ClickBackground"],
    repeaters: ["#packagesInfoRep", "#repAdd2", "#repPackageEdit", "#whatsIncludedStepsRep"]
}); 

export function initPackageEditEngine(wixContext, providedHooks) {
    logger.info("Initializing Package Edit Engine...");
    $w = wixContext;
    hooks = providedHooks || {}; 
    initPackageAddOnsEngine();
    initPackageEditButtons(); 
    isPackageEngineInitialized = true;
}

export async function loadPackageEditMode(jobId) {
    logger.info(`Entering Edit Mode for Job ID: ${jobId}`);
    try {
        let res = await wixData.query("scheduledJobs").eq("_id", jobId).find();
        if (res.items.length === 0) {
            logger.warn("Job not found in database.");
            return;
        }
        
        tempPackageJob = { ...res.items[0] };
        logger.info("Loaded Job Data:", tempPackageJob);
        
        if (masterPackageData.length === 0) {
            logger.info("Fetching master packages data...");
            let pkgRes = await wixData.query("servicePackages").find(); 
            masterPackageData = pkgRes.items;
        }
        if (masterAddOnData.length === 0) {
            logger.info("Fetching master add-ons data...");
            let addOnRes = await wixData.query("autoWhatsIncluded").limit(1000).find();
            masterAddOnData = addOnRes.items;
        }

        if ($w("#packageEditCustomText").id) {
            $w("#packageEditCustomText").text = tempPackageJob.packageTitle || "Select Package...";
        }

        if (tempPackageJob.isSubscription) {
            if ($w("#packageEditCustom").id) $w("#packageEditCustom").hide();
        } else {
            if ($w("#packageEditCustom").id) $w("#packageEditCustom").show();
        }

        if ($w("#packagesInfoRep").id) {
            let targetSubCat = normalizeToPackageSubCategory(tempPackageJob.vehicleType || tempPackageJob.subCategory || "Sedan") || "Sedan";
            let matchingVehiclePackages = masterPackageData.filter(p =>
                normalizeToPackageSubCategory(p.subCategory) === targetSubCat
            );
            let pool = matchingVehiclePackages.length > 0 ? matchingVehiclePackages : masterPackageData;

            let pkgOpts = pool.map(p => {
                let base = Number(p.price || 0);
                let pct = Number(p.discountPercent || 0);
                let flat = Number(p.salePrice || 0);
                let calc = pct > 0 ? base - (base * (pct / 100)) : flat;
                let hasSale = (calc > 0 && calc < base);
                return {
                    _id: "pkg_" + p._id,
                    title: p.title || `${p.packageLevel} ${p.detailType} Detail`,
                    priceText: `$${base.toFixed(2)}`,
                    salePriceText: hasSale ? `$${calc.toFixed(2)}` : null,
                    discountAmt: hasSale ? (base - calc) : 0,
                    rawPackage: p
                };
            });

            $w("#packagesInfoRep").data = pkgOpts;
        }

        if (tempPackageJob.type === "Interior") packageEditActiveTab = "Interior";
        else packageEditActiveTab = "Exterior";

        updateAddOnTabsUI();
        renderPackageAddOns();
        paintPackageEditRepeater();

        smartGoTo("packageEditsLightboxState");

    } catch(err) { 
        logger.error("Failed to load package details.", err);
        showErrorMessage("Failed to load package details."); 
    }
}

function updateAddOnTabsUI() {
    if (packageEditActiveTab === "Interior") {
        if ($w("#buttonAi2").id) $w("#buttonAi2").disable();
        if ($w("#buttonAe2").id) $w("#buttonAe2").enable();
    } else {
        if ($w("#buttonAe2").id) $w("#buttonAe2").disable();
        if ($w("#buttonAi2").id) $w("#buttonAi2").enable();
    }
}

function renderPackageAddOns() {
    if (!tempPackageJob || !$w("#repAdd2") || !$w("#repAdd2").id) return;

    let availableAddOns = masterAddOnData.filter(item => {
        if (!item.detailType || !String(item.detailType).includes(packageEditActiveTab)) return false;
        
        let targetTag = tempPackageJob.level || "Classic"; 
        
        if ((tempPackageJob.type === "Interior" && packageEditActiveTab === "Exterior") || 
            (tempPackageJob.type === "Exterior" && packageEditActiveTab === "Interior")) {
            targetTag = "All"; 
        }
        
        let itemLevel = item.packageLevel ? String(item.packageLevel).toLowerCase() : "";
        return itemLevel.includes(targetTag.toLowerCase());
        
    }).sort((a, b) => (a.sort || "").toString().localeCompare((b.sort || "").toString()));

    if (availableAddOns.length === 0) {
        $w("#repAdd2").hide();
        $w("#repAdd2").collapse();
        
        if ($w("#addOnText2").id) {
            $w("#addOnText2").text = `There are no ${packageEditActiveTab} Add-Ons available for this Package.`;
            $w("#addOnText2").show("fade", { duration: 200 });
        }
    } else {
        $w("#repAdd2").data = availableAddOns;
        $w("#repAdd2").expand();
        $w("#repAdd2").show("fade", { duration: 200 });
        
        if ($w("#addOnText2").id) $w("#addOnText2").hide("fade", { duration: 200 });
    }
}

function paintPackageEditRepeater() {
    if (!tempPackageJob || !$w("#repPackageEdit") || !$w("#repPackageEdit").id) return;
    $w("#repPackageEdit").data = [tempPackageJob]; 
}

function initPackageAddOnsEngine() {
    const formatTextToBullets = (rawText) => {
        if (!rawText) return "";
        let pureText = rawText.replace(/<[^>]*>?/gm, ''); 
        let lines = pureText.split('\n');
        let cleanLines = lines.filter(line => line.trim() !== "");
        let listItems = cleanLines.map(line => `<li style="margin-bottom: 12px;">${line.trim()}</li>`).join("");
        return `<ul>${listItems}</ul>`;
    }

    registerRepeater($w, "#whatsIncludedStepsRep", ($item, itemData) => {
        if ($item("#overviewTitle").type) {
            if (itemData.title) {
                $item("#overviewTitle").text = itemData.title;
                $item("#overviewTitle").expand();
            } else {
                $item("#overviewTitle").text = "";
                $item("#overviewTitle").collapse();
            }
        }
        
        if ($item("#overviewDescription").type) {
            if (itemData.description) {
                $item("#overviewDescription").html = formatTextToBullets(itemData.description);
                $item("#overviewDescription").expand();
            } else {
                $item("#overviewDescription").html = ""; 
                $item("#overviewDescription").collapse();
            }
        }
    });

    if ($w("#buttonAi2").id) $w("#buttonAi2").onClick(() => { packageEditActiveTab = "Interior"; updateAddOnTabsUI(); renderPackageAddOns(); });
    if ($w("#buttonAe2").id) $w("#buttonAe2").onClick(() => { packageEditActiveTab = "Exterior"; updateAddOnTabsUI(); renderPackageAddOns(); });

    registerRepeater($w, "#repAdd2", ($item, itemData) => {
        if ($item("#buttonAddOn2").type) $item("#buttonAddOn2").label = itemData.buttonTitle || "Add-On";
        if ($item("#textAddOnPrice2").type) $item("#textAddOnPrice2").text = `$${Number(itemData.price || 0).toFixed(2)}`;
        
        let tagString = `${itemData.buttonTitle || itemData.title || "Add-On"} ($${Number(itemData.price || 0).toFixed(2)})`;
        let currentlyActive = false;
        
        if (packageEditActiveTab === "Interior" && tempPackageJob.interiorAddOns) currentlyActive = tempPackageJob.interiorAddOns.includes(tagString);
        else if (packageEditActiveTab === "Exterior" && tempPackageJob.exteriorAddOns) currentlyActive = tempPackageJob.exteriorAddOns.includes(tagString);

        if (currentlyActive) { try { if ($item("#addOnCheck2").type) $item("#addOnCheck2").show(); } catch(e){} } 
        else { try { if ($item("#addOnCheck2").type) $item("#addOnCheck2").hide(); } catch(e){} }

        let isProcessingClick = false;

        const toggleAddOn = () => {
            if (isProcessingClick) return;
            isProcessingClick = true; 

            let addOnPrice = Number(itemData.price || 0);
            let isCurrentlySelected = false;
            if (packageEditActiveTab === "Interior" && tempPackageJob.interiorAddOns) isCurrentlySelected = tempPackageJob.interiorAddOns.includes(tagString);
            else if (packageEditActiveTab === "Exterior" && tempPackageJob.exteriorAddOns) isCurrentlySelected = tempPackageJob.exteriorAddOns.includes(tagString);

            if (isCurrentlySelected) {
                try { if ($item("#addOnCheck2").type) $item("#addOnCheck2").hide(); } catch(e){}
                if (packageEditActiveTab === "Interior") tempPackageJob.interiorAddOns = tempPackageJob.interiorAddOns.filter(t => t !== tagString);
                if (packageEditActiveTab === "Exterior") tempPackageJob.exteriorAddOns = tempPackageJob.exteriorAddOns.filter(t => t !== tagString);
                tempPackageJob.totalAddOnsPrice = Math.max(0, (tempPackageJob.totalAddOnsPrice || 0) - addOnPrice);
            } else {
                try { if ($item("#addOnCheck2").type) $item("#addOnCheck2").show(); } catch(e){}
                if (packageEditActiveTab === "Interior") { tempPackageJob.interiorAddOns = tempPackageJob.interiorAddOns || []; tempPackageJob.interiorAddOns.push(tagString); }
                if (packageEditActiveTab === "Exterior") { tempPackageJob.exteriorAddOns = tempPackageJob.exteriorAddOns || []; tempPackageJob.exteriorAddOns.push(tagString); }
                tempPackageJob.totalAddOnsPrice = (tempPackageJob.totalAddOnsPrice || 0) + addOnPrice;
            }

            tempPackageJob.totalPrice = Number(tempPackageJob.basePrice || 0) + Number(tempPackageJob.totalAddOnsPrice || 0) + Number(tempPackageJob.mobileFee || 0) - Number(tempPackageJob.discountsTotal || 0);
            paintPackageEditRepeater();

            setTimeout(() => { isProcessingClick = false; }, 250);
        };

        if ($item("#checkboxAddOn2").type) $item("#checkboxAddOn2").onClick(toggleAddOn);
        if ($item("#addOnCheck2").type) $item("#addOnCheck2").onClick(toggleAddOn); 
        if ($item("#textAddOnPrice2").type) $item("#textAddOnPrice2").onClick(toggleAddOn); 

        if ($item("#buttonAddOn2").type) {
            $item("#buttonAddOn2").onClick(() => {
                openDetailedWiPopup(itemData, () => openOverlay($w, "lightbox", "whatsIncludedInfoLightboxState"), "packageEditsLightboxState");
            });
        }
    });

    registerRepeater($w, "#repPackageEdit", ($item, itemData) => {
        if ($item("#cartItemTitle3").type) $item("#cartItemTitle3").text = itemData.packageTitle || "Detailing Package";
        if ($item("#cartTime3").type) $item("#cartTime3").text = `Duration: ${itemData.setDuration || "--"} hrs`;
        if ($item("#cartItemPrice3").type) $item("#cartItemPrice3").text = `$${Number(itemData.totalPrice || 0).toFixed(2)}`;
        
        let intCount = Array.isArray(itemData.interiorAddOns) ? itemData.interiorAddOns.length : 0;
        let extCount = Array.isArray(itemData.exteriorAddOns) ? itemData.exteriorAddOns.length : 0;
        if ($item("#cartAddOns3").type) $item("#cartAddOns3").text = `Add-Ons (${intCount + extCount})`;
        
        let isSub = itemData.isSubscription ? "Subscription" : "Non-subscription";
        if ($item("#cartIsSubscription3").type) $item("#cartIsSubscription3").text = isSub;
        if ($item("#cartImage3").type && itemData.packageImage) $item("#cartImage3").src = itemData.packageImage;
        
        let vYear = itemData.vehicleYear || "";
        let vMake = itemData.vehicleMake || "";
        let vModel = itemData.vehicleModel || "";
        let vColor = itemData.vehicleColor || "";
        
        let fullVehStr = `${vYear} ${vMake} ${vModel} ${vColor ? '- ' + vColor : ''}`.replace(/\s+/g, ' ').trim();
        
        if ($item("#cartVehicle3").type) $item("#cartVehicle3").text = fullVehStr || "Unknown Vehicle";
        if ($item("#cartItemContactInfo3").type) $item("#cartItemContactInfo3").text = `${itemData.firstName || ''} ${itemData.lastName || ''}`.trim() || "No Contact";
        if ($item("#cartItemLocationInfo3").type) $item("#cartItemLocationInfo3").text = `${itemData.address1 || ''}, ${itemData.city || ''}`.trim() || "No Location";
    });

    registerRepeater($w, "#packagesInfoRep", ($item, itemData) => {
        if ($item("#packagesInfoText").type) $item("#packagesInfoText").text = itemData.title;
        
        if (itemData.salePriceText) {
            if ($item("#packagesInfoPrice").type) $item("#packagesInfoPrice").html = `<span style="text-decoration: line-through; color: #888888; font-family: Arial, Helvetica, sans-serif; font-size: 14px;">${itemData.priceText}</span>`;
            if ($item("#packagesInfoSalePrice").type) { $item("#packagesInfoSalePrice").text = itemData.salePriceText; $item("#packagesInfoSalePrice").show(); }
        } else {
            if ($item("#packagesInfoPrice").type) $item("#packagesInfoPrice").html = `<span style="color: #FFFFFF; font-family: Arial, Helvetica, sans-serif; font-size: 14px;">${itemData.priceText}</span>`;
            if ($item("#packagesInfoSalePrice").type) $item("#packagesInfoSalePrice").hide();
        }

        const executeSelection = async () => {
            logger.info(`Swapped core package to: ${itemData.title}`);
            let p = itemData.rawPackage;
            
            tempPackageJob.packageTitle = itemData.title;
            tempPackageJob.level = p.packageLevel;
            tempPackageJob.type = p.detailType;
            tempPackageJob.subCategory = p.subCategory || tempPackageJob.subCategory;
            tempPackageJob.basePrice = Number(p.price || 0);
            tempPackageJob.salePackagePrice = Number(p.salePrice || 0);
            tempPackageJob.mobileFee = Number(p.mobileFee || 0); 
            tempPackageJob.discountsTotal = itemData.discountAmt;
            tempPackageJob.discountsApplied = itemData.discountAmt > 0 ? [p.saleTitle || "Package Discount"] : [];
            tempPackageJob.packageImage = p.mainDisplayImage || p.image || "";
            tempPackageJob.setDuration = p.duration || 2; 
            
            tempPackageJob.totalPrice = Number(tempPackageJob.basePrice || 0) + Number(tempPackageJob.totalAddOnsPrice || 0) + Number(tempPackageJob.mobileFee || 0) - Number(tempPackageJob.discountsTotal || 0);

            if ($w("#packageEditCustomText").id) $w("#packageEditCustomText").text = itemData.title;
            
            if (p.detailType === "Interior") packageEditActiveTab = "Interior";
            else packageEditActiveTab = "Exterior"; 
            
            updateAddOnTabsUI();
            renderPackageAddOns();

            if ($w("#msbPrompts").id) {
    await $w("#msbPrompts").hide("fade", { duration: 150 });
    $w("#msbPrompts").collapse();
}
            if ($w("#lightbox2ClickBackground").id) await $w("#lightbox2ClickBackground").hide("fade", { duration: 150 });
            paintPackageEditRepeater();
        };

        const clickableElements = ["#packagesInfoText", "#packagesInfoImage", "#packagesInfoPrice", "#packagesInfoSalePrice", "#packagesInfoContainer"];
        clickableElements.forEach(id => { if ($item(id).type) $item(id).onClick(executeSelection); });
    });
}

function initPackageEditButtons() {
    if ($w("#packageEditCustom").id) {
        $w("#packageEditCustom").onClick(() => {
            openOverlay($w, "prompt", "packagesInfoPromptsState");
        });
    }

    if ($w("#packageEditClose").id) {
        $w("#packageEditClose").onClick(() => {
            logger.info("Edit mode closed/cancelled by user.");
            tempPackageJob = null;
        });
    }

    if ($w("#packageEditButton").id) {
        $w("#packageEditButton").onClick(async () => {
            if (!tempPackageJob) return;

            logger.info("Executing save sequence for updated job...");
            $w("#packageEditButton").disable();
            $w("#packageEditButton").label = "Saving & Syncing...";

            try {
                let times = buildCalendarDates(tempPackageJob.serviceDate, tempPackageJob.scheduledTime);
                let startTime = new Date(times.start);
                let durationHours = tempPackageJob.setDuration || 2; 
                let endDate = new Date(startTime);
                endDate.setHours(startTime.getHours() + durationHours);

                let intAddOns = tempPackageJob.interiorAddOns || [];
                let extAddOns = tempPackageJob.exteriorAddOns || [];
                let allAddOns = [...intAddOns, ...extAddOns];
                let addOnsText = allAddOns.length > 0 ? allAddOns.join("\n") : "None";

                let vYear = tempPackageJob.vehicleYear || "";
                let vMake = tempPackageJob.vehicleMake || "";
                let vModel = tempPackageJob.vehicleModel || "";
                let vColor = tempPackageJob.vehicleColor || "";
                let finalVehicleInfo = `${vYear} ${vMake} ${vModel} ${vColor ? '- ' + vColor : ''}`.replace(/\s+/g, ' ').trim() || "Unknown Vehicle";

                let appointmentDetails = {
                    title: `${tempPackageJob.firstName} ${tempPackageJob.lastName} - ${tempPackageJob.packageTitle}`,
                    description: `Vehicle: ${finalVehicleInfo}\nPhone: ${tempPackageJob.phone}\nAddress: ${tempPackageJob.address1}, ${tempPackageJob.city}\n\nAdd-Ons:\n${addOnsText}\n\nNotes: ${tempPackageJob.specialInstructions || "None"}`,
                    startTime: startTime.toISOString(),
                    endTime: endDate.toISOString(),
                    detailerName: tempPackageJob.detailerName 
                };

                let savedEventIds = { eventId: tempPackageJob.googleEventId, adminEventId: tempPackageJob.googleAdminEventId };

                let detailerRes = await wixData.query("contractors").eq("_id", tempPackageJob.detailerId).find();
                let detailerCalId = null;
                if (detailerRes.items.length > 0) detailerCalId = detailerRes.items[0].googleCalendarId || detailerRes.items[0].email;

                if (detailerCalId) {
                    logger.info("Syncing calendar updates back to Google...");
                    let syncRes = await updateOrRestoreDetailingJob(detailerCalId, savedEventIds, appointmentDetails);
                    if (syncRes && syncRes.success) {
                        tempPackageJob.googleEventId = syncRes.eventId;
                        tempPackageJob.googleAdminEventId = syncRes.adminEventId;
                    }
                }

                logger.info("Updating database...");
                await wixData.update("scheduledJobs", tempPackageJob);
                
                if (hooks.injectUpdatedJob) hooks.injectUpdatedJob(tempPackageJob);
                
                try { await broadcastCalendarUpdate(); } catch(e) {}

                tempPackageJob = null;
                closeAllOverlays($w);

            } catch (err) {
                logger.error("Failed during package save sequence.", err);
                $w("#packageEditButton").label = "Error. Try Again.";
                showErrorMessage("Failed to save changes. Please try again."); 
            } finally {
                setTimeout(() => { if ($w("#packageEditButton").id) { $w("#packageEditButton").enable(); $w("#packageEditButton").label = "Confirm Changes"; } }, 2000);
            }
        });
    }
}