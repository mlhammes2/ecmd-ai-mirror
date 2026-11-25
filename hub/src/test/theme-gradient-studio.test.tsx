import React, { useState } from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import {
  ECMD_GRADIENT_PRESETS,
  detectColorPickerMode,
  flipGradientStops,
  formatGradientSummaryLabel,
  isCssGradientValue,
  parseCssGradient,
  serializeCssGradient,
} from "../lib/ecmdThemeEngine";
import { makeCssRule } from "../components/EcmdThemeGroupController";
import { EcmdPlasmicColorRow } from "../components/EcmdPlasmicColorRow";

describe("Site Themes -> Groups -> Visual Gradient Color Studio & Smart CSS Engine", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("parses and serializes linear, radial, and conic gradients including multi-stop Figma CSS with rgba alpha stops", () => {
    // 1. Pasted Figma linear gradient with background: wrapper, rgba alpha stops, and 3 stops
    const figmaLinear =
      "background: linear-gradient(135deg, rgba(16, 185, 129, 0.9) 0%, #0EA5E9 48%, rgba(15, 23, 42, 0.25) 100%);";
    expect(isCssGradientValue(figmaLinear)).toBe(true);
    expect(detectColorPickerMode(figmaLinear)).toBe("linear");

    const parsedLinear = parseCssGradient(figmaLinear);
    expect(parsedLinear).not.toBeNull();
    expect(parsedLinear?.kind).toBe("linear");
    expect(parsedLinear?.angle).toBe(135);
    expect(parsedLinear?.stops).toHaveLength(3);
    expect(parsedLinear?.stops[0]).toMatchObject({ color: "rgba(16, 185, 129, 0.9)", position: 0 });
    expect(parsedLinear?.stops[1]).toMatchObject({ color: "#0EA5E9", position: 48 });
    expect(parsedLinear?.stops[2]).toMatchObject({ color: "rgba(15, 23, 42, 0.25)", position: 100 });
    expect(serializeCssGradient(parsedLinear!)).toBe(
      "linear-gradient(135deg, rgba(16, 185, 129, 0.9) 0%, #0EA5E9 48%, rgba(15, 23, 42, 0.25) 100%)"
    );
    expect(formatGradientSummaryLabel(figmaLinear)).toBe("Linear 135° (3 stops)");

    // Direction keyword linear gradient + missing intermediate positions auto-distributed
    const keywordLinear = parseCssGradient("linear-gradient(to bottom right, #059669, #10B981, #34D399)");
    expect(keywordLinear?.angle).toBe(135);
    expect(keywordLinear?.stops.map((s) => s.position)).toEqual([0, 50, 100]);

    // Flipping reverses stop order and mirrors percentages cleanly
    const flipped = flipGradientStops(parsedLinear!);
    expect(flipped.stops.map((s) => ({ color: s.color, position: s.position }))).toEqual([
      { color: "rgba(15, 23, 42, 0.25)", position: 0 },
      { color: "#0EA5E9", position: 52 },
      { color: "rgba(16, 185, 129, 0.9)", position: 100 },
    ]);

    // 2. Radial gradient with shape + origin + transparent alpha stop
    const radialCss = "radial-gradient(ellipse at top left, rgba(20, 184, 166, 0.65) 0%, #0F172A 100%)";
    expect(detectColorPickerMode(radialCss)).toBe("radial");
    const parsedRadial = parseCssGradient(radialCss);
    expect(parsedRadial?.kind).toBe("radial");
    expect(parsedRadial?.radialShape).toBe("ellipse");
    expect(parsedRadial?.radialOrigin).toBe("top left");
    expect(serializeCssGradient(parsedRadial!)).toBe(radialCss);
    expect(formatGradientSummaryLabel(radialCss)).toBe("Radial ellipse (2 stops)");

    // 3. Conic gradient with from angle + deg stop positions
    const conicCss = "conic-gradient(from 90deg at center, #059669 0deg, #0EA5E9 180deg, #059669 360deg)";
    expect(detectColorPickerMode(conicCss)).toBe("conic");
    const parsedConic = parseCssGradient(conicCss);
    expect(parsedConic?.kind).toBe("conic");
    expect(parsedConic?.angle).toBe(90);
    expect(parsedConic?.stops.map((s) => s.position)).toEqual([0, 50, 100]);
    expect(serializeCssGradient(parsedConic!)).toBe(
      "conic-gradient(from 90deg at center, #059669 0%, #0EA5E9 50%, #059669 100%)"
    );
    expect(formatGradientSummaryLabel(conicCss)).toBe("Conic 90° (3 stops)");
  });

  it("emits smart gradient Background CSS and explicitly clears background-image: none when Hover switches back to solid color", () => {
    const gradBg = "linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%)";
    const css = makeCssRule(
      6,
      true,
      ".cta-pill",
      gradBg,
      "#FFFFFF",
      "",
      "9999px",
      false,
      "",
      "",
      "",
      "",
      false,
      "",
      "",
      "",
      {
        isMs: false,
        stateOverrides: {
          hover: {
            cl: {
              bg: "#0842A0",
              text: "#FFFFFF",
            },
          },
        },
      }
    );

    // Default uses background-image + transparent background-color
    expect(css).toContain(`background-image: ${gradBg} !important; background-color: transparent !important;`);
    // Hover switches back to solid -> MUST emit background-image: none so default gradient never bleeds through!
    expect(css).toMatch(
      /\.cta-pill:hover[^}]*background-image: none !important; background-color: #0842A0 !important;/
    );
  });

  it("emits background-clip: text CSS for Gradient Text and cleanly resets clip/fill when a state overrides back to solid text", () => {
    const gradText = "linear-gradient(90deg, #10B981 0%, #38BDF8 100%)";
    const css = makeCssRule(
      9,
      true,
      ".hero-gradient-title",
      "transparent",
      gradText,
      "",
      "",
      false,
      "",
      "",
      "",
      "",
      false,
      "",
      "",
      "",
      {
        isMs: false,
        stateOverrides: {
          hover: {
            cl: {
              text: "#0F172A",
            },
          },
        },
      }
    );

    expect(css).toContain(
      `background-image: ${gradText} !important; -webkit-background-clip: text !important; background-clip: text !important; color: transparent !important; -webkit-text-fill-color: transparent !important;`
    );
    expect(css).toContain(
      `.ecmd-group-9 *, .hero-gradient-title * { background-image: ${gradText} !important; -webkit-background-clip: text !important; background-clip: text !important; color: transparent !important; -webkit-text-fill-color: transparent !important; }`
    );
    // Hover override resets back to solid color cleanly
    expect(css).toMatch(
      /\.hero-gradient-title:hover[^}]*background-image: none !important; -webkit-background-clip: border-box !important; background-clip: border-box !important; color: #0F172A !important; -webkit-text-fill-color: #0F172A !important;/
    );
  });

  it("emits rounded-corner-safe Gradient Border CSS (NEVER border-image!) for both solid-bg cards and transparent/gradient-bg elements", () => {
    const gradBorder = "linear-gradient(135deg, #10B981 0%, #0EA5E9 100%)";

    // Case A: Solid background + gradient border -> padding-box / border-box composite preserving 12px border-radius
    const solidBgCardCss = makeCssRule(
      4,
      true,
      ".rounded-grad-card",
      "#0F172A",
      "#F8FAFC",
      gradBorder,
      "12px",
      false,
      "",
      "",
      "",
      "",
      false,
      "",
      "",
      "",
      {
        borderWidth: "2px",
        isMs: true,
      }
    );
    expect(solidBgCardCss).not.toContain("border-image");
    expect(solidBgCardCss).toContain("border-color: transparent !important;");
    expect(solidBgCardCss).toContain(
      `background: linear-gradient(#0F172A, #0F172A) padding-box, ${gradBorder} border-box !important;`
    );
    expect(solidBgCardCss).toContain("border-radius: 12px !important;");

    // Case B: Transparent / gradient background + gradient border -> ::before mask composite preserving border-radius
    const glassCardCss = makeCssRule(
      5,
      true,
      ".glass-grad-card",
      "transparent",
      "#FFFFFF",
      gradBorder,
      "16px",
      false,
      "",
      "",
      "",
      "",
      false,
      "",
      "",
      "",
      {
        borderWidth: "2px",
        isMs: true,
      }
    );
    expect(glassCardCss).not.toContain("border-image");
    expect(glassCardCss).toContain("position: relative !important; border-color: transparent !important;");
    expect(glassCardCss).toContain(".glass-grad-card::before");
    expect(glassCardCss).toContain("border-radius: inherit !important;");
    expect(glassCardCss).toContain("padding: 2px !important;");
    expect(glassCardCss).toContain("-webkit-mask-composite: xor !important; mask-composite: exclude !important;");
  });

  it("supports full interactive Color & Gradient Studio popover workflow (mode auto-detect, multi-stop add/flip/delete, angle chips, saved gradients, Figma paste, and readable row badge)", () => {
    function Harness({ initial }: { initial: string }) {
      const [val, setVal] = useState(initial);
      return (
        <div>
          <EcmdPlasmicColorRow propKey="bg" label="Background" value={val} onChange={setVal} />
          <output data-testid="current-value">{val}</output>
        </div>
      );
    }

    const { getByTestId } = render(<Harness initial="#059669" />);

    // Open popover -> defaults to Solid mode
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-color-swatch="bg"]')!);
    });
    expect(
      document.querySelector('[data-ecmd-color-studio-popover="true"]')?.getAttribute("data-ecmd-color-studio-mode")
    ).toBe("solid");

    // Switch to Linear mode -> seeds 2-stop gradient & displays summary badge
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-color-mode-tab="linear"]')!);
    });
    expect(getByTestId("current-value").textContent).toBe(
      "linear-gradient(135deg, #059669 0%, #0EA5E9 100%)"
    );
    expect(document.querySelector('[data-ecmd-gradient-badge="true"]')?.textContent).toContain(
      "Linear 135° (2 stops)"
    );

    // Click 90° direction chip -> angle updates to 90deg
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-gradient-dir="90"]')!);
    });
    expect(getByTestId("current-value").textContent).toContain("linear-gradient(90deg,");

    // Click [+ Stop] -> adds 3rd stop at 50%
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-gradient-add-stop="true"]')!);
    });
    expect(document.querySelectorAll("[data-ecmd-gradient-stop-handle]").length).toBe(3);

    // Click [⇄ Flip] -> reverses stops
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-gradient-flip="true"]')!);
    });
    expect(getByTestId("current-value").textContent).toMatch(/^linear-gradient\(90deg, #0EA5E9 0%/);

    // Save custom gradient via [+] button -> persists in localStorage
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-save-gradient-btn="true"]')!);
    });
    const savedRaw = localStorage.getItem("ecmd_custom_gradient_presets_v1");
    expect(savedRaw).toContain("linear-gradient(90deg,");

    // Apply built-in preset ("emerald-luxe")
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-gradient-preset="emerald-luxe"]')!);
    });
    expect(getByTestId("current-value").textContent).toBe(ECMD_GRADIENT_PRESETS[0]!.value);

    // Paste raw Figma radial-gradient into bottom CSS input -> switches to radial mode cleanly!
    const rawInput = document.querySelector('[data-ecmd-gradient-raw-input="true"]') as HTMLInputElement;
    act(() => {
      fireEvent.change(rawInput, {
        target: { value: "radial-gradient(circle at top, rgba(16, 185, 129, 0.8) 0%, #0F172A 100%)" },
      });
    });
    expect(
      document.querySelector('[data-ecmd-color-studio-popover="true"]')?.getAttribute("data-ecmd-color-studio-mode")
    ).toBe("radial");
    expect(document.querySelector('[data-ecmd-gradient-badge="true"]')?.textContent).toContain(
      "Radial circle (2 stops)"
    );
  });
});
