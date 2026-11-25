// ---- /account (Account Page Code) ----

import wixLocationFrontend from 'wix-location-frontend';
import wixWindowFrontend from 'wix-window-frontend';

import { initAiTelemetry, registerModuleState } from 'public/aiTelemetry';
import { initHeaderEngine } from 'public/headerEngine';
import { initSiteMenuEngine } from 'public/fileSiteMenu';
import { initAuthEngine, getActiveUserId } from 'public/authEngine';
import { initRouterEngine, preSnapStateFromUrl, smartGoTo, closeSideMenu, openOverlay, closeAllOverlays, closeTopOverlay, showSuccessMessage, showErrorMessage } from 'public/routerEngine';

import { initProfileEngine, preloadAllProfileData } from 'public/profileEngine';
import { initGarageEngine, loadGarageData, applyVehicleFilter, refreshSelectionUI } from 'public/garageEngine';
import { initVehicleAddEngine, syncVehicleCategories } from 'public/fileVehicleAdd';
import { initContactLocationEngine, fetchContactLocationData, syncContactLocationData, loadEditingAddress, closeCustomLightbox } from 'public/fileContactLocation';
import { initLoginSecurityEngine, loadSecurityData } from 'public/fileLoginSecurity.js';
import { initAutoCaps, initLightboxTitleEngine } from 'public/cartEngine';
import { getVehicleCategories, bindGlobalRepeaterButtons, fetchUserAndCartBundle, getMemoryState } from 'public/stateManager';

$w.onReady(function () {
    // ⚡ 1. SNAP TO URL STATE IMMEDIATELY
    preSnapStateFromUrl($w);

    if (wixWindowFrontend.rendering.env !== "browser") return;

    initAiTelemetry($w);
    console.log("📌 [ACCOUNT_PAGE -> onReady]: Booting Account Page in browser mode...");

    registerModuleState("accountPage", () => {
        /** @type {any} */
        const mem = getMemoryState() || {};
        return {
            url: wixLocationFrontend.url,
            query: wixLocationFrontend.query,
            vehiclesCount: (mem.vehicles || []).length,
            contactsCount: (mem.contacts || []).length,
            locationsCount: (mem.locations || []).length,
            cartCount: (mem.cartData || []).length
        };
    });

    // 2. Load Vehicle Categories & Navigation Buttons (Cached in Session!)
    Promise.all([
        getVehicleCategories().then(cats => {
            console.log(`📌 [ACCOUNT_PAGE -> getVehicleCategories]: Synced ${(cats || []).length} categories`);
            return syncVehicleCategories(cats);
        }),
        bindGlobalRepeaterButtons($w)
    ]).catch(err => console.error("📌 [ACCOUNT_PAGE -> preloadCategoriesError]:", err));

    setTimeout(async () => {
        try {
            initHeaderEngine($w, { smartGoTo });
            initSiteMenuEngine($w, { unlockSlider: () => {} });

            initAuthEngine($w, {
                smartGoTo,
                triggerPageReload: () => {
                    console.log("📌 [ACCOUNT_PAGE -> triggerPageReload]: Reloading account page after auth change");
                    wixLocationFrontend.queryParams.remove(["route"]);
                    closeAllOverlays($w);
                    wixLocationFrontend.to(wixLocationFrontend.url);
                }
            });

            const refreshAccountBundle = async () => {
                console.log("📌 [ACCOUNT_PAGE -> refreshAccountBundle]: Refreshing user & cart bundle...");
                await fetchUserAndCartBundle(true);
            };

            initProfileEngine($w, {
                getActiveUserId, smartGoTo, closeSideMenu,
                closeAllOverlays: () => closeAllOverlays($w),
                loadCalendarCartSlider: () => {}
            });

            initGarageEngine($w, {
                smartGoTo, getActiveUserId, closeSideMenu,
                loadCartData: refreshAccountBundle
            });

            initLoginSecurityEngine($w, { getActiveUserId, smartGoTo, closeTopOverlay, showSuccessMessage, showErrorMessage });

            initContactLocationEngine($w, {
                getActiveUserId, smartGoTo, closeSideMenu,
                closeAllOverlays: () => closeAllOverlays($w),
                closeOverlays: () => closeAllOverlays($w),
                triggerLocationSaveCallback: async () => {
                    console.log("📌 [ACCOUNT_PAGE -> triggerLocationSaveCallback]: Location saved, refreshing account bundle...");
                    await refreshAccountBundle();
                    closeAllOverlays($w);
                    preloadAllProfileData(true);
                }
            });
           
            initVehicleAddEngine($w, {
                getActiveUserId, openOverlay,
                closeOverlays: () => closeAllOverlays($w),
                triggerVehicleSaveCallback: async () => {
                    console.log("📌 [ACCOUNT_PAGE -> triggerVehicleSaveCallback]: Vehicle saved, refreshing garage & bundle...");
                    closeAllOverlays($w, true);
                    showSuccessMessage("Vehicle successfully saved!");
                    await Promise.all([
                        loadGarageData(),
                        refreshAccountBundle()
                    ]);
                }
            });

            // ⚡ 0ms INSTANT REPEATER HYDRATION FROM PRE-WARMED CACHE!
            let mem = getMemoryState();
            if ((mem.contacts && mem.contacts.length > 0) || (mem.locations && mem.locations.length > 0)) {
                console.log(`📌 [ACCOUNT_PAGE -> instantHydration]: Hydrating ${(mem.contacts || []).length} contacts & ${(mem.locations || []).length} locations`);
                syncContactLocationData(mem.contacts, mem.locations);
            }

            initRouterEngine($w, {
                unlockSlider: () => {},
                applyVehicleFilter: (force) => applyVehicleFilter(force),
                refreshSelectionUI: () => refreshSelectionUI(),
                preloadAllProfileData: async () => { await preloadAllProfileData(false); },
                loadCartData: refreshAccountBundle,
                loadEditingAddress: () => loadEditingAddress(),
                closeCustomLightbox: ($wContext) => closeCustomLightbox($wContext),
                loadGarageData: async () => { await loadGarageData(); },
                loadSecurityData: async () => { await loadSecurityData(); },
                loadContactLocationData: async () => { await fetchContactLocationData(); },
            });

            initAutoCaps($w);
            initLightboxTitleEngine($w);
            console.log("📌 [ACCOUNT_PAGE -> bootComplete]: All Account Page engines initialized.");

        } catch (error) {
            console.error("📌 [ACCOUNT_PAGE -> bootError]: 🚨 Account Page Boot Error:", error);
        }
    }, 10);
});