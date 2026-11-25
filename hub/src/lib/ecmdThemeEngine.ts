import { SUPABASE_URL } from "../integrations/supabase/client";

export const ECMD_THEME_ASSETS_BUCKET = "ecmd-theme-assets";

export type ThemeImageObjectFit = "contain" | "cover" | "fill" | "scale-down" | "none";

export interface ThemeImageVariantConfig {
  assetUrl: string;
  assetName: string;
  width?: string | undefined;
  height?: string | undefined;
  mobileWidth?: string | undefined;
  mobileHeight?: string | undefined;
  maxWidth?: string | undefined;
  objectFit?: ThemeImageObjectFit | undefined;
  objectPosition?: string | undefined;
  opacity?: number | undefined;
}

export interface ThemeImageGroup {
  id: string;
  label: string;
  selector: string;
  pinned?: boolean | undefined;
  /** Per-theme configurations keyed by normalized theme key ("cl", "ms", etc.) */
  themes: Record<string, ThemeImageVariantConfig>;
  /** Optional flat fallback fields for backward-compatible/single-theme payloads */
  assetUrl?: string | undefined;
  assetName?: string | undefined;
  width?: string | undefined;
  height?: string | undefined;
  mobileWidth?: string | undefined;
  mobileHeight?: string | undefined;
  maxWidth?: string | undefined;
  objectFit?: ThemeImageObjectFit | undefined;
  objectPosition?: string | undefined;
  opacity?: number | undefined;
}

export const DEFAULT_THEME_PALETTE_KEYS = ["cl", "ms"] as const;

export const DEFAULT_THEME_IMAGE_CLASS_TOKENS: Record<string, string> = {
  headerLogo: "ecmd-img-header-logo",
  footerLogo: "ecmd-img-footer-logo",
  cardBanner: "ecmd-img-card-banner",
  heroArtwork: "ecmd-img-hero-artwork",
};

export function normalizeThemeImagePaletteKey(themeOrPalette?: string): string {
  const raw = (themeOrPalette || "").trim().toLowerCase();
  if (!raw || raw === "cl" || raw === "coastal-light" || raw === "light") return "cl";
  if (raw === "ms" || raw === "midnight-slate" || raw === "dark") return "ms";
  return raw;
}

export function createEmptyImageVariant(): ThemeImageVariantConfig {
  return {
    assetUrl: "",
    assetName: "",
    width: "",
    height: "",
    mobileWidth: "",
    mobileHeight: "",
    maxWidth: "",
    objectFit: "contain",
    objectPosition: "center",
    opacity: undefined,
  };
}

export function slugifyImageGroupId(label: string, existingIds?: Iterable<string>): string {
  const base =
    (label || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "image-group";
  const taken = new Set(existingIds ? Array.from(existingIds) : []);
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export function buildImageGroupSelector(idOrLabel: string): string {
  const clean = (idOrLabel || "").trim();
  if (!clean) return ".ecmd-img-slot";
  if (clean.startsWith(".") || clean.startsWith("#") || clean.startsWith("[")) {
    return clean;
  }
  const slug = slugifyImageGroupId(clean.replace(/^ecmd-img-/i, ""));
  return `.ecmd-img-${slug}`;
}

export function extractPrimaryImageClass(selector?: string): string {
  const first = (selector || "").split(",")[0]?.trim() || "";
  if (!first) return "";
  if (first.startsWith(".")) return first.slice(1).split(/[\s:>[\]]/)[0] || "";
  if (first.startsWith("#") || first.startsWith("[")) return first;
  return first.split(/[\s:>[\]]/)[0] || "";
}

type LooseVariantInput = {
  [K in keyof ThemeImageVariantConfig]?: ThemeImageVariantConfig[K] | undefined;
};

function normalizeVariant(
  raw?: LooseVariantInput | null
): ThemeImageVariantConfig {
  const base = createEmptyImageVariant();
  if (!raw || typeof raw !== "object") return base;
  const parsedOpacity =
    typeof raw.opacity === "number" && Number.isFinite(raw.opacity)
      ? Math.max(0, Math.min(100, raw.opacity))
      : typeof raw.opacity === "string" && String(raw.opacity).trim() !== ""
        ? (() => {
            const n = Number(raw.opacity);
            return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : undefined;
          })()
        : undefined;
  return {
    assetUrl: typeof raw.assetUrl === "string" ? raw.assetUrl : "",
    assetName: typeof raw.assetName === "string" ? raw.assetName : "",
    width: typeof raw.width === "string" ? raw.width : "",
    height: typeof raw.height === "string" ? raw.height : "",
    mobileWidth: typeof raw.mobileWidth === "string" ? raw.mobileWidth : "",
    mobileHeight: typeof raw.mobileHeight === "string" ? raw.mobileHeight : "",
    maxWidth: typeof raw.maxWidth === "string" ? raw.maxWidth : "",
    objectFit:
      raw.objectFit === "cover" ||
      raw.objectFit === "fill" ||
      raw.objectFit === "scale-down" ||
      raw.objectFit === "none" ||
      raw.objectFit === "contain"
        ? raw.objectFit
        : "contain",
    objectPosition:
      typeof raw.objectPosition === "string" && raw.objectPosition.trim()
        ? raw.objectPosition.trim()
        : "center",
    opacity: parsedOpacity,
  };
}

export function syncImageGroupSlotsAcrossThemes(
  imageGroups: ThemeImageGroup[],
  themeKeys: readonly string[] = DEFAULT_THEME_PALETTE_KEYS
): ThemeImageGroup[] {
  const normalizedKeys = Array.from(
    new Set(themeKeys.map((k) => normalizeThemeImagePaletteKey(k)))
  );
  return (Array.isArray(imageGroups) ? imageGroups : [])
    .filter((g): g is ThemeImageGroup => Boolean(g && typeof g === "object"))
    .map((g, idx) => {
      const label = (g.label || "").trim() || `Image Group ${idx + 1}`;
      const id = (g.id || "").trim() || slugifyImageGroupId(label);
      const selector = (g.selector || "").trim() || buildImageGroupSelector(id);
      const rawThemes = g.themes && typeof g.themes === "object" ? g.themes : {};
      const allKeys = Array.from(
        new Set([
          ...normalizedKeys,
          ...Object.keys(rawThemes).map((k) => normalizeThemeImagePaletteKey(k)),
        ])
      );
      const flatFallback: LooseVariantInput | null =
        g.assetUrl ||
        g.assetName ||
        g.width ||
        g.height ||
        g.mobileWidth ||
        g.mobileHeight ||
        g.maxWidth ||
        g.opacity !== undefined
          ? {
              assetUrl: g.assetUrl,
              assetName: g.assetName,
              width: g.width,
              height: g.height,
              mobileWidth: g.mobileWidth,
              mobileHeight: g.mobileHeight,
              maxWidth: g.maxWidth,
              objectFit: g.objectFit,
              objectPosition: g.objectPosition,
              opacity: g.opacity,
            }
          : null;

      const themes: Record<string, ThemeImageVariantConfig> = {};
      for (const tk of allKeys) {
        const direct =
          rawThemes[tk] ||
          (tk === "cl" ? rawThemes["coastal-light"] : undefined) ||
          (tk === "ms" ? rawThemes["midnight-slate"] : undefined);
        themes[tk] = normalizeVariant(
          direct || (tk === "cl" && Object.keys(rawThemes).length === 0 ? flatFallback : null)
        );
      }
      return {
        id,
        label,
        selector,
        ...(g.pinned ? { pinned: true } : {}),
        themes,
      };
    });
}

export function hydrateThemeImageGroups(
  rawImageGroups?: unknown,
  themeKeys: readonly string[] = DEFAULT_THEME_PALETTE_KEYS
): ThemeImageGroup[] {
  if (!Array.isArray(rawImageGroups)) return [];
  return syncImageGroupSlotsAcrossThemes(rawImageGroups as ThemeImageGroup[], themeKeys);
}

export function createThemeImageGroup(
  existing: ThemeImageGroup[],
  label?: string,
  selector?: string,
  themeKeys: readonly string[] = DEFAULT_THEME_PALETTE_KEYS
): ThemeImageGroup {
  const existingIds = existing.map((g) => g.id);
  const resolvedLabel =
    (label || "").trim() ||
    (existing.length === 0 ? "Header Wordmark Logo" : `Image Group ${existing.length + 1}`);
  const id = slugifyImageGroupId(resolvedLabel, existingIds);
  const resolvedSelector = (selector || "").trim() || buildImageGroupSelector(id);
  const themes: Record<string, ThemeImageVariantConfig> = {};
  for (const k of themeKeys) {
    themes[normalizeThemeImagePaletteKey(k)] = createEmptyImageVariant();
  }
  return {
    id,
    label: resolvedLabel,
    selector: resolvedSelector,
    themes,
  };
}

export function getThemeImageGroupVariant(
  group: ThemeImageGroup,
  themeOrPalette: string
): ThemeImageVariantConfig {
  const tk = normalizeThemeImagePaletteKey(themeOrPalette);
  const direct =
    group.themes?.[tk] ||
    (tk === "cl" ? group.themes?.["coastal-light"] : undefined) ||
    (tk === "ms" ? group.themes?.["midnight-slate"] : undefined);
  if (direct) return normalizeVariant(direct);
  if (!group.themes || Object.keys(group.themes).length === 0) {
    return normalizeVariant({
      assetUrl: group.assetUrl,
      assetName: group.assetName,
      width: group.width,
      height: group.height,
      mobileWidth: group.mobileWidth,
      mobileHeight: group.mobileHeight,
      maxWidth: group.maxWidth,
      objectFit: group.objectFit,
      objectPosition: group.objectPosition,
      opacity: group.opacity,
    });
  }
  return createEmptyImageVariant();
}

export function updateThemeImageGroupVariant(
  groups: ThemeImageGroup[],
  groupId: string,
  themeOrPalette: string,
  patch: Partial<ThemeImageVariantConfig>
): ThemeImageGroup[] {
  const tk = normalizeThemeImagePaletteKey(themeOrPalette);
  return syncImageGroupSlotsAcrossThemes(groups).map((g) => {
    if (g.id !== groupId) return g;
    const prev = getThemeImageGroupVariant(g, tk);
    return {
      ...g,
      themes: {
        ...g.themes,
        [tk]: normalizeVariant({ ...prev, ...patch }),
      },
    };
  });
}

export function updateThemeImageGroupMeta(
  groups: ThemeImageGroup[],
  groupId: string,
  patch: Partial<Pick<ThemeImageGroup, "label" | "selector" | "pinned">>
): ThemeImageGroup[] {
  return syncImageGroupSlotsAcrossThemes(groups).map((g) => {
    if (g.id !== groupId) return g;
    const nextPinned = patch.pinned !== undefined ? Boolean(patch.pinned) : Boolean(g.pinned);
    return {
      ...g,
      label: patch.label !== undefined ? patch.label : g.label,
      selector: patch.selector !== undefined ? patch.selector : g.selector,
      ...(nextPinned ? { pinned: true } : { pinned: undefined }),
    };
  });
}

export function deleteThemeImageGroup(
  groups: ThemeImageGroup[],
  groupId: string
): ThemeImageGroup[] {
  return syncImageGroupSlotsAcrossThemes(groups).filter((g) => g.id !== groupId);
}

export function getRegisteredImageGroupTokens(
  imageGroups?: ThemeImageGroup[]
): Record<string, string> {
  const tokens: Record<string, string> = { ...DEFAULT_THEME_IMAGE_CLASS_TOKENS };
  for (const g of imageGroups || []) {
    const cls = extractPrimaryImageClass(g.selector);
    if (g.id && cls) {
      const camelKey = g.id.replace(/-([a-z0-9])/g, (_, ch: string) => ch.toUpperCase());
      tokens[camelKey] = cls;
    }
  }
  return tokens;
}

function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function inferImageMimeType(file: File): string {
  if (file.type && file.type.trim()) return file.type;
  const lower = (file.name || "").toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".avif")) return "image/avif";
  return "application/octet-stream";
}

/**
 * Uploads a theme asset file to the public Supabase Storage bucket `ecmd-theme-assets`.
 * Falls back cleanly and immediately to a local Data URI when offline or if storage rejects anonymous upload.
 */
