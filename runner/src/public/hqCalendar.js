// --- public/hqCalendar.js ---

import wixData from 'wix-data';
import { secureUpdateJob, secureInsertJob } from 'backend/emailDispatchEngine';
import { getDetailerTimeOff } from 'public/cartEngine';
import {
    hqState,
    getMountainDateString,
    formatBookingCustomerText,
    formatBookingVehicleText,
    closeAllLightboxes,
    safeOpenOffice
} from 'public/hqState';
import {
    clearBookedTabFromCartAndRepeater,
    removePrevTabAndDeselect,
    loadExistingJobIntoCart
} from 'public/hqTabsAndCart';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

registerModuleState("hqCalendar", () => ({
    selectedCalendarDate: hqState.selectedCalendarDate,
    currentWeekStart: hqState.currentWeekStartObj ? hqState.currentWeekStartObj.toDateString() : null,
    calendarDaysLoadedCount: (hqState.calendarData || []).length,
    isGeneratingWeeks: Boolean(hqState.isGeneratingWeeks),
    isDailyConfirmWired,
    pendingJobUpdateSummary: hqState.pendingJobUpdate ? {
        action: hqState.pendingJobUpdate.action,
        timeString: hqState.pendingJobUpdate.timeString,
        slotToken: hqState.pendingJobUpdate.slotToken,
        detailerAlias: hqState.pendingJobUpdate.detailerData?.teamAlias,
        cartItemTitle: hqState.pendingJobUpdate.cartItem?.packageTitle
    } : null
}));

registerDomElements({
    repeaters: ["#repWeekly", "#repDaily"],
    inputs: ["#cancelReasonInput"]
});

// Helper: Safely unwrap backend return values and guarantee wixData persistence
async function persistJobUpdateToCMS(jobToUpdate, shouldSendEmail = true) {
    let cleanJob = { ...jobToUpdate };
    delete cleanJob.isPlaceholder;
    delete cleanJob.isProjectedCorrection;

    let savedRecord = null;

    // 1. Run backend secureUpdateJob (uses suppressAuth: true in backend & handles email dispatch)
    try {
        let res = await secureUpdateJob(cleanJob, shouldSendEmail);
        if (res && res._id) {
            savedRecord = res;
        } else if (res && (res.item || res.job || res.updatedJob)) {
            savedRecord = res.item || res.job || res.updatedJob;
        }
    } catch (err) {
        console.warn("⚠️ secureUpdateJob error:", err);
    }

    // 2. Also guarantee direct wixData update on scheduledJobs
    try {
        let latestInDb = await wixData.get("scheduledJobs", cleanJob._id);
        if (latestInDb) {
            let merged = {
                ...latestInDb,
                ...cleanJob,
                _id: cleanJob._id
            };
            savedRecord = await wixData.update("scheduledJobs", merged);
        } else {
            savedRecord = await wixData.update("scheduledJobs", cleanJob);
        }
    } catch (dbErr) {
        console.warn("⚠️ Direct wixData.update fallback notice:", dbErr);
    }

    return savedRecord || cleanJob;
}

export function initCalendarButtons() {
    const $w = hqState.$w;
    if (!$w) return;

    if ($w("#btnNextWeek").id) {
        $w("#btnNextWeek").onClick(() => {
            if (!hqState.currentWeekStartObj) return;
            let nextWeek = new Date(hqState.currentWeekStartObj);
            nextWeek.setDate(nextWeek.getDate() + 7);
            generateWeeklyCalendar(nextWeek);
        });
    }
    if ($w("#btnPrevWeek").id) {
        $w("#btnPrevWeek").onClick(() => {
            if (!hqState.currentWeekStartObj) return;
            let prevWeek = new Date(hqState.currentWeekStartObj);
            prevWeek.setDate(prevWeek.getDate() - 7);
            generateWeeklyCalendar(prevWeek);
        });
    }
}

