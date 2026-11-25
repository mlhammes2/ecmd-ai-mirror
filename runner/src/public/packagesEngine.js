// --- public/packagesEngine.js ---

import wixAnimationsFrontend from 'wix-animations-frontend';
import { registerRepeater, smartSyncRepeater } from 'public/repeaterEngine';
import { local, session } from 'wix-storage';
import { initWhatsIncludedGEngine } from 'public/fileWhatsIncludedG';
import { initWhatsIncludedEngine, openWhatsIncludedPopup } from 'public/fileWhatsIncluded';
import { normalizeToPackageSubCategory } from 'public/packageMatcher';
import { openOverlay } from 'public/routerEngine';
import { APP_LOGS } from 'public/loggerConfig';
import { setSelectedSummaryVehicle } from 'public/fileSummary';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

let $w;
let hooks;

const DEBUG_MODE = APP_LOGS.MASTER_SWITCH && APP_LOGS.PACKAGES;
const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [PACKAGES_ENGINE]: ${msg}`, data) : console.log(`📌 [PACKAGES_ENGINE]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [PACKAGES_ENGINE]: ${msg}`, data) : console.warn(`📌 [PACKAGES_ENGINE]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [PACKAGES_ENGINE]: ${msg}`, data) : console.error(`📌 [PACKAGES_ENGINE]: ${msg}`); }
};

let g_allData = [];
let cmsPackageData = [];
let userVehiclesList = [];

let selectedLevel = 'Classic';
let selectedType = 'Full';
let selectedServiceCategory = 'Auto';
let selectedVehicleSize = 'Car';
let selectedAddOns = [];
let activeSelectedVehicleObj = null;

let currentBasePrice = 0;
let currentSalePrice = 0;
let currentSaleTitle = "";
let currentMobileFee = 0;
let isSubscriptionActive = false;
let activeSubscriptionFrequency = "NONE";
let activeSubscriptionPrice = 0;

let packageAddOnsMap = {};
let repPackageState = {};

registerModuleState("packagesEngine", () => ({
    cmsPackageDataCount: (cmsPackageData || []).length,
    whatsIncludedDataCount: (g_allData || []).length,
    userVehiclesCount: (userVehiclesList || []).length,
    selectedLevel,
    selectedType,
    selectedServiceCategory,
    selectedVehicleSize,
    activeSelectedVehicle: activeSelectedVehicleObj ? {
        _id: activeSelectedVehicleObj._id,
        year: activeSelectedVehicleObj.year,
        make: activeSelectedVehicleObj.make,
        model: activeSelectedVehicleObj.model,
        vehicleType: activeSelectedVehicleObj.vehicleType
    } : null,
    currentBasePrice,
    currentSalePrice,
    currentSaleTitle,
    currentMobileFee,
    selectedAddOnsCount: (selectedAddOns || []).length,
    repPackageState
}));

registerDomElements({
    boxes: ["#vehicleSelectBox", "#vehicleButtonCar", "#vehicleButtonTruck", "#vehicleButtonSmSuv", "#vehicleButtonLgSuv"],
    repeaters: ["#packageRep", "#vehicleSelectRep"]
});

let vehicleErrorTimeout = null;
let dropButtonPulseTimeline = null;

const DROPDOWN_INTRO_LABEL = "Select Your Vehicle...";
const LOCKED_TYPE_ERROR_TEXT = "Clear your selected vehicle to browse other vehicle types.";
const ERROR_DURATION_MS = 3200;

const VEHICLE_TYPES = [
    { id: "Car", subCategory: "Sedan", box: "#vehicleButtonCar", trigger: "#vehicleButtonImageCar", overlay: "#sedanButton" },
    { id: "Truck", subCategory: "Truck", box: "#vehicleButtonTruck", trigger: "#vehicleButtonImageTruck", overlay: "#truckButton" },
    { id: "SmSuv", subCategory: "Sm. SUV", box: "#vehicleButtonSmSuv", trigger: "#vehicleButtonImageSmSuv", overlay: "#smSUVButton" },
    { id: "LgSuv", subCategory: "Lg. SUV", box: "#vehicleButtonLgSuv", trigger: "#vehicleButtonImageLgSuv", overlay: "#lgSUVButton" }
];

function mapSubCategoryToVehicleSizeId(rawVehicleType = "") {
    let norm = normalizeToPackageSubCategory(rawVehicleType) || "Sedan";
    let matched = VEHICLE_TYPES.find(v => v.subCategory.toLowerCase() === norm.toLowerCase());
    return matched ? matched.id : "Car";
}

function formatVehicleDropdownLabel(veh) {
    if (!veh) return DROPDOWN_INTRO_LABEL;
    let subCat = normalizeToPackageSubCategory(veh.vehicleType || veh.subCategory || "Sedan") || "Sedan";
    let baseText = `${veh.year || ''} ${veh.make || ''} ${veh.model || ''} ${veh.color || ''}`.replace(/\s+/g, ' ').trim();
    return `${baseText} (${subCat})`;
}

function loadSavedAddOns() {
    let saved = local.getItem("ecmd_addOnMemory");
    if (saved) {
        try {
            let parsed = JSON.parse(saved);
            if (Date.now() - parsed.timestamp < 86400000) packageAddOnsMap = parsed.map || {};
            else local.removeItem("ecmd_addOnMemory");
        } catch(e) {}
    }
}

function saveAddOnsToMemory() {
    local.setItem("ecmd_addOnMemory", JSON.stringify({ timestamp: Date.now(), map: packageAddOnsMap }));
}

const getMemoryKey = (level, type) => `${level}_${type}`;

export function clearActivePackageMemory() {
    delete packageAddOnsMap[getMemoryKey(selectedLevel, selectedType)];
    saveAddOnsToMemory();
    clearCustomVehicleDropdown();
}

function closeVehicleSelectDropdown(hideBackdrop = true) {
    if (!$w) return;
    if ($w("#vehicleSelectBox").id && !$w("#vehicleSelectBox").hidden) {
        $w("#vehicleSelectBox").hide("fade", { duration: 150 });
    }
    if (hideBackdrop && $w("#lightboxBackground").id && !$w("#lightboxBackground").hidden) {
        const isShown = (id) => $w(id).id && !$w(id).hidden && !$w(id).collapsed;
        if (!isShown("#msbLightbox") && !isShown("#msbPrompts") && !isShown("#msbPopUp") && !isShown("#msbMessages") && !isShown("#siteMenu")) {
            $w("#lightboxBackground").hide("fade", { duration: 150 }).then(() => {
                if ($w("#lightboxBackground").hidden) $w("#lightboxBackground").collapse();
            }).catch(() => {});
        }
    }
}

export function clearCustomVehicleDropdown() {
    activeSelectedVehicleObj = null;
    session.setItem("selectedSummaryVehicleId", "NONE");

    if ($w && $w("#vehicleSelectDropButton").id) {
        $w("#vehicleSelectDropButton").label = DROPDOWN_INTRO_LABEL;
    }
    closeVehicleSelectDropdown(true);
    setSelectedSummaryVehicle("NONE");
    stopLockedVehicleTypeFeedback();
}

function stopLockedVehicleTypeFeedback() {
    if (vehicleErrorTimeout) {
        clearTimeout(vehicleErrorTimeout);
        vehicleErrorTimeout = null;
    }
    if (dropButtonPulseTimeline) {
        try { dropButtonPulseTimeline.pause(); } catch (e) {}
        dropButtonPulseTimeline = null;
    }
    if ($w && $w("#vehicleSelectDropButton").id) {
        try {
            wixAnimationsFrontend.timeline().add($w("#vehicleSelectDropButton"), { scale: 1, duration: 100 }).play();
        } catch (e) {}
    }
    if ($w && $w("#vehicleTypeError").id && !$w("#vehicleTypeError").hidden) {
        $w("#vehicleTypeError").hide("fade", { duration: 150 });
    }
}

function triggerLockedVehicleTypeFeedback() {
    if (!$w) return;

    if ($w("#vehicleTypeError").id) {
        $w("#vehicleTypeError").text = LOCKED_TYPE_ERROR_TEXT;
        if ($w("#vehicleTypeError").collapsed) $w("#vehicleTypeError").expand();
        $w("#vehicleTypeError").show("fade", { duration: 150 });
    }

    if (dropButtonPulseTimeline) {
        try { dropButtonPulseTimeline.pause(); } catch (e) {}
        dropButtonPulseTimeline = null;
    }

    if ($w("#vehicleSelectDropButton").id) {
        try {
            dropButtonPulseTimeline = wixAnimationsFrontend.timeline({ repeat: -1 });
            dropButtonPulseTimeline
                .add($w("#vehicleSelectDropButton"), { scale: 1.06, duration: 260, easing: "easeInOutSine" })
                .add($w("#vehicleSelectDropButton"), { scale: 1.0, duration: 260, easing: "easeInOutSine" });
            dropButtonPulseTimeline.play();
        } catch (e) {}
    }

    if (vehicleErrorTimeout) clearTimeout(vehicleErrorTimeout);
    vehicleErrorTimeout = setTimeout(() => {
        stopLockedVehicleTypeFeedback();
    }, ERROR_DURATION_MS);
}

export function syncPackagesVehicles(vehicles = [], autoSelectNewest = false) {
    userVehiclesList = Array.isArray(vehicles) ? vehicles : [];
    if (!$w || !$w("#vehicleSelectRep").id) return;

    let repItems = [
        {
            _id: "veh_opt_none",
            actionType: "NONE",
            label: "Browse Without a Vehicle"
        },
        ...userVehiclesList.map(v => ({
            _id: "veh_opt_" + v._id,
            actionType: "VEHICLE",
            vehicleObj: v,
            label: formatVehicleDropdownLabel(v)
        })),
        {
            _id: "veh_opt_add",
            actionType: "ADD_NEW",
            label: "+ Add New Vehicle"
        }
    ];

    smartSyncRepeater($w, "#vehicleSelectRep", repItems);

    if (autoSelectNewest && userVehiclesList.length > 0) {
        let newestVeh = userVehiclesList[userVehiclesList.length - 1];
        applySelectedDropdownVehicle(newestVeh);
    } else if (activeSelectedVehicleObj) {
        let updatedMatch = userVehiclesList.find(v => String(v._id) === String(activeSelectedVehicleObj._id));
        if (updatedMatch) {
            applySelectedDropdownVehicle(updatedMatch);
        } else {
            clearCustomVehicleDropdown();
        }
    }
}

function applySelectedDropdownVehicle(vehObj) {
    if (!vehObj) {
        clearCustomVehicleDropdown();
        return;
    }

    activeSelectedVehicleObj = vehObj;
    session.setItem("selectedSummaryVehicleId", String(vehObj._id));
    stopLockedVehicleTypeFeedback();

    if ($w("#vehicleSelectDropButton").id) {
        $w("#vehicleSelectDropButton").label = formatVehicleDropdownLabel(vehObj);
    }
    closeVehicleSelectDropdown(true);

    selectedVehicleSize = mapSubCategoryToVehicleSizeId(vehObj.vehicleType || vehObj.subCategory || "Sedan");
    paintVehicleButtonsSelectionUI();
    repaintRepeaterInPlace();
    setSelectedSummaryVehicle(vehObj._id);
}

function initCustomVehicleDropdown() {
    if (!$w) return;

    if ($w("#vehicleTypeError").id && !$w("#vehicleTypeError").hidden) {
        $w("#vehicleTypeError").hide();
    }
    if ($w("#vehicleSelectBox").id && !$w("#vehicleSelectBox").hidden) {
        $w("#vehicleSelectBox").hide();
    }
    if ($w("#vehicleSelectDropButton").id) {
        $w("#vehicleSelectDropButton").label = activeSelectedVehicleObj
            ? formatVehicleDropdownLabel(activeSelectedVehicleObj)
            : DROPDOWN_INTRO_LABEL;

        $w("#vehicleSelectDropButton").onClick(() => {
            stopLockedVehicleTypeFeedback();
            if (!$w("#vehicleSelectBox").id) return;
            if ($w("#vehicleSelectBox").collapsed) $w("#vehicleSelectBox").expand();

            if ($w("#vehicleSelectBox").hidden) {
                if ($w("#lightboxBackground").id) {
                    $w("#lightboxBackground").expand();
                    $w("#lightboxBackground").show("fade", { duration: 150 }).catch(() => {});
                }
                $w("#vehicleSelectBox").show("fade", { duration: 150 });
            } else {
                closeVehicleSelectDropdown(true);
            }
        });
    }

    // Clicking #lightboxBackground closes #vehicleSelectBox if it is open
    if ($w("#lightboxBackground").id) {
        $w("#lightboxBackground").onClick(() => {
            if ($w("#vehicleSelectBox").id && !$w("#vehicleSelectBox").hidden) {
                closeVehicleSelectDropdown(true);
            }
        });
    }

    if ($w("#vehicleSelectRep").id) {
        registerRepeater($w, "#vehicleSelectRep", ($item, itemData) => {
            if ($item("#vehicleSelectButton").type) {
                $item("#vehicleSelectButton").label = itemData.label;
                $item("#vehicleSelectButton").onClick(() => {
                    if (itemData.actionType === "NONE") {
                        clearCustomVehicleDropdown();
                    } else if (itemData.actionType === "ADD_NEW") {
                        // Hide #vehicleSelectBox without hiding #lightboxBackground since addVehicleLightboxState is opening!
                        closeVehicleSelectDropdown(false);
                        openOverlay($w, "lightbox", "addVehicleLightboxState");
                    } else if (itemData.actionType === "VEHICLE" && itemData.vehicleObj) {
                        applySelectedDropdownVehicle(itemData.vehicleObj);
                    }
                });
            }
        });

        syncPackagesVehicles(userVehiclesList, false);
    }
}

export function unpackPackageState(level, type, addOnsArray = []) {
    selectedLevel = level;
    selectedType = type;
    selectedAddOns = addOnsArray;
   
    let memKey = getMemoryKey(level, type);
    packageAddOnsMap[memKey] = [...addOnsArray];
    saveAddOnsToMemory();
   
    repaintRepeaterInPlace();
}

export function removePackageAddOn(addOnId) {
    selectedAddOns = selectedAddOns.filter(a => a._id !== addOnId);
    let memKey = getMemoryKey(selectedLevel, selectedType);
    packageAddOnsMap[memKey] = [...selectedAddOns];
    saveAddOnsToMemory();
    repaintRepeaterInPlace();
}

const bridgeAPI = {
    getAllData: () => g_allData,
    getCmsData: () => cmsPackageData,
    getSelectedAddOns: () => selectedAddOns,
    setSelectedAddOns: (arr) => { selectedAddOns = arr; },
    getAddOnsMap: () => packageAddOnsMap,
    setAddOnsMap: (map) => { packageAddOnsMap = map; },
    saveMemory: saveAddOnsToMemory,
    getMemoryKey: getMemoryKey,
    repaintRepeater: repaintRepeaterInPlace,
   
    updateSummary: () => {
        if (hooks.updateSummary) hooks.updateSummary();
        if (hooks.smartGoTo) hooks.smartGoTo("summaryLightboxState");
    },
   
    setMasterState: (level, type, base, sale, title, fee) => {
        selectedLevel = level;
        selectedType = type;
        currentBasePrice = base;
        currentSalePrice = sale;
        currentSaleTitle = title;
        currentMobileFee = fee;
    }
};

export function initPackagesEngine(wixContext, providedHooks) {
    logger.info("Initializing Main Packages Engine.");
    $w = wixContext;
    hooks = providedHooks;

    if (!session.getItem("ecmd_session_active")) {
        local.removeItem("ecmd_addOnMemory");
        packageAddOnsMap = {};
        selectedAddOns = [];
        session.setItem("ecmd_session_active", "true");
    }

    try { loadSavedAddOns(); } catch (e) {}
   
    initWhatsIncludedGEngine($w);
    initWhatsIncludedEngine($w, hooks, bridgeAPI);
   
    try { initVehicleSizeSelectors(); } catch (e) {}
    try { initCustomVehicleDropdown(); } catch (e) {}
    try { initPackageRepeater(); } catch (e) {}
}

export function setPackageData(wiData, pkgData) {
    g_allData = wiData;
    cmsPackageData = pkgData;
    updatePackageRepeater();
}

export function resetPackageSubscription() {
    isSubscriptionActive = false; activeSubscriptionFrequency = "NONE"; activeSubscriptionPrice = 0;
}

export function getDraftEnvelope() {
    let activeVehObj = VEHICLE_TYPES.find(v => v.id === selectedVehicleSize) || VEHICLE_TYPES[0];
    let activeSubCat = activeVehObj.subCategory.trim().toLowerCase();

    let activePkg = cmsPackageData.find(p =>
        (p.packageLevel || "").trim().toLowerCase() === selectedLevel.trim().toLowerCase() &&
        (p.detailType || "").trim().toLowerCase() === selectedType.trim().toLowerCase() &&
        (p.subCategory || "").trim().toLowerCase() === activeSubCat &&
        (p.serviceCategory || "Auto").trim().toLowerCase() === selectedServiceCategory.trim().toLowerCase()
    );
   
    return {
        level: selectedLevel,
        type: selectedType,
        title: selectedType === "Full" ? `Full ${selectedLevel} Detail` : `${selectedLevel} ${selectedType} Detail`,
        vehicleSize: activeVehObj.subCategory,
        selectedVehicleId: activeSelectedVehicleObj ? activeSelectedVehicleObj._id : null,
        basePrice: currentBasePrice,
        salePrice: currentSalePrice,
        saleTitle: currentSaleTitle,
        mobileFee: currentMobileFee,
        addOns: [...selectedAddOns],
        isSub: isSubscriptionActive,
        subFrequency: activeSubscriptionFrequency,
        subPrice: activeSubscriptionPrice,
        image: (activePkg && activePkg.image) ? activePkg.image : "",
        duration: activePkg ? String(activePkg.duration || 0) : "0"
    };
}

function paintVehicleButtonsSelectionUI() {
    const DEFAULT_COLOR = "#000000";
    const SELECTED_COLOR = "#54E9EA";
    VEHICLE_TYPES.forEach(v => {
        if ($w(v.box).id) {
            $w(v.box).style.backgroundColor = (selectedVehicleSize === v.id) ? SELECTED_COLOR : DEFAULT_COLOR;
        }
    });
}

function initVehicleSizeSelectors() {
    const DEFAULT_COLOR = "#000000";
    const HOVER_COLOR = "#C2C2C2";

    VEHICLE_TYPES.forEach(vehicle => {
        const handleSelect = () => {
            if (activeSelectedVehicleObj) {
                if (selectedVehicleSize !== vehicle.id) {
                    triggerLockedVehicleTypeFeedback();
                }
                return;
            }

            selectedVehicleSize = vehicle.id;
            paintVehicleButtonsSelectionUI();
            repaintRepeaterInPlace();
        };

        const handleMouseIn = () => {
            if (activeSelectedVehicleObj) return;
            if (selectedVehicleSize !== vehicle.id && $w(vehicle.box).id) {
                $w(vehicle.box).style.backgroundColor = HOVER_COLOR;
            }
        };

        const handleMouseOut = () => {
            if (activeSelectedVehicleObj) return;
            if (selectedVehicleSize !== vehicle.id && $w(vehicle.box).id) {
                $w(vehicle.box).style.backgroundColor = DEFAULT_COLOR;
            }
        };

        [vehicle.box, vehicle.trigger, vehicle.overlay].forEach(selector => {
            if (selector && $w(selector).id) {
                $w(selector).onClick(handleSelect);
                $w(selector).onMouseIn(handleMouseIn);
                $w(selector).onMouseOut(handleMouseOut);
            }
        });
    });

    paintVehicleButtonsSelectionUI();
}

function paintPackageCard($item, matchedPkg, activeType) {
    if (!matchedPkg) return;
    let savedAddOns = packageAddOnsMap[getMemoryKey(matchedPkg.packageLevel, matchedPkg.detailType)] || [];
    let addOnsTotal = savedAddOns.reduce((sum, addon) => sum + Number(addon.price || 0), 0);
   
    if ($item("#packageRepTitle").type) $item("#packageRepTitle").text = `${matchedPkg.packageLevel || ""}${matchedPkg.subTitle ? ` - ${matchedPkg.subTitle}` : ""}`;
    if ($item("#packageRepDescrition").type) $item("#packageRepDescrition").text = matchedPkg.description || matchedPkg.desc || "";
    if ($item("#packageRepVehicle").type) $item("#packageRepVehicle").text = matchedPkg.subCategory || "Unknown Size";
    if ($item("#packageRepDuration").type) $item("#packageRepDuration").text = `${matchedPkg.duration || '--'} Hrs`;
   
    if ($item("#packageRepAddons").type) {
        if (savedAddOns.length > 0) { $item("#packageRepAddons").text = `Add-Ons (${savedAddOns.length})`; $item("#packageRepAddons").expand(); }
        else { $item("#packageRepAddons").collapse(); }
    }

    let basePrice = Number(matchedPkg.price || 0);
    let salePrice = Number(matchedPkg.salePrice || 0);
    let hasSale = salePrice > 0 && salePrice < basePrice;

    if ($item("#packageRepPrice").type) $item("#packageRepPrice").text = `$${(basePrice + addOnsTotal).toFixed(2)}`;

    if (hasSale) {
        if ($item("#packageRepSale").type) $item("#packageRepSale").show();
        if ($item("#packageRepSaleLine").type) $item("#packageRepSaleLine").show();
        if ($item("#packageRepSalePrice").type) { $item("#packageRepSalePrice").text = `$${(salePrice + addOnsTotal).toFixed(2)}`; $item("#packageRepSalePrice").show(); }
    } else {
        if ($item("#packageRepSale").type) $item("#packageRepSale").hide();
        if ($item("#packageRepSaleLine").type) $item("#packageRepSaleLine").hide();
        if ($item("#packageRepSalePrice").type) $item("#packageRepSalePrice").hide();
    }

    if ($item("#packageRepImage").type) {
        if (matchedPkg.image) { $item("#packageRepImage").src = matchedPkg.image; $item("#packageRepImage").show(); }
        else { $item("#packageRepImage").hide(); }
    }

    if ($item("#packageRepInteriorButton").type) { if (activeType === "Interior") $item("#packageRepInteriorButton").disable(); else $item("#packageRepInteriorButton").enable(); }
    if ($item("#packageRepExteriorButton").type) { if (activeType === "Exterior") $item("#packageRepExteriorButton").disable(); else $item("#packageRepExteriorButton").enable(); }
    if ($item("#packageRepFullButton").type) { if (activeType === "Full") $item("#packageRepFullButton").disable(); else $item("#packageRepFullButton").enable(); }
}

function updatePackageRepeater() {
    if (!$w("#packageRep") || !$w("#packageRep").id || cmsPackageData.length === 0) return;
    let activeVehObj = VEHICLE_TYPES.find(v => v.id === selectedVehicleSize) || VEHICLE_TYPES[0];
    let categoryPackages = cmsPackageData.filter(p => (p.serviceCategory || "Auto") === selectedServiceCategory);
    let levels = [...new Set(categoryPackages.map(p => p.packageLevel).filter(Boolean))];
    let repData = [];

    levels.forEach(level => {
        if (!repPackageState[level]) repPackageState[level] = "Full";
        let matchedPkg = categoryPackages.find(p => p.packageLevel === level && p.detailType === repPackageState[level] && p.subCategory === activeVehObj.subCategory);
        if (matchedPkg) repData.push({ _id: "pkgRep_" + level.replace(/\s/g, ''), currentActiveType: repPackageState[level], ...matchedPkg });
    });

    repData.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    smartSyncRepeater($w, "#packageRep", repData);
}

function repaintRepeaterInPlace() {
    if (!$w("#packageRep") || !$w("#packageRep").id || cmsPackageData.length === 0) return;
    let activeVehObj = VEHICLE_TYPES.find(v => v.id === selectedVehicleSize) || VEHICLE_TYPES[0];
    let categoryPackages = cmsPackageData.filter(p => (p.serviceCategory || "Auto") === selectedServiceCategory);

    $w("#packageRep").forEachItem(($item, itemData) => {
        if (!itemData.packageLevel) return;
        let activeType = repPackageState[itemData.packageLevel] || "Full";
        let matchedPkg = categoryPackages.find(p => p.packageLevel === itemData.packageLevel && p.detailType === activeType && p.subCategory === activeVehObj.subCategory);
        if (matchedPkg) paintPackageCard($item, matchedPkg, activeType);
    });
}

function initPackageRepeater() {
    if (!$w("#packageRep") || !$w("#packageRep").id) return;

    registerRepeater($w, "#packageRep", ($item, itemData) => {
        paintPackageCard($item, itemData, itemData.currentActiveType);

        const setTab = (type) => {
            [...new Set(cmsPackageData.map(p => p.packageLevel).filter(Boolean))].forEach(lvl => repPackageState[lvl] = type);
            selectedType = type;
            repaintRepeaterInPlace();
        };

        if ($item("#packageRepInteriorButton").type) $item("#packageRepInteriorButton").onClick(() => setTab("Interior"));
        if ($item("#packageRepExteriorButton").type) $item("#packageRepExteriorButton").onClick(() => setTab("Exterior"));
        if ($item("#packageRepFullButton").type) $item("#packageRepFullButton").onClick(() => setTab("Full"));

        const getMatchedPkg = () => {
            let activeSubCat = (VEHICLE_TYPES.find(v => v.id === selectedVehicleSize) || VEHICLE_TYPES[0]).subCategory.trim().toLowerCase();
            return cmsPackageData.find(p =>
                String(p.packageLevel || "").trim().toLowerCase() === String(itemData.packageLevel).trim().toLowerCase() &&
                String(p.detailType || "").trim().toLowerCase() === String(repPackageState[itemData.packageLevel] || "Full").trim().toLowerCase() &&
                String(p.subCategory || "").trim().toLowerCase() === activeSubCat &&
                String(p.serviceCategory || "Auto").trim().toLowerCase() === selectedServiceCategory.trim().toLowerCase()
            ) || itemData;
        };

        if ($item("#packageRepWhatsIncluded").type) {
            $item("#packageRepWhatsIncluded").onClick(() => {
                let matchedPkg = getMatchedPkg();
                openWhatsIncludedPopup(matchedPkg, Number(matchedPkg.price || 0));
            });
        }

        if ($item("#packageRepCartButton").type) {
            $item("#packageRepCartButton").onClick(() => {
                let matchedPkg = getMatchedPkg();
                selectedAddOns = packageAddOnsMap[getMemoryKey(matchedPkg.packageLevel, matchedPkg.detailType)] || [];
                bridgeAPI.setMasterState(matchedPkg.packageLevel, matchedPkg.detailType, Number(matchedPkg.price || 0), Number(matchedPkg.salePrice || 0), matchedPkg.saleTitle || "", matchedPkg.mobileFee || 0);
                bridgeAPI.updateSummary();
            });
        }
    });
}

export function getWhatsIncludedMasterData() {
    return g_allData;
}