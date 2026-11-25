import React, { useEffect, useState } from "react";
import {
  DEFAULT_TEXT_SHADOW_CONFIG,
  compileDesignTokenCssValue,
  filterAndSortDesignTokens,
  getDesignTokenCssVarName,
  hasDesignTokenThemeOverride,
  normalizeTextShadowConfig,
  resolveDesignTokenBorderConfig,
  resolveDesignTokenTextShadowConfig,
  type ThemeBorderStyle,
  type ThemeBorderTokenValue,
  type ThemeDesignToken,
  type ThemeDesignTokenType,
  type ThemeDesignTokenValue,
  type ThemeListSortMode,
  type ThemeTextShadowConfig,
} from "../lib/ecmdThemeEngine";
import type { DynamicGroupItem, SubGroupStateKey } from "./EcmdDynamicGroupManager";

const TOKENS_SORT_STORAGE_KEY = "ecmd_theme_tokens_sort_v1";

function loadTokensSortPref(): ThemeListSortMode {
  try {
    const raw = window.localStorage.getItem(TOKENS_SORT_STORAGE_KEY);
    if (raw === "za" || raw === "custom") return raw;
  } catch {}
  return "az";
}

export interface EcmdThemeTokensTabProps {
  tokens: ThemeDesignToken[];
  groups: Record<string, DynamicGroupItem>;
  activePalette: string;
  onCreateToken: (input: {
    name: string;
    type: ThemeDesignTokenType;
    value: ThemeDesignTokenValue;
  }) => void;
  onUpdateTokenValue: (
    tokenId: string,
    nextValue: ThemeDesignTokenValue,
    scope: "all" | "theme"
  ) => void;
  onClearTokenOverride: (tokenId: string, themeId: string) => void;
  onRenameToken: (tokenId: string, nextName: string) => void;
  onDuplicateToken: (tokenId: string) => void;
  onDeleteToken: (tokenId: string) => void;
  onTogglePinToken?: ((tokenId: string) => void) | undefined;
}

const SUB_STATE_KEYS: SubGroupStateKey[] = [
  "hover",
  "focus",
  "selected",
  "selectedHover",
  "disabled",
];

export function countGroupsUsingToken(
  groups: Record<string, DynamicGroupItem>,
  tokenId: string
): number {
  let count = 0;
  for (const g of Object.values(groups || {})) {
    if (!g || !g.enabled) continue;
    let usedInGroup = false;
    if (g.tokenRefs && Object.values(g.tokenRefs).includes(tokenId)) {
      usedInGroup = true;
    }
    if (!usedInGroup && g.stateOverrides) {
      for (const st of SUB_STATE_KEYS) {
        const refs = g.stateOverrides[st]?.tokenRefs;
        if (refs && Object.values(refs).includes(tokenId)) {
          usedInGroup = true;
          break;
        }
      }
    }
    if (usedInGroup) count++;
  }
  return count;
}

const TOKEN_SECTIONS: Array<{
  id: string;
  title: string;
  icon: string;
  types: ThemeDesignTokenType[];
}> = [
  { id: "boxShadow", title: "Box Shadows", icon: "🌒", types: ["boxShadow"] },
  { id: "textShadow", title: "Text Shadows", icon: "✨", types: ["textShadow"] },
  { id: "paint", title: "Colors & Gradients", icon: "🎨", types: ["paint"] },
  { id: "borderRadius", title: "Borders & Radii", icon: "📐", types: ["border", "radius"] },
];

function defaultValueForNewToken(type: ThemeDesignTokenType): ThemeDesignTokenValue {
  switch (type) {
    case "boxShadow":
      return { css: "0px 8px 24px -4px rgba(15,23,42,0.22)" };
    case "textShadow":
      return {
        ...DEFAULT_TEXT_SHADOW_CONFIG,
        textShadowEnabled: true,
        textShadowX: 0,
        textShadowY: 1,
        textShadowBlur: 3,
        textShadowColor: "#000000",
        textShadowOpacity: 40,
      };
    case "paint":
      return "linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%)";
    case "border":
      return { width: "1px", style: "solid", color: "#0D9488", radius: "12px", borderMode: "custom" };
    case "radius":
      return "12px";
  }
}

