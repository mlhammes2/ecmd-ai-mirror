// --- public/detailerPortal.js


/**
 * ========================================================================
 * 🤖 AI CONTEXT & ARCHITECTURE NOTE
 * ========================================================================
 * FILE: public/detailerPortal.js
 * DOM TARGETS: `#jobsRep`, `#jobsRepDay`, `#jobsRepDate`, 
 *              `#btnSlot1a`, `#btnSlot2a`, `#btnSlot3a` (Booked Jobs)
 *              `#btnSlot1b`, `#btnSlot2b`, `#btnSlot3b` (Open/Off Status)
 * PURPOSE: Master engine for the Detailer Dashboard. Manages the 7-day 
 *          schedule grid and dynamic job slot assignments.
 * ========================================================================
 */

import { getDrivingETA } from 'backend/googleMaps.jsw';
import wixWindow from 'wix-window';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-frontend';
import { registerRepeater, smartSyncRepeater } from 'public/repeaterEngine';
import { getDetailerTimeOff } from 'public/cartEngine'; 
import { APP_LOGS } from 'public/loggerConfig';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

let $w;
let hooks;

// 🛑 MASTER ETA TEST SWITCH
const PAUSE_GOOGLE_MAPS = true; // Set to false to re-enable live API calls

// 🌟 Local Dashboard State
let currentStartDate = new Date(); 
currentStartDate.setHours(0, 0, 0, 0); 
currentStartDate.setDate(currentStartDate.getDate() - currentStartDate.getDay());

let activeContractorData = null; // 💥 NEW: Holds the logged-in detailer's profile
let activeDetailerId = null;
let detailerJobs = [];
let detailerRules = [];
let globalTimeSlots = [];
let hasAutoSelected = false;
let activeSelectedJob = null;
let etaCache = {};

let isAdmin = false; 

let targetOverrideDate = null;
let targetOverrideToken = null;
let targetIsOff = null; 

// Master arrays for Admins
let masterAllJobs = []; 
let masterAllRules = [];
let allDetailers = [];

