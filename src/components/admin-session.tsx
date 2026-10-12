"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { adminSignInPath } from "@/lib/auth-navigation";
export function AdminSession() {
  const [expired, setExpired] = useState(false);
  const path = usePathname();
  const query = useSearchParams();
  useEffect(() => {
    let disposed = false,
      checking = false;
    const check = async () => {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const response = await fetch("/api/auth/session", { method: "POST" });
        if (!disposed)
          setExpired(response.status === 401 || response.status === 403);
      } catch {
        /* Keep open forms intact during a network interruption. */
      } finally {
        checking = false;
      }
    };
    const interval = setInterval(check, 4 * 60 * 1000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      disposed = true;
      clearInterval(interval);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  if (!expired) return null;
  return (
    <aside className="wrap admin-session-notice" role="status">
      Your session ended. This page stays open so you can copy any unsaved
      edits.{" "}
      <Link
        href={adminSignInPath(
          path + (query.size ? "?" + query.toString() : ""),
        )}
        target="_blank"
        rel="noopener"
      >
        Sign in in a new tab
      </Link>
      , then return here to save.
    </aside>
  );
}
