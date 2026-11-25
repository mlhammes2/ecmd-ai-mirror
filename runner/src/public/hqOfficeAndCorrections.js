// --- public/hqOfficeAndCorrections.js ---

import wixData from 'wix-data';
import { formatPhoneNumber } from 'public/cartEngine';
import {
    hqState,
    parseTags,
    formatPrevPackageAbbrev,
    formatPrevVehicleShort,
    formatBookingVehicleText,
    closeAllLightboxes
} from 'public/hqState';
import {
    createNewTab,
    renderTabs,
    switchTab,
    loadExistingJobIntoCart,
    hasDetailAttached
} from 'public/hqTabsAndCart';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

let lastPrevRepClickTime = 0;
let pendingCorrectionJob = null;
let tempCorrectionItems = [];
let tempCorrectionImages = [];
let tempCorrectionDetailerId = null;
let tempCorrectionDetailerName = "";
let tempCorrectionPayout = 0;
let isCorrectionRepInitialized = false;
let isCorrectionDetailerRepInitialized = false;
let isOfficeRepInitialized = false;

registerModuleState("hqOfficeAndCorrections", () => ({
    selectedPreviousJobId: hqState.selectedPreviousJobId || null,
    hasPendingCorrectionJob: Boolean(pendingCorrectionJob),
    pendingCorrectionJobId: pendingCorrectionJob ? pendingCorrectionJob._id : null,
    tempCorrectionItems,
    tempCorrectionImagesCount: (tempCorrectionImages || []).length,
    tempCorrectionDetailerId,
    tempCorrectionDetailerName,
    tempCorrectionPayout,
    isCorrectionRepInitialized,
    isCorrectionDetailerRepInitialized,
    isOfficeRepInitialized
}));

registerDomElements({
    boxes: ["#officeMenu", "#officeBox", "#correctionDetailerMenu"],
    repeaters: ["#previousRep", "#officeRep", "#correctionRep", "#correctionDetailerRep"],
    inputs: ["#correctionItemInput", "#correctionDetailerPayInput", "#newNotes"]
});

export function padPreviousJobsList(jobs = []) {
    let list = [...jobs];
    while (list.length < 3) {
        list.push({
            _id: `empty_prev_slot_${list.length + 1}`,
            isPlaceholder: true
        });
    }
    return list;
}

export function formatPrevDateText(job) {
    if (!job || !job.serviceDate) return "---";
    let d = new Date(job.serviceDate);
    if (isNaN(d.getTime())) return "---";
    return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
}

export function renderPreviousJobSummary(job) {
    const $w = hqState.$w;
    if (!$w || !$w("#previousRepSummary").id) return;

    if (!job) {
        $w("#previousRepSummary").html = `<p style="font-family: Arial; font-size: 13px; color: #000000;"><b>No Job Selected</b></p>`;
        return;
    }

    const indent = "&nbsp;&nbsp;&nbsp;&nbsp;";

    let dateObj = job.serviceDate ? new Date(job.serviceDate) : null;
    let dateStr = (dateObj && !isNaN(dateObj.getTime()))
        ? dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
        : "Unknown Date";
    let timeStr = job.scheduledTime || "Unscheduled Time";
    let statusStr = job.status || "Scheduled";
    let payStr = job.paymentStatus || "Un-Paid";
    let contractorStr = job.detailerName || job.detailer || job.detailerAlias || "Unassigned";
    let durationStr = `${job.setDuration || job.totalDuration || "3"} Hrs`;
    let sourceStr = job.wasBookedByPhone === false ? "Customer Online Booking" : "Office Phone Booking";
    let subStr = (job.isSubscription === true || job.isSubscription === "Yes" || job.isSubscription === "true") ? "Yes" : "No";

    let customerName = `${job.firstName || ""} ${job.lastName || ""}`.trim() || "Unknown Customer";
    let phoneStr = job.phone ? formatPhoneNumber(job.phone) : "No Phone";

    // Location: Line break after "Location:" and after address2 (or address1 if no address2), with each line indented
    let streetLine = [job.address1, job.address2].filter(Boolean).join(" ").trim();
    let cityStateZip = `${job.city || ""}${job.city && job.state ? ", " : ""}${job.state || ""} ${job.zip || ""}`.trim();
    let locationHtml = "";
    if (streetLine && cityStateZip) {
        locationHtml = `<br/>${indent}${streetLine}<br/>${indent}${cityStateZip}`;
    } else if (streetLine || cityStateZip) {
        locationHtml = `<br/>${indent}${streetLine || cityStateZip}`;
    } else if (job.locationText) {
        locationHtml = `<br/>${indent}${job.locationText}`;
    } else {
        locationHtml = ` Unknown Location`;
    }

    let fullVeh = job.vehicleInfo || `${job.vehicleYear || ""} ${job.vehicleMake || ""} ${job.vehicleModel || ""} ${job.vehicleColor || ""}`.replace(/\s+/g, " ").trim() || "Unknown Vehicle";

    // Line break after title (unless "None") and indent each item line
    const formatMultiLineList = (title, arr) => {
        if (!Array.isArray(arr) || arr.length === 0) {
            return `<b>${title}:</b> None`;
        }
        return `<b>${title}:</b><br/>${arr.map(item => `${indent}${item}`).join("<br/>")}`;
    };

    let lines = [
        `<b>Package:</b> ${job.packageTitle || formatPrevPackageAbbrev(job)}`,
        `<b>Subscription:</b> ${subStr}`,
        `<b>Date:</b> ${dateStr}`,
        `<b>Time:</b> ${timeStr}`,
        `<b>Job Status:</b> ${statusStr}`,
        `<b>Payment Status:</b> ${payStr}`,
        `<b>Contractor:</b> ${contractorStr}`,
        `<b>Duration:</b> ${durationStr}`,
        `<b>Source:</b> ${sourceStr}`,
        `<b>Customer:</b> ${customerName}`,
        `<b>Phone:</b> ${phoneStr}`,
        `<b>Location:</b>${locationHtml}`,
        `<b>Vehicle:</b> ${fullVeh}`,
        `<b>Base Price:</b> $${Number(job.basePrice || 0).toFixed(2)}`
    ];

    if (Number(job.salePackagePrice || 0) > 0) {
        lines.push(`<b>Sale Price:</b> $${Number(job.salePackagePrice).toFixed(2)}`);
    }
    if (Number(job.mobileFee || 0) > 0) {
        lines.push(`<b>Mobile Fee:</b> $${Number(job.mobileFee).toFixed(2)}`);
    }

    lines.push(formatMultiLineList("Interior Add-Ons", job.interiorAddOns));
    lines.push(formatMultiLineList("Exterior Add-Ons", job.exteriorAddOns));

    if (Array.isArray(job.customAddOns) && job.customAddOns.length > 0) {
        lines.push(formatMultiLineList("Custom Add-Ons", job.customAddOns));
    }

    lines.push(formatMultiLineList("Discounts Applied", job.discountsApplied));
    lines.push(`<b>Total Price:</b> $${Number(job.totalPrice || 0).toFixed(2)}`);

    if (job.specialInstructions && String(job.specialInstructions).trim() !== "") {
        lines.push(`<b>Special Instructions:</b><br/>${indent}${job.specialInstructions}`);
    }
    if (job.officeNotes && String(job.officeNotes).trim() !== "") {
        lines.push(`<b>Office Notes:</b><br/>${indent}${job.officeNotes}`);
    }

    $w("#previousRepSummary").html = `<p style="font-family: Arial; font-size: 13px; line-height: 1.6; color: #000000; margin: 0;">${lines.join("<br/>")}</p>`;
}

