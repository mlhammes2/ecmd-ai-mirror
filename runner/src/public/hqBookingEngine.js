// --- public/hqBookingEngine.js ---

import { initAiTelemetry, askSiteAi, registerModuleState, registerDomElements } from 'public/aiTelemetry';
import { currentMember } from 'wix-members-frontend';
import wixData from 'wix-data';
import { auditAndSyncUpcomingJobs } from 'backend/vehicleClassifier.web';
import { findMatchingServicePackage } from 'public/packageMatcher';
import {
    hqState,
    parseTags,
    closeAllLightboxes,
    safeOpenOffice
} from 'public/hqState';
import {
    createNewTab,
    initTabs,
    paintBookingCart,
    refreshHqCalendarMenuRepeater,
    closeTabAndCalendarMenus
} from 'public/hqTabsAndCart';
import {
    initCalendarButtons,
    initWeeklyRepeater,
    initDailyRepeater,
    generateWeeklyCalendar,
    paintWeeklyCalendarUI,
    loadDailyDetailers,
    syncDailyButtonStyles,
    triggerCancellationLightbox
} from 'public/hqCalendar';
import {
    initPreviousCustomerJobsRepeater,
    loadCustomerHistory,
    closeOfficeMenu,
    refreshOfficeMenuRepeater,
    initOfficeNotesEngine
} from 'public/hqOfficeAndCorrections';
import {
    searchCustomerByPhone,
    loadCustomerForExistingJob,
    resetCustomerDropdowns,
    initVehicleDropdowns,
    openCustomerForm,
    clearCustomerData,
    initVehicleNotesLightbox,
    initBulkDataParsers,
    initFormNavigation,
    initAutoCaps,
    initCustomerConfirmButton
} from 'public/hqCustomerForms';
import {
    loadNewDetailOptions,
    paintSummaryBox,
    calculateDraftTotal,
    applyPackageFilterToDraft,
    refreshCustomAddOnsRepeater,
    loadDraftFromCart,
    clearDetailData,
    initNewDetailEngine,
    syncHqPackagesToVehicle
} from 'public/hqDetailBuilder';

// Re-export functions in case any external page code imports them directly
export {
    searchCustomerByPhone,
    resetCustomerDropdowns,
    openCustomerForm
};

export function refreshCartUI() {
    paintBookingCart(false);
}

// Register cross-module callbacks in hqState
function wireCrossModuleCallbacks() {
    hqState.callbacks.syncDailyButtonStyles = syncDailyButtonStyles;
    hqState.callbacks.loadDailyDetailers = loadDailyDetailers;
    hqState.callbacks.generateWeeklyCalendar = generateWeeklyCalendar;
    hqState.callbacks.paintWeeklyCalendarUI = paintWeeklyCalendarUI;
    hqState.callbacks.refreshCustomAddOnsRepeater = refreshCustomAddOnsRepeater;
    hqState.callbacks.paintSummaryBox = paintSummaryBox;
    hqState.callbacks.clearDetailData = clearDetailData;
    hqState.callbacks.clearCustomerData = clearCustomerData;
    hqState.callbacks.resetCustomerDropdowns = resetCustomerDropdowns;
    hqState.callbacks.openCustomerForm = openCustomerForm;
    hqState.callbacks.loadCustomerForExistingJob = loadCustomerForExistingJob;
    hqState.callbacks.loadCustomerHistory = loadCustomerHistory;
    hqState.callbacks.triggerCancellationLightbox = triggerCancellationLightbox;
    hqState.callbacks.loadDraftFromCart = loadDraftFromCart;
    hqState.callbacks.closeOfficeMenu = closeOfficeMenu;
    hqState.callbacks.refreshHqCalendarMenuRepeater = refreshHqCalendarMenuRepeater;
    hqState.callbacks.closeAllMenus = closeTabAndCalendarMenus;
    hqState.callbacks.syncHqPackagesToVehicle = syncHqPackagesToVehicle;
}

registerModuleState("hqBookingEngine", () => ({
    isVaultUnlocked: hqState.isVaultUnlocked,
    isMenuExpanded: hqState.isMenuExpanded,
    globalDetailersCount: (hqState.globalDetailers || []).length,
    globalJobsCount: (hqState.globalJobs || []).length,
    globalAvailabilityRulesCount: (hqState.globalAvailabilityRules || []).length,
    globalVehicleCategoriesCount: (hqState.globalVehicleCategories || []).length,
    globalTimeSlotsCount: (hqState.globalTimeSlots || []).length,
    globalBookingButtonsCount: (hqState.globalBookingButtons || []).length
}));

