import React, { useEffect, useRef } from "react";
import {
  useEcmdBreakpoint,
  classifyBreakpointFromWidth,
  computeEcmdBreakpointState,
  type EcmdViewportMode,
} from "./useEcmdBreakpoint";

export const ALLOWED_PLASMIC_TOKEN_TYPES = new Set([
  "color",
  "spacing",
  "opacity",
  "line-height",
  "font-size",
  "font-family",
] as const);

export type AllowedPlasmicTokenType =
  | "color"
  | "spacing"
  | "opacity"
  | "line-height"
  | "font-size"
  | "font-family";

export interface RuntimeErrorEntry {
  id: string;
  kind: "error" | "unhandledrejection";
  message: string;
  source: string;
  line?: number | null;
  column?: number | null;
  stackPreview: string;
  url: string;
  artboardTag: string;
  viewportMode: EcmdViewportMode;
  timestamp: string;
  count: number;
}

export interface RuntimeErrorsStore {
  updatedAt: string | null;
  totalCount: number;
  errors: RuntimeErrorEntry[];
}

export interface EcmdRegisteredComponentMeta {
  name: string;
  displayName: string;
  importPath: string;
  propNames: string[];
  slotNames: string[];
}

export const ECMD_REGISTERED_COMPONENTS: EcmdRegisteredComponentMeta[] = [];

