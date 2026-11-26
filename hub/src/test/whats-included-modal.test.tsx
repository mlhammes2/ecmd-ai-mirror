import React from "react";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSelector } from "@plasmicapp/loader-react";
import {
  EcmdWhatsIncludedModal,
  type EcmdWhatsIncludedRow,
} from "../components/EcmdWhatsIncludedModal";
import { EcmdPackagesRepeater } from "../components/EcmdPackagesRepeater";
import {
  ADDON_MEMORY_STORAGE_KEY,
  type EcmdServicePackageRow,
} from "../lib/ecmdPackageMatcher";
import { runCanvasDiagnostics } from "../lib/ecmdLiveComponentTelemetry";

const MOCK_SERVICE_PACKAGES: EcmdServicePackageRow[] = [
  {
    id: 1,
    wix_id: "c-f-smsuv",
    title: "Full Classic Detail",
    package_level: "Classic",
    detail_type: "Full",
    sub_category: "Sm. SUV",
    price: 179,
    sale_price: 0,
    bi_weekly_percent: 20,
    monthly_percent: 15,
    quarterly_percent: 10,
    duration: 3,
    description: "Classic Full desc",
    interior_description: "Classic Interior summary",
    exterior_description: "Classic Exterior summary",
    sort_order: 11,
    enabled: true,
  },
  {
    id: 2,
    wix_id: "c-i-smsuv",
    title: "Classic Interior Detail",
    package_level: "Classic",
    detail_type: "Interior",
    sub_category: "Sm. SUV",
    price: 149,
    sale_price: 0,
    bi_weekly_percent: 20,
    monthly_percent: 15,
    quarterly_percent: 10,
    duration: 2,
    description: "Classic Interior desc",
    sort_order: 12,
    enabled: true,
  },
  {
    id: 3,
    wix_id: "p-f-smsuv",
    title: "Full Premium Detail",
    package_level: "Premium",
    detail_type: "Full",
    sub_category: "Sm. SUV",
    price: 299,
    sale_price: 149,
    bi_weekly_percent: 20,
    monthly_percent: 15,
    quarterly_percent: 10,
    duration: 4,
    description: "Premium Full desc",
    sort_order: 21,
    enabled: true,
  },
  {
    id: 4,
    wix_id: "p-i-smsuv",
    title: "Premium Interior Detail",
    package_level: "Premium",
    detail_type: "Interior",
    sub_category: "Sm. SUV",
    price: 199,
    sale_price: 0,
    bi_weekly_percent: 20,
    monthly_percent: 15,
    quarterly_percent: 10,
    duration: 3,
    description: "Premium Interior desc",
    sort_order: 22,
    enabled: true,
  },
  {
    id: 5,
    wix_id: "l-f-smsuv",
    title: "Full Luxury Detail",
    package_level: "Luxury",
    detail_type: "Full",
    sub_category: "Sm. SUV",
    price: 399,
    sale_price: 0,
    bi_weekly_percent: 25,
    monthly_percent: 20,
    quarterly_percent: 10,
    duration: 5,
    description: "Luxury Full desc",
    sort_order: 31,
    enabled: true,
  },
];