export function getJobsAndCorrectionsForDate(dateString) {
    const matchesDateStr = (rawD) => {
        if (!rawD) return false;
        let d = new Date(rawD);
        if (isNaN(d.getTime())) return false;
        let localStr = d.toLocaleDateString('en-US');
        let mtStr = getMountainDateString(d);
        let utcStr = `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
        return mtStr === dateString || localStr === dateString || utcStr === dateString;
    };

    let jobsOnThisDay = [];
    hqState.globalJobs.forEach(job => {
        if (!job || job.status === "Cancelled") return;

        if (job.serviceDate && matchesDateStr(job.serviceDate)) {
            jobsOnThisDay.push(job);
        }
        // Project scheduled corrections onto the calendar on their correctionDate
        if (job.isCorrection && job.correctionDate && matchesDateStr(job.correctionDate)) {
            jobsOnThisDay.push({
                ...job,
                isProjectedCorrection: true,
                detailerId: job.correctionDetailerId || job.detailerId,
                detailerName: job.correctionDetailerName || job.detailerName,
                serviceDate: job.correctionDate,
                scheduledTime: job.correctionTime || job.scheduledTime,
                timeToken: job.correctionTimeToken || job.timeToken,
                packageTitle: `CORRECTION: ${job.packageTitle || "Detail"}`,
                level: "Correction",
                totalPrice: 0,
                setDuration: "1"
            });
        }
    });
    return jobsOnThisDay;
}

export function buildWeeklyDataArray(startDay, tomorrow, weeksToGenerate = 3) {
    let dailyItems = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let totalDays = weeksToGenerate * 7;

    for (let dIdx = 0; dIdx < totalDays; dIdx++) {
        let loopDate = new Date(startDay);
        loopDate.setDate(startDay.getDate() + dIdx);
        loopDate.setHours(0, 0, 0, 0);

        let dateString = loopDate.toLocaleDateString('en-US');
        let isPastDate = loopDate < tomorrow;

        let jobsOnThisDay = getJobsAndCorrectionsForDate(dateString);

        let capAm = 0, capPm = 0, cap3rd = 0;
        let thirdSlotToken = hqState.globalTimeSlots[2]?.token || "token_3";

        hqState.globalDetailers.forEach(detailer => {
            let amJob = jobsOnThisDay.find(j => j.detailerId === detailer._id && (j.timeToken === "token_1" || j.timeToken === "slot_1" || j.timeToken === "AM" || (j.scheduledTime || "").toLowerCase().includes("9-11")));
            let pmJob = jobsOnThisDay.find(j => j.detailerId === detailer._id && (j.timeToken === "token_2" || j.timeToken === "slot_2" || j.timeToken === "PM" || (j.scheduledTime || "").toLowerCase().includes("1-3")));
            let thirdJob = jobsOnThisDay.find(j => j.detailerId === detailer._id && (j.timeToken === "token_3" || j.timeToken === "slot_3" || j.timeToken === "3rd" || (j.scheduledTime || "").toLowerCase().includes("4-6")));

            let timeOff = getDetailerTimeOff(detailer._id, loopDate, hqState.globalAvailabilityRules);
            let isThirdSlotOpened = Array.isArray(timeOff.openedTokens) && (
                timeOff.openedTokens.includes(thirdSlotToken) ||
                timeOff.openedTokens.some(t => String(t).includes("3"))
            );
            let slot3Off = timeOff.isFullDayOff || !isThirdSlotOpened;

            if (!amJob && !timeOff.amOff) capAm++;
            if (!pmJob && !timeOff.pmOff) capPm++;
            if (!thirdJob && !slot3Off) cap3rd++;
        });

        dailyItems.push({
            _id: "day_" + loopDate.getTime().toString(),
            fullDateString: dateString,
            dateObj: loopDate,
            dayLabel: dayNames[loopDate.getDay()],
            dateLabel: loopDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            isPastDate: isPastDate,
            capAm: isPastDate ? 0 : capAm,
            capPm: isPastDate ? 0 : capPm,
            cap3rd: isPastDate ? 0 : cap3rd
        });
    }

    return dailyItems;
}

export function paintWeeklyCalendarUI() {
    const $w = hqState.$w;
    if (!$w || hqState.calendarData.length === 0) return;

    if (!hqState.selectedCalendarDate) {
        let today = new Date();
        today.setHours(0, 0, 0, 0);
        hqState.selectedCalendarDate = today.toLocaleDateString('en-US');
    }

    if ($w("#repWeekly").id) {
        $w("#repWeekly").data = hqState.calendarData;

        const styleCapacityText = (txtElem, cap, isPast) => {
            if (!txtElem || !txtElem.id) return;
            if (isPast) {
                txtElem.text = "—";
                txtElem.style.color = "#6E6E6E";
            } else {
                txtElem.text = `x${cap}`;
                txtElem.style.color = (cap === 0) ? "#6E6E6E" : "#000000";
            }
        };

        // 🌟 Paint every day item in the slider immediately
        $w("#repWeekly").forEachItem(($item, dayData) => {
            if (!dayData) return;

            let isSelected = (hqState.selectedCalendarDate === dayData.fullDateString);

            let dayText = $item("#jobsRepDay1");
            let dateText = $item("#jobsRepDate1");
            let txtAm = $item("#btnSlot1a1");
            let txtPm = $item("#btnSlot2a1");
            let txt3rd = $item("#btnSlot3a1");

            if (dayText.id) dayText.text = dayData.dayLabel;
            if (dateText.id) dateText.text = dayData.dateLabel;

            styleCapacityText(txtAm, dayData.capAm, dayData.isPastDate);
            styleCapacityText(txtPm, dayData.capPm, dayData.isPastDate);
            styleCapacityText(txt3rd, dayData.cap3rd, dayData.isPastDate);

            let titleBox = $item("#jobsRepTitleBox1");
            if (titleBox.id) {
                titleBox.style.backgroundColor = isSelected ? "#1FE7B0" : "#6E6E6E";
            }

            let colButton = $item("#jobsRepButton1");
            if (colButton.id) {
                if (isSelected) {
                    colButton.disable();
                } else {
                    colButton.enable();
                }
            }
        });

        loadDailyDetailers();
    }
}

export function generateWeeklyCalendar(startDateOverride = null) {
    let today = new Date();
    today.setHours(0, 0, 0, 0);
    let tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let baseDate = startDateOverride
        ? new Date(startDateOverride)
        : (hqState.currentWeekStartObj ? new Date(hqState.currentWeekStartObj) : today);
    let startDay = new Date(baseDate);
    startDay.setDate(startDay.getDate() - startDay.getDay());
    startDay.setHours(0, 0, 0, 0);
    hqState.currentWeekStartObj = new Date(startDay);

    // If we already had more than 3 weeks loaded via scrolling, preserve that loaded span on refresh!
    let weeksCurrentlyLoaded = Math.max(3, Math.ceil((hqState.calendarData.length || 21) / 7));
    if (startDateOverride) weeksCurrentlyLoaded = 3;

    hqState.calendarData = buildWeeklyDataArray(startDay, tomorrow, weeksCurrentlyLoaded);
    paintWeeklyCalendarUI();
}

export function appendMoreWeeks() {
    const $w = hqState.$w;
    if (!$w || hqState.isGeneratingWeeks || hqState.calendarData.length === 0) return;
    hqState.isGeneratingWeeks = true;

    let lastDayItem = hqState.calendarData[hqState.calendarData.length - 1];
    let nextStartDay = new Date(lastDayItem.dateObj);
    nextStartDay.setDate(nextStartDay.getDate() + 1);
    nextStartDay.setHours(0, 0, 0, 0);

    let today = new Date();
    today.setHours(0, 0, 0, 0);
    let tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Append 2 more weeks (14 days) when user scrolls to the start of the last week
    let moreDays = buildWeeklyDataArray(nextStartDay, tomorrow, 2);
    hqState.calendarData = [...hqState.calendarData, ...moreDays];

    if ($w("#repWeekly").id) {
        $w("#repWeekly").data = hqState.calendarData;
    }

    setTimeout(() => { hqState.isGeneratingWeeks = false; }, 400);
}

export function initWeeklyRepeater() {
    const $w = hqState.$w;
    if (!$w || !$w("#repWeekly").id) return;

    $w("#repWeekly").onItemReady(($item, dayData, index) => {
        if (!dayData) return;

        // Check if this item is at or past the start of the last loaded week (last 7 items)
        const checkAndAppendIfLastWeek = () => {
            let currentIdx = hqState.calendarData.findIndex(d => d._id === dayData._id);
            if (currentIdx === -1) currentIdx = index;
            if (hqState.calendarData.length >= 7 && currentIdx >= hqState.calendarData.length - 7) {
                appendMoreWeeks();
            }
        };

        // 1. Trigger when the user scrolls the slider so the start of the last week enters the viewport
        if (typeof $item("#jobsRepTitleBox1").onViewportEnter === "function") {
            $item("#jobsRepTitleBox1").onViewportEnter(() => {
                checkAndAppendIfLastWeek();
            });
        } else if (typeof $item("#jobsRepButton1").onViewportEnter === "function") {
            $item("#jobsRepButton1").onViewportEnter(() => {
                checkAndAppendIfLastWeek();
            });
        }

        let dayText = $item("#jobsRepDay1");
        let dateText = $item("#jobsRepDate1");
        let txtAm = $item("#btnSlot1a1");
        let txtPm = $item("#btnSlot2a1");
        let txt3rd = $item("#btnSlot3a1");
        let titleBox = $item("#jobsRepTitleBox1");
        let colButton = $item("#jobsRepButton1");

        if (dayText.id) dayText.text = dayData.dayLabel;
        if (dateText.id) dateText.text = dayData.dateLabel;

        const styleCapacityText = (txtElem, cap, isPast) => {
            if (!txtElem.id) return;
            if (isPast) {
                txtElem.text = "—";
                txtElem.style.color = "#6E6E6E";
            } else {
                txtElem.text = `x${cap}`;
                txtElem.style.color = (cap === 0) ? "#6E6E6E" : "#000000";
            }
        };

        styleCapacityText(txtAm, dayData.capAm, dayData.isPastDate);
        styleCapacityText(txtPm, dayData.capPm, dayData.isPastDate);
        styleCapacityText(txt3rd, dayData.cap3rd, dayData.isPastDate);

        let isSelected = (hqState.selectedCalendarDate === dayData.fullDateString);
        if (titleBox.id) {
            titleBox.style.backgroundColor = isSelected ? "#1FE7B0" : "#6E6E6E";
        }
        if (colButton.id) {
            isSelected ? colButton.disable() : colButton.enable();

            colButton.onClick(() => {
                // Read live day item by _id in case repeater DOM was recycled
                let liveDay = hqState.calendarData.find(d => d._id === dayData._id) || dayData;
                hqState.selectedCalendarDate = liveDay.fullDateString;
                checkAndAppendIfLastWeek();
                paintWeeklyCalendarUI();
            });
        }
    });
}

// ==========================================
// ⏰ DAILY DETAILERS & BOOKING
// ==========================================
export function loadDailyDetailers() {
    const $w = hqState.$w;
    if (!$w || !hqState.selectedCalendarDate) return;

    let d = new Date(hqState.selectedCalendarDate);
    let dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    let monthName = d.toLocaleDateString('en-US', { month: 'short' });
    let dateNum = d.getDate();
    let year = d.getFullYear();

    let suffix = "th";
    if (dateNum % 10 === 1 && dateNum !== 11) suffix = "st";
    else if (dateNum % 10 === 2 && dateNum !== 12) suffix = "nd";
    else if (dateNum % 10 === 3 && dateNum !== 13) suffix = "rd";

    if ($w("#textDaily").id) {
        $w("#textDaily").text = `${dayName} - ${monthName} ${dateNum}${suffix}, ${year}`;
    }

    let jobsOnThisDay = getJobsAndCorrectionsForDate(hqState.selectedCalendarDate);

    const getJobLabel = (jobObj) => {
        if (!jobObj) return "Unavailable";

        let city = "Unknown";
        if (jobObj.city) {
            city = jobObj.city.trim().substring(0, 7);
        } else if (jobObj.locationText) {
            let lastHyphenIndex = jobObj.locationText.lastIndexOf("-");
            if (lastHyphenIndex !== -1) {
                city = jobObj.locationText.substring(lastHyphenIndex + 1).trim().substring(0, 7);
            } else {
                city = jobObj.locationText.trim().substring(0, 7);
            }
        }

        let price = jobObj.totalPrice ? `$${Number(jobObj.totalPrice).toFixed(0)}` : "$0";

        let level = jobObj.level;
        if (!level && jobObj.packageTitle) {
            let t = jobObj.packageTitle.toLowerCase();
            if (t.includes("correction")) level = "Correction";
            else if (t.includes("premium plus")) level = "Premium Plus";
            else if (t.includes("premium")) level = "Premium";
            else if (t.includes("luxury")) level = "Luxury";
            else level = "Classic";
        }
        level = level || "Detail";

        return `${city}, ${price}\n${level}`;
    };

    let thirdSlotToken = hqState.globalTimeSlots[2]?.token || "token_3";

    let dailyData = hqState.globalDetailers.map(detailer => {
        let amJob = jobsOnThisDay.find(j => j.detailerId === detailer._id && (j.timeToken === "token_1" || j.timeToken === "slot_1" || j.timeToken === "AM" || (j.scheduledTime || "").toLowerCase().includes("9-11")));
        let pmJob = jobsOnThisDay.find(j => j.detailerId === detailer._id && (j.timeToken === "token_2" || j.timeToken === "slot_2" || j.timeToken === "PM" || (j.scheduledTime || "").toLowerCase().includes("1-3")));
        let thirdJob = jobsOnThisDay.find(j => j.detailerId === detailer._id && (j.timeToken === "token_3" || j.timeToken === "slot_3" || j.timeToken === "3rd" || (j.scheduledTime || "").toLowerCase().includes("4-6")));

        let timeOff = getDetailerTimeOff(detailer._id, new Date(hqState.selectedCalendarDate), hqState.globalAvailabilityRules);
        let isThirdSlotOpened = Array.isArray(timeOff.openedTokens) && (
            timeOff.openedTokens.includes(thirdSlotToken) ||
            timeOff.openedTokens.some(t => String(t).includes("3"))
        );
        let slot3Off = timeOff.isFullDayOff || !isThirdSlotOpened;

        let realName = detailer.first || detailer.firstName || detailer.title || "Detailer";
        let aliasName = detailer.teamAlias || "Detailer Team";
        let sortOrder = detailer.sort ? Number(detailer.sort) : 99;

        return {
            _id: detailer._id,
            trueDetailerId: detailer._id,
            teamAlias: realName,
            realName: realName,
            aliasName: aliasName,
            sortOrder: sortOrder,

            isAmAvailable: !amJob && !timeOff.amOff,
            isPmAvailable: !pmJob && !timeOff.pmOff,
            isThirdAvailable: !thirdJob && !slot3Off,

            amLabel: amJob ? getJobLabel(amJob) : (timeOff.amOff ? "Time Off" : "Unavailable"),
            pmLabel: pmJob ? getJobLabel(pmJob) : (timeOff.pmOff ? "Time Off" : "Unavailable"),
            thirdLabel: thirdJob ? getJobLabel(thirdJob) : (slot3Off ? "Time Off" : "Unavailable"),

            amJobId: amJob ? amJob._id : null,
            pmJobId: pmJob ? pmJob._id : null,
            thirdJobId: thirdJob ? thirdJob._id : null,

            amIsUser: amJob && amJob.userId === hqState.currentDraft.customerId,
            pmIsUser: pmJob && pmJob.userId === hqState.currentDraft.customerId,
            thirdIsUser: thirdJob && thirdJob.userId === hqState.currentDraft.customerId
        };
    });

    if ($w("#repDaily").id) {
        $w("#repDaily").data = dailyData.sort((a, b) => a.sortOrder - b.sortOrder);
        $w("#repDaily").expand();
        syncDailyButtonStyles();
    }
}

export function syncDailyButtonStyles() {
    const $w = hqState.$w;
    if (!$w || !$w("#repDaily").id) return;

    let activeItem = hqState.activeTabId ? hqState.draftSessions.find(d => d._id === hqState.activeTabId) : null;
    let selectedBookedJobId = (activeItem && (activeItem.isExistingBooking || activeItem.originalJobId))
        ? activeItem.originalJobId
        : null;

    $w("#repDaily").forEachItem(($item, itemData) => {
        if ($item("#teamAlias").id) $item("#teamAlias").text = String(itemData?.teamAlias ?? "");

        const formatDailySlot = (prefix, jobId, isAvail, labelText) => {
            let box = $item(`#${prefix}ButtonBox`);
            let highlight = $item(`#${prefix}ButtonHighlight`);
            let txt = $item(`#${prefix}ButtonText`);
            let btn = $item(`#${prefix}Button`);

            if (box.id) box.expand();
            if (btn.id) {
                btn.enable();
                btn.label = "";
            }

            let bgColor = "#6E6E6E";
            let textColor = "#000000";

            if (jobId) {
                let isSelectedJob = Boolean(selectedBookedJobId && String(jobId) === String(selectedBookedJobId));
                bgColor = isSelectedJob ? "#B30000" : "#14606D";
                textColor = isSelectedJob ? "#FFFFFF" : "#000000";
            } else if (isAvail) {
                bgColor = "#1FE7B0";
            }

            if (highlight.id) {
                highlight.style.backgroundColor = bgColor;
            }
            if (txt.id) {
                txt.text = String(labelText ?? "");
                txt.style.color = textColor;
            }
        };

        formatDailySlot("am", itemData.amJobId, itemData.isAmAvailable, itemData.amJobId ? itemData.amLabel : (itemData.isAmAvailable ? "9-11am Arrival" : itemData.amLabel));
        formatDailySlot("pm", itemData.pmJobId, itemData.isPmAvailable, itemData.pmJobId ? itemData.pmLabel : (itemData.isPmAvailable ? "1-3pm Arrival" : itemData.pmLabel));
        formatDailySlot("third", itemData.thirdJobId, itemData.isThirdAvailable, itemData.thirdJobId ? itemData.thirdLabel : (itemData.isThirdAvailable ? "4-6pm Arrival" : itemData.thirdLabel));
    });
}