export async function uploadThemeAssetFile(
  file: File,
  opts?: { groupId?: string; themeKey?: string }
): Promise<{ url: string; fileName: string; storageMode: "supabase" | "data-uri" }> {
  const safeGroup = slugifyImageGroupId(opts?.groupId || "asset");
  const safeTheme = normalizeThemeImagePaletteKey(opts?.themeKey || "cl");
  const cleanFileName = (file.name || "asset.png")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const objectPath = `${safeGroup}/${safeTheme}-${Date.now()}-${cleanFileName || "asset.png"}`;
  const mime = inferImageMimeType(file);

  const dataUriPromise = readFileAsDataUri(file).catch(() => "");

  try {
    const envAny = (import.meta as any)?.env || {};
    const anonKey: string =
      envAny.VITE_SUPABASE_ANON_KEY ||
      envAny.VITE_SUPABASE_PUBLISHABLE_KEY ||
      "";
    const headers: Record<string, string> = {
      "Content-Type": mime,
      "x-upsert": "true",
    };
    if (anonKey) {
      headers["apikey"] = anonKey;
      headers["Authorization"] = `Bearer ${anonKey}`;
    }

    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${ECMD_THEME_ASSETS_BUCKET}/${objectPath}`;
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers,
      body: file,
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      return {
        url: `${SUPABASE_URL}/storage/v1/object/public/${ECMD_THEME_ASSETS_BUCKET}/${objectPath}`,
        fileName: file.name || cleanFileName,
        storageMode: "supabase",
      };
    }
  } catch {
    // Offline or CORS/anon restriction — fall through cleanly to inline Data URI fallback
  }

  const dataUri = await dataUriPromise;
  return {
    url: dataUri,
    fileName: file.name || cleanFileName,
    storageMode: "data-uri",
  };
}

function parseImageSelectorTokens(rawSel?: string): string[] {
  return (rawSel || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith(".") || s.startsWith("#") || s.startsWith("[") ? s : `.${s}`));
}

function objectFitToBackgroundSize(fit?: ThemeImageObjectFit): string {
  switch (fit) {
    case "cover":
      return "cover";
    case "fill":
      return "100% 100%";
    case "none":
      return "auto";
    case "scale-down":
    case "contain":
    default:
      return "contain";
  }
}

function escapeCssUrl(url: string): string {
  return url.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r|\n/g, "");
}

/**
 * Generates scoped CSS rules for every active ThemeImageGroup (per-theme width, height,
 * maxWidth, objectFit, objectPosition, opacity, responsive <768px mobileWidth/mobileHeight,
 * and non-destructive SVG image swap styling).
 */
export function buildThemeImageGroupsCss(
  imageGroups: ThemeImageGroup[] | undefined,
  activeTheme: string
): string {
  const list = syncImageGroupSlotsAcrossThemes(imageGroups || []);
  if (list.length === 0) return "";

  const rules: string[] = [
    'svg[data-ecmd-svg-swapped="true"] > * { opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }',
  ];

  for (const group of list) {
    const tokens = parseImageSelectorTokens(group.selector);
    if (tokens.length === 0) continue;

    const v = getThemeImageGroupVariant(group, activeTheme);
    const boosted = tokens.map((t) => `${t}:not(#ecmd_none)`).join(", ");
    const nestedMedia = tokens
      .flatMap((t) => [`${t}:not(#ecmd_none) > img`, `${t}:not(#ecmd_none) > svg`])
      .join(", ");

    const decls: string[] = [];
    const width = (v.width || "").trim();
    const height = (v.height || "").trim();
    const maxWidth = (v.maxWidth || "").trim();
    const objectFit = v.objectFit;
    const objectPosition = (v.objectPosition || "").trim();
    const opacity =
      typeof v.opacity === "number" && Number.isFinite(v.opacity)
        ? Math.max(0, Math.min(100, v.opacity))
        : undefined;

    if (width) decls.push(`width: ${width} !important;`);
    if (height) decls.push(`height: ${height} !important;`);
    if (maxWidth) decls.push(`max-width: ${maxWidth} !important;`);
    if (objectFit && (v.assetUrl || width || height || objectFit !== "contain")) {
      decls.push(`object-fit: ${objectFit} !important;`);
    }
    if (objectPosition && (v.assetUrl || objectPosition !== "center")) {
      decls.push(`object-position: ${objectPosition} !important;`);
    }
    if (opacity !== undefined) {
      decls.push(`opacity: ${Number((opacity / 100).toFixed(3))} !important;`);
    }

    if (decls.length > 0) {
      rules.push(`${boosted} { ${decls.join(" ")} }`);
    }

    if (v.assetUrl && v.assetUrl.trim()) {
      const safeUrl = escapeCssUrl(v.assetUrl.trim());
      const bgSize = objectFitToBackgroundSize(objectFit);
      const bgPos = objectPosition || "center";
      const svgSel = tokens
        .flatMap((t) => [
          `svg${t}[data-ecmd-svg-swapped="true"]:not(#ecmd_none)`,
          `${t} svg[data-ecmd-svg-swapped="true"]:not(#ecmd_none)`,
          `${t}[data-ecmd-bg-swapped="true"]:not(#ecmd_none)`,
        ])
        .join(", ");
      rules.push(
        `${svgSel} { background-image: url("${safeUrl}") !important; background-repeat: no-repeat !important; background-size: ${bgSize} !important; background-position: ${bgPos} !important; }`
      );
      if (objectFit || objectPosition) {
        const mediaDecls: string[] = [];
        if (objectFit) mediaDecls.push(`object-fit: ${objectFit} !important;`);
        if (objectPosition) mediaDecls.push(`object-position: ${objectPosition} !important;`);
        if (mediaDecls.length > 0) {
          rules.push(`${nestedMedia} { ${mediaDecls.join(" ")} }`);
        }
      }
    }

    const mobW = (v.mobileWidth || "").trim();
    const mobH = (v.mobileHeight || "").trim();
    if (mobW || mobH) {
      const mobDecls: string[] = [];
      if (mobW) mobDecls.push(`width: ${mobW} !important;`);
      if (mobH) mobDecls.push(`height: ${mobH} !important;`);
      rules.push(`@media (max-width: 767px) {\n${boosted} { ${mobDecls.join(" ")} }\n}`);
    }
  }

  return rules.join("\n");
}

function restoreImgElement(img: HTMLImageElement): void {
  if (!img.hasAttribute("data-ecmd-orig-src")) return;
  const origSrc = img.getAttribute("data-ecmd-orig-src") || "";
  if (origSrc) {
    if (img.getAttribute("src") !== origSrc) img.setAttribute("src", origSrc);
  } else {
    img.removeAttribute("src");
  }
  if (img.getAttribute("data-ecmd-had-orig-srcset") === "true") {
    const origSrcset = img.getAttribute("data-ecmd-orig-srcset") || "";
    if (img.getAttribute("srcset") !== origSrcset) {
      img.setAttribute("srcset", origSrcset);
    }
  }
  img.removeAttribute("data-ecmd-orig-src");
  img.removeAttribute("data-ecmd-orig-srcset");
  img.removeAttribute("data-ecmd-had-orig-srcset");
  img.removeAttribute("data-ecmd-img-swapped");
  img.removeAttribute("data-ecmd-img-group");
}

function swapImgElement(img: HTMLImageElement, assetUrl: string, groupId: string): void {
  if (!img.hasAttribute("data-ecmd-orig-src")) {
    img.setAttribute("data-ecmd-orig-src", img.getAttribute("src") ?? "");
    if (img.hasAttribute("srcset")) {
      img.setAttribute("data-ecmd-had-orig-srcset", "true");
      img.setAttribute("data-ecmd-orig-srcset", img.getAttribute("srcset") ?? "");
    } else {
      img.setAttribute("data-ecmd-had-orig-srcset", "false");
    }
  }
  if (img.getAttribute("src") !== assetUrl) {
    img.setAttribute("src", assetUrl);
  }
  if (img.hasAttribute("srcset")) {
    img.removeAttribute("srcset");
  }
  img.setAttribute("data-ecmd-img-swapped", "true");
  img.setAttribute("data-ecmd-img-group", groupId);
  img.setAttribute("data-ecmd-brand-asset", "true");
}

function restoreSvgElement(svg: SVGElement): void {
  if (svg.getAttribute("data-ecmd-svg-swapped") !== "true") return;
  const origBgImg = svg.getAttribute("data-ecmd-orig-bg-image");
  const origBgSize = svg.getAttribute("data-ecmd-orig-bg-size");
  const origBgRepeat = svg.getAttribute("data-ecmd-orig-bg-repeat");
  const origBgPos = svg.getAttribute("data-ecmd-orig-bg-pos");

  if (origBgImg) svg.style.backgroundImage = origBgImg;
  else svg.style.removeProperty("background-image");
  if (origBgSize) svg.style.backgroundSize = origBgSize;
  else svg.style.removeProperty("background-size");
  if (origBgRepeat) svg.style.backgroundRepeat = origBgRepeat;
  else svg.style.removeProperty("background-repeat");
  if (origBgPos) svg.style.backgroundPosition = origBgPos;
  else svg.style.removeProperty("background-position");

  svg.removeAttribute("data-ecmd-orig-bg-image");
  svg.removeAttribute("data-ecmd-orig-bg-size");
  svg.removeAttribute("data-ecmd-orig-bg-repeat");
  svg.removeAttribute("data-ecmd-orig-bg-pos");
  svg.removeAttribute("data-ecmd-svg-swapped");
  svg.removeAttribute("data-ecmd-swapped-url");
  svg.removeAttribute("data-ecmd-img-group");
}

function swapSvgElement(
  svg: SVGElement,
  variant: ThemeImageVariantConfig,
  groupId: string
): void {
  const assetUrl = variant.assetUrl.trim();
  if (svg.getAttribute("data-ecmd-svg-swapped") !== "true") {
    svg.setAttribute("data-ecmd-orig-bg-image", svg.style.backgroundImage || "");
    svg.setAttribute("data-ecmd-orig-bg-size", svg.style.backgroundSize || "");
    svg.setAttribute("data-ecmd-orig-bg-repeat", svg.style.backgroundRepeat || "");
    svg.setAttribute("data-ecmd-orig-bg-pos", svg.style.backgroundPosition || "");
  }
  const safeUrl = escapeCssUrl(assetUrl);
  const bgSize = objectFitToBackgroundSize(variant.objectFit);
  const bgPos = (variant.objectPosition || "center").trim() || "center";

  svg.setAttribute("data-ecmd-svg-swapped", "true");
  svg.setAttribute("data-ecmd-swapped-url", assetUrl);
  svg.setAttribute("data-ecmd-img-group", groupId);
  svg.setAttribute("data-ecmd-brand-asset", "true");

  svg.style.setProperty("background-image", `url("${safeUrl}")`, "important");
  svg.style.setProperty("background-repeat", "no-repeat", "important");
  svg.style.setProperty("background-size", bgSize, "important");
  svg.style.setProperty("background-position", bgPos, "important");
}

function restoreBgWrapperElement(el: HTMLElement): void {
  if (el.getAttribute("data-ecmd-bg-swapped") !== "true") return;
  const origBgImg = el.getAttribute("data-ecmd-orig-bg-image");
  const origBgSize = el.getAttribute("data-ecmd-orig-bg-size");
  const origBgRepeat = el.getAttribute("data-ecmd-orig-bg-repeat");
  const origBgPos = el.getAttribute("data-ecmd-orig-bg-pos");

  if (origBgImg) el.style.backgroundImage = origBgImg;
  else el.style.removeProperty("background-image");
  if (origBgSize) el.style.backgroundSize = origBgSize;
  else el.style.removeProperty("background-size");
  if (origBgRepeat) el.style.backgroundRepeat = origBgRepeat;
  else el.style.removeProperty("background-repeat");
  if (origBgPos) el.style.backgroundPosition = origBgPos;
  else el.style.removeProperty("background-position");

  el.removeAttribute("data-ecmd-orig-bg-image");
  el.removeAttribute("data-ecmd-orig-bg-size");
  el.removeAttribute("data-ecmd-orig-bg-repeat");
  el.removeAttribute("data-ecmd-orig-bg-pos");
  el.removeAttribute("data-ecmd-bg-swapped");
  el.removeAttribute("data-ecmd-swapped-url");
  el.removeAttribute("data-ecmd-img-group");
}

function swapBgWrapperElement(
  el: HTMLElement,
  variant: ThemeImageVariantConfig,
  groupId: string
): void {
  const assetUrl = variant.assetUrl.trim();
  if (el.getAttribute("data-ecmd-bg-swapped") !== "true") {
    el.setAttribute("data-ecmd-orig-bg-image", el.style.backgroundImage || "");
    el.setAttribute("data-ecmd-orig-bg-size", el.style.backgroundSize || "");
    el.setAttribute("data-ecmd-orig-bg-repeat", el.style.backgroundRepeat || "");
    el.setAttribute("data-ecmd-orig-bg-pos", el.style.backgroundPosition || "");
  }
  const safeUrl = escapeCssUrl(assetUrl);
  const bgSize = objectFitToBackgroundSize(variant.objectFit);
  const bgPos = (variant.objectPosition || "center").trim() || "center";

  el.setAttribute("data-ecmd-bg-swapped", "true");
  el.setAttribute("data-ecmd-swapped-url", assetUrl);
  el.setAttribute("data-ecmd-img-group", groupId);
  el.style.setProperty("background-image", `url("${safeUrl}")`, "important");
  el.style.setProperty("background-repeat", "no-repeat", "important");
  el.style.setProperty("background-size", bgSize, "important");
  el.style.setProperty("background-position", bgPos, "important");
}

/**
 * Applies active theme image swaps across the document for matching <img>, <svg>,
 * and wrapper elements, and cleanly restores any previously swapped elements whose
 * active theme has assetUrl === "" or whose group was removed/changed.
 */
export function applyThemeImageGroupsToDocument(
  doc: Document | null | undefined,
  imageGroups: ThemeImageGroup[] | undefined,
  activeTheme: string
): void {
  if (!doc) return;
  const list = syncImageGroupSlotsAcrossThemes(imageGroups || []);
  const touchedElements = new Set<Element>();

  for (const group of list) {
    const tokens = parseImageSelectorTokens(group.selector);
    if (tokens.length === 0) continue;
    const selector = tokens.join(", ");
    let matched: NodeListOf<Element>;
    try {
      matched = doc.querySelectorAll(selector);
    } catch {
      continue;
    }

    const variant = getThemeImageGroupVariant(group, activeTheme);
    const hasAsset = Boolean(variant.assetUrl && variant.assetUrl.trim());

    matched.forEach((node) => {
      const tag = node.tagName.toLowerCase();
      if (tag === "img") {
        const img = node as HTMLImageElement;
        if (hasAsset) {
          touchedElements.add(img);
          swapImgElement(img, variant.assetUrl.trim(), group.id);
        } else {
          restoreImgElement(img);
        }
        return;
      }

      if (tag === "svg") {
        const svg = node as SVGElement;
        if (hasAsset) {
          touchedElements.add(svg);
          swapSvgElement(svg, variant, group.id);
        } else {
          restoreSvgElement(svg);
        }
        return;
      }

      // Wrapper container: prefer nested img/svg media target so Plasmic flex slots work seamlessly
      const nestedMedia = node.querySelector("img, svg");
      if (nestedMedia) {
        const nestedTag = nestedMedia.tagName.toLowerCase();
        if (nestedTag === "img") {
          const img = nestedMedia as HTMLImageElement;
          if (hasAsset) {
            touchedElements.add(img);
            swapImgElement(img, variant.assetUrl.trim(), group.id);
          } else {
            restoreImgElement(img);
          }
        } else if (nestedTag === "svg") {
          const svg = nestedMedia as SVGElement;
          if (hasAsset) {
            touchedElements.add(svg);
            swapSvgElement(svg, variant, group.id);
          } else {
            restoreSvgElement(svg);
          }
        }
      } else if (node instanceof HTMLElement) {
        if (hasAsset) {
          touchedElements.add(node);
          swapBgWrapperElement(node, variant, group.id);
        } else {
          restoreBgWrapperElement(node);
        }
      }
    });
  }

  // Restore any previously swapped element no longer matched by an active asset
  const previouslySwapped = doc.querySelectorAll(
    '[data-ecmd-img-swapped="true"], [data-ecmd-svg-swapped="true"], [data-ecmd-bg-swapped="true"]'
  );
  previouslySwapped.forEach((el) => {
    if (touchedElements.has(el)) return;
    const tag = el.tagName.toLowerCase();
    if (tag === "img") restoreImgElement(el as HTMLImageElement);
    else if (tag === "svg") restoreSvgElement(el as SVGElement);
    else if (el instanceof HTMLElement) restoreBgWrapperElement(el);
  });
}

/**
 * Observes DOM mutations (Plasmic Studio artboard mounts/re-renders, class edits)
 * and re-applies ThemeImageGroups cleanly without causing infinite mutation loops.
 */
export function observeThemeImageGroups(
  doc: Document | null | undefined,
  getImageGroups: () => ThemeImageGroup[],
  getActiveTheme: () => string
): () => void {
  if (!doc || !doc.body || typeof MutationObserver === "undefined") {
    return () => {};
  }

  let isApplying = false;
  let scheduled = false;

  const runApply = () => {
    scheduled = false;
    if (isApplying) return;
    isApplying = true;
    try {
      applyThemeImageGroupsToDocument(doc, getImageGroups(), getActiveTheme());
    } finally {
      isApplying = false;
    }
  };

  runApply();

  const obs = new MutationObserver(() => {
    if (isApplying || scheduled) return;
    scheduled = true;
    if (typeof queueMicrotask === "function") {
      queueMicrotask(runApply);
    } else {
      setTimeout(runApply, 0);
    }
  });

  obs.observe(doc.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });

  return () => {
    obs.disconnect();
  };
}

// ============================================================================
// VISUAL TEXT SHADOW ENGINE (Per-Theme & Per-State + Multi-Layer Preset Support)
// ============================================================================

export interface ThemeTextShadowConfig {
  textShadowEnabled?: boolean | undefined;
  textShadowX?: number | undefined;
  textShadowY?: number | undefined;
  textShadowBlur?: number | undefined;
  textShadowColor?: string | undefined;
  textShadowOpacity?: number | undefined;
  textShadowCustom?: string | undefined;
}

export interface NormalizedTextShadowConfig {
  textShadowEnabled: boolean;
  textShadowX: number;
  textShadowY: number;
  textShadowBlur: number;
  textShadowColor: string;
  textShadowOpacity: number;
  textShadowCustom: string;
}

export interface TextShadowPresetOption {
  id: string;
  label: string;
  description: string;
  config: NormalizedTextShadowConfig;
}

export const DEFAULT_TEXT_SHADOW_CONFIG: NormalizedTextShadowConfig = {
  textShadowEnabled: false,
  textShadowX: 0,
  textShadowY: 1,
  textShadowBlur: 2,
  textShadowColor: "#000000",
  textShadowOpacity: 35,
  textShadowCustom: "",
};

export const TEXT_SHADOW_PRESETS: TextShadowPresetOption[] = [
  {
    id: "crisp-edge",
    label: "Crisp Edge",
    description: "0px 1px 2px, #000000 @ 40%",
    config: {
      textShadowEnabled: true,
      textShadowX: 0,
      textShadowY: 1,
      textShadowBlur: 2,
      textShadowColor: "#000000",
      textShadowOpacity: 40,
      textShadowCustom: "",
    },
  },
  {
    id: "soft-depth",
    label: "Soft Depth",
    description: "0px 2px 6px, #000000 @ 30%",
    config: {
      textShadowEnabled: true,
      textShadowX: 0,
      textShadowY: 2,
      textShadowBlur: 6,
      textShadowColor: "#000000",
      textShadowOpacity: 30,
      textShadowCustom: "",
    },
  },
  {
    id: "emerald-glow",
    label: "Emerald Glow",
    description: "0px 0px 10px, #10b981 @ 45%",
    config: {
      textShadowEnabled: true,
      textShadowX: 0,
      textShadowY: 0,
      textShadowBlur: 10,
      textShadowColor: "#10B981",
      textShadowOpacity: 45,
      textShadowCustom: "",
    },
  },
  {
    id: "crisp-glow",
    label: "Crisp + Glow",
    description: "Dual-layer crisp dark edge + soft emerald halo",
    config: {
      textShadowEnabled: true,
      textShadowX: 0,
      textShadowY: 1,
      textShadowBlur: 2,
      textShadowColor: "#000000",
      textShadowOpacity: 45,
      textShadowCustom: "0 1px 2px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(16, 185, 129, 0.35)",
    },
  },
  {
    id: "none-clear",
    label: "None (Clear)",
    description: "Explicitly emits text-shadow: none !important",
    config: {
      textShadowEnabled: true,
      textShadowX: 0,
      textShadowY: 1,
      textShadowBlur: 2,
      textShadowColor: "#000000",
      textShadowOpacity: 35,
      textShadowCustom: "none",
    },
  },
  {
    id: "none-reset",
    label: "None (Reset)",
    description: "Disables text-shadow and leaves CSS untouched",
    config: {
      ...DEFAULT_TEXT_SHADOW_CONFIG,
    },
  },
];

function clampFiniteInt(
  raw: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(min, Math.min(max, Math.round(raw)));
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n)) {
      return Math.max(min, Math.min(max, Math.round(n)));
    }
  }
  return fallback;
}

export function normalizeHexColor(raw?: string | null, fallback = "#000000"): string {
  const s = (raw || "").trim();
  const hex3 = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(s);
  if (hex3 && hex3[1] && hex3[2] && hex3[3]) {
    return (
      "#" +
      hex3[1] +
      hex3[1] +
      hex3[2] +
      hex3[2] +
      hex3[3] +
      hex3[3]
    ).toUpperCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(s)) {
    return s.toUpperCase();
  }
  return fallback;
}

export function hexToRgbComponents(hex?: string | null): { r: number; g: number; b: number } {
  const norm = normalizeHexColor(hex, "#000000").slice(1);
  return {
    r: parseInt(norm.slice(0, 2), 16),
    g: parseInt(norm.slice(2, 4), 16),
    b: parseInt(norm.slice(4, 6), 16),
  };
}

export function hasExplicitTextShadowFields(
  source?: ThemeTextShadowConfig | null
): boolean {
  if (!source || typeof source !== "object") return false;
  return (
    source.textShadowEnabled !== undefined ||
    source.textShadowX !== undefined ||
    source.textShadowY !== undefined ||
    source.textShadowBlur !== undefined ||
    source.textShadowColor !== undefined ||
    source.textShadowOpacity !== undefined ||
    source.textShadowCustom !== undefined
  );
}

export function extractTextShadowConfig(
  source?: ThemeTextShadowConfig | null
): ThemeTextShadowConfig | undefined {
  if (!hasExplicitTextShadowFields(source)) return undefined;
  return {
    textShadowEnabled: source?.textShadowEnabled,
    textShadowX: source?.textShadowX,
    textShadowY: source?.textShadowY,
    textShadowBlur: source?.textShadowBlur,
    textShadowColor: source?.textShadowColor,
    textShadowOpacity: source?.textShadowOpacity,
    textShadowCustom: source?.textShadowCustom,
  };
}

export function normalizeTextShadowConfig(
  raw?: ThemeTextShadowConfig | null
): NormalizedTextShadowConfig {
  return {
    textShadowEnabled: Boolean(raw?.textShadowEnabled),
    textShadowX: clampFiniteInt(raw?.textShadowX, DEFAULT_TEXT_SHADOW_CONFIG.textShadowX, -20, 20),
    textShadowY: clampFiniteInt(raw?.textShadowY, DEFAULT_TEXT_SHADOW_CONFIG.textShadowY, -20, 20),
    textShadowBlur: clampFiniteInt(raw?.textShadowBlur, DEFAULT_TEXT_SHADOW_CONFIG.textShadowBlur, 0, 40),
    textShadowColor: normalizeHexColor(raw?.textShadowColor, DEFAULT_TEXT_SHADOW_CONFIG.textShadowColor),
    textShadowOpacity: clampFiniteInt(raw?.textShadowOpacity, DEFAULT_TEXT_SHADOW_CONFIG.textShadowOpacity, 0, 100),
    textShadowCustom: typeof raw?.textShadowCustom === "string" ? raw.textShadowCustom.trim() : "",
  };
}

