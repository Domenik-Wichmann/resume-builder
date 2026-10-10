import { expect, it } from "vitest";
import {
  applicationAnalytics,
  type AnalyticsInput,
} from "../src/lib/applications/analytics";

it("keeps retained résumé analytics scoped to its links and workspaces, including draft visits", () => {
  const input: AnalyticsInput = {
    applications: [{ id: "a", sent_at: null }],
    snapshots: [],
    variants: [],
    outcomes: [],
    links: [
      { id: "link", application_id: "a" },
      { id: "other", application_id: "b" },
    ],
    visits: [
      { link_id: "link", session_id: "s" },
      { link_id: "link", session_id: "s" },
      { link_id: "other", session_id: "s" },
    ],
    workspaces: [
      { id: "w", tracking_link_id: "link" },
      { id: "other-w", tracking_link_id: "other" },
      { id: "unattributed", tracking_link_id: null },
    ],
    questions: [{ workspace_id: "w" }, { workspace_id: "other-w" }],
    explorer: [{ workspace_id: "w" }, { workspace_id: "unattributed" }],
    events: [
      { workspace_id: "w", event_type: "resume_preview" },
      { workspace_id: "w", event_type: "workspace_export" },
      { workspace_id: "other-w", event_type: "workspace_export" },
    ],
  };
  expect(applicationAnalytics(input, "a")).toEqual({
    visits: 1,
    workspaces: 1,
    questions: 1,
    engagement: 1,
    previews: 1,
    exports: 1,
  });
  expect(applicationAnalytics(input, "missing")).toEqual({
    visits: 0,
    workspaces: 0,
    questions: 0,
    engagement: 0,
    previews: 0,
    exports: 0,
  });
});
