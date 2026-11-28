import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const M_TOK = "[REDACTED_SECRET]";

const LIVE_DOM_FILE = path.resolve(process.cwd(), "public/plasmic-live-dom.json");
const DIAGNOSTICS_FILE = path.resolve(process.cwd(), "public/plasmic-diagnostics.json");
const RUNTIME_ERRORS_FILE = path.resolve(process.cwd(), "public/runtime-errors.json");
const PLASMIC_INIT_FILE = path.resolve(process.cwd(), "src/plasmic-init.ts");
const MAX_RUNTIME_ERRORS = 50;

/**
 * Reads component names currently registered via registerEcmdComponent(...) in src/plasmic-init.ts.
 * Returns null if unreadable or empty so callers fail open without wiping live entries.
 */
function getRegisteredPlasmicComponentNames(): Set<string> | null {
  try {
    if (!fs.existsSync(PLASMIC_INIT_FILE)) return null;
    const src = fs.readFileSync(PLASMIC_INIT_FILE, "utf8");
    const names = new Set<string>();
    const re = /registerEcmdComponent\s*\([\s\S]*?\bname\s*:\s*["']([^"']+)["']/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      if (m[1]) names.add(m[1]);
    }
    return names.size > 0 ? names : null;
  } catch {
    return null;
  }
}

/**
 * Removes stale persisted entries whose componentName is no longer registered in src/plasmic-init.ts
 * (e.g., previously removed EcmdVehicleSelector snapshots containing broken fakeimg.pl sources).
 */
function pruneUnregisteredLiveDomEntries(entries: Record<string, any>): boolean {
  const registered = getRegisteredPlasmicComponentNames();
  if (!registered) return false;
  let removedAny = false;
  for (const [key, entry] of Object.entries(entries)) {
    const compName = String((entry as any)?.componentName || key.split("::")[0] || "").trim();
    if (compName && !registered.has(compName)) {
      delete entries[key];
      removedAny = true;
    }
  }
  return removedAny;
}

/**
 * Guards TanStack Router's Vite HMR-injected handleRouteUpdate helper so routes updated while
 * /plasmic-host (CSR without <StartClient />) is open never throw
 * `TypeError: Cannot read properties of undefined (reading 'routesById')`.
 */
function guardTanStackHmrRouteUpdate(code: string): string {
  if (!code.includes("handleRouteUpdate") || !code.includes("routesById")) {
    return code;
  }
  return code.replace(
    /const\s+oldRoute\s*=\s*router\.routesById\[routeId\];?/g,
    "if (!router || !router.routesById) return;\n  const oldRoute = router.routesById[routeId];"
  );
}

function readJsonSafe(filePath: string, fallback: any) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch {
    // ignore corrupt/empty json
  }
  return fallback;
}

function setCorsHeaders(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readRequestBody(req: any): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk: any) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
  });
}

function rebuildAndPersistTelemetry(
  entries: Record<string, any>,
  dismissedIds: Set<string>
) {
  const now = new Date().toISOString();
  const componentNames = Array.from(
    new Set(
      Object.values(entries)
        .map((e: any) => String(e?.componentName || ""))
        .filter(Boolean)
    )
  ).sort();

  const liveDomPayload = {
    updatedAt: now,
    entries,
    componentNames,
  };

  const allDiagnostics: any[] = [];
  const seenDiagIds = new Set<string>();
  for (const entry of Object.values(entries)) {
    const list = Array.isArray((entry as any)?.diagnostics) ? (entry as any).diagnostics : [];
    for (const d of list) {
      if (d?.id && !seenDiagIds.has(d.id)) {
        seenDiagIds.add(d.id);
        allDiagnostics.push(d);
      }
    }
  }

  const activeDiagnostics = allDiagnostics.filter((d) => !dismissedIds.has(d.id));
  const diagnosticsPayload = {
    updatedAt: now,
    totalActive: activeDiagnostics.length,
    totalDismissed: dismissedIds.size,
    dismissedIds: Array.from(dismissedIds),
    diagnostics: allDiagnostics,
    activeDiagnostics,
  };

  try {
    fs.mkdirSync(path.dirname(LIVE_DOM_FILE), { recursive: true });
    fs.writeFileSync(LIVE_DOM_FILE, JSON.stringify(liveDomPayload, null, 2), "utf8");
    fs.writeFileSync(DIAGNOSTICS_FILE, JSON.stringify(diagnosticsPayload, null, 2), "utf8");
  } catch {
    // ignore write failures during rapid reload
  }

  return { liveDomPayload, diagnosticsPayload };
}

