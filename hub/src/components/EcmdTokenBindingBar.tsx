import React, { useState } from "react";
import {
  compileDesignTokenCssValue,
  findDesignTokenById,
  hasDesignTokenThemeOverride,
  resolveDesignTokenBorderConfig,
  type ThemeDesignToken,
  type ThemeDesignTokenType,
} from "../lib/ecmdThemeEngine";

export interface EcmdTokenBindingContext {
  tokens: ThemeDesignToken[];
  activePalette: string;
  linkedTokenId?: string | undefined;
  onSelectToken: (tokenId: string) => void;
  onDetachToken: () => void;
  onSaveAsToken: (name: string) => void;
  onEditLinkedToken?: (
    tokenId: string,
    nextValue: unknown,
    scope: "all" | "theme"
  ) => void;
}

export function EcmdLinkedTokenPill({
  token,
  attrTag,
  onDetach,
  onClickPill,
}: {
  token: ThemeDesignToken;
  attrTag: string;
  onDetach: () => void;
  onClickPill?: (() => void) | undefined;
}) {
  return (
    <span
      data-ecmd-linked-token-pill={attrTag}
      data-ecmd-linked-token-id={token.id}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        maxWidth: "100%",
        padding: "1px 5px",
        borderRadius: "999px",
        background: "rgba(13, 148, 136, 0.12)",
        border: "1px solid rgba(13, 148, 136, 0.35)",
        color: "#0F766E",
        fontSize: "9.5px",
        fontWeight: 700,
        lineHeight: 1.3,
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClickPill?.();
        }}
        title={`Linked to token "${token.name}" (${token.id})`}
        style={{
          border: "none",
          background: "transparent",
          color: "inherit",
          fontSize: "inherit",
          fontWeight: "inherit",
          padding: 0,
          cursor: onClickPill ? "pointer" : "default",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: "120px",
        }}
      >
        🔖 {token.name}
      </button>
      <button
        type="button"
        data-ecmd-detach-token-btn={attrTag}
        aria-label={`Detach ${token.name}`}
        title={`Detach "${token.name}" (keeps exact resolved value locally)`}
        onClick={(e) => {
          e.stopPropagation();
          onDetach();
        }}
        style={{
          border: "none",
          background: "transparent",
          color: "#B91C1C",
          fontSize: "10px",
          fontWeight: 700,
          padding: "0 1px",
          cursor: "pointer",
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ⛓️‍💥
      </button>
    </span>
  );
}

