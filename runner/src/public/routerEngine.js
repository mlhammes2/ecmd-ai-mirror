// --- public/routerEngine.js ---

/**
 * ========================================================================
 * 🤖 AI CONTEXT & ARCHITECTURE NOTE
 * ========================================================================
 * FILE: public/routerEngine.js
 * PURPOSE: Master navigation, state management, history tracking, and overlays.
 * ========================================================================
 */

import wixLocationFrontend from 'wix-location-frontend';
import { initAiTelemetry, registerModuleState, registerDomElements } from 'public/aiTelemetry';
import wixWindowFrontend from 'wix-window-frontend';
import { session } from 'wix-storage';
import { APP_LOGS } from 'public/loggerConfig';
import wixAnimationsFrontend from 'wix-animations-frontend';

let $w;
let wheelSpinTimeline = null;
let hooks;
let navHistory = [];
let forwardHistory = [];
let isAnimatingMenu = false; 
let previousGlobalState = null;

const DEBUG_MODE = APP_LOGS.MASTER_SWITCH && APP_LOGS.ROUTER;

const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [ROUTER_ENGINE]: ${msg}`, data) : console.log(`📌 [ROUTER_ENGINE]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [ROUTER_ENGINE]: ${msg}`, data) : console.warn(`📌 [ROUTER_ENGINE]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [ROUTER_ENGINE]: ${msg}`, data) : console.error(`📌 [ROUTER_ENGINE]: ${msg}`); }
};

registerModuleState("routerEngine", () => ({
    currentBaseRoute: $w ? getCurrentBaseRoute($w) : null,
    previousGlobalState,
    isRouterBooting,
    isAnimatingMenu,
    navHistoryCount: (navHistory || []).length,
    navHistory: (navHistory || []).slice(-10),
    forwardHistoryCount: (forwardHistory || []).length,
    returnBreadcrumbInSession: session.getItem("returnBreadcrumb") || null,
    pendingLoaderRouteInSession: session.getItem("pendingLoaderRoute") || null
}));

registerDomElements({
    msb: ["#msbProfile", "#msbLightbox", "#msbPrompts", "#msbPopUp", "#msbMessages", "#msbFooter", "#msbSideMenu", "#msbJobs", "#msbCustomer", "#msbOffice"],
    boxes: ["#siteMenu", "#lightboxBoxG", "#lightboxBackground", "#lightbox2ClickBackground", "#pageLoaderBox", "#sidePackagesButtons", "#trackerFooter"]
});

if (DEBUG_MODE) console.log("%c🧭 [ROUTER ENGINE] DEBUG MODE IS ACTIVE", "background: #000; color: #E031FF; font-size: 14px; font-weight: bold; padding: 4px;");

const STRINGS = {
    ROUTES: {
        SITE_MENU: "siteMenu",
        PKG: "detailingPackages",
        GARAGE: "garageProfileState",
        CART: "cartProfileState", 
        PROFILE: "profileProfileState",
        ADD_CONTACT: "addContactLightboxState",   
        ADD_LOCATION: "addLocationLightboxState",
        PAYMENT: "paymentPortalProfileState" 
    }
};

const PAGES = {
    PACKAGES: { url: "/",         anchor: "#packageRep" },
    CHECKOUT: { url: "/checkout", anchor: "#msbProfile" },
    ACCOUNT:  { url: "/account",  anchor: "#msbProfile" },
    PAYMENT:  { url: "/payment",  anchor: "#msbProfile" },
    REGISTER: { url: "/register", anchor: "#msbProfile" },
    DETAILER: { url: "/detailer", anchor: "#msbJobs" },
    BOOKING_HQ: { url: "/booking-hq", anchor: "#msbCustomer" },
    TERMS:    { url: "/terms-of-service", anchor: "" },
    PRIVACY:  { url: "/privacy-policy", anchor: "" }
};

const ROUTE_MAP = {
    // --- DETAILER PORTAL (/detailer) ---
    "customerJobState": { page: PAGES.DETAILER, steps: [{ msb: "#msbJobs", state: "customerJobState" }] },
    "detailerJobState": { page: PAGES.DETAILER, steps: [{ msb: "#msbJobs", state: "detailerJobState" }] },

    // --- BOOKING HQ (/booking-hq) ---
    "bCalendar":        { page: PAGES.BOOKING_HQ, steps: [{ msb: "#msbCustomer", state: "bCalendar" }] },

    // --- PACKAGES PAGE (/) ---
    "detailingPackages": { page: PAGES.PACKAGES, steps: [{ isStandalone: true, state: "detailingPackages" }] },

    // --- CHECKOUT & UPCOMING PAGE (/checkout) ---
    "cartProfileState":             { page: PAGES.CHECKOUT, steps: [{ msb: "#msbProfile", state: "cartProfileState" }] },
    "cartEditsProfileState":        { page: PAGES.CHECKOUT, steps: [{ msb: "#msbProfile", state: "cartEditsProfileState" }] },
    "calendarProfileState":         { page: PAGES.CHECKOUT, steps: [{ msb: "#msbProfile", state: "calendarProfileState" }] },
    "confirmBookingProfileState":   { page: PAGES.CHECKOUT, steps: [{ msb: "#msbProfile", state: "confirmBookingProfileState" }] },
    "upcomingProfileState":         { page: PAGES.CHECKOUT, steps: [{ msb: "#msbProfile", state: "upcomingProfileState" }] },
    "detailInfoProfileState":       { page: PAGES.CHECKOUT, steps: [{ msb: "#msbProfile", state: "detailInfoProfileState" }] },
    "completedProfileState":        { page: PAGES.CHECKOUT, steps: [{ msb: "#msbProfile", state: "completedProfileState" }] },

    // --- ACCOUNT PAGE (/account) ---
    "contactLocationsProfileState": { page: PAGES.ACCOUNT, steps: [{ msb: "#msbProfile", state: "contactLocationsProfileState" }] },
    "profileProfileState":          { page: PAGES.ACCOUNT, steps: [{ msb: "#msbProfile", state: "profileProfileState" }] },
    "garageProfileState":           { page: PAGES.ACCOUNT, steps: [{ msb: "#msbProfile", state: "garageProfileState" }] },
    "loginSecurityProfileState":    { page: PAGES.ACCOUNT, steps: [{ msb: "#msbProfile", state: "loginSecurityProfileState" }] },
    "paymentMethodsProfileState":   { page: PAGES.ACCOUNT, steps: [{ msb: "#msbProfile", state: "paymentMethodsProfileState" }] },
    "subscriptionsProfileState":    { page: PAGES.ACCOUNT, steps: [{ msb: "#msbProfile", state: "subscriptionsProfileState" }] },
    "notificationsProfileState":    { page: PAGES.ACCOUNT, steps: [{ msb: "#msbProfile", state: "notificationsProfileState" }] },
    "giftCardsProfileState":        { page: PAGES.ACCOUNT, steps: [{ msb: "#msbProfile", state: "giftCardsProfileState" }] },
    "customerServiceProfileState":  { page: PAGES.ACCOUNT, steps: [{ msb: "#msbProfile", state: "customerServiceProfileState" }] },
    "careerProfileState":           { page: PAGES.ACCOUNT, steps: [{ msb: "#msbProfile", state: "careerProfileState" }] },

    // --- PAYMENT PAGE (/payment) ---
    "paymentPortalProfileState":    { page: PAGES.PAYMENT, steps: [{ msb: "#msbProfile", state: "paymentPortalProfileState" }] },

    "registryProfileState":         { page: PAGES.REGISTER, steps: [{ msb: "#msbProfile", state: "registryProfileState" }] },

    // --- LEGAL PAGES ---
    "termsProfileState":            { page: PAGES.TERMS, steps: [{ isStandalone: true, state: "termsProfileState" }] },
    "privacyProfileState":          { page: PAGES.PRIVACY, steps: [{ isStandalone: true, state: "privacyProfileState" }] },

    // --- LIGHTBOXES, POPUPS & PROMPTS (Page-Agnostic: Opens on current page!) ---
    "addContactLightboxState":        { steps: [{ msb: "#msbLightbox", state: "addContactLightboxState", isLightbox: true }] },
    "addLocationLightboxState":       { steps: [{ msb: "#msbLightbox", state: "addLocationLightboxState", isLightbox: true }] },
    "additionalInfoLightboxState":    { steps: [{ msb: "#msbLightbox", state: "additionalInfoLightboxState", isLightbox: true }] },
    "detailHistoryLightboxState":     { steps: [{ msb: "#msbLightbox", state: "detailHistoryLightboxState", isLightbox: true }] },
    "addVehicleLightboxState":        { steps: [{ msb: "#msbLightbox", state: "addVehicleLightboxState", isLightbox: true }] },
    "packageEditsLightboxState":      { steps: [{ msb: "#msbLightbox", state: "packageEditsLightboxState", isLightbox: true }] },
    "whatsIncludedLightboxState":     { steps: [{ msb: "#msbLightbox", state: "whatsIncludedLightboxState", isLightbox: true }] },
    "summaryLightboxState":           { steps: [{ msb: "#msbLightbox", state: "summaryLightboxState", isLightbox: true }] },
    "whatsIncludedInfoLightboxState": { steps: [{ msb: "#msbLightbox", state: "whatsIncludedInfoLightboxState", isLightbox: true }] },
    "cancelConfirmPopupState":        { steps: [{ msb: "#msbPopUp", state: "cancelConfirmPopupState", isPopup: true }] },
    "deleteConfirmPopupState":        { steps: [{ msb: "#msbPopUp", state: "deleteConfirmPopupState", isPopup: true }] },
    "notesVehiclePopupState":         { steps: [{ msb: "#msbPopUp", state: "notesVehiclePopupState", isPopup: true }] },
    "jobInstructionsPopupState":      { steps: [{ msb: "#msbPopUp", state: "jobInstructionsPopupState", isPopup: true }] },
    "loginPromptsState":              { steps: [{ msb: "#msbPrompts", state: "loginPromptsState", isPrompt: true }] },
    "detailerDropboxPromptsState":    { steps: [{ msb: "#msbPrompts", state: "detailerDropboxPromptsState", isPrompt: true }] },
    "packagesInfoPromptsState":       { steps: [{ msb: "#msbPrompts", state: "packagesInfoPromptsState", isPrompt: true }] },
    "successMessageState":            { steps: [{ msb: "#msbMessages", state: "successMessageState", isMessage: true }] },
    "errorMessageState":              { steps: [{ msb: "#msbMessages", state: "errorMessageState", isMessage: true }] },
    "siteMenu":                       { steps: [{ customBox: "#siteMenu", isLightbox: true }] }
};

const asyncSafeDOMUpdate = (callback, delay = 50) => new Promise(resolve => setTimeout(() => { callback(); resolve(); }, delay));

// 💥 THE UNIVERSAL PRE-FLIGHT ENGINE 💥
async function executePreRouteLogic(targetState) {
    let safeState = targetState.toLowerCase();
    let tasks = [];

    const requiresProfileData = [
        "upcomingprofilestate",
        "completedprofilestate",
        "profileprofilestate",
        "calendarprofilestate",
        "confirmbookingprofilestate",
        "cartprofilestate",
        "carteditsprofilestate",
        "contactlocationsprofilestate"
    ];

    if (requiresProfileData.includes(safeState) && hooks.preloadAllProfileData) {
        tasks.push(hooks.preloadAllProfileData());
    }

    if (safeState === "carteditsprofilestate" && hooks.restoreCartEditsSession) {
        tasks.push(hooks.restoreCartEditsSession());
    } else if (safeState === "detailinfoprofilestate" && hooks.restoreActiveJob) {
        tasks.push(hooks.restoreActiveJob());
    } else if (safeState === "calendarprofilestate" || safeState === "confirmbookingprofilestate") {
        if (hooks.loadCartData) tasks.push(hooks.loadCartData());
        if (safeState === "calendarprofilestate" && hooks.loadCalendarCartSlider) {
            tasks.push(hooks.loadCalendarCartSlider());
        }
    } else if (safeState === "cartprofilestate" && hooks.loadCartData) {
        tasks.push(hooks.loadCartData());
    } else if (safeState === "paymentportalprofilestate" && hooks.loadPaymentPortalData) {
        tasks.push(hooks.loadPaymentPortalData());
    } else if (safeState === "garageprofilestate" && hooks.loadGarageData) {
        tasks.push(hooks.loadGarageData());
    } else if (safeState === "loginsecurityprofilestate" && hooks.loadSecurityData) {
        tasks.push(hooks.loadSecurityData());
    }

    if (safeState === "contactlocationsprofilestate" && hooks.loadContactLocationData) {
        tasks.push(hooks.loadContactLocationData());
    }

    if (tasks.length > 0) {
        await Promise.all(tasks);
    }
}

const overlayHideTokens = {};

const toggleOverlays = (ids, action = "hide", effect = "fade", duration = 200) => {
    ids.forEach(id => {
        if ($w(id).id) {
            if (action === "hide") {
                const token = (overlayHideTokens[id] || 0) + 1;
                overlayHideTokens[id] = token;

                if (!$w(id).hidden) {
                    const finalizeHide = () => {
                        if (overlayHideTokens[id] === token && $w(id).hidden) {
                            $w(id).collapse();
                        }
                    };
                    if (effect === "none") {
                        $w(id).hide().then(finalizeHide).catch(() => {}); 
                    } else {
                        $w(id).hide(effect, { duration }).then(finalizeHide).catch(() => {});
                    }
                } else if (!$w(id).collapsed) {
                    $w(id).collapse();
                }
            } else if (action === "show") {
                // Invalidate any pending hide/collapse callback for this element!
                overlayHideTokens[id] = (overlayHideTokens[id] || 0) + 1;
                if ($w(id).collapsed) $w(id).expand();
                if ($w(id).hidden) {
                    $w(id).show(effect, { duration }).catch(() => {});
                }
            }
        }
    });
};

function pageHasState($wContext, msbSelector, targetStateId) {
    if (!msbSelector) return true;
    let msbEl = $wContext(msbSelector);
    if (!msbEl.id || !msbEl.states) return false;
    return msbEl.states.some(s => s.id === targetStateId);
}

function getCurrentBaseRoute($wContext) {
    if ($wContext("#msbCustomer").id && $wContext("#msbCustomer").currentState) {
        return $wContext("#msbCustomer").currentState.id;
    }
    if ($wContext("#msbJobs").id && $wContext("#msbJobs").currentState) {
        return $wContext("#msbJobs").currentState.id;
    }
    if ($wContext("#msbProfile").id && $wContext("#msbProfile").currentState) {
        return $wContext("#msbProfile").currentState.id;
    }
    if ($wContext("#packageRep").id) {
        return "detailingPackages";
    }
    
    let path = wixLocationFrontend.path[0];
    if (path === "terms-of-service") return "termsProfileState";
    if (path === "privacy-policy") return "privacyProfileState";
    
    return "detailingPackages";
}

function saveNavHistory() { 
    session.setItem("ecmd_navHistory", JSON.stringify(navHistory)); 
    session.setItem("ecmd_forwardHistory", JSON.stringify(forwardHistory));
}

function loadNavHistory() {
    let saved = session.getItem("ecmd_navHistory");
    if (saved) { try { navHistory = JSON.parse(saved); } catch (e) { navHistory = []; } }
    let savedFwd = session.getItem("ecmd_forwardHistory");
    if (savedFwd) { try { forwardHistory = JSON.parse(savedFwd); } catch (e) { forwardHistory = []; } } 
}

export function resetHeaderMenuButton($wContext) {
    if ($wContext("#headerButtonMenu").id) $wContext("#headerButtonMenu").enable();
}

export function initRouterEngine(wixContext, providedHooks) {
    logger.info("Initializing Router Engine...");
    $w = wixContext; hooks = providedHooks || {};
    initAiTelemetry($w);
    loadNavHistory(); initMasterRouter(); initBackButton(); initGlobalButtons(); initOverlayCloseButtons($w); 
}

export async function openOverlay($wContext, overlayType, targetState = null) {
    logger.info(`Opening Overlay: ${overlayType} | Target State: ${targetState}`);
    const safeShow = (id) => { if ($wContext(id).id) { $wContext(id).expand(); $wContext(id).show("fade", { duration: 200 }).catch(() => {}); } };

    switch (overlayType) {
        case "lightbox":
            safeShow("#lightboxBoxG"); safeShow("#lightboxBackground");
            if (targetState && $wContext("#msbLightbox").id) await $wContext("#msbLightbox").changeState(targetState);
            safeShow("#msbLightbox"); break;
        case "prompt":
            safeShow("#lightboxBoxG"); safeShow("#lightboxBackground"); safeShow("#lightbox2ClickBackground");
            if (targetState && $wContext("#msbPrompts").id) await $wContext("#msbPrompts").changeState(targetState);
            safeShow("#msbPrompts"); break;
        case "popup":
            safeShow("#lightboxBoxG"); safeShow("#lightboxBackground"); safeShow("#lightbox2ClickBackground");
            if (targetState && $wContext("#msbPopUp").id) await $wContext("#msbPopUp").changeState(targetState);
            safeShow("#msbPopUp"); break;
        case "message":
            safeShow("#lightboxBoxG"); safeShow("#lightboxBackground"); safeShow("#lightbox2ClickBackground");
            if (targetState && $wContext("#msbMessages").id) await $wContext("#msbMessages").changeState(targetState);
            safeShow("#msbMessages"); break;
    }
}

export function closeAllOverlays($wContext, preventRouteSync = false) {
    logger.info("Closing all Overlays...");
    
    toggleOverlays([
        "#lightboxBoxG", "#msbLightbox", "#lightboxBackground", 
        "#msbPrompts", "#lightbox2ClickBackground", "#msbPopUp", "#msbMessages",
        "#addOnBoxI", "#addOnBoxE", "#tabMenuBox", "#hqCalendarMenuBox"
    ], "hide", "fade", 200);

    if ($wContext("#vehicleSelectBox").id && !$wContext("#vehicleSelectBox").hidden) {
        $wContext("#vehicleSelectBox").hide("fade", { duration: 150 });
    }

    resetHeaderMenuButton($wContext);

    if ($wContext("#siteMenu").id && !$wContext("#siteMenu").hidden && !isAnimatingMenu) {
        toggleSiteMenu(true);
    }

    if (hooks.closeCustomLightbox) hooks.closeCustomLightbox($wContext);

    if (typeof wixLocationFrontend !== "undefined") {
        if (wixLocationFrontend.query.menu) wixLocationFrontend.queryParams.remove(["menu"]); 
        if (!preventRouteSync) wixLocationFrontend.queryParams.add({ "route": getCurrentBaseRoute($wContext) });
    }
}

export async function closeTopOverlay($wContext) {
    if (isAnimatingMenu) return;
    logger.info("Closing Top Overlay...");
    const isShown = (id) => $wContext(id).id && !$wContext(id).hidden && !$wContext(id).collapsed;

    if (isShown("#msbMessages")) {
        await $wContext("#msbMessages").hide("fade", { duration: 150 }); $wContext("#msbMessages").collapse();
        if (!isShown("#msbPrompts") && !isShown("#msbPopUp")) { if ($wContext("#lightbox2ClickBackground").id) $wContext("#lightbox2ClickBackground").hide("fade", { duration: 150 }); }
        checkAndCleanBasePlate($wContext); return;
    }
    if (isShown("#msbPopUp") || isShown("#msbPrompts")) {
        let hidePromises = [];
        if (isShown("#msbPopUp")) hidePromises.push($wContext("#msbPopUp").hide("fade", { duration: 150 }).then(() => { if ($wContext("#msbPopUp").hidden) $wContext("#msbPopUp").collapse(); }));
        if (isShown("#msbPrompts")) hidePromises.push($wContext("#msbPrompts").hide("fade", { duration: 150 }).then(() => { if ($wContext("#msbPrompts").hidden) $wContext("#msbPrompts").collapse(); }));
        if ($wContext("#lightbox2ClickBackground").id) hidePromises.push($wContext("#lightbox2ClickBackground").hide("fade", { duration: 150 }));
        await Promise.all(hidePromises); checkAndCleanBasePlate($wContext); return;
    }
    if (isShown("#siteMenu")) {
        await toggleSiteMenu(true);
        return;
    }
    if (isShown("#msbLightbox")) { closeAllOverlays($wContext); return; }
    closeAllOverlays($wContext);
}

function checkAndCleanBasePlate($wContext) {
    const isShown = (id) => $wContext(id).id && !$wContext(id).hidden && !$wContext(id).collapsed;
    if (!isShown("#msbLightbox") && !isShown("#msbPrompts") && !isShown("#msbPopUp") && !isShown("#msbMessages") && !isShown("#siteMenu")) {
        toggleOverlays(["#lightboxBackground", "#lightboxBoxG"], "hide", "fade", 150);
        if (hooks.closeCustomLightbox) hooks.closeCustomLightbox($wContext);
    }
}

export async function toggleSiteMenu(forceClose = false) {
    if (!$w("#siteMenu").id) return;

    let isMenuOpen = !$w("#siteMenu").hidden && !$w("#siteMenu").collapsed;
    if (forceClose && !isMenuOpen) return;

    if (isAnimatingMenu && !forceClose) return;
    isAnimatingMenu = true;

    try {
        if (isMenuOpen || forceClose) {
            resetHeaderMenuButton($w);
            toggleOverlays(["#lightboxBackground"], "hide", "fade", 150);
            await $w("#siteMenu").hide("slide", { direction: "right", duration: 250 });
            $w("#siteMenu").collapse();
            checkAndCleanBasePlate($w);
        } else {
            await closeSideMenu();

            toggleOverlays(["#lightboxBackground"], "show", "fade", 150);

            await $w("#siteMenu").expand();
            await $w("#siteMenu").show("slide", { direction: "right", duration: 300 });
        }
    } finally {
        isAnimatingMenu = false;
    }
}

let loaderTextTimers = [];

const ROUTE_PROGRESS_STEPS = {
    detailingpackages: ["Loading detailing packages...", "Configuring service options...", "Almost ready..."],
    cartprofilestate: ["Opening your cart...", "Syncing selected packages...", "Calculating totals..."],
    carteditsprofilestate: ["Loading package details...", "Syncing vehicles & locations...", "Preparing editor..."],
    calendarprofilestate: ["Loading booking calendar...", "Checking detailer availability...", "Preparing open time slots..."],
    confirmbookingprofilestate: ["Verifying selected time slots...", "Preparing booking summary...", "Almost ready..."],
    upcomingprofilestate: ["Accessing your bookings...", "Syncing upcoming appointments...", "Almost ready..."],
    completedprofilestate: ["Loading service history...", "Syncing completed details...", "Almost ready..."],
    detailinfoprofilestate: ["Loading appointment details...", "Syncing vehicle & location info...", "Almost ready..."],
    garageprofilestate: ["Opening your garage...", "Loading saved vehicles...", "Finalizing view..."],
    profileprofilestate: ["Loading your account...", "Syncing profile settings...", "Almost ready..."],
    contactlocationsprofilestate: ["Loading contacts & locations...", "Syncing saved addresses...", "Almost ready..."],
    loginsecurityprofilestate: ["Verifying security credentials...", "Loading account settings...", "Almost ready..."],
    paymentportalprofilestate: ["Initializing secure checkout...", "Connecting payment gateway...", "Almost ready..."],
    registryprofilestate: ["Preparing member registration...", "Loading form...", "Almost ready..."],
    default: ["Preparing page...", "Syncing your account data...", "Almost ready..."]
};

export function showPageLoader(targetRoute = "", customContext = null) {
    let ctx = customContext || $w;
    if (!ctx || !ctx("#pageLoaderBox").id) return;

    loaderTextTimers.forEach(t => clearTimeout(t));
    loaderTextTimers = [];

    let cleanKey = String(targetRoute || "").toLowerCase().trim();
    let steps = ROUTE_PROGRESS_STEPS[cleanKey] || ROUTE_PROGRESS_STEPS.default;

    if (ctx("#pageLoaderText").id) {
        ctx("#pageLoaderText").text = steps[0];
        if (steps[1]) {
            loaderTextTimers.push(setTimeout(() => {
                if (ctx("#pageLoaderText").id) ctx("#pageLoaderText").text = steps[1];
            }, 900));
        }
        if (steps[2]) {
            loaderTextTimers.push(setTimeout(() => {
                if (ctx("#pageLoaderText").id) ctx("#pageLoaderText").text = steps[2];
            }, 2000));
        }
    }

    if (typeof ctx("#pageLoaderBox").expand === "function") {
        ctx("#pageLoaderBox").expand();
    }
    if (typeof ctx("#pageLoaderBox").show === "function" && ctx("#pageLoaderBox").hidden) {
        ctx("#pageLoaderBox").show("fade", { duration: 100 }).catch(() => {});
    }

    if (ctx("#pageLoaderWheel").id) {
        try {
            wheelSpinTimeline = wixAnimationsFrontend.timeline({ repeat: -1 });
            wheelSpinTimeline.add(ctx("#pageLoaderWheel"), { rotate: 360, duration: 1600, easing: "easeLinear" });
            wheelSpinTimeline.play();
        } catch (e) {}
    }
}

export function hidePageLoader(customContext = null) {
    let ctx = customContext || $w;
    loaderTextTimers.forEach(t => clearTimeout(t));
    loaderTextTimers = [];

    if (wheelSpinTimeline) {
        try { wheelSpinTimeline.pause(); } catch (e) {}
        wheelSpinTimeline = null;
    }

    if (ctx && ctx("#pageLoaderBox").id) {
        if (typeof ctx("#pageLoaderBox").hide === "function" && !ctx("#pageLoaderBox").hidden) {
            ctx("#pageLoaderBox").hide("fade", { duration: 180 }).then(() => {
                if (typeof ctx("#pageLoaderBox").collapse === "function") ctx("#pageLoaderBox").collapse();
            }).catch(() => {});
        } else if (typeof ctx("#pageLoaderBox").collapse === "function") {
            ctx("#pageLoaderBox").collapse();
        }
    }
}

export async function smartGoTo(targetDestination, isInitialLoad = false) {
    if (targetDestination === STRINGS.ROUTES.SITE_MENU) {
        await toggleSiteMenu();
        return;
    }

    if ($w("#siteMenu").id && !$w("#siteMenu").hidden) {
        await toggleSiteMenu(true);
    }

    let routeConfig = ROUTE_MAP[targetDestination];

    if (routeConfig && routeConfig.page) {
        let primaryStep = routeConfig.steps[0];
        let canStayOnCurrentPage = false;

        if (targetDestination === "detailingPackages") {
            canStayOnCurrentPage = Boolean($w("#packageRep").id);
        } else if (primaryStep && primaryStep.msb) {
            canStayOnCurrentPage = pageHasState($w, primaryStep.msb, primaryStep.state);
        }

        if (!canStayOnCurrentPage) {
            if (!isInitialLoad) {
                let currentRoute = getCurrentBaseRoute($w);
                navHistory.push({ msb: "#msbProfile", state: currentRoute, route: currentRoute });
                forwardHistory = [];
                saveNavHistory();
            }
            logger.info(`🌐 [CROSS-PAGE ROUTE]: Redirecting to ${routeConfig.page.url}?route=${targetDestination}`);
            session.setItem("pendingLoaderRoute", targetDestination);
            showPageLoader(targetDestination, $w);
            await new Promise(resolve => setTimeout(resolve, 80));
            if (typeof wixLocationFrontend !== "undefined") {
                let queryStr = targetDestination === "detailingPackages" ? "" : `?route=${targetDestination}`;
                wixLocationFrontend.to(`${routeConfig.page.url}${queryStr}`);
            }
            return; 
        }
    }

    logger.info(`Routing to: ${targetDestination}`);
    
    let path = routeConfig ? routeConfig.steps : null;

    if (!path && $w("#msbProfile").id) {
        let nestedStates = $w("#msbProfile").states || [];
        if (nestedStates.some(s => s.id === targetDestination)) path = [{ msb: "#msbProfile", state: targetDestination }];
    }
    if (!path && $w("#msbLightbox").id) {
        let lbStates = $w("#msbLightbox").states || [];
        if (lbStates.some(s => s.id === targetDestination)) path = [{ msb: "#msbLightbox", state: targetDestination, isLightbox: true }];
    }
    if (!path && $w("#msbPrompts").id) {
        let promptStates = $w("#msbPrompts").states || [];
        if (promptStates.some(s => s.id === targetDestination)) path = [{ msb: "#msbPrompts", state: targetDestination, isPrompt: true }];
    }
    if (!path && $w("#msbPopUp").id) {
        let popupStates = $w("#msbPopUp").states || [];
        if (popupStates.some(s => s.id === targetDestination)) path = [{ msb: "#msbPopUp", state: targetDestination, isPopup: true }];
    }
    if (!path && $w("#msbCustomer").id) {
        let customerStates = $w("#msbCustomer").states || [];
        if (customerStates.some(s => s.id === targetDestination)) path = [{ msb: "#msbCustomer", state: targetDestination }];
    }
    if (!path && $w("#msbOffice").id) {
        let officeStates = $w("#msbOffice").states || [];
        if (officeStates.some(s => s.id === targetDestination)) {
            $w("#msbOffice").changeState(targetDestination);
            $w("#msbOffice").expand();
            
            if ($w("#officeBox").id) {
                $w("#officeBox").expand();
                $w("#officeBox").show();
            }
            
            toggleOverlays(["#lightboxBackground"], "show", "fade", 200);
            return;
        }
    }

    if (!path) { logger.warn(`Route not found anywhere for: ${targetDestination}`); return; }

    let isLightboxRoute = false; let isPromptRoute = false; let isPopupRoute = false; let isMessageRoute = false; let customBoxToShow = null; 
    let executionPath = [...path].reverse(); let stateChangePromises = [];
    
    for (let step of executionPath) {
        if (step.isStandalone) {
            await executePreRouteLogic(step.state);
            updateGlobalUI(step.state);
            continue;
        }
        if (step.customBox) { customBoxToShow = step.customBox; } 
        else if ($w(step.msb).id) {
            let currentId = $w(step.msb).currentState ? $w(step.msb).currentState.id : null;
            if (currentId !== step.state || isInitialLoad) {
                if (!step.isLightbox && !step.isPrompt && !step.isPopup && !step.isMessage) {
                    if (!isInitialLoad && currentId !== step.state) {
                        let target = step.state;
                        let currentRoute = getCurrentBaseRoute($w);
                        
                        logger.info(`🔍 [HISTORY CHECK]: Routing to '${target}'. Current Route is '${currentRoute}'.`);
                        
                        let matchIndex = navHistory.findIndex(h => h.state === target || h.route === target);
                        if (matchIndex !== -1) {
                            navHistory = navHistory.slice(0, matchIndex);
                        } else {
                            navHistory.push({ msb: step.msb, state: currentId, route: currentRoute });
                        }
                        
                        forwardHistory = []; 
                        saveNavHistory();
                    }
                }

                if (!step.isLightbox && !step.isPrompt && !step.isPopup && !step.isMessage) {
                    await executePreRouteLogic(step.state);
                }

                if (currentId !== step.state) {
                    stateChangePromises.push($w(step.msb).changeState(step.state));
                }
            }
            if (!step.isLightbox && !step.isPrompt && !step.isPopup && !step.isMessage) { 
                $w(step.msb).expand(); $w(step.msb).show(); 
            }
        }
        
        if (step.isLightbox) isLightboxRoute = true;
        if (step.isPrompt) isPromptRoute = true; 
        if (step.isPopup) isPopupRoute = true;       
        if (step.isMessage) isMessageRoute = true;   
    }

    if (stateChangePromises.length > 0 && !isLightboxRoute && !isPromptRoute && !isPopupRoute && !isMessageRoute) {
        let windowInfo = await wixWindowFrontend.getBoundingRect();
        if (windowInfo.scroll.y > 150) {
            await wixWindowFrontend.scrollTo(0, 0, { scrollAnimation: false }); 
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    if (stateChangePromises.length > 0) await Promise.all(stateChangePromises);
    
    let isSiteMenuOpen = $w("#siteMenu").id && !$w("#siteMenu").hidden && !isAnimatingMenu;
    let isMsbSideMenuOpen = $w("#msbSideMenu").id && !$w("#msbSideMenu").hidden;

    if (isMessageRoute) toggleOverlays(["#msbMessages"], "show"); else toggleOverlays(["#msbMessages"], "hide", "fade", 150);
    if (isPopupRoute) toggleOverlays(["#msbPopUp"], "show"); else if (!isMessageRoute) toggleOverlays(["#msbPopUp"], "hide", "fade", 150);
    if (isPromptRoute) toggleOverlays(["#msbPrompts"], "show"); else if (!isPopupRoute && !isMessageRoute) toggleOverlays(["#msbPrompts"], "hide", "fade", 150);
    
    if (isLightboxRoute) {
        if (customBoxToShow) {
            if ($w(customBoxToShow).id && $w(customBoxToShow).hidden) { $w(customBoxToShow).expand(); $w(customBoxToShow).show("slide", { direction: "right", duration: 400 }); }
        } else {
            if ($w("#msbLightbox").id) {
                if (targetDestination === STRINGS.ROUTES.ADD_CONTACT || targetDestination === STRINGS.ROUTES.ADD_LOCATION) asyncSafeDOMUpdate(() => { if (hooks.loadEditingAddress) hooks.loadEditingAddress(); }, 150); 
                if ($w("#msbLightbox").hidden) { $w("#msbLightbox").expand(); $w("#msbLightbox").show("slide", { direction: "bottom", duration: 400 }); }
            }
        }
    } else if (!isPromptRoute && !isPopupRoute && !isMessageRoute) {
        toggleOverlays(["#msbLightbox"], "hide", "none");
    }

    if (isPromptRoute || isPopupRoute || isMessageRoute) {
        toggleOverlays(["#lightbox2ClickBackground"], "show"); 
    } else {
        toggleOverlays(["#lightbox2ClickBackground"], "hide", "fade", 150);
    }

    let needsCenterModalBox = isLightboxRoute || isPromptRoute || isPopupRoute || isMessageRoute;
    if (needsCenterModalBox && !customBoxToShow) {
        toggleOverlays(["#lightboxBoxG"], "show");
    } else {
        toggleOverlays(["#lightboxBoxG"], "hide", "fade", 150);
    }

    let keepBackdropOpen = needsCenterModalBox || isSiteMenuOpen || isMsbSideMenuOpen;
    if (keepBackdropOpen) {
        toggleOverlays(["#lightboxBackground"], "show");
    } else {
        toggleOverlays(["#lightboxBackground"], "hide", "fade", 150);
    }
}

export async function routeFromMenu(targetRoute) {
    if (String(targetRoute || "").startsWith("/") || targetRoute === "gemini" || targetRoute === "geminiPageState") {
        const destUrl = String(targetRoute || "").startsWith("/") ? String(targetRoute) : "/gemini";
        logger.info(`🚀 [ROUTE_FROM_MENU]: Closing #siteMenu & navigating directly to ${destUrl}`);
        isAnimatingMenu = false;
        if ($w("#siteMenu").id) {
            $w("#siteMenu").hide();
            $w("#siteMenu").collapse();
        }
        if ($w("#lightboxBackground").id) {
            $w("#lightboxBackground").hide();
            $w("#lightboxBackground").collapse();
        }
        showPageLoader(destUrl, $w);
        wixLocationFrontend.to(destUrl);
        return;
    }

    let isLightboxRoute = false;
    if (ROUTE_MAP[targetRoute]) {
        isLightboxRoute = ROUTE_MAP[targetRoute].steps.some(step => step.isLightbox || step.isPrompt);
    } else if ($w("#msbLightbox").id) {
        let lbStates = $w("#msbLightbox").states || [];
        isLightboxRoute = lbStates.some(s => s.id === targetRoute);
    }

    await toggleSiteMenu(true);
    if (!isLightboxRoute) closeAllOverlays($w, true);
    smartGoTo(targetRoute);
}

