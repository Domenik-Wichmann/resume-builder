import type { ResumeIR } from "@/lib/resume-ir";
export function ResumeRenderer({ ir }: { ir: ResumeIR }) {
  const contact = ir.profile.contact;
  return (
    <article className="resume-sheet">
      {ir.demo && <p className="eyebrow">Demo résumé · fictional data</p>}
      <h1>{ir.profile.name}</h1>
      <p className="resume-title">{ir.headline}</p>
      <p className="muted">
        {[contact.location, contact.contact_email, contact.phone]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {contact.work_authorization && <p>{contact.work_authorization}</p>}
      <p>{ir.summary}</p>
      {(
        [
          ["Experience", ir.experiences],
          ["Projects", ir.projects],
          ["Achievements", ir.supporting_sections],
          ["Education", ir.education],
          ["Certifications", ir.certifications],
        ] as const
      )
        .slice()
        .sort(
          (a, b) =>
            (ir.section_order?.indexOf(a[0]) ?? 0) -
            (ir.section_order?.indexOf(b[0]) ?? 0),
        )
        .map(
          ([label, records]) =>
            records.length > 0 && (
              <section key={label}>
                <h2>{label}</h2>
                {records.map((record, index) => (
                  <div
                    className="resume-record"
                    key={`${record.title}-${index}`}
                  >
                    <h3>{record.title}</h3>
                    {record.organization && <p>{record.organization}</p>}
                    {record.dates.start && (
                      <p className="muted">
                        {record.dates.start} –{" "}
                        {record.dates.end || "End date not recorded"}
                      </p>
                    )}
                    <p className="muted">{record.context}</p>
                    <ul>
                      {record.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ),
        )}
      {ir.skill_groups.map((group) => (
        <section key={group.label}>
          <h2>{group.label}</h2>
          <p>{group.skills.join(" · ")}</p>
        </section>
      ))}
    </article>
  );
}
