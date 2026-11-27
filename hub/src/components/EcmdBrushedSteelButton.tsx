import React, { useEffect, useMemo, useState } from "react";
import "../styles/brushedSteelButton.css";

export const DEFAULT_STEEL_GLOW_COLOR = "#54e9ea";
export const DEFAULT_STEEL_BUTTON_WIDTH = "220px";
export const DEFAULT_STEEL_BUTTON_HEIGHT = "35px";

export interface ParsedRgbColor {
  r: number;
  g: number;
  b: number;
}

export interface SteelButtonSizingVars {
  width?: string | undefined;
  height?: string | undefined;
}

/**
 * Normalizes numeric or string CSS dimensions (e.g. 48 -> "48px", "100%" -> "100%").
 */
export function normalizeCssDimension(value?: number | string | null): string | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? `${value}px` : undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (/^\d+(?:\.\d+)?$/.test(trimmed)) return `${trimmed}px`;
    return trimmed;
  }
  return undefined;
}

/**
 * Resolves the explicit `--label-size` / `--label-max` CSS variable override (Version 7):
 * - Explicit `fontSize` prop wins (number -> px, string -> verbatim).
 * - When `fontSize` is omitted, returns undefined so Version 7 container-query-aware CSS
 *   `clamp(14px, min(var(--label-max, 32.2px), 55cqh, 18cqw), var(--label-max, 32.2px))`
 *   scales automatically to both height (`55cqh`) and width (`18cqw`) via `.steel-button`
 *   `container-type: size`.
 */
export function resolveSteelLabelSize(
  fontSize?: number | string | null,
  _height?: number | string | null
): string | undefined {
  return normalizeCssDimension(fontSize);
}

/**
 * Parses a hex (#RGB, #RRGGBB, #RRGGBBAA) or rgb()/rgba() CSS color into RGB channels
 * so the 4-layer rear backlight glow smoothly matches any configured glowColor
 * (e.g. Cyan #54e9ea or Emerald #10B981).
 */
