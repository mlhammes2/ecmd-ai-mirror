// --- public/hqDetailBuilder.js ---

import wixData from 'wix-data';
import { secureUpdateJob } from 'backend/emailDispatchEngine';
import { findMatchingServicePackage, normalizeToPackageSubCategory } from 'public/packageMatcher';
import { hqState, safeOpenOffice } from 'public/hqState';
import { renderTabs, paintBookingCart } from 'public/hqTabsAndCart';
import { processUnifiedSubmission, clearCustomerData } from 'public/hqCustomerForms';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

registerModuleState("hqDetailBuilder", () => {
    /** @type {any} */
    const cd = hqState.currentDraft || {};
    return {
        globalPackagesCount: (hqState.globalPackages || []).length,
        globalAddOnsCount: (hqState.globalAddOns || []).length,
        draftPackageId: cd.packageId || null,
        draftPackageTitle: cd.packageTitle || null,
        draftLevel: cd.level || null,
        draftType: cd.type || null,
        draftSubCategory: cd.subCategory || null,
        draftBasePrice: cd.basePrice || 0,
        draftSalePrice: cd.salePackagePrice || 0,
        draftMobileFee: cd.mobileFee || 0,
        draftTotalAddOnsPrice: cd.totalAddOnsPrice || 0,
        draftDiscountsTotal: cd.discountsTotal || 0,
        draftTotalPrice: cd.totalPrice || 0,
        draftSetDuration: cd.setDuration || null,
        interiorAddOnsCount: (cd.interiorAddOns || []).length,
        exteriorAddOnsCount: (cd.exteriorAddOns || []).length,
        customAddOnsCount: (cd.customAddOns || []).length,
        discountsAppliedCount: (cd.discountsApplied || []).length
    };
});

registerDomElements({
    boxes: ["#addOnBoxI", "#addOnBoxE", "#summaryBox", "#summaryBox2", "#boxTitle", "#boxTitle2"],
    repeaters: ["#newIAddOnsRepeater", "#newEAddOnsRepeater", "#customRep"],
    inputs: ["#newPackagesDropdown", "#masterPriceInput", "#newDurationInput", "#customAddOnsInput", "#customAddOnsPriceInput", "#newNotes"]
});

const ADDON_UNSELECTED_SVG = "https://static.wixstatic.com/shapes/694137_1602bde3fd0e4741a3119c599614fb9a.svg";
const ADDON_SELECTED_SVG   = "https://static.wixstatic.com/shapes/694137_c50600f9788e4f04a98d38d0e9af9e4b.svg";

function hideBackdropIfNoHqOverlaysOpen($w, closingIds = []) {
    if (!$w || !$w("#lightboxBackground").id || $w("#lightboxBackground").hidden) return;
    const isVisible = (id) => !closingIds.includes(id) && $w(id).id && !$w(id).hidden && !$w(id).collapsed;

    if (
        !isVisible("#tabMenuBox") &&
        !isVisible("#hqCalendarMenuBox") &&
        !isVisible("#addOnBoxI") &&
        !isVisible("#addOnBoxE") &&
        !isVisible("#officeBox") &&
        !isVisible("#msbOffice") &&
        !isVisible("#msbMenu") &&
        !isVisible("#siteMenu")
    ) {
        $w("#lightboxBackground").hide("fade", { duration: 150 }).then(() => {
            if ($w("#lightboxBackground").hidden) $w("#lightboxBackground").collapse();
        }).catch(() => {});
    }
}

function initAddOnToggleBoxes($w) {
    if (!$w) return;

    // Start both toggle boxes hidden & collapsed on load
    ["#addOnBoxI", "#addOnBoxE"].forEach(boxId => {
        if ($w(boxId).id) {
            if (!$w(boxId).hidden) $w(boxId).hide();
            if (!$w(boxId).collapsed) $w(boxId).collapse();
        }
    });

    const toggleAddOnBox = async (targetBoxId, otherBoxId) => {
        if (!$w(targetBoxId).id) return;

        let repId = targetBoxId === "#addOnBoxI" ? "#newIAddOnsRepeater" : "#newEAddOnsRepeater";

        // Close the opposite add-on box if open
        if (otherBoxId && $w(otherBoxId).id && !$w(otherBoxId).hidden) {
            $w(otherBoxId).hide("fade", { duration: 150 }).then(() => {
                if ($w(otherBoxId).hidden) $w(otherBoxId).collapse();
            }).catch(() => {});
        }

        if ($w(targetBoxId).hidden || $w(targetBoxId).collapsed) {
            if ($w("#lightboxBackground").id) {
                $w("#lightboxBackground").expand();
                if ($w("#lightboxBackground").hidden) {
                    $w("#lightboxBackground").show("fade", { duration: 150 }).catch(() => {});
                }
            }
            if ($w(repId).id && $w(repId).collapsed) $w(repId).expand();
            if ($w(repId).id && $w(repId).hidden) $w(repId).show();

            $w(targetBoxId).expand();
            await $w(targetBoxId).show("fade", { duration: 150 });
            syncAddOnVectors();
        } else {
            hideBackdropIfNoHqOverlaysOpen($w, [targetBoxId]);
            await $w(targetBoxId).hide("fade", { duration: 150 });
            if ($w(targetBoxId).hidden) $w(targetBoxId).collapse();
        }
    };

    const closeAddOnBox = async (targetBoxId) => {
        hideBackdropIfNoHqOverlaysOpen($w, [targetBoxId]);
        if ($w(targetBoxId).id && !$w(targetBoxId).hidden) {
            await $w(targetBoxId).hide("fade", { duration: 150 });
            if ($w(targetBoxId).hidden) $w(targetBoxId).collapse();
        }
    };

    if ($w("#addOnButtonI").id) {
        $w("#addOnButtonI").onClick(() => toggleAddOnBox("#addOnBoxI", "#addOnBoxE"));
    }
    if ($w("#addOnButtonE").id) {
        $w("#addOnButtonE").onClick(() => toggleAddOnBox("#addOnBoxE", "#addOnBoxI"));
    }
    if ($w("#addOnCloseI").id) {
        $w("#addOnCloseI").onClick(() => closeAddOnBox("#addOnBoxI"));
    }
    if ($w("#addOnCloseE").id) {
        $w("#addOnCloseE").onClick(() => closeAddOnBox("#addOnBoxE"));
    }
}

function syncAddOnVectors() {
    const $w = hqState.$w;
    if (!$w) return;

    if ($w("#newIAddOnsRepeater").id) {
        $w("#newIAddOnsRepeater").forEachItem(($item, itemData) => {
            let displayName = itemData.buttonTitle || itemData.addOnTitle || itemData.title || "Add-On";
            let isSelected = (hqState.currentDraft.interiorAddOns || []).some(a => a.title === displayName);
            if ($item("#newIAddOnVector").id) {
                $item("#newIAddOnVector").src = isSelected ? ADDON_SELECTED_SVG : ADDON_UNSELECTED_SVG;
            }
        });
    }

    if ($w("#newEAddOnsRepeater").id) {
        $w("#newEAddOnsRepeater").forEachItem(($item, itemData) => {
            let displayName = itemData.buttonTitle || itemData.addOnTitle || itemData.title || "Add-On";
            let isSelected = (hqState.currentDraft.exteriorAddOns || []).some(a => a.title === displayName);
            if ($item("#newEAddOnVector").id) {
                $item("#newEAddOnVector").src = isSelected ? ADDON_SELECTED_SVG : ADDON_UNSELECTED_SVG;
            }
        });
    }
}

