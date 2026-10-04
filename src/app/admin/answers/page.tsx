import Link from "next/link";
import { requireAccount } from "@/lib/accounts";
import { HttpError } from "@/lib/http";
import { loadCards } from "@/lib/portfolio/answers-server";
import { loadCanonical } from "@/lib/ingestion/repository";
import { AnswerManager } from "@/components/answer-manager";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Quick Answer manager · Resume Builder",
  robots: { index: false, follow: false },
};
export default async function AnswersAdmin() {
  let a;
  try {
    a = await requireAccount();
  } catch (e) {
    if (!(e instanceof HttpError) || e.status !== 403) throw e;
    return (
      <main className="wrap prose">
        <h1>Quick Answers</h1>
        <Link href="/auth/login">Sign in to manage answers</Link>
      </main>
    );
  }
  const [cards, records, questions] = await Promise.all([
    loadCards(a.db, a.accountId),
    loadCanonical(a.db, a.accountId),
    a.db
      .from("workspace_questions")
      .select("question,workspace_id")
      .eq("account_id", a.accountId)
      .limit(1000),
  ]);
  if (questions.error) throw new Error("Cannot load question suggestions.");
  const grouped = new Map<string, Set<string>>();
  for (const q of questions.data || []) {
    const set = grouped.get(q.question) || new Set<string>();
    set.add(q.workspace_id);
    grouped.set(q.question, set);
  }
  const suggestions = [...grouped]
    .map(([question, ids]) => ({ question, workspaces: ids.size }))
    .sort((a, b) => b.workspaces - a.workspaces)
    .slice(0, 8);
  return (
    <main className="wrap portfolio-main">
      <Link href="/account">← Account</Link>
      <h1>Quick Answers.</h1>
      <AnswerManager
        initialCards={cards}
        records={records}
        suggestions={suggestions}
      />
    </main>
  );
}