export function syncPreviousRepButtons() {
    const $w = hqState.$w;
    if (!$w || !$w("#previousRep").id) return;

    $w("#previousRep").forEachItem(($item, itemData) => {
        let isSelected = Boolean(hqState.selectedPreviousJobId && String(itemData._id) === String(hqState.selectedPreviousJobId));
        if ($item("#previousRepItem").id) {
            $item("#previousRepItem").style.borderColor = isSelected ? "#1A6AFF" : "#FFFFFF";
        }
    });
}

export function initPreviousCustomerJobsRepeater() {
    const $w = hqState.$w;
    if (!$w || !$w("#previousRep").id) return;

    $w("#previousRep").onItemReady(($item, itemData) => {
        let isSelected = Boolean(hqState.selectedPreviousJobId && String(itemData._id) === String(hqState.selectedPreviousJobId));
        let borderColor = isSelected ? "#1A6AFF" : "#FFFFFF";

        if ($item("#previousRepItem").id) {
            $item("#previousRepItem").style.borderColor = borderColor;
        }

        if (itemData.isPlaceholder) {
            if ($item("#previousRepBox").id) {
                $item("#previousRepBox").style.backgroundColor = "#6E6E6E";
            }
            if ($item("#previousRepPackage").id) $item("#previousRepPackage").text = "---";
            if ($item("#previousRepVehicle").id) $item("#previousRepVehicle").text = "---";
            if ($item("#previousRepDate").id) $item("#previousRepDate").text = "---";
            if ($item("#previousRepPrice").id) $item("#previousRepPrice").text = "---";
        } else {
            let isCompleted = (itemData.status === "Completed");
            let isPaid = (itemData.paymentStatus === "Paid");
            let boxColor = "#1FE7B0";

            if (isCompleted && isPaid) {
                boxColor = "#128FB1";
            } else if (isCompleted && !isPaid) {
                boxColor = "#B30000";
            }

            if ($item("#previousRepBox").id) {
                $item("#previousRepBox").style.backgroundColor = boxColor;
            }
            if ($item("#previousRepPackage").id) {
                $item("#previousRepPackage").text = formatPrevPackageAbbrev(itemData);
            }
            if ($item("#previousRepVehicle").id) {
                $item("#previousRepVehicle").text = formatPrevVehicleShort(itemData);
            }
            if ($item("#previousRepDate").id) {
                $item("#previousRepDate").text = formatPrevDateText(itemData);
            }
            if ($item("#previousRepPrice").id) {
                $item("#previousRepPrice").text = `$${Number(itemData.totalPrice || 0).toFixed(0)}`;
            }
        }

        if ($item("#previousRepButton").id) {
            $item("#previousRepButton").label = "";
            $item("#previousRepButton").enable();

            $item("#previousRepButton").onClick(() => {
                let now = Date.now();
                if (now - lastPrevRepClickTime < 250) return;
                lastPrevRepClickTime = now;

                if (hqState.selectedPreviousJobId && String(hqState.selectedPreviousJobId) === String(itemData._id)) {
                    hqState.selectedPreviousJobId = null;
                    syncPreviousRepButtons();
                    renderPreviousJobSummary(null);
                    refreshOfficeMenuRepeater();
                } else {
                    hqState.selectedPreviousJobId = itemData._id;
                    syncPreviousRepButtons();
                    renderPreviousJobSummary(itemData.isPlaceholder ? null : itemData);
                    refreshOfficeMenuRepeater();
                }
            });
        }
    });

    $w("#previousRep").data = padPreviousJobsList([]);
    $w("#previousRep").expand();
}

