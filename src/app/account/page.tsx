import Link from "next/link";
import { requireAccount } from "@/lib/accounts";
import { OwnerLogout } from "@/components/admin-controls";
import { HttpError } from "@/lib/http";
export const dynamic = "force-dynamic";
export default async function Account() {
  try {
    await requireAccount();
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 403) throw error;
    return (
      <main className="wrap prose">
        <h1>Account access</h1>
        <Link href="/auth/login">Sign in</Link>
      </main>
    );
  }
  return (
    <main className="wrap prose">
      <h1>Your career account</h1>
      <OwnerLogout endpoint="/api/auth/login" />
      <p>Your private career records are isolated by account membership.</p>
      <Link className="button" href="/admin/career">
        Open Career Master & Interview
      </Link>
    </main>
  );
}