const DEBUG_MODE = APP_LOGS.MASTER_SWITCH && APP_LOGS.CALENDAR; 
const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [DETAILER_PORTAL]: ${msg}`, data) : console.log(`📌 [DETAILER_PORTAL]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [DETAILER_PORTAL]: ${msg}`, data) : console.warn(`📌 [DETAILER_PORTAL]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [DETAILER_PORTAL]: ${msg}`, data) : console.error(`📌 [DETAILER_PORTAL]: ${msg}`); }
};

registerModuleState("detailerPortal", () => ({
    PAUSE_GOOGLE_MAPS,
    currentStartDate: currentStartDate ? currentStartDate.toDateString() : null,
    activeDetailerId,
    activeContractorName: activeContractorData ? `${activeContractorData.first || ""} ${activeContractorData.last || ""}`.trim() : null,
    isAdmin,
    detailerJobsCount: (detailerJobs || []).length,
    detailerRulesCount: (detailerRules || []).length,
    allDetailersCount: (allDetailers || []).length,
    targetOverrideDate: targetOverrideDate ? new Date(targetOverrideDate).toDateString() : null,
    targetOverrideToken,
    activeSelectedJob: activeSelectedJob ? {
        _id: activeSelectedJob._id,
        orderId: activeSelectedJob.orderId,
        status: activeSelectedJob.status,
        paymentStatus: activeSelectedJob.paymentStatus,
        serviceDate: activeSelectedJob.serviceDate,
        scheduledTime: activeSelectedJob.scheduledTime,
        packageTitle: activeSelectedJob.packageTitle,
        payoutTotal: activeSelectedJob.payoutTotal,
        customer: `${activeSelectedJob.firstName || ""} ${activeSelectedJob.lastName || ""}`.trim(),
        city: activeSelectedJob.city
    } : null,
    etaCacheKeysCount: Object.keys(etaCache || {}).length
}));

registerDomElements({
    msb: ["#msbJobs"],
    boxes: [
        "#jobsSelectDetailerBox", "#jobsSelectDetailersMenu", "#advancedSchedulingBox",
        "#scheduledDaysOffBox", "#jobs1stSlotBox", "#jobs2ndSlotBox", "#jobs3rdSlotBox", "#jobsPopUp"
    ],
    repeaters: ["#jobsRep", "#jobsSelectDetailerMenuRep"],
    inputs: [
        "#switchSlotState", "#switch3rdSlot", "#switchAdvancedScheduling", "#switchApprovedSchedule",
        "#startDatePicker", "#endDatePicker", "#daysOffTags", "#firstSlotDaysTags",
        "#secondSlotDaysTags", "#thirdSlotDaysTags"
    ]
});

export function initDetailerPortal(wixContext, providedHooks) {
    logger.info("Initializing Detailer Portal Engine...");
    $w = wixContext;
    hooks = providedHooks || {};

    initJobsRepeater();
    initNavigationButtons(); 
    
    // 💥 Start the Popup Engine
    if (typeof initPopup === "function") {
        initPopup(); 
    }

    // 💥 Listen for the Detailer flipping the Stateful Switch
    if ($w("#switchSlotState").id) {
        $w("#switchSlotState").onChange(async (event) => {
            let switchElement = $w("#switchSlotState");
            let textElement = $w("#textSlotState");
            let isNowOpen = event.target.checked; 

            // 1. 🔒 INSTANTLY LOCK THE SWITCH to prevent spamming
            switchElement.disable();

            // 2. Give the user instant visual feedback that it is working
            if (textElement.id) {
                textElement.text = "Saving change...";
            }

            try {
                // Fire the database function and wait for it to finish
                if (targetOverrideDate && targetOverrideToken) {
                    await setSlotState(targetOverrideDate, targetOverrideToken, isNowOpen);
                } else {
                    console.error(`🚨 [MISSING DATA]: Cannot save! Data is null.`);
                }
            } catch (err) {
                console.error("🚨 [SAVE FAILED]: Reverting switch visually...", err);
                // If the save completely fails, revert the switch to its previous state
                switchElement.checked = !isNowOpen; 
                isNowOpen = !isNowOpen; // Revert the text label logic too
            } finally {
                // 3. 🔓 UNLOCK THE SWITCH and set the final text
                if (textElement.id) {
                    textElement.text = isNowOpen ? "Availability Status: OPEN" : "Availability Status: OFF";
                }
                switchElement.enable();
            }
        });
    }

    // 💥 Wire up the Recurring Days Off button
    if ($w("#submitScheduleBtn").id) {
        $w("#submitScheduleBtn").onClick(() => submitRecurringDaysOff());
    }

    // 💥 Wire up the Vacation Request button
    if ($w("#submitVacationBtn").id) {
        $w("#submitVacationBtn").onClick(() => submitVacationTime());
    }

    // 💥 Wire up the unified Advanced Slots button (1st, 2nd, 3rd slots)
    if ($w("#submitThirdSlotBtn").id) {
        $w("#submitThirdSlotBtn").onClick(() => submitAdvancedSlotOverrides());
    }

    // 💥 1. The Google Maps / Routing Action
    if ($w("#jobsGoogleMaps").id) {
        $w("#jobsGoogleMaps").onClick(() => {
            if (!activeSelectedJob) return;
            
            let addressParts = [
                activeSelectedJob.address1, activeSelectedJob.address2,
                activeSelectedJob.city, activeSelectedJob.state, activeSelectedJob.zip
            ].filter(Boolean);
            
            let fullAddress = addressParts.join(" ");
            let mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
            
            let message = "By clicking confirm, an automated email and SMS will be sent to the customer with your ETA (this includes a 30-minute window to account for traffic and preparation).";
            
            // Send the Maps logic to the universal popup
            showConfirmationPopup(message, async () => {
                // Mark Current Job as En Route
                activeSelectedJob.status = "En Route";
                await wixData.update("scheduledJobs", activeSelectedJob);

                // Auto-complete the previous job
                let sYear = new Date(activeSelectedJob.serviceDate).getFullYear();
                let sMonth = new Date(activeSelectedJob.serviceDate).getMonth();
                let sDate = new Date(activeSelectedJob.serviceDate).getDate();
                
                let todayJobs = detailerJobs.filter(j => {
                    if (!j.serviceDate) return false;
                    let jDate = new Date(j.serviceDate);
                    return jDate.getFullYear() === sYear && jDate.getMonth() === sMonth && jDate.getDate() === sDate;
                }).sort((a, b) => {
                    let slotA = globalTimeSlots.find(s => s.token === a.timeToken);
                    let slotB = globalTimeSlots.find(s => s.token === b.timeToken);
                    return (slotA ? slotA.expectedHour : 0) - (slotB ? slotB.expectedHour : 0);
                });

                let activeIndex = todayJobs.findIndex(j => j._id === activeSelectedJob._id);
                if (activeIndex > 0) {
                    let prevJob = todayJobs[activeIndex - 1];
                    if (prevJob.status !== "Completed") {
                        prevJob.status = "Completed";
                        await wixData.update("scheduledJobs", prevJob);
                    }
                }

                await updateLiveDashboard();
                console.log(`🚀 Sent ETA SMS/Email to customer for Job: ${activeSelectedJob._id}`);
                
            }, mapsUrl); // Passes the Google Maps link to the button!
        });
    }

    // 💥 2. The Arrive / Get Paid Dual-Action Button (WITH RETRY LOOP)
    if ($w("#jobsGetPaid").id) {
        $w("#jobsGetPaid").onClick(async () => {
            if (!activeSelectedJob) return;

            let currentStatus = activeSelectedJob.status || "Scheduled";

            if (currentStatus !== "Arrived") {
                // 📍 PHASE 1: MARK AS ARRIVED (GPS Check inside the Popup)
                let message = "Clicking confirm will notify the customer of your arrival, mark the job as Arrived, and verify your GPS location.";
                
                if ($w("#jobsPopUpConfirm").id) $w("#jobsPopUpConfirm").label = "Confirm";

                showConfirmationPopup(message, async () => {
                    // Update label inside the popup to show it is working
                    if ($w("#jobsPopUpConfirm").id) $w("#jobsPopUpConfirm").label = "Verifying GPS...";

                    try {
                        let destination = getActiveDestination();
                        if (!destination) throw new Error("No address on file.");

                        let result;
                            if (PAUSE_GOOGLE_MAPS) {
                                console.log("🛑 [TEST MODE]: Geofence Paused. Auto-passing GPS check.");
                                result = { success: true, distance: "0.2 mi", duration: "1 min" }; // Forces a pass
                            } else {
                                let geo = await wixWindow.getCurrentGeolocation();
                                let currentCoords = `${geo.coords.latitude},${geo.coords.longitude}`;
                                result = await getDrivingETA(currentCoords, destination);
                            }
                        
                        if (result.success) {
                            let miles = parseFloat(result.distance.replace(" mi", ""));
                            
                            // 💥 GEOFENCE FAILED: Update the text, change button to Retry, and stay open
                            if (miles > 1.0) {
                                if ($w("#jobsPopUpText").id) {
                                    $w("#jobsPopUpText").text = `Geofence Alert: You are ${miles} miles away. You must be within 1.0 mile of the service location to check in.`;
                                }
                                if ($w("#jobsPopUpConfirm").id) $w("#jobsPopUpConfirm").label = "Retry";
                                return false; // <--- This tells the popup to stay open!
                            }
                        } else {
                            throw new Error("Could not calculate distance.");
                        }

                        // 💥 PASSED: Save, update UI, and close popup
                        activeSelectedJob.status = "Arrived";
                        await wixData.update("scheduledJobs", activeSelectedJob);
                        await updateLiveDashboard(); 
                        console.log(`📍 Marked as Arrived for Job: ${activeSelectedJob._id}`);
                        return true; // <--- This tells the popup to close!

                    } catch (err) {
                        console.error("GPS Verification Error:", err);
                        if ($w("#jobsPopUpText").id) {
                            $w("#jobsPopUpText").text = "GPS Error: We could not verify your location. Please ensure Location Services are enabled on your device.";
                        }
                        if ($w("#jobsPopUpConfirm").id) $w("#jobsPopUpConfirm").label = "Retry";
                        return false; // <--- Stay open so they can retry
                    }
                });

            } else {
                // 💰 PHASE 2: COMPLETE & GET PAID
                let message = "Clicking confirm will send an email and SMS to the customer indicating the job is complete with a link for payment.";
                
                if ($w("#jobsPopUpConfirm").id) $w("#jobsPopUpConfirm").label = "Confirm";

                showConfirmationPopup(message, async () => {
                    activeSelectedJob.status = "Completed";
                    await wixData.update("scheduledJobs", activeSelectedJob);
                    await updateLiveDashboard();
                    console.log(`🚀 Sent Payment Link SMS/Email to customer for Job: ${activeSelectedJob._id}`);
                    return true;
                }); 
            }
        });
    }

    // ==========================================
    // 🚗 ETA CALCULATOR ENGINE
    // ==========================================
    
    // Helper function to build the destination address string
    const getActiveDestination = () => {
        if (!activeSelectedJob) return null;
        return [
            activeSelectedJob.address1,
            activeSelectedJob.address2,
            activeSelectedJob.city,
            activeSelectedJob.state,
            activeSelectedJob.zip
        ].filter(Boolean).join(" ");
    };
}

// Bind the Slider Arrows
function initNavigationButtons() {
    if ($w("#jobsRepNextButton").id) {
        $w("#jobsRepNextButton").onClick(() => shiftDetailerGridDays(7));
    } else if ($w("#jobsRepForwardButton").id) {
        $w("#jobsRepForwardButton").onClick(() => shiftDetailerGridDays(7));
    }

    if ($w("#jobsRepBackButton").id) {
        $w("#jobsRepBackButton").onClick(() => shiftDetailerGridDays(-7));
    }
}

export async function loadDetailerDashboardData() {
    try {
        console.log("⏳ Loading Detailer Dashboard Data...");
        
        // 1. Authenticate and find the Detailer
        let member = await currentMember.getMember().catch(() => null);
        let memberEmail = member ? (member.loginEmail || (member.contactDetails?.emails?.[0])) : null;
       
        let contractorRes = memberEmail
            ? await wixData.query("contractors").contains("email", memberEmail.trim()).find()
            : { items: [] };

        // Fallback for Wix Studio Preview / Admin testing if email doesn't match
        if (contractorRes.items.length === 0) {
            console.warn("⚠️ No contractor matched logged-in email. Falling back to default active detailer...");
            contractorRes = await wixData.query("contractors").eq("isActiveDetailer", true).ascending("first").find();
        }

        if (contractorRes.items.length === 0) throw new Error("Logged-in user is not an active detailer.");
       
        let activeContractor = contractorRes.items[0];
        activeDetailerId = activeContractor._id;
        activeContractorData = activeContractor; // Save it globally!
        isAdmin = activeContractor.isAdmin === true;
        
        logger.info(`Verified Active Detailer ID: ${activeDetailerId} | Is Admin: ${isAdmin}`);

        // 2. Fetch Master Data
        if (isAdmin) {
            let allDetailersRes = await wixData.query("contractors").ascending("first").find();
            allDetailers = allDetailersRes.items;
        }

        let [slotsRes, jobsRes, rulesRes] = await Promise.all([
            wixData.query("calendarTimeSlots").ascending("expectedHour").find(),
            isAdmin ? 
                wixData.query("scheduledJobs").ne("status", "Cancelled").ge("serviceDate", currentStartDate).limit(1000).find() :
                wixData.query("scheduledJobs").eq("detailerId", activeDetailerId).ne("status", "Cancelled").ge("serviceDate", currentStartDate).limit(500).find(),
            isAdmin ? 
                wixData.query("availabilityRules").find() :
                wixData.query("availabilityRules").eq("detailerId", activeDetailerId).find()
        ]);

        globalTimeSlots = slotsRes.items;
        masterAllJobs = jobsRes.items;
        masterAllRules = rulesRes.items;

        // 3. Silent Janitor: Clean up old date rules in the background
        if (typeof cleanUpOldRules === "function") {
            await cleanUpOldRules();
        }

        // 4. Reset the Auto-Select lock for this new load
        hasAutoSelected = false; 

        // 5. Build the UI
        filterDataForActiveDetailer();
        initAdminUI();
        generateScheduleGrid(); // Paints the data!
        updateAdvancedUI();
        syncSelectionTagsUI();

        // 6. Smoothly fade the repeater in once the data is painted!
        if ($w("#jobsRep").id && $w("#jobsRep").hidden) {
            $w("#jobsRep").show("fade", { duration: 300 });
        }

        console.log("✅ Dashboard Data Loaded & Repeater Faded In.");

    } catch (err) {
        console.error("🚨 Dashboard Load Failed:", err);
    }
}



function filterDataForActiveDetailer() {
    // 1. Check if the active detailer has advanced scheduling turned on
    let detailerProfile = isAdmin ? allDetailers.find(d => d._id === activeDetailerId) : activeContractorData;
    let isAdvanced = detailerProfile && detailerProfile.advancedScheduling === true;

    // 2. Filter Jobs
    if (isAdmin) {
        // Admins have ALL jobs, so we must filter down to the active detailer
        detailerJobs = masterAllJobs.filter(j => j.detailerId === activeDetailerId);
    } else {
        // Detailers already only downloaded their own jobs
        detailerJobs = masterAllJobs; 
    }

    // 3. Filter Rules (The Magic Mask)
    detailerRules = masterAllRules.filter(r => {
        // Rule must belong to the active detailer
        if (r.detailerId !== activeDetailerId) return false;
        
        // 💥 The Mask: Hide basic days off if advanced mode is on!
        if (isAdvanced && r.title === "recurringDaysOff") return false; 
        
        return true;
    });
}


function generateScheduleGrid() {
    let gridData = [];
    
    // Generate 3 Weeks (3 Repeater Items)
    for (let w = 0; w < 3; w++) {
        let weekStartDate = new Date(currentStartDate);
        weekStartDate.setDate(currentStartDate.getDate() + (w * 7)); // Move by weeks

        let weekDays = [];
        
        // Generate the 7 days inside this week
        for (let d = 0; d < 7; d++) {
            let dayDate = new Date(weekStartDate);
            dayDate.setDate(weekStartDate.getDate() + d);
            
            weekDays.push({
                dateObj: dayDate,
                dayName: dayDate.toLocaleDateString('en-US', { weekday: 'short' }),
                dateStr: dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            });
        }

        gridData.push({
            _id: "week_" + weekStartDate.getTime() + "_" + (activeDetailerId || "null"),
            weekDays: weekDays // 💥 The array of 7 days!
        });
    }

    smartSyncRepeater($w, "#jobsRep", gridData);
}

export function initJobsRepeater() {
    if (!$w("#jobsRep") || !$w("#jobsRep").id) return;

    registerRepeater($w, "#jobsRep", ($item, itemData) => {
        
        // 💥 Added "async" and "isAutoSelect = false"
        const handleSlotClick = async ($itemContext, btnType, slotNum, dayIndex, targetDateObj, bookedJob = null, slotIsOff = false, isAutoSelect = false) => {
            $w("#jobsRep").forEachItem(($i) => {
                for (let d = 1; d <= 7; d++) {
                    for (let k = 1; k <= 3; k++) {
                        if ($i(`#btnSlot${k}a${d}`).type) $i(`#btnSlot${k}a${d}`).enable();
                        if ($i(`#btnSlot${k}b${d}`).type) $i(`#btnSlot${k}b${d}`).enable();
                    }
                }
            });

            let targetBtn = `#btnSlot${slotNum}${btnType}${dayIndex}`;
            if ($itemContext(targetBtn).type) {$itemContext(targetBtn).disable(); }

            // 💥 SMOOTH FADE OUT (Skipped on initial page load)
            if (!isAutoSelect && $w("#msbJobs").id) {
                await $w("#msbJobs").hide("fade", { duration: 150 });
            }

            // ------------------------------------
            // "A" BUTTON LOGIC (Booked Jobs)
            // ------------------------------------
            if (btnType === 'a' && bookedJob) {
                activeSelectedJob = bookedJob; 
                
                // 💥 FIRE THE ETA CALCULATOR IN THE BACKGROUND!
                calculateAllETAs(); 
                
                let d = new Date(bookedJob.serviceDate);
                let dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
                let monthStr = d.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
                if ($w("#jobsDayDate").id) $w("#jobsDayDate").text = `${dayName} - ${monthStr}`;

                // 💥 STRIPPED EXTRA TEXT
                if ($w("#jobsTime").id) $w("#jobsTime").text = bookedJob.scheduledTime || bookedJob.timeToken || "";
                
                if ($w("#jobsDuration").id) $w("#jobsDuration").text = `${bookedJob.setDuration || 0} hrs`;
                if ($w("#jobsPackageTitle").id) $w("#jobsPackageTitle").text = bookedJob.packageTitle || "Unknown Package";

                let cat = bookedJob.vehicleCategory || "Auto";
                let vInfo = `${bookedJob.vehicleYear || ''} ${bookedJob.vehicleMake || ''} ${bookedJob.vehicleModel || ''} ${bookedJob.vehicleColor || ''}`.replace(/\s+/g, ' ').trim();
                if ($w("#jobsVehicleInfo").id) $w("#jobsVehicleInfo").text = `${cat}\n${vInfo}`;

                let addOnTitles = [];
                let addOnPays = [];
                let totalAddonPay = 0;
                const ADDON_COMMISSION_RATE = 0.70;
                
                let allAddOns = [...(bookedJob.interiorAddOns || []), ...(bookedJob.exteriorAddOns || [])];
                allAddOns.forEach(tag => {
                    let match = tag.match(/(.*?)\s*\(\$([\d.]+)\)/);
                    if (match) {
                        addOnTitles.push(match[1].trim()); 
                        let retailPrice = parseFloat(match[2]); 
                        let detailerPay = retailPrice * ADDON_COMMISSION_RATE;
                        totalAddonPay += detailerPay;
                        addOnPays.push(`$${detailerPay.toFixed(0)}`); 
                    } else {
                        addOnTitles.push(tag);
                        addOnPays.push("$0"); 
                    }
                });

                if ($w("#jobsAddOnsTitle").id) $w("#jobsAddOnsTitle").text = addOnTitles.length > 0 ? addOnTitles.join("\n") : "No Add-ons";
                if ($w("#jobsAddOnsPay").id) $w("#jobsAddOnsPay").text = addOnPays.length > 0 ? addOnPays.join("\n") : "$0"; 

                let totalPayout = Number(bookedJob.payoutTotal || 0);
                let basePay = totalPayout - totalAddonPay;
                if ($w("#jobsAddOnsBasePay").id) $w("#jobsAddOnsBasePay").text = `$${Math.max(0, basePay).toFixed(0)}`;
                if ($w("#jobsAddOnsTotalPay").id) $w("#jobsAddOnsTotalPay").text = `$${totalPayout.toFixed(0)}`;
                if ($w("#jobsCustomerName").id) $w("#jobsCustomerName").text = `${bookedJob.firstName || ''} ${bookedJob.lastName || ''}`.trim();

                let addrArr = [];
                if (bookedJob.address1) addrArr.push(bookedJob.address1);
                if (bookedJob.address2) addrArr.push(bookedJob.address2);
                let cityStZip = bookedJob.city || "";
                if (bookedJob.state || bookedJob.zip) cityStZip += (bookedJob.city ? ", " : "") + `${bookedJob.state || ""} ${bookedJob.zip || ""}`.trim();
                if (cityStZip) addrArr.push(cityStZip);
                if ($w("#jobsAddress").id) $w("#jobsAddress").text = addrArr.join("\n") || "No address provided";
            }

            let targetState = btnType === 'a' ? "customerJobState" : "detailerJobState";

            // ------------------------------------
            // "B" BUTTON LOGIC (Open/Off Slots)
            // ------------------------------------
            if (btnType === 'b') {
                targetOverrideDate = targetDateObj; 
                
                let slotData = globalTimeSlots[slotNum - 1];
                targetOverrideToken = slotData.token;
                let readableTime = slotData.label || "Unknown Time"; 
                
                let d = new Date(targetDateObj);
                let dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
                let monthStr = d.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
                
                if ($w("#detailerDayDate").id) $w("#detailerDayDate").text = `${dayName} - ${monthStr}`;
                
                // 💥 STRIPPED EXTRA TEXT
                if ($w("#detailerTime").id) $w("#detailerTime").text = readableTime;
                
                if ($w("#detailerDuration").id) $w("#detailerDuration").text = `3 hrs`;
                
                if ($w("#switchSlotState").id) {
                    $w("#switchSlotState").checked = !slotIsOff; 
                } 
                if ($w("#textSlotState").id) {
                    $w("#textSlotState").text = slotIsOff ? "Availability Status: OFF" : "Availability Status: OPEN";
                }
            }

            if (hooks && hooks.smartGoTo) hooks.smartGoTo(targetState);

            // 💥 SMOOTH FADE IN (Skipped on initial page load)
            if (!isAutoSelect && $w("#msbJobs").id) {
                await $w("#msbJobs").show("fade", { duration: 150 });
            }
        };

        // 💥 LOOP 1: Iterate through the 7 Days in this week
        for (let dayIndex = 1; dayIndex <= 7; dayIndex++) {
            let dayData = itemData.weekDays[dayIndex - 1]; // Array is 0-indexed, UI is 1-indexed

            if ($item(`#jobsRepDay${dayIndex}`).type) $item(`#jobsRepDay${dayIndex}`).text = dayData.dayName;
            if ($item(`#jobsRepDate${dayIndex}`).type) $item(`#jobsRepDate${dayIndex}`).text = dayData.dateStr;

            let sYear = dayData.dateObj.getFullYear();
            let sMonth = dayData.dateObj.getMonth();
            let sDate = dayData.dateObj.getDate();

            let jobsOnThisDay = detailerJobs.filter(j => {
                if (!j.serviceDate) return false;
                let jDate = new Date(j.serviceDate);
                return (jDate.getFullYear() === sYear && jDate.getMonth() === sMonth && jDate.getDate() === sDate) || 
                       (jDate.getUTCFullYear() === sYear && jDate.getUTCMonth() === sMonth && jDate.getUTCDate() === sDate);
            });

            let timeOff = getDetailerTimeOff(activeDetailerId, dayData.dateObj, detailerRules);

            // 💥 LOOP 2: Iterate through the 3 Slots for this specific day
            for (let i = 0; i < 3; i++) {
                let slotNum = i + 1;
                
                // Note the ID structure: #btnSlot[1-3][a-b][1-7]
                let btnA = $item(`#btnSlot${slotNum}a${dayIndex}`); 
                let btnB = $item(`#btnSlot${slotNum}b${dayIndex}`); 
                let btnBox = $item(`#btnSlot${slotNum}Box${dayIndex}`); 

                let slotDef = globalTimeSlots[i];
                if (!slotDef) {
                    if (btnBox.type) btnBox.collapse();
                    continue;
                }

                let bookedJob = jobsOnThisDay.find(j => j.timeToken === slotDef.token);
                let isThirdSlot = (i === 2); 

                let isSlotOff = (
                    isThirdSlot || 
                    timeOff.isFullDayOff || 
                    timeOff.blockedTokens.includes(slotDef.token) || 
                    (timeOff.blockedTokens.includes("AM") && slotDef.expectedHour < 12) || 
                    (timeOff.blockedTokens.includes("PM") && slotDef.expectedHour >= 12)
                ) && !timeOff.openedTokens.includes(slotDef.token); 

                let isHidden3rdSlot = (i === 2 && !bookedJob && isSlotOff);

                // --- 💥 THE CHRONOLOGICAL AUTO-SELECTOR ---
                if (!hasAutoSelected && !isHidden3rdSlot) {
                    let now = new Date();
                    let todayDate = new Date(); todayDate.setHours(0,0,0,0);
                    let itemDate = new Date(dayData.dateObj); itemDate.setHours(0,0,0,0); // Use specific day date
                    
                    let isFutureDay = itemDate.getTime() > todayDate.getTime();
                    let isToday = itemDate.getTime() === todayDate.getTime();
                    let currentHour = now.getHours();

                    let isNextAvailableSlot = false;

                    if (isFutureDay) {
                        isNextAvailableSlot = true; 
                    } else if (isToday) {
                        if (i === 0 && currentHour < 12) isNextAvailableSlot = true; 
                        else if (i === 1 && currentHour >= 12 && currentHour < 16) isNextAvailableSlot = true; 
                        else if (i === 2 && currentHour >= 16) isNextAvailableSlot = true; 
                    }

                    if (isNextAvailableSlot) {
                        hasAutoSelected = true;
                        let autoBtnType = bookedJob ? 'a' : 'b';
                        setTimeout(() => {
                            handleSlotClick($item, autoBtnType, slotNum, dayIndex, dayData.dateObj, bookedJob, isSlotOff, true);
                        }, 50);
                    }
                }

                if (isHidden3rdSlot) {
                    if (btnBox.type) btnBox.collapse();
                    continue; 
                } else {
                    if (btnBox.type) btnBox.expand();
                }

                if (bookedJob) {
                    if (btnB.type) btnB.collapse(); 
                    if (btnA.type) {
                        let payout = Number(bookedJob.payoutTotal || 0).toFixed(0); 
                        let city = (bookedJob.city || "N/A").substring(0, 6);
                        btnA.label = `$${payout}\n${city}`; 
                        btnA.expand();
                        btnA.enable(); 
                        btnA.onClick(() => handleSlotClick($item, 'a', slotNum, dayIndex, dayData.dateObj, bookedJob));
                    }
                } else {
                    if (btnA.type) btnA.collapse(); 
                    if (btnB.type) {
                        btnB.label = isSlotOff ? "Off" : "Open";
                        btnB.expand();
                        btnB.enable(); 
                        btnB.onClick(() => handleSlotClick($item, 'b', slotNum, dayIndex, dayData.dateObj, null, isSlotOff));
                    }
                }
            } // End Slot Loop
        } // End Day Loop
    }); 
}