export async function loadNewDetailOptions() {
    const $w = hqState.$w;
    if (!$w) return;

    try {
        let [pkgRes, wiRes] = await Promise.all([
            wixData.query("servicePackages").ascending("sort").limit(100).find(),
            wixData.query("autoWhatsIncluded").limit(1000).find()
        ]);

        hqState.globalPackages = pkgRes.items || [];
        hqState.globalAddOns = wiRes.items || [];

        if ($w("#newPackagesDropdown").id) {
            syncHqPackagesToVehicle();
            $w("#newPackagesDropdown").value = null;

            $w("#newPackagesDropdown").onChange((event) => {
                hqState.currentDraft.interiorAddOns = [];
                hqState.currentDraft.exteriorAddOns = [];

                applyPackageFilterToDraft(event.target.value, true);

                calculateDraftTotal();
                paintSummaryBox();
                refreshCustomAddOnsRepeater();
            });
        }

        if ($w("#newIAddOnsRepeater").id) $w("#newIAddOnsRepeater").data = [];
        if ($w("#newEAddOnsRepeater").id) $w("#newEAddOnsRepeater").data = [];

    } catch (error) {
        console.error("🚨 FATAL DATA ERROR:", error);
    }
}

export function syncHqPackagesToVehicle(vehicleId = null) {
    const $w = hqState.$w;
    if (!$w || !hqState.globalPackages || hqState.globalPackages.length === 0) return;

    let cd = hqState.currentDraft;
    let activeVehId = vehicleId || cd.vehicleId || ($w("#vehicleDropdown").id ? $w("#vehicleDropdown").value : null);
    let rawVeh = hqState.globalCustomerVehicles.find(v => String(v._id) === String(activeVehId)) || cd.rawVehicle || null;
    let targetSubCat = normalizeToPackageSubCategory(rawVeh?.vehicleType || rawVeh?.subCategory || cd.vehicleType || "") || "Sedan";

    // 1. Filter #newPackagesDropdown so it only lists packages for this Vehicle Type (subCategory)
    let filteredPkgs = hqState.globalPackages.filter(p => normalizeToPackageSubCategory(p.subCategory) === targetSubCat);
    let pool = filteredPkgs.length > 0 ? filteredPkgs : hqState.globalPackages;

    if ($w("#newPackagesDropdown").id) {
        $w("#newPackagesDropdown").options = pool.map(p => ({
            label: `${p.title || (p.detailType === "Full" ? `Full ${p.packageLevel} Detail` : `${p.packageLevel} ${p.detailType} Detail`)} (${p.subCategory || targetSubCat} - $${p.price})`,
            value: p._id
        }));
    }

    // 2. If the current draft already has a package selected, auto-swap it to match the new vehicle's subCategory!
    if (cd.packageId || (cd.packageTitle && cd.packageTitle !== "No Package Selected" && cd.level !== "Correction")) {
        let matchedPkg = findMatchingServicePackage(hqState.globalPackages, cd, targetSubCat);
        if (matchedPkg && matchedPkg._id !== cd.packageId) {
            applyPackageFilterToDraft(matchedPkg._id, true);
            calculateDraftTotal();
            paintSummaryBox();
            refreshCustomAddOnsRepeater();
        } else if (matchedPkg && $w("#newPackagesDropdown").id) {
            $w("#newPackagesDropdown").value = matchedPkg._id;
        }
    }
}

