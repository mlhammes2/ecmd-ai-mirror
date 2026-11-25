// --- public/cartEngine.js ---

/**
 * ========================================================================
 * 🤖 AI CONTEXT & ARCHITECTURE NOTE
 * ========================================================================
 * FILE: public/cartEngine.js
 * DOM TARGETS: None directly. Shared utility library.
 * PURPOSE: Pure math/validation (Next Available Date, Time Off calculations).
 * ========================================================================
 */

import wixAnimationsFrontend from 'wix-animations-frontend';
import { initRouterEngine, smartGoTo, openSideMenu, closeSideMenu, openOverlay, closeAllOverlays, closeTopOverlay, showSuccessMessage, showErrorMessage } from 'public/routerEngine';
import { APP_LOGS } from 'public/loggerConfig';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

let lastTimeOffDiagnostics = null;
let lastValidationDiagnostics = null;

// ==========================================
// 🔴 DEBUGGING & AI TELEMETRY ENGINE
// ==========================================
const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [CART_ENGINE]: ${msg}`, data) : console.log(`📌 [CART_ENGINE]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [CART_ENGINE]: ${msg}`, data) : console.warn(`📌 [CART_ENGINE]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [CART_ENGINE]: ${msg}`, data) : console.error(`📌 [CART_ENGINE]: ${msg}`); }
};

registerModuleState("cartEngine", () => ({
    lastTimeOffDiagnostics,
    lastValidationDiagnostics
}));

registerDomElements({
    msb: ["#msbLightboxG"],
    boxes: ["#changeVehicle", "#changeVehicleCustom", "#contactInfo", "#contactInfoCustom", "#locationInfo", "#locationInfoCustom", "#selectDetailer"]
});

// ==========================================
// 🧠 PURE MATH & FORMATTING HELPERS
// ==========================================
export function getOrdinalSuffix(i) {
    let j = i % 10, k = i % 100;
    if (j == 1 && k != 11) return i + "st";
    if (j == 2 && k != 12) return i + "nd";
    if (j == 3 && k != 13) return i + "rd";
    return i + "th";
}

export function formatPhoneNumber(rawPhone) {
    if (!rawPhone) return "";
    let cleaned = ('' + rawPhone).replace(/\D/g, ''); 
    if (cleaned.length === 10) return `(${cleaned.substring(0,3)})-${cleaned.substring(3,6)}-${cleaned.substring(6,10)}`;
    return rawPhone; 
}

export function buildCalendarDates(dateStr, timeStr) {
    let d = new Date(dateStr);
    let year = d.getFullYear();
    let month = String(d.getMonth() + 1).padStart(2, '0');
    let day = String(d.getDate()).padStart(2, '0');
    let baseIso = `${year}-${month}-${day}`;

    if (timeStr && (timeStr.includes("9-11") || timeStr.includes("9:00"))) {
        return { start: `${baseIso}T09:00:00`, end: `${baseIso}T11:00:00` };
    } else {
        return { start: `${baseIso}T13:00:00`, end: `${baseIso}T15:00:00` };
    }
}

// ==========================================
// 📅 CALENDAR MATH ENGINE (TOKEN-AWARE)
// ==========================================
export function getDetailerTimeOff(detailerId, targetDateObj, globalAvailabilityRules = []) {
    let amOff = false;
    let pmOff = false;
    let isFullDayOff = false;
    let blockedTokens = []; 
    let openedTokens = []; 

    let targetDayOfWeek = targetDateObj.toLocaleDateString('en-US', { weekday: 'long' });

    let myRules = (globalAvailabilityRules || []).filter(r => {
        if (String(r.detailerId) !== String(detailerId)) return false;
        let isApproved = Array.isArray(r.status) ? r.status.includes("Approved") : r.status === "Approved";
        return isApproved;
    });

    for (let rule of myRules) {
        let matchesDay = false;
        let matchesDate = false;

        let isRecurring = Array.isArray(rule.ruleType) ? rule.ruleType.includes("Recurring") : rule.ruleType === "Recurring";
        let isSpecificDate = Array.isArray(rule.ruleType) ? rule.ruleType.includes("Specific Date") : rule.ruleType === "Specific Date";

        if (isRecurring && rule.targetDayOfWeek) {
            matchesDay = Array.isArray(rule.targetDayOfWeek) ? rule.targetDayOfWeek.includes(targetDayOfWeek) : rule.targetDayOfWeek === targetDayOfWeek;
        } else if (isSpecificDate && rule.targetDate) {
            let sYear = targetDateObj.getFullYear();
            let sMonth = targetDateObj.getMonth();
            let sDate = targetDateObj.getDate();
            let rDate = new Date(rule.targetDate);

            if (rule.endDate) {
                let eDate = new Date(rule.endDate);
                let compareTarget = new Date(sYear, sMonth, sDate).getTime();
                let compareStart = new Date(rDate.getFullYear(), rDate.getMonth(), rDate.getDate()).getTime();
                let compareEnd = new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate()).getTime();
                matchesDate = (compareTarget >= compareStart && compareTarget <= compareEnd);
            } else {
                let matchLocal = (rDate.getFullYear() === sYear && rDate.getMonth() === sMonth && rDate.getDate() === sDate);
                let matchUTC = (rDate.getUTCFullYear() === sYear && rDate.getUTCMonth() === sMonth && rDate.getUTCDate() === sDate);
                matchesDate = matchLocal || matchUTC;
            }
        }

        if (matchesDay || matchesDate) {
            let isBlockFullDay = Array.isArray(rule.effect) ? rule.effect.includes("Block Full Day") : rule.effect === "Block Full Day";
            let isBlockSlots = Array.isArray(rule.effect) ? rule.effect.includes("Block Specific Slots") : rule.effect === "Block Specific Slots";
            let isOpenSlots = Array.isArray(rule.effect) ? rule.effect.includes("Open Specific Slots") : rule.effect === "Open Specific Slots";

            if (isBlockFullDay) {
                isFullDayOff = true;
                amOff = true;
                pmOff = true;
            } 
            else if (isBlockSlots) {
                let tokens = Array.isArray(rule.targetTokens) ? rule.targetTokens : [];
                blockedTokens.push(...tokens);
                if (tokens.some(t => t.includes("1") || t.toLowerCase().includes("am"))) amOff = true;
                if (tokens.some(t => t.includes("2") || t.toLowerCase().includes("pm"))) pmOff = true;
            } 
            else if (isOpenSlots) {
                let tokens = Array.isArray(rule.targetTokens) ? rule.targetTokens : [];
                openedTokens.push(...tokens); 
            }
        }
    }
    
    if (openedTokens.some(t => t.includes("1") || t.toLowerCase().includes("am"))) amOff = false;
    if (openedTokens.some(t => t.includes("2") || t.toLowerCase().includes("pm"))) pmOff = false;
    
    let finalResult = { amOff, pmOff, isFullDayOff, blockedTokens, openedTokens };
    lastTimeOffDiagnostics = {
        detailerId,
        targetDate: targetDateObj.toDateString(),
        approvedRulesCount: myRules.length,
        verdict: finalResult
    };
    
    return finalResult;
}

export function calculateNextAvailableDate(tomorrow, globalJobs, globalDetailers) {
    for (let i = 0; i < 30; i++) {
        let check = new Date(tomorrow);
        check.setDate(tomorrow.getDate() + i);
        
        let sYear = check.getFullYear();
        let sMonth = check.getMonth();
        let sDate = check.getDate();

        let jobsOnThisDay = globalJobs.filter(job => {
            if (!job.serviceDate) return false;
            let jDate = new Date(job.serviceDate);
            let matchLocal = (jDate.getFullYear() === sYear && jDate.getMonth() === sMonth && jDate.getDate() === sDate);
            let matchUTC = (jDate.getUTCFullYear() === sYear && jDate.getUTCMonth() === sMonth && jDate.getUTCDate() === sDate);
            return matchLocal || matchUTC;
        });
        
        let takenAmSlots = jobsOnThisDay.filter(j => {
            let t = (j.scheduledTime || "").trim().toLowerCase();
            return t === "9:00 am" || t === "9-11am arrival";
        }).length;
        
        let takenPmSlots = jobsOnThisDay.filter(j => {
            let t = (j.scheduledTime || "").trim().toLowerCase();
            return t === "1:00 pm" || t === "1-3pm arrival";
        }).length;

        if (takenAmSlots < globalDetailers.length || takenPmSlots < globalDetailers.length) {
            return check; 
        }
    }
    return tomorrow; 
}

export function buildWeeklyDataArray(startDay, tomorrow, globalJobs, globalDetailers, globalAvailabilityRules, globalSelectedSlots, calendarDetailerFilter) {
    let data = [];
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    
    for (let i = 0; i < 21; i++) {
        let loopDate = new Date(startDay);
        loopDate.setDate(startDay.getDate() + i);
        let dateString = loopDate.toLocaleDateString('en-US'); 
        let isPastDate = loopDate < tomorrow; 

        let sYear = loopDate.getFullYear();
        let sMonth = loopDate.getMonth();
        let sDate = loopDate.getDate();

        let jobsOnThisDay = globalJobs.filter(job => {
            if (!job.serviceDate) return false;
            let jDate = new Date(job.serviceDate);
            let matchLocal = (jDate.getFullYear() === sYear && jDate.getMonth() === sMonth && jDate.getDate() === sDate);
            let matchUTC = (jDate.getUTCFullYear() === sYear && jDate.getUTCMonth() === sMonth && jDate.getUTCDate() === sDate);
            return matchLocal || matchUTC;
        });

        let isAmAvailable = false;
        let isPmAvailable = false;
        let finalAmCount = 0; 
        let finalPmCount = 0; 

        if (calendarDetailerFilter) {
            let isAmBooked = jobsOnThisDay.some(j => {
                let t = (j.scheduledTime || "").trim().toLowerCase();
                return j.detailerId === calendarDetailerFilter && (t === "9:00 am" || t === "9-11am arrival");
            }) || globalSelectedSlots.some(s => s.detailerId === calendarDetailerFilter && s.date === dateString && s.time === "9-11am Arrival");
                             
            let isPmBooked = jobsOnThisDay.some(j => {
                let t = (j.scheduledTime || "").trim().toLowerCase();
                return j.detailerId === calendarDetailerFilter && (t === "1:00 pm" || t === "1-3pm arrival");
            }) || globalSelectedSlots.some(s => s.detailerId === calendarDetailerFilter && s.date === dateString && s.time === "1-3pm Arrival");
                             
            let timeOff = getDetailerTimeOff(calendarDetailerFilter, loopDate, globalAvailabilityRules); 

            isAmAvailable = !isPastDate && !isAmBooked && !timeOff.amOff;
            isPmAvailable = !isPastDate && !isPmBooked && !timeOff.pmOff;
            
            finalAmCount = isAmAvailable ? 1 : 0;
            finalPmCount = isPmAvailable ? 1 : 0;
        } else {
            let amAvailableCount = 0;
            let pmAvailableCount = 0;

            globalDetailers.forEach(detailer => {
                let isAmBooked = jobsOnThisDay.some(j => {
                    let t = (j.scheduledTime || "").trim().toLowerCase();
                    return j.detailerId === detailer._id && (t === "9:00 am" || t === "9-11am arrival");
                }) || globalSelectedSlots.some(s => s.detailerId === detailer._id && s.date === dateString && s.time === "9-11am Arrival");
                                 
                let isPmBooked = jobsOnThisDay.some(j => {
                    let t = (j.scheduledTime || "").trim().toLowerCase();
                    return j.detailerId === detailer._id && (t === "1:00 pm" || t === "1-3pm arrival");
                }) || globalSelectedSlots.some(s => s.detailerId === detailer._id && s.date === dateString && s.time === "1-3pm Arrival");
                                 
                let timeOff = getDetailerTimeOff(detailer._id, loopDate, globalAvailabilityRules); 

                if (!isAmBooked && !timeOff.amOff) amAvailableCount++;
                if (!isPmBooked && !timeOff.pmOff) pmAvailableCount++;
            });

            isAmAvailable = !isPastDate && (amAvailableCount > 0);
            isPmAvailable = !isPastDate && (pmAvailableCount > 0);
            
            finalAmCount = isPastDate ? 0 : amAvailableCount;
            finalPmCount = isPastDate ? 0 : pmAvailableCount;
        }

        data.push({
            _id: "day_" + loopDate.getTime().toString(),
            fullDateString: dateString,
            dateObj: loopDate,
            dayLabel: dayNames[loopDate.getDay()],
            dateNum: loopDate.getDate().toString(),
            monthLabel: monthNames[loopDate.getMonth()],
            isAmAvailable: isAmAvailable,
            isPmAvailable: isPmAvailable,
            amCount: finalAmCount, 
            pmCount: finalPmCount, 
            isFullyAvailable: isAmAvailable || isPmAvailable
        });
    }
    return data;
}

// ==========================================
// 🛡️ CHECKOUT VALIDATORS
// ==========================================
export function validateCurrentItem(item, $w) {
    let isValid = true;
    let missingFields = [];

    const isMissing = (val) => !val || val === "NONE" || val === "0";

    if (isMissing(item.vehicleId)) {
        isValid = false; missingFields.push("Vehicle");
        if ($w("#changeVehicle").id) $w("#changeVehicle").style.borderColor = "#DF3131";
        if ($w("#changeVehicleCustom").id) $w("#changeVehicleCustom").style.borderColor = "#DF3131";
    } else {
        if ($w("#changeVehicle").id) $w("#changeVehicle").style.borderColor = "#000000";
        if ($w("#changeVehicleCustom").id) $w("#changeVehicleCustom").style.borderColor = "#000000";
    }

    if (isMissing(item.contactId)) {
        isValid = false; missingFields.push("Contact");
        if ($w("#contactInfo").id) $w("#contactInfo").style.borderColor = "#DF3131";
        if ($w("#contactInfoCustom").id) $w("#contactInfoCustom").style.borderColor = "#DF3131";
    } else {
        if ($w("#contactInfo").id) $w("#contactInfo").style.borderColor = "#000000";
        if ($w("#contactInfoCustom").id) $w("#contactInfoCustom").style.borderColor = "#000000";
    }

    if (isMissing(item.locationId)) {
        isValid = false; missingFields.push("Location");
        if ($w("#locationInfo").id) $w("#locationInfo").style.borderColor = "#DF3131";
        if ($w("#locationInfoCustom").id) $w("#locationInfoCustom").style.borderColor = "#DF3131";
    } else {
        if ($w("#locationInfo").id) $w("#locationInfo").style.borderColor = "#000000";
        if ($w("#locationInfoCustom").id) $w("#locationInfoCustom").style.borderColor = "#000000";
    }

    lastValidationDiagnostics = {
        itemId: item?._id,
        isValid,
        missingFields,
        vehicleId: item?.vehicleId,
        contactId: item?.contactId,
        locationId: item?.locationId
    };

    if (!isValid) {
        logger.warn(`validateCurrentItem -> Item ${item?._id} missing fields: ${missingFields.join(", ")}`);
        showErrorMessage(`Please select: ${missingFields.join(", ")}`); 
    }

    return isValid;
}

export function validateCurrentVehicleUniqueness(itemsToEdit, currentEditIndex, $w) {
    if (currentEditIndex === 0) return true; 
    
    let currentVId = itemsToEdit[currentEditIndex].vehicleId;
    
    for (let i = 0; i < currentEditIndex; i++) {
        if (itemsToEdit[i].vehicleId === currentVId && currentVId !== "NONE") {
            logger.warn(`validateCurrentVehicleUniqueness -> Duplicate vehicle ${currentVId} on index ${currentEditIndex}`);
            showErrorMessage(`This vehicle is already assigned to detail #${i + 1}.`); 
            return false;
        }
    }
    return true;
}

