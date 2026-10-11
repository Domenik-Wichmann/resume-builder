import "server-only";
import { database } from "../db";
import { primaryAccountId } from "../account-id";
import { publicProjects, projectMedia } from "./repository";
import {
  selectShowcaseProjects,
  showcaseTitle,
  type ShowcaseCard,
} from "./selection";

export async function publicShowcase(): Promise<ShowcaseCard[]> {
  const projects = selectShowcaseProjects(await publicProjects());
  return Promise.all(
    projects.map(async (project) => {
      // Media is read only for a published, unarchived parent in the primary account.
      const media = await projectMedia(
        database(),
        primaryAccountId,
        project.id,
      );
      const cover = media.find((item) => item.is_cover);
      return {
        slug: project.slug,
        title: showcaseTitle(project),
        subtitle: project.subtitle,
        summary: project.summary,
        cover: cover ? { id: cover.id, alt: cover.alt } : null,
      };
    }),
  );
}
