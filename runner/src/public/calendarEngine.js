//   public/calendarEngine.js

import realtime from 'wix-realtime-frontend';
import wixWindowFrontend from 'wix-window-frontend';
import { getOrdinalSuffix, getDetailerTimeOff, formatPhoneNumber } from 'public/cartEngine';
import { getActiveUserId } from 'public/authEngine';
import wixData from 'wix-data';
import { session } from 'wix-storage';
import { registerRepeater, smartSyncRepeater } from 'public/repeaterEngine'; 
import { APP_LOGS } from 'public/loggerConfig';
import { scheduleDetailingJob, broadcastCalendarUpdate } from 'backend/calendar-dispatcher.web';
import { currentMember } from 'wix-members-frontend';
import { sendMasterTransactionalEmail } from 'backend/emailDispatchEngine.jsw';
import { syncDetailJobs } from 'public/fileDetailInfo.js';
import { closeAllOverlays } from 'public/routerEngine';
import { findMatchingServicePackage } from 'public/packageMatcher';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

let $w;
let hooks;

// 📅 STATE MANAGEMENT
export let selectedCalendarDate = null;  
let currentMonthView = new Date();       
let activeCalendarItemId = null;         
let calendarDetailerFilter = null;
let globalTimeSlots = [];
let inactivityTimer;
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
let masterCalendarQueue = [];
let currentUserId = null;

// 🎨 SVG ASSETS FOR QUEUE INDICATOR
const CIRCLE_RED = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#A71111"/></svg>`;
const CIRCLE_TEAL = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#30FFD6"/></svg>`;

