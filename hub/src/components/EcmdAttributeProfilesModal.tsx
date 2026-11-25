import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type CoreAttributeKey =
  | "cornerRadius"
  | "spacing"
  | "background"
  | "text"
  | "border"
  | "borderWidth"
  | "iconColor"
  | "fontWeight"
  | "outerShadow"
  | "innerShadow"
  | "fluidScale";

export type MappedGroupPropKey =
  | "radius"
  | "spacing"
  | "bg"
  | "text"
  | "border"
  | "borderWidth"
  | "icon"
  | "fontWeight"
  | "outerShadow"
  | "innerShadow"
  | "fluidScale";

export interface CoreAttributeDef {
  id: CoreAttributeKey;
  propKey: MappedGroupPropKey;
  label: string;
  shortLabel: string;
}

export const CORE_STYLE_ATTRIBUTES: CoreAttributeDef[] = [
  { id: "background", propKey: "bg", label: "Background", shortLabel: "Bg" },
  { id: "text", propKey: "text", label: "Text", shortLabel: "Text" },
  { id: "border", propKey: "border", label: "Border", shortLabel: "Border" },
  { id: "borderWidth", propKey: "borderWidth", label: "Border Width", shortLabel: "Brd W" },
  { id: "cornerRadius", propKey: "radius", label: "Corner Radius", shortLabel: "Radius" },
  { id: "spacing", propKey: "spacing", label: "Spacing", shortLabel: "Space" },
  { id: "iconColor", propKey: "icon", label: "Icon Color", shortLabel: "Icon" },
  { id: "fontWeight", propKey: "fontWeight", label: "Font Weight", shortLabel: "Weight" },
  { id: "outerShadow", propKey: "outerShadow", label: "Outer Shadow", shortLabel: "Outer Shd" },
  { id: "innerShadow", propKey: "innerShadow", label: "Inner Shadow", shortLabel: "Inner Shd" },
  { id: "fluidScale", propKey: "fluidScale", label: "Fluid Auto-Scale", shortLabel: "Fluid" }
];

export interface AttributeProfile {
  id: string;
  name: string;
  builtIn?: boolean;
  enabledAttrs: Record<CoreAttributeKey, boolean>;
}

export interface AttributeProfilesStore {
  profiles: AttributeProfile[];
  defaultProfileId: string;
  deletedBuiltInProfileIds?: string[];
}

function makeAttrMap(enabled: CoreAttributeKey[]): Record<CoreAttributeKey, boolean> {
  const set = new Set<CoreAttributeKey>(enabled);
  return {
    cornerRadius: set.has("cornerRadius"),
    spacing: set.has("spacing"),
    background: set.has("background"),
    text: set.has("text"),
    border: set.has("border"),
    borderWidth: set.has("borderWidth"),
    iconColor: set.has("iconColor"),
    fontWeight: set.has("fontWeight"),
    outerShadow: set.has("outerShadow"),
    innerShadow: set.has("innerShadow"),
    fluidScale: set.has("fluidScale")
  };
}

export const BUILTIN_ATTRIBUTE_PROFILES: AttributeProfile[] = [
  {
    id: "interactive-button",
    name: "Interactive Button",
    builtIn: true,
    enabledAttrs: makeAttrMap([
      "background",
      "text",
      "border",
      "borderWidth",
      "cornerRadius",
      "spacing",
      "fontWeight",
      "outerShadow",
      "innerShadow",
      "fluidScale"
    ])
  },
  {
    id: "text-input",
    name: "Text Input",
    builtIn: true,
    enabledAttrs: makeAttrMap([
      "background",
      "text",
      "border",
      "borderWidth",
      "cornerRadius",
      "spacing",
      "innerShadow",
      "outerShadow",
      "fluidScale"
    ])
  },
  {
    id: "surface-card",
    name: "Surface Card",
    builtIn: true,
    enabledAttrs: makeAttrMap([
      "background",
      "text",
      "border",
      "borderWidth",
      "cornerRadius",
      "spacing",
      "outerShadow",
      "fluidScale"
    ])
  },
  {
    id: "typography-menu-text",
    name: "Typography / Menu Text",
    builtIn: true,
    enabledAttrs: makeAttrMap(["text", "fontWeight", "iconColor", "fluidScale"])
  },
  {
    id: "all-attributes",
    name: "All Attributes Enabled",
    builtIn: true,
    enabledAttrs: makeAttrMap([
      "cornerRadius",
      "spacing",
      "background",
      "text",
      "border",
      "borderWidth",
      "iconColor",
      "fontWeight",
      "outerShadow",
      "innerShadow",
      "fluidScale"
    ])
  }
];