function persistRuntimeErrors(errors: any[]) {
  const capped = errors.slice(0, MAX_RUNTIME_ERRORS);
  const payload = {
    updatedAt: new Date().toISOString(),
    totalCount: capped.length,
    errors: capped,
  };
  try {
    fs.mkdirSync(path.dirname(RUNTIME_ERRORS_FILE), { recursive: true });
    fs.writeFileSync(RUNTIME_ERRORS_FILE, JSON.stringify(payload, null, 2), "utf8");
  } catch {
    // ignore write failures during rapid reload
  }
  return payload;
}

export default defineConfig({
  tanstackStart: {
    client: { entry: "client" },
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        name: "ecmd-guard-tsr-hmr",
        apply: "serve",
        enforce: "post",
        transform(code: string) {
          const guarded = guardTanStackHmrRouteUpdate(code);
          return guarded !== code ? { code: guarded, map: null } : null;
        },
      },
      {
        name: "ecmd-ws-bridge",
        configureServer(server: any) {
          const initialLiveDom = readJsonSafe(LIVE_DOM_FILE, {
            updatedAt: null,
            entries: {},
            componentNames: [],
          });
          const initialDiagnostics = readJsonSafe(DIAGNOSTICS_FILE, {
            updatedAt: null,
            totalActive: 0,
            totalDismissed: 0,
            dismissedIds: [],
            diagnostics: [],
            activeDiagnostics: [],
          });

          const liveDomEntries: Record<string, any> =
            initialLiveDom && typeof initialLiveDom.entries === "object"
              ? { ...initialLiveDom.entries }
              : {};
          const dismissedIds = new Set<string>(
            Array.isArray(initialDiagnostics?.dismissedIds) ? initialDiagnostics.dismissedIds : []
          );
          if (pruneUnregisteredLiveDomEntries(liveDomEntries)) {
            rebuildAndPersistTelemetry(liveDomEntries, dismissedIds);
          }
          const initialRuntimeErrors = readJsonSafe(RUNTIME_ERRORS_FILE, {
            updatedAt: null,
            totalCount: 0,
            errors: [],
          });
          let runtimeErrors: any[] = Array.isArray(initialRuntimeErrors?.errors)
            ? [...initialRuntimeErrors.errors].slice(0, MAX_RUNTIME_ERRORS)
            : [];

          server.ws.on("ecmd:snap", (data: any) => {
            try {
              fs.writeFileSync(
                "src/telemetryData.ts",
                "export const LIVE_SNAP: any = " + JSON.stringify(data, null, 2) + ";\n"
              );
            } catch {}
          });

          server.middlewares.use("/__ecmd_dom_snap", (req: any, res: any) => {
            let b = "";
            req.on("data", (c: any) => {
              b += c;
            });
            req.on("end", () => {
              try {
                fs.writeFileSync(
                  "src/telemetryData.ts",
                  "export const LIVE_SNAP: any = " + JSON.stringify(JSON.parse(b), null, 2) + ";\n"
                );
              } catch {}
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end("ok");
            });
          });

          server.middlewares.use("/__ecmd-live-dom/dismiss", async (req: any, res: any) => {
            setCorsHeaders(res);
            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }
            res.setHeader("Content-Type", "application/json");
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
              return;
            }
            try {
              const raw = await readRequestBody(req);
              const body = JSON.parse(raw || "{}");

              if (body.id && typeof body.id === "string") {
                dismissedIds.add(body.id);
              }

              if (body.clearAll) {
                for (const entry of Object.values(liveDomEntries)) {
                  const list = Array.isArray((entry as any)?.diagnostics)
                    ? (entry as any).diagnostics
                    : [];
                  for (const d of list) {
                    if (d?.id) dismissedIds.add(d.id);
                  }
                }
              }

              if (body.clearResolved) {
                pruneUnregisteredLiveDomEntries(liveDomEntries);
                const currentIds = new Set<string>();
                for (const entry of Object.values(liveDomEntries)) {
                  const list = Array.isArray((entry as any)?.diagnostics)
                    ? (entry as any).diagnostics
                    : [];
                  for (const d of list) {
                    if (d?.id) currentIds.add(d.id);
                  }
                }
                for (const existingId of Array.from(dismissedIds)) {
                  if (!currentIds.has(existingId)) {
                    dismissedIds.delete(existingId);
                  }
                }
              }

              if (body.restoreAll) {
                dismissedIds.clear();
              }

              const { diagnosticsPayload } = rebuildAndPersistTelemetry(
                liveDomEntries,
                dismissedIds
              );
              res.end(JSON.stringify({ ok: true, diagnostics: diagnosticsPayload }));
            } catch (e: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: e?.message || String(e) }));
            }
          });

          server.middlewares.use("/__ecmd-live-dom", async (req: any, res: any) => {
            setCorsHeaders(res);
            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }
            res.setHeader("Content-Type", "application/json");

            if (req.method === "GET") {
              const { liveDomPayload, diagnosticsPayload } = rebuildAndPersistTelemetry(
                liveDomEntries,
                dismissedIds
              );
              res.end(
                JSON.stringify({
                  ok: true,
                  liveDom: liveDomPayload,
                  diagnostics: diagnosticsPayload,
                })
              );
              return;
            }

            if (req.method === "POST") {
              try {
                const raw = await readRequestBody(req);
                const payload = JSON.parse(raw || "{}");
                const componentName = String(payload?.componentName || "").trim();
                const artboardTag = String(payload?.artboardTag || "desktop-1440").trim();
                if (!componentName) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ ok: false, error: "componentName is required" }));
                  return;
                }
                const key = `${componentName}::${artboardTag}`;
                const freshDiagnostics = Array.isArray(payload.diagnostics) ? payload.diagnostics : [];

                // Replace diagnostics for exact componentName + artboardTag cleanly and auto-prune resolved dismissed IDs
                const entryDiagPrefix = `${componentName}::${artboardTag}::`
                  .toLowerCase()
                  .replace(/[^a-z0-9:_-]+/g, "-");
                const freshDiagIds = new Set<string>(
                  freshDiagnostics.map((d: any) => String(d?.id || "")).filter(Boolean)
                );
                for (const existingDismissedId of Array.from(dismissedIds)) {
                  if (
                    existingDismissedId.startsWith(entryDiagPrefix) &&
                    !freshDiagIds.has(existingDismissedId)
                  ) {
                    dismissedIds.delete(existingDismissedId);
                  }
                }

                liveDomEntries[key] = {
                  ...payload,
                  key,
                  componentName,
                  artboardTag,
                  diagnostics: freshDiagnostics,
                  updatedAt: payload.updatedAt || new Date().toISOString(),
                };
                const { diagnosticsPayload } = rebuildAndPersistTelemetry(
                  liveDomEntries,
                  dismissedIds
                );
                res.end(
                  JSON.stringify({
                    ok: true,
                    key,
                    totalActive: diagnosticsPayload.totalActive,
                  })
                );
              } catch (e: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ ok: false, error: e?.message || String(e) }));
              }
              return;
            }

            res.statusCode = 405;
            res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
          });

          server.middlewares.use("/__ecmd-runtime-error/clear", async (req: any, res: any) => {
            setCorsHeaders(res);
            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }
            res.setHeader("Content-Type", "application/json");
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
              return;
            }
            runtimeErrors = [];
            const payload = persistRuntimeErrors(runtimeErrors);
            res.end(JSON.stringify({ ok: true, runtimeErrors: payload }));
          });

          server.middlewares.use("/__ecmd-runtime-error", async (req: any, res: any) => {
            setCorsHeaders(res);
            if (req.method === "OPTIONS") {
              res.statusCode = 204;
              res.end();
              return;
            }
            res.setHeader("Content-Type", "application/json");

            if (req.method === "GET") {
              const payload = {
                updatedAt: runtimeErrors[0]?.timestamp || null,
                totalCount: runtimeErrors.length,
                errors: runtimeErrors,
              };
              res.end(JSON.stringify({ ok: true, runtimeErrors: payload }));
              return;
            }

            if (req.method === "POST") {
              try {
                const raw = await readRequestBody(req);
                const incoming = JSON.parse(raw || "{}");
                const message = String(incoming?.message || "").trim().slice(0, 400);
                if (!message) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ ok: false, error: "message is required" }));
                  return;
                }
                const source = String(incoming?.source || "unknown").trim().slice(0, 260);
                const dedupKey = `${message.toLowerCase()}::${source.toLowerCase()}`;
                const now = incoming?.timestamp || new Date().toISOString();

                const existingIdx = runtimeErrors.findIndex(
                  (e) =>
                    `${String(e?.message || "").toLowerCase()}::${String(e?.source || "").toLowerCase()}` ===
                    dedupKey
                );

                let savedEntry: any;
                if (existingIdx >= 0) {
                  const prev = runtimeErrors[existingIdx];
                  savedEntry = {
                    ...prev,
                    ...incoming,
                    message,
                    source,
                    timestamp: now,
                    count: (Number(prev?.count) || 1) + 1,
                  };
                  runtimeErrors.splice(existingIdx, 1);
                  runtimeErrors.unshift(savedEntry);
                } else {
                  savedEntry = {
                    id: String(incoming?.id || `rt::${Date.now()}`),
                    kind: incoming?.kind === "unhandledrejection" ? "unhandledrejection" : "error",
                    message,
                    source,
                    line: typeof incoming?.line === "number" ? incoming.line : null,
                    column: typeof incoming?.column === "number" ? incoming.column : null,
                    stackPreview: String(incoming?.stackPreview || "").slice(0, 700),
                    url: String(incoming?.url || ""),
                    artboardTag: String(incoming?.artboardTag || "desktop-1440"),
                    viewportMode:
                      incoming?.viewportMode === "mobile" || incoming?.viewportMode === "tablet"
                        ? incoming.viewportMode
                        : "desktop",
                    timestamp: now,
                    count: 1,
                  };
                  runtimeErrors.unshift(savedEntry);
                }

                runtimeErrors = runtimeErrors.slice(0, MAX_RUNTIME_ERRORS);
                const persisted = persistRuntimeErrors(runtimeErrors);
                res.end(
                  JSON.stringify({
                    ok: true,
                    totalCount: persisted.totalCount,
                    entry: savedEntry,
                  })
                );
              } catch (e: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ ok: false, error: e?.message || String(e) }));
              }
              return;
            }

            res.statusCode = 405;
            res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
          });

          server.middlewares.use("/__ecmd_local_cli", (req: any, res: any) => {
            const rem = req.socket?.remoteAddress || "";
            if (rem !== "127.0.0.1" && rem !== "::1" && rem !== "::ffff:127.0.0.1") {
              res.statusCode = 403;
              res.end(JSON.stringify({ ok: false, error: "Loopback 127.0.0.1 Lock Active" }));
              return;
            }
            let body = "";
            req.on("data", (c: any) => {
              body += c;
            });
            req.on("end", () => {
              res.setHeader("Content-Type", "application/json");
              try {
                const p = JSON.parse(body || "{}");
                if (p.key !== "[REDACTED_SECRET]" || p.mtok !== M_TOK) {
                  res.statusCode = 403;
                  res.end(JSON.stringify({ ok: false, error: "Invalid Machine Token" }));
                  return;
                }
                const out = execSync(p.cmd, {
                  cwd: "C:\\ECMD",
                  encoding: "utf8",
                  shell: "powershell.exe",
                  timeout: 25000,
                });
                res.end(JSON.stringify({ ok: true, mode: "local_vite_direct_locked", output: out }));
              } catch (e: any) {
                res.end(
                  JSON.stringify({
                    ok: false,
                    error: e?.message || String(e),
                    stdout: e?.stdout,
                    stderr: e?.stderr,
                  })
                );
              }
            });
          });
        },
      },
    ],
  },
});