export function formatSingleTextShadowLayer(cfg: {
  textShadowX?: number | undefined;
  textShadowY?: number | undefined;
  textShadowBlur?: number | undefined;
  textShadowColor?: string | undefined;
  textShadowOpacity?: number | undefined;
}): string {
  const x = clampFiniteInt(cfg.textShadowX, DEFAULT_TEXT_SHADOW_CONFIG.textShadowX, -20, 20);
  const y = clampFiniteInt(cfg.textShadowY, DEFAULT_TEXT_SHADOW_CONFIG.textShadowY, -20, 20);
  const blur = clampFiniteInt(cfg.textShadowBlur, DEFAULT_TEXT_SHADOW_CONFIG.textShadowBlur, 0, 40);
  const opacity = clampFiniteInt(cfg.textShadowOpacity, DEFAULT_TEXT_SHADOW_CONFIG.textShadowOpacity, 0, 100);
  const { r, g, b } = hexToRgbComponents(cfg.textShadowColor);
  const alpha =
    opacity >= 100
      ? "1"
      : opacity <= 0
        ? "0"
        : String(Number((opacity / 100).toFixed(2)));
  return `${x}px ${y}px ${blur}px rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Resolves the CSS `text-shadow` declaration value for a Theme Group state.
 * - Returns `""` when `textShadowEnabled` is false/unset or bypassed via `disabledProps.textShadow` (leaves CSS untouched).
 * - Returns `"none"` ONLY when `textShadowEnabled` is true AND `textShadowCustom` is explicitly `"none"` ("None (Clear)").
 * - Returns multi-layer `textShadowCustom` when provided, otherwise formats X/Y/Blur/Color/Opacity into `rgba(...)`.
 */
export function buildTextShadowCssValue(
  cfg?: ThemeTextShadowConfig | null,
  disabledProps?: Record<string, boolean> | undefined
): string {
  if (disabledProps?.["textShadow"]) return "";
  if (!cfg || !cfg.textShadowEnabled) return "";
  const custom = typeof cfg.textShadowCustom === "string" ? cfg.textShadowCustom.trim() : "";
  if (custom) {
    return /^none$/i.test(custom) ? "none" : custom;
  }
  return formatSingleTextShadowLayer(cfg);
}

export function matchTextShadowPresetId(cfg?: ThemeTextShadowConfig | null): string {
  const norm = normalizeTextShadowConfig(cfg);
  if (!norm.textShadowEnabled) return "none-reset";
  if (norm.textShadowCustom) {
    const customLower = norm.textShadowCustom.toLowerCase();
    if (customLower === "none") return "none-clear";
    const matchedCustom = TEXT_SHADOW_PRESETS.find(
      (p) =>
        p.config.textShadowCustom &&
        p.config.textShadowCustom.trim().toLowerCase() === customLower
    );
    return matchedCustom ? matchedCustom.id : "__CUSTOM__";
  }
  const matchedSingle = TEXT_SHADOW_PRESETS.find(
    (p) =>
      p.config.textShadowEnabled &&
      !p.config.textShadowCustom &&
      p.config.textShadowX === norm.textShadowX &&
      p.config.textShadowY === norm.textShadowY &&
      p.config.textShadowBlur === norm.textShadowBlur &&
      p.config.textShadowColor.toUpperCase() === norm.textShadowColor.toUpperCase() &&
      p.config.textShadowOpacity === norm.textShadowOpacity
  );
  return matchedSingle ? matchedSingle.id : "__CUSTOM__";
}

// ============================================================================
// VISUAL GRADIENT STUDIO ENGINE (Solid / Linear / Radial / Conic + Smart CSS)
// ============================================================================

export type GradientKind = "linear" | "radial" | "conic";
export type ColorPickerMode = "solid" | GradientKind;
export type RadialGradientShape = "circle" | "ellipse";

export interface GradientStop {
  id: string;
  color: string;
  position: number;
}

export interface ParsedGradientConfig {
  kind: GradientKind;
  angle: number;
  radialShape: RadialGradientShape;
  radialOrigin: string;
  stops: GradientStop[];
}

export interface GradientPresetToken {
  id: string;
  name: string;
  value: string;
}

export const ECMD_GRADIENT_PRESETS: GradientPresetToken[] = [
  {
    id: "emerald-luxe",
    name: "Emerald Luxe",
    value: "linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%)",
  },
  {
    id: "ceramic-blue",
    name: "Ceramic Blue",
    value: "linear-gradient(135deg, #0284C7 0%, #0EA5E9 55%, #38BDF8 100%)",
  },
  {
    id: "dark-carbon-sheen",
    name: "Dark Carbon Sheen",
    value: "linear-gradient(145deg, #0F172A 0%, #1E293B 55%, #334155 100%)",
  },
  {
    id: "glass-frost",
    name: "Glass Frost",
    value: "linear-gradient(135deg, rgba(255, 255, 255, 0.24) 0%, rgba(255, 255, 255, 0.06) 100%)",
  },
  {
    id: "sunset-gold",
    name: "Sunset Gold",
    value: "linear-gradient(135deg, #F59E0B 0%, #F97316 50%, #EC4899 100%)",
  },
];

export const GRADIENT_DIRECTION_CHIPS: Array<{ angle: number; label: string }> = [
  { angle: 0, label: "0° ↑" },
  { angle: 45, label: "45° ↗" },
  { angle: 90, label: "90° →" },
  { angle: 135, label: "135° ↘" },
  { angle: 180, label: "180° ↓" },
];

export const RADIAL_ORIGIN_CHIPS: Array<{ value: string; label: string }> = [
  { value: "center", label: "center" },
  { value: "top", label: "top" },
  { value: "top left", label: "top left" },
  { value: "bottom", label: "bottom" },
];

function stripCssPropertyWrapper(raw?: string | null): string {
  let s = (raw || "").trim();
  if (!s) return "";
  s = s.replace(/^background(?:-image)?\s*:\s*/i, "");
  s = s.replace(/;\s*$/, "");
  return s.trim();
}

export function isCssGradientValue(raw?: string | null): boolean {
  const s = stripCssPropertyWrapper(raw);
  return /^(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/i.test(s);
}

export function detectColorPickerMode(raw?: string | null): ColorPickerMode {
  const s = stripCssPropertyWrapper(raw).toLowerCase();
  if (/^(?:repeating-)?linear-gradient\s*\(/.test(s)) return "linear";
  if (/^(?:repeating-)?radial-gradient\s*\(/.test(s)) return "radial";
  if (/^(?:repeating-)?conic-gradient\s*\(/.test(s)) return "conic";
  return "solid";
}

function splitTopLevelGradientArgs(body: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      if (cur.trim()) parts.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function normalizeAngleDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 135;
  const rounded = Math.round(deg) % 360;
  return rounded < 0 ? rounded + 360 : rounded;
}

function parseCssAngleToken(token: string): number | null {
  const s = token.trim().toLowerCase();
  const degM = /^(-?\d+(?:\.\d+)?)deg$/.exec(s);
  if (degM && degM[1]) return normalizeAngleDeg(parseFloat(degM[1]));
  const turnM = /^(-?\d+(?:\.\d+)?)turn$/.exec(s);
  if (turnM && turnM[1]) return normalizeAngleDeg(parseFloat(turnM[1]) * 360);
  const gradM = /^(-?\d+(?:\.\d+)?)grad$/.exec(s);
  if (gradM && gradM[1]) return normalizeAngleDeg(parseFloat(gradM[1]) * 0.9);
  const radM = /^(-?\d+(?:\.\d+)?)rad$/.exec(s);
  if (radM && radM[1]) return normalizeAngleDeg((parseFloat(radM[1]) * 180) / Math.PI);
  if (/^to\s+/.test(s)) {
    const dirs = s
      .replace(/^to\s+/, "")
      .trim()
      .split(/\s+/)
      .sort()
      .join(" ");
    const map: Record<string, number> = {
      top: 0,
      "right top": 45,
      right: 90,
      "bottom right": 135,
      bottom: 180,
      "bottom left": 225,
      left: 270,
      "left top": 315,
    };
    if (dirs in map) return map[dirs]!;
  }
  return null;
}

function parseGradientStopToken(
  token: string,
  kind: GradientKind
): Array<{ color: string; position: number | null }> {
  const trimmed = token.trim();
  if (!trimmed) return [];

  // Split by whitespace outside parentheses
  const chunks: string[] = [];
  let cur = "";
  let depth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (/\s/.test(ch || "") && depth === 0) {
      if (cur.trim()) chunks.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  if (chunks.length === 0) return [];

  const color = chunks[0]!;
  const posTokens = chunks.slice(1);
  if (posTokens.length === 0) {
    return [{ color, position: null }];
  }

  const parsedPositions: number[] = [];
  for (const pt of posTokens) {
    const pctM = /^(-?\d+(?:\.\d+)?)%$/.exec(pt);
    if (pctM && pctM[1]) {
      parsedPositions.push(Math.max(0, Math.min(100, Math.round(parseFloat(pctM[1]) * 10) / 10)));
      continue;
    }
    if (kind === "conic") {
      const ang = parseCssAngleToken(pt);
      if (ang !== null) {
        const rawDegM = /^(-?\d+(?:\.\d+)?)deg$/i.exec(pt);
        const pct =
          rawDegM && rawDegM[1]
            ? (parseFloat(rawDegM[1]) / 360) * 100
            : (ang / 360) * 100;
        parsedPositions.push(Math.max(0, Math.min(100, Math.round(pct * 10) / 10)));
      }
    }
  }

  if (parsedPositions.length === 0) {
    return [{ color, position: null }];
  }
  return parsedPositions.map((position) => ({ color, position }));
}

function resolveStopPositions(
  rawStops: Array<{ color: string; position: number | null }>
): GradientStop[] {
  if (rawStops.length === 0) {
    return [
      { id: "stop-0", color: "#059669", position: 0 },
      { id: "stop-1", color: "#0EA5E9", position: 100 },
    ];
  }
  const positions = rawStops.map((s) => s.position);
  if (positions[0] === null) positions[0] = 0;
  if (positions.length > 1 && positions[positions.length - 1] === null) {
    positions[positions.length - 1] = 100;
  }

  let i = 0;
  while (i < positions.length) {
    if (positions[i] !== null) {
      i++;
      continue;
    }
    const startIdx = Math.max(0, i - 1);
    let endIdx = i;
    while (endIdx < positions.length && positions[endIdx] === null) {
      endIdx++;
    }
    const startVal = positions[startIdx] ?? 0;
    const endVal = positions[endIdx] ?? 100;
    const span = Math.max(1, endIdx - startIdx);
    for (let k = startIdx + 1; k < endIdx; k++) {
      const ratio = (k - startIdx) / span;
      positions[k] = Math.round((startVal + (endVal - startVal) * ratio) * 10) / 10;
    }
    i = endIdx + 1;
  }

  const resolved: GradientStop[] = rawStops.map((s, idx) => ({
    id: `stop-${idx}`,
    color: s.color,
    position: Math.max(0, Math.min(100, Math.round((positions[idx] ?? 0) * 10) / 10)),
  }));

  if (resolved.length === 1) {
    resolved.push({
      id: "stop-1",
      color: resolved[0]!.color,
      position: 100,
    });
  }
  return resolved;
}

/**
 * Parses CSS `linear-gradient(...)`, `radial-gradient(...)`, or `conic-gradient(...)`
 * (including multi-stop Figma CSS strings with `rgba()` alpha channels) into structured data.
 */
export function parseCssGradient(raw?: string | null): ParsedGradientConfig | null {
  const cleaned = stripCssPropertyWrapper(raw);
  const match = /^(?:repeating-)?(linear|radial|conic)-gradient\s*\(([\s\S]*)\)$/i.exec(cleaned);
  if (!match || !match[1] || match[2] === undefined) return null;

  const kind = match[1].toLowerCase() as GradientKind;
  const args = splitTopLevelGradientArgs(match[2]);
  if (args.length < 2) return null;

  let angle = kind === "conic" ? 0 : 180;
  let radialShape: RadialGradientShape = "circle";
  let radialOrigin = "center";
  let stopStartIdx = 0;

  const firstArg = args[0]!.trim();

  if (kind === "linear") {
    const parsedAngle = parseCssAngleToken(firstArg);
    if (parsedAngle !== null) {
      angle = parsedAngle;
      stopStartIdx = 1;
    }
  } else if (kind === "radial") {
    const lowerFirst = firstArg.toLowerCase();
    const looksLikeRadialHeader =
      /\b(circle|ellipse|closest-side|farthest-side|closest-corner|farthest-corner)\b/.test(
        lowerFirst
      ) || /\bat\s+/.test(lowerFirst);
    if (looksLikeRadialHeader) {
      if (/\bellipse\b/.test(lowerFirst)) radialShape = "ellipse";
      else if (/\bcircle\b/.test(lowerFirst)) radialShape = "circle";
      const atM = /\bat\s+(.+)$/i.exec(firstArg);
      if (atM && atM[1]) {
        radialOrigin = atM[1].trim().replace(/\s+/g, " ");
      }
      stopStartIdx = 1;
    }
  } else if (kind === "conic") {
    const lowerFirst = firstArg.toLowerCase();
    if (/^from\s+/.test(lowerFirst) || /\bat\s+/.test(lowerFirst)) {
      const fromM = /^from\s+([^\s]+)/i.exec(firstArg);
      if (fromM && fromM[1]) {
        const parsedAngle = parseCssAngleToken(fromM[1]);
        if (parsedAngle !== null) angle = parsedAngle;
      }
      const atM = /\bat\s+(.+)$/i.exec(firstArg);
      if (atM && atM[1]) {
        radialOrigin = atM[1].trim().replace(/\s+/g, " ");
      }
      stopStartIdx = 1;
    }
  }

  const rawStopTokens = args.slice(stopStartIdx);
  if (rawStopTokens.length < 2) return null;

  const flattened: Array<{ color: string; position: number | null }> = [];
  for (const tok of rawStopTokens) {
    flattened.push(...parseGradientStopToken(tok, kind));
  }
  if (flattened.length < 2) return null;

  return {
    kind,
    angle: normalizeAngleDeg(angle),
    radialShape,
    radialOrigin: radialOrigin || "center",
    stops: resolveStopPositions(flattened),
  };
}

export function createDefaultGradientConfig(
  kind: GradientKind = "linear",
  seedColor?: string | null
): ParsedGradientConfig {
  const cleanSeed = (seedColor || "").trim();
  const hasUsableSeed =
    Boolean(cleanSeed) &&
    cleanSeed.toLowerCase() !== "transparent" &&
    !isCssGradientValue(cleanSeed);
  const firstColor = hasUsableSeed ? cleanSeed : "#059669";
  const secondColor =
    firstColor.toUpperCase() === "#0EA5E9" ? "#059669" : "#0EA5E9";
  return {
    kind,
    angle: kind === "conic" ? 0 : 135,
    radialShape: "circle",
    radialOrigin: "center",
    stops: [
      { id: "stop-0", color: firstColor, position: 0 },
      { id: "stop-1", color: secondColor, position: 100 },
    ],
  };
}

export function serializeCssGradient(cfg: ParsedGradientConfig): string {
  const safeStops = (Array.isArray(cfg.stops) && cfg.stops.length >= 2
    ? cfg.stops
    : createDefaultGradientConfig(cfg.kind).stops
  )
    .map((s) => ({
      ...s,
      color: (s.color || "#059669").trim() || "#059669",
      position: Math.max(0, Math.min(100, Math.round(Number(s.position) * 10) / 10)),
    }))
    .sort((a, b) => a.position - b.position);

  const stopsStr = safeStops.map((s) => `${s.color} ${s.position}%`).join(", ");
  const angle = normalizeAngleDeg(cfg.angle);
  const origin = (cfg.radialOrigin || "center").trim() || "center";

  if (cfg.kind === "radial") {
    const shape: RadialGradientShape = cfg.radialShape === "ellipse" ? "ellipse" : "circle";
    return `radial-gradient(${shape} at ${origin}, ${stopsStr})`;
  }
  if (cfg.kind === "conic") {
    return `conic-gradient(from ${angle}deg at ${origin}, ${stopsStr})`;
  }
  return `linear-gradient(${angle}deg, ${stopsStr})`;
}

export function flipGradientStops(cfg: ParsedGradientConfig): ParsedGradientConfig {
  const flipped = [...cfg.stops]
    .reverse()
    .map((s, idx) => ({
      ...s,
      id: `stop-${idx}`,
      position: Math.max(0, Math.min(100, Math.round((100 - s.position) * 10) / 10)),
    }))
    .sort((a, b) => a.position - b.position);
  return {
    ...cfg,
    stops: flipped,
  };
}

export function formatGradientSummaryLabel(raw?: string | null): string {
  const parsed = parseCssGradient(raw);
  if (!parsed) return "";
  const count = parsed.stops.length;
  const stopsWord = `${count} stop${count === 1 ? "" : "s"}`;
  if (parsed.kind === "linear") {
    return `Linear ${parsed.angle}° (${stopsWord})`;
  }
  if (parsed.kind === "radial") {
    return `Radial ${parsed.radialShape} (${stopsWord})`;
  }
  return `Conic ${parsed.angle}° (${stopsWord})`;
}

export type ThemeBorderMode = "unset" | "none" | "custom";
export type ThemeBorderStyle = "solid" | "dashed" | "dotted" | "none";

export interface ThemeBorderConfig {
  borderMode?: ThemeBorderMode | undefined;
  borderNone?: boolean | undefined;
  borderWidth?: string | undefined;
  borderStyle?: ThemeBorderStyle | undefined;
}

export function isZeroBorderWidthValue(raw?: string | number | null): boolean {
  if (raw === 0) return true;
  if (raw === undefined || raw === null) return false;
  const s = String(raw).trim().toLowerCase();
  if (!s) return false;
  if (/^0+(?:\.0+)?(?:px|rem|em|pt|%)?$/.test(s)) return true;
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && parts.every((p) => /^0+(?:\.0+)?(?:px|rem|em|pt|%)?$/.test(p))) {
    return true;
  }
  return false;
}

export function normalizeBorderStyleValue(raw?: string | null): ThemeBorderStyle | "" {
  const s = (raw || "").trim().toLowerCase();
  if (s === "solid" || s === "dashed" || s === "dotted" || s === "none") {
    return s;
  }
  return "";
}

export function parseBorderWidthNumericPx(raw?: string | number | null): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.max(0, Math.min(16, Math.round(raw)));
  }
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const m = /^(\d+(?:\.\d+)?)(?:px)?$/.exec(s);
  if (!m || !m[1]) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.max(0, Math.min(16, Math.round(n)));
}

export function resolveThemeBorderMode(input: {
  borderMode?: ThemeBorderMode | undefined;
  borderNone?: boolean | undefined;
  borderWidth?: string | undefined;
  borderStyle?: ThemeBorderStyle | undefined;
  borderColor?: string | undefined;
}): ThemeBorderMode {
  const normStyle = normalizeBorderStyleValue(input.borderStyle);
  if (
    input.borderMode === "none" ||
    input.borderNone === true ||
    normStyle === "none" ||
    isZeroBorderWidthValue(input.borderWidth)
  ) {
    return "none";
  }
  const hasWidth = Boolean((input.borderWidth || "").trim());
  const hasColor = Boolean((input.borderColor || "").trim());
  const hasVisibleStyle = normStyle === "solid" || normStyle === "dashed" || normStyle === "dotted";
  if (input.borderMode === "custom" || hasWidth || hasColor || hasVisibleStyle) {
    return "custom";
  }
  return "unset";
}

export interface GradientStateCssInput {
  selectors: string[];
  bg?: string | undefined;
  text?: string | undefined;
  border?: string | undefined;
  borderMode?: ThemeBorderMode | undefined;
  borderNone?: boolean | undefined;
  borderWidth?: string | undefined;
  fallbackBorderWidth?: string | undefined;
  borderStyle?: ThemeBorderStyle | undefined;
  borderWidthDisabled?: boolean | undefined;
  isSubState?: boolean | undefined;
  defaultHasBgGradient?: boolean | undefined;
  defaultHasTextGradient?: boolean | undefined;
  defaultHasBorderGradient?: boolean | undefined;
  defaultBorderUsedMask?: boolean | undefined;
  defaultSolidBg?: string | undefined;
  addInnerTextCascade?: boolean | undefined;
  addFocusOutline?: boolean | undefined;
}

export interface GradientStateCssResult {
  hostDecls: string[];
  extraRules: string[];
  borderUsedMask: boolean;
}

/**
 * Emits gradient-aware CSS declarations and companion rules for Background, Text,
 * and rounded-corner-safe Border values (never `border-image`!), cleanly resetting
 * inherited default gradients when a sub-state (e.g. Hover) switches back to solid color
 * or explicitly disables borders (`borderMode: "none"` / `borderNone: true` / `0px`).
 */
export function buildGradientAwareStateCss(
  input: GradientStateCssInput
): GradientStateCssResult {
  const {
    selectors,
    isSubState = false,
    defaultHasBgGradient = false,
    defaultHasTextGradient = false,
    defaultHasBorderGradient = false,
    defaultBorderUsedMask = false,
    defaultSolidBg = "",
    addInnerTextCascade = false,
    addFocusOutline = false,
    borderWidthDisabled = false,
  } = input;

  const bg = stripCssPropertyWrapper(input.bg);
  const text = stripCssPropertyWrapper(input.text);
  const rawBorder = stripCssPropertyWrapper(input.border);
  const bWidth = borderWidthDisabled ? "" : (input.borderWidth || "").trim();
  const fallbackWidth = borderWidthDisabled ? "" : (input.fallbackBorderWidth || "").trim();
  const bStyle = normalizeBorderStyleValue(input.borderStyle);

  const isBorderOff =
    input.borderMode === "none" ||
    input.borderNone === true ||
    bStyle === "none" ||
    isZeroBorderWidthValue(bWidth);

  const border = isBorderOff ? "" : rawBorder;
  const bgIsGrad = isCssGradientValue(bg);
  const textIsGrad = isCssGradientValue(text);
  const borderIsGrad = !isBorderOff && isCssGradientValue(border);

  const hostDecls: string[] = [];
  const extraRules: string[] = [];
  let borderUsedMask = false;

  const isOpaqueSolidBg = Boolean(bg) && !bgIsGrad && bg.toLowerCase() !== "transparent";
  const fallbackSolidBg =
    !bg && isSubState && defaultSolidBg && defaultSolidBg.toLowerCase() !== "transparent"
      ? defaultSolidBg
      : "";
  const layeredSolidBg = isOpaqueSolidBg ? bg : fallbackSolidBg;
  const defaultUsedLayeredBorderBg =
    isSubState && defaultHasBorderGradient && !defaultBorderUsedMask;

  // 1) BACKGROUND + ROUNDED GRADIENT BORDER LAYERED COMPOSITING
  let borderHandledByLayeredBg = false;
  if (borderIsGrad && layeredSolidBg && !textIsGrad) {
    // Solid bg + gradient border -> rounded-corner-safe padding-box / border-box composite (preserves border-radius!)
    borderHandledByLayeredBg = true;
    hostDecls.push("border-color: transparent !important;");
    hostDecls.push(
      `background: linear-gradient(${layeredSolidBg}, ${layeredSolidBg}) padding-box, ${border} border-box !important;`
    );
    const resolvedGradBorderStyle = bStyle || "solid";
    hostDecls.push(`border-style: ${resolvedGradBorderStyle} !important;`);
    if (!borderWidthDisabled) {
      const resolvedWidth =
        bWidth && !isZeroBorderWidthValue(bWidth)
          ? bWidth
          : !isSubState || !fallbackWidth || isZeroBorderWidthValue(fallbackWidth)
            ? "1px"
            : "";
      if (resolvedWidth) {
        hostDecls.push(`border-width: ${resolvedWidth} !important;`);
      }
    }
    if (isSubState && defaultBorderUsedMask) {
      const beforeSels = selectors.map((s) => `${s}::before`).join(", ");
      extraRules.push(`${beforeSels} { display: none !important; }`);
    }
  } else if (bgIsGrad) {
    hostDecls.push(`background-image: ${bg} !important;`);
    hostDecls.push("background-color: transparent !important;");
  } else if (bg) {
    if (isSubState && (defaultHasBgGradient || defaultUsedLayeredBorderBg) && !textIsGrad) {
      hostDecls.push("background-image: none !important;");
      hostDecls.push(`background-color: ${bg} !important;`);
    } else {
      if (addInnerTextCascade) {
        hostDecls.push(`background: ${bg} !important;`);
      }
      hostDecls.push(`background-color: ${bg} !important;`);
    }
  }

  // 2) TEXT (Gradient background-clip: text + clean solid-override reset)
  if (textIsGrad) {
    const gradTextDecls = [
      `background-image: ${text} !important;`,
      "-webkit-background-clip: text !important;",
      "background-clip: text !important;",
      "color: transparent !important;",
      "-webkit-text-fill-color: transparent !important;",
    ];
    const hasVisibleHostBg =
      Boolean(bg) && bg.toLowerCase() !== "transparent" && !borderUsedMask;
    if (!hasVisibleHostBg && !borderIsGrad) {
      hostDecls.push(...gradTextDecls);
    }
    const childSels = selectors.map((s) => `${s} *`).join(", ");
    extraRules.push(`${childSels} { ${gradTextDecls.join(" ")} }`);
  } else if (text) {
    if (isSubState && defaultHasTextGradient) {
      if (!bgIsGrad && !borderHandledByLayeredBg) {
        hostDecls.push("background-image: none !important;");
      }
      hostDecls.push(
        "-webkit-background-clip: border-box !important;",
        "background-clip: border-box !important;",
        `color: ${text} !important;`,
        `-webkit-text-fill-color: ${text} !important;`
      );
      const childSels = selectors.map((s) => `${s} *`).join(", ");
      const childResetDecls = [
        "background-image: none !important;",
        "-webkit-background-clip: border-box !important;",
        "background-clip: border-box !important;",
        `color: ${text} !important;`,
        `-webkit-text-fill-color: ${text} !important;`,
        ...(addInnerTextCascade ? ["text-decoration: none !important;"] : []),
      ];
      extraRules.push(`${childSels} { ${childResetDecls.join(" ")} }`);
    } else {
      hostDecls.push(`color: ${text} !important;`);
      if (addInnerTextCascade) {
        hostDecls.push(`-webkit-text-fill-color: ${text} !important;`);
      }
      if (isSubState) {
        const childSels = selectors.map((s) => `${s} *`).join(", ");
        const childDecls = addInnerTextCascade
          ? `color: ${text} !important; -webkit-text-fill-color: ${text} !important; text-decoration: none !important;`
          : `color: ${text} !important;`;
        extraRules.push(`${childSels} { ${childDecls} }`);
      }
    }
  }

  // 3) BORDER (Explicit Off/0px, Rounded Gradient ::before mask, or Custom Solid/Width/Style)
  if (isBorderOff) {
    hostDecls.push(
      "border: 0px none transparent !important;",
      "border-width: 0px !important;",
      "border-style: none !important;",
      "border-color: transparent !important;"
    );
    if (isSubState && defaultHasBorderGradient) {
      if (defaultBorderUsedMask) {
        const beforeSels = selectors.map((s) => `${s}::before`).join(", ");
        extraRules.push(`${beforeSels} { display: none !important; }`);
      } else if (!bg && !bgIsGrad && defaultSolidBg) {
        hostDecls.push(`background: ${defaultSolidBg} !important;`);
      }
    }
  } else if (borderIsGrad && !borderHandledByLayeredBg) {
    borderUsedMask = true;
    const effectiveMaskW =
      bWidth && !isZeroBorderWidthValue(bWidth)
        ? bWidth
        : fallbackWidth && !isZeroBorderWidthValue(fallbackWidth)
          ? fallbackWidth
          : "1px";
    hostDecls.push("position: relative !important;");
    hostDecls.push("border-color: transparent !important;");
    if (bWidth && !borderWidthDisabled) {
      hostDecls.push(`border-width: ${bWidth} !important;`);
      hostDecls.push(`border-style: ${bStyle || "solid"} !important;`);
    }
    const beforeSels = selectors.map((s) => `${s}::before`).join(", ");
    extraRules.push(
      `${beforeSels} { content: "" !important; position: absolute !important; inset: 0 !important; border-radius: inherit !important; padding: ${effectiveMaskW} !important; background: ${border} !important; -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0) !important; mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0) !important; -webkit-mask-composite: xor !important; mask-composite: exclude !important; pointer-events: none !important; }`
    );
  } else if (!borderHandledByLayeredBg) {
    const hasVisibleSolidColor = Boolean(border);
    const isNonTransparentSolid =
      hasVisibleSolidColor && border.toLowerCase() !== "transparent";
    const hasExplicitStyle = bStyle === "solid" || bStyle === "dashed" || bStyle === "dotted";
    const hasExplicitWidth = Boolean(bWidth) && !isZeroBorderWidthValue(bWidth);

    if (hasVisibleSolidColor) {
      hostDecls.push(`border-color: ${border} !important;`);
      if (addFocusOutline) {
        hostDecls.push(
          `outline: 2px solid ${border} !important;`,
          "outline-offset: 1px !important;"
        );
      }
      if (isSubState && defaultHasBorderGradient) {
        if (defaultBorderUsedMask) {
          const beforeSels = selectors.map((s) => `${s}::before`).join(", ");
          extraRules.push(`${beforeSels} { display: none !important; }`);
        } else if (!bg && !bgIsGrad && defaultSolidBg) {
          hostDecls.push(`background: ${defaultSolidBg} !important;`);
        }
      }
    }

    if (hasExplicitWidth) {
      hostDecls.push(`border-width: ${bWidth} !important;`);
      hostDecls.push(`border-style: ${hasExplicitStyle ? bStyle : "solid"} !important;`);
    } else if (hasExplicitStyle) {
      if (!borderWidthDisabled) {
        hostDecls.push("border-width: 1px !important;");
      }
      hostDecls.push(`border-style: ${bStyle} !important;`);
    } else if (isNonTransparentSolid && input.borderMode === "custom" && !borderWidthDisabled) {
      hostDecls.push("border-width: 1px !important;");
      hostDecls.push("border-style: solid !important;");
    }
  }

  return { hostDecls, extraRules, borderUsedMask };
}

// ============================================================================
// REUSABLE ATTRIBUTE & EFFECT DESIGN TOKENS ENGINE (`🔖 Tokens`)
// Supports Box Shadows, Text Shadows, Paint (Solid & Gradients), Borders & Radii
// with per-theme overrides (`themeOverrides`), live `:root` CSS vars, & safe fallback.
// ============================================================================

export type ThemeDesignTokenType =
  | "boxShadow"
  | "textShadow"
  | "paint"
  | "border"
  | "radius";

export type ThemeTokenAttrKey =
  | "background"
  | "text"
  | "border"
  | "boxShadow"
  | "innerShadow"
  | "textShadow"
  | "borderRadius";

export type ThemeStateTokenRefs = Partial<Record<ThemeTokenAttrKey, string>>;

export interface ThemeBoxShadowLayer {
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
  inset?: boolean | undefined;
  angle?: number | undefined;
  distance?: number | undefined;
}

export interface ThemeBoxShadowTokenValue {
  css: string;
  inset?: boolean | undefined;
  layers?: ThemeBoxShadowLayer[] | undefined;
}

export interface ThemeTextShadowTokenValue extends ThemeTextShadowConfig {
  css?: string | undefined;
}

export interface ThemeBorderTokenValue {
  width?: string | undefined;
  style?: ThemeBorderStyle | undefined;
  color?: string | undefined;
  radius?: string | undefined;
  borderMode?: ThemeBorderMode | undefined;
  borderNone?: boolean | undefined;
  css?: string | undefined;
}

export type ThemeDesignTokenValue =
  | string
  | ThemeBoxShadowTokenValue
  | ThemeTextShadowTokenValue
  | ThemeBorderTokenValue;

export interface ThemeDesignToken {
  id: string;
  name: string;
  type: ThemeDesignTokenType;
  value: ThemeDesignTokenValue;
  pinned?: boolean | undefined;
  themeOverrides?: Record<string, ThemeDesignTokenValue> | undefined;
}

export const ECMD_DESIGN_TOKENS_STORAGE_KEY = "ecmd_site_design_tokens_v1";

const VALID_DESIGN_TOKEN_TYPES = new Set<ThemeDesignTokenType>([
  "boxShadow",
  "textShadow",
  "paint",
  "border",
  "radius",
]);

export function normalizeDesignTokenThemeKey(themeId?: string | null): string {
  const raw = (themeId || "").trim().toLowerCase();
  if (!raw || raw === "cl" || raw === "coastal-light" || raw === "light") return "cl";
  if (raw === "ms" || raw === "midnight-slate" || raw === "dark") return "ms";
  return raw;
}

export function slugifyDesignTokenId(
  type: ThemeDesignTokenType,
  name: string,
  existingIds?: Iterable<string>
): string {
  const typePrefixMap: Record<ThemeDesignTokenType, string> = {
    boxShadow: "box-shadow",
    textShadow: "text-shadow",
    paint: "paint",
    border: "border",
    radius: "radius",
  };
  const prefix = `tok-${typePrefixMap[type] || "token"}`;
  const cleanSlug =
    (name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 36) || "custom";
  const base = `${prefix}-${cleanSlug}`;
  const taken = new Set(existingIds ? Array.from(existingIds) : []);
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export function getDesignTokenCssVarName(tokenId: string): string {
  const clean = (tokenId || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!clean) return "--ecmd-tok-custom";
  return clean.startsWith("tok-") ? `--ecmd-${clean}` : `--ecmd-tok-${clean}`;
}

function cloneTokenValue(val: ThemeDesignTokenValue): ThemeDesignTokenValue {
  if (val && typeof val === "object") {
    return JSON.parse(JSON.stringify(val));
  }
  return typeof val === "string" ? val : String(val ?? "");
}

function normalizeTokenValueForType(
  type: ThemeDesignTokenType,
  raw: unknown
): ThemeDesignTokenValue {
  if (type === "paint" || type === "radius") {
    return typeof raw === "string" ? raw.trim() : "";
  }
  if (type === "boxShadow") {
    if (typeof raw === "string") {
      return { css: raw.trim(), inset: /\binset\b/i.test(raw) || undefined };
    }
    if (raw && typeof raw === "object") {
      const obj = raw as ThemeBoxShadowTokenValue;
      const css = typeof obj.css === "string" ? obj.css.trim() : "";
      const layers = Array.isArray(obj.layers)
        ? obj.layers.map((l) => ({
            x: Number.isFinite(Number(l?.x)) ? Math.round(Number(l.x)) : 0,
            y: Number.isFinite(Number(l?.y)) ? Math.round(Number(l.y)) : 4,
            blur: Math.max(0, Number.isFinite(Number(l?.blur)) ? Math.round(Number(l.blur)) : 12),
            spread: Number.isFinite(Number(l?.spread)) ? Math.round(Number(l.spread)) : 0,
            color: normalizeHexColor(l?.color, "#000000"),
            opacity: clampFiniteInt(l?.opacity, 20, 0, 100),
            inset: Boolean(l?.inset),
            ...(l?.angle !== undefined ? { angle: Number(l.angle) } : {}),
            ...(l?.distance !== undefined ? { distance: Number(l.distance) } : {}),
          }))
        : undefined;
      return {
        css,
        ...(obj.inset !== undefined ? { inset: Boolean(obj.inset) } : {}),
        ...(layers && layers.length > 0 ? { layers } : {}),
      };
    }
    return { css: "" };
  }
  if (type === "textShadow") {
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      return {
        ...DEFAULT_TEXT_SHADOW_CONFIG,
        textShadowEnabled: trimmed.length > 0,
        textShadowCustom: trimmed,
        css: trimmed,
      };
    }
    if (raw && typeof raw === "object") {
      const obj = raw as ThemeTextShadowTokenValue;
      const norm = normalizeTextShadowConfig({
        ...obj,
        textShadowEnabled:
          obj.textShadowEnabled !== undefined
            ? obj.textShadowEnabled
            : Boolean(obj.css || obj.textShadowCustom),
        textShadowCustom:
          obj.textShadowCustom !== undefined
            ? obj.textShadowCustom
            : typeof obj.css === "string" && !hasExplicitTextShadowFields(obj)
              ? obj.css
              : "",
      });
      const compiled = buildTextShadowCssValue(norm);
      return {
        ...norm,
        css: compiled || (typeof obj.css === "string" ? obj.css.trim() : ""),
      };
    }
    return { ...DEFAULT_TEXT_SHADOW_CONFIG, css: "" };
  }
  // border
  if (typeof raw === "string") {
    return { css: raw.trim(), color: raw.trim() };
  }
  if (raw && typeof raw === "object") {
    const obj = raw as ThemeBorderTokenValue;
    const width = typeof obj.width === "string" ? obj.width.trim() : "";
    const style = normalizeBorderStyleValue(obj.style) || undefined;
    const color = typeof obj.color === "string" ? obj.color.trim() : "";
    const radius = typeof obj.radius === "string" ? obj.radius.trim() : "";
    const borderMode = obj.borderMode;
    const borderNone = obj.borderNone !== undefined ? Boolean(obj.borderNone) : undefined;
    return {
      ...(width ? { width } : {}),
      ...(style ? { style } : {}),
      ...(color ? { color } : {}),
      ...(radius ? { radius } : {}),
      ...(borderMode ? { borderMode } : {}),
      ...(borderNone !== undefined ? { borderNone } : {}),
      ...(typeof obj.css === "string" && obj.css.trim() ? { css: obj.css.trim() } : {}),
    };
  }
  return {};
}

export function hydrateThemeDesignTokens(rawTokens?: unknown): ThemeDesignToken[] {
  if (!Array.isArray(rawTokens)) return [];
  const seenIds = new Set<string>();
  const out: ThemeDesignToken[] = [];
  for (const item of rawTokens) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Partial<ThemeDesignToken>;
    if (!rec.type || !VALID_DESIGN_TOKEN_TYPES.has(rec.type)) continue;
    const name = (rec.name || "").trim() || "Untitled Token";
    const id =
      typeof rec.id === "string" && rec.id.trim() && !seenIds.has(rec.id.trim())
        ? rec.id.trim()
        : slugifyDesignTokenId(rec.type, name, seenIds);
    seenIds.add(id);

    const value = normalizeTokenValueForType(rec.type, rec.value);
    let themeOverrides: Record<string, ThemeDesignTokenValue> | undefined = undefined;
    if (rec.themeOverrides && typeof rec.themeOverrides === "object") {
      const nextOv: Record<string, ThemeDesignTokenValue> = {};
      for (const [k, v] of Object.entries(rec.themeOverrides)) {
        if (!k || v === undefined) continue;
        const normKey = normalizeDesignTokenThemeKey(k);
        nextOv[normKey] = normalizeTokenValueForType(rec.type, v);
      }
      if (Object.keys(nextOv).length > 0) {
        themeOverrides = nextOv;
      }
    }
    out.push({
      id,
      name,
      type: rec.type,
      value,
      ...(rec.pinned ? { pinned: true } : {}),
      ...(themeOverrides ? { themeOverrides } : {}),
    });
  }
  return out;
}

export function loadLocalDesignTokensFallback(): ThemeDesignToken[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ECMD_DESIGN_TOKENS_STORAGE_KEY);
    if (!raw) return [];
    return hydrateThemeDesignTokens(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveLocalDesignTokensFallback(tokens: ThemeDesignToken[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ECMD_DESIGN_TOKENS_STORAGE_KEY,
      JSON.stringify(hydrateThemeDesignTokens(tokens))
    );
  } catch {}
}

export function createThemeDesignToken(
  existing: ThemeDesignToken[],
  input: {
    id?: string | undefined;
    name: string;
    type: ThemeDesignTokenType;
    value: ThemeDesignTokenValue;
    themeOverrides?: Record<string, ThemeDesignTokenValue> | undefined;
  }
): ThemeDesignToken {
  const cleanName = (input.name || "").trim() || "New Token";
  const existingIds = existing.map((t) => t.id);
  const id =
    input.id && input.id.trim() && !existingIds.includes(input.id.trim())
      ? input.id.trim()
      : slugifyDesignTokenId(input.type, cleanName, existingIds);
  const value = normalizeTokenValueForType(input.type, input.value);
  let themeOverrides: Record<string, ThemeDesignTokenValue> | undefined = undefined;
  if (input.themeOverrides && typeof input.themeOverrides === "object") {
    const map: Record<string, ThemeDesignTokenValue> = {};
    for (const [k, v] of Object.entries(input.themeOverrides)) {
      if (!k || v === undefined) continue;
      map[normalizeDesignTokenThemeKey(k)] = normalizeTokenValueForType(input.type, v);
    }
    if (Object.keys(map).length > 0) themeOverrides = map;
  }
  return {
    id,
    name: cleanName,
    type: input.type,
    value,
    ...(themeOverrides ? { themeOverrides } : {}),
  };
}

export function upsertThemeDesignToken(
  tokens: ThemeDesignToken[],
  token: ThemeDesignToken
): ThemeDesignToken[] {
  const list = hydrateThemeDesignTokens(tokens);
  const idx = list.findIndex((t) => t.id === token.id);
  const norm = hydrateThemeDesignTokens([token])[0];
  if (!norm) return list;
  if (idx === -1) return [...list, norm];
  return list.map((t, i) => (i === idx ? norm : t));
}

export function updateThemeDesignTokenValue(
  tokens: ThemeDesignToken[],
  tokenId: string,
  nextValue: ThemeDesignTokenValue,
  opts?: {
    themeId?: string | undefined;
    scope?: "all" | "theme" | undefined;
  }
): ThemeDesignToken[] {
  const scope = opts?.scope || "all";
  const normTheme = opts?.themeId ? normalizeDesignTokenThemeKey(opts.themeId) : undefined;
  return hydrateThemeDesignTokens(tokens).map((tok) => {
    if (tok.id !== tokenId) return tok;
    const normalizedVal = normalizeTokenValueForType(tok.type, nextValue);
    if (scope === "theme" && normTheme) {
      return {
        ...tok,
        themeOverrides: {
          ...(tok.themeOverrides || {}),
          [normTheme]: normalizedVal,
        },
      };
    }
    // Updating base value for "All Themes"
    return {
      ...tok,
      value: normalizedVal,
    };
  });
}

export function clearThemeDesignTokenOverride(
  tokens: ThemeDesignToken[],
  tokenId: string,
  themeId: string
): ThemeDesignToken[] {
  const normTheme = normalizeDesignTokenThemeKey(themeId);
  return hydrateThemeDesignTokens(tokens).map((tok) => {
    if (tok.id !== tokenId || !tok.themeOverrides) return tok;
    const nextOv = { ...tok.themeOverrides };
    delete nextOv[normTheme];
    delete nextOv[themeId];
    return {
      ...tok,
      themeOverrides: Object.keys(nextOv).length > 0 ? nextOv : undefined,
    };
  });
}

export function renameThemeDesignToken(
  tokens: ThemeDesignToken[],
  tokenId: string,
  nextName: string
): ThemeDesignToken[] {
  const clean = (nextName || "").trim();
  if (!clean) return hydrateThemeDesignTokens(tokens);
  return hydrateThemeDesignTokens(tokens).map((tok) =>
    tok.id === tokenId ? { ...tok, name: clean } : tok
  );
}

export function duplicateThemeDesignToken(
  tokens: ThemeDesignToken[],
  tokenId: string
): { tokens: ThemeDesignToken[]; duplicated: ThemeDesignToken | null } {
  const list = hydrateThemeDesignTokens(tokens);
  const src = list.find((t) => t.id === tokenId);
  if (!src) return { tokens: list, duplicated: null };
  const copy = createThemeDesignToken(list, {
    name: `${src.name} Copy`,
    type: src.type,
    value: cloneTokenValue(src.value),
    themeOverrides: src.themeOverrides
      ? Object.fromEntries(
          Object.entries(src.themeOverrides).map(([k, v]) => [k, cloneTokenValue(v)])
        )
      : undefined,
  });
  return { tokens: [...list, copy], duplicated: copy };
}

export function deleteThemeDesignToken(
  tokens: ThemeDesignToken[],
  tokenId: string
): ThemeDesignToken[] {
  return hydrateThemeDesignTokens(tokens).filter((t) => t.id !== tokenId);
}

export function toggleThemeDesignTokenPinned(
  tokens: ThemeDesignToken[],
  tokenId: string
): ThemeDesignToken[] {
  return hydrateThemeDesignTokens(tokens).map((t) =>
    t.id === tokenId ? { ...t, pinned: t.pinned ? undefined : true } : t
  );
}

export function hasDesignTokenThemeOverride(
  token: ThemeDesignToken | null | undefined,
  activeThemeId?: string | null
): boolean {
  if (!token || !token.themeOverrides || !activeThemeId) return false;
  const normKey = normalizeDesignTokenThemeKey(activeThemeId);
  return (
    token.themeOverrides[activeThemeId] !== undefined ||
    token.themeOverrides[normKey] !== undefined
  );
}

export function resolveDesignTokenValue(
  token: ThemeDesignToken | null | undefined,
  activeThemeId?: string | null
): ThemeDesignTokenValue | undefined {
  if (!token) return undefined;
  if (activeThemeId && token.themeOverrides) {
    if (token.themeOverrides[activeThemeId] !== undefined) {
      return token.themeOverrides[activeThemeId];
    }
    const normKey = normalizeDesignTokenThemeKey(activeThemeId);
    if (token.themeOverrides[normKey] !== undefined) {
      return token.themeOverrides[normKey];
    }
  }
  return token.value;
}

export function formatBoxShadowLayersToCss(layers: ThemeBoxShadowLayer[]): string {
  return layers
    .map((l) => {
      const { r, g, b } = hexToRgbComponents(l.color);
      const op = clampFiniteInt(l.opacity, 20, 0, 100);
      const alpha = op >= 100 ? "1" : op <= 0 ? "0" : (op / 100).toFixed(2);
      const prefix = l.inset ? "inset " : "";
      return `${prefix}${Math.round(l.x)}px ${Math.round(l.y)}px ${Math.max(0, Math.round(l.blur))}px ${Math.round(l.spread)}px rgba(${r},${g},${b},${alpha})`;
    })
    .join(", ");
}

export function compileDesignTokenCssValue(
  token: ThemeDesignToken | null | undefined,
  activeThemeId?: string | null
): string {
  if (!token) return "";
  const resolved = resolveDesignTokenValue(token, activeThemeId);
  if (resolved === undefined || resolved === null) return "";

  if (token.type === "paint" || token.type === "radius") {
    return typeof resolved === "string" ? resolved.trim() : "";
  }

  if (token.type === "boxShadow") {
    if (typeof resolved === "string") return resolved.trim();
    const obj = resolved as ThemeBoxShadowTokenValue;
    if (typeof obj.css === "string" && obj.css.trim()) return obj.css.trim();
    if (Array.isArray(obj.layers) && obj.layers.length > 0) {
      return formatBoxShadowLayersToCss(obj.layers);
    }
    return "";
  }

  if (token.type === "textShadow") {
    if (typeof resolved === "string") return resolved.trim();
    const obj = resolved as ThemeTextShadowTokenValue;
    const fromCfg = buildTextShadowCssValue(obj);
    if (fromCfg) return fromCfg;
    return typeof obj.css === "string" ? obj.css.trim() : "";
  }

  if (token.type === "border") {
    if (typeof resolved === "string") return resolved.trim();
    const obj = resolved as ThemeBorderTokenValue;
    if (obj.borderMode === "none" || obj.borderNone || obj.style === "none" || isZeroBorderWidthValue(obj.width)) {
      return "0px none transparent";
    }
    if (typeof obj.css === "string" && obj.css.trim()) return obj.css.trim();
    const w = (obj.width || "1px").trim();
    const st = normalizeBorderStyleValue(obj.style) || "solid";
    const col = (obj.color || "currentColor").trim();
    return `${w} ${st} ${col}`;
  }

  return "";
}

export function resolveDesignTokenTextShadowConfig(
  token: ThemeDesignToken | null | undefined,
  activeThemeId?: string | null
): ThemeTextShadowConfig | undefined {
  if (!token || token.type !== "textShadow") return undefined;
  const resolved = resolveDesignTokenValue(token, activeThemeId);
  if (!resolved) return undefined;
  if (typeof resolved === "string") {
    const trimmed = resolved.trim();
    return {
      ...DEFAULT_TEXT_SHADOW_CONFIG,
      textShadowEnabled: trimmed.length > 0,
      textShadowCustom: trimmed,
    };
  }
  const obj = resolved as ThemeTextShadowTokenValue;
  return normalizeTextShadowConfig(obj);
}

export function resolveDesignTokenBorderConfig(
  token: ThemeDesignToken | null | undefined,
  activeThemeId?: string | null
): ThemeBorderTokenValue | undefined {
  if (!token) return undefined;
  const resolved = resolveDesignTokenValue(token, activeThemeId);
  if (!resolved) return undefined;
  if (token.type === "paint") {
    const paintVal = typeof resolved === "string" ? resolved.trim() : "";
    return paintVal ? { color: paintVal } : undefined;
  }
  if (token.type !== "border") return undefined;
  if (typeof resolved === "string") {
    return { color: resolved.trim(), css: resolved.trim() };
  }
  return resolved as ThemeBorderTokenValue;
}

/**
 * Generates clean `:root` CSS custom properties (`--ecmd-tok-<slug>: <compiledCssValue>;`)
 * for every registered ThemeDesignToken resolved against the active theme.
 */
export function buildThemeDesignTokensRootCss(
  tokens: ThemeDesignToken[] | undefined,
  activeThemeId?: string | null
): string {
  const list = hydrateThemeDesignTokens(tokens);
  if (list.length === 0) return "";
  const decls: string[] = [];
  for (const tok of list) {
    const compiled = compileDesignTokenCssValue(tok, activeThemeId);
    if (!compiled) continue;
    decls.push(`${getDesignTokenCssVarName(tok.id)}: ${compiled};`);
  }
  if (decls.length === 0) return "";
  return `:root { ${decls.join(" ")} }`;
}

export function findDesignTokenById(
  tokens: ThemeDesignToken[] | undefined,
  tokenId?: string | null
): ThemeDesignToken | undefined {
  if (!tokenId || !Array.isArray(tokens)) return undefined;
  return tokens.find((t) => t && t.id === tokenId);
}

/**
 * Converts X/Y pixel offsets to Angle (deg, 0°=top clockwise) + Distance (px) and back,
 * for ergonomic shadow token editing.
 */
export function shadowOffsetsToAngleDistance(x: number, y: number): {
  angle: number;
  distance: number;
} {
  const distance = Math.round(Math.hypot(x, y));
  if (distance === 0) return { angle: 180, distance: 0 };
  const deg = Math.round(((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360);
  return { angle: deg, distance };
}

export function shadowAngleDistanceToOffsets(angle: number, distance: number): {
  x: number;
  y: number;
} {
  const d = Math.max(0, Number.isFinite(distance) ? distance : 0);
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: Math.round(Math.cos(rad) * d),
    y: Math.round(Math.sin(rad) * d),
  };
}

// ============================================================================
// TRANSIENT LIVE CANVAS STATE PREVIEW ENGINE (Hover / Focus / Selected / Disabled)
// Pure compiler + zero-persistence live DOM `<style id="ecmd-theme-live-state-preview">`
// ============================================================================

export type ThemePreviewStateKey =
  | "default"
  | "hover"
  | "focus"
  | "selected"
  | "selectedHover"
  | "disabled";

export type ThemePreviewSubStateKey = Exclude<ThemePreviewStateKey, "default">;

export interface ThemeGroupPreviewStateThemeValues extends ThemeTextShadowConfig {
  bg?: string | undefined;
  text?: string | undefined;
  border?: string | undefined;
  icon?: string | undefined;
  outerShadow?: string | undefined;
  innerShadow?: string | undefined;
}

export interface ThemeGroupPreviewStateOverride extends ThemeTextShadowConfig {
  cl?: ThemeGroupPreviewStateThemeValues | undefined;
  ms?: ThemeGroupPreviewStateThemeValues | undefined;
  borderMode?: ThemeBorderMode | undefined;
  borderNone?: boolean | undefined;
  borderWidth?: string | undefined;
  borderStyle?: ThemeBorderStyle | undefined;
  fontWeight?: string | undefined;
  radius?: string | undefined;
  opacity?: string | undefined;
  cursorNotAllowed?: boolean | undefined;
  disabledProps?: Record<string, boolean> | undefined;
  tokenRefs?: ThemeStateTokenRefs | undefined;
}

export interface ThemeGroupPreviewInput extends ThemeTextShadowConfig {
  id: number;
  enabled?: boolean | undefined;
  name?: string | undefined;
  selector?: string | undefined;
  breakpointTarget?: "all" | "desktop" | "tablet" | "mobile" | undefined;
  radius?: string | undefined;
  clBg?: string | undefined;
  clText?: string | undefined;
  clBorder?: string | undefined;
  clIcon?: string | undefined;
  clSelBg?: string | undefined;
  clSelText?: string | undefined;
  msBg?: string | undefined;
  msText?: string | undefined;
  msBorder?: string | undefined;
  msIcon?: string | undefined;
  msSelBg?: string | undefined;
  msSelText?: string | undefined;
  borderMode?: ThemeBorderMode | undefined;
  borderNone?: boolean | undefined;
  borderWidth?: string | undefined;
  borderStyle?: ThemeBorderStyle | undefined;
  fontWeight?: string | undefined;
  clHoverBg?: string | undefined;
  clHoverText?: string | undefined;
  clFocusBorder?: string | undefined;
  clShadow?: string | undefined;
  clOuterShadow?: string | undefined;
  clInnerShadow?: string | undefined;
  clTextShadow?: ThemeTextShadowConfig | undefined;
  msHoverBg?: string | undefined;
  msHoverText?: string | undefined;
  msFocusBorder?: string | undefined;
  msShadow?: string | undefined;
  msOuterShadow?: string | undefined;
  msInnerShadow?: string | undefined;
  msTextShadow?: ThemeTextShadowConfig | undefined;
  elevation?: string | undefined;
  outerShadow?: string | undefined;
  innerShadow?: string | undefined;
  disabledProps?: Record<string, boolean> | undefined;
  tokenRefs?: ThemeStateTokenRefs | undefined;
  stateOverrides?: Partial<Record<ThemePreviewSubStateKey, ThemeGroupPreviewStateOverride>> | undefined;
}

export interface LiveStatePreviewRequest {
  groupId: string;
  selector: string;
  stateKey: ThemePreviewStateKey;
  /** Optional pre-compiled CSS; if omitted, compiled from `group` or `groups` */
  css?: string | undefined;
  group?: ThemeGroupPreviewInput | undefined;
  groups?: ThemeGroupPreviewInput[] | undefined;
  activeTheme?: string | undefined;
  designTokens?: ThemeDesignToken[] | undefined;
  targetDocuments?: Array<Document | null | undefined> | undefined;
}

export const ECMD_DYNAMIC_STYLES_ID = "ecmd-theme-dynamic-styles";
export const ECMD_LIVE_STATE_PREVIEW_STYLE_ID = "ecmd-theme-live-state-preview";

function splitPreviewShadowLayers(raw?: string): string[] {
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

function normalizePreviewOuterShadow(raw?: string): string {
  const s = (raw || "").trim();
  if (!s || /^unset$/i.test(s)) return "";
  return s;
}

function ensurePreviewInsetShadow(raw?: string): string {
  const s = (raw || "").trim();
  if (!s || /^(unset|none)$/i.test(s)) return "";
  const layers = splitPreviewShadowLayers(s);
  if (!layers.length) return "";
  return layers
    .map((layer) => (/\binset\b/i.test(layer) ? layer : `inset ${layer}`))
    .join(", ");
}

function combinePreviewBoxShadow(outerRaw?: string, innerRaw?: string): string {
  const outerClean = normalizePreviewOuterShadow(outerRaw);
  const innerClean = ensurePreviewInsetShadow(innerRaw);
  if (outerClean && outerClean.toLowerCase() !== "none" && innerClean) {
    return `${outerClean}, ${innerClean}`;
  }
  if (innerClean) return innerClean;
  if (outerClean) return outerClean;
  return "";
}

function parsePreviewOpacityCss(raw?: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  if (s.endsWith("%")) {
    const n = parseFloat(s.slice(0, -1));
    if (!Number.isFinite(n)) return "";
    return String(Math.max(0, Math.min(1, Math.round(n) / 100)));
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return "";
  if (n > 1) return String(Math.max(0, Math.min(1, Math.round(n) / 100)));
  return String(Math.max(0, Math.min(1, n)));
}

function normalizePreviewSelectorTokens(
  groupId: number | undefined,
  rawSel?: string
): string[] {
  const parts = (rawSel || "")
    .replace(", #ecmd-auth-modal", "")
    .replace("#ecmd-auth-modal,", "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith(".") || s.startsWith("#") || s.startsWith("[") ? s : `.${s}`));

  const expanded: string[] = [];
  if (typeof groupId === "number" && Number.isFinite(groupId)) {
    expanded.push(`.ecmd-group-${groupId}`);
  }
  for (const p of parts) {
    expanded.push(p);
    const lower = p.toLowerCase();
    if (lower !== p) expanded.push(lower);
  }
  return Array.from(new Set(expanded));
}

function wrapPreviewCssWithBreakpointMedia(
  css: string,
  breakpointTarget?: "all" | "desktop" | "tablet" | "mobile"
): string {
  const trimmed = css.trim();
  if (!trimmed) return "";
  if (breakpointTarget === "desktop") {
    return `@media (min-width: 1025px) {\n${trimmed}\n}`;
  }
  if (breakpointTarget === "tablet") {
    return `@media (min-width: 768px) and (max-width: 1024px) {\n${trimmed}\n}`;
  }
  if (breakpointTarget === "mobile") {
    return `@media (max-width: 767px) {\n${trimmed}\n}`;
  }
  return trimmed;
}

/**
 * Pure helper that compiles the exact cascaded visual CSS a Theme Group's matching
 * elements receive in `stateKey` (`Default` + state overrides, e.g. `Default` + `Selected`
 * + `Sel+Hover` for `"selectedHover"`, resolving all linked `tokenRefs` against `activeTheme`)
 * and targets the base selector directly WITHOUT requiring `:hover` / `:focus` / `:disabled`.
 */
export function compileGroupStatePreviewCss(
  group: ThemeGroupPreviewInput | null | undefined,
  stateKey: ThemePreviewStateKey,
  activeTheme: string = "cl",
  designTokens: ThemeDesignToken[] = []
): string {
  if (!group || group.enabled === false || stateKey === "default") return "";

  const baseTokens = normalizePreviewSelectorTokens(group.id, group.selector);
  if (baseTokens.length === 0) return "";
  const previewSelectors = baseTokens.map((s) => `${s}:not(#ecmd_preview_none)`);

  const normThemeKey = normalizeDesignTokenThemeKey(activeTheme);
  const isMs = normThemeKey === "ms";
  const themeKey: "cl" | "ms" = isMs ? "ms" : "cl";
  const otherThemeKey: "cl" | "ms" = isMs ? "cl" : "ms";
  const tokens = Array.isArray(designTokens) ? designTokens : [];

  const disabled = group.disabledProps;
  const isOff = (key: string): boolean => Boolean(disabled?.[key]);
  const isSubPropOff = (
    stOv: ThemeGroupPreviewStateOverride | undefined,
    propKey: string,
    legacyDisKey?: string
  ): boolean => {
    if (stOv?.disabledProps && stOv.disabledProps[propKey] !== undefined) {
      return Boolean(stOv.disabledProps[propKey]);
    }
    if (legacyDisKey && isOff(legacyDisKey)) return true;
    if (propKey === "outerShadow") {
      return isOff("outerShadow") || isOff("shadow") || isOff("elevation");
    }
    if (propKey === "opacity") return false;
    return isOff(propKey);
  };
  const clean = (v?: string): string => (typeof v === "string" ? v.trim() : "");

  // 1) Resolve Default layer (including linked design tokens)
  const defRefs = group.tokenRefs;
  const defBgTok = findDesignTokenById(tokens, defRefs?.background);
  const defTxtTok = findDesignTokenById(tokens, defRefs?.text);
  const defBrdTok = findDesignTokenById(tokens, defRefs?.border);
  const defBrdTokCfg = resolveDesignTokenBorderConfig(defBrdTok, activeTheme);
  const defRadTok = findDesignTokenById(tokens, defRefs?.borderRadius);
  const defBoxShadowTok = findDesignTokenById(tokens, defRefs?.boxShadow);
  const defInnerShadowTok = findDesignTokenById(tokens, defRefs?.innerShadow);
  const defTextShadowTok = findDesignTokenById(tokens, defRefs?.textShadow);

  const rawDefBg = defBgTok
    ? compileDesignTokenCssValue(defBgTok, activeTheme)
    : isMs
      ? group.msBg
      : group.clBg;
  const rawDefTxt = defTxtTok
    ? compileDesignTokenCssValue(defTxtTok, activeTheme)
    : isMs
      ? group.msText
      : group.clText;
  const rawDefBrd =
    defBrdTokCfg?.color !== undefined
      ? defBrdTokCfg.color
      : isMs
        ? group.msBorder
        : group.clBorder;
  const rawDefBorderMode =
    defBrdTok?.type === "border" && defBrdTokCfg?.borderMode !== undefined
      ? defBrdTokCfg.borderMode
      : group.borderMode;
  const rawDefBorderNone =
    defBrdTok?.type === "border" && defBrdTokCfg?.borderNone !== undefined
      ? defBrdTokCfg.borderNone
      : group.borderNone;
  const rawDefBorderWidth =
    defBrdTok?.type === "border" && defBrdTokCfg?.width !== undefined
      ? defBrdTokCfg.width
      : group.borderWidth;
  const rawDefBorderStyle =
    defBrdTok?.type === "border" && defBrdTokCfg?.style !== undefined
      ? defBrdTokCfg.style
      : group.borderStyle;
  const rawDefRad = defRadTok
    ? compileDesignTokenCssValue(defRadTok, activeTheme)
    : defBrdTok?.type === "border" && defBrdTokCfg?.radius
      ? defBrdTokCfg.radius
      : group.radius;

  const rawDefOuterBase = isMs
    ? (group.msOuterShadow ?? group.outerShadow ?? group.elevation ?? group.msShadow)
    : (group.clOuterShadow ?? group.outerShadow ?? group.elevation ?? group.clShadow);
  const rawDefInnerBase = isMs
    ? (group.msInnerShadow ?? group.innerShadow)
    : (group.clInnerShadow ?? group.innerShadow);

  const defOuterOff = isOff("outerShadow") || isOff("shadow") || isOff("elevation");
  const defInnerOff = isOff("innerShadow");
  const resolvedDefOuter = defOuterOff
    ? ""
    : clean(
        defBoxShadowTok
          ? compileDesignTokenCssValue(defBoxShadowTok, activeTheme)
          : rawDefOuterBase
      );
  const resolvedDefInner = defInnerOff
    ? ""
    : clean(
        defInnerShadowTok
          ? compileDesignTokenCssValue(defInnerShadowTok, activeTheme)
          : rawDefInnerBase
      );

  const defTextShadowCfg =
    (defTextShadowTok
      ? resolveDesignTokenTextShadowConfig(defTextShadowTok, activeTheme)
      : undefined) ??
    (isMs
      ? (group.msTextShadow ??
        (!group.clTextShadow && hasExplicitTextShadowFields(group)
          ? extractTextShadowConfig(group)
          : undefined))
      : (group.clTextShadow ??
        (!group.msTextShadow && hasExplicitTextShadowFields(group)
          ? extractTextShadowConfig(group)
          : undefined)));

  let bg = isOff("bg") ? "" : clean(rawDefBg);
  let text = isOff("text") ? "" : clean(rawDefTxt);
  let border = isOff("border") ? "" : clean(rawDefBrd);
  let icon = isOff("icon") ? "" : clean(isMs ? group.msIcon : group.clIcon);
  if (icon.toLowerCase() === "transparent") icon = "";
  let radius = isOff("radius") ? "" : clean(rawDefRad);
  let borderWidthDisabled = isOff("borderWidth");
  let borderWidth = borderWidthDisabled ? "" : clean(rawDefBorderWidth);
  let borderMode: ThemeBorderMode | undefined = isOff("border") ? undefined : rawDefBorderMode;
  let borderNone = isOff("border") ? false : Boolean(rawDefBorderNone);
  let borderStyle: ThemeBorderStyle | "" = isOff("border")
    ? ""
    : normalizeBorderStyleValue(rawDefBorderStyle);
  let fontWeight = isOff("fontWeight") ? "" : clean(group.fontWeight);
  let outerShadow = resolvedDefOuter;
  let innerShadow = resolvedDefInner;
  let textShadow = buildTextShadowCssValue(defTextShadowCfg, disabled);
  let opacity = "";
  let cursorNotAllowed = false;
  let addFocusOutline = false;

  const defaultBorderIsOff =
    borderMode === "none" ||
    borderNone ||
    borderStyle === "none" ||
    isZeroBorderWidthValue(borderWidth);
  const defaultHasBgGradient = isCssGradientValue(bg);
  const defaultHasTextGradient = isCssGradientValue(text);
  const defaultHasBorderGradient = !defaultBorderIsOff && isCssGradientValue(border);
  const defaultSolidBg = !defaultHasBgGradient && bg ? bg : "";
  const defaultGradCheck = buildGradientAwareStateCss({
    selectors: previewSelectors,
    bg,
    text,
    border,
    borderMode,
    borderNone,
    borderWidth,
    borderStyle: borderStyle || undefined,
    borderWidthDisabled,
    isSubState: false,
  });
  const defaultBorderUsedMask = defaultGradCheck.borderUsedMask;
  const fallbackDefaultBorderWidth = borderWidth;

  // 2) Cascade sub-state layers in exact browser precedence order
  const cascadeLayers: ThemePreviewSubStateKey[] =
    stateKey === "selectedHover" ? ["selected", "selectedHover"] : [stateKey];

  for (const layerKey of cascadeLayers) {
    const stOv = group.stateOverrides?.[layerKey];
    const tVals = stOv?.[themeKey];
    const stRefs = stOv?.tokenRefs;

    const legacyBg =
      layerKey === "hover"
        ? isMs
          ? group.msHoverBg
          : group.clHoverBg
        : layerKey === "selected"
          ? isMs
            ? group.msSelBg
            : group.clSelBg
          : undefined;
    const legacyText =
      layerKey === "hover"
        ? isMs
          ? group.msHoverText
          : group.clHoverText
        : layerKey === "selected"
          ? isMs
            ? group.msSelText
            : group.clSelText
          : undefined;
    const legacyBorder =
      layerKey === "focus" ? (isMs ? group.msFocusBorder : group.clFocusBorder) : undefined;
    const legacyBgDisKey =
      layerKey === "hover" ? "hoverBg" : layerKey === "selected" ? "selBg" : undefined;
    const legacyTextDisKey =
      layerKey === "hover" ? "hoverText" : layerKey === "selected" ? "selText" : undefined;
    const legacyBorderDisKey = layerKey === "focus" ? "focusBorder" : undefined;

    const stBgTok = findDesignTokenById(tokens, stRefs?.background);
    const stTxtTok = findDesignTokenById(tokens, stRefs?.text);
    const stBrdTok = findDesignTokenById(tokens, stRefs?.border);
    const stBrdTokCfg = resolveDesignTokenBorderConfig(stBrdTok, activeTheme);
    const stRadTok = findDesignTokenById(tokens, stRefs?.borderRadius);
    const stBoxShadowTok = findDesignTokenById(tokens, stRefs?.boxShadow);
    const stInnerShadowTok = findDesignTokenById(tokens, stRefs?.innerShadow);
    const stTextShadowTok = findDesignTokenById(tokens, stRefs?.textShadow);

    const stBg = isSubPropOff(stOv, "bg", legacyBgDisKey)
      ? ""
      : clean(
          stBgTok
            ? compileDesignTokenCssValue(stBgTok, activeTheme)
            : (tVals?.bg ?? legacyBg)
        );
    if (stBg) bg = stBg;

    const stTxt = isSubPropOff(stOv, "text", legacyTextDisKey)
      ? ""
      : clean(
          stTxtTok
            ? compileDesignTokenCssValue(stTxtTok, activeTheme)
            : (tVals?.text ?? legacyText)
        );
    if (stTxt) text = stTxt;

    const stBorderOffProp = isSubPropOff(stOv, "border", legacyBorderDisKey);
    const stBWDisabled = isSubPropOff(stOv, "borderWidth");
    const stBrd = stBorderOffProp
      ? ""
      : clean(
          stBrdTokCfg?.color !== undefined
            ? stBrdTokCfg.color
            : (tVals?.border ?? legacyBorder)
        );
    const stBW = stBWDisabled
      ? ""
      : clean(
          stBrdTok?.type === "border" && stBrdTokCfg?.width !== undefined
            ? stBrdTokCfg.width
            : stOv?.borderWidth
        );
    const stBorderMode = stBorderOffProp
      ? undefined
      : stBrdTok?.type === "border" && stBrdTokCfg?.borderMode !== undefined
        ? stBrdTokCfg.borderMode
        : stOv?.borderMode;
    const stBorderNone = stBorderOffProp
      ? false
      : Boolean(
          stBrdTok?.type === "border" && stBrdTokCfg?.borderNone !== undefined
            ? stBrdTokCfg.borderNone
            : stOv?.borderNone
        );
    const stBorderStyle = stBorderOffProp
      ? ""
      : normalizeBorderStyleValue(
          stBrdTok?.type === "border" && stBrdTokCfg?.style !== undefined
            ? stBrdTokCfg.style
            : stOv?.borderStyle
        );

    const layerTurnsBorderOff =
      stBorderMode === "none" ||
      stBorderNone ||
      stBorderStyle === "none" ||
      isZeroBorderWidthValue(stBW);

    if (layerTurnsBorderOff) {
      border = "";
      borderMode = "none";
      borderNone = true;
      borderWidth = "0px";
      borderStyle = "none";
      borderWidthDisabled = false;
      if (layerKey === "focus") addFocusOutline = false;
    } else {
      const layerHasVisibleBorderOverride = Boolean(
        stBrd ||
          (stBW && !isZeroBorderWidthValue(stBW)) ||
          stBorderStyle ||
          stBorderMode === "custom"
      );
      if (layerHasVisibleBorderOverride) {
        if (borderMode === "none" || borderNone || borderStyle === "none" || isZeroBorderWidthValue(borderWidth)) {
          borderMode = "custom";
          borderNone = false;
          if (borderStyle === "none") borderStyle = "";
          if (isZeroBorderWidthValue(borderWidth)) borderWidth = "";
        }
        if (stBrd) {
          border = stBrd;
          if (layerKey === "focus") addFocusOutline = true;
        }
        if (stBW) {
          borderWidth = stBW;
          borderWidthDisabled = false;
        }
        if (stBorderStyle) borderStyle = stBorderStyle;
        if (stBorderMode) borderMode = stBorderMode;
      }
    }

    const stIconRaw = isSubPropOff(stOv, "icon") ? "" : clean(tVals?.icon);
    if (stIconRaw && stIconRaw.toLowerCase() !== "transparent") {
      icon = stIconRaw;
    }

    const stRad = isSubPropOff(stOv, "radius")
      ? ""
      : clean(
          stRadTok
            ? compileDesignTokenCssValue(stRadTok, activeTheme)
            : stBrdTok?.type === "border" && stBrdTokCfg?.radius
              ? stBrdTokCfg.radius
              : stOv?.radius
        );
    if (stRad) radius = stRad;

    const stFW = isSubPropOff(stOv, "fontWeight") ? "" : clean(stOv?.fontWeight);
    if (stFW) fontWeight = stFW;

    const stOuter = isSubPropOff(stOv, "outerShadow")
      ? ""
      : clean(
          stBoxShadowTok
            ? compileDesignTokenCssValue(stBoxShadowTok, activeTheme)
            : tVals?.outerShadow
        );
    if (stOuter) outerShadow = stOuter;

    const stInner = isSubPropOff(stOv, "innerShadow")
      ? ""
      : clean(
          stInnerShadowTok
            ? compileDesignTokenCssValue(stInnerShadowTok, activeTheme)
            : tVals?.innerShadow
        );
    if (stInner) innerShadow = stInner;

    const stTextShadowCfg: ThemeTextShadowConfig | undefined =
      (stTextShadowTok
        ? resolveDesignTokenTextShadowConfig(stTextShadowTok, activeTheme)
        : undefined) ??
      (hasExplicitTextShadowFields(tVals)
        ? extractTextShadowConfig(tVals)
        : !hasExplicitTextShadowFields(stOv?.[otherThemeKey]) && hasExplicitTextShadowFields(stOv)
          ? extractTextShadowConfig(stOv)
          : undefined);
    const stTextShadow = isSubPropOff(stOv, "textShadow")
      ? ""
      : buildTextShadowCssValue(stTextShadowCfg);
    if (stTextShadow) textShadow = stTextShadow;

    if (layerKey === "disabled") {
      if (!isSubPropOff(stOv, "opacity")) {
        const parsedOp = parsePreviewOpacityCss(stOv?.opacity);
        if (parsedOp) opacity = parsedOp;
      }
      if (stOv?.cursorNotAllowed) {
        cursorNotAllowed = true;
      }
    }
  }

  // 3) Emit final cascaded declarations directly onto base selectors (NO :hover / :focus / :disabled!)
  const addInnerTextCascade = stateKey === "selected" || stateKey === "selectedHover";
  const gradRes = buildGradientAwareStateCss({
    selectors: previewSelectors,
    bg,
    text,
    border,
    borderMode,
    borderNone,
    borderWidth,
    fallbackBorderWidth: fallbackDefaultBorderWidth,
    borderStyle: borderStyle || undefined,
    borderWidthDisabled,
    isSubState: true,
    defaultHasBgGradient,
    defaultHasTextGradient,
    defaultHasBorderGradient,
    defaultBorderUsedMask,
    defaultSolidBg,
    addInnerTextCascade,
    addFocusOutline,
  });

  const decls: string[] = [...gradRes.hostDecls];
  if (radius) decls.push(`border-radius: ${radius} !important;`);
  if (fontWeight) decls.push(`font-weight: ${fontWeight} !important;`);
  const combinedShadow = combinePreviewBoxShadow(outerShadow, innerShadow);
  if (combinedShadow) decls.push(`box-shadow: ${combinedShadow} !important;`);
  if (textShadow) decls.push(`text-shadow: ${textShadow} !important;`);
  if (opacity) decls.push(`opacity: ${opacity} !important;`);
  if (cursorNotAllowed) decls.push("cursor: not-allowed !important;");

  const rules: string[] = [];
  if (decls.length > 0) {
    rules.push(`${previewSelectors.join(", ")} { ${decls.join(" ")} }`);
  }
  if (gradRes.extraRules.length > 0) {
    rules.push(...gradRes.extraRules);
  }
  if (textShadow) {
    const tsChildSels = previewSelectors.map((s) => `${s} *`).join(", ");
    rules.push(`${tsChildSels} { text-shadow: ${textShadow} !important; }`);
  }
  if (icon) {
    const iconSels = previewSelectors
      .map((s) => `${s} .theme-icon, ${s}.theme-icon`)
      .join(", ");
    rules.push(`${iconSels} { color: ${icon} !important; }`);
  }

  return wrapPreviewCssWithBreakpointMedia(rules.join("\n"), group.breakpointTarget);
}

