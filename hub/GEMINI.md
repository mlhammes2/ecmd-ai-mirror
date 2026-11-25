# ECMD CARBON 4 — MASTER OS (`agy` & PEN v4.2)

Lead engineer for **Emerald Coast Mobile Detailing (ECMD)** in `C:\ECMD\emerald-coast-detailing-hub`.

## 1. DUAL-AI BOUNDARY & CUSTOMER API KEY
- **ADMIN/DEV (`agy` v1.5.15):** Personal `@gmail.com` OAuth (`$0.00/turn`, Gemini 4) for local owner/admin code, Plasmic, SQL, & ops via `epen`. **NEVER wire `agy`/OAuth to public visitors.**
- **CUSTOMER AI (`GEMINI_API_KEY` — Owned):** Public AI runs in Supabase Edge Functions (`ecmd-carbon-bridge`/`geminiAssistant`), isolated from `agy`.

## 2. PEN v4.2 (`-p` LAST-FLAG), AI MIRROR, LEAN ROUTES, SHELL GUARD & BOOT-SYNC
1. **PLAN FIRST, WAIT FOR "YES"** (`#ECMD_AI!` via `epen` is pre-confirmed).
2. **PEN v4.2:** `epen` -> `Start-EcmdPen.ps1` -> `run-pen-task.mjs` (`--dangerously-skip-permissions --output-format stream-json --add-dir C:\ECMD -p "..."`). `-p` MUST stay last w/ stdin. SHA-1 diffing tracks changed files (`ecmd_pen_turns`, `ai-telemetry.json`); auto-runs `sync-ai-mirror.mjs --push`.
3. **SHELL GUARD:** NEVER run PowerShell `Invoke-WebRequest`/`iwr` without `-UseBasicParsing` (prefer Node `fetch()` w/ `AbortSignal.timeout(8000)` or `curl.exe -s`).
4. **AI MIRROR (`mlhammes2/ecmd-ai-mirror`) & 26-CSV WIX IMPORTER:** Ground via `https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/SITE_MANIFEST.md` (& `.json`: `hub/`, `runner/` excl. `wix-cms-exports/`, `supabase-mirror/`; 14 safe public Wix tables mirrored, 12 RLS-private/PII tables excluded, zero `.env*`). Re-import `C:\ECMD\wix-cms-exports` via `node C:\ECMD\scripts\import-wix-csvs.mjs`.
5. **LEAN ROUTES & 0ms `/errors`:** `AppHeader` ONLY on `/workflow` & `/errors` (+ `Live Site (/) ↗`). Customer Plasmic routes have ZERO dev header; `/plasmic-host` renders ONLY `<PlasmicCanvasHost />`. `/errors` (`#ecmd-unified-errors-json`) aggregates TSC, Plasmic 3-tier tabs (`Desktop`/`Tablet`/`Mobile`/`Critical`), & DEV Runtime JS (`/runtime-errors.json`). `__root.tsx` injects DEV `<head>` bridge + `ecmdRuntimeBoot.ts`; `POST /__ecmd-live-dom` auto-prunes resolved issues.
6. **BOOT-SYNC & VERIFY:** Sync PowerShell/`C:\ECMD\scripts\*` changes in-turn to `ecmdBootPrompt.ts`, `AGENTS.md`, `GEMINI.md` (< 6 KB), & `ecmd_external_ai_cms`. Run `npx tsc --noEmit` & `npx vitest run` (never watch) until 0 errors.

## 3. SUPABASE (`lvynkeuceiqxafgpgdvs`)
- SQL via `node scripts/ecmd-sql.mjs "<SQL>"`. Tables: `ecmd_service_packages` (36 Wix rows, anon `SELECT`), `ecmd_whats_included` (30 Wix rows, anon `SELECT`), 24 `ecmd_wix_*` CSV tables (14 public mirrored + 12 owner-RLS private), `ecmd_packages`, `ecmd_pen_turns`, `ecmd_external_ai_cms`, `ecmd_wix_legacy_vault`, `ecmd_site_menu_buttons`, `ecmd_plasmic_hydration`.