export async function loadCustomerHistory(userId) {
    const $w = hqState.$w;
    if (!$w) return;

    let jobsRes = await wixData.query("scheduledJobs")
        .eq("userId", userId)
        .ne("status", "Cancelled")
        .descending("serviceDate")
        .find();

    let jobs = jobsRes.items || [];

    jobs.sort((a, b) => {
        let dateA = new Date(a.serviceDate || 0).getTime();
        let dateB = new Date(b.serviceDate || 0).getTime();
        if (dateA !== dateB) return dateB - dateA;

        let timeScoreA = (a.scheduledTime || "").includes("1-3") ? 1 : 0;
        let timeScoreB = (b.scheduledTime || "").includes("1-3") ? 1 : 0;
        return timeScoreB - timeScoreA;
    });

    let realJobs = jobs.filter(j => !j._id.startsWith("mock_job"));
    if (realJobs.length > 0 && $w("#firstDetailDate").id) {
        let firstJob = realJobs[realJobs.length - 1];
        let d = new Date(firstJob.serviceDate);
        $w("#firstDetailDate").text = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    } else {
        if ($w("#firstDetailDate").id) $w("#firstDetailDate").text = "No Previous Details";
    }

    if ($w("#previousRep").id) {
        hqState.selectedPreviousJobId = null;
        $w("#previousRep").data = padPreviousJobsList(jobs);
        $w("#previousRep").expand();

        syncPreviousRepButtons();
        renderPreviousJobSummary(null);
        refreshOfficeMenuRepeater();
    }

    if ($w("#pRepeater").id) {
        $w("#pRepeater").data = jobs;
        if (jobs.length > 0) {
            $w("#pRepeater").expand();
        } else {
            $w("#pRepeater").collapse();
        }
        if ($w("#prevDetailsTitle").id) {
            $w("#prevDetailsTitle").text = `Previous Details (${jobs.length})`;
        }
    }
}

export function closeOfficeMenu() {
    const $w = hqState.$w;
    if ($w && $w("#officeMenu").id && !$w("#officeMenu").hidden) {
        $w("#officeMenu").hide("fade", { duration: 150 });
    }
}

export async function rebookSelectedPreviousJob() {
    const $w = hqState.$w;
    if (!$w || !hqState.selectedPreviousJobId) return;

    let repData = $w("#previousRep").id ? ($w("#previousRep").data || []) : [];
    let selectedJob = repData.find(j => String(j._id) === String(hqState.selectedPreviousJobId) && !j.isPlaceholder);
    if (!selectedJob) return;

    hqState.newTabCounter = (hqState.newTabCounter || 0) + 1;
    let tabNum = hqState.newTabCounter;
    let newTabId = "draft_" + Date.now().toString();

    let contactStr = selectedJob.firstName
        ? `${selectedJob.firstName} ${selectedJob.lastName || ""} - ${formatPhoneNumber(selectedJob.phone)}`.trim()
        : (hqState.currentDraft.primaryContactText || "Pending Contact...");
    if (contactStr.endsWith("-")) contactStr = contactStr.slice(0, -1).trim();

    let locationStr = selectedJob.address1
        ? `${selectedJob.address1}, ${selectedJob.city || ""} ${selectedJob.state || ""}`.trim()
        : (selectedJob.locationText || "Pending Location...");

    let matchedPkg = hqState.globalPackages.find(p =>
        p._id === selectedJob.orderId ||
        (p.title || "").toLowerCase().trim() === (selectedJob.packageTitle || "").toLowerCase().trim()
    );

    let rawCon = hqState.globalCustomerContacts.find(c => c._id === selectedJob.contactId) || null;
    let rawLoc = hqState.globalCustomerLocations.find(l => l._id === selectedJob.locationId) || null;
    let rawVeh = hqState.globalCustomerVehicles.find(v => v._id === selectedJob.vehicleId) || null;

    let rebookedDraft = {
        _id: newTabId,
        editingCartId: newTabId,
        isJob: true,
        emptyTabNumber: tabNum,
        label: `New Tab ${tabNum}`,
        status: "Scheduled",
        isExistingBooking: false,
        isReschedulingMode: false,
        isEditingOnly: false,
        originalJobId: null,

        customerId: selectedJob.userId || hqState.currentDraft.customerId,
        primaryContactText: contactStr,
        vehicleId: selectedJob.vehicleId || hqState.currentDraft.vehicleId,
        contactId: selectedJob.contactId || hqState.currentDraft.contactId,
        locationId: selectedJob.locationId || hqState.currentDraft.locationId,

        resolvedVehicle: selectedJob.vehicleInfo || formatBookingVehicleText({ rawVehicle: rawVeh, vehicleId: selectedJob.vehicleId }),
        resolvedContact: contactStr,
        resolvedLocation: locationStr,
        rawContact: rawCon,
        rawLocation: rawLoc,
        rawVehicle: rawVeh,

        address1: selectedJob.address1 || "",
        address2: selectedJob.address2 || "",
        city: selectedJob.city || "",
        state: selectedJob.state || "",
        zip: selectedJob.zip || "",

        packageId: matchedPkg ? matchedPkg._id : (selectedJob.orderId || null),
        packageTitle: selectedJob.packageTitle || formatPrevPackageAbbrev(selectedJob) || "Previous Detail",
        level: selectedJob.level || (matchedPkg ? matchedPkg.packageLevel : "Classic"),
        type: selectedJob.type || (matchedPkg ? matchedPkg.detailType : "Full"),

        basePrice: Number(selectedJob.basePrice || selectedJob.totalPrice || 0),
        salePackagePrice: Number(selectedJob.salePackagePrice || 0),
        mobileFee: Number(selectedJob.mobileFee || 0),
        subTotal: Number(selectedJob.subTotal || selectedJob.totalPrice || 0),
        discountsTotal: Number(selectedJob.discountsTotal || 0),
        totalPrice: Number(selectedJob.totalPrice || 0),
        setDuration: String(selectedJob.setDuration || selectedJob.totalDuration || "3"),
        totalAddOnsPrice: Number(selectedJob.totalAddOnsPrice || 0),

        interiorAddOns: parseTags(selectedJob.interiorAddOns),
        exteriorAddOns: parseTags(selectedJob.exteriorAddOns),
        customAddOns: parseTags(selectedJob.customAddOns),
        discountsApplied: parseTags(selectedJob.discountsApplied),

        officeNotes: selectedJob.officeNotes || "",
        vehicleNotes: "",
        assignedDate: null,
        assignedTime: null,
        assignedDetailerId: null,
        wasBookedByPhone: true
    };

    hqState.draftSessions.unshift(rebookedDraft);
    hqState.globalCart = hqState.draftSessions;

    renderTabs(true);
    await switchTab(newTabId, true);
}

