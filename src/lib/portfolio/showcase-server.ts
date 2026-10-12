import "server-only";
import { database } from "../db";
import { primaryAccountId } from "../account-id";
import { publicProjects, projectMedia } from "./repository";
import {
  loadCaseStudies,
  fillCaseStudy,
  caseEvidenceHash,
} from "./case-study-server";
import { loadBrain } from "../career-brain/repository";
import { usable } from "../career-brain/state";
import { validateEnv } from "../env";
import { relevantScreenshots, type ProjectContext } from "./project-context";
import { demoProject, demoCaseContent } from "./demo";
import {
  selectShowcaseProjects,
  showcaseTitle,
  type ShowcaseCard,
} from "./selection";

export async function publicShowcase(): Promise<ShowcaseCard[]> {
  const data = await publicProjectDetails({ selectedOnly: true });
  return data
    .filter((item) => item.selected)
    .map(({ project, content, media }) => {
      const cover = media.find((item) => item.is_cover) || media[0];
      return {
        slug: project.slug,
        title: content.title,
        subtitle: content.tagline,
        summary: content.summary,
        cover: cover ? { id: cover.id, alt: cover.alt } : null,
      };
    });
}

export async function publicProjectDetails(
  options: { selectedOnly?: boolean; ids?: string[]; slug?: string } = {},
) {
  if (validateEnv(process.env).mode === "demo")
    return (!options.slug || options.slug === demoProject.slug) &&
      (!options.ids || options.ids.includes(demoProject.id))
      ? [
          {
            project: demoProject,
            content: demoCaseContent,
            skills: [
              "Fictional relational-data example",
              "Fictional UI example",
            ],
            selected: true,
            media: [],
          },
        ]
      : [];
  const db = database();
  const [projects, brain, cases] = await Promise.all([
    publicProjects(),
    loadBrain(db, primaryAccountId, true),
    loadCaseStudies(db, primaryAccountId),
  ]);
  const selected = new Set(
    selectShowcaseProjects(projects).map((project) => project.id),
  );
  const defaults = selectShowcaseProjects(projects);
  const ordered = options.selectedOnly
    ? [
        ...defaults,
        ...projects.filter(
          (project) => !defaults.some((item) => item.id === project.id),
        ),
      ]
    : projects;
  return Promise.all(
    ordered
      .filter(
        (project) =>
          project.is_public &&
          !project.archived &&
          (!options.ids || options.ids.includes(project.id)) &&
          (!options.slug || options.slug === project.slug) &&
          (!options.selectedOnly ||
            (cases.find((value) => value.project_id === project.id)?.selected ??
              selected.has(project.id))) &&
          brain.some(
            (record) =>
              record.kind === "project" &&
              record.id === project.id &&
              record.published &&
              !record.archived &&
              record.claims.some(usable),
          ),
      )
      .map(async (project) => {
        const record = brain.find(
          (record) => record.kind === "project" && record.id === project.id,
        )!;
        const saved = cases.find((value) => value.project_id === project.id);
        // A publication or evidence change is rechecked before serving saved prose.
        const content =
          saved?.is_public && saved.source_hash === caseEvidenceHash(record)
            ? saved.content
            : fillCaseStudy(project, record).content;
        const skills = brain
          .filter(
            (r) =>
              r.kind === "skill" &&
              r.published &&
              !r.archived &&
              record.skill_keys.includes(r.key) &&
              r.claims.some(usable),
          )
          .map((r) => r.title);
        return {
          project,
          content: {
            ...content,
            links: content.links.filter((link) => link.is_public),
          },
          skills,
          selected: saved?.selected ?? selected.has(project.id),
          media: (
            await projectMedia(db, primaryAccountId, project.id, true)
          ).filter((m) => m.is_public === true),
        };
      }),
  );
}

export async function publicProjectContext(
  ids: string[],
  query: string,
  browse: boolean,
): Promise<ProjectContext> {
  const projects = await publicProjectDetails({ ids });
  let remainingImages = 3;
  // Cited project identities, rather than model-generated URLs, establish which
  // published case studies and screenshots can accompany an answer.
  return {
    projects: projects
      .filter((item) => ids.includes(item.project.id))
      .sort((a, b) => ids.indexOf(a.project.id) - ids.indexOf(b.project.id))
      .slice(0, 6)
      .map(({ project, content, media }) => {
        const images = browse
          ? media.slice(0, 3)
          : relevantScreenshots(media, query).slice(0, remainingImages);
        if (!browse) remainingImages -= images.length;
        return {
          title: content.title || showcaseTitle(project),
          url: `/projects/${project.slug}`,
          images: images.map((m) => ({
            id: m.id,
            alt: m.alt,
            caption: m.caption,
          })),
        };
      }),
  };
}