export interface SerializedRect {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface SerializedBoxModel {
  // Sizing
  width: string;
  height: string;
  minWidth: string;
  maxWidth: string;
  minHeight: string;
  maxHeight: string;
  boxSizing: string;
  aspectRatio: string;
  // Spacing & Gaps
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  gap: string;
  rowGap: string;
  columnGap: string;
  // Layout & Visuals
  display: string;
  flexDirection: string;
  flexWrap: string;
  flexGrow: string;
  flexShrink: string;
  flexBasis: string;
  alignItems: string;
  justifyContent: string;
  gridTemplateColumns: string;
  position: string;
  overflowX: string;
  overflowY: string;
  backgroundColor: string;
  color: string;
  borderColor: string;
  borderWidth: string;
  borderRadius: string;
  boxShadow: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  textAlign: string;
  opacity: string;
}

export interface SerializedDomNode {
  tag: string;
  id: string | null;
  className: string;
  textPreview: string;
  ecmdAttrs: Record<string, string>;
  ariaAttrs: Record<string, string>;
  disabled: boolean;
  matchedThemeGroups: string[];
  rect: SerializedRect;
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
  boxModel: SerializedBoxModel;
  repeatedCount?: number;
  children: SerializedDomNode[];
}

export type CanvasDiagnosticCode =
  | "MISSING_SIBLING_HOOK"
  | "HORIZONTAL_OVERFLOW"
  | "COLLAPSED_ZERO_SIZE"
  | "BROKEN_IMAGE";

export type CanvasDiagnosticSeverityTier = "critical" | "layout";

export interface CanvasDiagnostic {
  id: string;
  code: CanvasDiagnosticCode;
  severity: "warning" | "error";
  severityTier: CanvasDiagnosticSeverityTier;
  breakpoint: EcmdViewportMode;
  componentName: string;
  artboardTag: string;
  viewportMode: EcmdViewportMode;
  element: string;
  message: string;
  fixHint: string;
  detectedAt: string;
}

export function getDiagnosticBreakpoint(d: Partial<CanvasDiagnostic>): EcmdViewportMode {
  if (d.breakpoint === "desktop" || d.breakpoint === "tablet" || d.breakpoint === "mobile") {
    return d.breakpoint;
  }
  const tag = String(d.artboardTag || "");
  const widthMatch = tag.match(/(\d+)$/);
  if (widthMatch && widthMatch[1]) {
    return classifyBreakpointFromWidth(Number(widthMatch[1]));
  }
  if (d.viewportMode === "desktop" || d.viewportMode === "tablet" || d.viewportMode === "mobile") {
    return d.viewportMode;
  }
  if (tag.startsWith("mobile")) return "mobile";
  if (tag.startsWith("tablet")) return "tablet";
  return "desktop";
}

export function getDiagnosticSeverityTier(
  d: Partial<CanvasDiagnostic>
): CanvasDiagnosticSeverityTier {
  if (d.severityTier === "critical" || d.severityTier === "layout") {
    return d.severityTier;
  }
  if (d.code === "MISSING_SIBLING_HOOK" || d.code === "BROKEN_IMAGE") {
    return "critical";
  }
  return "layout";
}

export interface LiveComponentTelemetryPayload {
  componentName: string;
  displayName: string;
  artboardTag: string;
  viewportMode: EcmdViewportMode;
  viewportWidthPx: number;
  updatedAt: string;
  snapshot: SerializedDomNode | null;
  diagnostics: CanvasDiagnostic[];
}

let boundPlasmicLoader: any = null;

export function bindEcmdPlasmicLoader(loader: any) {
  boundPlasmicLoader = loader;
}

/**
 * Strict interactive sibling-hook allowlist:
 * - NEVER checks content/slot-binding attributes (data-ecmd-pkg, data-ecmd-field, data-ecmd-slot,
 *   data-ecmd-viewport, data-ecmd-selected, data-plasmic-*) so plain layout <div> stacks next to
 *   bound text nodes never produce false positives.
 * - ONLY inspects interactive action/control hooks on interactive sibling elements
 *   (button, a, input, select, [role="button"], [role="tab"]).
 */
const INTERACTIVE_SIBLING_TAGS = new Set(["button", "a", "input", "select"]);

const INTERACTIVE_ACTION_HOOK_ATTRS = new Set([
  "data-ecmd-scope-btn",
  "data-ecmd-vehicle-slot",
  "data-ecmd-auth-action",
  "data-ecmd-tab",
  "data-ecmd-action",
  "data-ecmd-action-desktop",
  "data-ecmd-action-tablet",
  "data-ecmd-action-mobile",
]);

function getInteractiveSiblingGroupKey(el: HTMLElement): string | null {
  const tag = el.tagName.toLowerCase();
  if (INTERACTIVE_SIBLING_TAGS.has(tag)) return tag;
  const role = (el.getAttribute("role") || "").trim().toLowerCase();
  if (role === "button" || role === "tab") return `role:${role}`;
  return null;
}

function resolveBreakpointForDiagnostics(meta: {
  viewportMode: EcmdViewportMode;
  artboardTag: string;
  viewportWidthPx?: number;
}): EcmdViewportMode {
  if (typeof meta.viewportWidthPx === "number" && Number.isFinite(meta.viewportWidthPx)) {
    return classifyBreakpointFromWidth(meta.viewportWidthPx);
  }
  const m = String(meta.artboardTag || "").match(/(\d+)$/);
  if (m && m[1]) {
    return classifyBreakpointFromWidth(Number(m[1]));
  }
  return meta.viewportMode;
}

const KNOWN_THEME_GROUP_PATTERNS: Array<{ label: string; test: (el: Element) => boolean }> = [
  { label: ".ecmd-group-1", test: (el) => el.classList.contains("ecmd-group-1") },
  { label: ".ecmd-group-2", test: (el) => el.classList.contains("ecmd-group-2") },
  { label: ".ecmd-group-3", test: (el) => el.classList.contains("ecmd-group-3") },
  { label: ".ecmd-group-4", test: (el) => el.classList.contains("ecmd-group-4") },
  { label: ".modals", test: (el) => el.classList.contains("modals") },
  { label: ".text-buttons-dark", test: (el) => el.classList.contains("text-buttons-dark") },
  { label: ".side-menu", test: (el) => el.classList.contains("side-menu") },
];

function getMatchedThemeGroups(el: Element): string[] {
  const matched = new Set<string>();
  for (const cls of Array.from(el.classList)) {
    if (/^ecmd-group-\d+$/.test(cls)) {
      matched.add(`.${cls}`);
    }
  }
  for (const pattern of KNOWN_THEME_GROUP_PATTERNS) {
    try {
      if (pattern.test(el)) matched.add(pattern.label);
    } catch {
      // ignore
    }
  }
  return Array.from(matched);
}

function getElementLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const classes =
    typeof (el as HTMLElement).className === "string"
      ? (el as HTMLElement).className
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((c) => `.${c}`)
          .join("")
      : "";
  const text = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 36);
  return `${tag}${id}${classes}${text ? ` ("${text}")` : ""}`;
}

