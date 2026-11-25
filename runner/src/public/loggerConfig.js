// --- public/loggerConfig.js ---

export const APP_LOGS = {
    MASTER_SWITCH: true,
   
    // Core Engines
    ROUTER: true,
    HEADER: true,
    AUTH: true,
    MESSAGES: true,
    REPEATER: true,
    ANIMATIONS: true,
   
    // Page & Feature Engines
    PACKAGES: true,
    PROFILE: true,
    DETAIL_INFO: true,
    GARAGE: true,
    CALENDAR: true,
    SECURITY: true,
   
    // Cart & Checkout Engines
    CART: true,
    CART_UI: true,
    SUMMARY: true,
    PAYMENT: true,
   
    // Lightbox & Popup Files
    CART_EDITS: true,
    CONTACT_LOCATION: true,
    PACKAGE_EDITS: true,
    SITE_MENU: true,
    VEHICLE_ADD: true,
    WHATS_INCLUDED: true,
    WHATS_INCLUDED_G: true,
   
    // Widgets
    CART_WIDGET: true,
    REVIEW_WIDGET: true,
    DEFAULT_LEVEL: "MODERATE"
};

const escalatedModules = new Set();
export function flagModuleForExtensiveLogs(moduleName, reason = "") {
    if (!escalatedModules.has(moduleName)) {
        escalatedModules.add(moduleName);
        console.warn(`🔬 [SELF-DIAGNOSTIC]: Auto-escalated '${moduleName}' to EXTENSIVE logging! Reason: ${reason}`);
    }
}
export function createSmartLogger(moduleName, configFlag = true) {
    const isEnabled = ()=> APP_LOGS.MASTER_SWITCH && configFlag;
    const isExtensive = ()=> escalatedModules.has(moduleName) || APP_LOGS.DEFAULT_LEVEL === "EXTENSIVE";
    return {
        info: (msg, data) => { if (isEnabled()) data !== undefined ? console.log(`📌 [${moduleName}]: ${msg}`, data) : console.log(`📌 [${moduleName}]: ${msg}`); },
        verbose: (msg, data) => { if (isEnabled() && isExtensive()) console.log(`🔬 [${moduleName}:EXTENSIVE]: ${msg}`, data !== undefined ? data : ""); },
        warn: (msg, data) => { flagModuleForExtensiveLogs(moduleName, msg); console.warn(`📌 [${moduleName}]: ${msg}`, data !== undefined ? data : ""); },
        error: (msg, err) => { flagModuleForExtensiveLogs(moduleName, msg); console.error(`📌 [${moduleName}]: ${msg}`, err !== undefined ? err : ""); }
    };
}