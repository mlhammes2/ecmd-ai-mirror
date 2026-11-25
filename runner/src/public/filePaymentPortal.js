// — public/filePaymentPortal.js

import wixData from 'wix-data';
import { getActiveUserId } from 'public/authEngine';
import { session } from 'wix-storage';
import wixLocationFrontend from 'wix-location-frontend';
import wixWindowFrontend from 'wix-window-frontend'; 
import { createPaymentIntent, chargeSavedCard } from 'backend/stripeEngine.jsw';
import { APP_LOGS } from 'public/loggerConfig';
import { initRouterEngine, smartGoTo, openSideMenu, closeSideMenu, openOverlay, closeAllOverlays, closeTopOverlay, showSuccessMessage, showErrorMessage } from 'public/routerEngine';
import { generateClientToken, processBraintreePayment } from 'backend/braintreeEngine.jsw';
import { sendPurchaseReceiptEmail } from 'backend/emailDispatchEngine.jsw';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

let $w;
let hooks;
let isStripeReady = false;

// ==========================================
// 🎨 UI VISUAL CONSTANTS
// ==========================================
const CHECK_IMG_ON = "https://static.wixstatic.com/shapes/694137_c50600f9788e4f04a98d38d0e9af9e4b.svg";
const CHECK_IMG_OFF = "https://static.wixstatic.com/shapes/694137_1602bde3fd0e4741a3119c599614fb9a.svg"; 
const BORDER_SELECTED = "#2B81FF"; 
const BORDER_DEFAULT = "#000000"; 

// ==========================================
// 🧠 PAYMENT STATE MACHINE 
// ==========================================
let paymentState = {
    selectedJobs: new Map(), 
    tipType: null,           
    tipValue: 0,             
    paymentMethod: null,     
    promoDiscount: 0,        
    grandTotal: 0,
    savedCards: [],          
    selectedSavedCardId: null 
};

let cmsPaymentMethods = [];
let stripeUpdateTimer = null;
let textLoadingInterval = null; 
let isPaymentDataLoaded = false; // 👈 THE CACHE LOCK

