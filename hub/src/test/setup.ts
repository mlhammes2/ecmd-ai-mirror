import "@testing-library/jest-dom/vitest";

class StorageMock implements Storage {
  private store: Record<string, string> = {};
  clear(): void {
    this.store = {};
  }
  getItem(key: string): string | null {
    return this.store[key] !== undefined ? this.store[key] : null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  get length(): number {
    return Object.keys(this.store).length;
  }
  key(index: number): string | null {
    return Object.keys(this.store)[index] || null;
  }
}

if (typeof window !== "undefined") {
  const localMock = new StorageMock();
  const sessionMock = new StorageMock();
  Object.defineProperty(window, "localStorage", { value: localMock, writable: true, configurable: true });
  Object.defineProperty(window, "sessionStorage", { value: sessionMock, writable: true, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: localMock, writable: true, configurable: true });
  Object.defineProperty(globalThis, "sessionStorage", { value: sessionMock, writable: true, configurable: true });
}

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
