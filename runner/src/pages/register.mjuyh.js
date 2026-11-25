// ---- /register (Registry Page Code) ----

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
    console.log("📌 [REGISTRY_PAGE -> onReady]: Booting Registry Page...");

    registerModuleState("registryPage", () => ({
        url: wixLocationFrontend.url,
        query: wixLocationFrontend.query
    }));

    bindGlobalRepeaterButtons($w);

    // 🔗 Map the transparent buttons to the router!
    if ($w("#btnTermsLink").id) $w("#btnTermsLink").onClick(() => smartGoTo("termsProfileState"));
    if ($w("#btnPrivacyLink").id) $w("#btnPrivacyLink").onClick(() => smartGoTo("privacyProfileState"));

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