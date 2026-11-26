import React from "react";
import { render, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  EcmdWhatsIncludedItemPopup,
  parseWhatsIncludedItemSteps,
} from "../components/EcmdWhatsIncludedItemPopup";
import {
  EcmdWhatsIncludedModal,
  type EcmdWhatsIncludedRow,
} from "../components/EcmdWhatsIncludedModal";
import { ADDON_MEMORY_STORAGE_KEY } from "../lib/ecmdPackageMatcher";
import { runCanvasDiagnostics } from "../lib/ecmdLiveComponentTelemetry";

const SAMPLE_ITEMS: Array<Record<string, unknown>> = [
  {
    id: 101,
    wix_id: "wi-clay-bar",
    title: "Nano Clay Bar Decontamination:",
    add_on_title: "Nano Claybar Decon",
    detail_type: '["Exterior"]',
    price: 40,
    image_url: "https://example.com/clay-bar.jpg",
    steps: [
      "Pre-rinse and apply pH-neutral clay lubricant",
      "",
      "Glide nano clay mitt across all painted panels & glass",
      "Wipe dry with plush microfiber towel",
    ],
    notice: "Recommended before applying wax or ceramic sealants.",
  },
  {
    id: 102,
    wix_id: "wi-odor-removal",
    title: "Odor Removal:",
    add_on_title: "Odor Removal",
    detail_type: '["Interior"]',
    price: 30,
    description: "- Deep clean source fabrics\n\n- Run ozone neutralizer cycle\n• Ventilate cabin thoroughly",
  },
  {
    id: 103,
    wix_id: "wi-hand-wash",
    title: "Hand Wash & Rinse:",
    detail_type: '["Exterior"]',
    price: 0,
    details: "1. Foam cannon pre-soak\n2. Two-bucket microfiber hand wash",
  },
];