export function paintSummaryBox() {
    const $w = hqState.$w;
    if (!$w) return;

    let cd = hqState.currentDraft;
    let suffixes = ["", "2"];

    suffixes.forEach(suffix => {
        let hasPackage = Boolean(cd.packageTitle && cd.packageTitle !== "No Package Selected");
        let hasAddOnsOrNotes = Boolean(
            cd.mobileFee > 0 ||
            (cd.interiorAddOns && cd.interiorAddOns.length > 0) ||
            (cd.exteriorAddOns && cd.exteriorAddOns.length > 0) ||
            (cd.customAddOns && cd.customAddOns.length > 0) ||
            (cd.discountsApplied && cd.discountsApplied.length > 0) ||
            (cd.officeNotes && cd.officeNotes.trim() !== "") ||
            cd.totalPrice > 0
        );
        let hasAnyData = hasPackage || hasAddOnsOrNotes;

        // Keep Package Title & Base Price at the top of the summary card
        if (hasPackage) {
            if ($w(`#sumTitle${suffix}`).id) $w(`#sumTitle${suffix}`).text = cd.packageTitle;
            if ($w(`#sumPackagePrice${suffix}`).id) $w(`#sumPackagePrice${suffix}`).text = `$${Number(cd.basePrice || 0).toFixed(2)}`;
            if ($w(`#boxTitle${suffix}`).id) $w(`#boxTitle${suffix}`).expand();
        } else {
            if ($w(`#boxTitle${suffix}`).id) $w(`#boxTitle${suffix}`).collapse();
        }

        // For suffix === "" (where #customRep lives), collapse the old standalone boxes so they don't duplicate #customRep!
        if (suffix === "" && $w("#customRep").id) {
            [
                "#mobileFeeBox", "#boxDuration", "#sumIAddOnBox",
                "#sumEAddOnBox", "#customAddOnsBox", "#sumDiscountsBox", "#sumDNotesBox"
            ].forEach(boxId => {
                if ($w(boxId).id && !$w(boxId).collapsed) $w(boxId).collapse();
            });
        } else {
            // Secondary summary box (suffix === "2") keeps its normal fields if present
            if (cd.mobileFee > 0) {
                if ($w(`#mobileFeePrice${suffix}`).id) $w(`#mobileFeePrice${suffix}`).text = `$${Number(cd.mobileFee).toFixed(2)}`;
                if ($w(`#mobileFeeBox${suffix}`).id) $w(`#mobileFeeBox${suffix}`).expand();
            } else if ($w(`#mobileFeeBox${suffix}`).id) {
                $w(`#mobileFeeBox${suffix}`).collapse();
            }

            if (hasPackage || cd.totalPrice > 0) {
                if ($w(`#sumDuration${suffix}`).id) $w(`#sumDuration${suffix}`).text = `Duration: ${cd.setDuration || "--"} Hrs`;
                if ($w(`#sumTotalPrice${suffix}`).id) $w(`#sumTotalPrice${suffix}`).text = `$${Number(cd.totalPrice || 0).toFixed(2)}`;
                if ($w(`#boxDuration${suffix}`).id) $w(`#boxDuration${suffix}`).expand();
            } else if ($w(`#boxDuration${suffix}`).id) {
                $w(`#boxDuration${suffix}`).collapse();
            }

            if (cd.interiorAddOns && cd.interiorAddOns.length > 0) {
                if ($w(`#sumIAddOnTitle${suffix}`).id) $w(`#sumIAddOnTitle${suffix}`).text = cd.interiorAddOns.map(a => a.title).join("\n");
                if ($w(`#sumIAddOnPrice${suffix}`).id) $w(`#sumIAddOnPrice${suffix}`).text = cd.interiorAddOns.map(a => `$${Number(a.price).toFixed(2)}`).join("\n");
                if ($w(`#sumIAddOnBox${suffix}`).id) $w(`#sumIAddOnBox${suffix}`).expand();
            } else if ($w(`#sumIAddOnBox${suffix}`).id) {
                $w(`#sumIAddOnBox${suffix}`).collapse();
            }

            if (cd.exteriorAddOns && cd.exteriorAddOns.length > 0) {
                if ($w(`#sumEAddOnTitle${suffix}`).id) $w(`#sumEAddOnTitle${suffix}`).text = cd.exteriorAddOns.map(a => a.title).join("\n");
                if ($w(`#sumEAddOnPrice${suffix}`).id) $w(`#sumEAddOnPrice${suffix}`).text = cd.exteriorAddOns.map(a => `$${Number(a.price).toFixed(2)}`).join("\n");
                if ($w(`#sumEAddOnBox${suffix}`).id) $w(`#sumEAddOnBox${suffix}`).expand();
            } else if ($w(`#sumEAddOnBox${suffix}`).id) {
                $w(`#sumEAddOnBox${suffix}`).collapse();
            }

            if (cd.customAddOns && cd.customAddOns.length > 0) {
                if ($w(`#customAddOnsTitle${suffix}`).id) $w(`#customAddOnsTitle${suffix}`).text = cd.customAddOns.map(a => a.title).join("\n");
                if ($w(`#customAddOnsPrice${suffix}`).id) $w(`#customAddOnsPrice${suffix}`).text = cd.customAddOns.map(a => `$${Number(a.price).toFixed(2)}`).join("\n");
                if ($w(`#customAddOnsBox${suffix}`).id) $w(`#customAddOnsBox${suffix}`).expand();
            } else if ($w(`#customAddOnsBox${suffix}`).id) {
                $w(`#customAddOnsBox${suffix}`).collapse();
            }

            if (cd.discountsApplied && cd.discountsApplied.length > 0) {
                if ($w(`#sumDiscountsTitle${suffix}`).id) $w(`#sumDiscountsTitle${suffix}`).text = cd.discountsApplied.map(d => d.title).join("\n");
                if ($w(`#sumDiscountsPrice${suffix}`).id) $w(`#sumDiscountsPrice${suffix}`).text = cd.discountsApplied.map(d => `-$${Number(d.price).toFixed(2)}`).join("\n");
                if ($w(`#sumDiscountsBox${suffix}`).id) $w(`#sumDiscountsBox${suffix}`).expand();
            } else if ($w(`#sumDiscountsBox${suffix}`).id) {
                $w(`#sumDiscountsBox${suffix}`).collapse();
            }

            if (cd.officeNotes && cd.officeNotes.trim() !== "") {
                if ($w(`#sumDNotes${suffix}`).id) $w(`#sumDNotes${suffix}`).text = cd.officeNotes;
                if ($w(`#sumDNotesBox${suffix}`).id) $w(`#sumDNotesBox${suffix}`).expand();
            } else if ($w(`#sumDNotesBox${suffix}`).id) {
                $w(`#sumDNotesBox${suffix}`).collapse();
            }
        }

        if (hasAnyData) {
            if ($w(`#summaryBox${suffix}`).id) $w(`#summaryBox${suffix}`).expand();
        } else {
            if ($w(`#summaryBox${suffix}`).id) $w(`#summaryBox${suffix}`).collapse();
        }
    });
}

export function calculateDraftTotal() {
    let cd = hqState.currentDraft;
    let base = parseFloat(cd.basePrice) || 0;
    let mobile = parseFloat(cd.mobileFee) || 0;

    let iTotal = (cd.interiorAddOns || []).reduce((sum, item) => sum + parseFloat(item.price || 0), 0);
    let eTotal = (cd.exteriorAddOns || []).reduce((sum, item) => sum + parseFloat(item.price || 0), 0);
    let cTotal = (cd.customAddOns || []).reduce((sum, item) => sum + parseFloat(item.price || 0), 0);

    cd.totalAddOnsPrice = iTotal + eTotal + cTotal;
    cd.subTotal = base + mobile + cd.totalAddOnsPrice;

    let flatDiscountsTotal = 0;
    (cd.discountsApplied || []).forEach(d => {
        if (!d.isPercent) flatDiscountsTotal += parseFloat(d.price || 0);
    });

    let prePercentTotal = cd.subTotal - flatDiscountsTotal;
    if (prePercentTotal < 0) prePercentTotal = 0;

    let percentDiscountsTotal = 0;
    (cd.discountsApplied || []).forEach(d => {
        if (d.isPercent && d.percentValue) {
            let calculatedDollarAmount = prePercentTotal * (d.percentValue / 100);
            d.price = calculatedDollarAmount;
            percentDiscountsTotal += calculatedDollarAmount;
        }
    });

    cd.discountsTotal = flatDiscountsTotal + percentDiscountsTotal;
    cd.totalPrice = cd.subTotal - cd.discountsTotal;
    if (cd.totalPrice < 0) cd.totalPrice = 0;
}

