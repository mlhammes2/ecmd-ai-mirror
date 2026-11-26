import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { DataProvider } from "@plasmicapp/loader-react";
import {
  useEcmdBreakpoint,
  handleDelegatedBreakpointAction,
} from "../lib/useEcmdBreakpoint";
import { ensureEcmdRootSizingStyles } from "../lib/ecmdRootSizing";
import {
  getVehicleKeyDisplayLabel,
  mapSubCategoryToVehicleKey,
  mapVehicleKeyToSubCategory,
  type EcmdVehicleKey,
  type PackageSubCategory,
} from "../lib/ecmdPackageMatcher";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const DEFAULT_LOCKED_ATTEMPT_MESSAGE =
  "Clear your selected vehicle to browse other vehicle types.";

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

export type VehicleSelectorResponsiveLayout =
  | "inherit"
  | "grid-2x2"
  | "horizontal-scroll"
  | "vertical-stack";

export type VehicleSelectorMobileLayout = VehicleSelectorResponsiveLayout;

export interface EcmdVehicleSlotContext {
  vehicleKey: EcmdVehicleKey;
  subCategory: PackageSubCategory;
  label: string;
  isLocked: boolean;
  activeVehicle: string;
  lockedVehicleKey: EcmdVehicleKey | null;
  isSelected: boolean;
}

export interface EcmdVehicleLockedAttemptDetail {
  attemptedVehicleKey: EcmdVehicleKey;
  attemptedSubCategory: PackageSubCategory;
  lockedVehicleKey: EcmdVehicleKey;
  lockedSubCategory: PackageSubCategory;
  label: string;
  message: string;
}

interface EventLockState {
  vehicleKey: EcmdVehicleKey;
  subCategory: PackageSubCategory;
  label: string;
  message: string;
}

export interface EcmdVehicleSelectorProps {
  className?: string;
  style?: React.CSSProperties;
  selectedVehicle?: string;
  defaultVehicle?: string;
  lockedVehicleKey?: string;
  lockedSubCategory?: string;
  persistChoice?: boolean;
  themeGroup?: string;
  itemThemeGroup?: string;
  tabletBreakpointPx?: number;
  tabletLayout?: VehicleSelectorResponsiveLayout;
  tabletGap?: number;
  mobileBreakpointPx?: number;
  mobileLayout?: VehicleSelectorResponsiveLayout;
  mobileGap?: number;
  onVehicleChange?: (vehicleKey: string, meta: any) => void;
  onLockedAttempt?: (detail: EcmdVehicleLockedAttemptDetail) => void;
  slot1?: React.ReactNode;
  slot2?: React.ReactNode;
  slot3?: React.ReactNode;
  slot4?: React.ReactNode;
}

