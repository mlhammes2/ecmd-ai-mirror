// --- public/reviewWidget.js ---

/**
 * ========================================================================
 * 🤖 AI CONTEXT & ARCHITECTURE NOTE
 * ========================================================================
 * FILE: public/reviewWidget.js
 * DOM TARGETS: `#reviewBadgeContainer`, `#star1`...`#star5`, `#textRating`
 * PURPOSE: Fetches real-time review stats and runs timeline animations.
 * ========================================================================
 */

import { getReviewStats } from 'backend/googleReviews';
import wixAnimationsFrontend from 'wix-animations-frontend';
import { APP_LOGS } from 'public/loggerConfig';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

let lastReviewStats = null;

registerModuleState("reviewWidget", () => ({
    lastReviewStats
}));

registerDomElements({
    boxes: ["#reviewBadgeContainer"]
});

export async function activateReviewWidget($w) {
    // 🌟 1. Instantly attach the Wiggle Engine
    if ($w("#reviewBadgeContainer").id && $w("#star1").id) {
        $w("#reviewBadgeContainer").onMouseIn(() => {
            const wiggle = wixAnimationsFrontend.timeline();
            const allStars = [$w("#star1"), $w("#star2"), $w("#star3"), $w("#star4"), $w("#star5")];
           
            wiggle
                .add(allStars, { scale: 1.2, duration: 80, easing: "easeOutCirc" })
                .add(allStars, { scale: 1, duration: 80, easing: "easeInCirc" })
                .add(allStars, { rotate: -12, duration: 60, easing: "easeLinear" })
                .add(allStars, { rotate: 12, duration: 60, easing: "easeLinear" })
                .add(allStars, { rotate: -6, duration: 60, easing: "easeLinear" })
                .add(allStars, { rotate: 6, duration: 60, easing: "easeLinear" })
                .add(allStars, { rotate: 0, duration: 60, easing: "easeLinear" });

            wiggle.play();
        });
    } else {
        console.warn("📌 [REVIEW_WIDGET -> activateReviewWidget]: #reviewBadgeContainer or #star1 not present on this page.");
    }

    // 🌟 2. The Google Data Fetch
    try {
        const data = await getReviewStats();
        lastReviewStats = data || null;
       
        if (data && data.status === "OK") {
            console.log(`📌 [REVIEW_WIDGET -> activateReviewWidget]: Loaded rating=${data.result?.rating} (${data.result?.user_ratings_total} reviews)`);
            if ($w("#textRating").id) $w("#textRating").text = `${data.result.rating}`;
            if ($w("#textTotalReviews").id) $w("#textTotalReviews").text = `out of ${data.result.user_ratings_total} Google Reviews`;
        } else {
            if ($w("#textRating").id) {
                $w("#textRating").text = `Google Error: ${data?.status || "Unknown"}`;
            }
            console.error("📌 [REVIEW_WIDGET -> activateReviewWidget]: Google Full Error:", data);
        }
    } catch (err) {
        console.error("📌 [REVIEW_WIDGET -> activateReviewWidget]: Widget Data Error:", err);
    }
}