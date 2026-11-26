# ECMD CARBON 4 — MASTER OS (`agy` & PEN v4.2)

Lead engineer for **Emerald Coast Mobile Detailing (ECMD)** (`C:\ECMD\emerald-coast-detailing-hub`).

## 1. DUAL-AI BOUNDARY & CUSTOMER API KEY
- **ADMIN/DEV (`agy` v1.5.15):** Personal `@gmail.com` OAuth (`$0.00/turn`, Gemini 4) for local owner/admin code, Plasmic, SQL, & ops via `epen`. **NEVER wire `agy`/OAuth to public visitors.**
- **CUSTOMER AI (`GEMINI_API_KEY`):** Public AI runs in Supabase Edge Functions (`ecmd-carbon-bridge`/`geminiAssistant`), isolated from `agy`.

## 2. PEN v4.2 (`-p` LAST-FLAG), AI MIRROR, LEAN ROUTES, SHELL GUARD & BOOT-SYNC
1. **PLAN FIRST, WAIT FOR "YES"** (`#ECMD_AI!` via `epen` is pre-confirmed).
2. **PEN v4.2:** `epen` -> `Start-EcmdPen.ps1` -> `run-pen-task.mjs` (`--dangerously-skip-permissions --output-format stream-json --add-dir C:\ECMD -p "..."`; `-p` last w/ stdin). SHA-1 diffing logs `filesChanged` (`ecmd_pen_turns`, `ai-telemetry.json`); auto-runs `sync-ai-mirror.mjs --push`.
3. **SHELL GUARD:** NEVER run `Invoke-WebRequest`/`iwr` without `-UseBasicParsing` (use Node `fetch()` w/ `AbortSignal.timeout(8000)` or `curl.exe -s`).
4. **AI MIRROR (`mlhammes2/ecmd-ai-mirror`) & 26-CSV IMPORTER:** Ground via `https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/SITE_MANIFEST.md` (`.json`: `hub/`, `runner/`, `supabase-mirror/`; 14 public Wix tables mirrored, 12 RLS-private excluded, zero `.env*`). Re-import CSVs via `node C:\ECMD\scripts\import-wix-csvs.mjs`.
5. **LEAN ROUTES & 0ms `/errors`:** `AppHeader` ONLY on `/workflow` & `/errors` (+ `Live Site (/) ↗`). Customer Plasmic routes have ZERO dev header; `/plasmic-host` renders ONLY `<PlasmicCanvasHost />`. `/errors` (`#ecmd-unified-errors-json`) aggregates TSC, Plasmic 3-tier tabs, & DEV Runtime JS (`/runtime-errors.json`). `__root.tsx` injects DEV `<head>` bridge + `ecmdRuntimeBoot.ts`; `POST /__ecmd-live-dom` auto-prunes resolved issues.
6. **BOOT-SYNC & VERIFY:** Sync PowerShell/`C:\ECMD\scripts\*` changes in-turn to `ecmdBootPrompt.ts`, `AGENTS.md`, `GEMINI.md` (< 6 KB), & `ecmd_external_ai_cms`. Run `npx tsc --noEmit` & `npx vitest run` until 0 errors.

## 3. SUPABASE (`lvynkeuceiqxafgpgdvs`)
- SQL via `node scripts/ecmd-sql.mjs "<SQL>"`. Tables: `ecmd_service_packages` (36 Wix rows, anon `SELECT`), `ecmd_whats_included` (30 rows, anon `SELECT`), 24 `ecmd_wix_*` tables (14 public + 12 owner-RLS private), `ecmd_packages`, `ecmd_pen_turns`, `ecmd_external_ai_cms`, `ecmd_wix_legacy_vault`, `ecmd_site_menu_buttons`, `ecmd_plasmic_hydration`.