export async function rescheduleSelectedPreviousJob() {
    const $w = hqState.$w;
    if (!$w || !hqState.selectedPreviousJobId) return;

    let repData = $w("#previousRep").id ? ($w("#previousRep").data || []) : [];
    let selectedJob = repData.find(j => String(j._id) === String(hqState.selectedPreviousJobId) && !j.isPlaceholder);

    if (!selectedJob || selectedJob.status === "Completed") return;

    if (!hqState.globalJobs.some(j => String(j._id) === String(selectedJob._id))) {
        hqState.globalJobs.push(selectedJob);
    }

    await loadExistingJobIntoCart(selectedJob._id, "Reschedule");
    closeAllLightboxes();

    if ($w("#msbCustomer").id && $w("#msbCustomer").currentState?.id !== "bCalendar") {
        $w("#msbCustomer").changeState("bCalendar");
    }
}

export function syncCorrectionPayUIState() {
    const $w = hqState.$w;
    if (!$w || !pendingCorrectionJob) return;

    let originalDetId = pendingCorrectionJob.detailerId || null;
    let isNewDetailerSelected = Boolean(
        tempCorrectionDetailerId &&
        String(tempCorrectionDetailerId) !== String(originalDetId)
    );

    if (isNewDetailerSelected) {
        if ($w("#correctionDetailerPayInput").id) $w("#correctionDetailerPayInput").enable();
        if ($w("#correctionDetailerPaySubmit").id) $w("#correctionDetailerPaySubmit").enable();
    } else {
        tempCorrectionPayout = 0;
        if ($w("#correctionDetailerPayInput").id) {
            $w("#correctionDetailerPayInput").value = "";
            $w("#correctionDetailerPayInput").disable();
        }
        if ($w("#correctionDetailerPaySubmit").id) {
            $w("#correctionDetailerPaySubmit").disable();
        }
    }

    if ($w("#correctionDetailerSelectButton").id) {
        $w("#correctionDetailerSelectButton").label = tempCorrectionDetailerName
            ? `Detailer: ${tempCorrectionDetailerName}`
            : "Select Detailer";
    }
}

export function refreshCorrectionRepeater() {
    const $w = hqState.$w;
    if (!$w || !$w("#correctionRep").id) return;

    let originalDetId = pendingCorrectionJob ? pendingCorrectionJob.detailerId : null;
    let isOriginal = !tempCorrectionDetailerId || String(tempCorrectionDetailerId) === String(originalDetId);
    let detDisplay = tempCorrectionDetailerName || "Unassigned";
    let roleTag = isOriginal ? " (Original)" : " (Reassigned)";
    let payDisplay = `$${Number(tempCorrectionPayout || 0).toFixed(2)}`;

    let headerRow = {
        _id: `corr_pay_header_${Date.now()}`,
        isPayHeader: true,
        index: -1,
        text: `Detailer: ${detDisplay}${roleTag}  |  Pay: ${payDisplay}`
    };

    let itemRows = tempCorrectionItems.map((txt, idx) => ({
        _id: `corr_item_${idx}_${Date.now()}`,
        isPayHeader: false,
        index: idx,
        text: txt
    }));

    let repData = [headerRow, ...itemRows];
    $w("#correctionRep").data = repData;

    $w("#correctionRep").expand();
    if ($w("#correctionRep").hidden) {
        $w("#correctionRep").show();
    }
}

export function initCorrectionRepeater() {
    const $w = hqState.$w;
    if (!$w || isCorrectionRepInitialized || !$w("#correctionRep").id) return;
    isCorrectionRepInitialized = true;

    $w("#correctionRep").onItemReady(($item, itemData) => {
        if ($item("#correctionRepText").id) {
            $item("#correctionRepText").text = itemData.text || "";
        }

        if (itemData.isPayHeader) {
            if ($item("#correctionDelete").id) {
                $item("#correctionDelete").hide();
            }
            if ($item("#correctionTextButton").id) {
                $item("#correctionTextButton").label = "";
                $item("#correctionTextButton").onClick(() => {
                    if ($w("#correctionDetailerPayInput").id && $w("#correctionDetailerPayInput").enabled) {
                        $w("#correctionDetailerPayInput").value = tempCorrectionPayout > 0 ? String(tempCorrectionPayout) : "";
                        $w("#correctionDetailerPayInput").focus();
                    }
                });
            }
        } else {
            if ($item("#correctionDelete").id) {
                $item("#correctionDelete").show();
                $item("#correctionDelete").onClick(() => {
                    tempCorrectionItems.splice(itemData.index, 1);
                    refreshCorrectionRepeater();
                    if ($w("#correctionItemInput").id) $w("#correctionItemInput").focus();
                });
            }

            if ($item("#correctionTextButton").id) {
                $item("#correctionTextButton").label = "";
                $item("#correctionTextButton").onClick(() => {
                    tempCorrectionItems.splice(itemData.index, 1);
                    refreshCorrectionRepeater();
                    if ($w("#correctionItemInput").id) {
                        $w("#correctionItemInput").value = itemData.text || "";
                        $w("#correctionItemInput").focus();
                    }
                });
            }
        }
    });
}

