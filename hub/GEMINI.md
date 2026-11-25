# ECMD CARBON 4 — MASTER OS FOR ANTIGRAVITY (`agy`) & ECMD PEN v4.2

Lead engineer for **Emerald Coast Mobile Detailing (ECMD)** in `C:\ECMD\emerald-coast-detailing-hub`.

## 1. DUAL-AI BOUNDARY & CUSTOMER API KEY (STRICT)
- **ADMIN/DEV (`agy` v1.5.15):** Personal `@gmail.com` OAuth (`$0.00/turn`, Gemini 4) strictly for local owner/admin code, Plasmic components, SQL migrations, & ops via `epen`. **NEVER wire `agy`/personal OAuth to public visitors.**
- **CUSTOMER SITE AI (`GEMINI_API_KEY` — Owned):** Public AI runs in Supabase Edge Functions (`ecmd-carbon-bridge`/`geminiAssistant`), isolated from `agy`.

## 2. PEN v4.2 (`-p` LAST-FLAG), AI MIRROR, SHELL GUARD & BOOT-SYNC
1. **PLAN FIRST, WAIT FOR "YES"** (`#ECMD_AI!` via `epen` is pre-confirmed).
2. **PEN v4.2:** `epen` -> `Start-EcmdPen.ps1` -> `run-pen-task.mjs` (`--dangerously-skip-permissions --output-format stream-json --add-dir C:\ECMD -p "..."`). `-p` MUST stay last when piping stdin. SHA-1 diffing tracks only files changed this turn. After `tsc` & `vitest` pass, auto-runs `node C:\ECMD\scripts\sync-ai-mirror.mjs --push` non-fatally.
3. **SHELL GUARD:** NEVER run PowerShell `Invoke-WebRequest`/`iwr` without `-UseBasicParsing` (prefer Node `fetch()` w/ `AbortSignal.timeout(8000)` or `curl.exe -s`).
4. **AI MIRROR (`mlhammes2/ecmd-ai-mirror`):** Raw URL grounding starts at `https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/SITE_MANIFEST.md` (`hub/`, `runner/`, `supabase-mirror/`; zero `.env*`/PII, secret-scrubbed).
5. **BOOT-SYNC:** Sync PowerShell/`C:\ECMD\scripts\*` changes in-turn to `ECMD_SIDEBAR_BOOT_PROMPT` (`ecmdBootPrompt.ts`), `AGENTS.md`, `GEMINI.md` (< 6 KB), & `public.ecmd_external_ai_cms` (`node scripts/ecmd-sql.mjs`).
6. **0ms `/errors` & VERIFY:** Run `npx tsc --noEmit` & `npx vitest run` (never watch) until 0 errors. `/errors` aggregates TSC (`/ai-telemetry.json`), Plasmic 3-tier tabs (`Desktop`/`Tablet`/`Mobile`/`Critical`), DEV Runtime JS (`/runtime-errors.json`), & `#ecmd-unified-errors-json`. `__root.tsx` injects DEV `<head>` bridge + `ecmdRuntimeBoot.ts`; `POST /__ecmd-live-dom` auto-prunes resolved issues.

## 3. SUPABASE (`lvynkeuceiqxafgpgdvs`)
- SQL via `node scripts/ecmd-sql.mjs "<SQL>"`. Tables: `ecmd_pen_turns`, `ecmd_external_ai_cms`, `ecmd_packages`, `ecmd_wix_legacy_vault`, `ecmd_site_menu_buttons`, `ecmd_plasmic_hydration`.