const MOCK_WHATS_INCLUDED: EcmdWhatsIncludedRow[] = [
  {
    id: 29,
    wix_id: "wi-door-jam",
    title: "Door Jam Cleaning:",
    button_title: "Door Jam Cleaning",
    add_on_title: "Door Jam Cleaning",
    detail_type: '["Interior"]',
    package_level: '["All"]',
    whats_included: '["Classic","Premium","Luxury"]',
    price: 20,
    notice: "",
    sort: 1,
    enabled: true,
  },
  {
    id: 25,
    wix_id: "wi-spot-shampoo",
    title: "Seats/Carpets - Spot Shampooed:",
    button_title: "Spot Shampoo",
    add_on_title: "Spot Shampoo",
    detail_type: '["Interior"]',
    package_level: '["All"]',
    whats_included: '["Classic"]',
    price: 40,
    notice: "Spot shampoo includes up to 3 softball size spots. Upgrade to Premium for complete shampoo.",
    sort: 3,
    enabled: true,
  },
  {
    id: 27,
    wix_id: "wi-complete-shampoo",
    title: "Complete Interior Shampoo:",
    button_title: "Complete Int. Shampoo",
    add_on_title: "Complete Interior Shampoo",
    detail_type: '["Interior"]',
    package_level: '["Classic","All"]',
    whats_included: '["Premium","Luxury"]',
    price: 70,
    notice: "",
    sort: 4,
    enabled: true,
  },
  {
    id: 42,
    wix_id: "wi-odor-removal",
    title: "Odor Removal:",
    button_title: "Odor Removal",
    add_on_title: "Odor Removal",
    detail_type: '["Interior"]',
    package_level: '["Premium","Classic","All"]',
    whats_included: '["Luxury"]',
    price: 30,
    notice: "",
    sort: 13,
    enabled: true,
  },
  {
    id: 43,
    wix_id: "wi-hand-wash",
    title: "Hand Wash, Rinse, & Bug Removal:",
    button_title: "Hand Wash/Bug Removal",
    add_on_title: "Hand Wash/Bug Removal",
    detail_type: '["Exterior"]',
    package_level: '["All"]',
    whats_included: '["Classic","Premium","Luxury"]',
    price: 30,
    notice: "",
    sort: 15,
    enabled: true,
  },
  {
    id: 39,
    wix_id: "wi-clay-bar",
    title: "Nano Clay Bar Decontamination:",
    button_title: "Nano Claybar Decon.",
    add_on_title: "Nano Claybar Decon",
    detail_type: '["Exterior"]',
    package_level: '["Classic","Premium","All"]',
    whats_included: '["Luxury"]',
    price: 40,
    notice: "",
    sort: 23,
    enabled: true,
  },
  {
    id: 33,
    wix_id: "wi-ceramic-coating",
    title: "2-3 Year Ceramic Coating:",
    button_title: "2-3 Year Ceramic Coating",
    add_on_title: "2-3 Year Ceramic Coating",
    detail_type: '["Exterior"]',
    package_level: '["Premium","Classic","All"]',
    whats_included: '["Luxury"]',
    price: 150,
    notice: "",
    sort: 30,
    enabled: true,
  },
];

vi.mock("../integrations/supabase/client", () => ({
  carbonQuery: vi.fn(async (sql: string) => {
    if (/ecmd_whats_included/i.test(sql)) return MOCK_WHATS_INCLUDED;
    return MOCK_SERVICE_PACKAGES;
  }),
}));