const activeLivePreviewDocs = new Set<Document>();

function collectSameOriginPreviewDocuments(
  extraDocs?: Array<Document | null | undefined>
): Document[] {
  const visited = new Set<Document>();

  const visitDoc = (doc: Document | null | undefined, depth: number) => {
    if (!doc || visited.has(doc) || depth > 3) return;
    try {
      if (!doc.head) return;
    } catch {
      return;
    }
    visited.add(doc);

    // Discover same-origin child iframes (Plasmic Studio artboard containers)
    try {
      const frames = doc.querySelectorAll("iframe");
      frames.forEach((frame) => {
        try {
          const childDoc = frame.contentDocument;
          if (childDoc && childDoc !== doc && childDoc.readyState === "complete") {
            visitDoc(childDoc, depth + 1);
          }
        } catch {
          // Cross-origin iframe — safely ignore
        }
      });
    } catch {
      // Ignore inaccessible DOM
    }

    // Also inspect same-origin parent document (when control runs inside a same-origin host frame)
    if (depth === 0) {
      try {
        const parentWin = doc.defaultView?.parent;
        if (parentWin && parentWin !== doc.defaultView) {
          const parentDoc = parentWin.document;
          if (parentDoc && parentDoc !== doc) {
            visitDoc(parentDoc, depth + 1);
          }
        }
      } catch {
        // Cross-origin parent — safely ignore
      }
    }
  };

  if (typeof document !== "undefined") {
    visitDoc(document, 0);
  }
  if (Array.isArray(extraDocs)) {
    for (const d of extraDocs) {
      visitDoc(d, 0);
    }
  }
  return Array.from(visited);
}