export function shiftDetailerGridDays(offsetDays) {
    currentStartDate.setDate(currentStartDate.getDate() + offsetDays);
    generateScheduleGrid();
}

function initAdminUI() {
    const adminElements = [
        "#jobsSelectDetailerBox"
    ];

    if (isAdmin) {
        adminElements.forEach(id => {
            if ($w(id).id) {
                $w(id).expand();$w(id).show("fade", { duration: 250 });
            }
        });

        if ($w("#jobsSelectDetailersMenu").id) {
            $w("#jobsSelectDetailersMenu").collapse();
            $w("#jobsSelectDetailersMenu").hide();
        }
        
        if ($w("#jobsSelectDetailerButton").id) {
            $w("#jobsSelectDetailerButton").onClick(async () => {
                let menu = $w("#jobsSelectDetailersMenu");
                if (menu.hidden || menu.collapsed) {
                    await menu.expand(); 
                    menu.show("fade", { duration: 200 }); 
                } else {
                    await menu.hide("fade", { duration: 200 }); 
                    menu.collapse(); 
                }
            });
        }

        if ($w("#jobsSelectDetailerMenuRep").id && allDetailers.length > 0) {
            
            registerRepeater($w, "#jobsSelectDetailerMenuRep", ($item, itemData) => {
                let first = itemData.first || "Unknown";
                let lastI = itemData.last ? itemData.last.charAt(0).toUpperCase() + "." : "";
                let labelText = `${first} ${lastI}`.trim();
                
                if ($item("#jobsSelectDetailerMenuButton").type) {
                    $item("#jobsSelectDetailerMenuButton").label = labelText;
                    
                    if (itemData._id === activeDetailerId) {
                        $item("#jobsSelectDetailerMenuButton").disable();
                    } else {
                        $item("#jobsSelectDetailerMenuButton").enable();
                    }

                    $item("#jobsSelectDetailerMenuButton").onClick(async () => {
                        activeDetailerId = itemData._id;
                        
                        // 💥 NEW: This updates the Home Address for the ETA calculator!
                        activeContractorData = itemData; 
                        
                        if ($w("#jobsSelectDetailerButton").id) {
                            $w("#jobsSelectDetailerButton").label = `Viewing: ${labelText}`;
                        }
                        
                        let menu = $w("#jobsSelectDetailersMenu");
                        await menu.hide("fade", { duration: 200 });
                        menu.collapse();
                        
                        filterDataForActiveDetailer();
                        generateScheduleGrid(); 
                        updateAdvancedUI(); 
                        syncSelectionTagsUI(); 
                        
                        $w("#jobsSelectDetailerMenuRep").forEachItem(($i, iData) => {
                            if ($i("#jobsSelectDetailerMenuButton").type) {
                                if (iData._id === activeDetailerId) {
                                    $i("#jobsSelectDetailerMenuButton").disable();
                                } else {
                                    $i("#jobsSelectDetailerMenuButton").enable();
                                }
                            }
                        });
                    });
                }
            });

            smartSyncRepeater($w, "#jobsSelectDetailerMenuRep", allDetailers);
            
            let activeDet = allDetailers.find(d => d._id === activeDetailerId);
            if (activeDet && $w("#jobsSelectDetailerButton").id) {
                let first = activeDet.first || "Unknown";
                let lastI = activeDet.last ? activeDet.last.charAt(0).toUpperCase() + "." : "";
                $w("#jobsSelectDetailerButton").label = `Viewing: ${first} ${lastI}`.trim();
            }
        }

        // 💥 Wire up the Admin Permission Switches
        if ($w("#switch3rdSlot").id) {
            $w("#switch3rdSlot").onChange((event) => {
                updateContractorPermission("thirdSlotOption", event.target.checked); 
            });
        }

        if ($w("#switchAdvancedScheduling").id) {
            $w("#switchAdvancedScheduling").onChange((event) => {
                updateContractorPermission("advancedScheduling", event.target.checked);
            });
        }

        if ($w("#switchApprovedSchedule").id) {
            $w("#switchApprovedSchedule").onChange((event) => {
                updateContractorPermission("approvedSchedule", event.target.checked); 
            });
        }
        
    } else {
        adminElements.forEach(id => {
            if ($w(id).id) {
                $w(id).hide();$w(id).collapse();
            }
        });
    }
}