// ==========================================
// 🔴 DEBUGGING & AI TELEMETRY ENGINE
// ==========================================
const DEBUG_MODE = APP_LOGS.MASTER_SWITCH && APP_LOGS.PAYMENT; 
const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [FILE_PAYMENT_PORTAL]: ${msg}`, data) : console.log(`📌 [FILE_PAYMENT_PORTAL]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [FILE_PAYMENT_PORTAL]: ${msg}`, data) : console.warn(`📌 [FILE_PAYMENT_PORTAL]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [FILE_PAYMENT_PORTAL]: ${msg}`, data) : console.error(`📌 [FILE_PAYMENT_PORTAL]: ${msg}`); }
};

registerModuleState("filePaymentPortal", () => ({
    isPaymentDataLoaded,
    isStripeReady,
    selectedJobIds: Array.from(paymentState.selectedJobs.keys()),
    selectedJobsCount: paymentState.selectedJobs.size,
    tipType: paymentState.tipType,
    tipValue: paymentState.tipValue,
    paymentMethod: paymentState.paymentMethod,
    promoDiscount: paymentState.promoDiscount,
    grandTotal: paymentState.grandTotal,
    savedCardsCount: (paymentState.savedCards || []).length,
    selectedSavedCardId: paymentState.selectedSavedCardId,
    cmsPaymentMethodsCount: (cmsPaymentMethods || []).length
}));

registerDomElements({
    boxes: [
        "#paymentPortalMasterBox", "#paymentPortalUnPaidMessageBox",
        "#paymentMethodCardBox", "#paymentMethodCardButtonBox", "#iframeExpandBox"
    ],
    repeaters: [
        "#paymentPortalJobsRep", "#paymentPortalTipsRep",
        "#paymentMethodRep", "#paymentMethodCardRep"
    ],
    inputs: ["#paymentPortalTipsCustom"]
});

export function initPaymentPortalEngine(wixContext, providedHooks) {
    logger.info("Initializing Payment Portal Engine...");
    $w = wixContext;
    hooks = providedHooks || {};

    // 1. Instantly attach UI click events (Does not block rendering)
    initPaymentUI($w);
    catchStripeRedirects(); 
}

// 👈 NEW: JIT Dispatch Function
export async function loadPaymentPortalData() {
    if (isPaymentDataLoaded) return; // Stop redundant database queries

    logger.info("🚀 Router triggered JIT fetch for Payment Portal...");
    
    await Promise.all([
        loadUnpaidPaymentJobs($w),
        loadTipsCMS($w),
        loadPaymentMethodsCMS($w)
    ]);
    
    isPaymentDataLoaded = true; // Lock the cache
}

// ==========================================
// 💸 DATABASE UPDATE ENGINE
// ==========================================
async function markSelectedJobsAsPaid() {
    let jobsToUpdate = [];

    const applyPaymentStamp = (job) => {
        job.paymentStatus = "Paid";
        job.paymentMethodString = paymentState.paymentMethod || "unknown";

        // If they used a saved card, stamp the brand and last 4 digits!
        if (paymentState.paymentMethod === "card" && paymentState.selectedSavedCardId) {
            let usedCard = paymentState.savedCards.find(c => c._id === paymentState.selectedSavedCardId);
            if (usedCard) {
                job.cardNetwork = usedCard.brand;
                job.cardLast4 = usedCard.last4;
            }
        }
        return job;
    };

    // 1. Grab jobs currently in the active UI memory
    if (paymentState.selectedJobs.size > 0) {
        paymentState.selectedJobs.forEach((job) => {
            jobsToUpdate.push(applyPaymentStamp(job));
        });
    } 
    // 2. Fallback for Stripe Redirects (if the page reloaded and wiped the UI memory)
    else {
        let savedJobId = session.getItem("preselectedPaymentJobId");
        if (savedJobId) {
            try {
                let res = await wixData.query("scheduledJobs").eq("_id", savedJobId).find();
                if (res.items.length > 0) {
                    jobsToUpdate.push(applyPaymentStamp(res.items[0]));
                }
            } catch (e) { logger.error("Recovery of Paid Job Failed", e); }
        }
    }

    // 3. Push the updates to the database!
    if (jobsToUpdate.length > 0) {
        try {
            await wixData.bulkUpdate("scheduledJobs", jobsToUpdate);
            logger.info(`✅ Successfully stamped ${jobsToUpdate.length} job(s) with Payment Data.`);
        } catch (error) {
            logger.error("🚨 Failed to update payment status in database", error);
        }
    }
    
    return jobsToUpdate; 
}

function dispatchReceiptAfterPayment(paidJobs) {
    if (!paidJobs || paidJobs.length === 0) return;
    
    let firstJob = paidJobs[0];
    let customerEmail = firstJob.email; 
    
    if (!customerEmail) {
        logger.warn("No customer email found on job. Cannot send receipt.");
        return;
    }

    let orderData = {
        firstName: firstJob.firstName || "Valued Customer",
        orderId: firstJob.orderId || firstJob._id,
        jobs: paidJobs
    };
    
    let paidJobIds = paidJobs.map(job => job._id);

    logger.info(`📨 Dispatching receipt email to ${customerEmail}...`);
    sendPurchaseReceiptEmail(customerEmail, orderData, paidJobIds)
        .then(res => logger.info("✅ Receipt Email Sent!", res))
        .catch(err => logger.error("🚨 Receipt Email Failed:", err));
}

export function resetPaymentPortal() {
    if (!$w) return;
    logger.info("🧹 Wiping Payment Portal State...");
    
    // 1. Wipe Memory State
    paymentState.selectedJobs.clear();
    paymentState.tipType = null;
    paymentState.tipValue = 0;
    paymentState.paymentMethod = null;
    paymentState.selectedSavedCardId = null; 
    
    session.removeItem("savedTipType");
    session.removeItem("savedTipValue");

    // 2. Wipe Jobs UI
    if ($w("#paymentPortalJobsRep").id) {
        $w("#paymentPortalJobsRep").forEachItem(($item) => {
            if ($item("#paymentPortalJobsRepBox").id) $item("#paymentPortalJobsRepBox").style.borderColor = BORDER_DEFAULT;
            if ($item("#paymentPortalJobsRepCheckBox").id) $item("#paymentPortalJobsRepCheckBox").src = CHECK_IMG_OFF;
        });
    }

    // 3. Wipe Tips UI
    if ($w("#paymentPortalTipsRep").id) {
        $w("#paymentPortalTipsRep").forEachItem(($item) => {
            if ($item("#paymentPortalTipsBox").id) $item("#paymentPortalTipsBox").style.borderColor = BORDER_DEFAULT;
        });
    }
    if ($w("#paymentPortalTipsCustomBox").id) $w("#paymentPortalTipsCustomBox").style.borderColor = BORDER_DEFAULT;
    if ($w("#paymentPortalNOTipsBox").id) $w("#paymentPortalNOTipsBox").style.borderColor = BORDER_DEFAULT;
    if ($w("#paymentPortalTipsCustom").id) $w("#paymentPortalTipsCustom").value = "";

    // 4. Wipe Methods UI & Totals
    refreshPaymentMethodUI($w);
    calculateTotals($w);
}

// 👉 Direct Bridge Function to instantly force a job selection when the portal opens
export function selectJobInPortal(jobId) {
    if (!$w) return;
    logger.info(`🎯 Bridge Triggered: Forcing selection of Job ${jobId}`);
    
    resetPaymentPortal(); 
    session.setItem("preselectedPaymentJobId", jobId);

    setTimeout(() => {
        if ($w("#paymentPortalJobsRep").id) {
            $w("#paymentPortalJobsRep").forEachItem(($item, itemData) => {
                if (itemData._id === jobId && !paymentState.selectedJobs.has(jobId)) {
                    paymentState.selectedJobs.set(itemData._id, itemData);
                    if ($item("#paymentPortalJobsRepBox").id) $item("#paymentPortalJobsRepBox").style.borderColor = BORDER_SELECTED;
                    if ($item("#paymentPortalJobsRepCheckBox").id) $item("#paymentPortalJobsRepCheckBox").src = CHECK_IMG_ON;
                }
            });
            calculateTotals($w);
        }
    }, 150);
}

function catchStripeRedirects() {
    let query = wixLocationFrontend.query;
    if (query.payment_intent && query.redirect_status) {
        logger.info(`🔄 Caught Stripe Bank Redirect! Status: ${query.redirect_status}`);
        
        let lastMethod = session.getItem("lastAttemptedPayment");
        
        setTimeout(async () => {
            if (query.redirect_status === 'succeeded') {
                logger.info(`🎉 [STRIPE RECOVERY]: Success detected. Firing UI updates...`);

                let recentlyPaidJobs = await markSelectedJobsAsPaid();
                dispatchReceiptAfterPayment(recentlyPaidJobs);

                session.removeItem("preselectedPaymentJobId");
                session.removeItem("savedTipType");
                session.removeItem("savedTipValue");
                session.removeItem("lastAttemptedPayment");
                
                resetPaymentPortal(); 
                
                if ($w("#msbPrompts").id) {
                    $w("#msbPrompts").hide();
                    $w("#msbPrompts").collapse();
                }
                
                showSuccessMessage("Thank you for your payment!");

            } else {
                logger.warn(`⚠️ [STRIPE RECOVERY]: Payment failed or canceled.`);
                showErrorMessage("Payment was not completed. Please try again.");
                
                if (lastMethod === 'card') {
                    paymentState.paymentMethod = "card";
                    refreshPaymentMethodUI($w);
                    calculateTotals($w);
                } else {
                    paymentState.paymentMethod = null;
                    refreshPaymentMethodUI($w);
                }
            }
        }, 1500);
    }
}

function initIframeExpandButton($w) {
    if ($w("#iframeExpand").id) {
        $w("#iframeExpand").onClick(() => {
            if ($w("#iframeSpacer").collapsed) {
                $w("#iframeSpacer").expand();
                $w("#iframeExpand").label = "Collapse View";
            } else {
                $w("#iframeSpacer").collapse();
                $w("#iframeExpand").label = "Expand View";
            }
        });
    }
}

function applyIframeLayoutRules($w) {
    let currentMethod = paymentState.paymentMethod;
    let isAddNewCard = currentMethod === "card" && !paymentState.selectedSavedCardId;
    
    logger.info(`📐 Applying layout rules for: ${currentMethod} | isAddNewCard: ${isAddNewCard}`);

    if ($w("#affirmImage").id) $w("#affirmImage").collapse();

    if (isAddNewCard) {
        if ($w("#iframeExpandBox").id) $w("#iframeExpandBox").collapse();
        if ($w("#iframeExpand").id) $w("#iframeExpand").label = "Collapse View"; 
    } else if (currentMethod === "cashapp") {
        if ($w("#iframeSpacer").id) $w("#iframeSpacer").collapse();
        if ($w("#iframeExpandBox").id) $w("#iframeExpandBox").expand();
        if ($w("#iframeExpand").id) $w("#iframeExpand").label = "Expand View"; 
        if ($w("#paymentHtmlButtonContainer01").id) $w("#paymentHtmlButtonContainer01").collapse();
    } else if (currentMethod === "affirm") {
        if ($w("#iframeSpacer").id) $w("#iframeSpacer").collapse();
        if ($w("#iframeExpandBox").id) $w("#iframeExpandBox").expand();
        if ($w("#iframeExpand").id) $w("#iframeExpand").label = "Expand View"; 
        if ($w("#paymentHtmlButtonContainer01").id) $w("#paymentHtmlButtonContainer01").collapse();
        
        if ($w("#affirmImage").id) $w("#affirmImage").expand();
    }
}

// ==========================================
// 🎛️ MAIN UI INITIALIZATION ROUTER
// ==========================================
function initPaymentUI($w) {
    initJobsVisuals($w);
    initTipsVisuals($w);
    initPaymentMethodVisuals($w); 
    initDesktopSubmitButtons($w); 
    initIframeExpandButton($w);
    calculateTotals($w); 
}

// ==========================================
// ⏳ LOADING ANIMATION ENGINE
// ==========================================
function startTextLoadingAnimation($wContext, targetId) {
    let dotCount = 1;
    if (textLoadingInterval) clearInterval(textLoadingInterval);
    if ($wContext(targetId).id) {
        $wContext(targetId).text = "Loading.";
        textLoadingInterval = setInterval(() => {
            dotCount++;
            if (dotCount > 3) dotCount = 1;
            $wContext(targetId).text = "Loading" + ".".repeat(dotCount);
        }, 400);
    }
}

function stopTextLoadingAnimation() {
    if (textLoadingInterval) { clearInterval(textLoadingInterval); textLoadingInterval = null; }
}

// ==========================================
// 🖥️ DESKTOP SUBMIT BUTTONS
// ==========================================
function initDesktopSubmitButtons($w) {
    const allDesktopStates = [
        "01", "02", "03", "04", "05", "06", "07",
        "Braintree01", "Braintree02", "Braintree03", "Braintree04", "Braintree05"
    ];
    
    allDesktopStates.forEach(btnSuffix => {
        let btnId = `#desktopSubmit${btnSuffix}`;
        
        if ($w(btnId).id) {
            $w(btnId).onClick(() => {
                logger.info(`🔥 Desktop Checkout Triggered for Box ${btnSuffix}`);
                $w(btnId).disable();
                $w(btnId).label = "Processing...";
                
                let activeItem = cmsPaymentMethods.find(item => item.stripeCode === paymentState.paymentMethod);
                
                if (activeItem) {
                    let stateString = activeItem.htmlDesktop || "";
                    let stateNumMatch = stateString.match(/\d+/);
                    let htmlSuffix = stateNumMatch ? stateNumMatch[0] : "Universal"; 
                    
                    let targetHtmlId;
                    if (activeItem.provider === "braintree") {
                        targetHtmlId = `#braintreeHtml${htmlSuffix}Desktop`;
                    } else {
                        if (htmlSuffix === "Universal") {
                            targetHtmlId = `#stripeUniversalHtmlDesktop`;
                        } else {
                            targetHtmlId = `#paymentMethodHTML${htmlSuffix}Desktop`;
                        }
                    }
                        
                    if ($w(targetHtmlId).id) {
                        logger.info(`📨 Routing submit command to Iframe: ${targetHtmlId}`);
                        $w(targetHtmlId).postMessage({ type: 'submitPayment' });
                    } else { 
                        logger.error(`🚨 Target Iframe not found: ${targetHtmlId}`);
                        $w(btnId).enable(); 
                        $w(btnId).label = "Error - Try Again"; 
                    }
                } else {
                    logger.error(`🚨 No active CMS item found for method: ${paymentState.paymentMethod}`);
                    $w(btnId).enable(); 
                    $w(btnId).label = "Error - Try Again";
                }
            });
        }
    });
}

