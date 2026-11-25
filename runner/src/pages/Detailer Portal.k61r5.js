// ---- Detailer Portal Page Code ----

import wixWindowFrontend from 'wix-window-frontend';
import wixLocationFrontend from 'wix-location-frontend';

import { initAiTelemetry, registerModuleState } from 'public/aiTelemetry';
import { initHeaderEngine } from 'public/headerEngine';
import { initSiteMenuEngine } from 'public/fileSiteMenu';
import { initAuthEngine } from 'public/authEngine';
import { initDetailerPortal, loadDetailerDashboardData } from 'public/detailerPortal';
import { initRouterEngine, smartGoTo, closeAllOverlays } from 'public/routerEngine';

let isDashboardLoaded = false;

$w.onReady(async function () {
    // 🛑 1. Prevent Server-Side Rendering (SSR) from locking up DOM state
    if (wixWindowFrontend.rendering.env !== "browser") return;

    initAiTelemetry($w);
    console.log("📌 [DETAILER_PORTAL_PAGE -> onReady]: Booting Detailer Portal Page...");

    registerModuleState("detailerPortalPage", () => ({
        url: wixLocationFrontend.url,
        query: wixLocationFrontend.query,
        isDashboardLoaded
    }));

    try {
        // 2. Initialize Header, Menu & Auth so global elements aren't frozen
        initHeaderEngine($w, { smartGoTo });
        initSiteMenuEngine($w, { unlockSlider: () => {}, menuCategory: "detailerMenu" });
        initAuthEngine($w, {
            smartGoTo,
            triggerPageReload: () => {
                console.log("📌 [DETAILER_PORTAL_PAGE -> triggerPageReload]: Reloading Detailer Portal after auth change");
                wixLocationFrontend.queryParams.remove(["route"]);
                closeAllOverlays($w);
                wixLocationFrontend.to(wixLocationFrontend.url);
            }
        });

        // 3. Initialize Detailer Portal BEFORE Router so repeaters are registered
        initDetailerPortal($w, {
            smartGoTo: smartGoTo
        });

        // 4. Give the Router eyes
        initRouterEngine($w, {});

        // 5. Load Dashboard Data
        console.log("📌 [DETAILER_PORTAL_PAGE -> loadDetailerDashboardData]: Fetching dashboard data...");
        await loadDetailerDashboardData();
        isDashboardLoaded = true;
        console.log("📌 [DETAILER_PORTAL_PAGE -> bootComplete]: Detailer Portal loaded successfully.");
    } catch (error) {
        console.error("📌 [DETAILER_PORTAL_PAGE -> bootError]: ❌ Detailer Portal Load Failed:", error);
    }
});