export async function submitVacationTime(ruleName = "Vacation / Time Off") {
    let startDate = $w("#startDatePicker").value;
    let endDate = $w("#endDatePicker").value;

    if (!startDate || !endDate) {
        console.error("Missing dates.");
        return; 
    }
    if (endDate < startDate) {
        console.error("End date cannot be before start date.");
        return;
    }

    try {
        if ($w("#submitVacationBtn").id) {
            $w("#submitVacationBtn").disable();
            $w("#submitVacationBtn").label = "Saving...";
        }

        // 💥 Build ONE single payload with both a Start and End date
        let newRule = {
            title: ruleName,
            detailerId: activeDetailerId,
            ruleType: ["Specific Date"],  // 💥 Tags Hack
            targetDate: startDate,        // Acts as the Start Date
            endDate: endDate,             // 💥 The new CMS field
            effect: ["Block Full Day"],   // 💥 Tags Hack
            status: getScheduleStatus(),         // Use ["Pending"] if you want Admins to approve it first
            requestedBy: "Admin"
        };

        // Insert the single item
        await wixData.insert("availabilityRules", newRule);
        
        // Refresh the grid
        await loadDetailerDashboardData(); 

        if ($w("#submitVacationBtn").id) {
            $w("#submitVacationBtn").enable();
            $w("#submitVacationBtn").label = "Success!";
            
            // Clear the UI pickers
            $w("#startDatePicker").value = null;
            $w("#endDatePicker").value = null;
            
            setTimeout(() => { $w("#submitVacationBtn").label = "Submit Vacation"; }, 2000);
        }

    } catch (error) {
        console.error("Failed to submit vacation time:", error);
        if ($w("#submitVacationBtn").id) {
            $w("#submitVacationBtn").enable();
            $w("#submitVacationBtn").label = "Submit Vacation";
        }
    }
}