## 4. BREAKPOINTS, `registerEcmdComponent`, ZERO-INLINE-WIDTH & LOCKED COMPONENTS
- **`registerEcmdComponent` & Zero-Inline-Width:** All `src/plasmic-init.ts` components use `registerEcmdComponent(Component, meta)` (ZERO bare `registerComponent(`; 0 KB prod). `DevTelemetryObserver` forwards `className`/`style` via hidden sibling marker. NEVER hardcode `style={{ width: "100%" }}` on roots; use `:where(...)` CSS (`ecmdRootSizing.ts` + `styles.css`) + `defaultStyles`.
- **3-Tier Breakpoints (`useEcmdBreakpoint.ts`):** `useEcmdBreakpoint(768, 1024)` resolves `desktop`/`tablet`/`mobile`, stamps `data-ecmd-viewport`, & routes `data-ecmd-action-*`.
- **Locked Components:**
  - `EcmdAuthModalController`: `#ecmd-auth-trigger-btn`, `#ecmd-auth-email-input`, `#ecmd-auth-password-input`, Remember Me, Show Password, Forgot Password, Login/Sign Up.
  - `EcmdThemeGroupController` ("Site Themes"): `#ecmd-theme-trigger-btn` & `#ecmd-theme-dropdown-card` (isolated, 150ms dedup), `openAttributeProfilesModal`. **Glossary (3 icon-free tabs: Search + Auto A–Z + Pin + Collapse All):** **Theme Groups Inspector** (*"groups console"*) = `Groups` (`Copy Attributes From` + `Undo`, 6-State + **Live Canvas State Preview** `#ecmd-theme-live-state-preview`, Border `None (0px)`/`Width`/`Style`/Reset, Gradient `Solid/Linear/Radial/Conic` w/ rounded `padding-box`/`::before`, Outer/Inner/Text Shadow, `@media`, Fluid `clamp()`); **Image Groups Inspector** = `Images` (`Copy Attributes From` + `Undo`, `ecmd-theme-assets` `<img>`/`<svg>` swap); **Design Tokens** = `Tokens` (`boxShadow`/`textShadow`/`paint`/`border`/`radius`, `tokenRefs`, `--ecmd-tok-*`, `themeOverrides`, Edit Everywhere, Detach, safe delete).
  - `EcmdVehicleSelector`: 4-slot (`slot1`..`slot4`, `ecmd-vehicle-change`) + Tablet/Mobile overrides.
  - `EcmdPackagesRepeater`: `itemTemplate` (`ecmd_service_packages` 36-row matrix via `ecmdPackageMatcher.ts` + `ecmd_packages` fallback, `levelOrder`, `<DataProvider name="ecmdPkg">`, live DOM painting + steel glow sync, auto-heals scope/CTA buttons w/ CTA guard, `data-ecmd-slot-wrapper="transparent"`) + 3-tier overrides + SVG fallback.
  - `EcmdBrushedSteelButton` (`BrushedSteelButton` V7): `container-type: size`, `--button-radius`, fixed `160px` grain, `cqh`/`cqw` `.button-label`, `-4px`/`+3px` physics, `#54e9ea` glow, `buttonRole` (`auto|scope-*|whats-included|add-to-cart`), `selected`/`label`/`fontSize`/`width`/`height`/`onClick`.
- **SSR Hydration (`mobile-413`):** `src/client.tsx` mounts `/plasmic-host` CSR-only (`createRoot` -> `#ecmd-plasmic-host-root`); `ssr: false`, `suppressHydrationWarning`, zero module-level `document.head` mutations, `readyState === "complete"` guard, SSR-deterministic state.

## 5. PLASMIC CSS WHITELIST, `registerToken` & `/plasmic-host`
- Stack: Vite + React + TS + Plasmic (`mrkoQykvpZZfVbEc1yjabw`, `localhost:8080`) + Supabase (`lvynkeuceiqxafgpgdvs`).
- `src/plasmic-init.ts`: ONLY `ALLOWED_PLASMIC_STYLE_KEYS` (atomic spacing; no `border*`/`background`/`cursor`/`flexGrow`/`display`/`fontFamily`/`textDecoration`/`whiteSpace`/`flexWrap`/`objectFit` or shorthand `padding`/`margin`).
- **NEVER pass `type: "string"` to `PLASMIC.registerToken`** (ONLY `color|spacing|opacity|line-height|font-size|font-family`) & NEVER call `registerDataToken`; expose `ecmdImgClass_*` via `DataProvider` & `[Copy Class]`. `PlasmicHost.tsx` renders ONLY `<PlasmicCanvasHost />` (`ssr: false` + DEV `<head>` bridge). Enforced by `plasmic-init-styles.test.ts` & `plasmic-host-boot.test.tsx`.