// ==========================================
// 🔄 PAYMENT SYNC ENGINE
// ==========================================
function syncPaymentIframe($w) {
    if (!paymentState.paymentMethod || paymentState.grandTotal <= 0) return;

    let activeItem = cmsPaymentMethods.find(item => item.stripeCode === paymentState.paymentMethod);
    if (!activeItem) return;

    let isWallet = (activeItem.stripeCode === "apple_pay" || activeItem.stripeCode === "google_pay" || activeItem.stripeCode === "wallet");
    
    let stateString = activeItem.htmlDesktop || "";
    if (!stateString || stateString === "paymentStateBlank") return;

    let stateNumMatch = stateString.match(/\d+/);
    let suffix = stateNumMatch ? stateNumMatch[0] : "Universal"; 

    let targetHtmlId;
    let loadingId; 

    if (isWallet) {
        targetHtmlId = activeItem.stripeCode === "apple_pay" ? `#applePayWallet` : `#googlePayWallet`;
        loadingId = activeItem.stripeCode === "apple_pay" ? `#applePayLoading` : `#googlePayLoading`;
        
        if ($w(targetHtmlId).id) {
            $w(targetHtmlId).setAttribute('client-secret', '');
        }
    } else if (activeItem.provider === "braintree") {
        targetHtmlId = `#braintreeHtml${suffix}Desktop`;
        loadingId = `#paymentLoadingBraintree${suffix}`;
    } else {
        targetHtmlId = suffix === "Universal" ? `#stripeUniversalHtmlDesktop` : `#paymentMethodHTML${suffix}Desktop`;
        loadingId = suffix === "Universal" ? `#paymentLoading01` : `#paymentLoading${suffix}`;
    }

    if ($w(loadingId).id) $w(loadingId).expand();
    
    startTextLoadingAnimation($w, loadingId);

    setTimeout(() => {
        if (isWallet) {
            loadStripeWallet(paymentState.grandTotal, paymentState.paymentMethod, targetHtmlId);
        } 
        else if (activeItem.provider === "stripe" || paymentState.paymentMethod === "card") {
            loadStripeCheckout(paymentState.grandTotal, paymentState.paymentMethod, targetHtmlId, suffix === "Universal" ? "01" : suffix);
        } 
        else if (activeItem.provider === "braintree") {
            loadBraintreeCheckout(paymentState.grandTotal, targetHtmlId, suffix);
        }
    }, 500);
}

// ==========================================
// 🧮 THE CALCULATOR & VALIDATOR
// ==========================================
function calculateTotals($w) {
    let jobsTotal = 0;
    paymentState.selectedJobs.forEach((jobData) => { jobsTotal += Number(jobData.totalPrice || 0); });

    let discountedTotal = Math.max(0, jobsTotal - paymentState.promoDiscount);

    let tipAmount = 0;
    if (paymentState.tipType === "percent") tipAmount = discountedTotal * paymentState.tipValue;
    else if (paymentState.tipType === "custom") tipAmount = paymentState.tipValue;

    let subtotal = discountedTotal + tipAmount;
    let cardFee = paymentState.paymentMethod === "card" ? subtotal * 0.04 : 0;
    paymentState.grandTotal = subtotal + cardFee;

    if ($w("#paymentSummaryCount").id) $w("#paymentSummaryCount").text = String(paymentState.selectedJobs.size);
    if ($w("#paymentSummaryPromoDiscount").id) $w("#paymentSummaryPromoDiscount").text = `$${paymentState.promoDiscount.toFixed(2)}`;
    if ($w("#paymentSummaryTips").id) $w("#paymentSummaryTips").text = `$${tipAmount.toFixed(2)}`;
    if ($w("#paymentSummaryCardFee").id) $w("#paymentSummaryCardFee").text = `$${cardFee.toFixed(2)}`;
    if ($w("#paymentSummaryTotalPrice").id) $w("#paymentSummaryTotalPrice").text = `$${paymentState.grandTotal.toFixed(2)}`;

    if ($w("#paymentPortalTipsRep").id) {
        $w("#paymentPortalTipsRep").forEachItem(($item, itemData) => {
            let dynamicTipForThisBox = discountedTotal * Number(itemData.percent || 0);
            if ($item("#paymentPortalTipsTotal").id) $item("#paymentPortalTipsTotal").text = `$${dynamicTipForThisBox.toFixed(2)}`;
        });
    }

    validateCheckoutState($w);
    syncPaymentIframe($w);
}

function validateCheckoutState($w) {
    let hasJob = paymentState.selectedJobs.size > 0;
    let hasTip = paymentState.tipType !== null; 
    let hasPaymentMethod = paymentState.paymentMethod !== null;
    
    let isValid = hasJob && hasTip && hasPaymentMethod;

    let btnLabel = "Complete Payment";
    if (!hasJob) btnLabel = "Select a Job";
    else if (!hasTip) btnLabel = "Select a Tip Amount";
    else if (!hasPaymentMethod) btnLabel = "Select Payment Method";

    applyIframeLayoutRules($w);

    let currentMethod = paymentState.paymentMethod;
    let isRedirectMethod = currentMethod === "cashapp" || currentMethod === "affirm";
    let isWalletMethod = currentMethod === "apple_pay" || currentMethod === "google_pay" || currentMethod === "wallet";

    if (isRedirectMethod || isWalletMethod) {
        if ($w("#paymentHtmlButtonContainer01").id) $w("#paymentHtmlButtonContainer01").collapse();
        if ($w("#paymentDesktopSubmitContainer01").id) $w("#paymentDesktopSubmitContainer01").collapse();
        if ($w("#desktopSubmit01").id) $w("#desktopSubmit01").collapse();
        if ($w("#paymentDesktopSubmitImage01").id) $w("#paymentDesktopSubmitImage01").collapse();
    } else {
        if ($w("#paymentHtmlButtonContainer01").id) $w("#paymentHtmlButtonContainer01").expand();
        if ($w("#paymentDesktopSubmitContainer01").id) $w("#paymentDesktopSubmitContainer01").expand();
    }

    const allDesktopStates = [
        "01", "02", "03", "04", "05", "06", "07",
        "Braintree01", "Braintree02", "Braintree03", "Braintree04", "Braintree05"
    ];
    
    allDesktopStates.forEach(suffix => {
        let btnId = `#desktopSubmit${suffix}`;
        if ($w(btnId).id) {
            if (isValid) { $w(btnId).enable(); $w(btnId).label = "Complete Payment"; } 
            else { $w(btnId).disable(); $w(btnId).label = btnLabel; }
        }
    });

    if ($w("#paymentMethodCardButton").id) {
        let hasSavedCardSelected = paymentState.paymentMethod === "card" && paymentState.selectedSavedCardId !== null;
        
        if (isValid && hasSavedCardSelected) {
            $w("#paymentMethodCardButton").enable();
        } else {
            $w("#paymentMethodCardButton").disable();
        }
    }
}