function extractDirectTextPreview(el: Element): string {
  let direct = "";
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3) {
      direct += node.textContent || "";
    }
  }
  const cleanDirect = direct.replace(/\s+/g, " ").trim();
  if (cleanDirect) return cleanDirect.slice(0, 120);
  return (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function readBoxModel(cs: CSSStyleDeclaration): SerializedBoxModel {
  return {
    width: cs.width || "",
    height: cs.height || "",
    minWidth: cs.minWidth || "",
    maxWidth: cs.maxWidth || "",
    minHeight: cs.minHeight || "",
    maxHeight: cs.maxHeight || "",
    boxSizing: cs.boxSizing || "",
    aspectRatio: (cs as any).aspectRatio || "",
    paddingTop: cs.paddingTop || "",
    paddingRight: cs.paddingRight || "",
    paddingBottom: cs.paddingBottom || "",
    paddingLeft: cs.paddingLeft || "",
    marginTop: cs.marginTop || "",
    marginRight: cs.marginRight || "",
    marginBottom: cs.marginBottom || "",
    marginLeft: cs.marginLeft || "",
    gap: cs.gap || "",
    rowGap: cs.rowGap || "",
    columnGap: cs.columnGap || "",
    display: cs.display || "",
    flexDirection: cs.flexDirection || "",
    flexWrap: cs.flexWrap || "",
    flexGrow: cs.flexGrow || "",
    flexShrink: cs.flexShrink || "",
    flexBasis: cs.flexBasis || "",
    alignItems: cs.alignItems || "",
    justifyContent: cs.justifyContent || "",
    gridTemplateColumns: cs.gridTemplateColumns || "",
    position: cs.position || "",
    overflowX: cs.overflowX || "",
    overflowY: cs.overflowY || "",
    backgroundColor: cs.backgroundColor || "",
    color: cs.color || "",
    borderColor: cs.borderColor || "",
    borderWidth: cs.borderWidth || "",
    borderRadius: cs.borderRadius || "",
    boxShadow: cs.boxShadow || "",
    fontSize: cs.fontSize || "",
    fontWeight: cs.fontWeight || "",
    lineHeight: cs.lineHeight || "",
    textAlign: cs.textAlign || "",
    opacity: cs.opacity || "",
  };
}

function isRepeaterContainer(el: Element): boolean {
  if (el.id === "packagesRep" || el.classList.contains("ecmd-packages-repeater-container")) {
    return true;
  }
  const childCards = Array.from(el.children).filter((c) => c.classList.contains("ecmd-package-card"));
  return childCards.length > 1;
}

const SKIP_SERIALIZE_TAGS = new Set(["script", "style", "noscript"]);
const SKIP_ZERO_SIZE_TAGS = new Set([
  "script",
  "style",
  "noscript",
  "meta",
  "link",
  "br",
  "wbr",
  "path",
  "circle",
  "rect",
  "line",
  "polygon",
  "polyline",
  "defs",
  "lineargradient",
  "stop",
]);

export function serializeLiveDomTree(
  rootEl: HTMLElement,
  maxDepth = 12,
  maxNodes = 160
): SerializedDomNode {
  let visited = 0;

  const walk = (el: HTMLElement, depth: number): SerializedDomNode => {
    visited++;
    const tag = el.tagName.toLowerCase();
    const cs = window.getComputedStyle(el);
    const rectRaw = el.getBoundingClientRect();

    const ecmdAttrs: Record<string, string> = {};
    const ariaAttrs: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith("data-ecmd-")) {
        ecmdAttrs[attr.name] = attr.value;
      } else if (attr.name.startsWith("aria-")) {
        ariaAttrs[attr.name] = attr.value;
      }
    }

    const disabled =
      el.hasAttribute("disabled") ||
      el.getAttribute("aria-disabled") === "true" ||
      (el as HTMLButtonElement).disabled === true;

    const children: SerializedDomNode[] = [];
    let repeatedCount: number | undefined;

    if (depth < maxDepth && visited < maxNodes) {
      const elChildren = Array.from(el.children).filter(
        (c): c is HTMLElement =>
          c instanceof HTMLElement &&
          !SKIP_SERIALIZE_TAGS.has(c.tagName.toLowerCase()) &&
          !c.hasAttribute("data-ecmd-telemetry-marker")
      );

      // Repeater Card-1 Deduplication: inspect Card #1 only + record repeatedCount
      if (isRepeaterContainer(el) && elChildren.length > 1) {
        repeatedCount = elChildren.length;
        const firstCard = elChildren[0];
        if (firstCard && visited < maxNodes) {
          children.push(walk(firstCard, depth + 1));
        }
      } else {
        for (const child of elChildren) {
          if (visited >= maxNodes) break;
          if (child.getAttribute("data-ecmd-pkg") === "active-context") continue;
          children.push(walk(child, depth + 1));
        }
      }
    }

    const node: SerializedDomNode = {
      tag,
      id: el.id || null,
      className: typeof el.className === "string" ? el.className.trim() : "",
      textPreview: extractDirectTextPreview(el),
      ecmdAttrs,
      ariaAttrs,
      disabled,
      matchedThemeGroups: getMatchedThemeGroups(el),
      rect: {
        width: Math.round(rectRaw.width),
        height: Math.round(rectRaw.height),
        x: Math.round(rectRaw.x),
        y: Math.round(rectRaw.y),
      },
      scrollWidth: Math.round(el.scrollWidth || 0),
      clientWidth: Math.round(el.clientWidth || 0),
      scrollHeight: Math.round(el.scrollHeight || 0),
      clientHeight: Math.round(el.clientHeight || 0),
      boxModel: readBoxModel(cs),
      children,
    };

    if (repeatedCount !== undefined) {
      node.repeatedCount = repeatedCount;
    }

    return node;
  };

  return walk(rootEl, 0);
}

