import type { ResumeIR } from "@/lib/resume-ir";

/** Structured, Markdown-like presentation of the compiler output; no model HTML. */
export function ResumeDocument({ ir }: { ir: ResumeIR }) {
  const sections = {
    Experience: ir.experiences,
    Projects: ir.projects,
    Achievements: ir.supporting_sections,
    Education: ir.education,
    Certifications: ir.certifications,
  };
  return (
    <article className="chat-resume">
      <p className="eyebrow">
        Your tailored résumé{ir.demo ? " · fictional demo" : ""}
      </p>
      <h2>{ir.profile.name || "Profile pending publication"}</h2>
      <p>{ir.headline}</p>
      <p className="muted">
        {[
          ir.profile.contact.location,
          ir.profile.contact.address,
          ir.profile.contact.contact_email,
          ir.profile.contact.phone,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {ir.summary && (
        <>
          <h3>Profile</h3>
          <p>{ir.summary}</p>
        </>
      )}
      {ir.skill_groups.map((group) => (
        <section key={group.label}>
          <h3>{group.label}</h3>
          <p>{group.skills.join(" · ")}</p>
        </section>
      ))}
      {(
        ir.section_order || [
          "Experience",
          "Projects",
          "Achievements",
          "Education",
          "Certifications",
        ]
      ).map(
        (label) =>
          sections[label].length > 0 && (
            <section key={label}>
              <h3>{label}</h3>
              {sections[label].map((record, index) => (
                <div key={index}>
                  <h4>{record.title}</h4>
                  <p className="muted">{record.context}</p>
                  <ul>
                    {record.bullets.map((bullet, i) => (
                      <li key={i}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ),
      )}
      {!Object.values(sections).some((records) => records.length) && (
        <p>No relevant evidence is currently stored.</p>
      )}
    </article>
  );
}
