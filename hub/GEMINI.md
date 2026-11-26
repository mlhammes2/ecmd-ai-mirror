# ECMD CARBON 4 — MASTER OS (`agy` & PEN v4.2)
Lead engineer for **ECMD** (`C:\ECMD\emerald-coast-detailing-hub`).

## 1. DUAL-AI BOUNDARY & CUSTOMER API KEY
- **ADMIN/DEV (`agy` v1.5.15):** Personal `@gmail.com` OAuth (`$0.00/turn`, Gemini 4) for local code/Plasmic/SQL/ops via `epen`. **NEVER wire to public visitors.**
- **CUSTOMER AI (`GEMINI_API_KEY`):** Supabase Edge Functions (`ecmd-carbon-bridge`/`geminiAssistant`), isolated from `agy`.

## 2. PEN v4.2, ARCHITECT-HERE WORKFLOW, AI MIRROR & BOOT-SYNC
1. **PLAN FIRST, WAIT FOR "YES"** (`#ECMD_AI!` via `epen` is pre-confirmed).
2. **ARCHITECT-HERE / FAST-INSERT-IN-`agy` & CLI NOTES:** Design exact schemas, data rows, & targeted code edits upfront in Chrome sidebar, then let `agy` (`epen`) apply edits/inserts, run `node scripts/ecmd-sql.mjs`, & verify (`npx tsc --noEmit` & `npx vitest run`)—keeping turns tightly scoped to conserve `agy` quota (`--effort medium` / `gemini-3.8-flash`). Check models via `agy models`, set `--effort` (`low|medium|high|xhigh|max`), or use `/usage` & `/logout` for CLI auth/session state.
3. **PEN v4.2 (`-p` LAST-FLAG):** `epen`->`Start-EcmdPen.ps1`->`run-pen-task.mjs` (`--dangerously-skip-permissions --output-format stream-json --add-dir C:\ECMD -p "..."`; `-p` last w/ stdin). SHA-1 diffing logs `filesChanged` (`ecmd_pen_turns`, `ai-telemetry.json`); auto-runs `sync-ai-mirror.mjs --push`.
4. **SHELL GUARD:** NEVER run `Invoke-WebRequest`/`iwr` without `-UseBasicParsing` (use Node `fetch()` w/ `AbortSignal.timeout(8000)` or `curl.exe -s`).
5. **AI MIRROR (`mlhammes2/ecmd-ai-mirror`) & 26-CSV:** Ground via `https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/SITE_MANIFEST.md` (`hub/`, `runner/`, `supabase-mirror/`; 14 public Wix tables, 12 RLS-private excluded, 0 `.env*`). CSVs: `node C:\ECMD\scripts\import-wix-csvs.mjs`.
6. **LEAN ROUTES & `/errors`:** `AppHeader` ONLY on `/workflow` & `/errors` (+ `Live Site (/) ↗`). Customer routes have 0 dev header; `/plasmic-host` renders ONLY `<PlasmicCanvasHost />`. `/errors` (`#ecmd-unified-errors-json`) aggregates TSC, 3-tier Plasmic tabs, & Runtime JS (`/runtime-errors.json`); `POST /__ecmd-live-dom` auto-prunes.
7. **BOOT-SYNC & VERIFY:** Sync PowerShell/`C:\ECMD\scripts\*` in-turn to `ecmdBootPrompt.ts`, `AGENTS.md`, `GEMINI.md` (< 6 KB), & `ecmd_external_ai_cms`. Run `npx tsc --noEmit` & `npx vitest run` until 0 errors.

## 3. SUPABASE (`lvynkeuceiqxafgpgdvs`)
- SQL: `node scripts/ecmd-sql.mjs "<SQL>"`. Tables: `ecmd_service_packages` (36), `ecmd_whats_included` (30), 24 `ecmd_wix_*` (14 public anon `SELECT` + 12 owner-RLS), `ecmd_packages`, `ecmd_pen_turns`, `ecmd_external_ai_cms`, `ecmd_wix_legacy_vault`, `ecmd_site_menu_buttons`, `ecmd_plasmic_hydration`.

