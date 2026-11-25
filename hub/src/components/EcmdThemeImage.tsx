import React, { useEffect, useState } from "react";

export type ThemeKey = "custom" | "emerald-dark" | "coastal-light" | "midnight-slate";

export interface EcmdThemeImageProps {
  className?: string;
  customSrc?: string;
  emeraldDarkSrc?: string;
  coastalLightSrc?: string;
  midnightSlateSrc?: string;
  width?: string;
  height?: string;
  objectFit?: "contain" | "cover" | "fill" | "scale-down";
  alt?: string;
}

export function EcmdThemeImage({
  className,
  customSrc = "/ecmd-dolphin-logo.svg",
  emeraldDarkSrc,
  coastalLightSrc,
  midnightSlateSrc,
  width,
  height,
  objectFit = "contain",
  alt = "Emerald Coast Mobile Detailing"
}: EcmdThemeImageProps) {
  // Deterministic SSR-safe initial state; real active theme syncs in useEffect after hydration.
  const [theme, setTheme] = useState<ThemeKey>("coastal-light");

  useEffect(() => {
    if (typeof document === "undefined") return;
    const sync = () => setTheme(((document.documentElement.getAttribute("data-ecmd-active-theme") as ThemeKey) || "coastal-light"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-ecmd-active-theme"] });
    return () => obs.disconnect();
  }, []);

  const activeSrc = (theme === "midnight-slate" ? (midnightSlateSrc || emeraldDarkSrc) : (coastalLightSrc || customSrc)) || coastalLightSrc || midnightSlateSrc || customSrc || "/ecmd-dolphin-logo.svg";

  const sizeOverride: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxSizing: "border-box",
    overflow: "hidden",
    ...(width ? { width, minWidth: width, maxWidth: width } : {}),
    ...(height ? { height, minHeight: height, maxHeight: height } : {})
  };

  return (
    <div data-ecmd-brand-asset="true" className={className} style={sizeOverride}>
      <img data-ecmd-brand-asset="true"
        src={activeSrc}
        alt={alt}
        style={{ width: "100%", height: "100%", objectFit, display: "block", pointerEvents: "none" }}
      />
    </div>
  );
}