const DEBUG_MODE = APP_LOGS.MASTER_SWITCH && APP_LOGS.CALENDAR;
const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [CALENDAR_ENGINE]: ${msg}`, data) : console.log(`📌 [CALENDAR_ENGINE]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [CALENDAR_ENGINE]: ${msg}`, data) : console.warn(`📌 [CALENDAR_ENGINE]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [CALENDAR_ENGINE]: ${msg}`, data) : console.error(`📌 [CALENDAR_ENGINE]: ${msg}`); }
};

registerModuleState("calendarEngine", () => ({
    selectedCalendarDate,
    currentMonthView: currentMonthView ? currentMonthView.toDateString() : null,
    activeCalendarItemId,
    calendarDetailerFilter,
    reschedulingJobId: session.getItem("reschedulingJobId") || null,
    globalTimeSlotsCount: (globalTimeSlots || []).length,
    masterCalendarQueueCount: (masterCalendarQueue || []).length,
    masterCalendarQueueSummary: (masterCalendarQueue || []).map(item => ({
        _id: item._id,
        packageTitle: item.packageTitle,
        vehicleId: item.vehicleId,
        assignedDate: item.assignedDate,
        assignedTime: item.assignedTime,
        assignedTimeToken: item.assignedTimeToken,
        assignedDetailerId: item.assignedDetailerId,
        assignedSlotText: item.assignedSlotText
    })),
    hasLoadedFallbacks,
    fallbackDetailersCount: (fallbackDetailers || []).length,
    fallbackRulesCount: (fallbackRules || []).length,
    fallbackJobsCount: (fallbackJobs || []).length
}));

registerDomElements({
    repeaters: ["#repDropboxDetailer", "#calendarMonthRep", "#calendarRep", "#repDaily", "#confirmationRep"]
});

if (DEBUG_MODE) console.log("%c📅 [CALENDAR ENGINE] DEBUG MODE IS ACTIVE", "background: #000; color: #E031FF; font-size: 14px; font-weight: bold; padding: 4px;");

// ==========================================
// 🛡️ FALLBACK CACHE SYSTEM
// ==========================================
let fallbackDetailers = [];
let fallbackRules = [];
let fallbackJobs = [];
let hasLoadedFallbacks = false;

async function ensureGlobalsLoaded() {
    let masterDetailers = hooks.getGlobalDetailers ? hooks.getGlobalDetailers() : [];
    if (masterDetailers.length > 0) return; // Master page has data
    if (hasLoadedFallbacks) return; // We already loaded our own

    console.log("🛡️ [CALENDAR ENGINE]: Master globals missing. Fetching Fallback Data...");
    try {
        let todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        let [dRes, rRes, jRes] = await Promise.all([
            wixData.query("contractors").eq("isActiveDetailer", true).find(),
            wixData.query("availabilityRules").find(),
            wixData.query("scheduledJobs").ne("status", "Cancelled").ge("serviceDate", todayStart).limit(1000).find()
        ]);
        fallbackDetailers = dRes.items;
        fallbackRules = rRes.items;
        fallbackJobs = jRes.items;
        hasLoadedFallbacks = true;
    } catch(e) {
        console.error("Fallback fetch failed", e);
    }
}

function getSafeDetailers() {
    let d = hooks.getGlobalDetailers ? hooks.getGlobalDetailers() : [];
    return d.length > 0 ? d : fallbackDetailers;
}
function getSafeRules() {
    let r = hooks.getGlobalRules ? hooks.getGlobalRules() : [];
    return r.length > 0 ? r : fallbackRules;
}
function getSafeJobs() {
    let j = hooks.getGlobalJobs ? hooks.getGlobalJobs() : [];
    return j.length > 0 ? j : fallbackJobs;
}

// ⚡ THE BROWSER CACHE ENGINE
async function fetchCachedTimeSlots() {
    if (globalTimeSlots.length > 0) return globalTimeSlots;
    let cachedSlots = session.getItem("cachedCalendarSlots");
    if (cachedSlots) { globalTimeSlots = JSON.parse(cachedSlots); return; }
    let res = await wixData.query("calendarTimeSlots").ascending("expectedHour").find();
    globalTimeSlots = res.items;
    session.setItem("cachedCalendarSlots", JSON.stringify(globalTimeSlots));
}

const RADIO_UNSELECTED = "https://static.wixstatic.com/shapes/694137_1602bde3fd0e4741a3119c599614fb9a.svg";
const RADIO_SELECTED = "https://static.wixstatic.com/shapes/694137_c50600f9788e4f04a98d38d0e9af9e4b.svg";

export function initDetailerDropdown($w) {
    const syncDetailerRadioUI = () => {
        if (!$w("#repDropboxDetailer").id) return;
        let activeFilter = calendarDetailerFilter || "ANY";
        $w("#repDropboxDetailer").forEachItem(($item, itemData) => {
            if ($item("#repDropboxDetailerClick").type) {
                $item("#repDropboxDetailerClick").src = (itemData.trueId === activeFilter) ? RADIO_SELECTED : RADIO_UNSELECTED;
            }
        });
    };

    if ($w("#requestDetailerButton").id) {
        $w("#requestDetailerButton").onClick(() => { 
            syncDetailerRadioUI();
            if (hooks && hooks.smartGoTo) hooks.smartGoTo("detailerDropboxPromptsState"); 
        });
    }

    if ($w("#repDropboxDetailer").id) {
        wixData.query("contractors").eq("isActiveDetailer", true).ascending("first").find()
            .then((res) => {
                let repData = [{ _id: "det_any", trueId: "ANY", first: "Any Available" }];
                let detailers = res.items.map((item) => ({ _id: "det_" + item._id, trueId: item._id, first: item.first || "Unknown Detailer" }));
                repData.push(...detailers);
                smartSyncRepeater($w, "#repDropboxDetailer", repData); 
            }).catch(err => { logger.error("🚨 Loading detailers error:", err); });

        registerRepeater($w, "#repDropboxDetailer", ($item, itemData) => {
            if ($item("#repDropboxDetailerText").type) $item("#repDropboxDetailerText").text = itemData.first;
            let activeFilter = calendarDetailerFilter || "ANY";
            if ($item("#repDropboxDetailerClick").type) {
                $item("#repDropboxDetailerClick").src = (itemData.trueId === activeFilter) ? RADIO_SELECTED : RADIO_UNSELECTED;
            }
        });
        
        const executeSelection = async (event) => {
            let itemData = $w("#repDropboxDetailer").data.find(d => d._id === event.context.itemId);
            if (!itemData) return;
            
            if ($w("#requestDetailerButton").id) $w("#requestDetailerButton").label = itemData.first;
            calendarDetailerFilter = itemData.trueId === "ANY" ? null : itemData.trueId;
            
            // 1. Immediately update the radio button image (#repDropboxDetailerClick)
            syncDetailerRadioUI();

            // 2. Immediately close #msbPrompts, #lightboxBoxG, and #lightboxBackground!
            closeAllOverlays($w, true);

            // 3. Refresh the calendar slots and month grid for the chosen detailer
            await loadDailyDetailers();
            await generateMonthGrid(); 
        };

        if ($w("#repDropboxDetailerButton").id) {
            $w("#repDropboxDetailerButton").onClick(executeSelection);
        }

        if ($w("#repDropboxDetailerClick").id) $w("#repDropboxDetailerClick").onClick(executeSelection);
    } 
}

// ==========================================
// 🚀 INITIALIZATION
// ==========================================
export function initCalendarEngine(wixContext, providedHooks) {
    logger.info("Initializing Guided Calendar Engine...");
    $w = wixContext; hooks = providedHooks;
    
    let tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    selectedCalendarDate = tomorrow.toDateString();
    
    currentMonthView = new Date(tomorrow);
    currentMonthView.setDate(1); 
    
    if ($w("#calendarInfoText").id) {
        let isMobile = wixWindowFrontend.formFactor !== "Desktop";
        $w("#calendarInfoText").text = isMobile 
            ? "Swipe to view your packages. Select a date and time for each item, then click Next." 
            : "Select a package from the list, choose an available date and arrival time. Review your selections below before confirming.";
    }

    initMonthlyGridUI();
    initCalendarQueue();
    initDailyRepeater();
    initActionButtons();
    initCalendarNavigation(); 
    initConfirmationRepeater(); 
    initConfirmationUI();
    
    const channel = { name: "CalendarSync" };
    realtime.subscribe(channel, async () => {
        if (hooks.loadCartData) await hooks.loadCartData(); 
        setTimeout(() => { loadDailyDetailers(); }, 50);
    }).catch(rtErr => {});
}

function getActiveCalendarQueue() {
    let rescheduleId = session.getItem("reschedulingJobId");
    if (rescheduleId || (masterCalendarQueue && masterCalendarQueue.length > 0)) {
        return masterCalendarQueue;
    }
    let liveCart = hooks && hooks.getCartData ? hooks.getCartData() : [];
    let sessionSelectedRaw = session.getItem("checkout_selectedIds");
    if (sessionSelectedRaw) {
        try {
            let parsedIds = JSON.parse(sessionSelectedRaw);
            if (Array.isArray(parsedIds) && parsedIds.length > 0) {
                let filtered = liveCart.filter(c => parsedIds.includes(c._id));
                if (filtered.length > 0) return filtered;
            }
        } catch (e) {}
    }
    let selectedIds = (hooks && hooks.getSelectedCartItemIds) ? hooks.getSelectedCartItemIds() : [];
    if (selectedIds && selectedIds.length > 0) {
        let filtered = liveCart.filter(c => selectedIds.includes(c._id));
        if (filtered.length > 0) return filtered;
    }
    return liveCart;
}

export function updateCalendarQueueText() {
    let activeQueue = getActiveCalendarQueue();
    if (!activeQueue || activeQueue.length === 0) return;
    
    let currentIndex = activeQueue.findIndex(c => String(c.originalId || c._id) === String(activeCalendarItemId));
    if (currentIndex === -1) currentIndex = 0; 
    
    if ($w("#calendarQueueText").id) {
        $w("#calendarQueueText").text = `Scheduling ${currentIndex + 1} of ${activeQueue.length}`;
        if ($w("#calendarQueueText").hidden) $w("#calendarQueueText").show();
    }

    if ($w("#confirmBookingSelectionButton").id) {
        if (currentIndex < activeQueue.length - 1) {
            $w("#confirmBookingSelectionButton").label = "Next";
        } else {
            $w("#confirmBookingSelectionButton").label = "Submit";
        }
    }
}

export async function releaseHeldTimeSlots() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    let liveCart = hooks && hooks.getCartData ? hooks.getCartData() : [];
    let changed = false;
    
    for (let item of liveCart) {
        if (item.assignedSlotText || item.assignedDate || item.assignedTimeToken) {
            item.assignedDate = null;
            item.assignedTime = null;
            item.assignedTimeToken = null;
            item.assignedDetailerId = null;
            item.assignedSlotText = null;
            item.slotHeldAt = null;
            changed = true;
            
            await wixData.update("temporaryData", item).catch(e => logger.error("Slot release failed", e));
        }
    }
    
    if (changed) {
        if (hooks && hooks.loadCartData) await hooks.loadCartData();
        await loadDailyDetailers();
        syncCalendarQueueRepeater(hooks.getCartData());
    }
}

export async function clearExpiredCartSlots() {
    let liveCart = hooks && hooks.getCartData ? hooks.getCartData() : [];
    let now = Date.now();
    let expiredFound = false;

    for (let item of liveCart) {
        if (item.assignedSlotText) {
            let heldTime = Number(item.slotHeldAt || session.getItem("slotHeldAt_" + item._id) || 0);
            if (!heldTime) {
                // First time seeing this active slot—stamp the start time now!
                session.setItem("slotHeldAt_" + item._id, String(now));
            } else if (now - heldTime > IDLE_TIMEOUT_MS) {
                // Slot has been sitting idle for over 10 minutes—detach it!
                item.assignedDate = null;
                item.assignedTime = null;
                item.assignedTimeToken = null;
                item.assignedDetailerId = null;
                item.assignedSlotText = null;
                session.removeItem("slotHeldAt_" + item._id);
                expiredFound = true;
                await wixData.update("temporaryData", item).catch(() => {});
            }
        } else if (item._id) {
            session.removeItem("slotHeldAt_" + item._id);
        }
    }

    if (expiredFound && hooks && hooks.loadCartData) {
        await hooks.loadCartData();
    }
}

export function resetIdleTimer() {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    
    inactivityTimer = setTimeout(async () => {
        logger.info("User idle timeout reached. Releasing time slots.");
        if (hooks && hooks.showErrorMessage) hooks.showErrorMessage("Your reserved time slots have expired due to inactivity.");
        
        await releaseHeldTimeSlots();
    }, IDLE_TIMEOUT_MS);
}

function isDayFullyBooked(dateObj) {
    let sYear = dateObj.getFullYear(); 
    let sMonth = dateObj.getMonth(); 
    let sDate = dateObj.getDate();

    let rescheduleId = session.getItem("reschedulingJobId"); 

    // 💥 FIX: Use getSafeJobs()
    let jobsOnThisDay = getSafeJobs().filter(job => {
        if (!job.serviceDate) return false; 
        if (rescheduleId && String(job._id) === String(rescheduleId)) return false; 

        let jDate = new Date(job.serviceDate);
        return (jDate.getFullYear() === sYear && jDate.getMonth() === sMonth && jDate.getDate() === sDate) || 
               (jDate.getUTCFullYear() === sYear && jDate.getUTCMonth() === sMonth && jDate.getUTCDate() === sDate);
    });

    // 💥 FIX: Use getSafeDetailers()
    let detailers = getSafeDetailers();
    if (!detailers || detailers.length === 0) return false; 
    
    if (calendarDetailerFilter) {
        detailers = detailers.filter(d => d._id === calendarDetailerFilter);
    }

    let isAvailable = false;

    // 💥 MISSING LOOP RESTORED: We have to check each detailer!
    for (let detailer of detailers) {
        // 💥 FIX: Use getSafeRules()
        let timeOff = getDetailerTimeOff(detailer._id, dateObj, getSafeRules());
        if (timeOff.isFullDayOff) continue;
        
        for (let i = 0; i < globalTimeSlots.length; i++) {
            let slot = globalTimeSlots[i];
            let slotJobs = jobsOnThisDay.filter(j => j.detailerId === detailer._id && j.timeToken === slot.token);
            let isBooked = slotJobs.length > 0;

            // 💥 NEW: Identify the 3rd Slot and apply the Override Math
            let isThirdSlot = (i === 2); 
            let isOff = (
                isThirdSlot || // Forces the 3rd slot to be blocked by default
                timeOff.blockedTokens.includes(slot.token) || 
                (timeOff.blockedTokens.includes("AM") && slot.expectedHour < 12) || 
                (timeOff.blockedTokens.includes("PM") && slot.expectedHour >= 12)
            ) && !timeOff.openedTokens.includes(slot.token); // The magic unlock key!
            
            if (!isBooked && !isOff) {
                isAvailable = true; 
                break;
            }
        }
        if (isAvailable) break; 
    }

    return !isAvailable; 
}

async function generateMonthGrid() {
    await fetchCachedTimeSlots(); 
    await ensureGlobalsLoaded(); // 💥 FIX: Pre-load missing data!

    let year = currentMonthView.getFullYear();
    let month = currentMonthView.getMonth();
    
    if ($w("#calendarMonthTitle").id) {
        let monthName = currentMonthView.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        $w("#calendarMonthTitle").text = monthName.toUpperCase();
    }

    let firstDayOfMonth = new Date(year, month, 1);
    let startOffset = firstDayOfMonth.getDay(); 
    
    let gridStartDate = new Date(firstDayOfMonth);
    gridStartDate.setDate(firstDayOfMonth.getDate() - startOffset); 

    let today = new Date();
    today.setHours(23, 59, 59, 999); 

    let daysInMonth = new Date(year, month + 1, 0).getDate();
    let totalCellsNeeded = startOffset + daysInMonth;
    let totalGridSize = Math.ceil(totalCellsNeeded / 7) * 7; 

    let gridData = [];
    for (let i = 0; i < totalGridSize; i++) {
        let loopDate = new Date(gridStartDate);
        loopDate.setDate(gridStartDate.getDate() + i);
        
        let isCurrentMonth = loopDate.getMonth() === month;
        let isPast = loopDate <= today; 
        let isFullyBooked = false;

        if (isCurrentMonth && !isPast) {
            isFullyBooked = isDayFullyBooked(loopDate);
        }

        gridData.push({
            _id: "day_" + loopDate.getTime(),
            dateObj: loopDate,
            dateStr: loopDate.toDateString(),
            dateNum: loopDate.getDate().toString(),
            isCurrentMonth: isCurrentMonth,
            isPast: isPast,
            isFullyBooked: isFullyBooked 
        });
    }

    smartSyncRepeater($w, "#calendarMonthRep", gridData);
}

function changeMonthView(offset) {
    let newMonth = new Date(currentMonthView);
    newMonth.setMonth(newMonth.getMonth() + offset);
    currentMonthView = newMonth;
    generateMonthGrid();
}

function initCalendarNavigation() {
    if ($w("#calendarMonthPrevButton01").id) $w("#calendarMonthPrevButton01").onClick(() => changeMonthView(-1));
    if ($w("#calendarMonthNextButton01").id) $w("#calendarMonthNextButton01").onClick(() => changeMonthView(1));
    if ($w("#calendarMonthPrevButton02").id) $w("#calendarMonthPrevButton02").onClick(() => changeMonthView(-1));
    if ($w("#calendarMonthNextButton02").id) $w("#calendarMonthNextButton02").onClick(() => changeMonthView(1));

    if ($w("#calendarDayPrevButton01").id) $w("#calendarDayPrevButton01").onClick(() => changeSelectedDay(-1));
    if ($w("#calendarDayNextButton01").id) $w("#calendarDayNextButton01").onClick(() => changeSelectedDay(1));
}

function updateCalendarDayTitle() {
    if ($w("#calendarDayTitle").id && selectedCalendarDate) {
        let d = new Date(selectedCalendarDate);
        let dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
        let dateNum = d.getDate();
        let suffix = getOrdinalSuffix(dateNum); 
        
        $w("#calendarDayTitle").text = `${dayName} ${suffix}`;
    }
}

function repaintMonthGridBorders() {
    if ($w("#calendarMonthRep").id) {
        $w("#calendarMonthRep").forEachItem(($item, iterData) => {
            if (!iterData.isCurrentMonth) return;

            let isSelected = selectedCalendarDate === iterData.dateStr;
            let highlightColor = "#30FFD6";
            let dimColor = "#FFFFFF"; 
            let availableBorder = "#000000";
            let defaultText = "#000000";
            let selectedText = "#000000";

            if (iterData.isPast || iterData.isFullyBooked) {
                if ($item("#calendarMonthDate").type) $item("#calendarMonthDate").style.color = dimColor; 
                if (isSelected) {
                    if ($item("#calendarMonthBox").type) $item("#calendarMonthBox").style.borderColor = highlightColor; 
                    if ($item("#calendarOverlayBox").type) {
                        $item("#calendarOverlayBox").collapse().then(() => { $item("#calendarOverlayBox").expand(); });
                    }
                } else {
                    if ($item("#calendarMonthBox").type) $item("#calendarMonthBox").style.borderColor = dimColor; 
                    if ($item("#calendarOverlayBox").type) $item("#calendarOverlayBox").collapse(); 
                }
            } else {
                if (isSelected) {
                    if ($item("#calendarMonthDate").type) $item("#calendarMonthDate").style.color = selectedText;
                    if ($item("#calendarMonthBox").type) $item("#calendarMonthBox").style.borderColor = highlightColor;
                    if ($item("#calendarOverlayBox").type) {
                        $item("#calendarOverlayBox").collapse().then(() => { $item("#calendarOverlayBox").expand(); });
                    }
                } else {
                    if ($item("#calendarMonthDate").type) $item("#calendarMonthDate").style.color = defaultText;
                    if ($item("#calendarMonthBox").type) $item("#calendarMonthBox").style.borderColor = availableBorder;
                    if ($item("#calendarOverlayBox").type) $item("#calendarOverlayBox").collapse(); 
                }
            }
        });
    }
}

async function changeSelectedDay(offset) {
    if (!selectedCalendarDate) return;
    
    let d = new Date(selectedCalendarDate);
    d.setDate(d.getDate() + offset);
    
    selectedCalendarDate = d.toDateString();
    
    if (d.getMonth() !== currentMonthView.getMonth()) {
        currentMonthView = new Date(d);
        currentMonthView.setDate(1);
        await generateMonthGrid(); 
    } else {
        repaintMonthGridBorders(); 
    }
    
    updateCalendarDayTitle();
    await loadDailyDetailers();
}

function initMonthlyGridUI() {
    registerRepeater($w, "#calendarMonthRep", ($item, itemData) => {
        if ($item("#calendarMonthDate").type) $item("#calendarMonthDate").text = itemData.dateNum;
        
        let isSelected = selectedCalendarDate === itemData.dateStr;
        let highlightColor = "#30FFD6";
        let dimColor = "#FFFFFF"; 
        let dimBackground = "rgba(255, 255, 255, 0.38)"; 
        let clearBackground = "#FFFFFF"; 
        let availableBorder = "#000000";
        let defaultText = "#000000";
        let selectedText = "#000000";

        if (!itemData.isCurrentMonth) {
            if ($item("#calendarMonthBox").type) $item("#calendarMonthBox").collapse();
            if ($item("#calendarMonthDate").type) $item("#calendarMonthDate").collapse();
            if ($item("#calendarMonthButton").type) $item("#calendarMonthButton").collapse();
            if ($item("#calendarOverlayBox").type) $item("#calendarOverlayBox").collapse(); 
        } else {
            if ($item("#calendarMonthBox").type) $item("#calendarMonthBox").expand();
            if ($item("#calendarMonthDate").type) $item("#calendarMonthDate").expand();
            if ($item("#calendarMonthButton").type) $item("#calendarMonthButton").expand();
            if ($item("#calendarMonthButton").type) $item("#calendarMonthButton").enable();

            if (itemData.isPast || itemData.isFullyBooked) {
                if ($item("#calendarMonthDate").type) $item("#calendarMonthDate").style.color = dimColor;
                if ($item("#calendarMonthBox").type) $item("#calendarMonthBox").style.backgroundColor = dimBackground;
                
                if (isSelected) {
                    if ($item("#calendarMonthBox").type) $item("#calendarMonthBox").style.borderColor = highlightColor;
                    if ($item("#calendarOverlayBox").type) $item("#calendarOverlayBox").expand(); 
                } else {
                    if ($item("#calendarMonthBox").type) $item("#calendarMonthBox").style.borderColor = dimColor;
                    if ($item("#calendarOverlayBox").type) $item("#calendarOverlayBox").collapse(); 
                }
            } else {
                if ($item("#calendarMonthBox").type) $item("#calendarMonthBox").style.backgroundColor = clearBackground; 
                
                if (isSelected) {
                    if ($item("#calendarMonthDate").type) $item("#calendarMonthDate").style.color = selectedText;
                    if ($item("#calendarMonthBox").type) $item("#calendarMonthBox").style.borderColor = highlightColor;
                    if ($item("#calendarOverlayBox").type) $item("#calendarOverlayBox").expand(); 
                } else {
                    if ($item("#calendarMonthDate").type) $item("#calendarMonthDate").style.color = defaultText;
                    if ($item("#calendarMonthBox").type) $item("#calendarMonthBox").style.borderColor = availableBorder;
                    if ($item("#calendarOverlayBox").type) $item("#calendarOverlayBox").collapse(); 
                }
            }
        }
    });

    if ($w("#calendarMonthButton").id) {
        $w("#calendarMonthButton").onClick(async (event) => {
            let repData = $w("#calendarMonthRep").data;
            let itemData = repData.find(d => d._id === event.context.itemId);
            
            if (itemData && itemData.isCurrentMonth) {
                selectedCalendarDate = itemData.dateStr;

                $w("#calendarMonthRep").forEachItem(($i, iData) => {
                    if (!iData.isCurrentMonth) return;

                    let isThisDaySelected = selectedCalendarDate === iData.dateStr;
                    let highlightColor = "#30FFD6";
                    let dimColor = "#FFFFFF"; 
                    let dimBackground = "rgba(255, 255, 255, 0.38)"; 
                    let clearBackground = "#FFFFFF"; 
                    let availableBorder = "#000000";
                    let defaultText = "#000000";
                    let selectedText = "#000000";

                    if (iData.isPast || iData.isFullyBooked) {
                        if ($i("#calendarMonthDate").type) $i("#calendarMonthDate").style.color = dimColor; 
                        if ($i("#calendarMonthBox").type) $i("#calendarMonthBox").style.backgroundColor = dimBackground;
                        
                        if (isThisDaySelected) {
                            if ($i("#calendarMonthBox").type) $i("#calendarMonthBox").style.borderColor = highlightColor; 
                            if ($i("#calendarOverlayBox").type) $i("#calendarOverlayBox").expand(); 
                        } else {
                            if ($i("#calendarMonthBox").type) $i("#calendarMonthBox").style.borderColor = dimColor; 
                            if ($i("#calendarOverlayBox").type) $i("#calendarOverlayBox").collapse(); 
                        }
                    } else {
                        if ($i("#calendarMonthBox").type) $i("#calendarMonthBox").style.backgroundColor = clearBackground;
                        
                        if (isThisDaySelected) {
                            if ($i("#calendarMonthDate").type) $i("#calendarMonthDate").style.color = selectedText;
                            if ($i("#calendarMonthBox").type) $i("#calendarMonthBox").style.borderColor = highlightColor;
                            if ($i("#calendarOverlayBox").type) $i("#calendarOverlayBox").expand(); 
                        } else {
                            if ($i("#calendarMonthDate").type) $i("#calendarMonthDate").style.color = defaultText;
                            if ($i("#calendarMonthBox").type) $i("#calendarMonthBox").style.borderColor = availableBorder;
                            if ($i("#calendarOverlayBox").type) $i("#calendarOverlayBox").collapse(); 
                        }
                    }
                });

                updateCalendarDayTitle();
                await loadDailyDetailers();
            }
        });
    }
}

function initCalendarQueue() {
    registerRepeater($w, "#calendarRep", ($item, itemData) => {
        if ($item("#calendarItemTitle").type) $item("#calendarItemTitle").text = itemData.packageTitle || "Detailing Package";
        if ($item("#calendarItemPrice").type) $item("#calendarItemPrice").text = `$${Number(itemData.totalPrice || 0).toFixed(2)}`;
        if ($item("#calendarTime").type) $item("#calendarTime").text = `Duration: ${itemData.setDuration || "--"} hrs`;
        if ($item("#calendarImage").type && itemData.packageImage) $item("#calendarImage").src = itemData.packageImage;
        
        let intCount = Array.isArray(itemData.interiorAddOns) ? itemData.interiorAddOns.length : 0;
        let extCount = Array.isArray(itemData.exteriorAddOns) ? itemData.exteriorAddOns.length : 0;
        if ($item("#calendarAddons").type) $item("#calendarAddons").text = `Add-Ons (${intCount + extCount})`;
        
        let isSub = (itemData.discountsApplied || []).some(d => d.includes("Car Club")) ? "Subscription" : "Non-subscription";
        if ($item("#calendarIsSubscription").type) $item("#calendarIsSubscription").text = isSub;
        
        let globalVehicles = hooks.getGlobalVehicles ? hooks.getGlobalVehicles() : [];
        let selVeh = globalVehicles.find(v => String(v._id) === String(itemData.vehicleId));
        let vehText = selVeh ? `${selVeh.year || ''} ${selVeh.make || ''} ${selVeh.model || ''}`.trim() : "Unknown Vehicle";
        if ($item("#calendarVehicleInfo").type) $item("#calendarVehicleInfo").text = vehText;

        let globalContacts = hooks.getGlobalContacts ? hooks.getGlobalContacts() : [];
        let globalLocations = hooks.getGlobalLocations ? hooks.getGlobalLocations() : [];

        let cId = itemData.contactId || itemData.assignedContactId; 
        let selCon = globalContacts.find(c => String(c._id) === String(cId));
        if ($item("#calendarItemContactInfo").type) {
            if (selCon) {
                let phoneTxt = selCon.phone ? formatPhoneNumber(selCon.phone) : "";
                $item("#calendarItemContactInfo").text = `${selCon.firstName || ''} ${selCon.lastName || ''} ${phoneTxt ? '- ' + phoneTxt : ''}`.trim();
            } else {
                $item("#calendarItemContactInfo").text = "No contact assigned";
            }
        }

        let lId = itemData.locationId || itemData.assignedLocationId;
        let selLoc = globalLocations.find(l => String(l._id) === String(lId));
        if ($item("#calendarItemLocationInfo").type) {
            if (selLoc) {
                $item("#calendarItemLocationInfo").text = `${selLoc.address1 || ''}, ${selLoc.city || ''} ${selLoc.zip || ''}`.trim();
            } else {
                $item("#calendarItemLocationInfo").text = "No location assigned";
            }
        }

        let trueId = itemData.originalId || itemData._id;
        let isSelected = trueId === activeCalendarItemId;
        let hasBooking = !!itemData.assignedSlotText;

        wixWindowFrontend.getBoundingRect().then((windowInfo) => {
            let isDesktop = windowInfo.window.width > 1200; 
            let activeBorderColor = isDesktop ? "#30FFD6" : "#FFFFFF";
            
            if ($item("#calendarItemContainer").type) {
                $item("#calendarItemContainer").style.borderColor = isSelected ? activeBorderColor : "#FFFFFF";
                $item("#calendarItemContainer").onClick(() => { setActiveQueueItem(itemData, vehText); });
            }
        });

        if ($item("#calendarItemVector").type) $item("#calendarItemVector").src = hasBooking ? CIRCLE_TEAL : CIRCLE_RED;

        if ($item("#calendarItemTime").type) {
            $item("#calendarItemTime").expand(); 
            if (hasBooking) {
                $item("#calendarItemTime").text = itemData.assignedSlotText;
                $item("#calendarItemTime").style.color = "#30FFD6"; 
            } else {
                $item("#calendarItemTime").text = "Select a Time and Date.";
                $item("#calendarItemTime").style.color = "#FFFFFF"; 
            }
        }
    });
}

async function findNextAvailableCalendarDate() {
    await fetchCachedTimeSlots();
    await ensureGlobalsLoaded();

    let tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    for (let i = 0; i < 60; i++) {
        let checkDate = new Date(tomorrow);
        checkDate.setDate(tomorrow.getDate() + i);
        if (!isDayFullyBooked(checkDate)) {
            return checkDate;
        }
    }
    return tomorrow;
}

async function setActiveQueueItem(itemData, fallbackVehText = "Unknown Vehicle", forceUIUpdate = false) {
    let trueId = itemData.originalId || itemData._id;
    if (activeCalendarItemId === trueId && !forceUIUpdate) return; 

    activeCalendarItemId = trueId;

    let activeQueue = getActiveCalendarQueue();
    let currentIndex = activeQueue.findIndex(c => String(c.originalId || c._id) === String(trueId));
    if (currentIndex === -1) currentIndex = 0; 

    // 📅 ALWAYS SNAP TO THE NEXT AVAILABLE DATE (Never get stuck on last viewed date!)
    let nextAvailableDateObj = await findNextAvailableCalendarDate();
    selectedCalendarDate = nextAvailableDateObj.toDateString();
    currentMonthView = new Date(nextAvailableDateObj.getFullYear(), nextAvailableDateObj.getMonth(), 1);

    await generateMonthGrid();
    repaintMonthGridBorders();
    updateCalendarDayTitle();

    if ($w("#previousBookingButton").id) {
        if (currentIndex === 0) {
            $w("#previousBookingButton").hide(); 
        } else {
            $w("#previousBookingButton").show(); 
        }
    }

    if ($w("#calendarVehicleText").id) {
        $w("#calendarVehicleText").expand(); 
        let globalVehicles = hooks.getGlobalVehicles ? hooks.getGlobalVehicles() : [];
        let selVeh = globalVehicles.find(v => String(v._id) === String(itemData.vehicleId));
        $w("#calendarVehicleText").text = selVeh ? `${selVeh.year || ''} ${selVeh.make || ''} ${selVeh.model || ''}`.trim() : fallbackVehText;
    }

    if ($w("#calendarRep").id) {
        wixWindowFrontend.getBoundingRect().then((windowInfo) => {
            let isDesktop = windowInfo.window.width > 1200;
            let activeBorderColor = isDesktop ? "#30FFD6" : "#FFFFFF";
            
            $w("#calendarRep").forEachItem(($item, iterData) => {
                let iterTrueId = iterData.originalId || iterData._id;
                let isSelected = iterTrueId === activeCalendarItemId;
                
                if ($item("#calendarItemContainer").type) {
                    $item("#calendarItemContainer").style.borderColor = isSelected ? activeBorderColor : "#FFFFFF";
                }
            });
        });
    }

    updateCalendarQueueText();
    await loadDailyDetailers();
}

export async function syncCalendarQueueRepeater(cartData) {
    await clearExpiredCartSlots();
    resetIdleTimer();
    masterCalendarQueue = [...cartData]; 
    
    // Always reset the calendar view to the Next Available Date when syncing the queue
    let nextAvailableDateObj = await findNextAvailableCalendarDate();
    selectedCalendarDate = nextAvailableDateObj.toDateString();
    currentMonthView = new Date(nextAvailableDateObj.getFullYear(), nextAvailableDateObj.getMonth(), 1);
    updateCalendarDayTitle();

    if ($w("#calendarRep").id) {
        $w("#calendarRep").expand(); 
        
        let checkActive = cartData.find(c => (c.originalId || c._id) === activeCalendarItemId);

        if (!activeCalendarItemId || !checkActive) {
            let firstUnbooked = cartData.find(c => !c.assignedSlotText);
            if (firstUnbooked) await setActiveQueueItem(firstUnbooked, "Unknown Vehicle", true);
            else if (cartData.length > 0) await setActiveQueueItem(cartData[0], "Unknown Vehicle", true); 
        } else {
            await setActiveQueueItem(checkActive, "Unknown Vehicle", true);
        }

        wixWindowFrontend.getBoundingRect().then((windowInfo) => {
            let isMobile = windowInfo.window.width <= 1200;
            
            if (isMobile && activeCalendarItemId) {
                let singleItemArray = cartData.filter(c => (c.originalId || c._id) === activeCalendarItemId);
                smartSyncRepeater($w, "#calendarRep", singleItemArray);
            } else {
                smartSyncRepeater($w, "#calendarRep", cartData);
            }
        });
    } else {
        await generateMonthGrid();
        await loadDailyDetailers();
    }

    updateCalendarQueueText();

    setTimeout(() => {
        repaintMonthGridBorders();
    }, 150);
}

// 💥 FIX: Make loadDailyDetailers async so it can fetch missing data!
async function loadDailyDetailers() {
    if (!selectedCalendarDate) return;

    await ensureGlobalsLoaded(); // 💥 FIX: Pull down fallback detailers if needed

    let d = new Date(selectedCalendarDate);
    let today = new Date();
    today.setHours(0, 0, 0, 0); 
    
    let isPastDay = d <= today; 
    let sYear = d.getFullYear(); 
    let sMonth = d.getMonth(); 
    let sDate = d.getDate();

    let rescheduleId = session.getItem("reschedulingJobId");
    
    // 💥 FIX: Use getSafeJobs()
    let jobsOnThisDay = getSafeJobs().filter(job => {
        if (!job.serviceDate) return false; 
        if (rescheduleId && String(job._id) === String(rescheduleId)) return false; 

        let jDate = new Date(job.serviceDate);
        return (jDate.getFullYear() === sYear && jDate.getMonth() === sMonth && jDate.getDate() === sDate) || 
               (jDate.getUTCFullYear() === sYear && jDate.getUTCMonth() === sMonth && jDate.getUTCDate() === sDate);
    });

    let liveCartData = rescheduleId ? masterCalendarQueue : hooks.getCartData();
    let myCartIds = liveCartData.map(c => String(c.originalId || c._id));

    // 🔒 GLOBAL SLOT LOCK: Check temporaryData across ALL users so no other user can steal a held slot!
    let otherUsersHeldItems = [];
    try {
        let allHoldsRes = await wixData.query("temporaryData").isNotEmpty("assignedTimeToken").find();
        let now = Date.now();
        for (let heldItem of (allHoldsRes.items || [])) {
            // Skip if this item belongs to the current user's own cart
            if (myCartIds.includes(String(heldItem._id))) continue;

            // Check if the other user's hold is still active (updated within the last 10 minutes)
            let lastUpdated = heldItem._updatedDate ? new Date(heldItem._updatedDate).getTime() : now;
            if (now - lastUpdated <= IDLE_TIMEOUT_MS) {
                otherUsersHeldItems.push(heldItem);
            } else {
                // Auto-clean abandoned holds older than 10 minutes so the slot opens back up!
                heldItem.assignedDate = null;
                heldItem.assignedTime = null;
                heldItem.assignedTimeToken = null;
                heldItem.assignedDetailerId = null;
                heldItem.assignedSlotText = null;
                wixData.update("temporaryData", heldItem).catch(() => {});
            }
        }
    } catch (e) {}

    // 💥 FIX: Use getSafeDetailers()
    let detailers = getSafeDetailers();
    if (calendarDetailerFilter) {
        detailers = detailers.filter(d => d._id === calendarDetailerFilter);
    }
    
    console.log(`👨‍🔧 [CALENDAR]: Loading Daily Slots for ${detailers.length} detailers on ${selectedCalendarDate}`);

    let dailyData = detailers.map(detailer => {
        let timeOff = getDetailerTimeOff(detailer._id, d, getSafeRules());

        // 💥 NEW: We added `index` to the map function so we know which slot we are building
        let dynamicSlots = globalTimeSlots.map((slot, index) => {
            let slotJobs = jobsOnThisDay.filter(j => j.detailerId === detailer._id && j.timeToken === slot.token);
            let isBookedByMe = slotJobs.some(j => String(j.userId) === String(currentUserId));
            let isBookedByOther = slotJobs.some(j => String(j.userId) !== String(currentUserId));
            
            let isThirdSlot = (index === 2); 
            let isOff = (
                isThirdSlot || 
                timeOff.isFullDayOff || 
                timeOff.blockedTokens.includes(slot.token) || 
                (timeOff.blockedTokens.includes("AM") && slot.expectedHour < 12) || 
                (timeOff.blockedTokens.includes("PM") && slot.expectedHour >= 12)
            ) && !timeOff.openedTokens.includes(slot.token); 
            
            let holdingCartItem = liveCartData.find(c => c.assignedDetailerId === detailer._id && c.assignedTimeToken === slot.token && c.assignedDate && new Date(c.assignedDate).toDateString() === d.toDateString());
            
            let isHeldByMe = holdingCartItem && (holdingCartItem.originalId || holdingCartItem._id) === activeCalendarItemId;
            let isHeldByOtherCartItem = holdingCartItem && (holdingCartItem.originalId || holdingCartItem._id) !== activeCalendarItemId;

            // 🔒 Check if another user on the site is currently holding this exact slot!
            let isHeldByAnotherCustomer = otherUsersHeldItems.some(h => 
                h.assignedDetailerId === detailer._id && 
                h.assignedTimeToken === slot.token && 
                h.assignedDate && 
                new Date(h.assignedDate).toDateString() === d.toDateString()
            );

            return { 
                token: slot.token, 
                label: slot.label, 
                isBookedByMe, 
                isHeldByMe, 
                isHeldByOtherCartItem, 
                isAvailable: !isPastDay && !isBookedByMe && !isBookedByOther && !isOff && !isHeldByOtherCartItem && !isHeldByAnotherCustomer
            };
        });

        return { 
            _id: String(detailer._id), 
            trueDetailerId: detailer._id, 
            teamAlias: detailer.teamAlias || "Detailer Team",
            dynamicSlots: dynamicSlots,
            _syncTrigger: Date.now() 
        };
    });

    dailyData.sort((a, b) => a.teamAlias.localeCompare(b.teamAlias));
    
    // 💥 FIX 3: Aggressively Force the Repeater to Render!
    if ($w("#repDaily").id) {
        $w("#repDaily").expand();
        $w("#repDaily").show("fade", { duration: 150 });
    }
    
    smartSyncRepeater($w, "#repDaily", dailyData);
}

function initDailyRepeater() {
    registerRepeater($w, "#repDaily", ($item, itemData) => {
        if ($item(`#teamAlias`).type) $item(`#teamAlias`).text = itemData.teamAlias;
        
        for (let i = 1; i <= 3; i++) {
            let btnId = `#btnSlot${i}`;
            let btnSelectedId = `#btnSlotSelected${i}`; 
            
            if (!$item(btnId).type) continue;
            
            let slotDef = itemData.dynamicSlots[i - 1];
            if (!slotDef) { 
                $item(btnId).collapse(); 
                if ($item(btnSelectedId).type) $item(btnSelectedId).collapse();
                continue; 
            }
            
            $item(btnId).expand();
            if ($item(btnSelectedId).type) $item(btnSelectedId).expand();

            if (slotDef.isHeldByMe) {
                $item(btnId).hide();
                if ($item(btnSelectedId).type) {
                    $item(btnSelectedId).label = "Selected";
                    $item(btnSelectedId).show();
                }
            }
            else if (slotDef.isAvailable) {
                if ($item(btnSelectedId).type) $item(btnSelectedId).hide();
                $item(btnId).show();
                $item(btnId).enable();
                $item(btnId).label = slotDef.label;
            } 
            else { 
                if ($item(btnSelectedId).type) $item(btnSelectedId).hide();
                $item(btnId).show();
                $item(btnId).disable();
                
                if (slotDef.isHeldByOtherCartItem) {
                    $item(btnId).label = "Selected";
                } else if (slotDef.isBookedByMe) {
                    $item(btnId).label = "Booked"; 
                } else {
                    $item(btnId).label = "Unavailable";
                }
            }
        }
    });

    for (let i = 1; i <= 3; i++) {
        let btnId = `#btnSlot${i}`;
        let btnSelectedId = `#btnSlotSelected${i}`;

        let clickHandler = async (event) => {
            resetIdleTimer();
            if (!activeCalendarItemId) {
                if (hooks.showErrorMessage) hooks.showErrorMessage("Please select a package to schedule first.");
                return;
            }
            
            let repData = $w("#repDaily").data;
            let itemData = repData.find(d => d._id === event.context.itemId);
            let slotDef = itemData.dynamicSlots[i - 1]; 
            
            if ($w.at(event.context)(btnId).type) { $w.at(event.context)(btnId).disable();$w.at(event.context)(btnId).label = "Applying..."; }
            if ($w.at(event.context)(btnSelectedId).type) {$w.at(event.context)(btnSelectedId).label = "Applying..."; }

            $w("#calendarRep").forEachItem(($item, iterData) => {
                if (iterData._id === activeCalendarItemId) {
                    if ($item("#calendarItemVector").type) $item("#calendarItemVector").src = CIRCLE_TEAL;
                    if ($item("#calendarItemTime").type) {
                        let dObj = new Date(selectedCalendarDate);
                        let mName = dObj.toLocaleDateString('en-US', { month: 'short' });
                        let dNum = dObj.getDate();
                        let yNum = dObj.getFullYear();
                        
                        $item("#calendarItemTime").text = `${mName} ${dNum}, ${yNum} ${slotDef.label} Time`;
                        $item("#calendarItemTime").style.color = "#30FFD6";
                    }
                }
            });

            let rescheduleId = session.getItem("reschedulingJobId");
            if (rescheduleId) {
                let job = masterCalendarQueue.find(j => j._id === activeCalendarItemId);
                if (job) {
                    job.assignedDate = new Date(selectedCalendarDate);
                    job.assignedTime = slotDef.label;
                    job.assignedTimeToken = slotDef.token;
                    job.assignedDetailerId = itemData.trueDetailerId;
                    
                    let dObj = new Date(selectedCalendarDate);
                    job.assignedSlotText = `${dObj.toLocaleDateString('en-US', { month: 'short' })} ${dObj.getDate()}, ${dObj.getFullYear()} ${slotDef.label} Time`;
                }
            } else {
                if (hooks.triggerMissingInfoFlow) {
                    await hooks.triggerMissingInfoFlow(activeCalendarItemId, itemData.trueDetailerId, slotDef.label, selectedCalendarDate, slotDef.token);
                }
            }
            
            setTimeout(async () => { await loadDailyDetailers(); syncCalendarQueueRepeater(rescheduleId ? masterCalendarQueue : hooks.getCartData()); }, 300);
        };

        if ($w(btnId).id) $w(btnId).onClick(clickHandler);
        if ($w(btnSelectedId).id) $w(btnSelectedId).onClick(clickHandler);
    }
}