## 4. BREAKPOINTS, `registerEcmdComponent`, ZERO-INLINE-WIDTH & LOCKED COMPONENTS
- **`registerEcmdComponent` & Zero-Inline-Width:** Every component in `src/plasmic-init.ts` MUST use `registerEcmdComponent(Component, meta)` (ZERO bare `registerComponent(`; 0 KB prod overhead). `DevTelemetryObserver` forwards `className`/`style` via hidden sibling marker. NEVER hardcode inline `style={{ width: "100%" }}` on roots; use `:where(...)` CSS (`ecmdRootSizing.ts` + `styles.css`) + `defaultStyles: { width: "100%" }`.
- **3-Tier Breakpoints (`useEcmdBreakpoint.ts`):** `useEcmdBreakpoint(768, 1024)` resolves `desktop`/`tablet`/`mobile`, stamps `data-ecmd-viewport`, & routes `data-ecmd-action-mobile`/`tablet`/`desktop` -> `data-ecmd-action`.
- **Locked Components:**
  - `EcmdAuthModalController`: `#ecmd-auth-trigger-btn`, `#ecmd-auth-email-input`, `#ecmd-auth-password-input`, Remember Me, Show Password, Forgot Password, Login/Sign Up.
  - `EcmdThemeGroupController` ("Site Themes"): `#ecmd-theme-trigger-btn` & `#ecmd-theme-dropdown-card` (isolated, 150ms dedup), `openAttributeProfilesModal`. **Glossary (3 icon-free tabs: Search + Auto A-Z + Pin + Collapse All):** **Theme Groups Inspector** (*"groups console"*) = `Groups` (`Copy Attributes From` + `Undo`, 6-State Bar + **Live Canvas State Preview** `#ecmd-theme-live-state-preview`, Border `None (0px)`/`Width`/`Style`/Reset, Gradient Studio `Solid/Linear/Radial/Conic` w/ rounded `padding-box`/`::before` border—never `border-image`, Outer/Inner/Text Shadow, `@media`, Fluid `clamp()`); **Image Groups Inspector** = `Images` (`Copy Attributes From` + `Undo`, `ecmd-theme-assets` `<img>`/`<svg>` swap); **Design Tokens (`Tokens`)** = `boxShadow`/`textShadow`/`paint`/`border`/`radius` (`designTokens`, `tokenRefs`, `--ecmd-tok-*`, `themeOverrides`, Edit Everywhere, Detach, safe delete).
  - `EcmdVehicleSelector`: Unlocked 4-slot (`slot1`..`slot4`, `ecmd-vehicle-change`) + Tablet/Mobile overrides.
  - `EcmdPackagesRepeater`: Unlocked `itemTemplate` (`ecmd_packages`, auto-heals `data-ecmd-scope-btn`, `data-ecmd-slot-wrapper="transparent"`) + 3-tier overrides + SVG fallback.
  - `EcmdBrushedSteelButton` (`BrushedSteelButton` V7): `container-type: size`, `--button-radius: clamp(4px, calc(var(--button-height, 100px) * 0.11), 11px)`, `.steel-face` `calc(var(--button-radius) - 2px)`, fixed `160px` grain, `.button-label` `clamp(14px, min(var(--label-max, 32.2px), 55cqh, 18cqw), var(--label-max, 32.2px))`, `-4px`/`+3px` physics, `#54e9ea` glow, `selected`, `label`, `fontSize`, `width`/`height`, `onClick`.
- **SSR Hydration (`mobile-413`):** `src/client.tsx` mounts `/plasmic-host` CSR-only via `createRoot` (`#ecmd-plasmic-host-root`); `ssr: false`, `suppressHydrationWarning`, zero module-level `document.head` mutations, `readyState === "complete"` iframe guard, & SSR-deterministic state.

## 5. PLASMIC CSS WHITELIST, `registerToken` & `/plasmic-host`
- Stack: Vite + React + TS + Plasmic (`mrkoQykvpZZfVbEc1yjabw`, `http://localhost:8080`) + Supabase (`lvynkeuceiqxafgpgdvs`).
- `src/plasmic-init.ts`: ONLY `ALLOWED_PLASMIC_STYLE_KEYS` (atomic spacing; zero `border*`, `background`, `cursor`, `flexGrow`, `display`, `fontFamily`, `textDecoration`, `whiteSpace`, `flexWrap`, `objectFit`, or shorthand `padding`/`margin`).
- **NEVER pass `type: "string"` to `PLASMIC.registerToken`** (ONLY `color|spacing|opacity|line-height|font-size|font-family`) & NEVER call `registerDataToken`; expose `ecmdImgClass_*` ONLY via `DataProvider` (`$ctx.ecmdImgClass`) & `[Copy Class]`. `PlasmicHost.tsx` renders ONLY `<PlasmicCanvasHost />` with `ssr: false` + DEV `<head>` bridge. Enforced by `plasmic-init-styles.test.ts` & `plasmic-host-boot.test.tsx`.