// ==========================================
// 🚦 CENTRALIZED UI TOGGLER
// ==========================================
function refreshPaymentMethodUI($w) {
    let isDesktop = wixWindowFrontend.formFactor === "Desktop" || wixWindowFrontend.formFactor === "Tablet";
    let isCardSelected = paymentState.paymentMethod === "card";
    
    let cardCmsData = cmsPaymentMethods.find(item => item.stripeCode === "card") || {};
    let onImg = cardCmsData.selected || CHECK_IMG_ON;
    let offImg = cardCmsData.unselected || CHECK_IMG_OFF;

    if ($w("#paymentMethodRep").id) {
        $w("#paymentMethodRep").forEachItem(($i, iData) => {
            let isSelected = (paymentState.paymentMethod === iData.stripeCode);

            if ($i("#paymentMethodRepBox").id) $i("#paymentMethodRepBox").style.borderColor = isSelected ? BORDER_SELECTED : BORDER_DEFAULT;
            if ($i("#paymentMethodRepPayCheckBox").id) $i("#paymentMethodRepPayCheckBox").src = isSelected ? CHECK_IMG_ON : CHECK_IMG_OFF;
            
            if ($i("#paymentMethodRepSubmitBox").id) $i("#paymentMethodRepSubmitBox").collapse();
            if ($i("#paymentMethodRepDetailsBox").id) $i("#paymentMethodRepDetailsBox").collapse();
            if ($i("#paymentMethodGiftBox").id) $i("#paymentMethodGiftBox").collapse();
        });
    }

    if ($w("#paymentMethodCardBox").id) {
        logger.info(`🔎 Evaluating Card Box UI... isCardSelected = ${isCardSelected}`);
        
        $w("#paymentMethodCardBox").style.borderColor = isCardSelected ? BORDER_SELECTED : BORDER_DEFAULT;
        
        if ($w("#paymentMethodCardCheckBox").id) {
            $w("#paymentMethodCardCheckBox").src = isCardSelected ? onImg : offImg;
        }

        if (isCardSelected) {
            logger.info("🟢 Card IS selected. Attempting to expand inner elements...");

            const logState = (id) => {
                if ($w(id).id) {
                    logger.info(`   -> [${id}] collapsed=${$w(id).collapsed}, hidden=${$w(id).hidden}`);
                }
            };

            const expandAndLog = (id) => {
                if ($w(id).id) {
                    $w(id).expand();
                    $w(id).show("fade", { duration: 200 }).catch(() => {});
                    logger.info(`   -> [${id}] expanded! collapsed=${$w(id).collapsed}, hidden=${$w(id).hidden}`);
                }
            };

            logState("#paymentMethodCardAddNew");
            expandAndLog("#paymentMethodCardAddNew");
            
            logState("#paymentMethodCardEdit");
            expandAndLog("#paymentMethodCardEdit");

            logState("#paymentMethodCardRep");
            expandAndLog("#paymentMethodCardRep");

            logState("#paymentMethodCardButtonBox");
            expandAndLog("#paymentMethodCardButtonBox");
            
        } else {
            logger.info("🔴 Card NOT selected. Collapsing inner elements...");
            if ($w("#paymentMethodCardRep").id) $w("#paymentMethodCardRep").collapse();
            if ($w("#paymentMethodCardAddNew").id) $w("#paymentMethodCardAddNew").collapse();
            if ($w("#paymentMethodCardEdit").id) $w("#paymentMethodCardEdit").collapse();
            if ($w("#paymentMethodCardButtonBox").id) $w("#paymentMethodCardButtonBox").collapse();
        }
    } else {
        logger.error("🚨 #paymentMethodCardBox was NOT found in the DOM!");
    }

    // 👉 Responsive Venmo Details Logic
    let venmoCmsItem = cmsPaymentMethods.find(item => item.stripeCode === "venmo" || (item.title && item.title.toLowerCase() === "venmo"));
    
    if (venmoCmsItem) {
        if ($w("#venmoDetailsText").id) {
            $w("#venmoDetailsText").text = isDesktop ? (venmoCmsItem.detailsTextDesktop || "") : (venmoCmsItem.detailsTextMobile || "");
        }

        if ($w("#venmoBreakpointImage").id) {
            let targetImage = isDesktop ? venmoCmsItem.desktop : venmoCmsItem.mobile;
            if (targetImage) {
                $w("#venmoBreakpointImage").src = targetImage;
            }
        }
    }

    // 👉 Responsive Wallet Details Logic (Apple Pay / Google Pay)
    let currentCmsItem = cmsPaymentMethods.find(item => item.stripeCode === paymentState.paymentMethod);
    
    if (currentCmsItem && (paymentState.paymentMethod === "google_pay" || paymentState.paymentMethod === "apple_pay" || paymentState.paymentMethod === "wallet")) {
        if ($w("#walletTitle").id && currentCmsItem.detailsTitle) {
            $w("#walletTitle").text = currentCmsItem.detailsTitle;
        }

        if ($w("#walletText").id) {
            $w("#walletText").text = isDesktop ? (currentCmsItem.detailsTextDesktop || "") : (currentCmsItem.detailsTextMobile || "");
        }

        if ($w("#walletBreakpointImage").id) {
            let targetImg = isDesktop ? currentCmsItem.desktop : currentCmsItem.mobile;
            if (targetImg) {
                $w("#walletBreakpointImage").src = targetImg;
            }
        }

        if ($w("#walletLogoImage").id && currentCmsItem.imageSquare) {
            $w("#walletLogoImage").src = currentCmsItem.imageSquare;
        }
    }
}

