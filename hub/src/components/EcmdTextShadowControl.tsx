import React, { useState } from "react";
import {
  DEFAULT_TEXT_SHADOW_CONFIG,
  TEXT_SHADOW_PRESETS,
  buildTextShadowCssValue,
  findDesignTokenById,
  matchTextShadowPresetId,
  normalizeHexColor,
  normalizeTextShadowConfig,
  type ThemeTextShadowConfig,
} from "../lib/ecmdThemeEngine";
import {
  EcmdLinkedTokenPill,
  EcmdTokenPopoverSection,
  type EcmdTokenBindingContext,
} from "./EcmdTokenBindingBar";

export interface EcmdTextShadowControlProps {
  value?: ThemeTextShadowConfig | undefined;
  isMixed?: boolean | undefined;
  isDarkTheme?: boolean | undefined;
  previewTextColor?: string | undefined;
  onChange: (next: ThemeTextShadowConfig) => void;
  tokenBinding?: EcmdTokenBindingContext | undefined;
}

export function EcmdTextShadowControl({
  value,
  isMixed = false,
  isDarkTheme = false,
  previewTextColor,
  onChange,
  tokenBinding,
}: EcmdTextShadowControlProps) {
  const [expanded, setExpanded] = useState(false);
  const [editTokenMode, setEditTokenMode] = useState(false);
  const [editTokenScope, setEditTokenScope] = useState<"all" | "theme">("all");

  const linkedToken = tokenBinding
    ? findDesignTokenById(tokenBinding.tokens, tokenBinding.linkedTokenId)
    : undefined;

  const norm = normalizeTextShadowConfig(value);
  const isEnabled = norm.textShadowEnabled;
  const presetId = isMixed ? "__MIXED__" : matchTextShadowPresetId(norm);
  const resolvedCss = buildTextShadowCssValue(norm);
  const isExplicitNone = isEnabled && resolvedCss === "none";

  const chipBg = isDarkTheme ? "#0F172A" : "#F8FAFC";
  const chipFg =
    previewTextColor &&
    previewTextColor.trim() &&
    previewTextColor.trim().toLowerCase() !== "transparent"
      ? previewTextColor.trim()
      : isDarkTheme
        ? "#F8FAFC"
        : "#0F172A";

  const emitTextShadow = (next: ThemeTextShadowConfig) => {
    if (linkedToken && editTokenMode && tokenBinding?.onEditLinkedToken) {
      tokenBinding.onEditLinkedToken(
        linkedToken.id,
        {
          ...next,
          css: buildTextShadowCssValue(next),
        },
        editTokenScope
      );
      return;
    }
    onChange(next);
  };

  const commitPatch = (patch: Partial<ThemeTextShadowConfig>) => {
    const next: ThemeTextShadowConfig = {
      textShadowEnabled: norm.textShadowEnabled,
      textShadowX: norm.textShadowX,
      textShadowY: norm.textShadowY,
      textShadowBlur: norm.textShadowBlur,
      textShadowColor: norm.textShadowColor,
      textShadowOpacity: norm.textShadowOpacity,
      textShadowCustom: norm.textShadowCustom,
      ...patch,
    };
    emitTextShadow(next);
  };

  const handleToggle = (checked: boolean) => {
    commitPatch({ textShadowEnabled: checked });
    if (checked) setExpanded(true);
  };

  const handlePresetChange = (nextPresetId: string) => {
    if (nextPresetId === "__MIXED__") return;
    if (nextPresetId === "__CUSTOM__") {
      setExpanded(true);
      commitPatch({
        textShadowEnabled: true,
        textShadowCustom: norm.textShadowCustom === "none" ? "" : norm.textShadowCustom,
      });
      return;
    }
    const found = TEXT_SHADOW_PRESETS.find((p) => p.id === nextPresetId);
    if (!found) return;
    emitTextShadow({ ...found.config });
    if (found.config.textShadowEnabled) {
      setExpanded(true);
    }
  };

  const updateSliderField = (
    patch: Partial<
      Pick<
        ThemeTextShadowConfig,
        "textShadowX" | "textShadowY" | "textShadowBlur" | "textShadowColor" | "textShadowOpacity"
      >
    >
  ) => {
    commitPatch({
      ...patch,
      textShadowEnabled: true,
      textShadowCustom: "",
    });
  };

  const safeColorHex = normalizeHexColor(norm.textShadowColor, DEFAULT_TEXT_SHADOW_CONFIG.textShadowColor);

  return (
    <div
      data-ecmd-prop-row="textShadow"
      data-ecmd-prop-enabled={isEnabled ? "true" : "false"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        padding: "4px 0",
        opacity: isEnabled ? 1 : 0.72,
        transition: "opacity 0.15s ease",
      }}
    >
      {/* Compact Header Row: Toggle + Label + Miniature "Aa" Preview + Quick Preset Selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "5px" }}>
        <input
          type="checkbox"
          checked={isEnabled}
          aria-label="Enable Text Shadow"
          data-ecmd-text-shadow-toggle="true"
          data-ecmd-prop-toggle="textShadow"
          title={
            isEnabled
              ? "Turn OFF Text Shadow (preserves saved values, leaves text-shadow untouched)"
              : "Turn ON Text Shadow"
          }
          onChange={(e) => handleToggle(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "13px",
            height: "13px",
            margin: 0,
            cursor: "pointer",
            flexShrink: 0,
            accentColor: "#0D9488",
          }}
        />

        <button
          type="button"
          data-ecmd-text-shadow-expand="true"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "Collapse Text Shadow builder" : "Expand Text Shadow visual controls"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "3px",
            width: "86px",
            flexShrink: 0,
            padding: "2px 0",
            border: "none",
            background: "transparent",
            color: "#334155",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span style={{ fontSize: "9px", color: "#64748B", width: "8px", flexShrink: 0 }}>
            {expanded ? "▾" : "▸"}
          </span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            ✨ Text Shd
          </span>
        </button>

        {/* Live Miniature "Aa" Preview Chip */}
        <span
          data-ecmd-text-shadow-preview="true"
          title={resolvedCss ? `Live preview: text-shadow: ${resolvedCss}` : "Text shadow off"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "28px",
            height: "24px",
            padding: "0 5px",
            borderRadius: "5px",
            border: isEnabled ? "1px solid rgba(13, 148, 136, 0.55)" : "1px solid #CBD5E1",
            background: chipBg,
            color: chipFg,
            fontSize: "12px",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            textShadow: resolvedCss || "none",
            flexShrink: 0,
            userSelect: "none",
          }}
        >
          Aa
        </span>

        <select
          aria-label="Text Shadow Preset"
          data-ecmd-text-shadow-preset="true"
          value={presetId}
          onChange={(e) => handlePresetChange(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "4px 6px",
            fontSize: "11px",
            fontWeight: 500,
            borderRadius: "6px",
            border: "1px solid #E2E8F0",
            background: "#F8FAFC",
            color: "#0F172A",
            cursor: "pointer",
            outline: "none",
          }}
        >
          {isMixed && <option value="__MIXED__">Mixed — select preset</option>}
          {TEXT_SHADOW_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value="__CUSTOM__">Custom</option>
        </select>

        <button
          type="button"
          aria-label="Toggle Text Shadow Controls"
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "Hide Text Shadow sliders" : "Fine-tune X, Y, Blur, Shadow Color & Opacity"}
          style={{
            width: "22px",
            height: "24px",
            borderRadius: "5px",
            border: expanded ? "1px solid #0D9488" : "1px solid #E2E8F0",
            background: expanded ? "rgba(13, 148, 136, 0.10)" : "#F8FAFC",
            color: expanded ? "#0F766E" : "#475569",
            fontSize: "11px",
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ⚙
        </button>
      </div>

      {/* Linked Token Pill on Groups Inspector Row */}
      {linkedToken && (
        <div style={{ marginLeft: "18px", display: "flex", alignItems: "center" }}>
          <EcmdLinkedTokenPill
            token={linkedToken}
            attrTag="textShadow"
            onClickPill={() => setExpanded(true)}
            onDetach={() => {
              setEditTokenMode(false);
              tokenBinding?.onDetachToken();
            }}
          />
        </div>
      )}

      {/* Collapsible Visual Text Shadow Builder */}
      {expanded && (
        <div
          data-ecmd-text-shadow-panel="true"
          style={{
            marginLeft: "18px",
            padding: "8px 9px",
            borderRadius: "8px",
            border: "1px solid #CBD5E1",
            background: "#F8FAFC",
            display: "flex",
            flexDirection: "column",
            gap: "7px",
          }}
        >
          {/* Reusable Text Shadow Tokens Bar */}
          {tokenBinding && (
            <EcmdTokenPopoverSection
              tokens={tokenBinding.tokens}
              compatibleTypes={["textShadow"]}
              activePalette={tokenBinding.activePalette}
              linkedTokenId={tokenBinding.linkedTokenId}
              editTokenMode={editTokenMode}
              onToggleEditTokenMode={setEditTokenMode}
              editTokenScope={editTokenScope}
              onChangeEditTokenScope={setEditTokenScope}
              onSelectToken={(tokId) => tokenBinding.onSelectToken(tokId)}
              onDetachToken={() => {
                setEditTokenMode(false);
                tokenBinding.onDetachToken();
              }}
              onSaveAsToken={(name) => tokenBinding.onSaveAsToken(name)}
              saveButtonLabel="+ Save Current Shadow as Token"
              defaultTokenName="Heading Crisp + Glow"
              attrTag="textShadow"
            />
          )}

          {/* Expanded Live "Aa" Preview Chip + Generated CSS Readout */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 8px",
              borderRadius: "6px",
              border: "1px solid #E2E8F0",
              background: chipBg,
            }}
          >
            <span
              data-ecmd-text-shadow-preview-large="true"
              style={{
                fontSize: "18px",
                fontWeight: 800,
                lineHeight: 1.1,
                color: chipFg,
                textShadow: resolvedCss || "none",
                flexShrink: 0,
              }}
            >
              Aa
            </span>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: "1px",
              }}
            >
              <span
                style={{
                  fontSize: "9.5px",
                  fontWeight: 700,
                  color: isDarkTheme ? "#94A3B8" : "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                }}
              >
                {isExplicitNone
                  ? "Explicit Clear (none)"
                  : isEnabled
                    ? norm.textShadowCustom
                      ? "Multi-Layer / Custom"
                      : "Live Text Shadow"
                    : "Off (Untouched)"}
              </span>
              <code
                data-ecmd-text-shadow-css-readout="true"
                style={{
                  fontSize: "9.5px",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  color: isDarkTheme ? "#E2E8F0" : "#334155",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={resolvedCss || "No text-shadow rule emitted"}
              >
                {resolvedCss || "— no CSS emitted —"}
              </code>
            </div>
          </div>

          {/* Compact 3-Column X / Y / Blur Numeric + Slider Controls */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
            {(
              [
                { key: "textShadowX", attr: "x", label: "X (px)", min: -20, max: 20, val: norm.textShadowX },
                { key: "textShadowY", attr: "y", label: "Y (px)", min: -20, max: 20, val: norm.textShadowY },
                { key: "textShadowBlur", attr: "blur", label: "Blur (px)", min: 0, max: 40, val: norm.textShadowBlur },
              ] as const
            ).map((ctrl) => (
              <div key={ctrl.key} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "2px" }}>
                  <span style={{ fontSize: "9.5px", fontWeight: 600, color: "#475569" }}>{ctrl.label}</span>
                  <input
                    type="number"
                    aria-label={`Text Shadow ${ctrl.label}`}
                    data-ecmd-text-shadow-input={ctrl.attr}
                    min={ctrl.min}
                    max={ctrl.max}
                    value={ctrl.val}
                    onChange={(e) => {
                      const num = Number(e.target.value);
                      if (!Number.isNaN(num)) {
                        updateSliderField({ [ctrl.key]: num });
                      }
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={{
                      width: "40px",
                      padding: "2px 3px",
                      fontSize: "10px",
                      fontFamily: "ui-monospace, monospace",
                      textAlign: "right",
                      borderRadius: "4px",
                      border: "1px solid #CBD5E1",
                      background: "#FFFFFF",
                      color: "#0F172A",
                      outline: "none",
                    }}
                  />
                </div>
                <input
                  type="range"
                  aria-label={`Text Shadow ${ctrl.label} Slider`}
                  data-ecmd-text-shadow-slider={ctrl.attr}
                  min={ctrl.min}
                  max={ctrl.max}
                  value={Math.max(ctrl.min, Math.min(ctrl.max, ctrl.val))}
                  onChange={(e) => updateSliderField({ [ctrl.key]: Number(e.target.value) })}
                  style={{ width: "100%", height: "4px", accentColor: "#0D9488", cursor: "pointer" }}
                />
              </div>
            ))}
          </div>

          {/* Shadow Color Picker + Opacity (%) Controls */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 8px", alignItems: "end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "10px", fontWeight: 600, color: "#475569" }}>Shadow Color</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 4px",
                  borderRadius: "5px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                }}
              >
                <input
                  type="color"
                  aria-label="Text Shadow Color Picker"
                  data-ecmd-text-shadow-input="color-picker"
                  value={safeColorHex}
                  onChange={(e) => updateSliderField({ textShadowColor: e.target.value.toUpperCase() })}
                  style={{
                    width: "20px",
                    height: "18px",
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                />
                <input
                  type="text"
                  aria-label="Text Shadow Color Hex"
                  data-ecmd-text-shadow-input="color"
                  value={safeColorHex}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
                      updateSliderField({ textShadowColor: normalizeHexColor(v) });
                    }
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: "none",
                    background: "transparent",
                    fontSize: "10.5px",
                    fontFamily: "ui-monospace, monospace",
                    color: "#0F172A",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
                <span style={{ fontSize: "10px", fontWeight: 600, color: "#475569" }}>Opacity (%)</span>
                <input
                  type="number"
                  aria-label="Text Shadow Opacity (%)"
                  data-ecmd-text-shadow-input="opacity"
                  min={0}
                  max={100}
                  value={norm.textShadowOpacity}
                  onChange={(e) => {
                    const num = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    updateSliderField({ textShadowOpacity: num });
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{
                    width: "46px",
                    padding: "2px 4px",
                    fontSize: "10.5px",
                    fontFamily: "ui-monospace, monospace",
                    textAlign: "right",
                    borderRadius: "4px",
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    color: "#0F172A",
                    outline: "none",
                  }}
                />
              </div>
              <input
                type="range"
                aria-label="Text Shadow Opacity Slider"
                data-ecmd-text-shadow-slider="opacity"
                min={0}
                max={100}
                value={norm.textShadowOpacity}
                onChange={(e) => updateSliderField({ textShadowOpacity: Number(e.target.value) })}
                style={{ width: "100%", height: "4px", accentColor: "#0D9488", cursor: "pointer" }}
              />
            </div>
          </div>

          {/* Optional Multi-Layer / Custom Raw Override */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "9.5px", fontWeight: 600, color: "#64748B" }}>
                Multi-Layer / Custom CSS (optional)
              </span>
              {norm.textShadowCustom && (
                <button
                  type="button"
                  onClick={() => commitPatch({ textShadowCustom: "" })}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#DC2626",
                    fontSize: "9.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Use Sliders
                </button>
              )}
            </div>
            <input
              type="text"
              aria-label="Text Shadow Custom CSS"
              data-ecmd-text-shadow-input="custom"
              value={isMixed ? "" : norm.textShadowCustom}
              placeholder="e.g. 0 1px 2px rgba(0,0,0,0.45), 0 2px 8px rgba(16,185,129,0.35)"
              onChange={(e) => {
                const raw = e.target.value;
                commitPatch({
                  textShadowCustom: raw,
                  textShadowEnabled: raw.trim().length > 0 ? true : norm.textShadowEnabled,
                });
              }}
              onKeyDown={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "4px 6px",
                fontSize: "10px",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                borderRadius: "5px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#0F172A",
                outline: "none",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
