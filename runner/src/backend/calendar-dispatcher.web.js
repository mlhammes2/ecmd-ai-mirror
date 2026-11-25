// --- backend/calendar-dispatcher.web.js ---

import { getSecret } from 'wix-secrets-backend';
import { google } from 'googleapis';
import { Permissions, webMethod } from 'wix-web-module';
import realtimeBackend from 'wix-realtime-backend';
import wixData from 'wix-data'; 

// 🌟 YOUR MASTER DISPATCH CALENDAR ID:
const ADMIN_CALENDAR_ID = "c_7a27c584158dbb455686d19059303a63a1913ae7dcc0e6e022e178bf588a40a0@group.calendar.google.com"; 

// ==========================================
// 🔐 GOOGLE AUTHENTICATION ENGINE
// ==========================================
async function getGoogleAuth() {
    try {
        const secretString = await getSecret("GOOGLE_CALENDAR_KEY");
        const credentials = JSON.parse(secretString);

        const auth = new google.auth.JWT(
            credentials.client_email,
            null,
            credentials.private_key,
            ['https://www.googleapis.com/auth/calendar.events'] 
        );

        return auth;
    } catch (error) {
        console.error("📌 [BACKEND_CALENDAR_DISPATCHER -> getGoogleAuth]: 🚨 Error logging into Google:", error);
        throw new Error("Failed to authenticate with Google Calendar.");
    }
}

// ==========================================
// 🗓️ 1. SCHEDULE NEW JOB (Returns Event IDs)
// ==========================================
export const scheduleDetailingJob = webMethod(Permissions.Anyone, async (calendarId, appointmentDetails) => {
    try {
        console.log(`📌 [BACKEND_CALENDAR_DISPATCHER -> scheduleDetailingJob]: Initiating push to Google Calendar: ${calendarId}`);
        const authClient = await getGoogleAuth();
        const calendar = google.calendar({ version: 'v3', auth: authClient });

        const eventPayload = {
            summary: appointmentDetails.title,
            description: appointmentDetails.description,
            start: { dateTime: appointmentDetails.startTime, timeZone: 'America/Denver' },
            end: { dateTime: appointmentDetails.endTime, timeZone: 'America/Denver' },
        };

        // 1. PUSH TO THE DETAILER'S CALENDAR
        const cleanCalendarId = calendarId.trim();
        
        const response = await calendar.events.insert({
            calendarId: cleanCalendarId,
            requestBody: eventPayload
        });
        let detailerEventId = response.data.id;
        console.log(`📌 [BACKEND_CALENDAR_DISPATCHER -> scheduleDetailingJob]: Success! Detailer Event ID: ${detailerEventId}`);

        // 2. PUSH "CARBON COPY" TO THE ADMIN CALENDAR
        let adminEventId = null;
        if (ADMIN_CALENDAR_ID) {
            try {
                const adminPayload = { ...eventPayload, summary: `[${appointmentDetails.detailerName || "Assigned"}] ${appointmentDetails.title}` };
                const adminRes = await calendar.events.insert({
                    calendarId: ADMIN_CALENDAR_ID.trim(),
                    requestBody: adminPayload
                });
                adminEventId = adminRes.data.id;
                console.log(`📌 [BACKEND_CALENDAR_DISPATCHER -> scheduleDetailingJob]: Success! Admin Event ID: ${adminEventId}`);
            } catch (adminErr) {
                console.error("📌 [BACKEND_CALENDAR_DISPATCHER -> scheduleDetailingJob]: 🚨 Admin Copy Failed:", adminErr.message);
            }
        }

        return { success: true, eventId: detailerEventId, adminEventId: adminEventId };
        
    } catch (error) {
        console.error("📌 [BACKEND_CALENDAR_DISPATCHER -> scheduleDetailingJob]: 🚨 GOOGLE API CRASH:", error.message);
        
        try {
            await wixData.insert("syncErrors", {
                title: "Failed Google Calendar Sync",
                calendarId: calendarId,
                payload: JSON.stringify(appointmentDetails),
                errorMessage: error.message,
                timestamp: new Date()
            });
        } catch (dbErr) { console.error("📌 [BACKEND_CALENDAR_DISPATCHER -> syncErrorsInsert]: 🚨 FAILSAFE CRASH", dbErr); }

        return { success: false, error: error.message };
    }
});

