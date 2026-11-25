// — public/profileEngine.js


import wixData from 'wix-data';
import { session } from 'wix-storage';
import wixWindow from 'wix-window';
import { authentication } from 'wix-members-frontend';
import { getActiveUserId } from 'public/authEngine';
import { registerRepeater, smartSyncRepeater } from 'public/repeaterEngine';
import wixLocationFrontend from 'wix-location-frontend';
import { syncDetailJobs, triggerSavedJobClick } from 'public/fileDetailInfo.js';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

let $w;
let hooks;

const STRINGS = {
    FILTERS: { ALL_VEHICLES: "All Vehicles" }
};

let profileSubscriptions = [];
let activeSubscriptionFilter = STRINGS.FILTERS.ALL_VEHICLES;
let isProfileDataLoaded = false;

registerModuleState("profileEngine", () => ({
    isProfileDataLoaded,
    profileSubscriptionsCount: (profileSubscriptions || []).length,
    activeSubscriptionFilter,
    lockProfileSyncInSession: session.getItem("lockProfileSync") || null,
    activeProfileJobIdInSession: session.getItem("activeProfileJobId") || null
}));

registerDomElements({
    msb: ["#msbProfile"],
    repeaters: ["#subscriptionsRepM", "#profileRep"]
});

export function initProfileEngine(wixContext, providedHooks) {
    console.log("📌 [PROFILE_ENGINE -> initProfileEngine]: Initializing Profile Engine...");
    $w = wixContext;
    hooks = providedHooks || {};

    if (typeof $w === "function" && $w("#subscriptionsRepM").id) {
        initProfileSubscriptionsEngine();
    }
    initAccountDeletionEngine();
    if (typeof $w === "function" && $w("#profileRep").id) {
        initProfileButtonsRepeater();
        loadProfileButtons();
    }
}

export async function preloadAllProfileData(forceRefetch = false, wixContext = null) {
    if (wixContext && typeof wixContext === "function" && typeof $w !== "function") {
        $w = wixContext;
    }
    if (typeof $w !== "function") return;
    if (session.getItem("lockProfileSync") === "true") return;

    if (!forceRefetch && isProfileDataLoaded) {
        return;
    }

    let userId = await getActiveUserId();
    if (!userId || userId.startsWith("guest_")) return;

    try {
        console.log(`📌 [PROFILE_ENGINE -> preloadAllProfileData]: Fetching profile data for userId=${userId} (forceRefetch=${forceRefetch})`);
        let [jobsRes, subsRes, contactsRes, locationsRes] = await Promise.all([
            wixData.query("scheduledJobs").eq("userId", userId).find(),
            wixData.query("activeSubscriptions").eq("userId", userId).find(),
            wixData.query("customerContacts").eq("userId", userId).ne("archived", true).find(),
            wixData.query("customerLocations").eq("userId", userId).ne("archived", true).find()
        ]);

        profileSubscriptions = subsRes.items || [];
        let profileContacts = contactsRes.items || [];
        let profileLocations = locationsRes.items || [];

        syncDetailJobs(jobsRes.items || [], $w);
        paintSubscriptionsCache();

        if (hooks && hooks.syncContactLocationData) hooks.syncContactLocationData(profileContacts, profileLocations);

        let savedJobId = session.getItem("activeProfileJobId");
        let savedIsUpcoming = session.getItem("activeProfileJobIsUpcoming") === "true";
       
        if (savedJobId && typeof $w === "function" && $w("#msbProfile").id && $w("#msbProfile").currentState?.id === "detailInfoProfileState") {
            triggerSavedJobClick(savedJobId, savedIsUpcoming);
        }

        isProfileDataLoaded = true;

    } catch (err) {
        console.error("📌 [PROFILE_ENGINE -> preloadAllProfileData]: Background Sync Failed", err);
    }
}

function paintSubscriptionsCache() {
    if (typeof $w !== "function" || !$w("#subscriptionsRepM").id) return;
    let filteredSubs = activeSubscriptionFilter !== STRINGS.FILTERS.ALL_VEHICLES
        ? profileSubscriptions.filter(s => s.vehicleCategory === activeSubscriptionFilter)
        : profileSubscriptions;
    smartSyncRepeater($w, "#subscriptionsRepM", filteredSubs);

    if ($w("#subscriptionsTextD").id) {
        if (filteredSubs.length > 0) $w("#subscriptionsTextD").hide();
        else {
            $w("#subscriptionsTextD").text = "There are currently no Subscriptions in your Profile.";
            $w("#subscriptionsTextD").show();
        }
    }
}