export function applyPackageFilterToDraft(pkgId, isNewSelection = true) {
    const $w = hqState.$w;
    if (!$w) return;

    let selectedPkg = hqState.globalPackages.find(p => p._id === pkgId);
    if (!selectedPkg) return;

    let cd = hqState.currentDraft;
    let fallbackTitle = selectedPkg.detailType === "Full"
        ? `Full ${selectedPkg.packageLevel || "Classic"} Detail`
        : `${selectedPkg.packageLevel || "Classic"} ${selectedPkg.detailType || "Full"} Detail`;

    cd.packageId = selectedPkg._id;
    cd.packageTitle = selectedPkg.title || fallbackTitle;
    cd.basePrice = parseFloat(selectedPkg.price) || 0;
    cd.mobileFee = parseFloat(selectedPkg.mobileFee) || 0;
    cd.subCategory = selectedPkg.subCategory || "";
    if (selectedPkg.duration) {
        cd.setDuration = String(selectedPkg.duration);
        if ($w("#newDurationInput").id) $w("#newDurationInput").value = String(selectedPkg.duration);
    }

    if (isNewSelection) {
        let allSaleTitles = hqState.globalPackages.map(p => p.saleTitle).filter(Boolean);
        cd.discountsApplied = (cd.discountsApplied || []).filter(d => !allSaleTitles.includes(d.title));

        let salePrice = parseFloat(selectedPkg.salePrice) || 0;
        let saleTitle = selectedPkg.saleTitle || "Special Offer";

        cd.salePackagePrice = salePrice;

        if (salePrice > 0 && salePrice < cd.basePrice) {
            let discountAmount = cd.basePrice - salePrice;
            cd.discountsApplied.push({ title: saleTitle, price: discountAmount });
        }
    }

    if ($w("#newPackagesDropdown").id) $w("#newPackagesDropdown").value = pkgId;

    let pkgTitle = (selectedPkg.title || "").toLowerCase();
    let selectedLevel = selectedPkg.packageLevel || "Classic";
    if (!selectedPkg.packageLevel) {
        if (pkgTitle.includes("premium")) selectedLevel = "Premium";
        if (pkgTitle.includes("luxury")) selectedLevel = "Luxury";
    }

    let selectedType = selectedPkg.detailType || "Full";
    if (!selectedPkg.detailType) {
        if (pkgTitle.includes("interior")) selectedType = "Interior";
        if (pkgTitle.includes("exterior")) selectedType = "Exterior";
    }

    cd.level = selectedLevel;
    cd.type = selectedType;

    let interiorList = [];
    let exteriorList = [];

    if (selectedLevel !== "Luxury") {
        let intTargetTag = selectedType === "Exterior" ? "All" : selectedLevel;
        interiorList = hqState.globalAddOns.filter(item => {
            let matchesType = item.detailType && String(item.detailType).includes("Interior");
            if (!matchesType) return false;
            return item.packageLevel && String(item.packageLevel).toLowerCase().includes(intTargetTag.toLowerCase()) && Number(item.price) > 0;
        });

        let extTargetTag = selectedType === "Interior" ? "All" : selectedLevel;
        exteriorList = hqState.globalAddOns.filter(item => {
            let matchesType = item.detailType && String(item.detailType).includes("Exterior");
            if (!matchesType) return false;
            return item.packageLevel && String(item.packageLevel).toLowerCase().includes(extTargetTag.toLowerCase()) && Number(item.price) > 0;
        });
    }

    interiorList.sort((a, b) => (a.sort || "").toString().localeCompare((b.sort || "").toString()));
    exteriorList.sort((a, b) => (a.sort || "").toString().localeCompare((b.sort || "").toString()));

    let freshInterior = interiorList.map((item, idx) => ({ ...item, _id: item._id || `int-addon-${idx}` }));
    let freshExterior = exteriorList.map((item, idx) => ({ ...item, _id: item._id || `ext-addon-${idx}` }));

    console.log(`📦 [HQ ADD-ONS]: Package "${cd.packageTitle}" (Level: ${selectedLevel}, Type: ${selectedType}) loaded:`, {
        totalCmsAddOns: (hqState.globalAddOns || []).length,
        interiorAddOnsCount: freshInterior.length,
        exteriorAddOnsCount: freshExterior.length
    });

    if ($w("#newIAddOnsRepeater").id) {
        $w("#newIAddOnsRepeater").data = freshInterior;
        if ($w("#newIAddOnsRepeater").collapsed) $w("#newIAddOnsRepeater").expand();
    }
    if ($w("#newEAddOnsRepeater").id) {
        $w("#newEAddOnsRepeater").data = freshExterior;
        if ($w("#newEAddOnsRepeater").collapsed) $w("#newEAddOnsRepeater").expand();
    }
    syncAddOnVectors();
}

export function refreshCustomAddOnsRepeater() {
    const $w = hqState.$w;
    if (!$w || !$w("#customRep").id) return;

    let cd = hqState.currentDraft;
    let hasPackage = Boolean(cd.packageTitle && cd.packageTitle !== "No Package Selected");
    const genId = (prefix) => `${prefix}-${Math.floor(Math.random() * 99999999)}`;

    let allItems = [];

    // 1. Mobile Fee (Deletable)
    if (cd.mobileFee > 0) {
        allItems.push({
            _id: "mobile-fee-item",
            rowType: "mobileFee",
            title: "Mobile Fee",
            priceText: `$${Number(cd.mobileFee).toFixed(2)}`,
            price: cd.mobileFee,
            canDelete: true,
            canEdit: true,
            hidePrice: false,
            isDiscount: false
        });
    }

    // 2. Interior Add-Ons (#sumIAddOnTitle / #sumIAddOnPrice -> Deletable)
    (cd.interiorAddOns || []).forEach((item, idx) => {
        allItems.push({
            _id: genId(`int-${idx}`),
            rowType: "interiorAddOn",
            title: item.title,
            priceText: `$${Number(item.price || 0).toFixed(2)}`,
            price: Number(item.price || 0),
            canDelete: true,
            canEdit: false,
            hidePrice: false,
            isDiscount: false
        });
    });

    // 3. Exterior Add-Ons (#sumEAddOnTitle / #sumEAddOnPrice -> Deletable)
    (cd.exteriorAddOns || []).forEach((item, idx) => {
        allItems.push({
            _id: genId(`ext-${idx}`),
            rowType: "exteriorAddOn",
            title: item.title,
            priceText: `$${Number(item.price || 0).toFixed(2)}`,
            price: Number(item.price || 0),
            canDelete: true,
            canEdit: false,
            hidePrice: false,
            isDiscount: false
        });
    });

    // 4. Custom Add-Ons (Deletable & Editable)
    (cd.customAddOns || []).forEach((item, idx) => {
        allItems.push({
            _id: genId(`cust-${idx}`),
            rowType: "customAddOn",
            title: item.title,
            priceText: `$${Number(item.price || 0).toFixed(2)}`,
            price: Number(item.price || 0),
            canDelete: true,
            canEdit: true,
            hidePrice: false,
            isDiscount: false
        });
    });

    // 5. Discounts (#sumDiscountsTitle / #sumDiscountsPrice -> Deletable & Editable)
    (cd.discountsApplied || []).forEach((item, idx) => {
        allItems.push({
            _id: genId(`disc-${idx}`),
            rowType: "discount",
            title: item.title,
            priceText: `-$${Number(item.price || 0).toFixed(2)}`,
            price: Number(item.price || 0),
            isPercent: item.isPercent || false,
            percentValue: item.percentValue || null,
            canDelete: true,
            canEdit: true,
            hidePrice: false,
            isDiscount: true
        });
    });

    // 6. Duration (#sumDuration -> Non-deletable)
    if (hasPackage || cd.setDuration) {
        allItems.push({
            _id: "summary-duration-row",
            rowType: "duration",
            title: "Duration",
            priceText: `${cd.setDuration || "--"} Hrs`,
            canDelete: false,
            canEdit: false,
            hidePrice: false,
            isDiscount: false
        });
    }

    // 7. Total Price (#sumTotalPrice -> Non-deletable)
    if (hasPackage || cd.totalPrice > 0 || allItems.length > 0) {
        allItems.push({
            _id: "summary-total-row",
            rowType: "total",
            title: "Total",
            priceText: `$${Number(cd.totalPrice || 0).toFixed(2)}`,
            canDelete: false,
            canEdit: false,
            hidePrice: false,
            isDiscount: false
        });
    }

    // 8. Office Notes (#sumDNotes -> Non-deletable, #customPrice hidden!)
    if (cd.officeNotes && cd.officeNotes.trim() !== "") {
        allItems.push({
            _id: "summary-notes-row",
            rowType: "notes",
            title: `O Notes: ${cd.officeNotes.trim()}`,
            priceText: "",
            canDelete: false,
            canEdit: false,
            hidePrice: true,
            isDiscount: false
        });
    }

    $w("#customRep").data = allItems;

    if (allItems.length > 0) {
        $w("#customRep").expand();
    } else {
        $w("#customRep").collapse();
    }
}

