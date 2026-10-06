import "server-only";
import { getCareerCatalog } from "../career/catalog-server";
import { deriveExplorer } from "./explorer";
export async function getExplorer() {
  const { career, skill_categories } = await getCareerCatalog();
  return {
    ...deriveExplorer(
      career,
      skill_categories.map((group) => ({
        id: group.id,
        title: group.title,
        summary: "",
      })),
      skill_categories.flatMap((group) =>
        group.skill_ids.map((id) => ({ id, category_id: group.id })),
      ),
    ),
    demo: career.demo,
  };
}
