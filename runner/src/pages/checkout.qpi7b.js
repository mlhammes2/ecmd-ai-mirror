// ---- /checkout (Checkout Page Code) ----

import wixData from 'wix-data';
import wixLocationFrontend from 'wix-location-frontend';
import wixWindowFrontend from 'wix-window-frontend';

import { initAiTelemetry, registerModuleState } from 'public/aiTelemetry';
import { initHeaderEngine } from 'public/headerEngine';
import { initSiteMenuEngine } from 'public/fileSiteMenu';
import { initAuthEngine, getActiveUserId } from 'public/authEngine';
import { initRouterEngine, preSnapStateFromUrl, smartGoTo, closeSideMenu, openOverlay, closeAllOverlays, closeTopOverlay, showSuccessMessage, showErrorMessage } from 'public/routerEngine';

import { initProfileEngine, preloadAllProfileData } from 'public/profileEngine';
import { initCartUIEngine, syncCartData, getSelectedCartItemIds, refreshCartVisuals, getFreshCartData, processCalendarClick, syncSingleCartItem, processDesktopSlotSelection, loadCalendarCartSlider, executeReschedule } from 'public/cartUIEngine';
import { initCartEdits } from 'public/fileCartEdits';
import { initCalendarEngine, initDetailerDropdown, releaseHeldTimeSlots } from 'public/calendarEngine';
import { initSummaryEngine, updateSummary } from 'public/fileSummary';
import { initDetailInfoEngine, syncDetailJobs, injectUpdatedJob, restoreActiveJob, executeProfileJobEdit, restoreCartEditsSession } from 'public/fileDetailInfo.js';
import { initPackageEditEngine } from 'public/filePackageEdits';
import { initContactLocationEngine, syncContactLocationData, fetchContactLocationData, loadEditingAddress, closeCustomLightbox } from 'public/fileContactLocation';
import { initVehicleAddEngine, syncVehicleCategories } from 'public/fileVehicleAdd';
import { initCartHoverEffects, initLightboxTitleEngine, initAutoCaps } from 'public/cartEngine';
import { setPackageData } from 'public/packagesEngine';

import { getCatalogData, getVehicleCategories, bindGlobalRepeaterButtons, fetchUserAndCartBundle, getMemoryState } from 'public/stateManager';

