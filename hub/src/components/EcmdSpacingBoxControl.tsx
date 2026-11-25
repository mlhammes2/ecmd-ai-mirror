import { getDynamicGroupOptionsForPlasmic } from "./EcmdDynamicGroupManager";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Side = "top" | "right" | "bottom" | "left";
type LockMode = "all" | "axis" | "four";
type Corner = "tl" | "tr" | "br" | "bl";

function emitPlasmicChange(props: any, val: any) {
  if (typeof props?.updateValue === "function") props.updateValue(val);
  if (typeof props?.onChange === "function" && props.onChange !== props.updateValue) props.onChange(val);
}

function cleanToken(v?: string): string {
  const t = (v || "").trim();
  return t || "0";
}

function parseCssShorthand(val?: string): Record<Side, string> {
  const raw = (val || "").trim();
  if (!raw) return { top: "0", right: "0", bottom: "0", left: "0" };
  const p = raw.split(/\s+/);
  const p0 = p[0] ?? "0";
  const p1 = p[1] ?? p0;
  const p2 = p[2] ?? p0;
  const p3 = p[3] ?? p1;
  if (p.length === 1) return { top: p0, right: p0, bottom: p0, left: p0 };
  if (p.length === 2) return { top: p0, right: p1, bottom: p0, left: p1 };
  if (p.length === 3) return { top: p0, right: p1, bottom: p2, left: p1 };
  return { top: p0, right: p1, bottom: p2, left: p3 };
}

function formatShorthand(s: Record<Side, string>): string {
  const t = cleanToken(s.top);
  const r = cleanToken(s.right);
  const b = cleanToken(s.bottom);
  const l = cleanToken(s.left);
  if (t === "0" && r === "0" && b === "0" && l === "0") return "";
  if (t === r && r === b && b === l) return t;
  if (t === b && r === l) return t + " " + r;
  return t + " " + r + " " + b + " " + l;
}

