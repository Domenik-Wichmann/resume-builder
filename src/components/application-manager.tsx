"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  suggestedMetadata,
  metadataSchema,
  families,
  outcomes,
  outcomeAllowed,
  strategies,
  type JobMetadata,
} from "@/lib/applications/model";
import type { applicationDashboard } from "@/lib/applications/repository";
import type { ResumeIR } from "@/lib/resume-ir";
import { ResumeRenderer } from "./resume-renderer";
type Dashboard = Awaited<ReturnType<typeof applicationDashboard>>;
export function ApplicationManager({ data }: { data: Dashboard }) {
  const router = useRouter();
  const [organization, setOrganization] = useState(""),
    [role, setRole] = useState(""),
    [jd, setJD] = useState(""),
    [metadata, setMetadata] = useState<JobMetadata>(
      suggestedMetadata("", "US"),
    ),
    [preview, setPreview] = useState<{
      id: string;
      options: Record<string, ResumeIR>;
    } | null>(null),
    [strategy, setStrategy] = useState<string>("TRADITIONAL"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [name, setName] = useState(""),
    [family, setFamily] = useState(""),
    [market, setMarket] = useState("");
  async function action(payload: unknown) {
    const r = await fetch("/api/admin/applications", {
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
      setMessage(e instanceof Error ? e.message : "Unable to complete action.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <section className="surface">
        <h2>Prepare an application</h2>
        <p>
          Only published canonical facts enter the preview. Review all
          strategies before saving; a running eligible experiment assigns a
          balanced variant automatically.
        </p>
        <form
          className="editor-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const d = await action({
                action: "prepare",
                application: {
                  organization,
                  role,
                  job_description: jd,
                  metadata,
                },
              });
              setPreview({ id: d.preview_id, options: d.options });
              setMessage(
                "Private preview ready. Review the generated facts before saving the immutable snapshot.",
              );
            });
          }}
        >
          <div className="field-row">
            <label>
              Company
              <input
                required
                maxLength={200}
                value={organization}
                onChange={(e) => {
                  setOrganization(e.target.value);
                  setPreview(null);
                }}
              />
            </label>
            <label>
              Role
              <input
                required
                maxLength={200}
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setPreview(null);
                }}
              />
            </label>
          </div>
          <label>
            Job description
            <textarea
              required
              rows={8}
              maxLength={12000}
              value={jd}
              onChange={(e) => {
                setJD(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setMetadata(suggestedMetadata(jd + " " + role, metadata.market));
              setPreview(null);
            }}
          >
            Suggest metadata for review
          </button>
          <div className="field-row">
            {Object.entries(metadataSchema.shape).map(([key, schema]) => (
              <label key={key}>
                {key.replaceAll("_", " ")}
                <select
                  value={metadata[key as keyof JobMetadata]}
                  onChange={(e) => {
                    setMetadata({ ...metadata, [key]: e.target.value });
                    setPreview(null);
                  }}
                >
                  {schema.options.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button disabled={busy}>Retrieve evidence & prepare previews</button>
        </form>
        <p role="status">{message}</p>
      </section>
      {preview && (
        <section>
          <div className="surface">
            <label>
              Preview composition
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
              >
                {strategies.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <p>
              The same visual template and canonical facts are used throughout.
              Preview choice does not bias experiment assignment.
            </p>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const d = await action({
                    action: "save",
                    preview_id: preview.id,
                  });
                  setPreview(null);
                  router.refresh();
                  router.push(`/admin/applications/${d.id}`);
                })
              }
            >
              Approve previews & save snapshot / tracking link
            </button>
          </div>
          <ResumeRenderer ir={preview.options[strategy]} />
        </section>
      )}
      <section className="surface">
        <h2>Applications</h2>
        {!data.applications.length && <p>No saved applications yet.</p>}
        {data.applications.map((a) => (
          <div className="application-row" key={a.id}>
            <div>
              <Link className="text-link" href={`/admin/applications/${a.id}`}>
                {a.organization} · {a.role}
              </Link>
              <p>
                {a.strategy} · {a.status}
              </p>
              {a.code && <a href={`/r/${a.code}`}>Tracking link ↗</a>}
            </div>
            <label>
              Record outcome
              <select
                value={a.status}
                disabled={busy}
                onChange={(e) =>
                  run(async () => {
                    await action({
                      action: "outcome",
                      id: a.id,
                      status: e.target.value,
                    });
                    router.refresh();
                  })
                }
              >
                {outcomes
                  .filter((s) => outcomeAllowed(a.status, s))
                  .map((s) => (
                    <option key={s}>{s}</option>
                  ))}
              </select>
            </label>
          </div>
        ))}
      </section>
      <section className="surface">
        <h2>Resume experiments</h2>
        <p>
          A/B/C changes composition and section emphasis. Assignment balances
          all saved snapshots, including drafts. One eligible running experiment
          is used, oldest first. No winner is declared.
        </p>
        <form
          className="field-row"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await action({
                action: "experiment",
                name,
                job_family: family || null,
                market: market || null,
              });
              setName("");
              router.refresh();
            });
          }}
        >
          <label>
            Name
            <input
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Job family
            <select value={family} onChange={(e) => setFamily(e.target.value)}>
              <option value="">Any family</option>
              {families.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            Market
            <select value={market} onChange={(e) => setMarket(e.target.value)}>
              <option value="">Any market</option>
              <option>US</option>
              <option>BG</option>
            </select>
          </label>
          <button disabled={busy}>Create A/B/C experiment</button>
        </form>
        {data.experiments.map((e) => (
          <div className="experiment" key={e.id}>
            <div className="field-row">
              <h3>{e.name}</h3>
              <label>
                Status
                <select
                  disabled={busy}
                  value={e.status}
                  onChange={(ev) =>
                    run(async () => {
                      await action({
                        action: "experiment_status",
                        id: e.id,
                        status: ev.target.value,
                      });
                      router.refresh();
                    })
                  }
                >
                  {["DRAFT", "RUNNING", "PAUSED", "COMPLETED"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <p>
              {e.job_family || "Any family"} · {e.market || "Any market"}
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      "Variant",
                      "Assigned",
                      "Sent",
                      "Visits",
                      "Engagement",
                      "Workspaces",
                      "Questions",
                      "Previews",
                      "Exports",
                      "Interviews",
                      "Offers",
                      "Signal",
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.analytics
                    .filter((v) => v.experiment_id === e.id)
                    .map((v) => (
                      <tr key={v.id}>
                        <td>
                          {v.label} · {v.strategy}
                        </td>
                        <td>{v.assigned}</td>
                        <td>{v.sent}</td>
                        <td>{v.visits}</td>
                        <td>{v.engagement}</td>
                        <td>{v.workspace_starts}</td>
                        <td>{v.questions}</td>
                        <td>{v.resume_previews}</td>
                        <td>{v.exports}</td>
                        <td>
                          {v.interviews} (
                          {v.interview_rate === null
                            ? "—"
                            : `${Math.round(v.interview_rate * 100)}%`}
                          )
                        </td>
                        <td>
                          {v.offers} (
                          {v.offer_rate === null
                            ? "—"
                            : `${Math.round(v.offer_rate * 100)}%`}
                          )
                        </td>
                        <td>{v.signal}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <p className="muted">
          Rates use manually marked sent applications. Visits use unique
          link/session pairs. Tracking opt-outs and unobserved outcomes leave
          incomplete data.
          {data.truncated
            ? " This view is capped at 1,000 records per table; totals are incomplete."
            : ""}
        </p>
      </section>
      <section className="surface">
        <h2>Recruiter interests & coverage</h2>
        <p>
          Observed topics and exploration signals are prompts for owner review.
          Evidence counts and inclusion use the current published career and
          saved application snapshots.
        </p>
        {data.suggestions.length ? (
          data.suggestions.map((s) => (
            <p key={s.topic}>
              <strong>{s.topic}</strong> · {s.count} signals · {s.evidence}{" "}
              supporting records · {s.included} represented records
              <br />
              {s.suggestion}
            </p>
          ))
        ) : (
          <p>No interest signals yet.</p>
        )}
      </section>
    </div>
  );
}