registerDomElements({
    msb: ["#msbCustomer", "#msbOffice", "#msbMenu"],
    boxes: ["#primaryInfo", "#closeBox"],
    repeaters: ["#bookingButtonsRep", "#pRepeater"],
    inputs: ["#phoneSearch", "#vehicleDropdown", "#contactDropdown", "#locationDropdown"]
});

export async function initBookingHQEngine(wixContext, providedHooks = {}) {
    console.log("📌 [HQ_BOOKING_ENGINE -> initBookingHQEngine]: Initializing Modular Engine...");
    hqState.$w = wixContext;
    hqState.hooks = providedHooks;
    hqState.isVaultUnlocked = true;
    const $w = hqState.$w;

    initAiTelemetry($w);
    wireCrossModuleCallbacks();

    // 🌟 Force-show the Global Footer HQ buttons whenever Booking HQ boots!
    ["#tabMenu", "#hqCalendarMenu"].forEach(id => {
        if ($w(id).id) {
            if ($w(id).collapsed) $w(id).expand();
            $w(id).show();
        }
    });

    if ($w("#msbCustomer").id) {
        $w("#msbCustomer").changeState("bCalendar").then(() => {
            setTimeout(() => { bootDispatcherEngine(); }, 100);
        });
    } else {
        setTimeout(() => { bootDispatcherEngine(); }, 100);
    }
}

