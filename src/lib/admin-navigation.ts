export const adminGroups = [
  {
    label: "Career",
    links: [
      {
        href: "/admin/interviews",
        label: "Career interviews",
        description: "Capture experience in a conversation",
      },
      {
        href: "/admin/explore",
        label: "Career records",
        description: "Browse, edit and connect your evidence",
      },
      {
        href: "/admin/career",
        label: "Import & review",
        description: "Add documents and approve proposed facts",
      },
    ],
  },
  {
    label: "Portfolio",
    links: [
      {
        href: "/admin/presentation",
        label: "Profile & contact",
        description: "Introduction, portraits and regional contact details",
      },
      {
        href: "/admin/projects",
        label: "Project showcase",
        description: "Case studies, screenshots and project links",
      },
      {
        href: "/admin/answers",
        label: "Quick answers",
        description: "Published answers to common questions",
      },
    ],
  },
  {
    label: "Applications",
    links: [
      {
        href: "/admin/applications",
        label: "Résumé generator & history",
        description: "Create, export and track tailored résumés",
      },
      {
        href: "/admin/templates",
        label: "Résumé design & templates",
        description: "Reusable layouts and fixed résumé blocks",
      },
      {
        href: "/admin#applications",
        label: "Tracking links",
        description: "Share a portfolio link for an application",
      },
    ],
  },
  {
    label: "Insights",
    links: [
      {
        href: "/admin/analytics",
        label: "Visitor analytics",
        description: "Visits, questions and recruiter interest",
      },
      {
        href: "/admin/usage",
        label: "AI usage",
        description: "Provider activity and recorded costs",
      },
      {
        href: "/admin#workspaces",
        label: "Recruiter workspaces",
        description: "Recent saved public workspaces",
      },
    ],
  },
] as const;

export function activeAdminLink(path: string, href: string) {
  if (href.includes("#")) return false;
  return path === href || (href !== "/admin" && path.startsWith(href + "/"));
}