function initActionButtons() {
    if ($w("#confirmBookingSelectionButton").id) { 
        $w("#confirmBookingSelectionButton").onClick(async () => {
            logger.info("▶️ [NEXT BUTTON] Clicked!");
            
            let activeQueue = getActiveCalendarQueue();
            let unbookedItems = activeQueue.filter(c => !c.assignedSlotText);
            let currentItemIndex = activeQueue.findIndex(c => String(c.originalId || c._id) === String(activeCalendarItemId));
            if (currentItemIndex === -1) currentItemIndex = 0;
            let currentItem = activeQueue[currentItemIndex];

            if (currentItem && !currentItem.assignedSlotText) {
                logger.warn("⚠️ [NEXT] Blocked. Current item has no time slot.");
                if (hooks.showErrorMessage) hooks.showErrorMessage("Please select a time and date for this package first.");
                return;
            }

            let windowInfo = await wixWindowFrontend.getBoundingRect();
            let isDesktop = windowInfo.window.width > 1200;

            if (currentItemIndex < activeQueue.length - 1) {
                let nextItem = activeQueue[currentItemIndex + 1];
                await setActiveQueueItem(nextItem, "Unknown Vehicle", true);

                if (!isDesktop) {
                    wixWindowFrontend.scrollTo(0, 0, { scrollAnimation: true });
                    await $w("#calendarRep").hide("slide", { direction: "left", duration: 250 });
                    let singleItemArray = activeQueue.filter(c => String(c.originalId || c._id) === String(activeCalendarItemId));
                    smartSyncRepeater($w, "#calendarRep", singleItemArray);
                    await $w("#calendarRep").show("slide", { direction: "right", duration: 250 });
                }
            } else {
                if (unbookedItems.length > 0) {
                    await setActiveQueueItem(unbookedItems[0], "Unknown Vehicle", true);
                    if (!isDesktop) {
                        wixWindowFrontend.scrollTo(0, 0, { scrollAnimation: true });
                        await $w("#calendarRep").hide("slide", { direction: "left", duration: 250 });
                        let singleItemArray = activeQueue.filter(c => String(c.originalId || c._id) === String(activeCalendarItemId));
                        smartSyncRepeater($w, "#calendarRep", singleItemArray);
                        await $w("#calendarRep").show("slide", { direction: "right", duration: 250 });
                    }
                    if (hooks.showErrorMessage) hooks.showErrorMessage(`Please schedule the remaining ${unbookedItems.length} package(s).`);
                } else {
                    $w("#confirmBookingSelectionButton").disable();
                    $w("#confirmBookingSelectionButton").label = "Processing...";
    
                    smartSyncRepeater($w, "#confirmationRep", activeQueue);
                    if (hooks.smartGoTo) hooks.smartGoTo("confirmBookingProfileState");
                    setTimeout(() => { 
                        $w("#confirmBookingSelectionButton").enable(); 
                        updateCalendarQueueText();
                    }, 1000);
                }
            }
        });
    }

    if ($w("#previousBookingButton").id) {
        $w("#previousBookingButton").onClick(async () => {
            let activeQueue = getActiveCalendarQueue();
            let currentItemIndex = activeQueue.findIndex(c => String(c.originalId || c._id) === String(activeCalendarItemId));
            
            if (currentItemIndex > 0) {
                let prevItem = activeQueue[currentItemIndex - 1];
                await setActiveQueueItem(prevItem, "Unknown Vehicle", true);
                
                let windowInfo = await wixWindowFrontend.getBoundingRect();
                if (windowInfo.window.width <= 1200) {
                    wixWindowFrontend.scrollTo(0, 0, { scrollAnimation: true });
                    
                    await $w("#calendarRep").hide("slide", { direction: "right", duration: 250 });
                    let singleItemArray = activeQueue.filter(c => String(c.originalId || c._id) === String(activeCalendarItemId));
                    smartSyncRepeater($w, "#calendarRep", singleItemArray);
                    await $w("#calendarRep").show("slide", { direction: "left", duration: 250 });
                }
            }
        });
    }
}

