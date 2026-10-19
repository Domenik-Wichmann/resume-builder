import { expect, it } from "vitest";
import { fixture } from "../src/lib/career/fixture";
import {
  publicDefaultResume,
  resumeProse,
} from "../src/lib/resume-design/public-content";
import { clearSignalContent } from "../src/lib/resume-design/fixed-content";
import { designPreview } from "../src/lib/resume-design/preview";
import type { CareerRecord } from "../src/lib/career/model";
const record = (id: string, title: string, summary: string): CareerRecord => ({
  id,
  slug: id,
  title,
  subtitle: "",
  summary,
  skills: [],
});
it("keeps technical and teaching roles, only requested languages, and all current fixed projects and contact details", () => {
  const baby = record(
    "937f2379-7dbc-4eae-a12f-5c3dacc13b0c",
    "Fictional catalog project",
    "Built a fictional catalog tool.",
  );
  const data = {
    ...fixture,
    demo: false,
    experiences: [
      record("tech", "Data engineer", "Built checks. End date unconfirmed."),
      record(
        "teacher",
        "English teacher",
        "Reported English teaching and tutoring in Fictional City.",
      ),
      record("bar", "Bartender", "Served drinks."),
      record("cook", "Cook", "Prepared meals."),
      record("family", "Family renovation", "Repaired houses."),
    ],
    projects: [baby],
    languages: [
      record("en", "English", "Reported native language, used in teaching."),
      record(
        "de",
        "German",
        "Used professionally; the source gives conflicting older labels.",
      ),
      record(
        "zh",
        "Mandarin Chinese",
        "Conversational, with professional use; no verified HSK level is established.",
      ),
      record("nl", "Dutch", "Learning."),
    ],
  };
  const fixed = {
    ...clearSignalContent,
    projects: [
      {
        ...clearSignalContent.projects[0],
        id: "babycat",
        record_id: null,
        title: "Fictional BabyCat",
        bullets: ["Built a fictional catalog tool with AI assistance."],
      },
    ],
  };
  const ir = publicDefaultResume(data, designPreview.profile.contact, fixed);
  expect(ir.experiences.map((r) => r.title)).toEqual([
    "Data engineer",
    "English teacher",
  ]);
  expect(ir.languages?.map((r) => r.title)).toEqual([
    "German",
    "English",
    "Mandarin",
  ]);
  expect(JSON.stringify(ir)).not.toMatch(
    /\bHSK\b|unconfirmed|Bartender|Renovation|Reported/,
  );
  expect(ir.profile.contact).toEqual(designPreview.profile.contact);
  expect(ir.portfolio_url).toBe(fixed.portfolio);
  expect(ir.projects[0].title).toBe("Fictional BabyCat");
  expect(ir.projects[0].bullets).toContain(
    "Built a fictional catalog tool with AI assistance.",
  );
  const updated = publicDefaultResume(
    {
      ...data,
      experiences: [
        {
          ...data.experiences[0],
          summary: "Built updated validation workflows.",
        },
      ],
    },
    { ...designPreview.profile.contact, phone: "Updated public phone" },
    fixed,
  );
  expect(updated.experiences[0].bullets).toEqual([
    "Built updated validation workflows.",
  ]);
  expect(updated.profile.contact.phone).toBe("Updated public phone");
  const passed = publicDefaultResume(
    {
      ...data,
      languages: data.languages.map((row) =>
        row.id === "zh"
          ? {
              ...row,
              summary: "Conversational, with professional use. Passed HSK 5.",
            }
          : row,
      ),
    },
    designPreview.profile.contact,
    fixed,
  );
  expect(JSON.stringify(passed.languages)).not.toContain("HSK");
  expect(
    publicDefaultResume(
      { ...data, projects: [] },
      designPreview.profile.contact,
      fixed,
    ).projects,
  ).toEqual([]);
});
it("uses implied first person without inventing qualifications or removing material AI and team scope", () => {
  expect(
    resumeProse(
      "Reported co-founder and operational work in a family-owned business. Exact dates are not documented.",
      "Fictional Owner",
    ),
  ).toBe("Co-founded and helped operate a family-owned business.");
  expect(
    resumeProse(
      "Built a prototype with AI assistance. Worked with my team. Degree completion remains unconfirmed.",
      "Fictional Owner",
    ),
  ).toBe("Built a prototype with AI assistance. Worked with my team.");
});