function removeLivePreviewStyleFromDoc(doc: Document): void {
  try {
    const existing = doc.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID);
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  } catch {
    // Ignore detached or cross-origin documents
  }
}

function upsertLivePreviewStyleInDoc(
  doc: Document,
  css: string,
  meta: { groupId: string; selector: string; stateKey: ThemePreviewStateKey }
): void {
  try {
    const head = doc.head;
    if (!head) return;
    let styleEl = doc.getElementById(ECMD_LIVE_STATE_PREVIEW_STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = doc.createElement("style");
      styleEl.id = ECMD_LIVE_STATE_PREVIEW_STYLE_ID;
    }
    styleEl.setAttribute("data-ecmd-preview-group", meta.groupId);
    styleEl.setAttribute("data-ecmd-preview-selector", meta.selector);
    styleEl.setAttribute("data-ecmd-preview-state", meta.stateKey);
    if (styleEl.textContent !== css) {
      styleEl.textContent = css;
    }

    // Place directly AFTER #ecmd-theme-dynamic-styles if it lives in head, otherwise at the end of head
    const dynStyle = doc.getElementById(ECMD_DYNAMIC_STYLES_ID);
    if (dynStyle && dynStyle.parentNode === head) {
      if (dynStyle.nextSibling !== styleEl) {
        head.insertBefore(styleEl, dynStyle.nextSibling);
      }
    } else if (styleEl.parentNode !== head || head.lastElementChild !== styleEl) {
      head.appendChild(styleEl);
    }
    activeLivePreviewDocs.add(doc);
  } catch {
    // Never throw on restricted frames
  }
}

