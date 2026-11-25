// --- public/aiTelemetry.js ---

import wixLocationFrontend from 'wix-location-frontend';
import wixWindowFrontend from 'wix-window-frontend';
import { local, session } from 'wix-storage';
import { askHqCopilot, saveBlueprintToCms, getBlueprintFromCms, bulkSaveBlueprintsToCms, getAvailableGeminiModels, getBrainRegistryFromCms, toggleAiCapabilityInCms } from 'backend/geminiAssistant.web';
import { hqState } from 'public/hqState';
import { captureFullPageBlueprint } from 'public/siteBlueprintMapper';

const MAX_LOG_BUFFER = 1500; // Clean build sync
const MAX_ERROR_BUFFER = 250;
const QUICK_INPUT_CHAR_LIMIT = 42;

const SESSION_LOGS_KEY = "ecmd_gemini_session_logs";
const SESSION_ERRORS_KEY = "ecmd_gemini_session_errors";
const SESSION_ACTIVE_CHAT_KEY = "ecmd_gemini_active_chat";
const LOCAL_ARCHIVED_CHATS_KEY = "ecmd_gemini_saved_chats";

let MODEL_OPTIONS = [
    {
        _id: "model_flash",
        modelId: "gemini-2.5-pro",
        shortLabel: "2.5 Pro",
        title: "Gemini 2.5 Pro",
        desc: "Fast live debugging, log analysis & instant answers"
    },
    {
        _id: "model_pro",
        modelId: "gemini-3.8-pro",
        shortLabel: "3.8 Pro",
        title: "Gemini 3.8 Pro",
        desc: "Deep multi-file code architecture, full file rewrites & site migration"
    },
    {
        _id: "model_lite",
        modelId: "gemini-3.8-flash-lite",
        shortLabel: "3.8 Lite",
        title: "Gemini 3.8 Flash-Lite",
        desc: "Ultra-fast lightweight CMS & analytics queries"
    }
];

export const aiTelemetry = {
    isHooked: false,
    isUiWired: false,
    $w: null,
    selectedModelId: "gemini-2.5-pro",
    selectedModelLabel: "2.5 Pro",

    // Multi-select context flags in #geminiPlusRep
    contextFlags: {
        includeLogs: true,
        includeDom: true,
        includeHqState: true,
        includeCms: true,
        autoDiagnoseErrors: true
    },

    // UI state for #geminiOptionsRep ("main" | "allChats" | "settings" | "capabilities" | "brainIndex")
    optionsMenuMode: "main",
    activePersonaRole: "ADMIN",
    liveCapabilities: [],
    liveBrainIndex: [],

    lastAutoDiagTime: 0,
    logs: [],
    errors: [],
    currentChatId: "chat_session_" + Date.now(),
    chatHistory: [],
    savedChats: [],
    lastDiagnosis: "",
    lastSavedCmsTitle: ""
};

function getGlobalScope() {
    try { return Function("return this")(); } catch (e) { return null; }
}

function safeSerialize(val) {
    try {
        if (val instanceof Error) {
            return `${val.name}: ${val.message}${val.stack ? " | " + val.stack.split("\n").slice(0, 3).join(" ") : ""}`;
        }
        if (typeof val === "object" && val !== null) {
            return JSON.parse(JSON.stringify(val));
        }
        return String(val);
    } catch (e) {
        return String(val);
    }
}

function loadSavedBuffers() {
    try {
        let sLogs = session.getItem(SESSION_LOGS_KEY);
        if (sLogs) aiTelemetry.logs = JSON.parse(sLogs);

        let sErrs = session.getItem(SESSION_ERRORS_KEY);
        if (sErrs) aiTelemetry.errors = JSON.parse(sErrs);

        let sChat = session.getItem(SESSION_ACTIVE_CHAT_KEY);
        if (sChat) aiTelemetry.chatHistory = JSON.parse(sChat);

        let lSaved = local.getItem(LOCAL_ARCHIVED_CHATS_KEY);
        if (lSaved) aiTelemetry.savedChats = JSON.parse(lSaved);
    } catch (e) {}
}

let saveTimer = null;
function persistBuffersThrottled() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        try {
            session.setItem(SESSION_LOGS_KEY, JSON.stringify(aiTelemetry.logs.slice(-450)));
            session.setItem(SESSION_ERRORS_KEY, JSON.stringify(aiTelemetry.errors.slice(-120)));
            session.setItem(SESSION_ACTIVE_CHAT_KEY, JSON.stringify(aiTelemetry.chatHistory.slice(-40)));
            local.setItem(LOCAL_ARCHIVED_CHATS_KEY, JSON.stringify(aiTelemetry.savedChats.slice(0, 25)));
        } catch (e) {}
    }, 500);
}