export function initCorrectionDetailerMenu() {
    const $w = hqState.$w;
    if (!$w || isCorrectionDetailerRepInitialized) return;
    isCorrectionDetailerRepInitialized = true;

    if ($w("#correctionDetailerMenu").id) {
        $w("#correctionDetailerMenu").hide();
    }

    if ($w("#correctionDetailerSelectButton").id) {
        $w("#correctionDetailerSelectButton").onClick(() => {
            if (!$w("#correctionDetailerMenu").id) return;
            if ($w("#correctionDetailerMenu").hidden || $w("#correctionDetailerMenu").collapsed) {
                if ($w("#correctionDetailerMenu").collapsed) $w("#correctionDetailerMenu").expand();
                $w("#correctionDetailerMenu").show("fade", { duration: 150 });
            } else {
                $w("#correctionDetailerMenu").hide("fade", { duration: 150 });
            }
        });
    }

    if ($w("#correctionDetailerRep").id) {
        $w("#correctionDetailerRep").onItemReady(($item, itemData) => {
            let detName = itemData.first || itemData.firstName || itemData.title || "Detailer";
            let lastInitial = itemData.last ? ` ${itemData.last.charAt(0).toUpperCase()}.` : "";
            let fullLabel = `${detName}${lastInitial}`.trim();

            if ($item("#correctionDetailerButton").id) {
                $item("#correctionDetailerButton").label = fullLabel;
                $item("#correctionDetailerButton").enable();

                $item("#correctionDetailerButton").onClick(() => {
                    tempCorrectionDetailerId = itemData._id;
                    tempCorrectionDetailerName = detName;

                    if ($w("#correctionDetailerMenu").id) {
                        $w("#correctionDetailerMenu").hide("fade", { duration: 150 });
                    }

                    syncCorrectionPayUIState();
                    refreshCorrectionRepeater();

                    if ($w("#correctionDetailerPayInput").id && $w("#correctionDetailerPayInput").enabled) {
                        $w("#correctionDetailerPayInput").focus();
                    }
                });
            }
        });
    }
}

export function populateCorrectionDetailerRepeater() {
    const $w = hqState.$w;
    if (!$w || !$w("#correctionDetailerRep").id) return;
    let sortedDetailers = [...hqState.globalDetailers].sort((a, b) => (Number(a.sort || 99)) - (Number(b.sort || 99)));
    $w("#correctionDetailerRep").data = sortedDetailers;
}

export function renderCorrectionDescription(job) {
    const $w = hqState.$w;
    if (!$w || !$w("#correctionDescription").id) return;

    if (!job) {
        $w("#correctionDescription").html = `<p style="font-family: Arial; font-size: 13px; color: #000000;"><b>No Job Selected</b></p>`;
        return;
    }

    let dateObj = job.serviceDate ? new Date(job.serviceDate) : null;
    let dateStr = (dateObj && !isNaN(dateObj.getTime()))
        ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : "Unknown Date";

    let pkgTitle = job.packageTitle || formatPrevPackageAbbrev(job);
    let detailerStr = job.detailerName || job.detailer || job.detailerAlias || "Unassigned";
    let cityStr = job.city || job.locationText || "Unknown City";
    let addrStr = job.address1 ? `${job.address1}, ${cityStr}` : cityStr;

    let vehStr = job.vehicleInfo || `${job.vehicleYear || ""} ${job.vehicleMake || ""} ${job.vehicleModel || ""} ${job.vehicleColor || ""}`.replace(/\s+/g, " ").trim() || "Unknown Vehicle";
    let customerName = `${job.firstName || ""} ${job.lastName || ""}`.trim() || "Unknown Customer";
    let phoneStr = job.phone ? formatPhoneNumber(job.phone) : "";

    let lines = [
        `<b>Package:</b> ${pkgTitle} &nbsp;|&nbsp; <b>Date:</b> ${dateStr}`,
        `<b>Original Detailer:</b> ${detailerStr}`,
        `<b>Vehicle:</b> ${vehStr}`,
        `<b>Location:</b> ${addrStr}`,
        `<b>Customer:</b> ${customerName}${phoneStr ? " (" + phoneStr + ")" : ""}`
    ];

    $w("#correctionDescription").html = `<p style="font-family: Arial; font-size: 13px; line-height: 1.6; color: #000000; margin: 0;">${lines.join("<br/>")}</p>`;
}

