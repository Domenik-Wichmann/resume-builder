import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { hydrateClaims, type StateRecord } from "../src/lib/career-brain/state";
import { resumeFromBrain } from "../src/lib/resume";
import { generalResumeIR } from "../src/lib/resume-design/from-career";
import { clearSignalContent } from "../src/lib/resume-design/fixed-content";
import {
  defaultDesign,
  type ResumeTemplate,
} from "../src/lib/resume-design/model";
import { ResumeTemplateStudio } from "../src/components/resume-template-studio";

describe("saved application layout preview", () => {
  it("renders reviewed published data and fixed blocks with the saved default design", async () => {
    // These are explicitly fictional grounding fixtures, never live career data.
    const fixture: { current: StateRecord[] } = JSON.parse(
      await readFile(
        "experiments/career-brain/v2/claim-repair/results/repeat-state.json",
        "utf8",
      ),
    );
    const records = fixture.current.map((record) => ({
      ...hydrateClaims(record, "CONFIRMED"),
      published: true,
      archived: false,
      evidence_version: null,
    }));
    const profile = records.find((record) => record.kind === "profile")!;
    const project = records.find((record) => record.kind === "project")!;
    const privateProfile = {
      ...profile,
      id: "private-profile",
      title: "Private identity",
      summary: "Private summary",
      published: false,
    };
    const archived = {
      ...project,
      id: "archived-project",
      title: "Archived project",
      archived: true,
    };
    const career = resumeFromBrain([privateProfile, ...records, archived]);
    expect(career.profile.name).toBe(profile.title);
    expect(career.profile.introduction).toBe(profile.summary);
    expect(
      career.projects.find((item) => item.id === project.id)?.summary,
    ).toBe(project.summary);
    expect(career.projects.some((item) => item.id === archived.id)).toBe(false);
    const fixed = {
      ...clearSignalContent,
      projects: [
        { ...clearSignalContent.projects[0], record_id: project.id },
        { ...clearSignalContent.projects[1], record_id: archived.id },
      ] as typeof clearSignalContent.projects,
    };
    const preview = generalResumeIR(
      career,
      {
        market: "US",
        location: "Saved location",
        contact_email: "owner@example.test",
        phone: "",
        work_authorization: "",
      },
      fixed,
    );
    const template: ResumeTemplate = {
      id: "00000000-0000-4000-8000-000000000002",
      name: "Saved default",
      version: 1,
      spec: defaultDesign,
      reference_id: null,
      notes: "",
      limitations: [],
      is_default: true,
    };
    const html = renderToStaticMarkup(
      createElement(ResumeTemplateStudio, {
        initialTemplates: [
          {
            ...template,
            id: "00000000-0000-4000-8000-000000000003",
            name: "Recent non-default",
            is_default: false,
          },
          template,
        ],
        initialAssets: [],
        preview,
      }),
    );
    expect(html).toContain('value="Saved default"');
    expect(html).toContain(profile.title);
    expect(html).toContain("owner@example.test");
    expect(html).toContain(fixed.projects[0].title);
    expect(html).not.toContain(fixed.projects[1].title);
    expect(html).not.toContain("Private identity");
    expect(html).not.toContain("domenik@example.invalid");
    expect(html).toContain("published career data");
  });
});