function makeDiagId(componentName: string, artboardTag: string, code: CanvasDiagnosticCode, key: string): string {
  return `${componentName}::${artboardTag}::${code}::${key}`
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .slice(0, 140);
}

function isHiddenNode(el: HTMLElement, cs: CSSStyleDeclaration): boolean {
  if (el.hasAttribute("hidden")) return true;
  if (el.getAttribute("data-ecmd-pkg") === "active-context") return true;
  if (cs.display === "none" || cs.visibility === "hidden") return true;
  return false;
}

/**
 * Automatic Box-Model, Overflow, Collapsed Node, Broken Image, and Missing Sibling Hook Linter.
 */
export function runCanvasDiagnostics(
  rootEl: HTMLElement,
  meta: {
    componentName: string;
    artboardTag: string;
    viewportMode: EcmdViewportMode;
    viewportWidthPx?: number;
  }
): CanvasDiagnostic[] {
  const diagnostics: CanvasDiagnostic[] = [];
  const seenIds = new Set<string>();
  const detectedAt = new Date().toISOString();
  const resolvedBreakpoint = resolveBreakpointForDiagnostics(meta);

  const pushDiag = (diag: Omit<CanvasDiagnostic, "detectedAt">) => {
    if (seenIds.has(diag.id)) return;
    seenIds.add(diag.id);
    diagnostics.push({ ...diag, detectedAt });
  };

  const inspect = (el: HTMLElement, insideHidden: boolean) => {
    const tag = el.tagName.toLowerCase();
    if (SKIP_SERIALIZE_TAGS.has(tag)) return;

    const cs = window.getComputedStyle(el);
    const hiddenHere = insideHidden || isHiddenNode(el, cs);
    if (hiddenHere) return;

    const label = getElementLabel(el);

    // (a) Missing Sibling Interactive Action/Control Hooks (CRITICAL)
    // Strictly checks interactive siblings (button, a, input, select, [role="button"], [role="tab"])
    // for interactive action/control hooks ONLY — never content/slot-binding attributes like data-ecmd-pkg!
    const elChildren = Array.from(el.children).filter(
      (c): c is HTMLElement =>
        c instanceof HTMLElement &&
        !SKIP_SERIALIZE_TAGS.has(c.tagName.toLowerCase()) &&
        !c.hasAttribute("data-ecmd-telemetry-marker")
    );
    if (elChildren.length >= 3) {
      const byInteractiveKey = new Map<string, HTMLElement[]>();
      for (const child of elChildren) {
        const groupKey = getInteractiveSiblingGroupKey(child);
        if (!groupKey) continue;
        const list = byInteractiveKey.get(groupKey) || [];
        list.push(child);
        byInteractiveKey.set(groupKey, list);
      }

      for (const [groupKey, siblings] of byInteractiveKey.entries()) {
        if (siblings.length < 3) continue; // need >= 2 with hook and >= 1 missing
        const attrCounts = new Map<string, number>();
        for (const sib of siblings) {
          for (const attr of Array.from(sib.attributes)) {
            if (INTERACTIVE_ACTION_HOOK_ATTRS.has(attr.name)) {
              attrCounts.set(attr.name, (attrCounts.get(attr.name) || 0) + 1);
            }
          }
        }

        const displayTag = groupKey.startsWith("role:") ? `[${groupKey.replace(":", '="')}"]` : `<${groupKey}>`;

        for (const [hookAttr, count] of attrCounts.entries()) {
          if (count >= 2 && count < siblings.length) {
            for (const sib of siblings) {
              if (!sib.hasAttribute(hookAttr)) {
                const sibLabel = getElementLabel(sib);
                pushDiag({
                  id: makeDiagId(meta.componentName, meta.artboardTag, "MISSING_SIBLING_HOOK", `${hookAttr}:${sibLabel}`),
                  code: "MISSING_SIBLING_HOOK",
                  severity: "error",
                  severityTier: "critical",
                  breakpoint: resolvedBreakpoint,
                  componentName: meta.componentName,
                  artboardTag: meta.artboardTag,
                  viewportMode: resolvedBreakpoint,
                  element: sibLabel,
                  message: `Sibling ${displayTag} ${sibLabel} is missing "${hookAttr}" while ${count} of ${siblings.length} sibling ${displayTag} elements have it.`,
                  fixHint: `In Plasmic Studio, select ${sibLabel} and add HTML attribute "${hookAttr}" to match its siblings.`,
                });
              }
            }
          }
        }
      }
    }

    // (b) Horizontal Overflow / Clipping (LAYOUT)
    const overflowX = cs.overflowX || "visible";
    const isScrollableX = overflowX === "auto" || overflowX === "scroll";
    if (!isScrollableX && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2) {
      const diff = Math.round(el.scrollWidth - el.clientWidth);
      pushDiag({
        id: makeDiagId(meta.componentName, meta.artboardTag, "HORIZONTAL_OVERFLOW", label),
        code: "HORIZONTAL_OVERFLOW",
        severity: "warning",
        severityTier: "layout",
        breakpoint: resolvedBreakpoint,
        componentName: meta.componentName,
        artboardTag: meta.artboardTag,
        viewportMode: resolvedBreakpoint,
        element: label,
        message: `Horizontal overflow detected (+${diff}px: scrollWidth=${Math.round(el.scrollWidth)}px > clientWidth=${Math.round(el.clientWidth)}px, overflowX="${overflowX}").`,
        fixHint: `Set maxWidth: "100%", flexWrap: "wrap", or overflowX: "auto" on ${label} (or adjust tabletOrientation / mobileOrientation / Fluid Auto-Scale for ${meta.artboardTag}).`,
      });
    }

    // (c) Collapsed Zero-Size Visible Nodes (LAYOUT)
    if (!SKIP_ZERO_SIZE_TAGS.has(tag) && cs.display !== "contents" && cs.opacity !== "0") {
      const rect = el.getBoundingClientRect();
      const hasContent =
        Boolean((el.textContent || "").trim()) ||
        elChildren.some((c) => !isHiddenNode(c, window.getComputedStyle(c)));
      if (hasContent && (Math.round(rect.width) === 0 || Math.round(rect.height) === 0)) {
        pushDiag({
          id: makeDiagId(meta.componentName, meta.artboardTag, "COLLAPSED_ZERO_SIZE", label),
          code: "COLLAPSED_ZERO_SIZE",
          severity: "warning",
          severityTier: "layout",
          breakpoint: resolvedBreakpoint,
          componentName: meta.componentName,
          artboardTag: meta.artboardTag,
          viewportMode: resolvedBreakpoint,
          element: label,
          message: `Visible node ${label} has collapsed zero size (${Math.round(rect.width)}x${Math.round(rect.height)}px) despite containing text/children.`,
          fixHint: `Check parent flex/grid sizing, minWidth/minHeight, or explicit width/height on ${label}.`,
        });
      }
    }

    // (d) Broken <img> sources (CRITICAL)
    if (tag === "img") {
      const img = el as HTMLImageElement;
      const src = (img.getAttribute("src") || "").trim();
      const isBroken = (img.complete && img.naturalWidth === 0) || !src || /fakeimg\.pl/i.test(src);
      if (isBroken) {
        pushDiag({
          id: makeDiagId(meta.componentName, meta.artboardTag, "BROKEN_IMAGE", `${label}:${src.slice(0, 40)}`),
          code: "BROKEN_IMAGE",
          severity: "error",
          severityTier: "critical",
          breakpoint: resolvedBreakpoint,
          componentName: meta.componentName,
          artboardTag: meta.artboardTag,
          viewportMode: resolvedBreakpoint,
          element: label,
          message: `Broken or empty <img> source detected${src ? ` (src="${src.slice(0, 80)}")` : " (missing src)"}.`,
          fixHint: `Replace the image src on ${label} with a valid uploaded asset or inline SVG data URI.`,
        });
      }
    }

    // Walk children (deduplicate repeater cards to Card #1)
    if (isRepeaterContainer(el) && elChildren.length > 1) {
      const firstCard = elChildren[0];
      if (firstCard) inspect(firstCard, false);
    } else {
      for (const child of elChildren) {
        inspect(child, false);
      }
    }
  };

  inspect(rootEl, false);
  return diagnostics;
}

