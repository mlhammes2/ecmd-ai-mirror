// ---- /payment (Payment Portal Page Code) ----

import wixLocationFrontend from 'wix-location-frontend';
import wixWindowFrontend from 'wix-window-frontend';

import { initAiTelemetry, registerModuleState } from 'public/aiTelemetry';
import { initHeaderEngine } from 'public/headerEngine';
import { initSiteMenuEngine } from 'public/fileSiteMenu';
import { initAuthEngine } from 'public/authEngine';
import { initRouterEngine, smartGoTo, closeAllOverlays, showErrorMessage } from 'public/routerEngine';
import { initPaymentPortalEngine, loadPaymentPortalData } from 'public/filePaymentPortal.js';
import { preloadAllProfileData } from 'public/profileEngine';
import { bindGlobalRepeaterButtons } from 'public/stateManager';

let isPaymentBootComplete = false;

$w.onReady(function () {
    if (wixWindowFrontend.rendering.env !== "browser") return;

    initAiTelemetry($w);
    console.log("📌 [PAYMENT_PAGE -> onReady]: Booting Payment Portal Page...");

    registerModuleState("paymentPortalPage", () => ({
        url: wixLocationFrontend.url,
        query: wixLocationFrontend.query,
        isPaymentBootComplete
    }));

    bindGlobalRepeaterButtons($w);

    setTimeout(async () => {
        try {
            initHeaderEngine($w, { smartGoTo });
            initSiteMenuEngine($w, { unlockSlider: () => {} });

            initAuthEngine($w, {
                smartGoTo,
                triggerPageReload: () => {
                    console.log("📌 [PAYMENT_PAGE -> triggerPageReload]: Reloading Payment Page after auth change");
                    wixLocationFrontend.queryParams.remove(["route"]);
                    closeAllOverlays($w);
                    wixLocationFrontend.to(wixLocationFrontend.url);
                }
            });

            initPaymentPortalEngine($w, { showErrorMessage });

            initRouterEngine($w, {
                unlockSlider: () => {},
                loadPaymentPortalData: async () => { await loadPaymentPortalData(); },
                preloadAllProfileData: async () => { await preloadAllProfileData(false, $w); }
            });

            // Immediately fetch payment portal data on boot
            await loadPaymentPortalData();
            isPaymentBootComplete = true;
            console.log("📌 [PAYMENT_PAGE -> bootComplete]: Payment Portal Page fully initialized.");

        } catch (error) {
            console.error("📌 [PAYMENT_PAGE -> bootError]: 🚨 Payment Page Boot Error:", error);
        }
    }, 10);
});