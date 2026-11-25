import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePlasmicCanvasContext } from "@plasmicapp/host";
import { carbonQuery } from "../integrations/supabase/client";
import {
  Sparkles,
  Car,
  User,
  MapPin,
  Calendar,
  CheckCircle2,
  Repeat,
  Bot,
  Headphones,
  Briefcase,
  Shield,
  CreditCard,
  Gift,
  Wrench,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
} from "lucide-react";

export interface SiteMenuButtonItem {
  id?: number;
  button_id: string;
  slug: string;
  label: string;
  category: string;
  category_order: number;
  sort_order: number;
  icon_name?: string | null;
  css_classes?: string | null;
  action_key?: string | null;
  target_url?: string | null;
  enabled?: boolean;
  notes?: string | null;
}

export const DEFAULT_WIX_SITE_MENU_BUTTONS: SiteMenuButtonItem[] = [
  // 1. Services
  {
    button_id: "btn-automotive-detailing",
    slug: "automotive-detailing",
    label: "Automotive Detailing",
    category: "Services",
    category_order: 1,
    sort_order: 1,
    icon_name: "Sparkles",
    css_classes: "ecmd-group-4 text-buttons gm-menu-item side-menu-btn",
    action_key: "detailingPackages",
    target_url: "/#services",
    enabled: true,
    notes: "Wix sort 01, targetState: page02"
  },
  // 2. Garage & Profile
  {
    button_id: "btn-my-garage",
    slug: "my-garage",
    label: "My Garage",
    category: "Garage & Profile",
    category_order: 2,
    sort_order: 1,
    icon_name: "Car",
    css_classes: "ecmd-group-4 text-buttons gm-menu-item side-menu-btn",
    action_key: "garageProfileState",
    target_url: "/garage",
    enabled: true,
    notes: "Wix sort 03, targetState: garageProfileState"
  },
  {
    button_id: "btn-my-profile",
    slug: "my-profile",
    label: "My Profile",
    category: "Garage & Profile",
    category_order: 2,
    sort_order: 2,
    icon_name: "User",
    css_classes: "ecmd-group-4 text-buttons gm-menu-item side-menu-btn",
    action_key: "profileProfileState",
    target_url: "/profile",
    enabled: true,
    notes: "Wix sort 04, targetState: profileProfileState"
  },
  {
    button_id: "btn-contacts-locations",
    slug: "contacts-locations",
    label: "Contacts & Locations",
    category: "Garage & Profile",
    category_order: 2,
    sort_order: 3,
    icon_name: "MapPin",
    css_classes: "ecmd-group-4 text-buttons gm-menu-item side-menu-btn",
    action_key: "contactLocationsLightboxState",
    target_url: "/locations",
    enabled: true,
    notes: "Wix sort 05, targetState: contactLocationsLightboxState"
  },
  // 3. Bookings & Activity
  {
    button_id: "btn-upcoming-details",
    slug: "upcoming-details",
    label: "Up-Coming Details",
    category: "Bookings & Activity",
    category_order: 3,
    sort_order: 1,
    icon_name: "Calendar",
    css_classes: "ecmd-group-4 text-buttons gm-menu-item side-menu-btn",
    action_key: "upcomingProfileState",
    target_url: "/upcoming",
    enabled: true,
    notes: "Wix sort 07, targetState: upcomingProfileState"
  },
  {
    button_id: "btn-completed-details",
    slug: "completed-details",
    label: "Completed Details",
    category: "Bookings & Activity",
    category_order: 3,
    sort_order: 2,
    icon_name: "CheckCircle2",
    css_classes: "ecmd-group-4 text-buttons gm-menu-item side-menu-btn",
    action_key: "completedProfileState",
    target_url: "/history",
    enabled: true,
    notes: "Wix sort 08, targetState: completedProfileState"
  },
  {
    button_id: "btn-subscriptions",
    slug: "subscriptions",
    label: "Subscriptions",
    category: "Bookings & Activity",
    category_order: 3,
    sort_order: 3,
    icon_name: "Repeat",
    css_classes: "ecmd-group-4 text-buttons gm-menu-item side-menu-btn",
    action_key: "subscriptionsProfileState",
    target_url: "/subscriptions",
    enabled: true,
    notes: "Wix sort 09, targetState: subscriptionsProfileState"
  },
  // 4. Support & Intelligence
  {
    button_id: "btn-gemini-ai-assistant",
    slug: "gemini-ai-assistant",
    label: "Gemini A.I Assistant",
    category: "Support & Intelligence",
    category_order: 4,
    sort_order: 1,
    icon_name: "Bot",
    css_classes: "ecmd-group-4 text-buttons gm-menu-item side-menu-btn",
    action_key: "geminiAssistant",
    target_url: "/workflow",
    enabled: true,
    notes: "Wix sort 11, targetState: /gemini"
  },
  {
    button_id: "btn-customer-service",
    slug: "customer-service",
    label: "Customer Service",
    category: "Support & Intelligence",
    category_order: 4,
    sort_order: 2,
    icon_name: "Headphones",
    css_classes: "ecmd-group-4 text-buttons gm-menu-item side-menu-btn",
    action_key: "customerServiceProfileState",
    target_url: "/support",
    enabled: true,
    notes: "Wix sort 12, targetState: customerServiceProfileState"
  },
  {
    button_id: "btn-career-opportunities",
    slug: "career-opportunities",
    label: "Career Opportunities",
    category: "Support & Intelligence",
    category_order: 4,
    sort_order: 3,
    icon_name: "Briefcase",
    css_classes: "ecmd-group-4 text-buttons gm-menu-item side-menu-btn",
    action_key: "careerProfileState",
    target_url: "/careers",
    enabled: true,
    notes: "Wix sort 13, targetState: careerProfileState"
  },
  // 5. Billing & Security
  {
    button_id: "btn-login-security",
    slug: "login-security",
    label: "Login & Security",
    category: "Billing & Security",
    category_order: 5,
    sort_order: 1,
    icon_name: "Shield",
    css_classes: "ecmd-group-4 text-buttons gm-menu-item side-menu-btn",
    action_key: "loginSecurityProfileState",
    target_url: "/security",
    enabled: true,
    notes: "Wix sort 15, targetState: loginSecurityProfileState"
  },
  {
    button_id: "btn-payment-methods",
    slug: "payment-methods",
    label: "Payment Methods",
    category: "Billing & Security",
    category_order: 5,
    sort_order: 2,
    icon_name: "CreditCard",
    css_classes: "ecmd-group-4 text-buttons gm-menu-item side-menu-btn",
    action_key: "paymentMethodsProfileState",
    target_url: "/payment",
    enabled: true,
    notes: "Wix sort 16, targetState: paymentMethodsProfileState"
  },
  {
    button_id: "btn-gift-cards",
    slug: "gift-cards",
    label: "Gift Cards",
    category: "Billing & Security",
    category_order: 5,
    sort_order: 3,
    icon_name: "Gift",
    css_classes: "ecmd-group-4 text-buttons gm-menu-item side-menu-btn",
    action_key: "giftCardsState",
    target_url: "/gift-cards",
    enabled: true,
    notes: "Wix sort 17"
  },
  // 6. Staff & Operations
  {
    button_id: "btn-detailer-portal",
    slug: "detailer-portal",
    label: "Detailer Portal",
    category: "Staff & Operations",
    category_order: 6,
    sort_order: 1,
    icon_name: "Wrench",
    css_classes: "ecmd-group-4 text-buttons gm-menu-item side-menu-btn",
    action_key: "detailerJobState",
    target_url: "/detailer",
    enabled: true,
    notes: "Wix sort 19, sort2: 04"
  },
  {
    button_id: "btn-booking-hq",
    slug: "booking-hq",
    label: "Booking HQ",
    category: "Staff & Operations",
    category_order: 6,
    sort_order: 2,
    icon_name: "LayoutDashboard",
    css_classes: "ecmd-group-4 text-buttons gm-menu-item side-menu-btn",
    action_key: "bCalendar",
    target_url: "/booking-hq",
    enabled: true,
    notes: "Wix sort 20, sort2: 04"
  },
  // 7. Account Session
  {
    button_id: "btn-login",
    slug: "login",
    label: "Login",
    category: "Account Session",
    category_order: 7,
    sort_order: 1,
    icon_name: "LogIn",
    css_classes: "ecmd-group-4 text-buttons gm-menu-item side-menu-btn",
    action_key: "loginPromptsState",
    target_url: "/login",
    enabled: true,
    notes: "Wix sort 21, targetState: loginPromptsState"
  },
  {
    button_id: "btn-log-out",
    slug: "log-out",
    label: "Log-Out",
    category: "Account Session",
    category_order: 7,
    sort_order: 2,
    icon_name: "LogOut",
    css_classes: "ecmd-group-4 text-buttons gm-menu-item side-menu-btn",
    action_key: "logout",
    target_url: "/logout",
    enabled: true,
    notes: "Wix sort 22, targetState: logout"
  }
];

