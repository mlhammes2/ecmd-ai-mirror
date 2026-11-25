import React, { useEffect, useRef, useState } from "react";

export interface EcmdHoverTooltipProps {
  className?: string;
  tagClassName?: string;
  tagText?: string;
  subText?: string;
  placement?: "bottom" | "top" | "left" | "right" | "bottom-right" | "bottom-left";
  previewOpen?: boolean;
  showArrow?: boolean;
  useRichSlot?: boolean;
  fixedBreakout?: boolean;
  offsetPx?: number;
  hoverDelayMs?: number;
  hideDelayMs?: number;
  bgColor?: string;
  textColor?: string;
  borderColor?: string;
  children?: React.ReactNode;
  tooltipContent?: React.ReactNode;
}

export function EcmdHoverTooltip({
  className,
  tagClassName,
  tagText = "Member Portal & Saved Vehicles",
  subText = "",
  placement = "bottom",
  previewOpen = false,
  showArrow = true,
  useRichSlot = false,
  fixedBreakout = false,
  offsetPx = 8,
  hoverDelayMs = 100,
  hideDelayMs = 120,
  bgColor = "#0F172A",
  textColor = "#F8FAFC",
  borderColor = "#10B981",
  children,
  tooltipContent
}: EcmdHoverTooltipProps) {
  const [hovered, setHovered] = useState<boolean>(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number }>({ top: 0, left: 0, width: 0, height: 0 });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const enterTimer = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);
  const isVisible = previewOpen || hovered;

  const handleMouseEnter = () => {
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    enterTimer.current = window.setTimeout(() => setHovered(true), hoverDelayMs);
  };

  const handleMouseLeave = () => {
    if (enterTimer.current) window.clearTimeout(enterTimer.current);
    leaveTimer.current = window.setTimeout(() => setHovered(false), hideDelayMs);
  };

  useEffect(() => {
    if (!isVisible || !fixedBreakout || !wrapRef.current) return;
    const updateRect = () => {
      if (!wrapRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      setCoords({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [isVisible, fixedBreakout]);

  const getPositionStyle = (): React.CSSProperties => {
    if (fixedBreakout) {
      if (placement === "top") return { position: "fixed", top: (coords.top - offsetPx) + "px", left: (coords.left + coords.width / 2) + "px", transform: "translate(-50%, -100%)" };
      if (placement === "left") return { position: "fixed", top: (coords.top + coords.height / 2) + "px", left: (coords.left - offsetPx) + "px", transform: "translate(-100%, -50%)" };
      if (placement === "right") return { position: "fixed", top: (coords.top + coords.height / 2) + "px", left: (coords.left + coords.width + offsetPx) + "px", transform: "translate(0, -50%)" };
      if (placement === "bottom-right") return { position: "fixed", top: (coords.top + coords.height + offsetPx) + "px", left: (coords.left + coords.width) + "px", transform: "translate(-100%, 0)" };
      if (placement === "bottom-left") return { position: "fixed", top: (coords.top + coords.height + offsetPx) + "px", left: coords.left + "px" };
      return { position: "fixed", top: (coords.top + coords.height + offsetPx) + "px", left: (coords.left + coords.width / 2) + "px", transform: "translate(-50%, 0)" };
    }
    if (placement === "top") return { position: "absolute", bottom: "calc(100% + " + offsetPx + "px)", left: "50%", transform: "translateX(-50%)" };
    if (placement === "left") return { position: "absolute", right: "calc(100% + " + offsetPx + "px)", top: "50%", transform: "translateY(-50%)" };
    if (placement === "right") return { position: "absolute", left: "calc(100% + " + offsetPx + "px)", top: "50%", transform: "translateY(-50%)" };
    if (placement === "bottom-right") return { position: "absolute", top: "calc(100% + " + offsetPx + "px)", right: 0 };
    if (placement === "bottom-left") return { position: "absolute", top: "calc(100% + " + offsetPx + "px)", left: 0 };
    return { position: "absolute", top: "calc(100% + " + offsetPx + "px)", left: "50%", transform: "translateX(-50%)" };
  };

  return (
    <div
      ref={wrapRef}
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
    >
      {children}
      {isVisible && (
        <div
          className={tagClassName}
          style={{
            ...getPositionStyle(),
            zIndex: 10050,
            backgroundColor: bgColor,
            color: textColor,
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: borderColor,
            borderRadius: "8px",
            paddingTop: "6px",
            paddingBottom: "6px",
            paddingLeft: "10px",
            paddingRight: "10px",
            fontSize: "12px",
            fontWeight: 600,
            whiteSpace: "nowrap",
            boxShadow: "0 10px 25px rgba(2,6,23,0.35)",
            pointerEvents: "auto"
          }}
        >
          {showArrow && (placement === "bottom" || placement === "bottom-right" || placement === "bottom-left") && (
            <div
              style={{
                position: "absolute",
                top: "-5px",
                left: placement === "bottom-right" ? "calc(100% - 18px)" : placement === "bottom-left" ? "14px" : "50%",
                transform: "translateX(-50%) rotate(45deg)",
                width: "8px",
                height: "8px",
                backgroundColor: bgColor,
                borderTopWidth: "1px",
                borderTopStyle: "solid",
                borderTopColor: borderColor,
                borderLeftWidth: "1px",
                borderLeftStyle: "solid",
                borderLeftColor: borderColor
              }}
            />
          )}
          {useRichSlot ? (
            tooltipContent
          ) : (
            <div style={{ display: "flex", flexDirection: "column", rowGap: "2px" }}>
              <span>{tagText}</span>
              {subText ? <span style={{ fontSize: "11px", fontWeight: 400, opacity: 0.8 }}>{subText}</span> : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