describe("EcmdWhatsIncludedModal (Wix fileWhatsIncluded.js + public.ecmd_whats_included parity)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("switches Classic/Premium/Luxury levels preserving detailType & subCategory, updates notices & subscriptions, and enforces Zero-Inline-Width Root Law + 0 MISSING_SIBLING_HOOK", async () => {
    const { container } = render(
      <EcmdWhatsIncludedModal
        isOpen={true}
        defaultLevel="Classic"
        defaultDetailType="Full"
        defaultSubCategory="Sm. SUV"
        whatsIncludedItems={MOCK_WHATS_INCLUDED}
        servicePackages={MOCK_SERVICE_PACKAGES}
        autoLoadFromSupabase={false}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("ecmd-whats-included-modal-root");
    expect(root.style.width).toBe("");

    // Classic Full Sm. SUV ($179) -> Bi-Weekly 20% ($143.20), Monthly 15% ($152.15), Quarterly 10% ($161.10)
    expect(container.querySelector("#whatsIncludedTotalPrice")?.textContent).toBe("$179.00");
    expect(container.querySelector('[data-ecmd-wi="subscription-price-bi-weekly"]')?.textContent).toBe("$143.20");
    expect(container.querySelector('[data-ecmd-wi="subscription-price-monthly"]')?.textContent).toBe("$152.15");
    expect(container.querySelector('[data-ecmd-wi="subscription-price-quarterly"]')?.textContent).toBe("$161.10");

    // Both interior & exterior lists expanded for Full detail
    const interiorSection = container.querySelector("#interiorFlexItem") as HTMLElement;
    const exteriorSection = container.querySelector("#exteriorFlexItem") as HTMLElement;
    expect(interiorSection.hidden).toBe(false);
    expect(exteriorSection.hidden).toBe(false);
    expect(container.querySelector('[data-ecmd-wi="interior-list"]')?.textContent).toContain("Spot Shampoo");
    expect(container.querySelector('[data-ecmd-wi="exterior-list"]')?.textContent).toContain("Hand Wash/Bug Removal");

    // Spot Shampoo carries a notice on Classic
    expect(container.querySelector('[data-ecmd-wi="notice"]')?.textContent).toContain(
      "Spot shampoo includes up to 3 softball size spots."
    );

    // Switch to Premium -> preserves Full + Sm. SUV, uses active sale price $149.00, clears Classic notice
    const premiumBtn = container.querySelector('[data-ecmd-wi="level-btn"][data-ecmd-level="Premium"]') as HTMLButtonElement;
    fireEvent.click(premiumBtn);

    expect(premiumBtn.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[data-ecmd-wi="title"]')?.textContent).toBe("Full Premium Detail");
    expect(container.querySelector('[data-ecmd-wi="subtitle"]')?.textContent).toContain("Full • Sm. SUV");
    expect(container.querySelector("#whatsIncludedTotalPrice")?.textContent).toBe("$149.00");
    expect(container.querySelector('[data-ecmd-wi="interior-list"]')?.textContent).toContain("Complete Int. Shampoo");
    expect(container.querySelector('[data-ecmd-wi="notice"]')).toBeNull();

    // Switch to Luxury -> custom subscription discount percents (25% / 20% / 10%) on $399.00
    const luxuryBtn = container.querySelector('[data-ecmd-wi="level-btn"][data-ecmd-level="Luxury"]') as HTMLButtonElement;
    fireEvent.click(luxuryBtn);
    expect(container.querySelector("#whatsIncludedTotalPrice")?.textContent).toBe("$399.00");
    expect(container.querySelector('[data-ecmd-wi="subscription-price-bi-weekly"]')?.textContent).toBe("$299.25");
    expect(container.querySelector('[data-ecmd-wi="subscription-price-monthly"]')?.textContent).toBe("$319.20");
    expect(container.querySelector('[data-ecmd-wi="subscription-price-quarterly"]')?.textContent).toBe("$359.10");
    // Luxury has no add-ons in MOCK_WHATS_INCLUDED -> renders Wix empty state
    expect(container.querySelector('[data-ecmd-wi="addons-empty"]')?.textContent).toContain("Luxury");

    // Zero MISSING_SIBLING_HOOK critical diagnostics
    const diags = runCanvasDiagnostics(root, {
      componentName: "EcmdWhatsIncludedModal",
      artboardTag: "desktop-1440",
      viewportMode: "desktop",
      viewportWidthPx: 1440,
    });
    expect(diags.filter((d) => d.code === "MISSING_SIBLING_HOOK")).toHaveLength(0);
  });

  it("toggles Add-Ons across Interior/Exterior tabs, persists localStorage('ecmd_addOnMemory'), updates live total, and dispatches ecmd-addons-change + ecmd-add-to-cart", () => {
    const addOnEvents: any[] = [];
    const cartEvents: any[] = [];
    const onAddOnsEvt = (e: Event) => addOnEvents.push((e as CustomEvent).detail);
    const onCartEvt = (e: Event) => cartEvents.push((e as CustomEvent).detail);
    const onAddToCartProp = vi.fn();

    window.addEventListener("ecmd-addons-change", onAddOnsEvt);
    window.addEventListener("ecmd-add-to-cart", onCartEvt);

    try {
      const { container } = render(
        <EcmdWhatsIncludedModal
          defaultOpen={true}
          defaultLevel="Classic"
          defaultDetailType="Full"
          defaultSubCategory="Sm. SUV"
          whatsIncludedItems={MOCK_WHATS_INCLUDED}
          servicePackages={MOCK_SERVICE_PACKAGES}
          autoLoadFromSupabase={false}
          onAddToCart={onAddToCartProp}
        />
      );

      // Exterior tab is active by default (Nano Claybar Decon $40 + Ceramic Coating $150)
      const extTab = container.querySelector('[data-ecmd-wi="tab-exterior"]') as HTMLButtonElement;
      const intTab = container.querySelector('[data-ecmd-wi="tab-interior"]') as HTMLButtonElement;
      expect(extTab.getAttribute("aria-pressed")).toBe("true");
      expect(intTab.getAttribute("aria-pressed")).toBe("false");

      // Toggle Nano Claybar Decon (+$40) -> $179 + $40 = $219.00
      const clayBtn = container.querySelector('[data-ecmd-wi="addon-item"][data-ecmd-addon-id="wi-clay-bar"]') as HTMLButtonElement;
      expect(clayBtn).not.toBeNull();
      expect(clayBtn.getAttribute("aria-pressed")).toBe("false");

      fireEvent.click(clayBtn);
      expect(clayBtn.getAttribute("aria-pressed")).toBe("true");
      expect(container.querySelector("#whatsIncludedTotalPrice")?.textContent).toBe("$219.00");

      // Switch to Interior tab & toggle Odor Removal (+$30) -> $179 + $40 + $30 = $249.00
      fireEvent.click(intTab);
      expect(intTab.getAttribute("aria-pressed")).toBe("true");
      const odorBtn = container.querySelector('[data-ecmd-wi="addon-item"][data-ecmd-addon-id="wi-odor-removal"]') as HTMLButtonElement;
      expect(odorBtn).not.toBeNull();

      fireEvent.click(odorBtn);
      expect(odorBtn.getAttribute("aria-pressed")).toBe("true");
      expect(container.querySelector("#whatsIncludedTotalPrice")?.textContent).toBe("$249.00");

      // Verify localStorage("ecmd_addOnMemory") persisted under Classic_Full
      const storedRaw = localStorage.getItem(ADDON_MEMORY_STORAGE_KEY);
      expect(storedRaw).not.toBeNull();
      const stored = JSON.parse(storedRaw!);
      expect(stored.map.Classic_Full).toHaveLength(2);
      expect(stored.map.Classic_Full.map((a: any) => a.title)).toEqual([
        "Nano Claybar Decon",
        "Odor Removal",
      ]);

      // Verify ecmd-addons-change was dispatched
      expect(addOnEvents).toHaveLength(2);
      expect(addOnEvents[1]).toMatchObject({
        level: "Classic",
        detailType: "Full",
        memoryKey: "Classic_Full",
        addOnsTotal: 70,
      });

      // Click Add to Cart -> dispatches ecmd-add-to-cart with full payload & closes modal
      const cartBtn = container.querySelector("#whatsIncludedAddCart") as HTMLButtonElement;
      expect(cartBtn.getAttribute("data-ecmd-wi")).toBe("add-to-cart");
      fireEvent.click(cartBtn);

      expect(cartEvents).toHaveLength(1);
      expect(cartEvents[0]).toMatchObject({
        level: "Classic",
        detailType: "Full",
        subCategory: "Sm. SUV",
        resolvedPackagePrice: 179,
        addOnsTotal: 70,
        totalPrice: 249,
        totalPriceFormatted: "$249.00",
      });
      expect(cartEvents[0].addOns).toHaveLength(2);
      expect(onAddToCartProp).toHaveBeenCalledTimes(1);
      expect(container.querySelector('[data-ecmd-wi="dialog-card"]')).toBeNull();
    } finally {
      window.removeEventListener("ecmd-addons-change", onAddOnsEvt);
      window.removeEventListener("ecmd-add-to-cart", onCartEvt);
    }
  });

  it("integrates end-to-end with EcmdPackagesRepeater: clicking What's Included opens modal, collapses sections for Interior scope, and toggling add-ons updates the card price & count in place", async () => {
    function CardTemplate() {
      const pkg = useSelector("ecmdPkg");
      return (
        <div>
          <div data-testid={`card-price-${pkg?.level}`}>{pkg?.priceFormatted}</div>
          <div data-testid={`card-addons-${pkg?.level}`} data-ecmd-pkg="addons">
            Add-Ons ({pkg?.addOnsCount ?? 0})
          </div>
          <button type="button" data-ecmd-scope-btn="interior">Interior</button>
          <button type="button" data-ecmd-scope-btn="full">Full Detail</button>
          <button type="button" data-ecmd-pkg="whats-included-btn">What&apos;s Included?</button>
        </div>
      );
    }

    const { container } = render(
      <div>
        <EcmdPackagesRepeater itemTemplate={<CardTemplate />} />
        <EcmdWhatsIncludedModal />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByTestId("card-price-Classic")).toHaveTextContent("$179");
    });

    // Switch Classic card to Interior ($149) then click What's Included?
    const classicCard = container.querySelector('.ecmd-package-card[data-ecmd-package-level="Classic"]') as HTMLElement;
    fireEvent.click(classicCard.querySelector('button[data-ecmd-scope-btn="interior"]')!);

    await waitFor(() => {
      expect(screen.getByTestId("card-price-Classic")).toHaveTextContent("$149");
    });

    fireEvent.click(classicCard.querySelector('button[data-ecmd-pkg="whats-included-btn"]')!);

    // Modal opens via ecmd-open-whats-included without spawning repeater's fallback overlay
    await waitFor(() => {
      expect(container.querySelector("#whatsIncludedLightbox")).toBeInTheDocument();
    });
    expect(container.querySelector('[data-ecmd-pkg="details-modal-overlay"]')).toBeNull();

    // Interior section expanded, Exterior section collapsed for Interior detailType
    expect((container.querySelector("#interiorFlexItem") as HTMLElement).hidden).toBe(false);
    expect((container.querySelector("#exteriorFlexItem") as HTMLElement).hidden).toBe(true);
    expect(container.querySelector("#whatsIncludedTotalPrice")?.textContent).toBe("$149.00");

    // Cross-scope Wix rule: on Interior detail, Exterior add-ons tab shows "All" exterior items (Hand Wash $30, Nano Claybar $40)
    const handWashAddon = container.querySelector('[data-ecmd-wi="addon-item"][data-ecmd-addon-id="wi-hand-wash"]') as HTMLButtonElement;
    expect(handWashAddon).not.toBeNull();
    fireEvent.click(handWashAddon);

    // Live modal total becomes $149 + $30 = $179.00 AND EcmdPackagesRepeater updates in place!
    expect(container.querySelector("#whatsIncludedTotalPrice")?.textContent).toBe("$179.00");
    await waitFor(() => {
      expect(screen.getByTestId("card-price-Classic")).toHaveTextContent("$179");
      expect(screen.getByTestId("card-addons-Classic")).toHaveTextContent("Add-Ons (1)");
    });
  });

  it("opens directly via window ecmd-open-whats-included event with explicit pkg & calculatedPrice and falls back cleanly when DB returns empty", async () => {
    const { container } = render(
      <EcmdWhatsIncludedModal autoLoadFromSupabase={false} />
    );

    expect(container.querySelector("#whatsIncludedLightbox")).toBeNull();

    act(() => {
      window.dispatchEvent(
        new CustomEvent("ecmd-open-whats-included", {
          detail: {
            pkg: {
              title: "Custom Luxury Exterior",
              package_level: "Luxury",
              detail_type: "Exterior",
              sub_category: "Truck",
              price: 315,
              sale_price: 275,
            },
            calculatedPrice: 275,
            level: "Luxury",
            detailType: "Exterior",
            subCategory: "Truck",
          },
        })
      );
    });

    await waitFor(() => {
      expect(container.querySelector("#whatsIncludedLightbox")).toBeInTheDocument();
    });
    expect(container.querySelector('[data-ecmd-wi="title"]')?.textContent).toBe("Custom Luxury Exterior");
    expect((container.querySelector("#interiorFlexItem") as HTMLElement).hidden).toBe(true);
    expect((container.querySelector("#exteriorFlexItem") as HTMLElement).hidden).toBe(false);
    expect(container.querySelector("#whatsIncludedTotalPrice")?.textContent).toBe("$275.00");
  });
});
