# ECMD Full-Site Public AI Mirror — `SITE_MANIFEST.md`

> **Auto-synced public AI grounding mirror** for **Emerald Coast Mobile Detailing (ECMD)** (`mlhammes2/ecmd-ai-mirror`, branch `main`).
> Chrome Gemini Sidebar & external architects: fetch this manifest first, then fetch any exact raw GitHub URL below on demand.

## Summary
- **Generated At:** `2026-11-27T21:16:09.147Z`
- **Latest Turn:** `TURN-048`
- **Manifest Raw URL:** https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/SITE_MANIFEST.md
- **JSON Manifest Raw URL:** https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/SITE_MANIFEST.json
- **Mirrored Files:** **318** total (`hub/`: 175, `runner/`: 114, `supabase-mirror/`: 29)
- **Secrets Scrubbed:** 66 redaction(s) applied (zero `.env*`, zero auth/PII tables exported)

## Supabase Summary (`lvynkeuceiqxafgpgdvs`)
- **Public Tables:** 57 total · **25** safe config/CMS/package/Wix tables mirrored · **32** auth/PII/log tables strictly excluded
- **Schema DDL:** https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/schema/schema_overview.sql
- **Schema JSON:** https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/schema/tables_and_columns.json
- **Edge Functions Registry:** https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/edge-functions/deployed_functions.json

| Table | Rows | RLS | Mirrored |
|---|---:|:---:|:---:|
| `ecmd_advanced_suggestions` | 31 | OFF | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_advanced_suggestions.json) |
| `ecmd_ai_inbox` | 1 | ON | Excluded (Auth/PII/Log) |
| `ecmd_ai_registry` | 31 | ON | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_ai_registry.json) |
| `ecmd_brain` | 78 | ON | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_brain.json) |
| `ecmd_bridge_logs` | 23 | ON | Excluded (Auth/PII/Log) |
| `ecmd_cli_queue` | 12 | OFF | Excluded (Auth/PII/Log) |
| `ecmd_codebase` | 78 | ON | Excluded (Auth/PII/Log) |
| `ecmd_conversations` | 1 | ON | Excluded (Auth/PII/Log) |
| `ecmd_crm_availability` | 4 | ON | Excluded (Auth/PII/Log) |
| `ecmd_crm_contacts` | 5 | ON | Excluded (Auth/PII/Log) |
| `ecmd_crm_contractors` | 4 | ON | Excluded (Auth/PII/Log) |
| `ecmd_crm_customers` | 4 | ON | Excluded (Auth/PII/Log) |
| `ecmd_crm_jobs` | 7 | ON | Excluded (Auth/PII/Log) |
| `ecmd_crm_locations` | 5 | ON | Excluded (Auth/PII/Log) |
| `ecmd_crm_subscriptions` | 0 | ON | Excluded (Auth/PII/Log) |
| `ecmd_crm_temp_cart` | 4 | ON | Excluded (Auth/PII/Log) |
| `ecmd_crm_vehicles` | 6 | ON | Excluded (Auth/PII/Log) |
| `ecmd_dev_jobs` | 0 | OFF | Excluded (Auth/PII/Log) |
| `ecmd_diagnostic_runs` | 1 | OFF | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_diagnostic_runs.json) |
| `ecmd_external_ai_cms` | 41 | OFF | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_external_ai_cms.json) |
| `ecmd_files_mirror` | 99 | OFF | Excluded (Auth/PII/Log) |
| `ecmd_members` | 0 | ON | Excluded (Auth/PII/Log) |
| `ecmd_messages` | 6 | ON | Excluded (Auth/PII/Log) |
| `ecmd_packages` | 4 | OFF | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_packages.json) |
| `ecmd_pen_turns` | 46 | OFF | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_pen_turns.json) |
| `ecmd_plasmic_hydration` | 1 | OFF | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_plasmic_hydration.json) |
| `ecmd_service_packages` | 36 | ON | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_service_packages.json) |
| `ecmd_site_blueprints` | 106 | ON | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_site_blueprints.json) |
| `ecmd_site_menu_buttons` | 17 | OFF | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_site_menu_buttons.json) |
| `ecmd_sql_logs` | 20 | OFF | Excluded (Auth/PII/Log) |
| `ecmd_telemetry` | 0 | ON | Excluded (Auth/PII/Log) |
| `ecmd_whats_included` | 30 | ON | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_whats_included.json) |
| `ecmd_wix_active_subscriptions` | 0 | ON | Excluded (Auth/PII/Log) |
| `ecmd_wix_ai_brain_master_index` | 7 | ON | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_ai_brain_master_index.json) |
| `ecmd_wix_ai_capabilities_rules` | 15 | ON | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_ai_capabilities_rules.json) |
| `ecmd_wix_ai_persona_response_rules` | 4 | ON | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_ai_persona_response_rules.json) |
| `ecmd_wix_availability_rules` | 4 | ON | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_availability_rules.json) |
| `ecmd_wix_bookings` | 0 | ON | Excluded (Auth/PII/Log) |
| `ecmd_wix_calendar_time_slots` | 3 | ON | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_calendar_time_slots.json) |
| `ecmd_wix_code_and_blueprints` | 80 | ON | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_code_and_blueprints.json) |
| `ecmd_wix_contractors` | 4 | ON | Excluded (Auth/PII/Log) |
| `ecmd_wix_customer_contacts` | 5 | ON | Excluded (Auth/PII/Log) |
| `ecmd_wix_customer_locations` | 5 | ON | Excluded (Auth/PII/Log) |
| `ecmd_wix_customer_profiles` | 3 | ON | Excluded (Auth/PII/Log) |
| `ecmd_wix_customer_vehicles` | 6 | ON | Excluded (Auth/PII/Log) |
| `ecmd_wix_discounts` | 1 | ON | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_discounts.json) |
| `ecmd_wix_global_settings` | 1 | ON | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_global_settings.json) |
| `ecmd_wix_legacy_vault` | 106 | OFF | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_legacy_vault.json) |
| `ecmd_wix_login_security` | 7 | ON | Excluded (Auth/PII/Log) |
| `ecmd_wix_payment_methods` | 15 | ON | Excluded (Auth/PII/Log) |
| `ecmd_wix_profile_buttons` | 0 | ON | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_profile_buttons.json) |
| `ecmd_wix_promo_codes` | 0 | ON | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_promo_codes.json) |
| `ecmd_wix_scheduled_jobs` | 7 | ON | Excluded (Auth/PII/Log) |
| `ecmd_wix_site_buttons` | 81 | ON | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_site_buttons.json) |
| `ecmd_wix_sync_errors` | 9 | ON | Excluded (Auth/PII/Log) |
| `ecmd_wix_temporary_data` | 2 | ON | Excluded (Auth/PII/Log) |
| `ecmd_wix_vehicle_categories` | 14 | ON | [JSON](https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_vehicle_categories.json) |