let isRouterBooting = true;

function initMasterRouter() {
    logger.info("🟢 [ROUTER BOOT]: initMasterRouter started.");
    isRouterBooting = true; 

    ["#msbLightbox", "#msbPrompts", "#msbPopUp", "#msbMessages"].forEach(id => {
        if ($w(id).id && $w(id).hidden && !$w(id).collapsed) $w(id).collapse();
    });

    let initialQuery = wixLocationFrontend.query;

    if (initialQuery.route && $w("#msbProfile").id && pageHasState($w, "#msbProfile", initialQuery.route)) {
        if ($w("#msbProfile").currentState.id !== initialQuery.route) {
            $w("#msbProfile").changeState(initialQuery.route).catch(() => {});
        }
    }

    if ($w("#msbProfile").id) {
        $w("#msbProfile").onChange((event) => { 
            logger.info(`🔄 [MSB CHANGE]: #msbProfile changed to -> ${event.target.currentState.id}`);
            updateGlobalUI(event.target.currentState.id); 
        });
    }

    wixLocationFrontend.onChange(() => {
        let currentQuery = wixLocationFrontend.query; 
        let currentBase = getCurrentBaseRoute($w); 
        logger.info(`📍 [URL CHANGE]: Route is now -> ${currentQuery.route || 'none'}`);
        if (isRouterBooting || isAnimatingMenu) { logger.info(`🛑 [URL CHANGE IGNORED]: Router is actively hydrating DOM or animating menu.`); return; }

        let isBrowserBack = (navHistory.length > 0 && currentQuery.route === navHistory[navHistory.length - 1].route);
        let isBrowserForward = (forwardHistory.length > 0 && currentQuery.route === forwardHistory[forwardHistory.length - 1].route);

        if (isBrowserBack) { logger.info("⬅️ Intercepted Browser Back Button!"); handleBackNavigation(true); return; }
        if (isBrowserForward) { logger.info("➡ Intercepted Browser Forward Button!"); handleForwardNavigation(true); return; }
        if (currentQuery.route && currentQuery.route !== currentBase && currentQuery.route !== "siteMenu") smartGoTo(currentQuery.route);
    });

    let envelopeData = session.getItem("siteStateEnvelope"); 
    let isStripeRestore = false;

    let isFreshSession = !session.getItem("isSessionActive");
    let isStripeRedirect = initialQuery.payment_intent && initialQuery.redirect_status;

    if (isFreshSession && !isStripeRedirect) {
        logger.info("🧹 [FRESH SESSION]: New visit/tab detected. Wiping memory but PRESERVING deep links.");
        session.setItem("isSessionActive", "true"); 
        session.removeItem("ecmd_navHistory"); 
        session.removeItem("returnBreadcrumb"); 
        navHistory = [];
        if (initialQuery.menu) { wixLocationFrontend.queryParams.remove(["menu"]); delete initialQuery.menu; }
    } else if (!isFreshSession) { 
        logger.info("♻️ [REFRESH DETECTED]: Session is active. Preserving breadcrumbs and history."); 
    }

    if (initialQuery.payment_intent && initialQuery.redirect_status && envelopeData) {
        let envelope;
        try { envelope = JSON.parse(envelopeData); } 
        catch (e) { logger.error(`❌ [ENVELOPE ERROR]: Failed to parse envelope JSON!`, e); }

        if (envelope) {
            isStripeRestore = true; 
            if ($w("#msbLightbox").id) { $w("#msbLightbox").hide(); $w("#msbLightbox").collapse(); }
            if ($w("#msbPrompts").id) { $w("#msbPrompts").hide(); $w("#msbPrompts").collapse(); }
            if ($w("#msbPopUp").id) { $w("#msbPopUp").hide(); $w("#msbPopUp").collapse(); }
            
            if (envelope.breadcrumb) { session.setItem("returnBreadcrumb", envelope.breadcrumb); }
            if (envelope.navHistory) { navHistory = envelope.navHistory; }
            if (envelope.forwardHistory) { forwardHistory = envelope.forwardHistory; }
            
            if ($w("#msbProfile").id && envelope.profileState && pageHasState($w, "#msbProfile", envelope.profileState)) {
                $w("#msbProfile").changeState(envelope.profileState).catch(err => { 
                    logger.error(`❌ [REBUILD ERROR]: Failed to change #msbProfile state!`, err); 
                });
            }
            
            initialQuery.route = envelope.backgroundRoute;
            setTimeout(() => {
                wixLocationFrontend.queryParams.remove(['payment_intent', 'payment_intent_client_secret', 'redirect_status']);
                setTimeout(() => { isRouterBooting = false; }, 500);
            }, 2500); 
        }
    }

    let bootTargetRoute = initialQuery.route || session.getItem("pendingLoaderRoute") || getCurrentBaseRoute($w);
    showPageLoader(bootTargetRoute, $w);

    const revealMsbWhenReady = () => {
        session.removeItem("pendingLoaderRoute");
        hidePageLoader($w);
        if ($w("#msbProfile").id && $w("#msbProfile").hidden) {
            $w("#msbProfile").show("fade", { duration: 120 });
        }
    };

    if (initialQuery.route && initialQuery.route !== STRINGS.ROUTES.SITE_MENU) {
        if (initialQuery.payment_intent) { session.setItem("isBootingFromEnvelope", "true"); }
        
        if (!isStripeRestore) { 
            smartGoTo(initialQuery.route, true).then(() => {
                updateGlobalUI(initialQuery.route);
                revealMsbWhenReady();
            }); 
        } else {
            revealMsbWhenReady();
        }
        
        if (!isStripeRestore) { setTimeout(() => { isRouterBooting = false; }, 800); }

        if (initialQuery.prompt === "login") {
            setTimeout(() => { smartGoTo("loginPromptsState"); }, 800);
        }

    } else {
        if (typeof wixLocationFrontend !== "undefined") {
            let baseRoute = getCurrentBaseRoute($w); 
            if (baseRoute !== "detailingPackages") {
                wixLocationFrontend.queryParams.add({ "route": baseRoute }); 
            }
            executePreRouteLogic(baseRoute).then(() => {
                updateGlobalUI(baseRoute);
                revealMsbWhenReady();
            });
        }
        setTimeout(() => { isRouterBooting = false; }, 800);
    }
}

