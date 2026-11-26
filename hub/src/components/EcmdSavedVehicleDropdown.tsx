import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { DataProvider } from "@plasmicapp/loader-react";
import { carbonQuery } from "../integrations/supabase/client";
import { ensureEcmdRootSizingStyles } from "../lib/ecmdRootSizing";
import { useEcmdBreakpoint } from "../lib/useEcmdBreakpoint";
import {
  getVehicleKeyDisplayLabel,
  mapSubCategoryToVehicleKey,
  mapVehicleKeyToSubCategory,
  normalizeToPackageSubCategory,
  type EcmdVehicleKey,
  type PackageSubCategory,
} from "../lib/ecmdPackageMatcher";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Wix `packagesEngine.js` parity constants
export const DROPDOWN_INTRO_LABEL = "Select Your Vehicle...";
export const LOCKED_TYPE_ERROR_TEXT = "Clear your selected vehicle to browse other vehicle types.";
export const ERROR_DURATION_MS = 3200;
export const BROWSE_WITHOUT_VEHICLE_LABEL = "Browse Without a Vehicle";
export const ADD_NEW_VEHICLE_LABEL = "+ Add New Vehicle";
export const SELECTED_SUMMARY_VEHICLE_STORAGE_KEY = "ecmd_selected_summary_vehicle_id";
export const SELECTED_VEHICLE_STORAGE_KEY = "ecmd_selected_vehicle";

export interface EcmdSavedVehicleRecord {
  _id?: string | null;
  id?: string | number | null;
  wix_id?: string | null;
  year?: string | number | null;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  vehicleType?: string | null;
  vehicle_type?: string | null;
  subCategory?: string | null;
  sub_category?: string | null;
  vehicle_category?: string | null;
  archived?: boolean | null;
  [key: string]: any;
}

export type EcmdVehicleDropdownActionType = "NONE" | "VEHICLE" | "ADD_NEW";

export interface EcmdVehicleDropdownItem {
  _id: string;
  actionType: EcmdVehicleDropdownActionType;
  label: string;
  vehicleObj?: EcmdSavedVehicleRecord;
}

export interface EcmdAppliedVehicleSelection {
  vehicleId: string;
  vehicleKey: EcmdVehicleKey;
  subCategory: PackageSubCategory;
  label: string;
  vehicle: EcmdSavedVehicleRecord;
}

export interface EcmdSavedVehicleContext {
  selectedVehicle: EcmdSavedVehicleRecord | null;
  selectedVehicleId: string | null;
  label: string;
  vehicleKey: EcmdVehicleKey | null;
  subCategory: PackageSubCategory | null;
  isOpen: boolean;
  isLocked: boolean;
  isErrorVisible: boolean;
  errorText: string;
  vehiclesCount: number;
}

export interface EcmdSavedVehicleDropdownProps {
  className?: string;
  style?: React.CSSProperties;
  vehicles?: EcmdSavedVehicleRecord[];
  selectedVehicleId?: string | null;
  defaultOpen?: boolean;
  introLabel?: string;
  browseWithoutLabel?: string;
  addNewLabel?: string;
  lockedErrorText?: string;
  errorDurationMs?: number;
  previewLockedError?: boolean;
  autoLoadFromSupabase?: boolean;
  userId?: string;
  themeGroup?: string;
  menuThemeGroup?: string;
  onVehicleSelect?: (
    vehicle: EcmdSavedVehicleRecord | null,
    meta: { vehicleKey: EcmdVehicleKey; subCategory: PackageSubCategory; label: string } | null
  ) => void;
  onClearVehicle?: () => void;
  onAddNewVehicle?: () => void;
  onLockedFeedback?: (message: string) => void;
}

function SafePlasmicDataProvider({
  name,
  data,
  children,
}: {
  name: string;
  data: any;
  children?: React.ReactNode;
}) {
  if (typeof DataProvider === "function") {
    return (
      <DataProvider name={name} data={data}>
        {children}
      </DataProvider>
    );
  }
  return <>{children}</>;
}

export function getSavedVehicleId(veh?: EcmdSavedVehicleRecord | null): string {
  if (!veh) return "";
  return String(veh._id ?? veh.id ?? veh.wix_id ?? "").trim();
}

export function getSavedVehicleRawType(veh?: EcmdSavedVehicleRecord | null): string {
  if (!veh) return "";
  return String(
    veh.vehicleType ??
      veh.vehicle_type ??
      veh.subCategory ??
      veh.sub_category ??
      ""
  ).trim();
}