// ==========================================
// 💳 SAVED CREDIT CARDS UI ENGINE
// ==========================================
function initCreditCardVisuals($w) {
    logger.info("🏗️ Building Credit Card UI... Attaching events instantly!");

    let cardCmsData = cmsPaymentMethods.find(item => item.stripeCode === "card");
    
    if (!cardCmsData) {
        logger.warn("🚨 'card' item is inactive or missing in CMS! Hiding the Credit Card UI.");
        if ($w("#paymentMethodCardBox").id) $w("#paymentMethodCardBox").collapse();
        if ($w("#paymentMethodCardIsActive").id) $w("#paymentMethodCardIsActive").collapse(); 
        return; 
    }

    if ($w("#paymentMethodCardImage").id && cardCmsData.image) {
        $w("#paymentMethodCardImage").src = cardCmsData.image;
    }

    if ($w("#paymentMethodCardBox").id) $w("#paymentMethodCardBox").expand();
    if ($w("#paymentMethodCardIsActive").id) $w("#paymentMethodCardIsActive").expand();

    let onImg = cardCmsData.selected || CHECK_IMG_ON;
    let offImg = cardCmsData.unselected || CHECK_IMG_OFF;

    if ($w("#paymentMethodCardClickBox").id) {
        logger.info("🔗 Attaching onClick event to #paymentMethodCardClickBox");
        
        $w("#paymentMethodCardClickBox").onClick(() => {
            logger.info("🚨 💳 CREDIT/DEBIT CARD BOX CLICKED! EVENT FIRED.");
            
            if (paymentState.paymentMethod === "card") {
                logger.info("💳 Toggling OFF Credit Card Payment Method");
                paymentState.paymentMethod = null;
                paymentState.selectedSavedCardId = null;
            } else {
                let hasJob = paymentState.selectedJobs.size > 0;
                let hasTip = paymentState.tipType !== null;
                
                logger.info(`🔒 Lock Check -> hasJob: ${hasJob} | hasTip: ${hasTip}`);

                if (!hasJob || !hasTip) {
                    logger.warn(`🚫 Click blocked: Prerequisites not met. Triggering error message.`);
                    let errorMessage = (!hasJob && !hasTip) ? "Please select a detail and tip amount first." :
                                       (!hasJob) ? "Please select a detailing package first." : 
                                       "Please select a tip amount first.";
                    
                    showErrorMessage(errorMessage);
                    return; 
                }

                logger.info(`✅ New Payment Method applied: card`);
                paymentState.paymentMethod = "card";

                if (paymentState.savedCards.length > 0 && !paymentState.selectedSavedCardId) {
                    let primaryCard = paymentState.savedCards.find(c => c.isPrimary) || paymentState.savedCards[0];
                    paymentState.selectedSavedCardId = primaryCard._id;
                    logger.info(`⭐ Auto-selecting primary card ID: ${primaryCard._id}`);
                    updateSavedCardSubmitButton($w, primaryCard, cardCmsData);
                }

                if (paymentState.savedCards.length === 0) {
                    logger.info("💳 No saved cards found. Opening new card prompt.");
                    triggerAddNewCardFlow($w, cardCmsData);
                }
            }

            refreshPaymentMethodUI($w);
            calculateTotals($w);
        });
    }

    // 2. The Nested Repeater
    if ($w("#paymentMethodCardRep").id) {
        $w("#paymentMethodCardRep").onItemReady(($item, itemData) => {
            let brandKey = (itemData.brand || "").toLowerCase();
            if ($item("#paymentMethodCardRepClickBoxNumber").id) $item("#paymentMethodCardRepClickBoxNumber").text = `•••• •••• •••• ${itemData.last4}`;
            
            let mo = String(itemData.expMonth).padStart(2, '0');
            let yr = String(itemData.expYear).slice(-2);
            
            if ($item("#paymentMethodCardRepClickBoxExp").id) {
                let currentDate = new Date();
                let currentYear = currentDate.getFullYear();
                let currentMonth = currentDate.getMonth() + 1;
                
                let isExpired = (itemData.expYear < currentYear) || (itemData.expYear === currentYear && itemData.expMonth < currentMonth);
                let expText = `Exp. ${mo}/${yr}`;
                
                if (isExpired) {
                    $item("#paymentMethodCardRepClickBoxExp").html = `<span style="color: #DF3131;">${expText} (Expired)</span>`;
                } else {
                    $item("#paymentMethodCardRepClickBoxExp").text = expText;
                }
            }
            
            if ($item("#paymentMethodCardRepClickBoxImage").id) {
                $item("#paymentMethodCardRepClickBoxImage").src = cardCmsData[brandKey] || cardCmsData.image;
            }

            if ($item("#paymentMethodCardRepClickBox").id) {
                $item("#paymentMethodCardRepClickBox").onClick(() => {
                    logger.info(`💳 Nested Card Rep Clicked: ${itemData._id}`);
                    paymentState.selectedSavedCardId = itemData._id;
                    $w("#paymentMethodCardRep").forEachItem(($i, iData) => {
                        let isSelected = iData._id === paymentState.selectedSavedCardId;
                        if ($i("#paymentMethodCardRepClickBoxCheck").id) {
                            $i("#paymentMethodCardRepClickBoxCheck").src = isSelected ? onImg : offImg;
                        }
                    });
                    updateSavedCardSubmitButton($w, itemData, cardCmsData);
                    calculateTotals($w);
                });
            }

            let isSelected = itemData._id === paymentState.selectedSavedCardId;
            if ($item("#paymentMethodCardRepClickBoxCheck").id) {
                $item("#paymentMethodCardRepClickBoxCheck").src = isSelected ? onImg : offImg;
            }
        });
    }

    if ($w("#paymentMethodCardAddNew").id) {
        $w("#paymentMethodCardAddNew").onClick(() => {
            logger.info("➕ Add New Card Clicked");
            triggerAddNewCardFlow($w, cardCmsData);
        });
    }

    if ($w("#paymentMethodCardEdit").id) {
        $w("#paymentMethodCardEdit").onClick(() => {
            logger.info("✏️ Edit Cards Clicked -> Routing to Profile");
            smartGoTo("paymentMethodsProfileState");
        });
    }

    if ($w("#paymentMethodCardButton").id) {
        $w("#paymentMethodCardButton").onClick(async () => {
            let cardId = paymentState.selectedSavedCardId;
            logger.info(`🔥 Submitting charge for Saved Card ID: ${cardId}`);
            
            $w("#paymentMethodCardButton").disable();

            try {
                let stripeCustomerId = "cus_VAwfRWW079gAHd"; // 👈 Your real test cus_ ID

                const response = await chargeSavedCard(paymentState.grandTotal, stripeCustomerId, cardId);
                
                if (response.status === "succeeded") {
                    logger.info("🎉 Saved Card Payment Successful!");
                    let recentlyPaidJobs = await markSelectedJobsAsPaid();
                    dispatchReceiptAfterPayment(recentlyPaidJobs);
                    resetPaymentPortal();
                    showSuccessMessage("Thank you for your payment!");
                } else if (response.status === "requires_action") {
                    logger.warn("⚠️ 3D Secure / SCA Required. Redirecting to Stripe.js authentication...");
                }
            } catch (error) {
                logger.error("Charge failed", error.message);
                showErrorMessage(error.message || "Payment failed. Please try again.");
            } finally {
                $w("#paymentMethodCardButton").enable();
            }
        });
    }
}

function updateSavedCardSubmitButton($w, cardData, cardCmsData) {
    let brandKey = (cardData.brand || "").toLowerCase();
    let btnLogoField = `${brandKey}Button`; 
    
    let targetImage = cardCmsData[btnLogoField] || cardCmsData.imageButton;
    
    if ($w("#paymentMethodCardButtonImage").id && targetImage) { 
        $w("#paymentMethodCardButtonImage").src = targetImage; 
    } else {
        logger.warn(`No image found in CMS for ${btnLogoField} or imageButton`);
    }
}

function triggerAddNewCardFlow($w, cardCmsData) {
    logger.info("➕ Initiating Add New Card Flow...");
    
    paymentState.selectedSavedCardId = null;
    calculateTotals($w);

    let targetState = cardCmsData.htmlDesktop; 
    
    if (targetState) {
        logger.info(`🔄 Flushing Prompts MSB for New Card...`);
        if ($w("#msbPrompts").id) {
            $w("#msbPrompts").changeState("paymentStateBlank").then(() => {
                setTimeout(() => {
                    smartGoTo(targetState);
                }, 50);
            });
        } else {
            smartGoTo(targetState); 
        }
    }
}