export function syncFooterState($wContext = null, explicitState = "") {
    let ctx = $wContext || $w;
    if (!ctx || !ctx("#msbFooter").id) return;

    let pathSegment = (typeof wixLocationFrontend !== "undefined" && wixLocationFrontend.path && wixLocationFrontend.path.length > 0)
        ? String(wixLocationFrontend.path[0] || "").toLowerCase()
        : "";
    let stateLower = String(explicitState || "").toLowerCase();

    let isBookingHQ = pathSegment === "booking-hq" || Boolean(ctx("#msbCustomer").id) || stateLower === "bcalendar";
    let isPackagesPage = (pathSegment === "" && !isBookingHQ && Boolean(ctx("#packageRep").id)) || stateLower === "detailingpackages";

    let candidates = ["blankstate", "blankState"];
    if (isBookingHQ) {
        candidates = ["hpBookingState", "hqBookingState"];
    } else if (isPackagesPage) {
        candidates = ["packagesState"];
    }

    let availableStates = ctx("#msbFooter").states || [];
    let matchedStateObj = null;

    for (let cand of candidates) {
        matchedStateObj = availableStates.find(s => s.id === cand)
            || availableStates.find(s => String(s.id || "").toLowerCase() === cand.toLowerCase());
        if (matchedStateObj) break;
    }

    let targetStateId = matchedStateObj ? matchedStateObj.id : candidates[0];
    let currentStateId = ctx("#msbFooter").currentState ? ctx("#msbFooter").currentState.id : null;

    if (currentStateId !== targetStateId) {
        ctx("#msbFooter").changeState(targetStateId).catch(() => {});
    }

    if (ctx("#trackerFooter").id && ctx("#trackerFooter").collapsed) {
        ctx("#trackerFooter").expand();
    }
    if (ctx("#msbFooter").collapsed) {
        ctx("#msbFooter").expand();
    }
}

