import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  EcmdSideMenuController,
  DEFAULT_WIX_SITE_MENU_BUTTONS,
} from "../components/EcmdSideMenuController";

describe("EcmdSideMenuController", () => {
  it("exports 17 default Wix site menu buttons", () => {
    expect(DEFAULT_WIX_SITE_MENU_BUTTONS).toHaveLength(17);
    const automotiveBtn = DEFAULT_WIX_SITE_MENU_BUTTONS.find(
      (b) => b.button_id === "btn-automotive-detailing"
    );
    expect(automotiveBtn).toBeDefined();
    expect(automotiveBtn?.label).toBe("Automotive Detailing");
    expect(automotiveBtn?.category).toBe("Services");
    expect(automotiveBtn?.action_key).toBe("detailingPackages");
  });

  it("renders trigger hamburger button when closed", () => {
    const { container } = render(
      <EcmdSideMenuController open={false} syncFromSupabase={false} />
    );
    const trigger = container.querySelector("#ecmd-side-menu-trigger");
    expect(trigger).toBeInTheDocument();
    expect(container.querySelector("#ecmd-side-menu-card")).not.toBeInTheDocument();
  });

  it("renders menu card with theme group and modal classes when open", () => {
    const { container } = render(
      <EcmdSideMenuController
        open={true}
        syncFromSupabase={false}
        cardThemeGroup="ecmd-group-3"
        itemThemeGroup="ecmd-group-4"
      />
    );

    const card = container.querySelector("#ecmd-side-menu-card");
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass("ecmd-group-3");
    expect(card).toHaveClass("modals");
    expect(card).toHaveClass("side-menu");
    expect(card).toHaveClass("side-menu-card");
  });

  it("renders all 17 Wix button DOM IDs and Google-style category dividers", () => {
    const { container } = render(
      <EcmdSideMenuController open={true} syncFromSupabase={false} />
    );

    const expectedSlugs = [
      "automotive-detailing",
      "my-garage",
      "my-profile",
      "contacts-locations",
      "upcoming-details",
      "completed-details",
      "subscriptions",
      "gemini-ai-assistant",
      "customer-service",
      "career-opportunities",
      "login-security",
      "payment-methods",
      "gift-cards",
      "detailer-portal",
      "booking-hq",
      "login",
      "log-out",
    ];

    expectedSlugs.forEach((slug) => {
      const btn = container.querySelector(`#ecmd-menu-btn-${slug}`);
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveClass("side-menu-btn");
      expect(btn).toHaveClass("text-buttons");
      expect(btn).toHaveClass("gm-menu-item");
      expect(btn).toHaveAttribute("data-ecmd-button-id");
      expect(btn).toHaveAttribute("data-ecmd-category");
    });

    // 7 categories -> 6 category dividers between groups
    const dividers = container.querySelectorAll(".ecmd-side-menu-divider");
    expect(dividers.length).toBe(6);
  });

  it("renders child elements .side-menu-btn-icon and .side-menu-btn-label with theme classes", () => {
    const { container } = render(
      <EcmdSideMenuController open={true} syncFromSupabase={false} />
    );

    const firstBtn = container.querySelector("#ecmd-menu-btn-automotive-detailing");
    expect(firstBtn).toBeInTheDocument();

    const iconSpan = firstBtn?.querySelector(".side-menu-btn-icon.theme-icon");
    expect(iconSpan).toBeInTheDocument();

    const labelSpan = firstBtn?.querySelector(".side-menu-btn-label");
    expect(labelSpan).toBeInTheDocument();
    expect(labelSpan?.textContent).toBe("Automotive Detailing");
  });

  it("applies .is-selected class when activeButtonId matches", () => {
    const { container } = render(
      <EcmdSideMenuController
        open={true}
        syncFromSupabase={false}
        activeButtonId="btn-my-garage"
      />
    );

    const garageBtn = container.querySelector("#ecmd-menu-btn-my-garage");
    expect(garageBtn).toHaveClass("is-selected");

    const detailingBtn = container.querySelector("#ecmd-menu-btn-automotive-detailing");
    expect(detailingBtn).not.toHaveClass("is-selected");
  });

  it("fires onButtonClick callback when a button is clicked", () => {
    const handleButtonClick = vi.fn();
    const { container } = render(
      <EcmdSideMenuController
        open={true}
        syncFromSupabase={false}
        onButtonClick={handleButtonClick}
      />
    );

    const bookingHqBtn = container.querySelector("#ecmd-menu-btn-booking-hq");
    expect(bookingHqBtn).toBeInTheDocument();

    fireEvent.click(bookingHqBtn!);
    expect(handleButtonClick).toHaveBeenCalledWith(
      "btn-booking-hq",
      expect.objectContaining({
        slug: "booking-hq",
        label: "Booking HQ",
        action_key: "bCalendar",
      })
    );
  });
});