export function EcmdVehicleSelector({
  className = "",
  style,
  selectedVehicle: controlledVehicle,
  defaultVehicle = "sm-suv",
  lockedVehicleKey,
  lockedSubCategory,
  persistChoice = true,
  themeGroup = "ecmd-group-1",
  itemThemeGroup = "ecmd-group-4",
  tabletBreakpointPx = 1024,
  tabletLayout = "inherit",
  tabletGap,
  mobileBreakpointPx = 768,
  mobileLayout = "grid-2x2",
  mobileGap = 8,
  onVehicleChange,
  onLockedAttempt,
  slot1,
  slot2,
  slot3,
  slot4,
}: EcmdVehicleSelectorProps) {
  const propLockedKey = mapSubCategoryToVehicleKey(lockedVehicleKey || lockedSubCategory);
  const [activeVehicle, setActiveVehicle] = useState<string>(
    propLockedKey || controlledVehicle || defaultVehicle
  );
  const [eventLock, setEventLock] = useState<EventLockState | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const { isMobile, isTablet, viewportMode } = useEcmdBreakpoint(
    mobileBreakpointPx,
    tabletBreakpointPx
  );

  const effectiveLockedKey: EcmdVehicleKey | null = propLockedKey || eventLock?.vehicleKey || null;
  const effectiveLockedSubCategory: PackageSubCategory | null = effectiveLockedKey
    ? mapVehicleKeyToSubCategory(effectiveLockedKey)
    : null;
  const effectiveLockedLabel = propLockedKey
    ? getVehicleKeyDisplayLabel(propLockedKey)
    : eventLock?.label || (effectiveLockedKey ? getVehicleKeyDisplayLabel(effectiveLockedKey) : "");
  const effectiveLockedMessage = eventLock?.message || DEFAULT_LOCKED_ATTEMPT_MESSAGE;
  const isLocked = Boolean(effectiveLockedKey);

  useIsomorphicLayoutEffect(() => {
    ensureEcmdRootSizingStyles(rootRef.current?.ownerDocument);
  }, []);

  const dispatchChange = useCallback(
    (vehicleKey: string) => {
      const label = getVehicleKeyDisplayLabel(vehicleKey);
      const subCategory = mapVehicleKeyToSubCategory(vehicleKey);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("ecmd-vehicle-change", {
            detail: { vehicleKey, label, subCategory, source: "EcmdVehicleSelector" },
          })
        );
      }
      if (onVehicleChange) {
        onVehicleChange(vehicleKey, { label, subCategory });
      }
    },
    [onVehicleChange]
  );

  // Sync controlled lockedVehicleKey / lockedSubCategory prop
  useEffect(() => {
    if (propLockedKey) {
      setActiveVehicle(propLockedKey);
    }
  }, [propLockedKey]);

  // Hydrate initial selection from controlled prop or localStorage (SSR-safe)
  useEffect(() => {
    if (propLockedKey) {
      setActiveVehicle(propLockedKey);
      return;
    }
    if (controlledVehicle) {
      setActiveVehicle(controlledVehicle);
    } else if (persistChoice) {
      let saved: string | null = null;
      try {
        saved = window.localStorage.getItem("ecmd_selected_vehicle");
      } catch {
        // Cross-origin iframe storage restriction
      }
      if (saved) {
        setActiveVehicle(saved);
        dispatchChange(saved);
      } else {
        dispatchChange(defaultVehicle);
      }
    }
  }, [controlledVehicle, persistChoice, propLockedKey]);

  // Listen for window lock/unlock and external vehicle-change events
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleVehicleLock = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      const resolvedKey = mapSubCategoryToVehicleKey(detail.vehicleKey || detail.subCategory);
      if (!resolvedKey) return;
      const resolvedSubCat = mapVehicleKeyToSubCategory(resolvedKey);
      const resolvedLabel =
        String(detail.label || "").trim() || getVehicleKeyDisplayLabel(resolvedKey);
      const resolvedMessage =
        String(detail.message || "").trim() || DEFAULT_LOCKED_ATTEMPT_MESSAGE;

      setEventLock({
        vehicleKey: resolvedKey,
        subCategory: resolvedSubCat,
        label: resolvedLabel,
        message: resolvedMessage,
      });
      setActiveVehicle(resolvedKey);
    };

    const handleVehicleUnlock = () => {
      setEventLock(null);
    };

    const handleExternalVehicleChange = (e: Event) => {
      const detail = (e as CustomEvent)?.detail || {};
      if (detail.source === "EcmdVehicleSelector") return;
      const resolvedKey = mapSubCategoryToVehicleKey(detail.vehicleKey || detail.subCategory);
      if (!resolvedKey) return;
      setActiveVehicle(resolvedKey);
    };

    window.addEventListener("ecmd-vehicle-lock", handleVehicleLock);
    window.addEventListener("ecmd-vehicle-unlock", handleVehicleUnlock);
    window.addEventListener("ecmd-vehicle-change", handleExternalVehicleChange);
    return () => {
      window.removeEventListener("ecmd-vehicle-lock", handleVehicleLock);
      window.removeEventListener("ecmd-vehicle-unlock", handleVehicleUnlock);
      window.removeEventListener("ecmd-vehicle-change", handleExternalVehicleChange);
    };
  }, []);

  const handleSelect = (key: EcmdVehicleKey, event: React.MouseEvent<HTMLDivElement>) => {
    if (effectiveLockedKey && effectiveLockedSubCategory) {
      if (key !== effectiveLockedKey) {
        const attemptDetail: EcmdVehicleLockedAttemptDetail = {
          attemptedVehicleKey: key,
          attemptedSubCategory: mapVehicleKeyToSubCategory(key),
          lockedVehicleKey: effectiveLockedKey,
          lockedSubCategory: effectiveLockedSubCategory,
          label: effectiveLockedLabel,
          message: effectiveLockedMessage,
        };
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("ecmd-vehicle-locked-attempt", {
              detail: attemptDetail,
            })
          );
        }
        if (onLockedAttempt) {
          onLockedAttempt(attemptDetail);
        }
      }
      // Keep activeVehicle pinned to the locked vehicle's tier
      if (activeVehicle !== effectiveLockedKey) {
        setActiveVehicle(effectiveLockedKey);
      }
      return;
    }

    setActiveVehicle(key);
    if (persistChoice) {
      try {
        window.localStorage.setItem("ecmd_selected_vehicle", key);
      } catch {
        // Cross-origin iframe storage restriction
      }
    }
    dispatchChange(key);
    handleDelegatedBreakpointAction(event.target, {
      viewportMode,
      isMobile,
      payload: { vehicleKey: key },
    });
  };

  const activeGap = isMobile ? mobileGap : isTablet ? (tabletGap ?? 10) : mobileGap;
  const gapPx = `${Number.isFinite(Number(activeGap)) ? Number(activeGap) : isTablet ? 10 : 8}px`;
  const effectiveResponsiveLayout: VehicleSelectorResponsiveLayout = isMobile
    ? mobileLayout
    : isTablet
    ? tabletLayout
    : "inherit";

  // Zero-Inline-Width Root Law: NEVER hardcode inline width: "100%" on the root box.
  // Default width (100%) lives in zero-specificity :where(.ecmd-vehicle-selector-root) CSS
  // so Plasmic Studio Design -> Width, Max Width, Margin, and Align always win.
  const wrapperStyle: React.CSSProperties =
    effectiveResponsiveLayout === "grid-2x2"
      ? {
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: gapPx,
        }
      : effectiveResponsiveLayout === "horizontal-scroll"
      ? {
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          overflowX: "auto",
          gap: gapPx,
        }
      : effectiveResponsiveLayout === "vertical-stack"
      ? {
          display: "flex",
          flexDirection: "column",
          gap: gapPx,
        }
      : {
          display: "flex",
          justifyContent: "space-around",
        };

  const slotBaseStyle: React.CSSProperties =
    effectiveResponsiveLayout === "horizontal-scroll"
      ? {
          cursor: "pointer",
          flex: "0 0 auto",
          minWidth: "120px",
          padding: "10px",
          textAlign: "center",
          boxSizing: "border-box",
        }
      : effectiveResponsiveLayout === "grid-2x2" || effectiveResponsiveLayout === "vertical-stack"
      ? {
          cursor: "pointer",
          width: "100%",
          padding: "10px",
          textAlign: "center",
          boxSizing: "border-box",
        }
      : {
          cursor: "pointer",
          flex: 1,
          padding: "10px",
          textAlign: "center",
          boxSizing: "border-box",
        };

  const effectiveActiveVehicle = effectiveLockedKey || activeVehicle;

  const renderSlot = (slotNode: React.ReactNode, key: EcmdVehicleKey) => {
    const isSelected = effectiveActiveVehicle === key;
    const isSlotBlocked = isLocked && !isSelected;
    const hasCustomSlot = Boolean(slotNode);
    const slotStyle: React.CSSProperties = hasCustomSlot
      ? effectiveResponsiveLayout === "horizontal-scroll"
        ? {
            cursor: isSlotBlocked ? "not-allowed" : "pointer",
            flex: "0 0 auto",
            minWidth: "120px",
            boxSizing: "border-box",
          }
        : effectiveResponsiveLayout === "grid-2x2" || effectiveResponsiveLayout === "vertical-stack"
        ? {
            cursor: isSlotBlocked ? "not-allowed" : "pointer",
            width: "100%",
            boxSizing: "border-box",
          }
        : {
            cursor: isSlotBlocked ? "not-allowed" : "pointer",
            flex: 1,
            boxSizing: "border-box",
          }
      : {
          ...slotBaseStyle,
          cursor: isSlotBlocked ? "not-allowed" : "pointer",
          borderBottom: isSelected ? "4px solid #54E9EA" : "4px solid transparent",
        };

    const slotContext: EcmdVehicleSlotContext = {
      vehicleKey: key,
      subCategory: mapVehicleKeyToSubCategory(key),
      label: getVehicleKeyDisplayLabel(key),
      isLocked,
      activeVehicle: effectiveActiveVehicle,
      lockedVehicleKey: effectiveLockedKey,
      isSelected,
    };

    return (
      <div
        className={`${itemThemeGroup && itemThemeGroup !== "none" ? itemThemeGroup : ""} ecmd-vehicle-slot ${isSelected ? "is-selected" : ""} ${isLocked ? "is-locked" : ""}`.trim()}
        style={slotStyle}
        onClick={(e) => handleSelect(key, e)}
        data-ecmd-selected={isSelected ? "true" : "false"}
        data-ecmd-vehicle-slot={key}
        data-ecmd-locked={isLocked ? "true" : "false"}
        data-ecmd-slot-wrapper={hasCustomSlot ? "transparent" : "default"}
      >
        <SafePlasmicDataProvider name="ecmdVehicle" data={slotContext}>
          {slotNode || <div>{key}</div>}
        </SafePlasmicDataProvider>
      </div>
    );
  };

  return (
    <div
      ref={rootRef}
      className={`ecmd-vehicle-selector-root ecmd-vehicle-selector ${themeGroup} ${className}`.trim()}
      data-ecmd-viewport={viewportMode}
      data-ecmd-mobile-layout={effectiveResponsiveLayout}
      data-ecmd-responsive-layout={effectiveResponsiveLayout}
      data-ecmd-locked={isLocked ? "true" : "false"}
      data-ecmd-locked-vehicle={effectiveLockedKey || ""}
      style={style ? { ...wrapperStyle, ...style } : wrapperStyle}
    >
      {renderSlot(slot1, "coupe")}
      {renderSlot(slot2, "truck")}
      {renderSlot(slot3, "sm-suv")}
      {renderSlot(slot4, "lg-suv")}
    </div>
  );
}