export function openCorrectionBoxForJob(selectedJob) {
    const $w = hqState.$w;
    if (!$w) return;

    pendingCorrectionJob = selectedJob;
    tempCorrectionItems = Array.isArray(selectedJob.correctionItems) ? [...selectedJob.correctionItems] : [];
    tempCorrectionImages = Array.isArray(selectedJob.correctionImages) ? [...selectedJob.correctionImages] : [];

    tempCorrectionDetailerId = selectedJob.correctionDetailerId || selectedJob.detailerId || null;
    tempCorrectionDetailerName = selectedJob.correctionDetailerName || selectedJob.detailerName || selectedJob.detailer || "Unassigned";

    let isDifferentDetailer = Boolean(
        tempCorrectionDetailerId &&
        String(tempCorrectionDetailerId) !== String(selectedJob.detailerId)
    );
    tempCorrectionPayout = isDifferentDetailer ? Number(selectedJob.correctionPayout || 0) : 0;

    initCorrectionRepeater();
    initCorrectionDetailerMenu();
    populateCorrectionDetailerRepeater();
    renderCorrectionDescription(selectedJob);

    if ($w("#correctionDetailerMenu").id && !$w("#correctionDetailerMenu").hidden) {
        $w("#correctionDetailerMenu").hide();
    }

    if ($w("#correctionItemInput").id) {
        $w("#correctionItemInput").value = "";
        $w("#correctionItemInput").style.borderColor = "#000000";
    }
    if ($w("#correctionDetailerPayInput").id) {
        $w("#correctionDetailerPayInput").value = tempCorrectionPayout > 0 ? String(tempCorrectionPayout) : "";
    }

    syncCorrectionPayUIState();

    if ($w("#msbOffice").id) {
        $w("#msbOffice").changeState("correctionBox").then(() => {
            refreshCorrectionRepeater();
            if ($w("#correctionItemInput").id) $w("#correctionItemInput").focus();
        });
        $w("#msbOffice").expand();
    } else {
        refreshCorrectionRepeater();
    }

    if ($w("#officeBox").id) {
        $w("#officeBox").expand();
        $w("#officeBox").show();
    }

    if ($w("#lightboxBackground").id) {
        $w("#lightboxBackground").expand();
        if ($w("#lightboxBackground").hidden) {
            $w("#lightboxBackground").show("fade", { duration: 200 }).catch(() => {});
        }
    }
}

export async function createCorrectionTabFromJob(selectedJob, correctionItemsList, correctionImagesList, payoutAmount, assignedDetId, assignedDetName) {
    if (!selectedJob) return;

    let newTabId = "corr_" + Date.now().toString();
    let contactStr = selectedJob.firstName
        ? `${selectedJob.firstName} ${selectedJob.lastName || ""} - ${formatPhoneNumber(selectedJob.phone)}`.trim()
        : (hqState.currentDraft.primaryContactText || "Pending Contact...");
    if (contactStr.endsWith("-")) contactStr = contactStr.slice(0, -1).trim();

    let locationStr = selectedJob.address1
        ? `${selectedJob.address1}, ${selectedJob.city || ""} ${selectedJob.state || ""}`.trim()
        : (selectedJob.locationText || "Pending Location...");

    let rawCon = hqState.globalCustomerContacts.find(c => c._id === selectedJob.contactId) || null;
    let rawLoc = hqState.globalCustomerLocations.find(l => l._id === selectedJob.locationId) || null;
    let rawVeh = hqState.globalCustomerVehicles.find(v => v._id === selectedJob.vehicleId) || null;

    let finalPay = Number(payoutAmount || 0);
    let finalDetId = assignedDetId || selectedJob.detailerId || null;
    let finalDetName = assignedDetName || selectedJob.detailerName || "Unassigned";

    let displayAddOns = [
        { title: `Detailer: ${finalDetName} | Pay: $${finalPay.toFixed(2)}`, price: 0 },
        ...(correctionItemsList || []).map(txt => ({ title: txt, price: 0 }))
    ];

    let corrDraft = {
        _id: newTabId,
        editingCartId: newTabId,
        isJob: true,
        label: "Corr",
        status: "Correction",
        isExistingBooking: false,
        isCorrectionDraft: true,
        isReschedulingMode: false,
        isEditingOnly: false,
        originalJobId: selectedJob._id,

        customerId: selectedJob.userId || hqState.currentDraft.customerId,
        primaryContactText: contactStr,
        vehicleId: selectedJob.vehicleId || hqState.currentDraft.vehicleId,
        contactId: selectedJob.contactId || hqState.currentDraft.contactId,
        locationId: selectedJob.locationId || hqState.currentDraft.locationId,

        resolvedVehicle: selectedJob.vehicleInfo || formatBookingVehicleText({ rawVehicle: rawVeh, vehicleId: selectedJob.vehicleId }),
        resolvedContact: contactStr,
        resolvedLocation: locationStr,
        rawContact: rawCon,
        rawLocation: rawLoc,
        rawVehicle: rawVeh,

        address1: selectedJob.address1 || "",
        address2: selectedJob.address2 || "",
        city: selectedJob.city || "",
        state: selectedJob.state || "",
        zip: selectedJob.zip || "",

        packageId: selectedJob.orderId || null,
        packageTitle: `CORRECTION: ${selectedJob.packageTitle || formatPrevPackageAbbrev(selectedJob) || "Detail"}`,
        level: "Correction",
        type: selectedJob.type || "Full",

        basePrice: 0,
        salePackagePrice: 0,
        mobileFee: 0,
        subTotal: 0,
        discountsTotal: 0,
        totalPrice: 0,
        setDuration: "1",
        totalAddOnsPrice: 0,

        interiorAddOns: displayAddOns,
        exteriorAddOns: [],
        customAddOns: [],
        discountsApplied: [],

        correctionItems: [...(correctionItemsList || [])],
        correctionImages: [...(correctionImagesList || [])],
        correctionPayout: finalPay,
        correctionDetailerId: finalDetId,
        correctionDetailerName: finalDetName,

        officeNotes: selectedJob.officeNotes || "",
        vehicleNotes: "",
        assignedDate: null,
        assignedTime: null,
        assignedDetailerId: finalDetId,
        wasBookedByPhone: true
    };

    hqState.draftSessions.unshift(corrDraft);
    hqState.globalCart = hqState.draftSessions;

    renderTabs(true);
    await switchTab(newTabId, true);
}