$w.onReady(function () {
    // ⚡ 1. SNAP TO URL STATE IMMEDIATELY (Runs on Server + Browser before paint!)
    preSnapStateFromUrl($w);

    // 🛑 2. Now stop SSR from running database queries or browser-only engines
    if (wixWindowFrontend.rendering.env !== "browser") return;

    initAiTelemetry($w);
    console.log("📌 [CHECKOUT_PAGE -> onReady]: Booting Checkout Page in browser mode...");

    registerModuleState("checkoutPage", () => {
        /** @type {any} */
        const mem = getMemoryState() || {};
        return {
            url: wixLocationFrontend.url,
            query: wixLocationFrontend.query,
            selectedCartItemIds: getSelectedCartItemIds(),
            freshCartCount: (getFreshCartData() || []).length,
            memVehiclesCount: (mem.vehicles || []).length,
            memContactsCount: (mem.contacts || []).length,
            memLocationsCount: (mem.locations || []).length,
            memDetailersCount: (mem.detailers || []).length,
            memJobsCount: (mem.jobs || []).length
        };
    });

    // Load cached catalog & categories for summary/package edits
    Promise.all([
        getCatalogData().then(({ allData, packages }) => {
            console.log(`📌 [CHECKOUT_PAGE -> getCatalogData]: Loaded ${(packages || []).length} packages & ${(allData || []).length} catalog items`);
            setPackageData(allData, packages);
        }),
        getVehicleCategories().then(cats => syncVehicleCategories(cats))
    ]).catch(err => console.error("📌 [CHECKOUT_PAGE -> catalogPreloadError]:", err));

    let calendarHooks = {};

    const loadCheckoutCartData = async () => {
        console.log("📌 [CHECKOUT_PAGE -> loadCheckoutCartData]: Fetching catalog & user/cart bundle...");
        let [catalog, mem] = await Promise.all([
            getCatalogData(),
            fetchUserAndCartBundle(false)
        ]);
        await syncCartData(mem.cartData, mem.vehicles, mem.contacts, mem.locations, mem.detailers, catalog.allData);
    };

    setTimeout(async () => {
        try {
            initHeaderEngine($w, { smartGoTo });
            initSiteMenuEngine($w, { unlockSlider: () => {} });

            initAuthEngine($w, {
                smartGoTo,
                triggerPageReload: () => {
                    console.log("📌 [CHECKOUT_PAGE -> triggerPageReload]: Reloading checkout page after auth update");
                    wixLocationFrontend.queryParams.remove(["route"]);
                    closeAllOverlays($w);
                    wixLocationFrontend.to(wixLocationFrontend.url);
                }
            });

            initCartUIEngine($w, {
                getActiveUserId,
                loadCartData: loadCheckoutCartData,
                loadGarageData: async () => {},
                smartGoTo,
                syncCartData,
                unlockSlider: () => {},
                forceCalendarRepaint: () => { if (calendarHooks.forceCalendarRepaint) calendarHooks.forceCalendarRepaint(); }
            });

            initSummaryEngine($w, {
                smartGoTo, closeAllOverlays, unlockSlider: () => {},
                refreshCartVisuals: () => refreshCartVisuals(),
                loadCartData: loadCheckoutCartData
            });

            initProfileEngine($w, {
                getActiveUserId, smartGoTo, closeSideMenu,
                closeAllOverlays: () => closeAllOverlays($w),
                loadCalendarCartSlider
            });

            initDetailInfoEngine($w, {
                smartGoTo,
                getActiveUserId,
                getGlobalVehicles: () => getMemoryState().vehicles,
                getGlobalContacts: () => getMemoryState().contacts,
                getGlobalLocations: () => getMemoryState().locations,
                loadCalendarCartSlider,
                closeAllOverlays: () => closeAllOverlays($w)
            });

            initPackageEditEngine($w, { injectUpdatedJob });

            initContactLocationEngine($w, {
                getActiveUserId, smartGoTo, closeSideMenu,
                closeAllOverlays: () => closeAllOverlays($w),
                closeOverlays: () => closeAllOverlays($w),
                triggerLocationSaveCallback: async () => {
                    console.log("📌 [CHECKOUT_PAGE -> triggerLocationSaveCallback]: Location saved, reloading checkout cart data...");
                    await loadCheckoutCartData();
                    closeAllOverlays($w);
                    preloadAllProfileData(true);
                }
            });

            initVehicleAddEngine($w, {
                getActiveUserId, openOverlay,
                closeOverlays: () => closeAllOverlays($w),
                triggerVehicleSaveCallback: async () => {
                    console.log("📌 [CHECKOUT_PAGE -> triggerVehicleSaveCallback]: Vehicle saved, reloading checkout cart data...");
                    closeAllOverlays($w, true);
                    showSuccessMessage("Vehicle successfully saved!");
                    await loadCheckoutCartData();
                }
            });

            initCartEdits($w, {
                openOverlay,
                executeProfileJobEdit: async (id, updates) => await executeProfileJobEdit(id, updates),
                updateCartItemData: async (item) => {
                    console.log(`📌 [CHECKOUT_PAGE -> updateCartItemData]: Updating cart item ${item?._id}`);
                    await wixData.update("temporaryData", item);
                    syncSingleCartItem(item);
                },
                finishCartEdits: async (isRoutingToCalendar, isCartMenuEdit) => {
                    console.log(`📌 [CHECKOUT_PAGE -> finishCartEdits]: isRoutingToCalendar=${isRoutingToCalendar}, isCartMenuEdit=${isCartMenuEdit}`);
                    if (isRoutingToCalendar) {
                        loadCalendarCartSlider(); closeAllOverlays($w); smartGoTo("calendarProfileState");
                    } else if (isCartMenuEdit) {
                        closeAllOverlays($w); smartGoTo("cartProfileState"); refreshCartVisuals();
                    }
                }
            });

            // ⚡ 0ms INSTANT REPEATER HYDRATION FROM PRE-WARMED CACHE!
            bindGlobalRepeaterButtons($w);

            let mem = getMemoryState();
            if (mem.userAllJobs && mem.userAllJobs.length > 0) {
                syncDetailJobs(mem.userAllJobs);
            }
            if ((mem.contacts && mem.contacts.length > 0) || (mem.locations && mem.locations.length > 0)) {
                syncContactLocationData(mem.contacts, mem.locations);
            }
            if (mem.cartData && mem.cartData.length > 0) {
                syncCartData(mem.cartData, mem.vehicles, mem.contacts, mem.locations, mem.detailers, mem.allData || []);
            }

            initRouterEngine($w, {
                unlockSlider: () => {},
                refreshCartUI: () => refreshCartVisuals(),
                triggerCalendarCheck: () => processCalendarClick(),
                preloadAllProfileData: async () => { await preloadAllProfileData(false); },
                loadCartData: loadCheckoutCartData,
                loadEditingAddress: () => loadEditingAddress(),
                closeCustomLightbox: ($wContext) => closeCustomLightbox($wContext),
                releaseCalendarSlots: releaseHeldTimeSlots,
                restoreActiveJob: async () => { await restoreActiveJob(); },
                restoreCartEditsSession: async () => { await restoreCartEditsSession(); },
                loadCalendarCartSlider: async () => { await loadCalendarCartSlider(); },
                loadContactLocationData: async () => { await fetchContactLocationData(); },
            });

            initAutoCaps($w);
            initCartHoverEffects($w);
            initLightboxTitleEngine($w);
            initDetailerDropdown($w);

            if ($w("#calendarButton").id) {
                $w("#calendarButton").onClick(() => processCalendarClick());
            }

            calendarHooks = {
                smartGoTo,
                showSuccessMessage,
                showErrorMessage,
                loadCartData: loadCheckoutCartData,
                executeReschedule,
                getGlobalJobs: () => getMemoryState().jobs,
                getGlobalDetailers: () => getMemoryState().detailers,
                getGlobalRules: () => getMemoryState().rules,
                getCartData: () => getFreshCartData(),
                getGlobalContacts: () => getMemoryState().contacts,
                getGlobalLocations: () => getMemoryState().locations,
                getGlobalVehicles: () => getMemoryState().vehicles,
                triggerMissingInfoFlow: (cartItemId, detailerId, timeString, dateString, timeToken) => {
                    processDesktopSlotSelection(cartItemId, detailerId, timeString, dateString, timeToken);
                },
                getSelectedCartItemIds: () => getSelectedCartItemIds(),
                updateCartItemData: async (item) => {
                    await wixData.update("temporaryData", item);
                    syncSingleCartItem(item);
                },
                refreshCartVisuals: () => refreshCartVisuals()
            };
            initCalendarEngine($w, calendarHooks);
            console.log("📌 [CHECKOUT_PAGE -> bootComplete]: All Checkout Page engines initialized.");

        } catch (error) {
            console.error("📌 [CHECKOUT_PAGE -> bootError]: 🚨 Checkout Page Boot Error:", error);
        }
    }, 10);
});