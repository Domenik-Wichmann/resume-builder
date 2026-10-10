"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
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
import { resumeIRSchema, type ResumeIR } from "@/lib/resume-ir";
import { ResumeRenderer } from "./resume-renderer";
import { ResumeLengthNotice } from "./resume-length-notice";
import { clearSignalDesign } from "@/lib/resume-design/model";
type Dashboard = Awaited<ReturnType<typeof applicationDashboard>>;
const responseSchema = z.object({
  id: z.string().optional(),
  preview_id: z.string().optional(),
  stage: z.number().optional(),
  label: z.string().optional(),
  options: z.record(z.string(), resumeIRSchema).optional(),
  review: z.array(z.string()).optional(),
  error: z.string().optional(),
});
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
  const [learning, setLearning] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [review, setReview] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState<number | null>(null);
  const saved = data.applications.filter((a) =>
    `${a.organization} ${a.role}`.toLowerCase().includes(search.toLowerCase()),
  );
  function rememberDraft(id: string | null) {
    setDraftId(id);
    // Browser storage can be disabled. The current generation must still work.
    try {
      if (id) localStorage.setItem("resume-application-draft", id);
      else localStorage.removeItem("resume-application-draft");
    } catch {
      /* The server owns the draft; local storage only helps resume it. */
    }
  }
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        setDraftId(localStorage.getItem("resume-application-draft"));
      } catch {
        /* Storage is optional. */
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  async function action(payload: unknown) {
    const r = await fetch("/api/admin/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const raw: unknown = await r.json().catch(() => null);
    const parsed = responseSchema.safeParse(raw);
    if (!parsed.success)
      throw new Error(
        "The server response was interrupted. Resume your saved generation to try again.",
      );
    const d = parsed.data;
    if (!r.ok)
      throw new Error(d.error || "Unable to complete this step. Try again.");
    return d;
  }
  async function continueDraft(id: string) {
    setPreview(null);
    let state = await action({ action: "status", preview_id: id });
    if (state.id) {
      rememberDraft(null);
      router.push(`/admin/applications/${state.id}`);
      return;
    }
    while (state.stage !== undefined && state.stage < 4) {
      setStage(state.stage);
      setMessage(state.label || "Preparing your draft");
      state = await action({
        action: "generate",
        preview_id: id,
        stage: state.stage,
      });
    }
    if (!state.options || state.stage !== 4)
      throw new Error("Draft status is unavailable.");
    setPreview({ id, options: state.options });
    setStage(4);
    setReview(state.review || []);
    setMessage(
      "Private preview ready. Review the facts and gaps, then save to obtain the real tracking link before exporting.",
    );
  }
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setFailed(false);
    setMessage("");
    try {
      await task();
    } catch (e) {
      setFailed(true);
      setMessage(e instanceof Error ? e.message : "Unable to complete action.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack resume-manager">
      <section className="surface" aria-labelledby="resume-library-title">
        <div className="resume-library-heading">
          <div>
            <h2 id="resume-library-title">
              Saved résumés{" "}
              <span className="resume-badge">{data.applications.length}</span>
            </h2>
            <p className="muted">
              Open a version to preview, export and see its activity.
            </p>
          </div>
          <a className="button" href="#create-resume">
            + Create a résumé
          </a>
        </div>
        {data.applications.length > 0 && (
          <label className="resume-search">
            Find a résumé
            <input
              type="search"
              value={search}
              placeholder="Search company or role"
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        )}
        <div className="resume-library-grid">
          {saved.map((a) => (
            <article className="resume-history-card" key={a.id}>
              <Link
                className="resume-card-link"
                href={`/admin/applications/${a.id}`}
              >
                <div className="resume-card-top">
                  <span className="resume-badge">
                    {a.market === "US"
                      ? "United States"
                      : a.market === "BG"
                        ? "Bulgaria"
                        : "Legacy version"}
                  </span>
                  <span aria-hidden="true">↗</span>
                </div>
                <h3>{a.role}</h3>
                <p>{a.organization}</p>
                <p className="muted">
                  {a.generated_at
                    ? `Saved ${new Date(a.generated_at).toLocaleDateString("en-GB", { timeZone: "UTC" })}`
                    : "Tracking application"}
                </p>
                <div className="resume-card-stats">
                  <span>
                    <strong>{a.activity.visits}</strong> visits
                  </span>
                  <span>
                    <strong>{a.activity.questions}</strong> questions
                  </span>
                  <span>
                    <strong>{a.activity.exports}</strong> export opens
                  </span>
                </div>
                <span className="text-link">View résumé & analytics →</span>
              </Link>
              <label>
                Application status
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
            </article>
          ))}
        </div>
        {!data.applications.length && (
          <div className="resume-empty">
            <h3>Your first résumé starts here.</h3>
            <p>
              Add a job description below. Review the draft, then save it to
              keep a version and get its tracking link.
            </p>
          </div>
        )}
        {data.applications.length > 0 && !saved.length && (
          <p>No résumés match your search.</p>
        )}
        {data.truncated && (
          <p className="muted">
            Activity uses up to 1,000 retained records per source. Counts may be
            partial.
          </p>
        )}
      </section>
      <section id="create-resume" className="surface resume-create">
        <p className="eyebrow">
          1. Add the job · 2. Review your draft · 3. Save & export
        </p>
        <h2>Create a tailored résumé</h2>
        <p>
          Paste the job description and choose your résumé region. The draft
          uses your published career evidence. Review it before saving.
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
                  learning_demo: learning || null,
                },
              });
              if (!d.preview_id) throw new Error("Cannot start generation.");
              rememberDraft(d.preview_id);
              await continueDraft(d.preview_id);
            });
          }}
        >
          <fieldset disabled={busy} className="resume-form-fields">
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
            <fieldset className="resume-region">
              <legend>Résumé region</legend>
              <p className="muted">
                Uses your configured regional contact details and paper size.
                Your career facts and physical residence stay the same.
              </p>
              <div className="resume-region-options">
                {(
                  [
                    [
                      "US",
                      "United States",
                      "US contact profile · Letter paper",
                    ],
                    ["BG", "Bulgaria", "Bulgarian contact profile · A4 paper"],
                  ] as const
                ).map(([value, label, hint]) => (
                  <label
                    key={value}
                    className={metadata.market === value ? "selected" : ""}
                  >
                    <input
                      type="radio"
                      name="resume-region"
                      value={value}
                      checked={metadata.market === value}
                      onChange={() => {
                        setMetadata({ ...metadata, market: value });
                        setPreview(null);
                      }}
                    />
                    <span>
                      <strong>{label}</strong>
                      <small>{hint}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <details className="resume-advanced">
              <summary>Optional details & experiment settings</summary>
              <label>
                Application-specific SystemWright learning demo (optional)
                <input
                  type="url"
                  maxLength={2000}
                  value={learning}
                  onChange={(e) => {
                    setLearning(e.target.value);
                    setPreview(null);
                  }}
                  placeholder="https://… learning page"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setMetadata(
                    suggestedMetadata(jd + " " + role, metadata.market),
                  );
                  setPreview(null);
                }}
              >
                Suggest metadata for review
              </button>
              <div className="field-row">
                {Object.entries(metadataSchema.shape)
                  .filter(([key]) => key !== "market")
                  .map(([key, schema]) => (
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
            </details>
            <button disabled={busy}>
              {busy ? "Generating your draft…" : "Generate résumé for this job"}
            </button>
          </fieldset>
        </form>
        {draftId && !preview && (
          <button
            disabled={busy}
            onClick={() => run(() => continueDraft(draftId))}
          >
            {failed ? "Retry saved generation" : "Continue saved generation"}
          </button>
        )}
        {draftId && !busy && !preview && (
          <button
            className="resume-dismiss"
            onClick={() => {
              rememberDraft(null);
              setStage(null);
              setMessage("");
            }}
          >
            Dismiss draft & start fresh
          </button>
        )}
        {stage !== null && (
          <ol
            className="resume-generation-steps"
            aria-label="Generation progress"
          >
            {[
              "Understand job",
              "Find evidence",
              "Write résumé",
              "Verify facts",
            ].map((label, index) => (
              <li
                key={label}
                aria-current={stage === index ? "step" : undefined}
                className={stage > index ? "complete" : ""}
              >
                {stage > index ? "✓" : index + 1} {label}
              </li>
            ))}
          </ol>
        )}
        <p
          className={failed ? "resume-feedback error" : "resume-feedback"}
          role={failed ? "alert" : "status"}
        >
          {message}
        </p>
      </section>
      {preview && (
        <section>
          <ResumeRenderer ir={preview.options[strategy]} />
          <ResumeLengthNotice
            design={preview.options[strategy].design || clearSignalDesign}
          />
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
            <p>
              Tracking link pending: saving finalizes this application and
              replaces every portfolio occurrence with its persisted tracking
              URL.
            </p>
            {review.length > 0 && (
              <details>
                <summary>Private coverage and factual review</summary>
                <ul>
                  {review.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </details>
            )}
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const d = await action({
                    action: "save",
                    preview_id: preview.id,
                  });
                  if (!d.id)
                    throw new Error(
                      "The saved résumé could not be opened. Try saving again.",
                    );
                  setPreview(null);
                  rememberDraft(null);
                  router.refresh();
                  router.push(`/admin/applications/${d.id}`);
                })
              }
            >
              Save résumé & get tracking link
            </button>
          </div>
        </section>
      )}
      <section className="surface">
        <details className="resume-experiments">
          <summary>Résumé experiments & evidence insights</summary>
          <h2>Resume experiments</h2>
          <p>
            A/B/C changes composition and section emphasis. Assignment balances
            all saved snapshots, including drafts. One eligible running
            experiment is used, oldest first. No winner is declared.
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
              <select
                value={family}
                onChange={(e) => setFamily(e.target.value)}
              >
                <option value="">Any family</option>
                {families.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label>
              Market
              <select
                value={market}
                onChange={(e) => setMarket(e.target.value)}
              >
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
          <h2>Recruiter interests & coverage</h2>
          <p>
            Observed topics and exploration signals are prompts for owner
            review. Evidence counts and inclusion use the current published
            career and saved application snapshots.
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
        </details>
      </section>
    </div>
  );
}