function updateGlobalUI(mainState) {
    logger.info(`🌐 [GLOBAL UI UPDATE]: Triggered for state -> ${mainState}`);
    
    previousGlobalState = mainState;

    let currentEnvelope = {
        backgroundRoute: mainState,
        profileState: $w("#msbProfile").id && $w("#msbProfile").currentState ? $w("#msbProfile").currentState.id : null,
        breadcrumb: session.getItem("returnBreadcrumb") || null,
        navHistory: navHistory,
        forwardHistory: forwardHistory,
    };
    session.setItem("siteStateEnvelope", JSON.stringify(currentEnvelope));

    if (typeof wixLocationFrontend !== 'undefined' && mainState !== "detailingPackages" && wixLocationFrontend.query.route !== mainState) {
        wixLocationFrontend.queryParams.add({ "route": mainState });
    }
    if (hooks.unlockSlider) hooks.unlockSlider(); 
    closeSideMenu();

    if ($w("#sidePackagesButtons").id) {
        if (mainState === "detailingPackages") { 
            $w("#sidePackagesButtons").expand(); 
            $w("#sidePackagesButtons").show("fade", { duration: 200 }); 
        } else { 
            $w("#sidePackagesButtons").hide("fade", { duration: 150 }).then(() => { $w("#sidePackagesButtons").collapse(); }); 
        }
    }

    syncFooterState($w, mainState);

    let safeState = mainState.toLowerCase();

    let vaultFlagsRaw = session.getItem("master_state_vault_flags");
    let vaultFlags = vaultFlagsRaw ? JSON.parse(vaultFlagsRaw) : {};
    vaultFlags[safeState] = true;
    vaultFlags.lastActiveState = safeState;
    session.setItem("master_state_vault_flags", JSON.stringify(vaultFlags));

    const statesThatKeepHeldSlots = [
        "calendarprofilestate",
        "confirmbookingprofilestate",
        "carteditsprofilestate"
    ];

    if (!statesThatKeepHeldSlots.includes(safeState)) {
        if (hooks && hooks.releaseCalendarSlots) {
            hooks.releaseCalendarSlots();
        }
    }

    if (safeState === "upcomingprofilestate" || safeState === "completedprofilestate") {
        session.removeItem("editingScheduledJobId");
        session.removeItem("reschedulingJobId");
    } else if (safeState === "cartprofilestate") {
        session.removeItem("editingScheduledJobId");
        session.removeItem("reschedulingJobId");
        session.removeItem("cartEditActive");
    }

    session.removeItem("isBootingFromEnvelope");
    
    if (safeState === "detailingpackages") { 
        asyncSafeDOMUpdate(() => { if (hooks.syncMobileSlider) hooks.syncMobileSlider(); }, 150); 
    } 
    else if (safeState === "garageprofilestate") { 
        asyncSafeDOMUpdate(() => { 
            if (hooks.applyVehicleFilter) hooks.applyVehicleFilter(true); 
            if (hooks.refreshSelectionUI) hooks.refreshSelectionUI(); 
        }, 50); 
    } 
    else if (safeState === "cartprofilestate") { 
        if (hooks.refreshCartUI) hooks.refreshCartUI(); 
    }
}

