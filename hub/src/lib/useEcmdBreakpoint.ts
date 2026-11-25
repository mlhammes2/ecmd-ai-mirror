import { useState, useEffect, useLayoutEffect } from "react";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type EcmdViewportMode = "desktop" | "tablet" | "mobile";

export interface EcmdBreakpointState {
  viewportMode: EcmdViewportMode;
  isDesktop: boolean;
  isTablet: boolean;
  isMobile: boolean;
  viewportWidthPx: number;
  artboardTag: string;
}

export function getViewportWidthPx(win?: Window | null): number {
  const target = win ?? (typeof window !== "undefined" ? window : null);
  if (!target) return 1440;
  const inner =
    typeof target.innerWidth === "number" && target.innerWidth > 0 ? target.innerWidth : 0;
  const docWidth =
    typeof target.document?.documentElement?.clientWidth === "number" &&
    target.document.documentElement.clientWidth > 0
      ? target.document.documentElement.clientWidth
      : 0;
  return Math.round(inner || docWidth || 1440);
}

/**
 * 3-Tier Breakpoint Classifier:
 * - "mobile":  width < mobileBreakpointPx (default < 768px)
 * - "tablet":  mobileBreakpointPx <= width <= tabletBreakpointPx (default 768px..1024px)
 * - "desktop": width > tabletBreakpointPx (default > 1024px)
 */
export function classifyBreakpointFromWidth(
  widthPx: number,
  mobileBreakpointPx = 768,
  tabletBreakpointPx = 1024
): EcmdViewportMode {
  const safeWidth = Math.max(0, Math.round(Number.isFinite(widthPx) ? widthPx : 1440));
  const mobileThreshold = Math.max(
    1,
    Math.round(Number.isFinite(mobileBreakpointPx) ? mobileBreakpointPx : 768)
  );
  const tabletThreshold = Math.max(
    mobileThreshold,
    Math.round(Number.isFinite(tabletBreakpointPx) ? tabletBreakpointPx : 1024)
  );

  if (safeWidth < mobileThreshold) return "mobile";
  if (safeWidth <= tabletThreshold) return "tablet";
  return "desktop";
}

export function computeEcmdBreakpointState(
  widthPx: number,
  mobileBreakpointPx = 768,
  tabletBreakpointPx = 1024
): EcmdBreakpointState {
  const safeWidth = Math.max(0, Math.round(Number.isFinite(widthPx) ? widthPx : 1440));
  const viewportMode = classifyBreakpointFromWidth(
    safeWidth,
    mobileBreakpointPx,
    tabletBreakpointPx
  );
  return {
    viewportMode,
    isDesktop: viewportMode === "desktop",
    isTablet: viewportMode === "tablet",
    isMobile: viewportMode === "mobile",
    viewportWidthPx: safeWidth,
    artboardTag: `${viewportMode}-${safeWidth}`,
  };
}

/**
 * Accurately detects the live viewport/iframe width across 3 tiers (Desktop / Tablet / Mobile)
 * via ResizeObserver + matchMedia + resize so side-by-side Plasmic Studio iframes
 * (e.g. desktop-1440, tablet-834, mobile-414) resolve independently.
 */
export function useEcmdBreakpoint(
  mobileBreakpointPx = 768,
  tabletBreakpointPx = 1024
): EcmdBreakpointState {
  // Always initialize deterministically to desktop-1440 so SSR HTML and initial client
  // hydration render match 100% across all artboards (e.g. mobile-413), then immediately
  // sync to the live iframe/window width before paint via useIsomorphicLayoutEffect.
  const [state, setState] = useState<EcmdBreakpointState>(() =>
    computeEcmdBreakpointState(1440, mobileBreakpointPx, tabletBreakpointPx)
  );

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const next = computeEcmdBreakpointState(
      getViewportWidthPx(window),
      mobileBreakpointPx,
      tabletBreakpointPx
    );
    setState((prev) =>
      prev.viewportMode === next.viewportMode &&
      prev.viewportWidthPx === next.viewportWidthPx &&
      prev.artboardTag === next.artboardTag
        ? prev
        : next
    );
  }, [mobileBreakpointPx, tabletBreakpointPx]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => {
      const next = computeEcmdBreakpointState(
        getViewportWidthPx(window),
        mobileBreakpointPx,
        tabletBreakpointPx
      );
      setState((prev) =>
        prev.viewportMode === next.viewportMode &&
        prev.viewportWidthPx === next.viewportWidthPx &&
        prev.artboardTag === next.artboardTag
          ? prev
          : next
      );
    };

    update();

    window.addEventListener("resize", update);

    const mqls: MediaQueryList[] = [];
    const safeMobile = Math.max(1, Math.round(mobileBreakpointPx));
    const safeTablet = Math.max(safeMobile, Math.round(tabletBreakpointPx));
    if (typeof window.matchMedia === "function") {
      const queries = [
        `(max-width: ${Math.max(0, safeMobile - 1)}px)`,
        `(max-width: ${safeTablet}px)`,
      ];
      for (const q of queries) {
        const mql = window.matchMedia(q);
        if (typeof mql.addEventListener === "function") {
          mql.addEventListener("change", update);
        } else if (typeof (mql as any).addListener === "function") {
          (mql as any).addListener(update);
        }
        mqls.push(mql);
      }
    }

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && document.documentElement) {
      try {
        ro = new ResizeObserver(() => update());
        ro.observe(document.documentElement);
      } catch {
        // Ignore environments without full ResizeObserver support
      }
    }

    return () => {
      window.removeEventListener("resize", update);
      for (const mql of mqls) {
        if (typeof mql.removeEventListener === "function") {
          mql.removeEventListener("change", update);
        } else if (typeof (mql as any).removeListener === "function") {
          (mql as any).removeListener(update);
        }
      }
      if (ro) ro.disconnect();
    };
  }, [mobileBreakpointPx, tabletBreakpointPx]);

  return state;
}