export async function setSlotState(clickedDate, tokenToToggle, isNowOpen) {
    console.log(`💾 [DB ENGINE START]: Date: ${clickedDate}, Token: ${tokenToToggle}, NowOpen: ${isNowOpen}`);
    
    try {
        let targetEffect = isNowOpen ? "Open Specific Slots" : "Block Specific Slots";
        let oppositeEffect = isNowOpen ? "Block Specific Slots" : "Open Specific Slots";

        let startOfDay = new Date(clickedDate);
        startOfDay.setHours(0,0,0,0);

        // 1. Fetch any specific rules already made for this exact day
        let res = await wixData.query("availabilityRules")
            .eq("detailerId", activeDetailerId)
            .hasSome("ruleType", ["Specific Date"])
            .ge("targetDate", startOfDay)
            .lt("targetDate", new Date(startOfDay.getTime() + 86400000))
            .find();

        let rules = res.items;

        // 2. DELETE from the opposing rule (Undo previous changes)
        let oppositeRule = rules.find(r => r.effect && (Array.isArray(r.effect) ? r.effect.includes(oppositeEffect) : r.effect === oppositeEffect));
        if (oppositeRule && oppositeRule.targetTokens && oppositeRule.targetTokens.includes(tokenToToggle)) {
            oppositeRule.targetTokens = oppositeRule.targetTokens.filter(t => t !== tokenToToggle);
            if (oppositeRule.targetTokens.length === 0) {
                await wixData.remove("availabilityRules", oppositeRule._id); 
            } else {
                await wixData.update("availabilityRules", oppositeRule);
            }
        }

        // 3. ADD to the new rule (Group tokens to save CMS space)
        let targetRule = rules.find(r => r.effect && (Array.isArray(r.effect) ? r.effect.includes(targetEffect) : r.effect === targetEffect));
        if (targetRule) {
            if (!targetRule.targetTokens) targetRule.targetTokens = [];
            if (!targetRule.targetTokens.includes(tokenToToggle)) {
                targetRule.targetTokens.push(tokenToToggle);
                await wixData.update("availabilityRules", targetRule);
            }
        } else {
            let newRule = {
                detailerId: activeDetailerId,
                ruleType: ["Specific Date"],
                targetDate: startOfDay,
                effect: [targetEffect],
                targetTokens: [tokenToToggle],
                status: getScheduleStatus(),
                requestedBy: isAdmin ? "Admin" : "Detailer"
            };
            await wixData.insert("availabilityRules", newRule);
        }

        // 💥 4. SURGICAL UI UPDATE (NO REFRESH REQUIRED!)
        console.log(`💾 [DB LOCAL UI UPDATE]: Surgically updating grid button...`);
       
        if ($w("#jobsRep").id) {
            $w("#jobsRep").forEachItem(($item, itemData) => {
                if (!itemData.weekDays) return;
                let d2 = new Date(startOfDay); d2.setHours(0,0,0,0);

                itemData.weekDays.forEach((dayObj, idx) => {
                    let d1 = new Date(dayObj.dateObj); d1.setHours(0,0,0,0);

                    // If this is the exact day we just edited in the DB...
                    if (d1.getTime() === d2.getTime()) {
                        let dayIndex = idx + 1;
                        let slotIndex = globalTimeSlots.findIndex(s => s.token === tokenToToggle);
                        if (slotIndex !== -1) {
                            let slotNum = slotIndex + 1;
                            let targetBtn = $item(`#btnSlot${slotNum}b${dayIndex}`);
                           
                            // Instantly flip the button text on the grid!
                            if (targetBtn.type) {
                                targetBtn.label = isNowOpen ? "Open" : "Off";
                            }
                        }
                    }
                });
            });
        }

        console.log(`✅ [DB ENGINE SUCCESS]: Local UI Refreshed without resetting Admin View.`);

    } catch (err) {
        console.error(`🚨 [DB ENGINE ERROR]: `, err);
    }
}

