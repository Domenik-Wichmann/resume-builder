import type { ResumeIR } from "./resume-ir";
import { defaultDesign } from "./resume-design/model";

export const exportSections = (ir: ResumeIR) => {
  const sections = {
    Experience: ir.experiences,
    Projects: ir.projects,
    Achievements: ir.supporting_sections,
    Education: ir.education,
    Certifications: ir.certifications,
  };
  return [
    ...(
      ir.section_order || (Object.keys(sections) as (keyof typeof sections)[])
    ).map((key) => ({
      title: key === "Achievements" ? "Additional relevant work" : key,
      records: sections[key],
    })),
    { title: "Languages", records: ir.languages || [] },
  ].filter((section) => section.records.length);
};
export const exportTimeline = (record: ResumeIR["experiences"][number]) =>
  record.timeline_note ||
  (record.dates.start || record.dates.end
    ? `${record.dates.start || "Start date not recorded"} – ${record.dates.end || "End date not recorded"}`
    : "");
export const exportContact = (ir: ResumeIR) =>
  [
    ir.profile.contact.location,
    ir.profile.contact.address,
    ir.profile.contact.contact_email,
    ir.profile.contact.phone,
  ]
    .filter(Boolean)
    .join(" · ");
export const exportWorkAuthorization = (ir: ResumeIR) =>
  ir.profile.contact.work_authorization
    .split(/\s*(?:\/\/|\||·|;)\s*/)
    .map((part) =>
      part.replace(/(?:,\s*)?\bavailable\s+to\s+work\b[.!]?/gi, "").trim(),
    )
    .filter(Boolean)
    .join(" · ");
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
const link = (label: string, url: string) =>
  `<a href="${escape(url)}">${escape(label)}</a>`;

// Word can open this HTML document as .doc. Only visible presentation fields
// are serialized; the IR's provenance and private generation data never leave.
export function wordDocument(ir: ResumeIR) {
  const design = ir.design || defaultDesign;
  const paragraph = (text: string) => (text ? `<p>${escape(text)}</p>` : "");
  const skillGroup = (group: ResumeIR["skill_groups"][number]) =>
    `<h3>${escape(group.label)}</h3><ul>${group.skills.map((skill) => `<li>${escape(skill)}</li>`).join("")}</ul>`;
  const pairedSkills =
    ir.skill_groups.length > 1 ? ir.skill_groups.slice(0, 2) : [];
  const skills = `${pairedSkills.length ? `<table class="skills"><tr>${pairedSkills.map((group) => `<td>${skillGroup(group)}</td>`).join("")}</tr></table>` : ""}${ir.skill_groups
    .slice(pairedSkills.length)
    .map((group) => `<div class="skills">${skillGroup(group)}</div>`)
    .join("")}`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escape(ir.profile.name)} résumé</title>
  <style>@page{size:${design.page === "LETTER" ? "8.5in 11in" : "210mm 297mm"};margin:${design.margin_mm}mm}body{font-family:Arial,sans-serif;font-size:${design.font_pt}pt;color:${design.text}}h1{font-size:24pt;margin-bottom:4pt}h2{font-size:11pt;color:${design.accent};margin:12pt 0 4pt}h3{font-size:11pt;margin:6pt 0 2pt}p{margin:3pt 0}li{margin-bottom:3pt}a{color:${design.accent}}.invitation{font-size:8.5pt;color:#000;font-weight:bold;font-style:italic}.timeline{font-size:9pt}.contact{width:100%;border-collapse:collapse;font-size:9pt}.citizenship{text-align:right;white-space:nowrap;padding-left:12pt}.skills{width:100%;table-layout:fixed;border-collapse:collapse}.skills td{width:50%;vertical-align:top;padding-right:12pt}.skills ul{font-size:0.93em;margin:2pt 0 4pt;padding-left:11pt}.skills li{margin-bottom:2pt}</style></head><body>
  ${ir.demo ? paragraph("Fictional demonstration résumé") : ""}<h1>${escape(ir.profile.name)}</h1>${paragraph(ir.headline)}<table class="contact"><tr><td>${escape(exportContact(ir))}</td><td class="citizenship">${escape(exportWorkAuthorization(ir))}</td></tr></table>
  ${ir.portfolio_url ? `<p><strong>Portfolio &amp; AI demo:</strong> ${link(ir.portfolio_url, ir.portfolio_url)}${ir.github_url ? ` | <strong>GitHub:</strong> ${link(ir.github_url, ir.github_url)}` : ""}</p>` : ""}
  ${ir.invitation ? `<p class="invitation">${escape(ir.invitation)}</p>` : ""}
  ${ir.summary ? `<h2>Professional summary</h2>${paragraph(ir.summary)}` : ""}
  ${ir.skill_groups.length ? "<h2>Technical skills</h2>" : ""}${skills}
  ${exportSections(ir)
    .map(
      (section) =>
        `<h2>${escape(section.title)}</h2>${section.records.map((record) => `<h3>${escape(record.title)}</h3>${paragraph([record.organization, record.context].filter(Boolean).join(" | "))}${exportTimeline(record) ? `<p class="timeline">${escape(exportTimeline(record))}</p>` : ""}<ul>${record.bullets.map((bullet) => `<li>${escape(bullet)}</li>`).join("")}</ul>${record.links?.map((item) => `<p>${escape(item.label)}: ${link(item.url, item.url)}</p>`).join("") || ""}`).join("")}`,
    )
    .join("")}
  ${ir.closing && ir.portfolio_url ? `<p>${escape(ir.closing)}: ${link(ir.portfolio_url, ir.portfolio_url)}</p>` : ""}</body></html>`;
}
