"use client";
import { useState } from "react";
import type { AnswerCard, CardInput } from "@/lib/portfolio/answers";
import type { Canonical } from "@/lib/ingestion/model";
const blank: CardInput = {
  id: null,
  slug: "",
  question: "",
  answer: "",
  display_priority: 0,
  review_days: 90,
  generated: false,
  sources: [],
};
export function AnswerManager({
  initialCards,
  records,
  suggestions,
}: {
  initialCards: AnswerCard[];
  records: Canonical[];
  suggestions: { question: string; workspaces: number }[];
}) {
  const [cards, setCards] = useState(initialCards),
    [form, setForm] = useState<CardInput>(blank),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [reviewNow] = useState(() => Date.now());
  async function action(payload: unknown) {
    const r = await fetch("/api/admin/answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    return d;
  }
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await task();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save answer.");
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    const r = await fetch("/api/admin/answers");
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setCards(d.cards);
  }
  return (
    <div className="manager-grid">
      <aside className="surface">
        <button onClick={() => setForm({ ...blank })}>New answer</button>
        {cards.map((c) => (
          <div className="answer-list-item" key={c.id}>
            <button
              className="choice-button"
              onClick={() =>
                setForm({
                  id: c.id,
                  slug: c.slug,
                  question: c.question,
                  answer: c.answer,
                  display_priority: c.display_priority,
                  review_days: 90,
                  generated: Boolean(c.generated_at),
                  sources: c.sources,
                })
              }
            >
              {c.question}
              <small>
                {c.is_public ? "Public" : "Private"}
                {c.stale ? " · Evidence changed" : ""}
                {Date.parse(c.expires_at) <= reviewNow ? " · Review due" : ""}
              </small>
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await action({
                    action: "publish",
                    id: c.id,
                    published: !c.is_public,
                  });
                  await refresh();
                  setMessage(c.is_public ? "Unpublished." : "Published.");
                })
              }
            >
              {c.is_public ? "Unpublish" : "Publish reviewed answer"}
            </button>
          </div>
        ))}
        {suggestions.length > 0 && (
          <section>
            <h2>Questions to consider</h2>
            {suggestions.map((s) => (
              <div key={s.question}>
                <p>
                  {s.question}
                  <small> · Asked in {s.workspaces} workspaces</small>
                </p>
                <button
                  onClick={() => setForm({ ...blank, question: s.question })}
                >
                  Create draft
                </button>
              </div>
            ))}
          </section>
        )}
      </aside>
      <section className="surface">
        <h2>{form.id ? "Review answer" : "Draft a Quick Answer"}</h2>
        <p>
          Saving creates a private draft and resets its review date. Check the
          answer against its citations, then publish explicitly.
        </p>
        <form
          className="editor-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const d = await action({ action: "save", card: form });
              setForm({ ...form, id: d.id });
              await refresh();
              setMessage(
                "Saved privately. Review and publish from the answer list.",
              );
            });
          }}
        >
          <label>
            Question
            <input
              required
              maxLength={1000}
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
            />
          </label>
          <label>
            Slug
            <input
              required
              maxLength={100}
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
          </label>
          <label>
            Answer
            <textarea
              rows={9}
              required
              maxLength={5000}
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
            />
          </label>
          <div className="field-row">
            <label>
              Review after days
              <input
                type="number"
                min={1}
                max={365}
                value={form.review_days}
                onChange={(e) =>
                  setForm({ ...form, review_days: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Display priority
              <input
                type="number"
                min={0}
                max={10000}
                value={form.display_priority}
                onChange={(e) =>
                  setForm({ ...form, display_priority: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <fieldset>
            <legend>Supporting canonical evidence</legend>
            {records
              .filter((r) => !r.archived)
              .map((r) => (
                <label className="check-label" key={r.id}>
                  <input
                    type="checkbox"
                    checked={form.sources.some((s) => s.id === r.id)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        sources: e.target.checked
                          ? [...form.sources, { kind: r.kind, id: r.id }]
                          : form.sources.filter((s) => s.id !== r.id),
                      })
                    }
                  />
                  {r.kind}: {r.title}
                  {!r.published ? " (private)" : ""}
                </label>
              ))}
          </fieldset>
          <button disabled={busy || !form.sources.length}>
            Save reviewed draft
          </button>
        </form>
        <button
          disabled={busy || form.question.length < 3}
          onClick={() =>
            run(async () => {
              const d = await action({
                action: "generate",
                question: form.question,
              });
              setForm({
                ...form,
                answer: d.answer,
                sources: d.sources,
                generated: true,
              });
              setMessage(
                "Generated draft only. Review wording and citations before saving.",
              );
            })
          }
        >
          Generate / regenerate draft
        </button>
        <p role="status">{message}</p>
      </section>
    </div>
  );
}