function archiveCurrentChatIfNonEmpty() {
    let realTurns = (aiTelemetry.chatHistory || []).filter(t => t._id !== "welcome_msg");
    if (realTurns.length === 0) return;

    let firstUserPrompt = realTurns[0]?.userText || "Diagnostic Session";
    let cleanTitle = firstUserPrompt.replace(/^🚨 Auto-Detected Error:\s*/i, "").substring(0, 34).trim();
    if (firstUserPrompt.length > 34) cleanTitle += "...";

    let summaryObj = {
        _id: aiTelemetry.currentChatId || ("chat_" + Date.now()),
        title: cleanTitle || "Saved Chat",
        desc: `${realTurns.length} turn(s) • ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        turns: [...aiTelemetry.chatHistory]
    };

    aiTelemetry.savedChats = [
        summaryObj,
        ...aiTelemetry.savedChats.filter(c => c._id !== summaryObj._id)
    ].slice(0, 25);

    persistBuffersThrottled();
}

// ==========================================
// 🔌 MODULE STATE, DOM & FUNCTION REGISTRIES
// ==========================================
// ==========================================
// 🔌 MODULE STATE, DOM & FUNCTION REGISTRIES (HOIST-SAFE FOR CIRCULAR IMPORTS)
// ==========================================
var registeredModuleGetters;
var registeredModuleFunctions;
var extraDomIds;

function ensureRegistriesInitialized() {
    if (!registeredModuleGetters) registeredModuleGetters = {};
    if (!registeredModuleFunctions) registeredModuleFunctions = {};
    if (!extraDomIds) {
        extraDomIds = {
            msb: new Set(),
            boxes: new Set(),
            repeaters: new Set(),
            inputs: new Set()
        };
    }
}

export function registerModuleState(moduleName, stateGetterFn) {
    ensureRegistriesInitialized();
    if (moduleName && typeof stateGetterFn === "function") {
        registeredModuleGetters[moduleName] = stateGetterFn;
    }
}

export function registerModuleFunctions(moduleName, fnMapObj = {}) {
    ensureRegistriesInitialized();
    if (moduleName && fnMapObj && typeof fnMapObj === "object") {
        registeredModuleFunctions[moduleName] = fnMapObj;
    }
}

/**
 * @param {{ msb?: string[], boxes?: string[], repeaters?: string[], inputs?: string[] }} [config]
 */
export function registerDomElements(config = {}) {
    ensureRegistriesInitialized();
    const { msb = [], boxes = [], repeaters = [], inputs = [] } = config;
    msb.forEach(id => extraDomIds.msb.add(id));
    boxes.forEach(id => extraDomIds.boxes.add(id));
    repeaters.forEach(id => extraDomIds.repeaters.add(id));
    inputs.forEach(id => extraDomIds.inputs.add(id));
}

export function buildAllModulesSnapshot() {
    ensureRegistriesInitialized();
    const modulesSnap = {};
    Object.keys(registeredModuleGetters).forEach(modName => {
        try {
            modulesSnap[modName] = safeSerialize(registeredModuleGetters[modName]());
        } catch (e) {
            modulesSnap[modName] = { errorReadingState: e.message };
        }
    });
    return modulesSnap;
}

// ==========================================
// 🔍 LIVE DOM, STYLE & BLUEPRINT SCANNERS
// ==========================================
function extractVeloElementStyle($el) {
    if (!$el || !$el.id) return undefined;
    try {
        const s = $el.style || {};
        const styleObj = {};
        if (s.backgroundColor) styleObj.backgroundColor = s.backgroundColor;
        if (s.borderColor) styleObj.borderColor = s.borderColor;
        if (s.borderWidth) styleObj.borderWidth = s.borderWidth;
        if (s.borderRadius) styleObj.borderRadius = s.borderRadius;
        if (s.color) styleObj.color = s.color;
        if (s.foregroundColor) styleObj.foregroundColor = s.foregroundColor;
        return Object.keys(styleObj).length > 0 ? styleObj : undefined;
    } catch (e) {
        return undefined;
    }
}

export function scanLivePageDOM($wContext = null) {
    ensureRegistriesInitialized();
    const $w = $wContext || aiTelemetry.$w || hqState.$w;
    if (!$w) return { note: "No $w context attached" };

    try {
        const msbIds = [
            "#msbCustomer", "#msbOffice", "#msbProfile", "#msbJobs", "#msbLightbox",
            "#msbLightboxG", "#msbPrompts", "#msbPopUp", "#msbMessages", "#msbFooter", "#msbSideMenu",
            ...Array.from(extraDomIds.msb)
        ];
        const msbStates = {};
        msbIds.forEach(id => {
            try {
                if ($w(id).id) {
                    const allStates = Array.isArray($w(id).states)
                        ? $w(id).states.map(st => st.id)
                        : undefined;
                    msbStates[id] = {
                        currentState: $w(id).currentState ? $w(id).currentState.id : null,
                        availableStates: allStates,
                        hidden: $w(id).hidden,
                        collapsed: $w(id).collapsed,
                        style: extractVeloElementStyle($w(id))
                    };
                }
            } catch (e) {}
        });

        const boxIds = [
            "#geminiBox", "#geminiExpandBox", "#geminiModelBox", "#geminiPlusBox", "#geminiOptionsBox",
            "#officeBox", "#officeMenu", "#tabMenuBox", "#hqCalendarMenuBox",
            "#addOnBoxI", "#addOnBoxE", "#lightboxBackground", "#lightboxBoxG", "#siteMenu",
            "#summaryBox", "#primaryInfo", "#correctionDetailerMenu", "#changeVehicle",
            "#contactInfo", "#locationInfo", "#selectDetailer",
            ...Array.from(extraDomIds.boxes)
        ];
        const containers = {};
        boxIds.forEach(id => {
            try {
                if ($w(id).id) {
                    containers[id] = {
                        type: $w(id).type,
                        visible: !$w(id).hidden && !$w(id).collapsed,
                        hidden: $w(id).hidden,
                        collapsed: $w(id).collapsed,
                        style: extractVeloElementStyle($w(id))
                    };
                }
            } catch (e) {}
        });

        const repeaterIds = [
            "#repWeekly", "#repDaily", "#tabRepeater", "#hqCalendarMenuRep", "#bookingRep",
            "#previousRep", "#pRepeater", "#newIAddOnsRepeater", "#newEAddOnsRepeater",
            "#customRep", "#officeRep", "#correctionRep", "#packageRep",
            "#repCart", "#calendarRep", "#calendarMonthRep", "#confirmationRep",
            "#repDropboxDetailer", "#cartButtonMenuRep", "#repHeaderButtons",
            "#upcomingRep", "#completedRep",
            ...Array.from(extraDomIds.repeaters)
        ];
        const repeaters = {};
        repeaterIds.forEach(id => {
            try {
                if ($w(id).id) {
                    const repData = Array.isArray($w(id).data) ? $w(id).data : [];
                    repeaters[id] = {
                        count: repData.length,
                        sampleItemKeys: repData[0] ? Object.keys(repData[0]) : [],
                        hidden: $w(id).hidden,
                        collapsed: $w(id).collapsed,
                        style: extractVeloElementStyle($w(id))
                    };
                }
            } catch (e) {}
        });

        const inputIds = [
            "#phoneSearch", "#vehicleDropdown", "#contactDropdown", "#locationDropdown",
            "#newPackagesDropdown", "#masterPriceInput", "#newDurationInput",
            "#customAddOnsInput", "#customAddOnsPriceInput", "#newNotes",
            "#newVehicleCategoryDropBox", "#newVehicleTypeDropBox", "#newVehicleYear",
            "#newVehicleMake", "#newVehicleModel", "#newVehicleColor",
            "#loginUserG", "#loginPasswordG", "#regFirstNameG", "#regLastNameG",
            "#regEmailG", "#regPhoneG", "#regAddress1G", "#regAddress2G",
            "#regCityG", "#regStateG", "#regZipG", "#btnSmsConsent", "#siTextbox",
            ...Array.from(extraDomIds.inputs)
        ];
        const inputs = {};
        inputIds.forEach(id => {
            try {
                if ($w(id).id) {
                    const isPassword = id.toLowerCase().includes("password") || id.toLowerCase().includes("confirm");
                    inputs[id] = {
                        type: $w(id).type,
                        value: isPassword ? ($w(id).value ? "[REDACTED_SET]" : "") : $w(id).value,
                        placeholder: $w(id).placeholder,
                        enabled: $w(id).enabled,
                        checked: $w(id).checked !== undefined ? $w(id).checked : undefined,
                        optionsCount: Array.isArray($w(id).options) ? $w(id).options.length : undefined,
                        style: extractVeloElementStyle($w(id))
                    };
                }
            } catch (e) {}
        });

        return {
            url: typeof wixLocationFrontend !== "undefined" ? wixLocationFrontend.url : "",
            path: typeof wixLocationFrontend !== "undefined" ? wixLocationFrontend.path : [],
            query: typeof wixLocationFrontend !== "undefined" ? wixLocationFrontend.query : {},
            formFactor: typeof wixWindowFrontend !== "undefined" ? wixWindowFrontend.formFactor : "Desktop",
            multiStateBoxes: msbStates,
            containers,
            repeaters,
            inputs
        };
    } catch (err) {
        return { domScanError: err.message };
    }
}

/**
 * Deep Page Blueprint Extractor for 1CodeAndBlueprints:
 * Captures viewport bounding rect, Velo DOM + styles, any accessible raw browser DOM/CSS,
 * and registered module states.
 */
export async function extractDeepPageBlueprint($wContext = null) {
    const baseDom = scanLivePageDOM($wContext);
    let viewportBounds = null;
    try {
        viewportBounds = await wixWindowFrontend.getBoundingRect();
    } catch (e) {}

    // If a Custom Element or top-level browser script exposed raw computed CSS on globalThis, include it automatically
    const gScope = /** @type {any} */ getGlobalScope();
    let rawBrowserComputedCss = null;

    if (gScope && gScope.__ECMD_COMPUTED_CSS_SNAPSHOT__) {
        rawBrowserComputedCss = gScope.__ECMD_COMPUTED_CSS_SNAPSHOT__;
    } else if (gScope && gScope.document && typeof gScope.getComputedStyle === "function") {
        try {
            const sampleNodes = Array.from(gScope.document.querySelectorAll("[id]")).slice(0, 200);
            rawBrowserComputedCss = sampleNodes.map((/** @type {any} */ el) => {
                const cs = gScope.getComputedStyle(el);
                return {
                    id: el.id,
                    tag: el.tagName,
                    display: cs.display,
                    position: cs.position,
                    width: cs.width,
                    height: cs.height,
                    flexDirection: cs.flexDirection,
                    justifyContent: cs.justifyContent,
                    alignItems: cs.alignItems,
                    gap: cs.gap,
                    gridTemplateColumns: cs.gridTemplateColumns,
                    backgroundColor: cs.backgroundColor,
                    color: cs.color,
                    fontFamily: cs.fontFamily,
                    fontSize: cs.fontSize,
                    fontWeight: cs.fontWeight,
                    borderRadius: cs.borderRadius,
                    border: cs.border,
                    padding: cs.padding,
                    margin: cs.margin
                };
            });
        } catch (e) {}
    }

    const fullVeloElementMap = await captureFullPageBlueprint($wContext || aiTelemetry.$w || hqState.$w).catch(() => null);

    return {
        capturedAt: new Date().toISOString(),
        url: baseDom.url,
        path: baseDom.path,
        formFactor: baseDom.formFactor,
        viewportBounds,
        veloDomAndStyles: baseDom,
        fullVeloElementMap,
        rawBrowserComputedCss: rawBrowserComputedCss || "Velo Worker Sandbox Active (Use Velo DOM + Styles above or attach Custom Code snippet for raw getComputedStyle)",
        moduleStates: buildAllModulesSnapshot()
    };
}

export function buildHqStateSnapshot() {
    try {
        /** @type {any} */
        let cd = hqState.currentDraft || {};
        /** @type {any[]} */
        let drafts = hqState.draftSessions || [];
        return {
            activeTabId: hqState.activeTabId,
            selectedCartItemId: hqState.selectedCartItemId,
            selectedTabIds: hqState.selectedTabIds,
            selectedPreviousJobId: hqState.selectedPreviousJobId,
            selectedCalendarDate: hqState.selectedCalendarDate,
            isSavingInfo: hqState.isSavingInfo,
            isSwitchingTab: hqState.isSwitchingTab,
            loadedCustomerVehiclesCount: (hqState.globalCustomerVehicles || []).length,
            loadedCustomerContactsCount: (hqState.globalCustomerContacts || []).length,
            loadedCustomerLocationsCount: (hqState.globalCustomerLocations || []).length,
            loadedJobsInMemoryCount: (hqState.globalJobs || []).length,
            draftSessionsCount: drafts.length,
            draftSessionsSummary: drafts.map(d => ({
                _id: d._id,
                label: d.label,
                isExistingBooking: d.isExistingBooking,
                isCorrectionDraft: d.isCorrectionDraft,
                isReschedulingMode: d.isReschedulingMode,
                originalJobId: d.originalJobId,
                customerId: d.customerId,
                vehicleId: d.vehicleId,
                contactId: d.contactId,
                locationId: d.locationId,
                packageId: d.packageId,
                packageTitle: d.packageTitle,
                totalPrice: d.totalPrice
            })),
            currentDraft: {
                editingCartId: cd.editingCartId,
                originalJobId: cd.originalJobId,
                customerId: cd.customerId,
                primaryContactText: cd.primaryContactText,
                vehicleId: cd.vehicleId,
                contactId: cd.contactId,
                locationId: cd.locationId,
                packageId: cd.packageId,
                packageTitle: cd.packageTitle,
                level: cd.level,
                type: cd.type,
                basePrice: cd.basePrice,
                mobileFee: cd.mobileFee,
                totalPrice: cd.totalPrice,
                setDuration: cd.setDuration,
                interiorAddOns: cd.interiorAddOns || [],
                exteriorAddOns: cd.exteriorAddOns || [],
                customAddOns: cd.customAddOns || [],
                discountsApplied: cd.discountsApplied || [],
                officeNotes: cd.officeNotes || ""
            },
            registeredModulesState: buildAllModulesSnapshot()
        };
    } catch (e) {
        return { snapshotError: e.message };
    }
}

let isCustomElementFileListenerWired = false;

async function uploadPayloadsInBatches(payloads = []) {
    if (!Array.isArray(payloads) || payloads.length === 0) return;

    const BATCH_SIZE = 3;
    const totalBatches = Math.ceil(payloads.length / BATCH_SIZE);

    pushSystemNoticeToChat(
        `📦 Bulk Seeding ${payloads.length} File(s) to 1CodeAndBlueprints`,
        `⏳ Starting upload of **${payloads.length} files** (${totalBatches} fast batches)...`
    );

    let totalSaved = 0;
    const savedTitles = [];
    const errorsList = [];

    const updateProgressText = (msg) => {
        let lastTurn = aiTelemetry.chatHistory[aiTelemetry.chatHistory.length - 1];
        if (lastTurn && lastTurn.role === "ai") {
            lastTurn.aiText = msg;
            const $w = aiTelemetry.$w || hqState.$w;
            if ($w && $w("#geminiRep").id) {
                try {
                    $w("#geminiRep").forItems([lastTurn._id], ($item) => {
                        if ($item("#geminiAiText").id) $item("#geminiAiText").text = msg;
                    });
                } catch (e) {}
            }
        }
    };

    for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const isLastBatch = (i + BATCH_SIZE) >= payloads.length;
        const batch = payloads.slice(i, i + BATCH_SIZE);

        updateProgressText(
            `⏳ Uploading Batch **${batchNum} of ${totalBatches}** (${Math.min(i + BATCH_SIZE, payloads.length)} / ${payloads.length} files)...\n` +
            `✅ Saved so far: **${totalSaved}**`
        );

        try {
            const res = await bulkSaveBlueprintsToCms(batch, isLastBatch);
            if (res && res.success) {
                totalSaved += (res.savedCount || 0);
                (res.results || []).forEach(r => {
                    if (r.status === "saved") {
                        savedTitles.push(`• \`${r.title}\` (${r.category} • ${r.chars.toLocaleString()} chars)`);
                    } else if (r.error) {
                        errorsList.push(`• ❌ \`${r.title}\`: ${r.error}`);
                    }
                });
            }
        } catch (batchErr) {
            // If a batch of 3 ever times out, retry those 3 files one-by-one automatically!
            for (let singleFile of batch) {
                try {
                    const singleRes = await bulkSaveBlueprintsToCms([singleFile], false);
                    if (singleRes && singleRes.success) {
                        totalSaved += (singleRes.savedCount || 0);
                        (singleRes.results || []).forEach(r => {
                            if (r.status === "saved") {
                                savedTitles.push(`• \`${r.title}\` (${r.category} • ${r.chars.toLocaleString()} chars)`);
                            }
                        });
                    }
                } catch (singleErr) {
                    errorsList.push(`• ❌ \`${singleFile.fileName || singleFile.title}\`: ${singleErr.message || singleErr}`);
                }
            }
        }
    }

    let lastTurn = aiTelemetry.chatHistory[aiTelemetry.chatHistory.length - 1];
    if (lastTurn && lastTurn.role === "ai") {
        lastTurn.aiText =
            `✅ **Successfully Seeded ${totalSaved} of ${payloads.length} Files into \`1CodeAndBlueprints\`!**\n\n` +
            savedTitles.slice(0, 35).join("\n") +
            (savedTitles.length > 35 ? `\n...and ${savedTitles.length - 35} more files!` : "") +
            (errorsList.length > 0 ? `\n\n⚠️ **Errors (${errorsList.length}):**\n${errorsList.join("\n")}` : "");
        persistBuffersThrottled();
        renderGeminiChatRepeater();
    }
}