/**
 * Live DOM injector for transient canvas state preview (`#ecmd-theme-live-state-preview`).
 * - When `preview` is `null` or `preview.stateKey === "default"`, removes `#ecmd-theme-live-state-preview`
 *   immediately from all documents so native `:hover` / `:focus` / `:disabled` interactivity returns.
 * - Never mutates persisted Supabase or localStorage theme data.
 */
export function setLiveStatePreview(preview: LiveStatePreviewRequest | null): void {
  const clearAll = (extraDocs?: Array<Document | null | undefined>) => {
    const docs = new Set<Document>([
      ...Array.from(activeLivePreviewDocs),
      ...collectSameOriginPreviewDocuments(extraDocs),
    ]);
    docs.forEach((doc) => removeLivePreviewStyleFromDoc(doc));
    activeLivePreviewDocs.clear();
  };

  if (!preview || preview.stateKey === "default") {
    clearAll(preview?.targetDocuments);
    return;
  }

  let css = "";
  if (typeof preview.css === "string") {
    css = preview.css.trim();
  } else if (Array.isArray(preview.groups) && preview.groups.length > 0) {
    css = preview.groups
      .map((g) =>
        compileGroupStatePreviewCss(
          g,
          preview.stateKey,
          preview.activeTheme || "cl",
          preview.designTokens || []
        )
      )
      .filter(Boolean)
      .join("\n");
  } else if (preview.group) {
    const targetGroup: ThemeGroupPreviewInput = preview.group.selector
      ? preview.group
      : { ...preview.group, selector: preview.selector };
    css = compileGroupStatePreviewCss(
      targetGroup,
      preview.stateKey,
      preview.activeTheme || "cl",
      preview.designTokens || []
    );
  }

  if (!css) {
    clearAll(preview.targetDocuments);
    return;
  }

  const targetDocs = collectSameOriginPreviewDocuments(preview.targetDocuments);
  const targetDocSet = new Set(targetDocs);

  // Clean up any stale document that is no longer in the target set
  activeLivePreviewDocs.forEach((staleDoc) => {
    if (!targetDocSet.has(staleDoc)) {
      removeLivePreviewStyleFromDoc(staleDoc);
      activeLivePreviewDocs.delete(staleDoc);
    }
  });

  for (const doc of targetDocs) {
    upsertLivePreviewStyleInDoc(doc, css, {
      groupId: preview.groupId,
      selector: preview.selector,
      stateKey: preview.stateKey,
    });
  }
}

