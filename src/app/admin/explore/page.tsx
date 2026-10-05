import Link from "next/link";
import { requireAccount } from "@/lib/accounts";
import { HttpError } from "@/lib/http";
import { explorerData } from "@/lib/career-brain/record-management";
import { CareerRecordWorkspace } from "@/components/career-record-explorer";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Career explorer · Resume Builder",
  robots: { index: false, follow: false },
};
export default async function AdminExplorer() {
  let account;
  try {
    account = await requireAccount();
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 403) throw error;
    return (
      <main id="main" className="wrap prose">
        <h1>Career explorer</h1>
        <p>Sign in to explore and edit your private career records.</p>
        <Link className="button" href="/admin">
          Owner sign in
        </Link>
        <p>
          <Link href="/auth/login">Account sign in</Link>
        </p>
      </main>
    );
  }
  return (
    <main id="main" className="wrap admin-main explorer-page">
      <div className="explorer-page-heading">
        <p className="eyebrow">Your career, connected</p>
        <h1>Career explorer.</h1>
        <p className="muted">
          Browse your skills, projects, experiences and the evidence that
          connects them.
        </p>
      </div>
      <CareerRecordWorkspace
        initialData={await explorerData(account.db, account.accountId)}
      />
    </main>
  );
}
