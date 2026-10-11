"use client";

const key = "rb_selected_workspace";

export function selectedWorkspace(): string | null {
  // Storage is only a selection hint. The server-owned listing authorizes access.
  for (const store of ["sessionStorage", "localStorage"] as const) {
    try {
      const value = globalThis[store].getItem(key);
      if (value) return value;
    } catch {
      // Browser privacy settings must not prevent loading saved conversations.
    }
  }
  return null;
}

export function rememberWorkspace(id: string | null) {
  for (const store of ["sessionStorage", "localStorage"] as const) {
    try {
      if (id) globalThis[store].setItem(key, id);
      else globalThis[store].removeItem(key);
    } catch {
      // Optional preferences never interrupt a persisted workspace action.
    }
  }
}