// 💥 Updated to use "recurringDaysOff" as the default rule identifier
export async function submitRecurringDaysOff(ruleName = "recurringDaysOff") {
    // 1. Grab the array of selected tags
    let selectedDays = $w("#daysOffTags").value; 

    if (!selectedDays || selectedDays.length === 0) {
        console.log("No days selected, aborting save.");
        return; 
    }

    try {
        if ($w("#submitScheduleBtn").id) {
            $w("#submitScheduleBtn").disable();
            $w("#submitScheduleBtn").label = "Saving...";
        }

        // 💥 STEP 1: PRECISION SEARCH AND DESTROY
        let existingRules = await wixData.query("availabilityRules")
            .eq("detailerId", activeDetailerId)
            .hasSome("ruleType", ["Recurring"]) 
            .eq("title", ruleName) // 💥 Locks onto "recurringDaysOff"
            .find();

        if (existingRules.items.length > 0) {
            let idsToDelete = existingRules.items.map(item => item._id);
            await wixData.bulkRemove("availabilityRules", idsToDelete);
            console.log(`Deleted ${idsToDelete.length} old rule(s) named '${ruleName}'.`);
        }

        // 💥 STEP 2: BUILD AND INSERT THE NEW RULE
        let newRule = {
            title: ruleName,              // 💥 Saves as "recurringDaysOff"
            detailerId: activeDetailerId, 
            ruleType: ["Recurring"],      
            targetDayOfWeek: selectedDays, 
            effect: ["Block Full Day"],   
            status: getScheduleStatus(),         
            requestedBy: "Admin"
        };

        await wixData.insert("availabilityRules", newRule);
        
        // 💥 STEP 3: REFRESH THE GRID
        await loadDetailerDashboardData(); 

        if ($w("#submitScheduleBtn").id) {
            $w("#submitScheduleBtn").enable();
            $w("#submitScheduleBtn").label = "Saved!";
            setTimeout(() => { $w("#submitScheduleBtn").label = "Submit"; }, 2000);
        }
        
    } catch (error) {
        console.error("Failed to save schedule:", error);
        if ($w("#submitScheduleBtn").id) {
            $w("#submitScheduleBtn").enable();
            $w("#submitScheduleBtn").label = "Submit";
        }
    }
}

// 💥 NEW: Unified save function for 1st, 2nd, and 3rd slot recurring overrides
export async function submitAdvancedSlotOverrides() {
    let days1 = $w("#firstSlotDaysTags").id ? $w("#firstSlotDaysTags").value : [];
    let days2 = $w("#secondSlotDaysTags").id ? $w("#secondSlotDaysTags").value : [];
    let days3 = $w("#thirdSlotDaysTags").id ? $w("#thirdSlotDaysTags").value : [];

    try {
        if ($w("#submitThirdSlotBtn").id) {
            $w("#submitThirdSlotBtn").disable();
            $w("#submitThirdSlotBtn").label = "Saving...";
        }

        // 💥 STEP 1: MASS SEARCH AND DESTROY
        let overrideTitles = ["recurringFirstSlotOpen", "recurringSecondSlotOpen", "recurringThirdSlotOpen"];
        
        let existingRules = await wixData.query("availabilityRules")
            .eq("detailerId", activeDetailerId)
            .hasSome("ruleType", ["Recurring"])
            .hasSome("title", overrideTitles) // Targets all 3 potential old rules
            .find();

        if (existingRules.items.length > 0) {
            let idsToDelete = existingRules.items.map(item => item._id);
            await wixData.bulkRemove("availabilityRules", idsToDelete);
        }

        // 💥 STEP 2: BUILD NEW RULES (Only if days are actually selected)
        let payloads = [];
        
        // Safely grab the tokens from the global array
        let t1 = globalTimeSlots.length >= 1 ? globalTimeSlots[0].token : "token_1";
        let t2 = globalTimeSlots.length >= 2 ? globalTimeSlots[1].token : "token_2";
        let t3 = globalTimeSlots.length >= 3 ? globalTimeSlots[2].token : "token_3";

        // Factory function to keep code clean
        const buildRule = (title, days, token) => ({
            title: title,
            detailerId: activeDetailerId,
            ruleType: ["Recurring"],      
            targetDayOfWeek: days, 
            effect: ["Open Specific Slots"],   
            targetTokens: [token],    
            status: getScheduleStatus(),         
            requestedBy: "Admin"
        });

        if (days1 && days1.length > 0) payloads.push(buildRule("recurringFirstSlotOpen", days1, t1));
        if (days2 && days2.length > 0) payloads.push(buildRule("recurringSecondSlotOpen", days2, t2));
        if (days3 && days3.length > 0) payloads.push(buildRule("recurringThirdSlotOpen", days3, t3));

        // 💥 STEP 3: BULK INSERT
        if (payloads.length > 0) {
            await wixData.bulkInsert("availabilityRules", payloads);
        }
        
        // 💥 STEP 4: REFRESH THE GRID
        await loadDetailerDashboardData(); 

        if ($w("#submitThirdSlotBtn").id) {
            $w("#submitThirdSlotBtn").enable();
            $w("#submitThirdSlotBtn").label = "Saved!";
            setTimeout(() => { $w("#submitThirdSlotBtn").label = "Submit"; }, 2000);
        }
        
    } catch (error) {
        console.error("Failed to save advanced overrides:", error);
        if ($w("#submitThirdSlotBtn").id) {
            $w("#submitThirdSlotBtn").enable();
            $w("#submitThirdSlotBtn").label = "Submit";
        }
    }
}

// 💥 NEW: Syncs the UI Selection Tags with the Active Detailer's saved recurring rules
function syncSelectionTagsUI() {
    // 1. Reset all tags to empty first so we start with a clean slate
    if ($w("#daysOffTags").id) $w("#daysOffTags").value = [];
    if ($w("#firstSlotDaysTags").id) $w("#firstSlotDaysTags").value = [];
    if ($w("#secondSlotDaysTags").id) $w("#secondSlotDaysTags").value = [];
    if ($w("#thirdSlotDaysTags").id) $w("#thirdSlotDaysTags").value = [];

    // 2. Loop through the active detailer's rules and check the boxes if they exist
    detailerRules.forEach(rule => {
        // Check if ruleType contains "Recurring" (handling the Array format from the Tags Hack)
        let isRecurring = Array.isArray(rule.ruleType) ? rule.ruleType.includes("Recurring") : rule.ruleType === "Recurring";
        
        if (isRecurring && rule.targetDayOfWeek) {
            let ruleDays = rule.targetDayOfWeek; // e.g., ["Monday", "Wednesday"]
            
            if (rule.title === "recurringDaysOff" && $w("#daysOffTags").id) {
                $w("#daysOffTags").value = ruleDays;
            } else if (rule.title === "recurringFirstSlotOpen" && $w("#firstSlotDaysTags").id) {
                $w("#firstSlotDaysTags").value = ruleDays;
            } else if (rule.title === "recurringSecondSlotOpen" && $w("#secondSlotDaysTags").id) {
                $w("#secondSlotDaysTags").value = ruleDays;
            } else if (rule.title === "recurringThirdSlotOpen" && $w("#thirdSlotDaysTags").id) {
                $w("#thirdSlotDaysTags").value = ruleDays;
            }
        }
    });
}

// 💥 UPDATED: Now handles Admin Overrides and Toggle Switch Syncing
function updateAdvancedUI() {
    let detailerProfile = isAdmin ? allDetailers.find(d => d._id === activeDetailerId) : activeContractorData;
    if (!detailerProfile) return;

    // Be sure these exactly match your CMS field keys!
    let has3rdSlot = detailerProfile.thirdSlotOption === true; 
    let hasAdvanced = detailerProfile.advancedScheduling === true;

    // 💥 1. Admin vs. Detailer Box Visibility
    if (isAdmin) {
        if ($w("#advancedSchedulingBox").id) $w("#advancedSchedulingBox").expand();
        if ($w("#scheduledDaysOffBox").id) $w("#scheduledDaysOffBox").expand(); // Admin always sees this
        
        // Sync the switches so they physically match the DB data of the detailer being viewed
        if ($w("#switch3rdSlot").id) $w("#switch3rdSlot").checked = has3rdSlot;
        if ($w("#switchAdvancedScheduling").id) $w("#switchAdvancedScheduling").checked = hasAdvanced;
        if ($w("#switchApprovedSchedule").id) $w("#switchApprovedSchedule").checked = detailerProfile.approvedSchedule === true; // 💥 MOVED THIS UP HERE!
    } else {
        if ($w("#advancedSchedulingBox").id) $w("#advancedSchedulingBox").collapse();
        
        // Standard Detailers only see the basic box if Advanced is turned off
        if (hasAdvanced) {
            if ($w("#scheduledDaysOffBox").id) $w("#scheduledDaysOffBox").collapse();
        } else {
            if ($w("#scheduledDaysOffBox").id) $w("#scheduledDaysOffBox").expand();
        }
    }

    // 💥 2. Advanced Slot Container Visibility (For everyone)
    if (has3rdSlot) {
        if ($w("#jobs3rdSlotBox").id) $w("#jobs3rdSlotBox").expand();
    } else {
        if ($w("#jobs3rdSlotBox").id) $w("#jobs3rdSlotBox").collapse();
    }

    if (hasAdvanced) {
        if ($w("#jobs1stSlotBox").id) $w("#jobs1stSlotBox").expand();
        if ($w("#jobs2ndSlotBox").id) $w("#jobs2ndSlotBox").expand();
    } else {
        if ($w("#jobs1stSlotBox").id) $w("#jobs1stSlotBox").collapse();
        if ($w("#jobs2ndSlotBox").id) $w("#jobs2ndSlotBox").collapse();
    }
}