export function createSpacingControl(kind: "padding" | "margin") {
  const isPad = kind === "padding";
  const accent = isPad ? "#10B981" : "#3B82F6";
  const accentSoft = isPad ? "rgba(16, 185, 129, 0.16)" : "rgba(59, 130, 246, 0.16)";
  const accentHover = isPad ? "rgba(16, 185, 129, 0.30)" : "rgba(59, 130, 246, 0.30)";
  const titleLabel = isPad ? "Padding (e.g. 12px, 5%, 2vh)" : "Margin (e.g. 8px, 5%, auto)";

  return function EcmdSpacingBoxControl(props: any) {
    const value: string = typeof props?.value === "string" ? props.value : "";
    const parsed = parseCssShorthand(value);

    const [open, setOpen] = useState(false);
    const [activeSide, setActiveSide] = useState<Side>("top");
    const [hoveredSide, setHoveredSide] = useState<Side | null>(null);
    const [mode, setMode] = useState<LockMode>(() => {
      if (!value) return "axis";
      if (parsed.top === parsed.right && parsed.right === parsed.bottom && parsed.bottom === parsed.left) return "all";
      if (parsed.top === parsed.bottom && parsed.right === parsed.left) return "axis";
      return "four";
    });
    const [draft, setDraft] = useState<Record<Side, string>>(parsed);
    const [popPos, setPopPos] = useState<{ top: number; left: number }>({ top: 120, left: 120 });

    const btnRef = useRef<HTMLButtonElement>(null);
    const popRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setDraft(parseCssShorthand(value)); }, [value]);

    useLayoutEffect(() => {
      if (!open || !btnRef.current) return;
      const docWin = btnRef.current.ownerDocument?.defaultView || window;
      const rect = btnRef.current.getBoundingClientRect();
      const popW = 252;
      const popH = 278;
      const left = Math.max(8, Math.min(rect.right - popW, docWin.innerWidth - popW - 8));
      const top = rect.bottom + popH + 12 > docWin.innerHeight ? Math.max(8, rect.top - popH - 6) : rect.bottom + 6;
      setPopPos({ top, left });
    }, [open]);

    useEffect(() => {
      if (!open) return;
      const doc = btnRef.current?.ownerDocument || document;
      const onDown = (e: MouseEvent) => {
        const t = e.target as Node;
        if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
        setOpen(false);
      };
      const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
      doc.addEventListener("mousedown", onDown, true);
      doc.addEventListener("keydown", onKey, true);
      return () => {
        doc.removeEventListener("mousedown", onDown, true);
        doc.removeEventListener("keydown", onKey, true);
      };
    }, [open]);

    const handleSideChange = (side: Side, rawInput: string) => {
      const next = { ...draft };
      if (mode === "all") {
        next.top = rawInput; next.right = rawInput; next.bottom = rawInput; next.left = rawInput;
      } else if (mode === "axis") {
        if (side === "top" || side === "bottom") { next.top = rawInput; next.bottom = rawInput; }
        else { next.left = rawInput; next.right = rawInput; }
      } else {
        next[side] = rawInput;
      }
      setDraft(next);
      emitPlasmicChange(props, formatShorthand(next));
    };

    const selectSide = (s: Side) => {
      setActiveSide(s);
      setTimeout(() => inputRef.current?.select(), 10);
    };

    const isLinkedSide = (s: Side): boolean => {
      if (mode === "all") return true;
      if (mode === "axis") {
        return (activeSide === "top" || activeSide === "bottom") ? (s === "top" || s === "bottom") : (s === "left" || s === "right");
      }
      return activeSide === s;
    };

    const polyFill = (s: Side) => (hoveredSide === s || isLinkedSide(s) ? accentHover : accentSoft);
    const summaryText = value ? value : "unset";
    const portalTarget = btnRef.current?.ownerDocument?.body || (typeof document !== "undefined" ? document.body : null);

    const popoverNode = open ? (
      <div
        ref={popRef}
        style={{
          position: "fixed",
          top: popPos.top + "px",
          left: popPos.left + "px",
          width: "252px",
          background: "#FFFFFF",
          color: "#0F172A",
          borderRadius: "10px",
          boxShadow: "0 16px 38px rgba(15, 23, 42, 0.26), 0 0 0 1px rgba(148, 163, 184, 0.35)",
          padding: "10px 12px 12px",
          zIndex: 2147483600,
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "12px",
          userSelect: "none"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontWeight: 600, fontSize: "11px", color: "#1E293B" }}>{titleLabel}</span>
          <div style={{ display: "flex", gap: "2px", background: "#F1F5F9", padding: "2px", borderRadius: "6px" }}>
            {([
              { id: "all", lbl: "All" },
              { id: "axis", lbl: "V/H" },
              { id: "four", lbl: "4" }
            ] as Array<{ id: LockMode; lbl: string }>).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                style={{
                  border: "none",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  fontSize: "10.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                  background: mode === m.id ? "#FFFFFF" : "transparent",
                  color: mode === m.id ? accent : "#64748B"
                }}
              >
                {m.lbl}
              </button>
            ))}
          </div>
        </div>

        <div style={{ position: "relative", width: "224px", height: "132px", margin: "0 auto 10px" }}>
          <svg width="224" height="132" viewBox="0 0 224 132" style={{ display: "block", borderRadius: "8px", overflow: "hidden" }}>
            <polygon points="0,0 224,0 174,34 50,34" fill={polyFill("top")} stroke={activeSide === "top" ? accent : "#CBD5E1"} strokeWidth={activeSide === "top" ? "1.6" : "1"} style={{ cursor: "pointer" }} onMouseEnter={() => setHoveredSide("top")} onMouseLeave={() => setHoveredSide(null)} onClick={() => selectSide("top")} />
            <polygon points="224,0 224,132 174,98 174,34" fill={polyFill("right")} stroke={activeSide === "right" ? accent : "#CBD5E1"} strokeWidth={activeSide === "right" ? "1.6" : "1"} style={{ cursor: "pointer" }} onMouseEnter={() => setHoveredSide("right")} onMouseLeave={() => setHoveredSide(null)} onClick={() => selectSide("right")} />
            <polygon points="50,98 174,98 224,132 0,132" fill={polyFill("bottom")} stroke={activeSide === "bottom" ? accent : "#CBD5E1"} strokeWidth={activeSide === "bottom" ? "1.6" : "1"} style={{ cursor: "pointer" }} onMouseEnter={() => setHoveredSide("bottom")} onMouseLeave={() => setHoveredSide(null)} onClick={() => selectSide("bottom")} />
            <polygon points="0,0 50,34 50,98 0,132" fill={polyFill("left")} stroke={activeSide === "left" ? accent : "#CBD5E1"} strokeWidth={activeSide === "left" ? "1.6" : "1"} style={{ cursor: "pointer" }} onMouseEnter={() => setHoveredSide("left")} onMouseLeave={() => setHoveredSide(null)} onClick={() => selectSide("left")} />
            <rect x="50" y="34" width="124" height="64" rx="4" fill="#F8FAFC" stroke="#94A3B8" strokeDasharray={isPad ? "none" : "3 2"} />
            <text x="112" y="70" textAnchor="middle" fill="#64748B" fontSize="10.5" fontWeight="600">{isPad ? "Content" : "Element"}</text>
            <text x="112" y="21" textAnchor="middle" fill="#0F172A" fontSize="10.5" fontWeight="700" style={{ pointerEvents: "none" }}>{draft.top}</text>
            <text x="199" y="70" textAnchor="middle" fill="#0F172A" fontSize="10.5" fontWeight="700" style={{ pointerEvents: "none" }}>{draft.right}</text>
            <text x="112" y="119" textAnchor="middle" fill="#0F172A" fontSize="10.5" fontWeight="700" style={{ pointerEvents: "none" }}>{draft.bottom}</text>
            <text x="25" y="70" textAnchor="middle" fill="#0F172A" fontSize="10.5" fontWeight="700" style={{ pointerEvents: "none" }}>{draft.left}</text>
          </svg>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: accent, textTransform: "uppercase", minWidth: "46px" }}>
            {mode === "all" ? "All:" : mode === "axis" ? ((activeSide === "top" || activeSide === "bottom") ? "T/B:" : "L/R:") : activeSide + ":"}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={draft[activeSide]}
            placeholder="e.g. 8px, 5%, 2vh"
            onChange={(e) => handleSideChange(activeSide, e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") { e.preventDefault(); setOpen(false); }
            }}
            style={{ flex: 1, padding: "4px 8px", fontSize: "12px", borderRadius: "6px", border: "1px solid " + accent, outline: "none", background: "#F8FAFC", color: "#0F172A", fontWeight: 600 }}
          />
          <button type="button" onClick={() => { setDraft({ top: "0", right: "0", bottom: "0", left: "0" }); emitPlasmicChange(props, ""); }} style={{ border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", borderRadius: "6px", padding: "4px 7px", fontSize: "11px", cursor: "pointer" }}>Reset</button>
        </div>
      </div>
    ) : null;

    return (
      <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
        <button
          ref={btnRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "6px",
            padding: "4px 8px",
            borderRadius: "6px",
            border: open ? ("1px solid " + accent) : "1px solid #E2E8F0",
            background: value ? accentSoft : "#F8FAFC",
            color: value ? "#0F172A" : "#64748B",
            fontSize: "12px",
            fontWeight: value ? 600 : 400,
            cursor: "pointer"
          }}
        >
          <span>{summaryText}</span>
          <span style={{ fontSize: "10px", opacity: 0.65 }}>▾</span>
        </button>
        {open && (portalTarget ? createPortal(popoverNode, portalTarget) : popoverNode)}
      </div>
    );
  };
}

