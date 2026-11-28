import type { CanvasDiagnostic } from "./ecmdLiveComponentTelemetry";

export const CLIENT_DISMISS_STORAGE_KEY = "ecmd_diagnostics_dismiss_state_v1";

/** Passive auto-prune age (60 min) for entries that stop reporting across sessions. */
export const DEFAULT_PASSIVE_STALE_MS = 60 * 60 * 1000;

/** Active "Clear Resolved / Stale" age (2 min) for sweeping non-mounted components immediately. */
export const DEFAULT_CLEAR_STALE_MS = 2 * 60 * 1000;

export interface LiveDomEntryRecord {
  key?: string;
  componentName: string;
  artboardTag: string;
  displayName?: string;
  viewportMode?: string;
  viewportWidthPx?: number;
  updatedAt?: string;
  snapshot?: unknown;
  diagnostics?: CanvasDiagnostic[];
  [extra: string]: unknown;
}

export interface LiveDomStorePayload {
  updatedAt: string | null;
  entries: Record<string, LiveDomEntryRecord>;
  componentNames: string[];
}

export interface DiagnosticsStorePayload {
  updatedAt: string | null;
  totalActive: number;
  totalDismissed: number;
  dismissedIds: string[];
  removedEntries?: Record<string, string>;
  removedComponents?: Record<string, string>;
  rescanResetAt?: string | null;
  diagnostics: CanvasDiagnostic[];
  activeDiagnostics: CanvasDiagnostic[];
}

export interface DiagnosticsDismissAction {
  id?: string;
  clearResolved?: boolean;
  clearAll?: boolean;
  restoreAll?: boolean;
  removeComponent?: string;
  artboardTag?: string;
  removeEntryKey?: string;
  resetForRescan?: boolean;
  staleMaxAgeMs?: number;
}

export interface DiagnosticsRuntimeState {
  liveDomEntries: Record<string, LiveDomEntryRecord>;
  dismissedIds: Set<string>;
  removedEntries: Record<string, string>;
  removedComponents: Record<string, string>;
  rescanResetAt: string | null;
}

export interface ClientDiagnosticsDismissState {
  dismissedIds: string[];
  removedEntries: Record<string, string>;
  removedComponents: Record<string, string>;
  rescanResetAt: string | null;
}

function parseIsoMs(iso: string | null | undefined): number | null {
  if (!iso || typeof iso !== "string") return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

export function makeLiveDomEntryKey(componentName: string, artboardTag: string): string {
  return `${String(componentName || "").trim()}::${String(artboardTag || "desktop-1440").trim()}`;
}

function makeDiagPrefix(componentName: string, artboardTag?: string): string {
  const base = artboardTag
    ? `${componentName}::${artboardTag}::`
    : `${componentName}::`;
  return base.toLowerCase().replace(/[^a-z0-9:_-]+/g, "-");
}

function sanitizeTimestampRecord(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k && typeof v === "string" && parseIsoMs(v) !== null) {
      out[k] = v;
    }
  }
  return out;
}

export function createDiagnosticsRuntimeState(
  initialLiveDom?: Partial<LiveDomStorePayload> | null,
  initialDiagnostics?: Partial<DiagnosticsStorePayload> | null
): DiagnosticsRuntimeState {
  const liveDomEntries: Record<string, LiveDomEntryRecord> =
    initialLiveDom && initialLiveDom.entries && typeof initialLiveDom.entries === "object"
      ? { ...initialLiveDom.entries }
      : {};
  const dismissedIds = new Set<string>(
    Array.isArray(initialDiagnostics?.dismissedIds)
      ? initialDiagnostics.dismissedIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : []
  );
  const removedEntries = sanitizeTimestampRecord(initialDiagnostics?.removedEntries);
  const removedComponents = sanitizeTimestampRecord(initialDiagnostics?.removedComponents);
  const rescanResetAt =
    typeof initialDiagnostics?.rescanResetAt === "string" &&
    parseIsoMs(initialDiagnostics.rescanResetAt) !== null
      ? initialDiagnostics.rescanResetAt
      : null;

  return {
    liveDomEntries,
    dismissedIds,
    removedEntries,
    removedComponents,
    rescanResetAt,
  };
}

/**
 * Removes entries whose componentName is no longer registered in src/plasmic-init.ts.
 */
