import React, { useState } from "react";
import { cn } from "../../lib/utils";

// ==========================================
// 1. HqDockRail
// ==========================================
export interface HqDockRailProps {
  className?: string;
  style?: React.CSSProperties;
  topSlot?: React.ReactNode;
  bottomSlot?: React.ReactNode;
  width?: string;
  background?: string;
  borderColor?: string;
}

export function HqDockRail({
  className,
  style,
  topSlot,
  bottomSlot,
  width = "56px",
  background = "#0f1115",
  borderColor = "#1f2937",
}: HqDockRailProps) {
  return (
    <nav
      className={cn(
        "flex flex-col justify-between items-center relative select-none box-border z-20 shrink-0",
        className
      )}
      style={{
        width,
        minWidth: width,
        maxWidth: width,
        backgroundColor: background,
        borderRight: `1px solid ${borderColor}`,
        height: "100%",
        minHeight: "100vh",
        padding: "12px 0",
        boxSizing: "border-box",
        overflow: "visible",
        ...style,
      }}
    >
      <div
        className="flex flex-col items-center gap-3 w-full"
        style={{ overflow: "visible" }}
      >
        {topSlot}
      </div>
      <div
        className="flex flex-col items-center gap-3 w-full"
        style={{ overflow: "visible" }}
      >
        {bottomSlot}
      </div>
    </nav>
  );
}

// ==========================================
// 2. HqDockIconButton
// ==========================================
export interface HqDockIconButtonProps {
  className?: string;
  style?: React.CSSProperties;
  iconSlot?: React.ReactNode;
  iconUrl?: string;
  label?: string;
  isActive?: boolean;
  size?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function HqDockIconButton({
  className,
  style,
  iconSlot,
  iconUrl,
  label,
  isActive = false,
  size = "40px",
  onClick,
}: HqDockIconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative flex items-center justify-center transition-all duration-150 outline-none rounded-lg cursor-pointer border shrink-0",
        isActive
          ? "bg-blue-600/20 text-blue-400 border-blue-500/40 shadow-sm"
          : "bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 border-transparent",
        className
      )}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        ...style,
      }}
    >
      {iconSlot ? (
        iconSlot
      ) : iconUrl ? (
        <img
          src={iconUrl}
          alt={label || "dock icon"}
          className="w-5 h-5 object-contain pointer-events-none select-none"
        />
      ) : (
        <span className="text-xs font-semibold uppercase pointer-events-none">
          {label ? label.charAt(0) : "•"}
        </span>
      )}
    </button>
  );
}

// ==========================================
// 3. HqSlideOutDrawer
// ==========================================
export interface HqSlideOutDrawerProps {
  className?: string;
  style?: React.CSSProperties;
  isOpen?: boolean;
  width?: string;
  title?: string;
  headerSlot?: React.ReactNode;
  children?: React.ReactNode;
}

export function HqSlideOutDrawer({
  className,
  style,
  isOpen = true,
  width = "260px",
  title,
  headerSlot,
  children,
}: HqSlideOutDrawerProps) {
  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-[#14171f] border-r border-[#1f2937] transition-all duration-250 ease-in-out box-border overflow-hidden shrink-0",
        className
      )}
      style={{
        width: isOpen ? width : "0px",
        minWidth: isOpen ? width : "0px",
        maxWidth: isOpen ? width : "0px",
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? "auto" : "none",
        transform: isOpen ? "translateX(0)" : "translateX(-12px)",
        borderRightWidth: isOpen ? "1px" : "0px",
        transitionProperty: "width, min-width, max-width, transform, opacity, border-color",
        transitionDuration: "250ms",
        transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
        ...style,
      }}
    >
      <div
        className="w-full flex flex-col h-full"
        style={{ width, minWidth: width }}
      >
        {(title || headerSlot) && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f2937]/80 min-h-[48px] shrink-0">
            {title && (
              <h3 className="text-sm font-semibold text-zinc-200 tracking-wide truncate">
                {title}
              </h3>
            )}
            {headerSlot && <div className="ml-auto">{headerSlot}</div>}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {children}
        </div>
      </div>
    </aside>
  );
}

// ==========================================
// 4. HqHoverPopupItem
// ==========================================
export interface HqHoverPopupItemProps {
  className?: string;
  style?: React.CSSProperties;
  triggerSlot?: React.ReactNode;
  popupSlot?: React.ReactNode;
  popupWidth?: string;
  popupAlign?: "bottom" | "center" | "top";
  forceOpenInPreview?: boolean;
}

export function HqHoverPopupItem({
  className,
  style,
  triggerSlot,
  popupSlot,
  popupWidth = "196px",
  popupAlign = "bottom",
  forceOpenInPreview = false,
}: HqHoverPopupItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const isVisible = forceOpenInPreview || isHovered;

  const alignStyle: React.CSSProperties =
    popupAlign === "bottom"
      ? { bottom: 0 }
      : popupAlign === "center"
      ? { top: "50%", transform: "translateY(-50%)" }
      : { top: 0 };

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Trigger Slot */}
      <div className="relative flex items-center justify-center">
        {triggerSlot}
      </div>

      {/* Hover Bridge + Popup Menu Shell */}
      {isVisible && (
        <div
          className="absolute z-50 transition-opacity duration-150 animate-in fade-in"
          style={{
            left: "100%",
            paddingLeft: "10px", // 10px invisible hover bridge
            ...alignStyle,
          }}
        >
          {/* Invisible 10px hover bridge covering the full vertical gap to prevent pointer exit */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: "10px",
              pointerEvents: "auto",
            }}
          />

          {/* Popup vertical stack shell */}
          <div
            className="bg-[#14171f] border border-[#2d3748] rounded-lg shadow-2xl p-1.5 flex flex-col gap-1"
            style={{
              width: popupWidth,
              minWidth: popupWidth,
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.6)",
            }}
          >
            {popupSlot}
          </div>
        </div>
      )}
    </div>
  );
}
