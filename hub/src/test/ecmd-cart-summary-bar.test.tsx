import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act, waitFor } from "@testing-library/react";
import {
  CART_DRAFT_STORAGE_KEY,
  EcmdCartSummaryBar,
  type EcmdCartDraft,
} from "../components/EcmdCartSummaryBar";
import { EcmdPackagesRepeater } from "../components/EcmdPackagesRepeater";
import { saveAddOnsMemoryMap } from "../lib/ecmdPackageMatcher";

vi.mock("../integrations/supabase/client", () => ({
  carbonQuery: vi.fn(async (sql: string) => {
    if (sql.includes("ecmd_service_packages")) {
      return [
        {
          id: 101,
          wix_id: "wix-prem-full-suv",
          title: "Full Premium Detail",
          package_level: "Premium",
          detail_type: "Full",
          sub_category: "Sm. SUV",
          price: 299,
          sale_price: 249,
          duration: 3,
          sort_order: 21,
          enabled: true,
        },
      ];
    }
    return [];
  }),
}));

describe("EcmdCartSummaryBar (Packages Page Piece 5)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("listens to ecmd-add-to-cart, persists ecmd_cart_draft, renders all readouts, and enforces Zero-Inline-Width Root Law", () => {
    const { container } = render(<EcmdCartSummaryBar />);
    const root = container.querySelector(".ecmd-cart-summary-bar-root") as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.style.width).toBe("");

    act(() => {
      window.dispatchEvent(
        new CustomEvent("ecmd-add-to-cart", {
          detail: {
            title: "Full Premium Detail",
            level: "Premium",
            detailType: "Full",
            subCategory: "Sm. SUV",
            basePrice: 299,
            salePrice: 249,
            addOns: [{ id: "ao-1", title: "Odor Removal", price: 30 }],
            addOnsTotal: 30,
            totalPrice: 279,
          },
        })
      );
    });

    expect(container.querySelector('[data-ecmd-cart="package"]')?.textContent).toContain(
      "Full Premium Detail"
    );
    expect(container.querySelector('[data-ecmd-cart="vehicle"]')?.textContent).toBe("Sm. SUV");
    expect(container.querySelector('[data-ecmd-cart="addons-count"]')?.textContent).toContain(
      "1 Add-On"
    );
    expect(container.querySelector('[data-ecmd-cart="total"]')?.textContent).toBe("$279");

    const storedRaw = window.localStorage.getItem(CART_DRAFT_STORAGE_KEY);
    expect(storedRaw).toBeTruthy();
    const stored = JSON.parse(storedRaw!) as EcmdCartDraft;
    expect(stored.level).toBe("Premium");
    expect(stored.detailType).toBe("Full");
    expect(stored.subCategory).toBe("Sm. SUV");
    expect(stored.totalPrice).toBe(279);
  });

  it("hydrates from localStorage('ecmd_cart_draft') and dispatches edit-addons and open-summary events", () => {
    window.localStorage.setItem(
      CART_DRAFT_STORAGE_KEY,
      JSON.stringify({
        title: "Luxury Interior Detail",
        level: "Luxury",
        detailType: "Interior",
        activeScope: "interior",
        subCategory: "Truck",
        vehicleKey: "truck",
        vehicleLabel: "Truck",
        basePrice: 220,
        salePrice: 0,
        resolvedPackagePrice: 220,
        addOns: [{ id: "a1", title: "Leather Clean", price: 40 }],
        addOnsTotal: 40,
        totalPrice: 260,
        totalPriceFormatted: "$260",
        updatedAt: new Date().toISOString(),
      })
    );

    const onOpenSummary = vi.fn();
    const whatsIncludedSpy = vi.fn();
    const openSummarySpy = vi.fn();
    window.addEventListener("ecmd-open-whats-included", whatsIncludedSpy);
    window.addEventListener("ecmd-open-summary", openSummarySpy);

    const { container } = render(<EcmdCartSummaryBar onOpenSummary={onOpenSummary} />);

    expect(container.querySelector('[data-ecmd-cart="vehicle"]')?.textContent).toBe("Truck");
    expect(container.querySelector('[data-ecmd-cart="total"]')?.textContent).toBe("$260");

    const editBtn = container.querySelector('[data-ecmd-cart="edit-addons"]') as HTMLButtonElement;
    fireEvent.click(editBtn);
    expect(whatsIncludedSpy).toHaveBeenCalledTimes(1);
    const wiEvent = whatsIncludedSpy.mock.calls[0]?.[0] as CustomEvent;
    expect(wiEvent.detail.level).toBe("Luxury");
    expect(wiEvent.detail.detailType).toBe("Interior");
    expect(wiEvent.detail.subCategory).toBe("Truck");

    const summaryBtn = container.querySelector(
      '[data-ecmd-cart="open-summary"]'
    ) as HTMLButtonElement;
    fireEvent.click(summaryBtn);
    expect(openSummarySpy).toHaveBeenCalledTimes(1);
    const summaryEvent = openSummarySpy.mock.calls[0]?.[0] as CustomEvent;
    expect(summaryEvent.detail.cart.level).toBe("Luxury");
    expect(summaryEvent.detail.cart.totalPrice).toBe(260);
    expect(onOpenSummary).toHaveBeenCalledTimes(1);
    expect(onOpenSummary.mock.calls[0]?.[0]?.totalPrice).toBe(260);

    window.removeEventListener("ecmd-open-whats-included", whatsIncludedSpy);
    window.removeEventListener("ecmd-open-summary", openSummarySpy);
  });

  it("wires full package add-to-cart payload from EcmdPackagesRepeater into EcmdCartSummaryBar", async () => {
    saveAddOnsMemoryMap({
      Premium_Full: [{ id: "ao-ceramic", title: "Headlight Restoration", price: 30 }],
    });

    const addToCartSpy = vi.fn();
    window.addEventListener("ecmd-add-to-cart", addToCartSpy);

    const { container } = render(
      <>
        <EcmdPackagesRepeater
          levelOrder="Premium"
          itemTemplate={
            <div>
              <span data-ecmd-pkg="title">Title</span>
              <button type="button" data-ecmd-pkg="add-to-cart-btn">
                Add to Cart
              </button>
            </div>
          }
        />
        <EcmdCartSummaryBar />
      </>
    );

    await waitFor(() => {
      expect(container.querySelector('[data-ecmd-pkg="add-to-cart-btn"]')).toBeTruthy();
    });

    fireEvent.click(container.querySelector('[data-ecmd-pkg="add-to-cart-btn"]')!);

    expect(addToCartSpy).toHaveBeenCalledTimes(1);
    const evt = addToCartSpy.mock.calls[0]?.[0] as CustomEvent;
    expect(evt.detail).toMatchObject({
      level: "Premium",
      detailType: "Full",
      subCategory: "Sm. SUV",
      basePrice: 299,
      salePrice: 249,
      addOnsTotal: 30,
      totalPrice: 279,
    });
    expect(evt.detail.addOns).toHaveLength(1);

    expect(container.querySelector('[data-ecmd-cart="total"]')?.textContent).toBe("$279");
    expect(container.querySelector('[data-ecmd-cart="addons-count"]')?.textContent).toContain(
      "1 Add-On"
    );

    window.removeEventListener("ecmd-add-to-cart", addToCartSpy);
  });
});
