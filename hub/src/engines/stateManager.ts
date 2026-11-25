export interface BookingDraftState {
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
  vehicles: Array<{
    id: string;
    year: string;
    make: string;
    model: string;
    sizeClass: "Compact/Sedan" | "Mid-Size SUV/Truck" | "Full-Size SUV/XL";
    packageId: string;
    addons: string[];
  }>;
  selectedDate: string;
  selectedSlot: string;
  assignedContractorId?: string;
  notes: string;
}

const STORAGE_KEY = "ecmd_carbon_booking_state_v4";

const defaultState: BookingDraftState = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  address: "",
  vehicles: [
    {
      id: "veh-1",
      year: "2024",
      make: "",
      model: "",
      sizeClass: "Mid-Size SUV/Truck",
      packageId: "",
      addons: [],
    },
  ],
  selectedDate: new Date().toISOString().split("T")[0] || "",
  selectedSlot: "09:00 AM",
  notes: "",
};

type Listener = (state: BookingDraftState) => void;
const listeners = new Set<Listener>();

export const stateManager = {
  getState(): BookingDraftState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...defaultState, ...JSON.parse(raw) } : defaultState;
    } catch {
      return defaultState;
    }
  },

  setState(partial: Partial<BookingDraftState>): BookingDraftState {
    const next = { ...this.getState(), ...partial };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    listeners.forEach((fn) => fn(next));
    return next;
  },

  reset(): BookingDraftState {
    localStorage.removeItem(STORAGE_KEY);
    listeners.forEach((fn) => fn(defaultState));
    return defaultState;
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};