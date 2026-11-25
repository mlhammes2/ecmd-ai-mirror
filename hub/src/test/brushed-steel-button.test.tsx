import React from "react";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  EcmdBrushedSteelButton,
  BrushedSteelButton,
  DEFAULT_STEEL_GLOW_COLOR,
  normalizeCssDimension,
  resolveSteelLabelSize,
  parseGlowColorToRgb,
  buildSteelGlowVars,
} from "../components/EcmdBrushedSteelButton";
import { EcmdDeviceGlobalContext } from "../components/EcmdDeviceGlobalContext";
import { EcmdThemeImage } from "../components/EcmdThemeImage";
import { EcmdThemeLogo } from "../components/EcmdThemeLogo";
import { EcmdAuthModalController } from "../components/EcmdAuthModalController";
import { EcmdThemeGroupController } from "../components/EcmdThemeGroupController";
import { EcmdVehicleSelector } from "../components/EcmdVehicleSelector";
import { EcmdPackagesRepeater } from "../components/EcmdPackagesRepeater";
import { EcmdSideMenuController } from "../components/EcmdSideMenuController";
import { useEcmdBreakpoint } from "../lib/useEcmdBreakpoint";
import { ECMD_ROOT_SIZING_STYLE_ID } from "../lib/ecmdRootSizing";