// ==========================================
// 3. PAYMENT METHOD REPEATER ENGINE
// ==========================================
function initPaymentMethodVisuals($w) {
    if ($w("#paymentMethodRep").id) {
        $w("#paymentMethodRep").onItemReady(($item, itemData) => {
            if (itemData.stripeCode === "card") return;

            if ($item("#paymentMethodRepPayTitle").id) $item("#paymentMethodRepPayTitle").text = itemData.title;
            if ($item("#paymentMethodRepPayImage").id && itemData.image) $item("#paymentMethodRepPayImage").src = itemData.image;
            if ($item("#paymentMethodRepDetailsLogo").id && itemData.imageSquare) $item("#paymentMethodRepDetailsLogo").src = itemData.imageSquare;
            if ($item("#paymentMethodRepDetailsTitle").id && itemData.detailsTitle) $item("#paymentMethodRepDetailsTitle").text = itemData.detailsTitle;
            if ($item("#paymentMethodRepSubmitImage").id && itemData.imageButton) $item("#paymentMethodRepSubmitImage").src = itemData.imageButton;
            if ($item("#paymentMethodGiftImage").id && itemData.imageSquare) $item("#paymentMethodGiftImage").src = itemData.imageSquare;

            if ($item("#paymentMethodRepDetailsLearn").id) {
                itemData.isLearn ? $item("#paymentMethodRepDetailsLearn").expand() : $item("#paymentMethodRepDetailsLearn").collapse();
            }

            if ($item("#paymentMethodRepDetailsImage").id) {
                let formFactor = wixWindowFrontend.formFactor;
                if (formFactor !== "Desktop" && itemData.mobileImage) $item("#paymentMethodRepDetailsImage").src = itemData.mobileImage;
                else if (itemData.desktopImage) $item("#paymentMethodRepDetailsImage").src = itemData.desktopImage;
            }

            const selectThisMethod = () => {
                if (paymentState.paymentMethod === itemData.stripeCode) {
                    logger.info(`👇 Deselecting Payment Method: ${itemData.title}`);
                    paymentState.paymentMethod = null;
                } else {
                    logger.info(`👇 Clicked Payment Method: ${itemData.title}`);
                    
                    let hasJob = paymentState.selectedJobs.size > 0;
                    let hasTip = paymentState.tipType !== null;
                    
                    logger.info(`🔒 Lock Check -> hasJob: ${hasJob} | hasTip: ${hasTip}`);

                    if (!hasJob || !hasTip) {
                        logger.warn(`🚫 Click blocked: Prerequisites not met. Triggering error message.`);
                        let errorMessage = (!hasJob && !hasTip) ? "Please select a detail and tip amount first." :
                                           (!hasJob) ? "Please select a detailing package first." : 
                                           "Please select a tip amount first.";
                        
                        showErrorMessage(errorMessage);
                        return;
                    }

                    paymentState.paymentMethod = itemData.stripeCode;
                    
                    let targetState = itemData.htmlDesktop; 
                    
                    if (targetState) {
                        logger.info(`🔄 Flushing Prompts MSB for Payment Method...`);
                        if ($w("#msbPrompts").id) {
                            $w("#msbPrompts").changeState("paymentStateBlank").then(() => {
                                setTimeout(() => {
                                    smartGoTo(targetState);
                                }, 50);
                            });
                        } else {
                            smartGoTo(targetState); 
                        }
                    }
                }
                refreshPaymentMethodUI($w);
                calculateTotals($w); 
            };

            if ($item("#paymentMethodRepItemOverlay").id) {
                $item("#paymentMethodRepItemOverlay").onClick(() => selectThisMethod());
            }

            if ($item("#paymentMethodRepSubmitButton").id) {
                $item("#paymentMethodRepSubmitButton").onClick(() => { 
                    $item("#paymentMethodRepSubmitButton").disable();
                    $item("#paymentMethodRepSubmitButton").label = "Processing...";

                    let isDesktop = wixWindowFrontend.formFactor === "Desktop" || wixWindowFrontend.formFactor === "Tablet";
                    
                    let isWallet = (itemData.stripeCode === "apple_pay" || itemData.stripeCode === "google_pay" || itemData.stripeCode === "wallet");
                    if (itemData.provider === "braintree" || isWallet) {
                        isDesktop = true;
                    }

                    let targetState = (isDesktop ? itemData.htmlDesktop : itemData.htmlState) || "";
                    
                    if (targetState && targetState !== "paymentStateBlank" && targetState !== "paymentStateBlankMobile") {
                        let stateNumMatch = targetState.match(/\d+/);
                        let suffix = stateNumMatch ? stateNumMatch[0] : "Universal";
                        
                        let targetHtmlId;
                        if (itemData.provider === "braintree") {
                            targetHtmlId = `#braintreeHtml${suffix}`;
                        } else if (!isWallet) {
                            if (suffix === "Universal") {
                                targetHtmlId = `#stripeUniversalHtmlMobile`;
                            } else {
                                targetHtmlId = `#paymentMethodHTML${suffix}`;
                            }
                        }
                            
                        if (targetHtmlId && $w(targetHtmlId).id) $w(targetHtmlId).postMessage({ type: 'submitPayment' });
                    }
                });
            }
        });
    }
}

// ==========================================
// 1. JOBS REPEATER VISUALS
// ==========================================
function initJobsVisuals($w) {
    let preselectedId = session.getItem("preselectedPaymentJobId");
    session.removeItem("preselectedPaymentJobId");

    if ($w("#paymentPortalJobsRep").id) {
        $w("#paymentPortalJobsRep").onItemReady(($item, itemData) => {
            if ($item("#paymentPortalJobsRepTitle").id) $item("#paymentPortalJobsRepTitle").text = itemData.packageTitle || "Detailing Package";
            if ($item("#paymentPortalJobsRepPrice").id) $item("#paymentPortalJobsRepPrice").text = `$${Number(itemData.totalPrice || 0).toFixed(2)}`;
            
            let vYear = itemData.vehicleYear || '';
            let vMake = itemData.vehicleMake || '';
            let vModel = itemData.vehicleModel || '';
            if ($item("#paymentPortalJobsRepVehicle").id) $item("#paymentPortalJobsRepVehicle").text = `${vYear} ${vMake} ${vModel}`.trim();
            if ($item("#paymentPortalJobsRepCategory").id) $item("#paymentPortalJobsRepCategory").text = itemData.vehicleCategory || "Auto";
            
            if ($item("#paymentPortalJobsRepDate").id && itemData.serviceDate) {
                $item("#paymentPortalJobsRepDate").text = new Date(itemData.serviceDate).toLocaleDateString();
            }

            let isSelected = paymentState.selectedJobs.has(itemData._id);
            
            const toggleJobVisuals = () => {
                isSelected = !isSelected; 
                let box = $item("#paymentPortalJobsRepBox"); 
                if (box.id) box.style.borderColor = isSelected ? BORDER_SELECTED : BORDER_DEFAULT;
                if ($item("#paymentPortalJobsRepCheckBox").id) $item("#paymentPortalJobsRepCheckBox").src = isSelected ? CHECK_IMG_ON : CHECK_IMG_OFF;
                
                if (isSelected) paymentState.selectedJobs.set(itemData._id, itemData);
                else paymentState.selectedJobs.delete(itemData._id);
                calculateTotals($w); 
            };

            if (itemData._id === preselectedId && !isSelected) {
                toggleJobVisuals();
            }

            if ($item("#jobClickOverlay").id) $item("#jobClickOverlay").onClick(() => toggleJobVisuals());
        });
    }
}

// ==========================================
// 2. TIPS VISUALS
// ==========================================
function initTipsVisuals($w) {
    const resetAllTips = () => {
        if ($w("#paymentPortalTipsRep").id) {
            $w("#paymentPortalTipsRep").forEachItem(($item) => {
                if ($item("#paymentPortalTipsBox").id) $item("#paymentPortalTipsBox").style.borderColor = BORDER_DEFAULT;
            });
        }
        if ($w("#paymentPortalTipsCustomBox").id) $w("#paymentPortalTipsCustomBox").style.borderColor = BORDER_DEFAULT;
        if ($w("#paymentPortalNOTipsBox").id) $w("#paymentPortalNOTipsBox").style.borderColor = BORDER_DEFAULT;
        if ($w("#paymentPortalTipsCustom").id) $w("#paymentPortalTipsCustom").value = "";
    };

    if ($w("#paymentPortalTipsRep").id) {
        $w("#paymentPortalTipsRep").onItemReady(($item, itemData) => {
            if ($item("#paymentPortalTipsPercent").id) $item("#paymentPortalTipsPercent").text = itemData.title; 
            const processTipClick = () => {
                resetAllTips();
                if ($item("#paymentPortalTipsBox").id) $item("#paymentPortalTipsBox").style.borderColor = BORDER_SELECTED;
                paymentState.tipType = "percent";
                paymentState.tipValue = Number(itemData.percent); 
                
                session.setItem("savedTipType", "percent");
                session.setItem("savedTipValue", String(itemData.percent));

                calculateTotals($w);
            };
            
            if ($item("#tipClickOverlay").id) $item("#tipClickOverlay").onClick(() => processTipClick());
        });
    }

    if ($w("#paymentPortalNOTipsButton").id) {
        $w("#paymentPortalNOTipsButton").onClick(() => { 
            resetAllTips();
            
            if ($w("#paymentPortalNOTipsBox").id) {
                $w("#paymentPortalNOTipsBox").style.borderColor = BORDER_SELECTED;
            }
            
            paymentState.tipType = "none";
            paymentState.tipValue = 0;
            
            session.setItem("savedTipType", "none");
            session.setItem("savedTipValue", "0");

            calculateTotals($w);
        });
    }
    
    if ($w("#paymentPortalTipsCustomBox").id && $w("#paymentPortalTipsCustom").id) {
        let customInput = $w("#paymentPortalTipsCustom");
        let customBox = $w("#paymentPortalTipsCustomBox");

        const activateCustomTip = () => { resetAllTips(); customBox.style.borderColor = BORDER_SELECTED; };
        customBox.onClick(() => { activateCustomTip(); customInput.focus(); }); 
        customInput.onFocus(() => activateCustomTip());

        customInput.onInput(() => {
            let sanitizedValue = customInput.value.replace(/[^0-9.]/g, '');
            let parts = sanitizedValue.split('.');
            if (parts.length > 2) sanitizedValue = parts[0] + '.' + parts.slice(1).join('');
            if (customInput.value !== sanitizedValue) customInput.value = sanitizedValue;
            if (sanitizedValue) {
                paymentState.tipType = "custom";
                paymentState.tipValue = Number(sanitizedValue);
            } else {
                paymentState.tipType = "none";
                paymentState.tipValue = 0;
            }
            calculateTotals($w);
        });

        const formatCustomTip = () => {
            let val = customInput.value.replace(/[^0-9.]/g, ''); 
            if (val && Number(val) > 0) {
                let formattedNum = Number(val).toFixed(2);
                customInput.value = `$${formattedNum}`; 
                paymentState.tipType = "custom";
                paymentState.tipValue = Number(formattedNum);
                
                session.setItem("savedTipType", "custom");
                session.setItem("savedTipValue", formattedNum);
                
            } else {
                customInput.value = ""; 
                paymentState.tipType = "none";
                paymentState.tipValue = 0;
                
                session.setItem("savedTipType", "none");
                session.setItem("savedTipValue", "0");
            }
            calculateTotals($w);
        };
        customInput.onBlur(() => formatCustomTip());
        customInput.onKeyPress((event) => { if (event.key === "Enter") customInput.blur(); });
    }
}