export const EcmdPaddingBoxControl = createSpacingControl("padding");
export const EcmdMarginBoxControl = createSpacingControl("margin");

// --- Interactive Row & Column Gap Popover Control (Calls updateValue + onChange, supports px, %, vh, rem) ---
function parseGapShorthand(val?: string): { row: string; col: string } {
  const raw = (val || "").trim();
  if (!raw) return { row: "", col: "" };
  const parts = raw.split(/\s+/);
  const r = parts[0] ?? "";
  const c = parts[1] ?? r;
  return { row: r, col: c };
}

function formatGapShorthand(row: string, col: string): string {
  const r = row.trim();
  const c = col.trim();
  if (!r && !c) return "";
  const rOut = r || "0px";
  const cOut = c || "0px";
  if (rOut === cOut) return rOut;
  return rOut + " " + cOut;
}

export function EcmdGapControl(props: any) {
  const value: string = typeof props?.value === "string" ? props.value : "";
  const parsed = parseGapShorthand(value);
  const [open, setOpen] = useState(false);
  const [linked, setLinked] = useState<boolean>(() => !value || parsed.row === parsed.col);
  const [rowVal, setRowVal] = useState<string>(parsed.row);
  const [colVal, setColVal] = useState<string>(parsed.col);
  const [popPos, setPopPos] = useState<{ top: number; left: number }>({ top: 120, left: 120 });

  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const accent = "#8B5CF6";
  const accentSoft = "rgba(139, 92, 246, 0.14)";

  useEffect(() => {
    const p = parseGapShorthand(value);
    setRowVal(p.row);
    setColVal(p.col);
  }, [value]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const docWin = btnRef.current.ownerDocument?.defaultView || window;
    const rect = btnRef.current.getBoundingClientRect();
    const popW = 244;
    const popH = 186;
    const left = Math.max(8, Math.min(rect.right - popW, docWin.innerWidth - popW - 8));
    const top = rect.bottom + popH + 12 > docWin.innerHeight ? Math.max(8, rect.top - popH - 6) : rect.bottom + 6;
    setPopPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const doc = btnRef.current?.ownerDocument || document;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    doc.addEventListener("mousedown", onDown, true);
    doc.addEventListener("keydown", onKey, true);
    return () => {
      doc.removeEventListener("mousedown", onDown, true);
      doc.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const updateBoth = (nextRow: string, nextCol: string) => {
    setRowVal(nextRow);
    setColVal(nextCol);
    emitPlasmicChange(props, formatGapShorthand(nextRow, nextCol));
  };

  const portalTarget = btnRef.current?.ownerDocument?.body || (typeof document !== "undefined" ? document.body : null);
  const summary = value ? (parsed.row === parsed.col ? parsed.row : "R:" + parsed.row + " C:" + parsed.col) : "unset";

  const popNode = open ? (
    <div
      ref={popRef}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: popPos.top + "px",
        left: popPos.left + "px",
        width: "244px",
        background: "#FFFFFF",
        color: "#0F172A",
        borderRadius: "10px",
        boxShadow: "0 16px 38px rgba(15, 23, 42, 0.26), 0 0 0 1px rgba(148, 163, 184, 0.35)",
        padding: "10px 12px 12px",
        zIndex: 2147483600,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "12px",
        userSelect: "none"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <span style={{ fontWeight: 600, fontSize: "11.5px", color: "#1E293B" }}>Flex / Grid Gap</span>
        <div style={{ display: "flex", gap: "3px", background: "#F1F5F9", padding: "2px", borderRadius: "6px" }}>
          <button type="button" onClick={() => { setLinked(true); updateBoth(rowVal || colVal, rowVal || colVal); }} style={{ border: "none", borderRadius: "4px", padding: "2px 7px", fontSize: "10.5px", fontWeight: 600, cursor: "pointer", background: linked ? "#FFF" : "transparent", color: linked ? accent : "#64748B" }}>Both</button>
          <button type="button" onClick={() => setLinked(false)} style={{ border: "none", borderRadius: "4px", padding: "2px 7px", fontSize: "10.5px", fontWeight: 600, cursor: "pointer", background: !linked ? "#FFF" : "transparent", color: !linked ? accent : "#64748B" }}>Row / Col</button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: accent, width: "68px" }}>{linked ? "↕↔ Gap:" : "↕ Row Gap:"}</span>
          <input
            type="text"
            value={rowVal}
            placeholder="e.g. 8px, 2vh, 4%"
            onChange={(e) => {
              const v = e.target.value;
              if (linked) updateBoth(v, v);
              else updateBoth(v, colVal);
            }}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") setOpen(false); }}
            style={{ flex: 1, minWidth: 0, padding: "4px 8px", fontSize: "12px", borderRadius: "6px", border: "1px solid " + accent, outline: "none", background: "#F8FAFC", color: "#0F172A", fontWeight: 600 }}
          />
        </div>
        {!linked && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: accent, width: "68px" }}>↔ Col Gap:</span>
            <input
              type="text"
              value={colVal}
              placeholder="e.g. 12px, 4%"
              onChange={(e) => updateBoth(rowVal, e.target.value)}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") setOpen(false); }}
              style={{ flex: 1, minWidth: 0, padding: "4px 8px", fontSize: "12px", borderRadius: "6px", border: "1px solid " + accent, outline: "none", background: "#F8FAFC", color: "#0F172A", fontWeight: 600 }}
            />
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "10.5px", color: "#64748B" }}>Include unit (px, %, vh, rem)</span>
        <button type="button" onClick={() => { setRowVal(""); setColVal(""); emitPlasmicChange(props, ""); }} style={{ border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", borderRadius: "6px", padding: "3px 8px", fontSize: "11px", cursor: "pointer" }}>Reset</button>
      </div>
    </div>
  ) : null;

  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
          padding: "4px 8px",
          borderRadius: "6px",
          border: open ? ("1px solid " + accent) : "1px solid #E2E8F0",
          background: value ? accentSoft : "#F8FAFC",
          color: value ? "#0F172A" : "#64748B",
          fontSize: "12px",
          fontWeight: value ? 600 : 400,
          cursor: "pointer"
        }}
      >
        <span>↕↔ {summary}</span>
        <span style={{ fontSize: "10px", opacity: 0.65 }}>▾</span>
      </button>
      {open && (portalTarget ? createPortal(popNode, portalTarget) : popNode)}
    </div>
  );
}