describe("EcmdBrushedSteelButton ('Brushed Steel Button') & mobile-413 SSR Hydration Safety", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("exports BrushedSteelButton alias and renders conic brushed steel with default label 'Exterior' and #54e9ea Cyan glow tokens", () => {
    expect(BrushedSteelButton).toBe(EcmdBrushedSteelButton);
    expect(DEFAULT_STEEL_GLOW_COLOR).toBe("#54e9ea");

    const { container } = render(<EcmdBrushedSteelButton />);

    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains("ecmd-steel-button-root")).toBe(true);
    expect(root.classList.contains("button-mount")).toBe(true);
    // Zero-Inline-Width Root Law: no hardcoded inline width when width prop is omitted
    expect(root.style.width).toBe("");
    expect(root.style.height).toBe("");

    const button = root.querySelector("button.steel-button") as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("data-ecmd-selected")).toBe("false");
    expect(button.style.getPropertyValue("--glow-color")).toBe("#54e9ea");
    expect(button.style.getPropertyValue("--ecmd-steel-glow-color")).toBe("#54e9ea");
    expect(button.style.getPropertyValue("--ecmd-steel-glow-1")).toBe("rgba(84, 233, 234, 0.8)");
    expect(button.style.getPropertyValue("--ecmd-steel-glow-4")).toBe("rgba(84, 233, 234, 0.15)");

    const face = button.querySelector(".steel-face");
    expect(face).not.toBeNull();
    const label = face?.querySelector(".button-label");
    expect(label?.textContent).toBe("Exterior");
  });

  it("supports selected backlight glow, configurable glowColor, proportional height scaling, explicit fontSize, numeric/string dimensions, and onClick", () => {
    const onClick = vi.fn();
    const { container, rerender } = render(
      <EcmdBrushedSteelButton
        label="Full Detail"
        selected={true}
        glowColor="#10B981"
        width={180}
        height={44}
        onClick={onClick}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe("180px");
    expect(root.style.height).toBe("44px");

    const button = root.querySelector("button.steel-button") as HTMLButtonElement;
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.getAttribute("data-ecmd-selected")).toBe("true");
    expect(button.style.getPropertyValue("--glow-color")).toBe("#10B981");
    expect(button.style.getPropertyValue("--ecmd-steel-glow-1")).toBe("rgba(16, 185, 129, 0.8)");
    // Version 7 independent sizing exposes --button-width and --button-height so
    // --button-radius scales cleanly and container-query label sizing (55cqh/18cqw) takes over
    expect(button.style.getPropertyValue("--button-width")).toBe("180px");
    expect(button.style.getPropertyValue("--button-height")).toBe("44px");
    expect(button.style.getPropertyValue("--label-size")).toBe("");
    expect(button.querySelector(".button-label")?.textContent).toBe("Full Detail");

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    // Controlled mode preserves selected prop from parent
    expect(button.getAttribute("aria-pressed")).toBe("true");

    rerender(
      <EcmdBrushedSteelButton
        label="Interior"
        selected={false}
        glowColor="#54e9ea"
        fontSize={20}
        width="100%"
        height="52px"
        onClick={onClick}
      />
    );
    expect(root.style.width).toBe("100%");
    expect(root.style.height).toBe("52px");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.style.getPropertyValue("--button-width")).toBe("100%");
    expect(button.style.getPropertyValue("--button-height")).toBe("52px");
    expect(button.style.getPropertyValue("--label-size")).toBe("20px");
    expect(button.style.getPropertyValue("--label-max")).toBe("20px");
    expect(button.querySelector(".button-label")?.textContent).toBe("Interior");
  });

  it("toggles aria-pressed interactively in standalone/uncontrolled mode and respects disabled", () => {
    const { container } = render(<EcmdBrushedSteelButton label="Exterior" />);
    const button = container.querySelector("button.steel-button") as HTMLButtonElement;

    expect(button.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("false");

    cleanup();
    const onClick = vi.fn();
    const { container: c2 } = render(
      <EcmdBrushedSteelButton label="Interior" disabled={true} onClick={onClick} />
    );
    const disabledBtn = c2.querySelector("button.steel-button") as HTMLButtonElement;
    expect(disabledBtn.disabled).toBe(true);
    fireEvent.click(disabledBtn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("parses dimensions, Version 7 label size overrides, hex (#RGB/#RRGGBB), rgb(), and invalid colors with #54e9ea Cyan fallback", () => {
    expect(normalizeCssDimension(48)).toBe("48px");
    expect(normalizeCssDimension("64")).toBe("64px");
    expect(normalizeCssDimension("56px")).toBe("56px");
    expect(normalizeCssDimension("")).toBeUndefined();

    expect(resolveSteelLabelSize(18, 44)).toBe("18px");
    expect(resolveSteelLabelSize("1.25rem", 44)).toBe("1.25rem");
    expect(resolveSteelLabelSize(undefined, 40)).toBeUndefined();
    expect(resolveSteelLabelSize(undefined, undefined)).toBeUndefined();

    expect(parseGlowColorToRgb("#54e9ea")).toEqual({ r: 84, g: 233, b: 234 });
    expect(parseGlowColorToRgb("#10B981")).toEqual({ r: 16, g: 185, b: 129 });
    expect(parseGlowColorToRgb("#0f8")).toEqual({ r: 0, g: 255, b: 136 });
    expect(parseGlowColorToRgb("rgb(84, 233, 234)")).toEqual({ r: 84, g: 233, b: 234 });
    expect(parseGlowColorToRgb("not-a-color")).toEqual({ r: 84, g: 233, b: 234 });

    const vars = buildSteelGlowVars("#54e9ea", "22px", {
      width: "220px",
      height: "48px",
    }) as Record<string, string>;
    expect(vars["--glow-color"]).toBe("#54e9ea");
    expect(vars["--label-size"]).toBe("22px");
    expect(vars["--label-max"]).toBe("22px");
    expect(vars["--button-width"]).toBe("220px");
    expect(vars["--button-height"]).toBe("48px");
    expect(vars["--ecmd-steel-glow-2"]).toBe("rgba(84, 233, 234, 0.6)");
  });

  it("preserves Version 7 container-type: size, --button-radius, calc(var(--button-radius) - 2px), fixed 160px repeating grain, container-query label sizing, lift/press physics, and prefers-reduced-motion in brushedSteelButton.css", () => {
    const cssPath = path.join(__dirname, "../styles/brushedSteelButton.css");
    const css = fs.readFileSync(cssPath, "utf-8");
    expect(css).toContain("container-type: size;");
    expect(css).toContain("--button-radius: clamp(4px, calc(var(--button-height, 100px) * 0.11), 11px);");
    expect(css).toContain("border-radius: var(--button-radius);");
    expect(css).toContain("border-radius: calc(var(--button-radius) - 2px);");
    expect(css).toContain("background-repeat: repeat;");
    expect(css).toContain("background-size: 160px 160px;");
    expect(css).toContain("clamp(14px, min(var(--label-max, 32.2px), 55cqh, 18cqw), var(--label-max, 32.2px))");
    expect(css).toContain("conic-gradient");
    expect(css).toContain("repeating-radial-gradient");
    expect(css).toContain("translateY(-4px)");
    expect(css).toContain("translateY(3px)");
    expect(css).toContain("@media (hover: hover) and (pointer: fine)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("#39393c");
    expect(css).toContain("--glow-color");
    expect(css).toContain("--label-size");
    expect(css).toContain("line-height: 1;");
    expect(css).toContain("white-space: nowrap;");
    expect(css).toContain("overflow: hidden;");
  });

  it("registers EcmdBrushedSteelButton ('Brushed Steel Button') in src/plasmic-init.ts with fontSize and #54e9ea default", async () => {
    await import("../plasmic-init");
    const { ECMD_REGISTERED_COMPONENTS } = await import("../lib/ecmdLiveComponentTelemetry");
    const entry = ECMD_REGISTERED_COMPONENTS.find((c) => c.name === "EcmdBrushedSteelButton");
    expect(entry).toBeDefined();
    expect(entry?.displayName).toBe("Brushed Steel Button");
    expect(entry?.propNames).toEqual(
      expect.arrayContaining([
        "label",
        "selected",
        "glowColor",
        "fontSize",
        "width",
        "height",
        "onClick",
      ])
    );

    const initSrc = fs.readFileSync(path.join(__dirname, "../plasmic-init.ts"), "utf-8");
    expect(initSrc).toContain('defaultValue: "#54e9ea"');
  });

  it("hydrates cleanly on a mobile-413 viewport across all ECMD providers/components with ZERO React hydration warnings", async () => {
    // 1. Verify importing ecmdRootSizing.ts does not mutate document.head before hydration
    expect(document.getElementById(ECMD_ROOT_SIZING_STYLE_ID)).toBeNull();

    // 2. Verify RootShell protects <html> and <body> with suppressHydrationWarning
    const rootRouteSrc = fs.readFileSync(path.join(__dirname, "../routes/__root.tsx"), "utf-8");
    expect(rootRouteSrc).toMatch(/<html[^>]*suppressHydrationWarning/);
    expect(rootRouteSrc).toMatch(/<body[^>]*suppressHydrationWarning/);

    // 3. Simulate mobile-413 client viewport
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 413 });
    Object.defineProperty(document.documentElement, "clientWidth", {
      writable: true,
      configurable: true,
      value: 413,
    });

    function MobileHydrationFixture() {
      const bp = useEcmdBreakpoint(768, 1024);
      return (
        <EcmdDeviceGlobalContext>
          <div data-testid="hydration-root" data-viewport={bp.viewportMode}>
            <EcmdThemeGroupController />
            <EcmdAuthModalController />
            <EcmdSideMenuController syncFromSupabase={false} />
            <EcmdThemeImage />
            <EcmdThemeLogo>
              <span>Logo</span>
            </EcmdThemeLogo>
            <EcmdVehicleSelector />
            <EcmdPackagesRepeater />
            <EcmdBrushedSteelButton label="Exterior" selected={false} height={44} />
          </div>
        </EcmdDeviceGlobalContext>
      );
    }

    // Render server HTML (SSR)
    const ssrHtml = renderToString(<MobileHydrationFixture />);
    const host = document.createElement("div");
    host.innerHTML = ssrHtml;
    document.body.appendChild(host);

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const recoverableErrors: unknown[] = [];

    let root: ReturnType<typeof hydrateRoot> | null = null;
    try {
      await act(async () => {
        root = hydrateRoot(host, <MobileHydrationFixture />, {
          onRecoverableError: (err) => recoverableErrors.push(err),
        });
      });

      // Zero hydration warnings or recoverable errors!
      expect(recoverableErrors).toEqual([]);
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      // After layout effect flush, viewport updates seamlessly to mobile-413
      const hydratedNode = host.querySelector('[data-testid="hydration-root"]');
      expect(hydratedNode?.getAttribute("data-viewport")).toBe("mobile");
    } finally {
      if (root) {
        await act(async () => {
          root!.unmount();
        });
      }
      host.remove();
    }
  });
});