export function refreshOfficeMenuRepeater() {
    const $w = hqState.$w;
    if (!$w || !$w("#officeRep").id) return;

    let baseButtons = hqState.globalOfficeButtons.length > 0 ? [...hqState.globalOfficeButtons] : [
        { _id: "off_add_tab", title: "Add New Tab", sort: 0 },
        { _id: "off_detail", title: "Edit or Add Detail", sort: 1 },
        { _id: "off_resched", title: "Reschedule", sort: 2 },
        { _id: "off_rebook", title: "Rebook", sort: 3 },
        { _id: "off_corr", title: "Schedule Correction", sort: 4 },
        { _id: "off_notes", title: "Office Notes", sort: 5 },
        { _id: "off_clear", title: "Clear Customer", sort: 6 },
        { _id: "off_close", title: "Close", sort: 7 }
    ];

    // Ensure "Add New Tab" and "Edit or Add Detail" are included even if not in #siteButtons CMS yet
    if (!baseButtons.some(b => {
        let t = String(b.title || "").toLowerCase();
        return t.includes("add new tab") || t.includes("new tab");
    })) {
        baseButtons.unshift({ _id: "off_add_tab", title: "Add New Tab", sort: 0 });
    }

    if (!baseButtons.some(b => String(b.title || "").toLowerCase().includes("detail"))) {
        baseButtons.push({ _id: "off_detail", title: "Edit or Add Detail", sort: 1 });
    }

    baseButtons.sort((a, b) => {
        if (a.sort !== undefined && b.sort !== undefined && a.sort !== b.sort) {
            return String(a.sort).localeCompare(String(b.sort), undefined, { numeric: true });
        }
        return String(a.title || "").localeCompare(String(b.title || ""));
    });

    let repData = $w("#previousRep").id ? ($w("#previousRep").data || []) : [];
    let selectedJob = hqState.selectedPreviousJobId
        ? repData.find(j => String(j._id) === String(hqState.selectedPreviousJobId) && !j.isPlaceholder)
        : null;

    let canReschedule = Boolean(selectedJob && selectedJob.status !== "Completed");

    let activeItem = hqState.activeTabId
        ? hqState.draftSessions.find(d => d._id === hqState.activeTabId)
        : (hqState.draftSessions[0] || null);
    let detailAttached = hasDetailAttached(activeItem);

    // Map dynamic "Edit Detail" / "Add a Detail" displayLabel onto the detail button
    let visibleButtons = baseButtons
        .filter(btn => {
            let t = String(btn.title || "").toLowerCase();
            if (t.includes("reschedule")) {
                return canReschedule;
            }
            return true;
        })
        .map(btn => {
            let t = String(btn.title || "").toLowerCase();
            if (t.includes("detail")) {
                return {
                    ...btn,
                    displayLabel: detailAttached ? "Edit Detail" : "Add a Detail"
                };
            }
            return {
                ...btn,
                displayLabel: btn.title || "Action"
            };
        });

    $w("#officeRep").data = visibleButtons;

    // Immediately sync labels in case repeater items were recycled
    $w("#officeRep").forEachItem(($item, itemData) => {
        let btnElem = $item("#officeButtons").id ? $item("#officeButtons") : $item("#officeButton");
        if (btnElem && btnElem.id) {
            btnElem.label = itemData.displayLabel || itemData.title || "Action";
        }
    });
}

export function initOfficeMenuRepeater() {
    const $w = hqState.$w;
    if (!$w || isOfficeRepInitialized || !$w("#officeRep").id) return;
    isOfficeRepInitialized = true;

    $w("#officeRep").onItemReady(($item, initialItemData) => {
        let btnElem = $item("#officeButtons").id ? $item("#officeButtons") : $item("#officeButton");
        if (!btnElem || !btnElem.id) return;

        btnElem.label = initialItemData.displayLabel || initialItemData.title || "Action";
        btnElem.enable();

        btnElem.onClick(async () => {
            let currentData = $w("#officeRep").data || [];
            let liveItem = currentData.find(b => String(b._id) === String(initialItemData._id)) || initialItemData;
            let t = String(liveItem.title || "").toLowerCase().trim();

            if (t.includes("calendar")) {
                closeOfficeMenu();
                closeAllLightboxes();
                if ($w("#msbCustomer").id && $w("#msbCustomer").currentState?.id !== "bCalendar") {
                    $w("#msbCustomer").changeState("bCalendar");
                }
            } else if (t.includes("add new tab") || t.includes("new tab") || t.includes("add tab")) {
                closeOfficeMenu();
                createNewTab();
            } else if (t.includes("detail")) {
                closeOfficeMenu();
                let targetTabId = hqState.activeTabId || hqState.selectedCartItemId || (hqState.draftSessions[0]?._id);
                if (!targetTabId) {
                    createNewTab();
                    targetTabId = hqState.activeTabId;
                }
                let activeItem = hqState.draftSessions.find(d => d._id === targetTabId);
                if (activeItem && activeItem.status === "Completed") return;

                closeAllLightboxes();
                if (targetTabId && hqState.callbacks.loadDraftFromCart) {
                    hqState.callbacks.loadDraftFromCart(targetTabId, true, "bNewDetail");
                } else if ($w("#msbCustomer").id) {
                    $w("#msbCustomer").changeState("bNewDetail");
                }
            } else if (t.includes("reschedule")) {
                closeOfficeMenu();
                await rescheduleSelectedPreviousJob();
            } else if (t.includes("rebook")) {
                closeOfficeMenu();
                await rebookSelectedPreviousJob();
            } else if (t.includes("correction")) {
                closeOfficeMenu();
                if (!hqState.selectedPreviousJobId) return;
                let repData = $w("#previousRep").id ? ($w("#previousRep").data || []) : [];
                let selectedJob = repData.find(j => String(j._id) === String(hqState.selectedPreviousJobId) && !j.isPlaceholder);
                if (!selectedJob) return;
                openCorrectionBoxForJob(selectedJob);
            } else if (t.includes("note")) {
                closeOfficeMenu();
                if ($w("#newNotes").id) {
                    let activeCartId = hqState.currentDraft.editingCartId || hqState.selectedCartItemId;
                    let activeCartItem = hqState.globalCart.find(c => c._id === activeCartId);
                    $w("#newNotes").value = activeCartItem ? (activeCartItem.officeNotes || "") : (hqState.currentDraft.officeNotes || "");
                }
                if ($w("#msbOffice").id) $w("#msbOffice").changeState("officeNotesBox");
            } else if (t.includes("clear")) {
                closeOfficeMenu();
                if (hqState.callbacks.clearCustomerData) hqState.callbacks.clearCustomerData(false);
            } else if (t.includes("close")) {
                closeOfficeMenu();
                closeAllLightboxes();
            }
        });
    });

    refreshOfficeMenuRepeater();
}