export interface EcmdSideMenuControllerProps {
  className?: string;
  triggerClassName?: string;
  dropdownCardClassName?: string;
  open?: boolean;
  defaultOpen?: boolean;
  enableLiveDropdown?: boolean;
  fixedBreakout?: boolean;
  align?: "left" | "right" | "center";
  offsetY?: number;
  cardWidth?: string;
  maskClosable?: boolean;
  closeOnSelect?: boolean;
  hideTrigger?: boolean;
  cardThemeGroup?: string;
  itemThemeGroup?: string;
  triggerThemeGroup?: string;
  syncFromSupabase?: boolean;
  activeButtonId?: string;
  onButtonClick?: (buttonId: string, item: SiteMenuButtonItem) => void;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  headerSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
  showHeaderSlot?: boolean;
  showFooterSlot?: boolean;
}

function renderMenuIcon(iconName?: string | null) {
  const size = 16;
  switch (iconName) {
    case "Sparkles":
      return <Sparkles size={size} />;
    case "Car":
      return <Car size={size} />;
    case "User":
      return <User size={size} />;
    case "MapPin":
      return <MapPin size={size} />;
    case "Calendar":
      return <Calendar size={size} />;
    case "CheckCircle2":
      return <CheckCircle2 size={size} />;
    case "Repeat":
      return <Repeat size={size} />;
    case "Bot":
      return <Bot size={size} />;
    case "Headphones":
      return <Headphones size={size} />;
    case "Briefcase":
      return <Briefcase size={size} />;
    case "Shield":
      return <Shield size={size} />;
    case "CreditCard":
      return <CreditCard size={size} />;
    case "Gift":
      return <Gift size={size} />;
    case "Wrench":
      return <Wrench size={size} />;
    case "LayoutDashboard":
      return <LayoutDashboard size={size} />;
    case "LogIn":
      return <LogIn size={size} />;
    case "LogOut":
      return <LogOut size={size} />;
    default:
      return <Sparkles size={size} />;
  }
}