export const ATTRIBUTE_PROFILES_STORAGE_KEY = "ecmd_attribute_profiles_v1";
export const ATTRIBUTE_PROFILES_EVENT = "ecmd-attribute-profiles-change";

export function getDefaultAttributeProfilesStore(): AttributeProfilesStore {
  return {
    profiles: BUILTIN_ATTRIBUTE_PROFILES.map((p) => ({
      ...p,
      enabledAttrs: { ...p.enabledAttrs }
    })),
    defaultProfileId: "all-attributes",
    deletedBuiltInProfileIds: []
  };
}

export function loadAttributeProfilesStore(): AttributeProfilesStore {
  const fallback = getDefaultAttributeProfilesStore();
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(ATTRIBUTE_PROFILES_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.profiles)) return fallback;

    const deletedBuiltInIds: string[] = Array.isArray(parsed.deletedBuiltInProfileIds)
      ? Array.from(
          new Set(
            parsed.deletedBuiltInProfileIds.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
          )
        )
      : [];
    const deletedSet = new Set<string>(deletedBuiltInIds);

    const savedById = new Map<string, AttributeProfile>();
    parsed.profiles.forEach((p: any) => {
      if (p && typeof p.id === "string" && typeof p.name === "string" && p.enabledAttrs) {
        savedById.set(p.id, {
          id: p.id,
          name: p.name,
          builtIn: Boolean(p.builtIn),
          enabledAttrs: {
            ...makeAttrMap([]),
            ...p.enabledAttrs
          }
        });
      }
    });

    // Include built-in starter profiles that have NOT been deleted by the user (preserving user checkbox edits if saved)
    const merged: AttributeProfile[] = [];
    BUILTIN_ATTRIBUTE_PROFILES.forEach((b) => {
      const saved = savedById.get(b.id);
      savedById.delete(b.id);
      if (deletedSet.has(b.id)) return;
      if (saved) {
        merged.push({ ...saved, builtIn: true });
      } else {
        merged.push({ ...b, enabledAttrs: { ...b.enabledAttrs } });
      }
    });

    // Append custom user profiles
    savedById.forEach((custom) => {
      merged.push({ ...custom, builtIn: false });
    });

    // 1-profile safety guard: never return an empty/broken profile list
    const finalDeletedIds = deletedBuiltInIds.slice();
    if (merged.length === 0) {
      const safeFallback =
        BUILTIN_ATTRIBUTE_PROFILES.find((b) => b.id === "all-attributes") || BUILTIN_ATTRIBUTE_PROFILES[0]!;
      merged.push({ ...safeFallback, enabledAttrs: { ...safeFallback.enabledAttrs } });
      const idx = finalDeletedIds.indexOf(safeFallback.id);
      if (idx >= 0) finalDeletedIds.splice(idx, 1);
    }

    const defaultProfileId = merged.some((p) => p.id === parsed.defaultProfileId)
      ? parsed.defaultProfileId
      : (merged.find((p) => p.id === "all-attributes")?.id || merged[0]!.id);

    return {
      profiles: merged,
      defaultProfileId,
      deletedBuiltInProfileIds: finalDeletedIds
    };
  } catch {
    return fallback;
  }
}

export function deleteAttributeProfileFromStore(
  store: AttributeProfilesStore,
  profileId: string
): AttributeProfilesStore | null {
  if (!profileId || !Array.isArray(store.profiles) || store.profiles.length <= 1) {
    return null;
  }
  const target = store.profiles.find((p) => p.id === profileId);
  if (!target) return null;

  const remaining = store.profiles.filter((p) => p.id !== profileId);
  if (remaining.length === 0) return null;

  const isBuiltIn =
    Boolean(target.builtIn) || BUILTIN_ATTRIBUTE_PROFILES.some((b) => b.id === profileId);
  const nextDeleted = Array.from(
    new Set([
      ...(store.deletedBuiltInProfileIds || []),
      ...(isBuiltIn ? [profileId] : [])
    ])
  );

  const nextDefault =
    store.defaultProfileId === profileId || !remaining.some((p) => p.id === store.defaultProfileId)
      ? remaining[0]!.id
      : store.defaultProfileId;

  return {
    profiles: remaining,
    defaultProfileId: nextDefault,
    deletedBuiltInProfileIds: nextDeleted
  };
}

