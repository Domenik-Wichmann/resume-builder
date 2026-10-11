import { afterEach, expect, it, vi } from "vitest";
import {
  rememberWorkspace,
  selectedWorkspace,
} from "../src/lib/workspaces/selection";
afterEach(() => vi.unstubAllGlobals());
it("remembers the last selected chat across sessions and clears both hints", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key),
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  rememberWorkspace("server-must-still-verify-this-id");
  expect(selectedWorkspace()).toBe("server-must-still-verify-this-id");
  rememberWorkspace(null);
  expect(selectedWorkspace()).toBeNull();
});
it("never interrupts loading or sending when browser storage is unavailable", () => {
  const blocked = () => {
    throw new Error("Storage blocked");
  };
  for (const name of ["localStorage", "sessionStorage"])
    vi.stubGlobal(name, {
      getItem: blocked,
      setItem: blocked,
      removeItem: blocked,
    });
  expect(() => rememberWorkspace("hint")).not.toThrow();
  expect(() => rememberWorkspace(null)).not.toThrow();
  expect(selectedWorkspace()).toBeNull();
});