function quickHash(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function getTelemetryEndpoint(): string {
  if (typeof window !== "undefined") {
    try {
      const host = window.location?.hostname || "";
      const port = window.location?.port || "";
      if ((host === "localhost" || host === "127.0.0.1") && (port === "8080" || !port)) {
        return "/__ecmd-live-dom";
      }
    } catch {
      // fallback below
    }
  }
  return "http://localhost:8080/__ecmd-live-dom";
}

function getRuntimeErrorEndpoint(): string {
  if (typeof window !== "undefined") {
    try {
      const host = window.location?.hostname || "";
      const port = window.location?.port || "";
      if ((host === "localhost" || host === "127.0.0.1") && (port === "8080" || !port)) {
        return "/__ecmd-runtime-error";
      }
    } catch {
      // fallback below
    }
  }
  return "http://localhost:8080/__ecmd-runtime-error";
}

function makeRuntimeErrorDedupKey(message: string, source: string): string {
  return `${message.trim()}::${source.trim()}`.toLowerCase().slice(0, 240);
}

function extractStackPreview(err: unknown, fallback = ""): string {
  if (err && typeof err === "object" && "stack" in err && typeof (err as any).stack === "string") {
    return (err as any).stack.split("\n").slice(0, 6).join("\n").slice(0, 700);
  }
  return fallback.slice(0, 700);
}

const recentRuntimeErrorsSentAt = new Map<string, number>();

function forwardRuntimeErrorPayload(entry: Omit<RuntimeErrorEntry, "id" | "count">): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  const dedupKey = makeRuntimeErrorDedupKey(entry.message, entry.source);
  const now = Date.now();
  const lastSent = recentRuntimeErrorsSentAt.get(dedupKey) || 0;
  if (now - lastSent < 1500) return;
  recentRuntimeErrorsSentAt.set(dedupKey, now);

  const payload: RuntimeErrorEntry = {
    ...entry,
    id: `rt::${quickHash(dedupKey)}`,
    count: 1,
  };

  try {
    const fetchInit: RequestInit = {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    };
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      fetchInit.signal = AbortSignal.timeout(8000);
    }
    fetch(getRuntimeErrorEndpoint(), fetchInit)
      .then(() => {
        window.dispatchEvent(new CustomEvent("ecmd:runtime-errors-updated"));
      })
      .catch(() => {
        // Silent if Vite dev server is unreachable
      });
  } catch {
    // ignore
  }
}

