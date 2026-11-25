// ---- /booking-hq (BookingHQ Page Code) ----

import wixWindowFrontend from 'wix-window-frontend';
import wixLocationFrontend from 'wix-location-frontend';

import { initAiTelemetry, registerModuleState } from 'public/aiTelemetry';
import { initHeaderEngine } from 'public/headerEngine';
import { initSiteMenuEngine } from 'public/fileSiteMenu';
import { initAuthEngine } from 'public/authEngine';
import { initRouterEngine, smartGoTo, closeAllOverlays } from 'public/routerEngine';
import { initBookingHQEngine } from 'public/hqBookingEngine';
import { closeAllLightboxes } from 'public/hqState';

let isHqBootComplete = false;

$w.onReady(async function () {
    // 🛑 1. Prevent Server-Side Rendering from running DOM/Auth checks prematurely
    if (wixWindowFrontend.rendering.env !== "browser") return;

    initAiTelemetry($w);
    console.log("📌 [BOOKING_HQ_PAGE -> onReady]: Booting Booking HQ Page...");

    registerModuleState("bookingHqPage", () => ({
        url: wixLocationFrontend.url,
        query: wixLocationFrontend.query,
        isHqBootComplete
    }));

    try {
        // 2. Initialize Global Header, Menu & Auth
        initHeaderEngine($w, { smartGoTo });
        initSiteMenuEngine($w, { unlockSlider: () => {}, menuCategory: "bookingMenu" });
        initAuthEngine($w, {
            smartGoTo,
            triggerPageReload: () => {
                console.log("📌 [BOOKING_HQ_PAGE -> triggerPageReload]: Reloading Booking HQ after auth update");
                wixLocationFrontend.queryParams.remove(["route"]);
                closeAllOverlays($w);
                wixLocationFrontend.to(wixLocationFrontend.url);
            }
        });

        // 3. Initialize Router Engine (Pass closeAllLightboxes(false) so routerEngine handles the single backdrop fade)
        initRouterEngine($w, {
            closeCustomLightbox: () => closeAllLightboxes(false)
        });

        // 4. Boot the BookingHQ Engine (Handles Staff Auth / Vault Door + Dispatcher UI)
        await initBookingHQEngine($w, {
            smartGoTo
        });
        isHqBootComplete = true;
        console.log("📌 [BOOKING_HQ_PAGE -> bootComplete]: Booking HQ fully initialized.");

    } catch (error) {
        console.error("📌 [BOOKING_HQ_PAGE -> bootError]: ❌ BookingHQ Page Boot Error:", error);
    }
});