export function parseGlowColorToRgb(color?: string | null): ParsedRgbColor {
  const raw = String(color || "").trim();
  const hexMatch = raw.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (hexMatch && hexMatch[1]) {
    const h = hexMatch[1];
    if (h.length === 3) {
      return {
        r: parseInt(h.charAt(0) + h.charAt(0), 16),
        g: parseInt(h.charAt(1) + h.charAt(1), 16),
        b: parseInt(h.charAt(2) + h.charAt(2), 16),
      };
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  const rgbMatch = raw.match(
    /^rgba?\(\s*([0-9]+(?:\.[0-9]+)?)\s*[, ]\s*([0-9]+(?:\.[0-9]+)?)\s*[, ]\s*([0-9]+(?:\.[0-9]+)?)/i
  );
  if (rgbMatch) {
    return {
      r: Math.max(0, Math.min(255, Math.round(Number(rgbMatch[1])))),
      g: Math.max(0, Math.min(255, Math.round(Number(rgbMatch[2])))),
      b: Math.max(0, Math.min(255, Math.round(Number(rgbMatch[3])))),
    };
  }

  // Fallback to Cyan (#54e9ea)
  return { r: 84, g: 233, b: 234 };
}

export function buildSteelGlowVars(
  glowColor?: string | null,
  labelSize?: string,
  sizing?: SteelButtonSizingVars
): React.CSSProperties {
  const resolved = String(glowColor || "").trim() || DEFAULT_STEEL_GLOW_COLOR;
  const { r, g, b } = parseGlowColorToRgb(resolved);
  const vars: Record<string, string> = {
    "--glow-color": resolved,
    "--ecmd-steel-glow-color": resolved,
    "--ecmd-steel-glow-1": `rgba(${r}, ${g}, ${b}, 0.8)`,
    "--ecmd-steel-glow-2": `rgba(${r}, ${g}, ${b}, 0.6)`,
    "--ecmd-steel-glow-3": `rgba(${r}, ${g}, ${b}, 0.33)`,
    "--ecmd-steel-glow-4": `rgba(${r}, ${g}, ${b}, 0.15)`,
  };
  if (sizing?.width) {
    vars["--button-width"] = sizing.width;
  }
  if (sizing?.height) {
    vars["--button-height"] = sizing.height;
  }
  if (labelSize) {
    vars["--label-size"] = labelSize;
    vars["--label-max"] = labelSize;
  }
  return vars as React.CSSProperties;
}

export type EcmdSteelButtonRole =
  | "auto"
  | "scope-interior"
  | "scope-full"
  | "scope-exterior"
  | "whats-included"
  | "add-to-cart";

export function resolveSteelButtonRoleAttrs(
  buttonRole?: EcmdSteelButtonRole | null
): Record<string, string> {
  switch (buttonRole) {
    case "scope-interior":
      return { "data-ecmd-scope-btn": "interior" };
    case "scope-full":
      return { "data-ecmd-scope-btn": "full" };
    case "scope-exterior":
      return { "data-ecmd-scope-btn": "exterior" };
    case "whats-included":
      return {
        "data-ecmd-action": "open-whats-included",
        "data-ecmd-pkg": "whats-included-btn",
      };
    case "add-to-cart":
      return {
        "data-ecmd-action": "add-to-cart",
        "data-ecmd-pkg": "add-to-cart-btn",
      };
    case "auto":
    default:
      return {};
  }
}

export interface EcmdBrushedSteelButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
  label?: string | undefined;
  selected?: boolean | undefined;
  buttonRole?: EcmdSteelButtonRole | undefined;
  glowColor?: string | undefined;
  fontSize?: number | string | undefined;
  width?: number | string | undefined;
  height?: number | string | undefined;
  disabled?: boolean | undefined;
  onClick?: ((event: React.MouseEvent<HTMLButtonElement>) => void) | undefined;
}

export function EcmdBrushedSteelButton({
  className = "",
  style,
  label = "Exterior",
  selected = false,
  buttonRole = "auto",
  glowColor = DEFAULT_STEEL_GLOW_COLOR,
  fontSize,
  width,
  height,
  disabled = false,
  onClick,
  type = "button",
  ...restButtonProps
}: EcmdBrushedSteelButtonProps) {
  const [localSelected, setLocalSelected] = useState<boolean>(Boolean(selected));

  useEffect(() => {
    setLocalSelected(Boolean(selected));
  }, [selected]);

  const effectiveSelected = onClick ? Boolean(selected) : localSelected;

  const roleAttrs = useMemo(() => resolveSteelButtonRoleAttrs(buttonRole), [buttonRole]);

  const cleanWidth = useMemo(() => normalizeCssDimension(width), [width]);
  const cleanHeight = useMemo(() => normalizeCssDimension(height), [height]);

  const labelSize = useMemo(
    () => resolveSteelLabelSize(fontSize, height),
    [fontSize, height]
  );

  const buttonVars = useMemo(
    () =>
      buildSteelGlowVars(glowColor, labelSize, {
        width: cleanWidth,
        height: cleanHeight,
      }),
    [glowColor, labelSize, cleanWidth, cleanHeight]
  );

  // Zero-Inline-Width Root Law: NEVER hardcode inline width: "100%" on the root box.
  // Apply inline width/height ONLY when explicitly provided via props so Plasmic Studio
  // Design -> Width / Height / Max Width / Margin classes always win cleanly.
  const rootStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (!style && !cleanWidth && !cleanHeight) return undefined;
    return {
      ...(style || {}),
      ...(cleanWidth ? { width: cleanWidth } : {}),
      ...(cleanHeight ? { height: cleanHeight } : {}),
    };
  }, [style, cleanWidth, cleanHeight]);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (onClick) {
      onClick(event);
    } else {
      const isCardScopeBtn = Boolean(
        event.currentTarget.closest(".ecmd-package-card") &&
          (buttonRole === "scope-interior" ||
            buttonRole === "scope-full" ||
            buttonRole === "scope-exterior" ||
            event.currentTarget.hasAttribute("data-ecmd-scope-btn"))
      );
      if (!isCardScopeBtn) {
        setLocalSelected((prev) => !prev);
      }
    }
  };

  return (
    <span
      className={`ecmd-steel-button-root button-mount ${className}`.trim()}
      style={rootStyle}
      data-ecmd-selected={effectiveSelected ? "true" : "false"}
      {...(buttonRole && buttonRole !== "auto" ? { "data-ecmd-button-role": buttonRole } : {})}
      {...roleAttrs}
    >
      <button
        {...roleAttrs}
        {...restButtonProps}
        type={type}
        className="ecmd-steel-button steel-button"
        style={buttonVars}
        aria-pressed={effectiveSelected}
        data-ecmd-selected={effectiveSelected ? "true" : "false"}
        disabled={disabled}
        onClick={handleClick}
      >
        <span className="steel-face">
          <span className="button-label">{label}</span>
        </span>
      </button>
    </span>
  );
}

export { EcmdBrushedSteelButton as BrushedSteelButton };
export default EcmdBrushedSteelButton;
