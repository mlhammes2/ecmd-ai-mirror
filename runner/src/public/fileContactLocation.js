/**
 * ========================================================================
 * 🤖 AI CONTEXT & ARCHITECTURE NOTE
 * ========================================================================
 * FILE: public/fileContactLocation.js
 * DOM TARGETS: `#contactLocationsProfileState`, `#addContactLightboxState`, `#addLocationLightboxState`
 * PURPOSE: Master engine for all Contact & Location rendering, searching, 
 * creating, editing, and deleting. 
 * ========================================================================
 */

import wixData from 'wix-data';
import { session } from 'wix-storage';
import { authentication } from 'wix-members-frontend';
import { registerRepeater, smartSyncRepeater } from 'public/repeaterEngine';
import { initRouterEngine, smartGoTo, openSideMenu, closeSideMenu, openOverlay, closeAllOverlays, closeTopOverlay, showSuccessMessage, showErrorMessage } from 'public/routerEngine';
import { applyTextOrHighlight } from 'public/animationsEngine';
import { APP_LOGS } from 'public/loggerConfig';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';
import { pushCrmRecordToSupabase } from 'backend/aiBrain.web';

let $w;
let hooks;

const DEBUG_MODE = APP_LOGS.MASTER_SWITCH && APP_LOGS.CONTACT_LOCATION;
const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [FILE_CONTACT_LOCATION]: ${msg}`, data) : console.log(`📌 [FILE_CONTACT_LOCATION]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [FILE_CONTACT_LOCATION]: ${msg}`, data) : console.warn(`📌 [FILE_CONTACT_LOCATION]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [FILE_CONTACT_LOCATION]: ${msg}`, data) : console.error(`📌 [FILE_CONTACT_LOCATION]: ${msg}`); }
};

// 🌟 Local State
let isSubmitting = false;
let profileContacts = [];
let profileLocations = [];
let activeAddressSearchTerm = "";
let pendingDeleteAddress = null;

registerModuleState("fileContactLocation", () => ({
    isSubmitting,
    profileContactsCount: (profileContacts || []).length,
    profileLocationsCount: (profileLocations || []).length,
    activeAddressSearchTerm,
    pendingDeleteAddress,
    editingAddressIdInSession: session.getItem("editingAddressId") || null,
    addAddressModeInSession: session.getItem("addAddressMode") || null
}));

registerDomElements({
    boxes: ["#loginSignUpStack"],
    repeaters: ["#contactsRepM", "#locationsRepM"],
    inputs: [
        "#contactLocationSearch", "#regFirstNameLG", "#regLastNameLG", "#regPhoneLG",
        "#regEmailLG", "#regAddressLG", "#regAddress2LG", "#regCityLG", "#regStateLG", "#regZipLG"
    ]
});

const STRINGS = {
    DEFAULTS: { LOCATION: "No Address Provided" }
};

export function initContactLocationEngine($wContext, providedHooks) {
    logger.info("Initializing Contact/Location Engine...");
    $w = $wContext;
    hooks = providedHooks;

    initAddressSearchEngine();
    initProfileAddressesEngine();
    initAddressButtons(); 
    initAddressDeletionEngine();
    initFormButtons();
    initValidationListeners();
    initAutoCaps();
}

export async function fetchContactLocationData() {
    try {
        let userId = await hooks.getActiveUserId();
        
        let [contactRes, locationRes] = await Promise.all([
            wixData.query("customerContacts").eq("userId", userId).ne("archived", true).find(),
            wixData.query("customerLocations").eq("userId", userId).ne("archived", true).find()
        ]);
        
        syncContactLocationData(contactRes.items, locationRes.items);
    } catch (err) {
        logger.error("Failed to pull contact/location data", err);
    }
}

// ==========================================
// 🔄 DATA SYNC & SEARCH ENGINE
// ==========================================
export function syncContactLocationData(contacts, locations) {
    profileContacts = contacts || [];
    profileLocations = locations || [];
    sortProfileArrays(); 
    triggerAddressSearchFilter();
}

function sortProfileArrays() {
    if (profileContacts.length > 0) {
        profileContacts.sort((a, b) => (b.isPrimary === true ? 1 : 0) - (a.isPrimary === true ? 1 : 0));
    }
    if (profileLocations.length > 0) {
        profileLocations.sort((a, b) => (b.isPrimary === true ? 1 : 0) - (a.isPrimary === true ? 1 : 0));
    }
}

function initAddressSearchEngine() {
    if ($w("#contactLocationSearch").id) {
        $w("#contactLocationSearch").onInput((event) => {
            activeAddressSearchTerm = event.target.value.trim().toLowerCase();
            triggerAddressSearchFilter();
        });
    }
}

function triggerAddressSearchFilter() {
    let filteredContacts = profileContacts;
    let filteredLocations = profileLocations;

    if (activeAddressSearchTerm) {
        filteredContacts = profileContacts.filter(c => {
            let str = `${c.firstName || ''} ${c.lastName || ''} ${c.phone || ''} ${c.email || ''}`.toLowerCase();
            return str.includes(activeAddressSearchTerm);
        });

        filteredLocations = profileLocations.filter(l => {
            let str = `${l.locationTitle || ''} ${l.address1 || ''} ${l.address2 || ''} ${l.city || ''} ${l.state || ''} ${l.zip || ''}`.toLowerCase();
            return str.includes(activeAddressSearchTerm);
        });
    }

    if ($w("#contactsRepM").id) {
        smartSyncRepeater($w, "#contactsRepM", filteredContacts);
        $w("#contactsRepM").forEachItem(($item, itemData) => {
            let nameStr = `${itemData.firstName || ''} ${itemData.lastName || ''}`.trim() || "Unnamed Contact";
            applyTextOrHighlight($item(`#contactsNameM`), nameStr, activeAddressSearchTerm);
            applyTextOrHighlight($item(`#contactsPhoneM`), itemData.phone || "--", activeAddressSearchTerm);
        });
    }
    
    if ($w("#locationsRepM").id) {
        smartSyncRepeater($w, "#locationsRepM", filteredLocations);
        $w("#locationsRepM").forEachItem(($item, itemData) => {
            let apt = itemData.address2 ? ` ${itemData.address2}` : "";
            let addressStr = ((itemData.address1 || "") + apt).trim() || STRINGS.DEFAULTS.LOCATION;
            let cityStateStr = `${itemData.city || ''}, ${itemData.state || ''} ${itemData.zip || ''}`.trim();
            
            applyTextOrHighlight($item(`#locationsTitleM`), itemData.locationTitle || "Unnamed", activeAddressSearchTerm);
            applyTextOrHighlight($item(`#locationsAddressM`), addressStr, activeAddressSearchTerm);
            applyTextOrHighlight($item(`#locationsCitySTZipSuiteM`), cityStateStr, activeAddressSearchTerm);
        });
    }

    let hasContacts = filteredContacts.length > 0;
    let hasLocations = filteredLocations.length > 0;
    let isSearching = activeAddressSearchTerm.length > 0;
    
    let hasAnyProfileData = profileContacts.length > 0 || profileLocations.length > 0;
    let isLoggedIn = authentication.loggedIn();

    const toggleVisibility = (id, shouldExpand) => {
        if ($w(id).id) {
            shouldExpand ? $w(id).expand() :$w(id).collapse();
        }
    };

    toggleVisibility("#noResultsFoundText", isSearching && !hasContacts && !hasLocations);
    toggleVisibility("#noContactsLocations", !isSearching && !hasAnyProfileData);
    toggleVisibility("#contactsTitleText", isLoggedIn && (!isSearching || hasContacts));
    toggleVisibility("#locationsTitleText", isLoggedIn && (!isSearching || hasLocations));
    toggleVisibility("#loginSignUpStack", !isLoggedIn);

    const toggleTexts = (ids, hasData, msg) => {
        ids.forEach(id => {
            if ($w(id).id) {
                if (hasData) $w(id).hide();
                else { $w(id).text = msg; $w(id).show(); }
            }
        });
    };
    
    let contactMsg = isSearching ? `No contacts found matching "${activeAddressSearchTerm}"` : "";
    let locationMsg = isSearching ? `No locations found matching "${activeAddressSearchTerm}"` : "";
    
    toggleTexts(["#contactsTextD", "#contactsTextM"], hasContacts, contactMsg);
    toggleTexts(["#locationsTextD", "#locationsTextM"], hasLocations, locationMsg);
}

