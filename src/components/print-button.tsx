"use client";
export function PrintButton() {
  return (
    <button className="print-control" onClick={() => window.print()}>
      Print / save as PDF ↗
    </button>
  );
}
