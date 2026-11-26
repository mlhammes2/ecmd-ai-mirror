import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { DataProvider } from "@plasmicapp/loader-react";
import { ensureEcmdRootSizingStyles } from "../lib/ecmdRootSizing";
import { useEcmdBreakpoint } from "../lib/useEcmdBreakpoint";
import {
  formatPackagePrice,
  getAddOnMemoryKey,
  loadSavedAddOnsMap,
  saveAddOnsMemoryMap,
  scopeToDetailType,
  type EcmdAddOnsMemoryMap,
  type EcmdSavedAddOnItem,
} from "../lib/ecmdPackageMatcher";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type WhatsIncludedItemRecord = Record<string, unknown>;

export interface EcmdOpenWhatsIncludedItemDetail {
  item?: WhatsIncludedItemRecord | null;
  items?: WhatsIncludedItemRecord[];
  packageLevel?: string;
  detailType?: string;
  subCategory?: string;
}

export interface EcmdWhatsIncludedItemPopupProps {
  isOpen?: boolean;
  onClose?: () => void;
  item?: WhatsIncludedItemRecord | null;
  items?: Array<WhatsIncludedItemRecord>;
  packageLevel?: string;
  detailType?: string;
  subCategory?: string;
  className?: string;
  style?: React.CSSProperties;
}

export interface EcmdWhatsIncludedItemPopupContext {
  isOpen: boolean;
  activeItem: WhatsIncludedItemRecord | null;
  items: WhatsIncludedItemRecord[];
  activeIndex: number;
  totalItems: number;
  title: string;
  category: string;
  packageLevel: string;
  detailType: string;
  subCategory: string;
  price: number;
  priceFormatted: string;
  mediaUrl: string | null;
  steps: string[];
  notice: string;
  canToggleAddOn: boolean;
  isAddOnSelected: boolean;
}

function SafePlasmicDataProvider({
  name,
  data,
  children,
}: {
  name: string;
  data: unknown;
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

function readStringField(item: WhatsIncludedItemRecord | null | undefined, keys: string[]): string {
  if (!item) return "";
  for (const key of keys) {
    const val = item[key];
    if (typeof val === "string" && val.trim()) {
      return val.trim();
    }
    if (typeof val === "number" && Number.isFinite(val)) {
      return String(val);
    }
  }
  return "";
}

export function getWhatsIncludedItemId(item: WhatsIncludedItemRecord | null | undefined): string {
  if (!item) return "";
  const raw = readStringField(item, ["wix_id", "_id", "id", "slug_id", "title", "button_title", "add_on_title", "name"]);
  return raw.trim();
}

export function getWhatsIncludedItemTitle(item: WhatsIncludedItemRecord | null | undefined): string {
  const raw = readStringField(item, [
    "title",
    "button_title",
    "buttonTitle",
    "add_on_title",
    "addOnTitle",
    "name",
  ]);
  const cleaned = raw.replace(/:+$/, "").trim();
  return cleaned || "Service Item";
}

export function resolveWhatsIncludedItemPrice(item: WhatsIncludedItemRecord | null | undefined): number {
  if (!item) return 0;
  const raw = item["price"] ?? item["addon_price"] ?? item["addOnPrice"];
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw > 0 ? raw : 0;
  }
  if (typeof raw === "string") {
    const cleaned = raw.replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  return 0;
}

export function isWhatsIncludedItemAddOn(item: WhatsIncludedItemRecord | null | undefined): boolean {
  if (!item) return false;
  if (resolveWhatsIncludedItemPrice(item) > 0) return true;
  const flagKeys = ["isAddOn", "is_addon", "isAddon", "addOn", "add_on", "addon"];
  for (const key of flagKeys) {
    const val = item[key];
    if (val === true || val === "true" || val === 1) return true;
  }
  return false;
}

export function resolveWhatsIncludedItemCategory(
  item: WhatsIncludedItemRecord | null | undefined,
  fallbackDetailType?: string
): string {
  if (item) {
    const direct = readStringField(item, ["category", "section", "scope"]);
    if (direct) return direct;

    const rawDetail = item["detail_type"] ?? item["detailType"];
    if (Array.isArray(rawDetail)) {
      const joined = rawDetail.map((v) => String(v ?? "").trim()).filter(Boolean).join(" / ");
      if (joined) return joined;
    } else if (typeof rawDetail === "string" && rawDetail.trim()) {
      const trimmed = rawDetail.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            const joined = parsed.map((v) => String(v ?? "").trim()).filter(Boolean).join(" / ");
            if (joined) return joined;
          }
        } catch {
          // fall through
        }
      }
      return trimmed.replace(/^["'\[\s]+|["'\]\s]+$/g, "");
    }
  }
  return fallbackDetailType ? String(fallbackDetailType).trim() : "";
}

export function resolveWhatsIncludedItemMediaUrl(
  item: WhatsIncludedItemRecord | null | undefined
): string | null {
  if (!item) return null;
  const candidate = readStringField(item, [
    "image",
    "image_url",
    "imageUrl",
    "media",
    "media_url",
    "mediaUrl",
    "photo",
    "photo_url",
    "thumbnail",
    "main_display_image",
  ]);
  if (!candidate) return null;
  if (
    candidate.startsWith("https://") ||
    candidate.startsWith("http://") ||
    candidate.startsWith("/") ||
    candidate.startsWith("data:image/")
  ) {
    return candidate;
  }
  return null;
}

function cleanStepLine(raw: string): string {
  return raw
    .replace(/^\s*(?:[-*•▪▸‣]|\d+[.)])\s+/, "")
    .trim();
}

