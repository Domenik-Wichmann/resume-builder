import Link from "next/link";
import { requireAccount } from "@/lib/accounts";
import { CareerManager, type ImportDraft } from "@/components/career-manager";
import { explorerData } from "@/lib/career-brain/record-management";
import { HttpError } from "@/lib/http";
import { AdminPageHeader } from "@/components/admin-page-header";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Career Master",
  robots: { index: false, follow: false },
};
export default async function CareerPage({
  searchParams,
}: {
  searchParams: Promise<{ import?: string }>;
}) {
  const query = await searchParams;
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
  const [data, imports] = await Promise.all([
    explorerData(account.db, account.accountId),
    query.import
      ? account.db
          .from("career_imports")
          .select("id,status,candidates")
          .eq("account_id", account.accountId)
          .eq("id", query.import)
          .limit(1)
      : account.db
          .from("career_imports")
          .select("id,status,candidates")
          .eq("account_id", account.accountId)
          .order("created_at", { ascending: false })
          .limit(10),
  ]);
  if (imports.error) throw new Error("Cannot load import drafts.");
  return (
    <main id="main" className="wrap admin-main">
      <AdminPageHeader
        section="Career"
        title="Import & review"
        description="Add a career document, review proposed changes and choose what to publish. New evidence stays private until you approve it."
      />
      <nav className="admin-section-links" aria-label="Import sections">
        <a href="#import-document">Add a document</a>
        <a href="#import-review">Review proposals</a>
        <a href="#career-publication">Records & publication</a>
        <Link href="/admin/interviews">Career interviews →</Link>
      </nav>
      <CareerManager
        initialImportId={query.import}
        initialRecords={data.records}
        initialSources={data.sources}
        initialImports={(imports.data || []) as ImportDraft[]}
      />
    </main>
  );
}