// --- Unit-Free 4-Corner Radius Control (Supports px, %, rem, etc.) ---
function parseRadiusShorthand(val?: string): Record<Corner, string> {
  const raw = (val || "").trim();
  if (!raw) return { tl: "0", tr: "0", br: "0", bl: "0" };
  const p = raw.split(/\s+/);
  const p0 = p[0] ?? "0";
  const p1 = p[1] ?? p0;
  const p2 = p[2] ?? p0;
  const p3 = p[3] ?? p1;
  if (p.length === 1) return { tl: p0, tr: p0, br: p0, bl: p0 };
  if (p.length === 2) return { tl: p0, tr: p1, br: p0, bl: p1 };
  if (p.length === 3) return { tl: p0, tr: p1, br: p2, bl: p1 };
  return { tl: p0, tr: p1, br: p2, bl: p3 };
}

function formatRadiusShorthand(c: Record<Corner, string>): string {
  const tl = cleanToken(c.tl);
  const tr = cleanToken(c.tr);
  const br = cleanToken(c.br);
  const bl = cleanToken(c.bl);
  if (tl === "0" && tr === "0" && br === "0" && bl === "0") return "";
  if (tl === tr && tr === br && tr === bl) return tl;
  return tl + " " + tr + " " + br + " " + bl;
}

