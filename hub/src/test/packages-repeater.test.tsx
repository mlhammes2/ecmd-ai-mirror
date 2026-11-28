import React from "react"; import { render, screen, fireEvent, waitFor } from "@testing-library/react"; import { describe, it, expect, vi, beforeEach } from "vitest";  
import { EcmdPackagesRepeater, ECMD_PKG_HERO_PLACEHOLDER_URI } from "../components/EcmdPackagesRepeater";
import { runCanvasDiagnostics } from "../lib/ecmdLiveComponentTelemetry";
import { carbonQuery } from "../integrations/supabase/client";

// Mock Supabase
vi.mock("../integrations/supabase/client", () => ({
  carbonQuery: vi.fn(async () => {
    return [
      {
        id: 1,
        slug: "premium-plus-ceramic",
        title: "Premium Plus - Ceramic Coating",
        default_scope: "full",
        pricing_matrix: {
          basePrice: 399,
          salePrice: 349,
          duration: 4,
          multipliers: { coupe: 1, truck: 1.2, "sm-suv": 1.25, "lg-suv": 1.4 }
        }
      }
    ];
  }),
}));

describe("Packages Repeater and Vehicle Selector", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("EcmdVehicleSelector renders 4 slots and dispatches event on click", () => {
    let eventDispatched = false;
    window.addEventListener("ecmd-vehicle-change", (e: any) => {
      if (e.detail.vehicleKey === "truck") {
        eventDispatched = true;
      }
    });

    render(<div data-testid="removed-vehicle-selector" />);
    
    const truckSlot = screen.getByText("truck").closest(".ecmd-vehicle-slot");
    expect(truckSlot).not.toBeNull();
    
    fireEvent.click(truckSlot!);
    expect(eventDispatched).toBe(true);
    expect(localStorage.getItem("ecmd_selected_vehicle")).toBe("truck");
  });

  it("EcmdPackagesRepeater fetches packages and updates pricing when vehicle changes", async () => {
    const TestTemplate = () => (
      <div data-testid="test-template">Template Content</div>
    );

    render(<EcmdPackagesRepeater itemTemplate={<TestTemplate />} />);

    await waitFor(() => {
      expect(screen.getByTestId("test-template")).toBeInTheDocument();
    });

    // We can simulate an event and check if active vehicle state updates. 
    // Since we output the context to a data attribute for testing, we can check it.
    const contextNode = screen.getByText(/activeVehicle/);
    expect(contextNode.textContent).toContain('"activeVehicle":"sm-suv"');

    // Simulate vehicle change event
    fireEvent(window, new CustomEvent("ecmd-vehicle-change", {
      detail: { vehicleKey: "lg-suv", label: "Lg. SUV/Van" }
    }));

    await waitFor(() => {
      const updatedContext = screen.getByText(/activeVehicle/);
      expect(updatedContext.textContent).toContain('"activeVehicle":"lg-suv"');
      // 399 * 1.4 = 558.5999999999999 due to JS float math
      expect(updatedContext.textContent).toContain('"basePrice":558.5999999999999');
    });
  });
  
  it("EcmdPackagesRepeater handles scope change via event delegation", async () => {
    const TestTemplate = () => (
      <div>
        <button data-ecmd-scope-btn="interior">Interior Only</button>
      </div>
    );

    render(<EcmdPackagesRepeater itemTemplate={<TestTemplate />} />);

    await waitFor(() => {
      expect(screen.getByText("Interior Only")).toBeInTheDocument();
    });

    const btn = screen.getByText("Interior Only");
    fireEvent.click(btn);

    await waitFor(() => {
      const updatedContext = screen.getByText(/activeScope/);
      expect(updatedContext.textContent).toContain('"activeScope":"interior"');
    });
  });

  it("applies className directly on the flex/grid container and supports vertical, horizontal-wrap, horizontal-scroll, and grid orientations", async () => {
    const TestCard = () => <div data-testid="card-slot">Card</div>;

    // 1. Default vertical orientation
    const { container, rerender } = render(
      <EcmdPackagesRepeater
        className="plasmic-custom-layout"
        orientation="vertical"
        gap={24}
        itemTemplate={<TestCard />}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("card-slot")).toBeInTheDocument();
    });

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("ecmd-packages-repeater-container");
    expect(wrapper.className).toContain("plasmic-custom-layout");
    expect(wrapper.style.display).toBe("flex");
    expect(wrapper.style.flexDirection).toBe("column");
    expect(wrapper.style.gap).toBe("24px");
    // Cards are direct children of the flex/grid container (no intermediate div)
    const firstCard = wrapper.firstElementChild as HTMLElement;
    expect(firstCard.className).toContain("ecmd-package-card");
    expect(firstCard.className).not.toContain("plasmic-custom-layout");

    // 2. horizontal-wrap orientation with cardWidth
    rerender(
      <EcmdPackagesRepeater
        className="plasmic-custom-layout"
        orientation="horizontal-wrap"
        cardWidth="360px"
        gap={16}
        itemTemplate={<TestCard />}
      />
    );
    expect(wrapper.style.display).toBe("flex");
    expect(wrapper.style.flexDirection).toBe("row");
    expect(wrapper.style.flexWrap).toBe("wrap");
    expect(wrapper.style.gap).toBe("16px");
    expect(firstCard.style.width).toBe("360px");
    expect(firstCard.style.minWidth).toBe("360px");
    expect(firstCard.style.flexShrink).toBe("0");

    // 3. horizontal-scroll orientation with overflowX auto + cardWidth
    rerender(
      <EcmdPackagesRepeater
        className="plasmic-custom-layout"
        orientation="horizontal-scroll"
        cardWidth="400px"
        gap={20}
        itemTemplate={<TestCard />}
      />
    );
    expect(wrapper.style.display).toBe("flex");
    expect(wrapper.style.flexDirection).toBe("row");
    expect(wrapper.style.flexWrap).toBe("nowrap");
    expect(wrapper.style.overflowX).toBe("auto");
    expect(firstCard.style.width).toBe("400px");
    expect(firstCard.style.minWidth).toBe("400px");
    expect(firstCard.style.flexShrink).toBe("0");

    // 4. grid orientation with columns (1-4)
    rerender(
      <EcmdPackagesRepeater
        className="plasmic-custom-layout"
        orientation="grid"
        columns={3}
        gap={18}
        itemTemplate={<TestCard />}
      />
    );
    expect(wrapper.style.display).toBe("grid");
    expect(wrapper.style.gridTemplateColumns).toBe("repeat(3, minmax(0, 1fr))");
    expect(wrapper.style.gap).toBe("18px");
  });

  it("replaces broken or missing [data-ecmd-pkg='hero-image'] with inline SVG data-URI banner", async () => {
    const TestHeroCard = () => (
      <div>
        <img data-ecmd-pkg="hero-image" src="https://fakeimg.pl/400x300/121212/ffffff?text=Ceramic" alt="Package Hero" />
      </div>
    );

    render(<EcmdPackagesRepeater itemTemplate={<TestHeroCard />} />);

    await waitFor(() => {
      const heroImg = document.querySelector('img[data-ecmd-pkg="hero-image"]') as HTMLImageElement | null;
      expect(heroImg).toBeInTheDocument();
      expect(heroImg?.getAttribute("src")).toBe(ECMD_PKG_HERO_PLACEHOLDER_URI);
      expect(heroImg?.getAttribute("src")).toContain("data:image/svg+xml;utf8,");
    });
  });

  it("auto-stamps data-ecmd-scope-btn='exterior' onto an 'Exterior Only' button when a mobile breakpoint variant omits the attribute", async () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 413 });
    Object.defineProperty(document.documentElement, "clientWidth", { writable: true, configurable: true, value: 413 });

    const MobileVariantCard = () => (
      <div className="scope-row">
        <button data-ecmd-scope-btn="interior">Interior Only</button>
        <button data-ecmd-scope-btn="full">Full Detail</button>
        {/* Breakpoint variant omits data-ecmd-scope-btn on Exterior Only */}
        <button>Exterior Only</button>
      </div>
    );

    const { container } = render(
      <EcmdPackagesRepeater itemTemplate={<MobileVariantCard />} />
    );

    await waitFor(() => {
      const extBtn = screen.getByText("Exterior Only");
      expect(extBtn.getAttribute("data-ecmd-scope-btn")).toBe("exterior");
    });

    // Clicking the auto-healed Exterior Only button switches activeScope to "exterior"
    fireEvent.click(screen.getByText("Exterior Only"));
    await waitFor(() => {
      const updatedContext = screen.getByText(/activeScope/);
      expect(updatedContext.textContent).toContain('"activeScope":"exterior"');
    });

    // Sibling-hook diagnostics report 0 MISSING_SIBLING_HOOK faults after auto-healing
    const root = container.firstElementChild as HTMLElement;
    const diags = runCanvasDiagnostics(root, {
      componentName: "EcmdPackagesRepeater",
      artboardTag: "mobile-413",
      viewportMode: "mobile",
      viewportWidthPx: 413,
    });
    expect(diags.filter((d) => d.code === "MISSING_SIBLING_HOOK")).toHaveLength(0);
  });

  it("keeps per-card slot wrapper transparent (no ecmd-group-3 white corners, zero inline bg/border/shadow/padding) when card/item template is provided on EcmdPackagesRepeater and EcmdVehicleSelector", async () => {
    const RoundedEmeraldCard = () => (
      <div
        data-testid="rounded-emerald-card"
        style={{ borderRadius: "12px", border: "2px solid #10B981", padding: "16px" }}
      >
        Rounded Emerald Package Card
      </div>
    );

    const { container } = render(
      <EcmdPackagesRepeater themeGroup="ecmd-group-3" itemTemplate={<RoundedEmeraldCard />} />
    );

    await waitFor(() => {
      expect(screen.getByTestId("rounded-emerald-card")).toBeInTheDocument();
    });

    const cardWrapper = container.querySelector(".ecmd-package-card") as HTMLElement;
    expect(cardWrapper).not.toBeNull();
    expect(cardWrapper.getAttribute("data-ecmd-slot-wrapper")).toBe("transparent");
    // Must NOT stamp ecmd-group-3 onto the outer wrapper when a custom Package Card Template is provided
    expect(cardWrapper.classList.contains("ecmd-group-3")).toBe(false);
    // Zero inline background, border, box-shadow, or padding on the outer slot wrapper
    expect(cardWrapper.style.background).toBe("");
    expect(cardWrapper.style.backgroundColor).toBe("");
    expect(cardWrapper.style.border).toBe("");
    expect(cardWrapper.style.boxShadow).toBe("");
    expect(cardWrapper.style.padding).toBe("");

    // Verify zero-specificity :where(...) transparent slot wrapper CSS is injected into document.head
    const sizingStyle = document.getElementById("ecmd-root-sizing-defaults");
    expect(sizingStyle?.textContent).toContain(
      ':where(.ecmd-packages-repeater-root > .ecmd-package-card[data-ecmd-slot-wrapper="transparent"])'
    );
    expect(sizingStyle?.textContent).toContain("background: transparent;");
    expect(sizingStyle?.textContent).toContain("border: none;");
    expect(sizingStyle?.textContent).toContain("box-shadow: none;");
    expect(sizingStyle?.textContent).toContain("padding: 0;");

    // Verify EcmdVehicleSelector also marks custom slot wrappers transparent with zero inline padding/border
    const { container: vehContainer } = render(
      <div data-testid="removed-vehicle-selector" />
    );
    const firstVehSlot = vehContainer.querySelector(".ecmd-vehicle-slot") as HTMLElement;
    expect(firstVehSlot).not.toBeNull();
    expect(firstVehSlot.getAttribute("data-ecmd-slot-wrapper")).toBe("transparent");
    expect(firstVehSlot.style.padding).toBe("");
    expect(firstVehSlot.style.border).toBe("");
    expect(firstVehSlot.style.borderBottom).toBe("");
    expect(firstVehSlot.style.background).toBe("");
    expect(firstVehSlot.style.boxShadow).toBe("");
  });
});