export function hasModifiedOrDeletedBuiltIns(store: AttributeProfilesStore): boolean {
  if ((store.deletedBuiltInProfileIds?.length || 0) > 0) return true;
  for (const builtIn of BUILTIN_ATTRIBUTE_PROFILES) {
    const existing = store.profiles.find((p) => p.id === builtIn.id);
    if (!existing) return true;
    if (existing.name !== builtIn.name) return true;
    for (const attr of CORE_STYLE_ATTRIBUTES) {
      if (Boolean(existing.enabledAttrs[attr.id]) !== Boolean(builtIn.enabledAttrs[attr.id])) {
        return true;
      }
    }
  }
  return false;
}

export function restoreBuiltInAttributeProfiles(store: AttributeProfilesStore): AttributeProfilesStore {
  const builtInIds = new Set(BUILTIN_ATTRIBUTE_PROFILES.map((b) => b.id));
  const customProfiles = store.profiles
    .filter((p) => !p.builtIn && !builtInIds.has(p.id))
    .map((p) => ({ ...p, builtIn: false, enabledAttrs: { ...p.enabledAttrs } }));
  const restoredProfiles: AttributeProfile[] = [
    ...BUILTIN_ATTRIBUTE_PROFILES.map((b) => ({ ...b, builtIn: true, enabledAttrs: { ...b.enabledAttrs } })),
    ...customProfiles
  ];
  const nextDefault = restoredProfiles.some((p) => p.id === store.defaultProfileId)
    ? store.defaultProfileId
    : "all-attributes";

  return {
    profiles: restoredProfiles,
    defaultProfileId: nextDefault,
    deletedBuiltInProfileIds: []
  };
}

export function saveAttributeProfilesStore(store: AttributeProfilesStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ATTRIBUTE_PROFILES_STORAGE_KEY, JSON.stringify(store));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(ATTRIBUTE_PROFILES_EVENT, { detail: store }));
  } catch {}
}

export function attributeProfileToDisabledProps(
  profile: AttributeProfile | undefined | null
): Record<string, boolean> | undefined {
  if (!profile) return undefined;
  const disabled: Record<string, boolean> = {};
  CORE_STYLE_ATTRIBUTES.forEach((attr) => {
    if (!profile.enabledAttrs[attr.id]) {
      disabled[attr.propKey] = true;
    }
  });
  return Object.keys(disabled).length > 0 ? disabled : undefined;
}

export function applyAttributeProfileToDisabledProps(
  existingDisabled: Record<string, boolean> | undefined,
  profile: AttributeProfile
): Record<string, boolean> | undefined {
  const next: Record<string, boolean> = { ...(existingDisabled || {}) };
  CORE_STYLE_ATTRIBUTES.forEach((attr) => {
    if (profile.enabledAttrs[attr.id]) {
      delete next[attr.propKey];
      if (attr.propKey === "outerShadow") {
        delete next["shadow"];
        delete next["elevation"];
      }
    } else {
      next[attr.propKey] = true;
    }
  });
  return Object.keys(next).length > 0 ? next : undefined;
}

export interface EcmdAttributeProfilesModalProps {
  open: boolean;
  onClose: () => void;
  onProfilesChange?: (store: AttributeProfilesStore) => void;
  anchorDoc?: Document | null;
}