// ==========================================
// 📋 DASHBOARD REPEATERS
// ==========================================
export function initProfileAddressesEngine() {
    registerRepeater($w, "#contactsRepM", ($item, itemData) => {
        try {
            let nameStr = `${itemData.firstName || ''} ${itemData.lastName || ''}`.trim() || "Unnamed Contact";
            let phoneStr = itemData.phone || "--";

            applyTextOrHighlight($item(`#contactsNameM`), nameStr, activeAddressSearchTerm);
            applyTextOrHighlight($item(`#contactsPhoneM`), phoneStr, activeAddressSearchTerm);

            if (itemData.isPrimary) {
                if ($item(`#contactsPrimaryM`).type) $item(`#contactsPrimaryM`).expand();
                if ($item(`#primaryContactsButton`).type) $item(`#primaryContactsButton`).collapse(); 
            } else {
                if ($item(`#contactsPrimaryM`).type) $item(`#contactsPrimaryM`).collapse();
                if ($item(`#primaryContactsButton`).type) {
                    $item(`#primaryContactsButton`).expand();
                    $item(`#primaryContactsButton`).enable();
                    $item(`#primaryContactsButton`).label = "Set as Primary";
                    
                    $item(`#primaryContactsButton`).onClick(async () => {
                        $item(`#primaryContactsButton`).label = "Saving...";
                        $item(`#primaryContactsButton`).disable();
                        await updatePrimaryStatus(itemData._id, "contact");
                    });
                }
            }

            if ($item(`#contactsRepEdit`).type) {
                $item(`#contactsRepEdit`).onClick(() => {
                    session.setItem("editingAddressId", itemData._id);
                    session.setItem("addAddressMode", "contact");
                    session.setItem("returnBreadcrumb", "contactLocationsProfileState");
                    if (hooks.smartGoTo) hooks.smartGoTo("addContactLightboxState");
                });
            }

            if ($item(`#contactsRepRemove`).type) {
                $item(`#contactsRepRemove`).onClick(() => {
                    let name = `${itemData.firstName || ''} ${itemData.lastName || ''}`.trim() || "this contact";
                    openConfirmDeleteAddressPopup(itemData._id, "contact", name);
                });
            }

        } catch(e) {}
    });

    registerRepeater($w, "#locationsRepM", ($item, itemData) => {
        try {
            let titleStr = itemData.locationTitle || "Unnamed";
            let apt = itemData.address2 ? ` ${itemData.address2}` : "";
            let addressStr = ((itemData.address1 || "") + apt).trim() || STRINGS.DEFAULTS.LOCATION;
            let cityStateStr = `${itemData.city || ''}, ${itemData.state || ''} ${itemData.zip || ''}`.trim();
            
            applyTextOrHighlight($item(`#locationsTitleM`), titleStr, activeAddressSearchTerm);
            applyTextOrHighlight($item(`#locationsAddressM`), addressStr, activeAddressSearchTerm);
            applyTextOrHighlight($item(`#locationsCitySTZipSuiteM`), cityStateStr, activeAddressSearchTerm);

            if (itemData.isPrimary) {
                if ($item(`#locationsPrimaryM`).type) $item(`#locationsPrimaryM`).expand();
                if ($item(`#primaryLocationsButton`).type) $item(`#primaryLocationsButton`).collapse(); 
            } else {
                if ($item(`#locationsPrimaryM`).type) $item(`#locationsPrimaryM`).collapse();
                if ($item(`#primaryLocationsButton`).type) {
                    $item(`#primaryLocationsButton`).expand();
                    $item(`#primaryLocationsButton`).enable();
                    $item(`#primaryLocationsButton`).label = "Set as Primary";
                    
                    $item(`#primaryLocationsButton`).onClick(async () => {
                        $item(`#primaryLocationsButton`).label = "Saving...";
                        $item(`#primaryLocationsButton`).disable();
                        await updatePrimaryStatus(itemData._id, "location");
                    });
                }
            }

            if ($item(`#locationsRepEdit`).type) {
                $item(`#locationsRepEdit`).onClick(() => {
                    session.setItem("editingAddressId", itemData._id);
                    session.setItem("addAddressMode", "location");
                    session.setItem("returnBreadcrumb", "contactLocationsProfileState");
                    if (hooks.smartGoTo) hooks.smartGoTo("addLocationLightboxState");
                });
            }

            if ($item(`#locationsRepRemove`).type) {
                $item(`#locationsRepRemove`).onClick(() => {
                    let name = itemData.locationTitle || (itemData.address1 || "").trim() || "this location";
                    openConfirmDeleteAddressPopup(itemData._id, "location", name);
                });
            }

        } catch(e) {}
    });
}