export function triggerCancellationLightbox(cartItem) {
    const $w = hqState.$w;
    if (!$w) return;

    let summaryHtml = `<h4 style="font-family: Arial; color: #FFFFFF;">Confirm Cancellation</h4>
    <ul style="font-family: Arial; font-size: 14px; line-height: 1.8; color: #EBEBEB;">
        <li><b style="color: #FFFFFF;">Action:</b> Cancelling scheduled job</li>
        <li><b style="color: #FFFFFF;">Detail:</b> ${cartItem.packageTitle}</li>
        <li><b style="color: #FFFFFF;">Vehicle:</b> ${cartItem.resolvedVehicle}</li>
    </ul>`;

    if ($w("#lightboxText").id) $w("#lightboxText").html = summaryHtml;
    if ($w("#cancelReasonInput").id) {
        $w("#cancelReasonInput").value = "";
        $w("#cancelReasonInput").style.borderColor = "#000000";
        $w("#cancelReasonInput").expand();
    }
    if ($w("#lightboxEditButton").id) {
        $w("#lightboxEditButton").label = "Send Email";
        $w("#lightboxEditButton").enable();
    }
    if ($w("#lightboxConfirmButton").id) {
        $w("#lightboxConfirmButton").label = "Don't Send Email";
        $w("#lightboxConfirmButton").enable();
    }

    hqState.pendingJobUpdate = { action: "cancel", cartItem: cartItem };
    safeOpenOffice("bookingConfirm");
}

