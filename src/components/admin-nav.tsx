"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
export function AdminNav() {
  const path = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node))
        menu.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const link = (href: string, label: string) => (
    <Link
      key={href}
      href={href}
      aria-current={path === href ? "page" : undefined}
      onClick={(event) =>
        event.currentTarget.closest("details")?.removeAttribute("open")
      }
    >
      {label}
    </Link>
  );
  return (
    <nav className="owner-nav" aria-label="Admin navigation">
      <Link className="owner-brand" href="/admin">
        <span className="owner-brand-mark">C</span>
        <span>
          Career workspace<small>Private owner area</small>
        </span>
      </Link>
      <div className="owner-nav-links">
        {link("/admin", "Overview")}
        {link("/admin/analytics", "Analytics")}
        {link("/admin/explore", "Explorer")}
        <details
          ref={menu}
          className="owner-menu"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary>
            Manage <span aria-hidden="true">⌄</span>
          </summary>
          <div className="owner-menu-panel">
            <span className="owner-menu-label">Career & content</span>
            {link("/admin/presentation", "Personal information & photos")}
            {link("/admin/templates", "Resume design & templates")}
            {link("/admin/career", "Import & interview")}
            {link("/admin/projects", "Project showcase")}
            {link("/admin/answers", "Quick Answers")}
            <span className="owner-menu-label">Workflow</span>
            {link("/admin/applications", "Applications & experiments")}
            {link("/admin/usage", "Usage & credits")}
            <span className="owner-menu-label">Overview sections</span>
            {link("/admin#applications", "Tracking links")}
            {link("/admin#workspaces", "Workspaces")}
            {link("/admin/analytics#questions", "Questions & signals")}
            <span className="owner-menu-label">Public site</span>
            {link("/", "View portfolio ↗")}
          </div>
        </details>
      </div>
    </nav>
  );
}
