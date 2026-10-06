"use client";
import { useEffect, useState } from "react";
import type { ResumeDesign } from "@/lib/resume-design/model";
export function ResumeLengthNotice({ design }: { design: ResumeDesign }) {
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const source = document.querySelector(".resume-design");
      if (!source) return;
      const copy = source.cloneNode(true) as HTMLElement;
      copy.style.position = "fixed";
      copy.style.left = "-10000px";
      copy.style.visibility = "hidden";
      copy.style.width = design.page === "LETTER" ? "216mm" : "210mm";
      document.body.append(copy);
      const sheet = copy.querySelector(".resume-sheet") as HTMLElement | null;
      if (sheet) {
        sheet.style.padding = `${design.margin_mm}mm`;
        const pxPerMm =
          copy.getBoundingClientRect().width /
          (design.page === "LETTER" ? 216 : 210);
        const padding = design.margin_mm * pxPerMm * 2;
        const pageHeight =
          ((design.page === "LETTER" ? 279.4 : 297) - design.margin_mm * 2) *
          pxPerMm;
        setOverflow(
          sheet.getBoundingClientRect().height - padding > pageHeight * 2,
        );
      }
      copy.remove();
    });
    return () => cancelAnimationFrame(frame);
  }, [design]);
  return (
    <p className="resume-overflow-note">
      {overflow
        ? "Layout review: content exceeds the two-page target. Review mutable content and inspect print preview before applying."
        : "Inspect print preview for page breaks. Entries kept together can add a page even when the measured text fits."}
    </p>
  );
}