## Plasmic Registered Components (`ECMD_REGISTERED_COMPONENTS` — 17)
| Name | Display Name | Import Path |
|---|---|---|
| `HqWeeklyStrip` | HQ Weekly Strip | `./components/booking-hq/HqWeeklyStrip` |
| `HqDailyDispatchBoard` | HQ Daily Dispatch Board | `./components/booking-hq/HqDailyDispatchBoard` |
| `HqInvoiceCard` | HQ Invoice Card | `./components/booking-hq/HqInvoiceCard` |
| `HqMultiStateWorkspace` | HQ Multi-State Workspace | `./components/booking-hq/HqMultiStateWorkspace` |
| `EcmdAuthModalController` | Auth Model (ECMD Engine) | `./src/components/EcmdAuthModalController` |
| `EcmdBrandIcon` | Icon | `./src/components/EcmdThemeImage` |
| `EcmdBrandWordMark` | WordMark | `./src/components/EcmdThemeImage` |
| `EcmdThemeLogo` | Theme Logo (SVG Switcher) | `./src/components/EcmdThemeLogo` |
| `EcmdThemeGroupController` | Site Themes | `./src/components/EcmdThemeGroupController` |
| `EcmdSideMenuController` | Side Menu Modal (☰) | `./components/EcmdSideMenuController` |
| `EcmdVehicleSelector` | Vehicle Size Selector (4-Slot) | `./components/EcmdVehicleSelector` |
| `EcmdSavedVehicleDropdown` | Saved Vehicle Dropdown (#vehicleSelectDropButton) | `./components/EcmdSavedVehicleDropdown` |
| `EcmdPackagesRepeater` | Packages Repeater (#packagesRep) | `./components/EcmdPackagesRepeater` |
| `EcmdBrushedSteelButton` | Brushed Steel Button | `./components/EcmdBrushedSteelButton` |
| `EcmdWhatsIncludedModal` | What | `./components/EcmdWhatsIncludedModal` |
| `EcmdWhatsIncludedItemPopup` | What | `./components/EcmdWhatsIncludedItemPopup` |
| `EcmdCartSummaryBar` | Cart & Summary Handoff Bar (ecmd_cart_draft) | `./components/EcmdCartSummaryBar` |

## Key Wix-to-Plasmic Migration Files (45)
- `hub/scripts/archive-wix-vault.mjs` (9.9 KB) — exports: runSql, escapeSql, getCategory, getDescription, main — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/scripts/archive-wix-vault.mjs
- `hub/scripts/sync-wix-vault.mjs` (12.9 KB) — exports: runSql, escapeSql, getCategory, getDescription, main — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/scripts/sync-wix-vault.mjs
- `hub/src/components/booking-hq/HqDailyDispatchBoard.tsx` (2.3 KB) — exports: HqDailyDispatchBoardProps, HqDailyDispatchBoard — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/booking-hq/HqDailyDispatchBoard.tsx
- `hub/src/components/booking-hq/HqInvoiceCard.tsx` (2.7 KB) — exports: LineItem, HqInvoiceCardProps, HqInvoiceCard — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/booking-hq/HqInvoiceCard.tsx
- `hub/src/components/booking-hq/HqMultiStateWorkspace.tsx` (3.9 KB) — exports: HqMultiStateWorkspaceProps, HqMultiStateWorkspace — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/booking-hq/HqMultiStateWorkspace.tsx
- `hub/src/components/booking-hq/HqWeeklyStrip.tsx` (1.9 KB) — exports: HqWeeklyStripProps, HqWeeklyStrip — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/booking-hq/HqWeeklyStrip.tsx
- `hub/src/components/booking-hq/index.ts` (151 B) — Code module — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/booking-hq/index.ts
- `hub/src/components/EcmdAuthModalController.tsx` (36.0 KB) — exports: ECMD_AUTH_LOGO_DATA_URI, EcmdAuthModalControllerProps — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdAuthModalController.tsx
- `hub/src/components/EcmdBrushedSteelButton.tsx` (8.6 KB) — exports: DEFAULT_STEEL_GLOW_COLOR, DEFAULT_STEEL_BUTTON_WIDTH, DEFAULT_STEEL_BUTTON_HEIGHT, ParsedRgbColor, SteelButtonSizingVars, normalizeCssDimension — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdBrushedSteelButton.tsx
- `hub/src/components/EcmdPackagesRepeater.tsx` (36.9 KB) — exports: SCOPE_BUTTON_TEXT_PATTERNS, autoHealPackageScopeButtons, PackagesOrientation, ResponsivePackagesOrientation, MobilePackagesOrientation, TabletPackagesOrientation — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdPackagesRepeater.tsx
- `hub/src/components/EcmdThemeGroupController.tsx` (72.1 KB) — exports: PresetTheme, EcmdThemeGroupControllerProps, buildFluidClampCss, wrapCssWithBreakpointMedia — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdThemeGroupController.tsx
- `hub/src/components/EcmdVehicleSelector.tsx` (13.4 KB) — exports: VehicleSelectorResponsiveLayout, VehicleSelectorMobileLayout, EcmdVehicleSlotContext, EcmdVehicleLockedAttemptDetail, EcmdVehicleSelectorProps, EcmdVehicleSelector — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdVehicleSelector.tsx
- `hub/src/components/EcmdWhatsIncludedItemPopup.tsx` (29.1 KB) — exports: WhatsIncludedItemRecord, EcmdOpenWhatsIncludedItemDetail, EcmdWhatsIncludedItemPopupProps, EcmdWhatsIncludedItemPopupContext, getWhatsIncludedItemId, getWhatsIncludedItemTitle — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdWhatsIncludedItemPopup.tsx
- `hub/src/components/EcmdWhatsIncludedModal.tsx` (60.5 KB) — exports: WhatsIncludedAddOnTab, EcmdWhatsIncludedRow, EcmdSubscriptionEstimate, EcmdWhatsIncludedOpenDetail, EcmdWhatsIncludedAddToCartPayload, EcmdWhatsIncludedContext — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdWhatsIncludedModal.tsx
- `hub/src/lib/ecmdPackageMatcher.ts` (18.6 KB) — exports: PackageLevelName, PackageDetailType, PackageScopeKey, PackageSubCategory, EcmdVehicleKey, EcmdServicePackageRow — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/lib/ecmdPackageMatcher.ts
- `hub/src/test/EcmdWhatsIncludedItemPopup.test.tsx` (11.3 KB) — Vitest automated test suite — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/EcmdWhatsIncludedItemPopup.test.tsx
- `hub/src/test/wix-vault.test.ts` (1.6 KB) — Vitest automated test suite — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/wix-vault.test.ts
- `runner/.github/workflows/wix-publish.yml` (1.1 KB) — GitHub Actions / YAML workflow — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/.github/workflows/wix-publish.yml
- `runner/scripts/import-wix-csvs.mjs` (29.7 KB) — exports: parseCsv — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/scripts/import-wix-csvs.mjs
- `runner/scripts/wix-auto-publish.js` (625 B) — ECMD automation/PEN runner script — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/scripts/wix-auto-publish.js
- `runner/src/pages/Booking HQ.k657b.js` (2.3 KB) — Wix Velo legacy page controller — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/pages/Booking%20HQ.k657b.js
- `runner/src/public/cartEngine.js` (19.9 KB) — exports: getOrdinalSuffix, formatPhoneNumber, buildCalendarDates, getDetailerTimeOff, calculateNextAvailableDate, buildWeeklyDataArray — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/cartEngine.js
- `runner/src/public/fileCartEdits.js` (34.0 KB) — exports: initCartEdits, syncCartEditsDependencies, startCartEditsFlow, restoreCartEditsVaultIfNeeded — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/fileCartEdits.js
- `runner/src/public/filePackageEdits.js` (22.4 KB) — exports: initPackageEditEngine, loadPackageEditMode — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/filePackageEdits.js
- `runner/src/public/fileWhatsIncluded.js` (15.0 KB) — exports: initWhatsIncludedEngine, openWhatsIncludedPopup — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/fileWhatsIncluded.js
- `runner/src/public/fileWhatsIncludedG.js` (4.9 KB) — exports: initWhatsIncludedGEngine, openDetailedWiPopup — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/fileWhatsIncludedG.js
- `runner/src/public/hqBookingEngine.js` (25.7 KB) — exports: refreshCartUI, initBookingHQEngine — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/hqBookingEngine.js
- `runner/src/public/packageMatcher.js` (4.2 KB) — exports: normalizeToPackageSubCategory, extractLevelAndType, findMatchingServicePackage — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/packageMatcher.js
- `runner/src/public/packagesEngine.js` (24.9 KB) — exports: clearActivePackageMemory, clearCustomVehicleDropdown, syncPackagesVehicles — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/packagesEngine.js
- `runner/src/public/repeaterEngine.js` (4.0 KB) — exports: registerRepeater, repaintSingleItem, smartSyncRepeater — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/repeaterEngine.js
- `runner/wix.config.json` (82 B) — JSON data / config — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/wix.config.json
- `supabase-mirror/tables/ecmd_packages.json` (3.1 KB) — Supabase public.ecmd_packages table snapshot (scrubbed) — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_packages.json
- `supabase-mirror/tables/ecmd_wix_ai_brain_master_index.json` (14.0 KB) — Supabase public.ecmd_wix_ai_brain_master_index table snapshot (scrubbed) — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_ai_brain_master_index.json
- `supabase-mirror/tables/ecmd_wix_ai_capabilities_rules.json` (36.8 KB) — Supabase public.ecmd_wix_ai_capabilities_rules table snapshot (scrubbed) — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_ai_capabilities_rules.json
- `supabase-mirror/tables/ecmd_wix_ai_persona_response_rules.json` (13.2 KB) — Supabase public.ecmd_wix_ai_persona_response_rules table snapshot (scrubbed) — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_ai_persona_response_rules.json
- `supabase-mirror/tables/ecmd_wix_availability_rules.json` (5.4 KB) — Supabase public.ecmd_wix_availability_rules table snapshot (scrubbed) — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_availability_rules.json
- `supabase-mirror/tables/ecmd_wix_calendar_time_slots.json` (2.9 KB) — Supabase public.ecmd_wix_calendar_time_slots table snapshot (scrubbed) — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_calendar_time_slots.json
- `supabase-mirror/tables/ecmd_wix_code_and_blueprints.json` (647.6 KB) — Supabase public.ecmd_wix_code_and_blueprints table snapshot (scrubbed) — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_code_and_blueprints.json
- `supabase-mirror/tables/ecmd_wix_discounts.json` (825 B) — Supabase public.ecmd_wix_discounts table snapshot (scrubbed) — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_discounts.json
- `supabase-mirror/tables/ecmd_wix_global_settings.json` (828 B) — Supabase public.ecmd_wix_global_settings table snapshot (scrubbed) — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_global_settings.json
- `supabase-mirror/tables/ecmd_wix_legacy_vault.json` (2.02 MB) — Supabase public.ecmd_wix_legacy_vault table snapshot (scrubbed) — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_legacy_vault.json
- `supabase-mirror/tables/ecmd_wix_profile_buttons.json` (146 B) — Supabase public.ecmd_wix_profile_buttons table snapshot (scrubbed) — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_profile_buttons.json
- `supabase-mirror/tables/ecmd_wix_promo_codes.json` (142 B) — Supabase public.ecmd_wix_promo_codes table snapshot (scrubbed) — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_promo_codes.json
- `supabase-mirror/tables/ecmd_wix_site_buttons.json` (89.3 KB) — Supabase public.ecmd_wix_site_buttons table snapshot (scrubbed) — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_site_buttons.json
- `supabase-mirror/tables/ecmd_wix_vehicle_categories.json` (10.7 KB) — Supabase public.ecmd_wix_vehicle_categories table snapshot (scrubbed) — https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_vehicle_categories.json

## Files: `hub/` (175)
| Path | Size | Exports / Purpose | Raw GitHub URL |
|---|---:|---|---|
| `hub/.gitignore` | 385 B | Text/config file | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/.gitignore |
| `hub/.prettierignore` | 100 B | Text/config file | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/.prettierignore |
| `hub/.prettierrc` | 96 B | Text/config file | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/.prettierrc |
| `hub/AGENTS.md` | 27.2 KB | Markdown documentation | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/AGENTS.md |
| `hub/BRAIN_SNAPSHOT.md` | 166 B | Markdown documentation | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/BRAIN_SNAPSHOT.md |
| `hub/bunfig.toml` | 414 B | Text/config file | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/bunfig.toml |
| `hub/components.json` | 465 B | JSON data / config | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/components.json |
| `hub/eslint.config.js` | 1.3 KB | Code module | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/eslint.config.js |
| `hub/GEMINI.md` | 6.0 KB | Markdown documentation | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/GEMINI.md |
| `hub/package.json` | 3.2 KB | Package manifest & scripts | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/package.json |
| `hub/public/ai-telemetry.json` | 4.1 KB | ECMD PEN live turn telemetry | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/public/ai-telemetry.json |
| `hub/public/Ecmd Icon Cord Black.svg` | 39.9 KB | SVG vector asset | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/public/Ecmd%20Icon%20Cord%20Black.svg |
| `hub/public/ecmd-brain.html` | 962 B | HTML template / console | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/public/ecmd-brain.html |
| `hub/public/ecmd-dolphin-logo.svg` | 5.5 KB | SVG vector asset | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/public/ecmd-dolphin-logo.svg |
| `hub/public/ecmd-live-readout.txt` | 112.1 KB | Text/config file | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/public/ecmd-live-readout.txt |
| `hub/public/logo-black.svg` | 39.9 KB | SVG vector asset | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/public/logo-black.svg |
| `hub/public/logo.svg` | 39.9 KB | SVG vector asset | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/public/logo.svg |
| `hub/public/plasmic-diagnostics.json` | 144.6 KB | Plasmic Canvas live diagnostics store | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/public/plasmic-diagnostics.json |
| `hub/public/plasmic-layout-hydration.json` | 3.5 KB | JSON data / config | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/public/plasmic-layout-hydration.json |
| `hub/public/plasmic-live-dom.json` | 3.01 MB | JSON data / config | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/public/plasmic-live-dom.json |
| `hub/public/robots.txt` | 174 B | Text/config file | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/public/robots.txt |
| `hub/public/runtime-errors.json` | 2.6 KB | DEV browser runtime errors store | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/public/runtime-errors.json |
| `hub/README.md` | 1.1 KB | Doc: Emerald Coast Detailing Hub | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/README.md |
| `hub/scripts/archive-wix-vault.mjs` | 9.9 KB | exports: runSql, escapeSql, getCategory, getDescription, main | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/scripts/archive-wix-vault.mjs |
| `hub/scripts/ecmd-sql.mjs` | 440 B | Code module | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/scripts/ecmd-sql.mjs |
| `hub/scripts/fix-plasmic-shorthands.mjs` | 2.1 KB | Code module | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/scripts/fix-plasmic-shorthands.mjs |
| `hub/scripts/sync-plasmic-hydration.mjs` | 4.2 KB | exports: run | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/scripts/sync-plasmic-hydration.mjs |
| `hub/scripts/sync-wix-vault.mjs` | 12.9 KB | exports: runSql, escapeSql, getCategory, getDescription, main | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/scripts/sync-wix-vault.mjs |
| `hub/scripts/update-pen-runner.mjs` | 8.2 KB | Code module | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/scripts/update-pen-runner.mjs |
| `hub/src/client.tsx` | 2.2 KB | exports: ECMD_PLASMIC_HOST_ROOT_ID, isPlasmicHostPathname, mountPlasmicHostClientOnly, bootstrapEcmdClient | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/client.tsx |
| `hub/src/components/booking-hq/HqDailyDispatchBoard.tsx` | 2.3 KB | exports: HqDailyDispatchBoardProps, HqDailyDispatchBoard | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/booking-hq/HqDailyDispatchBoard.tsx |
| `hub/src/components/booking-hq/HqInvoiceCard.tsx` | 2.7 KB | exports: LineItem, HqInvoiceCardProps, HqInvoiceCard | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/booking-hq/HqInvoiceCard.tsx |
| `hub/src/components/booking-hq/HqMultiStateWorkspace.tsx` | 3.9 KB | exports: HqMultiStateWorkspaceProps, HqMultiStateWorkspace | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/booking-hq/HqMultiStateWorkspace.tsx |
| `hub/src/components/booking-hq/HqWeeklyStrip.tsx` | 1.9 KB | exports: HqWeeklyStripProps, HqWeeklyStrip | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/booking-hq/HqWeeklyStrip.tsx |
| `hub/src/components/booking-hq/index.ts` | 151 B | Code module | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/booking-hq/index.ts |
| `hub/src/components/dock/HqDockPrimitives.tsx` | 7.4 KB | exports: HqDockRailProps, HqDockRail, HqDockIconButtonProps, HqDockIconButton, HqSlideOutDrawerProps, HqSlideOutDrawer | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/dock/HqDockPrimitives.tsx |
| `hub/src/components/dock/index.ts` | 37 B | Code module | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/dock/index.ts |
| `hub/src/components/EcmdAttributeProfilesModal.tsx` | 28.9 KB | exports: CoreAttributeKey, MappedGroupPropKey, CoreAttributeDef, CORE_STYLE_ATTRIBUTES, AttributeProfile, AttributeProfilesStore | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdAttributeProfilesModal.tsx |
| `hub/src/components/EcmdAuthModalController.tsx` | 36.0 KB | exports: ECMD_AUTH_LOGO_DATA_URI, EcmdAuthModalControllerProps | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdAuthModalController.tsx |
| `hub/src/components/EcmdBrushedSteelButton.tsx` | 8.6 KB | exports: DEFAULT_STEEL_GLOW_COLOR, DEFAULT_STEEL_BUTTON_WIDTH, DEFAULT_STEEL_BUTTON_HEIGHT, ParsedRgbColor, SteelButtonSizingVars, normalizeCssDimension | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdBrushedSteelButton.tsx |
| `hub/src/components/EcmdCartSummaryBar.tsx` | 22.3 KB | exports: CART_DRAFT_STORAGE_KEY, EcmdCartDraft, EcmdAddToCartEventDetail, EcmdCartSummaryBarContext, EcmdCartSummaryBarProps, normalizeAddToCartPayload | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdCartSummaryBar.tsx |
| `hub/src/components/EcmdDeviceGlobalContext.tsx` | 1.9 KB | exports: EcmdDeviceGlobalContext | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdDeviceGlobalContext.tsx |
| `hub/src/components/EcmdDynamicGroupManager.tsx` | 278.8 KB | exports: GroupStateKey, SubGroupStateKey, GROUP_STATE_TABS, GroupStateThemeValues, GroupStateOverride, ThemeGroupBreakpointTarget | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdDynamicGroupManager.tsx |
| `hub/src/components/EcmdHoverTooltip.tsx` | 6.5 KB | exports: EcmdHoverTooltipProps, EcmdHoverTooltip | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdHoverTooltip.tsx |
| `hub/src/components/EcmdPackagesRepeater.tsx` | 36.9 KB | exports: SCOPE_BUTTON_TEXT_PATTERNS, autoHealPackageScopeButtons, PackagesOrientation, ResponsivePackagesOrientation, MobilePackagesOrientation, TabletPackagesOrientation | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdPackagesRepeater.tsx |
| `hub/src/components/EcmdPlasmicColorRow.tsx` | 97.7 KB | exports: PresetColorToken, GM3_COLOR_PRESETS, EcmdPlasmicColorRow | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdPlasmicColorRow.tsx |
| `hub/src/components/EcmdSavedVehicleDropdown.tsx` | 26.2 KB | exports: DROPDOWN_INTRO_LABEL, LOCKED_TYPE_ERROR_TEXT, ERROR_DURATION_MS, BROWSE_WITHOUT_VEHICLE_LABEL, ADD_NEW_VEHICLE_LABEL, SELECTED_SUMMARY_VEHICLE_STORAGE_KEY | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdSavedVehicleDropdown.tsx |
| `hub/src/components/EcmdSideMenuController.tsx` | 25.1 KB | exports: SiteMenuButtonItem, DEFAULT_WIX_SITE_MENU_BUTTONS, EcmdSideMenuControllerProps, EcmdSideMenuController | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdSideMenuController.tsx |
| `hub/src/components/EcmdSpacingBoxControl.tsx` | 35.8 KB | exports: createSpacingControl | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdSpacingBoxControl.tsx |
| `hub/src/components/EcmdTextShadowControl.tsx` | 21.2 KB | exports: EcmdTextShadowControlProps, EcmdTextShadowControl | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdTextShadowControl.tsx |
| `hub/src/components/EcmdThemeGroupController.tsx` | 72.1 KB | exports: PresetTheme, EcmdThemeGroupControllerProps, buildFluidClampCss, wrapCssWithBreakpointMedia | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdThemeGroupController.tsx |
| `hub/src/components/EcmdThemeImage.tsx` | 2.1 KB | exports: ThemeKey, EcmdThemeImageProps, EcmdThemeImage | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdThemeImage.tsx |
| `hub/src/components/EcmdThemeImagesTab.tsx` | 68.2 KB | exports: EcmdThemeImagesTabProps, EcmdThemeImagesTab | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdThemeImagesTab.tsx |
| `hub/src/components/EcmdThemeLogo.tsx` | 2.3 KB | exports: ThemeKey, EcmdThemeLogoProps, EcmdThemeLogo | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdThemeLogo.tsx |
| `hub/src/components/EcmdThemeTokensTab.tsx` | 46.0 KB | exports: EcmdThemeTokensTabProps, countGroupsUsingToken, EcmdThemeTokensTab | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdThemeTokensTab.tsx |
| `hub/src/components/EcmdTokenBindingBar.tsx` | 16.6 KB | exports: EcmdTokenBindingContext, EcmdLinkedTokenPill, EcmdTokenPopoverSection | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdTokenBindingBar.tsx |
| `hub/src/components/EcmdVehicleSelector.tsx` | 13.4 KB | exports: VehicleSelectorResponsiveLayout, VehicleSelectorMobileLayout, EcmdVehicleSlotContext, EcmdVehicleLockedAttemptDetail, EcmdVehicleSelectorProps, EcmdVehicleSelector | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdVehicleSelector.tsx |
| `hub/src/components/EcmdWhatsIncludedItemPopup.tsx` | 29.1 KB | exports: WhatsIncludedItemRecord, EcmdOpenWhatsIncludedItemDetail, EcmdWhatsIncludedItemPopupProps, EcmdWhatsIncludedItemPopupContext, getWhatsIncludedItemId, getWhatsIncludedItemTitle | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdWhatsIncludedItemPopup.tsx |
| `hub/src/components/EcmdWhatsIncludedModal.tsx` | 60.5 KB | exports: WhatsIncludedAddOnTab, EcmdWhatsIncludedRow, EcmdSubscriptionEstimate, EcmdWhatsIncludedOpenDetail, EcmdWhatsIncludedAddToCartPayload, EcmdWhatsIncludedContext | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/EcmdWhatsIncludedModal.tsx |
| `hub/src/components/layout/AppHeader.tsx` | 9.2 KB | exports: AppHeader | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/layout/AppHeader.tsx |
| `hub/src/components/layout/nav-links.ts` | 138 B | exports: NAV_LINKS | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/layout/nav-links.ts |
| `hub/src/components/layout/PageShell.tsx` | 895 B | exports: PageShell | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/layout/PageShell.tsx |
| `hub/src/components/ui/accordion.tsx` | 2.0 KB | exports: Accordion, AccordionItem, AccordionTrigger, AccordionContent | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/accordion.tsx |
| `hub/src/components/ui/alert-dialog.tsx` | 4.2 KB | exports: AlertDialog, AlertDialogPortal, AlertDialogOverlay, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/alert-dialog.tsx |
| `hub/src/components/ui/alert.tsx` | 1.6 KB | exports: Alert, AlertTitle, AlertDescription | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/alert.tsx |
| `hub/src/components/ui/aspect-ratio.tsx` | 148 B | exports: AspectRatio | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/aspect-ratio.tsx |
| `hub/src/components/ui/avatar.tsx` | 1.4 KB | exports: Avatar, AvatarImage, AvatarFallback | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/avatar.tsx |
| `hub/src/components/ui/badge.tsx` | 1.1 KB | exports: BadgeProps | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/badge.tsx |
| `hub/src/components/ui/breadcrumb.tsx` | 2.8 KB | exports: Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/breadcrumb.tsx |
| `hub/src/components/ui/button.tsx` | 1.9 KB | exports: ButtonProps | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/button.tsx |
| `hub/src/components/ui/calendar.tsx` | 7.2 KB | exports: Calendar, CalendarDayButton | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/calendar.tsx |
| `hub/src/components/ui/card.tsx` | 1.8 KB | exports: Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/card.tsx |
| `hub/src/components/ui/carousel.tsx` | 6.3 KB | exports: type CarouselApi, Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/carousel.tsx |
| `hub/src/components/ui/chart.tsx` | 10.6 KB | exports: ChartConfig | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/chart.tsx |
| `hub/src/components/ui/checkbox.tsx` | 1.0 KB | exports: Checkbox | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/checkbox.tsx |
| `hub/src/components/ui/collapsible.tsx` | 346 B | exports: Collapsible, CollapsibleTrigger, CollapsibleContent | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/collapsible.tsx |
| `hub/src/components/ui/command.tsx` | 4.9 KB | exports: Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/command.tsx |
| `hub/src/components/ui/context-menu.tsx` | 7.4 KB | exports: ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuCheckboxItem, ContextMenuRadioItem | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/context-menu.tsx |
| `hub/src/components/ui/dialog.tsx` | 3.7 KB | exports: Dialog, DialogPortal, DialogOverlay, DialogTrigger, DialogClose, DialogContent | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/dialog.tsx |
| `hub/src/components/ui/drawer.tsx` | 3.0 KB | exports: Drawer, DrawerPortal, DrawerOverlay, DrawerTrigger, DrawerClose, DrawerContent | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/drawer.tsx |
| `hub/src/components/ui/dropdown-menu.tsx` | 7.6 KB | exports: DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuRadioItem | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/dropdown-menu.tsx |
| `hub/src/components/ui/form.tsx` | 4.3 KB | exports: useFormField, Form, FormItem, FormLabel, FormControl, FormDescription | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/form.tsx |
| `hub/src/components/ui/hover-card.tsx` | 1.2 KB | exports: HoverCard, HoverCardTrigger, HoverCardContent | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/hover-card.tsx |
| `hub/src/components/ui/input-otp.tsx` | 2.3 KB | exports: InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/input-otp.tsx |
| `hub/src/components/ui/input.tsx` | 798 B | exports: Input | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/input.tsx |
| `hub/src/components/ui/label.tsx` | 737 B | exports: Label | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/label.tsx |
| `hub/src/components/ui/menubar.tsx` | 8.5 KB | exports: Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/menubar.tsx |
| `hub/src/components/ui/navigation-menu.tsx` | 5.1 KB | exports: navigationMenuTriggerStyle, NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuContent, NavigationMenuTrigger | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/navigation-menu.tsx |
| `hub/src/components/ui/pagination.tsx` | 2.8 KB | exports: Pagination, PaginationContent, PaginationLink, PaginationItem, PaginationPrevious, PaginationNext | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/pagination.tsx |
| `hub/src/components/ui/popover.tsx` | 1.4 KB | exports: Popover, PopoverTrigger, PopoverContent, PopoverAnchor | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/popover.tsx |
| `hub/src/components/ui/progress.tsx` | 806 B | exports: Progress | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/progress.tsx |
| `hub/src/components/ui/radio-group.tsx` | 1.4 KB | exports: RadioGroup, RadioGroupItem | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/radio-group.tsx |
| `hub/src/components/ui/resizable.tsx` | 1.6 KB | exports: ResizablePanelGroup, ResizablePanel, ResizableHandle | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/resizable.tsx |
| `hub/src/components/ui/scroll-area.tsx` | 1.6 KB | exports: ScrollArea, ScrollBar | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/scroll-area.tsx |
| `hub/src/components/ui/select.tsx` | 5.8 KB | exports: Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/select.tsx |
| `hub/src/components/ui/separator.tsx` | 747 B | exports: Separator | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/separator.tsx |
| `hub/src/components/ui/sheet.tsx` | 4.3 KB | exports: Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose, SheetContent | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/sheet.tsx |
| `hub/src/components/ui/sidebar.tsx` | 24.1 KB | exports: useSidebar | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/sidebar.tsx |
| `hub/src/components/ui/skeleton.tsx` | 246 B | exports: Skeleton | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/skeleton.tsx |
| `hub/src/components/ui/slider.tsx` | 1.0 KB | exports: Slider | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/slider.tsx |
| `hub/src/components/ui/sonner.tsx` | 757 B | exports: Toaster | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/sonner.tsx |
| `hub/src/components/ui/switch.tsx` | 1.2 KB | exports: Switch | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/switch.tsx |
| `hub/src/components/ui/table.tsx` | 2.8 KB | exports: Table, TableHeader, TableBody, TableFooter, TableHead, TableRow | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/table.tsx |
| `hub/src/components/ui/tabs.tsx` | 1.9 KB | exports: Tabs, TabsList, TabsTrigger, TabsContent | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/tabs.tsx |
| `hub/src/components/ui/textarea.tsx` | 698 B | exports: Textarea | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/textarea.tsx |
| `hub/src/components/ui/toggle-group.tsx` | 1.8 KB | exports: ToggleGroup, ToggleGroupItem | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/toggle-group.tsx |
| `hub/src/components/ui/toggle.tsx` | 1.5 KB | exports: Toggle, toggleVariants | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/toggle.tsx |
| `hub/src/components/ui/tooltip.tsx` | 1.3 KB | exports: Tooltip, TooltipTrigger, TooltipContent, TooltipProvider | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/components/ui/tooltip.tsx |
| `hub/src/engines/hqCalendar.ts` | 2.0 KB | exports: CalendarSlot, DaySchedule, buildHqWeekMatrix | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/engines/hqCalendar.ts |
| `hub/src/engines/profileEngine.ts` | 1.0 KB | exports: CrmSnapshot, fetchCrmSnapshot | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/engines/profileEngine.ts |
| `hub/src/engines/stateManager.ts` | 1.8 KB | exports: BookingDraftState, stateManager | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/engines/stateManager.ts |
| `hub/src/hooks/use-mobile.tsx` | 595 B | exports: useIsMobile | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/hooks/use-mobile.tsx |
| `hub/src/integrations/supabase/client.ts` | 2.3 KB | exports: SUPABASE_URL, BRIDGE_URL, BRIDGE_KEY, carbonBridge, carbonQuery, carbonInsert | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/integrations/supabase/client.ts |
| `hub/src/lib/ecmdBootPrompt.ts` | 26.1 KB | exports: ECMD_SIDEBAR_BOOT_PROMPT | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/lib/ecmdBootPrompt.ts |
| `hub/src/lib/ecmdLiveComponentTelemetry.ts` | 35.0 KB | exports: ALLOWED_PLASMIC_TOKEN_TYPES, AllowedPlasmicTokenType, RuntimeErrorEntry, RuntimeErrorsStore, EcmdRegisteredComponentMeta, ECMD_REGISTERED_COMPONENTS | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/lib/ecmdLiveComponentTelemetry.ts |
| `hub/src/lib/ecmdPackageMatcher.ts` | 18.6 KB | exports: PackageLevelName, PackageDetailType, PackageScopeKey, PackageSubCategory, EcmdVehicleKey, EcmdServicePackageRow | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/lib/ecmdPackageMatcher.ts |
| `hub/src/lib/ecmdRootSizing.ts` | 3.9 KB | exports: ECMD_ROOT_SIZING_STYLE_ID, ECMD_ROOT_SIZING_CSS, ensureEcmdRootSizingStyles | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/lib/ecmdRootSizing.ts |
| `hub/src/lib/ecmdRuntimeBoot.ts` | 336 B | Code module | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/lib/ecmdRuntimeBoot.ts |
| `hub/src/lib/ecmdThemeEngine.ts` | 139.7 KB | exports: ECMD_THEME_ASSETS_BUCKET, ThemeImageObjectFit, ThemeImageVariantConfig, ThemeImageGroup, DEFAULT_THEME_PALETTE_KEYS, DEFAULT_THEME_IMAGE_CLASS_TOKENS | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/lib/ecmdThemeEngine.ts |
| `hub/src/lib/error-capture.ts` | 2.9 KB | exports: describeError, consumeLastCapturedError | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/lib/error-capture.ts |
| `hub/src/lib/error-page.ts` | 1.4 KB | exports: renderErrorPage | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/lib/error-page.ts |
| `hub/src/lib/lovable-error-reporting.ts` | 2.2 KB | exports: reportLovableError | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/lib/lovable-error-reporting.ts |
| `hub/src/lib/mediaCms.ts` | 996 B | exports: DEFAULT_LOGO_PATH, getMediaUrl | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/lib/mediaCms.ts |
| `hub/src/lib/useEcmdBreakpoint.ts` | 10.7 KB | exports: EcmdViewportMode, EcmdBreakpointState, getViewportWidthPx, classifyBreakpointFromWidth, computeEcmdBreakpointState, useEcmdBreakpoint | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/lib/useEcmdBreakpoint.ts |
| `hub/src/lib/utils.ts` | 175 B | exports: cn | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/lib/utils.ts |
| `hub/src/pages/ecmd-brain.tsx` | 1.1 KB | exports: EcmdBrainLive | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/pages/ecmd-brain.tsx |
| `hub/src/pages/EcmdBrainLive.tsx` | 1.1 KB | exports: EcmdBrainLive | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/pages/EcmdBrainLive.tsx |
| `hub/src/pages/Errors.tsx` | 42.6 KB | exports: UnifiedErrorsPayload, Errors | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/pages/Errors.tsx |
| `hub/src/pages/Homepage.tsx` | 3.5 KB | exports: Homepage | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/pages/Homepage.tsx |
| `hub/src/pages/PlasmicHost.tsx` | 446 B | exports: PlasmicHostPage | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/pages/PlasmicHost.tsx |
| `hub/src/pages/Workflow.tsx` | 21.5 KB | exports: Workflow | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/pages/Workflow.tsx |
| `hub/src/plasmic-init.ts` | 85.7 KB | exports: PLASMIC | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/plasmic-init.ts |
| `hub/src/router.tsx` | 631 B | exports: getRouter | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/router.tsx |
| `hub/src/routes/__root.tsx` | 8.9 KB | exports: Route | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/routes/__root.tsx |
| `hub/src/routes/errors.tsx` | 169 B | exports: Route | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/routes/errors.tsx |
| `hub/src/routes/index.tsx` | 178 B | exports: Route | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/routes/index.tsx |
| `hub/src/routes/plasmic-host.tsx` | 434 B | exports: Route | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/routes/plasmic-host.tsx |
| `hub/src/routes/README.md` | 856 B | Doc: Routes | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/routes/README.md |
| `hub/src/routes/workflow.tsx` | 186 B | exports: Route | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/routes/workflow.tsx |
| `hub/src/routeTree.gen.ts` | 3.6 KB | exports: FileRoutesByFullPath, FileRoutesByTo, FileRoutesById, FileRouteTypes, RootRouteChildren, routeTree | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/routeTree.gen.ts |
| `hub/src/server.ts` | 2.3 KB | exports: getServerEntry, normalizeCatastrophicSsrResponse, isH3SwallowedErrorBody | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/server.ts |
| `hub/src/start.ts` | 1.4 KB | exports: startInstance | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/start.ts |
| `hub/src/styles/brushedSteelButton.css` | 5.7 KB | Stylesheet | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/styles/brushedSteelButton.css |
| `hub/src/styles.css` | 6.7 KB | Stylesheet | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/styles.css |
| `hub/src/telemetryData.ts` | 124 B | exports: LIVE_SNAP | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/telemetryData.ts |
| `hub/src/test/app-routing.test.tsx` | 1.3 KB | Vitest automated test suite | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/app-routing.test.tsx |
| `hub/src/test/brushed-steel-button.test.tsx` | 14.1 KB | Vitest automated test suite | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/brushed-steel-button.test.tsx |
| `hub/src/test/ecmd-cart-summary-bar.test.tsx` | 8.2 KB | Vitest automated test suite | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/ecmd-cart-summary-bar.test.tsx |
| `hub/src/test/ecmd-telemetry-breakpoint.test.tsx` | 23.2 KB | exports: setViewportWidth, BreakpointProbe | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/ecmd-telemetry-breakpoint.test.tsx |
| `hub/src/test/EcmdWhatsIncludedItemPopup.test.tsx` | 11.3 KB | Vitest automated test suite | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/EcmdWhatsIncludedItemPopup.test.tsx |
| `hub/src/test/errors-page.test.tsx` | 5.3 KB | Vitest automated test suite | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/errors-page.test.tsx |
| `hub/src/test/media-cms.test.ts` | 1.8 KB | Vitest automated test suite | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/media-cms.test.ts |
| `hub/src/test/packages-matrix-engine.test.tsx` | 16.6 KB | exports: StudioCardTemplate | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/packages-matrix-engine.test.tsx |
| `hub/src/test/packages-repeater.test.tsx` | 11.8 KB | Vitest automated test suite | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/packages-repeater.test.tsx |
| `hub/src/test/plasmic-controllers.test.tsx` | 53.4 KB | Vitest automated test suite | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/plasmic-controllers.test.tsx |
| `hub/src/test/plasmic-host-boot.test.tsx` | 10.3 KB | Vitest automated test suite | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/plasmic-host-boot.test.tsx |
| `hub/src/test/plasmic-init-styles.test.ts` | 9.4 KB | exports: ALLOWED_PLASMIC_STYLE_KEYS | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/plasmic-init-styles.test.ts |
| `hub/src/test/saved-vehicle-dropdown.test.tsx` | 16.1 KB | exports: SlotInspector | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/saved-vehicle-dropdown.test.tsx |
| `hub/src/test/setup.ts` | 1.6 KB | Vitest automated test suite | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/setup.ts |
| `hub/src/test/side-menu.test.tsx` | 4.8 KB | Vitest automated test suite | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/side-menu.test.tsx |
| `hub/src/test/theme-border-controls.test.tsx` | 12.5 KB | Vitest automated test suite | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/theme-border-controls.test.tsx |
| `hub/src/test/theme-copy-attributes.test.tsx` | 20.3 KB | Vitest automated test suite | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/theme-copy-attributes.test.tsx |
| `hub/src/test/theme-design-tokens.test.tsx` | 15.2 KB | Vitest automated test suite | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/theme-design-tokens.test.tsx |
| `hub/src/test/theme-gradient-studio.test.tsx` | 11.5 KB | exports: Harness | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/theme-gradient-studio.test.tsx |
| `hub/src/test/theme-image-groups.test.tsx` | 12.5 KB | Vitest automated test suite | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/theme-image-groups.test.tsx |
| `hub/src/test/theme-live-state-preview.test.tsx` | 14.5 KB | exports: InspectorHarness | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/theme-live-state-preview.test.tsx |
| `hub/src/test/theme-scale-navigation.test.tsx` | 12.2 KB | exports: Harness | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/theme-scale-navigation.test.tsx |
| `hub/src/test/theme-text-shadow.test.tsx` | 13.8 KB | Vitest automated test suite | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/theme-text-shadow.test.tsx |
| `hub/src/test/whats-included-modal.test.tsx` | 17.9 KB | Vitest automated test suite | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/whats-included-modal.test.tsx |
| `hub/src/test/wix-vault.test.ts` | 1.6 KB | Vitest automated test suite | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/test/wix-vault.test.ts |
| `hub/src/utils/ecmdDeviceEnv.ts` | 4.5 KB | exports: EcmdEcosystem, EcmdOS, EcmdBrowser, EcmdDeviceProfile, detectEcmdDeviceProfile, applyDeviceAttributesToDom | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/src/utils/ecmdDeviceEnv.ts |
| `hub/supabase/functions/ecmd-dev-gateway/index.ts` | 2.8 KB | Code module | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/supabase/functions/ecmd-dev-gateway/index.ts |
| `hub/tsconfig.json` | 918 B | TypeScript configuration | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/tsconfig.json |
| `hub/vite.config.ts` | 16.9 KB | exports: LIVE_SNAP | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/vite.config.ts |
| `hub/vitest.config.ts` | 412 B | Code module | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/hub/vitest.config.ts |

## Files: `runner/` (114)
| Path | Size | Exports / Purpose | Raw GitHub URL |
|---|---:|---|---|
| `runner/.eslintrc.json` | 50 B | JSON data / config | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/.eslintrc.json |
| `runner/.github/workflows/ai-code-agent.yml` | 6.2 KB | GitHub Actions / YAML workflow | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/.github/workflows/ai-code-agent.yml |
| `runner/.github/workflows/supabase-deploy.yml` | 1018 B | GitHub Actions / YAML workflow | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/.github/workflows/supabase-deploy.yml |
| `runner/.github/workflows/sync-brain.yml` | 156 B | GitHub Actions / YAML workflow | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/.github/workflows/sync-brain.yml |
| `runner/.github/workflows/wix-publish.yml` | 1.1 KB | GitHub Actions / YAML workflow | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/.github/workflows/wix-publish.yml |
| `runner/.gitignore` | 71 B | Text/config file | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/.gitignore |
| `runner/BRAIN_SNAPSHOT.md` | 215 B | Markdown documentation | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/BRAIN_SNAPSHOT.md |
| `runner/bridge_ui.html` | 18.3 KB | HTML template / console | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/bridge_ui.html |
| `runner/carbon4-hydration-manifest.json` | 655 B | JSON data / config | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/carbon4-hydration-manifest.json |
| `runner/cloudflare-proxy/worker.js` | 608 B | Code module | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/cloudflare-proxy/worker.js |
| `runner/cloudflare-proxy/wrangler.toml` | 147 B | Text/config file | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/cloudflare-proxy/wrangler.toml |
| `runner/console.html` | 55.5 KB | HTML template / console | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/console.html |
| `runner/dependencies-metadata.json` | 163 B | JSON data / config | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/dependencies-metadata.json |
| `runner/ECMD_CARBON4_SKILL.txt` | 2.1 KB | Text/config file | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/ECMD_CARBON4_SKILL.txt |
| `runner/ecmd-console/.github/workflows/sync-brain-snapshot.yml` | 2.5 KB | GitHub Actions / YAML workflow | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/ecmd-console/.github/workflows/sync-brain-snapshot.yml |
| `runner/ecmd-console/brain-snapshot.html` | 628.9 KB | HTML template / console | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/ecmd-console/brain-snapshot.html |
| `runner/ecmd-console/carbon-mirror.json` | 1.2 KB | JSON data / config | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/ecmd-console/carbon-mirror.json |
| `runner/ecmd-console/index.html` | 56.5 KB | HTML template / console | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/ecmd-console/index.html |
| `runner/ecmd-console/README.md` | 102 B | Doc: ecmd-console | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/ecmd-console/README.md |
| `runner/EcmdHelpers.ps1` | 1.5 KB | PowerShell automation script | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/EcmdHelpers.ps1 |
| `runner/GEMINI.md` | 5.5 KB | Doc: ECMD Autonomous Engineering Protocol (C:\ECMD — PEN v4.2 / Antigravity `agy | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/GEMINI.md |
| `runner/Invoke-EcmdProtocol.ps1` | 405 B | PowerShell automation script | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/Invoke-EcmdProtocol.ps1 |
| `runner/package.json` | 400 B | Package manifest & scripts | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/package.json |
| `runner/README.md` | 4.0 KB | Doc: Git Integration & Wix CLI <img align="left" src="https://user-images.github | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/README.md |
| `runner/scripts/fix-plasmic-css.cjs` | 1.3 KB | ECMD automation/PEN runner script | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/scripts/fix-plasmic-css.cjs |
| `runner/scripts/import-wix-csvs.mjs` | 29.7 KB | exports: parseCsv | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/scripts/import-wix-csvs.mjs |
| `runner/scripts/run-pen-task.mjs` | 12.0 KB | ECMD automation/PEN runner script | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/scripts/run-pen-task.mjs |
| `runner/scripts/Start-EcmdCliBridge.ps1` | 2.2 KB | PowerShell automation script | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/scripts/Start-EcmdCliBridge.ps1 |
| `runner/scripts/Start-EcmdDriveWorker.ps1` | 2.1 KB | PowerShell automation script | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/scripts/Start-EcmdDriveWorker.ps1 |
| `runner/scripts/Start-EcmdPen.ps1` | 1.1 KB | PowerShell automation script | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/scripts/Start-EcmdPen.ps1 |
| `runner/scripts/sync-ai-mirror.mjs` | 44.9 KB | exports: scrubSecrets, extractLocalBridgeSecret, isEnvFile, isBinaryBuffer, ensureDir | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/scripts/sync-ai-mirror.mjs |
| `runner/scripts/trim-gemini-md.cjs` | 411 B | ECMD automation/PEN runner script | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/scripts/trim-gemini-md.cjs |
| `runner/scripts/wix-auto-publish.js` | 625 B | ECMD automation/PEN runner script | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/scripts/wix-auto-publish.js |
| `runner/src/backend/admin-tools.web.js` | 2.8 KB | exports: registerCustomerFromHQ | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/admin-tools.web.js |
| `runner/src/backend/aiBrain.web.js` | 7.3 KB | exports: logTelemetryToSupabase, searchBrain, askEcmdBrain, fetchSupabaseCrmBundle, syncWixCrmToSupabase, pushCrmRecordToSupabase | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/aiBrain.web.js |
| `runner/src/backend/authBackend.jsw` | 1.1 KB | exports: verifyEmailInDB | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/authBackend.jsw |
| `runner/src/backend/braintreeEngine.jsw` | 2.7 KB | exports: generateClientToken, processBraintreePayment | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/braintreeEngine.jsw |
| `runner/src/backend/calendar-dispatcher.web.js` | 9.2 KB | exports: scheduleDetailingJob, updateOrRestoreDetailingJob, broadcastCalendarUpdate, deleteGoogleEvent | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/calendar-dispatcher.web.js |
| `runner/src/backend/calendarTasks.js` | 1.6 KB | exports: releaseAbandonedTimeSlots | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/calendarTasks.js |
| `runner/src/backend/data.js` | 18.8 KB | exports: resolveServiceTimezone | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/data.js |
| `runner/src/backend/dataMigration.jsw` | 3.1 KB | exports: migrateVehicleDataToJobs | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/dataMigration.jsw |
| `runner/src/backend/detailerScheduleClean.jsw` | 1.2 KB | exports: deleteExpiredRules | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/detailerScheduleClean.jsw |
| `runner/src/backend/emailDispatchEngine.jsw` | 14.5 KB | exports: sendWelcomeEmail, sendMasterTransactionalEmail | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/emailDispatchEngine.jsw |
| `runner/src/backend/geminiAssistant.web.js` | 7.2 KB | exports: getAvailableGeminiModels, askHqCopilot, saveBlueprintToCms, getBlueprintFromCms, bulkSaveBlueprintsToCms, buildExternalGeminiBridgePacket | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/geminiAssistant.web.js |
| `runner/src/backend/googleMaps.jsw` | 2.4 KB | exports: getDrivingETA | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/googleMaps.jsw |
| `runner/src/backend/googleReviews.jsw` | 2.0 KB | exports: getReviewStats | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/googleReviews.jsw |
| `runner/src/backend/http-functions.js` | 8.0 KB | exports: post_twilioWebhook, get_geminiBridge, post_geminiBridge, get_ecmdConsole | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/http-functions.js |
| `runner/src/backend/jobs.config` | 596 B | Text/config file | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/jobs.config |
| `runner/src/backend/permissions.json` | 257 B | JSON data / config | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/permissions.json |
| `runner/src/backend/README.md` | 4.9 KB | Doc: The Backend Code Folder | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/README.md |
| `runner/src/backend/securityActions.jsw` | 1.3 KB | exports: adminDeleteAccount, updateUserLoginEmail | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/securityActions.jsw |
| `runner/src/backend/stripeEngine.jsw` | 3.3 KB | exports: createPaymentIntent, chargeSavedCard | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/stripeEngine.jsw |
| `runner/src/backend/testDispatch.jsw` | 1.1 KB | exports: triggerDummyReceipt | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/testDispatch.jsw |
| `runner/src/backend/twilioProxy.jsw` | 4.2 KB | exports: rewriteTextWithGemini, sendTwilioSMS, logMessageToJob | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/twilioProxy.jsw |
| `runner/src/backend/vehicleClassifier.web.js` | 13.3 KB | exports: verifyVehicleType, auditAndSyncUpcomingJobs | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/backend/vehicleClassifier.web.js |
| `runner/src/pages/account.a9k07.js` | 6.7 KB | Wix Velo legacy page controller | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/pages/account.a9k07.js |
| `runner/src/pages/Blank.sss70.js` | 0 B | Wix Velo legacy page controller | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/pages/Blank.sss70.js |
| `runner/src/pages/Booking HQ.k657b.js` | 2.3 KB | Wix Velo legacy page controller | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/pages/Booking%20HQ.k657b.js |
| `runner/src/pages/checkout.qpi7b.js` | 11.5 KB | Wix Velo legacy page controller | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/pages/checkout.qpi7b.js |
| `runner/src/pages/Confirmation.f7bn3.js` | 2.8 KB | Wix Velo legacy page controller | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/pages/Confirmation.f7bn3.js |
| `runner/src/pages/Detailer Portal.k61r5.js` | 2.4 KB | Wix Velo legacy page controller | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/pages/Detailer%20Portal.k61r5.js |
| `runner/src/pages/Extra.c1dmp.js` | 333 B | Wix Velo legacy page controller | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/pages/Extra.c1dmp.js |
| `runner/src/pages/Home.s4vq4.js` | 0 B | Wix Velo legacy page controller | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/pages/Home.s4vq4.js |
| `runner/src/pages/masterPage.js` | 5.0 KB | exports: shouldRunBlueprintMapper | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/pages/masterPage.js |
| `runner/src/pages/packages.kujb1.js` | 6.1 KB | Wix Velo legacy page controller | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/pages/packages.kujb1.js |
| `runner/src/pages/payment.cr0ig.js` | 2.5 KB | Wix Velo legacy page controller | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/pages/payment.cr0ig.js |
| `runner/src/pages/privacy policy.kgmav.js` | 1.3 KB | Wix Velo legacy page controller | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/pages/privacy%20policy.kgmav.js |
| `runner/src/pages/README.md` | 2.2 KB | Doc: The Page Code Folder | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/pages/README.md |
| `runner/src/pages/register.mjuyh.js` | 1.6 KB | Wix Velo legacy page controller | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/pages/register.mjuyh.js |
| `runner/src/pages/terms of service.j02j1.js` | 1023 B | Wix Velo legacy page controller | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/pages/terms%20of%20service.j02j1.js |
| `runner/src/public/aiTelemetry.js` | 89.2 KB | exports: aiTelemetry, registerModuleState, registerModuleFunctions, registerDomElements, buildAllModulesSnapshot, scanLivePageDOM | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/aiTelemetry.js |
| `runner/src/public/animationsEngine.js` | 3.8 KB | exports: hideAndCollapseUp, expandAndShowDown, applyTextOrHighlight | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/animationsEngine.js |
| `runner/src/public/authEngine.js` | 20.0 KB | exports: initAuthEngine, getActiveUserId | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/authEngine.js |
| `runner/src/public/calendarEngine.js` | 75.5 KB | exports: initDetailerDropdown, initCalendarEngine, updateCalendarQueueText | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/calendarEngine.js |
| `runner/src/public/cartEngine.js` | 19.9 KB | exports: getOrdinalSuffix, formatPhoneNumber, buildCalendarDates, getDetailerTimeOff, calculateNextAvailableDate, buildWeeklyDataArray | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/cartEngine.js |
| `runner/src/public/cartUIEngine.js` | 49.6 KB | exports: clearBreadcrumb, initCartUIEngine, syncCartData, bootBatchMode | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/cartUIEngine.js |
| `runner/src/public/cartWidget.js` | 2.8 KB | exports: spinCartBubble | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/cartWidget.js |
| `runner/src/public/custom-elements/footer-tracker.js` | 5.4 KB | Wix Velo legacy client engine | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/custom-elements/footer-tracker.js |
| `runner/src/public/custom-elements/height-tracker.js` | 1.1 KB | Wix Velo legacy client engine | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/custom-elements/height-tracker.js |
| `runner/src/public/custom-elements/stripeWallet.js` | 5.1 KB | Wix Velo legacy client engine | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/custom-elements/stripeWallet.js |
| `runner/src/public/custom-elements/title-tracker.js` | 980 B | Wix Velo legacy client engine | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/custom-elements/title-tracker.js |
| `runner/src/public/detailerPortal.js` | 67.3 KB | exports: initDetailerPortal | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/detailerPortal.js |
| `runner/src/public/fileCartEdits.js` | 34.0 KB | exports: initCartEdits, syncCartEditsDependencies, startCartEditsFlow, restoreCartEditsVaultIfNeeded | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/fileCartEdits.js |
| `runner/src/public/fileContactLocation.js` | 33.3 KB | exports: initContactLocationEngine, fetchContactLocationData, syncContactLocationData, initProfileAddressesEngine | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/fileContactLocation.js |
| `runner/src/public/fileDetailInfo.js` | 42.7 KB | exports: initDetailInfoEngine, syncDetailJobs, triggerSavedJobClick | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/fileDetailInfo.js |
| `runner/src/public/fileLoginSecurity.js` | 16.9 KB | exports: initLoginSecurityEngine, loadSecurityData, loadDynamicInputUI | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/fileLoginSecurity.js |
| `runner/src/public/filePackageEdits.js` | 22.4 KB | exports: initPackageEditEngine, loadPackageEditMode | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/filePackageEdits.js |
| `runner/src/public/filePaymentPortal.js` | 65.3 KB | exports: initPaymentPortalEngine, loadPaymentPortalData, resetPaymentPortal, selectJobInPortal | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/filePaymentPortal.js |
| `runner/src/public/fileSiteMenu.js` | 6.9 KB | exports: initSiteMenuEngine | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/fileSiteMenu.js |
| `runner/src/public/fileSummary.js` | 26.6 KB | exports: initSummaryEngine, syncSummaryData, setSelectedSummaryVehicle, startSummaryEditFlow, updateSummary | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/fileSummary.js |
| `runner/src/public/fileVehicleAdd.js` | 29.3 KB | exports: initVehicleAddEngine, syncVehicleCategories, getEditingVehicleId, setEditingVehicleId | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/fileVehicleAdd.js |
| `runner/src/public/fileWhatsIncluded.js` | 15.0 KB | exports: initWhatsIncludedEngine, openWhatsIncludedPopup | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/fileWhatsIncluded.js |
| `runner/src/public/fileWhatsIncludedG.js` | 4.9 KB | exports: initWhatsIncludedGEngine, openDetailedWiPopup | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/fileWhatsIncludedG.js |
| `runner/src/public/garageEngine.js` | 19.0 KB | exports: initGarageEngine, loadGarageData, refreshSelectionUI, applyVehicleFilter | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/garageEngine.js |
| `runner/src/public/headerEngine.js` | 8.1 KB | exports: initHeaderEngine | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/headerEngine.js |
| `runner/src/public/hqBookingEngine.js` | 25.7 KB | exports: refreshCartUI, initBookingHQEngine | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/hqBookingEngine.js |
| `runner/src/public/hqCalendar.js` | 42.7 KB | exports: initCalendarButtons, getJobsAndCorrectionsForDate, buildWeeklyDataArray, paintWeeklyCalendarUI, generateWeeklyCalendar, appendMoreWeeks | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/hqCalendar.js |
| `runner/src/public/hqCustomerForms.js` | 56.1 KB | exports: searchCustomerByPhone, loadCustomerForExistingJob, loadCustomerDropdowns, resetCustomerDropdowns, attachCustomerToActiveCartItem | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/hqCustomerForms.js |
| `runner/src/public/hqDetailBuilder.js` | 53.2 KB | exports: loadNewDetailOptions, syncHqPackagesToVehicle, paintSummaryBox | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/hqDetailBuilder.js |
| `runner/src/public/hqOfficeAndCorrections.js` | 44.1 KB | exports: padPreviousJobsList, formatPrevDateText, renderPreviousJobSummary, syncPreviousRepButtons, initPreviousCustomerJobsRepeater, loadCustomerHistory | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/hqOfficeAndCorrections.js |
| `runner/src/public/hqState.js` | 11.1 KB | exports: createEmptyDraft, hqState, getMountainDateString, parseTags, parseSummaryTags, formatPrevPackageAbbrev | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/hqState.js |
| `runner/src/public/hqTabsAndCart.js` | 38.7 KB | exports: formatDynamicTabLabel, syncTabMenuButtonLabel, closeTabAndCalendarMenus, createNewTab, switchTab | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/hqTabsAndCart.js |
| `runner/src/public/loggerConfig.js` | 2.0 KB | exports: APP_LOGS, flagModuleForExtensiveLogs, createSmartLogger | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/loggerConfig.js |
| `runner/src/public/packageMatcher.js` | 4.2 KB | exports: normalizeToPackageSubCategory, extractLevelAndType, findMatchingServicePackage | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/packageMatcher.js |
| `runner/src/public/packagesEngine.js` | 24.9 KB | exports: clearActivePackageMemory, clearCustomVehicleDropdown, syncPackagesVehicles | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/packagesEngine.js |
| `runner/src/public/profileEngine.js` | 9.8 KB | exports: initProfileEngine, preloadAllProfileData, initProfileSubscriptionsEngine, executeFullAccountDeletion, initAccountDeletionEngine, initProfileButtonsRepeater | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/profileEngine.js |
| `runner/src/public/README.md` | 815 B | Doc: The Public Code Folder | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/README.md |
| `runner/src/public/repeaterEngine.js` | 4.0 KB | exports: registerRepeater, repaintSingleItem, smartSyncRepeater | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/repeaterEngine.js |
| `runner/src/public/reviewWidget.js` | 3.0 KB | exports: activateReviewWidget | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/reviewWidget.js |
| `runner/src/public/routerEngine.js` | 51.8 KB | exports: executePreRouteLogic | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/routerEngine.js |
| `runner/src/public/siteBlueprintMapper.js` | 5.8 KB | exports: captureFullPageBlueprint | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/siteBlueprintMapper.js |
| `runner/src/public/stateManager.js` | 10.6 KB | exports: getInstantCache, setInstantCache, getMemoryState, getCatalogData, getVehicleCategories, syncGlobalCartBadge | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/public/stateManager.js |
| `runner/src/styles/global.css` | 5.2 KB | Stylesheet | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/src/styles/global.css |
| `runner/wix.config.json` | 82 B | JSON data / config | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/runner/wix.config.json |

## Files: `supabase-mirror/` (29)
| Path | Size | Exports / Purpose | Raw GitHub URL |
|---|---:|---|---|
| `supabase-mirror/edge-functions/deployed_functions.json` | 767 B | Supabase Edge Functions registry & endpoint metadata | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/edge-functions/deployed_functions.json |
| `supabase-mirror/edge-functions/ecmd-dev-gateway/index.ts` | 2.8 KB | Supabase Edge Function source | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/edge-functions/ecmd-dev-gateway/index.ts |
| `supabase-mirror/schema/schema_overview.sql` | 50.0 KB | Supabase public schema DDL, RLS policies, triggers & custom functions | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/schema/schema_overview.sql |
| `supabase-mirror/schema/tables_and_columns.json` | 281.5 KB | Supabase public tables, columns, constraints, policies & functions JSON | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/schema/tables_and_columns.json |
| `supabase-mirror/tables/ecmd_advanced_suggestions.json` | 47.1 KB | Supabase public.ecmd_advanced_suggestions table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_advanced_suggestions.json |
| `supabase-mirror/tables/ecmd_ai_registry.json` | 37.6 KB | Supabase public.ecmd_ai_registry table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_ai_registry.json |
| `supabase-mirror/tables/ecmd_brain.json` | 674.8 KB | Supabase public.ecmd_brain table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_brain.json |
| `supabase-mirror/tables/ecmd_diagnostic_runs.json` | 662 B | Supabase public.ecmd_diagnostic_runs table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_diagnostic_runs.json |
| `supabase-mirror/tables/ecmd_external_ai_cms.json` | 88.5 KB | Supabase public.ecmd_external_ai_cms table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_external_ai_cms.json |
| `supabase-mirror/tables/ecmd_packages.json` | 3.1 KB | Supabase public.ecmd_packages table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_packages.json |
| `supabase-mirror/tables/ecmd_pen_turns.json` | 415.2 KB | Supabase public.ecmd_pen_turns table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_pen_turns.json |
| `supabase-mirror/tables/ecmd_plasmic_hydration.json` | 10.4 KB | Supabase public.ecmd_plasmic_hydration table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_plasmic_hydration.json |
| `supabase-mirror/tables/ecmd_service_packages.json` | 146.5 KB | Supabase public.ecmd_service_packages table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_service_packages.json |
| `supabase-mirror/tables/ecmd_site_blueprints.json` | 3.02 MB | Supabase public.ecmd_site_blueprints table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_site_blueprints.json |
| `supabase-mirror/tables/ecmd_site_menu_buttons.json` | 9.2 KB | Supabase public.ecmd_site_menu_buttons table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_site_menu_buttons.json |
| `supabase-mirror/tables/ecmd_whats_included.json` | 300.0 KB | Supabase public.ecmd_whats_included table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_whats_included.json |
| `supabase-mirror/tables/ecmd_wix_ai_brain_master_index.json` | 14.0 KB | Supabase public.ecmd_wix_ai_brain_master_index table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_ai_brain_master_index.json |
| `supabase-mirror/tables/ecmd_wix_ai_capabilities_rules.json` | 36.8 KB | Supabase public.ecmd_wix_ai_capabilities_rules table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_ai_capabilities_rules.json |
| `supabase-mirror/tables/ecmd_wix_ai_persona_response_rules.json` | 13.2 KB | Supabase public.ecmd_wix_ai_persona_response_rules table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_ai_persona_response_rules.json |
| `supabase-mirror/tables/ecmd_wix_availability_rules.json` | 5.4 KB | Supabase public.ecmd_wix_availability_rules table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_availability_rules.json |
| `supabase-mirror/tables/ecmd_wix_calendar_time_slots.json` | 2.9 KB | Supabase public.ecmd_wix_calendar_time_slots table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_calendar_time_slots.json |
| `supabase-mirror/tables/ecmd_wix_code_and_blueprints.json` | 647.6 KB | Supabase public.ecmd_wix_code_and_blueprints table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_code_and_blueprints.json |
| `supabase-mirror/tables/ecmd_wix_discounts.json` | 825 B | Supabase public.ecmd_wix_discounts table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_discounts.json |
| `supabase-mirror/tables/ecmd_wix_global_settings.json` | 828 B | Supabase public.ecmd_wix_global_settings table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_global_settings.json |
| `supabase-mirror/tables/ecmd_wix_legacy_vault.json` | 2.02 MB | Supabase public.ecmd_wix_legacy_vault table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_legacy_vault.json |
| `supabase-mirror/tables/ecmd_wix_profile_buttons.json` | 146 B | Supabase public.ecmd_wix_profile_buttons table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_profile_buttons.json |
| `supabase-mirror/tables/ecmd_wix_promo_codes.json` | 142 B | Supabase public.ecmd_wix_promo_codes table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_promo_codes.json |
| `supabase-mirror/tables/ecmd_wix_site_buttons.json` | 89.3 KB | Supabase public.ecmd_wix_site_buttons table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_site_buttons.json |
| `supabase-mirror/tables/ecmd_wix_vehicle_categories.json` | 10.7 KB | Supabase public.ecmd_wix_vehicle_categories table snapshot (scrubbed) | https://raw.githubusercontent.com/mlhammes2/ecmd-ai-mirror/main/supabase-mirror/tables/ecmd_wix_vehicle_categories.json |
