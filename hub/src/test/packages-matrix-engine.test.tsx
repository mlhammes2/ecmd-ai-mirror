import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSelector } from "@plasmicapp/loader-react";
import {
  normalizeToPackageSubCategory,
  mapVehicleKeyToSubCategory,
  findMatchingServicePackage,
  extractOrderedPackageLevels,
  buildPackageCardContext,
  ADDON_MEMORY_STORAGE_KEY,
  type EcmdServicePackageRow,
} from "../lib/ecmdPackageMatcher";
import {
  EcmdPackagesRepeater,
  autoHealPackageScopeButtons,
} from "../components/EcmdPackagesRepeater";
import {
  EcmdBrushedSteelButton,
  resolveSteelButtonRoleAttrs,
} from "../components/EcmdBrushedSteelButton";
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

  it("stamps role hooks for every buttonRole choice without breaking Zero-Inline-Width Root Law", () => {
    expect(resolveSteelButtonRoleAttrs("auto")).toEqual({});
    expect(resolveSteelButtonRoleAttrs("scope-interior")).toEqual({
      "data-ecmd-scope-btn": "interior",
    });
    expect(resolveSteelButtonRoleAttrs("scope-full")).toEqual({
      "data-ecmd-scope-btn": "full",
    });
    expect(resolveSteelButtonRoleAttrs("scope-exterior")).toEqual({
      "data-ecmd-scope-btn": "exterior",
    });
    expect(resolveSteelButtonRoleAttrs("whats-included")).toEqual({
      "data-ecmd-action": "open-whats-included",
      "data-ecmd-pkg": "whats-included-btn",
    });
    expect(resolveSteelButtonRoleAttrs("add-to-cart")).toEqual({
      "data-ecmd-action": "add-to-cart",
      "data-ecmd-pkg": "add-to-cart-btn",
    });

    const { container } = render(
      <div>
        <EcmdBrushedSteelButton label="Interior" buttonRole="scope-interior" />
        <EcmdBrushedSteelButton label="What's Included" buttonRole="whats-included" />
        <EcmdBrushedSteelButton label="Add to Cart" buttonRole="add-to-cart" />
      </div>
    );

    const buttons = Array.from(container.querySelectorAll("button.steel-button"));
    expect(buttons[0]?.getAttribute("data-ecmd-scope-btn")).toBe("interior");
    expect(buttons[1]?.getAttribute("data-ecmd-action")).toBe("open-whats-included");
    expect(buttons[1]?.getAttribute("data-ecmd-pkg")).toBe("whats-included-btn");
    expect(buttons[2]?.getAttribute("data-ecmd-action")).toBe("add-to-cart");
    expect(buttons[2]?.getAttribute("data-ecmd-pkg")).toBe("add-to-cart-btn");

    // Zero-Inline-Width Root Law preserved
    const roots = container.querySelectorAll(".ecmd-steel-button-root");
    roots.forEach((r) => {
      expect((r as HTMLElement).style.width).toBe("");
    });
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

describe("EcmdPackagesRepeater 3-level matrix engine, DataProvider($ctx.ecmdPkg) & live DOM painting", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders 3 Classic/Premium/Luxury cards, exposes $ctx.ecmdPkg via DataProvider, syncs steel button glow, and live-paints DOM in place", async () => {
    localStorage.setItem(
      ADDON_MEMORY_STORAGE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        map: {
          Classic_Interior: [{ id: "addon-1", title: "Pet Hair", price: 40 }],
        },
      })
    );

    function StudioCardTemplate() {
      const pkg = useSelector("ecmdPkg");
      return (
        <div className="studio-card">
          <div data-testid={`ctx-summary-${pkg?.level}`}>
            {pkg?.level}|{pkg?.detailType}|{pkg?.subCategory}|{pkg?.priceFormatted}
          </div>
          <div id="packageTitle" data-ecmd-pkg="title">Placeholder Title</div>
          <div className="scope-row">
            <EcmdBrushedSteelButton label="Interior" buttonRole="scope-interior" />
            <EcmdBrushedSteelButton label="Full Detail" buttonRole="scope-full" />
            <EcmdBrushedSteelButton label="Exterior" buttonRole="scope-exterior" />
          </div>
          <div className="meta-row">
            <div data-ecmd-pkg="vehicle-label">Type:</div>
            <div data-ecmd-pkg="vehicle-label">Placeholder Size</div>
            <div data-ecmd-pkg="duration">Duration:</div>
            <div data-ecmd-pkg="duration">0Hrs</div>
            <div data-ecmd-pkg="sale-price">SALE:</div>
            <div id="packageSalePrice" data-ecmd-pkg="sale-price">$0</div>
            <div data-ecmd-pkg="regular-price">Price:</div>
            <div id="packagePrice" data-ecmd-pkg="price">$0</div>
          </div>
          <div className="cta-row">
            <EcmdBrushedSteelButton label="Add to Cart" buttonRole="add-to-cart" />
            <EcmdBrushedSteelButton label="What's Included" buttonRole="whats-included" />
          </div>
        </div>
      );
    }

    const { container } = render(
      <EcmdPackagesRepeater itemTemplate={<StudioCardTemplate />} />
    );

    await waitFor(() => {
      expect(screen.getByTestId("ctx-summary-Classic")).toBeInTheDocument();
    });

    const cards = Array.from(container.querySelectorAll<HTMLElement>(".ecmd-package-card"));
    expect(cards).toHaveLength(3);
    const classicCard = cards[0]!;
    const premiumCard = cards[1]!;
    const luxuryCard = cards[2]!;
    expect(classicCard.getAttribute("data-ecmd-package-level")).toBe("Classic");
    expect(premiumCard.getAttribute("data-ecmd-package-level")).toBe("Premium");
    expect(luxuryCard.getAttribute("data-ecmd-package-level")).toBe("Luxury");

    // Verify $ctx.ecmdPkg bindings for initial Full + Sm. SUV
    expect(screen.getByTestId("ctx-summary-Classic").textContent).toBe("Classic|Full|Sm. SUV|$179");
    expect(screen.getByTestId("ctx-summary-Premium").textContent).toBe("Premium|Full|Sm. SUV|$149");
    expect(screen.getByTestId("ctx-summary-Luxury").textContent).toBe("Luxury|Full|Sm. SUV|$399");

    // Verify live DOM painting preserves static labels ("Price:", "Duration:") and paints values
    expect(classicCard.querySelector("#packageTitle")?.textContent).toBe("Full Classic Detail");
    expect(classicCard.querySelector("#packagePrice")?.textContent).toBe("$179");
    const classicRegLabels = Array.from(classicCard.querySelectorAll('[data-ecmd-pkg="regular-price"]'));
    expect(classicRegLabels[0]?.textContent).toBe("Price:");
    // Classic Full has no sale -> sale-price hidden
    expect((classicCard.querySelector("#packageSalePrice") as HTMLElement).style.display).toBe("none");

    // Premium Full HAS sale ($299 -> $149) -> sale-price visible and painted!
    expect(premiumCard.querySelector("#packagePrice")?.textContent).toBe("$299");
    expect(premiumCard.querySelector("#packageSalePrice")?.textContent).toBe("$149");
    expect((premiumCard.querySelector("#packageSalePrice") as HTMLElement).style.display).not.toBe("none");

    // Full Detail steel button is selected by default on Classic card
    const classicFullBtn = classicCard.querySelector('button[data-ecmd-scope-btn="full"]') as HTMLButtonElement;
    const classicIntBtn = classicCard.querySelector('button[data-ecmd-scope-btn="interior"]') as HTMLButtonElement;
    expect(classicFullBtn.getAttribute("data-ecmd-selected")).toBe("true");
    expect(classicFullBtn.getAttribute("aria-pressed")).toBe("true");
    expect(classicIntBtn.getAttribute("data-ecmd-selected")).toBe("false");

    // Click Interior on Classic card -> switches glow & adds saved $40 Classic_Interior add-on ($149 + $40 = $189)!
    fireEvent.click(classicIntBtn);
    await waitFor(() => {
      expect(screen.getByTestId("ctx-summary-Classic").textContent).toBe("Classic|Interior|Sm. SUV|$189");
    });
    expect(classicIntBtn.getAttribute("data-ecmd-selected")).toBe("true");
    expect(classicIntBtn.getAttribute("aria-pressed")).toBe("true");
    expect(classicFullBtn.getAttribute("data-ecmd-selected")).toBe("false");
    expect(classicCard.querySelector("#packagePrice")?.textContent).toBe("$189");

    // Switch vehicle to lg-suv -> Luxury updates from $399 to $449
    fireEvent(
      window,
      new CustomEvent("ecmd-vehicle-change", {
        detail: { vehicleKey: "lg-suv", label: "Lg. SUV" },
      })
    );
    await waitFor(() => {
      expect(screen.getByTestId("ctx-summary-Luxury").textContent).toBe("Luxury|Full|Lg. SUV|$449");
    });

    // Zero critical MISSING_SIBLING_HOOK diagnostics across the rendered repeater
    const diags = runCanvasDiagnostics(container.firstElementChild as HTMLElement, {
      componentName: "EcmdPackagesRepeater",
      artboardTag: "desktop-1440",
      viewportMode: "desktop",
      viewportWidthPx: 1440,
    });
    expect(diags.filter((d) => d.code === "MISSING_SIBLING_HOOK")).toHaveLength(0);
  });
});
