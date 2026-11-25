// --- backend/calendarTasks.js ---

import wixData from 'wix-data';

export async function releaseAbandonedTimeSlots() {
    // ⏳ Set the time limit (15 minutes)
    const IDLE_MINUTES = 15;
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - IDLE_MINUTES);

    try {
        let queryResults = await wixData.query("temporaryData")
            .isNotEmpty("assignedSlotText")
            .lt("_updatedDate", cutoffTime)
            .find({ suppressAuth: true });

        if (queryResults.items.length > 0) {
            console.log(`📌 [BACKEND_CALENDAR_TASKS -> releaseAbandonedTimeSlots]: Found ${queryResults.items.length} abandoned slots. Releasing...`);
            
            let itemsToUpdate = queryResults.items.map(item => {
                item.assignedDate = null;
                item.assignedTime = null;
                item.assignedTimeToken = null;
                item.assignedDetailerId = null;
                item.assignedSlotText = null;
                return item;
            });

            await wixData.bulkUpdate("temporaryData", itemsToUpdate, { suppressAuth: true });
            console.log("📌 [BACKEND_CALENDAR_TASKS -> releaseAbandonedTimeSlots]: Abandoned slots successfully released.");
        } else {
            console.log("📌 [BACKEND_CALENDAR_TASKS -> releaseAbandonedTimeSlots]: No abandoned slots found.");
        }
    } catch (error) {
        console.error("📌 [BACKEND_CALENDAR_TASKS -> releaseAbandonedTimeSlots]: 🚨 Backend Cleanup Error:", error);
    }
}