export async function launchBulkFileSeederDialog() {
    const $w = aiTelemetry.$w || hqState.$w;

    // 1. Primary Method: Bridge across Velo's Web Worker sandbox via the CustomElement instance on the page!
    if ($w) {
        try {
            let ceInstance = null;
            if ($w("#footerTracker").id && typeof $w("#footerTracker").setAttribute === "function") {
                ceInstance = $w("#footerTracker");
            } else {
                const allCes = $w("CustomElement");
                if (allCes && allCes.length > 0) {
                    // Pick the last CustomElement (footer-tracker) or first available instance
                    ceInstance = allCes[allCes.length - 1] || allCes[0];
                }
            }

            if (ceInstance && typeof ceInstance.setAttribute === "function") {
                if (!isCustomElementFileListenerWired && typeof ceInstance.on === "function") {
                    isCustomElementFileListenerWired = true;
                    ceInstance.on("filesSelected", async (event) => {
                        const files = event?.detail?.files || [];
                        if (files.length > 0) {
                            await uploadPayloadsInBatches(files);
                        }
                    });
                }

                ceInstance.setAttribute("open-file-picker", String(Date.now()));
                return;
            }
        } catch (e) {}
    }

    // 2. Fallback if running in an environment with direct global document access
    const gScope = getGlobalScope();
    if (gScope && typeof gScope.__ECMD_OPEN_FILE_PICKER__ === "function") {
        const payloads = await gScope.__ECMD_OPEN_FILE_PICKER__();
        await uploadPayloadsInBatches(payloads);
        return;
    }

    pushSystemNoticeToChat(
        "📦 Bulk Seed Files to CMS",
        "⚠️ Could not trigger the browser file picker on this view. Use the **PowerShell Bulk Seeder** (which connects directly to `https://www.ecmdutah.com/_functions/geminiBridge`) to upload all 55 files in 10 seconds!"
    );
}

// ==========================================
// ⬇️ 1-CLICK FILE DOWNLOAD & CLIPBOARD ENGINE
// ==========================================
function triggerBrowserFileDownload(filename, textContent) {
    try {
        const gScope = /** @type {any} */ getGlobalScope();
        if (gScope && gScope.document && gScope.Blob && gScope.URL) {
            const blob = new gScope.Blob([textContent], { type: "text/plain;charset=utf-8" });
            const url = gScope.URL.createObjectURL(blob);
            const a = gScope.document.createElement("a");
            a.href = url;
            a.download = filename;
            gScope.document.body.appendChild(a);
            a.click();
            gScope.document.body.removeChild(a);
            gScope.URL.revokeObjectURL(url);
            return true;
        }
    } catch (e) {}
    return false;
}

// ==========================================
// 🎛️ POPUP & ANCHOR TOGGLE HELPERS
// ==========================================
function setPopupVisibility($w, anchorId, boxId, shouldShow, effect = "fade", duration = 150) {
    if (!$w) return Promise.resolve();

    const anchorEl = anchorId && $w(anchorId).id ? $w(anchorId) : null;
    const boxEl = boxId && $w(boxId).id ? $w(boxId) : null;

    if (shouldShow) {
        if (anchorEl) {
            if (anchorEl.collapsed) anchorEl.expand();
            if (anchorEl.hidden) anchorEl.show();
        }
        if (boxEl) {
            if (boxEl.collapsed) boxEl.expand();
            if (boxEl.hidden) {
                return boxEl.show(effect, { duration }).catch(() => {});
            }
        }
        return Promise.resolve();
    } else {
        let p = Promise.resolve();
        if (boxEl && !boxEl.hidden) {
            p = boxEl.hide(effect, { duration }).then(() => {
                if (boxEl.hidden) boxEl.collapse();
            }).catch(() => {});
        } else if (boxEl && !boxEl.collapsed) {
            boxEl.collapse();
        }

        return p.then(() => {
            if (anchorEl) {
                if (!anchorEl.hidden) anchorEl.hide();
                if (!anchorEl.collapsed) anchorEl.collapse();
            }
        });
    }
}

export function closeAllGeminiSubPopups() {
    const $w = aiTelemetry.$w || hqState.$w;
    if (!$w) return;
    setPopupVisibility($w, "#geminiModelAnchor", "#geminiModelBox", false);
    setPopupVisibility($w, "#geminiPlusAnchor", "#geminiPlusBox", false);
    setPopupVisibility($w, "#geminiOptionsAnchor", "#geminiOptionsBox", false);
}

function isBoxOpen($w, boxId) {
    return Boolean($w && $w(boxId).id && !$w(boxId).hidden && !$w(boxId).collapsed);
}

function syncGeminiHeaderTitle() {
    const $w = aiTelemetry.$w || hqState.$w;
    if (!$w) return;

    if ($w("#geminiTitle").id) {
        let errCount = aiTelemetry.errors.length;
        let logCount = aiTelemetry.logs.length;
        let statusSuffix = errCount > 0 ? `${errCount} Alert(s) • ${logCount} Logs` : `${logCount} Logs`;
        $w("#geminiTitle").text = `Gemini ${aiTelemetry.selectedModelLabel}  •  ${statusSuffix}`;
    }

    if ($w("#geminiModelButton").id) {
        $w("#geminiModelButton").label = `${aiTelemetry.selectedModelLabel} ⌄`;
    }
}