export function loadDraftFromCart(cartId, isEdit, targetState = "bNewDetail") {
    const $w = hqState.$w;
    if (!$w) return;

    let item = hqState.globalCart.find(j => j._id === cartId);
    if (!item) return;

    hqState.currentDraft = {
        ...item,
        interiorAddOns: [...(item.interiorAddOns || [])],
        exteriorAddOns: [...(item.exteriorAddOns || [])],
        customAddOns: [...(item.customAddOns || [])],
        discountsApplied: [...(item.discountsApplied || [])]
    };

    let cd = hqState.currentDraft;
    cd.editingCartId = isEdit ? cartId : null;

    if (!isEdit) {
        cd.isExistingBooking = false;
        cd.originalJobId = null;
        cd.assignedDate = null;
        cd.assignedTime = null;
        cd.assignedDetailerId = null;
    }

    if ($w("#vehicleDropdown").id) $w("#vehicleDropdown").value = cd.vehicleId;
    if ($w("#contactDropdown").id) $w("#contactDropdown").value = cd.contactId;
    if ($w("#locationDropdown").id) $w("#locationDropdown").value = cd.locationId;
    if ($w("#newPackagesDropdown").id) $w("#newPackagesDropdown").value = cd.packageId;

    syncHqPackagesToVehicle(cd.vehicleId);

    if (cd.packageId) applyPackageFilterToDraft(cd.packageId, false);

    if ($w("#masterPriceInput").id) $w("#masterPriceInput").value = (cd.totalPrice || 0).toString();
    if ($w("#newDurationInput").id) $w("#newDurationInput").value = cd.setDuration ? cd.setDuration.toString() : "3";
    if ($w("#newNotes").id) $w("#newNotes").value = cd.officeNotes || "";

    refreshCustomAddOnsRepeater();
    paintSummaryBox();

    if (targetState === "customerInfoBox") {
        safeOpenOffice("customerInfoBox");
    } else if (targetState && $w("#msbCustomer").id) {
        $w("#msbCustomer").changeState(targetState);
    }
}

export function clearDetailData() {
    const $w = hqState.$w;
    if (!$w) return;

    let cd = hqState.currentDraft;
    cd.editingCartId = null;
    cd.isExistingBooking = false;
    cd.isEditingOnly = false;
    cd.originalJobId = null;
    cd.assignedDate = null;
    cd.assignedTime = null;
    cd.assignedDetailerId = null;

    cd.packageId = null;
    cd.packageTitle = "No Package Selected";
    cd.level = null;
    cd.type = null;
    cd.basePrice = 0;
    cd.salePackagePrice = 0;
    cd.mobileFee = 0;
    cd.subTotal = 0;
    cd.totalPrice = 0;
    cd.setDuration = null;
    cd.interiorAddOns = [];
    cd.exteriorAddOns = [];
    cd.customAddOns = [];
    cd.discountsApplied = [];
    cd.officeNotes = "";

    if ($w("#newPackagesDropdown").id) $w("#newPackagesDropdown").value = null;
    syncHqPackagesToVehicle(cd.vehicleId);
    
    if ($w("#masterPriceInput").id) $w("#masterPriceInput").value = "";
    if ($w("#newDurationInput").id) $w("#newDurationInput").value = "";
    if ($w("#newNotes").id) $w("#newNotes").value = "";
    if ($w("#customAddOnsInput").id) $w("#customAddOnsInput").value = "";
    if ($w("#customAddOnsPriceInput").id) $w("#customAddOnsPriceInput").value = "";

    if ($w("#newIAddOnsRepeater").id) $w("#newIAddOnsRepeater").data = [];
    if ($w("#newEAddOnsRepeater").id) $w("#newEAddOnsRepeater").data = [];

    ["#addOnBoxI", "#addOnBoxE"].forEach(boxId => {
        if ($w(boxId).id) {
            if (!$w(boxId).hidden) $w(boxId).hide();
            if (!$w(boxId).collapsed) $w(boxId).collapse();
        }
    });

    calculateDraftTotal();
    paintSummaryBox();
    refreshCustomAddOnsRepeater();
}

