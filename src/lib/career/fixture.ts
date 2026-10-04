import type { Career } from "./model";
/** Fictional, intentionally modest evidence. Never substitute this for owner biography. */
export const fixture: Career = {
  demo: true,
  profile: {
    name: "Alex Morgan",
    title: "Software engineer · systems & automation",
    introduction:
      "I connect data, build useful tools, and make everyday workflows simpler. Explore the evidence behind the work.",
  },
  skills: ["TypeScript", "SQL", "PostgreSQL", "React", "Automation"],
  skill_records: ["TypeScript", "SQL", "PostgreSQL", "React", "Automation"].map(
    (name) => ({
      id: `skill-${name.toLowerCase()}`,
      slug: name.toLowerCase(),
      title: name,
      subtitle: "Published demo skill",
      summary: `A published skill in this fictional career dataset: ${name}.`,
      skills: [name],
    }),
  ),
  experiences: [
    {
      id: "experience-demo",
      slug: "workflow-engineering",
      title: "Software engineer",
      subtitle: "Example Studio · fictional experience",
      summary:
        "Built internal TypeScript tools and SQL reporting queries for operational workflows.",
      skills: ["TypeScript", "SQL", "Automation"],
    },
  ],
  projects: [
    {
      id: "project-demo",
      slug: "operations-workbench",
      title: "Operations workbench",
      subtitle: "Internal tools · demo project",
      summary:
        "A React interface for reviewing PostgreSQL records and automating recurring reporting tasks.",
      skills: ["React", "PostgreSQL", "Automation"],
    },
    {
      id: "project-quality",
      slug: "data-quality-checks",
      title: "Data quality checks",
      subtitle: "Data tooling · demo project",
      summary:
        "SQL checks that flag missing records and inconsistent values for manual review.",
      skills: ["SQL", "PostgreSQL"],
    },
  ],
  achievements: [],
  education: [],
  certifications: [],
};