/**
 * Wix `packagesEngine.js` parity: formats `${year} ${make} ${model} ${color} (${subCat})`.
 */
export function formatVehicleDropdownLabel(
  veh?: EcmdSavedVehicleRecord | null,
  introLabel: string = DROPDOWN_INTRO_LABEL
): string {
  if (!veh) return introLabel;
  const subCat =
    normalizeToPackageSubCategory(getSavedVehicleRawType(veh) || "Sedan") || "Sedan";
  const baseText = `${veh.year ?? ""} ${veh.make ?? ""} ${veh.model ?? ""} ${veh.color ?? ""}`
    .replace(/\s+/g, " ")
    .trim();
  return baseText ? `${baseText} (${subCat})` : `(${subCat})`;
}

/**
 * Builds the exact `#vehicleSelectRep` items array matching Wix `syncPackagesVehicles`.
 */
export function buildSavedVehicleDropdownItems(
  vehicles: EcmdSavedVehicleRecord[] = [],
  options?: {
    browseWithoutLabel?: string;
    addNewLabel?: string;
    introLabel?: string;
  }
): EcmdVehicleDropdownItem[] {
  const list = Array.isArray(vehicles) ? vehicles.filter((v) => v && !v.archived) : [];
  const browseWithoutLabel = options?.browseWithoutLabel || BROWSE_WITHOUT_VEHICLE_LABEL;
  const addNewLabel = options?.addNewLabel || ADD_NEW_VEHICLE_LABEL;
  const introLabel = options?.introLabel || DROPDOWN_INTRO_LABEL;

  return [
    {
      _id: "veh_opt_none",
      actionType: "NONE",
      label: browseWithoutLabel,
    },
    ...list.map((v, idx) => ({
      _id: `veh_opt_${getSavedVehicleId(v) || idx}`,
      actionType: "VEHICLE" as const,
      vehicleObj: v,
      label: formatVehicleDropdownLabel(v, introLabel),
    })),
    {
      _id: "veh_opt_add",
      actionType: "ADD_NEW",
      label: addNewLabel,
    },
  ];
}

/**
 * Wix `packagesEngine.js` parity: clears the active saved vehicle, writes `"NONE"`
 * to `sessionStorage("ecmd_selected_summary_vehicle_id")`, and dispatches `ecmd-vehicle-unlock`.
 */
export function clearCustomVehicleDropdown(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SELECTED_SUMMARY_VEHICLE_STORAGE_KEY, "NONE");
  } catch {
    // Storage restriction
  }
  window.dispatchEvent(
    new CustomEvent("ecmd-vehicle-unlock", {
      detail: { source: "EcmdSavedVehicleDropdown" },
    })
  );
}

/**
 * Wix `packagesEngine.js` parity: selects a saved vehicle, persists summary vehicle ID in
 * `sessionStorage` + vehicle size key in `localStorage`, and dispatches both
 * `ecmd-vehicle-change` and `ecmd-vehicle-lock`.
 */
export function applySelectedDropdownVehicle(
  vehObj?: EcmdSavedVehicleRecord | null,
  options?: { introLabel?: string; lockedErrorText?: string }
): EcmdAppliedVehicleSelection | null {
  if (!vehObj) {
    clearCustomVehicleDropdown();
    return null;
  }

  const vehicleId = getSavedVehicleId(vehObj);
  const rawType = getSavedVehicleRawType(vehObj) || "Sedan";
  const vehicleKey: EcmdVehicleKey = mapSubCategoryToVehicleKey(rawType) || "coupe";
  const subCategory: PackageSubCategory = mapVehicleKeyToSubCategory(vehicleKey);
  const label = formatVehicleDropdownLabel(vehObj, options?.introLabel || DROPDOWN_INTRO_LABEL);
  const sizeLabel = getVehicleKeyDisplayLabel(vehicleKey);

  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(SELECTED_SUMMARY_VEHICLE_STORAGE_KEY, vehicleId || "NONE");
    } catch {
      // Storage restriction
    }
    try {
      window.localStorage.setItem(SELECTED_VEHICLE_STORAGE_KEY, vehicleKey);
    } catch {
      // Storage restriction
    }

    window.dispatchEvent(
      new CustomEvent("ecmd-vehicle-change", {
        detail: {
          vehicleKey,
          label: sizeLabel,
          subCategory,
          vehicleId,
          vehicle: vehObj,
          source: "EcmdSavedVehicleDropdown",
        },
      })
    );
    window.dispatchEvent(
      new CustomEvent("ecmd-vehicle-lock", {
        detail: {
          vehicleKey,
          subCategory,
          label,
          vehicleId,
          vehicle: vehObj,
          message: options?.lockedErrorText || LOCKED_TYPE_ERROR_TEXT,
          source: "EcmdSavedVehicleDropdown",
        },
      })
    );
  }

  return {
    vehicleId,
    vehicleKey,
    subCategory,
    label,
    vehicle: vehObj,
  };
}

