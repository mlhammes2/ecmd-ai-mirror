// ---- / (Packages Page Code) ----

import wixLocationFrontend from 'wix-location-frontend';
import wixWindowFrontend from 'wix-window-frontend';

import { initAiTelemetry, registerModuleState } from 'public/aiTelemetry';
import { activateReviewWidget } from 'public/reviewWidget';
import { initHeaderEngine } from 'public/headerEngine';
import { initSiteMenuEngine } from 'public/fileSiteMenu';
import { initAuthEngine, getActiveUserId } from 'public/authEngine';
import { initRouterEngine, smartGoTo, openOverlay, closeAllOverlays, showSuccessMessage, hidePageLoader } from 'public/routerEngine';

import { initPackagesEngine, unpackPackageState, setPackageData, syncPackagesVehicles } from 'public/packagesEngine';
import { initSummaryEngine, updateSummary } from 'public/fileSummary';
import { initCartUIEngine, syncCartData, bootBatchMode, refreshCartVisuals } from 'public/cartUIEngine';
import { initVehicleAddEngine, syncVehicleCategories } from 'public/fileVehicleAdd';
import { initLightboxTitleEngine, initAutoCaps } from 'public/cartEngine';

import { getCatalogData, getVehicleCategories, bindGlobalRepeaterButtons, fetchUserAndCartBundle, getInstantCache, prewarmAllUserDataInBackground } from 'public/stateManager';

let isSliderLocked = false;
let usedInstantCacheOnBoot = false;

$w.onReady(async function () {
    if (wixWindowFrontend.rendering.env !== "browser") return;

    initAiTelemetry($w);
    console.log("📌 [PACKAGES_PAGE -> onReady]: Booting Packages / Home Page...");

    registerModuleState("packagesPage", () => ({
        url: wixLocationFrontend.url,
        query: wixLocationFrontend.query,
        isSliderLocked,
        usedInstantCacheOnBoot
    }));

    const loadPackagesCartContext = async (forceRefresh = false, autoSelectNewestVehicle = false) => {
        console.log(`📌 [PACKAGES_PAGE -> loadPackagesCartContext]: forceRefresh=${forceRefresh}, autoSelectNewestVehicle=${autoSelectNewestVehicle}`);
        let [catalog, mem] = await Promise.all([
            getCatalogData(forceRefresh),
            fetchUserAndCartBundle(forceRefresh)
        ]);
        syncPackagesVehicles(mem.vehicles || [], autoSelectNewestVehicle);
        await syncCartData(mem.cartData, mem.vehicles, mem.contacts, mem.locations, mem.detailers, catalog.allData);
    };

    try {
        // 1. Initialize Engines & Bind Repeaters FIRST
        initHeaderEngine($w, { smartGoTo });
        try { activateReviewWidget($w); } catch (e) {}
        initSiteMenuEngine($w, { unlockSlider: () => { isSliderLocked = false; } });

        initAuthEngine($w, {
            smartGoTo,
            triggerPageReload: () => {
                console.log("📌 [PACKAGES_PAGE -> triggerPageReload]: Reloading page after auth change");
                wixLocationFrontend.queryParams.remove(["route"]);
                closeAllOverlays($w);
                wixLocationFrontend.to(wixLocationFrontend.url);
            }
        });

        initPackagesEngine($w, { smartGoTo, updateSummary });

        initCartUIEngine($w, {
            getActiveUserId,
            loadCartData: () => loadPackagesCartContext(true),
            loadGarageData: async () => {},
            smartGoTo, syncCartData,
            unlockSlider: () => { isSliderLocked = false; },
            forceCalendarRepaint: () => {}
        });

        initSummaryEngine($w, {
            smartGoTo, closeAllOverlays,
            unlockSlider: () => { isSliderLocked = false; },
            refreshCartVisuals: () => refreshCartVisuals(),
            loadCartData: () => loadPackagesCartContext(true)
        });

        initVehicleAddEngine($w, {
            getActiveUserId, openOverlay,
            closeOverlays: () => closeAllOverlays($w),
            triggerVehicleSaveCallback: async () => {
                console.log("📌 [PACKAGES_PAGE -> triggerVehicleSaveCallback]: Vehicle saved, refreshing packages & cart context...");
                closeAllOverlays($w, true);
                showSuccessMessage("Vehicle successfully saved!");
                await loadPackagesCartContext(true, true);
            }
        });

        // ⚡ 2. 0ms INSTANT PAINT IF CACHED (Or fast fetch on very first visit)
        let cachedAll = getInstantCache("cache_autoWI");
        let cachedPkgs = getInstantCache("cache_packages");
        let cachedUserBundle = getInstantCache("cache_userBundle");

        if (cachedUserBundle && cachedUserBundle.vehicles) {
            syncPackagesVehicles(cachedUserBundle.vehicles, false);
        }

        if (cachedAll && cachedPkgs) {
            usedInstantCacheOnBoot = true;
            setPackageData(cachedAll, cachedPkgs);
            hidePageLoader($w);
            if ($w("#packageRep").id && $w("#packageRep").hidden) {
                $w("#packageRep").show("fade", { duration: 100 });
            }
        } else {
            let catalog = await getCatalogData();
            setPackageData(catalog.allData, catalog.packages);
            hidePageLoader($w);
            if ($w("#packageRep").id && $w("#packageRep").hidden) {
                $w("#packageRep").show("fade", { duration: 150 });
            }
        }

        bindGlobalRepeaterButtons($w);
        getVehicleCategories().then(cats => syncVehicleCategories(cats));
        bootBatchMode();

        initRouterEngine($w, {
            unlockSlider: () => { isSliderLocked = false; },
            resetShoppingState: () => unpackPackageState("Classic", "Full", []),
            loadCartData: () => loadPackagesCartContext(false)
        });

        initAutoCaps($w);
        initLightboxTitleEngine($w);

        // ⚡ 3. SILENTLY PRE-WARM ALL USER DATA FOR OTHER PAGES!
        prewarmAllUserDataInBackground();
        loadPackagesCartContext(false);
        console.log("📌 [PACKAGES_PAGE -> bootComplete]: Packages Page fully initialized.");

    } catch (error) {
        console.error("📌 [PACKAGES_PAGE -> bootError]: 🚨 Packages Page Boot Error:", error);
        hidePageLoader($w);
        if ($w("#packageRep").id && $w("#packageRep").hidden) $w("#packageRep").show();
    }
});