export function initNewDetailEngine() {
    const $w = hqState.$w;
    if (!$w) return;

    initAddOnToggleBoxes($w);

    let lastAddOnClickTime = 0;

    if ($w("#newIAddOnsRepeater").id) {
        $w("#newIAddOnsRepeater").onItemReady(($item, itemData) => {
            let displayName = itemData.buttonTitle || itemData.addOnTitle || itemData.title || "Add-On";

            if ($item("#newIAddOnsTitleText").id) $item("#newIAddOnsTitleText").text = displayName;
            if ($item("#newIAddOnsPriceText").id) $item("#newIAddOnsPriceText").text = `$${Number(itemData.price || 0).toFixed(2)}`;

            let isSelected = (hqState.currentDraft.interiorAddOns || []).some(a => a.title === displayName);
            if ($item("#newIAddOnVector").id) {
                $item("#newIAddOnVector").src = isSelected ? ADDON_SELECTED_SVG : ADDON_UNSELECTED_SVG;
            }

            console.log(`🧩 [HQ ADD-ONS]: #newIAddOnsRepeater item ready -> "${displayName}"`, {
                hasOverlayBtn: Boolean($item("#addOnsRepButtonI").id),
                hasVector: Boolean($item("#newIAddOnVector").id),
                isSelected
            });

            if ($item("#addOnsRepButtonI").id) {
                $item("#addOnsRepButtonI").label = "";
                $item("#addOnsRepButtonI").onClick(() => {
                    let now = Date.now();
                    if (now - lastAddOnClickTime < 200) {
                        console.log("⏳ [HQ ADD-ONS]: Ignored duplicate click (<200ms) on #addOnsRepButtonI");
                        return;
                    }
                    lastAddOnClickTime = now;

                    let currentName = $item("#newIAddOnsTitleText").id
                        ? $item("#newIAddOnsTitleText").text
                        : displayName;
                    let currentPrice = $item("#newIAddOnsPriceText").id
                        ? parseFloat(String($item("#newIAddOnsPriceText").text).replace(/[^0-9.]/g, "")) || 0
                        : parseFloat(itemData.price || 0);

                    let existingIndex = hqState.currentDraft.interiorAddOns.findIndex(a => a.title === currentName);
                    if (existingIndex >= 0) {
                        hqState.currentDraft.interiorAddOns.splice(existingIndex, 1);
                        if ($item("#newIAddOnVector").id) $item("#newIAddOnVector").src = ADDON_UNSELECTED_SVG;
                        console.log(`➖ [HQ ADD-ONS]: Deselected Interior Add-On "${currentName}"`, hqState.currentDraft.interiorAddOns);
                    } else {
                        hqState.currentDraft.interiorAddOns.push({ title: currentName, price: currentPrice });
                        if ($item("#newIAddOnVector").id) $item("#newIAddOnVector").src = ADDON_SELECTED_SVG;
                        console.log(`➕ [HQ ADD-ONS]: Selected Interior Add-On "${currentName}" ($${currentPrice})`, hqState.currentDraft.interiorAddOns);
                    }
                    calculateDraftTotal();
                    paintSummaryBox();
                    refreshCustomAddOnsRepeater();
                });
            } else {
                console.warn(`⚠️ [HQ ADD-ONS]: #addOnsRepButtonI NOT FOUND inside #newIAddOnsRepeater item!`);
            }
        });
    }

    if ($w("#newEAddOnsRepeater").id) {
        $w("#newEAddOnsRepeater").onItemReady(($item, itemData) => {
            let displayName = itemData.buttonTitle || itemData.addOnTitle || itemData.title || "Add-On";

            if ($item("#newEAddOnsTitleText").id) $item("#newEAddOnsTitleText").text = displayName;
            if ($item("#newEAddOnsPriceText").id) $item("#newEAddOnsPriceText").text = `$${Number(itemData.price || 0).toFixed(2)}`;

            let isSelected = (hqState.currentDraft.exteriorAddOns || []).some(a => a.title === displayName);
            if ($item("#newEAddOnVector").id) {
                $item("#newEAddOnVector").src = isSelected ? ADDON_SELECTED_SVG : ADDON_UNSELECTED_SVG;
            }

            console.log(`🧩 [HQ ADD-ONS]: #newEAddOnsRepeater item ready -> "${displayName}"`, {
                hasOverlayBtn: Boolean($item("#addOnsRepButtonE").id),
                hasVector: Boolean($item("#newEAddOnVector").id),
                isSelected
            });

            if ($item("#addOnsRepButtonE").id) {
                $item("#addOnsRepButtonE").label = "";
                $item("#addOnsRepButtonE").onClick(() => {
                    let now = Date.now();
                    if (now - lastAddOnClickTime < 200) {
                        console.log("⏳ [HQ ADD-ONS]: Ignored duplicate click (<200ms) on #addOnsRepButtonE");
                        return;
                    }
                    lastAddOnClickTime = now;

                    let currentName = $item("#newEAddOnsTitleText").id
                        ? $item("#newEAddOnsTitleText").text
                        : displayName;
                    let currentPrice = $item("#newEAddOnsPriceText").id
                        ? parseFloat(String($item("#newEAddOnsPriceText").text).replace(/[^0-9.]/g, "")) || 0
                        : parseFloat(itemData.price || 0);

                    let existingIndex = hqState.currentDraft.exteriorAddOns.findIndex(a => a.title === currentName);
                    if (existingIndex >= 0) {
                        hqState.currentDraft.exteriorAddOns.splice(existingIndex, 1);
                        if ($item("#newEAddOnVector").id) $item("#newEAddOnVector").src = ADDON_UNSELECTED_SVG;
                        console.log(`➖ [HQ ADD-ONS]: Deselected Exterior Add-On "${currentName}"`, hqState.currentDraft.exteriorAddOns);
                    } else {
                        hqState.currentDraft.exteriorAddOns.push({ title: currentName, price: currentPrice });
                        if ($item("#newEAddOnVector").id) $item("#newEAddOnVector").src = ADDON_SELECTED_SVG;
                        console.log(`➕ [HQ ADD-ONS]: Selected Exterior Add-On "${currentName}" ($${currentPrice})`, hqState.currentDraft.exteriorAddOns);
                    }
                    calculateDraftTotal();
                    paintSummaryBox();
                    refreshCustomAddOnsRepeater();
                });
            } else {
                console.warn(`⚠️ [HQ ADD-ONS]: #addOnsRepButtonE NOT FOUND inside #newEAddOnsRepeater item!`);
            }
        });
    }

    if ($w("#customRep").id) {
        $w("#customRep").onItemReady(($item, itemData) => {
            if ($item("#customTitle").id) {
                $item("#customTitle").text = itemData.title || "";
            }

            if ($item("#customPrice").id) {
                if (itemData.hidePrice) {
                    $item("#customPrice").hide();
                } else {
                    $item("#customPrice").show();
                    $item("#customPrice").text = itemData.priceText || "$0.00";
                    $item("#customPrice").style.color = itemData.isDiscount ? "#DF3131" : "#000000";
                }
            }

            if ($item("#customDelete").id) {
                if (itemData.canDelete) {
                    $item("#customDelete").show();
                } else {
                    $item("#customDelete").hide();
                }
            }

            const triggerEdit = () => {
                if (!itemData.canEdit) return;
                let cd = hqState.currentDraft;

                if (itemData.rowType === "mobileFee") {
                    cd.mobileFee = 0;
                } else if (itemData.rowType === "discount") {
                    let existingIndex = cd.discountsApplied.findIndex(a => a.title === itemData.title);
                    if (existingIndex >= 0) cd.discountsApplied.splice(existingIndex, 1);
                } else if (itemData.rowType === "customAddOn") {
                    let existingIndex = cd.customAddOns.findIndex(a => a.title === itemData.title);
                    if (existingIndex >= 0) cd.customAddOns.splice(existingIndex, 1);
                }

                if ($w("#customAddOnsInput").id) $w("#customAddOnsInput").value = itemData.title;

                let priceStr = itemData.isDiscount ? `-${Number(itemData.price).toFixed(2)}` : `${Number(itemData.price).toFixed(2)}`;
                if ($w("#customAddOnsPriceInput").id) $w("#customAddOnsPriceInput").value = priceStr;

                calculateDraftTotal();
                paintSummaryBox();
                refreshCustomAddOnsRepeater();
                if ($w("#customAddOnsPriceInput").id) $w("#customAddOnsPriceInput").focus();
            };

            if ($item("#customTitle").id) $item("#customTitle").onClick(triggerEdit);
            if ($item("#customPrice").id) $item("#customPrice").onClick(triggerEdit);

            if ($item("#customDelete").id) {
                $item("#customDelete").onClick(() => {
                    if (!itemData.canDelete) return;
                    let cd = hqState.currentDraft;

                    if (itemData.rowType === "mobileFee") {
                        cd.mobileFee = 0;
                    } else if (itemData.rowType === "interiorAddOn") {
                        let idx = cd.interiorAddOns.findIndex(a => a.title === itemData.title);
                        if (idx >= 0) cd.interiorAddOns.splice(idx, 1);
                        syncAddOnVectors();
                    } else if (itemData.rowType === "exteriorAddOn") {
                        let idx = cd.exteriorAddOns.findIndex(a => a.title === itemData.title);
                        if (idx >= 0) cd.exteriorAddOns.splice(idx, 1);
                        syncAddOnVectors();
                    } else if (itemData.rowType === "discount") {
                        let idx = cd.discountsApplied.findIndex(a => a.title === itemData.title);
                        if (idx >= 0) cd.discountsApplied.splice(idx, 1);
                    } else if (itemData.rowType === "customAddOn") {
                        let idx = cd.customAddOns.findIndex(a => a.title === itemData.title);
                        if (idx >= 0) cd.customAddOns.splice(idx, 1);
                    }

                    calculateDraftTotal();
                    paintSummaryBox();
                    refreshCustomAddOnsRepeater();
                });
            }
        });
    }

    const triggerCustomAddOn = () => {
        let title = $w("#customAddOnsInput").value;
        if (title) title = title.trim();

        let rawPrice = $w("#customAddOnsPriceInput").value;
        let priceStr = rawPrice !== undefined && rawPrice !== null ? String(rawPrice).trim() : "";

        if (!title && !priceStr) return;

        let isDiscount = priceStr.startsWith("-");
        let isPercent = priceStr.includes("%");

        let price = 0;
        let percentVal = 0;

        if (isPercent) {
            percentVal = Math.abs(parseFloat(priceStr.replace(/[^0-9.-]+/g, "")));
            if (!isNaN(percentVal)) {
                isDiscount = true;
                if (!title) title = `${percentVal}% Off`;
            }
        } else {
            price = parseFloat(priceStr.replace(/[^0-9.-]+/g, ""));
        }

        if (title && priceStr && (!isNaN(price) || !isNaN(percentVal))) {
            let absPrice = Math.abs(price) || 0;

            if (isDiscount) {
                hqState.currentDraft.discountsApplied.push({
                    title: title,
                    price: absPrice,
                    isPercent: isPercent,
                    percentValue: percentVal
                });
            } else {
                hqState.currentDraft.customAddOns.push({ title: title, price: absPrice });
            }

            calculateDraftTotal();
            paintSummaryBox();
            refreshCustomAddOnsRepeater();

            $w("#customAddOnsInput").value = "";
            $w("#customAddOnsPriceInput").value = "";
            $w("#customAddOnsInput").focus();
        } else {
            if (!title) $w("#customAddOnsInput").style.borderColor = "#DF3131";
            if (!priceStr) $w("#customAddOnsPriceInput").style.borderColor = "#DF3131";
            setTimeout(() => {
                $w("#customAddOnsInput").style.borderColor = "#000000";
                $w("#customAddOnsPriceInput").style.borderColor = "#000000";
            }, 1000);
        }
    };

    if ($w("#customAddOnsInput").id) {
        $w("#customAddOnsInput").onKeyPress((e) => {
            if (e.key === "Enter") setTimeout(triggerCustomAddOn, 50);
        });
    }

    if ($w("#customAddOnsPriceInput").id) {
        $w("#customAddOnsPriceInput").onKeyPress((e) => {
            if (e.key === "Enter") setTimeout(triggerCustomAddOn, 50);
        });

        $w("#customAddOnsPriceInput").onBlur(() => {
            let pVal = $w("#customAddOnsPriceInput").value;
            let tVal = $w("#customAddOnsInput").value;
            if (pVal || tVal) {
                triggerCustomAddOn();
            }
        });
    }

    const triggerMasterPrice = () => {
        let masterPriceStr = String($w("#masterPriceInput").value || "");
        let masterPrice = parseFloat(masterPriceStr.replace(/[^0-9.-]+/g, ""));

        if (!isNaN(masterPrice)) {
            let cd = hqState.currentDraft;
            let base = parseFloat(cd.basePrice) || 0;
            let mobile = parseFloat(cd.mobileFee) || 0;

            let iTotal = cd.interiorAddOns.reduce((sum, item) => sum + parseFloat(item.price || 0), 0);
            let eTotal = cd.exteriorAddOns.reduce((sum, item) => sum + parseFloat(item.price || 0), 0);

            let cleanCustomAddOns = cd.customAddOns.filter(c => c.title !== "Price Adjustment");
            let cleanDiscounts = cd.discountsApplied.filter(d => d.title !== "Office Discount");

            let cTotal = cleanCustomAddOns.reduce((sum, item) => sum + parseFloat(item.price || 0), 0);
            let dTotal = cleanDiscounts.reduce((sum, item) => sum + parseFloat(item.price || 0), 0);

            let mathTotal = (base + mobile + iTotal + eTotal + cTotal) - dTotal;
            if (mathTotal < 0) mathTotal = 0;

            if (masterPrice < mathTotal) {
                let discount = mathTotal - masterPrice;
                cd.discountsApplied = [...cleanDiscounts, { title: "Office Discount", price: discount }];
                cd.customAddOns = cleanCustomAddOns;

                calculateDraftTotal();
                cd.totalPrice = masterPrice;
                paintSummaryBox();
                refreshCustomAddOnsRepeater();

            } else if (masterPrice > mathTotal) {
                let overage = masterPrice - mathTotal;

                if ($w("#customAddOnsPriceInput").id) {
                    $w("#customAddOnsPriceInput").value = overage.toFixed(2);
                }
                if ($w("#customAddOnsInput").id) {
                    $w("#customAddOnsInput").value = "";
                    $w("#customAddOnsInput").focus();
                }
                if ($w("#masterPriceInput").id) {
                    $w("#masterPriceInput").value = "";
                }

                cd.discountsApplied = cleanDiscounts;
                cd.customAddOns = cleanCustomAddOns;

                calculateDraftTotal();
                paintSummaryBox();
                refreshCustomAddOnsRepeater();
                return;
            } else {
                cd.discountsApplied = cleanDiscounts;
                cd.customAddOns = cleanCustomAddOns;

                calculateDraftTotal();
                cd.totalPrice = masterPrice;
                paintSummaryBox();
                refreshCustomAddOnsRepeater();
            }

            if ($w("#masterPriceInput").id) {
                $w("#masterPriceInput").value = "";
            }
        }
    };

    if ($w("#masterPriceInput").id) {
        $w("#masterPriceInput").onKeyPress((e) => {
            if (e.key === "Enter") setTimeout(triggerMasterPrice, 50);
        });

        $w("#masterPriceInput").onBlur(() => {
            if ($w("#masterPriceInput").value && $w("#masterPriceInput").value.trim() !== "") {
                triggerMasterPrice();
            }
        });
    }

    if ($w("#newDurationInput").id) {
        const updateDuration = () => {
            let val = $w("#newDurationInput").value.replace(/[^0-9.]/g, '');
            $w("#newDurationInput").value = val;
            if (val) {
                hqState.currentDraft.setDuration = val;
                paintSummaryBox();
                refreshCustomAddOnsRepeater();
            }
        };
        $w("#newDurationInput").onBlur(updateDuration);
        $w("#newDurationInput").onKeyPress((e) => { if (e.key === "Enter") setTimeout(updateDuration, 50); });
    }

    if ($w("#submitNewDetailButton").id) {
        $w("#submitNewDetailButton").onClick(async () => {
            let cd = hqState.currentDraft;
            if ($w("#newNotes").id && $w("#newNotes").value) {
                cd.officeNotes = $w("#newNotes").value;
            }

            if (!cd.packageId) {
                $w("#submitNewDetailButton").label = "Select a Package First!";
                setTimeout(() => { $w("#submitNewDetailButton").label = "Save & Package Detail"; }, 2000);
                return;
            }

            let isMissingCustomer = !cd.customerId || !cd.vehicleId || !cd.contactId || !cd.locationId;

            let vText = cd.vehicleInfo || "Pending Vehicle...";
            if ($w("#vehicleDropdown").id && cd.vehicleId) {
                let opt = $w("#vehicleDropdown").options.find(o => o.value === cd.vehicleId);
                if (opt) vText = opt.label;
            }

            let cText = cd.primaryContactText || "Pending Contact...";
            if ($w("#contactDropdown").id && cd.contactId) {
                let opt = $w("#contactDropdown").options.find(o => o.value === cd.contactId);
                if (opt) cText = opt.label;
            }

            let lText = cd.locationInfo || "Pending Location...";
            if ($w("#locationDropdown").id && cd.locationId) {
                let opt = $w("#locationDropdown").options.find(o => o.value === cd.locationId);
                if (opt) lText = opt.label;
            }

            let rawLocation = hqState.globalCustomerLocations.find(a => a._id === cd.locationId) || null;
            let rawContact = hqState.globalCustomerContacts.find(a => a._id === cd.contactId) || null;
            let rawVehicle = hqState.globalCustomerVehicles.find(v => v._id === cd.vehicleId) || null;

            let targetTabId = cd.editingCartId || hqState.activeTabId || ("draft_" + Date.now().toString());
            let existingIdx = hqState.draftSessions.findIndex(j => j._id === targetTabId);
            let tabNum = existingIdx >= 0
                ? (hqState.draftSessions[existingIdx].emptyTabNumber || (existingIdx + 1))
                : (hqState.newTabCounter = (hqState.newTabCounter || 0) + 1);
            let assignedLabel = existingIdx >= 0
                ? (hqState.draftSessions[existingIdx].label || `New Tab ${tabNum}`)
                : `New Tab ${tabNum}`;

            let cartItem = {
                ...cd,
                _id: targetTabId,
                editingCartId: targetTabId,
                isJob: true,
                emptyTabNumber: tabNum,
                label: assignedLabel,
                resolvedVehicle: vText,
                resolvedContact: cText,
                resolvedLocation: lText,
                rawLocation: rawLocation,
                rawContact: rawContact,
                rawVehicle: rawVehicle,
                salePackagePrice: cd.salePackagePrice || 0,
                isEditingOnly: false
            };

            if (cd.originalJobId && cd.editingCartId && !cd.isCorrectionDraft) {
                $w("#submitNewDetailButton").disable();
                $w("#submitNewDetailButton").label = "Saving to Database...";

                try {
                    let jobToUpdate = hqState.globalJobs.find(j => j._id === cd.originalJobId);
                    if (jobToUpdate) {
                        jobToUpdate.orderId = cartItem.packageId;
                        jobToUpdate.packageTitle = cartItem.packageTitle;
                        jobToUpdate.level = cartItem.level;
                        jobToUpdate.type = cartItem.type;
                        jobToUpdate.basePrice = cartItem.basePrice;
                        jobToUpdate.salePackagePrice = cartItem.salePackagePrice;
                        jobToUpdate.mobileFee = cartItem.mobileFee;
                        jobToUpdate.subTotal = cartItem.subTotal;
                        jobToUpdate.discountsTotal = cartItem.discountsTotal;
                        jobToUpdate.totalPrice = cartItem.totalPrice;
                        jobToUpdate.setDuration = cartItem.setDuration;
                        jobToUpdate.totalAddOnsPrice = cartItem.totalAddOnsPrice;

                        const stringifyTags = (tagArray) => (tagArray || []).map(a => `${a.title} ($${Number(a.price).toFixed(2)})`);
                        const stringifyDiscounts = (tagArray) => (tagArray || []).map(a => `${a.title} (-$${Number(a.price).toFixed(2)})`);

                        jobToUpdate.interiorAddOns = stringifyTags(cartItem.interiorAddOns);
                        jobToUpdate.exteriorAddOns = stringifyTags(cartItem.exteriorAddOns);
                        jobToUpdate.customAddOns = stringifyTags(cartItem.customAddOns);
                        jobToUpdate.discountsApplied = stringifyDiscounts(cartItem.discountsApplied);
                        jobToUpdate.officeNotes = cartItem.officeNotes;

                        let savedJob = await secureUpdateJob(jobToUpdate);
                        let memoryIndex = hqState.globalJobs.findIndex(j => j._id === cd.originalJobId);
                        if (memoryIndex > -1 && savedJob) hqState.globalJobs[memoryIndex] = savedJob;
                    }

                    hqState.draftSessions = hqState.draftSessions.filter(c => c._id !== cd.editingCartId && !c.isExistingBooking);
                    hqState.globalCart = hqState.draftSessions;
                    hqState.activeTabId = null;
                    hqState.selectedCartItemId = null;
                    hqState.selectedTabIds = [];
                    clearDetailData();
                    renderTabs(true);
                    await paintBookingCart(true);
                    hqState.callbacks.loadDailyDetailers();

                    if ($w("#msbCustomer").id) $w("#msbCustomer").changeState("bCalendar");

                    $w("#submitNewDetailButton").enable();
                    $w("#submitNewDetailButton").label = "Save & Package Detail";

                } catch (error) {
                    console.error("🚨 Failed to save detail edits:", error);
                    $w("#submitNewDetailButton").label = "Error! Try Again.";
                    setTimeout(() => {
                        $w("#submitNewDetailButton").enable();
                        $w("#submitNewDetailButton").label = "Save & Package Detail";
                    }, 2000);
                }

            } else {
                if (existingIdx >= 0) {
                    hqState.draftSessions[existingIdx] = cartItem;
                } else {
                    hqState.draftSessions.unshift(cartItem);
                }

                hqState.globalCart = hqState.draftSessions;
                hqState.activeTabId = targetTabId;
                hqState.selectedCartItemId = targetTabId;
                hqState.selectedTabIds = [targetTabId];

                renderTabs(true);
                await paintBookingCart(false);
                hqState.callbacks.loadDailyDetailers();

                if (isMissingCustomer) {
                    safeOpenOffice("customerInfoBox");
                } else if ($w("#msbCustomer").id) {
                    $w("#msbCustomer").changeState("bCalendar");
                }
            }
        });
    }

    if ($w("#submitInfo").id) {
        $w("#submitInfo").onClick(async () => {
            await processUnifiedSubmission();
        });
    }
}