/**
 * DEV-ONLY direct runtime error forwarder for synchronous host-boot / registration exceptions
 * (e.g., src/plasmic-init.ts) so http://localhost:8080/errors always captures them.
 */
export function reportEcmdRuntimeError(
  err: unknown,
  source = "plasmic-init",
  kind: "error" | "unhandledrejection" = "error"
): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  const width = window.innerWidth || document.documentElement?.clientWidth || 1440;
  const bp = computeEcmdBreakpointState(width);
  const message =
    err instanceof Error
      ? err.message || err.name
      : typeof err === "string"
      ? err
      : (() => {
          try {
            return JSON.stringify(err);
          } catch {
            return String(err || "Host registration error");
          }
        })();
  const cleanMessage = String(message || "Host registration error").trim().slice(0, 400);
  if (!cleanMessage) return;

  forwardRuntimeErrorPayload({
    kind,
    message: cleanMessage,
    source: String(source || "plasmic-init").slice(0, 260),
    line: null,
    column: null,
    stackPreview: extractStackPreview(err, `${cleanMessage} at ${source}`),
    url: window.location?.href || "",
    artboardTag: bp.artboardTag,
    viewportMode: bp.viewportMode,
    timestamp: new Date().toISOString(),
  });
}

/**
 * DEV-ONLY Global Runtime Error & Unhandled Promise Rejection Capture Bridge.
 * Zero production overhead (!import.meta.env.DEV returns immediately).
 */