function extractFirstCodeBlock(text) {
    if (!text) return "";
    let match = String(text).match(/```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/);
    return match && match[1] ? match[1].trim() : String(text).trim();
}

// ==========================================
// 💬 MAIN CHAT REPEATER (#geminiRep)
// ==========================================
function pushSystemNoticeToChat(userLabel, aiMessage) {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (userLabel && String(userLabel).trim() !== "") {
        aiTelemetry.chatHistory.push({
            _id: "sys_user_" + Date.now(),
            role: "user",
            time: nowTime,
            modelLabel: aiTelemetry.selectedModelLabel,
            userText: String(userLabel).trim(),
            aiText: ""
        });
    }
    aiTelemetry.chatHistory.push({
        _id: "sys_ai_" + (Date.now() + 1),
        role: "ai",
        time: nowTime,
        modelLabel: aiTelemetry.selectedModelLabel,
        userText: "",
        aiText: aiMessage
    });
    persistBuffersThrottled();
    renderGeminiChatRepeater();
}

// ==========================================
// 💬 MAIN CHAT REPEATER (#geminiRep — STRICTLY 1 BUBBLE PER ITEM)
// ==========================================
function normalizeSingleBubbleHistory(rawHistory = []) {
    const normalized = [];
    rawHistory.forEach((turn, idx) => {
        if (!turn) return;
        if (turn._id === "welcome_msg") {
            normalized.push({
                ...turn,
                role: "ai",
                userText: ""
            });
            return;
        }
        const uText = String(turn.userText || "").trim();
        const aText = String(turn.aiText || "").trim();

        let cleanAiText = aText;
        if (cleanAiText.startsWith("⏳") || cleanAiText.startsWith("⠋")) {
            cleanAiText = "⚠️ Request was interrupted before completion. Click the Re-run icon on your message above to try again.";
        }

        // If an older cached item has BOTH userText and aiText, split it into 2 separate repeater items!
        if (uText && cleanAiText) {
            normalized.push({
                _id: `${turn._id || idx}_u`,
                role: "user",
                time: turn.time,
                modelLabel: turn.modelLabel,
                userText: uText,
                aiText: ""
            });
            normalized.push({
                _id: `${turn._id || idx}_a`,
                role: "ai",
                time: turn.time,
                modelLabel: turn.modelLabel,
                tag: turn.tag,
                userText: "",
                aiText: cleanAiText
            });
        } else if (uText) {
            normalized.push({ ...turn, role: "user", aiText: "" });
        } else if (cleanAiText) {
            normalized.push({ ...turn, role: "ai", userText: "", aiText: cleanAiText });
        }
    });
    return normalized;
}

export function renderGeminiChatRepeater() {
    const $w = aiTelemetry.$w || hqState.$w;
    if (!$w || !$w("#geminiRep").id) return;

    syncGeminiHeaderTitle();

    if (aiTelemetry.chatHistory.length === 0) {
        aiTelemetry.chatHistory.push({
            _id: "welcome_msg",
            role: "ai",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            modelLabel: aiTelemetry.selectedModelLabel,
            userText: "",
            aiText: "👋 Hi! I'm your live ECMD Gemini Co-Pilot. I'm connected to your session logs, live DOM/CSS scanner, Booking HQ state, and your `1CodeAndBlueprints` CMS collection. Ask me anything or click '+' for 1-click diagnostics & code sync!"
        });
    } else {
        aiTelemetry.chatHistory = normalizeSingleBubbleHistory(aiTelemetry.chatHistory);
    }

    const cleanData = aiTelemetry.chatHistory.map((t, i) => ({
        ...t,
        _id: String(t._id || `turn_${i}`)
    }));

    if ($w("#geminiRep").collapsed) $w("#geminiRep").expand();
    if ($w("#geminiRep").hidden) $w("#geminiRep").show();

    // Force Wix Repeater to mount new items cleanly
    $w("#geminiRep").data = cleanData;

    const enforceSingleBubblePass = () => {
        try {
            $w("#geminiRep").forEachItem(($item, itemData) => {
                const liveItem = (aiTelemetry.chatHistory || []).find(t => String(t._id) === String(itemData._id)) || itemData;
                paintGeminiChatRow($item, liveItem);
            });
        } catch (e) {}
    };

    enforceSingleBubblePass();
    setTimeout(enforceSingleBubblePass, 50);
    setTimeout(enforceSingleBubblePass, 180);
    setTimeout(enforceSingleBubblePass, 400);
}

function paintGeminiChatRow($item, itemData) {
    if (!itemData) return;

    // Ensure the parent repeater item container (#geminiItem) itself is never collapsed or hidden
    try {
        if ($item("#geminiItem").id) {
            if ($item("#geminiItem").collapsed) $item("#geminiItem").expand();
            if ($item("#geminiItem").hidden) $item("#geminiItem").show();
        }
    } catch (e) {}

    const cleanUser = String(itemData.userText || "").trim();
    const cleanAi = String(itemData.aiText || "").trim();

    // Strictly show ONLY ONE bubble per repeater item!
    const isUserRow = itemData.role === "user" || (cleanUser.length > 0 && cleanAi.length === 0);

    if (isUserRow) {
        // 1. Collapse & hide #geminiAiBox
        if ($item("#geminiAiBox").id) {
            $item("#geminiAiBox").hide();
            $item("#geminiAiBox").collapse();
        }

        // 2. Expand & show #geminiUserBox (plus its inner text element!)
        if ($item("#geminiUserText").id) {
            $item("#geminiUserText").text = cleanUser;
            if ($item("#geminiUserText").collapsed) $item("#geminiUserText").expand();
            if ($item("#geminiUserText").hidden) $item("#geminiUserText").show();
        }
        if ($item("#geminiUserBox").id) {
            $item("#geminiUserBox").expand();
            $item("#geminiUserBox").show();
        }
    } else {
        // 1. Collapse & hide #geminiUserBox
        if ($item("#geminiUserBox").id) {
            $item("#geminiUserBox").hide();
            $item("#geminiUserBox").collapse();
        }

        // 2. Expand & show #geminiAiBox (plus its inner tag & text elements!)
        if ($item("#geminiAiTag").id) {
            let tagLabel = itemData.tag || `Gemini ${itemData.modelLabel || aiTelemetry.selectedModelLabel} • ${itemData.time || ""}`;
            $item("#geminiAiTag").text = tagLabel.trim();
            if ($item("#geminiAiTag").collapsed) $item("#geminiAiTag").expand();
            if ($item("#geminiAiTag").hidden) $item("#geminiAiTag").show();
        }
        if ($item("#geminiAiText").id) {
            $item("#geminiAiText").text = cleanAi;
            if ($item("#geminiAiText").collapsed) $item("#geminiAiText").expand();
            if ($item("#geminiAiText").hidden) $item("#geminiAiText").show();
        }
        if ($item("#geminiAiBox").id) {
            $item("#geminiAiBox").expand();
            $item("#geminiAiBox").show();
        }
    }
}


// ==========================================
// ⚡ POPUP 1: MODEL SELECTOR (#geminiModelRep — AUTO-UPDATING FROM GOOGLE TIER 1 API)
// ==========================================
let hasSyncedLiveModels = false;

async function syncLiveModelCatalogFromGoogle() {
    if (hasSyncedLiveModels) return;
    hasSyncedLiveModels = true;
    try {
        const res = await getAvailableGeminiModels();
        if (res && Array.isArray(res.models) && res.models.length > 0) {
            const currentSlot = MODEL_OPTIONS.find(m => m.modelId === aiTelemetry.selectedModelId) || MODEL_OPTIONS[0];
            MODEL_OPTIONS = res.models;
            const updatedSlot = MODEL_OPTIONS.find(m => m._id === currentSlot._id) || MODEL_OPTIONS[0];
            aiTelemetry.selectedModelId = updatedSlot.modelId;
            aiTelemetry.selectedModelLabel = updatedSlot.shortLabel;
            refreshModelRepeater();
            syncGeminiHeaderTitle();
        }
    } catch (e) {}
}

function refreshModelRepeater() {
    const $w = aiTelemetry.$w || hqState.$w;
    if (!$w || !$w("#geminiModelRep").id) return;

    $w("#geminiModelRep").data = [...MODEL_OPTIONS];
    $w("#geminiModelRep").forEachItem(($item, itemData) => {
        if ($item("#geminiModelTitle").id) $item("#geminiModelTitle").text = itemData.title;
        if ($item("#geminiModelDesc").id) $item("#geminiModelDesc").text = itemData.desc;
        if ($item("#geminiModelVector").id) {
            if (itemData.modelId === aiTelemetry.selectedModelId) {
                $item("#geminiModelVector").show();
            } else {
                $item("#geminiModelVector").hide();
            }
        }
    });
}
// ==========================================
// ➕ POPUP 2: PLUS / POWER TOOLS (#geminiPlusRep)
// ==========================================
function buildPlusMenuItems() {
    const cf = aiTelemetry.contextFlags;
    return [
        {
            _id: "plus_bulk_seed_cms",
            isDivider: false,
            isToggle: false,
            action: "bulk_seed_files_cms",
            title: "📦 Bulk Seed .js / .txt Files to CMS",
            desc: "Select all your .txt / .js files at once to auto-populate 1CodeAndBlueprints"
        },
        {
            _id: "plus_diag_err",
            isDivider: false,
            isToggle: false,
            action: "diagnose_error",
            title: "🔍 Diagnose Last Error (Line-by-Line)",
            desc: "Inspect recent errors, stack traces & 1CodeAndBlueprints source code"
        },
        {
            _id: "plus_autofix_cms",
            isDivider: false,
            isToggle: false,
            action: "autofix_and_save_cms",
            title: "🛠️ Auto-Fix File & Save Full Code to CMS",
            desc: "Rewrite the buggy file and auto-save the complete code to 1CodeAndBlueprints"
        },
        {
            _id: "plus_copy_latest_cms",
            isDivider: false,
            isToggle: false,
            action: "copy_latest_cms_code",
            title: "📋 Copy / Download Latest Code from CMS",
            desc: "1-click copy (& download) the latest full file saved in 1CodeAndBlueprints"
        },
        {
            _id: "plus_div_blueprint",
            isDivider: true
        },
        {
            _id: "plus_capture_dom_cms",
            isDivider: false,
            isToggle: false,
            action: "capture_dom_to_cms",
            title: "📸 Capture Page DOM & CSS to CMS",
            desc: "Save this page's live DOM tree, styles, repeaters & MSBs to 1CodeAndBlueprints"
        },
        {
            _id: "plus_generate_migration",
            isDivider: false,
            isToggle: false,
            action: "generate_migration_blueprint",
            title: "🏗️ Generate React / Tailwind Migration File",
            desc: "Convert this page's DOM, CSS & Velo logic into unrestricted React/CSS in CMS"
        },
        {
            _id: "plus_div_1",
            isDivider: true
        },
        {
            _id: "plus_audit_dom",
            isDivider: false,
            isToggle: false,
            action: "audit_dom",
            title: "🩺 Full Page & DOM Health Audit",
            desc: "Scan all Multi-State Boxes, repeaters, overlays & inputs"
        },
        {
            _id: "plus_inspect_tab",
            isDivider: false,
            isToggle: false,
            action: "inspect_tab",
            title: "🗂️ Inspect Active Tab & Module State",
            desc: "Audit currentDraft, pricing math, add-ons & registered module variables"
        },
        {
            _id: "plus_audit_cal",
            isDivider: false,
            isToggle: false,
            action: "audit_calendar",
            title: "📅 Audit Calendar & Slot Capacity",
            desc: "Verify detailer availability, time-off rules & jobs for selected day"
        },
        {
            _id: "plus_rev_analytics",
            isDivider: false,
            isToggle: false,
            action: "revenue_analytics",
            title: "📊 Revenue & Booking Analytics",
            desc: "Live 60-day revenue, upcoming pipeline & detailer workload"
        },
        {
            _id: "plus_unpaid_jobs",
            isDivider: false,
            isToggle: false,
            action: "unpaid_jobs",
            title: "💳 Find Unpaid Completed Jobs",
            desc: "List completed jobs still marked Unpaid with customer contact"
        },
        {
            _id: "plus_div_2",
            isDivider: true
        },
        {
            _id: "plus_toggle_logs",
            isDivider: false,
            isToggle: true,
            flagKey: "includeLogs",
            selected: cf.includeLogs,
            title: "📡 Attach Session Logs",
            desc: `Send up to ${MAX_LOG_BUFFER} live session logs with every prompt`
        },
        {
            _id: "plus_toggle_dom",
            isDivider: false,
            isToggle: true,
            flagKey: "includeDom",
            selected: cf.includeDom,
            title: "🖥️ Attach Live DOM & Module State",
            desc: "Include live Multi-State Boxes, inputs & registered module variables"
        },
        {
            _id: "plus_toggle_cms",
            isDivider: false,
            isToggle: true,
            flagKey: "includeCms",
            selected: cf.includeCms,
            title: "🗄️ Attach Live CMS Database Digest",
            desc: "Include scheduledJobs, servicePackages & detailer rosters"
        },
        {
            _id: "plus_div_3",
            isDivider: true
        },
        {
            _id: "plus_clear_logs",
            isDivider: false,
            isToggle: false,
            action: "clear_logs",
            title: "🧹 Clear Session Log Buffer",
            desc: "Reset recorded logs/errors before a fresh test click"
        }
    ];
}

function paintSharedMenuRow($item, itemData, prefix) {
    let lineBox = $item(`#${prefix}Line`);
    let titleEl = $item(`#${prefix}Title`);
    let descEl = $item(`#${prefix}Desc`);
    let vecEl = $item(`#${prefix}Vector`);
    let btnEl = $item(`#${prefix}RepButton`);

    if (itemData.isDivider) {
        if (lineBox && lineBox.id) {
            if (lineBox.collapsed) lineBox.expand();
            if (lineBox.hidden) lineBox.show();
        }
        [titleEl, descEl, vecEl, btnEl].forEach(el => {
            if (el && el.id) {
                if (!el.hidden) el.hide();
                if (!el.collapsed) el.collapse();
            }
        });
        return;
    }

    if (lineBox && lineBox.id) {
        if (!lineBox.hidden) lineBox.hide();
        if (!lineBox.collapsed) lineBox.collapse();
    }

    [titleEl, descEl, btnEl].forEach(el => {
        if (el && el.id) {
            if (el.collapsed) el.expand();
            if (el.hidden) el.show();
        }
    });

    if (titleEl && titleEl.id) titleEl.text = itemData.title || "";
    if (descEl && descEl.id) descEl.text = itemData.desc || "";
    if (btnEl && btnEl.id) btnEl.label = "";

    if (vecEl && vecEl.id) {
        if (itemData.selected) {
            if (vecEl.collapsed) vecEl.expand();
            vecEl.show();
        } else {
            vecEl.hide();
        }
    }
}

function refreshPlusRepeater() {
    const $w = aiTelemetry.$w || hqState.$w;
    if (!$w || !$w("#geminiPlusRep").id) return;

    let items = buildPlusMenuItems();
    $w("#geminiPlusRep").data = items;
    $w("#geminiPlusRep").forEachItem(($item, itemData) => {
        paintSharedMenuRow($item, itemData, "geminiPlus");
    });
}

async function handlePlusMenuClick(itemData) {
    if (!itemData || itemData.isDivider) return;

    if (itemData.isToggle && itemData.flagKey) {
        aiTelemetry.contextFlags[itemData.flagKey] = !aiTelemetry.contextFlags[itemData.flagKey];
        refreshPlusRepeater();
        return;
    }

    closeAllGeminiSubPopups();

    switch (itemData.action) {
        case "bulk_seed_files_cms":
            await launchBulkFileSeederDialog();
            break;
        case "diagnose_error":
            await askSiteAi("Diagnose the most recent errors or warnings in my session logs, module states, and 1CodeAndBlueprints source code. Pinpoint the exact file, line number, element ID, and fix.", false);
            break;

        case "autofix_and_save_cms":
            await askSiteAi("Inspect the most recent error or issue along with the matching file in 1CodeAndBlueprints. Generate the COMPLETE corrected .js file and save it directly into 1CodeAndBlueprints using <<<SAVE_TO_CMS:fileName|generatedBlueprint>>>...<<<END_SAVE>>> so I can copy the entire file in 1 click.", false);
            break;

        case "copy_latest_cms_code": {
            let res = await getBlueprintFromCms(aiTelemetry.lastSavedCmsTitle || "");
            if (!res || !res.success || !res.item) {
                pushSystemNoticeToChat(
                    "📋 Copy Latest CMS Code",
                    `⚠️ Could not load a row from \`1CodeAndBlueprints\`: ${res?.error || "Collection is empty."}`
                );
                break;
            }
            let item = res.item;
            let codeToCopy = item.generatedBlueprint || item.veloSourceCode || JSON.stringify(item.domCssBlueprint || {}, null, 2);
            let sourceField = item.generatedBlueprint
                ? "Migration Output / Generated Blueprint"
                : (item.veloSourceCode ? "veloSourceCode" : "Live DOM & Computed CSS");

            await wixWindowFrontend.copyToClipboard(codeToCopy).catch(() => {});
            let cleanFileName = String(item.title || "blueprint").replace(/[^a-zA-Z0-9._-]/g, "_") + ".txt";
            let didDownload = triggerBrowserFileDownload(cleanFileName, codeToCopy);

            pushSystemNoticeToChat(
                `📋 Copy Latest CMS Code (${item.title})`,
                `✅ **Copied ${codeToCopy.length.toLocaleString()} characters to your clipboard!**\n` +
                `• **CMS Row:** \`${item.title}\`\n` +
                `• **Source Field:** \`${sourceField}\`\n` +
                (didDownload ? `• **Browser Download:** Triggered \`${cleanFileName}\`\n` : "") +
                `\nYou can now press **Ctrl + V** anywhere to paste the entire untruncated file.`
            );
            break;
        }

        case "capture_dom_to_cms": {
            let pathArr = typeof wixLocationFrontend !== "undefined" ? wixLocationFrontend.path : [];
            let pageSlug = pathArr && pathArr.length > 0 ? "/" + pathArr.join("/") : "/home";
            let rowTitle = `Page: ${pageSlug}`;

            pushSystemNoticeToChat(
                `📸 Capture DOM & CSS (${rowTitle})`,
                "⏳ Scanning live page DOM, element styles, Multi-State Boxes, repeaters, and module states..."
            );

            let blueprint = await extractDeepPageBlueprint();
            let saveRes = await saveBlueprintToCms(rowTitle, {
                category: "Page DOM & CSS",
                domCssBlueprint: blueprint
            });

            aiTelemetry.lastSavedCmsTitle = rowTitle;
            let lastTurn = aiTelemetry.chatHistory[aiTelemetry.chatHistory.length - 1];
            if (lastTurn) {
                lastTurn.aiText = saveRes && saveRes.success
                    ? `✅ **Saved Live DOM & CSS Blueprint to \`1CodeAndBlueprints\`!**\n• **Row Title:** \`${rowTitle}\`\n• **MSBs Captured:** ${Object.keys(blueprint.veloDomAndStyles?.multiStateBoxes || {}).length}\n• **Containers Captured:** ${Object.keys(blueprint.veloDomAndStyles?.containers || {}).length}\n• **Repeaters Captured:** ${Object.keys(blueprint.veloDomAndStyles?.repeaters || {}).length}\n• **Inputs Captured:** ${Object.keys(blueprint.veloDomAndStyles?.inputs || {}).length}`
                    : `❌ Failed saving blueprint to CMS: ${saveRes?.error || "Unknown error"}`;
                persistBuffersThrottled();
                renderGeminiChatRepeater();
            }
            break;
        }

        case "generate_migration_blueprint": {
            let pathArr = typeof wixLocationFrontend !== "undefined" ? wixLocationFrontend.path : [];
            let pageSlug = pathArr && pathArr.length > 0 ? "/" + pathArr.join("/") : "/home";
            let rowTitle = `Page: ${pageSlug}`;

            let blueprint = await extractDeepPageBlueprint();
            await saveBlueprintToCms(rowTitle, {
                category: "Page DOM & CSS",
                domCssBlueprint: blueprint
            });
            aiTelemetry.lastSavedCmsTitle = rowTitle;

            await askSiteAi(
                `Using the live DOM & CSS snapshot for "${rowTitle}" and any matching Velo source code in 1CodeAndBlueprints, generate a complete, production-ready React + Tailwind CSS (and raw CSS variables) component that duplicates every element, Multi-State Box state, repeater layout, color, border, and function on this page without any Wix restrictions. Save the complete code directly into 1CodeAndBlueprints using <<<SAVE_TO_CMS:${rowTitle}|generatedBlueprint>>>...<<<END_SAVE>>>.`,
                false
            );
            break;
        }

        case "audit_dom":
            await askSiteAi("Run a complete health audit of the current page's live DOM (Multi-State Box states, visible/hidden containers, repeater counts, styles, and input values) and flag any anomalies.", false);
            break;

        case "inspect_tab":
            await askSiteAi("Inspect hqState.currentDraft, hqState.draftSessions, and registeredModulesState right now. Verify package pricing, add-ons, discounts, duration, and customer/vehicle/location IDs.", false);
            break;

        case "audit_calendar":
            await askSiteAi("Audit the calendar state for the currently selected date, including detailer availability and scheduled jobs.", true);
            break;

        case "revenue_analytics":
            await askSiteAi("Give me a complete executive breakdown of our last 60 days revenue, upcoming projected revenue, booking counts, and detailer workload distribution.", true);
            break;

        case "unpaid_jobs":
            await askSiteAi("List all completed jobs that are currently marked Unpaid in the database, including customer name, phone number, date, detailer, and total price.", true);
            break;

        case "clear_logs":
            aiTelemetry.logs = [];
            aiTelemetry.errors = [];
            persistBuffersThrottled();
            syncGeminiHeaderTitle();
            break;
    }
}

// ==========================================
// ⚙️ POPUP 3: MORE OPTIONS & ANIMATED SETTINGS (#geminiOptionsRep)
// ==========================================
function buildOptionsMenuItems() {
    const mode = aiTelemetry.optionsMenuMode;

    if (mode === "settings") {
        return [
            {
                _id: "opt_back_main",
                isDivider: false,
                action: "back_to_main",
                selected: false,
                title: "← Back to Options",
                desc: "Return to Previous Chats & Options menu"
            },
            {
                _id: "opt_div_settings_top",
                isDivider: true
            },
            {
                _id: "set_auto_diag",
                isDivider: false,
                action: "toggle_auto_diag",
                selected: aiTelemetry.contextFlags.autoDiagnoseErrors,
                title: "Auto-Diagnose Console Errors",
                desc: aiTelemetry.contextFlags.autoDiagnoseErrors
                    ? "Active • Automatically diagnoses runtime errors"
                    : "Paused • Click to enable automatic error diagnosis"
            },
            {
                _id: "set_newest_top",
                isDivider: false,
                action: "coming_soon",
                selected: false,
                title: "Reverse Chat Order (Newest on Top)",
                desc: "🚧 [Coming Soon] • Pin latest AI replies to the top of #geminiRep"
            },
            {
                _id: "set_auto_fix",
                isDivider: false,
                action: "coming_soon",
                selected: false,
                title: "Auto-Heal Stuck Overlay & MSB States",
                desc: "🚧 [Coming Soon] • Let Gemini automatically unstick hidden DOM boxes"
            },
            {
                _id: "set_open_capabilities",
                isDivider: false,
                action: "open_capabilities",
                selected: false,
                title: "🎛️ Manage AI Capabilities (Live CMS Toggles)",
                desc: `Toggle any of the ${aiTelemetry.liveCapabilities.length || 15} Site AI & Carbon 4 capabilities on/off`
            },
            {
                _id: "set_open_brain_index",
                isDivider: false,
                action: "open_brain_index",
                selected: false,
                title: "🧭 View AI Brain Pipeline Index",
                desc: "Inspect the 7-stage pre-conversation filter & roadmap"
            },
            {
                _id: "set_customer_mode",
                isDivider: false,
                action: "toggle_persona_mode",
                selected: aiTelemetry.activePersonaRole === "PUBLIC",
                title: "🎭 Customer-Facing Booking Concierge Mode",
                desc: aiTelemetry.activePersonaRole === "PUBLIC"
                    ? "Active (PUBLIC Persona) • Testing customer advisor guardrails"
                    : "Active (ADMIN Persona) • Click to preview Public Customer persona"
            },
            {
                _id: "set_voice_tts",
                isDivider: false,
                action: "coming_soon",
                selected: false,
                title: "Voice Readout & Hands-Free Dispatch",
                desc: "🚧 [Coming Soon] • Audio readout of diagnostics & schedule summaries"
            },
            {
                _id: "set_daily_digest",
                isDivider: false,
                action: "coming_soon",
                selected: false,
                title: "Automated Daily Analytics & Audit Digest",
                desc: "🚧 [Coming Soon] • Morning summary of unpaid jobs & vehicle audits"
            }
        ];
    }

    if (mode === "capabilities") {
        const capItems = [
            {
                _id: "cap_back_settings",
                isDivider: false,
                action: "open_settings",
                selected: false,
                title: "← Back to Settings",
                desc: "Return to AI Settings menu"
            },
            { _id: "cap_div_top", isDivider: true }
        ];
        (aiTelemetry.liveCapabilities || []).forEach(c => {
            capItems.push({
                _id: `cap_row_${c.capabilityKey}`,
                capabilityKey: c.capabilityKey,
                isDivider: false,
                action: "toggle_live_capability",
                selected: c.isEnabled !== false,
                title: `${c.isEnabled !== false ? "🟢" : "🔴"} ${c.title}`,
                desc: `[${c.agentTarget}] ${c.capabilityKey} • Click to toggle ${c.isEnabled !== false ? "OFF" : "ON"}`
            });
        });
        return capItems;
    }

    if (mode === "brainIndex") {
        const idxItems = [
            {
                _id: "idx_back_settings",
                isDivider: false,
                action: "open_settings",
                selected: false,
                title: "← Back to Settings",
                desc: "Return to AI Settings menu"
            },
            { _id: "idx_div_top", isDivider: true }
        ];
        (aiTelemetry.liveBrainIndex || []).forEach(s => {
            idxItems.push({
                _id: `idx_row_${s.pipelineStage}`,
                isDivider: false,
                action: "none",
                selected: true,
                title: `${s.status || "🟢"} ${s.moduleTitle}`,
                desc: `${s.brainLayer} • ${s.humanSummary}`
            });
        });
        return idxItems;
    }

    let items = [];
    let saved = aiTelemetry.savedChats || [];

    if (mode === "allChats") {
        items.push({
            _id: "opt_back_from_chats",
            isDivider: false,
            action: "back_to_main",
            selected: false,
            title: "← Back to Options",
            desc: "Return to main Options menu"
        });
        items.push({ _id: "opt_div_all_chats", isDivider: true });

        if (saved.length === 0) {
            items.push({
                _id: "opt_no_saved_chats",
                isDivider: false,
                action: "none",
                selected: false,
                title: "No Previous Chats Yet",
                desc: "Start a new chat or click New Chat to archive threads"
            });
        } else {
            saved.forEach(c => {
                items.push({
                    _id: `saved_${c._id}`,
                    chatId: c._id,
                    isDivider: false,
                    action: "load_saved_chat",
                    selected: c._id === aiTelemetry.currentChatId,
                    title: `💬 ${c.title}`,
                    desc: c.desc
                });
            });
        }
        return items;
    }

    let recentSlice = saved.slice(0, 3);
    if (recentSlice.length > 0) {
        recentSlice.forEach(c => {
            items.push({
                _id: `recent_${c._id}`,
                chatId: c._id,
                isDivider: false,
                action: "load_saved_chat",
                selected: c._id === aiTelemetry.currentChatId,
                title: `💬 ${c.title}`,
                desc: c.desc
            });
        });

        if (saved.length > 3) {
            items.push({
                _id: "opt_view_more_chats",
                isDivider: false,
                action: "open_all_chats",
                selected: false,
                title: `📁 View More Chats (${saved.length - 3} more)`,
                desc: "Browse all archived diagnostic & analytics threads"
            });
        }
        items.push({ _id: "opt_div_chats", isDivider: true });
    } else {
        items.push({
            _id: "opt_no_recent",
            isDivider: false,
            action: "none",
            selected: false,
            title: "💬 No Previous Chats Saved",
            desc: "Your archived chat threads will appear here"
        });
        items.push({ _id: "opt_div_chats_empty", isDivider: true });
    }

    items.push(
        {
            _id: "opt_continue_new_tab",
            isDivider: false,
            action: "continue_in_new_tab",
            selected: false,
            title: "↗️ Continue Chat in New Tab",
            desc: "Open current page in a new browser tab with this chat & log session"
        },
        {
            _id: "opt_clear_chat",
            isDivider: false,
            action: "clear_current_chat",
            selected: false,
            title: "🗑️ Clear Current Chat",
            desc: "Archive and reset the active conversation repeater"
        },
        {
            _id: "opt_div_settings",
            isDivider: true
        },
        {
            _id: "opt_open_settings",
            isDivider: false,
            action: "open_settings",
            selected: false,
            title: "⚙️ Settings",
            desc: "Configure auto-debugger, telemetry & upcoming AI features"
        }
    );

    return items;
}

function refreshOptionsRepeater() {
    const $w = aiTelemetry.$w || hqState.$w;
    if (!$w || !$w("#geminiOptionsRep").id) return;

    let items = buildOptionsMenuItems();
    $w("#geminiOptionsRep").data = items;
    $w("#geminiOptionsRep").forEachItem(($item, itemData) => {
        paintSharedMenuRow($item, itemData, "geminiOptions");
    });
}

async function animateOptionsMenuTransition(newMode) {
    const $w = aiTelemetry.$w || hqState.$w;
    if (!$w || !$w("#geminiOptionsBox").id) {
        aiTelemetry.optionsMenuMode = newMode;
        refreshOptionsRepeater();
        return;
    }

    await $w("#geminiOptionsBox").hide("slide", { direction: "right", duration: 160 }).catch(() => {});
    aiTelemetry.optionsMenuMode = newMode;
    refreshOptionsRepeater();
    await $w("#geminiOptionsBox").show("slide", { direction: "right", duration: 180 }).catch(() => {});
}

async function handleOptionsMenuClick(itemData) {
    if (!itemData || itemData.isDivider || itemData.action === "none") return;

    switch (itemData.action) {
        case "open_settings":
            await animateOptionsMenuTransition("settings");
            break;

        case "open_all_chats":
            await animateOptionsMenuTransition("allChats");
            break;

        case "back_to_main":
            await animateOptionsMenuTransition("main");
            break;

        case "toggle_auto_diag":
            aiTelemetry.contextFlags.autoDiagnoseErrors = !aiTelemetry.contextFlags.autoDiagnoseErrors;
            refreshOptionsRepeater();
            break;

        case "toggle_persona_mode":
            aiTelemetry.activePersonaRole = aiTelemetry.activePersonaRole === "PUBLIC" ? "ADMIN" : "PUBLIC";
            refreshOptionsRepeater();
            break;

        case "open_capabilities": {
            const reg = await getBrainRegistryFromCms().catch(() => null);
            if (reg && Array.isArray(reg.capabilities)) {
                aiTelemetry.liveCapabilities = reg.capabilities;
                aiTelemetry.liveBrainIndex = reg.brainIndex || [];
            }
            await animateOptionsMenuTransition("capabilities");
            break;
        }

        case "open_brain_index": {
            const reg = await getBrainRegistryFromCms().catch(() => null);
            if (reg && Array.isArray(reg.brainIndex)) {
                aiTelemetry.liveBrainIndex = reg.brainIndex;
                aiTelemetry.liveCapabilities = reg.capabilities || [];
            }
            await animateOptionsMenuTransition("brainIndex");
            break;
        }

        case "toggle_live_capability": {
            if (!itemData.capabilityKey) break;
            const targetCap = (aiTelemetry.liveCapabilities || []).find(c => c.capabilityKey === itemData.capabilityKey);
            const nextState = targetCap ? !(targetCap.isEnabled !== false) : false;
            if (targetCap) targetCap.isEnabled = nextState;
            refreshOptionsRepeater();
            await toggleAiCapabilityInCms(itemData.capabilityKey, nextState).catch(() => {});
            break;
        }

        case "coming_soon":
            break;

        case "load_saved_chat": {
            archiveCurrentChatIfNonEmpty();
            let targetChat = (aiTelemetry.savedChats || []).find(c => c._id === itemData.chatId);
            if (targetChat && Array.isArray(targetChat.turns)) {
                aiTelemetry.currentChatId = targetChat._id;
                aiTelemetry.chatHistory = [...targetChat.turns];
                persistBuffersThrottled();
                renderGeminiChatRepeater();
            }
            closeAllGeminiSubPopups();
            break;
        }

        case "continue_in_new_tab": {
            archiveCurrentChatIfNonEmpty();
            persistBuffersThrottled();
            closeAllGeminiSubPopups();
            const gWin = /** @type {any} */ getGlobalScope();
            if (gWin && typeof gWin.open === "function") {
                gWin.open(wixLocationFrontend.url, "_blank");
            }
            break;
        }

        case "clear_current_chat": {
            archiveCurrentChatIfNonEmpty();
            aiTelemetry.currentChatId = "chat_session_" + Date.now();
            aiTelemetry.chatHistory = [];
            persistBuffersThrottled();
            renderGeminiChatRepeater();
            closeAllGeminiSubPopups();
            break;
        }
    }
}

// ==========================================
// 🪟 MAIN #geminiBox CONTROLLER & UI WIRING
// ==========================================
export async function toggleGeminiBox(forceClose = false) {
    const $w = aiTelemetry.$w || hqState.$w;
    if (!$w || !$w("#geminiBox").id) return;

    let isOpen = !$w("#geminiBox").hidden && !$w("#geminiBox").collapsed;
    if (forceClose && !isOpen) return;

    closeAllGeminiSubPopups();

    if (isOpen || forceClose) {
        await $w("#geminiBox").hide("fade", { duration: 150 }).catch(() => {});
        if ($w("#geminiBox").hidden) $w("#geminiBox").collapse();
    } else {
        renderGeminiChatRepeater();
        if ($w("#geminiBox").collapsed) $w("#geminiBox").expand();
        await $w("#geminiBox").show("fade", { duration: 150 }).catch(() => {});

        if ($w("#geminiQuickInput").id && !$w("#geminiQuickInput").hidden) {
            $w("#geminiQuickInput").focus();
        } else if ($w("#geminiInput").id) {
            $w("#geminiInput").focus();
        }
    }
}

function syncExpandableInputUI($w, textValue) {
    let val = String(textValue || "");
    if ($w("#geminiInputSizer").id) {
        $w("#geminiInputSizer").text = val || " ";
    }
    if ($w("#geminiExpandBox").id) {
        if (val.length >= QUICK_INPUT_CHAR_LIMIT || val.includes("\n")) {
            if ($w("#geminiExpandBox").collapsed) $w("#geminiExpandBox").expand();
            if ($w("#geminiExpandBox").hidden) $w("#geminiExpandBox").show();
        } else if (val.length === 0) {
            if (!$w("#geminiExpandBox").hidden) $w("#geminiExpandBox").hide();
            if (!$w("#geminiExpandBox").collapsed) $w("#geminiExpandBox").collapse();
        }
    }
}

export function initGeminiPopupUI($wContext = null) {
    const $w = $wContext || hqState.$w || aiTelemetry.$w;
    if (!$w) return;
    aiTelemetry.$w = $w;

    if (aiTelemetry.isUiWired) return;
    aiTelemetry.isUiWired = true;

    ["#geminiBox", "#geminiExpandBox"].forEach(id => {
        if ($w(id).id) {
            if (!$w(id).hidden) $w(id).hide();
            if (!$w(id).collapsed) $w(id).collapse();
        }
    });
    closeAllGeminiSubPopups();

    ["#headerButtonGemini", "#geminiButton"].forEach(btnId => {
        if ($w(btnId).id) {
            $w(btnId).onClick(() => toggleGeminiBox(false));
        }
    });

    if ($w("#geminiCloseButton").id) {
        $w("#geminiCloseButton").onClick(() => toggleGeminiBox(true));
    }

    if ($w("#geminiNewChatButton").id) {
        $w("#geminiNewChatButton").onClick(() => {
            closeAllGeminiSubPopups();
            archiveCurrentChatIfNonEmpty();
            aiTelemetry.currentChatId = "chat_session_" + Date.now();
            aiTelemetry.chatHistory = [];
            persistBuffersThrottled();
            renderGeminiChatRepeater();
        });
    }

    if ($w("#geminiOptionsButton").id) {
        $w("#geminiOptionsButton").onClick(() => {
            let currentlyOpen = isBoxOpen($w, "#geminiOptionsBox");
            setPopupVisibility($w, "#geminiModelAnchor", "#geminiModelBox", false);
            setPopupVisibility($w, "#geminiPlusAnchor", "#geminiPlusBox", false);

            if (currentlyOpen) {
                setPopupVisibility($w, "#geminiOptionsAnchor", "#geminiOptionsBox", false);
            } else {
                aiTelemetry.optionsMenuMode = "main";
                refreshOptionsRepeater();
                setPopupVisibility($w, "#geminiOptionsAnchor", "#geminiOptionsBox", true);
            }
        });
    }

    if ($w("#geminiModelButton").id) {
        $w("#geminiModelButton").onClick(() => {
            let currentlyOpen = isBoxOpen($w, "#geminiModelBox");
            setPopupVisibility($w, "#geminiPlusAnchor", "#geminiPlusBox", false);
            setPopupVisibility($w, "#geminiOptionsAnchor", "#geminiOptionsBox", false);

            if (currentlyOpen) {
                setPopupVisibility($w, "#geminiModelAnchor", "#geminiModelBox", false);
            } else {
                refreshModelRepeater();
                setPopupVisibility($w, "#geminiModelAnchor", "#geminiModelBox", true);
            }
        });
    }

    if ($w("#geminiPlusButton").id) {
        $w("#geminiPlusButton").onClick(() => {
            let currentlyOpen = isBoxOpen($w, "#geminiPlusBox");
            setPopupVisibility($w, "#geminiModelAnchor", "#geminiModelBox", false);
            setPopupVisibility($w, "#geminiOptionsAnchor", "#geminiOptionsBox", false);

            if (currentlyOpen) {
                setPopupVisibility($w, "#geminiPlusAnchor", "#geminiPlusBox", false);
            } else {
                refreshPlusRepeater();
                setPopupVisibility($w, "#geminiPlusAnchor", "#geminiPlusBox", true);
            }
        });
    }

    if ($w("#geminiModelRep").id) {
        $w("#geminiModelRep").onItemReady(($item, initialItem) => {
            if ($item("#geminiModelTitle").id) $item("#geminiModelTitle").text = initialItem.title;
            if ($item("#geminiModelDesc").id) $item("#geminiModelDesc").text = initialItem.desc;
            if ($item("#geminiModelVector").id) {
                initialItem.modelId === aiTelemetry.selectedModelId
                    ? $item("#geminiModelVector").show()
                    : $item("#geminiModelVector").hide();
            }
            if ($item("#geminiModelRepButton").id) {
                $item("#geminiModelRepButton").label = "";
                $item("#geminiModelRepButton").onClick(() => {
                    let liveItem = MODEL_OPTIONS.find(m => m._id === initialItem._id) || initialItem;
                    aiTelemetry.selectedModelId = liveItem.modelId;
                    aiTelemetry.selectedModelLabel = liveItem.shortLabel;
                    refreshModelRepeater();
                    syncGeminiHeaderTitle();
                    setPopupVisibility($w, "#geminiModelAnchor", "#geminiModelBox", false);
                });
            }
        });
        refreshModelRepeater();
        syncLiveModelCatalogFromGoogle();
    }

    if ($w("#geminiPlusRep").id) {
        $w("#geminiPlusRep").onItemReady(($item, initialItem) => {
            paintSharedMenuRow($item, initialItem, "geminiPlus");
            if ($item("#geminiPlusRepButton").id) {
                $item("#geminiPlusRepButton").onClick(() => {
                    let currentList = $w("#geminiPlusRep").data || [];
                    let liveItem = currentList.find(i => i._id === initialItem._id) || initialItem;
                    handlePlusMenuClick(liveItem);
                });
            }
        });
        refreshPlusRepeater();
    }

    if ($w("#geminiOptionsRep").id) {
        $w("#geminiOptionsRep").onItemReady(($item, initialItem) => {
            paintSharedMenuRow($item, initialItem, "geminiOptions");
            if ($item("#geminiOptionsRepButton").id) {
                $item("#geminiOptionsRepButton").onClick(() => {
                    let currentList = $w("#geminiOptionsRep").data || [];
                    let liveItem = currentList.find(i => i._id === initialItem._id) || initialItem;
                    handleOptionsMenuClick(liveItem);
                });
            }
        });
        refreshOptionsRepeater();
    }

    if ($w("#geminiRep").id) {
    $w("#geminiRep").onItemReady(($item, initialItem) => {
        const getLiveTurn = () => {
            return (aiTelemetry.chatHistory || []).find(t => String(t._id) === String(initialItem._id)) || initialItem;
        };

        paintGeminiChatRow($item, getLiveTurn());

            if ($item("#geminiUserRerunButton").id) {
                $item("#geminiUserRerunButton").onClick(() => {
                    let turn = getLiveTurn();
                    if (turn && turn.userText) {
                        if (turn.userText.includes("Bulk Seed")) {
                            launchBulkFileSeederDialog();
                        } else {
                            askSiteAi(turn.userText, aiTelemetry.contextFlags.includeCms);
                        }
                    }
                });
            }

            if ($item("#geminiUserEditButton").id) {
                $item("#geminiUserEditButton").onClick(() => {
                    let turn = getLiveTurn();
                    if (!turn || !turn.userText) return;
                    if (turn.userText.length >= QUICK_INPUT_CHAR_LIMIT && $w("#geminiInput").id) {
                        syncExpandableInputUI($w, turn.userText);
                        $w("#geminiInput").value = turn.userText;
                        $w("#geminiInput").focus();
                    } else if ($w("#geminiQuickInput").id) {
                        $w("#geminiQuickInput").value = turn.userText;
                        $w("#geminiQuickInput").focus();
                    } else if ($w("#geminiInput").id) {
                        $w("#geminiInput").value = turn.userText;
                        $w("#geminiInput").focus();
                    }
                });
            }

            if ($item("#geminiUserCopyButton").id) {
                $item("#geminiUserCopyButton").onClick(() => {
                    let turn = getLiveTurn();
                    if (turn && turn.userText) {
                        wixWindowFrontend.copyToClipboard(turn.userText).catch(() => {});
                    }
                });
            }

            if ($item("#geminiCopyCodeButton").id) {
                $item("#geminiCopyCodeButton").onClick(() => {
                    let turn = getLiveTurn();
                    if (turn && turn.aiText) {
                        let codeOnly = extractFirstCodeBlock(turn.aiText);
                        wixWindowFrontend.copyToClipboard(codeOnly).catch(() => {});
                    }
                });
            }

            if ($item("#geminiCopyAllButton").id) {
                $item("#geminiCopyAllButton").onClick(() => {
                    let turn = getLiveTurn();
                    if (turn && turn.aiText) {
                        wixWindowFrontend.copyToClipboard(turn.aiText).catch(() => {});
                    }
                });
            }

            if ($item("#geminiDeleteRowButton").id) {
                $item("#geminiDeleteRowButton").onClick(() => {
                    let turn = getLiveTurn();
                    aiTelemetry.chatHistory = aiTelemetry.chatHistory.filter(t => t._id !== turn._id);
                    persistBuffersThrottled();
                    renderGeminiChatRepeater();
                });
            }
        });
        renderGeminiChatRepeater();
    }

    const submitActivePrompt = async () => {
        closeAllGeminiSubPopups();

        let longVal = $w("#geminiInput").id ? String($w("#geminiInput").value || "").trim() : "";
        let quickVal = $w("#geminiQuickInput").id ? String($w("#geminiQuickInput").value || "").trim() : "";
        let finalPrompt = longVal || quickVal;

        if (!finalPrompt) return;

        if ($w("#geminiInput").id) $w("#geminiInput").value = "";
        if ($w("#geminiQuickInput").id) $w("#geminiQuickInput").value = "";
        syncExpandableInputUI($w, "");

        if ($w("#geminiSubmitButton").id) $w("#geminiSubmitButton").disable();
        await askSiteAi(finalPrompt, aiTelemetry.contextFlags.includeCms);
        if ($w("#geminiSubmitButton").id) $w("#geminiSubmitButton").enable();

        if ($w("#geminiQuickInput").id) $w("#geminiQuickInput").focus();
    };

    if ($w("#geminiQuickInput").id) {
        $w("#geminiQuickInput").onInput((event) => {
            let val = String(event.target.value || "");
            if (val.length >= QUICK_INPUT_CHAR_LIMIT && $w("#geminiInput").id) {
                syncExpandableInputUI($w, val);
                $w("#geminiInput").value = val;
                $w("#geminiQuickInput").value = "";
                $w("#geminiInput").focus();
            }
        });

        $w("#geminiQuickInput").onKeyPress((event) => {
            if (event.key === "Enter") {
                setTimeout(() => submitActivePrompt(), 40);
            }
        });
    }

    if ($w("#geminiInput").id) {
        $w("#geminiInput").onInput((event) => {
            let val = String(event.target.value || "");
            syncExpandableInputUI($w, val);
            if (val.length === 0 && $w("#geminiQuickInput").id) {
                $w("#geminiQuickInput").focus();
            }
        });

        $w("#geminiInput").onKeyPress((event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                setTimeout(() => submitActivePrompt(), 40);
            }
        });
    }

    if ($w("#geminiSubmitButton").id) {
        $w("#geminiSubmitButton").onClick(() => submitActivePrompt());
    }
}

