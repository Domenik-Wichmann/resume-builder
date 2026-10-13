import type { ProjectInput } from "./model";
import { safeProjectUrl } from "./model";
export type ProjectLink = ProjectInput["links"][number];
export const projectLinkTypes: {
  value: ProjectLink["link_type"];
  label: string;
  button: string;
}[] = [
  { value: "LIVE", label: "Website", button: "Visit website" },
  { value: "GITHUB", label: "GitHub", button: "View source code" },
  { value: "DEMO", label: "Demo", button: "Watch demo" },
  { value: "TRIAL", label: "Try it", button: "Try it" },
  { value: "CASE_STUDY", label: "Case study", button: "Read case study" },
  {
    value: "DOCUMENTATION",
    label: "Documentation",
    button: "Read documentation",
  },
  { value: "OTHER", label: "Other link", button: "Open link" },
];
export function projectLinkUrl(value: string) {
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.startsWith("/") ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  )
    return trimmed;
  const candidate = "https://" + trimmed;
  return safeProjectUrl(candidate) ? candidate : trimmed;
}
export function newProjectLink(
  type: ProjectLink["link_type"],
  index: number,
): ProjectLink {
  return {
    label:
      projectLinkTypes.find((item) => item.value === type)?.button ||
      "Open link",
    link_type: type,
    url: "",
    display_order: index,
    is_public: true,
  };
}
