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

  });