const ACTION_SELECTOR =
  "[data-ecmd-action], [data-ecmd-action-desktop], [data-ecmd-action-tablet], [data-ecmd-action-mobile]";

function normalizeViewportMode(modeOrIsMobile: EcmdViewportMode | boolean): EcmdViewportMode {
  if (typeof modeOrIsMobile === "boolean") {
    return modeOrIsMobile ? "mobile" : "desktop";
  }
  return modeOrIsMobile;
}

/**
 * Resolves the effective breakpoint-specific action on an element (or nearest ancestor):
 * - On mobile:  `data-ecmd-action-mobile`  -> fallback `data-ecmd-action`
 * - On tablet:  `data-ecmd-action-tablet`  -> fallback `data-ecmd-action`
 * - On desktop: `data-ecmd-action-desktop` -> fallback `data-ecmd-action`
 */
export function resolveBreakpointAction(
  el: HTMLElement | null | undefined,
  viewportModeOrIsMobile: EcmdViewportMode | boolean
): string | null {
  if (!el || typeof el.closest !== "function") return null;
  const host = el.closest(ACTION_SELECTOR) as HTMLElement | null;
  if (!host) return null;

  const mode = normalizeViewportMode(viewportModeOrIsMobile);
  const specificAttr =
    mode === "mobile"
      ? "data-ecmd-action-mobile"
      : mode === "tablet"
      ? "data-ecmd-action-tablet"
      : "data-ecmd-action-desktop";
  const specific = host.getAttribute(specificAttr)?.trim();
  if (specific) return specific;

  const fallback = host.getAttribute("data-ecmd-action")?.trim();
  return fallback || null;
}

export interface ExecuteBreakpointActionOptions {
  element?: HTMLElement | null;
  viewportMode?: EcmdViewportMode;
  isMobile?: boolean;
  payload?: Record<string, any>;
  onExpandInline?: () => void;
  onOpenModal?: () => void;
  onOpenDrawer?: () => void;
  onNavigate?: (url: string) => void;
}

export interface ExecutedBreakpointActionResult {
  handled: boolean;
  action: string;
  type: "expand-inline" | "open-modal" | "open-drawer" | "scroll-to" | "navigate" | "custom";
  target?: string;
}

export function executeBreakpointAction(
  rawAction: string,
  options: ExecuteBreakpointActionOptions
): ExecutedBreakpointActionResult {
  const action = (rawAction || "").trim();
  const viewportMode: EcmdViewportMode =
    options.viewportMode ?? (options.isMobile ? "mobile" : "desktop");
  const isMobile = viewportMode === "mobile";
  const isTablet = viewportMode === "tablet";
  const isDesktop = viewportMode === "desktop";

  let type: ExecutedBreakpointActionResult["type"] = "custom";
  let target: string | undefined;

  if (action === "expand-inline" || action === "inline") {
    type = "expand-inline";
  } else if (action === "open-modal" || action === "modal") {
    type = "open-modal";
  } else if (action === "open-drawer" || action === "drawer") {
    type = "open-drawer";
  } else if (action.startsWith("scroll-to:")) {
    type = "scroll-to";
    target = action.slice("scroll-to:".length).trim();
  } else if (action.startsWith("navigate:")) {
    type = "navigate";
    target = action.slice("navigate:".length).trim();
  }

  let defaultPrevented = false;
  if (typeof window !== "undefined") {
    const evt = new CustomEvent("ecmd:breakpoint-action", {
      bubbles: true,
      cancelable: true,
      detail: {
        action,
        type,
        target,
        isMobile,
        isTablet,
        isDesktop,
        viewportMode,
        element: options.element || null,
        payload: options.payload || {},
      },
    });
    window.dispatchEvent(evt);
    defaultPrevented = evt.defaultPrevented;
  }

  if (type === "expand-inline") {
    options.onExpandInline?.();
    return { handled: true, action, type };
  }
  if (type === "open-modal") {
    options.onOpenModal?.();
    return { handled: true, action, type };
  }
  if (type === "open-drawer") {
    options.onOpenDrawer?.();
    return { handled: true, action, type };
  }
  if (type === "scroll-to" && target && typeof document !== "undefined") {
    try {
      const dest = document.querySelector(target);
      if (dest && typeof dest.scrollIntoView === "function") {
        dest.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch {
      // Ignore invalid CSS selector
    }
    return { handled: true, action, type, target };
  }
  if (type === "navigate" && target) {
    if (options.onNavigate) {
      options.onNavigate(target);
    } else if (!defaultPrevented && typeof window !== "undefined" && window.location) {
      try {
        window.location.assign(target);
      } catch {
        // Ignore JSDOM navigation restriction
      }
    }
    return { handled: true, action, type, target };
  }

  return { handled: true, action, type: "custom" };
}

export function handleDelegatedBreakpointAction(
  target: EventTarget | null,
  options: ExecuteBreakpointActionOptions
): ExecutedBreakpointActionResult | null {
  if (!target || !(target instanceof HTMLElement)) return null;
  const mode: EcmdViewportMode = options.viewportMode ?? (options.isMobile ? "mobile" : "desktop");
  const action = resolveBreakpointAction(target, mode);
  if (!action) return null;
  return executeBreakpointAction(action, {
    ...options,
    viewportMode: mode,
    isMobile: mode === "mobile",
    element: target.closest(ACTION_SELECTOR) as HTMLElement | null,
  });
}