export function initProfileSubscriptionsEngine() {
    registerRepeater($w, "#subscriptionsRepM", ($item, itemData) => {
        try {
            if ($item(`#subscriptionsTitleM`).type) { $item(`#subscriptionsTitleM`).text = itemData.packageTitle || "Car Club Subscription"; }
            if ($item(`#subscriptionsVehicleM`).type) {
                let sYear = itemData.vehicleYear || ""; let sMake = itemData.vehicleMake || "";
                let sModel = itemData.vehicleModel || ""; let sColor = itemData.vehicleColor || "";
                let sVehStr = `${sYear} ${sMake} ${sModel} ${sColor ? '- ' + sColor : ''}`.replace(/\s+/g, ' ').trim();
                $item(`#subscriptionsVehicleM`).text = sVehStr || "Unknown Vehicle";
            }
            if ($item(`#subscriptionsDateM`).type) { $item(`#subscriptionsDateM`).text = `${itemData.recurringDay || 'TBD'} - ${itemData.timeSlot || 'TBD'}`; }
            if ($item(`#subscriptionsFrequencyM`).type) { $item(`#subscriptionsFrequencyM`).text = itemData.frequency || "Monthly"; }
            if ($item(`#subscriptionsPriceM`).type) { $item(`#subscriptionsPriceM`).text = `$${Number(itemData.price || 0).toFixed(2)}`; }
            if ($item(`#subscriptionsImageM`).type && itemData.packageImage) { $item(`#subscriptionsImageM`).src = itemData.packageImage; }
        } catch (e) {}
    });
}

export async function executeFullAccountDeletion($w, userId) {
    if (!userId) return;

    let btn = $w("#deleteAccountConfirm");
    if (btn.id) {
        btn.disable();
        btn.label = "Erasing Data...";
    }

    try {
        console.warn(`📌 [PROFILE_ENGINE -> executeFullAccountDeletion]: Erasing account data for userId=${userId}`);
        const nukeCollection = async (collectionName) => {
            let res = await wixData.query(collectionName).eq("userId", userId).limit(1000).find();
            if (res.items.length > 0) {
                let ids = res.items.map(item => item._id);
                await wixData.bulkRemove(collectionName, ids);
            }
        };

        await Promise.all([
            nukeCollection("customerVehicles"),
            nukeCollection("customerContacts"),
            nukeCollection("customerLocations"),
            nukeCollection("temporaryData")
        ]);

        await wixData.remove("customerProfiles", userId);

        if (btn.id) btn.label = "Account Deleted";

        setTimeout(async () => {
            await authentication.logout();
            wixLocationFrontend.to("/");
        }, 1500);

    } catch (err) {
        if (btn.id) {
            btn.enable();
            btn.label = "Error. Try Again.";
        }
        console.error("📌 [PROFILE_ENGINE -> executeFullAccountDeletion]: Full account deletion failed", err);
    }
}

export function initAccountDeletionEngine() {
    if ($w("#deleteAccountConfirm").id) {
        $w("#deleteAccountConfirm").onClick(async () => {
            let activeUserId = await hooks.getActiveUserId();
            await executeFullAccountDeletion($w, activeUserId);
        });
    }
}

async function loadProfileButtons() {
    try {
        let res = await wixData.query("profileButtons").ascending("sort").find();
        if ($w("#profileRep").id) {
            smartSyncRepeater($w, "#profileRep", res.items);
        }
    } catch (err) {
        console.error("📌 [PROFILE_ENGINE -> loadProfileButtons]: Failed to load profile buttons", err);
    }
}

export function initProfileButtonsRepeater() {
    registerRepeater($w, "#profileRep", ($item, itemData) => {
        if ($item("#profileRepTitle").type) $item("#profileRepTitle").text = itemData.title || "No Title";
        if ($item("#profileRepText").type) $item("#profileRepText").text = itemData.text || "";
        if ($item("#profileRepImage").type && itemData.image) $item("#profileRepImage").src = itemData.image;

        if ($item("#profileRepItem").type) {
            if (wixWindow.formFactor === "Desktop") {
                $item("#profileRepItem").onMouseIn(() => { $item("#profileRepItem").style.backgroundColor = "#D9D9D9"; });
                $item("#profileRepItem").onMouseOut(() => { $item("#profileRepItem").style.backgroundColor = "#FFFFFF"; });
            }
           
            $item("#profileRepItem").onClick(() => {
                let buttonTitle = (itemData.title || "").trim();
                console.log(`📌 [PROFILE_ENGINE -> profileRepItem.onClick]: Clicked '${buttonTitle}'`);
               
                const routeMap = {
                    "Upcoming Details": "upcomingProfileState",
                    "Previous Details": "completedProfileState",
                    "Subscriptions": "subscriptionsProfileState",
                    "My Garage": "garageProfileState",
                    "Contacts & Locations": "contactLocationsProfileState",
                    "Notifications": "notificationsProfileState",
                    "Gift Cards": "giftCardsProfileState",
                    "Payment Methods": "paymentMethodsProfileState",
                    "Login & Security": "loginSecurityProfileState",
                    "Customer Service": "customerServiceProfileState",
                    "Career Opportunities": "careerProfileState"
                };

                let targetRoute = routeMap[buttonTitle];
                if (targetRoute && hooks.smartGoTo) hooks.smartGoTo(targetRoute);
            });
        }
    });
}