import Link from "next/link";
import { getResume } from "@/lib/resume";
import { PrintButton } from "@/components/print-button";
import { currentMarket, getPresentation } from "@/lib/market-server";
export const dynamic = "force-dynamic";
export default async function Resume() {
  const career = await getResume();
  const presentation = await getPresentation(await currentMarket());
  return (
    <main id="main" className="resume-page">
      <div className="resume-toolbar">
        <Link href="/">← Portfolio</Link>
        <PrintButton />
      </div>
      <article className="resume-sheet">
        {career.demo && <p className="eyebrow">Demo résumé · fictional data</p>}
        <h1>{career.profile.name}</h1>
        <p className="resume-title">{career.profile.title}</p>
        <p className="muted">
          {[
            presentation.location,
            presentation.contact_email,
            presentation.phone,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p>{career.profile.introduction}</p>
        {(
          [
            ["Experience", career.experiences],
            ["Projects", career.projects],
            ["Achievements", career.achievements],
            ["Education", career.education],
            ["Certifications", career.certifications],
          ] as const
        ).map(
          ([label, records]) =>
            records.length > 0 && (
              <section key={label}>
                <h2>{label}</h2>
                {records.map((record) => (
                  <div key={record.id} className="resume-record">
                    <h3>{record.title}</h3>
                    <p className="muted">{record.subtitle}</p>
                    <p>{record.summary}</p>
                  </div>
                ))}
              </section>
            ),
        )}
        <section>
          <h2>Skills</h2>
          <p>{career.skills.join(" · ")}</p>
        </section>
      </article>
    </main>
  );
}
