"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { analyticsPath } from "@/lib/tracking/paths";
export function PageTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    const path = analyticsPath(pathname);
    if (
      !path ||
      navigator.doNotTrack === "1" ||
      ("globalPrivacyControl" in navigator &&
        navigator.globalPrivacyControl === true)
    )
      return;
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    // A route category is sufficient: never send query strings or project identifiers.
    void fetch("/api/tracking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);
  return null;
}