// ==========================================
// 📡 FULL-SESSION CONSOLE & ERROR INTERCEPTOR
// ==========================================
export function initAiTelemetry($wContext = null) {
    if ($wContext) aiTelemetry.$w = $wContext;
    else if (hqState.$w) aiTelemetry.$w = hqState.$w;

    loadSavedBuffers();
    initGeminiPopupUI(aiTelemetry.$w);

    if (aiTelemetry.isHooked) return;
    aiTelemetry.isHooked = true;

    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;

    const pushLog = (level, args) => {
        let serializedArgs = args.map(safeSerialize);
        let flatStr = serializedArgs.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");

        let entry = {
            t: new Date().toLocaleTimeString(),
            lvl: level,
            msg: flatStr.length > 800 ? flatStr.substring(0, 800) + "...[truncated]" : flatStr
        };

        aiTelemetry.logs.push(entry);
        if (aiTelemetry.logs.length > MAX_LOG_BUFFER) aiTelemetry.logs.shift();

        if (level === "ERROR" || level === "WARN") {
            aiTelemetry.errors.push(entry);
            if (aiTelemetry.errors.length > MAX_ERROR_BUFFER) aiTelemetry.errors.shift();
        }
        syncGeminiHeaderTitle();
        persistBuffersThrottled();
    };

    console.log = (...args) => {
        pushLog("INFO", args);
        origLog.apply(console, args);
    };

    console.warn = (...args) => {
        pushLog("WARN", args);
        origWarn.apply(console, args);
    };

    console.error = (...args) => {
        pushLog("ERROR", args);
        origError.apply(console, args);

        let now = Date.now();
        if (aiTelemetry.contextFlags.autoDiagnoseErrors && (now - aiTelemetry.lastAutoDiagTime > 8000)) {
            aiTelemetry.lastAutoDiagTime = now;
            let errText = args.map(a => typeof a === "object" ? JSON.stringify(safeSerialize(a)) : String(a)).join(" ");
            if (!errText.includes("[GEMINI")) {
                triggerAutoErrorDiagnosis(errText, origLog);
            }
        }
    };

    const gScope = /** @type {any} */ getGlobalScope();
    if (gScope) {
        if (typeof gScope.addEventListener === "function") {
            gScope.addEventListener("unhandledrejection", (event) => {
                let reason = safeSerialize(event.reason);
                pushLog("ERROR", ["Unhandled Promise Rejection:", reason]);
            });
        }

        gScope.askGemini = async (question, includeAnalytics = true) => {
            origLog("🤖 [GEMINI]: Analyzing full session logs, DOM & CMS...");
            let res = await askSiteAi(question, includeAnalytics);
            origLog(`%c🤖 [GEMINI REPLY]:\n${res}`, "color: #17E6AD; font-weight: bold;");
            return res;
        };
    }

    origLog(`🧠 [AI TELEMETRY]: Armed! Tracking up to ${MAX_LOG_BUFFER} session logs + live DOM + 1CodeAndBlueprints.`);
}

