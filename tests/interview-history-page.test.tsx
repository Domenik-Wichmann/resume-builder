import type { ComponentProps, ReactElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { CareerInterviews } from "../src/components/career-interviews";
import {
  demoSession,
  demoMessages,
  demoSessions,
} from "../src/lib/interview/demo";
import { HttpError } from "../src/lib/http";
const saved = vi.hoisted(() => ({
  owner: vi.fn(),
  account: vi.fn(),
  list: vi.fn(),
  read: vi.fn(),
  brain: vi.fn(),
}));
vi.mock("../src/lib/admin", () => ({ requireOwner: saved.owner }));
vi.mock("../src/lib/accounts", () => ({ requireAccount: saved.account }));
vi.mock("../src/lib/interview/repository", () => ({
  listInterviews: saved.list,
  readInterview: saved.read,
}));
vi.mock("../src/lib/career-brain/repository", () => ({
  loadBrain: saved.brain,
}));
import InterviewsPage from "../src/app/admin/interviews/page";
const db = { verifiedJwtClient: true };
beforeEach(() => {
  vi.clearAllMocks();
  saved.owner.mockResolvedValue({});
  saved.account.mockResolvedValue({ db, accountId: "verified-account" });
  saved.list.mockResolvedValue(demoSessions);
  saved.brain.mockResolvedValue([]);
  saved.read.mockResolvedValue({
    session: demoSession,
    messages: demoMessages,
  });
});
it("resumes the most recent saved interview using the verified account client", async () => {
  const page = await InterviewsPage({ searchParams: Promise.resolve({}) });
  expect(saved.read).toHaveBeenCalledWith(
    db,
    "verified-account",
    demoSessions[0].id,
  );
  const child = page.props.children as ReactElement<
    ComponentProps<typeof CareerInterviews>
  >;
  expect(child.props.initialSession).toEqual(demoSession);
  expect(child.props.initialMessages).toEqual(demoMessages);
});
it("preserves an intentional interview deep link with account-scoped reads", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  await InterviewsPage({ searchParams: Promise.resolve({ session: id }) });
  expect(saved.read).toHaveBeenCalledWith(db, "verified-account", id);
});
it("does not read any private history before configured owner authentication", async () => {
  saved.owner.mockRejectedValue(new HttpError(403, "Not authorized"));
  await InterviewsPage({ searchParams: Promise.resolve({}) });
  expect(saved.account).not.toHaveBeenCalled();
  expect(saved.list).not.toHaveBeenCalled();
  expect(saved.read).not.toHaveBeenCalled();
});
