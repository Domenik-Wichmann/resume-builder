"use client";
export function PrintButton({ filename }: { filename?: string }) {
  return (
    <button
      className="print-control"
      onClick={() => {
        const previous = document.title;
        if (filename) document.title = filename;
        window.addEventListener(
          "afterprint",
          () => {
            document.title = previous;
          },
          { once: true },
        );
        window.print();
      }}
    >
      Print / save as PDF ↗
    </button>
  );
}
