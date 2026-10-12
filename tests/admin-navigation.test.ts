import { expect, it } from "vitest";
import { activeAdminLink, adminGroups } from "../src/lib/admin-navigation";
it("keeps every admin tool in one logical group and retains useful overview anchors", () => {
  const links = adminGroups.flatMap((group) => [...group.links]);
  expect(new Set(links.map((link) => link.href)).size).toBe(links.length);
  expect(links.map((link) => link.href)).toEqual(
    expect.arrayContaining([
      "/admin/interviews",
      "/admin/career",
      "/admin/explore",
      "/admin/presentation",
      "/admin/projects",
      "/admin/answers",
      "/admin/applications",
      "/admin/templates",
      "/admin/analytics",
      "/admin/usage",
      "/admin#applications",
      "/admin#workspaces",
    ]),
  );
});
it("keeps Applications active on saved résumé detail pages without marking Overview active", () => {
  expect(
    activeAdminLink("/admin/applications/saved-fixture", "/admin/applications"),
  ).toBe(true);
  expect(activeAdminLink("/admin/applications/saved-fixture", "/admin")).toBe(
    false,
  );
  expect(
    activeAdminLink("/admin/applications-other", "/admin/applications"),
  ).toBe(false);
  expect(activeAdminLink("/admin", "/admin#workspaces")).toBe(false);
});