function parseStepSourceValue(val: unknown): string[] {
  if (Array.isArray(val)) {
    return val
      .map((entry) => {
        if (typeof entry === "string") return cleanStepLine(entry);
        if (entry && typeof entry === "object") {
          const rec = entry as Record<string, unknown>;
          const txt = rec["text"] ?? rec["step"] ?? rec["title"] ?? rec["label"] ?? "";
          return cleanStepLine(String(txt));
        }
        return cleanStepLine(String(entry ?? ""));
      })
      .filter(Boolean);
  }
  if (typeof val !== "string") return [];
  const trimmed = val.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parseStepSourceValue(parsed);
      }
    } catch {
      // fall through to line splitting
    }
  }
  return trimmed
    .split(/\r?\n|•/)
    .map(cleanStepLine)
    .filter(Boolean);
}

/**
 * Parses step-by-step / bullet lines cleanly from `steps` / `bullets` / `details` / `description`,
 * filtering empty lines and deduplicating cleanly.
 */
export function parseWhatsIncludedItemSteps(
  item: WhatsIncludedItemRecord | null | undefined
): string[] {
  if (!item) return [];
  const candidateKeys = ["steps", "bullets", "details", "description", "overview", "intro"];
  for (const key of candidateKeys) {
    const parsed = parseStepSourceValue(item[key]);
    if (parsed.length > 0) {
      return parsed;
    }
  }
  return [];
}

function toSavedAddOnFromRecord(item: WhatsIncludedItemRecord): EcmdSavedAddOnItem {
  const id = getWhatsIncludedItemId(item);
  const rawWixId = item["wix_id"];
  const rawId = item["id"];
  const rawUnderscoreId = item["_id"];
  const title = readStringField(item, [
    "add_on_title",
    "addOnTitle",
    "button_title",
    "buttonTitle",
    "title",
    "name",
  ]).replace(/:+$/, "").trim() || getWhatsIncludedItemTitle(item);

  const saved: EcmdSavedAddOnItem = {
    id: typeof rawId === "number" || typeof rawId === "string" ? rawId : id,
    _id:
      typeof rawUnderscoreId === "string" && rawUnderscoreId.trim()
        ? rawUnderscoreId
        : typeof rawWixId === "string" && rawWixId.trim()
        ? rawWixId
        : id,
    title,
    price: resolveWhatsIncludedItemPrice(item),
  };

  if (typeof rawWixId === "string" && rawWixId.trim()) {
    saved.wix_id = rawWixId.trim();
  }

  return saved;
}

function findItemIndex(
  items: WhatsIncludedItemRecord[],
  target: WhatsIncludedItemRecord | null | undefined
): number {
  if (!target || items.length === 0) return 0;
  const directIdx = items.indexOf(target);
  if (directIdx >= 0) return directIdx;
  const targetId = getWhatsIncludedItemId(target);
  if (!targetId) return 0;
  const matchedIdx = items.findIndex((entry) => getWhatsIncludedItemId(entry) === targetId);
  return matchedIdx >= 0 ? matchedIdx : 0;
}