let isDailyConfirmWired = false;

export function wireDailyConfirmModalOnce() {
    const $w = hqState.$w;
    if (!$w || isDailyConfirmWired) return;
    isDailyConfirmWired = true;

    // 1. Cancel Button inside #bookingConfirm
    if ($w("#lightboxCancelButton").id) {
        $w("#lightboxCancelButton").onClick(() => {
            hqState.pendingJobUpdate = null;
            closeAllLightboxes();
        });
    }

    // Shared execution engine for BOTH #lightboxEditButton ("Send Email") and #lightboxConfirmButton ("Don't Send Email")
    const executePendingConfirmation = async (shouldSendEmail = true) => {
        let ctx = hqState.pendingJobUpdate;
        if (!ctx) {
            closeAllLightboxes();
            return;
        }
        hqState.pendingJobUpdate = null;

        // Step A: Handle Job Cancellation
        if (ctx.action === "cancel" && ctx.cartItem) {
            let reason = $w("#cancelReasonInput").id ? String($w("#cancelReasonInput").value || "").trim() : "Cancelled by Office";
            if ($w("#cancelReasonInput").id && !$w("#cancelReasonInput").collapsed && !reason) {
                $w("#cancelReasonInput").style.borderColor = "#DF3131";
                $w("#cancelReasonInput").focus();
                hqState.pendingJobUpdate = ctx;
                return;
            }

            closeAllLightboxes();

            let jobId = ctx.cartItem.originalJobId;
            let jobToCancel = hqState.globalJobs.find(j => String(j._id) === String(jobId));
            if (!jobToCancel && jobId) {
                jobToCancel = await wixData.get("scheduledJobs", jobId).catch(() => null);
            }
            if (jobToCancel) {
                jobToCancel.status = "Cancelled";
                jobToCancel.cancelReason = reason || "Cancelled by Office";
                hqState.globalJobs = hqState.globalJobs.filter(j => String(j._id) !== String(jobId));
                generateWeeklyCalendar(hqState.currentWeekStartObj);
                await persistJobUpdateToCMS(jobToCancel, shouldSendEmail);
                if (hqState.currentDraft.customerId) {
                    hqState.callbacks.loadCustomerHistory(hqState.currentDraft.customerId);
                }
            }
            await clearBookedTabFromCartAndRepeater(ctx.cartItem._id);
            return;
        }

        closeAllLightboxes();

        try {
            let { action, cartItem, targetDateObj, timeString, slotToken, detailerData } = ctx;
            let yr = targetDateObj.getFullYear();
            let mo = targetDateObj.getMonth();
            let dy = targetDateObj.getDate();
            let cleanTargetDate = new Date(Date.UTC(yr, mo, dy, 12, 0, 0, 0));

            if (action === "correction" && cartItem && cartItem.originalJobId) {
                // 🛠️ SCHEDULE CORRECTION ON EXISTING JOB
                let jobToUpdate = hqState.globalJobs.find(j => String(j._id) === String(cartItem.originalJobId));
                if (!jobToUpdate) {
                    jobToUpdate = await wixData.get("scheduledJobs", cartItem.originalJobId).catch(() => null);
                }
                if (jobToUpdate) {
                    jobToUpdate.isCorrection = true;
                    jobToUpdate.correctionItems = cartItem.correctionItems || [];
                    jobToUpdate.correctionImages = cartItem.correctionImages || [];
                    jobToUpdate.correctionPayout = Number(cartItem.correctionPayout || 0);
                    jobToUpdate.correctionDetailerId = detailerData.trueDetailerId;
                    jobToUpdate.correctionDetailerName = detailerData.realName || detailerData.teamAlias;
                    jobToUpdate.correctionDate = cleanTargetDate;
                    jobToUpdate.correctionTime = timeString;
                    jobToUpdate.correctionTimeToken = slotToken;

                    let idx = hqState.globalJobs.findIndex(j => String(j._id) === String(cartItem.originalJobId));
                    if (idx > -1) hqState.globalJobs[idx] = { ...jobToUpdate };
                    else {
                        hqState.globalJobs.push({ ...jobToUpdate });
                        idx = hqState.globalJobs.length - 1;
                    }

                    await clearBookedTabFromCartAndRepeater(cartItem._id);
                    generateWeeklyCalendar(hqState.currentWeekStartObj);

                    let savedJob = await persistJobUpdateToCMS(jobToUpdate, shouldSendEmail);
                    if (savedJob && savedJob._id && idx > -1) {
                        hqState.globalJobs[idx] = savedJob;
                        generateWeeklyCalendar(hqState.currentWeekStartObj);
                    }
                    if (hqState.currentDraft.customerId) {
                        hqState.callbacks.loadCustomerHistory(hqState.currentDraft.customerId);
                    }
                }
                return;
            }

            if (action === "reschedule" && cartItem && cartItem.originalJobId) {
                // 🔄 RESCHEDULE EXISTING JOB
                let jobToUpdate = hqState.globalJobs.find(j => String(j._id) === String(cartItem.originalJobId));
                if (!jobToUpdate) {
                    jobToUpdate = await wixData.get("scheduledJobs", cartItem.originalJobId).catch(() => null);
                }
                if (jobToUpdate) {
                    jobToUpdate.serviceDate = cleanTargetDate;
                    jobToUpdate.scheduledTime = timeString;
                    jobToUpdate.timeToken = slotToken;
                    jobToUpdate.detailerId = detailerData.trueDetailerId;
                    jobToUpdate.detailerName = detailerData.realName || detailerData.teamAlias;
                    jobToUpdate.detailerAlias = detailerData.aliasName || detailerData.teamAlias;
                    jobToUpdate.wasRescheduled = true;
                    jobToUpdate.whenRescheduled = new Date();

                    let idx = hqState.globalJobs.findIndex(j => String(j._id) === String(cartItem.originalJobId));
                    if (idx > -1) hqState.globalJobs[idx] = { ...jobToUpdate };
                    else {
                        hqState.globalJobs.push({ ...jobToUpdate });
                        idx = hqState.globalJobs.length - 1;
                    }

                    await clearBookedTabFromCartAndRepeater(cartItem._id);
                    generateWeeklyCalendar(hqState.currentWeekStartObj);

                    let savedJob = await persistJobUpdateToCMS(jobToUpdate, shouldSendEmail);
                    if (savedJob && savedJob._id && idx > -1) {
                        hqState.globalJobs[idx] = savedJob;
                        generateWeeklyCalendar(hqState.currentWeekStartObj);
                    }
                    if (hqState.currentDraft.customerId) {
                        hqState.callbacks.loadCustomerHistory(hqState.currentDraft.customerId);
                    }
                }
                return;
            }

            if (action === "book" && cartItem) {
                // 🌟 NEW BOOKING INSERT
                let selectedDetailerObj = hqState.globalDetailers.find(d => d._id === detailerData.trueDetailerId);
                let detailerLevel = selectedDetailerObj ? Number(selectedDetailerObj.payLevel || 1) : 1;

                let pkgId = cartItem.packageId || hqState.currentDraft.packageId;
                let pkgCms = hqState.globalPackages.find(p => p._id === pkgId);
                let basePayout = pkgCms ? Number(detailerLevel === 2 ? (pkgCms.payoutL2 || 0) : (pkgCms.payoutL1 || 0)) : 0;

                let addOnPayout = 0;
                const ADDON_COMMISSION_RATE = 0.70;
                let allDraftAddOns = [
                    ...(cartItem.interiorAddOns || []),
                    ...(cartItem.exteriorAddOns || []),
                    ...(cartItem.customAddOns || [])
                ];
                allDraftAddOns.forEach(addon => {
                    let addonPrice = Number(addon.price || 0);
                    if (addonPrice > 0) addOnPayout += (addonPrice * ADDON_COMMISSION_RATE);
                });

                let totalPayout = Number((basePayout + addOnPayout).toFixed(2));
                let traineeId = cartItem.assignedTraineeId || null;
                let trainerPayout = traineeId ? Number((totalPayout * 0.60).toFixed(2)) : totalPayout;
                let traineePayout = traineeId ? Number((totalPayout * 0.40).toFixed(2)) : 0;

                let rawCon = cartItem.rawContact || hqState.globalCustomerContacts.find(c => c._id === cartItem.contactId) || {};
                let rawLoc = cartItem.rawLocation || hqState.globalCustomerLocations.find(l => l._id === cartItem.locationId) || {};
                let rawVeh = cartItem.rawVehicle || hqState.globalCustomerVehicles.find(v => v._id === cartItem.vehicleId) || {};

                let newJobPayload = {
                    userId: cartItem.customerId || hqState.currentDraft.customerId,
                    contactId: cartItem.contactId,
                    locationId: cartItem.locationId,
                    vehicleId: cartItem.vehicleId,
                    orderId: pkgId,
                    status: "Scheduled",
                    paymentStatus: "Unpaid",

                    firstName: rawCon.firstName || (cartItem.primaryContactText || "").split(" ")[0] || "Valued",
                    lastName: rawCon.lastName || "",
                    phone: rawCon.phone || "",
                    email: rawCon.email || "",

                    address1: rawLoc.address1 || cartItem.address1 || "",
                    address2: rawLoc.address2 || cartItem.address2 || "",
                    city: rawLoc.city || cartItem.city || "Local",
                    state: rawLoc.state || cartItem.state || "",
                    zip: rawLoc.zip || cartItem.zip || "",

                    vehicleYear: Number(rawVeh.year || 0) || null,
                    vehicleMake: rawVeh.make || "",
                    vehicleModel: rawVeh.model || "",
                    vehicleColor: rawVeh.color || "",
                    vehicleType: rawVeh.vehicleType || rawVeh.subCategory || cartItem.vehicleType || "",
                    vehicleCategory: rawVeh.category || rawVeh.vehicleCategory || cartItem.vehicleCategoryName || "Automotive",
                    vehicleInfo: `${rawVeh.year || ""} ${rawVeh.make || ""} ${rawVeh.model || ""} ${rawVeh.color || ""}`.replace(/\s+/g, " ").trim(),

                    packageTitle: cartItem.packageTitle,
                    packageImage: cartItem.packageImage || "",
                    level: cartItem.level,
                    type: cartItem.type,
                    setDuration: String(cartItem.setDuration || 3),

                    basePrice: Number(cartItem.basePrice || 0),
                    salePackagePrice: Number(cartItem.salePackagePrice || cartItem.basePrice || 0),
                    totalAddOnsPrice: Number(cartItem.totalAddOnsPrice || 0),
                    mobileFee: Number(cartItem.mobileFee || 0),
                    subTotal: Number(cartItem.subTotal || 0),
                    discountsTotal: Number(cartItem.discountsTotal || 0),
                    totalPrice: Number(cartItem.totalPrice || 0),

                    interiorAddOns: (cartItem.interiorAddOns || []).map(a => `${a.title} ($${Number(a.price || 0).toFixed(2)})`),
                    exteriorAddOns: (cartItem.exteriorAddOns || []).map(a => `${a.title} ($${Number(a.price || 0).toFixed(2)})`),
                    customAddOns: (cartItem.customAddOns || []).map(a => `${a.title} ($${Number(a.price || 0).toFixed(2)})`),
                    discountsApplied: (cartItem.discountsApplied || []).map(d => `${d.title} (-$${Number(d.price || 0).toFixed(2)})`),

                    serviceDate: cleanTargetDate,
                    originalScheduledDate: cleanTargetDate,
                    scheduledTime: timeString,
                    timeToken: slotToken,

                    detailerId: detailerData.trueDetailerId,
                    detailerName: detailerData.realName || detailerData.teamAlias,
                    detailerAlias: detailerData.aliasName || detailerData.teamAlias,

                    basePayout: Number(basePayout.toFixed(2)),
                    addOnPayout: Number(addOnPayout.toFixed(2)),
                    payoutTotal: totalPayout,
                    trainerPayout: trainerPayout,
                    traineePayout: traineePayout,
                    traineeId: traineeId,

                    officeNotes: cartItem.officeNotes || "",
                    wasBookedByPhone: true,
                    wasRescheduled: false
                };

                let tempId = "temp_job_" + Date.now();
                hqState.globalJobs.push({ ...newJobPayload, _id: tempId });

                await clearBookedTabFromCartAndRepeater(cartItem._id);
                generateWeeklyCalendar(hqState.currentWeekStartObj);

                let insertedJob = await secureInsertJob(newJobPayload, shouldSendEmail);
                let realJob = (insertedJob && insertedJob._id)
                    ? insertedJob
                    : (insertedJob?.item || insertedJob?.job || null);

                if (!realJob) {
                    realJob = await wixData.insert("scheduledJobs", newJobPayload).catch(() => null);
                }

                let tempIdx = hqState.globalJobs.findIndex(j => j._id === tempId);
                if (realJob && tempIdx > -1) {
                    hqState.globalJobs[tempIdx] = realJob;
                    generateWeeklyCalendar(hqState.currentWeekStartObj);
                }
                if (hqState.currentDraft.customerId) {
                    hqState.callbacks.loadCustomerHistory(hqState.currentDraft.customerId);
                }
            }
        } catch (err) {
            console.error("🚨 Error confirming daily slot action:", err);
            generateWeeklyCalendar(hqState.currentWeekStartObj);
        }
    };

    // 2. #lightboxEditButton -> "Send Email" (Saves to DB + Sends Email)
    if ($w("#lightboxEditButton").id) {
        $w("#lightboxEditButton").onClick(() => executePendingConfirmation(true));
    }

    // 3. #lightboxConfirmButton -> "Don't Send Email" (Saves to DB WITHOUT sending email)
    if ($w("#lightboxConfirmButton").id) {
        $w("#lightboxConfirmButton").onClick(() => executePendingConfirmation(false));
    }
}

