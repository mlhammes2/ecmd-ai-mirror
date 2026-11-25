// --- public/authEngine.js ---

/**
 * ========================================================================
 * 🤖 AI CONTEXT & ARCHITECTURE NOTE
 * ========================================================================
 * FILE: public/authEngine.js
 * DOM TARGETS: `#msbPrompts` (`#loginPromptsState`, `#registryProfileState`)
 * PURPOSE: Manages user sessions, Wix Members auth, and guest identity.
 * ========================================================================
 */

import wixData from 'wix-data';
import { authentication, currentMember } from 'wix-members-frontend';
import wixLocationFrontend from 'wix-location-frontend';
import { local, session } from 'wix-storage';
import { initRouterEngine, smartGoTo, openSideMenu, closeSideMenu, openOverlay, closeAllOverlays, closeTopOverlay, showSuccessMessage, showErrorMessage } from 'public/routerEngine';
import { APP_LOGS } from 'public/loggerConfig';
import { sendWelcomeEmail } from 'backend/emailDispatchEngine.jsw';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

let $w;
let hooks;
let isSubmitting = false;
let isSmsConsentChecked = false;
let cachedActiveUserId = null;

const RADIO_UNSELECTED = "https://static.wixstatic.com/shapes/694137_1602bde3fd0e4741a3119c599614fb9a.svg";
const RADIO_SELECTED = "https://static.wixstatic.com/shapes/694137_c50600f9788e4f04a98d38d0e9af9e4b.svg";

