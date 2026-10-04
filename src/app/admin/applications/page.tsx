import Link from "next/link";
import { requireAccount } from "@/lib/accounts";
import { HttpError } from "@/lib/http";
import { applicationDashboard } from "@/lib/applications/repository";
import { ApplicationManager } from "@/components/application-manager";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Applications & experiments · Resume Builder",
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
    <main className="wrap portfolio-main">
      <Link href="/account">← Account</Link>
      <h1>Applications & experiments.</h1>
      <ApplicationManager
        data={await applicationDashboard(a.db, a.accountId)}
      />
    </main>
  );
}