export function initAddressButtons() {
    const routeToAddress = (mode) => {
        session.removeItem("editingAddressId"); 
        session.setItem("addAddressMode", mode); 
                
        if (hooks.closeSideMenu) hooks.closeSideMenu();
        if (hooks.smartGoTo) hooks.smartGoTo(mode === "contact" ? "addContactLightboxState" : "addLocationLightboxState");
    };

    ["#addContact"].forEach(id => { if ($w(id).id)$w(id).onClick(() => { routeToAddress("contact"); }); });
    ["#addLocation"].forEach(id => { if ($w(id).id)$w(id).onClick(() => { routeToAddress("location"); }); });

    const routeToAuth = (state) => {
        session.setItem("returnBreadcrumb", "contactLocationsProfileState");
        if (hooks.smartGoTo) hooks.smartGoTo(state);
    };

    ["#contactLoginText", "#locationLoginText"].forEach(id => {
        if ($w(id).id)$w(id).onClick(() => routeToAuth("loginPromptsState"));
    });

    ["#signUpText", "#contactSignUpText", "#locationSignUpText"].forEach(id => {
        if ($w(id).id)$w(id).onClick(() => routeToAuth("registryProfileState"));
    });
}

// ==========================================
// 🗑️ DELETION ENGINE (DASHBOARD)
// ==========================================
export function openConfirmDeleteAddressPopup(id, type, name) {
    session.removeItem("activeDeleteIntent");
    pendingDeleteAddress = null;

    pendingDeleteAddress = { id, type };
    session.setItem("activeDeleteIntent", "address"); 
    
    let typeName = type === "contact" ? "Contact" : "Location";
    let msg = `⚠️ REMOVE ${typeName.toUpperCase()}\n\nAre you sure you want to permanently remove "${name}" from your profile? This action cannot be undone.`;
    
    if ($w("#confirmDeleteText").id) $w("#confirmDeleteText").text = msg;
    if ($w("#deleteConfirmTitle").id) $w("#deleteConfirmTitle").text = type === "contact" ? "Confirm Contact Deletion" : "Confirm Location Deletion";

    if (hooks.smartGoTo) hooks.smartGoTo("deleteConfirmPopupState");
}

