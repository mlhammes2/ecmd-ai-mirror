import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { EcmdThemeGroupController, makeCssRule } from "../components/EcmdThemeGroupController";
import { EcmdDynamicGroupManagerControl, buildInitialGroupsFromProps } from "../components/EcmdDynamicGroupManager";
import {
  ATTRIBUTE_PROFILES_STORAGE_KEY,
  BUILTIN_ATTRIBUTE_PROFILES,
  EcmdAttributeProfilesModal,
  deleteAttributeProfileFromStore,
  loadAttributeProfilesStore,
} from "../components/EcmdAttributeProfilesModal";
import { EcmdSideMenuController } from "../components/EcmdSideMenuController";
import { EcmdAuthModalController } from "../components/EcmdAuthModalController";
import { EcmdPackagesRepeater } from "../components/EcmdPackagesRepeater";
import { EcmdVehicleSelector } from "../components/EcmdVehicleSelector";
import { registerEcmdComponent } from "../lib/ecmdLiveComponentTelemetry";
import * as supabaseClient from "../integrations/supabase/client";

describe("Plasmic Controllers Regression Tests", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("EcmdThemeGroupController", () => {
    it("clicking trigger toggles dropdown open and closed even when open={false} is passed", async () => {
      const onOpenChange = vi.fn();
      const { container } = render(
        <EcmdThemeGroupController
          open={false}
          onOpenChange={onOpenChange}
        />
      );

      // Initially closed
      expect(container.querySelector("#ecmd-theme-dropdown-card")).not.toBeInTheDocument();

      const trigger = container.querySelector("#ecmd-theme-trigger");
      expect(trigger).toBeInTheDocument();

      // Click to open
      act(() => {
        fireEvent.click(trigger!);
      });
      expect(container.querySelector("#ecmd-theme-dropdown-card")).toBeInTheDocument();
      expect(onOpenChange).toHaveBeenCalledWith(true);

      // Wait 160ms for 150ms deduplication window
      await new Promise((resolve) => setTimeout(resolve, 160));

      // Click to close
      act(() => {
        fireEvent.click(trigger!);
      });
      expect(container.querySelector("#ecmd-theme-dropdown-card")).not.toBeInTheDocument();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("button #ecmd-theme-trigger-btn toggles dropdown open on mouseDown + click and closes on second click even with open={false} and toggleFlags lockout", async () => {
      const onOpenChange = vi.fn();
      const { container } = render(
        <EcmdThemeGroupController
          open={false}
          toggleFlags='{"open":false,"enableLiveDropdown":false}'
          onOpenChange={onOpenChange}
          trigger={
            <button id="ecmd-theme-trigger-btn" type="button">
              <div />
              <span>Site Themes</span>
            </button>
          }
        />
      );

      // Initially closed
      expect(container.querySelector("#ecmd-theme-dropdown-card")).not.toBeInTheDocument();

      const btn = container.querySelector("#ecmd-theme-trigger-btn");
      expect(btn).toBeInTheDocument();

      // Trigger mouseDown then click to open (simulating real user interaction)
      act(() => {
        fireEvent.mouseDown(btn!);
        fireEvent.click(btn!);
      });
      expect(container.querySelector("#ecmd-theme-dropdown-card")).toBeInTheDocument();
      expect(onOpenChange).toHaveBeenCalledWith(true);

      // Wait 160ms to exceed 150ms deduplication window
      await new Promise((resolve) => setTimeout(resolve, 160));

      // Second click closes it (mouseDown does not race or pre-close)
      act(() => {
        fireEvent.mouseDown(btn!);
        fireEvent.click(btn!);
      });
      expect(container.querySelector("#ecmd-theme-dropdown-card")).not.toBeInTheDocument();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("clicking nested child inside custom trigger slot toggles dropdown", () => {
      const { container } = render(
        <EcmdThemeGroupController
          open={false}
          trigger={
            <button id="custom-nested-theme-btn" type="button">
              <span id="nested-span">Themes</span>
              <svg id="nested-svg" width="16" height="16"><circle cx="8" cy="8" r="8" /></svg>
            </button>
          }
        />
      );

      const nestedSvg = container.querySelector("#nested-svg");
      expect(nestedSvg).toBeInTheDocument();

      // Click nested svg element
      act(() => {
        fireEvent.click(nestedSvg!);
      });
      expect(container.querySelector("#ecmd-theme-dropdown-card")).toBeInTheDocument();
    });

    it("per-row toggle checkboxes dim rows (opacity 0.45), preserve stored values, and bypass emitted CSS including preset fallbacks", () => {
      const initialPayload = buildInitialGroupsFromProps({}, undefined);
      const group4 = initialPayload.groups["4"]!;
      const savedLightBg = "#123456";
      const savedDarkBg = "#654321";
      const savedRadius = "14px";
      const savedShadow = "0 4px 12px rgba(0,0,0,0.2)";
      const savedBorderWidth = "2px";
      const savedFontWeight = "600";

      initialPayload.selectedId = 4;
      initialPayload.groups["4"] = {
        ...group4,
        selector: ".gm-card-test",
        radius: savedRadius,
        spacing: true,
        padding: "12px",
        margin: "8px",
        gap: "10px",
        clBg: savedLightBg,
        msBg: savedDarkBg,
        clText: "#111111",
        msText: "#EEEEEE",
        clShadow: savedShadow,
        msShadow: savedShadow,
        clOuterShadow: undefined,
        msOuterShadow: undefined,
        borderWidth: savedBorderWidth,
        fontWeight: savedFontWeight,
      };

      const onUpdate = vi.fn();
      const { container: mgrContainer } = render(
        <EcmdDynamicGroupManagerControl
          value={JSON.stringify(initialPayload)}
          componentProps={{ presetTheme: "coastal-light" }}
          updateValue={onUpdate}
        />
      );

      // Ensure the Groups editor modal is open
      if (!document.querySelector(`[data-ecmd-prop-toggle="bg"]`)) {
        const openBtn = mgrContainer.querySelector("button");
        expect(openBtn).toBeInTheDocument();
        act(() => {
          fireEvent.click(openBtn!);
        });
      }

      // Verify all 10 core style attribute rows on the Default tab (including independent outerShadow & innerShadow) have left toggle checkboxes
      const expectedRowKeys = [
        "radius",
        "spacing",
        "bg",
        "text",
        "border",
        "icon",
        "borderWidth",
        "fontWeight",
        "outerShadow",
        "innerShadow",
      ];
      for (const key of expectedRowKeys) {
        const toggle = document.querySelector(`[data-ecmd-prop-toggle="${key}"]`) as HTMLInputElement | null;
        expect(toggle, `Missing toggle checkbox for ${key}`).toBeInTheDocument();
        expect(toggle?.checked).toBe(true);
      }

      // Uncheck Background, Corner Radius, Spacing, Border Width, Font Weight, Outer Shadow, and Inner Shadow
      const keysToDisable = ["bg", "radius", "spacing", "borderWidth", "fontWeight", "outerShadow", "innerShadow"];
      for (const key of keysToDisable) {
        const toggle = document.querySelector(`[data-ecmd-prop-toggle="${key}"]`) as HTMLInputElement;
        act(() => {
          fireEvent.click(toggle);
        });
        const row = document.querySelector(`[data-ecmd-prop-row="${key}"]`) as HTMLElement;
        expect(row.style.opacity).toBe("0.45");
      }

      // Verify latest emitted JSON preserves ALL stored values non-destructively while marking disabledProps
      const lastJson = onUpdate.mock.calls[onUpdate.mock.calls.length - 1]?.[0] as string;
      expect(typeof lastJson).toBe("string");
      const parsed = JSON.parse(lastJson);
      expect(parsed.groups["4"].clBg).toBe(savedLightBg);
      expect(parsed.groups["4"].msBg).toBe(savedDarkBg);
      expect(parsed.groups["4"].radius).toBe(savedRadius);
      expect(parsed.groups["4"].padding).toBe("12px");
      expect(parsed.groups["4"].borderWidth).toBe(savedBorderWidth);
      expect(parsed.groups["4"].fontWeight).toBe(savedFontWeight);
      expect(parsed.groups["4"].clShadow).toBe(savedShadow);
      expect(parsed.groups["4"].clOuterShadow).toBe(savedShadow);
      expect(parsed.groups["4"].disabledProps).toEqual({
        bg: true,
        radius: true,
        spacing: true,
        borderWidth: true,
        fontWeight: true,
        outerShadow: true,
        innerShadow: true,
      });

      // Verify TRUE CSS BYPASS in BOTH coastal-light AND midnight-slate (no custom values AND no preset fallbacks!)
      for (const theme of ["coastal-light", "midnight-slate"] as const) {
        const { container: ctrlContainer, unmount } = render(
          <EcmdThemeGroupController
            presetTheme={theme}
            matchSystemTheme={false}
            dynamicGroupsJson={lastJson}
          />
        );
        const styleEl = ctrlContainer.querySelector("style");
        expect(styleEl).toBeInTheDocument();
        const css = styleEl?.textContent || "";

        // Find the base rule line for .gm-card-test
        const baseRuleLine = css
          .split("\n")
          .find((line) => line.startsWith(".ecmd-group-4, .gm-card-test {"));
        expect(baseRuleLine).toBeTruthy();

        // Disabled properties MUST NOT appear in the emitted CSS
        expect(baseRuleLine).not.toContain("background-color:");
        expect(baseRuleLine).not.toContain("border-radius:");
        expect(baseRuleLine).not.toContain("padding:");
        expect(baseRuleLine).not.toContain("margin:");
        expect(baseRuleLine).not.toContain("gap:");
        expect(baseRuleLine).not.toContain("border-width:");
        expect(baseRuleLine).not.toContain("font-weight:");
        expect(baseRuleLine).not.toContain("box-shadow:");

        // Enabled property (Text) MUST still be emitted
        expect(baseRuleLine).toContain(theme === "midnight-slate" ? "color: #EEEEEE !important;" : "color: #111111 !important;");
        unmount();
      }

      // Re-check Background ON -> restores exact saved #HEX immediately without data loss
      const bgToggle = document.querySelector(`[data-ecmd-prop-toggle="bg"]`) as HTMLInputElement;
      act(() => {
        fireEvent.click(bgToggle);
      });
      const bgRow = document.querySelector(`[data-ecmd-prop-row="bg"]`) as HTMLElement;
      expect(bgRow.style.opacity).toBe("1");
      const restoredJson = onUpdate.mock.calls[onUpdate.mock.calls.length - 1]?.[0] as string;
      const restored = JSON.parse(restoredJson);
      expect(restored.groups["4"].clBg).toBe(savedLightBg);
      expect(restored.groups["4"].disabledProps?.bg).toBeUndefined();

      // Verify makeCssRule directly skips disabled hover/selected/focus/icon properties cleanly
      const directCss = makeCssRule(
        4,
        true,
        ".gm-card-test",
        "#AABBCC",
        "#112233",
        "#445566",
        "10px",
        true,
        "16px",
        "4px",
        "8px",
        "#778899",
        false,
        "",
        "#DDEEFF",
        "#001122",
        {
          hoverBg: "#111111",
          hoverText: "#222222",
          focusBorder: "#333333",
          disabledProps: { bg: true, icon: true, selBg: true, hoverBg: true, focusBorder: true },
        }
      );
      expect(directCss).not.toContain("#AABBCC");
      expect(directCss).not.toContain("#778899");
      expect(directCss).not.toContain("#DDEEFF");
      expect(directCss).not.toContain("#111111");
      expect(directCss).not.toContain("#333333");
      expect(directCss).toContain("color: #112233 !important;");
      expect(directCss).toContain("color: #001122 !important;");
      expect(directCss).toContain("color: #222222 !important;");
    });

    it("supports independent Outer Shadow and Inner Shadow (inset) builders, combined comma-separated box-shadow, non-destructive toggle preservation, and legacy elevation backward compatibility", () => {
      // (1) Outer-only box-shadow via makeCssRule
      const outerOnlyCss = makeCssRule(
        4,
        true,
        ".shadow-card",
        "#FFFFFF",
        "#0F172A",
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
          outerShadow: "0px 6px 16px -2px rgba(0,0,0,0.20)",
          innerShadow: "",
        }
      );
      expect(outerOnlyCss).toContain("box-shadow: 0px 6px 16px -2px rgba(0,0,0,0.20) !important;");
      expect(outerOnlyCss).not.toContain("inset");

      // (2) Inner-only inset box-shadow (auto-applies inset even if omitted, and skips outer shadow when outerShadow is disabled OFF)
      const innerOnlyCss = makeCssRule(
        4,
        true,
        ".shadow-card",
        "#FFFFFF",
        "#0F172A",
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
          outerShadow: "0px 14px 32px -4px rgba(0,0,0,0.35)",
          innerShadow: "0px 2px 4px 0px rgba(0,0,0,0.25)",
          disabledProps: { outerShadow: true },
        }
      );
      expect(innerOnlyCss).toContain("box-shadow: inset 0px 2px 4px 0px rgba(0,0,0,0.25) !important;");
      expect(innerOnlyCss).not.toContain("14px 32px");

      // (3) Combined comma-separated outer + inset inner box-shadow into ONE declaration
      const combinedCss = makeCssRule(
        4,
        true,
        ".shadow-card",
        "#FFFFFF",
        "#0F172A",
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
          outerShadow: "0px 6px 16px -2px rgba(0,0,0,0.20)",
          innerShadow: "inset 0px 2px 4px 0px rgba(0,0,0,0.25)",
        }
      );
      expect(combinedCss).toContain(
        "box-shadow: 0px 6px 16px -2px rgba(0,0,0,0.20), inset 0px 2px 4px 0px rgba(0,0,0,0.25) !important;"
      );
      expect(combinedCss.match(/box-shadow:/g)?.length).toBe(1);

      // (4) Visual builder UI: configure custom X/Y/Blur/Spread/Color/Opacity for Outer & Inner, toggle OFF (dims to 0.45 + emits ZERO box-shadow in Light & Dark), toggle back ON (restores exact values)
      const payload = buildInitialGroupsFromProps({}, undefined);
      payload.selectedId = 4;
      payload.groups["4"] = {
        ...payload.groups["4"]!,
        selector: ".shadow-ui-card",
        clOuterShadow: "",
        clShadow: "",
        msOuterShadow: "0px 14px 32px -4px rgba(0,0,0,0.35)",
        msShadow: "0px 14px 32px -4px rgba(0,0,0,0.35)",
        clInnerShadow: "",
        msInnerShadow: "",
      };

      const onUpdate = vi.fn();
      const { container: mgrContainer, rerender: rerenderMgr } = render(
        <EcmdDynamicGroupManagerControl
          value={JSON.stringify(payload)}
          componentProps={{ presetTheme: "coastal-light" }}
          updateValue={onUpdate}
        />
      );

      // Ensure modal is open (accounts for persisted panelOpen across tests)
      if (!document.querySelector(`[data-ecmd-shadow-preset="outerShadow"]`)) {
        const openBtn = mgrContainer.querySelector("button")!;
        act(() => {
          fireEvent.click(openBtn);
        });
      }

      const syncLatestToControl = () => {
        const latest = onUpdate.mock.calls[onUpdate.mock.calls.length - 1]?.[0] as string;
        rerenderMgr(
          <EcmdDynamicGroupManagerControl
            value={latest}
            componentProps={{ presetTheme: "coastal-light" }}
            updateValue={onUpdate}
          />
        );
        return latest;
      };

      // Pick Outer Shadow preset "Medium Card" then expand & customize X, Y, Blur, Spread, Color, Opacity
      const outerPreset = document.querySelector(`[data-ecmd-shadow-preset="outerShadow"]`) as HTMLSelectElement;
      act(() => {
        fireEvent.change(outerPreset, { target: { value: "medium-card" } });
      });
      syncLatestToControl();

      const outerExpand = document.querySelector(`[data-ecmd-shadow-expand="outerShadow"]`) as HTMLButtonElement;
      act(() => {
        fireEvent.click(outerExpand);
      });
      act(() => {
        fireEvent.change(document.querySelector(`[data-ecmd-shadow-input="outerShadow-x"]`)!, { target: { value: "3" } });
      });
      syncLatestToControl();
      act(() => {
        fireEvent.change(document.querySelector(`[data-ecmd-shadow-input="outerShadow-y"]`)!, { target: { value: "8" } });
      });
      syncLatestToControl();
      act(() => {
        fireEvent.change(document.querySelector(`[data-ecmd-shadow-input="outerShadow-blur"]`)!, { target: { value: "20" } });
      });
      syncLatestToControl();
      act(() => {
        fireEvent.change(document.querySelector(`[data-ecmd-shadow-input="outerShadow-spread"]`)!, { target: { value: "-1" } });
      });
      syncLatestToControl();
      act(() => {
        fireEvent.change(document.querySelector(`[data-ecmd-shadow-input="outerShadow-color"]`)!, { target: { value: "#14B8A6" } });
      });
      syncLatestToControl();
      act(() => {
        fireEvent.change(document.querySelector(`[data-ecmd-shadow-input="outerShadow-opacity"]`)!, { target: { value: "40" } });
      });
      const afterOuterJson = syncLatestToControl();

      // Pick Inner Shadow preset "Recessed Input"
      const innerPreset = document.querySelector(`[data-ecmd-shadow-preset="innerShadow"]`) as HTMLSelectElement;
      act(() => {
        fireEvent.change(innerPreset, { target: { value: "recessed-input" } });
      });
      const bothOnJson = syncLatestToControl();

      const expectedOuterCss = "3px 8px 20px -1px rgba(20,184,166,0.40)";
      const expectedInnerCss = "inset 0px 2px 4px 0px rgba(0,0,0,0.25)";
      expect(JSON.parse(afterOuterJson).groups["4"].clOuterShadow).toBe(expectedOuterCss);
      expect(JSON.parse(bothOnJson).groups["4"].clInnerShadow).toBe(expectedInnerCss);

      // Verify EcmdThemeGroupController emits ONE merged comma-separated box-shadow when both are ON
      const { container: bothCtrl, unmount: unmountBoth } = render(
        <EcmdThemeGroupController presetTheme="coastal-light" matchSystemTheme={false} dynamicGroupsJson={bothOnJson} />
      );
      const bothCss = bothCtrl.querySelector("style")?.textContent || "";
      const bothRule = bothCss.split("\n").find((l) => l.startsWith(".ecmd-group-4, .shadow-ui-card {")) || "";
      expect(bothRule).toContain(`box-shadow: ${expectedOuterCss}, ${expectedInnerCss} !important;`);
      unmountBoth();

      // Toggle BOTH outerShadow & innerShadow OFF -> rows dim to 0.45, saved values stay intact, ZERO box-shadow emitted in both themes!
      act(() => {
        fireEvent.click(document.querySelector(`[data-ecmd-prop-toggle="outerShadow"]`)!);
      });
      syncLatestToControl();
      act(() => {
        fireEvent.click(document.querySelector(`[data-ecmd-prop-toggle="innerShadow"]`)!);
      });
      const bothOffJson = syncLatestToControl();

      expect((document.querySelector(`[data-ecmd-prop-row="outerShadow"]`) as HTMLElement).style.opacity).toBe("0.45");
      expect((document.querySelector(`[data-ecmd-prop-row="innerShadow"]`) as HTMLElement).style.opacity).toBe("0.45");
      const parsedOff = JSON.parse(bothOffJson);
      expect(parsedOff.groups["4"].clOuterShadow).toBe(expectedOuterCss);
      expect(parsedOff.groups["4"].clInnerShadow).toBe(expectedInnerCss);

      for (const theme of ["coastal-light", "midnight-slate"] as const) {
        const { container: offCtrl, unmount: unmountOff } = render(
          <EcmdThemeGroupController presetTheme={theme} matchSystemTheme={false} dynamicGroupsJson={bothOffJson} />
        );
        const offCss = offCtrl.querySelector("style")?.textContent || "";
        const offRule = offCss.split("\n").find((l) => l.startsWith(".ecmd-group-4, .shadow-ui-card {")) || "";
        expect(offRule).not.toContain("box-shadow:");
        unmountOff();
      }

      // Toggle BOTH back ON -> exact saved X/Y/Blur/Spread/Color/Opacity values restored immediately!
      act(() => {
        fireEvent.click(document.querySelector(`[data-ecmd-prop-toggle="outerShadow"]`)!);
      });
      syncLatestToControl();
      act(() => {
        fireEvent.click(document.querySelector(`[data-ecmd-prop-toggle="innerShadow"]`)!);
      });
      const restoredJson = syncLatestToControl();

      expect((document.querySelector(`[data-ecmd-shadow-input="outerShadow-x"]`) as HTMLInputElement).value).toBe("3");
      expect((document.querySelector(`[data-ecmd-shadow-input="outerShadow-y"]`) as HTMLInputElement).value).toBe("8");
      expect((document.querySelector(`[data-ecmd-shadow-input="outerShadow-blur"]`) as HTMLInputElement).value).toBe("20");
      expect((document.querySelector(`[data-ecmd-shadow-input="outerShadow-spread"]`) as HTMLInputElement).value).toBe("-1");
      expect((document.querySelector(`[data-ecmd-shadow-input="outerShadow-color"]`) as HTMLInputElement).value).toBe("#14B8A6");
      expect((document.querySelector(`[data-ecmd-shadow-input="outerShadow-opacity"]`) as HTMLInputElement).value).toBe("40");

      const { container: restoredCtrl, unmount: unmountRestored } = render(
        <EcmdThemeGroupController presetTheme="coastal-light" matchSystemTheme={false} dynamicGroupsJson={restoredJson} />
      );
      const restoredCss = restoredCtrl.querySelector("style")?.textContent || "";
      const restoredRule = restoredCss.split("\n").find((l) => l.startsWith(".ecmd-group-4, .shadow-ui-card {")) || "";
      expect(restoredRule).toContain(`box-shadow: ${expectedOuterCss}, ${expectedInnerCss} !important;`);
      unmountRestored();

      // (5) Legacy `elevation` backward compatibility (hydrates into outerShadow & respects disabled flag)
      const legacyJson = JSON.stringify({
        selectedId: 11,
        groups: {
          "11": {
            id: 11,
            enabled: true,
            name: "Legacy Elevation Card",
            selector: ".legacy-elev-card",
            radius: "10px",
            spacing: false,
            padding: "",
            margin: "",
            gap: "",
            clBg: "#FFFFFF",
            clText: "#0F172A",
            clBorder: "#E2E8F0",
            clIcon: "",
            clSelBg: "",
            clSelText: "",
            msBg: "#1E293B",
            msText: "#F8FAFC",
            msBorder: "#334155",
            msIcon: "",
            msSelBg: "",
            msSelText: "",
            elevation: "0px 10px 24px -3px rgba(15,23,42,0.28)",
          },
        },
      });
      const hydratedLegacy = buildInitialGroupsFromProps({}, legacyJson);
      expect(hydratedLegacy.groups["11"]?.clOuterShadow).toBe("0px 10px 24px -3px rgba(15,23,42,0.28)");
      expect(hydratedLegacy.groups["11"]?.msOuterShadow).toBe("0px 10px 24px -3px rgba(15,23,42,0.28)");

      const { container: legCtrl, unmount: unmountLeg } = render(
        <EcmdThemeGroupController presetTheme="coastal-light" matchSystemTheme={false} dynamicGroupsJson={legacyJson} />
      );
      const legCss = legCtrl.querySelector("style")?.textContent || "";
      expect(legCss).toContain("box-shadow: 0px 10px 24px -3px rgba(15,23,42,0.28) !important;");
      unmountLeg();

      // Legacy disabledProps.elevation / disabledProps.shadow still bypasses box-shadow
      const legacyDisabledJson = JSON.stringify({
        selectedId: 11,
        groups: {
          "11": {
            ...JSON.parse(legacyJson).groups["11"],
            disabledProps: { elevation: true },
          },
        },
      });
      const { container: legDisCtrl, unmount: unmountLegDis } = render(
        <EcmdThemeGroupController presetTheme="coastal-light" matchSystemTheme={false} dynamicGroupsJson={legacyDisabledJson} />
      );
      const legDisCss = legDisCtrl.querySelector("style")?.textContent || "";
      const legDisRule = legDisCss.split("\n").find((l) => l.startsWith(".ecmd-group-11, .legacy-elev-card {")) || "";
      expect(legDisRule).not.toContain("box-shadow:");
      unmountLegDis();
    });

    it("Attribute Profiles popup (openAttributeProfilesModal + dropdown button) & creating/applying profiles pre-populates disabledProps non-destructively", () => {
      // (a) Studio boolean prop openAttributeProfilesModal opens the floating Attribute Profiles popup
      const { container: studioCtrl, unmount: unmountStudio } = render(
        <EcmdThemeGroupController openAttributeProfilesModal={true} />
      );
      expect(document.querySelector('[data-ecmd-attr-profiles-modal="true"]')).toBeInTheDocument();
      // Verify starter profiles and Default Profile for + New Group selector exist
      const defaultSelect = document.querySelector('[data-ecmd-default-profile-select="true"]') as HTMLSelectElement;
      expect(defaultSelect).toBeInTheDocument();
      act(() => {
        fireEvent.change(defaultSelect, { target: { value: "typography-menu-text" } });
      });
      // Close popup via ✕ button
      act(() => {
        fireEvent.click(document.querySelector('[data-ecmd-attr-profiles-close="true"]')!);
      });
      expect(document.querySelector('[data-ecmd-attr-profiles-modal="true"]')).not.toBeInTheDocument();

      // Open dropdown card and click 🎛️ Attributes button right next to 📂 Groups
      const trig = studioCtrl.querySelector("#ecmd-theme-trigger")!;
      act(() => {
        fireEvent.click(trig);
      });
      expect(studioCtrl.querySelector('[data-ecmd-open-groups-btn="true"]')).toBeInTheDocument();
      const attrBtn = studioCtrl.querySelector('[data-ecmd-open-attr-profiles-btn="true"]')!;
      expect(attrBtn).toBeInTheDocument();
      act(() => {
        fireEvent.click(attrBtn);
      });
      expect(document.querySelector('[data-ecmd-attr-profiles-modal="true"]')).toBeInTheDocument();
      unmountStudio();

      // (b) Creating a new group in 📂 Groups modal automatically pre-populates disabledProps from the chosen Attribute Profile
      const payload = buildInitialGroupsFromProps({}, undefined);
      payload.selectedId = 4;
      payload.groups["4"] = {
        ...payload.groups["4"]!,
        clBg: "#ABCDEF",
        clText: "#101010",
        radius: "12px",
      };

      const onUpdate = vi.fn();
      const { container: mgrContainer, rerender: rerenderMgr } = render(
        <EcmdDynamicGroupManagerControl
          value={JSON.stringify(payload)}
          componentProps={{ presetTheme: "coastal-light" }}
          updateValue={onUpdate}
        />
      );
      if (!document.querySelector('[data-ecmd-new-group-btn="true"]')) {
        act(() => {
          fireEvent.click(mgrContainer.querySelector("button")!);
        });
      }

      // Default profile was persisted as "typography-menu-text" (enables ONLY text, fontWeight, iconColor)
      const newGroupBtn = document.querySelector('[data-ecmd-new-group-btn="true"]') as HTMLButtonElement;
      expect(newGroupBtn).toBeInTheDocument();
      act(() => {
        fireEvent.click(newGroupBtn);
      });

      const createdJson = onUpdate.mock.calls[onUpdate.mock.calls.length - 1]?.[0] as string;
      const createdPayload = JSON.parse(createdJson);
      const newId = String(createdPayload.selectedId);
      const newGroup = createdPayload.groups[newId];
      expect(newGroup.attributeProfileId).toBe("typography-menu-text");
      expect(newGroup.disabledProps).toEqual({
        bg: true,
        border: true,
        borderWidth: true,
        radius: true,
        spacing: true,
        outerShadow: true,
        innerShadow: true,
      });

      // (c) Applying "Surface Card" profile to existing Group 4 updates disabledProps NON-DESTRUCTIVELY (preserves saved clBg/clText/radius!)
      createdPayload.selectedId = 4;
      rerenderMgr(
        <EcmdDynamicGroupManagerControl
          value={JSON.stringify(createdPayload)}
          componentProps={{ presetTheme: "coastal-light" }}
          updateValue={onUpdate}
        />
      );
      const applySelect = document.querySelector('[data-ecmd-apply-attr-profile="true"]') as HTMLSelectElement;
      expect(applySelect).toBeInTheDocument();
      act(() => {
        fireEvent.change(applySelect, { target: { value: "surface-card" } });
      });

      const appliedJson = onUpdate.mock.calls[onUpdate.mock.calls.length - 1]?.[0] as string;
      const appliedGroup4 = JSON.parse(appliedJson).groups["4"];
      expect(appliedGroup4.clBg).toBe("#ABCDEF");
      expect(appliedGroup4.clText).toBe("#101010");
      expect(appliedGroup4.radius).toBe("12px");
      expect(appliedGroup4.disabledProps).toEqual({
        icon: true,
        fontWeight: true,
        innerShadow: true,
      });
    });

    it("supports deleting custom AND built-in Attribute Profiles (deletedBuiltInProfileIds), Restore Built-In Defaults, 1-profile safety guard, and quick-delete inside Groups", () => {
      const { unmount: unmountModal } = render(
        <EcmdAttributeProfilesModal open={true} onClose={vi.fn()} />
      );

      // (a) Create a custom profile, set it as Default Profile for + New Group, then delete it -> removed & default/selection safely reassigned
      const newBtn = document.querySelector('[data-ecmd-attr-profile-new="true"]') as HTMLButtonElement;
      expect(newBtn).toBeInTheDocument();
      act(() => {
        fireEvent.click(newBtn);
      });

      const activeSelect = document.querySelector('[data-ecmd-attr-profile-select="true"]') as HTMLSelectElement;
      const customId = activeSelect.value;
      expect(customId.startsWith("custom-profile-")).toBe(true);

      const defaultSelect = document.querySelector('[data-ecmd-default-profile-select="true"]') as HTMLSelectElement;
      act(() => {
        fireEvent.change(defaultSelect, { target: { value: customId } });
      });
      expect(loadAttributeProfilesStore().defaultProfileId).toBe(customId);

      const delBtn = document.querySelector('[data-ecmd-attr-profile-del="true"]') as HTMLButtonElement;
      expect(delBtn).toBeInTheDocument();
      expect(delBtn.disabled).toBe(false);
      expect(delBtn.textContent).toContain("Delete Profile");
      act(() => {
        fireEvent.click(delBtn);
      });

      const afterCustomDelete = loadAttributeProfilesStore();
      expect(afterCustomDelete.profiles.some((p) => p.id === customId)).toBe(false);
      expect(afterCustomDelete.defaultProfileId).not.toBe(customId);
      expect(afterCustomDelete.profiles.some((p) => p.id === afterCustomDelete.defaultProfileId)).toBe(true);
      expect(activeSelect.value).toBe(afterCustomDelete.profiles[0]?.id);

      // Create a second custom profile to verify it survives built-in deletion + Restore Built-In Defaults
      act(() => {
        fireEvent.click(newBtn);
      });
      const keeperCustomId = activeSelect.value;
      expect(keeperCustomId.startsWith("custom-profile-")).toBe(true);

      // (b) Delete a built-in starter profile ("interactive-button") -> persists in deletedBuiltInProfileIds across reload
      act(() => {
        fireEvent.change(activeSelect, { target: { value: "interactive-button" } });
      });
      expect(activeSelect.value).toBe("interactive-button");
      act(() => {
        fireEvent.click(document.querySelector('[data-ecmd-attr-profile-del="true"]')!);
      });

      const reloadedAfterBuiltInDel = loadAttributeProfilesStore();
      expect(reloadedAfterBuiltInDel.profiles.some((p) => p.id === "interactive-button")).toBe(false);
      expect(reloadedAfterBuiltInDel.deletedBuiltInProfileIds).toContain("interactive-button");

      // Unmount and remount modal to simulate page reload / Plasmic refresh
      unmountModal();
      const { unmount: unmountReloaded } = render(
        <EcmdAttributeProfilesModal open={true} onClose={vi.fn()} />
      );
      const reloadedSelect = document.querySelector('[data-ecmd-attr-profile-select="true"]') as HTMLSelectElement;
      const optionValues = Array.from(reloadedSelect.options).map((o) => o.value);
      expect(optionValues).not.toContain("interactive-button");
      expect(optionValues).toContain(keeperCustomId);

      // (c) Click ↺ Restore Built-In Defaults -> brings back deleted starters while preserving custom profile!
      const restoreBtn = document.querySelector('[data-ecmd-restore-builtin-profiles="true"]') as HTMLButtonElement;
      expect(restoreBtn).toBeInTheDocument();
      expect(restoreBtn.textContent).toContain("Restore Built-In Defaults");
      act(() => {
        fireEvent.click(restoreBtn);
      });

      const afterRestore = loadAttributeProfilesStore();
      expect(afterRestore.deletedBuiltInProfileIds).toEqual([]);
      for (const starter of BUILTIN_ATTRIBUTE_PROFILES) {
        expect(afterRestore.profiles.some((p) => p.id === starter.id)).toBe(true);
      }
      expect(afterRestore.profiles.some((p) => p.id === keeperCustomId)).toBe(true);

      // (d) Last-remaining-profile safety guard prevents empty/broken profile list
      while (loadAttributeProfilesStore().profiles.length > 1) {
        act(() => {
          fireEvent.click(document.querySelector('[data-ecmd-attr-profile-del="true"]')!);
        });
      }
      expect(loadAttributeProfilesStore().profiles.length).toBe(1);
      const guardedDelBtn = document.querySelector('[data-ecmd-attr-profile-del="true"]') as HTMLButtonElement;
      expect(guardedDelBtn.disabled).toBe(true);
      expect(guardedDelBtn.title).toBe("Keep at least 1 profile");
      expect(deleteAttributeProfileFromStore(loadAttributeProfilesStore(), loadAttributeProfilesStore().profiles[0]!.id)).toBeNull();

      // Even if localStorage is externally corrupted with 0 profiles, loadAttributeProfilesStore falls back safely to All Attributes Enabled
      localStorage.setItem(
        ATTRIBUTE_PROFILES_STORAGE_KEY,
        JSON.stringify({
          profiles: [],
          defaultProfileId: "missing",
          deletedBuiltInProfileIds: BUILTIN_ATTRIBUTE_PROFILES.map((b) => b.id),
        })
      );
      const recovered = loadAttributeProfilesStore();
      expect(recovered.profiles.length).toBe(1);
      expect(recovered.profiles[0]?.id).toBe("all-attributes");

      // Restore defaults cleanly before testing quick-delete in 📂 Groups
      act(() => {
        fireEvent.click(document.querySelector('[data-ecmd-restore-builtin-profiles="true"]')!);
      });
      unmountReloaded();

      // (e) Quick-delete 🗑️ button inside 📂 Groups deletes selected Attribute Profile while keeping group #HEX/shadow/spacing untouched!
      localStorage.removeItem(ATTRIBUTE_PROFILES_STORAGE_KEY);
      const grpPayload = buildInitialGroupsFromProps({}, undefined);
      grpPayload.selectedId = 4;
      grpPayload.groups["4"] = {
        ...grpPayload.groups["4"]!,
        clBg: "#224466",
        clOuterShadow: "0px 4px 12px 0px rgba(0,0,0,0.20)",
        padding: "14px",
        spacing: true,
        attributeProfileId: "surface-card",
      };
      const onGroupUpdate = vi.fn();
      const { container: grpContainer } = render(
        <EcmdDynamicGroupManagerControl
          value={JSON.stringify(grpPayload)}
          componentProps={{ presetTheme: "coastal-light" }}
          updateValue={onGroupUpdate}
        />
      );
      if (!document.querySelector('[data-ecmd-quick-delete-attr-profile="true"]')) {
        act(() => {
          fireEvent.click(grpContainer.querySelector("button")!);
        });
      }

      const quickDelBtn = document.querySelector('[data-ecmd-quick-delete-attr-profile="true"]') as HTMLButtonElement;
      expect(quickDelBtn).toBeInTheDocument();
      expect(quickDelBtn.disabled).toBe(false);
      act(() => {
        fireEvent.click(quickDelBtn);
      });

      // Profile "surface-card" is deleted & persisted in deletedBuiltInProfileIds
      const afterQuickDel = loadAttributeProfilesStore();
      expect(afterQuickDel.profiles.some((p) => p.id === "surface-card")).toBe(false);
      expect(afterQuickDel.deletedBuiltInProfileIds).toContain("surface-card");

      // Existing group #HEX / shadow / spacing values were NOT mutated or wiped!
      expect(onGroupUpdate).not.toHaveBeenCalled();
      expect(grpPayload.groups["4"]?.clBg).toBe("#224466");
      expect(grpPayload.groups["4"]?.clOuterShadow).toBe("0px 4px 12px 0px rgba(0,0,0,0.20)");
      expect(grpPayload.groups["4"]?.padding).toBe("14px");
    });

    it("6-State compound CSS generator emits strict cascade order (Default -> Hover -> Focus -> Selected [not disabled] -> Selected+Hover -> Disabled) with zero Hover/Selected collision and full legacy hydration", () => {
      const css = makeCssRule(
        6,
        true,
        ".buttonstandard",
        "#0B57D0",
        "#FFFFFF",
        "#0B57D0",
        "8px",
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
              cl: { bg: "#1155CC", text: "#F8FAFC" },
            },
            focus: {
              cl: { border: "#22D3EE" },
            },
            selected: {
              cl: { bg: "#0D9488", text: "#FFFFFF", border: "#0F766E" },
            },
            selectedHover: {
              cl: { bg: "#0F766E", text: "#CCFBF1" },
            },
            disabled: {
              cl: { bg: "#94A3B8", text: "#475569" },
              opacity: "55%",
              cursorNotAllowed: true,
            },
          },
        }
      );

      // (1) Selected generates compound :not(:disabled) selectors matching data-ecmd-selected, aria-selected, aria-pressed, .is-selected
      expect(css).toContain(
        '.buttonstandard[data-ecmd-selected="true"]:not(:disabled):not([disabled]):not([aria-disabled="true"]):not([data-disabled="true"])'
      );
      expect(css).toContain(
        '.buttonstandard[aria-selected="true"]:not(:disabled):not([disabled]):not([aria-disabled="true"]):not([data-disabled="true"])'
      );
      expect(css).toContain(
        '.buttonstandard[aria-pressed="true"]:not(:disabled):not([disabled]):not([aria-disabled="true"]):not([data-disabled="true"])'
      );
      expect(css).toContain(
        '.buttonstandard.is-selected:not(:disabled):not([disabled]):not([aria-disabled="true"]):not([data-disabled="true"])'
      );

      // (2) Hover explicitly excludes disabled AND selected elements so it never collides with Selected buttons
      expect(css).toContain(
        '.buttonstandard:hover:not(:disabled):not([disabled]):not([aria-disabled="true"]):not([data-disabled="true"]):not([data-ecmd-selected="true"]):not([aria-selected="true"]):not([aria-pressed="true"]):not(.is-selected)'
      );

      // (3) Selected + Hover targets selected & hovered elements that are NOT disabled
      expect(css).toContain(
        '.buttonstandard[data-ecmd-selected="true"]:hover:not(:disabled):not([disabled]):not([aria-disabled="true"]):not([data-disabled="true"])'
      );

      // (4) Disabled emits :disabled, [disabled], [aria-disabled="true"], [data-disabled="true"] with opacity & cursor: not-allowed
      expect(css).toContain('.buttonstandard:disabled, .buttonstandard[disabled], .buttonstandard[aria-disabled="true"], .buttonstandard[data-disabled="true"]');
      expect(css).toContain("opacity: 0.55 !important;");
      expect(css).toContain("cursor: not-allowed !important;");

      // (5) Verify STRICT cascade order: Default < Hover < Focus < Selected < Selected+Hover < Disabled
      const idxDefault = css.indexOf("background-color: #0B57D0 !important;");
      const idxHover = css.indexOf("background-color: #1155CC !important;");
      const idxFocus = css.indexOf("border-color: #22D3EE !important;");
      const idxSelected = css.indexOf("background-color: #0D9488 !important;");
      const idxSelectedHover = css.indexOf("background-color: #0F766E !important;");
      const idxDisabled = css.indexOf("background-color: #94A3B8 !important;");
      expect(idxDefault).toBeGreaterThanOrEqual(0);
      expect(idxHover).toBeGreaterThan(idxDefault);
      expect(idxFocus).toBeGreaterThan(idxHover);
      expect(idxSelected).toBeGreaterThan(idxFocus);
      expect(idxSelectedHover).toBeGreaterThan(idxSelected);
      expect(idxDisabled).toBeGreaterThan(idxSelectedHover);

      // (6) Legacy flat hoverBg / selectedBg / focusBorder group configs hydrate cleanly and emit valid CSS without regression
      const legacyGroupJson = JSON.stringify({
        selectedId: 12,
        groups: {
          "12": {
            id: 12,
            enabled: true,
            name: "Legacy Menu Text",
            selector: ".legacy-menu-btn",
            radius: "6px",
            spacing: false,
            padding: "",
            margin: "",
            gap: "",
            clBg: "transparent",
            clText: "#0F172A",
            clBorder: "",
            clIcon: "",
            clSelBg: "#D3E3FD",
            clSelText: "#041E49",
            clHoverBg: "#E2E8F0",
            clHoverText: "#0284C7",
            clFocusBorder: "#0EA5E9",
            msBg: "transparent",
            msText: "#F8FAFC",
            msBorder: "",
            msIcon: "",
            msSelBg: "#004A77",
            msSelText: "#C2E7FF",
            msHoverBg: "#334155",
            msHoverText: "#38BDF8",
            msFocusBorder: "#14B8A6",
          },
        },
      });
      const hydrated = buildInitialGroupsFromProps({}, legacyGroupJson);
      expect(hydrated.groups["12"]?.stateOverrides?.hover?.cl?.bg).toBe("#E2E8F0");
      expect(hydrated.groups["12"]?.stateOverrides?.selected?.cl?.bg).toBe("#D3E3FD");
      expect(hydrated.groups["12"]?.stateOverrides?.focus?.cl?.border).toBe("#0EA5E9");

      const { container: legCtrl, unmount: unmountLeg } = render(
        <EcmdThemeGroupController
          presetTheme="coastal-light"
          matchSystemTheme={false}
          dynamicGroupsJson={legacyGroupJson}
        />
      );
      const legCss = legCtrl.querySelector("style")?.textContent || "";
      expect(legCss).toContain("background-color: #E2E8F0 !important;");
      expect(legCss).toContain("background-color: #D3E3FD !important;");
      expect(legCss).toContain("border-color: #0EA5E9 !important;");
      unmountLeg();
    });
  });

  describe("EcmdSideMenuController", () => {
    it("clicking nested elements inside trigger slot opens and closes #ecmd-side-menu-card", () => {
      const onOpenChange = vi.fn();
      const { container } = render(
        <EcmdSideMenuController
          open={false}
          syncFromSupabase={false}
          onOpenChange={onOpenChange}
          trigger={
            <div id="nested-header-btn-box">
              <span id="nested-hamburger-icon">☰</span>
            </div>
          }
        />
      );

      expect(container.querySelector("#ecmd-side-menu-card")).not.toBeInTheDocument();

      const nestedIcon = container.querySelector("#nested-hamburger-icon");
      expect(nestedIcon).toBeInTheDocument();

      // Click nested icon to open
      act(() => {
        fireEvent.click(nestedIcon!);
      });
      expect(container.querySelector("#ecmd-side-menu-card")).toBeInTheDocument();
      expect(onOpenChange).toHaveBeenCalledWith(true);

      // Click again to close
      act(() => {
        fireEvent.click(nestedIcon!);
      });
      expect(container.querySelector("#ecmd-side-menu-card")).not.toBeInTheDocument();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("does not render headerSlot or footerSlot wrappers unless showHeaderSlot/showFooterSlot are true", () => {
      const { container, rerender } = render(
        <EcmdSideMenuController
          open={true}
          syncFromSupabase={false}
          showHeaderSlot={false}
          showFooterSlot={false}
          headerSlot={<div id="test-header-content">Header</div>}
          footerSlot={<div id="test-footer-content">Footer</div>}
        />
      );

      // Wrappers should not be rendered
      expect(container.querySelector("#ecmd-side-menu-header")).not.toBeInTheDocument();
      expect(container.querySelector("#ecmd-side-menu-footer")).not.toBeInTheDocument();

      // Rerender with toggles set to true
      rerender(
        <EcmdSideMenuController
          open={true}
          syncFromSupabase={false}
          showHeaderSlot={true}
          showFooterSlot={true}
          headerSlot={<div id="test-header-content">Header</div>}
          footerSlot={<div id="test-footer-content">Footer</div>}
        />
      );

      expect(container.querySelector("#ecmd-side-menu-header")).toBeInTheDocument();
      expect(container.querySelector("#ecmd-side-menu-footer")).toBeInTheDocument();
    });
  });

  describe("Mutual Popover Coordination", () => {
    it("opening theme dropdown automatically closes side menu and vice versa", () => {
      const { container } = render(
        <div>
          <EcmdThemeGroupController open={false} />
          <EcmdSideMenuController open={false} syncFromSupabase={false} />
        </div>
      );

      const themeTrig = container.querySelector("#ecmd-theme-trigger");
      const sideTrig = container.querySelector("#ecmd-side-menu-trigger");

      // Open side menu first
      act(() => {
        fireEvent.click(sideTrig!);
      });
      expect(container.querySelector("#ecmd-side-menu-card")).toBeInTheDocument();
      expect(container.querySelector("#ecmd-theme-dropdown-card")).not.toBeInTheDocument();

      // Open theme dropdown -> side menu closes!
      act(() => {
        fireEvent.click(themeTrig!);
      });
      expect(container.querySelector("#ecmd-theme-dropdown-card")).toBeInTheDocument();
      expect(container.querySelector("#ecmd-side-menu-card")).not.toBeInTheDocument();

      // Open side menu -> theme dropdown closes!
      act(() => {
        fireEvent.click(sideTrig!);
      });
      expect(container.querySelector("#ecmd-side-menu-card")).toBeInTheDocument();
      expect(container.querySelector("#ecmd-theme-dropdown-card")).not.toBeInTheDocument();
    });
  });

  describe("EcmdAuthModalController", () => {
    it("keeps 'Sign Up' trigger button visible even if localStorage has stale ecmd_auth_user", () => {
      localStorage.setItem("ecmd_auth_user", JSON.stringify({ id: "stale_user", email: "stale@ecmdutah.com" }));

      const { container } = render(
        <EcmdAuthModalController
          open={false}
          previewLoggedIn={false}
          showSecondTrigger={true}
          secondTriggerText="Sign Up"
        />
      );

      const signupBtn = container.querySelector("#ecmd-auth-signup-trigger-btn");
      expect(signupBtn).toBeInTheDocument();
      expect(signupBtn?.textContent).toBe("Sign Up");
      expect((signupBtn as HTMLElement)?.style.display).not.toBe("none");

      const primaryBtn = container.querySelector("#ecmd-auth-trigger-btn");
      expect(primaryBtn?.textContent).toBe("Member Login");
    });

    it("clicking 'Sign Up' trigger opens modal in signup mode, while clicking login opens login mode", () => {
      const onModeChange = vi.fn();
      const onOpenChange = vi.fn();

      const { container } = render(
        <EcmdAuthModalController
          open={false}
          showSecondTrigger={true}
          onModeChange={onModeChange}
          onOpenChange={onOpenChange}
        />
      );

      const signupBtn = container.querySelector("#ecmd-auth-signup-trigger-btn");
      expect(signupBtn).toBeInTheDocument();

      // Click Sign Up
      act(() => {
        fireEvent.click(signupBtn!);
      });

      expect(onModeChange).toHaveBeenCalledWith("signup");
      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(container.querySelector("#ecmd-auth-modal")).toBeInTheDocument();

      // Confirm mode displays signup title / confirm password input
      const confirmInput = container.querySelector("#ecmd-auth-confirm-input") as HTMLElement;
      expect(confirmInput).toBeInTheDocument();
      expect(confirmInput.style.display).not.toBe("none");
    });
  });

  describe("Zero-Inline-Width Root Law & registerEcmdComponent Box-Model Forwarding", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("EcmdPackagesRepeater wrapped via registerEcmdComponent forwards Plasmic className directly to the root sizing element with NO display:contents wrapper and NO inline width:'100%' lock", async () => {
      vi.spyOn(supabaseClient, "carbonQuery").mockResolvedValue([
        {
          id: 77,
          slug: "ceramic-pro",
          title: "Ceramic Pro",
          default_scope: "full",
          pricing_matrix: {
            basePrice: 399,
            salePrice: 349,
            duration: 4,
            multipliers: { coupe: 1, truck: 1.2, "sm-suv": 1.25, "lg-suv": 1.4 },
          },
        },
      ]);

      const fakeLoader = { registerComponent: vi.fn() };
      const WrappedRepeater = registerEcmdComponent(
        EcmdPackagesRepeater,
        {
          name: "EcmdPackagesRepeaterRootSizingTest",
          displayName: "Packages Repeater Root Sizing Test",
          importPath: "./components/EcmdPackagesRepeater",
          props: {},
        },
        fakeLoader
      );

      const styleTag = document.createElement("style");
      styleTag.textContent = ".plasmic-width-980 { width: 980px; max-width: 980px; margin-left: auto; margin-right: auto; }";
      document.head.appendChild(styleTag);

      try {
        const { container } = render(
          <WrappedRepeater
            className="plasmic-width-980"
            orientation="vertical"
            itemTemplate={<div data-testid="sizing-card-tpl">Card Content</div>}
          />
        );

        await waitFor(() => {
          expect(screen.getByTestId("sizing-card-tpl")).toBeInTheDocument();
        });

        // No display:contents wrapper <div> swallowing Plasmic's root box-model!
        expect(container.querySelector("[data-ecmd-telemetry-host]")).toBeNull();

        const rootEl = container.firstElementChild as HTMLElement;
        expect(rootEl).toBeInTheDocument();
        expect(rootEl.id).toBe("packagesRep");
        expect(rootEl.classList.contains("ecmd-packages-repeater-root")).toBe(true);
        expect(rootEl.classList.contains("plasmic-width-980")).toBe(true);

        // NO inline style.width="100%" overriding CSS class width!
        expect(rootEl.style.width).toBe("");
        expect(window.getComputedStyle(rootEl).width).toBe("980px");
        expect(window.getComputedStyle(rootEl).maxWidth).toBe("980px");

        // Inner vertical card defaults cleanly to 100% / max-width 100% / border-box so it shrinks to 980px without overflow
        const cardEl = rootEl.querySelector(".ecmd-package-card") as HTMLElement;
        expect(cardEl).toBeInTheDocument();
        expect(cardEl.style.width).toBe("100%");
        expect(cardEl.style.maxWidth).toBe("100%");
        expect(cardEl.style.boxSizing).toBe("border-box");
      } finally {
        document.head.removeChild(styleTag);
      }
    });

    it("EcmdVehicleSelector wrapped via registerEcmdComponent forwards Plasmic className onto its root sizing element without an inline width:'100%' lock", () => {
      const fakeLoader = { registerComponent: vi.fn() };
      const WrappedSelector = registerEcmdComponent(
        EcmdVehicleSelector,
        {
          name: "EcmdVehicleSelectorRootSizingTest",
          displayName: "Vehicle Selector Root Sizing Test",
          importPath: "./components/EcmdVehicleSelector",
          props: {},
        },
        fakeLoader
      );

      const styleTag = document.createElement("style");
      styleTag.textContent = ".plasmic-veh-980 { width: 980px; max-width: 980px; margin-left: auto; margin-right: auto; }";
      document.head.appendChild(styleTag);

      try {
        const { container } = render(
          <WrappedSelector className="plasmic-veh-980" />
        );

        // No display:contents wrapper <div>
        expect(container.querySelector("[data-ecmd-telemetry-host]")).toBeNull();

        const rootEl = container.firstElementChild as HTMLElement;
        expect(rootEl).toBeInTheDocument();
        expect(rootEl.classList.contains("ecmd-vehicle-selector-root")).toBe(true);
        expect(rootEl.classList.contains("ecmd-vehicle-selector")).toBe(true);
        expect(rootEl.classList.contains("plasmic-veh-980")).toBe(true);

        // NO inline style.width="100%" overriding CSS class width!
        expect(rootEl.style.width).toBe("");
        expect(window.getComputedStyle(rootEl).width).toBe("980px");
        expect(window.getComputedStyle(rootEl).maxWidth).toBe("980px");

        // Plasmic root className is NOT erroneously duplicated onto inner slots
        const slots = Array.from(rootEl.querySelectorAll(".ecmd-vehicle-slot"));
        expect(slots).toHaveLength(4);
        for (const slot of slots) {
          expect(slot.classList.contains("plasmic-veh-980")).toBe(false);
        }
      } finally {
        document.head.removeChild(styleTag);
      }
    });
  });
});