export function initConfirmationRepeater() {
    registerRepeater($w, "#confirmationRep", ($item, itemData) => {
        if ($item("#confirmationItemTitle").type) $item("#confirmationItemTitle").text = itemData.packageTitle || "Detailing Package";
        if ($item("#confirmationItemPrice").type) $item("#confirmationItemPrice").text = `$${Number(itemData.totalPrice || 0).toFixed(2)}`;
        if ($item("#confirmationTime").type) $item("#confirmationTime").text = `Duration: ${itemData.setDuration || "--"} hrs`;
        if ($item("#confirmationImage").type && itemData.packageImage) $item("#confirmationImage").src = itemData.packageImage;
        
        let intCount = Array.isArray(itemData.interiorAddOns) ? itemData.interiorAddOns.length : 0;
        let extCount = Array.isArray(itemData.exteriorAddOns) ? itemData.exteriorAddOns.length : 0;
        if ($item("#confirmationAddons").type) $item("#confirmationAddons").text = `Add-Ons (${intCount + extCount})`;
        
        let isSub = (itemData.discountsApplied || []).some(d => d.includes("Car Club")) ? "Subscription" : "Non-subscription";
        if ($item("#confirmationIsSubscription").type) $item("#confirmationIsSubscription").text = isSub;
        
        let globalVehicles = hooks.getGlobalVehicles ? hooks.getGlobalVehicles() : [];
        let selVeh = globalVehicles.find(v => String(v._id) === String(itemData.vehicleId));
        let vehText = selVeh ? `${selVeh.year || ''} ${selVeh.make || ''} ${selVeh.model || ''}`.trim() : "Unknown Vehicle";
        if ($item("#confirmationVehicleInfo").type) $item("#confirmationVehicleInfo").text = vehText;

        let globalContacts = hooks.getGlobalContacts ? hooks.getGlobalContacts() : [];
        let globalLocations = hooks.getGlobalLocations ? hooks.getGlobalLocations() : [];

        let cId = itemData.contactId || itemData.assignedContactId; 
        let selCon = globalContacts.find(c => String(c._id) === String(cId));
        if ($item("#confirmationItemContactInfo").type) {
            if (selCon) {
                let phoneTxt = selCon.phone ? formatPhoneNumber(selCon.phone) : "";
                $item("#confirmationItemContactInfo").text = `${selCon.firstName || ''} ${selCon.lastName || ''} ${phoneTxt ? '- ' + phoneTxt : ''}`.trim();
            } else {
                $item("#confirmationItemContactInfo").text = "No contact assigned";
            }
        }

        let lId = itemData.locationId || itemData.assignedLocationId;
        let selLoc = globalLocations.find(l => String(l._id) === String(lId));
        if ($item("#confirmationItemLocationInfo").type) {
            if (selLoc) {
                $item("#confirmationItemLocationInfo").text = `${selLoc.address1 || ''}, ${selLoc.city || ''} ${selLoc.zip || ''}`.trim();
            } else {
                $item("#confirmationItemLocationInfo").text = "No location assigned";
            }
        }

        if ($item("#confirmationItemTime").type) {
            $item("#confirmationItemTime").expand(); 
            $item("#confirmationItemTime").text = itemData.assignedSlotText || "Time Error - Please Go Back";
            $item("#confirmationItemTime").style.color = "#30FFD6"; 
        }

        if ($item("#confirmationItemContainer").type) {
            $item("#confirmationItemContainer").style.borderColor = "#FFFFFF";
        }
    });
}