export function initOfficeNotesEngine() {
    const $w = hqState.$w;
    if (!$w) return;

    initCorrectionRepeater();
    initCorrectionDetailerMenu();
    initOfficeMenuRepeater();

    if ($w("#officeMenu").id && !$w("#officeMenu").hidden) {
        $w("#officeMenu").hide();
    }

    if ($w("#officeMenuButton").id) {
        $w("#officeMenuButton").onClick(() => {
            if (!$w("#officeMenu").id) return;
            if ($w("#officeMenu").hidden) {
                refreshOfficeMenuRepeater();
                $w("#officeMenu").show("fade", { duration: 150 });
            } else {
                $w("#officeMenu").hide("fade", { duration: 150 });
            }
        });
    }

    const applyCorrectionDetailerPay = () => {
        if (!$w("#correctionDetailerPayInput").id || !$w("#correctionDetailerPayInput").enabled) {
            tempCorrectionPayout = 0;
            refreshCorrectionRepeater();
            return;
        }
        let rawVal = String($w("#correctionDetailerPayInput").value || "").replace(/[^0-9.]/g, "");
        let parsed = parseFloat(rawVal);
        tempCorrectionPayout = (!isNaN(parsed) && parsed > 0) ? parsed : 0;
        $w("#correctionDetailerPayInput").value = tempCorrectionPayout > 0 ? tempCorrectionPayout.toFixed(2) : "";
        refreshCorrectionRepeater();
    };

    if ($w("#correctionDetailerPaySubmit").id) {
        $w("#correctionDetailerPaySubmit").onClick(() => {
            applyCorrectionDetailerPay();
        });
    }

    if ($w("#correctionDetailerPayInput").id) {
        $w("#correctionDetailerPayInput").onKeyPress((event) => {
            if (event.key === "Enter") {
                setTimeout(() => {
                    applyCorrectionDetailerPay();
                }, 30);
            }
        });
        $w("#correctionDetailerPayInput").onBlur(() => {
            applyCorrectionDetailerPay();
        });
    }

    const submitSingleCorrectionItem = () => {
        if (!$w("#correctionItemInput").id) return;
        let val = String($w("#correctionItemInput").value || "").trim();
        if (!val) {
            $w("#correctionItemInput").focus();
            return;
        }

        tempCorrectionItems.push(val);
        $w("#correctionItemInput").value = "";
        $w("#correctionItemInput").style.borderColor = "#000000";
        refreshCorrectionRepeater();

        setTimeout(() => {
            if ($w("#correctionItemInput").id) $w("#correctionItemInput").focus();
        }, 30);
    };

    if ($w("#submitCorrectionItem").id) {
        $w("#submitCorrectionItem").onClick(() => {
            submitSingleCorrectionItem();
        });
    }

    if ($w("#correctionItemInput").id) {
        $w("#correctionItemInput").onKeyPress((event) => {
            if (event.key === "Enter") {
                setTimeout(() => {
                    submitSingleCorrectionItem();
                }, 30);
            }
        });
    }

    if ($w("#submitCorrection").id) {
        $w("#submitCorrection").onClick(async () => {
            if (!pendingCorrectionJob) return;

            if ($w("#correctionItemInput").id) {
                let pendingVal = String($w("#correctionItemInput").value || "").trim();
                if (pendingVal) {
                    tempCorrectionItems.push(pendingVal);
                    $w("#correctionItemInput").value = "";
                }
            }

            if (tempCorrectionItems.length === 0) {
                if ($w("#correctionItemInput").id) {
                    $w("#correctionItemInput").style.borderColor = "#DF3131";
                    $w("#correctionItemInput").focus();
                }
                return;
            }

            applyCorrectionDetailerPay();

            await createCorrectionTabFromJob(
                pendingCorrectionJob,
                tempCorrectionItems,
                tempCorrectionImages,
                tempCorrectionPayout,
                tempCorrectionDetailerId,
                tempCorrectionDetailerName
            );
            closeAllLightboxes();
            if ($w("#msbCustomer").id) $w("#msbCustomer").changeState("bCalendar");
        });
    }

    if ($w("#officeCancel").id) {
        $w("#officeCancel").onClick(() => {
            if ($w("#msbOffice").id) $w("#msbOffice").changeState("customerInfoBox");
        });
    }

    if ($w("#ofiiceNotesButton").id) {
        $w("#ofiiceNotesButton").onClick(() => {
            let noteVal = $w("#newNotes").id ? $w("#newNotes").value : "";
            hqState.currentDraft.officeNotes = noteVal;

            let activeCartId = hqState.currentDraft.editingCartId || hqState.selectedCartItemId;
            let activeCartItem = hqState.globalCart.find(c => c._id === activeCartId);
            if (activeCartItem) {
                activeCartItem.officeNotes = noteVal;
            }

            hqState.callbacks.paintSummaryBox();
            hqState.callbacks.refreshCustomAddOnsRepeater();
            if ($w("#msbOffice").id) $w("#msbOffice").changeState("customerInfoBox");
        });
    }
}