function bootDispatcherEngine() {
    const $w = hqState.$w;
    console.log("🟢 [BOOKING HQ]: Dispatcher System Online");

    authenticateBackendButton();
    initBookingMenu();
    initPageMenu();
    initBookingSummaryButtons();
    initCalendarButtons();

    initTabs();
    hqState.activeTabId = null;
    createNewTab();

    initWeeklyRepeater();
    initDailyRepeater();
    loadCoreData();
    loadNewDetailOptions();
    initNewDetailEngine();
    resetCustomerDropdowns();
    initVehicleNotesLightbox();
    initOfficeNotesEngine();
    initAutoCaps();
    initFormNavigation();
    initBulkDataParsers();
    initCloseBox();
    initCustomerConfirmButton();

    const setupSearchInput = (id) => {
        if ($w(id).id) {
            $w(id).onKeyPress((event) => {
                if (event.key === "Enter") searchCustomerByPhone(id);
            });
            $w(id).onBlur(() => {
                if ($w(id).value && $w(id).value.trim() !== "") searchCustomerByPhone(id);
            });
            $w(id).onFocus(() => {
                if ($w(id).style.color === "rgb(223, 49, 49)" || $w(id).value === "None Found") {
                    $w(id).style.color = "#000000";
                }
            });
            $w(id).onInput(() => {
                $w(id).style.color = "#000000";
                if (!$w(id).value || $w(id).value.trim() === "") clearCustomerData(false);
            });
        }
    };

    setupSearchInput("#phoneSearch");

    if ($w("#phoneSearchButton").id) {
        $w("#phoneSearchButton").onClick(() => searchCustomerByPhone("#phoneSearch"));
    }

    if ($w("#officeClearCustomer").id) {
        $w("#officeClearCustomer").onClick(() => {
            closeOfficeMenu();
            clearCustomerData(false);
        });
    }
    if ($w("#clearCustomerInfo").id) {
        $w("#clearCustomerInfo").onClick(() => {
            closeOfficeMenu();
            clearCustomerData(false);
        });
    }

    initPreviousCustomerJobsRepeater();

    if ($w("#pRepeater").id) {
        $w("#pRepeater").collapse();

        $w("#pRepeater").onItemReady(($item, itemData) => {
            if ($item("#pTitle").id) $item("#pTitle").text = itemData.packageTitle || "Detailing Package";

            if ($item("#pData").id) {
                let dateObj = new Date(itemData.serviceDate);
                let dateStr = isNaN(dateObj.getTime()) ? "Unknown Date" : dateObj.toLocaleDateString('en-US');
                let v = itemData.vehicleInfo || "Unknown Vehicle";

                let l = "Unknown Location";
                if (itemData.address1) {
                    let addr2 = itemData.address2 ? ` ${itemData.address2}` : "";
                    let cityStateZip = `${itemData.city || ""} ${itemData.state || ""} ${itemData.zip || ""}`.trim();
                    l = `${itemData.address1}${addr2}${cityStateZip ? `, ${cityStateZip}` : ""}`;
                } else if (itemData.locationText) {
                    l = itemData.locationText;
                } else if (itemData.city) {
                    l = itemData.city;
                }

                let p = `$${Number(itemData.totalPrice || 0).toFixed(2)}`;
                let dur = `${itemData.totalDuration || itemData.setDuration || "0"} Hrs`;
                let det = itemData.detailerName || itemData.detailer || itemData.detailerAlias || "Unassigned";

                $item("#pData").html = `<p>
                    <b>${dateStr}</b><br/>
                    ${v}<br/>
                    ${l}<br/>
                    ${p} &nbsp;|&nbsp; ${dur}<br/>
                    Assigned: ${det}
                </p>`;
            }

            if ($item("#pViewButton").id) {
                $item("#pViewButton").onClick(() => {
                    let html = `<h4 style="font-family: Arial; color: #000000; margin-bottom: 10px;">${itemData.packageTitle || "Detail"} Summary</h4>`;
                    html += `<ul style="font-family: Arial; font-size: 14px; line-height: 1.8; color: #000000; list-style-type: none; padding-left: 0;">`;
                    html += `<li><b>Base Price:</b> $${Number(itemData.basePrice || 0).toFixed(2)}</li>`;

                    if (itemData.salePackagePrice > 0) html += `<li><b>Sale Price:</b> $${Number(itemData.salePackagePrice).toFixed(2)}</li>`;
                    if (itemData.mobileFee > 0) html += `<li><b>Mobile Fee:</b> $${Number(itemData.mobileFee).toFixed(2)}</li>`;

                    const formatTags = (tags) => (Array.isArray(tags) && tags.length > 0) ? tags.join("<br/>&nbsp;&nbsp;&nbsp;&nbsp;• ") : null;

                    let iAdds = formatTags(itemData.interiorAddOns);
                    if (iAdds) html += `<li><br/><b>Interior Add-Ons:</b><br/>&nbsp;&nbsp;&nbsp;&nbsp;• ${iAdds}</li>`;

                    let eAdds = formatTags(itemData.exteriorAddOns);
                    if (eAdds) html += `<li><br/><b>Exterior Add-Ons:</b><br/>&nbsp;&nbsp;&nbsp;&nbsp;• ${eAdds}</li>`;

                    let cAdds = formatTags(itemData.customAddOns);
                    if (cAdds) html += `<li><br/><b>Custom Add-Ons:</b><br/>&nbsp;&nbsp;&nbsp;&nbsp;• ${cAdds}</li>`;

                    let dAdds = formatTags(itemData.discountsApplied);
                    if (dAdds) html += `<li><br/><b>Discounts Applied:</b><br/>&nbsp;&nbsp;&nbsp;&nbsp;• ${dAdds}</li>`;

                    html += `<li><br/><b>Total Price:</b> $${Number(itemData.totalPrice || 0).toFixed(2)}</li>`;
                    html += `<li><b>Duration:</b> ${itemData.totalDuration || itemData.setDuration || "0"} Hrs</li>`;

                    let phoneBooked = itemData.wasBookedByPhone ? "Yes" : "No";
                    html += `<li><b>Booked By Phone:</b> ${phoneBooked}</li>`;

                    if (itemData.officeNotes) {
                        html += `<li><br/><b>Office Notes:</b><br/>${itemData.officeNotes}</li>`;
                    }

                    html += `</ul>`;

                    if ($w("#detailDataText").id) $w("#detailDataText").html = html;
                    if ($w("#msbCustomer").id) $w("#msbCustomer").changeState("bDetailData");
                });
            }

            if ($item("#pLoadDataButton").id) {
                $item("#pLoadDataButton").onClick(() => {
                    let cd = hqState.currentDraft;
                    $w("#pRepeater").forEachItem(($i) => {
                        if ($i("#pItem").id) $i("#pItem").style.borderColor = "#000000";
                    });

                    $item("#pItem").style.borderColor = "#17E6AD";
                    cd.loadedJobId = itemData._id;

                    if (itemData.vehicleId && $w("#vehicleDropdown").id) {
                        $w("#vehicleDropdown").value = itemData.vehicleId;
                        cd.vehicleId = itemData.vehicleId;
                    }
                    if (itemData.contactId && $w("#contactDropdown").id) {
                        $w("#contactDropdown").value = itemData.contactId;
                        cd.contactId = itemData.contactId;
                    }
                    if (itemData.locationId && $w("#locationDropdown").id) {
                        $w("#locationDropdown").value = itemData.locationId;
                        cd.locationId = itemData.locationId;
                    }

                    cd.packageTitle = itemData.packageTitle || "Previous Detail";
                    cd.basePrice = itemData.basePrice || itemData.totalPrice || 0;
                    cd.mobileFee = itemData.mobileFee || 0;
                    cd.totalPrice = itemData.totalPrice || 0;
                    cd.setDuration = itemData.totalDuration || itemData.setDuration || "3";
                    cd.officeNotes = itemData.officeNotes || "";

                    cd.interiorAddOns = parseTags(itemData.interiorAddOns);
                    cd.exteriorAddOns = parseTags(itemData.exteriorAddOns);
                    cd.customAddOns = parseTags(itemData.customAddOns);
                    cd.discountsApplied = parseTags(itemData.discountsApplied);

                    refreshCustomAddOnsRepeater();

                    if ($w("#masterPriceInput").id) $w("#masterPriceInput").value = (itemData.totalPrice || 0).toString();
                    if ($w("#newDurationInput").id) $w("#newDurationInput").value = (itemData.totalDuration || itemData.setDuration || "3").toString();
                    if ($w("#newNotes").id) $w("#newNotes").value = cd.officeNotes;

                    cd.vehicleInfo = itemData.vehicleInfo || "Unknown Vehicle";
                    cd.contactInfo = itemData.customerName || itemData.primaryContactText || "Unknown Contact";
                    cd.locationInfo = itemData.locationText || "Unknown Location";

                    let rawVeh = hqState.globalCustomerVehicles.find(v => String(v._id) === String(itemData.vehicleId));
                    let matchedPkg = findMatchingServicePackage(
                        hqState.globalPackages,
                        itemData,
                        rawVeh?.vehicleType || itemData.vehicleType || ""
                    );

                    if (matchedPkg) {
                        applyPackageFilterToDraft(matchedPkg._id, false);
                    } else {
                        cd.packageTitle = itemData.packageTitle || "Previous Detail";
                        cd.basePrice = itemData.basePrice || itemData.totalPrice || 0;
                        if ($w("#newPackagesDropdown").id) $w("#newPackagesDropdown").value = null;
                    }

                    cd.setDuration = itemData.totalDuration || itemData.setDuration || "3";
                    calculateDraftTotal();
                    cd.totalPrice = itemData.totalPrice || 0;

                    paintSummaryBox();
                    refreshCustomAddOnsRepeater();

                    if ($w("#msbCustomer").id) {
                        $w("#msbCustomer").changeState("bNewDetail");
                    }
                });
            }
        });
    }

    const updateActiveCartItem = (type, newId, dropdownElement) => {
        if (!hqState.selectedCartItemId) return;
        let cartItem = hqState.globalCart.find(c => c._id === hqState.selectedCartItemId);
        if (!cartItem) return;

        let opt = dropdownElement.options.find(o => o.value === newId);
        let resolvedText = opt ? opt.label : "Unknown";

        if (type === "vehicle") {
            cartItem.vehicleId = newId;
            cartItem.resolvedVehicle = resolvedText;
            cartItem.rawVehicle = hqState.globalCustomerVehicles.find(v => v._id === newId) || null;
        } else if (type === "contact") {
            cartItem.contactId = newId;
            cartItem.resolvedContact = resolvedText;
            cartItem.rawContact = hqState.globalCustomerContacts.find(a => a._id === newId) || null;
        } else if (type === "location") {
            cartItem.locationId = newId;
            cartItem.resolvedLocation = resolvedText;
            cartItem.rawLocation = hqState.globalCustomerLocations.find(a => a._id === newId) || null;
        }

        paintBookingCart(false);
    };

    if ($w("#vehicleDropdown").id) {
        $w("#vehicleDropdown").onChange((e) => {
            if (e.target.value === "ADD_NEW_VEHICLE") {
                if ($w("#msbCustomer").id) $w("#msbCustomer").changeState("bVehicleInfo");
                if ($w("#msbOffice").id) closeAllLightboxes();
                $w("#vehicleDropdown").value = hqState.currentDraft.vehicleId || null;
            } else {
                hqState.currentDraft.vehicleId = e.target.value;
                syncHqPackagesToVehicle(e.target.value);
                paintSummaryBox();
                updateActiveCartItem("vehicle", e.target.value, $w("#vehicleDropdown"));
            }
        });
    }

    if ($w("#contactDropdown").id) {
        $w("#contactDropdown").onChange((e) => {
            if (e.target.value === "ADD_NEW_CONTACT") {
                openCustomerForm("contact");
                $w("#contactDropdown").value = hqState.currentDraft.contactId || null;
            } else {
                hqState.currentDraft.contactId = e.target.value;
                paintSummaryBox();
                updateActiveCartItem("contact", e.target.value, $w("#contactDropdown"));
            }
        });
    }

    if ($w("#locationDropdown").id) {
        $w("#locationDropdown").onChange((e) => {
            if (e.target.value === "ADD_NEW_LOCATION") {
                openCustomerForm("location");
                $w("#locationDropdown").value = hqState.currentDraft.locationId || null;
            } else {
                hqState.currentDraft.locationId = e.target.value;
                paintSummaryBox();
                updateActiveCartItem("location", e.target.value, $w("#locationDropdown"));
            }
        });
    }

    if ($w("#addMember").id && $w("#msbCustomer").id) {
        $w("#addMember").onClick(() => openCustomerForm("member"));
    }

    const setupStateNav = (btnId, stateName) => {
        if ($w(btnId).id && $w("#msbCustomer").id) {
            $w(btnId).onClick(() => {
                $w("#msbCustomer").changeState(stateName);
            });
        }
    };

    setupStateNav("#searchHome", "search");
    setupStateNav("#addInfo", "bVehicleInfo");
    setupStateNav("#backData", "bPrevDetail");
}

