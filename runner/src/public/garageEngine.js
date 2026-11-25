// --- public/garageEngine.js ---

import wixData from 'wix-data';
import { session } from 'wix-storage';
import { openOverlay, closeAllOverlays, showErrorMessage } from 'public/routerEngine';
import { registerRepeater, smartSyncRepeater } from 'public/repeaterEngine'; 
import {
    clearAddVehicleForm,
    loadVehicleIntoForm,
    loadEditingVehicleImages,
    setEditingCategoryAndType
} from 'public/fileVehicleAdd'; 
import { APP_LOGS } from 'public/loggerConfig';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';
import { fetchSupabaseCrmBundle, pushCrmRecordToSupabase } from 'backend/aiBrain.web';

let $w;
let hooks;

const DEBUG_MODE = APP_LOGS.MASTER_SWITCH && APP_LOGS.GARAGE;
const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [GARAGE_ENGINE]: ${msg}`, data) : console.log(`📌 [GARAGE_ENGINE]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [GARAGE_ENGINE]: ${msg}`, data) : console.warn(`📌 [GARAGE_ENGINE]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [GARAGE_ENGINE]: ${msg}`, data) : console.error(`📌 [GARAGE_ENGINE]: ${msg}`); }
};

// 🌟 Local Garage State
let allUserVehicles = [];
let vehicleHistory = [];
let categoryOptions = []; 
let selectedVehicleId = null;
let activeCategoryFilter = "All Vehicles";
let isGalleryClick = false;
let pendingDeleteVehicleId = null;
let isGarageDataLoaded = false;

registerModuleState("garageEngine", () => ({
    isGarageDataLoaded,
    allUserVehiclesCount: (allUserVehicles || []).length,
    vehicleHistoryCount: (vehicleHistory || []).length,
    categoryOptionsCount: (categoryOptions || []).length,
    selectedVehicleId,
    activeCategoryFilter,
    pendingDeleteVehicleId,
    vehiclesSummary: (allUserVehicles || []).map(v => ({
        _id: v._id,
        year: v.year,
        make: v.make,
        model: v.model,
        color: v.color,
        category: v.category,
        vehicleType: v.vehicleType
    }))
}));

registerDomElements({
    boxes: ["#displayRepGallaryBox", "#expandedBox"],
    repeaters: ["#repVehicles", "#repFilterVehicles", "#displayRepGallary"]
});

function safeEnable(el) {
    if (el && el.id && typeof el.enable === "function") {
        try { el.enable(); } catch (e) {}
    }
}

function safeDisable(el) {
    if (el && el.id && typeof el.disable === "function") {
        try { el.disable(); } catch (e) {}
    }
}

export function initGarageEngine(wixContext, providedHooks) {
    logger.info("Initializing Garage Engine...");
    $w = wixContext;
    hooks = providedHooks || {};

    initGarageButtons();
    initFilterRepeater();
    initVehicleRepeater();
    initGalleryRepeater();
}

export async function loadGarageData(forceRefetch = false) {
    if (!forceRefetch && isGarageDataLoaded) {
        logger.info("Using cached Garage data...");
        return;
    }

    let userId = hooks.getActiveUserId ? await hooks.getActiveUserId() : null;
    if (!userId) return;
    
    try {
        let [catRes, vehRes, histRes, supaCrm] = await Promise.all([
            wixData.query("siteButtons").eq("category", "Garage Button").ascending("sort").find(),
            wixData.query("customerVehicles").eq("userId", String(userId)).ne("archived", true).find(),
            wixData.query("scheduledJobs").eq("userId", String(userId)).ne("status", "Cancelled").descending("serviceDate").find(),
            fetchSupabaseCrmBundle(String(userId)).catch(() => ({ ok: false }))
        ]);

        const mergeById = (supaArr = [], wixArr = []) => {
            const map = new Map();
            (wixArr || []).forEach(it => { if (it && it._id) map.set(it._id, it); });
            (supaArr || []).forEach(it => { if (it && it._id) map.set(it._id, { ...(map.get(it._id) || {}), ...it }); });
            return Array.from(map.values());
        };
        
        allUserVehicles = mergeById(supaCrm?.vehicles, vehRes.items);
        vehicleHistory = mergeById((supaCrm?.jobs || []).filter(j => j.status !== "Cancelled"), histRes.items);

        categoryOptions = [{ _id: "all", title: "All Vehicles", category: "All Vehicles" }];
        (catRes.items || []).forEach(cat => categoryOptions.push(cat));
        
        refreshCategoryUI(); 
        await applyVehicleFilter();

        isGarageDataLoaded = true;

    } catch (err) {
        logger.error("Garage Load Error", err);
        showErrorMessage("Failed to load garage data. Please refresh the page."); 
    }
}

function refreshCategoryUI() {
    if (!$w("#repFilterVehicles") || !$w("#repFilterVehicles").id) return;
    let syncData = categoryOptions.map(cat => ({ ...cat, isSelected: (cat.title === activeCategoryFilter) }));
    smartSyncRepeater($w, "#repFilterVehicles", syncData);
}

export function refreshSelectionUI() {
    let filteredVehicles = activeCategoryFilter !== "All Vehicles"
        ? allUserVehicles.filter(v => v.category === activeCategoryFilter)
        : allUserVehicles;
    let syncData = filteredVehicles.map(v => ({ ...v, isSelected: (selectedVehicleId === v._id) }));
    
    if ($w("#repVehicles").id) {
        smartSyncRepeater($w, "#repVehicles", syncData);
    }
    updateDisplayBox();
}

export async function applyVehicleFilter(forceWakeup = false) {
    let filteredVehicles = activeCategoryFilter !== "All Vehicles"
        ? allUserVehicles.filter(v => v.category === activeCategoryFilter)
        : allUserVehicles;
    
    if (filteredVehicles.length === 0) {
        if ($w("#textEmptyGarage").id) {
            if (activeCategoryFilter === "All Vehicles") $w("#textEmptyGarage").text = "Your Garage is currently empty.";
            else if (activeCategoryFilter === "Toys") $w("#textEmptyGarage").text = "There are currently no Toys in your Garage.";
            else $w("#textEmptyGarage").text = `There are currently no ${activeCategoryFilter} vehicles in your Garage.`;
            
            $w("#textEmptyGarage").expand();
            $w("#textEmptyGarage").show("fade", { duration: 200 });
        }
        if ($w("#repVehicles").id) $w("#repVehicles").hide();
        updateDisplayBox();
    } else {
        if ($w("#textEmptyGarage").id) {
            $w("#textEmptyGarage").hide("fade", { duration: 150 }).then(() => {
                $w("#textEmptyGarage").collapse();
            });
        }
        
        if ($w("#repVehicles").id) $w("#repVehicles").show();
        
        if (forceWakeup) {
            $w("#repVehicles").data = [];
            setTimeout(() => { refreshSelectionUI(); }, 50);
        } else {
            refreshSelectionUI(); 
        }
    }
}

function initGarageButtons() {
    if ($w("#addVehicle").id) {
        $w("#addVehicle").onClick(() => {
            session.removeItem("editingVehicleId");
            session.removeItem("editingProfileImage");
            session.removeItem("editingGalleryImages");

            clearAddVehicleForm();

            if ($w("#vehicleNotesText").id) $w("#vehicleNotesText").hide();
            if ($w("#vehicleNotesButtonG").id && "label" in $w("#vehicleNotesButtonG")) {
                $w("#vehicleNotesButtonG").label = "Add Notes";
            }

            if (hooks.smartGoTo) hooks.smartGoTo("addVehicleLightboxState");
        });
    }

    const handleEdit = () => {
        if (!selectedVehicleId) return;
        let car = allUserVehicles.find(v => v._id === selectedVehicleId);
        if (!car) return;
        
        session.setItem("editingVehicleId", car._id); 
        session.setItem("editingProfileImage", car.mainDisplayImage || ""); 
        session.setItem("editingGalleryImages", JSON.stringify(car.image || [])); 

        // Delegate form population cleanly to fileVehicleAdd.js
        loadVehicleIntoForm(car);
        setEditingCategoryAndType(car.category || "NONE", car.vehicleType || "NONE");
        loadEditingVehicleImages();

        if ($w("#vehicleTextBoxG").id) {
            $w("#vehicleTextBoxG").value = car.vehicleNotes || car.specialInstructions || "";
        }
        let hasNotes = (car.vehicleNotes || car.specialInstructions || "").trim() !== "";

        if ($w("#vehicleNotesText").id) {
            if (hasNotes) {
                $w("#vehicleNotesText").text = "Vehicle Has Notes.";
                $w("#vehicleNotesText").show();
            } else {
                $w("#vehicleNotesText").hide();
            }
        }

        if ($w("#vehicleNotesButtonG").id && "label" in $w("#vehicleNotesButtonG")) {
            $w("#vehicleNotesButtonG").label = hasNotes ? "Vehicle Has Notes" : "Add Notes";
        }

        if (hooks.closeSideMenu) hooks.closeSideMenu();
        if (hooks.smartGoTo) hooks.smartGoTo("addVehicleLightboxState");
    };

    if ($w("#btnEdit").id) $w("#btnEdit").onClick(handleEdit);
    if ($w("#sideMenuEditVehicle").id) $w("#sideMenuEditVehicle").onClick(handleEdit);

    if ($w("#detailHistoryButton").id) {
        $w("#detailHistoryButton").onClick(() => {
            if (!selectedVehicleId) return; 
            if (hooks.closeSideMenu) hooks.closeSideMenu(); 
            if (hooks.smartGoTo) hooks.smartGoTo("detailHistoryLightboxState"); 
        });
    }

    const executeDelete = async (btnId, defaultLabel) => {
        let idToDelete = selectedVehicleId || pendingDeleteVehicleId;
        if (!idToDelete) return;

        if ($w(btnId).id) {
            safeDisable($w(btnId));
            if ("label" in $w(btnId)) $w(btnId).label = "Deleting...";
        }
        
        try {
            if ($w("#repVehicles").id) {
                $w("#repVehicles").forItems([idToDelete], ($item) => { 
                    if ($item("#repVehiclesItem").type) {
                        $item("#repVehiclesItem").hide("fade", { duration: 400 });
                    }
                });
            }
            await new Promise(resolve => setTimeout(resolve, 400));
            
            // 1. Delete from customerVehicles (with soft-archive fallback if CMS permissions block hard delete)
            try {
                await wixData.remove("customerVehicles", idToDelete);
            } catch (removeErr) {
                let existingVeh = await wixData.get("customerVehicles", idToDelete);
                if (existingVeh) {
                    existingVeh.archived = true;
                    await wixData.update("customerVehicles", existingVeh);
                } else {
                    throw removeErr;
                }
            }
            pushCrmRecordToSupabase("customerVehicles", { _id: idToDelete, userId: String(await (hooks.getActiveUserId ? hooks.getActiveUserId() : "")), archived: true }).catch(() => {});
            
            // 2. Purge any orphaned Draft cart items in temporaryData
            let orphanedCartItems = await wixData.query("temporaryData")
                .eq("vehicleId", idToDelete)
                .eq("status", "Draft")
                .find();
                
            if (orphanedCartItems.items.length > 0) {
                let itemIdsToDelete = orphanedCartItems.items.map(item => item._id);
                await wixData.bulkRemove("temporaryData", itemIdsToDelete);
                
                if (typeof hooks.loadCartData === "function") await hooks.loadCartData();
            }

            // 3. Remove from local array immediately & force-refresh Garage data
            allUserVehicles = allUserVehicles.filter(v => String(v._id) !== String(idToDelete));
            selectedVehicleId = null; 
            pendingDeleteVehicleId = null;

            await loadGarageData(true); 
            await applyVehicleFilter();
        } catch (err) {
            logger.error("Delete Error", err);
            showErrorMessage("Failed to delete vehicle. Please try again.");
            refreshSelectionUI();
        }
        
        if ($w(btnId).id) {
            safeEnable($w(btnId));
            if ("label" in $w(btnId)) $w(btnId).label = defaultLabel;
        }
    };

    if ($w("#deleteVehicle").id) {
        $w("#deleteVehicle").onClick(() => executeDelete("#deleteVehicle", "Delete Selected"));
    }

    if ($w("#deleteVehicleMobile").id) {
        $w("#deleteVehicleMobile").onClick(() => {
            if (!selectedVehicleId) return;
            if (hooks.closeSideMenu) hooks.closeSideMenu();

            session.removeItem("activeDeleteIntent");
            pendingDeleteVehicleId = null;

            let car = allUserVehicles.find(v => v._id === selectedVehicleId);
            let vehicleStr = car ? `${car.year || ''} ${car.make || ''} ${car.model || ''}`.trim() : "this vehicle";
            
            if ($w("#confirmDeleteText").id) {
                $w("#confirmDeleteText").text = `Are you sure you want to remove ${vehicleStr} from your garage?`;
            }
            if ($w("#deleteConfirmTitle").id) {
                $w("#deleteConfirmTitle").text = "Confirm Vehicle Deletion";
            }

            session.setItem("activeDeleteIntent", "vehicle");
            pendingDeleteVehicleId = selectedVehicleId; 
            
            openOverlay($w, "popup", "deleteConfirmPopupState");
        });
    }

    if ($w("#submitConfirmDelete").id) {
        $w("#submitConfirmDelete").onClick(async () => {
            if (session.getItem("activeDeleteIntent") !== "vehicle") return;
            
            closeAllOverlays($w);
            await executeDelete("#deleteVehicleMobile", "Delete");
            
            pendingDeleteVehicleId = null; 
            session.removeItem("activeDeleteIntent");
        });
    }
}

function initFilterRepeater() {
    if (!$w("#repFilterVehicles") || !$w("#repFilterVehicles").id) return;
    
    registerRepeater($w, "#repFilterVehicles", ($item, itemData) => {
        if ($item("#btnFilterTab").type) {
            if ("label" in $item("#btnFilterTab")) $item("#btnFilterTab").label = itemData.title;
            if (itemData.isSelected) safeDisable($item("#btnFilterTab"));
            else safeEnable($item("#btnFilterTab"));
        }
    });

    if ($w("#btnFilterTab").id) {
        $w("#btnFilterTab").onClick((event) => {
            let itemData = categoryOptions.find(d => d._id === event.context.itemId);
            if (!itemData) return;
            
            activeCategoryFilter = itemData.title;
            refreshCategoryUI(); 
            
            selectedVehicleId = null;
            applyVehicleFilter(); 
        });
    }
}

function initVehicleRepeater() {
    if (!$w("#repVehicles") || !$w("#repVehicles").id) return;
    
    registerRepeater($w, "#repVehicles", ($item, itemData) => {
        if ($item("#repVehiclesItem").type) $item("#repVehiclesItem").show();
        if ($item("#msbGImage").type && itemData.mainDisplayImage) $item("#msbGImage").src = itemData.mainDisplayImage;
        if ($item("#vehicleTitle").type) $item("#vehicleTitle").text = `${itemData.year || ''} ${itemData.make || ''} ${itemData.model || ''}`.trim();

        let typeName = itemData.vehicleType || "Unknown Type";
        if ($item("#textTypeColor").type) $item("#textTypeColor").text = `${typeName} - ${itemData.color || ''}`;
        if ($item("#textCategory").type) $item("#textCategory").text = itemData.category || "Uncategorized";
        
        let hasNotes = (itemData.vehicleNotes || itemData.specialInstructions || "").trim() !== "";
        if ($item("#textSi").type) $item("#textSi").text = hasNotes ? "Has Special Instructions" : "No Special Instructions";

        if ($item("#textLastDetailed").type) {
            let lastDetail = vehicleHistory.find(h => h.vehicleId === itemData._id);
            if (lastDetail && lastDetail.serviceDate) {
                $item("#textLastDetailed").text = `Last Detailed: ${new Date(lastDetail.serviceDate).toLocaleDateString()} - ${lastDetail.packageTitle || 'Package'}`;
            } else {
                $item("#textLastDetailed").text = "Last Detailed: Never";
            }
        }

        if ($item("#checkmarkSelectVehicle").type) {
            if (itemData.isSelected) $item("#checkmarkSelectVehicle").show();
            else $item("#checkmarkSelectVehicle").hide();
        }

        if ($item("#repVehiclesItem").type && $item("#repVehiclesItem").style) {
            $item("#repVehiclesItem").style.borderColor = itemData.isSelected ? "#30FFD6" : "#FFFFFF";
        }
    });

    const toggleSelection = (event) => {
        selectedVehicleId = (selectedVehicleId === event.context.itemId) ? null : event.context.itemId;
        refreshSelectionUI(); 
    };

    if ($w("#repVehiclesItem").id) {
        $w("#repVehiclesItem").onClick((event) => {
            if (event.target.id !== "checkboxSelectVehicle" && event.target.id !== "checkmarkSelectVehicle") {
                toggleSelection(event);
            }
        });
    }
    if ($w("#checkboxSelectVehicle").id) $w("#checkboxSelectVehicle").onClick(toggleSelection);
    if ($w("#checkmarkSelectVehicle").id) $w("#checkmarkSelectVehicle").onClick(toggleSelection);
}

function updateDisplayBox() {
    if (!selectedVehicleId) {
        if ($w("#displayRepGallaryBox").id) $w("#displayRepGallaryBox").collapse();
        return;
    }
    let car = allUserVehicles.find(v => v._id === selectedVehicleId);
    if (!car) return;

    let galleryImages = car.image || []; 
    if (galleryImages.length > 0) {
        let safeGallery = galleryImages.map((img, i) => ({ _id: "img_" + i, src: img.src || img }));
        smartSyncRepeater($w, "#displayRepGallary", safeGallery);
        if ($w("#displayRepGallaryBox").id) $w("#displayRepGallaryBox").expand();
    } else {
        if ($w("#displayRepGallaryBox").id) $w("#displayRepGallaryBox").collapse();
    }
}

function initGalleryRepeater() {
    if (!$w("#displayRepGallary") || !$w("#displayRepGallary").id) return;
    
    if ($w("#page1").id) {
        $w("#page1").onClick(() => {
            if (isGalleryClick) return;
            if ($w("#expandedBox").id) $w("#expandedBox").hide("fade", { duration: 200 });
        });
    }
    
    registerRepeater($w, "#displayRepGallary", ($item, itemData) => {
        if ($item("#displayRepGallaryImage").type) {
            $item("#displayRepGallaryImage").src = itemData.src;
        }
    });

    if ($w("#displayRepGallaryImage").id) {
        $w("#displayRepGallaryImage").onClick((event) => {
            let itemData = ($w("#displayRepGallary").data || []).find(d => d._id === event.context.itemId);
            if (!itemData) return;
            isGalleryClick = true;
            setTimeout(() => { isGalleryClick = false; }, 150);
            if ($w("#expandedImage").id) $w("#expandedImage").src = itemData.src;
            if ($w("#expandedBox").id) $w("#expandedBox").show("fade", { duration: 200 });
        });
    }

    if ($w("#expandedBox").id) {
        $w("#expandedBox").onClick(() => {
            $w("#expandedBox").hide("fade", { duration: 200 });
        });
    }
}