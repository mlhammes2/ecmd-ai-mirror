// --- backend/aiBrain.web.js (Supabase Edge Function Connector) ---

import { Permissions, webMethod } from 'wix-web-module';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import wixData from 'wix-data';
import { sendTwilioSMS } from 'backend/twilioProxy';
import { sendMasterTransactionalEmail } from 'backend/emailDispatchEngine.jsw';

const EDGE_URL = 'https://lvynkeuceiqxafgpgdvs.supabase.co/functions/v1/ecmd-carbon-bridge';

async function callEdge(payload, includeBridgeKey = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (includeBridgeKey) {
    const bridgeKey = (await getSecret('ECMD_BRIDGE_KEY')).trim();
    headers['x-bridge-key'] = bridgeKey;
    payload.bridgeKey = bridgeKey;
  }
  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  return await res.json();
}

export const logTelemetryToSupabase = webMethod(Permissions.Anyone, (data = {}) =>
  callEdge({ action: 'telemetry', ...data })
);

export const searchBrain = webMethod(Permissions.Anyone, (query, options = {}) =>
  callEdge({ action: 'brain_search', query, ...options })
);

export const askEcmdBrain = webMethod(Permissions.Anyone, (question, vehicleContext = {}) =>
  callEdge({ action: 'ask_advisor', question, vehicleContext })
);

export const fetchSupabaseCrmBundle = webMethod(Permissions.Anyone, async (userId = '') => {
  try {
    return await callEdge({ action: 'get_crm_bundle', userId });
  } catch (e) {
    return { ok: false, vehicles: [], contacts: [], locations: [], jobs: [] };
  }
});

export const syncWixCrmToSupabase = webMethod(Permissions.Anyone, async () => {
  return await callEdge({ action: 'sync_crm_to_supabase' }, true);
});

export const pushCrmRecordToSupabase = webMethod(Permissions.Anyone, async (collection, item) => {
  try {
    return await callEdge({ action: 'crm_realtime_upsert', collection, item });
  } catch (e) {
    return { ok: false };
  }
});

export const getAiUnsureInbox = webMethod(Permissions.Anyone, async () => {
  return await callEdge({ action: 'get_ai_inbox' }, true);
});

export const answerAiInboxQuestion = webMethod(Permissions.Anyone, async (inboxId, ownerYesNoToggle = null, ownerAnswerText = '') => {
  return await callEdge({ action: 'answer_inbox_question', inboxId, ownerYesNoToggle, ownerAnswerText }, true);
});

export const smartConverseWithBrain = webMethod(Permissions.Anyone, async (payload = {}) => {
  const res = await callEdge({ action: 'smart_converse', ...payload });
  if (res && res.isUnsure) {
    const custLabel = `${payload.customerName || res.extractedCrm?.customerName || 'Visitor'} (${payload.customerPhone || res.extractedCrm?.customerPhone || 'No Phone'})`;
    const smsBody = `🤖 ECMD AI Unsure Alert!\nFrom: ${custLabel}\nQ: "${String(payload.message || '').slice(0, 110)}"\nToggle Yes/No in Console: ${res.yesNoQuestionForOwner || ''}`;
    try {
      await sendTwilioSMS('+18503777497', '+18503777497', smsBody);
    } catch (smsErr) {}
    try {
      await sendMasterTransactionalEmail('mlhammes1@gmail.com', {
        firstName: 'Michael',
        orderId: `AI-INBOX-${String(res.inboxItemId || '').slice(0, 8)}`,
        jobs: [{
          packageTitle: `AI Unsure Question from ${custLabel}`,
          vehicleInfo: res.extractedCrm?.vehicle || payload.vehicleContext || 'Customer Inquiry',
          specialInstructions: `QUESTION: ${payload.message}\n\nAI SUPPLEMENTAL REPLY SENT: ${res.reply}\n\nPROPOSED YES/NO RULE: ${res.yesNoQuestionForOwner}`
        }]
      }, 'UPDATE');
    } catch (emailErr) {}
  }
  return res;
});