// ============================================================================
// 50+ SCALE NAVIGATION ENGINE (Natural A-Z Sort, Live Search, Pinning & Freeze)
// ============================================================================

export type ThemeListSortMode = "az" | "za" | "custom";

export const ECMD_NATURAL_ALPHA_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export interface ThemeGroupFilterSortItem {
  id: string | number;
  name?: string | undefined;
  label?: string | undefined;
  selector?: string | undefined;
  pinned?: boolean | undefined;
  tokenRefs?: ThemeStateTokenRefs | Record<string, string | undefined> | undefined;
  stateOverrides?:
    | Partial<
        Record<
          string,
          | {
              tokenRefs?: ThemeStateTokenRefs | Record<string, string | undefined> | undefined;
            }
          | undefined
        >
      >
    | undefined;
}

export type ThemeTokensLookupMap =
  | Record<string, string | { name?: string | undefined } | undefined>
  | Map<string, string | { name?: string | undefined }>
  | ReadonlyArray<Pick<ThemeDesignToken, "id" | "name">>;

export interface FilterAndSortThemeGroupsOptions {
  query?: string | undefined;
  sortBy?: ThemeListSortMode | undefined;
  tokensMap?: ThemeTokensLookupMap | undefined;
  /** Optional frozen order of IDs while user is actively renaming an item (prevents mid-keystroke jump) */
  frozenOrderIds?: ReadonlyArray<string | number> | undefined;
  /** Optional ID of the item currently being renamed so it never disappears mid-keystroke */
  focusedRenameId?: string | number | null | undefined;
}

function buildTokenNameLookup(
  tokensMap?: ThemeTokensLookupMap
): (tokenId: string) => string {
  if (!tokensMap) return () => "";
  if (Array.isArray(tokensMap)) {
    const map = new Map<string, string>();
    for (const tok of tokensMap) {
      if (tok && typeof tok.id === "string") {
        map.set(tok.id, typeof tok.name === "string" ? tok.name : "");
      }
    }
    return (id: string) => map.get(id) || "";
  }
  if (tokensMap instanceof Map) {
    return (id: string) => {
      const val = tokensMap.get(id);
      if (typeof val === "string") return val;
      if (val && typeof val === "object" && typeof val.name === "string") return val.name;
      return "";
    };
  }
  const rec = tokensMap as Record<string, string | { name?: string | undefined } | undefined>;
  return (id: string) => {
    const val = rec[id];
    if (typeof val === "string") return val;
    if (val && typeof val === "object" && typeof val.name === "string") return val.name;
    return "";
  };
}

function collectGroupLinkedTokenStrings(
  item: ThemeGroupFilterSortItem,
  resolveTokenName: (id: string) => string
): string[] {
  const out: string[] = [];
  const pushRefs = (refs?: Record<string, string | undefined>) => {
    if (!refs || typeof refs !== "object") return;
    for (const tokId of Object.values(refs)) {
      if (typeof tokId === "string" && tokId.trim()) {
        const cleanId = tokId.trim();
        out.push(cleanId);
        const resolvedName = resolveTokenName(cleanId);
        if (resolvedName) out.push(resolvedName);
      }
    }
  };
  pushRefs(item.tokenRefs as Record<string, string | undefined> | undefined);
  if (item.stateOverrides && typeof item.stateOverrides === "object") {
    for (const st of Object.values(item.stateOverrides)) {
      if (st && typeof st === "object") {
        pushRefs(st.tokenRefs as Record<string, string | undefined> | undefined);
      }
    }
  }
  return out;
}

function getThemeGroupDisplayName(item: ThemeGroupFilterSortItem): string {
  const raw = (item.name ?? item.label ?? "").trim();
  return raw || `Group ${String(item.id)}`;
}

/**
 * Pure, deterministic filter + sort helper for Theme Groups Inspector (scales effortlessly past 50+ groups).
 * - Filters case-insensitively across Group name/label, CSS selector/className, and any linked tokenRefs token names.
 * - Defaults to natural alphabetical `"az"` (`Intl.Collator` with `{ numeric: true, sensitivity: "base" }`)
 *   so `"Button 2"` sorts before `"button 10"`.
 * - Pinned items (`pinned: true`) always sort at the very top (alphabetized A-Z ahead of unpinned items).
 * - Supports `frozenOrderIds` so actively renaming a Group never jumps the card mid-keystroke.
 */