function initBookingMenu() {
    const $w = hqState.$w;
    if (!$w || !$w("#bookingButtonsRep").id) return;

    $w("#bookingButtonsRep").onItemReady(($item, itemData) => {
        if ($item("#cmsMenuButton").id) {
            $item("#cmsMenuButton").label = itemData.title;

            if (itemData.image) {
                $item("#cmsMenuButton").icon = itemData.image;
            }

            $item("#cmsMenuButton").onClick(() => {
                if (!hqState.isVaultUnlocked) return;

                let target = itemData.targetState;
                let t = (itemData.title || "").toLowerCase();

                if (target === "customerInfoButton" || target === "#customerInfoButton" || t.includes("customer") || t.includes("info")) {
                    safeOpenOffice("customerInfoBox");
                    return;
                }

                if (!target) {
                    if (t.includes("prev")) target = "bPrevDetail";
                    else if (t.includes("new") || t.includes("detail")) target = "bNewDetail";
                    else if (t.includes("vehicle")) target = "bVehicleInfo";
                    else if (t.includes("calendar")) target = "bCalendar";
                }

                if (target === "bcalendar") target = "bCalendar";

                if (target && $w("#msbCustomer").id) {
                    $w("#msbCustomer").changeState(target).then(() => {});
                }
            });
        }
    });
}

