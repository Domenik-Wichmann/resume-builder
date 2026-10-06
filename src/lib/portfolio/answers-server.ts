import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { kinds, tableFor, type Canonical } from "../ingestion/model";
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
export async function publicAnswers(
  current?: Promise<
    Pick<Canonical, "id" | "kind" | "published" | "archived">[]
  >,
) {
  if (validateEnv(process.env).mode === "demo") return [];
  const db = database();
  const [cards, known] = await Promise.all([
    loadCards(db, primaryAccountId, true),
    current,
  ]);
  if (!cards.length) return [];
  // Cards need publication identity only, not every canonical field/junction.
  // A catalog request can reuse its already verified, fresh public snapshot.
  const records =
    known ||
    (
      await Promise.all(
        kinds.map(async (kind) => {
          const ids = [
            ...new Set(
              cards.flatMap((c) =>
                c.sources.filter((s) => s.kind === kind).map((s) => s.id),
              ),
            ),
          ];
          if (!ids.length) return [];
          const result = await db
            .from(tableFor[kind])
            .select("id")
            .eq("account_id", primaryAccountId)
            .eq("is_public", true)
            .is("archived_at", null)
            .in("id", ids);
          if (result.error) throw new Error("Cannot verify answer sources.");
          return result.data.map((r) => ({
            id: r.id as string,
            kind,
            published: true,
            archived: false,
          }));
        }),
      )
    ).flat();
  const published = new Set(
    records
      .filter((r) => r.published && !r.archived)
      .map((r) => `${r.kind}:${r.id}`),
  );
  return cards.filter((c) => cardVisible(c, published));
}
