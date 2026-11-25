// --- public/headerEngine.js ---

/**
 * ========================================================================
 * 🤖 AI CONTEXT & ARCHITECTURE NOTE
 * ========================================================================
 * FILE: public/headerEngine.js
 * DOM TARGETS: Static header buttons (`#headerButtonCart`, `#headerButtonProfile`, etc.)
 * PURPOSE: Manages the main header buttons, user greetings, and garbage 
 * collection. Migrated from masterPage.js for SPA optimization.
 * ========================================================================
 */

import { currentMember } from 'wix-members-frontend';
import wixData from 'wix-data';
import wixLocationFrontend from 'wix-location-frontend';
import { local } from 'wix-storage';
import { preloadAllProfileData } from 'public/profileEngine';
import { APP_LOGS } from 'public/loggerConfig';
import wixAnimationsFrontend from 'wix-animations-frontend';
import { toggleSiteMenu, smartGoTo } from 'public/routerEngine';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

let $w;
let hooks;
let headerIsLoggedIn = false;
let headerIsStaffPortal = false;
let lastHeaderCartCount = 0;

// ==========================================
// 🔴 DEBUGGING & AI TELEMETRY ENGINE
// ==========================================
const DEBUG_MODE = APP_LOGS.MASTER_SWITCH && APP_LOGS.HEADER;
const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [HEADER_ENGINE]: ${msg}`, data) : console.log(`📌 [HEADER_ENGINE]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [HEADER_ENGINE]: ${msg}`, data) : console.warn(`📌 [HEADER_ENGINE]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [HEADER_ENGINE]: ${msg}`, data) : console.error(`📌 [HEADER_ENGINE]: ${msg}`); }
};

registerModuleState("headerEngine", () => ({
    headerIsLoggedIn,
    headerIsStaffPortal,
    lastHeaderCartCount
}));

registerDomElements({
    boxes: ["#cartCountsBox"]
});

export function initHeaderEngine(wixContext, providedHooks) {
    logger.info("initHeaderEngine -> Initializing Header Engine...");
    $w = wixContext;
    hooks = providedHooks || {};

    initStaticHeaderButtons();

    // 🛡️ Hide Cart & Garage Header Buttons on Detailer Portal & Booking HQ
    headerIsStaffPortal = Boolean($w("#msbJobs").id || $w("#msbCustomer").id || hooks.hideCustomerHeaderButtons);
    if (headerIsStaffPortal) {
        ["#headerButtonCart", "#headerButtonGarage", "#cartCountsBox", "#cartCounts"].forEach(id => {
            if ($w(id).id) {
                $w(id).hide();
                $w(id).collapse();
            }
        });
    } else {
        setTimeout(() => {
            loadInitialCartCount();
        }, 1500);
    }

    currentMember.getMember().then(member => {
        if (member) {
            headerIsLoggedIn = true;
            let firstName = member.contactDetails?.firstName || member.profile?.nickname || "";
            let greeting = getTimeGreeting();
            if ($w("#loginInfo").id) $w("#loginInfo").text = firstName ? `${greeting}, ${firstName}!` : `${greeting}!`;
        } else {
            headerIsLoggedIn = false;
            if ($w("#loginInfo").id) $w("#loginInfo").text = "Login";
        }
    }).catch(err => logger.error("Global Header Auth Error:", err));

    if ($w("#loginInfo").id) {
        $w("#loginInfo").onClick(() => {
            logger.info(`loginInfo.onClick -> Routing (isLoggedIn=${headerIsLoggedIn})`);
            if (headerIsLoggedIn) {
                if (typeof preloadAllProfileData === "function") preloadAllProfileData(true);
                wixLocationFrontend.queryParams.add({ "route": "profileProfileState" });
            } else {
                wixLocationFrontend.queryParams.add({ "route": "loginPromptsState" });
            }
        });
    }

    setTimeout(() => {
        performGuestGarbageCollection();
    }, 3000);
}

// ==========================================
// 📡 2. STATIC HEADER BUTTON ENGINES
// ==========================================
function initStaticHeaderButtons() {
    const buttons = [
        { id: "#headerButtonCart", route: "cartProfileState" },
        { id: "#headerButtonProfile", route: "profileProfileState", preload: true },
        { id: "#headerButtonGarage", route: "garageProfileState" }
    ];

    const executeHeaderRoute = (clickedId, route, preload) => {
        logger.info(`executeHeaderRoute -> Clicked ${clickedId}, routing to ${route}`);
        if ($w(clickedId).id) {
            const bounce = wixAnimationsFrontend.timeline();
            bounce.add($w(clickedId), { scale: 0.9, duration: 80, easing: "easeOutSine" })
                  .add($w(clickedId), { scale: 1, duration: 150, easing: "easeOutBounce" });
            bounce.play();
        }

        buttons.forEach(btn => {
            if ($w(btn.id).id) {
                if (btn.id === clickedId) {
                    $w(btn.id).style.color = "#17E6AD"; 
                } else {
                    $w(btn.id).style.color = "#FFFFFF"; 
                }
            }
        });

        if ($w("#headerButtonMenu").id) $w("#headerButtonMenu").enable();

        if (preload && typeof preloadAllProfileData === "function") {
            preloadAllProfileData(true);
        }

        if (route) wixLocationFrontend.queryParams.add({ "route": route });
    };

    buttons.forEach(btn => {
        if ($w(btn.id).id) {
            $w(btn.id).onClick(() => executeHeaderRoute(btn.id, btn.route, btn.preload));
        }
    });

    if ($w("#headerButtonMenu").id) {
        $w("#headerButtonMenu").onClick(() => {
            logger.info("headerButtonMenu.onClick -> Menu Button Clicked!");
            $w("#headerButtonMenu").disable();
            smartGoTo("siteMenu");
        });
    }

    if ($w("#cartCountsBox").id) {
        $w("#cartCountsBox").onClick(() => executeHeaderRoute("#headerButtonCart", "cartProfileState"));
    }
    if ($w("#cartCounts").id) {
        $w("#cartCounts").onClick(() => executeHeaderRoute("#headerButtonCart", "cartProfileState"));
    }
}

function loadInitialCartCount() {
    let activeUserId = local.getItem("temp_guest_id") || "guest";
    currentMember.getMember().then(member => {
        if (member) activeUserId = member._id;
        wixData.query("temporaryData")
            .eq("userId", activeUserId)
            .eq("status", "Draft")
            .count()
            .then((total) => {
                lastHeaderCartCount = total;
                if (total > 0) {
                    if ($w("#cartCounts").id) $w("#cartCounts").text = total.toString();
                    if ($w("#cartCountsBox").id && $w("#cartCountsBox").hidden) $w("#cartCountsBox").show("fade", { duration: 300 });
                } else {
                    if ($w("#cartCountsBox").id) $w("#cartCountsBox").hide();
                }
            })
            .catch(err => logger.error("Cart count error:", err));
    }).catch(() => {});
}

function getTimeGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
}

// ==========================================
// 🧹 3. GUEST GARBAGE COLLECTION
// ==========================================
function performGuestGarbageCollection() {
    let cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 48);

    wixData.query("temporaryData")
        .eq("status", "Draft")
        .startsWith("userId", "guest_")
        .lt("_updatedDate", cutoffDate)
        .limit(50) 
        .find()
        .then(res => {
            if (res.items.length > 0) {
                let staleItemIds = res.items.map(item => item._id);
                wixData.bulkRemove("temporaryData", staleItemIds)
                    .then(() => logger.info(`performGuestGarbageCollection -> Purged ${staleItemIds.length} abandoned guest items.`))
                    .catch(err => logger.error("Garbage collection failed:", err));
            }
        })
        .catch(() => {});
}