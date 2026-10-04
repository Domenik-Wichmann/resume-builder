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
  publicOnly = false,
): Promise<AnswerCard[]> {
  let query = db
    .from("answer_cards")
    .select("*")
    .eq("account_id", accountId)
    .order("display_priority");
  if (publicOnly)
    query = query
      .eq("is_public", true)
      .eq("stale", false)
      .gt("expires_at", new Date().toISOString());
  const cards = await query;
  if (cards.error) throw new Error("Cannot load answer cards.");
  if (!cards.data?.length) return [];
  const sources = await db
    .from("answer_card_sources")
    .select("*")
    .eq("account_id", accountId)
    .in(
      "card_id",
      cards.data.map((c) => c.id),
    );
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
    loadCards(db, primaryAccountId, true),
    loadCanonical(db, primaryAccountId, true),
  ]);
  const published = new Set(
    records
      .filter((r) => r.published && !r.archived)
      .map((r) => `${r.kind}:${r.id}`),
  );
  return cards.filter((c) => cardVisible(c, published));
}