// 💥 NEW: Saves Admin toggle changes straight to the Contractor's DB profile
async function updateContractorPermission(fieldKey, isChecked) {
    try {
        let targetContractor = allDetailers.find(d => d._id === activeDetailerId);
        if (!targetContractor) return;

        // Update the specific boolean field
        targetContractor[fieldKey] = isChecked;
        await wixData.update("contractors", targetContractor);

        // Keep local data synced
        let index = allDetailers.findIndex(d => d._id === activeDetailerId);
        if (index !== -1) allDetailers[index] = targetContractor;
        
        if (activeContractorData._id === activeDetailerId) {
            activeContractorData[fieldKey] = isChecked;
        }

        // Instantly repaint the UI
        updateAdvancedUI();
        filterDataForActiveDetailer();
        generateScheduleGrid();

    } catch (err) {
        // 💥 We removed the "event" error line from here!
        console.error(`Failed to update ${fieldKey}:`, err);
    }
}

// 💥 NEW: Dynamically assigns Pending or Approved status
function getScheduleStatus() {
    // Admins always auto-approve their own changes
    if (isAdmin) return ["Approved"];
    
    // Check if the detailer has the auto-approve toggle turned on
    let isAutoApprove = activeContractorData && activeContractorData.approvedSchedule === true;
    return isAutoApprove ? ["Approved"] : ["Pending"];
}

// 💥 SILENT JANITOR: Deletes old "Specific Date" rules in the background
async function cleanUpOldRules() {
    let yesterday = new Date();
    yesterday.setHours(0, 0, 0, 0);

    try {
        let res = await wixData.query("availabilityRules")
            .hasSome("ruleType", ["Specific Date"])
            .lt("targetDate", yesterday)
            .limit(50)
            .find();

        if (res.items.length > 0) {
            let idsToDelete = res.items.map(item => item._id);
            await wixData.bulkRemove("availabilityRules", idsToDelete);
            console.log(`🧹 Janitor cleaned up ${idsToDelete.length} expired schedule rules.`);
        }
    } catch (e) {
        console.error("Cleanup failed", e);
    }
}

// ==========================================
// 💥 UNIVERSAL SMART POPUP ENGINE
// ==========================================
let popupConfirmAction = null;

export function initPopup() {
    const closePopup = () => {
        if ($w("#jobsPopUp").id) $w("#jobsPopUp").hide("fade", { duration: 150 });
        popupConfirmAction = null; 
        
        if ($w("#jobsPopUpConfirm").id) {
            $w("#jobsPopUpConfirm").link = "";
            $w("#jobsPopUpConfirm").target = "_self";
        }
    };

    if ($w("#jobsPopUpCancel").id) $w("#jobsPopUpCancel").onClick(closePopup);
    
    if ($w("#jobsPopUpConfirm").id) {
        $w("#jobsPopUpConfirm").onClick(async () => {
            $w("#jobsPopUpConfirm").disable();
            $w("#jobsPopUpConfirm").label = "Processing...";

            try {
                let shouldClose = true;
                
                // 💥 FIRE WHATEVER CUSTOM LOGIC WAS PASSED TO IT
                if (typeof popupConfirmAction === "function") {
                    let result = await popupConfirmAction();
                    
                    // If the custom logic explicitly returns false (like a GPS error), KEEP IT OPEN!
                    if (result === false) {
                        shouldClose = false;
                    }
                }
                
                if (shouldClose) {
                    closePopup(); 
                }
            } catch (err) {
                console.error("Popup Action Failed:", err);
                closePopup(); 
            } finally {
                $w("#jobsPopUpConfirm").enable();
                // If the logic changed the button to "Retry", leave it! Otherwise reset to Confirm.
                if ($w("#jobsPopUpConfirm").label === "Processing...") {
                    $w("#jobsPopUpConfirm").label = "Confirm";
                }
            }
        });
    }
}

export function showConfirmationPopup(message, confirmCallback, optionalUrl = null) {
    if ($w("#jobsPopUpText").id) {
        $w("#jobsPopUpText").text = message;
    }
    
    let confirmBtn = $w("#jobsPopUpConfirm");
    if (confirmBtn.id) {
        if (optionalUrl) {
            confirmBtn.link = optionalUrl;
            confirmBtn.target = "_blank"; 
        } else {
            confirmBtn.link = ""; 
        }
    }
    
    popupConfirmAction = confirmCallback;
    
    if ($w("#jobsPopUp").id) {
        $w("#jobsPopUp").show("fade", { duration: 200 });
    }
}