// ==========================================
// 🔴 DEBUGGING & AI TELEMETRY ENGINE
// ==========================================
const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [AUTH_ENGINE]: ${msg}`, data) : console.log(`📌 [AUTH_ENGINE]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [AUTH_ENGINE]: ${msg}`, data) : console.warn(`📌 [AUTH_ENGINE]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [AUTH_ENGINE]: ${msg}`, data) : console.error(`📌 [AUTH_ENGINE]: ${msg}`); }
};

registerModuleState("authEngine", () => ({
    cachedActiveUserId,
    isLoggedIn: authentication.loggedIn(),
    isGuestSession: Boolean(cachedActiveUserId && String(cachedActiveUserId).startsWith("guest_")),
    isSubmitting,
    isSmsConsentChecked,
    tempGuestIdInLocal: local.getItem("temp_guest_id") || null,
    hasSavedRegistryDraft: Boolean(session.getItem("registryFormData"))
}));

registerDomElements({
    msb: ["#msbPrompts"],
    inputs: [
        "#loginUserG", "#loginPasswordG", "#regFirstNameG", "#regLastNameG",
        "#regEmailG", "#regPhoneG", "#regAddress1G", "#regAddress2G",
        "#regCityG", "#regStateG", "#regZipG", "#btnSmsConsent"
    ]
});

export function initAuthEngine($wContext, providedHooks) {
    logger.info("initAuthEngine -> Initializing Auth Engine...");
    $w = $wContext;
    hooks = providedHooks;

    // 💾 Restore Registry Form Data if returning from Legal Pages
    let savedForm = session.getItem("registryFormData");
    if (savedForm) {
        try {
            let parsedForm = JSON.parse(savedForm);
            Object.keys(parsedForm).forEach(id => {
                if (id === "#regPasswordG" || id === "#regConfirmG") return;
                if ($w(id).id) $w(id).value = parsedForm[id];
            });
            logger.info("initAuthEngine -> Restored saved registryFormData from session");
        } catch(e) {
            logger.warn("initAuthEngine -> Failed to parse saved registryFormData", e);
        }
    }

    initLoginButtons();
    initRegistryButtons();
    initValidationListeners();
    initAutoCaps();
}

export async function getActiveUserId() {
    // 1. Instant RAM return (0ms)
    if (cachedActiveUserId) return cachedActiveUserId;

    // 2. Instant Session return if logged in (0ms)
    let sessionMemberId = session.getItem("cached_member_id");
    if (sessionMemberId && authentication.loggedIn()) {
        cachedActiveUserId = sessionMemberId;
        return cachedActiveUserId;
    }

    // 3. Only call the slow Wix API if not cached yet!
    if (authentication.loggedIn()) {
        try {
            const member = await currentMember.getMember();
            if (member && member._id) {
                cachedActiveUserId = String(member._id);
                session.setItem("cached_member_id", cachedActiveUserId);
                logger.info(`getActiveUserId -> Resolved logged-in Member ID: ${cachedActiveUserId}`);
                return cachedActiveUserId;
            }
        } catch (error) {
            logger.error("getActiveUserId -> Failed fetching currentMember", error);
        }
    }
    
    let guestId = local.getItem("temp_guest_id");
    if (!guestId || guestId === "{}" || guestId === "[object Object]" || guestId.includes("object") || guestId === "undefined") { 
        guestId = "guest_" + Date.now().toString(); 
        local.setItem("temp_guest_id", guestId); 
        logger.info(`getActiveUserId -> Generated new Guest ID: ${guestId}`);
    }
    
    cachedActiveUserId = String(guestId);
    return cachedActiveUserId;
}

async function migrateGuestData(oldGuestId, finalUserId) {
    if (!oldGuestId || !finalUserId || oldGuestId === finalUserId) return;
    logger.info(`migrateGuestData -> Migrating Guest Data from ${oldGuestId} to ${finalUserId}`);

    const bulkMigrate = async (collection) => {
        try {
            let itemsRes = await wixData.query(collection).eq("userId", oldGuestId).find();
            if (itemsRes.items.length > 0) {
                let updated = itemsRes.items.map(i => { i.userId = finalUserId; return i; });
                await wixData.bulkUpdate(collection, updated);
                logger.info(`migrateGuestData -> Migrated ${updated.length} item(s) in ${collection}`);
            }
        } catch (err) {
            logger.error(`migrateGuestData -> Failed migrating collection ${collection}`, err);
        }
    };
    
    await Promise.all([
        bulkMigrate("temporaryData"), 
        bulkMigrate("customerVehicles"), 
        bulkMigrate("customerContacts"), 
        bulkMigrate("customerLocations")
    ]);
    
    local.removeItem("temp_guest_id");
    cachedActiveUserId = String(finalUserId);
    session.setItem("cached_member_id", cachedActiveUserId);
    logger.info("migrateGuestData -> Migration Complete.");
}

// ==========================================
// 🛑 REAL-TIME VALIDATION
// ==========================================
function initValidationListeners() {
    ["#loginUserG", "#loginPasswordG"].forEach(id => {
        if ($w(id).id) {
            $w(id).onInput(() => validateLoginForm());
            $w(id).onChange(() => validateLoginForm());
        }
    });

    const regFields = [
        "#regFirstNameG", "#regLastNameG", "#regEmailG", "#regPhoneG", 
        "#regAddress1G", "#regCityG", "#regStateG", "#regZipG", "#regPasswordG", "#regConfirmG"
    ];
    regFields.forEach(id => {
        if ($w(id).id) {
            $w(id).onInput(() => validateRegistryForm());
            $w(id).onChange(() => validateRegistryForm());
        }
    });
}

function validateLoginForm() {
    let email = $w("#loginUserG").id ? $w("#loginUserG").value : "";
    let pass = $w("#loginPasswordG").id ? $w("#loginPasswordG").value : "";
    let isValid = email.trim() !== "" && pass.trim() !== "";
    
    if ($w("#btnLoginG").id) {
        if (isValid) $w("#btnLoginG").enable(); else $w("#btnLoginG").disable();
    }
}

function validateRegistryForm() {
    let isValid = true;
    let formData = {};
    const fields = [
        "#regFirstNameG", "#regLastNameG", "#regEmailG", "#regPhoneG",
        "#regAddress1G", "#regCityG", "#regStateG", "#regZipG", "#regPasswordG", "#regConfirmG"
    ];
   
    fields.forEach(id => {
        if ($w(id).id) {
            if (!$w(id).value || $w(id).value.trim() === "") isValid = false;
            if (id !== "#regPasswordG" && id !== "#regConfirmG") {
                formData[id] = $w(id).value;
            }
        }
    });

    session.setItem("registryFormData", JSON.stringify(formData));

    if ($w("#registrySubmit").id) {
        $w("#registrySubmit").enable();
    }
}

// ==========================================
// 🔑 LOGIN ENGINE
// ==========================================
function initLoginButtons() {
    if ($w("#btnRegisterG").id) {
        $w("#btnRegisterG").onClick(() => {
            logger.info("initLoginButtons -> #btnRegisterG clicked, routing to registryProfileState");
            if ($w("#msbPrompts").id) {
                $w("#msbPrompts").hide("fade", { duration: 150 }).then(() => $w("#msbPrompts").collapse());
            }
            wixLocationFrontend.queryParams.add({ "route": "registryProfileState" });
            if (hooks.smartGoTo) hooks.smartGoTo("registryProfileState");
        });
    }

    if ($w("#loginNewPasswordG").id) {
        $w("#loginNewPasswordG").onClick(async () => {
            logger.info("initLoginButtons -> #loginNewPasswordG clicked");
            showErrorMessage("Custom Password Reset coming soon!"); 
        });
    }

    const executeLogin = async () => {
        if (isSubmitting) return;

        let email = $w("#loginUserG").id ? $w("#loginUserG").value : "";
        let password = $w("#loginPasswordG").id ? $w("#loginPasswordG").value : "";
        if (!email || email.trim() === "" || !password || password.trim() === "") return;

        isSubmitting = true;
        logger.info(`executeLogin -> Attempting login for email: ${email.trim()}`);
        let btn = $w("#btnLoginG");

        const showError = (message) => {
            if (btn.id) {
                btn.label = "Error. Try Again.";
                btn.style.backgroundColor = "#DF3131";
            }
            showErrorMessage(message); 
            setTimeout(() => { 
                if (btn.id) {
                    btn.label = "Login"; 
                    btn.style.backgroundColor = "#000000"; 
                    btn.enable(); 
                }
                isSubmitting = false; 
            }, 2000);
        };

        if (btn.id) {
            btn.disable(); 
            btn.label = "Authenticating..."; 
            btn.style.backgroundColor = "#000000";
        }

        try {
            await authentication.login(email, password);
            logger.info(`executeLogin -> Login succeeded for ${email.trim()}`);
            if (btn.id) {
                btn.label = "✅ Success!";
                btn.style.backgroundColor = "#17E6AD"; 
                btn.style.color = "#000000"; 
            }
            
            let oldGuestId = local.getItem("temp_guest_id");
            const member = await currentMember.getMember();
            
            if (member && member._id) {
                cachedActiveUserId = String(member._id);
                session.setItem("cached_member_id", cachedActiveUserId);
                if (oldGuestId) {
                    await migrateGuestData(oldGuestId, member._id);
                }
            }
            
            setTimeout(() => { 
                if (hooks.triggerPageReload) hooks.triggerPageReload(); 
            }, 800);
            
        } catch (error) {
            logger.error("executeLogin -> Login Failed", error);
            showError("Invalid Email or Password.");
        }
    };

    if ($w("#loginUserG").id) {
        $w("#loginUserG").onKeyPress((event) => {
            if (event.key === "Enter") {
                if ($w("#loginPasswordG").id) $w("#loginPasswordG").focus();
            }
        });
    }

    if ($w("#loginPasswordG").id) {
        $w("#loginPasswordG").onKeyPress((event) => {
            if (event.key === "Enter") {
                setTimeout(() => {
                    validateLoginForm();
                    executeLogin();
                }, 50);
            }
        });
    }

    if ($w("#btnLoginG").id) {
        $w("#btnLoginG").onClick(() => executeLogin());
    }
}

// ==========================================
// 📝 REGISTRATION ENGINE
// ==========================================
function initRegistryButtons() {
    const smsBtn = $w("#btnSmsConsent");
    if (smsBtn.id) {
        isSmsConsentChecked = smsBtn.checked;

        smsBtn.onChange(() => {
            isSmsConsentChecked = smsBtn.checked;
            logger.info(`initRegistryButtons -> #btnSmsConsent changed to: ${isSmsConsentChecked}`);
            smsBtn.updateValidityIndication();
            validateRegistryForm();
        });
    }

    if ($w("#registrySubmit").id) {
        $w("#registrySubmit").onClick(async () => { 
            if (isSubmitting) return;
            await submitGlobalRegistry(); 
        });
    }
}

