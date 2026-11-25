import React, { useEffect, useId, useState } from "react";

export type ThemeKey = "custom" | "emerald-dark" | "coastal-light" | "midnight-slate";

export interface EcmdThemeLogoProps {
  className?: string;
  mode?: "recolor-single-svg" | "swap-slots";
  customColor?: string;
  emeraldDarkColor?: string;
  coastalLightColor?: string;
  midnightSlateColor?: string;
  children?: React.ReactNode;
  emeraldDarkSlot?: React.ReactNode;
  coastalLightSlot?: React.ReactNode;
  midnightSlateSlot?: React.ReactNode;
}

export function EcmdThemeLogo({
  className,
  mode = "recolor-single-svg",
  customColor = "#FFFFFF",
  emeraldDarkColor = "#FFFFFF",
  coastalLightColor = "#0F172A",
  midnightSlateColor = "#F8FAFC",
  children,
  emeraldDarkSlot,
  coastalLightSlot,
  midnightSlateSlot
}: EcmdThemeLogoProps) {
  const uid = "ecmd-tlogo-" + useId().replace(/[^a-zA-Z0-9]/g, "");
  // Deterministic SSR-safe initial state; real active theme syncs in useEffect after hydration.
  const [theme, setTheme] = useState<ThemeKey>("custom");

  useEffect(() => {
    if (typeof document === "undefined") return;
    const sync = () => {
      const cur = (document.documentElement.getAttribute("data-ecmd-active-theme") as ThemeKey) || "custom";
      setTheme(cur);
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-ecmd-active-theme"] });
    return () => obs.disconnect();
  }, []);

  const activeColor =
    theme === "emerald-dark" ? emeraldDarkColor :
    theme === "coastal-light" ? coastalLightColor :
    theme === "midnight-slate" ? midnightSlateColor : customColor;

  const activeSlot =
    mode === "swap-slots"
      ? (theme === "emerald-dark" && emeraldDarkSlot ? emeraldDarkSlot :
         theme === "coastal-light" && coastalLightSlot ? coastalLightSlot :
         theme === "midnight-slate" && midnightSlateSlot ? midnightSlateSlot : children)
      : children;

  return (
    <div id={uid} className={className} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", color: activeColor, transition: "color 0.25s ease" }}>
      {mode === "recolor-single-svg" && (
        <style>{`#${uid}, #${uid} svg { color: ${activeColor} !important; }`}</style>
      )}
      {activeSlot}
    </div>
  );
}