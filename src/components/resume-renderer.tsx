import type { ResumeIR } from "@/lib/resume-ir";
import { defaultDesign, type ResumeDesign } from "@/lib/resume-design/model";
import { ResumeDesignFrame, ResumePortrait } from "./resume-design-frame";
export function ResumeRenderer({
  ir,
  design = defaultDesign,
}: {
  ir: ResumeIR;
  design?: ResumeDesign;
}) {
  const contact = ir.profile.contact;
  return (
    <ResumeDesignFrame spec={design}>
      <article className="resume-sheet">
        <header className="resume-designed-header">
          <ResumePortrait
            spec={design}
            src={contact.photo_url}
            name={ir.profile.name}
            preview={ir.demo}
          />
          {ir.demo && <p className="eyebrow">Demo résumé · fictional data</p>}
          <h1>{ir.profile.name}</h1>
          <p className="resume-title">{ir.headline}</p>
          <p className="muted">
            {[
              contact.location,
              contact.address,
              contact.contact_email,
              contact.phone,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {contact.work_authorization && <p>{contact.work_authorization}</p>}
        </header>
        <p>{ir.summary}</p>
        <div className="resume-designed-body">
          <div className="resume-designed-main">
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
            {Boolean(ir.languages?.length) && (
              <section>
                <h2>Languages</h2>
                {ir.languages?.map((record, i) => (
                  <div className="resume-record" key={i}>
                    <h3>{record.title}</h3>
                    <p>{record.context}</p>
                    {record.bullets.map((text, j) => (
                      <p key={j}>{text}</p>
                    ))}
                  </div>
                ))}
              </section>
            )}
          </div>
          <aside className="resume-designed-skills">
            {ir.skill_groups.map((group) => (
              <section key={group.label}>
                <h2>{group.label}</h2>
                <p>{group.skills.join(" · ")}</p>
              </section>
            ))}
          </aside>
        </div>
      </article>
    </ResumeDesignFrame>
  );
}
