import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSelector } from "@plasmicapp/loader-react";
import { EcmdVehicleSelector } from "../components/EcmdVehicleSelector";
import {
  EcmdSavedVehicleDropdown,
  DROPDOWN_INTRO_LABEL,
  LOCKED_TYPE_ERROR_TEXT,
  ERROR_DURATION_MS,
  BROWSE_WITHOUT_VEHICLE_LABEL,
  ADD_NEW_VEHICLE_LABEL,
  SELECTED_SUMMARY_VEHICLE_STORAGE_KEY,
  SELECTED_VEHICLE_STORAGE_KEY,
  formatVehicleDropdownLabel,
  syncPackagesVehicles,
  type EcmdSavedVehicleRecord,
} from "../components/EcmdSavedVehicleDropdown";
import { runCanvasDiagnostics } from "../lib/ecmdLiveComponentTelemetry";

const SAMPLE_VEHICLES: EcmdSavedVehicleRecord[] = [
  {
    _id: "veh-1",
    year: 2023,
    make: "Ford",
    model: "F-150",
    color: "White",
    vehicleType: "Truck",
  },
  {
    _id: "veh-2",
    year: 2022,
    make: "Honda",
    model: "Civic",
    color: "Silver",
    vehicleType: "Sedan",
  },
  {
    _id: "veh-3",
    year: 2024,
    make: "Chevrolet",
    model: "Tahoe",
    color: "Black",
    vehicleType: "3rd Row SUV",
  },
];

describe("EcmdVehicleSelector upgrade (DataProvider + vehicle tier locking)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("wraps slot1..slot4 in DataProvider('ecmdVehicle') exposing vehicleKey, subCategory, label, isLocked, and activeVehicle while keeping Zero-Inline-Width Root Law", () => {
    function SlotInspector({ testId }: { testId: string }) {
      const ctx = useSelector("ecmdVehicle");
      return (
        <div data-testid={testId}>
          {ctx?.vehicleKey}|{ctx?.subCategory}|{ctx?.label}|{String(ctx?.isLocked)}|{ctx?.activeVehicle}
        </div>
      );
    }

    const { container } = render(
      <EcmdVehicleSelector
        defaultVehicle="sm-suv"
        slot1={<SlotInspector testId="slot-coupe" />}
        slot2={<SlotInspector testId="slot-truck" />}
        slot3={<SlotInspector testId="slot-smsuv" />}
        slot4={<SlotInspector testId="slot-lgsuv" />}
      />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe("");

    expect(screen.getByTestId("slot-coupe")).toHaveTextContent("coupe|Sedan|Car|false|sm-suv");
    expect(screen.getByTestId("slot-truck")).toHaveTextContent("truck|Truck|Truck|false|sm-suv");
    expect(screen.getByTestId("slot-smsuv")).toHaveTextContent("sm-suv|Sm. SUV|Sm. SUV|false|sm-suv");
    expect(screen.getByTestId("slot-lgsuv")).toHaveTextContent("lg-suv|Lg. SUV|Lg. SUV/Van|false|sm-suv");

    // Clicking coupe updates activeVehicle in DataProvider context
    fireEvent.click(screen.getByTestId("slot-coupe"));
    expect(screen.getByTestId("slot-coupe")).toHaveTextContent("coupe|Sedan|Car|false|coupe");
    expect(screen.getByTestId("slot-truck")).toHaveTextContent("truck|Truck|Truck|false|coupe");
  });

  it("locks via lockedSubCategory / lockedVehicleKey props, blocks switching tiers, and fires onLockedAttempt + ecmd-vehicle-locked-attempt", () => {
    const onLockedAttempt = vi.fn();
    const onVehicleChange = vi.fn();
    const lockedEvents: any[] = [];
    const changeEvents: any[] = [];

    const onLockEvt = (e: Event) => lockedEvents.push((e as CustomEvent).detail);
    const onChangeEvt = (e: Event) => changeEvents.push((e as CustomEvent).detail);
    window.addEventListener("ecmd-vehicle-locked-attempt", onLockEvt);
    window.addEventListener("ecmd-vehicle-change", onChangeEvt);

    try {
      const { container } = render(
        <EcmdVehicleSelector
          lockedSubCategory="Truck"
          onLockedAttempt={onLockedAttempt}
          onVehicleChange={onVehicleChange}
        />
      );

      const root = container.firstElementChild as HTMLElement;
      expect(root.getAttribute("data-ecmd-locked")).toBe("true");
      expect(root.getAttribute("data-ecmd-locked-vehicle")).toBe("truck");

      // Clear any initial mount change events
      changeEvents.length = 0;
      onVehicleChange.mockClear();

      // Clicking a different tier ("lg-suv") must be blocked
      const lgSuvSlot = container.querySelector('[data-ecmd-vehicle-slot="lg-suv"]') as HTMLElement;
      const truckSlot = container.querySelector('[data-ecmd-vehicle-slot="truck"]') as HTMLElement;
      expect(truckSlot.getAttribute("data-ecmd-selected")).toBe("true");

      fireEvent.click(lgSuvSlot);

      expect(onLockedAttempt).toHaveBeenCalledTimes(1);
      expect(onLockedAttempt.mock.calls[0]?.[0]).toMatchObject({
        attemptedVehicleKey: "lg-suv",
        lockedVehicleKey: "truck",
        lockedSubCategory: "Truck",
      });
      expect(lockedEvents).toHaveLength(1);
      expect(lockedEvents[0]).toMatchObject({
        attemptedVehicleKey: "lg-suv",
        lockedVehicleKey: "truck",
        lockedSubCategory: "Truck",
      });
      expect(changeEvents).toHaveLength(0);
      expect(onVehicleChange).not.toHaveBeenCalled();

      // Active vehicle remains pinned on "truck"
      expect(truckSlot.getAttribute("data-ecmd-selected")).toBe("true");
      expect(lgSuvSlot.getAttribute("data-ecmd-selected")).toBe("false");

      // Clicking the already-locked tier ("truck") does NOT fire a locked-attempt error
      fireEvent.click(truckSlot);
      expect(onLockedAttempt).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("ecmd-vehicle-locked-attempt", onLockEvt);
      window.removeEventListener("ecmd-vehicle-change", onChangeEvt);
    }
  });

  it("responds to window ecmd-vehicle-lock and ecmd-vehicle-unlock events dynamically", () => {
    const onLockedAttempt = vi.fn();
    const { container } = render(
      <EcmdVehicleSelector defaultVehicle="sm-suv" onLockedAttempt={onLockedAttempt} />
    );

    const coupeSlot = container.querySelector('[data-ecmd-vehicle-slot="coupe"]') as HTMLElement;
    const lgSuvSlot = container.querySelector('[data-ecmd-vehicle-slot="lg-suv"]') as HTMLElement;

    act(() => {
      window.dispatchEvent(
        new CustomEvent("ecmd-vehicle-lock", {
          detail: {
            vehicleKey: "coupe",
            subCategory: "Sedan",
            label: "2022 Honda Civic Silver (Sedan)",
            message: LOCKED_TYPE_ERROR_TEXT,
          },
        })
      );
    });

    expect(coupeSlot.getAttribute("data-ecmd-selected")).toBe("true");
    fireEvent.click(lgSuvSlot);
    expect(onLockedAttempt).toHaveBeenCalledTimes(1);
    expect(coupeSlot.getAttribute("data-ecmd-selected")).toBe("true");

    // Unlock allows selecting lg-suv again
    act(() => {
      window.dispatchEvent(new CustomEvent("ecmd-vehicle-unlock"));
    });

    fireEvent.click(lgSuvSlot);
    expect(lgSuvSlot.getAttribute("data-ecmd-selected")).toBe("true");
    expect(localStorage.getItem("ecmd_selected_vehicle")).toBe("lg-suv");
  });
});

