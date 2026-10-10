import type { ResumeIR } from "./resume-ir";
import { defaultDesign } from "./resume-design/model";
import {
  exportContact,
  exportSections,
  exportTimeline,
  exportWorkAuthorization,
} from "./resume-export";

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
  function textHeight(
    value: string,
    size = design.font_pt,
    bold = false,
    indent = 0,
  ) {
    if (!value) return 0;
    pdf.setFont("Resume", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(value, width - indent) as string[];
    return lines.length * size * 0.352778 * leading + 1;
  }
  function recordHeight(record: ResumeIR["experiences"][number]) {
    return (
      textHeight(record.title, design.font_pt, true) +
      textHeight(
        [record.organization, record.context].filter(Boolean).join(" | "),
        9,
      ) +
      textHeight(exportTimeline(record), 9) +
      record.bullets.reduce(
        (total, bullet) =>
          total + textHeight(`• ${bullet}`, design.font_pt, false, 2),
        0,
      ) +
      (record.links || []).reduce(
        (total, item) =>
          total +
          textHeight(
            `${item.label}: ${item.url.replace(/^https:\/\//, "")}`,
            9,
          ),
        0,
      ) +
      2
    );
  }
  function text(
    value: string,
    size = design.font_pt,
    bold = false,
    accent = false,
    indent = 0,
    color?: string,
  ) {
    if (!value) return;
    pdf.setFont("Resume", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(color || (accent ? design.accent : design.text));
    const lines = pdf.splitTextToSize(value, width - indent) as string[];
    const lineHeight = size * 0.352778 * leading;
    if (lines.length * lineHeight + 1 <= bottom - margin)
      space(lines.length * lineHeight + 1);
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
  function contactRow() {
    const size = 9;
    const lineHeight = size * 0.352778 * leading;
    pdf.setFont("Resume", "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(design.text);
    const authorization = exportWorkAuthorization(ir);
    const rightWidth = authorization
      ? Math.min(width * 0.32, pdf.getTextWidth(authorization) + 1)
      : 0;
    const left = pdf.splitTextToSize(
      exportContact(ir),
      width - (rightWidth ? rightWidth + 5 : 0),
    ) as string[];
    const right = authorization
      ? (pdf.splitTextToSize(authorization, rightWidth) as string[])
      : [];
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      space(lineHeight);
      const baseline = y + size * 0.352778;
      if (left[i]) pdf.text(left[i], margin, baseline);
      if (right[i])
        pdf.text(right[i], margin + width, baseline, { align: "right" });
      y += lineHeight;
    }
    y += 1;
  }
  function headerLinks() {
    const size = 9;
    const lineHeight = size * 0.352778 * leading;
    let x = margin;
    for (const [label, target] of [
      ["Portfolio & AI demo", ir.portfolio_url],
      ["GitHub", ir.github_url],
    ] as const) {
      if (!target) continue;
      const display = target.replace(/^https:\/\//, "").replace(/\/$/, "");
      pdf.setFontSize(size);
      pdf.setFont("Resume", "bold");
      const labelWidth = pdf.getTextWidth(`${label}: `);
      pdf.setFont("Resume", "normal");
      const linkWidth = pdf.getTextWidth(display);
      if (x > margin && x + labelWidth + linkWidth > margin + width) {
        y += lineHeight;
        x = margin;
      }
      space(lineHeight);
      pdf.setFont("Resume", "bold");
      pdf.setTextColor(design.text);
      pdf.text(`${label}: `, x, y + size * 0.352778);
      x += labelWidth;
      pdf.setFont("Resume", "normal");
      pdf.setTextColor(design.accent);
      const lines = pdf.splitTextToSize(
        display,
        width - (x - margin),
      ) as string[];
      for (const [index, line] of lines.entries()) {
        if (index) {
          y += lineHeight;
          x = margin;
          space(lineHeight);
        }
        pdf.text(line, x, y + size * 0.352778);
        const length = pdf.getTextWidth(line);
        pdf.link(x, y, length, lineHeight, { url: target });
        x += length;
      }
      x += 5;
    }
    if (x > margin) y += lineHeight + 1;
  }
  function prepareSkills(
    group: ResumeIR["skill_groups"][number],
    columnWidth: number,
  ) {
    const size = design.font_pt * 0.93;
    const lineHeight = size * 0.352778 * leading;
    pdf.setFont("Resume", "bold");
    pdf.setFontSize(design.font_pt);
    const label = pdf.splitTextToSize(group.label, columnWidth) as string[];
    pdf.setFont("Resume", "normal");
    pdf.setFontSize(size);
    const items = group.skills.map(
      (skill) => pdf.splitTextToSize(skill, columnWidth - 3) as string[],
    );
    const labelHeight = design.font_pt * 0.352778 * leading;
    return {
      label,
      items,
      size,
      lineHeight,
      labelHeight,
      height:
        label.length * labelHeight +
        items.reduce((n, lines) => n + lines.length * lineHeight + 0.6, 0) +
        3,
    };
  }
  function drawSkills(group: ReturnType<typeof prepareSkills>, x: number) {
    let baseline = y;
    pdf.setTextColor(design.text);
    pdf.setFont("Resume", "bold");
    pdf.setFontSize(design.font_pt);
    for (const line of group.label) {
      pdf.text(line, x, baseline + design.font_pt * 0.352778);
      baseline += group.labelHeight;
    }
    pdf.setFont("Resume", "normal");
    pdf.setFontSize(group.size);
    for (const lines of group.items) {
      pdf.text("•", x, baseline + group.size * 0.352778);
      for (const line of lines) {
        pdf.text(line, x + 3, baseline + group.size * 0.352778);
        baseline += group.lineHeight;
      }
      baseline += 0.6;
    }
  }
  if (ir.demo) text("Fictional demonstration résumé", 9);
  text(ir.profile.name, 24, true);
  text(ir.headline, design.font_pt, true, true);
  contactRow();
  headerLinks();
  text(ir.invitation || "", 8.5, true, false, 0, "#000000");
  if (ir.summary) {
    heading("Professional summary");
    text(ir.summary);
  }
  if (ir.skill_groups.length) {
    heading("Technical skills");
    const pair = ir.skill_groups.length > 1 ? ir.skill_groups.slice(0, 2) : [];
    const columns = pair.map((group) => prepareSkills(group, (width - 6) / 2));
    const useColumns = columns.every(
      (group) => group.height <= bottom - margin,
    );
    if (columns.length && useColumns) {
      const height = Math.max(...columns.map((group) => group.height));
      space(height);
      columns.forEach((group, index) =>
        drawSkills(group, margin + index * ((width + 6) / 2)),
      );
      y += height;
    }
    for (const group of ir.skill_groups.slice(useColumns ? pair.length : 0)) {
      const prepared = prepareSkills(group, width);
      if (prepared.height > bottom - margin) {
        text(group.label, design.font_pt, true);
        for (const skill of group.skills)
          text(`• ${skill}`, design.font_pt * 0.93);
      } else {
        space(prepared.height);
        drawSkills(prepared, margin);
        y += prepared.height;
      }
    }
  }
  for (const section of exportSections(ir)) {
    const firstHeight = section.records[0] && recordHeight(section.records[0]);
    if (firstHeight && firstHeight + 18 <= bottom - margin)
      space(firstHeight + 18);
    heading(section.title);
    for (const record of section.records) {
      const height = recordHeight(record);
      space(height <= bottom - margin ? height : 24);
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