export function pruneUnregisteredEntries(
  state: DiagnosticsRuntimeState,
  registeredNames: Set<string> | null | undefined
): boolean {
  if (!registeredNames || registeredNames.size === 0) return false;
  let removedAny = false;
  for (const [key, entry] of Object.entries(state.liveDomEntries)) {
    const compName = String(entry?.componentName || key.split("::")[0] || "").trim();
    if (compName && !registeredNames.has(compName)) {
      delete state.liveDomEntries[key];
      removedAny = true;
    }
  }
  return removedAny;
}

/**
 * Removes entries whose updatedAt timestamp is missing/invalid or older than maxAgeMs
 * relative to nowMs (or relative to the newest entry timestamp in the store).
 */
export function pruneStaleEntries(
  state: DiagnosticsRuntimeState,
  nowMs: number = Date.now(),
  maxAgeMs: number = DEFAULT_PASSIVE_STALE_MS
): boolean {
  let newestEntryMs = 0;
  for (const entry of Object.values(state.liveDomEntries)) {
    const ts = parseIsoMs(entry?.updatedAt);
    if (ts !== null && ts > newestEntryMs) {
      newestEntryMs = ts;
    }
  }
  const referenceMs = Math.max(nowMs, newestEntryMs);
  const cutoffMs = referenceMs - Math.max(0, maxAgeMs);

  let removedAny = false;
  for (const [key, entry] of Object.entries(state.liveDomEntries)) {
    const ts = parseIsoMs(entry?.updatedAt);
    if (ts === null || ts < cutoffMs) {
      delete state.liveDomEntries[key];
      removedAny = true;
    }
  }
  return removedAny;
}

function pruneOrphanedDismissedIds(state: DiagnosticsRuntimeState): boolean {
  const currentIds = new Set<string>();
  for (const entry of Object.values(state.liveDomEntries)) {
    const list = Array.isArray(entry?.diagnostics) ? entry.diagnostics : [];
    for (const d of list) {
      if (d?.id) currentIds.add(d.id);
    }
  }
  let removedAny = false;
  for (const existingId of Array.from(state.dismissedIds)) {
    if (!currentIds.has(existingId)) {
      state.dismissedIds.delete(existingId);
      removedAny = true;
    }
  }
  return removedAny;
}

/**
 * Ingests a live DOM snapshot from a mounted DevTelemetryObserver.
 * - Rejects delayed/stale snapshots generated before a rescan reset or explicit removal tombstone.
 * - NEVER wipes user-dismissed IDs (so transient re-renders never cause dismissed items to reappear).
 * - Passively prunes unregistered and ancient (>60m) entries.
 */
export function ingestLiveDomSnapshot(
  state: DiagnosticsRuntimeState,
  payload: Partial<LiveDomEntryRecord>,
  registeredNames?: Set<string> | null,
  nowMs: number = Date.now()
): { accepted: boolean; key: string; reason?: string } {
  const componentName = String(payload?.componentName || "").trim();
  const artboardTag = String(payload?.artboardTag || "desktop-1440").trim();
  const key = makeLiveDomEntryKey(componentName, artboardTag);

  if (!componentName) {
    return { accepted: false, key, reason: "componentName is required" };
  }

  const incomingIso =
    typeof payload?.updatedAt === "string" && parseIsoMs(payload.updatedAt) !== null
      ? payload.updatedAt
      : new Date(nowMs).toISOString();
  const incomingMs = parseIsoMs(incomingIso) ?? nowMs;

  const resetMs = parseIsoMs(state.rescanResetAt);
  if (resetMs !== null && incomingMs < resetMs) {
    return { accepted: false, key, reason: "Snapshot predates rescanResetAt" };
  }

  const removedEntryMs = parseIsoMs(state.removedEntries[key]);
  if (removedEntryMs !== null && incomingMs <= removedEntryMs) {
    return { accepted: false, key, reason: "Snapshot predates entry removal" };
  }

  const removedCompMs = parseIsoMs(state.removedComponents[componentName]);
  if (removedCompMs !== null && incomingMs <= removedCompMs) {
    return { accepted: false, key, reason: "Snapshot predates component removal" };
  }

  const freshDiagnostics = Array.isArray(payload.diagnostics) ? payload.diagnostics : [];

  state.liveDomEntries[key] = {
    ...payload,
    key,
    componentName,
    artboardTag,
    diagnostics: freshDiagnostics,
    updatedAt: incomingIso,
  };

  // Keep store clean passively without touching user-dismissed IDs
  pruneUnregisteredEntries(state, registeredNames);
  pruneStaleEntries(state, nowMs, DEFAULT_PASSIVE_STALE_MS);

  return { accepted: true, key };
}

