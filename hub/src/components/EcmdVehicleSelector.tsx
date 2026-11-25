import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import {
  useEcmdBreakpoint,
  handleDelegatedBreakpointAction,
} from "../lib/useEcmdBreakpoint";
import { ensureEcmdRootSizingStyles } from "../lib/ecmdRootSizing";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type VehicleSelectorResponsiveLayout =
  | "inherit"
  | "grid-2x2"
  | "horizontal-scroll"
  | "vertical-stack";

export type VehicleSelectorMobileLayout = VehicleSelectorResponsiveLayout;

export interface EcmdVehicleSelectorProps {
  className?: string;
  style?: React.CSSProperties;
  selectedVehicle?: string;
  defaultVehicle?: string;
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
  slot1,
  slot2,
  slot3,
  slot4,
}: EcmdVehicleSelectorProps) {
  const [activeVehicle, setActiveVehicle] = useState(defaultVehicle);
  const rootRef = useRef<HTMLDivElement>(null);
  const { isMobile, isTablet, viewportMode } = useEcmdBreakpoint(
    mobileBreakpointPx,
    tabletBreakpointPx
  );

  useIsomorphicLayoutEffect(() => {
    ensureEcmdRootSizingStyles(rootRef.current?.ownerDocument);
  }, []);

  useEffect(() => {
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
  }, [controlledVehicle, persistChoice]);

  const dispatchChange = (vehicleKey: string) => {
    let label = "Car";
    if (vehicleKey === "truck") label = "Truck";
    if (vehicleKey === "sm-suv") label = "Sm. SUV";
    if (vehicleKey === "lg-suv") label = "Lg. SUV/Van";

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ecmd-vehicle-change", {
          detail: { vehicleKey, label },
        })
      );
    }
    if (onVehicleChange) {
      onVehicleChange(vehicleKey, { label });
    }
  };

  const handleSelect = (key: string, event: React.MouseEvent<HTMLDivElement>) => {
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
      ? { cursor: "pointer", flex: "0 0 auto", minWidth: "120px", padding: "10px", textAlign: "center", boxSizing: "border-box" }
      : effectiveResponsiveLayout === "grid-2x2" || effectiveResponsiveLayout === "vertical-stack"
      ? { cursor: "pointer", width: "100%", padding: "10px", textAlign: "center", boxSizing: "border-box" }
      : { cursor: "pointer", flex: 1, padding: "10px", textAlign: "center", boxSizing: "border-box" };

  const renderSlot = (slotNode: React.ReactNode, key: string) => {
    const isSelected = activeVehicle === key;
    const hasCustomSlot = Boolean(slotNode);
    const slotStyle: React.CSSProperties = hasCustomSlot
      ? effectiveResponsiveLayout === "horizontal-scroll"
        ? { cursor: "pointer", flex: "0 0 auto", minWidth: "120px", boxSizing: "border-box" }
        : effectiveResponsiveLayout === "grid-2x2" || effectiveResponsiveLayout === "vertical-stack"
        ? { cursor: "pointer", width: "100%", boxSizing: "border-box" }
        : { cursor: "pointer", flex: 1, boxSizing: "border-box" }
      : {
          ...slotBaseStyle,
          borderBottom: isSelected ? "4px solid #54E9EA" : "4px solid transparent",
        };

    return (
      <div
        className={`${itemThemeGroup && itemThemeGroup !== "none" ? itemThemeGroup : ""} ecmd-vehicle-slot ${isSelected ? "is-selected" : ""}`.trim()}
        style={slotStyle}
        onClick={(e) => handleSelect(key, e)}
        data-ecmd-selected={isSelected ? "true" : "false"}
        data-ecmd-vehicle-slot={key}
        data-ecmd-slot-wrapper={hasCustomSlot ? "transparent" : "default"}
      >
        {slotNode || <div>{key}</div>}
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
      style={style ? { ...wrapperStyle, ...style } : wrapperStyle}
    >
      {renderSlot(slot1, "coupe")}
      {renderSlot(slot2, "truck")}
      {renderSlot(slot3, "sm-suv")}
      {renderSlot(slot4, "lg-suv")}
    </div>
  );
}
