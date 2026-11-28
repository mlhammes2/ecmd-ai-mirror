import React from "react"; import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"; import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"; import { useSelector } from "@plasmicapp/loader-react"; import { normalizeToPackageSubCategory, mapVehicleKeyToSubCategory, findMatchingServicePackage, extractOrderedPackageLevels, buildPackageCardContext, ADDON_MEMORY_STORAGE_KEY, type EcmdServicePackageRow } from "../lib/ecmdPackageMatcher"; import { EcmdPackagesRepeater, autoHealPackageScopeButtons } from "../components/EcmdPackagesRepeater";  
import { runCanvasDiagnostics } from "../lib/ecmdLiveComponentTelemetry";

const MOCK_MATRIX_ROWS: EcmdServicePackageRow[] = [
  // Classic
  { id: 1, wix_id: "c-f-sedan", title: "Full Classic Detail", package_level: "Classic", detail_type: "Full", sub_category: "Sedan", price: 179, sale_price: 0, duration: 3, description: "Classic Full Sedan desc", sort_order: 11, enabled: true },
  { id: 2, wix_id: "c-i-sedan", title: "Classic Interior Detail", package_level: "Classic", detail_type: "Interior", sub_category: "Sedan", price: 149, sale_price: 0, duration: 2, description: "Classic Interior Sedan desc", sort_order: 12, enabled: true },
  { id: 3, wix_id: "c-e-sedan", title: "Classic Exterior Detail", package_level: "Classic", detail_type: "Exterior", sub_category: "Sedan", price: 119, sale_price: 0, duration: 2, description: "Classic Exterior Sedan desc", sort_order: 13, enabled: true },
  { id: 4, wix_id: "c-f-smsuv", title: "Full Classic Detail", package_level: "Classic", detail_type: "Full", sub_category: "Sm. SUV", price: 179, sale_price: 0, duration: 3, description: "Classic Full Sm. SUV desc", sort_order: 11, enabled: true },
  { id: 5, wix_id: "c-i-smsuv", title: "Classic Interior Detail", package_level: "Classic", detail_type: "Interior", sub_category: "Sm. SUV", price: 149, sale_price: 0, duration: 2, description: "Classic Interior Sm. SUV desc", sort_order: 12, enabled: true },
  { id: 6, wix_id: "c-e-smsuv", title: "Classic Exterior Detail", package_level: "Classic", detail_type: "Exterior", sub_category: "Sm. SUV", price: 119, sale_price: 0, duration: 2, description: "Classic Exterior Sm. SUV desc", sort_order: 13, enabled: true },
  // Premium (has active sale on Full)
  { id: 7, wix_id: "p-f-smsuv", title: "Full Premium Detail", package_level: "Premium", detail_type: "Full", sub_category: "Sm. SUV", price: 299, sale_price: 149, discount_percent: 50, sale_title: "Limited-Time Promo", duration: 4, description: "Premium Full Sm. SUV desc", sort_order: 21, enabled: true },
  { id: 8, wix_id: "p-i-smsuv", title: "Premium Interior Detail", package_level: "Premium", detail_type: "Interior", sub_category: "Sm. SUV", price: 179, sale_price: 0, duration: 3, description: "Premium Interior Sm. SUV desc", sort_order: 22, enabled: true },
  { id: 9, wix_id: "p-e-smsuv", title: "Premium Exterior Detail", package_level: "Premium", detail_type: "Exterior", sub_category: "Sm. SUV", price: 179, sale_price: 0, duration: 3, description: "Premium Exterior Sm. SUV desc", sort_order: 23, enabled: true },
  { id: 10, wix_id: "p-f-lgsuv", title: "Full Premium Detail", package_level: "Premium", detail_type: "Full", sub_category: "Lg. SUV", price: 349, sale_price: 149, discount_percent: 57, sale_title: "Limited-Time Promo", duration: 4, description: "Premium Full Lg. SUV desc", sort_order: 21, enabled: true },
  // Luxury
  { id: 11, wix_id: "l-f-smsuv", title: "Full Luxury Detail", package_level: "Luxury", detail_type: "Full", sub_category: "Sm. SUV", price: 399, sale_price: 0, duration: 5, description: "Luxury Full Sm. SUV desc", sort_order: 31, enabled: true },
  { id: 12, wix_id: "l-i-smsuv", title: "Luxury Interior Detail", package_level: "Luxury", detail_type: "Interior", sub_category: "Sm. SUV", price: 279, sale_price: 0, duration: 3, description: "Luxury Interior Sm. SUV desc", sort_order: 32, enabled: true },
  { id: 13, wix_id: "l-e-smsuv", title: "Luxury Exterior Detail", package_level: "Luxury", detail_type: "Exterior", sub_category: "Sm. SUV", price: 279, sale_price: 0, duration: 3, description: "Luxury Exterior Sm. SUV desc", sort_order: 33, enabled: true },
  { id: 14, wix_id: "l-f-lgsuv", title: "Full Luxury Detail", package_level: "Luxury", detail_type: "Full", sub_category: "Lg. SUV", price: 449, sale_price: 0, duration: 5, description: "Luxury Full Lg. SUV desc", sort_order: 31, enabled: true },
];

vi.mock("../integrations/supabase/client", () => ({
  carbonQuery: vi.fn(async () => MOCK_MATRIX_ROWS),
}));

