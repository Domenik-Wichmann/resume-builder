"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  selectionFor,
  type ExplorerData,
  type RecordEdit,
} from "@/lib/career-brain/record-view";
import { CareerRecordEditor } from "./career-record-editor";
export function ProfileIdentityEditor({ initial }: { initial: ExplorerData }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reset, setReset] = useState(0);
  const locked = useRef(false);
  const profile = data.records.find(
    (row) => row.kind === "profile" && !row.archived,
  );
  async function save(edit: RecordEdit) {
    if (!profile || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          record: selectionFor(profile),
          edit,
        }),
      });
      const next = await response.json();
      if (!response.ok)
        throw new Error(next.error || "Unable to save profile.");
      setData({ records: next.records, sources: next.sources });
      setReset((value) => value + 1);
      setMessage(
        next.indexing?.pending
          ? next.indexing.message
          : "Profile saved privately. Publish it in Career Explorer when you are ready.",
      );
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("career-records");
        channel.postMessage({ changed: true });
        channel.close();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save profile.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="studio-section">
      <h2>Name, headline & introduction</h2>
      <p className="muted">
        Edit your canonical profile here. Changes preserve its identity and stay
        private until republished.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {profile ? (
        <CareerRecordEditor
          key={`${profile.id}-${reset}`}
          row={profile}
          records={data.records}
          focusedProfile
          busy={busy}
          onSave={save}
          onCancel={() => {
            setReset((value) => value + 1);
            setError("");
            setMessage("");
          }}
        />
      ) : (
        <p>
          No active profile is available. Create or restore one in{" "}
          <Link href="/admin/explore">Career Explorer</Link>.
        </p>
      )}
    </section>
  );
}
