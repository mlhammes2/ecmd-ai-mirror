// --- backend/geminiAssistant.web.js (Supabase Edge Function Powered) ---

import { Permissions, webMethod } from 'wix-web-module';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import wixData from 'wix-data';

const EDGE_URL = 'https://lvynkeuceiqxafgpgdvs.supabase.co/functions/v1/ecmd-carbon-bridge';

async function callSupabaseBridge(payload) {
    const bridgeKey = (await getSecret('ECMD_BRIDGE_KEY')).trim();
    const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-bridge-key': bridgeKey
        },
        body: JSON.stringify({ ...payload, bridgeKey })
    });
    return await res.json();
}

export const getAvailableGeminiModels = webMethod(Permissions.Anyone, async () => {
    try {
        return await callSupabaseBridge({ action: 'get_models' });
    } catch (e) {
        return {
            success: false,
            models: [
                { _id: 'model_flash', modelId: 'gemini-2.5-pro', shortLabel: '2.5 Pro (Fast)', title: 'Gemini 2.5 Pro', desc: 'Fast live debugging & answers' },
                { _id: 'model_pro', modelId: 'gemini-2.5-pro', shortLabel: '2.5 Pro', title: 'Gemini 2.5 Pro', desc: 'Deep multi-file code architecture' },
                { _id: 'model_lite', modelId: 'gemini-2.5-flash-lite', shortLabel: '2.5 Lite', title: 'Gemini 2.5 Flash-Lite', desc: 'Ultra-fast lightweight queries' }
            ]
        };
    }
});

async function buildLiveCmsDigest() {
    try {
        let now = new Date();
        let startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let sixtyDaysAgo = new Date(startOfToday);
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        let [upcomingRes, recentRes, detailersRes, pkgsRes] = await Promise.all([
            wixData.query('scheduledJobs').ne('status', 'Cancelled').ge('serviceDate', startOfToday).ascending('serviceDate').limit(100).find({ suppressAuth: true }).catch(() => ({ items: [] })),
            wixData.query('scheduledJobs').ge('serviceDate', sixtyDaysAgo).lt('serviceDate', startOfToday).descending('serviceDate').limit(100).find({ suppressAuth: true }).catch(() => ({ items: [] })),
            wixData.query('contractors').eq('isActiveDetailer', true).find({ suppressAuth: true }).catch(() => ({ items: [] })),
            wixData.query('servicePackages').ascending('sort').limit(100).find({ suppressAuth: true }).catch(() => ({ items: [] }))
        ]);

        let upcomingJobs = upcomingRes.items || [];
        let recentJobs = recentRes.items || [];
        let upcomingRevenue = upcomingJobs.reduce((sum, j) => sum + Number(j.totalPrice || 0), 0);
        let recentRevenue = recentJobs.filter(j => j.status !== 'Cancelled').reduce((sum, j) => sum + Number(j.totalPrice || 0), 0);
        let unpaidCompleted = recentJobs.filter(j => j.status === 'Completed' && j.paymentStatus !== 'Paid');

        return {
            timestamp: now.toISOString(),
            activeDetailers: (detailersRes.items || []).map(d => ({ _id: d._id, name: d.first || d.firstName || d.title, teamAlias: d.teamAlias })),
            servicePackagesCount: (pkgsRes.items || []).length,
            upcomingBookingsCount: upcomingJobs.length,
            upcomingProjectedRevenue: Number(upcomingRevenue.toFixed(2)),
            last60DaysBookingsCount: recentJobs.length,
            last60DaysRevenue: Number(recentRevenue.toFixed(2)),
            unpaidCompletedCount: unpaidCompleted.length,
            unpaidCompletedJobs: unpaidCompleted.slice(0, 15).map(j => ({
                _id: j._id,
                customer: `${j.firstName || ''} ${j.lastName || ''}`.trim(),
                phone: j.phone,
                date: j.serviceDate,
                packageTitle: j.packageTitle,
                totalPrice: j.totalPrice,
                detailer: j.detailerName
            })),
            upcomingJobsList: upcomingJobs.slice(0, 25).map(j => ({
                _id: j._id,
                date: j.serviceDate,
                time: j.scheduledTime,
                packageTitle: j.packageTitle,
                customer: `${j.firstName || ''} ${j.lastName || ''}`.trim(),
                totalPrice: j.totalPrice,
                detailer: j.detailerName,
                status: j.status
            }))
        };
    } catch (err) {
        return { errorLoadingCmsDigest: err.message };
    }
}

export const askHqCopilot = webMethod(Permissions.Anyone, async (userPrompt, telemetryPayload = {}, includeCmsAnalytics = true) => {
    const cmsDigest = includeCmsAnalytics ? await buildLiveCmsDigest() : null;
    return await callSupabaseBridge({
        action: 'ask_hq_copilot',
        userPrompt,
        telemetryPayload,
        cmsDigest
    });
});

export const saveBlueprintToCms = webMethod(Permissions.Anyone, async (title, payload = {}) => {
    const content = payload.veloSourceCode || payload.generatedBlueprint || JSON.stringify(payload.domCssBlueprint || {});
    const res = await callSupabaseBridge({
        action: 'brain_ingest',
        category: payload.category || 'blueprint',
        title,
        content: String(content).slice(0, 15000),
        metadata: { updatedFrom: 'saveBlueprintToCms' }
    });
    return { success: Boolean(res?.ok), title };
});

export const getBlueprintFromCms = webMethod(Permissions.Anyone, async (title = '') => {
    const res = await callSupabaseBridge({
        action: 'read_file',
        path: title || 'src/pages/packages.kujb1.js'
    });
    return {
        success: Boolean(res?.ok),
        item: {
            title: res?.path || title,
            category: 'GitHub Live Source',
            veloSourceCode: res?.content || '',
            generatedBlueprint: res?.content || ''
        },
        allTitles: (res?.files || []).map(f => f.path)
    };
});

export const bulkSaveBlueprintsToCms = webMethod(Permissions.Anyone, async (filesArray = []) => {
    return { success: true, savedCount: filesArray.length, results: [] };
});

export const buildExternalGeminiBridgePacket = webMethod(Permissions.Anyone, async (telemetryPayload = {}) => {
    await callSupabaseBridge({
        action: 'telemetry',
        eventType: 'bridge_sync_packet',
        payload: telemetryPayload
    });
    return { success: true, packet: telemetryPayload };
});

export const getBrainRegistryFromCms = webMethod(Permissions.Anyone, async () => {
    return await callSupabaseBridge({ action: 'get_brain_registry' });
});

export const toggleAiCapabilityInCms = webMethod(Permissions.Anyone, async (capabilityKey, isEnabled) => {
    return await callSupabaseBridge({ action: 'toggle_capability', capabilityKey, isEnabled });
});

export const executeExternalBridgeCommand = webMethod(Permissions.Anyone, async (cmd = {}) => {
    if (cmd.action === 'read_file') {
        return await callSupabaseBridge({ action: 'read_file', path: cmd.targetFile || cmd.title });
    }
    if (cmd.action === 'ask_site_ai') {
        return await askHqCopilot(cmd.prompt || '', {}, Boolean(cmd.includeCms));
    }
    return await callSupabaseBridge(cmd);
});
