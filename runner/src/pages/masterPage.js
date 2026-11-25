// ---- masterPage.js (Global Header, Footer MSB, AI Telemetry & Cart Count Badge Engine) ----

import wixData from 'wix-data';
import wixLocationFrontend from 'wix-location-frontend';
import { session } from 'wix-storage';
import wixWindowFrontend from 'wix-window-frontend';
import { currentMember } from 'wix-members-frontend';
import { initAiTelemetry, registerModuleState, registerDomElements } from 'public/aiTelemetry';
import { getActiveUserId } from 'public/authEngine';
import { syncGlobalCartBadge } from 'public/stateManager';
import { syncFooterState } from 'public/routerEngine';
import { captureFullPageBlueprint } from 'public/siteBlueprintMapper';
import { remoteSpiderAllPages } from 'backend/aiBrain.web';

let lastLiveCartCount = null;

async function shouldRunBlueprintMapper() {
    const isEbot = wixLocationFrontend.query.ebot === 'Cashew09po';

    if (isEbot) {
        remoteSpiderAllPages().catch(err => console.error("Spider error:", err));
    } else if (!session.getItem('server_spider_done')) {
        remoteSpiderAllPages().catch(err => console.error("Spider error:", err));
        session.setItem('server_spider_done', '1');
    }

    if (isEbot) {
        return true;
    }
    try {
        const member = await currentMember.getMember();
        if (member && member.loginEmail === 'mlhammes1@gmail.com') {
            return true;
        }
    } catch (error) {
        // Ignore errors if member is not logged in
    }
    return false;
}

$w.onReady(function () {
    // ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ 1. MILLISECOND-0 SNAP: Sync #msbFooter state & #cartCountsBox before paint!
    syncFooterState($w);

    let cachedCount = session.getItem("cached_cart_count");
    if (cachedCount !== null && cachedCount !== undefined) {
        syncGlobalCartBadge($w, Number(cachedCount));
    }

    if (wixWindowFrontend.rendering.env !== "browser") return;

    // ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â  Arm AI Telemetry & #geminiBox globally on every page!
    initAiTelemetry($w);

    registerModuleState("masterPage", () => ({
        cachedCartCountInSession: session.getItem("cached_cart_count") || "0",
        lastLiveCartCount,
        currentUrl: wixLocationFrontend.url
    }));

    registerDomElements({
        msb: ["#msbFooter"],
        boxes: ["#cartCountsBox"]
    });

    // Capture blueprint after 2500ms without blocking existing code
    shouldRunBlueprintMapper().then(shouldRun => {
        if (shouldRun) {
            setTimeout(() => {
                captureFullPageBlueprint($w, { force: wixLocationFrontend.query.ebot === 'Cashew09po' });
            }, 2500);
        }
    });

    // ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ Keep #msbFooter synced on any cross-page navigation
    wixLocationFrontend.onChange(() => {
        console.log(`ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ [MASTER_PAGE -> onChange]: URL changed to ${wixLocationFrontend.url}`);
        syncFooterState($w);
        
        // Capture blueprint after 2500ms on navigation without blocking
        shouldRunBlueprintMapper().then(shouldRun => {
            if (shouldRun) {
                setTimeout(() => {
                    captureFullPageBlueprint($w, { force: wixLocationFrontend.query.ebot === 'Cashew09po' });
                }, 2500);
            }
        });
    });

    // 2. LIVE DATABASE VERIFICATION: Only update if the DB count differs from cachedCount!
    getActiveUserId().then(userId => {
        if (!userId) return;
        wixData.query("temporaryData")
            .eq("userId", String(userId))
            .count()
            .then(liveCount => {
                lastLiveCartCount = liveCount;
                if (String(liveCount) !== session.getItem("cached_cart_count")) {
                    console.log(`ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ [MASTER_PAGE -> verifyCartCount]: Syncing live cart badge count=${liveCount}`);
                    syncGlobalCartBadge($w, liveCount);
                }
            })
            .catch(err => console.error("ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ [MASTER_PAGE -> verifyCartCountError]:", err));
    });
});