export function installEcmdRuntimeErrorBridge(): void {
  if (!import.meta.env.DEV || typeof window === "undefined") return;
  const win = window as any;
  if (win.__ecmdRuntimeErrorBridgeInstalled) return;
  win.__ecmdRuntimeErrorBridgeInstalled = true;

  window.addEventListener("error", (event: ErrorEvent) => {
    const width = window.innerWidth || document.documentElement?.clientWidth || 1440;
    const bp = computeEcmdBreakpointState(width);
    const message = String(event.message || event.error?.message || "Uncaught runtime error").trim();
    if (!message) return;
    const sourceFile = String(event.filename || window.location?.pathname || "unknown");
    const source = event.lineno ? `${sourceFile}:${event.lineno}${event.colno ? `:${event.colno}` : ""}` : sourceFile;
    forwardRuntimeErrorPayload({
      kind: "error",
      message: message.slice(0, 400),
      source: source.slice(0, 260),
      line: typeof event.lineno === "number" ? event.lineno : null,
      column: typeof event.colno === "number" ? event.colno : null,
      stackPreview: extractStackPreview(event.error, `${message} at ${source}`),
      url: window.location?.href || "",
      artboardTag: bp.artboardTag,
      viewportMode: bp.viewportMode,
      timestamp: new Date().toISOString(),
    });
  });

  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    const width = window.innerWidth || document.documentElement?.clientWidth || 1440;
    const bp = computeEcmdBreakpointState(width);
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message || reason.name
        : typeof reason === "string"
        ? reason
        : (() => {
            try {
              return JSON.stringify(reason);
            } catch {
              return String(reason || "Unhandled promise rejection");
            }
          })();
    const stackPreview = extractStackPreview(reason, String(message || ""));
    const firstFrame = stackPreview
      .split("\n")
      .slice(1)
      .map((l) => l.trim())
      .find(Boolean);
    const source = firstFrame ? firstFrame.slice(0, 220) : `unhandledrejection@${window.location?.pathname || "/"}`;

    forwardRuntimeErrorPayload({
      kind: "unhandledrejection",
      message: String(message || "Unhandled promise rejection").slice(0, 400),
      source,
      line: null,
      column: null,
      stackPreview,
      url: window.location?.href || "",
      artboardTag: bp.artboardTag,
      viewportMode: bp.viewportMode,
      timestamp: new Date().toISOString(),
    });
  });
}

function DevTelemetryObserver({
  componentName,
  displayName,
  Component,
  componentProps,
}: {
  componentName: string;
  displayName: string;
  Component: React.ComponentType<any>;
  componentProps: Record<string, any>;
}) {
  const markerRef = useRef<HTMLSpanElement>(null);
  const lastHashRef = useRef<string>("");
  const mobileBpRaw = componentProps?.["mobileBreakpointPx"];
  const mobileBp = typeof mobileBpRaw === "number" ? mobileBpRaw : 768;
  const tabletBpRaw = componentProps?.["tabletBreakpointPx"];
  const tabletBp = typeof tabletBpRaw === "number" ? tabletBpRaw : 1024;
  const bp = useEcmdBreakpoint(mobileBp, tabletBp);

  useEffect(() => {
    if (typeof window === "undefined") return;
    installEcmdRuntimeErrorBridge();
    const marker = markerRef.current;
    if (!marker) return;

    const getObservedRoot = (): HTMLElement | null => {
      let prev = marker.previousElementSibling as HTMLElement | null;
      while (prev) {
        if (prev.hasAttribute("data-ecmd-telemetry-marker")) {
          return null;
        }
        if (!SKIP_SERIALIZE_TAGS.has(prev.tagName.toLowerCase())) {
          return prev;
        }
        prev = prev.previousElementSibling as HTMLElement | null;
      }
      return null;
    };

    const stampViewportAttr = () => {
      const target = getObservedRoot();
      if (!target) return;
      if (target.getAttribute("data-ecmd-viewport") !== bp.viewportMode) {
        target.setAttribute("data-ecmd-viewport", bp.viewportMode);
      }
      if (target.getAttribute("data-ecmd-component") !== componentName) {
        target.setAttribute("data-ecmd-component", componentName);
      }
    };

    stampViewportAttr();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let idleHandle: number | null = null;
    let cancelled = false;

    const captureAndSend = (force = false) => {
      if (cancelled) return;
      const target = getObservedRoot();
      if (!target) return;

      stampViewportAttr();

      const snapshot = serializeLiveDomTree(target);
      const diagnostics = runCanvasDiagnostics(target, {
        componentName,
        artboardTag: bp.artboardTag,
        viewportMode: bp.viewportMode,
        viewportWidthPx: bp.viewportWidthPx,
      });

      const hash = quickHash(
        JSON.stringify({
          artboardTag: bp.artboardTag,
          snapshot,
          diagnostics: diagnostics.map((d) => ({ id: d.id, message: d.message })),
        })
      );

      if (!force && hash === lastHashRef.current) return;
      lastHashRef.current = hash;

      const payload: LiveComponentTelemetryPayload = {
        componentName,
        displayName,
        artboardTag: bp.artboardTag,
        viewportMode: bp.viewportMode,
        viewportWidthPx: bp.viewportWidthPx,
        updatedAt: new Date().toISOString(),
        snapshot,
        diagnostics,
      };

      fetch(getTelemetryEndpoint(), {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      }).catch(() => {
        // Silent in dev if localhost:8080 dev server isn't reachable
      });
    };

    const scheduleCapture = (force = false) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (cancelled) return;
        const rIC = (window as any).requestIdleCallback;
        if (typeof rIC === "function") {
          idleHandle = rIC(() => captureAndSend(force), { timeout: 1500 });
        } else {
          captureAndSend(force);
        }
      }, force ? 20 : 800);
    };

    scheduleCapture(false);

    const observedRoot = getObservedRoot();
    const mo = new MutationObserver(() => {
      stampViewportAttr();
      scheduleCapture(false);
    });
    if (observedRoot) {
      mo.observe(observedRoot, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    } else if (marker.parentElement) {
      mo.observe(marker.parentElement, {
        childList: true,
      });
    }

    let ro: ResizeObserver | null = null;
    if (observedRoot && typeof ResizeObserver !== "undefined") {
      try {
        ro = new ResizeObserver(() => scheduleCapture(false));
        ro.observe(observedRoot);
      } catch {
        // ignore
      }
    }

    const onSnapshotNow = () => scheduleCapture(true);
    window.addEventListener("ecmd:snapshot-now", onSnapshotNow);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        bc = new BroadcastChannel("ecmd-live-dom");
        bc.onmessage = (evt) => {
          if (evt?.data?.type === "snapshot-now") {
            scheduleCapture(true);
          }
        };
      } catch {
        // ignore
      }
    }

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (idleHandle !== null && typeof (window as any).cancelIdleCallback === "function") {
        (window as any).cancelIdleCallback(idleHandle);
      }
      mo.disconnect();
      if (ro) ro.disconnect();
      window.removeEventListener("ecmd:snapshot-now", onSnapshotNow);
      if (bc) bc.close();
    };
  }, [componentName, displayName, bp.artboardTag, bp.viewportMode, bp.viewportWidthPx]);

  // Render <Component {...componentProps} /> directly with ZERO wrapper <div> or display:contents
  // so DEV and PROD share the exact same single DOM box-model and Plasmic Studio's className/style
  // (width, maxWidth, margin, alignSelf) apply directly to the component's root sizing box.
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Component, componentProps),
    React.createElement("span", {
      ref: markerRef,
      "data-ecmd-telemetry-marker": componentName,
      "aria-hidden": "true",
      hidden: true,
      style: { display: "none" },
    })
  );
}