export function filterAndSortThemeGroups<T extends ThemeGroupFilterSortItem>(
  groups: readonly T[],
  options?: FilterAndSortThemeGroupsOptions
): T[] {
  const list = Array.isArray(groups) ? groups.filter((g): g is T => Boolean(g)) : [];
  if (list.length === 0) return [];

  const query = (options?.query || "").trim().toLowerCase();
  const sortBy: ThemeListSortMode = options?.sortBy || "az";
  const resolveTokenName = buildTokenNameLookup(options?.tokensMap);
  const focusedKey =
    options?.focusedRenameId !== undefined && options?.focusedRenameId !== null
      ? String(options.focusedRenameId)
      : null;

  const filtered = !query
    ? list.slice()
    : list.filter((item) => {
        if (focusedKey !== null && String(item.id) === focusedKey) return true;
        const displayName = getThemeGroupDisplayName(item).toLowerCase();
        const rawSelector = (item.selector || "").trim().toLowerCase();
        const selectorNoDots = rawSelector.replace(/[.#]/g, "");
        if (
          displayName.includes(query) ||
          rawSelector.includes(query) ||
          selectorNoDots.includes(query)
        ) {
          return true;
        }
        const linkedStrings = collectGroupLinkedTokenStrings(item, resolveTokenName);
        return linkedStrings.some((s) => s.toLowerCase().includes(query));
      });

  // If sort order is frozen during active rename typing, keep exact pre-edit order
  if (options?.frozenOrderIds && options.frozenOrderIds.length > 0) {
    const orderIndex = new Map<string, number>();
    options.frozenOrderIds.forEach((id, idx) => {
      orderIndex.set(String(id), idx);
    });
    return filtered.sort((a, b) => {
      const ia = orderIndex.has(String(a.id)) ? orderIndex.get(String(a.id))! : Number.MAX_SAFE_INTEGER;
      const ib = orderIndex.has(String(b.id)) ? orderIndex.get(String(b.id))! : Number.MAX_SAFE_INTEGER;
      if (ia !== ib) return ia - ib;
      return ECMD_NATURAL_ALPHA_COLLATOR.compare(
        getThemeGroupDisplayName(a),
        getThemeGroupDisplayName(b)
      );
    });
  }

  const originalIndex = new Map<T, number>();
  list.forEach((item, idx) => originalIndex.set(item, idx));

  return filtered.sort((a, b) => {
    const aPinned = Boolean(a.pinned);
    const bPinned = Boolean(b.pinned);
    if (aPinned !== bPinned) {
      return aPinned ? -1 : 1;
    }

    if (sortBy === "custom") {
      if (aPinned && bPinned) {
        const cmpPinned = ECMD_NATURAL_ALPHA_COLLATOR.compare(
          getThemeGroupDisplayName(a),
          getThemeGroupDisplayName(b)
        );
        if (cmpPinned !== 0) return cmpPinned;
      }
      return (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0);
    }

    const nameA = getThemeGroupDisplayName(a);
    const nameB = getThemeGroupDisplayName(b);
    const alphaCmp = ECMD_NATURAL_ALPHA_COLLATOR.compare(nameA, nameB);

    // Pinned favorites stay alphabetized A-Z at the very top
    if (aPinned && bPinned) {
      if (alphaCmp !== 0) return alphaCmp;
    } else if (alphaCmp !== 0) {
      return sortBy === "za" ? -alphaCmp : alphaCmp;
    }

    const selCmp = ECMD_NATURAL_ALPHA_COLLATOR.compare(a.selector || "", b.selector || "");
    if (selCmp !== 0) return sortBy === "za" && !aPinned ? -selCmp : selCmp;
    return ECMD_NATURAL_ALPHA_COLLATOR.compare(String(a.id), String(b.id));
  });
}

export interface FilterAndSortImageGroupsOptions {
  query?: string | undefined;
  sortBy?: ThemeListSortMode | undefined;
  activePalette?: string | undefined;
  frozenOrderIds?: ReadonlyArray<string> | undefined;
  focusedRenameId?: string | null | undefined;
}

/**
 * Pure, deterministic filter + natural A-Z sort helper for Image Groups Inspector (`🖼️ Images`).
 */
export function filterAndSortImageGroups(
  groups: readonly ThemeImageGroup[],
  options?: FilterAndSortImageGroupsOptions
): ThemeImageGroup[] {
  const list = Array.isArray(groups) ? groups.filter((g): g is ThemeImageGroup => Boolean(g)) : [];
  if (list.length === 0) return [];

  const query = (options?.query || "").trim().toLowerCase();
  const sortBy: ThemeListSortMode = options?.sortBy || "az";
  const focusedKey = options?.focusedRenameId || null;

  const filtered = !query
    ? list.slice()
    : list.filter((item) => {
        if (focusedKey && item.id === focusedKey) return true;
        const label = (item.label || "").toLowerCase();
        const selector = (item.selector || "").toLowerCase();
        const selectorNoDot = selector.replace(/[.#]/g, "");
        if (
          label.includes(query) ||
          selector.includes(query) ||
          selectorNoDot.includes(query) ||
          item.id.toLowerCase().includes(query)
        ) {
          return true;
        }
        const variants = Object.values(item.themes || {});
        return variants.some(
          (v) =>
            (v?.assetName || "").toLowerCase().includes(query) ||
            (v?.assetUrl || "").toLowerCase().includes(query)
        );
      });

  if (options?.frozenOrderIds && options.frozenOrderIds.length > 0) {
    const orderIndex = new Map<string, number>();
    options.frozenOrderIds.forEach((id, idx) => orderIndex.set(String(id), idx));
    return filtered.sort((a, b) => {
      const ia = orderIndex.has(a.id) ? orderIndex.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const ib = orderIndex.has(b.id) ? orderIndex.get(b.id)! : Number.MAX_SAFE_INTEGER;
      return ia - ib;
    });
  }

  const originalIndex = new Map<ThemeImageGroup, number>();
  list.forEach((item, idx) => originalIndex.set(item, idx));

  return filtered.sort((a, b) => {
    const aPinned = Boolean(a.pinned);
    const bPinned = Boolean(b.pinned);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;

    if (sortBy === "custom") {
      if (aPinned && bPinned) {
        const cmpPinned = ECMD_NATURAL_ALPHA_COLLATOR.compare(a.label || a.id, b.label || b.id);
        if (cmpPinned !== 0) return cmpPinned;
      }
      return (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0);
    }

    const alphaCmp = ECMD_NATURAL_ALPHA_COLLATOR.compare(a.label || a.id, b.label || b.id);
    if (aPinned && bPinned) {
      if (alphaCmp !== 0) return alphaCmp;
    } else if (alphaCmp !== 0) {
      return sortBy === "za" ? -alphaCmp : alphaCmp;
    }
    return ECMD_NATURAL_ALPHA_COLLATOR.compare(a.id, b.id);
  });
}

export interface FilterAndSortDesignTokensOptions {
  query?: string | undefined;
  sortBy?: ThemeListSortMode | undefined;
  activeThemeId?: string | undefined;
  frozenOrderIds?: ReadonlyArray<string> | undefined;
  focusedRenameId?: string | null | undefined;
}

/**
 * Pure, deterministic filter + natural A-Z sort helper for Design Tokens Manager (`🔖 Tokens`).
 */
export function filterAndSortDesignTokens(
  tokens: readonly ThemeDesignToken[],
  options?: FilterAndSortDesignTokensOptions
): ThemeDesignToken[] {
  const list = Array.isArray(tokens) ? tokens.filter((t): t is ThemeDesignToken => Boolean(t)) : [];
  if (list.length === 0) return [];

  const query = (options?.query || "").trim().toLowerCase();
  const sortBy: ThemeListSortMode = options?.sortBy || "az";
  const focusedKey = options?.focusedRenameId || null;

  const filtered = !query
    ? list.slice()
    : list.filter((tok) => {
        if (focusedKey && tok.id === focusedKey) return true;
        const name = (tok.name || "").toLowerCase();
        const id = (tok.id || "").toLowerCase();
        const cssVar = getDesignTokenCssVarName(tok.id).toLowerCase();
        const compiled = compileDesignTokenCssValue(tok, options?.activeThemeId).toLowerCase();
        return (
          name.includes(query) ||
          id.includes(query) ||
          tok.type.toLowerCase().includes(query) ||
          cssVar.includes(query) ||
          compiled.includes(query)
        );
      });

  if (options?.frozenOrderIds && options.frozenOrderIds.length > 0) {
    const orderIndex = new Map<string, number>();
    options.frozenOrderIds.forEach((id, idx) => orderIndex.set(String(id), idx));
    return filtered.sort((a, b) => {
      const ia = orderIndex.has(a.id) ? orderIndex.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const ib = orderIndex.has(b.id) ? orderIndex.get(b.id)! : Number.MAX_SAFE_INTEGER;
      return ia - ib;
    });
  }

  const originalIndex = new Map<ThemeDesignToken, number>();
  list.forEach((item, idx) => originalIndex.set(item, idx));

  return filtered.sort((a, b) => {
    const aPinned = Boolean(a.pinned);
    const bPinned = Boolean(b.pinned);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;

    if (sortBy === "custom") {
      if (aPinned && bPinned) {
        const cmpPinned = ECMD_NATURAL_ALPHA_COLLATOR.compare(a.name || a.id, b.name || b.id);
        if (cmpPinned !== 0) return cmpPinned;
      }
      return (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0);
    }

    const alphaCmp = ECMD_NATURAL_ALPHA_COLLATOR.compare(a.name || a.id, b.name || b.id);
    if (aPinned && bPinned) {
      if (alphaCmp !== 0) return alphaCmp;
    } else if (alphaCmp !== 0) {
      return sortBy === "za" ? -alphaCmp : alphaCmp;
    }
    return ECMD_NATURAL_ALPHA_COLLATOR.compare(a.id, b.id);
  });
}

// ============================================================================
// IN-GROUP ATTRIBUTE TRANSFER ENGINE (Copy Attributes From Another Group)
// Pure, deep-cloning transfer of visual styles across Groups & Image Groups
// while preserving target id, name/label, selector, and pinned 100% untouched.
// ============================================================================

export type ThemeGroupCopyScope =
  | "activeThemeAllStates"
  | "activeThemeCurrentState"
  | "allThemesAllStates";

export type ThemeImageGroupCopyScope = "activeTheme" | "allThemes";

export interface ThemeGroupCopyableItem extends ThemeTextShadowConfig {
  id: string | number;
  enabled?: boolean | undefined;
  name?: string | undefined;
  label?: string | undefined;
  selector?: string | undefined;
  pinned?: boolean | undefined;
  breakpointTarget?: "all" | "desktop" | "tablet" | "mobile" | undefined;
  fluidScale?:
    | {
        enabled?: boolean | undefined;
        desktopFontPx?: string | number | undefined;
        mobileFontPx?: string | number | undefined;
        desktopPadYPx?: string | number | undefined;
        mobilePadYPx?: string | number | undefined;
        desktopPadXPx?: string | number | undefined;
        mobilePadXPx?: string | number | undefined;
        desktopGapPx?: string | number | undefined;
        mobileGapPx?: string | number | undefined;
        stackOnMobile?: boolean | undefined;
      }
    | undefined;
  radius?: string | undefined;
  spacing?: boolean | undefined;
  padding?: string | undefined;
  margin?: string | undefined;
  gap?: string | undefined;
  clBg?: string | undefined;
  clText?: string | undefined;
  clBorder?: string | undefined;
  clIcon?: string | undefined;
  clSelBg?: string | undefined;
  clSelText?: string | undefined;
  msBg?: string | undefined;
  msText?: string | undefined;
  msBorder?: string | undefined;
  msIcon?: string | undefined;
  msSelBg?: string | undefined;
  msSelText?: string | undefined;
  borderMode?: ThemeBorderMode | undefined;
  borderNone?: boolean | undefined;
  borderWidth?: string | undefined;
  borderStyle?: ThemeBorderStyle | undefined;
  fontWeight?: string | undefined;
  clHoverBg?: string | undefined;
  clHoverText?: string | undefined;
  clFocusBorder?: string | undefined;
  clShadow?: string | undefined;
  clOuterShadow?: string | undefined;
  clInnerShadow?: string | undefined;
  clTextShadow?: ThemeTextShadowConfig | undefined;
  msHoverBg?: string | undefined;
  msHoverText?: string | undefined;
  msFocusBorder?: string | undefined;
  msShadow?: string | undefined;
  msOuterShadow?: string | undefined;
  msInnerShadow?: string | undefined;
  msTextShadow?: ThemeTextShadowConfig | undefined;
  elevation?: string | undefined;
  outerShadow?: string | undefined;
  innerShadow?: string | undefined;
  disabledProps?: Record<string, boolean> | undefined;
  attributeProfileId?: string | undefined;
  tokenRefs?: ThemeStateTokenRefs | undefined;
  stateOverrides?:
    | Partial<Record<ThemePreviewSubStateKey, ThemeGroupPreviewStateOverride>>
    | undefined;
}

export interface CopyThemeGroupAttributesParams<TStore> {
  themes: TStore;
  activeThemeId?: string | undefined;
  sourceGroupId: string | number;
  targetGroupId: string | number;
  scope?: ThemeGroupCopyScope | undefined;
  stateKey?: ThemePreviewStateKey | undefined;
}

export interface CopyImageGroupAttributesParams {
  themes: readonly ThemeImageGroup[];
  activeThemeId?: string | undefined;
  sourceImageGroupId: string;
  targetImageGroupId: string;
  scope?: ThemeImageGroupCopyScope | undefined;
  includeAsset?: boolean | undefined;
}

const ALL_SUB_STATE_KEYS: readonly ThemePreviewSubStateKey[] = [
  "hover",
  "focus",
  "selected",
  "selectedHover",
  "disabled",
];

const LEGACY_SUBSTATE_DISABLED_KEYS = new Set([
  "hoverBg",
  "hoverText",
  "selBg",
  "selText",
  "focusBorder",
]);

function deepClonePlain<V>(val: V): V {
  if (val === null || val === undefined || typeof val !== "object") {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map((item) => deepClonePlain(item)) as unknown as V;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    out[k] = deepClonePlain(v);
  }
  return out as V;
}

function hasAnyDefinedField(obj: Record<string, unknown> | undefined): boolean {
  if (!obj) return false;
  return Object.values(obj).some((v) => v !== undefined);
}

function extractSourceSubStateThemeBucket(
  source: ThemeGroupCopyableItem,
  stKey: ThemePreviewSubStateKey,
  tk: "cl" | "ms"
): ThemeGroupPreviewStateThemeValues | undefined {
  const rawBucket = source.stateOverrides?.[stKey]?.[tk];
  const merged: ThemeGroupPreviewStateThemeValues = rawBucket ? deepClonePlain(rawBucket) : {};

  if (stKey === "hover") {
    const legacyBg = tk === "ms" ? source.msHoverBg : source.clHoverBg;
    const legacyTxt = tk === "ms" ? source.msHoverText : source.clHoverText;
    if (merged.bg === undefined && legacyBg !== undefined && legacyBg !== "") {
      merged.bg = legacyBg;
    }
    if (merged.text === undefined && legacyTxt !== undefined && legacyTxt !== "") {
      merged.text = legacyTxt;
    }
  } else if (stKey === "selected") {
    const legacyBg = tk === "ms" ? source.msSelBg : source.clSelBg;
    const legacyTxt = tk === "ms" ? source.msSelText : source.clSelText;
    if (merged.bg === undefined && legacyBg !== undefined && legacyBg !== "") {
      merged.bg = legacyBg;
    }
    if (merged.text === undefined && legacyTxt !== undefined && legacyTxt !== "") {
      merged.text = legacyTxt;
    }
  } else if (stKey === "focus") {
    const legacyBrd = tk === "ms" ? source.msFocusBorder : source.clFocusBorder;
    if (merged.border === undefined && legacyBrd !== undefined && legacyBrd !== "") {
      merged.border = legacyBrd;
    }
  }

  return hasAnyDefinedField(merged as Record<string, unknown>) ? merged : undefined;
}

function copyDefaultAttributesOntoTarget<T extends ThemeGroupCopyableItem>(
  source: T,
  target: T,
  themeScope: "cl" | "ms" | "all",
  preserveLegacySubStateDisabled: boolean
): void {
  // Shared default visual attributes
  target.radius = source.radius;
  target.spacing = source.spacing;
  target.padding = source.padding;
  target.margin = source.margin;
  target.gap = source.gap;
  target.borderMode = source.borderMode;
  target.borderNone = source.borderNone;
  target.borderWidth = source.borderWidth;
  target.borderStyle = source.borderStyle;
  target.fontWeight = source.fontWeight;
  target.elevation = source.elevation;
  target.outerShadow = source.outerShadow;
  target.innerShadow = source.innerShadow;
  target.textShadowEnabled = source.textShadowEnabled;
  target.textShadowX = source.textShadowX;
  target.textShadowY = source.textShadowY;
  target.textShadowBlur = source.textShadowBlur;
  target.textShadowColor = source.textShadowColor;
  target.textShadowOpacity = source.textShadowOpacity;
  target.textShadowCustom = source.textShadowCustom;
  target.attributeProfileId = source.attributeProfileId;
  target.breakpointTarget = source.breakpointTarget;
  target.fluidScale = source.fluidScale ? deepClonePlain(source.fluidScale) : undefined;
  target.tokenRefs = source.tokenRefs ? deepClonePlain(source.tokenRefs) : undefined;

  if (preserveLegacySubStateDisabled) {
    const nextDis: Record<string, boolean> = {};
    if (target.disabledProps) {
      for (const [k, v] of Object.entries(target.disabledProps)) {
        if (LEGACY_SUBSTATE_DISABLED_KEYS.has(k)) nextDis[k] = v;
      }
    }
    if (source.disabledProps) {
      for (const [k, v] of Object.entries(source.disabledProps)) {
        if (!LEGACY_SUBSTATE_DISABLED_KEYS.has(k)) nextDis[k] = v;
      }
    }
    target.disabledProps = Object.keys(nextDis).length > 0 ? nextDis : undefined;
  } else {
    target.disabledProps = source.disabledProps ? deepClonePlain(source.disabledProps) : undefined;
  }

  if (themeScope === "all" || themeScope === "cl") {
    target.clBg = source.clBg;
    target.clText = source.clText;
    target.clBorder = source.clBorder;
    target.clIcon = source.clIcon;
    target.clShadow = source.clShadow;
    target.clOuterShadow = source.clOuterShadow;
    target.clInnerShadow = source.clInnerShadow;
    target.clTextShadow = source.clTextShadow ? deepClonePlain(source.clTextShadow) : undefined;
  }

  if (themeScope === "all" || themeScope === "ms") {
    target.msBg = source.msBg;
    target.msText = source.msText;
    target.msBorder = source.msBorder;
    target.msIcon = source.msIcon;
    target.msShadow = source.msShadow;
    target.msOuterShadow = source.msOuterShadow;
    target.msInnerShadow = source.msInnerShadow;
    target.msTextShadow = source.msTextShadow ? deepClonePlain(source.msTextShadow) : undefined;
  }
}

function copySubStateAttributesOntoTarget<T extends ThemeGroupCopyableItem>(
  source: T,
  target: T,
  stKey: ThemePreviewSubStateKey,
  themeScope: "cl" | "ms" | "all"
): void {
  const srcOv = source.stateOverrides?.[stKey];
  const prevTargetOv = target.stateOverrides?.[stKey];
  const nextOv: ThemeGroupPreviewStateOverride = prevTargetOv
    ? deepClonePlain(prevTargetOv)
    : {};

  // Shared sub-state attributes
  nextOv.borderMode = srcOv?.borderMode;
  nextOv.borderNone = srcOv?.borderNone;
  nextOv.borderWidth = srcOv?.borderWidth;
  nextOv.borderStyle = srcOv?.borderStyle;
  nextOv.fontWeight = srcOv?.fontWeight;
  nextOv.radius = srcOv?.radius;
  nextOv.opacity = srcOv?.opacity;
  nextOv.cursorNotAllowed = srcOv?.cursorNotAllowed;
  nextOv.disabledProps = srcOv?.disabledProps ? deepClonePlain(srcOv.disabledProps) : undefined;
  nextOv.tokenRefs = srcOv?.tokenRefs ? deepClonePlain(srcOv.tokenRefs) : undefined;
  nextOv.textShadowEnabled = srcOv?.textShadowEnabled;
  nextOv.textShadowX = srcOv?.textShadowX;
  nextOv.textShadowY = srcOv?.textShadowY;
  nextOv.textShadowBlur = srcOv?.textShadowBlur;
  nextOv.textShadowColor = srcOv?.textShadowColor;
  nextOv.textShadowOpacity = srcOv?.textShadowOpacity;
  nextOv.textShadowCustom = srcOv?.textShadowCustom;

  if (themeScope === "all" || themeScope === "cl") {
    const srcCl = extractSourceSubStateThemeBucket(source, stKey, "cl");
    nextOv.cl = srcCl;
    if (stKey === "hover") {
      target.clHoverBg = srcCl?.bg ?? "";
      target.clHoverText = srcCl?.text ?? "";
    } else if (stKey === "selected") {
      target.clSelBg = srcCl?.bg ?? "";
      target.clSelText = srcCl?.text ?? "";
    } else if (stKey === "focus") {
      target.clFocusBorder = srcCl?.border ?? "";
    }
  }

  if (themeScope === "all" || themeScope === "ms") {
    const srcMs = extractSourceSubStateThemeBucket(source, stKey, "ms");
    nextOv.ms = srcMs;
    if (stKey === "hover") {
      target.msHoverBg = srcMs?.bg ?? "";
      target.msHoverText = srcMs?.text ?? "";
    } else if (stKey === "selected") {
      target.msSelBg = srcMs?.bg ?? "";
      target.msSelText = srcMs?.text ?? "";
    } else if (stKey === "focus") {
      target.msFocusBorder = srcMs?.border ?? "";
    }
  }

  const nextOverrides: Partial<Record<ThemePreviewSubStateKey, ThemeGroupPreviewStateOverride>> = {
    ...(target.stateOverrides ? deepClonePlain(target.stateOverrides) : {}),
  };
  if (hasAnyDefinedField(nextOv as Record<string, unknown>)) {
    nextOverrides[stKey] = nextOv;
  } else {
    delete nextOverrides[stKey];
  }
  target.stateOverrides = Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined;
}

function applyThemeGroupAttributeCopy<T extends ThemeGroupCopyableItem>(
  source: T,
  target: T,
  opts: {
    activeThemeId?: string | undefined;
    scope: ThemeGroupCopyScope;
    stateKey: ThemePreviewStateKey;
  }
): T {
  const nextTarget = deepClonePlain(target);
  const normTheme = normalizeDesignTokenThemeKey(opts.activeThemeId);
  const activeKey: "cl" | "ms" = normTheme === "ms" ? "ms" : "cl";

  if (opts.scope === "allThemesAllStates") {
    copyDefaultAttributesOntoTarget(source, nextTarget, "all", false);
    for (const st of ALL_SUB_STATE_KEYS) {
      copySubStateAttributesOntoTarget(source, nextTarget, st, "all");
    }
  } else if (opts.scope === "activeThemeCurrentState") {
    if (opts.stateKey === "default") {
      copyDefaultAttributesOntoTarget(source, nextTarget, activeKey, true);
    } else {
      copySubStateAttributesOntoTarget(source, nextTarget, opts.stateKey, activeKey);
    }
  } else {
    // "activeThemeAllStates" (default)
    copyDefaultAttributesOntoTarget(source, nextTarget, activeKey, false);
    for (const st of ALL_SUB_STATE_KEYS) {
      copySubStateAttributesOntoTarget(source, nextTarget, st, activeKey);
    }
  }

  // Strictly preserve target identity & metadata untouched
  nextTarget.id = target.id;
  if ("name" in target) nextTarget.name = target.name;
  if ("label" in target) nextTarget.label = target.label;
  if ("selector" in target) nextTarget.selector = target.selector;
  if ("pinned" in target) nextTarget.pinned = target.pinned;
  if ("enabled" in target) nextTarget.enabled = target.enabled;

  return nextTarget;
}

/**
 * Pure, deep-cloning helper that transfers ONLY visual style attributes from `sourceGroupId`
 * onto `targetGroupId` (supporting `activeThemeAllStates`, `activeThemeCurrentState`, and
 * `allThemesAllStates`), while preserving `targetGroup`'s own `id`, `name`/`label`, `selector`,
 * and `pinned` 100% untouched with zero shared object references.
 */
export function copyThemeGroupAttributes<T extends ThemeGroupCopyableItem>(
  params: CopyThemeGroupAttributesParams<Record<string, T>>
): Record<string, T>;
export function copyThemeGroupAttributes<T extends ThemeGroupCopyableItem>(
  params: CopyThemeGroupAttributesParams<readonly T[]>
): T[];
export function copyThemeGroupAttributes<T extends ThemeGroupCopyableItem>(
  params: CopyThemeGroupAttributesParams<Record<string, T> | readonly T[]>
): Record<string, T> | T[] {
  const {
    themes,
    activeThemeId = "cl",
    sourceGroupId,
    targetGroupId,
    scope = "activeThemeAllStates",
    stateKey = "default",
  } = params;

  const srcIdStr = String(sourceGroupId);
  const tgtIdStr = String(targetGroupId);

  if (Array.isArray(themes)) {
    if (srcIdStr === tgtIdStr) return themes.map((g) => deepClonePlain(g));
    const source = themes.find((g) => g && String(g.id) === srcIdStr);
    const target = themes.find((g) => g && String(g.id) === tgtIdStr);
    if (!source || !target) return themes.map((g) => deepClonePlain(g));
    const updatedTarget = applyThemeGroupAttributeCopy(source, target, {
      activeThemeId,
      scope,
      stateKey,
    });
    return themes.map((g) => (g && String(g.id) === tgtIdStr ? updatedTarget : deepClonePlain(g)));
  }

  const record = (themes || {}) as Record<string, T>;
  const clonedRecord: Record<string, T> = {};
  let source: T | undefined;
  let target: T | undefined;
  let targetRecordKey: string | undefined;

  for (const [k, g] of Object.entries(record)) {
    if (!g) continue;
    clonedRecord[k] = deepClonePlain(g);
    if (k === srcIdStr || String(g.id) === srcIdStr) source = g;
    if (k === tgtIdStr || String(g.id) === tgtIdStr) {
      target = g;
      targetRecordKey = k;
    }
  }

  if (!source || !target || !targetRecordKey || srcIdStr === tgtIdStr) {
    return clonedRecord;
  }

  clonedRecord[targetRecordKey] = applyThemeGroupAttributeCopy(source, target, {
    activeThemeId,
    scope,
    stateKey,
  });
  return clonedRecord;
}

/**
 * Pure, deep-cloning helper that transfers sizing, fit, alignment, opacity (and optionally
 * `assetUrl`/`assetName` when `includeAsset === true`) from `sourceImageGroupId` onto
 * `targetImageGroupId` across either the active theme or all themes, while preserving
 * `targetGroup`'s own `id`, `label`, `selector`, and `pinned` 100% untouched.
 */
export function copyImageGroupAttributes(
  params: CopyImageGroupAttributesParams
): ThemeImageGroup[] {
  const {
    themes,
    activeThemeId = "cl",
    sourceImageGroupId,
    targetImageGroupId,
    scope = "activeTheme",
    includeAsset = false,
  } = params;

  const synced = syncImageGroupSlotsAcrossThemes(Array.isArray(themes) ? [...themes] : []);
  const source = synced.find((g) => g.id === sourceImageGroupId);
  const target = synced.find((g) => g.id === targetImageGroupId);
  if (!source || !target || source.id === target.id) {
    return deepClonePlain(synced);
  }

  const activeKey = normalizeThemeImagePaletteKey(activeThemeId);
  const keysToCopy =
    scope === "allThemes"
      ? Array.from(
          new Set([
            ...DEFAULT_THEME_PALETTE_KEYS,
            ...Object.keys(source.themes || {}),
            ...Object.keys(target.themes || {}),
          ])
        )
      : [activeKey];

  const nextThemes: Record<string, ThemeImageVariantConfig> = deepClonePlain(target.themes || {});
  for (const tk of keysToCopy) {
    const srcVar = deepClonePlain(getThemeImageGroupVariant(source, tk));
    const tgtVar = deepClonePlain(getThemeImageGroupVariant(target, tk));
    nextThemes[tk] = includeAsset
      ? srcVar
      : {
          ...srcVar,
          assetUrl: tgtVar.assetUrl,
          assetName: tgtVar.assetName,
        };
  }

  const updatedTarget: ThemeImageGroup = {
    id: target.id,
    label: target.label,
    selector: target.selector,
    ...(target.pinned ? { pinned: true } : {}),
    themes: nextThemes,
  };

  return synced.map((g) => (g.id === target.id ? updatedTarget : deepClonePlain(g)));
}