// ==========================================
// 🚀 SUBMIT BOOKING & GOOGLE CALENDAR
// ==========================================
export function initConfirmationUI() {
    if ($w("#completeBookingButton").id) {
        $w("#completeBookingButton").onClick(async () => {
            let btn = $w("#completeBookingButton");
            btn.disable();
            btn.label = "Finalizing Booking...";

            // 💥 1. INTERCEPT: Is this a Reschedule?
            let rescheduleId = session.getItem("reschedulingJobId");
            if (rescheduleId) {
                try {
                    console.log("🔄 [ROUTING]: Reschedule Detected for Job ID:", rescheduleId);
                    let jobToReschedule = masterCalendarQueue.find(j => j._id === rescheduleId);
                    if (jobToReschedule && hooks.executeReschedule) {
                        await hooks.executeReschedule(jobToReschedule);
                        
                        // 💥 FETCH MEMBER EMAIL FOR RESCHEDULE
                        let targetEmail = null;
                        try {
                            let loggedInMember = await currentMember.getMember();
                            targetEmail = loggedInMember?.loginEmail;
                            if (!targetEmail && loggedInMember?.contactDetails?.emails?.length > 0) {
                                targetEmail = loggedInMember.contactDetails.emails[0];
                            }
                        } catch(e) { console.error("Could not fetch member email", e); }
                        targetEmail = targetEmail || jobToReschedule.email;
                        
                        if (targetEmail) {
                            let orderData = {
                                firstName: jobToReschedule.firstName || "Valued Customer",
                                orderId: jobToReschedule.orderId,
                                jobs: [jobToReschedule]
                            };
                            
                            console.log(`✉️ [FIRING EMAIL]: Sending RESCHEDULE payload to ${targetEmail}...`, orderData);
                            sendMasterTransactionalEmail(targetEmail, orderData, "RESCHEDULE")
                                .then(res => console.log("✅ [SUCCESS]: Reschedule Email Sent!", res))
                                .catch(e => console.error("🚨 [ERROR]: Reschedule Email Failed", e));
                        }
                    }
                } catch(e) { 
                    logger.error("Reschedule UI Error", e); 
                } finally {
                    btn.enable(); 
                    btn.label = "Complete Booking";
                }
                return; // 🛑 Stop the normal checkout code from running!
            }

            // 🛒 2. NORMAL CART CHECKOUT LOGIC
            try {
                let liveCart = hooks.getCartData(); 
                
                let jobsToBook = liveCart.filter(c => c.assignedSlotText);
                if (jobsToBook.length === 0) {
                    if (hooks.showErrorMessage) hooks.showErrorMessage("No booked items found to submit.");
                    btn.enable(); btn.label = "Complete Booking";
                    return;
                }

                let activeUserId = await getActiveUserId();
                let globalContacts = hooks.getGlobalContacts();
                let globalLocations = hooks.getGlobalLocations();
                let globalVehicles = hooks.getGlobalVehicles();
                let globalDetailers = hooks.getGlobalDetailers();

                // 💥 FETCH THE LOGGED-IN MEMBER'S EMAIL
                let memberEmail = null;
                try {
                    let loggedInMember = await currentMember.getMember();
                    memberEmail = loggedInMember?.loginEmail;
                    if (!memberEmail && loggedInMember?.contactDetails?.emails?.length > 0) {
                        memberEmail = loggedInMember.contactDetails.emails[0];
                    }
                } catch(e) { console.error("Could not fetch member email", e); }

                // 💥 3. FETCH DATA FOR PAYROLL MATH
                let [pkgRes, addOnRes] = await Promise.all([
                    wixData.query("servicePackages").find(),
                    wixData.query("autoWhatsIncluded").limit(1000).find()
                ]);
                let cmsPackages = pkgRes.items || [];
                let cmsAddOns = addOnRes.items || [];

                let payloads = jobsToBook.map(item => {
                    let selCon = globalContacts.find(c => String(c._id) === String(item.contactId || item.assignedContactId)); 
                    let selLoc = globalLocations.find(l => String(l._id) === String(item.locationId || item.assignedLocationId));
                    let selVeh = globalVehicles.find(v => String(v._id) === String(item.vehicleId)); 
                    let selDet = globalDetailers.find(d => String(d._id) === String(item.assignedDetailerId));

                    // 🌎 Resolve timezone from the service address (State + ZIP)
                    let st = String(selLoc?.state || "").trim().toUpperCase();
                    let zip = String(selLoc?.zip || "").trim();
                    let zip3 = zip.substring(0, 3);
                    let serviceTz = "America/Chicago"; // Default Pensacola HQ
                    if (zip3 === "324" || zip3 === "325") serviceTz = "America/Chicago";
                    else if (zip.startsWith("32") || zip.startsWith("33") || zip.startsWith("34")) serviceTz = "America/New_York";
                    else if (zip.startsWith("84") || ["UT", "CO", "WY", "MT", "NM", "ID"].includes(st)) serviceTz = "America/Denver";
                    else if (st === "AZ") serviceTz = "America/Phoenix";
                    else if (["CA", "NV", "OR", "WA"].includes(st)) serviceTz = "America/Los_Angeles";
                    else if (["GA", "SC", "NC", "VA", "NY", "PA", "OH", "MI"].includes(st)) serviceTz = "America/New_York";

                    let rawAssigned = new Date(item.assignedDate);
                    let yr = rawAssigned.getFullYear();
                    let mo = rawAssigned.getMonth();
                    let dy = rawAssigned.getDate();

                    // 1. Service Date (Anchored to 12:00 UTC so calendar date never shifts across timezones)
                    let targetDate = new Date(Date.UTC(yr, mo, dy, 12, 0, 0, 0));
                    
                    let matchedSlot = globalTimeSlots.find(s => s.token === item.assignedTimeToken);
                    let aHour = matchedSlot ? (matchedSlot.arrivalHour || 9) : 9;
                    let dHour = matchedSlot ? (matchedSlot.expectedHour || (aHour + 2)) : (aHour + 2);

                    // Compute exact UTC offset for the service address timezone on that date
                    let tzParts = new Intl.DateTimeFormat('en-US', { timeZone: serviceTz, timeZoneName: 'shortOffset' }).formatToParts(targetDate);
                    let offsetStr = tzParts.find(p => p.type === 'timeZoneName')?.value || "GMT-5";
                    let offsetHours = parseInt(offsetStr.replace("GMT", ""), 10);
                    if (isNaN(offsetHours)) offsetHours = -5;

                    // 2. Scheduled Start Time & 3. Deadline Time (Locked to Service Address Timezone!)
                    let scheduledStart = new Date(Date.UTC(yr, mo, dy, aHour - offsetHours, 0, 0, 0));
                    let deadlineTime = new Date(Date.UTC(yr, mo, dy, dHour - offsetHours, 0, 0, 0));

                    // 💸 PAYROLL & VEHICLE-MATCHED PACKAGE ENGINE
                    let detailerLevel = selDet ? (selDet.payLevel || 1) : 1;
                    let pkg = findMatchingServicePackage(cmsPackages, item, selVeh?.vehicleType || item.vehicleType);
                    let basePayout = pkg ? (detailerLevel === 2 ? (pkg.payoutL2 || 0) : (pkg.payoutL1 || 0)) : 0;

                    if (pkg) {
                        item.basePrice = Number(pkg.price || item.basePrice || 0);
                        item.mobileFee = Number(pkg.mobileFee || item.mobileFee || 0);
                        item.setDuration = Number(pkg.duration || item.setDuration || 3);
                    }
                    
                    let addOnPayout = 0;
                    const ADDON_COMMISSION_RATE = 0.70; // 70% Add-on Commission
                    let allAddOns = [...(item.interiorAddOns || []), ...(item.exteriorAddOns || [])];
                    
                    allAddOns.forEach(addonTag => {
                        let addOnCms = cmsAddOns.find(a => addonTag.includes(a.buttonTitle || a.title));
                        if (addOnCms && addOnCms.price) {
                            addOnPayout += (Number(addOnCms.price) * ADDON_COMMISSION_RATE);
                        }
                    });
                    
                    let totalPayout = basePayout + addOnPayout;
                    let trainerPayout = totalPayout;
                    let traineePayout = 0;
                    let traineeId = item.assignedTraineeId || null; 

                    // 60/40 Training Split
                    if (traineeId) {
                        trainerPayout = totalPayout * 0.60;
                        traineePayout = totalPayout * 0.40;
                    }
                    // 💸 END PAYROLL MATH ENGINE

                    let base = Number(item.basePrice || 0); 
                    let mobile = Number(item.mobileFee || 0); 
                    let addons = Number(item.totalAddOnsPrice || 0); 
                    let calcSubTotal = base + mobile + addons; 
                    let discTotal = Number(item.discountsTotal || 0); 
                    let calcTotalPrice = Math.max(0, calcSubTotal - discTotal);
                    item.totalPrice = calcTotalPrice;
                    let formattedDiscounts = (item.discountsApplied && item.discountsApplied.length > 0) ? [`${item.discountsApplied[0]} (-$${discTotal.toFixed(2)})`] : [];
                    
                    return {
                        userId: item.userId || activeUserId,
                        firstName: selCon ? selCon.firstName : "", 
                        lastName: selCon ? selCon.lastName : "", 
                        email: memberEmail || "", 
                        phone: selCon ? selCon.phone : "",
                        address1: selLoc ? selLoc.address1 : "", 
                        address2: selLoc ? selLoc.address2 : "",
                        city: selLoc ? selLoc.city : "", 
                        state: selLoc ? selLoc.state : "", 
                        zip: selLoc ? selLoc.zip : "",
                        
                        vehicleId: item.vehicleId, 
                        vehicleYear: selVeh ? (selVeh.vehicleYear || selVeh.year || "") : "",
                        vehicleMake: selVeh ? (selVeh.vehicleMake || selVeh.make || "") : "",
                        vehicleModel: selVeh ? (selVeh.vehicleModel || selVeh.model || "") : "",
                        vehicleColor: selVeh ? (selVeh.vehicleColor || selVeh.color || "") : "",
                        vehicleType: selVeh ? selVeh.vehicleType : (item.vehicleType || "N/A"),
                        vehicleCategory: selVeh ? (selVeh.category || selVeh.vehicleCategory) : (item.vehicleCategory || "N/A"),
                        vehicleInfo: selVeh ? `${selVeh.year || ''} ${selVeh.make || ''} ${selVeh.model || ''} ${selVeh.color || ''}`.replace(/\s+/g, ' ').trim() : (item.vehicleInfo || "Unknown Vehicle"),
                        
                        locationId: selLoc ? selLoc._id : null, 
                        contactId: selCon ? selCon._id : null, 
                        orderId: item.orderId || "JOB_" + Date.now().toString() + Math.floor(Math.random() * 1000),
                        
                        packageTitle: item.packageTitle, 
                        packageImage: item.packageImage || "",
                        level: item.level || "N/A", 
                        type: item.type || "N/A",
                        basePrice: base, 
                        mobileFee: mobile, 
                        subTotal: calcSubTotal, 
                        discountsTotal: discTotal, 
                        totalPrice: Number(item.totalPrice || 0),
                        setDuration: Number(item.setDuration || 3), 
                        totalAddOnsPrice: addons, 
                        salePackagePrice: item.salePackagePrice !== undefined ? Number(item.salePackagePrice) : null,
                        
                        serviceDate: targetDate, 
                        originalScheduledDate: targetDate,
                        scheduledStartTime: scheduledStart, 
                        deadlineTime: deadlineTime, 
                        scheduledTime: item.assignedTime, 
                        timeToken: item.assignedTimeToken,
                        
                        detailerId: item.assignedDetailerId, 
                        detailerAlias: selDet ? (selDet.teamAlias || "Detailer Team") : "Unassigned", 
                        detailerName: selDet ? selDet.first : "Unassigned",
                        
                        interiorAddOns: item.interiorAddOns || [], 
                        exteriorAddOns: item.exteriorAddOns || [], 
                        discountsApplied: formattedDiscounts, 
                        specialInstructions: item.specialInstructions || "", 
                        officeNotes: item.officeNotes || "",
                        status: "Scheduled",
                        paymentStatus: "Un-Paid", 
                        googleEventId: null, 
                        googleAdminEventId: null,
                        basePayout: basePayout,
                        addOnPayout: addOnPayout,
                        payoutTotal: totalPayout,
                        trainerPayout: trainerPayout,
                        traineePayout: traineePayout,
                        traineeId: traineeId
                    };
                }); 

                for (let job of payloads) {
                    try {
                        let detailer = globalDetailers.find(d => String(d._id) === String(job.detailerId));
                        let detailerCalId = detailer?.googleCalendarId || detailer?.email;

                        if (detailerCalId && typeof scheduleDetailingJob === "function") {
                            let startT = new Date(job.scheduledStartTime);
                            let endT = new Date(startT);
                            endT.setHours(startT.getHours() + job.setDuration);

                            let syncRes = await scheduleDetailingJob(detailerCalId, { 
                                title: `${job.vehicleInfo} - ${job.packageTitle}`, 
                                description: `Order: ${job.orderId}\nVehicle: ${job.vehicleInfo}\nPhone: ${job.phone}\nInstructions: ${job.specialInstructions || 'None'}`, 
                                startTime: startT.toISOString(), 
                                endTime: endT.toISOString(), 
                                detailerName: job.detailerName 
                            });
                            
                            if (syncRes && syncRes.success) {
                                job.googleEventId = syncRes.eventId || null; 
                                job.googleAdminEventId = syncRes.adminEventId || null;
                            }
                        }
                    } catch (googleErr) {
                        logger.error("Google Calendar Sync failed for job, but proceeding with database save.", googleErr);
                    }
                }
                
                // 💥 1. Capture the bulkInsert result to get the actual DB _ids
                let bulkResult = await wixData.bulkInsert("scheduledJobs", payloads);

                if (bulkResult.insertedItemIds) {
                    payloads.forEach((job, index) => {
                        job._id = bulkResult.insertedItemIds[index] || "temp_" + Date.now() + "_" + index;
                    });
                } else {
                    payloads.forEach((job, index) => { job._id = "temp_" + Date.now() + "_" + index; });
                }

                // 💥 DISPATCH CONFIRMATION EMAIL HERE
                if (payloads.length > 0) {
                    let targetEmail = payloads[0].email; // This is now guaranteed to be the Member's email!
                    if (targetEmail) {
                        let orderData = {
                            firstName: payloads[0].firstName || "Valued Customer",
                            orderId: payloads[0].orderId,
                            jobs: payloads
                        };
                        
                        console.log(`✉ [FIRING EMAIL]: Sending CONFIRMATION payload to ${targetEmail}...`, orderData);
                        sendMasterTransactionalEmail(targetEmail, orderData, "CONFIRMATION")
                            .then(res => console.log("✅ [SUCCESS]: Confirmation Email Sent!", res))
                            .catch(err => console.error("🚨 [ERROR]: Confirmation Email Failed", err));
                    } else {
                        console.warn("⚠️ [EMAIL ABORT]: No member email address found to send Confirmation to!");
                    }
                }
                
                let idsToDelete = jobsToBook.map(i => i._id);
                await wixData.bulkRemove("temporaryData", idsToDelete);
                
                if (typeof broadcastCalendarUpdate === "function") {
                    try { await broadcastCalendarUpdate(); } catch (rtErr) {}
                }
                
                session.removeItem("checkout_selectedIds"); 
                if (hooks.showSuccessMessage) hooks.showSuccessMessage("Booking Confirmed!"); 
                
                // 💥 3. BULLETPROOF OPTIMISTIC CACHE & DIRECT INJECTION
                let cached = session.getItem("optimistic_jobs");
                let optimisticQueue = cached ? JSON.parse(cached) : [];
                optimisticQueue = [...payloads, ...optimisticQueue];
                session.setItem("optimistic_jobs", JSON.stringify(optimisticQueue));

                // 💥 4. FORCE THE UI TO PAINT BEFORE THE ROUTER MOVES!
                if (typeof syncDetailJobs === "function") {
                    let currentUpcoming = $w("#upcomingRep").data || [];
                    let currentCompleted = $w("#completedRep").data || [];
                    
                    // Combine our brand new payloads with whatever is already on the page
                    let instantJobsArray = [...payloads, ...currentUpcoming, ...currentCompleted];
                    
                    console.log("⚡ [DIRECT INJECT]: Forcing syncDetailJobs to paint immediately...", instantJobsArray);
                    syncDetailJobs(instantJobsArray);
                }

                if (hooks.loadCartData) await hooks.loadCartData();
                
                setTimeout(() => {
                    if (hooks.smartGoTo) hooks.smartGoTo("upcomingProfileState");
                    btn.enable();
                    btn.label = "Complete Booking";
                }, 1000);

            } catch (err) {
                logger.error("Booking Error:", err);
                if (hooks.showErrorMessage) hooks.showErrorMessage("Failed to schedule booking. Please try again.");
                btn.enable(); 
                btn.label = "Complete Booking";
            }
        });
    }
}


export async function jumpToDate(dateString) {
    let d = new Date(dateString);
    selectedCalendarDate = d.toDateString();
    
    currentMonthView = new Date(d);
    currentMonthView.setDate(1);
    
    await generateMonthGrid(); 
    updateCalendarDayTitle();  
    await loadDailyDetailers();      

    setTimeout(() => {
        repaintMonthGridBorders();
    }, 150);
}