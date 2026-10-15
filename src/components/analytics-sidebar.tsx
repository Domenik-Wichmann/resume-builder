"use client";
import { useState, type ReactNode } from "react";

export function AnalyticsSidebar({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <aside
      className={`analytics-sidebar${open ? " is-open" : ""}`}
      aria-label="Analytics filters"
    >
      <button
        className="analytics-sidebar-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="analytics-sidebar-content"
        onClick={() => setOpen(!open)}
      >
        {open ? "Hide filters" : "Show filters"}
      </button>
      <div id="analytics-sidebar-content" className="analytics-sidebar-content">
        {children}
      </div>
    </aside>
  );
}