describe("ecmdPackageMatcher (Wix packageMatcher parity)", () => {
  it("normalizes vehicle keys and labels to Sedan, Truck, Sm. SUV, and Lg. SUV", () => {
    expect(normalizeToPackageSubCategory("coupe")).toBe("Sedan");
    expect(normalizeToPackageSubCategory("Car")).toBe("Sedan");
    expect(normalizeToPackageSubCategory("Compact Sedan")).toBe("Sedan");
    expect(normalizeToPackageSubCategory("truck")).toBe("Truck");
    expect(normalizeToPackageSubCategory("Pickup Truck")).toBe("Truck");
    expect(normalizeToPackageSubCategory("sm-suv")).toBe("Sm. SUV");
    expect(normalizeToPackageSubCategory("2 Row Crossover")).toBe("Sm. SUV");
    expect(normalizeToPackageSubCategory("lg-suv")).toBe("Lg. SUV");
    expect(normalizeToPackageSubCategory("3rd Row Minivan")).toBe("Lg. SUV");

    expect(mapVehicleKeyToSubCategory("coupe")).toBe("Sedan");
    expect(mapVehicleKeyToSubCategory("car")).toBe("Sedan");
    expect(mapVehicleKeyToSubCategory("truck")).toBe("Truck");
    expect(mapVehicleKeyToSubCategory("sm-suv")).toBe("Sm. SUV");
    expect(mapVehicleKeyToSubCategory("lg-suv")).toBe("Lg. SUV");
  });

  it("matches exact packageLevel + detailType + subCategory rows and orders Classic, Premium, Luxury", () => {
    const levels = extractOrderedPackageLevels(MOCK_MATRIX_ROWS, "Classic,Premium,Luxury");
    expect(levels).toEqual(["Classic", "Premium", "Luxury"]);

    const customOrder = extractOrderedPackageLevels(MOCK_MATRIX_ROWS, "Luxury,Classic,Premium");
    expect(customOrder).toEqual(["Luxury", "Classic", "Premium"]);

    const matched = findMatchingServicePackage(
      MOCK_MATRIX_ROWS,
      { package_level: "Premium", detail_type: "Full" },
      "lg-suv"
    );
    expect(matched?.wix_id).toBe("p-f-lgsuv");
    expect(matched?.price).toBe(349);
    expect(matched?.sale_price).toBe(149);

    const ctx = buildPackageCardContext({
      level: "Premium",
      activeScope: "full",
      vehicleKey: "lg-suv",
      vehicleLabel: "Lg. SUV",
      matchedRow: matched,
      addOnsMap: {
        Premium_Full: [{ id: "a1", title: "Pet Hair", price: 40 }],
      },
    });
    expect(ctx.hasSale).toBe(true);
    expect(ctx.basePriceFormatted).toBe("$389");
    expect(ctx.salePriceFormatted).toBe("$189");
    expect(ctx.priceFormatted).toBe("$189");
    expect(ctx.addOnsCount).toBe(1);
    expect(ctx.durationText).toBe("4 Hrs");
  });
});

describe("EcmdBrushedSteelButton buttonRole & autoHealPackageScopeButtons", () => {
  afterEach(() => {
    cleanup();
  });

  
  it("auto-heals short and long scope labels + What's Included + Add to Cart while skipping false scope hooks in bottom CTA rows", () => {
    const host = document.createElement("div");
    host.innerHTML = `
      <div class="ecmd-package-card">
        <div class="scope-row">
          <button>Interior</button>
          <button>Full Detail</button>
          <button>Exterior</button>
        </div>
        <div class="cta-row">
          <button>Add to Cart</button>
          <button>What's Included</button>
          <button>Exterior</button>
        </div>
      </div>
    `;
    document.body.appendChild(host);

    const healed = autoHealPackageScopeButtons(host);
    expect(healed).toBe(5);

    const scopeBtns = Array.from(host.querySelectorAll(".scope-row button"));
    expect(scopeBtns[0]?.getAttribute("data-ecmd-scope-btn")).toBe("interior");
    expect(scopeBtns[1]?.getAttribute("data-ecmd-scope-btn")).toBe("full");
    expect(scopeBtns[2]?.getAttribute("data-ecmd-scope-btn")).toBe("exterior");

    const ctaBtns = Array.from(host.querySelectorAll(".cta-row button"));
    expect(ctaBtns[0]?.getAttribute("data-ecmd-action")).toBe("add-to-cart");
    expect(ctaBtns[0]?.getAttribute("data-ecmd-pkg")).toBe("add-to-cart-btn");
    expect(ctaBtns[1]?.getAttribute("data-ecmd-action")).toBe("open-whats-included");
    expect(ctaBtns[1]?.getAttribute("data-ecmd-pkg")).toBe("whats-included-btn");
    // Mislabeled default "Exterior" inside bottom CTA row must NOT get a false scope hook
    expect(ctaBtns[2]?.getAttribute("data-ecmd-scope-btn")).toBeNull();

    const diags = runCanvasDiagnostics(host, {
      componentName: "EcmdPackagesRepeater",
      artboardTag: "mobile-430",
      viewportMode: "mobile",
      viewportWidthPx: 430,
    });
    expect(diags.filter((d) => d.code === "MISSING_SIBLING_HOOK" && d.message.includes("data-ecmd-scope-btn"))).toHaveLength(0);

    host.remove();
  });
});