export function initAddressDeletionEngine() {
    if ($w("#submitConfirmDelete").id) {
        $w("#submitConfirmDelete").onClick(async () => {
            if (session.getItem("activeDeleteIntent") !== "address" || !pendingDeleteAddress) return; 
            
            $w("#submitConfirmDelete").disable();
            $w("#submitConfirmDelete").label = "Deleting...";

            try {
                let { id, type } = pendingDeleteAddress;
                let collectionName = type === "contact" ? "customerContacts" : "customerLocations";
                
                await wixData.remove(collectionName, id);
                pushCrmRecordToSupabase(collectionName, { _id: id, archived: true }).catch(() => {});

                let refField = type === "contact" ? "contactId" : "locationId";
                let orphanedCartItems = await wixData.query("temporaryData").eq(refField, id).eq("status", "Draft").find();

                if (orphanedCartItems.items.length > 0) {
                    let updatedItems = orphanedCartItems.items.map(item => { item[refField] = null; return item; });
                    await wixData.bulkUpdate("temporaryData", updatedItems);
                }

                if (type === "contact") {
                    profileContacts = profileContacts.filter(c => c._id !== id);
                } else {
                    profileLocations = profileLocations.filter(l => l._id !== id);
                }
                triggerAddressSearchFilter();
                
                if (hooks.closeAllOverlays) hooks.closeAllOverlays($w);
                showSuccessMessage(`${type === "contact" ? "Contact" : "Location"} removed.`);
                
                if (hooks.triggerLocationSaveCallback) await hooks.triggerLocationSaveCallback();

            } catch (err) {
                logger.error("Failed to delete address", err);
                showErrorMessage("Failed to remove. Please try again.");
            } finally {
                if ($w("#submitConfirmDelete").id) {
                    $w("#submitConfirmDelete").enable();
                    $w("#submitConfirmDelete").label = "Confirm Delete"; 
                }
                
                pendingDeleteAddress = null;
                session.removeItem("activeDeleteIntent"); 
            }
        });
    }
}

