import type { ResumeIR } from "../resume-ir";
export const designPreview: ResumeIR = {
  profile: {
    name: "Domenik Wichmann",
    contact: {
      market: "US",
      location: "Example City",
      contact_email: "domenik@example.invalid",
      phone: "+1 555 0100",
      work_authorization: "",
    },
  },
  headline: "Operations & data specialist",
  summary:
    "Fictional layout sample. Builds clear workflows and practical reporting tools with a collaborative team.",
  skill_groups: [
    {
      label: "Skills",
      skills: ["SQL", "Reporting", "Workflow design", "Communication"],
    },
  ],
  experiences: [
    {
      title: "Operations analyst",
      context: "Example organization / fictional sample",
      organization: "Example organization",
      role: "Operations analyst",
      dates: { start: "2022-01-01", end: "2025-12-31" },
      bullets: [
        "Worked with a team to simplify a reporting workflow.",
        "Built checks that made source-data review easier.",
      ],
      evidence_ids: [],
      priority: 0,
    },
  ],
  projects: [
    {
      title: "Reporting toolkit",
      context: "Fictional personal project",
      organization: null,
      role: "Creator",
      dates: { start: null, end: null },
      bullets: [
        "Created reusable validation scripts and documented their use.",
      ],
      evidence_ids: [],
      priority: 0,
    },
  ],
  education: [
    {
      title: "Example degree",
      context: "Example university / fictional sample",
      organization: null,
      role: "Student",
      dates: { start: null, end: null },
      bullets: [],
      evidence_ids: [],
      priority: 0,
    },
  ],
  certifications: [],
  supporting_sections: [],
  demo: true,
};
