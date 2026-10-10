import type { ResumeIR } from "@/lib/resume-ir";
import { defaultDesign, type ResumeDesign } from "@/lib/resume-design/model";
import { ResumeDesignFrame, ResumePortrait } from "./resume-design-frame";
export function ResumeRenderer({
  ir,
  design,
}: {
  ir: ResumeIR;
  design?: ResumeDesign;
}) {
  const contact = ir.profile.contact;
  design = design || ir.design || defaultDesign;
  const readable = (url: string) =>
    url.replace(/^https:\/\//, "").replace(/\/$/, "");
  const skills = (
    <aside className="resume-designed-skills">
      {design.layout === "CLASSIC"
        ? ir.skill_groups.length > 0 && (
            <section>
              <h2>Technical skills</h2>
              {ir.skill_groups.map((group) => (
                <p key={group.label}>
                  <strong>{group.label}:</strong> {group.skills.join(" · ")}
                </p>
              ))}
            </section>
          )
        : ir.skill_groups.map((group) => (
            <section key={group.label}>
              <h2>{group.label}</h2>
              <p>{group.skills.join(" · ")}</p>
            </section>
          ))}
    </aside>
  );
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
          {ir.portfolio_url && (
            <p className="resume-links">
              <strong>Portfolio &amp; AI demo:</strong>{" "}
              <a href={ir.portfolio_url}>{readable(ir.portfolio_url)}</a>
              {ir.github_url && (
                <>
                  {" "}
                  | GitHub:{" "}
                  <a href={ir.github_url}>{readable(ir.github_url)}</a>
                </>
              )}
            </p>
          )}
          {ir.invitation && (
            <p className="resume-invitation">{ir.invitation}</p>
          )}
        </header>
        {ir.summary && (
          <section className="resume-summary">
            <h2>Professional summary</h2>
            <p>{ir.summary}</p>
          </section>
        )}
        {design.layout === "CLASSIC" && skills}
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
                      <h2>
                        {label === "Achievements"
                          ? "Additional relevant work"
                          : label}
                      </h2>
                      {records.map((record, index) => (
                        <div
                          className="resume-record"
                          key={`${record.title}-${index}`}
                        >
                          <h3>{record.title}</h3>
                          <p className="muted">
                            {[record.organization, record.context]
                              .filter(Boolean)
                              .join(" | ")}
                          </p>
                          {(label === "Experience" ||
                            record.dates.start ||
                            record.dates.end ||
                            record.timeline_note) && (
                            <p className="resume-timeline">
                              {record.timeline_note ||
                                (record.dates.start
                                  ? `${record.dates.start} – ${record.dates.end || "End date not recorded"}`
                                  : record.dates.end
                                    ? `Start date not recorded – ${record.dates.end}`
                                    : "Dates not recorded")}
                            </p>
                          )}
                          <ul>
                            {record.bullets.map((bullet) => (
                              <li key={bullet}>{bullet}</li>
                            ))}
                          </ul>
                          {record.links?.length ? (
                            <p className="resume-links">
                              {record.links.map((link, index) => (
                                <span key={link.label}>
                                  {index > 0 && " | "}
                                  {link.label}:{" "}
                                  <a href={link.url}>{readable(link.url)}</a>
                                </span>
                              ))}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </section>
                  ),
              )}
            {Boolean(ir.languages?.length) && (
              <section>
                <h2>Languages</h2>
                {ir.languages?.map((record, i) => (
                  <div className="resume-language" key={i}>
                    <p>
                      <strong>{record.title}:</strong> {record.context}
                    </p>
                    {record.bullets.map((text, j) => (
                      <p key={j}>{text}</p>
                    ))}
                  </div>
                ))}
              </section>
            )}
          </div>
          {design.layout === "SIDEBAR" && skills}
        </div>
        {ir.closing && ir.portfolio_url && (
          <p className="resume-closing">
            {ir.closing}:{" "}
            <a href={ir.portfolio_url}>{readable(ir.portfolio_url)}</a>
            {ir.github_url && (
              <>
                {" "}
                | GitHub: <a href={ir.github_url}>{readable(ir.github_url)}</a>
              </>
            )}
          </p>
        )}
      </article>
    </ResumeDesignFrame>
  );
}