describe("EcmdSavedVehicleDropdown (Wix packagesEngine.js parity)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("formats vehicle labels matching Wix formatVehicleDropdownLabel", () => {
    expect(formatVehicleDropdownLabel(null)).toBe(DROPDOWN_INTRO_LABEL);
    expect(formatVehicleDropdownLabel(SAMPLE_VEHICLES[0])).toBe("2023 Ford F-150 White (Truck)");
    expect(formatVehicleDropdownLabel(SAMPLE_VEHICLES[1])).toBe("2022 Honda Civic Silver (Sedan)");
    expect(formatVehicleDropdownLabel(SAMPLE_VEHICLES[2])).toBe("2024 Chevrolet Tahoe Black (Lg. SUV)");
  });

  it("renders Wix-parity DOM IDs/hooks, enforces Zero-Inline-Width Root Law, and reports 0 MISSING_SIBLING_HOOK diagnostics", () => {
    const { container } = render(
      <EcmdSavedVehicleDropdown vehicles={SAMPLE_VEHICLES} defaultOpen={true} />
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("ecmd-saved-vehicle-dropdown-root");
    expect(root.style.width).toBe("");

    const dropBtn = container.querySelector("#vehicleSelectDropButton") as HTMLButtonElement;
    const selectBox = container.querySelector("#vehicleSelectBox") as HTMLElement;
    const selectRep = container.querySelector("#vehicleSelectRep") as HTMLElement;
    const typeError = container.querySelector("#vehicleTypeError") as HTMLElement;

    expect(dropBtn).not.toBeNull();
    expect(dropBtn.getAttribute("data-ecmd-vehicle-el")).toBe("drop-button");
    expect(dropBtn).toHaveTextContent(DROPDOWN_INTRO_LABEL);

    expect(selectBox).not.toBeNull();
    expect(selectBox.getAttribute("data-ecmd-vehicle-el")).toBe("select-box");
    expect(selectBox.hidden).toBe(false);

    expect(selectRep).not.toBeNull();
    expect(selectRep.getAttribute("data-ecmd-vehicle-el")).toBe("select-rep");

    expect(typeError).not.toBeNull();
    expect(typeError.getAttribute("data-ecmd-vehicle-el")).toBe("type-error");
    expect(typeError.hidden).toBe(true);

    // Options include Browse Without, all saved vehicles, and + Add New Vehicle
    const options = Array.from(selectRep.querySelectorAll("button"));
    expect(options.map((b) => b.textContent)).toEqual([
      BROWSE_WITHOUT_VEHICLE_LABEL,
      "2023 Ford F-150 White (Truck)",
      "2022 Honda Civic Silver (Sedan)",
      "2024 Chevrolet Tahoe Black (Lg. SUV)",
      ADD_NEW_VEHICLE_LABEL,
    ]);

    // Verify zero MISSING_SIBLING_HOOK critical diagnostics
    const diags = runCanvasDiagnostics(root, {
      componentName: "EcmdSavedVehicleDropdown",
      artboardTag: "desktop-1440",
      viewportMode: "desktop",
      viewportWidthPx: 1440,
    });
    expect(diags.filter((d) => d.code === "MISSING_SIBLING_HOOK")).toHaveLength(0);

    // Verify prefers-reduced-motion pulse protection is injected in root sizing styles
    const sizingStyle = document.getElementById("ecmd-root-sizing-defaults");
    expect(sizingStyle?.textContent).toContain("@media (prefers-reduced-motion: reduce)");
    expect(sizingStyle?.textContent).toContain(".ecmd-vehicle-drop-pulse");
  });

  it("integrates end-to-end with EcmdVehicleSelector: locks on selection, pulses + shows 3200ms error on locked click, and unlocks on Browse Without a Vehicle", () => {
    vi.useFakeTimers();

    const changeEvents: any[] = [];
    const lockEvents: any[] = [];
    const unlockEvents: any[] = [];

    const onChange = (e: Event) => changeEvents.push((e as CustomEvent).detail);
    const onLock = (e: Event) => lockEvents.push((e as CustomEvent).detail);
    const onUnlock = (e: Event) => unlockEvents.push((e as CustomEvent).detail);

    window.addEventListener("ecmd-vehicle-change", onChange);
    window.addEventListener("ecmd-vehicle-lock", onLock);
    window.addEventListener("ecmd-vehicle-unlock", onUnlock);

    try {
      const { container } = render(
        <div>
          <EcmdSavedVehicleDropdown vehicles={SAMPLE_VEHICLES} />
          <EcmdVehicleSelector defaultVehicle="sm-suv" />
        </div>
      );

      const dropBtn = container.querySelector("#vehicleSelectDropButton") as HTMLButtonElement;
      const selectBox = container.querySelector("#vehicleSelectBox") as HTMLElement;
      const typeError = container.querySelector("#vehicleTypeError") as HTMLElement;
      const truckSlot = container.querySelector('[data-ecmd-vehicle-slot="truck"]') as HTMLElement;
      const lgSuvSlot = container.querySelector('[data-ecmd-vehicle-slot="lg-suv"]') as HTMLElement;

      // 1. Open dropdown and select the Truck
      expect(selectBox.hidden).toBe(true);
      fireEvent.click(dropBtn);
      expect(selectBox.hidden).toBe(false);

      fireEvent.click(screen.getByText("2023 Ford F-150 White (Truck)"));

      // Trigger updates, dropdown closes, sessionStorage & localStorage updated, events dispatched
      expect(dropBtn).toHaveTextContent("2023 Ford F-150 White (Truck)");
      expect(selectBox.hidden).toBe(true);
      expect(sessionStorage.getItem(SELECTED_SUMMARY_VEHICLE_STORAGE_KEY)).toBe("veh-1");
      expect(localStorage.getItem(SELECTED_VEHICLE_STORAGE_KEY)).toBe("truck");
      expect(lockEvents.length).toBeGreaterThanOrEqual(1);
      expect(lockEvents[lockEvents.length - 1]).toMatchObject({
        vehicleKey: "truck",
        subCategory: "Truck",
      });
      expect(changeEvents[changeEvents.length - 1]).toMatchObject({
        vehicleKey: "truck",
        subCategory: "Truck",
      });
      expect(truckSlot.getAttribute("data-ecmd-selected")).toBe("true");

      // 2. Attempt to click Lg. SUV while Truck is locked -> error shows & dropBtn pulses for 3200ms
      fireEvent.click(lgSuvSlot);

      expect(truckSlot.getAttribute("data-ecmd-selected")).toBe("true");
      expect(lgSuvSlot.getAttribute("data-ecmd-selected")).toBe("false");
      expect(typeError.hidden).toBe(false);
      expect(typeError).toHaveTextContent(LOCKED_TYPE_ERROR_TEXT);
      expect(dropBtn.classList.contains("ecmd-vehicle-drop-pulse")).toBe(true);
      expect(dropBtn.getAttribute("data-ecmd-pulsing")).toBe("true");

      // Just before 3200ms, still visible & pulsing
      act(() => {
        vi.advanceTimersByTime(ERROR_DURATION_MS - 100);
      });
      expect(typeError.hidden).toBe(false);
      expect(dropBtn.getAttribute("data-ecmd-pulsing")).toBe("true");

      // After 3200ms, auto-hides & stops pulsing
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(typeError.hidden).toBe(true);
      expect(dropBtn.classList.contains("ecmd-vehicle-drop-pulse")).toBe(false);
      expect(dropBtn.getAttribute("data-ecmd-pulsing")).toBe("false");

      // 3. Open dropdown and select "Browse Without a Vehicle"
      fireEvent.click(dropBtn);
      fireEvent.click(screen.getByText(BROWSE_WITHOUT_VEHICLE_LABEL));

      expect(dropBtn).toHaveTextContent(DROPDOWN_INTRO_LABEL);
      expect(sessionStorage.getItem(SELECTED_SUMMARY_VEHICLE_STORAGE_KEY)).toBe("NONE");
      expect(unlockEvents.length).toBeGreaterThanOrEqual(1);

      // Now clicking Lg. SUV succeeds!
      fireEvent.click(lgSuvSlot);
      expect(lgSuvSlot.getAttribute("data-ecmd-selected")).toBe("true");
      expect(localStorage.getItem(SELECTED_VEHICLE_STORAGE_KEY)).toBe("lg-suv");
    } finally {
      window.removeEventListener("ecmd-vehicle-change", onChange);
      window.removeEventListener("ecmd-vehicle-lock", onLock);
      window.removeEventListener("ecmd-vehicle-unlock", onUnlock);
    }
  });

  it("handles '+ Add New Vehicle' by closing dropdown, calling onAddNewVehicle, and dispatching ecmd-open-add-vehicle-modal", () => {
    const onAddNewVehicle = vi.fn();
    const modalEvents: any[] = [];
    const onModalEvt = (e: Event) => modalEvents.push((e as CustomEvent).detail);
    window.addEventListener("ecmd-open-add-vehicle-modal", onModalEvt);

    try {
      const { container } = render(
        <EcmdSavedVehicleDropdown
          vehicles={SAMPLE_VEHICLES}
          onAddNewVehicle={onAddNewVehicle}
        />
      );

      const dropBtn = container.querySelector("#vehicleSelectDropButton") as HTMLButtonElement;
      const selectBox = container.querySelector("#vehicleSelectBox") as HTMLElement;

      fireEvent.click(dropBtn);
      expect(selectBox.hidden).toBe(false);

      fireEvent.click(screen.getByText(ADD_NEW_VEHICLE_LABEL));

      expect(selectBox.hidden).toBe(true);
      expect(onAddNewVehicle).toHaveBeenCalledTimes(1);
      expect(modalEvents).toHaveLength(1);
    } finally {
      window.removeEventListener("ecmd-open-add-vehicle-modal", onModalEvt);
    }
  });

  it("supports syncPackagesVehicles(list, autoSelectNewest = true) for live vehicle sync", () => {
    const { container } = render(<EcmdSavedVehicleDropdown vehicles={[]} />);
    const dropBtn = container.querySelector("#vehicleSelectDropButton") as HTMLButtonElement;
    expect(dropBtn).toHaveTextContent(DROPDOWN_INTRO_LABEL);

    act(() => {
      syncPackagesVehicles(SAMPLE_VEHICLES, true);
    });

    // Auto-selects the newest (last) vehicle in the list: 2024 Chevrolet Tahoe Black (Lg. SUV)
    expect(dropBtn).toHaveTextContent("2024 Chevrolet Tahoe Black (Lg. SUV)");
    expect(sessionStorage.getItem(SELECTED_SUMMARY_VEHICLE_STORAGE_KEY)).toBe("veh-3");
    expect(localStorage.getItem(SELECTED_VEHICLE_STORAGE_KEY)).toBe("lg-suv");
  });
});
