// --- public/hqCustomerForms.js ---

import wixData from 'wix-data';
import { registerCustomerFromHQ } from 'backend/admin-tools.web';
import { secureUpdateJob } from 'backend/emailDispatchEngine';
import { formatPhoneNumber } from 'public/cartEngine';
import { verifyVehicleType } from 'backend/vehicleClassifier.web';
import {
    hqState,
    closeAllLightboxes
} from 'public/hqState';
import {
    paintBookingCart
} from 'public/hqTabsAndCart';
import {
    padPreviousJobsList,
    loadCustomerHistory
} from 'public/hqOfficeAndCorrections';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

registerModuleState("hqCustomerForms", () => ({
    activeCustomerId: hqState.currentDraft?.customerId || null,
    primaryContactText: hqState.currentDraft?.primaryContactText || null,
    selectedVehicleId: hqState.currentDraft?.vehicleId || null,
    selectedContactId: hqState.currentDraft?.contactId || null,
    selectedLocationId: hqState.currentDraft?.locationId || null,
    loadedVehiclesCount: (hqState.globalCustomerVehicles || []).length,
    loadedContactsCount: (hqState.globalCustomerContacts || []).length,
    loadedLocationsCount: (hqState.globalCustomerLocations || []).length,
    isSavingInfo: Boolean(hqState.isSavingInfo)
}));

registerDomElements({
    boxes: ["#primaryInfo", "#vehicleLightbox", "#customNotesBox"],
    inputs: [
        "#phoneSearch", "#vehicleDropdown", "#contactDropdown", "#locationDropdown",
        "#bulkName", "#bulkAddress", "#bulkVehicle",
        "#newContactFirstName", "#newContactLastName", "#newContactPhone", "#newContactEmail",
        "#newLocationAddress1", "#newLocationAddress2", "#newLocationCity", "#newLocationState", "#newLocationZip",
        "#newVehicleCategoryDropBox", "#newVehicleTypeDropBox", "#newVehicleYear",
        "#newVehicleMake", "#newVehicleModel", "#newVehicleColor", "#newVehicleLength",
        "#customNotesInput"
    ]
});

export async function searchCustomerByPhone(inputElementId = "#phoneSearch") {
    const $w = hqState.$w;
    if (!$w) return;

    let searchBox = $w(inputElementId);
    let rawInput = searchBox.value;

    if (!rawInput || rawInput.trim() === "") {
        clearCustomerData(false);
        return;
    }

    if ($w("#phoneSearchButton").id) {
        $w("#phoneSearchButton").disable();
        $w("#phoneSearchButton").label = "Searching...";
    }

    let cleanedPhone = rawInput.replace(/\D/g, '');
    let formattedPhone = formatPhoneNumber(rawInput);

    try {
        let profileRes = await wixData.query("customerProfiles")
            .eq("phone", formattedPhone)
            .or(wixData.query("customerProfiles").eq("phone", cleanedPhone))
            .find();

        if (profileRes.items.length === 0) {
            let contactMatch = await wixData.query("customerContacts")
                .eq("phone", formattedPhone)
                .or(wixData.query("customerContacts").eq("phone", cleanedPhone))
                .find();

            if (contactMatch.items.length > 0 && contactMatch.items[0].userId) {
                profileRes = await wixData.query("customerProfiles")
                    .eq("_id", contactMatch.items[0].userId)
                    .find();
            }
        }

        if (profileRes.items.length > 0) {
            let customer = profileRes.items[0];

            hqState.currentDraft.customerId = customer._id;
            hqState.currentDraft.primaryContactText = `${customer.firstName || ''} ${customer.lastName || ''} - ${customer.phone || ''}`.trim();

            if ($w("#primaryContactInfo").id) {
                $w("#primaryContactInfo").text = hqState.currentDraft.primaryContactText;
            }
            if ($w("#primaryLocationInfo").id) {
                $w("#primaryLocationInfo").text = `${customer.address1 || ''} ${customer.address2 || ''} ${customer.city || ''}, ${customer.state || ''} ${customer.zip || ''}`.replace(/\s+/g, ' ').trim();
            }
            if ($w("#cHasSubscription").id) {
                $w("#cHasSubscription").text = customer.activeSubscription ? "Customer has Subscription" : "NO current Subscription";
            }

            if ($w("#primaryInfo").id) $w("#primaryInfo").expand();
            if ($w("#phoneSearch").id) $w("#phoneSearch").value = formattedPhone;

            await Promise.all([
                loadCustomerDropdowns(customer._id),
                loadCustomerHistory(customer._id)
            ]);

            if (hqState.currentWeekStartObj) hqState.callbacks.generateWeeklyCalendar(hqState.currentWeekStartObj);
            else hqState.callbacks.generateWeeklyCalendar();

        } else {
            console.log("FAIL: No customer found.");
            searchBox.style.color = "#DF3131";

            if ($w("#newContactPhone").id) {
                $w("#newContactPhone").value = formattedPhone;
            }
        }
    } catch (error) {
        console.error("SEARCH ERROR:", error);
    } finally {
        if ($w("#phoneSearchButton").id) {
            $w("#phoneSearchButton").enable();
            $w("#phoneSearchButton").label = "Search";
        }
    }
}

export async function loadCustomerForExistingJob(userId) {
    const $w = hqState.$w;
    if (!$w || !userId) return;

    try {
        let profileRes = await wixData.query("customerProfiles").eq("_id", userId).find();
        if (profileRes.items.length > 0) {
            let customer = profileRes.items[0];
            hqState.currentDraft.customerId = customer._id;
            hqState.currentDraft.primaryContactText = `${customer.firstName || ''} ${customer.lastName || ''} - ${customer.phone || ''}`.trim();

            if ($w("#primaryContactInfo").id) {
                $w("#primaryContactInfo").text = hqState.currentDraft.primaryContactText;
            }
            if ($w("#primaryLocationInfo").id) {
                $w("#primaryLocationInfo").text = `${customer.address1 || ''} ${customer.address2 || ''} ${customer.city || ''}, ${customer.state || ''} ${customer.zip || ''}`.replace(/\s+/g, ' ').trim();
            }

            if ($w("#primaryInfo").id) $w("#primaryInfo").expand();
            if ($w("#phoneSearch").id) $w("#phoneSearch").value = formatPhoneNumber(customer.phone);

            await Promise.all([
                loadCustomerDropdowns(customer._id),
                loadCustomerHistory(customer._id)
            ]);
        }
    } catch (err) {
        console.error("🚨 Error loading customer for edit:", err);
    }
}