async function loadCoreData() {
    try {
        let ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        ninetyDaysAgo.setHours(0, 0, 0, 0);

        let [detRes, jobsRes, rulesRes, catRes, allButtonsRes, slotsRes] = await Promise.all([
            wixData.query("contractors").eq("isActiveDetailer", true).find(),
            wixData.query("scheduledJobs").ne("status", "Cancelled").ge("serviceDate", ninetyDaysAgo).descending("serviceDate").limit(1000).find(),
            wixData.query("availabilityRules").find(),
            wixData.query("vehicleCategories").ascending("sort").limit(200).find(),
            wixData.query("siteButtons").ascending("sort").limit(200).find(),
            wixData.query("calendarTimeSlots").ascending("expectedHour").find().catch(() => ({ items: [] }))
        ]);

        hqState.globalDetailers = detRes.items || [];
        hqState.globalJobs = jobsRes.items || [];
        hqState.globalAvailabilityRules = rulesRes.items || [];
        hqState.globalVehicleCategories = catRes.items || [];
        hqState.globalTimeSlots = slotsRes.items || [];

        let allBtns = allButtonsRes.items || [];
        hqState.globalBookingButtons = allBtns.filter(b => (b.category || "").toLowerCase() === "booking");
        hqState.globalViewButtons = allBtns.filter(b => (b.category || "").toLowerCase() === "view");
        hqState.globalOfficeButtons = allBtns.filter(b => {
            let cat = (b.category || "").toLowerCase().trim();
            return cat === "officemenu" || cat === "office menu" || cat === "office";
        });
        hqState.globalHqButtons = allBtns.filter(b => {
            let cat = (b.category || "").toLowerCase().trim();
            return cat === "hqbuttons" || cat === "hqbutton" || cat === "hq buttons";
        });

        refreshBookingMenu();
        refreshOfficeMenuRepeater();
        refreshHqCalendarMenuRepeater();
        initVehicleDropdowns();
        generateWeeklyCalendar();

        // 🔄 Silently audit & sync all upcoming scheduledJobs and customerVehicles in the background
        auditAndSyncUpcomingJobs().then(async (auditRes) => {
            if (auditRes && auditRes.success && (auditRes.updatedJobsCount > 0 || auditRes.updatedVehiclesCount > 0)) {
                console.log(`✅ [HQ AUTO-AUDIT]: Corrected ${auditRes.updatedVehiclesCount} vehicle(s) and ${auditRes.updatedJobsCount} upcoming job(s). Refreshing HQ calendar...`);
                let freshJobsRes = await wixData.query("scheduledJobs")
                    .ne("status", "Cancelled")
                    .ge("serviceDate", ninetyDaysAgo)
                    .descending("serviceDate")
                    .limit(1000)
                    .find();
                hqState.globalJobs = freshJobsRes.items || [];
                generateWeeklyCalendar(hqState.currentWeekStartObj);
                loadDailyDetailers();
            }
        }).catch(err => console.warn("Background vehicle audit skipped:", err));
    } catch (error) {
        console.error("🚨 Error loading core data:", error);
    }
}