export const classifyVehicleWithSupabase = webMethod(Permissions.Anyone, (vehicleInput) =>
  callEdge({ action: 'classify_vehicle', vehicleInput })
);

export const ingestToBrain = webMethod(Permissions.Admin, ({ category = 'general', title, content, metadata = {} }) =>
  callEdge({ action: 'brain_ingest', category, title, content, metadata }, true)
);

export const syncPackagesToBrain = webMethod(Permissions.Admin, async () => {
  const pkgRes = await wixData.query('servicePackages').limit(100).find({ suppressAuth: true });
  const results = [];
  for (const pkg of (pkgRes.items || [])) {
    const title = `${pkg.title || pkg.packageLevel || 'Package'} (${pkg.subCategory || 'All Vehicles'})`;
    const content = [
      `Package: ${pkg.title || ''}`,
      `Level: ${pkg.packageLevel || ''}`,
      `Detail Type: ${pkg.detailType || ''}`,
      `Vehicle Tier: ${pkg.subCategory || ''}`,
      `Price: $${pkg.price || 0} (Sale: $${pkg.salePrice || pkg.price || 0})`,
      `Duration: ${pkg.duration || ''} hrs`
    ].join('\n');
    const saved = await callEdge({
      action: 'brain_ingest',
      category: 'package',
      title,
      content,
      metadata: { wixId: pkg._id, price: pkg.price, subCategory: pkg.subCategory }
    }, true);
    results.push(saved);
  }
  return { syncedCount: results.length };
});

export const compilePageForMigration = webMethod(Permissions.Anyone, (pageSlug = '/home') =>
  callEdge({ action: 'compile_migration', pageSlug })
);

export const saveBlueprintToCms = webMethod(Permissions.Admin, async (route, content) => {
  return callEdge({
    action: 'brain_ingest',
    items: [{
      category: 'migration_blueprint',
      title: `FullBlueprint${route}`,
      content: content,
      metadata: { 
        route: route, 
        timestamp: Date.now() 
      }
    }]
  }, true);
});

export const remoteSpiderAllPages = webMethod(Permissions.Anyone, async () => {
  const baseUrl = 'https://www.ecmdutah.com';
  const paths = ['/', '/packages', '/booking-hq', '/detailer', '/checkout'];

  const results = await Promise.all(paths.map(async (path) => {
    const url = path === '/' ? baseUrl : `${baseUrl}${path}`;
    try {
      const res = await fetch(url);
      const html = await res.text();

      // Extract component IDs
      const idMatches = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
      const uniqueIds = [...new Set(idMatches)];

      // Extract CSS classes
      const classMatches = [...html.matchAll(/class="([^"]+)"/g)].map(m => m[1]);
      const allClasses = classMatches.flatMap(c => c.split(/\s+/)).filter(Boolean);
      const uniqueClasses = [...new Set(allClasses)];

      // Extract SSR HTML structure (tags)
      const tagsMatches = [...html.matchAll(/<([a-zA-Z0-9\-]+)[^>]*>/g)].map(m => m[1]);
      const uniqueTags = [...new Set(tagsMatches)];

      const content = [
        `Page URL: ${url}`,
        `HTML Structure Tags: ${uniqueTags.join(', ')}`,
        `Component IDs: ${uniqueIds.join(', ')}`,
        `CSS Classes: ${uniqueClasses.join(', ')}`
      ].join('\n');

      // Ingest into Supabase ecmd_brain
      const saved = await callEdge({
        action: 'brain_ingest',
        items: [{
          category: 'migration_blueprint',
          title: `FullBlueprint${path}`,
          content: content,
          metadata: { 
            route: path, 
            timestamp: Date.now() 
          }
        }]
      }, true);

      return { path, status: 'success', saved };
    } catch (error) {
      return { path, status: 'error', error: error.message };
    }
  }));

  return results;
});