describe("EcmdWhatsIncludedItemPopup (fileWhatsIncludedG.js parity)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("opens via window ecmd-open-whats-included-item event, parses steps cleanly, renders optional media only when valid, and enforces Zero-Inline-Width + 0 MISSING_SIBLING_HOOK", async () => {
    const { container } = render(<EcmdWhatsIncludedItemPopup />);

    expect(container.querySelector('[data-ecmd-wi-item="popup"]')).toBeNull();

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("ecmd-whats-included-item-popup-root");
    expect(root.style.width).toBe("");

    act(() => {
      window.dispatchEvent(
        new CustomEvent("ecmd-open-whats-included-item", {
          detail: {
            item: SAMPLE_ITEMS[0],
            items: SAMPLE_ITEMS,
            packageLevel: "Classic",
            detailType: "Full",
            subCategory: "Sm. SUV",
          },
        })
      );
    });

    await waitFor(() => {
      expect(container.querySelector('[data-ecmd-wi-item="popup"]')).toBeInTheDocument();
    });

    const dialog = container.querySelector('[data-ecmd-wi-item="popup"]') as HTMLElement;
    expect(dialog.getAttribute("role")).toBe("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(container.querySelector('[data-ecmd-wi-item="title"]')?.textContent).toBe(
      "Nano Clay Bar Decontamination"
    );
    expect(container.querySelector('[data-ecmd-wi-item="badge"]')?.textContent).toContain("Classic");
    expect(container.querySelector('[data-ecmd-wi-item="badge"]')?.textContent).toContain("Exterior");
    expect(container.querySelector('[data-ecmd-wi-item="badge"]')?.textContent).toContain("+$40");

    // Preview media renders when valid non-empty URL exists
    const media = container.querySelector('[data-ecmd-wi-item="media"]') as HTMLImageElement | null;
    expect(media).not.toBeNull();
    expect(media?.getAttribute("src")).toBe("https://example.com/clay-bar.jpg");

    // Step list filters empty lines (3 real steps out of 4 entries)
    const stepNodes = container.querySelectorAll('[data-ecmd-wi-item="steps"] li');
    expect(stepNodes).toHaveLength(3);
    expect(stepNodes[0]?.textContent).toContain("Pre-rinse and apply pH-neutral clay lubricant");
    expect(stepNodes[2]?.textContent).toContain("Wipe dry with plush microfiber towel");

    // Zero MISSING_SIBLING_HOOK critical diagnostics
    const diags = runCanvasDiagnostics(root, {
      componentName: "EcmdWhatsIncludedItemPopup",
      artboardTag: "desktop-1440",
      viewportMode: "desktop",
      viewportWidthPx: 1440,
    });
    expect(diags.filter((d) => d.code === "MISSING_SIBLING_HOOK")).toHaveLength(0);
  });

  it("navigates Prev/Next across items, hides media when absent, parses description/details lines, and hides toggle-addon when price is 0 with no addon flag", () => {
    const { container } = render(
      <EcmdWhatsIncludedItemPopup
        isOpen={true}
        item={SAMPLE_ITEMS[0] ?? null}
        items={SAMPLE_ITEMS}
        packageLevel="Premium"
        detailType="Full"
        subCategory="Truck"
      />
    );

    const nextBtn = container.querySelector('[data-ecmd-wi-item="next"]') as HTMLButtonElement;
    const prevBtn = container.querySelector('[data-ecmd-wi-item="prev"]') as HTMLButtonElement;
    expect(nextBtn).not.toBeNull();
    expect(prevBtn).not.toBeNull();

    // Advance to item 2 (Odor Removal, no image URL, newline/bullet description)
    fireEvent.click(nextBtn);
    expect(container.querySelector('[data-ecmd-wi-item="title"]')?.textContent).toBe("Odor Removal");
    expect(container.querySelector('[data-ecmd-wi-item="media"]')).toBeNull();
    const odorSteps = container.querySelectorAll('[data-ecmd-wi-item="steps"] li');
    expect(odorSteps).toHaveLength(3);
    expect(odorSteps[0]?.textContent).toContain("Deep clean source fabrics");
    expect(odorSteps[1]?.textContent).toContain("Run ozone neutralizer cycle");
    expect(odorSteps[2]?.textContent).toContain("Ventilate cabin thoroughly");

    // Advance to item 3 (Hand Wash, price 0 -> no toggle-addon button)
    fireEvent.click(nextBtn);
    expect(container.querySelector('[data-ecmd-wi-item="title"]')?.textContent).toBe("Hand Wash & Rinse");
    expect(container.querySelector('[data-ecmd-wi-item="toggle-addon"]')).toBeNull();
    const washSteps = container.querySelectorAll('[data-ecmd-wi-item="steps"] li');
    expect(washSteps).toHaveLength(2);
    expect(washSteps[0]?.textContent).toContain("Foam cannon pre-soak");

    // Go back with Prev -> back to Odor Removal
    fireEvent.click(prevBtn);
    expect(container.querySelector('[data-ecmd-wi-item="title"]')?.textContent).toBe("Odor Removal");
  });

  it("persists add-on toggle to localStorage('ecmd_addOnMemory') under ${level}_${scope} and dispatches ecmd-addons-change", () => {
    const receivedEvents: Array<Record<string, unknown>> = [];
    const onAddOnsChange = (e: Event) => {
      if (e instanceof CustomEvent && e.detail && typeof e.detail === "object") {
        receivedEvents.push(e.detail as Record<string, unknown>);
      }
    };
    window.addEventListener("ecmd-addons-change", onAddOnsChange);

    try {
      const { container } = render(
        <EcmdWhatsIncludedItemPopup
          isOpen={true}
          item={SAMPLE_ITEMS[0] ?? null}
          items={[SAMPLE_ITEMS[0]!]}
          packageLevel="Classic"
          detailType="Interior"
          subCategory="Sedan"
        />
      );

      // Single item -> Prev/Next should not render
      expect(container.querySelector('[data-ecmd-wi-item="prev"]')).toBeNull();
      expect(container.querySelector('[data-ecmd-wi-item="next"]')).toBeNull();

      const toggleBtn = container.querySelector(
        '[data-ecmd-wi-item="toggle-addon"]'
      ) as HTMLButtonElement;
      expect(toggleBtn).not.toBeNull();
      expect(toggleBtn.getAttribute("aria-pressed")).toBe("false");

      // Toggle ON
      fireEvent.click(toggleBtn);
      expect(toggleBtn.getAttribute("aria-pressed")).toBe("true");

      const storedRaw = localStorage.getItem(ADDON_MEMORY_STORAGE_KEY);
      expect(storedRaw).not.toBeNull();
      const stored = JSON.parse(storedRaw!);
      expect(stored.map.Classic_Interior).toHaveLength(1);
      expect(stored.map.Classic_Interior[0]).toMatchObject({
        wix_id: "wi-clay-bar",
        title: "Nano Claybar Decon",
        price: 40,
      });

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toMatchObject({
        level: "Classic",
        detailType: "Interior",
        memoryKey: "Classic_Interior",
        addOnsTotal: 40,
        source: "EcmdWhatsIncludedItemPopup",
      });

      // Toggle OFF
      fireEvent.click(toggleBtn);
      expect(toggleBtn.getAttribute("aria-pressed")).toBe("false");
      const storedAfter = JSON.parse(localStorage.getItem(ADDON_MEMORY_STORAGE_KEY)!);
      expect(storedAfter.map.Classic_Interior).toHaveLength(0);
      expect(receivedEvents).toHaveLength(2);
    } finally {
      window.removeEventListener("ecmd-addons-change", onAddOnsChange);
    }
  });

  it("closes on Escape key and backdrop click, and wires seamlessly with EcmdWhatsIncludedModal inspect triggers", async () => {
    const onClose = vi.fn();
    const { container, unmount } = render(
      <EcmdWhatsIncludedItemPopup
        isOpen={true}
        onClose={onClose}
        item={SAMPLE_ITEMS[0] ?? null}
        items={SAMPLE_ITEMS}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    const backdrop = container.querySelector('[data-ecmd-wi-item="backdrop"]') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(2);
    unmount();

    // Uncontrolled integration with EcmdWhatsIncludedModal
    const modalItems: EcmdWhatsIncludedRow[] = [
      {
        id: 1,
        wix_id: "wi-door-jam",
        title: "Door Jam Cleaning:",
        button_title: "Door Jam Cleaning",
        add_on_title: "Door Jam Cleaning",
        detail_type: '["Interior"]',
        package_level: '["All"]',
        whats_included: '["Classic"]',
        price: 20,
        description: "Step 1: Degrease hinges\nStep 2: Microfiber wipe down",
        sort: 1,
        enabled: true,
      },
    ];

    const { container: integrationContainer } = render(
      <div>
        <EcmdWhatsIncludedModal
          defaultOpen={true}
          defaultLevel="Classic"
          defaultDetailType="Full"
          defaultSubCategory="Sm. SUV"
          whatsIncludedItems={modalItems}
          autoLoadFromSupabase={false}
        />
        <EcmdWhatsIncludedItemPopup />
      </div>
    );

    const inspectBtn = integrationContainer.querySelector(
      '[data-ecmd-wi="inspect-item"]'
    ) as HTMLButtonElement;
    expect(inspectBtn).not.toBeNull();
    fireEvent.click(inspectBtn);

    await waitFor(() => {
      expect(integrationContainer.querySelector('[data-ecmd-wi-item="popup"]')).toBeInTheDocument();
    });
    expect(integrationContainer.querySelector('[data-ecmd-wi-item="title"]')?.textContent).toBe(
      "Door Jam Cleaning"
    );

    // Pressing Escape closes the item popup while keeping the underlying modal open
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(integrationContainer.querySelector('[data-ecmd-wi-item="popup"]')).toBeNull();
    });
    expect(integrationContainer.querySelector("#whatsIncludedLightbox")).toBeInTheDocument();
  });

  it("parseWhatsIncludedItemSteps handles bullets, JSON arrays, and empty lines", () => {
    expect(
      parseWhatsIncludedItemSteps({
        bullets: '["  • First step  ", "", "2. Second step"]',
      })
    ).toEqual(["First step", "Second step"]);
  });
});