let lastDailySlotClickTime = 0;

export function initDailyRepeater() {
    const $w = hqState.$w;
    if (!$w || !$w("#repDaily").id) return;
    wireDailyConfirmModalOnce();

    $w("#repDaily").onItemReady(($item, initialItemData) => {
        if ($item("#teamAlias").id) $item("#teamAlias").text = String(initialItemData?.teamAlias ?? "");

        const handleSlotButtonClick = async (slotPrefix, timeString, slotToken) => {
            // Prevent stacked onItemReady listeners from double-firing (which would create & immediately remove the "Prev" tab!)
            let now = Date.now();
            if (now - lastDailySlotClickTime < 250) return;
            lastDailySlotClickTime = now;

            // 🌟 ALWAYS read the LIVE row from #repDaily.data by detailer _id so we never use stale onItemReady closure data!
            let currentRepData = $w("#repDaily").data || [];
            let liveRow = currentRepData.find(r => String(r._id) === String(initialItemData._id)) || initialItemData;

            let jobId = slotPrefix === "am"
                ? liveRow.amJobId
                : (slotPrefix === "pm" ? liveRow.pmJobId : liveRow.thirdJobId);

            let isAvail = slotPrefix === "am"
                ? liveRow.isAmAvailable
                : (slotPrefix === "pm" ? liveRow.isPmAvailable : liveRow.isThirdAvailable);

            let activeItem = hqState.activeTabId ? hqState.draftSessions.find(d => d._id === hqState.activeTabId) : null;

            // CASE 1: Clicking an OCCUPIED slot -> Creates "Prev" tab in #tabRepeater and loads job into #bookingRep for editing!
            if (jobId) {
                if (activeItem && activeItem.isExistingBooking && String(activeItem.originalJobId) === String(jobId)) {
                    await removePrevTabAndDeselect();
                    return;
                }
                await loadExistingJobIntoCart(jobId, "Edit");
                return;
            }

            // CASE 2: Clicking an AVAILABLE slot
            if (!isAvail || !activeItem) return;

            let isResched = Boolean(
                (activeItem.isExistingBooking || activeItem.originalJobId) &&
                !activeItem.isCorrectionDraft &&
                activeItem.status !== "Completed"
            );

            if (activeItem.isExistingBooking && !activeItem.isReschedulingMode) return;

            if (!isResched && !activeItem.isCorrectionDraft && (!activeItem.packageId || activeItem.packageTitle === "No Package Selected")) {
                return;
            }

            let targetDateObj = new Date(hqState.selectedCalendarDate);
            let dateFormatted = targetDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
            let actionType = activeItem.isCorrectionDraft ? "correction" : (isResched ? "reschedule" : "book");
            let headerTitle = actionType === "correction"
                ? "Confirm Correction Schedule"
                : (actionType === "reschedule" ? "Confirm Reschedule" : "Confirm New Booking");

            let summaryHtml = `<h4 style="font-family: Arial; color: #FFFFFF;">${headerTitle}</h4>
            <ul style="font-family: Arial; font-size: 14px; line-height: 1.8; color: #EBEBEB;">
                <li><b style="color: #FFFFFF;">Date & Time:</b> ${dateFormatted} @ ${timeString}</li>
                <li><b style="color: #FFFFFF;">Detailer:</b> ${liveRow.teamAlias}</li>
                <li><b style="color: #FFFFFF;">Package:</b> ${activeItem.packageTitle || "Detail"}</li>
                <li><b style="color: #FFFFFF;">Customer:</b> ${formatBookingCustomerText(activeItem)}</li>
                <li><b style="color: #FFFFFF;">Vehicle:</b> ${formatBookingVehicleText(activeItem)}</li>
                <li><b style="color: #FFFFFF;">Total Price:</b> $${Number(activeItem.totalPrice || 0).toFixed(2)}</li>
            </ul>`;

            if ($w("#lightboxText").id) $w("#lightboxText").html = summaryHtml;
            if ($w("#cancelReasonInput").id) $w("#cancelReasonInput").collapse();

            if ($w("#lightboxEditButton").id) {
                $w("#lightboxEditButton").label = "Send Email";
                $w("#lightboxEditButton").enable();
            }
            if ($w("#lightboxConfirmButton").id) {
                $w("#lightboxConfirmButton").label = "Don't Send Email";
                $w("#lightboxConfirmButton").enable();
            }

            hqState.pendingJobUpdate = {
                action: actionType,
                cartItem: activeItem,
                targetDateObj: targetDateObj,
                timeString: timeString,
                slotToken: slotToken,
                detailerData: liveRow
            };

            safeOpenOffice("bookingConfirm");
        };

        let s1Token = hqState.globalTimeSlots[0]?.token || "token_1";
        let s2Token = hqState.globalTimeSlots[1]?.token || "token_2";
        let s3Token = hqState.globalTimeSlots[2]?.token || "token_3";

        if ($item("#amButton").id) {
            $item("#amButton").onClick(() => handleSlotButtonClick("am", "9-11am Arrival", s1Token));
        }
        if ($item("#pmButton").id) {
            $item("#pmButton").onClick(() => handleSlotButtonClick("pm", "1-3pm Arrival", s2Token));
        }
        if ($item("#thirdButton").id) {
            $item("#thirdButton").onClick(() => handleSlotButtonClick("third", "4-6pm Arrival", s3Token));
        }
    });
}