export async function loadPaymentMethodsCMS($w) {
    try {
        let res = await wixData.query("paymentMethods")
            .eq("category", "Payment_Type")
            .eq("isActive", true)
            .ascending("sort")
            .find();
        cmsPaymentMethods = res.items || [];

        let standardMethods = cmsPaymentMethods.filter(item => item.stripeCode !== "card");

        if ($w("#paymentMethodRep").id) {
            $w("#paymentMethodRep").data = standardMethods;
        }

        cmsPaymentMethods.forEach(item => {
            if (item.htmlDesktop && item.imageButton) {
                let stateNumMatch = item.htmlDesktop.match(/\d+/);
                if (stateNumMatch) {
                    let suffix = item.provider === "braintree" ? `Braintree${stateNumMatch[0]}` : stateNumMatch[0];
                    let svgId = `#paymentDesktopSubmitImage${suffix}`;
                    if ($w(svgId).id) {
                        $w(svgId).src = item.imageButton;
                    }
                }
            }
        });

        initCreditCardVisuals($w);

    } catch (err) {
        logger.error("Failed to load payment methods", err);
    }
}

export async function loadSavedCardsData($w) {
    paymentState.savedCards = [
        { 
            _id: "pm_1UAamg4rR9vofU6ALZtJURYH",
            brand: "visa", 
            last4: "4242", 
            expMonth: 12, 
            expYear: 2030,
            isPrimary: true 
        }
    ];
    if ($w("#paymentMethodCardRep").id) $w("#paymentMethodCardRep").data = paymentState.savedCards;
}

export async function loadUnpaidPaymentJobs($w) {
    let userId = await getActiveUserId(); 
    if (!userId || userId.startsWith("guest_")) return;
    
    try {
        let queryUnpaid = wixData.query("scheduledJobs").eq("userId", userId).eq("paymentStatus", "Un-Paid").ne("status", "Cancelled");
        let queryEmpty = wixData.query("scheduledJobs").eq("userId", userId).isEmpty("paymentStatus").ne("status", "Cancelled");
        let res = await queryUnpaid.or(queryEmpty).ascending("serviceDate").find();
        
        let jobs = res.items || [];
        
        if ($w("#paymentPortalJobsRep").id) {
            $w("#paymentPortalJobsRep").data = jobs;
        }

        if (jobs.length > 0) {
            if ($w("#paymentPortalMasterBox").id) $w("#paymentPortalMasterBox").expand();
            if ($w("#paymentPortalUnPaidMessageBox").id) $w("#paymentPortalUnPaidMessageBox").collapse();
        } else {
            if ($w("#paymentPortalMasterBox").id) $w("#paymentPortalMasterBox").collapse();
            if ($w("#paymentPortalUnPaidMessageBox").id) $w("#paymentPortalUnPaidMessageBox").expand();
        }

    } catch (err) { 
        logger.error("Failed to load unpaid jobs", err); 
    }
}

export async function loadTipsCMS($w) {
    try {
        let res = await wixData.query("paymentMethods").eq("category", "Tips").ascending("sort").find();
        if ($w("#paymentPortalTipsRep").id) {
            $w("#paymentPortalTipsRep").data = res.items || [];
            calculateTotals($w); 
        }
    } catch (err) { logger.error("Failed to load tips", err); }
}

export async function loadStripeCheckout(cartTotal, methodName, htmlElementId, desktopNum = null) {
    const htmlElement = $w(htmlElementId); 
    if (!htmlElement.id) return logger.error(`Missing HTML element: ${htmlElementId}`);

    try {
        logger.info(`Requesting PaymentIntent for ${methodName}...`);
        const { clientSecret, publishableKey } = await createPaymentIntent(cartTotal, methodName);
        
        htmlElement.postMessage({ type: 'initialize', clientSecret: clientSecret, publishableKey: publishableKey, paymentMethod: methodName });

        htmlElement.onMessage(async (event) => {
            if (event.data.type === 'log') {
                logger.info(`🪟 [HTML BOX]: ${event.data.message}`, event.data.data);
            }

            if (event.data.type === 'ready') {
                logger.info(`✅ Iframe ${htmlElementId} is ready.`);
                
                if (desktopNum) {
                    stopTextLoadingAnimation();
                    let loadingId = `#paymentLoading${desktopNum}`;
                    let containerIdOld = `#paymentDesktopSubmitContainer${desktopNum}`;
                    let containerIdNew = `#paymentHtmlButtonContainer${desktopNum}`;
                    let btnId = `#desktopSubmit${desktopNum}`;
                    let svgId = `#paymentDesktopSubmitImage${desktopNum}`;

                    if ($w(loadingId).id) $w(loadingId).collapse();
                    
                    let currentMethod = paymentState.paymentMethod;
                    let isRedirectMethod = currentMethod === "cashapp" || currentMethod === "affirm";
                    let isWalletMethod = currentMethod === "apple_pay" || currentMethod === "google_pay" || currentMethod === "wallet";

                    applyIframeLayoutRules($w);

                    if (!isRedirectMethod && !isWalletMethod) {
                        if ($w(containerIdOld).id) $w(containerIdOld).expand();
                        if ($w(containerIdNew).id) $w(containerIdNew).expand();
                        if ($w(btnId).id) $w(btnId).expand();
                        
                        if ($w(svgId).id) {
                            $w(svgId).expand().then(() => {
                                $w(svgId).show("fade", { duration: 300 });
                            });
                        }
                    }
                }
            }
            
            if (event.data.type === 'success') {
                logger.info("🎉 Stripe Iframe Payment Successful!");

                let recentlyPaidJobs = await markSelectedJobsAsPaid();
                dispatchReceiptAfterPayment(recentlyPaidJobs);
                
                resetPaymentPortal(); 
                
                if ($w("#msbPrompts").id) {
                    $w("#msbPrompts").hide();
                    $w("#msbPrompts").collapse();
                }
                
                showSuccessMessage("Thank you for your payment!");
            }
            
            if (event.data.type === 'error') {
                logger.error(`Stripe Error: ${event.data.error}`);
                validateCheckoutState($w); 
                stopTextLoadingAnimation(); 
                
                if (desktopNum) {
                    let btnId = `#desktopSubmit${desktopNum}`;
                    if ($w(btnId).id) {
                        $w(btnId).enable();
                        $w(btnId).label = "Complete Payment";
                    }
                }
                
                if ($w("#paymentErrorText").id) {
                    $w("#paymentErrorText").text = event.data.error;
                    $w("#paymentErrorText").expand();
                    
                    setTimeout(() => {
                        $w("#paymentErrorText").collapse();
                    }, 6000);
                }
            }

            if (event.data.type === 'cardBrandDetect') {
                let brand = event.data.brand; 
                logger.info(`💳 Card brand detected: ${brand}`);

                let cardCmsItem = cmsPaymentMethods.find(item => item.stripeCode === "card");
                
                if (cardCmsItem) {
                    const brandImages = {
                        "visa": cardCmsItem.visaButton, 
                        "mastercard": cardCmsItem.mastercardButton,
                        "amex": cardCmsItem.AmEx, 
                        "discover": cardCmsItem.discoverButton,
                        "unknown": cardCmsItem.defaultButton 
                    };

                    let targetImage = brandImages[brand];

                    if (desktopNum && targetImage) {
                        let svgId = `#paymentDesktopSubmitImage${desktopNum}`;
                        if ($w(svgId).id) {
                            $w(svgId).src = targetImage;
                        }
                    }
                } else {
                    logger.warn("🚨 Could not find the 'card' item in cmsPaymentMethods to pull brand logos.");
                }
            }
        });

    } catch (err) {
        logger.error("Stripe Initialization Failed:", err);
        stopTextLoadingAnimation();
    }
}