## 4. BREAKPOINTS, `registerEcmdComponent`, ZERO-INLINE-WIDTH & LOCKED COMPONENTS
- **`registerEcmdComponent` & Zero-Inline-Width:** All `src/plasmic-init.ts` components use `registerEcmdComponent` (ZERO bare `registerComponent(`; 0 KB prod). `DevTelemetryObserver` forwards `className`/`style` via hidden sibling marker. NEVER hardcode `style={{ width: "100%" }}`; use `:where(...)` CSS (`ecmdRootSizing.ts` + `styles.css`) + `defaultStyles`.
- **3-Tier Breakpoints:** `useEcmdBreakpoint(768, 1024)` resolves `desktop`/`tablet`/`mobile`, stamps `data-ecmd-viewport`, & routes `data-ecmd-action-*`.
- **Locked Components:**
  - `EcmdAuthModalController`: `#ecmd-auth-trigger-btn`, `#ecmd-auth-email-input`, `#ecmd-auth-password-input`, Remember Me, Show Password, Forgot Password, Login/Sign Up.
  - `EcmdThemeGroupController` ("Site Themes"): `#ecmd-theme-trigger-btn` & `#ecmd-theme-dropdown-card` (isolated, 150ms dedup), `openAttributeProfilesModal`. **Glossary (3 icon-free tabs: Search + Auto A–Z + Pin + Collapse All):** **Theme Groups Inspector** (*"groups console"*) = `Groups` (`Copy Attributes From`+`Undo`, 6-State + **Live Canvas State Preview** `#ecmd-theme-live-state-preview`, Border `None (0px)`/`Width`/`Style`/Reset, Gradient `Solid/Linear/Radial/Conic` w/ rounded `padding-box`/`::before`, Outer/Inner/Text Shadow, `@media`, Fluid `clamp()`); **Image Groups Inspector** = `Images` (`Copy Attributes From`+`Undo`, `ecmd-theme-assets`); **Design Tokens** = `Tokens` (`boxShadow`/`textShadow`/`paint`/`border`/`radius`, `tokenRefs`, `--ecmd-tok-*`, `themeOverrides`, Edit Everywhere, Detach, safe delete).
  - `EcmdVehicleSelector`: 4-slot (`slot1`..`slot4` in `<DataProvider name="ecmdVehicle">`, `ecmd-vehicle-change`, `lockedSubCategory`/`lockedVehicleKey`, `ecmd-vehicle-lock`/`unlock` -> `ecmd-vehicle-locked-attempt`) + Tablet/Mobile overrides.
  - `EcmdSavedVehicleDropdown`: Wix `packagesEngine.js` parity (`#vehicleSelectDropButton`/`#vehicleSelectBox`/`#vehicleSelectRep`/`#vehicleTypeError`, `ecmd_selected_summary_vehicle_id`, `ecmd-vehicle-lock`/`unlock`, `ecmd-open-add-vehicle-modal`, `3200ms` error+pulse, `prefers-reduced-motion` safe).
  - `EcmdPackagesRepeater`: `itemTemplate` (`ecmd_service_packages` matrix via `ecmdPackageMatcher.ts`, `levelOrder`, `<DataProvider name="ecmdPkg">`, live DOM painting + glow sync, auto-heals scope/CTA w/ CTA guard, `data-ecmd-slot-wrapper="transparent"`) + 3-tier overrides + SVG fallback.
  - `EcmdBrushedSteelButton` (V7): `container-type: size`, `--button-radius`, `160px` grain, `cqh`/`cqw`, `-4px`/`+3px`, `#54e9ea` glow, `buttonRole`, `selected`/`label`/`fontSize`/`width`/`height`/`onClick`.
- **SSR Hydration (`mobile-413`):** `src/client.tsx` mounts `/plasmic-host` CSR-only (`createRoot` -> `#ecmd-plasmic-host-root`); `ssr: false`, `suppressHydrationWarning`, no module-level `document.head` writes, `readyState === "complete"` guard, SSR-deterministic state.

## 5. PLASMIC CSS WHITELIST, `registerToken` & `/plasmic-host`
- Stack: Vite + React + TS + Plasmic (`mrkoQykvpZZfVbEc1yjabw`, `localhost:8080`) + Supabase (`lvynkeuceiqxafgpgdvs`).
- `src/plasmic-init.ts`: ONLY `ALLOWED_PLASMIC_STYLE_KEYS` (atomic spacing; no `border*`/`background`/`cursor`/`flexGrow`/`display`/`fontFamily`/`textDecoration`/`whiteSpace`/`flexWrap`/`objectFit` or shorthand `padding`/`margin`).
- **NEVER pass `type: "string"` to `PLASMIC.registerToken`** (ONLY `color|spacing|opacity|line-height|font-size|font-family`) & NEVER call `registerDataToken`; expose `ecmdImgClass_*` via `DataProvider` & `[Copy Class]`. `PlasmicHost.tsx` renders ONLY `<PlasmicCanvasHost />` (`ssr: false` + DEV `<head>` bridge). Enforced by `plasmic-init-styles.test.ts` & `plasmic-host-boot.test.tsx`.
