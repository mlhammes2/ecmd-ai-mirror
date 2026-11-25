// --- public/animationsEngine.js ---

import { registerModuleState } from 'public/aiTelemetry';

// Global cache to store the original Wix Editor HTML wrappers
const htmlWrapperCache = {};

registerModuleState("animationsEngine", () => ({
    cachedHtmlElementIds: Object.keys(htmlWrapperCache),
    cachedCount: Object.keys(htmlWrapperCache).length
}));

/**
 * Hides an element with a slide-up animation, then collapses it.
 * @param {object} $element - The Velo element (e.g.,$w("#myElement"))
 * @param {number} duration - The animation duration in milliseconds
 */
export async function hideAndCollapseUp($element, duration = 400) {
    try {
        if ($element &&$element.id && !$element.collapsed && !$element.hidden) {
            console.log(`📌 [ANIMATIONS_ENGINE -> hideAndCollapseUp]: Hiding & collapsing #${$element.id}`);
            await $element.hide("slide", { direction: "top", duration: duration });
            await $element.collapse();
        }
    } catch (err) {
        console.error(`📌 [ANIMATIONS_ENGINE -> hideAndCollapseUp]: Error on #${$element?.id}:`, err);
    }
}

/**
 * Expands a collapsed element, then shows it with a slide-down animation.
 * @param {object} $element - The Velo element (e.g.,$w("#myElement"))
 * @param {number} duration - The animation duration in milliseconds
 */
export async function expandAndShowDown($element, duration = 400) {
    try {
        if ($element && $element.id &&$element.collapsed) {
            console.log(`📌 [ANIMATIONS_ENGINE -> expandAndShowDown]: Expanding & showing #${$element.id}`);
            await $element.expand();$element.show("slide", { direction: "top", duration: duration });
        }
    } catch (err) {
        console.error(`📌 [ANIMATIONS_ENGINE -> expandAndShowDown]: Error on #${$element?.id}:`, err);
    }
}

export function applyTextOrHighlight($el, plainText, term, highlightColor = "#17E6AD") {
    if (!$el || (!$el.type && !$el.id)) return;
   
    try {
        let templateId = $el.id;
       
        // 1. Build a bulletproof cache of the Wix native HTML tags on first render
        if (!htmlWrapperCache[templateId]) {
            let initialHtml = $el.html || "";
           
            let openTagsMatch = initialHtml.match(/^(?:<(?!span style="color)[^>]+>)+/i);
            let startHtml = openTagsMatch ? openTagsMatch[0] : '<span>';
           
            let openedTagsCount = (startHtml.match(/</g) || []).length;
            let endTagsRegex = new RegExp(`(?:<\\/[^>]+>){${openedTagsCount}}$`);
            let closeTagsMatch = initialHtml.match(endTagsRegex);
           
            let fallbackClose = initialHtml.match(/(?:<\/[^>]+>)+$/);
            let endHtml = closeTagsMatch ? closeTagsMatch[0] : (fallbackClose ? fallbackClose[0] : '</span>');
           
            htmlWrapperCache[templateId] = { start: startHtml, end: endHtml };
        }

        // 2. If the search is cleared, restore the plain text USING the cached native HTML wrappers.
        if (!term || term.trim() === "") {
            $el.html = `${htmlWrapperCache[templateId].start}${plainText}${htmlWrapperCache[templateId].end}`;
            return;
        }
       
        // 3. Apply the highlight
        let escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let regex = new RegExp(`(${escapedTerm})`, "gi");
        let highlightedString = plainText.replace(regex, `<span style="color: ${highlightColor};">$1</span>`);
       
        // 4. Wrap with native HTML and push to DOM
        $el.html = `${htmlWrapperCache[templateId].start}${highlightedString}${htmlWrapperCache[templateId].end}`;
    } catch (err) {
        console.error(`📌 [ANIMATIONS_ENGINE -> applyTextOrHighlight]: Error on #${$el?.id}:`, err);
    }
}