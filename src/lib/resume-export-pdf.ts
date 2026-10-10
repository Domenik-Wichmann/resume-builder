import type { ResumeIR } from "./resume-ir";
import { defaultDesign } from "./resume-design/model";
import { exportContact, exportSections, exportTimeline } from "./resume-export";

const base64 = (bytes: ArrayBuffer) => {
  let binary = "";
  const data = new Uint8Array(bytes);
  for (let offset = 0; offset < data.length; offset += 8192)
    binary += String.fromCharCode(...data.subarray(offset, offset + 8192));
  return btoa(binary);
};
async function font(path: string) {
  const response = await fetch(path);
  if (!response.ok) throw new Error("PDF font could not be loaded. Try again.");
  return base64(await response.arrayBuffer());
}

/** A text PDF: canonical visible content only, no screenshot or private IR. */
export async function resumePdf(ir: ResumeIR) {
  const [{ jsPDF }, regular, bold] = await Promise.all([
    import("jspdf"),
    font("/fonts/NotoSans-Regular.ttf"),
    font("/fonts/NotoSans-Bold.ttf"),
  ]);
  const design = ir.design || defaultDesign;
  const pdf = new jsPDF({
    unit: "mm",
    format: design.page === "LETTER" ? "letter" : "a4",
    compress: true,
  });
  pdf.addFileToVFS("NotoSans-Regular.ttf", regular);
  pdf.addFileToVFS("NotoSans-Bold.ttf", bold);
  pdf.addFont("NotoSans-Regular.ttf", "Resume", "normal");
  pdf.addFont("NotoSans-Bold.ttf", "Resume", "bold");
  pdf.setProperties({
    title: `${ir.profile.name} résumé`,
    author: ir.profile.name,
  });
  const margin = design.margin_mm;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  const bottom = pdf.internal.pageSize.getHeight() - margin;
  let y = margin;
  const leading =
    design.spacing === "COMPACT" ? 1.22 : design.spacing === "AIRY" ? 1.6 : 1.4;
  function space(height: number) {
    if (y + height > bottom) {
      pdf.addPage();
      y = margin;
    }
  }
  function text(
    value: string,
    size = design.font_pt,
    bold = false,
    accent = false,
    indent = 0,
  ) {
    if (!value) return;
    pdf.setFont("Resume", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(accent ? design.accent : design.text);
    const lines = pdf.splitTextToSize(value, width - indent) as string[];
    const lineHeight = size * 0.352778 * leading;
    for (const line of lines) {
      space(lineHeight);
      pdf.text(line, margin + indent, y + size * 0.352778);
      y += lineHeight;
    }
    y += 1;
  }
  function heading(value: string) {
    space(18);
    y += 3;
    text(value.toUpperCase(), design.font_pt, true, true);
    pdf.setDrawColor(design.accent);
    pdf.line(margin, y, margin + width, y);
    y += 2;
  }
  function url(label: string, target: string) {
    const startPage = pdf.getNumberOfPages();
    text(`${label}: ${target.replace(/^https:\/\//, "")}`, 9, false, true);
    if (startPage === pdf.getNumberOfPages())
      pdf.link(margin, y - 5, width, 5, { url: target });
  }
  if (ir.demo) text("Fictional demonstration résumé", 9);
  text(ir.profile.name, 24, true);
  text(ir.headline, design.font_pt, true, true);
  text(exportContact(ir), 9);
  text(ir.profile.contact.work_authorization, 9);
  if (ir.portfolio_url) url("Portfolio & AI demo", ir.portfolio_url);
  if (ir.github_url) url("GitHub", ir.github_url);
  text(ir.invitation || "", 8.5, false, true);
  if (ir.summary) {
    heading("Professional summary");
    text(ir.summary);
  }
  if (ir.skill_groups.length) {
    heading("Technical skills");
    for (const group of ir.skill_groups)
      text(`${group.label}: ${group.skills.join(" · ")}`);
  }
  for (const section of exportSections(ir)) {
    heading(section.title);
    for (const record of section.records) {
      space(24);
      text(record.title, design.font_pt, true);
      text(
        [record.organization, record.context].filter(Boolean).join(" | "),
        9,
      );
      text(exportTimeline(record), 9);
      for (const bullet of record.bullets)
        text(`• ${bullet}`, design.font_pt, false, false, 2);
      for (const item of record.links || []) url(item.label, item.url);
      y += 2;
    }
  }
  if (ir.closing && ir.portfolio_url) url(ir.closing, ir.portfolio_url);
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.setTextColor(design.text);
    pdf.text(
      `${page} / ${pages}`,
      pdf.internal.pageSize.getWidth() / 2,
      bottom + 7,
      { align: "center" },
    );
  }
  return pdf.output("blob");
}
