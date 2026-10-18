import Link from "next/link";
import { requireAccount } from "@/lib/accounts";
import { HttpError } from "@/lib/http";
import { applicationDashboard } from "@/lib/applications/repository";
import { ApplicationManager } from "@/components/application-manager";
import { AdminPageHeader } from "@/components/admin-page-header";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Résumé generator",
  robots: { index: false, follow: false },
};
export default async function Applications() {
  let a;
  try {
    a = await requireAccount();
  } catch (e) {
    if (!(e instanceof HttpError) || e.status !== 403) throw e;
    return (
      <main className="wrap prose">
        <h1>Applications & experiments</h1>
        <Link href="/auth/login">Sign in</Link>
      </main>
    );
  }
  return (
    <main id="main" className="wrap admin-main">
      <AdminPageHeader
        section="Applications"
        title="Résumé generator & history"
        description="Create a résumé for a job description, review and export it, then follow the interest it receives. Open a saved version to see its content and analytics."
      />
      <ApplicationManager
        data={await applicationDashboard(a.db, a.accountId)}
      />
    </main>
  );
}