export function validateAllUniqueVehicles(itemsToEdit, $w) {
    let usedVehicles = [];
    for (let i = 0; i < itemsToEdit.length; i++) {
        let vId = itemsToEdit[i].vehicleId;
        if (usedVehicles.includes(vId)) {
            logger.warn(`validateAllUniqueVehicles -> Duplicate vehicle ${vId} across batch`);
            showErrorMessage("Each detail must be assigned to a unique vehicle."); 
            return false;
        }
        usedVehicles.push(vId);
    }
    return true;
}

// ==========================================
// ✨ UI POLISH ENGINES
// ==========================================
export function initCartHoverEffects($w) {
    const hoverGroups = [
        { boxId: "#changeVehicle", textId: "#changeVehicleText" },
        { boxId: "#contactInfo", textId: "#contactInfoText" },
        { boxId: "#locationInfo", textId: "#locationInfoText" }
    ];

    hoverGroups.forEach(group => {
        if ($w(group.boxId).id) {
            $w(group.boxId).onMouseIn(() => {
                $w(group.boxId).style.borderWidth = "3px"; 
                if ($w(group.textId).id) {
                    let plainText = $w(group.textId).text; 
                    $w(group.textId).html = `<h3 class="wixui-rich-text__text" style="color: #FFFFFF;">${plainText}</h3>`;
                }
            });
            
            $w(group.boxId).onMouseOut(() => {
                $w(group.boxId).style.borderWidth = "1px"; 
                if ($w(group.textId).id) {
                    let plainText = $w(group.textId).text; 
                    $w(group.textId).html = `<h3 class="wixui-rich-text__text" style="color: #000000;">${plainText}</h3>`;
                }
            });
        }
    });

    const textElements = ["#contactText", "#locationText"];
    textElements.forEach(id => {
        if ($w(id).id) {
            $w(id).onMouseIn(() => {
                let plainText = $w(id).text; 
                $w(id).html = `<h3 class="wixui-rich-text__text" style="color: #FFFFFF;">${plainText}</h3>`;
            });
            $w(id).onMouseOut(() => {
                let plainText = $w(id).text; 
                $w(id).html = `<h3 class="wixui-rich-text__text" style="color: #000000;">${plainText}</h3>`;
            });
        }
    });

    if ($w("#selectDetailer").id) {
        $w("#selectDetailer").onMouseIn(() => {
            $w("#selectDetailer").style.borderColor = "#FFFFFF"; 
        });
        $w("#selectDetailer").onMouseOut(() => {
            $w("#selectDetailer").style.borderColor = "#000000"; 
        });
    }
}