/**
 * Handles a component unmounting from the canvas so non-existent components
 * (e.g., EcmdPackagesRepeater removed from canvas) do not leave ghost diagnostics behind.
 */
export function handleComponentUnmount(
  state: DiagnosticsRuntimeState,
  componentName: string,
  artboardTag?: string,
  nowMs: number = Date.now()
): boolean {
  const comp = String(componentName || "").trim();
  if (!comp) return false;
  const nowIso = new Date(nowMs).toISOString();
  let removedAny = false;

  if (artboardTag && String(artboardTag).trim()) {
    const key = makeLiveDomEntryKey(comp, String(artboardTag).trim());
    if (key in state.liveDomEntries) {
      delete state.liveDomEntries[key];
      removedAny = true;
    }
    state.removedEntries[key] = nowIso;
  } else {
    for (const [key, entry] of Object.entries(state.liveDomEntries)) {
      const entryComp = String(entry?.componentName || key.split("::")[0] || "").trim();
      if (entryComp === comp) {
        delete state.liveDomEntries[key];
        state.removedEntries[key] = nowIso;
        removedAny = true;
      }
    }
    state.removedComponents[comp] = nowIso;
  }

  return removedAny;
}

/**
 * Applies a dismiss, clear-stale, remove-component, reset-for-rescan, or restore-all action.
 */
export function applyDismissAction(
  state: DiagnosticsRuntimeState,
  action: DiagnosticsDismissAction,
  registeredNames?: Set<string> | null,
  nowMs: number = Date.now()
): void {
  const nowIso = new Date(nowMs).toISOString();

  if (action.id && typeof action.id === "string") {
    state.dismissedIds.add(action.id);
  }

  if (action.clearAll) {
    for (const entry of Object.values(state.liveDomEntries)) {
      const list = Array.isArray(entry?.diagnostics) ? entry.diagnostics : [];
      for (const d of list) {
        if (d?.id) state.dismissedIds.add(d.id);
      }
    }
  }

  if (action.removeEntryKey && typeof action.removeEntryKey === "string") {
    const targetKey = action.removeEntryKey.trim();
    if (targetKey) {
      delete state.liveDomEntries[targetKey];
      state.removedEntries[targetKey] = nowIso;
      const [comp, ab] = targetKey.split("::");
      if (comp) {
        const prefix = makeDiagPrefix(comp, ab);
        for (const id of Array.from(state.dismissedIds)) {
          if (id.startsWith(prefix)) state.dismissedIds.delete(id);
        }
      }
    }
  }

  if (action.removeComponent && typeof action.removeComponent === "string") {
    const comp = action.removeComponent.trim();
    const ab = typeof action.artboardTag === "string" ? action.artboardTag.trim() : "";
    if (comp) {
      if (ab) {
        const key = makeLiveDomEntryKey(comp, ab);
        delete state.liveDomEntries[key];
        state.removedEntries[key] = nowIso;
        const prefix = makeDiagPrefix(comp, ab);
        for (const id of Array.from(state.dismissedIds)) {
          if (id.startsWith(prefix)) state.dismissedIds.delete(id);
        }
      } else {
        for (const [key, entry] of Object.entries(state.liveDomEntries)) {
          const entryComp = String(entry?.componentName || key.split("::")[0] || "").trim();
          if (entryComp === comp) {
            delete state.liveDomEntries[key];
            state.removedEntries[key] = nowIso;
          }
        }
        state.removedComponents[comp] = nowIso;
        const prefix = makeDiagPrefix(comp);
        for (const id of Array.from(state.dismissedIds)) {
          if (id.startsWith(prefix)) state.dismissedIds.delete(id);
        }
      }
    }
  }

  if (action.clearResolved) {
    pruneUnregisteredEntries(state, registeredNames);
    const staleAge =
      typeof action.staleMaxAgeMs === "number" && Number.isFinite(action.staleMaxAgeMs)
        ? action.staleMaxAgeMs
        : DEFAULT_CLEAR_STALE_MS;
    pruneStaleEntries(state, nowMs, staleAge);
    pruneOrphanedDismissedIds(state);
  }

  if (action.resetForRescan) {
    state.liveDomEntries = {};
    state.removedEntries = {};
    state.removedComponents = {};
    state.rescanResetAt = nowIso;
    // Deliberately preserve state.dismissedIds so user-dismissed items stay dismissed after rescan!
  }

  if (action.restoreAll) {
    state.dismissedIds.clear();
    state.removedEntries = {};
    state.removedComponents = {};
    state.rescanResetAt = null;
  }
}