export function EcmdWhatsIncludedItemPopup({
  isOpen: controlledIsOpen,
  onClose,
  item: itemProp,
  items: itemsProp,
  packageLevel: packageLevelProp,
  detailType: detailTypeProp,
  subCategory: subCategoryProp,
  className = "",
  style,
}: EcmdWhatsIncludedItemPopupProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState<boolean>(false);
  const [eventItems, setEventItems] = useState<WhatsIncludedItemRecord[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [eventLevel, setEventLevel] = useState<string>("");
  const [eventDetailType, setEventDetailType] = useState<string>("");
  const [eventSubCategory, setEventSubCategory] = useState<string>("");
  const [addOnsMap, setAddOnsMap] = useState<EcmdAddOnsMemoryMap>({});

  const rootRef = useRef<HTMLDivElement>(null);
  const { viewportMode, isMobile } = useEcmdBreakpoint();

  const isPopupOpen = controlledIsOpen !== undefined ? Boolean(controlledIsOpen) : uncontrolledOpen;

  useIsomorphicLayoutEffect(() => {
    ensureEcmdRootSizingStyles(rootRef.current?.ownerDocument);
  }, []);

  // Resolve active items list from event payload or controlled props
  const resolvedItems = useMemo<WhatsIncludedItemRecord[]>(() => {
    if (eventItems.length > 0) return eventItems;
    if (Array.isArray(itemsProp) && itemsProp.length > 0) return itemsProp;
    if (itemProp) return [itemProp];
    return [];
  }, [eventItems, itemsProp, itemProp]);

  // Sync activeIndex when controlled props change
  useEffect(() => {
    if (eventItems.length > 0) return;
    if (Array.isArray(itemsProp) && itemsProp.length > 0) {
      setActiveIndex(findItemIndex(itemsProp, itemProp));
    } else {
      setActiveIndex(0);
    }
  }, [itemsProp, itemProp, eventItems.length]);

  const safeIndex =
    resolvedItems.length > 0 ? ((activeIndex % resolvedItems.length) + resolvedItems.length) % resolvedItems.length : 0;
  const activeItem: WhatsIncludedItemRecord | null =
    resolvedItems.length > 0 ? (resolvedItems[safeIndex] ?? null) : (itemProp ?? null);

  const resolvedLevel = (eventLevel || packageLevelProp || "Classic").trim();
  const resolvedDetailType = scopeToDetailType(eventDetailType || detailTypeProp || "Full");
  const resolvedSubCategory = (eventSubCategory || subCategoryProp || "").trim();

  // Hydrate add-ons memory on client & stay synced
  useEffect(() => {
    if (typeof window === "undefined") return;
    setAddOnsMap(loadSavedAddOnsMap());

    const syncFromStorage = () => {
      setAddOnsMap(loadSavedAddOnsMap());
    };
    window.addEventListener("ecmd-addons-change", syncFromStorage);
    window.addEventListener("ecmd-addons-updated", syncFromStorage);
    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.removeEventListener("ecmd-addons-change", syncFromStorage);
      window.removeEventListener("ecmd-addons-updated", syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  const handleClose = useCallback(() => {
    if (controlledIsOpen === undefined) {
      setUncontrolledOpen(false);
    }
    if (onClose) {
      onClose();
    }
  }, [controlledIsOpen, onClose]);

  // Listen to `ecmd-open-whats-included-item`
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOpenItemEvent = (e: Event) => {
      const detail =
        e instanceof CustomEvent
          ? (e.detail as EcmdOpenWhatsIncludedItemDetail | undefined)
          : undefined;

      if (!detail) return;

      const incomingItems = Array.isArray(detail.items) && detail.items.length > 0
        ? detail.items
        : detail.item
        ? [detail.item]
        : [];

      if (incomingItems.length === 0) return;

      const idx = findItemIndex(incomingItems, detail.item ?? incomingItems[0]);
      setEventItems(incomingItems);
      setActiveIndex(idx);
      setEventLevel(typeof detail.packageLevel === "string" ? detail.packageLevel.trim() : "");
      setEventDetailType(typeof detail.detailType === "string" ? detail.detailType.trim() : "");
      setEventSubCategory(typeof detail.subCategory === "string" ? detail.subCategory.trim() : "");
      setAddOnsMap(loadSavedAddOnsMap());

      if (controlledIsOpen === undefined) {
        setUncontrolledOpen(true);
      }
    };

    window.addEventListener("ecmd-open-whats-included-item", handleOpenItemEvent);
    return () => {
      window.removeEventListener("ecmd-open-whats-included-item", handleOpenItemEvent);
    };
  }, [controlledIsOpen]);

  // Escape key close (capture phase so closing this popup doesn't also dismiss an underlying modal)
  useEffect(() => {
    if (!isPopupOpen || typeof document === "undefined") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        handleClose();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [isPopupOpen, handleClose]);

  const title = getWhatsIncludedItemTitle(activeItem);
  const category = resolveWhatsIncludedItemCategory(activeItem, resolvedDetailType);
  const price = resolveWhatsIncludedItemPrice(activeItem);
  const priceFormatted = price > 0 ? `+${formatPackagePrice(price)}` : "";
  const mediaUrl = resolveWhatsIncludedItemMediaUrl(activeItem);
  const steps = useMemo(() => parseWhatsIncludedItemSteps(activeItem), [activeItem]);
  const notice = readStringField(activeItem, ["notice"]);
  const canToggleAddOn = isWhatsIncludedItemAddOn(activeItem);

  const memoryKey = getAddOnMemoryKey(resolvedLevel, resolvedDetailType);
  const selectedAddOns = useMemo<EcmdSavedAddOnItem[]>(
    () => (Array.isArray(addOnsMap[memoryKey]) ? addOnsMap[memoryKey] : []),
    [addOnsMap, memoryKey]
  );

  const activeItemId = getWhatsIncludedItemId(activeItem);
  const isAddOnSelected = useMemo(() => {
    if (!activeItemId) return false;
    return selectedAddOns.some((entry) => {
      const entryId = String(entry.wix_id ?? entry._id ?? entry.id ?? entry.title ?? "").trim();
      return entryId === activeItemId;
    });
  }, [selectedAddOns, activeItemId]);

  const handlePrev = useCallback(() => {
    if (resolvedItems.length <= 1) return;
    setActiveIndex((prev) => (prev - 1 + resolvedItems.length) % resolvedItems.length);
  }, [resolvedItems.length]);

  const handleNext = useCallback(() => {
    if (resolvedItems.length <= 1) return;
    setActiveIndex((prev) => (prev + 1) % resolvedItems.length);
  }, [resolvedItems.length]);

  const handleToggleAddOn = useCallback(() => {
    if (!activeItem || !canToggleAddOn) return;
    const targetId = getWhatsIncludedItemId(activeItem);
    if (!targetId) return;

    const currentMap = loadSavedAddOnsMap();
    const existing = Array.isArray(currentMap[memoryKey]) ? currentMap[memoryKey] : [];
    const alreadyChecked = existing.some((entry) => {
      const entryId = String(entry.wix_id ?? entry._id ?? entry.id ?? entry.title ?? "").trim();
      return entryId === targetId;
    });

    const nextList: EcmdSavedAddOnItem[] = alreadyChecked
      ? existing.filter((entry) => {
          const entryId = String(entry.wix_id ?? entry._id ?? entry.id ?? entry.title ?? "").trim();
          return entryId !== targetId;
        })
      : [...existing, toSavedAddOnFromRecord(activeItem)];

    const nextMap: EcmdAddOnsMemoryMap = {
      ...currentMap,
      [memoryKey]: nextList,
    };

    saveAddOnsMemoryMap(nextMap);
    setAddOnsMap(nextMap);

    const nextAddOnsTotal = nextList.reduce((sum, a) => sum + (Number(a?.price) || 0), 0);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ecmd-addons-change", {
          detail: {
            level: resolvedLevel,
            detailType: resolvedDetailType,
            memoryKey,
            selectedAddOns: nextList,
            addOnsMap: nextMap,
            addOnsTotal: nextAddOnsTotal,
            source: "EcmdWhatsIncludedItemPopup",
          },
        })
      );
    }
  }, [activeItem, canToggleAddOn, memoryKey, resolvedLevel, resolvedDetailType]);

  const providerData: EcmdWhatsIncludedItemPopupContext = {
    isOpen: isPopupOpen,
    activeItem,
    items: resolvedItems,
    activeIndex: safeIndex,
    totalItems: resolvedItems.length,
    title,
    category,
    packageLevel: resolvedLevel,
    detailType: resolvedDetailType,
    subCategory: resolvedSubCategory,
    price,
    priceFormatted,
    mediaUrl,
    steps,
    notice,
    canToggleAddOn,
    isAddOnSelected,
  };

  const badgeParts = [resolvedLevel, category, priceFormatted].filter(Boolean);

  // Zero-Inline-Width Root Law + exactOptionalPropertyTypes safety
  const rootStyleProps = style ? { style: { ...style } } : {};

  return (
    <SafePlasmicDataProvider name="ecmdWhatsIncludedItem" data={providerData}>
      <div
        ref={rootRef}
        className={`ecmd-whats-included-item-popup-root ${className}`.trim()}
        data-ecmd-viewport={viewportMode}
        data-ecmd-wi-item="root"
        data-ecmd-open={isPopupOpen ? "true" : "false"}
        {...rootStyleProps}
      >
        {isPopupOpen && activeItem && (
          <div
            data-ecmd-wi-item="backdrop"
            onClick={handleClose}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10050,
              backgroundColor: "rgba(2, 6, 23, 0.8)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: isMobile ? "flex-end" : "center",
              justifyContent: "center",
              padding: isMobile ? "0px" : "20px",
              boxSizing: "border-box",
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              data-ecmd-wi-item="popup"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(560px, 100%)",
                maxHeight: "88vh",
                overflowY: "auto",
                backgroundColor: "#0F172A",
                color: "#F8FAFC",
                border: "1px solid rgba(84, 233, 234, 0.4)",
                borderRadius: isMobile ? "16px 16px 0 0" : "16px",
                padding: isMobile ? "18px" : "24px",
                boxShadow: "0 24px 64px rgba(2, 6, 23, 0.8)",
                boxSizing: "border-box",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "12px",
                  paddingBottom: "14px",
                  borderBottom: "1px solid rgba(148, 163, 184, 0.2)",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  {badgeParts.length > 0 && (
                    <div
                      data-ecmd-wi-item="badge"
                      style={{
                        display: "inline-flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "6px",
                        padding: "3px 10px",
                        borderRadius: "999px",
                        backgroundColor: "rgba(84, 233, 234, 0.14)",
                        border: "1px solid rgba(84, 233, 234, 0.35)",
                        color: "#54E9EA",
                        fontSize: "12px",
                        fontWeight: 700,
                        marginBottom: "8px",
                      }}
                    >
                      {badgeParts.join(" • ")}
                    </div>
                  )}
                  <h3
                    data-ecmd-wi-item="title"
                    style={{
                      margin: 0,
                      fontSize: isMobile ? "18px" : "21px",
                      fontWeight: 800,
                      color: "#F8FAFC",
                      lineHeight: 1.25,
                    }}
                  >
                    {title}
                  </h3>
                  {resolvedSubCategory && (
                    <div style={{ marginTop: "4px", fontSize: "12px", color: "#94A3B8" }}>
                      {resolvedSubCategory}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  data-ecmd-wi-item="close"
                  data-ecmd-action="close-wi-item-popup"
                  aria-label="Close item details"
                  onClick={handleClose}
                  style={{
                    background: "rgba(148, 163, 184, 0.14)",
                    border: "1px solid rgba(148, 163, 184, 0.3)",
                    borderRadius: "8px",
                    color: "#E2E8F0",
                    padding: "6px 12px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Optional Preview Image */}
              {mediaUrl && (
                <div
                  style={{
                    marginTop: "14px",
                    borderRadius: "10px",
                    overflow: "hidden",
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                    backgroundColor: "rgba(2, 6, 23, 0.55)",
                  }}
                >
                  <img
                    data-ecmd-wi-item="media"
                    src={mediaUrl}
                    alt={title}
                    style={{
                      display: "block",
                      width: "100%",
                      maxHeight: "240px",
                      objectFit: "cover",
                    }}
                  />
                </div>
              )}

              {/* Step-by-step / bullet breakdown list */}
              <div style={{ marginTop: "16px" }}>
                {steps.length > 0 ? (
                  <ul
                    data-ecmd-wi-item="steps"
                    style={{
                      listStyle: "none",
                      margin: 0,
                      padding: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {steps.map((step, idx) => (
                      <li
                        key={`${idx}-${step.slice(0, 24)}`}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          padding: "9px 12px",
                          borderRadius: "8px",
                          backgroundColor: "rgba(30, 41, 59, 0.65)",
                          border: "1px solid rgba(148, 163, 184, 0.16)",
                          fontSize: "13px",
                          lineHeight: 1.45,
                          color: "#E2E8F0",
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            color: "#54E9EA",
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          ✓
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul
                    data-ecmd-wi-item="steps"
                    style={{
                      listStyle: "none",
                      margin: 0,
                      padding: 0,
                    }}
                  >
                    <li
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(30, 41, 59, 0.45)",
                        fontSize: "13px",
                        color: "#94A3B8",
                      }}
                    >
                      Included service treatment performed to Emerald Coast Mobile Detailing standards.
                    </li>
                  </ul>
                )}
              </div>

              {/* Optional Notice */}
              {notice && (
                <div
                  data-ecmd-wi-item="notice"
                  role="note"
                  style={{
                    marginTop: "14px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(245, 158, 11, 0.14)",
                    border: "1px solid rgba(245, 158, 11, 0.4)",
                    color: "#FDE68A",
                    fontSize: "12px",
                    lineHeight: 1.45,
                  }}
                >
                  {notice}
                </div>
              )}

              {/* Footer: Prev / Next & Add-On Toggle */}
              <div
                style={{
                  marginTop: "18px",
                  paddingTop: "14px",
                  borderTop: "1px solid rgba(148, 163, 184, 0.2)",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {resolvedItems.length > 1 && (
                    <>
                      <button
                        type="button"
                        data-ecmd-wi-item="prev"
                        data-ecmd-action="wi-item-prev"
                        onClick={handlePrev}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "8px",
                          border: "1px solid rgba(148, 163, 184, 0.3)",
                          backgroundColor: "rgba(30, 41, 59, 0.75)",
                          color: "#E2E8F0",
                          fontSize: "13px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        ← Prev
                      </button>
                      <span
                        data-ecmd-wi-item="counter"
                        style={{ fontSize: "12px", color: "#94A3B8", fontWeight: 600 }}
                      >
                        {safeIndex + 1} / {resolvedItems.length}
                      </span>
                      <button
                        type="button"
                        data-ecmd-wi-item="next"
                        data-ecmd-action="wi-item-next"
                        onClick={handleNext}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "8px",
                          border: "1px solid rgba(148, 163, 184, 0.3)",
                          backgroundColor: "rgba(30, 41, 59, 0.75)",
                          color: "#E2E8F0",
                          fontSize: "13px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Next →
                      </button>
                    </>
                  )}
                </div>

                {canToggleAddOn && (
                  <button
                    type="button"
                    data-ecmd-wi-item="toggle-addon"
                    data-ecmd-action="wi-item-toggle-addon"
                    data-ecmd-selected={isAddOnSelected ? "true" : "false"}
                    aria-pressed={isAddOnSelected}
                    onClick={handleToggleAddOn}
                    style={{
                      padding: "9px 16px",
                      borderRadius: "10px",
                      border: isAddOnSelected
                        ? "1px solid #10B981"
                        : "1px solid rgba(84, 233, 234, 0.45)",
                      backgroundColor: isAddOnSelected
                        ? "rgba(16, 185, 129, 0.22)"
                        : "rgba(14, 165, 233, 0.22)",
                      color: isAddOnSelected ? "#34D399" : "#F8FAFC",
                      fontSize: "13px",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {isAddOnSelected
                      ? `✓ Added (${priceFormatted || "Add-On"})`
                      : `Add to Package${priceFormatted ? ` (${priceFormatted})` : ""}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </SafePlasmicDataProvider>
  );
}
