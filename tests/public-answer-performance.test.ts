import { afterEach, expect, it, vi } from "vitest";
import { primaryAccountId } from "../src/lib/account-id";
const state = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  reads: [] as string[],
}));
vi.mock("../src/lib/db", () => ({
  database: () => ({
    from: (table: string) => {
      state.reads.push(table);
      let rows = state.tables[table] || [];
      const query = {
        error: null,
        get data() {
          return rows;
        },
        select: () => query,
        order: () => query,
        eq: (key: string, value: unknown) => {
          rows = rows.filter((r) => r[key] === value);
          return query;
        },
        is: (key: string, value: unknown) => query.eq(key, value),
        gt: () => query,
        in: (key: string, values: unknown[]) => {
          rows = rows.filter((r) => values.includes(r[key]));
          return query;
        },
      };
      return query;
    },
  }),
}));
import { publicAnswers } from "../src/lib/portfolio/answers-server";
afterEach(() => {
  vi.unstubAllEnvs();
  state.tables = {};
  state.reads = [];
});
it("does not load any career records when no public answer cards exist", async () => {
  vi.stubEnv("APP_MODE", "live");
  // Configuration validation is mocked below; all records here are fictional.
  expect(await publicAnswers()).toEqual([]);
  expect(state.reads).toEqual(["answer_cards"]);
});
vi.mock("../src/lib/env", () => ({ validateEnv: () => ({ mode: "live" }) }));
it("reads only referenced identities and excludes private, archived and other-account sources", async () => {
  const source = {
    account_id: primaryAccountId,
    is_public: true,
    archived_at: null,
  };
  state.tables.projects = [
    { ...source, id: "public" },
    { ...source, id: "private", is_public: false },
    { ...source, id: "archived", archived_at: "2026-01-01" },
    { ...source, id: "foreign", account_id: "other" },
  ];
  state.tables.answer_cards = ["public", "private", "archived", "foreign"].map(
    (id) => ({
      id,
      account_id: primaryAccountId,
      is_public: true,
      stale: false,
      expires_at: "2099-01-01T00:00:00Z",
    }),
  );
  state.tables.answer_card_sources = state.tables.answer_cards.map((r) => ({
    account_id: primaryAccountId,
    card_id: r.id,
    project_id: r.id,
  }));
  expect((await publicAnswers()).map((r) => r.id)).toEqual(["public"]);
  expect(state.reads).toEqual([
    "answer_cards",
    "answer_card_sources",
    "projects",
  ]);
});
