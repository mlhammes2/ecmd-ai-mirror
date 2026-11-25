import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ECMD_GRADIENT_PRESETS,
  GRADIENT_DIRECTION_CHIPS,
  RADIAL_ORIGIN_CHIPS,
  createDefaultGradientConfig,
  detectColorPickerMode,
  findDesignTokenById,
  flipGradientStops,
  formatGradientSummaryLabel,
  isCssGradientValue,
  parseCssGradient,
  serializeCssGradient,
  shadowAngleDistanceToOffsets,
  shadowOffsetsToAngleDistance,
  type ColorPickerMode,
  type GradientKind,
  type ParsedGradientConfig,
  type RadialGradientShape,
} from "../lib/ecmdThemeEngine";
import {
  EcmdLinkedTokenPill,
  EcmdTokenPopoverSection,
  type EcmdTokenBindingContext,
} from "./EcmdTokenBindingBar";

export interface PresetColorToken {
  name: string;
  value: string;
}

export const GM3_COLOR_PRESETS: PresetColorToken[] = [
  { name: "GM3 Primary (Light)", value: "#0B57D0" },
  { name: "GM3 Primary Hover", value: "#0842A0" },
  { name: "GM3 Primary (Dark)", value: "#A8C7FA" },
  { name: "GM3 Tonal (Light)", value: "#D3E3FD" },
  { name: "GM3 On-Tonal (Light)", value: "#041E49" },
  { name: "GM3 Tonal (Dark)", value: "#004A77" },
  { name: "GM3 On-Tonal (Dark)", value: "#C2E7FF" },
  { name: "GM3 Surface White", value: "#FFFFFF" },
  { name: "GM3 Surface Bar", value: "#F8FAFD" },
  { name: "GM3 Surface Card", value: "#F3F6FC" },
  { name: "GM3 Text (Light)", value: "#1F1F1F" },
  { name: "GM3 Subtle (Light)", value: "#444746" },
  { name: "GM3 Border (Light)", value: "#E1E3E1" },
  { name: "GM3 Dark Surface", value: "#28292A" },
  { name: "GM3 Dark Dialog", value: "#303134" },
  { name: "GM3 Text (Dark)", value: "#E3E3E3" },
  { name: "GM3 Subtle (Dark)", value: "#C4C7C5" },
  { name: "Brand Teal", value: "#0D9488" },
  { name: "Hover Tint (Light)", value: "rgba(31, 31, 31, 0.08)" },
  { name: "Hover Tint (Dark)", value: "rgba(227, 227, 227, 0.08)" }
];

const CUSTOM_SWATCHES_KEY = "ecmd_custom_color_presets_v1";
const CUSTOM_GRADIENTS_KEY = "ecmd_custom_gradient_presets_v1";

function loadCustomSwatches(): PresetColorToken[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_SWATCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomSwatches(list: PresetColorToken[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_SWATCHES_KEY, JSON.stringify(list));
  } catch {}
}

function loadCustomGradients(): PresetColorToken[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_GRADIENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomGradients(list: PresetColorToken[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_GRADIENTS_KEY, JSON.stringify(list));
  } catch {}
}

interface HsvaColor {
  h: number;
  s: number;
  v: number;
  a: number;
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h >= 0 && h < 60) { r1 = c; g1 = x; b1 = 0; }
  else if (h >= 60 && h < 120) { r1 = x; g1 = c; b1 = 0; }
  else if (h >= 120 && h < 180) { r1 = 0; g1 = c; b1 = x; }
  else if (h >= 180 && h < 240) { r1 = 0; g1 = x; b1 = c; }
  else if (h >= 240 && h < 300) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255)
  };
}

function toHex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0").toUpperCase();
}

function parseCssColorToHsva(raw: string): HsvaColor {
  const s = (raw || "").trim();
  if (!s || s.toLowerCase() === "transparent") return { h: 215, s: 0, v: 1, a: 0 };
  const hex3 = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(s);
  if (hex3 && hex3[1] && hex3[2] && hex3[3]) {
    const r = parseInt(hex3[1] + hex3[1], 16);
    const g = parseInt(hex3[2] + hex3[2], 16);
    const b = parseInt(hex3[3] + hex3[3], 16);
    return { ...rgbToHsv(r, g, b), a: 1 };
  }
  const hex6 = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})?$/.exec(s);
  if (hex6 && hex6[1] && hex6[2] && hex6[3]) {
    const r = parseInt(hex6[1], 16);
    const g = parseInt(hex6[2], 16);
    const b = parseInt(hex6[3], 16);
    const a = hex6[4] ? Math.round((parseInt(hex6[4], 16) / 255) * 100) / 100 : 1;
    return { ...rgbToHsv(r, g, b), a };
  }
  const rgbaM = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)$/i.exec(s);
  if (rgbaM && rgbaM[1] && rgbaM[2] && rgbaM[3]) {
    const r = parseInt(rgbaM[1], 10);
    const g = parseInt(rgbaM[2], 10);
    const b = parseInt(rgbaM[3], 10);
    const a = rgbaM[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(rgbaM[4]))) : 1;
    return { ...rgbToHsv(r, g, b), a };
  }
  return { h: 215, s: 0.9, v: 0.82, a: 1 };
}

function formatHsvaOutput(hsva: HsvaColor): string {
  if (hsva.a <= 0) return "transparent";
  const { r, g, b } = hsvToRgb(hsva.h, hsva.s, hsva.v);
  if (hsva.a >= 0.995) {
    return "#" + toHex2(r) + toHex2(g) + toHex2(b);
  }
  const cleanA = Math.round(hsva.a * 100) / 100;
  return "rgba(" + r + ", " + g + ", " + b + ", " + cleanA + ")";
}

const MODE_TABS: Array<{ id: ColorPickerMode; label: string }> = [
  { id: "solid", label: "Solid" },
  { id: "linear", label: "Linear" },
  { id: "radial", label: "Radial" },
  { id: "conic", label: "Conic" },
];

