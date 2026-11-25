import React, { useEffect, useRef, useState } from "react";
import {
  buildImageGroupSelector,
  copyImageGroupAttributes,
  createThemeImageGroup,
  deleteThemeImageGroup,
  extractPrimaryImageClass,
  filterAndSortImageGroups,
  getThemeImageGroupVariant,
  syncImageGroupSlotsAcrossThemes,
  updateThemeImageGroupMeta,
  updateThemeImageGroupVariant,
  uploadThemeAssetFile,
  type ThemeImageGroup,
  type ThemeImageGroupCopyScope,
  type ThemeImageObjectFit,
  type ThemeImageVariantConfig,
  type ThemeListSortMode,
} from "../lib/ecmdThemeEngine";

const IMAGES_SORT_STORAGE_KEY = "ecmd_theme_images_sort_v1";

function loadImagesSortPref(): ThemeListSortMode {
  try {
    const raw = window.localStorage.getItem(IMAGES_SORT_STORAGE_KEY);
    if (raw === "za" || raw === "custom") return raw;
  } catch {}
  return "az";
}

export interface EcmdThemeImagesTabProps {
  imageGroups: ThemeImageGroup[];
  activePalette: string; // "cl" | "ms"
  ownerDoc?: Document | null;
  onChange: (nextGroups: ThemeImageGroup[]) => void;
}

const OBJECT_FIT_OPTIONS: Array<{ value: ThemeImageObjectFit; label: string }> = [
  { value: "contain", label: "Contain (Default)" },
  { value: "cover", label: "Cover" },
  { value: "scale-down", label: "Scale Down" },
  { value: "fill", label: "Fill (Stretch)" },
  { value: "none", label: "None (Original)" },
];

const OBJECT_POSITION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "left center", label: "Left Center" },
  { value: "center", label: "Center" },
  { value: "right center", label: "Right Center" },
  { value: "top center", label: "Top Center" },
  { value: "bottom center", label: "Bottom Center" },
];

const ACCEPTED_IMAGE_TYPES =
  "image/svg+xml,image/png,image/webp,image/jpeg,image/gif,image/avif,.svg,.png,.webp,.jpg,.jpeg,.gif,.avif";

function resolveCanvasPickedSelector(el: Element, fallbackGroupId: string): string {
  const mediaTarget =
    el.tagName.toLowerCase() === "img" || el.tagName.toLowerCase() === "svg"
      ? el
      : el.querySelector("img, svg") || el;

  const existingEcmdClass = Array.from(mediaTarget.classList || []).find((c) =>
    c.startsWith("ecmd-img-")
  );
  if (existingEcmdClass) return `.${existingEcmdClass}`;

  const elId = mediaTarget.getAttribute("id")?.trim();
  if (elId && !elId.startsWith("ecmd-tg-") && !elId.startsWith("plasmic")) {
    return `#${elId}`;
  }

  const customClass = Array.from(mediaTarget.classList || []).find(
    (c) =>
      c &&
      !c.startsWith("__wab_") &&
      !c.startsWith("plasmic_") &&
      !c.startsWith("Plasmic") &&
      !c.startsWith("root_reset")
  );
  if (customClass) return `.${customClass}`;

  const fallbackCls = `ecmd-img-${fallbackGroupId}`;
  mediaTarget.classList.add(fallbackCls);
  return `.${fallbackCls}`;
}