export async function loadBraintreeCheckout(cartTotal, htmlElementId, desktopNum = null) {
    const htmlElement = $w(htmlElementId); 
    if (!htmlElement.id) return logger.error(`Missing HTML element: ${htmlElementId}`);

    try {
        logger.info(`Requesting Braintree Client Token...`);
        const tokenRes = await generateClientToken();
        
        logger.info(`✅ Backend Responded. Success: ${tokenRes.success}`);
        
        if (!tokenRes.success) throw new Error(tokenRes.error);

        logger.info(`📨 Passing Token to Iframe...`);
        htmlElement.postMessage({ type: 'initialize', clientToken: tokenRes.clientToken, amount: cartTotal });

        htmlElement.onMessage(async (event) => {
            if (event.data.type === 'log') {
                logger.info(`🪟 [HTML BOX]: ${event.data.message}`, event.data.data);
            }

            if (event.data.type === 'ready') {
                logger.info(`✅ Iframe ${htmlElementId} is ready.`);
                
                if (desktopNum) {
                    stopTextLoadingAnimation();
                    let loadingId = `#paymentLoading${desktopNum}`;
                    let containerId = `#paymentDesktopSubmitContainer${desktopNum}`;
                    let btnId = `#desktopSubmit${desktopNum}`;
                    let svgId = `#paymentDesktopSubmitImage${desktopNum}`;

                    if ($w(loadingId).id) $w(loadingId).collapse();
                    if ($w(containerId).id) $w(containerId).expand();
                    if ($w(btnId).id) $w(btnId).expand();
                    
                    if ($w(svgId).id) {
                        $w(svgId).expand().then(() => {
                            $w(svgId).show("fade", { duration: 300 });
                        });
                    }
                }
            }
            
            if (event.data.type === 'processNonce') {
                logger.info(`🔐 Nonce received. Processing final Braintree charge in the background...`);
                
                let submitBtnId = `#desktopSubmit${desktopNum}`;
                if (desktopNum && $w(submitBtnId).id) {
                    $w(submitBtnId).disable();
                    $w(submitBtnId).label = "Finalizing Payment...";
                }

                const chargeRes = await processBraintreePayment(event.data.nonce, cartTotal);
                
                if (chargeRes.success) {
                    logger.info(`🎉 Payment Success! Transaction ID: ${chargeRes.transactionId}`);

                    let recentlyPaidJobs = await markSelectedJobsAsPaid();
                    dispatchReceiptAfterPayment(recentlyPaidJobs);
                    
                    resetPaymentPortal();
                    
                    if ($w("#msbPrompts").id) {
                        $w("#msbPrompts").hide();
                        $w("#msbPrompts").collapse();
                    }

                    showSuccessMessage("Thank you for your payment!");
                    
                } else {
                    logger.error(`Braintree Charge Failed: ${chargeRes.error}`);
                    showErrorMessage(chargeRes.error || "Payment failed. Please try again.");
                    validateCheckoutState($w); 
                    
                    if (desktopNum && $w(submitBtnId).id) {
                        $w(submitBtnId).enable();
                        $w(submitBtnId).label = "Complete Payment";
                    }
                }
            }

            if (event.data.type === 'error') {
                logger.error(`Braintree UI Error: ${event.data.error}`);
                validateCheckoutState($w); 
                stopTextLoadingAnimation(); 
                
                let submitBtnId = `#desktopSubmit${desktopNum}`;
                if (desktopNum && $w(submitBtnId).id) {
                    $w(submitBtnId).enable();
                    $w(submitBtnId).label = "Complete Payment";
                }

                if ($w("#paymentErrorText").id) {
                    $w("#paymentErrorText").text = event.data.error;
                    $w("#paymentErrorText").expand();
                    
                    setTimeout(() => {
                        $w("#paymentErrorText").collapse();
                    }, 6000);
                }
            }
        });

    } catch (err) {
        logger.error("Braintree Initialization Failed:", err);
        stopTextLoadingAnimation();
    }
}

export async function loadStripeWallet(cartTotal, methodName, elementId) {
    const walletElement = $w(elementId);
    if (!walletElement.id) return logger.error(`Missing Wallet Element: ${elementId}`);

    let errorId = methodName === "apple_pay" ? "#applePayError" : "#googlePayError";
    let loadingId = methodName === "apple_pay" ? "#applePayLoading" : "#googlePayLoading";

    try {
        logger.info(`Requesting PaymentIntent for Digital Wallet (${methodName})...`);
        
        if ($w(errorId).id) {
            $w(errorId).hide();
            $w(errorId).collapse();
        }
        
        let backendMethod = methodName;
        if (methodName === 'apple_pay' || methodName === 'google_pay' || methodName === 'wallet') {
            backendMethod = 'card';
        }
        
        const { clientSecret, publishableKey } = await createPaymentIntent(cartTotal, backendMethod);
        
        logger.info(`✅ Backend returned keys! Sending to Custom Element...`);

        walletElement.setAttribute('request-time', Date.now().toString());
        walletElement.setAttribute('wallet-type', methodName);
        walletElement.setAttribute('publishable-key', publishableKey);
        walletElement.setAttribute('client-secret', clientSecret);

        walletElement.on('walletReady', () => {
            logger.info(`✅ Wallet Element is ready and mounted.`);
            stopTextLoadingAnimation();
            
            if ($w(loadingId).id) $w(loadingId).collapse();
        });

        walletElement.on('walletError', (event) => {
            logger.error(`Wallet Error: ${event.detail}`);
            stopTextLoadingAnimation();
            
            walletElement.setAttribute('client-secret', '');
            
            if ($w(loadingId).id) $w(loadingId).collapse();
            
            let failedMethod = paymentState.paymentMethod;
            paymentState.paymentMethod = null;
            refreshPaymentMethodUI($w);

            let friendlyError = "This digital wallet is not supported on your current device or browser.";
            if (failedMethod === "apple_pay") {
                friendlyError = "Apple Pay is only supported on Apple devices using the Safari browser.";
            } else if (failedMethod === "google_pay") {
                friendlyError = "Google Pay is not supported or not configured on this browser.";
            }

            if ($w(errorId).id) {
                $w(errorId).text = friendlyError;
                $w(errorId).expand().then(() => {
                    $w(errorId).show("fade", { duration: 150 });
                });
            }
        });

    } catch (err) {
        logger.error("Wallet Initialization Failed:", err);
        stopTextLoadingAnimation();
        
        walletElement.setAttribute('client-secret', '');
        
        if ($w(loadingId).id) $w(loadingId).collapse();
        
        if ($w(errorId).id) {
            $w(errorId).text = "An unexpected error occurred. Please try again.";
            $w(errorId).expand().then(() => {
                $w(errorId).show("fade", { duration: 150 });
            });
        }
    }
}