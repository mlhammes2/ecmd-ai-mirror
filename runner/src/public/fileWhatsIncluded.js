// --- public/fileWhatsIncluded.js ---

import { registerRepeater, smartSyncRepeater } from 'public/repeaterEngine';
import { session } from 'wix-storage';
import wixData from 'wix-data';
import { openDetailedWiPopup } from 'public/fileWhatsIncludedG';
import { APP_LOGS } from 'public/loggerConfig';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

let $w;
let hooks;
let bridge;

let wiActiveTab = "Exterior";
let activeWiPackage = null;
let activeWiPrice = 0;

const DEBUG_MODE = APP_LOGS.MASTER_SWITCH && APP_LOGS.WHATS_INCLUDED;
const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [FILE_WHATS_INCLUDED]: ${msg}`, data) : console.log(`📌 [FILE_WHATS_INCLUDED]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [FILE_WHATS_INCLUDED]: ${msg}`, data) : console.warn(`📌 [FILE_WHATS_INCLUDED]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [FILE_WHATS_INCLUDED]: ${msg}`, data) : console.error(`📌 [FILE_WHATS_INCLUDED]: ${msg}`); }
};

registerModuleState("fileWhatsIncluded", () => ({
    wiActiveTab,
    activeWiPrice,
    activeWiPackage: activeWiPackage ? {
        _id: activeWiPackage._id,
        title: activeWiPackage.title,
        packageLevel: activeWiPackage.packageLevel,
        detailType: activeWiPackage.detailType,
        subCategory: activeWiPackage.subCategory,
        price: activeWiPackage.price,
        salePrice: activeWiPackage.salePrice
    } : null
}));

registerDomElements({
    boxes: ["#interiorFlexItem", "#exteriorFlexItem"],
    repeaters: ["#whatsIncludedRep", "#repSubscriptions", "#repFullInterior", "#repFullExterior", "#repAdd"]
});

export function initWhatsIncludedEngine(wixContext, providedHooks, bridgeAPI) {
    logger.info("initWhatsIncludedEngine -> Initializing Inline What's Included Engine...");
    $w = wixContext;
    hooks = providedHooks;
    bridge = bridgeAPI;

    if ($w("#buttonAi").id) $w("#buttonAi").onClick(() => { wiActiveTab = "Interior"; updateWiTabsUI(); renderPopupAddOns(); });
    if ($w("#buttonAe").id) $w("#buttonAe").onClick(() => { wiActiveTab = "Exterior"; updateWiTabsUI(); renderPopupAddOns(); });

    if ($w("#whatsIncludedAddCart").id) {
        $w("#whatsIncludedAddCart").onClick(() => {
            logger.info("whatsIncludedAddCart.onClick -> ADD TO CART CLICKED (FROM POPUP)");
            if (!activeWiPackage) return;

            session.setItem("returnBreadcrumb", "whatsIncludedLightboxState");

            bridge.setMasterState(
                activeWiPackage.packageLevel, activeWiPackage.detailType,
                Number(activeWiPackage.price || 0), Number(activeWiPackage.salePrice || 0),
                activeWiPackage.saleTitle || "", activeWiPackage.mobileFee || 0
            );
           
            bridge.updateSummary();
        });
    }

    if ($w("#whatsIncludedRep").id) {
        wixData.query("siteButtons").eq("category", "whatsIncludedButtons").ascending("sort").find()
            .then(res => { smartSyncRepeater($w, "#whatsIncludedRep", res.items); })
            .catch(err => logger.error("Failed to load whatsIncludedButtons", err));

        registerRepeater($w, "#whatsIncludedRep", ($item, itemData) => {
            if ($item("#whatsIncludedRepButton").type) {
                $item("#whatsIncludedRepButton").label = itemData.title || "Package";
                $item("#whatsIncludedRepButton").onClick(() => {
                    if (!activeWiPackage) return;
                    let targetLevel = String(itemData.title).trim();
                    let activeSubCat = activeWiPackage.subCategory || "Sedan";
                    let activeType = activeWiPackage.detailType || "Full";
                   
                    let matchedPkg = bridge.getCmsData().find(p =>
                        String(p.packageLevel || "").trim().toLowerCase() === targetLevel.toLowerCase() &&
                        String(p.detailType || "").trim().toLowerCase() === activeType.toLowerCase() &&
                        String(p.subCategory || "").trim().toLowerCase() === activeSubCat.toLowerCase()
                    );
                   
                    if (matchedPkg) openWhatsIncludedPopup(matchedPkg, Number(matchedPkg.price || 0));
                });
            }
        });
    }

    registerRepeater($w, "#repSubscriptions", ($item, itemData) => {
        if ($item("#textSubFrequency").type) $item("#textSubFrequency").text = `${itemData.title}:`;
        if ($item("#textSubPrice").type) $item("#textSubPrice").text = `$${itemData.price.toFixed(2)}`;
    });

    const triggerDetailedG = (itemData) => {
        openDetailedWiPopup(itemData, () => hooks.smartGoTo("whatsIncludedInfoLightboxState"), "whatsIncludedLightboxState");
    };

    registerRepeater($w, "#repFullInterior", ($item, itemData) => {
        if ($item("#buttonFullInterior").type) {
            $item("#buttonFullInterior").label = itemData.buttonTitle || itemData.title;
            $item("#buttonFullInterior").onClick(() => triggerDetailedG(itemData));
        }
    });

    registerRepeater($w, "#repFullExterior", ($item, itemData) => {
        if ($item("#buttonFullExterior").type) {
            $item("#buttonFullExterior").label = itemData.buttonTitle || itemData.title;
            $item("#buttonFullExterior").onClick(() => triggerDetailedG(itemData));
        }
    });

    const addonLocks = {};

    registerRepeater($w, "#repAdd", ($item, itemData) => {
        if ($item("#buttonAddOn").type) {
            $item("#buttonAddOn").label = itemData.buttonTitle || itemData.title || "Add-On";
            $item("#buttonAddOn").onClick(() => triggerDetailedG(itemData));
        }
       
        if ($item("#textAddOnPrice").type) $item("#textAddOnPrice").text = `$${Number(itemData.price || 0).toFixed(2)}`;

        let currentSelected = bridge.getSelectedAddOns();
        let isSelected = currentSelected.some(a => a._id === itemData._id);
       
        if ($item("#addOnCheck").type) {
            if (isSelected) $item("#addOnCheck").show("none");
            else $item("#addOnCheck").hide("none");
        }

        const handleCheckboxToggle = () => {
            let itemId = itemData._id;
            if (addonLocks[itemId]) return;
            addonLocks[itemId] = true;

            let liveSelected = bridge.getSelectedAddOns();
            let currentlySelected = liveSelected.some(a => a._id === itemData._id);
           
            if (currentlySelected) {
                liveSelected = liveSelected.filter(a => a._id !== itemData._id);
                if ($item("#addOnCheck").type) $item("#addOnCheck").hide("none");
            } else {
                liveSelected.push(itemData);
                if ($item("#addOnCheck").type) $item("#addOnCheck").show("none");
            }

            bridge.setSelectedAddOns(liveSelected);

            if (activeWiPackage) {
                let memKey = bridge.getMemoryKey(activeWiPackage.packageLevel, activeWiPackage.detailType);
                let currentMap = bridge.getAddOnsMap();
                currentMap[memKey] = [...liveSelected];
                bridge.setAddOnsMap(currentMap);
                bridge.saveMemory();
            }

            bridge.repaintRepeater();
            updateWhatsIncludedTotalPrice();

            setTimeout(() => { addonLocks[itemId] = false; }, 300);
        };

        if ($item("#checkboxAddOn").type) $item("#checkboxAddOn").onClick(handleCheckboxToggle);
        if ($item("#addOnCheck").type) $item("#addOnCheck").onClick(handleCheckboxToggle);
    });
}

function updateWiTabsUI() {
    try {
        if (wiActiveTab === "Interior") {
            if ($w("#buttonAi").id && typeof $w("#buttonAi").disable === "function") $w("#buttonAi").disable();
            if ($w("#buttonAe").id && typeof $w("#buttonAe").enable === "function") $w("#buttonAe").enable();
        } else {
            if ($w("#buttonAe").id && typeof $w("#buttonAe").disable === "function") $w("#buttonAe").disable();
            if ($w("#buttonAi").id && typeof $w("#buttonAi").enable === "function") $w("#buttonAi").enable();
        }
    } catch(e) {}
}

function updateWhatsIncludedTotalPrice() {
    if (!activeWiPackage || !$w("#whatsIncludedTotalPrice").id) return;
    let currentSelected = bridge.getSelectedAddOns();
    let addOnsTotal = currentSelected.reduce((sum, addon) => sum + Number(addon.price || 0), 0);
    let basePrice = Number(activeWiPackage.price || 0);
    let salePrice = Number(activeWiPackage.salePrice || 0);
    let finalBase = (salePrice > 0 && salePrice < basePrice) ? salePrice : basePrice;
   
    $w("#whatsIncludedTotalPrice").text = `$${(finalBase + addOnsTotal).toFixed(2)}`;
}

function updateWhatsIncludedButtonsUI() {
    if (!$w("#whatsIncludedRep").id || !activeWiPackage) return;
    let currentLevel = String(activeWiPackage.packageLevel || "").toLowerCase();
   
    $w("#whatsIncludedRep").forEachItem(($item, itemData) => {
        if ($item("#whatsIncludedRepButton").type) {
            let btnLevel = String(itemData.title || "").toLowerCase();
            try {
                if (btnLevel === currentLevel) {
                    if (typeof $item("#whatsIncludedRepButton").disable === "function") $item("#whatsIncludedRepButton").disable();
                } else {
                    if (typeof $item("#whatsIncludedRepButton").enable === "function") $item("#whatsIncludedRepButton").enable();
                }
            } catch(e) {}
        }
    });
}

function renderPopupAddOns() {
    if (!activeWiPackage || !$w("#repAdd") || !$w("#repAdd").id) return;

    let targetTag = activeWiPackage.packageLevel || "Classic";
    if ((activeWiPackage.detailType === "Interior" && wiActiveTab === "Exterior") ||
        (activeWiPackage.detailType === "Exterior" && wiActiveTab === "Interior")) {
        targetTag = "All";
    }

    let allData = bridge.getAllData();
    let availableAddOns = allData.filter(item => {
        let safeDetailType = String(item.detailType || "").toLowerCase();
        let safePackageLevel = String(item.packageLevel || "").toLowerCase();
        return safeDetailType.includes(wiActiveTab.toLowerCase()) && safePackageLevel.includes(String(targetTag).toLowerCase());
    }).sort((a, b) => String(a.sort || "").localeCompare(String(b.sort || "")));

    if (availableAddOns.length === 0) {
        try { $w("#repAdd").hide(); $w("#repAdd").collapse(); } catch(e){}
        if ($w("#textAddOnLuxury").id) {
            $w("#textAddOnLuxury").text = `There are currently no Add-Ons for the '${activeWiPackage.packageLevel || "Selected"}' Package.`;
            $w("#textAddOnLuxury").expand();
            $w("#textAddOnLuxury").show("fade", { duration: 200 });
        }
    } else {
        if ($w("#textAddOnLuxury").id) { $w("#textAddOnLuxury").hide(); $w("#textAddOnLuxury").collapse(); }
        try { $w("#repAdd").expand(); $w("#repAdd").show("fade", { duration: 200 }); } catch(e){}
        smartSyncRepeater($w, "#repAdd", availableAddOns);
    }
}

export function openWhatsIncludedPopup(pkgData, calculatedPrice) {
    logger.info(`openWhatsIncludedPopup -> Opening for ${pkgData?.title} ($${calculatedPrice})`);
    activeWiPackage = pkgData;
    activeWiPrice = calculatedPrice;

    let safeLevel = String(pkgData.packageLevel || "").toLowerCase();
    let safeType = pkgData.detailType || "";

    let memKey = bridge.getMemoryKey(pkgData.packageLevel, pkgData.detailType);
    bridge.setSelectedAddOns(bridge.getAddOnsMap()[memKey] || []);
   
    if ($w("#interiorText").id) $w("#interiorText").text = pkgData.interiorDescription || "Interior detailing includes full wipe down and vacuuming.";
    if ($w("#exteriorText").id) $w("#exteriorText").text = pkgData.exteriorDescription || "Exterior detailing includes hand wash, wax, and tire shine.";

    let biWeeklyPrice = activeWiPrice - (activeWiPrice * (Number(pkgData.biWeeklyPercent || 20) / 100));
    let monthlyPrice = activeWiPrice - (activeWiPrice * (Number(pkgData.monthlyPercent || 15) / 100));
    let quarterlyPrice = activeWiPrice - (activeWiPrice * (Number(pkgData.quarterlyPercent || 10) / 100));

    let subData = [
        { _id: "sub_bi", title: "Bi-Weekly", price: biWeeklyPrice },
        { _id: "sub_mo", title: "Monthly", price: monthlyPrice },
        { _id: "sub_qu", title: "Quarterly", price: quarterlyPrice }
    ];
    smartSyncRepeater($w, "#repSubscriptions", subData);
   
    let allData = bridge.getAllData();
    let inclusions = allData.filter(item => String(item.whatsIncluded || "").toLowerCase().includes(safeLevel));

    let interiorItems = inclusions.filter(i => String(i.detailType || "").includes("Interior")).sort((a, b) => String(a.sort || "").localeCompare(String(b.sort || "")));
    let exteriorItems = inclusions.filter(i => String(i.detailType || "").includes("Exterior")).sort((a, b) => String(a.sort || "").localeCompare(String(b.sort || "")));

    if (safeType === "Interior") {
        if ($w("#interiorFlexItem").id) $w("#interiorFlexItem").expand();
        if ($w("#exteriorFlexItem").id) $w("#exteriorFlexItem").collapse();
    } else if (safeType === "Exterior") {
        if ($w("#interiorFlexItem").id) $w("#interiorFlexItem").collapse();
        if ($w("#exteriorFlexItem").id) $w("#exteriorFlexItem").expand();
    } else {
        if ($w("#interiorFlexItem").id) $w("#interiorFlexItem").expand();
        if ($w("#exteriorFlexItem").id) $w("#exteriorFlexItem").expand();
    }

    smartSyncRepeater($w, "#repFullInterior", interiorItems);
    smartSyncRepeater($w, "#repFullExterior", exteriorItems);

    let activeInclusions = safeType === "Interior" ? [...interiorItems] : safeType === "Exterior" ? [...exteriorItems] : [...interiorItems, ...exteriorItems];
    let combinedNotices = activeInclusions.filter(item => item.notice && String(item.notice).trim() !== "").map(item => String(item.notice).trim()).join("\n\n");

    if (combinedNotices) {
        if ($w("#noticeWhatsIncluded").id) { $w("#noticeWhatsIncluded").text = combinedNotices; $w("#noticeWhatsIncluded").expand(); }
        if ($w("#noticeWhatsIncluded02").id) $w("#noticeWhatsIncluded02").expand();
    } else {
        if ($w("#noticeWhatsIncluded").id) { $w("#noticeWhatsIncluded").text = ""; $w("#noticeWhatsIncluded").collapse(); }
        if ($w("#noticeWhatsIncluded02").id) $w("#noticeWhatsIncluded02").collapse();
    }

    let extTargetTag = (safeType === "Interior") ? "All" : (pkgData.packageLevel || "Classic");
    let hasExteriorAddOns = allData.some(item => String(item.detailType || "").toLowerCase().includes("exterior") && String(item.packageLevel || "").toLowerCase().includes(String(extTargetTag).toLowerCase()));

    wiActiveTab = hasExteriorAddOns ? "Exterior" : "Interior";
   
    updateWiTabsUI();
    renderPopupAddOns();
    updateWhatsIncludedTotalPrice();    
    updateWhatsIncludedButtonsUI();

    if (hooks.smartGoTo) hooks.smartGoTo("whatsIncludedLightboxState");
}