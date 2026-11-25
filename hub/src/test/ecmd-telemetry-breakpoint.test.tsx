import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  useEcmdBreakpoint,
  computeEcmdBreakpointState,
  classifyBreakpointFromWidth,
  resolveBreakpointAction,
  executeBreakpointAction,
} from "../lib/useEcmdBreakpoint";
import {
  serializeLiveDomTree,
  runCanvasDiagnostics,
  registerEcmdComponent,
  ECMD_REGISTERED_COMPONENTS,
} from "../lib/ecmdLiveComponentTelemetry";
import { EcmdPackagesRepeater } from "../components/EcmdPackagesRepeater";
import { EcmdVehicleSelector } from "../components/EcmdVehicleSelector";
import {
  EcmdThemeGroupController,
  buildFluidClampCss,
  makeCssRule,
} from "../components/EcmdThemeGroupController";
import {
  EcmdDynamicGroupManagerControl,
  buildInitialGroupsFromProps,
} from "../components/EcmdDynamicGroupManager";

vi.mock("@plasmicapp/host", () => ({
  usePlasmicCanvasContext: () => null,
}));

vi.mock("../integrations/supabase/client", () => ({
  carbonQuery: vi.fn(async () => [
    {
      id: 101,
      slug: "ceramic-pro",
      title: "Ceramic Pro Package",
      description: "Full exterior & interior ceramic protection.",
      default_scope: "full",
      pricing_matrix: {
        basePrice: 399,
        salePrice: 349,
        duration: 4,
        multipliers: { coupe: 1, truck: 1.2, "sm-suv": 1.25, "lg-suv": 1.4 },
      },
    },
  ]),
}));

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(document.documentElement, "clientWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
}

function BreakpointProbe({
  mobileBreakpoint = 768,
  tabletBreakpoint = 1024,
}: {
  mobileBreakpoint?: number;
  tabletBreakpoint?: number;
}) {
  const bp = useEcmdBreakpoint(mobileBreakpoint, tabletBreakpoint);
  return (
    <div
      data-testid="bp-probe"
      data-ecmd-viewport={bp.viewportMode}
      data-artboard={bp.artboardTag}
      data-desktop={String(bp.isDesktop)}
      data-tablet={String(bp.isTablet)}
      data-mobile={String(bp.isMobile)}
      data-width={String(bp.viewportWidthPx)}
    />
  );
}

