import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act, waitFor } from "@testing-library/react";
import { EcmdThemeGroupController } from "../components/EcmdThemeGroupController";
import {
  EcmdDynamicGroupManagerControl,
  buildInitialGroupsFromProps,
} from "../components/EcmdDynamicGroupManager";
import {
  buildThemeImageGroupsCss,
  createThemeImageGroup,
  getThemeImageGroupVariant,
  syncImageGroupSlotsAcrossThemes,
  updateThemeImageGroupVariant,
  uploadThemeAssetFile,
  type ThemeImageGroup,
} from "../lib/ecmdThemeEngine";

describe("Theme-Aware 🖼️ Images Groups Engine", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("syncs created Image Group slots (id, label, selector) across themes while keeping assetUrl, width, height, and mobile sizing independent per theme", () => {
    // 1) Pure engine helper verification
    const created = createThemeImageGroup([], "Header Wordmark Logo");
    expect(created.id).toBe("header-wordmark-logo");
    expect(created.selector).toBe(".ecmd-img-header-wordmark-logo");

    let groups: ThemeImageGroup[] = syncImageGroupSlotsAcrossThemes([created], ["cl", "ms"]);
    expect(groups[0]?.themes["cl"]?.assetUrl).toBe("");
    expect(groups[0]?.themes["ms"]?.assetUrl).toBe("");

    // Set Dark theme (ms) asset & size only
    groups = updateThemeImageGroupVariant(groups, created.id, "midnight-slate", {
      assetUrl: "https://cdn.example.com/ecmd-white-logo.svg",
      assetName: "ECMD White Logo.svg",
      width: "240px",
      height: "64px",
      mobileWidth: "160px",
      objectFit: "contain",
    });

    // Set Light theme (cl) size only while leaving assetUrl empty (keep Plasmic default!)
    groups = updateThemeImageGroupVariant(groups, created.id, "coastal-light", {
      width: "220px",
      height: "60px",
    });

    const clVar = getThemeImageGroupVariant(groups[0]!, "coastal-light");
    const msVar = getThemeImageGroupVariant(groups[0]!, "midnight-slate");

    expect(clVar.assetUrl).toBe("");
    expect(clVar.width).toBe("220px");
    expect(clVar.height).toBe("60px");

    expect(msVar.assetUrl).toBe("https://cdn.example.com/ecmd-white-logo.svg");
    expect(msVar.assetName).toBe("ECMD White Logo.svg");
    expect(msVar.width).toBe("240px");
    expect(msVar.height).toBe("64px");
    expect(msVar.mobileWidth).toBe("160px");

    // 2) Full UI test inside [Site Themes] -> 🖼️ Images tab
    const initPayload = buildInitialGroupsFromProps({}, undefined);
    const onUpdate = vi.fn();

    const { container, rerender } = render(
      <EcmdDynamicGroupManagerControl
        value={JSON.stringify(initPayload)}
        componentProps={{ presetTheme: "coastal-light" }}
        updateValue={onUpdate}
      />
    );

    const syncLatest = () => {
      const latest = onUpdate.mock.calls[onUpdate.mock.calls.length - 1]?.[0] as string;
      rerender(
        <EcmdDynamicGroupManagerControl
          value={latest}
          componentProps={{ presetTheme: "coastal-light" }}
          updateValue={onUpdate}
        />
      );
      return JSON.parse(latest);
    };

    // Open modal if closed
    if (!document.querySelector('[data-ecmd-studio-tab="images"]')) {
      act(() => {
        fireEvent.click(container.querySelector("button")!);
      });
    }

    // Switch to 🖼️ Images tab
    const imagesTabBtn = document.querySelector('[data-ecmd-studio-tab="images"]') as HTMLButtonElement;
    expect(imagesTabBtn).toBeInTheDocument();
    act(() => {
      fireEvent.click(imagesTabBtn);
    });

    // Click [+ New Image Group]
    const newImgBtn = document.querySelector('[data-ecmd-new-image-group-btn="true"]') as HTMLButtonElement;
    expect(newImgBtn).toBeInTheDocument();
    act(() => {
      fireEvent.click(newImgBtn);
    });
    const afterAdd = syncLatest();
    expect(afterAdd.imageGroups).toHaveLength(1);
    const slotId = afterAdd.imageGroups[0].id as string;
    expect(afterAdd.imageGroups[0].selector).toBe(".ecmd-img-header-wordmark-logo");

    // Edit Light theme width to 210px and keep asset empty
    const widthInput = document.querySelector(`[data-ecmd-image-width-input="${slotId}"]`) as HTMLInputElement;
    act(() => {
      fireEvent.change(widthInput, { target: { value: "210px" } });
    });
    syncLatest();

    // Switch palette dropdown to Dark theme ("ms") -> same slot appears with empty dropzone & independent width!
    const paletteSelect = document.querySelector('[data-ecmd-studio-palette-select="true"]') as HTMLSelectElement;
    act(() => {
      fireEvent.change(paletteSelect, { target: { value: "ms" } });
    });

    const darkUrlInput = document.querySelector(`[data-ecmd-image-url-input="${slotId}"]`) as HTMLInputElement;
    expect(darkUrlInput.value).toBe("");
    expect((document.querySelector(`[data-ecmd-image-width-input="${slotId}"]`) as HTMLInputElement).value).toBe("");

    // Enter Dark theme white logo URL + 250px width
    act(() => {
      fireEvent.change(darkUrlInput, { target: { value: "https://cdn.example.com/white-wordmark.svg" } });
    });
    syncLatest();
    act(() => {
      fireEvent.change(document.querySelector(`[data-ecmd-image-width-input="${slotId}"]`)!, {
        target: { value: "250px" },
      });
    });
    const finalPayload = syncLatest();

    expect(finalPayload.imageGroups[0].themes.cl.assetUrl).toBe("");
    expect(finalPayload.imageGroups[0].themes.cl.width).toBe("210px");
    expect(finalPayload.imageGroups[0].themes.ms.assetUrl).toBe("https://cdn.example.com/white-wordmark.svg");
    expect(finalPayload.imageGroups[0].themes.ms.width).toBe("250px");
  });

  it("swaps <img> (with srcset) and <svg> elements + emits per-theme width/height/mobile CSS, and restores originals when switching to a theme with assetUrl === ''", async () => {
    const basePayload = buildInitialGroupsFromProps({}, undefined);
    const logoGroup: ThemeImageGroup = {
      id: "header-logo",
      label: "Header Wordmark Logo",
      selector: ".ecmd-img-header-logo",
      themes: {
        cl: {
          assetUrl: "",
          assetName: "",
          width: "220px",
          height: "60px",
          objectFit: "contain",
          objectPosition: "left center",
        },
        ms: {
          assetUrl: "https://cdn.example.com/ecmd-white-logo.svg",
          assetName: "ECMD White Logo.svg",
          width: "240px",
          height: "64px",
          mobileWidth: "160px",
          mobileHeight: "42px",
          maxWidth: "100%",
          objectFit: "contain",
          objectPosition: "center",
          opacity: 95,
        },
      },
    };

    const json = JSON.stringify({
      ...basePayload,
      imageGroups: [logoGroup],
    });

    // Mount target <img> (with responsive srcset) AND Plasmic <svg> icon in the document
    const stage = document.createElement("div");
    stage.innerHTML = `
      <img id="test-header-img" class="ecmd-img-header-logo" src="/ecmd-black-logo.svg" srcset="/ecmd-black-logo.svg 1x, /ecmd-black-logo@2x.svg 2x" />
      <svg id="test-header-svg" class="ecmd-img-header-logo" width="220" height="60" viewBox="0 0 220 60">
        <path id="orig-svg-path" d="M0 0 L220 60" fill="#000000" />
      </svg>
    `;
    document.body.appendChild(stage);

    try {
      // Render in Dark Theme (midnight-slate) -> BOTH <img> and <svg> swap to white logo + emit 240px/64px + mobile 160px/42px CSS
      const { container, rerender, unmount } = render(
        <EcmdThemeGroupController
          presetTheme="midnight-slate"
          matchSystemTheme={false}
          dynamicGroupsJson={json}
        />
      );

      const img = document.getElementById("test-header-img") as HTMLImageElement;
      const svg = document.getElementById("test-header-svg") as unknown as SVGElement;
      const svgPath = document.getElementById("orig-svg-path");

      // Verify <img> swap & srcset clearing
      expect(img.getAttribute("src")).toBe("https://cdn.example.com/ecmd-white-logo.svg");
      expect(img.hasAttribute("srcset")).toBe(false);
      expect(img.getAttribute("data-ecmd-orig-src")).toBe("/ecmd-black-logo.svg");
      expect(img.getAttribute("data-ecmd-orig-srcset")).toBe(
        "/ecmd-black-logo.svg 1x, /ecmd-black-logo@2x.svg 2x"
      );

      // Verify <svg> swap is non-destructive (preserves child <path>!) and sets background-image + swap flag
      expect(svg.getAttribute("data-ecmd-svg-swapped")).toBe("true");
      expect(svg.getAttribute("data-ecmd-swapped-url")).toBe(
        "https://cdn.example.com/ecmd-white-logo.svg"
      );
      expect(svg.style.backgroundImage).toContain("https://cdn.example.com/ecmd-white-logo.svg");
      expect(svg.contains(svgPath)).toBe(true);

      // Verify emitted CSS includes Dark Theme sizing, opacity, mobile override, and SVG child hide rule
      const darkStyle = container.querySelector("style")?.textContent || "";
      expect(darkStyle).toContain('svg[data-ecmd-svg-swapped="true"] > *');
      expect(darkStyle).toContain("width: 240px !important;");
      expect(darkStyle).toContain("height: 64px !important;");
      expect(darkStyle).toContain("opacity: 0.95 !important;");
      expect(darkStyle).toContain("@media (max-width: 767px)");
      expect(darkStyle).toContain("width: 160px !important;");
      expect(darkStyle).toContain("height: 42px !important;");

      // Verify MutationObserver automatically swaps newly mounted Plasmic artboard elements
      const lateArtboardImg = document.createElement("img");
      lateArtboardImg.id = "mobile-artboard-img";
      lateArtboardImg.className = "ecmd-img-header-logo";
      lateArtboardImg.setAttribute("src", "/original-mobile.png");
      stage.appendChild(lateArtboardImg);

      await waitFor(() => {
        expect(lateArtboardImg.getAttribute("src")).toBe(
          "https://cdn.example.com/ecmd-white-logo.svg"
        );
      });

      // Switch to Light Theme (coastal-light) where assetUrl === "" -> restores original <img> src/srcset & original <svg>!
      rerender(
        <EcmdThemeGroupController
          presetTheme="coastal-light"
          matchSystemTheme={false}
          dynamicGroupsJson={json}
        />
      );

      expect(img.getAttribute("src")).toBe("/ecmd-black-logo.svg");
      expect(img.getAttribute("srcset")).toBe(
        "/ecmd-black-logo.svg 1x, /ecmd-black-logo@2x.svg 2x"
      );
      expect(img.hasAttribute("data-ecmd-img-swapped")).toBe(false);

      expect(svg.hasAttribute("data-ecmd-svg-swapped")).toBe(false);
      expect(svg.style.backgroundImage).toBe("");
      expect(svg.contains(svgPath)).toBe(true);

      expect(lateArtboardImg.getAttribute("src")).toBe("/original-mobile.png");

      // Light theme CSS uses Coastal Light's 220px/60px and no mobile override
      const lightStyle = container.querySelector("style")?.textContent || "";
      expect(lightStyle).toContain("width: 220px !important;");
      expect(lightStyle).toContain("height: 60px !important;");
      expect(lightStyle).not.toContain("width: 240px !important;");

      // Verify buildThemeImageGroupsCss standalone check
      expect(buildThemeImageGroupsCss([logoGroup], "coastal-light")).toContain(
        "object-position: left center !important;"
      );

      unmount();
    } finally {
      stage.remove();
    }
  });

  it("uploads assets to Supabase ecmd-theme-assets when reachable and falls back cleanly to a Data URI when offline", async () => {
    const svgFile = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], "white-logo.svg", {
      type: "image/svg+xml",
    });

    // 1) Successful Supabase upload
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ Key: "ecmd-theme-assets/test" }), { status: 200 }));

    const cloudResult = await uploadThemeAssetFile(svgFile, {
      groupId: "header-logo",
      themeKey: "ms",
    });
    expect(cloudResult.storageMode).toBe("supabase");
    expect(cloudResult.url).toContain("/storage/v1/object/public/ecmd-theme-assets/header-logo/ms-");
    expect(cloudResult.fileName).toBe("white-logo.svg");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // 2) Offline / failed upload -> clean Data URI fallback
    fetchSpy.mockRejectedValueOnce(new Error("Network offline"));
    const localResult = await uploadThemeAssetFile(svgFile, {
      groupId: "header-logo",
      themeKey: "ms",
    });
    expect(localResult.storageMode).toBe("data-uri");
    expect(localResult.url.startsWith("data:image/svg+xml")).toBe(true);
    expect(localResult.fileName).toBe("white-logo.svg");
  });
});
