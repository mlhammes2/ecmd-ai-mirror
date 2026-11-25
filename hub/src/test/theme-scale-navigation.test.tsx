import React, { useState } from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import {
  createThemeDesignToken,
  createThemeImageGroup,
  filterAndSortDesignTokens,
  filterAndSortImageGroups,
  filterAndSortThemeGroups,
  type ThemeDesignToken,
  type ThemeImageGroup,
} from "../lib/ecmdThemeEngine";
import {
  EcmdDynamicGroupManagerControl,
  bindTokenToGroupState,
  buildInitialGroupsFromProps,
  type DynamicGroupItem,
  type DynamicGroupsPayload,
} from "../components/EcmdDynamicGroupManager";

describe("50+ Scale Navigation Upgrade (Natural A-Z Sort, Live Search, Pinning & Accordion)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("filterAndSortThemeGroups enforces natural case-insensitive A-Z default, Z-A reverse, Custom order, and pinned-first A-Z ordering", () => {
    const groups = [
      { id: 1, name: "Zebra", selector: ".zebra" },
      { id: 2, name: "button 10", selector: ".btn-10" },
      { id: 3, name: "alpha", selector: ".alpha" },
      { id: 4, name: "Button 2", selector: ".btn-2" },
    ];

    // Default ("az") natural alphabetical ordering
    const azDefault = filterAndSortThemeGroups(groups);
    expect(azDefault.map((g) => g.name)).toEqual(["alpha", "Button 2", "button 10", "Zebra"]);

    // Explicit "za" reverse natural ordering
    const za = filterAndSortThemeGroups(groups, { sortBy: "za" });
    expect(za.map((g) => g.name)).toEqual(["Zebra", "button 10", "Button 2", "alpha"]);

    // Explicit "custom" preserves original input order
    const custom = filterAndSortThemeGroups(groups, { sortBy: "custom" });
    expect(custom.map((g) => g.name)).toEqual(["Zebra", "button 10", "alpha", "Button 2"]);

    // Pinned items sort A-Z ahead of unpinned items
    const withPins = [
      { id: 1, name: "Zebra", selector: ".zebra", pinned: true },
      { id: 2, name: "button 10", selector: ".btn-10" },
      { id: 3, name: "alpha", selector: ".alpha" },
      { id: 4, name: "Button 2", selector: ".btn-2", pinned: true },
    ];
    const pinnedAz = filterAndSortThemeGroups(withPins, { sortBy: "az" });
    expect(pinnedAz.map((g) => g.name)).toEqual(["Button 2", "Zebra", "alpha", "button 10"]);

    const pinnedZa = filterAndSortThemeGroups(withPins, { sortBy: "za" });
    expect(pinnedZa.map((g) => g.name)).toEqual(["Button 2", "Zebra", "button 10", "alpha"]);
  });

  it("filterAndSortThemeGroups matches instantaneously by Group name, CSS selector, and linked token names (default & sub-states)", () => {
    const tokensMap: Record<string, string> = {
      "tok-box-shadow-hero-glass": "Hero Glass Lift",
      "tok-paint-ocean-glow": "Ocean Emerald Gradient",
    };

    const groups = [
      {
        id: 1,
        name: "Primary CTA",
        selector: ".buttonstandard, .btn-primary",
        tokenRefs: { boxShadow: "tok-box-shadow-hero-glass" },
      },
      {
        id: 2,
        name: "Auth Email Input",
        selector: "#ecmd-auth-email-input",
        stateOverrides: {
          hover: {
            tokenRefs: { background: "tok-paint-ocean-glow" },
          },
        },
      },
      {
        id: 3,
        name: "Footer Divider",
        selector: ".footer-line",
      },
    ];

    // Match by name (case-insensitive)
    expect(
      filterAndSortThemeGroups(groups, { query: "footer", tokensMap }).map((g) => g.id)
    ).toEqual([3]);

    // Match by CSS class selector (with or without dot)
    expect(
      filterAndSortThemeGroups(groups, { query: ".buttonstandard", tokensMap }).map((g) => g.id)
    ).toEqual([1]);
    expect(
      filterAndSortThemeGroups(groups, { query: "buttonstandard", tokensMap }).map((g) => g.id)
    ).toEqual([1]);

    // Match by ID selector
    expect(
      filterAndSortThemeGroups(groups, { query: "#ecmd-auth-email-input", tokensMap }).map((g) => g.id)
    ).toEqual([2]);

    // Match by default linked token name
    expect(
      filterAndSortThemeGroups(groups, { query: "hero glass", tokensMap }).map((g) => g.id)
    ).toEqual([1]);

    // Match by sub-state (hover) linked token name
    expect(
      filterAndSortThemeGroups(groups, { query: "ocean emerald", tokensMap }).map((g) => g.id)
    ).toEqual([2]);

    // Frozen order while actively renaming keeps order stable mid-keystroke
    const frozen = filterAndSortThemeGroups(
      [
        { id: 1, name: "Zzz Renamed", selector: ".a" },
        { id: 2, name: "Alpha", selector: ".b" },
      ],
      {
        sortBy: "az",
        frozenOrderIds: [1, 2],
        focusedRenameId: 1,
      }
    );
    expect(frozen.map((g) => g.id)).toEqual([1, 2]);
  });

  it("filterAndSortImageGroups and filterAndSortDesignTokens enforce natural A-Z, pinning, and search across Images & Tokens", () => {
    const img1 = createThemeImageGroup([], "Hero Banner 10", ".ecmd-img-hero-10");
    const img2 = createThemeImageGroup([img1], "Hero Banner 2", ".ecmd-img-hero-2");
    const img3: ThemeImageGroup = {
      ...createThemeImageGroup([img1, img2], "Zebra Wordmark", ".ecmd-img-zebra"),
      pinned: true,
    };
    const sortedImgs = filterAndSortImageGroups([img1, img2, img3]);
    expect(sortedImgs.map((i) => i.label)).toEqual([
      "Zebra Wordmark",
      "Hero Banner 2",
      "Hero Banner 10",
    ]);
    expect(filterAndSortImageGroups([img1, img2, img3], { query: "hero-2" }).map((i) => i.id)).toEqual([
      img2.id,
    ]);

    const t1 = createThemeDesignToken([], { name: "Shadow 10", type: "boxShadow", value: { css: "0 10px 20px #000" } });
    const t2 = createThemeDesignToken([t1], { name: "Shadow 2", type: "boxShadow", value: { css: "0 2px 4px #000" } });
    const t3: ThemeDesignToken = {
      ...createThemeDesignToken([t1, t2], { name: "Zebra Glow", type: "boxShadow", value: { css: "0 0 12px #10B981" } }),
      pinned: true,
    };
    const sortedTokens = filterAndSortDesignTokens([t1, t2, t3]);
    expect(sortedTokens.map((t) => t.name)).toEqual(["Zebra Glow", "Shadow 2", "Shadow 10"]);
    expect(
      filterAndSortDesignTokens([t1, t2, t3], { query: "10b981" }).map((t) => t.name)
    ).toEqual(["Zebra Glow"]);
  });

  it("wires sticky search, natural A-Z sort, pin-to-top, zero mid-keystroke jump, collapse/expand all, and + New Group auto-expand into Groups, Images, and Tokens tabs", () => {
    const base = buildInitialGroupsFromProps({}, undefined);
    const tok = createThemeDesignToken([], {
      name: "Emerald Luxe Lift",
      type: "boxShadow",
      value: { css: "0 8px 24px rgba(16,185,129,0.28)" },
    });

    const g1: DynamicGroupItem = {
      ...base.groups["1"]!,
      id: 1,
      name: "Heading 10",
      selector: ".heading-10",
    };
    const g2: DynamicGroupItem = bindTokenToGroupState(
      {
        ...base.groups["2"]!,
        id: 2,
        name: "Heading 2",
        selector: ".buttonstandard",
      },
      "default",
      "boxShadow",
      tok.id
    );
    const g3: DynamicGroupItem = {
      ...base.groups["3"]!,
      id: 3,
      name: "Zebra Card",
      selector: "#ecmd-auth-email-input",
    };

    const payload: DynamicGroupsPayload = {
      selectedId: 2,
      multiIds: [1, 2, 3],
      groups: { "1": g1, "2": g2, "3": g3 },
      imageGroups: [
        createThemeImageGroup([], "Logo 10", ".ecmd-img-logo-10"),
        createThemeImageGroup([], "Logo 2", ".ecmd-img-logo-2"),
      ],
      designTokens: [
        tok,
        createThemeDesignToken([tok], {
          name: "Alpha Shadow",
          type: "boxShadow",
          value: { css: "0 2px 6px rgba(0,0,0,0.2)" },
        }),
      ],
    };

    function Harness() {
      const [json, setJson] = useState<string>(() => JSON.stringify(payload));
      return (
        <EcmdDynamicGroupManagerControl
          value={json}
          updateValue={setJson}
          componentProps={{ presetTheme: "coastal-light" }}
        />
      );
    }

    render(<Harness />);

    // Open Theme Groups Inspector
    act(() => {
      fireEvent.click(document.querySelector('button[title="Open Theme Groups Inspector"]')!);
    });

    // 1. Default A -> Z natural sort: Heading 2 before Heading 10 before Zebra Card
    const getCardIds = () =>
      Array.from(document.querySelectorAll("[data-ecmd-group-card]")).map((el) =>
        Number(el.getAttribute("data-ecmd-group-card"))
      );
    expect(getCardIds()).toEqual([2, 1, 3]);
    expect(document.querySelector('[data-ecmd-groups-showing-badge="true"]')?.textContent).toBe(
      "Showing 3 of 3"
    );

    // 2. Pin "Zebra Card" (#3) -> jumps cleanly to top ahead of unpinned A-Z groups!
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-group-pin-btn="3"]')!);
    });
    expect(getCardIds()).toEqual([3, 2, 1]);

    // 3. Zero mid-keystroke jump: focus rename input on Heading 2 (#2), rename to "ZZZ Temp" -> stays at index 1 while focused, then re-sorts on blur!
    const renameInput = document.querySelector('[data-ecmd-group-rename-input="2"]') as HTMLInputElement;
    expect(renameInput).not.toBeNull();
    act(() => {
      fireEvent.focus(renameInput);
      fireEvent.change(renameInput, { target: { value: "ZZZ Temp" } });
    });
    expect(getCardIds()).toEqual([3, 2, 1]); // Frozen while typing!
    act(() => {
      fireEvent.blur(renameInput);
    });
    expect(getCardIds()).toEqual([3, 1, 2]); // Re-sorted cleanly after blur!

    // 4. Live Search by linked token name ("Emerald Luxe") + empty state + Clear Search
    const searchInput = document.querySelector('[data-ecmd-groups-search-input="true"]') as HTMLInputElement;
    act(() => {
      fireEvent.change(searchInput, { target: { value: "emerald luxe" } });
    });
    expect(getCardIds()).toEqual([2]);
    expect(document.querySelector('[data-ecmd-groups-showing-badge="true"]')?.textContent).toBe(
      "Showing 1 of 3"
    );

    act(() => {
      fireEvent.change(searchInput, { target: { value: "nonexistent-xyz" } });
    });
    expect(document.querySelector('[data-ecmd-groups-search-empty="true"]')?.textContent).toContain(
      "No groups match 'nonexistent-xyz'"
    );

    // 5. Clicking [+ New Group] while search hides results clears search & auto-expands the new group!
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-new-group-btn="true"]')!);
    });
    expect(searchInput.value).toBe("");
    const newCard = document.querySelector('[data-ecmd-group-card="4"]');
    expect(newCard?.getAttribute("data-ecmd-group-expanded")).toBe("true");

    // 6. Collapse All & Expand All accordion controls
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-groups-collapse-all="true"]')!);
    });
    const allCollapsedStates = Array.from(document.querySelectorAll("[data-ecmd-group-card]")).map(
      (el) => el.getAttribute("data-ecmd-group-expanded")
    );
    expect(allCollapsedStates.every((s) => s === "false")).toBe(true);

    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-groups-expand-all="true"]')!);
    });
    const allExpandedStates = Array.from(document.querySelectorAll("[data-ecmd-group-card]")).map(
      (el) => el.getAttribute("data-ecmd-group-expanded")
    );
    expect(allExpandedStates.every((s) => s === "true")).toBe(true);

    // 7. Mirror check on 🖼️ Images tab: natural A-Z default (Logo 2 before Logo 10) + Search + Collapse/Expand
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-studio-tab="images"]')!);
    });
    const imgCardLabels = Array.from(
      document.querySelectorAll("[data-ecmd-image-label-input]")
    ).map((el) => (el as HTMLInputElement).value);
    expect(imgCardLabels).toEqual(["Logo 2", "Logo 10"]);
    expect(document.querySelector('[data-ecmd-images-showing-badge="true"]')?.textContent).toBe(
      "Showing 2 of 2"
    );

    // 8. Mirror check on 🔖 Tokens tab: natural A-Z default (Alpha Shadow before Emerald Luxe Lift) + Search
    act(() => {
      fireEvent.click(document.querySelector('[data-ecmd-studio-tab="tokens"]')!);
    });
    const tokenIds = Array.from(document.querySelectorAll("[data-ecmd-token-card]")).map((el) =>
      el.getAttribute("data-ecmd-token-card")
    );
    expect(tokenIds).toEqual(["tok-box-shadow-alpha-shadow", tok.id]);
    expect(document.querySelector('[data-ecmd-tokens-showing-badge="true"]')?.textContent).toBe(
      "Showing 2 of 2"
    );
  });
});
