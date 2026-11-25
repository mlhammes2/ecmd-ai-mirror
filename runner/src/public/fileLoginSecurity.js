// — public/fileLoginSecurity.js

import wixData from 'wix-data';
import { session } from 'wix-storage';
import { authentication } from 'wix-members-frontend';
import wixLocationFrontend from 'wix-location-frontend';
import { registerRepeater, smartSyncRepeater } from 'public/repeaterEngine';
import { executeFullAccountDeletion } from 'public/profileEngine';
import { initRouterEngine, smartGoTo, openSideMenu, closeSideMenu, openOverlay, closeAllOverlays, closeTopOverlay, showSuccessMessage, showErrorMessage } from 'public/routerEngine';
import { APP_LOGS } from 'public/loggerConfig';
import { adminDeleteAccount, updateUserLoginEmail } from 'backend/securityActions.jsw';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';
 
let $w;
let hooks;
let activeUserProfile = null;

// 🛑 Prevents Velo from stacking multiple click/input events if opened multiple times
let isSubmitBound = false;
let isInputBound = false;

// ==========================================
// 🔴 DEBUGGING & AI TELEMETRY ENGINE
// ==========================================
const DEBUG_MODE = APP_LOGS.MASTER_SWITCH && APP_LOGS.SECURITY;
const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [FILE_LOGIN_SECURITY]: ${msg}`, data) : console.log(`📌 [FILE_LOGIN_SECURITY]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [FILE_LOGIN_SECURITY]: ${msg}`, data) : console.warn(`📌 [FILE_LOGIN_SECURITY]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [FILE_LOGIN_SECURITY]: ${msg}`, data) : console.error(`📌 [FILE_LOGIN_SECURITY]: ${msg}`); }
};

registerModuleState("fileLoginSecurity", () => ({
    hasActiveUserProfile: Boolean(activeUserProfile),
    profileSummary: activeUserProfile ? {
        _id: activeUserProfile._id,
        firstName: activeUserProfile.firstName,
        lastName: activeUserProfile.lastName,
        email: activeUserProfile.email,
        phone: activeUserProfile.phone
    } : null,
    dynamicInputContext: session.getItem("dynamicInputContext") || null,
    isSubmitBound,
    isInputBound
}));

registerDomElements({
    msb: ["#msbPrompts"],
    boxes: ["#editLoginSecurityInputBox", "#editLoginSecurityNewPassBox", "#editLoginSecurityConfirmPassBox"],
    repeaters: ["#loginSecurityRep"],
    inputs: ["#editLoginSecurityInput", "#editLoginSecurityNewPass", "#editLoginSecurityConfirmPass"]
});

export function initLoginSecurityEngine(wixContext, providedHooks) {
    logger.info("initLoginSecurityEngine -> Initializing Login Security Engine...");
    $w = wixContext;
    hooks = providedHooks;

    initSecurityRepeater();

    if ($w("#msbPrompts").id) {
        $w("#msbPrompts").onChange((event) => {
            if (event.target.currentState.id === "editSecurityLogin") {
                logger.info("msbPrompts.onChange -> Dynamic Edit State opened. Building UI...");
                loadDynamicInputUI();
            }
        });
    }
}

export async function loadSecurityData() {
    if (!$w("#loginSecurityRep").id) return;
   
    try {
        let userId = await hooks.getActiveUserId();
        logger.info(`loadSecurityData -> Fetching security items & profile for userId: ${userId}`);

        let [securityRes, profileRes] = await Promise.all([
            wixData.query("loginSecurity").eq("isEnabled", true).ascending("sort").find(),
            wixData.query("customerProfiles").eq("_id", userId).find()
        ]);

        if (profileRes.items.length > 0) {
            activeUserProfile = profileRes.items[0];
        }

        smartSyncRepeater($w, "#loginSecurityRep", securityRes.items);
    } catch (err) {
        logger.error("loadSecurityData -> Failed to load Login & Security data", err);
    }
}

function initSecurityRepeater() {
    registerRepeater($w, "#loginSecurityRep", ($item, itemData) => {
        let title = itemData.title || "";
       
        if ($item("#loginSecurityRepTitle").type) $item("#loginSecurityRepTitle").text = title;
       
        if ($item("#loginSecurityRepText").type) {
            if (itemData.text) {
                $item("#loginSecurityRepText").text = itemData.text;
                $item("#loginSecurityRepText").expand();
            } else {
                $item("#loginSecurityRepText").collapse();
            }
        }

        if ($item("#loginSecurityRepButton").type) {
            $item("#loginSecurityRepButton").label = itemData.buttonText || "Edit";
           
            $item("#loginSecurityRepButton").onClick(() => {
                logger.info(`loginSecurityRepButton.onClick -> Clicked edit for dataKey: ${itemData.dataKey}`);
               
                if (itemData.dataKey === "password") {
                    authentication.promptForgotPassword();
                    return;
                }

                if (itemData.targetLocation && hooks.smartGoTo) {
                    let dynamicInstructions = {
                        dataKey: itemData.dataKey,            
                        title: itemData.editTitle,            
                        placeholder: itemData.editDescription,
                        placeholder2: itemData.placeholder2,  
                        placeholder3: itemData.placeholder3,  
                        buttonLabel: itemData.editButton      
                    };
                   
                    if (typeof session !== "undefined") {
                        session.setItem("dynamicInputContext", JSON.stringify(dynamicInstructions));
                        session.setItem("returnBreadcrumb", "loginSecurityProfileState");
                       
                        if (itemData.targetLocation === "editSecurityLogin") {
                            loadDynamicInputUI();
                        }
                    }
                   
                    hooks.smartGoTo(itemData.targetLocation);
                }
            });
        }

        if ($item("#loginSecurityRepData").type) {
            let userDataString = "";
            let key = itemData.dataKey;

            if (key && activeUserProfile) {
                switch (key) {
                    case "fullName":
                        userDataString = `${activeUserProfile.firstName || ''} ${activeUserProfile.lastName || ''}`.trim();
                        break;
                    case "email":
                        userDataString = activeUserProfile.email || "";
                        break;
                    case "phone":
                        userDataString = activeUserProfile.phone || "";
                        break;
                    case "password":
                    case "passkey":
                        userDataString = "**********";
                        break;
                }
            }

            if (userDataString) {
                $item("#loginSecurityRepData").text = userDataString;
                $item("#loginSecurityRepData").expand();
            } else {
                $item("#loginSecurityRepData").collapse();
            }
        }
    });
}

function toTitleCase(str) {
    if (!str) return "";
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.substring(1)).join(' ');
}

// ==========================================
// 🎛️ DYNAMIC INPUT CONFIGURATOR
// ==========================================
export function loadDynamicInputUI() {
    let contextStr = session.getItem("dynamicInputContext");
    if (!contextStr) return;

    let context = JSON.parse(contextStr);
    let mode = context.dataKey;

    logger.info(`loadDynamicInputUI -> Configuring UI for mode: ${mode}`);

    const toggleBox = (baseId, shouldExpand, placeholderStr, inputTypeStr = "text") => {
        let inputEl = $w(baseId);
        let boxEl = $w(`${baseId}Box`);
       
        if (inputEl.id) {
            inputEl.value = "";
            inputEl.placeholder = placeholderStr;
            inputEl.inputType = inputTypeStr;
        }
        if (boxEl.id) {
            shouldExpand ? boxEl.expand() : boxEl.collapse();
        }
    };

    if ($w("#editLoginSecurityTitle").id) $w("#editLoginSecurityTitle").text = context.title || "Edit Information";
    if ($w("#editLoginSecurityDescription").id) $w("#editLoginSecurityDescription").text = context.placeholder || "Enter details below.";

    const showRecovery = (mode === "password");
   
    if ($w("#editSecurityLoginEmailConfirm").id) {
        showRecovery ? $w("#editSecurityLoginEmailConfirm").expand() : $w("#editSecurityLoginEmailConfirm").collapse();
        if (!$w("#editSecurityLoginEmailConfirm").hasEvent) {
            $w("#editSecurityLoginEmailConfirm").hasEvent = true;
           
            $w("#editSecurityLoginEmailConfirm").onClick(async () => {
                if (hooks.closeTopOverlay) hooks.closeTopOverlay($w);
                authentication.promptForgotPassword();
            });
        }
    }
   
    if ($w("#editSecurityLoginPhoneConfirm").id) {
        showRecovery ? $w("#editSecurityLoginPhoneConfirm").expand() : $w("#editSecurityLoginPhoneConfirm").collapse();
        if (!$w("#editSecurityLoginPhoneConfirm").hasEvent) {
            $w("#editSecurityLoginPhoneConfirm").hasEvent = true;
            $w("#editSecurityLoginPhoneConfirm").onClick(() => {
                if (hooks.showSuccessMessage) hooks.showSuccessMessage("Password reset link sent to your phone! (Coming Soon)");
            });
        }
    }

    let liveFirst = activeUserProfile ? activeUserProfile.firstName : "First Name";
    let liveLast = activeUserProfile ? activeUserProfile.lastName : "Last Name";
    let liveEmail = activeUserProfile ? activeUserProfile.email : "Current Email";
    let livePhone = activeUserProfile ? activeUserProfile.phone : "Current Phone";

    if (mode === "password") {
        toggleBox("#editLoginSecurityInput", false, "", "password");
        toggleBox("#editLoginSecurityNewPass", false, "", "password");
        toggleBox("#editLoginSecurityConfirmPass", false, "", "password");
       
        if ($w("#editLoginSecuritySubmit").id) $w("#editLoginSecuritySubmit").collapse();
    } else {
        if ($w("#editLoginSecuritySubmit").id) $w("#editLoginSecuritySubmit").expand();

        if (mode === "delete") {
            toggleBox("#editLoginSecurityInput", true, "Enter Current Password", "password");
            toggleBox("#editLoginSecurityNewPass", false, "", "text");
            toggleBox("#editLoginSecurityConfirmPass", false, "", "text");
        } else if (mode === "fullName") {
            toggleBox("#editLoginSecurityInput", true, liveFirst, "text");
            toggleBox("#editLoginSecurityNewPass", true, liveLast, "text");
            toggleBox("#editLoginSecurityConfirmPass", true, "Current Password", "password");
        } else if (mode === "email") {
            toggleBox("#editLoginSecurityInput", true, liveEmail, "email");
            toggleBox("#editLoginSecurityNewPass", false, "", "text");
            toggleBox("#editLoginSecurityConfirmPass", true, "Current Password", "password");
        } else if (mode === "phone") {
            toggleBox("#editLoginSecurityInput", true, livePhone, "tel");
            toggleBox("#editLoginSecurityNewPass", false, "", "text");
            toggleBox("#editLoginSecurityConfirmPass", true, "Current Password", "password");
        }
    }

    if (!isInputBound) {
        isInputBound = true;
        const applyCaps = (event) => {
            let activeMode = JSON.parse(session.getItem("dynamicInputContext") || "{}").dataKey;
            if (activeMode === "fullName") {
                let startVal = event.target.value;
                let capVal = toTitleCase(startVal);
                if (startVal !== capVal) event.target.value = capVal;
            }
        };
        if ($w("#editLoginSecurityInput").id) $w("#editLoginSecurityInput").onInput(applyCaps);
        if ($w("#editLoginSecurityNewPass").id) $w("#editLoginSecurityNewPass").onInput(applyCaps);
    }

    if ($w("#editLoginSecuritySubmit").id) {
        $w("#editLoginSecuritySubmit").label = context.buttonLabel || "Submit";
       
        if (!isSubmitBound) {
            isSubmitBound = true;

            $w("#editLoginSecuritySubmit").onClick(async () => {
                let currentContext = JSON.parse(session.getItem("dynamicInputContext") || "{}");
                let currentMode = currentContext.dataKey;
               
                if (currentMode === "password") return;
               
                let btn = $w("#editLoginSecuritySubmit");
                let box1Val = $w("#editLoginSecurityInput").value;
                let box2Val = $w("#editLoginSecurityNewPass").value;
                let box3Val = $w("#editLoginSecurityConfirmPass").value;
               
                const handleFailure = (msg) => {
                    logger.warn(`editLoginSecuritySubmit -> Validation/Update failure (${currentMode}): ${msg}`);
                    if (hooks.showErrorMessage) hooks.showErrorMessage(msg);
                    btn.label = currentContext.buttonLabel || "Submit";
                    btn.enable();
                };

                if (currentMode === "delete" && !box1Val) return handleFailure("Enter Password to Confirm");
                if (currentMode === "fullName" && (!box1Val || !box2Val || !box3Val)) return handleFailure("Missing Information");
                if ((currentMode === "email" || currentMode === "phone") && (!box1Val || !box3Val)) return handleFailure("Missing Information");

                btn.disable();
                btn.label = "Verifying...";

                try {
                    let passwordToVerify = (currentMode === "delete") ? box1Val : box3Val;
                    if (!activeUserProfile || !activeUserProfile.email) return handleFailure("System error: No profile found.");
                   
                    try {
                        await authentication.login(activeUserProfile.email, passwordToVerify);
                        logger.info(`editLoginSecuritySubmit -> Password verified for mode: ${currentMode}`);
                    } catch (authErr) {
                        return handleFailure("Incorrect Password");
                    }

                    if (currentMode === "delete") {
                        let activeUserId = await hooks.getActiveUserId();
                        btn.label = "Erasing Account...";
                        await adminDeleteAccount(activeUserId);
                        if (hooks.showSuccessMessage) hooks.showSuccessMessage("Account Permanently Deleted");
                        setTimeout(() => { wixLocationFrontend.to(wixLocationFrontend.url); }, 2000);
                        return;
                    }
                   
                    if (currentMode === "email") {
                        btn.label = "Updating Login...";
                        let emailRes = await updateUserLoginEmail(box1Val);
                        if (!emailRes.success) return handleFailure("Update failed. Email may be invalid or already in use.");
                        activeUserProfile.email = box1Val;
                    }
                   
                    if (currentMode === "fullName") {
                        activeUserProfile.firstName = box1Val;
                        activeUserProfile.lastName = box2Val;
                    }
                   
                    if (currentMode === "phone") {
                        activeUserProfile.phone = box1Val;
                    }

                    await wixData.update("customerProfiles", activeUserProfile);
                    logger.info(`editLoginSecuritySubmit -> Updated customerProfiles for mode: ${currentMode}`);
                   
                    $w("#loginSecurityRep").forEachItem(($item, itemData) => {
                        if (itemData.dataKey === currentMode) {
                            if (currentMode === "fullName") $item("#loginSecurityRepData").text = `${box1Val} ${box2Val}`.trim();
                            if (currentMode === "email") $item("#loginSecurityRepData").text = box1Val;
                            if (currentMode === "phone") $item("#loginSecurityRepData").text = box1Val;
                        }
                    });
                   
                    if (hooks.showSuccessMessage) hooks.showSuccessMessage("Information successfully updated!");
                    btn.label = currentContext.buttonLabel || "Submit";
                    btn.enable();
                   
                    if (hooks.closeTopOverlay) hooks.closeTopOverlay($w);

                } catch (error) {
                    logger.error("editLoginSecuritySubmit -> Submission failed", error);
                    handleFailure("Failed to update. Try again.");
                }
            });
        }
    }
}