export function EcmdPlasmicColorRow({
  label,
  value,
  isMixed,
  onChange,
  enabled = true,
  onToggleEnabled,
  propKey,
  tokenBinding
}: {
  label: string;
  value: string;
  isMixed?: boolean | undefined;
  onChange: (val: string) => void;
  enabled?: boolean | undefined;
  onToggleEnabled?: ((nextEnabled: boolean) => void) | undefined;
  propKey?: string | undefined;
  tokenBinding?: EcmdTokenBindingContext | undefined;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editTokenMode, setEditTokenMode] = useState(false);
  const [editTokenScope, setEditTokenScope] = useState<"all" | "theme">("all");
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number }>({ top: 120, left: 120 });
  const [pickerMode, setPickerMode] = useState<ColorPickerMode>(() => detectColorPickerMode(value));
  const [gradConfig, setGradConfig] = useState<ParsedGradientConfig>(
    () => parseCssGradient(value) || createDefaultGradientConfig("linear", value)
  );
  const [selectedStopIdx, setSelectedStopIdx] = useState<number>(0);
  const [hsva, setHsva] = useState<HsvaColor>(() => {
    const parsedGrad = parseCssGradient(value);
    if (parsedGrad && parsedGrad.stops[0]) {
      return parseCssColorToHsva(parsedGrad.stops[0].color);
    }
    return parseCssColorToHsva(value);
  });
  const [customSwatches, setCustomSwatches] = useState<PresetColorToken[]>(() => loadCustomSwatches());
  const [customGradients, setCustomGradients] = useState<PresetColorToken[]>(() => loadCustomGradients());
  const [colorMode, setColorMode] = useState<"HEX" | "RGBA">("HEX");

  const rowRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const svBoxRef = useRef<HTMLDivElement>(null);
  const hueBarRef = useRef<HTMLDivElement>(null);
  const alphaBarRef = useRef<HTMLDivElement>(null);
  const gradTrackRef = useRef<HTMLDivElement>(null);
  const angleDialRef = useRef<HTMLDivElement>(null);

  const pickerModeRef = useRef(pickerMode);
  pickerModeRef.current = pickerMode;
  const gradConfigRef = useRef(gradConfig);
  gradConfigRef.current = gradConfig;
  const selectedStopIdxRef = useRef(selectedStopIdx);
  selectedStopIdxRef.current = selectedStopIdx;

  const normVal = (value || "").trim();
  const isGradientVal = isCssGradientValue(normVal);
  const gradientSummaryLabel = !isMixed && isGradientVal ? formatGradientSummaryLabel(normVal) : "";

  // Sync external `value` changes cleanly into Solid vs Gradient mode + HSVA
  useEffect(() => {
    const detected = detectColorPickerMode(value);
    if (detected !== "solid") {
      const parsed = parseCssGradient(value);
      if (parsed) {
        setPickerMode(detected);
        setGradConfig(parsed);
        const safeIdx = Math.min(selectedStopIdxRef.current, Math.max(0, parsed.stops.length - 1));
        setSelectedStopIdx(safeIdx);
        const stopColor = parsed.stops[safeIdx]?.color || parsed.stops[0]?.color || "#059669";
        const pHsv = parseCssColorToHsva(stopColor);
        setHsva((prev) => ({
          h: pHsv.s === 0 ? prev.h : pHsv.h,
          s: pHsv.s,
          v: pHsv.v,
          a: pHsv.a
        }));
        return;
      }
    }
    if (detected === "solid" && pickerModeRef.current !== "solid" && normVal !== "") {
      setPickerMode("solid");
    }
    const parsed = parseCssColorToHsva(value);
    setHsva((prev) => ({
      h: parsed.s === 0 ? prev.h : parsed.h,
      s: parsed.s,
      v: parsed.v,
      a: parsed.a
    }));
  }, [value, normVal]);

  const linkedToken = tokenBinding
    ? findDesignTokenById(tokenBinding.tokens, tokenBinding.linkedTokenId)
    : undefined;
  const editTokenModeRef = useRef(editTokenMode);
  editTokenModeRef.current = editTokenMode;
  const editTokenScopeRef = useRef(editTokenScope);
  editTokenScopeRef.current = editTokenScope;

  const emitPaintValue = (nextVal: string) => {
    if (linkedToken && editTokenModeRef.current && tokenBinding?.onEditLinkedToken) {
      tokenBinding.onEditLinkedToken(linkedToken.id, nextVal, editTokenScopeRef.current);
      return;
    }
    onChange(nextVal);
  };

  const commitGradient = (nextCfg: ParsedGradientConfig, nextSelectedIdx?: number) => {
    gradConfigRef.current = nextCfg;
    setGradConfig(nextCfg);
    if (typeof nextSelectedIdx === "number") {
      const clamped = Math.max(0, Math.min(nextCfg.stops.length - 1, nextSelectedIdx));
      selectedStopIdxRef.current = clamped;
      setSelectedStopIdx(clamped);
    }
    emitPaintValue(serializeCssGradient(nextCfg));
  };

  const commitActiveColorString = (colorStr: string) => {
    if (pickerModeRef.current === "solid") {
      emitPaintValue(colorStr);
      return;
    }
    const cur = gradConfigRef.current;
    const idx = Math.max(0, Math.min(cur.stops.length - 1, selectedStopIdxRef.current));
    const nextStops = cur.stops.map((s, i) => (i === idx ? { ...s, color: colorStr } : s));
    commitGradient({ ...cur, stops: nextStops }, idx);
  };

  const handleSelectStop = (idx: number) => {
    const clamped = Math.max(0, Math.min(gradConfigRef.current.stops.length - 1, idx));
    selectedStopIdxRef.current = clamped;
    setSelectedStopIdx(clamped);
    const stop = gradConfigRef.current.stops[clamped];
    if (stop) {
      const parsed = parseCssColorToHsva(stop.color);
      setHsva((prev) => ({
        h: parsed.s === 0 ? prev.h : parsed.h,
        s: parsed.s,
        v: parsed.v,
        a: parsed.a
      }));
    }
  };

  const handleModeSwitch = (nextMode: ColorPickerMode) => {
    if (nextMode === pickerModeRef.current) return;
    pickerModeRef.current = nextMode;
    setPickerMode(nextMode);

    if (nextMode === "solid") {
      const activeStopColor =
        gradConfigRef.current.stops[selectedStopIdxRef.current]?.color ||
        gradConfigRef.current.stops[0]?.color ||
        formatHsvaOutput(hsva);
      const parsed = parseCssColorToHsva(activeStopColor);
      setHsva(parsed);
      emitPaintValue(activeStopColor);
      return;
    }

    const kind = nextMode as GradientKind;
    const parsedExisting = parseCssGradient(normVal);
    if (parsedExisting) {
      const switched: ParsedGradientConfig = { ...parsedExisting, kind };
      commitGradient(switched, Math.min(selectedStopIdxRef.current, switched.stops.length - 1));
    } else {
      const seeded = createDefaultGradientConfig(kind, normVal || formatHsvaOutput(hsva));
      const p0 = parseCssColorToHsva(seeded.stops[0]!.color);
      setHsva(p0);
      commitGradient(seeded, 0);
    }
  };

  const openStudioPicker = () => {
    const detected = detectColorPickerMode(value);
    pickerModeRef.current = detected;
    setPickerMode(detected);
    if (detected !== "solid") {
      const parsed = parseCssGradient(value);
      if (parsed) {
        gradConfigRef.current = parsed;
        setGradConfig(parsed);
        selectedStopIdxRef.current = 0;
        setSelectedStopIdx(0);
        if (parsed.stops[0]) {
          setHsva(parseCssColorToHsva(parsed.stops[0].color));
        }
      }
    }
    if (rowRef.current) {
      const docWin = rowRef.current.ownerDocument?.defaultView || window;
      const rect = rowRef.current.getBoundingClientRect();
      const popW = detected === "solid" ? 268 : 288;
      const popH = detected === "solid" ? 430 : 540;
      let left = rect.left - popW - 14;
      if (left < 10) {
        left = Math.min(rect.left, Math.max(10, docWin.innerWidth - popW - 12));
      }
      let top = rect.top - 50;
      if (top + popH > docWin.innerHeight - 10) {
        top = Math.max(10, docWin.innerHeight - popH - 12);
      }
      if (top < 10) top = 10;
      setPopoverCoords({ top, left });
    }
    setCustomSwatches(loadCustomSwatches());
    setCustomGradients(loadCustomGradients());
    setPickerOpen((v) => !v);
  };

  useEffect(() => {
    if (!pickerOpen) return;
    const doc = rowRef.current?.ownerDocument || document;
    const onOut = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rowRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setPickerOpen(false);
    };
    doc.addEventListener("mousedown", onOut, true);
    return () => doc.removeEventListener("mousedown", onOut, true);
  }, [pickerOpen]);

  const commitHsva = (next: HsvaColor) => {
    setHsva(next);
    commitActiveColorString(formatHsvaOutput(next));
  };

  const startSvDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const box = svBoxRef.current;
    if (!box) return;
    const doc = box.ownerDocument || document;
    const updateFromMouse = (cx: number, cy: number) => {
      const r = box.getBoundingClientRect();
      const s = Math.max(0, Math.min(1, (cx - r.left) / (r.width || 1)));
      const v = Math.max(0, Math.min(1, 1 - (cy - r.top) / (r.height || 1)));
      setHsva((prev) => {
        const next = { ...prev, s, v, a: prev.a === 0 ? 1 : prev.a };
        commitActiveColorString(formatHsvaOutput(next));
        return next;
      });
    };
    updateFromMouse(e.clientX, e.clientY);
    const onMove = (ev: MouseEvent) => updateFromMouse(ev.clientX, ev.clientY);
    const onUp = () => {
      doc.removeEventListener("mousemove", onMove, true);
      doc.removeEventListener("mouseup", onUp, true);
    };
    doc.addEventListener("mousemove", onMove, true);
    doc.addEventListener("mouseup", onUp, true);
  };

  const startHueDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const bar = hueBarRef.current;
    if (!bar) return;
    const doc = bar.ownerDocument || document;
    const updateHue = (cx: number) => {
      const r = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (cx - r.left) / (r.width || 1)));
      const h = Math.round(ratio * 360);
      setHsva((prev) => {
        const next = { ...prev, h: h >= 360 ? 359 : h, a: prev.a === 0 ? 1 : prev.a };
        commitActiveColorString(formatHsvaOutput(next));
        return next;
      });
    };
    updateHue(e.clientX);
    const onMove = (ev: MouseEvent) => updateHue(ev.clientX);
    const onUp = () => {
      doc.removeEventListener("mousemove", onMove, true);
      doc.removeEventListener("mouseup", onUp, true);
    };
    doc.addEventListener("mousemove", onMove, true);
    doc.addEventListener("mouseup", onUp, true);
  };

  const startAlphaDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const bar = alphaBarRef.current;
    if (!bar) return;
    const doc = bar.ownerDocument || document;
    const updateAlpha = (cx: number) => {
      const r = bar.getBoundingClientRect();
      const a = Math.round(Math.max(0, Math.min(1, (cx - r.left) / (r.width || 1))) * 100) / 100;
      setHsva((prev) => {
        const next = { ...prev, a };
        commitActiveColorString(formatHsvaOutput(next));
        return next;
      });
    };
    updateAlpha(e.clientX);
    const onMove = (ev: MouseEvent) => updateAlpha(ev.clientX);
    const onUp = () => {
      doc.removeEventListener("mousemove", onMove, true);
      doc.removeEventListener("mouseup", onUp, true);
    };
    doc.addEventListener("mousemove", onMove, true);
    doc.addEventListener("mouseup", onUp, true);
  };

  const startStopDrag = (idx: number, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    handleSelectStop(idx);
    const track = gradTrackRef.current;
    if (!track) return;
    const doc = track.ownerDocument || document;
    const moveStop = (cx: number) => {
      const r = track.getBoundingClientRect();
      const pct = Math.round(Math.max(0, Math.min(100, ((cx - r.left) / (r.width || 1)) * 100)));
      const cur = gradConfigRef.current;
      const nextStops = cur.stops.map((s, i) => (i === idx ? { ...s, position: pct } : s));
      commitGradient({ ...cur, stops: nextStops }, idx);
    };
    const onMove = (ev: MouseEvent) => moveStop(ev.clientX);
    const onUp = () => {
      doc.removeEventListener("mousemove", onMove, true);
      doc.removeEventListener("mouseup", onUp, true);
    };
    doc.addEventListener("mousemove", onMove, true);
    doc.addEventListener("mouseup", onUp, true);
  };

  const handleAddStopAtPct = (pct?: number) => {
    const cur = gradConfigRef.current;
    const activeStop = cur.stops[selectedStopIdxRef.current] || cur.stops[0];
    let nextPct = pct;
    if (nextPct === undefined) {
      const sorted = [...cur.stops].sort((a, b) => a.position - b.position);
      let bestMid = 50;
      let maxGap = -1;
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = sorted[i + 1]!.position - sorted[i]!.position;
        if (gap > maxGap) {
          maxGap = gap;
          bestMid = Math.round((sorted[i]!.position + sorted[i + 1]!.position) / 2);
        }
      }
      nextPct = bestMid;
    }
    const clampedPct = Math.max(0, Math.min(100, Math.round(nextPct)));
    const newStop = {
      id: `stop-${cur.stops.length}-${clampedPct}`,
      color: activeStop?.color || "#10B981",
      position: clampedPct,
    };
    const nextStops = [...cur.stops, newStop];
    const newIdx = nextStops.length - 1;
    commitGradient({ ...cur, stops: nextStops }, newIdx);
    const parsed = parseCssColorToHsva(newStop.color);
    setHsva(parsed);
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const track = gradTrackRef.current;
    if (!track) return;
    const r = track.getBoundingClientRect();
    const pct = Math.round(Math.max(0, Math.min(100, ((e.clientX - r.left) / (r.width || 1)) * 100)));
    handleAddStopAtPct(pct);
  };

  const handleDeleteSelectedStop = () => {
    const cur = gradConfigRef.current;
    if (cur.stops.length <= 2) return;
    const idx = selectedStopIdxRef.current;
    const nextStops = cur.stops.filter((_, i) => i !== idx);
    const nextIdx = Math.max(0, Math.min(nextStops.length - 1, idx - 1));
    commitGradient({ ...cur, stops: nextStops }, nextIdx);
    const nextStop = nextStops[nextIdx];
    if (nextStop) setHsva(parseCssColorToHsva(nextStop.color));
  };

  const handleFlipStops = () => {
    const flipped = flipGradientStops(gradConfigRef.current);
    commitGradient(flipped, 0);
    if (flipped.stops[0]) setHsva(parseCssColorToHsva(flipped.stops[0].color));
  };

  const startAngleDialDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const dial = angleDialRef.current;
    if (!dial) return;
    const doc = dial.ownerDocument || document;
    const updateFromPoint = (cx: number, cy: number) => {
      const r = dial.getBoundingClientRect();
      const mx = r.left + r.width / 2;
      const my = r.top + r.height / 2;
      const rad = Math.atan2(cy - my, cx - mx);
      const deg = Math.round(((rad * 180) / Math.PI + 90 + 360) % 360);
      commitGradient({ ...gradConfigRef.current, angle: deg });
    };
    updateFromPoint(e.clientX, e.clientY);
    const onMove = (ev: MouseEvent) => updateFromPoint(ev.clientX, ev.clientY);
    const onUp = () => {
      doc.removeEventListener("mousemove", onMove, true);
      doc.removeEventListener("mouseup", onUp, true);
    };
    doc.addEventListener("mousemove", onMove, true);
    doc.addEventListener("mouseup", onUp, true);
  };

  const pickEyedropper = async () => {
    const win = (rowRef.current?.ownerDocument?.defaultView || window) as any;
    const Dropper = win.EyeDropper || (window as any).EyeDropper;
    if (!Dropper) return;
    try {
      const eye = new Dropper();
      const res = await eye.open();
      if (res?.sRGBHex) {
        const picked = res.sRGBHex.toUpperCase();
        setHsva(parseCssColorToHsva(picked));
        commitActiveColorString(picked);
      }
    } catch {}
  };

  const curRgb = hsvToRgb(hsva.h, hsva.s, hsva.v);
  const pureHueHex = (() => {
    const hr = hsvToRgb(hsva.h, 1, 1);
    return "#" + toHex2(hr.r) + toHex2(hr.g) + toHex2(hr.b);
  })();
  const solidRgbCss = "rgb(" + curRgb.r + ", " + curRgb.g + ", " + curRgb.b + ")";
  const hex6Display = "#" + toHex2(curRgb.r) + toHex2(curRgb.g) + toHex2(curRgb.b);
  const effectiveOut = pickerMode === "solid" ? (normVal || formatHsvaOutput(hsva)) : serializeCssGradient(gradConfig);
  const activeStop = gradConfig.stops[selectedStopIdx] || gradConfig.stops[0];
  const activeStopColorDisplay = pickerMode === "solid" ? (normVal || hex6Display) : (activeStop?.color || hex6Display);

  const handleQuickAddSwatch = () => {
    const toSave = pickerMode === "solid" ? effectiveOut : (activeStop?.color || formatHsvaOutput(hsva));
    if (!toSave) return;
    const exists = customSwatches.some((c) => c.value.toLowerCase() === toSave.toLowerCase());
    if (exists) return;
    const next = [...customSwatches, { name: toSave, value: toSave }];
    setCustomSwatches(next);
    saveCustomSwatches(next);
  };

  const handleDeleteCustomSwatch = (valToRemove: string) => {
    const next = customSwatches.filter((c) => c.value.toLowerCase() !== valToRemove.toLowerCase());
    setCustomSwatches(next);
    saveCustomSwatches(next);
  };

  const handleQuickAddGradient = () => {
    const toSave = serializeCssGradient(gradConfig);
    if (!toSave) return;
    const exists = customGradients.some((c) => c.value.toLowerCase() === toSave.toLowerCase());
    if (exists) return;
    const labelName = formatGradientSummaryLabel(toSave) || "Custom Gradient";
    const next = [...customGradients, { name: labelName, value: toSave }];
    setCustomGradients(next);
    saveCustomGradients(next);
  };

  const handleDeleteCustomGradient = (valToRemove: string) => {
    const next = customGradients.filter((c) => c.value.toLowerCase() !== valToRemove.toLowerCase());
    setCustomGradients(next);
    saveCustomGradients(next);
  };

  const handleRawGradientPasteOrEdit = (rawInput: string) => {
    emitPaintValue(rawInput);
    const parsed = parseCssGradient(rawInput);
    if (parsed) {
      pickerModeRef.current = parsed.kind;
      setPickerMode(parsed.kind);
      gradConfigRef.current = parsed;
      setGradConfig(parsed);
      const nextIdx = Math.min(selectedStopIdxRef.current, parsed.stops.length - 1);
      selectedStopIdxRef.current = nextIdx;
      setSelectedStopIdx(nextIdx);
      if (parsed.stops[nextIdx]) {
        setHsva(parseCssColorToHsva(parsed.stops[nextIdx]!.color));
      }
    }
  };

  const matchedPreset = !isMixed && normVal && !isGradientVal
    ? GM3_COLOR_PRESETS.find((p) => p.value.toLowerCase() === normVal.toLowerCase())
    : undefined;

  const portalBody = rowRef.current?.ownerDocument?.body || (typeof document !== "undefined" ? document.body : null);
  const isGradMode = pickerMode !== "solid";
  const linearTrackPreview = serializeCssGradient({
    ...gradConfig,
    kind: "linear",
    angle: 90,
  });

  const studioPickerModal = pickerOpen ? (
    <div
      ref={popRef}
      data-ecmd-color-studio-popover="true"
      data-ecmd-color-studio-mode={pickerMode}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: popoverCoords.top + "px",
        left: popoverCoords.left + "px",
        width: isGradMode ? "288px" : "262px",
        maxHeight: "calc(100vh - 20px)",
        overflowY: "auto",
        background: "#FFFFFF",
        border: "1px solid #CBD5E1",
        borderRadius: "10px",
        boxShadow: "0 20px 48px rgba(15, 23, 42, 0.34), 0 0 0 1px rgba(15, 23, 42, 0.06)",
        zIndex: 2147483647,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, system-ui, sans-serif",
        userSelect: "none"
      }}
    >
      {/* Top Mode Bar: [ Solid ] [ Linear ] [ Radial ] [ Conic ] */}
      <div
        data-ecmd-color-mode-bar="true"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "3px",
          padding: "6px 8px",
          background: "#F1F5F9",
          borderBottom: "1px solid #E2E8F0",
          flexShrink: 0,
        }}
      >
        {MODE_TABS.map((tab) => {
          const isAct = pickerMode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-ecmd-color-mode-tab={tab.id}
              aria-pressed={isAct}
              onClick={() => handleModeSwitch(tab.id)}
              style={{
                padding: "4px 2px",
                fontSize: "10.5px",
                fontWeight: isAct ? 700 : 600,
                borderRadius: "6px",
                border: isAct ? "1px solid #0D9488" : "1px solid transparent",
                background: isAct ? "#FFFFFF" : "transparent",
                color: isAct ? "#0F766E" : "#475569",
                boxShadow: isAct ? "0 1px 2px rgba(15, 23, 42, 0.08)" : "none",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Paint Token Binding Section (Solid Colors & Multi-Stop Gradients) */}
      {tokenBinding && (
        <div style={{ padding: "7px 9px 0" }}>
          <EcmdTokenPopoverSection
            tokens={tokenBinding.tokens}
            compatibleTypes={["paint"]}
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
            saveButtonLabel="🔖 Save as Paint Token"
            defaultTokenName={isGradientVal ? "Emerald Luxe Gradient" : `${label} Paint`}
            attrTag={propKey || label}
          />
        </div>
      )}

      {/* Gradient Tools Panel (Linear / Radial / Conic) */}
      {isGradMode && (
        <div
          data-ecmd-gradient-tools="true"
          style={{
            padding: "9px 11px 8px",
            background: "#F8FAFC",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {/* Live Rendered Gradient Preview Swatch + Interactive Multi-Stop Track (0%–100%) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div
              title={effectiveOut}
              style={{
                height: "28px",
                borderRadius: "6px",
                border: "1px solid #CBD5E1",
                background: "repeating-conic-gradient(#CBD5E1 0% 25%, #FFFFFF 0% 50%) 50% / 8px 8px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", inset: 0, background: effectiveOut }} />
            </div>

            {/* Draggable Multi-Stop Track */}
            <div style={{ position: "relative", padding: "6px 0" }}>
              <div
                ref={gradTrackRef}
                data-ecmd-gradient-track="true"
                onClick={handleTrackClick}
                title="Click anywhere on track to add a color stop"
                style={{
                  position: "relative",
                  height: "14px",
                  borderRadius: "999px",
                  border: "1px solid #94A3B8",
                  background: "repeating-conic-gradient(#CBD5E1 0% 25%, #FFFFFF 0% 50%) 50% / 6px 6px",
                  cursor: "crosshair",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "999px",
                    background: linearTrackPreview,
                    pointerEvents: "none",
                  }}
                />
                {gradConfig.stops.map((stop, idx) => {
                  const isSel = idx === selectedStopIdx;
                  return (
                    <button
                      key={stop.id + "-" + idx}
                      type="button"
                      data-ecmd-gradient-stop-handle={idx}
                      aria-label={`Gradient Stop ${idx + 1} at ${stop.position}%`}
                      aria-pressed={isSel}
                      onMouseDown={(e) => startStopDrag(idx, e)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectStop(idx);
                      }}
                      title={`Stop #${idx + 1}: ${stop.color} @ ${stop.position}% (drag to reposition)`}
                      style={{
                        position: "absolute",
                        left: `${stop.position}%`,
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        width: isSel ? "16px" : "13px",
                        height: isSel ? "16px" : "13px",
                        borderRadius: "50%",
                        border: isSel ? "2.5px solid #0D9488" : "2px solid #FFFFFF",
                        boxShadow: isSel
                          ? "0 0 0 2px #FFFFFF, 0 2px 6px rgba(15,23,42,0.45)"
                          : "0 1px 4px rgba(15,23,42,0.45)",
                        background: stop.color,
                        cursor: "ew-resize",
                        padding: 0,
                        zIndex: isSel ? 3 : 2,
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Stop Position %, [+ Stop], [⇄ Flip], [🗑️] */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "10px", fontWeight: 700, color: "#475569" }}>
                <span>Pos</span>
                <div style={{ display: "flex", alignItems: "center", border: "1px solid #CBD5E1", borderRadius: "5px", background: "#FFFFFF", paddingRight: "3px", width: "54px" }}>
                  <input
                    type="number"
                    aria-label="Stop Position Percent"
                    data-ecmd-gradient-stop-pos="true"
                    min={0}
                    max={100}
                    value={activeStop?.position ?? 0}
                    onChange={(e) => {
                      const pct = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      const nextStops = gradConfig.stops.map((s, i) =>
                        i === selectedStopIdx ? { ...s, position: pct } : s
                      );
                      commitGradient({ ...gradConfig, stops: nextStops }, selectedStopIdx);
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={{ width: "100%", textAlign: "center", padding: "2px 2px", fontSize: "10.5px", fontFamily: "ui-monospace, monospace", border: "none", background: "transparent", color: "#0F172A", outline: "none" }}
                  />
                  <span style={{ fontSize: "9.5px", color: "#64748B" }}>%</span>
                </div>
              </label>

              <button
                type="button"
                data-ecmd-gradient-add-stop="true"
                onClick={() => handleAddStopAtPct()}
                title="Add a new gradient color stop"
                style={{
                  flex: 1,
                  padding: "3px 5px",
                  fontSize: "10px",
                  fontWeight: 700,
                  borderRadius: "5px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#0F766E",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                + Stop
              </button>

              <button
                type="button"
                data-ecmd-gradient-flip="true"
                onClick={handleFlipStops}
                title="Reverse stop order (great for Hover states)"
                style={{
                  padding: "3px 6px",
                  fontSize: "10px",
                  fontWeight: 700,
                  borderRadius: "5px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#334155",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                ⇄ Flip
              </button>

              <button
                type="button"
                data-ecmd-gradient-delete-stop="true"
                disabled={gradConfig.stops.length <= 2}
                onClick={handleDeleteSelectedStop}
                title={gradConfig.stops.length <= 2 ? "Minimum 2 stops required" : "Delete selected stop"}
                style={{
                  padding: "3px 6px",
                  fontSize: "10px",
                  fontWeight: 700,
                  borderRadius: "5px",
                  border: gradConfig.stops.length > 2 ? "1px solid rgba(220,38,38,0.35)" : "1px solid #E2E8F0",
                  background: gradConfig.stops.length > 2 ? "rgba(239,68,68,0.08)" : "#F1F5F9",
                  color: gradConfig.stops.length > 2 ? "#DC2626" : "#94A3B8",
                  cursor: gradConfig.stops.length > 2 ? "pointer" : "not-allowed",
                }}
              >
                🗑️
              </button>
            </div>
          </div>

          {/* Angle Dial + Slider + Quick Direction Chips (Linear & Conic) OR Shape/Origin (Radial) */}
          {pickerMode === "radial" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#475569" }}>Shape</span>
                <div style={{ display: "flex", gap: "4px", flex: 1 }}>
                  {(["circle", "ellipse"] as RadialGradientShape[]).map((sh) => {
                    const isAct = gradConfig.radialShape === sh;
                    return (
                      <button
                        key={sh}
                        type="button"
                        data-ecmd-radial-shape={sh}
                        onClick={() => commitGradient({ ...gradConfig, radialShape: sh })}
                        style={{
                          flex: 1,
                          padding: "3px 6px",
                          fontSize: "10px",
                          fontWeight: 700,
                          borderRadius: "5px",
                          border: isAct ? "1px solid #0D9488" : "1px solid #CBD5E1",
                          background: isAct ? "rgba(13,148,136,0.12)" : "#FFFFFF",
                          color: isAct ? "#0F766E" : "#475569",
                          cursor: "pointer",
                          textTransform: "capitalize",
                        }}
                      >
                        {sh}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#475569" }}>Origin</span>
                <div style={{ display: "flex", gap: "3px", flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
                  {RADIAL_ORIGIN_CHIPS.map((orig) => {
                    const isAct = gradConfig.radialOrigin.toLowerCase() === orig.value;
                    return (
                      <button
                        key={orig.value}
                        type="button"
                        data-ecmd-radial-origin={orig.value}
                        onClick={() => commitGradient({ ...gradConfig, radialOrigin: orig.value })}
                        style={{
                          padding: "2px 6px",
                          fontSize: "9.5px",
                          fontWeight: 700,
                          borderRadius: "4px",
                          border: isAct ? "1px solid #0D9488" : "1px solid #CBD5E1",
                          background: isAct ? "rgba(13,148,136,0.12)" : "#FFFFFF",
                          color: isAct ? "#0F766E" : "#475569",
                          cursor: "pointer",
                        }}
                      >
                        {orig.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                {/* Draggable Angle Dial */}
                <div
                  ref={angleDialRef}
                  data-ecmd-gradient-angle-dial="true"
                  onMouseDown={startAngleDialDrag}
                  title={`Angle ${gradConfig.angle}° (drag to rotate)`}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: "1.5px solid #94A3B8",
                    background: "#FFFFFF",
                    position: "relative",
                    cursor: "grab",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      width: "2px",
                      height: "10px",
                      background: "#0D9488",
                      borderRadius: "2px",
                      transformOrigin: "bottom center",
                      transform: `translate(-50%, -100%) rotate(${gradConfig.angle}deg)`,
                      pointerEvents: "none",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      width: "4px",
                      height: "4px",
                      borderRadius: "50%",
                      background: "#0F172A",
                      transform: "translate(-50%, -50%)",
                      pointerEvents: "none",
                    }}
                  />
                </div>

                <input
                  type="range"
                  aria-label="Gradient Angle Slider"
                  min={0}
                  max={360}
                  value={gradConfig.angle}
                  onChange={(e) => commitGradient({ ...gradConfig, angle: Number(e.target.value) })}
                  style={{ flex: 1, height: "4px", accentColor: "#0D9488", cursor: "pointer" }}
                />

                <div style={{ display: "flex", alignItems: "center", border: "1px solid #CBD5E1", borderRadius: "5px", background: "#FFFFFF", paddingRight: "3px", width: "52px", flexShrink: 0 }}>
                  <input
                    type="number"
                    aria-label="Gradient Angle Degrees"
                    data-ecmd-gradient-angle-input="true"
                    min={0}
                    max={360}
                    value={gradConfig.angle}
                    onChange={(e) => {
                      const rawDeg = Number(e.target.value);
                      const norm = Number.isFinite(rawDeg) ? ((Math.round(rawDeg) % 360) + 360) % 360 : 0;
                      commitGradient({ ...gradConfig, angle: norm });
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={{ width: "100%", textAlign: "center", padding: "2px 2px", fontSize: "10.5px", fontFamily: "ui-monospace, monospace", border: "none", background: "transparent", color: "#0F172A", outline: "none" }}
                  />
                  <span style={{ fontSize: "9.5px", color: "#64748B" }}>°</span>
                </div>
              </div>

              {/* 1-Click Direction Chips: 0° ↑, 45° ↗, 90° →, 135° ↘, 180° ↓ */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "3px" }}>
                {GRADIENT_DIRECTION_CHIPS.map((chip) => {
                  const isAct = gradConfig.angle === chip.angle;
                  return (
                    <button
                      key={chip.angle}
                      type="button"
                      data-ecmd-gradient-dir={chip.angle}
                      onClick={() => commitGradient({ ...gradConfig, angle: chip.angle })}
                      style={{
                        padding: "2px 2px",
                        fontSize: "9.5px",
                        fontWeight: 700,
                        borderRadius: "4px",
                        border: isAct ? "1px solid #0D9488" : "1px solid #CBD5E1",
                        background: isAct ? "rgba(13,148,136,0.12)" : "#FFFFFF",
                        color: isAct ? "#0F766E" : "#475569",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full-Bleed Saturation / Brightness Square (Connected to Solid Color OR Selected Gradient Stop) */}
      <div
        ref={svBoxRef}
        onMouseDown={startSvDrag}
        style={{
          position: "relative",
          width: "100%",
          height: isGradMode ? "112px" : "142px",
          backgroundColor: pureHueHex,
          backgroundImage: "linear-gradient(to top, #000000, transparent), linear-gradient(to right, #FFFFFF, transparent)",
          cursor: "crosshair",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: (hsva.s * 100) + "%",
            top: ((1 - hsva.v) * 100) + "%",
            transform: "translate(-50%, -50%)",
            width: "13px",
            height: "13px",
            borderRadius: "50%",
            border: "2px solid #FFFFFF",
            boxShadow: "0 1px 4px rgba(0,0,0,0.6)",
            background: solidRgbCss,
            pointerEvents: "none"
          }}
        />
      </div>

      <div style={{ padding: "10px 11px 11px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {/* Eyedropper + Preview Circle + Hue & Transparency Sliders */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={pickEyedropper}
            title="Eyedropper — pick color from screen"
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "6px",
              border: "1px solid #E2E8F0",
              background: "#F8FAFC",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "13px",
              cursor: "pointer",
              flexShrink: 0
            }}
          >
            💧
          </button>

          <div
            title={activeStopColorDisplay}
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "50%",
              border: "1px solid #CBD5E1",
              background: "repeating-conic-gradient(#CBD5E1 0% 25%, #FFFFFF 0% 50%) 50% / 8px 8px",
              position: "relative",
              overflow: "hidden",
              flexShrink: 0
            }}
          >
            <div style={{ position: "absolute", inset: 0, background: formatHsvaOutput(hsva) }} />
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
            {/* Rainbow Hue Slider */}
            <div
              ref={hueBarRef}
              onMouseDown={startHueDrag}
              title="Hue"
              style={{
                position: "relative",
                height: "10px",
                borderRadius: "999px",
                background: "linear-gradient(to right, #FF0000 0%, #FFFF00 17%, #00FF00 33%, #00FFFF 50%, #0000FF 67%, #FF00FF 83%, #FF0000 100%)",
                cursor: "pointer",
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)"
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: ((hsva.h / 360) * 100) + "%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "#FFFFFF",
                  border: "1px solid rgba(0,0,0,0.35)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
                  pointerEvents: "none"
                }}
              />
            </div>

            {/* Transparency / Opacity Slider */}
            <div
              ref={alphaBarRef}
              onMouseDown={startAlphaDrag}
              title="Transparency / Opacity"
              style={{
                position: "relative",
                height: "10px",
                borderRadius: "999px",
                backgroundColor: "#FFFFFF",
                backgroundImage: "linear-gradient(to right, transparent, " + solidRgbCss + "), repeating-conic-gradient(#CBD5E1 0% 25%, #FFFFFF 0% 50%)",
                backgroundSize: "100% 100%, 8px 8px",
                cursor: "pointer",
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)"
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: (hsva.a * 100) + "%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "#FFFFFF",
                  border: "1px solid rgba(0,0,0,0.35)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
                  pointerEvents: "none"
                }}
              />
            </div>
          </div>
        </div>

        {/* HEX / RGBA Mode Inputs + Opacity % */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {colorMode === "HEX" ? (
            <>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                <input
                  type="text"
                  aria-label={isGradMode ? "Stop Color HEX" : "Solid Color HEX"}
                  data-ecmd-color-hex-input="true"
                  value={activeStopColorDisplay}
                  onChange={(e) => {
                    const nextStr = e.target.value;
                    const parsed = parseCssColorToHsva(nextStr);
                    setHsva(parsed);
                    commitActiveColorString(nextStr);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{ width: "100%", textAlign: "center", padding: "3px 5px", fontSize: "11px", fontFamily: "ui-monospace, monospace", borderRadius: "5px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#0F172A", outline: "none" }}
                />
                <span style={{ fontSize: "9px", fontWeight: 700, color: "#64748B" }}>{isGradMode ? `STOP ${selectedStopIdx + 1} HEX` : "HEX"}</span>
              </div>
              <div style={{ width: "54px", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                <div style={{ display: "flex", alignItems: "center", width: "100%", border: "1px solid #CBD5E1", borderRadius: "5px", background: "#FFFFFF", paddingRight: "3px" }}>
                  <input
                    type="number"
                    aria-label="Color Alpha Percent"
                    data-ecmd-color-alpha-input="true"
                    min={0}
                    max={100}
                    value={Math.round(hsva.a * 100)}
                    onChange={(e) => {
                      const pct = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      commitHsva({ ...hsva, a: pct / 100 });
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={{ width: "100%", textAlign: "center", padding: "3px 2px", fontSize: "11px", fontFamily: "ui-monospace, monospace", border: "none", background: "transparent", color: "#0F172A", outline: "none" }}
                  />
                  <span style={{ fontSize: "9.5px", color: "#64748B" }}>%</span>
                </div>
                <span style={{ fontSize: "9px", fontWeight: 700, color: "#64748B" }}>ALPHA</span>
              </div>
            </>
          ) : (
            <>
              {([["R", curRgb.r], ["G", curRgb.g], ["B", curRgb.b]] as const).map(([ch, num]) => (
                <div key={ch} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                  <input
                    type="number"
                    min={0}
                    max={255}
                    value={num}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(255, Number(e.target.value) || 0));
                      const nr = ch === "R" ? v : curRgb.r;
                      const ng = ch === "G" ? v : curRgb.g;
                      const nb = ch === "B" ? v : curRgb.b;
                      const nh = rgbToHsv(nr, ng, nb);
                      commitHsva({ ...nh, a: hsva.a });
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={{ width: "100%", textAlign: "center", padding: "3px 2px", fontSize: "10.5px", fontFamily: "ui-monospace, monospace", borderRadius: "5px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#0F172A", outline: "none" }}
                  />
                  <span style={{ fontSize: "9px", fontWeight: 700, color: "#64748B" }}>{ch}</span>
                </div>
              ))}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round(hsva.a * 100)}
                  onChange={(e) => {
                    const pct = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    commitHsva({ ...hsva, a: pct / 100 });
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{ width: "100%", textAlign: "center", padding: "3px 2px", fontSize: "10.5px", fontFamily: "ui-monospace, monospace", borderRadius: "5px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#0F172A", outline: "none" }}
                />
                <span style={{ fontSize: "9px", fontWeight: 700, color: "#64748B" }}>A%</span>
              </div>
            </>
          )}
          <button
            type="button"
            title="Toggle HEX / RGBA inputs"
            onClick={() => setColorMode((m) => (m === "HEX" ? "RGBA" : "HEX"))}
            style={{ border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#475569", borderRadius: "5px", padding: "4px 5px", fontSize: "10px", fontWeight: 700, cursor: "pointer", alignSelf: "flex-start" }}
          >
            ⇅
          </button>
        </div>

        {/* Saved Gradients + Built-in ECMD Presets + Figma Raw CSS Paste (Gradient Modes) */}
        {isGradMode ? (
          <>
            <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "7px", display: "flex", flexDirection: "column", gap: "5px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#475569" }}>Saved Gradients</span>
                <button
                  type="button"
                  onClick={() => {
                    pickerModeRef.current = "solid";
                    setPickerMode("solid");
                    onChange("");
                  }}
                  style={{ border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", borderRadius: "4px", padding: "1px 5px", fontSize: "9.5px", fontWeight: 600, cursor: "pointer" }}
                >
                  Unset
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" }}>
                {customGradients.map((sw) => {
                  const isSel = normVal.toLowerCase() === sw.value.toLowerCase();
                  return (
                    <button
                      key={sw.value}
                      type="button"
                      title={sw.name + " • " + sw.value + " (Click to apply • Right-click to delete)"}
                      onClick={() => handleRawGradientPasteOrEdit(sw.value)}
                      onContextMenu={(e) => { e.preventDefault(); handleDeleteCustomGradient(sw.value); }}
                      style={{
                        width: "26px",
                        height: "20px",
                        borderRadius: "4px",
                        border: isSel ? "2px solid #0D9488" : "1px solid #CBD5E1",
                        background: "repeating-conic-gradient(#CBD5E1 0% 25%, #FFFFFF 0% 50%) 50% / 6px 6px",
                        position: "relative",
                        overflow: "hidden",
                        cursor: "pointer",
                        padding: 0
                      }}
                    >
                      <span style={{ position: "absolute", inset: 0, background: sw.value }} />
                    </button>
                  );
                })}
                <button
                  type="button"
                  data-ecmd-save-gradient-btn="true"
                  onClick={handleQuickAddGradient}
                  title="Save current gradient to Saved Gradients"
                  style={{
                    width: "24px",
                    height: "20px",
                    borderRadius: "4px",
                    border: "1px dashed #94A3B8",
                    background: "#F8FAFC",
                    color: "#334155",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                    fontWeight: 700,
                    lineHeight: 1,
                    cursor: "pointer",
                    padding: 0
                  }}
                >
                  +
                </button>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "6px", display: "flex", flexDirection: "column", gap: "5px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B" }}>ECMD Gradient Presets</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "5px" }}>
                {ECMD_GRADIENT_PRESETS.map((preset) => {
                  const isSel = normVal.toLowerCase() === preset.value.toLowerCase();
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      data-ecmd-gradient-preset={preset.id}
                      title={`${preset.name} — ${preset.value}`}
                      onClick={() => handleRawGradientPasteOrEdit(preset.value)}
                      style={{
                        height: "22px",
                        borderRadius: "5px",
                        border: isSel ? "2px solid #0D9488" : "1px solid #CBD5E1",
                        background: "repeating-conic-gradient(#CBD5E1 0% 25%, #FFFFFF 0% 50%) 50% / 6px 6px",
                        position: "relative",
                        overflow: "hidden",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      <span style={{ position: "absolute", inset: 0, background: preset.value }} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Raw CSS Gradient Input (1-paste from Figma!) */}
            <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "6px", display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#64748B" }}>CSS Gradient (Paste from Figma)</span>
              <input
                type="text"
                aria-label="Raw CSS Gradient"
                data-ecmd-gradient-raw-input="true"
                value={normVal || effectiveOut}
                placeholder="linear-gradient(135deg, #059669 0%, #0EA5E9 100%)"
                onChange={(e) => handleRawGradientPasteOrEdit(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "4px 6px",
                  fontSize: "10px",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  borderRadius: "5px",
                  border: "1px solid #CBD5E1",
                  background: "#F8FAFC",
                  color: "#0F172A",
                  outline: "none",
                }}
              />
            </div>
          </>
        ) : (
          <>
            {/* MY SAVED COLORS SWATCH TRAY (Solid Mode — 100% Preserved!) */}
            <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "7px", display: "flex", flexDirection: "column", gap: "5px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "#475569" }}>Saved Colors</span>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button type="button" onClick={() => onChange("transparent")} style={{ border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#475569", borderRadius: "4px", padding: "1px 5px", fontSize: "9.5px", fontWeight: 600, cursor: "pointer" }}>Transparent</button>
                  <button type="button" onClick={() => onChange("")} style={{ border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", borderRadius: "4px", padding: "1px 5px", fontSize: "9.5px", fontWeight: 600, cursor: "pointer" }}>Unset</button>
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" }}>
                {customSwatches.map((sw) => {
                  const isSel = normVal.toLowerCase() === sw.value.toLowerCase();
                  return (
                    <button
                      key={sw.value}
                      type="button"
                      title={sw.value + " (Click to apply • Right-click to delete)"}
                      onClick={() => onChange(sw.value)}
                      onContextMenu={(e) => { e.preventDefault(); handleDeleteCustomSwatch(sw.value); }}
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "4px",
                        border: isSel ? "2px solid #0B57D0" : "1px solid #CBD5E1",
                        background: "repeating-conic-gradient(#CBD5E1 0% 25%, #FFFFFF 0% 50%) 50% / 6px 6px",
                        position: "relative",
                        overflow: "hidden",
                        cursor: "pointer",
                        padding: 0
                      }}
                    >
                      <span style={{ position: "absolute", inset: 0, background: sw.value }} />
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={handleQuickAddSwatch}
                  title={"Save " + effectiveOut + " to Saved Colors"}
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "4px",
                    border: "1px dashed #94A3B8",
                    background: "#F8FAFC",
                    color: "#334155",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                    fontWeight: 700,
                    lineHeight: 1,
                    cursor: "pointer",
                    padding: 0
                  }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Theme & Google M3 Swatch Grid Below Saved Colors */}
            <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B" }}>Theme Presets</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {GM3_COLOR_PRESETS.map((sw) => {
                  const isSel = normVal.toLowerCase() === sw.value.toLowerCase();
                  return (
                    <button
                      key={sw.name}
                      type="button"
                      title={sw.name + " (" + sw.value + ")"}
                      onClick={() => onChange(sw.value)}
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "4px",
                        border: isSel ? "2px solid #0B57D0" : "1px solid #CBD5E1",
                        background: "repeating-conic-gradient(#CBD5E1 0% 25%, #FFFFFF 0% 50%) 50% / 6px 6px",
                        position: "relative",
                        overflow: "hidden",
                        cursor: "pointer",
                        padding: 0
                      }}
                    >
                      <span style={{ position: "absolute", inset: 0, background: sw.value }} />
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  ) : null;

  const isRowEnabled = enabled !== false;

  return (
    <div
      ref={rowRef}
      data-ecmd-prop-row={propKey || label}
      data-ecmd-prop-enabled={isRowEnabled ? "true" : "false"}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "6px",
        opacity: isRowEnabled ? 1 : 0.45,
        transition: "opacity 0.15s ease"
      }}
    >
      {onToggleEnabled && (
        <input
          type="checkbox"
          checked={isRowEnabled}
          aria-label={`Enable ${label}`}
          data-ecmd-prop-toggle={propKey || label}
          title={isRowEnabled ? `Turn OFF ${label} (preserves saved value, lets Plasmic Design tab control it)` : `Turn ON ${label} (restores saved value)`}
          onChange={(e) => onToggleEnabled(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          style={{ width: "13px", height: "13px", margin: 0, cursor: "pointer", flexShrink: 0, accentColor: "#0D9488" }}
        />
      )}
      <div style={{ display: "flex", flexDirection: "column", width: onToggleEnabled ? "80px" : "92px", flexShrink: 0, minWidth: 0 }}>
        <span style={{ fontSize: "11.5px", color: "#334155", fontWeight: 500, lineHeight: 1.2 }}>{label}</span>
        {linkedToken ? (
          <div style={{ marginTop: "2px" }}>
            <EcmdLinkedTokenPill
              token={linkedToken}
              attrTag={propKey || label}
              onClickPill={openStudioPicker}
              onDetach={() => {
                setEditTokenMode(false);
                tokenBinding?.onDetachToken();
              }}
            />
          </div>
        ) : gradientSummaryLabel ? (
          <span
            data-ecmd-gradient-badge="true"
            title={normVal}
            style={{ fontSize: "9px", color: "#0F766E", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            ◈ {gradientSummaryLabel}
          </span>
        ) : matchedPreset ? (
          <span title={matchedPreset.name + " (" + matchedPreset.value + ")"} style={{ fontSize: "9.5px", color: "#0B57D0", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            ● {matchedPreset.name}
          </span>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          flex: 1,
          minWidth: 0,
          padding: "3px 5px",
          borderRadius: "6px",
          border: pickerOpen ? "1px solid #0B57D0" : "1px solid #E2E8F0",
          background: "#F8FAFC"
        }}
      >
        <button
          type="button"
          data-ecmd-color-swatch={propKey || label}
          onClick={openStudioPicker}
          title="Click to open Color & Gradient Studio (Solid / Linear / Radial / Conic)"
          style={{
            width: "20px",
            height: "20px",
            borderRadius: "4px",
            border: "1px solid #CBD5E1",
            background: "repeating-conic-gradient(#CBD5E1 0% 25%, #FFFFFF 0% 50%) 50% / 8px 8px",
            position: "relative",
            overflow: "hidden",
            cursor: "pointer",
            padding: 0,
            flexShrink: 0
          }}
        >
          {normVal && normVal !== "transparent" && (
            <span style={{ position: "absolute", inset: 0, background: normVal }} />
          )}
        </button>

        <input
          type="text"
          value={isMixed ? "" : value}
          placeholder={isMixed ? "Mixed" : "unset / #HEX / gradient"}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "1px 2px",
            fontSize: "11px",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            border: "none",
            background: "transparent",
            color: "#0F172A",
            outline: "none"
          }}
        />
      </div>

      {pickerOpen && (portalBody ? createPortal(studioPickerModal, portalBody) : studioPickerModal)}
    </div>
  );
}

export interface ShadowPresetOption {
  id: string;
  label: string;
  value: string;
}

export const OUTER_SHADOW_PRESETS: ShadowPresetOption[] = [
  { id: "unset", label: "Unset", value: "" },
  { id: "soft-lift", label: "Soft Lift", value: "0px 2px 6px 0px rgba(0,0,0,0.12)" },
  { id: "medium-card", label: "Medium Card", value: "0px 6px 16px -2px rgba(0,0,0,0.20)" },
  { id: "deep-float", label: "Deep Float", value: "0px 14px 32px -4px rgba(0,0,0,0.35)" },
  { id: "outer-glow", label: "Outer Glow", value: "0px 0px 16px 2px rgba(20,184,166,0.45)" }
];

export const INNER_SHADOW_PRESETS: ShadowPresetOption[] = [
  { id: "unset", label: "Unset", value: "" },
  { id: "recessed-input", label: "Recessed Input", value: "inset 0px 2px 4px 0px rgba(0,0,0,0.25)" },
  { id: "pressed-button", label: "Pressed Button", value: "inset 0px 3px 6px 1px rgba(0,0,0,0.35)" },
  { id: "subtle-inner-rim", label: "Subtle Inner Rim", value: "inset 0px 0px 0px 1px rgba(255,255,255,0.14)" },
  { id: "inner-glow", label: "Inner Glow", value: "inset 0px 0px 12px 1px rgba(20,184,166,0.35)" }
];

export interface ParsedShadowFields {
  x: number;
  y: number;
  blur: number;
  spread: number;
  colorHex: string;
  opacity: number;
}

export function splitShadowLayers(raw?: string): string[] {
  const s = (raw || "").trim();
  if (!s) return [];
  const layers: string[] = [];
  let cur = "";
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      if (cur.trim()) layers.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) layers.push(cur.trim());
  return layers;
}

export function normalizeOuterShadow(raw?: string): string {
  const s = (raw || "").trim();
  if (!s || /^unset$/i.test(s)) return "";
  return s;
}

export function ensureInsetShadow(raw?: string): string {
  const s = (raw || "").trim();
  if (!s || /^(unset|none)$/i.test(s)) return "";
  const layers = splitShadowLayers(s);
  if (!layers.length) return "";
  return layers
    .map((layer) => (/\binset\b/i.test(layer) ? layer : "inset " + layer))
    .join(", ");
}

export function resolveCombinedBoxShadow(opts: {
  outerShadow?: string | undefined;
  innerShadow?: string | undefined;
  legacyShadow?: string | undefined;
  legacyElevation?: string | undefined;
  disabledProps?: Record<string, boolean> | undefined;
}): string {
  const disabled = opts.disabledProps;
  const outerOff = Boolean(disabled?.["outerShadow"] || disabled?.["shadow"] || disabled?.["elevation"]);
  const innerOff = Boolean(disabled?.["innerShadow"]);

  const rawOuter = outerOff
    ? ""
    : opts.outerShadow !== undefined
      ? opts.outerShadow
      : opts.legacyElevation !== undefined
        ? opts.legacyElevation
        : (opts.legacyShadow ?? "");

  const outerClean = normalizeOuterShadow(rawOuter);
  const innerClean = innerOff ? "" : ensureInsetShadow(opts.innerShadow);

  if (outerClean && outerClean.toLowerCase() !== "none" && innerClean) {
    return outerClean + ", " + innerClean;
  }
  if (innerClean) return innerClean;
  if (outerClean) return outerClean;
  return "";
}

function hexToRgbTuple(hex: string): { r: number; g: number; b: number } {
  const clean = (hex || "").trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return {
      r: parseInt(clean.charAt(0) + clean.charAt(0), 16),
      g: parseInt(clean.charAt(1) + clean.charAt(1), 16),
      b: parseInt(clean.charAt(2) + clean.charAt(2), 16)
    };
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16)
    };
  }
  return { r: 0, g: 0, b: 0 };
}

export function parseShadowCssToFields(raw: string, isInner: boolean): ParsedShadowFields {
  const fallback: ParsedShadowFields = {
    x: 0,
    y: isInner ? 2 : 4,
    blur: isInner ? 4 : 12,
    spread: 0,
    colorHex: "#000000",
    opacity: isInner ? 25 : 20
  };
  const s = (raw || "").trim();
  if (!s || /^(unset|none)$/i.test(s)) return fallback;

  const firstLayer = splitShadowLayers(s)[0] || s;
  let rest = firstLayer.replace(/\binset\b/gi, "").trim();

  let colorHex = fallback.colorHex;
  let opacity = fallback.opacity;

  const rgbaMatch = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)/i.exec(rest);
  if (rgbaMatch && rgbaMatch[1] && rgbaMatch[2] && rgbaMatch[3]) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    const a = rgbaMatch[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(rgbaMatch[4]))) : 1;
    colorHex = "#" + toHex2(r) + toHex2(g) + toHex2(b);
    opacity = Math.round(a * 100);
    rest = rest.replace(rgbaMatch[0], " ").trim();
  } else {
    const hexMatch = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/.exec(rest);
    if (hexMatch && hexMatch[1]) {
      const h = hexMatch[1];
      if (h.length === 3) {
        colorHex = "#" + (h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2)).toUpperCase();
        opacity = 100;
      } else if (h.length === 6) {
        colorHex = "#" + h.toUpperCase();
        opacity = 100;
      } else if (h.length === 8) {
        colorHex = "#" + h.slice(0, 6).toUpperCase();
        opacity = Math.round((parseInt(h.slice(6, 8), 16) / 255) * 100);
      }
      rest = rest.replace(hexMatch[0], " ").trim();
    } else if (/\bwhite\b/i.test(rest)) {
      colorHex = "#FFFFFF";
      opacity = 100;
      rest = rest.replace(/\bwhite\b/i, " ").trim();
    } else if (/\bblack\b/i.test(rest)) {
      colorHex = "#000000";
      opacity = 100;
      rest = rest.replace(/\bblack\b/i, " ").trim();
    }
  }

  const numTokens = rest.match(/-?\d+(?:\.\d+)?(?:px)?/g) || [];
  const nums = numTokens.map((t) => Math.round(parseFloat(t)));
  return {
    x: nums[0] ?? fallback.x,
    y: nums[1] ?? fallback.y,
    blur: Math.max(0, nums[2] ?? fallback.blur),
    spread: nums[3] ?? 0,
    colorHex,
    opacity
  };
}

export function formatShadowFieldsToCss(fields: ParsedShadowFields, isInner: boolean): string {
  const { r, g, b } = hexToRgbTuple(fields.colorHex);
  const clampedOpacity = Math.max(0, Math.min(100, Math.round(fields.opacity)));
  const alphaStr = clampedOpacity >= 100 ? "1" : clampedOpacity <= 0 ? "0" : (clampedOpacity / 100).toFixed(2);
  const prefix = isInner ? "inset " : "";
  return `${prefix}${Math.round(fields.x)}px ${Math.round(fields.y)}px ${Math.max(0, Math.round(fields.blur))}px ${Math.round(fields.spread)}px rgba(${r},${g},${b},${alphaStr})`;
}

export interface EcmdPlasmicShadowRowProps {
  mode: "outer" | "inner";
  propKey: "outerShadow" | "innerShadow";
  label: string;
  value: string;
  isMixed?: boolean | undefined;
  enabled?: boolean | undefined;
  onToggleEnabled?: ((nextEnabled: boolean) => void) | undefined;
  onChange: (val: string) => void;
  tokenBinding?: EcmdTokenBindingContext | undefined;
}

export function EcmdPlasmicShadowRow({
  mode,
  propKey,
  label,
  value,
  isMixed,
  enabled = true,
  onToggleEnabled,
  onChange,
  tokenBinding
}: EcmdPlasmicShadowRowProps) {
  const isInner = mode === "inner";
  const presets = isInner ? INNER_SHADOW_PRESETS : OUTER_SHADOW_PRESETS;
  const [expanded, setExpanded] = useState(false);
  const [editTokenMode, setEditTokenMode] = useState(false);
  const [editTokenScope, setEditTokenScope] = useState<"all" | "theme">("all");

  const linkedToken = tokenBinding
    ? findDesignTokenById(tokenBinding.tokens, tokenBinding.linkedTokenId)
    : undefined;

  const normVal = (value || "").trim();
  const isRowEnabled = enabled !== false;
  const fields = parseShadowCssToFields(normVal, isInner);
  const { angle: shadowAngle, distance: shadowDistance } = shadowOffsetsToAngleDistance(fields.x, fields.y);

  const emitShadowValue = (nextVal: string) => {
    if (linkedToken && editTokenMode && tokenBinding?.onEditLinkedToken) {
      tokenBinding.onEditLinkedToken(
        linkedToken.id,
        {
          css: nextVal,
          inset: isInner || /\binset\b/i.test(nextVal),
          layers: [
            {
              ...parseShadowCssToFields(nextVal, isInner),
              color: parseShadowCssToFields(nextVal, isInner).colorHex,
              inset: isInner || /\binset\b/i.test(nextVal),
            },
          ],
        },
        editTokenScope
      );
      return;
    }
    onChange(nextVal);
  };

  const matchedPreset = !isMixed
    ? presets.find((p) => p.value.toLowerCase() === (normVal.toLowerCase() === "unset" ? "" : normVal.toLowerCase()))
    : undefined;
  const selectValue = isMixed ? "__MIXED__" : (matchedPreset ? matchedPreset.id : "__CUSTOM__");

  const handlePresetChange = (presetId: string) => {
    if (presetId === "__MIXED__") return;
    if (presetId === "__CUSTOM__") {
      setExpanded(true);
      if (!normVal || /^(unset|none)$/i.test(normVal)) {
        emitShadowValue(formatShadowFieldsToCss(fields, isInner));
      }
      return;
    }
    const found = presets.find((p) => p.id === presetId);
    if (found) {
      emitShadowValue(found.value);
    }
  };

  const updateField = (patch: Partial<ParsedShadowFields>) => {
    const next: ParsedShadowFields = { ...fields, ...patch };
    emitShadowValue(formatShadowFieldsToCss(next, isInner));
  };

  const handleRawChange = (rawInput: string) => {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      emitShadowValue("");
      return;
    }
    if (isInner) {
      // Preserve inset automatically unless user is mid-typing the keyword "inset"
      if (/^i(n(s(e(t)?)?)?)?$/i.test(trimmed)) {
        emitShadowValue(rawInput);
      } else {
        emitShadowValue(ensureInsetShadow(rawInput));
      }
    } else {
      emitShadowValue(rawInput);
    }
  };

  const safeColorHex = /^#[0-9a-fA-F]{6}$/.test(fields.colorHex) ? fields.colorHex : "#000000";

  return (
    <div
      data-ecmd-prop-row={propKey}
      data-ecmd-prop-enabled={isRowEnabled ? "true" : "false"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        padding: "4px 0",
        opacity: isRowEnabled ? 1 : 0.45,
        transition: "opacity 0.15s ease"
      }}
    >
      {/* Compact Header Row: ON/OFF Checkbox + Collapsible Label + 1-Click Preset Selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
        {onToggleEnabled && (
          <input
            type="checkbox"
            checked={isRowEnabled}
            aria-label={`Enable ${label}`}
            data-ecmd-prop-toggle={propKey}
            title={isRowEnabled ? `Turn OFF ${label} (preserves saved values, lets Plasmic Design tab control box-shadow)` : `Turn ON ${label} (restores saved values)`}
            onChange={(e) => onToggleEnabled(e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            style={{ width: "13px", height: "13px", margin: 0, cursor: "pointer", flexShrink: 0, accentColor: "#0D9488" }}
          />
        )}
        <button
          type="button"
          data-ecmd-shadow-expand={propKey}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? `Collapse ${label} builder` : `Expand ${label} visual controls`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "3px",
            width: onToggleEnabled ? "86px" : "98px",
            flexShrink: 0,
            padding: "2px 0",
            border: "none",
            background: "transparent",
            color: "#334155",
            fontSize: "11.5px",
            fontWeight: 500,
            cursor: "pointer",
            textAlign: "left"
          }}
        >
          <span style={{ fontSize: "9px", color: "#64748B", width: "9px", flexShrink: 0 }}>{expanded ? "▾" : "▸"}</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        </button>

        <select
          aria-label={`${label} Preset`}
          data-ecmd-shadow-preset={propKey}
          value={selectValue}
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
            outline: "none"
          }}
        >
          {isMixed && <option value="__MIXED__">Mixed — select preset</option>}
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value="__CUSTOM__">Custom</option>
        </select>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          title={expanded ? "Hide shadow controls" : "Fine-tune X, Y, Blur, Spread, Color & Opacity"}
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
            justifyContent: "center"
          }}
        >
          ⚙
        </button>
      </div>

      {/* Linked Token Pill right on Groups Inspector Row */}
      {linkedToken && (
        <div style={{ marginLeft: "18px", display: "flex", alignItems: "center" }}>
          <EcmdLinkedTokenPill
            token={linkedToken}
            attrTag={propKey}
            onClickPill={() => setExpanded(true)}
            onDetach={() => {
              setEditTokenMode(false);
              tokenBinding?.onDetachToken();
            }}
          />
        </div>
      )}

      {/* Collapsible Visual Shadow Builder */}
      {expanded && (
        <div
          data-ecmd-shadow-panel={propKey}
          style={{
            marginLeft: "18px",
            padding: "8px 9px",
            borderRadius: "8px",
            border: "1px solid #E2E8F0",
            background: "#F8FAFC",
            display: "flex",
            flexDirection: "column",
            gap: "7px"
          }}
        >
          {/* Reusable Box Shadow Tokens Bar */}
          {tokenBinding && (
            <EcmdTokenPopoverSection
              tokens={tokenBinding.tokens}
              compatibleTypes={["boxShadow"]}
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
              defaultTokenName={isInner ? "Recessed Inner Shadow" : "Glass Card Shadow"}
              attrTag={propKey}
            />
          )}

          {/* Angle & Distance Ergonomic Polar Controls */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 8px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
                <span style={{ fontSize: "10px", fontWeight: 600, color: "#475569" }}>Angle (°)</span>
                <input
                  type="number"
                  aria-label={`${label} Angle`}
                  data-ecmd-shadow-input={`${propKey}-angle`}
                  min={0}
                  max={360}
                  value={shadowAngle}
                  onChange={(e) => {
                    const deg = Number(e.target.value);
                    if (!Number.isNaN(deg)) {
                      const nextOffsets = shadowAngleDistanceToOffsets(deg, Math.max(1, shadowDistance));
                      updateField(nextOffsets);
                    }
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{ width: "46px", padding: "2px 4px", fontSize: "10.5px", fontFamily: "ui-monospace, monospace", textAlign: "right", borderRadius: "4px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#0F172A", outline: "none" }}
                />
              </div>
              <input
                type="range"
                aria-label={`${label} Angle Slider`}
                min={0}
                max={360}
                value={shadowAngle}
                onChange={(e) => {
                  const nextOffsets = shadowAngleDistanceToOffsets(Number(e.target.value), Math.max(1, shadowDistance));
                  updateField(nextOffsets);
                }}
                style={{ width: "100%", height: "4px", accentColor: "#0D9488", cursor: "pointer" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
                <span style={{ fontSize: "10px", fontWeight: 600, color: "#475569" }}>Distance (px)</span>
                <input
                  type="number"
                  aria-label={`${label} Distance`}
                  data-ecmd-shadow-input={`${propKey}-distance`}
                  min={0}
                  max={60}
                  value={shadowDistance}
                  onChange={(e) => {
                    const dist = Math.max(0, Number(e.target.value) || 0);
                    const nextOffsets = shadowAngleDistanceToOffsets(shadowAngle, dist);
                    updateField(nextOffsets);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{ width: "46px", padding: "2px 4px", fontSize: "10.5px", fontFamily: "ui-monospace, monospace", textAlign: "right", borderRadius: "4px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#0F172A", outline: "none" }}
                />
              </div>
              <input
                type="range"
                aria-label={`${label} Distance Slider`}
                min={0}
                max={60}
                value={Math.min(60, shadowDistance)}
                onChange={(e) => {
                  const nextOffsets = shadowAngleDistanceToOffsets(shadowAngle, Number(e.target.value));
                  updateField(nextOffsets);
                }}
                style={{ width: "100%", height: "4px", accentColor: "#0D9488", cursor: "pointer" }}
              />
            </div>
          </div>

          {/* Compact 2x2 X / Y / Blur / Spread Numeric + Slider Controls */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 8px" }}>
            {(
              [
                { key: "x", label: "X (px)", min: -50, max: 50, val: fields.x },
                { key: "y", label: "Y (px)", min: -50, max: 50, val: fields.y },
                { key: "blur", label: "Blur (px)", min: 0, max: 80, val: fields.blur },
                { key: "spread", label: "Spread (px)", min: -30, max: 40, val: fields.spread }
              ] as const
            ).map((ctrl) => (
              <div key={ctrl.key} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 600, color: "#475569" }}>{ctrl.label}</span>
                  <input
                    type="number"
                    aria-label={`${label} ${ctrl.label}`}
                    data-ecmd-shadow-input={`${propKey}-${ctrl.key}`}
                    min={ctrl.min}
                    max={ctrl.max}
                    value={ctrl.val}
                    onChange={(e) => {
                      const num = Number(e.target.value);
                      if (!Number.isNaN(num)) updateField({ [ctrl.key]: num });
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
                      outline: "none"
                    }}
                  />
                </div>
                <input
                  type="range"
                  aria-label={`${label} ${ctrl.label} Slider`}
                  min={ctrl.min}
                  max={ctrl.max}
                  value={Math.max(ctrl.min, Math.min(ctrl.max, ctrl.val))}
                  onChange={(e) => updateField({ [ctrl.key]: Number(e.target.value) })}
                  style={{ width: "100%", height: "4px", accentColor: "#0D9488", cursor: "pointer" }}
                />
              </div>
            ))}
          </div>

          {/* Color (#HEX Picker + Text Input) & Opacity (%) Controls */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 8px", alignItems: "end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "10px", fontWeight: 600, color: "#475569" }}>Color (#HEX)</span>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "2px 4px", borderRadius: "5px", border: "1px solid #CBD5E1", background: "#FFFFFF" }}>
                <input
                  type="color"
                  aria-label={`${label} Color Picker`}
                  value={safeColorHex}
                  onChange={(e) => updateField({ colorHex: e.target.value.toUpperCase() })}
                  style={{ width: "20px", height: "18px", padding: 0, border: "none", background: "transparent", cursor: "pointer", flexShrink: 0 }}
                />
                <input
                  type="text"
                  aria-label={`${label} Color Hex`}
                  data-ecmd-shadow-input={`${propKey}-color`}
                  value={fields.colorHex}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
                      updateField({ colorHex: v.toUpperCase() });
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
                    outline: "none"
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px" }}>
                <span style={{ fontSize: "10px", fontWeight: 600, color: "#475569" }}>Opacity (%)</span>
                <input
                  type="number"
                  aria-label={`${label} Opacity (%)`}
                  data-ecmd-shadow-input={`${propKey}-opacity`}
                  min={0}
                  max={100}
                  value={fields.opacity}
                  onChange={(e) => {
                    const num = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                    updateField({ opacity: num });
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
                    outline: "none"
                  }}
                />
              </div>
              <input
                type="range"
                aria-label={`${label} Opacity Slider`}
                min={0}
                max={100}
                value={fields.opacity}
                onChange={(e) => updateField({ opacity: Number(e.target.value) })}
                style={{ width: "100%", height: "4px", accentColor: "#0D9488", cursor: "pointer" }}
              />
            </div>
          </div>

          {/* Optional Raw CSS Override Input (supports multi-layer syntax; preserves inset for Inner Shadow) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "10px", fontWeight: 600, color: "#64748B" }}>
                Raw CSS {isInner ? "(inset enforced)" : "(multi-layer supported)"}
              </span>
              {normVal && (
                <button
                  type="button"
                  onClick={() => onChange("")}
                  style={{ border: "none", background: "transparent", color: "#DC2626", fontSize: "10px", fontWeight: 600, cursor: "pointer", padding: 0 }}
                >
                  Clear
                </button>
              )}
            </div>
            <input
              type="text"
              aria-label={`${label} Raw CSS`}
              data-ecmd-shadow-input={`${propKey}-raw`}
              value={isMixed ? "" : value}
              placeholder={isMixed ? "Mixed" : (isInner ? "inset 0px 2px 4px 0px rgba(0,0,0,0.25)" : "0px 4px 12px 0px rgba(0,0,0,0.18)")}
              onChange={(e) => handleRawChange(e.target.value)}
              onBlur={(e) => {
                if (isInner && e.target.value.trim()) {
                  onChange(ensureInsetShadow(e.target.value));
                }
              }}
              onKeyDown={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "4px 6px",
                fontSize: "10.5px",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                borderRadius: "5px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#0F172A",
                outline: "none"
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}