const THINKING_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function startLiveThinkingTicker(aiTurnId, customSteps = null) {
    const cf = aiTelemetry.contextFlags;
    const steps = customSteps || [
        "📡 Reading live session console logs & error buffer...",
        ...(cf.includeDom ? ["🖥️ Scanning live page DOM, styles & Multi-State Boxes..."] : []),
        ...(cf.includeHqState ? ["🗂️ Inspecting Booking HQ draft sessions & module states..."] : []),
        ...(cf.includeCms ? ["🗄️ Querying scheduledJobs, packages & 1CodeAndBlueprints CMS..."] : []),
        `🧠 Connecting to Google AI (${aiTelemetry.selectedModelLabel})...`,
        `✍️ Gemini ${aiTelemetry.selectedModelLabel} is writing your response...`
    ];

    let startMs = Date.now();
    let tickCount = 0;

    const updateRowInPlace = (textStr, tagStr) => {
        const $w = aiTelemetry.$w || hqState.$w;
        const turnObj = (aiTelemetry.chatHistory || []).find(t => t._id === aiTurnId);
        if (turnObj) {
            turnObj.aiText = textStr;
            if (tagStr) turnObj.tag = tagStr;
        }
        if ($w && $w("#geminiRep").id) {
            try {
                $w("#geminiRep").forItems([aiTurnId], ($item) => {
                    if ($item("#geminiAiBox").id) {
                        if ($item("#geminiAiBox").collapsed) $item("#geminiAiBox").expand();
                        if ($item("#geminiAiBox").hidden) $item("#geminiAiBox").show();
                    }
                    if ($item("#geminiAiText").id) $item("#geminiAiText").text = textStr;
                    if (tagStr && $item("#geminiAiTag").id) $item("#geminiAiTag").text = tagStr;
                });
            } catch (e) {}
        }
    };

    const intervalId = setInterval(() => {
        tickCount++;
        const elapsedSec = Math.floor((Date.now() - startMs) / 1000);
        const spinner = THINKING_FRAMES[tickCount % THINKING_FRAMES.length];
        const stepIdx = Math.min(Math.floor(elapsedSec / 2), steps.length - 1);
        const currentStep = steps[stepIdx];

        // Show completed checklist of previous steps + active animated step!
        const completedLines = steps
            .slice(0, stepIdx)
            .map(s => `✓ ${s.replace(/^[^\s]+\s/, "")}`);

        const liveText = [
            ...completedLines,
            `${spinner} ${currentStep} (${elapsedSec}s)`
        ].join("\n");

        const liveTag = `${spinner} Gemini ${aiTelemetry.selectedModelLabel} Thinking (${elapsedSec}s)`;
        updateRowInPlace(liveText, liveTag);
    }, 350);

    return {
        stop: (finalReplyText, finalTagLabel = null) => {
            clearInterval(intervalId);
            const turnObj = (aiTelemetry.chatHistory || []).find(t => t._id === aiTurnId);
            if (turnObj) {
                turnObj.aiText = finalReplyText;
                turnObj.tag = finalTagLabel || `Gemini ${turnObj.modelLabel || aiTelemetry.selectedModelLabel} • ${turnObj.time || ""}`;
            }
            persistBuffersThrottled();
            renderGeminiChatRepeater();
        }
    };
}

