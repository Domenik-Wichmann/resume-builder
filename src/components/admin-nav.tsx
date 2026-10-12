"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { adminGroups, activeAdminLink } from "@/lib/admin-navigation";
import { OwnerLogout } from "./admin-controls";
export function AdminNav() {
  const path = usePathname();
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!nav.current?.contains(event.target as Node))
        nav.current
          ?.querySelectorAll("details[open]")
          .forEach((menu) => menu.removeAttribute("open"));
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const links = (group: (typeof adminGroups)[number]) =>
    group.links.map(({ href, label, description }) => (
      <Link
        key={href}
        href={href}
        aria-current={activeAdminLink(path, href) ? "page" : undefined}
        onClick={() =>
          nav.current
            ?.querySelectorAll("details[open]")
            .forEach((menu) => menu.removeAttribute("open"))
        }
      >
        <strong>{label}</strong>
        <small>{description}</small>
      </Link>
    ));
  return (
    <nav
      ref={nav}
      className="owner-nav"
      aria-label="Admin navigation"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          const menu =
            event.target instanceof Element
              ? event.target.closest("details")
              : null;
          menu?.removeAttribute("open");
          menu?.querySelector("summary")?.focus();
        }
      }}
    >
      <Link className="owner-brand" href="/admin">
        <span className="owner-brand-mark">D</span>
        <span>
          Career workspace<small>Private admin</small>
        </span>
      </Link>
      <div className="owner-nav-links owner-desktop-navigation">
        <Link
          href="/admin"
          aria-current={path === "/admin" ? "page" : undefined}
        >
          Overview
        </Link>
        {adminGroups.map((group) => (
          <details
            className="owner-menu"
            key={group.label}
            onToggle={(event) => {
              if (event.currentTarget.open)
                nav.current
                  ?.querySelectorAll("details[open]")
                  .forEach((menu) => {
                    if (menu !== event.currentTarget)
                      menu.removeAttribute("open");
                  });
            }}
          >
            <summary
              className={
                group.links.some(({ href }) => activeAdminLink(path, href))
                  ? "active"
                  : undefined
              }
            >
              {group.label}
              <span aria-hidden="true">⌄</span>
            </summary>
            <div className="owner-menu-panel">{links(group)}</div>
          </details>
        ))}
      </div>
      <div className="owner-nav-actions">
        <Link href="/">View portfolio ↗</Link>
        <OwnerLogout />
      </div>
      <details className="owner-menu owner-mobile-navigation">
        <summary>
          Menu<span aria-hidden="true">⌄</span>
        </summary>
        <div className="owner-menu-panel">
          <Link
            href="/admin"
            aria-current={path === "/admin" ? "page" : undefined}
            onClick={(event) =>
              event.currentTarget.closest("details")?.removeAttribute("open")
            }
          >
            <strong>Overview</strong>
          </Link>
          {adminGroups.map((group) => (
            <div className="owner-mobile-group" key={group.label}>
              <span className="owner-menu-label">{group.label}</span>
              {links(group)}
            </div>
          ))}
        </div>
      </details>
    </nav>
  );
}