export function EcmdThemeTokensTab({
  tokens,
  groups,
  activePalette,
  onCreateToken,
  onUpdateTokenValue,
  onClearTokenOverride,
  onRenameToken,
  onDuplicateToken,
  onDeleteToken,
  onTogglePinToken,
}: EcmdThemeTokensTabProps) {
  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState<ThemeDesignTokenType>("boxShadow");
  const [newName, setNewName] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [scopeById, setScopeById] = useState<Record<string, "all" | "theme">>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<ThemeListSortMode>(() => loadTokensSortPref());
  const [frozenOrderIds, setFrozenOrderIds] = useState<string[] | null>(null);

  const isMs = activePalette === "ms" || activePalette === "midnight-slate";
  const activeThemeLabel = isMs ? "Dark" : "Light";

  useEffect(() => {
    try {
      window.localStorage.setItem(TOKENS_SORT_STORAGE_KEY, sortBy);
    } catch {}
  }, [sortBy]);

  const visibleTokens = filterAndSortDesignTokens(tokens, {
    query: searchQuery,
    sortBy,
    activeThemeId: activePalette,
    frozenOrderIds: renamingId ? frozenOrderIds || undefined : undefined,
    focusedRenameId: renamingId,
  });

  const handleToggleTokenExpand = (tokenId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tokenId)) next.delete(tokenId);
      else next.add(tokenId);
      return next;
    });
  };

  const handleCollapseAllTokens = () => {
    setExpandedIds(new Set());
  };

  const handleExpandAllTokens = () => {
    setExpandedIds(new Set(visibleTokens.map((t) => t.id)));
  };

  const handleCreate = () => {
    const labelMap: Record<ThemeDesignTokenType, string> = {
      boxShadow: "Glass Card Shadow",
      textShadow: "Heading Crisp + Glow",
      paint: "Emerald Luxe Gradient",
      border: "Subtle Emerald Border",
      radius: "Card Radius",
    };
    const finalName = newName.trim() || labelMap[newType];
    setSearchQuery("");
    onCreateToken({
      name: finalName,
      type: newType,
      value: defaultValueForNewToken(newType),
    });
    setNewName("");
    setCreating(false);
  };

  return (
    <div
      data-ecmd-tokens-tab-root="true"
      style={{ display: "flex", flexDirection: "column", gap: "10px" }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
          padding: "7px 9px",
          borderRadius: "8px",
          background: "#F8FAFC",
          border: "1px solid #E2E8F0",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#0F766E" }}>
            🔖 Reusable Design Tokens ({tokens.length})
          </span>
          <span style={{ fontSize: "9.5px", color: "#64748B" }}>
            Editing for <b>{isMs ? "🌙 Dark" : "☀️ Light"}</b> · Emits <code>--ecmd-tok-*</code> on <code>:root</code>
          </span>
        </div>
        <button
          type="button"
          data-ecmd-tokens-new-btn="true"
          onClick={() => setCreating((v) => !v)}
          style={{
            padding: "4px 8px",
            fontSize: "10.5px",
            fontWeight: 700,
            borderRadius: "6px",
            border: "1px solid rgba(13, 148, 136, 0.45)",
            background: creating ? "#0D9488" : "rgba(13, 148, 136, 0.12)",
            color: creating ? "#FFFFFF" : "#0F766E",
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          + New Token
        </button>
      </div>

      {/* Sticky 50+ Scale Search, Natural A-Z Sort & Accordion Toolbar */}
      <div
        data-ecmd-tokens-sticky-toolbar="true"
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
              aria-label="Search tokens, CSS vars, or values"
              data-ecmd-tokens-search-input="true"
              value={searchQuery}
              placeholder="🔍 Search tokens, CSS vars, or values..."
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
                aria-label="Clear tokens search"
                data-ecmd-tokens-search-clear="true"
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
            data-ecmd-tokens-showing-badge="true"
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
            Showing {visibleTokens.length} of {tokens.length}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px", flexWrap: "wrap" }}>
          <div
            data-ecmd-tokens-sort-bar="true"
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
                  data-ecmd-tokens-sort-btn={opt.id}
                  aria-pressed={active}
                  title={opt.title}
                  onClick={() => {
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
          {tokens.length > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
              <button
                type="button"
                data-ecmd-tokens-collapse-all="true"
                onClick={handleCollapseAllTokens}
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
                data-ecmd-tokens-expand-all="true"
                onClick={handleExpandAllTokens}
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

      {/* Inline Create Token Drawer */}
      {creating && (
        <div
          data-ecmd-tokens-create-form="true"
          style={{
            padding: "8px 10px",
            borderRadius: "8px",
            border: "1px solid #0D9488",
            background: "rgba(13, 148, 136, 0.05)",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <select
              aria-label="New Token Category"
              data-ecmd-tokens-new-type="true"
              value={newType}
              onChange={(e) => setNewType(e.target.value as ThemeDesignTokenType)}
              style={{
                padding: "4px 6px",
                fontSize: "11px",
                fontWeight: 600,
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#0F172A",
              }}
            >
              <option value="boxShadow">Box Shadow</option>
              <option value="textShadow">Text Shadow</option>
              <option value="paint">Color / Gradient</option>
              <option value="border">Border</option>
              <option value="radius">Corner Radius</option>
            </select>
            <input
              type="text"
              aria-label="New Token Name"
              data-ecmd-tokens-new-name="true"
              value={newName}
              placeholder="e.g. Glass Card Shadow"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") handleCreate();
              }}
              style={{
                padding: "4px 7px",
                fontSize: "11px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#0F172A",
                outline: "none",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "5px" }}>
            <button
              type="button"
              onClick={() => setCreating(false)}
              style={{
                padding: "3px 8px",
                fontSize: "10.5px",
                fontWeight: 600,
                borderRadius: "5px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#475569",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              data-ecmd-tokens-create-submit="true"
              onClick={handleCreate}
              style={{
                padding: "3px 10px",
                fontSize: "10.5px",
                fontWeight: 700,
                borderRadius: "5px",
                border: "none",
                background: "#0D9488",
                color: "#FFFFFF",
                cursor: "pointer",
              }}
            >
              Create Token
            </button>
          </div>
        </div>
      )}

      {/* Token Sections (or Search Empty State) */}
      {searchQuery.trim() && visibleTokens.length === 0 ? (
        <div
          data-ecmd-tokens-search-empty="true"
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
            No tokens match &apos;{searchQuery.trim()}&apos;
          </span>
          <button
            type="button"
            data-ecmd-tokens-clear-search-empty="true"
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
      TOKEN_SECTIONS.map((sec) => {
        const list = visibleTokens.filter((t) => sec.types.includes(t.type));
        if (searchQuery.trim() && list.length === 0) return null;
        return (
          <div
            key={sec.id}
            data-ecmd-tokens-section={sec.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              padding: "8px 9px",
              borderRadius: "8px",
              border: "1px solid #E2E8F0",
              background: "#FFFFFF",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#0F172A" }}>
                {sec.icon} {sec.title}
              </span>
              <span style={{ fontSize: "9.5px", fontWeight: 600, color: "#64748B" }}>
                {list.length}
              </span>
            </div>

            {list.length === 0 ? (
              <div
                style={{
                  fontSize: "10px",
                  color: "#94A3B8",
                  padding: "6px 8px",
                  borderRadius: "6px",
                  background: "#F8FAFC",
                  border: "1px dashed #E2E8F0",
                }}
              >
                No {sec.title.toLowerCase()} saved yet. Save one from the Groups Inspector or click + New Token.
              </div>
            ) : (
              list.map((tok) => {
                const usedCount = countGroupsUsingToken(groups, tok.id);
                const compiled = compileDesignTokenCssValue(tok, activePalette);
                const hasOv = hasDesignTokenThemeOverride(tok, activePalette);
                const isExpanded = expandedIds.has(tok.id);
                const editScope: "all" | "theme" = scopeById[tok.id] || (hasOv ? "theme" : "all");
                const isRenaming = renamingId === tok.id;

                return (
                  <div
                    key={tok.id}
                    data-ecmd-token-card={tok.id}
                    data-ecmd-token-expanded={isExpanded ? "true" : "false"}
                    data-ecmd-token-pinned={tok.pinned ? "true" : "false"}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      padding: "7px 8px",
                      borderRadius: "7px",
                      border: isExpanded ? "1px solid #0D9488" : tok.pinned ? "1px solid #F59E0B" : "1px solid #E2E8F0",
                      background: isExpanded ? "#F8FAFC" : "#FFFFFF",
                    }}
                  >
                    {/* Card Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "7px", minWidth: 0, flex: 1 }}>
                        {/* Visual Swatch */}
                        {tok.type === "paint" ? (
                          <span
                            style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "5px",
                              border: "1px solid #CBD5E1",
                              background:
                                "repeating-conic-gradient(#CBD5E1 0% 25%, #FFFFFF 0% 50%) 50% / 6px 6px",
                              position: "relative",
                              overflow: "hidden",
                              flexShrink: 0,
                            }}
                          >
                            <span style={{ position: "absolute", inset: 0, background: compiled || "transparent" }} />
                          </span>
                        ) : tok.type === "boxShadow" ? (
                          <span
                            style={{
                              width: "24px",
                              height: "20px",
                              borderRadius: "4px",
                              background: isMs ? "#1E293B" : "#FFFFFF",
                              border: "1px solid #CBD5E1",
                              boxShadow: compiled || "none",
                              flexShrink: 0,
                            }}
                          />
                        ) : tok.type === "textShadow" ? (
                          <span
                            style={{
                              width: "24px",
                              height: "22px",
                              borderRadius: "4px",
                              background: isMs ? "#0F172A" : "#F1F5F9",
                              color: isMs ? "#F8FAFC" : "#0F172A",
                              border: "1px solid #CBD5E1",
                              fontSize: "11px",
                              fontWeight: 800,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              textShadow: compiled || "none",
                              flexShrink: 0,
                            }}
                          >
                            Aa
                          </span>
                        ) : (
                          <span
                            style={{
                              width: "24px",
                              height: "20px",
                              borderRadius:
                                tok.type === "radius"
                                  ? compiled || "4px"
                                  : resolveDesignTokenBorderConfig(tok, activePalette)?.radius || "4px",
                              background: "#FFFFFF",
                              border:
                                tok.type === "border"
                                  ? `${resolveDesignTokenBorderConfig(tok, activePalette)?.width || "2px"} ${resolveDesignTokenBorderConfig(tok, activePalette)?.style || "solid"} ${resolveDesignTokenBorderConfig(tok, activePalette)?.color || "#0D9488"}`
                                  : "1.5px solid #0D9488",
                              flexShrink: 0,
                              boxSizing: "border-box",
                            }}
                          />
                        )}

                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                          {isRenaming ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                              <input
                                type="text"
                                autoFocus
                                data-ecmd-token-rename-input={tok.id}
                                value={renameDraft}
                                onChange={(e) => setRenameDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  if (e.key === "Enter") {
                                    onRenameToken(tok.id, renameDraft);
                                    setRenamingId(null);
                                    setFrozenOrderIds(null);
                                  } else if (e.key === "Escape") {
                                    setRenamingId(null);
                                    setFrozenOrderIds(null);
                                  }
                                }}
                                onBlur={() => {
                                  setFrozenOrderIds(null);
                                }}
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  padding: "2px 5px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  borderRadius: "4px",
                                  border: "1px solid #0D9488",
                                  background: "#FFFFFF",
                                  color: "#0F172A",
                                  outline: "none",
                                }}
                              />
                              <button
                                type="button"
                                data-ecmd-token-rename-save={tok.id}
                                onClick={() => {
                                  onRenameToken(tok.id, renameDraft);
                                  setRenamingId(null);
                                  setFrozenOrderIds(null);
                                }}
                                style={{
                                  padding: "2px 6px",
                                  fontSize: "9.5px",
                                  fontWeight: 700,
                                  borderRadius: "4px",
                                  border: "none",
                                  background: "#0D9488",
                                  color: "#FFFFFF",
                                  cursor: "pointer",
                                }}
                              >
                                ✓
                              </button>
                            </div>
                          ) : (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                color: "#0F172A",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {tok.name}
                            </span>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                            <span
                              data-ecmd-token-usage={tok.id}
                              style={{
                                fontSize: "9px",
                                fontWeight: 700,
                                color: usedCount > 0 ? "#0F766E" : "#94A3B8",
                              }}
                            >
                              {usedCount > 0
                                ? `Used in ${usedCount} ${usedCount === 1 ? "group" : "groups"}`
                                : "Unused"}
                            </span>
                            <code style={{ fontSize: "8.5px", color: "#64748B" }}>
                              {getDesignTokenCssVarName(tok.id)}
                            </code>
                            {hasOv && (
                              <span
                                data-ecmd-token-override-badge={tok.id}
                                style={{
                                  fontSize: "8.5px",
                                  fontWeight: 700,
                                  padding: "0px 4px",
                                  borderRadius: "3px",
                                  background: "rgba(124, 58, 237, 0.12)",
                                  color: "#6D28D9",
                                }}
                              >
                                {activeThemeLabel} override
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
                        {onTogglePinToken && (
                          <button
                            type="button"
                            aria-label={tok.pinned ? `Unpin ${tok.name}` : `Pin ${tok.name} to top`}
                            aria-pressed={Boolean(tok.pinned)}
                            title={tok.pinned ? "Pinned to top (click to unpin)" : "Pin favorite token to top"}
                            data-ecmd-token-pin-btn={tok.id}
                            onClick={() => onTogglePinToken(tok.id)}
                            style={{
                              padding: "2px 4px",
                              fontSize: "9.5px",
                              borderRadius: "4px",
                              border: tok.pinned ? "1px solid #F59E0B" : "1px solid transparent",
                              background: tok.pinned ? "#FEF3C7" : "transparent",
                              color: tok.pinned ? "#B45309" : "#94A3B8",
                              cursor: "pointer",
                              opacity: tok.pinned ? 1 : 0.65,
                            }}
                          >
                            📌
                          </button>
                        )}
                        <button
                          type="button"
                          title="Edit token value"
                          data-ecmd-token-edit-btn={tok.id}
                          onClick={() => handleToggleTokenExpand(tok.id)}
                          style={{
                            padding: "2px 6px",
                            fontSize: "10px",
                            fontWeight: 700,
                            borderRadius: "4px",
                            border: isExpanded ? "1px solid #0D9488" : "1px solid #CBD5E1",
                            background: isExpanded ? "rgba(13, 148, 136, 0.12)" : "#F8FAFC",
                            color: isExpanded ? "#0F766E" : "#334155",
                            cursor: "pointer",
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          title="Rename token"
                          data-ecmd-token-rename-btn={tok.id}
                          onClick={() => {
                            setFrozenOrderIds(visibleTokens.map((t) => t.id));
                            setRenamingId(tok.id);
                            setRenameDraft(tok.name);
                          }}
                          style={{
                            padding: "2px 5px",
                            fontSize: "9.5px",
                            fontWeight: 700,
                            borderRadius: "4px",
                            border: "1px solid #CBD5E1",
                            background: "#F8FAFC",
                            color: "#334155",
                            cursor: "pointer",
                          }}
                        >
                          Aa
                        </button>
                        <button
                          type="button"
                          title="Duplicate token"
                          data-ecmd-token-duplicate-btn={tok.id}
                          onClick={() => onDuplicateToken(tok.id)}
                          style={{
                            padding: "2px 5px",
                            fontSize: "10px",
                            borderRadius: "4px",
                            border: "1px solid #CBD5E1",
                            background: "#F8FAFC",
                            color: "#334155",
                            cursor: "pointer",
                          }}
                        >
                          📋
                        </button>
                        <button
                          type="button"
                          title="Delete token (preserves last resolved values on linked groups)"
                          data-ecmd-token-delete-btn={tok.id}
                          onClick={() => onDeleteToken(tok.id)}
                          style={{
                            padding: "2px 5px",
                            fontSize: "10px",
                            borderRadius: "4px",
                            border: "1px solid rgba(220, 38, 38, 0.30)",
                            background: "rgba(239, 68, 68, 0.08)",
                            color: "#DC2626",
                            cursor: "pointer",
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Expanded Live Editor (All Themes vs Active Theme Override) */}
                    {isExpanded && (
                      <div
                        data-ecmd-token-editor={tok.id}
                        style={{
                          paddingTop: "6px",
                          borderTop: "1px dashed #CBD5E1",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
                          <div style={{ display: "flex", gap: "3px" }}>
                            <button
                              type="button"
                              data-ecmd-token-editor-scope="all"
                              onClick={() => setScopeById((prev) => ({ ...prev, [tok.id]: "all" }))}
                              style={{
                                padding: "2px 6px",
                                fontSize: "9.5px",
                                fontWeight: 700,
                                borderRadius: "4px",
                                border: editScope === "all" ? "1px solid #0D9488" : "1px solid #CBD5E1",
                                background: editScope === "all" ? "#0D9488" : "#FFFFFF",
                                color: editScope === "all" ? "#FFFFFF" : "#475569",
                                cursor: "pointer",
                              }}
                            >
                              All Themes
                            </button>
                            <button
                              type="button"
                              data-ecmd-token-editor-scope="theme"
                              onClick={() => setScopeById((prev) => ({ ...prev, [tok.id]: "theme" }))}
                              style={{
                                padding: "2px 6px",
                                fontSize: "9.5px",
                                fontWeight: 700,
                                borderRadius: "4px",
                                border: editScope === "theme" ? "1px solid #7C3AED" : "1px solid #CBD5E1",
                                background: editScope === "theme" ? "#7C3AED" : "#FFFFFF",
                                color: editScope === "theme" ? "#FFFFFF" : "#475569",
                                cursor: "pointer",
                              }}
                            >
                              {activeThemeLabel} Only
                            </button>
                          </div>
                          {hasOv && (
                            <button
                              type="button"
                              data-ecmd-token-clear-override={tok.id}
                              onClick={() => onClearTokenOverride(tok.id, activePalette)}
                              style={{
                                padding: "2px 6px",
                                fontSize: "9px",
                                fontWeight: 700,
                                borderRadius: "4px",
                                border: "1px solid #CBD5E1",
                                background: "#FFFFFF",
                                color: "#64748B",
                                cursor: "pointer",
                              }}
                            >
                              ↺ Reset Override
                            </button>
                          )}
                        </div>

                        {tok.type === "paint" || tok.type === "radius" || tok.type === "boxShadow" ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                            {tok.type === "paint" && /^#[0-9a-fA-F]{6}$/.test(compiled) && (
                              <input
                                type="color"
                                value={compiled}
                                onChange={(e) =>
                                  onUpdateTokenValue(tok.id, e.target.value.toUpperCase(), editScope)
                                }
                                style={{ width: "24px", height: "24px", border: "none", padding: 0, cursor: "pointer" }}
                              />
                            )}
                            <input
                              type="text"
                              aria-label={`Edit ${tok.name} Value`}
                              data-ecmd-token-value-input={tok.id}
                              value={compiled}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (tok.type === "boxShadow") {
                                  onUpdateTokenValue(tok.id, { css: raw }, editScope);
                                } else {
                                  onUpdateTokenValue(tok.id, raw, editScope);
                                }
                              }}
                              onKeyDown={(e) => e.stopPropagation()}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                padding: "4px 6px",
                                fontSize: "10.5px",
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                borderRadius: "5px",
                                border: "1px solid #CBD5E1",
                                background: "#FFFFFF",
                                color: "#0F172A",
                                outline: "none",
                              }}
                            />
                          </div>
                        ) : tok.type === "textShadow" ? (
                          (() => {
                            const tsCfg: ThemeTextShadowConfig = normalizeTextShadowConfig(
                              resolveDesignTokenTextShadowConfig(tok, activePalette)
                            );
                            return (
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <input
                                  type="text"
                                  aria-label={`Edit ${tok.name} Text Shadow CSS`}
                                  data-ecmd-token-value-input={tok.id}
                                  value={compiled}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    onUpdateTokenValue(
                                      tok.id,
                                      {
                                        ...tsCfg,
                                        textShadowEnabled: raw.trim().length > 0,
                                        textShadowCustom: raw,
                                        css: raw,
                                      },
                                      editScope
                                    );
                                  }}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  style={{
                                    width: "100%",
                                    boxSizing: "border-box",
                                    padding: "4px 6px",
                                    fontSize: "10.5px",
                                    fontFamily: "ui-monospace, monospace",
                                    borderRadius: "5px",
                                    border: "1px solid #CBD5E1",
                                    background: "#FFFFFF",
                                    color: "#0F172A",
                                    outline: "none",
                                  }}
                                />
                              </div>
                            );
                          })()
                        ) : (
                          (() => {
                            const bCfg: ThemeBorderTokenValue =
                              resolveDesignTokenBorderConfig(tok, activePalette) || {};
                            const patchBorder = (patch: Partial<ThemeBorderTokenValue>) =>
                              onUpdateTokenValue(tok.id, { ...bCfg, ...patch }, editScope);
                            return (
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
                                <input
                                  type="text"
                                  placeholder="Width (e.g. 1px)"
                                  aria-label="Border Token Width"
                                  value={bCfg.width || ""}
                                  onChange={(e) => patchBorder({ width: e.target.value, borderMode: "custom", borderNone: false })}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  style={{ padding: "3px 5px", fontSize: "10.5px", fontFamily: "ui-monospace, monospace", borderRadius: "4px", border: "1px solid #CBD5E1", background: "#FFFFFF" }}
                                />
                                <select
                                  aria-label="Border Token Style"
                                  value={bCfg.style || "solid"}
                                  onChange={(e) => patchBorder({ style: e.target.value as ThemeBorderStyle, borderMode: e.target.value === "none" ? "none" : "custom", borderNone: e.target.value === "none" })}
                                  style={{ padding: "3px 5px", fontSize: "10.5px", borderRadius: "4px", border: "1px solid #CBD5E1", background: "#FFFFFF" }}
                                >
                                  <option value="solid">solid</option>
                                  <option value="dashed">dashed</option>
                                  <option value="dotted">dotted</option>
                                  <option value="none">none</option>
                                </select>
                                <input
                                  type="text"
                                  placeholder="Color / Gradient"
                                  aria-label="Border Token Color"
                                  data-ecmd-token-value-input={tok.id}
                                  value={bCfg.color || ""}
                                  onChange={(e) => patchBorder({ color: e.target.value })}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  style={{ padding: "3px 5px", fontSize: "10.5px", fontFamily: "ui-monospace, monospace", borderRadius: "4px", border: "1px solid #CBD5E1", background: "#FFFFFF" }}
                                />
                                <input
                                  type="text"
                                  placeholder="Radius (optional)"
                                  aria-label="Border Token Radius"
                                  value={bCfg.radius || ""}
                                  onChange={(e) => patchBorder({ radius: e.target.value })}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  style={{ padding: "3px 5px", fontSize: "10.5px", fontFamily: "ui-monospace, monospace", borderRadius: "4px", border: "1px solid #CBD5E1", background: "#FFFFFF" }}
                                />
                              </div>
                            );
                          })()
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        );
      })
      )}
    </div>
  );
}