export function buildTelemetryPayloads(
  state: DiagnosticsRuntimeState,
  nowIso: string = new Date().toISOString()
): {
  liveDomPayload: LiveDomStorePayload;
  diagnosticsPayload: DiagnosticsStorePayload;
} {
  const componentNames = Array.from(
    new Set(
      Object.values(state.liveDomEntries)
        .map((e) => String(e?.componentName || ""))
        .filter(Boolean)
    )
  ).sort();

  const liveDomPayload: LiveDomStorePayload = {
    updatedAt: nowIso,
    entries: { ...state.liveDomEntries },
    componentNames,
  };

  const allDiagnostics: CanvasDiagnostic[] = [];
  const seenDiagIds = new Set<string>();
  for (const entry of Object.values(state.liveDomEntries)) {
    const list = Array.isArray(entry?.diagnostics) ? entry.diagnostics : [];
    for (const d of list) {
      if (d?.id && !seenDiagIds.has(d.id)) {
        seenDiagIds.add(d.id);
        allDiagnostics.push(d);
      }
    }
  }

  const activeDiagnostics = allDiagnostics.filter((d) => !state.dismissedIds.has(d.id));
  const diagnosticsPayload: DiagnosticsStorePayload = {
    updatedAt: nowIso,
    totalActive: activeDiagnostics.length,
    totalDismissed: state.dismissedIds.size,
    dismissedIds: Array.from(state.dismissedIds),
    removedEntries: { ...state.removedEntries },
    removedComponents: { ...state.removedComponents },
    rescanResetAt: state.rescanResetAt,
    diagnostics: allDiagnostics,
    activeDiagnostics,
  };

  return { liveDomPayload, diagnosticsPayload };
}

// ============================================================================
// Client-side localStorage persistence & auto-poll filter (Browser-safe)
// ============================================================================

export function createEmptyClientDismissState(): ClientDiagnosticsDismissState {
  return {
    dismissedIds: [],
    removedEntries: {},
    removedComponents: {},
    rescanResetAt: null,
  };
}

export function readClientDismissState(): ClientDiagnosticsDismissState {
  if (typeof window === "undefined" || !window.localStorage) {
    return createEmptyClientDismissState();
  }
  try {
    const raw = window.localStorage.getItem(CLIENT_DISMISS_STORAGE_KEY);
    if (!raw) return createEmptyClientDismissState();
    const parsed = JSON.parse(raw);
    return {
      dismissedIds: Array.isArray(parsed?.dismissedIds)
        ? Array.from(
            new Set(
              parsed.dismissedIds.filter((x: unknown): x is string => typeof x === "string" && x.length > 0)
            )
          )
        : [],
      removedEntries: sanitizeTimestampRecord(parsed?.removedEntries),
      removedComponents: sanitizeTimestampRecord(parsed?.removedComponents),
      rescanResetAt:
        typeof parsed?.rescanResetAt === "string" && parseIsoMs(parsed.rescanResetAt) !== null
          ? parsed.rescanResetAt
          : null,
    };
  } catch {
    return createEmptyClientDismissState();
  }
}

export function writeClientDismissState(state: ClientDiagnosticsDismissState): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(CLIENT_DISMISS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota / privacy mode failures
  }
}