export async function loadCustomerDropdowns(customerId) {
    const $w = hqState.$w;
    if (!$w) return;

    try {
        let [vehRes, conRes, locRes] = await Promise.all([
            wixData.query("customerVehicles").eq("userId", customerId).ne("archived", true).find(),
            wixData.query("customerContacts").eq("userId", customerId).ne("archived", true).find(),
            wixData.query("customerLocations").eq("userId", customerId).ne("archived", true).find()
        ]);

        hqState.globalCustomerVehicles = vehRes.items || [];
        hqState.globalCustomerContacts = conRes.items || [];
        hqState.globalCustomerLocations = locRes.items || [];

        let vehOptions = hqState.globalCustomerVehicles.map(v => ({
            label: `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim(),
            value: v._id
        }));
        vehOptions.push({ label: "+ Add New Vehicle", value: "ADD_NEW_VEHICLE" });

        if ($w("#vehicleDropdown").id) {
            $w("#vehicleDropdown").options = vehOptions;
            if (vehOptions.length > 1) {
                $w("#vehicleDropdown").value = vehOptions[0].value;
                hqState.currentDraft.vehicleId = vehOptions[0].value;
            } else {
                $w("#vehicleDropdown").value = null;
            }
        }

        let contactOptions = hqState.globalCustomerContacts.map(c => ({
            label: `${c.firstName || ''} ${c.lastName || ''} - ${formatPhoneNumber(c.phone)}`.trim(),
            value: c._id
        }));
        contactOptions.push({ label: "+ Add New Contact", value: "ADD_NEW_CONTACT" });

        if ($w("#contactDropdown").id) {
            $w("#contactDropdown").options = contactOptions;
            if (contactOptions.length > 1) {
                $w("#contactDropdown").value = contactOptions[0].value;
                hqState.currentDraft.contactId = contactOptions[0].value;
            } else {
                $w("#contactDropdown").value = null;
            }
        }

        let locOptions = hqState.globalCustomerLocations.map(l => {
            let addr2 = l.address2 ? `${l.address2} ` : "";
            let cityState = (l.city && l.state) ? `${l.city}, ${l.state}` : (l.city || l.state || "");
            return { label: `${l.address1 || ''} ${addr2}- ${cityState}`.trim(), value: l._id };
        });
        locOptions.push({ label: "+ Add New Location", value: "ADD_NEW_LOCATION" });

        if ($w("#locationDropdown").id) {
            $w("#locationDropdown").options = locOptions;
            if (locOptions.length > 1) {
                $w("#locationDropdown").value = locOptions[0].value;
                hqState.currentDraft.locationId = locOptions[0].value;
            } else {
                $w("#locationDropdown").value = null;
            }
        }

        hqState.callbacks.paintSummaryBox();
        attachCustomerToActiveCartItem();

    } catch (error) {
        console.error("🚨 Error loading dropdowns:", error);
    }
}

export function resetCustomerDropdowns() {
    const $w = hqState.$w;
    if (!$w) return;

    if ($w("#vehicleDropdown").id) {
        $w("#vehicleDropdown").options = [{ label: "+ Add New Vehicle", value: "ADD_NEW_VEHICLE" }];
        $w("#vehicleDropdown").value = null;
    }
    if ($w("#contactDropdown").id) {
        $w("#contactDropdown").options = [{ label: "+ Add New Contact", value: "ADD_NEW_CONTACT" }];
        $w("#contactDropdown").value = null;
    }
    if ($w("#locationDropdown").id) {
        $w("#locationDropdown").options = [{ label: "+ Add New Location", value: "ADD_NEW_LOCATION" }];
        $w("#locationDropdown").value = null;
    }
}

export function attachCustomerToActiveCartItem() {
    const $w = hqState.$w;
    if (!$w || !hqState.selectedCartItemId || !hqState.currentDraft.customerId) return;

    let cartItem = hqState.globalCart.find(c => c._id === hqState.selectedCartItemId);
    // Do NOT overwrite an existing booked job ("Prev" tab) or Correction tab with default dropdown items!
    if (!cartItem || cartItem.isExistingBooking || cartItem.originalJobId || cartItem.isCorrectionDraft) return;

    cartItem.customerId = hqState.currentDraft.customerId;

    cartItem.vehicleId = hqState.currentDraft.vehicleId;
    if ($w("#vehicleDropdown").id && hqState.currentDraft.vehicleId) {
        let opt = $w("#vehicleDropdown").options.find(o => o.value === hqState.currentDraft.vehicleId);
        cartItem.resolvedVehicle = opt ? opt.label : "Pending Vehicle...";
        cartItem.rawVehicle = hqState.globalCustomerVehicles.find(v => v._id === hqState.currentDraft.vehicleId);
    }

    cartItem.contactId = hqState.currentDraft.contactId;
    if ($w("#contactDropdown").id && hqState.currentDraft.contactId) {
        let opt = $w("#contactDropdown").options.find(o => o.value === hqState.currentDraft.contactId);
        cartItem.resolvedContact = opt ? opt.label : "Pending Contact...";
        cartItem.rawContact = hqState.globalCustomerContacts.find(a => a._id === hqState.currentDraft.contactId);
    }

    cartItem.locationId = hqState.currentDraft.locationId;
    if ($w("#locationDropdown").id && hqState.currentDraft.locationId) {
        let opt = $w("#locationDropdown").options.find(o => o.value === hqState.currentDraft.locationId);
        cartItem.resolvedLocation = opt ? opt.label : "Pending Location...";
        cartItem.rawLocation = hqState.globalCustomerLocations.find(a => a._id === hqState.currentDraft.locationId);
    }

    paintBookingCart(false);
}

export function initVehicleDropdowns() {
    const $w = hqState.$w;
    if (!$w || !$w("#newVehicleCategoryDropBox").id) return;

    let uniqueCats = [...new Set(hqState.globalVehicleCategories.map(item => item.category))].filter(Boolean);
    $w("#newVehicleCategoryDropBox").options = uniqueCats.map(c => ({ label: c, value: c }));

    if ($w("#newVehicleTypeDropBox").id) $w("#newVehicleTypeDropBox").disable();
    if ($w("#newVehicleLength").id) $w("#newVehicleLength").disable();

    $w("#newVehicleCategoryDropBox").onChange((e) => {
        let cat = e.target.value;
        $w("#newVehicleCategoryDropBox").style.borderColor = "#000000";
        resetSubmitButtonLabels();

        let types = hqState.globalVehicleCategories.filter(item => item.category === cat);
        let uniqueTypes = [...new Set(types.map(item => item.vehicleType || item.title))].filter(Boolean);

        if ($w("#newVehicleTypeDropBox").id) {
            $w("#newVehicleTypeDropBox").options = uniqueTypes.map(t => ({ label: t, value: t }));
            $w("#newVehicleTypeDropBox").enable();
        }

        if (cat && cat.toLowerCase() !== "automotive") {
            if ($w("#newVehicleLength").id) $w("#newVehicleLength").enable();
        } else {
            if ($w("#newVehicleLength").id) {
                $w("#newVehicleLength").disable();
                $w("#newVehicleLength").value = "";
                $w("#newVehicleLength").style.borderColor = "#000000";
            }
        }
    });

    if ($w("#newVehicleTypeDropBox").id) {
        $w("#newVehicleTypeDropBox").onChange(() => {
            $w("#newVehicleTypeDropBox").style.borderColor = "#000000";
            resetSubmitButtonLabels();
        });
    }
}

export async function autoClassifyHqVehicleInputs() {
    const $w = hqState.$w;
    if (!$w) return null;

    let currentCat = $w("#newVehicleCategoryDropBox").id ? $w("#newVehicleCategoryDropBox").value : "";
    // Do not override Marine / RV / non-automotive categories if explicitly selected
    if (currentCat && currentCat.toLowerCase() !== "automotive") return null;

    let year = $w("#newVehicleYear").id ? $w("#newVehicleYear").value : "";
    let make = $w("#newVehicleMake").id ? $w("#newVehicleMake").value : "";
    let model = $w("#newVehicleModel").id ? $w("#newVehicleModel").value : "";
    let selectedType = $w("#newVehicleTypeDropBox").id ? $w("#newVehicleTypeDropBox").value : "";

    if (!model || String(model).trim() === "") return null;

    try {
        let res = await verifyVehicleType(year, make, model, selectedType);
        if (res && res.detectedType) {
            let targetCat = res.detectedCategory || "Automotive";

            if ($w("#newVehicleCategoryDropBox").id && $w("#newVehicleCategoryDropBox").value !== targetCat) {
                $w("#newVehicleCategoryDropBox").value = targetCat;
                $w("#newVehicleCategoryDropBox").style.borderColor = "#17E6AD";

                let types = hqState.globalVehicleCategories.filter(item => item.category === targetCat);
                let uniqueTypes = [...new Set(types.map(item => item.vehicleType || item.title))].filter(Boolean);
                if ($w("#newVehicleTypeDropBox").id) {
                    $w("#newVehicleTypeDropBox").options = uniqueTypes.map(t => ({ label: t, value: t }));
                    $w("#newVehicleTypeDropBox").enable();
                }
            }

            if ($w("#newVehicleTypeDropBox").id) {
                $w("#newVehicleTypeDropBox").enable();
                $w("#newVehicleTypeDropBox").value = res.detectedType;
                $w("#newVehicleTypeDropBox").style.borderColor = "#17E6AD";
            }
        }
        return res;
    } catch (err) {
        console.warn("Auto vehicle classification skipped:", err);
        return null;
    }
}

export function openCustomerForm(mode) {
    const $w = hqState.$w;
    if (!$w) return;

    let isNewMember = !hqState.currentDraft.customerId;

    if ($w("#submitInfo").id) {
        $w("#submitInfo").expand();
        $w("#submitInfo").enable();
        $w("#submitInfo").label = isNewMember ? "Create New Member" : "Save Information";
    }

    if ($w("#msbCustomer").id) $w("#msbCustomer").changeState("bVehicleInfo");
    if ($w("#msbOffice").id) closeAllLightboxes();
}

export function clearCustomerData(keepSearchText = false) {
    const $w = hqState.$w;
    if (!$w) return;

    let cd = hqState.currentDraft;
    cd.customerId = null;
    cd.customerName = null;
    cd.customerPhone = null;
    cd.customerEmail = null;
    cd.primaryContactText = "No Primary Contact";
    cd.vehicleId = null;
    cd.vehicleInfo = null;
    cd.contactId = null;
    cd.contactInfo = null;
    cd.locationId = null;
    cd.locationInfo = null;

    if (!keepSearchText) {
        if ($w("#phoneSearch").id) $w("#phoneSearch").value = "";
    }

    hqState.selectedPreviousJobId = null;
    if ($w("#previousRep").id) {
        $w("#previousRep").data = padPreviousJobsList([]);
        $w("#previousRep").expand();
    }
    if ($w("#previousRepSummary").id) {
        $w("#previousRepSummary").html = `<p style="font-family: Arial; font-size: 13px; color: #000000;"><b>No Job Selected</b></p>`;
    }

    if ($w("#pRepeater").id) {
        $w("#pRepeater").data = [];
        $w("#pRepeater").collapse();
    }
    if ($w("#prevDetailsTitle").id) $w("#prevDetailsTitle").text = "Previous Details (0)";
    if ($w("#primaryInfo").id) $w("#primaryInfo").collapse();

    resetCustomerDropdowns();
    hqState.callbacks.paintSummaryBox();

    if (hqState.calendarData.length > 0) hqState.callbacks.paintWeeklyCalendarUI();
    hqState.callbacks.loadDailyDetailers();
}

export function initVehicleNotesLightbox() {
    const $w = hqState.$w;
    if (!$w) return;

    let isClosingLightbox = false;

    if ($w("#vehicleNotesButton").id) {
        $w("#vehicleNotesButton").onClick(() => {
            if ($w("#customNotesInput").id) {
                $w("#customNotesInput").value = hqState.currentDraft.vehicleNotes || "";
            }
            if ($w("#vehicleLightbox").id) {
                $w("#vehicleLightbox").show("fade", { duration: 200 });
            }
        });
    }

    if ($w("#vehicleNotesCancel").id) {
        $w("#vehicleNotesCancel").onClick(() => {
            if ($w("#vehicleLightbox").id) $w("#vehicleLightbox").hide("fade", { duration: 200 });
        });
    }

    if ($w("#vehicleNotesSubmit").id) {
        $w("#vehicleNotesSubmit").onClick(async () => {
            let newNote = "";
            if ($w("#customNotesInput").id) {
                newNote = $w("#customNotesInput").value;
                hqState.currentDraft.vehicleNotes = newNote;
            }

            if (hqState.currentDraft.vehicleId) {
                $w("#vehicleNotesSubmit").label = "Saving...";
                try {
                    let vehicleToUpdate = await wixData.get("customerVehicles", hqState.currentDraft.vehicleId);
                    if (vehicleToUpdate) {
                        vehicleToUpdate.notes = newNote;
                        vehicleToUpdate.vehicleNotes = newNote;
                        await wixData.update("customerVehicles", vehicleToUpdate);

                        let memIndex = hqState.globalCustomerVehicles.findIndex(v => v._id === hqState.currentDraft.vehicleId);
                        if (memIndex > -1) hqState.globalCustomerVehicles[memIndex] = vehicleToUpdate;
                    }
                } catch (err) {
                    console.error("🚨 Error updating vehicle note:", err);
                } finally {
                    $w("#vehicleNotesSubmit").label = "Submit Notes";
                }
            }

            if ($w("#vehicleLightbox").id) $w("#vehicleLightbox").hide("fade", { duration: 200 });
        });
    }

    if ($w("#section32").id) {
        $w("#section32").onClick((event) => {
            if (event.target.id !== "section32") return;
            if (isClosingLightbox) return;
            isClosingLightbox = true;

            if ($w("#vehicleLightbox").id) {
                $w("#vehicleLightbox").hide("fade", { duration: 200 }).then(() => {
                    isClosingLightbox = false;
                });
            }
        });
    }
}

export function initBulkDataParsers() {
    const $w = hqState.$w;
    if (!$w) return;

    if ($w("#bulkName").id) {
        const handleBulkName = () => {
            let val = $w("#bulkName").value;

            if (!val || val.trim() === "") {
                if ($w("#newContactFirstName").id) $w("#newContactFirstName").value = "";
                if ($w("#newContactLastName").id) $w("#newContactLastName").value = "";
                if ($w("#newContactPhone").id) $w("#newContactPhone").value = "";
                return;
            }

            let parts = val.trim().split(/\s+/);
            let phone = "";

            let phoneIndex = parts.findIndex(p => /^\d+$/.test(p));
            if (phoneIndex !== -1) {
                phone = parts.splice(phoneIndex, 1)[0];
            }

            let fName = parts.shift() || "";
            let lName = parts.join(" ") || "";

            if ($w("#newContactFirstName").id) $w("#newContactFirstName").value = fName;
            if ($w("#newContactLastName").id) $w("#newContactLastName").value = lName;
            if ($w("#newContactPhone").id && phone) $w("#newContactPhone").value = phone;
        };

        $w("#bulkName").onChange(handleBulkName);
        $w("#bulkName").onKeyPress((e) => {
            if (e.key === "Enter") setTimeout(handleBulkName, 50);
        });
    }

    if ($w("#bulkAddress").id) {
        $w("#bulkAddress").onChange((event) => {
            let address = event.target.value;

            if (!address) {
                if ($w("#newLocationAddress1").id) $w("#newLocationAddress1").value = "";
                if ($w("#newLocationCity").id) $w("#newLocationCity").value = "";
                if ($w("#newLocationState").id) $w("#newLocationState").value = "";
                if ($w("#newLocationZip").id) $w("#newLocationZip").value = "";
                return;
            }

            if (typeof address === 'object') {
                let streetName = address.streetAddress?.name || "";
                let streetNumber = address.streetAddress?.number || "";
                let city = address.city || "";
                let state = address.subdivision || "";
                let zip = address.postalCode || "";

                let fullStreet = `${streetNumber} ${streetName}`.trim();

                if ($w("#newLocationAddress1").id) $w("#newLocationAddress1").value = fullStreet;
                if ($w("#newLocationCity").id) $w("#newLocationCity").value = city;
                if ($w("#newLocationState").id) $w("#newLocationState").value = state;
                if ($w("#newLocationZip").id) $w("#newLocationZip").value = zip;
            }
        });
    }

    if ($w("#bulkVehicle").id) {
        const handleBulkVehicle = () => {
            let val = $w("#bulkVehicle").value;

            if (!val || val.trim() === "") {
                if ($w("#newVehicleYear").id) $w("#newVehicleYear").value = "";
                if ($w("#newVehicleMake").id) $w("#newVehicleMake").value = "";
                if ($w("#newVehicleModel").id) $w("#newVehicleModel").value = "";
                if ($w("#newVehicleColor").id) $w("#newVehicleColor").value = "";
                if ($w("#newVehicleLength").id) {
                    $w("#newVehicleLength").value = "";
                    $w("#newVehicleLength").disable();
                }
                return;
            }

            let parts = val.trim().split(/\s+/);
            let year = "", make = "", model = "", color = "", length = "";

            if (parts.length > 0 && /^\d+(\.\d+)?$/.test(parts[parts.length - 1])) {
                length = parts.pop();
            }
            if (parts.length > 0 && /^\d{4}$/.test(parts[0])) {
                year = parts.shift();
            }
            if (parts.length > 0) {
                make = parts.shift();
            }
            if (parts.length > 1) {
                color = parts.pop();
                model = parts.join(" ");
            } else if (parts.length === 1) {
                model = parts.shift();
            }

            if ($w("#newVehicleYear").id) $w("#newVehicleYear").value = year;
            if ($w("#newVehicleMake").id) $w("#newVehicleMake").value = make;
            if ($w("#newVehicleModel").id) $w("#newVehicleModel").value = model;
            if ($w("#newVehicleColor").id) $w("#newVehicleColor").value = color;

            if ($w("#newVehicleLength").id && length) {
                $w("#newVehicleLength").enable();
                $w("#newVehicleLength").value = length;
            }
            autoClassifyHqVehicleInputs();
        };

        $w("#bulkVehicle").onChange(handleBulkVehicle);
        $w("#bulkVehicle").onKeyPress((e) => {
            if (e.key === "Enter") setTimeout(handleBulkVehicle, 50);
        });
    }
}

export function resetSubmitButtonLabels() {
    const $w = hqState.$w;
    if ($w && $w("#submitInfo").id) {
        $w("#submitInfo").label = "Save Information";
    }
}

export function initFormNavigation() {
    const $w = hqState.$w;
    if (!$w) return;

    const memberFlow = ["#newContactFirstName", "#newContactLastName", "#newContactPhone", "#newContactEmail", "#newLocationAddress1", "#newLocationAddress2", "#newLocationCity", "#newLocationState", "#newLocationZip"];
    const vehicleFlow = ["#newVehicleCategoryDropBox", "#newVehicleTypeDropBox", "#newVehicleYear", "#newVehicleMake", "#newVehicleModel", "#newVehicleColor", "#newVehicleLength", "#customNotesInput"];

    const handleEnter = async (currentId) => {
        let flow = [];
        let reqFields = [];

        if (memberFlow.includes(currentId)) {
            flow = memberFlow;
            reqFields = ["#newContactFirstName", "#newContactLastName", "#newContactPhone", "#newLocationAddress1", "#newLocationCity", "#newLocationState", "#newLocationZip"];
        } else if (vehicleFlow.includes(currentId)) {
            let isMarine = $w("#newVehicleCategoryDropBox").id && $w("#newVehicleCategoryDropBox").value === "Marine";
            flow = vehicleFlow.filter(id => id !== "#newVehicleLength" || isMarine);
            reqFields = ["#newVehicleCategoryDropBox", "#newVehicleTypeDropBox", "#newVehicleYear", "#newVehicleMake", "#newVehicleModel", "#newVehicleColor"];
            if (isMarine) reqFields.push("#newVehicleLength");
        }

        let currentIndex = flow.indexOf(currentId);
        let isLastInput = (currentIndex === flow.length - 1);

        if (!isLastInput) {
            let nextId = flow[currentIndex + 1];

            let emptyReqFields = reqFields.filter(id => $w(id).id && !$w(id).value);
            if (emptyReqFields.length > 0) {
                let foundNextEmpty = false;
                for (let i = currentIndex + 1; i < flow.length; i++) {
                    if (emptyReqFields.includes(flow[i])) {
                        nextId = flow[i];
                        foundNextEmpty = true;
                        break;
                    }
                }
                if (!foundNextEmpty) nextId = emptyReqFields[0];
            }
            if ($w(nextId).id) $w(nextId).focus();
            return;
        }

        await processUnifiedSubmission();
    };

    let allInputs = [...new Set([...memberFlow, ...vehicleFlow])];
    allInputs.forEach(id => {
        let element = $w(id);
        if (element.id) {
            if (typeof element.onKeyPress === "function") {
                element.onKeyPress((e) => { if (e.key === "Enter") setTimeout(() => handleEnter(id), 50); });
            }
            if (typeof element.onInput === "function" || typeof element.onChange === "function") {
                const resetStyling = () => {
                    element.style.borderColor = "#000000";
                    if (id === "#customNotesInput" && $w("#customNotesBox").id) $w("#customNotesBox").style.borderColor = "#000000";
                    resetSubmitButtonLabels();
                };
                if (typeof element.onInput === "function") element.onInput(resetStyling);
                else element.onChange(resetStyling);
            }
        }
    });
}

export function initAutoCaps() {
    const $w = hqState.$w;
    if (!$w) return;

    const autoCapFields = ["#newContactFirstName", "#newContactLastName", "#newLocationAddress1", "#newLocationAddress2", "#newLocationCity", "#newLocationState", "#customAddOnsInput", "#newVehicleMake", "#newVehicleModel", "#newVehicleColor"];

    autoCapFields.forEach(id => {
        if ($w(id).id) {
            $w(id).onBlur((event) => {
                let val = event.target.value;
                if (val) {
                    $w(id).value = val.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                }
            });
        }
    });

    // Auto-classify vehicle type whenever Year, Make, or Model changes
    ["#newVehicleYear", "#newVehicleMake", "#newVehicleModel"].forEach(id => {
        if ($w(id).id) {
            $w(id).onChange(() => autoClassifyHqVehicleInputs());
        }
    });
}

function validateAndFocus(reqFields) {
    const $w = hqState.$w;
    let firstErrorId = null;
    for (let id of reqFields) {
        if ($w(id).id) {
            if (!$w(id).value) {
                $w(id).style.borderColor = "#DF3131";
                if (!firstErrorId) firstErrorId = id;
            } else {
                $w(id).style.borderColor = "#17E6AD";
            }
        }
    }
    if (firstErrorId) {
        $w(firstErrorId).focus();
        return false;
    }
    return true;
}

export async function processUnifiedSubmission() {
    const $w = hqState.$w;
    if (!$w || !$w("#submitInfo").id) return false;

    $w("#submitInfo").disable();
    $w("#submitInfo").label = "Processing...";

    let isNewMember = !hqState.currentDraft.customerId;
    let needsContact = isNewMember || ($w("#contactDropdown").id && $w("#contactDropdown").value === "ADD_NEW_CONTACT");
    let needsLocation = isNewMember || ($w("#locationDropdown").id && $w("#locationDropdown").value === "ADD_NEW_LOCATION");
    let needsVehicle = isNewMember || ($w("#vehicleDropdown").id && $w("#vehicleDropdown").value === "ADD_NEW_VEHICLE");

    if (!needsContact && !needsLocation && !needsVehicle) {
        $w("#submitInfo").label = "Nothing to Save!";
        setTimeout(() => { resetSubmitButtonLabels(); $w("#submitInfo").enable(); }, 2000);
        return false;
    }

    if (isNewMember) {
        let success = await submitNewMemberForm();
        if (!success) return false;
    } else {
        if (needsContact || needsLocation) {
            let success = await submitAdditionalInfoForm(needsContact, needsLocation);
            if (!success) return false;
        }
    }

    if (needsVehicle) {
        let success = await submitNewVehicleForm();
        if (!success) return false;
    }

    $w("#submitInfo").label = "Information Saved!";
    hqState.callbacks.paintSummaryBox();

    if ($w("#msbCustomer").id) {
        $w("#msbCustomer").changeState("bNewDetail").then(() => {});
    }

    setTimeout(() => {
        resetSubmitButtonLabels();
        $w("#submitInfo").enable();
    }, 2000);

    return true;
}

async function runStrictDuplicateCheck(email, phone, currentUserId = null, isCreatingPrimary = false) {
    let cleanedPhone = phone.replace(/\D/g, '');
    let formattedPhone = formatPhoneNumber(phone);
    let checkEmail = email ? email.toLowerCase().trim() : "";

    if (checkEmail) {
        let pEmail = await wixData.query("customerProfiles").eq("email", checkEmail).find();
        if (pEmail.items.length > 0 && pEmail.items[0]._id !== currentUserId) return { field: "#newContactEmail", msg: "Email Already Exists!" };
    }

    let pPhone1 = await wixData.query("customerProfiles").eq("phone", formattedPhone).find();
    if (pPhone1.items.length > 0 && pPhone1.items[0]._id !== currentUserId) return { field: "#newContactPhone", msg: "Phone Already Exists!" };

    let pPhone2 = await wixData.query("customerProfiles").eq("phone", cleanedPhone).find();
    if (pPhone2.items.length > 0 && pPhone2.items[0]._id !== currentUserId) return { field: "#newContactPhone", msg: "Phone Already Exists!" };

    if (isCreatingPrimary) return null;

    if (checkEmail) {
        let aEmail = await wixData.query("customerContacts").eq("email", checkEmail).find();
        let foreignAEmail = aEmail.items.find(i => i.userId !== currentUserId);
        if (foreignAEmail) return { field: "#newContactEmail", msg: "Email Used by Another!" };
    }

    let aPhone1 = await wixData.query("customerContacts").eq("phone", formattedPhone).find();
    let foreignAPhone1 = aPhone1.items.find(i => i.userId !== currentUserId);
    if (foreignAPhone1) return { field: "#newContactPhone", msg: "Phone Used by Another!" };

    let aPhone2 = await wixData.query("customerContacts").eq("phone", cleanedPhone).find();
    let foreignAPhone2 = aPhone2.items.find(i => i.userId !== currentUserId);
    if (foreignAPhone2) return { field: "#newContactPhone", msg: "Phone Used by Another!" };

    return null;
}

async function submitNewMemberForm() {
    const $w = hqState.$w;
    let reqFields = ["#newContactFirstName", "#newContactLastName", "#newContactPhone", "#newContactEmail", "#newLocationAddress1", "#newLocationCity", "#newLocationState", "#newLocationZip"];
    if (!validateAndFocus(reqFields)) {
        if ($w("#submitInfo").id) $w("#submitInfo").label = "Missing Contact Info!";
        $w("#submitInfo").enable();
        return false;
    }

    let rawPhone = $w("#newContactPhone").value;
    let formattedPhone = formatPhoneNumber(rawPhone);
    let rawEmail = $w("#newContactEmail").value.toLowerCase().trim();

    try {
        let dupCheck = await runStrictDuplicateCheck(rawEmail, rawPhone, null, true);
        if (dupCheck) {
            $w(dupCheck.field).style.borderColor = "#DF3131";
            $w(dupCheck.field).value = "";
            if ($w("#submitInfo").id) $w("#submitInfo").label = dupCheck.msg;
            $w(dupCheck.field).focus();
            $w("#submitInfo").enable();
            return false;
        }

        let autoGeneratedPassword = "Ecmd" + Math.floor(Math.random() * 999999) + "!";

        let customerData = {
            email: rawEmail,
            password: autoGeneratedPassword,
            firstName: $w("#newContactFirstName").value,
            lastName: $w("#newContactLastName").value,
            phone: formattedPhone,
            address1: $w("#newLocationAddress1").value,
            address2: $w("#newLocationAddress2").value || "",
            city: $w("#newLocationCity").value,
            state: $w("#newLocationState").value,
            zip: $w("#newLocationZip").value
        };

        $w("#submitInfo").label = "Registering...";
        let response = await registerCustomerFromHQ(customerData);

        if (response && response.success) {
            let finalUserId = response.userId;

            let newProfile = {
                _id: finalUserId,
                firstName: customerData.firstName,
                lastName: customerData.lastName,
                phone: customerData.phone,
                email: customerData.email,
                address1: customerData.address1,
                address2: customerData.address2,
                city: customerData.city,
                state: customerData.state,
                zip: customerData.zip,
                activeSubscription: false
            };

            let contactPayload = {
                userId: finalUserId,
                firstName: customerData.firstName,
                lastName: customerData.lastName,
                phone: customerData.phone,
                email: customerData.email,
                isPrimary: true
            };

            let locationPayload = {
                userId: finalUserId,
                address1: customerData.address1,
                address2: customerData.address2,
                city: customerData.city,
                state: customerData.state,
                zip: customerData.zip,
                isPrimary: true
            };

            let [insertedCustomer] = await Promise.all([
                wixData.insert("customerProfiles", newProfile),
                wixData.insert("customerContacts", contactPayload),
                wixData.insert("customerLocations", locationPayload)
            ]);

            hqState.currentDraft.customerId = insertedCustomer._id;
            hqState.currentDraft.primaryContactText = `${insertedCustomer.firstName} ${insertedCustomer.lastName} - ${insertedCustomer.phone}`;

            if ($w("#primaryContactInfo").id) $w("#primaryContactInfo").text = hqState.currentDraft.primaryContactText;
            if ($w("#primaryLocationInfo").id) $w("#primaryLocationInfo").text = `${customerData.address1} ${customerData.address2 || ''} ${customerData.city}, ${customerData.state} ${customerData.zip}`;
            if ($w("#cHasSubscription").id) $w("#cHasSubscription").text = "NO current Subscription";
            if ($w("#firstDetailDate").id) $w("#firstDetailDate").text = "No Previous Details";

            if ($w("#primaryInfo").id) $w("#primaryInfo").expand();

            ["#newContactFirstName", "#newContactLastName", "#newContactPhone", "#newContactEmail",
             "#newLocationAddress1", "#newLocationAddress2", "#newLocationCity", "#newLocationState", "#newLocationZip"]
             .forEach(id => {
                 if ($w(id).id) { $w(id).value = ""; $w(id).style.borderColor = "#000000"; }
             });

            await loadCustomerDropdowns(insertedCustomer._id);
            return true;
        } else {
            console.error("Backend Error:", response?.message);
            if ($w("#submitInfo").id) { $w("#submitInfo").label = "Registration Failed!"; $w("#submitInfo").enable(); }
            return false;
        }
    } catch (err) {
        console.error("Error saving member:", err);
        if ($w("#submitInfo").id) { $w("#submitInfo").label = "Error! Check Console"; $w("#submitInfo").enable(); }
        return false;
    }
}

async function submitAdditionalInfoForm(needsContact, needsLocation) {
    const $w = hqState.$w;

    if (needsContact) {
        let reqFields = ["#newContactFirstName", "#newContactLastName", "#newContactPhone"];
        if (!validateAndFocus(reqFields)) {
            $w("#submitInfo").label = "Missing Contact Info!";
            $w("#submitInfo").enable();
            return false;
        }

        let rawPhone = $w("#newContactPhone").value;
        let formattedPhone = formatPhoneNumber(rawPhone);
        let rawEmail = $w("#newContactEmail").value ? $w("#newContactEmail").value.toLowerCase().trim() : "";

        let dupCheck = await runStrictDuplicateCheck(rawEmail, rawPhone, hqState.currentDraft.customerId, false);
        if (dupCheck) {
            $w(dupCheck.field).style.borderColor = "#DF3131";
            $w(dupCheck.field).value = "";
            $w("#submitInfo").label = dupCheck.msg;
            $w(dupCheck.field).focus();
            $w("#submitInfo").enable();
            return false;
        }

        let newContact = {
            userId: hqState.currentDraft.customerId,
            firstName: $w("#newContactFirstName").value,
            lastName: $w("#newContactLastName").value,
            phone: formattedPhone,
            email: rawEmail,
            isPrimary: hqState.globalCustomerContacts.length === 0
        };

        let inserted = await wixData.insert("customerContacts", newContact);
        ["#newContactFirstName", "#newContactLastName", "#newContactPhone", "#newContactEmail"].forEach(id => { if ($w(id).id) $w(id).value = ""; });
        await loadCustomerDropdowns(hqState.currentDraft.customerId);
        if ($w("#contactDropdown").id) $w("#contactDropdown").value = inserted._id;
        hqState.currentDraft.contactId = inserted._id;
    }

    if (needsLocation) {
        let reqFields = ["#newLocationAddress1", "#newLocationCity", "#newLocationState", "#newLocationZip"];
        if (!validateAndFocus(reqFields)) {
            $w("#submitInfo").label = "Missing Location Info!";
            $w("#submitInfo").enable();
            return false;
        }

        let newLoc = {
            userId: hqState.currentDraft.customerId,
            address1: $w("#newLocationAddress1").value,
            address2: $w("#newLocationAddress2").value || "",
            city: $w("#newLocationCity").value,
            state: $w("#newLocationState").value,
            zip: $w("#newLocationZip").value,
            isPrimary: hqState.globalCustomerLocations.length === 0
        };

        let insertedLoc = await wixData.insert("customerLocations", newLoc);
        ["#newLocationAddress1", "#newLocationAddress2", "#newLocationCity", "#newLocationState", "#newLocationZip"].forEach(id => { if ($w(id).id) $w(id).value = ""; });
        await loadCustomerDropdowns(hqState.currentDraft.customerId);
        if ($w("#locationDropdown").id) $w("#locationDropdown").value = insertedLoc._id;
        hqState.currentDraft.locationId = insertedLoc._id;
    }
    return true;
}

async function submitNewVehicleForm() {
    const $w = hqState.$w;
    await autoClassifyHqVehicleInputs();
    let isMarine = $w("#newVehicleCategoryDropBox").id && $w("#newVehicleCategoryDropBox").value === "Marine";
    let reqFields = ["#newVehicleCategoryDropBox", "#newVehicleTypeDropBox", "#newVehicleYear", "#newVehicleMake", "#newVehicleModel", "#newVehicleColor"];
    if (isMarine) reqFields.push("#newVehicleLength");

    if (!validateAndFocus(reqFields)) {
        if ($w("#submitInfo").id) $w("#submitInfo").label = "Missing Vehicle Info!";
        $w("#submitInfo").enable();
        return false;
    }

    let lengthVal = 0;
    if (isMarine) {
        let rawLength = $w("#newVehicleLength").value;
        lengthVal = parseFloat(rawLength.replace(/[^0-9.]/g, '')) || 0;
    }

    let newVehicle = {
        userId: hqState.currentDraft.customerId,
        category: $w("#newVehicleCategoryDropBox").value,
        vehicleType: $w("#newVehicleTypeDropBox").value,
        year: $w("#newVehicleYear").value,
        make: $w("#newVehicleMake").value,
        model: $w("#newVehicleModel").value,
        color: $w("#newVehicleColor").value,
        length: lengthVal,
        notes: hqState.currentDraft.vehicleNotes || "",
        vehicleNotes: hqState.currentDraft.vehicleNotes || ""
    };

    try {
        $w("#submitInfo").label = "Saving Vehicle...";
        let inserted = await wixData.insert("customerVehicles", newVehicle);

        ["#newVehicleCategoryDropBox", "#newVehicleTypeDropBox", "#newVehicleYear", "#newVehicleMake", "#newVehicleModel", "#newVehicleColor", "#newVehicleLength", "#customNotesInput"]
         .forEach(id => { if ($w(id).id) { $w(id).value = ""; $w(id).style.borderColor = "#000000"; } });

        if ($w("#customNotesBox").id) $w("#customNotesBox").style.borderColor = "#000000";
        if ($w("#newVehicleLength").id) $w("#newVehicleLength").disable();
        if ($w("#newVehicleTypeDropBox").id) $w("#newVehicleTypeDropBox").disable();

        await loadCustomerDropdowns(hqState.currentDraft.customerId);
        if ($w("#vehicleDropdown").id) $w("#vehicleDropdown").value = inserted._id;
        hqState.currentDraft.vehicleId = inserted._id;

        return true;
    } catch (err) {
        console.error("Error saving vehicle:", err);
        if ($w("#submitInfo").id) { $w("#submitInfo").label = "Vehicle Error!"; $w("#submitInfo").enable(); }
        return false;
    }
}

export function initCustomerConfirmButton() {
    const $w = hqState.$w;
    if (!$w || !$w("#customerConfirm").id) return;

    $w("#customerConfirm").onClick(async () => {
        if (hqState.isSavingInfo) return;
        hqState.isSavingInfo = true;

        let btn = $w("#customerConfirm");

        // Resolve the active tab/cart item in #bookingRep
        let activeCartId = hqState.activeTabId || hqState.selectedCartItemId || hqState.currentDraft.editingCartId;
        let activeCartItem = hqState.draftSessions.find(c => c._id === activeCartId)
            || hqState.globalCart.find(c => c._id === activeCartId)
            || hqState.draftSessions[0];

        if (!activeCartItem) {
            if ($w("#msbOffice").id) closeAllLightboxes();
            hqState.isSavingInfo = false;
            return;
        }

        btn.disable();
        btn.label = "Saving...";

        try {
            let newContactId = $w("#contactDropdown").id ? $w("#contactDropdown").value : null;
            let newLocationId = $w("#locationDropdown").id ? $w("#locationDropdown").value : null;
            let newVehicleId = $w("#vehicleDropdown").id ? $w("#vehicleDropdown").value : null;
            let phoneVal = $w("#phoneSearch").id ? String($w("#phoneSearch").value || "").trim() : "";
            let formattedPhone = formatPhoneNumber(phoneVal);

            let rawCon = hqState.globalCustomerContacts.find(a => a._id === newContactId) || null;
            let rawLoc = hqState.globalCustomerLocations.find(a => a._id === newLocationId) || null;
            let rawVeh = hqState.globalCustomerVehicles.find(v => v._id === newVehicleId) || null;

            let contactPhone = rawCon?.phone ? formatPhoneNumber(rawCon.phone) : formattedPhone;
            let resVeh = rawVeh
                ? `${rawVeh.year || ''} ${rawVeh.make || ''} ${rawVeh.model || ''}`.trim()
                : "Pending Vehicle...";
            let resCon = rawCon
                ? `${rawCon.firstName || ''} ${rawCon.lastName || ''} - ${contactPhone}`.trim()
                : (contactPhone || "Pending Contact...");
            let resLoc = rawLoc
                ? `${rawLoc.address1 || ''}${rawLoc.city ? ', ' + rawLoc.city : ''} ${rawLoc.state || ''}`.trim()
                : "Pending Location...";

            // Strictly update Contact, Location, Vehicle, and Phone on the active #bookingRep item
            activeCartItem.customerId = hqState.currentDraft.customerId || activeCartItem.customerId;
            activeCartItem.contactId = newContactId;
            activeCartItem.locationId = newLocationId;
            activeCartItem.vehicleId = newVehicleId;

            activeCartItem.rawContact = rawCon ? { ...rawCon, phone: rawCon.phone || contactPhone } : { phone: contactPhone };
            activeCartItem.rawLocation = rawLoc;
            activeCartItem.rawVehicle = rawVeh;

            activeCartItem.primaryContactText = hqState.currentDraft.primaryContactText || activeCartItem.primaryContactText;
            activeCartItem.primaryPhone = formattedPhone;
            activeCartItem.phone = contactPhone;
            activeCartItem.resolvedContact = resCon;
            activeCartItem.resolvedLocation = resLoc;
            activeCartItem.resolvedVehicle = resVeh;

            if (rawLoc) {
                activeCartItem.address1 = rawLoc.address1 || "";
                activeCartItem.address2 = rawLoc.address2 || "";
                activeCartItem.city = rawLoc.city || "";
                activeCartItem.state = rawLoc.state || "";
                activeCartItem.zip = rawLoc.zip || "";
            }

            if (rawVeh) {
                activeCartItem.vehicleYear = rawVeh.year || "";
                activeCartItem.vehicleMake = rawVeh.make || "";
                activeCartItem.vehicleModel = rawVeh.model || "";
                activeCartItem.vehicleColor = rawVeh.color || "";
                activeCartItem.vehicleType = rawVeh.vehicleType || rawVeh.subCategory || "";
                activeCartItem.vehicleCategoryName = rawVeh.category || rawVeh.vehicleCategory || "Automotive";
            }

            // Sync currentDraft (keep primaryContactText untouched as the primary account owner!)
            hqState.currentDraft.contactId = newContactId;
            hqState.currentDraft.locationId = newLocationId;
            hqState.currentDraft.vehicleId = newVehicleId;

            if (rawVeh && hqState.callbacks.syncHqPackagesToVehicle) {
                hqState.callbacks.syncHqPackagesToVehicle(newVehicleId);
                if (activeCartItem.packageId || (activeCartItem.packageTitle && activeCartItem.packageTitle !== "No Package Selected" && activeCartItem.level !== "Correction")) {
                    activeCartItem.packageId = hqState.currentDraft.packageId;
                    activeCartItem.packageTitle = hqState.currentDraft.packageTitle;
                    activeCartItem.level = hqState.currentDraft.level;
                    activeCartItem.type = hqState.currentDraft.type;
                    activeCartItem.basePrice = hqState.currentDraft.basePrice;
                    activeCartItem.salePackagePrice = hqState.currentDraft.salePackagePrice;
                    activeCartItem.mobileFee = hqState.currentDraft.mobileFee;
                    activeCartItem.setDuration = String(hqState.currentDraft.setDuration || activeCartItem.setDuration || "3");
                    activeCartItem.discountsApplied = [...(hqState.currentDraft.discountsApplied || [])];
                    activeCartItem.discountsTotal = hqState.currentDraft.discountsTotal;
                    activeCartItem.subTotal = hqState.currentDraft.subTotal;
                    activeCartItem.totalPrice = hqState.currentDraft.totalPrice;
                }
            }

            // If this is an existing booked job ("Prev" tab), save the updated Customer/Location/Vehicle to scheduledJobs
            let targetJobId = (!activeCartItem.isCorrectionDraft && activeCartItem.originalJobId)
                ? activeCartItem.originalJobId
                : (activeCartItem.isExistingBooking ? hqState.selectedPreviousJobId : null);

            if (targetJobId) {
                let jobToUpdate = hqState.globalJobs.find(j => String(j._id) === String(targetJobId));
                if (!jobToUpdate) {
                    jobToUpdate = await wixData.get("scheduledJobs", targetJobId).catch(() => null);
                }

                if (jobToUpdate) {
                    let cleanJob = { ...jobToUpdate };
                    delete cleanJob.isPlaceholder;
                    delete cleanJob.isProjectedCorrection;

                    cleanJob.contactId = newContactId;
                    cleanJob.locationId = newLocationId;
                    cleanJob.vehicleId = newVehicleId;
                    cleanJob.phone = contactPhone;

                    if (rawCon) {
                        cleanJob.firstName = rawCon.firstName || cleanJob.firstName;
                        cleanJob.lastName = rawCon.lastName || cleanJob.lastName;
                        cleanJob.phone = rawCon.phone || contactPhone;
                        cleanJob.email = rawCon.email || cleanJob.email;
                    }
                    if (rawLoc) {
                        cleanJob.address1 = rawLoc.address1 || "";
                        cleanJob.address2 = rawLoc.address2 || "";
                        cleanJob.city = rawLoc.city || "";
                        cleanJob.state = rawLoc.state || "";
                        cleanJob.zip = rawLoc.zip || "";
                    }
                    if (rawVeh) {
                        cleanJob.vehicleInfo = `${rawVeh.year || ''} ${rawVeh.make || ''} ${rawVeh.model || ''} ${rawVeh.color || ''}`.replace(/\s+/g, ' ').trim() || resVeh;
                        cleanJob.vehicleYear = Number(rawVeh.year || 0) || null;
                        cleanJob.vehicleMake = rawVeh.make || "";
                        cleanJob.vehicleModel = rawVeh.model || "";
                        cleanJob.vehicleColor = rawVeh.color || "";
                        cleanJob.vehicleType = rawVeh.vehicleType || cleanJob.vehicleType || "";
                        cleanJob.vehicleCategory = rawVeh.category || rawVeh.vehicleCategory || cleanJob.vehicleCategory || "Automotive";

                        if (activeCartItem.packageId && activeCartItem.level !== "Correction") {
                            cleanJob.orderId = activeCartItem.packageId;
                            cleanJob.packageTitle = activeCartItem.packageTitle;
                            cleanJob.basePrice = Number(activeCartItem.basePrice || 0);
                            cleanJob.salePackagePrice = Number(activeCartItem.salePackagePrice || 0);
                            cleanJob.mobileFee = Number(activeCartItem.mobileFee || 0);
                            cleanJob.setDuration = String(activeCartItem.setDuration || cleanJob.setDuration || "3");
                            cleanJob.subTotal = Number(activeCartItem.subTotal || 0);
                            cleanJob.discountsTotal = Number(activeCartItem.discountsTotal || 0);
                            cleanJob.totalPrice = Number(activeCartItem.totalPrice || 0);
                            if (Array.isArray(activeCartItem.discountsApplied)) {
                                cleanJob.discountsApplied = activeCartItem.discountsApplied.map(d =>
                                    typeof d === "string" ? d : `${d.title} (-$${Number(d.price || 0).toFixed(2)})`
                                );
                            }
                        }
                    }

                    let realSaved = null;
                    try {
                        let savedJob = await secureUpdateJob(cleanJob, false);
                        realSaved = (savedJob && savedJob._id) ? savedJob : (savedJob?.item || savedJob?.job || null);
                    } catch (secErr) {
                        console.warn("⚠️ secureUpdateJob fallback in #customerConfirm:", secErr);
                    }

                    if (!realSaved) {
                        let latestInDb = await wixData.get("scheduledJobs", cleanJob._id).catch(() => null);
                        realSaved = await wixData.update("scheduledJobs", latestInDb ? { ...latestInDb, ...cleanJob, _id: cleanJob._id } : cleanJob);
                    }

                    let memoryIndex = hqState.globalJobs.findIndex(j => String(j._id) === String(targetJobId));
                    if (memoryIndex > -1 && realSaved) hqState.globalJobs[memoryIndex] = realSaved;

                    if (hqState.currentDraft.customerId) {
                        await loadCustomerHistory(hqState.currentDraft.customerId);
                        hqState.selectedPreviousJobId = targetJobId;
                    }

                    if (hqState.currentWeekStartObj) hqState.callbacks.generateWeeklyCalendar(hqState.currentWeekStartObj);
                    else hqState.callbacks.generateWeeklyCalendar();
                }
            }

            // Paint #bookingRep & summary box immediately
            await paintBookingCart(false);
            hqState.callbacks.paintSummaryBox();
            attachCustomerToActiveCartItem();

            btn.label = "✅ Updated!";
            btn.style.backgroundColor = "#17E6AD";
            btn.style.color = "#000000";

            setTimeout(() => {
                btn.label = "Confirm";
                btn.style.backgroundColor = "#000000";
                btn.style.color = "#FFFFFF";
                btn.enable();

                if ($w("#msbOffice").id) closeAllLightboxes();
                hqState.isSavingInfo = false;
            }, 600);

        } catch (error) {
            console.error("🚨 Failed to confirm info:", error);
            btn.label = "Error. Try Again.";
            btn.style.backgroundColor = "#DF3131";
            setTimeout(() => {
                btn.label = "Confirm";
                btn.style.backgroundColor = "#000000";
                btn.enable();
                hqState.isSavingInfo = false;
            }, 2000);
        }
    });
}