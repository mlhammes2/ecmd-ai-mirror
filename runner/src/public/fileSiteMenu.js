import wixLocationFrontend from 'wix-location-frontend';
// --- public/fileSiteMenu.js ---

import wixData from 'wix-data';
import { authentication, currentMember } from 'wix-members-frontend';
import { registerRepeater, smartSyncRepeater } from 'public/repeaterEngine';
import { routeFromMenu, initRouterEngine, smartGoTo, openSideMenu, closeSideMenu, openOverlay, closeAllOverlays, closeTopOverlay, showSuccessMessage, showErrorMessage } from 'public/routerEngine';
import { APP_LOGS } from 'public/loggerConfig';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

let $w;
let hooks;
let isLoggedInContractor = false;
let activeMenuCategory = "siteMenu";
let loadedMenuItemsCount = 0;

// ==========================================
// 🔴 DEBUGGING & AI TELEMETRY ENGINE
// ==========================================
const DEBUG_MODE = APP_LOGS.MASTER_SWITCH && APP_LOGS.SITE_MENU; // Synced /gemini menu override
const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [FILE_SITE_MENU]: ${msg}`, data) : console.log(`📌 [FILE_SITE_MENU]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [FILE_SITE_MENU]: ${msg}`, data) : console.warn(`📌 [FILE_SITE_MENU]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [FILE_SITE_MENU]: ${msg}`, data) : console.error(`📌 [FILE_SITE_MENU]: ${msg}`); }
};

registerModuleState("fileSiteMenu", () => ({
    isLoggedInContractor,
    isLoggedIn: authentication.loggedIn(),
    activeMenuCategory,
    loadedMenuItemsCount
}));

registerDomElements({
    repeaters: ["#siteMenuRep"]
});

export function initSiteMenuEngine(wixContext, providedHooks) {
    logger.info("initSiteMenuEngine -> Initializing Site Menu Engine...");
    $w = wixContext;
    hooks = providedHooks || {};
   
    initSiteMenuRepeater();
    loadSiteMenuData();
}

async function loadSiteMenuData() {
    if (!$w("#siteMenuRep") || !$w("#siteMenuRep").id) return;
    try {
        isLoggedInContractor = false;
        if (authentication.loggedIn()) {
            let member = await currentMember.getMember().catch(() => null);
            let email = member ? (member.loginEmail || (member.contactDetails?.emails?.[0])) : null;
            if (email) {
                let conRes = await wixData.query("contractors").contains("email", email.trim()).find();
                if (conRes.items.length > 0) {
                    isLoggedInContractor = true;
                }
            }
        }

        // 🎯 Load the specific menu category for this page ("siteMenu", "detailerMenu", or "bookingMenu")
        let targetCategory = (hooks && hooks.menuCategory) ? hooks.menuCategory : "siteMenu";
        activeMenuCategory = targetCategory;

        let res = await wixData.query("siteButtons").eq("category", targetCategory).ascending("sort").find();
        loadedMenuItemsCount = (res.items || []).length;
        logger.info(`loadSiteMenuData -> Loaded ${loadedMenuItemsCount} menu item(s) for category '${targetCategory}' (isContractor=${isLoggedInContractor})`);
        smartSyncRepeater($w, "#siteMenuRep", res.items);
    } catch (err) {
        logger.error("loadSiteMenuData -> Failed to load CMS Site Menu Buttons", err);
    }
}

function initSiteMenuRepeater() {
    if (!$w("#siteMenuRep") || !$w("#siteMenuRep").id) return;
   
    registerRepeater($w, "#siteMenuRep", ($item, itemData) => {
        let btnTitle = itemData.title || "";
        let safeTitle = btnTitle.toLowerCase();
        let isLoggedIn = authentication.loggedIn();

        // 👈 AUTH VISIBILITY LOGIC: Collapse the entire item based on login status
        if (safeTitle === "log-out" && !isLoggedIn) {
            if ($item("#siteMenuRepButtons").type) $item("#siteMenuRepButtons").collapse();
            if ($item("#siteMenuRepLine").type) $item("#siteMenuRepLine").collapse();
            return;
        }
       
        if (safeTitle === "login" && isLoggedIn) {
            if ($item("#siteMenuRepButtons").type) $item("#siteMenuRepButtons").collapse();
            if ($item("#siteMenuRepLine").type) $item("#siteMenuRepLine").collapse();
            return;
        }

        // 👈 CONTRACTOR VISIBILITY LOGIC: Only show sort2 === "04" items to logged-in contractors
        let sort2Val = String(itemData.sort2 || itemData.sort02 || "").trim();
        if (sort2Val === "04" && !isLoggedInContractor) {
            if ($item("#siteMenuRepButtons").type) $item("#siteMenuRepButtons").collapse();
            if ($item("#siteMenuRepLine").type) $item("#siteMenuRepLine").collapse();
            return;
        }

        // 📋 NORMAL RENDERING
        if (safeTitle === "line") {
            if ($item("#siteMenuRepLine").type) $item("#siteMenuRepLine").expand();
            if ($item("#siteMenuRepButtons").type) $item("#siteMenuRepButtons").collapse();
        } else {
            if ($item("#siteMenuRepLine").type) $item("#siteMenuRepLine").collapse();
            if ($item("#siteMenuRepButtons").type) {
                $item("#siteMenuRepButtons").expand();
                $item("#siteMenuRepButtons").label = btnTitle;
                
                if (itemData.image) {
                    $item("#siteMenuRepButtons").icon = itemData.image;
                }
            }
        }

        if ($item("#siteMenuRepButtons").type) {
            $item("#siteMenuRepButtons").onClick(async () => {
                logger.info(`siteMenuRepButtons.onClick -> Clicked '${btnTitle}'`);
                if (hooks.unlockSlider) hooks.unlockSlider();
                
                if (safeTitle === "log-out") {
                    $item("#siteMenuRepButtons").label = "Logging out...";
                    $item("#siteMenuRepButtons").disable();
                    await authentication.logout();
                    return; 
                }

                let targetRoute = itemData.targetState;
                
                const routeOverrides = {
                    "Automotive Detailing": "detailingPackages",
                    "My Garage": "garageProfileState",
                    "My Profile": "profileProfileState",
                    "Up-Coming Details": "upcomingProfileState",
                    "Completed Details": "completedProfileState",
                    "Subscriptions": "subscriptionsProfileState",
                    "Contacts & Locations": "contactLocationsProfileState",
                    "Gemini A.I Assistant": "/gemini",
                    "Booking HQ": "/booking-hq",
                    "Detailer Portal": "/detailer"
                };

                if (routeOverrides[btnTitle]) {
                    targetRoute = routeOverrides[btnTitle];
                }

                if (targetRoute) {
                    routeFromMenu(targetRoute);
                }
            });
        }
    });
}