// --- public/cartWidget.js ---

import wixAnimationsFrontend from 'wix-animations-frontend';
import { APP_LOGS } from 'public/loggerConfig';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

let lastBadgeTotal = 0;
let lastAnimatedAt = null;

const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [CART_WIDGET]: ${msg}`, data) : console.log(`📌 [CART_WIDGET]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [CART_WIDGET]: ${msg}`, data) : console.warn(`📌 [CART_WIDGET]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [CART_WIDGET]: ${msg}`, data) : console.error(`📌 [CART_WIDGET]: ${msg}`); }
};

registerModuleState("cartWidget", () => ({
    lastBadgeTotal,
    lastAnimatedAt
}));

registerDomElements({
    repeaters: ["#repHeaderButtons"]
});

export function spinCartBubble($w, newTotal) {
    lastBadgeTotal = Number(newTotal || 0);
    lastAnimatedAt = new Date().toLocaleTimeString();

    if (!$w("#repHeaderButtons") || !$w("#repHeaderButtons").id) {
        logger.warn(`spinCartBubble -> Header repeater #repHeaderButtons not found (newTotal=${newTotal}).`);
        return;
    }

    logger.info(`spinCartBubble -> Updating header cart badge to: ${newTotal}`);

    $w("#repHeaderButtons").forEachItem(($item, itemData) => {
        let btnName = itemData.title || itemData.label || "";
       
        if (btnName.toLowerCase().includes("cart")) {
            if (newTotal === 0) {
                if ($item("#cartCountsBox").type) $item("#cartCountsBox").hide("fade", { duration: 200 });
            } else {
                if ($item("#cartCounts").type) $item("#cartCounts").text = newTotal.toString();
                if ($item("#cartCountsBox").type && $item("#cartCountsBox").hidden) $item("#cartCountsBox").show("fade", { duration: 200 });
               
                if ($item("#cartCountsBox").type) {
                    try {
                        const timeline = wixAnimationsFrontend.timeline();
                        timeline.add($item("#cartCountsBox"), {
                            y: -15, scale: 1.2, rotate: 180, duration: 250, easing: "easeOutSine"
                        }).add($item("#cartCountsBox"), {
                            y: 0, scale: 1, rotate: 360, duration: 400, easing: "easeOutBounce"
                        });
                       
                        timeline.play().onComplete(() => {
                            wixAnimationsFrontend.timeline().add($item("#cartCountsBox"), { rotate: 0, duration: 0 }).play();
                        });
                    } catch (err) {
                        logger.error("spinCartBubble -> Animation failed to play", err);
                    }
                }
            }
        }
    });
}