export function initLightboxTitleEngine($w) {
    if ($w("#msbLightboxG").id) {
        $w("#msbLightboxG").onChange((event) => {
            let newState = event.target.currentState.id;
            let newTitle = "";
            
            switch(newState) {
                case "cartEditsLightboxState": newTitle = "Edit Location Information"; break; 
                case "registryProfileState": newTitle = "Member Registration"; break;
                case "summaryLightboxState": newTitle = "Detail Package Summary"; break;
                case "addVehicleLightboxState": newTitle = "Add a Vehicle"; break;
            }
            
            if (newTitle && $w("#titleLBG").id) $w("#titleLBG").text = newTitle;
            else if (newTitle && $w("#titleLB").id) $w("#titleLB").text = newTitle;
        });
    }
}

export function initAutoCaps($w) {
    const autoCapFields = ["#regFirstNameG", "#regLastNameG", "#regCityG"];
    autoCapFields.forEach(id => {
        if ($w(id).id) {
            $w(id).onBlur((event) => {
                let val = event.target.value;
                if (val) {
                    let capitalized = val.split(' ').map(word => {
                        if (word.length === 0) return '';
                        return word.charAt(0).toUpperCase() + word.slice(1);
                    }).join(' ');
                    $w(id).value = capitalized;
                }
            });
        }
    });
}