export function EcmdThemeImagesTab({
  imageGroups,
  activePalette,
  ownerDoc,
  onChange,
}: EcmdThemeImagesTabProps) {
  const syncedGroups = syncImageGroupSlotsAcrossThemes(imageGroups);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pickingGroupId, setPickingGroupId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [storageModeByKey, setStorageModeByKey] = useState<Record<string, "supabase" | "data-uri">>({});
  const [darkPreviewById, setDarkPreviewById] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<ThemeListSortMode>(() => loadImagesSortPref());
  const [focusedRenameId, setFocusedRenameId] = useState<string | null>(null);
  const [frozenOrderIds, setFrozenOrderIds] = useState<string[] | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [copyMenuTargetId, setCopyMenuTargetId] = useState<string | null>(null);
  const [copyIncludeAsset, setCopyIncludeAsset] = useState<boolean>(false);
  const [copyScope, setCopyScope] = useState<ThemeImageGroupCopyScope>("activeTheme");
  const [copySearch, setCopySearch] = useState<string>("");
  const [copyUndoNotice, setCopyUndoNotice] = useState<{
    targetId: string;
    sourceLabel: string;
    modeLabel: string;
    previousGroups: ThemeImageGroup[];
  } | null>(null);
  const copyUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const labelInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingFocusIdRef = useRef<string | null>(null);

  const isMs = activePalette === "ms" || activePalette === "midnight-slate";

  useEffect(() => {
    try {
      window.localStorage.setItem(IMAGES_SORT_STORAGE_KEY, sortBy);
    } catch {}
  }, [sortBy]);

  const visibleImageGroups = filterAndSortImageGroups(syncedGroups, {
    query: searchQuery,
    sortBy,
    activePalette,
    frozenOrderIds: focusedRenameId !== null ? frozenOrderIds || undefined : undefined,
    focusedRenameId,
  });

  useEffect(() => {
    const targetId = pendingFocusIdRef.current;
    if (!targetId) return;
    pendingFocusIdRef.current = null;
    const focusNewCard = () => {
      const cardEl = cardRefs.current[targetId];
      if (cardEl && typeof cardEl.scrollIntoView === "function") {
        try {
          cardEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } catch {}
      }
      const inputEl = labelInputRefs.current[targetId];
      if (inputEl && typeof inputEl.focus === "function") {
        inputEl.focus();
      }
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(focusNewCard);
    } else {
      setTimeout(focusNewCard, 0);
    }
  }, [syncedGroups]);

  // Interactive Canvas Element Picker ([🎯 Pick on Canvas])
  useEffect(() => {
    if (!pickingGroupId) return;
    const doc = ownerDoc || (typeof document !== "undefined" ? document : null);
    if (!doc) return;

    let hoveredEl: HTMLElement | SVGElement | null = null;
    let prevOutline = "";

    const clearHover = () => {
      if (hoveredEl) {
        hoveredEl.style.outline = prevOutline;
        hoveredEl = null;
      }
    };

    const onMouseMove = (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      if (!target || target.closest("[data-ecmd-images-tab-root]")) {
        clearHover();
        return;
      }
      const highlight = (target.closest("img, svg") || target) as HTMLElement | SVGElement;
      if (highlight !== hoveredEl) {
        clearHover();
        hoveredEl = highlight;
        prevOutline = highlight.style.outline || "";
        highlight.style.outline = "2px solid #0D9488";
      }
    };

    const onClick = (ev: MouseEvent) => {
      const target = ev.target as Element | null;
      if (!target || target.closest("[data-ecmd-images-tab-root]")) return;
      ev.preventDefault();
      ev.stopPropagation();
      const sel = resolveCanvasPickedSelector(target, pickingGroupId);
      clearHover();
      onChange(updateThemeImageGroupMeta(syncedGroups, pickingGroupId, { selector: sel }));
      setPickingGroupId(null);
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        clearHover();
        setPickingGroupId(null);
      }
    };

    doc.addEventListener("mousemove", onMouseMove, true);
    doc.addEventListener("click", onClick, true);
    doc.addEventListener("keydown", onKeyDown, true);
    return () => {
      clearHover();
      doc.removeEventListener("mousemove", onMouseMove, true);
      doc.removeEventListener("click", onClick, true);
      doc.removeEventListener("keydown", onKeyDown, true);
    };
  }, [pickingGroupId, ownerDoc, syncedGroups, onChange]);

  const handleAddImageGroup = () => {
    const created = createThemeImageGroup(syncedGroups);
    setSearchQuery("");
    setFocusedRenameId(null);
    setFrozenOrderIds(null);
    setCollapsedIds((prev) => {
      if (!prev.has(created.id)) return prev;
      const next = new Set(prev);
      next.delete(created.id);
      return next;
    });
    pendingFocusIdRef.current = created.id;
    onChange([...syncedGroups, created]);
  };

  const handleToggleImagePin = (groupId: string, currentlyPinned?: boolean) => {
    onChange(updateThemeImageGroupMeta(syncedGroups, groupId, { pinned: !currentlyPinned }));
  };

  const handleToggleImageCollapse = (groupId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleCollapseAllImages = () => {
    setCollapsedIds(new Set(syncedGroups.map((g) => g.id)));
  };

  const handleExpandAllImages = () => {
    setCollapsedIds(new Set());
  };

  const handleRenameFocus = (groupId: string) => {
    setFocusedRenameId(groupId);
    setFrozenOrderIds((prev) =>
      prev && prev.length > 0 ? prev : visibleImageGroups.map((g) => g.id)
    );
  };

  const handleRenameBlur = (groupId: string) => {
    setFocusedRenameId((prev) => {
      if (prev === groupId) {
        setFrozenOrderIds(null);
        return null;
      }
      return prev;
    });
  };

  const handleDeleteImageGroup = (groupId: string) => {
    onChange(deleteThemeImageGroup(syncedGroups, groupId));
  };

  const handleUpdateVariant = (groupId: string, patch: Partial<ThemeImageVariantConfig>) => {
    onChange(updateThemeImageGroupVariant(syncedGroups, groupId, activePalette, patch));
  };

  const handleFileUpload = async (groupId: string, file: File | null | undefined) => {
    if (!file) return;
    setUploadingId(groupId);
    try {
      const result = await uploadThemeAssetFile(file, { groupId, themeKey: activePalette });
      if (result.url) {
        setStorageModeByKey((prev) => ({
          ...prev,
          [`${groupId}:${activePalette}`]: result.storageMode,
        }));
        handleUpdateVariant(groupId, {
          assetUrl: result.url,
          assetName: result.fileName,
        });
      }
    } finally {
      setUploadingId(null);
    }
  };

  const handleCopyClass = (group: ThemeImageGroup) => {
    const cls = extractPrimaryImageClass(group.selector);
    if (!cls) return;
    try {
      navigator.clipboard?.writeText(cls);
    } catch {}
    setCopiedId(group.id);
    setTimeout(() => setCopiedId((prev) => (prev === group.id ? null : prev)), 1500);
  };

  useEffect(() => {
    return () => {
      if (copyUndoTimerRef.current) {
        clearTimeout(copyUndoTimerRef.current);
      }
    };
  }, []);

  const handleCopyImageAttributesFrom = (
    targetGroupId: string,
    sourceGroup: ThemeImageGroup
  ) => {
    if (sourceGroup.id === targetGroupId) return;
    const preCopySnapshot = JSON.parse(JSON.stringify(syncedGroups)) as ThemeImageGroup[];
    const nextGroups = copyImageGroupAttributes({
      themes: syncedGroups,
      activeThemeId: activePalette,
      sourceImageGroupId: sourceGroup.id,
      targetImageGroupId: targetGroupId,
      scope: copyScope,
      includeAsset: copyIncludeAsset,
    });
    onChange(nextGroups);
    setCopyMenuTargetId(null);
    setCopySearch("");
    const modeLabel = `${copyIncludeAsset ? "Sizing + Asset" : "Sizing & Fit"} · ${copyScope === "allThemes" ? "All Themes" : "Active Theme"}`;
    if (copyUndoTimerRef.current) {
      clearTimeout(copyUndoTimerRef.current);
    }
    setCopyUndoNotice({
      targetId: targetGroupId,
      sourceLabel: sourceGroup.label || sourceGroup.id,
      modeLabel,
      previousGroups: preCopySnapshot,
    });
    copyUndoTimerRef.current = setTimeout(() => {
      setCopyUndoNotice((prev) => (prev && prev.targetId === targetGroupId ? null : prev));
    }, 10000);
  };

  const handleUndoCopyImageAttributes = () => {
    if (!copyUndoNotice) return;
    if (copyUndoTimerRef.current) {
      clearTimeout(copyUndoTimerRef.current);
      copyUndoTimerRef.current = null;
    }
    onChange(copyUndoNotice.previousGroups);
    setCopyUndoNotice(null);
  };

  const compactInputStyle: React.CSSProperties = {
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: "4px 6px",
    fontSize: "11px",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    borderRadius: "6px",
    border: "1px solid #E2E8F0",
    background: "#F8FAFC",
    color: "#0F172A",
    outline: "none",
  };

  return (
    <div
      data-ecmd-images-tab-root="true"
      style={{ display: "flex", flexDirection: "column", gap: "10px" }}
    >
      {/* Top Action Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
          padding: "7px 9px",
          borderRadius: "8px",
          background: isMs ? "rgba(30, 41, 59, 0.08)" : "rgba(13, 148, 136, 0.08)",
          border: "1px solid #CBD5E1",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: 0 }}>
          <span
            data-ecmd-images-inspector-header="true"
            style={{ fontSize: "11px", fontWeight: 800, color: "#0F172A" }}
          >
            Image Groups Inspector · {isMs ? "Dark Assets" : "Light Assets"}
          </span>
          <span style={{ fontSize: "10px", color: "#475569" }}>
            Slots sync across all themes; files &amp; sizes are per-theme.
          </span>
        </div>
        <button
          type="button"
          data-ecmd-new-image-group-btn="true"
          onClick={handleAddImageGroup}
          style={{
            padding: "5px 9px",
            borderRadius: "6px",
            border: "1px solid rgba(13, 148, 136, 0.45)",
            background: "#0D9488",
            color: "#FFFFFF",
            fontSize: "10.5px",
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          + New Image Group
        </button>
      </div>

      {/* Sticky 50+ Scale Filter, Natural A-Z Sort & Accordion Toolbar */}
      <div
        data-ecmd-images-sticky-toolbar="true"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 8,
          background: "#FFFFFF",
          padding: "6px 8px",
          borderRadius: "8px",
          border: "1px solid #E2E8F0",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
            <input
              type="text"
              aria-label="Search image groups, classes, or assets"
              data-ecmd-images-search-input="true"
              value={searchQuery}
              placeholder="🔍 Search image groups, classes, or assets..."
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: searchQuery ? "4px 24px 4px 7px" : "4px 7px",
                fontSize: "10.5px",
                borderRadius: "6px",
                border: searchQuery ? "1px solid #0D9488" : "1px solid #CBD5E1",
                background: "#F8FAFC",
                color: "#0F172A",
                outline: "none",
              }}
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                aria-label="Clear image groups search"
                data-ecmd-images-search-clear="true"
                onClick={() => setSearchQuery("")}
                title="Clear search"
                style={{
                  position: "absolute",
                  right: "4px",
                  width: "16px",
                  height: "16px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  borderRadius: "4px",
                  background: "#E2E8F0",
                  color: "#334155",
                  fontSize: "9.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ✕
              </button>
            )}
          </div>
          <span
            data-ecmd-images-showing-badge="true"
            style={{
              fontSize: "9.5px",
              fontWeight: 700,
              color: searchQuery.trim() ? "#0F766E" : "#64748B",
              background: searchQuery.trim() ? "rgba(13, 148, 136, 0.10)" : "#F1F5F9",
              padding: "2px 6px",
              borderRadius: "999px",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Showing {visibleImageGroups.length} of {syncedGroups.length}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px", flexWrap: "wrap" }}>
          <div
            data-ecmd-images-sort-bar="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "2px",
              background: "#F1F5F9",
              padding: "2px",
              borderRadius: "6px",
              border: "1px solid #E2E8F0",
            }}
          >
            {(
              [
                { id: "az", label: "A → Z", title: "Natural alphabetical order (A to Z)" },
                { id: "za", label: "Z → A", title: "Reverse alphabetical order (Z to A)" },
                { id: "custom", label: "Custom", title: "Custom / Recent order" },
              ] as const
            ).map((opt) => {
              const active = sortBy === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-ecmd-images-sort-btn={opt.id}
                  aria-pressed={active}
                  title={opt.title}
                  onClick={() => {
                    setFocusedRenameId(null);
                    setFrozenOrderIds(null);
                    setSortBy(opt.id);
                  }}
                  style={{
                    padding: "2px 6px",
                    fontSize: "9.5px",
                    fontWeight: 700,
                    borderRadius: "4px",
                    border: "none",
                    background: active ? "#FFFFFF" : "transparent",
                    color: active ? "#0F766E" : "#475569",
                    boxShadow: active ? "0 1px 2px rgba(15,23,42,0.10)" : "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {syncedGroups.length > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
              <button
                type="button"
                data-ecmd-images-collapse-all="true"
                onClick={handleCollapseAllImages}
                style={{
                  padding: "2px 6px",
                  fontSize: "9.5px",
                  fontWeight: 700,
                  borderRadius: "5px",
                  border: "1px solid #CBD5E1",
                  background: "#F8FAFC",
                  color: "#334155",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                ▾ Collapse All
              </button>
              <button
                type="button"
                data-ecmd-images-expand-all="true"
                onClick={handleExpandAllImages}
                style={{
                  padding: "2px 6px",
                  fontSize: "9.5px",
                  fontWeight: 700,
                  borderRadius: "5px",
                  border: "1px solid #CBD5E1",
                  background: "#F8FAFC",
                  color: "#334155",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                ▸ Expand All
              </button>
            </div>
          )}
        </div>
      </div>

      {pickingGroupId && (
        <div
          data-ecmd-canvas-picker-banner="true"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 9px",
            borderRadius: "7px",
            background: "#FEF3C7",
            border: "1px solid #F59E0B",
            color: "#92400E",
            fontSize: "10.5px",
            fontWeight: 600,
          }}
        >
          <span>🎯 Click any &lt;img&gt; or &lt;svg&gt; on the canvas (Esc to cancel)</span>
          <button
            type="button"
            onClick={() => setPickingGroupId(null)}
            style={{
              border: "none",
              background: "transparent",
              color: "#92400E",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "10.5px",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Empty State */}
      {syncedGroups.length === 0 ? (
        <div
          style={{
            padding: "20px 14px",
            textAlign: "center",
            background: "#F8FAFC",
            borderRadius: "10px",
            border: "1px dashed #CBD5E1",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "20px" }}>🖼️</span>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#0F172A" }}>
            No Theme Image Groups Yet
          </span>
          <span style={{ fontSize: "10.5px", color: "#64748B", lineHeight: 1.4 }}>
            Create an Image Group (e.g. <b>Header Wordmark Logo</b>), paste its class onto any
            Plasmic <code>&lt;img&gt;</code> or <code>&lt;svg&gt;</code>, and drop different assets
            & sizes for Light vs Dark themes.
          </span>
          <button
            type="button"
            onClick={handleAddImageGroup}
            style={{
              border: "none",
              background: "#0D9488",
              color: "#FFFFFF",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ➕ Create First Image Group
          </button>
        </div>
      ) : visibleImageGroups.length === 0 ? (
        <div
          data-ecmd-images-search-empty="true"
          style={{
            padding: "18px 14px",
            textAlign: "center",
            background: "#F8FAFC",
            borderRadius: "10px",
            border: "1px dashed #CBD5E1",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#0F172A" }}>
            No image groups match &apos;{searchQuery.trim()}&apos;
          </span>
          <button
            type="button"
            data-ecmd-images-clear-search-empty="true"
            onClick={() => setSearchQuery("")}
            style={{
              border: "1px solid #0D9488",
              background: "rgba(13, 148, 136, 0.12)",
              color: "#0F766E",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "10.5px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Clear Search
          </button>
        </div>
      ) : (
        visibleImageGroups.map((group) => {
          const variant = getThemeImageGroupVariant(group, activePalette);
          const primaryClass = extractPrimaryImageClass(group.selector);
          const isDragOver = dragOverId === group.id;
          const isUploading = uploadingId === group.id;
          const isCollapsed = collapsedIds.has(group.id);
          const useDarkPreview =
            darkPreviewById[group.id] !== undefined ? darkPreviewById[group.id] : isMs;
          const storageMode = storageModeByKey[`${group.id}:${activePalette}`];
          const hasAsset = Boolean(variant.assetUrl && variant.assetUrl.trim());

          return (
            <div
              key={group.id}
              ref={(el) => {
                cardRefs.current[group.id] = el;
              }}
              data-ecmd-image-group-card={group.id}
              data-ecmd-image-group-expanded={isCollapsed ? "false" : "true"}
              data-ecmd-image-group-pinned={group.pinned ? "true" : "false"}
              style={{
                border: group.pinned ? "1px solid #F59E0B" : "1px solid #CBD5E1",
                borderRadius: "10px",
                padding: isCollapsed ? "7px 10px" : "10px 11px",
                background: "#FFFFFF",
                display: "flex",
                flexDirection: "column",
                gap: isCollapsed ? "0px" : "8px",
              }}
            >
              {/* Card Header: Expand/Collapse + Pin + Label + Delete */}
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <button
                  type="button"
                  aria-label={isCollapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
                  data-ecmd-image-toggle-btn={group.id}
                  onClick={() => handleToggleImageCollapse(group.id)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#64748B",
                    fontSize: "10.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: "2px 3px",
                    flexShrink: 0,
                  }}
                >
                  {isCollapsed ? "▸" : "▾"}
                </button>
                <button
                  type="button"
                  aria-label={group.pinned ? `Unpin ${group.label}` : `Pin ${group.label} to top`}
                  aria-pressed={Boolean(group.pinned)}
                  data-ecmd-image-pin-btn={group.id}
                  title={group.pinned ? "Pinned to top (click to unpin)" : "Pin favorite image group to top"}
                  onClick={() => handleToggleImagePin(group.id, group.pinned)}
                  style={{
                    border: group.pinned ? "1px solid #F59E0B" : "1px solid transparent",
                    background: group.pinned ? "#FEF3C7" : "transparent",
                    color: group.pinned ? "#B45309" : "#94A3B8",
                    borderRadius: "4px",
                    padding: "2px 4px",
                    fontSize: "10px",
                    lineHeight: 1.1,
                    cursor: "pointer",
                    flexShrink: 0,
                    opacity: group.pinned ? 1 : 0.65,
                  }}
                >
                  📌
                </button>
                {isCollapsed ? (
                  <div
                    onClick={() => handleToggleImageCollapse(group.id)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 700,
                        color: "#0F172A",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {group.label}
                    </span>
                    <code
                      style={{
                        fontSize: "9.5px",
                        color: "#64748B",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {group.selector}
                    </code>
                  </div>
                ) : (
                  <input
                    ref={(el) => {
                      labelInputRefs.current[group.id] = el;
                    }}
                    type="text"
                    aria-label="Image Group Label"
                    data-ecmd-image-label-input={group.id}
                    value={group.label}
                    placeholder="e.g. Header Wordmark Logo"
                    onFocus={() => handleRenameFocus(group.id)}
                    onBlur={() => handleRenameBlur(group.id)}
                    onChange={(e) => {
                      const nextLabel = e.target.value;
                      const expectedAutoSel = buildImageGroupSelector(group.label);
                      const shouldSyncSel =
                        !group.selector.trim() || group.selector.trim() === expectedAutoSel;
                      onChange(
                        updateThemeImageGroupMeta(syncedGroups, group.id, {
                          label: nextLabel,
                          ...(shouldSyncSel ? { selector: buildImageGroupSelector(nextLabel) } : {}),
                        })
                      );
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        (e.currentTarget as HTMLInputElement).blur();
                      }
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: "4px 7px",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      borderRadius: "6px",
                      border: "1px solid #E2E8F0",
                      background: "#F8FAFC",
                      color: "#0F172A",
                      outline: "none",
                    }}
                  />
                )}
                <button
                  type="button"
                  data-ecmd-delete-image-group-btn={group.id}
                  title="Delete Image Group from all themes"
                  onClick={() => handleDeleteImageGroup(group.id)}
                  style={{
                    border: "1px solid rgba(220,38,38,0.28)",
                    background: "rgba(239,68,68,0.08)",
                    color: "#DC2626",
                    borderRadius: "6px",
                    padding: "4px 7px",
                    fontSize: "10.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  🗑️
                </button>
              </div>

              {!isCollapsed && (
              <>
              {/* Inner Action Bar: Icon-Free Copy Attributes From Dropdown */}
              {(() => {
                const isCopyOpen = copyMenuTargetId === group.id;
                const otherImageGroups = syncedGroups.filter((g) => g.id !== group.id);
                const copyCandidates = isCopyOpen
                  ? filterAndSortImageGroups(otherImageGroups, {
                      query: copySearch,
                      sortBy: "az",
                      activePalette,
                    })
                  : [];
                const showUndo = copyUndoNotice && copyUndoNotice.targetId === group.id;

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div
                      data-ecmd-image-action-bar={group.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "6px",
                      }}
                    >
                      <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                        Slot Controls
                      </span>
                      <button
                        type="button"
                        data-ecmd-copy-image-attrs-trigger={group.id}
                        aria-expanded={isCopyOpen}
                        aria-haspopup="true"
                        disabled={otherImageGroups.length === 0}
                        onClick={() => {
                          if (otherImageGroups.length === 0) return;
                          setCopySearch("");
                          setCopyMenuTargetId((prev) => (prev === group.id ? null : group.id));
                        }}
                        title={
                          otherImageGroups.length === 0
                            ? "Create another image group to copy sizing or assets from"
                            : "Copy sizing/fit (and optionally image asset) from another image group without changing this group's label or CSS selector"
                        }
                        style={{
                          padding: "2px 7px",
                          fontSize: "10px",
                          fontWeight: 700,
                          borderRadius: "5px",
                          border: isCopyOpen ? "1px solid #0D9488" : "1px solid #CBD5E1",
                          background: isCopyOpen ? "rgba(13, 148, 136, 0.12)" : "#F8FAFC",
                          color:
                            otherImageGroups.length === 0
                              ? "#94A3B8"
                              : isCopyOpen
                                ? "#0F766E"
                                : "#334155",
                          cursor: otherImageGroups.length === 0 ? "not-allowed" : "pointer",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                          opacity: otherImageGroups.length === 0 ? 0.6 : 1,
                        }}
                      >
                        Copy Attributes From {isCopyOpen ? "▴" : "▾"}
                      </button>
                    </div>

                    {isCopyOpen && (
                      <div
                        data-ecmd-copy-image-attrs-menu={group.id}
                        style={{
                          border: "1px solid #CBD5E1",
                          borderRadius: "8px",
                          background: "#FFFFFF",
                          boxShadow: "0 10px 24px rgba(15, 23, 42, 0.14)",
                          padding: "7px 8px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        {/* Mode Toggle: Sizing & Fit Only vs Sizing + Image Asset */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "3px",
                            background: "#F1F5F9",
                            padding: "2px",
                            borderRadius: "6px",
                            border: "1px solid #E2E8F0",
                          }}
                        >
                          <button
                            type="button"
                            data-ecmd-copy-image-mode-btn="sizing"
                            aria-pressed={!copyIncludeAsset}
                            onClick={() => setCopyIncludeAsset(false)}
                            style={{
                              padding: "3px 5px",
                              fontSize: "9.5px",
                              fontWeight: 700,
                              borderRadius: "4px",
                              border: "none",
                              background: !copyIncludeAsset ? "#FFFFFF" : "transparent",
                              color: !copyIncludeAsset ? "#0F766E" : "#475569",
                              boxShadow: !copyIncludeAsset ? "0 1px 2px rgba(15,23,42,0.10)" : "none",
                              cursor: "pointer",
                            }}
                          >
                            Sizing &amp; Fit Only
                          </button>
                          <button
                            type="button"
                            data-ecmd-copy-image-mode-btn="asset"
                            aria-pressed={copyIncludeAsset}
                            onClick={() => setCopyIncludeAsset(true)}
                            style={{
                              padding: "3px 5px",
                              fontSize: "9.5px",
                              fontWeight: 700,
                              borderRadius: "4px",
                              border: "none",
                              background: copyIncludeAsset ? "#FFFFFF" : "transparent",
                              color: copyIncludeAsset ? "#0F766E" : "#475569",
                              boxShadow: copyIncludeAsset ? "0 1px 2px rgba(15,23,42,0.10)" : "none",
                              cursor: "pointer",
                            }}
                          >
                            Sizing + Image Asset
                          </button>
                        </div>

                        {/* Scope Toggle: Active Theme vs All Themes */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "3px",
                            background: "#F1F5F9",
                            padding: "2px",
                            borderRadius: "6px",
                            border: "1px solid #E2E8F0",
                          }}
                        >
                          <button
                            type="button"
                            data-ecmd-copy-image-scope-btn="activeTheme"
                            aria-pressed={copyScope === "activeTheme"}
                            onClick={() => setCopyScope("activeTheme")}
                            style={{
                              padding: "3px 5px",
                              fontSize: "9.5px",
                              fontWeight: 700,
                              borderRadius: "4px",
                              border: "none",
                              background: copyScope === "activeTheme" ? "#FFFFFF" : "transparent",
                              color: copyScope === "activeTheme" ? "#0F766E" : "#475569",
                              boxShadow:
                                copyScope === "activeTheme" ? "0 1px 2px rgba(15,23,42,0.10)" : "none",
                              cursor: "pointer",
                            }}
                          >
                            Active Theme
                          </button>
                          <button
                            type="button"
                            data-ecmd-copy-image-scope-btn="allThemes"
                            aria-pressed={copyScope === "allThemes"}
                            onClick={() => setCopyScope("allThemes")}
                            style={{
                              padding: "3px 5px",
                              fontSize: "9.5px",
                              fontWeight: 700,
                              borderRadius: "4px",
                              border: "none",
                              background: copyScope === "allThemes" ? "#FFFFFF" : "transparent",
                              color: copyScope === "allThemes" ? "#0F766E" : "#475569",
                              boxShadow:
                                copyScope === "allThemes" ? "0 1px 2px rgba(15,23,42,0.10)" : "none",
                              cursor: "pointer",
                            }}
                          >
                            All Themes
                          </button>
                        </div>

                        {/* Quick-Filter Search */}
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <input
                            type="text"
                            aria-label="Filter source image groups"
                            data-ecmd-copy-image-attrs-search={group.id}
                            value={copySearch}
                            placeholder="Filter source image groups..."
                            onChange={(e) => setCopySearch(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === "Escape") {
                                setCopyMenuTargetId(null);
                                setCopySearch("");
                              }
                            }}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              padding: "4px 7px",
                              fontSize: "10.5px",
                              borderRadius: "6px",
                              border: "1px solid #CBD5E1",
                              background: "#F8FAFC",
                              color: "#0F172A",
                              outline: "none",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setCopyMenuTargetId(null);
                              setCopySearch("");
                            }}
                            style={{
                              border: "1px solid #E2E8F0",
                              background: "#F8FAFC",
                              color: "#475569",
                              borderRadius: "5px",
                              padding: "3px 6px",
                              fontSize: "10px",
                              fontWeight: 700,
                              cursor: "pointer",
                              flexShrink: 0,
                            }}
                          >
                            Close
                          </button>
                        </div>

                        {/* Natural A -> Z List of Source Image Groups */}
                        <div
                          data-ecmd-copy-image-attrs-list={group.id}
                          style={{
                            maxHeight: "140px",
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: "3px",
                          }}
                        >
                          {copyCandidates.length === 0 ? (
                            <div style={{ padding: "8px 6px", textAlign: "center", fontSize: "10px", color: "#64748B" }}>
                              No matching image groups.
                            </div>
                          ) : (
                            copyCandidates.map((src) => (
                              <button
                                key={src.id}
                                type="button"
                                data-ecmd-copy-image-source-option={src.id}
                                onClick={() => handleCopyImageAttributesFrom(group.id, src)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: "6px",
                                  width: "100%",
                                  padding: "4px 7px",
                                  borderRadius: "6px",
                                  border: "1px solid #E2E8F0",
                                  background: "#F8FAFC",
                                  color: "#0F172A",
                                  cursor: "pointer",
                                  textAlign: "left",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "10.5px",
                                    fontWeight: 700,
                                    color: "#0F172A",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {src.label}
                                </span>
                                <code
                                  style={{
                                    fontSize: "9.5px",
                                    color: "#64748B",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    maxWidth: "110px",
                                    flexShrink: 0,
                                  }}
                                >
                                  {src.selector}
                                </code>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {showUndo && copyUndoNotice && (
                      <div
                        data-ecmd-copy-image-attrs-toast={group.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "6px",
                          padding: "5px 8px",
                          borderRadius: "6px",
                          background: "#ECFDF5",
                          border: "1px solid #10B981",
                          color: "#065F46",
                          fontSize: "10px",
                          fontWeight: 600,
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                          Copied from <b>{copyUndoNotice.sourceLabel}</b> ({copyUndoNotice.modeLabel})
                        </span>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                          <button
                            type="button"
                            data-ecmd-copy-image-attrs-undo={group.id}
                            onClick={handleUndoCopyImageAttributes}
                            style={{
                              border: "1px solid #059669",
                              background: "#FFFFFF",
                              color: "#047857",
                              borderRadius: "4px",
                              padding: "1px 6px",
                              fontSize: "9.5px",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Undo
                          </button>
                          <button
                            type="button"
                            aria-label="Dismiss copy confirmation"
                            onClick={() => setCopyUndoNotice(null)}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: "#047857",
                              fontSize: "10px",
                              fontWeight: 700,
                              cursor: "pointer",
                              padding: "0 2px",
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Selector Row + 1-Click Copy Class + Pick on Canvas */}
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <input
                  type="text"
                  aria-label="Image Group CSS Selector"
                  data-ecmd-image-selector-input={group.id}
                  value={group.selector}
                  placeholder=".ecmd-img-header-logo"
                  onChange={(e) =>
                    onChange(
                      updateThemeImageGroupMeta(syncedGroups, group.id, {
                        selector: e.target.value,
                      })
                    )
                  }
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{ ...compactInputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  data-ecmd-copy-image-class-btn={group.id}
                  title={`Copy class "${primaryClass}" for Plasmic className`}
                  onClick={() => handleCopyClass(group)}
                  style={{
                    padding: "4px 6px",
                    fontSize: "10px",
                    fontWeight: 700,
                    borderRadius: "6px",
                    border: copiedId === group.id ? "1px solid #0D9488" : "1px solid #CBD5E1",
                    background: copiedId === group.id ? "rgba(13,148,136,0.14)" : "#F8FAFC",
                    color: copiedId === group.id ? "#0F766E" : "#334155",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {copiedId === group.id ? "✓ Copied" : "📋 Copy Class"}
                </button>
                <button
                  type="button"
                  data-ecmd-pick-image-el-btn={group.id}
                  title="Pick target <img> or <svg> directly on the canvas"
                  onClick={() =>
                    setPickingGroupId((prev) => (prev === group.id ? null : group.id))
                  }
                  style={{
                    padding: "4px 6px",
                    fontSize: "10px",
                    fontWeight: 700,
                    borderRadius: "6px",
                    border:
                      pickingGroupId === group.id ? "1px solid #F59E0B" : "1px solid #CBD5E1",
                    background: pickingGroupId === group.id ? "#FEF3C7" : "#F8FAFC",
                    color: pickingGroupId === group.id ? "#92400E" : "#334155",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  🎯 Pick
                </button>
              </div>

              {/* Drag & Drop / Click-to-Upload Dropzone + Checkerboard Preview */}
              <div
                data-ecmd-image-dropzone={group.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverId(group.id);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragOverId === group.id) setDragOverId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverId(null);
                  const file = e.dataTransfer?.files?.[0];
                  if (file) void handleFileUpload(group.id, file);
                }}
                style={{
                  borderRadius: "8px",
                  border: isDragOver
                    ? "2px dashed #0D9488"
                    : hasAsset
                      ? "1px solid #CBD5E1"
                      : "1.5px dashed #94A3B8",
                  background: isDragOver ? "rgba(13, 148, 136, 0.08)" : "#F8FAFC",
                  padding: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  transition: "border-color 0.15s ease, background 0.15s ease",
                }}
              >
                <input
                  ref={(el) => {
                    fileInputRefs.current[group.id] = el;
                  }}
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES}
                  data-ecmd-image-file-input={group.id}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileUpload(group.id, file);
                    e.target.value = "";
                  }}
                />

                {hasAsset ? (
                  <>
                    {/* Preview Toolbar */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "6px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <span
                          data-ecmd-image-filename={group.id}
                          title={variant.assetName || variant.assetUrl}
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            color: "#0F766E",
                            background: "rgba(13, 148, 136, 0.12)",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {variant.assetName || "Custom Asset"}
                        </span>
                        {storageMode && (
                          <span
                            style={{
                              fontSize: "9.5px",
                              fontWeight: 600,
                              color: storageMode === "supabase" ? "#0369A1" : "#64748B",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {storageMode === "supabase" ? "☁️ Supabase" : "📦 Local"}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        data-ecmd-preview-bg-toggle={group.id}
                        title="Toggle dark/light checkerboard preview background"
                        onClick={() =>
                          setDarkPreviewById((prev) => ({
                            ...prev,
                            [group.id]: !useDarkPreview,
                          }))
                        }
                        style={{
                          padding: "2px 6px",
                          fontSize: "9.5px",
                          fontWeight: 700,
                          borderRadius: "4px",
                          border: "1px solid #CBD5E1",
                          background: useDarkPreview ? "#0F172A" : "#FFFFFF",
                          color: useDarkPreview ? "#F8FAFC" : "#0F172A",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        {useDarkPreview ? "🌙 Dark bg" : "☀️ Light bg"}
                      </button>
                    </div>

                    {/* Checkerboard Thumbnail */}
                    <div
                      onClick={() => fileInputRefs.current[group.id]?.click()}
                      title="Click or drop a new file to replace"
                      style={{
                        height: "68px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "6px",
                        cursor: "pointer",
                        overflow: "hidden",
                        backgroundImage: useDarkPreview
                          ? "repeating-conic-gradient(#1E293B 0% 25%, #0F172A 0% 50%)"
                          : "repeating-conic-gradient(#E2E8F0 0% 25%, #FFFFFF 0% 50%)",
                        backgroundSize: "12px 12px",
                      }}
                    >
                      <img
                        src={variant.assetUrl}
                        alt={variant.assetName || group.label}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          objectFit: variant.objectFit || "contain",
                          pointerEvents: "none",
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[group.id]?.click()}
                        style={{
                          flex: 1,
                          padding: "4px 7px",
                          fontSize: "10px",
                          fontWeight: 600,
                          borderRadius: "5px",
                          border: "1px solid #CBD5E1",
                          background: "#FFFFFF",
                          color: "#334155",
                          cursor: "pointer",
                        }}
                      >
                        {isUploading ? "Uploading..." : "⬆️ Replace File"}
                      </button>
                      <button
                        type="button"
                        data-ecmd-reset-image-btn={group.id}
                        onClick={() =>
                          handleUpdateVariant(group.id, { assetUrl: "", assetName: "" })
                        }
                        style={{
                          flex: 1,
                          padding: "4px 7px",
                          fontSize: "10px",
                          fontWeight: 600,
                          borderRadius: "5px",
                          border: "1px solid rgba(220,38,38,0.28)",
                          background: "rgba(239,68,68,0.08)",
                          color: "#DC2626",
                          cursor: "pointer",
                        }}
                      >
                        ↺ Reset to Default Image
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[group.id]?.click()}
                    style={{
                      width: "100%",
                      padding: "12px 8px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "3px",
                      color: "#334155",
                    }}
                  >
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#0F766E" }}>
                      {isUploading
                        ? "Uploading to ecmd-theme-assets..."
                        : `⬆️ Drop SVG / PNG / WebP for ${isMs ? "Dark" : "Light"} Theme`}
                    </span>
                    <span style={{ fontSize: "9.5px", color: "#64748B" }}>
                      or click to browse (empty = keep Plasmic default image untouched)
                    </span>
                  </button>
                )}

                {/* Direct Asset URL Input */}
                <input
                  type="text"
                  aria-label="Asset URL"
                  data-ecmd-image-url-input={group.id}
                  value={variant.assetUrl}
                  placeholder="Or paste image URL (https://... or /logo.svg)"
                  onChange={(e) => {
                    const url = e.target.value;
                    const derivedName = url.trim()
                      ? url.split("/").pop()?.split("?")[0] || "External URL"
                      : "";
                    handleUpdateVariant(group.id, {
                      assetUrl: url,
                      assetName: variant.assetName || derivedName,
                    });
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={compactInputStyle}
                />
              </div>

              {/* Per-Theme Size & Fit Controls */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "5px",
                  paddingTop: "4px",
                  borderTop: "1px dashed #E2E8F0",
                }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#475569" }}>
                    Width
                  </span>
                  <input
                    type="text"
                    data-ecmd-image-width-input={group.id}
                    value={variant.width || ""}
                    placeholder="e.g. 220px"
                    onChange={(e) => handleUpdateVariant(group.id, { width: e.target.value })}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={compactInputStyle}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#475569" }}>
                    Height
                  </span>
                  <input
                    type="text"
                    data-ecmd-image-height-input={group.id}
                    value={variant.height || ""}
                    placeholder="e.g. 60px"
                    onChange={(e) => handleUpdateVariant(group.id, { height: e.target.value })}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={compactInputStyle}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#475569" }}>
                    Max Width
                  </span>
                  <input
                    type="text"
                    data-ecmd-image-maxwidth-input={group.id}
                    value={variant.maxWidth || ""}
                    placeholder="100%"
                    onChange={(e) => handleUpdateVariant(group.id, { maxWidth: e.target.value })}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={compactInputStyle}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#0369A1" }}>
                    📲 Mobile W
                  </span>
                  <input
                    type="text"
                    data-ecmd-image-mobile-width-input={group.id}
                    value={variant.mobileWidth || ""}
                    placeholder="< 768px"
                    onChange={(e) =>
                      handleUpdateVariant(group.id, { mobileWidth: e.target.value })
                    }
                    onKeyDown={(e) => e.stopPropagation()}
                    style={compactInputStyle}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#0369A1" }}>
                    📲 Mobile H
                  </span>
                  <input
                    type="text"
                    data-ecmd-image-mobile-height-input={group.id}
                    value={variant.mobileHeight || ""}
                    placeholder="< 768px"
                    onChange={(e) =>
                      handleUpdateVariant(group.id, { mobileHeight: e.target.value })
                    }
                    onKeyDown={(e) => e.stopPropagation()}
                    style={compactInputStyle}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#475569" }}>
                    Opacity (%)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    data-ecmd-image-opacity-input={group.id}
                    value={variant.opacity ?? ""}
                    placeholder="100"
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      handleUpdateVariant(group.id, {
                        opacity: raw === "" ? undefined : Number(raw),
                      });
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={compactInputStyle}
                  />
                </label>
              </div>

              {/* Fit & Align Dropdowns */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#475569" }}>
                    Fit (object-fit)
                  </span>
                  <select
                    data-ecmd-image-fit-select={group.id}
                    value={variant.objectFit || "contain"}
                    onChange={(e) =>
                      handleUpdateVariant(group.id, {
                        objectFit: e.target.value as ThemeImageObjectFit,
                      })
                    }
                    style={{
                      ...compactInputStyle,
                      fontFamily: "Inter, system-ui, sans-serif",
                      cursor: "pointer",
                    }}
                  >
                    {OBJECT_FIT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#475569" }}>
                    Align (position)
                  </span>
                  <select
                    data-ecmd-image-position-select={group.id}
                    value={variant.objectPosition || "center"}
                    onChange={(e) =>
                      handleUpdateVariant(group.id, { objectPosition: e.target.value })
                    }
                    style={{
                      ...compactInputStyle,
                      fontFamily: "Inter, system-ui, sans-serif",
                      cursor: "pointer",
                    }}
                  >
                    {OBJECT_POSITION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              </>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