## 4. BREAKPOINTS, `registerEcmdComponent`, ZERO-INLINE-WIDTH & LOCKED COMPONENTS
- **Wrapper & Root:** All `plasmic-init.ts` components use `registerEcmdComponent` (0 bare `registerComponent(`; 0 KB prod). `DevTelemetryObserver` forwards `className`/`style` via hidden marker. NEVER hardcode `style={{ width: "100%" }}`; use `:where(...)` CSS (`ecmdRootSizing.ts`+`styles.css`) + `defaultStyles`.
- **Breakpoints:** `useEcmdBreakpoint(768, 1024)` resolves `desktop`/`tablet`/`mobile`, stamps `data-ecmd-viewport`, & routes `data-ecmd-action-*`.
- **Locked Components:**
  - `EcmdAuthModalController`: `#ecmd-auth-trigger-btn`, `#ecmd-auth-email-input`/`password-input`, Remember/Show/Forgot/Sign Up.
  - `EcmdThemeGroupController` ("Site Themes"): `#ecmd-theme-trigger-btn`/`dropdown-card` (isolated, 150ms dedup), `openAttributeProfilesModal`. **3 tabs (Search+A–Z+Pin+Collapse):** **Groups Inspector** (*"groups console"*) = `Groups` (`Copy Attributes From`+`Undo`, 6-State+`#ecmd-theme-live-state-preview`, Border `0px`/Width/Style/Reset, Gradients `padding-box`/`::before`, Outer/Inner/Text Shadow, `@media`, `clamp()`); **Image Groups** = `Images` (`Copy Attributes From`+`Undo`, `ecmd-theme-assets`); **Design Tokens** = `Tokens` (`boxShadow`/`textShadow`/`paint`/`border`/`radius`, `tokenRefs`, `--ecmd-tok-*`, `themeOverrides`, Edit/Detach/Delete).
  - `EcmdVehicleSelector`: 4-slot (`ecmdVehicle`, `ecmd-vehicle-change`, lock/unlock->`ecmd-vehicle-locked-attempt`) + Tablet/Mobile.
  - `EcmdSavedVehicleDropdown`: Wix `packagesEngine.js` (`#vehicleSelectDropButton`/`Box`/`Rep`/`#vehicleTypeError`, `ecmd_selected_summary_vehicle_id`, lock/unlock, `ecmd-open-add-vehicle-modal`, `3200ms` error+pulse).
  - `EcmdPackagesRepeater`: `itemTemplate` (`ecmd_service_packages`, `levelOrder`, `ecmdPkg`, `ecmd-addons-change`, `ecmd-open-whats-included`, DOM paint+glow, auto-heal, transparent slot) + 3-tier + SVG fallback.
  - `EcmdWhatsIncludedModal`: Wix `fileWhatsIncluded.js` (`ecmd_whats_included`, `ecmdWhatsIncluded`, `ecmd-open-whats-included`, `level-btn`, `interior-list`/`exterior-list`+`notice`, `20/15/10%` subs, `tab-interior`/`exterior`+`addon-item`->`ecmd_addOnMemory`, `inspect-item`->`ecmd-open-whats-included-item`, `#whatsIncludedTotalPrice`, `#whatsIncludedAddCart`->`ecmd-add-to-cart`).
  - `EcmdWhatsIncludedItemPopup` (Piece 4): Wix `fileWhatsIncludedG.js` (`ecmd-open-whats-included-item`, `data-ecmd-wi-item="popup|title|media|steps|prev|next|toggle-addon|close"`, `ecmd_addOnMemory`->`ecmd-addons-change`, `Escape`/backdrop close).
  - `EcmdBrushedSteelButton` (V7): `container-type: size`, `--button-radius`, `160px` grain, `cqh`/`cqw`, `-4px`/`+3px`, `#54e9ea` glow, `buttonRole`.
- **SSR Hydration (`mobile-413`):** `src/client.tsx` CSR `createRoot` on `/plasmic-host`; `ssr: false`, `suppressHydrationWarning`, 0 module-level `document.head` writes, `readyState === "complete"`.

## 5. PLASMIC CSS WHITELIST, `registerToken` & `/plasmic-host`
- Stack: Vite+React+TS+Plasmic (`mrkoQykvpZZfVbEc1yjabw`, `:8080`)+Supabase (`lvynkeuceiqxafgpgdvs`).
- `plasmic-init.ts`: ONLY `ALLOWED_PLASMIC_STYLE_KEYS` (no `border*`/`background`/`cursor`/`flexGrow`/`display`/`fontFamily`/`textDecoration`/`whiteSpace`/`flexWrap`/`objectFit`/shorthand `padding`/`margin`).
- **NEVER pass `type: "string"` to `PLASMIC.registerToken`** (ONLY `color|spacing|opacity|line-height|font-size|font-family`) or call `registerDataToken`; expose `ecmdImgClass_*` via `DataProvider` & `[Copy Class]`. `PlasmicHost.tsx` renders ONLY `<PlasmicCanvasHost />` (`ssr: false`+DEV `<head>` bridge). Tests: `plasmic-init-styles.test.ts`, `plasmic-host-boot.test.tsx`.