export function EcmdAttributeProfilesModal({
  open,
  onClose,
  onProfilesChange,
  anchorDoc
}: EcmdAttributeProfilesModalProps) {
  const [store, setStore] = useState<AttributeProfilesStore>(() => loadAttributeProfilesStore());
  const [selectedProfileId, setSelectedProfileId] = useState<string>(() => {
    const init = loadAttributeProfilesStore();
    return init.profiles[0]?.id || "interactive-button";
  });
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 76, left: 120 });
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const latest = loadAttributeProfilesStore();
    setStore(latest);
    if (!latest.profiles.some((p) => p.id === selectedProfileId)) {
      setSelectedProfileId(latest.profiles[0]?.id || "interactive-button");
    }
  }, [open, selectedProfileId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onSync = (e: Event) => {
      const ce = e as CustomEvent<AttributeProfilesStore>;
      const next =
        ce.detail && Array.isArray(ce.detail.profiles)
          ? ce.detail
          : loadAttributeProfilesStore();
      setStore(next);
      setSelectedProfileId((prev) =>
        next.profiles.some((p) => p.id === prev) ? prev : (next.profiles[0]?.id || next.defaultProfileId)
      );
    };
    window.addEventListener(ATTRIBUTE_PROFILES_EVENT, onSync);
    return () => window.removeEventListener(ATTRIBUTE_PROFILES_EVENT, onSync);
  }, []);

  if (!open) return null;

  const commitStore = (next: AttributeProfilesStore) => {
    setStore(next);
    saveAttributeProfilesStore(next);
    onProfilesChange?.(next);
  };

  const activeProfile =
    store.profiles.find((p) => p.id === selectedProfileId) ||
    store.profiles[0] ||
    BUILTIN_ATTRIBUTE_PROFILES[0]!;

  const handleToggleAttr = (attrId: CoreAttributeKey, checked: boolean) => {
    const nextProfiles = store.profiles.map((p) =>
      p.id === activeProfile.id
        ? { ...p, enabledAttrs: { ...p.enabledAttrs, [attrId]: checked } }
        : p
    );
    commitStore({ ...store, profiles: nextProfiles });
  };

  const handleNewProfile = () => {
    const customCount = store.profiles.filter((p) => !p.builtIn).length + 1;
    const id = `custom-profile-${Date.now()}-${customCount}`;
    const created: AttributeProfile = {
      id,
      name: `Custom Profile ${customCount}`,
      builtIn: false,
      enabledAttrs: makeAttrMap(["background", "text", "border", "cornerRadius"])
    };
    commitStore({ ...store, profiles: [...store.profiles, created] });
    setSelectedProfileId(id);
  };

  const handleDuplicateProfile = () => {
    const id = `custom-profile-${Date.now()}`;
    const copy: AttributeProfile = {
      id,
      name: `${activeProfile.name} (Copy)`,
      builtIn: false,
      enabledAttrs: { ...activeProfile.enabledAttrs }
    };
    commitStore({ ...store, profiles: [...store.profiles, copy] });
    setSelectedProfileId(id);
  };

  const handleRenameProfile = (nextName: string) => {
    if (activeProfile.builtIn) return;
    const nextProfiles = store.profiles.map((p) =>
      p.id === activeProfile.id ? { ...p, name: nextName } : p
    );
    commitStore({ ...store, profiles: nextProfiles });
  };

  const canDeleteActive = store.profiles.length > 1;
  const showRestoreBuiltIns = hasModifiedOrDeletedBuiltIns(store);

  const handleDeleteProfile = () => {
    const next = deleteAttributeProfileFromStore(store, activeProfile.id);
    if (!next) return;
    commitStore(next);
    setSelectedProfileId(next.profiles[0]?.id || next.defaultProfileId);
  };

  const handleRestoreBuiltIns = () => {
    const restored = restoreBuiltInAttributeProfiles(store);
    commitStore(restored);
    if (!restored.profiles.some((p) => p.id === selectedProfileId)) {
      setSelectedProfileId(restored.profiles[0]?.id || restored.defaultProfileId);
    }
  };

  const handleSetDefaultProfile = (profileId: string) => {
    commitStore({ ...store, defaultProfileId: profileId });
  };

  const startDrag = (e: React.MouseEvent) => {
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === "button" || tag === "select" || tag === "input") return;
    e.preventDefault();
    e.stopPropagation();
    const doc = modalRef.current?.ownerDocument || anchorDoc || document;
    const win = doc.defaultView || window;
    const sx = e.clientX;
    const sy = e.clientY;
    const orig = { ...pos };
    const onMove = (ev: MouseEvent) => {
      const nextLeft = Math.max(8, Math.min(orig.left + (ev.clientX - sx), (win.innerWidth || 1280) - 80));
      const nextTop = Math.max(8, Math.min(orig.top + (ev.clientY - sy), (win.innerHeight || 800) - 60));
      setPos({ top: nextTop, left: nextLeft });
    };
    const onUp = () => {
      doc.removeEventListener("mousemove", onMove, true);
      doc.removeEventListener("mouseup", onUp, true);
    };
    doc.addEventListener("mousemove", onMove, true);
    doc.addEventListener("mouseup", onUp, true);
  };

  const enabledCount = CORE_STYLE_ATTRIBUTES.filter((a) => activeProfile.enabledAttrs[a.id]).length;

  const modalNode = (
    <div
      ref={modalRef}
      id="ecmd-attribute-profiles-modal"
      data-ecmd-attr-profiles-modal="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        width: "356px",
        maxHeight: "82vh",
        display: "flex",
        flexDirection: "column",
        background: "#0F172A",
        color: "#F8FAFC",
        border: "1px solid #334155",
        borderRadius: "12px",
        boxShadow: "0 24px 60px rgba(2, 6, 23, 0.65), 0 0 0 1px rgba(20, 184, 166, 0.18)",
        zIndex: 2147483600,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "12px",
        userSelect: "none",
        overflow: "hidden"
      }}
    >
      {/* Draggable Dark Slate Header */}
      <div
        onMouseDown={startDrag}
        title="Drag to move Attribute Profiles popup"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          background: "#1E293B",
          borderBottom: "1px solid #334155",
          cursor: "grab"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <span style={{ fontSize: "13px" }}>🎛️</span>
          <span style={{ fontWeight: 700, fontSize: "12.5px", color: "#F8FAFC" }}>
            Attribute Profiles
          </span>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              padding: "1px 6px",
              borderRadius: "999px",
              background: "rgba(20, 184, 166, 0.18)",
              color: "#5EEAD4"
            }}
          >
            {enabledCount}/{CORE_STYLE_ATTRIBUTES.length} ON
          </span>
        </div>
        <button
          type="button"
          data-ecmd-attr-profiles-close="true"
          aria-label="Close Attribute Profiles"
          onClick={onClose}
          style={{
            border: "1px solid #475569",
            background: "#0F172A",
            color: "#E2E8F0",
            borderRadius: "6px",
            padding: "2px 8px",
            fontSize: "11px",
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "11px 13px 13px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
        {/* Profile Selector + Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
            <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Select Profile
            </span>
            <div style={{ display: "flex", gap: "4px" }}>
              <button
                type="button"
                data-ecmd-attr-profile-new="true"
                onClick={handleNewProfile}
                style={{
                  border: "1px solid rgba(20, 184, 166, 0.45)",
                  background: "rgba(20, 184, 166, 0.16)",
                  color: "#5EEAD4",
                  borderRadius: "5px",
                  padding: "2px 7px",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                + New Attribute Profile
              </button>
              <button
                type="button"
                data-ecmd-attr-profile-dup="true"
                onClick={handleDuplicateProfile}
                title="Duplicate selected profile"
                style={{
                  border: "1px solid #334155",
                  background: "#1E293B",
                  color: "#CBD5E1",
                  borderRadius: "5px",
                  padding: "2px 6px",
                  fontSize: "10.5px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Copy
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <select
              aria-label="Active Attribute Profile"
              data-ecmd-attr-profile-select="true"
              value={activeProfile.id}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                padding: "6px 9px",
                borderRadius: "7px",
                border: "1px solid #334155",
                background: "#1E293B",
                color: "#F8FAFC",
                fontSize: "12px",
                fontWeight: 600,
                outline: "none",
                cursor: "pointer"
              }}
            >
              {store.profiles.map((p) => (
                <option key={p.id} value={p.id} style={{ background: "#0F172A", color: "#F8FAFC" }}>
                  {p.name} {p.builtIn ? "(Starter)" : "(Custom)"}
                </option>
              ))}
            </select>
            <button
              type="button"
              data-ecmd-attr-profile-del="true"
              disabled={!canDeleteActive}
              onClick={handleDeleteProfile}
              title={canDeleteActive ? `Delete "${activeProfile.name}" profile` : "Keep at least 1 profile"}
              style={{
                border: canDeleteActive ? "1px solid rgba(248, 113, 113, 0.45)" : "1px solid #334155",
                background: canDeleteActive ? "rgba(239, 68, 68, 0.16)" : "rgba(51, 65, 85, 0.35)",
                color: canDeleteActive ? "#FCA5A5" : "#64748B",
                borderRadius: "7px",
                padding: "6px 8px",
                fontSize: "10.5px",
                fontWeight: 700,
                cursor: canDeleteActive ? "pointer" : "not-allowed",
                opacity: canDeleteActive ? 1 : 0.55,
                whiteSpace: "nowrap",
                flexShrink: 0
              }}
            >
              🗑️ Delete Profile
            </button>
          </div>

          {!activeProfile.builtIn && (
            <input
              type="text"
              aria-label="Rename Custom Profile"
              data-ecmd-attr-profile-rename="true"
              value={activeProfile.name}
              onChange={(e) => handleRenameProfile(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Profile Name"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "5px 8px",
                borderRadius: "6px",
                border: "1px solid #334155",
                background: "#020617",
                color: "#F8FAFC",
                fontSize: "11.5px",
                outline: "none"
              }}
            />
          )}
        </div>

        {/* Core Style Attributes ON/OFF Checkboxes */}
        <div
          style={{
            border: "1px solid #1E293B",
            background: "#020617",
            borderRadius: "9px",
            padding: "9px 10px",
            display: "flex",
            flexDirection: "column",
            gap: "6px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Core Style Attributes
            </span>
            <div style={{ display: "flex", gap: "5px" }}>
              <button
                type="button"
                onClick={() => {
                  const allOn = makeAttrMap(CORE_STYLE_ATTRIBUTES.map((a) => a.id));
                  commitStore({
                    ...store,
                    profiles: store.profiles.map((p) =>
                      p.id === activeProfile.id ? { ...p, enabledAttrs: allOn } : p
                    )
                  });
                }}
                style={{ border: "none", background: "transparent", color: "#5EEAD4", fontSize: "10px", fontWeight: 700, cursor: "pointer", padding: 0 }}
              >
                All ON
              </button>
              <span style={{ color: "#475569" }}>·</span>
              <button
                type="button"
                onClick={() => {
                  const allOff = makeAttrMap([]);
                  commitStore({
                    ...store,
                    profiles: store.profiles.map((p) =>
                      p.id === activeProfile.id ? { ...p, enabledAttrs: allOff } : p
                    )
                  });
                }}
                style={{ border: "none", background: "transparent", color: "#94A3B8", fontSize: "10px", fontWeight: 600, cursor: "pointer", padding: 0 }}
              >
                All OFF
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 8px" }}>
            {CORE_STYLE_ATTRIBUTES.map((attr) => {
              const checked = Boolean(activeProfile.enabledAttrs[attr.id]);
              return (
                <label
                  key={attr.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "5px 7px",
                    borderRadius: "6px",
                    border: checked ? "1px solid rgba(20, 184, 166, 0.35)" : "1px solid #1E293B",
                    background: checked ? "rgba(20, 184, 166, 0.10)" : "#0F172A",
                    color: checked ? "#F8FAFC" : "#64748B",
                    opacity: checked ? 1 : 0.7,
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: checked ? 600 : 500
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    aria-label={`Profile attribute ${attr.label}`}
                    data-ecmd-profile-attr-toggle={attr.id}
                    onChange={(e) => handleToggleAttr(attr.id, e.target.checked)}
                    style={{ width: "13px", height: "13px", margin: 0, accentColor: "#14B8A6", cursor: "pointer" }}
                  />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {attr.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Default Profile for + New Group Selector */}
        <div
          style={{
            borderTop: "1px solid #1E293B",
            paddingTop: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}
        >
          <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#94A3B8" }}>
            Default Profile for + New Group
          </span>
          <select
            aria-label="Default Profile for + New Group"
            data-ecmd-default-profile-select="true"
            value={store.defaultProfileId}
            onChange={(e) => handleSetDefaultProfile(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: "7px",
              border: "1px solid #334155",
              background: "#1E293B",
              color: "#5EEAD4",
              fontSize: "11.5px",
              fontWeight: 600,
              outline: "none",
              cursor: "pointer"
            }}
          >
            {store.profiles.map((p) => (
              <option key={p.id} value={p.id} style={{ background: "#0F172A", color: "#F8FAFC" }}>
                {p.name}
              </option>
            ))}
          </select>
          <span style={{ fontSize: "10px", color: "#64748B", lineHeight: 1.35 }}>
            New groups inherit this profile&apos;s ON/OFF attribute toggles immediately (non-destructive).
          </span>
          {showRestoreBuiltIns && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
              <button
                type="button"
                data-ecmd-restore-builtin-profiles="true"
                onClick={handleRestoreBuiltIns}
                title="Restore built-in starter profiles without deleting custom profiles"
                style={{
                  border: "1px solid rgba(56, 189, 248, 0.35)",
                  background: "rgba(14, 165, 233, 0.12)",
                  color: "#7DD3FC",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "10.5px",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                ↺ Restore Built-In Defaults
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const portalBody = anchorDoc?.body || (typeof document !== "undefined" ? document.body : null);
  return portalBody ? createPortal(modalNode, portalBody) : modalNode;
}