describe("3-Tier Breakpoint Hook, Action Router, Live Canvas Diagnostics & Fluid Auto-Scale", () => {
  beforeEach(() => {
    localStorage.clear();
    setViewportWidth(1440);
  });

  it("useEcmdBreakpoint resolves 3 tiers (desktop-1440, tablet-834, mobile-414) accurately and reacts to resize", () => {
    expect(classifyBreakpointFromWidth(1440)).toBe("desktop");
    expect(classifyBreakpointFromWidth(1025)).toBe("desktop");
    expect(classifyBreakpointFromWidth(1024)).toBe("tablet");
    expect(classifyBreakpointFromWidth(834)).toBe("tablet");
    expect(classifyBreakpointFromWidth(768)).toBe("tablet");
    expect(classifyBreakpointFromWidth(767)).toBe("mobile");
    expect(classifyBreakpointFromWidth(414)).toBe("mobile");

    expect(computeEcmdBreakpointState(1440, 768, 1024)).toEqual({
      viewportMode: "desktop",
      isDesktop: true,
      isTablet: false,
      isMobile: false,
      viewportWidthPx: 1440,
      artboardTag: "desktop-1440",
    });
    expect(computeEcmdBreakpointState(834, 768, 1024)).toEqual({
      viewportMode: "tablet",
      isDesktop: false,
      isTablet: true,
      isMobile: false,
      viewportWidthPx: 834,
      artboardTag: "tablet-834",
    });
    expect(computeEcmdBreakpointState(414, 768, 1024)).toEqual({
      viewportMode: "mobile",
      isDesktop: false,
      isTablet: false,
      isMobile: true,
      viewportWidthPx: 414,
      artboardTag: "mobile-414",
    });

    const { getByTestId } = render(
      <BreakpointProbe mobileBreakpoint={768} tabletBreakpoint={1024} />
    );
    const probe = getByTestId("bp-probe");
    expect(probe.getAttribute("data-ecmd-viewport")).toBe("desktop");
    expect(probe.getAttribute("data-artboard")).toBe("desktop-1440");
    expect(probe.getAttribute("data-desktop")).toBe("true");
    expect(probe.getAttribute("data-tablet")).toBe("false");
    expect(probe.getAttribute("data-mobile")).toBe("false");

    act(() => {
      setViewportWidth(834);
      window.dispatchEvent(new Event("resize"));
    });
    expect(probe.getAttribute("data-ecmd-viewport")).toBe("tablet");
    expect(probe.getAttribute("data-artboard")).toBe("tablet-834");
    expect(probe.getAttribute("data-desktop")).toBe("false");
    expect(probe.getAttribute("data-tablet")).toBe("true");
    expect(probe.getAttribute("data-mobile")).toBe("false");

    act(() => {
      setViewportWidth(414);
      window.dispatchEvent(new Event("resize"));
    });
    expect(probe.getAttribute("data-ecmd-viewport")).toBe("mobile");
    expect(probe.getAttribute("data-artboard")).toBe("mobile-414");
    expect(probe.getAttribute("data-desktop")).toBe("false");
    expect(probe.getAttribute("data-tablet")).toBe("false");
    expect(probe.getAttribute("data-mobile")).toBe("true");
  });

  it("resolveBreakpointAction and executeBreakpointAction route desktop, tablet, and mobile actions cleanly", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <button
        id="btn-tri"
        data-ecmd-action="scroll-to:#fallback"
        data-ecmd-action-desktop="expand-inline"
        data-ecmd-action-tablet="open-modal"
        data-ecmd-action-mobile="open-drawer"
      >
        <span>Details</span>
      </button>
      <button id="btn-fallback" data-ecmd-action="scroll-to:#pricing-section">Jump</button>
      <section id="pricing-section"></section>
    `;
    document.body.appendChild(container);

    const innerSpan = container.querySelector("#btn-tri span") as HTMLElement;
    const fallbackBtn = container.querySelector("#btn-fallback") as HTMLElement;
    const targetSection = container.querySelector("#pricing-section") as HTMLElement;
    const scrollSpy = vi.fn();
    targetSection.scrollIntoView = scrollSpy;

    expect(resolveBreakpointAction(innerSpan, "desktop")).toBe("expand-inline");
    expect(resolveBreakpointAction(innerSpan, "tablet")).toBe("open-modal");
    expect(resolveBreakpointAction(innerSpan, "mobile")).toBe("open-drawer");
    // Legacy boolean signature still works
    expect(resolveBreakpointAction(innerSpan, false)).toBe("expand-inline");
    expect(resolveBreakpointAction(innerSpan, true)).toBe("open-drawer");
    // Fallback to data-ecmd-action on all tiers
    expect(resolveBreakpointAction(fallbackBtn, "tablet")).toBe("scroll-to:#pricing-section");
    expect(resolveBreakpointAction(fallbackBtn, "mobile")).toBe("scroll-to:#pricing-section");

    const receivedEvents: any[] = [];
    const listener = (e: Event) => receivedEvents.push((e as CustomEvent).detail);
    window.addEventListener("ecmd:breakpoint-action", listener);

    const onInline = vi.fn();
    const onModal = vi.fn();
    const onDrawer = vi.fn();
    const onNavigate = vi.fn();

    executeBreakpointAction("expand-inline", { viewportMode: "desktop", onExpandInline: onInline });
    executeBreakpointAction("open-modal", { viewportMode: "tablet", onOpenModal: onModal });
    executeBreakpointAction("open-drawer", { viewportMode: "mobile", onOpenDrawer: onDrawer });
    executeBreakpointAction("scroll-to:#pricing-section", { viewportMode: "desktop" });
    executeBreakpointAction("navigate:/booking", { viewportMode: "mobile", onNavigate });

    expect(onInline).toHaveBeenCalledTimes(1);
    expect(onModal).toHaveBeenCalledTimes(1);
    expect(onDrawer).toHaveBeenCalledTimes(1);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("/booking");
    expect(receivedEvents.map((e) => `${e.viewportMode}:${e.type}`)).toEqual([
      "desktop:expand-inline",
      "tablet:open-modal",
      "mobile:open-drawer",
      "desktop:scroll-to",
      "mobile:navigate",
    ]);

    window.removeEventListener("ecmd:breakpoint-action", listener);
    document.body.removeChild(container);
  });

  it("EcmdPackagesRepeater & EcmdVehicleSelector apply Tablet & Mobile breakpoint overrides and details actions", async () => {
    // 1. Tablet tier (834px)
    setViewportWidth(834);

    const { container: vehTabContainer, unmount: unmountVehTab } = render(
      <EcmdVehicleSelector tabletLayout="grid-2x2" tabletGap={12} mobileLayout="vertical-stack" />
    );
    const vehTabRoot = vehTabContainer.firstElementChild as HTMLElement;
    expect(vehTabRoot.getAttribute("data-ecmd-viewport")).toBe("tablet");
    expect(vehTabRoot.style.display).toBe("grid");
    expect(vehTabRoot.style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
    expect(vehTabRoot.style.gap).toBe("12px");
    unmountVehTab();

    const DesktopCard = () => (
      <div data-testid="desktop-tpl">
        <button data-ecmd-pkg="whats-included-btn">What&apos;s Included?</button>
      </div>
    );
    const MobileCard = () => (
      <div data-testid="mobile-tpl">
        <button data-ecmd-pkg="whats-included-btn">Mobile Details</button>
      </div>
    );

    const { container: pkgTabContainer, unmount: unmountPkgTab } = render(
      <EcmdPackagesRepeater
        orientation="grid"
        columns={3}
        gap={24}
        tabletOrientation="grid"
        tabletColumns={2}
        tabletGap={16}
        tabletDetailsAction="modal"
        mobileOrientation="vertical"
        mobileGap={12}
        desktopDetailsAction="inline"
        mobileDetailsAction="drawer"
        itemTemplate={<DesktopCard />}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("desktop-tpl")).toBeInTheDocument();
    });

    const pkgTabRoot = pkgTabContainer.firstElementChild as HTMLElement;
    expect(pkgTabRoot.getAttribute("data-ecmd-viewport")).toBe("tablet");
    expect(pkgTabRoot.getAttribute("data-ecmd-orientation")).toBe("grid");
    expect(pkgTabRoot.style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
    expect(pkgTabRoot.style.gap).toBe("16px");

    fireEvent.click(screen.getByText("What's Included?"));
    expect(document.querySelector('[data-ecmd-pkg="details-modal-overlay"]')).toBeInTheDocument();
    unmountPkgTab();

    // 2. Mobile tier (414px)
    setViewportWidth(414);

    const { container: vehContainer } = render(
      <EcmdVehicleSelector mobileLayout="grid-2x2" mobileGap={10} />
    );
    const vehRoot = vehContainer.firstElementChild as HTMLElement;
    expect(vehRoot.getAttribute("data-ecmd-viewport")).toBe("mobile");
    expect(vehRoot.style.display).toBe("grid");
    expect(vehRoot.style.gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
    expect(vehRoot.style.gap).toBe("10px");

    const { container: pkgContainer } = render(
      <EcmdPackagesRepeater
        orientation="grid"
        columns={3}
        gap={24}
        mobileOrientation="vertical"
        mobileGap={12}
        useSeparateMobileTemplate={true}
        desktopDetailsAction="inline"
        mobileDetailsAction="drawer"
        itemTemplate={<DesktopCard />}
        mobileItemTemplate={<MobileCard />}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("mobile-tpl")).toBeInTheDocument();
    });

    const pkgRoot = pkgContainer.firstElementChild as HTMLElement;
    expect(pkgRoot.getAttribute("data-ecmd-viewport")).toBe("mobile");
    expect(pkgRoot.getAttribute("data-ecmd-orientation")).toBe("vertical");
    expect(pkgRoot.style.flexDirection).toBe("column");
    expect(pkgRoot.style.gap).toBe("12px");

    fireEvent.click(screen.getByText("Mobile Details"));
    expect(document.querySelector('[data-ecmd-pkg="details-drawer-overlay"]')).toBeInTheDocument();
  });

  it("runCanvasDiagnostics ignores data-ecmd-pkg on plain <div> containers (0 false positives) while catching CRITICAL missing interactive sibling hooks and splitting severityTier", () => {
    const root = document.createElement("div");
    root.className = "ecmd-packages-repeater-container ecmd-group-3";
    root.innerHTML = `
      <div class="ecmd-package-card ecmd-group-3">
        <!-- Plain layout <div> siblings next to bound data-ecmd-pkg nodes MUST NOT produce false positives -->
        <div class="card-content-stack">
          <div data-ecmd-pkg="title">Premium Plus - Ceramic Coating</div>
          <div data-ecmd-pkg="description">The ultimate protection and shine.</div>
          <div class="plain-stack-a">Interior Only Full Detail Exterior Only</div>
          <div class="plain-stack-b">Type: Duration: SALE: Price:</div>
          <div class="plain-stack-c">Sm. SUV 4Hrs $349 $399</div>
          <div class="plain-stack-d">Add-Ons (99)</div>
          <div class="plain-stack-e">Add to Cart What's Included?</div>
        </div>
        <div class="reviews-row">
          <div>Google G ★★★★★</div>
          <div data-ecmd-pkg="review-score">4.9</div>
          <div data-ecmd-pkg="review-count">out of 9400 Google Reviews</div>
        </div>
        <!-- Real interactive sibling bug: 3rd button missing data-ecmd-scope-btn -->
        <div class="scope-row">
          <button data-ecmd-scope-btn="interior">Interior Only</button>
          <button data-ecmd-scope-btn="full" data-ecmd-selected="true">Full Detail</button>
          <button>Exterior Only</button>
        </div>
        <div class="overflow-box" style="overflow-x: hidden;">Wide overflowing content</div>
        <div class="scrollable-box" style="overflow-x: auto;">Scrollable content</div>
        <div class="collapsed-box">Invisible zero-height label</div>
        <img class="broken-img" src="https://fakeimg.pl/400x300" alt="Broken" />
      </div>
    `;
    document.body.appendChild(root);

    const allEls = [root, ...Array.from(root.querySelectorAll("*"))] as HTMLElement[];
    for (const el of allEls) {
      el.getBoundingClientRect = () =>
        ({
          width: el.classList.contains("collapsed-box") ? 0 : 320,
          height: el.classList.contains("collapsed-box") ? 0 : 44,
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 320,
          bottom: 44,
          toJSON: () => {},
        }) as DOMRect;
    }

    const overflowBox = root.querySelector(".overflow-box") as HTMLElement;
    Object.defineProperty(overflowBox, "clientWidth", { value: 300, configurable: true });
    Object.defineProperty(overflowBox, "scrollWidth", { value: 420, configurable: true });

    const scrollableBox = root.querySelector(".scrollable-box") as HTMLElement;
    Object.defineProperty(scrollableBox, "clientWidth", { value: 300, configurable: true });
    Object.defineProperty(scrollableBox, "scrollWidth", { value: 420, configurable: true });

    const brokenImg = root.querySelector(".broken-img") as HTMLImageElement;
    Object.defineProperty(brokenImg, "complete", { value: true, configurable: true });
    Object.defineProperty(brokenImg, "naturalWidth", { value: 0, configurable: true });

    const diagnostics = runCanvasDiagnostics(root, {
      componentName: "EcmdPackagesRepeater",
      artboardTag: "tablet-834",
      viewportMode: "tablet",
      viewportWidthPx: 834,
    });

    const missingHooks = diagnostics.filter((d) => d.code === "MISSING_SIBLING_HOOK");
    // ZERO false positives on data-ecmd-pkg plain <div> containers — ONLY the 1 real button catch!
    expect(missingHooks.length).toBe(1);
    expect(missingHooks[0]?.message).toContain("Exterior Only");
    expect(missingHooks[0]?.message).toContain("data-ecmd-scope-btn");
    expect(missingHooks[0]?.severityTier).toBe("critical");
    expect(missingHooks[0]?.breakpoint).toBe("tablet");

    const brokenImgDiag = diagnostics.find((d) => d.code === "BROKEN_IMAGE");
    expect(brokenImgDiag?.severityTier).toBe("critical");
    expect(brokenImgDiag?.breakpoint).toBe("tablet");

    const overflowDiags = diagnostics.filter((d) => d.code === "HORIZONTAL_OVERFLOW");
    expect(overflowDiags.length).toBe(1);
    expect(overflowDiags[0]?.element).toContain("overflow-box");
    expect(overflowDiags[0]?.severityTier).toBe("layout");
    expect(overflowDiags[0]?.breakpoint).toBe("tablet");

    const collapsedDiag = diagnostics.find((d) => d.code === "COLLAPSED_ZERO_SIZE");
    expect(collapsedDiag?.severityTier).toBe("layout");
    expect(collapsedDiag?.breakpoint).toBe("tablet");

    // Verify serializer captures boxModel, matchedThemeGroups, and ecmdAttrs
    const tree = serializeLiveDomTree(root);
    expect(tree.matchedThemeGroups).toContain(".ecmd-group-3");
    expect(tree.rect.width).toBe(320);
    expect(tree.boxModel).toHaveProperty("paddingTop");
    expect(tree.boxModel).toHaveProperty("gap");

    document.body.removeChild(root);
  });

  it("Site Themes Fluid Auto-Scale emits valid clamp() CSS when ON, emits nothing when OFF, and wraps @media for desktop/tablet/mobile breakpointTarget", () => {
    // 1. Direct clamp() helper math verification (375px -> 1440px)
    const fontClamp = buildFluidClampCss(16, 24);
    expect(fontClamp).toMatch(/^clamp\(16px, calc\(.+vw\), 24px\)$/);

    // 2. Fluid Auto-Scale ON emits clamp() font-size, padding, gap, and mobile stack @media
    const cssOn = makeCssRule(
      4,
      true,
      ".fluid-cards",
      "#FFFFFF",
      "#0F172A",
      "#E2E8F0",
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
        fluidScale: {
          enabled: true,
          desktopFontPx: 24,
          mobileFontPx: 16,
          desktopPadYPx: 24,
          mobilePadYPx: 12,
          desktopPadXPx: 32,
          mobilePadXPx: 14,
          desktopGapPx: 20,
          mobileGapPx: 10,
          stackOnMobile: true,
        },
      }
    );
    expect(cssOn).toContain(`font-size: ${buildFluidClampCss(16, 24)} !important;`);
    expect(cssOn).toContain(
      `padding: ${buildFluidClampCss(12, 24)} ${buildFluidClampCss(14, 32)} !important;`
    );
    expect(cssOn).toContain(`gap: ${buildFluidClampCss(10, 20)} !important;`);
    expect(cssOn).toContain("@media (max-width: 767px)");
    expect(cssOn).toContain("flex-direction: column !important; flex-wrap: wrap !important;");

    // 3. Fluid Auto-Scale OFF (disabledProps.fluidScale = true) emits ZERO fluid clamp() or mobile stack CSS
    const cssOff = makeCssRule(
      4,
      true,
      ".fluid-cards",
      "#FFFFFF",
      "#0F172A",
      "#E2E8F0",
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
        disabledProps: { fluidScale: true },
        fluidScale: {
          enabled: true,
          desktopFontPx: 24,
          mobileFontPx: 16,
          desktopPadYPx: 24,
          mobilePadYPx: 12,
          desktopGapPx: 20,
          mobileGapPx: 10,
          stackOnMobile: true,
        },
      }
    );
    expect(cssOff).not.toContain("clamp(");
    expect(cssOff).not.toContain("flex-direction: column");

    // 4. Per-breakpoint @media wrapping for desktop, tablet, and mobile targets
    const desktopScoped = makeCssRule(
      2,
      true,
      ".hero-btn",
      "#0EA5E9",
      "#FFFFFF",
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
      { breakpointTarget: "desktop" }
    );
    expect(desktopScoped).toContain("@media (min-width: 1025px)");

    const tabletScoped = makeCssRule(
      2,
      true,
      ".hero-btn",
      "#0EA5E9",
      "#FFFFFF",
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
      { breakpointTarget: "tablet" }
    );
    expect(tabletScoped).toContain("@media (min-width: 768px) and (max-width: 1024px)");

    const mobileScoped = makeCssRule(
      2,
      true,
      ".hero-btn",
      "#0EA5E9",
      "#FFFFFF",
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
      { breakpointTarget: "mobile" }
    );
    expect(mobileScoped).toContain("@media (max-width: 767px)");

    // 5. End-to-end UI check inside EcmdDynamicGroupManagerControl -> EcmdThemeGroupController
    const initPayload = buildInitialGroupsFromProps({}, undefined);
    initPayload.selectedId = 4;
    let latestJson = JSON.stringify(initPayload);
    const onUpdate = vi.fn((val: string) => {
      latestJson = val;
    });

    const { container: mgrContainer, rerender: rerenderMgr } = render(
      <EcmdDynamicGroupManagerControl
        value={latestJson}
        componentProps={{ presetTheme: "coastal-light" }}
        updateValue={onUpdate}
      />
    );
    if (!document.querySelector('[data-ecmd-breakpoint-target-select="true"]')) {
      act(() => {
        fireEvent.click(mgrContainer.querySelector("button")!);
      });
    }

    const syncMgr = () => {
      rerenderMgr(
        <EcmdDynamicGroupManagerControl
          value={latestJson}
          componentProps={{ presetTheme: "coastal-light" }}
          updateValue={onUpdate}
        />
      );
    };

    // Change Breakpoint Target to "tablet"
    act(() => {
      fireEvent.change(document.querySelector('[data-ecmd-breakpoint-target-select="true"]')!, {
        target: { value: "tablet" },
      });
    });
    syncMgr();

    // Expand Fluid Auto-Scale & configure font + stackOnMobile
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-fluid-scale-expand="true"]')!);
    });
    act(() => {
      fireEvent.change(document.querySelector('[data-ecmd-fluid-input="desktopFontPx"]')!, {
        target: { value: "22" },
      });
    });
    syncMgr();
    act(() => {
      fireEvent.change(document.querySelector('[data-ecmd-fluid-input="mobileFontPx"]')!, {
        target: { value: "14" },
      });
    });
    syncMgr();

    const { container: ctrlOn, unmount: unmountOn } = render(
      <EcmdThemeGroupController
        presetTheme="coastal-light"
        matchSystemTheme={false}
        dynamicGroupsJson={latestJson}
      />
    );
    const liveCssOn = ctrlOn.querySelector("style")?.textContent || "";
    expect(liveCssOn).toContain("@media (min-width: 768px) and (max-width: 1024px)");
    expect(liveCssOn).toContain(`font-size: ${buildFluidClampCss(14, 22)} !important;`);
    unmountOn();

    // Toggle Fluid Auto-Scale checkbox OFF -> clamp() disappears non-destructively!
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-prop-toggle="fluidScale"]')!);
    });
    syncMgr();

    const { container: ctrlOff, unmount: unmountOff } = render(
      <EcmdThemeGroupController
        presetTheme="coastal-light"
        matchSystemTheme={false}
        dynamicGroupsJson={latestJson}
      />
    );
    const liveCssOff = ctrlOff.querySelector("style")?.textContent || "";
    expect(liveCssOff).not.toContain("clamp(");
    unmountOff();
  });

  it("registerEcmdComponent records metadata into ECMD_REGISTERED_COMPONENTS and delegates to loader", () => {
    const fakeLoader = { registerComponent: vi.fn() };
    const SampleComp: React.FC<{ title?: string }> = ({ title }) => <div>{title}</div>;

    registerEcmdComponent(
      SampleComp,
      {
        name: "EcmdUnitTestProbe",
        displayName: "Unit Test Probe",
        importPath: "./SampleComp",
        props: {
          title: { type: "string" },
          children: { type: "slot" },
        },
      },
      fakeLoader
    );

    expect(fakeLoader.registerComponent).toHaveBeenCalledTimes(1);
    const entry = ECMD_REGISTERED_COMPONENTS.find((c) => c.name === "EcmdUnitTestProbe");
    expect(entry).toBeDefined();
    expect(entry?.slotNames).toEqual(["children"]);
  });
});