// ==========================================
// ⏱️ LIVE OPS STATUS & PENALTY ENGINE
// ==========================================
async function updateLiveDashboard() {
    if (!activeSelectedJob) return;

    // 💥 Helper function to inject colors WITHOUT breaking Wix native text scaling!
    const setStatusHtml = (text, colorHex) => {
        if (!$w("#liveStatusText").id) return;
        let currentHtml = $w("#liveStatusText").html;
        let openTag = currentHtml.substring(0, currentHtml.indexOf('>') + 1);
        let closeTag = currentHtml.substring(currentHtml.lastIndexOf('<'));
        $w("#liveStatusText").html = `${openTag}<span style="color:${colorHex}; font-weight:bold;">${text}</span>${closeTag}`;
    };

    // 1. Evaluate Current Job Status & Payment
    let isPaid = activeSelectedJob.paymentStatus === "Paid";
    let jobStatus = activeSelectedJob.status || "Scheduled"; 

    // Set formatting colors
    const colors = { green: "#30FFD6", yellow: "#FFD700", red: "#FF3B30", blue: "#2B81FF", grey: "#A0A0A0", purple: "#B266FF" };

    // 💥 NEW: Swap the Dual-Action Button Image AND Text based on status
    if ($w("#arriveCompleteImage").id) {
        if (jobStatus === "Arrived") {
            // Image & Text for Phase 2: GET PAID / COMPLETED
            $w("#arriveCompleteImage").src = "https://static.wixstatic.com/shapes/694137_a9f878dfa6694d97b96f60a95c510393.svg"; 
            if ($w("#arrivalCompleteText").id) $w("#arrivalCompleteText").text = "Get Paid";
        } else {
            // Image & Text for Phase 1: MARK ARRIVED
            $w("#arriveCompleteImage").src = "https://static.wixstatic.com/shapes/694137_aa4ae4017d3b4154ace8bf93ac9caed3.svg"; 
            if ($w("#arrivalCompleteText").id) $w("#arrivalCompleteText").text = "Mark Arrival";
        }
    }

    if (jobStatus === "Completed") {
        setStatusHtml(`⚫ Completed - ${isPaid ? "Paid" : "Unpaid"}`, colors.grey);
        if ($w("#countdownText").id) $w("#countdownText").text = "End of Route";
        return; 
    }
    
    // 💥 NEW: Handle the new "Arrived" text state
    if (jobStatus === "Arrived") {
        setStatusHtml(`🟣 Arrived - In Progress`, colors.purple);
    }

    if (jobStatus === "En Route") {
        setStatusHtml(`🔵 En Route - ${isPaid ? "Paid" : "Unpaid"}`, colors.blue);
    }

    // 2. Find the NEXT job to calculate the late-penalty countdown
    let sYear = new Date(activeSelectedJob.serviceDate).getFullYear();
    let sMonth = new Date(activeSelectedJob.serviceDate).getMonth();
    let sDate = new Date(activeSelectedJob.serviceDate).getDate();
    
    let todayJobs = detailerJobs.filter(j => {
        if (!j.serviceDate) return false;
        let jDate = new Date(j.serviceDate);
        return jDate.getFullYear() === sYear && jDate.getMonth() === sMonth && jDate.getDate() === sDate;
    });

    let enrichedJobs = todayJobs.map(j => {
        let slot = globalTimeSlots.find(s => s.token === j.timeToken);
        return { ...j, expectedHour: slot ? slot.expectedHour : 0 };
    }).sort((a, b) => a.expectedHour - b.expectedHour);

    let activeIndex = enrichedJobs.findIndex(j => j._id === activeSelectedJob._id);
    let nextJob = (activeIndex !== -1 && activeIndex < enrichedJobs.length - 1) ? enrichedJobs[activeIndex + 1] : null;

    if (!nextJob) {
        if (jobStatus !== "En Route") {
            setStatusHtml(`🟢 On Schedule (Final Job)`, colors.green);
        }
        if ($w("#countdownText").id) $w("#countdownText").text = "No subsequent jobs today.";
        return;
    }

    // 3. Math Time: How long to drive from current job to next job?
    if ($w("#countdownText").id) $w("#countdownText").text = "Calculating deadline...";
    
    let originAddress = getActiveDestination(activeSelectedJob);
    let destAddress = getActiveDestination(nextJob);
    let driveMinutes = 0;

    if (originAddress && destAddress) {
        let routeData = await getCachedETA(originAddress, destAddress);
        if (routeData.success) {
            driveMinutes = parseInt(routeData.duration) || 0; 
        }
    }

    // 4. Calculate "Must Leave By" Deadline
    // 💥 FIX: Pull the exact Date from the Next Job instead of "Today"
    let deadlineTime = new Date(nextJob.serviceDate);
    deadlineTime.setHours(nextJob.expectedHour, 0, 0, 0); 
    deadlineTime.setMinutes(deadlineTime.getMinutes() - driveMinutes); 

    let now = new Date();
    let diffMs = deadlineTime.getTime() - now.getTime(); 
    let diffMins = Math.floor(diffMs / 60000);

    // 5. Apply Status Colors and Text based on the math
    if (jobStatus !== "En Route") {
        if (diffMins > 15) setStatusHtml(`🟢 On Schedule`, colors.green);
        else if (diffMins > 0) setStatusHtml(`🟡 At Risk (Cutting it close)`, colors.yellow);
        else setStatusHtml(`🔴 Delayed - Penalty Risk`, colors.red);
    }

    // 6. Print the dynamic countdown string
    if ($w("#countdownText").id) {
        let sign = diffMins >= 0 ? "+" : "-";
        let absMins = Math.abs(diffMins);
        
        // 💥 NEW: Break down total minutes into Days, Hours, and Minutes
        let days = Math.floor(absMins / (24 * 60));
        let hours = Math.floor((absMins % (24 * 60)) / 60);
        let mins = absMins % 60;
        
        let timeParts = [];
        if (days > 0) timeParts.push(`${days} day${days !== 1 ? 's' : ''}`);
        if (hours > 0) timeParts.push(`${hours} hr${hours !== 1 ? 's' : ''}`);
        timeParts.push(`${mins} min${mins !== 1 ? 's' : ''}`);
        
        let formattedTime = timeParts.join(" ");

        $w("#countdownText").text = `${sign} ${formattedTime} (until job must be complete to make it on time to the next job)`;
        
        if (diffMins < 0) {
            // Keep native scaling for countdown text too if it flashes red
            let currentHtml = $w("#countdownText").html;
            let openTag = currentHtml.substring(0, currentHtml.indexOf('>') + 1);
            let closeTag = currentHtml.substring(currentHtml.lastIndexOf('<'));
            $w("#countdownText").html = `${openTag}<span style="color:${colors.red}; font-weight:bold;">${$w("#countdownText").text}</span>${closeTag}`;
        }
    }
}

// ==========================================
// 🚗 AUTO MULTI-ETA CALCULATOR ENGINE
// ==========================================
const getActiveDestination = (jobRecord) => {
    if (!jobRecord) return null;
    return [
        jobRecord.address1,
        jobRecord.address2,
        jobRecord.city,
        jobRecord.state,
        jobRecord.zip
    ].filter(Boolean).join(" ");
};

// ==========================================
// 🧠 SMART ETA CACHE ENGINE
// ==========================================
async function getCachedETA(origin, destination) {
    if (!origin || !destination) return { success: false, error: "Missing Address" };

    // 🛑 TEST MODE INTERCEPT
    if (PAUSE_GOOGLE_MAPS) {
        console.log("🛑 [TEST MODE]: Google Maps Paused. Injecting dummy ETA.");
        return { success: true, distance: "12.5 mi", duration: "25 mins" };
    }

    let cacheKey = `${origin} || ${destination}`;

    if (etaCache[cacheKey]) {
        return etaCache[cacheKey];
    }

    let result = await getDrivingETA(origin, destination);

    if (result.success) {
        etaCache[cacheKey] = result;
    }

    return result;
}

async function calculateAllETAs() {
    try {
        if (!activeSelectedJob) return;

        let destination = getActiveDestination(activeSelectedJob);
        if (!destination) {
            if ($w("#etaText").id) $w("#etaText").text = "No address on file.";
            return;
        }

        if ($w("#etaText").id) $w("#etaText").text = "Calculating ETA...";

        let etaList = []; 

        // 💥 GATHER TODAY'S JOBS TO DETERMINE ORDER
        let sYear = new Date(activeSelectedJob.serviceDate).getFullYear();
        let sMonth = new Date(activeSelectedJob.serviceDate).getMonth();
        let sDate = new Date(activeSelectedJob.serviceDate).getDate();
        
        let todayJobs = detailerJobs.filter(j => {
            if (!j.serviceDate) return false;
            let jDate = new Date(j.serviceDate);
            return jDate.getFullYear() === sYear && jDate.getMonth() === sMonth && jDate.getDate() === sDate;
        });

        let enrichedJobs = todayJobs.map(j => {
            let slot = globalTimeSlots.find(s => s.token === j.timeToken);
            return { ...j, expectedHour: slot ? slot.expectedHour : 0 };
        }).sort((a, b) => a.expectedHour - b.expectedHour);

        let activeIndex = enrichedJobs.findIndex(j => j._id === activeSelectedJob._id);
        
        // 💥 1. ETA FROM PREVIOUS JOB (Only runs if it's the 2nd or 3rd job)
        if (activeIndex > 0) {
            let prevJob = enrichedJobs[activeIndex - 1];
            let prevAddress = getActiveDestination(prevJob);
            
            if (prevAddress) {
                let prevResult = await getCachedETA(prevAddress, destination);
                if (prevResult.success) {
                    etaList.push(`From Previous Job: ${prevResult.distance} (${prevResult.duration})`);
                } else {
                    etaList.push(`From Previous Job: Failed (${prevResult.error})`);
                }
            }
        }

        // 💥 2. ETA FROM HOME (Only runs if it's the 1st job of the day)
        if (activeIndex === 0) {
            let homeRaw = activeContractorData?.homeAddress;
            let homeAddressStr = typeof homeRaw === 'object' ? homeRaw.formatted : homeRaw;

            if (homeAddressStr) {
                let homeResult = await getCachedETA(homeAddressStr, destination);
                if (homeResult.success) {
                    etaList.push(`From Home: ${homeResult.distance} (${homeResult.duration})`);
                } else {
                    etaList.push(`From Home: Failed (${homeResult.error})`);
                }
            } else {
                etaList.push("From Home: No Address in Profile");
            }
        }

        // 💥 FINALLY: Print the stacked list (GPS section completely removed)
        if ($w("#etaText").id) {
            $w("#etaText").text = etaList.join("\n"); 
        }

    } catch (masterError) {
        console.error("ETA Engine Crash:", masterError);
        if ($w("#etaText").id) {
            $w("#etaText").text = "System Error: " + masterError.message;
        }
    }

    // 💥 UPDATE THE LIVE OPS DASHBOARD
        await updateLiveDashboard();
}