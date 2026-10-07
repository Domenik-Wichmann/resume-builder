import Link from "next/link";
import { z } from "zod";
import { CareerInterviews } from "@/components/career-interviews";
import { requireOwner } from "@/lib/admin";
import { requireAccount } from "@/lib/accounts";
import { loadBrain } from "@/lib/career-brain/repository";
import { listInterviews, readInterview } from "@/lib/interview/repository";
import { HttpError } from "@/lib/http";
import { demoMessages, demoSession, demoSessions } from "@/lib/interview/demo";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Career Interviews · Resume Builder",
  robots: { index: false, follow: false },
};
export default async function InterviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; preview?: string }>;
}) {
  const query = await searchParams;
  if (process.env.APP_MODE === "demo" && query.preview === "1")
    return (
      <main id="main" className="wrap">
        <CareerInterviews
          preview
          initialSessions={demoSessions}
          initialSession={demoSession}
          initialMessages={demoMessages}
          records={[
            {
              id: demoSession.id,
              title: "Resume Builder (fictional sample)",
              kind: "project",
            },
          ]}
        />
      </main>
    );
  try {
    await requireOwner();
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 403) throw error;
    return (
      <main id="main" className="wrap prose">
        <h1>Career Interviews</h1>
        <p>
          Sign in as the configured owner to access your private interviews.
        </p>
        <Link href="/admin">Owner sign in →</Link>
      </main>
    );
  }
  const { db, accountId } = await requireAccount();
  const [sessions, records, current] = await Promise.all([
    listInterviews(db, accountId),
    loadBrain(db, accountId),
    query.session
      ? readInterview(db, accountId, z.uuid().parse(query.session))
      : null,
  ]);
  return (
    <main id="main" className="wrap">
      <CareerInterviews
        initialSessions={sessions}
        initialImportStatus={current?.importStatus}
        initialSession={current?.session}
        initialMessages={current?.messages}
        records={records
          .filter(
            (r) =>
              !r.archived &&
              ["project", "experience", "achievement"].includes(r.kind),
          )
          .map((r) => ({ id: r.id, title: r.title, kind: r.kind }))}
      />
    </main>
  );
}
