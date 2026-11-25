// ---- Privacy-Policy Page Code ----

import wixLocationFrontend from 'wix-location-frontend';
import wixWindowFrontend from 'wix-window-frontend';

import { initAiTelemetry, registerModuleState } from 'public/aiTelemetry';
import { initHeaderEngine } from 'public/headerEngine';
import { initSiteMenuEngine } from 'public/fileSiteMenu';
import { initAuthEngine } from 'public/authEngine';
import { initRouterEngine, smartGoTo, closeAllOverlays } from 'public/routerEngine';
import { bindGlobalRepeaterButtons } from 'public/stateManager';

$w.onReady(function () {
    if (wixWindowFrontend.rendering.env !== "browser") return;

    initAiTelemetry($w);
    console.log("📌 [PRIVACY_POLICY_PAGE -> onReady]: Booting Privacy Policy Page...");

    registerModuleState("privacyPolicyPage", () => ({
        url: wixLocationFrontend.url,
        query: wixLocationFrontend.query
    }));

    bindGlobalRepeaterButtons($w);

    setTimeout(() => {
        initHeaderEngine($w, { smartGoTo });
        initSiteMenuEngine($w, { unlockSlider: () => {} });

        initAuthEngine($w, {
            smartGoTo,
            triggerPageReload: () => {
                closeAllOverlays($w);
                wixLocationFrontend.to("/");
            }
        });

        initRouterEngine($w, {});
    }, 10);
});