async function submitGlobalRegistry() {
    isSubmitting = true;
    logger.info("submitGlobalRegistry -> Starting account registration validation...");

    const fields = [
        { id: "#regFirstNameG", name: "First Name" }, { id: "#regLastNameG", name: "Last Name" },
        { id: "#regEmailG", name: "Email" }, { id: "#regPhoneG", name: "Phone Number" }, 
        { id: "#regAddress1G", name: "Address" }, { id: "#regCityG", name: "City" }, 
        { id: "#regStateG", name: "State" }, { id: "#regZipG", name: "Zip Code" }
    ];

    let missingFields = [];
    let formValues = {};

    fields.forEach(field => {
        if ($w(field.id).id) {
            let val = $w(field.id).value;
            if (!val || val.trim() === "" || (field.id === "#regZipG" && val.includes("@"))) {
                missingFields.push(field.name); 
                $w(field.id).style.borderColor = "#DF3131"; 
            } else { 
                $w(field.id).style.borderColor = "#17E6AD"; 
                formValues[field.id] = val.trim(); 
            }
        }
    });

    let passVal = $w("#regPasswordG").id ? $w("#regPasswordG").value : "";
    let confirmVal = $w("#regConfirmG").id ? $w("#regConfirmG").value : "";

    if (!passVal || passVal.length < 6) { 
        missingFields.push("Password (Min 6 chars)"); 
        if ($w("#regPasswordG").id) $w("#regPasswordG").style.borderColor = "#DF3131"; 
    } else { if ($w("#regPasswordG").id) $w("#regPasswordG").style.borderColor = "#17E6AD"; }

    if (passVal !== confirmVal || !confirmVal) { 
        missingFields.push("Matching Passwords"); 
        if ($w("#regConfirmG").id) $w("#regConfirmG").style.borderColor = "#DF3131"; 
    } else { if ($w("#regConfirmG").id) $w("#regConfirmG").style.borderColor = "#17E6AD"; }

    if (missingFields.length > 0) {
        logger.warn(`submitGlobalRegistry -> Validation failed. Missing: ${missingFields.join(", ")}`);
        showErrorMessage(`Missing: ${missingFields.join(", ")}`);
        isSubmitting = false; return;
    }

    if (!isSmsConsentChecked) {
        logger.warn("submitGlobalRegistry -> Blocked: SMS consent checkbox not checked");
        if ($w("#btnSmsConsent").id) $w("#btnSmsConsent").updateValidityIndication();
        showErrorMessage("Please check the box to agree to SMS updates before creating your account.");
        isSubmitting = false; return;
    }

    let submitBtn = $w("#registrySubmit");
    if (submitBtn.id) { submitBtn.label = "Creating Account..."; submitBtn.disable(); }
    
    try {
        const emailVal = formValues["#regEmailG"].toLowerCase(); 
        const rawPhone = formValues["#regPhoneG"];
        const phoneVal = formatPhoneNumber(rawPhone); 
        
        let duplicateCheck = await wixData.query("customerProfiles").eq("email", emailVal).find();

        if (duplicateCheck.items.length > 0) {
            logger.warn(`submitGlobalRegistry -> Duplicate email detected: ${emailVal}`);
            if ($w("#regEmailG").id) $w("#regEmailG").style.borderColor = "#DF3131";
            showErrorMessage("This email is already registered."); 
            if (submitBtn.id) { submitBtn.label = "Try Again"; submitBtn.enable(); }
            isSubmitting = false; return; 
        }

        let rawAddress1 = $w("#regAddress1G").value || "";
        if (rawAddress1.includes("@")) {
            logger.warn("submitGlobalRegistry -> Autofill placed email inside #regAddress1G");
            if ($w("#regAddress1G").id) $w("#regAddress1G").style.borderColor = "#DF3131";
            showErrorMessage("Please enter a valid Street Address (Autofill placed an email here)."); 
            if (submitBtn.id) { submitBtn.label = "Try Again"; submitBtn.enable(); }
            isSubmitting = false; return;
        }

        let finalUserId = await getActiveUserId(); 
        let isGuest = finalUserId.startsWith("guest_");

        if (isGuest) { 
            let oldGuestId = local.getItem("temp_guest_id"); 
            const regResult = await authentication.register(emailVal, passVal, {
                contactInfo: { firstName: formValues["#regFirstNameG"], lastName: formValues["#regLastNameG"], phones: [phoneVal] }
            });
            finalUserId = regResult.member._id; 
            cachedActiveUserId = String(finalUserId);
            session.setItem("cached_member_id", cachedActiveUserId);

            if (oldGuestId) {
                await migrateGuestData(oldGuestId, finalUserId);
            }
        }

        const contactPayload = { userId: finalUserId, firstName: formValues["#regFirstNameG"], lastName: formValues["#regLastNameG"], phone: phoneVal, email: emailVal, isPrimary: true };
        const locationPayload = { userId: finalUserId, address1: $w("#regAddress1G").value, address2: $w("#regAddress2G").value, city: formValues["#regCityG"], state: formValues["#regStateG"], zip: formValues["#regZipG"], isPrimary: true };
        const profilePayload = { _id: finalUserId, firstName: formValues["#regFirstNameG"], lastName: formValues["#regLastNameG"], phone: phoneVal, email: emailVal, address1: $w("#regAddress1G").value, address2: $w("#regAddress2G").value, city: formValues["#regCityG"], state: formValues["#regStateG"], zip: formValues["#regZipG"], activeSubscription: false };
        
        await Promise.all([
            wixData.insert("customerContacts", contactPayload),
            wixData.insert("customerLocations", locationPayload),
            wixData.insert("customerProfiles", profilePayload)
        ]);
        logger.info(`submitGlobalRegistry -> Inserted profile, contact & location for userId: ${finalUserId}`);

        try {
            sendWelcomeEmail(emailVal, formValues["#regFirstNameG"], finalUserId);
        } catch (e) {
            logger.error("submitGlobalRegistry -> Failed to trigger welcome email payload", e);
        }

        if (submitBtn.id) submitBtn.label = "✅ Account Created!";
        session.removeItem("registryFormData");
        
        setTimeout(() => { 
            let breadcrumb = session.getItem("returnBreadcrumb");
            if (breadcrumb && hooks.smartGoTo) {
                session.removeItem("returnBreadcrumb");
                hooks.smartGoTo(breadcrumb); 
            } else {
                if (hooks.triggerPageReload) hooks.triggerPageReload(); 
            }
        }, 1200);

    } catch (error) {
        logger.error("submitGlobalRegistry -> Registry Failed", error);
        if (submitBtn.id) { submitBtn.label = "Error. Try Again"; submitBtn.enable(); }
        showErrorMessage("Failed to create account. Try again."); 
        isSubmitting = false;
    }
}

function initAutoCaps() {
    const autoCapFields = ["#regFirstNameG", "#regLastNameG", "#regCityG"];
    autoCapFields.forEach(id => {
        if ($w(id).id) {
            $w(id).onBlur((event) => {
                let val = event.target.value;
                if (val) $w(id).value = val.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                validateRegistryForm();
            });
        }
    });
}

function formatPhoneNumber(rawPhone) {
    if (!rawPhone) return "";
    let cleaned = rawPhone.replace(/\D/g, ''); 
    if (cleaned.length === 10) return `(${cleaned.substring(0,3)})-${cleaned.substring(3,6)}-${cleaned.substring(6,10)}`;
    return rawPhone; 
}