function initCloseBox() {
    // Handled by routerEngine.js (#lightboxBackground -> closeAllOverlays -> closeAllLightboxes)
}

function initBookingSummaryButtons() {
    const $w = hqState.$w;
    if ($w && $w("#msbOffice").id) {
        $w("#msbOffice").onMouseIn(() => { hqState.isHoveringOffice = true; });
        $w("#msbOffice").onMouseOut(() => { hqState.isHoveringOffice = false; });
    }
}

function refreshBookingMenu() {
    const $w = hqState.$w;
    if (!$w || !$w("#bookingButtonsRep").id || hqState.globalBookingButtons.length === 0) return;

    let actionButtons = [...hqState.globalBookingButtons];
    actionButtons.sort((a, b) => {
        if (a.sort !== undefined && b.sort !== undefined) return a.sort - b.sort;
        return (a.title || "").localeCompare(b.title || "");
    });

    $w("#bookingButtonsRep").data = actionButtons;
}

async function authenticateBackendButton() {
    const $w = hqState.$w;
    try {
        const member = await currentMember.getMember().catch(() => null);
        let memberEmail = member ? (member.loginEmail || (member.contactDetails?.emails?.[0])) : null;

        if (memberEmail) {
            let [conRes, staffRes] = await Promise.all([
                wixData.query("contractors").contains("email", memberEmail.trim()).find().catch(() => ({ items: [] })),
                wixData.query("Staff").contains("email", memberEmail.trim()).find().catch(() => ({ items: [] }))
            ]);

            let isManagerOrAdmin = (conRes.items.length > 0 && conRes.items[0].isAdmin === true);
            if (!isManagerOrAdmin && staffRes.items.length > 0) {
                let userRoles = staffRes.items[0].roles || [];
                if (userRoles.includes("Manager") || userRoles.includes("Dispatcher")) isManagerOrAdmin = true;
            }

            if (isManagerOrAdmin && $w("#backendButton").id) {
                $w("#backendButton").expand();
            }
        }
    } catch (err) {
        console.error("Failed to authenticate user role: ", err);
    }
}

function initPageMenu() {
    const $w = hqState.$w;
    if ($w && $w("#menuButton").id) {
        $w("#menuButton").onClick(() => {
            if (!hqState.isVaultUnlocked) return;

            if (!hqState.isMenuExpanded) {
                hqState.isMenuExpanded = true;

                if ($w("#msbMenu").id) {
                    $w("#msbMenu").expand();
                    $w("#msbMenu").show();
                }

                if ($w("#closeBox").id) {
                    try { $w("#closeBox").style.backgroundColor = "rgba(0, 0, 0, 0)"; } catch (e) {}
                    $w("#closeBox").show();
                }
            } else {
                closeAllLightboxes();
            }
        });
    }
}