async function updatePrimaryStatus(clickedId, type) {
    let userId = await hooks.getActiveUserId();
    let collectionName = type === "contact" ? "customerContacts" : "customerLocations";
    
    try {
        let targetArray = type === "contact" ? profileContacts : profileLocations;
        targetArray.forEach(item => { item.isPrimary = (item._id === clickedId); });
        sortProfileArrays();
        triggerAddressSearchFilter(); 

        let res = await wixData.query(collectionName).eq("userId", userId).ne("archived", true).find();
        let allItems = res.items || [];
        
        let updates = [];
        let newlyCrownedItem;

        allItems.forEach(item => {
            if (item._id === clickedId && !item.isPrimary) {
                item.isPrimary = true; newlyCrownedItem = item; updates.push(item);
            } else if (item._id !== clickedId && item.isPrimary) {
                item.isPrimary = false; updates.push(item);
            }
        });

        if (updates.length > 0) {
            await wixData.bulkUpdate(collectionName, updates);
            updates.forEach(u => pushCrmRecordToSupabase(collectionName, u).catch(() => {}));
            
            // 💥 SYNC WITH MASTER PROFILE
            if (newlyCrownedItem) {
                let profileRes = await wixData.query("customerProfiles").eq("_id", userId).find();
                if (profileRes.items.length > 0) {
                    let masterProfile = profileRes.items[0];
                    if (type === "location") {
                        ["address1", "address2", "city", "state", "zip"].forEach(key => masterProfile[key] = newlyCrownedItem[key]);
                    } else if (type === "contact") {
                        ["firstName", "lastName", "phone"].forEach(key => masterProfile[key] = newlyCrownedItem[key]);
                    }
                    await wixData.update("customerProfiles", masterProfile);
                }
            }
            if (hooks.triggerLocationSaveCallback) await hooks.triggerLocationSaveCallback(); 
        }
    } catch (err) {
        logger.error("Failed to update primary status", err);
    }
}

// ==========================================
// 📝 FORM ENGINE (ADD/EDIT LIGHTBOXES)
// ==========================================
export async function loadEditingAddress() {
    let editingId = session.getItem("editingAddressId");
    let addMode = session.getItem("addAddressMode"); 

    if (!editingId || !addMode) {
        if ($w("#contactDelete").id) $w("#contactDelete").hide();
        if ($w("#locationDelete").id) $w("#locationDelete").hide();
        return; 
    }

    try {
        let res = await wixData.query(addMode === "contact" ? "customerContacts" : "customerLocations").eq("_id", editingId).find();
        
        if (res.items.length > 0) {
            let item = res.items[0];

            if (addMode === "contact") {
                if ($w("#contactDelete").id) $w("#contactDelete").show();
                if ($w("#regFirstNameLG").id) $w("#regFirstNameLG").value = item.firstName || "";
                if ($w("#regLastNameLG").id) $w("#regLastNameLG").value = item.lastName || "";
                if ($w("#regPhoneLG").id) $w("#regPhoneLG").value = item.phone || "";
                if ($w("#regEmailLG").id) $w("#regEmailLG").value = item.email || "";
            } else if (addMode === "location") {
                if ($w("#locationDelete").id) $w("#locationDelete").show();
                if ($w("#regAddressLG").id) $w("#regAddressLG").value = item.address1 || "";
                if ($w("#regAddress2LG").id) $w("#regAddress2LG").value = item.address2 || "";
                if ($w("#regCityLG").id) $w("#regCityLG").value = item.city || "";
                if ($w("#regStateLG").id) $w("#regStateLG").value = item.state || "";
                if ($w("#regZipLG").id) $w("#regZipLG").value = item.zip || "";
            }
            validateFormState();
        }
    } catch (err) {
        logger.error("Error loading edit data:", err);
    }
}

