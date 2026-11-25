// --- backend/http-functions.js ---

import { ok, forbidden, badRequest, serverError } from 'wix-http-functions';
import { fetch } from 'wix-fetch';
import { getSecret } from 'wix-secrets-backend';
import { rewriteTextWithGemini, sendTwilioSMS, logMessageToJob } from 'backend/twilioProxy';
import { executeExternalBridgeCommand } from 'backend/geminiAssistant.web';
import wixData from 'wix-data';

function clean10DigitPhone(raw) {
    if (!raw) return '';
    let digits = String(raw).replace(/\D/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
}

function toE164(raw) {
    let ten = clean10DigitPhone(raw);
    return ten.length === 10 ? `+1${ten}` : String(raw || '').trim();
}

export async function post_twilioWebhook(request) {
    try {
        let bodyText = await request.body.text();
        let twilioParams = new URLSearchParams(bodyText);
        let rawMessage = twilioParams.get('Body');
        let senderPhone = twilioParams.get('From');
        let twilioPhone = twilioParams.get('To');
        let sender10 = clean10DigitPhone(senderPhone);

        if (!sender10) return ok({ body: 'Invalid sender phone number.' });

        let [activeJobsRes, contractorsRes] = await Promise.all([
            wixData.query('scheduledJobs').hasSome('status', ['En Route', 'Arrived']).find({ suppressAuth: true }),
            wixData.query('contractors').eq('isActiveDetailer', true).find({ suppressAuth: true })
        ]);

        let contractorsMap = {};
        (contractorsRes.items || []).forEach(c => { contractorsMap[c._id] = c; });

        let matchedJob = null;
        let isFromDetailer = false;
        let liveDetailerPhone = '';
        let liveCustomerPhone = '';

        for (let job of (activeJobsRes.items || [])) {
            let detObj = contractorsMap[job.detailerId] || {};
            let detPhoneRaw = detObj.phoneNumber || detObj.phone || '';
            let custPhoneRaw = job.phone || '';
            let det10 = clean10DigitPhone(detPhoneRaw);
            let cust10 = clean10DigitPhone(custPhoneRaw);

            if (det10 && sender10 === det10) {
                matchedJob = job;
                isFromDetailer = true;
                liveDetailerPhone = toE164(detPhoneRaw);
                liveCustomerPhone = toE164(custPhoneRaw);
                break;
            }
            if (cust10 && sender10 === cust10) {
                matchedJob = job;
                isFromDetailer = false;
                liveDetailerPhone = toE164(detPhoneRaw);
                liveCustomerPhone = toE164(custPhoneRaw);
                break;
            }
        }

        if (!matchedJob) return ok({ body: 'No active job found for this number.' });

        if (isFromDetailer) {
            let polishedMessage = await rewriteTextWithGemini(rawMessage);
            await logMessageToJob(matchedJob._id, 'Detailer', polishedMessage);
            if (liveCustomerPhone) await sendTwilioSMS(liveCustomerPhone, twilioPhone, polishedMessage);
        } else {
            await logMessageToJob(matchedJob._id, 'Customer', rawMessage);
            if (liveDetailerPhone) await sendTwilioSMS(liveDetailerPhone, twilioPhone, rawMessage);
        }

        return ok({ headers: { 'Content-Type': 'text/xml' }, body: '<Response></Response>' });
    } catch (error) {
        return serverError({ body: 'Internal Server Error' });
    }
}

async function verifyBridgeAuth(request) {
    try {
        const masterKey = (await getSecret('ECMD_BRIDGE_KEY')).trim();
        const headerKey = request.headers && (request.headers['x-ecmd-key'] || request.headers['x-bridge-key'] || request.headers['authorization']?.replace(/^Bearer\s+/i, ''));
        const queryKey = request.query && (request.query.key || request.query.p);
        const providedKey = String(headerKey || queryKey || '').trim();
        return { authorized: Boolean(masterKey && providedKey === masterKey) };
    } catch (e) {
        return { authorized: false };
    }
}

function jsonOut(statusFn, bodyObj) {
    return statusFn({
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify(bodyObj, null, 2)
    });
}

export async function get_geminiBridge(request) {
    const auth = await verifyBridgeAuth(request);
    if (!auth.authorized) return jsonOut(forbidden, { ok: false, error: '403 Forbidden' });

    try {
        const collection = request.query?.collection;
        const limit = Number(request.query?.limit || 100);
        if (collection) {
            const res = await wixData.query(collection).limit(limit).find({ suppressAuth: true });
            return jsonOut(ok, { ok: true, collection, count: res.items.length, items: res.items });
        }

        let startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const [jobsRes, detRes, pkgRes] = await Promise.all([
            wixData.query('scheduledJobs').ge('serviceDate', startOfToday).limit(100).find({ suppressAuth: true }),
            wixData.query('contractors').eq('isActiveDetailer', true).find({ suppressAuth: true }),
            wixData.query('servicePackages').ascending('sort').limit(100).find({ suppressAuth: true })
        ]);
        return jsonOut(ok, {
            ok: true,
            upcomingJobsCount: jobsRes.items.length,
            upcomingJobs: jobsRes.items,
            activeDetailers: detRes.items,
            servicePackages: pkgRes.items
        });
    } catch (err) {
        return jsonOut(serverError, { ok: false, error: err.message });
    }
}

export async function post_geminiBridge(request) {
    const auth = await verifyBridgeAuth(request);
    if (!auth.authorized) return jsonOut(forbidden, { ok: false, error: '403 Forbidden' });

    try {
        const body = await request.body.json();
        const { action, collection, item, itemId, filter = {}, limit = 100 } = body;

        if (action === 'cms_query' && collection) {
            let q = wixData.query(collection).limit(Number(limit));
            Object.entries(filter).forEach(([k, v]) => { q = q.eq(k, v); });
            const res = await q.find({ suppressAuth: true });
            return jsonOut(ok, { ok: true, collection, totalCount: res.totalCount, items: res.items });
        }

        if (action === 'cms_save' && collection && item) {
            const saved = item._id
                ? await wixData.update(collection, item, { suppressAuth: true })
                : await wixData.insert(collection, item, { suppressAuth: true });
            return jsonOut(ok, { ok: true, collection, savedItem: saved });
        }

        if (action === 'cms_remove' && collection && itemId) {
            await wixData.remove(collection, itemId, { suppressAuth: true });
            return jsonOut(ok, { ok: true, collection, removedId: itemId });
        }

        const cmdRes = await executeExternalBridgeCommand(body);
        return jsonOut(ok, cmdRes);
    } catch (err) {
        return jsonOut(serverError, { ok: false, error: err.message });
    }
}

export async function get_ecmdConsole(request) {
    const key = (request.query && request.query.key) || "";
    if (key !== "[REDACTED_SECRET]") {
        return forbidden({ body: "Unauthorized" });
    }
    const res = await fetch("https://lvynkeuceiqxafgpgdvs.supabase.co/functions/v1/ecmd-carbon-bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bridge-key": "[REDACTED_SECRET]" },
        body: JSON.stringify({
            action: "run_sql",
            sql: "SELECT system_prompt_directive FROM public.ecmd_external_ai_cms WHERE id = 'hosted_console_html_v77' LIMIT 1"
        })
    });
    const data = await res.json();
    const htmlText = (data.rows && data.rows[0] && data.rows[0].system_prompt_directive) || "Console bundle not found";
    return ok({
        body: htmlText,
        headers: { "Content-Type": "text/html; charset=utf-8" }
    });
}