async function triggerAutoErrorDiagnosis(errorString, origLog) {
    let ticker = null;
    try {
        origLog("%c🤖 [GEMINI AUTO-DEBUGGER]: Error detected! Diagnosing root cause...", "color: #FFB800; font-weight: bold;");

        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const baseId = Date.now();
        const aiTurnId = "auto_err_a_" + (baseId + 1);

        let userTurn = {
            _id: "auto_err_u_" + baseId,
            role: "user",
            time: nowTime,
            modelLabel: aiTelemetry.selectedModelLabel,
            userText: `🚨 Auto-Detected Error: ${errorString.substring(0, 180)}`,
            aiText: ""
        };

        let aiTurn = {
            _id: aiTurnId,
            role: "ai",
            time: nowTime,
            modelLabel: aiTelemetry.selectedModelLabel,
            tag: `🚨 Auto-Debugger • ${nowTime}`,
            userText: "",
            aiText: "⠋ 🚨 Auto-Debugger is inspecting stack trace & session logs (0s)..."
        };

        aiTelemetry.chatHistory.push(userTurn, aiTurn);
        renderGeminiChatRepeater();

        ticker = startLiveThinkingTicker(aiTurnId, [
            "🚨 Capturing error stack trace & console buffer...",
            "🖥️ Scanning live DOM & Multi-State Box states...",
            "📁 Cross-referencing source code in 1CodeAndBlueprints...",
            "🛠️ Generating root-cause diagnosis & fix..."
        ]);

        let payload = {
            model: aiTelemetry.selectedModelId,
            domSnapshot: scanLivePageDOM(),
            stateSnapshot: buildHqStateSnapshot(),
            errors: aiTelemetry.errors,
            logs: aiTelemetry.logs,
            chatHistory: aiTelemetry.chatHistory.slice(0, -2)
        };

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Request timed out after 25 seconds.")), 25000)
        );

        let res = await Promise.race([
            askHqCopilot(
                `An error was just logged on the site: ${errorString}. Diagnose the exact root cause using the sessionLogs, domSnapshot, hqStateSnapshot, and any matching file in 1CodeAndBlueprints, and provide the exact fix.`,
                payload,
                false
            ),
            timeoutPromise
        ]);

        let reply = (res && res.reply) ? res.reply : "Could not diagnose error.";
        if (res && Array.isArray(res.savedFiles) && res.savedFiles.length > 0) {
            aiTelemetry.lastSavedCmsTitle = res.savedFiles[0].title;
        }
        aiTelemetry.lastDiagnosis = reply;
        ticker.stop(reply, `🚨 Auto-Debugger • ${nowTime}`);

        origLog(`%c🤖 [GEMINI AUTO-DIAGNOSIS]:\n${reply}`, "background: #111; color: #17E6AD; padding: 6px; border-left: 3px solid #17E6AD;");
    } catch (e) {
        if (ticker) ticker.stop(`⚠️ Auto-Debugger Error: ${e.message || e}`);
    }
}