function initValidationListeners() {
    const fields = [
        "#regFirstNameLG", "#regLastNameLG", "#regPhoneLG", 
        "#regAddressLG", "#regCityLG", "#regStateLG", "#regZipLG"
    ];
    fields.forEach(id => {
        if ($w(id).id) {
            $w(id).onInput(() => validateFormState());$w(id).onChange(() => validateFormState()); 
        }
    });
    validateFormState();
}

export function validateFormState() {
    let isContactValid = false;
    let first = $w("#regFirstNameLG").id ? $w("#regFirstNameLG").value : "";
    let last = $w("#regLastNameLG").id ? $w("#regLastNameLG").value : "";
    let phone = $w("#regPhoneLG").id ? $w("#regPhoneLG").value : "";
    if (first.trim() && last.trim() && phone.trim()) isContactValid = true;

    if ($w("#submitContact").id) {
        if (isContactValid) $w("#submitContact").enable();
        else $w("#submitContact").disable();
    }

    let isLocationValid = false;
    let add = $w("#regAddressLG").id ? $w("#regAddressLG").value : "";
    let city = $w("#regCityLG").id ? $w("#regCityLG").value : "";
    let state = $w("#regStateLG").id ? $w("#regStateLG").value : "";
    let zip = $w("#regZipLG").id ? $w("#regZipLG").value : "";
    if (add.trim() && city.trim() && state.trim() && zip.trim()) isLocationValid = true;

    if ($w("#submitLocation").id) {
        if (isLocationValid) $w("#submitLocation").enable();
        else $w("#submitLocation").disable();
    }
}

function initFormButtons() {
    if ($w("#submitContact").id) {
        $w("#submitContact").onClick(async () => {
            if (isSubmitting) return;
            await submitData("contact", "#submitContact");
        });
    }
    
    if ($w("#submitLocation").id) {
        $w("#submitLocation").onClick(async () => {
            if (isSubmitting) return;
            await submitData("location", "#submitLocation");
        });
    }

    const handleFormDelete = async (mode, btnId) => {
        let editingId = session.getItem("editingAddressId");
        if (!editingId) return;

        $w(btnId).disable();$w(btnId).label = "Deleting...";

        try {
            let delCol = mode === "contact" ? "customerContacts" : "customerLocations";
            await wixData.remove(delCol, editingId);
            pushCrmRecordToSupabase(delCol, { _id: editingId, archived: true }).catch(() => {});
            
            let refField = mode === "contact" ? "contactId" : "locationId";
            let orphanedCartItems = await wixData.query("temporaryData").eq(refField, editingId).eq("status", "Draft").find();

            if (orphanedCartItems.items.length > 0) {
                let updatedItems = orphanedCartItems.items.map(item => { item[refField] = null; return item; });
                await wixData.bulkUpdate("temporaryData", updatedItems);
            }

            session.removeItem("editingAddressId"); 
            session.removeItem("addAddressMode");
            
            $w(btnId).label = "Delete"; 
            $w(btnId).hide();$w(btnId).enable();
            
            if (hooks.triggerLocationSaveCallback) await hooks.triggerLocationSaveCallback();
            
        } catch (err) {
            $w(btnId).label = "Error!";
            setTimeout(() => { $w(btnId).label = "Delete"; $w(btnId).enable(); }, 2000);
        }
    };

    if ($w("#contactDelete").id) $w("#contactDelete").onClick(() => handleFormDelete("contact", "#contactDelete"));
    if ($w("#locationDelete").id) $w("#locationDelete").onClick(() => handleFormDelete("location", "#locationDelete"));
    
    if ($w("#closeAddContact").id) {
        $w("#closeAddContact").onClick(() => { 
            closeTopOverlay($w); 
            setTimeout(() => { resetForms(); }, 300);
        });
    }
    if ($w("#closeAddLocation").id) {
        $w("#closeAddLocation").onClick(() => { 
            closeTopOverlay($w); 
            setTimeout(() => { resetForms(); }, 300);
        });
    }
}