export async function handleBackNavigation(isBrowserTriggered = false) {
    logger.info(`⬅️ Executing Back Navigation.`);
    closeAllOverlays($w, true); 
    
    if (navHistory.length > 0) {
        let previousLocation = navHistory.pop(); 
        let currentBase = getCurrentBaseRoute($w);
        let targetState = previousLocation.route || previousLocation.state;

        forwardHistory.push({ msb: "#msbProfile", state: currentBase, route: currentBase });
        saveNavHistory();

        if (!pageHasState($w, previousLocation.msb || "#msbProfile", targetState)) {
            await smartGoTo(targetState, true);
            return;
        }

        wixWindowFrontend.scrollTo(0, 0, { scrollAnimation: false });
        await executePreRouteLogic(targetState);

        if (previousLocation.msb && $w(previousLocation.msb).id) {
            await $w(previousLocation.msb).changeState(targetState);
        } else if ($w("#msbProfile").id) {
            await $w("#msbProfile").changeState(targetState);
        }

        if (!isBrowserTriggered && typeof wixLocationFrontend !== "undefined") {
            wixLocationFrontend.queryParams.add({ "route": targetState });
        }
    } else { 
        smartGoTo("detailingPackages"); 
    }
}

export async function handleForwardNavigation(isBrowserTriggered = false) {
    logger.info(`➡️ Executing Forward Navigation.`);
    closeAllOverlays($w, true); 
    
    if (forwardHistory.length > 0) {
        let nextLocation = forwardHistory.pop();
        let currentBase = getCurrentBaseRoute($w);
        let targetState = nextLocation.route || nextLocation.state;

        navHistory.push({ msb: "#msbProfile", state: currentBase, route: currentBase });
        saveNavHistory();

        if (!pageHasState($w, nextLocation.msb || "#msbProfile", targetState)) {
            await smartGoTo(targetState, true);
            return;
        }

        wixWindowFrontend.scrollTo(0, 0, { scrollAnimation: false });
        await executePreRouteLogic(targetState);

        if (nextLocation.msb && $w(nextLocation.msb).id) {
            await $w(nextLocation.msb).changeState(targetState);
        } else if ($w("#msbProfile").id) {
            await $w("#msbProfile").changeState(targetState);
        }

        if (!isBrowserTriggered && typeof wixLocationFrontend !== "undefined") {
            wixLocationFrontend.queryParams.add({ "route": targetState });
        }
    }
}

