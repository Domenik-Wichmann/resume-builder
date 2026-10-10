import { z } from "zod";
import type { ResumeIR } from "../resume-ir";

export const resumeUrl = z
  .url()
  .max(2000)
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Use an HTTPS URL without credentials.");
const fixedProject = z
  .object({
    id: z.string().min(1).max(100),
    record_id: z.uuid().nullable(),
    title: z.string().min(1).max(200),
    metadata: z.string().min(1).max(400),
    bullets: z.array(z.string().min(1).max(700)).min(1).max(4),
    homepage: resumeUrl.nullable(),
  })
  .strict();
export const fixedContentSchema = z
  .object({
    version: z.number().int().min(0),
    portfolio: resumeUrl,
    github: resumeUrl,
    invitation: z.string().min(1).max(200),
    closing: z.string().min(1).max(200),
    learning_demo: resumeUrl.nullable(),
    projects: z.tuple([fixedProject, fixedProject]),
  })
  .strict()
  .refine(
    (value) =>
      !value.learning_demo ||
      value.learning_demo.replace(/\/$/, "") !==
        value.projects[1].homepage?.replace(/\/$/, ""),
    "Learning demo must have its own destination, separate from the LMS homepage.",
  );
export type FixedContent = z.infer<typeof fixedContentSchema>;

// Imported from the owner's v4 package. This is presentation approval, not
// new canonical evidence, and is never supplied as proof to the writing model.
export const clearSignalContent: FixedContent = {
  version: 0,
  portfolio: "https://domenik-wichmann.com",
  github: "https://github.com/Domenik-Wichmann",
  invitation: "Explore my projects and ask about my experience online.",
  closing: "Explore project examples",
  learning_demo: null,
  projects: [
    {
      id: "personal_portfolio",
      record_id: null,
      title: "domenik-wichmann.com — AI Career Portfolio",
      metadata:
        "2026 | Project owner; AI-assisted development | Working application; ongoing development",
      homepage: null,
      bullets: [
        "Built an AI-assisted career portfolio connecting structured experience, projects, skills, and source evidence for recruiter exploration.",
        "Directed implementation of semantic retrieval with Cohere embeddings and Supabase pgvector, plus evidence-grounded Q&A and job-description analysis.",
        "Designed reviewed career imports, source-linked claims, and reusable résumé views so the same records support recruiter answers and application content.",
      ],
    },
    {
      id: "lms",
      record_id: null,
      title: "SystemWright LMS — Multilingual Onboarding",
      metadata:
        "2026 | Project owner; AI-assisted development | Built application; independent project",
      homepage: "https://systemwright-lms.web.app/",
      bullets: [
        "Built a Firebase/Firestore learning application with multilingual content, tests, progress tracking, and a RAG chatbot.",
        "Designed a translation and voiceover workflow for supplier onboarding, including interactive video steps and language switching.",
      ],
    },
  ],
};
export function applyFixedContent(
  ir: ResumeIR,
  fixed: FixedContent,
  learning?: string | null,
): ResumeIR {
  const demo = learning || fixed.learning_demo;
  return {
    ...ir,
    fixed_content_version: fixed.version,
    portfolio_url: fixed.portfolio.replace(/\/$/, ""),
    github_url: fixed.github,
    invitation: fixed.invitation,
    closing: fixed.closing,
    projects: fixed.projects.map((p, index) => ({
      title: p.title,
      context: p.metadata,
      organization: null,
      role: "",
      dates: { start: null, end: null },
      bullets: [
        ...p.bullets,
        ...ir.projects
          .filter(
            (project) =>
              p.record_id && project.evidence_ids.includes(p.record_id),
          )
          .flatMap((project) =>
            project.job_specific_bullet ? [project.job_specific_bullet] : [],
          )
          .filter((bullet) => !p.bullets.includes(bullet))
          .slice(0, 1),
      ],
      job_specific_bullet: ir.projects.find(
        (project) => p.record_id && project.evidence_ids.includes(p.record_id),
      )?.job_specific_bullet,
      evidence_ids: p.record_id ? [p.record_id] : [],
      priority: 2 - index,
      locked_id: p.id,
      links:
        index === 0
          ? [
              {
                label: "Explore this project",
                url: fixed.portfolio,
                portfolio: true,
              },
            ]
          : [
              ...(p.homepage ? [{ label: "Homepage", url: p.homepage }] : []),
              ...(demo
                ? [{ label: "Learning demo", url: resumeUrl.parse(demo) }]
                : []),
            ],
    })),
    section_order: [
      "Projects",
      "Experience",
      "Achievements",
      "Education",
      "Certifications",
    ],
  };
}
export function withTrackingUrl(ir: ResumeIR, code: string): ResumeIR {
  if (!/^[A-Za-z0-9_-]{8}$/.test(code))
    throw new Error("Invalid saved tracking code");
  if (!ir.portfolio_url) return ir;
  const origin = new URL(ir.portfolio_url).origin;
  const url = `${origin}/r/${code}`;
  return {
    ...ir,
    portfolio_url: url,
    projects: ir.projects.map((p) => ({
      ...p,
      links: p.links?.map((l) => (l.portfolio ? { ...l, url } : l)),
    })),
  };
}
