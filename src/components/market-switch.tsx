"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Market } from "@/lib/markets";
export function MarketSwitch({ market }: { market: Market }) {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <div className="market-switch">
      <label htmlFor="market">Profile presentation</label>
      <select
        id="market"
        value={market}
        onChange={async (event) => {
          try {
            const response = await fetch("/api/market", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ market: event.target.value }),
            });
            if (!response.ok) throw new Error("Cannot change presentation.");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Please try again.");
          }
        }}
      >
        <option value="US">US</option>
        <option value="BG">Bulgaria / Europe</option>
      </select>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