function initBackButton() {
    let allButtons = $w("Button");
    
    let autoBackButtons = allButtons.filter(btn => btn.id.startsWith("backButton")); 
    autoBackButtons.forEach(btn => btn.onClick(() => handleBackNavigation()));
    
    let autoForwardButtons = allButtons.filter(btn => btn.id.startsWith("forwardButton")); 
    autoForwardButtons.forEach(btn => btn.onClick(() => handleForwardNavigation()));
    
    if ($w("#cartBackButton").id) $w("#cartBackButton").onClick(() => handleBackNavigation()); 
}

export async function openSideMenu(targetState) {
    if ($w("#siteMenu").id && !$w("#siteMenu").hidden && !isAnimatingMenu) { isAnimatingMenu = true; $w("#siteMenu").hide("slide", { direction: "right", duration: 300 }).then(() => isAnimatingMenu = false); resetHeaderMenuButton($w); }
    toggleOverlays(["#lightboxBoxG", "#lightboxBackground"], "show");
    if ($w("#msbSideMenu").id) { await $w("#msbSideMenu").changeState(targetState); await $w("#msbSideMenu").expand(); asyncSafeDOMUpdate(() => { $w("#msbSideMenu").show("slide", { direction: "right", duration: 400 }); }, 50); }
}

export async function closeSideMenu() {
    if ($w("#msbSideMenu").id) {
        if (!$w("#msbSideMenu").hidden && !$w("#msbSideMenu").collapsed) await $w("#msbSideMenu").hide("slide", { direction: "right", duration: 400 });
        $w("#msbSideMenu").collapse();
    }
}