/**
 * Universal Plasmic component registration wrapper.
 * - Tracks every registered component in ECMD_REGISTERED_COMPONENTS.
 * - Zero production overhead (!import.meta.env.DEV renders <Component {...props} /> directly).
 * - In DEV, mounts idle + debounced DOM/box-model/diagnostics telemetry observer.
 */
export function registerEcmdComponent<T extends React.ComponentType<any>>(
  Component: T,
  meta: Record<string, any>,
  plasmicLoader?: any
) {
  const name = String(meta?.["name"] || Component.displayName || Component.name || "UnnamedComponent");
  const displayName = String(meta?.["displayName"] || name);
  const importPath = String(meta?.["importPath"] || "");
  const propsObj = meta?.["props"] || {};
  const propNames = Object.keys(propsObj);
  const slotNames = propNames.filter((k) => propsObj[k]?.type === "slot");

  const existingIdx = ECMD_REGISTERED_COMPONENTS.findIndex((c) => c.name === name);
  const entry: EcmdRegisteredComponentMeta = {
    name,
    displayName,
    importPath,
    propNames,
    slotNames,
  };
  if (existingIdx >= 0) {
    ECMD_REGISTERED_COMPONENTS[existingIdx] = entry;
  } else {
    ECMD_REGISTERED_COMPONENTS.push(entry);
  }

  const WrappedComponent: React.FC<any> = (props) => {
    if (!import.meta.env.DEV) {
      return React.createElement(Component, props);
    }
    return React.createElement(DevTelemetryObserver, {
      componentName: name,
      displayName,
      Component,
      componentProps: props,
    });
  };
  WrappedComponent.displayName = `EcmdTracked(${name})`;

  const loader = plasmicLoader || boundPlasmicLoader;
  if (loader && typeof loader.registerComponent === "function") {
    try {
      loader.registerComponent(WrappedComponent, meta);
    } catch (err) {
      reportEcmdRuntimeError(err, `plasmic-init:registerComponent:${name}`);
      console.error(`[ECMD plasmic-init] registerComponent(${name}) failed:`, err);
    }
  }

  return WrappedComponent;
}
