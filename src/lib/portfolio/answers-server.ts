import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { kinds } from "../ingestion/model";
import { loadCanonical } from "../ingestion/repository";
import { database } from "../db";
import { primaryAccountId } from "../account-id";
import { validateEnv } from "../env";
import { cardVisible, type AnswerCard } from "./answers";
export async function loadCards(
  db: SupabaseClient,
  accountId: string,
): Promise<AnswerCard[]> {
  const [cards, sources] = await Promise.all([
    db
      .from("answer_cards")
      .select("*")
      .eq("account_id", accountId)
      .order("display_priority"),
    db.from("answer_card_sources").select("*").eq("account_id", accountId),
  ]);
  if (cards.error || sources.error)
    throw new Error("Cannot load answer cards.");
  return (cards.data || []).map((c) => ({
    ...c,
    sources: (sources.data || [])
      .filter((s) => s.card_id === c.id)
      .flatMap((s) =>
        kinds.flatMap((kind) =>
          s[`${kind}_id`] ? [{ kind, id: s[`${kind}_id`] }] : [],
        ),
      ),
  }));
}
export async function publicAnswers() {
  if (validateEnv(process.env).mode === "demo") return [];
  const db = database();
  const [cards, records] = await Promise.all([
    loadCards(db, primaryAccountId),
    loadCanonical(db, primaryAccountId),
  ]);
  const published = new Set(
    records
      .filter((r) => r.published && !r.archived)
      .map((r) => `${r.kind}:${r.id}`),
  );
  return cards.filter((c) => cardVisible(c, published));
}