async function submitData(mode, btnId) {
    isSubmitting = true;
    let submitBtn = $w(btnId);
    if (submitBtn.id) { submitBtn.label = "Saving..."; submitBtn.disable(); }

    try {
        let editingId = session.getItem("editingAddressId"); 
        let userId = await hooks.getActiveUserId();
        
        let newContactId = null; 
        let newLocationId = null;
        let isPrimarySave = false;
        let savedItemData = null;

        if (mode === "contact") {
            let baseContact = { 
                userId: userId, 
                firstName: $w("#regFirstNameLG").value.trim(), 
                lastName: $w("#regLastNameLG").value.trim(), 
                phone: formatPhoneNumber($w("#regPhoneLG").value), 
                email: ($w("#regEmailLG").id && $w("#regEmailLG").value) ? $w("#regEmailLG").value.trim().toLowerCase() : "" 
            };

            if (editingId) {
                let isPrim = false;
                let old = await wixData.query("customerContacts").eq("_id", editingId).find();
                if (old.items.length > 0) isPrim = old.items[0].isPrimary;
                
                let contactPayload = { ...baseContact, _id: editingId, isPrimary: isPrim };
                let updated = await wixData.update("customerContacts", contactPayload); 
                newContactId = editingId;
                isPrimarySave = isPrim;
                savedItemData = updated;
                
                let idx = profileContacts.findIndex(c => c._id === editingId);
                if (idx > -1) profileContacts[idx] = updated;
                
            } else { 
                let isPrim = profileContacts.length === 0; 
                let contactPayload = { ...baseContact, isPrimary: isPrim };
                let inserted = await wixData.insert("customerContacts", contactPayload); 
                newContactId = inserted._id; 
                isPrimarySave = isPrim;
                savedItemData = inserted;
                
                profileContacts.push(inserted);
            }
        } else if (mode === "location") {
            let baseLocation = { 
                userId: userId, 
                address1: $w("#regAddressLG").value.trim(), 
                address2: $w("#regAddress2LG").id ? ($w("#regAddress2LG").value || "").trim() : "", 
                city: $w("#regCityLG").value.trim(), 
                state: $w("#regStateLG").value.trim(), 
                zip: $w("#regZipLG").value.trim() 
            };

            if (editingId) {
                let isPrim = false;
                let old = await wixData.query("customerLocations").eq("_id", editingId).find();
                if (old.items.length > 0) isPrim = old.items[0].isPrimary;
                
                let locationPayload = { ...baseLocation, _id: editingId, isPrimary: isPrim };
                let updatedLoc = await wixData.update("customerLocations", locationPayload); 
                newLocationId = editingId;
                isPrimarySave = isPrim;
                savedItemData = updatedLoc;
                
                let idx = profileLocations.findIndex(l => l._id === editingId);
                if (idx > -1) profileLocations[idx] = updatedLoc;
                
            } else { 
                let isPrim = profileLocations.length === 0; 
                let locationPayload = { ...baseLocation, isPrimary: isPrim };
                let insertedLoc = await wixData.insert("customerLocations", locationPayload); 
                newLocationId = insertedLoc._id; 
                isPrimarySave = isPrim;
                savedItemData = insertedLoc;
                
                profileLocations.push(insertedLoc);
            }
        }

        if (savedItemData) {
            pushCrmRecordToSupabase(mode === "contact" ? "customerContacts" : "customerLocations", savedItemData).catch(() => {});
        }

        // 💥 SYNC WITH MASTER PROFILE IF THIS ITEM IS PRIMARY
        if (isPrimarySave && savedItemData) {
            let profileRes = await wixData.query("customerProfiles").eq("_id", userId).find();
            if (profileRes.items.length > 0) {
                let masterProfile = profileRes.items[0];
                if (mode === "location") {
                    ["address1", "address2", "city", "state", "zip"].forEach(key => masterProfile[key] = savedItemData[key]);
                } else if (mode === "contact") {
                    ["firstName", "lastName", "phone"].forEach(key => masterProfile[key] = savedItemData[key]);
                }
                await wixData.update("customerProfiles", masterProfile);
            }
        }

        sortProfileArrays();
        triggerAddressSearchFilter();

        if (submitBtn.id) submitBtn.label = "✅ Saved!";
        await new Promise(resolve => setTimeout(resolve, 800));

        resetForms();

        if (hooks.triggerLocationSaveCallback) {
            submitBtn.label = "Processing...";
            await hooks.triggerLocationSaveCallback(newContactId, newLocationId);
        } else {
            closeTopOverlay($w); 
        }
        
    } catch (error) {
        logger.error("Save Data Error", error);
        if (submitBtn.id) submitBtn.label = "Error. Try Again"; 
        showErrorMessage("An error occurred while saving. Please try again.");
    } finally {
        isSubmitting = false;
        if (submitBtn.id && submitBtn.label === "Error. Try Again") {
            submitBtn.enable();
        } else if (submitBtn.id) {
            submitBtn.label = "Submit";
            validateFormState(); 
        }
    }
}