// ==========================================
// 🔄 2. RESCHEDULE & SELF-HEALING ENGINE
// ==========================================
export const updateOrRestoreDetailingJob = webMethod(Permissions.Anyone, async (calendarId, savedEventIds, appointmentDetails) => {
    try {
        console.log(`📌 [BACKEND_CALENDAR_DISPATCHER -> updateOrRestoreDetailingJob]: Rescheduling job for: ${calendarId}`);
        const authClient = await getGoogleAuth();
        const calendar = google.calendar({ version: 'v3', auth: authClient });

        const eventPayload = {
            summary: appointmentDetails.title,
            description: appointmentDetails.description,
            start: { dateTime: appointmentDetails.startTime, timeZone: 'America/Denver' },
            end: { dateTime: appointmentDetails.endTime, timeZone: 'America/Denver' },
        };

        let activeDetailerId = savedEventIds?.eventId;
        let activeAdminId = savedEventIds?.adminEventId;

        // 1. UPDATE DETAILER CALENDAR (WITH SELF-HEALING)
        try {
            if (activeDetailerId) {
                await calendar.events.patch({ calendarId: calendarId, eventId: activeDetailerId, requestBody: eventPayload });
                console.log(`📌 [BACKEND_CALENDAR_DISPATCHER -> updateOrRestoreDetailingJob]: Updated existing Detailer event.`);
            } else { throw new Error("No ID"); }
        } catch (err) {
            console.warn("📌 [BACKEND_CALENDAR_DISPATCHER -> updateOrRestoreDetailingJob]: Detailer event missing or deleted! Recreating...");
            const res = await calendar.events.insert({ calendarId: calendarId, requestBody: eventPayload });
            activeDetailerId = res.data.id;
        }

        // 2. UPDATE ADMIN CALENDAR
        try {
            const adminPayload = { ...eventPayload, summary: `[${appointmentDetails.detailerName || "Assigned"}] ${appointmentDetails.title}` };
            if (activeAdminId) {
                await calendar.events.patch({ calendarId: ADMIN_CALENDAR_ID, eventId: activeAdminId, requestBody: adminPayload });
                console.log(`📌 [BACKEND_CALENDAR_DISPATCHER -> updateOrRestoreDetailingJob]: Updated existing Admin event.`);
            } else { throw new Error("No ID"); }
        } catch (err) {
            console.warn("📌 [BACKEND_CALENDAR_DISPATCHER -> updateOrRestoreDetailingJob]: Admin event missing! Recreating...");
            const adminPayload = { ...eventPayload, summary: `[${appointmentDetails.detailerName || "Assigned"}] ${appointmentDetails.title}` };
            const adminRes = await calendar.events.insert({ calendarId: ADMIN_CALENDAR_ID, requestBody: adminPayload });
            activeAdminId = adminRes.data.id;
        }

        return { success: true, eventId: activeDetailerId, adminEventId: activeAdminId };

    } catch (error) {
        console.error("📌 [BACKEND_CALENDAR_DISPATCHER -> updateOrRestoreDetailingJob]: 🚨 Reschedule Failed:", error.message);
        return { success: false, error: error.message };
    }
});

// ==========================================
// 📡 REALTIME NETWORK BROADCASTER
// ==========================================
export const broadcastCalendarUpdate = webMethod(Permissions.Anyone, async () => {
    try {
        await realtimeBackend.publish({ name: "CalendarSync" }, { message: "SlotBooked" });
        console.log("📌 [BACKEND_CALENDAR_DISPATCHER -> broadcastCalendarUpdate]: Broadcast successful.");
    } catch (err) {
        console.error("📌 [BACKEND_CALENDAR_DISPATCHER -> broadcastCalendarUpdate]: 🚨 Broadcast error:", err);
    }
});

// ==========================================
// 🗑️ DELETE GOOGLE EVENT (Triggered by CMS)
// ==========================================
export const deleteGoogleEvent = webMethod(Permissions.Anyone, async (calendarId, eventId, adminEventId) => {
    try {
        const authClient = await getGoogleAuth();
        const calendar = google.calendar({ version: 'v3', auth: authClient });

        // 1. Delete from Detailer Calendar
        if (calendarId && eventId) {
            try {
                await calendar.events.delete({ calendarId: calendarId, eventId: eventId });
                console.log(`📌 [BACKEND_CALENDAR_DISPATCHER -> deleteGoogleEvent]: Deleted event from Detailer Calendar.`);
            } catch (e) { console.warn("📌 [BACKEND_CALENDAR_DISPATCHER -> deleteGoogleEvent]: Detailer event already deleted or not found."); }
        }

        // 2. Delete from Admin Calendar
        if (ADMIN_CALENDAR_ID && adminEventId) {
            try {
                await calendar.events.delete({ calendarId: ADMIN_CALENDAR_ID, eventId: adminEventId });
                console.log(`📌 [BACKEND_CALENDAR_DISPATCHER -> deleteGoogleEvent]: Deleted event from Admin Calendar.`);
            } catch (e) { console.warn("📌 [BACKEND_CALENDAR_DISPATCHER -> deleteGoogleEvent]: Admin event already deleted or not found."); }
        }
        return true;
    } catch (error) {
        console.error("📌 [BACKEND_CALENDAR_DISPATCHER -> deleteGoogleEvent]: 🚨 Failed to delete events:", error.message);
        return false;
    }
});