function initGlobalButtons() {
    if ($w("#vehicleOptions").id) { $w("#vehicleOptions").onClick(() => { openSideMenu("garageMenu"); }); }
    if ($w("#calendarButton").id) { $w("#calendarButton").onClick(() => { if (hooks.triggerCalendarCheck) hooks.triggerCalendarCheck(); }); }
    
    let allButtons = $w("Button");
    let paymentButtons = allButtons.filter(btn => btn.id.startsWith("buttonPayment") && btn.id !== "buttonPaymentDetailInfo");
    paymentButtons.forEach(btn => { btn.onClick(() => smartGoTo("paymentPortalProfileState")); });
}

export function initOverlayCloseButtons($wContext) {
    const stepBackBackgrounds = ["#lightboxBackground", "#lightbox2ClickBackground"];

    const handleCloseEvent = (isNuke, triggerId = "") => {
        const isShown = (id) => $wContext(id).id && !$wContext(id).hidden && !$wContext(id).collapsed;
        
        if (isShown("#msbMessages")) { closeTopOverlay($wContext); return; }
        if ((isShown("#msbPrompts") || isShown("#msbPopUp")) && triggerId === "#lightboxBackground") { closeTopOverlay($wContext); return; }

        let breadcrumb = session.getItem("returnBreadcrumb");
        if (breadcrumb) { session.removeItem("returnBreadcrumb"); smartGoTo(breadcrumb); } 
        else { if (isNuke) closeAllOverlays($wContext); else closeTopOverlay($wContext); }
    };

    let allButtons = $wContext("Button");
    let nukeButtons = allButtons.filter(btn => btn.id.startsWith("closeLB"));
    let stepBackButtons = allButtons.filter(btn => btn.id.startsWith("closePopup") || btn.id.startsWith("closeMessages") || btn.id.startsWith("closePrompts"));

    nukeButtons.forEach(btn => btn.onClick(() => handleCloseEvent(true, btn.id)));
    stepBackButtons.forEach(btn => btn.onClick(() => handleCloseEvent(false, btn.id)));
    stepBackBackgrounds.forEach(btnId => { if ($wContext(btnId).id) $wContext(btnId).onClick(() => handleCloseEvent(false, btnId)); });
    if ($wContext("#confirmButtonLBG").id) { $wContext("#confirmButtonLBG").onClick(() => { session.removeItem("returnBreadcrumb"); }); }
}

