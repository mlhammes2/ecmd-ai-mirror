// --- public/fileVehicleAdd.js ---

/**
 * ========================================================================
 * 🤖 AI CONTEXT & ARCHITECTURE NOTE
 * ========================================================================
 * FILE: public/fileVehicleAdd.js
 * DOM TARGETS: `#addVehicleLightboxState` (Lightbox state)
 * PURPOSE: Isolated engine for adding or editing vehicles in the customer's garage
 *          using native Wix Dropdowns (#customDropboxCategoryG & #customDropboxTypeG)
 *          and read-only input #vehicleNotesCustomInput.
 * ========================================================================
 */

import wixData from 'wix-data';
import { closeTopOverlay, closeAllOverlays, showSuccessMessage, showErrorMessage } from 'public/routerEngine';
import { APP_LOGS } from 'public/loggerConfig';
import { verifyVehicleType } from 'backend/vehicleClassifier.web';
import { pushCrmRecordToSupabase } from 'backend/aiBrain.web';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

let $w;
let hooks;

const DEBUG_MODE = APP_LOGS.MASTER_SWITCH && APP_LOGS.GARAGE;
const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [FILE_VEHICLE_ADD]: ${msg}`, data) : console.log(`📌 [FILE_VEHICLE_ADD]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [FILE_VEHICLE_ADD]: ${msg}`, data) : console.warn(`📌 [FILE_VEHICLE_ADD]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [FILE_VEHICLE_ADD]: ${msg}`, data) : console.error(`📌 [FILE_VEHICLE_ADD]: ${msg}`); }
};

let allVehicleCategories = [];
let selectedCategory = null;
let selectedVehicleType = null;
let editingVehicleId = null;
let classifyDebounceTimer = null;
let classifyRequestCounter = 0;

registerModuleState("fileVehicleAdd", () => ({
    allVehicleCategoriesCount: (allVehicleCategories || []).length,
    selectedCategory,
    selectedVehicleType,
    editingVehicleId,
    classifyRequestCounter,
    isFormCurrentlyValid: isAddVehicleFormValid()
}));

registerDomElements({
    inputs: [
        "#customDropboxCategoryG", "#customDropboxTypeG",
        "#inputYearLBG", "#inputMakeLBG", "#inputModelLBG",
        "#inputColorLBG", "#inputLengthLBG", "#vehicleNotesCustomInput",
        "#vehicleTextBoxG", "#notesVehicleTextbox"
    ]
});

// ⚡ 0ms Instant Local Lookup Lists
const LOCAL_THREE_ROW = [
    "escalade", "tahoe", "suburban", "yukon", "expedition", "navigator", "explorer",
    "aviator", "traverse", "enclave", "acadia", "pilot", "mdx", "highlander",
    "grand highlander", "sequoia", "4runner", "land cruiser", "gx", "lx", "tx",
    "pathfinder", "armada", "qx60", "qx80", "telluride", "palisade", "sorento",
    "santa fe", "ioniq 9", "ev9", "atlas", "tiguan", "q7", "gls", "eqb", "eqs suv",
    "x7", "xc90", "ex90", "ascent", "cx-9", "cx-90", "outlander", "durango",
    "grand cherokee l", "wagoneer", "grand wagoneer", "model x", "r1s", "gravity",
    "defender 130", "discovery", "range rover", "odyssey", "sienna", "pacifica",
    "carnival", "sedona", "town & country", "grand caravan", "transit", "sprinter",
    "promaster", "savana", "express", "metris"
];

const LOCAL_TWO_ROW = [
    "rav4", "cr-v", "crv", "hr-v", "hrv", "passport", "prologue", "rogue", "murano",
    "kicks", "ariya", "tucson", "kona", "venue", "ioniq 5", "sportage", "seltos",
    "soul", "niro", "ev6", "cx-30", "cx-5", "cx-50", "cx-70", "forester", "outback",
    "crosstrek", "solterra", "equinox", "blazer", "trailblazer", "trax", "terrain",
    "envision", "encore", "envista", "escape", "edge", "bronco", "mustang mach-e",
    "mach-e", "corsair", "nautilus", "cherokee", "grand cherokee", "compass",
    "wrangler", "renegade", "hornet", "taos", "id.4", "atlas cross sport",
    "q3", "q5", "q8", "x1", "x2", "x3", "x4", "x5", "x6", "ix", "gla", "glb",
    "glc", "gle", "g-class", "g550", "g63", "ux", "nx", "rx", "rz", "rdx", "zdx",
    "qx50", "qx55", "xc40", "xc60", "c40", "ex30", "macan", "cayenne", "model y",
    "gv70", "gv80", "stelvio", "tonale", "f-pace", "e-pace", "i-pace", "velar",
    "evoque", "defender", "urus", "dbx", "levante", "grecale", "purosangue", "bentayga", "cullinan"
];

const LOCAL_TRUCKS = [
    "f-150", "f150", "f-250", "f250", "f-350", "f350", "f-450", "ranger", "maverick",
    "silverado", "colorado", "sierra", "canyon", "ram", "1500", "2500", "3500",
    "dakota", "gladiator", "tacoma", "tundra", "frontier", "titan", "ridgeline",
    "santa cruz", "cybertruck", "r1t", "hummer ev pickup"
];

function classifyLocally0ms(make = "", model = "") {
    let m = String(model || "").trim().toLowerCase();
    let full = `${String(make || "").trim().toLowerCase()} ${m}`.trim();
    if (!m) return null;

    if (LOCAL_TRUCKS.some(t => m === t || m.includes(t) || full.includes(t))) {
        return { detectedCategory: "Automotive", detectedType: "Truck" };
    }
    if (LOCAL_THREE_ROW.some(s => m === s || m.includes(s) || full.includes(s)) && !m.includes("cross sport") && !m.includes("bronco sport")) {
        return { detectedCategory: "Automotive", detectedType: "3rd Row SUV" };
    }
    if (LOCAL_TWO_ROW.some(s => m === s || m.includes(s) || full.includes(s))) {
        return { detectedCategory: "Automotive", detectedType: "Sm. SUV" };
    }
    return null;
}

function safeEnable(selector) {
    if ($w && $w(selector).id && typeof $w(selector).enable === "function") {
        try { $w(selector).enable(); } catch (e) {}
    }
}

function safeDisable(selector) {
    if ($w && $w(selector).id && typeof $w(selector).disable === "function") {
        try { $w(selector).disable(); } catch (e) {}
    }
}

export function initVehicleAddEngine(wixContext, providedHooks) {
    logger.info("Initializing Vehicle Add Engine (Native Dropdown Mode)...");
    $w = wixContext;
    hooks = providedHooks || {};

    if (allVehicleCategories.length === 0) {
        wixData.query("vehicleCategories").ascending("sort").limit(200).find()
            .then(res => {
                if (res.items && res.items.length > 0) {
                    syncVehicleCategories(res.items);
                }
            })
            .catch(() => {});
    }

    initCategoryAndTypeDropdowns();
    initAddVehicleForm();
}

export function syncVehicleCategories(categoriesData) {
    if (Array.isArray(categoriesData) && categoriesData.length > 0) {
        allVehicleCategories = categoriesData;
        populateCategoryDropdown();
        if (selectedCategory) {
            populateTypeDropdown(selectedCategory);
        }
    }
}

export function getEditingVehicleId() {
    return editingVehicleId;
}

export function setEditingVehicleId(id) {
    editingVehicleId = id;
}

function isLengthRequiredForCategory(cat) {
    let cleanCat = String(cat || "").trim().toLowerCase();
    // Blank or "Automotive" disables #inputLengthLBG; "Marine", "Recreational", etc. enables it!
    if (!cleanCat || cleanCat === "automotive" || cleanCat === "auto") {
        return false;
    }
    return true;
}

function syncLengthInputState(preserveValue = false) {
    if (!$w || !$w("#inputLengthLBG").id) return;

    if (isLengthRequiredForCategory(selectedCategory)) {
        safeEnable("#inputLengthLBG");
    } else {
        if (!preserveValue) {
            try { $w("#inputLengthLBG").value = ""; } catch (e) {}
        }
        safeDisable("#inputLengthLBG");
    }
}

function isAddVehicleFormValid() {
    if (!$w) return false;

    let catVal = ($w("#customDropboxCategoryG").id && "value" in $w("#customDropboxCategoryG"))
        ? String($w("#customDropboxCategoryG").value || selectedCategory || "").trim()
        : String(selectedCategory || "").trim();

    let typeVal = ($w("#customDropboxTypeG").id && "value" in $w("#customDropboxTypeG"))
        ? String($w("#customDropboxTypeG").value || selectedVehicleType || "").trim()
        : String(selectedVehicleType || "").trim();

    let yearVal = $w("#inputYearLBG").id ? String($w("#inputYearLBG").value || "").trim() : "";
    let makeVal = $w("#inputMakeLBG").id ? String($w("#inputMakeLBG").value || "").trim() : "";
    let modelVal = $w("#inputModelLBG").id ? String($w("#inputModelLBG").value || "").trim() : "";
    let colorVal = $w("#inputColorLBG").id ? String($w("#inputColorLBG").value || "").trim() : "";

    if (!catVal || !typeVal || !yearVal || !makeVal || !modelVal || !colorVal) {
        return false;
    }

    if (isLengthRequiredForCategory(catVal) && $w("#inputLengthLBG").id) {
        let lenVal = String($w("#inputLengthLBG").value || "").trim();
        let parsedLen = parseFloat(lenVal.replace(/[^0-9.]/g, ""));
        if (!lenVal || isNaN(parsedLen) || parsedLen <= 0) {
            return false;
        }
    }

    return true;
}

function syncAddVehicleSubmitState() {
    if (!$w || !$w("#lightboxAddVehicleSubmit").id) return;

    if (isAddVehicleFormValid()) {
        safeEnable("#lightboxAddVehicleSubmit");
    } else {
        safeDisable("#lightboxAddVehicleSubmit");
    }
}

function populateCategoryDropdown() {
    if (!$w || !$w("#customDropboxCategoryG").id || !("options" in $w("#customDropboxCategoryG"))) return;

    let uniqueCats = [...new Set(allVehicleCategories.map(c => c.category).filter(Boolean))];
    if (uniqueCats.length === 0) {
        uniqueCats = ["Automotive"];
    }

    $w("#customDropboxCategoryG").options = uniqueCats.map(cat => ({ label: cat, value: cat }));
    if (selectedCategory && uniqueCats.includes(selectedCategory)) {
        $w("#customDropboxCategoryG").value = selectedCategory;
    }
}

function populateTypeDropdown(categoryName) {
    if (!$w || !$w("#customDropboxTypeG").id || !("options" in $w("#customDropboxTypeG"))) return;

    let filtered = allVehicleCategories.filter(c => c.category === categoryName);
    let uniqueTypes = [...new Set(filtered.map(c => c.vehicleType || c.title).filter(Boolean))];

    if (uniqueTypes.length === 0 && (!categoryName || String(categoryName).toLowerCase().includes("auto"))) {
        uniqueTypes = ["Sedan/Coupe", "Truck", "Sm. SUV", "3rd Row SUV"];
    }

    $w("#customDropboxTypeG").options = uniqueTypes.map(t => ({ label: t, value: t }));

    if (selectedVehicleType && uniqueTypes.includes(selectedVehicleType)) {
        $w("#customDropboxTypeG").value = selectedVehicleType;
    } else if (!selectedVehicleType) {
        $w("#customDropboxTypeG").value = "";
    }
}

function getVehicleNotesValue() {
    if (!$w) return "";
    if ($w("#vehicleTextBoxG").id) return String($w("#vehicleTextBoxG").value || "").trim();
    if ($w("#notesVehicleTextbox").id) return String($w("#notesVehicleTextbox").value || "").trim();
    return "";
}

function formatNotesPreview20(rawNotes = "") {
    let clean = String(rawNotes || "").replace(/\s+/g, " ").trim();
    if (!clean) return "";
    return clean.length > 20 ? `${clean.substring(0, 20)}...` : clean;
}

function setVehicleNotesValue(val = "") {
    if (!$w) return;
    let cleanVal = String(val || "");
    if ($w("#vehicleTextBoxG").id) {
        try { $w("#vehicleTextBoxG").value = cleanVal; } catch (e) {}
    }
    if ($w("#notesVehicleTextbox").id) {
        try { $w("#notesVehicleTextbox").value = cleanVal; } catch (e) {}
    }
    syncVehicleNotesUI();
}

function syncVehicleNotesUI() {
    if (!$w) return;
    let rawNotes = getVehicleNotesValue();
    let hasNotes = rawNotes.length > 0;
    let preview20 = formatNotesPreview20(rawNotes);

    // 1. Update read-only #vehicleNotesCustomInput with the first 20 characters
    if ($w("#vehicleNotesCustomInput").id) {
        let el = $w("#vehicleNotesCustomInput");
        try {
            if ("readOnly" in el) el.readOnly = true;
            if ("placeholder" in el) el.placeholder = "Add Vehicle Notes...";
            if ("value" in el) {
                el.value = hasNotes ? preview20 : "";
            }
        } catch (e) {}
    }

    // 2. Update #vehicleNotesButtonG label
    if ($w("#vehicleNotesButtonG").id && "label" in $w("#vehicleNotesButtonG")) {
        $w("#vehicleNotesButtonG").label = hasNotes ? "Vehicle Has Notes" : "Add Notes";
    }

    // 3. Update #vehicleNotesText indicator if present
    if ($w("#vehicleNotesText").id) {
        if (hasNotes) {
            $w("#vehicleNotesText").text = "Vehicle Has Notes.";
            $w("#vehicleNotesText").show();
        } else {
            $w("#vehicleNotesText").hide();
        }
    }
}

export function clearAddVehicleForm() {
    editingVehicleId = null;
    selectedCategory = null;
    selectedVehicleType = null;

    if (!$w) return;

    ["#inputYearLBG", "#inputMakeLBG", "#inputModelLBG", "#inputColorLBG", "#inputLengthLBG", "#notesVehicleTextbox"].forEach(id => {
        if ($w(id).id) {
            try { $w(id).value = ""; } catch (e) {}
        }
    });

    populateCategoryDropdown();
    if ($w("#customDropboxCategoryG").id && "value" in $w("#customDropboxCategoryG")) {
        try {
            $w("#customDropboxCategoryG").value = "";
            $w("#customDropboxCategoryG").resetValidityIndication();
        } catch (e) {}
    }

    if ($w("#customDropboxTypeG").id && "value" in $w("#customDropboxTypeG")) {
        try {
            $w("#customDropboxTypeG").options = [];
            $w("#customDropboxTypeG").value = "";
            $w("#customDropboxTypeG").resetValidityIndication();
        } catch (e) {}
    }
    safeDisable("#customDropboxTypeG");

    syncLengthInputState(false);

    if ($w("#lightboxAddVehicleSubmit").id) {
        if ("label" in $w("#lightboxAddVehicleSubmit")) $w("#lightboxAddVehicleSubmit").label = "Submit";
        safeDisable("#lightboxAddVehicleSubmit");
    }

    setVehicleNotesValue("");
}

export function loadVehicleIntoForm(vehicleObj) {
    if (!vehicleObj || !$w) return;

    editingVehicleId = vehicleObj._id;
    selectedCategory = vehicleObj.category || "Automotive";
    selectedVehicleType = vehicleObj.vehicleType || null;

    populateCategoryDropdown();
    if ($w("#customDropboxCategoryG").id && "value" in $w("#customDropboxCategoryG")) {
        $w("#customDropboxCategoryG").value = selectedCategory;
    }

    safeEnable("#customDropboxTypeG");
    populateTypeDropdown(selectedCategory);
    if ($w("#customDropboxTypeG").id && "value" in $w("#customDropboxTypeG") && selectedVehicleType) {
        $w("#customDropboxTypeG").value = selectedVehicleType;
    }

    if ($w("#inputYearLBG").id) $w("#inputYearLBG").value = vehicleObj.year ? String(vehicleObj.year) : "";
    if ($w("#inputMakeLBG").id) $w("#inputMakeLBG").value = vehicleObj.make || "";
    if ($w("#inputModelLBG").id) $w("#inputModelLBG").value = vehicleObj.model || "";
    if ($w("#inputColorLBG").id) $w("#inputColorLBG").value = vehicleObj.color || "";

    syncLengthInputState(true);
    if ($w("#inputLengthLBG").id) {
        $w("#inputLengthLBG").value = (isLengthRequiredForCategory(selectedCategory) && vehicleObj.length)
            ? String(vehicleObj.length)
            : "";
    }

    setVehicleNotesValue(vehicleObj.vehicleNotes || vehicleObj.notes || vehicleObj.specialInstructions || "");

    if ($w("#lightboxAddVehicleSubmit").id && "label" in $w("#lightboxAddVehicleSubmit")) {
        $w("#lightboxAddVehicleSubmit").label = "Update Vehicle";
    }
    syncAddVehicleSubmitState();
}

function initCategoryAndTypeDropdowns() {
    populateCategoryDropdown();
    if (!selectedCategory) {
        safeDisable("#customDropboxTypeG");
    }
    syncLengthInputState(false);
    syncAddVehicleSubmitState();

    if ($w("#customDropboxCategoryG").id && typeof $w("#customDropboxCategoryG").onChange === "function") {
        $w("#customDropboxCategoryG").onChange((event) => {
            let newCat = event.target.value;
            if (selectedCategory !== newCat) {
                selectedCategory = newCat;
                selectedVehicleType = null;
            }
            safeEnable("#customDropboxTypeG");
            populateTypeDropdown(selectedCategory);
            syncLengthInputState(false);
            syncAddVehicleSubmitState();
        });
    }

    if ($w("#customDropboxTypeG").id && typeof $w("#customDropboxTypeG").onChange === "function") {
        $w("#customDropboxTypeG").onChange((event) => {
            selectedVehicleType = event.target.value;
            syncAddVehicleSubmitState();
        });
    }
}

function resolveExactCmsTypeAndCategory(detectedCat = "Automotive", detectedType = "") {
    let targetCat = detectedCat || "Automotive";
    let targetType = detectedType || "";

    if (allVehicleCategories.length > 0) {
        let catMatch = allVehicleCategories.find(c =>
            String(c.category || "").trim().toLowerCase() === targetCat.toLowerCase()
        ) || allVehicleCategories.find(c =>
            String(c.category || "").toLowerCase().includes("auto")
        );
        if (catMatch && catMatch.category) {
            targetCat = catMatch.category;
        }

        let catRows = allVehicleCategories.filter(c => c.category === targetCat);
        let tLower = targetType.toLowerCase();

        let exactRow = catRows.find(c => String(c.vehicleType || c.title || "").trim().toLowerCase() === tLower);
        if (!exactRow) {
            if (tLower.includes("3rd") || tLower.includes("lg") || tLower.includes("large")) {
                exactRow = catRows.find(c => {
                    let s = String(c.vehicleType || c.title || "").toLowerCase();
                    return s.includes("3rd") || s.includes("lg") || s.includes("large");
                });
            } else if (tLower.includes("sm") || tLower.includes("small") || tLower.includes("suv")) {
                exactRow = catRows.find(c => {
                    let s = String(c.vehicleType || c.title || "").toLowerCase();
                    return (s.includes("sm") || s.includes("suv")) && !s.includes("3rd") && !s.includes("lg");
                });
            } else if (tLower.includes("truck")) {
                exactRow = catRows.find(c => String(c.vehicleType || c.title || "").toLowerCase().includes("truck"));
            } else if (tLower.includes("sedan") || tLower.includes("car") || tLower.includes("coupe")) {
                exactRow = catRows.find(c => {
                    let s = String(c.vehicleType || c.title || "").toLowerCase();
                    return s.includes("sedan") || s.includes("car") || s.includes("coupe");
                });
            }
        }
        if (exactRow) {
            targetType = exactRow.vehicleType || exactRow.title || targetType;
        }
    }

    return { category: targetCat, vehicleType: targetType };
}

function applyDetectedClassificationToUI(detectedCat, detectedType) {
    let resolved = resolveExactCmsTypeAndCategory(detectedCat || "Automotive", detectedType);

    selectedCategory = resolved.category;
    selectedVehicleType = resolved.vehicleType;

    populateCategoryDropdown();
    if ($w("#customDropboxCategoryG").id && "value" in $w("#customDropboxCategoryG")) {
        $w("#customDropboxCategoryG").value = selectedCategory;
    }

    safeEnable("#customDropboxTypeG");
    populateTypeDropdown(selectedCategory);
    if ($w("#customDropboxTypeG").id && "value" in $w("#customDropboxTypeG")) {
        $w("#customDropboxTypeG").value = selectedVehicleType;
    }

    syncLengthInputState(false);
    syncAddVehicleSubmitState();
}

async function autoClassifyVehicleInputs() {
    if (!$w) return null;
    if (selectedCategory && isLengthRequiredForCategory(selectedCategory)) return null;

    let year = $w("#inputYearLBG").id ? String($w("#inputYearLBG").value || "").trim() : "";
    let make = $w("#inputMakeLBG").id ? String($w("#inputMakeLBG").value || "").trim() : "";
    let model = $w("#inputModelLBG").id ? String($w("#inputModelLBG").value || "").trim() : "";

    if (!model || model.length < 2) return null;

    // 1. 0ms Local Instant Check
    let instantMatch = classifyLocally0ms(make, model);
    if (instantMatch) {
        applyDetectedClassificationToUI(instantMatch.detectedCategory, instantMatch.detectedType);
    }

    // 2. Backend EPA + Classifier Verification
    const currentReqId = ++classifyRequestCounter;
    try {
        let res = await verifyVehicleType(year, make, model, selectedVehicleType);
        if (currentReqId !== classifyRequestCounter) return res;

        if (res && res.detectedType) {
            applyDetectedClassificationToUI(res.detectedCategory || "Automotive", res.detectedType);
        }
        return res;
    } catch (err) {
        logger.warn("Auto-classify backend fallback skipped:", err);
        return instantMatch;
    }
}

function scheduleDebouncedClassification() {
    if (classifyDebounceTimer) clearTimeout(classifyDebounceTimer);
    classifyDebounceTimer = setTimeout(() => {
        autoClassifyVehicleInputs();
    }, 200);
}

function initAddVehicleForm() {
    syncVehicleNotesUI();

    const openVehicleNotesPopup = () => {
        if ($w("#vehicleNotesCustomInput").id && typeof $w("#vehicleNotesCustomInput").blur === "function") {
            try { $w("#vehicleNotesCustomInput").blur(); } catch (e) {}
        }
        if (hooks.openOverlay) {
            hooks.openOverlay($w, "popup", "notesVehiclePopupState");
        }
    };

    // Bind #vehicleNotesCustomInput, #vehicleNotesButtonG, and legacy #buttonNotesVehicle to open notesVehiclePopupState
    ["#vehicleNotesCustomInput", "#vehicleNotesButtonG", "#buttonNotesVehicle"].forEach(btnId => {
        if ($w(btnId).id) {
            $w(btnId).onClick(openVehicleNotesPopup);
        }
    });

    // Bind the Save/Submit button inside notesVehiclePopupState
    ["#submitVehicleNotesButton", "#vehicleNotesSubmitG", "#saveVehicleNotesButton"].forEach(btnId => {
        if ($w(btnId).id) {
            $w(btnId).onClick(() => {
                syncVehicleNotesUI();
                closeTopOverlay($w);
            });
        }
    });

    // Keep #vehicleNotesCustomInput (20-char preview) & #vehicleNotesButtonG synced live
    ["#vehicleTextBoxG", "#notesVehicleTextbox"].forEach(boxId => {
        if ($w(boxId).id) {
            if (typeof $w(boxId).onInput === "function") {
                $w(boxId).onInput(() => syncVehicleNotesUI());
            }
            $w(boxId).onChange(() => syncVehicleNotesUI());
        }
    });

    const autoCapFields = ["#inputMakeLBG", "#inputModelLBG", "#inputColorLBG"];
    autoCapFields.forEach(id => {
        if ($w(id).id && typeof $w(id).onBlur === "function") {
            $w(id).onBlur((event) => {
                let val = event.target.value;
                if (val) {
                    $w(id).value = val.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                }
                if (id === "#inputMakeLBG" || id === "#inputModelLBG") {
                    autoClassifyVehicleInputs();
                }
                syncAddVehicleSubmitState();
            });
        }
    });

    const handleEnter = (id, callback) => {
        if ($w(id).id && typeof $w(id).onKeyPress === "function") {
            $w(id).onKeyPress((e) => {
                if (e.key === "Enter") setTimeout(callback, 50);
            });
        }
    };
    handleEnter("#inputYearLBG", () => { if ($w("#inputMakeLBG").id) $w("#inputMakeLBG").focus(); });
    handleEnter("#inputMakeLBG", () => { if ($w("#inputModelLBG").id) $w("#inputModelLBG").focus(); });
    handleEnter("#inputModelLBG", () => {
        autoClassifyVehicleInputs();
        if ($w("#inputColorLBG").id) $w("#inputColorLBG").focus();
    });

    ["#inputYearLBG", "#inputMakeLBG", "#inputModelLBG"].forEach(id => {
        if ($w(id).id) {
            if (typeof $w(id).onInput === "function") {
                $w(id).onInput(() => {
                    syncAddVehicleSubmitState();
                    scheduleDebouncedClassification();
                });
            }
            $w(id).onChange(() => {
                syncAddVehicleSubmitState();
                autoClassifyVehicleInputs();
            });
        }
    });

    ["#inputColorLBG", "#inputLengthLBG"].forEach(id => {
        if ($w(id).id) {
            if (typeof $w(id).onInput === "function") {
                $w(id).onInput(() => syncAddVehicleSubmitState());
            }
            $w(id).onChange(() => syncAddVehicleSubmitState());
        }
    });

    if ($w("#lightboxAddVehicleSubmit").id) {
        $w("#lightboxAddVehicleSubmit").onClick(async () => {
            let btn = $w("#lightboxAddVehicleSubmit");
            safeDisable("#lightboxAddVehicleSubmit");
            if ("label" in btn) btn.label = "Verifying...";

            await autoClassifyVehicleInputs();

            if (!isAddVehicleFormValid()) {
                showErrorMessage("⚠️ Please complete all required vehicle fields.");
                if ("label" in btn) btn.label = editingVehicleId ? "Update Vehicle" : "Submit";
                syncAddVehicleSubmitState();
                return;
            }

            let finalCat = ($w("#customDropboxCategoryG").id && "value" in $w("#customDropboxCategoryG"))
                ? $w("#customDropboxCategoryG").value || selectedCategory
                : selectedCategory;
            let finalType = ($w("#customDropboxTypeG").id && "value" in $w("#customDropboxTypeG"))
                ? $w("#customDropboxTypeG").value || selectedVehicleType
                : selectedVehicleType;

            let year = $w("#inputYearLBG").id ? String($w("#inputYearLBG").value || "").trim() : "";
            let make = $w("#inputMakeLBG").id ? String($w("#inputMakeLBG").value || "").trim() : "";
            let model = $w("#inputModelLBG").id ? String($w("#inputModelLBG").value || "").trim() : "";
            let color = $w("#inputColorLBG").id ? String($w("#inputColorLBG").value || "").trim() : "";
            let rawLength = (isLengthRequiredForCategory(finalCat) && $w("#inputLengthLBG").id)
                ? String($w("#inputLengthLBG").value || "")
                : "";
            let lengthVal = parseFloat(rawLength.replace(/[^0-9.]/g, "")) || 0;
            let notes = getVehicleNotesValue();

            if ("label" in btn) btn.label = "Saving...";

            try {
                let userId = hooks.getActiveUserId ? await hooks.getActiveUserId() : null;
                if (!userId) throw new Error("No active user ID found.");

                let vehiclePayload = {
                    userId: String(userId),
                    category: finalCat,
                    vehicleType: finalType,
                    year: year,
                    make: make,
                    model: model,
                    color: color,
                    length: lengthVal,
                    notes: notes,
                    vehicleNotes: notes,
                    archived: false
                };

                let savedVehicleRecord = null;
                if (editingVehicleId) {
                    let existing = await wixData.get("customerVehicles", editingVehicleId);
                    let updatedObj = { ...existing, ...vehiclePayload, _id: editingVehicleId };
                    savedVehicleRecord = await wixData.update("customerVehicles", updatedObj);
                } else {
                    savedVehicleRecord = await wixData.insert("customerVehicles", vehiclePayload);
                }
                if (savedVehicleRecord) {
                    pushCrmRecordToSupabase("customerVehicles", savedVehicleRecord).catch(() => {});
                }

                clearAddVehicleForm();

                if (hooks.triggerVehicleSaveCallback) {
                    await hooks.triggerVehicleSaveCallback();
                } else {
                    closeAllOverlays($w);
                    showSuccessMessage("Vehicle Saved!");
                }
            } catch (err) {
                logger.error("Failed to save vehicle:", err);
                showErrorMessage("Failed to save vehicle. Please try again.");
                if ("label" in btn) btn.label = editingVehicleId ? "Update Vehicle" : "Submit";
                syncAddVehicleSubmitState();
            }
        });
    }
}

export function setEditingCategoryAndType(categoryName, vehicleTypeName) {
    selectedCategory = (categoryName && categoryName !== "NONE") ? categoryName : null;
    selectedVehicleType = (vehicleTypeName && vehicleTypeName !== "NONE") ? vehicleTypeName : null;

    populateCategoryDropdown();
    if (selectedCategory) {
        if ($w && $w("#customDropboxCategoryG").id && "value" in $w("#customDropboxCategoryG")) {
            $w("#customDropboxCategoryG").value = selectedCategory;
        }
        safeEnable("#customDropboxTypeG");
        populateTypeDropdown(selectedCategory);
        if ($w && $w("#customDropboxTypeG").id && "value" in $w("#customDropboxTypeG") && selectedVehicleType) {
            $w("#customDropboxTypeG").value = selectedVehicleType;
        }
    } else {
        safeDisable("#customDropboxTypeG");
    }

    syncLengthInputState(true);
    syncAddVehicleSubmitState();
}

export function loadEditingVehicleImages() {
    // Kept for backwards compatibility with garageEngine.js edit flow
}