export function EcmdSideMenuController({
  className,
  triggerClassName,
  dropdownCardClassName,
  open: controlledOpen,
  defaultOpen = false,
  enableLiveDropdown = true,
  fixedBreakout = true,
  align = "right",
  offsetY = 10,
  cardWidth = "240px",
  maskClosable = true,
  closeOnSelect = true,
  hideTrigger = false,
  cardThemeGroup = "ecmd-group-3",
  itemThemeGroup = "ecmd-group-4",
  triggerThemeGroup = "none",
  syncFromSupabase = true,
  activeButtonId,
  onButtonClick,
  onOpenChange,
  trigger,
  headerSlot,
  footerSlot,
  showHeaderSlot = false,
  showFooterSlot = false,
}: EcmdSideMenuControllerProps) {
  const inCanvas = usePlasmicCanvasContext();
  const isDesignCanvas = Boolean(inCanvas && !inCanvas.interactive);
  const uid = useId();

  const [isOpenState, setIsOpenState] = useState<boolean>(Boolean(defaultOpen || controlledOpen));
  const showMenu = isDesignCanvas
    ? (controlledOpen !== undefined ? controlledOpen : Boolean(defaultOpen || isOpenState))
    : isOpenState;

  const [buttons, setButtons] = useState<SiteMenuButtonItem[]>(DEFAULT_WIX_SITE_MENU_BUTTONS);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const trigRef = useRef<HTMLDivElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);

  // Mutual popover coordination: close when other popovers (e.g. theme-group, auth-modal) open
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOtherPopover = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail?.source && ce.detail.source !== "side-menu") {
        setIsOpenState(false);
        onOpenChange?.(false);
      }
    };
    window.addEventListener("ecmd-popover-opened", handleOtherPopover);
    return () => window.removeEventListener("ecmd-popover-opened", handleOtherPopover);
  }, [onOpenChange]);

  // Reliable native capture-phase click handler on trigRef (handles nested Header Button, SVGs, Links)
  useEffect(() => {
    const trigEl = trigRef.current;
    if (!trigEl) return;

    const handleCaptureClick = (e: MouseEvent) => {
      if (!enableLiveDropdown || isDesignCanvas) return;
      e.preventDefault();
      e.stopPropagation();
      setIsOpenState((prev) => {
        const next = !prev;
        onOpenChange?.(next);
        if (next && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("ecmd-popover-opened", { detail: { source: "side-menu" } }));
        }
        return next;
      });
    };

    trigEl.addEventListener("click", handleCaptureClick, true);
    return () => {
      trigEl.removeEventListener("click", handleCaptureClick, true);
    };
  }, [enableLiveDropdown, isDesignCanvas, onOpenChange]);

  const [fixedCoords, setFixedCoords] = useState<{ top: number; left?: number; right?: number }>({
    top: 48,
    right: 16,
  });

  // Runtime live sync from Supabase public.ecmd_site_menu_buttons if enabled
  useEffect(() => {
    if (!syncFromSupabase || isDesignCanvas || typeof window === "undefined") return;

    let isMounted = true;
    carbonQuery<SiteMenuButtonItem>(
      "SELECT id, button_id, slug, label, category, category_order, sort_order, icon_name, css_classes, action_key, target_url, enabled, notes FROM public.ecmd_site_menu_buttons WHERE enabled = true ORDER BY category_order, sort_order"
    )
      .then((rows) => {
        if (isMounted && rows && rows.length > 0) {
          setButtons(rows);
        }
      })
      .catch((err) => {
        console.warn("[EcmdSideMenuController] Supabase live sync fallback to default buttons:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [syncFromSupabase, isDesignCanvas]);

  // Compute fixed positioning
  const recomputePosition = useCallback(() => {
    if (!fixedBreakout) return;
    const anchor = trigRef.current || wrapRef.current;
    if (!anchor) return;
    const docWin = anchor.ownerDocument?.defaultView || window;
    const rect = anchor.getBoundingClientRect();
    const gap = Number.isFinite(Number(offsetY)) ? Number(offsetY) : 10;
    const top = Math.max(4, rect.bottom + gap);

    if (align === "right") {
      setFixedCoords({ top, right: Math.max(8, docWin.innerWidth - rect.right) });
    } else if (align === "center") {
      const numW = parseFloat(cardWidth) || 240;
      setFixedCoords({ top, left: Math.max(8, rect.left + rect.width / 2 - numW / 2) });
    } else {
      setFixedCoords({ top, left: Math.max(8, rect.left) });
    }
  }, [fixedBreakout, offsetY, align, cardWidth]);

  useLayoutEffect(() => {
    if (!showMenu || !fixedBreakout) return;
    recomputePosition();
    const anchor = trigRef.current || wrapRef.current;
    const win = anchor?.ownerDocument?.defaultView || window;
    win.addEventListener("resize", recomputePosition);
    win.addEventListener("scroll", recomputePosition, true);
    const timer = win.setInterval(recomputePosition, 200);
    return () => {
      win.removeEventListener("resize", recomputePosition);
      win.removeEventListener("scroll", recomputePosition, true);
      win.clearInterval(timer);
    };
  }, [showMenu, fixedBreakout, recomputePosition]);

  // Handle outside click & escape
  useEffect(() => {
    if (!showMenu || isDesignCanvas || typeof document === "undefined") return;
    const doc = wrapRef.current?.ownerDocument || document;
    const onDocClick = (e: MouseEvent) => {
      if (!maskClosable) return;
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || dropRef.current?.contains(target)) return;
      setIsOpenState(false);
      onOpenChange?.(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpenState(false);
        onOpenChange?.(false);
      }
    };
    doc.addEventListener("mousedown", onDocClick, true);
    doc.addEventListener("keydown", onKey, true);
    return () => {
      doc.removeEventListener("mousedown", onDocClick, true);
      doc.removeEventListener("keydown", onKey, true);
    };
  }, [maskClosable, showMenu, isDesignCanvas, onOpenChange]);

  // Group buttons by Wix category
  const groupedCategories = useMemo(() => {
    const map = new Map<string, { category: string; category_order: number; items: SiteMenuButtonItem[] }>();

    buttons.forEach((item) => {
      const catKey = item.category || "General";
      if (!map.has(catKey)) {
        map.set(catKey, {
          category: catKey,
          category_order: item.category_order || 99,
          items: [],
        });
      }
      map.get(catKey)!.items.push(item);
    });

    const groups = Array.from(map.values()).sort((a, b) => a.category_order - b.category_order);
    groups.forEach((g) => {
      g.items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    });

    return groups;
  }, [buttons]);

  // Alignment style for non-fixed position
  const absAlignStyle: React.CSSProperties =
    align === "right"
      ? { right: 0 }
      : align === "center"
      ? { left: "50%", transform: "translateX(-50%)" }
      : { left: 0 };

  const cardPositionStyle: React.CSSProperties = fixedBreakout
    ? {
        position: "fixed",
        top: fixedCoords.top + "px",
        ...(fixedCoords.left !== undefined ? { left: fixedCoords.left + "px" } : {}),
        ...(fixedCoords.right !== undefined ? { right: fixedCoords.right + "px" } : {}),
        width: cardWidth || "240px",
        zIndex: 2147483000,
      }
    : {
        position: "absolute",
        top: "calc(100% + " + (Number(offsetY) || 10) + "px)",
        ...absAlignStyle,
        width: cardWidth || "240px",
        zIndex: 9999,
      };

  const trigCls = [
    triggerThemeGroup && triggerThemeGroup !== "none" ? triggerThemeGroup : "",
    triggerClassName || "",
  ]
    .filter(Boolean)
    .join(" ");

  const cardCls = [
    cardThemeGroup && cardThemeGroup !== "none" ? cardThemeGroup : "ecmd-group-3",
    "modals",
    "side-menu",
    "side-menu-card",
    dropdownCardClassName || "",
  ]
    .filter(Boolean)
    .join(" ");

  const itemClsBase = [
    itemThemeGroup && itemThemeGroup !== "none" ? itemThemeGroup : "ecmd-group-4",
    "text-buttons",
    "gm-menu-item",
    "side-menu-btn",
  ]
    .filter(Boolean)
    .join(" ");

  const handleItemClick = (e: React.MouseEvent, item: SiteMenuButtonItem) => {
    e.stopPropagation();
    onButtonClick?.(item.button_id, item);

    if (closeOnSelect && !isDesignCanvas) {
      setIsOpenState(false);
      onOpenChange?.(false);
    }
  };

  return (
    <div
      ref={wrapRef}
      id={uid}
      className={className}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", overflow: "visible" }}
    >
      {/* Scoped CSS Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .side-menu-card {
              box-sizing: border-box;
              border-radius: 12px;
              padding: 6px;
              box-shadow: 0 16px 36px rgba(0, 0, 0, 0.32);
              border-width: 1px;
              border-style: solid;
              max-height: 85vh;
              overflow-y: auto;
              scrollbar-width: thin;
            }
            .ecmd-side-menu-divider {
              height: 1px;
              margin: 6px 8px;
              border: none;
              background: currentColor;
              opacity: 0.12;
            }
            .side-menu-btn {
              display: flex;
              align-items: center;
              width: 100%;
              gap: 10px;
              padding: 8px 12px;
              border-radius: 8px;
              border: none;
              background: transparent;
              font-family: inherit;
              font-size: 13px;
              font-weight: 500;
              text-align: left;
              cursor: pointer;
              transition: background 0.15s ease, color 0.15s ease;
              user-select: none;
              color: inherit;
              box-sizing: border-box;
            }
            .side-menu-btn:hover {
              background: rgba(125, 125, 125, 0.12);
            }
            .side-menu-btn.is-selected {
              background: rgba(20, 184, 166, 0.18) !important;
              color: #14B8A6 !important;
              font-weight: 600;
            }
            .side-menu-btn-icon {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 18px;
              height: 18px;
              flex-shrink: 0;
              color: inherit;
            }
            .side-menu-btn-label {
              flex: 1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.3;
            }
            .side-menu-hamburger-btn {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 36px;
              height: 36px;
              border-radius: 8px;
              border: 1px solid rgba(125, 125, 125, 0.2);
              background: transparent;
              cursor: pointer;
              color: inherit;
              transition: background 0.15s ease, border-color 0.15s ease;
            }
            .side-menu-hamburger-btn:hover {
              background: rgba(125, 125, 125, 0.1);
            }
            #ecmd-side-menu-trigger, #ecmd-side-menu-trigger * {
              cursor: pointer !important;
            }
          `,
        }}
      />

      {/* Trigger Button Slot */}
      {!hideTrigger && (
        <div
          ref={trigRef}
          id="ecmd-side-menu-trigger"
          data-ecmd-side-menu-trigger="true"
          className={trigCls}
          onClick={(e) => {
            if (e.defaultPrevented || !enableLiveDropdown || isDesignCanvas) return;
            setIsOpenState((prev) => {
              const next = !prev;
              onOpenChange?.(next);
              if (next && typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("ecmd-popover-opened", { detail: { source: "side-menu" } }));
              }
              return next;
            });
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            cursor: enableLiveDropdown ? "pointer" : "default",
            userSelect: "none",
          }}
        >
          {trigger || (
            <button
              type="button"
              className="side-menu-hamburger-btn"
              aria-label="Open Site Menu"
              aria-expanded={showMenu}
            >
              <Menu size={20} />
            </button>
          )}
        </div>
      )}

      {/* Popover / Modal Card */}
      {showMenu && (
        <div
          ref={dropRef}
          id="ecmd-side-menu-card"
          className={cardCls}
          style={cardPositionStyle}
          role="menu"
        >
          {/* Optional Header Slot */}
          {showHeaderSlot && headerSlot && <div id="ecmd-side-menu-header">{headerSlot}</div>}

          {/* Repeater List */}
          <div id="ecmd-side-menu-list">
            {groupedCategories.map((group, groupIdx) => (
              <React.Fragment key={group.category}>
                {/* Google-style horizontal divider between category groups */}
                {groupIdx > 0 && <div className="ecmd-side-menu-divider" role="separator" />}

                {group.items.map((item) => {
                  const isSelected = activeButtonId === item.button_id;
                  return (
                    <button
                      key={item.button_id}
                      id={`ecmd-menu-btn-${item.slug}`}
                      type="button"
                      role="menuitem"
                      className={`${itemClsBase} ${isSelected ? "is-selected" : ""}`}
                      data-ecmd-button-id={item.button_id}
                      data-ecmd-category={item.category}
                      data-ecmd-action-key={item.action_key || ""}
                      onClick={(e) => handleItemClick(e, item)}
                    >
                      <span className="side-menu-btn-icon theme-icon">
                        {renderMenuIcon(item.icon_name)}
                      </span>
                      <span className="side-menu-btn-label">{item.label}</span>
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>

          {/* Optional Footer Slot */}
          {showFooterSlot && footerSlot && <div id="ecmd-side-menu-footer">{footerSlot}</div>}
        </div>
      )}
    </div>
  );
}

export default EcmdSideMenuController;