export function popNavHistory() { if (navHistory.length > 0) { navHistory.pop(); saveNavHistory(); } }
export function clearNavHistory() { navHistory = []; saveNavHistory(); }

export async function showSuccessMessage(message) {
    if (!$w) return;
    try { await openOverlay($w, "message", "successMessageState"); if ($w("#successMessageLBG").id) { $w("#successMessageLBG").text = message; await $w("#successMessageLBG").expand(); await $w("#successMessageLBG").show("fade", { duration: 150 }).catch(() => {}); } } catch (err) {}
}

export async function showErrorMessage(message) {
    if (!$w) return;
    try { await openOverlay($w, "message", "errorMessageState"); if ($w("#errorMessageLBG").id) { $w("#errorMessageLBG").text = message; await $w("#errorMessageLBG").expand(); await $w("#errorMessageLBG").show("fade", { duration: 150 }).catch(() => {}); } } catch (err) {}
}

export function preSnapStateFromUrl($wContext) {
    let targetRoute = wixLocationFrontend.query.route || session.getItem("pendingLoaderRoute");
    if (targetRoute) {
        showPageLoader(targetRoute, $wContext);
    }
    if (!targetRoute) return;

    if ($wContext("#msbProfile").id && pageHasState($wContext, "#msbProfile", targetRoute)) {
        if ($wContext("#msbProfile").currentState.id !== targetRoute) {
            $wContext("#msbProfile").changeState(targetRoute).catch(() => {});
        }
    }
}