/**
 * Wix `packagesEngine.js` parity: syncs saved customer vehicles into any mounted
 * `EcmdSavedVehicleDropdown` via `ecmd-sync-packages-vehicles` and returns the dropdown items.
 */
export function syncPackagesVehicles(
  vehicles: EcmdSavedVehicleRecord[] = [],
  autoSelectNewest = false
): EcmdVehicleDropdownItem[] {
  const activeVehicles = Array.isArray(vehicles) ? vehicles.filter((v) => v && !v.archived) : [];
  const items = buildSavedVehicleDropdownItems(activeVehicles);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("ecmd-sync-packages-vehicles", {
        detail: { vehicles: activeVehicles, autoSelectNewest },
      })
    );
  }

  return items;
}

export function EcmdSavedVehicleDropdown({
  className = "",
  style,
  vehicles: vehiclesProp,
  selectedVehicleId: controlledVehicleId,
  defaultOpen = false,
  introLabel = DROPDOWN_INTRO_LABEL,
  browseWithoutLabel = BROWSE_WITHOUT_VEHICLE_LABEL,
  addNewLabel = ADD_NEW_VEHICLE_LABEL,
  lockedErrorText = LOCKED_TYPE_ERROR_TEXT,
  errorDurationMs = ERROR_DURATION_MS,
  previewLockedError = false,
  autoLoadFromSupabase = false,
  userId,
  themeGroup = "ecmd-group-4",
  menuThemeGroup = "ecmd-group-3",
  onVehicleSelect,
  onClearVehicle,
  onAddNewVehicle,
  onLockedFeedback,
}: EcmdSavedVehicleDropdownProps) {
  const [vehiclesList, setVehiclesList] = useState<EcmdSavedVehicleRecord[]>(() =>
    Array.isArray(vehiclesProp) ? vehiclesProp.filter((v) => v && !v.archived) : []
  );
  const [activeVehicle, setActiveVehicle] = useState<EcmdSavedVehicleRecord | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(Boolean(defaultOpen));
  const [errorVisible, setErrorVisible] = useState<boolean>(Boolean(previewLockedError));
  const [errorMessage, setErrorMessage] = useState<string>(lockedErrorText);
  const [isPulsing, setIsPulsing] = useState<boolean>(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeVehicleRef = useRef<EcmdSavedVehicleRecord | null>(null);
  activeVehicleRef.current = activeVehicle;

  const { viewportMode } = useEcmdBreakpoint();

  useIsomorphicLayoutEffect(() => {
    ensureEcmdRootSizingStyles(rootRef.current?.ownerDocument);
  }, []);

  const stopLockedVehicleTypeFeedback = useCallback(() => {
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    setIsPulsing(false);
    setErrorVisible(Boolean(previewLockedError));
  }, [previewLockedError]);

  const triggerLockedVehicleTypeFeedback = useCallback(
    (customMessage?: string) => {
      const msg = String(customMessage || "").trim() || lockedErrorText;
      setErrorMessage(msg);
      setErrorVisible(true);
      setIsPulsing(true);
      if (onLockedFeedback) {
        onLockedFeedback(msg);
      }

      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      const duration =
        Number.isFinite(Number(errorDurationMs)) && Number(errorDurationMs) > 0
          ? Number(errorDurationMs)
          : ERROR_DURATION_MS;
      errorTimeoutRef.current = setTimeout(() => {
        errorTimeoutRef.current = null;
        setIsPulsing(false);
        setErrorVisible(Boolean(previewLockedError));
      }, duration);
    },
    [errorDurationMs, lockedErrorText, onLockedFeedback, previewLockedError]
  );

  // Cleanup error timer on unmount
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }
    };
  }, []);

  // Sync previewLockedError & lockedErrorText props
  useEffect(() => {
    setErrorMessage(lockedErrorText);
    if (previewLockedError) {
      setErrorVisible(true);
    } else if (!errorTimeoutRef.current) {
      setErrorVisible(false);
    }
  }, [previewLockedError, lockedErrorText]);

  const handleApplyVehicle = useCallback(
    (vehObj: EcmdSavedVehicleRecord | null) => {
      if (!vehObj) {
        setActiveVehicle(null);
        setIsOpen(false);
        stopLockedVehicleTypeFeedback();
        clearCustomVehicleDropdown();
        if (onClearVehicle) onClearVehicle();
        if (onVehicleSelect) onVehicleSelect(null, null);
        return;
      }

      setActiveVehicle(vehObj);
      setIsOpen(false);
      stopLockedVehicleTypeFeedback();

      const applied = applySelectedDropdownVehicle(vehObj, {
        introLabel,
        lockedErrorText,
      });

      if (applied && onVehicleSelect) {
        onVehicleSelect(vehObj, {
          vehicleKey: applied.vehicleKey,
          subCategory: applied.subCategory,
          label: applied.label,
        });
      }
    },
    [introLabel, lockedErrorText, onClearVehicle, onVehicleSelect, stopLockedVehicleTypeFeedback]
  );

  const handleClearVehicle = useCallback(() => {
    handleApplyVehicle(null);
  }, [handleApplyVehicle]);

  const handleAddNewVehicle = useCallback(() => {
    setIsOpen(false);
    stopLockedVehicleTypeFeedback();
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ecmd-open-add-vehicle-modal", {
          detail: { source: "EcmdSavedVehicleDropdown" },
        })
      );
    }
    if (onAddNewVehicle) {
      onAddNewVehicle();
    }
  }, [onAddNewVehicle, stopLockedVehicleTypeFeedback]);

  // Keep local vehiclesList synced when vehiclesProp updates
  useEffect(() => {
    if (!Array.isArray(vehiclesProp)) return;
    const filtered = vehiclesProp.filter((v) => v && !v.archived);
    setVehiclesList(filtered);

    const current = activeVehicleRef.current;
    if (current) {
      const currentId = getSavedVehicleId(current);
      const updated = filtered.find((v) => getSavedVehicleId(v) === currentId);
      if (updated) {
        setActiveVehicle(updated);
      } else if (currentId) {
        handleClearVehicle();
      }
    }
  }, [vehiclesProp, handleClearVehicle]);

  // Controlled selectedVehicleId prop
  useEffect(() => {
    if (controlledVehicleId === undefined) return;
    if (!controlledVehicleId || controlledVehicleId === "NONE") {
      if (activeVehicleRef.current) {
        handleClearVehicle();
      }
      return;
    }
    const match = vehiclesList.find((v) => getSavedVehicleId(v) === String(controlledVehicleId));
    if (match && getSavedVehicleId(activeVehicleRef.current) !== getSavedVehicleId(match)) {
      handleApplyVehicle(match);
    }
  }, [controlledVehicleId, vehiclesList, handleApplyVehicle, handleClearVehicle]);

  // Restore saved session selection on mount (SSR-safe)
  useEffect(() => {
    if (typeof window === "undefined" || controlledVehicleId !== undefined) return;
    if (vehiclesList.length === 0 || activeVehicleRef.current) return;
    try {
      const savedId = window.sessionStorage.getItem(SELECTED_SUMMARY_VEHICLE_STORAGE_KEY);
      if (savedId && savedId !== "NONE") {
        const match = vehiclesList.find((v) => getSavedVehicleId(v) === savedId);
        if (match) {
          handleApplyVehicle(match);
        }
      }
    } catch {
      // Storage restriction
    }
  }, [vehiclesList, controlledVehicleId, handleApplyVehicle]);

  // Optional Supabase customer vehicles loader (when explicitly enabled with userId)
  useEffect(() => {
    if (!autoLoadFromSupabase || !userId) return;
    let cancelled = false;
    const safeUserId = String(userId).replace(/'/g, "''");

    (async () => {
      try {
        const rows = await carbonQuery<EcmdSavedVehicleRecord>(
          `SELECT id, wix_id, year, make, model, color, vehicle_type, vehicle_category, archived FROM public.ecmd_crm_vehicles WHERE wix_user_id = '${safeUserId}' AND COALESCE(archived, false) = false ORDER BY updated_at ASC LIMIT 50;`
        );
        if (!cancelled && Array.isArray(rows)) {
          setVehiclesList(rows.filter((v) => v && !v.archived));
        }
      } catch {
        // Ignore gracefully when offline or table unavailable
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [autoLoadFromSupabase, userId]);

  // Listen to `ecmd-vehicle-locked-attempt` & `ecmd-sync-packages-vehicles` on window
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleLockedAttempt = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      triggerLockedVehicleTypeFeedback(detail.message);
    };

    const handleSyncVehicles = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const nextVehicles: EcmdSavedVehicleRecord[] = Array.isArray(detail.vehicles)
        ? detail.vehicles.filter((v: any) => v && !v.archived)
        : [];
      const autoSelectNewest = Boolean(detail.autoSelectNewest);
      setVehiclesList(nextVehicles);

      if (autoSelectNewest && nextVehicles.length > 0) {
        const newest = nextVehicles[nextVehicles.length - 1] ?? null;
        if (newest) handleApplyVehicle(newest);
      } else if (activeVehicleRef.current) {
        const curId = getSavedVehicleId(activeVehicleRef.current);
        const updatedMatch = nextVehicles.find((v) => getSavedVehicleId(v) === curId);
        if (updatedMatch) {
          handleApplyVehicle(updatedMatch);
        } else {
          handleClearVehicle();
        }
      }
    };

    window.addEventListener("ecmd-vehicle-locked-attempt", handleLockedAttempt);
    window.addEventListener("ecmd-sync-packages-vehicles", handleSyncVehicles);
    return () => {
      window.removeEventListener("ecmd-vehicle-locked-attempt", handleLockedAttempt);
      window.removeEventListener("ecmd-sync-packages-vehicles", handleSyncVehicles);
    };
  }, [triggerLockedVehicleTypeFeedback, handleApplyVehicle, handleClearVehicle]);

  // Close menu on outside click or Escape
  useEffect(() => {
    if (!isOpen || typeof document === "undefined") return;

    const handleDocClick = (e: MouseEvent) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const dropdownItems = useMemo(
    () =>
      buildSavedVehicleDropdownItems(vehiclesList, {
        browseWithoutLabel,
        addNewLabel,
        introLabel,
      }),
    [vehiclesList, browseWithoutLabel, addNewLabel, introLabel]
  );

  const activeVehicleId = activeVehicle ? getSavedVehicleId(activeVehicle) : null;
  const triggerLabel = activeVehicle
    ? formatVehicleDropdownLabel(activeVehicle, introLabel)
    : introLabel;
  const activeVehicleKey: EcmdVehicleKey | null = activeVehicle
    ? mapSubCategoryToVehicleKey(getSavedVehicleRawType(activeVehicle) || "Sedan") || "coupe"
    : null;
  const activeSubCategory: PackageSubCategory | null = activeVehicleKey
    ? mapVehicleKeyToSubCategory(activeVehicleKey)
    : null;

  const providerData: EcmdSavedVehicleContext = {
    selectedVehicle: activeVehicle,
    selectedVehicleId: activeVehicleId,
    label: triggerLabel,
    vehicleKey: activeVehicleKey,
    subCategory: activeSubCategory,
    isOpen,
    isLocked: Boolean(activeVehicle),
    isErrorVisible: errorVisible,
    errorText: errorMessage,
    vehiclesCount: vehiclesList.length,
  };

  const handleTriggerClick = () => {
    stopLockedVehicleTypeFeedback();
    setIsOpen((prev) => !prev);
  };

  const handleOptionClick = (item: EcmdVehicleDropdownItem) => {
    if (item.actionType === "NONE") {
      handleClearVehicle();
    } else if (item.actionType === "ADD_NEW") {
      handleAddNewVehicle();
    } else if (item.actionType === "VEHICLE" && item.vehicleObj) {
      handleApplyVehicle(item.vehicleObj);
    }
  };

  // Zero-Inline-Width Root Law: NEVER hardcode inline width: "100%" on root.
  // Default width lives in zero-specificity :where(.ecmd-saved-vehicle-dropdown-root) CSS.
  const rootStyle: React.CSSProperties = style
    ? { position: "relative", ...style }
    : { position: "relative" };

  return (
    <SafePlasmicDataProvider name="ecmdSavedVehicle" data={providerData}>
      <div
        ref={rootRef}
        className={`ecmd-saved-vehicle-dropdown-root ${className}`.trim()}
        data-ecmd-viewport={viewportMode}
        data-ecmd-vehicle-el="root"
        data-ecmd-open={isOpen ? "true" : "false"}
        data-ecmd-locked={activeVehicle ? "true" : "false"}
        style={rootStyle}
      >
        <button
          id="vehicleSelectDropButton"
          type="button"
          className={`${themeGroup && themeGroup !== "none" ? themeGroup : ""} ecmd-saved-vehicle-trigger ${isPulsing ? "ecmd-vehicle-drop-pulse" : ""}`.trim()}
          data-ecmd-vehicle-el="drop-button"
          data-ecmd-action="toggle-vehicle-dropdown"
          data-ecmd-pulsing={isPulsing ? "true" : "false"}
          data-ecmd-locked={activeVehicle ? "true" : "false"}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls="vehicleSelectRep"
          onClick={handleTriggerClick}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            padding: "12px 16px",
            borderRadius: "10px",
            border: "1px solid rgba(148, 163, 184, 0.35)",
            backgroundColor: "#0F172A",
            color: "#F8FAFC",
            fontSize: "15px",
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "left",
            boxSizing: "border-box",
          }}
        >
          <span
            data-ecmd-vehicle-el="drop-button-label"
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {triggerLabel}
          </span>
          <span aria-hidden="true" style={{ fontSize: "12px", opacity: 0.85, flexShrink: 0 }}>
            {isOpen ? "▴" : "▾"}
          </span>
        </button>

        <div
          id="vehicleSelectBox"
          data-ecmd-vehicle-el="select-box"
          className={`${menuThemeGroup && menuThemeGroup !== "none" ? menuThemeGroup : ""} ecmd-saved-vehicle-menu`.trim()}
          hidden={!isOpen}
          style={
            isOpen
              ? {
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  zIndex: 60,
                  borderRadius: "10px",
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  backgroundColor: "#0F172A",
                  boxShadow: "0 14px 32px rgba(2, 6, 23, 0.45)",
                  overflow: "hidden",
                  boxSizing: "border-box",
                }
              : { display: "none" }
          }
        >
          <div
            id="vehicleSelectRep"
            data-ecmd-vehicle-el="select-rep"
            role="listbox"
            aria-label="Saved Vehicles"
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "4px",
              gap: "2px",
              maxHeight: "280px",
              overflowY: "auto",
            }}
          >
            {dropdownItems.map((item) => {
              const isSelected =
                item.actionType === "VEHICLE" &&
                Boolean(activeVehicleId) &&
                getSavedVehicleId(item.vehicleObj) === activeVehicleId;
              const actionName =
                item.actionType === "NONE"
                  ? "clear-saved-vehicle"
                  : item.actionType === "ADD_NEW"
                  ? "add-new-vehicle"
                  : "select-saved-vehicle";

              return (
                <button
                  key={item._id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`ecmd-saved-vehicle-option ${isSelected ? "is-selected" : ""}`.trim()}
                  data-ecmd-vehicle-el="select-option"
                  data-ecmd-vehicle-option={
                    item.actionType === "NONE"
                      ? "none"
                      : item.actionType === "ADD_NEW"
                      ? "add-new"
                      : getSavedVehicleId(item.vehicleObj)
                  }
                  data-ecmd-vehicle-action={item.actionType}
                  data-ecmd-action={actionName}
                  data-ecmd-selected={isSelected ? "true" : "false"}
                  onClick={() => handleOptionClick(item)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: isSelected ? "rgba(84, 233, 234, 0.16)" : "transparent",
                    color:
                      item.actionType === "ADD_NEW"
                        ? "#54E9EA"
                        : isSelected
                        ? "#54E9EA"
                        : "#F8FAFC",
                    fontSize: "14px",
                    fontWeight: isSelected || item.actionType === "ADD_NEW" ? 700 : 500,
                    cursor: "pointer",
                    boxSizing: "border-box",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          id="vehicleTypeError"
          data-ecmd-vehicle-el="type-error"
          role="alert"
          aria-live="polite"
          hidden={!errorVisible}
          style={
            errorVisible
              ? {
                  marginTop: "8px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(239, 68, 68, 0.14)",
                  border: "1px solid rgba(239, 68, 68, 0.45)",
                  color: "#FCA5A5",
                  fontSize: "13px",
                  fontWeight: 600,
                  lineHeight: 1.4,
                  boxSizing: "border-box",
                }
              : { display: "none" }
          }
        >
          {errorMessage}
        </div>
      </div>
    </SafePlasmicDataProvider>
  );
}
