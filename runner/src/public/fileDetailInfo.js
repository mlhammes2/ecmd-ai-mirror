/**
 * ========================================================================
 * 🤖 AI CONTEXT & ARCHITECTURE NOTE
 * ========================================================================
 * FILE: public/fileDetailInfo.js
 * ========================================================================
 */

import wixData from 'wix-data';
import { session } from 'wix-storage';
import { deleteGoogleEvent, broadcastCalendarUpdate, updateOrRestoreDetailingJob } from 'backend/calendar-dispatcher.web';
import { loadPackageEditMode } from 'public/filePackageEdits'; 
import { registerRepeater, repaintSingleItem, smartSyncRepeater } from 'public/repeaterEngine';
import { selectJobInPortal } from 'public/filePaymentPortal.js'; 
import { startCartEditsFlow, syncCartEditsDependencies } from 'public/fileCartEdits.js';
import { APP_LOGS } from 'public/loggerConfig';
import { currentMember } from 'wix-members-frontend';
import { sendMasterTransactionalEmail } from 'backend/emailDispatchEngine.jsw';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

const DEBUG_MODE = APP_LOGS.MASTER_SWITCH && APP_LOGS.DETAIL_INFO;
const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [FILE_DETAIL_INFO]: ${msg}`, data) : console.log(`📌 [FILE_DETAIL_INFO]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [FILE_DETAIL_INFO]: ${msg}`, data) : console.warn(`📌 [FILE_DETAIL_INFO]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [FILE_DETAIL_INFO]: ${msg}`, data) : console.error(`📌 [FILE_DETAIL_INFO]: ${msg}`); }
};

let $w;
let hooks;

const STRINGS = {
    DEFAULTS: { PKG: "Detailing Package", VEHICLE: "Unknown Vehicle", CONTACT: "No Contact", LOCATION: "No Location" }
};

let profileJobs = [];
let selectedProfileJobId = null;
let globalActiveJobData = null;
let globalProcessJobClick = null;
let pendingCancelItem = null;

registerModuleState("fileDetailInfo", () => ({
    profileJobsCount: (profileJobs || []).length,
    selectedProfileJobId,
    activeProfileJobIdInSession: session.getItem("activeProfileJobId") || null,
    activeProfileJobIsUpcoming: session.getItem("activeProfileJobIsUpcoming") || null,
    pendingUpdateEmailInSession: session.getItem("pendingUpdateEmail") || null,
    pendingCancelJobId: pendingCancelItem ? pendingCancelItem._id : null,
    globalActiveJobSummary: globalActiveJobData ? {
        _id: globalActiveJobData._id,
        orderId: globalActiveJobData.orderId,
        packageTitle: globalActiveJobData.packageTitle,
        status: globalActiveJobData.status,
        paymentStatus: globalActiveJobData.paymentStatus,
        serviceDate: globalActiveJobData.serviceDate,
        scheduledTime: globalActiveJobData.scheduledTime,
        totalPrice: globalActiveJobData.totalPrice,
        vehicleInfo: globalActiveJobData.vehicleInfo
    } : null
}));

registerDomElements({
    repeaters: ["#upcomingRep", "#completedRep"]
});

export function initDetailInfoEngine(wixContext, providedHooks) {
    logger.info("Initializing Detail Info UI Engine...");
    $w = wixContext;
    hooks = providedHooks;

    initJobRepeaters();   
    initDetailActionButtons(); 
    initCancelOrderEngine();  
}

export function syncDetailJobs(jobsArray, wixContext = null) {
    if (wixContext && typeof wixContext === "function" && typeof $w !== "function") {
        $w = wixContext;
    }
    let optString = session.getItem("optimistic_jobs");
    if (optString) {
        try {
            let optJobs = JSON.parse(optString);
            let existingIds = jobsArray.map(j => j._id);
            let activeOptJobs = optJobs.filter(j => !existingIds.includes(j._id));
            
            if (activeOptJobs.length > 0) {
                jobsArray = [...activeOptJobs, ...jobsArray];
            } else {
                session.removeItem("optimistic_jobs");
            }
        } catch(e) {}
    }

    let uniqueJobsMap = new Map();
    jobsArray.forEach(job => {
        if (job && job._id) uniqueJobsMap.set(job._id, job);
    });
    profileJobs = Array.from(uniqueJobsMap.values());

    logger.info(`Syncing ${profileJobs.length} unique jobs to repeaters...`);
    
    let upcoming = profileJobs.filter(j => j.status !== "Completed" && j.status !== "Cancelled");
    let past = profileJobs.filter(j => j.status === "Completed" && j.status !== "Cancelled");

    upcoming.sort((a, b) => new Date(a.serviceDate).getTime() - new Date(b.serviceDate).getTime());
    past.sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());

    if (typeof $w !== "function") return;
    if ($w("#upcomingRep").id) smartSyncRepeater($w, "#upcomingRep", upcoming);
    if ($w("#completedRep").id) smartSyncRepeater($w, "#completedRep", past);

    const toggleTexts = (ids, hasData, msg) => {
        ids.forEach(id => {
            if (typeof $w === "function" && $w(id).id) {
                if (hasData) {
                    $w(id).hide();
                    $w(id).collapse(); 
                } else { 
                    $w(id).text = msg; 
                    $w(id).show(); 
                    $w(id).expand(); 
                }
            }
        });
    };

    toggleTexts(["#upcomingText", "#upcomingTextD", "#upcomingTextM"], upcoming.length > 0, "There are no upcoming details scheduled.");
    toggleTexts(["#completedText", "#completedTextD", "#completedTextM"], past.length > 0, "There are no completed details in your history.");
}

export function triggerSavedJobClick(savedJobId, savedIsUpcoming) {
    if (globalProcessJobClick) {
        let targetRep = savedIsUpcoming ? "#upcomingRep" : "#completedRep";
        globalProcessJobClick({ context: { itemId: savedJobId } }, targetRep);
    }
}

function initJobRepeaters() {
    const paintJobCard = ($item, itemData, isUpcoming) => {
        let base = isUpcoming ? "upcoming" : "completed";
        let prefix = `${base}Rep`; 

        if ($item(`#${prefix}Title`).type) $item(`#${prefix}Title`).text = itemData.packageTitle || STRINGS.DEFAULTS.PKG;
        if ($item(`#${prefix}Price`).type) $item(`#${prefix}Price`).text = `$${Number(itemData.totalPrice || 0).toFixed(2)}`;
        
        let addOnsCount = ((itemData.interiorAddOns || []).length) + ((itemData.exteriorAddOns || []).length);
        if ($item(`#${prefix}AddOns`).type) $item(`#${prefix}AddOns`).text = `Add-Ons (${addOnsCount})`;
        if ($item(`#${prefix}IsSubscription`).type) $item(`#${prefix}IsSubscription`).text = itemData.isSubscription ? "Subscription" : "Non-Subscription";
        
        if ($item(`#${base}Image`).type && itemData.packageImage) $item(`#${base}Image`).src = itemData.packageImage;
        
        let vYear = itemData.vehicleYear || "";
        let vMake = itemData.vehicleMake || "";
        let vModel = itemData.vehicleModel || "";
        let vColor = itemData.vehicleColor || "";
        let fullVehStr = `${vYear} ${vMake} ${vModel} ${vColor ? '- ' + vColor : ''}`.replace(/\s+/g, ' ').trim();
        
        if ($item(`#${prefix}Vehicle`).type) $item(`#${prefix}Vehicle`).text = fullVehStr || itemData.vehicleInfo || STRINGS.DEFAULTS.VEHICLE;
        
        let contactStr = `${itemData.firstName || ''} ${itemData.lastName || ''} - ${itemData.phone || ''}`.trim();
        if ($item(`#${prefix}Contact`).type) $item(`#${prefix}Contact`).text = contactStr || STRINGS.DEFAULTS.CONTACT;

        let locStr = `${itemData.address1 || ''}, ${itemData.city || ''} ${itemData.zip || ''}`.trim();
        if ($item(`#${prefix}Location`).type) $item(`#${prefix}Location`).text = locStr || STRINGS.DEFAULTS.LOCATION;

        if ($item(`#${prefix}CompletionStatus`).type) {
            $item(`#${prefix}CompletionStatus`).text = isUpcoming ? (itemData.wasRescheduled ? "Rescheduled" : "Upcoming") : "Completed";
        }

        if (itemData.serviceDate) {
            let jobDate = new Date(itemData.serviceDate);
            if ($item(`#${prefix}Date`).type) {
                let mName = jobDate.toLocaleDateString('en-US', { month: 'short' });
                let dNum = jobDate.getDate();
                let yNum = jobDate.getFullYear();
                let timeStr = itemData.scheduledTime || "TBD";
                
                $item(`#${prefix}Date`).text = `${mName} ${dNum}, ${yNum} ${timeStr} Time`;
                $item(`#${prefix}Date`).expand();
            }
        } else {
            if ($item(`#${prefix}Date`).type) $item(`#${prefix}Date`).collapse();
        }

        if ($item(`#${base}PaymentStatus`).type) {
            let pStatus = itemData.paymentStatus ? String(itemData.paymentStatus).toLowerCase() : "";
            if (pStatus === "paid") {
                $item(`#${base}PaymentStatus`).text = "Paid";
                $item(`#${base}PaymentStatus`).style.color = "#30FFD6"; 
            } else {
                $item(`#${base}PaymentStatus`).text = "Un-Paid";
                $item(`#${base}PaymentStatus`).style.color = "#A71111"; 
            }
        }

        if ($item(`#${base}Checkbox`).type) {
            $item(`#${base}Checkbox`).show();
        }
    };

    registerRepeater($w, "#upcomingRep", ($item, itemData) => paintJobCard($item, itemData, true));
    registerRepeater($w, "#completedRep", ($item, itemData) => paintJobCard($item, itemData, false));

    const processJobClick = (event, repId) => {
        let clickedId = event.context.itemId;
        let exactItemData = $w(repId).data.find(job => job._id === clickedId);
        
        if (!exactItemData) return;
        
        let isUpcoming = (repId === "#upcomingRep"); 

        selectedProfileJobId = exactItemData._id;
        globalActiveJobData = exactItemData; 

        session.setItem("activeProfileJobId", exactItemData._id);
        session.setItem("activeProfileJobIsUpcoming", String(isUpcoming));

        // 💥 DYNAMIC SUBMIT BUTTON STATE
        if ($w("#submitDetailEdits").id) {
            if (session.getItem("pendingUpdateEmail") === "true") {
                $w("#submitDetailEdits").enable();
            } else {
                $w("#submitDetailEdits").disable();
            }
        }

        if ($w("#vehicleType01").id) {
            $w("#vehicleType01").text = exactItemData.vehicleType || "Unknown Type";
            $w("#vehicleType01").expand();
        }
        if ($w("#vehicleCategory01").id) {
            $w("#vehicleCategory01").text = exactItemData.vehicleCategory || "Uncategorized";
            $w("#vehicleCategory01").expand();
        }
        if ($w("#vehicleInfo01").id) {
            let vYear = exactItemData.vehicleYear || ""; 
            let vMake = exactItemData.vehicleMake || "";
            let vModel = exactItemData.vehicleModel || ""; 
            let vColor = exactItemData.vehicleColor || "";
            let builtVehStr = `${vYear} ${vMake} ${vModel} ${vColor ? '- ' + vColor : ''}`.replace(/\s+/g, ' ').trim();
            
            $w("#vehicleInfo01").text = builtVehStr || exactItemData.vehicleInfo || "Unknown Vehicle";
            $w("#vehicleInfo01").expand();
        }

        if ($w("#packageImage01").id) {
            if (exactItemData.packageImage) { $w("#packageImage01").src = exactItemData.packageImage; $w("#packageImage01").show(); } 
            else { $w("#packageImage01").hide(); }
        }

        if ($w("#completedScheduled01").id) {
            let dateObj = exactItemData.serviceDate ? new Date(exactItemData.serviceDate) : new Date();
            let formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            let prefix = "Scheduled";
            if (!isUpcoming || exactItemData.status === "Completed") prefix = "Completed";
            else if (exactItemData.wasRescheduled) prefix = "Rescheduled";
            $w("#completedScheduled01").text = `${prefix} ${formattedDate}`;
        }
        
        if ($w("#arrivalDate01").id) {
            if (exactItemData.serviceDate) {
                $w("#arrivalDate01").text = new Date(exactItemData.serviceDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } else {
                $w("#arrivalDate01").text = "TBD";
            }
        }

        let timeWindow = exactItemData.scheduledTime ? exactItemData.scheduledTime.replace(" Arrival", "").trim() : "TBD";
        if ($w("#arrivalTime01").id) $w("#arrivalTime01").text = timeWindow;
        if ($w("#arrivalTime201").id) $w("#arrivalTime201").text = timeWindow;

        let isDelayed = false; 
        if (isDelayed) {
            if ($w("#status201").id) $w("#status201").expand();
            if ($w("#status01").id) $w("#status01").collapse();
        } else {
            if ($w("#status01").id) $w("#status01").expand();
            if ($w("#status201").id) $w("#status201").collapse();
        }

        if ($w("#detailer01").id) {
            $w("#detailer01").text = exactItemData.detailerName || exactItemData.detailerAlias || "Unassigned";
        }

        if ($w("#firstLastName01").id) {
            $w("#firstLastName01").text = `${exactItemData.firstName || ''} ${exactItemData.lastName || ''}`.trim() || "No Name Provided";
        }

        if ($w("#address1and201").id) {
            $w("#address1and201").text = `${exactItemData.address1 || ''} ${exactItemData.address2 || ''}`.trim() || "No Address Provided";
        }

        if ($w("#cityStateZip01").id) {
            let city = exactItemData.city || ""; let state = exactItemData.state || ""; let zip = exactItemData.zip || "";
            $w("#cityStateZip01").text = `${city}${city && state ? ',' : ''} ${state} ${zip}`.trim();
        }

        if ($w("#phoneNumber01").id) $w("#phoneNumber01").text = exactItemData.phone || "No Phone Provided";

        if ($w("#orderDate01").id) {
            if (exactItemData._createdDate) $w("#orderDate01").text = new Date(exactItemData._createdDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            else $w("#orderDate01").text = "Unknown Date";
        }

        if ($w("#orderNumber01").id) $w("#orderNumber01").text = exactItemData.orderId || "Pending";

        let compTime = exactItemData.completionTime;
        if (compTime && String(compTime).trim() !== "") {
            if ($w("#completionTime01").id) { 
                $w("#completionTime01").expand(); 
                $w("#completionTime01").text = new Date(compTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); 
            }
            if ($w("#completionTime201").id) $w("#completionTime201").expand();
        } else {
            if ($w("#completionTime01").id) $w("#completionTime01").collapse();
            if ($w("#completionTime201").id) $w("#completionTime201").collapse();
        }

        let hasLateDiscount = false;
        if (exactItemData.discountsApplied && exactItemData.discountsApplied.length > 0) {
            let lateDiscount = exactItemData.discountsApplied.find(d => d.toLowerCase().includes("late"));
            if (lateDiscount) {
                hasLateDiscount = true;
                let amountMatch = lateDiscount.match(/\$[\d.]+/);
                let displayString = amountMatch ? `-${amountMatch[0]}` : lateDiscount; 
                
                if ($w("#scheduleDiscount01").id) { $w("#scheduleDiscount01").text = displayString; $w("#scheduleDiscount01").expand(); }
                if ($w("#scheduleDiscount201").id) $w("#scheduleDiscount201").expand();
            }
        }
        if (!hasLateDiscount) {
            if ($w("#scheduleDiscount01").id) $w("#scheduleDiscount01").collapse();
            if ($w("#scheduleDiscount201").id) $w("#scheduleDiscount201").collapse();
        }

        if ($w("#specialRequests01").id) {
            let si = exactItemData.specialInstructions;
            $w("#specialRequests01").text = (si && String(si).trim() !== "") ? si : "None";
        }
        
        let unDiscountedPrice = exactItemData.basePrice ? `$${Number(exactItemData.basePrice).toFixed(2)}` : "$0.00";
        if ($w("#packagePrice01").id) $w("#packagePrice01").text = unDiscountedPrice;
        if ($w("#packagePrice201").id) $w("#packagePrice201").text = unDiscountedPrice;

        let hasPackageDiscount = false;
        if (exactItemData.discountsApplied && exactItemData.discountsApplied.length > 0) {
            let pkgDiscount = exactItemData.discountsApplied.find(d => d.toLowerCase().includes("sale") || d.toLowerCase().includes("package"));
            if (pkgDiscount) {
                hasPackageDiscount = true;
                if ($w("#packageDiscount01").id) { $w("#packageDiscount01").text = pkgDiscount; $w("#packageDiscount01").expand(); }
                if ($w("#packageDiscount201").id) $w("#packageDiscount201").expand();
            }
        }
        if (!hasPackageDiscount) {
            if ($w("#packageDiscount01").id) $w("#packageDiscount01").collapse();
            if ($w("#packageDiscount201").id) $w("#packageDiscount201").collapse();
        }

        if ($w("#detailType01").id) $w("#detailType01").text = exactItemData.type || "N/A";
        if ($w("#detailLevel01").id) $w("#detailLevel01").text = exactItemData.level || "N/A";

        if ($w("#addOns01").id) {
            let intAddons = exactItemData.interiorAddOns || [];
            let extAddons = exactItemData.exteriorAddOns || [];
            let allAddons = [...intAddons, ...extAddons];
            
            if (allAddons.length > 0) {
                $w("#addOns01").text = allAddons.join("\n"); 
            } else {
                $w("#addOns01").text = "--";
            }
        }

        let addonsTotal = exactItemData.totalAddOnsPrice || 0;
        let formattedAddOnsTotal = `$${Number(addonsTotal).toFixed(2)}`;
        if ($w("#addOnsTotal01").id) $w("#addOnsTotal01").text = formattedAddOnsTotal;
        if ($w("#addOnsTotal201").id) $w("#addOnsTotal201").text = formattedAddOnsTotal;

        if ($w("#mobileFee01").id) {
            $w("#mobileFee01").text = exactItemData.mobileFee ? `$${Number(exactItemData.mobileFee).toFixed(2)}` : "$0.00";
        }

        let discounts = exactItemData.discountsTotal || 0;
        if ($w("#totalDiscounts01").id) {
            $w("#totalDiscounts01").text = `$${Number(discounts).toFixed(2)}`;
        }

        if ($w("#grandTotal01").id) {
            $w("#grandTotal01").text = exactItemData.totalPrice ? `$${Number(exactItemData.totalPrice).toFixed(2)}` : "$0.00";
        }

        let actionButtons = [
            "#buttonDetailInfoVehicle", 
            "#buttonDetailInfoContact", 
            "#buttonDetailInfoEditPackage", 
            "#buttonDetailInfoReschedule", 
            "#buttonDetailInfoRequest"
        ];
        
        actionButtons.forEach(btnId => {
            if ($w(btnId).id) {
                if (isUpcoming) {
                    $w(btnId).expand();$w(btnId).show();
                } else {
                    $w(btnId).collapse();$w(btnId).hide();
                }
            }
        });

        if (hooks.smartGoTo) hooks.smartGoTo("detailInfoProfileState"); 
    }; 

    globalProcessJobClick = processJobClick; 

    // 💥 WIPE THE SESSION FLAG WHEN OPENING A NEW JOB
    ["#completedRepContainer"].forEach(id => {
        if ($w(id).id)$w(id).onClick((e) => {
            session.removeItem("pendingUpdateEmail");
            processJobClick(e, "#completedRep");
        });
    });
    ["#upcomingRepContainer"].forEach(id => {
        if ($w(id).id)$w(id).onClick((e) => {
            session.removeItem("pendingUpdateEmail");
            processJobClick(e, "#upcomingRep");
        });
    });
}

function initDetailActionButtons() {
    const getActiveJob = () => globalActiveJobData ? globalActiveJobData : null;

    const routeToCartEdits = async (currentJob) => {
        $w("#buttonDetailInfoVehicle").label = "Loading...";
        $w("#buttonDetailInfoContact").label = "Loading...";
        
        session.setItem("editingScheduledJobId", currentJob._id);
        session.setItem("returnBreadcrumb", "detailInfoProfileState");

        let v = hooks.getGlobalVehicles ? hooks.getGlobalVehicles() : [];
        let c = hooks.getGlobalContacts ? hooks.getGlobalContacts() : [];
        let l = hooks.getGlobalLocations ? hooks.getGlobalLocations() : [];

        let userId = await hooks.getActiveUserId();
        if (v.length === 0) {
            let resV = await wixData.query("customerVehicles").eq("userId", userId).ne("archived", true).find();
            v = resV.items;
        }
        if (c.length === 0) {
            let resC = await wixData.query("customerContacts").eq("userId", userId).ne("archived", true).find();
            c = resC.items;
        }
        if (l.length === 0) {
            let resL = await wixData.query("customerLocations").eq("userId", userId).ne("archived", true).find();
            l = resL.items;
        }

        if (typeof startCartEditsFlow === "function") {
            let mappedJob = {
                ...currentJob,
                vehicleId: currentJob.vehicleId || "NONE",
                contactId: currentJob.contactId || "NONE",
                locationId: currentJob.locationId || "NONE"
            };
            syncCartEditsDependencies(v, c, l);
            startCartEditsFlow([mappedJob], false, false);
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        if (hooks.smartGoTo) hooks.smartGoTo("cartEditsProfileState");

        $w("#buttonDetailInfoVehicle").label = "Change Vehicle";
        $w("#buttonDetailInfoContact").label = "Change Info";
    };

    if ($w("#buttonDetailInfoVehicle").id) {
        $w("#buttonDetailInfoVehicle").onClick(async () => {
            let currentJob = getActiveJob();
            if (!currentJob) return;
            await routeToCartEdits(currentJob);
        });
    }

    if ($w("#buttonDetailInfoContact").id) {
        $w("#buttonDetailInfoContact").onClick(async () => {
            let currentJob = getActiveJob();
            if (!currentJob) return;
            await routeToCartEdits(currentJob);
        });
    }

    if ($w("#buttonDetailInfoEditPackage").id) {
        $w("#buttonDetailInfoEditPackage").onClick(() => {
            let currentJob = getActiveJob();
            if (!currentJob) return;
            if (typeof loadPackageEditMode === "function") {
                loadPackageEditMode(currentJob._id);
            }
        });
    }

    if ($w("#buttonDetailInfoReschedule").id) {
        $w("#buttonDetailInfoReschedule").onClick(async () => {
            try {
                let currentJob = getActiveJob();
                if (!currentJob) return;
                
                session.setItem("reschedulingJobId", currentJob._id);
                session.setItem("returnBreadcrumb", "detailInfoProfileState");
                
                if (hooks.loadCalendarCartSlider) {
                    await hooks.loadCalendarCartSlider(currentJob);
                }
                
                if (hooks.smartGoTo) {
                    hooks.smartGoTo("calendarProfileState"); 
                }
            } catch(e) {
                logger.error("Reschedule routing failed", e);
            }
        });
    }

    if ($w("#buttonDetailInfoRequest").id) {
        $w("#buttonDetailInfoRequest").onClick(() => {
            let currentJob = getActiveJob();
            if (!currentJob) return;
            session.setItem("editingScheduledJobId", currentJob._id);
            session.setItem("returnBreadcrumb", "detailInfoProfileState");
            hooks.smartGoTo("jobInstructionsPopupState");
        });
    }

    if ($w("#buttonPaymentDetailInfo").id) {
        $w("#buttonPaymentDetailInfo").onClick(() => {
            let currentJob = getActiveJob();
            if (!currentJob) return;
            
            if (typeof selectJobInPortal === "function") {
                selectJobInPortal(currentJob._id);
            }
            if (hooks.smartGoTo) hooks.smartGoTo("paymentPortalProfileState");
        });
    }

    if ($w("#buttonDetailInfoCancel").id) {
        $w("#buttonDetailInfoCancel").onClick(() => {
            let currentJob = getActiveJob();
            if (!currentJob) return;
            openConfirmCancelPopup(currentJob);
        });
    }
    
    // 💥 UPDATED SUBMIT BUTTON (Checks Memory Flag)
    if ($w("#submitDetailEdits").id) {
        $w("#submitDetailEdits").onClick(async () => {
            $w("#submitDetailEdits").disable();
            $w("#submitDetailEdits").label = "Saving Changes...";
            
            if (session.getItem("pendingUpdateEmail") === "true") {
                console.log("📝 [ROUTING]: Actual Edits Detected! Fetching fresh flags for Job ID:", globalActiveJobData._id);
                
                try {
                    let freshJobRes = await wixData.query("scheduledJobs").eq("_id", globalActiveJobData._id).find();
                    
                    if (freshJobRes.items.length > 0) {
                        let freshJob = freshJobRes.items[0];
                        let targetEmail = null;
                        
                        try {
                            let loggedInMember = await currentMember.getMember();
                            targetEmail = loggedInMember?.loginEmail;
                            if (!targetEmail && loggedInMember?.contactDetails?.emails?.length > 0) {
                                targetEmail = loggedInMember.contactDetails.emails[0];
                            }
                        } catch(e) { console.error("Could not fetch member email", e); }
                        
                        targetEmail = targetEmail || freshJob.email; 
                        
                        if (targetEmail) {
                            let orderData = {
                                firstName: freshJob.firstName || "Valued Customer",
                                orderId: freshJob.orderId,
                                jobs: [freshJob] 
                            };
                            
                            console.log(`✉️ [FIRING EMAIL]: Sending UPDATE payload to ${targetEmail}...`, orderData);
                            sendMasterTransactionalEmail(targetEmail, orderData, "UPDATE")
                                .then(res => console.log("✅ [SUCCESS]: Update Email Sent!", res))
                                .catch(err => console.error("🚨 [ERROR]: Update Email Failed", err));
                        } else {
                            console.warn("⚠️ [EMAIL ABORT]: No member email address found to send Update to!");
                        }
                    }
                } catch(e) {
                    console.error("🚨 [ERROR]: Failed to fetch fresh job data for email", e);
                }
                
                // Clear the flag after sending!
                session.removeItem("pendingUpdateEmail");
            } else {
                console.log("⏭️ [SKIPPED]: No edits were made during this session. Exiting without sending email.");
            }

            setTimeout(() => {
                $w("#submitDetailEdits").enable(); // Re-enable for the next time they load it!
                $w("#submitDetailEdits").label = "Submit Edits";
                if (hooks.smartGoTo) hooks.smartGoTo("upcomingProfileState");
            }, 800);
        });
    }
}

export async function executeProfileJobEdit(jobId, updatedFields) {
    try {
        logger.info(`Starting Profile Edit for Job: ${jobId}`, updatedFields);
        
        let res = await wixData.query("scheduledJobs").eq("_id", jobId).find();
        if (res.items.length === 0) throw new Error("Job not found in database.");
        let job = res.items[0];

        // 💥 COMPARISON ENGINE FOR EMAIL ALERTS
        let flags = { packageChanged: false, vehicleChanged: false, locationChanged: false, contactChanged: false, dateChanged: false, addOnsChanged: false, requestsChanged: false };
        let hasChanges = false;
        
        if (updatedFields.packageTitle && updatedFields.packageTitle !== job.packageTitle) { flags.packageChanged = true; hasChanges = true; }
        if (updatedFields.totalPrice && updatedFields.totalPrice !== job.totalPrice) { flags.packageChanged = true; hasChanges = true; } 
        if (updatedFields.vehicleId && updatedFields.vehicleId !== job.vehicleId) { flags.vehicleChanged = true; hasChanges = true; }
        if (updatedFields.locationId && updatedFields.locationId !== job.locationId) { flags.locationChanged = true; hasChanges = true; }
        if (updatedFields.contactId && updatedFields.contactId !== job.contactId) { flags.contactChanged = true; hasChanges = true; }
        if (updatedFields.serviceDate && new Date(updatedFields.serviceDate).getTime() !== new Date(job.serviceDate).getTime()) { flags.dateChanged = true; hasChanges = true; }
        if (updatedFields.scheduledTime && updatedFields.scheduledTime !== job.scheduledTime) { flags.dateChanged = true; hasChanges = true; }
        if (updatedFields.totalAddOnsPrice && updatedFields.totalAddOnsPrice !== job.totalAddOnsPrice) { flags.addOnsChanged = true; hasChanges = true; }
        if (updatedFields.specialInstructions !== undefined && updatedFields.specialInstructions !== job.specialInstructions) { flags.requestsChanged = true; hasChanges = true; }

        if (hasChanges) {
            session.setItem("pendingUpdateEmail", "true");
        }

        Object.assign(job, updatedFields);
        
        job.packageChanged = flags.packageChanged;
        job.vehicleChanged = flags.vehicleChanged;
        job.locationChanged = flags.locationChanged;
        job.contactChanged = flags.contactChanged;
        job.dateChanged = flags.dateChanged;

        await wixData.update("scheduledJobs", job);

        if (job.googleEventId && job.detailerId && job.scheduledStartTime) {
            try {
                let detRes = await wixData.query("contractors").eq("_id", job.detailerId).find();
                if (detRes.items.length > 0) {
                    let detailerCalId = detRes.items[0].googleCalendarId || detRes.items[0].email;

                    let startT = new Date(job.scheduledStartTime);
                    let endT = new Date(startT);
                    endT.setHours(startT.getHours() + (job.setDuration || 3));

                    let appointmentDetails = {
                        title: `${job.vehicleInfo} - ${job.packageTitle}`,
                        description: `Order: ${job.orderId}\nVehicle: ${job.vehicleInfo}\nPhone: ${job.phone}\nInstructions: ${job.specialInstructions || 'None'}`,
                        startTime: startT.toISOString(),
                        endTime: endT.toISOString(),
                        detailerName: job.detailerName
                    };

                    let savedEventIds = { eventId: job.googleEventId, adminEventId: job.googleAdminEventId };

                    if (typeof updateOrRestoreDetailingJob === "function") {
                        await updateOrRestoreDetailingJob(detailerCalId, savedEventIds, appointmentDetails);
                    }
                }
            } catch (googleErr) {
                logger.error("Failed to patch Google Calendar (Edit saved to Wix).", googleErr);
            }
        }

        injectUpdatedJob(job); 
        
        return { success: true };

    } catch (error) {
        logger.error("executeProfileJobEdit failed", error);
        return { success: false, error: error.message };
    }
}

export function injectUpdatedJob(updatedJob) {
    if (!$w) return;
    let isUpcoming = session.getItem("activeProfileJobIsUpcoming") === "true";
    let targetRep = isUpcoming ? "#upcomingRep" : "#completedRep";
    let rep = $w(targetRep);
    
    if ($w("#detailPaymentStatus01").type) {
        let isPaid = updatedJob.paymentStatus === "Paid";
        $w("#detailPaymentStatus01").text = isPaid ? "Paid" : "Un-Paid";
        $w("#detailPaymentStatus01").html = `<h2 class="wixui-rich-text__text" style="color: ${isPaid ? '#30FFD6' : '#A71111'};">${isPaid ? 'Paid' : 'Un-Paid'}</h2>`;
    }

    if ($w("#detailPaymentMethod01").type && $w("#detailPaymentMethod02").type) {
        if (updatedJob.paymentMethodString && updatedJob.paymentMethodString.trim() !== "") {
            let methodStr = updatedJob.paymentMethodString;
            
            if (methodStr.toLowerCase() === "card") {
                let network = updatedJob.cardNetwork ? updatedJob.cardNetwork.charAt(0).toUpperCase() + updatedJob.cardNetwork.slice(1) : "Card";
                let last4 = updatedJob.cardLast4 ? `ending in ${updatedJob.cardLast4}` : "";
                $w("#detailPaymentMethod01").text = `${network} ${last4}`.trim();
            } else {
                let formattedStr = methodStr.replace(/_/g, ' '); 
                $w("#detailPaymentMethod01").text = formattedStr.charAt(0).toUpperCase() + formattedStr.slice(1);
            }
            
            $w("#detailPaymentMethod01").expand();
            $w("#detailPaymentMethod02").expand();
        } else {
            $w("#detailPaymentMethod01").collapse();
            $w("#detailPaymentMethod02").collapse();
        }
    }

    if (rep.id) {
        let data = rep.data || [];
        let idx = data.findIndex(j => String(j._id) === String(updatedJob._id));
        if (idx !== -1) { data[idx] = updatedJob; } else { data.unshift(updatedJob); }
        rep.data = data; 
        
        let cacheIdx = profileJobs.findIndex(j => String(j._id) === String(updatedJob._id));
        if (cacheIdx !== -1) profileJobs[cacheIdx] = updatedJob;

        if (typeof repaintSingleItem === "function") {
            repaintSingleItem($w, targetRep, updatedJob);
        }

        session.setItem("lockProfileSync", "true");
        setTimeout(() => { session.removeItem("lockProfileSync"); }, 3500);

        if (session.getItem("activeProfileJobId") === updatedJob._id && typeof globalProcessJobClick === "function") {
            globalProcessJobClick({ context: { itemId: updatedJob._id } }, targetRep);
        }
    }
}

export function openConfirmCancelPopup(item) {
    pendingCancelItem = item;

    let dateStr = "Pending Date";
    if (item.serviceDate || item.originalScheduledDate) {
        let d = new Date(item.serviceDate || item.originalScheduledDate);
        if (!isNaN(d.getTime())) dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    let timeStr = item.scheduledTime || "Pending Time";
    let packageStr = item.packageTitle || "Detailing Package";
    let cYear = item.vehicleYear || ""; let cMake = item.vehicleMake || "";
    let cModel = item.vehicleModel || ""; let cColor = item.vehicleColor || "";
    let vehicleStr = `${cYear} ${cMake} ${cModel} ${cColor ? '- ' + cColor : ''}`.replace(/\s+/g, ' ').trim() || "Unknown Vehicle";
    
    let summary = `⚠️ CANCEL ORDER\n\nDate: ${dateStr}\nTime: ${timeStr}\n\nVehicle: ${vehicleStr}\nPackage: ${packageStr}\nTotal: $${Number(item.totalPrice || 0).toFixed(2)}\n\nAre you sure you want to cancel this appointment? This action cannot be undone.`;

    if ($w("#confirmCancelText").id) $w("#confirmCancelText").text = summary;
    hooks.smartGoTo("cancelConfirmPopupState");
}

async function executeCancelOrder(item) {

    function removeCancelledItem(id) {
        let optString = session.getItem("optimistic_jobs");
        if (optString) {
            try {
                let optJobs = JSON.parse(optString);
                session.setItem("optimistic_jobs", JSON.stringify(optJobs.filter(j => j._id !== id)));
            } catch(e) {}
        }

        if (typeof profileJobs !== "undefined") {
            profileJobs = profileJobs.filter(j => j._id !== id);
        }

        if ($w("#upcomingRep").id) {
            let currentData = $w("#upcomingRep").data || [];
            let newData = currentData.filter(j => j._id !== id);
            
            if (typeof smartSyncRepeater === "function") {
                smartSyncRepeater($w, "#upcomingRep", newData);
            } else {
                $w("#upcomingRep").data = newData;
            }
            
            if (newData.length === 0) {
                ["#upcomingText", "#upcomingTextD", "#upcomingTextM"].forEach(textId => {
                    if ($w(textId).id) {$w(textId).text = "There are no upcoming details scheduled.";
                        $w(textId).show();$w(textId).expand(); 
                    }
                });
            }
        } 
        
        if ($w("#completedRep").id) { 
            let currentData = $w("#completedRep").data || [];
            let newCompleted = currentData.filter(j => j._id !== id);
            if (typeof smartSyncRepeater === "function") {
                smartSyncRepeater($w, "#completedRep", newCompleted);
            } else {
                $w("#completedRep").data = newCompleted;
            }
        }
    }

    try {
        console.log("🛑 [ROUTING]: Cancel Flow Triggered for Job ID:", item._id);
        
        if (hooks.closeAllOverlays) hooks.closeAllOverlays($w);
        if (hooks.smartGoTo) hooks.smartGoTo("upcomingProfileState");

        session.setItem("lockProfileSync", "true");
        setTimeout(() => { session.removeItem("lockProfileSync"); }, 3500);

        let itemAnimated = false;
        if ($w("#upcomingRep").id) {
            $w("#upcomingRep").forItems([item._id], ($item) => {
                if ($item("#upcomingRepContainer").type) {
                    itemAnimated = true;
                    $item("#upcomingRepContainer").hide("fade", { duration: 400 }).then(() => {
                        removeCancelledItem(item._id);
                    });
                }
            });
        }
        
        if (!itemAnimated) removeCancelledItem(item._id);

        let detailerCalId = null;
        let detailerRes = await wixData.query("contractors").eq("_id", item.detailerId).find();
        
        if (detailerRes.items.length > 0) {
            let selDet = detailerRes.items[0];
            detailerCalId = selDet.googleCalendarId || selDet.email;
        }

        if (typeof deleteGoogleEvent === "function" && detailerCalId) {
            await deleteGoogleEvent(detailerCalId, item.googleEventId, item.googleAdminEventId);
        }

        item.status = "Cancelled";
        await wixData.update("scheduledJobs", item);

        let orderRes = await wixData.query("scheduledJobs").eq("orderId", item.orderId).find();
        
        let orderData = {
            firstName: item.firstName || "Valued Customer",
            orderId: item.orderId,
            jobs: orderRes.items 
        };
        
        let targetEmail = item.email;
        if (!targetEmail && item.contactId && item.contactId !== "NONE") {
            let cRes = await wixData.query("customerContacts").eq("_id", item.contactId).find();
            if (cRes.items.length > 0) targetEmail = cRes.items[0].email;
        }

        if (targetEmail) {
            console.log(`✉ [FIRING EMAIL]: Sending CANCEL payload to ${targetEmail}...`, orderData);
            sendMasterTransactionalEmail(targetEmail, orderData, "CANCEL")
                .then(res => console.log("✅ [SUCCESS]: Cancel Email Sent!", res))
                .catch(err => console.error("🚨 [ERROR]: Cancel Email Failed", err));
        } else {
            console.warn("⚠️ [EMAIL ABORT]: No email address found to send Cancellation to!");
        }

        try { await broadcastCalendarUpdate(); } catch(e) {}
        
    } catch (err) {
        logger.error("Failed to cancel order", err);
    }
}

function initCancelOrderEngine() {
    if ($w("#confirmCancelButton").id) {
        $w("#confirmCancelButton").onClick(() => {
            if (!pendingCancelItem) return;

            $w("#confirmCancelButton").disable();
            $w("#confirmCancelButton").label = "Canceling...";

            executeCancelOrder(pendingCancelItem);

            setTimeout(() => {
                $w("#confirmCancelButton").enable();
                $w("#confirmCancelButton").label = "Confirm Delete";
                pendingCancelItem = null;
            }, 500);
        });
    }
}

export async function restoreActiveJob() {
    let activeId = session.getItem("activeProfileJobId");
    if (!activeId) return;

    try {
        let res = await wixData.query("scheduledJobs").eq("_id", activeId).find();
        if (res.items.length > 0) {
            let freshJob = res.items[0];
            let isUpcoming = session.getItem("activeProfileJobIsUpcoming") === "true";
            let targetRep = isUpcoming ? "#upcomingRep" : "#completedRep";

            // Ensure the repeater has this item in .data so globalProcessJobClick can paint all fields!
            if ($w(targetRep).id) {
                let currentData = $w(targetRep).data || [];
                if (!currentData.some(j => j._id === freshJob._id)) {
                    $w(targetRep).data = [freshJob, ...currentData];
                }
            }
            injectUpdatedJob(freshJob);
        }
    } catch (e) {
        logger.error("Failed to restore active job after refresh", e);
    }
}

export async function restoreCartEditsSession() {
    let editJobId = session.getItem("editingScheduledJobId");
    if (!editJobId) return;

    try {
        let resJob = await wixData.query("scheduledJobs").eq("_id", editJobId).find();
        if (resJob.items.length === 0) return;
        let currentJob = resJob.items[0];

        let v = [], c = [], l = [];
        let userId = await hooks.getActiveUserId();
        
        let resV = await wixData.query("customerVehicles").eq("userId", userId).ne("archived", true).find();
        v = resV.items;
        let resC = await wixData.query("customerContacts").eq("userId", userId).ne("archived", true).find();
        c = resC.items;
        let resL = await wixData.query("customerLocations").eq("userId", userId).ne("archived", true).find();
        l = resL.items;

        let mappedJob = {
            ...currentJob,
            vehicleId: currentJob.vehicleId || "NONE",
            contactId: currentJob.contactId || "NONE",
            locationId: currentJob.locationId || "NONE"
        };
       
        if (typeof startCartEditsFlow === "function") {
            syncCartEditsDependencies(v, c, l);
            startCartEditsFlow([mappedJob], false, false);
        }
       
    } catch (e) {
        logger.error("Failed to restore cart edits after refresh", e);
    }
}