export function EcmdRadiusBoxControl(props: any) {
  const value: string = typeof props?.value === "string" ? props.value : "";
  const parsed = parseRadiusShorthand(value);

  const [open, setOpen] = useState(false);
  const [activeCorner, setActiveCorner] = useState<Corner>("tl");
  const [allMode, setAllMode] = useState<boolean>(() => !value || (parsed.tl === parsed.tr && parsed.tr === parsed.br && parsed.br === parsed.bl));
  const [draft, setDraft] = useState<Record<Corner, string>>(parsed);
  const [popPos, setPopPos] = useState<{ top: number; left: number }>({ top: 120, left: 120 });

  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const accent = "#F59E0B";
  const accentSoft = "rgba(245, 158, 11, 0.15)";

  useEffect(() => { setDraft(parseRadiusShorthand(value)); }, [value]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const docWin = btnRef.current.ownerDocument?.defaultView || window;
    const rect = btnRef.current.getBoundingClientRect();
    const popW = 240;
    const popH = 228;
    const left = Math.max(8, Math.min(rect.right - popW, docWin.innerWidth - popW - 8));
    const top = rect.bottom + popH + 12 > docWin.innerHeight ? Math.max(8, rect.top - popH - 6) : rect.bottom + 6;
    setPopPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const doc = btnRef.current?.ownerDocument || document;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    doc.addEventListener("mousedown", onDown, true);
    doc.addEventListener("keydown", onKey, true);
    return () => {
      doc.removeEventListener("mousedown", onDown, true);
      doc.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const handleCornerChange = (corner: Corner, raw: string) => {
    const next = { ...draft };
    if (allMode) { next.tl = raw; next.tr = raw; next.br = raw; next.bl = raw; }
    else { next[corner] = raw; }
    setDraft(next);
    if (!raw.trim()) { emitPlasmicChange(props, ""); return; }
    emitPlasmicChange(props, formatRadiusShorthand(next));
  };

  const portalTarget = btnRef.current?.ownerDocument?.body || (typeof document !== "undefined" ? document.body : null);
  const previewRadius = Math.min(28, Math.max(2, parseFloat(draft.tl) || 8));

  const popoverNode = open ? (
    <div
      ref={popRef}
      style={{
        position: "fixed",
        top: popPos.top + "px",
        left: popPos.left + "px",
        width: "240px",
        background: "#FFFFFF",
        color: "#0F172A",
        borderRadius: "10px",
        boxShadow: "0 16px 38px rgba(15, 23, 42, 0.26), 0 0 0 1px rgba(148, 163, 184, 0.35)",
        padding: "10px 12px 12px",
        zIndex: 2147483600,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "12px",
        userSelect: "none"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ fontWeight: 600, fontSize: "11.5px", color: "#1E293B" }}>Corner Radius</span>
        <div style={{ display: "flex", gap: "3px", background: "#F1F5F9", padding: "2px", borderRadius: "6px" }}>
          <button type="button" onClick={() => setAllMode(true)} style={{ border: "none", borderRadius: "4px", padding: "2px 7px", fontSize: "10.5px", fontWeight: 600, cursor: "pointer", background: allMode ? "#FFF" : "transparent", color: allMode ? accent : "#64748B" }}>All</button>
          <button type="button" onClick={() => setAllMode(false)} style={{ border: "none", borderRadius: "4px", padding: "2px 7px", fontSize: "10.5px", fontWeight: 600, cursor: "pointer", background: !allMode ? "#FFF" : "transparent", color: !allMode ? accent : "#64748B" }}>4-Corner</button>
        </div>
      </div>
      <div style={{ position: "relative", width: "216px", height: "104px", margin: "0 auto 10px", background: "#F8FAFC", borderRadius: previewRadius + "px", border: "2px solid " + accent, boxSizing: "border-box" }}>
        {([
          { id: "tl", lbl: "╭ " + draft.tl, pos: { top: "6px", left: "8px" } },
          { id: "tr", lbl: draft.tr + " ╮", pos: { top: "6px", right: "8px" } },
          { id: "bl", lbl: "╰ " + draft.bl, pos: { bottom: "6px", left: "8px" } },
          { id: "br", lbl: draft.br + " ╯", pos: { bottom: "6px", right: "8px" } }
        ] as Array<{ id: Corner; lbl: string; pos: React.CSSProperties }>).map((c) => {
          const sel = allMode || activeCorner === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => { setActiveCorner(c.id); setTimeout(() => inputRef.current?.select(), 10); }}
              style={{ position: "absolute", ...c.pos, border: sel ? ("1px solid " + accent) : "1px solid #CBD5E1", background: sel ? accentSoft : "#FFFFFF", color: "#0F172A", borderRadius: "5px", padding: "2px 6px", fontSize: "10.5px", fontWeight: 700, cursor: "pointer" }}
            >
              {c.lbl}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: accent, textTransform: "uppercase", minWidth: "44px" }}>{allMode ? "All:" : activeCorner.toUpperCase() + ":"}</span>
        <input
          ref={inputRef}
          type="text"
          value={draft[activeCorner]}
          placeholder="e.g. 8px, 50%"
          onChange={(e) => handleCornerChange(activeCorner, e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") { e.preventDefault(); setOpen(false); }
          }}
          style={{ flex: 1, padding: "4px 8px", fontSize: "12px", borderRadius: "6px", border: "1px solid " + accent, outline: "none", background: "#F8FAFC", color: "#0F172A", fontWeight: 600 }}
        />
        <button type="button" onClick={() => { setDraft({ tl: "0", tr: "0", br: "0", bl: "0" }); emitPlasmicChange(props, ""); }} style={{ border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", borderRadius: "6px", padding: "4px 7px", fontSize: "11px", cursor: "pointer" }}>Reset</button>
      </div>
    </div>
  ) : null;

  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px",
          padding: "4px 8px",
          borderRadius: "6px",
          border: open ? ("1px solid " + accent) : "1px solid #E2E8F0",
          background: value ? accentSoft : "#F8FAFC",
          color: value ? "#0F172A" : "#64748B",
          fontSize: "12px",
          fontWeight: value ? 600 : 400,
          cursor: "pointer"
        }}
      >
        <span>╭ {value || "unset"}</span>
        <span style={{ fontSize: "10px", opacity: 0.65 }}>▾</span>
      </button>
      {open && (portalTarget ? createPortal(popoverNode, portalTarget) : popoverNode)}
    </div>
  );
}

// --- Pinned Behavior Toggles Popup Modal (ONLY closable via the Close button!) ---
export interface ToggleFlagsState {
  open?: boolean;
  enableLiveDropdown?: boolean;
  fixedBreakout?: boolean;
  maskClosable?: boolean;
  closeOnSelect?: boolean;
  matchSystemTheme?: boolean;
  persistUserChoice?: boolean;
  smoothTransition?: boolean;
  showActiveThemeInLabel?: boolean;
  syncTriggerDotWithTheme?: boolean;
  showSwatchPreview?: boolean;
  hideTrigger?: boolean;
}

const TOGGLE_ITEMS: Array<{ key: keyof ToggleFlagsState; label: string; def: boolean }> = [
  { key: "open", label: "Preview Dropdown Open on Canvas", def: true },
  { key: "enableLiveDropdown", label: "Open Live Dropdown on Click", def: true },
  { key: "fixedBreakout", label: "Fixed Position Breakout", def: true },
  { key: "maskClosable", label: "Click Outside to Close (Live)", def: true },
  { key: "closeOnSelect", label: "Close After Selecting Theme", def: true },
  { key: "matchSystemTheme", label: "Auto-Match User OS Light/Dark Mode", def: true },
  { key: "persistUserChoice", label: "Remember User Manual Override", def: true },
  { key: "smoothTransition", label: "Smooth Color Fade Transition", def: true },
  { key: "showActiveThemeInLabel", label: "Show Theme Name on Button", def: false },
  { key: "syncTriggerDotWithTheme", label: "Sync Button Dot With Theme", def: false },
  { key: "showSwatchPreview", label: "Show Swatch Cheat-Sheet", def: false },
  { key: "hideTrigger", label: "Hide Trigger Button", def: false }
];

export function EcmdTogglesModalControl(props: any) {
  const compProps = props?.componentProps || {};
  let rawVal: ToggleFlagsState = {};
  if (typeof props?.value === "string" && props.value.trim().startsWith("{")) {
    try { rawVal = JSON.parse(props.value); } catch {}
  } else if (props?.value && typeof props.value === "object") {
    rawVal = props.value;
  }
  const [modalOpen, setModalOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 96, left: 120 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const getFlag = (item: { key: keyof ToggleFlagsState; def: boolean }): boolean => {
    if (typeof rawVal[item.key] === "boolean") return Boolean(rawVal[item.key]);
    if (typeof compProps[item.key] === "boolean") return Boolean(compProps[item.key]);
    return item.def;
  };

  const toggleFlag = (item: { key: keyof ToggleFlagsState; def: boolean }) => {
    const nextObj: ToggleFlagsState = {};
    TOGGLE_ITEMS.forEach((it) => { nextObj[it.key] = getFlag(it); });
    nextObj[item.key] = !getFlag(item);
    emitPlasmicChange(props, JSON.stringify(nextObj));
  };

  useLayoutEffect(() => {
    if (!modalOpen || !btnRef.current) return;
    const docWin = btnRef.current.ownerDocument?.defaultView || window;
    const rect = btnRef.current.getBoundingClientRect();
    const popW = 296;
    const popH = 388;
    const left = Math.max(12, Math.min(rect.right - popW, docWin.innerWidth - popW - 12));
    const top = Math.max(12, Math.min(rect.top - 24, docWin.innerHeight - popH - 12));
    setPos({ top, left });
  }, [modalOpen]);

  const portalTarget = btnRef.current?.ownerDocument?.body || (typeof document !== "undefined" ? document.body : null);
  const enabledCount = TOGGLE_ITEMS.filter((i) => getFlag(i)).length;

  // Strictly NO outside-click or Escape listener — ONLY closes via the Close button!
  const modalNode = modalOpen ? (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: pos.top + "px",
        left: pos.left + "px",
        width: "296px",
        background: "#FFFFFF",
        color: "#0F172A",
        borderRadius: "12px",
        boxShadow: "0 20px 48px rgba(15, 23, 42, 0.32), 0 0 0 1px rgba(148, 163, 184, 0.4)",
        padding: "12px 14px",
        zIndex: 2147483640,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "12px",
        userSelect: "none"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "8px", marginBottom: "8px", borderBottom: "1px solid #E2E8F0" }}>
        <span style={{ fontWeight: 700, fontSize: "12.5px", color: "#0F172A" }}>⚙️ Site Themes Toggles</span>
        <button
          type="button"
          onClick={() => setModalOpen(false)}
          style={{
            border: "1px solid #CBD5E1",
            background: "#F1F5F9",
            color: "#0F172A",
            borderRadius: "6px",
            padding: "3px 9px",
            fontSize: "11px",
            fontWeight: 700,
            cursor: "pointer"
          }}
        >
          ✕ Close
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "320px", overflowY: "auto" }}>
        {TOGGLE_ITEMS.map((item) => {
          const on = getFlag(item);
          return (
            <div
              key={item.key}
              onClick={() => toggleFlag(item)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 8px",
                borderRadius: "7px",
                background: on ? "rgba(13, 148, 136, 0.08)" : "#F8FAFC",
                border: on ? "1px solid rgba(13, 148, 136, 0.28)" : "1px solid #F1F5F9",
                cursor: "pointer"
              }}
            >
              <span style={{ fontSize: "11.5px", fontWeight: 500, color: "#1E293B" }}>{item.label}</span>
              <span
                style={{
                  width: "32px",
                  height: "18px",
                  borderRadius: "999px",
                  background: on ? "#0D9488" : "#CBD5E1",
                  position: "relative",
                  transition: "background 0.15s ease",
                  flexShrink: 0
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "2px",
                    left: on ? "16px" : "2px",
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    background: "#FFFFFF",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                    transition: "left 0.15s ease"
                  }}
                />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div style={{ display: "flex", width: "100%" }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setModalOpen(true)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "5px 10px",
          borderRadius: "6px",
          border: modalOpen ? "1px solid #0D9488" : "1px solid #CBD5E1",
          background: modalOpen ? "rgba(13, 148, 136, 0.12)" : "#F8FAFC",
          color: "#0F172A",
          fontSize: "12px",
          fontWeight: 600,
          cursor: "pointer"
        }}
      >
        <span>⚙️ Open Toggles ({enabledCount} on)</span>
        <span style={{ fontSize: "10px", opacity: 0.7 }}>▸</span>
      </button>
      {modalOpen && (portalTarget ? createPortal(modalNode, portalTarget) : modalNode)}
    </div>
  );
}