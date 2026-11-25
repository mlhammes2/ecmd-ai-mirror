// --- public/repeaterEngine.js ---

import { APP_LOGS } from 'public/loggerConfig';
import { registerModuleState, registerDomElements } from 'public/aiTelemetry';

const DEBUG_MODE = APP_LOGS.MASTER_SWITCH && APP_LOGS.REPEATER;
const logger = {
    info: (msg, data) => { data !== undefined ? console.log(`📌 [REPEATER_ENGINE]: ${msg}`, data) : console.log(`📌 [REPEATER_ENGINE]: ${msg}`); },
    warn: (msg, data) => { data !== undefined ? console.warn(`📌 [REPEATER_ENGINE]: ${msg}`, data) : console.warn(`📌 [REPEATER_ENGINE]: ${msg}`); },
    error: (msg, data) => { data !== undefined ? console.error(`📌 [REPEATER_ENGINE]: ${msg}`, data) : console.error(`📌 [REPEATER_ENGINE]: ${msg}`); }
};

const repeaterRegistry = {};
const repeaterRenderStatus = {};

registerModuleState("repeaterEngine", () => ({
    registeredRepeaters: Object.keys(repeaterRegistry),
    repeaterRenderStatus: { ...repeaterRenderStatus }
}));

export function registerRepeater($w, repeaterId, paintInstructions) {
    let rep = $w(repeaterId);
   
    if (rep.id) {
        logger.info(`registerRepeater -> Registered ${repeaterId}`);
        repeaterRegistry[repeaterId] = paintInstructions;
        repeaterRenderStatus[repeaterId] = false;
        registerDomElements({ repeaters: [repeaterId] });
       
        rep.data = [];
       
        rep.onItemReady(($item, itemData, index) => {
            if (!repeaterRenderStatus[repeaterId]) {
                logger.info(`onItemReady -> First Item Painted for ${repeaterId}`);
            }
            repeaterRenderStatus[repeaterId] = true;
            paintInstructions($item, itemData, index);
        });
    } else {
        logger.error(`registerRepeater -> Element not found in DOM: ${repeaterId}`);
    }
}

export function repaintSingleItem($w, repeaterId, updatedItem) {
    let rep = $w(repeaterId);
    if (rep.id && repeaterRegistry[repeaterId]) {
        logger.info(`repaintSingleItem -> Repainting item in ${repeaterId}: ${updatedItem._id}`);
        rep.forItems([updatedItem._id], ($item, itemData, index) => {
            repeaterRegistry[repeaterId]($item, updatedItem, index);
        });
    }
}

export function smartSyncRepeater($w, repeaterId, newData, renderDelay = 0) {
    let rep = $w(repeaterId);
   
    if (!rep.id) {
        logger.error(`smartSyncRepeater -> Cannot sync data! Element not found: ${repeaterId}`);
        return;
    }
   
    if (!newData || !Array.isArray(newData)) {
        logger.warn(`smartSyncRepeater -> Bad data sent to ${repeaterId}. Defaulting to empty array.`);
        newData = [];
    }
   
    let currentData = rep.data || [];
    let isChanged = JSON.stringify(currentData) !== JSON.stringify(newData);
    let isRendered = repeaterRenderStatus[repeaterId] === true;
   
    logger.info(`smartSyncRepeater -> ${repeaterId} | Incoming: ${newData.length} | Changed: ${isChanged} | Rendered: ${isRendered}`);
   
    if (isChanged) {
        try {
            rep.data = newData;
        } catch (e) {
            logger.error(`smartSyncRepeater -> Velo rejected data for ${repeaterId}. Check _id fields!`, e);
            return;
        }
       
        if (repeaterRegistry[repeaterId]) {
            setTimeout(() => {
                if (rep.data.length === newData.length) {
                    rep.forEachItem(($item, itemData, index) => {
                        let freshData = newData.find(d => String(d._id) === String(itemData._id));
                        if (freshData) {
                            repeaterRegistry[repeaterId]($item, freshData, index);
                        }
                    });
                }
            }, renderDelay);
        }
    } else if (!isRendered && newData.length > 0) {
        logger.info(`smartSyncRepeater -> Waking up dormant repeater: ${repeaterId}`);
        rep.data = [];
        setTimeout(() => {
            rep.data = newData;
        }, renderDelay);
    }
}