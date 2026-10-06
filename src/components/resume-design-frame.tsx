import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import {
  defaultDesign,
  designSchema,
  type ResumeDesign,
} from "@/lib/resume-design/model";
export function designStyle(input: ResumeDesign): CSSProperties {
  const spec = designSchema.parse(input);
  return {
    "--resume-font":
      spec.font === "SERIF"
        ? "Georgia, 'Times New Roman', serif"
        : spec.font === "MONO"
          ? "'Courier New', monospace"
          : "Arial, Helvetica, sans-serif",
    "--resume-accent": spec.accent,
    "--resume-text": spec.text,
    "--resume-background": spec.background || "#FFFFFF",
    "--resume-font-size": `${spec.font_pt}pt`,
    "--resume-margin": `${spec.margin_mm}mm`,
    "--resume-gap":
      spec.spacing === "COMPACT"
        ? "9pt"
        : spec.spacing === "AIRY"
          ? "28px"
          : "20px",
    "--resume-leading":
      spec.spacing === "COMPACT"
        ? "1.22"
        : spec.spacing === "AIRY"
          ? "1.65"
          : "1.5",
    "--resume-width": spec.page === "LETTER" ? "216mm" : "210mm",
  } as CSSProperties;
}
export function ResumeDesignFrame({
  spec = defaultDesign,
  children,
}: {
  spec?: ResumeDesign;
  children: ReactNode;
}) {
  return (
    <div
      className={`resume-design design-${spec.layout.toLowerCase()} headings-${spec.headings.toLowerCase()} header-${spec.header.toLowerCase()}`}
      style={designStyle(spec)}
    >
      <style>{`@media print { body:has(.resume-design) { background: ${spec.background || "#FFFFFF"}; } @page { size: ${spec.page === "LETTER" ? "Letter" : "A4"}; margin: ${spec.margin_mm}mm; background: ${spec.background || "#FFFFFF"}; @bottom-center { content: counter(page); color: ${spec.text}; font: 9pt Arial; } } }`}</style>
      {children}
    </div>
  );
}
export function ResumePortrait({
  spec,
  src,
  name,
  preview = false,
}: {
  spec: ResumeDesign;
  src?: string;
  name: string;
  preview?: boolean;
}) {
  if (spec.photo === "NONE") return null;
  if (!src)
    return preview ? (
      <span
        className={`resume-portrait portrait-sample ${spec.photo.toLowerCase()}`}
      >
        Photo sample
      </span>
    ) : null;
  return (
    <Image
      className={`resume-portrait ${spec.photo.toLowerCase()}`}
      src={src}
      width={88}
      height={88}
      unoptimized
      alt={`Portrait of ${name}`}
    />
  );
}
