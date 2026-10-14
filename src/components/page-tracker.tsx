"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { analyticsPath } from "@/lib/tracking/paths";
import { startPageTracking } from "@/lib/tracking/browser";
export function PageTracker() {
  const pathname = usePathname();
  const view = useRef<{ pathname: string; id: string } | null>(null);
  useEffect(() => {
    const path = analyticsPath(pathname);
    if (!path) {
      view.current = null;
      return;
    }
    // Repeated effect mounts share one view; deliberate navigation creates another.
    if (view.current?.pathname !== pathname)
      view.current = { pathname, id: crypto.randomUUID() };
    return startPageTracking(path, view.current.id);
  }, [pathname]);
  return null;
}
