// --- public/fileWhatsIncludedG.js ---

import { registerRepeater, smartSyncRepeater } from 'public/repeaterEngine';
import { session } from 'wix-storage';
import { APP_LOGS } from 'public/loggerConfig';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

let $w;
let lastOpenedWiItemTitle = null;
let lastStepsCount = 0;

const DEBUG_MODE = APP_LOGS.MASTER_SWITCH && APP_LOGS.WHATS_INCLUDED_G;
const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [FILE_WHATS_INCLUDED_G]: ${msg}`, data) : console.log(`📌 [FILE_WHATS_INCLUDED_G]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [FILE_WHATS_INCLUDED_G]: ${msg}`, data) : console.warn(`📌 [FILE_WHATS_INCLUDED_G]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [FILE_WHATS_INCLUDED_G]: ${msg}`, data) : console.error(`📌 [FILE_WHATS_INCLUDED_G]: ${msg}`); }
};

registerModuleState("fileWhatsIncludedG", () => ({
    lastOpenedWiItemTitle,
    lastStepsCount,
    returnBreadcrumb: session.getItem("returnBreadcrumb") || null
}));

registerDomElements({
    boxes: ["#videoWiGBox", "#scrollboxWiG"],
    repeaters: ["#whatsIncludedStepsRep"]
});

export function initWhatsIncludedGEngine(wixContext) {
    $w = wixContext;
    logger.info("initWhatsIncludedGEngine -> Initializing Global Lightbox Engine...");

    const formatTextToBullets = (rawText) => {
        if (!rawText) return "";
        let pureText = rawText.replace(/<[^>]*>?/gm, '');
        let lines = pureText.split('\n');
        let cleanLines = lines.filter(line => line.trim() !== "");
        let listItems = cleanLines.map(line => `<li style="margin-bottom: 12px;">${line.trim()}</li>`).join("");
        return `<ul>${listItems}</ul>`;
    };

    registerRepeater($w, "#whatsIncludedStepsRep", ($item, itemData) => {
        if ($item("#overviewTitle").type) {
            if (itemData.title) {
                $item("#overviewTitle").text = itemData.title;
                $item("#overviewTitle").expand();
            } else {
                $item("#overviewTitle").text = "";
                $item("#overviewTitle").collapse();
            }
        }
       
        if ($item("#overviewDescription").type) {
            if (itemData.description) {
                $item("#overviewDescription").html = formatTextToBullets(itemData.description);
                $item("#overviewDescription").expand();
            } else {
                $item("#overviewDescription").html = "";
                $item("#overviewDescription").collapse();
            }
        }
    });
}

// 🌟 UNIVERSAL OPEN COMMAND (Takes a routing callback so any engine can use it!)
export function openDetailedWiPopup(itemData, routeCallback, breadcrumb = "whatsIncludedLightboxState") {
    lastOpenedWiItemTitle = itemData.title || itemData.buttonTitle || "Details";
    logger.info(`openDetailedWiPopup -> Opening Detailed Info for: ${lastOpenedWiItemTitle}`);
   
    session.setItem("returnBreadcrumb", breadcrumb);
   
    if ($w("#titleWiG").id) $w("#titleWiG").text = lastOpenedWiItemTitle;
   
    if ($w("#introWiG").id) {
        let rawIntro = itemData.intro || "";
        let cleanIntro = rawIntro.replace(/<[^>]*>?/gm, '');
        $w("#introWiG").text = cleanIntro;
    }
   
    let extractedSteps = [];
    for (let i = 1; i <= 7; i++) {
        let numKey = i.toString().padStart(2, '0');
        let titleVal = itemData[`overviewT${numKey}`] || "";
        let descVal = itemData[`overview${numKey}`] || "";
       
        if (titleVal.trim() !== "" || descVal.trim() !== "") {
            extractedSteps.push({
                _id: `step_${itemData._id}_${numKey}`,
                title: titleVal,
                description: descVal
            });
        }
    }
    lastStepsCount = extractedSteps.length;
   
    if ($w("#whatsIncludedStepsRep").id) {
        if (extractedSteps.length > 0) {
            smartSyncRepeater($w, "#whatsIncludedStepsRep", extractedSteps);
            $w("#whatsIncludedStepsRep").expand();
        } else {
            $w("#whatsIncludedStepsRep").collapse();
        }
    }

    if ($w("#videoWiG").id) {
        if (itemData.video) {
            $w("#videoWiG").src = itemData.video;
            $w("#videoWiG").mute();
            $w("#videoWiG").play();
            $w("#videoWiG").expand();
            if ($w("#videoWiGBox").id) $w("#videoWiGBox").expand();
        } else {
            $w("#videoWiG").collapse();
            if ($w("#videoWiGBox").id) $w("#videoWiGBox").collapse();
        }
    }

    if (typeof routeCallback === "function") routeCallback();
   
    setTimeout(() => {
        if ($w("#scrollboxWiG").id) {
            $w("#scrollboxWiG").collapse().then(() => { $w("#scrollboxWiG").expand(); });
        }
    }, 50);
}