function TokenMiniPreview({
  token,
  activePalette,
}: {
  token: ThemeDesignToken;
  activePalette: string;
}) {
  const compiled = compileDesignTokenCssValue(token, activePalette);
  const isDark = activePalette === "ms" || activePalette === "midnight-slate";

  if (token.type === "paint") {
    return (
      <span
        style={{
          width: "16px",
          height: "16px",
          borderRadius: "4px",
          border: "1px solid #CBD5E1",
          background:
            "repeating-conic-gradient(#CBD5E1 0% 25%, #FFFFFF 0% 50%) 50% / 6px 6px",
          position: "relative",
          overflow: "hidden",
          flexShrink: 0,
          display: "inline-block",
        }}
      >
        <span style={{ position: "absolute", inset: 0, background: compiled || "transparent" }} />
      </span>
    );
  }

  if (token.type === "boxShadow") {
    return (
      <span
        style={{
          width: "18px",
          height: "14px",
          borderRadius: "3px",
          background: isDark ? "#1E293B" : "#FFFFFF",
          border: "1px solid #CBD5E1",
          boxShadow: compiled || "none",
          flexShrink: 0,
          display: "inline-block",
        }}
      />
    );
  }

  if (token.type === "textShadow") {
    return (
      <span
        style={{
          minWidth: "20px",
          height: "16px",
          padding: "0 3px",
          borderRadius: "3px",
          background: isDark ? "#0F172A" : "#F8FAFC",
          border: "1px solid #CBD5E1",
          color: isDark ? "#F8FAFC" : "#0F172A",
          fontSize: "10px",
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
    );
  }

  if (token.type === "border") {
    const cfg = resolveDesignTokenBorderConfig(token, activePalette);
    return (
      <span
        style={{
          width: "18px",
          height: "14px",
          borderRadius: cfg?.radius || "3px",
          background: "#FFFFFF",
          borderWidth: cfg?.borderNone || cfg?.borderMode === "none" ? "0px" : cfg?.width || "2px",
          borderStyle: cfg?.borderNone || cfg?.borderMode === "none" ? "none" : cfg?.style || "solid",
          borderColor:
            cfg?.color && !cfg.color.includes("gradient") ? cfg.color : "#0D9488",
          flexShrink: 0,
          display: "inline-block",
          boxSizing: "border-box",
        }}
      />
    );
  }

  return (
    <span
      style={{
        width: "16px",
        height: "14px",
        borderRadius: compiled || "4px",
        background: "rgba(13, 148, 136, 0.14)",
        border: "1.5px solid #0D9488",
        flexShrink: 0,
        display: "inline-block",
      }}
    />
  );
}

export function EcmdTokenPopoverSection({
  tokens,
  compatibleTypes,
  activePalette,
  linkedTokenId,
  editTokenMode,
  onToggleEditTokenMode,
  editTokenScope,
  onChangeEditTokenScope,
  onSelectToken,
  onDetachToken,
  onSaveAsToken,
  saveButtonLabel,
  defaultTokenName,
  attrTag,
}: {
  tokens: ThemeDesignToken[];
  compatibleTypes: ThemeDesignTokenType[];
  activePalette: string;
  linkedTokenId?: string | undefined;
  editTokenMode: boolean;
  onToggleEditTokenMode: (next: boolean) => void;
  editTokenScope: "all" | "theme";
  onChangeEditTokenScope: (next: "all" | "theme") => void;
  onSelectToken: (tokenId: string) => void;
  onDetachToken: () => void;
  onSaveAsToken: (name: string) => void;
  saveButtonLabel: string;
  defaultTokenName?: string | undefined;
  attrTag: string;
}) {
  const [namingOpen, setNamingOpen] = useState(false);
  const [draftName, setDraftName] = useState("");

  const matchingTokens = tokens.filter((t) => compatibleTypes.includes(t.type));
  const linkedToken = findDesignTokenById(tokens, linkedTokenId);
  const activeThemeLabel =
    activePalette === "ms" || activePalette === "midnight-slate" ? "Dark" : "Light";
  const hasThemeOverride = linkedToken
    ? hasDesignTokenThemeOverride(linkedToken, activePalette)
    : false;

  const commitNewToken = () => {
    const clean = draftName.trim() || defaultTokenName || "New Token";
    onSaveAsToken(clean);
    setDraftName("");
    setNamingOpen(false);
  };

  return (
    <div
      data-ecmd-token-section={attrTag}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        padding: "6px 7px",
        borderRadius: "7px",
        border: "1px solid #CBD5E1",
        background: "#F1F5F9",
      }}
    >
      {/* Linked Token Banner */}
      {linkedToken && (
        <div
          data-ecmd-linked-token-banner={attrTag}
          data-ecmd-linked-token-id={linkedToken.id}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            padding: "5px 7px",
            borderRadius: "6px",
            background: "rgba(13, 148, 136, 0.10)",
            border: "1px solid rgba(13, 148, 136, 0.35)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "5px" }}>
            <span
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                color: "#0F766E",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={`Linked to token: ${linkedToken.name} (${linkedToken.id})`}
            >
              🔖 Linked: {linkedToken.name}
            </span>
            {hasThemeOverride && (
              <span
                style={{
                  fontSize: "8.5px",
                  fontWeight: 700,
                  padding: "1px 4px",
                  borderRadius: "4px",
                  background: "rgba(139, 92, 246, 0.14)",
                  color: "#6D28D9",
                  flexShrink: 0,
                }}
              >
                {activeThemeLabel} Override
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
            <button
              type="button"
              data-ecmd-edit-token-everywhere-btn={attrTag}
              aria-pressed={editTokenMode}
              onClick={() => onToggleEditTokenMode(!editTokenMode)}
              style={{
                flex: 1,
                padding: "3px 6px",
                fontSize: "9.5px",
                fontWeight: 700,
                borderRadius: "5px",
                border: editTokenMode ? "1px solid #0D9488" : "1px solid #CBD5E1",
                background: editTokenMode ? "#0D9488" : "#FFFFFF",
                color: editTokenMode ? "#FFFFFF" : "#0F766E",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              ✏️ Edit Token Everywhere
            </button>
            <button
              type="button"
              data-ecmd-detach-token-banner-btn={attrTag}
              onClick={onDetachToken}
              style={{
                padding: "3px 6px",
                fontSize: "9.5px",
                fontWeight: 700,
                borderRadius: "5px",
                border: "1px solid rgba(220, 38, 38, 0.35)",
                background: "#FFFFFF",
                color: "#DC2626",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              ⛓️‍💥 Detach
            </button>
          </div>
          {editTokenMode && (
            <div
              data-ecmd-token-scope-bar={attrTag}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "3px",
                paddingTop: "2px",
              }}
            >
              <button
                type="button"
                data-ecmd-token-scope="all"
                aria-pressed={editTokenScope === "all"}
                onClick={() => onChangeEditTokenScope("all")}
                style={{
                  padding: "2px 4px",
                  fontSize: "9px",
                  fontWeight: 700,
                  borderRadius: "4px",
                  border: editTokenScope === "all" ? "1px solid #0D9488" : "1px solid #CBD5E1",
                  background: editTokenScope === "all" ? "#FFFFFF" : "transparent",
                  color: editTokenScope === "all" ? "#0F766E" : "#475569",
                  cursor: "pointer",
                }}
              >
                All Themes
              </button>
              <button
                type="button"
                data-ecmd-token-scope="theme"
                aria-pressed={editTokenScope === "theme"}
                onClick={() => onChangeEditTokenScope("theme")}
                style={{
                  padding: "2px 4px",
                  fontSize: "9px",
                  fontWeight: 700,
                  borderRadius: "4px",
                  border: editTokenScope === "theme" ? "1px solid #7C3AED" : "1px solid #CBD5E1",
                  background: editTokenScope === "theme" ? "#FFFFFF" : "transparent",
                  color: editTokenScope === "theme" ? "#6D28D9" : "#475569",
                  cursor: "pointer",
                }}
              >
                This Theme Only ({activeThemeLabel})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tokens Header Bar + [+ Save as Token] */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
        <span style={{ fontSize: "9.5px", fontWeight: 800, color: "#475569", letterSpacing: "0.02em" }}>
          🔖 Tokens ({matchingTokens.length})
        </span>
        {!namingOpen && (
          <button
            type="button"
            data-ecmd-save-as-token-btn={attrTag}
            onClick={() => {
              setDraftName(defaultTokenName || "");
              setNamingOpen(true);
            }}
            style={{
              padding: "2px 6px",
              fontSize: "9.5px",
              fontWeight: 700,
              borderRadius: "5px",
              border: "1px solid rgba(13, 148, 136, 0.45)",
              background: "#FFFFFF",
              color: "#0F766E",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {saveButtonLabel}
          </button>
        )}
      </div>

      {/* Inline Name Prompt */}
      {namingOpen && (
        <div
          data-ecmd-save-token-form={attrTag}
          style={{ display: "flex", alignItems: "center", gap: "4px" }}
        >
          <input
            type="text"
            autoFocus
            aria-label="New Token Name"
            data-ecmd-save-token-name-input={attrTag}
            value={draftName}
            placeholder={defaultTokenName || "Token name..."}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                commitNewToken();
              } else if (e.key === "Escape") {
                setNamingOpen(false);
              }
            }}
            style={{
              flex: 1,
              minWidth: 0,
              padding: "3px 6px",
              fontSize: "10.5px",
              borderRadius: "5px",
              border: "1px solid #0D9488",
              background: "#FFFFFF",
              color: "#0F172A",
              outline: "none",
            }}
          />
          <button
            type="button"
            data-ecmd-save-token-confirm-btn={attrTag}
            onClick={commitNewToken}
            style={{
              padding: "3px 7px",
              fontSize: "10px",
              fontWeight: 700,
              borderRadius: "5px",
              border: "none",
              background: "#0D9488",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setNamingOpen(false)}
            style={{
              padding: "3px 5px",
              fontSize: "10px",
              fontWeight: 600,
              borderRadius: "5px",
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#64748B",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Saved Tokens Chips List */}
      {matchingTokens.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {matchingTokens.map((tok) => {
            const isLinked = tok.id === linkedTokenId;
            return (
              <button
                key={tok.id}
                type="button"
                data-ecmd-saved-token-chip={tok.id}
                aria-pressed={isLinked}
                title={`${tok.name} • ${compileDesignTokenCssValue(tok, activePalette)}`}
                onClick={() => onSelectToken(tok.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "3px 6px",
                  borderRadius: "5px",
                  border: isLinked ? "1.5px solid #0D9488" : "1px solid #CBD5E1",
                  background: isLinked ? "rgba(13, 148, 136, 0.12)" : "#FFFFFF",
                  color: isLinked ? "#0F766E" : "#334155",
                  fontSize: "10px",
                  fontWeight: isLinked ? 700 : 600,
                  cursor: "pointer",
                  maxWidth: "100%",
                }}
              >
                <TokenMiniPreview token={tok} activePalette={activePalette} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "110px" }}>
                  {tok.name}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <span style={{ fontSize: "9.5px", color: "#64748B" }}>
          No saved tokens yet — save current value to reuse across groups.
        </span>
      )}
    </div>
  );
}
