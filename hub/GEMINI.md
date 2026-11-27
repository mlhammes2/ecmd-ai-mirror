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
  - `EcmdThemeGroupController` ("Site Themes"): `#ecmd-theme-trigger-btn`/`dropdown-card` (isolated, 150ms dedup), `openAttributeProfilesModal`. **3 tabs (Search+A–Z+Pin+Collapse):** **Groups** (*"groups console"*: `Copy Attributes From`+`Undo`, 6-State+`#ecmd-theme-live-state-preview`, Border `0px`/Width/Style/Reset, Gradients `padding-box`/`::before`, Outer/Inner/Text Shadow, `@media`, `clamp()`); **Images** (`Copy Attributes From`+`Undo`, `ecmd-theme-assets`); **Tokens** (`boxShadow`/`textShadow`/`paint`/`border`/`radius`, `tokenRefs`, `--ecmd-tok-*`, `themeOverrides`, Edit/Detach/Delete).
  - `EcmdVehicleSelector`: 4-slot (`ecmdVehicle`, `ecmd-vehicle-change`, lock/unlock->`ecmd-vehicle-locked-attempt`) + Tablet/Mobile.
  - `EcmdSavedVehicleDropdown`: Wix `packagesEngine.js` (`#vehicleSelectDropButton`/`Box`/`Rep`/`#vehicleTypeError`, `ecmd_selected_summary_vehicle_id`, lock/unlock, `ecmd-open-add-vehicle-modal`, `3200ms` error+pulse).
  - `EcmdPackagesRepeater`: `itemTemplate` (`ecmd_service_packages`, `levelOrder`, `ecmdPkg`, `ecmd-addons-change`, `ecmd-open-whats-included`, auto-heal, transparent slot) + 3-tier + SVG fallback.
  - `EcmdWhatsIncludedModal`: Wix `fileWhatsIncluded.js` (`ecmd_whats_included`, `ecmdWhatsIncluded`, `ecmd-open-whats-included`, `level-btn`, `interior-list`/`exterior-list`+`notice`, `20/15/10%` subs, `tab-interior`/`exterior`+`addon-item`->`ecmd_addOnMemory`, `inspect-item`->`ecmd-open-whats-included-item`, `#whatsIncludedTotalPrice`, `#whatsIncludedAddCart`).
  - `EcmdWhatsIncludedItemPopup` (Piece 4): Wix `fileWhatsIncludedG.js` (`ecmd-open-whats-included-item`, `data-ecmd-wi-item="popup|title|badge|media|steps|prev|next|toggle-addon|close"`, `ecmd_addOnMemory`->`ecmd-addons-change`, `Escape`/backdrop).
  - `EcmdBrushedSteelButton` (V7): `container-type: size`, `160px` grain, `cqh`/`cqw`, `#54e9ea` glow, `buttonRole`.
- **SSR Hydration (`mobile-413`):** `src/client.tsx` CSR `createRoot` on `/plasmic-host`; `ssr: false`, `suppressHydrationWarning`, 0 module-level `document.head` writes, `readyState === "complete"`.

## 5. PLASMIC CSS WHITELIST, `registerToken` & `/plasmic-host`
- Stack: Vite+React+TS+Plasmic (`mrkoQykvpZZfVbEc1yjabw`, `:8080`)+Supabase (`lvynkeuceiqxafgpgdvs`).
- `plasmic-init.ts`: ONLY `ALLOWED_PLASMIC_STYLE_KEYS` (no `border*`/`background`/`cursor`/`flexGrow`/`display`/`fontFamily`/`textDecoration`/`whiteSpace`/`flexWrap`/`objectFit`/shorthand `padding`/`margin`).
- **NEVER pass `type: "string"` to `PLASMIC.registerToken`** (ONLY `color|spacing|opacity|line-height|font-size|font-family`) or call `registerDataToken`; expose `ecmdImgClass_*` via `DataProvider` & `[Copy Class]`. `PlasmicHost.tsx` renders ONLY `<PlasmicCanvasHost />` (`ssr: false`+DEV `<head>` bridge). Tests: `plasmic-init-styles.test.ts`, `plasmic-host-boot.test.tsx`.

## Deterministic PowerShell + GitHub/Supabase Eyes Workflow (Low-Turn Default)
- **Role Split:** Chrome Side Panel acts as Architect & Eyes (0ms /errors + GitHub AI Mirror `mlhammes2/ecmd-ai-mirror`); PowerShell executes deterministic scripts writing files, running `node scripts/ecmd-sql.mjs` on `lvynkeuceiqxafgpgdvs`, running `npx tsc --noEmit` & `npx vitest run`, and syncing GitHub/mirror without 50-90 turn agentic exploration loops.
- **Optional `agy` Path:** Use `epen` (`agy.exe` with `-p` as the LAST argument) only when interactive/agentic CLI execution is specifically desired; keep prompts tightly scoped (< 10 turns).
- **4-Target Sync Rule:** Any workflow/runner/script update syncs `src/lib/ecmdBootPrompt.ts` (`/workflow`), `AGENTS.md`, `GEMINI.md` (< 6 KB), and `public.ecmd_external_ai_cms` in the same turn.
- **Plain-English Explanations (Smart High-School Level):** Owner is a hands-on small business owner (not a coder) building on a tight budget with big goals. Explain architecture, bugs, SQL, and fixes in clear, everyday plain English—no unnecessary jargon.
- PowerShell Paste Rule: Every PowerShell script ends with Write-Host "DONE" (and a trailing blank line) so it runs all the way through without asking for an extra Enter.