export function resetForms() {
    const fields = [
        "#regFirstNameLG", "#regLastNameLG", "#regEmailLG", "#regPhoneLG",
        "#regAddressLG", "#regAddress2LG", "#regCityLG", "#regStateLG", "#regZipLG"
    ];
    
    fields.forEach(id => {
        if ($w(id).id) {$w(id).value = "";
            try { $w(id).style.borderColor = "#000000"; } catch(e){}
        }
    });
    
    session.removeItem("editingAddressId");
    session.removeItem("addAddressMode");
    
    if ($w("#contactDelete").id) $w("#contactDelete").hide();
    if ($w("#locationDelete").id) $w("#locationDelete").hide();
    
    validateFormState();
}

function formatPhoneNumber(rawPhone) {
    if (!rawPhone) return "";
    let cleaned = rawPhone.replace(/\D/g, ''); 
    if (cleaned.length === 10) return `(${cleaned.substring(0,3)})-${cleaned.substring(3,6)}-${cleaned.substring(6,10)}`;
    return rawPhone; 
}

function initAutoCaps() {
    const autoCapFields = ["#regFirstNameLG", "#regLastNameLG", "#regCityLG"];
    autoCapFields.forEach(id => {
        try {
            if ($w(id).id) {$w(id).onBlur((event) => {
                    let val = event.target.value;
                    if (val) {
                        $w(id).value = val.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                        validateFormState();
                    }
                });
            }
        } catch(e) {}
    });
}

export function closeCustomLightbox($w) {
    const allInputs = [
        "#regFirstNameG", "#regLastNameG", "#regPhoneG", "#regEmailG", "#regAddress1G", "#regAddress2G", "#regCityG", "#regStateG", "#regZipG",
        "#regPasswordG", "#regConfirmG",
        "#regFirstNameLG", "#regLastNameLG", "#regPhoneLG", "#regEmailLG", "#regAddressLG", "#regAddress2LG", "#regCityLG", "#regStateLG", "#regZipLG"
    ];
    
    if ($w("#contactAddCheckMark").id) $w("#contactAddCheckMark").hide();
    if ($w("#locationAddCheckMark").id) $w("#locationAddCheckMark").hide();

    allInputs.forEach(id => {
        let element = $w(id);
        if (element.id) {
            element.value = element.type === "$w.AddressInput" ? null : ""; 
            try { if (element.style) element.style.borderColor = "#000000"; element.enable(); } catch (e) {}
        }
    });
}