export function updateClientDismissStateForAction(
  current: ClientDiagnosticsDismissState,
  action: DiagnosticsDismissAction,
  currentActiveDiagnostics: CanvasDiagnostic[],
  nowIso: string = new Date().toISOString()
): ClientDiagnosticsDismissState {
  const dismissedSet = new Set<string>(current.dismissedIds);
  const removedEntries: Record<string, string> = { ...current.removedEntries };
  const removedComponents: Record<string, string> = { ...current.removedComponents };
  let rescanResetAt = current.rescanResetAt;

  if (action.id && typeof action.id === "string") {
    dismissedSet.add(action.id);
  }

  if (action.clearAll) {
    for (const d of currentActiveDiagnostics) {
      if (d?.id) dismissedSet.add(d.id);
    }
  }

  if (action.removeEntryKey && typeof action.removeEntryKey === "string") {
    const key = action.removeEntryKey.trim();
    if (key) {
      removedEntries[key] = nowIso;
    }
  }

  if (action.removeComponent && typeof action.removeComponent === "string") {
    const comp = action.removeComponent.trim();
    const ab = typeof action.artboardTag === "string" ? action.artboardTag.trim() : "";
    if (comp) {
      if (ab) {
        removedEntries[makeLiveDomEntryKey(comp, ab)] = nowIso;
      } else {
        removedComponents[comp] = nowIso;
      }
    }
  }

  if (action.clearResolved) {
    const nowMs = parseIsoMs(nowIso) ?? Date.now();
    const staleAge =
      typeof action.staleMaxAgeMs === "number" && Number.isFinite(action.staleMaxAgeMs)
        ? action.staleMaxAgeMs
        : DEFAULT_CLEAR_STALE_MS;
    const cutoffMs = nowMs - Math.max(0, staleAge);
    for (const d of currentActiveDiagnostics) {
      const detectedMs = parseIsoMs(d?.detectedAt);
      if (detectedMs === null || detectedMs < cutoffMs) {
        const key = makeLiveDomEntryKey(d.componentName, d.artboardTag);
        removedEntries[key] = nowIso;
      }
    }
  }

  if (action.resetForRescan) {
    rescanResetAt = nowIso;
  }

  if (action.restoreAll) {
    dismissedSet.clear();
    for (const k of Object.keys(removedEntries)) delete removedEntries[k];
    for (const k of Object.keys(removedComponents)) delete removedComponents[k];
    rescanResetAt = null;
  }

  return {
    dismissedIds: Array.from(dismissedSet),
    removedEntries,
    removedComponents,
    rescanResetAt,
  };
}

/**
 * Applies client-persisted dismissal & stale-removal state on top of any polled
 * /plasmic-diagnostics.json payload so auto-poll never resurrects dismissed or cleared items.
 */
export function applyClientDismissFilter<
  T extends {
    updatedAt?: string | null;
    totalActive?: number;
    totalDismissed?: number;
    dismissedIds?: string[];
    removedEntries?: Record<string, string>;
    removedComponents?: Record<string, string>;
    rescanResetAt?: string | null;
    diagnostics?: CanvasDiagnostic[];
    activeDiagnostics?: CanvasDiagnostic[];
  }
>(store: T, clientState: ClientDiagnosticsDismissState): T {
  const mergedDismissedIds = new Set<string>([
    ...(Array.isArray(store.dismissedIds) ? store.dismissedIds : []),
    ...clientState.dismissedIds,
  ]);

  const mergedRemovedEntries: Record<string, string> = {
    ...sanitizeTimestampRecord(store.removedEntries),
    ...clientState.removedEntries,
  };
  const mergedRemovedComponents: Record<string, string> = {
    ...sanitizeTimestampRecord(store.removedComponents),
    ...clientState.removedComponents,
  };

  const serverResetMs = parseIsoMs(store.rescanResetAt);
  const clientResetMs = parseIsoMs(clientState.rescanResetAt);
  const effectiveResetMs =
    serverResetMs !== null && clientResetMs !== null
      ? Math.max(serverResetMs, clientResetMs)
      : serverResetMs ?? clientResetMs;

  const rawActive = Array.isArray(store.activeDiagnostics) ? store.activeDiagnostics : [];
  const filteredActive = rawActive.filter((diag) => {
    if (!diag || !diag.id) return false;
    if (mergedDismissedIds.has(diag.id)) return false;

    const detectedMs = parseIsoMs(diag.detectedAt);

    if (effectiveResetMs !== null && (detectedMs === null || detectedMs < effectiveResetMs)) {
      return false;
    }

    const entryKey = makeLiveDomEntryKey(diag.componentName, diag.artboardTag);
    const removedEntryMs = parseIsoMs(mergedRemovedEntries[entryKey]);
    if (removedEntryMs !== null && (detectedMs === null || detectedMs <= removedEntryMs)) {
      return false;
    }

    const removedCompMs = parseIsoMs(mergedRemovedComponents[diag.componentName]);
    if (removedCompMs !== null && (detectedMs === null || detectedMs <= removedCompMs)) {
      return false;
    }

    return true;
  });

  return {
    ...store,
    dismissedIds: Array.from(mergedDismissedIds),
    totalDismissed: mergedDismissedIds.size,
    activeDiagnostics: filteredActive,
    totalActive: filteredActive.length,
  };
}
