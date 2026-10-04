import Link from "next/link";
import { requireAccount } from "@/lib/accounts";
import { CareerManager, type ImportDraft } from "@/components/career-manager";
import { loadCanonical } from "@/lib/ingestion/repository";
import { HttpError } from "@/lib/http";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Career Master · Resume Builder",
  robots: { index: false, follow: false },
};
export default async function CareerPage() {
  let account;
  try {
    account = await requireAccount();
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 403) throw error;
    return (
      <main className="wrap prose">
        <h1>Career Master</h1>
        <p>Sign in to manage your account’s career records.</p>
        <Link href="/admin">Owner sign in</Link>
        <p>
          <Link href="/auth/login">Account sign in</Link>
        </p>
      </main>
    );
  }
  const [records, imports] = await Promise.all([
    loadCanonical(account.db, account.accountId),
    account.db
      .from("career_imports")
      .select("id,status,candidates")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (imports.error) throw new Error("Cannot load import drafts.");
  return (
    <main className="wrap admin-main">
      <Link href="/admin">← Overview</Link>
      <p className="eyebrow">Private career workspace</p>
      <h1>Career Master & Interview.</h1>
      <CareerManager
        initialRecords={records}
        initialImports={(imports.data || []) as ImportDraft[]}
      />
    </main>
  );
}