export async function askSiteAi(promptText, includeCmsAnalytics = true) {
    const cf = aiTelemetry.contextFlags;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const baseId = Date.now();
    const aiTurnId = "chat_a_" + (baseId + 1);

    // 1. Push User Bubble as its own Repeater Item
    let userTurn = {
        _id: "chat_u_" + baseId,
        role: "user",
        time: nowTime,
        modelLabel: aiTelemetry.selectedModelLabel,
        userText: promptText,
        aiText: ""
    };

    // 2. Push AI Reply Bubble as its own separate Repeater Item
    let aiTurn = {
        _id: aiTurnId,
        role: "ai",
        time: nowTime,
        modelLabel: aiTelemetry.selectedModelLabel,
        userText: "",
        aiText: `⠋ 📡 Reading live session console logs & error buffer... (0s)`
    };

    aiTelemetry.chatHistory.push(userTurn, aiTurn);
    renderGeminiChatRepeater();

    // 3. Start the live multi-step thinking animation inside #geminiAiText & #geminiAiTag!
    const ticker = startLiveThinkingTicker(aiTurnId);

    try {
        let payload = {
            model: aiTelemetry.selectedModelId,
            personaRole: aiTelemetry.activePersonaRole || "ADMIN",
            domSnapshot: cf.includeDom ? scanLivePageDOM() : {},
            stateSnapshot: cf.includeHqState ? buildHqStateSnapshot() : {},
            errors: aiTelemetry.errors,
            logs: cf.includeLogs ? aiTelemetry.logs : [],
            chatHistory: aiTelemetry.chatHistory.slice(0, -2)
        };

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Backend timed out after 25s. Try unchecking 'Attach Live CMS Database Digest' in the '+' menu for faster responses, or click Re-run.")), 25000)
        );

        let res = await Promise.race([
            askHqCopilot(promptText, payload, Boolean(includeCmsAnalytics && cf.includeCms)),
            timeoutPromise
        ]);

        let reply = (res && res.reply) ? res.reply : "No response received from Gemini.";

        if (res && res.modelUsed && res.modelUsed !== aiTelemetry.selectedModelId) {
            aiTelemetry.selectedModelId = res.modelUsed;
            const verMatch = String(res.modelUsed).match(/gemini-(\d+(?:\.\d+)?)/);
            const verPrefix = verMatch ? `${verMatch[1]} ` : "";
            const typeSuffix = String(res.modelUsed).includes("pro") ? "Pro" : (String(res.modelUsed).includes("lite") ? "Lite" : "Flash");
            aiTelemetry.selectedModelLabel = `${verPrefix}${typeSuffix}`;

            syncGeminiHeaderTitle();
            refreshModelRepeater();
        }

        if (res && Array.isArray(res.savedFiles) && res.savedFiles.length > 0) {
            aiTelemetry.lastSavedCmsTitle = res.savedFiles[0].title;
        }

        aiTelemetry.lastDiagnosis = reply;
        ticker.stop(reply);
        return reply;
    } catch (err) {
        const errMsg = `⚠️ Request Failed: ${err.message || err}`;
        ticker.stop(errMsg);
        return errMsg;
    }
}
